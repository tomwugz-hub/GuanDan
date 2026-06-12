/** 规则事实问答：不经过大模型，避免与左侧推荐自相矛盾。 */

import { cardId, createCard } from "../engine/card.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import {
  alignReasonsForPlay,
  dedupeReasonStrings,
  isEnforcementReason,
  mergeReasonsByPrincipleCode,
} from "../strategy/reason-align.mjs";
import {
  explainRankAvailability,
  analyzeRankAvailability,
  structureAwareBombs,
} from "../strategy/scorers/structure.mjs";
import {
  buildStrategicGroups,
  handHasOverlappingLowStraightChoice,
  isHighLowStraightLabel,
  isWrapStraightLabel,
  STRAIGHT_HIGH_OVER_WRAP_REASON,
} from "../strategy/strategic-groups.mjs";
import { inferLeadMode } from "../strategy/lead-mode.mjs";
import {
  analyzeReservePairForPendingTriple,
  buildBeatPairPrincipleAnswer,
  buildBeatSinglePrincipleAnswer,
  explainPrincipleForQa,
  explainPrincipleForQuestion,
  isBeatPairLikeMustBeat,
  isFollowingOpponentPair,
  resolveStraightBreakForSingle,
  resolveStraightBreakForTripleWithPair,
  resolveTripleBreakForPair,
  resolveTripleBreakForConsecutivePairs,
  resolveTripleBreakForStraight,
} from "../strategy/principles.mjs";
import {
  detectAdviceTop1Violations,
  doctrineViolationAckLine,
} from "../strategy/doctrine-enforce.mjs";
import { canBeat } from "../engine/compare-play.mjs";
import { compareRanks, isControlRank, rankOrder, rankPower } from "../engine/rank-order.mjs";

/** FAB 页脚版本标识，便于确认是否加载新 bundle */
export const RULE_ENGINE_VERSION = "v2";

export function formatRuleEngineAnswerFooter() {
  const build = globalThis.__GUANDAN_BUILD__ ?? "dev-local";
  return `— 规则引擎 ${RULE_ENGINE_VERSION} · 构建 ${build}`;
}

export function appendRuleEngineAnswerFooter(text) {
  const body = String(text ?? "").trimEnd();
  const footer = formatRuleEngineAnswerFooter();
  if (body.includes(footer) || body.includes(`规则引擎 ${RULE_ENGINE_VERSION}`)) return body;
  return `${body}\n\n${footer}`;
}

function attachDoctrineViolationAck(context, answer) {
  if (!answer?.text) return answer;
  const violations = detectAdviceTop1Violations(context);
  const ack = doctrineViolationAckLine(violations);
  if (!ack || answer.text.includes("违规（")) return answer;
  const text = answer.text.startsWith("【规则引擎作答】")
    ? answer.text.replace("【规则引擎作答】", `【规则引擎作答】${ack}`)
    : `${ack}\n${answer.text}`;
  return { ...answer, text, doctrineViolations: violations };
}

function rankCountsFromHand(humanHand = []) {
  const counts = new Map();
  for (const card of humanHand) {
    if (card.rank === "SJ" || card.rank === "BJ") continue;
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }
  return counts;
}

function bombStacks(counts) {
  return [...counts.entries()]
    .filter(([, count]) => count >= 4)
    .sort((a, b) => b[1] - a[1])
    .map(([rank, count]) => ({ rank, count }));
}

function rankLabel(rank) {
  return rank === "SJ" ? "小王" : rank === "BJ" ? "大王" : rank;
}

function openingKeepPhrase(levelRank, skipBombWords) {
  if (levelRank === "2") {
    return skipBombWords ? "保留大牌控权" : "保留大牌和整炸";
  }
  return skipBombWords
    ? `保留级牌${rankLabel(levelRank)}控权`
    : `保留级牌${rankLabel(levelRank)}和炸弹`;
}

function openingProbeKeepPhrase(levelRank, skipBombWords) {
  if (levelRank === "2") {
    return skipBombWords ? "开局先留大牌控权，用中等牌试探" : "开局先留大牌和炸弹，用中等牌试探";
  }
  return skipBombWords
    ? `开局先留级牌${rankLabel(levelRank)}等控权牌，用中等牌试探`
    : `开局先留级牌${rankLabel(levelRank)}和炸弹，用中等牌试探`;
}

function controlKeepSinglePhrase(rank, levelRank) {
  if (!isControlRank(rank, levelRank)) return null;
  if (rank === levelRank) return `${rankLabel(rank)}级牌留作控权单张`;
  return `${rankLabel(rank)}留作控权单张`;
}

function notControlRankNote(rank, levelRank) {
  if (isControlRank(rank, levelRank)) return null;
  return `本局级牌是${rankLabel(levelRank)}，${rankLabel(rank)}不是控权牌`;
}

/** 过滤非级牌2局里把 2 误说成控权牌的表述 */
function sanitizeControlNarrative(text, levelRank) {
  if (!text || levelRank === "2") return text;
  return text
    .replace(/2留作控权单张/g, `2不是本局控权牌（级牌${rankLabel(levelRank)}）`)
    .replace(/保留2控权/g, `级牌${rankLabel(levelRank)}才是控权牌`)
    .replace(/2仍留作控权单张/g, `2不是本局控权牌（级牌${rankLabel(levelRank)}）`)
    .replace(/2留单张控权/g, `2不是本局控权牌（级牌${rankLabel(levelRank)}）`)
    .replace(/2控权大牌/g, `2牌面偏大但非控权牌（级牌${rankLabel(levelRank)}）`)
    .replace(/保留2控权价值/g, `2不是控权牌，级牌${rankLabel(levelRank)}才值得留`)
    .replace(/保留2控权单张/g, `级牌${rankLabel(levelRank)}才是控权牌`)
    .replace(/2炸通常留到残局或更大威胁时再亮/g, `2不是本局大牌（级牌${rankLabel(levelRank)}）`)
    .replace(/2炸留给更关键局面/g, `2是本局最小炸（级牌${rankLabel(levelRank)}），并非大牌`);
}

function adviceTopLine(context) {
  const top = context.currentAdvice?.choices?.[0];
  if (!top?.play?.label) return null;
  const reasons = filterReasonsForUser(top.reasons ?? [], "", { play: top.play }).join("；");
  return `左侧当前推荐1：${top.play.label}${reasons ? `（${reasons}）` : ""}`;
}

function breaksBombWithTriple(rank, heldCount) {
  return heldCount >= 4 && heldCount - 3 < 4;
}

/** 结合理牌结构判断某 rank 出三张是否会拆整炸 */
function resolveTripleRankAnalysis(context, rank, counts) {
  const hand = context.humanHand ?? [];
  const levelRank = context.levelRank ?? "2";
  const rawCount = counts.get(rank) ?? 0;

  if (hand.length === 0) {
    return {
      total: rawCount,
      availableCount: rawCount,
      effectiveBombCount: rawCount >= 4 ? rawCount : 0,
      wouldBreakBomb: breaksBombWithTriple(rank, rawCount),
      lockedSummary: null,
      lockedEntries: [],
    };
  }

  const info = explainRankAvailability(hand, rank, levelRank);
  return {
    ...info,
    wouldBreakBomb: info.wouldBreakBombForTriple,
    lockedSummary: info.summary || null,
  };
}

/** 结合理牌结构判断某 rank 作对子带牌是否伤结构 */
function resolvePairRankAnalysis(context, pairRank, counts) {
  const hand = context.humanHand ?? [];
  const levelRank = context.levelRank ?? "2";
  const rawCount = counts.get(pairRank) ?? 0;

  if (hand.length === 0) {
    return { availableCount: rawCount, lockedSummary: null };
  }

  const info = explainRankAvailability(hand, pairRank, levelRank);
  return {
    availableCount: info.availableCount ?? rawCount,
    lockedSummary: info.summary || null,
  };
}

function bombLabel(rank, heldCount) {
  if (heldCount >= 5) return `${heldCount}张${rankLabel(rank)}五炸`;
  if (heldCount >= 4) return `四张${rankLabel(rank)}四炸`;
  return null;
}

function pickTopReasons(choice, limit = 2) {
  return (choice?.reasons ?? []).filter(Boolean).slice(0, limit);
}

/** 开发者向 ML/融合理由，不向学习者展示 */
function isMlOrFusionReason(reason) {
  const raw = String(reason ?? "").trim();
  if (!raw) return true;
  return /ML|智能融合|倾向分|policy|model|已融合.*策略模型|限制\s*ML|ML\s*推炸/i.test(raw);
}

/** 单条理由：过滤 ML 相关后返回原文，否则 null */
export function sanitizeReasonForUser(reason) {
  const raw = String(reason ?? "").trim();
  if (!raw || isMlOrFusionReason(raw)) return null;
  return raw;
}

/** 推荐理由列表：去掉 ML/执法条目与矛盾惩罚项，按原则码合并，空则回退默认句 */
export function filterReasonsForUser(
  reasons,
  fallback = "这是当前评分较好的合法选择",
  {
    play = null,
    previousPlay = null,
    levelRank = "2",
    choiceIndex = 0,
    maxReasons = null,
  } = {},
) {
  const aligned = alignReasonsForPlay(
    (reasons ?? []).filter((reason) => !isEnforcementReason(reason)),
    play,
    { previousPlay },
  );
  let filtered = mergeReasonsByPrincipleCode(
    dedupeReasonStrings(
      aligned
        .map((reason) => translateReasonForLearner(reason, { levelRank, previousPlay })
          ?? sanitizeReasonForUser(reason))
        .filter(Boolean),
    ),
  );
  const reasonLimit = maxReasons ?? (choiceIndex >= 1 ? 2 : null);
  if (reasonLimit != null && filtered.length > reasonLimit) {
    filtered = filtered.slice(0, reasonLimit);
  }
  return filtered.length > 0 ? filtered : [fallback];
}

/** 取首条用户可见理由 */
export function firstReasonForUser(
  reasons,
  fallback = "这是当前评分较好的合法选择",
  options = {},
) {
  return filterReasonsForUser(reasons, fallback, options)[0];
}

function hasInitiativePhrase(context = {}) {
  return context.hasInitiative === true
    || context.turnNumber === 0
    || context.turnNumber === "0";
}

/** 把 scorer 原文理由翻成学习者能懂的大白话；ML/融合类理由直接跳过 */
function translateReasonForLearner(reason, context = {}) {
  const raw = String(reason ?? "").trim();
  if (!raw || isMlOrFusionReason(raw)) return null;
  const skipBombWords = Boolean(context.skipBombNarrative);
  const levelRank = context.levelRank ?? "2";

  const tripleBreakHigh = raw.match(/^拆三张([3-9JQKA2]|10)组其他牌型代价偏高$/);
  if (tripleBreakHigh) {
    const rank = tripleBreakHigh[1] === "10" ? "10" : tripleBreakHigh[1];
    return skipBombWords
      ? `${rankLabel(rank)}只有三张、本来就不是炸弹，适合拿来减手`
      : `${rankLabel(rank)}只有三张、本来就不是炸弹，拆了不亏整炸，适合拿来减手`;
  }

  const tripleBreakLow = raw.match(/^拆三张([3-9JQKA2]|10)代价偏低$/);
  if (tripleBreakLow) {
    const rank = tripleBreakLow[1] === "10" ? "10" : tripleBreakLow[1];
    return skipBombWords
      ? `${rankLabel(rank)}只有三张、本来就不是炸弹，适合拿来减手`
      : `${rankLabel(rank)}只有三张、本来就不是炸弹，拆了不亏整炸，适合拿来减手`;
  }

  const triplePairBreak = raw.match(/^拆三张([3-9JQKA2]|10)出对子代价较高$/);
  if (triplePairBreak) {
    const rank = triplePairBreak[1] === "10" ? "10" : triplePairBreak[1];
    return `${rankLabel(rank)}只有三张，拆一张成对子会削弱后续组牌，一般不优先`;
  }

  const bombBreakTriple = raw.match(/^拆(\d+)张([3-9JQKA2]|10)后只剩(\d+)张，炸弹作废$/);
  if (bombBreakTriple) {
    const [, held, rank, remain] = bombBreakTriple;
    const remainWord = remain === "1"
      ? `单${rankLabel(rank)}`
      : remain === "2"
        ? `对${rankLabel(rank)}`
        : `${remain}张${rankLabel(rank)}`;
    return `拆${held}张${rankLabel(rank)}后只剩${remainWord}，整炸作废`;
  }

  const partialBomb = raw.match(/^用掉部分([3-9JQKA2]|10)后虽仍够四张炸，但会降低炸弹厚度$/);
  if (partialBomb) {
    return `会动到${rankLabel(partialBomb[1])}炸弹，虽还能凑炸，但厚度下降`;
  }

  const pressBreak = raw.match(/^为压牌拆(\d+)张([3-9JQKA2]|10)三带二，炸弹作废，优先整炸或过牌$/);
  if (pressBreak) {
    return `为压牌拆${pressBreak[1]}张${rankLabel(pressBreak[2])}三带二会让整炸作废，不如整炸或过牌`;
  }

  if (context.brief) {
    const briefKnown = {
      "开局减手": hasInitiativePhrase(context) ? "拿牌权" : "减手",
      "开局保留高控制牌": "先留大牌控权",
      "炸弹是牌权资源，非必要不消耗": "炸弹留给关键控权",
    };
    const tripleBreakBrief = raw.match(/^拆三张([3-9JQKA2]|10)(?:组其他牌型)?代价偏[高低]$/);
    if (tripleBreakBrief) {
      const rank = tripleBreakBrief[1] === "10" ? "10" : tripleBreakBrief[1];
      return `${rankLabel(rank)}只有三张、不是炸弹`;
    }
    if (briefKnown[raw]) return sanitizeControlNarrative(briefKnown[raw], levelRank);
  }

  const known = {
    "开局减手": `开局有牌权，用中等牌减手，${openingKeepPhrase(levelRank, skipBombWords)}`,
    "开局保留高控制牌": openingProbeKeepPhrase(levelRank, skipBombWords),
    "炸弹是牌权资源，非必要不消耗": "炸弹留给关键控权，非必要不拆",
    "接风优先三带二、顺子等减手结构": "接风时用三带二、顺子等成组牌减手",
    "有大王可回收牌权，先小单试探": "有大王可回收牌权，送单试探更灵活",
    "三带二无送单回收路径，被压后只能靠炸": "三带二无回收牌，被压后只能靠炸",
    "拆三张组三带二，不如留大王送单回收": "拆三张组三带二，不如留大王送单回收",
    "接风用成组牌抢节奏，保留炸弹给拦截": "接风先走成组牌，炸弹留给后面拦截",
    "对手占牌，优先用普通牌型抢回牌权": "对手占牌时，先用普通牌抢回牌权",
    "已有普通牌能压住，不必动用炸弹": "桌上普通牌够压，不必动用炸弹",
    "勿用高炸拦低炸，优先考虑过牌": "勿用高炸拦低炸，过牌保留炸弹更划算",
    "压顺子用最小四炸抢牌权，六炸变对子仍可减手": "【P7】四炸够压顺子，打完剩对子仍可减手",
    "【P7】四炸够压顺子，不必六炸；打完剩对子仍可减手": "【P7】四炸够压顺子，打完剩对子仍可减手",
    "【P7】四炸够压顺子，打完剩对子仍可减手": "【P7】四炸够压顺子，打完剩对子仍可减手",
    "压顺子满张炸弹控牌权，四炸易被反压": "【P7】满张炸弹控牌权，四炸易被反压",
    "【P7】满张炸弹控牌权，四炸易被反压": "【P7】满张炸弹控牌权，四炸易被反压",
    "【P7】拆炸四炸牌力弱，应满张出炸控权": "【P7】拆炸出四炸牌力弱，应满张出炸控权",
    "【P7】拆炸出四炸牌力弱，应满张出炸控权": "【P7】拆炸出四炸牌力弱，应满张出炸控权",
    "压顺子需炸弹抢牌权，优先最小够压炸": "【P7】压顺子需炸弹抢牌权，优先最小够压炸",
    "【P7】压顺子需炸弹抢牌权，优先最小够压炸": "【P7】压顺子需炸弹抢牌权，优先最小够压炸",
    "只有炸弹能压，应抢牌权": "只有炸弹能压，这手应抢牌权",
    "无可用更大普通牌可压，需用炸弹抢牌权": "普通牌压不住，需用炸弹抢牌权",
    "无更大连对可压，需用炸弹抢牌权": "无更大连对可压，需用炸弹抢牌权",
    "队友本墩已出过牌，可过牌等同花顺/炸弹": "队友本墩已跟牌，可过牌保留炸弹",
    "队友本墩已跟牌，可过牌保留炸弹": "队友本墩已跟牌，可过牌保留炸弹",
    "队友本墩已跟牌，可过牌保留大牌": "队友本墩已跟牌，可过牌保留大牌",
    "对手报单，用级牌压更保险，避免被队友送牌放行": "对手报单，用级牌压更保险，避免被队友送牌放行",
    "对手报单，最小单张压牌易被队友送牌放行": "对手报单，最小单张压易被队友送牌，宜换级牌或大牌",
    "这手会动到已有炸弹，需要用牌路收益来抵消": "会动到已有炸弹，只有明显收益才值得",
  };
  if (known[raw]) return sanitizeControlNarrative(known[raw], levelRank);

  return sanitizeControlNarrative(raw, levelRank);
}

function learnerTopReasons(choice, limit = 2, context = {}) {
  const levelRank = context.levelRank ?? "2";
  const effectiveLimit = context.brief ? 1 : limit;
  const play = choice?.play ?? choice?.candidate ?? null;
  const aligned = alignReasonsForPlay(choice?.reasons, play, {
    previousPlay: context.previousPlay ?? context.table?.lastActivePlay ?? null,
  });
  return aligned.slice(0, effectiveLimit)
    .map((reason) => translateReasonForLearner(reason, { ...context, levelRank }))
    .filter(Boolean);
}

/** 该 rank 在理牌后是否真有四张及以上整炸 */
function hasEffectiveWholeBomb(tripleAnalysis) {
  return (tripleAnalysis?.effectiveBombCount ?? 0) >= 4;
}

/** 裸数够四张但理牌后不构成整炸（如有牌锁在同花顺） */
function rankHasNoWholeBomb(tripleHeld, tripleAnalysis) {
  return tripleHeld >= 4
    && !tripleAnalysis?.wouldBreakBomb
    && !hasEffectiveWholeBomb(tripleAnalysis);
}

/** 去重理由行：精确去重，并跳过与已有理由语义重叠的补充句 */
function dedupeWhyReasonLines(lines) {
  const seen = new Set();
  const normalized = (text) => text.replace(/^- /, "").trim();
  const hasOpeningLeadNote = lines.some((line) => {
    const t = normalized(line);
    return /开局.*牌权|有牌权.*开局/.test(t);
  });
  const hasTripleOnlyNote = (rank) => lines.some((line) => {
    const t = normalized(line);
    return t.includes(`${rankLabel(rank)}只有三张`) && /不是炸弹|不成炸/.test(t);
  });

  return lines.filter((line) => {
    const key = normalized(line);
    if (seen.has(key)) return false;
    if (hasOpeningLeadNote && /第\s*\d+\s*手有牌权/.test(key)) return false;
    seen.add(key);
    return true;
  }).filter((line, _i, arr) => {
    const key = normalized(line);
    const tripleOnlyMatch = key.match(/^([3-9JQKA2]|10)只有三张/);
    if (tripleOnlyMatch && arr.filter((l) => normalized(l).includes(`${rankLabel(tripleOnlyMatch[1])}只有三张`)).length > 1) {
      return arr.indexOf(line) === arr.findIndex((l) => normalized(l).includes(`${rankLabel(tripleOnlyMatch[1])}只有三张`));
    }
    return true;
  });
}

function isSmallestNonJokerRank(rank, levelRank) {
  if (rank === "SJ" || rank === "BJ") return false;
  const order = rankOrder(levelRank).filter((r) => r !== "SJ" && r !== "BJ");
  return order[0] === rank;
}

function briefLockedStructurePhrase(tripleAnalysis) {
  const summary = tripleAnalysis?.lockedSummary;
  if (!summary) return "不会拆炸";
  const sfMatch = summary.match(/([^、；]+)已在同花顺/);
  if (sfMatch) return `${sfMatch[1]}在同花顺里，不会拆炸`;
  const first = summary.split("；")[0];
  return first ? `${first}，不会拆炸` : "不会拆炸";
}

function briefLevelRankNote(rank, levelRank) {
  if (isControlRank(rank, levelRank)) return null;
  if (isSmallestNonJokerRank(rank, levelRank)) {
    return `本局级牌是${rankLabel(levelRank)}，${rankLabel(rank)}是最小点`;
  }
  return `本局级牌是${rankLabel(levelRank)}，${rankLabel(rank)}不是控权牌`;
}

function compactTripleWithPairLabel(tripleRank, pairRank) {
  if (!tripleRank) return null;
  const triple = rankLabel(tripleRank).repeat(Math.min(3, 3));
  return pairRank ? `${triple}+${rankLabel(pairRank).repeat(2)}` : `${triple}三带二`;
}

/** 按真实牌型生成短标签，避免把「三张」误写成「三带二」 */
function compactPlayShortLabel(play) {
  if (!play) return null;
  const type = play.type;
  if (type === PLAY_TYPES.tripleWithPair || type === "TripleWithPair") {
    return compactTripleWithPairLabel(play.mainRank, inferPairRankFromPlay(play));
  }
  if (type === PLAY_TYPES.triple || type === "Triple") {
    return `三个${rankLabel(play.mainRank)}`;
  }
  if (type === PLAY_TYPES.pair || type === "Pair") {
    return `对${rankLabel(play.mainRank)}`;
  }
  return play.label ?? null;
}

function inferPairRankFromPlay(play) {
  const mainRank = play?.mainRank;
  if (!mainRank) return null;
  const cards = play?.cards ?? [];
  for (const card of cards) {
    if (card.rank !== mainRank && card.rank !== "SJ" && card.rank !== "BJ") {
      return card.rank;
    }
  }
  const label = play?.label ?? "";
  const pairMatch = label.match(/对?\s*([3-9]|10|J|Q|K|A|2)/gi);
  if (pairMatch) {
    for (const token of pairMatch) {
      const rank = normalizeRank(token.replace(/对/gi, "").trim());
      if (rank && rank !== mainRank) return rank;
    }
  }
  return null;
}

/** 在左侧候选中查找与用户设想同类型的三带二 */
function findTripleWithPairCandidate(choices, tripleRank, pairRank) {
  for (let i = 0; i < choices.length; i++) {
    const play = choices[i].play ?? choices[i].candidate;
    if (play?.type !== "TripleWithPair") continue;
    if (play.mainRank !== tripleRank) continue;
    if (pairRank) {
      const cards = play.cards ?? [];
      const pairCount = cards.filter((c) => c.rank === pairRank).length;
      if (pairCount >= 2 || play.label?.includes(rankLabel(pairRank))) {
        return { index: i, choice: choices[i], play };
      }
      continue;
    }
    return { index: i, choice: choices[i], play };
  }
  return null;
}

function canFormTripleWithPair(counts, tripleRank, pairRank, tripleAnalysis = null) {
  const tripleHeld = tripleAnalysis?.availableCount ?? (counts.get(tripleRank) ?? 0);
  const pairHeld = pairRank ? (counts.get(pairRank) ?? 0) : 0;
  return tripleHeld >= 3 && (!pairRank || pairHeld >= 2);
}

function describeHandSituation(proposed, counts, tripleAnalysis = null) {
  const { tripleRank, pairRank } = proposed;
  const tripleHeld = counts.get(tripleRank) ?? 0;
  const availableTriple = tripleAnalysis?.availableCount ?? tripleHeld;
  const pairHeld = pairRank ? (counts.get(pairRank) ?? 0) : 0;
  const lines = ["【你的手牌情况】"];

  if (tripleAnalysis?.lockedSummary) {
    lines.push(`- ${tripleAnalysis.lockedSummary}`);
  }

  if (tripleHeld >= 4 && tripleAnalysis?.effectiveBombCount >= 4) {
    lines.push(`- ${rankLabel(tripleRank)}：${tripleHeld} 张（${bombLabel(tripleRank, tripleAnalysis.effectiveBombCount)}）`);
  } else if (tripleHeld >= 4 && availableTriple >= 3) {
    lines.push(`- ${rankLabel(tripleRank)}：${tripleHeld} 张（可组三张 ${availableTriple} 张，${tripleAnalysis?.effectiveBombCount >= 4 ? "仍成整炸" : "不构成整炸"}）`);
  } else if (availableTriple >= 3) {
    lines.push(`- ${rankLabel(tripleRank)}：${tripleHeld} 张（可组三张，非炸弹）`);
  } else {
    lines.push(`- ${rankLabel(tripleRank)}：${tripleHeld} 张（不足三张，组不了三带二）`);
  }

  if (pairRank) {
    if (pairHeld >= 2) {
      lines.push(`- ${rankLabel(pairRank)}：${pairHeld} 张（可成对）`);
    } else {
      lines.push(`- ${rankLabel(pairRank)}：${pairHeld} 张（不成对，带不了对${rankLabel(pairRank)}）`);
    }
  }

  return lines;
}

export function buildEngineFacts(context) {
  const hand = context.humanHand ?? [];
  const levelRank = context.levelRank ?? "2";
  const counts = rankCountsFromHand(hand);
  const physicalRankCounts = [...counts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || rankPower(b[0], levelRank) - rankPower(a[0], levelRank))
    .map(([rank, count]) => ({
      rank,
      count,
      label: `${count}张${rankLabel(rank)}`,
    }));
  const bombs = hand.length > 0
    ? structureAwareBombs(hand, levelRank).map((item) => ({
        rank: item.rank,
        count: item.count,
        label: item.rank === "JK"
          ? `${item.count}张天王炸`
          : `${item.count}张${rankLabel(item.rank)}${item.count >= 5 ? "（五炸及以上）" : "（四炸）"}`,
      }))
    : bombStacks(counts).map((item) => ({
        ...item,
        label: `${item.count}张${rankLabel(item.rank)}${item.count >= 5 ? "（五炸及以上）" : "（四炸）"}`,
      }));
  const hardRules = [
    "炸弹 = 手中四张及以上同点数；已打出的牌不算在手里。",
    "从五张（或更多）同点炸弹里打出三张后，手里不足四张，炸弹作废，只剩对子或单张。",
  ];

  const warnings = [];
  for (const choice of context.currentAdvice?.choices ?? []) {
    const play = choice.play;
    if (!play?.mainRank) continue;
    const bombBreakTypes = new Set(["Triple", "TripleWithPair"]);
    if (!bombBreakTypes.has(play.type)) continue;
    const analysis = resolveTripleRankAnalysis(context, play.mainRank, counts);
    if (analysis.wouldBreakBomb) {
      warnings.push(
        `算法候选「${play.label}」会拆${analysis.effectiveBombCount}张${rankLabel(play.mainRank)}炸弹，拆后只剩${analysis.effectiveBombCount - 3}张，炸弹作废。`,
      );
    }
  }

  return {
    bombs,
    physicalRankCounts,
    hardRules,
    recommendationWarnings: warnings,
  };
}

function normalizeRank(token) {
  const raw = String(token ?? "").toUpperCase();
  return raw === "10" ? "10" : raw;
}

/** 用户抱怨「怎么又推荐拆钢板」：质疑推荐1拆结构（非对照具体出牌） */
function isWhyRecommendBreaksPlateQuestion(question) {
  const q = String(question ?? "");
  if (!/钢板/i.test(q)) return false;
  if (/打[3-9JQKA2].*(更好|行不行|可以吗)|出[3-9JQKA2].*(更好|行不行|可以吗)/i.test(q)) {
    return false;
  }
  return /(?:怎么|为什么|为何|为啥).*(?:又|还).*(?:推荐|拆).*钢板/i.test(q)
    || /又推荐.*拆钢板/i.test(q)
    || /为什么又拆钢板/i.test(q)
    || /(?:又|还).*拆钢板/i.test(q);
}

/** 用户 meta 追问：推荐偏了/不必照抄/左侧不对（复述教练话或追问为何偏） */
function isRecommendationMetaQuestion(question) {
  const q = String(question ?? "").trim();
  if (!q) return false;
  if (/为什么|为何|为啥|怎么打|能不能|可不可以/i.test(q)
    && /三带二|钢板|单[3-9JQKA2]|拆对|拆钢板/i.test(q)) {
    return false;
  }
  return /推荐偏了|不必照抄|推荐错了|左侧不对|左侧推荐不对|推荐有问题|照抄推荐|别照抄|不用照抄|不要照抄/i.test(q);
}

/** 接风/领出：有大王时找可送单回收的散单 */
function findProbeSingleForRecovery(hand, levelRank) {
  for (const rank of rankOrder(levelRank)) {
    if (hand.filter((card) => card.rank === rank).length !== 1) continue;
    if (rank === levelRank || isControlRank(rank, levelRank)) continue;
    if (compareRanks(rank, "9", levelRank) <= 0) return rank;
  }
  return null;
}

/** meta 追问：对照当前推荐1点明偏在哪、应出什么；3–5 行 */
function answerRecommendationMetaQuestion(question, context, counts) {
  const levelRank = context.levelRank ?? "2";
  const hand = context.humanHand ?? [];
  const table = context.table ?? {};
  const mustBeat = table.lastActivePlay ?? null;
  const choices = context.currentAdvice?.choices ?? [];
  const top = choices[0];
  const topPlay = top?.play ?? top?.candidate;
  if (!topPlay) return null;

  const { brokenPlate } = resolvePlateBreak(topPlay, hand, levelRank, counts);
  if (brokenPlate) {
    return answerWhyRecommendBreaksPlate(question, context, counts);
  }

  if (mustBeat?.type === PLAY_TYPES.single) {
    const principleAnswer = buildBeatSinglePrincipleAnswer(context, counts);
    if (principleAnswer) {
      return {
        source: "rule-engine",
        mode: "why-not-play",
        text: sanitizeControlNarrative(principleAnswer.join("\n"), levelRank),
      };
    }
  }

  const hasInitiative = !mustBeat;
  if (hasInitiative) {
    const plates = findPlateGroups(hand, levelRank);
    const topLabel = topPlay.label ?? "—";
    const hasBJ = hand.some((card) => card.rank === "BJ");
    const probeRank = hasBJ ? findProbeSingleForRecovery(hand, levelRank) : null;

    if (topPlay.type === PLAY_TYPES.tripleWithPair && plates.length > 0) {
      const plateLabel = plates[0].label ?? "钢板";
      const contentLines = ["【规则引擎作答】"];
      contentLines.push(`推荐1「${topLabel}」会拆${plateLabel}，接风/领出不宜先走三带二。`);
      contentLines.push(explainPrincipleForQa("P5", { plateLabel }));
      if (probeRank && hasBJ) {
        contentLines.push(`应出单${rankLabel(probeRank)}+大王回收牌权，或直接打${plateLabel}一次减6张。`);
      } else {
        const plateAlt = findPlateAlternativeLabel(choices, hand, levelRank);
        contentLines.push(
          plateAlt
            ? (plateAlt.startsWith("直接") ? `应${plateAlt}一次减6张。` : `应出${plateAlt}一次减6张。`)
            : `应直接打${plateLabel}，不必拆成三带二。`,
        );
      }
      contentLines.push("这手左侧推荐偏了，不必照抄推荐1。");
      return {
        source: "rule-engine",
        mode: "why-not-play",
        text: sanitizeControlNarrative(contentLines.slice(0, 5).join("\n"), levelRank),
      };
    }

    if (topPlay.type === PLAY_TYPES.tripleWithPair && probeRank && hasBJ) {
      const contentLines = [
        "【规则引擎作答】",
        `推荐1「${topLabel}」偏了：有大王时可先单${rankLabel(probeRank)}试探回收牌权。`,
        explainPrincipleForQa("P6"),
        "不必照抄推荐1。",
      ];
      return {
        source: "rule-engine",
        mode: "why-not-play",
        text: sanitizeControlNarrative(contentLines.join("\n"), levelRank),
      };
    }
  }

  return null;
}

/** 候选里是否有钢板/连对成组减手 */
function findPlateAlternativeLabel(choices, hand, levelRank) {
  for (const choice of choices) {
    const play = choice.play ?? choice.candidate;
    if (play?.type === PLAY_TYPES.plane || play?.type === PLAY_TYPES.consecutivePairs
      || play?.label?.includes("钢板")) {
      return play.label ?? "钢板";
    }
  }
  const plates = findPlateGroups(hand, levelRank);
  return plates[0]?.label ? `直接打${plates[0].label}` : null;
}

/** 直答：推荐1为何又拆钢板；3–5 行，承认「又」并给替代 */
function answerWhyRecommendBreaksPlate(question, context, counts) {
  const levelRank = context.levelRank ?? "2";
  const hand = context.humanHand ?? [];
  const table = context.table ?? {};
  const mustBeat = table.lastActivePlay ?? null;
  const choices = context.currentAdvice?.choices ?? [];
  const top = choices[0];
  const topPlay = top?.play ?? top?.candidate;
  const topLabel = topPlay?.label ?? "—";
  const plates = findPlateGroups(hand, levelRank);
  const plateLabel = plates[0]?.label ?? "钢板";
  let { brokenPlate } = resolvePlateBreak(topPlay, hand, levelRank, counts);
  if (
    !brokenPlate
    && !mustBeat
    && topPlay?.type === PLAY_TYPES.tripleWithPair
    && plates.length > 0
  ) {
    brokenPlate = playOverlapsPlate(topPlay, plates)
      ?? plates.find((plate) => (plate.cards ?? []).some((card) => card.rank === topPlay.mainRank))
      ?? null;
  }
  const contentLines = ["【规则引擎作答】"];
  const userAskedAgain = /又|还/i.test(String(question ?? ""));

  if (
    mustBeat?.type === PLAY_TYPES.single
    && isPressingSmallSingleContext(mustBeat, levelRank)
    && topPlay?.type === PLAY_TYPES.single
    && !brokenPlate
  ) {
    const principleAnswer = buildBeatSinglePrincipleAnswer(context, counts);
    if (principleAnswer) {
      if (userAskedAgain) {
        principleAnswer.splice(1, 0, "拆钢板问题你提过多次，这手推荐仍需对照原则核对。");
      }
      return {
        source: "rule-engine",
        mode: "why-not-play",
        text: sanitizeControlNarrative(principleAnswer.slice(0, 5).join("\n"), levelRank),
      };
    }
  }

  if (brokenPlate) {
    const brokenLabel = brokenPlate.label ?? plateLabel;
    const beatLabel = mustBeat?.label
      ?? (mustBeat?.type === PLAY_TYPES.single ? `单${rankLabel(mustBeat.mainRank)}` : "场上牌");
    contentLines.push(
      userAskedAgain
        ? `你这问题有道理：推荐1「${topLabel}」会拆${brokenLabel}，拆钢板问题你提过多次。`
        : `推荐1「${topLabel}」会拆${brokenLabel}。`,
    );
    if (mustBeat?.type === PLAY_TYPES.single) {
      contentLines.push(explainPrincipleForQa("P4", { beatLabel, plateLabel: brokenLabel }));
      let looseRank = null;
      for (const [rank, count] of counts.entries()) {
        if (count === 1 && compareRanks(rank, mustBeat.mainRank, levelRank) > 0) {
          if (!looseRank || compareRanks(rank, looseRank, levelRank) < 0) looseRank = rank;
        }
      }
      if (!looseRank) {
        for (const rank of ["SJ", "BJ"]) {
          if (hand.some((card) => card.rank === rank)
            && compareRanks(rank, mustBeat.mainRank, levelRank) > 0) {
            looseRank = rank;
            break;
          }
        }
      }
      const looseWord = looseRank
        ? (looseRank === "BJ" ? "大王" : looseRank === "SJ" ? "小王" : `单${rankLabel(looseRank)}`)
        : null;
      contentLines.push(
        looseWord
          ? `应出${looseWord}或拆最小对子够压，保留${brokenLabel}。`
          : "应拆最小对子够压，保留钢板一次减六张。",
      );
    } else if (!mustBeat) {
      contentLines.push(explainPrincipleForQa("P5", { plateLabel: brokenLabel }));
      const hasBJ = hand.some((card) => card.rank === "BJ");
      const probeRank = hasBJ ? findProbeSingleForRecovery(hand, levelRank) : null;
      const plateAlt = findPlateAlternativeLabel(choices, hand, levelRank);
      if (probeRank && hasBJ) {
        contentLines.push(`应出单${rankLabel(probeRank)}+大王回收牌权，或直接打${brokenLabel}一次减6张。`);
      } else {
        contentLines.push(
          plateAlt
            ? (plateAlt.startsWith("直接") ? `应${plateAlt}一次减6张。` : `应出${plateAlt}一次减6张。`)
            : `有完整${brokenLabel}时应直接打钢板，不必拆成三带二。`,
        );
      }
    } else {
      contentLines.push(explainPrincipleForQa("P4", { beatLabel, plateLabel: brokenLabel }));
    }
    contentLines.push("这手左侧推荐偏了，不必照抄推荐1。");
    const altParts = [];
    const plateAlt = findPlateAlternativeLabel(choices, hand, levelRank);
    if (plateAlt && !topLabel.includes(plateAlt.replace(/^直接打/, ""))) altParts.push(plateAlt);
    if (mustBeat?.type === PLAY_TYPES.single) {
      let altRank = null;
      for (const [rank, count] of counts.entries()) {
        if (count === 1 && compareRanks(rank, mustBeat.mainRank, levelRank) > 0) {
          if (!altRank || compareRanks(rank, altRank, levelRank) < 0) altRank = rank;
        }
      }
      if (!altRank) {
        for (const rank of ["SJ", "BJ"]) {
          if (hand.some((card) => card.rank === rank)
            && compareRanks(rank, mustBeat.mainRank, levelRank) > 0) {
            altRank = rank;
            break;
          }
        }
      }
      if (altRank) {
        const altWord = altRank === "BJ" ? "大王" : altRank === "SJ" ? "小王" : `单${rankLabel(altRank)}`;
        const matched = findSingleCandidate(choices, altRank);
        altParts.push(matched ? `${altWord}（候选第${matched.index + 1}位）` : altWord);
      }
    }
    if (choices.some((c) => (c.play ?? c.candidate)?.type === PLAY_TYPES.pass)) {
      altParts.push("过牌等循环");
    }
    if (altParts.length > 0 && contentLines.length < 5) {
      contentLines.push(`可看：${altParts.slice(0, 3).join("、")}。`);
    }
  } else {
    contentLines.push(`推荐1「${topLabel}」并未拆${plateLabel}。`);
    if (plates.length > 0) {
      contentLines.push(`你手上有${plateLabel}；若想一次减6张可直接打钢板。`);
    }
    if (userAskedAgain) {
      contentLines.push("若仍觉得推荐在拆结构，请对照左侧候选具体牌型。");
    }
  }

  return {
    source: "rule-engine",
    mode: "why-not-play",
    text: sanitizeControlNarrative(contentLines.slice(0, 5).join("\n"), levelRank),
  };
}

/** 追问接风/领出为何不直接打钢板、或为何要拆钢板 */
function isWhyNotPlateQuestion(question) {
  const q = String(question ?? "");
  if (!/钢板|飞机/i.test(q)) return false;
  // 用户在对比其他具体出牌（如「打Q不是更好吗」）时走 why-not-play 对照路由
  if (/打[3-9JQKA2].*(更好|行不行|可以吗)|出[3-9JQKA2].*(更好|行不行|可以吗)/i.test(q)) {
    return false;
  }
  return /为什么不打|为何不打|怎么不打|为啥不打|不能直接|不可以直接|能不能打|可以打钢板|不打钢板/i.test(q)
    || /为什么要拆|为何拆|为啥拆|为什么拆|拆钢板/i.test(q);
}

/** 接风/领出：为何不直接打钢板、或为何拆钢板 */
function answerWhyNotPlateQuestion(question, context, counts) {
  const levelRank = context.levelRank ?? "2";
  const hand = context.humanHand ?? [];
  const table = context.table ?? {};
  const mustBeat = table.lastActivePlay;
  const isFollowingSingle = mustBeat?.type === PLAY_TYPES.single;
  const plates = findPlateGroups(hand, levelRank);
  const top = context.currentAdvice?.choices?.[0];
  const topPlay = top?.play ?? top?.candidate;
  const topLabel = topPlay?.label ?? "—";
  const contentLines = ["【规则引擎作答】"];

  if (plates.length === 0) {
    if (isFollowingSingle && isPressingSmallSingleContext(mustBeat, levelRank)) {
      const principleAnswer = buildBeatSinglePrincipleAnswer(context, counts);
      if (principleAnswer) {
        return {
          source: "rule-engine",
          mode: "why-not-play",
          text: sanitizeControlNarrative(principleAnswer.join("\n"), levelRank),
        };
      }
    }
    contentLines.push("当前手牌理牌后未见完整钢板。");
    if (topLabel !== "—") contentLines.push(`推荐1「${topLabel}」。`);
    return {
      source: "rule-engine",
      mode: "why-not-play",
      text: sanitizeControlNarrative(contentLines.join("\n"), levelRank),
    };
  }

  const plateLabel = plates[0].label ?? "钢板";
  const { brokenPlate } = resolvePlateBreak(topPlay, hand, levelRank, counts);
  const topIsPlate = topPlay?.type === PLAY_TYPES.plane || topPlay?.label?.includes("钢板");

  if (isFollowingSingle && (brokenPlate || isPressingSmallSingleContext(mustBeat, levelRank))) {
    const principleAnswer = buildBeatSinglePrincipleAnswer(context, counts);
    if (principleAnswer) {
      if (brokenPlate) {
        principleAnswer.push(`推荐1「${topLabel}」若拆${plateLabel}，是策略失误。`);
      }
      return {
        source: "rule-engine",
        mode: "why-not-play",
        text: sanitizeControlNarrative(principleAnswer.join("\n"), levelRank),
      };
    }
    const beatLabel = mustBeat.label ?? `单${rankLabel(mustBeat.mainRank)}`;
    contentLines.push(explainPrincipleForQa("P4", { beatLabel, plateLabel }));
    contentLines.push("应优先出散牌单张或拆最小对子够压，保留钢板一次减六张。");
    contentLines.push(`推荐1「${topLabel}」若拆钢板，是策略失误；请看候选里的散牌单张或对子拆单。`);
    return {
      source: "rule-engine",
      mode: "why-not-play",
      text: sanitizeControlNarrative(contentLines.join("\n"), levelRank),
    };
  }

  if (topIsPlate) {
    contentLines.push(`可以直接打${plateLabel}，推荐1就是${topLabel}。`);
    contentLines.push("钢板一次减6张，接风/领出时减手效率最高，不必拆成三带二。");
  } else if (brokenPlate) {
    contentLines.push(`接风/领出有${plateLabel}时，应优先打钢板一次减6张。`);
    contentLines.push(`推荐1「${topLabel}」若拆钢板，是策略失误；请看候选里的钢板。`);
    contentLines.push("只有无钢板或残局抢速度时，才考虑拆钢板组三带二。");
  } else {
    contentLines.push(`你手上有${plateLabel}，推荐1「${topLabel}」未动到这块钢板。`);
    contentLines.push(`若想一次减6张，可直接打${plateLabel}。`);
  }

  return {
    source: "rule-engine",
    mode: "why-not-play",
    text: sanitizeControlNarrative(contentLines.join("\n"), levelRank),
  };
}

/** 追问为何推荐 222+J 等三带二 */
function isWhyRecommendTripleQuestion(question) {
  return /为什么.*(?:222|三个2|三带二).*(?:带|和|\+|J)|为什么推荐.*(?:222|三带二)|为啥.*222.*带/i.test(String(question ?? ""));
}

/** 用户在质疑「为何不打某手具体出牌」vs 左侧推荐1 */
function isWhyNotPlayQuestion(question) {
  const q = String(question ?? "");
  if (isWhyRecommendTripleQuestion(q)) return true;
  if (isWhyNotUsePairQuestion(q)) return false;
  if (isWhyPlayBreaksStraightQuestion(q)) return false;
  if (isWhyBreakStraightForBombQuestion(q)) return false;
  if (isWhyBreakStraightFlushForBombQuestion(q)) return false;
  if (isWhyStraightChoiceQuestion(q)) return false;
  if (isWhyTriplePairBreaksStraightQuestion(q)) return false;
  const contrast = /为什么不打|为何不打|怎么不打|为啥不打|为什么不推荐|为何不推荐|怎么不推荐|为什么推荐|为何推荐|为什么要打|为何要打|为啥要打|为什么(?:不|没|别)(?:出|打|走)|为何(?:不|没|别)(?:出|打|走)|不是更好|更好吗|不好吗|为啥.*拆|为什么.*拆|拆.*对子|拆了.*对/i.test(q);
  const feasibility = /行不行|能不能打|能不能出|可不可以|可不可以出|能出吗|可以出吗|能这样打吗/i.test(q);
  const playDesc = /三带二|三带|3带|三张|三个|带对|对[3-9JQKA2]|单张|对子|顺子|组顺|钢板|连对|飞机|炸弹|打[3-9JQKA2]|出[3-9JQKA2]|[3-9JQKA2]{1,2}/i.test(q);
  return (contrast || feasibility) && playDesc;
}

/** 用户质疑：手里有散牌单张，为何还要拆对/钢板 */
function isWhyBreakInsteadOfLooseSingleQuestion(question) {
  const q = String(question ?? "");
  // 「为什么要打Q」等对照追问走 why-play 路由
  if (/(?:为什么|为何|为啥|怎么)\s*(?:要)?打\s*[3-9JQKA2]/i.test(q)) return false;
  if (/有\s*单[3-9JQKA2]/i.test(q)) return true;
  if (/有\s*散[3-9JQKA2]/i.test(q)) return true;
  if (/有单[3-9JQKA2].*不打|单[3-9JQKA2].*不打/i.test(q)) return true;
  if (/单[3-9JQKA2].*(为什么|为何|为啥).*(拆|出)/i.test(q)) return true;
  if (/为什么.*拆对|拆对.*(为什么|为何|为啥)/i.test(q)) return true;
  if (/散[3-9JQKA2].*(为什么|为何|为啥).*(出|打)/i.test(q)) return true;
  if (/为什么.*拆.*(钢板|对[3-9JQKA2]|对子)/i.test(q)) return true;
  return false;
}

function findLooseSingleBeaterRank(hand, counts, mustBeat, levelRank, question) {
  const q = String(question ?? "");
  const mentioned = q.match(/单([3-9]|10|J|Q|K|A|2)/i);
  if (mentioned) {
    const rank = normalizeRank(mentioned[1]);
    if ((counts.get(rank) ?? 0) === 1 && compareRanks(rank, mustBeat.mainRank, levelRank) > 0) {
      return rank;
    }
  }
  for (const [rank, count] of counts.entries()) {
    if (count === 1 && compareRanks(rank, mustBeat.mainRank, levelRank) > 0) {
      return rank;
    }
  }
  return null;
}

/** 有散牌单张可压小单时，解释为何不应拆结构 */
function answerWhyBreakInsteadOfLooseSingleQuestion(question, context, counts) {
  const table = context.table ?? {};
  const mustBeat = table.lastActivePlay ?? null;
  if (mustBeat?.type !== PLAY_TYPES.single) return null;

  const levelRank = context.levelRank ?? "2";
  const hand = context.humanHand ?? [];
  const looseRank = findLooseSingleBeaterRank(hand, counts, mustBeat, levelRank, question);
  if (!looseRank) return null;
  if (!isWhyBreakInsteadOfLooseSingleQuestion(question)) return null;

  const top = context.currentAdvice?.choices?.[0];
  const topPlay = top?.play ?? top?.candidate;
  const topBreaksPair = topPlay?.type === PLAY_TYPES.single
    && resolvePairBreakForSingle(topPlay.mainRank, hand, levelRank, counts).breaksPair;
  const { brokenPlate } = resolvePlateBreak(topPlay, hand, levelRank, counts);
  if (!topBreaksPair && !brokenPlate && topPlay?.mainRank === looseRank) {
    const beatLabel = mustBeat.label ?? `单${rankLabel(mustBeat.mainRank)}`;
    return {
      source: "rule-engine",
      mode: "why-not-play",
      text: sanitizeControlNarrative(
        [
          "【规则引擎作答】",
          `原则P1（散单优先）：跟牌压${beatLabel}，你手里有散单${rankLabel(looseRank)}，推荐1就是单${rankLabel(looseRank)}，请直接出。`,
        ].join("\n"),
        levelRank,
      ),
    };
  }

  const principleLines = buildBeatSinglePrincipleAnswer(context, counts, {
    preferredLooseRank: looseRank,
  });
  if (!principleLines) return null;

  return {
    source: "rule-engine",
    mode: "why-not-play",
    text: sanitizeControlNarrative(principleLines.join("\n"), levelRank),
  };
}

/** 解析「为什么要打X / 拆对子 / 打Y不好吗」类追问 */
function parseWhyPlayQuestion(question) {
  const text = String(question ?? "");
  const questioned = text.match(/(?:为什么|为何|为啥|怎么)\s*(?:要)?打\s*([3-9]|10|J|Q|K|A|2)/i);
  const breaksPair = /拆.*对子|拆了.*对|拆对/i.test(text);
  const alternative = text.match(
    /(?:打|出)\s*([3-9]|10|J|Q|K|A|2)\s*(?:不是更好|更好吗|不好吗|行不行|可以吗)/i,
  );
  return {
    questionedRank: questioned ? normalizeRank(questioned[1]) : null,
    breaksPairMentioned: breaksPair,
    alternativeRank: alternative ? normalizeRank(alternative[1]) : null,
  };
}

/** 推荐单张是否会拆掉理牌后的对子 */
function resolvePairBreakForSingle(rank, hand, levelRank, counts) {
  const held = counts.get(rank) ?? 0;
  if (held < 2) {
    return { breaksPair: false, pairLabel: null, held };
  }
  const groups = buildStrategicGroups(hand, levelRank);
  const pairGroup = groups.find(
    (group) => group.play?.type === PLAY_TYPES.pair && group.play?.mainRank === rank,
  );
  if (pairGroup) {
    return { breaksPair: true, pairLabel: pairGroup.label ?? `对${rankLabel(rank)}`, held };
  }
  if (held === 2) {
    return { breaksPair: true, pairLabel: `对${rankLabel(rank)}`, held };
  }
  return { breaksPair: false, pairLabel: null, held };
}

/** 是否追问「打 X 会不会拆顺子 / 怎么打 X」 */
function isWhyPlayBreaksStraightQuestion(question) {
  const q = String(question ?? "");
  if (/拆.*顺子|顺子.*拆/i.test(q) && /打\s*[3-9JQKA2]|出\s*[3-9JQKA2]/i.test(q)) return true;
  if (/打\s*([3-9]|10|J|Q|K|A|2)\s*不是.*拆.*顺/i.test(q)) return true;
  if (/怎么打\s*([3-9]|10|J|Q|K|A|2)/i.test(q)) return true;
  if (/[3-9JQKA2]\s*不是.*拆.*顺/i.test(q)) return true;
  if (/打[3-9JQKA2].*拆.*顺|顺.*打[3-9JQKA2]/i.test(q)) return true;
  return false;
}

function parseStraightFocusRank(question, topPlay) {
  const q = String(question ?? "");
  const patterns = [
    /怎么打\s*([3-9]|10|J|Q|K|A|2)/i,
    /打\s*([3-9]|10|J|Q|K|A|2)\s*不是.*拆.*顺/i,
    /打\s*([3-9]|10|J|Q|K|A|2).*(?:拆|是).*顺子/i,
    /(?:为什么|为何|为啥)\s*打\s*([3-9]|10|J|Q|K|A|2)/i,
  ];
  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (match) return normalizeRank(match[1]);
  }
  if (topPlay?.type === PLAY_TYPES.single && topPlay.mainRank) {
    return topPlay.mainRank;
  }
  return null;
}

function findSafeLooseBeaterRank(hand, counts, mustBeat, levelRank) {
  if (mustBeat?.type !== PLAY_TYPES.single) return null;
  let best = null;
  for (const [rank, count] of counts.entries()) {
    if (rank === "SJ" || rank === "BJ") continue;
    if (count !== 1 || compareRanks(rank, mustBeat.mainRank, levelRank) <= 0) continue;
    if (resolveStraightBreakForSingle(rank, hand, levelRank).breaksStraight) continue;
    if (!best || compareRanks(rank, best, levelRank) < 0) best = rank;
  }
  return best;
}

/** 找不拆顺子的散单（不要求能压 mustBeat，用于「怎么打5拆顺子」类追问） */
function findSafeLooseSingleExcluding(hand, counts, levelRank, excludeRank = null) {
  let best = null;
  for (const [rank, count] of counts.entries()) {
    if (rank === "SJ" || rank === "BJ" || rank === excludeRank) continue;
    if (count !== 1) continue;
    if (resolveStraightBreakForSingle(rank, hand, levelRank).breaksStraight) continue;
    if (!best || compareRanks(rank, best, levelRank) < 0) best = rank;
  }
  return best;
}

/** 直接回答打 X 是否拆顺子，并说明为何不拆结构的散单更优 */
function answerWhyPlayBreaksStraightQuestion(question, context, counts) {
  const choices = context.currentAdvice?.choices ?? [];
  const top = choices[0];
  const topPlay = top?.play ?? top?.candidate;
  const focusRank = parseStraightFocusRank(question, topPlay);
  if (!focusRank) return null;

  const levelRank = context.levelRank ?? "2";
  const hand = context.humanHand ?? [];
  const table = context.table ?? {};
  const mustBeat = table.lastActivePlay ?? null;
  const { breaksStraight, straightLabel } = resolveStraightBreakForSingle(focusRank, hand, levelRank);
  const focusShort = compactSingleLabel(focusRank);
  const beatLabel = mustBeat?.type === PLAY_TYPES.single
    ? (mustBeat.label ?? `单${rankLabel(mustBeat.mainRank)}`)
    : null;
  let safeLoose = findSafeLooseBeaterRank(hand, counts, mustBeat, levelRank);
  if (!safeLoose && breaksStraight) {
    safeLoose = findSafeLooseSingleExcluding(hand, counts, levelRank, focusRank);
  }
  const safeAlts = [];
  for (let i = 0; i < Math.min(choices.length, 3); i++) {
    const play = choices[i].play ?? choices[i].candidate;
    if (play?.type !== PLAY_TYPES.single || play.mainRank === focusRank) continue;
    if (!resolveStraightBreakForSingle(play.mainRank, hand, levelRank).breaksStraight) {
      safeAlts.push(play.mainRank);
    }
  }

  const contentLines = [];
  if (breaksStraight) {
    contentLines.push(`是，打${focusShort}会拆${straightLabel ?? "顺子"}。`);
    if (mustBeat?.type === PLAY_TYPES.single) {
      const principleLines = buildBeatSinglePrincipleAnswer(context, counts, {
        preferredLooseRank: safeLoose ?? undefined,
      });
      if (principleLines?.length > 1) {
        const answerText = sanitizeControlNarrative(
          [`是，打${focusShort}会拆${straightLabel ?? "顺子"}。`, ...principleLines.slice(1)].slice(0, 4).join("\n"),
          levelRank,
        );
        return { source: "rule-engine", mode: "why-not-play", text: answerText };
      }
    }
  } else {
    contentLines.push(`否，打${focusShort}不拆理牌后的顺子。`);
    if (topPlay?.mainRank === focusRank) {
      contentLines.push(`推荐1就是单${rankLabel(focusRank)}，可以出。`);
    }
    const answerText = sanitizeControlNarrative(
      ["【规则引擎作答】", ...contentLines].join("\n"),
      levelRank,
    );
    return { source: "rule-engine", mode: "why-not-play", text: answerText };
  }

  if (safeLoose && safeLoose !== focusRank) {
    const safeShort = compactSingleLabel(safeLoose);
    if (beatLabel) {
      contentLines.push(
        `原则P1（散单优先）：跟牌压${beatLabel}，有${safeShort}不拆结构，应出单${rankLabel(safeLoose)}而非${focusShort}。`,
      );
    } else {
      contentLines.push(
        `原则P1（散单优先）：有${safeShort}不拆结构，应出单${rankLabel(safeLoose)}，不必打${focusShort}。`,
      );
    }
  } else if (safeAlts.length > 0) {
    const altText = safeAlts.map((rank) => rankLabel(rank)).join("、");
    contentLines.push(`候选里有单${altText}不拆顺子，优先这些散单。`);
  } else {
    contentLines.push("原则P1（散单优先）：无更小不拆顺子的散单时，才考虑拆结构跟牌。");
  }

  if (topPlay?.mainRank === focusRank && safeLoose && safeLoose !== focusRank) {
    const safeIdx = findSingleCandidate(choices, safeLoose)?.index ?? -1;
    if (safeIdx > 0) {
      contentLines.push(`单${rankLabel(safeLoose)}在候选第${safeIdx + 1}位，请出单${rankLabel(safeLoose)}。`);
    } else {
      contentLines.push(`推荐1偏了，请出单${rankLabel(safeLoose)}。`);
    }
  }

  const answerText = sanitizeControlNarrative(
    ["【规则引擎作答】", ...contentLines.slice(0, 4)].join("\n"),
    levelRank,
  );
  return { source: "rule-engine", mode: "why-not-play", text: answerText };
}

/** 五炸抢权后接风，为何还让打顺子/同花顺 */
function isWhyBombControlThenGroupQuestion(question) {
  const q = String(question ?? "");
  if (!/取牌权|抢风|牌权|取道牌权/.test(q)) return false;
  if (!/五个?Q|5个Q|五炸/i.test(q)) return false;
  return /同花顺|顺子|打.*顺|让我打/i.test(q);
}

function answerWhyBombControlThenGroupQuestion(context) {
  const top = context.currentAdvice?.choices?.[0];
  const topPlay = top?.play ?? top?.candidate;
  const lines = [
    "【规则引擎作答】",
    "",
    "结论：你的质疑对——刚用五炸Q抢过牌权，接风这手不应再推弱杂顺。",
    "原则P5：接风优先成组减手，应走黑桃同花顺一次出五张，或连对减手，不宜裸对子或逢人配凑杂顺拆掉红桃同花顺。",
  ];
  if (topPlay?.type === PLAY_TYPES.straight) {
    lines.push(`推荐1「${playShortLabel(topPlay)}」会拆结构，偏了。`);
  } else if (
    topPlay?.type === PLAY_TYPES.straightFlush
    || topPlay?.type === PLAY_TYPES.consecutivePairs
  ) {
    lines.push(`推荐1「${playShortLabel(topPlay)}」符合接风减手节奏。`);
  } else if (topPlay?.label) {
    lines.push(`推荐1「${playShortLabel(topPlay)}」请对照是否一次减够手数。`);
  }
  return { source: "rule-engine", mode: "why-bomb-then-group", text: lines.join("\n") };
}

/** 是否追问「为何拆同花顺凑四炸/五炸」 */
function isWhyBreakStraightFlushForBombQuestion(question) {
  const q = String(question ?? "");
  if (!/同花顺/i.test(q)) return false;
  return /拆.*同花顺|同花顺.*拆|凑.*炸|组.*炸|四个?[3-9JQKA2]|四张?[3-9JQKA2]/i.test(q)
    || /为什么.*(?:让|要).*拆/i.test(q);
}

function parseStraightFlushBombRank(question, counts) {
  const q = String(question ?? "");
  const explicit = q.match(/四个?([3-9]|10|J|Q|K|A|2)|四张?([3-9]|10|J|Q|K|A|2)/i);
  if (explicit) return normalizeRank(explicit[1] ?? explicit[2]);
  const groupBombMatch = q.match(/凑.*?([3-9]|10|J|Q|K|A|2).*?炸/i);
  if (groupBombMatch) return normalizeRank(groupBombMatch[1]);
  return parseBombRankFromBreakQuestion(question, counts);
}

/** 该炸是否动用同花顺里的牌 */
function playBreaksStraightFlush(play, hand, levelRank) {
  if (!play || !BOMB_PLAY_TYPES.has(play.type)) return null;
  const bombRank = play.mainRank;
  if (!bombRank || bombRank === "SJ" || bombRank === "BJ") return null;
  const groups = buildStrategicGroups(hand, levelRank);
  const sfGroup = groups.find((group) => group.play?.type === PLAY_TYPES.straightFlush);
  if (!sfGroup) return null;
  const sfRankCards = (sfGroup.cards ?? []).filter((card) => card.rank === bombRank);
  if (sfRankCards.length === 0) return null;
  const playIds = new Set((play.cards ?? []).map((card) => cardId(card)));
  const usesLocked = sfRankCards.some((card) => playIds.has(cardId(card)));
  if (!usesLocked) return null;
  const availability = explainRankAvailability(hand, bombRank, levelRank);
  return {
    bombRank,
    sfLabel: sfGroup.label ?? "同花顺",
    lockedSummary: availability.summary,
    effectiveBombCount: availability.effectiveBombCount,
    total: availability.total,
  };
}

function resolveStraightFlushBombConflict(hand, levelRank, bombRank) {
  const groups = buildStrategicGroups(hand, levelRank);
  const sfGroup = groups.find((group) => group.play?.type === PLAY_TYPES.straightFlush);
  if (!sfGroup) return null;
  const hasRankInSf = (sfGroup.cards ?? []).some((card) => card.rank === bombRank);
  if (!hasRankInSf) return null;
  const availability = explainRankAvailability(hand, bombRank, levelRank);
  return {
    bombRank,
    sfLabel: sfGroup.label ?? "同花顺",
    lockedSummary: availability.summary,
    effectiveBombCount: availability.effectiveBombCount,
    total: availability.total,
  };
}

/** 拆同花顺凑炸：正面回应用户质疑并给替代炸 */
function answerWhyBreakStraightFlushForBombQuestion(question, context, counts) {
  if (!isWhyBreakStraightFlushForBombQuestion(question)) return null;

  const levelRank = context.levelRank ?? "2";
  const hand = context.humanHand ?? [];
  const table = context.table ?? {};
  const mustBeat = table.lastActivePlay ?? null;
  const bombRank = parseStraightFlushBombRank(question, counts);
  const choices = context.currentAdvice?.choices ?? [];
  const top = choices[0];
  const topPlay = top?.play ?? top?.candidate;
  const breakInfo = playBreaksStraightFlush(topPlay, hand, levelRank)
    ?? (bombRank ? resolveStraightFlushBombConflict(hand, levelRank, bombRank) : null);
  const contentLines = ["【规则引擎作答】"];

  if (!breakInfo) {
    const sfGroup = buildStrategicGroups(hand, levelRank).find((group) => group.play?.type === PLAY_TYPES.straightFlush);
    if (sfGroup) {
      contentLines.push(`你手里有${sfGroup.label ?? "同花顺"}；若左侧推荐未动用其中牌，则不算拆同花顺。`);
    } else {
      contentLines.push("当前理牌后未见完整同花顺，请对照左侧具体推荐。");
    }
    return {
      source: "rule-engine",
      mode: "why-break-bomb-structure",
      text: sanitizeControlNarrative(contentLines.join("\n"), levelRank),
    };
  }

  const { bombRank: rank, sfLabel, lockedSummary, effectiveBombCount } = breakInfo;
  contentLines.push(`你的理解对：出四炸${rankLabel(rank)}会拆${sfLabel}，不应为凑炸拆掉同花顺。`);
  if (lockedSummary) {
    contentLines.push(
      `${lockedSummary}；理牌后整炸${rankLabel(rank)}仅${effectiveBombCount ?? 0}张，凑四炸必动同花顺。`,
    );
  }

  const altBombChoice = choices.find((choice, index) => {
    if (index === 0) return false;
    const play = choice.play ?? choice.candidate;
    return play && BOMB_PLAY_TYPES.has(play.type) && !playBreaksStraightFlush(play, hand, levelRank);
  });
  const pressingJoker = mustBeat?.type === PLAY_TYPES.single
    && (mustBeat.mainRank === "BJ" || mustBeat.mainRank === "SJ");
  const beatLabel = mustBeat?.label ?? (pressingJoker ? "王" : null);

  if (pressingJoker) {
    if (altBombChoice) {
      const altPlay = altBombChoice.play ?? altBombChoice.candidate;
      const altLabel = bombPlayLabel(altPlay);
      contentLines.push(`压${beatLabel}应优先${altLabel}，保留同花顺给关键控权。`);
    } else {
      const bombs = structureAwareBombs(hand, levelRank).filter((item) => item.rank !== rank);
      const alt = bombs.find((item) => item.count >= 4);
      if (alt) {
        contentLines.push(
          `更宜用${itemLabel(alt)}压王，不必拆同花顺凑${rankLabel(rank)}炸。`,
        );
      } else {
        contentLines.push("须压王时若无其它整炸，再评估是否值得拆同花顺；默认应保留。");
      }
    }
  } else if (altBombChoice) {
    const altPlay = altBombChoice.play ?? altBombChoice.candidate;
    const altLabel = bombPlayLabel(altPlay);
    contentLines.push(`可看候选「${altLabel}」，不必拆同花顺凑${rankLabel(rank)}炸。`);
  } else {
    contentLines.push("原则P7：同花顺战略价值高于裸凑四炸，不宜为普通压牌拆掉。");
  }

  const answerText = sanitizeControlNarrative(contentLines.slice(0, 5).join("\n"), levelRank);
  return { source: "rule-engine", mode: "why-break-bomb-structure", text: answerText };
}

function itemLabel(bombItem) {
  if (!bombItem) return "整炸";
  if (bombItem.rank === "JK") return "王炸";
  return `${bombItem.count}张${rankLabel(bombItem.rank)}炸`;
}

function bombPlayLabel(play) {
  if (!play) return "—";
  if (play.label) return play.label;
  const size = play.bombSize ?? play.length ?? play.cards?.length ?? 4;
  return `四炸${rankLabel(play.mainRank)}${size > 4 ? `（${size}张）` : ""}`;
}

/** 是否追问「为何拆顺子 + 四炸7后剩两个7怎么办」 */
function isWhyBreakStraightForBombQuestion(question) {
  const q = String(question ?? "");
  const mentionsBreakStraight = /拆.*顺子|顺子.*拆/i.test(q);
  const mentionsBombSeven = /四个?7|四张?7|打了.*7|7.*炸弹|炸弹.*7/i.test(q);
  const mentionsRemainingSeven = /剩下|剩余|两个7|剩.*7/i.test(q);
  if (mentionsBreakStraight && (mentionsBombSeven || mentionsRemainingSeven)) return true;
  if (/打了四个7|四个7.*剩下|四张7.*剩/i.test(q)) return true;
  return false;
}

function parseBombRankFromBreakQuestion(question, counts) {
  const q = String(question ?? "");
  const explicit = q.match(/四个?([3-9]|10|J|Q|K|A|2)|四张?([3-9]|10|J|Q|K|A|2)/i);
  if (explicit) return normalizeRank(explicit[1] ?? explicit[2]);
  for (const [rank, count] of counts.entries()) {
    if (count >= 6) return rank;
  }
  for (const [rank, count] of counts.entries()) {
    if (count >= 4) return rank;
  }
  return null;
}

/** 拆顺子 + 四炸后剩余结构：用 buildStrategicGroups 解释 */
function answerWhyBreakStraightForBombQuestion(question, context, counts) {
  if (!isWhyBreakStraightForBombQuestion(question)) return null;

  const levelRank = context.levelRank ?? "2";
  const hand = context.humanHand ?? [];
  const table = context.table ?? {};
  const mustBeat = table.lastActivePlay ?? null;
  const bombRank = parseBombRankFromBreakQuestion(question, counts);
  if (!bombRank) return null;

  const held = counts.get(bombRank) ?? 0;
  const groups = buildStrategicGroups(hand, levelRank);
  const straightGroup = groups.find((group) => group.play?.type === PLAY_TYPES.straight);
  const straightLabel = straightGroup?.label ?? straightGroup?.play?.label ?? "顺子";
  const bombGroup = groups.find(
    (group) => group.play?.type === PLAY_TYPES.bomb && group.play?.mainRank === bombRank,
  );
  const pairGroup = groups.find(
    (group) => group.play?.type === PLAY_TYPES.pair && group.play?.mainRank === bombRank,
  );
  const contentLines = ["【规则引擎作答】"];

  const physicalHeld = hand.filter((card) => card.rank === bombRank).length || held;

  if (mustBeat?.type === PLAY_TYPES.single) {
    const safeLoose = findSafeLooseBeaterRank(hand, counts, mustBeat, levelRank)
      ?? findSafeLooseSingleExcluding(hand, counts, levelRank, null);
    const beatLabel = mustBeat.label ?? `单${rankLabel(mustBeat.mainRank)}`;
    if (safeLoose) {
      contentLines.push(
        `原则P1（散单优先）：不应为出炸拆顺子；压${beatLabel}有散单${rankLabel(safeLoose)}，应出单${rankLabel(safeLoose)}。`,
      );
    } else {
      contentLines.push(`原则P1：跟牌优先不拆${straightLabel}，不必为出炸拆顺子。`);
    }
  } else if (mustBeat?.type === PLAY_TYPES.straight) {
    const beatLabel = mustBeat.label ?? "顺子";
    const hasOwnStraight = Boolean(straightGroup);
    if (physicalHeld > 4) {
      contentLines.push(
        `原则P7（满张控权）：压${beatLabel}只有炸弹能跟，你有${physicalHeld}张${rankLabel(bombRank)}，应一次出满张炸弹控牌权。`,
      );
      contentLines.push(
        `四炸牌力弱，易被更大炸或同花顺反压；满张${physicalHeld}炸更稳，后续才好出牌。`,
      );
    } else {
      contentLines.push(
        `原则P7（最小够压炸）：压${beatLabel}只有炸弹能跟，四炸${rankLabel(bombRank)}够压。`,
      );
    }
    if (hasOwnStraight) {
      contentLines.push(
        `你手里有${straightLabel}；出炸是压对手顺子抢牌权，不是为了拆自己的顺子。`,
      );
    } else {
      contentLines.push(
        `你手里没有顺子可拆——出炸是压对手${beatLabel}，并非拆顺子。`,
      );
    }
  } else {
    contentLines.push(`原则P1/P4：不应为出炸或跟牌拆${straightLabel}，优先保留成组结构。`);
  }

  if (physicalHeld >= 4) {
    const structParts = [];
    if (bombGroup) structParts.push(bombGroup.label ?? `四炸${rankLabel(bombRank)}`);
    if (pairGroup) structParts.push(pairGroup.label ?? `对${rankLabel(bombRank)}`);
    if (structParts.length > 0) {
      contentLines.push(`物理手牌 ${physicalHeld} 张${rankLabel(bombRank)}：${structParts.join(" + ")}。`);
    } else {
      contentLines.push(`物理手牌 ${physicalHeld} 张${rankLabel(bombRank)}，打出四张后按炸弹/对子分组。`);
    }
  }

  const afterFour = physicalHeld - 4;
  if (physicalHeld > 4 && mustBeat?.type === PLAY_TYPES.straight) {
    contentLines.push(
      `一次出满张${physicalHeld}张${rankLabel(bombRank)}，炸弹厚度最大；拆成四炸剩${afterFour}张，牌权易被抢。`,
    );
  } else if (afterFour === 2) {
    contentLines.push(
      `打出四张${rankLabel(bombRank)}后剩物理2张→对${rankLabel(bombRank)}，可继续减手。`,
    );
  } else if (afterFour === 1) {
    contentLines.push(`打出四炸后剩1张${rankLabel(bombRank)}散单，炸弹厚度已失。`);
  } else if (afterFour >= 4) {
    contentLines.push(`打出四炸后还剩${afterFour}张${rankLabel(bombRank)}，仍够续炸。`);
  } else if (afterFour === 3) {
    contentLines.push(`打出四炸后剩3张${rankLabel(bombRank)}，可作三同张减手，但不再是整炸。`);
  }

  const answerText = sanitizeControlNarrative(contentLines.slice(0, 5).join("\n"), levelRank);
  return { source: "rule-engine", mode: "why-break-bomb-structure", text: answerText };
}

/** 是否追问「为什么不用对K / 却要拆三个6」 */
function isWhyNotUsePairQuestion(question) {
  const q = String(question ?? "");
  if (isWhyPreferPairOverTripleBreakQuestion(q)) return false;
  if (/为什么不用对[3-9JQKA2]|为何不用对[3-9JQKA2]|怎么不用对[3-9JQKA2]/i.test(q)) return true;
  if (/为什么不.*(用|出).*对[3-9JQKA2]/i.test(q)) return true;
  if (/这里为什么不用对[3-9JQKA2]/i.test(q)) return true;
  if (/而.*拆.*(三个?|3个?)[3-9JQKA2]/i.test(q)) return true;
  if (/却要拆.*(三个?|3个?)[3-9JQKA2]/i.test(q)) return true;
  if (/拆.*(三个?|3个?)[3-9JQKA2].*(?:组对|作对|当对|出对|对子)/i.test(q)) return true;
  if (/不用对[3-9JQKA2].*拆.*(三个?|3个?)/i.test(q)) return true;
  if (/留对.*(三个?|3个?)[3-9JQKA2]|(三个?|3个?)[3-9JQKA2].*留对|三带二.*留对/i.test(q)) return true;
  return false;
}

/** 从「有对5和对Q可以带」等句式提取可配对子点数 */
function parseAlternativePairRanksFromQuestion(question) {
  const q = String(question ?? "");
  const ranks = [];
  const dual = q.match(/有对([3-9]|10|J|Q|K|A|2)和对([3-9]|10|J|Q|K|A|2)/i);
  if (dual) {
    ranks.push(normalizeRank(dual[1]), normalizeRank(dual[2]));
  } else {
    const single = q.match(/有对([3-9]|10|J|Q|K|A|2)/i);
    if (single) ranks.push(normalizeRank(single[1]));
  }
  return [...new Set(ranks.filter(Boolean))];
}

/** 是否追问「应带对J / 不应拆三个8」或「有对5和对Q可以带」类三带二带牌取舍 */
function isWhyPreferPairOverTripleBreakQuestion(question) {
  const q = String(question ?? "");
  // 仅匹配「带对X」主张，排除「不用对K」类压对追问
  const hasPairPref = /应该.*带对[3-9JQKA2]|直接带对[3-9JQKA2]|(?:^|[^不别没])带对[3-9JQKA2]/i.test(q);
  const hasTripleBreak = /(?:不应该|别|不要|不该).*(?:拆|破).*(?:三个?|3个?)\s*[3-9JQKA2]/i.test(q)
    || /拆(?:三个?|3个?)\s*[3-9JQKA2]/i.test(q)
    || /(?:怎么|为什么|为何|为啥).*(?:还是|还).*(?:拆|破).*三个?\s*[3-9JQKA2]/i.test(q);
  if (hasPairPref && hasTripleBreak) return true;
  const altPairs = parseAlternativePairRanksFromQuestion(q);
  return altPairs.length > 0 && hasTripleBreak;
}

/** 是否追问「为什么不推荐三个X带对Y」——同三条、不同带对取舍 */
function isWhyNotRecommendTriplePairKickerQuestion(question) {
  const q = String(question ?? "");
  if (!/为什么不?推荐|为何不推荐/i.test(q)) return false;
  return /三个?[3-9JQKA210]|三带/i.test(q) && /带对|和|\+/i.test(q);
}

function parsePreferPairOverTripleBreakQuestion(question) {
  const q = String(question ?? "");
  const pairMatch = q.match(/(?:带对|用对)\s*([3-9]|10|J|Q|K|A|2)/i);
  const splitMatch = q.match(/(?:拆了?|破|还是拆|怎么还拆|怎么还是拆|拆)\s*(?:三个?|3个?)\s*([3-9]|10|J|Q|K|A|2)/i)
    || q.match(/三个?\s*([3-9]|10|J|Q|K|A|2)/i);
  const altPairs = parseAlternativePairRanksFromQuestion(q);
  return {
    proposedPairRank: pairMatch ? normalizeRank(pairMatch[1]) : (altPairs[0] ?? null),
    proposedPairRanks: altPairs,
    splitTripleRank: splitMatch ? normalizeRank(splitMatch[1]) : null,
  };
}

function collectViableKickerPairRanks(counts, tripleRank, pairRanks) {
  return pairRanks.filter(
    (rank) => (counts.get(rank) ?? 0) >= 2 && canFormTripleWithPair(counts, tripleRank, rank),
  );
}

function appendKickerPairSuggestion(contentLines, {
  choices,
  counts,
  tripleRank,
  pairRanks,
  topPairRank,
  kickerOnlyConcernRank = null,
}) {
  const viable = collectViableKickerPairRanks(counts, tripleRank, pairRanks);
  if (viable.length === 0) return;
  const pairPhrase = viable.map((rank) => `对${rankLabel(rank)}`).join("、");
  const best = viable[0];
  const userShort = compactTripleWithPairLabel(tripleRank, best);
  if (kickerOnlyConcernRank && topPairRank === kickerOnlyConcernRank) {
    contentLines.push(
      viable.length > 1
        ? `你说得对：手上有${pairPhrase}，应改带对${rankLabel(best)}组${userShort}，别用对${rankLabel(kickerOnlyConcernRank)}。`
        : `你说得对：应改带对${rankLabel(best)}组${userShort}，别用对${rankLabel(kickerOnlyConcernRank)}。`,
    );
  } else {
    contentLines.push(`你的思路对：应直接带对${rankLabel(best)}组${userShort}。`);
  }
  const matched = findTripleWithPairCandidate(choices, tripleRank, best);
  if (matched?.index === 0) {
    contentLines.push(`${userShort}就是推荐1，可以直接出。`);
  } else if (matched) {
    contentLines.push(`请看候选「${matched.play.label ?? userShort}」。`);
  } else if (viable.length > 1 && contentLines.length < 5) {
    contentLines.push(`也可带对${rankLabel(viable[1])}组${compactTripleWithPairLabel(tripleRank, viable[1])}。`);
  } else {
    contentLines.push(`推荐1偏了，请改带${pairPhrase.split("、")[0]}。`);
  }
}

/** 直接回应「带对J vs 拆三个8」或「有对5和对Q可以带」三带二带牌取舍 */
function answerWhyPreferPairOverTripleBreakQuestion(question, context, counts) {
  const parsed = parsePreferPairOverTripleBreakQuestion(question);
  const proposedPairRanks = [...new Set([
    ...(parsed.proposedPairRanks ?? []),
    ...(parsed.proposedPairRank ? [parsed.proposedPairRank] : []),
  ].filter(Boolean))];
  const splitTripleRank = parsed.splitTripleRank;
  if (proposedPairRanks.length === 0 && !splitTripleRank) return null;

  const levelRank = context.levelRank ?? "2";
  const hand = context.humanHand ?? [];
  const choices = context.currentAdvice?.choices ?? [];
  const top = choices[0];
  const topPlay = top?.play ?? top?.candidate;
  if (!topPlay || topPlay.type !== PLAY_TYPES.tripleWithPair) return null;

  const concernTripleRank = splitTripleRank ?? topPlay.mainRank;
  const topLabel = topPlay.label ?? "—";
  const topMainRank = topPlay.mainRank;
  const topPairRank = inferPairRankFromPlay(topPlay);
  const topShort = compactPlayShortLabel(topPlay) ?? topLabel;
  const topBreaksConcern = analyzeRankRoleInTopPlay(topPlay, concernTripleRank);
  const contentLines = ["【规则引擎作答】"];
  const concernIsMainTriple = topMainRank === concernTripleRank && topBreaksConcern.asTriple >= 3;
  const concernIsKickerOnly = !concernIsMainTriple
    && topBreaksConcern.asTriple < 3
    && (topBreaksConcern.asPair >= 2 || topPairRank === concernTripleRank);

  if (concernIsMainTriple) {
    contentLines.push(`是的，推荐1「${topLabel}」会拆三个${rankLabel(concernTripleRank)}作三条。`);
    if (proposedPairRanks.length > 0) {
      appendKickerPairSuggestion(contentLines, {
        choices,
        counts,
        tripleRank: concernTripleRank,
        pairRanks: proposedPairRanks.filter((rank) => rank !== concernTripleRank),
        topPairRank,
      });
    }
  } else if (concernIsKickerOnly) {
    contentLines.push(
      `推荐1「${topShort}」并未拆三个${rankLabel(concernTripleRank)}：三条是${rankLabel(topMainRank)}×3，${rankLabel(concernTripleRank)}只是带牌。`,
    );
    if (proposedPairRanks.length > 0) {
      appendKickerPairSuggestion(contentLines, {
        choices,
        counts,
        tripleRank: topMainRank,
        pairRanks: proposedPairRanks,
        topPairRank,
        kickerOnlyConcernRank: concernTripleRank,
      });
    } else {
      const tripleHeld = counts.get(concernTripleRank) ?? 0;
      contentLines.push(`你手里${tripleHeld}张${rankLabel(concernTripleRank)}仍完整留着。`);
    }
  } else {
    const pairUsed = topBreaksConcern.totalInPlay || topBreaksConcern.asPair || 0;
    const tripleHeld = counts.get(concernTripleRank) ?? 0;
    const remain = tripleHeld - pairUsed;
    contentLines.push(
      `推荐1「${topShort}」并未拆三个${rankLabel(concernTripleRank)}：三条是${rankLabel(topMainRank)}×3，${rankLabel(concernTripleRank)}只成对带走${pairUsed || 2}张。`,
    );
    if (proposedPairRanks.length > 0) {
      appendKickerPairSuggestion(contentLines, {
        choices,
        counts,
        tripleRank: topMainRank,
        pairRanks: proposedPairRanks,
        topPairRank,
      });
    } else if (remain >= 0 && contentLines.length < 4) {
      contentLines.push(
        `你手里共${tripleHeld}张${rankLabel(concernTripleRank)}，打完剩${remain}张${remain === 1 ? `单${rankLabel(concernTripleRank)}` : rankLabel(concernTripleRank)}。`,
      );
    }
    const splitBreak = resolveTripleBreakForPair(concernTripleRank, hand, levelRank);
    if (splitBreak?.splitsTriple && proposedPairRanks.length === 0 && contentLines.length < 5) {
      const structureLabel = splitBreak.plateLabel ?? splitBreak.tripleLabel ?? `三张${rankLabel(concernTripleRank)}`;
      contentLines.push(`原则：有整对可带时，不宜拆${structureLabel}组对。`);
    }
  }

  if (contentLines.length <= 1) return null;

  return {
    source: "rule-engine",
    mode: "why-not-play",
    text: sanitizeControlNarrative(contentLines.slice(0, 5).join("\n"), levelRank),
  };
}

/** 同三条三带二：解释为何首推带对A而非带对B（如 999+KK vs 999+33） */
function answerWhyNotRecommendTriplePairKickerQuestion(question, context, counts, proposed) {
  if (!isWhyNotRecommendTriplePairKickerQuestion(question)) return null;

  const tripleRank = proposed?.tripleRank;
  const pairRank = proposed?.pairRank;
  if (!tripleRank || !pairRank) return null;

  const levelRank = context.levelRank ?? "2";
  const choices = context.currentAdvice?.choices ?? [];
  const top = choices[0];
  const topPlay = top?.play ?? top?.candidate;
  if (!topPlay || (topPlay.type !== PLAY_TYPES.tripleWithPair && topPlay.type !== "TripleWithPair")) {
    return null;
  }

  const topMainRank = topPlay.mainRank;
  const topPairRank = inferPairRankFromPlay(topPlay);
  if (topMainRank !== tripleRank || !topPairRank || topPairRank === pairRank) return null;

  const table = context.table ?? {};
  const hasInitiative = !table.lastActivePlay;
  const turn = context.turnNumber ?? null;
  const isOpeningLead = (turn === 0 || turn === "0") && hasInitiative;
  const topShort = compactPlayShortLabel(topPlay) ?? topPlay.label ?? "—";
  const userShort = compactTripleWithPairLabel(tripleRank, pairRank);
  const userHuman = `三个${rankLabel(tripleRank)}带对${rankLabel(pairRank)}`;
  const topHuman = `三个${rankLabel(tripleRank)}带对${rankLabel(topPairRank)}`;
  const userPairAnalysis = resolvePairRankAnalysis(context, pairRank, counts);
  const matched = findTripleWithPairCandidate(choices, tripleRank, pairRank);

  const contentLines = ["【规则引擎作答】"];
  contentLines.push(`你问的是同三条${rankLabel(tripleRank)}：${userHuman} vs 首推${topHuman}。`);
  contentLines.push(
    `三带二比牌只看三条${rankLabel(tripleRank)}，带什么对子不影响大小；${userHuman}可以出。`,
  );

  const rationaleParts = [];
  if (userPairAnalysis.lockedSummary) {
    const lockNote = userPairAnalysis.lockedSummary.split("；")[0];
    rationaleParts.push(`对${rankLabel(pairRank)}${lockNote}，拆来带牌会伤结构`);
  }
  if (compareRanks(topPairRank, pairRank, levelRank) > 0) {
    rationaleParts.push(`带对${rankLabel(topPairRank)}多丢两张大牌、一次减手更多`);
    if (!userPairAnalysis.lockedSummary) {
      rationaleParts.push(`对${rankLabel(pairRank)}留着以后打小对试探或组连对更灵活`);
    }
  } else if (compareRanks(pairRank, topPairRank, levelRank) > 0) {
    rationaleParts.push(`首推带对${rankLabel(topPairRank)}更省大牌，先把${rankLabel(pairRank)}留着`);
  } else {
    rationaleParts.push(`首推${topShort}在减手排序上更优`);
  }

  const actionWord = isOpeningLead && hasInitiative ? "拿牌权" : "减手";
  contentLines.push(`首推${topShort}${actionWord}：${rationaleParts.join("，")}。`);

  if (matched?.index > 0 && contentLines.length < 5) {
    contentLines.push(`${userShort}在候选第${matched.index + 1}位，可以出，只是不在首推。`);
  } else if (matched?.index === 0 && contentLines.length < 5) {
    contentLines.push(`${userShort}就是推荐1。`);
  }

  return {
    source: "rule-engine",
    mode: "why-not-play",
    text: sanitizeControlNarrative(contentLines.slice(0, 5).join("\n"), levelRank),
  };
}

/** 是否追问接风顺子选 23456 vs 12345/A2345、为何拆三张、或 23456+留A 理牌 */
function isWhyStraightChoiceQuestion(question) {
  const q = String(question ?? "");
  const mentionsStraight = /23456|12345|A2345|2-3-4-5-6|1-2-3-4-5|A-2-3-4-5|顺子/i.test(q);
  if (!mentionsStraight) return false;
  if (/23456.*A2345|A2345.*23456|23456.*更大|留A|控权|理牌|理成/i.test(q)) return true;
  return /为什么不选|为何选|为什么选|怎么选|推荐.*选|拆三张|拆三同|多了一个|却要拆/i.test(q);
}

function parseStraightChoiceLabels(question) {
  const q = String(question ?? "");
  const high = q.match(/23456|2-3-4-5-6/i) ? "23456" : null;
  const low = q.match(/12345|1-2-3-4-5|A2345/i) ? (q.match(/A2345/i) ? "A2345" : "12345") : null;
  return { highStraight: high, lowStraight: low };
}

/** 接风顺子：23456 vs A2345/12345，解释绕级顺与不拆三同张 */
function answerWhyStraightChoiceQuestion(question, context, counts) {
  if (!isWhyStraightChoiceQuestion(question)) return null;

  const levelRank = context.levelRank ?? "2";
  const hand = context.humanHand ?? [];
  const table = context.table ?? {};
  const hasInitiative = !table.lastActivePlay;
  const choices = context.currentAdvice?.choices ?? [];
  const top = choices[0];
  const topPlay = top?.play ?? top?.candidate;
  const parsed = parseStraightChoiceLabels(question);

  const straightChoices = choices
    .map((choice, index) => ({ index, play: choice.play ?? choice.candidate }))
    .filter((item) => item.play?.type === PLAY_TYPES.straight);

  const breakingStraight = straightChoices.find((item) => {
    const br = resolveTripleBreakForStraight(item.play, hand, levelRank);
    return br.splitsTriple;
  });
  const gentleStraight = straightChoices.find((item) => {
    const br = resolveTripleBreakForStraight(item.play, hand, levelRank);
    return !br.splitsTriple;
  }) ?? straightChoices.find((item) => item.index >= 2);

  const focusStraight = breakingStraight?.play
    ?? straightChoices.find((item) => /23456|2-3-4-5-6/i.test(item.play?.label ?? ""))?.play
    ?? (topPlay?.type === PLAY_TYPES.straight ? topPlay : null);
  const altStraight = gentleStraight?.play
    ?? straightChoices.find((item) => /A2345|12345|1-2-3-4-5/i.test(item.play?.label ?? ""))?.play;

  const tripleBreak = focusStraight
    ? resolveTripleBreakForStraight(focusStraight, hand, levelRank)
    : { splitsTriple: false, tripleLabel: null, tripleRank: null };

  const contentLines = ["【规则引擎作答】"];

  if (hasInitiative) {
    const highLabel = parsed.highStraight ?? "23456";
    const lowLabel = parsed.lowStraight ?? (altStraight ? (altStraight.label ?? "A2345") : "A2345");
    const overlapChoice = handHasOverlappingLowStraightChoice(hand, levelRank);

    if (overlapChoice) {
      contentLines.push(
        `原则P4（结构理牌）：同套可组${highLabel}或${lowLabel}时，优先${highLabel}+留A。`,
      );
      contentLines.push(STRAIGHT_HIGH_OVER_WRAP_REASON);
      if (/多了一个\s*A|多.*A/i.test(question)) {
        contentLines.push(
          `${highLabel}留单A作控牌，比${lowLabel}留散6更值；A进顺子虽少一张散牌，但损失控牌。`,
        );
      }
    } else if (tripleBreak.splitsTriple) {
      contentLines.push(
        `选${highLabel}会拆${tripleBreak.tripleLabel ?? "三同张"}组顺子，三同张结构作废。`,
      );
      contentLines.push(
        `若无三同张冲突，同套可组时仍优先${highLabel}+留A（${STRAIGHT_HIGH_OVER_WRAP_REASON}）。`,
      );
      if (/多了一个\s*A|多.*A/i.test(question)) {
        contentLines.push(
          `${highLabel}路线留单A控牌；${lowLabel}把A编进顺子一次出掉，但顺子小一级且损失A的控权。`,
        );
      }
    } else {
      contentLines.push(`接风/领出优先${highLabel}这类更大顺子（${STRAIGHT_HIGH_OVER_WRAP_REASON}）。`);
    }

    if (levelRank && levelRank !== "—") {
      contentLines.push(`本局级牌${rankLabel(levelRank)}：23456顺子比A2345大一级。`);
    }
    if (topPlay?.type === PLAY_TYPES.tripleWithPair) {
      const topShort = topPlay.label ?? `三带二 ${rankLabel(topPlay.mainRank)}`;
      const straightBreak = resolveStraightBreakForTripleWithPair(topPlay, hand, levelRank);
      if (straightBreak.breaksStraight) {
        contentLines.push(
          `推荐1「${topShort}」会拆理牌后的${straightBreak.straightLabel ?? "顺子"}；请看23456或钢板等成组减手。`,
        );
      }
    } else if (topPlay?.type === PLAY_TYPES.straight && isWrapStraightLabel(topPlay.label) && overlapChoice) {
      contentLines.push(`推荐1走${lowLabel}偏绕级；同套应优先${highLabel}+留A。`);
    } else if (gentleStraight && isHighLowStraightLabel(gentleStraight.play?.label)) {
      contentLines.push(`候选里有${gentleStraight.play.label ?? highLabel}，即23456+留A理牌路线。`);
    } else if (altStraight && overlapChoice) {
      contentLines.push(`不宜优先${altStraight.label ?? lowLabel}；请看${highLabel}顺子。`);
    }
  } else {
    contentLines.push("这手需压牌，顺子对照以能否压过桌面为准；接风时才优先不拆三同张的顺子。");
    if (focusStraight?.label) contentLines.push(`你问的${focusStraight.label}需结合牌权判断。`);
  }

  if (contentLines.length <= 1) return null;

  return {
    source: "rule-engine",
    mode: "why-not-play",
    text: sanitizeControlNarrative(contentLines.join("\n"), levelRank),
  };
}

/** 解析问句里点名的花色牌（如「梅花2已经组成顺子」） */
function parseStraightCardMention(question) {
  const match = String(question ?? "").match(/(梅花|方片|红桃|黑桃)([3-9]|10|J|Q|K|A|2)/);
  if (!match) return null;
  const suitMap = { 梅花: "C", 方片: "D", 红桃: "H", 黑桃: "S" };
  return {
    rank: normalizeRank(match[2]),
    suit: suitMap[match[1]],
    label: match[0],
  };
}

/** 候选里找不拆顺子的三带二 */
function findGentleTripleWithPairInChoices(choices, hand, levelRank) {
  for (let i = 0; i < choices.length; i++) {
    const play = choices[i]?.play ?? choices[i]?.candidate;
    if (play?.type !== PLAY_TYPES.tripleWithPair) continue;
    const br = resolveStraightBreakForTripleWithPair(play, hand, levelRank);
    if (!br.breaksStraight) return { index: i, play };
  }
  return null;
}

/** 三带二三条是否会拆整炸 */
function rankBreaksBombForTriple(hand, rank, levelRank) {
  const info = analyzeRankAvailability(hand, rank, levelRank);
  return info.effectiveBombCount >= 4 && info.wouldBreakBombForTriple;
}

/** 手牌里找不在顺子中、不拆炸的可组三条点数 */
function suggestOffStraightTripleRank(hand, levelRank, counts, straightGroup) {
  const straightRanks = new Set((straightGroup?.cards ?? []).map((card) => card.rank));
  let best = null;
  for (const [rank, held] of counts.entries()) {
    if (rank === "SJ" || rank === "BJ" || straightRanks.has(rank) || held < 3) continue;
    if (rankBreaksBombForTriple(hand, rank, levelRank)) continue;
    const probe = { type: PLAY_TYPES.tripleWithPair, mainRank: rank };
    const br = resolveStraightBreakForTripleWithPair(probe, hand, levelRank);
    if (!br.breaksStraight && (!best || compareRanks(rank, best, levelRank) < 0)) best = rank;
  }
  return best;
}

/** 为安全三带二找最小对子（不拆炸弹） */
function suggestSafePairRankForTriple(hand, levelRank, counts, tripleRank) {
  for (const rank of rankOrder(levelRank)) {
    if (rank === tripleRank || rank === "SJ" || rank === "BJ") continue;
    const held = counts.get(rank) ?? 0;
    if (held < 2) continue;
    const info = analyzeRankAvailability(hand, rank, levelRank);
    if (info.effectiveBombCount >= 4 && held <= info.effectiveBombCount) continue;
    return rank;
  }
  return null;
}

/** 领出/接风：不拆顺、不拆炸的三带二替代描述 */
function describeSafeTripleWithPairAlternative(hand, levelRank, counts, straightGroup) {
  const tripleRank = suggestOffStraightTripleRank(hand, levelRank, counts, straightGroup);
  if (!tripleRank) return null;
  const pairRank = suggestSafePairRankForTriple(hand, levelRank, counts, tripleRank);
  return compactTripleWithPairLabel(tripleRank, pairRank);
}

/** 是否追问「三带二拆顺子、多出散牌怎么办」（如 666+33 拆 23456；222+55 拆 A2345） */
function isWhyTriplePairBreaksStraightQuestion(question) {
  const q = String(question ?? "");
  if (/拆.*顺子/i.test(q) && /三个?6|三带|666|带两个?3|带对3/i.test(q)) return true;
  if (/多出.*单牌|散牌怎么办|单牌怎么办/i.test(q) && /三带|三个?6|666/i.test(q)) return true;
  if (/什么逻辑/i.test(q) && /拆.*顺子/i.test(q) && /三带|三个/i.test(q)) return true;
  const composedStraight = /已经组成顺子|组成顺子|在顺子里|在顺子中|编进顺子/i.test(q);
  const triplePairShape = /三带二|三带|三个/i.test(q) && /带对|带两个?/i.test(q);
  if (composedStraight && triplePairShape) return true;
  if ((/拆.*顺子|顺子.*拆|把顺子拆了/i.test(q) || composedStraight) && /三个?[3-9JQKA2]/i.test(q)) {
    return true;
  }
  return false;
}

/** 三带二拆顺子：承认偏了或澄清误解，并给顺子/其他三条替代 */
function answerWhyTriplePairBreaksStraightQuestion(question, context, counts) {
  if (!isWhyTriplePairBreaksStraightQuestion(question)) return null;

  const levelRank = context.levelRank ?? "2";
  const hand = context.humanHand ?? [];
  const table = context.table ?? {};
  const hasInitiative = !table.lastActivePlay;
  const choices = context.currentAdvice?.choices ?? [];
  const top = choices[0];
  const topPlay = top?.play ?? top?.candidate;

  const proposed = parseProposedPlayDescription(question);
  const tripleRank = proposed?.tripleRank ?? topPlay?.mainRank ?? null;
  const pairRank = proposed?.pairRank ?? inferPairRankFromPlay(topPlay);
  const probePlay = tripleRank
    ? {
        type: PLAY_TYPES.tripleWithPair,
        mainRank: tripleRank,
        label: proposed?.label ?? compactTripleWithPairLabel(tripleRank, pairRank),
      }
    : topPlay;
  const playForBreak = probePlay?.type === PLAY_TYPES.tripleWithPair ? probePlay : topPlay;
  if (!playForBreak || playForBreak.type !== PLAY_TYPES.tripleWithPair) return null;

  const tripleBreak = resolveStraightBreakForTripleWithPair(playForBreak, hand, levelRank);
  const topBreak = topPlay?.type === PLAY_TYPES.tripleWithPair
    ? resolveStraightBreakForTripleWithPair(topPlay, hand, levelRank)
    : tripleBreak;

  const groups = buildStrategicGroups(hand, levelRank);
  const straightGroup = groups.find((group) => group.play?.type === PLAY_TYPES.straight);
  const straightLabel = tripleBreak.straightLabel ?? topBreak.straightLabel ?? straightGroup?.label ?? "顺子";
  const mentionedCard = parseStraightCardMention(question);
  const cardInStraight = mentionedCard && (straightGroup?.cards ?? []).some(
    (card) => card.rank === mentionedCard.rank && card.suit === mentionedCard.suit,
  );

  const straightChoices = choices
    .map((choice, index) => ({ index, play: choice.play ?? choice.candidate }))
    .filter((item) => item.play?.type === PLAY_TYPES.straight);
  const gentleStraight = straightChoices.find((item) => {
    const br = resolveTripleBreakForStraight(item.play, hand, levelRank);
    return !br.splitsTriple;
  }) ?? straightChoices[0];
  const gentleTriple = findGentleTripleWithPairInChoices(choices, hand, levelRank);
  const safeTripleAlt = describeSafeTripleWithPairAlternative(hand, levelRank, counts, straightGroup);

  const topLabel = topPlay?.label
    ?? (topPlay?.type === PLAY_TYPES.straight ? (straightGroup?.label ?? straightLabel) : null)
    ?? (topPlay?.type === PLAY_TYPES.tripleWithPair
      ? `三带二 ${rankLabel(topPlay?.mainRank ?? tripleRank)}`
      : topPlay?.mainRank ?? "—");
  const userShort = compactTripleWithPairLabel(tripleRank, pairRank);
  const breaksStraight = tripleBreak.breaksStraight || topBreak.breaksStraight;
  const topAlreadyStraight = topPlay?.type === PLAY_TYPES.straight;
  const topAlreadySafeTriple = topPlay?.type === PLAY_TYPES.tripleWithPair
    && !topBreak.breaksStraight
    && !rankBreaksBombForTriple(hand, topPlay.mainRank, levelRank);
  const isComposedStraightConcern = /已经组成顺子|组成顺子|在顺子里|在顺子中/i.test(question);
  const contentLines = ["【规则引擎作答】"];

  if (breaksStraight) {
    contentLines.push(userShort ? `是，${userShort}会拆${straightLabel}。` : `是，这会拆${straightLabel}。`);
    if (cardInStraight && mentionedCard) {
      contentLines.push(`${mentionedCard.label}就在这条${straightLabel}里。`);
    }
    if (topPlay?.type === PLAY_TYPES.tripleWithPair && topBreak.breaksStraight) {
      contentLines.push(`推荐1「${topLabel}」正是这条路线，你的质疑成立。`);
    } else if (topAlreadyStraight) {
      contentLines.push(`推荐1「${topLabel}」已是顺子减手，不会拆${straightLabel}。`);
    } else if (topPlay) {
      contentLines.push(`推荐1「${topLabel}」会拆${topBreak.straightLabel ?? straightLabel}，不宜走这条。`);
    }
    if (isComposedStraightConcern) {
      contentLines.push("原则P1/P4（结构保护）：不宜为三带二拆掉已成顺子，顺子一次出5张更干净。");
    } else if (hasInitiative) {
      contentLines.push("原则P5（接风减手）：优先顺子/钢板一次减多张，不拆顺子走三带二。");
    } else {
      contentLines.push("原则P4（结构保护）：不宜为三带二拆掉已成顺子。");
    }
    if (topAlreadyStraight && contentLines.length < 6) {
      contentLines.push(`请直接出推荐1「${topLabel}」，一次减5张。`);
    } else if (gentleStraight?.play && contentLines.length < 6) {
      contentLines.push(
        gentleStraight.index === 0
          ? `顺子「${gentleStraight.play.label ?? straightLabel}」就是推荐1，请优先出。`
          : `请看候选「${gentleStraight.play.label ?? straightLabel}」先走顺子减手。`,
      );
    } else if (straightGroup?.label && contentLines.length < 6) {
      contentLines.push(`更优替代：直接出${straightGroup.label}一次减5张。`);
    } else if (gentleTriple && contentLines.length < 6) {
      const gentleBreaksBomb = rankBreaksBombForTriple(hand, gentleTriple.play.mainRank, levelRank);
      if (!gentleBreaksBomb) {
        contentLines.push(`或改走「${gentleTriple.play.label}」，不拆${straightLabel}。`);
      }
    } else if (safeTripleAlt && contentLines.length < 6) {
      contentLines.push(`或改走${safeTripleAlt}，不拆顺子、也不拆炸弹。`);
    }
  } else if (topAlreadySafeTriple) {
    contentLines.push(`否，${userShort ?? topLabel}不拆理牌后的${straightLabel}。`);
    if (mentionedCard && cardInStraight) {
      contentLines.push(
        `${mentionedCard.label}在${straightLabel}里，但推荐1三条用的是另两张${rankLabel(tripleRank)}，顺子仍可保留。`,
      );
    }
    contentLines.push(`推荐1「${topLabel}」可以出，不会拆掉${straightLabel}。`);
  } else {
    contentLines.push(`推荐1「${topLabel}」不是最优减手路线。`);
  }

  if (/多出.*单牌|散牌怎么办|单牌怎么办/i.test(question)) {
    contentLines.push("三带二只减5张却拆顺子，剩下一堆散单难清；顺子一次出5张更干净。");
  }

  if (!breaksStraight && hasInitiative) {
    contentLines.push("原则P5（接风减手）：优先顺子/钢板一次减多张，不拆顺子走三带二。");
    if (gentleStraight?.play) {
      contentLines.push(
        gentleStraight.index === 0
          ? `顺子「${gentleStraight.play.label ?? "—"}」就是推荐1，请直接出。`
          : `请看候选「${gentleStraight.play.label ?? "—"}」或第${gentleStraight.index + 1}位顺子。`,
      );
    }
  } else if (!breaksStraight && !hasInitiative) {
    contentLines.push("这手需压牌时顺子未必能出；接风/领出才优先顺子减手。");
  }

  if (contentLines.length <= 1) return null;

  return {
    source: "rule-engine",
    mode: "why-not-play",
    text: sanitizeControlNarrative(contentLines.slice(0, 6).join("\n"), levelRank),
  };
}

function parseWhyNotUsePairQuestion(question, topPlay) {
  const q = String(question ?? "");
  const proposed = q.match(/不用对([3-9]|10|J|Q|K|A|2)/i)
    || q.match(/用对([3-9]|10|J|Q|K|A|2)/i);
  const split = q.match(/拆(?:三个?|3个?)([3-9]|10|J|Q|K|A|2)/i);
  return {
    proposedPairRank: proposed ? normalizeRank(proposed[1]) : null,
    splitTripleRank: split ? normalizeRank(split[1]) : (topPlay?.type === PLAY_TYPES.pair ? topPlay.mainRank : null),
  };
}

/** 直接回答为何不用整对 K、却拆三同张 6 组对 */
function answerWhyNotUsePairQuestion(question, context, counts) {
  const table = context.table ?? {};
  const mustBeat = table.lastActivePlay ?? null;
  if (!isBeatPairLikeMustBeat(mustBeat)) return null;
  if (!isWhyNotUsePairQuestion(question)) return null;

  const levelRank = context.levelRank ?? "2";
  const hand = context.humanHand ?? [];
  const top = context.currentAdvice?.choices?.[0];
  const topPlay = top?.play ?? top?.candidate;
  const parsed = parseWhyNotUsePairQuestion(question, topPlay);
  const proposedRank = parsed.proposedPairRank;
  const splitRank = parsed.splitTripleRank ?? topPlay?.mainRank;

  if (proposedRank) {
    const proposedHeld = counts.get(proposedRank) ?? 0;
    const canProposedBeat = proposedHeld >= 2
      && compareRanks(proposedRank, mustBeat.mainRank, levelRank) > 0;
    if (!canProposedBeat) {
      return {
        source: "rule-engine",
        mode: "why-not-play",
        text: sanitizeControlNarrative(
          [
            "【规则引擎作答】",
            `对${rankLabel(proposedRank)}压不过${mustBeat.label ?? `对${rankLabel(mustBeat.mainRank)}`}，不能出。`,
          ].join("\n"),
          levelRank,
        ),
      };
    }
  }

  const candidates = (context.currentAdvice?.choices ?? [])
    .map((choice) => choice.play ?? choice.candidate)
    .filter(Boolean);
  const resolvedHand = hand.map((card) => createCard(
    card.rank,
    card.suit,
    card.deckIndex ?? 0,
  ));
  if (candidates.length === 0) {
    candidates.push(...generateBasicCandidates(resolvedHand, levelRank, mustBeat));
  }
  const reserveCtx = {
    previousPlay: mustBeat,
    opponentActive: true,
    hasRegularWinner: true,
    hasActionableRegularWinner: true,
    _candidates: candidates,
    levelRank,
  };
  const reserves = analyzeReservePairForPendingTriple(
    resolvedHand,
    levelRank,
    mustBeat,
    reserveCtx,
  );
  const reserve = reserves.find((entry) => !proposedRank || entry.pairRank === proposedRank);
  if (reserve && isFollowingOpponentPair(mustBeat, levelRank, reserveCtx)) {
    return {
      source: "rule-engine",
      mode: "why-not-play",
      text: sanitizeControlNarrative(
        [
          "【规则引擎作答】",
          `你的理解对：${reserve.reason}。`,
          `若现在出对${rankLabel(reserve.pairRank)}压牌，后续${rankLabel(reserve.tripleRank)}三带二将缺对子可配。`,
          "原则P4（结构保留）：此墩可过牌，保留对子给三带二。",
        ].join("\n"),
        levelRank,
      ),
    };
  }

  const principleLines = buildBeatPairPrincipleAnswer(context, counts, {
    preferredPairRank: proposedRank,
  });
  if (!principleLines) return null;

  const splitBreak = splitRank ? resolveTripleBreakForPair(splitRank, hand, levelRank) : null;
  const contentLines = [...principleLines];
  if (splitRank && splitBreak?.splitsTriple && !contentLines.some((line) => line.includes("拆"))) {
    const structureLabel = splitBreak.plateLabel ?? splitBreak.tripleLabel ?? `三张${rankLabel(splitRank)}`;
    contentLines.splice(1, 0, `「拆三个${rankLabel(splitRank)}」就是把${structureLabel}拆成对${rankLabel(splitRank)}，损失三同张结构。`);
  }

  return {
    source: "rule-engine",
    mode: "why-not-play",
    text: sanitizeControlNarrative(contentLines.join("\n"), levelRank),
  };
}

/** 用户质疑左侧推荐单张（为何打X、拆对子、打Y是否更好） */
function answerWhyPlayRecommendedQuestion(question, context, counts) {
  const parsed = parseWhyPlayQuestion(question);
  const choices = context.currentAdvice?.choices ?? [];
  const top = choices[0];
  const topPlay = top?.play ?? top?.candidate;
  if (topPlay?.type !== PLAY_TYPES.single) return null;

  const focusRank = parsed.questionedRank ?? topPlay.mainRank;
  if (!focusRank || topPlay.mainRank !== focusRank) return null;
  if (!parsed.questionedRank && !parsed.breaksPairMentioned && !parsed.alternativeRank) {
    return null;
  }

  const levelRank = context.levelRank ?? "2";
  const hand = context.humanHand ?? [];
  const table = context.table ?? {};
  const mustBeat = table.lastActivePlay ?? null;
  const { breaksPair, pairLabel } = resolvePairBreakForSingle(focusRank, hand, levelRank, counts);
  const altRank = parsed.alternativeRank;
  const altHeld = altRank ? (counts.get(altRank) ?? 0) : 0;
  const altMatched = altRank ? findSingleCandidate(choices, altRank) : null;
  const topReasons = learnerTopReasons(top, 1, {
    ...context,
    levelRank,
    previousPlay: mustBeat,
    brief: true,
  });
  const focusShort = compactSingleLabel(focusRank);
  const altShort = altRank ? compactSingleLabel(altRank) : null;
  const contentLines = [];

  const pairPhrase = formatPairLabel(pairLabel, focusRank);
  if (breaksPair) {
    contentLines.push(`打${focusShort}会拆${pairPhrase}，确有结构代价。`);
  } else if (parsed.breaksPairMentioned && mustBeat?.type === PLAY_TYPES.single) {
    const looseRank = findLooseSingleBeaterRank(hand, counts, mustBeat, levelRank, question);
    if (looseRank && looseRank === focusRank) {
      contentLines.push(
        `原则P1（散单优先）：你问拆对，但推荐1就是单${rankLabel(looseRank)}，有散单够压，请直接出。`,
      );
    }
  }

  if (mustBeat?.type === PLAY_TYPES.single) {
    const beatRank = mustBeat.mainRank;
    const focusBeats = compareRanks(focusRank, beatRank, levelRank) > 0;
    const reasonPart = topReasons[0]
      || (focusBeats
        ? `跟住对手单${rankLabel(beatRank)}，用能压的最小单张`
        : "跟住对手单张");
    contentLines.push(`推荐${focusShort}：${reasonPart}。`);

    if (altRank && altHeld >= 1) {
      const altBeats = compareRanks(altRank, beatRank, levelRank) > 0;
      if (altBeats) {
        const altControl = isControlRank(altRank, levelRank);
        if (altControl) {
          contentLines.push(`打${altShort}也能压，但${rankLabel(altRank)}是控权牌，先出偏大。`);
        } else if (compareRanks(altRank, focusRank, levelRank) > 0) {
          contentLines.push(
            `打${altShort}也能压，但${rankLabel(altRank)}比${rankLabel(focusRank)}大，非必要不先垫。`,
          );
        } else {
          contentLines.push(`打${altShort}也能压，牌力接近，首推更保守。`);
        }
        if (breaksPair || parsed.breaksPairMentioned) {
          contentLines.push(`你想留${pairPhrase}出${altShort}也行，只是多垫一张大牌。`);
        } else if (altMatched && altMatched.index > 0) {
          contentLines.push(`单${rankLabel(altRank)}在候选第${altMatched.index + 1}位，也可考虑。`);
        }
      } else {
        contentLines.push(`打${altShort}压不住单${rankLabel(beatRank)}，得用${focusShort}或更大牌。`);
      }
    } else if (!breaksPair && !parsed.breaksPairMentioned) {
      contentLines.push(topReasons[1] || "首推更省大牌、跟牌更稳。");
    }
  } else {
    const sceneWord = mustBeat ? "这手" : "自由出牌";
    const reasonPart = topReasons[0] || (mustBeat ? "跟牌更稳" : "减手更划算");
    contentLines.push(`${sceneWord}推荐${focusShort}：${reasonPart}。`);
    if (altRank && altHeld >= 1) {
      const levelNote = briefLevelRankNote(altRank, levelRank);
      if (compareRanks(altRank, focusRank, levelRank) > 0) {
        contentLines.push(
          levelNote
            ? `打${altShort}也行，但${levelNote}，宜留到更关键一手。`
            : `打${altShort}也行，但${rankLabel(altRank)}比${rankLabel(focusRank)}大，宜留大牌。`,
        );
      } else if (altMatched?.index > 0) {
        contentLines.push(`单${rankLabel(altRank)}在候选第${altMatched.index + 1}位，也可考虑。`);
      }
    }
  }

  if (contentLines.length === 0) return null;

  const answerText = sanitizeControlNarrative(
    ["【规则引擎作答】", ...contentLines].join("\n"),
    levelRank,
  );
  return { source: "rule-engine", mode: "why-not-play", text: answerText };
}

/** 是否追问「为何不出连对而出对子」或反向对照 */
function isWhyPairChainVsPairQuestion(question) {
  const q = String(question ?? "");
  if (isWhyNotPlateQuestion(q)) return false;
  const hasPairChain = /连对/i.test(q);
  const hasPair = /对子|对[3-9JQKA2]/i.test(q);
  if (!hasPairChain || !hasPair) return false;
  return /为什么|为何|为啥|怎么|能不能|可不可以/i.test(q)
    && (/不.*(?:出|打|走)|不出|不打|而要|而是|却.*(?:出|打)|而非|推荐/i.test(q)
      || /连对.*(?:而|却).*(?:对子|对[3-9])/i.test(q));
}

/** 解析连对/对子对照问句的主张方向 */
function parsePairChainVsPairDirection(question) {
  const q = String(question ?? "");
  if (/不.*(?:出|打|走).*连对.*(?:而|却|要).*(?:对子|对[3-9])/i.test(q)) return "prefersPairChain";
  if (/连对.*(?:而|却).*(?:对子|对[3-9])/i.test(q)) return "prefersPairChain";
  if (/不.*(?:出|打|走).*(?:对子|对[3-9]).*(?:而|却|要).*连对/i.test(q)) return "prefersPair";
  return "prefersPairChain";
}

/** 理牌分组里的连对 */
function findConsecutivePairsGroups(hand, levelRank) {
  if (!hand?.length) return [];
  return buildStrategicGroups(hand, levelRank).filter(
    (group) => group.play?.type === PLAY_TYPES.consecutivePairs
      || group.label?.startsWith("连对"),
  );
}

/** 左侧候选里的连对 */
function findConsecutivePairsCandidate(choices) {
  for (let i = 0; i < choices.length; i++) {
    const play = choices[i].play ?? choices[i].candidate;
    if (play?.type === PLAY_TYPES.consecutivePairs) {
      return { index: i, choice: choices[i], play };
    }
  }
  return null;
}

/** 直答：连对 vs 对子取舍（开局试探 / 接风减手 / 拆三同张） */
function answerWhyPairChainVsPairQuestion(question, context, counts) {
  if (!isWhyPairChainVsPairQuestion(question)) return null;

  const levelRank = context.levelRank ?? "2";
  const hand = context.humanHand ?? [];
  const handCount = hand.length;
  const table = context.table ?? {};
  const mustBeat = table.lastActivePlay ?? null;
  const hasInitiative = !mustBeat;
  const isCatchWind = inferCatchWindFromContext(context);
  const isFreshOpen = hasInitiative && (context.turnNumber === 0 || context.turnNumber === "0");
  const choices = context.currentAdvice?.choices ?? [];
  const top = choices[0];
  const topPlay = top?.play ?? top?.candidate;
  if (!topPlay) return null;

  const topLabel = topPlay.label ?? "—";
  const topShort = compactPlayShortLabel(topPlay) ?? topLabel;
  const cpCandidate = findConsecutivePairsCandidate(choices);
  const cpPlay = cpCandidate?.play ?? null;
  const cpGroups = findConsecutivePairsGroups(hand, levelRank);
  const direction = parsePairChainVsPairDirection(question);
  const topReasons = learnerTopReasons(top, 2, {
    ...context,
    levelRank,
    previousPlay: mustBeat,
  });
  const contentLines = [];

  if (direction === "prefersPair") {
    if (topPlay.type !== PLAY_TYPES.consecutivePairs) return null;
    contentLines.push(
      `接风/领出优先${topLabel}一次减${topPlay.length ?? topPlay.cards?.length ?? 6}张，成组减手效率高。`,
    );
    if (topReasons[0]) contentLines.push(topReasons[0]);
    contentLines.push("裸对子只减2张偏慢，手上有完整连对时不宜先走小对。");
    return {
      source: "rule-engine",
      mode: "why-pair-chain-vs-pair",
      text: sanitizeControlNarrative(["【规则引擎作答】", ...contentLines].join("\n"), levelRank),
    };
  }

  if (topPlay.type === PLAY_TYPES.consecutivePairs) {
    contentLines.push(`推荐1就是${topLabel}，连对一次减多张，符合【P5】成组减手。`);
    if (topReasons[0]) contentLines.push(topReasons[0]);
    return {
      source: "rule-engine",
      mode: "why-pair-chain-vs-pair",
      text: sanitizeControlNarrative(["【规则引擎作答】", ...contentLines].join("\n"), levelRank),
    };
  }

  if (topPlay.type !== PLAY_TYPES.pair) return null;

  const pairRank = topPlay.mainRank;

  if (cpPlay) {
    const tripleBreak = resolveTripleBreakForConsecutivePairs(cpPlay, hand, levelRank);
    if (tripleBreak.splitsTriple) {
      contentLines.push(
        `连对会拆${tripleBreak.tripleLabel ?? `三张${rankLabel(tripleBreak.tripleRank)}`}，不宜为凑连对拆掉可组三带二的结构。`,
      );
      contentLines.push(`推荐${topShort}保留三同张，接风/领出再组三带二或走其它连对更划算。`);
      if (cpCandidate.index > 0) {
        contentLines.push(`连对在候选第${cpCandidate.index + 1}位；首推${topShort}是为避拆三同张。`);
      }
      return {
        source: "rule-engine",
        mode: "why-pair-chain-vs-pair",
        text: sanitizeControlNarrative(["【规则引擎作答】", ...contentLines].join("\n"), levelRank),
      };
    }

    const plates = findPlateGroups(hand, levelRank);
    const brokenPlate = playOverlapsPlate(cpPlay, plates);
    if (brokenPlate) {
      contentLines.push(`你问的连对会拆${brokenPlate.label ?? "钢板"}，宜保留钢板一次减六张。`);
      contentLines.push(`推荐${topShort}不碰钢板，结构更安全。`);
      return {
        source: "rule-engine",
        mode: "why-pair-chain-vs-pair",
        text: sanitizeControlNarrative(["【规则引擎作答】", ...contentLines].join("\n"), levelRank),
      };
    }
  }

  if (mustBeat && isBeatPairLikeMustBeat(mustBeat)) {
    contentLines.push(`跟牌压${mustBeat.label ?? "对子"}，用最小够压的对子即可，不必亮连对浪费牌力。`);
    if (topReasons[0]) contentLines.push(topReasons[0]);
    return {
      source: "rule-engine",
      mode: "why-pair-chain-vs-pair",
      text: sanitizeControlNarrative(["【规则引擎作答】", ...contentLines].join("\n"), levelRank),
    };
  }

  if (isCatchWind && handCount >= 10) {
    if (cpCandidate) {
      contentLines.push(`接风手牌仍多，有成组连对时一次减六张通常优于裸${topShort}。`);
      contentLines.push(`你这思路有道理；请看候选「${cpPlay.label}」${cpCandidate.index > 0 ? `（第${cpCandidate.index + 1}位）` : ""}。`);
      contentLines.push(`推荐${topShort}偏保守试探；若牌权在手想抢节奏，连对更减手。`);
    } else if (cpGroups.length > 0) {
      contentLines.push(`接风可打${cpGroups[0].label ?? "连对"}一次减六张，优于小对试探。`);
      contentLines.push(`推荐${topShort}偏试探；成组连对减手效率更高。`);
    } else {
      contentLines.push(`接风有成组连对时优先连对减手；当前首推${topShort}，请对照左侧候选是否另有连对路线。`);
    }
    return {
      source: "rule-engine",
      mode: "why-pair-chain-vs-pair",
      text: sanitizeControlNarrative(["【规则引擎作答】", ...contentLines].join("\n"), levelRank),
    };
  }

  if (isFreshOpen || handCount >= 20) {
    contentLines.push(`开局用小对${rankLabel(pairRank)}试探更灵活：只减2张，对手难判你后续还有连对/钢板。`);
    contentLines.push("一举出连对虽一次减6张，但亮出三连对结构，下家更容易针对性拦截。");
    if (cpCandidate) {
      const rankNote = cpCandidate.index === 0
        ? "且为推荐1"
        : `在第${cpCandidate.index + 1}位`;
      contentLines.push(`你连对思路也成立；候选里有「${cpPlay.label}」${rankNote}，属风格取舍。`);
    } else {
      contentLines.push("本局可标为风格差异：连对抢节奏、小对留牌型，两种开局都行。");
    }
    return {
      source: "rule-engine",
      mode: "why-pair-chain-vs-pair",
      text: sanitizeControlNarrative(["【规则引擎作答】", ...contentLines].join("\n"), levelRank),
    };
  }

  if (topReasons[0]) {
    contentLines.push(`推荐${topShort}：${topReasons[0]}。`);
  } else {
    contentLines.push(`推荐${topShort}：小对减手成本低，不必为减手硬凑连对拆结构。`);
  }
  if (cpCandidate) {
    contentLines.push(`连对「${cpPlay.label}」在候选第${cpCandidate.index + 1}位，你想抢节奏也可以出。`);
  }

  return {
    source: "rule-engine",
    mode: "why-pair-chain-vs-pair",
    text: sanitizeControlNarrative(["【规则引擎作答】", ...contentLines].join("\n"), levelRank),
  };
}

/** 是否压小单局面（原则 P1/P4 适用） */
function isPressingSmallSingleContext(mustBeat, levelRank) {
  if (mustBeat?.type !== PLAY_TYPES.single) return false;
  return compareRanks(mustBeat.mainRank, "6", levelRank) <= 0;
}

/** 理牌分组里的完整钢板 */
function findPlateGroups(hand, levelRank) {
  if (!hand?.length) return [];
  return buildStrategicGroups(hand, levelRank).filter(
    (group) => group.label?.startsWith("钢板") || group.play?.type === PLAY_TYPES.plane,
  );
}

/** 某手出牌是否拆掉已有钢板（三带类 ≥3 张；单张 ≥1 张即算拆钢板） */
function playOverlapsPlate(play, plates) {
  if (!play?.cards?.length || !plates?.length) return null;
  const playIds = new Set(play.cards.map(cardId));
  const minOverlap = play.type === PLAY_TYPES.single ? 1 : 3;
  let best = null;
  for (const plate of plates) {
    const plateIds = (plate.cards ?? []).map(cardId);
    const overlap = plateIds.filter((id) => playIds.has(id)).length;
    if (overlap >= minOverlap && (!best || overlap > best.overlap)) {
      best = { plate, overlap };
    }
  }
  return best?.plate ?? null;
}

/** 三带/三带二是否会拆理牌后的钢板（含推荐无 cards 时按 mainRank 推断） */
function resolvePlateBreak(play, hand, levelRank, counts) {
  const plates = findPlateGroups(hand, levelRank);
  if (!plates.length || !play) return { brokenPlate: null, tripleAnalysis: null };

  const fromCards = playOverlapsPlate(play, plates);
  if (fromCards) return { brokenPlate: fromCards, tripleAnalysis: null };

  if (play.type === PLAY_TYPES.single && play.mainRank) {
    const brokenPlate = plates.find((plate) => {
      const plateRanks = new Set((plate.cards ?? []).map((card) => card.rank));
      return plateRanks.has(play.mainRank);
    }) ?? null;
    return { brokenPlate, tripleAnalysis: null };
  }

  const tripleTypes = new Set([PLAY_TYPES.triple, PLAY_TYPES.tripleWithPair]);
  if (!tripleTypes.has(play.type) || !play.mainRank) {
    return { brokenPlate: null, tripleAnalysis: null };
  }

  const tripleAnalysis = resolveTripleRankAnalysis({ humanHand: hand, levelRank }, play.mainRank, counts);
  const lockedInPlate = (tripleAnalysis.lockedEntries ?? []).some((entry) => entry.structure === "钢板");
  if (!lockedInPlate) return { brokenPlate: null, tripleAnalysis };

  const brokenPlate = plates.find((plate) => {
    const plateRanks = new Set((plate.cards ?? []).map((card) => card.rank));
    return plateRanks.has(play.mainRank);
  }) ?? plates[0];

  return { brokenPlate, tripleAnalysis };
}

function findSingleCandidate(choices, rank) {
  for (let i = 0; i < choices.length; i++) {
    const play = choices[i].play ?? choices[i].candidate;
    if (play?.type === PLAY_TYPES.single && play.mainRank === rank) {
      return { index: i, choice: choices[i], play };
    }
  }
  return null;
}

function compactSingleLabel(rank) {
  return `单${rankLabel(rank)}`;
}

/** 理牌分组「对子 Q」→ 学习者可读「对Q」 */
function formatPairLabel(pairLabel, rank) {
  if (!pairLabel) return `对${rankLabel(rank)}`;
  const fromGroup = pairLabel.match(/^对子\s+([3-9JQKA2]|10)$/i);
  if (fromGroup) return `对${rankLabel(fromGroup[1])}`;
  return pairLabel;
}

function parseProposedPlayDescription(question) {
  const text = String(question ?? "");

  const whyNotSingle = text.match(/为什么不打\s*(?:单张?\s*)?([3-9]|10|J|Q|K|A|2)/i);
  if (whyNotSingle) {
    const rank = normalizeRank(whyNotSingle[1]);
    return { type: "Single", rank, label: `单张${rankLabel(rank)}` };
  }

  const triple222Pair = text.match(/(?:222|三个2|三带二\s*2).*?(?:带|和|\+)\s*(?:对?\s*)?J/i);
  if (triple222Pair || /为什么.*(?:222|三个2).*带.*J/i.test(text)) {
    return {
      type: "TripleWithPair",
      tripleRank: "2",
      pairRank: "J",
      label: "三个2带对J",
    };
  }

  const whyNotRecommendTriplePair = text.match(
    /为什么不?推荐.*?三个?([3-9]|10|J|Q|K|A|2)\s*(?:带对?|和|\+)\s*([3-9]|10|J|Q|K|A|2)/i,
  );
  if (whyNotRecommendTriplePair) {
    const tripleRank = normalizeRank(whyNotRecommendTriplePair[1]);
    const pairRank = normalizeRank(whyNotRecommendTriplePair[2]);
    return {
      type: "TripleWithPair",
      tripleRank,
      pairRank,
      label: `三个${rankLabel(tripleRank)}带对${rankLabel(pairRank)}`,
    };
  }

  const triplePair = text.match(
    /三个?([3-9]|10|J|Q|K|A|2)\s*(?:带对?|和|\+)\s*([3-9]|10|J|Q|K|A|2)/i,
  );
  if (triplePair) {
    const tripleRank = normalizeRank(triplePair[1]);
    const pairRank = normalizeRank(triplePair[2]);
    return {
      type: "TripleWithPair",
      tripleRank,
      pairRank,
      label: `三个${rankLabel(tripleRank)}带对${rankLabel(pairRank)}`,
    };
  }

  const tripleOnly = text.match(/三个?([3-9]|10|J|Q|K|A|2)/i);
  if (tripleOnly && /三带|带对|对[3-9JQKA2]/i.test(text)) {
    const tripleRank = normalizeRank(tripleOnly[1]);
    const pairMatch = text.match(/对\s*([3-9]|10|J|Q|K|A|2)/i);
    const pairRank = pairMatch ? normalizeRank(pairMatch[1]) : null;
    return {
      type: "TripleWithPair",
      tripleRank,
      pairRank,
      label: pairRank
        ? `三个${rankLabel(tripleRank)}带对${rankLabel(pairRank)}`
        : `三个${rankLabel(tripleRank)}组三带二`,
    };
  }

  const betterSingle = text.match(/打\s*([3-9]|10|J|Q|K|A|2)\s*不是更好/i);
  if (betterSingle) {
    const rank = normalizeRank(betterSingle[1]);
    return { type: "Single", rank, label: `单张${rankLabel(rank)}` };
  }

  const worseSingle = text.match(/打\s*([3-9]|10|J|Q|K|A|2)\s*不好吗/i);
  if (worseSingle) {
    const rank = normalizeRank(worseSingle[1]);
    return { type: "Single", rank, label: `单张${rankLabel(rank)}` };
  }

  const singlePlay = text.match(/(?:打|出|单张)\s*([3-9]|10|J|Q|K|A|2)/i);
  if (singlePlay && /不是更好|更好吗|不好吗|为什么不|为何不打|怎么不打/i.test(text)) {
    const rank = normalizeRank(singlePlay[1]);
    return { type: "Single", rank, label: `单张${rankLabel(rank)}` };
  }

  const bombStraight = text.match(/拆\s*([3-9]|10|J|Q|K|A|2)\s*炸/i);
  if (/顺子|组顺|910JQK|9.?10.?J.?Q.?K/i.test(text) || (bombStraight && /顺/.test(text))) {
    const bombRank = bombStraight ? normalizeRank(bombStraight[1]) : null;
    return {
      type: "Straight",
      bombRank,
      label: bombRank ? `顺子（动${rankLabel(bombRank)}炸）` : "顺子",
    };
  }

  return null;
}

const BOMB_PLAY_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

function beatLabelFromPlay(play) {
  if (!play) return "场上牌";
  if (play.label) return play.label;
  if (play.type === PLAY_TYPES.single && play.mainRank) return `单张 ${rankLabel(play.mainRank)}`;
  if (play.type === PLAY_TYPES.pair && play.mainRank) return `对子 ${rankLabel(play.mainRank)}`;
  return "场上牌";
}

function playShortLabel(play) {
  if (!play) return "—";
  if (play.label) return play.label;
  if (play.type === PLAY_TYPES.pass) return "过牌";
  if (play.type === PLAY_TYPES.bomb && play.mainRank) {
    const size = play.length ?? play.bombSize ?? play.cards?.length ?? 4;
    return size >= 5 ? `五炸${rankLabel(play.mainRank)}` : `炸弹${rankLabel(play.mainRank)}`;
  }
  if (play.mainRank) return `${play.type} ${rankLabel(play.mainRank)}`;
  return play.type ?? "—";
}

function partnerIndexFromContext(context) {
  if (context.partnerIndex != null) return context.partnerIndex;
  const human = context.humanPlayerIndex ?? 0;
  return (human + 2) % 4;
}

function partnerNameFromContext(context) {
  const names = context.playerNames ?? ["你", "下家", "对家", "上家"];
  return names[partnerIndexFromContext(context)] ?? "队友";
}

function isPartnerLastPlayer(context) {
  const table = context.table ?? {};
  const lastIdx = table.lastActivePlayerIndex ?? context.lastActivePlayerIndex;
  const mustBeat = table.lastActivePlay;
  if (lastIdx == null || !mustBeat || mustBeat.type === PLAY_TYPES.pass) return false;
  return lastIdx === partnerIndexFromContext(context);
}

/** 从 QA 上下文读取队友余牌数 */
function partnerHandCountFromContext(context) {
  const state = context.state;
  if (state?.players?.length) {
    const partner = partnerIndexFromContext(context);
    const player = state.players.find((item) => item.seatIndex === partner);
    if (player?.finishedOrder) return 0;
    return player?.hand?.length ?? 27;
  }
  const before = context.playersBefore;
  if (Array.isArray(before) && before.length > 0) {
    const partner = partnerIndexFromContext(context);
    const row = before.find((item) => item.playerIndex === partner);
    return row?.handCount ?? 27;
  }
  return 27;
}

function topPlayIsBombOnPartner(context) {
  if (!isPartnerLastPlayer(context)) return false;
  const top = context.currentAdvice?.choices?.[0];
  const topPlay = top?.play ?? top?.candidate;
  return Boolean(topPlay && BOMB_PLAY_TYPES.has(topPlay.type));
}

/** 追问：剩一张该不该过牌让队友 */
function isLastCardFinishYieldQuestion(question, context) {
  const q = String(question ?? "");
  if ((context.humanHand ?? []).length !== 1) return false;
  return /剩.*一张|只剩.*一张|最后一张|就剩.*一张/i.test(q)
    && /过牌|让队友|让牌|该不该/i.test(q);
}

function answerLastCardFinishYieldQuestion(context) {
  const top = context.currentAdvice?.choices?.[0];
  const topPlay = top?.play ?? top?.candidate;
  const lines = [
    "【规则引擎作答】",
    "",
    "结论：**只剩1张且能合法走完时，应直接出完拿头游，不必过牌让队友。**",
    "原则P10（队友让牌）仅在手牌仍多、压队友性价比低时适用；残局自己能走完，团队收益更高。",
  ];
  if (topPlay && topPlay.type !== PLAY_TYPES.pass) {
    lines.push(`左侧推荐1「${playShortLabel(topPlay)}」与残局走完节奏一致。`);
  } else if (topPlay?.type === PLAY_TYPES.pass) {
    lines.push("左侧推荐1是过牌，残局只剩1张时不应让牌，应改出完。");
  }
  return {
    source: "rule-engine",
    mode: "last-card-finish",
    text: lines.join("\n"),
  };
}

/** 追问：为何要压队友 / 为何拦队友牌权 */
function isWhyBeatPartnerQuestion(question) {
  const q = String(question ?? "");
  if (/为什么要压队友|为何要压队友|为什么压队友|压队友.*为什么|压队友的牌/i.test(q)) return true;
  if (/为什么|为何|为啥/.test(q) && /压|打|炸|拦/.test(q) && /队友|对家|老史/i.test(q)) return true;
  return false;
}

/** 追问：队友冲刺局是否应立即五炸夺权 */
function isPartnerSprintBombQuestion(question, context) {
  const q = String(question ?? "");
  const partnerCount = partnerHandCountFromContext(context);
  if (partnerCount > 2) return false;
  if (!isPartnerLastPlayer(context) && partnerCount <= 2) {
    if (/五炸|炸弹|炸掉|打炸|夺权|接风/.test(q) && /队友|老史|对家|走完|头游|勇哥/.test(q)) return true;
    if (/队友|老史|对家/.test(q) && /剩.*[12一两]张|只剩.*张|单牌/.test(q)) return true;
    if (/该不该.*炸|要不要.*炸|应该.*炸|必须.*炸/.test(q)) return true;
  }
  return false;
}

function answerPartnerSprintBombQuestion(question, context, counts) {
  const partnerName = partnerNameFromContext(context);
  const partnerCount = partnerHandCountFromContext(context);
  const table = context.table ?? {};
  const mustBeat = table.lastActivePlay;
  const beatLabel = beatLabelFromPlay(mustBeat);
  const top = context.currentAdvice?.choices?.[0];
  const topPlay = top?.play ?? top?.candidate;
  const heldJ = counts.get("J") ?? 0;
  const lines = [
    "【规则引擎作答】",
    "",
    `结论：${partnerName}只剩${partnerCount}张，这是冲刺局，**应立即满张五炸夺权**，给队友接风走完。`,
    `原则P5（队友冲刺）：须压对手${beatLabel}时，过牌会让对手继续走牌；勇哥等对手余牌少，可能先走完。`,
    "原则P7（满张控权）：有五炸时不应拆四炸，整炸夺权最稳。",
  ];

  if (topPlay?.type === PLAY_TYPES.pass) {
    lines.push(`左侧推荐1是过牌，与本冲刺局不符；应改打满张五炸。`);
  } else if (topPlay && BOMB_PLAY_TYPES.has(topPlay.type)) {
    const bombSize = topPlay.bombSize ?? topPlay.cards?.length ?? 0;
    if (bombSize >= heldJ && heldJ >= 5) {
      lines.push(`左侧推荐1「${playShortLabel(topPlay)}」与冲刺节奏一致。`);
    } else {
      lines.push(`左侧推荐1「${playShortLabel(topPlay)}」偏拆炸；应满张五炸，勿拆四炸。`);
    }
  }

  return {
    source: "rule-engine",
    mode: "partner-sprint-bomb",
    text: lines.join("\n"),
  };
}

/** 追问：大炸/五炸不必着急，等队友节奏或接风 */
function isWhyNotRushBigBombQuestion(question, context) {
  const q = String(question ?? "");
  if (context && partnerHandCountFromContext(context) <= 2 && !isPartnerLastPlayer(context)) {
    return false;
  }
  if (/不用着急|不必着急|不着急|不用急|别急/i.test(q) && /五炸|五个?[JQKA2十2-9]|大炸|满张炸|炸弹/i.test(q)) {
    return true;
  }
  if (/五炸|五个J|五个j/i.test(q) && /老史|队友|对家|接风|过牌|勇哥|等.*压/i.test(q)) return true;
  if (/老史.*出.*A|队友.*出.*A/i.test(q) && /五炸|五个J|不用急|接风|过牌/i.test(q)) return true;
  if (/接风/i.test(q) && /不用急|不用着急|五炸|大炸|老史|队友|勇哥.*压/i.test(q)) return true;
  return false;
}

function answerWhyBeatPartnerQuestion(context, counts) {
  const partnerName = partnerNameFromContext(context);
  const table = context.table ?? {};
  const mustBeat = table.lastActivePlay;
  const beatLabel = beatLabelFromPlay(mustBeat);
  const partnerLeads = isPartnerLastPlayer(context);
  const top = context.currentAdvice?.choices?.[0];
  const topPlay = top?.play ?? top?.candidate;
  const lines = [
    "【规则引擎作答】",
    "",
    "结论：你的理解是对的，**不应压队友牌权**。",
  ];

  if (partnerLeads) {
    lines.push(
      `原则P10（队友节奏）：${partnerName}本墩已出${beatLabel}占牌，你应过牌让权，让队友继续走或等对手来压。`,
    );
  } else {
    lines.push(
      `原则P10（队友节奏）：若桌面最后是${partnerName}的牌，正常应过牌，不叠炸、不抢队友牌权。`,
    );
  }

  if (topPlayIsBombOnPartner(context)) {
    lines.push(
      `左侧推荐1「${playShortLabel(topPlay)}」若用来压${partnerName}的${beatLabel}，属于推荐失误；这手应过牌。`,
    );
  } else if (topPlay?.type === PLAY_TYPES.pass) {
    lines.push(`左侧推荐1已是过牌，与 P10 一致。`);
  } else if (topPlay?.label) {
    lines.push(`左侧当前推荐1：${playShortLabel(topPlay)}；若仍在压${partnerName}，请改走过牌。`);
  }

  lines.push("大炸/五炸留到对手冲刺、关键控权，或给队友接风时再亮。");
  return {
    source: "rule-engine",
    mode: "why-beat-partner",
    text: lines.join("\n"),
  };
}

function answerWhyNotRushBigBombQuestion(question, context, counts) {
  const partnerName = partnerNameFromContext(context);
  const table = context.table ?? {};
  const mustBeat = table.lastActivePlay;
  const beatLabel = beatLabelFromPlay(mustBeat);
  const partnerLeads = isPartnerLastPlayer(context);
  const top = context.currentAdvice?.choices?.[0];
  const topPlay = top?.play ?? top?.candidate;
  const heldJ = counts.get("J") ?? 0;
  const hasFiveJBomb = heldJ >= 5;
  const lines = [
    "【规则引擎作答】",
    "",
    "结论：你的节奏判断合理，**牌局尚早不宜用大炸压队友或过早亮五炸**。",
  ];

  if (partnerLeads) {
    lines.push(
      `原则P10：${partnerName}已出${beatLabel}占牌，你应过牌让队友继续；五炸压队友单/对性价比极低。`,
    );
  } else {
    lines.push("原则P10：队友占牌时应过牌让权，不必抢队友牌路。");
  }

  if (/勇哥|对手.*压|再出.*单|两张单/i.test(question)) {
    lines.push(
      `你描述的「${partnerName}再出单 → 勇哥压 → 你再炸给${partnerName}接风」是合理的团队节奏，不必现在动五炸。`,
    );
  } else {
    lines.push(
      `队友仍有多牌时，可过牌等对手来压或等${partnerName}自己走完，再考虑用炸接风/控权。`,
    );
  }

  if (mustBeat?.type === PLAY_TYPES.single && /[SAJ]|王/.test(mustBeat.mainRank ?? "")) {
    lines.push("若须压的是对手王/A：五炸压单张性价比低，队友可能还有小炸，可过牌等循环。");
  }

  if (topPlayIsBombOnPartner(context) && hasFiveJBomb) {
    lines.push(
      `左侧推荐1「${playShortLabel(topPlay)}」用来压${partnerName}的${beatLabel}有问题；这手应过牌，五炸留到关键控权。`,
    );
  } else if (topPlay?.type === PLAY_TYPES.pass) {
    lines.push(`左侧推荐1已是过牌，与你的判断一致。`);
  } else if (topPlay && BOMB_PLAY_TYPES.has(topPlay.type)) {
    lines.push(`左侧推荐1「${playShortLabel(topPlay)}」偏急；优先过牌等队友/循环。`);
  } else if (topPlay) {
    lines.push(`左侧当前推荐1：${playShortLabel(topPlay)}。`);
  }

  return {
    source: "rule-engine",
    mode: "why-not-rush-bomb",
    text: lines.join("\n"),
  };
}

/** 「为何不用某炸弹压 / 为何用小炸不用大炸」类追问 */
function isWhyNotBombQuestion(question) {
  const q = String(question ?? "");
  if (/为什么用|为何用|为啥用/i.test(q) && /不用/i.test(q)) return true;
  if (/不用/i.test(q) && /(?:四个?|四张?).*[压炸]|[3-9JQKA2].*炸|炸.*压/i.test(q)) return true;
  if (/为什么|为何|为啥|怎么/.test(q) && /不用|不\s*用/.test(q) && /(?:四个?|四张?|[3-9JQKA2]|10).*(?:压|炸)/i.test(q)) {
    return true;
  }
  return false;
}

/** 解析用户提议的炸弹点数（四个2 → rank 2）及对比点数（为什么用9不用2） */
function parseProposedBombQuestion(question) {
  const text = String(question ?? "");
  const useVsNot = text.match(/为什么用\s*([3-9]|10|J|Q|K|A|2)\s*不用\s*([3-9]|10|J|Q|K|A|2)/i);
  if (useVsNot) {
    return {
      proposedRank: normalizeRank(useVsNot[2]),
      contrastRank: normalizeRank(useVsNot[1]),
    };
  }
  const fourRank = text.match(/(?:四个?|四张?)\s*([3-9]|10|J|Q|K|A|2)/i);
  if (fourRank) return { proposedRank: normalizeRank(fourRank[1]), contrastRank: null };
  const rankBomb = text.match(/不用\s*(?:四个?|四张?)?\s*([3-9]|10|J|Q|K|A|2)\s*炸/i);
  if (rankBomb) return { proposedRank: normalizeRank(rankBomb[1]), contrastRank: null };
  const notUsePress = text.match(
    /(?:为什么|为何|为啥|怎么).*(?:不用|不\s*用)\s*(?:四个?|四张?)?\s*([3-9]|10|J|Q|K|A|2)\s*(?:压|炸)/i,
  );
  if (notUsePress) return { proposedRank: normalizeRank(notUsePress[1]), contrastRank: null };
  return { proposedRank: null, contrastRank: null };
}

function formatBombShort(rank, count = 4) {
  if (count >= 5) return `${count}张${rankLabel(rank)}五炸`;
  return `四张${rankLabel(rank)}`;
}

function isBombPlay(play) {
  return Boolean(play && BOMB_PLAY_TYPES.has(play.type));
}

function findBombInChoices(choices, rank) {
  for (let i = 0; i < choices.length; i++) {
    const play = choices[i].play ?? choices[i].candidate;
    if (play?.type === PLAY_TYPES.bomb && play.mainRank === rank) {
      return { index: i, choice: choices[i], play };
    }
  }
  return null;
}

function syntheticBombPlay(rank, levelRank, bombSize = 4) {
  return {
    type: PLAY_TYPES.bomb,
    mainRank: rank,
    bombSize,
    power: rankPower(rank, levelRank),
  };
}

/** 判断提议炸弹能否压过桌面牌（补齐缺失的 bombSize/power） */
function proposedBombBeats(mustBeat, proposedRank, levelRank, bombSize = 4) {
  if (!mustBeat) return true;
  const proposedPlay = syntheticBombPlay(proposedRank, levelRank, bombSize);
  let previous = mustBeat;
  if (isBombPlay(mustBeat)) {
    previous = {
      ...mustBeat,
      bombSize: mustBeat.bombSize ?? 4,
      power: mustBeat.power ?? rankPower(mustBeat.mainRank, levelRank),
    };
  }
  return canBeat(proposedPlay, previous);
}

function bombReservePhrase(rank, levelRank) {
  if (rank === "2" && levelRank === "2") return "2炸通常留到残局或更大威胁时再亮";
  if (rank === "2" && isSmallestNonJokerRank("2", levelRank)) {
    return `本局级牌是${rankLabel(levelRank)}，2是最小炸并非大牌`;
  }
  if (isControlRank(rank, levelRank)) return `${rankLabel(rank)}炸是控权资源，非必要不消耗`;
  return `${rankLabel(rank)}炸留给更关键局面`;
}

/** 对比推荐炸弹 vs 用户提议炸弹，说明炸弹时机与保留大牌炸 */
function answerWhyNotBombQuestion(question, context, counts, facts) {
  const { proposedRank, contrastRank } = parseProposedBombQuestion(question);
  if (!proposedRank) return null;

  const levelRank = context.levelRank ?? "2";
  const choices = context.currentAdvice?.choices ?? [];
  const top = choices[0];
  const topPlay = top?.play ?? top?.candidate;
  const table = context.table ?? {};
  const mustBeat = table.lastActivePlay ?? null;
  const proposedHeld = counts.get(proposedRank) ?? 0;
  const proposedBomb = facts.bombs.find((b) => b.rank === proposedRank);
  const topReasons = learnerTopReasons(top, 2, {
    ...context,
    levelRank,
    previousPlay: mustBeat,
    brief: true,
  });
  const proposedShort = formatBombShort(
    proposedRank,
    proposedBomb?.count ?? (proposedHeld >= 4 ? proposedHeld : 4),
  );
  const contentLines = [];

  if (!proposedBomb && proposedHeld < 4) {
    contentLines.push(`组不出${proposedShort}：手里${rankLabel(proposedRank)}只有 ${proposedHeld} 张。`);
    if (topPlay?.label) contentLines.push(`推荐1用${topPlay.label}。`);
  } else if (mustBeat && !proposedBombBeats(mustBeat, proposedRank, levelRank, proposedBomb?.count ?? 4)) {
    const beatLabel = mustBeat.label ?? "场上牌";
    contentLines.push(`${proposedShort}压不住${beatLabel}，这手得用更大炸。`);
    const levelNote = briefLevelRankNote(proposedRank, levelRank);
    if (levelNote && contentLines.length < 4) contentLines.push(`${levelNote}。`);
    if (isBombPlay(topPlay)) {
      contentLines.push(`推荐四张${rankLabel(topPlay.mainRank)}：牌力刚好够抢回牌权。`);
    } else if (topPlay?.type !== PLAY_TYPES.pass && topPlay?.label) {
      contentLines.push(`推荐1用${topPlay.label}。`);
    }
  } else if (topPlay?.type === PLAY_TYPES.pass) {
    const passReason = topReasons[0] ?? "保留炸弹资源";
    contentLines.push(`这手推荐过牌：${passReason}。`);
    if (isBombPlay(mustBeat)) {
      const oppPower = rankPower(mustBeat.mainRank, levelRank);
      const propPower = rankPower(proposedRank, levelRank);
      if (propPower > oppPower) {
        contentLines.push(`对手四张${rankLabel(mustBeat.mainRank)}牌面不大，${proposedShort}能压但代价偏高。`);
      } else {
        contentLines.push(`${proposedShort}牌力压不住对手四张${rankLabel(mustBeat.mainRank)}。`);
      }
    }
    contentLines.push(`${bombReservePhrase(proposedRank, levelRank)}。`);
  } else if (!isBombPlay(topPlay)) {
    const beatIsSmall = mustBeat
      && (mustBeat.type === PLAY_TYPES.single || mustBeat.type === PLAY_TYPES.pair);
    if (beatIsSmall) {
      const kind = mustBeat.type === PLAY_TYPES.single ? "单张" : "对子";
      contentLines.push(`对手出${kind}，${topPlay.label ?? "普通牌"}够压，不必动用炸弹。`);
    } else if (mustBeat) {
      contentLines.push(`${topPlay.label ?? "普通牌"}能抢回牌权，不必先亮${proposedShort}。`);
    } else {
      contentLines.push(`有牌权时用${topPlay.label ?? "成组牌"}减手更划算，不必先炸。`);
    }
    contentLines.push(`${proposedShort}能压，但${bombReservePhrase(proposedRank, levelRank)}。`);
    if (topReasons[0]) contentLines.push(`${topReasons[0]}。`);
  } else if (isBombPlay(topPlay)) {
    const recRank = contrastRank ?? topPlay.mainRank;
    const recShort = formatBombShort(recRank);
    if (proposedRank === recRank) {
      contentLines.push(`${proposedShort}就是推荐1，可以出。`);
    } else if (compareRanks(proposedRank, recRank, levelRank) > 0) {
      if (mustBeat && isBombPlay(mustBeat)) {
        contentLines.push(`对手四张${rankLabel(mustBeat.mainRank)}，${recShort}够压，不必动${proposedShort}。`);
      } else if (mustBeat?.type === PLAY_TYPES.single || mustBeat?.type === PLAY_TYPES.pair) {
        const kind = mustBeat.type === PLAY_TYPES.single ? "单张" : "对子";
        contentLines.push(`对手${kind}牌面不大，${recShort}已够；${proposedShort}浪费牌力。`);
      } else {
        contentLines.push(`${recShort}够压这手，动用${proposedShort}牌力偏大。`);
      }
      contentLines.push(`能用小炸就不用大炸，${bombReservePhrase(proposedRank, levelRank)}。`);
      if (topReasons[0] && contentLines.length < 4) contentLines.push(`${topReasons[0]}。`);
    } else {
      const proposedSize = proposedBomb?.count ?? (proposedHeld >= 4 ? proposedHeld : 4);
      const proposedCanBeat = !mustBeat
        || proposedBombBeats(mustBeat, proposedRank, levelRank, proposedSize);
      if (proposedCanBeat) {
        if (mustBeat && isBombPlay(mustBeat)) {
          contentLines.push(
            `对手四张${rankLabel(mustBeat.mainRank)}，${proposedShort}够压，不必动用${recShort}。`,
          );
        } else if (mustBeat?.type === PLAY_TYPES.single || mustBeat?.type === PLAY_TYPES.pair) {
          const kind = mustBeat.type === PLAY_TYPES.single ? "单张" : "对子";
          contentLines.push(`对手${kind}，${proposedShort}够压，不必动用${recShort}。`);
        } else if (mustBeat) {
          contentLines.push(`这手${proposedShort}够压，不必动用${recShort}。`);
        } else {
          contentLines.push(`${proposedShort}牌力足够，不必动用${recShort}。`);
        }
        contentLines.push(`能用小炸就不用大炸，${bombReservePhrase(recRank, levelRank)}。`);
        if (topReasons[0] && contentLines.length < 4) {
          contentLines.push(`推荐${recShort}偏大，${topReasons[0]}。`);
        }
      } else {
        contentLines.push(`${proposedShort}压不住场上牌，这手得用${recShort}。`);
        if (topReasons[0]) contentLines.push(`推荐${recShort}：${topReasons[0]}。`);
      }
    }
  }

  if (contentLines.length === 0) return null;

  const answerText = sanitizeControlNarrative(
    ["【规则引擎作答】", ...contentLines.slice(0, 4)].join("\n"),
    levelRank,
  );
  return { source: "rule-engine", mode: "why-not-bomb", text: answerText };
}

/** 追问推荐1是否拆了某点数的三个（如「而且还拆了三个2？」） */
function isWhyBreakRankInRecommendQuestion(question) {
  const q = String(question ?? "");
  if (isWhyPreferPairOverTripleBreakQuestion(q)) return false;
  if (/为什么不打|为何不打|怎么不打|为啥不打|为什么不推荐|为何不推荐/.test(q)) return false;
  if (/打了三个|出了三个/i.test(q) && /炸弹|作废|还在|有没有/i.test(q)) return false;
  return /(?:而且|还|怎么|为什么|为何|为啥)?.*(?:拆了?|破).*?三个?\s*([3-9]|10|J|Q|K|A|2)/i.test(q)
    || (/而且还拆了|还拆三个|怎么还拆/i.test(q) && /三个?\s*([3-9]|10|J|Q|K|A|2)/i.test(q));
}

function parseBreakRankQuestion(question) {
  const text = String(question ?? "");
  const match = text.match(/三个?\s*([3-9]|10|J|Q|K|A|2)/i);
  return match ? normalizeRank(match[1]) : null;
}

function cardRankFromLabelToken(token) {
  const match = String(token ?? "").match(/([3-9]|10|J|Q|K|A|2)$/i);
  return match ? normalizeRank(match[1]) : null;
}

/** 统计某手出牌 label/cards 里某点数的张数 */
function countRankInPlay(play, rank) {
  if (!play) return 0;
  const cards = play.cards ?? [];
  if (cards.length > 0) {
    return cards.filter((card) => card.rank === rank).length;
  }
  const label = play.label ?? "";
  const body = label.replace(/^(三带二|炸弹|单张|对子|三张|连对|钢板|顺子)\s+/u, "");
  return body.split(/\s+/).filter((token) => cardRankFromLabelToken(token) === rank).length;
}

/** 推荐1里该点数作三条/对子各用几张 */
function analyzeRankRoleInTopPlay(play, rank) {
  const totalInPlay = countRankInPlay(play, rank);
  let asTriple = 0;
  let asPair = 0;
  if (play?.type === PLAY_TYPES.tripleWithPair) {
    if (play.mainRank === rank) asTriple = Math.min(3, totalInPlay);
    const pairRank = inferPairRankFromPlay(play);
    if (pairRank === rank) asPair = Math.min(2, totalInPlay - asTriple);
  } else if (play?.type === PLAY_TYPES.triple && play.mainRank === rank) {
    asTriple = Math.min(3, totalInPlay);
  } else if (play?.type === PLAY_TYPES.pair && play.mainRank === rank) {
    asPair = 2;
  }
  if (asTriple === 0 && asPair === 0 && totalInPlay >= 2 && play?.mainRank !== rank) {
    asPair = Math.min(2, totalInPlay);
  }
  if (asTriple === 0 && play?.mainRank === rank && totalInPlay >= 3) {
    asTriple = Math.min(3, totalInPlay);
  }
  return { totalInPlay, asTriple, asPair };
}

function findAlternativeWithoutTripleRank(choices, rank) {
  for (let i = 1; i < choices.length; i++) {
    const play = choices[i].play ?? choices[i].candidate;
    if (!play) continue;
    const role = analyzeRankRoleInTopPlay(play, rank);
    if (role.asTriple < 3) return { index: i, play };
  }
  return null;
}

/** 直接回应「推荐1是否/为何拆了三个X」 */
function answerWhyBreakRankInRecommend(question, context, counts) {
  const rank = parseBreakRankQuestion(question);
  if (!rank) return null;

  const levelRank = context.levelRank ?? "2";
  const choices = context.currentAdvice?.choices ?? [];
  const top = choices[0];
  const topPlay = top?.play ?? top?.candidate;
  if (!topPlay) return null;

  const held = counts.get(rank) ?? 0;
  const tripleAnalysis = resolveTripleRankAnalysis(context, rank, counts);
  const { totalInPlay, asTriple, asPair } = analyzeRankRoleInTopPlay(topPlay, rank);
  const topLabel = topPlay.label ?? "—";
  const hand = context.humanHand ?? [];
  const contentLines = [];

  if (asTriple >= 3) {
    const bombSize = tripleAnalysis.effectiveBombCount || held;
    contentLines.push(`是的，推荐1「${topLabel}」会拆三个${rankLabel(rank)}作三条。`);
    if (tripleAnalysis.wouldBreakBomb || held >= 4) {
      const after = bombSize - 3;
      if (after >= 4) {
        contentLines.push(
          `你手里${bombSize}张${rankLabel(rank)}炸弹，打出3张后仍够四炸，但厚度下降。`,
        );
      } else {
        const remainWord = after === 2 ? `对${rankLabel(rank)}` : after === 1 ? `单${rankLabel(rank)}` : `${after}张${rankLabel(rank)}`;
        contentLines.push(`你手里${held}张${rankLabel(rank)}，打出3张后只剩${remainWord}，整炸作废。`);
      }
    } else {
      contentLines.push(`你手里${held}张${rankLabel(rank)}，不够四炸，拆三条不亏炸弹厚度。`);
    }
    const levelNote = briefLevelRankNote(rank, levelRank);
    if (levelNote) contentLines.push(`${levelNote}。`);
    else if (isControlRank(rank, levelRank)) {
      contentLines.push(`${rankLabel(rank)}是级牌控权牌，拆三条代价偏高。`);
    }
    const alt = findAlternativeWithoutTripleRank(choices, rank);
    if (alt && contentLines.length < 4) {
      contentLines.push(`若不想拆${rankLabel(rank)}，可看候选「${alt.play.label}」。`);
    }
  } else if (asPair >= 2 || (totalInPlay >= 2 && asTriple === 0)) {
    const tripleRank = topPlay.mainRank;
    const pairUsed = totalInPlay || asPair || 2;
    const remain = held - pairUsed;
    contentLines.push(
      `推荐1并未拆三个${rankLabel(rank)}：三条是${rankLabel(tripleRank)}×3，${rankLabel(rank)}只成对带走${pairUsed}张。`,
    );
    contentLines.push(
      `你手里共${held}张${rankLabel(rank)}，打完剩${remain}张${remain === 1 ? `单${rankLabel(rank)}` : rankLabel(rank)}。`,
    );
    const levelNote = briefLevelRankNote(rank, levelRank);
    if (levelNote) {
      contentLines.push(`${levelNote}，用对${rankLabel(rank)}带牌代价低。`);
    } else if (isControlRank(rank, levelRank)) {
      contentLines.push(`${rankLabel(rank)}是级牌控权牌，用对${rankLabel(rank)}带牌需慎重。`);
    }
    const { brokenPlate } = resolvePlateBreak(topPlay, hand, levelRank, counts);
    if (brokenPlate && contentLines.length < 4) {
      contentLines.push(`主要拆的是三张${rankLabel(tripleRank)}和${brokenPlate.label ?? "钢板"}，不是拆${rankLabel(rank)}炸。`);
    } else if (held < 4 && contentLines.length < 4) {
      contentLines.push(`${held}张${rankLabel(rank)}本就不成炸，谈不上拆${rankLabel(rank)}炸弹。`);
    }
  } else if (totalInPlay === 0) {
    contentLines.push(`推荐1「${topLabel}」并未用到${rankLabel(rank)}，没有拆三个${rankLabel(rank)}。`);
    contentLines.push(`你手里${held}张${rankLabel(rank)}仍完整留着。`);
  } else {
    return null;
  }

  const answerText = sanitizeControlNarrative(
    ["【规则引擎作答】", ...contentLines.slice(0, 4)].join("\n"),
    levelRank,
  );
  return { source: "rule-engine", mode: "structure-break", text: answerText };
}

function isBombBreakQuestion(question) {
  if (isWhyNotPlayQuestion(question)) return false;
  if (isWhyNotBombQuestion(question)) return false;
  if (isWhyBreakRankInRecommendQuestion(question)) return false;
  if (isWhyPlayBreaksStraightQuestion(question)) return false;
  if (isWhyTriplePairBreaksStraightQuestion(question)) return false;
  if (isWhyNotUsePairQuestion(question)) return false;
  if (/炸弹|拆炸|拆.*炸|废了|作废|还在不在|还有没有|五张|5张|四个|四张/i.test(question)) return true;
  // 「打了三个A」类事实追问，排除「为什么不打三个2」类对比题
  return /三张|三个/i.test(question) && /打了|出了|拆了|废|还在|没有|还有|算不算/i.test(question);
}

function isTripleWithPairQuestion(question) {
  return /三带二|三带|3带/i.test(question);
}

function isOpponentPressQuestion(question) {
  return /对方|对手|上家|下家|机器人|电脑/.test(question)
    && /不压|不过|放行|为什么.*压|为何不压|为啥不压/.test(question);
}

/** 追问：对手/机器人为何总出单张、拆对/拆结构单打 */
function isOpponentBreakSingleQuestion(question) {
  const q = String(question ?? "");
  if (!/对方|对手|上家|下家|机器人|电脑|勇哥|毛蛋|老史/.test(q)) return false;
  return /拆.*单|单牌|单张|单打|都是单|总.*单|一直.*单|老是.*单|怎么都.*单|净出单|出单/i.test(q)
    || (/为什么|为何|为啥|怎么/.test(q) && /单/.test(q));
}

function answerOpponentBreakSingleQuestion(question, context) {
  const recent = (context.recentPlayHistory ?? context.playHistory ?? []).slice(-12);
  const oppSingles = recent.filter(
    (item) => item.play?.type === PLAY_TYPES.single
      && item.playerName
      && !/你/.test(item.playerName),
  );
  const oppNames = [...new Set(oppSingles.map((item) => item.playerName))];
  const sample = oppSingles.slice(-3);
  const lines = [
    "【规则引擎作答】",
    "",
    "结论：勇哥、毛蛋是**机器人快算路径**出牌，跟牌时优先【P2】「无散单就从对子拆最小够压单」；领出时也常用小单试探，所以你会经常看到它们「拆牌出单」。",
    "",
    "具体机制：",
    "1. 机器人用 lite 评分（候选少、不理牌分组），跟你的单张时会挑**能压的最小单**，手里没散单就拆对子；",
    "2. 领出/接风阶段小单成本低，机器人不爱过早亮连对、钢板，显得一直在送单；",
    "3. 手牌仍多时机器人还会【P12】节制用炸，进一步放大「单张来回」的节奏。",
    "",
    "对你方的启示（与人类教练一致）：",
    "- 你有散单时坚持【P1】不拆结构；",
    "- 对手连续小单试探时，该跟就跟、该用成组牌抢权就别空过（本局多处过牌分歧即此类）。",
  ];
  if (sample.length > 0) {
    lines.push("", "本局最近对手单张：");
    for (const item of sample) {
      lines.push(`- ${item.playerName ?? "对手"}：${item.play?.label ?? "单张"}`);
    }
  } else if (oppNames.length > 0) {
    lines.push("", `本局对手 ${oppNames.join("、")} 以单张跟牌/试探为主，属机器人策略表现，不是真人习惯。`);
  }
  return {
    source: "rule-engine",
    mode: "opponent-break-single",
    text: lines.join("\n"),
  };
}

function isOpponentOneCardPressQuestion(question) {
  return /报单|剩\s*1\s*张|一张牌|末张|最后一张|双上/.test(question)
    && /压|跟|出|级牌|放行|走掉|逃脱/.test(question);
}

function isWildCardQuestion(question) {
  return /逢人配|红心级|万能牌|理牌|怎么配|配什么|用在哪/i.test(question);
}

function isReportCardQuestion(question) {
  return /报牌|要不要报|需要报|该不该报|几张要报|报几张|主动报|问报|报\d+张|剩.*张.*报|要不要报牌/i.test(question);
}

function answerReportCardQuestion(context) {
  const handCount = (context.humanHand ?? []).length;
  const lines = [
    "【规则引擎 · 报牌】",
    "",
    `你当前剩 ${handCount} 张。`,
    "",
    "官方：出完一手后剩余 ≤10 张须主动报牌，只报张数不报牌型（如「剩 8 张」）；10 张档通常只报一次。",
    "民间：部分地区 ≤6 张才报；剩 1 张几乎必报。正式比赛禁止问报。",
    "违规：未报/报错 → 收回重出+警告；已再出牌停一圈；已出完判下游。",
    "",
    "口诀：十张主动报，只报张数不报套；一牌必报是惯例，违规要被下游靠。",
  ];
  if (handCount === 1) {
    lines.push("", "→ 只剩 1 张，务必口头报「剩 1 张」。");
  } else if (handCount <= 10) {
    lines.push("", `→ 按规则应口头报「剩 ${handCount} 张」。`);
  } else {
    lines.push("", "→ 目前无需报牌；减到 10 张及以内时再报。");
  }
  return { source: "rule-engine", mode: "report-card", text: lines.join("\n") };
}

function inferCatchWindFromContext(context) {
  const table = context.table ?? {};
  if (table.lastActivePlay) return false;
  const state = context.state;
  if (state) return inferLeadMode(state, context.playerIndex ?? 0) === "catch-wind";
  return (context.humanHand ?? []).length <= 10;
}

function answerCatchWindStraightQuestion(question, context, counts, proposed = null) {
  const levelRank = context.levelRank ?? "2";
  const hand = context.humanHand ?? [];
  const handCount = hand.length;
  const table = context.table ?? {};
  const hasInitiative = !table.lastActivePlay;
  const isCatchWind = inferCatchWindFromContext(context);
  const top = context.currentAdvice?.choices?.[0];
  const topPlay = top?.play ?? top?.candidate;
  const topLabel = topPlay?.label ?? top?.candidate?.label ?? "—";
  const rankMatch = String(question ?? "").match(/([3-9]|10|J|Q|K|A|2)\s*炸/i);
  const bombRank = proposed?.bombRank ?? (rankMatch ? normalizeRank(rankMatch[1]) : null);
  const held = bombRank ? (counts.get(bombRank) ?? 0) : 0;
  const lines = ["【规则引擎作答】"];
  const contentLines = [];

  if (hasInitiative && isCatchWind && handCount <= 10) {
    contentLines.push("结论：接风残局优先一次减五张的顺子，通常优于小单试探。");
    if (bombRank && held >= 4) {
      const afterOne = held - 1;
      if (afterOne >= 4) {
        contentLines.push(
          `顺子里用 1 张${rankLabel(bombRank)}，手里仍剩 ${afterOne} 张${rankLabel(bombRank)}可成四炸，炸弹并未作废。`,
        );
        if (held >= 5) {
          contentLines.push(`五炸变薄成四炸可以接受：接风一次减 5 张，比打单张 10 等更赚。`);
        } else {
          contentLines.push(`动最小炸组顺换减手节奏，比接风打小单更赚。`);
        }
      } else {
        contentLines.push(
          `这手顺子会拆${rankLabel(bombRank)}整炸（拆后不足四张），需慎重；能保留四炸的顺子路线更优。`,
        );
      }
    } else if (bombRank) {
      contentLines.push(`你手里 ${rankLabel(bombRank)} 不足四张，谈不上拆整炸。`);
    }
    if (topPlay?.type === PLAY_TYPES.straight) {
      contentLines.push(`左侧推荐1「${topLabel}」就是这条顺子减手路线。`);
    } else if (topPlay?.type === PLAY_TYPES.single) {
      contentLines.push(`左侧推荐1「${topLabel}」偏保守；你已组好顺子时，直接走顺子更优。`);
    } else if (topLabel !== "—") {
      contentLines.push(`当前推荐1「${topLabel}」；能一次减五张的顺子通常优先。`);
    }
  } else if (hasInitiative) {
    contentLines.push("结论：有牌权时顺子能一次减多张，节奏上往往优于散单。");
    if (bombRank && held >= 4) {
      contentLines.push(
        physicalRankCountPhrase(hand, bombRank)
          ?? `动${rankLabel(bombRank)}炸组顺需看拆后是否仍够四张。`,
      );
    }
    contentLines.push(`当前推荐1「${topLabel}」。`);
  } else {
    contentLines.push("结论：这手需压牌，顺子能否出要看能否压过桌面。");
    contentLines.push(`当前推荐1「${topLabel}」。`);
  }

  const answerText = sanitizeControlNarrative(
    [...lines, ...contentLines].join("\n"),
    levelRank,
  );
  return { source: "rule-engine", mode: "why-not-play", text: answerText };
}

function physicalRankCountPhrase(hand, rank) {
  const held = hand.filter((card) => card.rank === rank).length;
  if (held < 4) return null;
  return `你手里 ${held} 张${rankLabel(rank)}；顺子只用 1 张时仍剩 ${held - 1} 张，${held - 1 >= 4 ? "炸弹还在" : "炸弹会作废"}`;
}

function answerWhyRecommendTripleOverRecovery(question, context) {
  const q = String(question ?? "");
  if (!isWhyRecommendTripleQuestion(q)) {
    return null;
  }
  const choices = context.currentAdvice?.choices ?? [];
  const top = choices[0];
  const topPlay = top?.play ?? top?.candidate;
  if (topPlay?.type !== PLAY_TYPES.tripleWithPair) return null;

  const hand = context.humanHand ?? [];
  const levelRank = context.levelRank ?? "2";
  const hasBJ = hand.some((card) => card.rank === "BJ");
  const hasInitiative = !(context.table ?? {}).lastActivePlay;
  const isCatchWind = inferCatchWindFromContext(context);
  if (!hasInitiative || (context.state && !isCatchWind) || !hasBJ) return null;

  const topLabel = topPlay.label ?? "—";
  const topShort = compactPlayShortLabel(topPlay) ?? topLabel;
  const plates = findPlateGroups(hand, levelRank);
  const contentLines = [
    "【规则引擎作答】",
    `不推荐${topShort}：无送单回收路径，被压后只能靠炸。`,
  ];
  if (plates.length > 0) {
    contentLines.push(`可先小单+大王回收牌权，或直接打${plates[0].label ?? "钢板"}一次减6张。`);
  } else {
    contentLines.push("有大王时先小单试探，回收牌权后再走成组减手更优。");
  }

  return {
    source: "rule-engine",
    mode: "why-not-play",
    text: sanitizeControlNarrative(contentLines.join("\n"), levelRank),
  };
}

function answerWhyNotPlayQuestion(question, context, counts, facts) {
  const whyRecommendTriple = answerWhyRecommendTripleOverRecovery(question, context);
  if (whyRecommendTriple) return whyRecommendTriple;

  const whyLooseSingleAnswer = answerWhyBreakInsteadOfLooseSingleQuestion(question, context, counts);
  if (whyLooseSingleAnswer) return whyLooseSingleAnswer;

  if (isWhyPairChainVsPairQuestion(question)) {
    const pairChainAnswer = answerWhyPairChainVsPairQuestion(question, context, counts);
    if (pairChainAnswer) return pairChainAnswer;
  }

  if (isWhyNotPlateQuestion(question)) {
    return answerWhyNotPlateQuestion(question, context, counts);
  }

  if (isWhyPlayBreaksStraightQuestion(question)) {
    const straightAnswer = answerWhyPlayBreaksStraightQuestion(question, context, counts);
    if (straightAnswer) return straightAnswer;
  }

  if (isWhyNotUsePairQuestion(question)) {
    const pairAnswer = answerWhyNotUsePairQuestion(question, context, counts);
    if (pairAnswer) return pairAnswer;
  }

  const whyPlayAnswer = answerWhyPlayRecommendedQuestion(question, context, counts);
  if (whyPlayAnswer) return whyPlayAnswer;

  const proposed = parseProposedPlayDescription(question);
  const choices = context.currentAdvice?.choices ?? [];
  const top = choices[0];
  const topLabel = top?.play?.label ?? top?.candidate?.label ?? "—";
  const table = context.table ?? {};
  const hasInitiative = !table.lastActivePlay;
  const lines = ["【规则引擎作答】"];

  if (
    proposed?.type === "Straight"
    || (/拆.*炸|炸.*拆/.test(question) && /顺子|组顺/.test(question))
  ) {
    return answerCatchWindStraightQuestion(question, context, counts, proposed);
  }

  if (proposed?.type === "TripleWithPair" && proposed.pairRank) {
    const tripleKickerAnswer = answerWhyNotRecommendTriplePairKickerQuestion(
      question,
      context,
      counts,
      proposed,
    );
    if (tripleKickerAnswer) return tripleKickerAnswer;
  }

  if (proposed?.type === "TripleWithPair") {
    const { tripleRank, pairRank, label } = proposed;
    const levelRank = context.levelRank ?? "2";
    const tripleHeld = counts.get(tripleRank) ?? 0;
    const pairHeld = pairRank ? (counts.get(pairRank) ?? 0) : 0;
    const tripleAnalysis = resolveTripleRankAnalysis(context, tripleRank, counts);
    const wouldBreakBomb = tripleAnalysis.wouldBreakBomb;
    const canForm = canFormTripleWithPair(counts, tripleRank, pairRank, tripleAnalysis);
    const matched = findTripleWithPairCandidate(choices, tripleRank, pairRank);
    const topPlay = top?.play ?? top?.candidate;
    const topType = topPlay?.type;
    const topMainRank = topPlay?.mainRank;
    const topPairRank = inferPairRankFromPlay(topPlay);
    const topShort = compactPlayShortLabel(topPlay) ?? topLabel;
    const userShort = compactTripleWithPairLabel(tripleRank, pairRank) ?? label;
    const turn = context.turnNumber ?? null;
    const isOpeningLead = (turn === 0 || turn === "0") && hasInitiative;
    const sharedPairRank = Boolean(pairRank && topPairRank === pairRank);
    const sameTriplePairShape = topType === "TripleWithPair" && sharedPairRank && topMainRank && tripleRank;
    const topIsBareTriple = topType === PLAY_TYPES.triple || topType === "Triple";
    const tripleIsControl = isControlRank(tripleRank, levelRank);
    const topStronger = Boolean(topMainRank && compareRanks(topMainRank, tripleRank, levelRank) > 0);
    const userHumanLabel = pairRank
      ? `三个${rankLabel(tripleRank)}带对${rankLabel(pairRank)}`
      : label;
    const contentLines = [];

    if (!canForm) {
      if (tripleAnalysis.availableCount < 3) {
        const detail = tripleAnalysis.lockedSummary
          ?? `手里只有 ${tripleHeld} 张${rankLabel(tripleRank)}`;
        contentLines.push(`组不出${userHumanLabel}：${detail}。`);
      } else if (pairRank && pairHeld < 2) {
        contentLines.push(`组不出${userHumanLabel}：${rankLabel(pairRank)}只有 ${pairHeld} 张，带不了对。`);
      } else {
        contentLines.push(`组不出${userHumanLabel}：当前手牌凑不齐。`);
      }
      if (topShort && topShort !== "—") {
        contentLines.push(`推荐1用${topShort}。`);
      }
    } else if (matched?.index === 0) {
      contentLines.push(`${userHumanLabel}就是左侧推荐1，可以出。`);
    } else if (wouldBreakBomb) {
      const bombNote = bombLabel(tripleRank, tripleAnalysis.effectiveBombCount || tripleHeld) ?? "整炸";
      contentLines.push(`不推荐${userHumanLabel}：会拆${bombNote}。`);
      const topShed = topIsBareTriple ? 3 : 5;
      contentLines.push(`推荐1用${topShort}减 ${topShed} 张，且不拆炸。`);
      contentLines.push(`你若判断对手压不住${userShort}，拆炸冒险也行，但默认不推荐。`);
    } else {
      contentLines.push(`可以出${userHumanLabel}：${briefLockedStructurePhrase(tripleAnalysis)}。`);

      const recommendParts = [];
      const levelNote = briefLevelRankNote(tripleRank, levelRank);
      if (levelNote) recommendParts.push(levelNote);
      if (topIsBareTriple && topMainRank === tripleRank) {
        recommendParts.push("推荐1是裸三张，不是三带二");
      } else if (sameTriplePairShape && topMainRank && topMainRank !== tripleRank && topStronger) {
        recommendParts.push(`三个${rankLabel(tripleRank)}的三带二主牌不如三个${rankLabel(topMainRank)}`);
      } else if (tripleIsControl) {
        recommendParts.push(`更省${rankLabel(tripleRank)}控权大牌`);
      }

      const scenePrefix = hasInitiative ? "自由出牌" : "这手";
      const actionWord = isOpeningLead && hasInitiative ? "拿牌权" : "减手";
      contentLines.push(
        `${recommendParts.join("，")}；${scenePrefix}推荐1用${topShort}${actionWord}。`,
      );

      if (matched && matched.index > 0) {
        contentLines.push(`${userShort}在候选第 ${matched.index + 1} 位，首推更保守。`);
      } else if (tripleIsControl) {
        contentLines.push(`你若想出${userShort}也可以，只是会提前动用控权大牌。`);
      } else if (topIsBareTriple && topMainRank === tripleRank) {
        contentLines.push(
          `三带二与三张比牌只看三张主牌，带什么对子不影响大小；你的${userShort}主牌同为${rankLabel(tripleRank)}，可出，只是不在首推。`,
        );
      } else {
        contentLines.push(`你若想出${userShort}也可以，只是不在首推。`);
      }
    }

    const answerText = sanitizeControlNarrative(
      [...lines, ...contentLines].join("\n"),
      levelRank,
    );
    return { source: "rule-engine", mode: "why-not-play", text: answerText };
  }

  if (proposed?.type === "Single") {
    const { rank } = proposed;
    const levelRank = context.levelRank ?? "2";
    const hand = context.humanHand ?? [];
    const handCount = hand.length;
    const topPlay = top?.play ?? top?.candidate;
    const { brokenPlate } = resolvePlateBreak(
      topPlay,
      hand,
      levelRank,
      counts,
    );
    const singleHeld = counts.get(rank) ?? 0;
    const matched = findSingleCandidate(choices, rank);
    const topShort = compactPlayShortLabel(topPlay) ?? topLabel;
    const userShort = compactSingleLabel(rank);
    const turn = context.turnNumber ?? null;
    const isOpeningLead = (turn === 0 || turn === "0") && hasInitiative;
    const contentLines = [];
    const topReasons = learnerTopReasons(top, 3, {
      ...context,
      levelRank,
      previousPlay: table.lastActivePlay ?? null,
    });
    const plateTopReason = topReasons.find((reason) => !/不是炸弹|不亏整炸|只有三张/.test(reason)) ?? "";
    const topReason = plateTopReason || topReasons[0] || "";
    const hasBJ = hand.some((card) => card.rank === "BJ");
    const isCatchWind = inferCatchWindFromContext(context);
    const plates = findPlateGroups(hand, levelRank);

    if (singleHeld < 1) {
      contentLines.push(`组不出${userShort}：手里没有${rankLabel(rank)}。`);
      if (topShort && topShort !== "—") contentLines.push(`推荐1用${topShort}。`);
    } else if (
      hasInitiative
      && isCatchWind
      && hasBJ
      && singleHeld === 1
      && topPlay?.type === PLAY_TYPES.tripleWithPair
    ) {
      contentLines.push(`打${userShort}更好：有大王可回收牌权，送单试探更灵活。`);
      contentLines.push(`推荐1「${topShort}」无回收路径，被压后只能靠炸。`);
      if (plates.length > 0) {
        contentLines.push(`也可直接打${plates[0].label ?? "钢板"}一次减6张。`);
      }
      if (matched?.index > 0) {
        contentLines.push(`${userShort}在候选第${matched.index + 1}位，这思路有道理。`);
      }
    } else if (
      hasInitiative
      && isCatchWind
      && hasBJ
      && singleHeld === 1
      && (topPlay?.type === PLAY_TYPES.plane || topPlay?.label?.includes("钢板"))
    ) {
      contentLines.push(`打${userShort}可以：大王留手回收牌权，送单试探成本低。`);
      contentLines.push(`推荐1「${topLabel}」一次减6张也强；小单+大王回收往往更灵活。`);
    } else if (brokenPlate) {
      const plateLabel = brokenPlate.label ?? "钢板";

      if (hasInitiative && handCount >= 10 && topPlay?.type === PLAY_TYPES.tripleWithPair) {
        const actionWord = isOpeningLead ? "拿牌权" : "减手";
        contentLines.push(
          `推荐1三带二会拆${plateLabel}（一次减5张）${topReason ? `，${topReason}` : `，想快${actionWord}`}。`,
        );
        contentLines.push(
          `你手牌还有${handCount}张，打${userShort}试探更灵活、不拆钢板，这思路有道理。`,
        );
        if (matched?.index > 0) {
          contentLines.push(`单${rankLabel(rank)}在候选第${matched.index + 1}位，你也可以出。`);
        }
      } else if (hasInitiative && topPlay?.type === PLAY_TYPES.tripleWithPair) {
        contentLines.push(`推荐1三带二会拆${plateLabel}，但能一次减5张${isOpeningLead ? "拿牌权" : "减手"}。`);
        contentLines.push(`打${userShort}只减1张、保留钢板，你若想留结构可以再考虑。`);
      } else {
        contentLines.push(`推荐1会拆${plateLabel}${topReason ? `：${topReason}` : "，成组减手更紧迫"}。`);
        const levelNote = briefLevelRankNote(rank, levelRank);
        contentLines.push(
          levelNote
            ? `打${userShort}可以，但${levelNote}，这手不如推荐1。`
            : `打${userShort}可以，但这手需压牌或成组减手，不如推荐1。`,
        );
      }
    } else if (topPlay?.type === PLAY_TYPES.plane || topPlay?.label?.includes("钢板")) {
      contentLines.push(`推荐1是${topLabel}，并未拆钢板。`);
      contentLines.push(`打${userShort}可以，但减手效率不如钢板一次减6张。`);
    } else if (matched?.index === 0) {
      contentLines.push(`${userShort}就是左侧推荐1，可以出。`);
    } else {
      const levelNote = briefLevelRankNote(rank, levelRank);
      const scenePrefix = hasInitiative ? "自由出牌" : "这手";
      const actionWord = isOpeningLead && hasInitiative ? "拿牌权" : "减手";
      const recommendParts = [];
      if (levelNote) recommendParts.push(levelNote);
      if (topReason) recommendParts.push(topReason);
      contentLines.push(
        `${recommendParts.join("，") || `打${userShort}牌力偏弱`}；${scenePrefix}推荐1用${topShort}${actionWord}。`,
      );
      if (matched && matched.index > 0) {
        contentLines.push(`${userShort}在候选第${matched.index + 1}位，首推更保守。`);
      } else {
        contentLines.push(`你若想出${userShort}也可以，只是牌力偏弱。`);
      }
    }

    const answerText = sanitizeControlNarrative(
      [...lines, ...contentLines].join("\n"),
      levelRank,
    );
    return { source: "rule-engine", mode: "why-not-play", text: answerText };
  }

  if (/拆.*钢板|钢板.*拆/i.test(question)) {
    return answerWhyNotPlateQuestion(question, context, counts);
  }

  lines.push(
    `你在问为何不采用某种出牌；左侧推荐1「${topLabel}」。`,
    "",
    "当前推荐：",
    formatAdviceChoices(context),
  );
  const fallbackReasons = learnerTopReasons(top, 2, { levelRank: context.levelRank ?? "2" });
  if (fallbackReasons.length > 0) {
    lines.push("", "推荐1理由：", ...fallbackReasons.map((r) => `- ${r}`));
  }
  if (facts.bombs.length > 0) {
    lines.push("", `你方炸弹：${facts.bombs.map((b) => b.label).join("、")}`);
  }

  return { source: "rule-engine", mode: "why-not-play", text: lines.join("\n") };
}

function formatAdviceChoices(context, limit = 3) {
  const choices = context.currentAdvice?.choices ?? [];
  if (choices.length === 0) return "左侧暂无出牌建议（可能尚未轮到你或局面已结束）。";
  return choices.slice(0, limit).map((item, index) => {
    const label = item.play?.label ?? item.candidate?.label ?? "—";
    const reasons = learnerTopReasons(item, 2, { levelRank: context.levelRank ?? "2" }).join("；");
    return `${index + 1}. ${label}${reasons ? ` — ${reasons}` : ""}`;
  }).join("\n");
}

function answerTripleWithPairQuestion(question, context, counts, facts) {
  const top = context.currentAdvice?.choices?.[0];
  const topType = top?.play?.type ?? top?.candidate?.type;
  const lines = [
    "【规则引擎作答】",
    "",
  ];

  if (/拆.*炸|拆炸/.test(question) && isTripleWithPairQuestion(question)) {
    const rankMatch = question.match(/([3-9]|10|J|Q|K|A|2)/i);
    const probeRank = rankMatch ? normalizeRank(rankMatch[1]) : null;
    const probeAnalysis = probeRank
      ? resolveTripleRankAnalysis(context, probeRank, counts)
      : null;
    const breakingBomb = facts.bombs.find((bomb) => {
      if (probeAnalysis && bomb.rank === probeRank) {
        return probeAnalysis.wouldBreakBomb;
      }
      const used = counts.get(bomb.rank) ?? 0;
      return used >= 4 && used - 3 < 4;
    });
    if (breakingBomb) {
      lines.push(
        "结论：为打三带二去拆整炸，通常不划算。",
        `你手里有 ${breakingBomb.label}，拆出三张后炸弹作废或变薄，牌权代价过大。`,
        "更常见做法：用其他三张+对子减手，炸弹留给压牌、接风后控场或残局。",
      );
    } else if (topType === "TripleWithPair") {
      lines.push(
        "结论：这手三带二若不拆炸弹，可以减 5 张牌，节奏上往往合理。",
        "是否最优要看：是否接风减手、能否保留更大炸弹、拆三张是否影响后续钢板/三带路线。",
      );
    } else {
      lines.push("结论：三带二一般是减手数的好选择；若会拆四张及以上同点炸弹，需慎重。");
    }
  } else {
    lines.push("结论：三带二用于减手、试探牌路；避免为出三带二拆掉唯一大炸。");
  }

  if (facts.recommendationWarnings.length > 0) {
    lines.push("", "左侧推荐需注意：", ...facts.recommendationWarnings.map((w) => `- ${w}`));
  }

  lines.push("", "当前推荐：", formatAdviceChoices(context));
  lines.push("", ...facts.hardRules.map((r) => `- ${r}`));
  return { source: "rule-engine", mode: "rule-only", text: lines.join("\n") };
}

export function buildBriefCoachAnswer(question, context, _facts = null) {
  const table = context.table ?? {};
  const mustBeat = table.lastActivePlay?.label;
  const top = context.currentAdvice?.choices?.[0]?.play?.label;
  const lines = [
    "【规则引擎作答】",
    "本问未匹配专问路由。请具体问，例如：",
    "- 是否拆钢板/应出钢板？",
    "- 打5是否拆顺子/应出单8？",
    "- 为何不用对K/应压什么？",
    "- 四炸后剩对子怎么办？",
  ];
  if (mustBeat) lines.push("", `当前需压：${mustBeat}`);
  if (top) lines.push(`左侧推荐1：${top}`);
  lines.push("", formatRuleEngineAnswerFooter());
  return { source: "rule-engine", mode: "brief", text: lines.join("\n") };
}

function formatBombBreakAnswer(rank, heldCount, context) {
  const counts = rankCountsFromHand(context.humanHand ?? []);
  const analysis = resolveTripleRankAnalysis(context, rank, counts);
  const effectiveHeld = analysis.effectiveBombCount || heldCount;
  const afterTriple = effectiveHeld - 3;
  const lines = [
    "【规则引擎作答，非大模型臆测】",
    "",
  ];

  if (heldCount >= 4 && analysis.effectiveBombCount < 4 && analysis.lockedSummary) {
    lines.push(
      "结论：你手里虽有四张同点，但理牌后并不成整炸。",
      "",
      analysis.lockedSummary,
      "",
      `可自由组三张的${rankLabel(rank)}只有 ${analysis.availableCount} 张；打出三个${rankLabel(rank)}不会拆整炸。`,
    );
  } else if (effectiveHeld >= 4) {
    const bombWord = effectiveHeld >= 5
      ? `${effectiveHeld}张${rankLabel(rank)}五炸（或更大）`
      : `${effectiveHeld}张${rankLabel(rank)}四炸`;
    lines.push(
      "结论：你的理解是对的。",
      "",
      `你手里现有 ${bombWord}。若打出三张${rankLabel(rank)}去压牌：`,
      `- 桌上那 3 张已经打出，不再属于你；`,
      afterTriple >= 4
        ? `- 手里还剩 ${afterTriple} 张，仍够四张，可以继续当炸弹，但厚度下降。`
        : `- 手里只剩 ${afterTriple} 张，只是${afterTriple === 2 ? "对子" : "单张"}，**炸弹已经作废**。`,
      "",
      "因此不能说「炸弹还在」——除非整炸四张及以上一起打出，或拆后手里仍不少于四张。",
    );
  } else {
    lines.push(
      "结论：你手里当前没有四张及以上的同点整炸。",
      "",
      analysis.lockedSummary ? analysis.lockedSummary : `现有 ${heldCount} 张${rankLabel(rank)}，不足四炸。`,
    );
  }

  const topLine = adviceTopLine(context);
  if (topLine) lines.push("", topLine);

  const warnings = buildEngineFacts(context).recommendationWarnings;
  if (warnings.length > 0) {
    lines.push("", "补充：左侧推荐里仍有拆炸候选，属策略失误，请不要照做：", ...warnings.map((w) => `- ${w}`));
  } else {
    lines.push("", "左侧推荐1未建议拆这张炸弹，可与上面结论一并参考。");
  }

  lines.push("", "建议：优先用其他三张、对子或整炸抢权；五炸、同花顺留到关键控权或残局。");
  return lines.join("\n");
}

export function tryLocalCoachAnswer(question, context) {
  const text = String(question ?? "").trim();
  if (!text || !context) return null;

  // 原则驱动开篇：问句→教纲编号，减少散落 case 路由
  const principleLead = explainPrincipleForQuestion(text, context);

  if (context.status === "no-game") {
    return {
      source: "rule-engine",
      mode: "brief",
      text: "【规则教练】请先「新开一局」或「竞技开赛」，再提问。",
    };
  }

  if (/只剩.*(小王|大王).*(同花顺|顺子)|只剩.*同花顺.*(小王|大王)|(小王|大王).*同花顺.*先出/i.test(text)) {
    return {
      source: "rule-engine",
      mode: "brief",
      text: [
        "【规则引擎作答】",
        "结论：**须压对手时先出王夺权，同花顺留接风后一手走完。**",
        "先出同花顺，对手若还有更大炸可能反压，残局风险大。",
        "【P7】先王夺权，同花顺留下一手走完；先出同花顺怕被大炸反压。",
      ].join("\n"),
    };
  }

  if (/只剩.*(五炸|炸弹)|五炸.*该不该|纯炸.*该不该|该不该先走.*炸/i.test(text)) {
    if (partnerHandCountFromContext(context) <= 2 && !isPartnerLastPlayer(context)) {
      return attachDoctrineViolationAck(context, answerPartnerSprintBombQuestion(text, context, rankCountsFromHand(context.humanHand ?? [])));
    }
    return {
      source: "rule-engine",
      mode: "brief",
      text: [
        "【规则引擎作答】",
        "手里只剩满张炸弹、对手/队友仍多牌时，不必为压小对/小单过早亮五炸。",
        "优先过牌等关键控权或队友接风，炸弹留到对手冲刺或残局再走。",
      ].join("\n"),
    };
  }

  const counts = rankCountsFromHand(context.humanHand ?? []);
  const facts = buildEngineFacts(context);

  if (isLastCardFinishYieldQuestion(text, context)) {
    return attachDoctrineViolationAck(context, answerLastCardFinishYieldQuestion(context));
  }

  if (isWhyBeatPartnerQuestion(text)) {
    return attachDoctrineViolationAck(context, answerWhyBeatPartnerQuestion(context, counts));
  }

  if (isPartnerSprintBombQuestion(text, context)) {
    return attachDoctrineViolationAck(context, answerPartnerSprintBombQuestion(text, context, counts));
  }

  if (isWhyNotRushBigBombQuestion(text, context)) {
    return attachDoctrineViolationAck(context, answerWhyNotRushBigBombQuestion(text, context, counts));
  }

  const withPrincipleLead = (answer) => {
    if (!answer || !principleLead?.lines?.length) {
      return attachDoctrineViolationAck(context, answer);
    }
    const body = answer.text ?? "";
    // 专用路由已写清原则或篇幅够时，不重复堆砌教纲开篇
    if (principleLead.codes.some((code) => body.includes(code))) {
      return attachDoctrineViolationAck(context, answer);
    }
    const lineCount = body.split("\n").filter((line) => line.trim()).length;
    if (lineCount >= 4) return attachDoctrineViolationAck(context, answer);
    const lead = ["【规则引擎作答】", ...principleLead.lines];
    if (body.startsWith("【规则引擎作答】")) {
      return attachDoctrineViolationAck(context, {
        ...answer,
        text: [...lead, "", body.replace(/^【规则引擎作答】\n?/, "")].join("\n"),
      });
    }
    return attachDoctrineViolationAck(context, { ...answer, text: [...lead, "", body].join("\n") });
  };

  if (isWhyRecommendBreaksPlateQuestion(text)) {
    return attachDoctrineViolationAck(context, answerWhyRecommendBreaksPlate(text, context, counts));
  }

  if (isWhyBombControlThenGroupQuestion(text)) {
    return attachDoctrineViolationAck(context, answerWhyBombControlThenGroupQuestion(context));
  }

  if (isWhyBreakStraightFlushForBombQuestion(text)) {
    const sfBombAnswer = answerWhyBreakStraightFlushForBombQuestion(text, context, counts);
    if (sfBombAnswer) return attachDoctrineViolationAck(context, sfBombAnswer);
  }

  if (isWhyBreakStraightForBombQuestion(text)) {
    const bombStructAnswer = answerWhyBreakStraightForBombQuestion(text, context, counts);
    // 压顺子四炸专答已含 P7，不再叠 P1/P4「不应拆顺子」开篇
    if (bombStructAnswer) return attachDoctrineViolationAck(context, bombStructAnswer);
  }

  if (isWhyPlayBreaksStraightQuestion(text)) {
    const straightAnswer = answerWhyPlayBreaksStraightQuestion(text, context, counts);
    if (straightAnswer) return withPrincipleLead(straightAnswer);
    const focusRank = parseStraightFocusRank(text, null);
    if (focusRank) {
      return withPrincipleLead({
        source: "rule-engine",
        mode: "why-not-play",
        text: sanitizeControlNarrative(
          [
            "【规则引擎作答】",
            `你问打${compactSingleLabel(focusRank)}是否拆顺子：请对照左侧推荐，优先不拆结构的散单。`,
          ].join("\n"),
          context.levelRank ?? "2",
        ),
      });
    }
  }

  if (isWhyNotUsePairQuestion(text)) {
    const pairAnswer = answerWhyNotUsePairQuestion(text, context, counts);
    if (pairAnswer) return withPrincipleLead(pairAnswer);
    const principleLines = buildBeatPairPrincipleAnswer(context, counts);
    if (principleLines) {
      return withPrincipleLead({
        source: "rule-engine",
        mode: "why-not-play",
        text: sanitizeControlNarrative(principleLines.join("\n"), context.levelRank ?? "2"),
      });
    }
  }

  if (isWhyPreferPairOverTripleBreakQuestion(text)) {
    const kickerAnswer = answerWhyPreferPairOverTripleBreakQuestion(text, context, counts);
    if (kickerAnswer) return withPrincipleLead(kickerAnswer);
  }

  if (isWhyPairChainVsPairQuestion(text)) {
    const pairChainAnswer = answerWhyPairChainVsPairQuestion(text, context, counts);
    if (pairChainAnswer) return withPrincipleLead(pairChainAnswer);
  }

  if (isWhyStraightChoiceQuestion(text)) {
    const straightChoiceAnswer = answerWhyStraightChoiceQuestion(text, context, counts);
    if (straightChoiceAnswer) return withPrincipleLead(straightChoiceAnswer);
  }

  if (isWhyTriplePairBreaksStraightQuestion(text)) {
    const tripleStraightAnswer = answerWhyTriplePairBreaksStraightQuestion(text, context, counts);
    if (tripleStraightAnswer) return withPrincipleLead(tripleStraightAnswer);
  }

  if (isRecommendationMetaQuestion(text)) {
    const metaAnswer = answerRecommendationMetaQuestion(text, context, counts);
    if (metaAnswer) return attachDoctrineViolationAck(context, metaAnswer);
  }

  if (isWhyNotPlayQuestion(text)) {
    // 特例路由：对照出牌；原则见 P1/P4/P5/P6（explainPrincipleForQuestion）
    return withPrincipleLead(answerWhyNotPlayQuestion(text, context, counts, facts));
  }

  if (isWhyNotBombQuestion(text)) {
    // 特例路由：炸弹对比；原则见 P7（级牌序 why-not-bomb 2 vs 9）
    const bombAnswer = answerWhyNotBombQuestion(text, context, counts, facts);
    if (bombAnswer) return withPrincipleLead(bombAnswer);
  }

  if (isWhyBreakRankInRecommendQuestion(text)) {
    const breakRankAnswer = answerWhyBreakRankInRecommend(text, context, counts);
    if (breakRankAnswer) return breakRankAnswer;
  }

  if (isTripleWithPairQuestion(text)) {
    // 特例路由：三带二拆炸；原则见 P9
    return withPrincipleLead(answerTripleWithPairQuestion(text, context, counts, facts));
  }

  if (isBombBreakQuestion(text)) {
    if (/顺子|组顺/.test(text) && /拆.*炸|炸/.test(text)) {
      return answerCatchWindStraightQuestion(text, context, counts);
    }
    const rankMatch = text.match(/([3-9]|10|J|Q|K|A|2)/i);
    const explicitRank = rankMatch ? rankMatch[1].toUpperCase().replace("10", "10") : null;
    const ranksToExplain = explicitRank && (counts.get(explicitRank) ?? 0) >= 4
      ? [explicitRank]
      : facts.bombs.map((b) => b.rank);

    if (ranksToExplain.length === 0) {
      return {
        source: "rule-engine",
        mode: "rule-only",
        text: [
          "【规则引擎作答】",
          "",
          "结论：你手里当前没有四张及以上的同点炸弹（或未在明牌区显示）。",
          "",
          "若问的是「刚打出去的三张是否还算炸弹」：打出去的牌不在手中，不能和手里剩牌拼成炸弹。",
          adviceTopLine(context) ?? "",
        ].filter(Boolean).join("\n"),
      };
    }

    const rank = ranksToExplain.find((r) => /A|五|5张/i.test(text)) ?? ranksToExplain[0];
    const held = counts.get(rank) ?? 0;
    if (/三/.test(text) || /拆|废|还在|没有/i.test(text)) {
      return { source: "rule-engine", mode: "rule-only", text: formatBombBreakAnswer(rank, held, context) };
    }

    return {
      source: "rule-engine",
      mode: "rule-only",
      text: [
        "【规则引擎作答】",
        "",
        `你手里的炸弹：${facts.bombs.map((b) => b.label).join("、") || "无"}`,
        "",
        ...facts.hardRules.map((r) => `- ${r}`),
        adviceTopLine(context) ? `\n${adviceTopLine(context)}` : "",
      ].join("\n"),
    };
  }

  if (isReportCardQuestion(text)) {
    return answerReportCardQuestion(context);
  }

  if (isWildCardQuestion(text)) {
    // 特例路由：逢人配说明；原则见 P8
    const levelRank = context.levelRank ?? "—";
    const wildInHand = (context.humanHand ?? []).filter(
      (card) => card.rank === levelRank && card.suit === "H",
    ).length;
    const lines = [
      "【规则引擎 · 逢人配】",
      "",
      `级牌 ${levelRank}，你手里逢人配（红心级牌）约 ${wildInHand} 张。`,
      "",
      "常见优先级（从高到低）：",
      "1. 凑同花顺 / 更大顺子，保留牌型厚度；",
      "2. 补炸弹或钢板，提高控权能力；",
      "3. 散单组杂顺，减手且不拆整炸；",
      "4. 三带二 / 对子：仅在不会拆唯一大炸、且能明显减手时用。",
      "",
      "当前左侧推荐：",
      formatAdviceChoices(context),
    ];
    if (facts.recommendationWarnings.length > 0) {
      lines.push("", "提醒：", ...facts.recommendationWarnings.map((w) => `- ${w}`));
    }
    return withPrincipleLead({ source: "rule-engine", mode: "wild-card", text: lines.join("\n") });
  }

  if (isOpponentOneCardPressQuestion(text)) {
    // 特例路由：报单压牌；原则见 P11
    const levelRank = context.levelRank ?? "2";
    const table = context.table ?? {};
    const mustBeat = table.lastActivePlay?.label ?? "—";
    const lines = [
      "【规则引擎 · 报单压牌】",
      "",
      `需压：${mustBeat}。对手只剩 1 张时，目标不是「最小代价跟牌」，而是封死其末张、争取双上。`,
      "",
      "为何优先级牌压：",
      "1. 最小 beat（如 9 压 6）仍可能被下家队友用 J 等中等牌「送」过去；",
      "2. 报单对手末张往往偏大，最小压牌控不住后续牌路；",
      `3. 本局级牌 ${rankLabel(levelRank)} 单张压牌，能最大限度封门，避免末游逃脱。`,
      "",
      "当前左侧推荐：",
      formatAdviceChoices(context),
    ];
    return withPrincipleLead({ source: "rule-engine", mode: "one-card-press", text: lines.join("\n") });
  }

  if (isOpponentBreakSingleQuestion(text)) {
    return withPrincipleLead(answerOpponentBreakSingleQuestion(text, context));
  }

  if (isOpponentPressQuestion(text)) {
    // 特例路由：机器人压牌复盘；原则见 P12
    const recent = (context.recentPlayHistory ?? []).slice(-8);
    const singleLine = recent.find((item) => item.play?.type === "Single");
    const lines = [
      "【本局说明】",
      "",
      "结论：对手（机器人）在**能压且值得压**时会跟单张；若没压，通常是手里没有更小能压的单张、或正在保留炸弹/大牌抢后续牌权。",
      "",
      "规则侧已加强：对手出单张时，机器人过牌惩罚更重、最小单张跟牌奖励更高。",
      "你方策略侧已调整：对手出小炸时，更倾向**过牌保高炸**，不再推荐用 K 炸去换 7 炸。",
    ];
    if (singleLine) {
      lines.push("", `最近相关：${singleLine.playerName} 出 ${singleLine.play?.label ?? "单张"}。`);
    }
    lines.push("", "你的多次过牌（未用 K 炸去拦小炸）与上述策略一致，样本已按此方向迭代。");
    return withPrincipleLead({ source: "rule-engine", mode: "game-review-note", text: lines.join("\n") });
  }

  if (principleLead?.lines?.length && !isWhyBreakStraightForBombQuestion(text)) {
    const topLine = adviceTopLine(context);
    const lines = ["【规则引擎作答】", ...principleLead.lines];
    if (topLine) lines.push("", topLine);
    return { source: "rule-engine", mode: "principle-lead", text: lines.join("\n") };
  }

  // game-2 三条专问永不落入 brief 泛答
  if (isWhyPlayBreaksStraightQuestion(text)) {
    const forcedStraight = answerWhyPlayBreaksStraightQuestion(text, context, counts);
    if (forcedStraight) return withPrincipleLead(forcedStraight);
  }
  if (isWhyNotUsePairQuestion(text)) {
    const forcedPair = answerWhyNotUsePairQuestion(text, context, counts);
    if (forcedPair) return withPrincipleLead(forcedPair);
  }
  if (isWhyPreferPairOverTripleBreakQuestion(text)) {
    const forcedKicker = answerWhyPreferPairOverTripleBreakQuestion(text, context, counts);
    if (forcedKicker) return withPrincipleLead(forcedKicker);
  }
  if (isWhyStraightChoiceQuestion(text)) {
    const forcedChoice = answerWhyStraightChoiceQuestion(text, context, counts);
    if (forcedChoice) return withPrincipleLead(forcedChoice);
  }

  return attachDoctrineViolationAck(context, buildFallbackCoachAnswer(text, context));
}

/** 专问路由全失败时的短答，禁止炸弹备忘 brief 作主路径 */
function buildFallbackCoachAnswer(question, context) {
  const hints = [];
  if (/连对/i.test(question) && /对子|对[3-9]/i.test(question)) hints.push("为什么不出连对而要出对子");
  else if (/钢板|连对/i.test(question)) hints.push("是否拆钢板");
  if (/单[3-9JQKA2]|散单|拆顺|打[3-9JQKA2]/i.test(question)) hints.push("应用单8/是否拆顺子");
  if (/对[3-9JQKA2]|拆.*三/i.test(question)) hints.push("是否用整对K/为何拆三同张");
  if (/炸弹|四炸|逢人配/i.test(question)) hints.push("是否应用四炸7/剩对7");
  const examples = hints.length > 0 ? hints.join("、") : "是否拆钢板、应用单8、四炸7剩对7";
  return {
    source: "rule-engine",
    mode: "fallback",
    text: [
      "【规则引擎作答】",
      `暂未识别「${question.slice(0, 40)}${question.length > 40 ? "…" : ""}」的专问路由。`,
      `请具体问：${examples}。`,
      formatRuleEngineAnswerFooter(),
    ].join("\n"),
  };
}
