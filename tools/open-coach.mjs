import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.GUANDAN_PORT ?? 8010);
const openPath = process.env.GUANDAN_OPEN_PATH ?? "/app/";
const cacheBust = Date.now();
const url = `http://127.0.0.1:${port}${openPath}${openPath.includes("?") ? "&" : "?"}_=${cacheBust}`;

function probe() {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function startServer() {
  const child = spawn(process.execPath, [path.join(projectRoot, "dev-server.mjs")], {
    cwd: projectRoot,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

async function waitForServer(maxMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await probe()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function openBrowser(targetUrl) {
  if (process.platform === "win32") {
    const chrome = path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe");
    const useChrome = process.env.GUANDAN_BROWSER === "chrome";
    if (useChrome && fs.existsSync(chrome)) {
      spawn(chrome, [targetUrl], { detached: true, stdio: "ignore" }).unref();
      return;
    }
    spawn("cmd", ["/c", "start", "", targetUrl], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  if (process.platform === "darwin") {
    spawn("open", [targetUrl], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("xdg-open", [targetUrl], { detached: true, stdio: "ignore" }).unref();
}

if (!(await probe())) {
  startServer();
  const ok = await waitForServer();
  if (!ok) {
    console.error(`无法在端口 ${port} 启动本地服务。请在本目录执行: npm run dev`);
    process.exit(1);
  }
}

console.log(`已打开: ${url}`);
openBrowser(url);
