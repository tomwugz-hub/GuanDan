import { createCard, SUITS } from "../engine/card.mjs";
import { createGameStateFromHands, createInitialGameState } from "../engine/game-state.mjs";
import { playRecommendedTurn } from "../coach/robot-player.mjs";
import { auditRobotStructurePlay } from "../coach/robot-structure-violations.mjs";

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function expiredDeadlineTurn(state) {
  return playRecommendedTurn(state, {
    mlFusionMode: "off",
    mlModel: false,
    deadline: performance.now() - 1,
  });
}

function assertNoSplitStructureSingle(label, state, recommendation) {
  const hand = state.players[state.currentPlayerIndex].hand;
  const issues = auditRobotStructurePlay({
    play: recommendation.candidate,
    hand,
    levelRank: state.levelRank,
    state,
    playerIndex: state.currentPlayerIndex,
    mustBeat: state.lastActivePlay,
  });
  const split = issues.find((issue) => issue.code === "split-structure-single");
  if (split) {
    throw new Error(`${label}: ${split.detail}; actual=${recommendation.candidate.label ?? recommendation.candidate.type}`);
  }
}

// C′ baseline reproduction: seed 42000, turn 34 was a catch-wind/lead single 3 split.
let seededState = createInitialGameState({ levelRank: "2", random: mulberry32(42000) });
while (seededState.turnNumber < 34) {
  seededState = expiredDeadlineTurn(seededState).state;
}
if (seededState.turnNumber !== 34 || seededState.currentPlayerIndex !== 2) {
  throw new Error(`seed replay drifted: turn=${seededState.turnNumber}, player=${seededState.currentPlayerIndex}`);
}
const seededResult = expiredDeadlineTurn(seededState);
assertNoSplitStructureSingle("seed42000 turn34", seededState, seededResult.recommendation);

// Small direct golden: lowest card is a protected pair; loose 7 is safe to lead.
const c = (rank, suit, deckIndex = 0) => createCard(rank, suit, deckIndex);
const hand = [
  c("3", SUITS.spades),
  c("3", SUITS.hearts),
  c("7", SUITS.clubs),
];
const filler = [c("4", SUITS.spades), c("5", SUITS.hearts), c("6", SUITS.clubs)];
const directState = createGameStateFromHands({
  levelRank: "2",
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
});
const directResult = expiredDeadlineTurn(directState);
assertNoSplitStructureSingle("direct protected pair", directState, directResult.recommendation);
if (directResult.recommendation.candidate.type === "Single"
  && directResult.recommendation.candidate.mainRank === "3") {
  throw new Error("direct protected pair: timeout fallback split pair 3 as a single");
}

console.log("PASS: timeout constant fallback keeps strategic lead structures intact");
