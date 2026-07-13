/**
 * match-8 turn34：须压毛蛋级牌对9，无对子可压 → Top1 四炸6，不得同花顺/过牌
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import {
  requiresBombForPairBeat,
  pickMinStructureBombBeater,
  isStraightFlushWasteOnSmallRoutine,
} from "../strategy/principles.mjs";
import { detectDoctrineViolations } from "../strategy/doctrine-enforce.mjs";
import { mergePremiumStrategicGroups } from "../strategy/strategic-groups.mjs";
import { enrichScoringContext } from "../strategy/table-context.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);
const levelRank = "9";

// turn34 手牌（turn30 出对A 后）
const hand = [
  c("4", "S"), c("5", "S", 1), c("6", "S", 1), c("7", "S", 1),
  c("9", "H"), c("9", "H", 1),
  c("10", "C"), c("Q", "C"), c("K", "C", 1), c("A", "C", 1),
  c("6", "H", 1), c("6", "C"), c("6", "C", 1), c("6", "D"),
  c("10", "D", 1), c("J", "H", 1), c("Q", "D", 1), c("K", "H"),
  c("A", "D"), c("8", "H"), c("8", "D", 1), c("2", "S"), c("2", "D"), c("Q", "S"),
];

const oppPair9 = classifyPlay([c("9", "D", 1), c("9", "S", 1)], levelRank);
const filler = Array.from({ length: 24 }, (_, i) => c("3", "D", i));

let state = createGameStateFromHands({
  levelRank,
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
});
state = {
  ...state,
  lastActivePlay: oppPair9,
  lastActivePlayerIndex: 3,
  playHistory: [
    { turnNumber: 31, playerIndex: 3, play: oppPair9 },
    { turnNumber: 32, playerIndex: 2, play: classifyPlay([], levelRank) },
    { turnNumber: 33, playerIndex: 1, play: classifyPlay([], levelRank) },
  ],
};

const preferredGroups = mergePremiumStrategicGroups([], hand, levelRank);
const tableCtx = enrichScoringContext(
  { state, playerIndex: 0, previousPlay: oppPair9, preferredGroups },
  [],
  hand,
  levelRank,
);

if (!requiresBombForPairBeat(hand, levelRank, oppPair9, tableCtx)) {
  console.error("FAIL: 应识别须压级牌对9只能靠炸弹");
  process.exit(1);
}

const minBomb = pickMinStructureBombBeater(hand, levelRank, oppPair9, tableCtx);
if (!minBomb || minBomb.type !== PLAY_TYPES.bomb || minBomb.mainRank !== "6") {
  console.error("FAIL: 最小整炸应为四炸6", minBomb);
  process.exit(1);
}

const clubSf = classifyPlay(
  [c("10", "C"), c("Q", "C"), c("K", "C", 1), c("A", "C", 1), c("9", "H")],
  levelRank,
);
if (!isStraightFlushWasteOnSmallRoutine(clubSf, hand, oppPair9, tableCtx)) {
  console.error("FAIL: 有整炸可压时同花顺应视为浪费");
  process.exit(1);
}

const sfViolations = detectDoctrineViolations(clubSf, hand, levelRank, {
  ...tableCtx,
  opponentActive: true,
  hasRegularWinner: true,
  hasActionableRegularWinner: false,
  _candidates: [minBomb, clubSf],
});
if (!sfViolations.some((v) => v.code === "P7" && v.blockTop1)) {
  console.error("FAIL: 同花顺应被 P7 blockTop1", sfViolations);
  process.exit(1);
}

const bombViolations = detectDoctrineViolations(minBomb, hand, levelRank, {
  ...tableCtx,
  opponentActive: true,
  hasRegularWinner: true,
  hasActionableRegularWinner: false,
  _candidates: [minBomb, clubSf],
});
if (bombViolations.some((v) => v.blockTop1)) {
  console.error("FAIL: 四炸6 不应 blockTop1", bombViolations);
  process.exit(1);
}

function assertTop1Bomb(label, candidate) {
  if (candidate.type === PLAY_TYPES.pass) {
    console.error(`FAIL ${label}: 不得过牌`, candidate.label);
    process.exit(1);
  }
  if (BOMB_TYPES.has(candidate.type) && candidate.type !== PLAY_TYPES.bomb) {
    console.error(`FAIL ${label}: 不得同花顺/王炸`, candidate.label);
    process.exit(1);
  }
  if (candidate.type !== PLAY_TYPES.bomb || candidate.mainRank !== "6") {
    console.error(`FAIL ${label}: Top1 应为四炸6`, candidate.label ?? candidate.type);
    process.exit(1);
  }
}

for (const max of [12, 40]) {
  const rec = recommendPlay(hand, levelRank, oppPair9, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    maxCandidates: max,
    preferredGroups,
    lite: true,
    scoringAudience: "human-lite",
  });
  assertTop1Bomb(`recommendPlay max=${max}`, rec.candidate);
}

const advice = getTurnAdvice(state, 0, {
  lite: true,
  scoringAudience: "human-lite",
  preferredGroups,
  maxCandidates: 12,
  mlFusionMode: "off",
});
assertTop1Bomb("getTurnAdvice", advice.recommendation.candidate);

console.log("PASS: 须压级牌对9 → 四炸6；同花顺/过牌均非 Top1");
