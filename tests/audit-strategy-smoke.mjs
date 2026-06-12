import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

execSync("node tools/audit-strategy.mjs 24 88000 2 600", {
  cwd: join(root, ".."),
  stdio: "pipe",
});
const report = JSON.parse(readFileSync(join(root, "..", "training-samples", "audit-strategy-latest.json"), "utf8"));

assert(report.completed === report.games, `应有 ${report.games} 局全部完成，实际 ${report.completed}`);
assert((report.violationsByCode["bomb-break"] ?? 0) === 0, "不得出现拆炸出牌");
assert((report.violationsByCode["bomb-void-reason"] ?? 0) === 0, "不得理由写炸弹作废仍出牌");
assert((report.violationsByCode["wild-low-value"] ?? 0) === 0, "不得逢人配低价值开局/接风");
assert((report.violationsByCode["sf-waste-small"] ?? 0) <= 2,
  `同花顺压小牌应极少，实际 ${report.violationsByCode["sf-waste-small"] ?? 0}`);

console.log(`策略审计冒烟通过：${report.games} 局，违规 ${report.violationCount} 处`);
