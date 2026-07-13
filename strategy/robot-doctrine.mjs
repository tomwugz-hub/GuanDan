/**
 * 机器人专用教纲延伸 — 与人类推荐共用 principles 底座，此处仅加码机器人节制。
 */
import { isJoker, isWildCard } from "../engine/card.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { compareRanks, isControlRank, rankPower } from "../engine/rank-order.mjs";
import { isTeammate, shouldYieldPassToPartner } from "./table-context.mjs";
import { playerJustWonTrickWithBomb, isCatchWindPremiumReduction } from "./lead-mode.mjs";
import { canBeat } from "../engine/compare-play.mjs";
import { isWildLowValueBeat, shouldReserveWildForSmallRoutineBeat } from "./wild-doctrine.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);
const ROUTINE_PRESS_TYPES = new Set([
  PLAY_TYPES.pair,
  PLAY_TYPES.triple,
  PLAY_TYPES.tripleWithPair,
  PLAY_TYPES.straight,
  PLAY_TYPES.consecutivePairs,
  PLAY_TYPES.plane,
]);

/** 仅同花顺能压小单/对子且局面尚早：保留同花顺（与 principles/audit 阈值一致，独立于此避免循环依赖） */
function shouldReserveStraightFlushForSmallCards(tableContext, hand, previousPlay) {
  if (tableContext.isOpening || tableContext.partnerOwnsTrick) return false;
  if (tableContext.hasActionableRegularWinner !== false || !previousPlay) return false;
  if (!tableContext.opponentActive) return false;
  if (![PLAY_TYPES.single, PLAY_TYPES.pair].includes(previousPlay.type)) return false;
  if ((tableContext.danger ?? 0) >= 3) return false;
  const resolvedHand = hand?.length ? hand : tableContext.hand ?? [];
  if (resolvedHand.length <= 8) return false;
  const candidates = tableContext._candidates ?? [];
  const plainBombs = candidates.filter(
    (item) => item.type === PLAY_TYPES.bomb && canBeat(item, previousPlay),
  );
  if (plainBombs.length > 0) return false;
  return candidates.some(
    (item) => item.type === PLAY_TYPES.straightFlush && canBeat(item, previousPlay),
  );
}

/** 是否机器人评分路径（仅正式对局机器人，不含人类 lite 教练） */
export function isRobotScoring(tableContext) {
  return tableContext.scoringAudience === "robot";
}

function isPressingSmallSingle(previousPlay, levelRank, tableContext) {
  if (!tableContext.opponentActive || !tableContext.hasRegularWinner) return false;
  if (previousPlay?.type !== PLAY_TYPES.single) return false;
  return compareRanks(previousPlay.mainRank, "6", levelRank) <= 0;
}

/** 对手大单/级牌试探（如单2、单A），非残局不宜动炸 */
function isPressingHighProbeSingle(previousPlay, levelRank, tableContext) {
  if (!tableContext.opponentActive) return false;
  if (previousPlay?.type !== PLAY_TYPES.single) return false;
  const rank = previousPlay.mainRank;
  if (rank === "SJ" || rank === "BJ") return false;
  if (rank === levelRank) return true;
  if (!tableContext.hasRegularWinner) return false;
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
function robotOpponentOneCardLeadAdjustment(candidate, hand, levelRank, tableContext) {
  if (!isRobotScoring(tableContext)) return { score: 0, reasons: [], principles: [] };
  if (!tableContext.isOpening || tableContext.leadMode === "must-beat") {
    return { score: 0, reasons: [], principles: [] };
  }
  if (candidate.type !== PLAY_TYPES.single || !opponentsWithOneCard(tableContext)) {
    return { score: 0, reasons: [], principles: [] };
  }

  const resolvedHand = hand?.length ? hand : (tableContext.hand ?? []);

  const reasons = [];
  const principles = [];
  let score = 0;

  if (candidate.mainRank === levelRank || isControlRank(candidate.mainRank, levelRank)) {
    const hasMediumProbe = resolvedHand.some(
      (card) => !isJoker(card)
        && compareRanks(card.rank, "8", levelRank) >= 0
        && compareRanks(card.rank, "Q", levelRank) <= 0,
    );
    if (hasMediumProbe && (candidate.mainRank === "SJ" || candidate.mainRank === "BJ")) {
      score += 18_000;
      reasons.push("【P12】对手报单，有中等单张不宜先出王");
      principles.push("P12");
    } else {
      score += 12_000;
      reasons.push("【P12】对手报单，机器人接风不宜出大牌/级牌逼过放行");
      principles.push("P12");
    }
  } else if (
    compareRanks(candidate.mainRank, "8", levelRank) >= 0
    && compareRanks(candidate.mainRank, "Q", levelRank) <= 0
  ) {
    score -= 9000;
    reasons.push("【P12】对手报单，试探中等单张留控权");
    principles.push("P12");
  } else if (compareRanks(candidate.mainRank, "7", levelRank) <= 0) {
    score += 11_000;
    reasons.push("【P12】对手报单，不宜出过小单放行");
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

  if (tableContext.partnerOwnsTrick && !tableContext.isFinishingPlay) {
    const yieldPass = shouldYieldPassToPartner(tableContext);
    if (BOMB_TYPES.has(candidate.type)) {
      const usesWild = (candidate.cards ?? []).some((card) => isWildCard(card, levelRank));
      score += usesWild ? 28_000 : 22_000;
      reasons.push(usesWild
        ? "【P10】不宜逢人配凑炸压队友"
        : "【P10】队友占牌，不宜炸队友");
      principles.push("P10");
    } else if (yieldPass) {
      if (candidate.type === PLAY_TYPES.pass) {
        score -= 14_000;
        reasons.push("【P10】队友占牌，机器人应过牌让权");
        principles.push("P10");
      } else {
        score += 18_000;
        reasons.push("【P10】队友占牌，不宜压队友");
        principles.push("P10");
      }
    }
  }

  if (
    isPressingSmallSingle(previousPlay, levelRank, tableContext)
    && BOMB_TYPES.has(candidate.type)
    && !tableContext.isFinishingPlay
    && tableContext.danger < 2
  ) {
    const sfExtra = candidate.type === PLAY_TYPES.straightFlush ? 8000 : 0;
    score += 14_000 + sfExtra;
    reasons.push("【P12】对手小单试探，机器人不宜动炸");
    principles.push("P12");
  }

  if (
    BOMB_TYPES.has(candidate.type)
    && candidate.type === PLAY_TYPES.straightFlush
    && previousPlay
    && [PLAY_TYPES.single, PLAY_TYPES.pair].includes(previousPlay.type)
    && handCount > 8
    && (tableContext.danger ?? 0) < 3
    && (candidate.cards?.length ?? 0) !== handCount
    && !tableContext.hasActionableRegularWinner
  ) {
    score += 16_000;
    reasons.push("【P12】机器人不宜用同花顺压小单/对子");
    principles.push("P12");
  }

  if (
    candidate.type === PLAY_TYPES.pass
    && shouldReserveStraightFlushForSmallCards(tableContext, hand, previousPlay)
  ) {
    score -= 6400;
    reasons.push("【P12】机器人过牌保留同花顺");
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
    const sfExtra = candidate.type === PLAY_TYPES.straightFlush ? 12_000 : 0;
    score += 15_000 + sfExtra + Math.max(0, bombSize - 4) * 1800;
    reasons.push("【P12】对手大单/级牌试探，机器人不宜动炸");
    principles.push("P12");
    if (candidate.type === PLAY_TYPES.pass) {
      score -= 5200;
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
    && !isCatchWindPremiumReduction(candidate, tableContext)
  ) {
    const bombSize = candidate.bombSize ?? candidate.cards?.length ?? 4;
    const sfExtra = candidate.type === PLAY_TYPES.straightFlush ? 4000 : 0;
    score += (bombSize >= 5 ? 18_000 : 16_000) + sfExtra;
    reasons.push("【P12】接风有中局路线不宜空炸");
    principles.push("P12");
  }

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

  if (
    previousPlay
    && shouldReserveWildForSmallRoutineBeat(tableContext, hand, previousPlay, levelRank)
    && isWildLowValueBeat(candidate, levelRank)
    && canBeat(candidate, previousPlay)
  ) {
    score += 10_000;
    reasons.push("【P12】机器人不宜逢人配压对手小牌型");
    principles.push("P12");
  }
  if (
    previousPlay
    && shouldReserveWildForSmallRoutineBeat(tableContext, hand, previousPlay, levelRank)
    && candidate.type === PLAY_TYPES.pass
  ) {
    score -= 5200;
    reasons.push("【P12】机器人过牌保留逢人配");
    principles.push("P12");
  }

  const oneCardLead = robotOpponentOneCardLeadAdjustment(candidate, hand, levelRank, tableContext);
  score += oneCardLead.score;
  reasons.push(...oneCardLead.reasons);
  principles.push(...oneCardLead.principles);

  return { score, reasons, principles };
}

/** 正式对局对手人格：在人类同源评分上叠加轻微风格权重 */
export function opponentPersonaAdjustment(candidate, tableContext) {
  const persona = tableContext?.opponentPersona;
  if (!persona || candidate?.type === PLAY_TYPES.pass) {
    return { score: 0, reasons: [], principles: [] };
  }
  let score = 0;
  const reasons = [];
  const cardCount = candidate.cards?.length ?? 0;
  if (persona.tempoWeight !== 1 && cardCount >= 5 && tableContext.isOpening) {
    score -= Math.round(600 * (persona.tempoWeight - 1) * cardCount);
    if (score !== 0) reasons.push(`【人格】${persona.name}偏抢节奏`);
  }
  if (persona.bombWeight !== 1 && BOMB_TYPES.has(candidate.type)) {
    score += Math.round(900 * (persona.bombWeight - 1));
    if (score !== 0) reasons.push(`【人格】${persona.name}炸弹倾向`);
  }
  if (persona.structureWeight !== 1 && cardCount <= 2) {
    score += Math.round(400 * (persona.structureWeight - 1));
  }
  return { score, reasons, principles: [] };
}

/**
 * 原 +8200 与 opponentPressure（+9200～10800）叠加，且未过滤 isActionableCandidate，
 * 导致 lite 路径下机器人比人类更排斥过牌（「不打不行」）。
 */
export function robotMustFollowAdjustment(candidate, previousPlay, tableContext) {
  if (!isRobotScoring(tableContext)) return { score: 0, reasons: [] };
  if (candidate.type !== PLAY_TYPES.pass) return { score: 0, reasons: [] };
  if (tableContext.isOpening || tableContext.partnerOwnsTrick) return { score: 0, reasons: [] };
  if (!tableContext.opponentActive || !tableContext.hasActionableRegularWinner) {
    return { score: 0, reasons: [] };
  }
  if (shouldYieldPassToPartner(tableContext) && (tableContext.danger ?? 0) < 2) {
    return { score: 0, reasons: [] };
  }
  // 须压且有可行动普通压牌：opponentPressure 已惩罚过牌，与人类一致
  return { score: 0, reasons: [] };
}
