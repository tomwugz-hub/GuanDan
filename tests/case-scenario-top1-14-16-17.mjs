/**
 * 例14/16/17 场景 Top1 golden：批次2 策略 OPEN 项
 */
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { humanAdviceFallback } from "../coach/robot-player.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const SUIT = { S: SUITS.spades, H: SUITS.hearts, C: SUITS.clubs, D: SUITS.diamonds, joker: SUITS.joker };

function handFromCase(n) {
  const data = JSON.parse(readFileSync(`training-samples/cases/case-${String(n).padStart(3, "0")}.json`, "utf8"));
  return data.hand.cards.map((c) => createCard(
    c.rank,
    c.rank === "SJ" || c.rank === "BJ" ? SUITS.joker : (SUIT[c.suit] ?? c.suit),
    c.deckIndex ?? 0,
  ));
}

function scenario(n) {
  const specs = JSON.parse(readFileSync("training-samples/cases/case-scenarios-1-50.json", "utf8"));
  return specs.find((s) => s.caseNumber === n);
}

function buildOpenState(n) {
  const spec = scenario(n);
  const hand = handFromCase(n);
  const filler = Array.from({ length: 16 }, () => createCard("5", SUITS.clubs));
  return createGameStateFromHands({
    levelRank: spec.levelRank,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
}

function buildFollowState(n) {
  const spec = scenario(n);
  const hand = handFromCase(n);
  const level = spec.levelRank;
  const prev = classifyPlay(
    spec.previousCards.map(([r, s, d = 0]) => createCard(r, SUIT[s] ?? s, d)),
    level,
  );
  const pass = classifyPlay([], level);
  const filler = Array.from({ length: 16 }, () => createCard("5", SUITS.clubs));
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: prev,
    lastActivePlayerIndex: spec.lastActive,
    playHistory: [
      { turnNumber: 0, playerIndex: spec.lastActive, play: prev },
      { turnNumber: 1, playerIndex: (spec.lastActive + 1) % 4, play: pass },
      { turnNumber: 2, playerIndex: (spec.lastActive + 2) % 4, play: pass },
    ],
  };
  return state;
}

function uiOptions(deadlineMs) {
  return {
    lite: true,
    scoringAudience: "human-lite",
    maxCandidates: 12,
    preferredGroups: [],
    handProfile: null,
    deadline: performance.now() + deadlineMs,
  };
}

function runOpeningCase(n, expectType, expectRank) {
  const state = buildOpenState(n);
  for (const [label, opts, maxMs] of [
    ["quick", uiOptions(2500), 5000],
    ["full", { lite: false, scoringAudience: "human", maxCandidates: 96, deadline: performance.now() + 6000 }, 5000],
  ]) {
    const t0 = performance.now();
    const advice = getTurnAdvice(state, 0, opts);
    const ms = performance.now() - t0;
    const rec = advice.recommendation.candidate;
    assert(
      rec.type === expectType && rec.mainRank === expectRank,
      `例${n} ${label} 期望 ${expectType}/${expectRank}，得 ${rec.type}/${rec.mainRank ?? ""} (${ms.toFixed(0)}ms)`,
    );
    assert(ms < maxMs, `例${n} ${label} ${ms.toFixed(0)}ms 超过 ${maxMs / 1000}s`);
    console.log(`PASS 例${n} ${label}: ${rec.mainRank ?? rec.type} (${ms.toFixed(0)}ms)`);
  }
}

function runFollowCase17() {
  const state = buildFollowState(17);
  const hand = state.players[0].hand;
  const prev = state.lastActivePlay;
  for (const [label, opts, maxMs] of [
    ["emergency", null, 5000],
    ["quick", uiOptions(2500), 5000],
    ["full", { lite: false, scoringAudience: "human", maxCandidates: 96, deadline: performance.now() + 6000 }, 5000],
  ]) {
    const t0 = performance.now();
    const rec = label === "emergency"
      ? humanAdviceFallback(hand, state.levelRank, prev, [], {
        state,
        playerIndex: 0,
        lastActivePlayerIndex: state.lastActivePlayerIndex,
        preferredGroups: [],
        lite: true,
        scoringAudience: "human-lite",
      })
      : getTurnAdvice(state, 0, opts).recommendation;
    const ms = performance.now() - t0;
    const c = rec.candidate ?? rec;
    assert(
      c.type === PLAY_TYPES.consecutivePairs && c.mainRank === "8",
      `例17 ${label} 期望 ConsecutivePairs/8，得 ${c.type}/${c.mainRank ?? ""} (${ms.toFixed(0)}ms)`,
    );
    assert(ms < maxMs, `例17 ${label} ${ms.toFixed(0)}ms 超过 ${maxMs / 1000}s`);
    console.log(`PASS 例17 ${label}: 667788 (${ms.toFixed(0)}ms)`);
  }
}

runOpeningCase(14, PLAY_TYPES.triple, "2");
runOpeningCase(16, PLAY_TYPES.straight, "6");
runFollowCase17();
