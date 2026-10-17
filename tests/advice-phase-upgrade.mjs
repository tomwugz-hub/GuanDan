/**
 * 人类建议：同一牌局多次调用统一决策内核，Top1 签名应稳定（quick/full 均走 decide）。
 */
import { SUITS, classifyPlay, createCard, createGameStateFromHands } from "../src/index.mjs";
import { playSignature } from "../engine/card.mjs";
import { getHumanTurnAdvice } from "../coach/human-advice.mjs";

function cards(specs) {
  return specs.map(([rank, suit = SUITS.spades, deckIndex = 0]) => createCard(rank, suit, deckIndex));
}

const hand = cards([
  ["5", SUITS.hearts], ["6", SUITS.clubs], ["7", SUITS.diamonds], ["8", SUITS.spades], ["9", SUITS.hearts],
  ["J", SUITS.clubs], ["Q", SUITS.diamonds], ["K", SUITS.spades], ["A", SUITS.clubs], ["2", SUITS.diamonds],
  ["3", SUITS.hearts], ["4", SUITS.clubs], ["6", SUITS.diamonds], ["8", SUITS.hearts], ["10", SUITS.spades],
  ["10", SUITS.clubs],
]);
const single3 = classifyPlay([createCard("3", SUITS.diamonds, 1)], "2");
let state = createGameStateFromHands({
  levelRank: "2",
  hands: [hand, hand, hand, hand],
  currentPlayerIndex: 0,
});
state = { ...state, lastActivePlay: single3, lastActivePlayerIndex: 1 };

const first = getHumanTurnAdvice(state, 0, { alternatives: 3 });
const second = getHumanTurnAdvice(state, 0, { alternatives: 6 });
if (first.status !== "ok" || second.status !== "ok") {
  console.error("FAIL: 决策内核应返回 ok", first.status, second.status);
  process.exit(1);
}
const sig1 = playSignature(first.recommendation.candidate);
const sig2 = playSignature(second.recommendation.candidate);
if (sig1 !== sig2) {
  console.error("FAIL: 重复计算 Top1 不一致", sig1, "vs", sig2);
  process.exit(1);
}

console.log("PASS advice-phase-upgrade:", sig1);
