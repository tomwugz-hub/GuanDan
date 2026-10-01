import { PLAY_TYPES } from "../../engine/play-types.mjs";

export function evaluatePartnerCooperation(candidateFacts) {
  if (candidateFacts.context.partnerLed && candidateFacts.type === PLAY_TYPES.pass) {
    return {
      value: 2,
      evidence: [{
        code: "YIELD_TO_PARTNER",
        facts: { partnerNearFinish: candidateFacts.context.partnerNearFinish },
      }],
    };
  }
  return { value: 0, evidence: [] };
}
