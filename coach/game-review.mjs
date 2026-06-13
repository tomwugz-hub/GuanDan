import { summarizeGameDivergences } from "./divergence-summary.mjs";
import { buildGameInsightsMarkdownSection } from "./in-play-insight.mjs";
import { buildUserDisputesMarkdownSection } from "./user-dispute.mjs";

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
  const gameId = gameSnapshot?.gameId ?? `game-${Date.now()}`;

  return {
    version: 2,
    kind: "game-review",
    feedbackId: `gr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    purpose: "auto-divergence-review",
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
  };
}

export function buildGameReviewFixMarkdown(payload) {
  const summary = payload.divergenceSummary ?? { divergences: [], divergenceCount: 0, totalHands: 0 };
  const lines = [
    "---",
    "status: pending",
    `feedbackId: ${payload.feedbackId ?? "unknown"}`,
    `kind: game-review`,
    `createdAt: ${new Date().toISOString()}`,
    "---",
    "",
    "# 本局自动对比 · 待改左侧推荐",
    "",
    `**牌局：** ${payload.gameId ?? "—"}，级牌 ${payload.levelRank ?? "—"}`,
    `**你出牌：** ${summary.totalHands} 手，**与推荐1不同：** ${summary.divergenceCount} 手`,
    `**分类：** 你更对 ${summary.userBetterCount ?? 0} · 教练更对 ${summary.coachBetterCount ?? 0} · 教练不合理 ${summary.coachQuestionableCount ?? 0} · 风格差异 ${summary.styleCount ?? 0}`,
    "",
    "请只改 `strategy/`（必要时 `coach/`）里**你认为用户打得更有道理**的差异手；不必强行让用户服从推荐。",
    "改完执行 `node tests/smoke.mjs` 与 `node tools/build-standalone.mjs`，将 `status` 改为 `done`。",
    "",
  ];

  if (payload.question) {
    lines.push(`**用户补充：** ${payload.question}`, "");
  }

  if (summary.divergences.length === 0) {
    lines.push("（本局无差异手，可仅归档。）", "");
  } else {
    lines.push("## 差异明细", "");
    for (const item of summary.divergences) {
      const doctrineLine = item.doctrineCodes?.length
        ? `- **教纲：** ${item.doctrineCodes.join("/")}${item.doctrineReason ? ` — ${item.doctrineReason}` : ""}`
        : null;
      lines.push(
        `### 第 ${item.turnNumber} 手 · ${item.verdictLabel ?? "待观察"}`,
        `- **分类：** ${item.verdictLabel ?? "—"}${item.verdictNote ? `（${item.verdictNote}）` : ""}`,
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
