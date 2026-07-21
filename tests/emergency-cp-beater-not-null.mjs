/**
 * 须压连对：humanAdviceFallback 不得返回 null candidate（否则 buildEmergencyHumanAdvice 抛错卡死 UI）
 * 仅拆同花顺连对可压时，应返回过牌而非拆跑道连对。
 */
import { createCard } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { humanAdviceFallback } from "../coach/robot-player.mjs";

const c = (r, s, deckIndex = 0) => createCard(r, s, deckIndex);
const levelRank = "9";
const hand = [
  c("A", "S"), c("2", "S"), c("3", "S"), c("4", "S"), c("5", "S"),
  c("A", "C"), c("A", "D"), c("A", "H"),
  c("3", "D"), c("3", "C"), c("6", "D"), c("6", "C"), c("7", "D"), c("7", "C"), c("2", "H"), c("2", "D"),
  c("BJ"), c("SJ"),
  c("5", "C"), c("9", "D"), c("10", "C"), c("10", "D"), c("J", "H"), c("Q", "C"), c("K", "D"), c("K", "H"),
];
const prev = classifyPlay(
  [c("4", "D"), c("4", "D", 1), c("5", "D"), c("5", "D", 1), c("6", "D"), c("9", "H")],
  levelRank,
);
const state = createGameStateFromHands({
  levelRank,
  hands: [hand, hand, hand, hand],
  currentPlayerIndex: 0,
});
state.lastActivePlay = prev;
state.lastActivePlayerIndex = 3;

const rec = humanAdviceFallback(hand, levelRank, prev, [], {
  state,
  playerIndex: 0,
  lite: true,
  scoringAudience: "human-lite",
});

if (!rec?.candidate || rec.candidate.type === PLAY_TYPES.invalid) {
  console.error("FAIL: 连对须压 emergency 应有合法 candidate，实际:", rec);
  process.exit(1);
}
if (rec.candidate.type !== PLAY_TYPES.pass) {
  console.error("FAIL: 仅拆同花顺连对可压时应推荐过牌，实际:", rec.candidate.type, rec.candidate.mainRank);
  process.exit(1);
}

console.log("PASS emergency-cp-beater-not-null");
console.log(" ", rec.candidate.type, rec.reasons?.[0]);
