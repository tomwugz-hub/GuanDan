import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAuditMode } from "../tools/lib/audit-lite-mode.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const parsed = parseAuditMode([
  "node", "tools/audit-strategy.mjs", "1", "99000", "2", "200", "--lite",
]);
assert(parsed.mode === "lite", "--lite 必须解析为 lite mode");
assert(parsed.turnBudgetMs === 0, "lite 默认单手预算必须为 0ms 并立即走硬门禁 fallback");

const reportPath = join(root, "training-samples", "audit-strategy-lite-latest.json");
const previousReport = existsSync(reportPath) ? readFileSync(reportPath, "utf8") : null;
let report;
try {
  execFileSync(process.execPath, [
    join(root, "tools", "audit-strategy.mjs"),
    "1", "99000", "2", "200", "--lite",
  ], {
    cwd: root,
    stdio: "pipe",
    timeout: 120_000,
  });
  report = JSON.parse(readFileSync(reportPath, "utf8"));
} finally {
  if (previousReport === null) rmSync(reportPath, { force: true });
  else writeFileSync(reportPath, previousReport, "utf8");
}
assert(report.mode === "lite", "轻量报告必须标 mode=lite");
assert(report.reportClass === "diagnostic", "轻量报告必须标为 diagnostic，不能冒充发布门禁");
assert(report.games === 1 && report.completed === 1, "一局轻量审计必须完整结束");
assert(Number.isInteger(report.totalTurns) && report.totalTurns > 0, "lite 必须报告总手数");
assert(report.forcedFallbackCount === report.totalTurns, "0ms lite 的 forcedFallbackCount 必须等于总手数");
assert(report.actualDeadlineExceededCount === 0, "强制过期不得计入真实越界");
assert(report.fallbackPathCounts?.constant === report.totalTurns, "0ms lite 必须全部走 constant path");
assert((report.fallbackPathCounts?.fast ?? 0) === 0, "0ms lite 不应标成 fast path");
assert((report.fallbackPathCounts?.normal ?? 0) === 0, "0ms lite 不应标成 normal path");
assert(!Object.prototype.hasOwnProperty.call(report, "timeoutFallbackCount"), "不得继续使用混淆语义的 timeoutFallbackCount");
assert(["p50", "p95", "p99", "max"].every((key) => Number.isFinite(report.elapsedMs?.[key])), "必须报告 elapsedMs 分位数");
assert(Array.isArray(report.topReproductions), "必须报告 Top 复现");
for (const code of ["split-bomb", "beat-partner", "twp-level-kicker"]) {
  assert((report.violationsByCode?.[code] ?? 0) === 0, `${code} 必须为 0`);
}

console.log("PASS: audit strategy lite report contract");
