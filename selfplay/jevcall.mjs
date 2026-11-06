#!/usr/bin/env node
/**
 * 子进程：一次 Jev 调用（stdin = { candidates:[{key,label}], state }，stdout = 结果 JSON）。
 * 供同步的自对局循环用 spawnSync 调用。密钥只从环境变量读（TYPESAFE_API_KEY，缺省 TYPESAFE_API_KEY_NEW），从不输出。
 * 输出：{ index, choice, confidence, error, status, ms, usage, cost, meta }（raw 里只保留 usage/计费/模型等非答案字段）。
 */
import { pickWithJev } from '../policy/jevScore.js';

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const req = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const apiKey = process.env.TYPESAFE_API_KEY || process.env.TYPESAFE_API_KEY_NEW || '';
const t0 = Date.now();
const r = await pickWithJev({ candidates: req.candidates, state: req.state, persona: null, apiKey, timeoutMs: req.timeoutMs || 25000 });
const raw = r.raw && typeof r.raw === 'object' ? r.raw : {};
const pick = (o, ks) => Object.fromEntries(ks.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
const meta = pick(raw, ['model', 'id', 'status', 'created', 'object']);
if (req.debugKeys) meta.rawKeys = Object.keys(raw), meta.answerKeys = Object.keys(raw?.answers?.move || {});
let errBody = null;
if (r.error && raw.body) errBody = String(raw.body).slice(0, 200);
else if (r.error && raw.error) errBody = JSON.stringify(raw.error).slice(0, 200);
process.stdout.write(JSON.stringify({
  index: r.index, choice: r.choice, confidence: r.confidence, error: r.error || null, ms: Date.now() - t0,
  usage: raw.usage ?? raw.answers?.move?.usage ?? null, cost: raw.cost ?? raw.billing ?? raw.usage?.cost ?? null, meta, errBody,
}));
