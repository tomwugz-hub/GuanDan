/** 写入待 Cursor 自动处理的改策略任务（由本地采集服务落盘）。 */

export function buildCoachFixRequestMarkdown({ question, context, feedbackId }) {
  const q = String(question ?? "").trim() || "（未填写）";
  const top = context?.currentAdvice?.choices?.[0];
  const topLabel = top?.play?.label ?? top?.candidate?.label ?? "—";
  const mustBeat = context?.table?.lastActivePlay?.label;

  return [
    "---",
    "status: pending",
    `feedbackId: ${feedbackId ?? "unknown"}`,
    `createdAt: ${new Date().toISOString()}`,
    "---",
    "",
    "# 掼蛋左侧推荐待改",
    "",
    `**用户反馈：** ${q}`,
    "",
    `**当前推荐1：** ${topLabel}`,
    mustBeat ? `**须压：** ${mustBeat}` : "**局面：** 有牌权",
    `**级牌 / 回合：** ${context?.levelRank ?? "—"} / ${context?.turnNumber ?? "—"}`,
    "",
    "请修改 `strategy/`（必要时 `coach/`），使左侧推荐符合用户意图；完成后执行 `node tests/smoke.mjs` 与 `node tools/build-standalone.mjs`，并将本文件 frontmatter 的 `status` 改为 `done`。",
    "",
    "## 局面 JSON",
    "",
    "```json",
    JSON.stringify(context, null, 2),
    "```",
    "",
  ].join("\n");
}
