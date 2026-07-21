/**
 * 级牌 A：须压对 10，J♣+J♠ 可压且不拆方片 7-J 同花顺主跑道（勿误推过牌）。
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
  c("10", SUITS.clubs), c("J", SUITS.spades), c("K", SUITS.diamonds), c("A", SUITS.diamonds), c("A", SUITS.hearts),
  c("7", SUITS.hearts), c("7", SUITS.spades), c("7", SUITS.diamonds), c("8", SUITS.diamonds), c("8", SUITS.spades), c("8", SUITS.hearts),
  c("9", SUITS.spades), c("9", SUITS.diamonds), c("9", SUITS.hearts),
  c("10", SUITS.diamonds), c("10", SUITS.hearts),
  c("J", SUITS.clubs), c("J", SUITS.diamonds),
  c("6", SUITS.clubs), c("K", SUITS.clubs),
];

const oppPair10 = classifyPlay([c("10", SUITS.diamonds), c("10", SUITS.hearts)], levelRank);
const filler = Array.from({ length: 18 }, () => c("6", SUITS.clubs, 3));
const state = createGameStateFromHands({
  levelRank,
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: oppPair10,
  lastActivePlayerIndex: 1,
});

const uiGroups = buildStrategicGroups(hand, levelRank);
const preferredGroups = mergePremiumStrategicGroups(uiGroups, hand, levelRank, uiGroups);
const beatCtx = {
  opponentActive: true,
  previousPlay: oppPair10,
  state,
  playerIndex: 0,
  preferredGroups,
  lite: true,
  scoringAudience: "human-lite",
};

const pairJs = classifyPlay([c("J", SUITS.clubs), c("J", SUITS.spades)], levelRank);
if (breaksStraightFlushRunwayOnMustBeatPair(pairJs, hand, levelRank, beatCtx)) {
  throw new Error("J♣+J♠ 不应判定拆方片同花顺主跑道");
}

const pairJd = classifyPlay([c("J", SUITS.clubs), c("J", SUITS.diamonds)], levelRank);
if (!breaksStraightFlushRunwayOnMustBeatPair(pairJd, hand, levelRank, beatCtx)) {
  throw new Error("J♣+J♦ 应判定拆方片同花顺主跑道");
}

function assertPairJTop1(top, label) {
  if (!top?.candidate) throw new Error(`${label} 应有 candidate`);
  if (top.candidate.type !== PLAY_TYPES.pair || top.candidate.mainRank !== "J") {
    throw new Error(`${label} 应首推对 J，实际 ${playSignature(top.candidate)}`);
  }
  if (breaksStraightFlushRunwayOnMustBeatPair(top.candidate, hand, levelRank, beatCtx)) {
    throw new Error(`${label} 首推对 J 不宜拆方片同花顺：${playSignature(top.candidate)}`);
  }
}

const rec = recommendPlay(hand, levelRank, oppPair10, {
  state,
  playerIndex: 0,
  preferredGroups,
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 12,
  mlFusionMode: "off",
});
assertPairJTop1(rec, "recommendPlay");

const advice = getTurnAdvice(state, 0, {
  preferredGroups,
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 12,
  alternatives: 3,
  deadline: performance.now() + 8000,
});
assertPairJTop1(advice.recommendation, "getTurnAdvice");

const emergency = humanAdviceFallback(hand, levelRank, oppPair10, preferredGroups, {
  state,
  playerIndex: 0,
  lastActivePlayerIndex: 1,
  preferredGroups,
  lite: true,
  scoringAudience: "human-lite",
});
assertPairJTop1(emergency, "humanAdviceFallback");

console.log("PASS: 须压对10，J♣+J♠ 压牌保留方片同花顺", playSignature(rec.candidate));

// 截图变体：含 7♣，主跑道为方片 10-J+逢人配，J♣+J♠ 仍宜压
const handClub7 = [
  c("10", SUITS.clubs), c("J", SUITS.spades), c("K", SUITS.diamonds), c("A", SUITS.diamonds), c("A", SUITS.hearts),
  c("7", SUITS.hearts), c("7", SUITS.spades), c("7", SUITS.clubs), c("8", SUITS.spades), c("8", SUITS.clubs), c("8", SUITS.diamonds),
  c("9", SUITS.diamonds), c("9", SUITS.spades), c("9", SUITS.hearts),
  c("10", SUITS.diamonds), c("10", SUITS.clubs, 1),
  c("J", SUITS.clubs), c("J", SUITS.diamonds),
  c("6", SUITS.clubs), c("K", SUITS.clubs),
];
const stateClub7 = createGameStateFromHands({
  levelRank,
  hands: [handClub7, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: oppPair10,
  lastActivePlayerIndex: 1,
});
const recClub7 = recommendPlay(handClub7, levelRank, oppPair10, {
  state: stateClub7,
  playerIndex: 0,
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 12,
  mlFusionMode: "off",
});
if (recClub7.candidate?.type !== PLAY_TYPES.pair || recClub7.candidate.mainRank !== "J") {
  throw new Error(`含7♣变体应首推对J，实际 ${playSignature(recClub7.candidate)}`);
}

