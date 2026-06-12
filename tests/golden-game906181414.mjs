/**
 * game-5 seed 906181414 — 五局训练第 4 局。
 */
import {
  SUITS,
  PLAY_TYPES,
  classifyPlay,
  createCard,
  createGameStateFromHands,
  recommendPlay,
} from "../src/index.mjs";
import { playSignature } from "../engine/card.mjs";

function cards(specs) {
  return specs.map(([rank, suit = SUITS.spades, deckIndex = 0]) => createCard(rank, suit, deckIndex));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const filler = cards([
  ["3", SUITS.clubs], ["4", SUITS.diamonds], ["7", SUITS.hearts], ["9", SUITS.spades],
]);

console.log("golden-game906181414: 第4局实机教训\n");

{
  const hand = cards([
    ["2", SUITS.clubs, 1], ["2", SUITS.hearts, 1], ["2", SUITS.spades, 1],
    ["3", SUITS.diamonds, 0], ["4", SUITS.spades, 0], ["5", SUITS.clubs, 0], ["5", SUITS.spades, 1],
    ["6", SUITS.clubs, 1], ["6", SUITS.diamonds, 1], ["6", SUITS.hearts, 0], ["6", SUITS.spades, 1],
    ["7", SUITS.clubs, 0], ["8", SUITS.spades, 1], ["9", SUITS.diamonds, 0], ["9", SUITS.diamonds, 1],
    ["10", SUITS.clubs, 0], ["10", SUITS.diamonds, 0], ["10", SUITS.diamonds, 1], ["10", SUITS.spades, 0], ["10", SUITS.spades, 1],
    ["J", SUITS.spades, 0], ["Q", SUITS.hearts, 0], ["K", SUITS.clubs, 0], ["K", SUITS.hearts, 0], ["K", SUITS.hearts, 1],
    ["A", SUITS.hearts, 1], ["BJ", SUITS.joker, 1],
  ]);
  const triple6 = classifyPlay(cards([
    ["6", SUITS.clubs, 1], ["6", SUITS.diamonds, 1], ["6", SUITS.hearts, 0],
  ]), "2");
  const state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  const top = recommendPlay(hand, "2", null, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.triple && top.candidate?.mainRank === "6",
    `开局应出三张6，实际 ${playSignature(top.candidate)}`);
  assert(playSignature(top.candidate) === playSignature(triple6), "Top1 应为三张6");
  console.log("  ✓ turn0-开局出三张6");
}

{
  const hand = cards([
    ["2", SUITS.clubs, 1], ["2", SUITS.hearts, 1], ["4", SUITS.spades, 0], ["5", SUITS.clubs, 0], ["5", SUITS.spades, 1],
    ["6", SUITS.clubs, 1], ["6", SUITS.diamonds, 1], ["6", SUITS.hearts, 0], ["6", SUITS.spades, 1],
    ["8", SUITS.spades, 1], ["9", SUITS.diamonds, 0], ["9", SUITS.diamonds, 1],
    ["10", SUITS.clubs, 0], ["10", SUITS.diamonds, 0], ["10", SUITS.diamonds, 1], ["10", SUITS.spades, 0], ["10", SUITS.spades, 1],
    ["J", SUITS.spades, 0], ["Q", SUITS.hearts, 0], ["K", SUITS.clubs, 0], ["K", SUITS.hearts, 0], ["K", SUITS.hearts, 1],
    ["A", SUITS.hearts, 1], ["BJ", SUITS.joker, 1],
  ]);
  const singleK = classifyPlay([createCard("K", SUITS.clubs, 1)], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: singleK, lastActivePlayerIndex: 1 };
  const top = recommendPlay(hand, "2", singleK, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.single && top.candidate?.mainRank === "A",
    `压梅花K应出散单A，不宜级牌2，实际 ${playSignature(top.candidate)}`);
  console.log("  ✓ turn16-压K用散单A非级牌2");
}

{
  const hand = cards([
    ["2", SUITS.hearts, 1], ["4", SUITS.spades, 0], ["5", SUITS.clubs, 0], ["5", SUITS.spades, 1],
    ["6", SUITS.clubs, 1], ["6", SUITS.diamonds, 1], ["6", SUITS.hearts, 0], ["6", SUITS.spades, 1],
    ["8", SUITS.spades, 1], ["9", SUITS.diamonds, 0], ["9", SUITS.diamonds, 1],
    ["10", SUITS.clubs, 0], ["10", SUITS.diamonds, 0], ["10", SUITS.diamonds, 1], ["10", SUITS.spades, 0], ["10", SUITS.spades, 1],
    ["J", SUITS.spades, 0], ["Q", SUITS.hearts, 0], ["K", SUITS.clubs, 0], ["K", SUITS.hearts, 0], ["K", SUITS.hearts, 1],
    ["A", SUITS.hearts, 1], ["BJ", SUITS.joker, 1],
  ]);
  const oppSf = classifyPlay(cards([
    ["8", SUITS.hearts, 0], ["9", SUITS.hearts, 0], ["J", SUITS.hearts, 1], ["Q", SUITS.hearts, 1], ["2", SUITS.hearts, 0],
  ]), "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: oppSf, lastActivePlayerIndex: 3 };
  const top = recommendPlay(hand, "2", oppSf, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.bomb && top.candidate?.mainRank === "10",
    `压同花顺应五炸10，实际 ${playSignature(top.candidate)}`);
  assert((top.candidate?.cards?.length ?? 0) >= 5, "宜用五炸10抢权");
  console.log("  ✓ turn20-压同花顺用五炸10");
}

{
  const hand = cards([
    ["2", SUITS.hearts, 1], ["4", SUITS.spades, 0], ["5", SUITS.clubs, 0], ["5", SUITS.spades, 1],
    ["6", SUITS.clubs, 1], ["6", SUITS.diamonds, 1], ["6", SUITS.hearts, 0], ["6", SUITS.spades, 1],
    ["8", SUITS.spades, 1], ["9", SUITS.diamonds, 0], ["9", SUITS.diamonds, 1], ["K", SUITS.clubs, 0],
  ]);
  const single3 = classifyPlay([createCard("3", SUITS.hearts, 0)], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: single3, lastActivePlayerIndex: 1 };
  const top = recommendPlay(hand, "2", single3, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.single && top.candidate?.mainRank === "K",
    `压红桃3应出梅花K，不宜小单5，实际 ${playSignature(top.candidate)}`);
  console.log("  ✓ turn44-压3用K非小单5");
}

{
  const hand = cards([
    ["2", SUITS.hearts, 1], ["4", SUITS.spades, 0], ["5", SUITS.spades, 1],
    ["6", SUITS.clubs, 1], ["6", SUITS.diamonds, 1], ["6", SUITS.hearts, 0], ["6", SUITS.spades, 1],
    ["8", SUITS.spades, 1], ["9", SUITS.diamonds, 0], ["9", SUITS.diamonds, 1], ["K", SUITS.clubs, 0],
  ]);
  const singleSj = classifyPlay([createCard("SJ", SUITS.joker, 0)], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: singleSj, lastActivePlayerIndex: 1 };
  const top = recommendPlay(hand, "2", singleSj, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.straightFlush,
    `压小王应出黑桃同花顺，实际 ${playSignature(top.candidate)}`);
  assert(top.candidate?.mainRank === "8", "同花顺应以8为顶");
  console.log("  ✓ turn48-压小王用黑桃同花顺");
}

console.log("\ngolden-game906181414: 5 条全部通过\n");
