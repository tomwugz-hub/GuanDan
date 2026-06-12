import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createCard, classifyPlay, createGameStateFromHands, PLAY_TYPES } from "../src/index.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { enrichScoringContext, partnerPlayedInCurrentRound } from "../strategy/table-context.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { deserializeCard } from "./lib/canonical-replay.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "training-samples/coach-questions-latest.json"), "utf8"));
const game = data.currentPosition;

function replayToTurn(targetTurn, humanOnly = false) {
  const hands = game.initialHands.map((h) =>
    h.cards.map((c) => deserializeCard(c)),
  );
  let state = createGameStateFromHands({
    levelRank: game.levelRank ?? "3",
    hands,
    currentPlayerIndex: 0,
  });
  const history = game.coachAdviceTimeline ?? [];
  for (const item of history) {
    if (item.turnNumber >= targetTurn) break;
    const play = item.actualPlay ?? item.play;
    if (!play || play.type === "Pass") {
      // apply pass via play history simulation - use play from playHistory in bundle
      continue;
    }
  }
  // use playHistory from nested state if available
  const playHistory = game.playHistory ?? data.currentPosition?.playHistory ?? [];
  for (const entry of playHistory) {
    if (entry.turnNumber >= targetTurn) break;
    const pi = entry.playerIndex;
    const play = entry.play;
    if (!play || play.isPass || play.type === "Pass") {
    state = {
      ...state,
      currentPlayerIndex: (pi + 1) % 4,
      passCount: (state.passCount ?? 0) + 1,
      playHistory: [...(state.playHistory ?? []), entry],
    };
      continue;
    }
    const hand = state.players[pi].hand;
    const cardIds = new Set((play.cards ?? []).map((c) => `${c.suit}${c.rank}#${c.deckIndex ?? 0}`));
    const newHand = hand.filter((c) => !cardIds.has(`${c.suit}${c.rank}#${c.deckIndex ?? 0}`));
    const newPlayers = state.players.map((p, i) =>
      i === pi ? { ...p, hand: newHand } : p,
    );
    const classified = classifyPlay(
      (play.cards ?? []).map((c) => deserializeCard(c)),
      state.levelRank,
    );
    state = {
      ...state,
      players: newPlayers,
      lastActivePlay: classified,
      lastActivePlayerIndex: pi,
      currentPlayerIndex: (pi + 1) % 4,
      passCount: 0,
      playHistory: [...(state.playHistory ?? []), entry],
    };
  }
  return state;
}

for (const turn of [16, 40, 48]) {
  const state = replayToTurn(turn);
  const hand = state.players[0].hand;
  const prev = state.lastActivePlay;
  console.log(`\n=== turn ${turn} ===`);
  console.log("handCount", hand.length, "mustBeat", prev?.label ?? prev?.mainRank);
  console.log("lastActivePlayer", state.lastActivePlayerIndex, "partnerPlayedRound",
    partnerPlayedInCurrentRound(state, 0));
  const cands = generateBasicCandidates(hand, "3", prev);
  const ctx = enrichScoringContext(
    { state, playerIndex: 0, previousPlay: prev, lastActivePlayerIndex: state.lastActivePlayerIndex },
    cands, hand, "3",
  );
  console.log("partnerOwnsTrick", ctx.partnerOwnsTrick, "partnerAttempted", ctx.partnerAttemptedCurrentRound,
    "bombOnly", ctx.hasActionableRegularWinner === false && ctx.hasAnyWinner);
  for (const mode of ["off", "on"]) {
    const rec = recommendPlay(hand, "3", prev, {
      state,
      playerIndex: 0,
      mlFusionMode: mode,
      mlModel: false,
    });
    const advice = getTurnAdvice(state, 0, { mlFusionMode: mode, mlModel: null });
    const top3 = advice.alternatives.slice(0, 3).map((a) =>
      `${a.candidate.type === PLAY_TYPES.pass ? "Pass" : a.candidate.label} (${a.score})`,
    );
    console.log(`ml=${mode} top1:`, rec.candidate.label ?? rec.candidate.type, rec.reasons?.slice(0, 2));
    console.log(`  top3:`, top3.join(" | "));
    const passItem = advice.alternatives.find((a) => a.candidate.type === PLAY_TYPES.pass);
    if (passItem) console.log(`  pass score:`, passItem.score, passItem.reasons?.slice(0, 2));
  }
}
