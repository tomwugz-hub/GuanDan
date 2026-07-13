import { playCards, effectivePreviousPlay, repairTurnStuck } from "../engine/game-state.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { canBeat } from "../engine/compare-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { evaluateHandProfile } from "../strategy/hand-profile.mjs";
import {
  analyzeMustBeatSingleContext,
  analyzeMustBeatPairContext,
  analyzeMustBeatTripleWithPairContext,
  breaksPreferredStrategicGroup,
  pickStructureSafeEmergencyCandidate,
  pickPartnerAwareEmergencyCandidate,
  requiresBombForPairBeat,
  pickMinStructureBombBeater,
} from "../strategy/principles.mjs";
import { partnerPlayedInCurrentRound, shouldYieldPassToPartner, enrichScoringContext } from "../strategy/table-context.mjs";
import { isWildLowValueBeat, shouldReserveWildForSmallRoutineBeat } from "../strategy/wild-doctrine.mjs";
import { shouldYieldPassAfterPartnerLeadOnOpponentBomb } from "../strategy/principles.mjs";
import { inferLeadMode } from "../strategy/lead-mode.mjs";
import { pickMinStructureSafeTripleWithPairBeater, recommendPlay } from "../strategy/recommend.mjs";
import { buildStrategicGroups } from "../strategy/strategic-groups.mjs";
import { breaksBombIntegrity } from "../strategy/scorers/structure.mjs";

/** 机器人 lite 候选池上限（须压炸弹等复杂局面仍须快） */
export const ROBOT_LITE_MAX_CANDIDATES = 6;

/** 单步硬截止（ms）；超时走 emergency 兜底，避免主线程长时间阻塞 */
export const ROBOT_STEP_DEADLINE_MS = 2500;

/** 机器人墙钟预算（ms）：须压钢板等场景主线程不可超 800ms */
export const ROBOT_WALL_BUDGET_MS = 650;

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
  return filterOpeningEmptyBomb(
    filterOpeningWildLow(candidates, levelRank, tableContext, mustLead),
    hand,
    tableContext,
    mustLead,
  );
}

/**
 * 毫秒级兜底：过牌或取首个可压合法牌，不跑完整评分链。
 */
export function fastRobotFallback(hand, levelRank, previousPlay, tableContext = {}) {
  const passPlay = classifyPlay([], levelRank);
  const mustLead = !previousPlay || previousPlay.type === PLAY_TYPES.pass;
  const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex;
  const enrichedCtx = enrichScoringContext(
    { ...tableContext, previousPlay, hand, playerIndex },
    [],
    hand,
    levelRank,
  );

  if (!mustLead && enrichedCtx.partnerOwnsTrick && shouldYieldPassToPartner({ ...enrichedCtx, hand })) {
    return {
      candidate: passPlay,
      score: 0,
      reasons: ["兜底：队友占牌，过牌让权"],
    };
  }

  enrichedCtx._candidates = [];

  const candidates = generateBasicCandidates(hand, levelRank, previousPlay, {
    lite: true,
    emergency: true,
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
    const active = filterOpeningLeadCandidates(
      candidates.filter((c) => c.type !== PLAY_TYPES.pass),
      hand,
      levelRank,
      enrichedCtx,
      true,
    );
    if (active.length > 0) {
      return {
        candidate: active[0],
        score: 0,
        reasons: ["超时兜底：取首个可出牌"],
      };
    }
  } else {
    let beaters = candidates.filter(
      (c) => c.type !== PLAY_TYPES.pass
        && canBeat(c, previousPlay)
        && !breaksBombIntegrity(c, hand, levelRank, enrichedCtx),
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
    ? pickStructureSafeEmergencyCandidate(hand, levelRank, pool, preferredGroups, tableContext)
    : pool[0];
  if (picked) {
    return {
      candidate: picked,
      score: 0,
      reasons: ["临时建议：不拆成组结构"],
    };
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
export function humanAdviceFallback(hand, levelRank, previousPlay, preferredGroupsInput = null, tableContext = {}) {
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

  const preferredGroups = preferredGroupsInput?.length
    ? preferredGroupsInput
    : buildStrategicGroups(hand, levelRank, { skipStraightFlush: true });

  const candidates = generateBasicCandidates(hand, levelRank, previousPlay, {
    lite: true,
    emergency: true,
  });

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
    const picked = pickStructureSafeEmergencyCandidate(hand, levelRank, active, preferredGroups, tableContext);
    if (picked) {
      return {
        candidate: picked,
        score: 0,
        reasons: ["临时建议：优先不拆成组结构"],
      };
    }
  } else if (previousPlay.type === PLAY_TYPES.single) {
    const tableContext = { _candidates: candidates, preferredGroups, previousPlay };
    const ctx = analyzeMustBeatSingleContext(hand, levelRank, previousPlay, tableContext);
    const pool = ctx.playableLooseBeaters.length > 0
      ? ctx.playableLooseBeaters
      : ctx.safeLooseBeaters.length > 0
        ? ctx.safeLooseBeaters
        : withoutStructureBreak(
          candidates.filter((item) => item.type !== PLAY_TYPES.pass && canBeat(item, previousPlay)),
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
    const pairCtx = analyzeMustBeatPairContext(hand, levelRank, previousPlay, {
      ...tableContext,
      previousPlay,
      _candidates: candidates,
    });
    if (pairCtx.hasWholePairBeater) {
      const pool = pairCtx.dedicatedPairBeaters.length > 0
        ? pairCtx.dedicatedPairBeaters
        : pairCtx.wholePairBeaters;
      const minPair = pool.reduce(
        (best, item) => (!best || item.power < best.power ? item : best),
        null,
      );
      if (minPair) {
        return {
          candidate: minPair,
          score: 0,
          reasons: ["临时建议：最小整对压牌，不亮同花顺"],
        };
      }
    } else if (requiresBombForPairBeat(hand, levelRank, previousPlay, {
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
    const twpCtx = analyzeMustBeatTripleWithPairContext(hand, levelRank, previousPlay, {
      ...tableContext,
      previousPlay,
      preferredGroups,
      _candidates: candidates,
    });
    const minTwp = pickMinStructureSafeTripleWithPairBeater(
      twpCtx,
      levelRank,
      hand,
      { ...tableContext, previousPlay, preferredGroups },
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

  return premiumSafeEmergencyPick(hand, levelRank, previousPlay, preferredGroups, tableContext);
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
    recommendation = fastRobotFallback(player.hand, state.levelRank, previousPlay, tableContext);
  } else if (lite) {
    const yieldCtx = enrichScoringContext(
      { ...tableContext, hand: player.hand },
      [],
      player.hand,
      state.levelRank,
    );
    if (yieldCtx.partnerOwnsTrick && shouldYieldPassToPartner(yieldCtx)) {
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
  if (overBudget) {
    console.warn(`机器人单步超 ${Math.round(elapsed)}ms，改用毫秒兜底`);
    recommendation = fastRobotFallback(player.hand, state.levelRank, previousPlay, tableContext);
  }

  return {
    state: playCards(workingState, recommendation.candidate.cards),
    recommendation,
  };
}
