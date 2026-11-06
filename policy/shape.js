/**
 * 手牌“几手走完”估计 + 逢人配检测（供 decide / Jev 共用）。
 */
import { classify, TYPES, isBombLike } from '../engine/combos.js';
import { isWildCard } from '../engine/ranks.js';
import { generateCandidates } from '../search/index.js';

/** 领出时最少几手出完（1、2，否则 3 表示 ≥3）。 */
export function minPlays(hand, levelRank = '2') {
  if (!hand?.length) return 0;
  const whole = classify(hand, levelRank);
  if (whole && whole.type !== TYPES.PASS) return 1;
  if (hand.length > 16) return 3;
  let moves = [];
  try {
    moves = generateCandidates({ hand, previous: null, levelRank, leading: true });
  } catch {
    return 3;
  }
  for (const m of moves) {
    const ids = new Set(m.cards.map((c) => c.id));
    const rest = hand.filter((c) => !ids.has(c.id));
    if (!rest.length) return 1;
    const r = classify(rest, levelRank);
    if (r && r.type !== TYPES.PASS) return 2;
  }
  return 3;
}

export function restAfter(hand, move) {
  const ids = new Set((move?.cards || []).map((c) => c.id));
  return (hand || []).filter((c) => !ids.has(c.id));
}

export function usesWild(move, levelRank) {
  return (move?.cards || []).some((c) => isWildCard(c, levelRank));
}

/** 逢人配作“替身”（非按本点数使用）的张数：级牌单/对/三/炸全由级牌组成时为 0 */
export function wildFillers(move, levelRank) {
  const cs = move?.cards || [];
  const w = cs.filter((c) => isWildCard(c, levelRank)).length;
  if (!w) return 0;
  if (cs.every((c) => c.rank === levelRank)) return 0;
  return w;
}

export { isBombLike };
