/**
 * match-7 第1/5手：须压对手中小三带二、手牌仍多 → Top1 宜过牌，不得拆连对 2-3-4 用 JJJ+22
 */
import { createCard } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import { buildStrategicGroups } from "../strategy/strategic-groups.mjs";
import { breaksStrategicPremiumForTripleWithPair } from "../strategy/scorers/structure.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";

const c = (r, s, d = 0) => createCard(r, s, d);
const hand = [
  c("2", "C", 0), c("2", "C", 1), c("3", "H", 0), c("3", "S", 0), c("4", "C", 0), c("4", "D", 1),
  c("5", "S", 0), c("5", "S", 1), c("6", "D", 0), c("6", "H", 1), c("6", "S", 0), c("6", "S", 1),
  c("7", "C", 0), c("7", "C", 1), c("8", "C", 0), c("8", "S", 0), c("10", "C", 1), c("10", "H", 0),
  c("J", "D", 1), c("J", "H", 1), c("J", "S", 1), c("Q", "D", 0), c("K", "C", 1), c("K", "S", 1),
  c("A", "C", 1), c("A", "H", 1), c("BJ", "JOKER", 1),
];
const prev = classifyPlay([
  c("6", "C", 0), c("6", "C", 1), c("6", "D", 1), c("2", "H", 1), c("2", "S", 0),
], "A");
const pg = buildStrategicGroups(hand, "A");
const filler = Array.from({ length: 27 }, (_, i) => c("3", "D", i));
let state = createGameStateFromHands({
  levelRank: "A",
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
});
state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1, handCounts: [27, 22, 27, 27] };

const rec = recommendPlay(hand, "A", prev, {
  state,
  playerIndex: 0,
  lastActivePlayerIndex: 1,
  lite: true,
  scoringAudience: "human-lite",
  preferredGroups: pg,
  maxCandidates: 40,
});

if (rec.candidate.type !== PLAY_TYPES.pass) {
  const brk = breaksStrategicPremiumForTripleWithPair(
    rec.candidate,
    hand,
    "A",
    pg,
    { preferredGroups: pg, previousPlay: prev },
  );
  console.error("FAIL: Top1 宜过牌，实际", rec.candidate.label ?? rec.candidate.type, "break=", brk);
  process.exit(1);
}

const prev5 = classifyPlay([
  c("9", "C", 1), c("9", "D", 1), c("9", "S", 1), c("4", "D", 0), c("4", "S", 0),
], "A");
const rec5 = recommendPlay(hand, "A", prev5, {
  state: { ...state, lastActivePlay: prev5 },
  playerIndex: 0,
  lastActivePlayerIndex: 1,
  lite: true,
  scoringAudience: "human-lite",
  preferredGroups: pg,
  maxCandidates: 40,
});
if (rec5.candidate.type !== PLAY_TYPES.pass) {
  console.error("FAIL: 第5手同类局面 Top1 宜过牌，实际", rec5.candidate.label ?? rec5.candidate.type);
  process.exit(1);
}

console.log("PASS: match-7 中小三带二手牌仍多宜过牌（不拆连对 JJJ+22）");
