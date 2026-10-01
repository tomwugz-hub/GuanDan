import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getUnifiedTurnAdvice } from "./decision-adapter.mjs";

export function getHumanTurnAdvice(state, playerIndex = state.currentPlayerIndex, options = {}) {
  return getUnifiedTurnAdvice(state, playerIndex, options);
}

/** Compatibility wrapper for callers that still pass the legacy argument list. */
export function resolveHumanRecommendation(
  _hand,
  _levelRank,
  _previousPlay,
  tableContext = {},
  { alternatives = 3 } = {},
) {
  const state = tableContext.state;
  const playerIndex = tableContext.playerIndex ?? state?.currentPlayerIndex;
  if (!state || !Number.isInteger(playerIndex)) {
    return { status: "error", candidate: null, reasons: ["缺少完整牌局状态。"] };
  }
  const advice = getHumanTurnAdvice(state, playerIndex, { alternatives });
  if (advice.status !== "ok") {
    return { status: advice.status, candidate: null, reasons: ["本次分析未完成。"] };
  }
  return { status: "ok", ...advice.recommendation };
}

/** Placeholder is display state only and can never become a finalized Top1. */
export function resolveHumanPlaceholderFast() {
  return {
    status: "analyzing",
    candidate: null,
    score: null,
    reasons: ["正在分析，请稍候。"],
  };
}

export function resolveHumanPlaceholder(...args) {
  return resolveHumanPlaceholderFast(...args);
}

export function placeholderCandidateValid(candidate, previousPlay) {
  if (!candidate) return false;
  const mustLead = !previousPlay || previousPlay.type === PLAY_TYPES.pass;
  return !mustLead || candidate.type !== PLAY_TYPES.pass;
}
