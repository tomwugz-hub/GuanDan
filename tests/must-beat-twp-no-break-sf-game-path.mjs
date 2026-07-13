/**
 * 模拟游戏 UI 路径：lite + human-lite，不显式传 preferredGroups（与 turn-advice 缺省一致）
 */
import { createCard, SUITS, playSignature } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { humanAdviceFallback } from "../coach/robot-player.mjs";
import { buildStrategicGroups, mergePremiumStrategicGroups } from "../strategy/strategic-groups.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

const hand = [
  c("7", SUITS.spades), c("8", SUITS.spades), c("9", SUITS.spades), c("10", SUITS.spades),
  c("8", SUITS.hearts),
  c("3", SUITS.clubs), c("3", SUITS.diamonds), c("4", SUITS.diamonds), c("4", SUITS.hearts),
  c("6", SUITS.hearts), c("6", SUITS.clubs), c("7", SUITS.hearts), c("7", SUITS.diamonds),
  c("10", SUITS.hearts), c("10", SUITS.diamonds),
  c("A", SUITS.hearts), c("A", SUITS.spades), c("A", SUITS.clubs),
  c("K", SUITS.hearts), c("K", SUITS.diamonds), c("2", SUITS.clubs), c("2", SUITS.spades),
  c("BJ", SUITS.spades), c("BJ", SUITS.hearts), c("9", SUITS.diamonds), c("Q", SUITS.hearts),
];

const opp77733 = classifyPlay([
  c("7", SUITS.clubs), c("7", SUITS.hearts), c("7", SUITS.spades),
  c("3", SUITS.hearts), c("3", SUITS.spades),
], "8");

const filler = Array.from({ length: 18 }, () => c("5", SUITS.clubs));
const state = createGameStateFromHands({
  levelRank: "8",
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: opp77733,
  lastActivePlayerIndex: 1,
});

// 游戏 full 路径：mergePremiumStrategicGroups（空 UI 列时与 buildHumanAdviceContext 一致）
const columnGroups = [];
const strategicGroups = buildStrategicGroups(hand, "8", { skipStraightFlush: true });
const preferredGroups = mergePremiumStrategicGroups(
  columnGroups.length > 0 ? columnGroups : strategicGroups,
  hand,
  "8",
  buildStrategicGroups(hand, "8"),
);

const gameFull = getTurnAdvice(state, 0, {
  preferredGroups,
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 40,
  mlFusionMode: "off",
  alternatives: 3,
  deadline: performance.now() + 8000,
});
const recFull = gameFull.recommendation?.candidate;
if (recFull?.type !== PLAY_TYPES.tripleWithPair || recFull?.mainRank !== "A") {
  throw new Error(`游戏 full 路径首推应为 AAA 三带二，实际 ${playSignature(recFull)}`);
}

// 无 preferredGroups：此前会误判逢人配拆同花顺并推荐过牌或 101010
const noGroups = getTurnAdvice(state, 0, {
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 40,
  mlFusionMode: "off",
  alternatives: 3,
  deadline: performance.now() + 8000,
});
const recNoGroups = noGroups.recommendation?.candidate;
if (recNoGroups?.type !== PLAY_TYPES.tripleWithPair || recNoGroups?.mainRank !== "A") {
  throw new Error(`无 preferredGroups 路径首推应为 AAA 三带二，实际 ${playSignature(recNoGroups)}`);
}
if (recNoGroups?.mainRank === "10") {
  throw new Error(`无 preferredGroups 路径不应首推拆跑道的 101010，实际 ${playSignature(recNoGroups)}`);
}

// 应急兜底：与 buildEmergencyHumanAdvice 对齐（merge 后 preferredGroups）
const emergency = humanAdviceFallback(hand, "8", opp77733, preferredGroups, {
  state,
  playerIndex: 0,
  lastActivePlayerIndex: 1,
});
if (emergency.candidate?.type !== PLAY_TYPES.tripleWithPair || emergency.candidate?.mainRank !== "A") {
  throw new Error(`应急兜底应为 AAA 三带二，实际 ${playSignature(emergency.candidate)}`);
}

console.log("PASS: 游戏路径（含无 preferredGroups / 应急）均首推 AAA 不拆黑桃同花顺跑道");
