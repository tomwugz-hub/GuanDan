/**
 * 须压级牌三带二 KKK+1010、仅炸弹可压且手牌仍多 → Top1 宜过牌，不宜动四炸
 */
import { createCard } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import { buildStrategicGroups } from "../strategy/strategic-groups.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";

const c = (r, s, d = 0) => createCard(r, s, d);
const hand = [
  c("3", "C", 0), c("3", "D", 0), c("3", "H", 0), c("3", "S", 0),
  c("4", "C"), c("5", "D"), c("6", "H"), c("7", "S"), c("8", "C"),
  c("9", "D"), c("9", "H"), c("10", "S"), c("J", "C"), c("Q", "D"),
  c("A", "H"), c("A", "S"), c("2", "C"), c("2", "D"),
];
const prev = classifyPlay([
  c("K", "C", 0), c("K", "D", 0), c("K", "H", 0),
  c("10", "C", 0), c("10", "D", 0),
], "K");
const pg = buildStrategicGroups(hand, "K");
const filler = Array.from({ length: 18 }, (_, i) => c("4", "H", i));
let state = createGameStateFromHands({
  levelRank: "K",
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
});
state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1, handCounts: [18, 15, 18, 18] };

const rec = recommendPlay(hand, "K", prev, {
  state,
  playerIndex: 0,
  lastActivePlayerIndex: 1,
  lite: true,
  scoringAudience: "human-lite",
  preferredGroups: pg,
  maxCandidates: 40,
});

if (rec.candidate.type !== PLAY_TYPES.pass) {
  console.error("FAIL: 仅炸弹可压级牌三带二、手牌仍多宜过牌，实际", rec.candidate.label ?? rec.candidate.type);
  process.exit(1);
}

console.log("PASS: 须压 KKK+1010 仅炸弹可压时手牌仍多宜过牌");
