/**
 * match-5 级牌8：左侧黑桃7-10+逢人配8♥ 同花顺，须压777+33 不宜拆同花顺出101010+22
 */
import { createCard, SUITS, playSignature } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import { breaksStrategicPremiumForTripleWithPair } from "../strategy/scorers/structure.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { buildStrategicGroups, mergePremiumStrategicGroups } from "../strategy/strategic-groups.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";

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

const twp10 = generateBasicCandidates(hand, "8", opp77733).find((item) => item.type === PLAY_TYPES.tripleWithPair
  && item.mainRank === "10"
  && item.cards.some((card) => card.suit === SUITS.spades && card.rank === "10")
  && item.cards.filter((card) => card.rank === "2").length === 2);

if (!twp10) throw new Error("应能生成含黑桃10的三带二");
if (!breaksStrategicPremiumForTripleWithPair(twp10, hand, "8")) {
  throw new Error("101010+22 应判定为拆顺子（黑桃7-10跑道）");
}

const columnGroups = [{
  cards: [hand[0], hand[1], hand[2], hand[3]],
  label: "同花顺 黑桃7-10",
}];
const preferredGroups = mergePremiumStrategicGroups(columnGroups, hand, "8", buildStrategicGroups(hand, "8"));

const top = recommendPlay(hand, "8", opp77733, {
  state,
  playerIndex: 0,
  mlFusionMode: "off",
  maxCandidates: 96,
  preferredGroups,
  lite: true,
  scoringAudience: "human-lite",
});
if (top.candidate?.type !== PLAY_TYPES.tripleWithPair || top.candidate?.mainRank !== "A") {
  throw new Error(`Top1 应为不拆同花顺的 AAA 三带二，实际 ${playSignature(top.candidate)}`);
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
const rec1 = advice.recommendation?.candidate;
if (rec1?.type === PLAY_TYPES.tripleWithPair && rec1?.mainRank === "10") {
  throw new Error(`人类 lite 推荐1 不应为拆同花顺的101010，实际 ${playSignature(rec1)}`);
}
if (rec1?.type !== PLAY_TYPES.tripleWithPair || rec1?.mainRank !== "A") {
  throw new Error(`人类 lite 推荐1 应为 AAA 三带二，实际 ${playSignature(rec1)}`);
}

console.log("PASS: 级牌8 黑桃同花顺跑道，须压777+33 首推 AAA 不拆同花顺");
