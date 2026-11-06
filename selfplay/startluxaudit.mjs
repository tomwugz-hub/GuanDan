#!/usr/bin/env node
/**
 * StartLux 接入体检：StartLux 队 vs decide 队（进贡比赛、换座位）。
 *   node selfplay/startluxaudit.mjs --deals=20 --matchLen=5 --seed0=7000000 --out=selfplay/reports/startlux-pilot.md
 * 环境：默认 Bamboo 27B（BAMBOO_API_KEY，STARTLUX_BACKEND=bamboo，并发 3）；
 *   STARTLUX_BACKEND=local + STARTLUX_URL 用本地 Instant；STARTLUX_TAG / STARTLUX_MAX_CALLS。
 * 不改 decide；Bamboo 测试期免费。
 */
import fs from 'node:fs';
import path from 'node:path';
import { arena, fmtArena } from './arena.mjs';
import * as L from './lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, v] = s.replace(/^--/, '').split(/=(.*)/s); return [k, v ?? '1']; }));
const DEALS = Number(args.deals || 20), MLEN = Number(args.matchLen || 8), SEED0 = Number(args.seed0 || 7000000);
const OUT = args.out || path.join(L.ROOT, 'selfplay', 'reports', 'startlux-pilot.md');
const t0 = Date.now();
const log = (...a) => console.error(`[startluxaudit ${new Date().toTimeString().slice(0, 8)} +${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

const backend = (process.env.STARTLUX_BACKEND || (process.env.BAMBOO_API_KEY ? 'bamboo' : 'local')).toLowerCase();
log(`arena startlux vs current: deals=${DEALS} matchLen=${MLEN} seed0=${SEED0} backend=${backend} model=${process.env.STARTLUX_MODEL_TAG || (backend === 'bamboo' ? 'startlux-decision-27b-autothink' : 'local-2b')}`);
const r = await arena('startlux', 'current', DEALS, SEED0, {
  tribute: true, matchLen: MLEN, ckpt: args.ckpt || null, collect: true,
  threads: Number(process.env.STARTLUX_CONCURRENCY || (backend === 'bamboo' ? 3 : 1)),
  onDone: (d, n) => log(`tasks ${d}/${n}`),
});
const raw = r.raw;
const decisions = raw.flatMap((x) => x.decisions);
const S = r.startlux;
if (!S) { console.error('no startlux stats'); process.exit(1); }
const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : 0; };
const fbTotal = Object.values(S.fallback).reduce((a, b) => a + b, 0);
const nd = r.deals;
const pilot = {
  deals: nd, decisionsSl: S.decisions, eligible: S.eligible, eligiblePerDeal: S.eligible / nd,
  apiCalls: S.apiCalls, callsPerDeal: S.apiCalls / nd, cacheHits: S.cacheHits, attempts: S.attempts,
  skipSingle: S.skipSingle, skipGoOut: S.skipGoOut, fallback: S.fallback, fallbackRate: fbTotal / (S.eligible || 1),
  latency: { p50: q(S.ms, 0.5), p95: q(S.ms, 0.95), max: q(S.ms, 1), n: S.ms.length },
  agree: S.agree, disagree: S.disagree, violations: r.violations,
  wallSec: (Date.now() - t0) / 1000,
};
log('pilot', JSON.stringify(pilot));

const pct = (a, b) => (b ? (100 * a) / b : 0);
const isSl = (d) => d.spec.split('#')[0] === 'startlux';
const groups = { StartLux: decisions.filter(isSl), decide: decisions.filter((d) => !isSl(d)) };
const rate = (arr, pred) => { const k = arr.filter(pred).length; return { k, n: arr.length, s: `${pct(k, arr.length).toFixed(1)}% (${k}/${arr.length})` }; };
const beh = [];
const row = (title, f) => beh.push([title, f(groups.StartLux).s, f(groups.decide).s]);
for (const ph of ['early', 'mid', 'late']) row(`跟敌人过牌率（${ph}，有牌可出）`, (E) => rate(E.filter((x) => x.rel === 'enemy' && x.phase === ph && x.legalNonPass > 0 && x.enemyMin > 0), (x) => x.pass));
row('拆炸弹领出', (E) => rate(E.filter((x) => x.rel === 'lead' && x.n > x.size), (x) => x.breaksBomb));
row('一手能出完却没出完', (E) => rate(E.filter((x) => x.canGoOut), (x) => x.size !== x.n));
for (const t of ['single', 'pair', 'fullhouse', 'straight', 'pairSeq', 'tripleSeq', 'triple']) {
  row(`早盘领出 ${t} 占比`, (E) => rate(E.filter((x) => x.rel === 'lead' && x.phase === 'early' && x.n > x.size), (x) => x.type === t));
}

const jd = groups.StartLux.filter((x) => x.startlux?.used);
const agreeLines = [];
for (const rel of ['lead', 'enemy', 'partner']) for (const ph of ['early', 'mid', 'late']) {
  const a = jd.filter((x) => x.rel === rel && x.phase === ph);
  if (a.length) agreeLines.push(`${rel}/${ph}：分歧 ${rate(a, (x) => x.startluxDisagree).s}`);
}

const L2 = [];
L2.push(`# StartLux 接入体检（${new Date().toLocaleString('zh-CN', { hour12: false })} Asia/Shanghai）`, '');
L2.push(`设置：StartLux 队（spec startlux = ${S.backend || backend} / ${S.model || '?'} 在 decide 候选里选，decide 兜底）vs decide 队（current），进贡比赛 matchLen=${MLEN}，seed0=${SEED0}，换座位配对。`, '');
L2.push('## 擂台', '', fmtArena(r), '');
L2.push('## StartLux 调用', '');
L2.push(`- StartLux 座位决策 ${S.decisions}（${(S.decisions / nd).toFixed(1)}/副）：跳过 单候选 ${S.skipSingle}、decide 一手出完 ${S.skipGoOut}；需要调用 ${S.eligible}（${pilot.eligiblePerDeal.toFixed(1)}/副），缓存命中 ${S.cacheHits}，真实调用 ${S.apiCalls}（${pilot.callsPerDeal.toFixed(1)}/副，尝试 ${S.attempts} 次）`);
L2.push(`- 兜底 ${fbTotal}（${(100 * pilot.fallbackRate).toFixed(2)}%）：${JSON.stringify(S.fallback)}`);
L2.push(`- 延迟（含 spawn 子进程）：p50 ${pilot.latency.p50}ms，p95 ${pilot.latency.p95}ms，max ${pilot.latency.max}ms（n=${pilot.latency.n}）`);
L2.push(`- 后端 ${S.backend || backend}，模型 ${S.model || '?'}；费用应 $0（Bamboo 测试期 free；usage 条数 ${ (S.usage || []).length }）`);
L2.push(`- 与 decide 一致 ${S.agree}、分歧 ${S.disagree}（分歧率 ${pct(S.disagree, S.agree + S.disagree).toFixed(1)}%）；不变量违例 ${r.violations}`);
L2.push(`- 墙钟 ${pilot.wallSec.toFixed(0)}s（${(pilot.wallSec / nd).toFixed(1)}s/副）；外推 1000 副 ≈ ${(pilot.wallSec / nd * 1000 / 3600).toFixed(1)}h`, '');
L2.push('## 行为对比（StartLux 座位 vs decide 座位）', '', '| 指标 | StartLux | decide |', '|---|---|---|', ...beh.map((x) => `| ${x.join(' | ')} |`), '');
L2.push('## 分歧分布', '', ...agreeLines.map((x) => `- ${x}`), '');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, L2.join('\n') + '\n');
fs.writeFileSync(OUT.replace(/\.md$/, '.json'), JSON.stringify({ arena: { ...r, raw: undefined }, pilot, beh }, null, 1));
log(`wrote ${OUT}`);
console.log(JSON.stringify({ arena: fmtArena(r), pilot }, null, 1));
