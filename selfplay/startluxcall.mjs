#!/usr/bin/env node
/**
 * 子进程：一次 StartLux 调用（stdin JSON → stdout JSON）。
 * backend=bamboo（默认，BAMBOO_API_KEY）→ Bamboo 27B AutoThink；
 * backend=local → 本地 llama-server 字母读出（STARTLUX_URL）。
 * 密钥只从环境变量读，从不输出。
 */
import { ensureBambooKey, pickWithBamboo } from '../policy/bambooScore.js';
import { pickWithStartLux } from '../policy/startluxScore.js';

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const req = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const backend = req.backend || process.env.STARTLUX_BACKEND || 'bamboo';
const t0 = Date.now();

let r;
if (backend === 'local') {
  r = await pickWithStartLux({
    candidates: req.candidates,
    raw: req.raw,
    url: req.url || process.env.STARTLUX_URL,
    timeoutMs: req.timeoutMs || 600000,
  });
} else {
  ensureBambooKey();
  r = await pickWithBamboo({
    candidates: req.candidates,
    raw: req.raw,
    apiKey: process.env.BAMBOO_API_KEY,
    timeoutMs: req.timeoutMs || 120000,
    url: req.url || process.env.STARTLUX_BAMBOO_URL,
  });
}

process.stdout.write(JSON.stringify({
  index: r.index,
  choice: r.choice,
  confidence: r.confidence ?? null,
  error: r.error || null,
  errBody: r.errBody || null,
  status: r.status ?? null,
  usage: r.usage ?? null,
  none_probability: r.none_probability ?? null,
  ms: Date.now() - t0,
  backend,
}));
