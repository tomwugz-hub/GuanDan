import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGameStateFromHands, classifyPlay, canBeat } from "../src/index.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { hasActionableRegularBeater } from "../strategy/recommend.mjs";
import { deserializeCard } from "./lib/canonical-replay.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "training-samples/coach-questions-latest.json"), "utf8"));
const game = data.currentPosition;
const hands = game.initialHands.map((h) => h.cards.map((c) => deserializeCard(c)));
let state = createGameStateFromHands({ levelRank: "3", hands, currentPlayerIndex: 0 });
for (const entry of game.playHistory ?? []) {
  if (entry.turnNumber >= 16) break;
  const pi = entry.playerIndex;
  const play = entry.play;
  if (!play || play.isPass || play.type === "Pass") {
    state = { ...state, playHistory: [...(state.playHistory ?? []), entry] };
    continue;
  }
  const hand = state.players[pi].hand;
  const cardIds = new Set((play.cards ?? []).map((c) => `${c.suit}${c.rank}#${c.deckIndex ?? 0}`));
  const classified = classifyPlay((play.cards ?? []).map((c) => deserializeCard(c)), state.levelRank);
  state = {
    ...state,
    players: state.players.map((p, i) => (i === pi ? { ...p, hand: hand.filter((c) => !cardIds.has(`${c.suit}${c.rank}#${c.deckIndex ?? 0}`)) } : p)),
    lastActivePlay: classified,
    lastActivePlayerIndex: pi,
    playHistory: [...(state.playHistory ?? []), entry],
  };
}
const hand = state.players[0].hand;
const prev = state.lastActivePlay;
const cands = generateBasicCandidates(hand, "3", prev);
const regular = cands.filter((c) => c.type !== "Pass" && !["Bomb", "StraightFlush", "JokerBomb"].includes(c.type) && canBeat(c, prev));
console.log("mustBeat", prev.mainRank);
console.log("regular beaters:", regular.map((c) => c.label ?? `${c.type} ${c.mainRank}`));
console.log("hasActionable", hasActionableRegularBeater(cands, hand, "3", { state, playerIndex: 0 }));
