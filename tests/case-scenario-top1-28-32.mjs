/**
 * 例28～32 场景 Top1 golden：批次5
 */
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";

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
  return JSON.parse(readFileSync("training-samples/cases/case-scenarios-1-50.json", "utf8")).find((s) => s.caseNumber === n);
}

function buildState(n) {
  const spec = scenario(n);
  const hand = handFromCase(n);
  const level = spec.levelRank;
  const filler = Array.from({ length: 16 }, () => createCard("5", SUITS.clubs));
  if (spec.kind === "open") {
    return createGameStateFromHands({ levelRank: level, hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  }
  const prev = classifyPlay(
    spec.previousCards.map(([r, s, d = 0]) => createCard(r, SUIT[s] ?? s, d)),
    level,
  );
  const pass = classifyPlay([], level);
  let state = createGameStateFromHands({ levelRank: level, hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: spec.lastActive };
  const history = [{ turnNumber: 0, playerIndex: spec.lastActive, play: prev }];
  if (spec.passTail >= 2) {
    history.push({ turnNumber: 1, playerIndex: (spec.lastActive + 1) % 4, play: pass });
    history.push({ turnNumber: 2, playerIndex: (spec.lastActive + 2) % 4, play: pass });
  }
  state.playHistory = history;
  return state;
}

function runCase(n, expectType, expectRank) {
  const state = buildState(n);
  for (const [label, opts] of [
    ["quick", { lite: true, scoringAudience: "human-lite", maxCandidates: 12, deadline: performance.now() + 2500 }],
    ["full", { lite: false, scoringAudience: "human", maxCandidates: 96, deadline: performance.now() + 6000 }],
  ]) {
    const t0 = performance.now();
    const advice = getTurnAdvice(state, 0, opts);
    const ms = performance.now() - t0;
    const rec = advice.recommendation.candidate;
    assert(
      rec.type === expectType && rec.mainRank === expectRank,
      `例${n} ${label} 期望 ${expectType}/${expectRank}，得 ${rec.type}/${rec.mainRank ?? ""} (${ms.toFixed(0)}ms)`,
    );
    assert(ms < 5000, `例${n} ${label} ${ms.toFixed(0)}ms 超过 5s`);
    console.log(`PASS 例${n} ${label}: ${rec.mainRank ?? rec.type} (${ms.toFixed(0)}ms)`);
  }
}

runCase(28, PLAY_TYPES.pair, "5");
runCase(29, PLAY_TYPES.plane, "10");
runCase(30, PLAY_TYPES.straightFlush, "8");
runCase(31, PLAY_TYPES.straightFlush, "10");
runCase(32, PLAY_TYPES.single, "3");
console.log("PASS 例28～32 场景 Top1 golden");
