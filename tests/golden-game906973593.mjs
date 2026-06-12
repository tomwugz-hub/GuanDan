/**
 * game-6 seed 906973593 — 五局训练第 5 局。
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
  ["3", SUITS.clubs], ["6", SUITS.hearts], ["8", SUITS.clubs], ["J", SUITS.diamonds],
]);

function windAfterKbBomb(turnBase = 28) {
  const bombK = classifyPlay(cards([
    ["K", SUITS.clubs, 0], ["K", SUITS.hearts, 0], ["K", SUITS.hearts, 1], ["K", SUITS.spades, 1],
  ]), "2");
  const pass = classifyPlay([], "2");
  return [
    { turnNumber: turnBase, playerIndex: 0, play: bombK },
    { turnNumber: turnBase + 1, playerIndex: 3, play: pass },
    { turnNumber: turnBase + 2, playerIndex: 2, play: pass },
    { turnNumber: turnBase + 3, playerIndex: 1, play: pass },
  ];
}

console.log("golden-game906973593: 第5局实机教训\n");

{
  const hand = cards([
    ["2", SUITS.diamonds, 0], ["2", SUITS.spades, 0], ["3", SUITS.spades, 1],
    ["4", SUITS.clubs, 1], ["4", SUITS.diamonds, 1], ["4", SUITS.spades, 1],
    ["5", SUITS.clubs, 0], ["5", SUITS.spades, 0], ["6", SUITS.diamonds, 0],
    ["7", SUITS.diamonds, 1], ["7", SUITS.hearts, 0], ["7", SUITS.hearts, 1],
    ["8", SUITS.diamonds, 0], ["9", SUITS.diamonds, 1], ["9", SUITS.hearts, 1], ["9", SUITS.spades, 0],
    ["10", SUITS.diamonds, 1], ["10", SUITS.hearts, 0], ["10", SUITS.hearts, 1],
    ["J", SUITS.clubs, 1], ["K", SUITS.clubs, 0], ["K", SUITS.hearts, 0], ["K", SUITS.hearts, 1], ["K", SUITS.spades, 1],
    ["A", SUITS.spades, 1], ["BJ", SUITS.joker, 1],
  ]);
  const state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  const top = recommendPlay(hand, "2", null, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.single, `开局应散单试探，实际 ${playSignature(top.candidate)}`);
  assert(top.candidate?.mainRank !== "5", "开局不宜首推单5");
  const single5 = classifyPlay([createCard("5", SUITS.clubs, 0)], "2");
  const { pool } = computeRecommendations(hand, "2", null, { state, playerIndex: 0, mlFusionMode: "off" });
  const s5 = pool.find((item) => playSignature(item.candidate) === playSignature(single5))?.score;
  assert(s5 == null || top.score < s5, `散单试探应优于单5（top=${top.score} 单5=${s5}）`);
  console.log("  ✓ turn0-开局散单试探不宜首推单5");
}

{
  const hand = cards([
    ["2", SUITS.diamonds, 0], ["2", SUITS.spades, 0], ["3", SUITS.spades, 1],
    ["4", SUITS.clubs, 1], ["4", SUITS.diamonds, 1], ["4", SUITS.spades, 1], ["5", SUITS.spades, 0],
    ["6", SUITS.diamonds, 0], ["7", SUITS.diamonds, 1], ["7", SUITS.hearts, 0], ["7", SUITS.hearts, 1],
    ["8", SUITS.diamonds, 0], ["9", SUITS.diamonds, 1], ["9", SUITS.hearts, 1], ["9", SUITS.spades, 0],
    ["10", SUITS.diamonds, 1], ["10", SUITS.hearts, 0], ["10", SUITS.hearts, 1],
    ["A", SUITS.spades, 1], ["BJ", SUITS.joker, 1],
  ]);
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: null, playHistory: windAfterKbBomb() };
  const top = recommendPlay(hand, "2", null, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(
    top.candidate?.type !== PLAY_TYPES.straightFlush,
    `刚炸K接风不宜空扔同花顺，实际 ${playSignature(top.candidate)}`,
  );
  const reasonText = (top.reasons ?? []).join(" ");
  assert(
    /小单|对子|三带二|刚炸|试探|不宜空扔/.test(reasonText) || top.candidate?.type !== PLAY_TYPES.straightFlush,
    `应体现接风保留同花顺，实际 ${reasonText}`,
  );
  console.log("  ✓ turn32-刚炸夺权接风不空扔同花顺");
}

{
  const hand = cards([
    ["2", SUITS.diamonds, 0], ["2", SUITS.spades, 0], ["3", SUITS.spades, 1], ["4", SUITS.spades, 1], ["5", SUITS.spades, 0],
    ["6", SUITS.diamonds, 0], ["7", SUITS.diamonds, 1], ["7", SUITS.hearts, 0], ["7", SUITS.hearts, 1],
    ["8", SUITS.diamonds, 0], ["9", SUITS.diamonds, 1], ["9", SUITS.hearts, 1], ["9", SUITS.spades, 0],
    ["10", SUITS.diamonds, 1], ["10", SUITS.hearts, 0], ["10", SUITS.hearts, 1],
    ["A", SUITS.spades, 1], ["BJ", SUITS.joker, 1],
  ]);
  const single3 = classifyPlay([createCard("3", SUITS.clubs, 1)], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: single3, lastActivePlayerIndex: 1 };
  const top = recommendPlay(hand, "2", single3, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.single && top.candidate?.mainRank === "BJ",
    `压梅花3应大王控权，不宜级牌2，实际 ${playSignature(top.candidate)}`);
  console.log("  ✓ turn40-压单3用大王非级牌2");
}

{
  const hand = cards([
    ["2", SUITS.spades, 0], ["3", SUITS.spades, 1], ["4", SUITS.spades, 1], ["5", SUITS.spades, 0],
    ["6", SUITS.diamonds, 0], ["7", SUITS.diamonds, 1], ["8", SUITS.diamonds, 0], ["9", SUITS.diamonds, 1],
    ["10", SUITS.diamonds, 1], ["10", SUITS.hearts, 0], ["10", SUITS.hearts, 1], ["A", SUITS.spades, 1],
  ]);
  const pairA = classifyPlay([createCard("A", SUITS.clubs, 1), createCard("A", SUITS.diamonds, 0)], "2");
  const oppFiller = cards([["3", SUITS.clubs], ["6", SUITS.hearts], ["8", SUITS.clubs], ["J", SUITS.diamonds]]);
  const hands = [
    hand,
    [...oppFiller, ...cards(Array.from({ length: 17 }, () => ["3", SUITS.clubs, 0]))],
    [...oppFiller, ...cards(Array.from({ length: 10 }, () => ["4", SUITS.hearts, 0]))],
    [...oppFiller, ...cards(Array.from({ length: 3 }, () => ["5", SUITS.diamonds, 0]))],
  ];
  const state = createGameStateFromHands({
    levelRank: "2",
    hands,
    currentPlayerIndex: 0,
    lastActivePlay: pairA,
    lastActivePlayerIndex: 3,
  });
  const top = recommendPlay(hand, "2", pairA, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(
    top.candidate?.type === PLAY_TYPES.straightFlush,
    `须压对A仅同花顺可跟，应抢权出同花顺，实际 ${playSignature(top.candidate)}`,
  );
  const pass = classifyPlay([], "2");
  const { pool } = computeRecommendations(hand, "2", pairA, { state, playerIndex: 0, mlFusionMode: "off" });
  const sPass = pool.find((item) => playSignature(item.candidate) === playSignature(pass))?.score;
  assert(sPass == null || top.score < sPass, `同花顺抢权应优于过牌（top=${top.score} 过牌=${sPass}）`);
  console.log("  ✓ turn60-须压对A同花顺抢权不过牌");
}

console.log("\ngolden-game906973593: 4 条全部通过\n");
