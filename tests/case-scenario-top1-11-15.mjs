/**
 * 例11～15 场景 Top1 golden：批次A3（百例1～50补齐）
 */
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { scoreCandidate } from "../strategy/recommend.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { buildStrategicGroups } from "../strategy/strategic-groups.mjs";
import { enrichScoringContext } from "../strategy/table-context.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const TYPE_MAP = {
  Pass: PLAY_TYPES.pass, Single: PLAY_TYPES.single, Pair: PLAY_TYPES.pair,
  Triple: PLAY_TYPES.triple, TripleWithPair: PLAY_TYPES.tripleWithPair,
  Straight: PLAY_TYPES.straight, ConsecutivePairs: PLAY_TYPES.consecutivePairs,
  StraightFlush: PLAY_TYPES.straightFlush, Bomb: PLAY_TYPES.bomb,
};
const SUIT = {
  spades: SUITS.spades, hearts: SUITS.hearts, clubs: SUITS.clubs, diamonds: SUITS.diamonds,
  joker: SUITS.joker, S: SUITS.spades, H: SUITS.hearts, C: SUITS.clubs, D: SUITS.diamonds,
};

function handFromCase(n) {
  const data = JSON.parse(readFileSync(`training-samples/cases/case-${String(n).padStart(3, "0")}.json`, "utf8"));
  return data.hand.cards.map((c) => createCard(
    c.rank, c.rank === "SJ" || c.rank === "BJ" ? SUITS.joker : (SUIT[c.suit] ?? c.suit), c.deckIndex ?? 0,
  ));
}

function loadScenario(n) {
  return JSON.parse(readFileSync("training-samples/cases/case-scenarios-1-50.json", "utf8")).find((s) => s.caseNumber === n);
}

function buildFollowState(spec, n) {
  const hand = handFromCase(n);
  const level = spec.levelRank;
  const filler = Array.from({ length: 16 }, () => createCard("5", SUITS.clubs));
  const prev = classifyPlay(spec.previousCards.map(([r, s, d = 0]) => createCard(r, SUIT[s] ?? s, d)), level);
  let state = createGameStateFromHands({ levelRank: level, hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: spec.lastActive };
  state.playHistory = [{ turnNumber: 0, playerIndex: spec.lastActive, play: prev }];
  return state;
}

function runFollow(n, spec) {
  const state = buildFollowState(spec, n);
  const pType = TYPE_MAP[spec.prefer.type];
  for (const [label, opts] of [
    ["quick", { lite: true, scoringAudience: "human-lite", maxCandidates: 12, deadline: performance.now() + 2500 }],
    ["full", { lite: false, scoringAudience: "human", maxCandidates: 96, deadline: performance.now() + 6000 }],
  ]) {
    const t0 = performance.now();
    const rec = getTurnAdvice(state, 0, opts).recommendation.candidate;
    const ms = performance.now() - t0;
    assert(rec.type === pType && (pType === PLAY_TYPES.pass || rec.mainRank === spec.prefer.mainRank),
      `例${n} ${label} 期望 ${spec.prefer.type}/${spec.prefer.mainRank ?? ""}，得 ${rec.type}/${rec.mainRank ?? ""}`);
    assert(ms < 5000, `例${n} ${label} ${ms.toFixed(0)}ms 超时`);
    console.log(`PASS 例${n} follow ${label}: ${rec.mainRank ?? rec.type} (${ms.toFixed(0)}ms)`);
  }
}

function runOpen(n, spec) {
  const hand = handFromCase(n);
  const level = spec.levelRank;
  const filler = Array.from({ length: 16 }, () => createCard("5", SUITS.clubs));
  const state = createGameStateFromHands({ levelRank: level, hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  const pType = TYPE_MAP[spec.prefer.type];
  for (const [label, opts] of [
    ["quick", { lite: true, scoringAudience: "human-lite", maxCandidates: 12, deadline: performance.now() + 2500, handProfile: spec.profile }],
    ["full", { lite: false, scoringAudience: "human", maxCandidates: 96, deadline: performance.now() + 6000, handProfile: spec.profile }],
  ]) {
    const t0 = performance.now();
    const rec = getTurnAdvice(state, 0, opts).recommendation.candidate;
    const ms = performance.now() - t0;
    assert(rec.type === pType && rec.mainRank === spec.prefer.mainRank,
      `例${n} open ${label} 期望 ${spec.prefer.type}/${spec.prefer.mainRank}，得 ${rec.type}/${rec.mainRank ?? ""}`);
    assert(ms < 5000, `例${n} ${label} ${ms.toFixed(0)}ms 超时`);
    console.log(`PASS 例${n} open ${label}: ${rec.mainRank} (${ms.toFixed(0)}ms)`);
  }
}

function runStructure(n, spec) {
  const hand = handFromCase(n);
  const level = spec.levelRank;
  const pool = generateBasicCandidates(hand, level, null, { lite: false, maxStraightVariants: 24 });
  const pType = TYPE_MAP[spec.prefer.type];
  const oType = TYPE_MAP[spec.over.type];
  const prefer = pool.find((c) => c.type === pType && c.mainRank === spec.prefer.mainRank);
  const over = pool.find((c) => c.type === oType && c.mainRank === spec.over.mainRank);
  assert(prefer, `例${n} 缺 prefer`);
  assert(over, `例${n} 缺 over`);
  const groups = buildStrategicGroups(hand, level);
  const ctx = enrichScoringContext(
    { isOpening: true, leadMode: "fresh-open", preferredGroups: groups, _candidates: pool, handProfile: spec.profile },
    pool, hand, level,
  );
  const sp = scoreCandidate(prefer, hand, level, null, ctx).score;
  const so = scoreCandidate(over, hand, level, null, ctx).score;
  assert(sp < so, `例${n} structure ${sp} vs ${so}`);
  console.log(`PASS 例${n} structure: ${spec.prefer.type}/${spec.prefer.mainRank} 优于 ${spec.over.type}/${spec.over.mainRank}`);
}

runFollow(11, loadScenario(11));
runFollow(12, loadScenario(12));
runStructure(13, loadScenario(13));
const s14 = loadScenario(14);
runStructure(14, s14);
runOpen(14, s14);
runStructure(15, loadScenario(15));
console.log("PASS 例11～15 场景 Top1 golden");
