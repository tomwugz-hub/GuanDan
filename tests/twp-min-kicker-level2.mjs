/**
 * 级牌2：三带二应带最小整对（保留级牌对），不宜 555+44 / 777+22
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import {
  inferTripleWithPairKickerRank,
  minTripleWithPairKickerRank,
} from "../strategy/scorers/structure.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);
const cards = (specs) => specs.map(([rank, suit, deckIndex = 0]) => c(rank, suit, deckIndex));
const filler = cards(Array.from({ length: 27 }, () => ["6", SUITS.clubs, 0]));

function kickerRank(play) {
  return inferTripleWithPairKickerRank(play);
}

// 接风/领出：555 带 33 优于 44（级牌2，连对 234 仍宜最小对3）
const handLead = cards([
  ["5", SUITS.spades, 0], ["5", SUITS.hearts, 0], ["5", SUITS.clubs, 0],
  ["3", SUITS.diamonds, 0], ["3", SUITS.hearts, 0],
  ["4", SUITS.spades, 0], ["4", SUITS.clubs, 0],
  ["7", SUITS.spades, 0], ["8", SUITS.hearts, 0], ["9", SUITS.clubs, 0], ["10", SUITS.diamonds, 0],
  ["J", SUITS.spades, 0], ["Q", SUITS.hearts, 0], ["K", SUITS.clubs, 0], ["A", SUITS.diamonds, 0],
  ["2", SUITS.spades, 0], ["2", SUITS.clubs, 0],
]);
const stateLead = createGameStateFromHands({
  levelRank: "2",
  hands: [handLead, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: null,
  lastActivePlayerIndex: 3,
});
const allLead = generateBasicCandidates(handLead, "2", null);
const twp533 = allLead.find(
  (p) => p.type === PLAY_TYPES.tripleWithPair && p.mainRank === "5" && kickerRank(p) === "3",
);
const twp544 = allLead.find(
  (p) => p.type === PLAY_TYPES.tripleWithPair && p.mainRank === "5" && kickerRank(p) === "4",
);
if (!twp533 || !twp544) {
  console.error("FAIL: 应能生成 555+33 与 555+44");
  process.exit(1);
}
if (minTripleWithPairKickerRank(handLead, "2", "5") !== "3") {
  console.error("FAIL: 最小附件对应为 3");
  process.exit(1);
}
const recLead = recommendPlay(handLead, "2", null, { state: stateLead, mlFusionMode: "off" });
if (recLead.candidate?.type === PLAY_TYPES.tripleWithPair && recLead.candidate.mainRank === "5") {
  if (kickerRank(recLead.candidate) !== "3") {
    console.error("FAIL: 接风三带五应带对3，实际对", kickerRank(recLead.candidate));
    process.exit(1);
  }
}

// 须压 555+33：777+QQ 优于 777+22（级牌对保留）
const handBeat = cards([
  ["7", SUITS.spades, 0], ["7", SUITS.hearts, 0], ["7", SUITS.clubs, 0],
  ["2", SUITS.spades, 0], ["2", SUITS.clubs, 0],
  ["Q", SUITS.hearts, 0], ["Q", SUITS.diamonds, 0],
  ["3", SUITS.diamonds, 0], ["4", SUITS.hearts, 0], ["6", SUITS.clubs, 0], ["8", SUITS.diamonds, 0],
  ["9", SUITS.spades, 0], ["10", SUITS.hearts, 0], ["J", SUITS.clubs, 0], ["K", SUITS.diamonds, 0], ["A", SUITS.spades, 0],
]);
const opp55533 = classifyPlay(cards([
  ["5", SUITS.spades, 0], ["5", SUITS.hearts, 0], ["5", SUITS.clubs, 0],
  ["3", SUITS.diamonds, 0], ["3", SUITS.hearts, 0],
]), "2");
const recBeat = recommendPlay(handBeat, "2", opp55533, { mlFusionMode: "off" });
if (recBeat.candidate?.type !== PLAY_TYPES.tripleWithPair || recBeat.candidate.mainRank !== "7") {
  console.error("FAIL: 须压应首推 777 三带二，实际", recBeat.candidate?.type, recBeat.candidate?.mainRank);
  process.exit(1);
}
if (kickerRank(recBeat.candidate) !== "Q") {
  console.error("FAIL: 须压 555+33 应 777+QQ，不宜 777+22，实际对", kickerRank(recBeat.candidate));
  process.exit(1);
}

console.log("PASS: 级牌2 三带二带最小对");
