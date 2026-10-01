import { isWildCard } from "../../engine/card.mjs";
import { compareRanks } from "../../engine/rank-order.mjs";
import { PLAY_TYPES } from "../../engine/play-types.mjs";

const ROUTINE_WILDCARD_LEAD_TYPES = new Set([
  PLAY_TYPES.pair,
  PLAY_TYPES.triple,
  PLAY_TYPES.consecutivePairs,
  PLAY_TYPES.plane,
  PLAY_TYPES.tripleWithPair,
]);

const ROUTINE_WILDCARD_RESPONSE_TYPES = new Set([
  PLAY_TYPES.pair,
  PLAY_TYPES.triple,
  PLAY_TYPES.straight,
  PLAY_TYPES.consecutivePairs,
  PLAY_TYPES.tripleWithPair,
]);

function isRoutineWildcardLead(candidateFacts) {
  return candidateFacts.context.isLead
    && candidateFacts.usesWildCard
    && ROUTINE_WILDCARD_LEAD_TYPES.has(candidateFacts.type);
}

function isRoutineWildcardResponse(candidateFacts, poolContext) {
  return candidateFacts.context.opponentLed
    && candidateFacts.usesWildCard
    && ROUTINE_WILDCARD_RESPONSE_TYPES.has(candidateFacts.type)
    && poolContext.naturalBeaterTypes.has(candidateFacts.type);
}

/** 对手大单/级牌试探（单 A/K/Q/J 或级牌单张） */
export function isOpponentHighProbeSingle(context, levelRank) {
  if (!context.opponentLed) return false;
  if (context.previousPlayType !== PLAY_TYPES.single) return false;
  const rank = context.previousPlayMainRank;
  if (!rank || rank === "SJ" || rank === "BJ") return false;
  if (rank === levelRank) return true;
  return compareRanks(rank, "Q", levelRank) >= 0;
}

export function evaluateWildCardUsage(candidateFacts, levelRank, poolContext) {
  const context = candidateFacts.context;

  // On a fresh lead, a wildcard is a scarce route-building resource. If the
  // hand already has a natural multi-card route, do not spend it to make a
  // routine pair/triple/chain/plane/triple-with-pair. Straight flushes,
  // bombs, and ordinary straights remain available as higher-value uses.
  if (
    isRoutineWildcardLead(candidateFacts)
    && poolContext.hasNaturalLeadRoute
  ) {
    return {
      value: -1,
      conservationValue: -(candidateFacts.wildCardCount ?? 1),
      evidence: [{ code: "RESERVE_WILD_FOR_NATURAL_ROUTE", facts: {
        wildCardCount: candidateFacts.wildCardCount ?? 1,
      } }],
    };
  }

  // On an opponent's same-type lead, a natural legal beater is enough. Do
  // not spend the wildcard merely to climb higher within that same type.
  if (isRoutineWildcardResponse(candidateFacts, poolContext)) {
    return {
      value: -1,
      conservationValue: -(candidateFacts.wildCardCount ?? 1),
      evidence: [{ code: "RESERVE_WILD_FOR_NATURAL_BEATER", facts: {
        type: candidateFacts.type,
        wildCardCount: candidateFacts.wildCardCount ?? 1,
      } }],
    };
  }

  // A wildcard steel plate is a routine response only when it is the only
  // same-type way to follow. If a natural steel plate can beat the opponent's
  // steel plate, reserve the wildcards for a higher-value structure instead.
  if (
    context.opponentLed
    && context.previousPlayType === PLAY_TYPES.plane
    && candidateFacts.type === PLAY_TYPES.plane
    && !candidateFacts.usesWildCard
    && poolContext.hasWildPlaneCandidate
  ) {
    return {
      value: 0,
      conservationValue: 0,
      evidence: [{ code: "RESERVE_WILD_FOR_NATURAL_PLANE", facts: {
        wildCardCount: 0,
      } }],
    };
  }

  if (
    context.opponentLed
    && context.previousPlayType === PLAY_TYPES.plane
    && candidateFacts.type === PLAY_TYPES.plane
    && candidateFacts.usesWildCard
    && poolContext.hasNaturalPlaneBeater
  ) {
    return {
      value: -1,
      conservationValue: -(candidateFacts.wildCardCount ?? 1),
      evidence: [{ code: "RESERVE_WILD_FOR_NATURAL_PLANE", facts: {
        wildCardCount: candidateFacts.wildCardCount ?? 1,
      } }],
    };
  }

  if (!isOpponentHighProbeSingle(context, levelRank)) {
    return { value: 0, conservationValue: 0, evidence: [] };
  }
  if (context.activeOpponentOneCard) {
    return { value: 0, conservationValue: 0, evidence: [] };
  }

  const handCount = candidateFacts.handCardCount ?? 0;
  const heavyHand = handCount >= 12;
  const midHand = handCount >= 9;

  if (
    candidateFacts.type === PLAY_TYPES.pass
    && midHand
    && poolContext.hasWastefulWildSingleBeater
  ) {
    return {
      value: 2,
      conservationValue: 0,
      evidence: [{ code: "PASS_RESERVE_WILD", facts: {} }],
    };
  }

  if (candidateFacts.usesWildCard && candidateFacts.type === PLAY_TYPES.single) {
    if (heavyHand && poolContext.hasJokerSingleBeater) {
      return {
        value: -3,
        conservationValue: -(candidateFacts.power ?? 0),
        evidence: [{ code: "RESERVE_WILD_FOR_JOKER", facts: {} }],
      };
    }
    if (midHand && poolContext.hasPassOption) {
      return {
        value: -2,
        conservationValue: -(candidateFacts.power ?? 0),
        evidence: [{ code: "RESERVE_WILD_HIGH_PROBE", facts: {} }],
      };
    }
  }

  if (
    (candidateFacts.mainRank === "SJ" || candidateFacts.mainRank === "BJ")
    && candidateFacts.type === PLAY_TYPES.single
    && heavyHand
    && poolContext.hasWastefulWildSingleBeater
  ) {
    return {
      value: 1,
      conservationValue: 0,
      evidence: [{ code: "JOKER_OVER_WILD", facts: {} }],
    };
  }

  return { value: 0, conservationValue: 0, evidence: [] };
}

export function candidateUsesWildCard(candidate, levelRank) {
  return (candidate.cards ?? []).some((card) => isWildCard(card, levelRank));
}
