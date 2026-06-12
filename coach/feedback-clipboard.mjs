import { RULE_ENGINE_VERSION } from "./local-qa.mjs";

/** 是否为旧版 brief / 本机泛答（无 v2 引擎标识） */
export function isLegacyBriefAnswer(item) {
  const answer = String(item?.answer ?? "");
  if (item?.answerSource === "brief") return true;
  if (/规则教练\s*·\s*本机答复|兜底答复/.test(answer)) return true;
  if (
    answer
    && !answer.includes(`规则引擎 ${RULE_ENGINE_VERSION}`)
    && !answer.includes("【规则引擎作答】")
  ) {
    return true;
  }
  return false;
}

function formatChatTimestamp(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

function answerTag(item) {
  if (isLegacyBriefAnswer(item)) return "旧 brief";
  if (item?.answerSource) return item.answerSource;
  if (String(item?.answer ?? "").includes(`规则引擎 ${RULE_ENGINE_VERSION}`)) return RULE_ENGINE_VERSION;
  return "v2";
}

/**
 * 构建「复制发给 Cursor」文本：按时间排序，标注 createdAt 与是否旧 brief，默认只含 v2 专答。
 */
export function buildCoachFeedbackClipboardText(record, aiChatTimeline = [], gameMeta = null) {
  const ctx = record?.context ?? {};
  const table = ctx.table ?? {};
  const lines = [
    "【问教练反馈】",
    `局ID：${gameMeta?.gameId ?? ctx.gameId ?? "—"}`,
  ];
  if (ctx.levelRank) lines.push(`级牌：${ctx.levelRank}`);
  if (ctx.turnNumber != null) lines.push(`第 ${ctx.turnNumber} 手`);
  if (table.lastActivePlay?.label) lines.push(`需压：${table.lastActivePlay.label}`);
  const top = ctx.currentAdvice?.choices?.[0];
  if (top?.play?.label) lines.push(`左侧推荐1：${top.play.label}`);

  const fabItems = aiChatTimeline
    .filter((item) => item.source === "fab-coach")
    .slice()
    .sort((a, b) => new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0));

  const v2Items = fabItems.filter((item) => !isLegacyBriefAnswer(item));
  const legacyCount = fabItems.length - v2Items.length;
  const itemsToCopy = v2Items.length > 0 ? v2Items : fabItems;

  if (fabItems.length > 0) {
    lines.push("", "【本局问教练完整对话（按时间）】");
    if (legacyCount > 0 && v2Items.length > 0) {
      lines.push(`（已省略 ${legacyCount} 条旧版 brief 泛答，仅复制 v2 专答）`);
    }
    for (const item of itemsToCopy) {
      const ts = formatChatTimestamp(item.createdAt);
      const tag = answerTag(item);
      lines.push(`[${ts}] [${tag}] 问：${item.question}`);
      lines.push(`答：${item.answer ?? item.error ?? "—"}`);
      lines.push("");
    }
  } else {
    lines.push(`问题：${record?.question ?? "—"}`);
    lines.push(`回答：${record?.answer ?? record?.error ?? "—"}`);
  }

  lines.push("教练答非所问，请帮我改进这条回答。");
  return lines.join("\n");
}
