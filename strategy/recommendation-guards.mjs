/**
 * 人类教练与机器人/审计共用的推荐收尾：候选过滤、Top1 救援。
 */
import { canBeat } from "../engine/compare-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import {
  analyzeMustBeatSingleContext,
  analyzeMustBeatPairContext,
  analyzeMustBeatTripleWithPairContext,
  isForbiddenBombRescueItem,
  isPressingRoutineNonBomb,
  shouldVetoBombOnlyPass,
  shouldVetoPassWithRegularBeater,
} from "./principles.mjs";
import { assertTop1DoctrineCompliance, candidateBlocksTop3 } from "./doctrine-enforce.mjs";
import { isTeammate } from "./seat-utils.mjs";
import { resolveLastActivePlayerIndex } from "./table-context.mjs";
import { alignReasonsForPlay } from "./reason-align.mjs";
import { hasOnlyAntiSinglePenaltyReasons, playContradictsReasons } from "./reason-consistency.mjs";
import { analyzeRankAvailability, breaksBombIntegrity } from "./scorers/structure.mjs";
import { breaksStraightFlushRunwayOnMustBeatCp, breaksStraightFlushRunwayOnMustBeatTwp } from "./sf-runway-guard.mjs";
import { shouldReserveStructureForRoutineBeat } from "./wild-doctrine.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

function isMustBeatRoutineSfRunwayBreak(candidate, hand, levelRank, tableContext) {
  return breaksStraightFlushRunwayOnMustBeatTwp(candidate, hand, levelRank, tableContext) != null
    || breaksStraightFlushRunwayOnMustBeatCp(candidate, hand, levelRank, tableContext) != null;
}

/** 须压时该推荐是否合法（过牌始终合法） */
export function isMustBeatLegalItem(item, previousPlay) {
  if (!previousPlay || previousPlay.type === PLAY_TYPES.pass) return true;
  const candidate = item?.candidate;
  if (!candidate || candidate.type === PLAY_TYPES.pass) return true;
  return canBeat(candidate, previousPlay);
}

/** 开局三带二拆钢板：沉底，与 getTurnAdvice / recommendPlay 共用 */
function breaksSteelPlateTripleOnOpening(item, hand, levelRank, ctx) {
  if (!ctx.isOpening || ctx.leadMode === "must-beat") return false;
  const candidate = item.candidate;
  if (candidate.type !== PLAY_TYPES.tripleWithPair) return false;
  const info = analyzeRankAvailability(hand, candidate.mainRank, levelRank);
  return (info.lockedEntries ?? []).some((entry) => entry.structure === "钢板");
}

export function demotePlateBreakingTriplesOnOpening(scored, hand, levelRank, ctx) {
  if (!ctx.isOpening || ctx.leadMode === "must-beat") return scored;
  const kept = [];
  const demoted = [];
  for (const item of scored) {
    if (breaksSteelPlateTripleOnOpening(item, hand, levelRank, ctx)) demoted.push(item);
    else kept.push(item);
  }
  return demoted.length > 0 ? [...kept, ...demoted] : scored;
}

export function allowMustBeatPremiumLooseSingle(candidate, hand, levelRank, previousPlay, tableContext, preferredGroups) {
  if (!previousPlay || previousPlay.type !== PLAY_TYPES.single) return false;
  const ctx = analyzeMustBeatSingleContext(hand, levelRank, previousPlay, {
    ...tableContext,
    preferredGroups,
  });
  return ctx.mustBeatPremiumLooseSingle?.(candidate) ?? false;
}

function partnerOwnsActivePlay(tableContext) {
  if (tableContext.partnerOwnsTrick) return true;
  const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex;
  const lastActive = resolveLastActivePlayerIndex(tableContext);
  if (playerIndex == null || lastActive == null) return false;
  const previousPlay = tableContext.previousPlay
    ?? tableContext.state?.lastActivePlay
    ?? null;
  if (!previousPlay || previousPlay.type === PLAY_TYPES.pass) return false;
  return isTeammate(playerIndex, lastActive);
}

export function rescueBombOnlyTop1Recommendation(recommendation, pool, hand, tableContext) {
  const previousPlay = tableContext.previousPlay ?? null;
  const ctx = { ...tableContext, hand };
  if (recommendation?.candidate?.type !== PLAY_TYPES.pass) return recommendation;
  if (partnerOwnsActivePlay(ctx) || !previousPlay) return recommendation;
  if (!shouldVetoBombOnlyPass(ctx, hand, previousPlay)) return recommendation;

  const beaters = pool.filter(
    (item) => BOMB_TYPES.has(item.candidate?.type)
      && canBeat(item.candidate, previousPlay)
      && !isForbiddenBombRescueItem(item, hand, previousPlay, ctx),
  );
  if (beaters.length === 0) return recommendation;

  return [...beaters].sort((left, right) => {
    const leftSize = left.candidate.bombSize ?? left.candidate.cards?.length ?? 4;
    const rightSize = right.candidate.bombSize ?? right.candidate.cards?.length ?? 4;
    if (leftSize !== rightSize) return leftSize - rightSize;
    return left.score - right.score;
  })[0];
}

export function rescueRegularBeatTop1Recommendation(recommendation, pool, hand, tableContext, levelRank) {
  const previousPlay = tableContext.previousPlay ?? null;
  if (recommendation?.candidate?.type !== PLAY_TYPES.pass) return recommendation;
  if (!shouldVetoPassWithRegularBeater(tableContext, hand, previousPlay, levelRank)) return recommendation;

  const beaters = pool.filter(
    (item) => item.candidate?.type !== PLAY_TYPES.pass
      && !BOMB_TYPES.has(item.candidate?.type)
      && canBeat(item.candidate, previousPlay)
      && !item.doctrineBlockedTop1,
  );
  if (beaters.length > 0) {
    return [...beaters].sort((left, right) => left.score - right.score)[0];
  }

  if (previousPlay?.type === PLAY_TYPES.pair) {
    const pairCtx = analyzeMustBeatPairContext(hand, levelRank, previousPlay, tableContext);
    const reserveStructure = shouldReserveStructureForRoutineBeat(tableContext, hand, previousPlay, levelRank);
    const minPool = pairCtx.structureSafeDedicated?.length > 0
      ? pairCtx.structureSafeDedicated
      : pairCtx.structureSafeWholePairBeaters?.length > 0
        ? pairCtx.structureSafeWholePairBeaters
        : reserveStructure
          ? []
          : pairCtx.dedicatedPairBeaters.length > 0
            ? pairCtx.dedicatedPairBeaters
            : pairCtx.wholePairBeaters;
    const minPair = minPool.reduce(
      (best, item) => (!best || item.power < best.power ? item : best),
      null,
    );
    if (minPair) {
      const scored = pool.find(
        (item) => item.candidate?.type === PLAY_TYPES.pair
          && item.candidate?.mainRank === minPair.mainRank
          && item.candidate?.power === minPair.power,
      );
      if (scored) return scored;
      return {
        candidate: minPair,
        score: recommendation.score - 2000,
        reasons: ["须压对子，有整对够压宜先出整对"],
      };
    }
  }

  if (previousPlay?.type === PLAY_TYPES.tripleWithPair) {
    const twpCtx = analyzeMustBeatTripleWithPairContext(hand, levelRank, previousPlay, tableContext);
    const actionableSafe = twpCtx.structureSafeBeaters.filter(
      (item) => !breaksBombIntegrity(item, hand, levelRank, tableContext),
    );
    const minTwp = actionableSafe.reduce(
      (best, item) => (!best || item.power < best.power ? item : best),
      null,
    );
    if (minTwp) {
      const scored = pool.find(
        (item) => item.candidate?.type === PLAY_TYPES.tripleWithPair
          && item.candidate?.mainRank === minTwp.mainRank
          && item.candidate?.power === minTwp.power,
      );
      if (scored) return scored;
      return {
        candidate: minTwp,
        score: recommendation.score - 2000,
        reasons: ["须压三带二，有不拆同花顺跑道三带二宜先出"],
      };
    }
  }

  const ctx = analyzeMustBeatSingleContext(hand, levelRank, previousPlay, tableContext);
  const looseRank = ctx.minLooseRank;
  if (!looseRank) return recommendation;
  const looseCandidate = ctx.looseBeaters.find((item) => item.mainRank === looseRank);
  if (!looseCandidate) return recommendation;
  const scored = pool.find(
    (item) => item.candidate?.type === PLAY_TYPES.single && item.candidate?.mainRank === looseRank,
  );
  if (scored) return scored;
  return {
    candidate: looseCandidate,
    score: recommendation.score - 2000,
    reasons: ["须压单张，最小散单在同花顺组内也应先抢权"],
  };
}

function recommendationContradictsReasons(item, tableContext = {}) {
  const play = item?.candidate;
  if (!play) return true;
  if (play.type === PLAY_TYPES.single && hasOnlyAntiSinglePenaltyReasons(item?.reasons)) {
    return true;
  }
  const previousPlay = tableContext.previousPlay ?? null;
  if (!isMustBeatLegalItem(item, previousPlay)) return true;
  const aligned = alignReasonsForPlay(item?.reasons, play, { previousPlay });
  return playContradictsReasons(play, aligned, { previousPlay });
}

/** 备选池/推荐2～3 展示：与 Top1 同等理由一致性过滤 */
export function isDisplayablePoolItem(item, tableContext = {}) {
  const previousPlay = tableContext.previousPlay ?? null;
  if (!isMustBeatLegalItem(item, previousPlay)) return false;
  if (candidateBlocksTop3(item)) return false;
  return !recommendationContradictsReasons(item, tableContext);
}

function finalizeAlignedRecommendation(item, pool, hand, tableContext, levelRank) {
  const finalized = finalizeTopRecommendation(item, pool, hand, tableContext, levelRank);
  if (!finalized) return finalized;
  finalized.reasons = alignReasonsForPlay(finalized.reasons, finalized.candidate, {
    previousPlay: tableContext.previousPlay ?? null,
  });
  return finalized;
}

/** 须压时 Top1 必须能压过上家（过牌除外） */
export function assertMustBeatTop1(top, previousPlay) {
  if (!top?.candidate || !previousPlay || previousPlay.type === PLAY_TYPES.pass) return;
  if (top.candidate.type === PLAY_TYPES.pass) return;
  if (!canBeat(top.candidate, previousPlay)) {
    throw new Error(
      `Top1 不能压过上家：${top.candidate.label ?? top.candidate.type} vs ${previousPlay.label ?? previousPlay.type}`,
    );
  }
}

export function finalizeTopRecommendation(top, pool, hand, tableContext, levelRank) {
  let recommendation = top;
  const scoredPool = pool;
  recommendation = rescueBombOnlyTop1Recommendation(recommendation, scoredPool, hand, tableContext)
    ?? recommendation;
  recommendation = rescueRegularBeatTop1Recommendation(recommendation, scoredPool, hand, tableContext, levelRank)
    ?? recommendation;
  assertMustBeatTop1(recommendation, tableContext.previousPlay ?? null);
  return recommendation;
}

/** 从评分池选取教纲合规且须压合法的 Top1 */
export function pickCompliantTopRecommendation(pool, hand, tableContext, levelRank) {
  const previousPlay = tableContext.previousPlay ?? null;
  const sorted = [...pool].sort((left, right) => left.score - right.score);
  for (const item of sorted) {
    if (item.doctrineBlockedTop1 || recommendationContradictsReasons(item, tableContext)) continue;
    if (isMustBeatRoutineSfRunwayBreak(item.candidate, hand, levelRank, tableContext)) continue;
    if (
      tableContext.hasActionableRegularWinner
      && BOMB_TYPES.has(item.candidate?.type)
      && previousPlay
      && !tableContext.isFinishingPlay
      && (
        previousPlay.type === PLAY_TYPES.single
        || isPressingRoutineNonBomb(previousPlay, tableContext)
      )
    ) {
      continue;
    }
    try {
      const finalized = finalizeAlignedRecommendation(item, pool, hand, tableContext, levelRank);
      if (recommendationContradictsReasons(finalized, tableContext)) continue;
      assertTop1DoctrineCompliance(finalized, hand, levelRank, tableContext);
      return finalized;
    } catch {
      // 尝试下一个候选
    }
  }
  const passItem = sorted.find((item) => item.candidate?.type === PLAY_TYPES.pass);
  const mustLead = tableContext.isOpening && tableContext.leadMode !== "must-beat";
  if (passItem && !mustLead) {
    const rescuedPass = finalizeAlignedRecommendation(passItem, pool, hand, tableContext, levelRank);
    if (rescuedPass?.candidate?.type !== PLAY_TYPES.pass) return rescuedPass;
    if (!shouldVetoPassWithRegularBeater(tableContext, hand, tableContext.previousPlay ?? null, levelRank)
      && !shouldVetoBombOnlyPass({ ...tableContext, hand }, hand, tableContext.previousPlay ?? null)
      && !recommendationContradictsReasons(rescuedPass, tableContext)) {
      return rescuedPass;
    }
  }

  const fallback = sorted.find(
    (item) => !item.doctrineBlockedTop1
      && isMustBeatLegalItem(item, previousPlay)
      && !isMustBeatRoutineSfRunwayBreak(item.candidate, hand, levelRank, tableContext)
      && !recommendationContradictsReasons(item, tableContext),
  );

  const mustBeat = previousPlay && previousPlay.type !== PLAY_TYPES.pass;
  if (!fallback && mustBeat) {
    const emergencyBeater = sorted.find(
      (item) => item.candidate?.type !== PLAY_TYPES.pass
        && canBeat(item.candidate, previousPlay)
        && !item.doctrineBlockedTop1
        && !isMustBeatRoutineSfRunwayBreak(item.candidate, hand, levelRank, tableContext)
        && !isForbiddenBombRescueItem(item, hand, previousPlay, tableContext, levelRank)
        && !recommendationContradictsReasons(item, tableContext),
    );
    if (emergencyBeater) {
      return finalizeAlignedRecommendation(emergencyBeater, pool, hand, tableContext, levelRank);
    }
  }

  if (!fallback && passItem && !mustLead) {
    const reservedPass = finalizeAlignedRecommendation(passItem, pool, hand, tableContext, levelRank);
    if (reservedPass?.candidate?.type === PLAY_TYPES.pass
      && !recommendationContradictsReasons(reservedPass, tableContext)) {
      return reservedPass;
    }
  }

  if (!fallback) return null;
  return finalizeAlignedRecommendation(fallback, pool, hand, tableContext, levelRank);
}
