/**
 * 信念层：只做推断（余牌、关键牌、对手模型），不做决策。
 */
import { RANKS, JOKER_BLACK, JOKER_RED, isJokerRank, isWildCard } from '../engine/ranks.js';
import { makeDeck } from '../engine/cards.js';
import { TYPES } from '../engine/combos.js';

export const STYLES = ['tight', 'normal', 'loose', 'aggressive', 'conservative'];

const STYLE_PRIORS = {
  tight: { pass: 0.55, follow: 0.35, bomb: 0.1 },
  normal: { pass: 0.4, follow: 0.45, bomb: 0.15 },
  loose: { pass: 0.25, follow: 0.5, bomb: 0.25 },
  aggressive: { pass: 0.2, follow: 0.45, bomb: 0.35 },
  conservative: { pass: 0.6, follow: 0.32, bomb: 0.08 },
};

/**
 * 从已出牌统计全桌剩余张数（两副 108，按 rank:suit）。
 * @param {object[]} [playedCards]
 * @returns {Map<string, number>}
 */
export function remainingCardCounts(playedCards = []) {
  const total = new Map();
  for (const c of makeDeck()) {
    const k = `${c.rank}:${c.suit}`;
    total.set(k, (total.get(k) || 0) + 1);
  }
  for (const c of playedCards) {
    const k = `${c.rank}:${c.suit}`;
    if (total.has(k)) total.set(k, Math.max(0, total.get(k) - 1));
  }
  return total;
}

/**
 * 按点数统计余牌（每点起手 8，王各 2）。
 * @param {object[]} [playedCards]
 * @returns {Map<string, number>}
 */
export function remainingByRank(playedCards = []) {
  const m = new Map(RANKS.map((r) => [r, 8]));
  m.set(JOKER_BLACK, 2);
  m.set(JOKER_RED, 2);
  for (const c of playedCards) {
    m.set(c.rank, Math.max(0, (m.get(c.rank) || 0) - 1));
  }
  return m;
}

/**
 * 关键牌：2、级牌、大小王、已走炸弹。
 * @param {object[]} [playedCards]
 * @param {string} [levelRank]
 * @returns {{ twosLeft: number, levelLeft: number, wildsLeft: number, blackJokerLeft: number, redJokerLeft: number, bombsGone: number, levelRank: string }}
 */
export function trackKeyCards(playedCards = [], levelRank = '2') {
  let twos = 0;
  let levels = 0;
  let wilds = 0;
  let black = 0;
  let red = 0;
  let bombsGone = 0;
  for (const c of playedCards) {
    if (c.rank === '2') twos += 1;
    if (c.rank === levelRank && !isJokerRank(c.rank)) levels += 1;
    if (isWildCard(c, levelRank)) wilds += 1;
    if (c.rank === JOKER_BLACK) black += 1;
    if (c.rank === JOKER_RED) red += 1;
  }
  return {
    twosLeft: Math.max(0, 8 - twos),
    levelLeft: Math.max(0, 8 - levels),
    wildsLeft: Math.max(0, 2 - wilds),
    blackJokerLeft: Math.max(0, 2 - black),
    redJokerLeft: Math.max(0, 2 - red),
    bombsGone,
    levelRank,
  };
}

/**
 * 若 combo 为炸/同花顺则 bombsGone +1。
 * @param {object} keyState
 * @param {{ type: string }|null|undefined} combo
 * @returns {object}
 */
export function recordBombPlayed(keyState, combo) {
  const next = { ...keyState };
  if (combo && (combo.type === TYPES.BOMB || combo.type === TYPES.STRAIGHT_FLUSH)) {
    next.bombsGone = (next.bombsGone || 0) + 1;
  }
  return next;
}

/**
 * 各座位剩余张数。
 * @param {number[]} [startCounts]
 * @param {object[][]} [playedBySeat]
 * @returns {number[]}
 */
export function opponentRemainingCounts(startCounts = [27, 27, 27, 27], playedBySeat = [[], [], [], []]) {
  return startCounts.map((n, i) => Math.max(0, n - (playedBySeat[i]?.length || 0)));
}

/**
 * 简单启发式：根据最近动作更新过牌/跟牌/炸弹权重。
 * @param {{ pass: number, follow: number, bomb: number }} prior
 * @param {'pass'|'follow'|'bomb'} action
 * @returns {{ pass: number, follow: number, bomb: number }}
 */
export function updateActionWeights(prior, action) {
  const w = { ...prior };
  const lr = 0.12;
  if (action === 'pass') w.pass = Math.min(0.9, w.pass + lr);
  if (action === 'follow') w.follow = Math.min(0.9, w.follow + lr);
  if (action === 'bomb') w.bomb = Math.min(0.85, w.bomb + lr);
  const s = w.pass + w.follow + w.bomb;
  w.pass /= s;
  w.follow /= s;
  w.bomb /= s;
  return w;
}

/**
 * 风格先验。
 * @param {string} [style]
 * @returns {{ style: string, pass: number, follow: number, bomb: number }}
 */
export function stylePrior(style = 'normal') {
  const s = STYLES.includes(style) ? style : 'normal';
  return { style: s, ...STYLE_PRIORS[s] };
}

/**
 * 用历史动作更新对手模型。
 * @param {{ action?: string }[]} [history]
 * @param {string} [style]
 * @returns {{ style: string, pass: number, follow: number, bomb: number }}
 */
export function inferOpponentModel(history = [], style = 'normal') {
  let w = stylePrior(style);
  for (const ev of history) {
    if (ev?.action) w = { style: w.style, ...updateActionWeights(w, ev.action) };
  }
  return w;
}

/**
 * 组装信念：余牌、关键牌、对手模型。
 * @param {object} [ctx]
 * @returns {{ remainingByRank: object, remainingCounts: Map<string, number>, keyCards: object, opponentCounts: number[], models: object[] }}
 */
export function buildBelief(ctx = {}) {
  const played = ctx.playedCards || [];
  const bySeat = ctx.playedBySeat || [[], [], [], []];
  const start = ctx.startCounts || [27, 27, 27, 27];
  const keys = trackKeyCards(played, ctx.levelRank || '2');
  let bombs = keys;
  for (const t of ctx.tricks || []) bombs = recordBombPlayed(bombs, t.combo);
  return {
    remainingByRank: Object.fromEntries(remainingByRank(played)),
    remainingCounts: remainingCardCounts(played),
    keyCards: bombs,
    opponentCounts: opponentRemainingCounts(start, bySeat),
    models: [0, 1, 2, 3].map((seat) =>
      inferOpponentModel(ctx.histories?.[seat] || [], ctx.styles?.[seat] || 'normal'),
    ),
  };
}

