import { cardId, isWildCard } from "../engine/card.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { deepFreeze } from "./result.mjs";
import { decisionPlaySignature } from "./signature.mjs";
import { buildCompleteStructures, structuresBrokenByCandidate } from "./structures.mjs";

function countBy(items, keyOf) {
  const counts = new Map();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => (
    left < right ? -1 : (left > right ? 1 : 0)
  )));
}

function groupCardsByRank(hand) {
  const groups = new Map();
  for (const card of hand) {
    if (!groups.has(card.rank)) groups.set(card.rank, []);
    groups.get(card.rank).push(card);
  }
  return groups;
}

function contextFacts(state) {
  const isLead = !state.previousPlay;
  const partnerCount = state.remainingCardCounts[state.partnerIndex] ?? 0;
  const opponentIndexes = state.remainingCardCounts
    .map((_, index) => index)
    .filter((index) => index !== state.playerIndex && index !== state.partnerIndex);
  return {
    isLead,
    isFollow: !isLead,
    isCatchWind: isLead
      && state.playHistory.some((entry) => entry.play?.type !== PLAY_TYPES.pass),
    partnerLed: !isLead && state.lastActivePlayerIndex === state.partnerIndex,
    opponentLed: !isLead
      && state.lastActivePlayerIndex !== state.playerIndex
      && state.lastActivePlayerIndex !== state.partnerIndex,
    opponentOneCard: opponentIndexes.some((index) => state.remainingCardCounts[index] === 1),
    activeOpponentOneCard: opponentIndexes.includes(state.lastActivePlayerIndex)
      && state.remainingCardCounts[state.lastActivePlayerIndex] === 1,
    partnerNearFinish: partnerCount > 0 && partnerCount <= 5,
    previousPlayType: state.previousPlay?.type ?? null,
    previousPlayMainRank: state.previousPlay?.mainRank ?? null,
  };
}

export function buildHandFacts(state, { candidates = null } = {}) {
  if (!state || state.schemaVersion !== 1) {
    throw new TypeError("normalized decision state version 1 is required");
  }
  const structures = buildCompleteStructures(state.hand, state.levelRank, { candidates });
  const protectedIds = new Set(structures.flatMap((structure) => structure.cardIds));
  const premiumProtectedIds = new Set(structures
    .filter((structure) => structure.type !== PLAY_TYPES.pair && structure.type !== PLAY_TYPES.triple)
    .flatMap((structure) => structure.cardIds));
  const rankGroups = groupCardsByRank(state.hand);
  const looseSingles = [];
  const loosePairs = [];

  for (const cards of rankGroups.values()) {
    const ids = cards.map(cardId).sort();
    if (cards.length === 1 && !premiumProtectedIds.has(ids[0])) looseSingles.push(ids[0]);
    if (cards.length === 2 && ids.every((id) => !premiumProtectedIds.has(id))) loosePairs.push(ids);
  }
  looseSingles.sort();
  loosePairs.sort((left, right) => {
    const leftKey = left.join(",");
    const rightKey = right.join(",");
    return leftKey < rightKey ? -1 : (leftKey > rightKey ? 1 : 0);
  });

  return deepFreeze({
    rankCounts: countBy(state.hand, (card) => card.rank),
    suitCounts: countBy(state.hand, (card) => card.suit),
    structures,
    straightFlushRunwayCardIds: [...new Set(structures
      .filter((structure) => structure.type === PLAY_TYPES.straightFlush)
      .flatMap((structure) => structure.cardIds))].sort(),
    naturalStraightFlushes: structures
      .filter((structure) => (
        structure.type === PLAY_TYPES.straightFlush && structure.wildCount === 0
      ))
      .map((structure) => ({
        cardIds: structure.cardIds,
      })),
    protectedCardIds: [...protectedIds].sort(),
    looseSingles,
    loosePairs,
    context: contextFacts(state),
  });
}

export function buildCandidateFacts(state, candidate, handFacts = buildHandFacts(state)) {
  const usedIds = new Set((candidate.cards ?? []).map(cardId));
  const remaining = state.hand.filter((card) => !usedIds.has(cardId(card)));
  return deepFreeze({
    signature: decisionPlaySignature(candidate),
    type: candidate.type,
    mainRank: candidate.mainRank ?? null,
    power: candidate.power ?? 0,
    cardCount: candidate.cards?.length ?? 0,
    remainingCardCount: remaining.length,
    remainingRankCounts: countBy(remaining, (card) => card.rank),
    usesBombResource: candidate.type === PLAY_TYPES.bomb
      || candidate.type === PLAY_TYPES.straightFlush
      || candidate.type === PLAY_TYPES.jokerBomb,
    usesLooseSingle: candidate.type === PLAY_TYPES.single
      && (candidate.cards ?? []).some((card) => handFacts.looseSingles.includes(cardId(card))),
    usesWildCard: (candidate.cards ?? []).some((card) => isWildCard(card, state.levelRank)),
    wildCardCount: (candidate.cards ?? []).filter((card) => isWildCard(card, state.levelRank)).length,
    handCardCount: state.hand.length,
    levelRank: state.levelRank,
    matchesPlannedStructure: handFacts.structures
      .some((structure) => structure.signature === decisionPlaySignature(candidate)),
    breaksStructures: structuresBrokenByCandidate(handFacts.structures, candidate),
    damagesStraightFlushRunway: [PLAY_TYPES.single, PLAY_TYPES.pair, PLAY_TYPES.triple]
      .includes(candidate.type) && (handFacts.straightFlushRunwayCardIds ?? []).some((id) => usedIds.has(id)),
    context: handFacts.context,
  });
}
