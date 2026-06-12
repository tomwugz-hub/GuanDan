/**
 * game-2 seed 918214635 — 新一轮五局训练第 1 局（2026-06-11）。
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
  ["3", SUITS.clubs], ["6", SUITS.hearts], ["9", SUITS.diamonds], ["J", SUITS.spades],
]);

/** 27 张多炸开局走 lite 裁剪，与实机快路径一致；压牌局面用满候选 */
function rec(hand, previousPlay, state, { heavy = false } = {}) {
  return recommendPlay(hand, "2", previousPlay, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    maxCandidates: heavy ? 16 : 96,
    lite: heavy,
  });
}

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
  const top = rec(hand, null, state);
  assert(
    top.candidate?.type === PLAY_TYPES.pair && top.candidate?.mainRank === "3",
    `开局应首推对3，实际 ${playSignature(top.candidate)}`,
  );
  console.log("  ✓ turn0-开局首推对3非单4");
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
  const pass = classifyPlay([], "2");
  const playHistory = [
    { turnNumber: 4, playerIndex: 0, play: classifyPlay([createCard("2", SUITS.spades, 1)], "2") },
    { turnNumber: 5, playerIndex: 3, play: classifyPlay([createCard("SJ", SUITS.joker, 0)], "2") },
    { turnNumber: 6, playerIndex: 2, play: classifyPlay([createCard("BJ", SUITS.joker, 0)], "2") },
    { turnNumber: 7, playerIndex: 1, play: bombK },
  ];
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: bombK, lastActivePlayerIndex: 1, playHistory };
  const top = rec(hand, bombK, state);
  const { pool } = computeRecommendations(hand, "2", bombK, {
    state, playerIndex: 0, mlFusionMode: "off", maxCandidates: 96,
  });
  const sPass = pool.find((item) => playSignature(item.candidate) === playSignature(pass))?.score;
  assert(top.candidate?.type === PLAY_TYPES.bomb, `须压四炸K应出炸，实际 ${playSignature(top.candidate)}`);
  assert(top.candidate?.mainRank === "5", `应最小够压炸弹5，实际 ${playSignature(top.candidate)}`);
  assert(sPass == null || top.score < sPass, `炸弹抢权应优于过牌（top=${top.score} 过牌=${sPass}）`);
  console.log("  ✓ turn8-须压四炸K小炸5不过牌");
}

{
  const hand = cards([
    ["8", SUITS.clubs, 0], ["8", SUITS.diamonds, 0], ["8", SUITS.diamonds, 1], ["8", SUITS.spades, 1],
    ["2", SUITS.hearts, 0], ["10", SUITS.clubs, 0], ["J", SUITS.diamonds, 0], ["J", SUITS.hearts, 1],
    ["Q", SUITS.clubs, 0], ["Q", SUITS.clubs, 1], ["Q", SUITS.hearts, 0], ["K", SUITS.clubs, 1],
    ["A", SUITS.clubs, 1], ["A", SUITS.diamonds, 0], ["A", SUITS.diamonds, 1],
  ]);
  const single5 = classifyPlay([createCard("5", SUITS.diamonds, 1)], "2");
  const singleJ = classifyPlay([createCard("J", SUITS.hearts, 1)], "2");
  const singleQ = classifyPlay([createCard("Q", SUITS.clubs, 0)], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: single5, lastActivePlayerIndex: 1 };
  const top = rec(hand, single5, state);
  const { pool } = computeRecommendations(hand, "2", single5, { state, playerIndex: 0, mlFusionMode: "off", maxCandidates: 96 });
  const sJ = pool.find((item) => playSignature(item.candidate) === playSignature(singleJ))?.score;
  const sQ = pool.find((item) => playSignature(item.candidate) === playSignature(singleQ))?.score;
  assert(top.candidate?.type === PLAY_TYPES.single && top.candidate?.mainRank === "J",
    `压单5应单J不拆对，实际 ${playSignature(top.candidate)}`);
  assert(sQ == null || sJ < sQ, `单J应优于拆对出Q（J=${sJ} Q=${sQ}）`);
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
  const pass = classifyPlay([], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: level2, lastActivePlayerIndex: 1 };
  const top = rec(hand, level2, state);
  const { pool } = computeRecommendations(hand, "2", level2, { state, playerIndex: 0, mlFusionMode: "off", maxCandidates: 96 });
  const sPass = pool.find((item) => playSignature(item.candidate) === playSignature(pass))?.score;
  assert(top.candidate?.type === PLAY_TYPES.bomb && top.candidate?.mainRank === "8",
    `须压级牌2仅炸弹可跟，应四炸8，实际 ${playSignature(top.candidate)}`);
  assert(sPass == null || top.score < sPass, `炸弹抢权应优于过牌（top=${top.score} 过牌=${sPass}）`);
  console.log("  ✓ turn48-须压级牌2四炸8不过牌");
}

{
  const hand = cards([
    ["8", SUITS.clubs, 0], ["8", SUITS.diamonds, 0], ["8", SUITS.diamonds, 1], ["8", SUITS.spades, 1],
    ["2", SUITS.hearts, 0], ["10", SUITS.clubs, 0], ["J", SUITS.diamonds, 0], ["J", SUITS.hearts, 1],
    ["Q", SUITS.clubs, 0], ["K", SUITS.clubs, 1], ["A", SUITS.clubs, 1], ["A", SUITS.diamonds, 1],
  ]);
  const level2 = classifyPlay([createCard("2", SUITS.clubs, 0)], "2");
  const pass = classifyPlay([], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: level2, lastActivePlayerIndex: 3 };
  const top = rec(hand, level2, state);
  const { pool } = computeRecommendations(hand, "2", level2, { state, playerIndex: 0, mlFusionMode: "off", maxCandidates: 96 });
  const sPass = pool.find((item) => playSignature(item.candidate) === playSignature(pass))?.score;
  assert(top.candidate?.type === PLAY_TYPES.bomb && top.candidate?.mainRank === "8",
    `须压级牌2仅炸弹可跟，应四炸8，实际 ${playSignature(top.candidate)}`);
  assert(sPass == null || top.score < sPass, `炸弹抢权应优于过牌（top=${top.score} 过牌=${sPass}）`);
  console.log("  ✓ turn60-须压级牌2四炸8不过牌");
}

console.log("\ngolden-game918214635: 5 条全部通过\n");
