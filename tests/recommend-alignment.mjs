/**
 * 推荐对齐门禁 — recommendPlay 与 getTurnAdvice 的 Top1 必须一致（防双轨失忆）。
 */
import {
  SUITS,
  classifyPlay,
  createCard,
  createGameStateFromHands,
  recommendPlay,
} from "../src/index.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { playSignature } from "../engine/card.mjs";

function cards(specs) {
  return specs.map(([rank, suit = SUITS.spades, deckIndex = 0]) => createCard(rank, suit, deckIndex));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function alignCheck(label, hand, state, previousPlay) {
  const rec = recommendPlay(hand, state.levelRank, previousPlay, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    maxCandidates: 96,
  });
  const advice = getTurnAdvice(state, 0, { mlFusionMode: "off", maxCandidates: 96, alternatives: 8 });
  const recSig = playSignature(rec.candidate);
  const adviceSig = playSignature(advice.recommendation.candidate);
  assert(
    recSig === adviceSig,
    `${label}：recommendPlay「${recSig}」≠ getTurnAdvice「${adviceSig}」`,
  );
  assert(
    Boolean(advice.canPlay) === (rec.candidate?.type !== "Pass"),
    `${label}：canPlay 与 Top1 类型不一致`,
  );
}

console.log("recommend-alignment: Top1 双轨对齐\n");

const filler = cards([
  ["2", SUITS.clubs], ["2", SUITS.diamonds], ["9", SUITS.clubs], ["9", SUITS.diamonds],
  ["K", SUITS.clubs], ["K", SUITS.diamonds], ["J", SUITS.clubs], ["J", SUITS.diamonds],
]);

{
  const hand = cards([
    ["2", SUITS.clubs, 0], ["3", SUITS.clubs, 0], ["4", SUITS.clubs, 0],
    ["5", SUITS.clubs, 0], ["6", SUITS.clubs, 0],
  ]);
  const pairK = classifyPlay(cards([["K", SUITS.clubs, 0], ["K", SUITS.clubs, 1]]), "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: pairK, lastActivePlayerIndex: 1 };
  alignCheck("整手同花顺压对K", hand, state, pairK);
  console.log("  ✓ 整手同花顺压对K");
}

{
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
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: bj, lastActivePlayerIndex: 3 };
  alignCheck("压大王选炸", hand, state, bj);
  console.log("  ✓ 压大王选炸");
}

{
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
  let state = createGameStateFromHands({ levelRank: "3", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
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
  alignCheck("接风9带K", hand, state, null);
  console.log("  ✓ 接风9带K");
}

console.log("\nrecommend-alignment: 全部通过\n");
