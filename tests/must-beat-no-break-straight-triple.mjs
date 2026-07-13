/**
 * 须压对手小三张：不宜拆顺子/四炸组三张（如压三张4 拆78910J顺子或四Q炸弹）
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

const hand = [
  c("7", SUITS.clubs), c("8", SUITS.diamonds), c("9", SUITS.hearts),
  c("10", SUITS.diamonds), c("J", SUITS.clubs),
  c("8", SUITS.hearts), c("8", SUITS.spades),
  c("Q", SUITS.diamonds), c("Q", SUITS.hearts), c("Q", SUITS.clubs), c("Q", SUITS.spades),
  c("2", SUITS.spades), c("2", SUITS.hearts),
  c("3", SUITS.clubs), c("3", SUITS.diamonds),
  c("5", SUITS.diamonds), c("5", SUITS.hearts),
  c("6", SUITS.clubs), c("6", SUITS.diamonds),
  c("K", SUITS.clubs), c("A", SUITS.clubs), c("SJ"),
];

const filler = Array.from({ length: 27 }, (_, i) => c("3", SUITS.spades, i));
const oppTriple4 = classifyPlay([
  c("4", SUITS.clubs), c("4", SUITS.diamonds), c("4", SUITS.spades),
], "10");

let state = createGameStateFromHands({
  levelRank: "10",
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
});

state = {
  ...state,
  lastActivePlay: oppTriple4,
  lastActivePlayerIndex: 3,
  playHistory: [
    { turnNumber: 1, playerIndex: 3, play: oppTriple4 },
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

if (top.type === PLAY_TYPES.triple && (top.mainRank === "8" || top.mainRank === "Q")) {
  console.error(
    "FAIL: 不宜拆顺/四炸组三张压小三张",
    top.mainRank,
    advice.recommendation.reasons?.slice(0, 4),
  );
  process.exit(1);
}

if (top.type !== PLAY_TYPES.pass) {
  console.error(
    "FAIL: 无结构安全三张可压，Top1 应为过牌",
    top.type,
    top.mainRank ?? "",
    advice.recommendation.reasons?.slice(0, 4),
  );
  process.exit(1);
}

console.log("PASS: 压小三张保留结构，Top1 = pass", advice.recommendation.reasons?.[0] ?? "");
