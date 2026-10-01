import { cardId } from "../engine/card.mjs";

export function decisionPlaySignature(play) {
  if (!play) return "None|||";
  const cards = (play.cards ?? []).map(cardId).sort().join(",");
  const assignments = (play.wildcardAssignments ?? [])
    .map((assignment) => {
      const from = assignment?.from ? cardId(assignment.from) : "";
      const as = assignment?.as && typeof assignment.as === "object"
        ? Object.keys(assignment.as).sort().map((key) => `${key}:${assignment.as[key]}`).join(",")
        : (assignment?.as ?? "");
      return `${from}>${as}`;
    })
    .sort()
    .join(",");
  return [
    play.type ?? "Unknown",
    play.mainRank ?? "",
    play.length ?? play.cards?.length ?? 0,
    cards,
    assignments,
  ].join("|");
}

function historyEntrySignature(entry) {
  return [
    entry.turnNumber ?? "",
    entry.playerIndex ?? "",
    decisionPlaySignature(entry.play),
  ].join("@");
}

export function decisionStateSignature(state) {
  if (!state || state.schemaVersion !== 1) {
    throw new TypeError("normalized decision state version 1 is required");
  }
  return [
    "DecisionState@1",
    `level=${state.levelRank}`,
    `player=${state.playerIndex}`,
    `current=${state.currentPlayerIndex}`,
    `partner=${state.partnerIndex}`,
    `active=${state.lastActivePlayerIndex ?? ""}`,
    `hand=${state.hand.map(cardId).join(",")}`,
    `previous=${decisionPlaySignature(state.previousPlay)}`,
    `remaining=${state.remainingCardCounts.join(",")}`,
    `finished=${state.finishOrder.map((value) => value ?? "").join(",")}`,
    `history=${state.playHistory.map(historyEntrySignature).join(";")}`,
  ].join("|");
}
