import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGameStateFromHands, classifyPlay, PLAY_TYPES } from "../src/index.mjs";
import { partnerPlayedInCurrentRound, currentRoundActions } from "../strategy/table-context.mjs";
import { deserializeCard } from "./lib/canonical-replay.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "training-samples/coach-questions-latest.json"), "utf8"));
const game = data.currentPosition;
const hands = game.initialHands.map((h) => h.cards.map((c) => deserializeCard(c)));
let state = createGameStateFromHands({ levelRank: "3", hands, currentPlayerIndex: 0 });
const playHistory = game.playHistory ?? [];

for (const entry of playHistory) {
  if (entry.turnNumber >= 40) break;
  const pi = entry.playerIndex;
  const play = entry.play;
  if (!play || play.isPass || play.type === "Pass") {
    state = { ...state, currentPlayerIndex: (pi + 1) % 4, passCount: (state.passCount ?? 0) + 1 };
    state.playHistory = [...(state.playHistory ?? []), entry];
    continue;
  }
  const hand = state.players[pi].hand;
  const cardIds = new Set((play.cards ?? []).map((c) => `${c.suit}${c.rank}#${c.deckIndex ?? 0}`));
  const newHand = hand.filter((c) => !cardIds.has(`${c.suit}${c.rank}#${c.deckIndex ?? 0}`));
  const classified = classifyPlay((play.cards ?? []).map((c) => deserializeCard(c)), state.levelRank);
  state = {
    ...state,
    players: state.players.map((p, i) => (i === pi ? { ...p, hand: newHand } : p)),
    lastActivePlay: classified,
    lastActivePlayerIndex: pi,
    currentPlayerIndex: (pi + 1) % 4,
    passCount: 0,
    playHistory: [...(state.playHistory ?? []), entry],
  };
}

console.log("turn 40 round actions:");
for (const a of (state.playHistory ?? []).slice(-8)) {
  console.log(a.turnNumber, a.playerIndex, a.play?.type, a.play?.mainRank);
}
console.log("partnerPlayed", partnerPlayedInCurrentRound(state, 0));
console.log("lastActive", state.lastActivePlayerIndex);
