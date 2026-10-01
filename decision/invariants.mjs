import { cardId, playUsesOnlyHandCards } from "../engine/card.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { buildHandFacts } from "./facts.mjs";
import { deepFreeze } from "./result.mjs";
import { normalizeDecisionPlay } from "./state.mjs";

function assignedRankCounts(candidate) {
  const assignedByCard = new Map();
  for (const assignment of candidate.wildcardAssignments ?? []) {
    if (!assignment?.from || !assignment?.as) continue;
    const rank = typeof assignment.as === "object" ? assignment.as.rank : assignment.as;
    if (rank) assignedByCard.set(cardId(assignment.from), rank);
  }
  const counts = new Map();
  for (const card of candidate.cards ?? []) {
    const rank = assignedByCard.get(cardId(card)) ?? card.rank;
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }
  return counts;
}

function usesLevelPairAsTripleWithPair(candidate, levelRank) {
  if (candidate.type !== PLAY_TYPES.tripleWithPair) return false;
  const counts = assignedRankCounts(candidate);
  return candidate.mainRank !== levelRank && counts.get(levelRank) === 2;
}

function breaksPlannedBomb(candidate, handFacts) {
  if (
    candidate.type === PLAY_TYPES.bomb
    || candidate.type === PLAY_TYPES.straightFlush
    || candidate.type === PLAY_TYPES.jokerBomb
  ) return false;
  const usedIds = new Set((candidate.cards ?? []).map(cardId));
  return handFacts.structures
    .filter((structure) => (
      structure.type === PLAY_TYPES.bomb || structure.type === PLAY_TYPES.jokerBomb
    ))
    .some((structure) => structure.cardIds.some((id) => usedIds.has(id)));
}

function breaksNaturalStraightFlush(candidate, handFacts) {
  if (candidate.type === PLAY_TYPES.straightFlush) return false;
  const usedIds = new Set((candidate.cards ?? []).map(cardId));
  return handFacts.naturalStraightFlushes
    .some((structure) => structure.cardIds.some((id) => usedIds.has(id)));
}

function breaksPlannedPlane(candidate, handFacts) {
  // On a must-beat turn, an exact same-type beater may legitimately consume
  // one part of a larger plane (for example, pair K over pair Q). The hard
  // protection targets lead/catch-wind decisions, where the whole steel plate
  // is an available reduction play.
  if (!handFacts.context.isLead) return false;
  const usedIds = new Set((candidate.cards ?? []).map(cardId));
  return handFacts.structures
    // Wildcard-completed planes are hypothetical arrangements, not a
    // physical steel plate that must be protected from routine use.
    .filter((structure) => structure.type === PLAY_TYPES.plane && structure.wildCount === 0)
    .some((structure) => {
      const overlap = structure.cardIds.filter((id) => usedIds.has(id)).length;
      if (overlap === 0) return false;
      return candidate.type !== PLAY_TYPES.plane
        || overlap < structure.cardIds.length
        || (candidate.cards?.length ?? 0) !== structure.cardIds.length;
    });
}

export function detectHardInvariantCodes(candidate, state, handFacts = buildHandFacts(state)) {
  if (!candidate || candidate.type === PLAY_TYPES.invalid || !playUsesOnlyHandCards(state.hand, candidate)) {
    return deepFreeze(["illegal-cards"]);
  }

  const codes = [];
  if (!state.previousPlay && candidate.type === PLAY_TYPES.pass) {
    codes.push("pass-on-lead");
  }

  const finishesHand = (candidate.cards?.length ?? 0) === state.hand.length;
  if (
    handFacts.context.partnerLed
    && candidate.type !== PLAY_TYPES.pass
    && !finishesHand
  ) {
    codes.push("beat-partner");
  }

  if (!finishesHand && breaksPlannedBomb(candidate, handFacts)) {
    codes.push("split-bomb");
  }
  if (!finishesHand && breaksNaturalStraightFlush(candidate, handFacts)) {
    codes.push("split-straight-flush");
  }
  if (!finishesHand && breaksPlannedPlane(candidate, handFacts)) {
    codes.push("split-plane");
  }
  if (!finishesHand && usesLevelPairAsTripleWithPair(candidate, state.levelRank)) {
    codes.push("twp-level-kicker");
  }

  return deepFreeze(codes);
}

export function filterHardInvariants(candidates, state, handFacts = buildHandFacts(state)) {
  const accepted = [];
  const rejected = [];
  for (const candidateInput of candidates) {
    const candidate = normalizeDecisionPlay(candidateInput);
    const codes = detectHardInvariantCodes(candidate, state, handFacts);
    if (codes.length === 0) accepted.push(candidate);
    else rejected.push({ candidate, codes });
  }
  return deepFreeze({
    accepted,
    rejected,
    error: accepted.length === 0 ? "all-candidates-rejected" : null,
  });
}
