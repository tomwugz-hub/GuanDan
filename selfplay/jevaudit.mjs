#!/usr/bin/env node
/**
 * Jev 接入的体检：Jev 队 vs decide 队（进贡比赛、换座位），擂台 + Jev 调用统计 + 行为对比 + “Jev 与 decide 分歧”MC 判定。
 *   node selfplay/jevaudit.mjs --deals=200 --matchLen=8 --seed0=4000000 --mc=150 --k=48 --out=selfplay/reports/jev-audit.md --ckpt=selfplay/logs/jev-arena-ckpt.jsonl
 * 环境：TYPESAFE_API_KEY（不打印）；JEV_CONCURRENCY（默认 4）；JEV_MAX_CALLS（全局票据上限）；JEV_TAG（调用日志标签）。
 * 价格：Jev 只按输入 token 计费 $0.042 / 1M（docs.typesafe.ai/models），输出免费；API 返回 usage.input_tokens。
 * MC：分歧局面复现（Jev 只读缓存，JEV_NO_API=1），两个着法用同一组确定化各 rollout k 次（后续四家都用 decide）；diff = Jev − decide（级/副，该座位所在队）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { arena, fmtArena } from './arena.mjs';
import { runTasks } from './pool.mjs';
import * as L from './lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, v] = s.replace(/^--/, '').split(/=(.*)/s); return [k, v ?? '1']; }));
const DEALS = Number(args.deals || 20), MLEN = Number(args.matchLen || 8), SEED0 = Number(args.seed0 || 4000000);
const MC = Number(args.mc ?? 0), K = Number(args.k || 48);
const OUT = args.out || path.join(L.ROOT, 'selfplay', 'reports', 'jev-pilot.md');
const PRICE = 0.042 / 1e6;
const t0 = Date.now();
const log = (...a) => console.error(`[jevaudit ${new Date().toTimeString().slice(0, 8)} +${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

log(`arena jev vs current: deals=${DEALS} matchLen=${MLEN} seed0=${SEED0}`);
const r = await arena('jev', 'current', DEALS, SEED0, { tribute: true, matchLen: MLEN, ckpt: args.ckpt || null, collect: true, onDone: (d, n) => log(`tasks ${d}/${n}`) });
const raw = r.raw;
const decisions = raw.flatMap((x) => x.decisions);
const deals = raw.flatMap((x) => x.deals);
const J = r.jev;
const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : 0; };
const tokIn = J.usage.reduce((s, u) => s + (u.input_tokens || 0), 0);
const tokOut = J.usage.reduce((s, u) => s + (u.output_tokens || 0), 0);
const cost = tokIn * PRICE;
const fbTotal = Object.values(J.fallback).reduce((a, b) => a + b, 0);
const nd = r.deals;
const pilot = {
  deals: nd, decisionsJev: J.decisions, eligible: J.eligible, eligiblePerDeal: J.eligible / nd, apiCalls: J.apiCalls, callsPerDeal: J.apiCalls / nd, cacheHits: J.cacheHits, attempts: J.attempts,
  skipSingle: J.skipSingle, skipGoOut: J.skipGoOut, fallback: J.fallback, fallbackRate: fbTotal / (J.eligible || 1),
  latency: { p50: q(J.ms, 0.5), p95: q(J.ms, 0.95), max: q(J.ms, 1), n: J.ms.length }, usageCalls: J.usage.length, tokIn, tokOut, tokInPerCall: tokIn / (J.usage.length || 1),
  costUSD: cost, costPerDeal: cost / nd, est200: (cost / nd) * 200, est1000: (cost / nd) * 1000, agree: J.agree, disagree: J.disagree, violations: r.violations,
};
log('pilot', JSON.stringify(pilot));

// ---------- 行为对比 ----------
const pct = (a, b) => (b ? (100 * a) / b : 0);
const isJ = (d) => d.spec.split('#')[0] === 'jev';
const groups = { Jev: decisions.filter(isJ), decide: decisions.filter((d) => !isJ(d)) };
const rate = (arr, pred) => { const k = arr.filter(pred).length; return { k, n: arr.length, s: `${pct(k, arr.length).toFixed(1)}% (${k}/${arr.length})` }; };
const S10 = (lv) => L.singleStrength('10', lv);
const beh = [];
const row = (title, f) => beh.push([title, f(groups.Jev).s, f(groups.decide).s]);
for (const ph of ['early', 'mid', 'late']) row(`跟敌人过牌率（${ph}，有牌可出）`, (E) => rate(E.filter((x) => x.rel === 'enemy' && x.phase === ph && x.legalNonPass > 0 && x.enemyMin > 0), (x) => x.pass));
for (const ph of ['early', 'mid', 'late']) row(`压对家（${ph}，有牌可压）`, (E) => rate(E.filter((x) => x.rel === 'partner' && x.phase === ph && x.legalNonPass > 0), (x) => !x.pass));
row('炸对家（未走完）', (E) => rate(E.filter((x) => x.rel === 'partner' && x.bombAvail), (x) => x.bomb && x.n > x.size));
row('敌家都 ≥15 张时炸普通牌（占跟牌炸弹）', (E) => rate(E.filter((x) => x.bomb && !x.prevBomb && x.rel !== 'lead'), (x) => x.enemyMin >= 15 && x.n !== x.size));
row('敌家都 ≥10 张时领出炸弹（占炸弹）', (E) => rate(E.filter((x) => x.bomb), (x) => x.rel === 'lead' && x.n > x.size && x.enemyMin >= 10));
row('炸弹用逢人配（占炸弹）', (E) => rate(E.filter((x) => x.bomb), (x) => x.wildUsed > 0));
row('非炸弹着法用逢人配（占出牌）', (E) => rate(E.filter((x) => !x.pass && !x.bomb), (x) => x.wildUsed > 0));
row('敌出牌后 ≤3 张、只能炸却过', (E) => rate(E.filter((x) => x.rel === 'enemy' && x.prevSeatN > 0 && x.prevSeatN <= 3 && x.bombAvail && !x.nonBombAvail), (x) => x.pass));
row('早盘用王/级牌/逢人配出小单对', (E) => rate(E.filter((x) => x.phase === 'early' && !x.pass && (x.type === 'single' || x.type === 'pair') && (x.rel === 'lead' || (x.prevStr != null && x.prevStr <= S10(x.lv)))), (x) => x.ctrlUsed > 0 || x.wildUsed > 0));
row('早盘领出 A/级牌/王的单对', (E) => rate(E.filter((x) => x.rel === 'lead' && x.phase === 'early' && x.n > x.size && (x.type === 'single' || x.type === 'pair')), (x) => x.str >= L.singleStrength('A', x.lv) || x.ctrlUsed > 0));
row('拆炸弹领出', (E) => rate(E.filter((x) => x.rel === 'lead' && x.n > x.size), (x) => x.breaksBomb));
row('拆炸弹跟牌（非炸弹着法）', (E) => rate(E.filter((x) => x.rel !== 'lead' && !x.pass && !x.bomb), (x) => x.breaksBomb));
row('一手能出完却没出完', (E) => rate(E.filter((x) => x.canGoOut), (x) => x.size !== x.n));
for (const t of ['single', 'pair', 'fullhouse', 'straight', 'pairSeq', 'tripleSeq', 'triple']) row(`早盘领出 ${t} 占比`, (E) => rate(E.filter((x) => x.rel === 'lead' && x.phase === 'early' && x.n > x.size), (x) => x.type === t));
row('领出炸弹（中晚盘，非走完）', (E) => rate(E.filter((x) => x.rel === 'lead' && x.phase !== 'early' && x.n > x.size), (x) => x.bomb));
const bombsPer = (E) => (E.filter((x) => x.bomb).length / nd / 2).toFixed(2);
beh.push(['每副每队炸弹数', bombsPer(groups.Jev), bombsPer(groups.decide)]);

// ---------- 一致率 ----------
const jd = groups.Jev.filter((x) => x.jev?.used);
const agreeLines = [];
for (const rel of ['lead', 'enemy', 'partner']) for (const ph of ['early', 'mid', 'late']) {
  const a = jd.filter((x) => x.rel === rel && x.phase === ph);
  if (a.length) agreeLines.push(`${rel}/${ph}：分歧 ${rate(a, (x) => x.jevDisagree).s}`);
}
const idxDist = {};
for (const x of jd) idxDist[x.jev.idx] = (idxDist[x.jev.idx] || 0) + 1;
const catOf = (d) => {
  const dm = d.decideMoveStr, jm = d.moveStr;
  const t = (s) => (s === 'pass' ? 'pass' : s.split(':')[0]);
  const bomb = (s) => /^(bomb|straightFlush)/.test(s);
  const dt = t(dm), jt = t(jm);
  if (d.rel === 'lead') {
    if (bomb(jm) && !bomb(dm)) return 'lead:Jev 领炸';
    if (dt !== jt) return `lead:牌型 ${dt}→${jt}`;
    return 'lead:同型换点';
  }
  if (dt === 'pass') return bomb(jm) ? `${d.rel}:decide 过→Jev 炸` : `${d.rel}:decide 过→Jev 出`;
  if (jt === 'pass') return bomb(dm) ? `${d.rel}:decide 炸→Jev 过` : `${d.rel}:decide 出→Jev 过`;
  if (bomb(jm) !== bomb(dm)) return bomb(jm) ? `${d.rel}:Jev 用炸（decide 普通）` : `${d.rel}:Jev 普通（decide 炸）`;
  return `${d.rel}:都出、换牌`;
};
const dis = jd.filter((x) => x.jevDisagree);
const catCount = {};
for (const d of dis) { const c = catOf(d); catCount[c] = (catCount[c] || 0) + 1; }

// ---------- MC ----------
let mcRes = [];
if (MC > 0 && dis.length) {
  // 抽样：每类按比例，固定种子
  let s = 12345;
  const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
  const pool = dis.slice().sort((a, b) => (a.id < b.id ? -1 : 1)).map((d) => ({ d, k: rnd() })).sort((a, b) => a.k - b.k).slice(0, MC).map((x) => x.d);
  const dealBy = new Map(deals.map((d) => [`${d.cfg}|${d.seed}`, d]));
  const positions = pool.map((d) => {
    const [cfg, seed, step] = d.id.split('|');
    const deal = dealBy.get(`${cfg}|${seed}`);
    return { id: d.id, cfg, seed: Number(seed), step: Number(step), specs: deal.specs, pre: deal.pre, seat: d.seat, hand: d.hand, rel: d.rel, prev: d.prevStr2 };
  });
  process.env.JEV_NO_API = '1';
  const tasks = [];
  for (let i = 0; i < positions.length; i += 4) tasks.push({ kind: 'jevmc', k: K, positions: positions.slice(i, i + 4) });
  log(`MC ${positions.length} disagreements, k=${K}, ${tasks.length} tasks`);
  const mr = await runTasks(tasks, Number(args.mcThreads || 7), (d, n) => { if (d % 5 === 0 || d === n) log(`mc ${d}/${n}`); }, { ckpt: args.mcCkpt || null });
  delete process.env.JEV_NO_API;
  mcRes = mr.flatMap((x) => x.jevmc);
  const byId = new Map(dis.map((d) => [d.id, d]));
  for (const m of mcRes) { const d = byId.get(m.id); if (d) { m.cat = catOf(d); m.phase = d.phase; m.enemyMin = d.enemyMin; m.partnerN = d.partnerN; } }
}
const done = mcRes.filter((m) => !m.skip);
const verdict = (m) => (m.diff >= 0.3 && m.t >= 2 ? 'Jev' : m.diff <= -0.3 && m.t <= -2 ? 'decide' : 'tie');
for (const m of done) m.verdict = verdict(m);

// ---------- 报告 ----------
const L2 = [];
const f3 = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
L2.push(`# Jev 接入体检（${new Date().toLocaleString('zh-CN', { hour12: false })} Asia/Shanghai）`, '');
L2.push(`设置：Jev 队（spec jev = Jev 在 decide 候选里选，decide 兜底）vs decide 队（current），进贡比赛 matchLen=${MLEN}，seed0=${SEED0}，换座位配对。`, '');
L2.push('## 擂台', '', fmtArena(r), '');
L2.push('## Jev 调用', '');
L2.push(`- Jev 座位决策 ${J.decisions}（${(J.decisions / nd).toFixed(1)}/副）：跳过 单候选 ${J.skipSingle}、decide 一手出完 ${J.skipGoOut}；需要 Jev ${J.eligible}（${pilot.eligiblePerDeal.toFixed(1)}/副），缓存命中 ${J.cacheHits}，真实调用 ${J.apiCalls}（${pilot.callsPerDeal.toFixed(1)}/副，尝试 ${J.attempts} 次）`);
L2.push(`- 兜底 ${fbTotal}（${(100 * pilot.fallbackRate).toFixed(2)}%）：${JSON.stringify(J.fallback)}`);
L2.push(`- 延迟（含子进程 ~80ms）：p50 ${pilot.latency.p50}ms，p95 ${pilot.latency.p95}ms，max ${pilot.latency.max}ms（n=${pilot.latency.n}）`);
L2.push(`- 用量（API usage）：输入 ${tokIn} tok（${pilot.tokInPerCall.toFixed(0)}/次），输出 ${tokOut}；费用 = 输入 × $0.042/1M = **$${cost.toFixed(4)}**（$${pilot.costPerDeal.toFixed(5)}/副；外推 200 副 $${pilot.est200.toFixed(3)}，1000 副 $${pilot.est1000.toFixed(3)}，不含缓存命中节省）`);
L2.push(`- Jev 与 decide 一致 ${J.agree}、分歧 ${J.disagree}（分歧率 ${pct(J.disagree, J.agree + J.disagree).toFixed(1)}%）；不变量违例 ${r.violations}`, '');
L2.push('## 行为对比（同一批对局，Jev 座位 vs decide 座位）', '', '| 指标 | Jev | decide |', '|---|---|---|', ...beh.map((x) => `| ${x.join(' | ')} |`), '');
L2.push('## 分歧分布', '', ...agreeLines.map((x) => `- ${x}`), `- Jev 选的候选序号分布：${JSON.stringify(idxDist)}`, '', '| 分歧类别 | 次数 |', '|---|---|', ...Object.entries(catCount).sort((a, b) => b[1] - a[1]).map(([c, n]) => `| ${c} | ${n} |`), '');
if (MC > 0) {
  const sk = mcRes.filter((m) => m.skip);
  L2.push(`## 分歧 MC 判定（抽样 ${mcRes.length}，有效 ${done.length}，跳过 ${sk.length}：${JSON.stringify(sk.reduce((o, m) => ((o[m.skip] = (o[m.skip] || 0) + 1), o), {}))}；k=${K}，同一组确定化，后续全 decide）`, '');
  const md = done.reduce((s, m) => s + m.diff, 0) / (done.length || 1);
  const vc = (v) => done.filter((m) => m.verdict === v).length;
  L2.push(`- 判定（|diff|≥0.3 且 |t|≥2）：Jev 对 ${vc('Jev')}、decide 对 ${vc('decide')}、差不多 ${vc('tie')}；平均 diff（Jev−decide）${f3(md)} 级`, '');
  const cats = {};
  for (const m of done) (cats[m.cat] ||= []).push(m);
  L2.push('| 类别 | n | 平均 diff | Jev 对 | decide 对 | 差不多 |', '|---|---|---|---|---|---|');
  for (const [c, a] of Object.entries(cats).sort((x, y) => y[1].length - x[1].length)) {
    L2.push(`| ${c} | ${a.length} | ${f3(a.reduce((s, m) => s + m.diff, 0) / a.length)} | ${a.filter((m) => m.verdict === 'Jev').length} | ${a.filter((m) => m.verdict === 'decide').length} | ${a.filter((m) => m.verdict === 'tie').length} |`);
  }
  const ex = (m) => `- \`${m.id}\` 座${m.seat} ${m.n}张 ${m.rel}/${m.phase} 张数${m.counts.join('/')} 级${m.lv} 上手=${m.prev} diff **${f3(m.diff)}** (t=${m.t.toFixed(1)})<br>decide: **${m.decideMove}** [${(m.decideTags || []).slice(0, 5).join(',')}] 分 ${m.decideScore?.toFixed?.(0) ?? '-'}；Jev: **${m.jevMove}** [${(m.jevTags || []).slice(0, 5).join(',')}] 分 ${m.jevScore?.toFixed?.(0) ?? '-'}<br>Jev 标签：${m.jevLabel}<br>手牌：${m.hand}`;
  L2.push('', '### decide 明显更好（Jev 的错）', '', ...done.filter((m) => m.verdict === 'decide').sort((a, b) => a.diff - b.diff).slice(0, 12).map(ex));
  L2.push('', '### Jev 明显更好（decide 可能的错）', '', ...done.filter((m) => m.verdict === 'Jev').sort((a, b) => b.diff - a.diff).slice(0, 12).map(ex));
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, L2.join('\n') + '\n');
fs.writeFileSync(OUT.replace(/\.md$/, '.json'), JSON.stringify({ arena: r, pilot, beh, catCount, idxDist, mc: mcRes }, null, 1));
log(`wrote ${OUT}`);
console.log(JSON.stringify({ arena: fmtArena(r), pilot }, null, 1));
