/** 用户对「教练更对」等裁决的申诉与重审候选判定 */

import { DIVERGENCE_VERDICTS } from "./divergence-summary.mjs";

/** 申诉理由中出现这些词时，视为结构/教纲相关，可升级为重审 */
export const DOCTRINE_DISPUTE_KEYWORDS = [
  "拆顺子",
  "拆炸",
  "拆炸弹",
  "拆同花顺",
  "保结构",
  "保顺子",
  "保炸",
  "不应拆",
  "不该拆",
  "结构",
  "教纲",
  "P1",
  "P4",
  "P5",
  "P6",
  "P9",
  "空炸",
  "过牌",
  "接风",
  "队友",
  "散牌",
  "逢人配",
];

/** 可提交申诉的裁决类型 */
export function isDisputeableVerdict(verdict) {
  return verdict === DIVERGENCE_VERDICTS.COACH_BETTER
    || verdict === DIVERGENCE_VERDICTS.COACH_QUESTIONABLE
    || verdict === DIVERGENCE_VERDICTS.STYLE;
}

export function normalizeUserDispute({
  turnNumber,
  originalAdjudication,
  userRationale,
  verdict = null,
  verdictLabel = null,
  gameId = null,
  createdAt = new Date().toISOString(),
}) {
  const rationale = String(userRationale ?? "").trim();
  if (!turnNumber || !rationale) return null;
  return {
    turnNumber: Number(turnNumber),
    originalAdjudication: originalAdjudication ?? verdictLabel ?? verdict ?? "unknown",
    verdict: verdict ?? null,
    verdictLabel: verdictLabel ?? null,
    userRationale: rationale,
    gameId: gameId ?? null,
    createdAt,
    upgradeCandidate: isDisputeUpgradeCandidate({ userRationale: rationale, originalAdjudication }),
  };
}

/** 用户理由是否足以触发对「教练更对」的重审 */
export function isDisputeUpgradeCandidate(dispute) {
  const rationale = String(dispute?.userRationale ?? "").trim();
  if (!rationale) return false;
  const adjudication = String(dispute?.originalAdjudication ?? dispute?.verdictLabel ?? "");
  const isCoachBetter = adjudication.includes("教练更对")
    || dispute?.verdict === DIVERGENCE_VERDICTS.COACH_BETTER;
  if (!isCoachBetter) return false;
  const lower = rationale.toLowerCase();
  return DOCTRINE_DISPUTE_KEYWORDS.some((kw) => {
    const k = kw.toLowerCase();
    return lower.includes(k) || rationale.includes(kw);
  });
}

export function buildUserDisputesMarkdownSection(userDisputes = []) {
  if (!userDisputes.length) return [];
  const lines = [
    "## 用户申诉",
    "",
    "用户对「教练更对」等自动裁决提出异议；处理器应结合理由重审，结构/教纲相关可升级为「你更对」并改 strategy/。",
    "",
  ];
  for (const item of userDisputes) {
    const upgrade = item.upgradeCandidate ?? isDisputeUpgradeCandidate(item);
    lines.push(
      `### 第 ${item.turnNumber} 手 · 申诉`,
      `- **原裁决：** ${item.originalAdjudication ?? item.verdictLabel ?? "—"}`,
      `- **用户理由：** ${item.userRationale}`,
      `- **重审候选：** ${upgrade ? "是（结构/教纲相关）" : "否（记录积累）"}`,
      `- **提交时间：** ${item.createdAt ?? "—"}`,
      "",
    );
  }
  return lines;
}

/** 从 COACH-FIX-REQUEST 正文解析用户申诉 */
export function parseUserDisputesFromMarkdown(markdown) {
  const section = markdown.split("## 用户申诉")[1]?.split(/^## /m)[0] ?? "";
  if (!section.trim()) return [];
  const blocks = section.split(/^### /m).slice(1);
  return blocks.map((block) => {
    const header = block.split(/\r?\n/)[0] ?? "";
    const turnMatch = header.match(/第\s*(\d+)\s*手/);
    const originalMatch = block.match(/\*\*原裁决：\*\*\s*(.+)/);
    const rationaleMatch = block.match(/\*\*用户理由：\*\*\s*(.+)/);
    const upgradeMatch = block.match(/\*\*重审候选：\*\*\s*(.+)/);
    const createdMatch = block.match(/\*\*提交时间：\*\*\s*(.+)/);
    const dispute = {
      turnNumber: turnMatch ? Number(turnMatch[1]) : null,
      originalAdjudication: originalMatch?.[1]?.trim() ?? "",
      userRationale: rationaleMatch?.[1]?.trim() ?? "",
      createdAt: createdMatch?.[1]?.trim() ?? null,
      upgradeCandidate: /是/.test(upgradeMatch?.[1] ?? ""),
    };
    dispute.upgradeCandidate = dispute.upgradeCandidate || isDisputeUpgradeCandidate(dispute);
    return dispute;
  }).filter((item) => item.turnNumber != null && item.userRationale);
}
