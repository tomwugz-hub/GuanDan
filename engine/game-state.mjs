import { cardId } from "./card.mjs";
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

/** 本墩最后一条非过牌记录的玩家（比 lastActivePlayerIndex 更可靠） */
function lastSubstantivePlayerIndex(state) {
  for (let index = state.playHistory.length - 1; index >= 0; index -= 1) {
    const entry = state.playHistory[index];
    if (entry.play?.type !== PLAY_TYPES.pass) return entry.playerIndex;
  }
  return state.lastActivePlayerIndex;
}

/** 本墩占牌者仍需回应的未出完玩家数 */
function activeResponseCount(state, leadIndex) {
  if (leadIndex === null || leadIndex === undefined) return 0;
  return state.players.filter(
    (player, index) => index !== leadIndex && !player.finishedOrder,
  ).length;
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

export function createGameStateFromHands({ levelRank, hands, currentPlayerIndex = 0 }) {
  return {
    levelRank,
    players: createPlayers(hands),
    currentPlayerIndex,
    lastActivePlay: null,
    lastActivePlayerIndex: null,
    passCount: 0,
    playHistory: [],
    finishedPlayers: [],
    turnNumber: 0,
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
  const current = state.currentPlayerIndex;
  const last = state.playHistory[state.playHistory.length - 1];

  if (last?.playerIndex === current) return true;

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
