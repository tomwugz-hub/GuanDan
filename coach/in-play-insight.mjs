/** 打牌中即时意见：规则引擎快答 + 采纳/记录/驳回裁决 */

import { tryLocalCoachAnswer } from "./local-qa.mjs";
import {
  buildTeammateBeatInsightAnalysis,
  expandVagueObjectionQuestion,
  findTeammateBeatIncident,
} from "./partner-trick-insight.mjs";
import {
  detectAdviceTop1Violations,
  doctrineViolationAckLine,
  buildTop1MustBeatSfRunwayInsight,
} from "../strategy/doctrine-enforce.mjs";
import { partnerHandCount } from "../strategy/table-context.mjs";

/** 与 user-dispute 教纲关键词一致，避免循环依赖 */
const INSIGHT_DOCTRINE_KEYWORDS = [
  "拆顺子", "拆炸", "拆炸弹", "拆同花顺", "保结构", "保顺子", "保炸",
  "不应拆", "不该拆", "结构", "教纲", "P1", "P4", "P5", "P6", "P9", "P10",
  "空炸", "过牌", "接风", "队友", "散牌", "逢人配", "压队友", "不合理", "大王对", "王对",
  "送队友", "送老史", "送走", "只剩一张",
];

export const INSIGHT_VERDICTS = {
  ADOPTED: "adopted",
  RECORDED: "recorded",
  REJECTED: "rejected",
};

const USER_RIGHT_SIGNALS = /你的理解对|你是对的|你说得对|不应.*拆|不宜.*拆|违规|请不要照做|认可|保结构|保顺子|保炸|保对|推荐偏了|应出单|请出单|你手里有散单|不该拆结构|不拆结构/;
const COACH_DEFEND_SIGNALS = /推荐.*更稳|教练.*更对|仍建议|照抄|左侧推荐合理/;

/** 用户向状态标签（局末复盘） */
export const INSIGHT_STATUS_LABELS = {
  [INSIGHT_VERDICTS.ADOPTED]: "教纲相关",
  [INSIGHT_VERDICTS.RECORDED]: "已记录",
  [INSIGHT_VERDICTS.REJECTED]: "已回复",
};

function rationaleMatchesDoctrineKeywords(text) {
  const rationale = String(text ?? "").trim();
  if (!rationale) return false;
  const lower = rationale.toLowerCase();
  return INSIGHT_DOCTRINE_KEYWORDS.some((kw) => {
    const k = kw.toLowerCase();
    return lower.includes(k) || rationale.includes(kw);
  });
}

/** 从规则引擎长答中提取 1～3 句人话摘要 */
export function extractBriefAnalysis(rawText, { maxSentences = 3 } = {}) {
  let text = String(rawText ?? "").trim();
  if (!text) return "暂无补充说明，局末会一并汇总你的意见。";

  text = text
    .replace(/【规则引擎作答】/g, "")
    .replace(/【规则教练】/g, "")
    .replace(/— 规则引擎[\s\S]*$/m, "")
    .replace(/\n+/g, " ")
    .trim();

  const sentences = text
    .split(/(?<=[。！？!?])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4 && !/^补充：/.test(s));

  if (sentences.length === 0) return text.slice(0, 120);
  return sentences.slice(0, maxSentences).join("");
}

function userRightFromQa(text) {
  const body = String(text ?? "");
  if (USER_RIGHT_SIGNALS.test(body)) return true;
  if (COACH_DEFEND_SIGNALS.test(body) && !USER_RIGHT_SIGNALS.test(body)) return false;
  return false;
}

/**
 * 分析打牌中意见，返回摘要与裁决。
 * @returns {{ analysis: string, verdict: string, qaSource?: string, doctrineViolations?: object[] }}
 */
export function analyzeInPlayInsight(question, context) {
  const teammateBeat = findTeammateBeatIncident(
    context.recentPlayHistory ?? context.playHistory ?? [],
  );
  const expandedQuestion = expandVagueObjectionQuestion(question, context);
  const qa = tryLocalCoachAnswer(expandedQuestion, context);
  const violations = detectAdviceTop1Violations(context) ?? [];
  const blockTop1 = violations.filter((v) => v.blockTop1);
  const qaText = qa?.text ?? "";
  const doctrineMatch = rationaleMatchesDoctrineKeywords(question)
    || rationaleMatchesDoctrineKeywords(expandedQuestion);

  let analysis = extractBriefAnalysis(qaText);
  let verdict = INSIGHT_VERDICTS.REJECTED;

  const partnerCardsLeft = context.state
    ? partnerHandCount({
      state: context.state,
      playerIndex: context.humanPlayerIndex ?? context.playerIndex ?? 0,
    })
    : 27;
  const feedPartnerQuery = /送.*走|只剩.*张|送老史|送队友|哪怕拆牌|打小牌/i.test(String(question ?? ""));

  if (teammateBeat && /不合理|不对|压队友|王对|大王|不该压/i.test(String(question ?? ""))) {
    verdict = INSIGHT_VERDICTS.ADOPTED;
    analysis = buildTeammateBeatInsightAnalysis(teammateBeat) ?? analysis;
  } else if (feedPartnerQuery || (partnerCardsLeft === 1 && /老史|队友|送|一张|拆牌/i.test(String(question ?? "")))) {
    verdict = INSIGHT_VERDICTS.ADOPTED;
    if (!/你说得对|送队友走完|不宜三带二|P10/.test(analysis)) {
      analysis = extractBriefAnalysis(qaText || "队友剩1张冲刺，接风宜小单送队友走完。");
    }
  } else if (blockTop1.length > 0) {
    verdict = INSIGHT_VERDICTS.ADOPTED;
    const sfInsight = buildTop1MustBeatSfRunwayInsight(context);
    if (sfInsight) {
      analysis = extractBriefAnalysis(sfInsight);
    } else {
      const ack = doctrineViolationAckLine(blockTop1);
      const violationText = blockTop1.map((v) => v.summary).filter(Boolean).join("");
      if (ack && violationText) {
        analysis = extractBriefAnalysis(`${ack}${violationText}`);
      } else if (ack && !analysis.includes("违规")) {
        analysis = `${ack}${analysis}`;
      }
    }
  } else if (doctrineMatch && userRightFromQa(qaText)) {
    verdict = INSIGHT_VERDICTS.ADOPTED;
  } else if (doctrineMatch || (qa?.mode && qa.mode !== "brief")) {
    verdict = INSIGHT_VERDICTS.RECORDED;
  }

  return {
    analysis,
    verdict,
    qaSource: qa?.source ?? "rule-engine",
    doctrineViolations: blockTop1,
  };
}

/** 打牌中 Toast / 面板回复文案 */
export function formatInPlayInsightReply(analysis, verdict) {
  const body = String(analysis ?? "").trim();
  const prefix = body ? `教练说：${body}` : "教练说：";
  if (verdict === INSIGHT_VERDICTS.ADOPTED) {
    return `${prefix} 这手你说得对，局末复盘会标注教纲要点`;
  }
  if (verdict === INSIGHT_VERDICTS.RECORDED) {
    return `${prefix} 意见已记录，局末一并汇总供学习`;
  }
  return prefix;
}

export function normalizeGameInsight({
  turnNumber,
  question,
  analysis,
  verdict,
  top1Label = null,
  userNote = null,
  createdAt = new Date().toISOString(),
}) {
  const q = String(question ?? "").trim();
  const tn = Number(turnNumber);
  if (!Number.isFinite(tn) || tn < 0 || !q || !verdict) return null;
  return {
    turnNumber: tn,
    question: q,
    analysis: String(analysis ?? "").trim(),
    verdict,
    top1Label: top1Label ?? null,
    userNote: String(userNote ?? q).trim(),
    createdAt,
  };
}

/** 局末 COACH-FIX-REQUEST「本局你的意见」节 */
export function buildGameInsightsMarkdownSection(gameInsights = []) {
  const items = (gameInsights ?? []).filter((item) => item?.question);
  if (!items.length) return [];

  const adopted = items.filter((i) => i.verdict === INSIGHT_VERDICTS.ADOPTED);
  const recorded = items.filter((i) => i.verdict === INSIGHT_VERDICTS.RECORDED);

  const lines = [
    "## 本局你的意见",
    "",
    `打牌中即时反馈共 ${items.length} 条：教纲相关 ${adopted.length} 条、已记录 ${recorded.length} 条。`,
    "意见写入复盘归档与数据集，**不会**自动触发改 `strategy/`。",
    "",
  ];

  for (const item of items) {
    const status = INSIGHT_STATUS_LABELS[item.verdict] ?? item.verdict;
    lines.push(
      `### 第 ${item.turnNumber} 手 · ${status}`,
      `- **你的话：** ${item.question}`,
      `- **教练回复：** ${item.analysis || "—"}`,
      `- **采纳结果：** ${item.verdict}`,
      `- **当时推荐1：** ${item.top1Label ?? "—"}`,
      `- **记录时间：** ${item.createdAt ?? "—"}`,
      "",
    );
  }
  return lines;
}

/** 从 COACH-FIX-REQUEST 解析打牌中意见 */
export function parseGameInsightsFromMarkdown(markdown) {
  const section = markdown.split("## 本局你的意见")[1]?.split(/^## /m)[0] ?? "";
  if (!section.trim()) return [];
  const blocks = section.split(/^### /m).slice(1);
  return blocks.map((block) => {
    const header = block.split(/\r?\n/)[0] ?? "";
    const turnMatch = header.match(/第\s*(\d+)\s*手/);
    const questionMatch = block.match(/\*\*你的话：\*\*\s*(.+)/);
    const analysisMatch = block.match(/\*\*教练回复：\*\*\s*(.+)/);
    const verdictMatch = block.match(/\*\*采纳结果：\*\*\s*(.+)/);
    const top1Match = block.match(/\*\*当时推荐1：\*\*\s*(.+)/);
    const createdMatch = block.match(/\*\*记录时间：\*\*\s*(.+)/);
    return {
      turnNumber: turnMatch ? Number(turnMatch[1]) : null,
      question: questionMatch?.[1]?.trim() ?? "",
      analysis: analysisMatch?.[1]?.trim() ?? "",
      verdict: verdictMatch?.[1]?.trim() ?? "",
      top1Label: top1Match?.[1]?.trim() ?? null,
      userNote: questionMatch?.[1]?.trim() ?? "",
      createdAt: createdMatch?.[1]?.trim() ?? null,
    };
  }).filter((item) => item.turnNumber != null && item.question);
}

/** 将同手 adopted 意见并入申诉重审上下文 */
export function gameInsightsForDisputeTurn(gameInsights, turnNumber) {
  return (gameInsights ?? []).filter(
    (item) => item.turnNumber === turnNumber
      && (item.verdict === INSIGHT_VERDICTS.ADOPTED || item.verdict === INSIGHT_VERDICTS.RECORDED),
  );
}

/** 有 adopted 意见时增强申诉重审权重 */
export function disputeContextWithGameInsights(dispute, gameInsights = []) {
  const related = gameInsightsForDisputeTurn(gameInsights, dispute?.turnNumber);
  const adopted = related.filter((i) => i.verdict === INSIGHT_VERDICTS.ADOPTED);
  if (!adopted.length) return { gameInsights: related };
  return {
    gameInsights: related,
    insightAdopted: true,
    insightRationale: adopted.map((i) => i.question).join("；"),
    forceUpgrade: true,
  };
}
