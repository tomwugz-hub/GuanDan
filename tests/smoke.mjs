import {
  SUITS,
  PLAY_TYPES,
  canBeat,
  cardId,
  classifyPlay,
  createCard,
  createDoubleDeck,
  createGameStateFromHands,
  dealFourPlayers,
  generateBasicCandidates,
  getTurnAdvice,
  tryLocalCoachAnswer,
  recommendPlay,
  runAutoGame,
  createInitialGameState,
  detectTurnStuck,
  isGameOver,
  playCards,
  repairTurnStuck,
  passTurn,
  shuffle,
  buildStrategicGroups,
  applyTribute,
} from "../src/index.mjs";
import { playRecommendedTurn } from "../coach/robot-player.mjs";
import { scoreCandidate } from "../strategy/recommend.mjs";
import {
  findBestStraightFlushInHand,
  findCompletePlanes,
  findNonOverlappingStraightFlushes,
} from "../strategy/straight-flush-arrange.mjs";
import { breaksBombIntegrity } from "../strategy/scorers/structure.mjs";
import { classifyDivergence } from "../coach/divergence-summary.mjs";
import { filterReasonsForUser } from "../coach/local-qa.mjs";
import {
  buildCoachFeedbackClipboardText,
  isLegacyBriefAnswer,
} from "../coach/feedback-clipboard.mjs";
import { detectKeyMoment, KEY_PAUSE_TYPES } from "../app/key-moment-pause.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeWeaknesses,
  adviceMatchesDrillTag,
  buildDrillAdviceTip,
  buildDrillPracticeGameMeta,
  buildSingleGameMatchSummary,
  classifyDivergenceDrillTag,
  countDrillFocusHits,
  createDrillRiggedState,
  DEFAULT_DRILL_PRESETS,
  DRILL_TAGS,
  getDrillScenarioForTag,
  isFreshDrillGameState,
  shouldShowNextMatchGame,
} from "../app/drill-practice.mjs";
import { DRILL_SCENARIOS } from "../app/drill-scenarios.mjs";
import { compareRanks, isControlRank, rankPower } from "../engine/rank-order.mjs";

const smokeRoot = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(join(smokeRoot, "..", "app", "index.html"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cards(specs) {
  return specs.map(([rank, suit = SUITS.spades, deckIndex = 0]) => createCard(rank, suit, deckIndex));
}

const deck = createDoubleDeck();
assert(deck.length === 108, "两副牌应为108张");

const spadeJack = createCard("J", SUITS.spades, 1);
const smallJoker = createCard("SJ", SUITS.joker, 1);
assert(cardId(spadeJack) !== cardId(smallJoker), "黑桃 J 与小王必须有不同 cardId");
assert(classifyPlay([smallJoker], "2").type === PLAY_TYPES.single, "单张小王应识别为单张");

const sfHand = cards([
  ["8", SUITS.spades],
  ["9", SUITS.spades],
  ["10", SUITS.spades],
  ["Q", SUITS.spades],
  ["Q", SUITS.hearts],
]);
const sfGroup = findBestStraightFlushInHand(sfHand, "Q");
assert(sfGroup?.play?.type === PLAY_TYPES.straightFlush, "黑桃8910Q+红桃逢人配应理出同花顺");
const sfInGroups = buildStrategicGroups(sfHand, "Q").find((group) => group.play.type === PLAY_TYPES.straightFlush);
assert(sfInGroups, "策略分组应优先保留同花顺");

const dualSfHand = cards([
  ["10", SUITS.clubs], ["J", SUITS.clubs], ["Q", SUITS.clubs], ["K", SUITS.clubs], ["A", SUITS.clubs],
  ["8", SUITS.hearts], ["9", SUITS.hearts], ["10", SUITS.hearts], ["J", SUITS.hearts], ["Q", SUITS.hearts],
  ["3", SUITS.spades, 0], ["3", SUITS.spades, 1], ["3", SUITS.diamonds],
  ["A", SUITS.hearts],
]);
const dualStraightFlushes = findNonOverlappingStraightFlushes(dualSfHand, "A");
assert(dualStraightFlushes.length >= 2, "梅花10-A与红桃8-Q两条天然同花顺应同时识别");
assert(
  dualStraightFlushes.every((item) => item.wildCount === 0),
  "这两条同花顺应为全天然，不占逢人配",
);

const plateBreakHand = cards([
  ["10", SUITS.clubs], ["J", SUITS.clubs], ["Q", SUITS.clubs], ["K", SUITS.clubs], ["A", SUITS.clubs],
  ["8", SUITS.hearts], ["9", SUITS.hearts], ["10", SUITS.hearts], ["J", SUITS.hearts], ["Q", SUITS.hearts],
  ["10", SUITS.spades], ["10", SUITS.diamonds],
  ["J", SUITS.spades], ["J", SUITS.diamonds],
  ["8", SUITS.spades], ["8", SUITS.clubs],
]);
assert(findCompletePlanes(plateBreakHand, "A").length >= 1, "手牌里应有 10-J 钢板");
const plateBreakFlushes = findNonOverlappingStraightFlushes(plateBreakHand, "A");
const heartEightQueen = plateBreakFlushes.find((item) => item.suit === SUITS.hearts && item.ranks[0] === "8");
assert(heartEightQueen && heartEightQueen.wildCount === 0, "全天然红桃8-Q应拆钢板成列，而不是死守钢板");

const hands = dealFourPlayers(shuffle(deck, () => 0.42), "5");
assert(hands.every((hand) => hand.length === 27), "每人27张");

const pair55 = classifyPlay(cards([["5"], ["5", SUITS.clubs]]), "6");
const pairKK = classifyPlay(cards([["K"], ["K", SUITS.clubs]]), "6");
assert(canBeat(pairKK, pair55), "KK应压过55");

const auto = runAutoGame(createInitialGameState({ random: () => 0.33 }), { maxTurns: 200 });
assert(auto.isComplete || auto.hitTurnLimit, "自动对局应能推进");

const fourJHand = cards([
  ["J"], ["J", SUITS.clubs], ["J", SUITS.diamonds], ["J", SUITS.hearts],
  ["Q"], ["Q", SUITS.clubs], ["Q", SUITS.diamonds],
  ["K"], ["K", SUITS.clubs], ["K", SUITS.hearts],
  ["9", SUITS.hearts], ["10", SUITS.hearts],
]);
const groups = buildStrategicGroups(fourJHand, "2");
const fakeConsecutive = groups.find((group) => group.label?.includes("连对") && group.label.includes("J"));
assert(!fakeConsecutive, "四张J不应被理成J-Q-K假连对");

const opponentPairQ = classifyPlay(cards([["Q"], ["Q", SUITS.clubs]]), "2");
const state = createGameStateFromHands({
  levelRank: "2",
  hands: [
    cards([["3"]]),
    cards([["4"]]),
    fourJHand,
    cards([["5"]]),
  ],
  currentPlayerIndex: 2,
});
const patched = {
  ...state,
  lastActivePlay: opponentPairQ,
  lastActivePlayerIndex: 1,
};
const recommendation = recommendPlay(
  patched.players[2].hand,
  "2",
  opponentPairQ,
  {
    state: patched,
    playerIndex: 2,
    lastActivePlayerIndex: 1,
    preferredGroups: buildStrategicGroups(patched.players[2].hand, "2"),
    previousPlay: opponentPairQ,
    _candidates: generateBasicCandidates(patched.players[2].hand, "2", opponentPairQ),
    ...(() => {
      const cands = generateBasicCandidates(patched.players[2].hand, "2", opponentPairQ);
      cands.push(classifyPlay([], "2"));
      const ctx = {
        state: patched,
        playerIndex: 2,
        lastActivePlayerIndex: 1,
        previousPlay: opponentPairQ,
        _candidates: cands,
      };
      return ctx;
    })(),
  },
);

assert(
  recommendation.candidate.type === PLAY_TYPES.pair && recommendation.candidate.mainRank === "K",
  `对手对Q时老史应首推对K，实际：${recommendation.candidate.type} ${recommendation.candidate.mainRank}`,
);

const advice = getTurnAdvice(patched, 2, { mlFusionMode: "off" });
assert(advice.recommendation.candidate.type !== PLAY_TYPES.pass, "教练建议不应首推过牌");

const catchWindHand = cards([
  ["7", SUITS.diamonds, 0], ["7", SUITS.hearts, 0], ["7", SUITS.hearts, 1], ["7", SUITS.spades, 0],
  ["8", SUITS.diamonds, 0], ["8", SUITS.hearts, 0], ["8", SUITS.spades, 0],
  ["4", SUITS.clubs, 0], ["4", SUITS.hearts, 0],
  ["10", SUITS.diamonds, 0], ["10", SUITS.hearts, 0],
  ["A", SUITS.diamonds, 0], ["A", SUITS.hearts, 0],
  ["6", SUITS.spades, 0], ["J", SUITS.hearts, 0], ["2", SUITS.clubs, 0],
  ["SJ", "JOKER", 0], ["BJ", "JOKER", 1],
]);
const bomb9 = classifyPlay(cards([
  ["9", SUITS.diamonds, 0], ["9", SUITS.hearts, 0], ["9", SUITS.hearts, 1], ["9", SUITS.spades, 0],
]), "2");
let catchState = createGameStateFromHands({
  levelRank: "2",
  hands: [catchWindHand, cards([["3"]]), cards([["5"]]), cards([["6"]])],
  currentPlayerIndex: 0,
});
catchState = {
  ...catchState,
  lastActivePlay: null,
  lastActivePlayerIndex: null,
  playHistory: [
    { turnNumber: 1, playerIndex: 0, play: bomb9 },
    { turnNumber: 2, playerIndex: 1, play: classifyPlay([], "2") },
    { turnNumber: 3, playerIndex: 2, play: classifyPlay([], "2") },
    { turnNumber: 4, playerIndex: 3, play: classifyPlay([], "2") },
  ],
};
const catchRec = recommendPlay(
  catchWindHand,
  "2",
  null,
  {
    state: catchState,
    playerIndex: 0,
    preferredGroups: buildStrategicGroups(catchWindHand, "2"),
    mlFusionMode: "smart",
    mlModel: false,
  },
);
assert(
  catchRec.candidate.type === PLAY_TYPES.tripleWithPair && catchRec.candidate.mainRank === "8",
  `接风应优先三带二8，实际 ${catchRec.candidate.type} ${catchRec.candidate.mainRank ?? ""}`,
);

const fiveABombHand = cards([
  ["A"], ["A", SUITS.hearts], ["A", SUITS.clubs], ["A", SUITS.diamonds], ["A", SUITS.diamonds, 1],
  ["J"], ["J", SUITS.diamonds], ["J", SUITS.diamonds, 1],
  ["6"], ["6", SUITS.diamonds, 1],
  ["5"],
]);
const triple9Lead = classifyPlay(
  cards([["9", SUITS.diamonds], ["9", SUITS.hearts, 1], ["9", SUITS.spades]]),
  "2",
);
const bombState = createGameStateFromHands({
  levelRank: "2",
  hands: [fiveABombHand, cards([["3"]]), cards([["4"]]), cards([["5", SUITS.clubs]])],
  currentPlayerIndex: 0,
});
const bombPatched = {
  ...bombState,
  lastActivePlay: triple9Lead,
  lastActivePlayerIndex: 1,
};
const bombRec = recommendPlay(
  bombPatched.players[0].hand,
  "2",
  triple9Lead,
  {
    state: bombPatched,
    playerIndex: 0,
    lastActivePlayerIndex: 1,
    preferredGroups: buildStrategicGroups(bombPatched.players[0].hand, "2"),
    previousPlay: triple9Lead,
    _candidates: generateBasicCandidates(bombPatched.players[0].hand, "2", triple9Lead),
  },
);
assert(
  !(bombRec.candidate.type === PLAY_TYPES.triple && bombRec.candidate.mainRank === "A"),
  "五张A时不应首推拆炸打三张A",
);

const fourABombHand = cards([
  ["A"], ["A", SUITS.hearts], ["A", SUITS.clubs], ["A", SUITS.diamonds],
  ["4"], ["4", SUITS.diamonds],
  ["J"], ["J", SUITS.clubs],
  ["6"], ["6", SUITS.hearts],
  ["5"], ["5", SUITS.spades],
  ["3"], ["3", SUITS.clubs],
]);
const kTripleWithPair = classifyPlay(
  cards([
    ["K", SUITS.diamonds], ["K", SUITS.hearts], ["K", SUITS.spades],
    ["6", SUITS.diamonds, 1], ["6", SUITS.clubs, 1],
  ]),
  "2",
);
const fourABombState = createGameStateFromHands({
  levelRank: "2",
  hands: [fourABombHand, cards([["3"]]), cards([["4"]]), cards([["5", SUITS.clubs]])],
  currentPlayerIndex: 0,
});
const fourABombPatched = {
  ...fourABombState,
  lastActivePlay: kTripleWithPair,
  lastActivePlayerIndex: 1,
  playHistory: [
    { turnNumber: 0, playerIndex: 2, play: classifyPlay(cards([
      ["Q", SUITS.diamonds], ["Q", SUITS.hearts], ["Q", SUITS.spades], ["3", SUITS.diamonds], ["3", SUITS.hearts],
    ]), "2") },
    { turnNumber: 1, playerIndex: 1, play: kTripleWithPair },
  ],
};
const fourABombRec = recommendPlay(
  fourABombPatched.players[0].hand,
  "2",
  kTripleWithPair,
  {
    state: fourABombPatched,
    playerIndex: 0,
    lastActivePlayerIndex: 1,
    preferredGroups: buildStrategicGroups(fourABombPatched.players[0].hand, "2"),
    previousPlay: kTripleWithPair,
    mlFusionMode: "off",
    mlModel: false,
  },
);
assert(
  !(fourABombRec.candidate.type === PLAY_TYPES.tripleWithPair && fourABombRec.candidate.mainRank === "A"),
  `四张A压K三带二不得首推拆A三带二，实际 ${fourABombRec.candidate.label ?? fourABombRec.candidate.type}`,
);

const steelWindHand = cards([
  ["7", SUITS.clubs], ["7", SUITS.diamonds], ["7", SUITS.hearts],
  ["8", SUITS.hearts], ["8", SUITS.spades],
  ["9", SUITS.clubs], ["9", SUITS.diamonds],
  ["2", SUITS.clubs], ["2", SUITS.diamonds],
  ["K", SUITS.spades], ["K", SUITS.hearts],
]);
let steelWindState = createGameStateFromHands({
  levelRank: "A",
  hands: [steelWindHand, cards([["3"]]), cards([["4"]]), cards([["5"]])],
  currentPlayerIndex: 0,
});
steelWindState = {
  ...steelWindState,
  lastActivePlay: null,
  lastActivePlayerIndex: null,
  playHistory: [
    { turnNumber: 1, playerIndex: 0, play: classifyPlay(cards([["6", SUITS.hearts], ["6", SUITS.clubs]]), "A") },
    { turnNumber: 2, playerIndex: 1, play: classifyPlay([], "A") },
    { turnNumber: 3, playerIndex: 2, play: classifyPlay([], "A") },
    { turnNumber: 4, playerIndex: 3, play: classifyPlay([], "A") },
  ],
};
const steelWindRec = recommendPlay(
  steelWindHand,
  "A",
  null,
  {
    state: steelWindState,
    playerIndex: 0,
    preferredGroups: buildStrategicGroups(steelWindHand, "A"),
    mlFusionMode: "off",
    mlModel: false,
  },
);
assert(
  steelWindRec.candidate.type === PLAY_TYPES.consecutivePairs && steelWindRec.candidate.length >= 6,
  `接风有钢板时应优先钢板，实际 ${steelWindRec.candidate.label ?? steelWindRec.candidate.type}`,
);

const oppHeartSf = classifyPlay(cards([
  ["6", SUITS.hearts, 1], ["7", SUITS.hearts], ["8", SUITS.hearts, 1],
  ["9", SUITS.hearts], ["10", SUITS.hearts],
]), "A");
const counterSfHand = cards([
  ["9", SUITS.spades], ["10", SUITS.spades], ["J", SUITS.spades], ["Q", SUITS.spades], ["K", SUITS.spades],
  ["3", SUITS.clubs], ["3", SUITS.diamonds], ["4", SUITS.hearts], ["5", SUITS.clubs],
  ["6", SUITS.diamonds], ["7", SUITS.clubs], ["8", SUITS.diamonds],
  ["2", SUITS.hearts], ["A", SUITS.diamonds],
]);
const counterSfState = createGameStateFromHands({
  levelRank: "A",
  hands: [counterSfHand, cards([["3"]]), cards([["4"]]), cards([["5"]])],
  currentPlayerIndex: 0,
});
const counterSfPatched = {
  ...counterSfState,
  lastActivePlay: oppHeartSf,
  lastActivePlayerIndex: 3,
};
const counterSfRec = recommendPlay(
  counterSfHand,
  "A",
  oppHeartSf,
  {
    state: counterSfPatched,
    playerIndex: 0,
    lastActivePlayerIndex: 3,
    preferredGroups: buildStrategicGroups(counterSfHand, "A"),
    previousPlay: oppHeartSf,
    mlFusionMode: "smart",
    mlModel: false,
  },
);
assert(
  counterSfRec.candidate.type === PLAY_TYPES.straightFlush,
  `对手同花顺时应以更大同花顺抢权，实际 ${counterSfRec.candidate.label ?? counterSfRec.candidate.type}`,
);
assert(
  !counterSfRec.reasons.some((r) => /小炸/.test(r)),
  "不得将对手同花顺误写成小炸",
);

const heavySteelHand = cards([
  ["6", SUITS.clubs], ["6", SUITS.diamonds], ["6", SUITS.hearts],
  ["7", SUITS.hearts], ["7", SUITS.spades],
  ["8", SUITS.clubs], ["8", SUITS.diamonds],
  ["3", SUITS.spades], ["3", SUITS.clubs], ["3", SUITS.hearts],
  ["4", SUITS.diamonds], ["4", SUITS.hearts],
  ["5", SUITS.spades], ["5", SUITS.clubs],
  ["9", SUITS.diamonds], ["9", SUITS.clubs],
  ["2", SUITS.spades], ["K", SUITS.hearts],
]);
let heavySteelState = createGameStateFromHands({
  levelRank: "A",
  hands: [heavySteelHand, cards([["3"]]), cards([["4"]]), cards([["5"]])],
  currentPlayerIndex: 0,
});
heavySteelState = {
  ...heavySteelState,
  lastActivePlay: null,
  lastActivePlayerIndex: null,
  playHistory: [
    { turnNumber: 1, playerIndex: 0, play: classifyPlay(cards([["5", SUITS.hearts], ["5", SUITS.diamonds, 1]]), "A") },
    { turnNumber: 2, playerIndex: 1, play: classifyPlay([], "A") },
    { turnNumber: 3, playerIndex: 2, play: classifyPlay([], "A") },
    { turnNumber: 4, playerIndex: 3, play: classifyPlay([], "A") },
  ],
};
const heavySteelRec = recommendPlay(
  heavySteelHand,
  "A",
  null,
  {
    state: heavySteelState,
    playerIndex: 0,
    preferredGroups: buildStrategicGroups(heavySteelHand, "A"),
    mlFusionMode: "off",
    mlModel: false,
  },
);
assert(
  (heavySteelRec.candidate.type === PLAY_TYPES.consecutivePairs && heavySteelRec.candidate.length >= 6)
  || heavySteelRec.candidate.type === PLAY_TYPES.tripleWithPair
  || (heavySteelRec.candidate.type === PLAY_TYPES.plane && heavySteelRec.candidate.length >= 6),
  `手牌≥15张接风应优先成组减手（连对/钢板/三带二），实际 ${heavySteelRec.candidate.label ?? heavySteelRec.candidate.type}`,
);

const game2PlateHand = cards([
  ["2", SUITS.diamonds, 1], ["2", SUITS.hearts, 0], ["2", SUITS.hearts, 1],
  ["4", SUITS.clubs, 0], ["4", SUITS.clubs, 1], ["4", SUITS.hearts, 0],
  ["5", SUITS.diamonds, 1], ["5", SUITS.hearts, 0], ["5", SUITS.spades, 0],
  ["7", SUITS.clubs, 0],
  ["9", SUITS.clubs, 0], ["9", SUITS.clubs, 1], ["9", SUITS.diamonds, 1], ["9", SUITS.hearts, 0],
  ["10", SUITS.clubs, 0], ["10", SUITS.diamonds, 0],
  ["J", SUITS.clubs, 0], ["J", SUITS.diamonds, 0], ["J", SUITS.hearts, 1],
  ["Q", SUITS.clubs, 0], ["Q", SUITS.diamonds, 0], ["Q", SUITS.hearts, 0], ["Q", SUITS.spades, 0],
  ["K", SUITS.clubs, 0], ["K", SUITS.diamonds, 0],
  ["SJ", SUITS.joker, 0], ["BJ", SUITS.joker, 0],
]);
let game2PlateState = createGameStateFromHands({
  levelRank: "6",
  hands: [game2PlateHand, cards([["3"]]), cards([["4"]]), cards([["5"]])],
  currentPlayerIndex: 0,
});
game2PlateState = {
  ...game2PlateState,
  lastActivePlay: null,
  lastActivePlayerIndex: null,
  playHistory: [
    { turnNumber: 1, playerIndex: 0, play: classifyPlay(cards([["3", SUITS.hearts], ["3", SUITS.diamonds]]), "6") },
    { turnNumber: 2, playerIndex: 1, play: classifyPlay([], "6") },
    { turnNumber: 3, playerIndex: 2, play: classifyPlay([], "6") },
    { turnNumber: 4, playerIndex: 3, play: classifyPlay([], "6") },
  ],
};
const game2PlateRec = recommendPlay(
  game2PlateHand,
  "6",
  null,
  {
    state: game2PlateState,
    playerIndex: 0,
    preferredGroups: buildStrategicGroups(game2PlateHand, "6"),
    mlFusionMode: "off",
    mlModel: false,
  },
);
assert(
  game2PlateRec.candidate.type === PLAY_TYPES.single && game2PlateRec.candidate.mainRank === "7",
  `game-2 接风有大王+钢板应优先小单7送单回收，实际 ${game2PlateRec.candidate.label ?? game2PlateRec.candidate.type}`,
);
assert(
  !game2PlateRec.reasons.some((r) => /代价偏高/.test(r)),
  `送单回收优先时不应出现矛盾理由「代价偏高」，实际 ${game2PlateRec.reasons.join("；")}`,
);
assert(
  game2PlateRec.reasons.some((r) => /大王可回收|送单/.test(r)),
  "应提示大王送单回收",
);

const game2PlateCandidate = generateBasicCandidates(game2PlateHand, "6", null)
  .find((c) => c.type === PLAY_TYPES.plane && c.length >= 6);

const whyNotPlayPlateAnswer = tryLocalCoachAnswer("为什么要拆钢板？不可以直接打钢板吗？", {
  status: "in-progress",
  levelRank: "6",
  turnNumber: 0,
  humanHand: game2PlateHand.map((c) => ({
    rank: c.rank, suit: c.suit, deckIndex: c.deckIndex, label: c.rank,
  })),
  table: { lastActivePlay: null },
  currentAdvice: {
    choices: [{
      play: game2PlateCandidate,
      reasons: ["手牌仍多，接风钢板一次减六张"],
    }],
  },
});
assert(whyNotPlayPlateAnswer?.mode === "why-not-play", "钢板追问应走 why-not-play");
assert(!whyNotPlayPlateAnswer.text.includes("规则备忘"), "钢板追问不应落入 brief");
assert(whyNotPlayPlateAnswer.text.includes("可以直接打"), "应明确可以直接打钢板");
assert(whyNotPlayPlateAnswer.text.includes("一次减6张"), "应说明钢板减手效率");
assert(!whyNotPlayPlateAnswer.text.includes("拆了不亏"), "不应再误导「拆钢板不亏」");

// game-2 接风双钢板 666777 + 999101010：Top1 必须钢板，禁止三带二拆钢板进 Top3
const dualPlateCatchHand = cards([
  ["6", SUITS.spades, 0], ["6", SUITS.hearts, 0], ["6", SUITS.clubs, 0],
  ["7", SUITS.diamonds, 0], ["7", SUITS.hearts, 1], ["7", SUITS.clubs, 0],
  ["9", SUITS.spades, 0], ["9", SUITS.diamonds, 0], ["9", SUITS.clubs, 0],
  ["10", SUITS.hearts, 0], ["10", SUITS.diamonds, 1], ["10", SUITS.clubs, 1],
  ["4", SUITS.spades, 0], ["4", SUITS.hearts, 0], ["4", SUITS.clubs, 0], ["4", SUITS.diamonds, 0],
  ["5", SUITS.spades, 0], ["5", SUITS.clubs, 0],
  ["8", SUITS.spades, 0], ["8", SUITS.hearts, 0],
  ["2", SUITS.clubs, 0], ["2", SUITS.diamonds, 0],
  ["J", SUITS.clubs, 0], ["J", SUITS.diamonds, 0],
  ["Q", SUITS.spades, 0], ["K", SUITS.hearts, 0], ["A", SUITS.diamonds, 0],
]);
const dualPlateCatchFiller = cards([["3"], ["3", SUITS.hearts], ["K"], ["K", SUITS.clubs]]);
let dualPlateFreshState = createGameStateFromHands({
  levelRank: "3",
  hands: [dualPlateCatchHand, dualPlateCatchFiller, dualPlateCatchFiller, dualPlateCatchFiller],
  currentPlayerIndex: 0,
});
dualPlateFreshState = { ...dualPlateFreshState, lastActivePlay: null, playHistory: [] };
const dualPlateFreshRec = recommendPlay(dualPlateCatchHand, "3", null, {
  state: dualPlateFreshState,
  playerIndex: 0,
  preferredGroups: buildStrategicGroups(dualPlateCatchHand, "3"),
  mlFusionMode: "smart",
  mlModel: false,
});
assert(
  dualPlateFreshRec.candidate.type === PLAY_TYPES.plane && dualPlateFreshRec.candidate.length >= 6,
  `接风双钢板 turn0 应首推钢板，实际 ${dualPlateFreshRec.candidate.label ?? dualPlateFreshRec.candidate.type}`,
);
assert(
  dualPlateFreshRec.reasons.some((r) => /P5|钢板|减六张/.test(r)),
  `应引用 P5/钢板减手，实际 ${dualPlateFreshRec.reasons.join("；")}`,
);
let dualPlateCatchState = createGameStateFromHands({
  levelRank: "3",
  hands: [dualPlateCatchHand, dualPlateCatchFiller, dualPlateCatchFiller, dualPlateCatchFiller],
  currentPlayerIndex: 0,
});
dualPlateCatchState = {
  ...dualPlateCatchState,
  lastActivePlay: null,
  lastActivePlayerIndex: null,
  playHistory: [
    { turnNumber: 1, playerIndex: 0, play: classifyPlay(cards([["A", SUITS.hearts]]), "3") },
    { turnNumber: 2, playerIndex: 1, play: classifyPlay([], "3") },
    { turnNumber: 3, playerIndex: 2, play: classifyPlay([], "3") },
    { turnNumber: 4, playerIndex: 3, play: classifyPlay([], "3") },
  ],
};
const dualPlateCatchAdvice = getTurnAdvice(dualPlateCatchState, 0, {
  alternatives: 3,
  mlFusionMode: "smart",
  mlModel: false,
});
assert(
  dualPlateCatchAdvice.recommendation.candidate.type === PLAY_TYPES.plane,
  `接风双钢板 Top1 应为钢板，实际 ${dualPlateCatchAdvice.recommendation.candidate.type}`,
);
const dualPlateTop3BreaksPlate = dualPlateCatchAdvice.alternatives.some((alt) => {
  if (alt.candidate.type !== PLAY_TYPES.tripleWithPair) return false;
  const info = generateBasicCandidates(dualPlateCatchHand, "3", null)
    .find((c) => c.type === PLAY_TYPES.tripleWithPair && c.mainRank === alt.candidate.mainRank);
  return alt.candidate.mainRank === "6" || alt.candidate.mainRank === "9";
});
assert(!dualPlateTop3BreaksPlate, "Top3 不应含拆钢板的三带二");
const dualPlateWrongTriple = {
  ...classifyPlay(
    cards([
      ["6", SUITS.spades, 0], ["6", SUITS.hearts, 0], ["6", SUITS.clubs, 0],
      ["9", SUITS.spades, 0], ["9", SUITS.diamonds, 0],
    ]),
    "3",
  ),
  label: "三带二 666+99",
};
const dualPlateCatchQa = tryLocalCoachAnswer("怎么又推荐拆钢板了？", {
  status: "in-progress",
  levelRank: "3",
  turnNumber: 0,
  humanHand: dualPlateCatchHand.map((c) => ({
    rank: c.rank, suit: c.suit, deckIndex: c.deckIndex, label: c.rank,
  })),
  table: { lastActivePlay: null },
  currentAdvice: {
    choices: [{ play: dualPlateWrongTriple, reasons: ["拆三张6组其他牌型代价偏高"] }],
  },
});
assert(dualPlateCatchQa?.mode === "why-not-play", "接风又推荐拆钢板应走 why-not-play");
assert(
  dualPlateCatchQa.text.includes("P5") || dualPlateCatchQa.text.includes("接风"),
  "接风 QA 应走 P5 接风分支",
);
assert(
  !dualPlateCatchQa.text.includes("压场上单张") && !dualPlateCatchQa.text.includes("压单"),
  "接风 QA 不应说压场上单张",
);
assert(
  dualPlateCatchQa.text.includes("推荐偏了") || dualPlateCatchQa.text.includes("提过多次"),
  "接风 QA 应承认推荐偏了",
);

// 跟牌压小单3：最小够压且不拆钢板/炸弹（区别于 game-2 接风领出）
// 花色错开，避免同花顺抢在钢板前理牌（与用户截图 666+777 钢板一致）
const beatSmall3Hand = cards([
  ["6", SUITS.spades], ["6", SUITS.hearts], ["6", SUITS.clubs],
  ["7", SUITS.diamonds], ["7", SUITS.hearts], ["7", SUITS.clubs],
  ["4", SUITS.spades], ["4", SUITS.hearts], ["4", SUITS.clubs], ["4", SUITS.diamonds],
  ["3", SUITS.spades], ["3", SUITS.hearts],
  ["5", SUITS.spades], ["5", SUITS.clubs],
  ["8", SUITS.spades], ["8", SUITS.hearts],
  ["10", SUITS.spades], ["10", SUITS.hearts],
  ["A", SUITS.spades], ["A", SUITS.hearts],
  ["Q", SUITS.clubs],
  ["BJ", SUITS.joker],
]);
const beatSmall3Prev = classifyPlay(cards([["3", SUITS.hearts]]), "5");
const beatSmall3Filler = cards([
  ["2", SUITS.clubs], ["2", SUITS.diamonds], ["9", SUITS.clubs], ["9", SUITS.diamonds],
  ["K", SUITS.clubs], ["K", SUITS.diamonds], ["J", SUITS.clubs], ["J", SUITS.diamonds],
]);
let beatSmall3State = createGameStateFromHands({
  levelRank: "5",
  hands: [beatSmall3Hand, beatSmall3Filler, beatSmall3Filler, beatSmall3Filler],
  currentPlayerIndex: 0,
});
beatSmall3State = {
  ...beatSmall3State,
  lastActivePlay: beatSmall3Prev,
  lastActivePlayerIndex: 1,
};
const beatSmall3Rec = recommendPlay(
  beatSmall3Hand,
  "5",
  beatSmall3Prev,
  {
    state: beatSmall3State,
    playerIndex: 0,
    mlFusionMode: "off",
    mlModel: false,
  },
);
assert(
  beatSmall3Rec.candidate.type === PLAY_TYPES.single,
  `压小单3应出单张，实际 ${beatSmall3Rec.candidate.label ?? beatSmall3Rec.candidate.type}`,
);
assert(
  beatSmall3Rec.candidate.mainRank === "Q",
  `压小单3有散牌单Q应出单Q，实际单${beatSmall3Rec.candidate.mainRank}`,
);
assert(
  !["4", "6", "7"].includes(beatSmall3Rec.candidate.mainRank),
  `压小单3不应拆炸弹/钢板，实际单${beatSmall3Rec.candidate.mainRank}`,
);
assert(
  beatSmall3Rec.reasons.some((r) => /P1|散牌|散单|不宜拆/.test(r)),
  `应说明压小单优先散牌单张（原则P1），实际 ${beatSmall3Rec.reasons.join("；")}`,
);

const whyLooseQBeat3Answer = tryLocalCoachAnswer("有单Q为什么拆牌？", {
  status: "in-progress",
  levelRank: "5",
  turnNumber: 8,
  humanHand: beatSmall3Hand.map((c) => ({
    rank: c.rank, suit: c.suit, deckIndex: c.deckIndex, label: c.rank,
  })),
  table: { lastActivePlay: beatSmall3Prev },
  currentAdvice: {
    choices: [{
      play: generateBasicCandidates(beatSmall3Hand, "5", beatSmall3Prev)
        .find((c) => c.type === PLAY_TYPES.single && c.mainRank === "8"),
      reasons: ["跟住对手单张，避免其连续占牌", "有散牌单张可压，不宜拆对子"],
    }],
  },
});
assert(whyLooseQBeat3Answer?.mode === "why-not-play", "有单Q为何拆牌应走 why-not-play");
assert(
  whyLooseQBeat3Answer.text.includes("单Q") || whyLooseQBeat3Answer.text.includes("散单Q"),
  "应回应单Q",
);
assert(
  whyLooseQBeat3Answer.text.includes("拆对") || whyLooseQBeat3Answer.text.includes("应出"),
  "应直接说明拆对/应出散单",
);
assert(
  whyLooseQBeat3Answer.text.includes("推荐偏了") || whyLooseQBeat3Answer.text.includes("不必照抄"),
  "应承认推荐偏了或指出该出散单",
);

const beatSmall3Broken6 = generateBasicCandidates(beatSmall3Hand, "5", beatSmall3Prev)
  .find((c) => c.type === PLAY_TYPES.single && c.mainRank === "6");
const whyBreakPlateBeat3Answer = tryLocalCoachAnswer("为什么拆钢板压3？", {
  status: "in-progress",
  levelRank: "5",
  turnNumber: 8,
  humanHand: beatSmall3Hand.map((c) => ({
    rank: c.rank, suit: c.suit, deckIndex: c.deckIndex, label: c.rank,
  })),
  table: { lastActivePlay: beatSmall3Prev },
  currentAdvice: {
    choices: [{
      play: beatSmall3Broken6,
      reasons: ["跟住对手单张，避免其连续占牌"],
    }],
  },
});
assert(whyBreakPlateBeat3Answer?.mode === "why-not-play", "拆钢板压3应走 why-not-play");
assert(
  whyBreakPlateBeat3Answer.text.includes("不宜拆") || whyBreakPlateBeat3Answer.text.includes("应出") || whyBreakPlateBeat3Answer.text.includes("拆对"),
  "应明确不宜拆结构压小单或指出应出散单",
);
assert(
  whyBreakPlateBeat3Answer.text.includes("对子") || whyBreakPlateBeat3Answer.text.includes("散单") || whyBreakPlateBeat3Answer.text.includes("散牌"),
  "应提示对子/散牌最小够压",
);

// game-2：钢板 6-7 + 99，错误推荐三带二拆钢板
const game2PlateBeatHand = cards([
  ["6", SUITS.clubs, 1], ["6", SUITS.spades, 0], ["6", SUITS.spades, 1],
  ["7", SUITS.clubs, 0], ["7", SUITS.clubs, 1], ["7", SUITS.diamonds, 1], ["7", SUITS.hearts, 0],
  ["9", SUITS.clubs], ["9", SUITS.hearts],
  ["4", SUITS.spades], ["4", SUITS.hearts], ["4", SUITS.clubs], ["4", SUITS.diamonds],
  ["3", SUITS.spades], ["3", SUITS.hearts],
  ["8", SUITS.spades], ["8", SUITS.hearts],
  ["10", SUITS.spades], ["10", SUITS.hearts],
  ["A", SUITS.spades], ["A", SUITS.hearts],
  ["Q", SUITS.clubs],
  ["BJ", SUITS.joker],
]);
const game2PlateBeatPrev = classifyPlay(cards([["3", SUITS.hearts]]), "3");
const beatSmall3WrongTriple = {
  ...classifyPlay(
    cards([
      ["6", SUITS.clubs, 1], ["6", SUITS.spades, 0], ["6", SUITS.spades, 1],
      ["9", SUITS.clubs], ["9", SUITS.hearts],
    ]),
    "3",
  ),
  label: "三带二 梅花6 黑桃6 黑桃6 梅花9 红桃9",
};
const whyAgainBreakPlateAnswer = tryLocalCoachAnswer("怎么又推荐拆钢板了？", {
  status: "in-progress",
  levelRank: "3",
  turnNumber: 8,
  humanHand: game2PlateBeatHand.map((c) => ({
    rank: c.rank, suit: c.suit, deckIndex: c.deckIndex, label: c.rank,
  })),
  table: { lastActivePlay: game2PlateBeatPrev },
  currentAdvice: {
    choices: [{
      play: beatSmall3WrongTriple,
      reasons: ["拆三张6组其他牌型代价偏高"],
    }],
  },
});
assert(whyAgainBreakPlateAnswer?.mode === "why-not-play", "又推荐拆钢板应走 why-not-play");
assert(
  whyAgainBreakPlateAnswer.text.includes("拆") && whyAgainBreakPlateAnswer.text.includes("钢板"),
  "应点明推荐1拆钢板",
);
assert(
  whyAgainBreakPlateAnswer.text.includes("推荐偏了") || whyAgainBreakPlateAnswer.text.includes("提过多次"),
  "应承认推荐偏了或「又」",
);
assert(
  whyAgainBreakPlateAnswer.text.includes("大王") || whyAgainBreakPlateAnswer.text.includes("单Q")
    || whyAgainBreakPlateAnswer.text.includes("散单"),
  "应给够压替代（级牌3局面多为大王）",
);
assert(
  whyAgainBreakPlateAnswer.text.split("\n").filter((line) => line.trim()).length <= 5,
  "又推荐拆钢板作答应简短",
);
assert(
  !whyAgainBreakPlateAnswer.text.includes("规则备忘"),
  "不应落入 brief 规则备忘",
);

const whyMetaBreakPlateAnswer = tryLocalCoachAnswer("推荐偏了，不必照抄", {
  status: "in-progress",
  levelRank: "3",
  turnNumber: 0,
  humanHand: game2PlateBeatHand.map((c) => ({
    rank: c.rank, suit: c.suit, deckIndex: c.deckIndex, label: c.rank,
  })),
  table: { lastActivePlay: null },
  currentAdvice: {
    choices: [{
      play: beatSmall3WrongTriple,
      reasons: ["拆三张6组其他牌型代价偏高"],
    }],
  },
});
assert(whyMetaBreakPlateAnswer?.mode === "why-not-play", "meta 推荐偏了应走 why-not-play");
assert(
  whyMetaBreakPlateAnswer.text.includes("拆") && whyMetaBreakPlateAnswer.text.includes("钢板"),
  "meta 应答应点明推荐1拆钢板",
);
assert(
  whyMetaBreakPlateAnswer.text.includes("推荐偏了") || whyMetaBreakPlateAnswer.text.includes("不必照抄"),
  "meta 应答应承认偏了",
);
assert(
  whyMetaBreakPlateAnswer.text.includes("应") && (whyMetaBreakPlateAnswer.text.includes("钢板") || whyMetaBreakPlateAnswer.text.includes("大王")),
  "meta 应答应给出替代出牌",
);
assert(
  !whyMetaBreakPlateAnswer.text.includes("规则备忘"),
  "meta 追问不应落入 brief",
);
assert(
  whyMetaBreakPlateAnswer.text.split("\n").filter((line) => line.trim()).length <= 5,
  "meta 作答应简短",
);

// game-2：压单7有散单A，推荐不得拆对8
const game2Beat7Hand = cards([
  ["4", SUITS.spades], ["4", SUITS.hearts], ["4", SUITS.hearts, 1], ["4", SUITS.clubs],
  ["5", SUITS.spades], ["5", SUITS.clubs, 1],
  ["Q", SUITS.spades], ["Q", SUITS.diamonds, 1],
  ["8", SUITS.spades, 1], ["8", SUITS.hearts, 1],
  ["10", SUITS.spades, 1], ["10", SUITS.clubs],
  ["J", SUITS.spades], ["J", SUITS.clubs, 1],
  ["K", SUITS.clubs, 1], ["K", SUITS.diamonds],
  ["A", SUITS.diamonds, 1],
  ["3", SUITS.diamonds, 1],
  ["SJ", SUITS.joker],
]);
const game2Beat7Prev = classifyPlay(cards([["7", SUITS.diamonds, 1]]), "3");
let game2Beat7State = createGameStateFromHands({
  levelRank: "3",
  hands: [game2Beat7Hand, beatSmall3Filler, beatSmall3Filler, beatSmall3Filler],
  currentPlayerIndex: 0,
});
game2Beat7State = {
  ...game2Beat7State,
  lastActivePlay: game2Beat7Prev,
  lastActivePlayerIndex: 1,
};
const game2Beat7Rec = recommendPlay(
  game2Beat7Hand,
  "3",
  game2Beat7Prev,
  {
    state: game2Beat7State,
    playerIndex: 0,
    mlFusionMode: "off",
    mlModel: false,
  },
);
assert(
  game2Beat7Rec.candidate.type === PLAY_TYPES.single && game2Beat7Rec.candidate.mainRank === "A",
  `game-2 压单7有散单A应出单A，实际 ${game2Beat7Rec.candidate.label ?? game2Beat7Rec.candidate.mainRank}`,
);
assert(
  game2Beat7Rec.reasons.some((r) => /P1|散/.test(r)),
  `game-2 压单7应引用 P1，实际 ${game2Beat7Rec.reasons.join("；")}`,
);
const game2Broken8 = generateBasicCandidates(game2Beat7Hand, "3", game2Beat7Prev)
  .find((c) => c.type === PLAY_TYPES.single && c.mainRank === "8");
const whyBreakPairNoAAnswer = tryLocalCoachAnswer("为什么拆对，有单A不打？", {
  status: "in-progress",
  levelRank: "3",
  turnNumber: 24,
  humanHand: game2Beat7Hand.map((c) => ({
    rank: c.rank, suit: c.suit, deckIndex: c.deckIndex, label: c.rank,
  })),
  table: { lastActivePlay: game2Beat7Prev },
  currentAdvice: {
    choices: [{
      play: game2Broken8,
      reasons: ["跟住对手单张，避免其连续占牌"],
    }],
  },
});
assert(whyBreakPairNoAAnswer?.mode === "why-not-play", "拆对有单A不打应走 why-not-play");
assert(whyBreakPairNoAAnswer.text.includes("拆对8") || whyBreakPairNoAAnswer.text.includes("拆对"), "应点明拆对8");
assert(whyBreakPairNoAAnswer.text.includes("单A") || whyBreakPairNoAAnswer.text.includes("散单A"), "应点明散单A");
assert(whyBreakPairNoAAnswer.text.includes("应出"), "应直接说应出单A");
assert(whyBreakPairNoAAnswer.text.includes("推荐偏了"), "应承认推荐偏了");
assert(whyBreakPairNoAAnswer.text.split("\n").filter((line) => line.trim()).length <= 5, "作答应不超过5行");
assert(!whyBreakPairNoAAnswer.text.includes("你在问为何不采用"), "不应落入泛答模板");

// game-2 第16手：压单4，打5拆顺子 A-2-3-4-5，应推单8非单5
const game2Beat4Hand = cards([
  ["7", SUITS.spades, 1], ["7", SUITS.hearts, 0], ["7", SUITS.hearts, 1],
  ["7", SUITS.clubs, 0], ["7", SUITS.clubs, 1], ["7", SUITS.diamonds, 1],
  ["A", SUITS.hearts, 1], ["2", SUITS.diamonds, 1],
  ["3", SUITS.clubs, 0], ["3", SUITS.diamonds, 0],
  ["4", SUITS.spades, 0], ["5", SUITS.spades, 0],
  ["6", SUITS.spades, 0], ["6", SUITS.spades, 1], ["6", SUITS.clubs, 1],
  ["K", SUITS.diamonds, 0], ["K", SUITS.diamonds, 1],
  ["8", SUITS.diamonds, 1], ["Q", SUITS.hearts, 1],
  ["SJ", SUITS.joker, 0],
]);
const game2Beat4Prev = classifyPlay(cards([["4", SUITS.diamonds, 0]]), "3");
let game2Beat4State = createGameStateFromHands({
  levelRank: "3",
  hands: [game2Beat4Hand, beatSmall3Filler, beatSmall3Filler, beatSmall3Filler],
  currentPlayerIndex: 0,
});
game2Beat4State = {
  ...game2Beat4State,
  lastActivePlay: game2Beat4Prev,
  lastActivePlayerIndex: 1,
};
const game2Beat4Rec = recommendPlay(
  game2Beat4Hand,
  "3",
  game2Beat4Prev,
  {
    state: game2Beat4State,
    playerIndex: 0,
    mlFusionMode: "off",
    mlModel: false,
  },
);
assert(
  game2Beat4Rec.candidate.type === PLAY_TYPES.single && game2Beat4Rec.candidate.mainRank === "8",
  `game-2 压单4有散单8不拆顺子应出单8，实际 ${game2Beat4Rec.candidate.label ?? game2Beat4Rec.candidate.mainRank}`,
);
const game2Beat4Single5 = generateBasicCandidates(game2Beat4Hand, "3", game2Beat4Prev)
  .find((c) => c.type === PLAY_TYPES.single && c.mainRank === "5");
const game2Beat4Single8 = generateBasicCandidates(game2Beat4Hand, "3", game2Beat4Prev)
  .find((c) => c.type === PLAY_TYPES.single && c.mainRank === "8");
const whyPlay5BreaksStraight = tryLocalCoachAnswer("怎么打5？打5不是拆顺子吗？", {
  status: "in-progress",
  levelRank: "3",
  turnNumber: 16,
  humanHand: game2Beat4Hand.map((c) => ({
    rank: c.rank, suit: c.suit, deckIndex: c.deckIndex, label: c.rank,
  })),
  table: { lastActivePlay: game2Beat4Prev },
  currentAdvice: {
    choices: [
      { play: game2Beat4Single5, reasons: ["P1散单优先"] },
      { play: game2Beat4Single8, reasons: ["跟住对手单张"] },
      { play: generateBasicCandidates(game2Beat4Hand, "3", game2Beat4Prev)
        .find((c) => c.type === PLAY_TYPES.single && c.mainRank === "Q"), reasons: [] },
    ],
  },
});
assert(whyPlay5BreaksStraight?.mode === "why-not-play", "打5拆顺子应走 why-not-play");
assert(/是.*拆.*顺/.test(whyPlay5BreaksStraight.text), "应直接答打5会拆顺子");
assert(
  whyPlay5BreaksStraight.text.includes("单8") || whyPlay5BreaksStraight.text.includes("散单8"),
  "应说明单8不拆结构更优",
);
assert(!whyPlay5BreaksStraight.text.includes("规则备忘"), "不应落入 brief 炸弹备忘");
assert(
  whyPlay5BreaksStraight.text.split("\n").filter((line) => line.trim()).length <= 5,
  "拆顺子作答应不超过5行",
);

const whyBreakStraightBomb7 = tryLocalCoachAnswer("为什么拆顺子？打了四个7剩下的两个7怎么办？", {
  status: "in-progress",
  levelRank: "3",
  turnNumber: 16,
  humanHand: game2Beat4Hand.map((c) => ({
    rank: c.rank, suit: c.suit, deckIndex: c.deckIndex, label: c.rank,
  })),
  table: { lastActivePlay: game2Beat4Prev },
  currentAdvice: {
    choices: [{ play: game2Beat4Single8, reasons: ["P1散单优先"] }],
  },
});
assert(whyBreakStraightBomb7?.mode === "why-break-bomb-structure", "拆顺子四炸7应走 why-break-bomb-structure");
assert(/应出单8|散单8/.test(whyBreakStraightBomb7.text), "应点明应出单8");
assert(/对7|剩.*2|两个7/.test(whyBreakStraightBomb7.text), "应说明剩两个7变对子");
assert(!whyBreakStraightBomb7.text.includes("规则备忘"), "不应落入 brief");

const whyPlay5NoMustBeat = tryLocalCoachAnswer("怎么打5拆顺子", {
  status: "in-progress",
  levelRank: "3",
  turnNumber: 16,
  humanHand: game2Beat4Hand.map((c) => ({
    rank: c.rank, suit: c.suit, deckIndex: c.deckIndex,
  })),
  table: {},
  currentAdvice: { choices: [] },
});
assert(whyPlay5NoMustBeat.text.includes("应出单8") || whyPlay5NoMustBeat.text.includes("散单8"), "无mustBeat时也须写应出单8");

assert(isLegacyBriefAnswer({ answerSource: "brief", answer: "x" }), "brief 应判旧答");
assert(!isLegacyBriefAnswer({ answerSource: "why-not-play", answer: "【规则引擎作答】\n应出单8" }), "v2 专答不应判旧");
const clipText = buildCoachFeedbackClipboardText(
  { question: "最新问", context: { levelRank: "3", turnNumber: 16 } },
  [
    { source: "fab-coach", createdAt: "2026-06-07T13:14:00.000Z", question: "旧问", answer: "【规则教练 · 本机答复】", answerSource: "brief" },
    { source: "fab-coach", createdAt: "2026-06-07T13:49:00.000Z", question: "新问", answer: "【规则引擎作答】\n应出单8", answerSource: "why-not-play" },
  ],
  { gameId: "game-2" },
);
assert(clipText.includes("省略 1 条旧版 brief"), "复制反馈应注明省略旧 brief");
assert(clipText.includes("[2026/") && clipText.includes("[why-not-play]"), "复制反馈应标注时间与来源");
assert(!clipText.includes("旧问") || clipText.includes("省略"), "默认不复制旧 brief 问答");

// game-2：压对5，有整对K时不应拆三张6组对66
const game2BeatPairHand = cards([
  ["6", SUITS.spades, 0], ["6", SUITS.spades, 1], ["6", SUITS.clubs, 1],
  ["K", SUITS.diamonds, 0], ["K", SUITS.diamonds, 1],
  ["7", SUITS.spades, 1], ["7", SUITS.hearts, 0], ["7", SUITS.hearts, 1],
  ["7", SUITS.clubs, 0], ["7", SUITS.clubs, 1], ["7", SUITS.diamonds, 1],
  ["8", SUITS.diamonds, 1], ["Q", SUITS.hearts, 1], ["A", SUITS.hearts, 1],
  ["2", SUITS.diamonds, 1], ["SJ", SUITS.joker, 0],
]);
const game2BeatPairPrev = classifyPlay(cards([["5", SUITS.diamonds, 0], ["5", SUITS.hearts, 0]]), "3");
let game2BeatPairState = createGameStateFromHands({
  levelRank: "3",
  hands: [game2BeatPairHand, beatSmall3Filler, beatSmall3Filler, beatSmall3Filler],
  currentPlayerIndex: 0,
});
game2BeatPairState = {
  ...game2BeatPairState,
  lastActivePlay: game2BeatPairPrev,
  lastActivePlayerIndex: 1,
};
const game2BeatPairRec = recommendPlay(
  game2BeatPairHand,
  "3",
  game2BeatPairPrev,
  {
    state: game2BeatPairState,
    playerIndex: 0,
    mlFusionMode: "off",
    mlModel: false,
  },
);
assert(
  game2BeatPairRec.candidate.type === PLAY_TYPES.pair && game2BeatPairRec.candidate.mainRank === "K",
  `压对5有整对K应首推对K，实际 ${game2BeatPairRec.candidate.label ?? game2BeatPairRec.candidate.mainRank}`,
);
const game2BeatPair6 = generateBasicCandidates(game2BeatPairHand, "3", game2BeatPairPrev)
  .find((c) => c.type === PLAY_TYPES.pair && c.mainRank === "6");
const game2BeatPairK = generateBasicCandidates(game2BeatPairHand, "3", game2BeatPairPrev)
  .find((c) => c.type === PLAY_TYPES.pair && c.mainRank === "K");
const whyNotUsePairK = tryLocalCoachAnswer("这里为什么不用对K，而要拆3个6？", {
  status: "in-progress",
  levelRank: "3",
  turnNumber: 20,
  humanHand: game2BeatPairHand.map((c) => ({
    rank: c.rank, suit: c.suit, deckIndex: c.deckIndex, label: c.rank,
  })),
  table: { lastActivePlay: game2BeatPairPrev },
  currentAdvice: {
    choices: [
      { play: game2BeatPair6, reasons: ["用最小对子压住对手对子，打断接风"] },
      { play: game2BeatPairK, reasons: ["用对子跟牌或抢权"] },
    ],
  },
});
assert(whyNotUsePairK?.mode === "why-not-play", "为何不用对K应走 why-not-play");
assert(whyNotUsePairK.text.includes("对K") || whyNotUsePairK.text.includes("整对K"), "应点明对K更优");
assert(/拆.*(三张6|三同张|三张)/.test(whyNotUsePairK.text), "应说明拆三个6代价");
assert(whyNotUsePairK.text.includes("P2"), "应引用 P2");
assert(!whyNotUsePairK.text.includes("规则备忘"), "不应落入 brief");
assert(!whyNotUsePairK.text.includes("你在问为何不采用"), "不应落入泛答");

// game-2 接风：23456 vs 12345/A2345，用户原文
const catchWindStraightHand = cards([
  ["6", SUITS.spades, 0], ["6", SUITS.hearts, 0], ["6", SUITS.clubs, 0],
  ["3", SUITS.spades, 0], ["3", SUITS.diamonds, 0],
  ["A", SUITS.diamonds, 0], ["2", SUITS.spades, 1], ["4", SUITS.spades, 0], ["5", SUITS.spades, 0],
  ["8", SUITS.hearts, 0], ["9", SUITS.clubs, 0], ["10", SUITS.diamonds, 0],
  ["J", SUITS.clubs, 0], ["Q", SUITS.hearts, 0], ["K", SUITS.diamonds, 0],
]);
const catchWindAll = generateBasicCandidates(catchWindStraightHand, "3", null);
const catchWindTriple6 = catchWindAll.find((c) => c.type === PLAY_TYPES.tripleWithPair && c.mainRank === "6");
const catchWindStraights = catchWindAll.filter((c) => c.type === PLAY_TYPES.straight);
const whyStraightChoice = tryLocalCoachAnswer(
  "推荐3中选23456，为什么不选12345？而是要拆三张，同时还多了一个A",
  {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 8,
    humanHand: catchWindStraightHand.map((c) => ({
      rank: c.rank, suit: c.suit, deckIndex: c.deckIndex, label: c.rank,
    })),
    table: { lastActivePlay: null },
    currentAdvice: {
      choices: [
        { play: catchWindTriple6, reasons: ["接风减手"] },
        { play: catchWindStraights[0], reasons: ["顺子减手"] },
        { play: catchWindStraights[catchWindStraights.length - 1] ?? catchWindStraights[0], reasons: ["顺子减手"] },
      ],
    },
  },
);
assert(whyStraightChoice?.mode === "why-not-play", "顺子对照应走 why-not-play");
assert(/23456|2-3-4-5-6|留A|大一级/.test(whyStraightChoice.text), "应解释23456+留A优先");
assert(!/优先走.*绕级顺|不宜走23456/i.test(whyStraightChoice.text), "不应再主张绕级顺优先");
assert(!whyStraightChoice.text.includes("规则备忘"), "不应落入 brief");
assert(!whyStraightChoice.text.includes("你在问为何不采用"), "不应落入泛答");

const game2Triple2J = generateBasicCandidates(game2PlateHand, "6", null)
  .find((c) => c.type === PLAY_TYPES.tripleWithPair && c.mainRank === "2");

const whyNotSingle7Answer = tryLocalCoachAnswer("为什么不打单7？", {
  status: "in-progress",
  levelRank: "6",
  turnNumber: 0,
  humanHand: game2PlateHand.map((c) => ({
    rank: c.rank, suit: c.suit, deckIndex: c.deckIndex, label: c.rank,
  })),
  table: { lastActivePlay: null },
  currentAdvice: {
    choices: [{
      play: game2Triple2J,
      reasons: ["三带二无送单回收路径，被压后只能靠炸"],
    }],
  },
});
assert(whyNotSingle7Answer?.mode === "why-not-play", "为什么不打单7应走 why-not-play");
assert(
  whyNotSingle7Answer.text.includes("单7") || whyNotSingle7Answer.text.includes("7"),
  "应回应单7",
);
assert(
  whyNotSingle7Answer.text.includes("大王") || whyNotSingle7Answer.text.includes("回收"),
  "应说明大王回收",
);

const why222WithJAnswer = tryLocalCoachAnswer("为什么222带J？", {
  status: "in-progress",
  levelRank: "6",
  turnNumber: 0,
  humanHand: game2PlateHand.map((c) => ({
    rank: c.rank, suit: c.suit, deckIndex: c.deckIndex, label: c.rank,
  })),
  table: { lastActivePlay: null },
  currentAdvice: {
    choices: [{
      play: {
        type: "TripleWithPair",
        mainRank: "2",
        label: "三带二 方片2 红桃2 红桃2 梅花J 方片J",
      },
      reasons: ["三带二无送单回收路径，被压后只能靠炸"],
    }],
  },
});
assert(why222WithJAnswer?.mode === "why-not-play", "为什么222带J应走 why-not-play");
assert(why222WithJAnswer.text.includes("送单回收") || why222WithJAnswer.text.includes("回收"), "应解释无送单回收");
assert(why222WithJAnswer.text.includes("炸"), "应说明被压后靠炸");

const localBombAnswer = tryLocalCoachAnswer("打了三个A，五个A的炸弹不就没有了吗？", {
  humanHand: cards([
    ["A"], ["A", SUITS.hearts], ["A", SUITS.clubs], ["A", SUITS.diamonds], ["A", SUITS.diamonds, 1],
    ["J"], ["J", SUITS.diamonds],
  ]).map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex, label: c.rank })),
  currentAdvice: {
    choices: [{
      play: { type: "Triple", mainRank: "A", label: "三张 A" },
      reasons: ["对手占牌"],
    }],
  },
});
assert(localBombAnswer?.source === "rule-engine", "拆炸问题应走规则引擎");
assert(localBombAnswer.text.includes("作废"), "规则引擎应明确炸弹作废");
assert(!localBombAnswer.text.includes("炸弹依然存在"), "不得再出现炸弹还在的错误表述");

const whyNotTriple2Answer = tryLocalCoachAnswer("为什么不打三个2带对8？", {
  status: "in-progress",
  levelRank: "3",
  turnNumber: 0,
  humanHand: cards([
    ["2", SUITS.clubs, 1],
    ["2", SUITS.hearts, 1],
    ["2", SUITS.spades, 0],
    ["2", SUITS.spades, 1],
    ["A", SUITS.clubs, 0],
    ["3", SUITS.clubs, 0],
    ["4", SUITS.clubs, 0],
    ["5", SUITS.clubs, 1],
    ["6", SUITS.spades, 0],
    ["6", SUITS.hearts, 0],
    ["6", SUITS.diamonds, 1],
    ["8", SUITS.clubs, 1],
    ["8", SUITS.diamonds, 1],
  ]).map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex, label: c.rank })),
  table: { lastActivePlay: null },
  currentAdvice: {
    choices: [{
      play: {
        type: "TripleWithPair",
        mainRank: "6",
        label: "三带二 黑桃6 红桃6 方片6 梅花8 方片8",
      },
      reasons: ["开局减手"],
    }],
  },
});
assert(whyNotTriple2Answer?.mode === "why-not-play", "为何不打出牌应走 why-not-play 模式");
const whyNotTriple2Lines = whyNotTriple2Answer.text.split("\n").filter((line) => line.trim());
assert(whyNotTriple2Lines.length <= 5, `game-2 作答应不超过 5 行，实际 ${whyNotTriple2Lines.length} 行`);
assert(
  /^【规则引擎作答】\n可以出/.test(whyNotTriple2Answer.text)
    || /^【规则引擎作答】\n不推荐/.test(whyNotTriple2Answer.text),
  "game-2 场景标题后应直接给结论",
);
assert(!whyNotTriple2Answer.text.includes("【直接回答】"), "不应再出现四段式小节标题");
assert(!whyNotTriple2Answer.text.includes("【和你想法的对比】"), "不应再出现对比大段");
assert(!whyNotTriple2Answer.text.includes("【为何左侧推荐1】"), "不应再出现推荐理由大段");
assert(/6.*2|2.*6/.test(whyNotTriple2Answer.text), "应点明三条用6还是2的差别");
assert(
  whyNotTriple2Answer.text.includes("三个2") || whyNotTriple2Answer.text.includes("222+88"),
  "应直接回应用户设想的三个2带对8",
);
assert(whyNotTriple2Answer.text.includes("666+88"), "应点明左侧首推 666+88");
assert(!whyNotTriple2Answer.text.includes("非大模型臆测"), "不应返回纯拆炸模板");
assert(!whyNotTriple2Answer.text.includes("若手里有"), "四炸场景应陈述事实，不用假设句");
assert(
  whyNotTriple2Answer.text.includes("同花顺") || whyNotTriple2Answer.text.includes("梅花2"),
  "应说明梅花2锁在同花顺",
);
assert(!whyNotTriple2Answer.text.includes("炸弹作废"), "不应错误声称炸弹作废");
assert(whyNotTriple2Answer.text.includes("可以出"), "应先承认可以出");
assert(whyNotTriple2Answer.text.includes("不会拆炸"), "应明确出三个2不会拆炸");
assert(!whyNotTriple2Answer.text.includes("整炸"), "无可整炸2时不应出现整炸");
assert(!whyNotTriple2Answer.text.includes("四炸"), "无可整炸2时不应出现四炸");
assert(whyNotTriple2Answer.text.includes("拿牌权"), "开局应点明拿牌权意图");
assert(!whyNotTriple2Answer.text.includes("ML 倾向"), "用户可见正文不含 ML 术语");
assert(!whyNotTriple2Answer.text.includes("2控权"), "级牌3局不应说2控权");
assert(!whyNotTriple2Answer.text.includes("2留作控权"), "级牌3局不应说2留作控权");
assert(whyNotTriple2Answer.text.includes("最小点") || whyNotTriple2Answer.text.includes("级牌"), "应说明2在级牌3局是最小点");

const game2Hand = cards([
  ["2", SUITS.clubs, 1],
  ["2", SUITS.hearts, 1],
  ["2", SUITS.spades, 0],
  ["2", SUITS.spades, 1],
  ["A", SUITS.clubs, 0],
  ["3", SUITS.clubs, 0],
  ["4", SUITS.clubs, 0],
  ["5", SUITS.clubs, 1],
  ["6", SUITS.spades, 0],
  ["6", SUITS.hearts, 0],
  ["6", SUITS.diamonds, 1],
  ["8", SUITS.clubs, 1],
  ["8", SUITS.diamonds, 1],
]);
const game2Triple2Pair8 = generateBasicCandidates(game2Hand, "3", null)
  .find((c) => c.type === PLAY_TYPES.tripleWithPair && c.mainRank === "2"
    && (c.cards ?? []).filter((card) => card.rank === "8").length >= 2);
assert(game2Triple2Pair8, "game-2 手牌应能组 222+88");
assert(
  !breaksBombIntegrity(game2Triple2Pair8, game2Hand, "3"),
  "梅花2在同花顺时 222+88 不应被判拆炸",
);

const whyNotTriple2Only3Answer = tryLocalCoachAnswer("为什么不打三个2带对8？", {
  status: "in-progress",
  levelRank: "3",
  turnNumber: 0,
  humanHand: cards([
    ["2"], ["2", SUITS.hearts], ["2", SUITS.clubs],
    ["6", SUITS.spades], ["6", SUITS.hearts], ["6", SUITS.diamonds],
    ["8", SUITS.clubs], ["8", SUITS.diamonds],
  ]).map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex, label: c.rank })),
  table: { lastActivePlay: null },
  currentAdvice: {
    choices: [{
      play: {
        type: "TripleWithPair",
        mainRank: "6",
        label: "三带二 黑桃6 红桃6 方片6 梅花8 方片8",
      },
      reasons: ["拆三张6代价偏低", "ML 倾向分 3%"],
    }],
  },
});
assert(whyNotTriple2Only3Answer?.mode === "why-not-play", "仅三张2场景也应走 why-not-play");
assert(whyNotTriple2Only3Answer.text.split("\n").filter((line) => line.trim()).length <= 5, "仅三张2作答也应简短");
assert(!whyNotTriple2Only3Answer.text.includes("四炸作废"), "仅三张2时不应说四炸作废");
assert(!whyNotTriple2Only3Answer.text.includes("若手里有"), "仅三张2时不应使用假设句");
assert(
  whyNotTriple2Only3Answer.text.includes("最小点")
    || whyNotTriple2Only3Answer.text.includes("级牌")
    || whyNotTriple2Only3Answer.text.includes("牌力偏弱"),
  "应陈述仅3张2的牌力代价",
);
assert(
  whyNotTriple2Only3Answer.text.includes("拿牌权") || whyNotTriple2Only3Answer.text.includes("666+88"),
  "应点明首推意图",
);
assert(!whyNotTriple2Only3Answer.text.includes("ML 倾向"), "用户可见正文不含 ML 术语");

const briefAnswer = tryLocalCoachAnswer("这手为什么推荐过牌？", {
  status: "in-progress",
  levelRank: "2",
  turnNumber: 8,
  humanHand: [],
  table: { lastActivePlay: { label: "对Q" } },
  currentAdvice: {
    choices: [{ play: { type: "Pass", label: "过牌" }, reasons: ["保留炸弹"] }],
  },
});
assert(briefAnswer?.mode === "fallback", "普通问题为 fallback 短答模式");
assert(!briefAnswer?.text?.includes("规则备忘"), "fallback 兜底不应含炸弹备忘");
assert(
  briefAnswer?.text?.includes("请具体问") || briefAnswer?.text?.includes("未匹配专问"),
  "fallback 应提示具体问法",
);

const plateBreakQHand = cards([
  ["6", SUITS.spades], ["6", SUITS.hearts], ["6", SUITS.diamonds],
  ["7", SUITS.spades], ["7", SUITS.hearts], ["7", SUITS.diamonds],
  ["8", SUITS.clubs], ["8", SUITS.diamonds],
  ["Q", SUITS.clubs],
  ["3", SUITS.clubs], ["4", SUITS.hearts], ["5", SUITS.spades],
  ["9", SUITS.clubs], ["10", SUITS.hearts], ["J", SUITS.diamonds],
  ["K", SUITS.spades], ["A", SUITS.clubs], ["2", SUITS.hearts],
  ["2", SUITS.clubs], ["3", SUITS.diamonds], ["4", SUITS.diamonds],
  ["5", SUITS.hearts], ["9", SUITS.diamonds], ["10", SUITS.clubs],
  ["J", SUITS.hearts], ["K", SUITS.diamonds], ["A", SUITS.spades],
]);
const plateGroups = buildStrategicGroups(plateBreakQHand, "3").filter((g) => g.label?.startsWith("钢板"));
assert(plateGroups.length >= 1, "测试手牌应理出钢板");

const whyBreakPlateQAnswer = tryLocalCoachAnswer("这手为什么推荐要拆钢板？打Q不是更好吗？", {
  status: "in-progress",
  levelRank: "3",
  turnNumber: 0,
  humanHand: plateBreakQHand.map((c) => ({
    rank: c.rank,
    suit: c.suit,
    deckIndex: c.deckIndex,
    label: c.rank,
  })),
  table: { lastActivePlay: null },
  currentAdvice: {
    choices: [
      {
        play: {
          type: "TripleWithPair",
          mainRank: "6",
          label: "三带二 黑桃6 红桃6 方片6 梅花8 方片8",
        },
        reasons: ["拆三张6组其他牌型代价偏高", "开局减手"],
      },
      {
        play: { type: "Single", mainRank: "Q", label: "单张 梅花Q" },
        reasons: ["开局保留高控制牌"],
      },
    ],
  },
});
assert(whyBreakPlateQAnswer?.mode === "why-not-play", "拆钢板vs打Q应走 why-not-play 模式");
assert(whyBreakPlateQAnswer?.mode !== "brief", "不应落入 brief 规则备忘");
assert(!whyBreakPlateQAnswer.text.includes("规则备忘"), "不应返回规则备忘");
assert(whyBreakPlateQAnswer.text.includes("钢板"), "应解释钢板结构");
assert(
  whyBreakPlateQAnswer.text.includes("单Q") || whyBreakPlateQAnswer.text.includes("打Q"),
  "应回应打Q设想",
);
assert(
  whyBreakPlateQAnswer.text.includes("试探") || whyBreakPlateQAnswer.text.includes("有道理"),
  "手牌仍多时应承认打Q有道理",
);
assert(whyBreakPlateQAnswer.text.split("\n").filter((line) => line.trim()).length <= 5, "拆钢板作答应简短");

const game2BreakThree2Hand = [
  { rank: "2", suit: "D", deckIndex: 1 },
  { rank: "2", suit: "H", deckIndex: 0 },
  { rank: "2", suit: "H", deckIndex: 1 },
  { rank: "4", suit: "C", deckIndex: 0 },
  { rank: "4", suit: "C", deckIndex: 1 },
  { rank: "4", suit: "H", deckIndex: 0 },
  { rank: "5", suit: "D", deckIndex: 1 },
  { rank: "5", suit: "H", deckIndex: 0 },
  { rank: "5", suit: "S", deckIndex: 0 },
  { rank: "7", suit: "C", deckIndex: 0 },
  { rank: "9", suit: "C", deckIndex: 0 },
  { rank: "9", suit: "C", deckIndex: 1 },
  { rank: "9", suit: "D", deckIndex: 1 },
  { rank: "9", suit: "H", deckIndex: 0 },
  { rank: "10", suit: "C", deckIndex: 0 },
  { rank: "J", suit: "C", deckIndex: 0 },
  { rank: "J", suit: "D", deckIndex: 0 },
  { rank: "J", suit: "H", deckIndex: 1 },
  { rank: "Q", suit: "C", deckIndex: 0 },
  { rank: "Q", suit: "D", deckIndex: 0 },
  { rank: "Q", suit: "H", deckIndex: 0 },
  { rank: "Q", suit: "S", deckIndex: 0 },
  { rank: "K", suit: "C", deckIndex: 0 },
  { rank: "K", suit: "D", deckIndex: 0 },
  { rank: "SJ", suit: "JOKER", deckIndex: 0 },
  { rank: "BJ", suit: "JOKER", deckIndex: 0 },
  { rank: "10", suit: "D", deckIndex: 0 },
];
const whyBreakThree2Answer = tryLocalCoachAnswer("而且还拆了三个2？", {
  status: "in-progress",
  levelRank: "6",
  turnNumber: 0,
  humanHand: game2BreakThree2Hand,
  table: { lastActivePlay: null },
  currentAdvice: {
    choices: [{
      play: {
        type: "TripleWithPair",
        mainRank: "4",
        label: "三带二 梅花4 梅花4 红桃4 方片2 红桃2",
      },
      reasons: ["拆三张4组其他牌型代价偏高", "开局减手"],
    }],
  },
});
assert(whyBreakThree2Answer?.mode === "structure-break", "拆三个2追问应走 structure-break 模式");
assert(whyBreakThree2Answer?.mode !== "rule-only", "不应落入拆炸 rule-only 模板");
assert(!whyBreakThree2Answer.text.includes("非大模型臆测"), "不应返回 Q 炸拆炸模板");
assert(!whyBreakThree2Answer.text.includes("四炸") || whyBreakThree2Answer.text.includes("不成炸"), "不应误讲 Q 四炸");
assert(!whyBreakThree2Answer.text.includes("Q四炸") && !whyBreakThree2Answer.text.includes("4张Q"), "不应答非所问讲 Q 炸");
assert(
  whyBreakThree2Answer.text.includes("并未拆三个2") || whyBreakThree2Answer.text.includes("并未拆三个"),
  "应正面说明是否拆了三个2",
);
assert(whyBreakThree2Answer.text.includes("4") && whyBreakThree2Answer.text.includes("2"), "应说明三条4与对2的分工");
assert(
  whyBreakThree2Answer.text.includes("最小") || whyBreakThree2Answer.text.includes("级牌6"),
  "应结合级牌说明2的牌力",
);
assert(whyBreakThree2Answer.text.split("\n").filter((line) => line.trim()).length <= 5, "拆三个2作答应简短");

const game2PairJOverTriple8Hand = [
  { rank: "4", suit: "C", deckIndex: 0 },
  { rank: "4", suit: "H", deckIndex: 0 },
  { rank: "4", suit: "S", deckIndex: 1 },
  { rank: "8", suit: "D", deckIndex: 1 },
  { rank: "8", suit: "H", deckIndex: 1 },
  { rank: "8", suit: "S", deckIndex: 1 },
  { rank: "J", suit: "S", deckIndex: 0 },
  { rank: "J", suit: "S", deckIndex: 1 },
  { rank: "7", suit: "C", deckIndex: 0 },
  { rank: "7", suit: "D", deckIndex: 0 },
  { rank: "7", suit: "D", deckIndex: 1 },
  { rank: "7", suit: "S", deckIndex: 1 },
  { rank: "2", suit: "H", deckIndex: 1 },
  { rank: "6", suit: "H", deckIndex: 1 },
  { rank: "9", suit: "H", deckIndex: 1 },
  { rank: "10", suit: "C", deckIndex: 0 },
  { rank: "10", suit: "C", deckIndex: 1 },
  { rank: "10", suit: "D", deckIndex: 1 },
  { rank: "10", suit: "S", deckIndex: 0 },
  { rank: "10", suit: "S", deckIndex: 1 },
  { rank: "K", suit: "C", deckIndex: 0 },
  { rank: "K", suit: "D", deckIndex: 0 },
  { rank: "K", suit: "H", deckIndex: 1 },
  { rank: "K", suit: "S", deckIndex: 0 },
  { rank: "A", suit: "H", deckIndex: 0 },
  { rank: "A", suit: "H", deckIndex: 1 },
  { rank: "Q", suit: "C", deckIndex: 0 },
];
const whyPair5QNotBreak2Answer = tryLocalCoachAnswer("怎么还是拆三个2，有对5和对Q可以带？", {
  status: "in-progress",
  levelRank: "3",
  turnNumber: 0,
  humanHand: game2BreakThree2Hand,
  table: { lastActivePlay: null },
  currentAdvice: {
    choices: [{
      play: {
        type: "TripleWithPair",
        mainRank: "4",
        label: "三带二 梅花4 梅花4 红桃4 方片2 红桃2",
      },
      reasons: ["开局减手"],
    }],
  },
});
assert(whyPair5QNotBreak2Answer?.mode === "why-not-play", "有对5对Q专问应走 why-not-play");
assert(whyPair5QNotBreak2Answer?.mode !== "structure-break", "不应落入 structure-break");
assert(/并未拆三个2|只是带牌/.test(whyPair5QNotBreak2Answer.text), "应澄清是否拆了三个2");
assert(/对5|对Q/.test(whyPair5QNotBreak2Answer.text), "应回应带对5/对Q");
assert(!whyPair5QNotBreak2Answer.text.includes("用对2带牌代价低"), "不应只讲2代价低而忽略对5对Q");

const whyPairJNotBreak8Answer = tryLocalCoachAnswer("应该直接带对J，不应该拆三个8", {
  status: "in-progress",
  levelRank: "3",
  turnNumber: 0,
  humanHand: game2PairJOverTriple8Hand,
  table: { lastActivePlay: null },
  currentAdvice: {
    choices: [{
      play: {
        type: "TripleWithPair",
        mainRank: "4",
        label: "三带二 梅花4 红桃4 黑桃4 方片8 红桃8",
      },
      reasons: ["拆三张4组其他牌型代价偏高", "接风减手"],
    }],
  },
});
assert(whyPairJNotBreak8Answer?.mode === "why-not-play", "带对J专问应走 why-not-play");
assert(whyPairJNotBreak8Answer?.mode !== "structure-break", "不应落入 structure-break");
assert(whyPairJNotBreak8Answer.text.includes("对J"), "应正面回应带对J");
assert(/三个8|三同张8/.test(whyPairJNotBreak8Answer.text), "应点明三个8");
assert(whyPairJNotBreak8Answer.text.includes("并未拆三个8"), "应澄清推荐1未拆三个8");
assert(
  whyPairJNotBreak8Answer.text.includes("改带对J") || whyPairJNotBreak8Answer.text.includes("有道理"),
  "应认可带对J思路",
);
assert(!whyPairJNotBreak8Answer.text.includes("不成炸"), "不应只讲8不成炸");
assert(whyPairJNotBreak8Answer.text.split("\n").filter((line) => line.trim()).length <= 5, "带对J作答应简短");

const whyPlayQBreakPairHand = [
  { rank: "2", suit: "C", deckIndex: 1 },
  { rank: "2", suit: "D", deckIndex: 1 },
  { rank: "2", suit: "H", deckIndex: 0 },
  { rank: "2", suit: "S", deckIndex: 1 },
  { rank: "3", suit: "C", deckIndex: 0 },
  { rank: "3", suit: "C", deckIndex: 1 },
  { rank: "3", suit: "H", deckIndex: 0 },
  { rank: "3", suit: "H", deckIndex: 1 },
  { rank: "6", suit: "S", deckIndex: 0 },
  { rank: "6", suit: "S", deckIndex: 1 },
  { rank: "10", suit: "C", deckIndex: 1 },
  { rank: "10", suit: "S", deckIndex: 0 },
  { rank: "J", suit: "C", deckIndex: 1 },
  { rank: "J", suit: "D", deckIndex: 1 },
  { rank: "J", suit: "S", deckIndex: 0 },
  { rank: "Q", suit: "C", deckIndex: 0 },
  { rank: "Q", suit: "S", deckIndex: 1 },
  { rank: "K", suit: "H", deckIndex: 1 },
  { rank: "K", suit: "S", deckIndex: 0 },
  { rank: "A", suit: "H", deckIndex: 0 },
  { rank: "BJ", suit: "JOKER", deckIndex: 1 },
];
const whyPlayQBreakPairAnswer = tryLocalCoachAnswer("为什么要打Q？拆了对子，打A不好吗？", {
  status: "in-progress",
  levelRank: "6",
  turnNumber: 12,
  humanHand: whyPlayQBreakPairHand,
  table: {
    lastActivePlay: {
      type: "Single",
      mainRank: "J",
      label: "单张 梅花J",
    },
  },
  currentAdvice: {
    choices: [
      {
        play: { type: "Single", mainRank: "Q", label: "单张 梅花Q" },
        reasons: ["跟住对手单张，避免其连续占牌", "ML 倾向分 17%"],
      },
      {
        play: { type: "Single", mainRank: "Q", label: "单张 黑桃Q" },
        reasons: ["跟住对手单张，避免其连续占牌"],
      },
      {
        play: { type: "Single", mainRank: "K", label: "单张 红桃K" },
        reasons: ["跟住对手单张，避免其连续占牌"],
      },
    ],
  },
});
assert(whyPlayQBreakPairAnswer?.mode === "why-not-play", "拆对子打Q应走 why-not-play 模式");
assert(whyPlayQBreakPairAnswer?.mode !== "brief", "不应落入 brief 规则备忘");
assert(!whyPlayQBreakPairAnswer.text.includes("你在问为何不采用"), "不应落入 why-not-play 泛答");
assert(!whyPlayQBreakPairAnswer.text.includes("规则备忘"), "不应返回规则备忘");
assert(!whyPlayQBreakPairAnswer.text.includes("当前推荐："), "不应罗列候选清单");
assert(
  whyPlayQBreakPairAnswer.text.includes("拆") && whyPlayQBreakPairAnswer.text.includes("对"),
  "应说明拆对子代价",
);
assert(
  whyPlayQBreakPairAnswer.text.includes("单Q") || whyPlayQBreakPairAnswer.text.includes("打Q"),
  "应解释为何打Q",
);
assert(
  whyPlayQBreakPairAnswer.text.includes("单A") || whyPlayQBreakPairAnswer.text.includes("打A"),
  "应回应打A是否更优",
);
assert(
  whyPlayQBreakPairAnswer.text.includes("跟住") || whyPlayQBreakPairAnswer.text.includes("压"),
  "应说明压牌意图",
);
assert(whyPlayQBreakPairAnswer.text.split("\n").filter((line) => line.trim()).length <= 5, "拆对子打Q作答应简短");

// rankPower：多组 levelRank 下 2/A/级牌大小
assert(rankPower("2", "3") < rankPower("9", "3"), "级牌3时2应小于9");
assert(rankPower("2", "3") === 0, "级牌3时2应是最小点");
assert(isControlRank("3", "3"), "级牌3时3是控权牌");
assert(!isControlRank("2", "3"), "级牌3时2不是控权牌");
assert(compareRanks("2", "9", "5") < 0, "级牌5时2炸小于9炸");
assert(compareRanks("2", "9", "2") > 0, "级牌2时2炸大于9炸");
assert(rankPower("A", "A") > rankPower("K", "A"), "级牌A时A大于K");
assert(isControlRank("2", "2"), "级牌2时2是控权牌");

// 炸弹取舍：推荐小炸（四张9）不用大炸（四张2）
const whyNotBomb2Hand = cards([
  ["9", SUITS.spades], ["9", SUITS.hearts], ["9", SUITS.clubs], ["9", SUITS.diamonds],
  ["2", SUITS.spades], ["2", SUITS.hearts], ["2", SUITS.clubs], ["2", SUITS.diamonds],
  ["J", SUITS.clubs], ["Q", SUITS.diamonds], ["K", SUITS.hearts],
]);
const whyNotBomb2Answer = tryLocalCoachAnswer("这手为什么不用四个2压？", {
  status: "in-progress",
  levelRank: "2",
  turnNumber: 15,
  humanHand: whyNotBomb2Hand.map((c) => ({
    rank: c.rank,
    suit: c.suit,
    deckIndex: c.deckIndex,
    label: c.rank,
  })),
  table: {
    lastActivePlay: {
      type: "Bomb",
      mainRank: "7",
      bombSize: 4,
      power: 7,
      label: "炸弹 方片7 梅花7 红桃7 黑桃7",
    },
  },
  currentAdvice: {
    choices: [{
      play: {
        type: "Bomb",
        mainRank: "9",
        bombSize: 4,
        label: "炸弹 黑桃9 红桃9 梅花9 方片9",
      },
      reasons: ["只有炸弹能压，应抢牌权", "炸弹是牌权资源，非必要不消耗"],
    }],
  },
});
assert(whyNotBomb2Answer?.mode === "why-not-bomb", "为何不用大炸应走 why-not-bomb 模式");
assert(whyNotBomb2Answer?.mode !== "brief", "不应落入 brief 规则备忘");
assert(!whyNotBomb2Answer.text.includes("规则备忘"), "不应返回规则备忘");
assert(!whyNotBomb2Answer.text.includes("你在问为何不采用"), "不应落入 why-not-play 泛答");
assert(
  whyNotBomb2Answer.text.includes("四张9") || whyNotBomb2Answer.text.includes("9"),
  "应点明推荐四张9",
);
assert(
  whyNotBomb2Answer.text.includes("四张2") || whyNotBomb2Answer.text.includes("2炸"),
  "应回应用户设想的四张2",
);
assert(
  whyNotBomb2Answer.text.includes("够压") || whyNotBomb2Answer.text.includes("小炸"),
  "应说明小炸够用",
);
assert(
  whyNotBomb2Answer.text.includes("留") || whyNotBomb2Answer.text.includes("关键"),
  "应说明保留大炸",
);
assert(whyNotBomb2Answer.text.split("\n").filter((line) => line.trim()).length <= 5, "炸弹取舍作答应简短");

// 炸弹取舍：级牌非 2 时 2炸<9炸，小炸够压应留大炸（levelRank=5）
const whyNotBomb4Hand = cards([
  ["4", SUITS.spades], ["4", SUITS.hearts], ["4", SUITS.clubs], ["4", SUITS.diamonds],
  ["9", SUITS.spades], ["9", SUITS.hearts], ["9", SUITS.clubs], ["9", SUITS.diamonds],
  ["J", SUITS.clubs], ["Q", SUITS.diamonds],
]);
const whyNotBomb4Answer = tryLocalCoachAnswer("这手为什么不用四个4压？", {
  status: "in-progress",
  levelRank: "5",
  turnNumber: 10,
  humanHand: whyNotBomb4Hand.map((c) => ({
    rank: c.rank,
    suit: c.suit,
    deckIndex: c.deckIndex,
    label: c.rank,
  })),
  table: {
    lastActivePlay: {
      type: "Bomb",
      mainRank: "3",
      bombSize: 4,
      label: "炸弹 方片3 梅花3 红桃3 黑桃3",
    },
  },
  currentAdvice: {
    choices: [{
      play: {
        type: "Bomb",
        mainRank: "9",
        bombSize: 4,
        label: "炸弹 黑桃9 红桃9 梅花9 方片9",
      },
      reasons: ["只有炸弹能压，应抢牌权"],
    }],
  },
});
assert(whyNotBomb4Answer?.mode === "why-not-bomb", "级牌5时小炸追问应走 why-not-bomb");
assert(
  whyNotBomb4Answer.text.includes("够压") || whyNotBomb4Answer.text.includes("小炸"),
  "应说明四张4够压",
);
assert(
  whyNotBomb4Answer.text.includes("9") && (whyNotBomb4Answer.text.includes("留") || whyNotBomb4Answer.text.includes("关键")),
  "应说明保留9炸",
);
assert(!whyNotBomb4Answer.text.includes("不够稳"), "不应误判小炸不够稳");
assert(whyNotBomb4Answer.text.split("\n").filter((line) => line.trim()).length <= 5, "级牌5炸弹作答应简短");

// 炸弹取舍：levelRank=6 时 5炸<9炸
const whyNotBomb5Hand = cards([
  ["5", SUITS.spades], ["5", SUITS.hearts], ["5", SUITS.clubs], ["5", SUITS.diamonds],
  ["9", SUITS.spades], ["9", SUITS.hearts], ["9", SUITS.clubs], ["9", SUITS.diamonds],
]);
const whyNotBomb5Answer = tryLocalCoachAnswer("为什么不用四个5压？", {
  status: "in-progress",
  levelRank: "6",
  turnNumber: 10,
  humanHand: whyNotBomb5Hand.map((c) => ({
    rank: c.rank,
    suit: c.suit,
    deckIndex: c.deckIndex,
    label: c.rank,
  })),
  table: {
    lastActivePlay: {
      type: "Bomb",
      mainRank: "4",
      bombSize: 4,
      label: "炸弹 方片4 梅花4 红桃4 黑桃4",
    },
  },
  currentAdvice: {
    choices: [{
      play: {
        type: "Bomb",
        mainRank: "9",
        bombSize: 4,
        label: "炸弹 黑桃9 红桃9 梅花9 方片9",
      },
      reasons: ["只有炸弹能压，应抢牌权"],
    }],
  },
});
assert(whyNotBomb5Answer?.mode === "why-not-bomb", "级牌6时小炸追问应走 why-not-bomb");
assert(whyNotBomb5Answer.text.includes("够压") && whyNotBomb5Answer.text.includes("9"), "应说明5炸够压、保留9炸");
assert(!whyNotBomb5Answer.text.includes("2炸通常留到残局"), "级牌6时不应硬编码2炸留残局");

// 级牌3：2炸压不住7炸，应点明2是最小点
const whyNotBomb2Level3Answer = tryLocalCoachAnswer("这手为什么不用四个2压？", {
  status: "in-progress",
  levelRank: "3",
  turnNumber: 15,
  humanHand: whyNotBomb2Hand.map((c) => ({
    rank: c.rank,
    suit: c.suit,
    deckIndex: c.deckIndex,
    label: c.rank,
  })),
  table: {
    lastActivePlay: {
      type: "Bomb",
      mainRank: "7",
      bombSize: 4,
      label: "炸弹 方片7 梅花7 红桃7 黑桃7",
    },
  },
  currentAdvice: {
    choices: [{
      play: {
        type: "Bomb",
        mainRank: "9",
        bombSize: 4,
        label: "炸弹 黑桃9 红桃9 梅花9 方片9",
      },
      reasons: ["只有炸弹能压，应抢牌权"],
    }],
  },
});
assert(whyNotBomb2Level3Answer?.mode === "why-not-bomb", "级牌3时2炸追问应走 why-not-bomb");
assert(whyNotBomb2Level3Answer.text.includes("压不住"), "级牌3时应说明2炸压不住");
assert(
  whyNotBomb2Level3Answer.text.includes("最小") || whyNotBomb2Level3Answer.text.includes("级牌"),
  "级牌3时应点明2是最小点或级牌关系",
);
assert(!whyNotBomb2Level3Answer.text.includes("2炸通常留到残局"), "级牌3时不应说2炸留残局");

// game-1 第16手：级牌6压大王应首推最小2炸，而非9炸
const game1Turn16Hand = cards([
  ["2", SUITS.diamonds], ["2", SUITS.hearts], ["2", SUITS.hearts, 1], ["2", SUITS.spades],
  ["4", SUITS.spades, 1],
  ["6", SUITS.clubs, 1],
  ["8", SUITS.clubs], ["8", SUITS.diamonds], ["8", SUITS.diamonds, 1], ["8", SUITS.spades, 1],
  ["9", SUITS.clubs], ["9", SUITS.clubs, 1], ["9", SUITS.diamonds], ["9", SUITS.diamonds, 1], ["9", SUITS.spades, 1],
  ["10", SUITS.clubs, 1],
  ["J", SUITS.spades],
  ["Q", SUITS.diamonds],
  ["K", SUITS.hearts, 1],
  ["SJ", SUITS.joker],
]);
const game1BjSingle = classifyPlay([createCard("BJ", SUITS.joker, 1)], "6");
const game1Turn16State = createGameStateFromHands({
  levelRank: "6",
  hands: [game1Turn16Hand, cards([["3"]]), cards([["4"]]), cards([["5", SUITS.clubs]])],
  currentPlayerIndex: 0,
});
const game1Turn16Patched = {
  ...game1Turn16State,
  lastActivePlay: game1BjSingle,
  lastActivePlayerIndex: 3,
};
const game1Turn16Rec = recommendPlay(
  game1Turn16Patched.players[0].hand,
  "6",
  game1BjSingle,
  {
    state: game1Turn16Patched,
    playerIndex: 0,
    lastActivePlayerIndex: 3,
    previousPlay: game1BjSingle,
    preferredGroups: buildStrategicGroups(game1Turn16Patched.players[0].hand, "6"),
    mlFusionMode: "off",
    mlModel: false,
  },
);
assert(
  game1Turn16Rec.candidate.type === PLAY_TYPES.bomb && game1Turn16Rec.candidate.mainRank === "2",
  `级牌6压大王应首推2炸，实际 ${game1Turn16Rec.candidate.label}`,
);

// game-1 第28手：级牌6再压大王应首推8炸，而非9炸
const game1Turn28Hand = cards([
  ["4", SUITS.spades, 1],
  ["8", SUITS.clubs], ["8", SUITS.diamonds], ["8", SUITS.diamonds, 1], ["8", SUITS.spades, 1],
  ["9", SUITS.clubs], ["9", SUITS.clubs, 1], ["9", SUITS.diamonds], ["9", SUITS.diamonds, 1], ["9", SUITS.spades, 1],
  ["10", SUITS.clubs, 1], ["J", SUITS.spades], ["Q", SUITS.diamonds], ["K", SUITS.hearts, 1], ["SJ", SUITS.joker],
]);
const game1Turn28Bj = classifyPlay([createCard("BJ", SUITS.joker, 0)], "6");
const game1Turn28State = createGameStateFromHands({
  levelRank: "6",
  hands: [game1Turn28Hand, cards([["3"]]), cards([["4"]]), cards([["5", SUITS.clubs]])],
  currentPlayerIndex: 0,
});
const game1Turn28Patched = {
  ...game1Turn28State,
  lastActivePlay: game1Turn28Bj,
  lastActivePlayerIndex: 1,
};
const game1Turn28Rec = recommendPlay(
  game1Turn28Patched.players[0].hand,
  "6",
  game1Turn28Bj,
  {
    state: game1Turn28Patched,
    playerIndex: 0,
    lastActivePlayerIndex: 1,
    previousPlay: game1Turn28Bj,
    preferredGroups: buildStrategicGroups(game1Turn28Patched.players[0].hand, "6"),
    mlFusionMode: "off",
    mlModel: false,
  },
);
assert(
  game1Turn28Rec.candidate.type === PLAY_TYPES.bomb && game1Turn28Rec.candidate.mainRank === "8",
  `级牌6再压大王应首推8炸，实际 ${game1Turn28Rec.candidate.label ?? game1Turn28Rec.candidate.mainRank}`,
);

// game-1 第40手：残局接风应优先顺子减手
const game1Turn40Hand = cards([
  ["9", SUITS.clubs], ["9", SUITS.clubs, 1], ["9", SUITS.diamonds], ["9", SUITS.diamonds, 1], ["9", SUITS.spades, 1],
  ["10", SUITS.clubs, 1],
  ["J", SUITS.spades],
  ["Q", SUITS.diamonds],
  ["K", SUITS.hearts, 1],
]);
const game1Turn40History = [
  { turnNumber: 38, playerIndex: 0, play: classifyPlay([createCard("SJ", SUITS.joker)], "6") },
  { turnNumber: 39, playerIndex: 1, play: classifyPlay([], "6") },
  { turnNumber: 40, playerIndex: 2, play: classifyPlay([], "6") },
  { turnNumber: 41, playerIndex: 3, play: classifyPlay([], "6") },
];
const game1Turn40State = createGameStateFromHands({
  levelRank: "6",
  hands: [game1Turn40Hand, cards([["3"]]), cards([["4"]]), cards([["5", SUITS.clubs]])],
  currentPlayerIndex: 0,
});
const game1Turn40Patched = {
  ...game1Turn40State,
  lastActivePlay: null,
  lastActivePlayerIndex: null,
  playHistory: game1Turn40History,
};
const game1Turn40Rec = recommendPlay(
  game1Turn40Patched.players[0].hand,
  "6",
  null,
  {
    state: game1Turn40Patched,
    playerIndex: 0,
    preferredGroups: buildStrategicGroups(game1Turn40Patched.players[0].hand, "6"),
    mlFusionMode: "off",
    mlModel: false,
  },
);
assert(
  game1Turn40Rec.candidate.type === PLAY_TYPES.straight && game1Turn40Rec.candidate.length >= 5,
  `残局接风应首推顺子，实际 ${game1Turn40Rec.candidate.label}`,
);
assert(
  !game1Turn40Rec.reasons.some((r) => /炸弹作废/.test(r)),
  `顺子推荐不应误报炸弹作废，实际 ${game1Turn40Rec.reasons.join("；")}`,
);

const whyBreak9StraightAnswer = tryLocalCoachAnswer("为什么拆9炸组顺接风？", {
  status: "in-progress",
  levelRank: "6",
  turnNumber: 40,
  humanHand: game1Turn40Hand.map((c) => ({
    rank: c.rank,
    suit: c.suit,
    deckIndex: c.deckIndex,
    label: c.label ?? c.rank,
  })),
  table: { lastActivePlay: null },
  currentAdvice: {
    choices: [{
      play: game1Turn40Rec.candidate,
      reasons: game1Turn40Rec.reasons,
    }],
  },
});
assert(whyBreak9StraightAnswer?.source === "rule-engine", "拆9炸组顺应走规则引擎");
assert(whyBreak9StraightAnswer.text.includes("接风"), "应解释接风场景");
assert(
  whyBreak9StraightAnswer.text.includes("并未作废") || whyBreak9StraightAnswer.text.includes("炸弹还在"),
  "应说明拆1张9后炸弹仍在",
);
assert(!whyBreak9StraightAnswer.text.includes("非大模型臆测"), "不应返回泛拆炸模板");

const game1Turn40Div = classifyDivergence({
  actual: "顺子 黑桃9 梅花10 黑桃J 方片Q 红桃K",
  recommended: "单张 梅花10",
  mustBeat: null,
  handCount: 9,
  levelRank: "6",
  recommendedReasons: ["接风阶段少用小单浪费牌权"],
}, {
  choices: [{ play: { type: "Single", mainRank: "10" } }],
  actualPlay: { type: "Straight", length: 5 },
  levelRank: "6",
});
assert(
  game1Turn40Div.verdict === "user-better",
  `game1 turn40 应判你更对，实际 ${game1Turn40Div.verdict}`,
);
assert(
  game1Turn40Div.note.includes("拆小炸组顺"),
  `应强调拆炸组顺，实际 ${game1Turn40Div.note}`,
);

// 炸弹时机：有普通过牌不必炸（bomb-timing 预设思路）
const whyNotBomb8Hand = cards([
  ["10", SUITS.spades], ["J", SUITS.clubs],
  ["8", SUITS.spades], ["8", SUITS.hearts], ["8", SUITS.clubs], ["8", SUITS.diamonds],
]);
const whyNotBomb8Answer = tryLocalCoachAnswer("为什么不用四个8压？", {
  status: "in-progress",
  levelRank: "4",
  turnNumber: 6,
  humanHand: whyNotBomb8Hand.map((c) => ({
    rank: c.rank,
    suit: c.suit,
    deckIndex: c.deckIndex,
    label: c.rank,
  })),
  table: {
    lastActivePlay: {
      type: "Single",
      mainRank: "9",
      label: "单张 方片9",
    },
  },
  currentAdvice: {
    choices: [{
      play: { type: "Single", mainRank: "10", label: "单张 黑桃10" },
      reasons: ["跟住对手单张，避免其连续占牌"],
    }],
  },
});
assert(whyNotBomb8Answer?.mode === "why-not-bomb", "有普通过牌时不用炸应走 why-not-bomb");
assert(
  whyNotBomb8Answer.text.includes("够压") || whyNotBomb8Answer.text.includes("不必"),
  "应说明普通牌够压不必炸",
);
assert(whyNotBomb8Answer.text.includes("四张8") || whyNotBomb8Answer.text.includes("8炸"), "应回应四张8设想");
assert(whyNotBomb8Answer.text.split("\n").filter((line) => line.trim()).length <= 5, "炸弹时机作答应简短");

// 「为什么用9不用2」句式
const whyUse9Not2Answer = tryLocalCoachAnswer("为什么用9不用2？", {
  status: "in-progress",
  levelRank: "2",
  turnNumber: 15,
  humanHand: whyNotBomb2Hand.map((c) => ({
    rank: c.rank,
    suit: c.suit,
    deckIndex: c.deckIndex,
    label: c.rank,
  })),
  table: {
    lastActivePlay: {
      type: "Bomb",
      mainRank: "7",
      bombSize: 4,
      label: "炸弹 方片7 梅花7 红桃7 黑桃7",
    },
  },
  currentAdvice: {
    choices: [{
      play: { type: "Bomb", mainRank: "9", bombSize: 4, label: "炸弹 黑桃9 红桃9 梅花9 方片9" },
      reasons: ["只有炸弹能压，应抢牌权"],
    }],
  },
});
assert(whyUse9Not2Answer?.mode === "why-not-bomb", "为什么用9不用2应走 why-not-bomb");
assert(whyUse9Not2Answer.text.includes("9") && whyUse9Not2Answer.text.includes("2"), "应对比9炸与2炸");

const wildOpenHand = cards([
  ["3", SUITS.clubs], ["3", SUITS.diamonds],
  ["2", SUITS.hearts],
  ["4", SUITS.clubs], ["4", SUITS.hearts],
  ["5", SUITS.clubs], ["5", SUITS.hearts],
  ["7", SUITS.spades], ["7", SUITS.clubs], ["7", SUITS.diamonds], ["7", SUITS.hearts, 1],
  ["K", SUITS.spades], ["K", SUITS.clubs],
  ["A", SUITS.spades],
]);
const wildOpenState = createGameStateFromHands({
  levelRank: "2",
  hands: [wildOpenHand, cards([["6"]]), cards([["8"]]), cards([["9"]])],
  currentPlayerIndex: 0,
});
const wildOpenRec = recommendPlay(
  wildOpenHand,
  "2",
  null,
  {
    state: wildOpenState,
    playerIndex: 0,
    preferredGroups: buildStrategicGroups(wildOpenHand, "2"),
    mlFusionMode: "off",
    mlModel: false,
  },
);
assert(
  !usesWildInLowValue(wildOpenRec.candidate, "2"),
  `开局逢人配不应首推三带二/对子，实际 ${wildOpenRec.candidate.label ?? wildOpenRec.candidate.type}`,
);

const sfReserveHand = cards([
  ["8", SUITS.hearts], ["9", SUITS.hearts], ["10", SUITS.hearts], ["J", SUITS.hearts], ["Q", SUITS.hearts],
  ["10", SUITS.spades], ["10", SUITS.diamonds],
  ["6", SUITS.clubs], ["6", SUITS.hearts],
  ["K", SUITS.clubs],
]);
const oppConsecutive = classifyPlay(cards([
  ["8", SUITS.spades], ["8", SUITS.clubs],
  ["9", SUITS.diamonds], ["9", SUITS.clubs, 1],
  ["10", SUITS.clubs], ["10", SUITS.diamonds, 1],
]), "A");
const oppPadding = cards([
  ["3"], ["4"], ["5"], ["7"], ["8"], ["9"], ["J"], ["Q"], ["K"], ["2"],
]);
const sfReserveState = createGameStateFromHands({
  levelRank: "A",
  hands: [sfReserveHand, oppPadding, cards([["4"], ["5"], ["6"]]), cards([["7"], ["8"], ["9"]])],
  currentPlayerIndex: 0,
});
const sfReservePatched = {
  ...sfReserveState,
  lastActivePlay: oppConsecutive,
  lastActivePlayerIndex: 1,
  playHistory: [
    { turnNumber: 0, playerIndex: 2, play: classifyPlay(cards([
      ["6", SUITS.spades], ["6", SUITS.diamonds],
      ["7", SUITS.hearts], ["7", SUITS.spades],
      ["8", SUITS.diamonds], ["8", SUITS.clubs, 1],
    ]), "A") },
    { turnNumber: 1, playerIndex: 1, play: oppConsecutive },
  ],
};
const sfReserveRec = recommendPlay(
  sfReserveHand,
  "A",
  oppConsecutive,
  {
    state: sfReservePatched,
    playerIndex: 0,
    lastActivePlayerIndex: 1,
    previousPlay: oppConsecutive,
    preferredGroups: buildStrategicGroups(sfReserveHand, "A"),
    mlFusionMode: "off",
    mlModel: false,
  },
);
assert(
  sfReserveRec.candidate.type === PLAY_TYPES.pass,
  `对手连对时同花顺应保留、首推过牌，实际 ${sfReserveRec.candidate.label ?? sfReserveRec.candidate.type}`,
);

const windPairHand = cards([
  ["8", SUITS.clubs], ["8", SUITS.diamonds],
  ["J", SUITS.spades], ["J", SUITS.diamonds],
  ["6", SUITS.hearts], ["6", SUITS.clubs],
  ["BJ", "JOKER", 0],
  ["2", SUITS.spades],
]);
let windPairState = createGameStateFromHands({
  levelRank: "A",
  hands: [windPairHand, cards([["3"]]), cards([["4"]]), cards([["5"]])],
  currentPlayerIndex: 0,
});
windPairState = {
  ...windPairState,
  lastActivePlay: null,
  lastActivePlayerIndex: null,
  playHistory: [
    { turnNumber: 1, playerIndex: 0, play: classifyPlay(cards([["6", SUITS.hearts], ["6", SUITS.clubs]]), "A") },
    { turnNumber: 2, playerIndex: 1, play: classifyPlay([], "A") },
    { turnNumber: 3, playerIndex: 2, play: classifyPlay([], "A") },
    { turnNumber: 4, playerIndex: 3, play: classifyPlay([], "A") },
  ],
};
const windPairRec = recommendPlay(
  windPairHand,
  "A",
  null,
  {
    state: windPairState,
    playerIndex: 0,
    preferredGroups: buildStrategicGroups(windPairHand, "A"),
    mlFusionMode: "off",
    mlModel: false,
  },
);
assert(
  windPairRec.candidate.type === PLAY_TYPES.pair,
  `接风应优先对子减手，实际 ${windPairRec.candidate.label ?? windPairRec.candidate.type}`,
);

const resistFinished = [1, 3, 2, 0];
const resistHands = [
  [...cards([["3"], ["4"], ["BJ", "JOKER", 0]]), createCard("BJ", SUITS.joker, 1)],
  cards([["5"], ["6"], ["7"]]),
  cards([["8"], ["9"], ["10"]]),
  cards([["J"], ["Q"], ["K"]]),
];
while (resistHands[0].length < 27) resistHands[0].push(createCard("2", SUITS.clubs, 0));
while (resistHands[1].length < 27) resistHands[1].push(createCard("2", SUITS.diamonds, 0));
while (resistHands[2].length < 27) resistHands[2].push(createCard("2", SUITS.hearts, 0));
while (resistHands[3].length < 27) resistHands[3].push(createCard("2", SUITS.spades, 0));
const resistGame = createGameStateFromHands({
  levelRank: "5",
  hands: resistHands,
  currentPlayerIndex: 0,
});
const resistResult = applyTribute(resistGame, resistFinished);
assert(resistResult.events[0]?.type === "resist-tribute", "双大王应触发抗贡");
assert(
  resistResult.state.currentPlayerIndex === resistFinished[0],
  `抗贡后应由头游先出牌（座位${resistFinished[0]}），实际座位${resistResult.state.currentPlayerIndex}`,
);

const bomb10 = classifyPlay(cards([
  ["10", SUITS.spades], ["10", SUITS.spades, 1], ["10", SUITS.hearts], ["10", SUITS.hearts, 1], ["10", SUITS.clubs],
]), "3");

let passTrickState = createGameStateFromHands({
  levelRank: "3",
  hands: [
    cards([["A"], ["K"], ["Q"]]),
    cards([["J"], ["9"], ["8"]]),
    cards([["7"], ["6"], ["5"]]),
    cards([["4"], ["3"], ["2"]]),
  ],
  currentPlayerIndex: 1,
});
passTrickState = {
  ...passTrickState,
  lastActivePlay: bomb10,
  lastActivePlayerIndex: 2,
  passCount: 0,
  turnNumber: 6,
  playHistory: [
    { turnNumber: 5, playerIndex: 2, play: bomb10 },
  ],
};
passTrickState = passTurn(passTrickState);
assert(passTrickState.currentPlayerIndex === 0, "老史炸弹后勇哥不要，应轮到玩家");
passTrickState = passTurn(passTrickState);
assert(passTrickState.currentPlayerIndex === 3, "玩家不要后应轮到毛蛋");
passTrickState = passTurn(passTrickState);
assert(
  passTrickState.currentPlayerIndex === 2 && passTrickState.lastActivePlay === null,
  "毛蛋不要后应清台并由老史接风",
);

const beforeHumanPass = {
  ...createGameStateFromHands({
    levelRank: "3",
    hands: [
      cards([["A"], ["K"]]),
      cards([["J"], ["9"]]),
      cards([["7"], ["6"]]),
      cards([["4"], ["3"]]),
    ],
    currentPlayerIndex: 0,
  }),
  lastActivePlay: bomb10,
  lastActivePlayerIndex: 2,
  passCount: 2,
  turnNumber: 8,
  playHistory: [
    { turnNumber: 5, playerIndex: 2, play: bomb10 },
    { turnNumber: 6, playerIndex: 1, play: classifyPlay([], "3") },
    { turnNumber: 7, playerIndex: 3, play: classifyPlay([], "3") },
  ],
};

const robotQueueRaceStuck = {
  ...beforeHumanPass,
  currentPlayerIndex: 3,
};
assert(detectTurnStuck(robotQueueRaceStuck), "毛蛋已不要但 current 仍指向毛蛋，应判定为卡住");
const raceRepaired = repairTurnStuck(robotQueueRaceStuck);
assert(raceRepaired.repaired, "机器人队列竞态卡住应能修复");
assert(raceRepaired.state.currentPlayerIndex === 0, "修复后应轮到玩家补不要");

const humanPassNotAdvanced = {
  ...beforeHumanPass,
  currentPlayerIndex: 3,
  passCount: 2,
  turnNumber: 9,
  playHistory: [
    ...beforeHumanPass.playHistory,
    { turnNumber: 8, playerIndex: 0, play: classifyPlay([], "3") },
  ],
};
assert(detectTurnStuck(humanPassNotAdvanced), "玩家已不要但台面未清，应判定为卡住");
const passRepaired = repairTurnStuck(humanPassNotAdvanced);
assert(passRepaired.repaired, "玩家不要后未推进应能修复");
assert(
  passRepaired.state.currentPlayerIndex === 2 && passRepaired.state.lastActivePlay === null,
  "修复后应清台并由老史接风",
);

// 玩家 pass 后 mock 推进 3 个机器人（lite），模拟异步队列逐步推进且不卡住
const passQueuePad = shuffle(createDoubleDeck()).slice(0, 81);
const passQueueCore = cards([["A"], ["K"], ["Q"], ["J"], ["10"]]);
const passQueueHand = [...passQueueCore, ...passQueuePad.slice(0, 27 - passQueueCore.length)];
const passQueueOpp = (offset) => passQueuePad.slice(offset).concat(passQueuePad.slice(0, offset)).slice(0, 27);
let passQueueState = createGameStateFromHands({
  levelRank: "3",
  hands: [
    passQueueHand,
    passQueueOpp(0),
    passQueueOpp(5),
    passQueueOpp(10),
  ],
  currentPlayerIndex: 3,
});
assert(
  passQueueState.currentPlayerIndex === 3 && passQueueState.lastActivePlay === null,
  "接风后毛蛋先出，便于连续 mock 推进 3 个机器人（毛蛋→老史→勇哥）",
);
for (let passRobotStep = 0; passRobotStep < 3; passRobotStep += 1) {
  assert(
    passQueueState.currentPlayerIndex !== 0,
    `pass 队列第 ${passRobotStep + 1} 步前不应回到人类（当前 ${passQueueState.currentPlayerIndex}）`,
  );
  if (detectTurnStuck(passQueueState)) {
    const stuckFix = repairTurnStuck(passQueueState);
    assert(stuckFix.repaired, `pass 队列第 ${passRobotStep + 1} 步卡住应能修复`);
    passQueueState = stuckFix.state;
  }
  const beforeIndex = passQueueState.currentPlayerIndex;
  const robotTurn = playRecommendedTurn(passQueueState, { mlFusionMode: "off", mlModel: false, lite: true });
  assert(
    robotTurn.state !== passQueueState,
    `pass 后机器人第 ${passRobotStep + 1} 步（座位 ${beforeIndex}）应改变局面`,
  );
  passQueueState = robotTurn.state;
  assert(!detectTurnStuck(passQueueState), `pass 队列第 ${passRobotStep + 1} 步后不应 detectTurnStuck`);
}

// 机器人：对手小单5 不过度炸（lite 路径 + 多炸手牌）
const robotSmall5Lead = classifyPlay(cards([["5", SUITS.diamonds]]), "3");
const robotOppHand = cards([
  ["6", SUITS.clubs],
  ["7", SUITS.hearts],
  ["5", SUITS.spades], ["5", SUITS.hearts], ["5", SUITS.clubs], ["3", SUITS.hearts],
  ["9", SUITS.spades], ["9", SUITS.hearts], ["9", SUITS.clubs], ["9", SUITS.diamonds], ["9", SUITS.diamonds, 1],
  ["K", SUITS.spades], ["Q", SUITS.spades], ["J", SUITS.spades], ["10", SUITS.spades],
  ["8", SUITS.spades], ["8", SUITS.clubs], ["4", SUITS.spades], ["4", SUITS.clubs],
  ["A", SUITS.spades], ["A", SUITS.clubs], ["2", SUITS.spades], ["2", SUITS.clubs],
  ["6", SUITS.diamonds], ["7", SUITS.diamonds], ["3", SUITS.clubs],
]);
const robotSmall5Filler = cards([
  ["2", SUITS.diamonds], ["2", SUITS.hearts], ["K", SUITS.clubs], ["K", SUITS.hearts],
  ["Q", SUITS.clubs], ["Q", SUITS.hearts], ["J", SUITS.clubs], ["J", SUITS.hearts],
  ["10", SUITS.clubs], ["10", SUITS.hearts], ["8", SUITS.diamonds], ["8", SUITS.hearts],
  ["4", SUITS.diamonds], ["4", SUITS.hearts], ["A", SUITS.diamonds], ["A", SUITS.hearts],
  ["6", SUITS.spades], ["7", SUITS.spades], ["3", SUITS.diamonds], ["3", SUITS.spades],
  ["4", SUITS.clubs], ["5", SUITS.diamonds], ["6", SUITS.hearts], ["7", SUITS.clubs],
  ["8", SUITS.clubs], ["9", SUITS.clubs], ["10", SUITS.diamonds],
]);
let robotSmall5State = createGameStateFromHands({
  levelRank: "3",
  hands: [
    robotSmall5Filler,
    robotOppHand,
    robotSmall5Filler,
    robotSmall5Filler,
  ],
  currentPlayerIndex: 1,
});
robotSmall5State = {
  ...robotSmall5State,
  lastActivePlay: robotSmall5Lead,
  lastActivePlayerIndex: 0,
  playHistory: [{ turnNumber: 1, playerIndex: 0, play: robotSmall5Lead }],
};
const robotSmall5Turn = playRecommendedTurn(robotSmall5State, {
  mlFusionMode: "off",
  mlModel: false,
  lite: true,
});
assert(
  robotSmall5Turn.recommendation.candidate.type !== PLAY_TYPES.bomb,
  `对手小单5机器人不应炸，实际 ${robotSmall5Turn.recommendation.candidate.label ?? robotSmall5Turn.recommendation.candidate.type}`,
);
assert(
  robotSmall5Turn.recommendation.candidate.type === PLAY_TYPES.single
    || robotSmall5Turn.recommendation.candidate.type === PLAY_TYPES.pass,
  `对手小单5机器人应最小单张或过牌，实际 ${robotSmall5Turn.recommendation.candidate.label ?? robotSmall5Turn.recommendation.candidate.type}`,
);

// 机器人：22张时对手999+22三带二，不应五炸55553（lite 路径）
const robotOppTriple9 = classifyPlay(cards([
  ["9", SUITS.diamonds], ["9", SUITS.hearts], ["9", SUITS.clubs],
  ["2", SUITS.diamonds], ["2", SUITS.hearts],
]), "3");
const robotLaoshiBombHand = cards([
  ["5", SUITS.spades], ["5", SUITS.hearts], ["5", SUITS.clubs], ["5", SUITS.diamonds], ["3", SUITS.hearts],
  ["6", SUITS.clubs], ["7", SUITS.hearts], ["8", SUITS.spades],
  ["4", SUITS.spades], ["4", SUITS.clubs], ["6", SUITS.diamonds], ["7", SUITS.diamonds],
  ["8", SUITS.clubs], ["10", SUITS.clubs], ["J", SUITS.clubs], ["K", SUITS.clubs],
  ["A", SUITS.clubs], ["2", SUITS.diamonds], ["2", SUITS.hearts], ["3", SUITS.clubs], ["3", SUITS.diamonds], ["10", SUITS.spades],
]);
const robotTriple9Filler = cards([
  ["Q", SUITS.spades], ["K", SUITS.spades], ["A", SUITS.spades], ["J", SUITS.spades],
]);
let robotTriple9State = createGameStateFromHands({
  levelRank: "3",
  hands: [
    robotTriple9Filler,
    robotTriple9Filler,
    robotLaoshiBombHand,
    robotTriple9Filler,
  ],
  currentPlayerIndex: 2,
});
robotTriple9State = {
  ...robotTriple9State,
  lastActivePlay: robotOppTriple9,
  lastActivePlayerIndex: 1,
  playHistory: [
    { turnNumber: 0, playerIndex: 0, play: classifyPlay(cards([
      ["5", SUITS.diamonds, 1], ["5", SUITS.hearts, 1], ["5", SUITS.clubs, 1],
      ["7", SUITS.spades], ["7", SUITS.clubs],
    ]), "3") },
    { turnNumber: 1, playerIndex: 1, play: robotOppTriple9 },
  ],
};
const robotTriple9Turn = playRecommendedTurn(robotTriple9State, {
  mlFusionMode: "off",
  mlModel: false,
  lite: true,
});
assert(
  !(robotTriple9Turn.recommendation.candidate.type === PLAY_TYPES.bomb
    && robotTriple9Turn.recommendation.candidate.mainRank === "5"
    && (robotTriple9Turn.recommendation.candidate.bombSize ?? 0) >= 5),
  `22张时对手999+22三带二机器人不应五炸55553，实际 ${robotTriple9Turn.recommendation.candidate.label ?? robotTriple9Turn.recommendation.candidate.type}`,
);
assert(
  robotTriple9Turn.recommendation.candidate.type === PLAY_TYPES.pass
    || robotTriple9Turn.recommendation.candidate.type === PLAY_TYPES.tripleWithPair,
  `应过牌或普通三带二压牌，实际 ${robotTriple9Turn.recommendation.candidate.label ?? robotTriple9Turn.recommendation.candidate.type}`,
);

// 仅炸弹可压时：22张对手三带二评分上过牌应优于五炸
const robotBombOnlyHand = cards([
  ["5", SUITS.spades], ["5", SUITS.hearts], ["5", SUITS.clubs], ["5", SUITS.diamonds], ["3", SUITS.hearts],
  ["6", SUITS.clubs], ["7", SUITS.hearts], ["8", SUITS.spades],
  ["4", SUITS.spades], ["4", SUITS.clubs], ["6", SUITS.diamonds], ["7", SUITS.diamonds],
  ["8", SUITS.clubs], ["10", SUITS.clubs], ["J", SUITS.clubs], ["K", SUITS.clubs],
  ["A", SUITS.clubs], ["2", SUITS.diamonds], ["2", SUITS.hearts], ["3", SUITS.clubs], ["3", SUITS.diamonds], ["10", SUITS.spades],
]);
const robotFiveBombPlay = classifyPlay(cards([
  ["5", SUITS.spades], ["5", SUITS.hearts], ["5", SUITS.clubs], ["5", SUITS.diamonds], ["3", SUITS.hearts],
]), "3");
const robotBombOnlyCtx = {
  state: {
    levelRank: "3",
    players: [
      { hand: robotTriple9Filler, seatIndex: 0, finishedOrder: null },
      { hand: robotTriple9Filler, seatIndex: 1, finishedOrder: null },
      { hand: robotBombOnlyHand, seatIndex: 2, finishedOrder: null },
      { hand: robotTriple9Filler, seatIndex: 3, finishedOrder: null },
    ],
  },
  playerIndex: 2,
  lastActivePlayerIndex: 1,
  previousPlay: robotOppTriple9,
  opponentActive: true,
  hasRegularWinner: false,
  hasActionableRegularWinner: false,
  hasAnyWinner: true,
  danger: 0,
  isOpening: false,
  partnerOwnsTrick: false,
  partnerAttemptedCurrentRound: false,
  _candidates: [classifyPlay([], "3"), robotFiveBombPlay],
};
const robotPassScore = scoreCandidate(
  classifyPlay([], "3"),
  robotBombOnlyHand,
  "3",
  robotOppTriple9,
  robotBombOnlyCtx,
);
const robotBombScore = scoreCandidate(
  robotFiveBombPlay,
  robotBombOnlyHand,
  "3",
  robotOppTriple9,
  robotBombOnlyCtx,
);
assert(
  robotPassScore.score < robotBombScore.score,
  `仅炸弹可压且22张时过牌应优于五炸（pass=${robotPassScore.score} bomb=${robotBombScore.score}）`,
);

// 4444+逢人配压小王：应四炸不含逢人配（级牌3，中局15-20张）
const wildBombMidHand = cards([
  ["4", SUITS.spades], ["4", SUITS.hearts], ["4", SUITS.clubs], ["4", SUITS.diamonds],
  ["3", SUITS.hearts],
  ["6", SUITS.clubs], ["7", SUITS.hearts], ["8", SUITS.spades],
  ["9", SUITS.clubs], ["10", SUITS.diamonds],
  ["J", SUITS.spades], ["Q", SUITS.clubs], ["K", SUITS.hearts],
  ["A", SUITS.diamonds], ["2", SUITS.clubs], ["5", SUITS.spades],
  ["6", SUITS.diamonds], ["7", SUITS.clubs],
]);
const oppSmallJokerBomb = classifyPlay(cards([["SJ", SUITS.joker]]), "3");
const wildBombFiller = cards([
  ["8", SUITS.clubs], ["9", SUITS.hearts], ["10", SUITS.spades],
  ["J", SUITS.diamonds], ["Q", SUITS.hearts], ["K", SUITS.diamonds],
  ["A", SUITS.spades], ["2", SUITS.hearts], ["5", SUITS.clubs],
]);
let wildBombMidState = createGameStateFromHands({
  levelRank: "3",
  hands: [wildBombFiller, wildBombFiller, wildBombMidHand, wildBombFiller],
  currentPlayerIndex: 2,
});
wildBombMidState = {
  ...wildBombMidState,
  lastActivePlay: oppSmallJokerBomb,
  lastActivePlayerIndex: 3,
  playHistory: [{ turnNumber: 0, playerIndex: 3, play: oppSmallJokerBomb }],
};
const wildBombMidRec = recommendPlay(wildBombMidHand, "3", oppSmallJokerBomb, {
  state: wildBombMidState,
  playerIndex: 2,
  mlFusionMode: "off",
  mlModel: false,
});
assert(
  wildBombMidRec.candidate.type === PLAY_TYPES.bomb
    && wildBombMidRec.candidate.mainRank === "4"
    && (wildBombMidRec.candidate.bombSize ?? 0) === 4,
  `4444+逢人配压小王应出四炸4，实际 ${wildBombMidRec.candidate.label ?? wildBombMidRec.candidate.type}`,
);
assert(
  !wildBombMidRec.candidate.cards.some((card) => card.rank === "3" && card.suit === SUITS.hearts),
  `四炸不应含逢人配红桃3，实际 ${wildBombMidRec.candidate.label ?? ""}`,
);
const robotWildBombTurn = playRecommendedTurn(wildBombMidState, {
  mlFusionMode: "off",
  mlModel: false,
  lite: true,
});
assert(
  robotWildBombTurn.recommendation.candidate.type === PLAY_TYPES.bomb
    && robotWildBombTurn.recommendation.candidate.mainRank === "4"
    && (robotWildBombTurn.recommendation.candidate.bombSize ?? 0) === 4
    && !robotWildBombTurn.recommendation.candidate.cards.some(
      (card) => card.rank === "3" && card.suit === SUITS.hearts,
    ),
  `机器人4444+逢人配压小王应四炸不含3，实际 ${robotWildBombTurn.recommendation.candidate.label ?? robotWildBombTurn.recommendation.candidate.type}`,
);

// 队友已炸占牌：另一队友不应叠更大炸
const robotPartnerBomb = classifyPlay(
  cards([["5", SUITS.spades], ["5", SUITS.hearts], ["5", SUITS.clubs], ["5", SUITS.diamonds]]),
  "3",
);
const robotMateHand = cards([
  ["9", SUITS.spades], ["9", SUITS.hearts], ["9", SUITS.clubs], ["9", SUITS.diamonds], ["9", SUITS.diamonds, 1],
  ["6", SUITS.clubs], ["7", SUITS.hearts], ["8", SUITS.spades], ["10", SUITS.spades],
  ["K", SUITS.spades], ["Q", SUITS.spades], ["J", SUITS.spades], ["A", SUITS.spades],
  ["4", SUITS.spades], ["4", SUITS.clubs], ["2", SUITS.spades], ["2", SUITS.clubs],
  ["6", SUITS.diamonds], ["7", SUITS.diamonds], ["8", SUITS.clubs], ["3", SUITS.clubs],
  ["K", SUITS.clubs], ["Q", SUITS.clubs], ["J", SUITS.clubs], ["10", SUITS.clubs],
  ["A", SUITS.clubs], ["3", SUITS.diamonds],
]);
const robotUserAfterMateBomb = cards([
  ["5", SUITS.hearts], ["6", SUITS.spades], ["7", SUITS.spades],
  ["9", SUITS.clubs], ["9", SUITS.diamonds], ["9", SUITS.diamonds, 1],
  ["K", SUITS.hearts], ["Q", SUITS.hearts], ["J", SUITS.hearts], ["10", SUITS.hearts],
  ["8", SUITS.diamonds], ["8", SUITS.clubs], ["4", SUITS.diamonds], ["4", SUITS.hearts],
  ["A", SUITS.diamonds], ["A", SUITS.hearts], ["2", SUITS.diamonds], ["2", SUITS.hearts],
  ["6", SUITS.clubs], ["7", SUITS.clubs], ["3", SUITS.spades], ["3", SUITS.diamonds],
  ["K", SUITS.diamonds], ["Q", SUITS.diamonds], ["J", SUITS.diamonds], ["10", SUITS.diamonds],
  ["4", SUITS.clubs],
]);
let robotPartnerBombState = createGameStateFromHands({
  levelRank: "3",
  hands: [
    robotUserAfterMateBomb,
    robotSmall5Filler,
    robotMateHand,
    robotSmall5Filler,
  ],
  currentPlayerIndex: 0,
});
robotPartnerBombState = {
  ...robotPartnerBombState,
  lastActivePlay: robotPartnerBomb,
  lastActivePlayerIndex: 2,
  playHistory: [
    { turnNumber: 1, playerIndex: 0, play: robotSmall5Lead },
    { turnNumber: 2, playerIndex: 1, play: classifyPlay([], "3") },
    { turnNumber: 3, playerIndex: 2, play: robotPartnerBomb },
    { turnNumber: 4, playerIndex: 3, play: classifyPlay([], "3") },
  ],
};
const robotPartnerBombTurn = playRecommendedTurn(robotPartnerBombState, {
  mlFusionMode: "off",
  mlModel: false,
  lite: true,
});
assert(
  robotPartnerBombTurn.recommendation.candidate.type === PLAY_TYPES.pass,
  `队友已炸占牌应过牌，实际 ${robotPartnerBombTurn.recommendation.candidate.label ?? robotPartnerBombTurn.recommendation.candidate.type}`,
);

// 队友本墩已出小单，对手小炸后不应叠更大炸
const robotOppSmallBomb = classifyPlay(
  cards([["5", SUITS.spades], ["5", SUITS.hearts], ["5", SUITS.clubs], ["3", SUITS.hearts]]),
  "3",
);
let robotNoStackBombState = createGameStateFromHands({
  levelRank: "3",
  hands: [
    robotSmall5Filler,
    robotSmall5Filler,
    robotMateHand,
    robotSmall5Filler,
  ],
  currentPlayerIndex: 2,
});
robotNoStackBombState = {
  ...robotNoStackBombState,
  lastActivePlay: robotOppSmallBomb,
  lastActivePlayerIndex: 1,
  playHistory: [
    { turnNumber: 1, playerIndex: 0, play: robotSmall5Lead },
    { turnNumber: 2, playerIndex: 1, play: robotOppSmallBomb },
  ],
};
const robotNoStackBombTurn = playRecommendedTurn(robotNoStackBombState, {
  mlFusionMode: "off",
  mlModel: false,
  lite: true,
});
assert(
  robotNoStackBombTurn.recommendation.candidate.type === PLAY_TYPES.pass,
  `队友已出小单后对手小炸，不应叠9炸，实际 ${robotNoStackBombTurn.recommendation.candidate.label ?? robotNoStackBombTurn.recommendation.candidate.type}`,
);

function usesWildInLowValue(play, levelRank) {
  if (!play?.cards?.length) return false;
  const low = new Set(["TripleWithPair", "Pair", "Triple"]);
  if (!low.has(play.type)) return false;
  return play.cards.some((c) => c.rank === levelRank && c.suit === SUITS.hearts);
}

const oneCardPressHand = cards([["9", SUITS.hearts, 1], ["3", SUITS.diamonds]]);
const oppSixSingle = classifyPlay(cards([["6", SUITS.diamonds]]), "3");
const oneCardPressState = createGameStateFromHands({
  levelRank: "3",
  hands: [
    oneCardPressHand,
    cards([["Q"]]),
    cards([["4"], ["5"]]),
    cards([["7"], ["8"]]),
  ],
  currentPlayerIndex: 0,
});
const oneCardPressPatched = {
  ...oneCardPressState,
  lastActivePlay: oppSixSingle,
  lastActivePlayerIndex: 1,
  players: oneCardPressState.players.map((player, index) => {
    if (index === 1) return { ...player, hand: cards([["Q"]]) };
    if (index === 2) return { ...player, hand: cards([["4"], ["5"]]), finishedOrder: 1 };
    return player;
  }),
};
const oneCardPressRec = recommendPlay(
  oneCardPressHand,
  "3",
  oppSixSingle,
  {
    state: oneCardPressPatched,
    playerIndex: 0,
    lastActivePlayerIndex: 1,
    previousPlay: oppSixSingle,
    preferredGroups: buildStrategicGroups(oneCardPressHand, "3"),
    mlFusionMode: "off",
    mlModel: false,
  },
);
assert(
  oneCardPressRec.candidate.type === PLAY_TYPES.single && oneCardPressRec.candidate.mainRank === "3",
  `对手报单时应用级牌压 6，实际 ${oneCardPressRec.candidate.label ?? oneCardPressRec.candidate.mainRank}`,
);
assert(
  (oneCardPressRec.reasons ?? []).some((r) => r.includes("对手报单") && r.includes("级牌")),
  "报单压牌理由应说明级牌更保险",
);

const oneCardQa = tryLocalCoachAnswer("对手报单为什么用级牌压而不是9", {
  status: "ok",
  levelRank: "3",
  turnNumber: 88,
  humanHand: oneCardPressHand,
  table: { lastActivePlay: oppSixSingle },
  currentAdvice: { choices: [{ play: oneCardPressRec.candidate, reasons: oneCardPressRec.reasons }] },
});
assert(oneCardQa?.mode === "one-card-press", "问教练应识别报单压牌问题");

// 勇哥连对 991010JJ：普通连对被锁时推炸弹，理由不得出现反炸弹惩罚文案
const yongConsecutiveHand = cards([
  ["10", SUITS.spades], ["J", SUITS.spades], ["K", SUITS.spades], ["A", SUITS.spades, 1],
  ["3", SUITS.hearts, 1], ["8", SUITS.spades, 1], ["8", SUITS.hearts, 1], ["8", SUITS.diamonds], ["8", SUITS.diamonds, 1],
  ["3", SUITS.clubs], ["4", SUITS.spades, 1], ["5", SUITS.hearts], ["6", SUITS.diamonds], ["7", SUITS.diamonds, 1],
  ["9", SUITS.hearts, 1], ["9", SUITS.diamonds], ["Q", SUITS.hearts], ["Q", SUITS.diamonds],
  ["A", SUITS.hearts], ["A", SUITS.hearts, 1], ["6", SUITS.diamonds, 1], ["10", SUITS.spades, 1],
]);
const yongConsecutivePlay = classifyPlay(cards([
  ["9", SUITS.clubs], ["9", SUITS.diamonds, 1], ["10", SUITS.clubs], ["10", SUITS.clubs, 1],
  ["J", SUITS.diamonds, 1], ["J", SUITS.hearts, 1],
]), "3");
const yongConsecutiveRec = recommendPlay(
  yongConsecutiveHand,
  "3",
  yongConsecutivePlay,
  {
    state: {
      levelRank: "3",
      players: [
        { hand: yongConsecutiveHand, seatIndex: 0, finishedOrder: null },
        { hand: cards([["2"], ["3"], ["4"]]), seatIndex: 1, finishedOrder: null },
        { hand: cards([["5"], ["6"], ["7"]]), seatIndex: 2, finishedOrder: null },
        { hand: cards([["8"], ["9"], ["10"]]), seatIndex: 3, finishedOrder: null },
      ],
    },
    playerIndex: 0,
    lastActivePlayerIndex: 1,
    previousPlay: yongConsecutivePlay,
    preferredGroups: buildStrategicGroups(yongConsecutiveHand, "3"),
    mlFusionMode: "off",
    mlModel: false,
  },
);
assert(
  yongConsecutiveRec.candidate.type === PLAY_TYPES.bomb && yongConsecutiveRec.candidate.mainRank === "8",
  `无更大连对可压时应推四张8炸弹，实际 ${yongConsecutiveRec.candidate.label ?? yongConsecutiveRec.candidate.type}`,
);
const yongBombReasons = filterReasonsForUser(yongConsecutiveRec.reasons, "", {
  play: yongConsecutiveRec.candidate,
  previousPlay: yongConsecutivePlay,
});
assert(
  !yongBombReasons.some((r) => /不必动用炸弹|非必要不消耗/.test(r)),
  `推荐炸弹时理由不得含反炸弹惩罚，实际 ${yongBombReasons.join("；")}`,
);
assert(
  yongBombReasons.some((r) => /无更大连对|抢牌权|只有炸弹能压/.test(r)),
  `推荐炸弹时应解释为何必须用炸，实际 ${yongBombReasons.join("；")}`,
);

// game-2 seed 618655040 turn56：接风全散单理由不误写「有成组牌」
const game2Turn56Hand = cards([
  ["2", SUITS.spades, 0],
  ["5", SUITS.clubs, 1],
  ["7", SUITS.clubs, 1],
  ["K", SUITS.diamonds, 1],
  ["BJ", SUITS.joker, 0],
]);
const game2Turn56BombQ = classifyPlay(cards([
  ["Q", SUITS.spades, 1], ["Q", SUITS.hearts, 0], ["Q", SUITS.clubs, 1], ["Q", SUITS.diamonds, 1],
]), "3");
let game2Turn56State = createGameStateFromHands({
  levelRank: "3",
  hands: [game2Turn56Hand, cards([["3"]]), cards([["4"]]), cards([["5"]])],
  currentPlayerIndex: 0,
});
game2Turn56State = {
  ...game2Turn56State,
  lastActivePlay: null,
  lastActivePlayerIndex: null,
  playHistory: [
    { turnNumber: 56, playerIndex: 0, play: game2Turn56BombQ },
    { turnNumber: 57, playerIndex: 1, play: classifyPlay([], "3") },
    { turnNumber: 58, playerIndex: 2, play: classifyPlay([], "3") },
    { turnNumber: 59, playerIndex: 3, play: classifyPlay([], "3") },
  ],
};
const game2Turn56Rec = recommendPlay(game2Turn56Hand, "3", null, {
  state: game2Turn56State,
  playerIndex: 0,
  mlFusionMode: "on",
  mlModel: false,
});
const game2Turn56UserReasons = filterReasonsForUser(game2Turn56Rec.reasons, "", {
  play: game2Turn56Rec.candidate,
  levelRank: "3",
});
assert(
  !game2Turn56UserReasons.some((r) => /有成组牌/.test(r)),
  `turn56 用户可见理由不得含「有成组牌」，实际 ${game2Turn56UserReasons.join("；")}`,
);
assert(
  game2Turn56UserReasons.some((r) => /全散单|先送小牌/.test(r)),
  `turn56 应说明全散单先送小牌，实际 ${game2Turn56UserReasons.join("；")}`,
);

const passDrillTag = classifyDivergenceDrillTag({
  recommendedReasons: ["对手占牌且你有普通压牌，不能轻易放行"],
  verdictNote: "有普通牌可压时不应过牌",
  actual: "过牌",
  recommended: "单张 5",
  mustBeat: "单张 4",
});
assert(passDrillTag === DRILL_TAGS.PASS_RELEASE, `过牌弱项应归类为过牌放行，实际 ${passDrillTag}`);

const bombDrillTag = classifyDivergenceDrillTag({
  recommendedReasons: ["拆炸凑三带二会削弱终局"],
  actual: "三带二 A",
  recommended: "过牌",
});
assert(bombDrillTag === DRILL_TAGS.BOMB_SPLIT_TRIPLE, `拆炸弱项应归类，实际 ${bombDrillTag}`);

const defaultWeaknesses = analyzeWeaknesses({ currentTimeline: [] });
assert(defaultWeaknesses.length === 3, "无历史时应返回 3 项默认专项");
assert(defaultWeaknesses[0].tag === DRILL_TAGS.BOMB_TIMING, "默认第一项应为炸弹时机");
assert(DEFAULT_DRILL_PRESETS.some((item) => item.tag === "三带二减手"), "默认预设应含三带二减手");

assert(
  adviceMatchesDrillTag(["对手报单，级牌压更保险"], { type: "Single", label: "单张 3" }, DRILL_TAGS.ONE_CARD_PRESS),
  "报单压牌理由应命中专项标签",
);
const drillTip = buildDrillAdviceTip(
  { reasons: ["对手报单，级牌压更保险"], candidate: { type: "Single", label: "单张 3" } },
  DRILL_TAGS.ONE_CARD_PRESS,
);
assert(drillTip.startsWith("【专项】"), `专项提示应以【专项】开头，实际 ${drillTip}`);

const drillTimeline = [{
  playerIndex: 0,
  choices: [{ play: { type: "Single" }, reasons: ["对手报单，级牌压更保险"] }],
}, {
  playerIndex: 0,
  choices: [{ play: { type: "Pass" }, reasons: ["保留炸弹"] }],
}];
assert(
  countDrillFocusHits(drillTimeline, DRILL_TAGS.ONE_CARD_PRESS, 0) === 1,
  "专项命中次数应只计匹配推荐",
);

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

assert(DRILL_SCENARIOS.length >= 5, "每个弱项应至少有一个预设局面");
for (const tag of Object.values(DRILL_TAGS)) {
  assert(getDrillScenarioForTag(tag), `弱项 ${tag} 应有预设局面`);
}

const riggedBombA = createDrillRiggedState(DRILL_TAGS.BOMB_TIMING);
const riggedBombB = createDrillRiggedState(DRILL_TAGS.BOMB_TIMING);
const riggedHandSig = riggedBombA.state.players[0].hand.map((card) => cardId(card)).sort().join("|");
const riggedHandSigB = riggedBombB.state.players[0].hand.map((card) => cardId(card)).sort().join("|");
assert(riggedHandSig === riggedHandSigB, "同一专项预设局面应可复现相同手牌");
assert(riggedBombA.state.currentPlayerIndex === 0, "预设局面应轮到你出牌");
assert(riggedBombA.state.lastActivePlay?.type === PLAY_TYPES.single, "炸弹时机预设应有对手单张占牌");
assert(riggedBombA.scenario.id === "bomb-timing-vs-single", "炸弹时机应对应指定预设 id");

const riggedBombRec = recommendPlay(
  riggedBombA.state.players[0].hand,
  riggedBombA.levelRank,
  riggedBombA.state.lastActivePlay,
  {
    state: riggedBombA.state,
    playerIndex: 0,
    lastActivePlayerIndex: riggedBombA.state.lastActivePlayerIndex,
    previousPlay: riggedBombA.state.lastActivePlay,
    preferredGroups: buildStrategicGroups(riggedBombA.state.players[0].hand, riggedBombA.levelRank),
    mlFusionMode: "off",
    mlModel: false,
  },
);
assert(
  riggedBombRec.candidate.type !== PLAY_TYPES.bomb,
  `炸弹时机预设应优先普通跟牌，实际 ${riggedBombRec.candidate.label}`,
);

const riggedPass = createDrillRiggedState(DRILL_TAGS.PASS_RELEASE);
assert(riggedPass.state.lastActivePlay?.type === PLAY_TYPES.pair, "过牌放行预设应有对手对子占牌");

const riggedLead = createDrillRiggedState(DRILL_TAGS.BOMB_SPLIT_TRIPLE);
assert(isFreshDrillGameState(riggedLead.state), "接风三带二预设应为全新接风开局");
assert(riggedLead.state.players[0].hand.length === 27, "预设补牌后你仍应有 27 张");

const drillScenario = getDrillScenarioForTag(DRILL_TAGS.BOMB_TIMING);
const drillNextMeta = buildDrillPracticeGameMeta({
  gameId: "game-4",
  seed: riggedBombA.seed,
  startedAt: new Date().toISOString(),
  playerNames: ["你", "勇哥", "老史", "毛蛋"],
  humanPlayerIndex: 0,
  partnerIndex: 2,
  aiChatTimeline: [],
  initialHands: [],
}, DRILL_TAGS.BOMB_TIMING, drillScenario);
assert(drillNextMeta.coachAdviceTimeline.length === 0, "练这个应清空 coachAdviceTimeline");
assert(drillNextMeta.drillFocus === DRILL_TAGS.BOMB_TIMING, "练这个应设置 drillFocus");
assert(drillNextMeta.drillScenarioId === "bomb-timing-vs-single", "练这个应记录预设局面 id");

// 专项练习 UI：table-wrap 两行网格，专项文案并入 matchSummary
assert(
  /\.table-wrap\s*\{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)/s.test(indexHtml),
  "table-wrap 应为两行网格（match-strip + table）",
);
const tableWrapBlock = indexHtml.match(/<section class="table-wrap">([\s\S]*?)<section class="table">/);
assert(tableWrapBlock, "应存在 table-wrap 区块");
const tableWrapInner = tableWrapBlock[1];
assert(tableWrapInner.includes('id="matchStrip"'), "table-wrap 应包含 match-strip");
assert(
  /\.drill-focus-banner\s*\{[^}]*display:\s*none\s*!important/s.test(indexHtml),
  "drill-focus-banner 应永久隐藏，不占 table-wrap 行",
);
assert(
  /\.table\s*\{[^}]*grid-row:\s*2[^}]*min-height:\s*300px/s.test(indexHtml),
  ".table 应显式占第 2 行并有最小高度",
);
assert(
  /\.match-strip:not\(\.match-active\)\s+\.match-actions\s*\{[^}]*display:\s*none\s*!important/s.test(indexHtml),
  "单局模式应通过 CSS 隐藏下一局按钮",
);

// 单局隐藏「下一局」
assert(!shouldShowNextMatchGame(null), "无 matchState 时不应显示下一局");
assert(shouldShowNextMatchGame({ gameNumber: 1 }), "有 matchState 时应显示下一局");
assert(
  buildSingleGameMatchSummary(DRILL_TAGS.BOMB_TIMING).startsWith("专项练习（预设局面）："),
  "单局专项练习摘要应标明预设局面",
);
assert(
  buildSingleGameMatchSummary(DRILL_TAGS.BOMB_TIMING).includes("有普通过牌别急着炸"),
  "单局专项练习摘要应包含预设标题",
);
assert(
  buildSingleGameMatchSummary(null) === "竞技赛未开始；可先用单局继续练习。",
  "普通单局摘要应保持默认文案",
);

// 关键时刻暂停：对手报单需压牌
const keyPauseLowHand = cards([
  ["K"], ["K", SUITS.clubs], ["K", SUITS.diamonds], ["K", SUITS.hearts],
  ["A"], ["A", SUITS.clubs], ["2"], ["2", SUITS.clubs],
]);
const keyPauseLowState = {
  levelRank: "5",
  currentPlayerIndex: 0,
  lastActivePlay: classifyPlay(cards([["7"]]), "5"),
  lastActivePlayerIndex: 1,
  playHistory: [],
  players: [
    { hand: keyPauseLowHand, seatIndex: 0, finishedOrder: null },
    { hand: cards([["3"]]), seatIndex: 1, finishedOrder: null },
    { hand: cards([["4"], ["5"], ["6"]]), seatIndex: 2, finishedOrder: null },
    { hand: cards([["8"], ["9"], ["10"]]), seatIndex: 3, finishedOrder: null },
  ],
};
const keyPauseLow = detectKeyMoment(keyPauseLowState, { humanIndex: 0, gameMeta: {}, keyPauseFired: new Set() });
assert(keyPauseLow?.type === KEY_PAUSE_TYPES.OPPONENT_LOW_PRESS, "对手剩1张需压牌应触发报单暂停");
assert(/只剩1张/.test(keyPauseLow.message), "报单暂停文案应提示只剩1张");

// 关键时刻暂停：有炸弹且需抢牌权
const keyPauseBombHand = cards([
  ["9"], ["9", SUITS.clubs], ["9", SUITS.diamonds], ["9", SUITS.hearts],
  ["J"], ["Q"], ["K"], ["A"],
]);
const keyPauseBombState = {
  levelRank: "5",
  currentPlayerIndex: 0,
  lastActivePlay: null,
  lastActivePlayerIndex: null,
  playHistory: [],
  players: [
    { hand: keyPauseBombHand, seatIndex: 0, finishedOrder: null },
    { hand: cards([["3"], ["4"], ["5"], ["6"], ["7"]]), seatIndex: 1, finishedOrder: null },
    { hand: cards([["8"], ["10"], ["J"]]), seatIndex: 2, finishedOrder: null },
    { hand: cards([["2"], ["2", SUITS.clubs], ["A"], ["K"]]), seatIndex: 3, finishedOrder: null },
  ],
};
const keyPauseBomb = detectKeyMoment(keyPauseBombState, { humanIndex: 0, gameMeta: {}, keyPauseFired: new Set() });
assert(keyPauseBomb?.type === KEY_PAUSE_TYPES.BOMB_TIMING, "有炸弹且有牌权应触发炸弹时机暂停");

// 关键时刻暂停：残局冲刺
const keyPauseEndHand = cards([
  ["3"], ["4"], ["5"], ["6"], ["7"], ["8"], ["9"], ["10"], ["J"], ["Q"], ["K"], ["A"],
]);
const keyPauseEndState = {
  levelRank: "5",
  currentPlayerIndex: 0,
  lastActivePlay: null,
  lastActivePlayerIndex: null,
  playHistory: [],
  players: [
    { hand: keyPauseEndHand, seatIndex: 0, finishedOrder: null },
    { hand: cards([["2"], ["2", SUITS.clubs], ["2", SUITS.diamonds], ["2", SUITS.hearts], ["3", SUITS.clubs]]), seatIndex: 1, finishedOrder: null },
    { hand: cards([["4"], ["5"], ["6"], ["7"], ["8"]]), seatIndex: 2, finishedOrder: null },
    { hand: cards([["9"], ["10"], ["J"], ["Q"], ["K"]]), seatIndex: 3, finishedOrder: null },
  ],
};
const keyPauseEnd = detectKeyMoment(keyPauseEndState, { humanIndex: 0, gameMeta: {}, keyPauseFired: new Set() });
assert(keyPauseEnd?.type === KEY_PAUSE_TYPES.ENDGAME_SPRINT, "12张有牌权应触发残局冲刺暂停");

// 关键时刻暂停：进贡后第一手
const keyPauseTributeState = {
  ...keyPauseEndState,
  players: keyPauseEndState.players.map((p, i) => (i === 0
    ? { ...p, hand: cards([["3"], ["4"], ["5"], ["6"], ["7"], ["8"], ["9"], ["10"], ["J"], ["Q"], ["K"], ["A"], ["2"], ["2", SUITS.clubs], ["2", SUITS.diamonds]]) }
    : p)),
};
const keyPauseTribute = detectKeyMoment(keyPauseTributeState, {
  humanIndex: 0,
  gameMeta: { tributeEvents: [{ type: "tribute", from: 3, to: 0 }] },
  keyPauseFired: new Set(),
});
assert(keyPauseTribute?.type === KEY_PAUSE_TYPES.TRIBUTE_FIRST, "进贡后第一手应触发进贡暂停");

// 已触发过的类型不再重复
const keyPauseFiredAgain = detectKeyMoment(keyPauseEndState, {
  humanIndex: 0,
  gameMeta: {},
  keyPauseFired: new Set([KEY_PAUSE_TYPES.ENDGAME_SPRINT]),
});
assert(keyPauseFiredAgain === null, "同局同类型不应重复触发");

// 采纳提示出牌后：人类出牌应推进回合，机器人队列可逐步推进且不 detectTurnStuck
const adoptHumanCore = cards([
  ["4", SUITS.spades], ["4", SUITS.clubs], ["4", SUITS.diamonds],
  ["5", SUITS.hearts], ["5", SUITS.diamonds],
  ["3", SUITS.clubs], ["7", SUITS.hearts], ["9", SUITS.diamonds],
  ["J", SUITS.spades], ["Q", SUITS.clubs], ["K", SUITS.hearts], ["A", SUITS.diamonds],
]);
const adoptPad = cards([
  ["2", SUITS.clubs], ["6", SUITS.diamonds], ["8", SUITS.clubs], ["10", SUITS.diamonds],
  ["SJ", "JOKER", 0], ["2", SUITS.spades], ["3", SUITS.diamonds], ["6", SUITS.hearts],
  ["8", SUITS.spades], ["9", SUITS.clubs], ["10", SUITS.hearts], ["J", SUITS.diamonds],
  ["Q", SUITS.diamonds], ["K", SUITS.spades], ["A", SUITS.clubs],
]);
const adoptHumanHand = [...adoptHumanCore, ...adoptPad.slice(0, 27 - adoptHumanCore.length)];
const adoptOpponentHand = (offset) => adoptPad.slice(offset).concat(adoptPad.slice(0, offset)).slice(0, 27);
let adoptState = createGameStateFromHands({
  levelRank: "5",
  hands: [
    adoptHumanHand,
    adoptOpponentHand(0),
    adoptOpponentHand(5),
    adoptOpponentHand(10),
  ],
  currentPlayerIndex: 0,
});
const adoptHintAdvice = getTurnAdvice(adoptState, 0, { alternatives: 3, mlFusionMode: "off", mlModel: false });
assert(
  adoptHintAdvice.recommendation.candidate.type === PLAY_TYPES.tripleWithPair
    && adoptHintAdvice.recommendation.candidate.mainRank === "4",
  `提示状态应首推三带二 4，实际 ${adoptHintAdvice.recommendation.candidate.label ?? adoptHintAdvice.recommendation.candidate.type}`,
);
adoptState = playCards(adoptState, adoptHintAdvice.recommendation.candidate.cards);
assert(adoptState.currentPlayerIndex !== 0, "采纳出牌后应轮到其他玩家，而非卡在人类回合");
assert(!detectTurnStuck(adoptState), "采纳出牌后不应处于 detectTurnStuck 卡住态");

let adoptRobotSteps = 0;
while (adoptState && !isGameOver(adoptState) && adoptState.currentPlayerIndex !== 0 && adoptRobotSteps < 4) {
  assert(!detectTurnStuck(adoptState), `机器人队列第 ${adoptRobotSteps + 1} 步不应卡住`);
  const robotTurn = playRecommendedTurn(adoptState, { mlFusionMode: "off", mlModel: false });
  assert(robotTurn.state !== adoptState, "每步机器人出牌应改变局面");
  adoptState = robotTurn.state;
  adoptRobotSteps += 1;
}
assert(adoptRobotSteps > 0, "采纳后 mock 机器人队列应至少推进一手");

// 新手引导：遮罩不拦截点击，高亮目标（新开一局等）可穿透操作
assert(
  !/\.onboarding-overlay:not\(\[hidden\]\)\s*\{[^}]*pointer-events:\s*auto/s.test(indexHtml),
  "onboarding 遮罩不应在显示时全屏拦截 pointer-events",
);
assert(
  /\.onboarding-overlay\s*\{[^}]*pointer-events:\s*none/s.test(indexHtml),
  "onboarding 遮罩应默认 pointer-events: none",
);
assert(
  /\.onboarding-card\s*\{[^}]*pointer-events:\s*auto/s.test(indexHtml),
  "onboarding 说明卡应保留 pointer-events: auto 以支持「跳过引导」",
);
assert(
  /\.onboarding-target-ring\s*\{[^}]*pointer-events:\s*none/s.test(indexHtml),
  "onboarding 高亮环应 pointer-events: none 以免挡住目标按钮",
);

// newGame 路径：无缓存 advice 时不应同步全量 recommendPlay（alternatives:48）
function adviceSnapshotWithoutSyncCompute(gameState, cachedAdvice) {
  if (!gameState || isGameOver(gameState) || !cachedAdvice) return null;
  return { cached: true, playerIndex: cachedAdvice.playerIndex ?? 0 };
}

const newGameFresh = createInitialGameState({ random: seededRandom(20260607) });
assert(newGameFresh.currentPlayerIndex === 0, "新局发牌后应人类先出牌");
assert(
  adviceSnapshotWithoutSyncCompute(newGameFresh, null) === null,
  "newGame 归档/存档快照在无缓存 advice 时不应触发同步计算",
);

const newGameAdviceBudgetMs = 2500;
const newGameAdviceStart = performance.now();
getTurnAdvice(newGameFresh, 0, { alternatives: 2, maxCandidates: 16, mlFusionMode: "off", mlModel: false, lite: true });
const newGameAdviceElapsed = performance.now() - newGameAdviceStart;
assert(
  newGameAdviceElapsed < newGameAdviceBudgetMs,
  `全量 advice 应在 ${newGameAdviceBudgetMs}ms 内完成（实际 ${Math.round(newGameAdviceElapsed)}ms），newGame 已改为延后计算`,
);

// 非人类先手时 newGame 应走异步机器人队列（lite 单步），3 手内回到人类且不卡住
const newGameRobotPad = shuffle(createDoubleDeck()).slice(0, 81);
const newGameRobotCore = cards([["A"], ["K"], ["Q"], ["J"], ["10"]]);
const newGameRobotHand = [...newGameRobotCore, ...newGameRobotPad.slice(0, 27 - newGameRobotCore.length)];
const newGameRobotOpp = (offset) => newGameRobotPad.slice(offset).concat(newGameRobotPad.slice(0, offset)).slice(0, 27);
let newGameRobotState = createGameStateFromHands({
  levelRank: "3",
  hands: [
    newGameRobotHand,
    newGameRobotOpp(0),
    newGameRobotOpp(5),
    newGameRobotOpp(10),
  ],
  currentPlayerIndex: 3,
});
assert(newGameRobotState.currentPlayerIndex !== 0, "模拟非人类先手发牌");
for (let robotStep = 0; robotStep < 3; robotStep += 1) {
  assert(
    newGameRobotState.currentPlayerIndex !== 0,
    `newGame 机器人队列第 ${robotStep + 1} 步前不应回到人类`,
  );
  if (detectTurnStuck(newGameRobotState)) {
    const stuckFix = repairTurnStuck(newGameRobotState);
    assert(stuckFix.repaired, `newGame 机器人第 ${robotStep + 1} 步卡住应能修复`);
    newGameRobotState = stuckFix.state;
  }
  const robotTurn = playRecommendedTurn(newGameRobotState, { mlFusionMode: "off", mlModel: false, lite: true });
  newGameRobotState = robotTurn.state;
  assert(!detectTurnStuck(newGameRobotState), `newGame 机器人第 ${robotStep + 1} 步后不应 detectTurnStuck`);
}
assert(newGameRobotState.currentPlayerIndex === 0, "newGame 机器人队列 3 步后应回到人类");

// boot/restore 路径：与 newGame 一致，活跃局 lite 渲染 + 延后 advice，避免主线程卡死
const mainSource = readFileSync(join(smokeRoot, "..", "app", "main.mjs"), "utf8");
const bootAppBlock = mainSource.slice(mainSource.indexOf("async function bootApp"));
assert(
  /render\(\{\s*immediate:\s*true,\s*lite:\s*activeRestored\s*\}\)/.test(bootAppBlock),
  "bootApp 恢复活跃局时应 lite 渲染，避免同步 getHumanAdvice(48)",
);
assert(
  bootAppBlock.includes("scheduleHumanAdviceRefresh()")
    && bootAppBlock.indexOf("scheduleHumanAdviceRefresh()") > bootAppBlock.indexOf("activeRestored"),
  "bootApp 恢复人类回合时应延后计算 advice",
);
assert(
  !/lite:\s*!backToHuman/.test(mainSource),
  "机器人队列回到人类时不应 lite:false 触发同步 advice",
);
assert(
  mainSource.includes("currentAdvice = null;") && mainSource.includes("function applyRestoredSession"),
  "恢复存档时应清空 currentAdvice，避免误用旧缓存",
);
assert(
  mainSource.includes("function buildAdviceTableKey")
    && mainSource.includes("function isAdviceStale")
    && mainSource.includes("invalidateStaleAdvice()"),
  "人类回合应校验 advice 与桌面签名，避免机器人预计算过期建议",
);
assert(
  /function adviceChoices[\s\S]{0,900}canBeat/.test(mainSource),
  "展示层 adviceChoices 须过滤不能压过上家的推荐",
);
assert(
  !/function showHint\(\)[\s\S]{0,400}getHumanAdvice\(\)/.test(mainSource),
  "showHint 不得同步 getHumanAdvice",
);
assert(
  !/function playAdviceChoice\([\s\S]{0,400}getHumanAdvice\(\)/.test(mainSource),
  "playAdviceChoice 不得同步 getHumanAdvice",
);
assert(
  mainSource.includes("HUMAN_ADVICE_MAX_CANDIDATES_OPEN")
    && mainSource.includes("HUMAN_ADVICE_MAX_CANDIDATES_PRESS"),
  "人类 advice 应裁剪候选池，避免 200+ 候选全量评分",
);
assert(
  mainSource.includes("adviceScheduledTableKey"),
  "人类 advice 应按桌面签名去重，避免 render 循环卡死",
);
assert(
  /if \(computeAdvice\)[\s\S]{0,160}scheduleHumanAdviceRefresh/.test(mainSource),
  "仅 computeAdvice 为真时才调度建议计算",
);

const restoreAdviceBudgetMs = 2500;
const restoreFresh = createInitialGameState({ levelRank: "6", random: seededRandom(20260608) });
const restoreAdviceStart = performance.now();
getTurnAdvice(restoreFresh, 0, { alternatives: 2, maxCandidates: 16, mlFusionMode: "off", mlModel: false, lite: true });
const restoreAdviceElapsed = performance.now() - restoreAdviceStart;
assert(
  restoreAdviceElapsed < restoreAdviceBudgetMs,
  `级牌6 恢复场景全量 advice 应在 ${restoreAdviceBudgetMs}ms 内（实际 ${Math.round(restoreAdviceElapsed)}ms）`,
);

// 移动端走查：安全区、问教练抽屉、触控尺寸
assert(
  /viewport-fit=cover/.test(indexHtml),
  "viewport 应含 viewport-fit=cover 以支持刘海屏 safe-area",
);
assert(
  /--safe-top:\s*env\(safe-area-inset-top/.test(indexHtml),
  "CSS 应定义 --safe-top 等 safe-area 变量",
);
assert(
  /\.coach-fab-backdrop/.test(indexHtml) && /id="coachFabBackdrop"/.test(indexHtml),
  "问教练抽屉应有遮罩层 coach-fab-backdrop",
);
assert(
  /@media \(max-width: 740px\)[\s\S]*\.coach-fab-drawer[\s\S]*position:\s*fixed/.test(indexHtml),
  "窄屏问教练抽屉应 fixed 底栏展示",
);
assert(
  /@media \(max-width: 740px\)[\s\S]*\.coach-fab[\s\S]*min-height:\s*44px/.test(indexHtml),
  "窄屏问教练 FAB 触控高度应 ≥44px",
);
assert(
  /coachFabBackdrop/.test(readFileSync(join(smokeRoot, "..", "app", "main.mjs"), "utf8")),
  "main.mjs 应绑定 coachFabBackdrop 遮罩点击收起",
);
assert(
  !/submitReminderDialog|submit-reminder-dialog/.test(indexHtml),
  "游戏 UI 不应含保存复盘确认弹窗（局末自动保存）",
);

console.log("掼蛋教练 Pro：全部冒烟测试通过");
