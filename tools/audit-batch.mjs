/**
 * 分批审计并合并结果（避免长批次卡住时丢失进度）
 * 用法：node tools/audit-batch.mjs [总局数] [seed起点] [每批局数]
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const auditScript = join(root, "audit-strategy.mjs");
const outPath = join(root, "..", "training-samples", "audit-strategy-latest.json");

const total = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 100;
const seedStart = Number(process.argv[3]) >= 0 ? Number(process.argv[3]) : 42_000;
const batchSize = Number(process.argv[4]) > 0 ? Number(process.argv[4]) : 5;
const levelRank = process.argv[5] || "2";

const allViolations = [];
let completed = 0;
let totalTurns = 0;

for (let offset = 0; offset < total; offset += batchSize) {
  const count = Math.min(batchSize, total - offset);
  const seed = seedStart + offset;
  process.stderr.write(`[audit-batch] 审计 ${offset + 1}-${offset + count}/${total} seed=${seed}\n`);
  const output = execFileSync(process.execPath, [
    auditScript,
    String(count),
    String(seed),
    levelRank,
    "600",
  ], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

  const report = JSON.parse(output);
  completed += report.completed ?? 0;
  totalTurns += (report.avgTurns ?? 0) * (report.games ?? count);
  const detail = JSON.parse(readFileSync(outPath, "utf8"));
  allViolations.push(...(detail.allViolations ?? []));
}

function summarize(violations) {
  const byCode = new Map();
  for (const v of violations) {
    byCode.set(v.code, (byCode.get(v.code) ?? 0) + 1);
  }
  return Object.fromEntries([...byCode.entries()].sort((a, b) => b[1] - a[1]));
}

const merged = {
  ok: allViolations.length === 0 && completed === total,
  auditedAt: new Date().toISOString(),
  games: total,
  completed,
  incomplete: total - completed,
  completionRate: Number((completed / total).toFixed(4)),
  avgTurns: Math.round(totalTurns / total),
  violationCount: allViolations.length,
  violationsByCode: summarize(allViolations),
  samples: allViolations.slice(0, 20),
  levelRank,
  seedStart,
  batchSize,
  allViolations,
};

writeFileSync(outPath, JSON.stringify(merged, null, 2), "utf8");
console.log(JSON.stringify({
  ok: merged.ok,
  games: merged.games,
  completed: merged.completed,
  violationCount: merged.violationCount,
  violationsByCode: merged.violationsByCode,
}, null, 2));
process.exit(merged.ok ? 0 : 1);
