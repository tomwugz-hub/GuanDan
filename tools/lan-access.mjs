import os from "node:os";

/** Default bind address for local dev (override with GUANDAN_HOST). */
export const DEFAULT_DEV_HOST = "127.0.0.1";

function formatHostForUrl(host) {
  if (!host || host === "0.0.0.0") return "127.0.0.1";
  if (host.includes(":")) return `[${host}]`;
  return host;
}

function collectLanIpv4Addresses() {
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const entries of Object.values(nets)) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      addrs.push(entry.address);
    }
  }
  return [...new Set(addrs)];
}

/**
 * Print human-readable URLs after dev server / launcher starts.
 * @param {number} port
 * @param {{ buildStamp?: string, host?: string }} [options]
 */
export function printAccessUrls(port, { buildStamp, host } = {}) {
  const bindHost = host ?? DEFAULT_DEV_HOST;
  const localHost = formatHostForUrl(bindHost);
  const base = `http://${localHost}:${port}`;
  console.log(`教练页: ${base}/app/`);
  console.log(`健康检查: ${base}/ping`);
  if (bindHost === "0.0.0.0") {
    for (const addr of collectLanIpv4Addresses()) {
      console.log(`局域网: http://${addr}:${port}/app/`);
    }
  }
  if (buildStamp) {
    console.log(`构建戳: ${buildStamp}`);
  }
}
