import { playCards, effectivePreviousPlay, repairTurnStuck } from "../engine/game-state.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { canBeat } from "../engine/compare-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { evaluateHandProfile } from "../strategy/hand-profile.mjs";
import {
  analyzeMustBeatSingleContext,
  analyzeMustBeatPairContext,
  breaksPreferredStrategicGroup,
  pickStructureSafeEmergencyCandidate,
  pickOpeningLeadFallback,
  pickPartnerAwareEmergencyCandidate,
  filterBareLevelRankPairLeads,
  requiresBombForPairBeat,
  pickMinStructureBombBeater,
} from "../strategy/principles.mjs";
import { partnerPlayedInCurrentRound, shouldYieldPassToPartner, shouldRobotYieldPassToPartner, enrichScoringContext } from "../strategy/table-context.mjs";
import { isWildLowValueBeat, shouldReserveStructureForRoutineBeat, shouldReserveWildForSmallRoutineBeat } from "../strategy/wild-doctrine.mjs";
import { shouldYieldPassAfterPartnerLeadOnOpponentBomb } from "../strategy/principles.mjs";
import { inferLeadMode } from "../strategy/lead-mode.mjs";
import { pickC100MustBeatSingleBeater, pickC100MustBeatConsecutivePairsBeater, pickC100MustBeatTripleWithPairBeater } from "../strategy/guandan-100cases-principles.mjs";
import { pickMinStructureSafeTripleWithPairBeater, pickMustBeatFinishingCandidate, recommendPlay } from "../strategy/recommend.mjs";
import { buildStrategicGroups, mergePremiumStrategicGroups } from "../strategy/strategic-groups.mjs";
import { breaksBombIntegrity, isStructureBreakingRoutineBeat } from "../strategy/scorers/structure.mjs";
import {
  breaksStraightFlushRunwayOnMustBeatPair,
  breaksStraightFlushRunwayOnMustBeatCp,
  mustBeatCpSfRunwayPrinciplesPenalty,
  mustBeatPairSfRunwayPrinciplesPenalty,
} from "../strategy/sf-runway-guard.mjs";
import { filterHardInvariants } from "../strategy/hard-invariants.mjs";
import { detectDoctrineViolations } from "../strategy/doctrine-enforce.mjs";

/** 应急兜底：教纲 blockTop1 候选不可用（如 7788 非合法连对时不应 333+55） */
function isDoctrineBlockedLead(candidate, hand, levelRank, previousPlay, tableContext = {}) {
  if (!candidate || candidate.type === PLAY_TYPES.pass) return false;
  const pool = generateBasicCandidates(hand, levelRank, previousPlay, { lite: true, emergency: true });
  const mustLead = !previousPlay || previousPlay.type === PLAY_TYPES.pass;
  const ctx = enrichScoringContext(
    {
      ...tableContext,
      previousPlay,
      hand,
      isOpening: mustLead,
      leadMode: mustLead
        ? "fresh-open"
        : (tableContext.leadMode ?? inferLeadMode(tableContext.state, tableContext.playerIndex ?? 0)),
    },
    pool,
    hand,
    levelRank,
  );
  ctx._candidates = pool;
  return detectDoctrineViolations(candidate, hand, levelRank, ctx).some((v) => v.blockTop1);
}

/** 机器人 lite 候选池上限（须压炸弹等复杂局面仍须快） */
export const ROBOT_LITE_MAX_CANDIDATES = 6;

/** 单步硬截止（ms）；超时走 emergency 兜底，避免主线程长时间阻塞 */
export const ROBOT_STEP_DEADLINE_MS = 2500;

/** 机器人墙钟预算（ms）：须压钢板等场景主线程不可超 400ms */
export const ROBOT_WALL_BUDGET_MS = 400;

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

function humanEmergencyReasons(reasons) {
  return reasons.map((reason) => reason.replace(/^计算超时，/, "临时建议："));
}

function partnerAwareEmergencyPick(hand, levelRank, previousPlay, pool, tableContext, preferredGroups) {
  const picked = pickPartnerAwareEmergencyCandidate(
    hand,
    levelRank,
    previousPlay,
    pool,
    tableContext,
    preferredGroups,
  );
  if (!picked) return null;
  return {
    candidate: picked.candidate,
    score: 0,
    reasons: humanEmergencyReasons(picked.reasons),
  };
}

function openingLikeLead(tableContext, mustLead) {
  if (!mustLead || !tableContext.state) return false;
  const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex ?? 0;
  const leadMode = inferLeadMode(tableContext.state, playerIndex);
  return leadMode === "fresh-open" || leadMode === "catch-wind";
}

function filterOpeningWildLow(candidates, levelRank, tableContext, mustLead) {
  if (!openingLikeLead(tableContext, mustLead)) return candidates;
  const safe = candidates.filter((c) => c.type !== PLAY_TYPES.pass && !isWildLowValueBeat(c, levelRank));
  return safe.length > 0 ? safe : candidates;
}

/** 开局/接风：中局（>7 张）不宜空炸/同花顺领出（与 P5 教纲对称） */
function filterOpeningEmptyBomb(candidates, hand, tableContext, mustLead) {
  if (!openingLikeLead(tableContext, mustLead)) return candidates;
  const handLen = hand?.length ?? tableContext.hand?.length ?? 0;
  if (handLen <= 7 || handLen === 0) return candidates;
  const safe = candidates.filter(
    (c) => c.type !== PLAY_TYPES.pass
      && !(BOMB_TYPES.has(c.type) && (c.cards?.length ?? 0) < handLen),
  );
  return safe.length > 0 ? safe : candidates;
}

function filterOpeningLeadCandidates(candidates, hand, levelRank, tableContext, mustLead) {
  let pool = filterOpeningEmptyBomb(
    filterOpeningWildLow(candidates, levelRank, tableContext, mustLead),
    hand,
    tableContext,
    mustLead,
  );
  pool = filterBareLevelRankPairLeads(pool, hand, levelRank, candidates);
  return pool;
}

function buildConstantTimeFallbackCandidates(hand, levelRank) {
  const candidates = hand.map((card) => classifyPlay([card], levelRank));
  const byRank = new Map();
  for (const card of hand) {
    const group = byRank.get(card.rank) ?? [];
    group.push(card);
    byRank.set(card.rank, group);
  }
  for (const group of byRank.values()) {
    if (group.length >= 2) candidates.push(classifyPlay(group.slice(0, 2), levelRank));
    if (group.length >= 3) candidates.push(classifyPlay(group.slice(0, 3), levelRank));
    if (group.length >= 4) candidates.push(classifyPlay(group.slice(0, 4), levelRank));
  }
  return candidates.filter((candidate) => candidate.type !== PLAY_TYPES.pass);
}

function constantTimeRobotFallback(hand, levelRank, previousPlay, tableContext = {}) {
  const mustLead = !previousPlay || previousPlay.type === PLAY_TYPES.pass;
  const ctx = { ...tableContext, previousPlay, hand };
  const preferredGroups = mustLead
    ? buildStrategicGroups(hand, levelRank, { skipStraightFlush: true })
    : [];
  const groupCandidates = preferredGroups
    .map((group) => group.play ?? classifyPlay(group.cards ?? group, levelRank))
    .filter((candidate) => candidate?.type && candidate.type !== PLAY_TYPES.pass);
  const safe = filterHardInvariants(
    [...buildConstantTimeFallbackCandidates(hand, levelRank), ...groupCandidates],
    hand,
    levelRank,
    ctx,
  ).filter((candidate) => mustLead || canBeat(candidate, previousPlay));
  if (mustLead) {
    const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex ?? 0;
    const leadMode = tableContext.state
      ? inferLeadMode(tableContext.state, playerIndex)
      : "catch-wind";
    const leadCtx = {
      ...ctx,
      playerIndex,
      preferredGroups,
      isOpening: true,
      leadMode,
    };
    const structureSafe = safe.filter(
      (candidate) => !breaksPreferredStrategicGroup(
        candidate,
        preferredGroups,
        levelRank,
        hand,
        leadCtx,
      ),
    );
    const leadPool = filterOpeningLeadCandidates(
      structureSafe,
      hand,
      levelRank,
      leadCtx,
      true,
    );
    const picked = pickOpeningLeadFallback(
      hand,
      levelRank,
      leadPool,
      preferredGroups,
      leadCtx,
    );
    if (picked) {
      return {
        candidate: picked,
        score: 0,
        reasons: ["超时兜底：结构安全领出"],
      };
    }
  }
  safe.sort((left, right) => {
    const leftBomb = BOMB_TYPES.has(left.type) ? 1 : 0;
    const rightBomb = BOMB_TYPES.has(right.type) ? 1 : 0;
    return leftBomb - rightBomb || left.power - right.power;
  });
  return {
    candidate: safe[0] ?? classifyPlay([], levelRank),
    score: 0,
    reasons: [safe.length > 0 ? "超时兜底：常数时间安全出牌" : "超时兜底：无安全牌可压，过牌"],
  };
}

/**
 * 毫秒级兜底：过牌或取首个可压合法牌，不跑完整评分链。
 */
function buildFastRobotFallback(hand, levelRank, previousPlay, tableContext = {}) {
  const passPlay = classifyPlay([], levelRank);
  const mustLead = !previousPlay || previousPlay.type === PLAY_TYPES.pass;
  const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex;
  const enrichedCtx = enrichScoringContext(
    { ...tableContext, previousPlay, hand, playerIndex },
    [],
    hand,
    levelRank,
  );

  if (!mustLead && enrichedCtx.partnerOwnsTrick && shouldRobotYieldPassToPartner({ ...enrichedCtx, hand })) {
    return {
      candidate: passPlay,
      score: 0,
      reasons: ["兜底：队友占牌，过牌让权"],
    };
  }

  enrichedCtx._candidates = [];

  const fallbackAbortAt = performance.now() + 25;
  const candidates = generateBasicCandidates(hand, levelRank, previousPlay, {
    lite: true,
    emergency: true,
    robotFast: true,
    abortCheck: () => performance.now() > fallbackAbortAt,
  });
  enrichedCtx._candidates = candidates;

  if (
    shouldYieldPassAfterPartnerLeadOnOpponentBomb(enrichedCtx, hand, previousPlay)
  ) {
    return {
      candidate: passPlay,
      score: 0,
      reasons: ["兜底：队友本墩已出牌，不宜叠炸"],
    };
  }

  const reserveWild = previousPlay
    && shouldReserveWildForSmallRoutineBeat(
      { ...tableContext, opponentActive: true, previousPlay },
      hand,
      previousPlay,
      levelRank,
    );

  const pickBeater = (beaters) => {
    const filtered = beaters.filter((c) => !(reserveWild && isWildLowValueBeat(c, levelRank)));
    if (filtered.length > 0) return filtered[0];
    if (reserveWild) return null;
    return beaters[0] ?? null;
  };

  if (mustLead) {
    let active = filterOpeningLeadCandidates(
      candidates.filter((c) => c.type !== PLAY_TYPES.pass),
      hand,
      levelRank,
      enrichedCtx,
      true,
    );
    if (active.length === 0) {
      active = filterHardInvariants(
        buildConstantTimeFallbackCandidates(hand, levelRank),
        hand,
        levelRank,
        enrichedCtx,
      );
    }
    const picked = pickOpeningLeadFallback(hand, levelRank, active, [], {
      ...enrichedCtx,
      isOpening: true,
      hand,
      playerIndex,
      _candidates: candidates,
    });
    if (picked) {
      return {
        candidate: picked,
        score: 0,
        reasons: ["超时兜底：同源原则领出"],
      };
    }
  } else {
    let beaters = candidates.filter(
      (c) => c.type !== PLAY_TYPES.pass
        && canBeat(c, previousPlay)
        && !breaksBombIntegrity(c, hand, levelRank, enrichedCtx)
        && !breaksPreferredStrategicGroup(c, [], levelRank, hand, enrichedCtx),
    );
    if (enrichedCtx.partnerOwnsTrick) {
      beaters = beaters.filter((c) => !BOMB_TYPES.has(c.type));
    }
    const regularBeaters = beaters.filter((c) => !BOMB_TYPES.has(c.type));
    const picked = pickBeater(regularBeaters) ?? pickBeater(beaters);
    if (picked) {
      return {
        candidate: picked,
        score: 0,
        reasons: ["超时兜底：取首个可压牌"],
      };
    }
    if (reserveWild && beaters.length > 0) {
      return {
        candidate: passPlay,
        score: 0,
        reasons: ["超时兜底：保留逢人配，过牌"],
      };
    }
  }

  return {
    candidate: passPlay,
    score: 0,
    reasons: ["超时兜底：过牌"],
  };
}

export function fastRobotFallback(hand, levelRank, previousPlay, tableContext = {}) {
  const result = buildFastRobotFallback(hand, levelRank, previousPlay, tableContext);
  const ctx = { ...tableContext, previousPlay, hand };
  const mustLead = !previousPlay || previousPlay.type === PLAY_TYPES.pass;
  if (
    (!mustLead || result?.candidate?.type !== PLAY_TYPES.pass)
    && filterHardInvariants(result?.candidate ? [result.candidate] : [], hand, levelRank, ctx).length > 0
  ) {
    return result;
  }
  if (mustLead) {
    const fallbackAbortAt = performance.now() + 25;
    const safePool = filterHardInvariants(
      [
        ...generateBasicCandidates(hand, levelRank, previousPlay, {
          lite: true,
          emergency: true,
          robotFast: true,
          abortCheck: () => performance.now() > fallbackAbortAt,
        }),
        ...buildConstantTimeFallbackCandidates(hand, levelRank),
      ],
      hand,
      levelRank,
      ctx,
    ).filter((candidate) => candidate.type !== PLAY_TYPES.pass);
    const candidate = pickOpeningLeadFallback(hand, levelRank, safePool, [], ctx) ?? safePool[0];
    if (candidate) {
      return { candidate, score: 0, reasons: ["兜底：硬不变量安全领出"] };
    }
  }
  return {
    candidate: classifyPlay([], levelRank),
    score: 0,
    reasons: ["兜底：硬不变量拦截，过牌"],
  };
}

function premiumSafeEmergencyPick(hand, levelRank, previousPlay, preferredGroups, tableContext = {}) {
  const passPlay = classifyPlay([], levelRank);
  const mustLead = !previousPlay || previousPlay.type === PLAY_TYPES.pass;
  const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex;
  const yieldCtx = enrichScoringContext(
    { ...tableContext, previousPlay, hand, playerIndex },
    [],
    hand,
    levelRank,
  );
  if (!mustLead && yieldCtx.partnerOwnsTrick && shouldYieldPassToPartner({ ...yieldCtx, hand })) {
    return {
      candidate: passPlay,
      score: 0,
      reasons: ["临时建议：队友占牌，过牌"],
    };
  }
  const pool = filterOpeningLeadCandidates(
    generateBasicCandidates(hand, levelRank, previousPlay, { lite: true, emergency: true })
      .filter((candidate) => {
        if (candidate.type === PLAY_TYPES.pass) return false;
        if (breaksPreferredStrategicGroup(candidate, preferredGroups, levelRank, hand)) return false;
        if (!mustLead && !canBeat(candidate, previousPlay)) return false;
        return true;
      }),
    hand,
    levelRank,
    tableContext,
    mustLead,
  );
  const partnerPick = partnerAwareEmergencyPick(
    hand,
    levelRank,
    previousPlay,
    pool,
    tableContext,
    preferredGroups,
  );
  if (partnerPick) return partnerPick;
  const picked = mustLead
    ? pickOpeningLeadFallback(hand, levelRank, pool, preferredGroups, tableContext)
    : pool[0];
  if (picked) {
    return {
      candidate: picked,
      score: 0,
      reasons: ["临时建议：不拆成组结构"],
    };
  }
  if (mustLead) {
    const extra = generateBasicCandidates(hand, levelRank, previousPlay, { lite: true, emergency: true })
      .filter((candidate) => candidate.type !== PLAY_TYPES.pass);
    const lead = pickOpeningLeadFallback(hand, levelRank, extra, preferredGroups, tableContext);
    if (lead) {
      return {
        candidate: lead,
        score: 0,
        reasons: ["临时建议：领出兜底"],
      };
    }
    return null;
  }
  return {
    candidate: passPlay,
    score: 0,
    reasons: ["临时建议：过牌"],
  };
}

/**
 * 人类教练应急兜底：优先不拆同花顺/王炸，压单时走 P1 散单逻辑。
 */
function buildHumanAdviceFallback(hand, levelRank, previousPlay, preferredGroupsInput = null, tableContext = {}) {
  const passPlay = classifyPlay([], levelRank);
  const mustLead = !previousPlay || previousPlay.type === PLAY_TYPES.pass;

  const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex;
  const yieldCtx = enrichScoringContext(
    { ...tableContext, previousPlay, hand, playerIndex },
    [],
    hand,
    levelRank,
  );
  if (!mustLead && yieldCtx.partnerOwnsTrick && shouldYieldPassToPartner({ ...yieldCtx, hand })) {
    return {
      candidate: passPlay,
      score: 0,
      reasons: ["临时建议：队友占牌，过牌让权"],
    };
  }

  const litePath = tableContext.lite === true || tableContext.scoringAudience === "human-lite";
  let preferredGroups;
  if (litePath) {
    preferredGroups = preferredGroupsInput?.length ? preferredGroupsInput : [];
  } else {
    const structuralGroups = buildStrategicGroups(hand, levelRank, { skipStraightFlush: true });
    preferredGroups = preferredGroupsInput?.length
      ? mergePremiumStrategicGroups(preferredGroupsInput, hand, levelRank, structuralGroups)
      : buildStrategicGroups(hand, levelRank);
  }

  const candidates = generateBasicCandidates(hand, levelRank, previousPlay, {
    lite: true,
    emergency: true,
  });

  if (!mustLead) {
    const finishing = pickMustBeatFinishingCandidate(candidates, hand, previousPlay);
    if (finishing) {
      return {
        candidate: finishing,
        score: 0,
        reasons: [
          finishing.type === PLAY_TYPES.straightFlush
            ? "临时建议：同花顺一手走完，队友可接风"
            : "临时建议：一手走完夺权",
        ],
      };
    }
  }

  const partnerPick = partnerAwareEmergencyPick(
    hand,
    levelRank,
    previousPlay,
    candidates,
    { ...tableContext, playerIndex },
    preferredGroups,
  );
  if (partnerPick) return partnerPick;

  const withoutStructureBreak = (list) => list.filter(
    (item) => !breaksPreferredStrategicGroup(item, preferredGroups, levelRank, hand),
  );

  if (mustLead) {
    const active = candidates.filter((item) => item.type !== PLAY_TYPES.pass);
    const picked = pickOpeningLeadFallback(hand, levelRank, active, preferredGroups, tableContext);
    if (picked) {
      return {
        candidate: picked,
        score: 0,
        reasons: ["临时建议：优先不拆成组结构"],
      };
    }
  } else if (previousPlay.type === PLAY_TYPES.single) {
    const c100Single = pickC100MustBeatSingleBeater(hand, levelRank, previousPlay, candidates);
    if (c100Single) {
      return {
        candidate: c100Single,
        score: 0,
        reasons: ["临时建议：百例顺压重组，不拆炸弹"],
      };
    }
    const beatCtx = enrichScoringContext(
      { ...tableContext, previousPlay, hand, playerIndex, preferredGroups },
      candidates,
      hand,
      levelRank,
    );
    const reserveStructure = shouldReserveStructureForRoutineBeat(
      beatCtx,
      hand,
      previousPlay,
      levelRank,
    );
    const singleCtx = { _candidates: candidates, preferredGroups, previousPlay };
    const ctx = analyzeMustBeatSingleContext(hand, levelRank, previousPlay, singleCtx);
    const structureFilter = (list) => (reserveStructure
      ? list.filter((item) => !isStructureBreakingRoutineBeat(item, hand, levelRank, preferredGroups))
      : list);
    const pool = structureFilter(
      ctx.playableLooseBeaters.length > 0
        ? ctx.playableLooseBeaters
        : ctx.safeLooseBeaters.length > 0
          ? ctx.safeLooseBeaters
          : withoutStructureBreak(
            candidates.filter((item) => item.type !== PLAY_TYPES.pass && canBeat(item, previousPlay)),
          ),
    );
    if (pool.length > 0) {
      const best = pool.reduce((left, right) => (left.power <= right.power ? left : right));
      return {
        candidate: best,
        score: 0,
        reasons: ["临时建议：散单压牌，不拆成组结构"],
      };
    }
  } else if (previousPlay.type === PLAY_TYPES.pair) {
    const pairBeatCtx = enrichScoringContext(
      { ...tableContext, previousPlay, hand, playerIndex, preferredGroups },
      candidates,
      hand,
      levelRank,
    );
    const pairCtx = analyzeMustBeatPairContext(hand, levelRank, previousPlay, {
      ...pairBeatCtx,
      previousPlay,
      _candidates: candidates,
      preferredGroups,
    });
    const reserveStructure = shouldReserveStructureForRoutineBeat(
      pairBeatCtx,
      hand,
      previousPlay,
      levelRank,
    );
    const pairABeater = previousPlay.mainRank === "K"
      ? candidates
        .filter((item) => item.type === PLAY_TYPES.pair && item.mainRank === "A" && canBeat(item, previousPlay))
        .reduce((best, item) => (!best || item.power < best.power ? item : best), null)
      : null;
    if (pairABeater) {
      return {
        candidate: pairABeater,
        score: 0,
        reasons: ["对K须压：散对A管牌"],
      };
    }
    const structureSafePool = pairCtx.structureSafeDedicated?.length > 0
      ? pairCtx.structureSafeDedicated
      : pairCtx.structureSafeWholePairBeaters?.length > 0
        ? pairCtx.structureSafeWholePairBeaters
        : [];
    let minPair = structureSafePool.length > 0
      ? structureSafePool.reduce(
        (best, item) => (!best || item.power < best.power ? item : best),
        null,
      )
      : null;
    if (!minPair && pairCtx.dedicatedPairBeaters?.length > 0) {
      const dedicatedSafe = pairCtx.dedicatedPairBeaters.filter(
        (item) => !breaksStraightFlushRunwayOnMustBeatPair(item, hand, levelRank, pairBeatCtx),
      );
      if (dedicatedSafe.length > 0) {
        minPair = dedicatedSafe.reduce(
          (best, item) => (!best || item.power < best.power ? item : best),
          null,
        );
      }
    }
    if (!minPair && !reserveStructure && pairCtx.hasWholePairBeater) {
      const runwaySafe = pairCtx.wholePairBeaters.filter(
        (item) => !breaksStraightFlushRunwayOnMustBeatPair(item, hand, levelRank, pairBeatCtx),
      );
      if (runwaySafe.length > 0) {
        minPair = runwaySafe.reduce(
          (best, item) => (!best || item.power < best.power ? item : best),
          null,
        );
      }
    }
    if (minPair) {
      return {
        candidate: minPair,
        score: 0,
        reasons: ["临时建议：最小整对压牌，不拆同花顺"],
      };
    }
    const anyPairBeater = candidates.filter(
      (item) => item.type === PLAY_TYPES.pair && canBeat(item, previousPlay),
    );
    if (anyPairBeater.length > 0) {
      const penalty = mustBeatPairSfRunwayPrinciplesPenalty(anyPairBeater[0], hand, levelRank, pairBeatCtx);
      return {
        candidate: passPlay,
        score: 0,
        reasons: humanEmergencyReasons([
          penalty?.reason ?? "【P1】不宜拆同花顺组对压牌，宜过牌保留同花顺",
        ]),
      };
    }
    if (pairCtx.hasWholePairBeater && !pairCtx.hasStructureSafeWholePairBeater && !pairCtx.dedicatedPairBeaters?.length) {
      return {
        candidate: passPlay,
        score: 0,
        reasons: ["临时建议：无结构安全对可压，宜过牌保同花顺"],
      };
    }
    if (requiresBombForPairBeat(hand, levelRank, previousPlay, {
      ...yieldCtx,
      _candidates: candidates,
    })) {
      const minBomb = pickMinStructureBombBeater(hand, levelRank, previousPlay, {
        ...yieldCtx,
        _candidates: candidates,
      });
      if (minBomb?.type === PLAY_TYPES.bomb) {
        return {
          candidate: minBomb,
          score: 0,
          reasons: ["临时建议：最小炸弹压级牌对"],
        };
      }
      return {
        candidate: passPlay,
        score: 0,
        reasons: ["临时建议：无对可压且不宜亮同花顺，宜过牌"],
      };
    }
  } else if (previousPlay.type === PLAY_TYPES.tripleWithPair) {
    const twpBeatCtx = enrichScoringContext(
      { ...tableContext, previousPlay, hand, playerIndex, preferredGroups, _candidates: candidates },
      candidates,
      hand,
      levelRank,
    );
    const c100Twp = pickC100MustBeatTripleWithPairBeater(
      hand,
      levelRank,
      previousPlay,
      candidates,
      twpBeatCtx,
    );
    if (c100Twp) {
      return {
        candidate: c100Twp,
        score: 0,
        reasons: ["临时建议：百例三带二管牌，KKK22 优于透支"],
      };
    }
    // 毫秒兜底：不跑 analyzeMustBeatTripleWithPairContext 全量 beaters（可上百个），直接 directNatural 轻量挑选
    const minTwp = pickMinStructureSafeTripleWithPairBeater(
      {
        beaters: [],
        structureSafeBeaters: [],
        hasStructureSafeBeater: false,
      },
      levelRank,
      hand,
      {
        ...tableContext,
        previousPlay,
        preferredGroups,
        lite: true,
        scoringAudience: "human-lite",
      },
    );
    if (minTwp) {
      return {
        candidate: minTwp,
        score: 0,
        reasons: ["临时建议：最小不拆同花顺跑道三带二"],
      };
    }
    return {
      candidate: passPlay,
      score: 0,
      reasons: ["临时建议：无结构安全三带二可压，宜过牌保留同花顺"],
    };
  } else if (previousPlay.type === PLAY_TYPES.consecutivePairs) {
    const cpBeatCtx = enrichScoringContext(
      { ...tableContext, previousPlay, hand, playerIndex, preferredGroups, _candidates: candidates },
      candidates,
      hand,
      levelRank,
    );
    const c100Cp = pickC100MustBeatConsecutivePairsBeater(
      hand,
      levelRank,
      previousPlay,
      candidates,
      cpBeatCtx,
    );
    if (c100Cp) {
      return {
        candidate: c100Cp,
        score: 0,
        reasons: ["临时建议：百例连对管牌，667788 优于开炸"],
      };
    }
    const cpBeaters = candidates.filter(
      (item) => item.type === PLAY_TYPES.consecutivePairs && canBeat(item, previousPlay),
    );
    const safeCpBeaters = cpBeaters.filter(
      (item) => !breaksStraightFlushRunwayOnMustBeatCp(item, hand, levelRank, cpBeatCtx),
    );
    if (safeCpBeaters.length > 0) {
      const best = safeCpBeaters.reduce(
        (left, right) => (left.power <= right.power ? left : right),
      );
      return {
        candidate: best,
        score: 0,
        reasons: ["临时建议：最小连对管牌"],
      };
    }
    if (cpBeaters.length > 0) {
      const penalty = mustBeatCpSfRunwayPrinciplesPenalty(cpBeaters[0], hand, levelRank, cpBeatCtx);
      return {
        candidate: passPlay,
        score: 0,
        reasons: humanEmergencyReasons([
          penalty?.reason ?? "【P1】不宜拆同花顺连对压牌，宜过牌保留同花顺",
        ]),
      };
    }
  } else {
    const beaters = withoutStructureBreak(
      candidates.filter((item) => item.type !== PLAY_TYPES.pass && canBeat(item, previousPlay)),
    ).filter((item) => !yieldCtx.partnerOwnsTrick || !BOMB_TYPES.has(item.type));
    if (beaters.length > 0) {
      return {
        candidate: beaters[0],
        score: 0,
        reasons: ["临时建议：优先不拆成组结构"],
      };
    }
  }

  return premiumSafeEmergencyPick(hand, levelRank, previousPlay, preferredGroups, tableContext)
    ?? (mustLead
      ? (() => {
        const active = generateBasicCandidates(hand, levelRank, previousPlay, { lite: true, emergency: true })
          .filter((item) => item.type !== PLAY_TYPES.pass);
        const lead = pickOpeningLeadFallback(hand, levelRank, active, preferredGroups, tableContext);
        return lead
          ? { candidate: lead, score: 0, reasons: ["临时建议：领出兜底"] }
          : null;
      })()
      : null)
    ?? {
      candidate: passPlay,
      score: 0,
      reasons: ["临时建议：过牌"],
    };
}

export function humanAdviceFallback(hand, levelRank, previousPlay, preferredGroupsInput = null, tableContext = {}) {
  const result = buildHumanAdviceFallback(
    hand,
    levelRank,
    previousPlay,
    preferredGroupsInput,
    tableContext,
  );
  const ctx = { ...tableContext, previousPlay, hand };
  const c100Emergency = result?.reasons?.some((reason) => reason.includes("百例"));
  if (
    result?.candidate
    && result.candidate.type !== PLAY_TYPES.pass
    && !isDoctrineBlockedLead(result.candidate, hand, levelRank, previousPlay, tableContext)
    && (c100Emergency || filterHardInvariants([result.candidate], hand, levelRank, ctx).length > 0)
  ) {
    return result;
  }
  const mustLead = !previousPlay || previousPlay.type === PLAY_TYPES.pass;
  if (mustLead) {
    const safePool = filterHardInvariants(
      generateBasicCandidates(hand, levelRank, previousPlay, { lite: true, emergency: true }),
      hand,
      levelRank,
      ctx,
    ).filter((candidate) => candidate.type !== PLAY_TYPES.pass
      && !isDoctrineBlockedLead(candidate, hand, levelRank, previousPlay, tableContext));
    const candidate = pickOpeningLeadFallback(
      hand,
      levelRank,
      safePool,
      preferredGroupsInput ?? [],
      ctx,
    ) ?? safePool[0];
    if (candidate) {
      return { candidate, score: 0, reasons: ["临时建议：硬不变量安全领出"] };
    }
  }
  return {
    candidate: classifyPlay([], levelRank),
    score: 0,
    reasons: ["临时建议：硬不变量拦截，过牌"],
  };
}

export function playRecommendedTurn(state, {
  mlModel = null,
  mlFusionMode = "off",
  maxCandidates = ROBOT_LITE_MAX_CANDIDATES,
  preferredGroups: preferredGroupsInput,
  opponentPersona = null,
  lite = true,
  deadline = null,
} = {}) {
  const { state: normalized, repaired: windRepaired } = repairTurnStuck(state);
  const workingState = windRepaired ? normalized : state;
  const player = workingState.players[workingState.currentPlayerIndex];
  const previousPlay = effectivePreviousPlay(workingState);
  const preferredGroups = preferredGroupsInput ?? (lite ? [] : buildStrategicGroups(player.hand, state.levelRank));
  const handProfile = lite
    ? null
    : evaluateHandProfile(player.hand, state.levelRank, { preferredGroups });
  const stepDeadline = Math.min(
    deadline ?? (performance.now() + ROBOT_STEP_DEADLINE_MS),
    performance.now() + ROBOT_WALL_BUDGET_MS,
  );
  const tableContext = {
    state: workingState,
    playerIndex: workingState.currentPlayerIndex,
    lastActivePlayerIndex: workingState.lastActivePlayerIndex,
    preferredGroups,
    handProfile,
    previousPlay,
    opponentPersona,
    maxCandidates: lite ? maxCandidates : 96,
    scoringAudience: "robot",
    lite,
    mlModel,
    mlFusionMode,
    deadline: stepDeadline,
  };

  const started = performance.now();
  let recommendation;
  if (performance.now() > stepDeadline) {
    recommendation = constantTimeRobotFallback(player.hand, state.levelRank, previousPlay, tableContext);
  } else if (lite) {
    const yieldCtx = enrichScoringContext(
      { ...tableContext, hand: player.hand },
      [],
      player.hand,
      state.levelRank,
    );
    if (yieldCtx.partnerOwnsTrick && shouldRobotYieldPassToPartner(yieldCtx)) {
      recommendation = fastRobotFallback(
        player.hand,
        state.levelRank,
        previousPlay,
        { ...tableContext, ...yieldCtx },
      );
    } else {
      try {
        recommendation = recommendPlay(
          player.hand,
          state.levelRank,
          previousPlay,
          tableContext,
        );
      } catch (error) {
        console.warn("机器人推荐异常，走兜底", error);
        recommendation = fastRobotFallback(player.hand, state.levelRank, previousPlay, tableContext);
      }
    }
  } else {
    try {
      recommendation = recommendPlay(
        player.hand,
        state.levelRank,
        previousPlay,
        tableContext,
      );
    } catch (error) {
      console.warn("机器人推荐异常，走兜底", error);
      recommendation = fastRobotFallback(player.hand, state.levelRank, previousPlay, tableContext);
    }
  }

  const elapsed = performance.now() - started;
  const overBudget = performance.now() > stepDeadline;
  const weakRecommendation = !recommendation?.candidate
    || recommendation.reasons?.some((reason) => /计算超时|临时建议/.test(reason));
  if (overBudget && weakRecommendation) {
    console.warn(`机器人单步超 ${Math.round(elapsed)}ms，改用毫秒兜底`);
    recommendation = fastRobotFallback(player.hand, state.levelRank, previousPlay, tableContext);
  } else if (overBudget) {
    console.warn(`机器人单步超 ${Math.round(elapsed)}ms，保留已算推荐`);
  }

  return {
    state: playCards(workingState, recommendation.candidate.cards),
    recommendation,
  };
}
