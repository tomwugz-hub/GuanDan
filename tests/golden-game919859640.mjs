/**
 * game-3 seed 919859640 — 新一轮五局训练第 3 局。
 */
import {
  SUITS,
  PLAY_TYPES,
  classifyPlay,
  createCard,
  createGameStateFromHands,
  recommendPlay,
  computeRecommendations,
} from "../src/index.mjs";
import { playSignature } from "../engine/card.mjs";

function cards(specs) {
  return specs.map(([rank, suit = SUITS.spades, deckIndex = 0]) => createCard(rank, suit, deckIndex));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const filler = cards([["3", SUITS.clubs], ["4", SUITS.hearts], ["7", SUITS.diamonds], ["Q", SUITS.spades]]);

function rec(hand, previousPlay, state) {
  return recommendPlay(hand, "2", previousPlay, {
    state, playerIndex: 0, mlFusionMode: "off", maxCandidates: 96,
  });
}

console.log("golden-game919859640: 第3局实机教训\n");

{
  const hand = cards([
    ["K", SUITS.clubs, 1], ["A", SUITS.diamonds, 0], ["A", SUITS.hearts, 1],
    ["J", SUITS.diamonds, 0], ["J", SUITS.hearts, 1], ["Q", SUITS.clubs, 0], ["Q", SUITS.hearts, 0],
    ["8", SUITS.clubs, 0], ["8", SUITS.spades, 1], ["9", SUITS.diamonds, 0], ["10", SUITS.clubs, 0],
    ["2", SUITS.clubs, 0], ["2", SUITS.spades, 1], ["3", SUITS.diamonds, 0], ["4", SUITS.spades, 0],
    ["5", SUITS.hearts, 0], ["6", SUITS.clubs, 1], ["7", SUITS.hearts, 0], ["BJ", SUITS.joker, 0],
  ]);
  const single8 = classifyPlay([createCard("8", SUITS.hearts, 0)], "2");
  const singleK = classifyPlay([createCard("K", SUITS.clubs, 1)], "2");
  const singleA = classifyPlay([createCard("A", SUITS.diamonds, 0)], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: single8, lastActivePlayerIndex: 1 };
  const top = rec(hand, single8, state);
  const { pool } = computeRecommendations(hand, "2", single8, { state, playerIndex: 0, mlFusionMode: "off", maxCandidates: 96 });
  const sK = pool.find((item) => playSignature(item.candidate) === playSignature(singleK))?.score;
  const sA = pool.find((item) => playSignature(item.candidate) === playSignature(singleA))?.score;
  assert(top.candidate?.type === PLAY_TYPES.single && top.candidate?.mainRank === "K",
    `压单8应单K，实际 ${playSignature(top.candidate)}`);
  assert(sA == null || sK < sA, `单K应优于方片A（K=${sK} A=${sA}）`);
  console.log("  ✓ turn24-压单8出单K非方片A");
}

{
  const hand = cards([
    ["SJ", SUITS.joker, 0], ["BJ", SUITS.joker, 1],
    ["K", SUITS.clubs, 1], ["A", SUITS.diamonds, 0],
    ["J", SUITS.diamonds, 0], ["Q", SUITS.clubs, 0], ["8", SUITS.clubs, 0], ["9", SUITS.diamonds, 0],
    ["10", SUITS.clubs, 0], ["2", SUITS.clubs, 0], ["3", SUITS.diamonds, 0], ["4", SUITS.spades, 0],
    ["5", SUITS.hearts, 0], ["6", SUITS.clubs, 1], ["7", SUITS.hearts, 0], ["8", SUITS.spades, 1],
    ["9", SUITS.hearts, 0], ["10", SUITS.diamonds, 0],
  ]);
  const level2 = classifyPlay([createCard("2", SUITS.diamonds, 1)], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: level2, lastActivePlayerIndex: 1 };
  const top = rec(hand, level2, state);
  assert(top.candidate?.type === PLAY_TYPES.single && top.candidate?.mainRank === "SJ",
    `压级牌2应小王，实际 ${playSignature(top.candidate)}`);
  console.log("  ✓ turn28-压级牌2出小王");
}

{
  const hand = cards([
    ["K", SUITS.clubs, 1], ["SJ", SUITS.joker, 0],
    ["J", SUITS.diamonds, 0], ["J", SUITS.hearts, 1], ["Q", SUITS.clubs, 0], ["Q", SUITS.hearts, 0],
    ["8", SUITS.clubs, 0], ["8", SUITS.spades, 1], ["9", SUITS.diamonds, 0], ["10", SUITS.clubs, 0],
    ["2", SUITS.clubs, 0], ["2", SUITS.spades, 1], ["3", SUITS.diamonds, 0], ["4", SUITS.spades, 0],
    ["5", SUITS.hearts, 0], ["6", SUITS.clubs, 1], ["7", SUITS.hearts, 0],
  ]);
  const single8 = classifyPlay([createCard("8", SUITS.hearts, 0)], "2");
  const singleK = classifyPlay([createCard("K", SUITS.clubs, 1)], "2");
  const singleSJ = classifyPlay([createCard("SJ", SUITS.joker, 0)], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: single8, lastActivePlayerIndex: 1 };
  const top = rec(hand, single8, state);
  const { pool } = computeRecommendations(hand, "2", single8, { state, playerIndex: 0, mlFusionMode: "off", maxCandidates: 96 });
  const sK = pool.find((item) => playSignature(item.candidate) === playSignature(singleK))?.score;
  const sSJ = pool.find((item) => playSignature(item.candidate) === playSignature(singleSJ))?.score;
  assert(top.candidate?.type === PLAY_TYPES.single && top.candidate?.mainRank === "K",
    `压单8应单K非小王，实际 ${playSignature(top.candidate)}`);
  assert(sSJ == null || sK < sSJ, `单K应优于小王（K=${sK} 小王=${sSJ}）`);
  console.log("  ✓ turn36-压单8出单K不浪费小王");
}

console.log("\ngolden-game919859640: 3 条全部通过\n");
