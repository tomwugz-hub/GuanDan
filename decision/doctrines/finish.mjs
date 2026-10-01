import { PLAY_TYPES } from "../../engine/play-types.mjs";

export function evaluateImmediateOutcome(candidateFacts) {
  if (candidateFacts.remainingCardCount === 0) {
    return { value: 4, evidence: [{ code: "FINISH_HAND", facts: { remaining: 0 } }] };
  }
  if (candidateFacts.context.activeOpponentOneCard && candidateFacts.type !== PLAY_TYPES.pass) {
    return { value: 3, evidence: [{ code: "BLOCK_OPPONENT_ONE_CARD", facts: { activeOpponentOneCard: true } }] };
  }
  return { value: 0, evidence: [] };
}
