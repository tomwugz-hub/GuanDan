/**
 * game-2 seed 902251982 — 用户 2026-06-11 实机五局训练第 1 局锁定的教练更对场景。
 * 由 training-lessons.jsonl 驱动，纳入 pre-release-gate。
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
  ["2", SUITS.clubs], ["2", SUITS.diamonds], ["9", SUITS.clubs], ["9", SUITS.diamonds],
  ["K", SUITS.clubs], ["K", SUITS.diamonds], ["J", SUITS.clubs], ["J", SUITS.diamonds],
]);

function windAfterUserLead(leadPlay, levelRank, turnBase = 20) {
  const pass = classifyPlay([], levelRank);
  return [
    { turnNumber: turnBase, playerIndex: 0, play: leadPlay },
    { turnNumber: turnBase + 1, playerIndex: 1, play: pass },
    { turnNumber: turnBase + 2, playerIndex: 2, play: pass },
    { turnNumber: turnBase + 3, playerIndex: 3, play: pass },
  ];
}

console.log("golden-game902251982: 第1局实机教训\n");

{
  const hand = cards([
    ["2", SUITS.hearts, 1], ["3", SUITS.clubs, 0], ["3", SUITS.diamonds, 1],
    ["4", SUITS.hearts, 0], ["5", SUITS.hearts, 1], ["7", SUITS.clubs, 1],
    ["8", SUITS.clubs, 0], ["9", SUITS.clubs, 1], ["J", SUITS.clubs, 1],
    ["J", SUITS.hearts, 1], ["Q", SUITS.spades, 0], ["K", SUITS.diamonds, 0],
    ["K", SUITS.spades, 1], ["A", SUITS.clubs, 0], ["A", SUITS.diamonds, 1],
  ]);
  const lead = classifyPlay(cards([
    ["5", SUITS.hearts, 0], ["5", SUITS.spades, 0], ["6", SUITS.clubs, 0], ["6", SUITS.diamonds, 1],
    ["7", SUITS.hearts, 0], ["7", SUITS.hearts, 1],
  ]), "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: null, playHistory: windAfterUserLead(lead, "2", 4) };
  const top = recommendPlay(hand, "2", null, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.straightFlush, `turn8 接风应同花顺，实际 ${playSignature(top.candidate)}`);
  console.log("  ✓ turn8-接风同花顺减五张");
}

{
  const hand = cards([
    ["2", SUITS.hearts, 1], ["7", SUITS.clubs, 1], ["8", SUITS.clubs, 0], ["9", SUITS.clubs, 1],
    ["J", SUITS.clubs, 1], ["J", SUITS.hearts, 1], ["Q", SUITS.spades, 0],
    ["K", SUITS.diamonds, 0], ["K", SUITS.spades, 1], ["A", SUITS.clubs, 0], ["A", SUITS.diamonds, 1],
  ]);
  const single10 = classifyPlay([createCard("10", SUITS.diamonds, 0)], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: single10, lastActivePlayerIndex: 1 };
  const top = recommendPlay(hand, "2", single10, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.single && top.candidate?.mainRank === "Q",
    `turn36 压单10应单Q，实际 ${playSignature(top.candidate)}`);
  console.log("  ✓ turn36-压单10出单Q不浪费J");
}

{
  const hand = cards([
    ["2", SUITS.hearts, 1], ["7", SUITS.clubs, 1], ["8", SUITS.clubs, 0], ["9", SUITS.clubs, 1],
    ["J", SUITS.clubs, 1], ["K", SUITS.diamonds, 0], ["K", SUITS.spades, 1],
    ["A", SUITS.clubs, 0], ["A", SUITS.diamonds, 1],
  ]);
  const pair7 = classifyPlay([createCard("7", SUITS.clubs, 0), createCard("7", SUITS.spades, 0)], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: pair7, lastActivePlayerIndex: 1 };
  const top = recommendPlay(hand, "2", pair7, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.pair && top.candidate?.mainRank === "K",
    `turn56 压对7应最小对K，实际 ${playSignature(top.candidate)}`);
  console.log("  ✓ turn56-压对7出对K不浪费A");
}

{
  const hand = cards([
    ["2", SUITS.hearts, 1], ["7", SUITS.clubs, 1], ["8", SUITS.clubs, 0], ["9", SUITS.clubs, 1],
    ["J", SUITS.clubs, 1], ["K", SUITS.diamonds, 0], ["K", SUITS.spades, 1],
  ]);
  const pairA = classifyPlay([createCard("A", SUITS.clubs, 0), createCard("A", SUITS.diamonds, 1)], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: null, playHistory: windAfterUserLead(pairA, "2", 56) };
  const top = recommendPlay(hand, "2", null, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.straightFlush,
    `turn60 接风应同花顺一手减五张，实际 ${playSignature(top.candidate)}`);
  console.log("  ✓ turn60-接风同花顺不先出对K");
}

console.log("\ngolden-game902251982: 4 条全部通过\n");
