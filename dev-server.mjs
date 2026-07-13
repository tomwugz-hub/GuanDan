import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { printAccessUrls } from "./tools/lan-access.mjs";
import { TRIAL_PLAY_VERSION } from "./app/trial-config.mjs";
import { renderCasePage } from "./tools/render-case-page.mjs";
import { cropCaseHand } from "./tools/crop-case-hand.mjs";
import {
  DEFAULT_DEV_HOST,
  isLocalDevelopmentRequest,
  resolveStaticAccess,
} from "./tools/lib/dev-server-access.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const casesDir = path.join(root, "training-samples", "cases");
const port = Number(process.env.GUANDAN_PORT ?? 8010);
const host = process.env.GUANDAN_HOST ?? DEFAULT_DEV_HOST;
const entryModule = path.join(root, "app", "main.mjs");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

function readBuildStamp() {
  const files = [
    entryModule,
    path.join(root, "coach", "turn-advice.mjs"),
    path.join(root, "strategy", "recommend.mjs"),
    path.join(root, "strategy", "sf-runway-guard.mjs"),
    path.join(root, "strategy", "scorers", "structure.mjs"),
    path.join(root, "coach", "robot-player.mjs"),
    path.join(root, "strategy", "principles.mjs"),
  ];
  let maxMs = 0;
  for (const f of files) {
    try {
      maxMs = Math.max(maxMs, fs.statSync(f).mtimeMs);
    } catch {
      /* ignore */
    }
  }
  return String(Math.floor(maxMs || Date.now()));
}

/** hand-labeler 独立 stamp：避免只改标注页时仍缓存旧 hand-labeler.mjs */
function readHandLabelerBuildStamp() {
  const files = [
    path.join(root, "app", "hand-labeler.mjs"),
    path.join(root, "app", "hand-labeler.css"),
  ];
  let maxMs = 0;
  for (const f of files) {
    try {
      maxMs = Math.max(maxMs, fs.statSync(f).mtimeMs);
    } catch {
      /* ignore */
    }
  }
  return String(Math.floor(maxMs || Date.now()));
}

let buildStamp = readBuildStamp();

function noCacheHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
}

/** 为 ESM 相对 import 追加 ?v= 戳，避免浏览器长期缓存 strategy 子模块 */
function stampEsmModuleSource(source, stamp) {
  const stampImport = (_match, prefix, spec, _query, closing) => `${prefix}${spec}?v=${stamp}${closing}`;
  return source
    .replace(/(from\s+["'])(\.\.?\/[^"']+\.mjs)(\?[^"']*)?(["'])/g, stampImport)
    .replace(/(import\s*\(\s*["'])(\.\.?\/[^"']+\.mjs)(\?[^"']*)?(["']\s*\))/g, stampImport)
    .replace(/(export\s+[^"']*from\s+["'])(\.\.?\/[^"']+\.mjs)(\?[^"']*)?(["'])/g, stampImport);
}

function decodeUrlPath(rawPath) {
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
}

function serveHandLabelerHtml(res, filePath) {
  fs.readFile(filePath, "utf8", (err, html) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const handLabelerStamp = readHandLabelerBuildStamp();
    const stamped = html
      .replace(
        /(<link\s+rel="stylesheet"\s+href=")\.\/hand-labeler\.css(?:\?v=[^"]*)?(")/,
        `$1./hand-labeler.css?v=${handLabelerStamp}$2`,
      )
      .replace(
        /(<script\s+type="module"\s+src=")\.\/hand-labeler\.mjs(?:\?v=[^"]*)?(")/,
        `$1./hand-labeler.mjs?v=${handLabelerStamp}$2`,
      )
      .replace(
        "</head>",
        `<script>globalThis.__GUANDAN_BUILD__="${handLabelerStamp}";</script>\n</head>`,
      );
    res.writeHead(200, {
      "Content-Type": mime[".html"],
      ...noCacheHeaders(),
    });
    res.end(stamped);
  });
}

function readRequestBody(req, limitBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("请求体过大"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** 仅允许 case-001..case-100（无例 85、88），禁止路径穿越 */
const SKIPPED_BOOK_CASES = new Set([85, 88]);

function safeCaseId(caseNumber) {
  const n = Number(caseNumber);
  if (!Number.isFinite(n) || n < 1 || n > 100 || Math.floor(n) !== n) return null;
  if (SKIPPED_BOOK_CASES.has(n)) return null;
  const id = `case-${String(n).padStart(3, "0")}`;
  if (!/^case-\d{3}$/.test(id)) return null;
  return id;
}

function jsonResponse(res, status, body) {
  res.writeHead(status, {
    "Content-Type": mime[".json"],
    ...noCacheHeaders(),
  });
  res.end(JSON.stringify(body));
}

async function handleSaveCaseJson(req, res) {
  let raw = "";
  try {
    raw = await readRequestBody(req);
  } catch (err) {
    jsonResponse(res, 400, { ok: false, error: err?.message || "读取请求体失败" });
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    jsonResponse(res, 400, { ok: false, error: "JSON 无效" });
    return;
  }

  let data = parsed;
  let caseNumber = parsed.caseNumber;
  if (parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)) {
    data = parsed.data;
    caseNumber = caseNumber ?? data.caseNumber;
  }

  const id = safeCaseId(caseNumber ?? data.caseNumber);
  if (!id) {
    jsonResponse(res, 400, { ok: false, error: "仅允许 case-001..case-100（无例 85、88）" });
    return;
  }

  const outPath = path.join(casesDir, `${id}.json`);
  const resolved = path.normalize(outPath);
  const casesResolved = path.normalize(casesDir);
  if (!resolved.startsWith(casesResolved + path.sep) && resolved !== casesResolved) {
    jsonResponse(res, 403, { ok: false, error: "禁止路径穿越" });
    return;
  }

  data = { ...data, id, caseNumber: Number(id.slice(5)) };
  const cardCount = data.hand?.cards?.length ?? 0;

  try {
    fs.mkdirSync(casesDir, { recursive: true });
    fs.writeFileSync(resolved, JSON.stringify(data, null, 2) + "\n", "utf8");
  } catch (err) {
    jsonResponse(res, 500, { ok: false, error: err?.message || "写入失败" });
    return;
  }

  const relPath = path.relative(root, resolved).replace(/\\/g, "/");
  jsonResponse(res, 200, { ok: true, path: relPath, cardCount });
}

function serveIndexHtml(res, filePath) {
  fs.readFile(filePath, "utf8", (err, html) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    buildStamp = readBuildStamp();
    const stamped = html
      .replace(
        /(<script\s+type="module"\s+src=")\.\/main\.mjs(?:\?v=[^"]*)?(")/,
        `$1./main.mjs?v=${buildStamp}$2`,
      )
      .replace(
        /(<link\s+rel="stylesheet"\s+href=")\.\/mobile-ui\.css(?:\?v=[^"]*)?(")/,
        `$1./mobile-ui.css?v=${buildStamp}$2`,
      )
      .replace(
        "</head>",
        `<script>globalThis.__GUANDAN_BUILD__="${buildStamp}";globalThis.__GUANDAN_STRATEGY_REV__=3;</script>\n</head>`,
      );
    res.writeHead(200, {
      "Content-Type": mime[".html"],
      ...noCacheHeaders(),
    });
    res.end(stamped);
  });
}

http.createServer((req, res) => {
  const rawPath = req.url?.split("?")[0] ?? "/";
  const localRequest = isLocalDevelopmentRequest(host, req.socket.remoteAddress);

  if (rawPath === "/") {
    res.writeHead(302, { Location: "/app/" });
    res.end();
    return;
  }

  const urlPath = decodeUrlPath(rawPath);

  if (urlPath === "/ping" || urlPath === "/app/health") {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      ...noCacheHeaders(),
    });
    res.end("ok");
    return;
  }

  if (urlPath === "/app/build.json") {
    buildStamp = readBuildStamp();
    res.writeHead(200, {
      "Content-Type": mime[".json"],
      ...noCacheHeaders(),
    });
    res.end(JSON.stringify({ build: buildStamp, entry: "app/main.mjs" }));
    return;
  }

  if (urlPath.startsWith("/api/") && !localRequest) {
    jsonResponse(res, 403, { ok: false, error: "本机开发接口不允许远程访问" });
    return;
  }

  if (urlPath === "/api/render-case-page") {
    const q = new URL(req.url ?? "", "http://localhost").searchParams;
    const caseNumber = Number(q.get("case") ?? q.get("n"));
    const pdfPage = q.get("page") ? Number(q.get("page")) : undefined;
    if (!Number.isFinite(caseNumber) || caseNumber < 1) {
      res.writeHead(400, { "Content-Type": mime[".json"], ...noCacheHeaders() });
      res.end(JSON.stringify({ ok: false, error: "缺少合法 case 参数" }));
      return;
    }
    const result = renderCasePage({ caseNumber, pdfPage });
    res.writeHead(result.ok ? 200 : 500, {
      "Content-Type": mime[".json"],
      ...noCacheHeaders(),
    });
    res.end(JSON.stringify(result));
    return;
  }

  if (urlPath === "/api/save-case-json") {
    if (req.method !== "POST") {
      jsonResponse(res, 405, { ok: false, error: "需 POST" });
      return;
    }
    handleSaveCaseJson(req, res).catch((err) => {
      jsonResponse(res, 500, { ok: false, error: err?.message || "内部错误" });
    });
    return;
  }

  if (urlPath === "/api/crop-case-hand") {
    const q = new URL(req.url ?? "", "http://localhost").searchParams;
    const caseNumber = Number(q.get("case") ?? q.get("n"));
    const pagePng = q.get("pagePng") || undefined;
    const force = q.get("force") === "1" || q.get("force") === "true";
    if (!Number.isFinite(caseNumber) || caseNumber < 1) {
      res.writeHead(400, { "Content-Type": mime[".json"], ...noCacheHeaders() });
      res.end(JSON.stringify({ ok: false, error: "缺少合法 case 参数" }));
      return;
    }
    const result = cropCaseHand({ caseNumber, pagePng, force });
    res.writeHead(result.ok ? 200 : 500, {
      "Content-Type": mime[".json"],
      ...noCacheHeaders(),
    });
    res.end(JSON.stringify(result));
    return;
  }

  const access = resolveStaticAccess(root, urlPath, { localRequest });
  if (!access.allowed) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  const resolved = access.filePath;

  if (resolved.endsWith(`${path.sep}app${path.sep}index.html`)) {
    serveIndexHtml(res, resolved);
    return;
  }

  if (resolved.endsWith(`${path.sep}app${path.sep}hand-labeler.html`)) {
    serveHandLabelerHtml(res, resolved);
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(resolved);
    const noCache = ext === ".html" || ext === ".mjs" || ext === ".js" || ext === ".css";
    buildStamp = readBuildStamp();
    let body = data;
    if (ext === ".mjs" || ext === ".js") {
      body = Buffer.from(stampEsmModuleSource(data.toString("utf8"), buildStamp), "utf8");
    }
    const headers = {
      "Content-Type": mime[ext] ?? "application/octet-stream",
      ...(noCache ? noCacheHeaders() : {}),
    };
    if (req.method === "HEAD") {
      res.writeHead(200, { ...headers, "Content-Length": body.length });
      res.end();
      return;
    }
    res.writeHead(200, headers);
    res.end(body);
  });
}).listen(port, host, () => {
  buildStamp = readBuildStamp();
  printAccessUrls(port, { buildStamp, host });
  console.log(`试玩版: ${TRIAL_PLAY_VERSION}  ·  说明: docs/TRIAL-PLAY-GUIDE.md`);
  console.log(`手牌标注: /app/hand-labeler.html  （例5: ?case=5）`);
  console.log("改代码后无需重启本服务；若强刷仍见旧页面，请关掉旧标签用启动脚本重开。");
});
