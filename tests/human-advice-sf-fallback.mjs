/**
 * 须压小单 + 手牌含同花顺：quick/应急兜底均不应拆同花顺出 5♠
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { humanAdviceFallback } from "../coach/robot-player.mjs";
import { buildStrategicGroups } from "../strategy/strategic-groups.mjs";
import { breaksPremiumStraightOrJokerGroup } from "../strategy/principles.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

const hand = [
  c("5"), c("6"), c("7"), c("8"), c("9"),
  c("6", SUITS.clubs), c("6", SUITS.hearts), c("8", SUITS.hearts),
  c("J", SUITS.clubs), c("8", SUITS.diamonds), c("J", SUITS.diamonds), c("J", SUITS.hearts),
  c("3", SUITS.diamonds), c("7", SUITS.diamonds), c("7", SUITS.hearts), c("9", SUITS.clubs),
  c("Q"), c("Q", SUITS.hearts), c("K", SUITS.diamonds),
  c("A", SUITS.diamonds), c("A", SUITS.hearts), c("SJ", SUITS.joker),
];

const prev = classifyPlay([c("3")], "8");
let state = createGameStateFromHands({
  levelRank: "8",
  hands: [hand, hand, hand, hand],
  currentPlayerIndex: 0,
});
state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };

const preferredGroups = buildStrategicGroups(hand, "8");
const sfGroup = preferredGroups.find((group) => group.play?.type === PLAY_TYPES.straightFlush);
if (!sfGroup) {
  console.error("FAIL: 手牌应含黑桃56789同花顺分组");
  process.exit(1);
}

const emergency = humanAdviceFallback(hand, "8", prev, preferredGroups);
const emergencyBreaksSf = breaksPremiumStraightOrJokerGroup(
  emergency.candidate,
  preferredGroups,
  "8",
);
if (emergencyBreaksSf) {
  console.error(
    "FAIL: 应急兜底不应拆同花顺，实际",
    emergency.candidate.label ?? emergency.candidate.mainRank,
    emergency.reasons,
  );
  process.exit(1);
}

const advice = getTurnAdvice(state, 0, {
  alternatives: 2,
  preferredGroups,
  handProfile: null,
  maxCandidates: 12,
  lite: true,
  mlFusionMode: "off",
  deadline: performance.now() + 2500,
});

const top = advice.recommendation.candidate;
const topBreaksSf = breaksPremiumStraightOrJokerGroup(top, preferredGroups, "8");
if (topBreaksSf) {
  console.error(
    "FAIL: lite quick 不应拆同花顺压单3，实际",
    top.label ?? top.mainRank,
    advice.recommendation.reasons,
  );
  process.exit(1);
}

if (top.type !== PLAY_TYPES.single) {
  console.error("FAIL: 应首推单张压牌，实际", top.type, top.label);
  process.exit(1);
}

console.log("PASS: 压单3 不拆同花顺，应急=", emergency.candidate.mainRank, "quick=", top.mainRank);
