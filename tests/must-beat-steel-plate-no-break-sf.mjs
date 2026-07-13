/**
 * 须压钢板：有方片同花顺跑道时
 * - 不宜拆同花顺凑 888-999 等钢板
 * - 有满张五炸可压时，应推五炸而非亮同花顺
 */
import { createCard, SUITS, playSignature } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { breaksStrategicPremiumForPlane } from "../strategy/scorers/structure.mjs";
import { buildStrategicGroups, mergePremiumStrategicGroups } from "../strategy/strategic-groups.mjs";
import { findNonOverlappingStraightFlushes } from "../strategy/straight-flush-arrange.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

const hand = [
  c("4", SUITS.spades), c("4", SUITS.hearts), c("4", SUITS.clubs),
  c("4", SUITS.diamonds), c("4", SUITS.diamonds, 1),
  c("5", SUITS.diamonds),
  c("6", SUITS.diamonds), c("6", SUITS.hearts),
  c("8", SUITS.diamonds), c("8", SUITS.hearts),
  c("9", SUITS.diamonds), c("9", SUITS.hearts), c("9", SUITS.clubs),
  c("10", SUITS.diamonds), c("10", SUITS.spades),
  c("K", SUITS.spades), c("K", SUITS.clubs), c("K", SUITS.diamonds),
  c("Q", SUITS.spades), c("Q", SUITS.diamonds),
  c("2", SUITS.clubs), c("2", SUITS.spades),
  c("J", SUITS.clubs),
  c("BJ", SUITS.spades), c("SJ", SUITS.spades),
];

const oppPlate = classifyPlay([
  c("A", SUITS.clubs), c("A", SUITS.clubs, 1), c("A", SUITS.hearts),
  c("2", SUITS.diamonds), c("2", SUITS.hearts), c("2", SUITS.spades),
], "6");

const filler = Array.from({ length: 19 }, () => c("5", SUITS.clubs));
const state = createGameStateFromHands({
  levelRank: "6",
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: oppPlate,
  lastActivePlayerIndex: 1,
});

const sfs = findNonOverlappingStraightFlushes(hand, "6");
if (sfs.length === 0) {
  throw new Error("测试手牌应能枚举到同花顺");
}

const candidates = generateBasicCandidates(hand, "6", oppPlate);
const plane888 = candidates.find(
  (item) => item.type === PLAY_TYPES.plane
    && item.mainRank === "9"
    && (item.cards ?? []).some((card) => card.suit === SUITS.hearts && card.rank === "6"),
);
if (!plane888) {
  throw new Error("测试手牌应生成逢人配凑 888-999 钢板");
}
if (!breaksStrategicPremiumForPlane(plane888, hand, "6")) {
  throw new Error("888-999 钢板应判定为拆同花顺");
}

const groups = buildStrategicGroups(hand, "6");
const sfColumn = sfs[0] ? [{ cards: sfs[0].cards, label: "同花顺 方片" }] : [];
const preferredGroups = mergePremiumStrategicGroups(sfColumn, hand, "6", groups);

const top = recommendPlay(hand, "6", oppPlate, {
  state,
  playerIndex: 0,
  mlFusionMode: "off",
  maxCandidates: 96,
  preferredGroups,
  lite: true,
  scoringAudience: "human-lite",
});

const topSig = playSignature(top.candidate);
const topBreaksSf = top.candidate?.type === PLAY_TYPES.plane
  && breaksStrategicPremiumForPlane(top.candidate, hand, "6");
if (topBreaksSf) {
  throw new Error(`Top1 不应为拆同花顺的钢板，实际 ${topSig}`);
}
if (top.candidate?.type === PLAY_TYPES.straightFlush) {
  throw new Error(`Top1 不应为同花顺（有五炸4可压），实际 ${topSig}`);
}
if (
  top.candidate?.type !== PLAY_TYPES.bomb
  || top.candidate?.mainRank !== "4"
  || (top.candidate?.cards?.length ?? 0) !== 5
) {
  throw new Error(`Top1 应为满张五炸4，实际 ${topSig} (${top.candidate?.type})`);
}

const advice = getTurnAdvice(state, 0, {
  preferredGroups,
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 40,
  mlFusionMode: "off",
  alternatives: 3,
  deadline: performance.now() + 8000,
});

const allAdvice = [
  advice.recommendation,
  ...(advice.alternatives ?? []),
].filter(Boolean);

for (const [i, rec] of allAdvice.entries()) {
  const cand = rec.candidate;
  if (cand?.type === PLAY_TYPES.plane && breaksStrategicPremiumForPlane(cand, hand, "6")) {
    throw new Error(`推荐${i + 1} 不应为拆同花顺的钢板：${playSignature(cand)}`);
  }
  if (cand?.type === PLAY_TYPES.straightFlush) {
    throw new Error(`推荐${i + 1} 不应为同花顺（有五炸4可压）：${playSignature(cand)}`);
  }
}

console.log(`PASS: 须压钢板 Top1=${topSig} (五炸4)，推荐1～3均不含拆同花顺钢板或同花顺`);
