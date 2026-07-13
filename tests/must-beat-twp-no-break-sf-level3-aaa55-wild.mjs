/**
 * 竞技第6局截图近似：红桃 7–J / 8–J 同花顺跑道 + 逢人配 3♥，
 * 须压 QQQ+55 时不应首推 AAA55（红桃3当黑桃A）——仅动用逢人配也算拆跑道。
 */
import { createCard, SUITS, playSignature } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import { humanAdviceFallback } from "../coach/robot-player.mjs";
import { breaksStrategicPremiumForTripleWithPair } from "../strategy/scorers/structure.mjs";
import { breaksStraightFlushRunwayOnMustBeatTwp } from "../strategy/sf-runway-guard.mjs";
import { buildStrategicGroups, mergePremiumStrategicGroups } from "../strategy/strategic-groups.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

const hand = [
  c("3", SUITS.hearts), c("7", SUITS.diamonds), c("9", SUITS.hearts), c("10", SUITS.diamonds), c("J", SUITS.diamonds),
  c("8", SUITS.spades), c("8", SUITS.hearts), c("9", SUITS.spades), c("9", SUITS.diamonds), c("10", SUITS.spades), c("10", SUITS.hearts),
  c("A", SUITS.clubs), c("2", SUITS.spades), c("3", SUITS.clubs), c("4", SUITS.diamonds), c("5", SUITS.clubs),
  c("J", SUITS.hearts), c("J", SUITS.hearts, 1), c("J", SUITS.diamonds),
  c("5", SUITS.spades), c("7", SUITS.hearts), c("A", SUITS.spades),
];

const oppQQQ55 = classifyPlay([
  c("Q", SUITS.clubs), c("Q", SUITS.diamonds), c("Q", SUITS.spades),
  c("5", SUITS.clubs, 1), c("5", SUITS.diamonds),
], "3");

const filler = Array.from({ length: 18 }, () => c("6", SUITS.clubs, 2));
const state = createGameStateFromHands({
  levelRank: "3",
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: oppQQQ55,
  lastActivePlayerIndex: 1,
});

const columnGroups = [
  { label: "列1", cards: hand.slice(0, 5), play: classifyPlay(hand.slice(0, 5), "3") },
  { label: "列2", cards: hand.slice(5, 11), play: classifyPlay(hand.slice(5, 11), "3") },
  { label: "列3", cards: hand.slice(11, 19), play: classifyPlay(hand.slice(11, 19), "3") },
  { label: "列4", cards: hand.slice(19, 22), play: classifyPlay(hand.slice(19, 22), "3") },
];
const preferredGroups = mergePremiumStrategicGroups(
  columnGroups,
  hand,
  "3",
  buildStrategicGroups(hand, "3"),
);

const aaa55Wild = classifyPlay([
  c("5", SUITS.clubs), c("A", SUITS.clubs), c("3", SUITS.hearts),
  c("5", SUITS.spades), c("A", SUITS.spades),
], "3");

const beatCtx = { opponentActive: true, previousPlay: oppQQQ55, preferredGroups, state, playerIndex: 0 };
if (!breaksStrategicPremiumForTripleWithPair(aaa55Wild, hand, "3", preferredGroups, beatCtx)) {
  throw new Error("AAA55(3♥当A) 应判定为拆红桃同花顺跑道");
}
if (!breaksStraightFlushRunwayOnMustBeatTwp(aaa55Wild, hand, "3", beatCtx)) {
  throw new Error("须压三带二门禁应拦截 AAA55 拆跑道");
}

function assertNotBreakingSfTop1(top, label) {
  if (top.candidate?.type === PLAY_TYPES.pass) return;
  if (top.candidate?.type !== PLAY_TYPES.tripleWithPair) return;
  if (!breaksStraightFlushRunwayOnMustBeatTwp(top.candidate, hand, "3", beatCtx)) return;
  throw new Error(`${label} 不应首推拆跑道三带二，实际 ${playSignature(top.candidate)}`);
}

const rec = recommendPlay(hand, "3", oppQQQ55, {
  state,
  playerIndex: 0,
  preferredGroups,
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 16,
  mlFusionMode: "off",
});
assertNotBreakingSfTop1(rec, "recommendPlay");

const advice = getTurnAdvice(state, 0, {
  preferredGroups,
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 12,
  alternatives: 3,
  deadline: performance.now() + 8000,
});
assertNotBreakingSfTop1(advice.recommendation, "getTurnAdvice");

const emergency = humanAdviceFallback(hand, "3", oppQQQ55, preferredGroups, {
  state,
  playerIndex: 0,
  lastActivePlayerIndex: 1,
});
assertNotBreakingSfTop1(emergency, "humanAdviceFallback");

console.log("PASS: 级牌3 AAA55(仅逢人配) 须压 QQQ+55 不拆红桃同花顺跑道");
