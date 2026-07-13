/**
 * 领出/接风：有 345 连对时不宜拆对出单3（应急与 human-lite 主路径）
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { humanAdviceFallback } from "../coach/robot-player.mjs";
import { mergePremiumStrategicGroups } from "../strategy/strategic-groups.mjs";
import { breaksPreferredStrategicGroup } from "../strategy/principles.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

const cp345 = [
  c("3", SUITS.hearts), c("3", SUITS.diamonds),
  c("4", SUITS.hearts), c("4", SUITS.clubs),
  c("5", SUITS.spades), c("5", SUITS.clubs),
];
const sf = [
  c("4", SUITS.diamonds), c("5", SUITS.diamonds), c("6", SUITS.diamonds),
  c("7", SUITS.diamonds), c("8", SUITS.diamonds),
];
const hand = [
  ...cp345,
  ...sf,
  c("6", SUITS.spades, 0), c("6", SUITS.spades, 1), c("6", SUITS.clubs), c("6", SUITS.hearts),
  c("7", SUITS.hearts), c("7", SUITS.diamonds),
  c("10", SUITS.hearts), c("10", SUITS.diamonds),
  c("A", SUITS.hearts), c("A", SUITS.diamonds),
  c("9", SUITS.clubs), c("J", SUITS.spades), c("K", SUITS.spades),
];

const columnGroups = [
  { cards: cp345, label: "连对 3-4-5" },
  { cards: sf, label: "方片45678同花顺" },
  { cards: hand.slice(11, 15), label: "四炸6" },
];
const preferredGroups = mergePremiumStrategicGroups(columnGroups, hand, "2");

const single3 = classifyPlay([c("3", SUITS.hearts)], "2");
if (!breaksPreferredStrategicGroup(single3, preferredGroups, "2", hand)) {
  console.error("FAIL: 单3 应判定为拆 345 连对");
  process.exit(1);
}

const filler = Array.from({ length: 24 }, (_, i) => c("2", SUITS.clubs, i));
let state = createGameStateFromHands({
  levelRank: "2",
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
});
state = { ...state, lastActivePlay: null };

const emergency = humanAdviceFallback(hand, "2", null, preferredGroups);
if (emergency.candidate.type === PLAY_TYPES.single && emergency.candidate.mainRank === "3") {
  console.error("FAIL: 应急兜底不宜拆 345 连对出单3", emergency.reasons);
  process.exit(1);
}

const advice = getTurnAdvice(state, 0, {
  lite: true,
  scoringAudience: "human-lite",
  preferredGroups,
  maxCandidates: 24,
  deadline: performance.now() + 8000,
  alternatives: 2,
});
const top = advice.recommendation.candidate;
if (top.type === PLAY_TYPES.single && ["3", "4", "5"].includes(top.mainRank)) {
  console.error(
    "FAIL: human-lite 不宜拆 345 连对出单",
    top.mainRank,
    advice.recommendation.reasons?.slice(0, 4),
  );
  process.exit(1);
}

console.log(
  "PASS: 有345连对 Top1 =",
  top.type === PLAY_TYPES.pass ? "Pass" : `${top.type} ${top.mainRank ?? ""}`,
  "应急 =",
  emergency.candidate.type === PLAY_TYPES.pass ? "Pass" : `${emergency.candidate.type} ${emergency.candidate.mainRank ?? ""}`,
);
