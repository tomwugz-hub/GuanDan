/**
 * 机器人专用教纲延伸 — 与人类推荐共用 principles 底座，此处仅加码机器人节制。
 */
import { canBeat } from "../engine/compare-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { compareRanks, isControlRank, rankPower } from "../engine/rank-order.mjs";
import { isTeammate } from "./table-context.mjs";
import { playerJustWonTrickWithBomb } from "./lead-mode.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);
const ROUTINE_PRESS_TYPES = new Set([
  PLAY_TYPES.pair,
  PLAY_TYPES.triple,
  PLAY_TYPES.tripleWithPair,
  PLAY_TYPES.straight,
  PLAY_TYPES.consecutivePairs,
  PLAY_TYPES.plane,
]);

/** 是否机器人评分路径（lite 自动对局） */
export function isRobotScoring(tableContext) {
  return tableContext.scoringAudience === "robot" || tableContext.lite === true;
}

function isPressingSmallSingle(previousPlay, levelRank, tableContext) {
  if (!tableContext.opponentActive || !tableContext.hasRegularWinner) return false;
  if (previousPlay?.type !== PLAY_TYPES.single) return false;
  return compareRanks(previousPlay.mainRank, "7", levelRank) <= 0
    && compareRanks(previousPlay.mainRank, "6", levelRank) <= 0;
}

/** 对手大单/级牌试探（如单2、单A），非残局不宜动炸 */
function isPressingHighProbeSingle(previousPlay, levelRank, tableContext) {
  if (!tableContext.opponentActive || !tableContext.hasRegularWinner) return false;
  if (previousPlay?.type !== PLAY_TYPES.single) return false;
  const rank = previousPlay.mainRank;
  if (rank === levelRank || isControlRank(rank, levelRank)) return true;
  return compareRanks(rank, "Q", levelRank) >= 0;
}

function isPressingRoutineNonBomb(previousPlay, tableContext) {
  if (!tableContext.opponentActive || !previousPlay) return false;
  if (BOMB_TYPES.has(previousPlay.type)) return false;
  return ROUTINE_PRESS_TYPES.has(previousPlay.type);
}

function shouldReserveBombForHeavyHand(tableContext, handCount) {
  if (tableContext.isFinishingPlay) return false;
  if ((tableContext.danger ?? 0) >= 2) return false;
  return handCount >= 15;
}

function isOpponentBombPlay(play) {
  return play && BOMB_TYPES.has(play.type);
}

/** 对手是否报单（只剩 1 张未出完） */
function opponentsWithOneCard(tableContext) {
  const state = tableContext.state;
  if (!state) return false;
  const selfIndex = tableContext.playerIndex ?? state.currentPlayerIndex ?? 0;
  return state.players.some(
    (player) => !player.finishedOrder
      && !isTeammate(selfIndex, player.seatIndex)
      && player.hand.length === 1,
  );
}

/**
 * 机器人接风/领出：对手报单时不应出大牌逼过放行，优先中等单张试探。
 */
function robotOpponentOneCardLeadAdjustment(candidate, levelRank, tableContext) {
  if (!isRobotScoring(tableContext)) return { score: 0, reasons: [], principles: [] };
  if (!tableContext.isOpening || tableContext.leadMode === "must-beat") {
    return { score: 0, reasons: [], principles: [] };
  }
  if (candidate.type !== PLAY_TYPES.single || !opponentsWithOneCard(tableContext)) {
    return { score: 0, reasons: [], principles: [] };
  }

  const reasons = [];
  const principles = [];
  let score = 0;

  if (candidate.mainRank === levelRank || isControlRank(candidate.mainRank, levelRank)) {
    score += 12_000;
    reasons.push("【P12】对手报单，机器人接风不宜出大牌/级牌逼过放行");
    principles.push("P12");
  } else if (
    compareRanks(candidate.mainRank, "8", levelRank) >= 0
    && compareRanks(candidate.mainRank, "Q", levelRank) <= 0
  ) {
    score -= 9000;
    reasons.push("【P12】对手报单，试探中等单张留控权");
    principles.push("P12");
  }

  return { score, reasons, principles };
}

/**
 * 机器人专用原则加减分（P12 机器人节制炸）。
 * @returns {{ score: number, reasons: string[], principles: string[] }}
 */
export function scoreRobotDoctrine(candidate, hand, levelRank, tableContext) {
  const reasons = [];
  const principles = [];
  let score = 0;
  if (!isRobotScoring(tableContext)) {
    return { score, reasons, principles };
  }

  const previousPlay = tableContext.previousPlay ?? null;
  const handCount = hand?.length ?? 0;

  if (
    isPressingSmallSingle(previousPlay, levelRank, tableContext)
    && BOMB_TYPES.has(candidate.type)
    && !tableContext.isFinishingPlay
    && tableContext.danger < 2
  ) {
    score += 14_000;
    reasons.push("【P12】对手小单试探，机器人不宜动炸");
    principles.push("P12");
  }

  if (
    isPressingHighProbeSingle(previousPlay, levelRank, tableContext)
    && BOMB_TYPES.has(candidate.type)
    && !tableContext.isFinishingPlay
    && tableContext.danger < 2
    && handCount >= 10
  ) {
    const bombSize = candidate.bombSize ?? candidate.cards?.length ?? 4;
    score += 15_000 + Math.max(0, bombSize - 4) * 1800;
    reasons.push("【P12】对手大单/级牌试探，机器人不宜动炸");
    principles.push("P12");
    if (candidate.type === PLAY_TYPES.pass) {
      score -= 3600;
      reasons.push("机器人可过牌等循环，不必为单2/大单动炸");
      principles.push("P12");
    }
  }

  const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex ?? 0;
  if (
    BOMB_TYPES.has(candidate.type)
    && tableContext.leadMode === "catch-wind"
    && !tableContext.opponentActive
    && !tableContext.isFinishingPlay
    && handCount > 7
    && (candidate.cards?.length ?? 0) < handCount
    && playerJustWonTrickWithBomb(tableContext.state, playerIndex)
  ) {
    const bombSize = candidate.bombSize ?? candidate.cards?.length ?? 4;
    if (bombSize >= 5 || candidate.type === PLAY_TYPES.straightFlush) {
      score += bombSize >= 5 ? 18_000 : 14_000;
      reasons.push("【P12】刚炸/同花顺夺权接风，不宜空扔厚炸");
      principles.push("P12");
    }
  }

  if (
    isPressingRoutineNonBomb(previousPlay, tableContext)
    && BOMB_TYPES.has(candidate.type)
    && shouldReserveBombForHeavyHand(tableContext, handCount)
  ) {
    const bombSize = candidate.bombSize ?? candidate.cards?.length ?? 4;
    if (bombSize >= 5) {
      score += 16_000;
      reasons.push("【P12】手牌仍多，三带二局面不宜五炸，可过牌等循环");
      principles.push("P12");
    }
    if (candidate.type === PLAY_TYPES.pass) {
      score -= 2800;
      reasons.push("机器人手牌仍多，过牌等循环优于五炸");
      principles.push("P12");
    }
  }

  if (
    previousPlay
    && !tableContext.hasActionableRegularWinner
    && candidate.type === PLAY_TYPES.bomb
    && handCount >= 15
    && isPressingRoutineNonBomb(previousPlay, tableContext)
  ) {
    const bombSize = candidate.bombSize ?? candidate.cards?.length ?? 4;
    if (bombSize >= 5) {
      score += 12_000;
      reasons.push("【P12】手牌仍多，三带二局面不宜五炸，可过牌等循环");
      principles.push("P12");
    }
  }

  if (
    BOMB_TYPES.has(candidate.type)
    && tableContext.partnerAttemptedCurrentRound
    && isOpponentBombPlay(previousPlay)
    && tableContext.danger < 2
  ) {
    const gap = rankPower(candidate.mainRank, levelRank)
      - rankPower(previousPlay.mainRank, levelRank);
    if (gap >= 2) {
      score += 10_000 + gap * 420;
      reasons.push("【P10】队友本墩已出过牌，不必叠更大炸");
      principles.push("P10");
    }
  }

  const oneCardLead = robotOpponentOneCardLeadAdjustment(candidate, levelRank, tableContext);
  score += oneCardLead.score;
  reasons.push(...oneCardLead.reasons);
  principles.push(...oneCardLead.principles);

  return { score, reasons, principles };
}

/** 机器人跟牌：有普通压牌时不应随便过牌（老史压对子场景） */
export function robotMustFollowAdjustment(candidate, previousPlay, tableContext) {
  if (!isRobotScoring(tableContext)) return { score: 0, reasons: [] };
  if (candidate.type !== PLAY_TYPES.pass) return { score: 0, reasons: [] };
  if (!tableContext.opponentActive || !tableContext.hasRegularWinner) {
    return { score: 0, reasons: [] };
  }
  if (tableContext.partnerOwnsTrick) return { score: 0, reasons: [] };

  const beaters = (tableContext._candidates ?? []).filter(
    (item) => item.type !== PLAY_TYPES.pass && canBeat(item, previousPlay),
  );
  const regularBeaters = beaters.filter((item) => !BOMB_TYPES.has(item.type));
  if (regularBeaters.length === 0) return { score: 0, reasons: [] };

  return {
    score: 8200 + tableContext.danger * 320,
    reasons: ["机器人有普通压牌不应随便过牌，避免对手连续接风"],
  };
}
