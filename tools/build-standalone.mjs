import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const entryPath = path.join(root, "app", "main.mjs");
const htmlPath = path.join(root, "app", "index.html");
const outPath = path.join(root, "guandan-coach-standalone.html");
const moduleSources = {};
const seen = new Set();

function toRelative(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function collectModule(filePath) {
  const absolutePath = path.resolve(filePath);
  const moduleName = toRelative(absolutePath);
  if (seen.has(moduleName)) return;
  seen.add(moduleName);

  const source = fs.readFileSync(absolutePath, "utf8");
  const importPattern = /from\s+["']([^"']+)["'];?/g;
  let match;
  while ((match = importPattern.exec(source))) {
    const specifier = match[1];
    if (specifier.startsWith(".")) {
      collectModule(path.resolve(path.dirname(absolutePath), specifier));
    }
  }
  moduleSources[moduleName] = source;
}

function resolveModule(from, specifier) {
  const base = from.split("/").slice(0, -1).join("/");
  const stack = (base ? `${base}/` : "") + specifier;
  const parts = [];
  for (const part of stack.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function rewriteImports(id, source) {
  return source.replace(/from\s+["'](\.[^"']+)["']/g, (full, specifier) => {
    const resolved = resolveModule(id, specifier);
    return `from "bundled://${resolved}"`;
  });
}

collectModule(entryPath);

const rewrittenSources = {};
for (const [id, source] of Object.entries(moduleSources)) {
  rewrittenSources[id] = rewriteImports(id, source);
}

function moduleInitOrder(sources) {
  const ids = Object.keys(sources);
  const ready = [];
  const pending = new Set(ids);
  while (pending.size > 0) {
    let progressed = false;
    for (const id of [...pending]) {
      const deps = [...sources[id].matchAll(/from "bundled:\/\/([^"]+)"/g)].map((m) => m[1]);
      if (deps.every((dep) => ready.includes(dep))) {
        ready.push(id);
        pending.delete(id);
        progressed = true;
      }
    }
    if (!progressed) throw new Error("Circular module dependency in standalone bundle");
  }
  return ready;
}

const initOrder = moduleInitOrder(rewrittenSources);

let html = fs.readFileSync(htmlPath, "utf8");
const bootstrap = `
    <script type="module">
const rewrittenSources = ${JSON.stringify(rewrittenSources)};
const initOrder = ${JSON.stringify(initOrder)};
const moduleUrls = new Map();
for (const id of initOrder) {
  let code = rewrittenSources[id];
  for (const [otherId, url] of moduleUrls) {
    code = code.split("bundled://" + otherId).join(url);
  }
  moduleUrls.set(id, URL.createObjectURL(new Blob([code], { type: "text/javascript;charset=utf-8" })));
}
if (location.protocol === "file:") {
  const footer = document.querySelector("#message");
  if (footer) {
    footer.textContent =
      "file:// 无法加载模块。请运行「点我启动掼蛋教练Pro.cmd」或 npm run start，访问 http://127.0.0.1:8010/app/";
  }
} else {
  import(moduleUrls.get("app/main.mjs")).catch((error) => {
    console.error(error);
    const footer = document.querySelector("#message");
    if (footer) footer.textContent = "页面脚本加载失败：" + error.message;
  });
}
    </script>
  </body>`;

html = html.replace(/<script type="module"[^>]*>[\s\S]*?<\/script>\s*<\/body>/, bootstrap);

const buildStamp = String(Date.now());
html = html.replace(
  "</head>",
  `<script>globalThis.__GUANDAN_BUILD__="${buildStamp}";</script>\n</head>`,
);

const modelPath = path.join(root, "models", "policy-v001", "model.json");
if (fs.existsSync(modelPath)) {
  const modelJson = fs.readFileSync(modelPath, "utf8");
  html = html.replace(
    "</head>",
    `<script>globalThis.__GUANDAN_ML_MODEL__ = ${modelJson};</script>\n</head>`,
  );
}

fs.writeFileSync(outPath, html, "utf8");

if (!html.includes("rewrittenSources")) {
  console.error("构建失败：standalone 未内嵌模块，请检查 app/index.html 的 script 标签。");
  process.exit(1);
}

console.log(outPath);
