import { PLAY_TYPES } from "../engine/play-types.mjs";
import { opponentsPendingAfterPlayer, effectivePreviousPlay, resolveTrickLeaderIndex, partnerLeadWasSuperseded } from "../engine/game-state.mjs";
import { compareRanks } from "../engine/rank-order.mjs";
import { inferLeadMode } from "./lead-mode.mjs";
import { buildCardMemory, estimateCardMemory } from "./card-memory.mjs";
import { getPartnerInference } from "./partner-inference.mjs";
import { getRouteContext } from "./route-memory.mjs";
import {
  gamePhase,
  partnerHandCount,
  partnerOpeningRoute,
  minOpponentHandCount,
} from "./context-helpers.mjs";
import {
  isTeammate,
  teammateIndex,
  upperPlayerIndex,
  lowerPlayerIndex,
  isUpperPlayer,
  isLowerPlayer,
} from "./seat-utils.mjs";

export {
  gamePhase,
  partnerHandCount,
  partnerOpeningRoute,
  minOpponentHandCount,
  estimateCardMemory,
  isTeammate,
  teammateIndex,
  upperPlayerIndex,
  lowerPlayerIndex,
  isUpperPlayer,
  isLowerPlayer,
};

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

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

/**
 * 队友占牌是否可能被下家对手用低价同型抢走（须最小散单/小对防抢权）。
 * 王对/炸弹/同花顺及 Q 以上对子、J 以上单张：对手无法用低价抢权，不必防守。
 */
export function partnerLeadNeedsGuard(tableContext) {
  const play = tableContext.previousPlay ?? tableContext.state?.lastActivePlay;
  const levelRank = tableContext.state?.levelRank ?? tableContext.levelRank ?? "2";
  if (!play || play.type === PLAY_TYPES.pass) return false;
  if (BOMB_TYPES.has(play.type)) return false;
  if (play.type === PLAY_TYPES.pair && (play.mainRank === "BJ" || play.mainRank === "SJ")) return false;
  if (play.type === PLAY_TYPES.single) {
    return compareRanks(play.mainRank, "J", levelRank) < 0;
  }
  if (play.type === PLAY_TYPES.pair) {
    return compareRanks(play.mainRank, "Q", levelRank) < 0;
  }
  return false;
}

/** P10 让牌：队友占牌且本墩对手均已表态（或接风在即）时再让；下家对手未表态时须防抢权 */
export function shouldYieldPassToPartner(tableContext) {
  if (canFinishOnThisTurn(tableContext)) return false;
  if (!tableContext.partnerOwnsTrick || tableContext.isFinishingPlay) return false;
  const state = tableContext.state;
  const selfIndex = tableContext.playerIndex ?? state?.currentPlayerIndex ?? 0;
  const pending = state ? opponentsPendingAfterPlayer(state, selfIndex) : [];
  if (pending.length > 0 && partnerLeadNeedsGuard(tableContext)) return false;
  return true;
}

/** 占牌者座位：优先 playHistory，避免 lastActivePlayerIndex 滞后误判 P10 队友占牌 */
export function resolveLastActivePlayerIndex(tableContext) {
  const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex ?? null;
  if (tableContext.state) {
    const fromHistory = resolveTrickLeaderIndex(tableContext.state, playerIndex);
    if (fromHistory != null) return fromHistory;
  }
  return tableContext.lastActivePlayerIndex ?? tableContext.state?.lastActivePlayerIndex ?? null;
}

export function isOpponentActive(tableContext) {
  const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex;
  const lastActivePlayerIndex = resolveLastActivePlayerIndex(tableContext);
  const previousPlay = tableContext.previousPlay
    ?? (tableContext.state ? effectivePreviousPlay(tableContext.state) : null);
  if (!previousPlay || previousPlay.type === PLAY_TYPES.pass) return false;
  if (playerIndex == null || lastActivePlayerIndex == null) return false;
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

/** 尚未出完的对手中是否有人只剩 1 张（报单） */
export function opponentsWithOneCard(tableContext) {
  const state = tableContext.state;
  if (!state) return [];
  const selfIndex = tableContext.playerIndex ?? state.currentPlayerIndex ?? 0;
  return state.players.filter(
    (player) => !player.finishedOrder
      && !isTeammate(selfIndex, player.seatIndex)
      && player.hand.length === 1,
  );
}

export function enrichScoringContext(tableContext, candidates, hand, levelRank) {
  const state = tableContext.state;
  const playerIndex = tableContext.playerIndex ?? state?.currentPlayerIndex;
  const resolvedLastActive = resolveLastActivePlayerIndex(tableContext);
  const previousPlay = state
    ? (effectivePreviousPlay(state) ?? (tableContext.previousPlay ?? null))
    : (tableContext.previousPlay ?? null);
  const isOpening = !previousPlay || previousPlay.type === PLAY_TYPES.pass;
  const supersededPartner = Boolean(
    state && playerIndex != null && previousPlay
    && partnerLeadWasSuperseded(state, playerIndex, previousPlay),
  );
  const partnerOwnsTrick = !isOpening
    && !supersededPartner
    && playerIndex != null
    && resolvedLastActive != null
    && isTeammate(playerIndex, resolvedLastActive);
  const beaters = candidates.filter((candidate) => candidate.type !== PLAY_TYPES.pass);
  const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);
  const regularBeaters = beaters.filter((candidate) => !BOMB_TYPES.has(candidate.type));

  const leadMode = isOpening && tableContext.leadMode != null
    ? tableContext.leadMode
    : isOpening && tableContext.state && playerIndex != null
      ? inferLeadMode(tableContext.state, playerIndex)
      : isOpening ? "fresh-open" : "must-beat";
  const partnerAttemptedCurrentRound = !isOpening
    && tableContext.state
    && playerIndex != null
    && partnerPlayedInCurrentRound(tableContext.state, playerIndex);

  const selfIndex = playerIndex ?? state?.currentPlayerIndex ?? 0;
  const cardMemory = tableContext.cardMemory
    ?? (state ? buildCardMemory(state, selfIndex, hand) : estimateCardMemory(tableContext));
  const routeMemory = tableContext.routeMemory
    ?? (state ? getRouteContext(state, selfIndex) : null);
  const partnerInference = tableContext.partnerInference
    ?? (state ? getPartnerInference(state, selfIndex) : null);
  const phase = tableContext.gamePhase ?? gamePhase({ ...tableContext, hand });

  return {
    ...tableContext,
    hand,
    playerIndex,
    lastActivePlayerIndex: resolvedLastActive,
    levelRank: tableContext.levelRank ?? levelRank,
    isOpening,
    leadMode,
    partnerOwnsTrick,
    partnerAttemptedCurrentRound,
    opponentActive: supersededPartner
      || isOpponentActive({ ...tableContext, playerIndex, lastActivePlayerIndex: resolvedLastActive, previousPlay }),
    hasAnyWinner: beaters.length > 0,
    hasRegularWinner: regularBeaters.length > 0,
    danger: opponentDangerLevel(tableContext),
    bombInventory: tableContext.bombInventory ?? evaluateBombInventory(hand, levelRank),
    cardMemory,
    routeMemory,
    partnerInference,
    gamePhase: phase,
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
