/**
 * 批量自博弈 + 策略违规审计（拆炸、逢人配、同花顺浪费、局未完成等）
 * 用法：node tools/audit-strategy.mjs [局数] [seed起点] [级牌]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isWildCard, SUITS } from "../engine/card.mjs";
import { canBeat } from "../engine/compare-play.mjs";
import { createInitialGameState, isGameOver } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { runAutoGame } from "../coach/auto-game.mjs";
import { playRecommendedTurn } from "../coach/robot-player.mjs";
import { hasActionableRegularBeater, trimCandidatesForScoring } from "../strategy/recommend.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { buildStrategicGroups } from "../strategy/strategic-groups.mjs";
import { breaksBombIntegrity } from "../strategy/scorers/structure.mjs";
import { inferLeadMode } from "../strategy/lead-mode.mjs";
import { enrichScoringContext, opponentDangerLevel } from "../strategy/table-context.mjs";
import { shouldVetoPassWithRegularBeater } from "../strategy/principles.mjs";

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
  };
}

function usesWildLowValue(candidate, levelRank) {
  if (!candidate?.cards?.length || !LOW_WILD_TYPES.has(candidate.type)) return false;
  return candidate.cards.some((card) => isWildCard(card, levelRank));
}

function buildAuditContext(state, hand) {
  const previousPlay = state.lastActivePlay;
  const preferredGroups = buildStrategicGroups(hand, state.levelRank);
  let candidates = generateBasicCandidates(hand, state.levelRank, previousPlay);
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
  const hasActionableRegularWinner = hasActionableRegularBeater(
    candidates,
    hand,
    state.levelRank,
    tableContext,
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
    && reasons.some((r) => /不必动炸|不宜动炸|已有普通牌能压住/.test(r))
    && !reasons.some((r) => /满张炸弹控牌权|压顺子需炸弹|只有炸弹能压，应抢牌权|应满张出炸控权/.test(r))
  ) {
    issues.push({ code: "bomb-reason-contradiction", detail: "理由说不必动炸仍出炸" });
  }

  if (
    mustBeat
    && play.type === PLAY_TYPES.pass
    && shouldVetoPassWithRegularBeater(ctx.tableContext, hand, previousPlay, levelRank)
    && reasons.some((r) => /不应.*过牌|不能轻易放行|不宜过牌/.test(r))
  ) {
    issues.push({ code: "pass-reason-contradiction", detail: "过牌与理由矛盾" });
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

function runAuditedGame({ seed, levelRank, maxTurns, mlFusionMode }) {
  let state = createInitialGameState({ levelRank, random: mulberry32(seed) });
  const violations = [];
  let turns = 0;

  while (!isGameOver(state) && turns < maxTurns) {
    const before = state;
    const hand = before.players[before.currentPlayerIndex].hand;
    const auditCtx = buildAuditContext(before, hand);
    let recommendation;
    try {
      ({ state, recommendation } = playRecommendedTurn(before, { mlFusionMode, mlModel: false }));
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
  const { count, seedStart, levelRank, maxTurns } = parseArgs(process.argv);
  mkdirSync(outDir, { recursive: true });

  const results = [];
  let completed = 0;
  let totalTurns = 0;
  const allViolations = [];

  for (let i = 0; i < count; i += 1) {
    const seed = seedStart + i;
    const result = runAuditedGame({ seed, levelRank, maxTurns, mlFusionMode: "off" });
    results.push(result);
    if (result.complete) completed += 1;
    totalTurns += result.turns;
    allViolations.push(...result.violations);
    if ((i + 1) % 10 === 0) {
      console.error(`[audit] ${i + 1}/${count} 局完成，累计违规 ${allViolations.length}`);
    }
  }

  const autoSamples = [];
  for (let i = 0; i < Math.min(20, count); i += 1) {
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
  const softSfWaste = byCode["sf-waste-small"] ?? 0;
  const hardViolationCount = allViolations.length - softSfWaste
    + Math.max(0, softSfWaste - 2);
  const report = {
    ok: hardViolationCount === 0 && completed === count,
    auditedAt: new Date().toISOString(),
    games: count,
    completed,
    incomplete: count - completed,
    completionRate: Number((completed / count).toFixed(4)),
    avgTurns: Math.round(totalTurns / count),
    violationCount: allViolations.length,
    violationsByCode: byCode,
    samples: allViolations.slice(0, 20),
    autoGameSpotCheck: {
      games: autoSamples.length,
      completed: autoSamples.filter((g) => g.complete).length,
      hitLimit: autoSamples.filter((g) => !g.complete).length,
    },
    levelRank,
    seedStart,
  };

  const outPath = join(outDir, "audit-strategy-latest.json");
  writeFileSync(outPath, JSON.stringify({ ...report, allViolations }, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main();
