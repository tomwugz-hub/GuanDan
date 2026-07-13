/**
 * 级牌3 截图复现：须压 QQQ+55，手牌含黑桃 A2345 同花顺，
 * 不宜拆跑道出 AAA55（3♥ 配 A + A♠ A♣ + 5♠ 5♣），宜过牌或结构安全压牌。
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
import { humanAdviceFallback } from "../coach/robot-player.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

const hand = [
  c("3", SUITS.hearts),
  c("7", SUITS.hearts), c("9", SUITS.hearts), c("10", SUITS.hearts), c("J", SUITS.hearts),
  c("8", SUITS.diamonds), c("9", SUITS.diamonds), c("10", SUITS.diamonds), c("J", SUITS.diamonds),
  c("8", SUITS.clubs), c("9", SUITS.clubs), c("10", SUITS.clubs), c("J", SUITS.clubs), c("A", SUITS.clubs), c("5", SUITS.clubs),
  c("A", SUITS.spades), c("2", SUITS.spades), c("3", SUITS.spades), c("4", SUITS.spades), c("5", SUITS.spades),
  c("7", SUITS.diamonds), c("8", SUITS.hearts),
];

const oppQQQ55 = classifyPlay([
  c("Q", SUITS.clubs), c("Q", SUITS.diamonds), c("Q", SUITS.spades),
  c("5", SUITS.clubs, 1), c("5", SUITS.diamonds),
], "3");

const filler = Array.from({ length: 18 }, () => c("6", SUITS.clubs));
const state = createGameStateFromHands({
  levelRank: "3",
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: oppQQQ55,
  lastActivePlayerIndex: 1,
});

const screenshotAaa55 = classifyPlay([
  c("5", SUITS.spades), c("5", SUITS.clubs), c("3", SUITS.hearts), c("A", SUITS.clubs), c("A", SUITS.spades),
], "3");

if (!breaksStrategicPremiumForTripleWithPair(screenshotAaa55, hand, "3")) {
  throw new Error("截图 AAA55 应判定为拆黑桃同花顺跑道");
}

const breakingAaa = generateBasicCandidates(hand, "3", oppQQQ55, { lite: true })
  .filter((item) => item.type === PLAY_TYPES.tripleWithPair
    && item.mainRank === "A"
    && breaksStrategicPremiumForTripleWithPair(item, hand, "3"));
if (breakingAaa.length === 0) {
  throw new Error("应能生成拆跑道的 AAA 三带二候选");
}

const strategicGroups = buildStrategicGroups(hand, "3", { skipStraightFlush: true });
const preferredGroups = mergePremiumStrategicGroups(
  strategicGroups,
  hand,
  "3",
  buildStrategicGroups(hand, "3"),
);

function assertNotBreakingSfTop1(top, label) {
  if (top.candidate?.type === PLAY_TYPES.tripleWithPair
    && top.candidate?.mainRank === "A"
    && breaksStrategicPremiumForTripleWithPair(top.candidate, hand, "3", preferredGroups)) {
    throw new Error(`${label} 不应首推拆黑桃同花顺的 AAA55，实际 ${playSignature(top.candidate)}`);
  }
}

const top = recommendPlay(hand, "3", oppQQQ55, {
  state,
  playerIndex: 0,
  mlFusionMode: "off",
  maxCandidates: 20,
  preferredGroups,
  lite: true,
  scoringAudience: "human-lite",
});
assertNotBreakingSfTop1(top, "recommendPlay");

const advice = getTurnAdvice(state, 0, {
  preferredGroups,
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 12,
  mlFusionMode: "off",
  alternatives: 3,
  deadline: performance.now() + 8000,
});
assertNotBreakingSfTop1(advice.recommendation, "getTurnAdvice");

const emergency = humanAdviceFallback(hand, "3", oppQQQ55, preferredGroups, {
  state,
  playerIndex: 0,
  lastActivePlayerIndex: 1,
});
assertNotBreakingSfTop1(emergency, "humanAdviceFallback");

console.log("PASS: 级牌3 黑桃 A2345 同花顺，须压 QQQ+55 不拆跑道首推 AAA55");
