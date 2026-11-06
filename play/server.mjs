#!/usr/bin/env node
/**
 * 可选本地服务器：提供网页 + /api/jev（Jev 机器人）。
 * 用法：node server.mjs   然后打开 http://localhost:8787
 * Jev 需要环境变量 TYPESAFE_API_KEY（或 TYPESAFE_API_KEY_NEW）；没有密钥时机器人自动用 decide（离线）。
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jevPick, jevKey } from './jevbridge.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = globalThis.__GD_STATIC_ROOT || process.env.GD_STATIC_ROOT ||
  (existsSync(resolve(here, '../index.html')) && existsSync(resolve(here, '../guandan.bundle.js')) ? resolve(here, '..') : resolve(here, '../dist/guandan-play'));
const PORT = Number(process.env.PORT || 8787);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/status') return send(res, 200, JSON.stringify({ server: true, jev: !!jevKey() }));
    if (url.pathname === '/api/jev' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 2e6) throw new Error('too large'); }
      const out = await jevPick(JSON.parse(body));
      return send(res, 200, JSON.stringify(out));
    }
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/index.html';
    const file = normalize(join(ROOT, p));
    if (file !== ROOT && !file.startsWith(ROOT + sep)) return send(res, 403, 'forbidden', 'text/plain');
    const data = await readFile(file);
    return send(res, 200, data, MIME[extname(file)] || 'application/octet-stream');
  } catch (e) {
    return send(res, e.code === 'ENOENT' ? 404 : 500, JSON.stringify({ error: String(e.message || e) }));
  }
});
server.listen(PORT, '127.0.0.1', () => {
  console.log(`掼蛋对局已启动：http://localhost:${PORT}`);
  console.log(jevKey() ? 'Jev 可用（已检测到 TYPESAFE_API_KEY）。' : '未检测到 TYPESAFE_API_KEY：Jev 不可用，机器人使用 decide（离线）。');
});
