/**
 * 黄金场景 — 用户实机训练踩过的坑，任一失败则禁止发布构建。
 * 新增用户分歧场景时必须先加到这里，再改推荐引擎。
 */
import {
  SUITS,
  PLAY_TYPES,
  classifyPlay,
  createCard,
  createGameStateFromHands,
  recommendPlay,
  generateBasicCandidates,
} from "../src/index.mjs";
import { playSignature } from "../engine/card.mjs";

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

const scenarios = [];

function scenario(id, fn) {
  fn();
  scenarios.push(id);
  console.log(`  ✓ ${id}`);
}

console.log("golden-scenarios: 用户训练锁定的关键局面\n");

scenario("G-整手同花顺压对K-候选非空", () => {
  const hand = cards([
    ["2", SUITS.clubs, 0], ["3", SUITS.clubs, 0], ["4", SUITS.clubs, 0],
    ["5", SUITS.clubs, 0], ["6", SUITS.clubs, 0],
  ]);
  const pairK = classifyPlay(cards([["K", SUITS.clubs, 0], ["K", SUITS.clubs, 1]]), "2");
  const generated = generateBasicCandidates(hand, "2", pairK);
  assert(generated.some((c) => c.type === PLAY_TYPES.straightFlush), "整手同花顺应进入候选池");
  const top = recommendPlay(hand, "2", pairK, { mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.straightFlush, `Top1 应为同花顺，实际 ${top.candidate?.type}`);
});

scenario("G-压大王不拆同花顺凑四炸5", () => {
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
  const bj = classifyPlay([createCard("BJ", SUITS.joker, 1)], "2");
  const top = recommendPlay(hand, "2", bj, { mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.bomb, "须压王应出炸");
  assert(top.candidate?.mainRank === "Q", `不宜拆同花顺凑5炸，应为四炸Q，实际 ${top.candidate?.mainRank}`);
});

scenario("G-接风五炸Q后优先成组减手", () => {
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
    `接风应成组减手，实际 ${top.candidate?.type}`,
  );
  assert(top.candidate?.type !== PLAY_TYPES.pair, "接风不宜裸对子");
});

scenario("G-接风三9带对K不拆三出对", () => {
  // game-2 seed 708223280 turn32 实机手牌（与 doctrine-regression 同源）
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
    playHistory: [
      { turnNumber: 28, playerIndex: 0, play: bomb5 },
      { turnNumber: 29, playerIndex: 1, play: classifyPlay([], "3") },
      { turnNumber: 30, playerIndex: 2, play: classifyPlay([], "3") },
      { turnNumber: 31, playerIndex: 3, play: classifyPlay([], "3") },
    ],
  };
  const top = recommendPlay(hand, "3", null, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(
    top.candidate?.type === PLAY_TYPES.tripleWithPair && top.candidate?.mainRank === "9",
    `接风应9带K三带二，实际 ${playSignature(top.candidate)}`,
  );
});

scenario("G-残局顺子不能压对K-须说明接风", () => {
  const hand = cards([
    ["2", SUITS.spades, 0], ["3", SUITS.clubs, 0], ["4", SUITS.clubs, 0],
    ["5", SUITS.spades, 0], ["6", SUITS.clubs, 0],
  ]);
  const pairK = classifyPlay(cards([["K", SUITS.clubs, 0], ["K", SUITS.clubs, 1]]), "2");
  let state = createGameStateFromHands({
    levelRank: "2",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: pairK, lastActivePlayerIndex: 1 };
  const top = recommendPlay(hand, "2", pairK, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.pass, `顺子不能压对K，应过牌，实际 ${top.candidate?.type}`);
  const reasonText = (top.reasons ?? []).join(" ");
  assert(/同牌型|牌型不同/.test(reasonText), `应说明牌型不匹配，实际 ${reasonText}`);
  assert(/接风|一手走/.test(reasonText), `应提示接风走完，实际 ${reasonText}`);
});

console.log(`\ngolden-scenarios: ${scenarios.length} 条全部通过\n`);
