/**
 * game-2 seed 918214635 — 新一轮五局训练第 1 局（2026-06-11）。
 * Top1 断言与产品 UI 同源（decision/ 统一内核）。
 */
import {
  SUITS,
  PLAY_TYPES,
  classifyPlay,
  createCard,
  createGameStateFromHands,
} from "../src/index.mjs";
import { playSignature } from "../engine/card.mjs";
import { productTop1 } from "./lib/product-advice.mjs";

function cards(specs) {
  return specs.map(([rank, suit = SUITS.spades, deckIndex = 0]) => createCard(rank, suit, deckIndex));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const filler = cards([
  ["3", SUITS.clubs], ["6", SUITS.hearts], ["9", SUITS.diamonds], ["J", SUITS.spades],
]);

console.log("golden-game918214635: 新一轮第1局实机教训\n");

{
  const hand = cards([
    ["2", SUITS.clubs, 0], ["2", SUITS.spades, 1], ["3", SUITS.diamonds, 0], ["3", SUITS.hearts, 0],
    ["4", SUITS.hearts, 1], ["5", SUITS.clubs, 0], ["5", SUITS.diamonds, 1], ["5", SUITS.hearts, 0],
    ["5", SUITS.spades, 0], ["6", SUITS.diamonds, 1], ["8", SUITS.clubs, 0], ["8", SUITS.diamonds, 0],
    ["8", SUITS.diamonds, 1], ["8", SUITS.spades, 1], ["2", SUITS.hearts, 0], ["2", SUITS.hearts, 1],
    ["10", SUITS.clubs, 0], ["J", SUITS.diamonds, 0], ["J", SUITS.hearts, 1], ["Q", SUITS.clubs, 0],
    ["Q", SUITS.clubs, 1], ["Q", SUITS.hearts, 0], ["K", SUITS.clubs, 1], ["A", SUITS.clubs, 1],
    ["A", SUITS.diamonds, 0], ["A", SUITS.diamonds, 1], ["BJ", SUITS.joker, 0],
  ]);
  const state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  const top = productTop1(state).candidate;
  assert(
    top?.type === PLAY_TYPES.consecutivePairs,
    `开局（decision rev6）宜连对探路，实际 ${playSignature(top)}`,
  );
  console.log("  ✓ turn0-开局连对（对齐统一内核）");
}

{
  const hand = cards([
    ["2", SUITS.clubs, 0], ["3", SUITS.diamonds, 0], ["3", SUITS.hearts, 0],
    ["5", SUITS.clubs, 0], ["5", SUITS.diamonds, 1], ["5", SUITS.hearts, 0], ["5", SUITS.spades, 0],
    ["6", SUITS.diamonds, 1], ["8", SUITS.clubs, 0], ["8", SUITS.diamonds, 0], ["8", SUITS.diamonds, 1],
    ["8", SUITS.spades, 1], ["2", SUITS.hearts, 0], ["2", SUITS.hearts, 1], ["10", SUITS.clubs, 0],
    ["J", SUITS.diamonds, 0], ["J", SUITS.hearts, 1], ["Q", SUITS.clubs, 0], ["Q", SUITS.clubs, 1],
    ["Q", SUITS.hearts, 0], ["K", SUITS.clubs, 1], ["A", SUITS.clubs, 1], ["A", SUITS.diamonds, 0],
    ["A", SUITS.diamonds, 1], ["BJ", SUITS.joker, 0],
  ]);
  const bombK = classifyPlay(cards([
    ["K", SUITS.clubs, 0], ["K", SUITS.diamonds, 0], ["K", SUITS.diamonds, 1], ["K", SUITS.hearts, 0],
  ]), "2");
  const playHistory = [
    { turnNumber: 4, playerIndex: 0, play: classifyPlay([createCard("2", SUITS.spades, 1)], "2") },
    { turnNumber: 5, playerIndex: 3, play: classifyPlay([createCard("SJ", SUITS.joker, 0)], "2") },
    { turnNumber: 6, playerIndex: 2, play: classifyPlay([createCard("BJ", SUITS.joker, 0)], "2") },
    { turnNumber: 7, playerIndex: 1, play: bombK },
  ];
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: bombK, lastActivePlayerIndex: 1, playHistory };
  const top = productTop1(state).candidate;
  assert(top?.type === PLAY_TYPES.pass,
    `须压四炸K（decision rev6 当前）宜过牌保留结构，实际 ${playSignature(top)}`);
  console.log("  ✓ turn8-须压四炸K过牌（对齐统一内核）");
}

{
  const hand = cards([
    ["8", SUITS.clubs, 0], ["8", SUITS.diamonds, 0], ["8", SUITS.diamonds, 1], ["8", SUITS.spades, 1],
    ["2", SUITS.hearts, 0], ["10", SUITS.clubs, 0], ["J", SUITS.diamonds, 0], ["J", SUITS.hearts, 1],
    ["Q", SUITS.clubs, 0], ["Q", SUITS.clubs, 1], ["Q", SUITS.hearts, 0], ["K", SUITS.clubs, 1],
    ["A", SUITS.clubs, 1], ["A", SUITS.diamonds, 0], ["A", SUITS.diamonds, 1],
  ]);
  const single5 = classifyPlay([createCard("5", SUITS.diamonds, 1)], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: single5, lastActivePlayerIndex: 1 };
  const top = productTop1(state).candidate;
  assert(top?.type === PLAY_TYPES.single && top?.mainRank === "J",
    `压单5应单J不拆对，实际 ${playSignature(top)}`);
  console.log("  ✓ turn44-压单5出单J不拆对出Q");
}

{
  const hand = cards([
    ["8", SUITS.clubs, 0], ["8", SUITS.diamonds, 0], ["8", SUITS.diamonds, 1], ["8", SUITS.spades, 1],
    ["2", SUITS.hearts, 0], ["10", SUITS.clubs, 0], ["J", SUITS.diamonds, 0], ["J", SUITS.hearts, 1],
    ["Q", SUITS.clubs, 0], ["Q", SUITS.clubs, 1], ["K", SUITS.clubs, 1], ["A", SUITS.clubs, 1],
    ["A", SUITS.diamonds, 0], ["A", SUITS.diamonds, 1],
  ]);
  const level2 = classifyPlay([createCard("2", SUITS.diamonds, 1)], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: level2, lastActivePlayerIndex: 1 };
  const top = productTop1(state).candidate;
  assert(top?.type === PLAY_TYPES.pass,
    `须压级牌2（decision rev6 当前）宜过牌，实际 ${playSignature(top)}`);
  console.log("  ✓ turn48-须压级牌2过牌（对齐统一内核）");
}

{
  const hand = cards([
    ["8", SUITS.clubs, 0], ["8", SUITS.diamonds, 0], ["8", SUITS.diamonds, 1], ["8", SUITS.spades, 1],
    ["2", SUITS.hearts, 0], ["10", SUITS.clubs, 0], ["J", SUITS.diamonds, 0], ["J", SUITS.hearts, 1],
    ["Q", SUITS.clubs, 0], ["K", SUITS.clubs, 1], ["A", SUITS.clubs, 1], ["A", SUITS.diamonds, 1],
  ]);
  const level2 = classifyPlay([createCard("2", SUITS.clubs, 0)], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: level2, lastActivePlayerIndex: 3 };
  const top = productTop1(state).candidate;
  assert(top?.type === PLAY_TYPES.pass,
    `须压级牌2（decision rev6 当前）宜过牌，实际 ${playSignature(top)}`);
  console.log("  ✓ turn60-须压级牌2过牌（对齐统一内核）");
}

console.log("\ngolden-game918214635: 5 条全部通过\n");
