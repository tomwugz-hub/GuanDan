/**
 * 掼蛋牌型比较。
 * 普通牌型只能压同型同长度。
 * 炸弹/同花顺可压普通牌。
 * 炸弹层级：5 炸 < 同花顺 < 6 炸；同长度炸弹比点数；同花顺比最大点。
 */
import { TYPES, isBombLike } from './combos.js';
import { singleStrength, SEQ_RANKS } from './ranks.js';

/**
 * 炸弹“重量”：同花顺记 5.5；5 炸 < 同花顺 < 6 炸。
 * @param {{ type: string, bombSize?: number, size?: number }|null|undefined} combo
 * @returns {number}
 */
export function bombWeight(combo) {
  if (!combo) return 0;
  // 天王炸（四王）为最大炸弹，压一切炸弹与同花顺
  if (combo.type === TYPES.BOMB && (combo.rocket || combo.rank === 'RJ')) return 100;
  if (combo.type === TYPES.STRAIGHT_FLUSH) return 5.5;
  if (combo.type === TYPES.BOMB) return combo.bombSize ?? combo.size;
  return 0;
}

/**
 * 比较两个点数（含级牌/王牌）。
 * @param {string} aRank
 * @param {string} bRank
 * @param {string} levelRank
 * @returns {number}
 * @throws {Error} 未知点数
 */
export function compareRank(aRank, bRank, levelRank) {
  return singleStrength(aRank, levelRank) - singleStrength(bRank, levelRank);
}

/**
 * 比较两手牌型。不同类型且皆非炸则 NaN。
 * @param {object|null|undefined} a
 * @param {object|null|undefined} b
 * @param {string} levelRank
 * @returns {number} 正数 a 大于 b，负数 a 小于 b，0 相等；不可比则为 NaN
 */
const SEQ_TYPES = new Set([TYPES.STRAIGHT, TYPES.STRAIGHT_FLUSH, TYPES.PAIR_SEQ, TYPES.TRIPLE_SEQ]);
/** 连牌按自然顺序比链顶（A2345 链顶为 5，最小；10JQKA 最大）；级牌在连牌中不升级。 */
function compareHead(a, b, levelRank) {
  if (SEQ_TYPES.has(a.type) && a.type === b.type) return SEQ_RANKS.indexOf(a.rank) - SEQ_RANKS.indexOf(b.rank);
  return compareRank(a.rank, b.rank, levelRank);
}

export function compareCombos(a, b, levelRank) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  if (a.type === TYPES.PASS && b.type === TYPES.PASS) return 0;
  if (a.type === TYPES.PASS) return -1;
  if (b.type === TYPES.PASS) return 1;

  const aB = isBombLike(a);
  const bB = isBombLike(b);

  if (aB && bB) {
    const dw = bombWeight(a) - bombWeight(b);
    if (dw !== 0) return dw;
    return compareHead(a, b, levelRank);
  }
  if (aB && !bB) return 1;
  if (!aB && bB) return -1;

  if (a.type !== b.type) return NaN;
  if ((a.length ?? a.size) !== (b.length ?? b.size)) return NaN;
  if (a.size !== b.size && a.type !== TYPES.BOMB) return NaN;
  return compareHead(a, b, levelRank);
}

/**
 * a 能否压过 b（b 为桌上牌；领出时 b 为 null）。
 * @param {object|null|undefined} a
 * @param {object|null|undefined} b
 * @param {string} levelRank
 * @returns {boolean}
 */
export function beats(a, b, levelRank) {
  if (!a || a.type === TYPES.PASS) return false;
  if (!b || b.type === TYPES.PASS) return true;
  const c = compareCombos(a, b, levelRank);
  if (Number.isNaN(c)) return false;
  return c > 0;
}
