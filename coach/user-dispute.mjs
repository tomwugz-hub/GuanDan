/** 用户对「教练更对」等裁决的申诉与重审候选判定 */

import { compareRanks } from "../engine/rank-order.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { DIVERGENCE_VERDICTS } from "./divergence-summary.mjs";
import { isProbeSingleRank, solePairForTripleRank } from "../strategy/principles.mjs";

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

/** 申诉理由中出现这些词时，视为回牌/牌力/节奏相关，可升级为重审 */
export const TEMPO_RECOVERY_DISPUTE_KEYWORDS = [
  "回牌",
  "拿不回",
  "收不回",
  "夺不回",
  "牌力",
  "太小",
  "太弱",
  "试探",
  "送牌",
  "丢权",
  "接不住",
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

function rationaleMatchesKeywords(rationale, keywords) {
  const lower = rationale.toLowerCase();
  return keywords.some((kw) => {
    const k = kw.toLowerCase();
    return lower.includes(k) || rationale.includes(kw);
  });
}

/** 用户理由是否涉及回牌/牌力/节奏 */
export function isTempoRecoveryDisputeRationale(rationale) {
  const text = String(rationale ?? "").trim();
  if (!text) return false;
  return rationaleMatchesKeywords(text, TEMPO_RECOVERY_DISPUTE_KEYWORDS);
}

/** 用户理由是否足以触发对「教练更对」的重审 */
export function isDisputeUpgradeCandidate(dispute) {
  const rationale = String(dispute?.userRationale ?? "").trim();
  if (!rationale) return false;
  const adjudication = String(dispute?.originalAdjudication ?? dispute?.verdictLabel ?? "");
  const isCoachBetter = adjudication.includes("教练更对")
    || dispute?.verdict === DIVERGENCE_VERDICTS.COACH_BETTER;
  if (!isCoachBetter) return false;
  return rationaleMatchesKeywords(rationale, DOCTRINE_DISPUTE_KEYWORDS)
    || isTempoRecoveryDisputeRationale(rationale);
}

function inferPlayTypeFromLabel(label) {
  const text = String(label ?? "").trim();
  if (!text || text === "过牌") return null;
  if (/三带二/.test(text)) return PLAY_TYPES.tripleWithPair;
  if (/对子|^对/.test(text)) return PLAY_TYPES.pair;
  if (/单张|散单/.test(text)) return PLAY_TYPES.single;
  if (/顺子/.test(text) && !/同花顺/.test(text)) return PLAY_TYPES.straight;
  if (/钢板|飞机/.test(text)) return PLAY_TYPES.plane;
  if (/连对/.test(text)) return PLAY_TYPES.consecutivePairs;
  if (/炸弹|同花顺/.test(text)) return PLAY_TYPES.bomb;
  return null;
}

function inferMainRankFromLabel(label, playType) {
  const text = String(label ?? "");
  if (playType === PLAY_TYPES.tripleWithPair) {
    const tripleMatch = text.match(/([3-9JQKA2]|10)\s+[^\s]+\s+([3-9JQKA2]|10)/);
    return tripleMatch?.[1] ?? null;
  }
  if (playType === PLAY_TYPES.pair) {
    const pairMatch = text.match(/([3-9JQKA2]|10)\s/);
    return pairMatch?.[1] ?? null;
  }
  if (playType === PLAY_TYPES.single) {
    const singleMatch = text.match(/(大王|小王|([3-9JQKA2]|10))/);
    if (singleMatch?.[1] === "大王") return "BJ";
    if (singleMatch?.[1] === "小王") return "SJ";
    return singleMatch?.[2] ?? null;
  }
  return null;
}

function handHasBigJokerRecovery(hand = []) {
  return hand.some((card) => card.rank === "BJ");
}

function isSmallProbePlay(play, levelRank = "2") {
  if (!play?.type || !play?.mainRank) return false;
  if (play.type === PLAY_TYPES.pair || play.type === PLAY_TYPES.single) {
    return isProbeSingleRank(play.mainRank, levelRank);
  }
  return false;
}

/**
 * 结合用户申诉理由与差异手上下文，判断是否应推翻原「教练更对」裁决。
 * @returns {{ upgrade: boolean, verdict?: string, note?: string, coachQuestionable?: boolean } | null}
 */
export function reAdjudicateDispute(dispute, context = {}) {
  if (!isDisputeUpgradeCandidate(dispute)) return null;

  const {
    recommended = "",
    actual = "",
    recPlay = null,
    actPlay = null,
    record = null,
    handBefore = null,
    levelRank = "2",
  } = context;

  const hand = handBefore ?? record?.handBefore ?? [];
  const recovery = handHasBigJokerRecovery(hand);
  const recType = recPlay?.type ?? inferPlayTypeFromLabel(recommended);
  const actType = actPlay?.type ?? inferPlayTypeFromLabel(actual);
  const recRank = recPlay?.mainRank ?? inferMainRankFromLabel(recommended, recType);
  const actRank = actPlay?.mainRank ?? inferMainRankFromLabel(actual, actType);

  const tempoRecovery = isTempoRecoveryDisputeRationale(dispute.userRationale);
  const smallProbeRec = isSmallProbePlay(
    recPlay ?? (recType && recRank ? { type: recType, mainRank: recRank } : null),
    levelRank,
  );

  if (tempoRecovery && smallProbeRec && recovery) {
    if (actType === PLAY_TYPES.tripleWithPair && actRank) {
      const solePair = solePairForTripleRank(hand, levelRank, actRank);
      if (solePair && compareRanks(actRank, recRank ?? "3", levelRank) > 0) {
        return {
          upgrade: true,
          verdict: DIVERGENCE_VERDICTS.USER_BETTER,
          note: "小对试探牌力不足难回牌，三带二一次减五张更合理",
          coachQuestionable: true,
        };
      }
    }
    if (
      (actType === PLAY_TYPES.tripleWithPair || actType === PLAY_TYPES.single)
      && smallProbeRec
    ) {
      return {
        upgrade: true,
        verdict: DIVERGENCE_VERDICTS.COACH_QUESTIONABLE,
        note: "小对/散单试探难回牌，用户成组减手路线更合理",
        coachQuestionable: true,
      };
    }
  }

  if (tempoRecovery && smallProbeRec) {
    return {
      upgrade: true,
      verdict: DIVERGENCE_VERDICTS.COACH_QUESTIONABLE,
      note: "用户指出试探牌力不足难回牌，待改推荐",
      coachQuestionable: true,
    };
  }

  return {
    upgrade: true,
    verdict: null,
    note: tempoRecovery ? "回牌/牌力相关申诉" : "结构/教纲相关申诉",
    coachQuestionable: false,
  };
}

function disputeUpgradeLabel(dispute) {
  const tempo = isTempoRecoveryDisputeRationale(dispute?.userRationale);
  const doctrine = rationaleMatchesKeywords(
    String(dispute?.userRationale ?? ""),
    DOCTRINE_DISPUTE_KEYWORDS,
  );
  if (tempo && doctrine) return "是（结构/教纲/回牌牌力相关）";
  if (tempo) return "是（回牌/牌力相关）";
  return "是（结构/教纲相关）";
}

export function buildUserDisputesMarkdownSection(userDisputes = []) {
  if (!userDisputes.length) return [];
  const lines = [
    "## 用户申诉",
    "",
    "用户对「教练更对」等自动裁决提出异议；处理器应结合理由重审，结构/教纲或回牌/牌力相关可升级为「你更对」并改 strategy/。",
    "",
  ];
  for (const item of userDisputes) {
    const upgrade = item.upgradeCandidate ?? isDisputeUpgradeCandidate(item);
    lines.push(
      `### 第 ${item.turnNumber} 手 · 申诉`,
      `- **原裁决：** ${item.originalAdjudication ?? item.verdictLabel ?? "—"}`,
      `- **用户理由：** ${item.userRationale}`,
      `- **重审候选：** ${upgrade ? disputeUpgradeLabel(item) : "否（记录积累）"}`,
      `- **提交时间：** ${item.createdAt ?? "—"}`,
      "",
    );
  }
  return lines;
}

/** 解析 COACH-FIX-REQUEST frontmatter */
export function parseCoachFixFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return fields;
}

/** 从复盘 fix 正文读取牌局 ID */
export function coachFixGameIdFromMarkdown(markdown) {
  const match = markdown.match(/\*\*牌局：\*\*\s*([^，,\s]+)/);
  return match?.[1]?.trim() ?? null;
}

/** pending 复盘是否与本条申诉对应 */
export function coachFixMatchesDispute(markdown, dispute, feedbackId = null) {
  const fm = parseCoachFixFrontmatter(markdown);
  if (fm.status !== "pending" || fm.kind !== "game-review") return false;
  if (feedbackId && fm.feedbackId === feedbackId) return true;
  const gameId = coachFixGameIdFromMarkdown(markdown);
  if (dispute?.gameId && gameId && gameId === dispute.gameId) return true;
  return false;
}

/** 将单条申诉并入 COACH-FIX-REQUEST 正文（去重同手） */
export function mergeDisputeIntoCoachFixMarkdown(markdown, dispute) {
  const existing = parseUserDisputesFromMarkdown(markdown);
  if (existing.some((item) => item.turnNumber === dispute.turnNumber)) {
    return { markdown, merged: false, reason: "duplicate-turn", disputeCount: existing.length };
  }
  const all = [...existing, dispute];
  const sectionText = buildUserDisputesMarkdownSection(all).join("\n");
  let next = markdown;
  if (markdown.includes("## 用户申诉")) {
    next = markdown.replace(
      /## 用户申诉[\s\S]*?(?=\r?\n## )/,
      `${sectionText}\n`,
    );
  } else {
    next = markdown.replace(
      /(\r?\n## 完整时间线)/,
      `\n${sectionText}\n$1`,
    );
  }
  return { markdown: next, merged: true, disputeCount: all.length };
}

/** 提交异议后的用户向确认文案（无技术术语） */
export function buildDisputeAckMessage(dispute) {
  const upgrade = dispute?.upgradeCandidate ?? isDisputeUpgradeCandidate(dispute);
  if (upgrade) {
    if (isTempoRecoveryDisputeRationale(dispute?.userRationale)) {
      return "已收到，会纳入优化。你提到的回牌和牌力问题，这手将优先重审。";
    }
    return "已收到，会纳入优化。你的理由涉及结构或教纲，这手将优先重审。";
  }
  return "已收到，会纳入优化。这手目前仍判教练更对，你的意见已记录供后续改进。";
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
