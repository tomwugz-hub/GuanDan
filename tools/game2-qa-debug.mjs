/**
 * game-2 四条问教练回归：打印 answerSource/mode 与首行
 */
import { tryLocalCoachAnswer } from "../coach/local-qa.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import { classifyPlay, createCard, SUITS } from "../engine/index.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";

const QUESTIONS = [
  "怎么打5？打5不是拆顺子吗？",
  "这里为什么不用对K，而要拆3个6？",
  "推荐3中选23456，为什么不选12345？而是要拆三张，同时还多了一个A",
  "推荐1中要拆顺子用三个6带两个3，这是什么逻辑，多出4张单牌怎么办？",
];

function cards(specs) {
  return specs.map(([rank, suit = SUITS.spades, deckIndex = 0]) =>
    createCard(rank, suit, deckIndex),
  );
}

const filler = cards(Array.from({ length: 27 }, () => ["3"]));

function serializeHand(hand) {
  return hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex }));
}

function buildBeat4Context() {
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
  const cands = generateBasicCandidates(hand, "3", prev)
    .filter((c) => c.type === PLAY_TYPES.single)
    .slice(0, 3);
  return {
    ctx: {
      status: "in-progress",
      levelRank: "3",
      turnNumber: 16,
      humanHand: serializeHand(hand),
      table: { lastActivePlay: prev },
      currentAdvice: {
        choices: [{ play: rec.candidate, reasons: rec.reasons ?? [] }, ...cands.slice(1).map((p) => ({ play: p, reasons: [] }))],
      },
    },
    top1: rec.candidate,
  };
}

function buildPairKContext() {
  const hand = cards([
    ["6", SUITS.spades, 0], ["6", SUITS.spades, 1], ["6", SUITS.clubs, 1],
    ["K", SUITS.diamonds, 0], ["K", SUITS.diamonds, 1],
    ["7", SUITS.spades, 1], ["7", SUITS.hearts, 0], ["7", SUITS.hearts, 1],
    ["7", SUITS.clubs, 0], ["7", SUITS.clubs, 1], ["7", SUITS.diamonds, 1],
    ["8", SUITS.diamonds, 1], ["Q", SUITS.hearts, 1], ["A", SUITS.hearts, 1],
    ["2", SUITS.diamonds, 1], ["SJ", SUITS.joker, 0],
  ]);
  const prev = classifyPlay(cards([["5", SUITS.diamonds, 0], ["5", SUITS.hearts, 0]]), "3");
  const pair6 = generateBasicCandidates(hand, "3", prev).find((c) => c.type === PLAY_TYPES.pair && c.mainRank === "6");
  const pairK = generateBasicCandidates(hand, "3", prev).find((c) => c.type === PLAY_TYPES.pair && c.mainRank === "K");
  return {
    ctx: {
      status: "in-progress",
      levelRank: "3",
      turnNumber: 20,
      humanHand: serializeHand(hand),
      table: { lastActivePlay: prev },
      currentAdvice: {
        choices: [{ play: pair6, reasons: ["连对"] }, { play: pairK, reasons: [] }],
      },
    },
  };
}

function buildCatchWindContext() {
  const hand = cards([
    ["6", SUITS.spades, 0], ["6", SUITS.hearts, 0], ["6", SUITS.clubs, 0],
    ["3", SUITS.spades, 0], ["3", SUITS.diamonds, 0],
    ["A", SUITS.diamonds, 0], ["2", SUITS.spades, 1], ["4", SUITS.spades, 0], ["5", SUITS.spades, 0],
    ["8", SUITS.hearts, 0], ["9", SUITS.clubs, 0], ["10", SUITS.diamonds, 0],
    ["J", SUITS.clubs, 0], ["Q", SUITS.hearts, 0], ["K", SUITS.diamonds, 0],
  ]);
  const triple = generateBasicCandidates(hand, "3", null)
    .find((c) => c.type === PLAY_TYPES.tripleWithPair && c.mainRank === "6");
  const straight = generateBasicCandidates(hand, "3", null)
    .find((c) => c.type === PLAY_TYPES.straight);
  return {
    ctx: {
      status: "in-progress",
      levelRank: "3",
      turnNumber: 8,
      humanHand: serializeHand(hand),
      table: { lastActivePlay: null },
      currentAdvice: {
        choices: [
          { play: triple, reasons: ["接风"] },
          { play: straight, reasons: ["顺子"] },
          { play: straight, reasons: [] },
        ],
      },
    },
  };
}

const beat4 = buildBeat4Context();
const contexts = [
  beat4.ctx,
  buildPairKContext().ctx,
  buildCatchWindContext().ctx,
  buildCatchWindContext().ctx,
];

console.log("Q1 Top1 recommend:", beat4.top1?.mainRank, beat4.top1?.type);
console.log("");

for (let i = 0; i < QUESTIONS.length; i++) {
  const ans = tryLocalCoachAnswer(QUESTIONS[i], contexts[i]);
  console.log(`=== Q${i + 1} ===`);
  console.log("question:", QUESTIONS[i]);
  console.log("mode:", ans?.mode, "| source:", ans?.source);
  console.log("brief:", ans?.text?.includes("兜底答复") || ans?.text?.includes("规则教练"));
  console.log(ans?.text?.split("\n").slice(0, 5).join("\n"));
  console.log("");
}
