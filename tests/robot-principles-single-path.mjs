/**
 * 机器人与人类同源：须走 decision-core，禁止再依赖 strategy 领出分叉。
 */
import { createCard } from "../engine/card.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { playRecommendedTurn } from "../coach/robot-player.mjs";
import { buildFormalRobotPlayOptions } from "../simulation/opponent-persona.mjs";

const c = (r, s, deckIndex = 0) => createCard(r, s, deckIndex);
const hand16 = [
  c("3", "S"), c("4", "H"), c("5", "D"), c("6", "C"), c("7", "S"), c("8", "H"),
  c("9", "D"), c("10", "C"), c("J", "S"), c("Q", "H"), c("K", "D"), c("A", "C"),
  c("7", "H"), c("7", "D"), c("9", "S"), c("9", "C"),
];
const state = createGameStateFromHands({
  levelRank: "5",
  hands: [hand16, hand16, hand16, hand16],
  currentPlayerIndex: 1,
});
const turn = playRecommendedTurn(state, buildFormalRobotPlayOptions(state, 1));
const { recommendation } = turn;

if (recommendation.candidate.type === PLAY_TYPES.single) {
  console.error("FAIL: 16张领出不宜首推单张");
  process.exit(1);
}
if (turn.diagnostics?.executionPath !== "decision-core") {
  console.error("FAIL: 机器人应走 decision-core，实际:", turn.diagnostics?.executionPath);
  process.exit(1);
}

console.log("PASS robot-principles-single-path");
console.log(" ", recommendation.candidate.type, recommendation.candidate.mainRank);
