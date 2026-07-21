/**
 * Build the compact, auditable timeline row used for automatic robot turns.
 * Inputs are already serialized so this helper stays pure and browser-free.
 */
export function buildRobotAutoTimelineRecord({
  turnNumber,
  playerIndex,
  playerName,
  levelRank,
  handBefore,
  lastActivePlayerIndex,
  mustBeat,
  recommendation = null,
  actualPlay,
}) {
  return {
    turnNumber,
    playerIndex,
    playerName,
    source: "robot-auto",
    levelRank,
    handCount: handBefore?.length ?? 0,
    handBefore: [...(handBefore ?? [])],
    tableBefore: { lastActivePlayerIndex: lastActivePlayerIndex ?? null },
    mustBeat: mustBeat ?? null,
    choices: recommendation ? [{
      index: 1,
      score: Math.round(recommendation.score ?? 0),
      play: recommendation.play,
      reasons: (recommendation.reasons ?? []).slice(0, 3),
    }] : [],
    actualPlay,
    actualChoiceIndex: recommendation ? 1 : null,
    actualChoiceMatch: recommendation ? "suggestion-1" : "outside-top-3",
  };
}

