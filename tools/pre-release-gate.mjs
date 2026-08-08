/**
 * 发布门禁 — build 前强制跑通；任一失败则 exit 1，禁止带着失忆/降智上线。
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, "..");
const node = process.execPath;

function run(label, script, args = [], extraEnv = {}) {
  process.stderr.write(`[gate] ${label}…\n`);
  execFileSync(node, [join(projectRoot, script), ...args], {
    cwd: projectRoot,
    stdio: "inherit",
    env: { ...process.env, GUANDAN_ML_BLEND: "0", ...extraEnv },
  });
}

function assertAuditReport() {
  const reportPath = join(projectRoot, "training-samples", "audit-strategy-latest.json");
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const fail = (msg) => {
    throw new Error(`策略审计未达标：${msg}`);
  };
  if (report.completed !== report.games) {
    fail(`应有 ${report.games} 局全部完成，实际 ${report.completed}`);
  }
  if ((report.violationsByCode["bomb-break"] ?? 0) > 0) fail("出现拆炸出牌");
  if ((report.violationsByCode["bomb-void-reason"] ?? 0) > 0) fail("理由写炸弹作废仍出牌");
  if ((report.violationsByCode["wild-low-value"] ?? 0) > 0) fail("逢人配低价值开局/接风");
  if ((report.violationsByCode["split-twp-single"] ?? 0) > 0) fail("接风拆三带二出单");
  if ((report.violationsByCode["bare-triple-with-pair"] ?? 0) > 0) fail("有对可配却裸出三张");
  if ((report.violationsByCode["split-structure-single"] ?? 0) > 0) fail("接风/领出拆结构出单");
  if ((report.violationsByCode["split-bomb"] ?? 0) > 0) fail("拆炸出牌（结构审计）");
  if ((report.violationsByCode["sf-waste-small"] ?? 0) > 2) {
    fail(`同花顺压小牌过多（${report.violationsByCode["sf-waste-small"]}）`);
  }
  process.stderr.write(
    `[gate] 策略审计通过：${report.games} 局，违规 ${report.violationCount} 处\n`,
  );
}

const started = Date.now();
try {
  run("黄金场景（用户训练锁定）", "tests/golden-scenarios.mjs");
  run("黄金场景（五局训练批次）", "tests/golden-game902251982.mjs");
  run("黄金场景（五局训练第2局）", "tests/golden-game903668154.mjs");
  run("黄金场景（五局训练第3局）", "tests/golden-game903856238.mjs");
  run("黄金场景（五局训练第4局）", "tests/golden-game906181414.mjs");
  run("黄金场景（五局训练第5局）", "tests/golden-game906973593.mjs");
  run("黄金场景（新一轮第1局）", "tests/golden-game918214635.mjs");
  run("黄金场景（新一轮第2局）", "tests/golden-game919388849.mjs");
  run("黄金场景（新一轮第3局）", "tests/golden-game919859640.mjs");
  run("黄金场景（新一轮第4局）", "tests/golden-game924955971.mjs");
  run("黄金场景（新一轮第5局）", "tests/golden-game926069208.mjs");
  run("开局 lite 不宜空炸", "tests/opening-lite-sf-fix.mjs");
  run("人类建议不拆同花顺", "tests/human-advice-sf-fallback.mjs");
  run("建议三阶段一致性", "tests/advice-phase-upgrade.mjs");
  run("trim 性能预算", "tests/trim-deadline-budget.mjs");
  run("中局须压单A宜小王", "tests/midgame-joker-beat-single-a.mjs");
  run("教纲核心回归", "tests/doctrine-gate.mjs");
  run("理由与行动一致性", "tests/reason-consistency-smoke.mjs");
  run("策略自检（压单/接风/lead-mode）", "tests/strategy-self-check.mjs");
  run("推荐双轨对齐", "tests/recommend-alignment.mjs");
  run("候选生成冒烟", "tests/import-smoke.mjs");
  run("百例场景候选校验", "tools/validate-100cases-scenarios.mjs");
  run("策略审计 6 局", "tools/audit-strategy.mjs", ["6", "42100", "2", "200"]);
  assertAuditReport();
} catch (error) {
  process.stderr.write(`\n[gate] 发布门禁失败 — 禁止构建 standalone。请修复后再 npm run build。\n`);
  if (error?.status) process.exit(error.status);
  throw error;
}

const elapsed = Math.round((Date.now() - started) / 1000);
process.stderr.write(`[gate] 全部通过（${elapsed}s）— 允许构建\n`);
