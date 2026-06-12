/**
 * game-5 seed 926069208 — 新一轮五局训练第 5 局。
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

const filler = cards([
  ["3", SUITS.clubs], ["4", SUITS.hearts], ["7", SUITS.diamonds], ["Q", SUITS.spades],
]);

function rec(hand, previousPlay, state) {
  return recommendPlay(hand, "2", previousPlay, {
    state, playerIndex: 0, mlFusionMode: "off", maxCandidates: 96,
  });
}

console.log("golden-game926069208: 第5局实机教训\n");

{
  const hand = cards([
    ["J", SUITS.clubs, 0], ["J", SUITS.diamonds, 1], ["J", SUITS.hearts, 0], ["J", SUITS.spades, 0],
    ["3", SUITS.spades, 0], ["4", SUITS.clubs, 0], ["5", SUITS.hearts, 0], ["6", SUITS.clubs, 1],
    ["7", SUITS.hearts, 0], ["8", SUITS.diamonds, 0], ["9", SUITS.clubs, 1], ["10", SUITS.spades, 0],
    ["Q", SUITS.diamonds, 0], ["K", SUITS.hearts, 1], ["A", SUITS.clubs, 0], ["2", SUITS.clubs, 0],
    ["2", SUITS.spades, 1], ["3", SUITS.diamonds, 1], ["4", SUITS.spades, 1], ["5", SUITS.diamonds, 1],
    ["6", SUITS.hearts, 1], ["8", SUITS.clubs, 1],
  ]);
  const sj = classifyPlay([createCard("SJ", SUITS.joker, 1)], "2");
  const pass = classifyPlay([], "2");
  const state = createGameStateFromHands({
    levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0,
    lastActivePlay: sj, lastActivePlayerIndex: 1,
  });
  const top = rec(hand, sj, state);
  const { pool } = computeRecommendations(hand, "2", sj, { state, playerIndex: 0, mlFusionMode: "off", maxCandidates: 96 });
  const sPass = pool.find((item) => playSignature(item.candidate) === playSignature(pass))?.score;
  assert(top.candidate?.type === PLAY_TYPES.bomb && top.candidate?.mainRank === "J",
    `须压小王应四炸J，实际 ${playSignature(top.candidate)}`);
  assert(sPass == null || top.score < sPass, `炸弹抢权应优于过牌（top=${top.score} 过牌=${sPass}）`);
  console.log("  ✓ turn32-须压小王四炸J不过牌");
}

{
  const hand = cards([
    ["9", SUITS.diamonds, 0], ["9", SUITS.spades, 0],
    ["6", SUITS.clubs, 0], ["6", SUITS.diamonds, 0], ["6", SUITS.hearts, 0],
    ["7", SUITS.diamonds, 0], ["7", SUITS.spades, 0],
    ["4", SUITS.hearts, 0], ["5", SUITS.clubs, 0], ["K", SUITS.spades, 0],
  ]);
  const pass = classifyPlay(cards([
    ["K", SUITS.clubs, 0], ["K", SUITS.diamonds, 1], ["K", SUITS.hearts, 0], ["K", SUITS.spades, 1],
  ]), "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = {
    ...state,
    lastActivePlay: null,
    playHistory: [
      { turnNumber: 58, playerIndex: 0, play: classifyPlay([createCard("3", SUITS.clubs, 0)], "2") },
      { turnNumber: 59, playerIndex: 1, play: pass },
      { turnNumber: 59, playerIndex: 2, play: pass },
      { turnNumber: 59, playerIndex: 3, play: pass },
    ],
  };
  const top = rec(hand, null, state);
  const pair9 = classifyPlay([createCard("9", SUITS.diamonds, 0), createCard("9", SUITS.spades, 0)], "2");
  const { pool } = computeRecommendations(hand, "2", null, { state, playerIndex: 0, mlFusionMode: "off", maxCandidates: 96 });
  const s9 = pool.find((item) => playSignature(item.candidate) === playSignature(pair9))?.score;
  assert(top.candidate?.type !== PLAY_TYPES.pass, `接风不宜过牌，实际 ${playSignature(top.candidate)}`);
  assert(s9 != null, "接风候选池应含对9");
  console.log("  ✓ turn60-接风有对9且不宜过牌");
}

console.log("\ngolden-game926069208: 2 条全部通过\n");
