/**
 * 搜索层：只枚举/搜索合法着法，不做最终排序决策。
 */
import { legalMoves } from '../engine/legal.js';
import { classify, TYPES, isBombLike } from '../engine/combos.js';
import { beats } from '../engine/compare.js';
import { isJokerRank, isWildCard, SEQ_RANKS, seqWindows } from '../engine/ranks.js';

function uniqueMoves(moves) {
  const seen = new Set();
  return moves.filter((m) => {
    const key = m.cards.map((c) => c.id).sort().join(',') + ':' + (m.combo?.type || '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function emitIf(hand, cards, previous, levelRank, leading, out) {
  const combo = classify(cards, levelRank);
  if (!combo || combo.type === TYPES.PASS) return;
  if (leading || !previous || previous.type === TYPES.PASS || beats(combo, previous, levelRank)) {
    out.push({ cards, combo });
  }
}

/**
 * 补全连对（恰好 3 对）与钢板（恰好 2 组三条）。
 * 5 张顺/同花顺与三带二由 legalMoves 生成，此处不再重复。
 * @param {object[]} hand
 * @param {object|null} previous
 * @param {string} levelRank
 * @param {boolean} leading
 * @returns {{ cards: object[], combo: object }[]}
 */
export function extraStructureMoves(hand, previous, levelRank, leading) {
  const out = [];
  const wilds = hand.filter((c) => !isJokerRank(c.rank) && isWildCard(c, levelRank));
  const byRank = new Map();
  for (const c of hand) {
    if (isJokerRank(c.rank)) continue;
    if (isWildCard(c, levelRank)) continue;
    if (!byRank.has(c.rank)) byRank.set(c.rank, []);
    byRank.get(c.rank).push(c);
  }
  const pick = (rank, n, used) => {
    const arr = (byRank.get(rank) || []).filter((c) => !used.has(c.id));
    return arr.slice(0, n);
  };

  const tryWindow = (win, copies) => {
    const used = new Set();
    const cards = [];
    let need = 0;
    for (const r of win) {
      const got = pick(r, copies, used);
      got.forEach((c) => used.add(c.id));
      cards.push(...got);
      need += copies - got.length;
    }
    if (need > wilds.length) return;
    cards.push(...wilds.slice(0, need));
    emitIf(hand, cards, previous, levelRank, leading, out);
  };

  // 连对：恰好 3 对（6 张）
  for (const win of seqWindows(3)) tryWindow(win, 2);
  // 钢板：恰好 2 组三条（6 张）
  for (const win of seqWindows(2)) tryWindow(win, 3);
  return uniqueMoves(out);
}

/**
 * 合法着法 + 结构补全。
 * @param {{ hand?: object[], previous?: object|null, levelRank?: string, leading?: boolean }} ctx
 * @returns {{ cards: object[], combo: object }[]}
 */
export function generateCandidates(ctx) {
  const hand = ctx.hand || [];
  const previous = ctx.previous || null;
  const levelRank = ctx.levelRank || '2';
  const leading = Boolean(ctx.leading);
  const base = legalMoves(hand, previous, levelRank, leading);
  const extra = extraStructureMoves(hand, previous, levelRank, leading);
  return uniqueMoves(base.concat(extra));
}

/**
 * 浅启发式分（搜索用，不做最终决策）。
 * @param {{ combo?: object, cards?: object[] }|null} move
 * @param {{ hand?: object[] }} [ctx]
 * @returns {number}
 */
export function heuristicEval(move, ctx = {}) {
  if (!move || !move.combo) return -1e9;
  const c = move.combo;
  if (c.type === TYPES.PASS) return 0;
  let v = (c.size || 0) * 2;
  if (isBombLike(c)) v += 8 + (c.bombSize || 5);
  if (c.type === TYPES.PAIR_SEQ || c.type === TYPES.TRIPLE_SEQ) v += 12;
  if (c.type === TYPES.STRAIGHT) v += 6;
  if ((ctx.hand?.length || 0) === c.size) v += 80;
  return v;
}

function cloneCtx(ctx, move) {
  const hand = (ctx.hand || []).filter((c) => !move.cards.some((x) => x.id === c.id));
  return { ...ctx, hand, leading: false, previous: move.combo };
}

/**
 * 短 rollout：只前进几步启发式，不改变策略层结论权重。
 * @param {object} ctx
 * @param {{ cards: object[], combo: object }} move
 * @param {number} [depth]
 * @returns {number}
 */
export function shortRollout(ctx, move, depth = 2) {
  let score = heuristicEval(move, ctx);
  let cur = cloneCtx(ctx, move);
  for (let d = 0; d < depth; d++) {
    const cands = generateCandidates(cur);
    if (!cands.length) break;
    let best = cands[0];
    let bestV = heuristicEval(best, cur);
    for (const m of cands) {
      const v = heuristicEval(m, cur);
      if (v > bestV) {
        bestV = v;
        best = m;
      }
    }
    score += bestV * 0.3;
    if (best.combo?.type === TYPES.PASS) break;
    cur = cloneCtx(cur, best);
  }
  return score;
}

/**
 * 窄束搜索，返回按启发式排序的前 beam 着。
 * @param {object} ctx
 * @param {{ beam?: number, timeMs?: number }} [opts]
 * @returns {{ move: object, value: number }[]}
 */
export function beamSearch(ctx, { beam = 8, timeMs = 35 } = {}) {
  const t0 = Date.now();
  const cands = generateCandidates(ctx);
  const scored = [];
  for (const m of cands) {
    if (Date.now() - t0 > timeMs) break;
    scored.push({ move: m, value: shortRollout(ctx, m, 1) });
  }
  scored.sort((a, b) => b.value - a.value);
  return scored.slice(0, beam);
}

/**
 * generateCandidates 别名。
 * @param {object} ctx
 * @returns {{ cards: object[], combo: object }[]}
 */
export function allLegal(ctx) {
  return generateCandidates(ctx);
}
