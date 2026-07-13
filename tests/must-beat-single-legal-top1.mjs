/**
 * 须压单张：Top1/Top2/Top3 必须 canBeat，理由不得写「压住/跟住」若压不过
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { canBeat } from "../engine/compare-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import {
  isDisplayablePoolItem,
  pickCompliantTopRecommendation,
} from "../strategy/recommendation-guards.mjs";
import {
  isBeatClaimReason,
  playContradictsReasons,
  reasonContradictsPlay,
} from "../strategy/reason-consistency.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

const hand = [
  c("3", SUITS.clubs), c("3", SUITS.diamonds), c("3", SUITS.hearts), c("3", SUITS.spades),
  c("K", SUITS.clubs), c("K", SUITS.diamonds), c("K", SUITS.hearts),
  c("8", SUITS.clubs), c("8", SUITS.diamonds),
  c("7", SUITS.clubs), c("7", SUITS.diamonds),
  c("6", SUITS.clubs), c("6", SUITS.diamonds),
  c("4", SUITS.clubs), c("4", SUITS.diamonds),
  c("2", SUITS.clubs), c("2", SUITS.diamonds),
  c("9", SUITS.spades),
  c("J", SUITS.hearts),
  c("Q", SUITS.clubs),
  c("A", SUITS.diamonds),
  c("SJ"), c("BJ"),
];

const prev = classifyPlay([c("10", SUITS.diamonds)], "4");
const filler = Array.from({ length: 27 }, (_, i) => c("5", SUITS.spades, i));

let state = createGameStateFromHands({
  levelRank: "4",
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
});
state = {
  ...state,
  lastActivePlay: prev,
  lastActivePlayerIndex: 1,
  playHistory: [{ turnNumber: 1, playerIndex: 1, play: prev }],
};

const advice = getTurnAdvice(state, 0, {
  scoringAudience: "human-lite",
  maxCandidates: 96,
  mlFusionMode: "off",
  alternatives: 3,
  deadline: performance.now() + 8000,
});

function playForCompare(play) {
  if (!play?.cards?.length) return play;
  return classifyPlay(play.cards, "4");
}

function assertMustBeatLegal(play, reasons, label) {
  const resolved = playForCompare(play);
  if (resolved.type === PLAY_TYPES.pass) return;
  if (!canBeat(resolved, prev)) {
    console.error(`FAIL: ${label} 压不过上家单10`, play.mainRank, reasons?.slice(0, 3));
    process.exit(1);
  }
  if (playContradictsReasons(resolved, reasons, { previousPlay: prev })) {
    console.error(`FAIL: ${label} 与理由矛盾`, play.mainRank, reasons?.slice(0, 3));
    process.exit(1);
  }
}

const topPlay = advice.recommendation.candidate;
assertMustBeatLegal(topPlay, advice.recommendation.reasons, "Top1");

for (let i = 0; i < (advice.alternatives ?? []).length; i += 1) {
  const alt = advice.alternatives[i];
  assertMustBeatLegal(alt.candidate, alt.reasons, `Top${i + 2}`);
}

// 回归：pickUnblocked 兜底不得选出压不过的单7
const seven = classifyPlay([c("7", SUITS.clubs)], "4");
const j = classifyPlay([c("J", SUITS.hearts)], "4");
const tableContext = {
  previousPlay: prev,
  hasActionableRegularWinner: true,
  isOpening: false,
  leadMode: "must-beat",
};
const mockPool = [
  { candidate: seven, score: -99999, reasons: ["跟住对手单张，避免其连续占牌"], doctrineBlockedTop1: false },
  { candidate: j, score: -16340, reasons: ["跟住对手单张"], doctrineBlockedTop1: true },
];
if (isDisplayablePoolItem(mockPool[0], tableContext)) {
  console.error("FAIL: 单7 不得入展示池");
  process.exit(1);
}
const rescued = pickCompliantTopRecommendation(mockPool, hand, tableContext, "4");
if (rescued?.candidate?.mainRank === "7") {
  console.error("FAIL: pickCompliant 不得返回单7");
  process.exit(1);
}
if (
  reasonContradictsPlay("跟住对手单张，避免其连续占牌", seven, { previousPlay: prev })
  && !isBeatClaimReason("跟住对手单张，避免其连续占牌")
) {
  console.error("FAIL: 压单理由检测未生效");
  process.exit(1);
}

console.log(
  "PASS: 须压单10 Top1=",
  topPlay.mainRank ?? topPlay.type,
  "Top2=",
  advice.alternatives?.[0]?.candidate?.mainRank ?? "—",
  "Top3=",
  advice.alternatives?.[1]?.candidate?.mainRank ?? "—",
);
