/**
 * 你对J占牌：老史（机器人）有四炸K 时不应拆成对K压队友（P10 + P7）
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { playRecommendedTurn } from "../coach/robot-player.mjs";
import { buildFormalRobotPlayOptions } from "../simulation/opponent-persona.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import { breaksBombIntegrity } from "../strategy/scorers/structure.mjs";
import {
  shouldRobotYieldPassToPartner,
  enrichScoringContext,
} from "../strategy/table-context.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);
const levelRank = "3";
const userPairJ = classifyPlay([c("J", SUITS.diamonds), c("J", SUITS.hearts)], levelRank);
const passPlay = classifyPlay([], levelRank);

const laoshiHand = [
  c("K", SUITS.clubs), c("K", SUITS.spades), c("K", SUITS.hearts), c("K", SUITS.diamonds),
  c("Q", SUITS.hearts), c("10", SUITS.diamonds), c("9", SUITS.clubs),
  c("8", SUITS.hearts),
  ...Array.from({ length: 18 }, (_, i) => c("4", SUITS.diamonds, i)),
];
const filler = Array.from({ length: 27 }, (_, i) => c("6", SUITS.clubs, i));

const pairK = classifyPlay(laoshiHand.slice(0, 2), levelRank);
if (!breaksBombIntegrity(pairK, laoshiHand, levelRank, {})) {
  console.error("FAIL: 四炸K 拆成对K 应判 breaksBombIntegrity");
  process.exit(1);
}

let state = createGameStateFromHands({
  levelRank,
  hands: [filler, filler, laoshiHand, filler],
  currentPlayerIndex: 2,
});
state = {
  ...state,
  lastActivePlay: userPairJ,
  lastActivePlayerIndex: 0,
  passCount: 1,
  playHistory: [
    { turnNumber: 68, playerIndex: 0, play: userPairJ },
    { turnNumber: 69, playerIndex: 1, play: passPlay },
  ],
};

const ctx = enrichScoringContext(
  { state, playerIndex: 2, scoringAudience: "robot", lite: true },
  [],
  laoshiHand,
  levelRank,
);
if (!shouldRobotYieldPassToPartner(ctx)) {
  console.error("FAIL: 机器人队友占牌应让牌");
  process.exit(1);
}

const rec = recommendPlay(laoshiHand, levelRank, userPairJ, {
  state,
  playerIndex: 2,
  scoringAudience: "robot",
  lite: true,
  mlFusionMode: "off",
});
if (rec.candidate?.type !== PLAY_TYPES.pass) {
  console.error("FAIL: recommendPlay 应过牌，实际", rec.candidate?.type, rec.candidate?.mainRank);
  process.exit(1);
}

const turn = playRecommendedTurn(state, {
  ...buildFormalRobotPlayOptions(state, 2),
  deadline: performance.now() + 8000,
});
const top = turn.recommendation.candidate;
if (top.type !== PLAY_TYPES.pass) {
  console.error(
    "FAIL: 老史有四炸K 不宜对K压你对J，实际",
    top.type,
    top.mainRank,
    turn.recommendation.reasons?.slice(0, 4),
  );
  process.exit(1);
}

console.log("PASS: 四炸K + 你对J占牌 → 老史 Top1 = Pass（不拆炸、不压队友）");
