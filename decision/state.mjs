import { cardId } from "../engine/card.mjs";
import { effectivePreviousPlay, resolveTrickLeaderIndex } from "../engine/game-state.mjs";
import { deepFreeze } from "./result.mjs";

function normalizeCard(card) {
  return {
    rank: card.rank,
    suit: card.suit,
    deckIndex: card.deckIndex ?? 0,
  };
}

function normalizedCards(cards = []) {
  return cards
    .map(normalizeCard)
    .sort((left, right) => {
      const leftId = cardId(left);
      const rightId = cardId(right);
      return leftId < rightId ? -1 : (leftId > rightId ? 1 : 0);
    });
}

function normalizeWildcardAssignment(assignment) {
  return {
    from: assignment?.from ? normalizeCard(assignment.from) : null,
    as: assignment?.as && typeof assignment.as === "object"
      ? { ...assignment.as }
      : (assignment?.as ?? null),
  };
}

export function normalizeDecisionPlay(play) {
  if (!play) return null;
  const cards = normalizedCards(play.cards ?? []);
  return {
    type: play.type,
    mainRank: play.mainRank ?? null,
    length: play.length ?? cards.length,
    power: play.power ?? null,
    bombSize: play.bombSize ?? null,
    chainLength: play.chainLength ?? null,
    isPass: Boolean(play.isPass || play.type === "Pass"),
    cards,
    wildcardAssignments: (play.wildcardAssignments ?? [])
      .map(normalizeWildcardAssignment),
  };
}

function normalizeHistoryEntry(entry) {
  return {
    turnNumber: entry.turnNumber ?? null,
    playerIndex: entry.playerIndex ?? null,
    play: normalizeDecisionPlay(entry.play),
  };
}

export function buildDecisionState(state, playerIndex = state?.currentPlayerIndex) {
  if (!state || !Array.isArray(state.players)) {
    throw new TypeError("game state with players is required");
  }
  if (!Number.isInteger(playerIndex) || !state.players[playerIndex]) {
    throw new RangeError(`invalid playerIndex: ${playerIndex}`);
  }

  const normalized = {
    schemaVersion: 1,
    levelRank: state.levelRank,
    playerIndex,
    partnerIndex: (playerIndex + 2) % state.players.length,
    currentPlayerIndex: state.currentPlayerIndex,
    lastActivePlayerIndex: effectivePreviousPlay(state) ? resolveTrickLeaderIndex(state, playerIndex) : null,
    hand: normalizedCards(state.players[playerIndex].hand ?? []),
    previousPlay: normalizeDecisionPlay(effectivePreviousPlay(state)),
    remainingCardCounts: state.players.map((player) => player.hand?.length ?? 0),
    finishOrder: state.players.map((player) => player.finishedOrder ?? null),
    playHistory: (state.playHistory ?? []).map(normalizeHistoryEntry),
  };

  return deepFreeze(normalized);
}
