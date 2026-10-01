import { PLAY_TYPES } from "../../engine/play-types.mjs";

export function evaluateLeadValue(candidateFacts) {
  if (!candidateFacts.context.isCatchWind) {
    return { value: 0, conservationValue: 0, evidence: [] };
  }
  if (
    candidateFacts.matchesPlannedStructure
    && candidateFacts.cardCount >= 3
    && !candidateFacts.usesBombResource
    && candidateFacts.breaksStructures.length === 0
  ) {
    return {
      value: 4,
      conservationValue: 0,
      evidence: [{ code: "LEAD_COMPLETE_STRUCTURE", facts: { catchWind: true } }],
    };
  }
  if (candidateFacts.usesLooseSingle) {
    return {
      value: 3,
      conservationValue: -(candidateFacts.power ?? 0),
      evidence: [{ code: "LEAD_LOOSE_SINGLE", facts: { catchWind: true } }],
    };
  }
  if (candidateFacts.matchesPlannedStructure && !candidateFacts.usesBombResource) {
    return {
      value: 2,
      conservationValue: 0,
      evidence: [{ code: "LEAD_COMPLETE_STRUCTURE", facts: { catchWind: true } }],
    };
  }
  if (candidateFacts.usesBombResource) {
    return { value: -1, conservationValue: 0, evidence: [] };
  }
  return { value: 0, conservationValue: 0, evidence: [] };
}
