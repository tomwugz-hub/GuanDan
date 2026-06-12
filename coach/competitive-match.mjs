import { cardId, isJoker, isWildCard } from "../engine/card.mjs";
import { createInitialGameState, isGameOver } from "../engine/game-state.mjs";
import { rankPower } from "../engine/rank-order.mjs";
import { runAutoGame } from "./auto-game.mjs";

export const COMPETITIVE_RANKS = Object.freeze(["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]);
const TEAMS = Object.freeze([
  { id: 0, players: [0, 2] },
  { id: 1, players: [1, 3] },
]);
const RETURNABLE_RANKS = new Set(["2", "3", "4", "5", "6", "7", "8", "9", "10"]);

function teamOfPlayer(playerIndex) {
  return playerIndex % 2 === 0 ? 0 : 1;
}

function nextRank(rank, steps) {
  const index = COMPETITIVE_RANKS.indexOf(rank);
  if (index === -1) throw new Error(`Unknown competitive rank: ${rank}`);
  return COMPETITIVE_RANKS[Math.min(COMPETITIVE_RANKS.length - 1, index + steps)];
}

function cardStrength(card, levelRank) {
  if (card.rank === "BJ") return 10_000 + card.deckIndex;
  if (card.rank === "SJ") return 9_000 + card.deckIndex;
  return rankPower(card.rank, levelRank) * 10 + card.deckIndex;
}

function highestCard(hand, levelRank) {
  const tributeCandidates = hand.filter((card) => !isWildCard(card, levelRank));
  return [...tributeCandidates].sort((left, right) => cardStrength(right, levelRank) - cardStrength(left, levelRank))[0] ?? null;
}

function lowestReturnCard(hand, levelRank) {
  const returnable = hand.filter((card) => RETURNABLE_RANKS.has(card.rank) && card.rank !== levelRank);
  const source = returnable.length > 0 ? returnable : hand.filter((card) => card.rank !== "SJ" && card.rank !== "BJ");
  const rankCounts = new Map();
  for (const card of hand) {
    if (isJoker(card) || isWildCard(card, levelRank)) continue;
    rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
  }

  function returnDamage(card) {
    if (isJoker(card)) return 10_000;
    if (isWildCard(card, levelRank)) return 9_000;
    const count = rankCounts.get(card.rank) ?? 0;
    if (count >= 5) return 6_000 + count * 100;
    if (count === 4) return 5_000;
    if (count === 3) return 1_200;
    if (count === 2) return 420;
    return 0;
  }

  return [...source].sort((left, right) => {
    const damageDiff = returnDamage(left) - returnDamage(right);
    if (damageDiff !== 0) return damageDiff;
    return cardStrength(left, levelRank) - cardStrength(right, levelRank);
  })[0] ?? null;
}

function removeCard(hand, target) {
  const targetId = cardId(target);
  let removed = false;
  return hand.filter((card) => {
    if (!removed && cardId(card) === targetId) {
      removed = true;
      return false;
    }
    return true;
  });
}

function moveCard(players, fromIndex, toIndex, card) {
  return players.map((player, index) => {
    if (index === fromIndex) return { ...player, hand: removeCard(player.hand, card) };
    if (index === toIndex) return { ...player, hand: [...player.hand, card] };
    return player;
  });
}

function hasDoubleBigJokers(players, tributePlayerIndexes) {
  return tributePlayerIndexes
    .flatMap((playerIndex) => players[playerIndex].hand)
    .filter((card) => card.rank === "BJ").length >= 2;
}

function tributePairsForResult(finishedPlayers) {
  const first = finishedPlayers[0];
  const second = finishedPlayers[1];
  const third = finishedPlayers[2];
  const fourth = finishedPlayers[3];
  if (teamOfPlayer(first) === teamOfPlayer(second)) {
    return [
      { from: fourth, to: first, kind: "double-last-to-first" },
      { from: third, to: second, kind: "double-third-to-second" },
    ];
  }
  return [{ from: fourth, to: first, kind: "single-last-to-first" }];
}

/** 抗贡后新局未出牌时，校正为先手为头游（修复旧存档/旧逻辑） */
export function fixResistTributeStarter(gameState, matchLike) {
  if (!gameState || !matchLike) return gameState;
  const hasResist = (matchLike.pendingTributeEvents ?? []).some((e) => e.type === "resist-tribute");
  if (!hasResist) return gameState;
  const isFreshRound = (gameState.playHistory?.length ?? 0) === 0 && !gameState.lastActivePlay;
  if (!isFreshRound) return gameState;
  const head = matchLike.previousFinishedPlayers?.[0];
  if (head == null || gameState.currentPlayerIndex === head) return gameState;
  return { ...gameState, currentPlayerIndex: head };
}

export function applyTribute(gameState, previousFinishedPlayers) {
  const pairs = tributePairsForResult(previousFinishedPlayers);
  const tributePlayerIndexes = pairs.map((pair) => pair.from);
  if (hasDoubleBigJokers(gameState.players, tributePlayerIndexes)) {
    // 抗贡后由上游（头游）先出牌，不是进贡方也不是末游
    const starterIndex = previousFinishedPlayers[0] ?? 0;
    return {
      state: {
        ...gameState,
        currentPlayerIndex: starterIndex,
      },
      starterIndex,
      events: [{ type: "resist-tribute", players: tributePlayerIndexes }],
    };
  }

  let players = gameState.players;
  const events = [];
  const tributes = pairs
    .map((pair) => ({
      ...pair,
      tributeCard: highestCard(players[pair.from].hand, gameState.levelRank),
    }))
    .filter((item) => item.tributeCard);

  if (tributes.length === 2) {
    tributes.sort((left, right) => cardStrength(right.tributeCard, gameState.levelRank) - cardStrength(left.tributeCard, gameState.levelRank));
    tributes[0].to = previousFinishedPlayers[0];
    tributes[0].kind = "double-largest-to-first";
    tributes[1].to = previousFinishedPlayers[1];
    tributes[1].kind = "double-remaining-to-second";
  }

  for (const tribute of tributes) {
    players = moveCard(players, tribute.from, tribute.to, tribute.tributeCard);
    const returnCard = lowestReturnCard(players[tribute.to].hand, gameState.levelRank);
    if (returnCard) players = moveCard(players, tribute.to, tribute.from, returnCard);
    events.push({
      type: "tribute",
      kind: tribute.kind,
      from: tribute.from,
      to: tribute.to,
      tributeCard: tribute.tributeCard,
      returnCard,
    });
  }

  const starterIndex = tributes[0]?.from ?? pairs[0]?.from ?? previousFinishedPlayers.at(-1) ?? 0;
  return {
    state: {
      ...gameState,
      players,
      currentPlayerIndex: starterIndex,
    },
    starterIndex,
    events,
  };
}

export function settleGame(gameState, currentLevels) {
  if (!isGameOver(gameState)) throw new Error("Cannot settle an unfinished game.");
  const [first, second] = gameState.finishedPlayers;
  const winningTeam = teamOfPlayer(first);
  const sameTeamSecond = teamOfPlayer(second) === winningTeam;
  const upgradeSteps = sameTeamSecond ? 3 : gameState.finishedPlayers[2] !== undefined && teamOfPlayer(gameState.finishedPlayers[2]) === winningTeam ? 2 : 1;
  const nextLevels = [...currentLevels];
  const wasAtAce = currentLevels[winningTeam] === "A";
  const matchComplete = wasAtAce && sameTeamSecond;
  if (!matchComplete) nextLevels[winningTeam] = nextRank(currentLevels[winningTeam], upgradeSteps);

  return {
    winningTeam,
    upgradeSteps,
    sameTeamSecond,
    matchComplete,
    nextLevels,
  };
}

export function createCompetitiveMatch({ random = Math.random, startingRank = "2" } = {}) {
  const levels = [startingRank, startingRank];
  const game = createInitialGameState({ levelRank: levels[0], random });
  return {
    levels,
    currentLevelRank: levels[0],
    currentGame: game,
    gameNumber: 1,
    previousFinishedPlayers: null,
    complete: false,
    winnerTeam: null,
    history: [],
    pendingTributeEvents: [],
  };
}

export function startNextCompetitiveGame(match, { random = Math.random } = {}) {
  if (match.complete) return match;
  const game = createInitialGameState({ levelRank: match.currentLevelRank, random });
  if (!match.previousFinishedPlayers) {
    return {
      ...match,
      currentGame: game,
      pendingTributeEvents: [],
    };
  }
  const tribute = applyTribute(game, match.previousFinishedPlayers);
  return {
    ...match,
    currentGame: tribute.state,
    pendingTributeEvents: tribute.events,
  };
}

export function finishCompetitiveGame(match, completedGame) {
  const settlement = settleGame(completedGame, match.levels);
  const nextHistory = [
    ...match.history,
    {
      gameNumber: match.gameNumber,
      levelRank: completedGame.levelRank,
      finishedPlayers: completedGame.finishedPlayers,
      tributeEvents: match.pendingTributeEvents,
      settlement,
    },
  ];
  if (settlement.matchComplete) {
    return {
      ...match,
      currentGame: completedGame,
      levels: settlement.nextLevels,
      complete: true,
      winnerTeam: settlement.winningTeam,
      history: nextHistory,
      previousFinishedPlayers: completedGame.finishedPlayers,
      pendingTributeEvents: [],
    };
  }
  return {
    ...match,
    levels: settlement.nextLevels,
    currentLevelRank: settlement.nextLevels[settlement.winningTeam],
    currentGame: completedGame,
    gameNumber: match.gameNumber + 1,
    previousFinishedPlayers: completedGame.finishedPlayers,
    history: nextHistory,
    pendingTributeEvents: [],
  };
}

export function runCompetitiveMatch({ random = Math.random, maxGames = 80, maxTurnsPerGame = 700 } = {}) {
  let match = createCompetitiveMatch({ random, startingRank: "2" });
  const games = [];

  while (!match.complete && games.length < maxGames) {
    if (games.length > 0) match = startNextCompetitiveGame(match, { random });
    const result = runAutoGame(match.currentGame, { maxTurns: maxTurnsPerGame });
    games.push(result);
    if (!result.isComplete) {
      return {
        match,
        games,
        isComplete: false,
        hitGameLimit: false,
        hitTurnLimit: true,
      };
    }
    match = finishCompetitiveGame(match, result.state);
  }

  return {
    match,
    games,
    isComplete: match.complete,
    hitGameLimit: !match.complete && games.length >= maxGames,
    hitTurnLimit: false,
  };
}

export const competitiveRules = Object.freeze({
  teamOfPlayer,
  nextRank,
  applyTribute,
});
