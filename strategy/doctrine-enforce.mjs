/**
 * 教纲执法层（Doctrine Enforcement）— 违反 P1/P4/P5/P7/P9 的候选硬否决或巨罚，ML 无法抬回 Top1。
 */
import { isWildCard } from "../engine/card.mjs";
import { canBeat } from "../engine/compare-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { rankPower } from "../engine/rank-order.mjs";
import {
  analyzeMustBeatPairContext,
  analyzeMustBeatSingleContext,
  diagnoseBeatPairViolation,
  diagnoseBeatSingleViolation,
  diagnoseCatchWindStraightTripleViolation,
  diagnoseInferiorWrapStraightViolation,
  diagnoseLeadConsecutivePairsTripleViolation,
  diagnoseLeadTripleBreaksStraightViolation,
  getRankStructureTier,
  isFollowingOpponentSingle,
  prefersFullBombForControl,
  shouldYieldPassAfterPartnerLeadOnOpponentBomb,
  shouldReserveStraightFlushForSmallCards,
  shouldVetoBombOnlyPass,
  shouldVetoPassWithRegularBeater,
  isPressingRoutineNonBomb,
  breaksPremiumStraightOrJokerGroup,
} from "./principles.mjs";
import {
  analyzeRankAvailability,
  breaksBombIntegrity,
  breaksStrategicStraightFlush,
  structureAwareBombs,
} from "./scorers/structure.mjs";
import { buildStrategicGroups } from "./strategic-groups.mjs";
import { inferLeadMode, playerJustWonTrickWithBomb } from "./lead-mode.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

/** 执法巨罚：确保 ML 融合（~8500 权重）无法把违规候选抬到 Top1 */
export const DOCTRINE_HARD_PENALTY = 50_000;

function physicalRankCount(hand, rank) {
  return hand.filter((card) => card.rank === rank && card.rank !== "SJ" && card.rank !== "BJ").length;
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

function isLeadTurn(tableContext) {
  return tableContext.isOpening && tableContext.leadMode !== "must-beat";
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

  // —— P5：接风/领出有钢板，三带二拆钢板 ——
  if (isLeadTurn(tableContext) && resolvedHand.length >= 10) {
    const steelPlate = handHasSteelPlate(resolvedHand, levelRank);
    if (
      steelPlate
      && candidate.type === PLAY_TYPES.tripleWithPair
    ) {
      const tripleAnalysis = analyzeRankAvailability(resolvedHand, candidate.mainRank, levelRank);
      const lockedInPlate = (tripleAnalysis.lockedEntries ?? []).some((e) => e.structure === "钢板");
      if (lockedInPlate) {
        violations.push({
          code: "P5",
          summary: "接风/领出有钢板，不宜三带二拆钢板",
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
      blockTop3: false,
    });
  }

  // —— P7：有纯四炸够压，仍用逢人配凑更大炸 ——
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

    const held = physicalRankCount(resolvedHand, candidate.mainRank);
    const bombSize = bombSizeOf(candidate);
    if (
      prefersFullBombForControl(resolvedHand, candidate.mainRank, previousPlay, tableContext)
      && bombSize < held
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
      if ((altBombs.length > 0 || wholeBombs.length > 0) && !isMinBeatingBomb) {
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
    && candidate.type !== PLAY_TYPES.pass
  ) {
    violations.push({
      code: "P10",
      summary: "队友占牌，不宜压队友",
      blockTop1: true,
      blockTop3: BOMB_TYPES.has(candidate.type),
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
    const thickBomb = candidate.type === PLAY_TYPES.straightFlush
      || candidate.type === PLAY_TYPES.jokerBomb
      || bombSizeOf(candidate) >= 5;
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

  // —— P7：非紧急局面同花顺不压小单/对子 ——
  if (
    candidate.type === PLAY_TYPES.straightFlush
    && previousPlay
    && [PLAY_TYPES.single, PLAY_TYPES.pair].includes(previousPlay.type)
    && (tableContext.danger ?? 0) < 3
    && resolvedHand.length > 8
  ) {
    const preferredGroups = tableContext.preferredGroups ?? [];
    const plainBombs = (tableContext._candidates ?? []).filter(
      (item) => item.type === PLAY_TYPES.bomb
        && canBeat(item, previousPlay)
        && !breaksPremiumStraightOrJokerGroup(item, preferredGroups, levelRank),
    );
    if (plainBombs.length > 0) {
      violations.push({
        code: "P7",
        summary: "有普通炸弹可压，不宜亮同花顺",
        blockTop1: true,
        blockTop3: true,
      });
    } else if (shouldReserveStraightFlushForSmallCards(tableContext, resolvedHand, previousPlay)) {
      violations.push({
        code: "P7",
        summary: "局面尚早，同花顺不压小单/对子",
        blockTop1: true,
        blockTop3: true,
      });
    }
  }

  // —— P5/P9：出牌导致炸弹物理作废 ——
  if (
    candidate.type !== PLAY_TYPES.pass
    && candidate.cards?.length !== resolvedHand.length
    && breaksBombIntegrity(candidate, resolvedHand, levelRank, tableContext)
  ) {
    const isCatchWind = tableContext.leadMode === "catch-wind" && !tableContext.opponentActive;
    const hasPlate = buildStrategicGroups(resolvedHand, levelRank).some(
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

  // —— P9：有四炸及以上，拆整炸组三带二 ——
  if (candidate.type === PLAY_TYPES.tripleWithPair && resolvedHand.length > 0) {
    const tripleRank = candidate.mainRank;
    const physicalHeld = physicalRankCount(resolvedHand, tripleRank);
    const usedFromRank = (candidate.cards ?? []).filter((card) => card.rank === tripleRank).length;
    const tripleAnalysis = analyzeRankAvailability(resolvedHand, tripleRank, levelRank);
    const breaksWholeBomb = (tripleAnalysis.effectiveBombCount >= 4 || physicalHeld >= 4)
      && usedFromRank >= 3
      && physicalHeld - usedFromRank < 4;
    const catchWindTempo = tableContext.leadMode === "catch-wind"
      && isLeadTurn(tableContext)
      && resolvedHand.length <= 15;
    if (breaksWholeBomb && !catchWindTempo) {
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

  const compliant = beaters.filter((item) => !candidateBlocksTop1(item));
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

  return {
    candidates: candidates.length > 0 ? candidates : reranked,
    blockedCandidates: blocked,
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
  } else if (isOpening && !previousPlay) {
    leadMode = "catch-wind";
  }

  const candidates = (context.currentAdvice?.choices ?? [])
    .map((c) => c.play ?? c.candidate)
    .filter(Boolean);

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
