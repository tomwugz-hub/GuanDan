/**
 * 领出/接风：同花顺跑道保护 — 裁池、教纲、评分、应急、节奏 共用单一真相源。
 * 修复须写进本模块，避免各路径各自实现导致复发。
 */
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { cardId, isJoker, isWildCard } from "../engine/card.mjs";
import {
  breaksStrategicPremiumForConsecutivePairs,
  breaksStrategicPremiumForPair,
  breaksStrategicPremiumForPlane,
  breaksStrategicPremiumForStraight,
  breaksStrategicPremiumForTriple,
  breaksStrategicPremiumForTripleWithPair,
  resolveHandStructureCache,
} from "./scorers/structure.mjs";
import { enumerateStraightFlushCandidates } from "./straight-flush-arrange.mjs";
import { buildStrategicGroups } from "./strategic-groups.mjs";

/** 策略修订号：与 app/main.mjs 校验一致，用于识别浏览器是否仍缓存旧模块 */
export const COACH_STRATEGY_REVISION = 46;

const SHAPE_LABELS = {
  [PLAY_TYPES.straight]: "杂顺",
  [PLAY_TYPES.consecutivePairs]: "连对",
  [PLAY_TYPES.triple]: "裸三张",
  [PLAY_TYPES.pair]: "对子",
  [PLAY_TYPES.tripleWithPair]: "三带二",
  [PLAY_TYPES.plane]: "钢板",
};

function resolveSfRunwayPremiumBreak(candidate, hand, levelRank, tableContext = null) {
  if (!candidate || candidate.type === PLAY_TYPES.pass) return null;
  switch (candidate.type) {
    case PLAY_TYPES.straight:
      if ((candidate.length ?? candidate.cards?.length ?? 0) < 5) return null;
      return breaksStrategicPremiumForStraight(candidate, hand, levelRank, tableContext);
    case PLAY_TYPES.consecutivePairs:
      if ((candidate.length ?? candidate.cards?.length ?? 0) < 4) return null;
      return breaksStrategicPremiumForConsecutivePairs(candidate, hand, levelRank, tableContext);
    case PLAY_TYPES.triple:
      return breaksStrategicPremiumForTriple(candidate, hand, levelRank, tableContext);
    case PLAY_TYPES.pair:
      return breaksStrategicPremiumForPair(candidate, hand, levelRank, tableContext);
    case PLAY_TYPES.tripleWithPair:
      return breaksStrategicPremiumForTripleWithPair(
        candidate,
        hand,
        levelRank,
        tableContext?.preferredGroups ?? null,
        tableContext,
      );
    case PLAY_TYPES.plane:
      if ((candidate.length ?? candidate.cards?.length ?? 0) < 6) return null;
      return breaksStrategicPremiumForPlane(candidate, hand, levelRank);
    default:
      return null;
  }
}

function shapeActionLabel(candidateType) {
  if (candidateType === PLAY_TYPES.triple || candidateType === PLAY_TYPES.pair) return "出";
  return "组";
}

const RUNWAY_SUIT_LABELS = new Set(["黑桃", "红桃", "梅花", "方片"]);

function candidateBreaksEnumeratedStraightFlush(candidate, straightFlushes) {
  if (!candidate?.cards?.length || !straightFlushes?.length) return null;
  const candidateKeys = new Set((candidate.cards ?? []).map((card) => cardId(card)));
  for (const straightFlush of straightFlushes) {
    const groupKeys = (straightFlush.cards ?? []).map((card) => cardId(card));
    const usedKeys = groupKeys.filter((key) => candidateKeys.has(key));
    if (usedKeys.length === 0) continue;
    const playsWholeSf = candidate.type === PLAY_TYPES.straightFlush
      && usedKeys.length === groupKeys.length
      && candidate.cards.length === groupKeys.length;
    if (playsWholeSf) continue;
    if (usedKeys.length < groupKeys.length || candidate.cards.length !== groupKeys.length) {
      const suitLabel = { S: "黑桃", H: "红桃", C: "梅花", D: "方片" }[straightFlush.suit] ?? straightFlush.suit;
      return `同花顺 ${suitLabel}`;
    }
  }
  return null;
}

/** 同花顺跑道破坏：含「同花顺」或同花色连续跑道（结构层标为「顺子 花色」） */
function isSfRunwayPremiumBreakLabel(premiumBreak) {
  if (!premiumBreak) return false;
  if (premiumBreak.includes("同花顺")) return true;
  if (premiumBreak.startsWith("顺子 ")) {
    return RUNWAY_SUIT_LABELS.has(premiumBreak.slice(3));
  }
  return false;
}

/** 领出/接风候选是否拆同花顺跑道（含杂顺占逢人配、裸三张/对子动跑道自然牌等） */
export function breaksStraightFlushRunwayOnLead(candidate, hand, levelRank, tableContext = null) {
  const premiumBreak = resolveSfRunwayPremiumBreak(candidate, hand, levelRank, tableContext);
  if (!isSfRunwayPremiumBreakLabel(premiumBreak)) return null;
  return premiumBreak;
}

export function isLeadTurnSfRunwayBreak(candidate, hand, levelRank, tableContext = null) {
  return breaksStraightFlushRunwayOnLead(candidate, hand, levelRank, tableContext) != null;
}

/** 是否开局型领出（fresh-open / catch-wind，非须压） */
export function isOpeningLikeLeadContext(tableContext, previousPlay = null) {
  const mustBeat = previousPlay && previousPlay.type !== PLAY_TYPES.pass;
  if (mustBeat) return false;
  const leadMode = tableContext?.leadMode;
  if (leadMode === "fresh-open" || leadMode === "catch-wind") return true;
  if (leadMode === "must-beat") return false;
  return tableContext?.isOpening === true && !tableContext?.opponentActive;
}

/** 开局型领出：滤掉所有拆同花顺跑道的候选（裁池前后均须调用） */
export function filterCandidatesPreservingSfRunway(
  candidates,
  hand,
  levelRank,
  previousPlay,
  tableContext,
) {
  if (!isOpeningLikeLeadContext(tableContext, previousPlay)) return candidates ?? [];
  resolveHandStructureCache(hand, levelRank, tableContext);
  return (candidates ?? []).filter(
    (c) => !isLeadTurnSfRunwayBreak(c, hand, levelRank, tableContext),
  );
}

/** 教纲 P4：领出/接风拆同花顺跑道 */
export function leadSfRunwayDoctrineViolation(candidate, hand, levelRank, tableContext) {
  if (!tableContext?.isOpening || tableContext.leadMode === "must-beat" || tableContext.opponentActive) {
    return null;
  }
  const premiumBreak = breaksStraightFlushRunwayOnLead(candidate, hand, levelRank, tableContext);
  if (!premiumBreak) return null;
  const shape = SHAPE_LABELS[candidate.type] ?? "成组牌";
  return {
    code: "P4",
    summary: `不宜拆${premiumBreak}${shapeActionLabel(candidate.type)}${shape}，保留同花顺`,
    blockTop1: true,
    blockTop3: true,
  };
}

/** 节奏层：接风/领出拆跑道重罚 */
export function leadSfRunwayTempoPenalty(candidate, hand, levelRank, tableContext, { heavyHand = false } = {}) {
  const premiumBreak = breaksStraightFlushRunwayOnLead(candidate, hand, levelRank, tableContext);
  if (!premiumBreak) return null;
  const shape = SHAPE_LABELS[candidate.type] ?? "成组牌";
  return {
    score: heavyHand ? 11_000 : 9500,
    reason: `不宜拆${premiumBreak}${shapeActionLabel(candidate.type)}${shape}，保留同花顺给控权`,
  };
}

/** 原则层 P4 评分重罚 */
export function leadSfRunwayPrinciplesPenalty(candidate, hand, levelRank, tableContext, handLen = hand?.length ?? 0) {
  const premiumBreak = breaksStraightFlushRunwayOnLead(candidate, hand, levelRank, tableContext);
  if (!premiumBreak) return null;
  const shape = SHAPE_LABELS[candidate.type] ?? "成组牌";
  return {
    score: handLen >= 15 ? 14_000 : 12_000,
    reason: `【P4】不宜拆${premiumBreak}${shapeActionLabel(candidate.type)}${shape}，保留同花顺给控权`,
  };
}

function physicalRankCount(hand, rank, levelRank) {
  if (!hand?.length || !rank) return 0;
  return hand.filter(
    (card) => card.rank === rank && !isJoker(card) && !isWildCard(card, levelRank),
  ).length;
}

function isLiteStructureContext(tableContext) {
  return tableContext?.lite === true
    || tableContext?.scoringAudience === "human-lite"
    || tableContext?.scoringAudience === "robot";
}

function candidatePartiallyBreaksSfGroup(candidate, group) {
  const groupKeys = (group.cards ?? []).map((card) => cardId(card));
  if (!groupKeys.length) return false;
  const keys = new Set((candidate.cards ?? []).map((card) => cardId(card)));
  const used = groupKeys.filter((key) => keys.has(key)).length;
  return used > 0 && used < groupKeys.length;
}

/** 须压须保护的主同花顺跑道：UI 理牌列 + buildStrategicGroups 锁定，非全量枚举 */
function resolveLockedStraightFlushGroups(hand, levelRank, tableContext, cache) {
  const fromPreferred = (cache.strategicGroups ?? []).filter(
    (group) => group.play?.type === PLAY_TYPES.straightFlush
      || /同花顺/.test(group.label ?? ""),
  );
  if (fromPreferred.length > 0) return fromPreferred;
  if (isLiteStructureContext(tableContext) && (tableContext?.preferredGroups?.length ?? 0) > 0) {
    return buildStrategicGroups(hand, levelRank).filter(
      (group) => group.play?.type === PLAY_TYPES.straightFlush
        || /同花顺/.test(group.label ?? ""),
    );
  }
  if (!isLiteStructureContext(tableContext)) {
    return buildStrategicGroups(hand, levelRank).filter(
      (group) => group.play?.type === PLAY_TYPES.straightFlush,
    );
  }
  return [];
}

/** 须压同型常规牌：枚举/分组检测拆同花顺跑道（不因理牌只锁低路 SF 而漏检逢人配高路） */
function resolveMustBeatSfRunwayBreak(candidate, hand, levelRank, tableContext, premiumBreak) {
  const cache = resolveHandStructureCache(hand, levelRank, tableContext);
  const lockedSf = resolveLockedStraightFlushGroups(hand, levelRank, tableContext, cache);
  for (const group of lockedSf) {
    if (candidatePartiallyBreaksSfGroup(candidate, group)) {
      return group.label ?? premiumBreak ?? "同花顺";
    }
  }
  // 三张同点拆散对：主跑道未伤即可压，勿用 premiumBreak/次要枚举误拦（如 J♣+J♠ 碰低路梅花）
  if (candidate?.type === PLAY_TYPES.pair) {
    const held = physicalRankCount(hand, candidate.mainRank, levelRank);
    if (held > 2) return null;
  }
  if (premiumBreak && isSfRunwayPremiumBreakLabel(premiumBreak) && lockedSf.length === 0) {
    return premiumBreak;
  }
  const straightFlushes = cache.straightFlushes.length > 0
    ? cache.straightFlushes
    : enumerateStraightFlushCandidates(hand, levelRank);
  return candidateBreaksEnumeratedStraightFlush(candidate, straightFlushes);
}

/** 须压连对：候选是否拆同花顺/同花色跑道 */
export function breaksStraightFlushRunwayOnMustBeatCp(candidate, hand, levelRank, tableContext = null) {
  const previousPlay = tableContext?.previousPlay ?? null;
  if (previousPlay?.type !== PLAY_TYPES.consecutivePairs) return null;
  if (candidate?.type !== PLAY_TYPES.consecutivePairs) return null;
  const premiumBreak = breaksStrategicPremiumForConsecutivePairs(
    candidate,
    hand,
    levelRank,
    tableContext,
  );
  return resolveMustBeatSfRunwayBreak(candidate, hand, levelRank, tableContext, premiumBreak);
}

/** 须压三带二：候选是否拆同花顺/同花色跑道 */
export function breaksStraightFlushRunwayOnMustBeatTwp(candidate, hand, levelRank, tableContext = null) {
  const previousPlay = tableContext?.previousPlay ?? null;
  if (previousPlay?.type !== PLAY_TYPES.tripleWithPair) return null;
  if (candidate?.type !== PLAY_TYPES.tripleWithPair) return null;
  const premiumBreak = breaksStrategicPremiumForTripleWithPair(
    candidate,
    hand,
    levelRank,
    tableContext?.preferredGroups ?? null,
    tableContext,
  );
  return resolveMustBeatSfRunwayBreak(candidate, hand, levelRank, tableContext, premiumBreak);
}

/** 须压对子：候选是否拆同花顺/同花色跑道 */
export function breaksStraightFlushRunwayOnMustBeatPair(candidate, hand, levelRank, tableContext = null) {
  const previousPlay = tableContext?.previousPlay ?? null;
  if (previousPlay?.type !== PLAY_TYPES.pair) return null;
  if (candidate?.type !== PLAY_TYPES.pair) return null;
  const premiumBreak = breaksStrategicPremiumForPair(candidate, hand, levelRank, tableContext);
  return resolveMustBeatSfRunwayBreak(candidate, hand, levelRank, tableContext, premiumBreak);
}

/** 教纲 P1：须压对子拆同花顺跑道 */
export function mustBeatPairSfRunwayDoctrineViolation(candidate, hand, levelRank, tableContext) {
  const premiumBreak = breaksStraightFlushRunwayOnMustBeatPair(candidate, hand, levelRank, tableContext);
  if (!premiumBreak) return null;
  return {
    code: "P1",
    summary: `不宜拆${premiumBreak}组对压牌，宜过牌保留同花顺`,
    blockTop1: true,
    blockTop3: true,
  };
}

/** 原则层：须压对子拆跑道评分重罚 */
export function mustBeatPairSfRunwayPrinciplesPenalty(candidate, hand, levelRank, tableContext) {
  const premiumBreak = breaksStraightFlushRunwayOnMustBeatPair(candidate, hand, levelRank, tableContext);
  if (!premiumBreak) return null;
  const handLen = hand?.length ?? 0;
  return {
    score: handLen >= 15 ? 12_000 : 10_000,
    reason: `【P1】不宜拆${premiumBreak}组对压牌，宜过牌保留同花顺`,
  };
}

/** 教纲 P1：须压连对拆同花顺跑道 */
export function mustBeatCpSfRunwayDoctrineViolation(candidate, hand, levelRank, tableContext) {
  const premiumBreak = breaksStraightFlushRunwayOnMustBeatCp(candidate, hand, levelRank, tableContext);
  if (!premiumBreak) return null;
  return {
    code: "P1",
    summary: `不宜拆${premiumBreak}组连对压牌，宜过牌保留同花顺`,
    blockTop1: true,
    blockTop3: true,
  };
}

/** 原则层：须压连对拆跑道评分重罚 */
export function mustBeatCpSfRunwayPrinciplesPenalty(candidate, hand, levelRank, tableContext) {
  const premiumBreak = breaksStraightFlushRunwayOnMustBeatCp(candidate, hand, levelRank, tableContext);
  if (!premiumBreak) return null;
  const handLen = hand?.length ?? 0;
  return {
    score: handLen >= 15 ? 12_000 : 10_000,
    reason: `【P1】不宜拆${premiumBreak}组连对压牌，宜过牌保留同花顺`,
  };
}

/** 教纲 P1：须压三带二拆同花顺跑道 */
export function mustBeatTwpSfRunwayDoctrineViolation(candidate, hand, levelRank, tableContext) {
  const premiumBreak = breaksStraightFlushRunwayOnMustBeatTwp(candidate, hand, levelRank, tableContext);
  if (!premiumBreak) return null;
  return {
    code: "P1",
    summary: `不宜拆${premiumBreak}组三带二压牌，宜过牌保留同花顺`,
    blockTop1: true,
    blockTop3: true,
  };
}

/** 原则层：须压三带二拆跑道评分重罚 */
export function mustBeatTwpSfRunwayPrinciplesPenalty(candidate, hand, levelRank, tableContext) {
  const premiumBreak = breaksStraightFlushRunwayOnMustBeatTwp(candidate, hand, levelRank, tableContext);
  if (!premiumBreak) return null;
  const handLen = hand?.length ?? 0;
  return {
    score: handLen >= 15 ? 12_000 : 10_000,
    reason: `【P1】不宜拆${premiumBreak}组三带二压牌，宜过牌保留同花顺`,
  };
}
