import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { printAccessUrls } from "./lan-access.mjs";
import { killProcessOnPort } from "./kill-port.mjs";
import { TRIAL_PLAY_VERSION } from "../app/trial-config.mjs";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.GUANDAN_PORT ?? 8010);
const host = process.env.GUANDAN_HOST ?? "0.0.0.0";
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
    env: { ...process.env, GUANDAN_HOST: host },
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


function readStrategyBuildStamp() {
  const files = [
    path.join(projectRoot, "app", "main.mjs"),
    path.join(projectRoot, "coach", "turn-advice.mjs"),
    path.join(projectRoot, "strategy", "recommend.mjs"),
    path.join(projectRoot, "strategy", "sf-runway-guard.mjs"),
    path.join(projectRoot, "strategy", "scorers", "structure.mjs"),
    path.join(projectRoot, "coach", "robot-player.mjs"),
    path.join(projectRoot, "strategy", "principles.mjs"),
  ];
  let maxMs = 0;
  for (const f of files) {
    try {
      maxMs = Math.max(maxMs, fs.statSync(f).mtimeMs);
    } catch {
      /* ignore */
    }
  }
  const d = new Date(maxMs || Date.now());
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} (stamp ${Math.floor(maxMs || Date.now())})`;
}

const killed = killProcessOnPort(port);
if (killed.length > 0) {
  console.log(`已结束旧本地服务 (PID ${killed.join(", ")})，正在加载最新策略…`);
  await new Promise((r) => setTimeout(r, 400));
} else {
  console.log("正在启动本地服务（加载最新策略）…");
}
startServer();
const ok = await waitForServer();
if (!ok) {
  console.error(`无法在端口 ${port} 启动本地服务。请在本目录执行: npm run dev`);
  process.exit(1);
}
console.log(`策略代码时间: ${readStrategyBuildStamp()}`);

console.log(`已打开: ${url}`);
printAccessUrls(port, { host });
console.log(`试玩版: ${TRIAL_PLAY_VERSION}`);
console.log("手机试玩：手机与电脑同一 WiFi，关蜂窝数据，浏览器用 http（非 https）访问上方「手机/局域网」地址。");
console.log("外网试玩：双击「点我启动-手机外网试玩.cmd」获取临时 HTTPS 链接。");
console.log("");
console.log("--- 使用提示 ---");
console.log(`标注页: http://127.0.0.1:${port}/app/hand-labeler.html?case=51`);
console.log("改代码后: 重跑本启动脚本即可加载最新策略（会自动重启本地服务）；浏览器 Ctrl+F5 强刷");
console.log("Edge 打不开: 先执行 set GUANDAN_BROWSER=chrome 再启动");
console.log("勿直接双击 html 文件；须保持本黑窗口打开");
if (process.env.FIREWALL_ERR === "1") {
  console.log("防火墙: 自动放行失败，手机可能连不上。请以管理员运行 tools\\allow-lan-firewall.ps1");
}
openBrowser(url);
