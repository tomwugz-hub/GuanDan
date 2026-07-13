/**
 * 教纲执法层（Doctrine Enforcement）— 违反 P1/P4/P5/P7/P9 的候选硬否决或巨罚，ML 无法抬回 Top1。
 */
import { isWildCard } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { canBeat } from "../engine/compare-play.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { rankPower } from "../engine/rank-order.mjs";
import {
  analyzeMustBeatPairContext,
  analyzeMustBeatSingleContext,
  diagnoseBeatPairViolation,
  diagnoseBeatSingleViolation,
  diagnoseBeatRoutineStructureViolation,
  diagnoseCatchWindStraightTripleViolation,
  effectiveBeatSingleTier,
  diagnoseInferiorWrapStraightViolation,
  diagnoseLeadConsecutivePairsTripleViolation,
  diagnosePrematureTripleWithPairLead,
  diagnoseLeadTripleBreaksStraightViolation,
  getRankStructureTier,
  looseLeadSingleRanks,
  isThickBombSingleLead,
  isFollowingOpponentSingle,
  resolveStraightBreakForSingle,
  prefersFullBombForControl,
  isSplitBombPlay,
  isThickRankBombPlay,
  hasStandalonePureBombBeater,
  shouldYieldPassAfterPartnerLeadOnOpponentBomb,
  shouldReserveStraightFlushForSmallCards,
  isStraightFlushWasteOnSmallRoutine,
  shouldReserveWildForSmallRoutineBeat,
  hasNaturalRegularBeater,
  isForbiddenBombRescueItem,
  shouldVetoBombOnlyPass,
  shouldVetoPassWithRegularBeater,
  isPressingRoutineNonBomb,
  breaksPremiumStraightOrJokerGroup,
  breaksPreferredStrategicGroup,
  shouldReserveBombForHighProbeSingle,
  solePairForTripleRank,
} from "./principles.mjs";
import {
  analyzeRankAvailability,
  breaksBombIntegrity,
  breaksStrategicPremiumForRoutineBeat,
  breaksStrategicPremiumForConsecutivePairs,
  breaksStrategicPremiumForPair,
  breaksStrategicPremiumForStraight,
  breaksStrategicPremiumForTriple,
  breaksStrategicStraightFlush,
  structureAwareBombs,
} from "./scorers/structure.mjs";
import { buildStrategicGroups } from "./strategic-groups.mjs";
import { leadSfRunwayDoctrineViolation, mustBeatCpSfRunwayDoctrineViolation, mustBeatTwpSfRunwayDoctrineViolation } from "./sf-runway-guard.mjs";
import {
  CATCH_WIND_RUNWAY_HAND_MAX,
  inferLeadMode,
  isCatchWindGroupReductionAfterBomb,
  isCatchWindPremiumReduction,
  playerJustWonTrickWithBomb,
  playerJustWonTrickWithGroupPlay,
} from "./lead-mode.mjs";
import { looseSmallSingleRanks } from "./scorers/tempo-lead.mjs";
import { partnerHandCount, shouldYieldPassToPartner } from "./table-context.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

/** 逢人配低价值配牌型（与 audit wild-low-value 一致） */
const LOW_WILD_SHAPE_TYPES = new Set([
  PLAY_TYPES.tripleWithPair,
  PLAY_TYPES.pair,
  PLAY_TYPES.triple,
  PLAY_TYPES.plane,
]);

/** 执法巨罚：确保 ML 融合（~8500 权重）无法把违规候选抬到 Top1 */
export const DOCTRINE_HARD_PENALTY = 50_000;

function physicalRankCount(hand, rank) {
  return hand.filter((card) => card.rank === rank && card.rank !== "SJ" && card.rank !== "BJ").length;
}

function cardKey(card) {
  return `${card.rank}:${card.suit}:${card.deckIndex}`;
}

function matchesPreferredGroup(candidate, tableContext) {
  if (!candidate?.cards?.length) return false;
  const candidateKeys = new Set(candidate.cards.map(cardKey));
  for (const group of tableContext.preferredGroups ?? []) {
    const play = group.play;
    const cards = group.cards ?? [];
    if (!play || play.type !== candidate.type || cards.length !== candidate.cards.length) continue;
    const groupKeys = cards.map(cardKey);
    if (groupKeys.every((key) => candidateKeys.has(key))) return true;
  }
  return false;
}

function usesWildInCandidate(candidate, levelRank) {
  return wildcardFillCount(candidate, levelRank) > 0;
}

/** 逢人配补缺口张数（不含级牌红桃与同点炸弹一体） */
function wildcardFillCount(candidate, levelRank) {
  if ((candidate.wildcardAssignments ?? []).length > 0) {
    return candidate.wildcardAssignments.length;
  }
  return candidate.cards?.filter((card) => {
    if (!isWildCard(card, levelRank)) return false;
    if (card.rank === candidate.mainRank) return false;
    return true;
  }).length ?? 0;
}

function handHasSteelPlate(hand, levelRank) {
  return buildStrategicGroups(hand, levelRank).some(
    (group) => group.play?.type === PLAY_TYPES.plane || group.label?.startsWith("钢板"),
  );
}

function bombSizeOf(item) {
  return item.bombSize ?? item.cards?.length ?? 4;
}

/** 接风跑道：>=5 张无逢人配的顺子/同花顺（候选池或理牌列） */
function hasCatchWindRunwayCandidate(levelRank, tableContext) {
  const isRunway = (item, cards) => {
    if (![PLAY_TYPES.straight, PLAY_TYPES.straightFlush].includes(item.type)) return false;
    const len = item.length ?? cards?.length ?? 0;
    if (len < 5) return false;
    return !(cards ?? item.cards ?? []).some((card) => isWildCard(card, levelRank));
  };

  if ((tableContext._candidates ?? []).some((item) => isRunway(item, item.cards))) {
    return true;
  }

  for (const group of tableContext.preferredGroups ?? []) {
    const cards = group.cards ?? group;
    if (!Array.isArray(cards) || cards.length < 5) continue;
    const play = group.play ?? classifyPlay(cards, levelRank);
    if (isRunway(play, play.cards ?? cards)) return true;
  }
  return false;
}

function isLeadTurn(tableContext) {
  return tableContext.isOpening && tableContext.leadMode !== "must-beat";
}

function strategicGroupsCached(hand, levelRank, tableContext = null) {
  if (!hand?.length) return [];
  if (tableContext?._strategicGroupsCache?.hand === hand
    && tableContext._strategicGroupsCache.levelRank === levelRank) {
    return tableContext._strategicGroupsCache.groups ?? [];
  }
  const groups = buildStrategicGroups(hand, levelRank);
  if (tableContext) {
    tableContext._strategicGroupsCache = { hand, levelRank, groups };
  }
  return groups;
}

function doctrinePastDeadline(context) {
  if (context?.deadline != null && performance.now() > context.deadline) return true;
  if (typeof context?.abortCheck === "function" && context.abortCheck()) return true;
  return false;
}

/**
 * 检测单候选违反了哪些教纲。
 * @returns {Array<{ code: string, summary: string, blockTop1: boolean, blockTop3: boolean }>}
 */
export function detectDoctrineViolations(candidate, hand, levelRank, tableContext) {
  if (!candidate) return [];
  const resolvedHand = (hand?.length ? hand : (tableContext.hand ?? []))
    .filter((card) => card?.rank);
  const previousPlay = tableContext.previousPlay ?? null;

  if (candidate.type === PLAY_TYPES.pass) {
    if (
      isLeadTurn(tableContext)
      && tableContext.hasAnyWinner !== false
    ) {
      return [{
        code: "P0",
        summary: "拥有牌权须主动出牌，不可过牌",
        blockTop1: true,
        blockTop3: true,
      }];
    }
    if (shouldVetoBombOnlyPass(tableContext, resolvedHand, previousPlay)) {
      return [{
        code: "P7",
        summary: "只有炸弹能压，不宜过牌",
        blockTop1: true,
        blockTop3: true,
      }];
    }
    if (shouldVetoPassWithRegularBeater(tableContext, resolvedHand, previousPlay, levelRank)) {
      return [{
        code: "P1",
        summary: "有普通牌可压，不宜过牌",
        blockTop1: true,
        blockTop3: true,
      }];
    }
    return [];
  }

  if (candidate.type === PLAY_TYPES.single && !candidate.mainRank) return [];

  const violations = [];

  // —— P1/P4：跟牌压单，有散单却拆对/拆钢板/拆结构 ——
  const beatSingleDiag = diagnoseBeatSingleViolation(candidate, resolvedHand, levelRank, tableContext);
  if (beatSingleDiag?.violated) {
    violations.push({
      code: beatSingleDiag.violated,
      summary: beatSingleDiag.violated === "P4"
        ? "有散单够压，不宜拆钢板/炸弹"
        : beatSingleDiag.tier === "straightFlush"
          ? "残局仅王+同花顺，不宜拆同花顺出单"
          : beatSingleDiag.tier === "straight"
            ? "有散单够压，不宜拆顺子"
            : "有散单够压，不宜拆对或更大结构",
      blockTop1: true,
      blockTop3: beatSingleDiag.tier === "plate",
    });
  }

  const beatPairDiag = diagnoseBeatPairViolation(candidate, resolvedHand, levelRank, tableContext);
  if (beatPairDiag?.violated) {
    violations.push({
      code: beatPairDiag.violated,
      summary: beatPairDiag.violated === "P4"
        ? `${beatPairDiag.summary}，不宜拆对压牌`
        : beatPairDiag.tier === "plate"
          ? "有整对够压，不宜拆钢板组对"
          : "有整对够压，不宜拆三同张组对",
      blockTop1: true,
      blockTop3: beatPairDiag.violated === "P4",
    });
  }

  const beatRoutineStructDiag = diagnoseBeatRoutineStructureViolation(
    candidate,
    resolvedHand,
    levelRank,
    tableContext,
  );
  if (beatRoutineStructDiag?.violated) {
    violations.push({
      code: beatRoutineStructDiag.violated,
      summary: beatRoutineStructDiag.summary,
      blockTop1: true,
      blockTop3: true,
    });
  }

  const mustBeatCpSfDiag = mustBeatCpSfRunwayDoctrineViolation(
    candidate,
    resolvedHand,
    levelRank,
    tableContext,
  );
  if (mustBeatCpSfDiag) {
    violations.push(mustBeatCpSfDiag);
  }

  const mustBeatTwpSfDiag = mustBeatTwpSfRunwayDoctrineViolation(
    candidate,
    resolvedHand,
    levelRank,
    tableContext,
  );
  if (mustBeatTwpSfDiag) {
    violations.push(mustBeatTwpSfDiag);
  }

  // —— P4：须压钢板拆同花顺，有同花顺可压（含逢人配凑钢板） ——
  if (
    tableContext.opponentActive
    && previousPlay?.type === PLAY_TYPES.plane
    && candidate.type === PLAY_TYPES.plane
    && canBeat(candidate, previousPlay)
  ) {
    const premiumBreak = breaksStrategicPremiumForRoutineBeat(candidate, resolvedHand, levelRank);
    if (premiumBreak?.includes("同花顺")) {
      const sfBeater = (tableContext._candidates ?? []).some(
        (item) => item.type === PLAY_TYPES.straightFlush && canBeat(item, previousPlay),
      );
      if (sfBeater) {
        violations.push({
          code: "P4",
          summary: `有同花顺可压，不宜拆${premiumBreak}组钢板`,
          blockTop1: true,
          blockTop3: true,
        });
      }
    }
  }

  // —— P7 延伸：须压钢板有普通炸弹可压，不宜亮同花顺 ——
  if (
    tableContext.opponentActive
    && previousPlay?.type === PLAY_TYPES.plane
    && candidate.type === PLAY_TYPES.straightFlush
    && canBeat(candidate, previousPlay)
  ) {
    const plainBombs = (tableContext._candidates ?? []).filter(
      (item) => item.type === PLAY_TYPES.bomb
        && canBeat(item, previousPlay)
        && !breaksStrategicStraightFlush(item, resolvedHand, levelRank),
    );
    if (plainBombs.length > 0) {
      violations.push({
        code: "P7",
        summary: "有普通炸弹可压钢板，不宜亮同花顺",
        blockTop1: true,
        blockTop3: true,
      });
    }
  }

  // —— P1：领出/接风小单拆顺子（有顺子或更小不拆顺散单可走） ——
  if (isLeadTurn(tableContext) && candidate.type === PLAY_TYPES.single && candidate.mainRank) {
    const looseSmalls = looseSmallSingleRanks(resolvedHand, levelRank);
    const l1LooseSingle = tableContext.handProfile?.role === "main-attack"
      && (tableContext.handProfile?.looseSingles ?? 0) >= 2
      && looseSmalls.length >= 2
      && looseSmalls.includes(candidate.mainRank);
    if (!l1LooseSingle) {
      const straightBreak = resolveStraightBreakForSingle(candidate.mainRank, resolvedHand, levelRank);
      if (straightBreak.breaksStraight) {
        const altCandidates = tableContext._candidates ?? [];
        const hasStraightAlt = altCandidates.some((item) => item.type === PLAY_TYPES.straight);
        const hasNonBreakingSingle = altCandidates.some(
          (item) => item.type === PLAY_TYPES.single
            && item.mainRank
            && item.mainRank !== candidate.mainRank
            && !resolveStraightBreakForSingle(item.mainRank, resolvedHand, levelRank).breaksStraight,
        );
        const hasGroupAlt = strategicGroupsCached(resolvedHand, levelRank, tableContext).some(
          (group) => group.play?.type === PLAY_TYPES.straight
            || group.play?.type === PLAY_TYPES.plane
            || group.play?.type === PLAY_TYPES.consecutivePairs,
        );
        if (hasStraightAlt || hasNonBreakingSingle || hasGroupAlt) {
          violations.push({
            code: "P1",
            summary: `领出/接风有${straightBreak.straightLabel ?? "顺子"}，不宜拆顺出单${candidate.mainRank}`,
            blockTop1: true,
            blockTop3: true,
          });
        }
      }
    }
    const preferredGroups = tableContext.preferredGroups ?? [];
    if (
      breaksPreferredStrategicGroup(candidate, preferredGroups, levelRank, resolvedHand)
      && !resolveStraightBreakForSingle(candidate.mainRank, resolvedHand, levelRank).breaksStraight
    ) {
      const altCandidates = tableContext._candidates ?? [];
      const hasGroupLead = altCandidates.some(
        (item) => item.type !== PLAY_TYPES.pass
          && item.type !== PLAY_TYPES.single
          && !breaksPreferredStrategicGroup(item, preferredGroups, levelRank, resolvedHand),
      );
      const hasSafeSingle = altCandidates.some(
        (item) => item.type === PLAY_TYPES.single
          && item.mainRank
          && !breaksPreferredStrategicGroup(item, preferredGroups, levelRank, resolvedHand)
          && !resolveStraightBreakForSingle(item.mainRank, resolvedHand, levelRank).breaksStraight,
      );
      if (hasGroupLead || hasSafeSingle) {
        violations.push({
          code: "P1",
          summary: `领出/接风有成组结构，不宜拆连对/钢板/炸弹出单${candidate.mainRank}`,
          blockTop1: true,
          blockTop3: true,
        });
      }
    }
    // 厚炸（五张及以上）不宜拆出单张领出
    if (isThickBombSingleLead(candidate, resolvedHand)) {
      const altCandidates = tableContext._candidates ?? [];
      const looseRanks = looseLeadSingleRanks(resolvedHand, levelRank);
      const hasSafeSingle = altCandidates.some(
        (item) => item.type === PLAY_TYPES.single
          && item.mainRank
          && (looseRanks.includes(item.mainRank)
            || !isThickBombSingleLead(item, resolvedHand)),
      );
      const hasGroupLead = altCandidates.some(
        (item) => item.type === PLAY_TYPES.pair
          || item.type === PLAY_TYPES.tripleWithPair
          || item.type === PLAY_TYPES.triple
          || item.type === PLAY_TYPES.consecutivePairs
          || item.type === PLAY_TYPES.plane
          || item.type === PLAY_TYPES.straight,
      );
      if (hasSafeSingle || hasGroupLead) {
        const held = resolvedHand.filter(
          (card) => card.rank === candidate.mainRank && card.rank !== "SJ" && card.rank !== "BJ",
        ).length;
        violations.push({
          code: "P1",
          summary: `领出/接风有散单或成组结构，不宜拆${held}张${candidate.mainRank}炸弹出单`,
          blockTop1: true,
          blockTop3: true,
        });
      }
    }
  }

  const leadStraightBreakDiag = diagnoseLeadTripleBreaksStraightViolation(
    candidate,
    resolvedHand,
    levelRank,
    tableContext,
  );
  if (leadStraightBreakDiag?.violated) {
    violations.push({
      code: leadStraightBreakDiag.violated,
      summary: leadStraightBreakDiag.summary,
      blockTop1: true,
      blockTop3: leadStraightBreakDiag.blockTop3 ?? true,
    });
  }

  const wrapStraightDiag = diagnoseInferiorWrapStraightViolation(
    candidate,
    resolvedHand,
    levelRank,
    tableContext,
  );
  if (wrapStraightDiag?.violated) {
    violations.push({
      code: wrapStraightDiag.violated,
      summary: wrapStraightDiag.summary,
      blockTop1: true,
      blockTop3: wrapStraightDiag.blockTop3 ?? true,
    });
  }

  const catchWindStraightDiag = diagnoseCatchWindStraightTripleViolation(
    candidate,
    resolvedHand,
    levelRank,
    tableContext,
  );
  if (catchWindStraightDiag?.violated && !violations.some((v) => v.summary === catchWindStraightDiag.summary)) {
    violations.push({
      code: catchWindStraightDiag.violated,
      summary: catchWindStraightDiag.summary,
      blockTop1: true,
      blockTop3: catchWindStraightDiag.blockTop3 ?? false,
    });
  }

  const leadConsecutivePairsDiag = diagnoseLeadConsecutivePairsTripleViolation(
    candidate,
    resolvedHand,
    levelRank,
    tableContext,
  );
  if (leadConsecutivePairsDiag?.violated) {
    violations.push({
      code: leadConsecutivePairsDiag.violated,
      summary: leadConsecutivePairsDiag.summary,
      blockTop1: true,
      blockTop3: leadConsecutivePairsDiag.blockTop3 ?? true,
    });
  }

  // —— P4：领出/接风拆同花顺跑道（杂顺/连对/裸三张/对子/三带二/钢板 统一） ——
  const catchWindBombReduction = isCatchWindGroupReductionAfterBomb(candidate, tableContext);
  const sfRunwayViolation = leadSfRunwayDoctrineViolation(
    candidate,
    resolvedHand,
    levelRank,
    tableContext,
  );
  if (sfRunwayViolation && !catchWindBombReduction) {
    violations.push(sfRunwayViolation);
  }

  const prematureTwpDiag = diagnosePrematureTripleWithPairLead(
    candidate,
    resolvedHand,
    levelRank,
    tableContext,
  );
  if (prematureTwpDiag?.violated && !catchWindBombReduction) {
    violations.push({
      code: prematureTwpDiag.violated,
      summary: prematureTwpDiag.summary,
      blockTop1: true,
      blockTop3: prematureTwpDiag.blockTop3 ?? false,
    });
  }

  // —— P4：跟牌压单却用三带二拆钢板 ——
  if (
    isFollowingOpponentSingle(previousPlay, levelRank, tableContext)
    && candidate.type === PLAY_TYPES.tripleWithPair
    && resolvedHand.length > 0
  ) {
    const tripleAnalysis = analyzeRankAvailability(resolvedHand, candidate.mainRank, levelRank);
    const lockedInPlate = (tripleAnalysis.lockedEntries ?? []).some((entry) => entry.structure === "钢板");
    if (lockedInPlate && !violations.some((v) => v.code === "P4")) {
      violations.push({
        code: "P4",
        summary: "压单不宜三带二拆钢板",
        blockTop1: true,
        blockTop3: true,
      });
    }
  }

  // —— P5：接风/领出有钢板，不宜裸三张/三带二拆钢板 ——
  if (isLeadTurn(tableContext) && resolvedHand.length >= 10) {
    const steelPlate = handHasSteelPlate(resolvedHand, levelRank);
    if (
      steelPlate
      && (candidate.type === PLAY_TYPES.tripleWithPair || candidate.type === PLAY_TYPES.triple)
    ) {
      const tripleAnalysis = analyzeRankAvailability(resolvedHand, candidate.mainRank, levelRank);
      const lockedInPlate = (tripleAnalysis.lockedEntries ?? []).some((e) => e.structure === "钢板");
      if (lockedInPlate) {
        violations.push({
          code: "P5",
          summary: candidate.type === PLAY_TYPES.triple
            ? "领出/接风有钢板，不宜裸三张拆钢板"
            : "接风/领出有钢板，不宜三带二拆钢板",
          blockTop1: true,
          blockTop3: true,
        });
      }
    }
  }

  if (
    BOMB_TYPES.has(candidate.type)
    && previousPlay
    && tableContext.hasActionableRegularWinner
    && !tableContext.isFinishingPlay
    && (
      previousPlay.type === PLAY_TYPES.single
      || isPressingRoutineNonBomb(previousPlay, tableContext)
    )
  ) {
    violations.push({
      code: "P4",
      summary: "有普通牌能压住，不宜动炸",
      blockTop1: true,
      blockTop3: true,
    });
  }

  // —— P7：有纯四炸够压，仍用逢人配凑更大炸 ——
  if (
    candidate.type === PLAY_TYPES.straightFlush
    && previousPlay?.type === PLAY_TYPES.single
    && ["SJ", "BJ"].includes(previousPlay.mainRank)
  ) {
    const bombBeaters = (tableContext._candidates ?? []).filter(
      (item) => item.type === PLAY_TYPES.bomb && canBeat(item, previousPlay),
    );
    if (bombBeaters.length > 0) {
      violations.push({
        code: "P7",
        summary: "压王有普通炸弹可压，不宜亮同花顺",
        blockTop1: true,
        blockTop3: true,
      });
    }
  }

  if (candidate.type === PLAY_TYPES.bomb && previousPlay && !tableContext.hasActionableRegularWinner) {
    const bombBeaters = (tableContext._candidates ?? []).filter(
      (item) => item.type === PLAY_TYPES.bomb && canBeat(item, previousPlay),
    );
    if (bombBeaters.length > 0 && usesWildInCandidate(candidate, levelRank)) {
      const pureBeaters = bombBeaters.filter((item) => !usesWildInCandidate(item, levelRank));
      if (pureBeaters.length > 0) {
        violations.push({
          code: "P7",
          summary: "有纯炸弹够压，不宜逢人配凑更大炸",
          blockTop1: true,
          blockTop3: false,
        });
      }
    }

    if (
      isThickRankBombPlay(candidate, resolvedHand)
      && bombSizeOf(candidate) < physicalRankCount(resolvedHand, candidate.mainRank)
      && hasStandalonePureBombBeater(resolvedHand, bombBeaters)
    ) {
      violations.push({
        code: "P7",
        summary: "有纯四炸够压，不宜拆厚炸出四炸",
        blockTop1: true,
        blockTop3: true,
      });
    }

    // P7：拆厚炸出四炸永远劣于满张同点炸，不得进 Top1/Top3
    if (isSplitBombPlay(candidate, resolvedHand)) {
      violations.push({
        code: "P7",
        summary: "不宜拆厚炸出四炸，应满张出炸或过牌",
        blockTop1: true,
        blockTop3: true,
      });
    }

    const held = physicalRankCount(resolvedHand, candidate.mainRank);
    const bombSize = bombSizeOf(candidate);
    const standalonePureBeater = hasStandalonePureBombBeater(resolvedHand, bombBeaters);
    if (
      bombSize < held
      && held > 4
      && (
        prefersFullBombForControl(resolvedHand, candidate.mainRank, previousPlay, tableContext)
        || (BOMB_TYPES.has(previousPlay.type) && !standalonePureBeater)
      )
    ) {
      violations.push({
        code: "P7",
        summary: "有超过四张炸弹时应满张出炸控牌权",
        blockTop1: true,
        blockTop3: true,
      });
    }

    const sfBreak = breaksStrategicStraightFlush(candidate, resolvedHand, levelRank);
    if (sfBreak) {
      const altBombs = bombBeaters.filter(
        (item) => !breaksStrategicStraightFlush(item, resolvedHand, levelRank),
      );
      const wholeBombs = structureAwareBombs(resolvedHand, levelRank);
      const minBeatPower = bombBeaters.length > 0
        ? Math.min(...bombBeaters.map((item) => rankPower(item.mainRank, levelRank)))
        : null;
      const isMinBeatingBomb = minBeatPower != null
        && candidate.type === PLAY_TYPES.bomb
        && rankPower(candidate.mainRank, levelRank) === minBeatPower;
      if ((altBombs.length > 0 || wholeBombs.length > 0) && !(isMinBeatingBomb && altBombs.length === 0)) {
        violations.push({
          code: "P4",
          summary: `有整炸够压，不宜拆${sfBreak}凑炸`,
          blockTop1: true,
          blockTop3: true,
        });
      }
    }
  }

  // —— P10：队友占牌，不宜压队友（含五炸叠炸）；剩 1 张能走完时例外 ——
  const finishingThisTurn = tableContext.isFinishingPlay
    || (resolvedHand.length === 1 && candidate.cards?.length === resolvedHand.length);
  if (
    tableContext.partnerAttemptedCurrentRound
    && !finishingThisTurn
    && BOMB_TYPES.has(candidate.type)
    && shouldYieldPassAfterPartnerLeadOnOpponentBomb(
      { ...tableContext, hand: resolvedHand, _candidates: tableContext._candidates },
      resolvedHand,
      previousPlay,
    )
  ) {
    violations.push({
      code: "P10",
      summary: "队友本墩已出过牌，不必叠更大炸",
      blockTop1: true,
      blockTop3: true,
    });
  }
  if (
    tableContext.partnerOwnsTrick
    && !finishingThisTurn
    && BOMB_TYPES.has(candidate.type)
  ) {
    const wildBomb = usesWildInCandidate(candidate, levelRank);
    violations.push({
      code: "P10",
      summary: wildBomb
        ? "队友占牌，不宜逢人配凑炸压队友"
        : "队友占牌，不宜炸队友",
      blockTop1: true,
      blockTop3: true,
    });
  }
  if (
    shouldYieldPassToPartner({ ...tableContext, hand: resolvedHand })
    && !finishingThisTurn
    && candidate.type !== PLAY_TYPES.pass
    && !BOMB_TYPES.has(candidate.type)
  ) {
    violations.push({
      code: "P10",
      summary: "队友占牌，不宜压队友",
      blockTop1: true,
      blockTop3: true,
    });
  }

  // —— P10：队友剩1张冲刺，接风/领出不宜三带二/成组抢权 ——
  if (
    isLeadTurn(tableContext)
    && tableContext.leadMode !== "must-beat"
    && partnerHandCount(tableContext) === 1
    && resolvedHand.length > 1
    && (
      candidate.type === PLAY_TYPES.tripleWithPair
      || (
        candidate.type === PLAY_TYPES.consecutivePairs
        && (candidate.length ?? candidate.cards?.length ?? 0) < 6
        && !matchesPreferredGroup(candidate, tableContext)
      )
      || (
        candidate.type === PLAY_TYPES.plane
        && !matchesPreferredGroup(candidate, tableContext)
      )
    )
  ) {
    const altSingle = (tableContext._candidates ?? []).some(
      (item) => item.type === PLAY_TYPES.single && item.mainRank,
    );
    if (altSingle) {
      violations.push({
        code: "P10",
        summary: "队友剩1张冲刺，不宜三带二/成组抢权，宜小单送队友",
        blockTop1: true,
        blockTop3: true,
      });
    }
  }

  // —— L1：主攻两小单，开局 Top1 须在散单候选（第12篇弱路原理） ——
  if (
    tableContext.leadMode === "fresh-open"
    && isLeadTurn(tableContext)
    && tableContext.handProfile?.role === "main-attack"
    && (tableContext.handProfile?.looseSingles ?? 0) >= 2
    && resolvedHand.length <= 15
  ) {
    const looseSmalls = looseSmallSingleRanks(resolvedHand, levelRank);
    if (looseSmalls.length >= 2) {
      const altCandidates = tableContext._candidates ?? [];
      const hasLooseSingleAlt = altCandidates.some(
        (item) => item.type === PLAY_TYPES.single
          && item.mainRank
          && looseSmalls.includes(item.mainRank),
      );
      if (hasLooseSingleAlt) {
        const isLooseSingle = candidate.type === PLAY_TYPES.single
          && looseSmalls.includes(candidate.mainRank);
        if (!isLooseSingle) {
          violations.push({
            code: "L1",
            summary: "【L1】主攻两小单须先出散单，不宜首出组牌/对子",
            blockTop1: true,
            blockTop3: candidate.type !== PLAY_TYPES.single,
          });
        }
      }
    }
  }

  // —— P1：领出/接风不宜拆三同张/对子出单 ——
  if (
    isLeadTurn(tableContext)
    && candidate.type === PLAY_TYPES.single
    && candidate.mainRank
    && (tableContext.leadMode === "fresh-open" || tableContext.leadMode === "catch-wind")
  ) {
    const tier = getRankStructureTier(resolvedHand, candidate.mainRank, levelRank);
    const beatTier = effectiveBeatSingleTier(resolvedHand, candidate.mainRank, levelRank);
    const looseRanks = looseLeadSingleRanks(resolvedHand, levelRank);
    const altCandidates = tableContext._candidates ?? [];
    const hasLooseSingleLead = altCandidates.some(
      (item) => item.type === PLAY_TYPES.single
        && item.mainRank
        && (getRankStructureTier(resolvedHand, item.mainRank, levelRank) === "loose"
          || effectiveBeatSingleTier(resolvedHand, item.mainRank, levelRank) === "loose"),
    );
    const hasGroupLead = altCandidates.some(
      (item) => item.type !== PLAY_TYPES.pass
        && item.type !== PLAY_TYPES.single
        && !BOMB_TYPES.has(item.type),
    );
    if (tier === "triple" && (hasGroupLead || hasLooseSingleLead)) {
      violations.push({
        code: "P1",
        summary: "不宜拆三同张出单，优先三带二或对子",
        blockTop1: true,
        blockTop3: true,
      });
    } else if (beatTier === "pair" && looseRanks.length > 0 && (hasLooseSingleLead || hasGroupLead)) {
      violations.push({
        code: "P1",
        summary: "有散单时不拆对出单",
        blockTop1: true,
        blockTop3: true,
      });
    }
  }

  // —— P8：逢人配不宜低价值配牌（领出/接风 + 须压小牌型，与 audit wild-low-value 对齐） ——
  const reserveWildSmallRoutine = previousPlay
    && shouldReserveWildForSmallRoutineBeat(tableContext, resolvedHand, previousPlay, levelRank);
  const wildFillCountP8 = wildcardFillCount(candidate, levelRank);
  const altCandidatesP8 = tableContext._candidates ?? [];
  const naturalBeaterExists = previousPlay
    && hasNaturalRegularBeater(altCandidatesP8, previousPlay, levelRank, resolvedHand, levelRank);
  const candidateFinishesHand = (candidate.cards?.length ?? 0) === resolvedHand.length;
  if (
    !candidateFinishesHand
    && LOW_WILD_SHAPE_TYPES.has(candidate.type)
    && usesWildInCandidate(candidate, levelRank)
    && (
      isLeadTurn(tableContext)
      || (reserveWildSmallRoutine && (wildFillCountP8 >= 2 || naturalBeaterExists || !hasNaturalRegularBeater(altCandidatesP8, previousPlay, levelRank, resolvedHand, levelRank)))
    )
  ) {
    violations.push({
      code: "P8",
      summary: reserveWildSmallRoutine && !isLeadTurn(tableContext)
        ? (wildFillCountP8 >= 2
          ? "不宜双逢人配压对手小牌型"
          : "不宜逢人配压对手小牌型，宜过牌")
        : "逢人配不宜配三带二/对子/三张",
      blockTop1: true,
      blockTop3: true,
    });
  }

  // —— P5：真开局不宜空炸（同花顺/四炸等） ——
  if (
    BOMB_TYPES.has(candidate.type)
    && tableContext.leadMode === "fresh-open"
    && resolvedHand.length > 7
    && (candidate.cards?.length ?? 0) < resolvedHand.length
  ) {
    violations.push({
      code: "P5",
      summary: candidate.type === PLAY_TYPES.straightFlush
        ? (wildcardFillCount(candidate, levelRank) >= 2
          ? "开局不宜双逢人配空炸同花顺"
          : "开局有普通路线时不空炸同花顺")
        : "开局有普通路线时不空炸",
      blockTop1: true,
      blockTop3: true,
    });
  }

  // —— P5：接风空桌不宜空炸（四炸/同花顺等，非一手走完，与 fresh-open 同门禁） ——
  if (
    BOMB_TYPES.has(candidate.type)
    && tableContext.leadMode === "catch-wind"
    && !tableContext.opponentActive
    && resolvedHand.length > 7
    && (candidate.cards?.length ?? 0) < resolvedHand.length
    && !isCatchWindPremiumReduction(candidate, tableContext)
    && !isCatchWindGroupReductionAfterBomb(candidate, tableContext)
  ) {
    violations.push({
      code: "P5",
      summary: candidate.type === PLAY_TYPES.straightFlush
        ? (wildcardFillCount(candidate, levelRank) >= 2
          ? "接风不宜双逢人配空炸同花顺"
          : "接风有普通路线时不空炸同花顺")
        : "接风有普通路线时不空炸",
      blockTop1: true,
      blockTop3: true,
    });
  }

  // —— P5/P12：刚炸/同花顺夺权接风，不宜空扔厚炸（非一手走完） ——
  if (
    BOMB_TYPES.has(candidate.type)
    && tableContext.leadMode === "catch-wind"
    && !tableContext.opponentActive
    && (candidate.cards?.length ?? 0) < resolvedHand.length
    && resolvedHand.length > 7
    && playerJustWonTrickWithBomb(
      tableContext.state,
      tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex ?? 0,
    )
  ) {
    const isCatchWindSfReduction = candidate.type === PLAY_TYPES.straightFlush
      && isCatchWindGroupReductionAfterBomb(candidate, tableContext);
    const thickBomb = !isCatchWindSfReduction && (
      candidate.type === PLAY_TYPES.jokerBomb
      || bombSizeOf(candidate) >= 5
      || candidate.type === PLAY_TYPES.straightFlush
    );
    if (thickBomb) {
      violations.push({
        code: "P12",
        summary: candidate.type === PLAY_TYPES.straightFlush
          ? "刚炸夺权接风不宜空扔同花顺"
          : "刚炸夺权接风不宜空扔厚炸",
        blockTop1: true,
        blockTop3: true,
      });
    }
  }

  // —— P5：刚夺权接风有顺子跑道，不宜拆牌走连对 ——
  if (
    candidate.type === PLAY_TYPES.consecutivePairs
    && tableContext.leadMode === "catch-wind"
    && !tableContext.opponentActive
    && resolvedHand.length <= CATCH_WIND_RUNWAY_HAND_MAX
    && (
      playerJustWonTrickWithGroupPlay(
        tableContext.state,
        tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex ?? 0,
      )
      || playerJustWonTrickWithBomb(
        tableContext.state,
        tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex ?? 0,
      )
    )
    && hasCatchWindRunwayCandidate(levelRank, tableContext)
  ) {
    violations.push({
      code: "P5",
      summary: "刚夺权接风有顺子跑道，不宜拆牌走连对",
      blockTop1: true,
      blockTop3: true,
    });
  }

  // —— P7：非紧急局面同花顺不压小单/对子 ——
  if (
    isStraightFlushWasteOnSmallRoutine(candidate, resolvedHand, previousPlay, tableContext)
  ) {
    const preferredGroups = tableContext.preferredGroups ?? [];
    const plainBombs = (tableContext._candidates ?? []).filter(
      (item) => item.type === PLAY_TYPES.bomb
        && canBeat(item, previousPlay)
        && !breaksPremiumStraightOrJokerGroup(item, preferredGroups, levelRank),
    );
    violations.push({
      code: "P7",
      summary: plainBombs.length > 0
        ? "有普通炸弹可压，不宜亮同花顺"
        : "局面尚早，同花顺不压小单/对子",
      blockTop1: true,
      blockTop3: true,
    });
  }

  // —— P12：对手级牌/大单试探，局面尚早不宜动炸（含同花顺/四炸） ——
  if (
    BOMB_TYPES.has(candidate.type)
    && previousPlay
    && shouldReserveBombForHighProbeSingle(tableContext, resolvedHand, previousPlay, levelRank)
  ) {
    violations.push({
      code: "P12",
      summary: candidate.type === PLAY_TYPES.straightFlush
        ? "对手级牌/大单试探，不宜亮同花顺"
        : "对手级牌/大单试探，不宜动炸",
      blockTop1: true,
      blockTop3: true,
    });
  }

  // —— P5/P9：出牌导致炸弹物理作废 ——
  if (
    candidate.type !== PLAY_TYPES.pass
    && candidate.cards?.length !== resolvedHand.length
    && breaksBombIntegrity(candidate, resolvedHand, levelRank, tableContext)
  ) {
    const isCatchWind = tableContext.leadMode === "catch-wind" && !tableContext.opponentActive;
    const hasPlate = strategicGroupsCached(resolvedHand, levelRank, tableContext).some(
      (group) => group.play?.type === PLAY_TYPES.plane || group.label?.startsWith("钢板"),
    );
    violations.push({
      code: isCatchWind && hasPlate ? "P5" : "P9",
      summary: isCatchWind && hasPlate
        ? "接风有完整钢板，不宜拆炸走其它牌型"
        : "出牌会导致炸弹作废，应走整炸或保留结构",
      blockTop1: true,
      blockTop3: true,
    });
  }

  // —— P9：有四炸及以上，拆整炸组三带二/裸三张 ——
  if (
    (candidate.type === PLAY_TYPES.tripleWithPair || candidate.type === PLAY_TYPES.triple)
    && resolvedHand.length > 0
  ) {
    const tripleRank = candidate.mainRank;
    const physicalHeld = physicalRankCount(resolvedHand, tripleRank);
    const usedFromRank = (candidate.cards ?? []).filter((card) => card.rank === tripleRank).length;
    const tripleAnalysis = analyzeRankAvailability(resolvedHand, tripleRank, levelRank);
    const breaksWholeBomb = tripleAnalysis.wouldBreakBombForTriple
      && usedFromRank >= 3;
    const remainingPhysical = physicalHeld - usedFromRank;
    // 四张同点但有一张锁在同花顺/钢板内（如 777+88 不碰同花顺里的第 4 张 7）不算拆整炸
    const soleLockedInPremium = physicalHeld >= 4
      && usedFromRank >= 3
      && remainingPhysical === 1
      && tripleAnalysis.effectiveBombCount < 4
      && (tripleAnalysis.lockedEntries?.length ?? 0) > 0;
    const breaksPhysicalFourBomb = physicalHeld >= 4
      && usedFromRank >= 3
      && !soleLockedInPremium
      && remainingPhysical < 4;
    const solePair = candidate.type === PLAY_TYPES.tripleWithPair
      ? solePairForTripleRank(resolvedHand, levelRank, tripleRank)
      : null;
    const usesSoleCompanionPair = solePair != null
      && (candidate.cards ?? []).filter((card) => card.rank === solePair).length >= 2
      && (physicalHeld < 4 || resolvedHand.length <= 12);
    const catchWindTempo = tableContext.leadMode === "catch-wind"
      && isLeadTurn(tableContext)
      && resolvedHand.length <= 15
      && (physicalHeld < 4 || usesSoleCompanionPair);
    const openingFourBombTripleProbe = isLeadTurn(tableContext)
      && tableContext.leadMode === "fresh-open"
      && candidate.type === PLAY_TYPES.triple
      && physicalHeld >= 4
      && usedFromRank === 3;
    if ((breaksWholeBomb || breaksPhysicalFourBomb) && !catchWindTempo && !openingFourBombTripleProbe) {
      violations.push({
        code: "P9",
        summary: "有四炸及以上，不宜拆整炸组三带二",
        blockTop1: true,
        blockTop3: false,
      });
    }

    // 三带二带对削弱厚炸（5+ 张仍够四炸）：真开局/接风不宜（如 444+AA 拆六炸A）
    if (
      isLeadTurn(tableContext)
      && tableContext.leadMode !== "must-beat"
      && !catchWindTempo
    ) {
      const rankCounts = new Map();
      for (const card of candidate.cards ?? []) {
        rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
      }
      for (const [rank, usedCount] of rankCounts.entries()) {
        if (rank === tripleRank || usedCount < 2) continue;
        const physicalHeld = physicalRankCount(resolvedHand, rank);
        if (physicalHeld < 5) continue;
        const pairAnalysis = analyzeRankAvailability(resolvedHand, rank, levelRank);
        if (pairAnalysis.effectiveBombCount < 4 && physicalHeld < 4) continue;
        const remaining = physicalHeld - usedCount;
        if (remaining >= 4) {
          violations.push({
            code: "P9",
            summary: physicalHeld >= 6
              ? "开局不宜三带二拆六炸带对"
              : "有五炸及以上，不宜三带二拆厚炸带对",
            blockTop1: true,
            blockTop3: tableContext.leadMode === "fresh-open",
          });
          break;
        }
      }
    }
  }

  return violations;
}

/** 违规候选是否禁止占据 Top1 */
export function candidateBlocksTop1(item) {
  return item?.doctrineBlockedTop1
    || (item?.doctrineViolations ?? []).some((v) => v.blockTop1 || v.blockTop3);
}

/** 违规候选是否禁止进入 Top3 */
export function candidateBlocksTop3(item) {
  return item?.doctrineBlockedTop3
    || (item?.doctrineViolations ?? []).some((v) => v.blockTop3);
}

/** 须压且仅炸弹可跟时，从已评分候选中选出合规炸弹（避免 eligible 为空时回退到过牌） */
function pickMandatoryBombFallback(processed, tableContext, hand, levelRank) {
  const previousPlay = tableContext.previousPlay ?? null;
  const ctx = { ...tableContext, hand };
  if (!shouldVetoBombOnlyPass(ctx, hand, previousPlay) || !previousPlay) return null;

  const beaters = processed.filter(
    (item) => BOMB_TYPES.has(item.candidate?.type) && canBeat(item.candidate, previousPlay),
  );
  if (beaters.length === 0) return null;

  const compliant = beaters.filter(
    (item) => !isForbiddenBombRescueItem(item, hand, previousPlay, tableContext, levelRank),
  );
  if (compliant.length === 0) return null;
  return [...compliant].sort((left, right) => {
    const sizeGap = bombSizeOf(left.candidate) - bombSizeOf(right.candidate);
    if (sizeGap !== 0) return sizeGap;
    return left.score - right.score;
  })[0];
}

/**
 * 执法后重排：blockTop3 沉底；blockTop1 不得占首位。
 */
export function rerankAfterDoctrineEnforcement(candidates) {
  const sorted = [...candidates].sort((left, right) => left.score - right.score);
  const eligible = sorted.filter((item) => !candidateBlocksTop3(item));
  const blockedTop3 = sorted.filter((item) => candidateBlocksTop3(item));

  if (eligible.length > 0 && candidateBlocksTop1(eligible[0])) {
    const swapIdx = eligible.findIndex((item) => !candidateBlocksTop1(item));
    if (swapIdx > 0) {
      [eligible[0], eligible[swapIdx]] = [eligible[swapIdx], eligible[0]];
    }
  }

  return [...eligible, ...blockedTop3];
}

/**
 * 对评分候选施加教纲执法。
 * @returns {{ candidates: object[], doctrineViolations: object[] }}
 */
export function enforceDoctrineOnCandidates(scoredCandidates, context) {
  const hand = context.hand ?? context.state?.players?.[context.playerIndex]?.hand ?? [];
  const levelRank = context.levelRank ?? context.state?.levelRank ?? "2";
  const tableContext = { ...context, hand, _candidates: context._candidates ?? [] };

  const doctrineViolations = [];

  const processed = scoredCandidates.map((item) => {
    if (doctrinePastDeadline(context)) {
      return { ...item, doctrineViolations: [] };
    }
    const violations = detectDoctrineViolations(item.candidate, hand, levelRank, tableContext);
    if (violations.length === 0) {
      return { ...item, doctrineViolations: [] };
    }

    for (const violation of violations) {
      doctrineViolations.push({
        ...violation,
        candidateLabel: item.candidate.label ?? item.candidate.mainRank ?? item.candidate.type,
      });
    }

    const blockTop3 = violations.some((v) => v.blockTop3);
    const blockTop1 = violations.some((v) => v.blockTop1);

    return {
      ...item,
      score: item.score + DOCTRINE_HARD_PENALTY,
      doctrineViolations: violations,
      doctrineBlockedTop3: blockTop3,
      doctrineBlockedTop1: blockTop1,
      principleConflict: true,
      doctrineEnforced: true,
      // 违规详情仅存 doctrineViolations；不向 reasons 追加【执法】内部标记
      reasons: item.reasons ?? [],
    };
  });

  const reranked = rerankAfterDoctrineEnforcement(processed);
  let candidates = reranked.filter((item) => !candidateBlocksTop3(item));
  const blocked = reranked.filter((item) => candidateBlocksTop3(item));

  const topNeedsBomb = candidates.length === 0
    || candidateBlocksTop1(candidates[0])
    || (candidates[0]?.candidate?.type === PLAY_TYPES.pass
      && shouldVetoBombOnlyPass({ ...tableContext, hand }, hand, tableContext.previousPlay));
  if (topNeedsBomb) {
    const bombFallback = pickMandatoryBombFallback(processed, tableContext, hand, levelRank);
    if (bombFallback) {
      const rest = reranked.filter((item) => item !== bombFallback && !candidateBlocksTop3(item));
      candidates = [bombFallback, ...rest];
    }
  }

  const fallbackCandidates = candidates.length > 0 ? candidates : reranked.slice(0, 1);
  const fallbackBlocked = candidates.length > 0 ? blocked : reranked.slice(1);

  return {
    candidates: fallbackCandidates,
    blockedCandidates: fallbackBlocked,
    doctrineViolations,
  };
}

/** Top1 教纲合规断言（测试/调试环境） */
export function assertTop1DoctrineCompliance(topItem, hand, levelRank, tableContext) {
  if (!topItem?.candidate) return;
  const violations = detectDoctrineViolations(topItem.candidate, hand, levelRank, tableContext);
  const fatal = violations.filter((v) => v.blockTop1 || v.blockTop3);
  if (fatal.length === 0) return;

  const codes = fatal.map((v) => v.code).join(",");
  throw new Error(
    `教纲执法断言失败：Top1 仍违反 ${codes}（${topItem.candidate.label ?? topItem.candidate.mainRank}）`,
  );
}

/** 从 advice/QA 上下文检测推荐1是否违规 */
export function detectAdviceTop1Violations(context) {
  const hand = context.humanHand ?? [];
  const levelRank = context.levelRank ?? "2";
  const table = context.table ?? {};
  const previousPlay = table.lastActivePlay ?? null;
  const top = context.currentAdvice?.choices?.[0];
  const play = top?.play ?? top?.candidate;
  if (!play || play.type === PLAY_TYPES.pass) return [];

  const isOpening = !previousPlay || previousPlay.type === PLAY_TYPES.pass;
  let leadMode = isOpening ? "fresh-open" : "must-beat";
  if (isOpening && context.state && context.playerIndex != null) {
    leadMode = inferLeadMode(context.state, context.playerIndex);
  }

  const choiceCandidates = (context.currentAdvice?.choices ?? [])
    .map((c) => c.play ?? c.candidate)
    .filter(Boolean);

  let candidates = choiceCandidates;
  if (hand.length && previousPlay && previousPlay.type !== PLAY_TYPES.pass) {
    const generated = generateBasicCandidates(hand, levelRank, previousPlay);
    const seen = new Set();
    candidates = [];
    for (const item of [...choiceCandidates, ...generated]) {
      const key = item.label ?? `${item.type}:${item.mainRank ?? ""}:${item.cards?.length ?? 0}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(item);
    }
  }

  const enrichedContext = {
    previousPlay,
    isOpening,
    leadMode,
    opponentActive: previousPlay && previousPlay.type !== PLAY_TYPES.pass,
    hasRegularWinner: true,
    hasActionableRegularWinner: true,
    _candidates: candidates,
    hand,
  };

  const beatCtx = previousPlay?.type === PLAY_TYPES.single
    ? analyzeMustBeatSingleContext(hand, levelRank, previousPlay, enrichedContext)
    : null;
  if (beatCtx) {
    enrichedContext.hasRegularWinner = beatCtx.beaters.length > 0;
    enrichedContext.hasActionableRegularWinner = beatCtx.beaters.length > 0;
  }

  return detectDoctrineViolations(play, hand, levelRank, enrichedContext);
}

/** QA/UI 用：违规确认首行 */
export function doctrineViolationAckLine(violations) {
  if (!violations?.length) return null;
  const codes = [...new Set(violations.map((v) => v.code))].join("/");
  return `这手推荐违规（${codes}），你是对的。`;
}

/** 用户可见简短警告 */
export function doctrineViolationUserWarning(violations) {
  if (!violations?.length) return null;
  const codes = [...new Set(violations.map((v) => v.code))].join("、");
  return `⚠ 本手推荐违反教纲${codes}，请勿照抄`;
}

export { getRankStructureTier, analyzeMustBeatSingleContext, analyzeMustBeatPairContext };
