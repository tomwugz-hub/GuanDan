/**
 * 机器人接风：不宜空扔级牌对（级牌3 仅两张），应与人类同源走三带二/小对
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { playRecommendedTurn, fastRobotFallback } from "../coach/robot-player.mjs";
import { buildFormalRobotPlayOptions } from "../simulation/opponent-persona.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);
const filler = () => Array.from({ length: 27 }, (_, i) => c("6", SUITS.clubs, i));

const handPair3Only = [
  c("3", SUITS.clubs, 0), c("3", SUITS.spades, 0),
  c("7", SUITS.hearts, 0), c("8", SUITS.hearts, 0), c("9", SUITS.hearts, 0),
  c("10", SUITS.hearts, 0), c("J", SUITS.hearts, 0),
  c("J", SUITS.spades, 0), c("J", SUITS.clubs, 0),
  c("2", SUITS.diamonds, 0), c("2", SUITS.hearts, 0), c("2", SUITS.clubs, 0),
  c("4", SUITS.spades, 0), c("4", SUITS.clubs, 0),
  c("K", SUITS.spades, 0), c("K", SUITS.diamonds, 0), c("Q", SUITS.diamonds, 0),
];

const handTriple3 = [
  c("3", SUITS.clubs, 0), c("3", SUITS.spades, 0), c("3", SUITS.diamonds, 0),
  c("7", SUITS.hearts, 0), c("8", SUITS.hearts, 0), c("9", SUITS.hearts, 0),
  c("10", SUITS.hearts, 0), c("J", SUITS.hearts, 0),
  c("J", SUITS.spades, 0), c("J", SUITS.clubs, 0),
  c("2", SUITS.diamonds, 0), c("2", SUITS.hearts, 0), c("2", SUITS.clubs, 0),
  c("4", SUITS.spades, 0), c("4", SUITS.clubs, 0),
  c("K", SUITS.spades, 0), c("K", SUITS.diamonds, 0),
];

function catchWindState(hand) {
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [filler(), hand, filler(), filler()],
    currentPlayerIndex: 1,
  });
  return {
    ...state,
    lastActivePlay: null,
    lastActivePlayerIndex: null,
    playHistory: [
      { turnNumber: 1, playerIndex: 0, play: classifyPlay([], "3") },
      { turnNumber: 2, playerIndex: 3, play: classifyPlay([], "3") },
      { turnNumber: 3, playerIndex: 2, play: classifyPlay([], "3") },
    ],
  };
}

function assertRobotLead(label, hand, forbidPairRank) {
  const state = catchWindState(hand);
  const { recommendation } = playRecommendedTurn(state, buildFormalRobotPlayOptions(state, 1));
  const { candidate, reasons } = recommendation;
  if (candidate.type === PLAY_TYPES.pair && candidate.mainRank === forbidPairRank) {
    console.error(`FAIL ${label}: 不宜接风裸出级牌对${forbidPairRank}，实际对${candidate.mainRank}`, reasons?.[0]);
    process.exit(1);
  }
  if (!reasons?.[0]?.includes("同源原则") && !reasons?.[0]?.includes("兜底")) {
    console.error(`FAIL ${label}: 理由应含同源原则/兜底，实际`, reasons?.[0]);
    process.exit(1);
  }
  console.log(`  ✓ ${label}:`, candidate.type, candidate.mainRank ?? "", reasons[0]);
}

assertRobotLead("仅对3", handPair3Only, "3");
assertRobotLead("三个3", handTriple3, "3");

// 超时兜底路径也不得裸出级牌对
const state = catchWindState(handPair3Only);
const fb = fastRobotFallback(handPair3Only, "3", null, {
  state,
  playerIndex: 1,
  scoringAudience: "robot",
  lite: true,
  deadline: 0,
});
if (fb.candidate?.type === PLAY_TYPES.pair && fb.candidate.mainRank === "3") {
  console.error("FAIL: fastRobotFallback 不得裸出级牌对3");
  process.exit(1);
}
console.log("  ✓ 超时兜底:", fb.candidate.type, fb.candidate.mainRank ?? "");

console.log("PASS: 机器人接风不空扔级牌对3");
