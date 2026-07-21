/**
 * 级牌 A（逢人配）：须压对 Q，不宜对 K 拆黑桃 9-10-J-K-A 同花顺跑道。
 */
import { createCard, SUITS, playSignature } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import { humanAdviceFallback } from "../coach/robot-player.mjs";
import { breaksStraightFlushRunwayOnMustBeatPair } from "../strategy/sf-runway-guard.mjs";
import { buildStrategicGroups, mergePremiumStrategicGroups } from "../strategy/strategic-groups.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

const levelRank = "A";
const hand = [
  c("7", SUITS.hearts), c("7", SUITS.diamonds), c("7", SUITS.spades),
  c("8", SUITS.diamonds), c("8", SUITS.spades), c("8", SUITS.clubs),
  c("9", SUITS.hearts), c("9", SUITS.diamonds), c("9", SUITS.spades),
  c("10", SUITS.spades), c("10", SUITS.clubs), c("10", SUITS.diamonds),
  c("J", SUITS.spades), c("J", SUITS.hearts), c("J", SUITS.diamonds),
  c("K", SUITS.spades), c("K", SUITS.clubs),
  c("A", SUITS.diamonds), c("A", SUITS.hearts),
  c("6", SUITS.clubs),
];

const oppPairQ = classifyPlay([c("Q", SUITS.spades), c("Q", SUITS.hearts)], levelRank);
const filler = Array.from({ length: 18 }, () => c("6", SUITS.clubs, 3));
const state = createGameStateFromHands({
  levelRank,
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: oppPairQ,
  lastActivePlayerIndex: 1,
});

const beatCtx = { opponentActive: true, previousPlay: oppPairQ, state, playerIndex: 0 };
const pairK = classifyPlay([c("K", SUITS.spades), c("K", SUITS.clubs)], levelRank);
if (!breaksStraightFlushRunwayOnMustBeatPair(pairK, hand, levelRank, beatCtx)) {
  throw new Error("对 K 用 K♠ 应判定为拆黑桃同花顺跑道");
}

function assertNotBreakingSfTop1(top, label) {
  if (!top?.candidate) throw new Error(`${label} 应有 candidate`);
  if (top.candidate.type === PLAY_TYPES.pass) return;
  if (top.candidate.type !== PLAY_TYPES.pair) return;
  if (!breaksStraightFlushRunwayOnMustBeatPair(top.candidate, hand, levelRank, beatCtx)) return;
  throw new Error(`${label} 不应首推拆同花顺对子，实际 ${playSignature(top.candidate)}`);
}

const rec = recommendPlay(hand, levelRank, oppPairQ, {
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

const emergency = humanAdviceFallback(hand, levelRank, oppPairQ, [], {
  state,
  playerIndex: 0,
  lastActivePlayerIndex: 1,
  lite: true,
  scoringAudience: "human-lite",
});
assertNotBreakingSfTop1(emergency, "humanAdviceFallback");
if (emergency.candidate?.type !== PLAY_TYPES.pass) {
  throw new Error(`humanAdviceFallback 宜过牌，实际 ${playSignature(emergency.candidate)}`);
}

// 模拟游戏内 lite + currentHandPlayGroups() 理牌列（rev28 曾在此漏检）
const uiColumnGroups = buildStrategicGroups(hand, levelRank);
const uiPreferredGroups = mergePremiumStrategicGroups(uiColumnGroups, hand, levelRank, uiColumnGroups);
const uiBeatCtx = {
  ...beatCtx,
  preferredGroups: uiPreferredGroups,
  lite: true,
  scoringAudience: "human-lite",
};
if (!breaksStraightFlushRunwayOnMustBeatPair(pairK, hand, levelRank, uiBeatCtx)) {
  throw new Error("lite+UI 理牌列：对 K 仍应判定拆黑桃同花顺跑道");
}

const adviceUi = getTurnAdvice(state, 0, {
  preferredGroups: uiPreferredGroups,
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 12,
  alternatives: 3,
  deadline: performance.now() + 8000,
});
if (adviceUi.recommendation?.candidate?.type !== PLAY_TYPES.pass) {
  throw new Error(
    `lite+UI 理牌列 getTurnAdvice 宜过牌，实际 ${playSignature(adviceUi.recommendation.candidate)}`,
  );
}

const emergencyUi = humanAdviceFallback(hand, levelRank, oppPairQ, uiPreferredGroups, {
  state,
  playerIndex: 0,
  lastActivePlayerIndex: 1,
  preferredGroups: uiPreferredGroups,
  lite: true,
  scoringAudience: "human-lite",
});
if (emergencyUi.candidate?.type !== PLAY_TYPES.pass) {
  throw new Error(
    `lite+UI 理牌列 emergency 宜过牌，实际 ${playSignature(emergencyUi.candidate)}`,
  );
}

console.log("PASS: 级牌 A 须压对 Q，对 K 拆黑桃同花顺跑道 → Top1 过牌（含 UI 理牌列）");
