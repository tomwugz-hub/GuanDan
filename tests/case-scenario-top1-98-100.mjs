/**
 * 例98～100 场景 Top1 golden：批次19（百例收官）
 */
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { scoreCandidate } from "../strategy/recommend.mjs";
import { buildStrategicGroups } from "../strategy/strategic-groups.mjs";
import { enrichScoringContext } from "../strategy/table-context.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const SUIT = {
  spades: SUITS.spades,
  hearts: SUITS.hearts,
  clubs: SUITS.clubs,
  diamonds: SUITS.diamonds,
  joker: SUITS.joker,
  S: SUITS.spades,
  H: SUITS.hearts,
  C: SUITS.clubs,
  D: SUITS.diamonds,
};

function loadScenarios(n, kind = null) {
  return JSON.parse(readFileSync("training-samples/cases/case-scenarios-51-100.json", "utf8"))
    .filter((spec) => spec.caseNumber === n && (!kind || spec.kind === kind));
}

function handFromCase(n) {
  const data = JSON.parse(readFileSync(`training-samples/cases/case-${String(n).padStart(3, "0")}.json`, "utf8"));
  return data.hand.cards.map((c) => createCard(
    c.rank,
    c.rank === "SJ" || c.rank === "BJ" ? SUITS.joker : (SUIT[c.suit] ?? c.suit),
    c.deckIndex ?? 0,
  ));
}

function buildState(spec, n) {
  const hand = handFromCase(n);
  const level = spec.levelRank;
  const filler = Array.from({ length: 16 }, () => createCard("5", SUITS.clubs));
  if (spec.kind === "open" || spec.kind === "structure") {
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

function runCaseSpec(spec, n) {
  const state = buildState(spec, n);
  for (const [label, opts] of [
    ["quick", { lite: true, scoringAudience: "human-lite", maxCandidates: 12, deadline: performance.now() + 2500, handProfile: spec.profile }],
    ["full", { lite: false, scoringAudience: "human", maxCandidates: 96, deadline: performance.now() + 6000, handProfile: spec.profile }],
  ]) {
    const t0 = performance.now();
    const advice = getTurnAdvice(state, 0, opts);
    const ms = performance.now() - t0;
    const rec = advice.recommendation.candidate;
    assert(
      rec.type === spec.prefer.type && rec.mainRank === spec.prefer.mainRank,
      `例${n}(${spec.kind}) ${label} 期望 ${spec.prefer.type}/${spec.prefer.mainRank}，得 ${rec.type}/${rec.mainRank ?? ""} (${ms.toFixed(0)}ms)`,
    );
    assert(ms < 5000, `例${n}(${spec.kind}) ${label} ${ms.toFixed(0)}ms 超过 5s`);
    console.log(`PASS 例${n} ${spec.kind} ${label}: ${rec.mainRank ?? rec.type} (${ms.toFixed(0)}ms)`);
  }
}

function runStructureCase(n) {
  const spec = loadScenarios(n, "structure")[0];
  assert(spec, `例${n} 缺少 structure 场景`);
  const hand = handFromCase(n);
  const level = spec.levelRank;
  const pool = generateBasicCandidates(hand, level, null, { lite: false });
  const prefer = pool.find(
    (item) => item.type === spec.prefer.type && item.mainRank === spec.prefer.mainRank,
  );
  const over = pool.find(
    (item) => item.type === spec.over.type && item.mainRank === spec.over.mainRank,
  );
  assert(prefer, `例${n} structure 缺少 prefer ${spec.prefer.type}/${spec.prefer.mainRank}`);
  assert(over, `例${n} structure 缺少 over ${spec.over.type}/${spec.over.mainRank}`);
  const groups = buildStrategicGroups(hand, level);
  const ctx = enrichScoringContext(
    { isOpening: true, leadMode: "fresh-open", preferredGroups: groups, _candidates: pool },
    pool,
    hand,
    level,
  );
  const preferScore = scoreCandidate(prefer, hand, level, null, ctx).score;
  const overScore = scoreCandidate(over, hand, level, null, ctx).score;
  assert(
    preferScore < overScore,
    `例${n} structure 期望 ${spec.prefer.type}/${spec.prefer.mainRank} 优于 ${spec.over.type}/${spec.over.mainRank}，得 prefer=${preferScore} over=${overScore}`,
  );
  console.log(`PASS 例${n} structure: ${spec.prefer.type}/${spec.prefer.mainRank} 优于 ${spec.over.type}/${spec.over.mainRank}`);
}

runStructureCase(98);
runCaseSpec(loadScenarios(99, "follow")[0], 99);
runCaseSpec(loadScenarios(100, "follow")[0], 100);
console.log("PASS 例98～100 场景 Top1 golden（百例收官）");
