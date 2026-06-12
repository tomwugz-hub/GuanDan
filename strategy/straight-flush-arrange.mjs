import { cardId, isJoker, isWildCard } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";

export const STRAIGHT_FLUSH_CHAIN_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

const PLANE_CHAIN_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

function groupByRank(cards) {
  const groups = new Map();
  for (const card of cards) {
    if (!groups.has(card.rank)) groups.set(card.rank, []);
    groups.get(card.rank).push(card);
  }
  return groups;
}

function pickWildCombinations(wildCards, count) {
  if (count <= 0) return [[]];
  if (count > wildCards.length) return [];
  if (count === 1) return wildCards.map((card) => [card]);
  const combos = [];
  for (let index = 0; index < wildCards.length; index += 1) {
    for (const tail of pickWildCombinations(wildCards.slice(index + 1), count - 1)) {
      combos.push([wildCards[index], ...tail]);
    }
  }
  return combos;
}

function planeWindows(length = 2) {
  const windows = [];
  for (let start = 0; start + length <= PLANE_CHAIN_RANKS.length; start += 1) {
    windows.push(PLANE_CHAIN_RANKS.slice(start, start + length));
  }
  return windows;
}

/** 手牌里是否已有完整钢板（连续两组三张） */
export function findCompletePlanes(hand, levelRank) {
  const naturals = hand.filter((card) => !isJoker(card) && !isWildCard(card, levelRank));
  const groupsByRank = groupByRank(naturals);
  const planes = [];

  for (const ranks of planeWindows(2)) {
    const picked = [];
    let possible = true;
    for (const rank of ranks) {
      const cards = groupsByRank.get(rank) ?? [];
      if (cards.length < 3) {
        possible = false;
        break;
      }
      picked.push(...cards.slice(0, 3));
    }
    if (possible) {
      planes.push({
        ranks,
        cards: picked,
        cardIds: picked.map(cardId),
      });
    }
  }
  return planes;
}

function overlapsPlane(candidate, planes) {
  const candidateIds = new Set(candidate.cards.map(cardId));
  for (const plane of planes) {
    const overlapCount = plane.cardIds.filter((id) => candidateIds.has(id)).length;
    if (overlapCount >= 2) return true;
  }
  return false;
}

function candidateScore(candidate) {
  return candidate.play.power * 10 - candidate.wildCount * 3 + (candidate.wildCount === 0 ? 2 : 0);
}

/** 枚举所有可行同花顺（含逢人配补缺口） */
export function enumerateStraightFlushCandidates(hand, levelRank) {
  const wildCards = hand.filter((card) => isWildCard(card, levelRank));
  const naturals = hand.filter((card) => !isJoker(card) && !isWildCard(card, levelRank));
  const candidates = [];

  const bySuit = new Map();
  for (const card of naturals) {
    if (!bySuit.has(card.suit)) bySuit.set(card.suit, []);
    bySuit.get(card.suit).push(card);
  }

  for (const [suit, suitedCards] of bySuit.entries()) {
    const byRank = new Map();
    for (const card of suitedCards) {
      if (!byRank.has(card.rank)) byRank.set(card.rank, []);
      byRank.get(card.rank).push(card);
    }

    for (let start = 0; start + 5 <= STRAIGHT_FLUSH_CHAIN_RANKS.length; start += 1) {
      const ranks = STRAIGHT_FLUSH_CHAIN_RANKS.slice(start, start + 5);
      const picked = [];
      let missingCount = 0;
      for (const rank of ranks) {
        const available = byRank.get(rank);
        if (available?.length) picked.push(available[0]);
        else missingCount += 1;
      }
      if (missingCount > wildCards.length) continue;
      if (picked.length + missingCount !== 5) continue;

      for (const wildPick of pickWildCombinations(wildCards, missingCount)) {
        const combo = [...picked, ...wildPick];
        const play = classifyPlay(combo, levelRank);
        if (play.type !== PLAY_TYPES.straightFlush) continue;
        candidates.push({
          suit,
          ranks,
          cards: combo,
          play,
          wildCount: missingCount,
          wildIds: wildPick.map(cardId),
        });
      }
    }
  }

  return candidates.sort((left, right) => candidateScore(right) - candidateScore(left));
}

function canAddCandidate(candidate, usedCardIds, usedWildIds) {
  for (const card of candidate.cards) {
    const id = cardId(card);
    if (usedCardIds.has(id)) return false;
  }
  for (const wildId of candidate.wildIds) {
    if (usedWildIds.has(wildId)) return false;
  }
  return true;
}

function markCandidateUsed(candidate, usedCardIds, usedWildIds) {
  for (const card of candidate.cards) {
    usedCardIds.add(cardId(card));
  }
  for (const wildId of candidate.wildIds) {
    usedWildIds.add(wildId);
  }
}

/**
 * 挑出互不重叠的多条同花顺。
 * - 优先全天然同花顺（哪怕要拆钢板，如红桃 8-Q 占用钢板里的 10♥J♥）
 * - 逢人配先服务同花顺，再考虑炸弹
 * - 仅「逢人配补的同花顺」在已有钢板时慎用，避免拆钢板性价比差
 */
function pickStraightFlushPass(candidates, picked, usedCardIds, usedWildIds, {
  naturalOnly = false,
  protectPlane = true,
  planes = [],
} = {}) {
  for (const candidate of candidates) {
    if (naturalOnly && candidate.wildCount > 0) continue;
    if (!naturalOnly && candidate.wildCount === 0) continue;
    if (!canAddCandidate(candidate, usedCardIds, usedWildIds)) continue;

    const breaksSteelPlate = protectPlane && planes.length > 0 && overlapsPlane(candidate, planes);
    const alreadyHasNaturalFlush = picked.some((item) => item.wildCount === 0);

    if (!naturalOnly && breaksSteelPlate && alreadyHasNaturalFlush) continue;
    if (!naturalOnly && breaksSteelPlate && picked.length > 0) continue;

    picked.push(candidate);
    markCandidateUsed(candidate, usedCardIds, usedWildIds);
  }
}

export function findNonOverlappingStraightFlushes(hand, levelRank, {
  protectPlane = true,
} = {}) {
  const candidates = enumerateStraightFlushCandidates(hand, levelRank);
  const planes = protectPlane ? findCompletePlanes(hand, levelRank) : [];
  const usedCardIds = new Set();
  const usedWildIds = new Set();
  const picked = [];

  // 第一轮：全天然同花顺，避免「红桃9-K+逢人配」挤掉「红桃8-Q」
  pickStraightFlushPass(candidates, picked, usedCardIds, usedWildIds, {
    naturalOnly: true,
    protectPlane,
    planes,
  });

  // 第二轮：剩余牌再用逢人配补同花顺
  pickStraightFlushPass(candidates, picked, usedCardIds, usedWildIds, {
    naturalOnly: false,
    protectPlane,
    planes,
  });

  return picked.sort((left, right) => {
    const leftStart = STRAIGHT_FLUSH_CHAIN_RANKS.indexOf(left.ranks[0]);
    const rightStart = STRAIGHT_FLUSH_CHAIN_RANKS.indexOf(right.ranks[0]);
    return leftStart - rightStart || left.suit.localeCompare(right.suit);
  });
}

/** 单条最优同花顺（兼容旧调用） */
export function findBestStraightFlushInHand(hand, levelRank) {
  return findNonOverlappingStraightFlushes(hand, levelRank)[0] ?? null;
}

/** 同花顺列内排序 */
export function sortStraightFlushCards(straightFlush) {
  return [...straightFlush.cards].sort((left, right) => {
    const leftIndex = straightFlush.ranks.indexOf(left.rank);
    const rightIndex = straightFlush.ranks.indexOf(right.rank);
    if (leftIndex !== -1 && rightIndex !== -1) {
      return leftIndex - rightIndex || left.deckIndex - right.deckIndex;
    }
    return left.deckIndex - right.deckIndex;
  });
}
