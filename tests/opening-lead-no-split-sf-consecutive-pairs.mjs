/**
 * 级牌6 领出/接风：黑桃9-K 同花顺（6♥补J）+ 五炸4，不宜逢人配凑连对拆同花顺
 */
import { createCard, SUITS, playSignature } from "../engine/card.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import {
  breaksStrategicPremiumForConsecutivePairs,
} from "../strategy/scorers/structure.mjs";
import { enumerateStraightFlushCandidates } from "../strategy/straight-flush-arrange.mjs";
import { mergePremiumStrategicGroups, buildStrategicGroups } from "../strategy/strategic-groups.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

const hand = [
  c("9", SUITS.spades), c("10", SUITS.spades), c("Q", SUITS.spades), c("K", SUITS.spades),
  c("6", SUITS.hearts),
  c("4", SUITS.spades, 1), c("4", SUITS.hearts), c("4", SUITS.diamonds), c("4", SUITS.clubs), c("4", SUITS.diamonds, 1),
  c("8", SUITS.hearts), c("8", SUITS.diamonds), c("9", SUITS.hearts), c("9", SUITS.diamonds),
  c("Q", SUITS.hearts), c("5", SUITS.diamonds), c("10", SUITS.clubs), c("J", SUITS.clubs),
  c("2", SUITS.spades), c("2", SUITS.clubs),
  c("BJ", SUITS.spades), c("SJ", SUITS.spades),
];

const sf = enumerateStraightFlushCandidates(hand, "6").find(
  (item) => item.suit === "S" && item.ranks[0] === "9" && item.wildCount > 0,
);
if (!sf) throw new Error("应能枚举到黑桃9-K同花顺（逢人配补J）");

const wildCp = generateBasicCandidates(hand, "6", null, { lite: true }).find(
  (item) => item.type === PLAY_TYPES.consecutivePairs
    && (item.cards ?? []).some((card) => card.suit === SUITS.hearts && card.rank === "6"),
);
if (!wildCp) throw new Error("应能生成逢人配凑连对");
if (!breaksStrategicPremiumForConsecutivePairs(wildCp, hand, "6")?.includes("同花顺")) {
  throw new Error(`逢人配连对应判定拆同花顺，实际 ${breaksStrategicPremiumForConsecutivePairs(wildCp, hand, "6")}`);
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

const top = recommendPlay(hand, "6", null, {
  state,
  playerIndex: 0,
  mlFusionMode: "off",
  maxCandidates: 96,
  preferredGroups,
  lite: true,
  scoringAudience: "human-lite",
});

if (
  top.candidate?.type === PLAY_TYPES.consecutivePairs
  && breaksStrategicPremiumForConsecutivePairs(top.candidate, hand, "6")
) {
  throw new Error(`Top1 不应为拆同花顺的连对，实际 ${playSignature(top.candidate)}`);
}

const advice = getTurnAdvice(state, 0, {
  preferredGroups,
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 96,
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
  if (
    cand?.type === PLAY_TYPES.consecutivePairs
    && breaksStrategicPremiumForConsecutivePairs(cand, hand, "6")
  ) {
    throw new Error(`推荐${i + 1} 不应为拆同花顺的连对：${playSignature(cand)}`);
  }
}

console.log(`PASS: 领出 Top1=${playSignature(top.candidate)}，推荐1～3均不含拆同花顺连对`);
