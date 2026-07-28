/**
 * 批量自博弈 + 策略违规审计（拆炸、逢人配、同花顺浪费、局未完成等）
 * 用法：node tools/audit-strategy.mjs [局数] [seed起点] [级牌]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { acquireAuditLock } from "./audit-lock.mjs";
import { isWildCard, SUITS } from "../engine/card.mjs";
import { canBeat } from "../engine/compare-play.mjs";
import { createInitialGameState, isGameOver } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { runAutoGame } from "../coach/auto-game.mjs";
import { playRecommendedTurn } from "../coach/robot-player.mjs";
import { resolveActionableRegularWinner, trimCandidatesForScoring, hasActionableRegularBeater } from "../strategy/recommend.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { buildStrategicGroups } from "../strategy/strategic-groups.mjs";
import { breaksBombIntegrity } from "../strategy/scorers/structure.mjs";
import { inferLeadMode } from "../strategy/lead-mode.mjs";
import { enrichScoringContext, opponentDangerLevel } from "../strategy/table-context.mjs";
import { shouldVetoPassWithRegularBeater } from "../strategy/principles.mjs";
import { playContradictsReasons } from "../strategy/reason-consistency.mjs";
import { alignReasonsForPlay } from "../strategy/reason-align.mjs";
import { auditRobotStructurePlay } from "../coach/robot-structure-violations.mjs";
import {
  parseAuditMode,
  buildTopReproductions,
  classifyAuditPath,
  summarizeElapsedMs,
} from "./lib/audit-lite-mode.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, "..", "training-samples");

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

const LOW_WILD_TYPES = new Set([
  PLAY_TYPES.tripleWithPair,
  PLAY_TYPES.pair,
  PLAY_TYPES.triple,
]);

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function parseArgs(argv) {
  return {
    count: Number(argv[2]) > 0 ? Number(argv[2]) : 100,
    seedStart: Number(argv[3]) >= 0 ? Number(argv[3]) : 42_000,
    levelRank: argv[4] || "2",
    maxTurns: Number(argv[5]) > 0 ? Number(argv[5]) : 600,
    ...parseAuditMode(argv),
  };
}

function usesWildLowValue(candidate, levelRank) {
  if (!candidate?.cards?.length || !LOW_WILD_TYPES.has(candidate.type)) return false;
  return candidate.cards.some((card) => isWildCard(card, levelRank));
}

function buildLiteAuditCandidates(hand, levelRank) {
  const candidates = hand.map((card) => classifyPlay([card], levelRank));
  const byRank = new Map();
  for (const card of hand) {
    const group = byRank.get(card.rank) ?? [];
    group.push(card);
    byRank.set(card.rank, group);
  }
  for (const group of byRank.values()) {
    if (group.length >= 2) candidates.push(classifyPlay(group.slice(0, 2), levelRank));
    if (group.length >= 3) candidates.push(classifyPlay(group.slice(0, 3), levelRank));
    if (group.length >= 4) candidates.push(classifyPlay(group.slice(0, 4), levelRank));
  }
  return candidates;
}

function buildAuditContext(state, hand, { liteAudit = false, doctrineAwareRegular = false } = {}) {
  const previousPlay = state.lastActivePlay;
  const preferredGroups = liteAudit
    ? []
    : buildStrategicGroups(hand, state.levelRank);
  let candidates = liteAudit
    ? buildLiteAuditCandidates(hand, state.levelRank)
    : generateBasicCandidates(hand, state.levelRank, previousPlay);
  if (previousPlay && previousPlay.type !== PLAY_TYPES.pass) {
    candidates.push(classifyPlay([], state.levelRank));
  }
  candidates = trimCandidatesForScoring(
    candidates,
    96,
    hand,
    state.levelRank,
    previousPlay,
    { preferredGroups },
  );
  const tableContext = enrichScoringContext({
    state,
    playerIndex: state.currentPlayerIndex,
    lastActivePlayerIndex: state.lastActivePlayerIndex,
    previousPlay,
    levelRank: state.levelRank,
    preferredGroups,
  }, candidates, hand, state.levelRank);
  tableContext._candidates = candidates;
  const hasActionableRegularWinner = doctrineAwareRegular
    ? hasActionableRegularBeater(candidates, hand, state.levelRank, tableContext)
    : liteAudit
    ? candidates.some((candidate) => candidate.type !== PLAY_TYPES.pass
      && !BOMB_TYPES.has(candidate.type)
      && (!previousPlay || previousPlay.type === PLAY_TYPES.pass || canBeat(candidate, previousPlay)))
    : resolveActionableRegularWinner(
      hand,
      state.levelRank,
      previousPlay,
      { ...tableContext, preferredGroups, previousPlay },
    );
  return { hasActionableRegularWinner, previousPlay, tableContext };
}

function auditTurn(state, recommendation, ctx) {
  const player = state.players[state.currentPlayerIndex];
  const hand = player.hand;
  const levelRank = state.levelRank;
  const play = recommendation.candidate;
  const reasons = recommendation.reasons ?? [];
  const issues = [];
  const { hasActionableRegularWinner, previousPlay } = ctx;

  if (previousPlay && previousPlay.type !== PLAY_TYPES.pass) {
    if (play.type !== PLAY_TYPES.pass && !canBeat(play, previousPlay)) {
      issues.push({ code: "illegal-beat", detail: "须压却推荐不能压过的牌" });
    }
  }

  if (play.type !== PLAY_TYPES.pass && play.cards.length !== hand.length) {
    if (breaksBombIntegrity(play, hand, levelRank)) {
      issues.push({ code: "bomb-break", detail: "拆炸出牌" });
    }
    if (reasons.some((r) => /炸弹作废/.test(r))) {
      issues.push({ code: "bomb-void-reason", detail: "理由写炸弹作废仍出牌" });
    }
  }

  const isOpening = !state.lastActivePlay || state.lastActivePlay.type === PLAY_TYPES.pass;
  const leadMode = isOpening
    ? inferLeadMode(state, state.currentPlayerIndex)
    : "must-beat";

  if (usesWildLowValue(play, levelRank) && (isOpening || leadMode === "fresh-open" || leadMode === "catch-wind")) {
    issues.push({ code: "wild-low-value", detail: `逢人配配${play.type}` });
  }

  if (play.type === PLAY_TYPES.straightFlush && state.lastActivePlay) {
    const opp = state.lastActivePlay.type;
    const danger = opponentDangerLevel({
      state,
      playerIndex: state.currentPlayerIndex,
    });
    const urgentEndgame = danger >= 3 || hand.length <= 8;
    if ([PLAY_TYPES.single, PLAY_TYPES.pair].includes(opp) && !urgentEndgame) {
      issues.push({ code: "sf-waste-small", detail: `同花顺压${opp}` });
    }
  }

  if (
    play.type === PLAY_TYPES.pass
    && shouldVetoPassWithRegularBeater(
      { ...ctx.tableContext, hasActionableRegularWinner },
      hand,
      previousPlay,
      levelRank,
    )
    && !reasons.some((r) => /无结构安全同型可压/.test(r))
  ) {
    issues.push({ code: "pass-with-regular-beat", detail: "有普通压牌却过牌" });
  }

  const mustBeat = previousPlay && previousPlay.type !== PLAY_TYPES.pass;
  if (
    mustBeat
    && BOMB_TYPES.has(play.type)
    && hasActionableRegularWinner
    && [PLAY_TYPES.single, PLAY_TYPES.pair, PLAY_TYPES.triple, PLAY_TYPES.tripleWithPair].includes(previousPlay.type)
  ) {
    issues.push({ code: "bomb-vs-routine", detail: "有普通牌可压却动炸" });
  }

  if (
    BOMB_TYPES.has(play.type)
    && playContradictsReasons(play, alignReasonsForPlay(reasons, play, { previousPlay }))
  ) {
    issues.push({ code: "bomb-reason-contradiction", detail: "理由与出炸矛盾" });
  }

  if (
    mustBeat
    && play.type === PLAY_TYPES.pass
    && playContradictsReasons(play, alignReasonsForPlay(reasons, play, { previousPlay }))
  ) {
    issues.push({ code: "pass-reason-contradiction", detail: "过牌与理由矛盾" });
  }

  for (const structIssue of auditRobotStructurePlay({
    play,
    hand,
    levelRank,
    state,
    playerIndex: state.currentPlayerIndex,
    mustBeat: previousPlay,
  })) {
    issues.push(structIssue);
  }

  return issues.map((issue) => ({
    ...issue,
    gameSeed: ctx.seed,
    turnNumber: state.turnNumber,
    playerIndex: state.currentPlayerIndex,
    playLabel: play.label ?? play.type,
    reasons: reasons.slice(0, 4),
    handCount: hand.length,
    mustBeat: mustBeat ? (previousPlay.label ?? `${previousPlay.type}:${previousPlay.mainRank}`) : null,
  }));
}

function runAuditedGame({ seed, levelRank, maxTurns, mlFusionMode, mode = "full", turnBudgetMs = null }) {
  let state = createInitialGameState({ levelRank, random: mulberry32(seed) });
  const violations = [];
  let turns = 0;
  let forcedFallbackCount = 0;
  let actualDeadlineExceededCount = 0;
  const fallbackPathCounts = { constant: 0, fast: 0, normal: 0 };
  const elapsedSamples = [];

  while (!isGameOver(state) && turns < maxTurns) {
    const before = state;
    const hand = before.players[before.currentPlayerIndex].hand;
    const diagnosticAudit = mode === "lite" || mode === "perf";
    const auditCtx = buildAuditContext(before, hand, {
      liteAudit: mode === "lite",
      doctrineAwareRegular: mode === "perf",
    });
    let recommendation;
    try {
      const turnStarted = performance.now();
      const forcedFallback = diagnosticAudit && (turnBudgetMs ?? 0) === 0;
      const deadline = diagnosticAudit
        ? (forcedFallback ? turnStarted - 1 : turnStarted + turnBudgetMs)
        : null;
      ({ state, recommendation } = playRecommendedTurn(before, {
        mlFusionMode,
        mlModel: false,
        deadline,
      }));
      const turnEnded = performance.now();
      elapsedSamples.push(turnEnded - turnStarted);
      if (forcedFallback) forcedFallbackCount += 1;
      else if (deadline != null && turnEnded > deadline) actualDeadlineExceededCount += 1;
      const path = classifyAuditPath({
        forcedFallback,
        reasons: recommendation?.reasons,
      });
      fallbackPathCounts[path] += 1;
    } catch (error) {
      violations.push({
        code: "play-error",
        gameSeed: seed,
        turnNumber: before.turnNumber,
        playerIndex: before.currentPlayerIndex,
        detail: error.message,
      });
      break;
    }

    violations.push(...auditTurn(before, recommendation, {
      seed,
      ...auditCtx,
      tableContext: {
        ...auditCtx.tableContext,
        hasActionableRegularWinner: auditCtx.hasActionableRegularWinner,
      },
    }));

    turns += 1;
  }

  return {
    seed,
    complete: isGameOver(state),
    turns,
    forcedFallbackCount,
    actualDeadlineExceededCount,
    fallbackPathCounts,
    elapsedSamples,
    violations,
  };
}

function summarize(allViolations) {
  const byCode = new Map();
  for (const v of allViolations) {
    byCode.set(v.code, (byCode.get(v.code) ?? 0) + 1);
  }
  return Object.fromEntries([...byCode.entries()].sort((a, b) => b[1] - a[1]));
}

function main() {
  const lockCommand = `node tools/audit-strategy.mjs ${process.argv.slice(2).join(" ")}`.trim();
  acquireAuditLock({ command: lockCommand });

  const { count, seedStart, levelRank, maxTurns, mode, turnBudgetMs } = parseArgs(process.argv);
  mkdirSync(outDir, { recursive: true });

  const results = [];
  let completed = 0;
  let totalTurns = 0;
  const allViolations = [];

  for (let i = 0; i < count; i += 1) {
    const seed = seedStart + i;
    const result = runAuditedGame({
      seed,
      levelRank,
      maxTurns,
      mlFusionMode: "off",
      mode,
      turnBudgetMs,
    });
    results.push(result);
    if (result.complete) completed += 1;
    totalTurns += result.turns;
    allViolations.push(...result.violations);
    if ((i + 1) % 10 === 0 || count < 10) {
      console.error(`[audit] ${i + 1}/${count} 局完成，累计违规 ${allViolations.length}`);
    }
  }

  const autoSamples = [];
  for (let i = 0; mode === "full" && i < Math.min(20, count); i += 1) {
    const seed = seedStart + 10_000 + i;
    try {
      const auto = runAutoGame(createInitialGameState({
        levelRank,
        random: mulberry32(seed),
      }), { maxTurns, mlFusionMode: "off" });
      autoSamples.push({ seed, complete: auto.isComplete, turns: auto.transcript.length });
    } catch (error) {
      autoSamples.push({ seed, complete: false, turns: 0, error: error.message });
      allViolations.push({
        code: "auto-game-error",
        gameSeed: seed,
        detail: error.message,
      });
    }
  }

  const byCode = summarize(allViolations);
  for (const code of ["split-bomb", "beat-partner", "twp-level-kicker"]) {
    if (byCode[code] == null) byCode[code] = 0;
  }
  const forcedFallbackCount = results.reduce(
    (total, result) => total + (result.forcedFallbackCount ?? 0),
    0,
  );
  const actualDeadlineExceededCount = results.reduce(
    (total, result) => total + (result.actualDeadlineExceededCount ?? 0),
    0,
  );
  const fallbackPathCounts = results.reduce((totals, result) => {
    for (const path of ["constant", "fast", "normal"]) {
      totals[path] += result.fallbackPathCounts?.[path] ?? 0;
    }
    return totals;
  }, { constant: 0, fast: 0, normal: 0 });
  const elapsedMs = summarizeElapsedMs(results.flatMap((result) => result.elapsedSamples ?? []));
  const softSfWaste = byCode["sf-waste-small"] ?? 0;
  const hardViolationCount = allViolations.length - softSfWaste
    + Math.max(0, softSfWaste - 2);
  const liteHardViolationCount = ["split-bomb", "beat-partner", "twp-level-kicker"]
    .reduce((total, code) => total + (byCode[code] ?? 0), 0);
  const report = {
    ok: mode === "lite" || mode === "perf"
      ? liteHardViolationCount === 0 && completed === count
      : hardViolationCount === 0 && completed === count,
    mode,
    reportClass: mode === "lite"
      ? "diagnostic"
      : mode === "perf"
        ? "performance-diagnostic"
        : "release-gate",
    turnBudgetMs,
    totalTurns,
    forcedFallbackCount,
    actualDeadlineExceededCount,
    fallbackPathCounts,
    elapsedMs,
    auditedAt: new Date().toISOString(),
    games: count,
    completed,
    incomplete: count - completed,
    completionRate: Number((completed / count).toFixed(4)),
    avgTurns: Math.round(totalTurns / count),
    violationCount: allViolations.length,
    violationsByCode: byCode,
    topReproductions: buildTopReproductions(allViolations),
    samples: allViolations.slice(0, 20),
    autoGameSpotCheck: {
      games: autoSamples.length,
      completed: autoSamples.filter((g) => g.complete).length,
      hitLimit: autoSamples.filter((g) => !g.complete).length,
    },
    levelRank,
    seedStart,
  };

  const outPath = join(
    outDir,
    mode === "lite"
      ? "audit-strategy-lite-latest.json"
      : mode === "perf"
        ? "audit-strategy-perf-latest.json"
        : "audit-strategy-latest.json",
  );
  writeFileSync(outPath, JSON.stringify({ ...report, allViolations }, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main();
