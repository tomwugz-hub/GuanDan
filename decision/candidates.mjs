import { cardId, isJoker, isWildCard, playUsesOnlyHandCards } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { canBeat } from "../engine/compare-play.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import {
  findNonOverlappingStraightFlushes,
  STRAIGHT_FLUSH_CHAIN_RANKS,
} from "../engine/straight-flush-candidates.mjs";
import { deepFreeze } from "./result.mjs";
import { decisionPlaySignature } from "./signature.mjs";
import { normalizeDecisionPlay } from "./state.mjs";
import { buildCompleteStructures } from "./structures.mjs";

function compareText(left, right) {
  return left < right ? -1 : (left > right ? 1 : 0);
}

function naturalGroups(hand, levelRank) {
  const groups = new Map();
  for (const card of hand) {
    if (isJoker(card) || isWildCard(card, levelRank)) continue;
    if (!groups.has(card.rank)) groups.set(card.rank, []);
    groups.get(card.rank).push(card);
  }
  return groups;
}

function protectedStraightFlushIds(hand, levelRank) {
  const ids = new Set();
  for (const structure of findNonOverlappingStraightFlushes(hand, levelRank)) {
    for (const card of structure.cards ?? []) ids.add(cardId(card));
  }
  return ids;
}

function safeCardsForRank(groups, rank, count, protectedIds) {
  const cards = (groups.get(rank) ?? []).filter((card) => !protectedIds.has(cardId(card)));
  return cards.length >= count ? cards.slice(0, count) : null;
}

function addSafeNaturalCandidate(candidates, state, cards, expectedType) {
  if (!cards) return;
  const candidate = normalizeDecisionPlay(classifyPlay(cards, state.levelRank));
  if (candidate.type !== expectedType) return;
  if (state.previousPlay && !canBeat(candidate, state.previousPlay)) return;
  if (!playUsesOnlyHandCards(state.hand, candidate)) return;
  candidates.push(candidate);
}

function chainWindows(length) {
  const windows = [];
  for (let start = 0; start + length <= STRAIGHT_FLUSH_CHAIN_RANKS.length; start += 1) {
    windows.push(STRAIGHT_FLUSH_CHAIN_RANKS.slice(start, start + length));
  }
  return windows;
}

/**
 * Deterministic bounded generation may choose the first physical card in a
 * rank, even when that card belongs to a protected straight-flush runway
 * (including a wildcard-completed runway shown by the UI arrangement).
 * Add one canonical all-natural alternative per supported structure window so
 * ranking can compare the same safe physical route the user sees in 理牌.
 */
function addStructureSafeCandidates(candidates, state) {
  const protectedIds = protectedStraightFlushIds(state.hand, state.levelRank);
  if (protectedIds.size === 0) return;

  const groups = naturalGroups(state.hand, state.levelRank);
  const previousType = state.previousPlay?.type ?? null;
  const shouldAdd = (type) => !previousType || previousType === type;

  if (shouldAdd(PLAY_TYPES.single) || shouldAdd(PLAY_TYPES.pair) || shouldAdd(PLAY_TYPES.triple)) {
    const sameRankTypes = [
      [PLAY_TYPES.single, 1],
      [PLAY_TYPES.pair, 2],
      [PLAY_TYPES.triple, 3],
    ];
    for (const [type, count] of sameRankTypes) {
      if (!shouldAdd(type)) continue;
      for (const rank of groups.keys()) {
        addSafeNaturalCandidate(
          candidates,
          state,
          safeCardsForRank(groups, rank, count, protectedIds),
          type,
        );
      }
    }
  }

  if (shouldAdd(PLAY_TYPES.straight)) {
    for (const ranks of chainWindows(5)) {
      const cards = ranks.flatMap((rank) => safeCardsForRank(groups, rank, 1, protectedIds) ?? []);
      if (cards.length === ranks.length) addSafeNaturalCandidate(candidates, state, cards, PLAY_TYPES.straight);
    }
  }

  if (shouldAdd(PLAY_TYPES.consecutivePairs)) {
    for (const ranks of chainWindows(3)) {
      const cards = ranks.flatMap((rank) => safeCardsForRank(groups, rank, 2, protectedIds) ?? []);
      if (cards.length === ranks.length * 2) {
        addSafeNaturalCandidate(candidates, state, cards, PLAY_TYPES.consecutivePairs);
      }
    }
  }

  if (shouldAdd(PLAY_TYPES.plane)) {
    for (const ranks of chainWindows(2)) {
      const cards = ranks.flatMap((rank) => safeCardsForRank(groups, rank, 3, protectedIds) ?? []);
      if (cards.length === ranks.length * 3) addSafeNaturalCandidate(candidates, state, cards, PLAY_TYPES.plane);
    }
  }

  if (shouldAdd(PLAY_TYPES.tripleWithPair)) {
    const ranks = [...groups.keys()];
    for (const tripleRank of ranks) {
      const triple = safeCardsForRank(groups, tripleRank, 3, protectedIds);
      if (!triple) continue;
      for (const pairRank of ranks) {
        if (pairRank === tripleRank) continue;
        const pair = safeCardsForRank(groups, pairRank, 2, protectedIds);
        if (pair) addSafeNaturalCandidate(
          candidates,
          state,
          [...triple, ...pair],
          PLAY_TYPES.tripleWithPair,
        );
      }
    }
  }
}

function addCompleteStructureCandidates(candidates, state) {
  const handById = new Map(state.hand.map((card) => [cardId(card), card]));
  // Reuse the already generated straight-flush candidates. This keeps the
  // canonical-structure safety net bounded without enumerating flushes twice.
  for (const structure of buildCompleteStructures(state.hand, state.levelRank, { candidates })) {
    const cards = structure.cardIds.map((id) => handById.get(id));
    if (cards.some((card) => !card)) continue;
    const candidate = normalizeDecisionPlay(classifyPlay(cards, state.levelRank));
    if (candidate.type === PLAY_TYPES.invalid || candidate.type === PLAY_TYPES.pass) continue;
    if (state.previousPlay && !canBeat(candidate, state.previousPlay)) continue;
    candidates.push(candidate);
  }
}

function addSmallHandExhaustiveCandidates(candidates, state) {
  // Bound subset enumeration to at most 1023 combinations.
  if (state.hand.length > 10) return;
  for (let mask = 1; mask < (1 << state.hand.length); mask += 1) {
    const cards = state.hand.filter((card, index) => (mask & (1 << index)) !== 0);
    const candidate = normalizeDecisionPlay(classifyPlay(cards, state.levelRank));
    if (candidate.type === PLAY_TYPES.invalid || candidate.type === PLAY_TYPES.pass) continue;
    if (state.previousPlay && !canBeat(candidate, state.previousPlay)) continue;
    candidates.push(candidate);
  }
}

export function sourceDecisionCandidates(state) {
  if (!state || state.schemaVersion !== 1) {
    throw new TypeError("normalized decision state version 1 is required");
  }

  const candidates = generateBasicCandidates(
    state.hand,
    state.levelRank,
    state.previousPlay,
    { deterministicBounded: true },
  );

  // Deterministic bounded generation intentionally limits physical card
  // combinations. Add the canonical whole structures as a safety net so a
  // protected plane/straight/chain is never absent solely due to that cap.
  addCompleteStructureCandidates(candidates, state);
  addStructureSafeCandidates(candidates, state);
  addSmallHandExhaustiveCandidates(candidates, state);

  if (state.previousPlay) {
    candidates.push(classifyPlay([], state.levelRank));
  }

  const unique = new Map();
  for (const candidate of candidates) {
    if (!candidate || candidate.type === PLAY_TYPES.invalid) continue;
    if (!playUsesOnlyHandCards(state.hand, candidate)) continue;
    if (candidate.type !== PLAY_TYPES.pass && state.previousPlay && !canBeat(candidate, state.previousPlay)) {
      continue;
    }
    if (candidate.type === PLAY_TYPES.pass && !state.previousPlay) continue;

    const normalized = normalizeDecisionPlay(candidate);
    const signature = decisionPlaySignature(normalized);
    if (!unique.has(signature)) unique.set(signature, normalized);
  }

  const ordered = [...unique.values()]
    .sort((left, right) => compareText(
      decisionPlaySignature(left),
      decisionPlaySignature(right),
    ));

  if (ordered.length === 0 && !state.previousPlay) {
    throw new Error("no legal lead candidate");
  }

  return deepFreeze(ordered);
}
