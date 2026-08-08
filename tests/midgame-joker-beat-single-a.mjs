/**
 * 手牌仍多 + 须压对手单 A：宜小王夺权，不宜先出级牌/逢人配 8；8♣ 不得拆同花顺占 Top1
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { mergePremiumStrategicGroups } from "../strategy/strategic-groups.mjs";
import { evaluateHandProfile } from "../strategy/hand-profile.mjs";
import { breaksPremiumStraightOrJokerGroup } from "../strategy/principles.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

const hand = [
  c("5", SUITS.clubs), c("6", SUITS.clubs), c("7", SUITS.clubs), c("8", SUITS.clubs), c("9", SUITS.clubs),
  c("6", SUITS.diamonds), c("6", SUITS.spades), c("6", SUITS.hearts),
  c("J", SUITS.diamonds), c("J", SUITS.hearts), c("J", SUITS.spades),
  c("8", SUITS.diamonds), c("8", SUITS.hearts),
  c("3", SUITS.hearts), c("7", SUITS.hearts),
  c("Q", SUITS.spades), c("Q", SUITS.diamonds), c("K", SUITS.diamonds),
  c("A", SUITS.spades), c("A", SUITS.diamonds, 1),
  c("SJ", SUITS.joker),
];

const prev = classifyPlay([c("A", SUITS.diamonds)], "8");
let state = createGameStateFromHands({
  levelRank: "8",
  hands: [hand, hand, hand, hand],
  currentPlayerIndex: 0,
});
state = {
  ...state,
  lastActivePlay: prev,
  lastActivePlayerIndex: 1,
  playHistory: [{ turnNumber: 1, playerIndex: 1, play: prev }],
};

const uiColumnGroups = [
  { cards: hand.slice(0, 5), label: "同花顺56789" },
  { cards: [hand[5], hand[6], hand[7], hand[11]], label: "666+8" },
  { cards: hand.slice(8, 11), label: "JJJ" },
];
const preferredGroups = mergePremiumStrategicGroups(uiColumnGroups, hand, "8");
const sfGroup = preferredGroups.find((group) => {
  const play = group.play ?? classifyPlay(group.cards, "8");
  return play.type === PLAY_TYPES.straightFlush;
});
if (!sfGroup) {
  console.error("FAIL: mergePremiumStrategicGroups 应保留同花顺组");
  process.exit(1);
}

const advice = getTurnAdvice(state, 0, {
  lite: true,
  scoringAudience: "human-lite",
  preferredGroups,
  handProfile: evaluateHandProfile(hand, "8", { preferredGroups }),
  maxCandidates: 32,
  deadline: performance.now() + 6000,
  alternatives: 3,
});

const top = advice.recommendation.candidate;
if (top.type !== PLAY_TYPES.single || top.mainRank !== "SJ") {
  console.error(
    "FAIL: 21张须压单A应首推小王夺权，实际",
    top.label ?? top.mainRank,
    advice.recommendation.reasons?.slice(0, 3),
  );
  process.exit(1);
}

const eightClub = classifyPlay([c("8", SUITS.clubs)], "8");
if (breaksPremiumStraightOrJokerGroup(eightClub, preferredGroups, "8")) {
  const topIsEightClub = top.cards?.some((card) => card.rank === "8" && card.suit === SUITS.clubs);
  if (topIsEightClub) {
    console.error("FAIL: 8♣ 拆同花顺不得为 Top1");
    process.exit(1);
  }
}

console.log("PASS: 须压单A 首推小王，理由:", advice.recommendation.reasons?.[0]);
