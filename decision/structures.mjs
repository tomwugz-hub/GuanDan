import { cardId, isJoker, isWildCard } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { rankPower } from "../engine/rank-order.mjs";
import {
  findCompletePlanes,
  enumerateStraightFlushCandidates,
} from "../engine/straight-flush-candidates.mjs";
import { deepFreeze } from "./result.mjs";
import { decisionPlaySignature } from "./signature.mjs";
import { normalizeDecisionPlay } from "./state.mjs";

const CHAIN_RANKS = Object.freeze([
  "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A",
]);

function groupByRank(cards) {
  const groups = new Map();
  for (const card of cards) {
    if (!groups.has(card.rank)) groups.set(card.rank, []);
    groups.get(card.rank).push(card);
  }
  return groups;
}

function available(cards, usedIds) {
  return (cards ?? []).filter((card) => !usedIds.has(cardId(card)));
}

function markUsed(cards, usedIds) {
  for (const card of cards) usedIds.add(cardId(card));
}

function addStructure(structures, usedIds, cards, levelRank, metadata = {}) {
  const play = normalizeDecisionPlay(classifyPlay(cards, levelRank));
  if (play.type === PLAY_TYPES.invalid || play.type === PLAY_TYPES.pass) return false;
  structures.push({
    type: play.type,
    mainRank: play.mainRank,
    signature: decisionPlaySignature(play),
    cardIds: play.cards.map(cardId).sort(),
    wildCount: metadata.wildCount ?? play.wildcardAssignments?.length ?? 0,
  });
  markUsed(cards, usedIds);
  return true;
}

function selectStraightFlushesFromCandidates(candidates, usedIds, hand, levelRank) {
  const selected = [];
  const planes = findCompletePlanes(hand, levelRank);
  const naturalGroups = groupByRank(hand.filter((card) => !isWildCard(card, levelRank) && !isJoker(card)));
  const planeDamage = (candidate) => {
    const ids = new Set(candidate.cards.map(cardId));
    return planes.filter((plane) => plane.cardIds.filter((id) => ids.has(id)).length >= 2).length;
  };
  const groupDamage = (candidate) => {
    const picked = groupByRank(candidate.cards.filter((card) => !isWildCard(card, levelRank)));
    let damage = 0;
    for (const [rank, cards] of picked) {
      const count = naturalGroups.get(rank)?.length ?? 0;
      if (count >= 2 && cards.length < count) damage += count >= 4
        ? 1000 : (count >= 3 ? 3 : 1) * (rankPower(rank, levelRank) + 1);
    }
    return damage;
  };
  const ordered = candidates
    .filter((candidate) => candidate.type === PLAY_TYPES.straightFlush)
    .sort((left, right) => (
      (left.wildcardAssignments?.length ?? 0) - (right.wildcardAssignments?.length ?? 0)
      || ((left.wildcardAssignments?.length ?? 0) > 0
        ? planeDamage(left) - planeDamage(right) || groupDamage(left) - groupDamage(right)
        : 0)
      || (right.power ?? 0) - (left.power ?? 0)
      || decisionPlaySignature(left).localeCompare(decisionPlaySignature(right))
    ));
  for (const candidate of ordered) {
    if ((candidate.cards ?? []).some((card) => usedIds.has(cardId(card)))) continue;
    if (candidate.wildcardAssignments?.length > 0) {
      const candidateIds = new Set((candidate.cards ?? []).map(cardId));
      const breaksPlane = planes.some((plane) => (
        plane.cardIds.filter((id) => candidateIds.has(id)).length >= 2
      ));
      const hasNaturalFlush = selected.some((item) => (
        (item.wildcardAssignments?.length ?? 0) === 0
      ));
      if (breaksPlane && (hasNaturalFlush || selected.length > 0)) continue;
    }
    selected.push(candidate);
    markUsed(candidate.cards, usedIds);
  }
  return selected;
}

function windows(length) {
  const result = [];
  for (let start = 0; start + length <= CHAIN_RANKS.length; start += 1) {
    result.push(CHAIN_RANKS.slice(start, start + length));
  }
  return result;
}

function addBombs(structures, usedIds, byRank, levelRank, minimumCount) {
  const ranks = [...byRank.keys()].sort((left, right) => (
    (byRank.get(right)?.length ?? 0) - (byRank.get(left)?.length ?? 0)
    || rankPower(right, levelRank) - rankPower(left, levelRank)
  ));
  for (const rank of ranks) {
    const cards = available(byRank.get(rank), usedIds);
    if (cards.length < minimumCount) continue;
    addStructure(structures, usedIds, cards.slice(0, cards.length >= 5 ? 4 : cards.length), levelRank);
  }
}

function addPlanes(structures, usedIds, byRank, levelRank) {
  for (const ranks of windows(2)) {
    // The duplicated terminal A in CHAIN_RANKS is only for five-card
    // A-high straights; K-A is not a valid two-rank steel plate.
    if (ranks[0] === "K" && ranks[1] === "A") continue;
    const picked = ranks.flatMap((rank) => available(byRank.get(rank), usedIds).slice(0, 3));
    if (picked.length === 6) addStructure(structures, usedIds, picked, levelRank);
  }
}

function addConsecutivePairs(structures, usedIds, byRank, levelRank) {
  for (const ranks of windows(3)) {
    const pairs = ranks.map((rank) => available(byRank.get(rank), usedIds));
    if (pairs.every((cards) => cards.length === 2)) {
      addStructure(structures, usedIds, pairs.flat(), levelRank);
    }
  }
}

function straightCards(ranks, byRank, usedIds) {
  const availableByRank = ranks.map((rank) => available(byRank.get(rank), usedIds));
  if (availableByRank.some((cards) => cards.length === 0)) return null;
  if (availableByRank.filter((cards) => cards.length === 1).length < 3) return null;
  return availableByRank.map((cards) => cards[0]);
}

function addStraights(structures, usedIds, byRank, levelRank) {
  const canUseHighLow = straightCards(["2", "3", "4", "5", "6"], byRank, usedIds);
  for (const ranks of windows(5)) {
    if (ranks.join("-") === "A-2-3-4-5" && canUseHighLow) continue;
    const cards = straightCards(ranks, byRank, usedIds);
    if (cards) addStructure(structures, usedIds, cards, levelRank);
  }
}

function addTripleWithPairs(structures, usedIds, byRank, levelRank) {
  const ranks = [...byRank.keys()].sort((left, right) => (
    rankPower(left, levelRank) - rankPower(right, levelRank)
  ));
  for (const tripleRank of ranks) {
    const triple = available(byRank.get(tripleRank), usedIds);
    if (triple.length < 3) continue;
    const pairRank = ranks.find((rank) => (
      rank !== tripleRank && available(byRank.get(rank), usedIds).length === 2
    ));
    if (!pairRank) continue;
    addStructure(
      structures,
      usedIds,
      [...triple.slice(0, 3), ...available(byRank.get(pairRank), usedIds)],
      levelRank,
    );
  }
}

function addSameRankGroups(structures, usedIds, byRank, levelRank, size) {
  const ranks = [...byRank.keys()].sort((left, right) => (
    rankPower(left, levelRank) - rankPower(right, levelRank)
  ));
  for (const rank of ranks) {
    const cards = available(byRank.get(rank), usedIds);
    if (cards.length >= size) {
      addStructure(structures, usedIds, cards.slice(0, size), levelRank);
    }
  }
}

/**
 * Build one deterministic, non-overlapping hand plan. Alternative wildcard
 * possibilities are deliberately not all protected as simultaneous structures.
 */
export function buildCompleteStructures(hand, levelRank) {
  const sorted = [...hand].sort((left, right) => (
    rankPower(left.rank, levelRank) - rankPower(right.rank, levelRank)
    || left.suit.localeCompare(right.suit)
    || (left.deckIndex ?? 0) - (right.deckIndex ?? 0)
  ));
  const naturals = sorted.filter((card) => !isJoker(card) && !isWildCard(card, levelRank));
  const jokers = sorted.filter(isJoker);
  const byRank = groupByRank(naturals);
  const usedIds = new Set();
  const structures = [];

  if (jokers.length === 4) addStructure(structures, usedIds, jokers, levelRank);
  // The hand plan must not depend on which responses are legal this turn.
  // Decision and independent audit therefore enumerate the same full hand.
  {
    for (const straightFlush of selectStraightFlushesFromCandidates(
      enumerateStraightFlushCandidates(sorted, levelRank).map((entry) => entry.play),
      usedIds,
      sorted,
      levelRank,
    )) {
      addStructure(structures, usedIds, straightFlush.cards, levelRank, {
        wildCount: straightFlush.wildcardAssignments?.length ?? 0,
      });
    }
  }
  addBombs(structures, usedIds, byRank, levelRank, 5);
  addBombs(structures, usedIds, byRank, levelRank, 4);
  addPlanes(structures, usedIds, byRank, levelRank);
  addConsecutivePairs(structures, usedIds, byRank, levelRank);
  addStraights(structures, usedIds, byRank, levelRank);
  addTripleWithPairs(structures, usedIds, byRank, levelRank);
  addSameRankGroups(structures, usedIds, byRank, levelRank, 3);
  addSameRankGroups(structures, usedIds, byRank, levelRank, 2);

  return deepFreeze(structures.sort((left, right) => (
    left.signature < right.signature ? -1 : (left.signature > right.signature ? 1 : 0)
  )));
}

export function structuresBrokenByCandidate(structures, candidate) {
  const candidateSignature = decisionPlaySignature(candidate);
  const candidateIds = new Set((candidate.cards ?? []).map(cardId));
  const broken = [];

  for (const structure of structures) {
    if (structure.signature === candidateSignature) continue;
    const overlapIds = structure.cardIds.filter((id) => candidateIds.has(id));
    if (overlapIds.length === 0) continue;
    // Combining complete groups (e.g. a triple and pair) consumes them; it
    // does not split them. Only a proper subset leaves a damaged group.
    if (overlapIds.length === structure.cardIds.length) continue;
    broken.push({
      type: structure.type,
      mainRank: structure.mainRank,
      signature: structure.signature,
      overlapIds,
    });
  }

  return deepFreeze(broken);
}
