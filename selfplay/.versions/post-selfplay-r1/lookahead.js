/**
 * Small lookahead for decide/Jev:
 *  - safety(move): can any active enemy beat this play? 'sure' (no) / 'likely' (only with a bomb) / null.
 *    Uses card counting (unseen = two decks − my hand − ctx.playedCards); conservative when nothing is known.
 *  - finishLine(hand): with the lead, can I go out via safe plays then a final play (≤ depth safe plays)?
 *  - winProb(move): rough probability no enemy beats the play (for "take control" decisions).
 * Pure functions, cached per decision; designed to stay well under 50ms.
 */
import { TYPES, isBombLike } from '../../../engine/combos.js';
import { RANKS, singleStrength, isWildCard } from '../../../engine/ranks.js';
import { generateCandidates } from '../../../search/index.js';
import { minPlays, restAfter } from './shape.js';
import { compareCombos } from '../../../engine/compare.js';

const ALL = [...RANKS, 'BJ', 'RJ'];

function unseenCounts(ctx) {
  const n = {};
  for (const r of RANKS) n[r] = 8;
  n.BJ = 2;
  n.RJ = 2;
  let levelHearts = 2;
  const lv = ctx.levelRank || '2';
  for (const c of [...(ctx.hand || []), ...(ctx.playedCards || [])]) {
    if (n[c.rank] != null) n[c.rank] -= 1;
    if (c.rank === lv && c.suit === 'H') levelHearts -= 1;
  }
  return { n, levelHearts: Math.max(0, levelHearts) };
}

function enemyCounts(ctx) {
  const seat = ctx.seat ?? 0;
  const counts = ctx.remainingSeatCounts || [];
  return [(seat + 1) % 4, (seat + 3) % 4].map((s) => (Number.isFinite(counts[s]) ? counts[s] : 27)).filter((x) => x > 0);
}

/** Number of unseen "units" that beat combo of given type/rank (ordinary only). */
function higherUnits(combo, ctx, U) {
  const lv = ctx.levelRank || '2';
  const st = (r) => singleStrength(r, lv);
  const s0 = st(combo.rank);
  const need = combo.type === TYPES.SINGLE ? 1 : combo.type === TYPES.PAIR ? 2 : combo.type === TYPES.TRIPLE ? 3 : 0;
  if (!need) return Infinity; // multi-card shapes: assume beatable (conservative)
  let h = 0;
  for (const r of ALL) {
    if (st(r) <= s0) continue;
    const have = U.n[r] || 0;
    const wild = r === 'BJ' || r === 'RJ' ? 0 : U.levelHearts;
    if (have >= need) h += have - need + 1;
    else if (have + wild >= need && have > 0) h += 1;
  }
  return h;
}

export function safety(move, ctx) {
  if (!move?.cards?.length) return null;
  const combo = move.combo;
  const enemies = enemyCounts(ctx);
  if (!enemies.length) return 'sure';
  const U = unseenCounts(ctx);
  const size = move.cards.length;
  let worst = 'sure';
  for (const n of enemies) {
    if (isBombLike(combo)) {
      const rocket = combo.type === TYPES.BOMB && (combo.rocket || combo.rank === 'RJ');
      if (!rocket && n >= 4) worst = 'likely';
      continue;
    }
    if (n >= size) {
      const h = higherUnits(combo, ctx, U);
      if (h > 0) return null;
    }
    if (n >= 4) worst = 'likely';
  }
  return worst;
}

/** rough P(no enemy beats this ordinary play) */
export function winProb(move, ctx) {
  const s = safety(move, ctx);
  if (s === 'sure') return 1;
  if (s === 'likely') return 0.85;
  const combo = move?.combo;
  if (!combo || isBombLike(combo)) return 0.8;
  const U = unseenCounts(ctx);
  const h = higherUnits(combo, ctx, U);
  if (!Number.isFinite(h)) return 0.3;
  const E = enemyCounts(ctx).reduce((a, b) => a + b, 0);
  const total = Object.values(U.n).reduce((a, b) => a + b, 0) || 1;
  const f = Math.min(0.95, E / total);
  return Math.pow(1 - f, h);
}

const ORDER = { sure: 2, likely: 1 };
function worse(a, b) {
  if (!a || !b) return null;
  return ORDER[a] <= ORDER[b] ? a : b;
}

/** With the lead and hand H, can I finish with ≤depth safe plays followed by one final play? */
export function finishLine(hand, ctx, depth = 2, cache = new Map()) {
  if (!hand.length) return 'sure';
  const lv = ctx.levelRank || '2';
  const key = hand.map((c) => c.id).sort().join(',') + '|' + depth;
  if (cache.has(key)) return cache.get(key);
  let res = null;
  if (minPlays(hand, lv) <= 1) res = 'sure';
  else if (depth > 0 && hand.length <= 12) {
    let moves = [];
    try {
      moves = generateCandidates({ hand, previous: null, levelRank: lv, leading: true }) || [];
    } catch {
      moves = [];
    }
    const sub = { ...ctx, hand };
    for (const m of moves) {
      if (!m.cards?.length || m.cards.length === hand.length) continue;
      // 敌家都很长（≥6）时不把“领炸弹”算作走完线的一步
      if (isBombLike(m.combo) && Math.min(...enemyCounts(ctx), 27) >= 6) continue;
      const s = safety(m, sub);
      if (!s) continue;
      const r = finishLine(restAfter(hand, m), ctx, depth - 1, cache);
      const t = worse(s, r);
      if (t && (!res || ORDER[t] > ORDER[res])) res = t;
      if (res === 'sure') break;
    }
  }
  cache.set(key, res);
  return res;
}

/**
 * Lookahead for one candidate: does playing it give me a forcing finish?
 * following → the move itself must win the trick (safety); leading → also must be safe (or empty the hand).
 */
export function moveFinish(move, ctx, cache) {
  if (!move?.cards?.length) return null;
  const hand = ctx.hand || [];
  const rest = restAfter(hand, move);
  if (!rest.length) return 'sure';
  if (rest.length > 12) return null; // 剩牌太多：不可能 ≤3 手走完，省时
  // 领出后只剩一手炸弹：本手被压可直接炸回走完（炸弹留作后手），记为 bombBack
  // （跟牌同理：本手被压就炸回走完）。炸弹先出、却留下更小的炸弹 → 顺序不对，降为 likely
  {
    const lv = ctx.levelRank || '2';
    const g = generateCandidates({ hand: rest, previous: null, levelRank: lv, leading: true }) || [];
    const restBomb = g.find((m) => m.cards.length === rest.length && isBombLike(m.combo));
    if (restBomb) {
      // 被压就炸回：前提是能压这手的敌人不会借此走完（敌人张数 ≤ 本手张数时他可直接出完）
      const em0 = Math.min(...enemyCounts(ctx), 27);
      const canGoOutOver = em0 <= 27 && enemyCounts(ctx).some((c) => c > 0 && c === move.cards.length) && safety(move, ctx) !== 'sure'; // 敌人恰好剩这么多张：可能同型压上直接走
      if (!isBombLike(move.combo) && !canGoOutOver) return 'bombBack';
      if (isBombLike(move.combo)) {
        if (compareCombos(restBomb.combo, move.combo, lv) > 0) return 'bombBack';
        return safety(move, ctx) ? 'likely' : null;
      }
    }
  }
  const s = safety(move, ctx);
  if (!s) return null;
  const r = finishLine(rest, ctx, rest.length <= 8 ? 2 : 1, cache);
  return worse(s, r);
}

/** After taking the lead with move, do I have something to feed a short partner (1: single, 2: pair or single)? */
export function feedAfter(move, ctx) {
  const seat = ctx.seat ?? 0;
  const pc = (ctx.remainingSeatCounts || [])[(seat + 2) % 4];
  if (!(pc === 1 || pc === 2)) return null;
  const rest = restAfter(ctx.hand || [], move);
  if (!rest.length) return null;
  const lv = ctx.levelRank || '2';
  const cnt = new Map();
  for (const c of rest) cnt.set(c.rank, (cnt.get(c.rank) || 0) + 1);
  const smallSingle = rest.some((c) => singleStrength(c.rank, lv) <= 8 && !isWildCard(c, lv));
  const pair = [...cnt.entries()].some(([r, n]) => n >= 2 && n < 4 && singleStrength(r, lv) <= 10);
  if (pc === 1 && smallSingle) return 'single';
  if (pc === 2 && (pair || smallSingle)) return pair ? 'pair' : 'single';
  return null;
}
