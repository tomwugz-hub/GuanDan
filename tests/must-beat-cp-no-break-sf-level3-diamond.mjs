/**
 * 级牌3 截图（方片 7-J 同花顺拆列）：须压 223344 连对，
 * 不宜 99-1010-JJ 拆方片同花顺跑道。
 */
import { createCard, SUITS, playSignature } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import { humanAdviceFallback } from "../coach/robot-player.mjs";
import { breaksStrategicPremiumForConsecutivePairs } from "../strategy/scorers/structure.mjs";
import { breaksStraightFlushRunwayOnMustBeatCp } from "../strategy/sf-runway-guard.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

const hand = [
  c("3", SUITS.diamonds), c("7", SUITS.diamonds), c("8", SUITS.diamonds), c("9", SUITS.diamonds), c("10", SUITS.diamonds), c("J", SUITS.diamonds),
  c("8", SUITS.spades), c("9", SUITS.spades), c("10", SUITS.spades), c("10", SUITS.clubs),
  c("A", SUITS.clubs), c("2", SUITS.clubs), c("3", SUITS.clubs), c("4", SUITS.clubs), c("5", SUITS.clubs),
  c("J", SUITS.hearts), c("J", SUITS.hearts, 1), c("J", SUITS.spades),
  c("5", SUITS.spades), c("7", SUITS.hearts), c("A", SUITS.spades), c("9", SUITS.hearts),
];

const oppCp = classifyPlay([
  c("2", SUITS.spades), c("2", SUITS.spades, 1),
  c("3", SUITS.clubs), c("3", SUITS.clubs, 1),
  c("4", SUITS.clubs, 2), c("4", SUITS.hearts),
], "3");

const filler = Array.from({ length: 18 }, () => c("6", SUITS.clubs, 3));
const state = createGameStateFromHands({
  levelRank: "3",
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: oppCp,
  lastActivePlayerIndex: 1,
});

const columnGroups = [
  { label: "列1", cards: hand.slice(0, 6), play: classifyPlay(hand.slice(0, 6), "3") },
  { label: "列2", cards: hand.slice(6, 10), play: classifyPlay(hand.slice(6, 10), "3") },
  { label: "列3", cards: hand.slice(10, 15), play: classifyPlay(hand.slice(10, 15), "3") },
  { label: "三张J", cards: hand.slice(15, 18), play: classifyPlay(hand.slice(15, 18), "3") },
  { label: "散牌", cards: hand.slice(18, 22), play: classifyPlay(hand.slice(18, 22), "3") },
];

const screenshotCp = classifyPlay([
  c("9", SUITS.diamonds), c("9", SUITS.hearts),
  c("10", SUITS.diamonds), c("10", SUITS.clubs),
  c("J", SUITS.diamonds), c("J", SUITS.hearts, 1),
], "3");

const beatCtx = { opponentActive: true, previousPlay: oppCp, preferredGroups: columnGroups, state, playerIndex: 0 };
if (!breaksStrategicPremiumForConsecutivePairs(screenshotCp, hand, "3", beatCtx)) {
  throw new Error("截图连对应判定为拆方片同花顺跑道");
}
if (!breaksStraightFlushRunwayOnMustBeatCp(screenshotCp, hand, "3", beatCtx)) {
  throw new Error("须压连对门禁应拦截拆跑道连对");
}

function assertNotBreakingSfTop1(top, label) {
  if (top.candidate?.type !== PLAY_TYPES.consecutivePairs) return;
  if (!breaksStraightFlushRunwayOnMustBeatCp(top.candidate, hand, "3", beatCtx)) return;
  throw new Error(`${label} 不应首推拆同花顺连对，实际 ${playSignature(top.candidate)}`);
}

const rec = recommendPlay(hand, "3", oppCp, {
  state,
  playerIndex: 0,
  preferredGroups: columnGroups,
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 12,
  mlFusionMode: "off",
});
assertNotBreakingSfTop1(rec, "recommendPlay");

const advice = getTurnAdvice(state, 0, {
  preferredGroups: columnGroups,
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 12,
  alternatives: 3,
  deadline: performance.now() + 8000,
});
assertNotBreakingSfTop1(advice.recommendation, "getTurnAdvice");

const emergency = humanAdviceFallback(hand, "3", oppCp, columnGroups, {
  state,
  playerIndex: 0,
  lastActivePlayerIndex: 1,
});
assertNotBreakingSfTop1(emergency, "humanAdviceFallback");

console.log("PASS: 级牌3 方片同花顺拆列，须压 223344 连对不拆跑道首推", playSignature(rec.candidate));
