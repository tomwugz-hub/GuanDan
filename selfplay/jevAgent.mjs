/**
 * 自对局 Jev 代理（spec 'jev'，可加 '#ret=..' 等选项，见 lib.makeAgent）。
 * 与 play/jevbridge.mjs 同一套候选/状态（decide 硬过滤 + 60 分以内 top-K，buildJevState），但用真实牌对象、同步调用：
 *   每次 API 调用 spawnSync 一个 selfplay/jevcall.mjs 子进程（自对局循环是同步的），所以“并发上限 = 用 jev 的 worker 数”（pool 按 JEV_CONCURRENCY 限制）。
 * 规则：
 *   - 候选 <2、decide 首选一手出完 → 不调用（skipSingle / skipGoOut），直接用 decide。
 *   - 缓存：状态哈希（sha1(模型+提示词版本+state+候选键/标签)；r9 起含提示词版本 JEV_PROMPT_VERSION）→ 选择，持久化 selfplay/cache/jev-cache.jsonl（各进程追加写、启动时读入）。
 *   - 重试/退避：timeout / 网络错误 / http 429 / 5xx 最多 JEV_RETRIES 次（默认 2），退避 1s、2s、4s（+抖动）；其它错误（401、invalid_choice）不重试。
 *   - 失败 → decide 兜底（按原因计数）。
 *   - 预算：全局调用票据文件 selfplay/cache/jev-tickets（每次真实调用前追加 2 字节，文件大小/2 = 全局调用数）；超过 JEV_MAX_CALLS → 兜底（budget）。
 *   - 每次真实调用记一行 selfplay/logs/jev-calls.jsonl（时间、哈希、延迟、尝试次数、错误、usage）。
 * 返回 rec：{ move, jev: { used, choice, idx, decideIdx, nCands, cands:[label], cached, error, ms }, decideMove, scored, tags }。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { formatCard } from '../engine/cards.js';
import { labelCombo } from '../policy/index.js';
import { buildJevState } from '../policy/jevState.js';
import { buildJevCandidates, moveKey } from '../policy/jevCandidates.js';
import { JEV_MODEL, JEV_PROMPT_VERSION } from '../policy/jevScore.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(HERE, 'cache');
const CACHE = process.env.JEV_CACHE || path.join(CACHE_DIR, 'jev-cache.jsonl');
const TICKETS = process.env.JEV_TICKETS || path.join(CACHE_DIR, 'jev-tickets');
const CALL_LOG = process.env.JEV_CALL_LOG || path.join(HERE, 'logs', 'jev-calls.jsonl');
const CALLER = path.join(HERE, 'jevcall.mjs');
const env = (k, d) => (process.env[k] != null && process.env[k] !== '' ? Number(process.env[k]) : d);

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

export const jevStats = () => STATS;
const STATS = { decisions: 0, skipSingle: 0, skipGoOut: 0, skipNoKey: 0, eligible: 0, cacheHits: 0, apiCalls: 0, attempts: 0, ok: 0, fallback: {}, ms: [], usage: [], agree: 0, disagree: 0 };
export function resetJevStats() {
  Object.assign(STATS, { decisions: 0, skipSingle: 0, skipGoOut: 0, skipNoKey: 0, eligible: 0, cacheHits: 0, apiCalls: 0, attempts: 0, ok: 0, fallback: {}, ms: [], usage: [], agree: 0, disagree: 0 });
}
const fb = (why) => { STATS.fallback[why] = (STATS.fallback[why] || 0) + 1; };

function takeTicket() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const fd = fs.openSync(TICKETS, 'a');
  try { fs.writeSync(fd, 'x\n'); return fs.fstatSync(fd).size / 2; } finally { fs.closeSync(fd); }
}
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function callJev(candidates, state, meta) {
  const timeoutMs = env('JEV_TIMEOUT_MS', 25000);
  const retries = env('JEV_RETRIES', 2);
  const input = JSON.stringify({ candidates: candidates.map((c) => ({ key: c.key, label: c.label })), state, timeoutMs });
  let out = null;
  let attempts = 0;
  const t0 = Date.now();
  for (let a = 0; a <= retries; a++) {
    attempts++;
    STATS.attempts++;
    const p = spawnSync(process.execPath, [CALLER], { input, encoding: 'utf8', timeout: timeoutMs + 5000, env: process.env, maxBuffer: 1 << 20 });
    if (p.error || p.status !== 0) out = { error: p.error?.code === 'ETIMEDOUT' ? 'timeout' : `child_${p.status}`, errBody: String(p.stderr || '').slice(0, 200) };
    else { try { out = JSON.parse(p.stdout); } catch { out = { error: 'bad_child_output' }; } }
    const e = out.error;
    const retryable = e && (e === 'timeout' || /^child_|fetch failed|ECONN|ENOTFOUND|EAI_AGAIN|socket|network/i.test(e) || /^http_(429|5\d\d)$/.test(e));
    if (!retryable || a === retries) break;
    sleepSync(1000 * 2 ** a + Math.floor(Math.random() * 300));
  }
  const ms = Date.now() - t0;
  try {
    fs.mkdirSync(path.dirname(CALL_LOG), { recursive: true });
    fs.appendFileSync(CALL_LOG, JSON.stringify({ t: new Date().toISOString(), h: meta.h.slice(0, 12), ms, callMs: out.ms ?? null, attempts, error: out.error || null, errBody: out.errBody || null, usage: out.usage ?? null, cost: out.cost ?? null, nCands: candidates.length, n: meta.n, rel: meta.rel, tag: process.env.JEV_TAG || null }) + '\n');
  } catch { /* ignore */ }
  return { ...out, ms, attempts };
}

function comboSummary(combo, cardList) {
  if (!combo || combo.type === 'pass') return '过牌';
  const cs = (cardList || []).map(formatCard).join(' ');
  return cs ? `${labelCombo(combo)} [${cs}]` : labelCombo(combo);
}

/** 与 jevbridge.jevPick 相同的候选与状态（真实牌对象）。 */
export function jevPrepare(ctx, rec, lastPlayer) {
  const { hand, seat, levelRank, leading } = ctx;
  const previous = leading ? null : ctx.previous;
  const seatCounts = ctx.remainingSeatCounts;
  const candidates = buildJevCandidates(rec, {
    hand, previous, levelRank, leading, seatCounts, seat, K: 8, preferPassForPartner: false,
    lastPlaySeat: lastPlayer, persona: null, labelFn: (combo, cl) => comboSummary(combo, cl),
  });
  for (const cand of candidates) {
    if (cand.move?.cards?.length === hand.length && !cand.label.includes('[走完]')) cand.label += ' [走完]';
  }
  const partnerSeat = (seat + 2) % 4;
  const toBeatIsPartner = !leading && lastPlayer === partnerSeat;
  const state = candidates.length >= 2 ? buildJevState({
    seat, hand, levelRank, leading, previous, persona: null, seatCounts, candidates,
    controlSeat: leading ? seat : lastPlayer,
    partnerLastPlay: ctx.partnerCombo ? { type: ctx.partnerCombo.type, rank: ctx.partnerCombo.rank ?? null } : null,
    lastPlayer: leading ? null : lastPlayer, toBeatIsPartner, preferPassForPartner: false,
  }) : null;
  return { candidates, state };
}

/**
 * 带缓存/票据/重试的一次 Jev 选择（r9：供 makeJevAct 与离线重放 selfplay/diag/r9-jevreplay.mjs 共用）。
 * 返回 { choice, cached, error, ms, h }。
 */
export function jevChooseCached(candidates, state, meta = {}) {
  const maxCalls = env('JEV_MAX_CALLS', 5000);
  const h = crypto.createHash('sha1').update(JSON.stringify({ m: JEV_MODEL, v: JEV_PROMPT_VERSION, state, c: candidates.map((c) => [c.key, c.label]) })).digest('hex');
  const C = loadCache();
  const hit = C.get(h);
  if (hit) { STATS.cacheHits++; return { choice: hit.choice, cached: true, h }; }
  if (process.env.JEV_NO_API === '1') { fb('noApi'); return { error: 'noApi', h }; }
  if (takeTicket() > maxCalls) { fb('budget'); return { error: 'budget', h }; }
  STATS.apiCalls++;
  const r = callJev(candidates, state, { h, n: meta.n, rel: meta.rel });
  STATS.ms.push(r.ms);
  if (r.usage) STATS.usage.push(r.usage);
  if (r.error) { fb(r.error); return { error: r.error, ms: r.ms, h }; }
  STATS.ok++;
  try { fs.appendFileSync(CACHE, JSON.stringify({ h, choice: r.choice, confidence: r.confidence ?? null, v: JEV_PROMPT_VERSION, m: JEV_MODEL, t: Date.now() }) + '\n'); } catch { /* ignore */ }
  C.set(h, { h, choice: r.choice });
  return { choice: r.choice, ms: r.ms, h };
}

export function makeJevAct(decideFn, ctxFor) {
  const apiKey = !!(process.env.TYPESAFE_API_KEY || process.env.TYPESAFE_API_KEY_NEW);
  return (g, seat) => {
    STATS.decisions++;
    const ctx = ctxFor(g, seat);
    const rec = decideFn(ctx);
    const lastPlayer = ctx.leading ? null : g.round.lastPlayer;
    const base = { ...rec, decideMove: rec.move };
    const info = { used: false, nCands: 0 };
    base.jev = info;
    if (rec.move?.cards?.length && rec.move.cards.length === ctx.hand.length) { STATS.skipGoOut++; info.skip = 'goOut'; return base; }
    const { candidates, state } = jevPrepare(ctx, rec, lastPlayer);
    info.nCands = candidates.length;
    if (candidates.length < 2) { STATS.skipSingle++; info.skip = 'single'; return base; }
    STATS.eligible++;
    const dKey = moveKey(rec.move);
    info.decideIdx = candidates.findIndex((c) => moveKey(c.move) === dKey);
    info.cands = candidates.map((c) => c.label);
    if (process.env.JEV_FAKE === '1') {
      // 测试用：按哈希伪随机选（不发请求、不写缓存）
      const hh = crypto.createHash('sha1').update(JSON.stringify({ state, c: candidates.map((c) => c.label) })).digest('hex');
      const idx = parseInt(hh.slice(0, 6), 16) % candidates.length;
      info.used = true; info.idx = idx; info.choice = candidates[idx].label; info.fake = true;
      if (idx === info.decideIdx) STATS.agree++; else STATS.disagree++;
      return { ...base, move: candidates[idx].move };
    }
    if (!apiKey) { STATS.skipNoKey++; fb('noKey'); info.error = 'noKey'; return base; }
    const r = jevChooseCached(candidates, state, { n: ctx.hand.length, rel: ctx.leading ? 'lead' : lastPlayer === (seat + 2) % 4 ? 'partner' : 'enemy' });
    info.h = r.h.slice(0, 12);
    if (r.cached) info.cached = true;
    if (r.ms != null) info.ms = r.ms;
    if (r.error) { info.error = r.error; return base; }
    const choice = r.choice;
    const idx = candidates.findIndex((c) => c.key === choice);
    if (idx < 0) { fb('invalid_choice'); info.error = 'invalid_choice'; return base; }
    info.used = true;
    info.idx = idx;
    info.choice = candidates[idx].label;
    if (idx === info.decideIdx) STATS.agree++; else STATS.disagree++;
    return { ...base, move: candidates[idx].move };
  };
}
