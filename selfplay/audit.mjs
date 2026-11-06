#!/usr/bin/env node
/**
 * 自对局体检：大量整副自对局（与网页版同一套 play/core.js 逻辑）+ 混合对手，统计行为、检查不变量、
 * 用异常检测器（主流掼蛋的合理区间）报红旗，并用确定化 Monte Carlo rollout 找“意外”决策。
 *
 *   npm run audit                      # 默认 1000 副自对局 + 混合对手 + 210 个 surprise 局面
 *   node selfplay/audit.mjs --deals=300 --mixed=100 --surprise=60     # 快速版
 *   node selfplay/audit.mjs --replay='self|123|45'                    # 复现某个局面（打印快照与 decide 排序）
 *   --tribute [--matchLen=8]：进贡比赛模式（每 matchLen 副一场，名次/级数/进贡带到下一副；局面 id 的 seed 是牌种子 = 比赛种子×16+第几副，
 *   复现时同样加 --tribute，会先重打这场比赛的前几副）。--ckpt=<jsonl> 检查点续跑。
 * 报告：selfplay/reports/audit-latest.md（+ 同名 .json，下一次运行会对比上一次）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { runTasks, dealTasks, pairedStats } from './pool.mjs';
import * as L from './lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, v] = s.replace(/^--/, '').split(/=(.*)/s); return [k, v ?? '1']; }));
const DEALS = Number(args.deals ?? 1000);
const MIXED = Number(args.mixed ?? 200);
const SURPRISE = Number(args.surprise ?? 210);
const VERSION = args.version || 'current';
const OLD = (args.old ?? 'pre-activity,pre-round6').split(',').filter(Boolean);
const SEED0 = Number(args.seed0 ?? 1);
const OUT = args.out || path.join(L.ROOT, 'selfplay', 'reports', 'audit-latest.md');
const D = VERSION === 'current' ? 'decide' : `decide@${VERSION}`;
const TRIB = args.tribute != null && args.tribute !== '0';
const MLEN = Number(args.matchLen || 8);

/** cfg 名 → 四个座位的代理。 */
function specsFor(cfg) {
  if (cfg === 'self') return [D, D, D, D];
  const m = cfg.match(/^vs(.+?)([01])$/);
  if (!m) throw new Error(`bad cfg ${cfg}`);
  const opp = m[1] === 'Random' ? 'random' : m[1] === 'Greedy' ? 'greedy' : `decide@${m[1].replace(/^Old:/, '')}`;
  return m[2] === '0' ? [D, opp, D, opp] : [opp, D, opp, D];
}

// ---------- 复现 ----------
if (args.replay) {
  const [cfg, seed, step] = args.replay.split('|');
  const specs = specsFor(cfg);
  const agents = [];
  for (let s = 0; s < 4; s++) agents.push(await L.makeAgent(specs[s], Number(seed) * 4 + s));
  let pre = null;
  if (TRIB) {
    const ms = Math.floor(Number(seed) / 16), idx = Number(seed) % 16;
    const ds = L.playMatch(ms, agents, { deals: idx + 1 });
    pre = ds[idx]?.pre;
    if (!pre) throw new Error('match ended before this deal');
  }
  const st = L.playDeal(Number(seed), agents, { stopAt: Number(step), pre });
  const g = st.g;
  if (pre) console.log('pre', JSON.stringify(pre), 'tribute', JSON.stringify(st.tribute));
  const seat = g.round.currentSeat;
  console.log(JSON.stringify({ id: args.replay, specs, ...L.snapshot(g, seat) }, null, 1));
  const dec = await L.loadDecide(VERSION);
  const rec = dec(L.ctxFor(g, seat));
  console.log('decide →', rec.move.cards.length ? `${rec.move.combo.type}:${rec.move.combo.rank} ${rec.move.cards.map(L.formatCard).join(' ')}` : 'pass', rec.tags);
  for (const s of (rec.scored || []).slice(0, 8)) console.log('  ', s.score.toFixed(1), s.move.cards.length ? `${s.move.combo.type}:${s.move.cards.map(L.formatCard).join('')}` : 'pass', s.tags.join(','));
  process.exit(0);
}

const t0 = Date.now();
const log = (...a) => console.error(`[audit ${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

// ---------- 1. 对局 ----------
const jobs = [];
const M = TRIB ? { match: MLEN } : {};
const per = (n) => (TRIB ? Math.ceil(n / MLEN) : n);
for (let i = 0; i < per(DEALS); i++) jobs.push({ cfg: 'self', seed: SEED0 + i, specs: specsFor('self'), ...M });
const mixedCfgs = ['Random', 'Greedy', ...OLD.map((o) => `Old:${o}`)];
for (const o of [...OLD, VERSION]) if (o !== 'current') await L.loadDecide(o);
for (const o of mixedCfgs) for (let i = 0; i < per(MIXED); i++) for (const side of [0, 1]) {
  const cfg = `vs${o}${side}`;
  jobs.push({ cfg, seed: 200000 + SEED0 + i, specs: specsFor(cfg), collect: true, ...M });
}
log(`deals: self ${DEALS}, mixed ${mixedCfgs.length}×${MIXED}×2${TRIB ? `（进贡比赛，每场 ${MLEN} 副）` : ''}`);
const res = await runTasks(dealTasks(jobs, { collect: true, chunk: TRIB ? 3 : 20 }), undefined, (d, n) => { if (d % 10 === 0 || d === n) log(`deal tasks ${d}/${n}`); }, { ckpt: args.ckpt || null });
const decisions = res.flatMap((r) => r.decisions);
const deals = res.flatMap((r) => r.deals);
const violations = res.flatMap((r) => r.violations);
const selfDec = decisions.filter((r) => r.cfg === 'self');
const decideDec = decisions.filter((r) => r.spec.startsWith('decide') && (r.cfg === 'self' || r.spec === D));
log(`decisions ${decisions.length} (self ${selfDec.length}), violations ${violations.length}`);

// ---------- 2. 统计工具 ----------
const pct = (a, b) => (b ? (100 * a) / b : 0);
const fmtR = (a, b) => `${a}/${b} (${pct(a, b).toFixed(0)}%)`;
const rate = (arr, pred) => {
  const hit = arr.filter(pred);
  return { k: hit.length, n: arr.length, v: arr.length ? hit.length / arr.length : 0, hit };
};
const S10 = (lv) => L.singleStrength('10', lv);
const isSmall = (r) => (r.prevType === 'single' || r.prevType === 'pair') && r.prevStr != null && r.prevStr <= S10(r.lv) && r.prevRank !== r.lv;
const exampleOf = (r) => `\`${r.id}\` 座${r.seat} ${r.n}张 敌最少${r.enemyMin} 对家${r.partnerN} 级${r.lv} 上手=${r.prevStr2} → **${r.moveStr}**${r.tags ? ` [${r.tags.join(',')}]` : ''}<br>手牌: ${r.hand}`;
const pick = (arr, k = 5) => {
  const out = [];
  const step = Math.max(1, Math.floor(arr.length / k));
  for (let i = 0; i < arr.length && out.length < k; i += step) out.push(arr[i]);
  return out;
};

// 按副分组（顺序）
const byDeal = new Map();
for (const r of selfDec) {
  const k = `${r.cfg}|${r.id.split('|')[1]}`;
  if (!byDeal.has(k)) byDeal.set(k, []);
  byDeal.get(k).push(r);
}
for (const v of byDeal.values()) v.sort((a, b) => a.step - b.step);

// 小单/小对领出后敌家是否跟
function leadFollow(kind) {
  const out = [];
  for (const seq of byDeal.values()) {
    for (let i = 0; i < seq.length; i++) {
      const r = seq[i];
      if (r.rel !== 'lead' || r.type !== kind || r.n < 10 || r.enemyMin < 6) continue;
      if (!(r.str <= S10(r.lv) && r.rank !== r.lv)) continue;
      const L0 = r.seat;
      let e1 = null, e2 = null, partnerOver = false, cap = false;
      for (let j = i + 1; j < seq.length; j++) {
        const q = seq[j];
        if (q.rel === 'lead') break;
        if (q.seat === (L0 + 1) % 4 && !e1) e1 = q;
        else if (q.seat === (L0 + 2) % 4 && !partnerOver && !q.pass) partnerOver = true;
        else if (q.seat === (L0 + 3) % 4 && !e2) { e2 = q; break; }
        if (e1 && !e1.pass) break;
      }
      if (!e1) continue;
      if (e1.pass && partnerOver) continue;
      const followed = !e1.pass || (e2 && !e2.pass);
      cap = (e1.nonBombAvail) || (e2 && e2.nonBombAvail);
      out.push({ lead: r, followed, cap, e1, e2 });
    }
  }
  return out;
}

// ---------- 3. 检测器 ----------
const flags = [];
const metrics = {};
function detector({ id, title, impact = 2, value, n, lo = null, hi = null, examples = [], detail = '', minN = 30, unit = '%' }) {
  const v = unit === '%' ? value * 100 : value;
  let sev = 0;
  if (n >= minN) {
    if (hi != null && v > hi) sev = impact * Math.min(5, (v - hi) / Math.max(Math.abs(hi), 5)) * Math.log10(10 + n);
    if (lo != null && v < lo) sev = impact * Math.min(5, (lo - v) / Math.max(Math.abs(lo), 5)) * Math.log10(10 + n);
  }
  const d = { id, title, impact, value: v, n, lo, hi, unit, red: sev > 0, severity: sev, examples: examples.map(exampleOf), detail };
  metrics[id] = { value: v, n };
  flags.push(d);
  return d;
}

const E = selfDec;
// 3.1 跟敌人：小单/小对没人跟
for (const kind of ['single', 'pair']) {
  const lf = leadFollow(kind);
  const nf = lf.filter((x) => !x.followed);
  detector({ id: `noEnemyFollow_${kind}`, title: `早中盘领出小${kind === 'single' ? '单' : '对'}（≤10）后两个敌家都不跟`, impact: 3, value: nf.length / (lf.length || 1), n: lf.length, hi: kind === 'single' ? 25 : 35,
    examples: pick(nf.map((x) => x.e1)), detail: `其中至少一个敌家有非炸弹可跟：${fmtR(nf.filter((x) => x.cap).length, nf.length)}` });
}
// 3.2 跟敌人过牌率（分阶段）
const ranges = { early: [30, 62], mid: [30, 65], late: [20, 75] };
for (const ph of ['early', 'mid', 'late']) {
  const arr = E.filter((r) => r.rel === 'enemy' && r.phase === ph && r.legalNonPass > 0 && r.enemyMin > 0);
  const x = rate(arr, (r) => r.pass);
  detector({ id: `enemyPass_${ph}`, title: `跟敌人牌过牌率（${ph}，有牌可出时）`, impact: 2, value: x.v, n: x.n, lo: ranges[ph][0], hi: ranges[ph][1], examples: pick(x.hit.filter((r) => r.nonBombAvail)) });
}
{
  const arr = E.filter((r) => r.rel === 'enemy' && r.n >= 10 && r.enemyMin >= 6 && isSmall(r) && r.nonBombAvail);
  const x = rate(arr, (r) => r.pass);
  const perSeat = [0, 1, 2, 3].map((s) => { const a = arr.filter((r) => r.seat === s); return fmtR(a.filter((r) => r.pass).length, a.length); }).join(' / ');
  detector({ id: 'smallEnemyPass', title: '早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率', impact: 3, value: x.v, n: x.n, hi: 35, examples: pick(x.hit), detail: `按座位 南/东/北/西：${perSeat}` });
}
// 3.3 对家
for (const ph of ['early', 'mid', 'late']) {
  const arr = E.filter((r) => r.rel === 'partner' && r.phase === ph && r.legalNonPass > 0);
  const x = rate(arr, (r) => !r.pass);
  detector({ id: `partnerOvertake_${ph}`, title: `压对家的牌（${ph}，有牌可压时）`, impact: 2, value: x.v, n: x.n, hi: ph === 'late' ? 30 : 15, examples: pick(x.hit) });
}
{
  const arr = E.filter((r) => r.rel === 'partner' && r.bombAvail);
  const x = rate(arr, (r) => r.bomb && r.n > r.size);
  detector({ id: 'bombPartner', title: '炸对家（未因此走完）', impact: 3, value: x.v, n: x.n, hi: 2, examples: pick(x.hit) });
}
{
  // 对家出小牌、下家（敌）快走完：我过牌让敌家轻松跟。
  // r8：只计“有不拆炸弹的非炸弹着法能压”的局面（原口径 nonBombAvail 含拆炸，r7 的 73.5% 多为只能拆炸/用炸）。
  const base = E.filter((r) => r.rel === 'partner' && (r.prevType === 'single' || r.prevType === 'pair') && r.prevStr <= L.singleStrength('8', r.lv) && r.nextEnemyN > 0 && r.nextEnemyN <= 3 && r.partnerN >= 4);
  const old = rate(base.filter((r) => r.nonBombAvail), (r) => r.pass);
  const arr = base.filter((r) => r.nonBombCleanAvail ?? r.nonBombAvail);
  const x = rate(arr, (r) => r.pass);
  const ns = rate(arr.filter((r) => r.nonBombNoStructAvail), (r) => r.pass);
  const tri = rate(arr.filter((r) => r.nonBombNoStructAvail === false), (r) => r.pass);
  const exOf = (r) => ({ ...r, tags: [...(r.tags || []), r.cleanEx ? `可压:${r.cleanEx}` : ''].filter(Boolean) });
  detector({ id: 'partnerTinyEnemyShort', title: '对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌', impact: 2, value: x.v, n: x.n, hi: 60, minN: 15, examples: pick(x.hit).map(exOf),
    detail: `旧口径（含拆炸/只有炸弹可压）：${fmtR(old.k, old.n)}；其中不拆三张也能压：${fmtR(ns.k, ns.n)}；只能拆三张才能压：${fmtR(tri.k, tri.n)}` });
  metrics.partnerTinyEnemyShort_old = { value: old.v * 100, n: old.n };
  metrics.partnerTinyEnemyShort_noStruct = { value: ns.v * 100, n: ns.n };
}
// 3.4 炸弹
{
  const bombs = E.filter((r) => r.bomb);
  const per = (ph) => (bombs.filter((r) => r.phase === ph).length / DEALS).toFixed(2);
  const early = rate(bombs.filter((r) => !r.prevBomb && r.rel !== 'lead'), (r) => r.enemyMin >= 15 && !(r.n === r.size));
  detector({ id: 'bombEarlyOrdinary', title: '敌家都 ≥15 张时炸普通牌（占跟牌炸弹）', impact: 2, value: early.v, n: early.n, hi: 15, examples: pick(early.hit), detail: `每副炸弹数（自对局，四人合计）：早 ${per('early')} / 中 ${per('mid')} / 晚 ${per('late')}` });
  const bob = rate(bombs.filter((r) => r.rel !== 'lead'), (r) => r.prevBomb);
  metrics.bombOnBomb = { value: bob.v * 100, n: bob.n };
  const leadBomb = rate(bombs, (r) => r.rel === 'lead' && r.n > r.size && r.enemyMin >= 10);
  detector({ id: 'bombLeadEarly', title: '敌家都 ≥10 张时领出炸弹（非走完）', impact: 1, value: leadBomb.v, n: leadBomb.n, hi: 10, examples: pick(leadBomb.hit), detail: `炸压炸占跟牌炸弹：${fmtR(bob.k, bob.n)}` });
}
{
  const arr = E.filter((r) => r.rel === 'enemy' && r.prevSeatN > 0 && r.prevSeatN <= 3 && r.bombAvail && !r.nonBombAvail);
  const x = rate(arr, (r) => r.pass);
  detector({ id: 'noBombEnemyOut', title: '敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌', impact: 3, value: x.v, n: x.n, hi: 45, minN: 20, examples: pick(x.hit) });
}
{
  const selfDeals = deals.filter((d) => d.cfg === 'self');
  let wasted = 0, nLose = 0, ctrlEnd = 0;
  const ex = [];
  for (const d of selfDeals) {
    const winT = d.order[0] % 2;
    for (let s = 0; s < 4; s++) {
      if (s % 2 === winT) continue;
      nLose++;
      const h = d.endHands[s];
      if (h.bomb) { wasted++; if (ex.length < 5) ex.push(`\`self|${d.seed}\` 座${s} 结束时手里：${h.hand}`); }
      if (h.ctrl >= 2) ctrlEnd++;
    }
  }
  const f = detector({ id: 'wastedBombs', title: '输家结束时手里还留着炸弹（每个输家座位）', impact: 2, value: wasted / (nLose || 1), n: nLose, hi: 20 });
  f.examples = ex;
  detector({ id: 'ctrlHeldEnd', title: '输家结束时还握着 ≥2 张王/级牌', impact: 1, value: ctrlEnd / (nLose || 1), n: nLose, hi: 25 });
  // 卡手：末游剩很多张
  const last = selfDeals.map((d) => d.endHands[d.order[3]]).filter(Boolean);
  const stuck = last.filter((h) => h.n >= 8 && h.minPlays >= 5);
  detector({ id: 'stuckLast', title: '末游卡手（结束时 ≥8 张且至少还要 5 手）', impact: 1, value: stuck.length / (last.length || 1), n: last.length, hi: 25 });
}
// 3.5 控制牌
{
  const arr = E.filter((r) => r.phase === 'early' && !r.pass && (r.type === 'single' || r.type === 'pair') && (r.rel === 'lead' || (r.prevStr != null && r.prevStr <= S10(r.lv))));
  const x = rate(arr, (r) => r.ctrlUsed > 0 || r.wildUsed > 0);
  detector({ id: 'ctrlEarlySmall', title: '早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10）', impact: 2, value: x.v, n: x.n, hi: 8, examples: pick(x.hit) });
}
// 3.6 领出
{
  const leads = E.filter((r) => r.rel === 'lead');
  const early = leads.filter((r) => r.phase === 'early' && r.n > r.size);
  const big = rate(early.filter((r) => r.type === 'single' || r.type === 'pair'), (r) => r.str >= L.singleStrength('A', r.lv) || r.ctrlUsed > 0);
  detector({ id: 'bigLeadEarly', title: '早盘领出 A/级牌/王的单对', impact: 2, value: big.v, n: big.n, hi: 12, examples: pick(big.hit) });
  const brk = rate(leads.filter((r) => r.n > r.size), (r) => r.breaksBomb);
  detector({ id: 'leadBreakBomb', title: '拆炸弹领出', impact: 3, value: brk.v, n: brk.n, hi: 2, examples: pick(brk.hit) });
  const sp = rate(early.filter((r) => r.type === 'single' && r.structAvail), (r) => r.breaksPair);
  detector({ id: 'leadSingleBreakPair', title: '早盘拆对领单（手里有顺子/连对/钢板可出）', impact: 1, value: sp.v, n: sp.n, hi: 15, examples: pick(sp.hit) });
  const pairShare = rate(early, (r) => r.type === 'pair');
  detector({ id: 'leadPairShare', title: '早盘领出对子占比', impact: 1, value: pairShare.v, n: pairShare.n, lo: 5 });
  const types = {};
  for (const r of early) types[r.type] = (types[r.type] || 0) + 1;
  const ent = -Object.values(types).reduce((s, c) => s + (c / early.length) * Math.log2(c / early.length), 0);
  const singleShare = (types.single || 0) / (early.length || 1);
  detector({ id: 'leadSingleShare', title: '早盘领出单张占比', impact: 1, value: singleShare, n: early.length, hi: 55, lo: 15,
    detail: `早盘领出牌型分布：${Object.entries(types).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t} ${pct(c, early.length).toFixed(0)}%`).join('，')}；熵 ${ent.toFixed(2)} bit` });
}
// 3.7 走完
{
  const arr = E.filter((r) => r.canGoOut);
  const x = rate(arr, (r) => r.size !== r.n);
  detector({ id: 'missedGoOut', title: '一手能出完却没出完', impact: 3, value: x.v, n: x.n, hi: 1, examples: pick(x.hit) });
}
// 3.8 用时
{
  const ms = decideDec.map((r) => r.ms).sort((a, b) => a - b);
  const q = (p) => ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] || 0;
  const slow = decideDec.filter((r) => r.ms > 300).sort((a, b) => b.ms - a.ms);
  detector({ id: 'slowDecisions', title: 'decide 用时 >300ms 的比例', impact: 1, value: slow.length / (ms.length || 1), n: ms.length, hi: 0.5, examples: slow.slice(0, 5),
    detail: `p50 ${q(0.5)}ms，p90 ${q(0.9)}ms，p99 ${q(0.99)}ms，max ${ms[ms.length - 1]}ms` });
}
// 3.9 不变量
{
  const kinds = {};
  for (const v of violations) kinds[v.kind] = (kinds[v.kind] || 0) + 1;
  const f = detector({ id: 'invariants', title: '对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）', impact: 5, value: violations.length, n: deals.length, hi: 0, unit: '', minN: 1,
    detail: Object.keys(kinds).length ? Object.entries(kinds).map(([k, c]) => `${k} ${c}`).join('，') : '全部通过' });
  if (violations.length) f.severity = 100;
  f.examples = violations.slice(0, 5).map((v) => `\`${v.cfg}|${v.seed}|${v.step}\` ${v.kind}: ${v.detail}`);
}
// 3.10 队伍结果
const outcome = [];
{
  const self = deals.filter((d) => d.cfg === 'self');
  const t0p = pairedStats(self.map((d) => d.points[0]));
  const dd = self.filter((d) => Math.abs(d.points[0]) === 3).length;
  outcome.push(`自对局 ${self.length} 副：南北队每副净升级 ${t0p.mean.toFixed(3)} [${t0p.lo.toFixed(3)}, ${t0p.hi.toFixed(3)}]（应≈0），双下率 ${pct(dd, self.length).toFixed(1)}%，平均每副 ${(self.reduce((s, d) => s + d.steps, 0) / (self.length || 1)).toFixed(0)} 手`);
  const placeBySeat = [0, 1, 2, 3].map((s) => (self.reduce((a, d) => a + d.order.indexOf(s) + 1, 0) / (self.length || 1)).toFixed(2));
  outcome.push(`各座位平均名次（南/东/北/西）：${placeBySeat.join(' / ')}`);
  for (const o of mixedCfgs) {
    const ds = deals.filter((d) => d.cfg === `vs${o}0` || d.cfg === `vs${o}1`);
    const bySeed = new Map();
    for (const d of ds) {
      const team = d.cfg.endsWith('0') ? 0 : 1;
      const key = d.matchSeed ?? d.seed;
      if (!bySeed.has(key)) bySeed.set(key, []);
      bySeed.get(key).push(d.points[team]);
    }
    const st = pairedStats([...bySeed.values()].map((v) => v.reduce((a, b) => a + b, 0) / v.length));
    const w = ds.filter((d) => d.points[d.cfg.endsWith('0') ? 0 : 1] > 0).length;
    metrics[`vs_${o}`] = { value: st.mean, n: ds.length };
    outcome.push(`decide vs ${o}：${ds.length} 副，胜 ${fmtR(w, ds.length)}，每副净升级 ${st.mean.toFixed(3)} [${st.lo.toFixed(3)}, ${st.hi.toFixed(3)}]`);
    const lo = o === 'Random' ? 1.5 : o === 'Greedy' ? 0.5 : null;
    if (lo != null) detector({ id: `vs${o}`, title: `对 ${o} 每副净升级`, impact: 3, value: st.mean, n: ds.length, lo, unit: '' });
    else if (st.hi < 0) detector({ id: `vs${o}`, title: `对旧版 ${o} 每副净升级（显著为负）`, impact: 3, value: st.mean, n: ds.length, lo: 0, unit: '' });
  }
}

// 3.11 进贡
const tribLines = [];
if (TRIB) {
  const all = deals.filter((d) => d.tribute);
  const td = all.filter((d) => d.tribute.kind !== 'none');
  const sgl = td.filter((d) => d.tribute.kind === 'single'), dbl = td.filter((d) => d.tribute.kind === 'double');
  const resS = sgl.filter((d) => d.tribute.resisted).length, resD = dbl.filter((d) => d.tribute.resisted).length;
  const ties = dbl.filter((d) => d.tribute.tie).length;
  tribLines.push(`进贡比赛 ${new Set(all.map((d) => `${d.cfg}|${d.matchSeed}`)).size} 场共 ${all.length} 副；需进贡的副 ${td.length}：单贡 ${sgl.length}（抗贡 ${fmtR(resS, sgl.length)}，理论≈6%），双下双贡 ${dbl.length}（抗贡 ${fmtR(resD, dbl.length)}，理论≈25%；贡牌同点 ${ties}）`);
  const gives = td.flatMap((d) => d.tribute.gives);
  const gr = {};
  for (const x of gives) { const k = x.card === 'RJ' || x.card === 'BJ' ? x.card : x.card.slice(0, -1); gr[k] = (gr[k] || 0) + 1; }
  tribLines.push(`贡牌分布：${Object.entries(gr).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${k} ${pct(c, gives.length).toFixed(0)}%`).join('，')}`);
  const selfRet = deals.filter((d) => d.cfg === 'self' && d.tribute).flatMap((d) => d.tribute.returns);
  const rr = {};
  for (const x of selfRet) rr[x.rank] = (rr[x.rank] || 0) + 1;
  tribLines.push(`自对局还贡点数分布（decide）：${Object.entries(rr).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${k} ${pct(c, selfRet.length).toFixed(0)}%`).join('，')}`);
  const brkAll = rate(selfRet, (x) => x.sameRankBefore >= 2);
  const brk = rate(selfRet.filter((x) => x.orphanAvail), (x) => x.sameRankBefore >= 2);
  const big = rate(selfRet, (x) => !['2', '3', '4', '5', '6', '7', '8', '9', '10'].includes(x.rank));
  detector({ id: 'returnBreaksGroup', title: '自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸）', impact: 1, value: brk.v, n: brk.n, hi: 50,
    detail: `不分有无孤张：还的点数手里原有 ≥2 张 ${fmtR(brkAll.k, brkAll.n)}（有的是顺子里多出的一张，拆牌计划认为更便宜）；还 >10 的牌（手里没有 ≤10，兜底）：${fmtR(big.k, big.n)}` });
  // 先出方（进贡方）与非进贡副的结果
  const selfTd = td.filter((d) => d.cfg === 'self' && !d.tribute.resisted);
  const givTeamPts = selfTd.map((d) => d.points[d.tribute.gives[0].from % 2]);
  const st = pairedStats(givTeamPts);
  tribLines.push(`自对局进贡副（未抗贡）进贡方每副净升级 ${st.mean.toFixed(3)} [${st.lo.toFixed(3)}, ${st.hi.toFixed(3)}]（n=${st.n}；负 = 输家进贡后仍吃亏）`);
  const selfRes = td.filter((d) => d.cfg === 'self' && d.tribute.resisted);
  const st2 = pairedStats(selfRes.map((d) => d.points[(d.tribute.leader + 1) % 2]));
  tribLines.push(`自对局抗贡副 抗贡方每副净升级 ${st2.mean.toFixed(3)} [${st2.lo.toFixed(3)}, ${st2.hi.toFixed(3)}]（n=${st2.n}）`);
  const tv = violations.filter((v) => v.kind === 'tribute');
  tribLines.push(`进贡不变量（贡牌=最大非逢人配、双下大贡归头游/同点头游下家、抗贡判定、还贡≤10、先出者、交换后各 27 张、牌守恒）：${tv.length ? `违例 ${tv.length}` : '全部通过'}（检查 ${all.length} 副）`);
  metrics.tribResistSingle = { value: pct(resS, sgl.length), n: sgl.length };
  metrics.tribResistDouble = { value: pct(resD, dbl.length), n: dbl.length };
}

// ---------- 4. surprise（Monte Carlo） ----------
let surprises = [];
if (SURPRISE > 0) {
  const pool = selfDec.filter((r) => r.n >= 3 && (r.nCands || 0) >= 2 && !(r.canGoOut && r.size === r.n));
  // 分层抽样：按 phase × rel
  const strata = new Map();
  for (const r of pool) {
    const k = `${r.phase}|${r.rel}`;
    if (!strata.has(k)) strata.set(k, []);
    strata.get(k).push(r);
  }
  const per = Math.ceil(SURPRISE / strata.size);
  const chosen = [];
  let seedR = Number(args.surpSeed || 12345);
  const rnd = () => ((seedR = (seedR * 1103515245 + 12345) >>> 0) / 4294967296);
  for (const arr of strata.values()) {
    const a = arr.slice();
    for (let i = 0; i < Math.min(per, a.length); i++) {
      const j = i + Math.floor(rnd() * (a.length - i));
      [a[i], a[j]] = [a[j], a[i]];
      chosen.push(a[i]);
    }
  }
  const preOf = new Map(deals.map((d) => [`${d.cfg}|${d.seed}`, d.pre || null]));
  const positions = chosen.slice(0, SURPRISE).map((r) => ({ cfg: r.cfg, seed: Number(r.id.split('|')[1]), step: r.step, specs: specsFor(r.cfg), pre: preOf.get(`${r.cfg}|${r.id.split('|')[1]}`) || null }));
  const tasks = [];
  const chunk = Math.max(1, Math.ceil(positions.length / 28));
  for (let i = 0; i < positions.length; i += chunk) tasks.push({ kind: 'surprise', version: VERSION, positions: positions.slice(i, i + chunk), maxCands: 4, k1: Number(args.k1 || 12), k2: Number(args.k2 || 24), stage2Diff: 0.4 });
  log(`surprise: ${positions.length} positions in ${tasks.length} tasks`);
  const sr = await runTasks(tasks, undefined, (d, n) => log(`surprise tasks ${d}/${n}`));
  surprises = sr.flatMap((r) => r.surprises);
}
const SURP_DIFF = 0.6, SURP_T = 2.5;
const surpFlag = surprises.filter((s) => s.best && s.best.diff >= SURP_DIFF && s.best.t >= SURP_T).sort((a, b) => b.best.diff - a.best.diff);
if (SURPRISE > 0) {
  const f = detector({ id: 'surprise', title: `Monte Carlo 意外：另一着平均多 ≥${SURP_DIFF} 级/副且 t≥${SURP_T}`, impact: 3, value: surpFlag.length / (surprises.length || 1), n: surprises.length, hi: 5, minN: 20 });
  f.examples = surpFlag.slice(0, 8).map((s) => `\`${s.id}\` ${s.rel} ${s.n}张 张数${s.counts.join('/')} 级${s.lv} 上手=${s.prev}<br>decide: **${s.chosen}** (${s.chosenMean.toFixed(2)}) [${(s.chosenTags || []).join(',')}] vs **${s.best.move}** (+${s.best.diff.toFixed(2)}, t=${s.best.t.toFixed(1)}, n=${s.best.n})<br>手牌: ${s.hand}`);
  const cats = {};
  for (const s of surpFlag) {
    const altPass = s.best.move === 'pass', chPass = s.chosen === 'pass';
    const k = `${s.rel}/${s.n >= 20 ? 'early' : s.n >= 10 ? 'mid' : 'late'}/${chPass ? 'passed' : altPass ? 'shouldPass' : 'otherPlay'}`;
    cats[k] = (cats[k] || 0) + 1;
  }
  f.detail = `分类：${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${k} ${c}`).join('，') || '无'}`;
}

// ---------- 5. 报告 ----------
const prevJson = OUT.replace(/\.md$/, '.json');
// “上次”列：--prev=<json>，默认同名 .json，没有则用 audit-latest.json
let prev = null;
for (const f of [args.prev, prevJson, path.join(L.ROOT, 'selfplay', 'reports', 'audit-latest.json')].filter(Boolean)) {
  try { prev = JSON.parse(fs.readFileSync(f, 'utf8')); break; } catch {}
}
const fmtV = (f) => (f.unit === '%' ? `${f.value.toFixed(1)}%` : f.value.toFixed(3));
const rangeS = (f) => `${f.lo != null ? `≥${f.lo}` : ''}${f.lo != null && f.hi != null ? ' 且 ' : ''}${f.hi != null ? `≤${f.hi}` : ''}${f.unit === '%' ? '%' : ''}`;
const red = flags.filter((f) => f.red).sort((a, b) => b.severity - a.severity);
const lines = [];
lines.push(`# 自对局体检报告`, '', `生成：${new Date().toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })}（Asia/Shanghai）　policy：${VERSION}　用时 ${((Date.now() - t0) / 1000).toFixed(0)}s`, '');
lines.push(`对局：${TRIB ? `【进贡比赛模式，每场 ${MLEN} 副】` : ''}自对局 ${DEALS} 副（四家 decide），混合对手 ${mixedCfgs.join('、')} 各 ${MIXED}×2 副（换座位）；逐手记录 ${decisions.length} 条；surprise 局面 ${surprises.length} 个。`, '');
lines.push(`局面 id 可复现：\`node selfplay/audit.mjs --replay='<id>'\`（cfg|seed|step）。`, '');
lines.push(`## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）`, '');
if (!red.length) lines.push('无红旗。', '');
for (const f of red) lines.push(`- **${f.title}**：${fmtV(f)}（n=${f.n}，合理区间 ${rangeS(f)}，严重度 ${f.severity.toFixed(1)}）`);
lines.push('', '## 全部检测器', '', '| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |', '|---|---|---|---|---|---|');
for (const f of flags) {
  const p = prev?.metrics?.[f.id];
  lines.push(`| ${f.title} | ${fmtV(f)} | ${f.n} | ${rangeS(f)} | ${p ? (f.unit === '%' ? `${p.value.toFixed(1)}%` : p.value.toFixed(3)) : '-'} | ${f.red ? '🚩' : f.n < 30 && f.unit === '%' ? '样本少' : 'OK'} |`);
}
lines.push('', '## 队伍结果', '', ...outcome.map((s) => `- ${s}`), '');
if (tribLines.length) lines.push('## 进贡', '', ...tribLines.map((s) => `- ${s}`), '');
lines.push('## 详情与示例局面', '');
for (const f of [...red, ...flags.filter((x) => !x.red)]) {
  if (!f.detail && !f.examples.length) continue;
  lines.push(`### ${f.red ? '🚩 ' : ''}${f.title}`, '');
  if (f.detail) lines.push(f.detail, '');
  for (const e of f.examples) lines.push(`- ${e}`);
  lines.push('');
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, lines.join('\n'));
fs.writeFileSync(prevJson, JSON.stringify({ when: new Date().toISOString(), version: VERSION, metrics, red: red.map((f) => f.id), surprises: surpFlag }, null, 1));
if (args.dump) fs.writeFileSync(args.dump, JSON.stringify({ decisions: selfDec, deals, surprises }));
console.log(lines.slice(0, 8 + red.length + 2).join('\n'));
console.log(`\n报告：${OUT}`);
