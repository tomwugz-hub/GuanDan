/**
 * game-4 seed 924955971 — 新一轮五局训练第 4 局（终局须压不宜过牌）。
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

function rec(hand, previousPlay, state) {
  return recommendPlay(hand, "2", previousPlay, {
    state, playerIndex: 0, mlFusionMode: "off", maxCandidates: 96,
  });
}

console.log("golden-game924955971: 第4局实机教训\n");

const oppFew = cards(Array.from({ length: 3 }, () => ["3", SUITS.clubs, 0]));
const partnerFew = cards(Array.from({ length: 4 }, () => ["4", SUITS.hearts, 0]));
const selfBase = cards([
  ["6", SUITS.hearts, 0], ["7", SUITS.diamonds, 0], ["7", SUITS.spades, 0],
  ["2", SUITS.diamonds, 0], ["2", SUITS.hearts, 1], ["10", SUITS.diamonds, 0],
  ["J", SUITS.clubs, 0], ["Q", SUITS.clubs, 0],
  ["K", SUITS.spades, 0], ["K", SUITS.hearts, 0],
  ["A", SUITS.diamonds, 0], ["A", SUITS.hearts, 1], ["A", SUITS.spades, 0],
  ["5", SUITS.clubs, 0], ["8", SUITS.hearts, 0],
]);

function endgameState(hand, previousPlay, lastActive = 1) {
  return createGameStateFromHands({
    levelRank: "2",
    hands: [hand, oppFew, partnerFew, oppFew],
    currentPlayerIndex: 0,
    lastActivePlay: previousPlay,
    lastActivePlayerIndex: lastActive,
  });
}

{
  const hand = [...selfBase];
  const single5 = classifyPlay([createCard("5", SUITS.hearts, 0)], "2");
  const single6 = classifyPlay([createCard("6", SUITS.hearts, 0)], "2");
  const pass = classifyPlay([], "2");
  const state = endgameState(hand, single5);
  const top = rec(hand, single5, state);
  const { pool } = computeRecommendations(hand, "2", single5, { state, playerIndex: 0, mlFusionMode: "off", maxCandidates: 96 });
  const sPass = pool.find((item) => playSignature(item.candidate) === playSignature(pass))?.score;
  assert(top.candidate?.type === PLAY_TYPES.single && top.candidate?.mainRank === "6",
    `须压单5应单6，实际 ${playSignature(top.candidate)}`);
  assert(sPass == null || top.score < sPass, `跟单应优于过牌（top=${top.score} 过牌=${sPass}）`);
  console.log("  ✓ turn56-须压单5出单6不过牌");
}

{
  const hand = [...selfBase];
  const singleK = classifyPlay([createCard("K", SUITS.clubs, 0)], "2");
  const wild2 = classifyPlay([createCard("2", SUITS.diamonds, 0)], "2");
  const pass = classifyPlay([], "2");
  const state = endgameState(hand, singleK);
  const top = rec(hand, singleK, state);
  const { pool } = computeRecommendations(hand, "2", singleK, { state, playerIndex: 0, mlFusionMode: "off", maxCandidates: 96 });
  const sPass = pool.find((item) => playSignature(item.candidate) === playSignature(pass))?.score;
  assert(top.candidate?.type === PLAY_TYPES.single && top.candidate?.mainRank === "2",
    `须压单K应级牌2，实际 ${playSignature(top.candidate)}`);
  assert(sPass == null || top.score < sPass, `跟单应优于过牌`);
  console.log("  ✓ turn60-须压单K出级牌2不过牌");
}

{
  const hand = [...selfBase];
  const single5 = classifyPlay([createCard("5", SUITS.hearts, 0)], "2");
  const pass = classifyPlay([], "2");
  const state = endgameState(hand, single5);
  const top = rec(hand, single5, state);
  assert(top.candidate?.type !== PLAY_TYPES.pass, `turn68 须压单5不应过牌，实际 ${playSignature(top.candidate)}`);
  console.log("  ✓ turn68-须压单5不宜过牌");
}

{
  const hand = [...selfBase];
  const singleK = classifyPlay([createCard("K", SUITS.diamonds, 0)], "2");
  const state = endgameState(hand, singleK);
  const top = rec(hand, singleK, state);
  assert(top.candidate?.type === PLAY_TYPES.single && top.candidate?.mainRank === "2",
    `turn72 须压单K应级牌2，实际 ${playSignature(top.candidate)}`);
  console.log("  ✓ turn72-须压单K出级牌2");
}

{
  const hand = cards([
    ["6", SUITS.hearts, 0], ["7", SUITS.diamonds, 0], ["7", SUITS.spades, 0],
    ["2", SUITS.diamonds, 0], ["2", SUITS.hearts, 1], ["10", SUITS.diamonds, 0],
    ["J", SUITS.clubs, 0], ["Q", SUITS.clubs, 0],
    ["K", SUITS.spades, 0], ["K", SUITS.hearts, 0],
    ["A", SUITS.diamonds, 0], ["A", SUITS.hearts, 1], ["A", SUITS.spades, 0],
  ]);
  const single7 = classifyPlay([createCard("7", SUITS.clubs, 0)], "2");
  const pass = classifyPlay([], "2");
  const state = endgameState(hand, single7);
  const top = rec(hand, single7, state);
  const { pool } = computeRecommendations(hand, "2", single7, { state, playerIndex: 0, mlFusionMode: "off", maxCandidates: 96 });
  const sPass = pool.find((item) => playSignature(item.candidate) === playSignature(pass))?.score;
  assert(top.candidate?.type === PLAY_TYPES.single && top.candidate?.mainRank === "10",
    `turn80 须压单7应单10，实际 ${playSignature(top.candidate)}`);
  assert(sPass == null || top.score < sPass, `跟单应优于过牌`);
  console.log("  ✓ turn80-须压单7出单10不过牌");
}

console.log("\ngolden-game924955971: 5 条全部通过\n");
