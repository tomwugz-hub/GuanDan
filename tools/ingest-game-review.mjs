/**
 * 复盘入库 — 读取 coach-questions-latest.json，写入 training-lessons.jsonl。
 * 用法：node tools/ingest-game-review.mjs [--all-new]
 * 每局打完保存复盘后执行；五局训练 batch 结束时再跑 golden 补全。
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, "..");
const latestPath = join(projectRoot, "training-samples", "coach-questions-latest.json");
const lessonsPath = join(projectRoot, "training-samples", "training-lessons.jsonl");
const batchPath = join(projectRoot, "training-samples", "five-game-batch.json");

function loadExistingIds() {
  if (!existsSync(lessonsPath)) return new Set();
  const ids = new Set();
  for (const line of readFileSync(lessonsPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row.feedbackId) ids.add(row.feedbackId);
    } catch { /* skip */ }
  }
  return ids;
}

function pickCoachBetterDivergences(summary) {
  return (summary?.divergences ?? []).filter(
    (d) => d.verdict === "coach-better" || d.verdictLabel === "教练更对",
  );
}

function pickUserBetterDivergences(summary) {
  return (summary?.divergences ?? []).filter(
    (d) => d.verdict === "user-better" || d.verdictLabel === "你更对",
  );
}

function pickStyleDivergences(summary) {
  return (summary?.divergences ?? []).filter(
    (d) => d.verdict === "style-preference" || d.verdictLabel === "风格差异",
  );
}

function goldenIdFor(payload, turnNumber) {
  return `G-${payload.gameId}-seed${payload.currentPosition?.seed}-turn${turnNumber}`;
}

function buildLessonRow(payload) {
  const summary = payload.divergenceSummary ?? {};
  const coachBetter = pickCoachBetterDivergences(summary);
  const userBetter = pickUserBetterDivergences(summary);
  const style = pickStyleDivergences(summary);
  const coachHands = coachBetter.slice(0, 5).map((d) => ({
    turnNumber: d.turnNumber,
    recommended: d.recommended,
    actual: d.actual,
    mustBeat: d.mustBeat ?? null,
    principle: (d.recommendedReasons ?? []).find((r) => /【P\d+】/.test(r)) ?? null,
  }));
  const userHands = userBetter.map((d) => ({
    turnNumber: d.turnNumber,
    mustBeat: d.mustBeat ?? null,
    note: d.verdictNote ?? null,
  }));

  const lessons = [
    ...coachHands.map((h) => ({
      turn: h.turnNumber,
      rule: h.principle
        ? `${h.principle}：推荐「${h.recommended}」而非「${h.actual}」`
        : `第${h.turnNumber}手应跟 Top1「${h.recommended}」`,
      mustBeat: h.mustBeat,
      goldenId: goldenIdFor(payload, h.turnNumber),
      verdict: "coach-better",
    })),
    ...userHands.map((h) => ({
      turn: h.turnNumber,
      rule: h.note ?? `第${h.turnNumber}手用户思路更合理`,
      mustBeat: h.mustBeat,
      goldenId: goldenIdFor(payload, h.turnNumber),
      verdict: "user-better",
      userNote: h.note ?? null,
    })),
  ].sort((a, b) => a.turn - b.turn);

  return {
    ingestedAt: new Date().toISOString(),
    feedbackId: payload.feedbackId,
    gameId: payload.gameId,
    seed: payload.currentPosition?.seed ?? null,
    levelRank: payload.levelRank,
    savedAt: payload.savedAt,
    totalHands: summary.totalHands,
    top1MatchCount: summary.top1MatchCount,
    divergenceCount: summary.divergenceCount,
    coachBetterCount: summary.coachBetterCount,
    userBetterCount: summary.userBetterCount,
    styleCount: summary.styleCount,
    /** 可执行教训（教练更对 + 你更对，均锁黄金场景） */
    lessons,
    /** 风格差异归档，不强制改引擎 */
    styleNotes: style.map((d) => ({
      turn: d.turnNumber,
      recommended: d.recommended,
      actual: d.actual,
    })),
    summary: `共${summary.totalHands}手，${summary.divergenceCount}处分歧；你更对${summary.userBetterCount}、教练更对${summary.coachBetterCount}，须锁入黄金场景：${lessons.map((h) => `turn${h.turn}`).join("、") || "无"}`,
  };
}

function updateBatchManifest(lessonRow) {
  let batch = { target: 5, games: [] };
  if (existsSync(batchPath)) {
    try { batch = JSON.parse(readFileSync(batchPath, "utf8")); } catch { /* reset */ }
  }
  const existing = batch.games.find((g) => g.feedbackId === lessonRow.feedbackId);
  if (!existing) {
    batch.games.push({
      index: batch.games.length + 1,
      feedbackId: lessonRow.feedbackId,
      gameId: lessonRow.gameId,
      seed: lessonRow.seed,
      ingestedAt: lessonRow.ingestedAt,
      divergenceCount: lessonRow.divergenceCount,
      goldenIds: lessonRow.lessons.map((l) => l.goldenId),
    });
  }
  batch.updatedAt = new Date().toISOString();
  batch.remaining = Math.max(0, batch.target - batch.games.length);
  writeFileSync(batchPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
  return batch;
}

function main() {
  if (!existsSync(latestPath)) {
    console.error("未找到 coach-questions-latest.json，请先在界面保存复盘。");
    process.exit(1);
  }
  const payload = JSON.parse(readFileSync(latestPath, "utf8"));
  const existingIds = loadExistingIds();
  if (existingIds.has(payload.feedbackId)) {
    console.log(`已入库，跳过：${payload.feedbackId} (${payload.gameId} seed ${payload.currentPosition?.seed})`);
    const batch = existsSync(batchPath) ? JSON.parse(readFileSync(batchPath, "utf8")) : null;
    if (batch) console.log(`五局进度：${batch.games.length}/${batch.target}`);
    return;
  }
  const row = buildLessonRow(payload);
  appendFileSync(lessonsPath, `${JSON.stringify(row)}\n`, "utf8");
  const batch = updateBatchManifest(row);
  console.log(`✓ 复盘入库：${row.gameId} seed ${row.seed}`);
  console.log(`  ${row.summary}`);
  for (const lesson of row.lessons) {
    console.log(`  · turn${lesson.turn}: ${lesson.rule}`);
    console.log(`    → 黄金场景 ID: ${lesson.goldenId}`);
  }
  console.log(`五局进度：${batch.games.length}/${batch.target}（剩 ${batch.remaining} 局）`);
}

main();
