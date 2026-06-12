import { isJoker } from "../../engine/card.mjs";
import { canBeat } from "../../engine/compare-play.mjs";
import { classifyPlay } from "../../engine/classify-play.mjs";
import { PLAY_TYPES } from "../../engine/play-types.mjs";
import { compareRanks, isControlRank, rankPower } from "../../engine/rank-order.mjs";
import {
  analyzeJokerStraightFlushFinishHand,
  analyzeReservePairForPendingTriple,
  isBombOnlyBeatContext,
  isPressingJokerBombOnly,
  isPressingRoutineNonBomb,
  isPressingSmallSingle,
  isSmallFaceRank,
  prefersFullBombForControl,
  reasonFromPrinciple,
  shouldBombForOpponentSprint,
  shouldBombForPartnerFinish,
  shouldReserveBombForHeavyHand,
  shouldReserveStraightFlushForConsecutivePairs,
  shouldReservePureBombEarly,
} from "../principles.mjs";
import { generateBasicCandidates } from "../../engine/generate-candidates.mjs";
import { isTeammate, minOpponentHandCount, shouldYieldPassToPartner } from "../table-context.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);
const FINISH_TEMPO_TYPES = new Set([
  PLAY_TYPES.straight,
  PLAY_TYPES.straightFlush,
  PLAY_TYPES.consecutivePairs,
  PLAY_TYPES.plane,
  PLAY_TYPES.tripleWithPair,
]);

function shortenPlayLabel(play) {
  if (!play || play.type === PLAY_TYPES.pass) return "牌";
  if (play.type === PLAY_TYPES.pair) return `对${play.mainRank}`;
  if (play.type === PLAY_TYPES.single) return `单${play.mainRank}`;
  if (play.type === PLAY_TYPES.triple) return `三张${play.mainRank}`;
  if (play.type === PLAY_TYPES.tripleWithPair) return `${play.mainRank}带对三带二`;
  if (play.type === PLAY_TYPES.straight) return `顺子（${play.mainRank}起）`;
  if (play.type === PLAY_TYPES.straightFlush) return "同花顺";
  if (play.type === PLAY_TYPES.consecutivePairs) return "连对";
  if (play.type === PLAY_TYPES.plane) return "钢板";
  return play.label ?? play.type;
}

/** 无合法压牌时：说清是牌型不匹配，而非「没看见手牌」 */
function forcedPassNoBeaterReasons(hand, levelRank, previousPlay) {
  const fallback = ["没有能压过桌面的合法牌，只能过牌"];
  if (!hand?.length || !previousPlay || previousPlay.type === PLAY_TYPES.pass) return fallback;

  const wholeHandPlay = hand.length <= 12 ? classifyPlay(hand, levelRank) : null;
  if (!wholeHandPlay || wholeHandPlay.type === PLAY_TYPES.invalid || wholeHandPlay.type === PLAY_TYPES.pass) {
    return fallback;
  }
  if (canBeat(wholeHandPlay, previousPlay)) return fallback;
  if (wholeHandPlay.type === previousPlay.type) return fallback;

  const tableLabel = shortenPlayLabel(previousPlay);
  const handLabel = shortenPlayLabel(wholeHandPlay);
  const reasons = [
    `桌面是${tableLabel}，你只剩${handLabel}；掼蛋须同牌型才能压，只能过牌`,
  ];
  if (FINISH_TEMPO_TYPES.has(wholeHandPlay.type) && wholeHandPlay.cards?.length >= hand.length - 1) {
    reasons.push("若接风占权可一手走完，这手别拆成散牌");
  } else {
    reasons.push("等队友或对手换牌型后再出");
  }
  return reasons;
}

function levelRankFrom(tableContext) {
  return tableContext.state?.levelRank ?? tableContext.levelRank ?? "2";
}

function isOpponentBombPlay(play) {
  return play && BOMB_TYPES.has(play.type);
}

function opponentBombLabel(play) {
  if (!play) return "炸弹";
  if (play.type === PLAY_TYPES.straightFlush) return "同花顺";
  if (play.type === PLAY_TYPES.jokerBomb) return "天王炸";
  return "炸弹";
}

/** 尚未出完的对手中是否有人只剩 1 张（报单） */
function opponentsWithOneCard(tableContext) {
  const state = tableContext.state;
  if (!state) return [];
  const selfIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex ?? 0;
  return state.players.filter(
    (player) => !player.finishedOrder
      && !isTeammate(selfIndex, player.seatIndex)
      && player.hand.length === 1,
  );
}

function resolveScoringHand(tableContext) {
  if (tableContext.hand?.length) return tableContext.hand;
  const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex;
  return tableContext.state?.players?.[playerIndex]?.hand ?? [];
}

function physicalRankCount(hand, rank) {
  return hand.filter((card) => card.rank === rank && !isJoker(card)).length;
}

/** 报单场景：应用级牌/大牌压单，避免最小 beat 被队友送牌放行 */
function opponentSingleCardBlockAdjustment(candidate, previousPlay, tableContext) {
  if (previousPlay?.type !== PLAY_TYPES.single || candidate.type !== PLAY_TYPES.single) {
    return { score: 0, reasons: [] };
  }
  if (opponentsWithOneCard(tableContext).length === 0) {
    return { score: 0, reasons: [] };
  }

  const levelRank = levelRankFrom(tableContext);
  const beaters = (tableContext._candidates ?? []).filter(
    (item) => item.type === PLAY_TYPES.single && canBeat(item, previousPlay),
  );
  if (beaters.length === 0) return { score: 0, reasons: [] };

  const minBeatPower = Math.min(...beaters.map((item) => item.power));
  const hasLevelBeat = beaters.some((item) => item.mainRank === levelRank);
  const hasControlBeat = beaters.some(
    (item) => isControlRank(item.mainRank, levelRank) && item.power > minBeatPower,
  );

  const isMinBeat = candidate.power === minBeatPower;
  const isLevelCard = candidate.mainRank === levelRank;
  const beatGap = candidate.power - rankPower(previousPlay.mainRank, levelRank);

  let score = 0;
  const reasons = [];

  if (isLevelCard) {
    score -= 4800;
    reasons.push("对手报单，用级牌压更保险，避免被队友送牌放行");
  } else if (isControlRank(candidate.mainRank, levelRank) && beatGap >= 5) {
    score -= 3200;
    reasons.push("对手报单，用大牌压住，封死末张逃生");
  } else if (isMinBeat && hasLevelBeat) {
    score += 5600;
    reasons.push("对手报单，最小单张压牌易被队友送牌放行");
  } else if (isMinBeat && hasControlBeat && beatGap <= 4) {
    score += 4200;
    reasons.push("对手报单，宜留更大控权牌封门");
  }

  return { score, reasons };
}

/** 对手已亮炸时，过牌代价（分数越高越不宜过） */
function passVsOpponentBombPenalty(previousPlay, tableContext) {
  const { danger } = tableContext;
  const oppType = previousPlay?.type;
  const label = opponentBombLabel(previousPlay);

  if (oppType === PLAY_TYPES.straightFlush) {
    if (shouldYieldPassToPartner(tableContext) && danger < 2) {
      return {
        score: 2200,
        reasons: ["队友占牌，仍须评估能否用更大同花顺抢权"],
      };
    }
    return { score: 6200, reasons: [`对手${label}占牌，有更大炸应抢牌权`] };
  }
  if (oppType === PLAY_TYPES.jokerBomb) {
    return { score: 8800, reasons: ["对手天王炸，无更大炸只能过牌"] };
  }
  if (shouldYieldPassToPartner(tableContext) && danger < 2) {
    return { score: -1200, reasons: [reasonFromPrinciple("P10")] };
  }
  return { score: 3200, reasons: [`对手${label}占牌，有更大炸才值得跟`] };
}

/**
 * 对手占牌时：有普通压牌则强烈惩罚过牌，并奖励最小代价跟牌。
 */
export function opponentPressureAdjustment(candidate, previousPlay, tableContext) {
  const reasons = [];
  if (tableContext.isOpening || tableContext.partnerOwnsTrick) {
    return { score: 0, reasons };
  }

  const { opponentActive, hasRegularWinner, hasAnyWinner, danger = 0 } = tableContext;
  if (!opponentActive) return { score: 0, reasons };

  if (candidate.type === PLAY_TYPES.pass) {
    if (!hasAnyWinner) {
      const hand = resolveScoringHand(tableContext);
      return {
        score: 0,
        reasons: forcedPassNoBeaterReasons(hand, levelRankFrom(tableContext), previousPlay),
      };
    }
    if (shouldBombForPartnerFinish(tableContext, resolveScoringHand(tableContext), previousPlay)) {
      return {
        score: 13_600 + danger * 420,
        reasons: [reasonFromPrinciple("P5", { partnerSprint: true })],
      };
    }
    if (shouldReservePureBombEarly(tableContext, resolveScoringHand(tableContext), previousPlay)) {
      return {
        score: -10_400,
        reasons: [reasonFromPrinciple("P4", { pureBombEarly: true })],
      };
    }
    {
      const hand = resolveScoringHand(tableContext);
      const levelRank = levelRankFrom(tableContext);
      const pendingTripleReserves = analyzeReservePairForPendingTriple(
        hand,
        levelRank,
        previousPlay,
        tableContext,
      );
      if (pendingTripleReserves.length > 0) {
        return {
          score: -10_400,
          reasons: [`【P4】${pendingTripleReserves[0].reason}，可过牌保留结构`],
        };
      }
    }
    const actionableRegular = tableContext.hasActionableRegularWinner === true;
    if (actionableRegular) {
      let passPenalty = previousPlay?.type === PLAY_TYPES.single
        ? 10_800 + danger * 500
        : 9200 + danger * 400;
      if (shouldYieldPassToPartner(tableContext) && danger < 2) {
        passPenalty = Math.floor(passPenalty * 0.32);
        reasons.push(reasonFromPrinciple("P10"));
      } else {
        reasons.push(
          previousPlay?.type === PLAY_TYPES.single
            ? "对手出单张且有牌可压，不应随便过牌"
            : "对手占牌且你有普通压牌，不能轻易放行",
        );
      }
      return { score: passPenalty, reasons };
    }
    if (isOpponentBombPlay(previousPlay)) {
      const bombPass = passVsOpponentBombPenalty(previousPlay, tableContext);
      return { score: bombPass.score, reasons: bombPass.reasons };
    }
    let bombOnlyPassPenalty = 3400;
    if (shouldYieldPassToPartner(tableContext) && danger < 2) {
      bombOnlyPassPenalty = -1200;
      reasons.push(reasonFromPrinciple("P10"));
    } else if (isPressingJokerBombOnly(previousPlay, tableContext)) {
      bombOnlyPassPenalty = 12_800 + danger * 520;
      reasons.push("须压王且只有炸弹能跟，不宜过牌");
    } else if (
      previousPlay?.type === PLAY_TYPES.single
      && isSmallFaceRank(previousPlay.mainRank, levelRankFrom(tableContext))
      && compareRanks(previousPlay.mainRank, "6", levelRankFrom(tableContext)) <= 0
      && danger < 2
    ) {
      bombOnlyPassPenalty = -4200;
      reasons.push("对手小单试探，不必动炸，过牌放行");
    } else if (
      isBombOnlyBeatContext(tableContext)
      && previousPlay?.type === PLAY_TYPES.straight
    ) {
      bombOnlyPassPenalty = 6800 + danger * 400;
      reasons.push("对手顺子占牌且只有炸弹能压，不宜过牌放行");
    } else if (
      isBombOnlyBeatContext(tableContext)
      && previousPlay?.type === PLAY_TYPES.pair
    ) {
      bombOnlyPassPenalty = 7600 + danger * 480;
      reasons.push("须压对子且只有炸弹能跟，不宜过牌");
    } else if (
      isPressingRoutineNonBomb(previousPlay, tableContext)
      && shouldReserveBombForHeavyHand(tableContext, resolveScoringHand(tableContext).length)
      && tableContext.hasActionableRegularWinner
    ) {
      bombOnlyPassPenalty = -4800;
      reasons.push("对手普通牌型，不必动炸，过牌放行");
    } else if (
      shouldReserveStraightFlushForConsecutivePairs(
        tableContext,
        resolveScoringHand(tableContext),
        previousPlay,
      )
    ) {
      bombOnlyPassPenalty = -4800;
      reasons.push("对手连对不值得消耗同花顺，可过牌等接风");
    } else if (isBombOnlyBeatContext(tableContext)) {
      bombOnlyPassPenalty = 7200 + danger * 460;
      reasons.push("只有炸弹能压，不宜过牌");
    } else {
      reasons.push("只有炸弹能压，不宜过牌");
    }
    return { score: bombOnlyPassPenalty, reasons };
  }

  if (BOMB_TYPES.has(candidate.type)) {
    const sfReserve = straightFlushReserveAdjustment(candidate, previousPlay, tableContext);
    const levelRank = levelRankFrom(tableContext);
    const pressingSmallSingle = isPressingSmallSingle(previousPlay, levelRank, tableContext);
    const handCount = resolveScoringHand(tableContext).length;
    const bombOnlyBeatStraight = isBombOnlyBeatContext(tableContext)
      && previousPlay?.type === PLAY_TYPES.straight;
    const reserveBombVsRoutine = isPressingRoutineNonBomb(previousPlay, tableContext)
      && shouldReserveBombForHeavyHand(tableContext, handCount)
      && !bombOnlyBeatStraight
      && previousPlay?.type !== PLAY_TYPES.straight;
    if (tableContext.hasActionableRegularWinner && !tableContext.isFinishingPlay) {
      if (shouldBombForOpponentSprint(tableContext, previousPlay)) {
        const minOpp = minOpponentHandCount(tableContext);
        const grab = -5600 - danger * 320 - Math.max(0, 6 - minOpp) * 600 + sfReserve.score;
        const grabReason = minOpp <= 4
          ? "对手冲刺占牌，炸夺牌权防其走完"
          : "对手余牌不多占牌，炸夺牌权更稳";
        return {
          score: grab,
          reasons: [...sfReserve.reasons, grabReason],
        };
      }
      let bombPenalty = 4500 + sfReserve.score;
      if ([PLAY_TYPES.single, PLAY_TYPES.pair].includes(previousPlay?.type)) {
        bombPenalty += 6500;
      }
      reasons.push("已有普通牌能压住，不必动用炸弹");
      return { score: bombPenalty, reasons: [...reasons, ...sfReserve.reasons] };
    }
    if (!tableContext.hasActionableRegularWinner && !tableContext.isFinishingPlay) {
      let grab = -1400 - danger * 120 + sfReserve.score;
      let grabReason = "只有炸弹能压，应抢牌权";
      if (shouldBombForPartnerFinish(tableContext, resolveScoringHand(tableContext), previousPlay)) {
        const bombSize = candidate.bombSize ?? candidate.cards?.length ?? 4;
        const hand = resolveScoringHand(tableContext);
        const physicalHeld = physicalRankCount(hand, candidate.mainRank);
        if (bombSize === physicalHeld) {
          grab -= 7600 + danger * 220;
          grabReason = "队友冲刺，满张炸夺权给队友接风";
        } else if (physicalHeld > 4) {
          grab += 9200;
          grabReason = reasonFromPrinciple("P7", { splitBombControl: true });
        }
      } else if (pressingSmallSingle && danger < 2) {
        const gap = rankPower(candidate.mainRank, levelRank)
          - rankPower(previousPlay.mainRank, levelRank);
        grab += 11_000 + Math.max(0, gap) * 420;
        grabReason = "对手小单试探，非必要不炸，优先过牌";
      } else if (
        isBombOnlyBeatContext(tableContext)
        && previousPlay?.type === PLAY_TYPES.straight
      ) {
        const hand = resolveScoringHand(tableContext);
        const bombSize = candidate.bombSize ?? candidate.cards?.length ?? 4;
        const physicalHeld = physicalRankCount(hand, candidate.mainRank);
        const wantFullBomb = prefersFullBombForControl(
          hand,
          candidate.mainRank,
          previousPlay,
          tableContext,
        );
        if (wantFullBomb) {
          grab -= bombSize === physicalHeld ? 5400 : bombSize === 4 ? 3200 : 4000;
          grabReason = bombSize === physicalHeld
            ? "【P7】满张炸弹控牌权，四炸易被反压"
            : "【P7】拆炸出四炸牌力弱，应满张出炸控权";
        } else {
          grab -= bombSize === 4 ? 4200 : bombSize >= 6 ? 1800 : 3000;
          grabReason = bombSize === 4
            ? "【P7】四炸够压顺子，打完剩对子仍可减手"
            : "【P7】压顺子需炸弹抢牌权，优先最小够压炸";
        }
      } else if (reserveBombVsRoutine) {
        const bombSize = candidate.bombSize ?? candidate.cards?.length ?? 4;
        grab += bombSize >= 5 ? 13_000 : 10_000;
        grabReason = "对手普通牌型，手牌仍多不必动炸，过牌等循环";
      } else if (
        candidate.type === PLAY_TYPES.straightFlush
        && previousPlay?.type === PLAY_TYPES.consecutivePairs
        && handCount > 8
        && danger < 3
      ) {
        grab += 10_000;
        grabReason = "对手连对不值得消耗同花顺，可过牌等接风";
      } else if (
        candidate.type === PLAY_TYPES.straightFlush
        && isOpponentBombPlay(previousPlay)
        && tableContext.partnerAttemptedCurrentRound
        && danger < 2
        && (tableContext._candidates ?? []).some(
          (item) => item.type === PLAY_TYPES.bomb && canBeat(item, previousPlay),
        )
      ) {
        grab += 12_000;
        grabReason = "队友本墩已出过牌，不必强行亮同花顺";
      } else if (
        isOpponentBombPlay(previousPlay)
        && tableContext.partnerAttemptedCurrentRound
        && danger < 2
      ) {
        grab += 9200;
        grabReason = "队友本墩已出过牌，不必叠炸拦对手";
      } else if (tableContext.hasRegularWinner) {
        grabReason = previousPlay?.type === PLAY_TYPES.consecutivePairs
          ? "无更大连对可压，需用炸弹抢牌权"
          : "无可用更大普通牌可压，需用炸弹抢牌权";
      }
      return {
        score: grab,
        reasons: [...sfReserve.reasons, grabReason],
      };
    }
    if (isOpponentBombPlay(previousPlay)) {
      const levelRank = levelRankFrom(tableContext);
      const gap = rankPower(candidate.mainRank, levelRank) - rankPower(previousPlay.mainRank, levelRank);
      if (previousPlay.type === PLAY_TYPES.straightFlush && candidate.type === PLAY_TYPES.straightFlush && gap > 0) {
        return {
          score: -4000 - danger * 200 + sfReserve.score,
          reasons: [...sfReserve.reasons, "对手同花顺，用更大同花顺抢回牌权"],
        };
      }
      if (candidate.type === PLAY_TYPES.bomb && gap >= 3) {
        reasons.push("勿用高炸拦低炸，优先考虑过牌");
        return { score: 4600 + gap * 180, reasons };
      }
    }
    if (shouldReservePureBombEarly(tableContext, resolveScoringHand(tableContext), previousPlay)) {
      const bombSize = candidate.bombSize ?? candidate.cards?.length ?? 4;
      return {
        score: (bombSize >= 5 ? 12_800 : 10_800) + sfReserve.score,
        reasons: [...sfReserve.reasons, reasonFromPrinciple("P4", { pureBombEarly: true })],
      };
    }
    return {
      score: -danger * 200 + sfReserve.score,
      reasons: [...sfReserve.reasons, "对手冲刺时需抢牌权"],
    };
  }

  let bonus = -3200 - danger * 280;
  if (previousPlay?.type === PLAY_TYPES.consecutivePairs) {
    bonus -= candidate.power * 3;
    reasons.push("用最小连对压住对手连对，打断接风");
  } else if (previousPlay?.type === PLAY_TYPES.pair) {
    bonus -= candidate.power * 3;
    reasons.push("用最小对子压住对手对子，打断接风");
  } else if (previousPlay?.type === PLAY_TYPES.single) {
    const blockAdj = opponentSingleCardBlockAdjustment(candidate, previousPlay, tableContext);
    if (blockAdj.reasons.length > 0) {
      bonus += blockAdj.score;
      reasons.push(...blockAdj.reasons);
    } else {
      bonus -= 3800 - Math.min(candidate.power * 4, 160);
      reasons.push("跟住对手单张，避免其连续占牌");
    }
  } else {
    bonus -= candidate.length * 12 + candidate.power;
    reasons.push("对手占牌，优先用普通牌型抢回牌权");
  }

  return { score: bonus, reasons };
}

/** 同花顺战略保留：非残局、低威胁时不为压小牌消耗 */
function straightFlushReserveAdjustment(candidate, previousPlay, tableContext) {
  if (candidate.type !== PLAY_TYPES.straightFlush) return { score: 0, reasons: [] };

  const { danger, isFinishingPlay, partnerAttemptedCurrentRound, hasRegularWinner } = tableContext;
  if (isFinishingPlay) return { score: 0, reasons: [] };

  const levelRank = levelRankFrom(tableContext);
  const resolvedHand = resolveScoringHand(tableContext);
  if (
    analyzeJokerStraightFlushFinishHand(resolvedHand, levelRank)
    && tableContext.opponentActive
    && !tableContext.isOpening
  ) {
    return { score: 0, reasons: [] };
  }

  const oppType = previousPlay?.type;
  if (oppType === PLAY_TYPES.jokerBomb) return { score: 0, reasons: [] };

  let penalty = 0;
  const reasons = [];

  let plainBombBeaters = (tableContext._candidates ?? []).filter(
    (item) => item.type === PLAY_TYPES.bomb && previousPlay && canBeat(item, previousPlay),
  );
  if (plainBombBeaters.length === 0 && resolvedHand.length > 0 && previousPlay) {
    plainBombBeaters = generateBasicCandidates(resolvedHand, levelRank, previousPlay).filter(
      (item) => item.type === PLAY_TYPES.bomb && canBeat(item, previousPlay),
    );
  }
  if (
    plainBombBeaters.length > 0
    && [PLAY_TYPES.single, PLAY_TYPES.pair].includes(oppType)
  ) {
    penalty += 14_000;
    reasons.push("有普通炸弹可压，不宜亮同花顺");
  }

  const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex;
  const selfHandCount = playerIndex == null
    ? 99
    : (tableContext.state?.players?.[playerIndex]?.hand?.length ?? 99);

  const lowThreat = danger < 2;
  const mediumThreat = danger < 3;
  const earlyForSelf = selfHandCount > 8;

  if (oppType === PLAY_TYPES.single || oppType === PLAY_TYPES.pair) {
    if (lowThreat) {
      penalty += 8800;
      reasons.push("同花顺留给关键控权，不压小单/对子");
    } else if (mediumThreat && earlyForSelf) {
      penalty += 6200;
      reasons.push("局面尚早，同花顺不压小单/对子");
    }
  } else if (lowThreat || (mediumThreat && earlyForSelf)) {
    if (oppType === PLAY_TYPES.consecutivePairs) {
      penalty += 7200;
      reasons.push("对手连对不值得消耗同花顺，可过牌等接风");
    } else if ([PLAY_TYPES.triple, PLAY_TYPES.tripleWithPair, PLAY_TYPES.straight].includes(oppType)) {
      penalty += 6400;
      reasons.push("同花顺战略保留，不必为普通牌型亮炸");
    } else if (oppType === PLAY_TYPES.bomb && !hasRegularWinner) {
      penalty += 2200;
      reasons.push("非紧急局面慎用同花顺拦炸");
    }
  }

  if (shouldYieldPassToPartner(tableContext) && danger < 3) {
    penalty += 3600;
    reasons.push(reasonFromPrinciple("P10", { stackBomb: true }));
  }

  if (!penalty) return { score: 0, reasons: [] };
  return { score: penalty, reasons };
}
