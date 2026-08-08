/**
 * 《掼蛋实战100例》教纲冒烟 — 导入 golden + 模块存在性
 */
import "./golden-case-100cases.mjs";
import { cases100Adjustment } from "../strategy/guandan-100cases-principles.mjs";
import { classifyPlay, createCard, createGameStateFromHands, SUITS } from "../src/index.mjs";

if (typeof cases100Adjustment !== "function") {
  throw new Error("guandan-100cases-principles 未导出 cases100Adjustment");
}

const hand = [createCard("6", SUITS.hearts, 0)];
const state = createGameStateFromHands({
  levelRank: "2",
  hands: [hand, [createCard("3", SUITS.clubs, 0)], [createCard("4", SUITS.diamonds, 0)], [createCard("5", SUITS.spades, 0)]],
  currentPlayerIndex: 0,
});
const adj = cases100Adjustment(
  classifyPlay([], "2"),
  hand,
  "2",
  { state, playerIndex: 0, isOpening: true, leadMode: "fresh-open", handProfile: { role: "support", score: 4 } },
);
if (!adj || !Array.isArray(adj.reasons)) {
  throw new Error("cases100Adjustment 返回结构异常");
}

console.log("100cases-smoke：通过（golden 203 场景 + 模块检查）");
