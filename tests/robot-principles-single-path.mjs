/**
 * 机器人与人类同源：快路径领出/须压须走 principles，禁止独立 pickRobotOpeningLead 分叉
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createCard } from "../engine/card.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { playRecommendedTurn } from "../coach/robot-player.mjs";
import { buildFormalRobotPlayOptions } from "../simulation/opponent-persona.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const recommendSource = readFileSync(join(root, "strategy", "recommend.mjs"), "utf8");

if (/pickRobotOpeningLead/.test(recommendSource)) {
  console.error("FAIL: recommend.mjs 不得再含 pickRobotOpeningLead 机器人分叉");
  process.exit(1);
}
if (!/pickRobotLeadByPrinciples/.test(recommendSource)
  || !/pickOpeningLeadFallback/.test(recommendSource)) {
  console.error("FAIL: 机器人领出应经 pickRobotLeadByPrinciples → pickOpeningLeadFallback");
  process.exit(1);
}

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
const { recommendation } = playRecommendedTurn(state, buildFormalRobotPlayOptions(state, 1));

if (recommendation.candidate.type === PLAY_TYPES.single) {
  console.error("FAIL: 16张领出不宜首推单张");
  process.exit(1);
}
if (!recommendation.reasons?.[0]?.includes("同源原则")) {
  console.error("FAIL: 机器人领出理由应标明同源原则，实际:", recommendation.reasons?.[0]);
  process.exit(1);
}

console.log("PASS robot-principles-single-path");
console.log(" ", recommendation.candidate.type, recommendation.candidate.mainRank, recommendation.reasons[0]);
