import { isGameOver } from "../engine/game-state.mjs";
import { playRecommendedTurn } from "./robot-player.mjs";

export function runAutoGame(initialState, { maxTurns = 500 } = {}) {
  let state = initialState;
  const transcript = [];

  while (!isGameOver(state) && transcript.length < maxTurns) {
    const playerIndex = state.currentPlayerIndex;
    const { state: nextState, recommendation } = playRecommendedTurn(state);
    transcript.push({
      turnNumber: state.turnNumber,
      playerIndex,
      play: recommendation.candidate,
      score: recommendation.score,
      reasons: recommendation.reasons,
    });
    state = nextState;
  }

  return {
    state,
    transcript,
    isComplete: isGameOver(state),
    hitTurnLimit: !isGameOver(state) && transcript.length >= maxTurns,
  };
}
