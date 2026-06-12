import { PLAY_TYPES } from "../engine/play-types.mjs";

function initialHandCounts(initialHands, playerCount) {
  if (!Array.isArray(initialHands) || initialHands.length === 0) return null;
  return Array.from({ length: playerCount }, (_, index) => {
    const hand = initialHands[index];
    if (Array.isArray(hand)) return hand.length;
    if (Number.isFinite(hand)) return Number(hand);
    return 0;
  });
}

function activeOpponentCount(playerCount, finishedPlayers, lastActivePlayerIndex) {
  let count = 0;
  for (let index = 0; index < playerCount; index += 1) {
    if (index !== lastActivePlayerIndex && !finishedPlayers.has(index)) count += 1;
  }
  return count;
}

export function groupPlayHistoryByRound(playHistory, { initialHands = null, playerCount = 4 } = {}) {
  const history = Array.isArray(playHistory) ? playHistory : [];
  const counts = initialHandCounts(initialHands, playerCount);
  const finishedPlayers = new Set();
  if (counts) {
    counts.forEach((count, index) => {
      if (count <= 0) finishedPlayers.add(index);
    });
  }

  const rounds = [];
  let currentRound = null;
  let roundClosed = true;
  let lastActivePlayerIndex = null;
  let passCount = 0;

  function startRound() {
    currentRound = { roundNumber: rounds.length + 1, winnerIndex: null, actions: [] };
    rounds.push(currentRound);
    roundClosed = false;
  }

  for (const item of history) {
    const isPass = item.play?.type === PLAY_TYPES.pass;
    if (!currentRound || (roundClosed && !isPass)) startRound();

    currentRound.actions.push(item);

    if (isPass) {
      passCount += 1;
      const neededPasses = counts && lastActivePlayerIndex !== null
        ? activeOpponentCount(playerCount, finishedPlayers, lastActivePlayerIndex)
        : playerCount - 1;
      if (lastActivePlayerIndex !== null && passCount >= Math.max(1, neededPasses)) {
        currentRound.winnerIndex = lastActivePlayerIndex;
        roundClosed = true;
        lastActivePlayerIndex = null;
        passCount = 0;
      }
      continue;
    }

    lastActivePlayerIndex = item.playerIndex;
    passCount = 0;
    roundClosed = false;

    if (counts && Array.isArray(item.play?.cards)) {
      counts[item.playerIndex] = Math.max(0, counts[item.playerIndex] - item.play.cards.length);
      if (counts[item.playerIndex] === 0) finishedPlayers.add(item.playerIndex);
    }
  }

  return rounds;
}
