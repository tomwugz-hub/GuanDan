/**
 * Lightweight hand plan: decompose a hand into the fewest/cheapest leading plays and order them.
 *  decompose(hand, lv) → { comps: [{move, key, role, order}], plays, cost } | null (hand too big)
 *  - search: DFS anchored on the lowest natural card (every play containing it), memoised by card ids
 *  - cost: 1 per play; bombs 0.3 (control, not a burden); breaking a natural bomb +1.5; splitting a pair/triple +0.05; small orphan singles +0.01 per rank below A (tie-break);
 *          wild used in a non-bomb small play +0.25;
 *          level/joker singles 0.8 (control singles are not burdens either)
 *  - role: 'bomb' | 'control' (jokers / level single or pair / level triple) | 'unit' (straight, tube, plate, FH, triple) | 'small'
 *  - order key: lowest natural rank in the play (weakest first), controls and bombs last
 * Wild cards are only used to complete bombs (or a whole-hand play); otherwise they stay as control singles.
 * Used by decide lead scoring and mirrored to Jev (plan string + tags).
 */
import { TYPES, isBombLike } from '../../../engine/combos.js';
import { singleStrength, isWildCard, RANKS } from '../../../engine/ranks.js';
import { generateCandidates } from '../../../search/index.js';

const MAX_CARDS = 14;
const NAT = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', 'BJ', 'RJ'];

export function comboKey(m) {
  return `${m.combo?.type}:${m.combo?.rank}:${m.cards?.length}`;
}

function idsKey(hand) {
  return hand.map((c) => c.id).sort().join(',');
}

const SINGLE_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
function playCost(m, lv, cnt0) {
  const c = m.combo;
  if (isBombLike(c)) return 0.3;
  let cost = 1;
  // splitting natural rank groups: bombs are worth more than a play (+1.5); small tie-break for pairs/triples (+0.05)
  const used = new Map();
  for (const x of m.cards) if (!isWildCard(x, lv)) used.set(x.rank, (used.get(x.rank) || 0) + 1);
  for (const [r, k] of used) {
    const n = cnt0.get(r) || 0;
    if (n >= 4 && r !== 'BJ' && r !== 'RJ') cost += 1.5;
    else if (n > k) cost += 0.05;
  }
  const n = m.cards.length;
  const wild = m.cards.some((x) => isWildCard(x, lv));
  if (wild && n <= 3) cost += 0.25;
  // 平局时偏好留下较大的孤单（小孤单更难脱手）
  if (c.type === TYPES.SINGLE) cost += 0.01 * Math.max(0, 14 - (SINGLE_ORDER.indexOf(c.rank) + 2));
  if (c.type === TYPES.SINGLE && (c.rank === lv || c.rank === 'BJ' || c.rank === 'RJ')) cost = 0.8;
  if (c.type === TYPES.PAIR && (c.rank === 'BJ' || c.rank === 'RJ')) cost = 0.8;
  return cost;
}

export function roleOf(m, lv) {
  const c = m.combo;
  if (isBombLike(c)) return 'bomb';
  const r = c.rank;
  if ((c.type === TYPES.SINGLE || c.type === TYPES.PAIR || c.type === TYPES.TRIPLE) && (r === lv || r === 'BJ' || r === 'RJ')) return 'control';
  if (m.cards.length >= 3) return 'unit';
  return 'small';
}

function orderKey(m, lv) {
  const nat = m.cards.filter((x) => !isWildCard(x, lv)).map((x) => NAT.indexOf(x.rank));
  const low = nat.length ? Math.min(...nat) : 99;
  const role = roleOf(m, lv);
  return (role === 'bomb' ? 2000 : role === 'control' ? 1000 + singleStrength(m.combo.rank, lv) : 0) + low;
}

/** best decomposition of `hand` (cards with ids). cache: Map shared per decision. */
export function decompose(hand, lv = '2', cache = new Map(), opts = {}) {
  const freeWild = !!opts.freeWild; // true: 逢人配可任意使用（用于“用/不用逢人配”的对比）；需配独立 cache
  if (!hand?.length) return { comps: [], plays: 0, cost: 0 };
  if (hand.length > MAX_CARDS) return null;
  const t0 = Date.now();
  const cnt0 = new Map();
  for (const x of hand) if (!isWildCard(x, lv)) cnt0.set(x.rank, (cnt0.get(x.rank) || 0) + 1);
  const rec = (h) => {
    if (!h.length) return { list: [], cost: 0 };
    const k = idsKey(h);
    if (cache.has(k)) return cache.get(k);
    // anchor: lowest natural (non-wild) card; if only wilds remain, anchor on any
    const nat = h.filter((c) => !isWildCard(c, lv));
    const anchor = (nat.length ? nat : h).reduce((a, b) => (NAT.indexOf(b.rank) < NAT.indexOf(a.rank) ? b : a));
    let moves = [];
    try {
      moves = generateCandidates({ hand: h, previous: null, levelRank: lv, leading: true }) || [];
    } catch {
      moves = [];
    }
    // 逢人配只用来补炸弹（或一手出完）；其余时候留作控制牌，单独记一手
    moves = moves.filter((m) => m.cards?.length && m.cards.some((c) => c.id === anchor.id) && (freeWild ||
      !m.cards.some((c) => isWildCard(c, lv)) || isBombLike(m.combo) || m.cards.length === h.length ||
        ([TYPES.SINGLE, TYPES.PAIR, TYPES.TRIPLE].includes(m.combo?.type) && m.combo.rank === lv && m.cards.every((c) => c.rank === lv))));
    let best = null;
    for (const m of moves) {
      if (Date.now() - t0 > 25) break; // hard time cap
      const ids = new Set(m.cards.map((c) => c.id));
      const r = rec(h.filter((c) => !ids.has(c.id)));
      if (!r) continue;
      const cost = r.cost + playCost(m, lv, cnt0);
      if (!best || cost < best.cost - 1e-9) best = { list: [m, ...r.list], cost };
    }
    if (!best) best = { list: [{ cards: [anchor], combo: { type: TYPES.SINGLE, rank: anchor.rank } }, ...(rec(h.filter((c) => c.id !== anchor.id))?.list || [])], cost: 99 };
    cache.set(k, best);
    return best;
  };
  const r = rec(hand);
  const comps = r.list.map((m) => ({ move: m, key: comboKey(m), role: roleOf(m, lv), order: orderKey(m, lv) }));
  comps.sort((a, b) => a.order - b.order);
  return { comps, plays: comps.length, cost: r.cost };
}

/** short human-readable plan, e.g. "33 → 56789 → 44 → [炸]8888" */
export function planString(plan) {
  if (!plan) return '';
  return plan.comps
    .map((c) => (c.role === 'bomb' ? '[炸]' : c.role === 'control' ? '[控]' : '') + c.move.cards.map((x) => x.rank).join(''))
    .join(' → ');
}

export { RANKS };

/**
 * 大手牌（>MAX_CARDS，开局）的拆牌计划：按点数计数做记忆化搜索（忽略花色/同花顺；逢人配、王单独作控制牌）。
 * 与 decompose 同一套代价（每手 1，炸 0.3，拆天然炸 +1.5，拆对/三 +0.05，小孤单平局微调，级牌/王单 0.8），
 * 返回同样结构的 { comps, plays, cost }；comps 的 move 只含点数（cards 为 {rank,suit} 占位），供领出计划分比较 comboKey。
 * 自对局体检 r7：原先 >14 张没有计划，开局领出全靠“孤单小牌”加分，导致早盘领单 72%。
 */
const SEQ = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export function decomposeCounts(hand, lv = '2', cache = new Map(), base = null) {
  if (!hand?.length) return { comps: [], plays: 0, cost: 0 };
  const cnt = new Array(13).fill(0);
  let bj = 0, rj = 0, wild = 0;
  for (const c of hand) {
    if (c.rank === 'BJ') bj++;
    else if (c.rank === 'RJ') rj++;
    else if (isWildCard(c, lv)) wild++;
    else cnt[SEQ.indexOf(c.rank)]++;
  }
  const cnt0 = base || cnt.slice(); // 原手牌计数（拆炸/拆对代价相对原手牌）
  const card = (r, n) => Array.from({ length: n }, () => ({ rank: r, suit: 'S' }));
  const mk = (type, rank, ranksN) => ({ combo: { type, rank }, cards: ranksN.flatMap(([r, n]) => card(r, n)) });
  const costOf = (type, used) => {
    if (type === TYPES.BOMB) return 0.3;
    let cost = 1;
    for (const [i, k] of used) {
      if (cnt0[i] >= 4) cost += 1.5;
      else if (cnt0[i] > k) cost += 0.05;
    }
    if (type === TYPES.SINGLE) {
      const i = used[0][0];
      if (SEQ[i] === lv) return 0.8;
      cost += 0.01 * Math.max(0, 14 - (i + 2));
    }
    return cost;
  };
  const t0 = Date.now();
  let nodes = 0;
  const rec = (v) => {
    let i = 0;
    while (i < 13 && !v[i]) i++;
    if (i === 13) return { list: [], cost: 0 };
    const k = v.join(',');
    const hit = cache.get(k);
    if (hit) return hit;
    nodes++;
    const opts = [];
    const c = v[i];
    const R = SEQ[i];
    if (c >= 4) opts.push([TYPES.BOMB, R, [[i, c]]]);
    opts.push([TYPES.SINGLE, R, [[i, 1]]]);
    if (c >= 2) opts.push([TYPES.PAIR, R, [[i, 2]]]);
    if (c >= 3) opts.push([TYPES.TRIPLE, R, [[i, 3]]]);
    for (let j = 0; j < 13; j++) {
      if (j === i) continue;
      if (c >= 3 && v[j] >= 2) opts.push([TYPES.FULLHOUSE, R, [[i, 3], [j, 2]]]);
      if (c >= 2 && v[j] >= 3) opts.push([TYPES.FULLHOUSE, SEQ[j], [[j, 3], [i, 2]]]);
    }
    if (i + 4 < 13 && [1, 2, 3, 4].every((d) => v[i + d] >= 1)) opts.push([TYPES.STRAIGHT, SEQ[i + 4], [0, 1, 2, 3, 4].map((d) => [i + d, 1])]);
    if (i + 2 < 13 && c >= 2 && v[i + 1] >= 2 && v[i + 2] >= 2) opts.push([TYPES.PAIR_SEQ, SEQ[i + 2], [0, 1, 2].map((d) => [i + d, 2])]);
    if (i + 1 < 13 && c >= 3 && v[i + 1] >= 3) opts.push([TYPES.TRIPLE_SEQ, SEQ[i + 1], [[i, 3], [i + 1, 3]]]);
    let best = null;
    for (const [type, rank, used] of opts) {
      if (best && (Date.now() - t0 > 30 || nodes > 20000)) break; // 时间/节点上限
      const w = v.slice();
      for (const [j, n] of used) w[j] -= n;
      const r = rec(w);
      const cost = r.cost + costOf(type, used);
      if (!best || cost < best.cost - 1e-9) best = { list: [mk(type, rank, used.map(([j, n]) => [SEQ[j], n])), ...r.list], cost };
    }
    cache.set(k, best);
    return best;
  };
  const r = rec(cnt);
  const list = r.list.slice();
  let cost = r.cost;
  // 王：四王 = 炸；否则同王成对、单王各一手（控制牌 0.8）
  if (bj === 2 && rj === 2) { list.push({ combo: { type: TYPES.BOMB, rank: 'RJ' }, cards: [...card('BJ', 2), ...card('RJ', 2)] }); cost += 0.3; }
  else for (const [R, n] of [['BJ', bj], ['RJ', rj]]) {
    if (n === 2) { list.push(mk(TYPES.PAIR, R, [[R, 2]])); cost += 0.8; }
    else if (n === 1) { list.push(mk(TYPES.SINGLE, R, [[R, 1]])); cost += 0.8; }
  }
  for (let w = 0; w < wild; w++) { list.push({ combo: { type: TYPES.SINGLE, rank: lv }, cards: [{ rank: lv, suit: 'H' }] }); cost += 0.8; }
  const comps = list.map((m) => ({ move: m, key: comboKey(m), role: roleOf(m, lv), order: orderKey(m, lv) }));
  comps.sort((a, b) => a.order - b.order);
  return { comps, plays: comps.length, cost, counts: cnt0 };
}
