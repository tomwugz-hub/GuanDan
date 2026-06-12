/**
 * 推理原则层回归：举一反三，非逐局 if。
 */
import {
  SUITS,
  PLAY_TYPES,
  classifyPlay,
  createCard,
  createGameStateFromHands,
  generateBasicCandidates,
  recommendPlay,
  buildStrategicGroups,
  tryLocalCoachAnswer,
} from "../src/index.mjs";
import { PRINCIPLE_DEFS } from "../strategy/principles.mjs";
import { scoreCandidate } from "../strategy/recommend.mjs";
import { enrichScoringContext } from "../strategy/table-context.mjs";

function cards(specs) {
  return specs.map(([rank, suit = SUITS.spades, deckIndex = 0]) => createCard(rank, suit, deckIndex));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log("principles-smoke: 原则定义", Object.keys(PRINCIPLE_DEFS).length, "条");

// 1. 压单3有单Q → 单Q（P1）
const beat3Hand = cards([
  ["6", SUITS.spades], ["6", SUITS.hearts], ["6", SUITS.diamonds],
  ["7", SUITS.spades], ["7", SUITS.hearts], ["7", SUITS.diamonds],
  ["4", SUITS.spades], ["4", SUITS.hearts], ["4", SUITS.clubs], ["4", SUITS.diamonds],
  ["3", SUITS.spades], ["3", SUITS.hearts],
  ["5", SUITS.spades], ["5", SUITS.hearts],
  ["8", SUITS.spades], ["8", SUITS.hearts],
  ["10", SUITS.spades], ["10", SUITS.hearts],
  ["A", SUITS.spades], ["A", SUITS.hearts],
  ["Q", SUITS.clubs],
  ["BJ", SUITS.joker],
]);
const beat3Prev = classifyPlay(cards([["3", SUITS.hearts]]), "5");
const filler = cards([
  ["2", SUITS.clubs], ["2", SUITS.diamonds], ["9", SUITS.clubs], ["9", SUITS.diamonds],
  ["K", SUITS.clubs], ["K", SUITS.diamonds], ["J", SUITS.clubs], ["J", SUITS.diamonds],
]);
let beat3State = createGameStateFromHands({
  levelRank: "5",
  hands: [beat3Hand, filler, filler, filler],
  currentPlayerIndex: 0,
});
beat3State = { ...beat3State, lastActivePlay: beat3Prev, lastActivePlayerIndex: 1 };
const beat3Rec = recommendPlay(beat3Hand, "5", beat3Prev, {
  state: beat3State, playerIndex: 0, mlFusionMode: "off", mlModel: false,
});
assert(beat3Rec.candidate.type === PLAY_TYPES.single && beat3Rec.candidate.mainRank === "Q",
  `P1 压单3有单Q应出单Q，实际 ${beat3Rec.candidate.label ?? beat3Rec.candidate.mainRank}`);
assert(beat3Rec.reasons.some((r) => /P1|散单|散牌/.test(r)),
  `应引用 P1 原则，实际 ${beat3Rec.reasons.join("；")}`);

const qaLooseQ = tryLocalCoachAnswer("有单Q为什么拆牌？", {
  status: "in-progress", levelRank: "5", turnNumber: 8,
  humanHand: beat3Hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex, label: c.rank })),
  table: { lastActivePlay: beat3Prev },
  currentAdvice: {
    choices: [{
      play: generateBasicCandidates(beat3Hand, "5", beat3Prev)
        .find((c) => c.type === PLAY_TYPES.single && c.mainRank === "6"),
      reasons: ["跟住对手单张"],
    }],
  },
});
assert(
  qaLooseQ?.text.includes("P1") || qaLooseQ?.text.includes("散单") || qaLooseQ?.text.includes("推荐偏了"),
  "QA 应原则驱动说明散单优先",
);
assert(qaLooseQ?.text.includes("不宜拆") || qaLooseQ?.text.includes("散") || qaLooseQ?.text.includes("应出"),
  "QA 应说明不宜拆结构或应出散单",
);

// 2. 压单3无散单有对5 → 拆对5（P2）
const beat3Pair5Hand = cards([
  ["6", SUITS.spades], ["6", SUITS.hearts], ["6", SUITS.diamonds],
  ["7", SUITS.spades], ["7", SUITS.hearts], ["7", SUITS.diamonds],
  ["4", SUITS.spades], ["4", SUITS.hearts], ["4", SUITS.clubs], ["4", SUITS.diamonds],
  ["3", SUITS.spades], ["3", SUITS.hearts],
  ["5", SUITS.spades], ["5", SUITS.clubs],
  ["9", SUITS.spades], ["9", SUITS.clubs],
  ["10", SUITS.spades], ["10", SUITS.clubs],
  ["K", SUITS.spades], ["K", SUITS.clubs],
  ["BJ", SUITS.joker],
]);
const beat3Pair5Prev = classifyPlay(cards([["3", SUITS.hearts]]), "A");
let beat3Pair5State = createGameStateFromHands({
  levelRank: "A",
  hands: [beat3Pair5Hand, filler, filler, filler],
  currentPlayerIndex: 0,
});
beat3Pair5State = { ...beat3Pair5State, lastActivePlay: beat3Pair5Prev, lastActivePlayerIndex: 1 };
const beat3Pair5Rec = recommendPlay(beat3Pair5Hand, "A", beat3Pair5Prev, {
  state: beat3Pair5State, playerIndex: 0, mlFusionMode: "off", mlModel: false,
});
assert(
  beat3Pair5Rec.candidate.type === PLAY_TYPES.single
  && beat3Pair5Rec.candidate.mainRank === "5",
  `P2 无散单应拆最小对5，实际单${beat3Pair5Rec.candidate.mainRank}`,
);
assert(beat3Pair5Rec.reasons.some((r) => /P2|对子拆/.test(r)),
  `应引用 P2，实际 ${beat3Pair5Rec.reasons.join("；")}`);

// 3. 压单3只有钢板6 → 才单6（P3 兜底）
const onlyPlateHand = cards([
  ["6", SUITS.spades], ["6", SUITS.hearts], ["6", SUITS.diamonds],
  ["7", SUITS.spades], ["7", SUITS.hearts], ["7", SUITS.diamonds],
  ["4", SUITS.spades], ["4", SUITS.hearts], ["4", SUITS.clubs], ["4", SUITS.diamonds],
  ["3", SUITS.spades], ["3", SUITS.hearts],
  ["BJ", SUITS.joker],
]);
let onlyPlateState = createGameStateFromHands({
  levelRank: "5",
  hands: [onlyPlateHand, filler, filler, filler],
  currentPlayerIndex: 0,
});
onlyPlateState = { ...onlyPlateState, lastActivePlay: beat3Prev, lastActivePlayerIndex: 1 };
const onlyPlateRec = recommendPlay(onlyPlateHand, "5", beat3Prev, {
  state: onlyPlateState, playerIndex: 0, mlFusionMode: "off", mlModel: false,
});
assert(
  onlyPlateRec.candidate.type === PLAY_TYPES.single
  && ["5", "6", "7", "8"].includes(onlyPlateRec.candidate.mainRank),
  `P3 只剩结构时应出最小够压单，实际 ${onlyPlateRec.candidate.label ?? onlyPlateRec.candidate.mainRank}`,
);

// 4. 接风钢板 → 钢板（P5）
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
const steelWindRec = recommendPlay(steelWindHand, "A", null, {
  state: steelWindState,
  playerIndex: 0,
  preferredGroups: buildStrategicGroups(steelWindHand, "A"),
  mlFusionMode: "off",
  mlModel: false,
});
assert(
  steelWindRec.candidate.type === PLAY_TYPES.consecutivePairs && steelWindRec.candidate.length >= 6,
  `P5 接风应优先钢板/连对，实际 ${steelWindRec.candidate.label ?? steelWindRec.candidate.type}`,
);
assert(steelWindRec.reasons.some((r) => /P5|减六张|钢板|连对/.test(r)),
  `应引用 P5，实际 ${steelWindRec.reasons.join("；")}`);

// 5. 压王 → 最小炸（P7）
const pressKingHand = cards([
  ["4", SUITS.spades], ["4", SUITS.hearts], ["4", SUITS.clubs], ["4", SUITS.diamonds],
  ["6", SUITS.spades], ["6", SUITS.hearts], ["6", SUITS.clubs], ["6", SUITS.diamonds],
  ["8", SUITS.spades], ["8", SUITS.hearts], ["8", SUITS.clubs], ["8", SUITS.diamonds],
  ["3", SUITS.spades],
]);
const pressKingPrev = classifyPlay(cards([["BJ", SUITS.joker]]), "5");
let pressKingState = createGameStateFromHands({
  levelRank: "5",
  hands: [pressKingHand, filler, filler, filler],
  currentPlayerIndex: 0,
});
pressKingState = { ...pressKingState, lastActivePlay: pressKingPrev, lastActivePlayerIndex: 1 };
const pressKingRec = recommendPlay(pressKingHand, "5", pressKingPrev, {
  state: pressKingState, playerIndex: 0, mlFusionMode: "off", mlModel: false,
});
assert(pressKingRec.candidate.type === PLAY_TYPES.bomb && pressKingRec.candidate.mainRank === "4",
  `P7 压王应最小四炸4，实际 ${pressKingRec.candidate.label ?? pressKingRec.candidate.mainRank}`);
const biggerBomb = generateBasicCandidates(pressKingHand, "5", pressKingPrev)
  .find((c) => c.type === PLAY_TYPES.bomb && c.mainRank === "6");
assert(biggerBomb, "测试手牌应有可压王的6炸作对照");
const pressCands = generateBasicCandidates(pressKingHand, "5", pressKingPrev);
const pressCtx = enrichScoringContext({ state: pressKingState, playerIndex: 0, previousPlay: pressKingPrev }, pressCands, pressKingHand, "5");
const biggerScored = scoreCandidate(biggerBomb, pressKingHand, "5", pressKingPrev, { ...pressCtx, _candidates: pressCands });
assert(biggerScored.reasons.some((r) => /P7|小炸|最小够压/.test(r)),
  `P7 应对大炸加分，实际 ${biggerScored.reasons.join("；")}`);

// 6. 接风单7+大王（P6）
const game2Hand = cards([
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
let game2State = createGameStateFromHands({
  levelRank: "6",
  hands: [game2Hand, cards([["3"]]), cards([["4"]]), cards([["5"]])],
  currentPlayerIndex: 0,
});
game2State = {
  ...game2State,
  lastActivePlay: null,
  lastActivePlayerIndex: null,
  playHistory: [
    { turnNumber: 1, playerIndex: 0, play: classifyPlay(cards([["3", SUITS.hearts], ["3", SUITS.diamonds]]), "6") },
    { turnNumber: 2, playerIndex: 1, play: classifyPlay([], "6") },
    { turnNumber: 3, playerIndex: 2, play: classifyPlay([], "6") },
    { turnNumber: 4, playerIndex: 3, play: classifyPlay([], "6") },
  ],
};
const game2Rec = recommendPlay(game2Hand, "6", null, {
  state: game2State,
  playerIndex: 0,
  preferredGroups: buildStrategicGroups(game2Hand, "6"),
  mlFusionMode: "off",
  mlModel: false,
});
assert(
  game2Rec.candidate.type === PLAY_TYPES.single && game2Rec.candidate.mainRank === "7",
  `P6 接风有大王应小单7试探，实际 ${game2Rec.candidate.label ?? game2Rec.candidate.mainRank}`,
);
assert(game2Rec.reasons.some((r) => /P6|大王可回收|送单/.test(r)),
  `应引用 P6，实际 ${game2Rec.reasons.join("；")}`);

console.log("principles-smoke: 全部 6 场景通过");
