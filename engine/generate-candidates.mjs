import { classifyPlay } from "./classify-play.mjs";
import { canBeat } from "./compare-play.mjs";
import { cardId, isWildCard } from "./card.mjs";
import { PLAY_TYPES } from "./play-types.mjs";
import { rankPower } from "./rank-order.mjs";
import { enumerateStraightFlushCandidates } from "../strategy/straight-flush-arrange.mjs";

const CHAIN_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const NORMAL_SUITS = ["S", "H", "C", "D"];

function groupByRank(cards) {
  const groups = new Map();
  for (const card of cards) {
    if (!groups.has(card.rank)) groups.set(card.rank, []);
    groups.get(card.rank).push(card);
  }
  return groups;
}

function combinations(items, size, limit = 8) {
  const result = [];
  let stopped = false;

  function walk(start, picked) {
    if (stopped) return;
    if (picked.length === size) {
      result.push(picked);
      if (result.length >= limit) stopped = true;
      return;
    }

    for (let index = start; index < items.length; index += 1) {
      walk(index + 1, [...picked, items[index]]);
      if (stopped) return;
    }
  }

  walk(0, []);
  return result;
}

function chainWindows(minLength, maxLength) {
  const ranks = CHAIN_RANKS;
  const windows = [];
  for (let length = minLength; length <= maxLength; length += 1) {
    for (let start = 0; start + length <= ranks.length; start += 1) {
      windows.push(ranks.slice(start, start + length));
    }
  }
  return windows;
}

function naturalCardsForRank(groups, rank) {
  return groups.get(rank) ?? [];
}

function buildSameRankCombos(groups, wildCards, rank, size, comboLimit = 5) {
  const naturalCards = naturalCardsForRank(groups, rank);
  const combos = [];

  for (let naturalCount = Math.min(size, naturalCards.length); naturalCount >= 0; naturalCount -= 1) {
    const wildCount = size - naturalCount;
    if (wildCount > wildCards.length) continue;
    for (const naturalCombo of combinations(naturalCards, naturalCount, 3)) {
      for (const wildCombo of combinations(wildCards, wildCount, 2)) {
        combos.push([...naturalCombo, ...wildCombo]);
        if (combos.length >= comboLimit) return combos;
      }
    }
  }

  return combos;
}

/** 同点炸弹：从四炸到满张均生成；有纯四炸时优先生成不含逢人配的组合 */
function addBombCandidatesForRank(candidates, groups, wildCards, rank, levelRank) {
  const naturalCards = naturalCardsForRank(groups, rank);
  const maxSize = naturalCards.length + wildCards.length;
  if (maxSize < 4) return;

  for (let size = 4; size <= maxSize; size += 1) {
    const comboLimit = size === 4 && naturalCards.length >= 4 ? 8 : 5;
    for (const combo of buildSameRankCombos(groups, wildCards, rank, size, comboLimit)) {
      candidates.push(classifyPlay(combo, levelRank));
    }
  }
}

function subtractCards(source, cardsToRemove) {
  const remaining = [...source];
  for (const card of cardsToRemove) {
    const index = remaining.indexOf(card);
    if (index !== -1) remaining.splice(index, 1);
  }
  return remaining;
}

function buildChainCombos(groups, wildCards, ranks, perRank, maxResults = 18) {
  const results = [];

  function walk(rankIndex, pickedCards, remainingWildCards) {
    if (results.length >= maxResults) return;
    if (rankIndex === ranks.length) {
      results.push(pickedCards);
      return;
    }

    const rank = ranks[rankIndex];
    const naturalCards = naturalCardsForRank(groups, rank);

    for (let naturalCount = Math.min(perRank, naturalCards.length); naturalCount >= 0; naturalCount -= 1) {
      const wildCount = perRank - naturalCount;
      if (wildCount > remainingWildCards.length) continue;

      for (const naturalCombo of combinations(naturalCards, naturalCount, 2)) {
        for (const wildCombo of combinations(remainingWildCards, wildCount, 2)) {
          walk(rankIndex + 1, [...pickedCards, ...naturalCombo, ...wildCombo], subtractCards(remainingWildCards, wildCombo));
          if (results.length >= maxResults) return;
        }
      }
    }
  }

  walk(0, [], wildCards);
  return results;
}

function addComplexCandidates(candidates, groups, wildCards, levelRank, {
  includeTripleWithPair = true,
  includeStraight = true,
  includeConsecutivePairs = true,
  includePlane = true,
} = {}) {
  const ranks = [...groups.keys()].filter((rank) => rank !== "SJ" && rank !== "BJ");

  if (includeTripleWithPair) {
    for (const tripleRank of ranks) {
      const tripleCombos = buildSameRankCombos(groups, wildCards, tripleRank, 3);
      for (const tripleCombo of tripleCombos) {
        const remainingWildCards = subtractCards(wildCards, tripleCombo.filter((card) => wildCards.includes(card)));
        for (const pairRank of ranks) {
          if (pairRank === tripleRank) continue;
          for (const pairCombo of buildSameRankCombos(groups, remainingWildCards, pairRank, 2).slice(0, 6)) {
            candidates.push(classifyPlay([...tripleCombo, ...pairCombo], levelRank));
          }
        }
      }
    }
  }

  if (includeStraight) {
    for (const ranksWindow of chainWindows(5, 5)) {
      for (const combo of buildChainCombos(groups, wildCards, ranksWindow, 1)) {
        candidates.push(classifyPlay(combo, levelRank));
      }
    }
  }

  if (includeConsecutivePairs) {
    for (const ranksWindow of chainWindows(3, 3)) {
      for (const combo of buildChainCombos(groups, wildCards, ranksWindow, 2)) {
        candidates.push(classifyPlay(combo, levelRank));
      }
    }
  }

  if (includePlane) {
    for (const ranksWindow of chainWindows(2, 2)) {
      for (const combo of buildChainCombos(groups, wildCards, ranksWindow, 3)) {
        candidates.push(classifyPlay(combo, levelRank));
      }
    }
  }
}

/** 天然 + 逢人配补缺口同花顺（整手同花顺须压牌时不能再漏候选） */
function addStraightFlushCandidates(candidates, hand, levelRank) {
  const seen = new Set();
  for (const item of enumerateStraightFlushCandidates(hand, levelRank)) {
    const play = item.play;
    if (play?.type !== PLAY_TYPES.straightFlush) continue;
    const key = play.cards.map((card) => cardId(card)).sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(play);
  }
}

function candidateKey(candidate) {
  return [
    candidate.type,
    candidate.mainRank,
    candidate.length,
    candidate.bombSize ?? "",
    candidate.chainLength ?? "",
    candidate.cards.map((card) => `${card.rank}-${card.suit}-${card.deckIndex}`).sort().join("|"),
  ].join(":");
}

function candidateUsesAvailableCards(candidate, handIds) {
  const usedIds = new Set();
  for (const card of candidate.cards) {
    const id = cardId(card);
    if (!handIds.has(id) || usedIds.has(id)) return false;
    usedIds.add(id);
  }
  return true;
}

export function generateBasicCandidates(hand, levelRank, previousPlay = null) {
  const handIds = new Set(hand.map(cardId));
  const wildCards = hand.filter((card) => isWildCard(card, levelRank));
  const nonWildCards = hand.filter((card) => !isWildCard(card, levelRank));
  const groups = groupByRank(nonWildCards);
  const candidates = [];
  const previousType = previousPlay?.type ?? null;
  const isOpening = !previousType || previousType === PLAY_TYPES.pass;
  const previousIsBomb = previousType === PLAY_TYPES.bomb
    || previousType === PLAY_TYPES.straightFlush
    || previousType === PLAY_TYPES.jokerBomb;
  const includeSingles = isOpening || previousType === PLAY_TYPES.single;
  const includePairs = isOpening || previousType === PLAY_TYPES.pair;
  const includeTriples = isOpening || previousType === PLAY_TYPES.triple;
  const includeTripleWithPair = isOpening || previousType === PLAY_TYPES.tripleWithPair;
  const includeStraight = isOpening || previousType === PLAY_TYPES.straight;
  const includeConsecutivePairs = isOpening || previousType === PLAY_TYPES.consecutivePairs;
  const includePlane = isOpening || previousType === PLAY_TYPES.plane;
  const sameRankSizes = [
    includeSingles ? 1 : null,
    includePairs ? 2 : null,
    includeTriples ? 3 : null,
  ].filter(Boolean);

  for (const [rank, cards] of groups) {
    const usableCards = [...cards, ...wildCards];

    for (const size of sameRankSizes) {
      if (usableCards.length >= size) {
        for (const combo of combinations(usableCards, size)) {
          candidates.push(classifyPlay(combo, levelRank));
        }
      }
    }

    if (usableCards.length >= 4) {
      addBombCandidatesForRank(candidates, groups, wildCards, rank, levelRank);
    }
  }

  if (wildCards.length > 0 && (includeSingles || includePairs)) {
    for (const size of [includeSingles ? 1 : null, includePairs ? 2 : null].filter(Boolean)) {
      if (wildCards.length >= size) {
        for (const combo of combinations(wildCards, size)) {
          candidates.push(classifyPlay(combo, levelRank));
        }
      }
    }
  }

  const smallJokers = hand.filter((card) => card.rank === "SJ");
  const bigJokers = hand.filter((card) => card.rank === "BJ");
  if (smallJokers.length === 2 && bigJokers.length === 2) {
    candidates.push(classifyPlay([...smallJokers, ...bigJokers], levelRank));
  }

  addStraightFlushCandidates(candidates, hand, levelRank);
  addComplexCandidates(candidates, groups, wildCards, levelRank, {
    includeTripleWithPair,
    includeStraight,
    includeConsecutivePairs,
    includePlane,
  });

  const uniqueCandidates = new Map();
  for (const candidate of candidates) {
    if (candidate.type === "Invalid") continue;
    if (!candidateUsesAvailableCards(candidate, handIds)) continue;
    if (!canBeat(candidate, previousPlay)) continue;
    const key = candidateKey(candidate);
    if (!uniqueCandidates.has(key)) uniqueCandidates.set(key, candidate);
  }

  return [...uniqueCandidates.values()]
    .sort((left, right) => left.length - right.length || left.power - right.power || rankPower(left.mainRank, levelRank) - rankPower(right.mainRank, levelRank));
}
