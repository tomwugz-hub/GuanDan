import { isWildCard } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { canBeat } from "../engine/compare-play.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { rankPower } from "../engine/rank-order.mjs";
import { alignReasonsForPlay } from "./reason-align.mjs";
import { enrichScoringContext, evaluateBombInventory } from "./table-context.mjs";
import { opponentPressureAdjustment } from "./scorers/opponent-pressure.mjs";
import { breaksBombIntegrity, structureBreakPenalty } from "./scorers/structure.mjs";
import { tempoLeadAdjustment } from "./scorers/tempo-lead.mjs";
import {
  candidateMlBlendWeight,
  fusionReasonSuffix,
  resolveMlFusionMode,
} from "./ml-fusion.mjs";
import {
  principleMlVetoFactor,
  scoreCandidateByPrinciples,
  isBombOnlyBeatContext,
  shouldReservePureBombEarly,
  shouldVetoBombOnlyPass,
  breaksPremiumStraightOrJokerGroup,
} from "./principles.mjs";
import {
  allowMustBeatPremiumLooseSingle,
  demotePlateBreakingTriplesOnOpening,
  pickCompliantTopRecommendation,
} from "./recommendation-guards.mjs";
import {
  assertTop1DoctrineCompliance,
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
import { inferLeadMode } from "./lead-mode.mjs";
import { buildStrategicGroups } from "./strategic-groups.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

/** 须压且仅炸弹可跟时，该炸弹为必出选项（不因拆保留同花顺/王炸而被候选池滤掉） */
export function isMandatoryBombCandidate(candidate, hand, levelRank, tableContext, previousPlay = null) {
  if (!candidate || !BOMB_TYPES.has(candidate.type)) return false;
  const prev = previousPlay ?? tableContext.previousPlay ?? null;
  if (!prev || !canBeat(candidate, prev)) return false;
  const ctx = { ...tableContext, hand, previousPlay: prev };
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
    const groupKeys = groupCards.map(cardKey);
    const usedCount = groupKeys.filter((key) => candidateKeys.has(key)).length;
    if (usedCount > 0 && usedCount < groupKeys.length) return true;
    if (usedCount === groupKeys.length && candidate.cards.length !== groupKeys.length) return true;
  }
  return false;
}

export function candidatesFromPreferredGroups(preferredGroups = [], levelRank, previousPlay = null) {
  const results = [];
  for (const group of preferredGroups) {
    const cards = group.cards ?? group;
    if (!Array.isArray(cards) || cards.length === 0) continue;
    const play = classifyPlay(cards, levelRank);
    if (play.type === PLAY_TYPES.invalid || play.type === PLAY_TYPES.pass) continue;
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

function isActionableCandidate(candidate, hand, levelRank, tableContext) {
  if (!candidate || candidate.type === PLAY_TYPES.pass) return false;
  const finishing = candidate.cards?.length === hand.length;
  if (!finishing && breaksBombIntegrity(candidate, hand, levelRank, tableContext)) return false;
  if (breaksCriticalPreferredGroup(candidate, tableContext.preferredGroups, levelRank, hand)) return false;
  return true;
}

export function hasActionableRegularBeater(candidates, hand, levelRank, tableContext) {
  const previousPlay = tableContext.previousPlay ?? null;
  const mustBeat = previousPlay && previousPlay.type !== PLAY_TYPES.pass;
  return candidates.some(
    (candidate) => candidate.type !== PLAY_TYPES.pass
      && !BOMB_TYPES.has(candidate.type)
      && (!mustBeat || canBeat(candidate, previousPlay))
      && isActionableCandidate(candidate, hand, levelRank, tableContext),
  );
}

export function scoreCandidate(candidate, hand, levelRank, previousPlay = null, tableContext = {}) {
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
    let passScore = ctx.partnerOwnsTrick ? -2400 : 700;
    if (canFinish) {
      passScore = 12_800;
      reasons.push("能走完先走完，不必让队友");
    } else if (ctx.partnerOwnsTrick) {
      reasons.push("队友占牌，正常让牌");
    }
    passScore += pressure.score;
    reasons.push(...pressure.reasons);
    const principles = scoreCandidateByPrinciples(candidate, hand, levelRank, { ...ctx, hand });
    passScore += principles.score;
    reasons.push(...principles.reasons);
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

/** 评分前裁剪候选：保留过牌、最小可压牌与炸弹，避免全量候选阻塞主线程 */
export function trimCandidatesForScoring(candidates, maxCandidates, hand, levelRank, previousPlay, tableContext) {
  if (!maxCandidates || candidates.length <= maxCandidates) return candidates;
  const picked = [];
  const seen = new Set();
  const push = (candidate) => {
    const key = candidate.type === PLAY_TYPES.pass
      ? "pass"
      : `${candidate.type}:${candidate.mainRank ?? ""}:${candidate.length ?? 0}:${candidate.bombSize ?? 0}`;
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
  const bombs = candidates
    .filter((c) => BOMB_TYPES.has(c.type))
    .sort((left, right) => left.power - right.power);
  const regularCandidates = candidates
    .filter((candidate) => candidate.type !== PLAY_TYPES.pass && !BOMB_TYPES.has(candidate.type))
    .filter((candidate) => !mustBeat || canBeat(candidate, previousPlay))
    .filter((candidate) => isActionableCandidate(candidate, hand, levelRank, tableContext))
    .sort((left, right) => (right.length ?? right.cards?.length ?? 0) - (left.length ?? left.cards?.length ?? 0)
      || left.power - right.power
      || left.length - right.length);

  // 须压四炸时先锁够压炸弹，避免 lite 被开局候选挤满后只剩同花顺
  if (mustBeat?.type === PLAY_TYPES.bomb) {
    for (const candidate of bombs) {
      if (candidate.type !== PLAY_TYPES.bomb || !canBeat(candidate, mustBeat)) continue;
      push(candidate);
      if (picked.length >= maxCandidates) break;
    }
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
    // 真开局：先锁普通成组路线，避免炸弹占满 lite 候选池后只剩同花顺空炸
    const bombBudget = Math.max(2, Math.floor(maxCandidates * 0.25));
    const regularBudget = maxCandidates - bombBudget;
    for (const candidate of regularCandidates) {
      if (picked.length >= regularBudget) break;
      push(candidate);
    }
    for (const candidate of bombs) {
      if (picked.length >= maxCandidates) break;
      push(candidate);
    }
  } else {
    for (const candidate of bombs) {
      if (picked.length >= maxCandidates) break;
      push(candidate);
    }
    for (const candidate of regularCandidates) {
      if (picked.length >= maxCandidates) break;
      push(candidate);
    }
  }

  for (const candidate of candidates) {
    if (picked.length >= maxCandidates) break;
    if (candidate.type === PLAY_TYPES.pass || BOMB_TYPES.has(candidate.type)) continue;
    push(candidate);
  }

  for (const candidate of candidates) {
    if (picked.length >= maxCandidates) break;
    if (candidate.type === PLAY_TYPES.pass || BOMB_TYPES.has(candidate.type)) continue;
    push(candidate);
  }
  return picked;
}

/** 单一真相源：人类教练 / 机器人 / 审计共用同一套评分与 Top1 选取 */
export function computeRecommendations(hand, levelRank, previousPlay = null, tableContext = {}) {
  const litePath = tableContext.lite === true || tableContext.scoringAudience === "robot";
  const preferredGroups = (tableContext.preferredGroups?.length ?? 0) > 0
    ? tableContext.preferredGroups
    : (litePath ? [] : buildStrategicGroups(hand, levelRank));
  const handProfile = tableContext.handProfile !== undefined
    ? tableContext.handProfile
    : evaluateHandProfile(hand, levelRank, { preferredGroups });
  const ctx = {
    ...tableContext,
    preferredGroups,
    handProfile,
  };

  let candidates = generateBasicCandidates(hand, levelRank, previousPlay);
  if (preferredGroups.length > 0) {
    candidates.push(...candidatesFromPreferredGroups(preferredGroups, levelRank, previousPlay));
  }
  if (previousPlay && previousPlay.type !== PLAY_TYPES.pass) {
    candidates.push(classifyPlay([], levelRank));
  }
  candidates = trimCandidatesForScoring(
    candidates,
    ctx.maxCandidates,
    hand,
    levelRank,
    previousPlay,
    ctx,
  );

  const scoringContext = {
    ...enrichScoringContext({ ...ctx, previousPlay }, candidates, hand, levelRank),
    _candidates: candidates,
    hasAnyWinner: candidates.some((c) => c.type !== PLAY_TYPES.pass),
    hasRegularWinner: candidates.some((c) => c.type !== PLAY_TYPES.pass && !BOMB_TYPES.has(c.type)),
    hasActionableRegularWinner: hasActionableRegularBeater(candidates, hand, levelRank, ctx),
    bombInventory: evaluateBombInventory(hand, levelRank),
  };

  if (candidates.length === 0) {
    return {
      candidate: classifyPlay([], levelRank),
      score: 0,
      reasons: ["没有合法出牌"],
    };
  }

  const scored = candidates
    .map((candidate) => scoreCandidate(candidate, hand, levelRank, previousPlay, scoringContext))
    .filter((item) => isMandatoryBombCandidate(item.candidate, hand, levelRank, scoringContext, previousPlay)
      || allowMustBeatPremiumLooseSingle(item.candidate, hand, levelRank, previousPlay, scoringContext, preferredGroups)
      || !breaksPremiumStraightOrJokerGroup(item.candidate, preferredGroups, levelRank))
    .filter((item) => isMandatoryBombCandidate(item.candidate, hand, levelRank, scoringContext, previousPlay)
      || allowMustBeatPremiumLooseSingle(item.candidate, hand, levelRank, previousPlay, scoringContext, preferredGroups)
      || !breaksCriticalPreferredGroup(item.candidate, preferredGroups, levelRank, hand))
    .filter((item) => {
      const finishing = item.candidate.cards?.length === hand.length;
      return finishing || !breaksBombIntegrity(item.candidate, hand, levelRank, scoringContext);
    });

  let pool = scored.length > 0 ? scored : candidates.map((candidate) => scoreCandidate(candidate, hand, levelRank, previousPlay, scoringContext));

  const state = ctx.state;
  const playerIndex = ctx.playerIndex ?? state?.currentPlayerIndex;

  const preEnforce = enforceDoctrineOnCandidates(pool, {
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

  const postEnforce = enforceDoctrineOnCandidates(pool, {
    ...scoringContext,
    hand,
    levelRank,
    playerIndex,
  });
  pool = postEnforce.candidates;

  const scoredPool = [...pool, ...(postEnforce.blockedCandidates ?? [])];
  let top = pickCompliantTopRecommendation(scoredPool, hand, scoringContext, levelRank) ?? pool[0];
  if (top) {
    top.reasons = alignReasonsForPlay(top.reasons, top.candidate, { previousPlay });
    if (mlModel) {
      const fusionNote = fusionReasonSuffix(scoringContext, fusionMode);
      top.reasons = [
        ...top.reasons,
        fusionNote ?? "已融合 ML 策略模型（policy-v001）",
      ];
    }
    top.doctrineViolations = top.doctrineViolations ?? [];
  }
  return {
    top,
    pool: scoredPool,
    scoringContext,
    blockedCandidates: postEnforce.blockedCandidates ?? [],
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
