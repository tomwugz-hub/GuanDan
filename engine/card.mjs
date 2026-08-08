export const SUITS = Object.freeze({
  spades: "S",
  hearts: "H",
  clubs: "C",
  diamonds: "D",
  joker: "JOKER",
});

export const RANKS = Object.freeze([
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
  "2",
  "SJ",
  "BJ",
]);

export function createCard(rank, suit, deckIndex = 0) {
  return Object.freeze({ rank, suit, deckIndex });
}

export function isJoker(card) {
  return card.rank === "SJ" || card.rank === "BJ";
}

export function isWildCard(card, levelRank) {
  return card.rank === levelRank && card.suit === SUITS.hearts;
}

export function cardId(card) {
  // 王用 JK: 前缀，避免与黑桃 J（S+J → SJ#n）撞 id
  if (isJoker(card)) return `JK:${card.rank}#${card.deckIndex}`;
  return `${card.suit}${card.rank}#${card.deckIndex}`;
}

/** 出牌签名：与 serializeCoachAdvice、差异对比共用 */
export function playSignature(play) {
  if (!play) return "";
  const ids = (play.cards ?? []).map(cardId).sort().join("|");
  return `${play.type}:${ids}`;
}

export function cardLabel(card) {
  if (card.rank === "SJ") return "小王";
  if (card.rank === "BJ") return "大王";
  const suitLabels = {
    S: "黑桃",
    H: "红桃",
    C: "梅花",
    D: "方片",
  };
  return `${suitLabels[card.suit] ?? card.suit}${card.rank}`;
}

export function cardsLabel(cards) {
  return cards.map(cardLabel).join(" ");
}

/** 出牌所用牌必须来自手牌（按 cardId），逢人配也算手牌中的真牌 */
export function playUsesOnlyHandCards(hand, play) {
  if (!play) return false;
  const cards = play.cards ?? [];
  if (play.isPass || cards.length === 0) return true;
  const handIds = new Set(hand.map(cardId));
  const usedIds = new Set();
  for (const card of cards) {
    const id = cardId(card);
    if (!handIds.has(id) || usedIds.has(id)) return false;
    usedIds.add(id);
  }
  return true;
}

/** UI/教练展示：把手牌对象绑回 play.cards，避免 materialized 假牌或反序列化漂移 */
export function resolvePlayCardsFromHand(hand, play) {
  if (!play?.cards?.length) return [];
  const byId = new Map(hand.map((card) => [cardId(card), card]));
  const resolved = [];
  for (const card of play.cards) {
    const bound = byId.get(cardId(card));
    if (!bound) return [];
    resolved.push(bound);
  }
  return resolved;
}
