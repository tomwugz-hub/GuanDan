/**
 * game-3 seed 903668154 — 五局训练第 2 局：只有炸弹能压时不应过牌。
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
  ["3", SUITS.clubs], ["4", SUITS.diamonds], ["6", SUITS.hearts], ["7", SUITS.diamonds],
]);

console.log("golden-game903668154: 第2局实机教训\n");

scenario("turn16-压对手四炸4应出四炸5", () => {
  const hand = cards([
    ["5", SUITS.diamonds, 1], ["5", SUITS.hearts, 1], ["5", SUITS.spades, 0], ["5", SUITS.spades, 1],
    ["8", SUITS.clubs, 1], ["8", SUITS.hearts, 1], ["9", SUITS.clubs, 0], ["9", SUITS.clubs, 1],
    ["9", SUITS.diamonds, 0], ["10", SUITS.diamonds, 0], ["10", SUITS.spades, 1],
    ["Q", SUITS.hearts, 0], ["A", SUITS.hearts, 0], ["SJ", SUITS.joker, 1], ["BJ", SUITS.joker, 0],
  ]);
  const bomb4 = classifyPlay(cards([
    ["4", SUITS.diamonds, 1], ["4", SUITS.spades, 1], ["2", SUITS.hearts, 0], ["2", SUITS.hearts, 1],
  ]), "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: bomb4, lastActivePlayerIndex: 1 };
  const top = recommendPlay(hand, "2", bomb4, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.bomb && top.candidate?.mainRank === "5",
    `须压四炸4应出四炸5，实际 ${playSignature(top.candidate)}`);
  assert(top.candidate?.type !== PLAY_TYPES.pass, "只有炸弹能压时不应过牌");
  console.log("  ✓ turn16-压对手四炸4应出四炸5");
});

scenario("turn32-压对A应出四炸5", () => {
  const hand = cards([
    ["5", SUITS.diamonds, 1], ["5", SUITS.hearts, 1], ["5", SUITS.spades, 0], ["5", SUITS.spades, 1],
    ["8", SUITS.clubs, 1], ["8", SUITS.hearts, 1], ["9", SUITS.clubs, 0], ["9", SUITS.clubs, 1],
    ["9", SUITS.diamonds, 0], ["10", SUITS.diamonds, 0], ["10", SUITS.spades, 1],
    ["A", SUITS.hearts, 0], ["SJ", SUITS.joker, 1], ["BJ", SUITS.joker, 0],
  ]);
  const pairA = classifyPlay([createCard("A", SUITS.diamonds, 0), createCard("A", SUITS.spades, 0)], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: pairA, lastActivePlayerIndex: 1 };
  const top = recommendPlay(hand, "2", pairA, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.bomb && top.candidate?.mainRank === "5",
    `须压对A应出四炸5，实际 ${playSignature(top.candidate)}`);
  console.log("  ✓ turn32-压对A应出四炸5");
});

scenario("turn48-压对J应出四炸5", () => {
  const hand = cards([
    ["5", SUITS.diamonds, 1], ["5", SUITS.hearts, 1], ["5", SUITS.spades, 0], ["5", SUITS.spades, 1],
    ["8", SUITS.clubs, 1], ["8", SUITS.hearts, 1], ["9", SUITS.clubs, 0], ["9", SUITS.clubs, 1],
    ["9", SUITS.diamonds, 0], ["SJ", SUITS.joker, 1], ["BJ", SUITS.joker, 0],
  ]);
  const pairJ = classifyPlay([createCard("J", SUITS.hearts, 0), createCard("J", SUITS.hearts, 1)], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: pairJ, lastActivePlayerIndex: 3 };
  const top = recommendPlay(hand, "2", pairJ, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.bomb && top.candidate?.mainRank === "5",
    `须压对J应出四炸5，实际 ${playSignature(top.candidate)}`);
  console.log("  ✓ turn48-压对J应出四炸5");
});

function scenario(_id, fn) { fn(); }

console.log("\ngolden-game903668154: 3 条全部通过\n");
