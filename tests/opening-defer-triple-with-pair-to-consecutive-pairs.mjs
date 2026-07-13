/**
 * 领出：有对5可带三张3，且有不拆三同张的连对7788 时，
 * 7788 仅两对不是合法连对；不宜首推333+55时，应保留三张3并先走对5。
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { humanAdviceFallback } from "../coach/robot-player.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import { detectDoctrineViolations } from "../strategy/doctrine-enforce.mjs";
import { enrichScoringContext } from "../strategy/table-context.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);
const levelRank = "2";
const hand = [
  c("K", SUITS.spades), c("K", SUITS.hearts), c("K", SUITS.clubs), c("K", SUITS.diamonds),
  c("7", SUITS.spades), c("7", SUITS.hearts),
  c("8", SUITS.spades), c("8", SUITS.hearts),
  c("5", SUITS.clubs), c("5", SUITS.diamonds),
  c("Q", SUITS.clubs), c("Q", SUITS.diamonds),
  c("10", SUITS.clubs), c("10", SUITS.diamonds),
  c("3", SUITS.clubs), c("3", SUITS.diamonds), c("3", SUITS.spades),
  c("J", SUITS.diamonds), c("6", SUITS.hearts), c("A", SUITS.spades), c("2", SUITS.hearts),
  c("BJ", SUITS.spades),
];
const filler = Array.from({ length: 27 }, (_, i) => c("4", SUITS.hearts, i));
const state = createGameStateFromHands({
  levelRank,
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: null,
});

const twp33355 = classifyPlay([
  c("3", SUITS.clubs), c("3", SUITS.diamonds), c("3", SUITS.spades),
  c("5", SUITS.clubs), c("5", SUITS.diamonds),
], levelRank);
const candidates = generateBasicCandidates(hand, levelRank, null);
const ctx = enrichScoringContext({ state, playerIndex: 0, previousPlay: null }, candidates, hand, levelRank);
const twpViolations = detectDoctrineViolations(twp33355, hand, levelRank, { ...ctx, _candidates: candidates });
if (!twpViolations.some((v) => v.blockTop1 && /连对/.test(v.summary))) {
  console.error("FAIL: 333+55 应判 P5 过早三带二", twpViolations.map((v) => v.summary));
  process.exit(1);
}

const rec = recommendPlay(hand, levelRank, null, { state, playerIndex: 0, mlFusionMode: "off" });
const expectPair5 = rec.candidate.type === PLAY_TYPES.pair
  && rec.candidate.mainRank === "5";
const expectNotTwp = !(rec.candidate.type === PLAY_TYPES.tripleWithPair && rec.candidate.mainRank === "3");
if (!expectNotTwp) {
  console.error("FAIL: Top1 不应 333+55", rec.reasons?.slice(0, 4));
  process.exit(1);
}
if (!expectPair5) {
  console.error("FAIL: 7788 非合法连对，Top1 宜先走对5，实际", rec.candidate.type, rec.candidate.mainRank, rec.reasons?.slice(0, 3));
  process.exit(1);
}

const advice = getTurnAdvice(state, 0, {
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 40,
  preferredGroups: [],
  handProfile: null,
  alternatives: 2,
});
if (advice.recommendation.candidate.type === PLAY_TYPES.tripleWithPair
  && advice.recommendation.candidate.mainRank === "3") {
  console.error("FAIL: 教练 Top1 不应 333+55", advice.recommendation.reasons?.slice(0, 4));
  process.exit(1);
}
if (advice.recommendation.candidate.type === PLAY_TYPES.pass) {
  console.error("FAIL: 领出不可过牌", advice.recommendation.candidate.type, advice.recommendation.candidate.mainRank);
  process.exit(1);
}

const emergency = humanAdviceFallback(hand, levelRank, null, []);
if (emergency.candidate.type === PLAY_TYPES.tripleWithPair && emergency.candidate.mainRank === "3") {
  console.error("FAIL: 应急兜底不应 333+55", emergency.reasons);
  process.exit(1);
}

console.log(
  "PASS: 7788 非合法连对，保留三张3 → Top1 =",
  rec.candidate.type,
  rec.candidate.mainRank ?? "",
  advice.recommendation.reasons?.[0] ?? "",
);
