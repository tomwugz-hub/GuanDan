import { classifyPlay } from "./classify-play.mjs";
import { canBeat } from "./compare-play.mjs";
import { cardId, isWildCard, playUsesOnlyHandCards } from "./card.mjs";
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

function combinations(items, size, limit = 8, abortCheck = null) {
  const result = [];
  let stopped = false;

  function walk(start, picked) {
    if (stopped || abortCheck?.()) {
      stopped = true;
      return;
    }
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

/** 同点 n 张取 k 张时须覆盖全部组合，避免四选三漏掉「留结构牌」取法（如 777 保留同花顺内 7♠） */
function naturalComboEnumerateLimit(naturalCards, naturalCount) {
  if (naturalCount <= 0) return 1;
  if (naturalCards.length <= naturalCount) return 1;
  return Math.min(12, naturalCards.length * (naturalCards.length - naturalCount + 1));
}

function buildSameRankCombos(groups, wildCards, rank, size, comboLimit = 5, abortCheck = null) {
  const naturalCards = naturalCardsForRank(groups, rank);
  const combos = [];

  for (let naturalCount = Math.min(size, naturalCards.length); naturalCount >= 0; naturalCount -= 1) {
    if (abortCheck?.()) break;
    const wildCount = size - naturalCount;
    if (wildCount > wildCards.length) continue;
    const enumLimit = naturalComboEnumerateLimit(naturalCards, naturalCount);
    for (const naturalCombo of combinations(naturalCards, naturalCount, enumLimit, abortCheck)) {
      for (const wildCombo of combinations(wildCards, wildCount, 2, abortCheck)) {
        combos.push([...naturalCombo, ...wildCombo]);
        if (combos.length >= comboLimit || abortCheck?.()) return combos;
      }
    }
  }

  return combos;
}

/** 同点炸弹：从四炸到满张均生成；有纯四炸时优先生成不含逢人配的组合 */
function addBombCandidatesForRank(candidates, groups, wildCards, rank, levelRank, { lite = false, emergency = false, abortCheck = null } = {}) {
  if (abortCheck?.()) return;
  const naturalCards = naturalCardsForRank(groups, rank);
  const maxSize = naturalCards.length + wildCards.length;
  if (maxSize < 4) return;

  const maxBombSize = emergency ? 4 : (lite ? Math.min(maxSize, 5) : maxSize);
  for (let size = 4; size <= maxBombSize; size += 1) {
    if (abortCheck?.()) break;
    const comboLimit = emergency
      ? 2
      : lite
        ? (size === 4 && naturalCards.length >= 4 ? 4 : 3)
        : (size === 4 && naturalCards.length >= 4 ? 8 : 5);
    for (const combo of buildSameRankCombos(groups, wildCards, rank, size, comboLimit, abortCheck)) {
      if (abortCheck?.()) break;
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

function buildChainCombos(groups, wildCards, ranks, perRank, maxResults = 18, abortCheck = null) {
  const results = [];

  function walk(rankIndex, pickedCards, remainingWildCards) {
    if (results.length >= maxResults || abortCheck?.()) return;
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
  chainComboMax = 18,
  abortCheck = null,
} = {}) {
  const ranks = [...groups.keys()].filter((rank) => rank !== "SJ" && rank !== "BJ");

  if (includeTripleWithPair) {
    for (const tripleRank of ranks) {
      if (abortCheck?.()) break;
      const tripleCombos = buildSameRankCombos(groups, wildCards, tripleRank, 3, 12);
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
      if (abortCheck?.()) break;
      for (const combo of buildChainCombos(groups, wildCards, ranksWindow, 1, 18, abortCheck)) {
        candidates.push(classifyPlay(combo, levelRank));
      }
    }
  }

  if (includeConsecutivePairs) {
    for (const ranksWindow of chainWindows(3, 3)) {
      if (abortCheck?.()) break;
      for (const combo of buildChainCombos(groups, wildCards, ranksWindow, 2, 18, abortCheck)) {
        candidates.push(classifyPlay(combo, levelRank));
      }
    }
  }

  if (includePlane) {
    for (const ranksWindow of chainWindows(2, 2)) {
      if (abortCheck?.()) break;
      for (const combo of buildChainCombos(groups, wildCards, ranksWindow, 3, chainComboMax, abortCheck)) {
        candidates.push(classifyPlay(combo, levelRank));
      }
    }
  }
}

/** 天然 + 逢人配补缺口同花顺（整手同花顺须压牌时不能再漏候选） */
function addStraightFlushCandidates(candidates, hand, levelRank, { lite = false, emergency = false, abortCheck = null } = {}) {
  const seen = new Set();
  const cap = emergency ? 2 : (lite ? 4 : Infinity);
  for (const item of enumerateStraightFlushCandidates(hand, levelRank)) {
    if (abortCheck?.()) break;
    if (seen.size >= cap) break;
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

export function generateBasicCandidates(hand, levelRank, previousPlay = null, options = {}) {
  const lite = options.lite === true;
  const emergency = options.emergency === true;
  const robotFast = options.robotFast === true;
  const previousType = previousPlay?.type ?? null;
  const isOpening = !previousType || previousType === PLAY_TYPES.pass;
  const robotLead = robotFast && isOpening;
  const genStarted = performance.now();
  const robotGenBudgetMs = robotFast ? (robotLead ? 150 : 50) : null;
  const outerAbort = typeof options.abortCheck === "function" ? options.abortCheck : null;
  const abortCheck = () => {
    if (robotGenBudgetMs != null && performance.now() - genStarted > robotGenBudgetMs) return true;
    return outerAbort?.() ?? false;
  };
  const genOpts = { lite: lite || robotFast, emergency: emergency || robotFast, abortCheck };
  const wildCards = hand.filter((card) => isWildCard(card, levelRank));
  const nonWildCards = hand.filter((card) => !isWildCard(card, levelRank));
  const groups = groupByRank(nonWildCards);
  const candidates = [];
  const pressMatchOnly = (emergency || robotFast) && previousType && previousType !== PLAY_TYPES.pass;
  /** 接风超时兜底仍须生成顺子/连对等减手结构，避免只剩同花顺 */
  const emergencyOpeningLead = emergency && isOpening && !pressMatchOnly;
  const includeSingles = isOpening || previousType === PLAY_TYPES.single;
  const includePairs = isOpening || previousType === PLAY_TYPES.pair;
  const includeTriples = isOpening || previousType === PLAY_TYPES.triple;
  let includeTripleWithPair = (!emergency && !robotFast && (isOpening || previousType === PLAY_TYPES.tripleWithPair))
    || robotLead
    || emergencyOpeningLead;
  let includeStraight = (!emergency && !robotFast && (isOpening || previousType === PLAY_TYPES.straight))
    || robotLead
    || emergencyOpeningLead;
  let includeConsecutivePairs = (!emergency && !robotFast && (isOpening || previousType === PLAY_TYPES.consecutivePairs))
    || robotLead
    || emergencyOpeningLead;
  let includePlane = (!emergency && !robotFast && (isOpening || previousType === PLAY_TYPES.plane))
    || robotLead
    || emergencyOpeningLead;
  if (pressMatchOnly) {
    includeTripleWithPair = previousType === PLAY_TYPES.tripleWithPair;
    includeStraight = previousType === PLAY_TYPES.straight;
    includeConsecutivePairs = previousType === PLAY_TYPES.consecutivePairs;
    includePlane = previousType === PLAY_TYPES.plane;
    // 机器人须压：逢人配多时全量枚举钢板/三带二极慢，同型炸弹已在上方同点循环生成
    if (robotFast && (includePlane || includeTripleWithPair || includeConsecutivePairs)) {
      includePlane = false;
      includeTripleWithPair = false;
      includeConsecutivePairs = false;
    }
  }
  const sameRankSizes = [
    includeSingles ? 1 : null,
    includePairs ? 2 : null,
    includeTriples ? 3 : null,
  ].filter(Boolean);
  const sameRankComboLimit = robotFast ? 2 : emergency ? 2 : (lite ? 4 : 12);

  for (const [rank, cards] of groups) {
    if (abortCheck?.()) break;
    const usableCards = [...cards, ...wildCards];

    for (const size of sameRankSizes) {
      if (usableCards.length >= size) {
        for (const combo of combinations(usableCards, size, sameRankComboLimit, abortCheck)) {
          candidates.push(classifyPlay(combo, levelRank));
        }
      }
    }

    if (usableCards.length >= 4) {
      addBombCandidatesForRank(candidates, groups, wildCards, rank, levelRank, genOpts);
    }
  }

  if (wildCards.length > 0 && (includeSingles || includePairs)) {
    for (const size of [includeSingles ? 1 : null, includePairs ? 2 : null].filter(Boolean)) {
      if (abortCheck?.()) break;
      if (wildCards.length >= size) {
        for (const combo of combinations(wildCards, size, sameRankComboLimit, abortCheck)) {
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

  const skipSf = robotFast && previousType && previousType !== PLAY_TYPES.straightFlush;
  if (!skipSf) {
    addStraightFlushCandidates(candidates, hand, levelRank, genOpts);
  }
  const needsComplex = includeTripleWithPair || includeStraight || includeConsecutivePairs || includePlane;
  if (needsComplex && (!emergency || pressMatchOnly || robotLead || emergencyOpeningLead) && !abortCheck?.()) {
    addComplexCandidates(candidates, groups, wildCards, levelRank, {
      includeTripleWithPair,
      includeStraight,
      includeConsecutivePairs,
      includePlane,
      chainComboMax: robotFast ? 6 : (emergency ? 2 : 18),
      abortCheck,
    });
  }

  const uniqueCandidates = new Map();
  for (const candidate of candidates) {
    if (abortCheck?.()) break;
    if (candidate.type === "Invalid") continue;
    if (!playUsesOnlyHandCards(hand, candidate)) continue;
    if (!canBeat(candidate, previousPlay)) continue;
    const key = candidateKey(candidate);
    if (!uniqueCandidates.has(key)) uniqueCandidates.set(key, candidate);
  }

  return [...uniqueCandidates.values()]
    .sort((left, right) => left.length - right.length || left.power - right.power || rankPower(left.mainRank, levelRank) - rankPower(right.mainRank, levelRank));
}
