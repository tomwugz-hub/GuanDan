/**
 * 级牌9 截图：须压 445566 连对，不宜 556677 拆黑桃 A2345 同花顺跑道。
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import { humanAdviceFallback } from "../coach/robot-player.mjs";
import { breaksStraightFlushRunwayOnMustBeatCp } from "../strategy/sf-runway-guard.mjs";
import { playSignature } from "../engine/card.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

const levelRank = "9";
const hand = [
  c("A", SUITS.spades), c("2", SUITS.spades), c("3", SUITS.spades), c("4", SUITS.spades), c("5", SUITS.spades),
  c("A", SUITS.clubs), c("A", SUITS.diamonds), c("A", SUITS.hearts),
  c("3", SUITS.diamonds), c("3", SUITS.clubs), c("6", SUITS.diamonds), c("6", SUITS.clubs),
  c("7", SUITS.diamonds), c("7", SUITS.clubs), c("2", SUITS.hearts), c("2", SUITS.diamonds),
  c("BJ"), c("SJ"),
  c("5", SUITS.clubs), c("9", SUITS.diamonds), c("10", SUITS.clubs), c("10", SUITS.diamonds),
  c("J", SUITS.hearts), c("Q", SUITS.clubs), c("K", SUITS.diamonds), c("K", SUITS.hearts),
];

const oppCp = classifyPlay([
  c("4", SUITS.diamonds), c("4", SUITS.diamonds, 1),
  c("5", SUITS.diamonds), c("5", SUITS.diamonds, 1),
  c("6", SUITS.diamonds), c("9", SUITS.hearts),
], levelRank);

const filler = Array.from({ length: 18 }, () => c("6", SUITS.clubs, 3));
const state = createGameStateFromHands({
  levelRank,
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: oppCp,
  lastActivePlayerIndex: 3,
});

const beatCtx = { opponentActive: true, previousPlay: oppCp, state, playerIndex: 0 };

const breakingCp = classifyPlay([
  c("5", SUITS.spades), c("5", SUITS.clubs),
  c("6", SUITS.diamonds), c("6", SUITS.clubs),
  c("7", SUITS.diamonds), c("7", SUITS.clubs),
], levelRank);
if (!breaksStraightFlushRunwayOnMustBeatCp(breakingCp, hand, levelRank, beatCtx)) {
  throw new Error("556677 连对应判定为拆黑桃同花顺跑道");
}

function assertNotBreakingSfTop1(top, label) {
  if (!top?.candidate) throw new Error(`${label} 应有 candidate`);
  if (top.candidate.type === PLAY_TYPES.pass) return;
  if (top.candidate.type !== PLAY_TYPES.consecutivePairs) return;
  if (!breaksStraightFlushRunwayOnMustBeatCp(top.candidate, hand, levelRank, beatCtx)) return;
  throw new Error(`${label} 不应首推拆同花顺连对，实际 ${playSignature(top.candidate)}`);
}

const rec = recommendPlay(hand, levelRank, oppCp, {
  state,
  playerIndex: 0,
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 12,
  mlFusionMode: "off",
});
assertNotBreakingSfTop1(rec, "recommendPlay");
if (rec.candidate?.type !== PLAY_TYPES.pass) {
  throw new Error(`recommendPlay 宜过牌，实际 ${playSignature(rec.candidate)}`);
}

const advice = getTurnAdvice(state, 0, {
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 12,
  alternatives: 3,
  deadline: performance.now() + 8000,
});
assertNotBreakingSfTop1(advice.recommendation, "getTurnAdvice");
if (advice.recommendation?.candidate?.type !== PLAY_TYPES.pass) {
  throw new Error(`getTurnAdvice 宜过牌，实际 ${playSignature(advice.recommendation.candidate)}`);
}

const emergency = humanAdviceFallback(hand, levelRank, oppCp, [], {
  state,
  playerIndex: 0,
  lastActivePlayerIndex: 3,
  lite: true,
  scoringAudience: "human-lite",
});
assertNotBreakingSfTop1(emergency, "humanAdviceFallback");
if (emergency.candidate?.type !== PLAY_TYPES.pass) {
  throw new Error(`humanAdviceFallback 宜过牌，实际 ${playSignature(emergency.candidate)}`);
}

console.log("PASS: 级牌9 黑桃同花顺 A2345，须压 445566 连对不拆跑道首推过牌");
