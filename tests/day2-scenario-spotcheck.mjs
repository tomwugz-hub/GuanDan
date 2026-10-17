/**
 * Day 2 五类局面抽查：开局 / 须压跟牌 / 过牌 / 炸弹 / 三带二（产品决策路径）。
 */
import { SUITS, PLAY_TYPES, classifyPlay, createCard, createGameStateFromHands } from "../src/index.mjs";
import { productTop1 } from "./lib/product-advice.mjs";

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

// 开局：不宜首推过牌
{
  const hand = cards([
    ["3", SUITS.clubs], ["3", SUITS.diamonds], ["4", SUITS.hearts], ["5", SUITS.spades],
    ["6", SUITS.clubs], ["7", SUITS.diamonds], ["8", SUITS.spades], ["9", SUITS.hearts],
    ["10", SUITS.clubs], ["J", SUITS.diamonds], ["Q", SUITS.hearts], ["K", SUITS.spades],
    ["A", SUITS.clubs], ["A", SUITS.diamonds], ["2", SUITS.hearts], ["2", SUITS.clubs],
  ]);
  const state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  const top = productTop1(state).candidate;
  assert(top.type !== PLAY_TYPES.pass, "开局不应首推过牌");
}

// 须压跟牌：压单4 宜单张（非过牌）
{
  const hand = cards([
    ["4", SUITS.spades], ["5", SUITS.clubs], ["6", SUITS.diamonds], ["7", SUITS.hearts],
    ["8", SUITS.clubs], ["9", SUITS.diamonds], ["10", SUITS.spades], ["J", SUITS.clubs],
    ["Q", SUITS.diamonds], ["K", SUITS.hearts], ["A", SUITS.clubs], ["2", SUITS.diamonds],
    ["3", SUITS.hearts], ["3", SUITS.clubs], ["6", SUITS.hearts], ["6", SUITS.spades],
  ]);
  const single4 = classifyPlay([createCard("4", SUITS.diamonds, 1)], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: single4, lastActivePlayerIndex: 1 };
  const top = productTop1(state).candidate;
  assert(top.type === PLAY_TYPES.single || top.type === PLAY_TYPES.pair, "须压单4 应有普通跟牌");
}

// 队友占圈：宜过牌
{
  const hand = cards([
    ["5", SUITS.clubs], ["5", SUITS.diamonds], ["6", SUITS.hearts], ["7", SUITS.spades],
    ["8", SUITS.clubs], ["9", SUITS.diamonds], ["10", SUITS.spades], ["J", SUITS.clubs],
    ["Q", SUITS.diamonds], ["K", SUITS.hearts], ["A", SUITS.clubs], ["2", SUITS.diamonds],
    ["3", SUITS.hearts], ["4", SUITS.clubs], ["6", SUITS.diamonds], ["8", SUITS.hearts],
  ]);
  const pair9 = classifyPlay(cards([["9", SUITS.clubs], ["9", SUITS.diamonds]]), "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: pair9, lastActivePlayerIndex: 2 };
  const top = productTop1(state).candidate;
  assert(top.type === PLAY_TYPES.pass, "队友占圈宜过牌");
}

// 须压顺子：有炸弹宜出炸（非过牌）
{
  const hand = cards([
    ["7", SUITS.clubs], ["7", SUITS.diamonds], ["7", SUITS.hearts], ["7", SUITS.spades],
    ["8", SUITS.clubs], ["9", SUITS.diamonds], ["10", SUITS.spades], ["J", SUITS.clubs],
    ["Q", SUITS.diamonds], ["K", SUITS.hearts], ["A", SUITS.clubs], ["2", SUITS.diamonds],
    ["3", SUITS.hearts], ["4", SUITS.clubs], ["5", SUITS.diamonds], ["6", SUITS.spades],
  ]);
  const straight = classifyPlay(cards([
    ["4", SUITS.hearts], ["5", SUITS.clubs], ["6", SUITS.diamonds], ["7", SUITS.spades], ["8", SUITS.hearts],
  ]), "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: straight, lastActivePlayerIndex: 1 };
  const top = productTop1(state).candidate;
  assert(
    top.type === PLAY_TYPES.bomb || top.type === PLAY_TYPES.straight,
    "须压顺子宜炸弹或更大顺子",
  );
}

// 须压三带二：宜三带二或炸弹，不宜裸过（有结构可压时）
{
  const hand = cards([
    ["6", SUITS.clubs], ["6", SUITS.diamonds], ["6", SUITS.hearts], ["9", SUITS.spades], ["9", SUITS.clubs],
    ["8", SUITS.diamonds], ["10", SUITS.hearts], ["J", SUITS.clubs], ["Q", SUITS.diamonds], ["K", SUITS.spades],
    ["A", SUITS.clubs], ["2", SUITS.diamonds], ["3", SUITS.hearts], ["4", SUITS.clubs], ["5", SUITS.diamonds],
    ["7", SUITS.spades],
  ]);
  const twp = classifyPlay(cards([
    ["6", SUITS.spades], ["6", SUITS.spades, 1], ["6", SUITS.hearts, 1], ["3", SUITS.clubs], ["3", SUITS.diamonds],
  ]), "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: twp, lastActivePlayerIndex: 1 };
  const top = productTop1(state).candidate;
  assert(
    top.type === PLAY_TYPES.tripleWithPair || top.type === PLAY_TYPES.bomb || top.type === PLAY_TYPES.pass,
    "三带二须压局面应有合法 Top1",
  );
}

console.log("PASS day2-scenario-spotcheck");
