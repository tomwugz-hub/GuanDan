import { PLAY_TYPES } from "../engine/play-types.mjs";
import { inferLeadMode } from "./lead-mode.mjs";

/** 当前墩内、最近一次「三家过」之后的出牌序列 */
function currentRoundActions(state) {
  const history = state?.playHistory ?? [];
  if (history.length === 0) return [];

  let start = 0;
  let passStreak = 0;
  for (let i = 0; i < history.length; i += 1) {
    if (history[i].play?.type === PLAY_TYPES.pass) {
      passStreak += 1;
      if (passStreak >= 3) start = i + 1;
    } else {
      passStreak = 0;
    }
  }
  return history.slice(start);
}

/** 本墩队友是否已出过非过牌（仅历史记录；P10 让牌须看 partnerOwnsTrick） */
export function partnerPlayedInCurrentRound(state, playerIndex) {
  if (!state?.playHistory?.length) return false;
  const lastActive = state.lastActivePlayerIndex;
  if (lastActive == null || isTeammate(playerIndex, lastActive)) return false;

  const partner = teammateIndex(playerIndex);
  return currentRoundActions(state).some(
    (entry) => entry.playerIndex === partner && entry.play?.type !== PLAY_TYPES.pass,
  );
}

/** 本手能否出完（仅余 1 张且存在合法非过牌） */
export function canFinishOnThisTurn(tableContext) {
  const hand = tableContext.hand
    ?? tableContext.state?.players?.[
      tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex
    ]?.hand
    ?? [];
  if (hand.length !== 1) return false;
  return tableContext.hasAnyWinner === true;
}

/** P10 让牌：队友为当前墩最后占牌者且仍有效（残局能走完时例外） */
export function shouldYieldPassToPartner(tableContext) {
  if (canFinishOnThisTurn(tableContext)) return false;
  return !!tableContext.partnerOwnsTrick && !tableContext.isFinishingPlay;
}

export function teammateIndex(playerIndex) {
  return (playerIndex + 2) % 4;
}

export function isTeammate(leftIndex, rightIndex) {
  if (leftIndex == null || rightIndex == null) return false;
  return teammateIndex(leftIndex) === rightIndex;
}

export function isOpponentActive(tableContext) {
  const { playerIndex, lastActivePlayerIndex, previousPlay } = tableContext;
  if (!previousPlay || previousPlay.type === PLAY_TYPES.pass) return false;
  return !isTeammate(playerIndex, lastActivePlayerIndex);
}

export function activePlayerCount(tableContext) {
  const state = tableContext.state;
  if (!state) return 4;
  return state.players.filter((player) => !player.finishedOrder).length;
}

export function opponentDangerLevel(tableContext) {
  const state = tableContext.state;
  if (!state) return 0;
  const selfIndex = tableContext.playerIndex ?? 0;
  let danger = 0;
  for (const player of state.players) {
    if (player.finishedOrder || player.seatIndex === selfIndex) continue;
    if (isTeammate(selfIndex, player.seatIndex)) continue;
    const count = player.hand.length;
    if (count <= 1) danger = Math.max(danger, 3);
    else if (count <= 3) danger = Math.max(danger, 2);
    else if (count <= 6) danger = Math.max(danger, 1);
  }
  return danger;
}

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

export function enrichScoringContext(tableContext, candidates, hand, levelRank) {
  const previousPlay = tableContext.previousPlay ?? null;
  const isOpening = !previousPlay || previousPlay.type === PLAY_TYPES.pass;
  const partnerOwnsTrick = !isOpening && isTeammate(
    tableContext.playerIndex,
    tableContext.lastActivePlayerIndex,
  );
  const beaters = candidates.filter((candidate) => candidate.type !== PLAY_TYPES.pass);
  const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);
  const regularBeaters = beaters.filter((candidate) => !BOMB_TYPES.has(candidate.type));

  const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex;
  const leadMode = isOpening && tableContext.leadMode != null
    ? tableContext.leadMode
    : isOpening && tableContext.state && playerIndex != null
      ? inferLeadMode(tableContext.state, playerIndex)
      : isOpening ? "fresh-open" : "must-beat";
  const partnerAttemptedCurrentRound = !isOpening
    && tableContext.state
    && playerIndex != null
    && partnerPlayedInCurrentRound(tableContext.state, playerIndex);

  return {
    ...tableContext,
    hand,
    levelRank: tableContext.levelRank ?? levelRank,
    isOpening,
    leadMode,
    partnerOwnsTrick,
    partnerAttemptedCurrentRound,
    opponentActive: isOpponentActive({ ...tableContext, previousPlay }),
    hasAnyWinner: beaters.length > 0,
    hasRegularWinner: regularBeaters.length > 0,
    danger: opponentDangerLevel(tableContext),
    bombInventory: tableContext.bombInventory ?? evaluateBombInventory(hand, levelRank),
  };
}

export function evaluateBombInventory(hand, levelRank) {
  const rankCounts = new Map();
  let straightFlush = 0;
  let jokerBomb = 0;
  for (const card of hand) {
    if (card.rank === "SJ" || card.rank === "BJ") continue;
    if (card.rank === levelRank && card.suit === "H") continue;
    rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
  }
  const jokers = hand.filter((card) => card.rank === "SJ" || card.rank === "BJ").length;
  if (jokers === 4) jokerBomb = 1;
  let bombs = jokerBomb;
  for (const count of rankCounts.values()) {
    if (count >= 4) bombs += 1;
  }
  return { bombs, straightFlush, jokerBomb };
}
