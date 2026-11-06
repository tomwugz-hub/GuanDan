/**
 * 自对局 StartLux 代理（spec 'startlux'，可加 '#ret=..'）。
 * 与 Jev 同一套候选（buildJevCandidates / decide 硬过滤）。
 * 默认 Bamboo Relay 27B AutoThink（BAMBOO_API_KEY）；STARTLUX_BACKEND=local 时用本地 Instant GGUF。
 * 失败 → decide 兜底。缓存：bamboo → selfplay/cache/startlux27-cache.jsonl；local → startlux-cache.jsonl。
 * 并发 STARTLUX_CONCURRENCY（bamboo 默认 3；local 默认 1）；STARTLUX_MAX_CALLS 硬上限。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { moveKey } from '../policy/jevCandidates.js';
import { buildStateEn } from '../policy/startluxScore.js';
import { ensureBambooKey, BAMBOO_MODEL } from '../policy/bambooScore.js';
import { jevPrepare } from './jevAgent.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(HERE, 'cache');
const CALLER = path.join(HERE, 'startluxcall.mjs');
const env = (k, d) => (process.env[k] != null && process.env[k] !== '' ? Number(process.env[k]) : d);

function resolveBackend() {
  const b = (process.env.STARTLUX_BACKEND || '').toLowerCase();
  if (b === 'local') return 'local';
  if (b === 'bamboo') return 'bamboo';
  // auto: only if BAMBOO_API_KEY already in env (do NOT read secrets file for detection —
  // concurrent local Instant jobs must stay local when they unset BACKEND and leave the secrets file alone)
  if (process.env.BAMBOO_API_KEY) return 'bamboo';
  return 'local';
}

const BACKEND = resolveBackend();
const MODEL_TAG = BACKEND === 'bamboo'
  ? (process.env.STARTLUX_MODEL_TAG || BAMBOO_MODEL)
  : (process.env.STARTLUX_MODEL_TAG || 'StartLux-Decision-v1.1-2B-Instant-Q4_K_M');
const CACHE = process.env.STARTLUX_CACHE
  || path.join(CACHE_DIR, BACKEND === 'bamboo' ? 'startlux27-cache.jsonl' : 'startlux-cache.jsonl');
const TICKETS = process.env.STARTLUX_TICKETS
  || path.join(CACHE_DIR, BACKEND === 'bamboo' ? 'startlux27-tickets' : 'startlux-tickets');
const CALL_LOG = process.env.STARTLUX_CALL_LOG
  || path.join(HERE, 'logs', BACKEND === 'bamboo' ? 'startlux27-calls.jsonl' : 'startlux-calls.jsonl');

let cache = null;
function loadCache() {
  if (cache) return cache;
  cache = new Map();
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (fs.existsSync(CACHE)) {
    for (const line of fs.readFileSync(CACHE, 'utf8').split('\n')) {
      if (!line) continue;
      try { const o = JSON.parse(line); if (o.h && o.choice) cache.set(o.h, o); } catch { /* 半行 */ }
    }
  }
  return cache;
}

export const startluxBackend = () => BACKEND;
export const startluxStats = () => STATS;
const STATS = {
  decisions: 0, skipSingle: 0, skipGoOut: 0, skipNoKey: 0, skipNoServer: 0,
  eligible: 0, cacheHits: 0, apiCalls: 0, attempts: 0, ok: 0,
  fallback: {}, ms: [], usage: [], agree: 0, disagree: 0, backend: BACKEND, model: MODEL_TAG,
};
export function resetStartluxStats() {
  Object.assign(STATS, {
    decisions: 0, skipSingle: 0, skipGoOut: 0, skipNoKey: 0, skipNoServer: 0,
    eligible: 0, cacheHits: 0, apiCalls: 0, attempts: 0, ok: 0,
    fallback: {}, ms: [], usage: [], agree: 0, disagree: 0, backend: BACKEND, model: MODEL_TAG,
  });
}
const fb = (why) => { STATS.fallback[why] = (STATS.fallback[why] || 0) + 1; };

function takeTicket() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const fd = fs.openSync(TICKETS, 'a');
  try { fs.writeSync(fd, 'x\n'); return fs.fstatSync(fd).size / 2; } finally { fs.closeSync(fd); }
}
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function callStartLux(candidates, raw, meta) {
  const timeoutMs = env('STARTLUX_TIMEOUT_MS', BACKEND === 'bamboo' ? 120000 : 600000);
  const retries = env('STARTLUX_RETRIES', 2);
  const payload = {
    backend: BACKEND,
    candidates: candidates.map((c) => ({ key: c.key, label: c.label, move: c.move })),
    raw,
    url: BACKEND === 'bamboo'
      ? (process.env.STARTLUX_BAMBOO_URL || undefined)
      : (process.env.STARTLUX_URL || 'http://127.0.0.1:8081'),
    timeoutMs,
  };
  const input = JSON.stringify(payload);
  let out = null;
  let attempts = 0;
  const t0 = Date.now();
  for (let a = 0; a <= retries; a++) {
    attempts++;
    STATS.attempts++;
    const p = spawnSync(process.execPath, [CALLER], {
      input, encoding: 'utf8', timeout: timeoutMs + 15000, env: process.env, maxBuffer: 4 << 20,
    });
    if (p.error || p.status !== 0) {
      out = { error: p.error?.code === 'ETIMEDOUT' ? 'timeout' : `child_${p.status}`, errBody: String(p.stderr || '').slice(0, 200) };
    } else {
      try { out = JSON.parse(p.stdout); } catch { out = { error: 'bad_child_output' }; }
    }
    const e = out.error;
    const retryable = e && (
      e === 'timeout'
      || /^child_|fetch failed|ECONN|ENOTFOUND|EAI_AGAIN|socket|network|letters_missing/i.test(e)
      || /^http_(429|5\d\d)$/.test(e)
    );
    if (!retryable || a === retries) break;
    sleepSync(1000 * 2 ** a + Math.floor(Math.random() * 300));
  }
  const ms = Date.now() - t0;
  try {
    fs.mkdirSync(path.dirname(CALL_LOG), { recursive: true });
    fs.appendFileSync(CALL_LOG, JSON.stringify({
      t: new Date().toISOString(), h: meta.h.slice(0, 12), ms, callMs: out.ms ?? null, attempts,
      error: out.error || null, errBody: out.errBody || null, usage: out.usage ?? null,
      nCands: candidates.length, n: meta.n, rel: meta.rel,
      tag: process.env.STARTLUX_TAG || null, model: MODEL_TAG, backend: BACKEND,
    }) + '\n');
  } catch { /* ignore */ }
  return { ...out, ms, attempts };
}

function stateHashPayload(raw, candidates) {
  const stateObj = buildStateEn(raw);
  return { m: MODEL_TAG, backend: BACKEND, state: stateObj, c: candidates.map((c) => c.key) };
}

export function startluxChooseCached(candidates, raw, meta = {}) {
  const maxCalls = env('STARTLUX_MAX_CALLS', BACKEND === 'bamboo' ? 50000 : 5000);
  const h = crypto.createHash('sha1').update(JSON.stringify(stateHashPayload(raw, candidates))).digest('hex');
  const C = loadCache();
  const hit = C.get(h);
  if (hit) { STATS.cacheHits++; return { choice: hit.choice, cached: true, h }; }
  if (process.env.STARTLUX_NO_API === '1') { fb('noApi'); return { error: 'noApi', h }; }
  if (BACKEND === 'bamboo' && !ensureBambooKey()) { fb('noKey'); return { error: 'noKey', h }; }
  if (takeTicket() > maxCalls) { fb('budget'); return { error: 'budget', h }; }
  STATS.apiCalls++;
  const r = callStartLux(candidates, raw, { h, n: meta.n, rel: meta.rel });
  STATS.ms.push(r.ms);
  if (r.usage) STATS.usage.push(r.usage);
  if (r.error) { fb(r.error); return { error: r.error, ms: r.ms, h }; }
  let choice = r.choice;
  if (!choice && r.index >= 0 && r.index < candidates.length) choice = candidates[r.index].key;
  if (!choice) { fb('invalid_choice'); return { error: 'invalid_choice', ms: r.ms, h }; }
  STATS.ok++;
  try {
    fs.appendFileSync(CACHE, JSON.stringify({
      h, choice, confidence: r.confidence ?? null, m: MODEL_TAG, backend: BACKEND, t: Date.now(),
    }) + '\n');
  } catch { /* ignore */ }
  C.set(h, { h, choice });
  return { choice, ms: r.ms, h, confidence: r.confidence };
}

export function makeStartluxAct(decideFn, ctxFor) {
  // ensure key loaded once at agent construction
  if (BACKEND === 'bamboo') ensureBambooKey();
  return (g, seat) => {
    STATS.decisions++;
    const ctx = ctxFor(g, seat);
    const rec = decideFn(ctx);
    const lastPlayer = ctx.leading ? null : g.round.lastPlayer;
    const base = { ...rec, decideMove: rec.move };
    const info = { used: false, nCands: 0, backend: BACKEND };
    base.startlux = info;
    if (rec.move?.cards?.length && rec.move.cards.length === ctx.hand.length) {
      STATS.skipGoOut++; info.skip = 'goOut'; return base;
    }
    const { candidates } = jevPrepare(ctx, rec, lastPlayer);
    info.nCands = candidates.length;
    if (candidates.length < 2) { STATS.skipSingle++; info.skip = 'single'; return base; }
    STATS.eligible++;
    const dKey = moveKey(rec.move);
    info.decideIdx = candidates.findIndex((c) => moveKey(c.move) === dKey);
    info.cands = candidates.map((c) => c.label);
    if (process.env.STARTLUX_FAKE === '1') {
      const hh = crypto.createHash('sha1').update(JSON.stringify({ c: candidates.map((c) => c.key) })).digest('hex');
      const idx = parseInt(hh.slice(0, 6), 16) % candidates.length;
      info.used = true; info.idx = idx; info.choice = candidates[idx].label; info.fake = true;
      if (idx === info.decideIdx) STATS.agree++; else STATS.disagree++;
      return { ...base, move: candidates[idx].move };
    }
    if (BACKEND === 'bamboo' && !process.env.BAMBOO_API_KEY) {
      STATS.skipNoKey++; fb('noKey'); info.error = 'noKey'; return base;
    }
    const raw = {
      hand: ctx.hand,
      seatCounts: ctx.remainingSeatCounts,
      seat,
      levelRank: ctx.levelRank,
      leading: ctx.leading,
      previous: ctx.leading ? null : ctx.previous,
      lastPlayer,
    };
    const r = startluxChooseCached(candidates, raw, {
      n: ctx.hand.length,
      rel: ctx.leading ? 'lead' : lastPlayer === (seat + 2) % 4 ? 'partner' : 'enemy',
    });
    info.h = r.h?.slice?.(0, 12);
    if (r.cached) info.cached = true;
    if (r.ms != null) info.ms = r.ms;
    if (r.error) { info.error = r.error; return base; }
    const idx = candidates.findIndex((c) => c.key === r.choice);
    if (idx < 0) { fb('invalid_choice'); info.error = 'invalid_choice'; return base; }
    info.used = true;
    info.idx = idx;
    info.choice = candidates[idx].label;
    info.confidence = r.confidence ?? null;
    if (idx === info.decideIdx) STATS.agree++; else STATS.disagree++;
    return { ...base, move: candidates[idx].move };
  };
}
