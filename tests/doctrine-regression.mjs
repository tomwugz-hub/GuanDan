/**
 * 掼蛋教练教纲回归套件 — 每条场景对应一条可执行原则，CI 可跑。
 * 来源：用户反馈 coach-fix-queue / coach-questions / 对局复盘。
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isWildCard } from "../engine/card.mjs";
import {
  SUITS,
  PLAY_TYPES,
  classifyPlay,
  createCard,
  createGameStateFromHands,
  passTurn,
  generateBasicCandidates,
  recommendPlay,
  buildStrategicGroups,
  tryLocalCoachAnswer,
} from "../src/index.mjs";
import { playRecommendedTurn } from "../coach/robot-player.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { createInitialGameState } from "../engine/game-state.mjs";
import { scoreCandidate } from "../strategy/recommend.mjs";
import { evaluateHandProfile } from "../strategy/hand-profile.mjs";
import { loadMlPolicy } from "../strategy/ml-policy.mjs";

const regressionRoot = dirname(fileURLToPath(import.meta.url));

function loadTestMlModel() {
  const cached = loadMlPolicy();
  if (cached) return cached;
  const modelPath = join(regressionRoot, "../models/policy-v001/model.json");
  if (!existsSync(modelPath)) return null;
  return JSON.parse(readFileSync(modelPath, "utf8"));
}
import { DOCTRINE_SUMMARY, PRINCIPLE_DEFS } from "../strategy/principles.mjs";
import { explainPrincipleForQuestion } from "../strategy/principles.mjs";
import {
  detectDoctrineViolations,
  enforceDoctrineOnCandidates,
  DOCTRINE_HARD_PENALTY,
} from "../strategy/doctrine-enforce.mjs";
import { enrichScoringContext } from "../strategy/table-context.mjs";
import { canBeat } from "../engine/compare-play.mjs";

function cards(specs) {
  return specs.map(([rank, suit = SUITS.spades, deckIndex = 0]) => createCard(rank, suit, deckIndex));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const filler = cards([
  ["2", SUITS.clubs], ["2", SUITS.diamonds], ["9", SUITS.clubs], ["9", SUITS.diamonds],
  ["K", SUITS.clubs], ["K", SUITS.diamonds], ["J", SUITS.clubs], ["J", SUITS.diamonds],
]);

let passed = 0;

function scenario(id, principle, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${id} [${principle}]`);
}

console.log("doctrine-regression: 教纲", Object.keys(PRINCIPLE_DEFS).length, "条");
console.log(DOCTRINE_SUMMARY.slice(0, 3).join("\n"), "...\n");

// —— P1 散单优先 ——
scenario("P1-压单3有单Q→单Q", "P1", () => {
  const hand = cards([
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
  const prev = classifyPlay(cards([["3", SUITS.hearts]]), "5");
  let state = createGameStateFromHands({ levelRank: "5", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const rec = recommendPlay(hand, "5", prev, { state, playerIndex: 0, mlFusionMode: "off", mlModel: false });
  assert(rec.candidate.type === PLAY_TYPES.single && rec.candidate.mainRank === "Q", `应单Q，实际 ${rec.candidate.mainRank}`);
  assert(rec.reasons.some((r) => /P1|散/.test(r)), "应引用 P1");
});

scenario("P1-压单7有散单A→单A", "P1", () => {
  const hand = cards([
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
  const prev = classifyPlay(cards([["7", SUITS.diamonds, 1]]), "3");
  let state = createGameStateFromHands({ levelRank: "3", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const rec = recommendPlay(hand, "3", prev, { state, playerIndex: 0, mlFusionMode: "off", mlModel: false });
  assert(rec.candidate.type === PLAY_TYPES.single && rec.candidate.mainRank === "A", `应单A，实际 ${rec.candidate.mainRank}`);
  assert(rec.reasons.some((r) => /P1|散/.test(r)), "应引用 P1");
});

scenario("QA-拆对有单A不打", "P1", () => {
  const hand = cards([
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
  const prev = classifyPlay(cards([["7", SUITS.diamonds, 1]]), "3");
  const broken8 = generateBasicCandidates(hand, "3", prev)
    .find((c) => c.type === PLAY_TYPES.single && c.mainRank === "8");
  const qa = tryLocalCoachAnswer("为什么拆对，有单A不打？", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 24,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex, label: c.rank })),
    table: { lastActivePlay: prev },
    currentAdvice: { choices: [{ play: broken8, reasons: ["跟住对手单张"] }] },
  });
  assert(qa?.text.includes("拆对"), "应点明拆对");
  assert(qa?.text.includes("单A") || qa?.text.includes("散单A"), "应点明散单A");
  assert(qa?.text.includes("应出"), "应直接说应出单A");
  assert(qa?.text.includes("推荐偏了"), "应承认推荐偏了");
});

// —— P2 对子拆单 ——
scenario("P2-无散单拆对5", "P2", () => {
  const hand = cards([
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
  const prev = classifyPlay(cards([["3", SUITS.hearts]]), "A");
  let state = createGameStateFromHands({ levelRank: "A", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const rec = recommendPlay(hand, "A", prev, { state, playerIndex: 0, mlFusionMode: "off", mlModel: false });
  assert(rec.candidate.mainRank === "5", `应拆对5，实际单${rec.candidate.mainRank}`);
});

// —— P3 结构兜底 ——
scenario("P3-只剩钢板拆单6", "P3", () => {
  const hand = cards([
    ["6", SUITS.spades], ["6", SUITS.hearts], ["6", SUITS.diamonds],
    ["7", SUITS.spades], ["7", SUITS.hearts], ["7", SUITS.diamonds],
    ["4", SUITS.spades], ["4", SUITS.hearts], ["4", SUITS.clubs], ["4", SUITS.diamonds],
    ["3", SUITS.spades], ["3", SUITS.hearts],
    ["BJ", SUITS.joker],
  ]);
  const prev = classifyPlay(cards([["3", SUITS.hearts]]), "5");
  let state = createGameStateFromHands({ levelRank: "5", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const rec = recommendPlay(hand, "5", prev, { state, playerIndex: 0, mlFusionMode: "off", mlModel: false });
  assert(rec.candidate.type === PLAY_TYPES.single, "应出单张够压");
});

// —— P4 小牌不拆结构 ——
scenario("P4-拆钢板压3禁止", "P4", () => {
  const hand = cards([
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
  const prev = classifyPlay(cards([["3", SUITS.hearts]]), "5");
  const broken6 = generateBasicCandidates(hand, "5", prev)
    .find((c) => c.type === PLAY_TYPES.single && c.mainRank === "6");
  const qa = tryLocalCoachAnswer("为什么拆钢板压3？", {
    status: "in-progress", levelRank: "5", turnNumber: 8,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: prev },
    currentAdvice: { choices: [{ play: broken6, reasons: ["跟住对手单张"] }] },
  });
  assert(qa?.text.includes("应出") || qa?.text.includes("拆") || qa?.text.includes("推荐偏了"), "QA 应禁止拆钢板压3");
});

scenario("P4-又推荐拆钢板三带二", "P4", () => {
  const hand = cards([
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
  const prev = classifyPlay(cards([["3", SUITS.hearts]]), "3");
  const wrongTriple = {
    ...classifyPlay(
      cards([
        ["6", SUITS.clubs, 1], ["6", SUITS.spades, 0], ["6", SUITS.spades, 1],
        ["9", SUITS.clubs], ["9", SUITS.hearts],
      ]),
      "3",
    ),
    label: "三带二 梅花6 黑桃6 黑桃6 梅花9 红桃9",
  };
  const qa = tryLocalCoachAnswer("怎么又推荐拆钢板了？", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 8,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: prev },
    currentAdvice: {
      choices: [{ play: wrongTriple, reasons: ["拆三张6组其他牌型代价偏高"] }],
    },
  });
  assert(qa?.mode === "why-not-play", "又推荐拆钢板应走 why-not-play");
  assert(qa?.text.includes("拆") && qa?.text.includes("钢板"), "应点明推荐1拆钢板");
  assert(
    qa?.text.includes("推荐偏了") || qa?.text.includes("提过多次") || qa?.text.includes("应出"),
    "应承认偏了/又/给替代",
  );
  assert(
    qa?.text.includes("大王") || qa?.text.includes("单Q") || qa?.text.includes("散单")
      || qa?.text.includes("P1") || qa?.text.includes("P4"),
    "应引用原则或给够压替代",
  );
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const rec = recommendPlay(hand, "3", prev, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.single && !["6", "7"].includes(rec.candidate.mainRank),
    `压小单3应出单张不拆钢板，实际 ${rec.candidate.label ?? rec.candidate.mainRank}`,
  );
});

scenario("QA-meta推荐偏了不必照抄", "P5", () => {
  const hand = cards([
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
  const wrongTriple = {
    ...classifyPlay(
      cards([
        ["6", SUITS.clubs, 1], ["6", SUITS.spades, 0], ["6", SUITS.spades, 1],
        ["9", SUITS.clubs], ["9", SUITS.hearts],
      ]),
      "3",
    ),
    label: "三带二 666+99",
  };
  const qa = tryLocalCoachAnswer("推荐偏了，不必照抄", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 0,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: null },
    currentAdvice: { choices: [{ play: wrongTriple, reasons: ["减手"] }] },
  });
  assert(qa?.mode === "why-not-play", "meta 应走 why-not-play 非 brief");
  assert(qa?.text.includes("拆") && qa?.text.includes("钢板"), "应点明推荐1拆钢板6-7");
  assert(qa?.text.includes("推荐偏了") || qa?.text.includes("不必照抄"), "应承认偏了");
  assert(qa?.text.includes("P5") || qa?.text.includes("成组减手") || qa?.text.includes("钢板"), "应引用 P5 或钢板减手");
  assert(!qa?.text.includes("规则备忘"), "不应落入 brief 泛答");
});

// —— P5 成组减手 ——
scenario("P5-接风钢板", "P5", () => {
  const hand = cards([
    ["7", SUITS.clubs], ["7", SUITS.diamonds], ["7", SUITS.hearts],
    ["8", SUITS.hearts], ["8", SUITS.spades],
    ["9", SUITS.clubs], ["9", SUITS.diamonds],
    ["2", SUITS.clubs], ["2", SUITS.diamonds],
    ["K", SUITS.spades], ["K", SUITS.hearts],
  ]);
  let state = createGameStateFromHands({
    levelRank: "A",
    hands: [hand, cards([["3"]]), cards([["4"]]), cards([["5"]])],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: null,
    lastActivePlayerIndex: null,
    playHistory: [
      { turnNumber: 1, playerIndex: 0, play: classifyPlay(cards([["6", SUITS.hearts], ["6", SUITS.clubs]]), "A") },
      { turnNumber: 2, playerIndex: 1, play: classifyPlay([], "A") },
      { turnNumber: 3, playerIndex: 2, play: classifyPlay([], "A") },
      { turnNumber: 4, playerIndex: 3, play: classifyPlay([], "A") },
    ],
  };
  const rec = recommendPlay(hand, "A", null, {
    state, playerIndex: 0,
    preferredGroups: buildStrategicGroups(hand, "A"),
    mlFusionMode: "off", mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.consecutivePairs && rec.candidate.length >= 6,
    `应钢板/连对，实际 ${rec.candidate.type}`,
  );
});

scenario("P5-接风双钢板", "P5", () => {
  const hand = cards([
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
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: null, playHistory: [] };
  const rec = recommendPlay(hand, "3", null, {
    state,
    playerIndex: 0,
    preferredGroups: buildStrategicGroups(hand, "3"),
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.plane && rec.candidate.length >= 6,
    `双钢板 turn0 应首推钢板，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
  const wrongTriple = {
    ...classifyPlay(
      cards([
        ["6", SUITS.spades, 0], ["6", SUITS.hearts, 0], ["6", SUITS.clubs, 0],
        ["9", SUITS.spades, 0], ["9", SUITS.diamonds, 0],
      ]),
      "3",
    ),
    label: "三带二 666+99",
  };
  const qa = tryLocalCoachAnswer("怎么又推荐拆钢板了？", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 0,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: null },
    currentAdvice: { choices: [{ play: wrongTriple, reasons: ["拆三张6组其他牌型代价偏高"] }] },
  });
  assert(qa?.text.includes("P5") || qa?.text.includes("接风"), "接风双钢板 QA 应走 P5");
  assert(!qa?.text.includes("压场上单张"), "接风 QA 不应说压单");
  assert(qa?.text.includes("推荐偏了") || qa?.text.includes("钢板"), "应点明拆钢板并给替代");
});

// —— P6 王回收试探 ——
scenario("P6-接风单7+大王", "P6", () => {
  const hand = cards([
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
  let state = createGameStateFromHands({
    levelRank: "6",
    hands: [hand, cards([["3"]]), cards([["4"]]), cards([["5"]])],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: null,
    lastActivePlayerIndex: null,
    playHistory: [
      { turnNumber: 1, playerIndex: 0, play: classifyPlay(cards([["3", SUITS.hearts], ["3", SUITS.diamonds]]), "6") },
      { turnNumber: 2, playerIndex: 1, play: classifyPlay([], "6") },
      { turnNumber: 3, playerIndex: 2, play: classifyPlay([], "6") },
      { turnNumber: 4, playerIndex: 3, play: classifyPlay([], "6") },
    ],
  };
  const rec = recommendPlay(hand, "6", null, {
    state, playerIndex: 0,
    preferredGroups: buildStrategicGroups(hand, "6"),
    mlFusionMode: "off", mlModel: false,
  });
  assert(rec.candidate.type === PLAY_TYPES.single && rec.candidate.mainRank === "7", `应单7试探，实际 ${rec.candidate.mainRank}`);
});

// —— P7 最小够压炸 ——
scenario("P7-压王最小四炸", "P7", () => {
  const hand = cards([
    ["4", SUITS.spades], ["4", SUITS.hearts], ["4", SUITS.clubs], ["4", SUITS.diamonds],
    ["6", SUITS.spades], ["6", SUITS.hearts], ["6", SUITS.clubs], ["6", SUITS.diamonds],
    ["8", SUITS.spades], ["8", SUITS.hearts], ["8", SUITS.clubs], ["8", SUITS.diamonds],
    ["3", SUITS.spades],
  ]);
  const prev = classifyPlay(cards([["BJ", SUITS.joker]]), "5");
  let state = createGameStateFromHands({ levelRank: "5", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const rec = recommendPlay(hand, "5", prev, { state, playerIndex: 0, mlFusionMode: "off", mlModel: false });
  assert(rec.candidate.type === PLAY_TYPES.bomb && rec.candidate.mainRank === "4", `应四炸4，实际 ${rec.candidate.mainRank}`);
});

scenario("P7-why-not-bomb-2vs9按级牌", "P7", () => {
  const lead = explainPrincipleForQuestion("为什么用9不用2压？", { levelRank: "5" });
  assert(lead?.codes.includes("P7"), "问句应映射 P7");
  assert(lead.lines.some((l) => /级牌|最小炸/.test(l)), "应说明级牌序");
});

// —— P7 纯四炸不用逢人配 ——
scenario("P7-4444+逢人配压王→四炸", "P7", () => {
  const hand = cards([
    ["4", SUITS.spades], ["4", SUITS.hearts], ["4", SUITS.clubs], ["4", SUITS.diamonds],
    ["3", SUITS.hearts],
    ["6", SUITS.clubs], ["7", SUITS.hearts], ["8", SUITS.spades],
    ["9", SUITS.clubs], ["10", SUITS.diamonds],
    ["J", SUITS.spades], ["Q", SUITS.clubs], ["K", SUITS.hearts],
    ["A", SUITS.diamonds], ["2", SUITS.clubs], ["5", SUITS.spades],
    ["6", SUITS.diamonds], ["7", SUITS.clubs],
  ]);
  const prev = classifyPlay(cards([["SJ", SUITS.joker]]), "3");
  const wildFiller = cards([
    ["8", SUITS.clubs], ["9", SUITS.hearts], ["10", SUITS.spades],
    ["J", SUITS.diamonds], ["Q", SUITS.hearts], ["K", SUITS.diamonds],
    ["A", SUITS.spades], ["2", SUITS.hearts], ["5", SUITS.clubs],
  ]);
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [wildFiller, wildFiller, hand, wildFiller],
    currentPlayerIndex: 2,
  });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 3 };
  const rec = recommendPlay(hand, "3", prev, { state, playerIndex: 2, mlFusionMode: "off", mlModel: false });
  assert(rec.candidate.mainRank === "4" && (rec.candidate.bombSize ?? 0) === 4, "应纯四炸");
  assert(!rec.candidate.cards.some((c) => c.rank === "3" && c.suit === SUITS.hearts), "不应含逢人配");
});

// —— P8 逢人配 ——
scenario("P8-逢人配问句映射", "P8", () => {
  const lead = explainPrincipleForQuestion("逢人配应该首选配同花顺", { levelRank: "2" });
  assert(lead?.codes.includes("P8"), "逢人配问句应映射 P8");
});

// —— P9 整炸不拆三带二 ——
scenario("P9-应打三带二不要拆炸", "P9", () => {
  const lead = explainPrincipleForQuestion("应打三带二不要拆炸", { levelRank: "2" });
  assert(lead?.codes.includes("P9"), "应映射 P9");
});

scenario("P9-四张A不拆炸三带二", "P9", () => {
  const hand = cards([
    ["A"], ["A", SUITS.hearts], ["A", SUITS.clubs], ["A", SUITS.diamonds],
    ["4"], ["4", SUITS.diamonds],
    ["J"], ["J", SUITS.clubs],
    ["6"], ["6", SUITS.hearts],
    ["5"], ["5", SUITS.spades],
    ["3"], ["3", SUITS.clubs],
  ]);
  const prev = classifyPlay(cards([
    ["K", SUITS.diamonds], ["K", SUITS.hearts], ["K", SUITS.spades],
    ["6", SUITS.diamonds, 1], ["6", SUITS.clubs, 1],
  ]), "2");
  let state = createGameStateFromHands({
    levelRank: "2",
    hands: [hand, cards([["3"]]), cards([["4"]]), cards([["5", SUITS.clubs]])],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const rec = recommendPlay(hand, "2", prev, {
    state, playerIndex: 0,
    preferredGroups: buildStrategicGroups(hand, "2"),
    mlFusionMode: "off", mlModel: false,
  });
  assert(
    !(rec.candidate.type === PLAY_TYPES.tripleWithPair && rec.candidate.mainRank === "A"),
    `有四炸A不得首推拆A三带二，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
  assert(rec.reasons.some((r) => /P9|整炸|不拆/.test(r)) || rec.candidate.type !== PLAY_TYPES.tripleWithPair,
    "应引用 P9 或避开拆炸三带二");
});

// —— P8 逢人配高用途 ——
scenario("P8-开局逢人配不首推三带二", "P8", () => {
  const hand = cards([
    ["3", SUITS.clubs], ["3", SUITS.diamonds],
    ["2", SUITS.hearts],
    ["4", SUITS.clubs], ["4", SUITS.hearts],
    ["5", SUITS.clubs], ["5", SUITS.hearts],
    ["7", SUITS.spades], ["7", SUITS.clubs], ["7", SUITS.diamonds], ["7", SUITS.hearts, 1],
    ["K", SUITS.spades], ["K", SUITS.clubs],
    ["A", SUITS.spades],
  ]);
  let state = createGameStateFromHands({
    levelRank: "2",
    hands: [hand, cards([["6"]]), cards([["8"]]), cards([["9"]])],
    currentPlayerIndex: 0,
  });
  const rec = recommendPlay(hand, "2", null, {
    state, playerIndex: 0,
    preferredGroups: buildStrategicGroups(hand, "2"),
    mlFusionMode: "off", mlModel: false,
  });
  const lowValueWild = [PLAY_TYPES.tripleWithPair, PLAY_TYPES.pair, PLAY_TYPES.triple].includes(rec.candidate.type)
    && (rec.candidate.cards ?? []).some((card) => isWildCard(card, "2"));
  assert(!lowValueWild, `开局逢人配不宜配三带二/对子，实际 ${rec.candidate.label ?? rec.candidate.type}`);
});

// —— P11 报单封门 ——
scenario("P11-报单级牌压单", "P11", () => {
  const hand = cards([["9", SUITS.hearts, 1], ["3", SUITS.diamonds]]);
  const prev = classifyPlay(cards([["6", SUITS.diamonds]]), "3");
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, cards([["Q"]]), cards([["4"], ["5"]]), cards([["7"], ["8"]])],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: prev,
    lastActivePlayerIndex: 1,
    players: state.players.map((player, index) => {
      if (index === 1) return { ...player, hand: cards([["Q"]]) };
      if (index === 2) return { ...player, hand: cards([["4"], ["5"]]), finishedOrder: 1 };
      return player;
    }),
  };
  const rec = recommendPlay(hand, "3", prev, {
    state, playerIndex: 0, lastActivePlayerIndex: 1,
    preferredGroups: buildStrategicGroups(hand, "3"),
    mlFusionMode: "off", mlModel: false,
  });
  assert(rec.candidate.type === PLAY_TYPES.single && rec.candidate.mainRank === "3",
    `报单应级牌3压单6，实际 ${rec.candidate.label ?? rec.candidate.mainRank}`);
  assert(rec.reasons.some((r) => /报单|级牌|P11/.test(r)), "应说明报单封门");
});

// —— P10 队友让牌 ——
scenario("P10-队友已炸应过牌", "P10", () => {
  const robotPartnerBomb = classifyPlay(
    cards([["5", SUITS.spades], ["5", SUITS.hearts], ["5", SUITS.clubs], ["5", SUITS.diamonds]]),
    "3",
  );
  const robotUserHand = cards([
    ["5", SUITS.hearts], ["6", SUITS.spades], ["7", SUITS.spades],
    ["9", SUITS.clubs], ["9", SUITS.diamonds], ["9", SUITS.diamonds, 1],
    ["K", SUITS.hearts], ["Q", SUITS.hearts], ["J", SUITS.hearts], ["10", SUITS.hearts],
    ["8", SUITS.diamonds], ["8", SUITS.clubs], ["4", SUITS.diamonds], ["4", SUITS.hearts],
    ["A", SUITS.diamonds], ["A", SUITS.hearts], ["2", SUITS.diamonds], ["2", SUITS.hearts],
    ["6", SUITS.clubs], ["7", SUITS.clubs], ["3", SUITS.spades], ["3", SUITS.diamonds],
    ["K", SUITS.diamonds], ["Q", SUITS.diamonds], ["J", SUITS.diamonds], ["10", SUITS.diamonds],
    ["4", SUITS.clubs],
  ]);
  const robotFiller = cards([
    ["2", SUITS.diamonds], ["2", SUITS.hearts], ["K", SUITS.clubs], ["K", SUITS.hearts],
    ["Q", SUITS.clubs], ["Q", SUITS.hearts], ["J", SUITS.clubs], ["J", SUITS.hearts],
    ["10", SUITS.clubs], ["10", SUITS.hearts], ["8", SUITS.diamonds], ["8", SUITS.hearts],
    ["4", SUITS.diamonds], ["4", SUITS.hearts], ["A", SUITS.diamonds], ["A", SUITS.hearts],
    ["6", SUITS.spades], ["7", SUITS.spades], ["3", SUITS.diamonds], ["3", SUITS.spades],
    ["4", SUITS.clubs], ["5", SUITS.diamonds], ["6", SUITS.hearts], ["7", SUITS.clubs],
    ["8", SUITS.clubs], ["9", SUITS.clubs], ["10", SUITS.diamonds],
  ]);
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [robotUserHand, robotFiller, robotFiller, robotFiller],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: robotPartnerBomb,
    lastActivePlayerIndex: 2,
    playHistory: [
      { turnNumber: 1, playerIndex: 0, play: classifyPlay(cards([["5", SUITS.diamonds]]), "3") },
      { turnNumber: 2, playerIndex: 1, play: classifyPlay([], "3") },
      { turnNumber: 3, playerIndex: 2, play: robotPartnerBomb },
      { turnNumber: 4, playerIndex: 3, play: classifyPlay([], "3") },
    ],
  };
  const turn = playRecommendedTurn(state, { mlFusionMode: "off", mlModel: false, lite: true });
  assert(turn.recommendation.candidate.type === PLAY_TYPES.pass, "队友已炸应过牌");
});

scenario("P10-game2-老史出A纯五炸J应过牌", "P10", () => {
  const hand = cards([
    ["J", SUITS.clubs, 0], ["J", SUITS.clubs, 1], ["J", SUITS.diamonds, 0],
    ["J", SUITS.spades, 0], ["J", SUITS.spades, 1],
  ]);
  const prev = classifyPlay(cards([["A", SUITS.clubs, 0]]), "3");
  const partnerHand = cards([["K", SUITS.hearts, 0], ["K", SUITS.spades, 1]]);
  const oppHand = cards([
    ["2", SUITS.clubs, 1], ["2", SUITS.spades, 0], ["8", SUITS.clubs, 1], ["Q", SUITS.spades, 0],
  ]);
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, oppHand, partnerHand, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 2, passCount: 1 };
  const rec = recommendPlay(hand, "3", prev, {
    state,
    playerIndex: 0,
    lastActivePlayerIndex: 2,
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.pass,
    `game-2 老史出A纯五炸J应过牌，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
  assert(rec.reasons.some((r) => /队友占牌|P10|纯炸保留/.test(r)), `应说明让牌，实际 ${rec.reasons.join("；")}`);
});

scenario("P10-game2-队友出对3五炸J应过牌", "P10", () => {
  const hand = cards([
    ["J", SUITS.clubs, 0], ["J", SUITS.clubs, 1], ["J", SUITS.diamonds, 0],
    ["J", SUITS.spades, 0], ["J", SUITS.spades, 1],
    ["SJ", SUITS.joker, 0], ["SJ", SUITS.joker, 1],
    ["2", SUITS.diamonds, 1],
  ]);
  const prev = classifyPlay(cards([["3", SUITS.spades, 1], ["3", SUITS.hearts, 0]]), "3");
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 2 };
  const rec = recommendPlay(hand, "3", prev, {
    state,
    playerIndex: 0,
    lastActivePlayerIndex: 2,
    mlFusionMode: "on",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.pass,
    `game-2 队友出对3五炸J应过牌，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
});

scenario("P10-game2-turn80-剩1张应走完", "P10", () => {
  const hand = cards([["J", SUITS.hearts, 1]]);
  const prev = classifyPlay(cards([["8", SUITS.diamonds, 1]]), "3");
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 2, passCount: 1 };
  const rec = recommendPlay(hand, "3", prev, {
    state,
    playerIndex: 0,
    lastActivePlayerIndex: 2,
    mlFusionMode: "on",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.single && rec.candidate.mainRank === "J",
    `game-2 turn80 应单J走完，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
  assert(
    rec.reasons.some((r) => /能走完|不必让队友/.test(r)),
    `应说明走完优先，实际 ${rec.reasons.join("；")}`,
  );
  const qa = tryLocalCoachAnswer("我就剩一张了，该不该过牌让队友？", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 80,
    humanPlayerIndex: 0,
    partnerIndex: 2,
    playerNames: ["你", "勇哥", "老史", "毛蛋"],
    state,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: prev, lastActivePlayerIndex: 2 },
    currentAdvice: { choices: [{ play: rec.candidate, reasons: rec.reasons }] },
  });
  assert(/走完|头游|不必让/.test(qa.text), `QA 应认同直接走完，实际 ${qa.text.slice(0, 120)}`);
});

scenario("QA-game2-压队友专问", "P10", () => {
  const hand = cards([
    ["J", SUITS.clubs, 0], ["J", SUITS.clubs, 1], ["J", SUITS.diamonds, 0],
    ["J", SUITS.spades, 0], ["J", SUITS.spades, 1],
  ]);
  const prev = classifyPlay(cards([["A", SUITS.clubs, 0]]), "3");
  const fiveBomb = classifyPlay(hand, "3");
  const qa = tryLocalCoachAnswer("我为什么要压队友的牌？", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 60,
    humanPlayerIndex: 0,
    partnerIndex: 2,
    playerNames: ["你", "勇哥", "老史", "毛蛋"],
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: prev, lastActivePlayerIndex: 2 },
    currentAdvice: {
      choices: [{ play: fiveBomb, reasons: ["只有炸弹能压，应抢牌权"] }],
    },
  });
  assert(qa?.mode === "why-beat-partner", `压队友专问路由，实际 ${qa?.mode}`);
  assert(/P10|不应压队友|过牌/.test(qa.text), "应说明 P10 让牌");
  assert(!/暂未识别/.test(qa.text), "不应落入 fallback");
});

scenario("QA-game2-五炸不必急专问", "P10", () => {
  const hand = cards([
    ["J", SUITS.clubs, 0], ["J", SUITS.clubs, 1], ["J", SUITS.diamonds, 0],
    ["J", SUITS.spades, 0], ["J", SUITS.spades, 1],
  ]);
  const prev = classifyPlay(cards([["A", SUITS.clubs, 0]]), "3");
  const fiveBomb = classifyPlay(hand, "3");
  const question = "老史出A，教练让我打五个J，不用着急吧，可能老史能先走，或者他有两张单排，会再出一张，被勇哥压，我再打炸，给老史接风";
  const qa = tryLocalCoachAnswer(question, {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 60,
    humanPlayerIndex: 0,
    partnerIndex: 2,
    playerNames: ["你", "勇哥", "老史", "毛蛋"],
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: prev, lastActivePlayerIndex: 2 },
    currentAdvice: {
      choices: [{ play: fiveBomb, reasons: ["只有炸弹能压，应抢牌权"] }],
    },
  });
  assert(qa?.mode === "why-not-rush-bomb", `五炸不必急专问，实际 ${qa?.mode}`);
  assert(/P10|过牌|节奏/.test(qa.text), "应认同用户节奏");
  assert(/接风|勇哥/.test(qa.text), "应回应团队节奏");
  assert(!/P5.*成组减手|P6.*王回收/.test(qa.text), "不应答非所问 P5/P6");
});

function buildGame2Turn72State() {
  const hand = cards([
    ["J", SUITS.spades, 0], ["J", SUITS.spades, 1], ["J", SUITS.clubs, 0],
    ["J", SUITS.clubs, 1], ["J", SUITS.diamonds, 0],
  ]);
  const oppHand = cards([
    ["2", SUITS.clubs, 1], ["2", SUITS.spades, 0], ["8", SUITS.clubs, 1], ["Q", SUITS.spades, 0],
  ]);
  const partnerHand = cards([["K", SUITS.spades, 1]]);
  const maoHand = cards([
    ["2", SUITS.hearts, 0], ["9", SUITS.clubs, 0], ["9", SUITS.hearts, 1], ["9", SUITS.spades, 0],
    ["10", SUITS.clubs, 0], ["10", SUITS.hearts, 0], ["10", SUITS.spades, 0],
    ["Q", SUITS.clubs, 0], ["Q", SUITS.clubs, 1], ["K", SUITS.clubs, 1],
    ["SJ", SUITS.joker, 1], ["BJ", SUITS.joker, 1],
  ]);
  const prev = classifyPlay(cards([["A", SUITS.diamonds, 0]]), "3");
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, oppHand, partnerHand, maoHand],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 3, passCount: 2 };
  return { hand, prev, state };
}

scenario("P5-game2-turn72-纯五炸J压单A", "P5", () => {
  const { hand, prev, state } = buildGame2Turn72State();
  const rec = recommendPlay(hand, "3", prev, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.bomb && (rec.candidate.bombSize ?? rec.candidate.cards?.length) === 5,
    `game-2 turn72 应满张五炸J，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
  assert(
    rec.reasons.some((r) => /队友冲刺|接风|能走完/.test(r)),
    `应说明冲刺夺权，实际 ${rec.reasons.join("；")}`,
  );
  const advice = getTurnAdvice(state, 0, { mlFusionMode: "off", mlModel: null });
  const top3 = advice.alternatives.slice(0, 3);
  assert(
    !top3.some((item) => item.candidate.type === PLAY_TYPES.bomb && item.candidate.length === 4),
    "Top3 不得出现拆四炸J",
  );
});

scenario("QA-game2-turn72-队友剩1张应炸", "P5", () => {
  const { hand, prev, state } = buildGame2Turn72State();
  const passPlay = classifyPlay([], "3");
  const qa = tryLocalCoachAnswer("老史只剩一张了，我该炸掉夺权给他接风吗？", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 72,
    humanPlayerIndex: 0,
    partnerIndex: 2,
    playerNames: ["你", "勇哥", "老史", "毛蛋"],
    state,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: prev, lastActivePlayerIndex: 3 },
    currentAdvice: {
      choices: [{ play: passPlay, reasons: ["纯炸保留，对手余牌尚多，等关键控权/队友接风"] }],
    },
  });
  assert(qa?.mode === "partner-sprint-bomb", `队友冲刺专问，实际 ${qa?.mode}`);
  assert(/立即|应.*炸|满张五炸/.test(qa.text), "应主张立即五炸");
  assert(/拆.*四炸|勿拆/.test(qa.text), "应禁止拆四炸");
  assert(!/不必着急|牌局尚早/.test(qa.text), "不应落入不必急模板");
});

// —— P12 机器人节制炸 ——
scenario("P12-机器人小单5不过炸", "P12", () => {
  const lead = classifyPlay(cards([["5", SUITS.diamonds]]), "3");
  const oppHand = cards([
    ["6", SUITS.clubs],
    ["7", SUITS.hearts],
    ["5", SUITS.spades], ["5", SUITS.hearts], ["5", SUITS.clubs], ["3", SUITS.hearts],
    ["9", SUITS.spades], ["9", SUITS.hearts], ["9", SUITS.clubs], ["9", SUITS.diamonds], ["9", SUITS.diamonds, 1],
    ["K", SUITS.spades], ["Q", SUITS.spades], ["J", SUITS.spades], ["10", SUITS.spades],
    ["8", SUITS.spades], ["8", SUITS.clubs], ["4", SUITS.spades], ["4", SUITS.clubs],
    ["A", SUITS.spades], ["A", SUITS.clubs], ["2", SUITS.spades], ["2", SUITS.clubs],
    ["6", SUITS.diamonds], ["7", SUITS.diamonds], ["3", SUITS.clubs],
  ]);
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [filler, oppHand, filler, filler],
    currentPlayerIndex: 1,
  });
  state = { ...state, lastActivePlay: lead, lastActivePlayerIndex: 0 };
  const turn = playRecommendedTurn(state, { mlFusionMode: "off", mlModel: false, lite: true });
  assert(turn.recommendation.candidate.type !== PLAY_TYPES.bomb, "小单5不应炸");
});

scenario("P12-机器人三带二不五炸", "P12", () => {
  const oppTriple9 = classifyPlay(cards([
    ["9", SUITS.diamonds], ["9", SUITS.hearts], ["9", SUITS.clubs],
    ["2", SUITS.diamonds], ["2", SUITS.hearts],
  ]), "3");
  const laoshiHand = cards([
    ["5", SUITS.spades], ["5", SUITS.hearts], ["5", SUITS.clubs], ["5", SUITS.diamonds], ["3", SUITS.hearts],
    ["6", SUITS.clubs], ["7", SUITS.hearts], ["8", SUITS.spades],
    ["4", SUITS.spades], ["4", SUITS.clubs], ["6", SUITS.diamonds], ["7", SUITS.diamonds],
    ["8", SUITS.clubs], ["10", SUITS.clubs], ["J", SUITS.clubs], ["K", SUITS.clubs],
    ["A", SUITS.clubs], ["2", SUITS.diamonds], ["2", SUITS.hearts], ["3", SUITS.clubs], ["3", SUITS.diamonds], ["10", SUITS.spades],
  ]);
  const smallFiller = cards([["Q", SUITS.spades], ["K", SUITS.spades], ["A", SUITS.spades], ["J", SUITS.spades]]);
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [smallFiller, smallFiller, laoshiHand, smallFiller],
    currentPlayerIndex: 2,
  });
  state = { ...state, lastActivePlay: oppTriple9, lastActivePlayerIndex: 1 };
  const turn = playRecommendedTurn(state, { mlFusionMode: "off", mlModel: false, lite: true });
  const c = turn.recommendation.candidate;
  assert(
    !(c.type === PLAY_TYPES.bomb && c.mainRank === "5" && (c.bombSize ?? 0) >= 5),
    "三带二局面不应五炸",
  );
});

scenario("P4-game2-纯炸五炸10压对5应过牌", "P4", () => {
  const hand = cards([
    ["10", SUITS.spades, 0], ["10", SUITS.spades, 1],
    ["10", SUITS.clubs, 0], ["10", SUITS.clubs, 1],
    ["10", SUITS.diamonds, 1],
  ]);
  const prev = classifyPlay(cards([["5", SUITS.clubs, 0], ["5", SUITS.spades, 0]]), "3");
  const opp12 = cards([
    ["6", SUITS.hearts], ["7", SUITS.hearts], ["8", SUITS.hearts],
    ["9", SUITS.hearts], ["J", SUITS.hearts], ["Q", SUITS.hearts],
    ["K", SUITS.hearts], ["A", SUITS.hearts], ["2", SUITS.hearts],
    ["3", SUITS.diamonds], ["4", SUITS.diamonds], ["5", SUITS.diamonds],
  ]);
  const partner14 = cards([
    ["6", SUITS.clubs], ["6", SUITS.diamonds], ["7", SUITS.clubs], ["7", SUITS.diamonds],
    ["8", SUITS.clubs], ["8", SUITS.diamonds], ["9", SUITS.clubs], ["9", SUITS.diamonds],
    ["J", SUITS.clubs], ["J", SUITS.diamonds], ["Q", SUITS.clubs], ["Q", SUITS.diamonds],
    ["K", SUITS.clubs], ["K", SUITS.diamonds],
  ]);
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, opp12, partner14, opp12],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const rec = recommendPlay(hand, "3", prev, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.pass,
    `COACH-FIX 第48手类：纯炸五炸10压对5应过牌，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
  assert(
    rec.reasons.some((r) => /纯炸保留|对手余牌尚多/.test(r)),
    `应说明纯炸保留，实际 ${rec.reasons.join("；")}`,
  );
  const passScore = scoreCandidate(classifyPlay([], "3"), hand, "3", prev, {
    ...enrichScoringContext({ state, playerIndex: 0, previousPlay: prev, lastActivePlayerIndex: 1 },
      generateBasicCandidates(hand, "3", prev), hand, "3"),
    hand,
  });
  const fiveBomb = classifyPlay(hand, "3");
  const bombScore = scoreCandidate(fiveBomb, hand, "3", prev, {
    ...enrichScoringContext({ state, playerIndex: 0, previousPlay: prev, lastActivePlayerIndex: 1 },
      generateBasicCandidates(hand, "3", prev), hand, "3"),
    hand,
  });
  assert(passScore.score < bombScore.score, "过牌得分应优于五炸");
});

scenario("P4-game2-turn40-纯五炸4压四炸3应过牌", "P4", () => {
  const hand = cards([
    ["4", SUITS.clubs, 1], ["4", SUITS.diamonds, 0], ["4", SUITS.diamonds, 1],
    ["4", SUITS.hearts, 0], ["4", SUITS.spades, 1],
  ]);
  const prev = classifyPlay(cards([
    ["3", SUITS.clubs, 0], ["3", SUITS.clubs, 1], ["3", SUITS.hearts, 1], ["3", SUITS.spades, 0],
  ]), "2");
  const yongge12 = cards([
    ["6", SUITS.hearts], ["7", SUITS.hearts], ["8", SUITS.hearts], ["9", SUITS.hearts],
    ["J", SUITS.hearts], ["Q", SUITS.hearts], ["K", SUITS.hearts], ["A", SUITS.hearts],
    ["2", SUITS.hearts], ["5", SUITS.diamonds], ["6", SUITS.diamonds], ["7", SUITS.diamonds],
  ]);
  const laoshi9 = cards([
    ["8", SUITS.clubs], ["9", SUITS.clubs], ["10", SUITS.clubs], ["J", SUITS.clubs],
    ["Q", SUITS.clubs], ["K", SUITS.clubs], ["A", SUITS.clubs], ["2", SUITS.clubs], ["5", SUITS.clubs],
  ]);
  const maodan4 = cards([["6", SUITS.spades], ["7", SUITS.spades], ["8", SUITS.spades], ["9", SUITS.spades]]);
  let state = createGameStateFromHands({
    levelRank: "2",
    hands: [hand, yongge12, laoshi9, maodan4],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const rec = recommendPlay(hand, "2", prev, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.pass,
    `game-2 turn40 纯五炸4压四炸3应过牌，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
  assert(
    rec.reasons.some((r) => /纯炸保留|对手余牌尚多/.test(r)),
    `应说明纯炸保留，实际 ${rec.reasons.join("；")}`,
  );
});

scenario("须压单J-同花顺组内逢人配散单应抢权不过牌", "P1-sf-loose", () => {
  const session = JSON.parse(readFileSync(join(regressionRoot, "../training-samples/active-session.json"), "utf8"));
  const gameState = session.state;
  assert(
    gameState.lastActivePlay?.type === PLAY_TYPES.single
      && gameState.lastActivePlay?.mainRank === "J",
    "active-session 须为勇哥单J局面",
  );
  const advice = getTurnAdvice(gameState, 0, {
    alternatives: 3,
    mlFusionMode: "smart",
    mlModel: loadTestMlModel(),
    maxCandidates: 96,
  });
  const top = advice.recommendation.candidate;
  assert(
    top.type !== PLAY_TYPES.pass && top.type !== PLAY_TYPES.bomb,
    `须压单J时不应首推过牌或炸弹，实际 ${top.label ?? top.type}`,
  );
  assert(
    top.type === PLAY_TYPES.single && top.mainRank === "Q",
    `须压单J应首推最小对子拆单Q，不宜逢人配/王，实际 ${top.label ?? top.type}`,
  );
  for (const alt of advice.alternatives) {
    if (alt.candidate.type === PLAY_TYPES.bomb) {
      throw new Error(`备选不应推荐炸弹压单J：${alt.candidate.label}`);
    }
  }
});

scenario("须压四炸10-无更大炸不应推三张9或小炸5", "R-stale-bomb", () => {
  const hand = cards([
    ["9", SUITS.clubs], ["9", SUITS.clubs, 1], ["9", SUITS.diamonds],
    ["5", SUITS.clubs], ["5", SUITS.diamonds], ["5", SUITS.hearts], ["5", SUITS.spades],
    ["4", SUITS.hearts], ["4", SUITS.hearts, 1],
    ["K", SUITS.hearts], ["K", SUITS.clubs],
    ["J", SUITS.spades], ["Q", SUITS.spades], ["A", SUITS.spades],
    ["6", SUITS.hearts], ["8", SUITS.diamonds], ["J", SUITS.hearts],
    ["Q", SUITS.hearts], ["A", SUITS.clubs], ["3", SUITS.spades],
    ["SJ", SUITS.joker], ["BJ", SUITS.joker],
    ["7", SUITS.clubs], ["7", SUITS.diamonds], ["2", SUITS.clubs], ["2", SUITS.diamonds],
    ["10", SUITS.clubs, 2],
  ]);
  const bomb10 = classifyPlay(cards([
    ["10", SUITS.clubs], ["10", SUITS.diamonds], ["10", SUITS.hearts], ["10", SUITS.spades],
  ]), "3");
  let gameState = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  gameState = { ...gameState, lastActivePlay: bomb10, lastActivePlayerIndex: 1 };

  const advice = getTurnAdvice(gameState, 0, { alternatives: 3, mlFusionMode: "off", mlModel: null, maxCandidates: 96 });
  const topPlay = classifyPlay(advice.recommendation.candidate.cards ?? [], "3");
  assert(
    topPlay.type === PLAY_TYPES.pass || canBeat(topPlay, bomb10),
    `须压四炸10时首推应为过牌或更大炸，实际 ${advice.recommendation.candidate.label ?? topPlay.type}`,
  );
  for (const alt of [advice.recommendation, ...advice.alternatives]) {
    const play = classifyPlay(alt.candidate.cards ?? [], "3");
    if (play.type === PLAY_TYPES.pass) continue;
    assert(
      canBeat(play, bomb10),
      `须压四炸10时不应推荐不能压的 ${alt.candidate.label ?? play.type}`,
    );
  }
});

scenario("P12-仅炸弹可压过牌优于五炸", "P12", () => {
  const oppTriple9 = classifyPlay(cards([
    ["9", SUITS.diamonds], ["9", SUITS.hearts], ["9", SUITS.clubs],
    ["2", SUITS.diamonds], ["2", SUITS.hearts],
  ]), "3");
  const hand = cards([
    ["5", SUITS.spades], ["5", SUITS.hearts], ["5", SUITS.clubs], ["5", SUITS.diamonds], ["3", SUITS.hearts],
    ["6", SUITS.clubs], ["7", SUITS.hearts], ["8", SUITS.spades],
    ["4", SUITS.spades], ["4", SUITS.clubs], ["6", SUITS.diamonds], ["7", SUITS.diamonds],
    ["8", SUITS.clubs], ["10", SUITS.clubs], ["J", SUITS.clubs], ["K", SUITS.clubs],
    ["A", SUITS.clubs], ["2", SUITS.diamonds], ["2", SUITS.hearts], ["3", SUITS.clubs], ["3", SUITS.diamonds], ["10", SUITS.spades],
  ]);
  const fiveBomb = classifyPlay(cards([
    ["5", SUITS.spades], ["5", SUITS.hearts], ["5", SUITS.clubs], ["5", SUITS.diamonds], ["3", SUITS.hearts],
  ]), "3");
  const ctx = {
    state: { levelRank: "3", players: [{ hand: filler }, { hand: filler }, { hand }, { hand: filler }] },
    playerIndex: 2,
    lastActivePlayerIndex: 1,
    previousPlay: oppTriple9,
    opponentActive: true,
    hasRegularWinner: false,
    hasActionableRegularWinner: false,
    hasAnyWinner: true,
    danger: 0,
    isOpening: false,
    partnerOwnsTrick: false,
    partnerAttemptedCurrentRound: false,
    scoringAudience: "robot",
    lite: true,
    _candidates: [classifyPlay([], "3"), fiveBomb],
  };
  const passScore = scoreCandidate(classifyPlay([], "3"), hand, "3", oppTriple9, ctx);
  const bombScore = scoreCandidate(fiveBomb, hand, "3", oppTriple9, ctx);
  assert(passScore.score < bombScore.score, "过牌应优于五炸");
});

// —— QA 原则驱动 ——
scenario("QA-有单Q映射P1", "P1", () => {
  const hand = cards([
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
  const prev = classifyPlay(cards([["3", SUITS.hearts]]), "5");
  const qa = tryLocalCoachAnswer("有单Q为什么拆牌？", {
    status: "in-progress", levelRank: "5",
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: prev },
    currentAdvice: {
      choices: [{
        play: generateBasicCandidates(hand, "5", prev).find((c) => c.mainRank === "6"),
        reasons: ["跟住对手单张"],
      }],
    },
  });
  assert(qa?.text.includes("单Q") || qa?.text.includes("散单Q") || qa?.text.includes("应出"), "QA 应直接回应散单");
});

// —— 执法层 ENFORCE ——
scenario("ENFORCE-接风双钢板三带二不进Top3", "P5", () => {
  const hand = cards([
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
  const wrongTriple = classifyPlay(
    cards([
      ["6", SUITS.spades, 0], ["6", SUITS.hearts, 0], ["6", SUITS.clubs, 0],
      ["9", SUITS.spades, 0], ["9", SUITS.diamonds, 0],
    ]),
    "3",
  );
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: null, playHistory: [] };
  const ctx = enrichScoringContext(
    { state, playerIndex: 0, preferredGroups: buildStrategicGroups(hand, "3") },
    generateBasicCandidates(hand, "3", null),
    hand,
    "3",
  );
  const scored = [
    { candidate: wrongTriple, score: -1000, reasons: ["测试桩"] },
    ...generateBasicCandidates(hand, "3", null)
      .filter((c) => c.type === PLAY_TYPES.plane)
      .slice(0, 1)
      .map((c) => ({ candidate: c, score: -5000, reasons: ["钢板"] })),
  ];
  const { candidates } = enforceDoctrineOnCandidates(scored, { ...ctx, hand, levelRank: "3" });
  const top3 = candidates.slice(0, 3);
  assert(
    !top3.some((item) => item.candidate.type === PLAY_TYPES.tripleWithPair && item.candidate.mainRank === "6"),
    "接风拆钢板三带二不得进 Top3",
  );
  assert(candidates[0].candidate.type === PLAY_TYPES.plane, "Top1 应为钢板");
});

scenario("ENFORCE-压单3拆6不进Top1", "P1", () => {
  const hand = cards([
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
  const prev = classifyPlay(cards([["3", SUITS.hearts]]), "5");
  const broken6 = generateBasicCandidates(hand, "5", prev)
    .find((c) => c.type === PLAY_TYPES.single && c.mainRank === "6");
  let state = createGameStateFromHands({ levelRank: "5", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const allCands = generateBasicCandidates(hand, "5", prev);
  const ctx = {
    ...enrichScoringContext(
      { state, playerIndex: 0, previousPlay: prev, lastActivePlayerIndex: 1 },
      allCands,
      hand,
      "5",
    ),
    _candidates: allCands,
  };
  const looseQ = allCands.find((c) => c.type === PLAY_TYPES.single && c.mainRank === "Q");
  const scored = [
    { candidate: broken6, score: -8000, reasons: [] },
    { candidate: looseQ, score: -9000, reasons: [] },
  ];
  const { candidates } = enforceDoctrineOnCandidates(scored, { ...ctx, hand, levelRank: "5" });
  assert(candidates[0].candidate.mainRank === "Q", "有散单Q时 Top1 不得拆6");
  const violations = detectDoctrineViolations(broken6, hand, "5", { ...ctx, hand, levelRank: "5" });
  assert(violations.length > 0 && ["P1", "P3", "P4"].includes(violations[0].code), "拆6应标教纲违规");
});

scenario("ENFORCE-纯四炸逢人配五炸不进Top1", "P7", () => {
  const hand = cards([
    ["4", SUITS.spades], ["4", SUITS.hearts], ["4", SUITS.clubs], ["4", SUITS.diamonds],
    ["3", SUITS.hearts],
    ["6", SUITS.clubs], ["7", SUITS.hearts], ["8", SUITS.spades],
    ["9", SUITS.clubs], ["10", SUITS.diamonds],
    ["J", SUITS.spades], ["Q", SUITS.clubs], ["K", SUITS.hearts],
    ["A", SUITS.diamonds], ["2", SUITS.clubs], ["5", SUITS.spades],
  ]);
  const prev = classifyPlay(cards([["SJ", SUITS.joker]]), "3");
  const pure4 = classifyPlay(cards([
    ["4", SUITS.spades], ["4", SUITS.hearts], ["4", SUITS.clubs], ["4", SUITS.diamonds],
  ]), "3");
  const wild5 = classifyPlay(cards([
    ["4", SUITS.spades], ["4", SUITS.hearts], ["4", SUITS.clubs], ["4", SUITS.diamonds],
    ["3", SUITS.hearts],
  ]), "3");
  const ctx = enrichScoringContext(
    { state: { levelRank: "3", players: [{ hand }] }, playerIndex: 0, previousPlay: prev },
    [pure4, wild5],
    hand,
    "3",
  );
  ctx.hasActionableRegularWinner = false;
  const scored = [
    { candidate: wild5, score: -1000, reasons: [] },
    { candidate: pure4, score: -2000, reasons: [] },
  ];
  const { candidates } = enforceDoctrineOnCandidates(scored, { ...ctx, hand, levelRank: "3", _candidates: [pure4, wild5] });
  assert(candidates[0].candidate.mainRank === "4" && (candidates[0].candidate.bombSize ?? 4) === 4, "Top1 应为纯四炸");
  assert(candidates[1].score >= DOCTRINE_HARD_PENALTY - 3000, "逢人配五炸应被巨罚");
});

scenario("ENFORCE-QA违规首行确认", "P5", () => {
  const hand = cards([
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
  const wrongTriple = {
    ...classifyPlay(
      cards([
        ["6", SUITS.spades, 0], ["6", SUITS.hearts, 0], ["6", SUITS.clubs, 0],
        ["9", SUITS.spades, 0], ["9", SUITS.diamonds, 0],
      ]),
      "3",
    ),
    label: "三带二 666+99",
  };
  const qa = tryLocalCoachAnswer("怎么又推荐拆钢板了？", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 0,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: null },
    currentAdvice: { choices: [{ play: wrongTriple, reasons: ["减手"] }] },
  });
  assert(qa?.text.includes("违规（"), "QA 首行应确认推荐违规");
  assert(qa?.text.includes("你是对的"), "QA 应承认用户正确");
});

scenario("ENFORCE-666+99接风推荐钢板", "P5", () => {
  const hand = cards([
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
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: null, playHistory: [] };
  const rec = recommendPlay(hand, "3", null, {
    state,
    playerIndex: 0,
    preferredGroups: buildStrategicGroups(hand, "3"),
    mlFusionMode: "smart",
    mlModel: false,
  });
  assert(
    !(rec.candidate.type === PLAY_TYPES.tripleWithPair && rec.candidate.mainRank === "6"),
    `666+99 接风不得首推三带二，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
});

// —— P1 拆顺子惩罚：有更小不拆顺子的散单 ——
scenario("P1-压单4有散单8不打5", "P1", () => {
  const hand = cards([
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
  const prev = classifyPlay(cards([["4", SUITS.diamonds, 0]]), "3");
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const rec = recommendPlay(hand, "3", prev, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.single && rec.candidate.mainRank === "8",
    `有散单8不拆顺子应出单8，实际 ${rec.candidate.label ?? rec.candidate.mainRank}`,
  );
  assert(rec.reasons.some((r) => /P1|散|结构/.test(r)), "应引用 P1 或拆结构");
});

scenario("QA-打5拆顺子", "P1", () => {
  const hand = cards([
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
  const prev = classifyPlay(cards([["4", SUITS.diamonds, 0]]), "3");
  const single5 = generateBasicCandidates(hand, "3", prev)
    .find((c) => c.type === PLAY_TYPES.single && c.mainRank === "5");
  const single8 = generateBasicCandidates(hand, "3", prev)
    .find((c) => c.type === PLAY_TYPES.single && c.mainRank === "8");
  const qa = tryLocalCoachAnswer("怎么打5？打5不是拆顺子吗？", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 16,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: prev },
    currentAdvice: {
      choices: [
        { play: single5, reasons: ["P1散单优先"] },
        { play: single8, reasons: ["跟住对手单张"] },
      ],
    },
  });
  assert(qa?.mode === "why-not-play", "拆顺子追问应走 why-not-play");
  assert(/是.*拆.*顺/.test(qa.text), "应直接答会拆顺子");
  assert(qa.text.includes("单8") || qa.text.includes("散单8"), "应点明单8不拆结构");
  assert(qa.text.includes("P1"), "应引用 P1");
  assert(!qa.text.includes("规则备忘"), "不应落入 brief");
  assert(qa.text.split("\n").filter((line) => line.trim()).length <= 5, "作答应不超过5行");
});

scenario("P2-压对5有整对K不拆三张6", "P2", () => {
  const hand = cards([
    ["6", SUITS.spades, 0], ["6", SUITS.spades, 1], ["6", SUITS.clubs, 1],
    ["K", SUITS.diamonds, 0], ["K", SUITS.diamonds, 1],
    ["7", SUITS.spades, 1], ["7", SUITS.hearts, 0], ["7", SUITS.hearts, 1],
    ["7", SUITS.clubs, 0], ["7", SUITS.clubs, 1], ["7", SUITS.diamonds, 1],
    ["8", SUITS.diamonds, 1], ["Q", SUITS.hearts, 1], ["A", SUITS.hearts, 1],
    ["2", SUITS.diamonds, 1], ["SJ", SUITS.joker, 0],
  ]);
  const prev = classifyPlay(cards([["5", SUITS.diamonds, 0], ["5", SUITS.hearts, 0]]), "3");
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const rec = recommendPlay(hand, "3", prev, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.pair && rec.candidate.mainRank === "K",
    `有整对K够压应出对K，实际 ${rec.candidate.label ?? rec.candidate.mainRank}`,
  );
});

scenario("QA-为何不用对K拆三个6", "P2", () => {
  const hand = cards([
    ["6", SUITS.spades, 0], ["6", SUITS.spades, 1], ["6", SUITS.clubs, 1],
    ["K", SUITS.diamonds, 0], ["K", SUITS.diamonds, 1],
    ["7", SUITS.spades, 1], ["7", SUITS.hearts, 0], ["7", SUITS.hearts, 1],
    ["7", SUITS.clubs, 0], ["7", SUITS.clubs, 1], ["7", SUITS.diamonds, 1],
    ["8", SUITS.diamonds, 1], ["Q", SUITS.hearts, 1], ["A", SUITS.hearts, 1],
    ["2", SUITS.diamonds, 1], ["SJ", SUITS.joker, 0],
  ]);
  const prev = classifyPlay(cards([["5", SUITS.diamonds, 0], ["5", SUITS.hearts, 0]]), "3");
  const pair6 = generateBasicCandidates(hand, "3", prev)
    .find((c) => c.type === PLAY_TYPES.pair && c.mainRank === "6");
  const pairK = generateBasicCandidates(hand, "3", prev)
    .find((c) => c.type === PLAY_TYPES.pair && c.mainRank === "K");
  const qa = tryLocalCoachAnswer("这里为什么不用对K，而要拆3个6？", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 20,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: prev },
    currentAdvice: {
      choices: [
        { play: pair6, reasons: ["用最小对子压住对手对子，打断接风"] },
        { play: pairK, reasons: ["用对子跟牌或抢权"] },
      ],
    },
  });
  assert(qa?.mode === "why-not-play", "为何不用对K应走 why-not-play");
  assert(qa.text.includes("对K") || qa.text.includes("整对K"), "应点明对K");
  assert(/拆.*(三张6|三同张|三张)/.test(qa.text), "应说明拆三个6的代价");
  assert(qa.text.includes("P2"), "应引用 P2");
  assert(!qa.text.includes("规则备忘"), "不应落入 brief");
  assert(!qa.text.includes("你在问为何不采用"), "不应落入泛答模板");
  assert(qa.text.split("\n").filter((line) => line.trim()).length <= 5, "作答应不超过5行");
});

scenario("QA-接风顺子23456vs12345", "P5", () => {
  const hand = cards([
    ["6", SUITS.spades, 0], ["6", SUITS.hearts, 0], ["6", SUITS.clubs, 0],
    ["3", SUITS.spades, 0], ["3", SUITS.diamonds, 0],
    ["A", SUITS.diamonds, 0], ["2", SUITS.spades, 1], ["4", SUITS.spades, 0], ["5", SUITS.spades, 0],
    ["8", SUITS.hearts, 0], ["9", SUITS.clubs, 0], ["10", SUITS.diamonds, 0],
    ["J", SUITS.clubs, 0], ["Q", SUITS.hearts, 0], ["K", SUITS.diamonds, 0],
  ]);
  const straightCandidates = generateBasicCandidates(hand, "3", null)
    .filter((c) => c.type === PLAY_TYPES.straight);
  const tripleCandidate = generateBasicCandidates(hand, "3", null)
    .find((c) => c.type === PLAY_TYPES.tripleWithPair && c.mainRank === "6");
  const gentleStraight = straightCandidates.find((c) => !c.label?.includes("6") || /A.*2.*3.*4.*5|1.*2.*3.*4.*5/i.test(c.label))
    ?? straightCandidates.find((c) => c.mainRank === "5" || c.mainRank === "A");
  const harshStraight = straightCandidates.find((c) => c.label?.includes("6") && c.label?.includes("2"))
    ?? straightCandidates[straightCandidates.length - 1];
  assert(tripleCandidate, "应有三带二 666 候选");
  const qa = tryLocalCoachAnswer(
    "推荐3中选23456，为什么不选12345？而是要拆三张，同时还多了一个A",
    {
      status: "in-progress",
      levelRank: "3",
      turnNumber: 8,
      humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
      table: { lastActivePlay: null },
      currentAdvice: {
        choices: [
          { play: tripleCandidate, reasons: ["接风减手"] },
          { play: gentleStraight ?? straightCandidates[0], reasons: ["顺子减手"] },
          { play: harshStraight ?? straightCandidates[0], reasons: ["顺子减手"] },
        ],
      },
    },
  );
  assert(qa?.mode === "why-not-play", "顺子对照应走 why-not-play");
  assert(/23456|2-3-4-5-6|留A|控牌|大一级/.test(qa.text), "应解释23456+留A优先");
  assert(/A2345|12345|绕级/.test(qa.text), "应点明 A2345/12345 对照");
  assert(!/优先走.*绕级顺|不宜走23456/i.test(qa.text), "不应再主张绕级顺优先");
  assert(!qa.text.includes("规则备忘"), "不应落入 brief");
  assert(!qa.text.includes("你在问为何不采用"), "不应落入泛答");
});

scenario("ENFORCE-接风三带二666有不拆三同张顺子", "P5", () => {
  const hand = cards([
    ["6", SUITS.spades, 0], ["6", SUITS.hearts, 0], ["6", SUITS.clubs, 0],
    ["3", SUITS.spades, 0], ["3", SUITS.diamonds, 0],
    ["A", SUITS.diamonds, 0], ["2", SUITS.spades, 1], ["4", SUITS.spades, 0], ["5", SUITS.spades, 0],
    ["8", SUITS.hearts, 0], ["9", SUITS.clubs, 0], ["10", SUITS.diamonds, 0],
    ["J", SUITS.clubs, 0], ["Q", SUITS.hearts, 0], ["K", SUITS.diamonds, 0],
  ]);
  const all = generateBasicCandidates(hand, "3", null);
  const triple6 = all.find((c) => c.type === PLAY_TYPES.tripleWithPair && c.mainRank === "6");
  const gentleStraight = all.find((c) => c.type === PLAY_TYPES.straight);
  assert(triple6 && gentleStraight, "应有三带二与顺子候选");
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: null,
    playHistory: [
      { turnNumber: 1, playerIndex: 0, play: classifyPlay(cards([["A", SUITS.hearts]]), "3") },
      { turnNumber: 2, playerIndex: 1, play: classifyPlay([], "3") },
      { turnNumber: 3, playerIndex: 2, play: classifyPlay([], "3") },
      { turnNumber: 4, playerIndex: 3, play: classifyPlay([], "3") },
    ],
  };
  const tableContext = {
    ...enrichScoringContext({ state, playerIndex: 0 }, all, hand, "3"),
    _candidates: all,
    hand,
    levelRank: "3",
  };
  const violations = detectDoctrineViolations(triple6, hand, "3", tableContext);
  assert(
    violations.some((v) => v.code === "P5" && v.blockTop1),
    `三带二666接风有顺子替代应判 P5 违规，实际 ${violations.map((v) => v.code).join(",")}`,
  );
});

scenario("QA-三带二666+33拆顺子多出散牌", "P5", () => {
  const hand = cards([
    ["6", SUITS.spades, 0], ["6", SUITS.hearts, 0], ["6", SUITS.clubs, 0],
    ["3", SUITS.spades, 0], ["3", SUITS.diamonds, 0],
    ["A", SUITS.diamonds, 0], ["2", SUITS.spades, 1], ["4", SUITS.spades, 0], ["5", SUITS.spades, 0],
    ["8", SUITS.hearts, 0], ["9", SUITS.clubs, 0], ["10", SUITS.diamonds, 0],
    ["J", SUITS.clubs, 0], ["Q", SUITS.hearts, 0], ["K", SUITS.diamonds, 0],
  ]);
  const tripleCandidate = generateBasicCandidates(hand, "3", null)
    .find((c) => c.type === PLAY_TYPES.tripleWithPair && c.mainRank === "6");
  const gentleStraight = generateBasicCandidates(hand, "3", null)
    .find((c) => c.type === PLAY_TYPES.straight);
  assert(tripleCandidate && gentleStraight, "应有三带二666与顺子候选");
  const qa = tryLocalCoachAnswer(
    "推荐1中要拆顺子用三个6带两个3，这是什么逻辑，多出4张单牌怎么办？",
    {
      status: "in-progress",
      levelRank: "3",
      turnNumber: 8,
      humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
      table: { lastActivePlay: null },
      currentAdvice: {
        choices: [
          { play: tripleCandidate, reasons: ["接风减手"] },
          { play: gentleStraight, reasons: ["顺子减手"] },
        ],
      },
    },
  );
  assert(qa?.mode === "why-not-play", "三带二拆顺子应走 why-not-play");
  assert(/拆.*顺子|顺子/.test(qa.text), "应点明拆顺子");
  assert(/多出|散单|散牌|一堆/.test(qa.text), "应回应多出散牌");
  assert(qa.text.includes("P5"), "应引用 P5");
  assert(!qa.text.includes("规则备忘"), "不应落入 brief");
  assert(!qa.text.includes("你在问为何不采用"), "不应落入泛答");
});

scenario("STRUCTURE-23456留A优于A2345", "P4", () => {
  const hand = cards([
    ["2", SUITS.clubs, 0], ["2", SUITS.diamonds, 1], ["2", SUITS.hearts, 1],
    ["3", SUITS.diamonds, 1], ["4", SUITS.spades, 0],
    ["5", SUITS.diamonds, 0], ["6", SUITS.hearts, 1], ["A", SUITS.hearts, 0],
  ]);
  const groups = buildStrategicGroups(hand, "3");
  const straight = groups.find((group) => group.play?.type === PLAY_TYPES.straight);
  assert(
    straight?.label?.includes("2-3-4-5-6"),
    `同套A~6应理成23456+留A，实际 ${straight?.label ?? "无顺子"}`,
  );
  assert(
    !groups.some((group) => group.label?.includes("A-2-3-4-5")),
    "不应同时理成绕级顺A2345",
  );

  const all = generateBasicCandidates(hand, "3", null);
  const straightCandidates = all.filter((candidate) => candidate.type === PLAY_TYPES.straight);
  const rankSetKey = (candidate) => [...new Set((candidate.cards ?? []).map((card) => card.rank))].sort().join(",");
  const wrapStraight = straightCandidates.find((candidate) => rankSetKey(candidate) === "2,3,4,5,A");
  const highStraight = straightCandidates.find((candidate) => rankSetKey(candidate) === "2,3,4,5,6");
  assert(wrapStraight && highStraight, "两种顺子候选均应存在");

  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: null, playHistory: [] };
  const tableContext = {
    ...enrichScoringContext({ state, playerIndex: 0 }, all, hand, "3"),
    _candidates: all,
    hand,
    levelRank: "3",
    isOpening: true,
    leadMode: "fresh-open",
    opponentActive: false,
  };
  const wrapViolations = detectDoctrineViolations(wrapStraight, hand, "3", tableContext);
  assert(
    wrapViolations.some((item) => item.code === "P4" && /23456|留A/.test(item.summary)),
    `绕级顺A2345应被P4执法，实际 ${wrapViolations.map((item) => item.summary).join(";")}`,
  );

  const rec = recommendPlay(hand, "3", null, {
    state,
    playerIndex: 0,
    preferredGroups: groups,
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.straight
      && rankSetKey(rec.candidate) === "2,3,4,5,6",
    `开局Top1应23456顺子，实际 ${rec.candidate.label ?? rec.candidate.mainRank ?? rec.candidate.type}`,
  );

  const qa = tryLocalCoachAnswer("为什么理牌是23456不是A2345？", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 0,
    humanHand: hand.map((card) => ({ rank: card.rank, suit: card.suit, deckIndex: card.deckIndex })),
    table: { lastActivePlay: null },
    currentAdvice: { choices: [{ play: rec.candidate, reasons: rec.reasons }] },
  });
  assert(qa?.mode === "why-not-play", "23456理牌专答应走 why-not-play");
  assert(/23456|大一级|留A|控/.test(qa.text), "应解释23456+留A");
});

scenario("QA-game2-222+55拆顺子A2345", "P1/P4", () => {
  const hand = cards([
    ["2", SUITS.clubs, 0], ["2", SUITS.diamonds, 1], ["2", SUITS.hearts, 1],
    ["3", SUITS.diamonds, 1], ["4", SUITS.spades, 0],
    ["5", SUITS.diamonds, 0], ["5", SUITS.diamonds, 1],
    ["6", SUITS.hearts, 1], ["7", SUITS.clubs, 0], ["7", SUITS.diamonds, 1],
    ["8", SUITS.clubs, 0], ["8", SUITS.diamonds, 0], ["8", SUITS.diamonds, 1],
    ["8", SUITS.hearts, 1], ["8", SUITS.spades, 1],
    ["10", SUITS.spades, 1],
    ["J", SUITS.clubs, 0], ["J", SUITS.clubs, 1], ["J", SUITS.diamonds, 0],
    ["J", SUITS.spades, 0], ["J", SUITS.spades, 1],
    ["Q", SUITS.hearts, 1], ["Q", SUITS.spades, 1],
    ["K", SUITS.clubs, 0], ["K", SUITS.hearts, 1], ["K", SUITS.spades, 0],
    ["A", SUITS.hearts, 0],
  ]);
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: null, playHistory: [] };
  const rec = recommendPlay(hand, "3", null, {
    state,
    playerIndex: 0,
    preferredGroups: buildStrategicGroups(hand, "3"),
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.straight
      || (rec.candidate.type === PLAY_TYPES.tripleWithPair
        && rec.candidate.mainRank === "K"),
    `game-2开局Top1应顺子或KKK+对子，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
  const triple2BreaksStraight = rec.candidate.type === PLAY_TYPES.tripleWithPair
    && rec.candidate.mainRank === "2";
  assert(!triple2BreaksStraight, "Top1不得首推222+55拆顺");
  const triple8BreaksBomb = rec.candidate.type === PLAY_TYPES.tripleWithPair
    && rec.candidate.mainRank === "8";
  assert(!triple8BreaksBomb, "Top1不得首推888+55拆五炸8");
  const triple2 = generateBasicCandidates(hand, "3", null)
    .find((c) => c.type === PLAY_TYPES.tripleWithPair && c.mainRank === "2");
  assert(triple2, "应有 222+55 三带二候选");
  triple2.label = "三带二 梅花2 方片2 红桃2 方片5 方片5";
  const qa = tryLocalCoachAnswer(
    "梅花2已经组成顺子了，出三个2带对5不就把顺子拆了吗？",
    {
      status: "in-progress",
      levelRank: "3",
      turnNumber: 0,
      humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
      table: { lastActivePlay: null },
      currentAdvice: {
        choices: [{ play: triple2, reasons: ["开局减手"] }],
      },
    },
  );
  assert(qa?.mode === "why-not-play", "222+55拆顺应走 why-not-play");
  assert(/是.*拆.*顺|会拆.*顺子/.test(qa.text), "应确认会拆顺子");
  assert(qa.text.includes("梅花2"), "应点明梅花2在顺子里");
  assert(qa.text.includes("推荐1"), "应引用 Top1");
  assert(/P1|P4/.test(qa.text), "应引用结构保护原则");
  assert(!qa.text.includes("888"), "不应建议888+55拆五炸8");
  assert(!qa.text.includes("4张J"), "不应落入 J 炸弹 rule-only 模板");
  assert(!qa.text.includes("非大模型臆测"), "不应落入拆炸泛模板");
  const qaWithFixedTop = tryLocalCoachAnswer(
    "梅花2已经组成顺子了，出三个2带对5不就把顺子拆了吗？",
    {
      status: "in-progress",
      levelRank: "3",
      turnNumber: 0,
      humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
      table: { lastActivePlay: null },
      currentAdvice: { choices: [{ play: rec.candidate, reasons: rec.reasons }] },
    },
  );
  assert(/顺子|2-3-4-5-6|23456/.test(qaWithFixedTop.text), "修后Top1 QA应指向23456顺子");
  assert(!qaWithFixedTop.text.includes("888"), "修后QA不应建议拆炸");
});

scenario("QA-拆顺子四炸7剩两个7", "P1", () => {
  const hand = cards([
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
  const prev = classifyPlay(cards([["4", SUITS.diamonds, 0]]), "3");
  const single8 = generateBasicCandidates(hand, "3", prev)
    .find((c) => c.type === PLAY_TYPES.single && c.mainRank === "8");
  const qa = tryLocalCoachAnswer("为什么拆顺子？打了四个7剩下的两个7怎么办？", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 16,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: prev },
    currentAdvice: {
      choices: [{ play: single8, reasons: ["P1散单优先"] }],
    },
  });
  assert(qa?.mode === "why-break-bomb-structure", "拆顺子四炸7应走 why-break-bomb-structure");
  assert(/不应.*拆.*顺|不为.*拆.*顺|不拆.*顺/.test(qa.text), "应说明不应拆顺子");
  assert(/应出单8|散单8/.test(qa.text), "压单4应点明应出单8");
  assert(/四.*7|四炸|炸弹.*7/.test(qa.text), "应解释四炸7结构");
  assert(/剩.*2|对7|两个7/.test(qa.text), "应说明剩两个7变对子");
  assert(!qa.text.includes("规则备忘"), "不应落入 brief");
  assert(!qa.text.includes("你在问为何不采用"), "不应落入泛答");
});

scenario("P7-6张7压顺子45678→六炸7", "P7", () => {
  const hand = cards([
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
  const prev = classifyPlay(
    cards([["4", SUITS.diamonds, 0], ["5", SUITS.spades, 0], ["6", SUITS.spades, 0], ["7", SUITS.hearts, 0], ["8", SUITS.clubs, 0]]),
    "3",
  );
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const rec = recommendPlay(hand, "3", prev, {
    state,
    playerIndex: 0,
    lastActivePlayerIndex: 1,
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.bomb && rec.candidate.mainRank === "7" && (rec.candidate.bombSize ?? 4) === 6,
    `6张7压顺子45678应首推六炸7，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
  assert(
    rec.reasons.some((r) => /满张|控牌权|四炸易被反压|P7/.test(r)),
    "应说明满张炸弹控牌权",
  );
  const p7FullControl = rec.reasons.filter((r) => /满张炸弹控牌权，四炸易被反压/.test(r));
  assert(p7FullControl.length <= 1, `P7 满张控权理由不应重复，实际 ${p7FullControl.length} 条`);
  assert(
    !(rec.doctrineViolations ?? []).some((v) => v.blockTop1 || v.blockTop3),
    "满张六炸 Top1 不应标教纲 violation",
  );
});

scenario("QA-6张7压顺子问教练满张控权", "P7", () => {
  const hand = cards([
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
  const prev = classifyPlay(
    cards([["4", SUITS.diamonds, 0], ["5", SUITS.spades, 0], ["6", SUITS.spades, 0], ["7", SUITS.hearts, 0], ["8", SUITS.clubs, 0]]),
    "3",
  );
  const bomb6 = generateBasicCandidates(hand, "3", prev)
    .find((c) => c.type === PLAY_TYPES.bomb && c.mainRank === "7" && (c.bombSize ?? 4) === 6);
  const qa = tryLocalCoachAnswer("为什么拆顺子？打了四个7剩下的两个7怎么办？", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 40,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: prev },
    currentAdvice: { choices: [{ play: bomb6, reasons: ["P7满张炸弹控牌权"] }] },
  });
  assert(qa?.mode === "why-break-bomb-structure", "6张7压顺子 QA 应走 why-break-bomb-structure");
  assert(/物理手牌.*6.*7|6\s*张7/.test(qa.text), "应写物理手牌6张7");
  assert(/六炸|满张|6张.*7/.test(qa.text), "应说明六炸7");
  assert(/四炸.*弱|易被反压|控牌权|控权/.test(qa.text), "应说明四炸易被反压、满张控权");
  assert(/没有顺子可拆|并非拆顺子|不是为了拆.*顺子/.test(qa.text), "应说明不是拆自己顺子");
  assert(!qa.text.includes("应出单8"), "压顺子场景不应误答单8");
  assert(!qa.text.includes("规则备忘"), "不应落入 brief");
});

// —— 用户验收 #3：6张7压顺子45678 → 六炸7；问教练说清满张控权 ——
scenario("ACCEPT-6张7压顺子45678→六炸7", "P7", () => {
  const hand = cards([
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
  const prev = classifyPlay(
    cards([
      ["4", SUITS.spades], ["5", SUITS.hearts], ["6", SUITS.clubs],
      ["7", SUITS.diamonds], ["8", SUITS.hearts],
    ]),
    "3",
  );
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 3 };
  const rec = recommendPlay(hand, "3", prev, {
    state,
    playerIndex: 0,
    lastActivePlayerIndex: 3,
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.bomb
      && rec.candidate.mainRank === "7"
      && (rec.candidate.bombSize ?? 4) === 6,
    `6张7压顺子应首推六炸7，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
  const qa = tryLocalCoachAnswer("为什么拆顺子？打了四个7剩下的两个7怎么办？", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 44,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: prev },
    currentAdvice: { choices: [{ play: rec.candidate, reasons: rec.reasons }] },
  });
  assert(qa?.mode === "why-break-bomb-structure", "压顺子六炸7 QA 应走 why-break-bomb-structure");
  assert(/物理手牌.*6.*张7|6.*张7/.test(qa.text), "应基于物理手牌写6张7");
  assert(/满张|六炸|控牌权|控权/.test(qa.text), "应说明满张六炸控权");
  assert(/四炸.*弱|易被反压/.test(qa.text), "应说明四炸易被反压");
  assert(!qa.text.includes("规则备忘"), "不应落入 brief 炸弹备忘");
});

scenario("P5-开局lite不宜双逢人配空炸同花顺", "P5", () => {
  const hand = cards([
    ["2", SUITS.spades, 1], ["3", SUITS.hearts, 1],
    ["4", SUITS.clubs], ["4", SUITS.hearts, 1],
    ["5", SUITS.hearts], ["5", SUITS.spades, 1],
    ["6", SUITS.clubs], ["6", SUITS.spades, 1],
    ["7", SUITS.clubs, 1], ["8", SUITS.diamonds],
    ["9", SUITS.clubs], ["9", SUITS.hearts], ["9", SUITS.spades, 1],
    ["10", SUITS.clubs], ["10", SUITS.clubs, 1],
    ["J", SUITS.diamonds], ["J", SUITS.diamonds, 1], ["J", SUITS.spades], ["J", SUITS.spades, 1],
    ["Q", SUITS.clubs], ["Q", SUITS.clubs, 1], ["Q", SUITS.hearts], ["Q", SUITS.spades, 1],
    ["2", SUITS.hearts], ["2", SUITS.hearts, 1],
    ["K", SUITS.diamonds], ["A", SUITS.diamonds, 1],
  ]);
  const state = createGameStateFromHands({
    levelRank: "2",
    hands: [hand, cards([["6"]]), cards([["8"]]), cards([["9"]])],
    currentPlayerIndex: 0,
  });
  const preferredGroups = buildStrategicGroups(hand, "2");
  const advice = getTurnAdvice(state, 0, {
    alternatives: 3,
    maxCandidates: 16,
    preferredGroups,
    handProfile: evaluateHandProfile(hand, "2", { preferredGroups }),
    mlFusionMode: "off",
    lite: true,
  });
  const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);
  assert(
    !BOMB_TYPES.has(advice.recommendation.candidate.type),
    `开局快速建议不宜首推炸弹，实际 ${advice.recommendation.candidate.label ?? advice.recommendation.candidate.type}`,
  );
});

scenario("P9-开局444+AA不宜拆六炸A", "P9", () => {
  const hand = cards([
    ["6", SUITS.spades], ["7", SUITS.spades], ["8", SUITS.spades], ["9", SUITS.spades], ["10", SUITS.spades],
    ["A", SUITS.spades], ["A", SUITS.diamonds], ["A", SUITS.hearts], ["A", SUITS.clubs], ["A", SUITS.spades, 1], ["A", SUITS.diamonds, 1],
    ["4", SUITS.clubs], ["4", SUITS.spades], ["4", SUITS.diamonds],
    ["8", SUITS.hearts], ["8", SUITS.diamonds], ["8", SUITS.diamonds, 1],
    ["Q", SUITS.clubs], ["Q", SUITS.diamonds],
    ["K", SUITS.clubs], ["K", SUITS.diamonds],
    ["2", SUITS.diamonds], ["2", SUITS.diamonds, 1],
    ["7", SUITS.diamonds], ["9", SUITS.clubs], ["10", SUITS.hearts], ["BJ", SUITS.spades],
  ]);
  const state = createGameStateFromHands({
    levelRank: "7",
    hands: [hand, cards([["3"]]), cards([["5"]]), cards([["6", SUITS.hearts]])],
    currentPlayerIndex: 0,
  });
  const preferredGroups = buildStrategicGroups(hand, "7");
  const all = generateBasicCandidates(hand, "7", null);
  const triple444AA = all.find(
    (c) => c.type === PLAY_TYPES.tripleWithPair && c.mainRank === "4"
      && (c.cards ?? []).filter((card) => card.rank === "A").length === 2,
  );
  assert(triple444AA, "应有 444+AA 三带二候选");
  const violations = detectDoctrineViolations(triple444AA, hand, "7", {
    ...enrichScoringContext({ state, playerIndex: 0 }, all, hand, "7"),
    _candidates: all,
    isOpening: true,
    leadMode: "fresh-open",
  });
  assert(
    violations.some((v) => v.code === "P9" && v.blockTop1 && /厚炸|六炸/.test(v.summary)),
    `444+AA 拆六炸A 应判 P9 违规，实际 ${violations.map((v) => v.summary).join(";")}`,
  );

  const advice = getTurnAdvice(state, 0, {
    alternatives: 3,
    maxCandidates: 16,
    preferredGroups,
    handProfile: evaluateHandProfile(hand, "7", { preferredGroups }),
    mlFusionMode: "off",
    lite: true,
  });
  const top = advice.recommendation.candidate;
  const breaksSixABomb = top.type === PLAY_TYPES.tripleWithPair && top.mainRank === "4"
    && (top.cards ?? []).filter((card) => card.rank === "A").length === 2;
  assert(!breaksSixABomb, `开局 Top1 不得首推 444+AA 拆六炸A，实际 ${top.label ?? top.type}`);
  assert(
    top.type === PLAY_TYPES.triple && top.mainRank === "4"
      || top.type === PLAY_TYPES.pair
      || top.type === PLAY_TYPES.straight
      || top.type === PLAY_TYPES.consecutivePairs,
    `应改推裸444/对子/顺子等，实际 ${top.label ?? top.type}`,
  );
});

scenario("P5-刚炸四炸接风机器人不空扔同花顺", "P5", () => {
  const filler = cards([
    ["3", SUITS.clubs], ["6", SUITS.hearts], ["8", SUITS.clubs], ["J", SUITS.diamonds],
    ["2", SUITS.diamonds], ["K", SUITS.diamonds], ["A", SUITS.hearts], ["9", SUITS.spades],
  ]);
  const yongHand = cards([
    ["A", SUITS.clubs], ["2", SUITS.clubs], ["3", SUITS.clubs], ["4", SUITS.clubs], ["5", SUITS.clubs],
    ["5", SUITS.hearts], ["5", SUITS.diamonds],
    ["6", SUITS.spades], ["6", SUITS.hearts],
    ["8", SUITS.spades], ["8", SUITS.hearts],
    ["9", SUITS.clubs], ["9", SUITS.diamonds],
    ["10", SUITS.spades], ["10", SUITS.hearts],
    ["J", SUITS.clubs], ["J", SUITS.diamonds],
    ["K", SUITS.spades], ["K", SUITS.hearts],
    ["Q", SUITS.spades],
  ]);
  const bombJ = classifyPlay(cards([
    ["J", SUITS.spades, 1], ["J", SUITS.hearts, 1], ["J", SUITS.diamonds, 1], ["J", SUITS.clubs, 1],
  ]), "7");
  const passPlay = classifyPlay([], "7");
  let state = createGameStateFromHands({
    levelRank: "7",
    hands: [filler, yongHand, filler, filler],
    currentPlayerIndex: 1,
  });
  state = {
    ...state,
    lastActivePlay: null,
    playHistory: [
      { turnNumber: 40, playerIndex: 1, play: bombJ },
      { turnNumber: 41, playerIndex: 2, play: passPlay },
      { turnNumber: 42, playerIndex: 3, play: passPlay },
      { turnNumber: 43, playerIndex: 0, play: passPlay },
    ],
  };
  const turn = playRecommendedTurn(state, { mlFusionMode: "off", mlModel: false, lite: true });
  assert(
    turn.recommendation.candidate.type !== PLAY_TYPES.straightFlush,
    `刚炸J接风机器人不宜空扔梅花同花顺，实际 ${turn.recommendation.candidate.label ?? turn.recommendation.candidate.type}`,
  );
});

scenario("P5-毛蛋四炸接风不空扔同花顺", "P5", () => {
  const filler = cards([
    ["3", SUITS.clubs], ["6", SUITS.hearts], ["4", SUITS.spades], ["K", SUITS.diamonds],
    ["A", SUITS.hearts], ["2", SUITS.diamonds], ["8", SUITS.clubs], ["9", SUITS.spades],
  ]);
  const maoHand = cards([
    ["7", SUITS.diamonds], ["8", SUITS.diamonds], ["9", SUITS.diamonds], ["J", SUITS.diamonds], ["2", SUITS.hearts],
    ["5", SUITS.hearts], ["5", SUITS.spades], ["6", SUITS.clubs], ["6", SUITS.diamonds],
    ["Q", SUITS.spades], ["Q", SUITS.hearts], ["K", SUITS.clubs], ["A", SUITS.spades],
    ["3", SUITS.diamonds], ["4", SUITS.hearts],
  ]);
  const bombQ = classifyPlay(cards([
    ["Q", SUITS.spades], ["Q", SUITS.hearts], ["Q", SUITS.clubs], ["Q", SUITS.diamonds],
  ]), "7");
  const passPlay = classifyPlay([], "7");
  let state = createGameStateFromHands({
    levelRank: "7",
    hands: [filler, filler, filler, maoHand],
    currentPlayerIndex: 3,
  });
  state = {
    ...state,
    lastActivePlay: null,
    playHistory: [
      { turnNumber: 60, playerIndex: 3, play: bombQ },
      { turnNumber: 61, playerIndex: 0, play: passPlay },
      { turnNumber: 62, playerIndex: 1, play: passPlay },
      { turnNumber: 63, playerIndex: 2, play: passPlay },
    ],
  };
  const turn = playRecommendedTurn(state, { mlFusionMode: "off", mlModel: false, lite: true });
  assert(
    turn.recommendation.candidate.type !== PLAY_TYPES.straightFlush,
    `毛蛋刚炸Q接风不宜空方片同花顺，实际 ${turn.recommendation.candidate.label ?? turn.recommendation.candidate.type}`,
  );
});

scenario("QA-开局连对vs对子专问", "P5", () => {
  const qa = tryLocalCoachAnswer("为什么不出连对而要出对子？", {
    status: "in-progress",
    levelRank: "2",
    turnNumber: 0,
    humanHand: [
      { rank: "3", suit: "D" }, { rank: "3", suit: "S" },
      { rank: "4", suit: "C" }, { rank: "4", suit: "H" },
      { rank: "5", suit: "H" }, { rank: "5", suit: "S" },
    ],
    table: { lastActivePlay: null },
    currentAdvice: {
      choices: [
        {
          play: {
            type: PLAY_TYPES.pair,
            mainRank: "3",
            label: "对子 方片3 黑桃3",
            cards: [
              { rank: "3", suit: "D" },
              { rank: "3", suit: "S" },
            ],
          },
          reasons: [],
        },
        {
          play: {
            type: PLAY_TYPES.consecutivePairs,
            mainRank: "3",
            length: 6,
            label: "连对 方片3 黑桃3 梅花4 红桃4 红桃5 黑桃5",
            cards: [
              { rank: "3", suit: "D" }, { rank: "3", suit: "S" },
              { rank: "4", suit: "C" }, { rank: "4", suit: "H" },
              { rank: "5", suit: "H" }, { rank: "5", suit: "S" },
            ],
          },
          reasons: ["接风连对一次减六张，抢节奏减手"],
        },
      ],
    },
  });
  assert(qa?.mode === "why-pair-chain-vs-pair", `连对vs对子专问路由，实际 ${qa?.mode}`);
  assert(!/暂未识别/.test(qa.text), "不应落入 fallback");
  assert(/开局|试探|减2张|连对|对3|风格/.test(qa.text), "应解释开局小对 vs 连对取舍");
});

scenario("ACCEPT-brief兜底不含炸弹备忘", "P1", () => {
  const qa = tryLocalCoachAnswer("这手为什么推荐过牌？", {
    status: "in-progress",
    levelRank: "2",
    turnNumber: 8,
    humanHand: [],
    table: { lastActivePlay: { label: "对Q" } },
    currentAdvice: {
      choices: [{ play: { type: "Pass", label: "过牌" }, reasons: ["保留炸弹"] }],
    },
  });
  assert(qa?.mode === "fallback", "未匹配专问应走 fallback 短答");
  assert(!qa.text.includes("规则备忘"), "fallback 不应含炸弹备忘");
  assert(/请具体问|暂未识别/.test(qa.text), "应提示具体问法");
});

scenario("P12-接风对手报单出10非2", "P12", () => {
  const laoshiHand = cards([
    ["2", SUITS.spades],
    ["10", SUITS.spades, 1],
    ["BJ", SUITS.joker, 1],
  ]);
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [
      cards([["3", SUITS.diamonds]]),
      cards([["4", SUITS.hearts]]),
      laoshiHand,
      filler,
    ],
    currentPlayerIndex: 2,
  });
  state = {
    ...state,
    lastActivePlay: null,
    lastActivePlayerIndex: null,
    passCount: 0,
    playHistory: [],
  };
  const turn = playRecommendedTurn(state, { mlFusionMode: "off", mlModel: false, lite: true });
  assert(turn.recommendation.candidate.type === PLAY_TYPES.single, "接风应出单张试探");
  assert(
    turn.recommendation.candidate.mainRank === "10",
    `对手报单接风应出黑桃10，实际 ${turn.recommendation.candidate.label ?? turn.recommendation.candidate.mainRank}`,
  );
});

scenario("WIND-用户出完级牌队友接风", "P5", () => {
  const level3 = classifyPlay([createCard("3", SUITS.diamonds)], "3");
  const yong4 = classifyPlay([createCard("4", SUITS.hearts)], "3");
  const laoshi2 = classifyPlay([createCard("2", SUITS.spades)], "3");
  const passPlay = classifyPlay([], "3");
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [
      [],
      [],
      cards([["10", SUITS.spades, 1], ["BJ", SUITS.joker, 1]]),
      cards([["2", SUITS.diamonds], ["6", SUITS.diamonds], ["6", SUITS.hearts]]),
    ],
    currentPlayerIndex: 2,
  });
  state = {
    ...state,
    players: state.players.map((player, index) => {
      if (index === 0) return { ...player, hand: [], finishedOrder: 2 };
      if (index === 1) return { ...player, hand: [], finishedOrder: 1 };
      return player;
    }),
    finishedPlayers: [1, 0],
    lastActivePlay: level3,
    lastActivePlayerIndex: 1,
    passCount: 0,
    turnNumber: 94,
    playHistory: [
      { turnNumber: 88, playerIndex: 1, play: yong4 },
      { turnNumber: 89, playerIndex: 2, play: laoshi2 },
      { turnNumber: 92, playerIndex: 0, play: level3 },
      { turnNumber: 93, playerIndex: 3, play: passPlay },
    ],
  };
  state = passTurn(state);
  assert(
    state.currentPlayerIndex === 2,
    `用户出完级牌3后接风应到老史(2)，实际座位 ${state.currentPlayerIndex}`,
  );
  assert(state.lastActivePlay === null, "三家过后应清台接风");
});

scenario("P5-match1-turn40接风不宜裸对子或杂顺", "P5", () => {
  const hand = cards([
    ["3", SUITS.spades, 0], ["4", SUITS.spades, 0],
    ["5", SUITS.spades, 0], ["6", SUITS.spades, 1], ["7", SUITS.spades, 0],
    ["6", SUITS.hearts, 1], ["8", SUITS.hearts, 0], ["9", SUITS.hearts, 0],
    ["10", SUITS.hearts, 0], ["2", SUITS.hearts, 1],
    ["5", SUITS.hearts, 0], ["5", SUITS.clubs, 0], ["5", SUITS.diamonds, 1],
    ["7", SUITS.clubs, 0], ["8", SUITS.clubs, 1], ["9", SUITS.clubs, 1],
  ]);
  const bomb5Q = classifyPlay(cards([
    ["Q", SUITS.spades, 0], ["Q", SUITS.spades, 1], ["Q", SUITS.clubs, 1],
    ["Q", SUITS.diamonds, 0], ["Q", SUITS.diamonds, 1],
  ]), "2");
  const filler = cards([
    ["A", SUITS.clubs], ["A", SUITS.diamonds], ["K", SUITS.clubs], ["K", SUITS.diamonds],
    ["J", SUITS.clubs], ["J", SUITS.diamonds], ["4", SUITS.clubs], ["4", SUITS.diamonds],
    ["8", SUITS.spades], ["9", SUITS.spades], ["10", SUITS.spades],
    ["3", SUITS.clubs], ["3", SUITS.diamonds], ["6", SUITS.clubs], ["6", SUITS.diamonds], ["7", SUITS.diamonds],
  ]);
  let state = createGameStateFromHands({
    levelRank: "2",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: null,
    lastActivePlayerIndex: null,
    playHistory: [
      { turnNumber: 36, playerIndex: 0, play: bomb5Q },
      { turnNumber: 37, playerIndex: 3, play: classifyPlay([], "2") },
      { turnNumber: 38, playerIndex: 2, play: classifyPlay([], "2") },
      { turnNumber: 39, playerIndex: 1, play: classifyPlay([], "2") },
    ],
  };
  const top = recommendPlay(hand, "2", null, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(
    top.candidate?.type === PLAY_TYPES.straightFlush
      || top.candidate?.type === PLAY_TYPES.consecutivePairs,
    `五炸Q接风后应优先成组减手（同花顺/连对），实际 ${top.candidate?.type} ${top.candidate?.label ?? ""}`,
  );
  assert(top.candidate?.type !== PLAY_TYPES.pair, "接风不宜首推裸对子");
  assert(top.candidate?.type !== PLAY_TYPES.straight, "不宜首推拆同花顺的杂顺");
});

scenario("P1-整手同花顺压对K→亮同花顺", "P1", () => {
  const hand = cards([
    ["2", SUITS.clubs, 0], ["3", SUITS.clubs, 0], ["4", SUITS.clubs, 0],
    ["5", SUITS.clubs, 0], ["6", SUITS.clubs, 0],
  ]);
  const pairK = classifyPlay(cards([["K", SUITS.clubs, 0], ["K", SUITS.clubs, 1]]), "2");
  const generated = generateBasicCandidates(hand, "2", pairK);
  assert(generated.some((c) => c.type === PLAY_TYPES.straightFlush), "整手同花顺应进入候选池");
  const top = recommendPlay(hand, "2", pairK, { mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.straightFlush, `应亮同花顺压对K，实际 ${top.candidate?.type}`);
  assert(!top.reasons?.some((r) => r.includes("只能过牌")), "不应误判只能过牌");
});

scenario("P7-match1-压王不宜拆同花顺凑四炸5→四炸Q", "P7", () => {
  const hand = cards([
    ["3", SUITS.spades, 0], ["4", SUITS.spades, 0],
    ["5", SUITS.spades, 0], ["6", SUITS.spades, 1], ["7", SUITS.spades, 0],
    ["6", SUITS.hearts, 1], ["8", SUITS.hearts, 0], ["9", SUITS.hearts, 0],
    ["10", SUITS.hearts, 0], ["2", SUITS.hearts, 1],
    ["Q", SUITS.spades, 0], ["Q", SUITS.spades, 1], ["Q", SUITS.clubs, 1],
    ["Q", SUITS.diamonds, 0], ["Q", SUITS.diamonds, 1],
    ["5", SUITS.hearts, 0], ["5", SUITS.clubs, 0], ["5", SUITS.diamonds, 1],
    ["7", SUITS.clubs, 0], ["8", SUITS.clubs, 1], ["9", SUITS.clubs, 1],
  ]);
  const mustBeatBJ = classifyPlay([createCard("BJ", SUITS.joker, 1)], "2");
  const top = recommendPlay(hand, "2", mustBeatBJ, { playerIndex: 0, mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.bomb, `压王应出炸弹，实际 ${top.candidate?.type}`);
  assert(top.candidate?.mainRank === "Q", `不宜拆同花顺凑5炸，Top1 应为四炸Q，实际 ${top.candidate?.mainRank}`);
  assert(!/拆.*同花顺|凑.*5炸/.test((top.reasons ?? []).join("")), "Top1 理由不应鼓励拆同花顺凑5炸");
});

scenario("QA-match1-拆同花顺凑四炸5", "P7", () => {
  const hand = cards([
    ["3", SUITS.spades, 0], ["4", SUITS.spades, 0],
    ["5", SUITS.clubs, 0], ["5", SUITS.diamonds, 1], ["5", SUITS.hearts, 0], ["5", SUITS.spades, 0],
    ["6", SUITS.hearts, 1], ["6", SUITS.spades, 1], ["7", SUITS.clubs, 0], ["7", SUITS.spades, 0],
    ["8", SUITS.clubs, 1], ["8", SUITS.hearts, 0], ["9", SUITS.clubs, 1], ["9", SUITS.hearts, 0],
    ["10", SUITS.hearts, 0],
    ["Q", SUITS.clubs, 1], ["Q", SUITS.diamonds, 0], ["Q", SUITS.diamonds, 1], ["Q", SUITS.spades, 0],
    ["2", SUITS.hearts, 1], ["K", SUITS.diamonds, 1],
  ]);
  const bomb5 = classifyPlay(cards([
    ["5", SUITS.clubs, 0], ["5", SUITS.diamonds, 1], ["5", SUITS.hearts, 0], ["5", SUITS.spades, 0],
  ]), "2");
  const bombQ = classifyPlay(cards([
    ["Q", SUITS.clubs, 1], ["Q", SUITS.diamonds, 0], ["Q", SUITS.diamonds, 1], ["Q", SUITS.spades, 0],
  ]), "2");
  const mustBeatBJ = classifyPlay([createCard("BJ", SUITS.joker, 1)], "2");
  const qa = tryLocalCoachAnswer("为什么让我拆同花顺来凑四个5的炸？", {
    status: "in-progress",
    levelRank: "2",
    turnNumber: 12,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: mustBeatBJ },
    currentAdvice: {
      choices: [
        { play: bomb5, reasons: ["只有炸弹能压，这手应抢牌权"] },
        { play: bombQ, reasons: ["【P7】压王用小炸够用，不宜动用更大炸"] },
      ],
    },
  });
  assert(qa?.mode === "why-break-bomb-structure", `拆同花顺凑炸应走专答，实际 ${qa?.mode}`);
  assert(qa?.mode !== "why-not-play", "不应落入 why-not-play 泛答");
  assert(/你的理解对|不应.*拆.*同花顺/.test(qa.text), "应认可用户质疑");
  assert(/同花顺/.test(qa.text), "应点明同花顺");
  assert(/5|四炸/.test(qa.text), "应点明四炸5");
  assert(/Q|四炸Q|候选/.test(qa.text), "应建议替代炸");
  assert(!qa.text.includes("当前推荐："), "不应只罗列推荐");
  assert(qa.text.split("\n").filter((line) => line.trim()).length <= 5, "作答应不超过5行");
});

scenario("QA-game2-有对5对Q可带不应拆三个2", "P2", () => {
  const hand = cards([
    ["2", SUITS.diamonds, 1], ["2", SUITS.hearts, 0], ["2", SUITS.hearts, 1],
    ["4", SUITS.clubs, 0], ["4", SUITS.clubs, 1], ["4", SUITS.hearts, 0],
    ["5", SUITS.diamonds, 1], ["5", SUITS.hearts, 0], ["5", SUITS.spades, 0],
    ["7", SUITS.clubs, 0],
    ["9", SUITS.clubs, 0], ["9", SUITS.clubs, 1], ["9", SUITS.diamonds, 1], ["9", SUITS.hearts, 0],
    ["10", SUITS.clubs, 0], ["J", SUITS.clubs, 0], ["J", SUITS.diamonds, 0], ["J", SUITS.hearts, 1],
    ["Q", SUITS.clubs, 0], ["Q", SUITS.diamonds, 0], ["Q", SUITS.hearts, 0], ["Q", SUITS.spades, 0],
    ["K", SUITS.clubs, 0], ["K", SUITS.diamonds, 0],
    ["SJ", SUITS.joker, 0], ["BJ", SUITS.joker, 0], ["10", SUITS.diamonds, 0],
  ]);
  const top444Pair2 = {
    type: PLAY_TYPES.tripleWithPair,
    mainRank: "4",
    label: "三带二 梅花4 梅花4 红桃4 方片2 红桃2",
    cards: hand.filter((c) => c.rank === "4" || (c.rank === "2" && c.suit !== SUITS.diamonds)),
  };
  const alt444Pair5 = generateBasicCandidates(hand, "3", null)
    .find((c) => c.type === PLAY_TYPES.tripleWithPair && c.mainRank === "4"
      && (c.cards ?? []).filter((card) => card.rank === "5").length >= 2);
  const qa = tryLocalCoachAnswer("怎么还是拆三个2，有对5和对Q可以带？", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 0,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: null },
    currentAdvice: {
      choices: [
        { play: top444Pair2, reasons: ["开局减手"] },
        ...(alt444Pair5 ? [{ play: alt444Pair5, reasons: ["带对5保留三同张2"] }] : []),
      ],
    },
  });
  assert(qa?.mode === "why-not-play", `有对5对Q专问应走 why-not-play，实际 ${qa?.mode}`);
  assert(qa?.mode !== "structure-break", "不应落入 structure-break 泛拆答");
  assert(/并未拆三个2|只是带牌/.test(qa.text), "应先澄清是否拆了三个2");
  assert(/对5|对Q/.test(qa.text), "应正面回应带对5/对Q");
  assert(/444\+|三个4|4×3/.test(qa.text), "应说明三条是4不是2");
  assert(!qa.text.includes("不成炸") || qa.text.includes("三个2"), "不应答非所问只讲2不成炸");
  assert(qa.text.split("\n").filter((line) => line.trim()).length <= 5, "作答应不超过5行");
});

scenario("QA-game2-带对J不应拆三个8", "P2", () => {
  const hand = cards([
    ["4", SUITS.clubs, 0], ["4", SUITS.hearts, 0], ["4", SUITS.spades, 1],
    ["8", SUITS.diamonds, 1], ["8", SUITS.hearts, 1], ["8", SUITS.spades, 1],
    ["J", SUITS.spades, 0], ["J", SUITS.spades, 1],
    ["7", SUITS.clubs, 0], ["7", SUITS.diamonds, 0], ["7", SUITS.diamonds, 1], ["7", SUITS.spades, 1],
    ["2", SUITS.hearts, 1], ["6", SUITS.hearts, 1], ["9", SUITS.hearts, 1],
    ["10", SUITS.clubs, 0], ["10", SUITS.clubs, 1], ["10", SUITS.diamonds, 1],
    ["10", SUITS.spades, 0], ["10", SUITS.spades, 1],
    ["K", SUITS.clubs, 0], ["K", SUITS.diamonds, 0], ["K", SUITS.hearts, 1], ["K", SUITS.spades, 0],
    ["A", SUITS.hearts, 0], ["A", SUITS.hearts, 1],
    ["Q", SUITS.clubs, 0],
  ]);
  const top444Pair8 = {
    type: PLAY_TYPES.tripleWithPair,
    mainRank: "4",
    label: "三带二 梅花4 红桃4 黑桃4 方片8 红桃8",
    cards: hand.filter((c) => (c.rank === "4") || (c.rank === "8" && (c.suit === SUITS.diamonds || c.suit === SUITS.hearts))),
  };
  const alt444PairJ = generateBasicCandidates(hand, "3", null)
    .find((c) => c.type === PLAY_TYPES.tripleWithPair && c.mainRank === "4"
      && (c.cards ?? []).filter((card) => card.rank === "J").length >= 2);
  const qa = tryLocalCoachAnswer("应该直接带对J，不应该拆三个8", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 0,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: null },
    currentAdvice: {
      choices: [
        { play: top444Pair8, reasons: ["拆三张4组其他牌型代价偏高", "接风减手"] },
        ...(alt444PairJ ? [{ play: alt444PairJ, reasons: ["带对J保留三同张8"] }] : []),
      ],
    },
  });
  assert(qa?.mode === "why-not-play", `带对J专问应走 why-not-play，实际 ${qa?.mode}`);
  assert(qa?.mode !== "structure-break", "不应落入 structure-break 泛拆答");
  assert(qa.text.includes("对J"), "应正面回应带对J");
  assert(/三个8|三同张8|8×3|888/.test(qa.text), "应点明三个8/三同张8");
  assert(qa.text.includes("并未拆三个8") || qa.text.includes("会拆三个8"), "应说明是否拆了三个8");
  assert(
    qa.text.includes("有道理") || qa.text.includes("改带对J") || qa.text.includes("带对J"),
    "应认可或应用带对J思路",
  );
  assert(!qa.text.includes("不成炸"), "不应绕开用户关切只讲8不成炸");
  assert(qa.text.split("\n").filter((line) => line.trim()).length <= 5, "作答应不超过5行");
});

scenario("QA-game2-Top1拆三个8应带对J", "P2", () => {
  const hand = cards([
    ["8", SUITS.clubs, 0], ["8", SUITS.diamonds, 1], ["8", SUITS.hearts, 0],
    ["J", SUITS.clubs, 1], ["J", SUITS.spades, 1],
    ["3", SUITS.diamonds, 1], ["3", SUITS.spades, 1],
    ["9", SUITS.clubs, 0], ["9", SUITS.diamonds, 0],
    ["10", SUITS.diamonds, 1], ["10", SUITS.hearts, 0],
    ["6", SUITS.spades, 0], ["7", SUITS.hearts, 0], ["Q", SUITS.hearts, 0],
    ["K", SUITS.diamonds, 0], ["A", SUITS.clubs, 0], ["2", SUITS.spades, 1],
  ]);
  const top888Pair3 = generateBasicCandidates(hand, "3", null)
    .find((c) => c.type === PLAY_TYPES.tripleWithPair && c.mainRank === "8");
  assert(top888Pair3, "应能组三带二888");
  const alt888PairJ = generateBasicCandidates(hand, "3", null)
    .find((c) => c.type === PLAY_TYPES.tripleWithPair && c.mainRank === "8"
      && (c.cards ?? []).filter((card) => card.rank === "J").length >= 2);
  const qa = tryLocalCoachAnswer("应该直接带对J，不应该拆三个8", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 5,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: null },
    currentAdvice: {
      choices: [
        { play: top888Pair3, reasons: ["接风减手"] },
        ...(alt888PairJ ? [{ play: alt888PairJ, reasons: ["带对J"] }] : []),
      ],
    },
  });
  assert(qa?.mode === "why-not-play", "Top1拆888应走 why-not-play");
  assert(qa.text.includes("对J"), "应回应带对J");
  assert(/拆三个8|会拆三个8/.test(qa.text), "应承认推荐1拆了三个8");
  assert(qa.text.includes("思路对") || qa.text.includes("改带对J") || qa.text.includes("带对J"), "应认可带对J");
});

scenario("QA-game2-为什么不推荐三个9带对3", "P2", () => {
  const hand = cards([
    ["9", SUITS.spades, 0], ["9", SUITS.hearts, 0], ["9", SUITS.clubs, 0],
    ["3", SUITS.diamonds, 0], ["3", SUITS.hearts, 0],
    ["K", SUITS.spades, 0], ["K", SUITS.diamonds, 0],
    ["7", SUITS.clubs, 0], ["7", SUITS.diamonds, 0],
    ["4", SUITS.spades, 0], ["5", SUITS.hearts, 0], ["6", SUITS.clubs, 0],
    ["8", SUITS.spades, 0], ["10", SUITS.diamonds, 0],
    ["J", SUITS.clubs, 0], ["Q", SUITS.hearts, 0], ["A", SUITS.spades, 0],
    ["2", SUITS.hearts, 1],
  ]);
  const top999PairK = {
    type: PLAY_TYPES.tripleWithPair,
    mainRank: "9",
    label: "三带二 黑桃9 红桃9 梅花9 黑桃K 方片K",
    cards: hand.filter((c) => c.rank === "9" || c.rank === "K"),
  };
  const alt999Pair3 = generateBasicCandidates(hand, "2", null)
    .find((c) => c.type === PLAY_TYPES.tripleWithPair && c.mainRank === "9"
      && (c.cards ?? []).filter((card) => card.rank === "3").length >= 2);
  assert(alt999Pair3, "应能组三带二999+33");
  const qa = tryLocalCoachAnswer("为什么不推荐三个9带对3？", {
    status: "in-progress",
    levelRank: "2",
    turnNumber: 5,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: null },
    currentAdvice: {
      choices: [
        { play: top999PairK, reasons: ["接风减手", "带大牌多减两张"] },
        { play: alt999Pair3, reasons: ["带小对保留对3"] },
      ],
    },
  });
  assert(qa?.mode === "why-not-play", `同三条带对专问应走 why-not-play，实际 ${qa?.mode}`);
  assert(/对3|33/.test(qa.text), "应正面回应带对3");
  assert(/对K|KK/.test(qa.text), "应说明首推带对K");
  assert(/带对|三带二/.test(qa.text), "应解释带对取舍");
  assert(/不影响大小|只看三条/.test(qa.text), "应说明带对不影响比牌");
  assert(/多丢|留着|减手/.test(qa.text), "应说明为何带对K优于带对3");
  assert(!qa.text.includes("你在问为何不采用"), "不应落入泛答模板");
  assert(qa.text.split("\n").filter((line) => line.trim()).length <= 5, "作答应不超过5行");
});

function buildGame2Turn16BombOnlyState() {
  const hand = cards([
    ["3", SUITS.spades, 1],
    ["6", SUITS.spades, 0],
    ["7", SUITS.hearts, 0], ["7", SUITS.hearts, 1],
    ["8", SUITS.spades, 0], ["8", SUITS.spades, 1],
    ["10", SUITS.diamonds, 0], ["10", SUITS.diamonds, 1],
    ["J", SUITS.clubs, 1], ["J", SUITS.hearts, 1], ["J", SUITS.spades, 1],
    ["Q", SUITS.clubs, 1], ["Q", SUITS.hearts, 0], ["Q", SUITS.spades, 0], ["Q", SUITS.spades, 1],
    ["K", SUITS.spades, 1],
    ["A", SUITS.clubs, 1], ["A", SUITS.diamonds, 0],
    ["BJ", SUITS.joker, 1],
  ]);
  const prev = classifyPlay(cards([["BJ", SUITS.joker, 0]]), "3");
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: prev,
    lastActivePlayerIndex: 3,
    playHistory: [
      { turnNumber: 1, playerIndex: 0, play: classifyPlay(cards([["3", SUITS.diamonds, 0]]), "3") },
      { turnNumber: 2, playerIndex: 1, play: classifyPlay([], "3") },
      { turnNumber: 3, playerIndex: 2, play: classifyPlay(cards([["5", SUITS.clubs, 0], ["5", SUITS.hearts, 0]]), "3") },
      { turnNumber: 4, playerIndex: 3, play: prev },
    ],
  };
  return { hand, prev, state };
}

scenario("P7-game2-turn16-压大王不过牌", "P7", () => {
  const { hand, prev, state } = buildGame2Turn16BombOnlyState();
  const rec = recommendPlay(hand, "3", prev, {
    state,
    playerIndex: 0,
    mlFusionMode: "on",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.bomb && rec.candidate.mainRank === "Q",
    `game-2 turn16 压大王应四炸Q，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
  const allCands = generateBasicCandidates(hand, "3", prev);
  const passScored = scoreCandidate(classifyPlay([], "3"), hand, "3", prev, {
    ...enrichScoringContext(
      { state, playerIndex: 0, previousPlay: prev, lastActivePlayerIndex: 3 },
      allCands,
      hand,
      "3",
    ),
    _candidates: allCands,
    hasActionableRegularWinner: false,
    hasAnyWinner: true,
  });
  assert(
    passScored.score > rec.score,
    `过牌得分应劣于炸弹，pass=${passScored.score} bomb=${rec.score}`,
  );
  assert(
    !passScored.reasons.some((r) => /队友本墩已出/.test(r)),
    `对手占牌不应误用 P10，实际 ${passScored.reasons.join("；")}`,
  );
  assert(
    passScored.reasons.some((r) => /不宜过牌|须压王/.test(r)),
    `应说明不宜过牌，实际 ${passScored.reasons.join("；")}`,
  );
  const top2 = getTurnAdvice(state, 0, { mlFusionMode: "on", mlModel: null }).alternatives.slice(0, 2);
  assert(
    !top2.some((item) => item.candidate.type === PLAY_TYPES.pass),
    "Top2 不得为过牌",
  );
});

scenario("P10-game2-turn40-对手抬高不误用P10", "P10", () => {
  const hand = cards([
    ["3", SUITS.spades, 1],
    ["6", SUITS.spades, 0],
    ["10", SUITS.diamonds, 0], ["10", SUITS.diamonds, 1],
    ["J", SUITS.clubs, 1], ["J", SUITS.hearts, 1], ["J", SUITS.spades, 1],
    ["Q", SUITS.clubs, 1], ["Q", SUITS.hearts, 0], ["Q", SUITS.spades, 0], ["Q", SUITS.spades, 1],
    ["A", SUITS.clubs, 1], ["A", SUITS.diamonds, 0],
    ["BJ", SUITS.joker, 1],
  ]);
  const prev = classifyPlay(cards([["A", SUITS.spades, 0], ["A", SUITS.spades, 1]]), "3");
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: prev,
    lastActivePlayerIndex: 3,
    playHistory: [
      { turnNumber: 1, playerIndex: 0, play: classifyPlay(cards([["8", SUITS.spades, 0], ["8", SUITS.spades, 1]]), "3") },
      { turnNumber: 2, playerIndex: 1, play: classifyPlay([], "3") },
      { turnNumber: 3, playerIndex: 2, play: classifyPlay(cards([["K", SUITS.clubs, 0], ["K", SUITS.hearts, 0]]), "3") },
      { turnNumber: 4, playerIndex: 3, play: prev },
    ],
  };
  const rec = recommendPlay(hand, "3", prev, {
    state,
    playerIndex: 0,
    mlFusionMode: "on",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.bomb && rec.candidate.mainRank === "Q",
    `game-2 turn40 对手对A占牌应四炸Q，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
  const passItem = getTurnAdvice(state, 0, { mlFusionMode: "on", mlModel: null })
    .alternatives.find((item) => item.candidate.type === PLAY_TYPES.pass);
  assert(
    !passItem?.reasons.some((r) => /队友本墩已出/.test(r)),
    `你先出、对手抬高时不应写队友本墩，实际 ${passItem?.reasons?.join("；")}`,
  );
});

scenario("P10-game2-turn40-队友四炸A应过牌", "P10", () => {
  const hand = cards([
    ["8", SUITS.clubs, 0], ["8", SUITS.diamonds, 0], ["8", SUITS.hearts, 0], ["8", SUITS.spades, 0], ["8", SUITS.spades, 1],
    ["J", SUITS.clubs, 0], ["J", SUITS.clubs, 1], ["J", SUITS.diamonds, 0], ["J", SUITS.spades, 0], ["J", SUITS.spades, 1],
    ["6", SUITS.hearts, 0],
  ]);
  const prev = classifyPlay(cards([
    ["A", SUITS.diamonds, 0], ["A", SUITS.hearts, 0], ["A", SUITS.spades, 0], ["A", SUITS.clubs, 1],
  ]), "3");
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: prev,
    lastActivePlayerIndex: 2,
    playHistory: [
      { turnNumber: 1, playerIndex: 0, play: classifyPlay(cards([["6", SUITS.hearts, 0]]), "3") },
      { turnNumber: 2, playerIndex: 1, play: classifyPlay([], "3") },
      { turnNumber: 3, playerIndex: 2, play: prev },
      { turnNumber: 4, playerIndex: 3, play: classifyPlay([], "3") },
    ],
  };
  const rec = recommendPlay(hand, "3", prev, {
    state,
    playerIndex: 0,
    lastActivePlayerIndex: 2,
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.pass,
    `game-2 turn40 队友四炸A占牌应过牌，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
  assert(
    rec.reasons.some((r) => /队友占牌|P10/.test(r)),
    `应说明队友占牌让牌，实际 ${rec.reasons.join("；")}`,
  );
});

scenario("P5-game2-turn48-压级牌对3须炸", "P7", () => {
  const hand = cards([
    ["J", SUITS.clubs, 0], ["J", SUITS.clubs, 1], ["J", SUITS.diamonds, 0], ["J", SUITS.spades, 0], ["J", SUITS.spades, 1],
    ["6", SUITS.spades, 0],
    ["10", SUITS.diamonds, 0], ["10", SUITS.diamonds, 1],
    ["Q", SUITS.clubs, 1], ["Q", SUITS.hearts, 0], ["Q", SUITS.spades, 0], ["Q", SUITS.spades, 1],
    ["A", SUITS.clubs, 1], ["A", SUITS.diamonds, 0],
  ]);
  const prev = classifyPlay(cards([["3", SUITS.spades, 1], ["3", SUITS.hearts, 0]]), "3");
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: prev,
    lastActivePlayerIndex: 1,
    playHistory: [
      { turnNumber: 1, playerIndex: 1, play: prev },
    ],
  };
  const rec = recommendPlay(hand, "3", prev, {
    state,
    playerIndex: 0,
    mlFusionMode: "on",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.bomb
      && rec.candidate.mainRank === "J"
      && (rec.candidate.bombSize ?? rec.candidate.cards?.length) === 5,
    `game-2 turn48 压级牌对3应满张五炸J，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
  const allCands = generateBasicCandidates(hand, "3", prev);
  const passScored = scoreCandidate(classifyPlay([], "3"), hand, "3", prev, {
    ...enrichScoringContext(
      { state, playerIndex: 0, previousPlay: prev, lastActivePlayerIndex: 1 },
      allCands,
      hand,
      "3",
    ),
    _candidates: allCands,
    hasActionableRegularWinner: false,
    hasAnyWinner: true,
  });
  assert(
    !passScored.reasons.some((r) => /队友本墩已出/.test(r)),
    `须压级牌对3时过牌不应误用 P10，实际 ${passScored.reasons.join("；")}`,
  );
  assert(
    passScored.score > rec.score,
    `过牌得分应劣于五炸J，pass=${passScored.score} bomb=${rec.score}`,
  );
});

scenario("ENFORCE-须压王过牌不进Top3", "P7", () => {
  const { hand, prev, state } = buildGame2Turn16BombOnlyState();
  const allCands = generateBasicCandidates(hand, "3", prev);
  const passPlay = classifyPlay([], "3");
  const bombQ = allCands.find((c) => c.type === PLAY_TYPES.bomb && c.mainRank === "Q");
  const ctx = {
    ...enrichScoringContext(
      { state, playerIndex: 0, previousPlay: prev, lastActivePlayerIndex: 3 },
      allCands,
      hand,
      "3",
    ),
    _candidates: allCands,
    hasActionableRegularWinner: false,
    hasAnyWinner: true,
  };
  const scored = [
    { candidate: passPlay, score: -500, reasons: ["测试桩"] },
    { candidate: bombQ, score: -811, reasons: ["只有炸弹能压"] },
  ];
  const { candidates } = enforceDoctrineOnCandidates(scored, { ...ctx, hand, levelRank: "3" });
  const top3 = candidates.slice(0, 3);
  assert(
    !top3.some((item) => item.candidate.type === PLAY_TYPES.pass),
    "须压王时过牌不得进 Top3",
  );
  assert(candidates[0].candidate.type === PLAY_TYPES.bomb, "Top1 应为炸弹");
});

scenario("QA-怎么打5拆顺子无mustBeat", "P1", () => {
  const hand = cards([
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
  const qa = tryLocalCoachAnswer("怎么打5拆顺子", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 16,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: {},
    currentAdvice: { choices: [] },
  });
  assert(qa?.mode === "why-not-play", "怎么打5拆顺子应走 why-not-play");
  assert(/是.*拆.*顺/.test(qa.text), "应直接答会拆顺子");
  assert(qa.text.includes("应出单8") || qa.text.includes("散单8"), "有单8必须写应出单8");
});

// —— game-3 seed 969532222 用户纠正 turn0 开局小单试探 ——
scenario("P6-game3-turn0-大王回收先小单试探", "P6", () => {
  const hand = cards([
    ["2", SUITS.diamonds, 0], ["2", SUITS.diamonds, 1],
    ["4", SUITS.clubs, 0], ["4", SUITS.clubs, 1], ["4", SUITS.diamonds, 0],
    ["6", SUITS.spades, 0],
    ["7", SUITS.diamonds, 1], ["7", SUITS.spades, 1],
    ["8", SUITS.diamonds, 0], ["8", SUITS.diamonds, 1], ["8", SUITS.hearts, 1], ["8", SUITS.spades, 0],
    ["9", SUITS.clubs, 1], ["9", SUITS.spades, 1],
    ["10", SUITS.hearts, 0],
    ["Q", SUITS.clubs, 0], ["Q", SUITS.diamonds, 1],
    ["K", SUITS.diamonds, 0], ["K", SUITS.diamonds, 1],
    ["A", SUITS.clubs, 0], ["A", SUITS.clubs, 1], ["A", SUITS.diamonds, 1], ["A", SUITS.hearts, 0], ["A", SUITS.spades, 0], ["A", SUITS.spades, 1],
    ["2", SUITS.hearts, 0],
    ["BJ", SUITS.joker, 0],
  ]);
  const state = createGameStateFromHands({
    levelRank: "2",
    hands: [hand, cards([["3"]]), cards([["5"]]), cards([["J"]])],
    currentPlayerIndex: 0,
  });
  const rec = recommendPlay(hand, "2", null, {
    state,
    playerIndex: 0,
    preferredGroups: buildStrategicGroups(hand, "2"),
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.single,
    `开局有大王应小单试探，实际 ${rec.candidate.label ?? rec.candidate.mainRank ?? rec.candidate.type}`,
  );
  assert(
    rec.reasons.some((r) => /P6|大王可回收|小单试探/.test(r)),
    `应引用 P6，实际 ${rec.reasons.join("；")}`,
  );
});

// —— game-3 seed 614960622 用户纠正 turn52/72 ——
scenario("P4-game3-turn52-保留对8给333过牌", "P4", () => {
  const hand = cards([
    ["3", SUITS.clubs], ["3", SUITS.diamonds, 1], ["3", SUITS.hearts, 1], ["3", SUITS.spades],
    ["4", SUITS.clubs], ["4", SUITS.spades, 1],
    ["5", SUITS.hearts], ["5", SUITS.spades],
    ["7", SUITS.clubs], ["7", SUITS.diamonds], ["7", SUITS.diamonds, 1],
    ["8", SUITS.clubs, 1], ["8", SUITS.diamonds, 1],
    ["10", SUITS.hearts],
    ["J", SUITS.clubs, 1],
    ["Q", SUITS.clubs, 1], ["Q", SUITS.diamonds, 1], ["Q", SUITS.hearts, 1], ["Q", SUITS.spades],
    ["K", SUITS.hearts],
    ["A", SUITS.hearts, 1],
    ["SJ", SUITS.joker, 1],
  ]);
  const prev = classifyPlay(cards([["7", SUITS.hearts], ["7", SUITS.spades, 1]]), "3");
  const ctx = {
    previousPlay: prev,
    isOpening: false,
    leadMode: "must-beat",
    opponentActive: true,
    hasRegularWinner: true,
    playerIndex: 0,
    lastActivePlayerIndex: 1,
    mlFusionMode: "off",
    mlModel: false,
  };
  const rec = recommendPlay(hand, "3", prev, ctx);
  assert(rec.candidate.type === PLAY_TYPES.pass, `turn52 应过牌保留对8，实际 ${rec.candidate.type}`);
  assert(rec.reasons.some((r) => /三个3|保留对8|三带二/.test(r)), "应说明保留对8给三带二");
});

scenario("P4-game3-turn52-ML强制仍过牌", "P4", () => {
  const hand = cards([
    ["3", SUITS.clubs], ["3", SUITS.diamonds, 1], ["3", SUITS.hearts, 1], ["3", SUITS.spades],
    ["4", SUITS.clubs], ["4", SUITS.spades, 1],
    ["5", SUITS.hearts], ["5", SUITS.spades],
    ["7", SUITS.clubs], ["7", SUITS.diamonds], ["7", SUITS.diamonds, 1],
    ["8", SUITS.clubs, 1], ["8", SUITS.diamonds, 1],
    ["10", SUITS.hearts],
    ["J", SUITS.clubs, 1],
    ["Q", SUITS.clubs, 1], ["Q", SUITS.diamonds, 1], ["Q", SUITS.hearts, 1], ["Q", SUITS.spades],
    ["K", SUITS.hearts],
    ["A", SUITS.hearts, 1],
    ["SJ", SUITS.joker, 1],
  ]);
  const prev = classifyPlay(cards([["7", SUITS.hearts], ["7", SUITS.spades, 1]]), "3");
  const ctx = {
    previousPlay: prev,
    isOpening: false,
    leadMode: "must-beat",
    opponentActive: true,
    hasRegularWinner: true,
    playerIndex: 0,
    lastActivePlayerIndex: 1,
    mlFusionMode: "force",
    mlModel: loadTestMlModel(),
    state: {
      levelRank: "3",
      currentPlayerIndex: 0,
      lastActivePlayerIndex: 1,
      lastActivePlay: prev,
      players: [
        { seatIndex: 0, hand, finishedOrder: null },
        { seatIndex: 1, hand: Array(12).fill({ rank: "3", suit: "C", deckIndex: 0 }), finishedOrder: null },
        { seatIndex: 2, hand: Array(11).fill({ rank: "3", suit: "C", deckIndex: 0 }), finishedOrder: null },
        { seatIndex: 3, hand: Array(12).fill({ rank: "3", suit: "C", deckIndex: 0 }), finishedOrder: null },
      ],
    },
  };
  if (!ctx.mlModel) return;
  const rec = recommendPlay(hand, "3", prev, ctx);
  assert(rec.candidate.type === PLAY_TYPES.pass, `ML force 下 turn52 仍应过牌，实际 ${rec.candidate.type}`);
});

scenario("P4-game3-turn52-无候选表仍过牌", "P4", () => {
  const hand = cards([
    ["3", SUITS.clubs], ["3", SUITS.diamonds, 1], ["3", SUITS.hearts, 1], ["3", SUITS.spades],
    ["4", SUITS.clubs], ["4", SUITS.spades, 1],
    ["5", SUITS.hearts], ["5", SUITS.spades],
    ["7", SUITS.clubs], ["7", SUITS.diamonds], ["7", SUITS.diamonds, 1],
    ["8", SUITS.clubs, 1], ["8", SUITS.diamonds, 1],
    ["10", SUITS.hearts],
    ["J", SUITS.clubs, 1],
    ["Q", SUITS.clubs, 1], ["Q", SUITS.diamonds, 1], ["Q", SUITS.hearts, 1], ["Q", SUITS.spades],
    ["K", SUITS.hearts],
    ["A", SUITS.hearts, 1],
    ["SJ", SUITS.joker, 1],
  ]);
  const prev = classifyPlay(cards([["7", SUITS.hearts], ["7", SUITS.spades, 1]]), "3");
  const allCandidates = generateBasicCandidates(hand, "3", prev);
  allCandidates.push(classifyPlay([], "3"));
  const pass = allCandidates.find((c) => c.type === PLAY_TYPES.pass);
  const pair8 = allCandidates.find((c) => c.type === PLAY_TYPES.pair && c.mainRank === "8");
  assert(pass && pair8, "应有 pass 与对8 候选");
  const ctx = {
    previousPlay: prev,
    isOpening: false,
    leadMode: "must-beat",
    opponentActive: true,
    hasRegularWinner: true,
    playerIndex: 0,
    lastActivePlayerIndex: 1,
    mlFusionMode: "off",
    danger: 0,
    hasAnyWinner: true,
    _candidates: [pass, pair8],
  };
  const passScored = scoreCandidate(pass, hand, "3", prev, ctx);
  const pairScored = scoreCandidate(pair8, hand, "3", prev, ctx);
  assert(Number.isFinite(pairScored.score), "对8 分数应有效");
  assert(passScored.score < pairScored.score, `无完整候选表时过牌仍应优于拆对8（pass=${passScored.score} pair8=${pairScored.score}）`);
});

scenario("P5-game3-turn72-接风QQQ带对8", "P5", () => {
  const hand = cards([
    ["3", SUITS.hearts, 1],
    ["8", SUITS.clubs, 1], ["8", SUITS.diamonds, 1],
    ["10", SUITS.hearts],
    ["J", SUITS.clubs, 1],
    ["Q", SUITS.clubs, 1], ["Q", SUITS.diamonds, 1], ["Q", SUITS.hearts, 1], ["Q", SUITS.spades],
    ["K", SUITS.hearts],
    ["A", SUITS.hearts, 1],
    ["SJ", SUITS.joker, 1],
  ]);
  const ctx = {
    previousPlay: null,
    isOpening: true,
    leadMode: "catch-wind",
    opponentActive: false,
    hasRegularWinner: false,
    playerIndex: 0,
    mlFusionMode: "off",
    mlModel: false,
  };
  const rec = recommendPlay(hand, "3", null, ctx);
  assert(
    rec.candidate.type === PLAY_TYPES.tripleWithPair && rec.candidate.mainRank === "Q",
    `turn72 应三带二QQQ+88，实际 ${rec.candidate.type} ${rec.candidate.mainRank ?? ""}`,
  );
  const pairRanks = rec.candidate.cards.filter((c) => c.rank !== "Q").map((c) => c.rank);
  assert(pairRanks.every((r) => r === "8"), "三带二应带对8");
});

scenario("QA-game3-turn52-为什么不用对8压", "P4", () => {
  const hand = cards([
    ["3", SUITS.clubs], ["3", SUITS.diamonds, 1], ["3", SUITS.hearts, 1], ["3", SUITS.spades],
    ["4", SUITS.clubs], ["4", SUITS.spades, 1],
    ["5", SUITS.hearts], ["5", SUITS.spades],
    ["7", SUITS.clubs], ["7", SUITS.diamonds], ["7", SUITS.diamonds, 1],
    ["8", SUITS.clubs, 1], ["8", SUITS.diamonds, 1],
    ["10", SUITS.hearts],
    ["J", SUITS.clubs, 1],
    ["Q", SUITS.clubs, 1], ["Q", SUITS.diamonds, 1], ["Q", SUITS.hearts, 1], ["Q", SUITS.spades],
    ["K", SUITS.hearts],
    ["A", SUITS.hearts, 1],
    ["SJ", SUITS.joker, 1],
  ]);
  const mustBeat = classifyPlay(cards([["7", SUITS.hearts], ["7", SUITS.spades, 1]]), "3");
  const qa = tryLocalCoachAnswer("为什么不用对8压对7？要留对8给三个3", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 52,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: mustBeat },
    currentAdvice: { choices: [] },
  });
  assert(qa?.text, "应有规则引擎作答");
  assert(/三个3|保留对8|三带二/.test(qa.text), "应解释留对8给三个3三带二");
});

// —— game-3 seed 614960622 用户纠正 turn84 ——
scenario("P7-game3-turn84-先小王压再同花顺走完", "P7", () => {
  const hand = cards([
    ["3", SUITS.hearts, 1],
    ["10", SUITS.hearts, 0],
    ["Q", SUITS.hearts, 1],
    ["K", SUITS.hearts, 0],
    ["A", SUITS.hearts, 1],
    ["SJ", SUITS.joker, 1],
  ]);
  const prev = classifyPlay(cards([["10", SUITS.diamonds, 1]]), "3");
  const ctx = {
    previousPlay: prev,
    isOpening: false,
    leadMode: "must-beat",
    opponentActive: true,
    hasRegularWinner: true,
    playerIndex: 0,
    lastActivePlayerIndex: 1,
    mlFusionMode: "off",
    mlModel: false,
  };
  const rec = recommendPlay(hand, "3", prev, ctx);
  assert(
    rec.candidate.type === PLAY_TYPES.single && rec.candidate.mainRank === "SJ",
    `turn84 应小王压牌，实际 ${rec.candidate.type} ${rec.candidate.mainRank ?? ""}`,
  );
  assert(
    rec.reasons.some((r) => /先王夺权|同花顺留下一手走完|怕被大炸反压/.test(r)),
    "应说明先王后同花顺",
  );
});

scenario("P7-game3-turn87-接风同花顺走完", "P7", () => {
  const hand = cards([
    ["3", SUITS.hearts, 1],
    ["10", SUITS.hearts, 0],
    ["Q", SUITS.hearts, 1],
    ["K", SUITS.hearts, 0],
    ["A", SUITS.hearts, 1],
  ]);
  const ctx = {
    previousPlay: null,
    isOpening: true,
    leadMode: "catch-wind",
    mlFusionMode: "off",
    mlModel: false,
  };
  const rec = recommendPlay(hand, "3", null, ctx);
  assert(
    rec.candidate.type === PLAY_TYPES.straightFlush,
    `turn87 接风应同花顺走完，实际 ${rec.candidate.type}`,
  );
});

scenario("QA-game3-turn84-只剩小王和同花顺先出哪个", "P7", () => {
  const hand = cards([
    ["3", SUITS.hearts, 1],
    ["10", SUITS.hearts, 0],
    ["Q", SUITS.hearts, 1],
    ["K", SUITS.hearts, 0],
    ["A", SUITS.hearts, 1],
    ["SJ", SUITS.joker, 1],
  ]);
  const prev = classifyPlay(cards([["10", SUITS.diamonds, 1]]), "3");
  const qa = tryLocalCoachAnswer("只剩小王和同花顺先出哪个", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 84,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: prev },
    currentAdvice: { choices: [] },
  });
  assert(qa?.text, "应有规则引擎作答");
  assert(/先.*王|小王.*夺权/.test(qa.text), "应先出王");
  assert(/同花顺.*走完|留.*同花顺/.test(qa.text), "应留同花顺接风走完");
});

scenario("P5-接风三张8不拆连对8899", "P5", () => {
  const hand = cards([
    ["6", "C", 0], ["6", "D", 0], ["6", "H", 0], ["6", "S", 0],
    ["Q", "C", 0], ["Q", "D", 0], ["Q", "H", 0], ["Q", "S", 0],
    ["8", "C", 0], ["8", "D", 0], ["8", "H", 0],
    ["4", "C", 0], ["4", "D", 0],
    ["9", "C", 0], ["9", "D", 0],
    ["10", "C", 0], ["10", "D", 0],
    ["K", "C", 0], ["K", "D", 0],
    ["A", "C", 0], ["A", "D", 0],
    ["2", "C", 0], ["5", "C", 0], ["7", "C", 0], ["J", "C", 0],
    ["SJ", "JOKER", 0], ["BJ", "JOKER", 0],
  ]);
  let state = createGameStateFromHands({
    levelRank: "2",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: null, playHistory: [] };

  const rec = recommendPlay(hand, "2", null, {
    state,
    playerIndex: 0,
    mlFusionMode: "on",
    mlModel: false,
  });
  const breaksTriple8 = rec.candidate.type === PLAY_TYPES.consecutivePairs
    && (rec.candidate.cards ?? []).filter((card) => card.rank === "8").length >= 2;
  assert(
    !breaksTriple8,
    `接风/开局有三张8时不应首推8899连对，实际 ${rec.candidate.label ?? rec.candidate.type} main=${rec.candidate.mainRank}`,
  );
  const goodTop1 = (rec.candidate.type === PLAY_TYPES.tripleWithPair && rec.candidate.mainRank === "8")
    || (rec.candidate.type === PLAY_TYPES.consecutivePairs
      && (rec.candidate.cards ?? []).filter((card) => card.rank === "8").length === 0);
  assert(
    goodTop1,
    `应首推888三带二或不拆8的连对，实际 ${rec.candidate.type} main=${rec.candidate.mainRank}`,
  );

  const allCands = generateBasicCandidates(hand, "2", null);
  const ctx = enrichScoringContext({ state, playerIndex: 0, previousPlay: null }, allCands, hand, "2");
  const badCp = allCands.find(
    (c) => c.type === PLAY_TYPES.consecutivePairs
      && (c.cards ?? []).filter((card) => card.rank === "8").length >= 2,
  );
  assert(badCp, "应能生成8899连对候选");
  const violations = detectDoctrineViolations(badCp, hand, "2", { ...ctx, _candidates: allCands });
  assert(
    violations.some((v) => v.code === "P5" && /三带二|拆.*8|连对/.test(v.summary)),
    `8899连对应判 P5 违规，实际 ${violations.map((v) => v.summary).join(";")}`,
  );
});

// —— game-2 seed 618655040 turn56：接风全散单理由不误写成「有成组牌」 ——
scenario("P5-game2-turn56-接风全散单理由", "P5", () => {
  const hand = cards([
    ["2", SUITS.spades, 0],
    ["5", SUITS.clubs, 1],
    ["7", SUITS.clubs, 1],
    ["K", SUITS.diamonds, 1],
    ["BJ", SUITS.joker, 0],
  ]);
  const bombQ = classifyPlay(cards([
    ["Q", SUITS.spades, 1], ["Q", SUITS.hearts, 0], ["Q", SUITS.clubs, 1], ["Q", SUITS.diamonds, 1],
  ]), "3");
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: null,
    lastActivePlayerIndex: null,
    playHistory: [
      { turnNumber: 56, playerIndex: 0, play: bombQ },
      { turnNumber: 57, playerIndex: 1, play: classifyPlay([], "3") },
      { turnNumber: 58, playerIndex: 2, play: classifyPlay([], "3") },
      { turnNumber: 59, playerIndex: 3, play: classifyPlay([], "3") },
    ],
  };
  const rec = recommendPlay(hand, "3", null, {
    state,
    playerIndex: 0,
    mlFusionMode: "on",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.single,
    `turn56 接风全散单应推单张，实际 ${rec.candidate.label ?? rec.candidate.mainRank}`,
  );
  const reasonText = (rec.reasons ?? []).join("；");
  assert(
    !/有成组牌可减手/.test(reasonText),
    `全散单不应写「有成组牌可减手」，实际 ${reasonText}`,
  );
  assert(
    /全散单|先送小牌/.test(reasonText),
    `应说明全散单先送小牌，实际 ${reasonText}`,
  );
});

// —— game-2 seed 708223280 turn32：接风三9+对K 应三带二，不宜拆三出对9 ——
scenario("P5-game2-seed708223280-turn32-接风9带K", "P5", () => {
  const hand = cards([
    ["3", SUITS.hearts, 1],
    ["6", SUITS.hearts, 1],
    ["8", SUITS.diamonds, 1],
    ["9", SUITS.clubs, 1],
    ["9", SUITS.diamonds, 1],
    ["9", SUITS.spades, 0],
    ["J", SUITS.hearts, 1],
    ["J", SUITS.spades, 0],
    ["Q", SUITS.spades, 1],
    ["K", SUITS.diamonds, 0],
    ["K", SUITS.hearts, 1],
    ["K", SUITS.spades, 0],
    ["A", SUITS.clubs, 1],
    ["A", SUITS.spades, 1],
    ["SJ", SUITS.joker, 1],
  ]);
  const bomb5 = classifyPlay(cards([
    ["5", SUITS.spades, 0], ["5", SUITS.hearts, 0], ["5", SUITS.hearts, 1],
    ["5", SUITS.clubs, 0], ["5", SUITS.diamonds, 1],
  ]), "3");
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: null,
    lastActivePlayerIndex: null,
    playHistory: [
      { turnNumber: 28, playerIndex: 0, play: bomb5 },
      { turnNumber: 29, playerIndex: 1, play: classifyPlay([], "3") },
      { turnNumber: 30, playerIndex: 2, play: classifyPlay([], "3") },
      { turnNumber: 31, playerIndex: 3, play: classifyPlay([], "3") },
    ],
  };
  const mlModel = loadTestMlModel();
  for (const mode of ["off", "smart"]) {
    const rec = recommendPlay(hand, "3", null, {
      state,
      playerIndex: 0,
      mlFusionMode: mode,
      mlModel: mode === "smart" ? mlModel : false,
    });
    assert(
      rec.candidate.type === PLAY_TYPES.tripleWithPair && rec.candidate.mainRank === "9",
      `turn32 接风应9带K三带二，ml=${mode} 实际 ${rec.candidate.label ?? rec.candidate.type}`,
    );
    const pairNine = generateBasicCandidates(hand, "3", null)
      .find((item) => item.type === PLAY_TYPES.pair && item.mainRank === "9");
    assert(pairNine, "手牌应能组对9");
    const pairScored = scoreCandidate(pairNine, hand, "3", null, {
      ...enrichScoringContext({ state, playerIndex: 0, previousPlay: null }, generateBasicCandidates(hand, "3", null), hand, "3"),
      _candidates: generateBasicCandidates(hand, "3", null),
    });
    assert(
      pairScored.score > rec.score,
      `拆三出对9得分应劣于三带二（对9=${pairScored.score} 三带二=${rec.score}）`,
    );
  }
});

// —— game-2 seed 1022941181 turn44：接风21张先单张试探，不宜7带4三带二 ——
scenario("P6-game2-seed1022941181-turn44-接风重手先单张", "P6", () => {
  const hand = cards([
    ["7", SUITS.clubs, 0], ["7", SUITS.spades, 0], ["7", SUITS.spades, 1],
    ["4", SUITS.diamonds, 0], ["4", SUITS.spades, 1],
    ["8", SUITS.clubs, 1], ["8", SUITS.hearts, 0],
    ["9", SUITS.clubs, 0], ["9", SUITS.spades, 0],
    ["K", SUITS.spades, 0],
    ["3", SUITS.hearts, 0], ["3", SUITS.diamonds, 0],
    ["5", SUITS.diamonds, 0], ["5", SUITS.spades, 0],
    ["A", SUITS.hearts, 0], ["A", SUITS.diamonds, 0],
    ["2", SUITS.diamonds, 0], ["2", SUITS.diamonds, 1],
    ["6", SUITS.clubs, 0], ["10", SUITS.hearts, 0], ["J", SUITS.clubs, 0],
  ]);
  const pair3 = classifyPlay(cards([["3", SUITS.hearts, 0], ["3", SUITS.diamonds, 0]]), "2");
  let state = createGameStateFromHands({
    levelRank: "2",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: null,
    lastActivePlayerIndex: null,
    playHistory: [
      { turnNumber: 40, playerIndex: 0, play: pair3 },
      { turnNumber: 41, playerIndex: 1, play: classifyPlay([], "2") },
      { turnNumber: 42, playerIndex: 2, play: classifyPlay([], "2") },
      { turnNumber: 43, playerIndex: 3, play: classifyPlay([], "2") },
    ],
  };
  const rec = recommendPlay(hand, "2", null, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.single,
    `turn44 接风21张应单张试探，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
  assert(
    rec.reasons.some((r) => /手牌仍多|单张试探/.test(r)),
    `应说明接风重手先试探，实际 ${rec.reasons.join("；")}`,
  );
  const triple7 = generateBasicCandidates(hand, "2", null)
    .find((item) => item.type === PLAY_TYPES.tripleWithPair && item.mainRank === "7");
  assert(triple7, "手牌应能组7带4三带二");
  assert(
    rec.candidate.type !== PLAY_TYPES.tripleWithPair || rec.candidate.mainRank !== "7",
    "不宜首推7带4三带二",
  );
});

// —— batch seed 9000 turn51：五张级牌纯炸（含逢人配）压单2 ——
scenario("P7-batch-seed9000-turn51-五张2满张炸", "P7", () => {
  function mulberry32(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  let state = createInitialGameState({ levelRank: "2", random: mulberry32(9000) });
  for (let turn = 1; turn <= 50; turn += 1) {
    state = playRecommendedTurn(state).state;
  }
  const advice = getTurnAdvice(state, state.currentPlayerIndex, {
    alternatives: 12,
    mlFusionMode: "off",
    mlModel: null,
  });
  assert(
    advice.recommendation.candidate.type === PLAY_TYPES.bomb
      && advice.recommendation.candidate.mainRank === "2"
      && (advice.recommendation.candidate.length ?? advice.recommendation.candidate.cards?.length) === 5,
    `五张2应满张五炸，实际 ${advice.recommendation.candidate.label ?? advice.recommendation.candidate.type}`,
  );
});

scenario("P12-老史同花顺接风不空扔五炸7", "P12", () => {
  const filler = cards([
    ["3", SUITS.clubs], ["6", SUITS.hearts], ["8", SUITS.clubs], ["J", SUITS.diamonds],
    ["K", SUITS.diamonds], ["A", SUITS.hearts], ["9", SUITS.spades], ["4", SUITS.spades],
  ]);
  const laoshiHand = cards([
    ["7", SUITS.clubs], ["7", SUITS.spades], ["7", SUITS.diamonds], ["7", SUITS.hearts], ["7", SUITS.hearts, 1],
    ["5", SUITS.clubs], ["6", SUITS.clubs], ["8", SUITS.spades], ["9", SUITS.clubs], ["10", SUITS.clubs],
    ["J", SUITS.clubs], ["Q", SUITS.spades], ["K", SUITS.clubs], ["A", SUITS.clubs], ["2", SUITS.diamonds], ["3", SUITS.diamonds],
  ]);
  const sfWin = classifyPlay(cards([
    ["3", SUITS.hearts], ["5", SUITS.hearts], ["6", SUITS.hearts], ["7", SUITS.hearts], ["2", SUITS.hearts],
  ]), "2");
  const passPlay = classifyPlay([], "2");
  let state = createGameStateFromHands({
    levelRank: "2",
    hands: [filler, filler, laoshiHand, filler],
    currentPlayerIndex: 2,
  });
  state = {
    ...state,
    lastActivePlay: null,
    playHistory: [
      { turnNumber: 6, playerIndex: 2, play: sfWin },
      { turnNumber: 7, playerIndex: 3, play: passPlay },
      { turnNumber: 8, playerIndex: 0, play: passPlay },
      { turnNumber: 9, playerIndex: 1, play: passPlay },
    ],
  };
  const turn = playRecommendedTurn(state, { mlFusionMode: "off", mlModel: false, lite: true });
  const top = turn.recommendation.candidate;
  assert(
    !(top.type === PLAY_TYPES.bomb && top.mainRank === "7" && (top.bombSize ?? top.cards?.length ?? 0) >= 5),
    `同花顺接风后不宜空扔五炸7，实际 ${top.label ?? top.type}`,
  );
  assert(
    top.type !== PLAY_TYPES.straightFlush || top.cards?.length === laoshiHand.length,
    `接风不宜再空扔同花顺，实际 ${top.label ?? top.type}`,
  );
});

scenario("P12-对手单2机器人不宜四炸J", "P12", () => {
  const userSingle2 = classifyPlay(cards([["2", SUITS.diamonds]]), "2");
  const maoHand = cards([
    ["J", SUITS.spades], ["J", SUITS.hearts], ["J", SUITS.diamonds], ["J", SUITS.clubs],
    ["5", SUITS.spades], ["6", SUITS.spades], ["7", SUITS.spades], ["8", SUITS.spades],
    ["9", SUITS.clubs], ["10", SUITS.clubs], ["Q", SUITS.clubs], ["K", SUITS.clubs],
    ["A", SUITS.spades], ["2", SUITS.clubs], ["3", SUITS.spades], ["4", SUITS.hearts],
    ["5", SUITS.hearts], ["6", SUITS.hearts], ["7", SUITS.clubs], ["8", SUITS.clubs], ["9", SUITS.diamonds],
  ]);
  const filler = cards([
    ["3", SUITS.clubs], ["4", SUITS.clubs], ["6", SUITS.diamonds], ["7", SUITS.diamonds],
    ["8", SUITS.diamonds], ["10", SUITS.diamonds], ["Q", SUITS.diamonds], ["K", SUITS.diamonds],
    ["A", SUITS.diamonds], ["2", SUITS.hearts], ["3", SUITS.hearts], ["4", SUITS.hearts],
    ["5", SUITS.clubs], ["6", SUITS.clubs], ["7", SUITS.hearts], ["8", SUITS.hearts],
    ["9", SUITS.hearts], ["10", SUITS.hearts], ["J", SUITS.diamonds], ["K", SUITS.hearts],
    ["A", SUITS.clubs], ["2", SUITS.spades], ["3", SUITS.diamonds], ["4", SUITS.spades],
    ["5", SUITS.diamonds],
  ]);
  let state = createGameStateFromHands({
    levelRank: "2",
    hands: [filler, filler, filler, maoHand],
    currentPlayerIndex: 3,
  });
  state = {
    ...state,
    lastActivePlay: userSingle2,
    lastActivePlayerIndex: 0,
    playHistory: [{ turnNumber: 4, playerIndex: 0, play: userSingle2 }],
  };
  const turn = playRecommendedTurn(state, { mlFusionMode: "off", mlModel: false, lite: true });
  assert(
    turn.recommendation.candidate.type !== PLAY_TYPES.bomb
      || turn.recommendation.candidate.mainRank !== "J",
    `对手单2机器人不宜四炸J，实际 ${turn.recommendation.candidate.label ?? turn.recommendation.candidate.type}`,
  );
  assert(
    turn.recommendation.candidate.type === PLAY_TYPES.pass
      || turn.recommendation.candidate.type === PLAY_TYPES.single,
    `应过牌或最小单张跟牌，实际 ${turn.recommendation.candidate.label ?? turn.recommendation.candidate.type}`,
  );
});

// —— 三带二带对：有孤立对6时不应拆连对88-99-1010带对8 ——
scenario("P5-三带二带最小对不拆连对", "P5", () => {
  const hand = cards([
    ["3", SUITS.spades, 0], ["3", SUITS.hearts, 0], ["3", SUITS.clubs, 0], ["3", SUITS.diamonds, 0],
    ["5", SUITS.spades, 0], ["5", SUITS.hearts, 0], ["5", SUITS.clubs, 0], ["5", SUITS.diamonds, 0],
    ["2", SUITS.spades, 0], ["2", SUITS.clubs, 0], ["2", SUITS.diamonds, 0],
    ["6", SUITS.clubs, 0], ["6", SUITS.diamonds, 0],
    ["J", SUITS.spades, 0], ["J", SUITS.diamonds, 0],
    ["8", SUITS.spades, 0], ["8", SUITS.diamonds, 0],
    ["9", SUITS.spades, 0], ["9", SUITS.hearts, 0],
    ["10", SUITS.clubs, 0], ["10", SUITS.hearts, 0],
    ["4", SUITS.hearts, 0], ["7", SUITS.clubs, 0], ["Q", SUITS.spades, 0], ["K", SUITS.hearts, 0], ["A", SUITS.spades, 0],
    ["SJ", SUITS.joker, 0],
  ]);
  const rec = recommendPlay(hand, "2", null, { mlFusionMode: "off", mlModel: false });
  const kickerRank = (rec.candidate.cards ?? []).find((card) => card.rank !== rec.candidate.mainRank)?.rank;
  const badTriple2Pair8 = rec.candidate.type === PLAY_TYPES.tripleWithPair
    && rec.candidate.mainRank === "2"
    && kickerRank === "8";
  assert(!badTriple2Pair8, `不应首推222+88拆连对，实际 kicker=${kickerRank ?? "?"}`);
  const goodTop1 = (rec.candidate.type === PLAY_TYPES.tripleWithPair
    && rec.candidate.mainRank === "2"
    && kickerRank === "6")
    || rec.candidate.type === PLAY_TYPES.consecutivePairs;
  assert(goodTop1, `应首推222+66或连对，实际 ${rec.candidate.type} main=${rec.candidate.mainRank} kicker=${kickerRank ?? ""}`);

  const allCands = generateBasicCandidates(hand, "2", null);
  const badTwp = allCands.find(
    (c) => c.type === PLAY_TYPES.tripleWithPair
      && c.mainRank === "2"
      && (c.cards ?? []).filter((card) => card.rank === "8").length >= 2,
  );
  assert(badTwp, "应能生成 222+88 候选");
  const ctx = enrichScoringContext({ previousPlay: null }, allCands, hand, "2");
  const scoredBad = scoreCandidate(badTwp, hand, "2", null, { ...ctx, _candidates: allCands });
  const goodTwp = allCands.find(
    (c) => c.type === PLAY_TYPES.tripleWithPair
      && c.mainRank === "2"
      && (c.cards ?? []).filter((card) => card.rank === "6").length >= 2,
  );
  const scoredGood = scoreCandidate(goodTwp, hand, "2", null, { ...ctx, _candidates: allCands });
  assert(
    scoredGood.score < scoredBad.score,
    `222+66 应优于 222+88（${scoredGood.score} vs ${scoredBad.score}）`,
  );
  assert(
    scoredBad.reasons.some((r) => /拆连对|孤立小对/.test(r)),
    "222+88 应注明拆连对代价",
  );
});

// —— game-2 turn20：有大王时小对9试探难回牌，应 J带对6 三带二 ——
scenario("P6-game2-turn20-小对9难回牌宜三带二", "P6", () => {
  const hand = cards([
    ["J", SUITS.clubs, 0], ["J", SUITS.diamonds, 1], ["J", SUITS.spades, 0],
    ["6", SUITS.spades, 0], ["6", SUITS.hearts, 0],
    ["9", SUITS.clubs, 1], ["9", SUITS.diamonds, 0],
    ["BJ", SUITS.joker, 0],
    ["3", SUITS.hearts, 0], ["4", SUITS.hearts, 0], ["5", SUITS.hearts, 0],
    ["7", SUITS.hearts, 0], ["8", SUITS.hearts, 0],
    ["Q", SUITS.hearts, 0], ["K", SUITS.hearts, 0], ["A", SUITS.hearts, 0],
    ["2", SUITS.clubs, 0],
  ]);
  const bomb5 = classifyPlay(cards([
    ["5", SUITS.spades, 0], ["5", SUITS.hearts, 0], ["5", SUITS.hearts, 1],
    ["5", SUITS.clubs, 0], ["5", SUITS.diamonds, 1],
  ]), "2");
  let state = createGameStateFromHands({
    levelRank: "2",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: null,
    lastActivePlayerIndex: null,
    playHistory: [
      { turnNumber: 18, playerIndex: 0, play: bomb5 },
      { turnNumber: 19, playerIndex: 1, play: classifyPlay([], "2") },
      { turnNumber: 19, playerIndex: 2, play: classifyPlay([], "2") },
      { turnNumber: 19, playerIndex: 3, play: classifyPlay([], "2") },
    ],
  };
  const rec = recommendPlay(hand, "2", null, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.tripleWithPair && rec.candidate.mainRank === "J",
    `turn20 有大王应 J带对6 三带二，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
  const pairNine = generateBasicCandidates(hand, "2", null)
    .find((item) => item.type === PLAY_TYPES.pair && item.mainRank === "9");
  assert(pairNine, "手牌应能组对9");
  const allCands = generateBasicCandidates(hand, "2", null);
  const ctx = enrichScoringContext({ state, playerIndex: 0, previousPlay: null }, allCands, hand, "2");
  const pairScored = scoreCandidate(pairNine, hand, "2", null, { ...ctx, _candidates: allCands });
  assert(
    pairScored.score > rec.score,
    `小对9试探应劣于 J三带二（对9=${pairScored.score} 三带二=${rec.score}）`,
  );
  assert(
    pairScored.reasons.some((r) => /难回牌|牌力不足|试探/.test(r))
      || rec.reasons.some((r) => /大王可回收|三带二|减手/.test(r)),
    `应说明小对试探或三带二减手理由，对9=${pairScored.reasons.join("；")} top=${rec.reasons.join("；")}`,
  );
});

console.log(`\ndoctrine-regression: 全部 ${passed} 场景通过`);
