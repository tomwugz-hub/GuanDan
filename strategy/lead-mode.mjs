import { PLAY_TYPES } from "../engine/play-types.mjs";
import { isCatchWindPending } from "../engine/game-state.mjs";
import { isJoker } from "../engine/card.mjs";
import { compareRanks, isControlRank, rankPower } from "../engine/rank-order.mjs";

/** 散小单张（≤7，非王/级牌控场）— 内联避免 lead-mode ↔ tempo-lead 环依赖 */
function looseSmallSingleRanks(hand, levelRank) {
  const rankCounts = new Map();
  for (const card of hand) {
    if (isJoker(card)) continue;
    rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
  }
  const singles = [];
  for (const [rank, count] of rankCounts) {
    if (count !== 1) continue;
    if (rank === levelRank || isControlRank(rank, levelRank)) continue;
    if (compareRanks(rank, "7", levelRank) <= 0) singles.push(rank);
  }
  return singles.sort((left, right) => rankPower(left, levelRank) - rankPower(right, levelRank));
}

/** 刚炸/SF 夺权接风后，优先顺子/同花顺跑道减手的最大手牌数 */
export const CATCH_WIND_RUNWAY_HAND_MAX = 16;

/** 有牌权时的出牌场景（接风与真开局区分） */
export function inferLeadMode(state, playerIndex) {
  if (!state) return "unknown";

  // lastActivePlay 未清但 history 已收墩：按接风，勿判 must-beat
  if (isCatchWindPending(state)) return "catch-wind";

  if (state.lastActivePlay && state.lastActivePlay.type !== PLAY_TYPES.pass) {
    return "must-beat";
  }

  const history = state.playHistory ?? [];
  if (history.length === 0) return "fresh-open";

  let lastSubstantiveIndex = -1;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const play = history[i].play;
    if (play && play.type !== PLAY_TYPES.pass) {
      lastSubstantiveIndex = i;
      break;
    }
  }
  if (lastSubstantiveIndex < 0) return "fresh-open";

  let passCount = 0;
  for (let i = lastSubstantiveIndex + 1; i < history.length; i += 1) {
    if (history[i].play?.type === PLAY_TYPES.pass) passCount += 1;
  }

  const activeOpponents = state.players.filter(
    (player, index) => index !== playerIndex && !player.finishedOrder,
  ).length - 1;
  const neededPasses = Math.max(1, Math.min(3, activeOpponents));

  // 接风：末家还原牌权（含自己炸夺权、对家/上家出牌后三家不要）
  if (passCount >= neededPasses) return "catch-wind";

  return "fresh-open";
}

const BOMB_WIN_TYPES = new Set([
  PLAY_TYPES.bomb,
  PLAY_TYPES.straightFlush,
  PLAY_TYPES.jokerBomb,
]);

/** 本轮最后一手实牌是否由自己用炸（含同花顺/王炸）夺权 */
export function playerJustWonTrickWithBomb(state, playerIndex) {
  const history = state?.playHistory ?? [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    const play = entry?.play;
    if (!play || play.type === PLAY_TYPES.pass || play.isPass) continue;
    if (entry.playerIndex !== playerIndex) return false;
    return BOMB_WIN_TYPES.has(play.type) || (play.bombSize ?? 0) >= 4;
  }
  return false;
}

/** 本轮最后一手实牌是否由自己用成组牌（连对/三带二/钢板等）夺权 */
export function playerJustWonTrickWithGroupPlay(state, playerIndex) {
  const lastWin = lastCatchWindWinningPlay(state, playerIndex);
  if (!lastWin) return false;
  if (BOMB_WIN_TYPES.has(lastWin.type) || (lastWin.bombSize ?? 0) >= 4) return true;
  return (
    [PLAY_TYPES.consecutivePairs, PLAY_TYPES.tripleWithPair, PLAY_TYPES.plane].includes(lastWin.type)
    && (lastWin.length ?? lastWin.cards?.length ?? 0) >= 4
  );
}

/** 接风前自己最后一手非 pass 实牌（用于区分三带二/连对夺权节奏） */
export function lastCatchWindWinningPlay(state, playerIndex) {
  const history = state?.playHistory ?? [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    const play = entry?.play;
    if (!play || play.type === PLAY_TYPES.pass || play.isPass) continue;
    if (entry.playerIndex !== playerIndex) return null;
    return play;
  }
  return null;
}

/**
 * 接风成组减手：刚炸/连对/三带二等夺权后，宜同花顺/连对减手（trim / 评分 / 教纲共用）。
 */
export function isCatchWindPremiumReduction(candidate, tableContext) {
  if (!candidate || candidate.type === PLAY_TYPES.pass) return false;
  const state = tableContext?.state;
  const playerIndex = tableContext?.playerIndex ?? state?.currentPlayerIndex ?? 0;
  const leadMode = tableContext?.leadMode
    ?? (state && playerIndex != null ? inferLeadMode(state, playerIndex) : null);
  if (leadMode !== "catch-wind") return false;
  const handLen = tableContext?.hand?.length
    ?? state?.players?.[playerIndex]?.hand?.length
    ?? 0;
  if (handLen <= 7) return false;
  if (!playerJustWonTrickWithGroupPlay(state, playerIndex)) return false;
  if (candidate.type === PLAY_TYPES.consecutivePairs) {
    return (candidate.length ?? candidate.cards?.length ?? 0) >= 4;
  }
  if (candidate.type === PLAY_TYPES.straightFlush) {
    if ((candidate.cards?.length ?? 0) >= handLen) return false;
    // 手牌仍多时保留同花顺给须压/控权，先走对子、顺子等普通路线。
    if (handLen > 10) return false;
    return true;
  }
  return false;
}

/**
 * 刚炸夺权接风：宜优先连对/同花顺等成组减手（可拆同花顺结构组连对）。
 * trim / 评分 / 教纲共用。
 */
export function isCatchWindGroupReductionAfterBomb(candidate, tableContext) {
  if (!candidate || candidate.type === PLAY_TYPES.pass) return false;
  const state = tableContext?.state;
  const playerIndex = tableContext?.playerIndex ?? state?.currentPlayerIndex ?? 0;
  if (!playerJustWonTrickWithBomb(state, playerIndex)) return false;
  const leadMode = tableContext?.leadMode
    ?? (state && playerIndex != null ? inferLeadMode(state, playerIndex) : null);
  if (leadMode !== "catch-wind") return false;
  if (candidate.type === PLAY_TYPES.straightFlush) {
    const handLen = tableContext?.hand?.length
      ?? state?.players?.[playerIndex]?.hand?.length
      ?? 0;
    const levelRank = tableContext?.levelRank ?? state?.levelRank ?? "2";
    const looseRanks = looseSmallSingleRanks(
      tableContext?.hand ?? state?.players?.[playerIndex]?.hand ?? [],
      levelRank,
    );
    const usesWild = (candidate.wildcardAssignments?.length ?? 0) > 0;
    // 手牌仍多（>16）且有散单试探路线时，不宜空扔第二条同花顺（game-4 第13手）；无配自然同花顺在16张以内支持接风减手
    if (looseRanks.length > 0 && (usesWild ? handLen > 12 : handLen > CATCH_WIND_RUNWAY_HAND_MAX)) return false;
    return !usesWild
      && !playerJustWonTrickWithPlainFourBomb(state, playerIndex)
      && handLen > (candidate.cards?.length ?? 0)
      && (candidate.cards?.length ?? 0) === 5;
  }
  if (candidate.type === PLAY_TYPES.tripleWithPair) {
    const handLen = tableContext?.hand?.length
      ?? state?.players?.[playerIndex]?.hand?.length
      ?? 0;
    const usesWild = (candidate.wildcardAssignments?.length ?? 0) > 0;
    const mainCount = (candidate.cards ?? []).filter((card) => card.rank === candidate.mainRank).length;
    return !usesWild
      && handLen <= CATCH_WIND_RUNWAY_HAND_MAX
      && (candidate.cards?.length ?? 0) === 5
      && mainCount === 3;
  }
  return isCatchWindPremiumReduction(candidate, tableContext);
}

/** @deprecated 别名，保留兼容 */
export function isCatchWindHeavyStraightFlushReduction(candidate, tableContext) {
  return isCatchWindPremiumReduction(candidate, tableContext);
}

/** 接风前一手是否为自己打出的四炸（不含五炸/同花顺/王炸）夺权 */
export function playerJustWonTrickWithPlainFourBomb(state, playerIndex) {
  const history = state?.playHistory ?? [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    const play = entry?.play;
    if (!play || play.type === PLAY_TYPES.pass || play.isPass) continue;
    if (entry.playerIndex !== playerIndex) return false;
    if (play.type !== PLAY_TYPES.bomb) return false;
    const size = play.bombSize ?? play.cards?.length ?? 0;
    return size === 4;
  }
  return false;
}
