import { PLAY_TYPES } from "../../engine/play-types.mjs";
import { isOpponentHighProbeSingle } from "./wild.mjs";

export function evaluateResponseValue(candidateFacts, poolContext) {
  if (!candidateFacts.context.opponentLed) return { value: 0, conservationValue: 0, evidence: [] };
  if (candidateFacts.type === PLAY_TYPES.pass) {
    return { value: 1, conservationValue: 0, evidence: [{ code: "PASS_OPTION", facts: {} }] };
  }
  const wastefulWildSingle = candidateFacts.usesWildCard
    && candidateFacts.type === PLAY_TYPES.single
    && isOpponentHighProbeSingle(candidateFacts.context, candidateFacts.levelRank ?? "2");
  const damagesRun = candidateFacts.breaksStructures.some((structure) => (
    structure.type === PLAY_TYPES.straightFlush
    || structure.type === PLAY_TYPES.straight
    || structure.type === PLAY_TYPES.consecutivePairs
  ));
  if ((damagesRun || candidateFacts.damagesStraightFlushRunway) && !candidateFacts.usesBombResource) {
    return { value: 0, conservationValue: 0, evidence: [{ code: "STRUCTURE_DAMAGE", facts: { types: candidateFacts.breaksStructures.map((item) => item.type) } }] };
  }
  if (!candidateFacts.usesBombResource && poolContext.hasRegularBeater && !wastefulWildSingle) {
    return {
      value: 3,
      conservationValue: -(candidateFacts.power ?? 0),
      evidence: [{ code: "USE_REGULAR_BEATER", facts: {} }],
    };
  }
  if (candidateFacts.usesBombResource && !poolContext.hasRegularBeater) {
    return { value: 0, conservationValue: 0, evidence: [{ code: "ONLY_BOMB_RESOURCE", facts: {} }] };
  }
  return { value: 0, conservationValue: 0, evidence: [] };
}
