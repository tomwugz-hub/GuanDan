import { cardId, playSignature } from "./card.mjs";
import { classifyPlay } from "./classify-play.mjs";
import { canBeat } from "./compare-play.mjs";
import { createDoubleDeck, dealFourPlayers, shuffle } from "./deck.mjs";
import { PLAY_TYPES } from "./play-types.mjs";

const PLAYER_COUNT = 4;
const TEAMS = Object.freeze([
  [0, 2],
  [1, 3],
]);

function nextActivePlayerIndex(players, startIndex) {
  for (let offset = 1; offset <= PLAYER_COUNT; offset += 1) {
    const index = (startIndex - offset + PLAYER_COUNT) % PLAYER_COUNT;
    if (!players[index].finishedOrder) return index;
  }
  return startIndex;
}

/** 顺时针下一家（本墩「其后」玩家须用此方向） */
function forwardActivePlayerIndex(players, startIndex) {
  for (let offset = 1; offset <= PLAYER_COUNT; offset += 1) {
    const index = (startIndex + offset) % PLAYER_COUNT;
    if (!players[index].finishedOrder) return index;
  }
  return startIndex;
}

function teammateIndex(playerIndex) {
  return (playerIndex + 2) % PLAYER_COUNT;
}

function catchWindPlayerIndex(players, finishedPlayerIndex) {
  const partnerIndex = teammateIndex(finishedPlayerIndex);
  if (!players[partnerIndex].finishedOrder) return partnerIndex;
  return nextActivePlayerIndex(players, finishedPlayerIndex);
}

/** 从 playHistory 尾部统计连续过牌数，自愈 passCount 与历史不同步 */
function trailingPassCount(state) {
  let count = 0;
  for (let index = state.playHistory.length - 1; index >= 0; index -= 1) {
    if (state.playHistory[index].play?.type === PLAY_TYPES.pass) count += 1;
    else break;
  }
  return count;
}

/** 本墩 playHistory 中最后一条非过牌记录 */
function lastSubstantiveHistoryEntry(state) {
  const history = state?.playHistory;
  if (!history?.length) return null;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (entry.play?.type !== PLAY_TYPES.pass) return entry;
  }
  return null;
}

/** 本墩最后一条非过牌记录的玩家（比 lastActivePlayerIndex 更可靠） */
function lastSubstantivePlayerIndex(state) {
  const entry = lastSubstantiveHistoryEntry(state);
  if (entry) return entry.playerIndex;
  return state?.lastActivePlayerIndex ?? null;
}

/** history 中查找与 targetPlay 同型的出牌者（可选：仅从 afterEntry 之后查） */
function findPlayOwnerInHistory(state, targetPlay, afterEntry = null) {
  if (!state?.playHistory?.length || !targetPlay) return null;
  const targetSig = playSignature(targetPlay);
  let startIdx = 0;
  if (afterEntry) {
    const pos = state.playHistory.indexOf(afterEntry);
    if (pos >= 0) startIdx = pos + 1;
  }
  for (let i = state.playHistory.length - 1; i >= startIdx; i -= 1) {
    const entry = state.playHistory[i];
    if (entry.play?.type !== PLAY_TYPES.pass && playSignature(entry.play) === targetSig) {
      return entry.playerIndex;
    }
  }
  return null;
}

/**
 * 桌面须压牌已压过队友上一手（如勇哥对5 压 老史对4），占牌者必为对手。
 */
export function partnerLeadWasSuperseded(state, playerIndex, currentPlay) {
  if (!state || playerIndex == null || !currentPlay || currentPlay.type === PLAY_TYPES.pass) {
    return false;
  }
  const histEntry = lastSubstantiveHistoryEntry(state);
  if (!histEntry) return false;
  if (playSignature(histEntry.play) === playSignature(currentPlay)) return false;
  if (!canBeat(currentPlay, histEntry.play)) return false;
  return teammateIndex(playerIndex) === histEntry.playerIndex;
}

/**
 * 本墩占牌者：history 与 lastActive 一致时以 history 修正 stale index；
 * history 落后时以 lastActive 为准；须压牌压过队友时占牌者必为对手。
 */
export function resolveTrickLeaderIndex(state, playerIndex = null) {
  if (!state) return null;
  const activePlay = state.lastActivePlay;
  const activeIdx = state.lastActivePlayerIndex;
  if (!activePlay || activePlay.type === PLAY_TYPES.pass) {
    return lastSubstantivePlayerIndex(state) ?? activeIdx ?? null;
  }
  const histEntry = lastSubstantiveHistoryEntry(state);
  if (!histEntry) return activeIdx ?? null;

  if (playerIndex != null && partnerLeadWasSuperseded(state, playerIndex, activePlay)) {
    const beater = findPlayOwnerInHistory(state, activePlay, histEntry);
    if (beater != null) return beater;
    if (activeIdx != null && teammateIndex(playerIndex) !== activeIdx) return activeIdx;
    return forwardActivePlayerIndex(state.players, histEntry.playerIndex);
  }

  if (playSignature(histEntry.play) === playSignature(activePlay)) {
    return histEntry.playerIndex ?? activeIdx ?? null;
  }
  // history 已记录更强占牌（如对手单8 压过队友单7），lastActive 滞后时以 history 为准
  if (canBeat(histEntry.play, activePlay)) {
    return histEntry.playerIndex ?? activeIdx ?? null;
  }
  if (canBeat(activePlay, histEntry.play)) {
    return activeIdx ?? histEntry.playerIndex ?? null;
  }
  return histEntry.playerIndex ?? activeIdx ?? null;
}

/** 本墩占牌者仍需回应的未出完玩家数 */
function activeResponseCount(state, leadIndex) {
  if (leadIndex === null || leadIndex === undefined) return 0;
  return state.players.filter(
    (player, index) => index !== leadIndex && !player.finishedOrder,
  ).length;
}

/**
 * lastActivePlay 未清但 playHistory 显示本墩已收（三家过）：接风待领出。
 * 常见于机器人队列并发导致 passTurn 清空台面失败。
 */
export function isCatchWindPending(state) {
  if (!state?.lastActivePlay || state.lastActivePlay.type === PLAY_TYPES.pass) {
    return false;
  }
  const leadIndex = lastSubstantivePlayerIndex(state) ?? state.lastActivePlayerIndex;
  if (leadIndex === null || leadIndex === undefined) return false;
  const opponents = activeResponseCount(state, leadIndex);
  if (opponents <= 0) return false;
  return trailingPassCount(state) >= opponents;
}

/** 接风待领出时返回 null；history 更强占牌时优先 history，避免 stale lastActivePlay 误判队友占牌 */
export function effectivePreviousPlay(state) {
  if (!state?.lastActivePlay || state.lastActivePlay.type === PLAY_TYPES.pass) {
    return null;
  }
  if (isCatchWindPending(state)) return null;
  const active = state.lastActivePlay;
  const histEntry = lastSubstantiveHistoryEntry(state);
  if (histEntry?.play && playSignature(histEntry.play) !== playSignature(active)) {
    if (canBeat(histEntry.play, active)) {
      return histEntry.play;
    }
  }
  return active;
}

/** 三家过牌后接风：占牌者未走完则本人接风，已走完则队友接风 */
function resolveTrickWindPlayerIndex(state) {
  const winnerIndex = lastSubstantivePlayerIndex(state);
  if (winnerIndex === null || winnerIndex === undefined) return state.currentPlayerIndex;
  if (state.players[winnerIndex]?.finishedOrder) {
    return catchWindPlayerIndex(state.players, winnerIndex);
  }
  return winnerIndex;
}

function removeCardsFromHand(hand, cardsToRemove) {
  const remainingIds = new Map();
  for (const card of cardsToRemove) {
    const id = cardId(card);
    remainingIds.set(id, (remainingIds.get(id) ?? 0) + 1);
  }

  const nextHand = [];
  for (const card of hand) {
    const id = cardId(card);
    const count = remainingIds.get(id) ?? 0;
    if (count > 0) {
      remainingIds.set(id, count - 1);
    } else {
      nextHand.push(card);
    }
  }

  const missing = [...remainingIds.values()].reduce((sum, count) => sum + count, 0);
  if (missing > 0) {
    throw new Error("Selected cards are not all present in the current player's hand.");
  }

  return nextHand;
}

function createPlayers(hands) {
  return hands.map((hand, index) => ({
    id: `player-${index}`,
    name: `玩家 ${index + 1}`,
    seatIndex: index,
    hand,
    finishedOrder: null,
  }));
}

function finishedCount(players) {
  return players.filter((player) => player.finishedOrder).length;
}

function completeFinalPlayer(players, finishedPlayers) {
  if (finishedPlayers.length !== PLAYER_COUNT - 1) {
    return { players, finishedPlayers };
  }

  const finalPlayerIndex = players.findIndex((player) => !player.finishedOrder);
  if (finalPlayerIndex === -1) {
    return { players, finishedPlayers };
  }

  const nextPlayers = players.map((player, index) => index === finalPlayerIndex
    ? { ...player, finishedOrder: PLAYER_COUNT }
    : player);

  return {
    players: nextPlayers,
    finishedPlayers: [...finishedPlayers, finalPlayerIndex],
  };
}

function completeRemainingPlayers(players, finishedPlayers, startIndex) {
  let nextPlayers = players;
  const nextFinishedPlayers = [...finishedPlayers];
  let cursor = startIndex;

  while (nextFinishedPlayers.length < PLAYER_COUNT) {
    const nextIndex = nextActivePlayerIndex(nextPlayers, cursor);
    if (nextIndex === null || nextFinishedPlayers.includes(nextIndex)) break;
    const finishedOrder = nextFinishedPlayers.length + 1;
    nextPlayers = nextPlayers.map((player, index) => index === nextIndex
      ? { ...player, finishedOrder }
      : player);
    nextFinishedPlayers.push(nextIndex);
    cursor = nextIndex;
  }

  return {
    players: nextPlayers,
    finishedPlayers: nextFinishedPlayers,
  };
}

export function createInitialGameState({ levelRank = "2", random = Math.random } = {}) {
  const deck = shuffle(createDoubleDeck(), random);
  const hands = dealFourPlayers(deck, levelRank);

  return {
    levelRank,
    players: createPlayers(hands),
    currentPlayerIndex: 0,
    lastActivePlay: null,
    lastActivePlayerIndex: null,
    passCount: 0,
    playHistory: [],
    finishedPlayers: [],
    turnNumber: 0,
  };
}

export function createGameStateFromHands({
  levelRank,
  hands,
  currentPlayerIndex = 0,
  lastActivePlay = null,
  lastActivePlayerIndex = null,
  playHistory = [],
  turnNumber = 0,
} = {}) {
  return {
    levelRank,
    players: createPlayers(hands),
    currentPlayerIndex,
    lastActivePlay,
    lastActivePlayerIndex,
    passCount: 0,
    playHistory,
    finishedPlayers: [],
    turnNumber,
  };
}

export function getCurrentPlayer(state) {
  return state.players[state.currentPlayerIndex];
}

export function playCards(state, cards) {
  const player = getCurrentPlayer(state);
  if (player.finishedOrder) {
    throw new Error("Finished players cannot play more cards.");
  }

  const play = classifyPlay(cards, state.levelRank);
  if (play.type === PLAY_TYPES.invalid) {
    throw new Error(`Invalid play: ${play.reason}`);
  }
  if (play.type === PLAY_TYPES.pass) {
    return passTurn(state);
  }
  if (!canBeat(play, state.lastActivePlay)) {
    throw new Error("Selected play cannot beat the previous active play.");
  }

  const nextPlayers = state.players.map((existingPlayer, index) => {
    if (index !== state.currentPlayerIndex) return existingPlayer;
    const nextHand = removeCardsFromHand(existingPlayer.hand, cards);
    const nextFinishedOrder = nextHand.length === 0 ? finishedCount(state.players) + 1 : null;
    return {
      ...existingPlayer,
      hand: nextHand,
      finishedOrder: existingPlayer.finishedOrder ?? nextFinishedOrder,
    };
  });

  const finishedPlayersAfterPlay = nextPlayers[state.currentPlayerIndex].finishedOrder
    ? [...state.finishedPlayers, state.currentPlayerIndex]
    : state.finishedPlayers;
  const completed = hasCompletedTeam(nextPlayers)
    ? completeRemainingPlayers(nextPlayers, finishedPlayersAfterPlay, state.currentPlayerIndex)
    : completeFinalPlayer(nextPlayers, finishedPlayersAfterPlay);
  const gameOverAfterPlay = isGameOver({ ...state, players: completed.players });
  const nextCurrentPlayerIndex = gameOverAfterPlay
    ? state.currentPlayerIndex
    : nextActivePlayerIndex(completed.players, state.currentPlayerIndex);

  return {
    ...state,
    players: completed.players,
    currentPlayerIndex: nextCurrentPlayerIndex,
    lastActivePlay: play,
    lastActivePlayerIndex: state.currentPlayerIndex,
    passCount: 0,
    playHistory: [
      ...state.playHistory,
      {
        turnNumber: state.turnNumber,
        playerIndex: state.currentPlayerIndex,
        play,
      },
    ],
    finishedPlayers: completed.finishedPlayers,
    turnNumber: state.turnNumber + 1,
  };
}

export function passTurn(state) {
  if (!state.lastActivePlay) {
    throw new Error("Cannot pass when there is no active play to beat.");
  }

  const leadIndex = lastSubstantivePlayerIndex(state) ?? state.lastActivePlayerIndex;
  const nextPassCount = trailingPassCount(state) + 1;
  const shouldClearTrick = nextPassCount >= activeResponseCount(state, leadIndex);
  const nextCurrentPlayerIndex = shouldClearTrick
    ? resolveTrickWindPlayerIndex(state)
    : nextActivePlayerIndex(state.players, state.currentPlayerIndex);

  return {
    ...state,
    currentPlayerIndex: nextCurrentPlayerIndex,
    lastActivePlay: shouldClearTrick ? null : state.lastActivePlay,
    lastActivePlayerIndex: shouldClearTrick ? null : state.lastActivePlayerIndex,
    passCount: shouldClearTrick ? 0 : nextPassCount,
    playHistory: [
      ...state.playHistory,
      {
        turnNumber: state.turnNumber,
        playerIndex: state.currentPlayerIndex,
        play: classifyPlay([], state.levelRank),
      },
    ],
    turnNumber: state.turnNumber + 1,
  };
}

function activeOpponentCount(state) {
  return state.players.filter((player, index) => index !== state.lastActivePlayerIndex && !player.finishedOrder).length;
}

/** 本轮出牌记录：从最后一条非 pass 往前到本轮起点 */
export function getCurrentTrickEntries(state) {
  const entries = [];
  for (let index = state.playHistory.length - 1; index >= 0; index -= 1) {
    entries.unshift(state.playHistory[index]);
    if (state.playHistory[index].play.type !== PLAY_TYPES.pass) break;
  }
  return entries;
}

/** 本墩占牌后，当前玩家出牌前，其后仍未表态的对手（防低价抢队友牌权） */
export function opponentsPendingAfterPlayer(state, playerIndex) {
  if (!state?.lastActivePlay || state.lastActivePlayerIndex == null) return [];
  const leadIndex = lastSubstantivePlayerIndex(state) ?? state.lastActivePlayerIndex;

  let winPlayIdx = -1;
  for (let i = state.playHistory.length - 1; i >= 0; i -= 1) {
    const entry = state.playHistory[i];
    if (entry.play?.type !== PLAY_TYPES.pass && entry.playerIndex === leadIndex) {
      winPlayIdx = i;
      break;
    }
  }
  if (winPlayIdx < 0) return [];

  const respondedAfterWin = new Set();
  for (let i = winPlayIdx + 1; i < state.playHistory.length; i += 1) {
    respondedAfterWin.add(state.playHistory[i].playerIndex);
  }

  const pending = [];
  let cursor = forwardActivePlayerIndex(state.players, leadIndex);
  const visited = new Set();
  while (cursor !== leadIndex) {
    // 占牌者已走完时 forward 永远到不了 leadIndex，须防无限循环
    if (visited.has(cursor) || state.players[leadIndex]?.finishedOrder) break;
    visited.add(cursor);
    if (
      cursor !== playerIndex
      && !respondedAfterWin.has(cursor)
      && !state.players[cursor]?.finishedOrder
      && teammateIndex(playerIndex) !== cursor
    ) {
      pending.push(cursor);
    }
    cursor = forwardActivePlayerIndex(state.players, cursor);
  }
  return pending;
}

function postActionCurrentPlayerIndex(state, actorIndex, play) {
  if (play.type === PLAY_TYPES.pass) {
    const leadIndex = lastSubstantivePlayerIndex(state) ?? state.lastActivePlayerIndex;
    const shouldClearTrick = trailingPassCount(state) >= activeResponseCount(state, leadIndex);
    if (shouldClearTrick) return resolveTrickWindPlayerIndex(state);
    return nextActivePlayerIndex(state.players, actorIndex);
  }
  return nextActivePlayerIndex(state.players, actorIndex);
}

/** 检测 currentPlayer 与 playHistory 是否矛盾（常见于机器人队列并发） */
export function detectTurnStuck(state) {
  if (!state || isGameOver(state)) return false;

  if (isCatchWindPending(state)) return true;

  const current = state.currentPlayerIndex;
  const last = state.playHistory[state.playHistory.length - 1];

  if (last?.playerIndex === current) {
    // 合法接风：刚过完牌、台面已清空，同一玩家接风领出
    if (
      last.play?.type === PLAY_TYPES.pass
      && !state.lastActivePlay
      && state.lastActivePlayerIndex === null
    ) {
      return false;
    }
    return true;
  }

  if (!state.lastActivePlay || state.lastActivePlayerIndex === null) return false;

  const trick = getCurrentTrickEntries(state);
  const leadIndex = lastSubstantivePlayerIndex(state) ?? state.lastActivePlayerIndex;
  if (trick.some((entry) => entry.playerIndex === current && entry.playerIndex !== leadIndex)) {
    return true;
  }

  const opponents = activeResponseCount(state, leadIndex);
  const nonLeadPasses = trick.filter(
    (entry) => entry.playerIndex !== leadIndex && entry.play.type === PLAY_TYPES.pass,
  ).length;
  const historyPassCount = trailingPassCount(state);
  if (opponents > 0 && nonLeadPasses >= opponents && historyPassCount < opponents) {
    return true;
  }

  return false;
}

function repairFromCurrentTrick(state) {
  if (!state.lastActivePlay || state.lastActivePlayerIndex === null) return null;

  const trick = getCurrentTrickEntries(state);
  const acted = new Set(trick.map((entry) => entry.playerIndex));
  const leadIndex = lastSubstantivePlayerIndex(state) ?? state.lastActivePlayerIndex;
  const opponents = activeResponseCount(state, leadIndex);
  const nonLeadPasses = trick.filter(
    (entry) => entry.playerIndex !== leadIndex && entry.play.type === PLAY_TYPES.pass,
  ).length;

  if (opponents > 0 && nonLeadPasses >= opponents) {
    const nextIndex = resolveTrickWindPlayerIndex({ ...state, lastActivePlayerIndex: leadIndex });
    return {
      ...state,
      currentPlayerIndex: nextIndex,
      lastActivePlay: null,
      lastActivePlayerIndex: null,
      passCount: 0,
    };
  }

  let cursor = leadIndex;
  for (let step = 0; step < PLAYER_COUNT; step += 1) {
    cursor = nextActivePlayerIndex(state.players, cursor);
    if (!acted.has(cursor) && !state.players[cursor].finishedOrder) {
      return { ...state, currentPlayerIndex: cursor };
    }
  }

  return null;
}

/** 修复矛盾的 currentPlayer，不重复写入 playHistory */
export function repairTurnStuck(state) {
  const leader = resolveTrickLeaderIndex(state, state.currentPlayerIndex);
  if (
    state.lastActivePlay
    && leader != null
    && state.lastActivePlayerIndex != null
    && leader !== state.lastActivePlayerIndex
  ) {
    return {
      state: { ...state, lastActivePlayerIndex: leader },
      repaired: true,
    };
  }

  if (isCatchWindPending(state)) {
    return {
      state: {
        ...state,
        currentPlayerIndex: resolveTrickWindPlayerIndex(state),
        lastActivePlay: null,
        lastActivePlayerIndex: null,
        passCount: 0,
      },
      repaired: true,
    };
  }

  if (!detectTurnStuck(state)) return { state, repaired: false };

  const current = state.currentPlayerIndex;
  const last = state.playHistory[state.playHistory.length - 1];
  const leadIndex = state.lastActivePlayerIndex;
  const currentAlreadyActed = state.lastActivePlay
    && leadIndex !== null
    && getCurrentTrickEntries(state).some(
      (entry) => entry.playerIndex === current && entry.playerIndex !== leadIndex,
    );

  if (currentAlreadyActed) {
    const repaired = repairFromCurrentTrick(state);
    if (repaired) return { state: repaired, repaired: true };
  }

  if (last?.playerIndex === current) {
    const leadIndex = lastSubstantivePlayerIndex(state) ?? state.lastActivePlayerIndex;
    const shouldClear = last.play.type === PLAY_TYPES.pass
      && trailingPassCount(state) >= activeResponseCount(state, leadIndex);
    return {
      state: {
        ...state,
        currentPlayerIndex: postActionCurrentPlayerIndex(state, current, last.play),
        lastActivePlay: shouldClear ? null : state.lastActivePlay,
        lastActivePlayerIndex: shouldClear ? null : state.lastActivePlayerIndex,
        passCount: shouldClear ? 0 : state.passCount,
      },
      repaired: true,
    };
  }

  const repaired = repairFromCurrentTrick(state);
  if (repaired) return { state: repaired, repaired: true };

  return { state, repaired: false };
}

function hasCompletedTeam(players) {
  return TEAMS.some((team) => team.every((playerIndex) => players[playerIndex].finishedOrder));
}

function isAllRanked(players) {
  return players.every((player) => player.finishedOrder);
}

export function isGameOver(state) {
  return isAllRanked(state.players) || hasCompletedTeam(state.players);
}

export function hasTeamCompleted(state) {
  return hasCompletedTeam(state.players);
}
