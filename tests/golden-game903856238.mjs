/**
 * game-4 seed 903856238 — 五局训练第 3 局。
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
  ["4", SUITS.clubs], ["6", SUITS.diamonds], ["7", SUITS.hearts], ["9", SUITS.spades],
]);

function windAfterBjLead(levelRank = "2", turnBase = 40) {
  const bj = classifyPlay([createCard("BJ", SUITS.joker, 1)], levelRank);
  const pass = classifyPlay([], levelRank);
  return [
    { turnNumber: turnBase, playerIndex: 0, play: bj },
    { turnNumber: turnBase + 1, playerIndex: 1, play: pass },
    { turnNumber: turnBase + 2, playerIndex: 2, play: pass },
    { turnNumber: turnBase + 3, playerIndex: 3, play: pass },
  ];
}

console.log("golden-game903856238: 第3局实机教训\n");

{
  const hand = cards([
    ["3", SUITS.clubs, 1], ["3", SUITS.diamonds, 0], ["3", SUITS.hearts, 0], ["3", SUITS.hearts, 1], ["3", SUITS.spades, 1],
    ["8", SUITS.diamonds, 0], ["8", SUITS.spades, 1], ["10", SUITS.diamonds, 1], ["10", SUITS.hearts, 0],
    ["10", SUITS.hearts, 1], ["10", SUITS.spades, 0], ["J", SUITS.diamonds, 0], ["J", SUITS.hearts, 1],
    ["K", SUITS.clubs, 0], ["K", SUITS.clubs, 1], ["K", SUITS.diamonds, 0],
    ["BJ", SUITS.joker, 1],
  ]);
  const single3 = classifyPlay([createCard("3", SUITS.clubs, 0)], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: single3, lastActivePlayerIndex: 1 };
  const top = recommendPlay(hand, "2", single3, { state, playerIndex: 0, mlFusionMode: "off" });
  const single8 = classifyPlay([createCard("8", SUITS.diamonds, 0)], "2");
  const bj = classifyPlay([createCard("BJ", SUITS.joker, 1)], "2");
  assert(
    playSignature(top.candidate) === playSignature(bj),
    `压单3应大王控权，不宜拆对8，实际 ${playSignature(top.candidate)}`,
  );
  const { pool } = computeRecommendations(hand, "2", single3, { state, playerIndex: 0, mlFusionMode: "off" });
  const s8 = pool.find((item) => playSignature(item.candidate) === playSignature(single8))?.score;
  const sBj = pool.find((item) => playSignature(item.candidate) === playSignature(bj))?.score;
  assert(s8 != null && sBj != null, "应能评估单8与大王");
  assert(sBj < s8, `大王应优于拆对8（分越低越好 BJ=${sBj} 单8=${s8}）`);
  const reasonText = (top.reasons ?? []).join(" ");
  assert(/三带二|对8|大王/.test(reasonText), `应体现保留对8理由，实际 ${reasonText}`);
  console.log("  ✓ turn40-压单3用大王保留对8给三K三带二");
}

{
  const hand = cards([
    ["3", SUITS.clubs, 1], ["3", SUITS.diamonds, 0], ["3", SUITS.hearts, 0], ["3", SUITS.hearts, 1], ["3", SUITS.spades, 1],
    ["8", SUITS.diamonds, 0], ["8", SUITS.spades, 1], ["10", SUITS.diamonds, 1], ["10", SUITS.hearts, 0],
    ["10", SUITS.hearts, 1], ["10", SUITS.spades, 0], ["J", SUITS.diamonds, 0], ["J", SUITS.hearts, 1],
    ["K", SUITS.clubs, 0], ["K", SUITS.clubs, 1], ["K", SUITS.diamonds, 0],
  ]);
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: null, playHistory: windAfterBjLead() };
  const pair8 = classifyPlay([createCard("8", SUITS.diamonds, 0), createCard("8", SUITS.spades, 1)], "2");
  const pairJ = classifyPlay([createCard("J", SUITS.diamonds, 0), createCard("J", SUITS.hearts, 1)], "2");
  const { pool } = computeRecommendations(hand, "2", null, { state, playerIndex: 0, mlFusionMode: "off" });
  const s8 = pool.find((item) => playSignature(item.candidate) === playSignature(pair8))?.score;
  const sJ = pool.find((item) => playSignature(item.candidate) === playSignature(pairJ))?.score;
  assert(s8 != null && sJ != null, "接风应能评估对8与对J");
  assert(s8 > sJ, `三K待带对8时，裸对8应劣于孤对J（对8=${s8} 对J=${sJ}）`);
  const k32 = classifyPlay(cards([
    ["K", SUITS.clubs, 0], ["K", SUITS.clubs, 1], ["K", SUITS.diamonds, 0],
    ["8", SUITS.diamonds, 0], ["8", SUITS.spades, 1],
  ]), "2");
  const topSig = playSignature(pool[0].candidate);
  const jSig = playSignature(pairJ);
  const k32Sig = playSignature(k32);
  assert(
    topSig === jSig || topSig === k32Sig,
    `接风Top1宜孤对J或K带对8，不宜裸对8，实际 ${topSig}`,
  );
  assert(s8 > pool[0].score, "裸对8应劣于Top1");
  console.log("  ✓ turn44-保留K带对8-孤对J优于裸对8");
}

{
  const hand = cards([
    ["3", SUITS.clubs, 1], ["3", SUITS.diamonds, 0], ["3", SUITS.hearts, 0], ["3", SUITS.hearts, 1], ["3", SUITS.spades, 1],
    ["8", SUITS.diamonds, 0], ["8", SUITS.spades, 1], ["10", SUITS.diamonds, 1], ["10", SUITS.hearts, 0],
    ["10", SUITS.hearts, 1], ["10", SUITS.spades, 0], ["K", SUITS.clubs, 0], ["K", SUITS.clubs, 1], ["K", SUITS.diamonds, 0],
  ]);
  const pairA = classifyPlay([createCard("A", SUITS.diamonds, 0), createCard("A", SUITS.spades, 1)], "2");
  let state = createGameStateFromHands({ levelRank: "2", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: pairA, lastActivePlayerIndex: 3 };
  const top = recommendPlay(hand, "2", pairA, { state, playerIndex: 0, mlFusionMode: "off" });
  assert(top.candidate?.type === PLAY_TYPES.bomb && top.candidate?.mainRank === "3",
    `压对A应五炸3满张控权，实际 ${playSignature(top.candidate)}`);
  assert((top.candidate?.cards?.length ?? 0) >= 5, "宜用五炸3而非四炸10");
  const reasonText = (top.reasons ?? []).join(" ");
  assert(/P7|满张|五炸|控牌/.test(reasonText) || top.candidate.mainRank === "3",
    `应体现P7满张炸，实际 ${reasonText}`);
  console.log("  ✓ turn48-压对A用五炸3非四炸10");
}

console.log("\ngolden-game903856238: 3 条全部通过\n");
