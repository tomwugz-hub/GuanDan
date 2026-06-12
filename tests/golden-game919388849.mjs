/**
 * game-2 seed 919388849 — 新一轮五局训练第 2 局（有散单/级牌可压不宜过牌）。
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

/** 复盘 turn40～60 共性：有散单/逢人配可压时不应过牌 */
const hand21 = cards([
  ["2", SUITS.hearts, 1],
  ["3", SUITS.clubs, 0], ["4", SUITS.clubs, 0], ["5", SUITS.clubs, 0], ["6", SUITS.clubs, 0],
  ["7", SUITS.clubs, 0], ["8", SUITS.clubs, 0], ["3", SUITS.diamonds, 0], ["4", SUITS.diamonds, 0],
  ["5", SUITS.diamonds, 0], ["6", SUITS.diamonds, 0], ["7", SUITS.diamonds, 0], ["8", SUITS.diamonds, 0],
  ["3", SUITS.hearts, 0], ["4", SUITS.hearts, 0], ["5", SUITS.hearts, 0], ["6", SUITS.hearts, 0],
  ["7", SUITS.hearts, 0], ["8", SUITS.hearts, 0], ["3", SUITS.spades, 0], ["4", SUITS.spades, 0],
  ["5", SUITS.spades, 0], ["6", SUITS.spades, 0], ["7", SUITS.spades, 0], ["8", SUITS.spades, 0],
  ["9", SUITS.clubs, 0],
]);

function assertMustBeatNotPass(hand, mustBeatCard, label) {
  const previousPlay = classifyPlay([mustBeatCard], "2");
  const wild2 = classifyPlay([createCard("2", SUITS.hearts, 1)], "2");
  const pass = classifyPlay([], "2");
  const state = createGameStateFromHands({
    levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0,
    lastActivePlay: previousPlay, lastActivePlayerIndex: 1,
  });
  const top = rec(hand, previousPlay, state);
  const { pool } = computeRecommendations(hand, "2", previousPlay, {
    state, playerIndex: 0, mlFusionMode: "off", maxCandidates: 96,
  });
  const sPass = pool.find((item) => playSignature(item.candidate) === playSignature(pass))?.score;
  const sWild = pool.find((item) => playSignature(item.candidate) === playSignature(wild2))?.score;
  assert(top.candidate?.type !== PLAY_TYPES.pass, `${label} 不应过牌，实际 ${playSignature(top.candidate)}`);
  assert(sPass == null || top.score < sPass, `${label} Top1应优于过牌`);
  assert(sWild != null && sWild < (sPass ?? 99999), `${label} 逢人配2应能压且优于过牌`);
  console.log(`  ✓ ${label}`);
}

console.log("golden-game919388849: 第2局实机教训\n");

assertMustBeatNotPass(hand21, createCard("10", SUITS.clubs, 1), "turn40-须压梅花10不宜过牌");
assertMustBeatNotPass(hand21, createCard("Q", SUITS.hearts, 0), "turn44-须压红桃Q不宜过牌");
assertMustBeatNotPass(hand21, createCard("A", SUITS.hearts, 0), "turn48-须压红桃A不宜过牌");
assertMustBeatNotPass(hand21, createCard("10", SUITS.hearts, 0), "turn56-须压红桃10不宜过牌");
assertMustBeatNotPass(hand21, createCard("Q", SUITS.spades, 0), "turn60-须压黑桃Q不宜过牌");

console.log("\ngolden-game919388849: 5 条全部通过\n");
