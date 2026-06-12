import { isJoker, isWildCard } from "./card.mjs";
import { PLAY_TYPES } from "./play-types.mjs";
import { rankPower } from "./rank-order.mjs";

const NORMAL_RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
const CHAIN_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const NORMAL_SUITS = ["S", "H", "C", "D"];

function countByRank(cards) {
  const counts = new Map();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }
  return counts;
}

function isSameSuit(cards) {
  return cards.length > 0 && cards.every((card) => card.suit === cards[0].suit);
}

function rankSetKey(ranks) {
  return [...ranks].sort().join("|");
}

function sequenceWindows(length) {
  const windows = [];
  for (let start = 0; start + length <= CHAIN_RANKS.length; start += 1) {
    windows.push(CHAIN_RANKS.slice(start, start + length));
  }
  return windows;
}

function sequenceInfo(ranks) {
  if (ranks.includes("SJ") || ranks.includes("BJ")) return null;
  const key = rankSetKey(ranks);
  const windows = sequenceWindows(ranks.length);
  const index = windows.findIndex((window) => rankSetKey(window) === key);
  if (index === -1) return null;
  const window = windows[index];
  return {
    mainRank: window[window.length - 1],
    power: index,
  };
}

function invalid(cards, reason) {
  return {
    type: PLAY_TYPES.invalid,
    cards,
    mainRank: null,
    length: cards.length,
    power: -1,
    reason,
  };
}

function play(type, cards, mainRank, levelRank, extra = {}) {
  return {
    type,
    cards,
    mainRank,
    length: cards.length,
    power: rankPower(mainRank, levelRank),
    ...extra,
  };
}

function typePriority(type) {
  switch (type) {
    case PLAY_TYPES.jokerBomb:
      return 90;
    case PLAY_TYPES.bomb:
      return 80;
    case PLAY_TYPES.straightFlush:
      return 70;
    case PLAY_TYPES.tripleWithPair:
      return 60;
    case PLAY_TYPES.plane:
      return 50;
    case PLAY_TYPES.consecutivePairs:
      return 40;
    case PLAY_TYPES.straight:
      return 30;
    case PLAY_TYPES.triple:
      return 20;
    case PLAY_TYPES.pair:
      return 10;
    case PLAY_TYPES.single:
      return 5;
    default:
      return 0;
  }
}

function betterPlay(left, right) {
  if (!left || left.type === PLAY_TYPES.invalid) return right;
  if (!right || right.type === PLAY_TYPES.invalid) return left;

  const priorityDiff = typePriority(right.type) - typePriority(left.type);
  if (priorityDiff > 0) return right;
  if (priorityDiff < 0) return left;

  if ((right.bombSize ?? 0) > (left.bombSize ?? 0)) return right;
  if ((right.bombSize ?? 0) < (left.bombSize ?? 0)) return left;
  if (right.power > left.power) return right;
  return left;
}

function classifyNaturalPlay(cards, levelRank, originalCards = cards, wildcardAssignments = []) {
  if (cards.length === 0) {
    return {
      type: PLAY_TYPES.pass,
      cards: originalCards,
      mainRank: null,
      length: 0,
      power: -1,
      isPass: true,
    };
  }

  const counts = countByRank(cards);
  const entries = [...counts.entries()];
  const uniqueRanks = entries.map(([rank]) => rank);
  const countValues = entries.map(([, count]) => count).sort((left, right) => right - left);

  if (cards.length === 4 && cards.every(isJoker)) {
    return {
      type: PLAY_TYPES.jokerBomb,
      cards: originalCards,
      mainRank: "BJ",
      length: cards.length,
      power: Number.POSITIVE_INFINITY,
      wildcardAssignments,
    };
  }

  if (cards.length === 1) return play(PLAY_TYPES.single, originalCards, cards[0].rank, levelRank, { wildcardAssignments });
  if (cards.length === 2 && entries.length === 1) return play(PLAY_TYPES.pair, originalCards, entries[0][0], levelRank, { wildcardAssignments });
  if (cards.length === 3 && entries.length === 1) return play(PLAY_TYPES.triple, originalCards, entries[0][0], levelRank, { wildcardAssignments });

  if (cards.length >= 4 && entries.length === 1) {
    return play(PLAY_TYPES.bomb, originalCards, entries[0][0], levelRank, { bombSize: cards.length, wildcardAssignments });
  }

  if (cards.length === 5 && countValues[0] === 3 && countValues[1] === 2) {
    const tripleRank = entries.find(([, count]) => count === 3)[0];
    return play(PLAY_TYPES.tripleWithPair, originalCards, tripleRank, levelRank, { wildcardAssignments });
  }

  if (cards.length === 5 && uniqueRanks.length === 5) {
    const sequence = sequenceInfo(uniqueRanks);
    if (!sequence) return invalid(originalCards, "Cards do not match a supported play type.");
    const highestRank = sequence.mainRank;
    const type = isSameSuit(cards) ? PLAY_TYPES.straightFlush : PLAY_TYPES.straight;
    return play(type, originalCards, highestRank, levelRank, { power: sequence.power, wildcardAssignments });
  }

  if (cards.length === 6 && entries.every(([, count]) => count === 2)) {
    const ranks = entries.map(([rank]) => rank);
    const sequence = sequenceInfo(ranks);
    if (sequence) {
      return play(PLAY_TYPES.consecutivePairs, originalCards, sequence.mainRank, levelRank, { power: sequence.power, chainLength: ranks.length, wildcardAssignments });
    }
  }

  if (cards.length === 6 && entries.every(([, count]) => count === 3)) {
    const ranks = entries.map(([rank]) => rank);
    const sequence = sequenceInfo(ranks);
    if (sequence) {
      return play(PLAY_TYPES.plane, originalCards, sequence.mainRank, levelRank, { power: sequence.power, chainLength: ranks.length, wildcardAssignments });
    }
  }

  return invalid(originalCards, "Cards do not match a supported play type.");
}

function replacementCardsForWildCard(wildCard, levelRank) {
  return NORMAL_RANKS.map((rank) => {
    if (rank === levelRank) {
      return NORMAL_SUITS.map((suit) => ({ rank, suit, deckIndex: wildCard.deckIndex }));
    }
    return NORMAL_SUITS.map((suit) => ({ rank, suit, deckIndex: wildCard.deckIndex }));
  }).flat();
}

function classifyWithWildCards(cards, levelRank) {
  const wildCardIndexes = cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => isWildCard(card, levelRank));

  let best = null;

  function walk(position, materializedCards, wildcardAssignments) {
    if (position === wildCardIndexes.length) {
      best = betterPlay(best, classifyNaturalPlay(materializedCards, levelRank, cards, wildcardAssignments));
      return;
    }

    const { card: wildCard, index } = wildCardIndexes[position];
    for (const replacement of replacementCardsForWildCard(wildCard, levelRank)) {
      const nextCards = [...materializedCards];
      nextCards[index] = replacement;
      walk(position + 1, nextCards, [
        ...wildcardAssignments,
        {
          wildcardIndex: index,
          from: wildCard,
          as: replacement,
        },
      ]);
    }
  }

  walk(0, [...cards], []);
  return best ?? invalid(cards, "Wildcard cards could not form a supported play type.");
}

export function classifyPlay(cards, levelRank) {
  if (cards.length === 1) {
    return classifyNaturalPlay(cards, levelRank);
  }

  if (cards.some((card) => isWildCard(card, levelRank))) {
    return classifyWithWildCards(cards, levelRank);
  }

  return classifyNaturalPlay(cards, levelRank);
}
