import { summarizeGameDivergences, verdictUiLabel } from "./divergence-summary.mjs";
import { buildGameInsightsMarkdownSection } from "./in-play-insight.mjs";
import { buildUserDisputesMarkdownSection } from "./user-dispute.mjs";
import { buildVariationTrainingMarkdown, buildVariationTrainingSet } from "./variation-training.mjs";

export function buildGameReviewPayload({
  gameSnapshot,
  coachAdviceTimeline,
  humanPlayerIndex = 0,
  matchLevels = null,
  matchGameNumber = null,
  userNote = "",
  userDisputes = [],
  gameInsights = [],
}) {
  const summary = summarizeGameDivergences(coachAdviceTimeline, humanPlayerIndex);
  const variationTraining = buildVariationTrainingSet(coachAdviceTimeline, { humanPlayerIndex });
  const gameId = gameSnapshot?.gameId ?? `game-${Date.now()}`;

  return {
    version: 2,
    kind: "game-review",
    feedbackId: `gr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    purpose: "auto-divergence-archive",
    tag: "game-review",
    question: userNote.trim() || `本局自动对比：${summary.divergenceCount} 处与推荐1不一致`,
    gameId,
    levelRank: gameSnapshot?.levelRank ?? null,
    matchLevels,
    matchGameNumber,
    divergenceSummary: summary,
    coachAdviceTimeline,
    currentPosition: gameSnapshot,
    userDisputes: userDisputes ?? [],
    gameInsights: gameInsights ?? [],
    variationTraining,
  };
}

export function buildGameReviewFixMarkdown(payload) {
  const summary = payload.divergenceSummary ?? { divergences: [], divergenceCount: 0, totalHands: 0 };
  const lines = [
    "---",
    "status: archived",
    `feedbackId: ${payload.feedbackId ?? "unknown"}`,
    `kind: game-review`,
    `createdAt: ${new Date().toISOString()}`,
    "---",
    "",
    "# 本局复盘归档",
    "",
    `**牌局：** ${payload.gameId ?? "—"}，级牌 ${payload.levelRank ?? "—"}`,
    `**你出牌：** ${summary.totalHands} 手，**与推荐1不同：** ${summary.divergenceCount} 手`,
    `**分类：** 与教练不一致 ${summary.userBetterCount ?? 0} · 建议学习点 ${summary.coachBetterCount ?? 0} · 教练存疑 ${summary.coachQuestionableCount ?? 0} · 风格差异 ${summary.styleCount ?? 0}`,
    "",
    "本文件仅供复盘归档与数据集 ingest；**不会**因用户意见自动改 `strategy/`。",
    "仅教纲 blockTop1 等开发者审查项（status: pending）才进入改码流程。",
    "",
  ];

  if (payload.question) {
    lines.push(`**用户补充：** ${payload.question}`, "");
  }

  if (summary.divergences.length === 0) {
    lines.push("（本局无差异手。）", "");
  } else {
    lines.push("## 差异明细", "");
    for (const item of summary.divergences) {
      const uiLabel = verdictUiLabel(item.verdict);
      const doctrineLine = item.doctrineCodes?.length
        ? `- **教纲：** ${item.doctrineCodes.join("/")}${item.doctrineReason ? ` — ${item.doctrineReason}` : ""}`
        : null;
      lines.push(
        `### 第 ${item.turnNumber} 手 · ${uiLabel}`,
        `- **分类：** ${uiLabel}${item.verdictNote ? `（${item.verdictNote}）` : ""}`,
        `- **裁决：** ${item.adjudication ?? "—"}`,
        ...(doctrineLine ? [doctrineLine] : []),
        ...(item.coachQuestionable ? ["- **教练存疑：** 是"] : []),
        `- **推荐1：** ${item.recommended}${item.recommendedReasons?.length ? `（${item.recommendedReasons.join("；")}）` : ""}`,
        `- **你实际出：** ${item.actual}`,
        `- **匹配：** ${item.match}${item.mustBeat ? `，须压 ${item.mustBeat}` : ""}`,
        "",
      );
    }
  }

  const insights = payload.gameInsights ?? [];
  if (insights.length > 0) {
    lines.push(...buildGameInsightsMarkdownSection(insights), "");
  }

  lines.push(...buildVariationTrainingMarkdown(payload.variationTraining), "");

  const disputes = payload.userDisputes ?? [];
  if (disputes.length > 0) {
    lines.push(...buildUserDisputesMarkdownSection(disputes), "");
  }

  lines.push(
    "## 完整时间线",
    "",
    "已写入 `training-samples/coach-questions-latest.json`（勿在此重复嵌入巨型 JSON，避免保存复盘卡死页面）。",
    "",
  );

  return lines.join("\n");
}
