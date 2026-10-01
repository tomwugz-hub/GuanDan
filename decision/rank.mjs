import { PLAY_TYPES } from "../engine/play-types.mjs";
import { evaluateImmediateOutcome } from "./doctrines/finish.mjs";
import { evaluateLeadValue } from "./doctrines/lead.mjs";
import { evaluatePartnerCooperation } from "./doctrines/partner.mjs";
import { evaluateHandShape } from "./doctrines/structure.mjs";
import { evaluateResponseValue } from "./doctrines/tempo.mjs";
import { evaluateWildCardUsage } from "./doctrines/wild.mjs";
import { buildCandidateFacts } from "./facts.mjs";
import { deepFreeze } from "./result.mjs";

function compareTupleDescending(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return right[index] - left[index];
  }
  return 0;
}

export function rankDecisionCandidates(state, candidates, handFacts) {
  const facts = candidates.map((candidate) => buildCandidateFacts(state, candidate, handFacts));
  const poolContext = {
    hasRegularBeater: facts.some((item) => (
      item.context.opponentLed
      && item.type !== PLAY_TYPES.pass
      && !item.usesBombResource
      && !(item.usesWildCard && item.type === PLAY_TYPES.single)
    )),
    hasJokerSingleBeater: facts.some((item) => (
      item.type === PLAY_TYPES.single
      && (item.mainRank === "SJ" || item.mainRank === "BJ")
    )),
    hasWastefulWildSingleBeater: facts.some((item) => (
      item.type === PLAY_TYPES.single && item.usesWildCard
    )),
    hasNaturalPlaneBeater: facts.some((item) => (
      item.context.opponentLed
      && item.type === PLAY_TYPES.plane
      && !item.usesWildCard
    )),
    hasWildPlaneCandidate: facts.some((item) => (
      item.context.opponentLed
      && item.type === PLAY_TYPES.plane
      && item.usesWildCard
    )),
    hasNaturalLeadRoute: facts.some((item) => (
      item.context.isLead
      && item.cardCount >= 4
      && !item.usesWildCard
      && !item.usesBombResource
    )),
    naturalBeaterTypes: new Set(facts
      .filter((item) => (
        item.context.opponentLed
        && item.type !== PLAY_TYPES.pass
        && !item.usesWildCard
        && !item.usesBombResource
      ))
      .map((item) => item.type)),
    hasPassOption: candidates.some((candidate) => candidate.type === PLAY_TYPES.pass),
  };

  const ranked = candidates.map((candidate, index) => {
    const candidateFacts = facts[index];
    const finish = evaluateImmediateOutcome(candidateFacts);
    const response = evaluateResponseValue(candidateFacts, poolContext);
    const partner = evaluatePartnerCooperation(candidateFacts);
    const lead = evaluateLeadValue(candidateFacts);
    const shape = evaluateHandShape(candidateFacts);
    const wild = evaluateWildCardUsage(candidateFacts, state.levelRank, poolContext);
    return {
      candidate,
      facts: candidateFacts,
      rankTuple: [
        finish.value,
        response.value,
        partner.value,
        lead.value,
        wild.value,
        shape.remainingValue,
        shape.damageValue,
        response.conservationValue,
        wild.conservationValue,
        lead.conservationValue,
        shape.bombValue,
      ],
      evidence: [
        ...finish.evidence,
        ...response.evidence,
        ...partner.evidence,
        ...lead.evidence,
        ...wild.evidence,
        ...shape.evidence,
      ],
    };
  });

  ranked.sort((left, right) => {
    const tupleOrder = compareTupleDescending(left.rankTuple, right.rankTuple);
    if (tupleOrder !== 0) return tupleOrder;
    return left.facts.signature < right.facts.signature
      ? -1
      : (left.facts.signature > right.facts.signature ? 1 : 0);
  });
  return deepFreeze(ranked);
}
