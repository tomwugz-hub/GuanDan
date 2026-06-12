/** 弱项分析 + 专项练习标签（错题→专项练闭环 v1；v2 预设局面见 drill-scenarios.mjs） */

import {
  DIVERGENCE_VERDICTS,
  summarizeGameDivergences,
} from "../coach/divergence-summary.mjs";
import {
  createDrillRiggedState,
  getDrillScenarioForTag,
  getDrillScenarioSummary,
} from "./drill-scenarios.mjs";
import { loadReviewHistory } from "./review-history.mjs";

export { createDrillRiggedState, getDrillScenarioForTag, getDrillScenarioSummary };

/** 弱项标签常量 */
export const DRILL_TAGS = Object.freeze({
  BOMB_SPLIT_TRIPLE: "拆炸/三带二",
  ONE_CARD_PRESS: "报单压牌",
  WILD_USAGE: "逢人配用法",
  BOMB_TIMING: "炸弹时机",
  PASS_RELEASE: "过牌放行",
});

/** 无历史时的默认推荐专项 */
export const DEFAULT_DRILL_PRESETS = Object.freeze([
  {
    tag: DRILL_TAGS.BOMB_TIMING,
    count: 0,
    lastSeen: null,
    sampleTurn: null,
    summary: "炸弹宜在抢牌权或关键牌型被锁时使用，不宜过早消耗。",
    preset: true,
  },
  {
    tag: DRILL_TAGS.ONE_CARD_PRESS,
    count: 0,
    lastSeen: null,
    sampleTurn: null,
    summary: "对手剩少量牌时，优先用级牌或大牌压住，防止被跑掉。",
    preset: true,
  },
  {
    tag: "三带二减手",
    count: 0,
    lastSeen: null,
    sampleTurn: null,
    summary: "接风或无压时优先三带二减手，避免为凑牌型拆炸弹。",
    preset: true,
  },
]);

/** 各专项的文字说明与匹配规则（UI + 教练轻提示，不改发牌引擎） */
const DRILL_DETAILS = Object.freeze({
  [DRILL_TAGS.BOMB_SPLIT_TRIPLE]: {
    summary: "拆炸弹凑三带二会削弱终局控权，接风时优先完整三带二减手。",
    bannerHint: "留意是否为了减手而拆炸，接风可优先三带二。",
    adviceTip: "这手与「拆炸/三带二」相关，对照是否保留了炸弹结构。",
    patterns: [/拆炸|三带二|炸弹作废|拆.*炸|减手/],
  },
  "三带二减手": {
    summary: "接风或无压时优先三带二减手，避免为凑牌型拆炸弹。",
    bannerHint: "接风或无压时，优先用三带二一次减五张。",
    adviceTip: "这手适合练三带二减手，看是否比拆结构更划算。",
    patterns: [/三带二|减手|接风/],
  },
  [DRILL_TAGS.ONE_CARD_PRESS]: {
    summary: "对手报单或剩牌很少时，要用级牌或大牌压住，不能轻易放行。",
    bannerHint: "对手剩牌少时，优先级牌压牌，别让小牌跑掉。",
    adviceTip: "这手涉及报单压牌，注意是否用了足够大的牌控住。",
    patterns: [/报单|剩.*张|级牌.*压|对手剩|压.*6|压.*单/],
  },
  [DRILL_TAGS.WILD_USAGE]: {
    summary: "逢人配（红心级牌）宜留作同花顺或高价值牌型，慎配小三带。",
    bannerHint: "红心级牌是逢人配，优先留给同花顺或炸弹。",
    adviceTip: "这手涉及逢人配用法，看是否把级牌红桃用在高价值处。",
    patterns: [/逢人配|红心级牌|级牌红桃|红桃.*级/],
  },
  [DRILL_TAGS.BOMB_TIMING]: {
    summary: "无更大普通牌可压时再考虑炸弹；抢牌权时别白白过牌。",
    bannerHint: "炸弹用来抢牌权或解锁局面，别为小事过早消耗。",
    adviceTip: "这手与炸弹时机相关，想想是否值得现在动用炸弹。",
    patterns: [/炸弹|牌权|抢权|小炸|四炸|只有炸弹|动用炸弹/],
  },
  [DRILL_TAGS.PASS_RELEASE]: {
    summary: "有普通牌可压时不应过牌；对手占牌时要积极抢回牌权。",
    bannerHint: "有普通过牌能压时别轻易放行，该抢权就抢。",
    adviceTip: "这手与过牌放行相关，确认过牌是否真比压牌更划算。",
    patterns: [/过牌|不压|放行|不应.*过|轻易放行|抢回牌权|不能轻易/],
  },
});

function drillDetail(tag) {
  return DRILL_DETAILS[tag] ?? DRILL_DETAILS[normalizeDrillTag(tag)] ?? null;
}

/** 将默认展示名映射到分析标签 */
export function normalizeDrillTag(tag) {
  if (tag === "三带二减手") return DRILL_TAGS.BOMB_SPLIT_TRIPLE;
  return tag;
}

export function getDrillSummary(tag) {
  return drillDetail(tag)?.summary ?? `针对「${tag}」多加留意教练推荐。`;
}

export function getDrillBannerHint(tag) {
  return drillDetail(tag)?.bannerHint ?? "来自你的历史弱项，留意教练推荐中的【专项】提示。";
}

/** 从教练更对差异中归类弱项标签 */
export function classifyDivergenceDrillTag(item) {
  const text = [
    ...(item.recommendedReasons ?? []),
    item.verdictNote ?? "",
    item.actual ?? "",
    item.recommended ?? "",
    item.mustBeat ?? "",
  ].join(" ");

  if (/拆炸|三带二|炸弹作废/.test(text)) return DRILL_TAGS.BOMB_SPLIT_TRIPLE;
  if (/报单|剩.*张|级牌.*压|对手剩/.test(text)) return DRILL_TAGS.ONE_CARD_PRESS;
  if (/逢人配|红心级牌|级牌红桃/.test(text)) return DRILL_TAGS.WILD_USAGE;
  if (/炸弹|牌权|抢权|小炸|四炸|只有炸弹/.test(text)) return DRILL_TAGS.BOMB_TIMING;
  if (/过牌|不压|放行|不应.*过|轻易放行|抢回牌权/.test(text)) return DRILL_TAGS.PASS_RELEASE;
  return null;
}

function ingestCoachBetterDivergences(timeline, savedAt, tagMap) {
  const summary = summarizeGameDivergences(timeline, 0);
  for (const item of summary.divergences) {
    if (item.verdict !== DIVERGENCE_VERDICTS.COACH_BETTER) continue;
    const tag = classifyDivergenceDrillTag(item);
    if (!tag) continue;

    const existing = tagMap.get(tag) ?? {
      tag,
      count: 0,
      lastSeen: null,
      sampleTurn: null,
      preset: false,
    };
    existing.count += 1;
    const seenAt = savedAt ?? new Date().toISOString();
    if (!existing.lastSeen || seenAt >= existing.lastSeen) {
      existing.lastSeen = seenAt;
      existing.sampleTurn = {
        turnNumber: item.turnNumber,
        note: item.verdictNote || item.recommendedReasons?.[0] || "",
      };
    }
    tagMap.set(tag, existing);
  }
}

/**
 * 统计历史 + 可选本局 timeline，返回 Top N 弱项。
 * @returns {Array<{ tag, count, lastSeen, sampleTurn, summary, preset? }>}
 */
export function analyzeWeaknesses({ currentTimeline = null, limit = 5 } = {}) {
  const tagMap = new Map();
  const history = loadReviewHistory();

  for (const game of history.games) {
    const timeline = game.coachAdviceTimeline ?? [];
    if (!timeline.length) continue;
    ingestCoachBetterDivergences(timeline, game.savedAt, tagMap);
  }

  if (Array.isArray(currentTimeline) && currentTimeline.length > 0) {
    ingestCoachBetterDivergences(currentTimeline, new Date().toISOString(), tagMap);
  }

  const sorted = [...tagMap.values()]
    .sort((left, right) => right.count - left.count || String(right.lastSeen).localeCompare(String(left.lastSeen)));

  if (sorted.length === 0) {
    return DEFAULT_DRILL_PRESETS.slice(0, 3).map((item) => ({ ...item }));
  }

  return sorted.slice(0, limit).map((item) => ({
    ...item,
    summary: getDrillSummary(item.tag),
  }));
}

/** 推荐理由是否命中当前专项标签 */
export function adviceMatchesDrillTag(reasons = [], play = null, drillFocus) {
  if (!drillFocus) return false;
  const detail = drillDetail(drillFocus);
  if (!detail?.patterns?.length) return false;
  const text = [
    ...(reasons ?? []),
    play?.label ?? "",
    play?.type ?? "",
  ].join(" ");
  return detail.patterns.some((pattern) => pattern.test(text));
}

/** renderAdvice / renderChoiceCard 用的【专项】轻提示 */
export function buildDrillAdviceTip(choice, drillFocus) {
  if (!drillFocus || !choice) return "";
  if (!adviceMatchesDrillTag(choice.reasons, choice.candidate, drillFocus)) return "";
  const detail = drillDetail(drillFocus);
  return `【专项】${detail?.adviceTip ?? `本局重点练「${drillFocus}」`}`;
}

/** 局末统计本局专项提示命中次数 */
export function countDrillFocusHits(timeline = [], drillFocus, humanPlayerIndex = 0) {
  if (!drillFocus || !timeline.length) return 0;
  let hits = 0;
  for (const record of timeline) {
    if (record.playerIndex !== humanPlayerIndex) continue;
    const top = record.choices?.[0];
    if (!top) continue;
    if (adviceMatchesDrillTag(top.reasons, top.play, drillFocus)) hits += 1;
  }
  return hits;
}

/**
 * 专项练习新开一局时的 gameMeta（与 main.newGame 保持一致）。
 * @param {object} baseMeta - gameId / seed / startedAt / playerNames 等基础字段
 * @param {string} tag - 专项标签
 */
export function buildDrillPracticeGameMeta(baseMeta, tag, scenario = null) {
  if (!tag) throw new Error("专项标签不能为空");
  const startedAt = baseMeta.startedAt ?? new Date().toISOString();
  const resolved = scenario ?? getDrillScenarioForTag(tag);
  return {
    ...baseMeta,
    drillFocus: tag,
    drillFocusStartedAt: startedAt,
    drillScenarioId: resolved?.id ?? null,
    drillScenarioTitle: resolved?.title ?? null,
    coachAdviceTimeline: [],
    reportTenReminded: false,
    reportOneReminded: false,
    keyPauseFired: [],
    aiChatTimeline: baseMeta.aiChatTimeline ?? [],
    gameReviewSubmitted: false,
  };
}

/** 单局练习时 match-strip 摘要文案（专项信息并入此处，不再占用独立横幅行） */
export function buildSingleGameMatchSummary(drillFocus = null) {
  if (drillFocus) {
    const scenarioLine = getDrillScenarioSummary(drillFocus);
    if (scenarioLine) {
      return `专项练习（预设局面）：${scenarioLine}`;
    }
    const hint = getDrillBannerHint(drillFocus);
    return `专项练习：${drillFocus} — ${hint}`;
  }
  return "竞技赛未开始；可先用单局继续练习。";
}

/** 无竞技赛时不显示「下一局」 */
export function shouldShowNextMatchGame(matchState) {
  return Boolean(matchState);
}

/** 是否为全新开局（未出牌、轮到你先出） */
export function isFreshDrillGameState(gameState, humanPlayerIndex = 0) {
  if (!gameState) return false;
  return (gameState.turnNumber ?? 0) === 0
    && (gameState.playHistory ?? []).length === 0
    && gameState.currentPlayerIndex === humanPlayerIndex
    && !gameState.lastActivePlay;
}

/** 专项练习列表 HTML（供进度面板渲染） */
export function renderDrillPracticeListHtml(weaknesses = []) {
  if (!weaknesses.length) {
    return "<p class=\"muted\">保存复盘后，系统会从「教练更对」差异中提取弱项。</p>";
  }

  let html = "<ul class=\"drill-practice-list\">";
  for (const item of weaknesses) {
    const countLabel = item.preset ? "推荐" : `${item.count} 次`;
    const scenario = getDrillScenarioForTag(item.tag);
    const scenarioNote = scenario
      ? `<p class="drill-practice-scenario muted">预设：${escapeDrillHtml(scenario.title)}</p>`
      : "";
    html += `<li class="drill-practice-item">
      <div class="drill-practice-head">
        <strong>${escapeDrillHtml(item.tag)}</strong>
        <span class="drill-practice-count">${escapeDrillHtml(countLabel)}</span>
      </div>
      <p class="drill-practice-summary">${escapeDrillHtml(item.summary)}</p>
      ${scenarioNote}
      <button class="btn drill-practice-btn" type="button" data-drill-tag="${escapeDrillHtml(item.tag)}">练这个</button>
    </li>`;
  }
  html += "</ul>";
  return html;
}

function escapeDrillHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
