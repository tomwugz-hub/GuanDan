import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGameStateFromHands, classifyPlay } from "../src/index.mjs";
import { deserializeCard } from "./lib/canonical-replay.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "training-samples/coach-questions-latest.json"), "utf8"));
const game = data.currentPosition;
const initialHands = game.initialHands.map((h) => h.cards.map((c) => deserializeCard(c)));
const suitMap = { S: "spades", H: "hearts", C: "clubs", D: "diamonds", JOKER: "joker" };

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

for (const turn of [16, 40, 48]) {
  const st = replayTo(turn);
  const h = st.players[0].hand;
  const specs = h.map((c) => `["${c.rank}", SUITS.${suitMap[c.suit]}, ${c.deckIndex}]`);
  console.log(`\n// turn ${turn} hand (${h.length} cards)`);
  console.log(specs.join(",\n"));
  console.log(`// prev: ${st.lastActivePlay?.mainRank} lastActive: ${st.lastActivePlayerIndex}`);
  console.log(`// opponents:`, st.players.map((p, i) => `${i}:${p.hand.length}`).join(" "));
}
