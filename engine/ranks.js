/**
 * 掼蛋点数与级牌顺序。
 * 单张大小：红Joker > 黑Joker > 级牌 > A > K > … > 3 > 2（2 为级牌时除外）。
 * 逢人配：仅红桃级牌（suit === 'H'）可替其他点数；两副牌最多两张。其余花色级牌只是普通级牌。王牌不是逢人配。
 */

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const JOKER_BLACK = 'BJ';
export const JOKER_RED = 'RJ';
export const SUITS = ['S', 'H', 'D', 'C'];

/** 顺子/连对/钢板用的自然点数链（不含王牌）。A 作链顶在此链中；A 作 1（A2345 等）见 seqWindows。 */
export const SEQ_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/**
 * 连牌窗口（顺子/同花顺/连对/钢板）。官方规则：A 可作 1 当链底（A2345、AA2233、AAA222），
 * 也可作链顶（10JQKA）；不允许绕圈（QKA23、JQKA2）。A 作 1 的窗口放在最后，使配牌歧义时优先较大的自然窗口。
 * @param {number} len
 * @returns {string[][]}
 */
export function seqWindows(len) {
  const out = [];
  for (let s = 0; s + len <= SEQ_RANKS.length; s++) out.push(SEQ_RANKS.slice(s, s + len));
  if (len >= 2) out.push(['A', ...SEQ_RANKS.slice(0, len - 1)]);
  return out;
}

/**
 * 是否王牌点数。
 * @param {string} rank
 * @returns {boolean}
 */
export function isJokerRank(rank) {
  return rank === JOKER_BLACK || rank === JOKER_RED;
}

/**
 * 是否逢人配：仅红桃当前级牌。王牌不是逢人配。
 * @param {{ rank: string, suit: string }} card
 * @param {string} levelRank
 * @returns {boolean}
 */
export function isWildCard(card, levelRank) {
  return !isJokerRank(card.rank) && card.rank === levelRank && card.suit === 'H';
}

/**
 * 单张比较用的数值，越大越大。级牌高于 A、低于王牌。
 * @param {string} rank
 * @param {string} levelRank
 * @returns {number}
 * @throws {Error} 未知点数
 */
export function singleStrength(rank, levelRank) {
  if (rank === JOKER_RED) return 100;
  if (rank === JOKER_BLACK) return 99;
  if (rank === levelRank) return 80;
  const i = RANKS.indexOf(rank);
  if (i < 0) throw new Error(`未知点数: ${rank}`);
  return i; // 2=0 … A=12
}

/**
 * 顺子链下标（2=0 … A=12）。
 * @param {string} rank
 * @returns {number}
 * @throws {Error} 王牌或不在链上
 */
export function seqIndex(rank) {
  const i = SEQ_RANKS.indexOf(rank);
  if (i < 0) throw new Error(`不能进入顺子链: ${rank}`);
  return i;
}

/**
 * 下一级牌；已是 A 则仍为 A。
 * @param {string} levelRank
 * @returns {string}
 */
export function nextLevelRank(levelRank) {
  if (levelRank === 'A') return 'A';
  const i = RANKS.indexOf(levelRank);
  return RANKS[i + 1];
}

/**
 * 校验并返回级牌。
 * @param {string} levelRank
 * @returns {string}
 * @throws {Error} 非法级牌
 */
export function parseLevel(levelRank) {
  if (!RANKS.includes(levelRank)) throw new Error(`非法级牌: ${levelRank}`);
  return levelRank;
}
