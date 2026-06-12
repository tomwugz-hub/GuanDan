import { RANKS } from "./card.mjs";

const BASE_RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const DISPLAY_RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "SJ", "BJ"];

export function rankOrder(levelRank) {
  const normalRanks = BASE_RANKS.filter((rank) => RANKS.includes(rank));
  const withoutLevel = normalRanks.filter((rank) => rank !== levelRank);
  return [...withoutLevel, levelRank, "SJ", "BJ"];
}

export function rankPower(rank, levelRank) {
  const order = rankOrder(levelRank);
  const index = order.indexOf(rank);
  if (index === -1) {
    throw new Error(`Unknown rank: ${rank}`);
  }
  return index;
}

export function compareRanks(leftRank, rightRank, levelRank) {
  return rankPower(leftRank, levelRank) - rankPower(rightRank, levelRank);
}

/** 是否为本局控权大牌：级牌、王，或点数不低于级牌 */
export function isControlRank(rank, levelRank) {
  if (rank === "SJ" || rank === "BJ") return true;
  return compareRanks(rank, levelRank, levelRank) >= 0;
}

export function sortCards(cards, levelRank) {
  return [...cards].sort((left, right) => {
    const rankDiff = rankPower(left.rank, levelRank) - rankPower(right.rank, levelRank);
    if (rankDiff !== 0) return rankDiff;
    return left.suit.localeCompare(right.suit) || left.deckIndex - right.deckIndex;
  });
}

export function sortCardsForDisplay(cards) {
  return [...cards].sort((left, right) => {
    const rankDiff = DISPLAY_RANKS.indexOf(left.rank) - DISPLAY_RANKS.indexOf(right.rank);
    if (rankDiff !== 0) return rankDiff;
    return left.suit.localeCompare(right.suit) || left.deckIndex - right.deckIndex;
  });
}
