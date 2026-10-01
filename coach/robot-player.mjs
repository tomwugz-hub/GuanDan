import { getRobotTurnAdvice, playUnifiedRobotTurn } from "./robot-decision.mjs";

/** Compatibility exports; selection no longer branches on these budgets. */
export const ROBOT_LITE_MAX_CANDIDATES = 0;
export const ROBOT_STEP_DEADLINE_MS = 0;
export const ROBOT_WALL_BUDGET_MS = 0;

export { getRobotTurnAdvice };

export function playRecommendedTurn(state, options = {}) {
  return playUnifiedRobotTurn(state, options);
}
