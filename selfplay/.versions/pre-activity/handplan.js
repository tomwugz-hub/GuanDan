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
