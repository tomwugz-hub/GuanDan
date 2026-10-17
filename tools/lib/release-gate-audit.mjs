/**
 * 发布门禁与 `audit-strategy.mjs`（full / release-gate）共用的阻断违规集合。
 * `pass-with-regular-beat` 等为诊断项，不计入 exit code。
 * `wild-low-value` / `split-structure-single` 在 decision-core 主路径下与 legacy 审计口径存在已知差异，门禁暂不计入阻断（见 AGENTS.md / PR 说明）。
 */
export const RELEASE_GATE_BLOCKING_CODES = [
  "bomb-break",
  "bomb-void-reason",
  "split-bomb",
  "split-twp-single",
  "bare-triple-with-pair",
];

export const RELEASE_GATE_SF_WASTE_MAX = 2;

export function releaseGateViolationsOk(violationsByCode = {}) {
  for (const code of RELEASE_GATE_BLOCKING_CODES) {
    if ((violationsByCode[code] ?? 0) > 0) return false;
  }
  if ((violationsByCode["sf-waste-small"] ?? 0) > RELEASE_GATE_SF_WASTE_MAX) return false;
  return true;
}

export function assertReleaseGateReport(report, fail = (msg) => {
  throw new Error(`策略审计未达标：${msg}`);
}) {
  if (report.completed !== report.games) {
    fail(`应有 ${report.games} 局全部完成，实际 ${report.completed}`);
  }
  for (const code of RELEASE_GATE_BLOCKING_CODES) {
    if ((report.violationsByCode?.[code] ?? 0) > 0) {
      const labels = {
        "bomb-break": "出现拆炸出牌",
        "bomb-void-reason": "理由写炸弹作废仍出牌",
        "split-bomb": "拆炸出牌（结构审计）",
        "split-twp-single": "接风拆三带二出单",
        "bare-triple-with-pair": "有对可配却裸出三张",
      };
      fail(labels[code] ?? code);
    }
  }
  if ((report.violationsByCode?.["sf-waste-small"] ?? 0) > RELEASE_GATE_SF_WASTE_MAX) {
    fail(`同花顺压小牌过多（${report.violationsByCode["sf-waste-small"]}）`);
  }
}
