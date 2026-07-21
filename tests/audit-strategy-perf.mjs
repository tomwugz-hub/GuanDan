import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseAuditMode,
  classifyAuditPath,
  summarizeElapsedMs,
} from "../tools/lib/audit-lite-mode.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const parsed = parseAuditMode([
  "node", "tools/audit-strategy.mjs", "1", "99001", "2", "200", "--perf",
]);
assert(parsed.mode === "perf", "--perf 必须解析为 perf mode");
assert(parsed.turnBudgetMs === 400, "perf 默认预算必须为 400ms");
const explicit = parseAuditMode(["node", "audit", "--perf", "--turn-budget-ms=250"]);
assert(explicit.mode === "perf" && explicit.turnBudgetMs === 250, "perf 必须接受显式预算");
assert(classifyAuditPath({ forcedFallback: true }) === "constant", "强制过期必须分类为 constant");
assert(classifyAuditPath({ reasons: ["兜底：队友占牌，过牌让权"] }) === "fast", "机器人兜底理由必须分类为 fast");
assert(classifyAuditPath({ reasons: ["机器人快路径：最小常规压牌"] }) === "normal", "正常推荐不得误标为 fallback");
const percentileFixture = summarizeElapsedMs([1, 2, 3, 4, 100]);
assert(percentileFixture.p50 === 3 && percentileFixture.p95 === 100 && percentileFixture.max === 100, "elapsed nearest-rank 统计必须稳定");
let rejectedMixedModes = false;
try {
  parseAuditMode(["node", "audit", "--lite", "--perf"]);
} catch {
  rejectedMixedModes = true;
}
assert(rejectedMixedModes, "--lite 与 --perf 必须互斥");

const reportPath = join(root, "training-samples", "audit-strategy-perf-latest.json");
const previousReport = existsSync(reportPath) ? readFileSync(reportPath, "utf8") : null;
let report;
try {
  execFileSync(process.execPath, [
    join(root, "tools", "audit-strategy.mjs"),
    "1", "99001", "2", "200", "--perf", "--turn-budget-ms=400",
  ], {
    cwd: root,
    stdio: "pipe",
    timeout: 180_000,
  });
  report = JSON.parse(readFileSync(reportPath, "utf8"));
} finally {
  if (previousReport === null) rmSync(reportPath, { force: true });
  else writeFileSync(reportPath, previousReport, "utf8");
}

assert(report.mode === "perf", "性能报告必须标记 mode=perf");
assert(report.reportClass === "performance-diagnostic", "perf 不得标成 release-gate");
assert(report.turnBudgetMs === 400, "性能报告必须记录 400ms 预算");
assert(report.games === 1 && report.completed === 1, "性能审计必须完整结束");
assert(report.forcedFallbackCount === 0, "perf 不得计为强制 fallback");
assert(Number.isInteger(report.actualDeadlineExceededCount), "perf 必须报告真实 deadline 越界次数");
const pathTotal = Object.values(report.fallbackPathCounts ?? {}).reduce((sum, value) => sum + value, 0);
assert(pathTotal === report.totalTurns, "fallbackPathCounts 合计必须等于总手数");
const elapsed = report.elapsedMs;
assert(elapsed.p50 <= elapsed.p95 && elapsed.p95 <= elapsed.p99 && elapsed.p99 <= elapsed.max, "elapsedMs 分位数必须单调");
assert(!Object.prototype.hasOwnProperty.call(report, "timeoutFallbackCount"), "perf 不得使用 timeoutFallbackCount");

const gateSource = readFileSync(join(root, "tools", "pre-release-gate.mjs"), "utf8");
assert(gateSource.includes('"audit-strategy-latest.json"'), "发布门禁必须继续读取完整报告");
assert(!gateSource.includes("audit-strategy-perf-latest.json"), "发布门禁不得读取 perf 报告");
assert(!gateSource.includes("audit-strategy-lite-latest.json"), "发布门禁不得读取 lite 报告");

console.log("PASS: audit strategy perf report contract");
