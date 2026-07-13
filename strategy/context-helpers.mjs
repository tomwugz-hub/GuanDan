/**
 * 桌面上下文辅助 — 无 v3 依赖，供 table-context / partner-inference 共用
 */
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { isTeammate, teammateIndex } from "./seat-utils.mjs";

/** 队友剩余张数（未出完） */
export function partnerHandCount(tableContext) {
  const state = tableContext.state;
  if (!state) return 27;
  const selfIndex = tableContext.playerIndex ?? state.currentPlayerIndex ?? 0;
  const partner = teammateIndex(selfIndex);
  const player = state.players.find((item) => item.seatIndex === partner);
  if (player?.finishedOrder) return 0;
  return player?.hand?.length ?? 27;
}

/**
 * 队友本局首次实牌首发牌路（非过牌），供 T5 送桥推断。
 */
export function partnerOpeningRoute(tableContext) {
  const state = tableContext.state;
  if (!state?.playHistory?.length) return null;
  const selfIndex = tableContext.playerIndex ?? state.currentPlayerIndex ?? 0;
  const partner = teammateIndex(selfIndex);
  for (const entry of state.playHistory) {
    const play = entry.play;
    if (entry.playerIndex !== partner) continue;
    if (!play || play.type === PLAY_TYPES.pass) continue;
    return { type: play.type, mainRank: play.mainRank ?? null };
  }
  return null;
}

/**
 * 斗牌阶段：early 手数少/牌多，late 有人≤6张
 */
export function gamePhase(tableContext) {
  const state = tableContext.state;
  const historyLen = state?.playHistory?.length ?? 0;
  const selfIndex = tableContext.playerIndex ?? state?.currentPlayerIndex ?? 0;
  const handLen = tableContext.hand?.length
    ?? state?.players?.[selfIndex]?.hand?.length
    ?? 27;
  let anyoneLow = false;
  if (state?.players) {
    for (const player of state.players) {
      if (player.finishedOrder) continue;
      if (player.hand?.length <= 6) anyoneLow = true;
    }
  }
  if (anyoneLow || handLen <= 8 || historyLen >= 48) return "late";
  if (historyLen < 16 && handLen >= 18) return "early";
  return "mid";
}

/** 尚未出完的对手中最少余牌数 */
export function minOpponentHandCount(tableContext) {
  const state = tableContext.state;
  if (!state) return 99;
  const selfIndex = tableContext.playerIndex ?? state.currentPlayerIndex ?? 0;
  let min = Infinity;
  for (const player of state.players) {
    if (player.finishedOrder || player.seatIndex === selfIndex) continue;
    if (isTeammate(selfIndex, player.seatIndex)) continue;
    min = Math.min(min, player.hand.length);
  }
  return min === Infinity ? 99 : min;
}
