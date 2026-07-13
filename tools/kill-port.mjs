/**
 * Windows：结束占用指定 TCP 端口的监听进程（用于重启 dev-server 加载新策略）
 */
import { execSync } from "node:child_process";

/** 从 netstat 行解析本地监听端口 */
function localListenPort(line) {
  const m = line.match(/^\s*TCP\s+(\S+):(\d+)\s+/i);
  if (!m) return null;
  return Number(m[2]);
}

export function killProcessOnPort(port) {
  if (process.platform !== "win32") return [];
  const killed = [];
  try {
    const out = execSync("netstat -ano -p tcp | findstr :" + port, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!/LISTENING/i.test(line)) continue;
      if (localListenPort(line) !== port) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync("taskkill /F /PID " + pid, { stdio: "ignore" });
        killed.push(Number(pid));
      } catch {
        /* 进程已退出 */
      }
    }
  } catch {
    /* 无占用 */
  }
  return killed;
}