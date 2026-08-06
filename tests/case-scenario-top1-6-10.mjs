/**
 * 例6～10 场景 Top1 golden：批次A2（百例1～50补齐）
 */
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { scoreCandidate } from "../strategy/recommend.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { buildStrategicGroups } from "../strategy/strategic-groups.mjs";
import { enrichScoringContext } from "../strategy/table-context.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const SUIT = {
  spades: SUITS.spades, hearts: SUITS.hearts, clubs: SUITS.clubs, diamonds: SUITS.diamonds,
  joker: SUITS.joker, S: SUITS.spades, H: SUITS.hearts, C: SUITS.clubs, D: SUITS.diamonds,
};

function handFromCase(n) {
  const data = JSON.parse(readFileSync(`training-samples/cases/case-${String(n).padStart(3, "0")}.json`, "utf8"));
  return data.hand.cards.map((c) => createCard(
    c.rank,
    c.rank === "SJ" || c.rank === "BJ" ? SUITS.joker : (SUIT[c.suit] ?? c.suit),
    c.deckIndex ?? 0,
  ));
}

function loadScenario(n) {
  return JSON.parse(readFileSync("training-samples/cases/case-scenarios-1-50.json", "utf8"))
    .find((spec) => spec.caseNumber === n);
}

function buildState(spec, n) {
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
  } else if (spec.passTail >= 1) {
    history.push({ turnNumber: 1, playerIndex: (spec.lastActive + 1) % 4, play: pass });
  }
  state.playHistory = history;
  return state;
}

function runCase(n, spec) {
  const state = buildState(spec, n);
  const profile = spec.profile ?? undefined;
  for (const [label, opts] of [
    ["quick", { lite: true, scoringAudience: "human-lite", maxCandidates: 12, deadline: performance.now() + 2500, handProfile: profile }],
    ["full", { lite: false, scoringAudience: "human", maxCandidates: 96, deadline: performance.now() + 6000, handProfile: profile }],
  ]) {
    const t0 = performance.now();
    const advice = getTurnAdvice(state, 0, opts);
    const ms = performance.now() - t0;
    const rec = advice.recommendation.candidate;
    assert(
      rec.type === spec.prefer.type && rec.mainRank === spec.prefer.mainRank,
      `例${n}(${spec.kind}) ${label} 期望 ${spec.prefer.type}/${spec.prefer.mainRank}，得 ${rec.type}/${rec.mainRank ?? ""} (${ms.toFixed(0)}ms)`,
    );
    assert(ms < 5000, `例${n} ${label} ${ms.toFixed(0)}ms 超过 5s`);
    console.log(`PASS 例${n} ${spec.kind} ${label}: ${rec.mainRank ?? rec.type} (${ms.toFixed(0)}ms)`);
  }
}

function runStructure(n, spec) {
  const hand = handFromCase(n);
  const level = spec.levelRank;
  const pool = generateBasicCandidates(hand, level, null, { lite: false, maxStraightVariants: 24 });
  const prefer = pool.find((c) => c.type === spec.prefer.type && c.mainRank === spec.prefer.mainRank);
  const over = pool.find((c) => c.type === spec.over.type && c.mainRank === spec.over.mainRank);
  assert(prefer, `例${n} structure 缺少 prefer ${spec.prefer.type}/${spec.prefer.mainRank}`);
  assert(over, `例${n} structure 缺少 over ${spec.over.type}/${spec.over.mainRank}`);
  const groups = buildStrategicGroups(hand, level);
  const ctx = enrichScoringContext(
    { isOpening: true, leadMode: "fresh-open", preferredGroups: groups, _candidates: pool, handProfile: spec.profile },
    pool, hand, level,
  );
  const sPrefer = scoreCandidate(prefer, hand, level, null, ctx).score;
  const sOver = scoreCandidate(over, hand, level, null, ctx).score;
  assert(sPrefer < sOver, `例${n} structure prefer=${sPrefer} over=${sOver}`);
  console.log(`PASS 例${n} structure: ${spec.prefer.type}/${spec.prefer.mainRank} 优于 ${spec.over.type}/${spec.over.mainRank}`);
}

for (const n of [6, 7, 8, 9, 10]) {
  const spec = loadScenario(n);
  if (spec.kind === "open" && spec.over?.type !== "Pass") {
    runStructure(n, spec);
  }
  runCase(n, spec);
}

console.log("PASS 例6～10 场景 Top1 golden");
