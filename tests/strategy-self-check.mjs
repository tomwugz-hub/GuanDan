/**
 * 策略自检套件：压单拆顺、接风、lead-mode 等高频回归（纳入 npm test）
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const cases = [
  "beat-single-spare-outside-straight.mjs",
  "beat-single-no-break-straight-j.mjs",
  "lead-mode-partner-catch-wind.mjs",
  "catch-wind-no-empty-sf.mjs",
  "catchwind-15-no-empty-sf.mjs",
  "opening-lead-no-split-sf-consecutive-pairs.mjs",
  "opening-lead-no-break-sf-for-straight.mjs",
  "sf-runway-lead-guard-audit.mjs",
  "must-beat-steel-plate-no-break-sf.mjs",
  "opening-no-break-triple-single.mjs",
  "opening-no-break-consecutive-pairs.mjs",
  "opening-defer-triple-with-pair-to-consecutive-pairs.mjs",
  "opening-never-pass-top1.mjs",
  "robot-catch-wind-no-empty-sf.mjs",
  "robot-catch-wind-no-bomb-lead.mjs",
  "robot-no-wild-triple-beat-small.mjs",
  "robot-no-wild-bomb-over-partner.mjs",
  "robot-no-bj-pair-over-partner.mjs",
  "robot-no-bomb-over-partner-joker-pair.mjs",
  "feed-partner-finish-single.mjs",
  "archived-match7-feedback.mjs",
  "partner-guard-pending-opponent.mjs",
  "partner-lead-no-break-sf-single.mjs",
  "must-beat-no-break-straight-triple.mjs",
  "must-beat-no-break-straight-pair.mjs",
  "must-beat-twp-no-break-sf.mjs",
  "must-beat-twp-no-break-sf-spade-run.mjs",
  "must-beat-twp-no-break-sf-level3-spade-run.mjs",
  "must-beat-twp-no-break-sf-level3-club-screenshot.mjs",
  "must-beat-twp-no-break-sf-level3-diamond-columns.mjs",
  "must-beat-twp-no-break-sf-level3-heart-screenshot.mjs",
  "must-beat-twp-no-break-sf-level3-aaa55-wild.mjs",
  "must-beat-cp-no-break-sf-level3-diamond.mjs",
  "must-beat-cp-prefer-minimal-power.mjs",
  "must-beat-twp-no-break-sf-game-path.mjs",
  "must-beat-single-legal-top1.mjs",
  "beat-bomb-prefer-full-five-bomb.mjs",
  "robot-lead-steel-plate-not-split-triple.mjs",
  "robot-step-deadline-budget.mjs",
  "ui-resilience-smoke.mjs",
  "catch-wind-endgame-single-vs-pair.mjs",
  "reason-consistency-smoke.mjs",
  "advice-phase-upgrade.mjs",
];

for (const file of cases) {
  const result = spawnSync(process.execPath, [join(root, "tests", file)], {
    stdio: "inherit",
    cwd: root,
  });
  if (result.status !== 0) {
    console.error(`strategy-self-check 失败：${file}`);
    process.exit(result.status ?? 1);
  }
}

console.log(`strategy-self-check：${cases.length} 项通过`);
