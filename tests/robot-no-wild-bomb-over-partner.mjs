/**
 * 队友出级牌对子占牌：机器人不宜逢人配凑炸压队友（勇哥压毛蛋）
 */
import { createCard, SUITS, isWildCard } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { playRecommendedTurn, fastRobotFallback } from "../coach/robot-player.mjs";
import { buildFormalRobotPlayOptions } from "../simulation/opponent-persona.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

const filler = Array.from({ length: 22 }, (_, i) => c("4", SUITS.diamonds, i));
const yongHand = [
  c("3", SUITS.clubs), c("3", SUITS.spades),
  c("J", SUITS.hearts), c("J", SUITS.diamonds),
  c("5", SUITS.clubs), c("5", SUITS.diamonds),
  c("6", SUITS.hearts), c("7", SUITS.spades),
  c("8", SUITS.clubs), c("9", SUITS.diamonds),
  c("10", SUITS.hearts), c("Q", SUITS.clubs),
  c("K", SUITS.spades), c("A", SUITS.clubs),
  c("2", SUITS.diamonds), c("2", SUITS.hearts),
  c("4", SUITS.spades), c("6", SUITS.clubs),
  c("7", SUITS.diamonds), c("8", SUITS.hearts),
  c("9", SUITS.clubs), c("10", SUITS.spades),
  c("Q", SUITS.diamonds), c("K", SUITS.hearts),
  c("A", SUITS.diamonds),
];

const partnerPairJ = classifyPlay([
  c("J", SUITS.clubs, 2), c("J", SUITS.spades, 3),
], "J");

let state = createGameStateFromHands({
  levelRank: "J",
  hands: [filler, yongHand, filler, filler],
  currentPlayerIndex: 1,
});

state = {
  ...state,
  lastActivePlay: partnerPairJ,
  lastActivePlayerIndex: 3,
  playHistory: [
    { turnNumber: 1, playerIndex: 0, play: classifyPlay([c("10", SUITS.clubs), c("10", SUITS.diamonds)], "J") },
    { turnNumber: 2, playerIndex: 3, play: partnerPairJ },
  ],
};

const tableCtx = {
  state,
  playerIndex: 1,
  lastActivePlayerIndex: 3,
  previousPlay: partnerPairJ,
  scoringAudience: "robot",
  lite: true,
};

const fallback = fastRobotFallback(yongHand, "J", partnerPairJ, tableCtx);
if (fallback.candidate.type !== PLAY_TYPES.pass) {
  console.error("FAIL: 兜底应过牌让队友，实际", fallback.candidate.type, fallback.candidate.mainRank);
  process.exit(1);
}

const turn = playRecommendedTurn(state, {
  ...buildFormalRobotPlayOptions(state, 1),
  lite: true,
  deadline: performance.now() + 8000,
});

const top = turn.recommendation.candidate;
const wildBomb = top.type === PLAY_TYPES.bomb
  && (top.cards ?? []).some((card) => isWildCard(card, "J"));

if (top.type !== PLAY_TYPES.pass && (BOMB_TYPES.has(top.type) || wildBomb)) {
  console.error(
    "FAIL: 不宜逢人配/炸弹压队友级牌对",
    top.label ?? top.mainRank,
    turn.recommendation.reasons?.slice(0, 4),
  );
  process.exit(1);
}

console.log("PASS: 勇哥 Top1 =", top.type, turn.recommendation.reasons?.[0] ?? "");
