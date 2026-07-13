/**
 * 逢人配（wild card）与须压结构保护教纲 — 供 principles / robot / enforce 共用。
 */
import { isWildCard } from "../engine/card.mjs";
import { canBeat } from "../engine/compare-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { compareRanks } from "../engine/rank-order.mjs";
import { opponentDangerLevel } from "./table-context.mjs";
import { isStructureBreakingRoutineBeat } from "./scorers/structure.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);
const ROUTINE_BEAT_TYPES = new Set([
  PLAY_TYPES.triple,
  PLAY_TYPES.pair,
  PLAY_TYPES.tripleWithPair,
  PLAY_TYPES.plane,
]);

function resolveHand(tableContext) {
  const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex;
  return tableContext.state?.players?.[playerIndex]?.hand ?? tableContext.hand ?? [];
}

function resolvedDanger(tableContext) {
  return tableContext.danger ?? opponentDangerLevel(tableContext);
}

/** 小牌面：≤7（按级牌序） */
export function isSmallFaceRank(rank, levelRank) {
  return compareRanks(rank, "7", levelRank) <= 0;
}

/** 逢人配配三张/对子/三带二/钢板（低价值用途） */
export function isWildLowValueBeat(candidate, levelRank) {
  if (!candidate || candidate.type === PLAY_TYPES.pass) return false;
  if (!ROUTINE_BEAT_TYPES.has(candidate.type)) {
    return false;
  }
  return (candidate.cards ?? []).some((card) => isWildCard(card, levelRank));
}

/** 须压对手小牌型且手牌仍多：不宜用逢人配凑三张/对子 */
export function shouldReserveWildForSmallRoutineBeat(tableContext, hand, previousPlay, levelRank = null) {
  if (tableContext.isOpening || tableContext.partnerOwnsTrick || tableContext.isFinishingPlay) return false;
  if (!tableContext.opponentActive || !previousPlay || previousPlay.type === PLAY_TYPES.pass) return false;
  if (!ROUTINE_BEAT_TYPES.has(previousPlay.type)) return false;
  const resolvedLevel = levelRank ?? tableContext.levelRank ?? tableContext.state?.levelRank ?? "2";
  if (!isSmallFaceRank(previousPlay.mainRank, resolvedLevel)) return false;
  const resolvedHand = hand?.length ? hand : resolveHand(tableContext);
  if (resolvedHand.length <= 10) return false;
  if (resolvedDanger(tableContext) >= 2) return false;
  return true;
}

/** 须压对手常规牌型且手牌仍多：不宜拆顺子/同花顺/四炸等同型压牌 */
export function shouldReserveStructureForRoutineBeat(tableContext, hand, previousPlay, levelRank = null) {
  if (tableContext.isOpening || tableContext.partnerOwnsTrick || tableContext.isFinishingPlay) return false;
  if (!tableContext.opponentActive || !previousPlay || previousPlay.type === PLAY_TYPES.pass) return false;
  if (!ROUTINE_BEAT_TYPES.has(previousPlay.type)) return false;
  const resolvedHand = hand?.length ? hand : resolveHand(tableContext);
  if (resolvedHand.length <= 10) return false;
  if (resolvedDanger(tableContext) >= 2) return false;
  return true;
}

/** @deprecated 兼容旧名；请用 shouldReserveStructureForRoutineBeat */
export function shouldReserveStructureForSmallTripleBeat(tableContext, hand, previousPlay, levelRank = null) {
  return shouldReserveStructureForRoutineBeat(tableContext, hand, previousPlay, levelRank)
    && previousPlay?.type === PLAY_TYPES.triple;
}

/** 是否存在不拆结构的同型压牌 */
export function hasStructureSafeRoutineBeater(candidates, previousPlay, hand, levelRank, preferredGroups = null) {
  if (!previousPlay || previousPlay.type === PLAY_TYPES.pass) return false;
  if (!ROUTINE_BEAT_TYPES.has(previousPlay.type)) return false;
  return (candidates ?? []).some(
    (item) => item.type === previousPlay.type
      && canBeat(item, previousPlay)
      && !isStructureBreakingRoutineBeat(item, hand, levelRank, preferredGroups),
  );
}

/** 是否存在不拆结构的同型三张压牌 */
export function hasStructureSafeTripleBeater(candidates, previousPlay, hand, levelRank) {
  if (previousPlay?.type !== PLAY_TYPES.triple) return false;
  return hasStructureSafeRoutineBeater(candidates, previousPlay, hand, levelRank);
}

/** 是否存在不拆结构的同型对子压牌 */
export function hasStructureSafePairBeater(candidates, previousPlay, hand, levelRank) {
  if (previousPlay?.type !== PLAY_TYPES.pair) return false;
  return hasStructureSafeRoutineBeater(candidates, previousPlay, hand, levelRank);
}

/** 是否存在不耗逢人配、且不拆结构的普通压牌 */
export function hasNaturalRegularBeater(candidates, previousPlay, levelRank, hand = null, levelRankForStructure = levelRank) {
  if (!previousPlay || previousPlay.type === PLAY_TYPES.pass) return false;
  return (candidates ?? []).some(
    (item) => item.type !== PLAY_TYPES.pass
      && !BOMB_TYPES.has(item.type)
      && canBeat(item, previousPlay)
      && !isWildLowValueBeat(item, levelRank)
      && !(hand && isStructureBreakingRoutineBeat(item, hand, levelRankForStructure)),
  );
}
