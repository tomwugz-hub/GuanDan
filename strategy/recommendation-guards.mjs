/**
 * 人类教练与机器人/审计共用的推荐收尾：候选过滤、Top1 救援。
 */
import { canBeat } from "../engine/compare-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import {
  analyzeMustBeatSingleContext,
  shouldVetoBombOnlyPass,
  shouldVetoPassWithRegularBeater,
} from "./principles.mjs";
import { assertTop1DoctrineCompliance } from "./doctrine-enforce.mjs";
import { analyzeRankAvailability } from "./scorers/structure.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

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

export function rescueBombOnlyTop1Recommendation(recommendation, pool, hand, tableContext) {
  const previousPlay = tableContext.previousPlay ?? null;
  const ctx = { ...tableContext, hand };
  if (recommendation?.candidate?.type !== PLAY_TYPES.pass) return recommendation;
  if (!shouldVetoBombOnlyPass(ctx, hand, previousPlay) || !previousPlay) return recommendation;

  const beaters = pool.filter(
    (item) => BOMB_TYPES.has(item.candidate?.type) && canBeat(item.candidate, previousPlay),
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

function recommendationContradictsReasons(item) {
  const play = item?.candidate;
  const reasons = item?.reasons ?? [];
  if (!play) return true;
  if (play.type === PLAY_TYPES.pass) {
    return reasons.some((r) => /不应.*过牌|不能轻易放行|不宜过牌/.test(r));
  }
  if (BOMB_TYPES.has(play.type)) {
    const bombDuty = reasons.some((r) => /满张炸弹控牌权|压顺子需炸弹|只有炸弹能压，应抢牌权|应满张出炸控权/.test(r));
    if (bombDuty) return false;
    return reasons.some((r) => /不必动炸|不宜动炸|已有普通牌能压住/.test(r));
  }
  return false;
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
  const sorted = [...pool].sort((left, right) => left.score - right.score);
  for (const item of sorted) {
    if (item.doctrineBlockedTop1 || recommendationContradictsReasons(item)) continue;
    try {
      const finalized = finalizeTopRecommendation(item, pool, hand, tableContext, levelRank);
      assertTop1DoctrineCompliance(finalized, hand, levelRank, tableContext);
      return finalized;
    } catch {
      // 尝试下一个候选
    }
  }
  const passItem = sorted.find((item) => item.candidate?.type === PLAY_TYPES.pass);
  if (passItem) {
    const rescuedPass = finalizeTopRecommendation(passItem, pool, hand, tableContext, levelRank);
    if (rescuedPass?.candidate?.type !== PLAY_TYPES.pass) return rescuedPass;
    if (!shouldVetoPassWithRegularBeater(tableContext, hand, tableContext.previousPlay ?? null, levelRank)
      && !shouldVetoBombOnlyPass({ ...tableContext, hand }, hand, tableContext.previousPlay ?? null)) {
      return rescuedPass;
    }
  }

  const fallback = sorted.find(
    (item) => !item.doctrineBlockedTop1 && !recommendationContradictsReasons(item),
  );

  const previousPlay = tableContext.previousPlay ?? null;
  const mustBeat = previousPlay && previousPlay.type !== PLAY_TYPES.pass;
  if (!fallback && mustBeat) {
    const emergencyBeater = sorted.find(
      (item) => item.candidate?.type !== PLAY_TYPES.pass
        && canBeat(item.candidate, previousPlay)
        && !recommendationContradictsReasons(item),
    );
    if (emergencyBeater) {
      return finalizeTopRecommendation(emergencyBeater, pool, hand, tableContext, levelRank);
    }
  }

  if (!fallback && passItem) {
    const reservedPass = finalizeTopRecommendation(passItem, pool, hand, tableContext, levelRank);
    if (reservedPass?.candidate?.type === PLAY_TYPES.pass) return reservedPass;
  }

  if (!fallback) return null;
  return finalizeTopRecommendation(fallback, pool, hand, tableContext, levelRank);
}
