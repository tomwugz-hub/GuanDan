import { playSignature } from "../engine/card.mjs";
import {
  classifyDivergence,
  isHumanDivergence,
  isHumanReplayRecord,
  summarizeGameDivergences,
  DIVERGENCE_VERDICTS,
} from "../coach/divergence-summary.mjs";
import { tryLocalCoachAnswer } from "../coach/local-qa.mjs";

const timeline = [
  {
    playerIndex: 0,
    turnNumber: 1,
    source: "human-manual",
    handCount: 18,
    choices: [{
      play: { type: "TripleWithPair", label: "三带二 8" },
      reasons: ["接风优先三带二"],
    }],
    actualPlay: { type: "ConsecutivePairs", length: 6, label: "钢板 667788" },
    actualChoiceMatch: "outside-top-3",
  },
  {
    playerIndex: 0,
    turnNumber: 2,
    source: "human-manual",
    handCount: 12,
    mustBeat: { label: "顺子" },
    choices: [{
      play: { type: "Pass", label: "过牌" },
      reasons: ["对手用小炸"],
    }],
    actualPlay: { type: "StraightFlush", label: "同花顺 9-K" },
    actualChoiceMatch: "suggestion-2",
  },
  {
    playerIndex: 0,
    turnNumber: 3,
    source: "human-accepted-top",
    choices: [{ play: { type: "Single", cards: [{ suit: "S", rank: "5", deckIndex: 0 }] } }],
    actualPlay: { type: "Single", cards: [{ suit: "S", rank: "5", deckIndex: 0 }] },
    actualChoiceMatch: "suggestion-1",
  },
];

if (!isHumanDivergence(timeline[0], 0)) throw new Error("应识别差异手");
if (isHumanDivergence(timeline[2], 0)) throw new Error("不应把一致手算差异");

const summary = summarizeGameDivergences(timeline, 0);
if (summary.divergenceCount !== 2) throw new Error(`divergenceCount ${summary.divergenceCount}`);
if (summary.userBetterCount < 2) throw new Error(`userBetterCount ${summary.userBetterCount}`);
if (summary.divergences[0].verdict !== DIVERGENCE_VERDICTS.USER_BETTER) {
  throw new Error(`第1手应为你更对，实际 ${summary.divergences[0].verdict}`);
}
if (summary.divergences[1].verdict !== DIVERGENCE_VERDICTS.USER_BETTER) {
  throw new Error(`第2手应为你更对，实际 ${summary.divergences[1].verdict}`);
}

const passVsSingle = classifyDivergence({
  actual: "过牌",
  recommended: "单张 5",
  mustBeat: "单张 4",
  recommendedReasons: ["对手占牌且你有普通压牌，不能轻易放行"],
}, {
  choices: [{ play: { type: "Single" } }],
  actualPlay: { type: "Pass" },
});
if (passVsSingle.verdict !== DIVERGENCE_VERDICTS.COACH_BETTER) {
  throw new Error("该过牌应判教练更对");
}

const planeVsTriple = classifyDivergence({
  actual: "钢板 4-5",
  recommended: "三带二 4+22",
  mustBeat: null,
  handCount: 27,
}, {
  choices: [{ play: { type: "TripleWithPair" } }],
  actualPlay: { type: "Plane", length: 6 },
});
if (planeVsTriple.verdict !== DIVERGENCE_VERDICTS.USER_BETTER) {
  throw new Error("接风打真钢板应判用户更对");
}

// 王牌签名与 cardId 一致（JK: 前缀）
const sjCard = { rank: "SJ", suit: "JOKER", deckIndex: 1 };
const sjPlay = { type: "Single", cards: [sjCard] };
if (!playSignature(sjPlay).includes("JK:SJ#1")) {
  throw new Error(`王牌签名应含 JK: 前缀，实际 ${playSignature(sjPlay)}`);
}
const jokerTimeline = [{
  playerIndex: 0,
  turnNumber: 10,
  source: "human-manual",
  choices: [{ play: { type: "Single", cards: [sjCard] } }],
  actualPlay: { type: "Single", cards: [sjCard] },
  actualChoiceMatch: "suggestion-1",
}];
if (isHumanDivergence(jokerTimeline[0], 0)) {
  throw new Error("王牌一致手不应算差异");
}
if (summary.top1MatchCount !== 1) {
  throw new Error(`top1MatchCount 应为 1，实际 ${summary.top1MatchCount}`);
}
const jokerSummary = summarizeGameDivergences(jokerTimeline, 0);
if (jokerSummary.top1MatchCount !== 1) {
  throw new Error(`王牌局 top1MatchCount 应为 1，实际 ${jokerSummary.top1MatchCount}`);
}

// 自动打完代打不计入人类复盘
const autoGameRecord = { playerIndex: 0, turnNumber: 5, source: "auto-game", actualPlay: { type: "Pass" } };
if (isHumanReplayRecord(autoGameRecord, 0)) {
  throw new Error("auto-game 来源不应计入人类复盘");
}
const mixedTimeline = [...timeline, autoGameRecord];
const mixedSummary = summarizeGameDivergences(mixedTimeline, 0);
if (mixedSummary.totalHands !== 3) {
  throw new Error(`排除 auto-game 后 totalHands 应为 3，实际 ${mixedSummary.totalHands}`);
}

// 问教练：对比用户设想出牌 vs 左侧首推，不应落入泛拆炸模板
const whyNotPlayAnswer = tryLocalCoachAnswer("为什么不打三个2带对8？", {
  status: "in-progress",
  levelRank: "3",
  turnNumber: 0,
  humanHand: [
    { rank: "2", suit: "C", deckIndex: 1 },
    { rank: "2", suit: "H", deckIndex: 1 },
    { rank: "2", suit: "S", deckIndex: 0 },
    { rank: "2", suit: "S", deckIndex: 1 },
    { rank: "A", suit: "C", deckIndex: 0 },
    { rank: "3", suit: "C", deckIndex: 0 },
    { rank: "4", suit: "C", deckIndex: 0 },
    { rank: "5", suit: "C", deckIndex: 1 },
    { rank: "6", suit: "S", deckIndex: 0 },
    { rank: "6", suit: "H", deckIndex: 0 },
    { rank: "6", suit: "D", deckIndex: 1 },
    { rank: "8", suit: "C", deckIndex: 1 },
    { rank: "8", suit: "D", deckIndex: 1 },
  ],
  table: { lastActivePlay: null },
  currentAdvice: {
    choices: [{
      play: { type: "TripleWithPair", mainRank: "6", label: "三带二 黑桃6 红桃6 方片6 梅花8 方片8" },
      reasons: ["开局减手"],
    }],
  },
});
if (whyNotPlayAnswer?.mode !== "why-not-play") {
  throw new Error(`为何不打出牌应走 why-not-play，实际 ${whyNotPlayAnswer?.mode}`);
}

const plateBreakQAnswer = tryLocalCoachAnswer("这手为什么推荐要拆钢板？打Q不是更好吗？", {
  status: "in-progress",
  levelRank: "3",
  turnNumber: 0,
  humanHand: [
    { rank: "6", suit: "S", deckIndex: 0 },
    { rank: "6", suit: "H", deckIndex: 0 },
    { rank: "6", suit: "D", deckIndex: 0 },
    { rank: "7", suit: "S", deckIndex: 0 },
    { rank: "7", suit: "H", deckIndex: 0 },
    { rank: "7", suit: "D", deckIndex: 0 },
    { rank: "8", suit: "C", deckIndex: 0 },
    { rank: "8", suit: "D", deckIndex: 0 },
    { rank: "Q", suit: "C", deckIndex: 0 },
    { rank: "3", suit: "C", deckIndex: 0 },
    { rank: "4", suit: "H", deckIndex: 0 },
    { rank: "5", suit: "S", deckIndex: 0 },
    { rank: "9", suit: "C", deckIndex: 0 },
    { rank: "10", suit: "H", deckIndex: 0 },
    { rank: "J", suit: "D", deckIndex: 0 },
    { rank: "K", suit: "S", deckIndex: 0 },
    { rank: "A", suit: "C", deckIndex: 0 },
    { rank: "2", suit: "H", deckIndex: 0 },
    { rank: "2", suit: "C", deckIndex: 0 },
    { rank: "3", suit: "D", deckIndex: 0 },
    { rank: "4", suit: "D", deckIndex: 0 },
    { rank: "5", suit: "H", deckIndex: 0 },
    { rank: "9", suit: "D", deckIndex: 0 },
    { rank: "10", suit: "C", deckIndex: 0 },
    { rank: "J", suit: "H", deckIndex: 0 },
    { rank: "K", suit: "D", deckIndex: 0 },
    { rank: "A", suit: "S", deckIndex: 0 },
  ],
  table: { lastActivePlay: null },
  currentAdvice: {
    choices: [{
      play: {
        type: "TripleWithPair",
        mainRank: "6",
        label: "三带二 黑桃6 红桃6 方片6 梅花8 方片8",
      },
      reasons: ["拆三张6组其他牌型代价偏高", "开局减手"],
    }],
  },
});
if (plateBreakQAnswer?.mode !== "why-not-play") {
  throw new Error(`拆钢板vs打Q应走 why-not-play，实际 ${plateBreakQAnswer?.mode}`);
}
if (plateBreakQAnswer.text.includes("规则备忘")) {
  throw new Error("拆钢板问题不应落入 brief 规则备忘");
}
if (!plateBreakQAnswer.text.includes("钢板")) {
  throw new Error("应解释钢板与推荐的取舍");
}

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
if (whyBreakThree2Answer?.mode !== "structure-break") {
  throw new Error(`game-2 拆三个2应走 structure-break，实际 ${whyBreakThree2Answer?.mode}`);
}
if (whyBreakThree2Answer.text.includes("非大模型臆测") || whyBreakThree2Answer.text.includes("4张Q")) {
  throw new Error("不应答非所问落入 Q 炸拆炸模板");
}
if (!whyBreakThree2Answer.text.includes("并未拆三个2") && !whyBreakThree2Answer.text.includes("并未拆三个")) {
  throw new Error("应正面回应是否拆了三个2");
}
const whyBreakThree2Lines = whyBreakThree2Answer.text.split("\n").filter((line) => line.trim());
if (whyBreakThree2Lines.length > 5) {
  throw new Error(`拆三个2作答应不超过 5 行，实际 ${whyBreakThree2Lines.length} 行`);
}

const game2StraightBreakHand = [
  { rank: "2", suit: "C", deckIndex: 0 },
  { rank: "2", suit: "D", deckIndex: 1 },
  { rank: "2", suit: "H", deckIndex: 1 },
  { rank: "3", suit: "D", deckIndex: 1 },
  { rank: "4", suit: "S", deckIndex: 0 },
  { rank: "5", suit: "D", deckIndex: 0 },
  { rank: "5", suit: "D", deckIndex: 1 },
  { rank: "6", suit: "H", deckIndex: 1 },
  { rank: "7", suit: "C", deckIndex: 0 },
  { rank: "7", suit: "D", deckIndex: 1 },
  { rank: "8", suit: "C", deckIndex: 0 },
  { rank: "8", suit: "D", deckIndex: 0 },
  { rank: "8", suit: "D", deckIndex: 1 },
  { rank: "8", suit: "H", deckIndex: 1 },
  { rank: "8", suit: "S", deckIndex: 1 },
  { rank: "10", suit: "S", deckIndex: 1 },
  { rank: "J", suit: "C", deckIndex: 0 },
  { rank: "J", suit: "C", deckIndex: 1 },
  { rank: "J", suit: "D", deckIndex: 0 },
  { rank: "J", suit: "S", deckIndex: 0 },
  { rank: "J", suit: "S", deckIndex: 1 },
  { rank: "Q", suit: "H", deckIndex: 1 },
  { rank: "Q", suit: "S", deckIndex: 1 },
  { rank: "K", suit: "C", deckIndex: 0 },
  { rank: "K", suit: "H", deckIndex: 1 },
  { rank: "K", suit: "S", deckIndex: 0 },
  { rank: "A", suit: "H", deckIndex: 0 },
];
const whyTriple2BreaksStraightAnswer = tryLocalCoachAnswer(
  "梅花2已经组成顺子了，出三个2带对5不就把顺子拆了吗？",
  {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 0,
    humanHand: game2StraightBreakHand,
    table: { lastActivePlay: null },
    currentAdvice: {
      choices: [{
        play: {
          type: "TripleWithPair",
          mainRank: "2",
          label: "三带二 梅花2 方片2 红桃2 方片5 方片5",
        },
        reasons: ["开局减手"],
      }],
    },
  },
);
if (whyTriple2BreaksStraightAnswer?.mode !== "why-not-play") {
  throw new Error(`222+55拆顺应走 why-not-play，实际 ${whyTriple2BreaksStraightAnswer?.mode}`);
}
if (whyTriple2BreaksStraightAnswer.text.includes("4张J") || whyTriple2BreaksStraightAnswer.text.includes("非大模型臆测")) {
  throw new Error("不应落入 J 炸弹 rule-only 拆炸模板");
}
if (!/是.*拆.*顺|会拆.*顺子/.test(whyTriple2BreaksStraightAnswer.text)) {
  throw new Error("应确认 222+55 会拆顺子");
}
if (!whyTriple2BreaksStraightAnswer.text.includes("梅花2")) {
  throw new Error("应点明梅花2在顺子里");
}
if (!whyTriple2BreaksStraightAnswer.text.includes("推荐1")) {
  throw new Error("应引用 Top1 推荐");
}

const whyNotPlayPlateAnswer = tryLocalCoachAnswer("为什么要拆钢板？不可以直接打钢板吗？", {
  status: "in-progress",
  levelRank: "6",
  turnNumber: 0,
  humanHand: game2BreakThree2Hand,
  table: { lastActivePlay: null },
  currentAdvice: {
    choices: [{
      play: { type: "Plane", mainRank: "5", length: 6, label: "钢板 4-5" },
      reasons: ["手牌仍多，接风钢板一次减六张"],
    }],
  },
});
if (whyNotPlayPlateAnswer?.mode !== "why-not-play") {
  throw new Error(`直接打钢板追问应走 why-not-play，实际 ${whyNotPlayPlateAnswer?.mode}`);
}
if (!whyNotPlayPlateAnswer.text.includes("可以直接打")) {
  throw new Error("应明确可以直接打钢板");
}
if (whyNotPlayPlateAnswer.text.includes("拆了不亏")) {
  throw new Error("不应误导拆钢板不亏");
}

if (whyNotPlayAnswer.text.includes("非大模型臆测")) {
  throw new Error("不应返回纯拆炸模板");
}
const whyNotPlayLines = whyNotPlayAnswer.text.split("\n").filter((line) => line.trim());
if (whyNotPlayLines.length > 5) {
  throw new Error(`game-2 作答应不超过 5 行，实际 ${whyNotPlayLines.length} 行`);
}
if (!/^【规则引擎作答】\n可以出/.test(whyNotPlayAnswer.text) && !/^【规则引擎作答】\n不推荐/.test(whyNotPlayAnswer.text)) {
  throw new Error("game-2 场景标题后应直接给结论");
}
if (whyNotPlayAnswer.text.includes("【直接回答】") || whyNotPlayAnswer.text.includes("【和你想法的对比】")) {
  throw new Error("不应再出现四段式小节标题");
}
if (!/6.*2|2.*6/.test(whyNotPlayAnswer.text)) {
  throw new Error("应点明三条用6还是2的差别");
}
if (!whyNotPlayAnswer.text.includes("三个2") && !whyNotPlayAnswer.text.includes("222+88")) {
  throw new Error("应回应用户设想的三个2带对8");
}
if (!whyNotPlayAnswer.text.includes("666+88")) {
  throw new Error("应点明左侧首推 666+88");
}
if (whyNotPlayAnswer.text.includes("若手里有")) {
  throw new Error("四炸场景应陈述事实，不用假设句");
}
if (!whyNotPlayAnswer.text.includes("同花顺") && !whyNotPlayAnswer.text.includes("梅花2")) {
  throw new Error("应说明梅花2锁在同花顺");
}
if (whyNotPlayAnswer.text.includes("炸弹作废")) {
  throw new Error("不应错误声称炸弹作废");
}
if (!whyNotPlayAnswer.text.includes("可以出")) {
  throw new Error("应先承认可以出");
}
if (!whyNotPlayAnswer.text.includes("不会拆炸")) {
  throw new Error("应明确出三个2不会拆炸");
}
if (whyNotPlayAnswer.text.includes("整炸") || whyNotPlayAnswer.text.includes("四炸")) {
  throw new Error("无可整炸2时不应出现整炸/四炸");
}
if (!whyNotPlayAnswer.text.includes("拿牌权")) {
  throw new Error("开局应点明拿牌权意图");
}
if (whyNotPlayAnswer.text.includes("ML 倾向")) {
  throw new Error("用户可见正文不含 ML 术语");
}

const whyPlayQBreakPairAnswer = tryLocalCoachAnswer("为什么要打Q？拆了对子，打A不好吗？", {
  status: "in-progress",
  levelRank: "6",
  turnNumber: 12,
  humanHand: [
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
  ],
  table: {
    lastActivePlay: { type: "Single", mainRank: "J", label: "单张 梅花J" },
  },
  currentAdvice: {
    choices: [{
      play: { type: "Single", mainRank: "Q", label: "单张 梅花Q" },
      reasons: ["跟住对手单张，避免其连续占牌"],
    }],
  },
});
if (whyPlayQBreakPairAnswer?.mode !== "why-not-play") {
  throw new Error(`拆对子打Q应走 why-not-play，实际 ${whyPlayQBreakPairAnswer?.mode}`);
}
if (whyPlayQBreakPairAnswer.text.includes("你在问为何不采用")) {
  throw new Error("不应落入 why-not-play 泛答");
}
if (!whyPlayQBreakPairAnswer.text.includes("对")) {
  throw new Error("应说明拆对子代价");
}
if (!whyPlayQBreakPairAnswer.text.includes("A")) {
  throw new Error("应回应打A是否更优");
}
const whyPlayQBreakPairLines = whyPlayQBreakPairAnswer.text.split("\n").filter((line) => line.trim());
if (whyPlayQBreakPairLines.length > 5) {
  throw new Error(`拆对子打Q作答应不超过 5 行，实际 ${whyPlayQBreakPairLines.length} 行`);
}

// 炸弹取舍：推荐小炸不用大炸
const whyNotBomb2Answer = tryLocalCoachAnswer("这手为什么不用四个2压？", {
  status: "in-progress",
  levelRank: "2",
  turnNumber: 15,
  humanHand: [
    { rank: "9", suit: "S", deckIndex: 0 },
    { rank: "9", suit: "H", deckIndex: 0 },
    { rank: "9", suit: "C", deckIndex: 0 },
    { rank: "9", suit: "D", deckIndex: 0 },
    { rank: "2", suit: "S", deckIndex: 0 },
    { rank: "2", suit: "H", deckIndex: 0 },
    { rank: "2", suit: "C", deckIndex: 0 },
    { rank: "2", suit: "D", deckIndex: 0 },
    { rank: "J", suit: "C", deckIndex: 0 },
    { rank: "Q", suit: "D", deckIndex: 0 },
    { rank: "K", suit: "H", deckIndex: 0 },
  ],
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
if (whyNotBomb2Answer?.mode !== "why-not-bomb") {
  throw new Error(`为何不用大炸应走 why-not-bomb，实际 ${whyNotBomb2Answer?.mode}`);
}
if (whyNotBomb2Answer.text.includes("规则备忘") || whyNotBomb2Answer.text.includes("你在问为何不采用")) {
  throw new Error("炸弹取舍不应落入 brief 或 why-not-play 泛答");
}
if (!whyNotBomb2Answer.text.includes("9") || !whyNotBomb2Answer.text.includes("2")) {
  throw new Error("应对比推荐9炸与用户设想的2炸");
}
const whyNotBomb2Lines = whyNotBomb2Answer.text.split("\n").filter((line) => line.trim());
if (whyNotBomb2Lines.length > 5) {
  throw new Error(`炸弹取舍作答应不超过 5 行，实际 ${whyNotBomb2Lines.length} 行`);
}

// 级牌非 2：2炸<9炸，小炸够压应留大炸
const whyNotBomb4Answer = tryLocalCoachAnswer("这手为什么不用四个4压？", {
  status: "in-progress",
  levelRank: "5",
  turnNumber: 10,
  humanHand: [
    { rank: "4", suit: "S" }, { rank: "4", suit: "H" }, { rank: "4", suit: "C" }, { rank: "4", suit: "D" },
    { rank: "9", suit: "S" }, { rank: "9", suit: "H" }, { rank: "9", suit: "C" }, { rank: "9", suit: "D" },
  ],
  table: {
    lastActivePlay: { type: "Bomb", mainRank: "3", bombSize: 4, label: "炸弹 3" },
  },
  currentAdvice: {
    choices: [{
      play: { type: "Bomb", mainRank: "9", bombSize: 4, label: "炸弹 9" },
      reasons: ["只有炸弹能压，应抢牌权"],
    }],
  },
});
if (whyNotBomb4Answer?.mode !== "why-not-bomb") {
  throw new Error(`级牌5小炸追问应走 why-not-bomb，实际 ${whyNotBomb4Answer?.mode}`);
}
if (!whyNotBomb4Answer.text.includes("够压") || !whyNotBomb4Answer.text.includes("9")) {
  throw new Error("级牌5应说明四张4够压、保留9炸");
}
if (whyNotBomb4Answer.text.includes("不够稳")) {
  throw new Error("不应误判小炸不够稳");
}

// game-1 turn16：压大王用更小炸应判你更对
const game1BombDiv = classifyDivergence({
  actual: "炸弹 黑桃2 红桃2 红桃2 方片2",
  recommended: "炸弹 梅花9 梅花9 方片9 方片9",
  mustBeat: "大王",
  levelRank: "6",
  match: "outside-top-3",
  recommendedReasons: ["只有炸弹能压，应抢牌权"],
}, {
  choices: [{ play: { type: "Bomb", mainRank: "9" } }],
  actualPlay: { type: "Bomb", mainRank: "2" },
  levelRank: "6",
});
if (game1BombDiv.verdict !== DIVERGENCE_VERDICTS.USER_BETTER) {
  throw new Error(`turn16 压大王用小炸应判你更对，实际 ${game1BombDiv.verdict}`);
}

// game-1 turn28：8炸 vs 9炸压大王，suggestion-2 仍应判你更对
const game1Turn28Div = classifyDivergence({
  actual: "炸弹 黑桃8 梅花8 方片8 方片8",
  recommended: "炸弹 梅花9 梅花9 方片9 方片9",
  mustBeat: "大王",
  levelRank: "6",
  match: "suggestion-2",
  recommendedReasons: ["只有炸弹能压，应抢牌权"],
}, {
  choices: [{ play: { type: "Bomb", mainRank: "9" } }],
  actualPlay: { type: "Bomb", mainRank: "8" },
  levelRank: "6",
  mustBeat: { mainRank: "BJ" },
});
if (game1Turn28Div.verdict !== DIVERGENCE_VERDICTS.USER_BETTER) {
  throw new Error(`turn28 8炸压王应判你更对，实际 ${game1Turn28Div.verdict}`);
}

// game-1：残局接风顺子 vs 教练小单
const game1WindDiv = classifyDivergence({
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
if (game1WindDiv.verdict !== DIVERGENCE_VERDICTS.USER_BETTER) {
  throw new Error(`接风顺子应判你更对，实际 ${game1WindDiv.verdict}`);
}
if (!game1WindDiv.note.includes("拆小炸组顺")) {
  throw new Error(`应强调拆炸组顺，实际 ${game1WindDiv.note}`);
}

// game-2 turn48：纯炸五炸10压对5，用户过牌应判你更对
const game2PureBombDiv = classifyDivergence({
  actual: "过牌",
  recommended: "炸弹 黑桃10 黑桃10 梅花10 梅花10 方片10",
  mustBeat: "梅花5 黑桃5",
  handCount: 5,
  levelRank: "3",
  recommendedReasons: ["对手冲刺时需抢牌权", "能走完先走完"],
}, {
  choices: [{ play: { type: "Bomb", mainRank: "10" } }],
  actualPlay: { type: "Pass" },
  levelRank: "3",
});
if (game2PureBombDiv.verdict !== DIVERGENCE_VERDICTS.USER_BETTER) {
  throw new Error(`纯炸保留过牌应判你更对，实际 ${game2PureBombDiv.verdict}`);
}
if (!game2PureBombDiv.note.includes("纯炸保留")) {
  throw new Error(`应说明纯炸保留，实际 ${game2PureBombDiv.note}`);
}

// game-2 turn80：剩1张能走完，用户出单 vs 推荐过牌应判你更对
const game2LastCardDiv = classifyDivergence({
  actual: "单张 红桃J",
  recommended: "过牌",
  mustBeat: "方片8",
  handCount: 1,
  levelRank: "3",
  recommendedReasons: ["队友占牌，正常让牌"],
  match: "suggestion-2",
}, {
  choices: [{ play: { type: "Pass" } }],
  actualPlay: { type: "Single", mainRank: "J" },
  levelRank: "3",
});
if (game2LastCardDiv.verdict !== DIVERGENCE_VERDICTS.USER_BETTER) {
  throw new Error(`剩1张走完应判你更对，实际 ${game2LastCardDiv.verdict}`);
}
if (!game2LastCardDiv.note.includes("走完")) {
  throw new Error(`应说明走完优先，实际 ${game2LastCardDiv.note}`);
}

// game-1：只有炸弹能压时过牌应判教练更对
const game1PassDiv = classifyDivergence({
  actual: "过牌",
  recommended: "炸弹 梅花9 梅花9 方片9 方片9 黑桃9",
  mustBeat: "梅花4 方片4 方片4 红桃4 红桃4",
  levelRank: "6",
  recommendedReasons: ["只有炸弹能压，应抢牌权"],
}, {
  choices: [{ play: { type: "Bomb", mainRank: "9" } }],
  actualPlay: { type: "Pass" },
  levelRank: "6",
});
if (game1PassDiv.verdict !== DIVERGENCE_VERDICTS.COACH_BETTER) {
  throw new Error(`炸弹局面过牌应判教练更对，实际 ${game1PassDiv.verdict}`);
}

console.log("divergence 冒烟通过");
