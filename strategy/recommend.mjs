import { isWildCard, playUsesOnlyHandCards } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { canBeat } from "../engine/compare-play.mjs";
import { effectivePreviousPlay } from "../engine/game-state.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { rankPower, compareRanks } from "../engine/rank-order.mjs";
import { alignReasonsForPlay } from "./reason-align.mjs";
import { enrichScoringContext, evaluateBombInventory, opponentDangerLevel, opponentReportsTwoCards, shouldYieldPassToPartner, shouldRobotYieldPassToPartner } from "./table-context.mjs";
import { opponentPressureAdjustment } from "./scorers/opponent-pressure.mjs";
import {
  breaksBombIntegrity,
  breaksStrategicPremiumForConsecutivePairs,
  breaksStrategicPremiumForPair,
  breaksStrategicPremiumForStraight,
  breaksStrategicPremiumForTriple,
  breaksStrategicPremiumForTripleWithPair,
  inferTripleWithPairKickerRank,
  isStructureBreakingRoutineBeat,
  structureBreakPenalty,
} from "./scorers/structure.mjs";
import { tempoLeadAdjustment, looseSmallSingleRanks } from "./scorers/tempo-lead.mjs";
import {
  filterCandidatesPreservingSfRunway,
  isLeadTurnSfRunwayBreak,
  breaksStraightFlushRunwayOnMustBeatCp,
  breaksStraightFlushRunwayOnMustBeatTwp,
  breaksStraightFlushRunwayOnMustBeatPair,
  mustBeatCpSfRunwayPrinciplesPenalty,
  mustBeatPairSfRunwayPrinciplesPenalty,
} from "./sf-runway-guard.mjs";
import {
  candidateMlBlendWeight,
  fusionReasonSuffix,
  resolveMlFusionMode,
} from "./ml-fusion.mjs";
import {
  principleMlVetoFactor,
  scoreCandidateByPrinciples,
  isBombOnlyBeatContext,
  isStraightFlushWasteOnSmallRoutine,
  shouldReservePureBombEarly,
  shouldVetoBombOnlyPass,
  breaksPremiumStraightOrJokerGroup,
  breaksPreferredStrategicGroup,
  pickStructureSafeEmergencyCandidate,
  pickOpeningLeadFallback,
  pickPartnerAwareEmergencyCandidate,
  pickPureFullBombFinisher,
  isPureFullBombHand,
  filterBareLevelRankPairLeads,
  isBareLevelRankPairLead,
  isExactTripleWithPairLead,
  isPrematureConsecutivePairsLead,
  isSafeNonStraightBreakSingleRank,
  analyzeMustBeatSingleContext,
  analyzeMustBeatPairContext,
  analyzeMustBeatTripleWithPairContext,
  analyzeReservePairForPendingTriple,
  looseLeadSingleRanks,
  reasonFromPrinciple,
  requiresBombForPairBeat,
  pickMinStructureBombBeater,
  hasStandalonePureBombBeater,
  shouldReserveBombForHighProbeSingle,
  shouldYieldPassAfterPartnerLeadOnOpponentBomb,
  isPressingRoutineNonBomb,
  shouldReserveBombForHeavyHand,
} from "./principles.mjs";
import {
  shouldReserveWildForSmallRoutineBeat,
  shouldReserveStructureForRoutineBeat,
  shouldPreferPassForHeavyHandRoutineTripleWithPair,
  hasStructureSafeRoutineBeater,
  isWildLowValueBeat,
} from "./wild-doctrine.mjs";
import {
  allowMustBeatPremiumLooseSingle,
  demotePlateBreakingTriplesOnOpening,
  isDisplayablePoolItem,
  pickCompliantTopRecommendation,
  isMustBeatLegalItem,
  assertMustBeatTop1,
} from "./recommendation-guards.mjs";
import {
  assertTop1DoctrineCompliance,
  detectDoctrineViolations,
  enforceDoctrineOnCandidates,
} from "./doctrine-enforce.mjs";
import {
  buildRowContextFromTable,
  isMlPolicyEnabled,
  loadMlPolicy,
  rankCandidatesWithMl,
  resolveMlModel,
} from "./ml-policy.mjs";
import { evaluateHandProfile } from "./hand-profile.mjs";
import {
  inferLeadMode,
  isCatchWindGroupReductionAfterBomb,
  isCatchWindPremiumReduction,
  playerJustWonTrickWithBomb,
  CATCH_WIND_RUNWAY_HAND_MAX,
} from "./lead-mode.mjs";
import { buildStrategicGroups } from "./strategic-groups.mjs";
import { bookDoctrineAdjustment } from "./guandan-book-principles.mjs";
import { cases100Adjustment, pickC100MustBeatSingleBeater, pickC100MustBeatPairBeater, pickC100MustBeatTripleBeater, pickC100MustBeatConsecutivePairsBeater, pickC100MustBeatTripleWithPairBeater, pickC100MustBeatPlaneBeater, pickC100MustBeatStraightBeater, pickC100MustBeatStraightFlushBeater, pickC100OpeningLead, pickC100OpeningLeadDirect } from "./guandan-100cases-principles.mjs";
import { filterHardInvariants } from "./hard-invariants.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

/** 大手牌须压炸弹快路径：只组同点炸弹，避免逢人配组合枚举爆炸。 */
function pickFastRankBombBeater(hand, levelRank, previousPlay) {
  if (!previousPlay || !BOMB_TYPES.has(previousPlay.type)) return null;
  const wilds = hand.filter((card) => isWildCard(card, levelRank));
  const byRank = new Map();
  for (const card of hand) {
    if (isWildCard(card, levelRank) || card.rank === "SJ" || card.rank === "BJ") continue;
    const list = byRank.get(card.rank) ?? [];
    list.push(card);
    byRank.set(card.rank, list);
  }
  const beaters = [];
  for (const cards of byRank.values()) {
    if (cards.length < 4) continue;
    for (let wildCount = 0; wildCount <= wilds.length; wildCount += 1) {
      const play = classifyPlay([...cards, ...wilds.slice(0, wildCount)], levelRank);
      if (play.type === PLAY_TYPES.bomb && canBeat(play, previousPlay)) beaters.push(play);
    }
  }
  return beaters.sort((left, right) => {
    const leftSize = left.bombSize ?? left.cards?.length ?? 4;
    const rightSize = right.bombSize ?? right.cards?.length ?? 4;
    return leftSize - rightSize || left.power - right.power;
  })[0] ?? null;
}

/** L1 主攻弱路散单：须先入池且不受拆顺 P1 误拦（第12篇） */
function isL1LooseSingleOpening(candidate, hand, levelRank, tableContext) {
  if (tableContext.leadMode !== "fresh-open" || !tableContext.isOpening) return false;
  if (candidate.type !== PLAY_TYPES.single || !candidate.mainRank) return false;
  const profile = tableContext.handProfile;
  if (profile?.role !== "main-attack" || (profile?.looseSingles ?? 0) < 2) return false;
  return looseSmallSingleRanks(hand, levelRank).includes(candidate.mainRank);
}

/** P6 大王回收试探：散单须进入评分池，不应被保留组牌的通用过滤提前剔除。 */
function isP6BigJokerProbeSingleOpening(candidate, hand, levelRank, tableContext) {
  if (tableContext.leadMode !== "fresh-open" || !tableContext.isOpening || hand.length < 27) return false;
  if (candidate.type !== PLAY_TYPES.single || !candidate.mainRank) return false;
  if (!hand.some((card) => card.rank === "BJ")) return false;
  return looseLeadSingleRanks(hand, levelRank).includes(candidate.mainRank);
}

/** 须压且仅炸弹可跟时，该炸弹为必出选项（不因拆保留同花顺/王炸而被候选池滤掉） */
export function isMandatoryBombCandidate(candidate, hand, levelRank, tableContext, previousPlay = null) {
  if (!candidate || !BOMB_TYPES.has(candidate.type)) return false;
  const prev = previousPlay ?? tableContext.previousPlay ?? null;
  if (!prev || !canBeat(candidate, prev)) return false;
  const ctx = { ...tableContext, hand, previousPlay: prev };
  if (isStraightFlushWasteOnSmallRoutine(candidate, hand, prev, ctx)) return false;
  if (!isBombOnlyBeatContext(ctx)) return false;
  if (!shouldVetoBombOnlyPass(ctx, hand, prev)) return false;
  const preferredGroups = tableContext.preferredGroups ?? [];
  if (breaksCriticalPreferredGroup(candidate, preferredGroups, levelRank, hand)) {
    const altBomb = (tableContext._candidates ?? []).some(
      (item) => BOMB_TYPES.has(item.type)
        && canBeat(item, prev)
        && !breaksCriticalPreferredGroup(item, preferredGroups, levelRank, hand),
    );
    if (altBomb) return false;
  }
  return true;
}

function cardKey(card) {
  return `${card.rank}:${card.suit}:${card.deckIndex}`;
}

function remainingHandAfter(candidate, hand) {
  if (candidate.type === PLAY_TYPES.pass) return hand.length;
  const used = new Set(candidate.cards.map(cardKey));
  return hand.filter((card) => !used.has(cardKey(card))).length;
}

export function breaksCriticalPreferredGroup(candidate, preferredGroups, levelRank, hand) {
  if (!candidate || candidate.type === PLAY_TYPES.pass || candidate.cards.length === hand.length) return false;
  const candidateKeys = new Set(candidate.cards.map(cardKey));
  for (const group of preferredGroups ?? []) {
    const groupCards = group.cards ?? group;
    if (!Array.isArray(groupCards) || groupCards.length <= 1) continue;
    const play = group.play ?? classifyPlay(groupCards, levelRank);
    if (![PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb].includes(play.type)) continue;
    if (
      play.type === PLAY_TYPES.straightFlush
      && groupCards.some((card) => isWildCard(card, levelRank))
    ) continue;
    const groupKeys = groupCards.map(cardKey);
    const usedCount = groupKeys.filter((key) => candidateKeys.has(key)).length;
    if (usedCount > 0 && usedCount < groupKeys.length) return true;
    if (usedCount === groupKeys.length && candidate.cards.length !== groupKeys.length) return true;
  }
  return false;
}

export function candidatesFromPreferredGroups(preferredGroups = [], levelRank, previousPlay = null, hand = null) {
  const results = [];
  for (const group of preferredGroups) {
    const cards = group.cards ?? group;
    if (!Array.isArray(cards) || cards.length === 0) continue;
    const play = classifyPlay(cards, levelRank);
    if (play.type === PLAY_TYPES.invalid || play.type === PLAY_TYPES.pass) continue;
    if (hand && !playUsesOnlyHandCards(hand, play)) continue;
    if (previousPlay && previousPlay.type !== PLAY_TYPES.pass && !canBeat(play, previousPlay)) continue;
    results.push(play);
  }
  return results;
}

function openingShapeScore(candidate) {
  if (BOMB_TYPES.has(candidate.type)) return 120;
  if (candidate.type === PLAY_TYPES.plane && candidate.length >= 6) {
    return -candidate.length * 18;
  }
  if (candidate.type === PLAY_TYPES.consecutivePairs && candidate.length >= 6) {
    return -candidate.length * 14;
  }
  if (candidate.length >= 5) return -candidate.length * 8;
  return candidate.power;
}

function controlCardCost(candidate, levelRank) {
  let cost = 0;
  for (const card of candidate.cards) {
    if (card.rank === "SJ" || card.rank === "BJ" || isWildCard(card, levelRank)) cost += 180;
    else if (card.rank === levelRank) cost += 140;
    else if (rankPower(card.rank, levelRank) >= rankPower("K", levelRank)) cost += 90;
  }
  return cost;
}

export { evaluateBombInventory } from "./table-context.mjs";

/** 对手报单/双张冲刺：须拦不让走完 */
function isOpponentEndgameBlock(tableContext) {
  if (!tableContext.opponentActive) return false;
  const previousPlay = tableContext.previousPlay;
  if (!previousPlay || previousPlay.type === PLAY_TYPES.pass) return false;
  return (tableContext.danger ?? opponentDangerLevel(tableContext)) >= 3;
}

function isActionableCandidate(candidate, hand, levelRank, tableContext) {
  if (!candidate || candidate.type === PLAY_TYPES.pass) return false;
  const finishing = candidate.cards?.length === hand.length;
  const endgameBlock = isOpponentEndgameBlock(tableContext);
  if (!finishing && breaksBombIntegrity(candidate, hand, levelRank, tableContext) && !endgameBlock) return false;
  if (
    breaksCriticalPreferredGroup(candidate, tableContext.preferredGroups, levelRank, hand)
    && !isCatchWindGroupReductionAfterBomb(candidate, tableContext)
    && !isExactTripleWithPairLead(candidate, hand, levelRank, tableContext)
    && !isPrematureConsecutivePairsLead(candidate, hand, levelRank, tableContext)
    && !endgameBlock
  ) return false;
  if (
    candidate.type === PLAY_TYPES.tripleWithPair
    && breaksStrategicPremiumForTripleWithPair(
      candidate,
      hand,
      levelRank,
      tableContext.preferredGroups ?? null,
      tableContext,
    )
  ) return false;
  if (breaksMustBeatRoutineSfRunway(
    candidate,
    hand,
    levelRank,
    tableContext.previousPlay ?? null,
    tableContext,
  )) return false;
  return true;
}

/** 须压且 audit 认定有普通压牌，但 premium 分组门禁与 isActionableCandidate 不一致时仍应入池评分 */
function allowMustBeatPremiumBlockedRegular(candidate, hand, levelRank, previousPlay, tableContext) {
  if (!tableContext.hasActionableRegularWinner || tableContext.isFinishingPlay) return false;
  if (!previousPlay || previousPlay.type === PLAY_TYPES.pass) return false;
  if (BOMB_TYPES.has(candidate.type) || candidate.type === PLAY_TYPES.pass) return false;
  if (!canBeat(candidate, previousPlay)) return false;
  const finishing = candidate.cards?.length === hand.length;
  if (!finishing && breaksBombIntegrity(candidate, hand, levelRank, tableContext)) return false;
  const routineTypes = new Set([
    PLAY_TYPES.single,
    PLAY_TYPES.pair,
    PLAY_TYPES.triple,
    PLAY_TYPES.tripleWithPair,
  ]);
  if (!routineTypes.has(previousPlay.type)) return false;
  if (breaksMustBeatRoutineSfRunway(candidate, hand, levelRank, previousPlay, tableContext)) return false;
  if (isActionableCandidate(candidate, hand, levelRank, tableContext)) return false;
  const breaksPremium = breaksPremiumStraightOrJokerGroup(
    candidate,
    tableContext.preferredGroups ?? [],
    levelRank,
  ) || breaksCriticalPreferredGroup(
    candidate,
    tableContext.preferredGroups ?? [],
    levelRank,
    hand,
  );
  // 已有不拆 premium 的可行动压牌时，不再为拆组候选开豁免入池
  if (breaksPremium && tableContext.hasActionableRegularWinner) return false;
  return breaksPremium;
}

export function hasActionableRegularBeater(candidates, hand, levelRank, tableContext) {
  const previousPlay = tableContext.previousPlay ?? null;
  const mustBeat = previousPlay && previousPlay.type !== PLAY_TYPES.pass;
  if (mustBeat && isOpponentEndgameBlock(tableContext)) {
    return candidates.some(
      (candidate) => candidate.type !== PLAY_TYPES.pass
        && !BOMB_TYPES.has(candidate.type)
        && canBeat(candidate, previousPlay),
    );
  }
  const reserveWild = mustBeat
    && shouldReserveWildForSmallRoutineBeat(tableContext, hand, previousPlay, levelRank);
  const reserveStructure = mustBeat
    && shouldReserveStructureForRoutineBeat(tableContext, hand, previousPlay, levelRank);
  const preferPassRoutineTwp = mustBeat
    && shouldPreferPassForHeavyHandRoutineTripleWithPair(tableContext, hand, previousPlay, levelRank);
  const preferredGroups = tableContext.preferredGroups ?? null;
  if (preferPassRoutineTwp) {
    return false;
  }
  if (reserveStructure && !hasStructureSafeRoutineBeater(candidates, previousPlay, hand, levelRank, preferredGroups)) {
    // lite 裁池后候选表可能无散对 A；仍须从手牌识别整对够压，供 P4 拦截同花顺
    if (previousPlay?.type === PLAY_TYPES.pair
      && analyzeMustBeatPairContext(hand, levelRank, previousPlay, tableContext).hasStructureSafeWholePairBeater) {
      return true;
    }
    if (previousPlay?.type === PLAY_TYPES.tripleWithPair
      && analyzeMustBeatTripleWithPairContext(hand, levelRank, previousPlay, tableContext).hasStructureSafeBeater) {
      return true;
    }
    return false;
  }
  return candidates.some(
    (candidate) => candidate.type !== PLAY_TYPES.pass
      && !BOMB_TYPES.has(candidate.type)
      && (!mustBeat || canBeat(candidate, previousPlay))
      && !(reserveWild && isWildLowValueBeat(candidate, levelRank))
      && !(reserveStructure && isStructureBreakingRoutineBeat(candidate, hand, levelRank, preferredGroups))
      && isActionableCandidate(candidate, hand, levelRank, tableContext),
  );
}

function candidatePoolKey(candidate) {
  return candidate.type === PLAY_TYPES.pass
    ? "pass"
    : `${candidate.type}:${candidate.mainRank ?? ""}:${candidate.length ?? 0}:${candidate.bombSize ?? 0}`;
}

/** 完整候选池（与 audit buildAuditContext 对齐，非 lite 生成） */
function buildFullCandidatePool(hand, levelRank, previousPlay, tableContext) {
  if (isPastDeadline(tableContext)) {
    return { preferredGroups: [], candidates: [] };
  }
  const preferredGroups = (tableContext.preferredGroups?.length ?? 0) > 0
    ? tableContext.preferredGroups
    : buildStrategicGroups(hand, levelRank);
  let fullCandidates = generateBasicCandidates(hand, levelRank, previousPlay, { lite: false });
  if (preferredGroups.length > 0) {
    fullCandidates.push(...candidatesFromPreferredGroups(preferredGroups, levelRank, previousPlay, hand));
  }
  if (previousPlay && previousPlay.type !== PLAY_TYPES.pass) {
    fullCandidates.push(classifyPlay([], levelRank));
  }
  return {
    preferredGroups,
    candidates: fullCandidates.filter((candidate) => playUsesOnlyHandCards(hand, candidate)),
  };
}

/** 与 audit 对齐：lite 裁剪池可能漏掉可行动普通压牌 */
export function resolveActionableRegularWinner(hand, levelRank, previousPlay, tableContext) {
  const { preferredGroups, candidates } = buildFullCandidatePool(hand, levelRank, previousPlay, tableContext);
  const enriched = {
    ...tableContext,
    preferredGroups,
    previousPlay,
    hand,
    danger: tableContext.danger ?? opponentDangerLevel({ ...tableContext, hand }),
    opponentActive: tableContext.opponentActive ?? Boolean(
      previousPlay
      && previousPlay.type !== PLAY_TYPES.pass
      && !tableContext.partnerOwnsTrick,
    ),
  };
  return hasActionableRegularBeater(candidates, hand, levelRank, enriched);
}

/** lite 路径补入完整池里可行动、且能压住须压牌型的最小普通压牌 */
function mergeMissingActionableRegularBeaters(candidates, hand, levelRank, previousPlay, tableContext) {
  if (!previousPlay || previousPlay.type === PLAY_TYPES.pass) return candidates;
  // 机器人 / human-lite / deadline 走轻量补漏，勿同步拉全量候选
  if (isPastDeadline(tableContext)
    || tableContext.scoringAudience === "robot"
    || tableContext.scoringAudience === "human-lite"
    || tableContext.lite === true) {
    return mergeMissingActionableRegularBeatersLite(candidates, hand, levelRank, previousPlay, tableContext);
  }
  const { preferredGroups, candidates: fullCandidates } = buildFullCandidatePool(
    hand,
    levelRank,
    previousPlay,
    tableContext,
  );
  const ctx = { ...tableContext, preferredGroups, previousPlay };
  const beatCtx = {
    ...ctx,
    hasActionableRegularWinner: resolveActionableRegularWinner(hand, levelRank, previousPlay, ctx),
  };
  const actionable = fullCandidates.filter(
    (candidate) => candidate.type !== PLAY_TYPES.pass
      && !BOMB_TYPES.has(candidate.type)
      && canBeat(candidate, previousPlay)
      && (
        isActionableCandidate(candidate, hand, levelRank, ctx)
        || allowMustBeatPremiumBlockedRegular(candidate, hand, levelRank, previousPlay, beatCtx)
      ),
  );
  if (actionable.length === 0) return candidates;
  const seen = new Set(candidates.map(candidatePoolKey));
  const merged = [...candidates];
  const byType = new Map();
  for (const candidate of actionable) {
    const list = byType.get(candidate.type) ?? [];
    list.push(candidate);
    byType.set(candidate.type, list);
  }
  for (const list of byType.values()) {
    list.sort((left, right) => left.power - right.power || (left.length ?? 0) - (right.length ?? 0));
    const minimal = list[0];
    const key = candidatePoolKey(minimal);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(minimal);
    }
  }
  return merged;
}

function appendUniqueCandidates(candidates, additions) {
  const seen = new Set(candidates.map(candidatePoolKey));
  const merged = [...candidates];
  for (const candidate of additions) {
    const key = candidatePoolKey(candidate);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(candidate);
    }
  }
  return merged;
}

/** 须压对子时取最小整对够压（优先不拆顺子/同花顺的结构外对子） */
function pickMinWholePairBeater(pairCtx, {
  reserveStructure = false,
  hand = null,
  levelRank = null,
  tableContext = null,
} = {}) {
  if (!pairCtx?.hasWholePairBeater) return null;
  const minFrom = (list) => (list.length > 0
    ? list.reduce((best, item) => (!best || item.power < best.power ? item : best), null)
    : null);
  const runwaySafe = (item) => !hand || !tableContext
    || !breaksStraightFlushRunwayOnMustBeatPair(item, hand, levelRank, tableContext);

  if (pairCtx.structureSafeDedicated?.length > 0) {
    return minFrom(pairCtx.structureSafeDedicated);
  }
  if (pairCtx.structureSafeWholePairBeaters?.length > 0) {
    return minFrom(pairCtx.structureSafeWholePairBeaters);
  }
  // 仅两张同点的散对：书摘允许压对，优于整段同花顺硬压
  if (pairCtx.dedicatedPairBeaters?.length > 0) {
    return minFrom(pairCtx.dedicatedPairBeaters);
  }
  if (reserveStructure) return null;
  const runwayWhole = (pairCtx.wholePairBeaters ?? []).filter(runwaySafe);
  return minFrom(runwayWhole);
}

/** 须压且本手能一次出完：优先同花顺/炸弹（压过当前墩并清空手牌） */
export function pickMustBeatFinishingCandidate(candidates, hand, previousPlay, tableContext = null) {
  if (!previousPlay || previousPlay.type === PLAY_TYPES.pass || !hand?.length) return null;
  if (tableContext && shouldReservePureBombEarly(tableContext, hand, previousPlay)) return null;
  const finishers = (candidates ?? []).filter(
    (item) => item.type !== PLAY_TYPES.pass
      && (item.cards?.length ?? 0) === hand.length
      && canBeat(item, previousPlay),
  );
  if (finishers.length === 0) return null;
  return finishers.sort((left, right) => {
    const leftBomb = BOMB_TYPES.has(left.type) ? 0 : 1;
    const rightBomb = BOMB_TYPES.has(right.type) ? 0 : 1;
    if (leftBomb !== rightBomb) return leftBomb - rightBomb;
    return left.power - right.power;
  })[0];
}

/** 须压三带二时取最小结构安全够压（优先不拆 UI 同花顺跑道、不耗逢人配） */
export function pickMinStructureSafeTripleWithPairBeater(twpCtx, levelRank, hand, tableContext) {
  if (!twpCtx || !hand?.length) return null;
  const usesWild = (item) => (item.cards ?? []).some((card) => isWildCard(card, levelRank));
  const physicalCardKey = (card) => `${card.rank}:${card.suit}:${card.deckIndex ?? 0}`;
  const hasExplicitColumnLayout = (tableContext.preferredGroups ?? [])
    .some((group) => /^列\d+/.test(group.label ?? ""));
  const straightFlushCardSets = (tableContext.preferredGroups ?? [])
    .filter((group) => group.play?.type === PLAY_TYPES.straightFlush || /同花顺/.test(group.label ?? ""))
    .map((group) => new Set((group.play?.cards ?? group.cards ?? []).map(physicalCardKey)))
    .filter((cards) => cards.size >= 4);
  const naturalStraightFlushCardSets = [];
  const chainRanks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const abortCheck = typeof tableContext?.abortCheck === "function" ? tableContext.abortCheck : null;
  const wildCards = hand.filter((card) => isWildCard(card, levelRank));
  for (const suit of new Set(hand.map((card) => card.suit))) {
    if (abortCheck?.()) break;
    const suitedNatural = hand.filter((card) => card.suit === suit && !isWildCard(card, levelRank));
    for (let start = 0; start <= chainRanks.length - 5; start += 1) {
      if (abortCheck?.()) break;
      const ranks = chainRanks.slice(start, start + 5);
      const natural = ranks
        .map((rank) => suitedNatural.find((card) => card.rank === rank))
        .filter(Boolean);
      const missing = 5 - natural.length;
      if (natural.length < 4 || missing > wildCards.length) continue;
      const runway = new Set([...natural, ...wildCards.slice(0, missing)].map(physicalCardKey));
      straightFlushCardSets.push(runway);
      if (missing === 0) naturalStraightFlushCardSets.push(runway);
    }
  }
  const candidateAvoidsSet = (item, sfCards) =>
    (item.cards ?? []).every((card) => !sfCards.has(physicalCardKey(card)));
  const preservesPhysicalStraightFlush = (item) => naturalStraightFlushCardSets.length > 0
    ? naturalStraightFlushCardSets.every((sfCards) => candidateAvoidsSet(item, sfCards))
    : straightFlushCardSets.some((sfCards) => candidateAvoidsSet(item, sfCards));
  let structurallySafe = twpCtx.hasStructureSafeBeater
    ? twpCtx.structureSafeBeaters
    : (twpCtx.beaters ?? []).filter(
      (item) => !breaksBombIntegrity(item, hand, levelRank, tableContext)
        && (
          preservesPhysicalStraightFlush(item)
          || !breaksMustBeatRoutineSfRunway(
            item,
            hand,
            levelRank,
            tableContext.previousPlay ?? null,
            tableContext,
          )
        ),
    );
  structurallySafe = structurallySafe.filter(
    (item) => !breaksBombIntegrity(item, hand, levelRank, tableContext)
      && (
        preservesPhysicalStraightFlush(item)
        || !breaksStrategicPremiumForTripleWithPair(
          item,
          hand,
          levelRank,
          tableContext.preferredGroups ?? [],
          tableContext,
        )
      )
      && (
        !breaksMustBeatRoutineSfRunway(
          item,
          hand,
          levelRank,
          tableContext.previousPlay ?? null,
          tableContext,
        )
        || (!hasExplicitColumnLayout && preservesPhysicalStraightFlush(item))
      ),
  );
  const physicalByRank = new Map();
  for (const card of hand) {
    if (isWildCard(card, levelRank) || card.rank === "SJ" || card.rank === "BJ") continue;
    const list = physicalByRank.get(card.rank) ?? [];
    list.push(card);
    physicalByRank.set(card.rank, list);
  }
  const directNatural = [];
  for (const [tripleRank, tripleCards] of physicalByRank.entries()) {
    if (tripleCards.length !== 3) continue;
    for (const [pairRank, pairCards] of physicalByRank.entries()) {
      if (pairRank === tripleRank || pairCards.length < 2) continue;
      const play = classifyPlay([...tripleCards, ...pairCards.slice(0, 2)], levelRank);
      if (play.type !== PLAY_TYPES.tripleWithPair) continue;
      if (!canBeat(play, tableContext.previousPlay ?? null)) continue;
      const breaksBomb = breaksBombIntegrity(play, hand, levelRank, tableContext);
      if (breaksBomb) {
        // 例8：可拆四2炸弹用 88822 管牌，但不得动四 A
        const usesAce = (play.cards ?? []).some((card) => card.rank === "A");
        const fourAHeld = (physicalByRank.get("A") ?? []).length >= 4;
        if (usesAce || !fourAHeld || pairRank !== "2") continue;
      }
      if (
        breaksStrategicPremiumForTripleWithPair(
          play,
          hand,
          levelRank,
          tableContext.preferredGroups ?? [],
          tableContext,
        )
      ) continue;
      if (straightFlushCardSets.length > 0 && !preservesPhysicalStraightFlush(play)) continue;
      if (
        hasExplicitColumnLayout
        && breaksMustBeatRoutineSfRunway(
          play,
          hand,
          levelRank,
          tableContext.previousPlay ?? null,
          tableContext,
        )
      ) continue;
      directNatural.push(play);
    }
  }
  const directNaturalKeys = new Set(
    directNatural.map((item) => (item.cards ?? []).map(physicalCardKey).sort().join("|")),
  );
  const directKeys = new Set(structurallySafe.map((item) => (item.cards ?? []).map(physicalCardKey).sort().join("|")));
  structurallySafe = [...structurallySafe, ...directNatural.filter((item) => {
    const key = (item.cards ?? []).map(physicalCardKey).sort().join("|");
    if (directKeys.has(key)) return false;
    directKeys.add(key);
    return true;
  })];
  const actionable = structurallySafe.filter(
    (item) => (
      !breaksStrategicPremiumForTripleWithPair(
        item,
        hand,
        levelRank,
        tableContext.preferredGroups ?? [],
        tableContext,
      )
      && (
        directNaturalKeys.has((item.cards ?? []).map(physicalCardKey).sort().join("|"))
        || isActionableCandidate(item, hand, levelRank, tableContext)
      )
    ),
  );
  if (actionable.length === 0) return null;
  const pool = actionable.filter((item) => !usesWild(item));
  const candidates = pool.length > 0 ? pool : actionable;
  const pairAttachmentRank = (play) => {
    const counts = new Map();
    for (const card of play.cards ?? []) {
      counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
    }
    for (const [rank, count] of counts) {
      if (count === 2 && rank !== play.mainRank) return rank;
    }
    return null;
  };
  return candidates.reduce((best, item) => {
    if (!best) return item;
    const itemPair = pairAttachmentRank(item);
    const bestPair = pairAttachmentRank(best);
    if (itemPair === levelRank && bestPair !== levelRank) return best;
    if (bestPair === levelRank && itemPair !== levelRank) return item;
    if (itemPair && bestPair) {
      const cmp = compareRanks(itemPair, bestPair, levelRank);
      if (cmp < 0) return item;
      if (cmp > 0) return best;
    }
    return item.power < best.power ? item : best;
  }, null);
}

/** 人类 lite / 机器人：仅用 lite 候选补漏，不拉全量池 */
function mergeMissingActionableRegularBeatersLite(candidates, hand, levelRank, previousPlay, tableContext) {
  if (!previousPlay || previousPlay.type === PLAY_TYPES.pass) return candidates;
  if (isPastDeadline(tableContext)) return candidates;
  const ctx = { ...tableContext, previousPlay };
  // 须压对子：整对够压须入池；hasActionableRegularBeater 手牌回退不能代替候选表
  if (previousPlay.type === PLAY_TYPES.pair) {
    const pairCtx = analyzeMustBeatPairContext(hand, levelRank, previousPlay, ctx);
    const reserveStructure = shouldReserveStructureForRoutineBeat(ctx, hand, previousPlay, levelRank);
    const minPair = pickMinWholePairBeater(pairCtx, { reserveStructure, hand, levelRank, tableContext: ctx });
    if (minPair) {
      candidates = appendUniqueCandidates(candidates, [minPair]);
    } else if (isOpponentEndgameBlock(ctx)) {
      const splitPair = pairCtx.tripleSplitBeaters?.[0]
        ?? pairCtx.beaters?.find((item) => canBeat(item, previousPlay));
      if (splitPair) {
        candidates = appendUniqueCandidates(candidates, [splitPair]);
      }
    }
  }
  if (previousPlay.type === PLAY_TYPES.tripleWithPair) {
    const twpCtx = analyzeMustBeatTripleWithPairContext(hand, levelRank, previousPlay, ctx);
    const minTwp = pickMinStructureSafeTripleWithPairBeater(twpCtx, levelRank, hand, ctx);
    if (minTwp) {
      candidates = appendUniqueCandidates(candidates, [minTwp]);
    }
  }
  if (hasActionableRegularBeater(candidates, hand, levelRank, ctx)) return candidates;

  let supplement = generateBasicCandidates(hand, levelRank, previousPlay, {
    lite: true,
    robotFast: tableContext.scoringAudience === "robot",
    abortCheck: () => isPastDeadline(tableContext),
  });
  supplement = supplement.filter(
    (candidate) => candidate.type !== PLAY_TYPES.pass
      && !BOMB_TYPES.has(candidate.type)
      && canBeat(candidate, previousPlay)
      && playUsesOnlyHandCards(hand, candidate)
      && isActionableCandidate(candidate, hand, levelRank, ctx),
  );
  if (supplement.length === 0) return candidates;

  const byType = new Map();
  for (const candidate of supplement) {
    const list = byType.get(candidate.type) ?? [];
    list.push(candidate);
    byType.set(candidate.type, list);
  }
  const minimalAdds = [];
  for (const list of byType.values()) {
    list.sort((left, right) => left.power - right.power || (left.length ?? 0) - (right.length ?? 0));
    minimalAdds.push(list[0]);
  }
  return appendUniqueCandidates(candidates, minimalAdds);
}

export function scoreCandidate(candidate, hand, levelRank, previousPlay = null, tableContext = {}) {
  if (tableContext.scoringAudience === "robot") {
    return {
      candidate,
      score: candidate.power ?? 0,
      reasons: isPastDeadline(tableContext)
        ? ["机器人预算内轻量评分"]
        : ["机器人轻量评分"],
    };
  }
  const reasons = [];
  const ctx = tableContext.isOpening != null
    ? { ...tableContext, previousPlay: previousPlay ?? tableContext.previousPlay }
    : enrichScoringContext({ ...tableContext, previousPlay }, tableContext._candidates ?? [], hand, levelRank);
  const isOpening = ctx.isOpening;
  const isPass = candidate.type === PLAY_TYPES.pass;
  const isFinishingPlay = !isPass && candidate.cards.length === hand.length;
  ctx.isFinishingPlay = isFinishingPlay;

  if (isPass) {
    const pressure = opponentPressureAdjustment(candidate, previousPlay, ctx);
    const canFinish = hand.length === 1 && ctx.hasAnyWinner;
    const mustLead = isOpening && ctx.leadMode !== "must-beat";
    const canYieldToPartner = ctx.partnerOwnsTrick && shouldYieldPassToPartner({ ...ctx, hand });
    let passScore = canYieldToPartner ? -2400 : 700;
    if (mustLead && ctx.hasAnyWinner) {
      passScore = 999_999;
      reasons.push("拥有牌权须主动出牌，不可过牌");
    } else if (canFinish) {
      passScore = 12_800;
      reasons.push("能走完先走完，不必让队友");
    } else if (canYieldToPartner) {
      reasons.push("队友占牌，正常让牌");
    } else if (ctx.partnerOwnsTrick) {
      reasons.push("下家对手未表态，不宜盲过");
    }
    passScore += pressure.score;
    reasons.push(...pressure.reasons);
    const principles = scoreCandidateByPrinciples(candidate, hand, levelRank, { ...ctx, hand });
    passScore += principles.score;
    reasons.push(...principles.reasons);
    const bookAdj = bookDoctrineAdjustment(candidate, hand, levelRank, { ...ctx, hand });
    passScore += bookAdj.score;
    reasons.push(...bookAdj.reasons);
    const casesAdj = cases100Adjustment(candidate, hand, levelRank, { ...ctx, hand });
    passScore += casesAdj.score;
    reasons.push(...casesAdj.reasons);
    const vetoPass = shouldVetoBombOnlyPass(ctx, hand, previousPlay);
    return {
      candidate,
      score: passScore,
      reasons,
      principleConflict: vetoPass || principles.hasStrongConflict || undefined,
    };
  }

  let score = isOpening
    ? candidate.power * 18 - candidate.length * 22 + openingShapeScore(candidate)
    : candidate.length * 20 + candidate.power;

  const control = controlCardCost(candidate, levelRank);
  if (isOpening && control > 0 && !isFinishingPlay && !BOMB_TYPES.has(candidate.type)) {
    score += control;
    reasons.push("开局保留高控制牌");
  }

  if (BOMB_TYPES.has(candidate.type)) {
    score += isOpening ? 700 : 500;
  }

  const tempoLead = tempoLeadAdjustment(candidate, hand, ctx, cardKey, levelRank);
  score += tempoLead.score;
  reasons.push(...tempoLead.reasons);

  const structure = structureBreakPenalty(candidate, hand, levelRank, ctx);
  score += structure.penalty;
  reasons.push(...structure.reasons);

  const pressure = opponentPressureAdjustment(candidate, previousPlay, { ...ctx, hand });
  score += pressure.score;
  reasons.push(...pressure.reasons);

  const principles = scoreCandidateByPrinciples(candidate, hand, levelRank, { ...ctx, hand });
  score += principles.score;
  reasons.push(...principles.reasons);

  const bookAdj = bookDoctrineAdjustment(candidate, hand, levelRank, { ...ctx, hand });
  score += bookAdj.score;
  reasons.push(...bookAdj.reasons);

  const casesAdj = cases100Adjustment(candidate, hand, levelRank, { ...ctx, hand });
  score += casesAdj.score;
  reasons.push(...casesAdj.reasons);

  if (
    candidate.type === PLAY_TYPES.tripleWithPair
    && isCatchWindGroupReductionAfterBomb(candidate, { ...ctx, hand })
  ) {
    score -= 24_000;
    reasons.push("【P5】刚炸夺权后用天然三带二一次减五张，优于裸三张");
  }

  // P10 队友让牌、P8 逢人配、P12 机器人节制：见 principles.mjs

  if (isFinishingPlay && !shouldReservePureBombEarly(ctx, hand, previousPlay)) {
    score -= 5200;
    reasons.push(ctx.partnerOwnsTrick ? "能走完先走完，不必让队友" : "能走完先走完");
  }

  if (!isOpening && !ctx.partnerOwnsTrick && ctx.danger >= 2) {
    score -= 400;
    reasons.push("对手剩牌少，提高拦截积极性");
  }

  const left = remainingHandAfter(candidate, hand);
  if (left <= 3 && !isFinishingPlay) score -= 120;

  if (!isOpening && candidate.type === PLAY_TYPES.pair) {
    reasons.push("用对子跟牌或抢权");
  }

  return {
    candidate,
    score,
    reasons,
    principleConflict: principles.hasStrongConflict,
  };
}

function resolveLeadModeForTrim(previousPlay, tableContext) {
  const mustBeat = previousPlay && previousPlay.type !== PLAY_TYPES.pass;
  if (mustBeat) return "must-beat";
  if (tableContext.leadMode) return tableContext.leadMode;
  const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex;
  if (tableContext.state && playerIndex != null) {
    return inferLeadMode(tableContext.state, playerIndex);
  }
  return "fresh-open";
}

/** @deprecated 使用 sf-runway-guard.isLeadTurnSfRunwayBreak */
function openingLeadBreaksStraightFlush(candidate, hand, levelRank, tableContext = null) {
  return isLeadTurnSfRunwayBreak(candidate, hand, levelRank, tableContext);
}

/** 评分前裁剪候选：保留过牌、最小可压牌与炸弹，避免全量候选阻塞主线程 */
export function trimCandidatesForScoring(candidates, maxCandidates, hand, levelRank, previousPlay, tableContext) {
  candidates = filterCandidatesPreservingSfRunway(
    candidates,
    hand,
    levelRank,
    previousPlay,
    tableContext,
  );
  if (!maxCandidates || candidates.length <= maxCandidates) return candidates;
  const picked = [];
  const seen = new Set();
  const push = (candidate) => {
    const cardSig = candidate.cards?.length
      ? candidate.cards.map((card) => `${card.rank}:${card.suit}:${card.deckIndex}`).sort().join("|")
      : "";
    const key = candidate.type === PLAY_TYPES.pass
      ? "pass"
      : `${candidate.type}:${candidate.mainRank ?? ""}:${candidate.length ?? 0}:${candidate.bombSize ?? 0}:${cardSig}`;
    if (seen.has(key)) return;
    seen.add(key);
    picked.push(candidate);
  };

  const pass = candidates.find((c) => c.type === PLAY_TYPES.pass);
  if (pass) push(pass);

  const mustBeat = previousPlay && previousPlay.type !== PLAY_TYPES.pass;
  const needsLiteTrim = Boolean(maxCandidates && candidates.length > maxCandidates);
  const leadModeForTrim = mustBeat ? "must-beat" : resolveLeadModeForTrim(previousPlay, tableContext);
  const isOpeningLikeLead = needsLiteTrim
    && !mustBeat
    && (leadModeForTrim === "fresh-open" || leadModeForTrim === "catch-wind");
  const preferredGroupsForTrim = tableContext.preferredGroups?.length
    ? tableContext.preferredGroups
    : buildStrategicGroups(hand, levelRank);
  // 刚炸/同花顺接风残局：优先锁 UI 理牌列完整顺子/同花顺（如红桃10-J-Q-K-A），避免只剩连对拆另一道同花顺
  if (
    isOpeningLikeLead
    && leadModeForTrim === "catch-wind"
    && preferredGroupsForTrim.length > 0
  ) {
    const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex ?? 0;
    const afterBombWin = playerJustWonTrickWithBomb(tableContext.state, playerIndex);
    if (afterBombWin && hand.length <= CATCH_WIND_RUNWAY_HAND_MAX) {
      for (const group of preferredGroupsForTrim) {
        const cards = group.cards ?? group;
        if (!Array.isArray(cards) || cards.length < 5) continue;
        const play = group.play ?? classifyPlay(cards, levelRank);
        if (
          (play.type === PLAY_TYPES.straight || play.type === PLAY_TYPES.straightFlush)
          && !(play.cards ?? cards).some((card) => isWildCard(card, levelRank))
        ) {
          push(play);
        }
      }
    }
  }
  const bombs = candidates
    .filter((c) => BOMB_TYPES.has(c.type))
    .sort((left, right) => left.power - right.power);
  const beatCtx = {
    ...tableContext,
    previousPlay,
    hasActionableRegularWinner: mustBeat
      ? ((tableContext.lite === true
        || tableContext.scoringAudience === "robot"
        || tableContext.scoringAudience === "human-lite"
        || isPastDeadline(tableContext))
        ? hasActionableRegularBeater(candidates, hand, levelRank, { ...tableContext, previousPlay })
        : resolveActionableRegularWinner(hand, levelRank, previousPlay, tableContext))
      : false,
  };
  const isScorableRegular = (candidate) => isActionableCandidate(candidate, hand, levelRank, tableContext)
    || allowMustBeatPremiumBlockedRegular(candidate, hand, levelRank, previousPlay, beatCtx);
  const usesWildInPlay = (candidate) => (candidate.cards ?? []).some((card) => isWildCard(card, levelRank));
  const pickBetterTripleWithPairBeater = (prev, cur) => {
    const prevBreak = breaksPremiumStraightOrJokerGroup(prev, preferredGroupsForTrim, levelRank);
    const curBreak = breaksPremiumStraightOrJokerGroup(cur, preferredGroupsForTrim, levelRank);
    if (prevBreak !== curBreak) return curBreak ? prev : cur;
    const prevWild = usesWildInPlay(prev);
    const curWild = usesWildInPlay(cur);
    if (prevWild !== curWild) return curWild ? prev : cur;
    const prevKicker = inferTripleWithPairKickerRank(prev);
    const curKicker = inferTripleWithPairKickerRank(cur);
    if (prevKicker && curKicker && prevKicker !== curKicker) {
      return compareRanks(prevKicker, curKicker, levelRank) <= 0 ? prev : cur;
    }
    return cur.power < prev.power ? cur : prev;
  };
  const preferNonPremiumBreak = (left, right) => {
    const leftBreak = breaksPremiumStraightOrJokerGroup(left, preferredGroupsForTrim, levelRank);
    const rightBreak = breaksPremiumStraightOrJokerGroup(right, preferredGroupsForTrim, levelRank);
    if (leftBreak !== rightBreak) return leftBreak ? 1 : -1;
    return 0;
  };
  const preferNaturalTripleWithPair = (left, right) => {
    if (left.type !== PLAY_TYPES.tripleWithPair || right.type !== PLAY_TYPES.tripleWithPair) return 0;
    const leftWild = usesWildInPlay(left);
    const rightWild = usesWildInPlay(right);
    if (leftWild !== rightWild) return leftWild ? 1 : -1;
    return 0;
  };
  const preferMinTripleWithPairKicker = (left, right) => {
    if (left.type !== PLAY_TYPES.tripleWithPair || right.type !== PLAY_TYPES.tripleWithPair) return 0;
    if (left.mainRank !== right.mainRank) return 0;
    const leftKicker = inferTripleWithPairKickerRank(left);
    const rightKicker = inferTripleWithPairKickerRank(right);
    if (!leftKicker || !rightKicker || leftKicker === rightKicker) return 0;
    return compareRanks(leftKicker, rightKicker, levelRank) <= 0 ? -1 : 1;
  };
  const sortRegularCandidates = (left, right) => preferNonPremiumBreak(left, right)
    || preferNaturalTripleWithPair(left, right)
    || preferMinTripleWithPairKicker(left, right)
    || (right.length ?? right.cards?.length ?? 0) - (left.length ?? left.cards?.length ?? 0)
    || left.power - right.power
    || left.length - right.length;
  const regularPreFilter = candidates
    .filter((candidate) => candidate.type !== PLAY_TYPES.pass && !BOMB_TYPES.has(candidate.type))
    .filter((candidate) => !mustBeat || canBeat(candidate, previousPlay));
  // 开局 lite：勿对上千候选逐一 breaksBombIntegrity，入池时再验
  const regularCandidates = isOpeningLikeLead
    ? regularPreFilter.sort(sortRegularCandidates)
    : regularPreFilter
      .filter((candidate) => isScorableRegular(candidate))
      .sort(sortRegularCandidates);

  // 须压四炸时先锁够压炸弹，避免 lite 被开局候选挤满后只剩同花顺
  if (mustBeat?.type === PLAY_TYPES.bomb) {
    for (const candidate of bombs) {
      if (candidate.type !== PLAY_TYPES.bomb || !canBeat(candidate, mustBeat)) continue;
      push(candidate);
      if (picked.length >= maxCandidates) break;
    }
    // 独立纯四炸够压时强制入池，避免 lite 裁剪漏掉非最小点炸
    if (hasStandalonePureBombBeater(hand, bombs.filter((item) => canBeat(item, mustBeat)))) {
      for (const candidate of bombs) {
        if (candidate.type !== PLAY_TYPES.bomb || !canBeat(candidate, mustBeat)) continue;
        const bombSize = candidate.bombSize ?? candidate.cards?.length ?? 4;
        const physicalHeld = hand.filter((card) => card.rank === candidate.mainRank
          && card.rank !== "SJ" && card.rank !== "BJ").length;
        if (bombSize === 4 && physicalHeld === 4) push(candidate);
      }
    }
  }

  if (mustBeat?.type === PLAY_TYPES.single) {
    const c100Single = pickC100MustBeatSingleBeater(hand, levelRank, mustBeat, candidates);
    if (c100Single) push(c100Single);
    for (const candidate of candidates) {
      if (candidate.type !== PLAY_TYPES.single || !canBeat(candidate, mustBeat)) continue;
      if (breaksPremiumStraightOrJokerGroup(candidate, preferredGroupsForTrim, levelRank)) continue;
      if (!isSafeNonStraightBreakSingleRank(candidate.mainRank, hand, levelRank)) continue;
      push(candidate);
    }
  }

  if (mustBeat?.type === PLAY_TYPES.tripleWithPair) {
    const byRank = new Map();
    for (const candidate of candidates) {
      if (candidate.type !== PLAY_TYPES.tripleWithPair || !canBeat(candidate, mustBeat)) continue;
      if (!isActionableCandidate(candidate, hand, levelRank, tableContext)) continue;
      if (breaksPremiumStraightOrJokerGroup(candidate, preferredGroupsForTrim, levelRank)) continue;
      const rank = candidate.mainRank;
      const prev = byRank.get(rank);
      if (!prev) {
        byRank.set(rank, candidate);
        continue;
      }
      byRank.set(rank, pickBetterTripleWithPairBeater(prev, candidate));
    }
    for (const candidate of byRank.values()) push(candidate);
  }

  if (mustBeat && [PLAY_TYPES.pair, PLAY_TYPES.triple, PLAY_TYPES.tripleWithPair].includes(mustBeat.type)) {
    const routineBeaters = candidates.filter(
      (candidate) => candidate.type !== PLAY_TYPES.pass
        && !BOMB_TYPES.has(candidate.type)
        && canBeat(candidate, mustBeat)
        && isScorableRegular(candidate),
    );
    routineBeaters.sort((left, right) => preferNonPremiumBreak(left, right)
      || preferNaturalTripleWithPair(left, right)
      || left.power - right.power
      || (left.length ?? 0) - (right.length ?? 0));
    if (routineBeaters.length > 0) push(routineBeaters[0]);
  }

  if (mustBeat) {
    for (const candidate of regularCandidates) {
      if (picked.length >= maxCandidates) break;
      push(candidate);
    }
  }

  if (isOpeningLikeLead) {
    // 开局/接风：战略分组里的成组路线优先入池（lite 不跳过 preferredGroups 时）
    for (const group of tableContext.preferredGroups ?? []) {
      const groupCards = group.cards ?? group;
      if (!Array.isArray(groupCards) || groupCards.length === 0) continue;
      const play = group.play ?? classifyPlay(groupCards, levelRank);
      if (play.type === PLAY_TYPES.pass || BOMB_TYPES.has(play.type)) continue;
      if (!isActionableCandidate(play, hand, levelRank, tableContext)) continue;
      push(play);
    }
    // L1 弱路门禁：主攻两小单时强制保留散单候选入池（第12篇）
    const profile = tableContext.handProfile;
    if (
      leadModeForTrim === "fresh-open"
      && profile?.role === "main-attack"
      && (profile?.looseSingles ?? 0) >= 2
    ) {
      for (const rank of looseSmallSingleRanks(hand, levelRank)) {
        const looseSingle = candidates.find(
          (item) => item.type === PLAY_TYPES.single && item.mainRank === rank,
        );
        if (looseSingle) push(looseSingle);
      }
    }
    // 游戏 quick/full 预算 ≤20：强制保留不拆同花顺/成组的散单，避免裁池后只剩杂顺
    if (leadModeForTrim === "fresh-open" && maxCandidates <= 20) {
      for (const rank of looseSmallSingleRanks(hand, levelRank)) {
        const looseSingle = candidates.find(
          (item) => item.type === PLAY_TYPES.single && item.mainRank === rank,
        );
        if (looseSingle) push(looseSingle);
      }
      const safeSingle = candidates
        .filter((item) => item.type === PLAY_TYPES.single
          && !breaksPremiumStraightOrJokerGroup(item, preferredGroupsForTrim, levelRank))
        .sort((left, right) => left.power - right.power)[0];
      if (safeSingle) push(safeSingle);
    }
    // 真开局：先锁普通成组路线，避免炸弹占满 lite 候选池后只剩同花顺空炸
    const bombBudget = Math.max(2, Math.floor(maxCandidates * 0.25));
    const regularBudget = maxCandidates - bombBudget;
    for (const candidate of regularCandidates) {
      if (picked.length >= regularBudget) break;
      if (!isScorableRegular(candidate)) continue;
      if (openingLeadBreaksStraightFlush(candidate, hand, levelRank, tableContext)) continue;
      push(candidate);
    }
    for (const candidate of bombs) {
      if (picked.length >= maxCandidates) break;
      push(candidate);
    }
    return picked;
  }

  for (const candidate of bombs) {
    if (picked.length >= maxCandidates) break;
    push(candidate);
  }
  for (const candidate of regularCandidates) {
    if (picked.length >= maxCandidates) break;
    push(candidate);
  }

  for (const candidate of candidates) {
    if (picked.length >= maxCandidates) break;
    if (candidate.type === PLAY_TYPES.pass || BOMB_TYPES.has(candidate.type)) continue;
    push(candidate);
  }
  return picked;
}

function isPastDeadline(ctx) {
  if (ctx.deadline != null && performance.now() > ctx.deadline) return true;
  if (typeof ctx.abortCheck === "function" && ctx.abortCheck()) return true;
  return false;
}

/** 须压三带二/连对：是否拆同花顺/跑道（不依赖 UI 理牌列是否标成同花顺） */
function breaksMustBeatRoutineSfRunway(candidate, hand, levelRank, previousPlay, tableContext) {
  const ctx = { ...tableContext, previousPlay };
  if (previousPlay?.type === PLAY_TYPES.tripleWithPair && candidate?.type === PLAY_TYPES.tripleWithPair) {
    return breaksStraightFlushRunwayOnMustBeatTwp(candidate, hand, levelRank, ctx) != null;
  }
  if (previousPlay?.type === PLAY_TYPES.consecutivePairs && candidate?.type === PLAY_TYPES.consecutivePairs) {
    return breaksStraightFlushRunwayOnMustBeatCp(candidate, hand, levelRank, ctx) != null;
  }
  if (previousPlay?.type === PLAY_TYPES.pair && candidate?.type === PLAY_TYPES.pair) {
    return breaksStraightFlushRunwayOnMustBeatPair(candidate, hand, levelRank, ctx) != null;
  }
  return false;
}

/** @deprecated 兼容旧名 */
function breaksMustBeatTwpSfRunway(candidate, hand, levelRank, previousPlay, tableContext) {
  return breaksMustBeatRoutineSfRunway(candidate, hand, levelRank, previousPlay, tableContext);
}

/** deadline 超时：lite 应急候选 + 不拆同花顺/王炸，避免空池误判只能过牌 */
function buildDeadlineFallbackRecommendations(hand, levelRank, previousPlay, tableContext) {
  const preferredGroups = tableContext.preferredGroups ?? [];
  const mustLead = !previousPlay || previousPlay.type === PLAY_TYPES.pass;
  if (!mustLead) {
    const yieldCtx = enrichScoringContext(
      { ...tableContext, previousPlay },
      [],
      hand,
      levelRank,
    );
    if (yieldCtx.partnerOwnsTrick && shouldYieldPassToPartner(yieldCtx)) {
      const passPlay = classifyPlay([], levelRank);
      return {
        top: { candidate: passPlay, score: 0, reasons: ["计算超时，队友占牌兜底过牌"] },
        pool: [],
        scoringContext: { ...tableContext, preferredGroups },
        blockedCandidates: [],
      };
    }
  }
  const innerDeadline = performance.now() + 300;
  const reserveWildForRoutine = !mustLead
    && shouldReserveWildForSmallRoutineBeat(
      { ...tableContext, opponentActive: true, previousPlay },
      hand,
      previousPlay,
      levelRank,
    );
  const pool = generateBasicCandidates(hand, levelRank, previousPlay, {
    lite: true,
    emergency: true,
    // 超时后只枚举与上一手同型的应急候选；不能启用 robotFast，
    // 该模式会主动关闭钢板/连对/三带二，造成“明明可压却 Pass”。
    robotFast: false,
    abortCheck: () => performance.now() > innerDeadline,
  })
    .filter((candidate) => playUsesOnlyHandCards(hand, candidate))
    .filter((candidate) => {
      if (candidate.type === PLAY_TYPES.pass) return false;
      if (!mustLead && !canBeat(candidate, previousPlay)) return false;
      if (reserveWildForRoutine && isWildLowValueBeat(candidate, levelRank)) return false;
      if (mustLead) return true;
      return !breaksPreferredStrategicGroup(candidate, preferredGroups, levelRank, hand);
    });
  if (mustLead) {
    const pureBomb = pickPureFullBombFinisher(hand, levelRank, pool);
    if (pureBomb) {
      return {
        top: {
          candidate: pureBomb,
          score: 0,
          reasons: ["能走完先走完，满张出炸"],
        },
        pool: [],
        scoringContext: { ...tableContext, preferredGroups },
        blockedCandidates: [],
      };
    }
  }
  const partnerPick = pickPartnerAwareEmergencyCandidate(
    hand,
    levelRank,
    previousPlay,
    pool,
    tableContext,
    preferredGroups,
  );
  if (partnerPick) {
    return {
      top: { candidate: partnerPick.candidate, score: 0, reasons: partnerPick.reasons },
      pool: [],
      scoringContext: { ...tableContext, preferredGroups },
      blockedCandidates: [],
    };
  }
  if (!mustLead && previousPlay.type === PLAY_TYPES.single) {
    const beatCtx = enrichScoringContext(
      { ...tableContext, previousPlay },
      pool,
      hand,
      levelRank,
    );
    beatCtx._candidates = pool;
    const hasRegularBeater = pool.some(
      (candidate) => !BOMB_TYPES.has(candidate.type) && canBeat(candidate, previousPlay),
    );
    if (
      !hasRegularBeater
      && shouldReserveBombForHighProbeSingle(beatCtx, hand, previousPlay, levelRank)
    ) {
      const passPlay = classifyPlay([], levelRank);
      return {
        top: {
          candidate: passPlay,
          score: 0,
          reasons: ["计算超时，对手高位单张仅炸弹或同花顺可压，保留牌力过牌"],
        },
        pool: [],
        scoringContext: { ...tableContext, preferredGroups },
        blockedCandidates: [],
      };
    }
  }
  if (!mustLead && previousPlay.type === PLAY_TYPES.pair) {
    const beatCtx = enrichScoringContext(
      { ...tableContext, previousPlay },
      pool,
      hand,
      levelRank,
    );
    if (beatCtx.opponentActive && !beatCtx.partnerOwnsTrick) {
      const pairCtx = analyzeMustBeatPairContext(hand, levelRank, previousPlay, beatCtx);
      const reserveStructure = shouldReserveStructureForRoutineBeat(beatCtx, hand, previousPlay, levelRank);
      const minPair = pickMinWholePairBeater(pairCtx, { reserveStructure, hand, levelRank, tableContext: beatCtx });
      if (minPair) {
        return {
          top: {
            candidate: minPair,
            score: 0,
            reasons: ["计算超时，最小整对压牌（不亮同花顺）"],
          },
          pool: [],
          scoringContext: { ...tableContext, preferredGroups },
          blockedCandidates: [],
        };
      }
      if (pairCtx.hasWholePairBeater && !pairCtx.hasStructureSafeWholePairBeater && !pairCtx.dedicatedPairBeaters?.length) {
        const passPlay = classifyPlay([], levelRank);
        return {
          top: {
            candidate: passPlay,
            score: 0,
            reasons: ["计算超时，无结构安全对子可压，宜过牌保留同花顺"],
          },
          pool: [],
          scoringContext: { ...tableContext, preferredGroups },
          blockedCandidates: [],
        };
      }
      if (requiresBombForPairBeat(hand, levelRank, previousPlay, beatCtx)) {
        const minBomb = pickMinStructureBombBeater(hand, levelRank, previousPlay, beatCtx);
        if (minBomb?.type === PLAY_TYPES.bomb) {
          return {
            top: {
              candidate: minBomb,
              score: 0,
              reasons: ["计算超时，最小炸弹压级牌对"],
            },
            pool: [],
            scoringContext: { ...tableContext, preferredGroups },
            blockedCandidates: [],
          };
        }
        const passPlay = classifyPlay([], levelRank);
        return {
          top: {
            candidate: passPlay,
            score: 0,
            reasons: ["计算超时，无对可压且不宜亮同花顺，宜过牌"],
          },
          pool: [],
          scoringContext: { ...tableContext, preferredGroups },
          blockedCandidates: [],
        };
      }
    }
  }
  if (!mustLead && previousPlay.type === PLAY_TYPES.tripleWithPair) {
    const beatCtx = enrichScoringContext(
      { ...tableContext, previousPlay },
      pool,
      hand,
      levelRank,
    );
    if (beatCtx.opponentActive && !beatCtx.partnerOwnsTrick) {
      const twpCtx = analyzeMustBeatTripleWithPairContext(hand, levelRank, previousPlay, beatCtx);
      const minTwp = pickMinStructureSafeTripleWithPairBeater(twpCtx, levelRank, hand, beatCtx);
      if (minTwp) {
        return {
          top: {
            candidate: minTwp,
            score: 0,
            reasons: ["计算超时，最小不拆同花顺跑道三带二"],
          },
          pool: [],
          scoringContext: { ...tableContext, preferredGroups },
          blockedCandidates: [],
        };
      }
      const passPlay = classifyPlay([], levelRank);
      return {
        top: {
          candidate: passPlay,
          score: 0,
          reasons: ["计算超时，无结构安全三带二可压，宜过牌保留同花顺"],
        },
        pool: [],
        scoringContext: { ...tableContext, preferredGroups },
        blockedCandidates: [],
      };
    }
  }
  const candidate = mustLead
    ? pickOpeningLeadFallback(hand, levelRank, pool, preferredGroups, tableContext)
    : pool[0];
  if (!candidate || candidate.type === PLAY_TYPES.pass) {
    if (mustLead) {
      const extra = generateBasicCandidates(hand, levelRank, previousPlay, {
        lite: true,
        emergency: true,
      }).filter((item) => item.type !== PLAY_TYPES.pass);
      const lead = pickOpeningLeadFallback(hand, levelRank, extra, preferredGroups, tableContext);
      if (lead) {
        return {
          top: { candidate: lead, score: 0, reasons: ["计算超时，兜底领出"] },
          pool: [],
          scoringContext: { ...tableContext, preferredGroups },
          blockedCandidates: [],
        };
      }
    }
    const passPlay = classifyPlay([], levelRank);
    return {
      top: {
        candidate: passPlay,
        score: 0,
        reasons: mustLead ? ["计算超时，兜底领出"] : ["计算超时，兜底过牌"],
      },
      pool: [],
      scoringContext: { ...tableContext, preferredGroups },
      blockedCandidates: [],
    };
  }
  return {
    top: { candidate, score: 0, reasons: ["计算超时，临时建议（不拆成组结构）"] },
    pool: [],
    scoringContext: { ...tableContext, preferredGroups },
    blockedCandidates: [],
  };
}

function deadlineFallbackRecommendations(hand, levelRank, previousPlay, tableContext) {
  const result = buildDeadlineFallbackRecommendations(hand, levelRank, previousPlay, tableContext);
  const safeTop = filterHardInvariants(
    result?.top?.candidate ? [result.top.candidate] : [],
    hand,
    levelRank,
    { ...tableContext, previousPlay, hand },
  );
  if (safeTop.length > 0 || !result?.top?.candidate) return result;

  const mustLead = !previousPlay || previousPlay.type === PLAY_TYPES.pass;
  const safePool = filterHardInvariants(
    generateBasicCandidates(hand, levelRank, previousPlay, { lite: true, emergency: true }),
    hand,
    levelRank,
    { ...tableContext, previousPlay, hand },
  ).filter((candidate) => candidate.type !== PLAY_TYPES.pass && (mustLead || canBeat(candidate, previousPlay)));
  const candidate = mustLead
    ? (pickOpeningLeadFallback(
      hand,
      levelRank,
      safePool,
      tableContext.preferredGroups ?? [],
      { ...tableContext, previousPlay, hand },
    ) ?? safePool[0])
    : null;
  return {
    ...result,
    top: {
      candidate: candidate ?? classifyPlay([], levelRank),
      score: 0,
      reasons: [candidate ? "计算超时：硬不变量安全领出" : "计算超时：硬不变量拦截，过牌"],
    },
    blockedCandidates: [
      ...(result.blockedCandidates ?? []),
      ...(result.top?.candidate ? [result.top.candidate] : []),
    ],
  };
}

function resolvePreferredGroups(hand, levelRank, tableContext, litePath) {
  if ((tableContext.preferredGroups?.length ?? 0) > 0) {
    return tableContext.preferredGroups;
  }
  // lite / human-lite / robot 不跑 buildStrategicGroups，避免同花顺枚举卡死主线程
  if (litePath) {
    return tableContext.preferredGroups ?? [];
  }
  return buildStrategicGroups(hand, levelRank);
}

function resolvePreviousPlay(previousPlay, tableContext) {
  if (tableContext.state) {
    return effectivePreviousPlay(tableContext.state) ?? previousPlay ?? tableContext.previousPlay ?? null;
  }
  return previousPlay ?? tableContext.previousPlay ?? null;
}

function pickRobotMinPower(pool) {
  return pool.slice().sort(
    (left, right) => left.power - right.power || (left.length ?? 0) - (right.length ?? 0),
  )[0] ?? null;
}

function isRobotOpeningLeadTurn(tableContext, mustLead) {
  if (!mustLead || !tableContext.state) return false;
  const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex ?? 0;
  const leadMode = inferLeadMode(tableContext.state, playerIndex);
  return leadMode === "fresh-open" || leadMode === "catch-wind";
}

/** 领出/接风：与人类 emergency 相同的逢人配/空炸过滤 */
function filterRobotOpeningLeadPool(pool, hand, levelRank, tableContext, mustLead) {
  if (!isRobotOpeningLeadTurn(tableContext, mustLead)) return pool;
  let active = pool.filter((item) => item.type !== PLAY_TYPES.pass);
  const handLen = hand.length;
  if (handLen > 7) {
    const noEmptyBomb = active.filter(
      (item) => !BOMB_TYPES.has(item.type) || (item.cards?.length ?? 0) >= handLen,
    );
    if (noEmptyBomb.length > 0) active = noEmptyBomb;
  }
  const withoutWild = active.filter((item) => !isWildLowValueBeat(item, levelRank));
  if (withoutWild.length > 0) active = withoutWild;
  const withoutBombBreak = active.filter(
    (item) => !breaksBombIntegrity(item, hand, levelRank, tableContext),
  );
  if (withoutBombBreak.length > 0) active = withoutBombBreak;
  const withoutBareLevelPair = filterBareLevelRankPairLeads(active, hand, levelRank, active);
  if (withoutBareLevelPair.length > 0) active = withoutBareLevelPair;
  return active;
}

/** 机器人领出/接风：与人类同源 scoreCandidate + pickOpeningLeadFallback 兜底 */
function pickRobotLeadByPrinciples(hand, levelRank, candidates, tableContext) {
  const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex ?? 0;
  const leadMode = tableContext.state
    ? inferLeadMode(tableContext.state, playerIndex)
    : "fresh-open";
  const preferredGroups = buildStrategicGroups(hand, levelRank, { skipStraightFlush: true });
  const pool = filterRobotOpeningLeadPool(
    candidates.filter((item) => item.type !== PLAY_TYPES.pass),
    hand,
    levelRank,
    tableContext,
    true,
  );
  const openCtx = {
    ...tableContext,
    hand,
    playerIndex,
    isOpening: true,
    leadMode,
    previousPlay: null,
    preferredGroups,
    lite: true,
    _candidates: candidates,
    // 领出/接风须与人类同源完整评分；勿沿用 robot 的 power 轻量分
    scoringAudience: "human-lite",
  };
  if (!isPastDeadline(tableContext)) {
    const oppTwoCard = opponentReportsTwoCards(tableContext);
    let scorePool = pool;
    if (oppTwoCard) {
      const noPairs = pool.filter((item) => item.type !== PLAY_TYPES.pair);
      scorePool = noPairs.length > 0 ? noPairs : pool;
    } else if (hand.length >= 8) {
      scorePool = pool.filter((item) => item.type !== PLAY_TYPES.single);
    }
    if (
      (leadMode === "catch-wind" || leadMode === "fresh-open")
      && hand.length <= 12
      && !oppTwoCard
      && scorePool.some((item) => item.type === PLAY_TYPES.tripleWithPair)
    ) {
      const noSingles = scorePool.filter((item) => item.type !== PLAY_TYPES.single);
      if (noSingles.length > 0) scorePool = noSingles;
    }
    const toScore = scorePool.length > 0 ? scorePool : pool;
    const leadTypeRank = (item) => {
      if (item.type === PLAY_TYPES.tripleWithPair) return 0;
      if (item.type === PLAY_TYPES.consecutivePairs) return 1;
      if (item.type === PLAY_TYPES.plane) return 2;
      if (item.type === PLAY_TYPES.straight) return 3;
      if (item.type === PLAY_TYPES.triple) return 4;
      if (item.type === PLAY_TYPES.pair) return 5;
      return 6;
    };
    const orderedToScore = [...toScore].sort(
      (left, right) => leadTypeRank(left) - leadTypeRank(right) || left.power - right.power,
    );
    const scored = [];
    const cap = Math.min(orderedToScore.length, 24);
    for (let i = 0; i < cap; i += 1) {
      if (isPastDeadline(tableContext)) break;
      const candidate = orderedToScore[i];
      if (isLeadTurnSfRunwayBreak(candidate, hand, levelRank, openCtx)) continue;
      if (breaksMustBeatRoutineSfRunway(candidate, hand, levelRank, null, openCtx)) continue;
      if (breaksBombIntegrity(candidate, hand, levelRank, openCtx)) continue;
      if (breaksPreferredStrategicGroup(candidate, preferredGroups, levelRank, hand, openCtx)) continue;
      scored.push(scoreCandidate(candidate, hand, levelRank, null, openCtx));
    }
    if (scored.length > 0) {
      if (
        (leadMode === "catch-wind" || leadMode === "fresh-open")
        && hand.length <= 12
        && !oppTwoCard
      ) {
        scored.sort((left, right) => {
          const twpBias = (item) => (item.candidate.type === PLAY_TYPES.tripleWithPair ? 1 : 0);
          const biasDiff = twpBias(right) - twpBias(left);
          if (biasDiff !== 0) return biasDiff;
          return left.score - right.score;
        });
      } else {
        scored.sort((left, right) => left.score - right.score);
      }
      return scored[0].candidate;
    }
  }
  const fallback = pickOpeningLeadFallback(hand, levelRank, pool, preferredGroups, openCtx);
  if (fallback && isBareLevelRankPairLead(fallback, hand, levelRank, candidates)) {
    const safe = filterBareLevelRankPairLeads(pool, hand, levelRank, candidates);
    return safe[0] ?? fallback;
  }
  return fallback;
}

/** 机器人须压：与人类 emergency 同源 analyzeMustBeat* + 结构保护 */
function pickRobotMustBeatByPrinciples(hand, levelRank, previousPlay, candidates, beatCtx) {
  if (beatCtx.partnerOwnsTrick && shouldRobotYieldPassToPartner({ ...beatCtx, hand })) {
    return null;
  }
  const structureSafe = (list) => list.filter(
    (item) => !breaksBombIntegrity(item, hand, levelRank, beatCtx)
      && !breaksPreferredStrategicGroup(item, [], levelRank, hand, beatCtx),
  );
  let beaters = structureSafe(candidates.filter(
    (item) => item.type !== PLAY_TYPES.pass && canBeat(item, previousPlay),
  ));
  if (beatCtx.partnerOwnsTrick) {
    beaters = beaters.filter((item) => !BOMB_TYPES.has(item.type));
  }
  const regular = beaters.filter((item) => !BOMB_TYPES.has(item.type));
  const preferredGroups = [];
  if (previousPlay.type === PLAY_TYPES.single) {
    const ctx = analyzeMustBeatSingleContext(hand, levelRank, previousPlay, {
      ...beatCtx,
      _candidates: candidates,
      preferredGroups,
    });
    const reserveStructure = shouldReserveStructureForRoutineBeat(
      beatCtx,
      hand,
      previousPlay,
      levelRank,
    );
    const structureFilter = (list) => (reserveStructure
      ? list.filter((item) => !isStructureBreakingRoutineBeat(item, hand, levelRank, preferredGroups))
      : list);
    const pool = structureFilter(
      ctx.playableLooseBeaters.length > 0
        ? ctx.playableLooseBeaters
        : ctx.safeLooseBeaters.length > 0
          ? ctx.safeLooseBeaters
          : regular.filter(
            (item) => !breaksPreferredStrategicGroup(item, preferredGroups, levelRank, hand, beatCtx),
          ),
    );
    return pickRobotMinPower(pool);
  }
  if (previousPlay.type === PLAY_TYPES.pair) {
    const pairCtx = analyzeMustBeatPairContext(hand, levelRank, previousPlay, {
      ...beatCtx,
      _candidates: candidates,
      preferredGroups,
    });
    const reserveStructure = shouldReserveStructureForRoutineBeat(
      beatCtx,
      hand,
      previousPlay,
      levelRank,
    );
    const structureSafePool = pairCtx.structureSafeDedicated?.length > 0
      ? pairCtx.structureSafeDedicated
      : pairCtx.structureSafeWholePairBeaters?.length > 0
        ? pairCtx.structureSafeWholePairBeaters
        : [];
    if (structureSafePool.length > 0) {
      return pickRobotMinPower(structureSafePool);
    }
    if (pairCtx.dedicatedPairBeaters?.length > 0) {
      return pickRobotMinPower(pairCtx.dedicatedPairBeaters);
    }
    if (!reserveStructure && pairCtx.wholePairBeaters?.length > 0) {
      const runwaySafe = pairCtx.wholePairBeaters.filter(
        (item) => !breaksStraightFlushRunwayOnMustBeatPair(item, hand, levelRank, beatCtx),
      );
      if (runwaySafe.length > 0) return pickRobotMinPower(runwaySafe);
    }
    const plainPairs = regular.filter((item) => item.type === PLAY_TYPES.pair);
    if (plainPairs.length > 0) return pickRobotMinPower(plainPairs);
  }
  return pickRobotMinPower(regular);
}

/**
 * 正式对局机器人快路径：百例/一手走完等短路 + principles 同源领出/须压（仅 deadline 裁剪）。
 */
function buildRobotQuickRecommendations(hand, levelRank, previousPlay, tableContext) {
  const mustLead = !previousPlay || previousPlay.type === PLAY_TYPES.pass;
  const yieldCtx = enrichScoringContext(
    { ...tableContext, previousPlay, _candidates: [] },
    [],
    hand,
    levelRank,
  );
  if (!mustLead && yieldCtx.partnerOwnsTrick && shouldRobotYieldPassToPartner({ ...yieldCtx, hand })) {
    return {
      top: {
        candidate: classifyPlay([], levelRank),
        score: 0,
        reasons: ["【P10】队友占牌，机器人过牌让权"],
      },
      pool: [],
      scoringContext: yieldCtx,
      blockedCandidates: [],
    };
  }

  const candidates = generateBasicCandidates(hand, levelRank, previousPlay, {
    lite: true,
    robotFast: true,
    abortCheck: () => isPastDeadline(tableContext),
  });
  if (isPastDeadline(tableContext)) return null;

  const beatCtx = enrichScoringContext(
    { ...tableContext, previousPlay, _candidates: candidates },
    candidates,
    hand,
    levelRank,
  );

  if (!mustLead) {
    const finishing = pickMustBeatFinishingCandidate(candidates, hand, previousPlay, tableContext);
    if (finishing && beatCtx.opponentActive && !beatCtx.partnerOwnsTrick) {
      return {
        top: {
          candidate: finishing,
          score: -900,
          reasons: ["机器人快路径：一手走完"],
        },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: [],
      };
    }
    const c100Single = pickC100MustBeatSingleBeater(hand, levelRank, previousPlay, candidates);
    if (c100Single) {
      return {
        top: { candidate: c100Single, score: -850, reasons: ["机器人快路径：百例顺压单张"] },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: [],
      };
    }
    const c100Cp = pickC100MustBeatConsecutivePairsBeater(
      hand, levelRank, previousPlay, candidates, beatCtx,
    );
    if (c100Cp) {
      return {
        top: { candidate: c100Cp, score: -850, reasons: ["机器人快路径：百例连对管牌"] },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: [],
      };
    }
    const c100Twp = pickC100MustBeatTripleWithPairBeater(
      hand, levelRank, previousPlay, candidates, beatCtx,
    );
    if (c100Twp) {
      return {
        top: { candidate: c100Twp, score: -850, reasons: ["机器人快路径：百例三带二管牌"] },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: [],
      };
    }
    if (previousPlay.type === PLAY_TYPES.tripleWithPair) {
      const minTwp = pickMinStructureSafeTripleWithPairBeater(
        {
          beaters: [],
          structureSafeBeaters: [],
          hasStructureSafeBeater: false,
        },
        levelRank,
        hand,
        { ...beatCtx, lite: true, scoringAudience: "robot" },
      );
      if (minTwp) {
        return {
          top: { candidate: minTwp, score: -800, reasons: ["机器人快路径：结构安全三带二"] },
          pool: [],
          scoringContext: beatCtx,
          blockedCandidates: [],
        };
      }
    }
  } else {
    const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex ?? 0;
    const leadMode = tableContext.state
      ? inferLeadMode(tableContext.state, playerIndex)
      : "fresh-open";
    const openCtx = {
      ...beatCtx,
      isOpening: true,
      leadMode,
      previousPlay: null,
    };
    const c100Open = pickC100OpeningLead(hand, levelRank, candidates, openCtx);
    if (c100Open) {
      return {
        top: { candidate: c100Open, score: -900, reasons: ["机器人快路径：百例首发"] },
        pool: [],
        scoringContext: openCtx,
        blockedCandidates: [],
      };
    }
  }

  if (!mustLead) {
    const picked = pickRobotMustBeatByPrinciples(hand, levelRank, previousPlay, candidates, beatCtx);
    if (picked) {
      return {
        top: { candidate: picked, score: -700, reasons: ["机器人须压：同源原则最小够压"] },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: [],
      };
    }
    let beaters = candidates.filter(
      (item) => item.type !== PLAY_TYPES.pass && canBeat(item, previousPlay),
    ).filter(
      (item) => !breaksBombIntegrity(item, hand, levelRank, beatCtx)
        && !breaksPreferredStrategicGroup(item, [], levelRank, hand, beatCtx),
    );
    if (beatCtx.partnerOwnsTrick) {
      beaters = beaters.filter((item) => !BOMB_TYPES.has(item.type));
    }
    const bombsOnly = beaters.filter((item) => BOMB_TYPES.has(item.type));
    const tempoTypes = new Set([
      PLAY_TYPES.tripleWithPair,
      PLAY_TYPES.consecutivePairs,
      PLAY_TYPES.plane,
      PLAY_TYPES.straight,
    ]);
    if (bombsOnly.length > 0 && !tempoTypes.has(previousPlay.type)) {
      if (shouldYieldPassAfterPartnerLeadOnOpponentBomb(beatCtx, hand, previousPlay)) {
        return {
          top: {
            candidate: classifyPlay([], levelRank),
            score: 0,
            reasons: ["【P10】队友本墩已出牌，不宜叠更大炸"],
          },
          pool: [],
          scoringContext: beatCtx,
          blockedCandidates: [],
        };
      }
      if (hasActionableRegularBeater(candidates, hand, levelRank, beatCtx)) {
        return null;
      }
      if (
        isPressingRoutineNonBomb(previousPlay, beatCtx)
        && shouldReserveBombForHeavyHand(beatCtx, hand.length)
        && (beatCtx.danger ?? 0) < 3
      ) {
        return {
          top: {
            candidate: classifyPlay([], levelRank),
            score: 0,
            reasons: ["【P12】对手普通牌型，手牌仍多不必动炸，过牌等循环"],
          },
          pool: [],
          scoringContext: beatCtx,
          blockedCandidates: [],
        };
      }
      const minBomb = pickRobotMinPower(bombsOnly);
      if (minBomb) {
        return {
          top: { candidate: minBomb, score: -600, reasons: ["机器人快路径：仅炸弹可压"] },
          pool: [],
          scoringContext: beatCtx,
          blockedCandidates: [],
        };
      }
    }
    // P12：组牌型须压且仅炸弹可压时，机器人宜过牌保留牌力
    return {
      top: {
        candidate: classifyPlay([], levelRank),
        score: 0,
        reasons: ["机器人快路径：无常规够压，过牌保留牌力"],
      },
      pool: [],
      scoringContext: beatCtx,
      blockedCandidates: [],
    };
  }

  const leadPick = pickRobotLeadByPrinciples(hand, levelRank, candidates, beatCtx);
  if (leadPick) {
    const groupLead = leadPick.type !== PLAY_TYPES.single;
    const reasons = [groupLead ? "机器人领出：同源原则成组减手" : "机器人领出：同源原则散单试探"];
    if (opponentReportsTwoCards(beatCtx) && leadPick.type === PLAY_TYPES.single) {
      reasons.unshift("【P11】对手报双，宜单牌试探逼拆牌，留王回收");
    } else if (opponentReportsTwoCards(beatCtx) && groupLead) {
      reasons.unshift("【P11】对手报双，不宜出对子放行一手走完");
    }
    return {
      top: {
        candidate: leadPick,
        score: -500,
        reasons,
      },
      pool: [],
      scoringContext: beatCtx,
      blockedCandidates: [],
    };
  }
  return null;
}

function tryRobotQuickRecommendations(hand, levelRank, previousPlay, tableContext) {
  const result = buildRobotQuickRecommendations(hand, levelRank, previousPlay, tableContext);
  if (!result?.top?.candidate) return result;
  const safeTop = filterHardInvariants(
    [result.top.candidate],
    hand,
    levelRank,
    { ...result.scoringContext, ...tableContext, previousPlay, hand },
  );
  if (safeTop.length > 0) return result;

  const mustLead = !previousPlay || previousPlay.type === PLAY_TYPES.pass;
  const safePool = filterHardInvariants(
    generateBasicCandidates(hand, levelRank, previousPlay, { lite: true, emergency: true, robotFast: true }),
    hand,
    levelRank,
    { ...result.scoringContext, ...tableContext, previousPlay, hand },
  ).filter((candidate) => candidate.type !== PLAY_TYPES.pass && (mustLead || canBeat(candidate, previousPlay)));
  const candidate = mustLead
    ? (pickRobotLeadByPrinciples(hand, levelRank, safePool, result.scoringContext ?? tableContext) ?? safePool[0])
    : null;
  return {
    ...result,
    top: {
      candidate: candidate ?? classifyPlay([], levelRank),
      score: 0,
      reasons: [candidate ? "机器人快路径：硬不变量安全领出" : "机器人快路径：硬不变量拦截，过牌"],
    },
    blockedCandidates: [
      ...(result.blockedCandidates ?? []),
      result.top.candidate,
    ],
  };
}

/**
 * 人类 lite 须压快路径：连对/对子/单张等直接取最小够压，跳过全量评分与 buildStrategicGroups。
 */
function tryHumanLiteMustBeatQuick(hand, levelRank, previousPlay, tableContext) {
  if (!previousPlay || previousPlay.type === PLAY_TYPES.pass) return null;
  const yieldCtx = enrichScoringContext(
    { ...tableContext, previousPlay, _candidates: [] },
    [],
    hand,
    levelRank,
  );
  if (yieldCtx.partnerOwnsTrick && shouldYieldPassToPartner({ ...yieldCtx, hand })) {
    return {
      top: {
        candidate: classifyPlay([], levelRank),
        score: 0,
        reasons: [reasonFromPrinciple("P10")],
      },
      pool: [],
      scoringContext: yieldCtx,
      blockedCandidates: [],
    };
  }

  // C100 同花顺可无候选池直建：例64 先于 generateBasicCandidates / P7 炸弹快路径
  if (
    previousPlay.type === PLAY_TYPES.straightFlush
    && yieldCtx.opponentActive
    && !yieldCtx.partnerOwnsTrick
  ) {
    const c100SfEarly = pickC100MustBeatStraightFlushBeater(
      hand,
      levelRank,
      previousPlay,
      generateBasicCandidates(hand, levelRank, previousPlay, { lite: true, maxCandidates: 12 }),
      yieldCtx,
    );
    if (c100SfEarly) {
      return {
        top: { candidate: c100SfEarly, score: -880, reasons: ["【C100-M1】百例同花顺管牌，不宜裸炸"] },
        pool: [],
        scoringContext: yieldCtx,
        blockedCandidates: [],
      };
    }
  }

  // C100 三带二可无候选池直建：须压场景先于 generateBasicCandidates，压冷启耗时
  if (
    previousPlay.type === PLAY_TYPES.tripleWithPair
    && yieldCtx.opponentActive
    && !yieldCtx.partnerOwnsTrick
  ) {
    const c100Twp = pickC100MustBeatTripleWithPairBeater(
      hand,
      levelRank,
      previousPlay,
      [],
      yieldCtx,
    );
    if (c100Twp) {
      return {
        top: { candidate: c100Twp, score: -850, reasons: [reasonFromPrinciple("P4"), "【C100-M1】百例三带二管牌"] },
        pool: [],
        scoringContext: yieldCtx,
        blockedCandidates: [],
      };
    }
  }

  // C100 顺子可无候选池直建：例52/60/71/72 先于 generateBasicCandidates
  if (
    previousPlay.type === PLAY_TYPES.straight
    && yieldCtx.opponentActive
    && !yieldCtx.partnerOwnsTrick
  ) {
    const c100StraightEarly = pickC100MustBeatStraightBeater(
      hand,
      levelRank,
      previousPlay,
      generateBasicCandidates(hand, levelRank, previousPlay, { lite: true, maxCandidates: 12 }),
      yieldCtx,
    );
    if (c100StraightEarly) {
      return {
        top: { candidate: c100StraightEarly, score: -850, reasons: ["【C100-M1】百例杂花顺顺过，不宜动同花顺/炸弹"] },
        pool: [],
        scoringContext: yieldCtx,
        blockedCandidates: [],
      };
    }
  }

  // C100 连对可无候选池直建：例68 先于 generateBasicCandidates（末家负责制，避免 SF 跑道误拦）
  if (
    previousPlay.type === PLAY_TYPES.consecutivePairs
    && yieldCtx.opponentActive
    && !yieldCtx.partnerOwnsTrick
  ) {
    const c100CpEarly = pickC100MustBeatConsecutivePairsBeater(
      hand,
      levelRank,
      previousPlay,
      generateBasicCandidates(hand, levelRank, previousPlay, { lite: true, maxCandidates: 12 }),
      yieldCtx,
    );
    if (c100CpEarly) {
      return {
        top: { candidate: c100CpEarly, score: -850, reasons: ["【C100-M1】百例连对管牌，末家负责制"] },
        pool: [],
        scoringContext: yieldCtx,
        blockedCandidates: [],
      };
    }
  }

  // C100 裸三张可无候选池直建：例58 先于 generateBasicCandidates
  if (
    previousPlay.type === PLAY_TYPES.triple
    && yieldCtx.opponentActive
    && !yieldCtx.partnerOwnsTrick
  ) {
    const c100TripleEarly = pickC100MustBeatTripleBeater(
      hand,
      levelRank,
      previousPlay,
      [],
      yieldCtx,
    );
    if (c100TripleEarly) {
      return {
        top: { candidate: c100TripleEarly, score: -850, reasons: ["【C100-G1】百例裸三张管牌重组"] },
        pool: [],
        scoringContext: yieldCtx,
        blockedCandidates: [],
      };
    }
  }

  const candidates = generateBasicCandidates(hand, levelRank, previousPlay, {
    lite: true,
    abortCheck: () => isPastDeadline(tableContext),
  });
  if (isPastDeadline(tableContext)) return null;

  const beatCtx = enrichScoringContext(
    { ...tableContext, previousPlay, _candidates: candidates },
    candidates,
    hand,
    levelRank,
  );
  if (!beatCtx.opponentActive || beatCtx.partnerOwnsTrick) return null;

  const finishing = pickMustBeatFinishingCandidate(candidates, hand, previousPlay);
  if (finishing) {
    return {
      top: {
        candidate: finishing,
        score: -900,
        reasons: ["能走完先走完"],
      },
      pool: [],
      scoringContext: beatCtx,
      blockedCandidates: [],
    };
  }

  const pickMin = (pool) => pool.slice().sort(
    (left, right) => left.power - right.power || (left.length ?? 0) - (right.length ?? 0),
  )[0] ?? null;

  if (previousPlay.type === PLAY_TYPES.single) {
    const c100 = pickC100MustBeatSingleBeater(hand, levelRank, previousPlay, candidates);
    if (c100) {
      return {
        top: { candidate: c100, score: -850, reasons: [reasonFromPrinciple("P4"), "【C100-G1】百例顺压重组"] },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: [],
      };
    }
    const beaters = candidates.filter(
      (item) => item.type === PLAY_TYPES.single && canBeat(item, previousPlay),
    );
    const reserveStructure = shouldReserveStructureForRoutineBeat(beatCtx, hand, previousPlay, levelRank);
    const preferredGroups = tableContext.preferredGroups ?? [];
    const safeBeaters = reserveStructure
      ? beaters.filter((item) => !isStructureBreakingRoutineBeat(item, hand, levelRank, preferredGroups))
      : beaters;
    const min = pickMin(safeBeaters);
    if (min) {
      return {
        top: { candidate: min, score: -800, reasons: [reasonFromPrinciple("P4")] },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: [],
      };
    }
  }

  if (previousPlay.type === PLAY_TYPES.consecutivePairs) {
    const c100Cp = pickC100MustBeatConsecutivePairsBeater(
      hand, levelRank, previousPlay, candidates, beatCtx,
    );
    if (
      c100Cp
      && !breaksMustBeatRoutineSfRunway(c100Cp, hand, levelRank, previousPlay, beatCtx)
    ) {
      return {
        top: {
          candidate: c100Cp,
          score: -850,
          reasons: ["【C100-O1】百例连对管牌"],
        },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: [],
      };
    }
    const cpBeaters = candidates.filter(
      (item) => item.type === PLAY_TYPES.consecutivePairs && canBeat(item, previousPlay),
    );
    const safeCpBeaters = cpBeaters.filter(
      (item) => !breaksMustBeatRoutineSfRunway(item, hand, levelRank, previousPlay, beatCtx),
    );
    const minCp = pickMin(safeCpBeaters);
    if (minCp) {
      return {
        top: { candidate: minCp, score: -800, reasons: ["连对管牌"] },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: [],
      };
    }
    if (cpBeaters.length > 0) {
      const penalty = mustBeatCpSfRunwayPrinciplesPenalty(cpBeaters[0], hand, levelRank, beatCtx);
      return {
        top: {
          candidate: classifyPlay([], levelRank),
          score: 0,
          reasons: [penalty?.reason ?? reasonFromPrinciple("P1")],
        },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: cpBeaters,
      };
    }
  }

  if (previousPlay.type === PLAY_TYPES.pair) {
    const c100Pair = pickC100MustBeatPairBeater(hand, levelRank, previousPlay, candidates, beatCtx);
    if (c100Pair) {
      return {
        top: { candidate: c100Pair, score: -850, reasons: ["【C100-B1】顺过对5管小对，不宜拆四4/大炸"] },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: [],
      };
    }
    const pairBeaters = candidates.filter(
      (item) => item.type === PLAY_TYPES.pair && canBeat(item, previousPlay),
    );
    const pairABeater = previousPlay.mainRank === "K"
      ? pickMin(pairBeaters.filter((item) => item.mainRank === "A"))
      : null;
    if (pairABeater) {
      return {
        top: { candidate: pairABeater, score: -850, reasons: ["对K须压：散对A管牌"] },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: [],
      };
    }
    const safePairBeaters = pairBeaters.filter(
      (item) => !breaksMustBeatRoutineSfRunway(item, hand, levelRank, previousPlay, beatCtx),
    );
    const minPair = pickMin(safePairBeaters);
    if (minPair) {
      return {
        top: { candidate: minPair, score: -800, reasons: ["整对管牌"] },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: [],
      };
    }
    if (pairBeaters.length > 0) {
      const penalty = mustBeatPairSfRunwayPrinciplesPenalty(pairBeaters[0], hand, levelRank, beatCtx);
      return {
        top: {
          candidate: classifyPlay([], levelRank),
          score: 0,
          reasons: [penalty?.reason ?? reasonFromPrinciple("P1")],
        },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: pairBeaters,
      };
    }
  }

  if (previousPlay.type === PLAY_TYPES.triple) {
    const c100Triple = pickC100MustBeatTripleBeater(
      hand, levelRank, previousPlay, candidates, beatCtx,
    );
    if (c100Triple) {
      return {
        top: { candidate: c100Triple, score: -850, reasons: ["【C100-G1】百例裸三张管牌重组"] },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: [],
      };
    }
    const tripleBeaters = candidates.filter(
      (item) => item.type === PLAY_TYPES.triple && canBeat(item, previousPlay),
    );
    const minTriple = pickMin(tripleBeaters);
    if (minTriple) {
      return {
        top: { candidate: minTriple, score: -800, reasons: ["三张管牌"] },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: [],
      };
    }
  }

  if (previousPlay.type === PLAY_TYPES.tripleWithPair) {
    const c100Twp = pickC100MustBeatTripleWithPairBeater(
      hand, levelRank, previousPlay, candidates, beatCtx,
    );
    if (c100Twp) {
      return {
        top: { candidate: c100Twp, score: -850, reasons: [reasonFromPrinciple("P4"), "【C100-M1】百例三带二管牌"] },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: [],
      };
    }
    const reserveRoutineTwp = shouldPreferPassForHeavyHandRoutineTripleWithPair(
      beatCtx,
      hand,
      previousPlay,
      levelRank,
    );
    if (reserveRoutineTwp) return null;
    const minTwp = pickMinStructureSafeTripleWithPairBeater(
      { beaters: [], structureSafeBeaters: [], hasStructureSafeBeater: false },
      levelRank,
      hand,
      { ...beatCtx, lite: true, scoringAudience: "human-lite" },
    );
    if (minTwp) {
      return {
        top: { candidate: minTwp, score: -800, reasons: [reasonFromPrinciple("P4")] },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: [],
      };
    }
  }

  if (previousPlay.type === PLAY_TYPES.plane) {
    const c100Plane = pickC100MustBeatPlaneBeater(
      hand, levelRank, previousPlay, candidates, beatCtx,
    );
    if (c100Plane) {
      return {
        top: { candidate: c100Plane, score: -850, reasons: ["【C100-M1】百例飞机管牌，拆炸重组同花顺"] },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: [],
      };
    }
  }

  if (previousPlay.type === PLAY_TYPES.straight) {
    const c100Straight = pickC100MustBeatStraightBeater(
      hand, levelRank, previousPlay, candidates, beatCtx,
    );
    if (c100Straight) {
      return {
        top: { candidate: c100Straight, score: -850, reasons: ["【C100-M1】百例杂花顺顺过，不宜动同花顺/炸弹"] },
        pool: [],
        scoringContext: beatCtx,
        blockedCandidates: [],
      };
    }
  }

  return null;
}

/** 单一真相源：人类教练 / 机器人 / 审计共用同一套评分与 Top1 选取 */
export function computeRecommendations(hand, levelRank, previousPlay = null, tableContext = {}) {
  previousPlay = resolvePreviousPlay(previousPlay, tableContext);
  tableContext = { ...tableContext, previousPlay };
  const litePath = tableContext.lite === true
    || tableContext.scoringAudience === "robot"
    || tableContext.scoringAudience === "human-lite";
  const robotFast = tableContext.scoringAudience === "robot";
  if (isPastDeadline(tableContext)) {
    return deadlineFallbackRecommendations(hand, levelRank, previousPlay, tableContext);
  }
  const preferredGroups = resolvePreferredGroups(hand, levelRank, tableContext, litePath);
  const handProfile = tableContext.handProfile !== undefined
    ? tableContext.handProfile
    : (robotFast ? null : evaluateHandProfile(hand, levelRank, { preferredGroups }));
  const ctx = {
    ...tableContext,
    preferredGroups,
    handProfile,
  };
  if (robotFast) {
    const robotQuick = tryRobotQuickRecommendations(hand, levelRank, previousPlay, ctx);
    if (robotQuick) return robotQuick;
  }
  if (!previousPlay || previousPlay.type === PLAY_TYPES.pass) {
    const c100OpenDirect = pickC100OpeningLeadDirect(hand, levelRank);
    if (c100OpenDirect) {
      return {
        top: {
          candidate: c100OpenDirect,
          score: -900,
          reasons: ["【C100-G1】百例首发直建快路径"],
        },
        pool: [],
        scoringContext: { ...ctx, isOpening: true, leadMode: "fresh-open" },
        blockedCandidates: [],
      };
    }
  }
  if ((!previousPlay || previousPlay.type === PLAY_TYPES.pass) && isPureFullBombHand(hand, levelRank)) {
    const bomb = classifyPlay(hand, levelRank);
    if (bomb?.type === PLAY_TYPES.bomb) {
      return {
        top: {
          candidate: bomb,
          score: -9999,
          reasons: ["能走完先走完，满张出炸"],
        },
        pool: [],
        scoringContext: { ...ctx, isFinishingPlay: true },
        blockedCandidates: [],
      };
    }
  }
  if (litePath && !robotFast && previousPlay && previousPlay.type !== PLAY_TYPES.pass) {
    const humanLiteQuick = tryHumanLiteMustBeatQuick(hand, levelRank, previousPlay, ctx);
    if (humanLiteQuick) return humanLiteQuick;
  }
  if (
    previousPlay
    && previousPlay.type === PLAY_TYPES.straightFlush
    && !robotFast
    && hand.length >= 20
  ) {
    const sfCtx = enrichScoringContext(
      { ...ctx, previousPlay, _candidates: [] },
      [],
      hand,
      levelRank,
    );
    const sfPool = generateBasicCandidates(hand, levelRank, previousPlay, {
      lite: true,
      maxCandidates: 12,
    });
    const c100Sf = pickC100MustBeatStraightFlushBeater(
      hand,
      levelRank,
      previousPlay,
      sfPool,
      sfCtx,
    );
    if (c100Sf) {
      return {
        top: {
          candidate: c100Sf,
          score: -880,
          reasons: ["【C100-M1】百例同花顺管牌，不宜裸炸"],
        },
        pool: [],
        scoringContext: sfCtx,
        blockedCandidates: [],
      };
    }
  }
  if (hand.length >= 20 && previousPlay && BOMB_TYPES.has(previousPlay.type)) {
    const fastCandidates = generateBasicCandidates(hand, levelRank, previousPlay, { lite: litePath });
    const bombFastCtx = enrichScoringContext(
      { ...ctx, _candidates: fastCandidates },
      fastCandidates,
      hand,
      levelRank,
    );
    if (
      shouldYieldPassAfterPartnerLeadOnOpponentBomb(bombFastCtx, hand, previousPlay)
      || bombFastCtx.partnerOwnsTrick
    ) {
      return {
        top: {
          candidate: classifyPlay([], levelRank),
          score: 0,
          reasons: [reasonFromPrinciple("P10", bombFastCtx.partnerOwnsTrick ? undefined : { stackBomb: true })],
        },
        pool: [],
        scoringContext: bombFastCtx,
        blockedCandidates: [],
      };
    }
    const fastBomb = pickFastRankBombBeater(hand, levelRank, previousPlay);
    if (fastBomb) {
      return {
        top: {
          candidate: fastBomb,
          score: -700,
          reasons: ["【P7】大手牌须压炸弹快路径：使用最小合法同点炸弹"],
        },
        pool: [],
        scoringContext: ctx,
        blockedCandidates: [],
      };
    }
  }
  if (
    litePath
    && !previousPlay
    && hand.length >= 24
    && (ctx.maxCandidates ?? Infinity) <= 16
  ) {
    const openPool = generateBasicCandidates(hand, levelRank, null, { lite: true });
    const openCtx = enrichScoringContext(
      { ...ctx, isOpening: true, leadMode: "fresh-open", previousPlay: null, _candidates: openPool },
      openPool,
      hand,
      levelRank,
    );
    const c100Open = pickC100OpeningLead(hand, levelRank, openPool, openCtx);
    if (c100Open) {
      return {
        top: {
          candidate: c100Open,
          score: -900,
          reasons: ["【C100-G1】百例首发快路径"],
        },
        pool: [],
        scoringContext: openCtx,
        blockedCandidates: [],
      };
    }
    const naturalPairsByRank = new Map();
    for (const card of hand) {
      if (isWildCard(card, levelRank) || card.rank === "SJ" || card.rank === "BJ") continue;
      const list = naturalPairsByRank.get(card.rank) ?? [];
      list.push(card);
      naturalPairsByRank.set(card.rank, list);
    }
    const fastPair = [...naturalPairsByRank.entries()]
      .filter(([, cards]) => cards.length === 2)
      .filter(([, cards]) => {
        const pair = classifyPlay(cards, levelRank);
        return pair?.type === PLAY_TYPES.pair
          && !breaksBombIntegrity(pair, hand, levelRank, openCtx);
      })
      .sort((left, right) => rankPower(left[0], levelRank) - rankPower(right[0], levelRank))
      .map(([, cards]) => classifyPlay(cards, levelRank))
      .find((play) => play.type === PLAY_TYPES.pair) ?? null;
    if (fastPair) {
      return {
        top: {
          candidate: fastPair,
          score: -500,
          reasons: ["重手开局快路径：优先最小天然散对减手"],
        },
        pool: [],
        scoringContext: ctx,
        blockedCandidates: [],
      };
    }
  }
  if (!previousPlay || previousPlay.type === PLAY_TYPES.pass) {
    const openPool = generateBasicCandidates(hand, levelRank, null, { lite: true });
    const openCtx = enrichScoringContext(
      { ...ctx, isOpening: true, leadMode: "fresh-open", previousPlay: null, _candidates: openPool },
      openPool,
      hand,
      levelRank,
    );
    const c100Open = pickC100OpeningLead(hand, levelRank, openPool, openCtx);
    if (c100Open && !robotFast) {
      return {
        top: {
          candidate: c100Open,
          score: -900,
          reasons: ["【C100-G1】百例首发快路径"],
        },
        pool: [],
        scoringContext: openCtx,
        blockedCandidates: [],
      };
    }
  }
  if (!litePath && hand?.length) {
    ctx._strategicGroupsCache = {
      hand,
      levelRank,
      groups: preferredGroups.length > 0 ? preferredGroups : buildStrategicGroups(hand, levelRank),
    };
  } else if (litePath && hand?.length) {
    ctx._strategicGroupsCache = {
      hand,
      levelRank,
      groups: preferredGroups.length > 0 ? preferredGroups : [],
    };
  }
  let precomputedSafeTripleWithPair = null;
  let precomputedTwpBeatCtx = null;
  if (previousPlay?.type === PLAY_TYPES.tripleWithPair && !robotFast) {
    precomputedTwpBeatCtx = enrichScoringContext(
      { ...ctx, previousPlay, _candidates: [] },
      [],
      hand,
      levelRank,
    );
    // 空候选池：例49 等可直接组 AAA66，避免冷启先枚举再挑
    const c100TwpEarly = pickC100MustBeatTripleWithPairBeater(
      hand,
      levelRank,
      previousPlay,
      [],
      precomputedTwpBeatCtx,
    );
    if (
      c100TwpEarly
      && precomputedTwpBeatCtx.opponentActive
      && !precomputedTwpBeatCtx.partnerOwnsTrick
    ) {
      return {
        top: {
          candidate: c100TwpEarly,
          score: -850,
          reasons: [
            reasonFromPrinciple("P4"),
            "【C100-M1】百例三带二管牌",
          ],
        },
        pool: [],
        scoringContext: precomputedTwpBeatCtx,
        blockedCandidates: [],
      };
    }
    if (litePath) {
    precomputedSafeTripleWithPair = pickMinStructureSafeTripleWithPairBeater(
        {
          beaters: [],
          structureSafeBeaters: [],
          hasStructureSafeBeater: false,
        },
        levelRank,
        hand,
        precomputedTwpBeatCtx,
      );
    // 须压三带二且已有结构安全最小够压 → 跳过全量 generateBasicCandidates
    if (
      precomputedSafeTripleWithPair
      && precomputedTwpBeatCtx.opponentActive
      && !precomputedTwpBeatCtx.partnerOwnsTrick
      && !shouldPreferPassForHeavyHandRoutineTripleWithPair(
        precomputedTwpBeatCtx,
        hand,
        previousPlay,
        levelRank,
      )
    ) {
      return {
        top: {
          candidate: precomputedSafeTripleWithPair,
          score: -800,
          reasons: [
            reasonFromPrinciple("P2"),
            reasonFromPrinciple("P4"),
          ],
        },
        pool: [],
        scoringContext: precomputedTwpBeatCtx,
        blockedCandidates: [],
      };
    }
    }
  }

  if (previousPlay?.type === PLAY_TYPES.straight && !robotFast) {
    const straightBeatCtx = enrichScoringContext(
      { ...ctx, previousPlay, _candidates: [] },
      [],
      hand,
      levelRank,
    );
    const straightPool = generateBasicCandidates(hand, levelRank, previousPlay, { lite: true });
    const c100StraightEarly = pickC100MustBeatStraightBeater(
      hand,
      levelRank,
      previousPlay,
      straightPool,
      straightBeatCtx,
    );
    if (
      c100StraightEarly
      && straightBeatCtx.opponentActive
      && !straightBeatCtx.partnerOwnsTrick
    ) {
      return {
        top: {
          candidate: c100StraightEarly,
          score: -850,
          reasons: ["【C100-M1】百例杂花顺顺过，不宜动同花顺/炸弹"],
        },
        pool: [],
        scoringContext: straightBeatCtx,
        blockedCandidates: [],
      };
    }
  }

  let candidates = generateBasicCandidates(hand, levelRank, previousPlay, {
    lite: litePath,
    robotFast,
    abortCheck: () => isPastDeadline(ctx),
  });
  if (isPastDeadline(ctx) || (candidates.length === 0 && robotFast)) {
    return deadlineFallbackRecommendations(hand, levelRank, previousPlay, ctx);
  }
  if (preferredGroups.length > 0) {
    candidates.push(...candidatesFromPreferredGroups(preferredGroups, levelRank, previousPlay, hand));
  }
  if (previousPlay && previousPlay.type !== PLAY_TYPES.pass) {
    candidates.push(classifyPlay([], levelRank));
  }
  candidates = candidates.filter((candidate) => playUsesOnlyHandCards(hand, candidate));
  if (litePath && previousPlay && previousPlay.type !== PLAY_TYPES.pass && !(robotFast && candidates.length === 0)) {
    candidates = mergeMissingActionableRegularBeaters(candidates, hand, levelRank, previousPlay, ctx);
  }
  candidates = trimCandidatesForScoring(
    candidates,
    ctx.maxCandidates,
    hand,
    levelRank,
    previousPlay,
    ctx,
  );
  candidates = candidates.filter((candidate) => playUsesOnlyHandCards(hand, candidate));
  if (precomputedSafeTripleWithPair) {
    candidates = appendUniqueCandidates(candidates, [precomputedSafeTripleWithPair]);
  }
  if (litePath && previousPlay?.type === PLAY_TYPES.tripleWithPair) {
    const preservedKey = precomputedSafeTripleWithPair
      ? candidatePoolKey(precomputedSafeTripleWithPair)
      : null;
    candidates = candidates.filter((candidate) => (
      candidate.type !== PLAY_TYPES.tripleWithPair
      || candidatePoolKey(candidate) === preservedKey
      || !breaksMustBeatRoutineSfRunway(candidate, hand, levelRank, previousPlay, ctx)
    ));
  }

  if (previousPlay && previousPlay.type !== PLAY_TYPES.pass) {
    const yieldCtx = enrichScoringContext(
      { ...ctx, previousPlay, _candidates: candidates },
      candidates,
      hand,
      levelRank,
    );
    if (yieldCtx.partnerOwnsTrick && (
      robotFast
        ? shouldRobotYieldPassToPartner({ ...yieldCtx, hand })
        : shouldYieldPassToPartner({ ...yieldCtx, hand })
    )) {
      const passPlay = classifyPlay([], levelRank);
      const reasons = robotFast
        ? ["【P10】队友占牌，机器人应过牌让权"]
        : [reasonFromPrinciple("P10")];
      return {
        top: {
          candidate: passPlay,
          score: 0,
          reasons,
        },
        pool: [],
        scoringContext: yieldCtx,
        blockedCandidates: [],
      };
    }
    const finishingBeat = pickMustBeatFinishingCandidate(candidates, hand, previousPlay, yieldCtx);
    if (finishingBeat && yieldCtx.opponentActive && !yieldCtx.partnerOwnsTrick) {
      return {
        top: {
          candidate: finishingBeat,
          score: -1200,
          reasons: [
            finishingBeat.type === PLAY_TYPES.straightFlush
              ? "【P7】同花顺一手走完，队友可接风"
              : "能走完先走完",
          ],
        },
        pool: [],
        scoringContext: yieldCtx,
        blockedCandidates: [],
      };
    }
    // P4：须压对手对子且有整对够压（含散对）→ 人类 lite 直接推最小整对，避免过牌/SF
    if (
      previousPlay.type === PLAY_TYPES.pair
    ) {
      const beatCtx = enrichScoringContext(
        { ...ctx, previousPlay, _candidates: candidates },
        candidates,
        hand,
        levelRank,
      );
      if (
        beatCtx.opponentActive
        && !beatCtx.partnerOwnsTrick
      ) {
        const c100Pair = pickC100MustBeatPairBeater(hand, levelRank, previousPlay, candidates, beatCtx);
        if (c100Pair) {
          return {
            top: { candidate: c100Pair, score: -850, reasons: ["【C100-B1】顺过对5管小对，不宜拆四4/大炸"] },
            pool: [],
            scoringContext: beatCtx,
            blockedCandidates: [],
          };
        }
        const pairCtx = analyzeMustBeatPairContext(hand, levelRank, previousPlay, beatCtx);
        const reserveStructure = shouldReserveStructureForRoutineBeat(beatCtx, hand, previousPlay, levelRank);
        const minPair = pickMinWholePairBeater(pairCtx, { reserveStructure, hand, levelRank, tableContext: beatCtx });
        if (minPair) {
          return {
            top: {
              candidate: minPair,
              score: -800,
              reasons: [
                reasonFromPrinciple("P2"),
                reasonFromPrinciple("P4"),
              ],
            },
            pool: [],
            scoringContext: beatCtx,
            blockedCandidates: [],
          };
        }
        if (pairCtx.hasWholePairBeater && !pairCtx.hasStructureSafeWholePairBeater && !pairCtx.dedicatedPairBeaters?.length) {
          const passPlay = classifyPlay([], levelRank);
          return {
            top: {
              candidate: passPlay,
              score: 0,
              reasons: [reasonFromPrinciple("P1")],
            },
            pool: [],
            scoringContext: beatCtx,
            blockedCandidates: [],
          };
        }
        if (requiresBombForPairBeat(hand, levelRank, previousPlay, beatCtx)) {
          const minBomb = pickMinStructureBombBeater(hand, levelRank, previousPlay, beatCtx);
          if (minBomb) {
            return {
              top: {
                candidate: minBomb,
                score: -700,
                reasons: [
                  reasonFromPrinciple("P2"),
                  reasonFromPrinciple("P4"),
                  reasonFromPrinciple("P7"),
                ],
              },
              pool: [],
              scoringContext: beatCtx,
              blockedCandidates: [],
            };
          }
          const minStraightFlush = candidates
            .filter((candidate) => candidate.type === PLAY_TYPES.straightFlush
              && (candidate.wildcardAssignments?.length ?? 0) <= 1
              && canBeat(candidate, previousPlay))
            .sort((left, right) => left.power - right.power)[0] ?? null;
          if (minStraightFlush) {
            return {
              top: {
                candidate: minStraightFlush,
                score: -650,
                reasons: ["【P7】无普通对子可压，仅同花顺可管时应抢回牌权"],
              },
              pool: [],
              scoringContext: beatCtx,
              blockedCandidates: [],
            };
          }
        }
      }
    }
    if (
      !robotFast
      && (previousPlay.type === PLAY_TYPES.plane
        || previousPlay.type === PLAY_TYPES.straight
        || previousPlay.type === PLAY_TYPES.triple)
    ) {
      const beatCtx = enrichScoringContext(
        { ...ctx, previousPlay, _candidates: candidates },
        candidates,
        hand,
        levelRank,
      );
      if (beatCtx.opponentActive && !beatCtx.partnerOwnsTrick) {
        const c100Triple = previousPlay.type === PLAY_TYPES.triple
          ? pickC100MustBeatTripleBeater(hand, levelRank, previousPlay, candidates, beatCtx)
          : null;
        if (c100Triple) {
          return {
            top: { candidate: c100Triple, score: -850, reasons: ["【C100-G1】百例裸三张管牌重组"] },
            pool: [],
            scoringContext: beatCtx,
            blockedCandidates: [],
          };
        }
        const c100Plane = previousPlay.type === PLAY_TYPES.plane
          ? pickC100MustBeatPlaneBeater(hand, levelRank, previousPlay, candidates, beatCtx)
          : null;
        if (c100Plane) {
          return {
            top: { candidate: c100Plane, score: -850, reasons: ["【C100-M1】百例飞机管牌，拆炸重组同花顺"] },
            pool: [],
            scoringContext: beatCtx,
            blockedCandidates: [],
          };
        }
        const c100Straight = previousPlay.type === PLAY_TYPES.straight
          ? pickC100MustBeatStraightBeater(hand, levelRank, previousPlay, candidates, beatCtx)
          : null;
        if (c100Straight) {
          return {
            top: { candidate: c100Straight, score: -850, reasons: ["【C100-M1】百例杂花顺顺过，不宜动同花顺/炸弹"] },
            pool: [],
            scoringContext: beatCtx,
            blockedCandidates: [],
          };
        }
      }
    }
    // P4：须压对手三带二且有结构安全够压 → 人类 lite 直接推最小三带二，避免过牌/拆同花顺跑道
    if (
      previousPlay.type === PLAY_TYPES.tripleWithPair
      && !robotFast
    ) {
      const beatCtx = enrichScoringContext(
        { ...ctx, previousPlay, _candidates: candidates },
        candidates,
        hand,
        levelRank,
      );
      if (beatCtx.opponentActive && !beatCtx.partnerOwnsTrick) {
        const c100Twp = pickC100MustBeatTripleWithPairBeater(
          hand,
          levelRank,
          previousPlay,
          candidates,
          beatCtx,
        );
        if (c100Twp) {
          return {
            top: {
              candidate: c100Twp,
              score: -850,
              reasons: [
                reasonFromPrinciple("P4"),
                "【C100-M1】百例三带二管牌",
              ],
            },
            pool: [],
            scoringContext: beatCtx,
            blockedCandidates: [],
          };
        }
        const twpCtx = analyzeMustBeatTripleWithPairContext(hand, levelRank, previousPlay, beatCtx);
        const minTwp = pickMinStructureSafeTripleWithPairBeater(twpCtx, levelRank, hand, beatCtx);
        const reserveRoutineTwp = shouldPreferPassForHeavyHandRoutineTripleWithPair(
          beatCtx,
          hand,
          previousPlay,
          levelRank,
        );
        const twpBreaksPremium = minTwp && breaksStrategicPremiumForTripleWithPair(
          minTwp,
          hand,
          levelRank,
          beatCtx.preferredGroups ?? [],
          beatCtx,
        );
        if (minTwp && !twpBreaksPremium && !reserveRoutineTwp && twpCtx.hasStructureSafeBeater) {
          return {
            top: {
              candidate: minTwp,
              score: -800,
              reasons: [
                reasonFromPrinciple("P2"),
                reasonFromPrinciple("P4"),
              ],
            },
            pool: [],
            scoringContext: beatCtx,
            blockedCandidates: [],
          };
        }
      }
    }
    // P4/C100-G1：须压单张百例快路径（例10 过10、例11 顺9），避免全量评分超时
    if (
      previousPlay.type === PLAY_TYPES.single
      && !robotFast
    ) {
      const beatCtx = enrichScoringContext(
        { ...ctx, previousPlay, _candidates: candidates },
        candidates,
        hand,
        levelRank,
      );
      if (beatCtx.opponentActive && !beatCtx.partnerOwnsTrick) {
        const c100Single = pickC100MustBeatSingleBeater(hand, levelRank, previousPlay, candidates);
        if (c100Single) {
          return {
            top: {
              candidate: c100Single,
              score: -750,
              reasons: [
                reasonFromPrinciple("P4"),
                "【C100-G1】百例顺压重组",
              ],
            },
            pool: [],
            scoringContext: beatCtx,
            blockedCandidates: [],
          };
        }
      }
    }
    // P4/C100：须压连对百例快路径（例6/17 末家负责制）
    if (
      previousPlay.type === PLAY_TYPES.consecutivePairs
      && !robotFast
    ) {
      const beatCtx = enrichScoringContext(
        { ...ctx, previousPlay, _candidates: candidates },
        candidates,
        hand,
        levelRank,
      );
      if (beatCtx.opponentActive && !beatCtx.partnerOwnsTrick) {
        const c100Cp = pickC100MustBeatConsecutivePairsBeater(
          hand,
          levelRank,
          previousPlay,
          candidates,
          beatCtx,
        );
        if (c100Cp) {
          return {
            top: {
              candidate: c100Cp,
              score: -850,
              reasons: [
                reasonFromPrinciple("P4"),
                "【C100-O1】百例连对管牌",
              ],
            },
            pool: [],
            scoringContext: beatCtx,
            blockedCandidates: [],
          };
        }
      }
    }
  }

  const scoringContext = {
    ...enrichScoringContext({ ...ctx, previousPlay }, candidates, hand, levelRank),
    _candidates: candidates,
    hasAnyWinner: candidates.some((c) => c.type !== PLAY_TYPES.pass),
    hasRegularWinner: candidates.some((c) => c.type !== PLAY_TYPES.pass && !BOMB_TYPES.has(c.type)),
  };
  scoringContext.hasActionableRegularWinner = litePath
    ? hasActionableRegularBeater(candidates, hand, levelRank, scoringContext)
    : resolveActionableRegularWinner(hand, levelRank, previousPlay, scoringContext);
  scoringContext.bombInventory = evaluateBombInventory(hand, levelRank);

  if (candidates.length === 0) {
    if (isPastDeadline(ctx)) {
      return deadlineFallbackRecommendations(hand, levelRank, previousPlay, ctx);
    }
    return {
      top: {
        candidate: classifyPlay([], levelRank),
        score: 0,
        reasons: ["没有合法出牌"],
      },
      pool: [],
      scoringContext: ctx,
      blockedCandidates: [],
    };
  }

  if (previousPlay?.type === PLAY_TYPES.single) {
    scoringContext._mustBeatSingleCtx = analyzeMustBeatSingleContext(
      hand,
      levelRank,
      previousPlay,
      { ...scoringContext, _candidates: candidates },
    );
  }

  const scored = [];
  const c100CpBeat = previousPlay?.type === PLAY_TYPES.consecutivePairs
    ? pickC100MustBeatConsecutivePairsBeater(hand, levelRank, previousPlay, candidates, scoringContext)
    : null;
  const c100CpBeatKey = c100CpBeat ? candidatePoolKey(c100CpBeat) : null;
  const robotScoreCap = robotFast
    ? Math.min(candidates.length, ctx.maxCandidates ?? 6, 3)
    : candidates.length;
  for (let ci = 0; ci < candidates.length; ci += 1) {
    if (robotFast && scored.length >= robotScoreCap) break;
    const candidate = candidates[ci];
    if (isPastDeadline(ctx)) break;
    if (breaksMustBeatRoutineSfRunway(candidate, hand, levelRank, previousPlay, scoringContext)) continue;
    const item = scoreCandidate(candidate, hand, levelRank, previousPlay, scoringContext);
    if (isPastDeadline(ctx)) break;
    const l1LooseSingle = isL1LooseSingleOpening(item.candidate, hand, levelRank, scoringContext);
    const p6ProbeSingle = isP6BigJokerProbeSingleOpening(item.candidate, hand, levelRank, scoringContext);
    const groupReductionAfterBomb = isCatchWindGroupReductionAfterBomb(item.candidate, scoringContext)
      || isCatchWindPremiumReduction(item.candidate, scoringContext);
    const exactTripleLead = isExactTripleWithPairLead(item.candidate, hand, levelRank, scoringContext);
    const prematureConsecutivePairsLead = isPrematureConsecutivePairsLead(
      item.candidate,
      hand,
      levelRank,
      scoringContext,
    );
    const mustBeatPremiumRegular = allowMustBeatPremiumBlockedRegular(
      item.candidate,
      hand,
      levelRank,
      previousPlay,
      scoringContext,
    );
    if (isMandatoryBombCandidate(item.candidate, hand, levelRank, scoringContext, previousPlay)
      || allowMustBeatPremiumLooseSingle(item.candidate, hand, levelRank, previousPlay, scoringContext, preferredGroups)
      || l1LooseSingle
      || p6ProbeSingle
      || groupReductionAfterBomb
      || exactTripleLead
      || prematureConsecutivePairsLead
      || mustBeatPremiumRegular
      || !breaksPremiumStraightOrJokerGroup(item.candidate, preferredGroups, levelRank)) {
      if (isMandatoryBombCandidate(item.candidate, hand, levelRank, scoringContext, previousPlay)
        || allowMustBeatPremiumLooseSingle(item.candidate, hand, levelRank, previousPlay, scoringContext, preferredGroups)
        || l1LooseSingle
        || groupReductionAfterBomb
        || exactTripleLead
        || prematureConsecutivePairsLead
        || mustBeatPremiumRegular
        || !breaksCriticalPreferredGroup(item.candidate, preferredGroups, levelRank, hand)) {
        const finishing = item.candidate.cards?.length === hand.length;
        const allowBombBreakForC100Cp = c100CpBeatKey
          && candidatePoolKey(item.candidate) === c100CpBeatKey;
        if (finishing || !breaksBombIntegrity(item.candidate, hand, levelRank, scoringContext)
          || allowBombBreakForC100Cp) {
          scored.push(item);
        }
      }
    }
  }

  let pool = scored.length > 0
    ? scored
    : isPastDeadline(ctx)
      ? []
      : (() => {
        const fallbackScored = [];
        const cap = litePath ? 4 : candidates.length;
        for (let i = 0; i < Math.min(candidates.length, cap); i += 1) {
          if (isPastDeadline(ctx)) break;
          fallbackScored.push(
            scoreCandidate(candidates[i], hand, levelRank, previousPlay, scoringContext),
          );
        }
        return fallbackScored;
      })();

  if (isPastDeadline(ctx)) {
    return deadlineFallbackRecommendations(hand, levelRank, previousPlay, ctx);
  }

  const state = ctx.state;
  const playerIndex = ctx.playerIndex ?? state?.currentPlayerIndex;

  const preEnforce = robotFast
    ? { candidates: pool, blockedCandidates: [] }
    : enforceDoctrineOnCandidates(pool, {
    ...scoringContext,
    hand,
    levelRank,
    playerIndex,
  });
  pool = preEnforce.candidates;

  const fusionMode = resolveMlFusionMode(ctx.mlFusionMode);
  const mlModel = fusionMode === "off"
    ? null
    : (ctx.mlModel !== undefined
      ? resolveMlModel(ctx.mlModel)
      : (isMlPolicyEnabled() ? loadMlPolicy() : null));
  if (mlModel && state && playerIndex != null) {
    const rowContext = buildRowContextFromTable(
      state,
      playerIndex,
      previousPlay,
      handProfile,
    );
    pool = rankCandidatesWithMl(mlModel, rowContext, pool, {
      fusionMode,
      tableContext: scoringContext,
      candidateBlend: candidateMlBlendWeight,
    });
  } else {
    pool.sort((left, right) => left.score - right.score);
  }

  pool = demotePlateBreakingTriplesOnOpening(
    pool,
    hand,
    levelRank,
    scoringContext,
  );

  if (isPastDeadline(ctx)) {
    return deadlineFallbackRecommendations(hand, levelRank, previousPlay, ctx);
  }

  const postEnforce = robotFast
    ? { candidates: pool, blockedCandidates: [] }
    : enforceDoctrineOnCandidates(pool, {
      ...scoringContext,
      hand,
      levelRank,
      playerIndex,
    });
  pool = postEnforce.candidates;

  const scoredPool = [...pool, ...(postEnforce.blockedCandidates ?? [])];
  const alignScoredItem = (item) => {
    if (!item?.candidate) return item;
    return {
      ...item,
      reasons: alignReasonsForPlay(item.reasons, item.candidate, { previousPlay }),
    };
  };
  const openingLike = scoringContext.isOpening
    && (scoringContext.leadMode === "fresh-open" || scoringContext.leadMode === "catch-wind");
  const smallJokerStraightFlush = previousPlay?.type === PLAY_TYPES.single
    && previousPlay.mainRank === "SJ"
    ? candidates
      .filter((candidate) => candidate.type === PLAY_TYPES.straightFlush
        && (candidate.wildcardAssignments?.length ?? 0) <= 1
        && canBeat(candidate, previousPlay))
      .map((candidate) => scoreCandidate(candidate, hand, levelRank, previousPlay, scoringContext))
      .sort((left, right) => left.score - right.score)[0] ?? null
    : null;
  let top = smallJokerStraightFlush
    ?? pickCompliantTopRecommendation(scoredPool, hand, scoringContext, levelRank);
  const pickUnblocked = (items) => items.find(
    (item) => !item.doctrineBlockedTop1
      && isMustBeatLegalItem(item, previousPlay)
      && isDisplayablePoolItem(item, scoringContext),
  ) ?? null;
  if (!top || top.doctrineBlockedTop1) {
    top = pickUnblocked(scoredPool);
  }
  if (!top || top.doctrineBlockedTop1) {
    top = pickUnblocked(pool);
  }
  if (top) {
    top = alignScoredItem(top);
    if (openingLike && isWildLowValueBeat(top.candidate, levelRank)) {
      const alt = pickUnblocked(scoredPool.filter(
        (item) => item.candidate && !isWildLowValueBeat(item.candidate, levelRank),
      )) ?? (() => {
        for (const candidate of candidates) {
          if (candidate.type === PLAY_TYPES.pass) continue;
          if (isWildLowValueBeat(candidate, levelRank)) continue;
          if (detectDoctrineViolations(candidate, hand, levelRank, scoringContext).some((v) => v.blockTop1)) {
            continue;
          }
          return scoreCandidate(candidate, hand, levelRank, previousPlay, scoringContext);
        }
        return null;
      })();
      if (alt) top = alignScoredItem(alt);
    }
    if (mlModel) {
      const fusionNote = fusionReasonSuffix(scoringContext, fusionMode);
      top.reasons = [
        ...top.reasons,
        fusionNote ?? "已融合 ML 策略模型（policy-v001）",
      ];
    }
    top.doctrineViolations = top.doctrineViolations ?? [];
  }
  if (!top) {
    const legalFallback = pool.find(
      (item) => isMustBeatLegalItem(item, previousPlay) && !item.doctrineBlockedTop1,
    ) ?? pool.find((item) => !item.doctrineBlockedTop1);
    top = alignScoredItem(legalFallback ?? pool[0] ?? {
      candidate: classifyPlay([], levelRank),
      score: 0,
      reasons: ["没有合法出牌"],
    });
  }
  assertMustBeatTop1(top, previousPlay);
  const displayablePool = scoredPool
    .filter((item) => isDisplayablePoolItem(item, scoringContext));
  return {
    top,
    pool: displayablePool.map(alignScoredItem),
    scoringContext,
    blockedCandidates: (postEnforce.blockedCandidates ?? []).map(alignScoredItem),
  };
}

export function recommendPlay(hand, levelRank, previousPlay = null, tableContext = {}) {
  const { top } = computeRecommendations(hand, levelRank, previousPlay, tableContext);
  return top ?? {
    candidate: classifyPlay([], levelRank),
    score: 0,
    reasons: ["没有合法出牌"],
  };
}
