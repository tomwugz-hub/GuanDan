/**
 * 级牌6 开局领出：黑桃9-K 同花顺（6♥补J）不宜为杂顺拆同花顺
 * 复现截图：逢人配6♥当K + 9♠10♠J♣Q♠ 杂顺，应保留 9♠-10♠-J♠-Q♠-K♠ 同花顺潜力
 */
import { createCard, SUITS, playSignature } from "../engine/card.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import {
  breaksStrategicPremiumForStraight,
  breaksStrategicPremiumForTriple,
  breaksStrategicPremiumForPair,
} from "../strategy/scorers/structure.mjs";
import { enumerateStraightFlushCandidates } from "../strategy/straight-flush-arrange.mjs";
import { mergePremiumStrategicGroups, buildStrategicGroups } from "../strategy/strategic-groups.mjs";
import { evaluateHandProfile } from "../strategy/hand-profile.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { humanAdviceFallback } from "../coach/robot-player.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

const hand = [
  c("9", SUITS.spades), c("10", SUITS.spades), c("Q", SUITS.spades), c("K", SUITS.spades),
  c("6", SUITS.hearts), c("6", SUITS.diamonds),
  c("9", SUITS.diamonds), c("9", SUITS.hearts), c("Q", SUITS.diamonds), c("Q", SUITS.hearts),
  c("5", SUITS.diamonds), c("10", SUITS.diamonds), c("J", SUITS.clubs),
  c("BJ", SUITS.spades), c("SJ", SUITS.spades),
];

const sf = enumerateStraightFlushCandidates(hand, "6").find(
  (item) => item.suit === "S" && item.ranks[0] === "9" && item.wildCount > 0,
);
if (!sf) throw new Error("应能枚举到黑桃9-K同花顺（逢人配补J）");

const wildStraight = generateBasicCandidates(hand, "6", null, { lite: true }).find(
  (item) => item.type === PLAY_TYPES.straight
    && (item.cards ?? []).some((card) => card.suit === SUITS.hearts && card.rank === "6")
    && (item.cards ?? []).some((card) => card.rank === "J" && card.suit === SUITS.clubs)
    && (item.cards ?? []).some((card) => card.rank === "9" && card.suit === SUITS.spades),
);
if (!wildStraight) throw new Error("应能生成逢人配凑杂顺（6♥当K + J♣）");
if (!breaksStrategicPremiumForStraight(wildStraight, hand, "6")?.includes("同花顺")) {
  throw new Error(
    `逢人配杂顺应判定拆同花顺，实际 ${breaksStrategicPremiumForStraight(wildStraight, hand, "6")}`,
  );
}

const groups = buildStrategicGroups(hand, "6");
const preferredGroups = mergePremiumStrategicGroups(
  [{ cards: sf.cards, label: "同花顺 黑桃9-K" }],
  hand,
  "6",
  groups,
);

const filler = Array.from({ length: 22 }, (_, i) => c("3", SUITS.clubs, i));
const state = createGameStateFromHands({
  levelRank: "6",
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: null,
});

const deadline = performance.now() + 8000;

function assertNoSfBreakingLeadPlay(label, candidate) {
  if (
    candidate?.type === PLAY_TYPES.straight
    && breaksStrategicPremiumForStraight(candidate, hand, "6")?.includes("同花顺")
  ) {
    throw new Error(`${label} 不应为拆同花顺的杂顺，实际 ${playSignature(candidate)}`);
  }
  if (
    candidate?.type === PLAY_TYPES.pair
    && breaksStrategicPremiumForPair(candidate, hand, "6")?.includes("同花顺")
  ) {
    throw new Error(`${label} 不应为拆同花顺的对子，实际 ${playSignature(candidate)}`);
  }
}

function assertNoSfBreakingStraight(label, candidate) {
  assertNoSfBreakingLeadPlay(label, candidate);
}

function assertOpeningTop1(label, advice) {
  const top = advice.recommendation;
  assertNoSfBreakingLeadPlay(`${label} Top1`, top.candidate);
  if (top.candidate?.type === PLAY_TYPES.straight) {
    throw new Error(`${label} Top1 不宜首推杂顺（保留同花顺跑道），实际 ${playSignature(top.candidate)}`);
  }
  if (top.candidate?.type === PLAY_TYPES.triple) {
    throw new Error(`${label} Top1 不宜首推裸三张（保留同花顺跑道），实际 ${playSignature(top.candidate)}`);
  }
  if (top.doctrineBlockedTop1) {
    throw new Error(`${label} Top1 不应为教纲 blockTop1 候选：${playSignature(top.candidate)}`);
  }
  const allAdvice = [advice.recommendation, ...(advice.alternatives ?? [])].filter(Boolean);
  for (const [i, rec] of allAdvice.entries()) {
    assertNoSfBreakingLeadPlay(`${label} 推荐${i + 1}`, rec.candidate);
  }
}

// 全量候选回归（strategy 审计路径）
const top = recommendPlay(hand, "6", null, {
  state,
  playerIndex: 0,
  mlFusionMode: "off",
  maxCandidates: 96,
  lite: true,
  scoringAudience: "human-lite",
  preferredGroups,
  deadline,
});
assertNoSfBreakingStraight("recommendPlay Top1", top.candidate);

// 与 app/main.mjs buildHumanAdviceContext + humanAdviceOptionsQuick/Full 一致
const gamePreferredGroups = buildStrategicGroups(hand, "6");
const gameHandProfile = evaluateHandProfile(hand, "6", { preferredGroups: gamePreferredGroups });

const quickAdvice = getTurnAdvice(state, 0, {
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 16,
  mlFusionMode: "off",
  preferredGroups: gamePreferredGroups,
  handProfile: gameHandProfile,
  alternatives: 2,
  deadline: performance.now() + 2500,
});
assertOpeningTop1("游戏 quick 路径", quickAdvice);

const fullAdvice = getTurnAdvice(state, 0, {
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 20,
  mlFusionMode: "off",
  preferredGroups: gamePreferredGroups,
  handProfile: gameHandProfile,
  alternatives: 6,
  deadline: performance.now() + 6000,
});
assertOpeningTop1("游戏 full 路径", fullAdvice);

// 炸后接风（mid-game）：应急兜底曾首推拆黑桃同花顺的杂顺
const bombPlay = classifyPlay([
  c("7", SUITS.hearts), c("7", SUITS.diamonds), c("7", SUITS.clubs), c("7", SUITS.spades),
], "6");
const catchWindState = createGameStateFromHands({
  levelRank: "6",
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: null,
  playHistory: [
    { playerIndex: 0, play: bombPlay },
    { playerIndex: 1, play: classifyPlay([], "6") },
    { playerIndex: 2, play: classifyPlay([], "6") },
    { playerIndex: 3, play: classifyPlay([], "6") },
  ],
});
const emergencyRec = humanAdviceFallback(hand, "6", null, gamePreferredGroups, {
  state: catchWindState,
  playerIndex: 0,
});
assertNoSfBreakingStraight("炸后接风应急", emergencyRec.candidate);
if (emergencyRec.candidate?.type === PLAY_TYPES.straight || emergencyRec.candidate?.type === PLAY_TYPES.triple) {
  throw new Error(`炸后接风应急不宜首推杂顺/裸三张，实际 ${playSignature(emergencyRec.candidate)}`);
}

const catchWindQuick = getTurnAdvice(catchWindState, 0, {
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 16,
  mlFusionMode: "off",
  preferredGroups: gamePreferredGroups,
  handProfile: gameHandProfile,
  alternatives: 2,
  deadline: performance.now() + 2500,
});
assertOpeningTop1("炸后接风 quick", catchWindQuick);

console.log(
  `PASS: 领出 Top1=${playSignature(quickAdvice.recommendation.candidate)}（quick），`
  + `full=${playSignature(fullAdvice.recommendation.candidate)}，均不含拆同花顺杂顺`,
);
