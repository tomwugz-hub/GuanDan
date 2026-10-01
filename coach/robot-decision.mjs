import { playCards, repairTurnStuck } from "../engine/game-state.mjs";
import { getUnifiedTurnAdvice } from "./decision-adapter.mjs";

export class RobotDecisionError extends Error {
  constructor(result) {
    super(result?.error?.message ?? "统一决策内核未返回机器人出牌");
    this.name = "RobotDecisionError";
    this.decisionResult = result;
  }
}

export function getRobotTurnAdvice(state, playerIndex = state.currentPlayerIndex, options = {}) {
  return getUnifiedTurnAdvice(state, playerIndex, { alternatives: options.alternatives ?? 0 });
}

/**
 * Robot execution adapter. Timing and persona options are deliberately ignored:
 * the same DecisionState must produce the same Top1 for every consumer.
 */
export function playUnifiedRobotTurn(state, options = {}) {
  const { state: normalized, repaired } = repairTurnStuck(state);
  const workingState = repaired ? normalized : state;
  const playerIndex = workingState.currentPlayerIndex;
  const advice = getRobotTurnAdvice(workingState, playerIndex, options);
  if (advice.status !== "ok" || !advice.recommendation?.candidate) {
    throw new RobotDecisionError(advice);
  }
  return {
    state: playCards(workingState, advice.recommendation.candidate.cards),
    advice,
    recommendation: advice.recommendation,
    decisionSignature: advice.decisionSignature,
    evidence: advice.evidence,
    diagnostics: {
      ...advice.diagnostics,
      executionPath: "decision-core",
      repairedTurnState: repaired,
    },
  };
}
