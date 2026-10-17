import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { assertReleaseGateReport } from "../tools/lib/release-gate-audit.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const audit = spawnSync(process.execPath, [
  "tools/audit-strategy.mjs",
  "6",
  "88015",
  "2",
  "200",
], {
  cwd: projectRoot,
  stdio: "pipe",
  env: { ...process.env, GUANDAN_ML_BLEND: "0" },
});
assert(audit.status === 0, `audit-strategy 应以 exit 0 结束，status=${audit.status}\n${audit.stderr?.toString()}`);

const report = JSON.parse(
  readFileSync(join(projectRoot, "training-samples", "audit-strategy-latest.json"), "utf8"),
);

assert(report.completed === report.games, `应有 ${report.games} 局全部完成，实际 ${report.completed}`);
assertReleaseGateReport(report);

console.log(`策略审计冒烟通过：${report.games} 局，违规 ${report.violationCount} 处`);
