/**
 * 须压三带二：有 AAA+22 等不拆同花顺路线时，不宜拆红桃同花顺出 101010+22
 */
import { createCard, SUITS, playSignature } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import { breaksStrategicPremiumForTripleWithPair } from "../strategy/scorers/structure.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

const hand = [
  c("7", SUITS.spades), c("8", SUITS.spades), c("8", SUITS.hearts), c("9", SUITS.diamonds), c("10", SUITS.clubs),
  c("3", SUITS.clubs), c("3", SUITS.diamonds), c("4", SUITS.diamonds), c("4", SUITS.clubs),
  c("A", SUITS.hearts), c("A", SUITS.spades), c("A", SUITS.clubs),
  c("6", SUITS.hearts), c("6", SUITS.clubs), c("6", SUITS.spades),
  c("7", SUITS.diamonds), c("7", SUITS.hearts),
  c("10", SUITS.hearts), c("10", SUITS.diamonds),
  c("K", SUITS.hearts), c("K", SUITS.diamonds),
  c("2", SUITS.clubs), c("2", SUITS.spades),
  c("BJ", SUITS.spades), c("BJ", SUITS.hearts),
  c("9", SUITS.hearts), c("Q", SUITS.hearts),
];

const opp77733 = classifyPlay([
  c("7", SUITS.clubs), c("7", SUITS.hearts), c("7", SUITS.spades),
  c("3", SUITS.hearts), c("3", SUITS.spades),
], "5");

const filler = Array.from({ length: 18 }, () => c("4", SUITS.clubs));
const state = createGameStateFromHands({
  levelRank: "5",
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: opp77733,
  lastActivePlayerIndex: 1,
});

const all = generateBasicCandidates(hand, "5", opp77733);
const twp10 = all.find((item) => item.type === PLAY_TYPES.tripleWithPair
  && item.mainRank === "10"
  && item.cards.some((card) => card.suit === SUITS.hearts && card.rank === "10"));
const twpA = all.find((item) => item.type === PLAY_TYPES.tripleWithPair
  && item.mainRank === "A"
  && !breaksStrategicPremiumForTripleWithPair(item, hand, "5"));

if (!twp10 || !twpA) {
  throw new Error("测试手牌应同时生成拆同花顺的 101010 与不拆同花顺的 AAA 三带二");
}
if (!breaksStrategicPremiumForTripleWithPair(twp10, hand, "5")) {
  throw new Error("101010 三带二应判定为拆同花顺");
}
if (breaksStrategicPremiumForTripleWithPair(twpA, hand, "5")) {
  throw new Error("应存在不拆同花顺的 AAA 三带二变体");
}

const top = recommendPlay(hand, "5", opp77733, { state, playerIndex: 0, mlFusionMode: "off", maxCandidates: 96 });
if (top.candidate?.type !== PLAY_TYPES.tripleWithPair || top.candidate?.mainRank !== "A") {
  throw new Error(`Top1 应为 AAA+22，实际 ${playSignature(top.candidate)}`);
}

console.log("PASS: 须压 777+33 首推 AAA+22，不拆同花顺出 101010");
