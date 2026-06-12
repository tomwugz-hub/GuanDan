import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.GUANDAN_PORT ?? 8010);
const entryModule = path.join(root, "app", "main.mjs");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
};

function readBuildStamp() {
  try {
    return String(Math.floor(fs.statSync(entryModule).mtimeMs));
  } catch {
    return String(Date.now());
  }
}

let buildStamp = readBuildStamp();

function noCacheHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
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
        "</head>",
        `<script>globalThis.__GUANDAN_BUILD__="${buildStamp}";</script>\n</head>`,
      );
    res.writeHead(200, {
      "Content-Type": mime[".html"],
      ...noCacheHeaders(),
    });
    res.end(stamped);
  });
}

http.createServer((req, res) => {
  let urlPath = req.url === "/" ? "/app/" : req.url;
  urlPath = urlPath.split("?")[0];

  if (urlPath === "/app/build.json") {
    buildStamp = readBuildStamp();
    res.writeHead(200, {
      "Content-Type": mime[".json"],
      ...noCacheHeaders(),
    });
    res.end(JSON.stringify({ build: buildStamp, entry: "app/main.mjs" }));
    return;
  }

  let filePath = path.join(root, urlPath.replace(/^\//, ""));
  if (urlPath.endsWith("/")) {
    filePath = path.join(filePath, "index.html");
  }
  const resolved = path.normalize(filePath);
  if (!resolved.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (resolved.endsWith(`${path.sep}app${path.sep}index.html`)) {
    serveIndexHtml(res, resolved);
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(resolved);
    const noCache = ext === ".html" || ext === ".mjs" || ext === ".js";
    res.writeHead(200, {
      "Content-Type": mime[ext] ?? "application/octet-stream",
      ...(noCache ? noCacheHeaders() : {}),
    });
    res.end(data);
  });
}).listen(port, () => {
  buildStamp = readBuildStamp();
  console.log(`http://127.0.0.1:${port}/app/  (build ${buildStamp})`);
  console.log("改代码后无需重启本服务；若强刷仍见旧页面，请关掉旧标签用启动脚本重开。");
});
