import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGameStateFromHands, classifyPlay, canBeat, createCard, SUITS } from "../src/index.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { deserializeCard } from "./lib/canonical-replay.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "training-samples/coach-questions-latest.json"), "utf8"));
const game = data.currentPosition;
const initialHands = game.initialHands.map((h) => h.cards.map((c) => deserializeCard(c)));

function replayTo(turn) {
  let st = createGameStateFromHands({ levelRank: "3", hands: initialHands.map((h) => [...h]), currentPlayerIndex: 0 });
  for (const entry of game.playHistory ?? []) {
    if (entry.turnNumber >= turn) break;
    const pi = entry.playerIndex;
    const play = entry.play;
    if (!play || play.isPass || play.type === "Pass") {
      st = { ...st, playHistory: [...(st.playHistory ?? []), entry], currentPlayerIndex: (pi + 1) % 4 };
      continue;
    }
    const hand = st.players[pi].hand;
    const cardIds = new Set((play.cards ?? []).map((c) => `${c.suit}${c.rank}#${c.deckIndex ?? 0}`));
    const classified = classifyPlay((play.cards ?? []).map((c) => deserializeCard(c)), st.levelRank);
    st = {
      ...st,
      players: st.players.map((p, i) => (i === pi ? { ...p, hand: hand.filter((c) => !cardIds.has(`${c.suit}${c.rank}#${c.deckIndex ?? 0}`)) } : p)),
      lastActivePlay: classified,
      lastActivePlayerIndex: pi,
      currentPlayerIndex: (pi + 1) % 4,
      passCount: 0,
      playHistory: [...(st.playHistory ?? []), entry],
    };
  }
  return st;
}

const st = replayTo(48);
const hand = st.players[0].hand;
const prev = st.lastActivePlay;
const cands = generateBasicCandidates(hand, "3", prev);
const beaters = cands.filter((c) => c.type !== "Pass" && canBeat(c, prev));
console.log("mustBeat", prev.label);
for (const c of beaters) {
  console.log(c.type, c.mainRank, c.label, canBeat(c, prev));
}
