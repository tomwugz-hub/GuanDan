/**
 * P11 报双：对手剩 2 张时接风/领出不宜出对子，宜单探留王回收
 * 回归 match-10 第 55 手（勇哥对 10 喂对 J 走头游）
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { playRecommendedTurn } from "../coach/robot-player.mjs";
import { buildFormalRobotPlayOptions } from "../simulation/opponent-persona.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";

const c = (rank, suit, deckIndex = 0) => createCard(rank, suit, deckIndex);
const passPlay = (levelRank) => classifyPlay([], levelRank);

function assertOk(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
}

/** match-10 turn55：你剩对 J，勇哥接风 */
function buildMatch10Turn55State() {
  const yonggeHand = [
    c("2", SUITS.hearts),
    c("3", SUITS.spades), c("4", SUITS.spades), c("5", SUITS.spades),
    c("6", SUITS.spades), c("7", SUITS.spades),
    c("10", SUITS.spades, 0), c("10", SUITS.spades, 1),
    c("Q", SUITS.clubs),
    c("K", SUITS.spades, 1),
    c("A", SUITS.spades, 0),
    c("BJ", SUITS.joker, 0),
  ];
  const userHand = [c("J", SUITS.hearts), c("J", SUITS.spades)];
  const filler = Array.from({ length: 6 }, (_, i) => c("3", SUITS.diamonds, i));
  const oppFiller = Array.from({ length: 13 }, (_, i) => c("8", SUITS.clubs, i % 2));

  const kBomb = classifyPlay([
    c("K", SUITS.clubs), c("K", SUITS.diamonds), c("K", SUITS.diamonds, 1), c("K", SUITS.hearts),
  ], "A");

  let state = createGameStateFromHands({
    levelRank: "A",
    hands: [userHand, yonggeHand, filler, oppFiller],
    currentPlayerIndex: 1,
  });
  state = {
    ...state,
    lastActivePlay: null,
    lastActivePlayerIndex: null,
    passCount: 0,
    playHistory: [
      { turnNumber: 51, playerIndex: 1, play: kBomb },
      { turnNumber: 52, playerIndex: 2, play: passPlay("A") },
      { turnNumber: 53, playerIndex: 3, play: passPlay("A") },
      { turnNumber: 54, playerIndex: 0, play: passPlay("A") },
    ],
  };
  return state;
}

const turn55 = playRecommendedTurn(
  buildMatch10Turn55State(),
  buildFormalRobotPlayOptions(buildMatch10Turn55State(), 1),
);
const top55 = turn55.recommendation.candidate;
assertOk(
  top55.type !== PLAY_TYPES.pair,
  `match-10 turn55 对手报双接风不宜出对10，实际 ${top55.label ?? top55.type}`,
);
assertOk(
  top55.type === PLAY_TYPES.single,
  `match-10 turn55 宜单探留王，实际 ${top55.label ?? top55.type}`,
);

/** 泛化：任意接风 + 对手报双 + 有王，不出对 */
const genericHand = [
  c("4", SUITS.hearts), c("5", SUITS.diamonds), c("6", SUITS.clubs),
  c("8", SUITS.spades), c("8", SUITS.hearts),
  c("9", SUITS.diamonds), c("10", SUITS.clubs), c("10", SUITS.diamonds),
  c("Q", SUITS.spades), c("K", SUITS.hearts), c("BJ", SUITS.joker, 0),
];
let genericState = createGameStateFromHands({
  levelRank: "5",
  hands: [
    [c("J", SUITS.clubs), c("J", SUITS.diamonds)],
    genericHand,
    Array.from({ length: 10 }, (_, i) => c("3", SUITS.clubs, i % 2)),
    Array.from({ length: 12 }, (_, i) => c("7", SUITS.clubs, i % 2)),
  ],
  currentPlayerIndex: 1,
});
genericState = {
  ...genericState,
  lastActivePlay: null,
  lastActivePlayerIndex: null,
  passCount: 0,
  playHistory: [
    { turnNumber: 1, playerIndex: 1, play: classifyPlay([c("A", SUITS.spades)], "5") },
    { turnNumber: 2, playerIndex: 2, play: passPlay("5") },
    { turnNumber: 3, playerIndex: 3, play: passPlay("5") },
    { turnNumber: 4, playerIndex: 0, play: passPlay("5") },
  ],
};
const genericRec = recommendPlay(genericHand, "5", null, {
  state: genericState,
  playerIndex: 1,
  isOpening: true,
  leadMode: "catch-wind",
  scoringAudience: "human-lite",
  mlFusionMode: "off",
  mlModel: false,
});
assertOk(
  genericRec.candidate.type !== PLAY_TYPES.pair,
  `泛化报双接风不宜出对，实际 ${genericRec.candidate.label ?? genericRec.candidate.type}`,
);
assertOk(
  genericRec.candidate.type === PLAY_TYPES.single,
  `泛化报双接风宜单探，实际 ${genericRec.candidate.label ?? genericRec.candidate.type}`,
);

console.log("PASS: opponent-two-card-catch-wind-lead (P11 报双接风)");
