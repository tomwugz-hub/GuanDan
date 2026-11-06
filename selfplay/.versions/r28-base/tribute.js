/**
 * 还贡选牌（decide 风格启发式）。进贡牌是强制的（engine/tributeStd.tributeCard）。
 * chooseReturn(hand, { lv, to, seat, received }, variant)
 *  - 'min'：最小的可还牌（基线）
 *  - 'plan'（默认）：还掉后 handplan.decomposeCounts 代价最小的牌（不拆对/顺/炸、优先孤单小牌），平局还小的；
 *    级牌（任何花色）规则上不可还（engine/tributeStd.isReturnEligible，2026-10-21 修）；下面的 nonLevel 过滤只在兜底（无 ≤10 非级牌）时起作用
 * 进贡还贡 A/B（selfplay/PROGRESS.md）：plan vs min +0.106 [0.050, 0.163]；已删除的 planfeed（plan + 按点数的“喂牌”修正，
 * 还给对家时反向）vs plan −0.009 [−0.060, 0.041]、vs min +0.114 → 无额外收益，删除。
 * 级牌排除（修 bug）vs 不排除 −0.001 [−0.022, 0.020]（中性，已删旧行为）；修后 plan vs min 新种子 +0.097 [0.037, 0.156]。
 */
import { decomposeCounts } from './handplan.js';
import { returnOptions } from '../../../engine/tributeStd.js';
import { singleStrength } from '../../../engine/ranks.js';

export const RETURN_VARIANTS = ['min', 'plan'];
export const DEFAULT_RETURN = 'plan';

export function chooseReturn(hand, info = {}, variant = DEFAULT_RETURN) {
  const lv = info.lv || '2';
  const { cards } = returnOptions(hand, lv);
  if (!cards.length) return null;
  const minOf = (arr) => arr.reduce((b, c) => (!b || singleStrength(c.rank, lv) < singleStrength(b.rank, lv) ? c : b), null);
  if (variant === 'min' || cards.length === 1) return minOf(cards);
  // 每个点数取一张代表（decomposeCounts 不看花色）
  const byRank = new Map();
  const nonLevel = cards.filter((c) => c.rank !== lv);
  const pool = nonLevel.length ? nonLevel : cards;
  for (const c of pool) if (!byRank.has(c.rank)) byRank.set(c.rank, c);
  const cache = new Map();
  let best = null;
  for (const c of byRank.values()) {
    const rest = hand.filter((x) => x.id !== c.id);
    const s = decomposeCounts(rest, lv, cache).cost;
    const str = singleStrength(c.rank, lv);
    if (!best || s < best.s - 1e-9 || (Math.abs(s - best.s) <= 1e-9 && str < best.str)) best = { c, s, str };
  }
  return best.c;
}
