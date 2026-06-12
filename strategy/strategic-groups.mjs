import { SUITS, cardId, isJoker, isWildCard } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { rankPower } from "../engine/rank-order.mjs";
import { findNonOverlappingStraightFlushes } from "./straight-flush-arrange.mjs";

const CHAIN_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
/** 绕级顺 A2345 vs 高位顺 23456：同套可组时优先后者 + 留 A */
export const STRAIGHT_WRAP_KEY = "A-2-3-4-5";
export const STRAIGHT_HIGH_LOW_KEY = "2-3-4-5-6";
const OVERLAP_STRAIGHT_RANKS = ["A", "2", "3", "4", "5", "6"];
export const STRAIGHT_HIGH_OVER_WRAP_REASON = "23456比A2345大一级，留A控牌优于留6";
const NORMAL_SUITS = [SUITS.spades, SUITS.hearts, SUITS.clubs, SUITS.diamonds];

function groupByRank(cards) {
  const groups = new Map();
  for (const card of cards) {
    if (!groups.has(card.rank)) groups.set(card.rank, []);
    groups.get(card.rank).push(card);
  }
  return groups;
}

function sortByRankPower(cards, levelRank) {
  return [...cards].sort((left, right) => (
    rankPower(left.rank, levelRank) - rankPower(right.rank, levelRank)
    || left.suit.localeCompare(right.suit)
    || left.deckIndex - right.deckIndex
  ));
}

function cardIsUsed(card, usedIds) {
  return usedIds.has(cardId(card));
}

function availableCards(cards, usedIds) {
  return cards.filter((card) => !cardIsUsed(card, usedIds));
}

function markUsed(cards, usedIds) {
  for (const card of cards) usedIds.add(cardId(card));
}

function makeGroup(cards, levelRank, label) {
  const play = classifyPlay(cards, levelRank);
  if (play.type === PLAY_TYPES.invalid || play.type === PLAY_TYPES.pass) return null;
  return { cards, play, label, source: "auto-strategy" };
}

function addGroup(groups, usedIds, cards, levelRank, label) {
  const group = makeGroup(cards, levelRank, label);
  if (!group) return false;
  groups.push(group);
  markUsed(cards, usedIds);
  return true;
}

function chainWindows(length) {
  const windows = [];
  for (let start = 0; start + length <= CHAIN_RANKS.length; start += 1) {
    windows.push(CHAIN_RANKS.slice(start, start + length));
  }
  return windows;
}

/** 仅当该点恰好有两张可用牌时才抽对子，避免从三张/炸弹里硬抠「假连对」。 */
function cardsForExactPair(groupsByRank, rank, usedIds) {
  const cards = availableCards(groupsByRank.get(rank) ?? [], usedIds);
  if (cards.length !== 2) return null;
  return cards;
}

function cardsForRank(groupsByRank, rank, usedIds, count) {
  const cards = availableCards(groupsByRank.get(rank) ?? [], usedIds);
  if (cards.length < count) return null;
  return cards.slice(0, count);
}

function addSameRankGroups(groups, usedIds, groupsByRank, levelRank, count, labelPrefix) {
  const ranks = [...groupsByRank.keys()]
    .filter((rank) => rank !== "SJ" && rank !== "BJ")
    .sort((left, right) => rankPower(left, levelRank) - rankPower(right, levelRank));

  for (const rank of ranks) {
    const cards = cardsForRank(groupsByRank, rank, usedIds, count);
    if (!cards) continue;
    addGroup(groups, usedIds, cards, levelRank, `${labelPrefix} ${rank}`);
  }
}

function addConsecutivePairGroups(groups, usedIds, groupsByRank, levelRank) {
  for (const ranks of chainWindows(3)) {
    const picked = [];
    let possible = true;
    for (const rank of ranks) {
      const cards = cardsForExactPair(groupsByRank, rank, usedIds);
      if (!cards) {
        possible = false;
        break;
      }
      picked.push(...cards);
    }
    if (possible) addGroup(groups, usedIds, picked, levelRank, `连对 ${ranks.join("-")}`);
  }
}

function addPlaneGroups(groups, usedIds, groupsByRank, levelRank) {
  for (const ranks of chainWindows(2)) {
    const picked = [];
    let possible = true;
    for (const rank of ranks) {
      const cards = cardsForRank(groupsByRank, rank, usedIds, 3);
      if (!cards) {
        possible = false;
        break;
      }
      picked.push(...cards);
    }
    if (possible) addGroup(groups, usedIds, picked, levelRank, `钢板 ${ranks.join("-")}`);
  }
}

function tryStraightWindow(ranks, groupsByRank, usedIds) {
  const picked = [];
  let looseCardCount = 0;
  for (const rank of ranks) {
    const available = availableCards(groupsByRank.get(rank) ?? [], usedIds);
    if (available.length < 1) return null;
    if (available.length === 1) looseCardCount += 1;
    picked.push(available[0]);
  }
  if (looseCardCount < 3) return null;
  return { ranks, picked };
}

/** 手牌是否同时含 A~6，可组绕级顺或 23456（仅留 A 或留 6 之差） */
export function handHasOverlappingLowStraightChoice(hand, levelRank) {
  const counts = new Map();
  for (const card of hand) {
    if (isJoker(card) || isWildCard(card, levelRank)) continue;
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }
  return OVERLAP_STRAIGHT_RANKS.every((rank) => (counts.get(rank) ?? 0) >= 1);
}

export function straightLabelKey(label) {
  const match = String(label ?? "").match(/顺子\s+([\dA-JQK-]+)/);
  return match ? match[1] : null;
}

export function isWrapStraightLabel(label) {
  return straightLabelKey(label) === STRAIGHT_WRAP_KEY;
}

export function isHighLowStraightLabel(label) {
  return straightLabelKey(label) === STRAIGHT_HIGH_LOW_KEY;
}

function addStraightGroups(groups, usedIds, groupsByRank, levelRank) {
  const canFormHighLow = tryStraightWindow(
    STRAIGHT_HIGH_LOW_KEY.split("-"),
    groupsByRank,
    usedIds,
  );

  for (const ranks of chainWindows(5)) {
    const key = ranks.join("-");
    if (key === STRAIGHT_WRAP_KEY && canFormHighLow) continue;

    const attempt = tryStraightWindow(ranks, groupsByRank, usedIds);
    if (attempt) {
      addGroup(groups, usedIds, attempt.picked, levelRank, `顺子 ${attempt.ranks.join("-")}`);
    }
  }
}

function addBombGroups(groups, usedIds, groupsByRank, levelRank, minimumCount = 4) {
  const ranks = [...groupsByRank.keys()]
    .filter((rank) => rank !== "SJ" && rank !== "BJ")
    .sort((left, right) => (
      (groupsByRank.get(right)?.length ?? 0) - (groupsByRank.get(left)?.length ?? 0)
      || rankPower(right, levelRank) - rankPower(left, levelRank)
    ));

  for (const rank of ranks) {
    const cards = availableCards(groupsByRank.get(rank) ?? [], usedIds);
    if (cards.length < minimumCount) continue;
    const keepCount = cards.length >= 5 ? 4 : cards.length;
    addGroup(groups, usedIds, cards.slice(0, keepCount), levelRank, `炸弹 ${rank}`);
  }
}

export function buildStrategicGroups(hand, levelRank, { skipStraightFlush = false } = {}) {
  const sortedHand = sortByRankPower(hand, levelRank);
  const nonJokers = sortedHand.filter((card) => !isJoker(card) && !isWildCard(card, levelRank));
  const jokers = sortedHand.filter((card) => isJoker(card));
  const groupsByRank = groupByRank(nonJokers);
  const usedIds = new Set();
  const groups = [];

  if (jokers.length === 4) addGroup(groups, usedIds, jokers, levelRank, "天王炸");

  if (!skipStraightFlush) {
    const straightFlushes = findNonOverlappingStraightFlushes(
      sortedHand.filter((card) => !cardIsUsed(card, usedIds)),
      levelRank,
    );
    for (const straightFlush of straightFlushes) {
      addGroup(groups, usedIds, straightFlush.cards, levelRank, `同花顺 ${straightFlush.suit}`);
    }
  }

  addBombGroups(groups, usedIds, groupsByRank, levelRank, 5);
  addBombGroups(groups, usedIds, groupsByRank, levelRank, 4);
  addPlaneGroups(groups, usedIds, groupsByRank, levelRank);
  addConsecutivePairGroups(groups, usedIds, groupsByRank, levelRank);
  addStraightGroups(groups, usedIds, groupsByRank, levelRank);
  addSameRankGroups(groups, usedIds, groupsByRank, levelRank, 3, "三张");
  addSameRankGroups(groups, usedIds, groupsByRank, levelRank, 2, "对子");

  return groups;
}
