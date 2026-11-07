/**
 * 自对局公用：与网页版完全相同的对局逻辑（play/core.js），多种对手，不变量检查，局面复现，确定化 rollout。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { newGame, isOver, isLeading, ctxFor, play, sortHand, makeRng, snapshot, isPassMove, autoTribute, botReturnCard, returnChoices, tributePending } from '../play/core.js';
import { newStdMatch } from '../engine/tributeStd.js';
import { RETURN_VARIANTS, r42TributeCard } from '../policy/tribute.js';
import { legalMoves } from '../engine/legal.js';
import { TYPES, isBombLike, classify } from '../engine/combos.js';
import { beats } from '../engine/compare.js';
import { singleStrength, isJokerRank, isWildCard, RANKS } from '../engine/ranks.js';
import { formatCard } from '../engine/cards.js';
import { minPlays } from '../policy/shape.js';
import { decide as decideCurrent } from '../policy/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
export { ROOT, formatCard, snapshot, ctxFor, isLeading, sortHand };

export { policySourceManifest } from '../scripts/experiments/r169/eval-meta.mjs';

export function loadDecideStamp(name = 'current') {
  if (name === 'current') return null;
  try {
    return fs.readFileSync(path.join(HERE, '.versions', name, '.stamp'), 'utf8');
  } catch {
    return null;
  }
}

// ---------- policy 版本 ----------
const versionCache = new Map();
/** 'current' 或 backups/ 下的目录名（如 pre-activity）。旧版复制到 selfplay/.versions/<name>/ 并改写相对导入。 */
export async function loadDecide(name = 'current') {
  if (name === 'current') return decideCurrent;
  if (versionCache.has(name)) return versionCache.get(name);
  const src = path.join(ROOT, 'backups', name);
  if (!fs.existsSync(path.join(src, 'index.js'))) throw new Error(`no policy backup: backups/${name}/index.js`);
  const dst = path.join(HERE, '.versions', name);
  // 多个 worker 并发：先写临时目录再原子改名；已存在且与备份一致就复用
  const stamp = fs.readdirSync(src).filter((f) => f.endsWith('.js')).map((f) => `${f}:${fs.statSync(path.join(src, f)).mtimeMs}`).join('|');
  const ok = () => { try { return fs.readFileSync(path.join(dst, '.stamp'), 'utf8') === stamp; } catch { return false; } };
  if (!ok()) {
    const tmp = `${dst}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
    fs.mkdirSync(tmp, { recursive: true });
    for (const f of fs.readdirSync(src)) {
      if (!f.endsWith('.js') || f === 'search-index.js') continue;
      const txt = fs.readFileSync(path.join(src, f), 'utf8').replace(/from '\.\.\//g, "from '../../../");
      fs.writeFileSync(path.join(tmp, f), txt);
    }
    fs.writeFileSync(path.join(tmp, '.stamp'), stamp);
    if (!ok()) {
      try { fs.rmSync(dst, { recursive: true, force: true }); fs.renameSync(tmp, dst); } catch { /* 另一个 worker 抢先 */ }
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const mod = await import(pathToFileURL(path.join(dst, 'index.js')).href);
  versionCache.set(name, mod.decide);
  return mod.decide;
}

// ---------- 对手 ----------
function strengthOf(m, lv) {
  return m.combo?.rank != null ? singleStrength(m.combo.rank, lv) : 0;
}
export function randomAgent(g, seat, rng) {
  const r = g.round;
  const leading = isLeading(g);
  const ms = legalMoves(r.hands[seat], leading ? null : r.lastCombo, g.match.levelRank, leading);
  return ms[Math.floor(rng() * ms.length)] || { cards: [], combo: { type: TYPES.PASS } };
}
/** 贪心：领出出张数最多的非炸弹（同张数取最小）；跟牌用最小的同型压，无则过（敌家 ≤5 张时可炸）；不压对家。 */
export function greedyAgent(g, seat) {
  const r = g.round;
  const lv = g.match.levelRank;
  const leading = isLeading(g);
  const ms = legalMoves(r.hands[seat], leading ? null : r.lastCombo, lv, leading).filter((m) => m.cards.length);
  const nb = ms.filter((m) => !isBombLike(m.combo));
  if (leading) {
    const pool = nb.length ? nb : ms;
    pool.sort((a, b) => b.cards.length - a.cards.length || strengthOf(a, lv) - strengthOf(b, lv));
    return pool[0];
  }
  const pass = { cards: [], combo: { type: TYPES.PASS } };
  if (r.lastPlayer === (seat + 2) % 4) return pass;
  if (nb.length) return nb.sort((a, b) => strengthOf(a, lv) - strengthOf(b, lv) || a.cards.length - b.cards.length)[0];
  const enemyMin = Math.min(r.hands[(seat + 1) % 4].length || 99, r.hands[(seat + 3) % 4].length || 99);
  if (ms.length && enemyMin <= 5) return ms.sort((a, b) => a.cards.length - b.cards.length)[0];
  return pass;
}

/**
 * 由描述构造座位代理。spec: 'decide' | 'decide@<backup>' | 'random' | 'greedy' | 'jev' | 'startlux'（Jev/StartLux 选 decide 候选），可加 '#ret=<min|plan>' 指定还贡变体
 * （不加 = policy/tribute.DEFAULT_RETURN；random 随机还、greedy 还最小；旧版 decide@<backup> 也用当前 policy/tribute）。
 */
export async function makeAgent(spec0, seed = 1) {
  const [spec, ...opts] = spec0.split('#');
  const o = Object.fromEntries(opts.map((x) => x.split('=')));
  if (o.ret && !RETURN_VARIANTS.includes(o.ret)) throw new Error(`unknown return variant ${o.ret}`);
  if (spec === 'random') {
    const rng = makeRng(seed * 7919 + 13);
    return { spec: spec0, act: (g, s) => ({ move: randomAgent(g, s, rng) }), returnCard: (g, s) => { const c = returnChoices(g, s); return c[Math.floor(rng() * c.length)]; } };
  }
  if (spec === 'greedy') return { spec: spec0, act: (g, s) => ({ move: greedyAgent(g, s) }), returnCard: (g, s) => botReturnCard(g, s, o.ret || 'min') };
  if (spec === 'jev') {
    // Jev 在 decide 候选中选（decide = current；失败兜底 decide）。见 selfplay/jevAgent.mjs
    const { makeJevAct } = await import('./jevAgent.mjs');
    return { spec: spec0, decide: decideCurrent, jev: true, act: makeJevAct(decideCurrent, ctxFor), returnCard: (g, s) => botReturnCard(g, s, o.ret) };
  }
  if (spec === 'startlux') {
    // StartLux-Decision：默认 Bamboo 27B AutoThink，可选本地 Instant（失败兜底 decide）。见 selfplay/startluxAgent.mjs
    const { makeStartluxAct } = await import('./startluxAgent.mjs');
    return { spec: spec0, decide: decideCurrent, startlux: true, act: makeStartluxAct(decideCurrent, ctxFor), returnCard: (g, s) => botReturnCard(g, s, o.ret) };
  }
  const ver = spec.includes('@') ? spec.split('@')[1] : 'current';
  const d = await loadDecide(ver);
  return { spec: spec0, decide: d, trib: Number(o.trib || 0), act: (g, s) => d(ctxFor(g, s)), returnCard: (g, s) => botReturnCard(g, s, o.ret) };
}

// ---------- 结果 ----------
/** 队伍得分（升级数）：头游所在队 +3/+2/+1（对家二/三/末游），另一队取负。返回 [team0, team1]。 */
export function teamPoints(order) {
  const t = order[0] % 2;
  const p = order[1] % 2 === t ? 3 : order[2] % 2 === t ? 2 : 1;
  return t === 0 ? [p, -p] : [-p, p];
}

export function levelFor(seed) {
  return RANKS[Math.abs(seed) % 13];
}

// ---------- 不变量 ----------
function expectedNext(state, r, seat, wasPass, trickEnded) {
  const active = (s) => !r.finished.includes(s);
  const nextActive = (s) => {
    for (let i = 1; i <= 4; i++) if (active((s + i) % 4)) return (s + i) % 4;
    return s;
  };
  if (!wasPass) return nextActive(seat);
  if (!trickEnded) return nextActive(seat);
  let leader = state.lastNonPass;
  if (!active(leader)) {
    const p = (leader + 2) % 4;
    leader = active(p) ? p : nextActive(leader);
  }
  return leader;
}

/**
 * 打一副。agents: 4 个代理；opts.onDecision(rec) 收集每手数据；opts.stopAt 停在第几手（复现）。
 * 返回 { g, order, points, violations, steps }。
 */
export function playDeal(seed, agents, { onDecision = null, stopAt = null, levelRank = null, maxSteps = 1500, pre = null } = {}) {
  // pre：比赛中的一副（进贡模式），{ teamLevel, level, levelTeam, prevOrder }；不传 = 原来的独立单副（无升级/进贡）
  const g = pre
    ? newGame({ seed, levelRank: pre.level, progression: true, tribute: true, pre })
    : newGame({ seed, levelRank: levelRank || levelFor(seed), progression: false });
  const violations = [];
  const viol = (kind, step, detail) => violations.push({ kind, seed, step, detail });
  const allIds = new Set(g.round.hands.flat().map((c) => c.id));
  if (allIds.size !== 108) viol('deal', 0, `deal has ${allIds.size} unique cards`);
  let tribute = null;
  if (pre) {
    const ts0 = g.tributeState;
    if (ts0 && ts0.phase === 'give') for (const x of ts0.plan.gives) { const m = agents[x.from].trib; if (m) x.card = r42TributeCard(g.round.hands[x.from], x.card, g.match.levelRank, m); }
    autoTribute(g, (s) => agents[s].returnCard(g, s));
    if (tributePending(g)) viol('tribute', 0, 'tribute still pending');
    tribute = summarizeTribute(g);
    for (const v of checkTribute(g, pre.prevOrder)) viol('tribute', 0, v);
  }
  const state = { lastNonPass: null };
  let step = 0;
  while (!isOver(g)) {
    if (stopAt != null && step === stopAt) return { g, step, violations, stopped: true };
    if (step >= maxSteps) { viol('noEnd', step, 'deal did not end'); break; }
    const r = g.round;
    const seat = r.currentSeat;
    const leading = isLeading(g);
    if (r.finished.includes(seat)) viol('turn', step, `finished seat ${seat} to act`);
    // 对家牌检测 = 桌面最后一手
    const lastT = [...g.trickPlays].reverse().find((t) => !isPassMove(t));
    const ctx = ctxFor(g, seat);
    const tableIsPartner = !leading && lastT && lastT.seat === (seat + 2) % 4;
    if (!!ctx.partnerCombo !== !!tableIsPartner) viol('partnerDetect', step, `ctx.partnerCombo=${!!ctx.partnerCombo} table=${!!tableIsPartner}`);
    if (!leading && lastT && lastT.seat !== r.lastPlayer) viol('lastPlayer', step, `trickPlays last ${lastT.seat} vs lastPlayer ${r.lastPlayer}`);
    const t0 = performance.now();
    if (process.env.GD_EVAL_BEAM_WORK_COLLECT === '1' || process.env.GD_EVAL_BEAM_WORK_TRACE === '1') {
      try { delete globalThis.__GD_SEARCH_BEAM_WORK__; } catch { /* eval */ }
    }
    const rec = agents[seat].act(g, seat);
    const ms = rec.ms ?? performance.now() - t0;
    const move = rec.move;
    if (leading && isPassMove(move)) viol('passOnLead', step, `seat ${seat} passed on lead`);
    if (!isPassMove(move) && !leading && !beats(move.combo, r.lastCombo, g.match.levelRank)) viol('illegal', step, `${move.combo.type}:${move.combo.rank} does not beat ${r.lastCombo.type}:${r.lastCombo.rank}`);
    const before = r.hands[seat].slice();
    const prevCombo = leading ? null : r.lastCombo;
    const prevSeat = leading ? null : r.lastPlayer;
    const countsBefore = r.hands.map((h) => h.length);
    let res = play(g, seat, move.cards || [], { by: agents[seat].spec, preferCombo: move.combo });
    let fallback = false;
    if (!res.ok) {
      viol('rejected', step, `seat ${seat} move rejected: ${res.reason}`);
      fallback = true;
      const fb = leading ? [sortHand(r.hands[seat], g.match.levelRank).slice(-1)[0]] : [];
      res = play(g, seat, fb, { by: 'fallback' });
    }
    const played = fallback ? (leading ? [sortHand(before, g.match.levelRank).slice(-1)[0]] : []) : move.cards || [];
    const wasPass = played.length === 0;
    if (!wasPass) state.lastNonPass = seat;
    // 张数守恒
    const inHands = g.round.hands.flat();
    const ids = new Set(inHands.map((c) => c.id).concat(g.played.map((c) => c.id)));
    if (ids.size !== 108 || inHands.length + g.played.length !== 108) viol('conservation', step, `cards=${inHands.length}+${g.played.length} unique=${ids.size}`);
    if (!isOver(g)) {
      const trickEnded = res.entry?.trickEnd === true;
      const exp = expectedNext(state, g.round, seat, wasPass, trickEnded);
      if (exp !== g.round.currentSeat) viol('turnOrder', step, `expected seat ${exp}, got ${g.round.currentSeat}`);
      if (trickEnded && !isLeading(g)) viol('trickEnd', step, 'trick ended but not leading');
    }
    if (onDecision) onDecision({ g, step, seat, leading, ctx, rec, move: fallback ? { cards: played, combo: res.entry?.move } : move, before, prevCombo, prevSeat, countsBefore, ms, spec: agents[seat].spec, fallback });
    step++;
  }
  const order = g.round.finished.slice();
  if (isOver(g) && order.length !== 4) viol('order', step, `finish order ${order}`);
  return { g, order, points: isOver(g) ? teamPoints(order) : [0, 0], violations, steps: step, tribute, pre };
}

// ---------- 进贡比赛 ----------
/** 进贡记录（报告/统计用）。 */
export function summarizeTribute(g) {
  const ts = g.tributeState;
  const lv = g.match.levelRank;
  const p = ts.plan;
  return {
    kind: p.kind, resisted: !!p.resisted, tie: !!p.tie, leader: g.round.currentSeat,
    gives: p.gives.map((x) => ({ from: x.from, to: x.to, card: formatCard(x.card) })),
    returns: ts.returns.map((x) => {
      const before = ts.dealt[x.from].concat(p.gives.filter((y) => y.to === x.from).map((y) => y.card));
      const cnt = (r) => before.filter((c) => c.rank === r && !isWildCard(c, lv)).length;
      const same = cnt(x.card.rank);
      // 手里是否有“孤张”可还（≤10、该点数只有 1 张）
      const orphanAvail = before.some((c) => !isJokerRank(c.rank) && !isWildCard(c, lv) && ['2', '3', '4', '5', '6', '7', '8', '9', '10'].includes(c.rank) && cnt(c.rank) === 1);
      return { from: x.from, to: x.to, card: formatCard(x.card), rank: x.card.rank, sameRankBefore: same, orphanAvail };
    }),
  };
}

/**
 * 进贡不变量（独立重算，不调用 planTribute）：贡牌 = 最大非逢人配；双下大贡归头游、同点头游下家给头游；
 * 抗贡判定；还贡 ≤10（无则最小）；先出者；交换后每家 27 张、牌守恒。
 */
export function checkTribute(g, prevOrder) {
  const out = [];
  const ts = g.tributeState;
  const lv = g.match.levelRank;
  const dealt = ts.dealt;
  const p = ts.plan;
  const str = (c) => singleStrength(c.rank, lv);
  const maxNonWild = (h) => Math.max(...h.filter((c) => !isWildCard(c, lv)).map(str));
  const rj = (h) => h.filter((c) => c.rank === 'RJ').length;
  if (!prevOrder) {
    if (p.kind !== 'none' || ts.returns.length) out.push('first deal has tribute');
    return out;
  }
  const [head, second, third, tail] = prevOrder;
  const dd = head % 2 === second % 2;
  const shouldResist = dd ? rj(dealt[third]) + rj(dealt[tail]) >= 2 : rj(dealt[tail]) >= 2;
  if (p.kind !== (dd ? 'double' : 'single')) out.push(`kind ${p.kind} expected ${dd ? 'double' : 'single'}`);
  if (!!p.resisted !== shouldResist) out.push(`resist ${p.resisted} expected ${shouldResist}`);
  let expLeader;
  if (shouldResist) {
    expLeader = head;
    if (p.gives.length || ts.returns.length) out.push('resisted but cards moved');
  } else {
    const givers = dd ? [third, tail] : [tail];
    if (p.gives.length !== givers.length) out.push(`gives ${p.gives.length} expected ${givers.length}`);
    for (const x of p.gives) {
      if (!givers.includes(x.from)) out.push(`giver ${x.from} not a loser`);
      if (!dealt[x.from].some((c) => c.id === x.card.id)) out.push(`tribute card not in giver hand`);
      if (isWildCard(x.card, lv)) out.push('tribute is 逢人配');
      if (str(x.card) !== maxNonWild(dealt[x.from])) out.push(`tribute ${formatCard(x.card)} not highest of seat ${x.from}`);
    }
    if (dd && p.gives.length === 2) {
      const toHead = p.gives.find((x) => x.to === head), toSecond = p.gives.find((x) => x.to === second);
      if (!toHead || !toSecond) out.push('double tribute receivers wrong');
      else {
        const a = str(toHead.card), b = str(toSecond.card);
        if (a < b) out.push('smaller tribute went to 头游');
        if (a === b && toHead.from !== (head + 1) % 4) out.push('tie: 头游下家 should give to 头游');
      }
      expLeader = toHead ? toHead.from : null;
    } else if (!dd) {
      if (p.gives[0] && p.gives[0].to !== head) out.push('single tribute not to 头游');
      expLeader = tail;
    }
    if (ts.returns.length !== p.gives.length) out.push(`returns ${ts.returns.length} != gives ${p.gives.length}`);
    for (const r of ts.returns) {
      const giv = p.gives.find((x) => x.to === r.from);
      if (!giv || giv.from !== r.to) out.push(`return ${r.from}->${r.to} not to own tributer`);
      const handAt = dealt[r.from].concat(p.gives.filter((y) => y.to === r.from).map((y) => y.card));
      const le10 = handAt.filter((c) => !isJokerRank(c.rank) && !isWildCard(c, lv) && ['2', '3', '4', '5', '6', '7', '8', '9', '10'].includes(c.rank));
      const ok = le10.length ? le10.some((c) => c.id === r.card.id) : str(r.card) === Math.min(...handAt.filter((c) => !isWildCard(c, lv)).map(str));
      if (!ok) out.push(`return ${formatCard(r.card)} not ≤10`);
    }
  }
  if (g.round.currentSeat !== expLeader) out.push(`leader ${g.round.currentSeat} expected ${expLeader}`);
  const n = g.round.hands.map((h) => h.length);
  if (n.some((x) => x !== 27)) out.push(`counts ${n.join(',')}`);
  const ids = new Set(g.round.hands.flat().map((c) => c.id));
  const ids0 = new Set(dealt.flat().map((c) => c.id));
  if (ids.size !== 108 || [...ids0].some((i) => !ids.has(i))) out.push('cards not conserved in exchange');
  return out;
}

/** 下一副的 pre（比赛结束则新比赛从 2 开始、无进贡）。 */
export function nextPre(g) {
  if (g.std.matchOver) return { ...newStdMatch('2') };
  const { teamLevel, level, levelTeam, prevOrder } = g.std;
  return { teamLevel: teamLevel.slice(), level, levelTeam, prevOrder: prevOrder.slice() };
}

/** 一副比赛中第 i 副的牌种子。 */
export const dealSeedOf = (matchSeed, i) => matchSeed * 16 + i;

/**
 * 打一场 K 副的进贡比赛（连续发牌、名次/级数带到下一副）。起始级 = startLevel（两队相同；默认 levelFor(matchSeed) 增加级牌多样性）。
 * 返回 deals: [{ seed, i, pre, order, points, steps, tribute, violations, g }]。
 */
export function playMatch(matchSeed, agents, { deals = 8, startLevel = null, onDecision = null, onDeal = null } = {}) {
  let pre = { ...newStdMatch(startLevel || levelFor(matchSeed)) };
  const out = [];
  for (let i = 0; i < deals; i++) {
    const seed = dealSeedOf(matchSeed, i);
    const res = playDeal(seed, agents, { pre, onDecision: onDecision ? (d) => onDecision({ ...d, dealSeed: seed, dealIdx: i }) : null });
    const rec = { seed, i, matchSeed, pre, ...res };
    out.push(rec);
    if (onDeal) onDeal(rec);
    if (!isOver(res.g)) break;
    pre = nextPre(res.g);
  }
  return out;
}

// ---------- 确定化 rollout（surprise 检测） ----------
function cloneGame(g) {
  return {
    ...g,
    rng: makeRng(1),
    match: structuredClone(g.match),
    round: structuredClone(g.round),
    log: [],
    played: g.played.slice(),
    trickPlays: structuredClone(g.trickPlays),
    lastTablePlay: structuredClone(g.lastTablePlay),
    flags: [],
  };
}
/** 随机重发对手手牌（保持张数），我方手牌不变。 */
export function determinize(g, seat, rng) {
  const c = cloneGame(g);
  const others = [0, 1, 2, 3].filter((s) => s !== seat);
  const pool = others.flatMap((s) => c.round.hands[s]);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let k = 0;
  for (const s of others) {
    const n = c.round.hands[s].length;
    c.round.hands[s] = pool.slice(k, k + n);
    k += n;
  }
  return c;
}
/** 在克隆局面里先走 move（牌按 id 映射），再全用 decide 打完。返回该座位所在队的得分。 */
export function rollout(gc, seat, move, decideFn, maxSteps = 800) {
  const hand = gc.round.hands[seat];
  const cards = (move.cards || []).map((c) => hand.find((h) => h.id === c.id));
  const res = play(gc, seat, cards, { by: 'mc', preferCombo: move.combo });
  if (!res.ok) return null;
  let n = 0;
  while (!isOver(gc) && n++ < maxSteps) {
    const s = gc.round.currentSeat;
    const rec = decideFn(ctxFor(gc, s));
    let r2 = play(gc, s, rec.move.cards || [], { by: 'mc', preferCombo: rec.move.combo });
    if (!r2.ok) play(gc, s, isLeading(gc) ? [sortHand(gc.round.hands[s], gc.match.levelRank).slice(-1)[0]] : [], { by: 'mc' });
    if (gc.log.length > 50) gc.log = [];
  }
  if (!isOver(gc)) return null;
  const pts = teamPoints(gc.round.finished);
  return { pts: pts[seat % 2], place: gc.round.finished.indexOf(seat) + 1 };
}

// ---------- 小工具 ----------
export const phaseOf = (n) => (n >= 20 ? 'early' : n >= 10 ? 'mid' : 'late');
export function isControlCard(c, lv) {
  return isJokerRank(c.rank) || (c.rank === lv && !isWildCard(c, lv));
}
export function naturalCounts(hand, lv) {
  const m = new Map();
  for (const c of hand) if (!isWildCard(c, lv) || isJokerRank(c.rank)) m.set(c.rank, (m.get(c.rank) || 0) + 1);
  return m;
}
export function handHasBomb(hand, lv) {
  const ms = legalMoves(hand, null, lv, true);
  return ms.some((m) => isBombLike(m.combo));
}
export { legalMoves, isBombLike, classify, singleStrength, isJokerRank, isWildCard, minPlays, TYPES, isPassMove };
