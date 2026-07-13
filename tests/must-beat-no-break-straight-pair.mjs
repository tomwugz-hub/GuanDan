/**
 * 须压对手对8：不宜拆顺子/同花顺组对（如 78910J 顺子内 8、红桃同花顺内 Q）
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

const hand = [
  c("10", SUITS.hearts), c("J", SUITS.hearts), c("Q", SUITS.hearts),
  c("K", SUITS.hearts), c("A", SUITS.hearts),
  c("7", SUITS.spades), c("8", SUITS.clubs), c("9", SUITS.diamonds),
  c("10", SUITS.spades), c("J", SUITS.clubs),
  c("8", SUITS.diamonds), c("8", SUITS.hearts),
  c("Q", SUITS.diamonds), c("Q", SUITS.clubs),
  c("2", SUITS.spades), c("2", SUITS.hearts),
  c("3", SUITS.clubs), c("3", SUITS.diamonds),
  c("4", SUITS.hearts), c("4", SUITS.spades),
  c("5", SUITS.diamonds), c("5", SUITS.hearts),
  c("6", SUITS.clubs), c("6", SUITS.diamonds),
  c("K", SUITS.clubs), c("A", SUITS.clubs), c("SJ"),
];

const filler = Array.from({ length: 27 }, (_, i) => c("3", SUITS.spades, i));
const oppPair8 = classifyPlay([
  c("8", SUITS.spades, 1), c("8", SUITS.hearts, 2),
], "10");

let state = createGameStateFromHands({
  levelRank: "10",
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
});

state = {
  ...state,
  lastActivePlay: oppPair8,
  lastActivePlayerIndex: 1,
  playHistory: [
    { turnNumber: 1, playerIndex: 1, play: oppPair8 },
  ],
};

const advice = getTurnAdvice(state, 0, {
  lite: false,
  scoringAudience: "human-lite",
  maxCandidates: 96,
  deadline: performance.now() + 8000,
  alternatives: 3,
});

const top = advice.recommendation.candidate;
const badPair = top.type === PLAY_TYPES.pair && (top.mainRank === "8" || top.mainRank === "J");

if (badPair) {
  console.error(
    "FAIL: 不宜拆顺/同花顺组对压对8",
    top.mainRank,
    advice.recommendation.reasons?.slice(0, 4),
  );
  process.exit(1);
}

if (top.type === PLAY_TYPES.pair) {
  console.log("PASS: 压对8用结构外对子，Top1 =", top.type, top.mainRank, advice.recommendation.reasons?.[0] ?? "");
  process.exit(0);
}

if (top.type !== PLAY_TYPES.pass) {
  console.error(
    "FAIL: 无结构安全对子可压，Top1 应为过牌",
    top.type,
    top.mainRank ?? "",
    advice.recommendation.reasons?.slice(0, 4),
  );
  process.exit(1);
}

console.log("PASS: 压对8保留结构，Top1 = pass", advice.recommendation.reasons?.[0] ?? "");
