import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cardLabel, cardsLabel } from "../engine/card.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { createInitialGameState, isGameOver } from "../engine/game-state.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { playRecommendedTurn } from "../coach/robot-player.mjs";
import { buildCanonicalReplay } from "./lib/canonical-replay.mjs";

const workspaceDir = dirname(fileURLToPath(import.meta.url));
const trainingDir = join(workspaceDir, "..", "training-samples");

const PLAYER_NAMES = ["seat-0", "seat-1", "seat-2", "seat-3"];

function parseArgs(argv) {
  return {
    count: Number(argv[2]) > 0 ? Number(argv[2]) : 200,
    maxTurns: Number(argv[3]) > 0 ? Number(argv[3]) : 500,
    seedStart: Number(argv[4]) >= 0 ? Number(argv[4]) : 1000,
    levelRank: argv[5] || "2",
  };
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function playTypeLabel(type) {
  const labels = {
    [PLAY_TYPES.pass]: "过牌",
    [PLAY_TYPES.single]: "单张",
    [PLAY_TYPES.pair]: "对子",
    [PLAY_TYPES.triple]: "三张",
    [PLAY_TYPES.tripleWithPair]: "三带二",
    [PLAY_TYPES.straight]: "顺子",
    [PLAY_TYPES.consecutivePairs]: "连对",
    [PLAY_TYPES.plane]: "钢板",
    [PLAY_TYPES.bomb]: "炸弹",
    [PLAY_TYPES.straightFlush]: "同花顺",
    [PLAY_TYPES.jokerBomb]: "天王炸",
  };
  return labels[type] ?? type;
}

function serializeCard(card) {
  return {
    rank: card.rank,
    suit: card.suit,
    deckIndex: card.deckIndex,
    label: cardLabel(card),
  };
}

function serializePlay(play) {
  return {
    type: play.type,
    mainRank: play.mainRank,
    length: play.length,
    label: play.type === PLAY_TYPES.pass
      ? "过牌"
      : `${playTypeLabel(play.type)} ${cardsLabel(play.cards)}`,
    cards: play.cards.map(serializeCard),
  };
}

function adviceChoices(advice) {
  const list = [advice.recommendation, ...(advice.alternatives ?? [])];
  const seen = new Set();
  const unique = [];
  for (const item of list) {
    const key = `${item.candidate.type}:${item.candidate.cards.map((c) => `${c.suit}${c.rank}#${c.deckIndex}`).join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique.slice(0, 48);
}

function serializeChoice(choice, index) {
  return {
    index: index + 1,
    score: Math.round(choice.score),
    play: serializePlay(choice.candidate),
    reasons: choice.reasons ?? [],
  };
}

function playSignature(play) {
  if (!play || play.type === PLAY_TYPES.pass) return "Pass:";
  const ids = (play.cards ?? []).map((c) => `${c.suit}${c.rank}#${c.deckIndex ?? 0}`).sort().join("|");
  return `${play.type}:${ids}`;
}

function serializeCoachAdvice(state, advice, actualPlay) {
  const choices = adviceChoices(advice).map(serializeChoice);
  const actualSignature = playSignature(actualPlay);
  const matchedChoice = choices.find((choice) => playSignature(choice.play) === actualSignature);
  const actorIndex = advice.playerIndex;

  return {
    turnNumber: state.turnNumber,
    playerIndex: actorIndex,
    playerName: PLAYER_NAMES[actorIndex],
    source: "batch-auto",
    levelRank: state.levelRank,
    handCount: state.players[actorIndex].hand.length,
    playersBefore: state.players.map((player, index) => ({
      playerIndex: index,
      playerName: PLAYER_NAMES[index],
      handCount: player.hand.length,
      finishedOrder: player.finishedOrder,
    })),
    tableBefore: {
      currentPlayerIndex: state.currentPlayerIndex,
      currentPlayerName: PLAYER_NAMES[state.currentPlayerIndex],
      lastActivePlayerIndex: state.lastActivePlayerIndex,
      lastActivePlayerName: state.lastActivePlayerIndex == null
        ? null
        : PLAYER_NAMES[state.lastActivePlayerIndex],
      lastActivePlay: state.lastActivePlay ? serializePlay(state.lastActivePlay) : null,
    },
    handBefore: state.players[actorIndex].hand.map(serializeCard),
    mustBeat: advice.mustBeat,
    handProfile: advice.handProfile,
    choices,
    actualPlay: serializePlay(actualPlay),
    actualChoiceIndex: matchedChoice?.index ?? null,
    actualChoiceMatch: matchedChoice ? `suggestion-${matchedChoice.index}` : "outside-top-3",
  };
}

function snapshotInitialHands(state) {
  return state.players.map((player, index) => ({
    playerIndex: index,
    playerName: PLAYER_NAMES[index],
    cards: [...player.hand].map(serializeCard),
  }));
}

function runRecordedGame({ seed, levelRank, maxTurns }) {
  let state = createInitialGameState({ levelRank, random: mulberry32(seed) });
  const initialHands = snapshotInitialHands(state);
  const coachAdviceTimeline = [];
  const playHistory = [];

  while (!isGameOver(state) && coachAdviceTimeline.length < maxTurns) {
    const actorIndex = state.currentPlayerIndex;
    const advice = getTurnAdvice(state, actorIndex, { alternatives: 12 });
    const { state: nextState, recommendation } = playRecommendedTurn(state);
    const actualPlay = recommendation.candidate;

    coachAdviceTimeline.push(serializeCoachAdvice(state, advice, actualPlay));
    playHistory.push({
      turnNumber: state.turnNumber,
      playerIndex: actorIndex,
      playerName: PLAYER_NAMES[actorIndex],
      play: serializePlay(actualPlay),
    });

    state = nextState;
  }

  const game = {
    gameId: `batch-${seed}`,
    seed,
    startedAt: new Date().toISOString(),
    levelRank,
    status: isGameOver(state) ? "complete" : "turn-limit",
    finishedPlayers: state.finishedPlayers.map((playerIndex, order) => ({
      order: order + 1,
      playerIndex,
      playerName: PLAYER_NAMES[playerIndex],
    })),
    initialHands,
    coachAdviceTimeline,
    playHistory,
  };

  return {
    game,
    canonical: buildCanonicalReplay(game),
    isComplete: isGameOver(state),
    turns: coachAdviceTimeline.length,
  };
}

function main() {
  const { count, maxTurns, seedStart, levelRank } = parseArgs(process.argv);
  mkdirSync(trainingDir, { recursive: true });

  const bundle = {
    version: 3,
    sampleId: `batch-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    exportedAt: new Date().toISOString(),
    purpose: "batch-auto-games",
    note: `P0 批量自博弈：${count} 局，四座位均含 coachAdviceTimeline`,
    levelRank,
    games: [],
  };

  let completed = 0;
  let totalTurns = 0;

  for (let i = 0; i < count; i += 1) {
    const seed = seedStart + i;
    const result = runRecordedGame({ seed, levelRank, maxTurns });
    bundle.games.push(result.game);
    if (result.isComplete) completed += 1;
    totalTurns += result.turns;
  }

  const jsonlPath = join(trainingDir, "batch-auto-games.jsonl");
  const latestPath = join(trainingDir, "batch-auto-latest.json");
  appendFileSync(jsonlPath, `${JSON.stringify(bundle)}\n`, "utf8");
  writeFileSync(latestPath, JSON.stringify(bundle, null, 2), "utf8");

  console.log(JSON.stringify({
    ok: true,
    games: count,
    completed,
    totalTurns,
    rowsEstimate: totalTurns,
    outputs: {
      jsonl: jsonlPath,
      latest: latestPath,
    },
    next: `node tools/replay-to-rows.mjs "${latestPath}"`,
  }, null, 2));
}

main();
