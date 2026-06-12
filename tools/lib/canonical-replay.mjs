import { readFileSync, existsSync } from "node:fs";
import { createCard, cardId } from "../../engine/card.mjs";
import { PLAYER_COUNT, SCHEMA_VERSION } from "./replay-constants.mjs";

export { SCHEMA_VERSION, PLAYER_COUNT } from "./replay-constants.mjs";

export function tierFromCoachRecord(record) {
  const source = String(record.source ?? "unknown");
  const match = record.actualChoiceMatch ?? "";
  if (match === "outside-top-3" && source.startsWith("human")) {
    return { tier: "gold", weight: 1, labelSource: source };
  }
  if (source.startsWith("human")) {
    return { tier: "silver", weight: 0.4, labelSource: source };
  }
  if (source === "batch-auto" || source === "auto-game" || source === "robot-auto") {
    return { tier: "bronze", weight: 0.15, labelSource: source };
  }
  return { tier: "silver", weight: 0.3, labelSource: source };
}

export function playSignature(play) {
  if (!play || play.type === "Pass") return "Pass:";
  const ids = (play.cards ?? [])
    .map((card) => cardId(deserializeCard(card)))
    .sort()
    .join("|");
  return `${play.type}:${ids}`;
}

export function deserializeCard(card) {
  if (!card) return null;
  return createCard(card.rank, card.suit, card.deckIndex ?? 0);
}

export function partnerSeat(seat) {
  return (seat + 2) % PLAYER_COUNT;
}

export function loadJsonFile(path) {
  const text = readFileSync(path, "utf8").trim();
  if (!text) return null;
  return JSON.parse(text);
}

export function loadJsonlFile(path) {
  const text = readFileSync(path, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function loadTrainingInput(path) {
  if (!existsSync(path)) {
    const error = new Error(`文件不存在: ${path}`);
    error.code = "ENOENT";
    throw error;
  }
  if (path.endsWith(".jsonl")) {
    return { kind: "jsonl", samples: loadJsonlFile(path) };
  }
  const data = loadJsonFile(path);
  if (Array.isArray(data)) return { kind: "array", samples: data };
  return { kind: "bundle", samples: [data] };
}

/** 从导出包 / 训练样本里拆出逐局对象 */
export function extractGamesFromSample(sample) {
  const games = [];
  if (!sample || typeof sample !== "object") return games;

  if (Array.isArray(sample.coachAdviceTimeline) || Array.isArray(sample.playHistory)) {
    games.push(sample);
  }
  for (const game of sample.games ?? []) {
    if (game) games.push(game);
  }
  if (sample.currentPosition) games.push(sample.currentPosition);

  return games;
}

export function extractAllGames(input) {
  const games = [];
  for (const sample of input.samples) {
    games.push(...extractGamesFromSample(sample));
  }
  return dedupeGames(games);
}

function dedupeGames(games) {
  const seen = new Set();
  const result = [];
  for (const game of games) {
    const key = `${game.gameId ?? "game"}:${game.seed ?? ""}:${game.startedAt ?? game.exportedAt ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(game);
  }
  return result;
}

export function buildCanonicalReplay(game) {
  const gameId = game.gameId ?? `game-${game.seed ?? "unknown"}`;
  const levelRank = game.levelRank ?? "2";
  const timeline = game.coachAdviceTimeline ?? [];
  const initialHands = (game.initialHands ?? []).map((item) => ({
    seat: item.playerIndex ?? item.seat ?? 0,
    playerName: item.playerName ?? `seat-${item.playerIndex ?? 0}`,
    cards: item.cards ?? [],
  }));

  const actions = timeline.length > 0
    ? timeline.map((item) => timelineItemToAction(item))
    : (game.playHistory ?? []).map((item) => playHistoryToAction(item));

  return {
    schemaVersion: SCHEMA_VERSION,
    gameId,
    seed: game.seed ?? null,
    levelRank,
    status: game.status ?? "unknown",
    startedAt: game.startedAt ?? game.exportedAt ?? null,
    finishedPlayers: game.finishedPlayers ?? [],
    completedTeam: game.completedTeam ?? null,
    initialHands,
    actions,
    stats: {
      actionCount: actions.length,
      seatCounts: countBySeat(actions),
      tierCounts: countByTier(actions),
    },
  };
}

function timelineItemToAction(item) {
  const { tier, weight, labelSource } = tierFromCoachRecord(item);
  return {
    turnNumber: item.turnNumber,
    seat: item.playerIndex,
    playerName: item.playerName,
    source: item.source ?? labelSource,
    tier,
    weight,
    levelRank: item.levelRank,
    hand: item.handBefore ?? [],
    handCount: item.handCount,
    playersBefore: item.playersBefore ?? [],
    tableBefore: item.tableBefore ?? null,
    mustBeat: item.mustBeat ?? null,
    handProfile: item.handProfile ?? null,
    candidates: item.choices ?? [],
    label: {
      play: item.actualPlay,
      choiceIndex: item.actualChoiceIndex,
      match: item.actualChoiceMatch,
    },
  };
}

function playHistoryToAction(item) {
  return {
    turnNumber: item.turnNumber,
    seat: item.playerIndex,
    playerName: item.playerName,
    source: "play-history-only",
    tier: "silver",
    weight: 0.25,
    hand: [],
    handCount: null,
    playersBefore: [],
    tableBefore: null,
    mustBeat: null,
    handProfile: null,
    candidates: [],
    label: {
      play: item.play,
      choiceIndex: null,
      match: "history-only",
    },
  };
}

function countBySeat(actions) {
  const counts = Object.fromEntries([...Array(PLAYER_COUNT)].map((_, i) => [i, 0]));
  for (const action of actions) counts[action.seat] = (counts[action.seat] ?? 0) + 1;
  return counts;
}

function countByTier(actions) {
  const counts = { gold: 0, silver: 0, bronze: 0 };
  for (const action of actions) counts[action.tier] = (counts[action.tier] ?? 0) + 1;
  return counts;
}

export function actionToTrainingRow(action, replay) {
  const handCounts = (action.playersBefore ?? []).map((p) => p.handCount);
  const lastPlay = action.tableBefore?.lastActivePlay ?? null;
  const candidateSignatures = (action.candidates ?? []).map((c) => playSignature(c.play));
  const labelSignature = playSignature(action.label?.play);
  const labelIndex = candidateSignatures.indexOf(labelSignature);

  return {
    schemaVersion: SCHEMA_VERSION,
    rowId: `${replay.gameId}:t${action.turnNumber}:s${action.seat}`,
    gameId: replay.gameId,
    seed: replay.seed,
    turnNumber: action.turnNumber,
    seat: action.seat,
    playerName: action.playerName,
    levelRank: action.levelRank ?? replay.levelRank,
    tier: action.tier,
    weight: action.weight,
    labelSource: action.source,
    state: {
      hand: action.hand,
      handCount: action.handCount,
      partnerSeat: partnerSeat(action.seat),
      handCounts,
      lastActivePlay: lastPlay,
      lastActivePlayerIndex: action.tableBefore?.lastActivePlayerIndex ?? null,
      mustBeat: action.mustBeat,
      finishedOrders: (action.playersBefore ?? []).map((p) => p.finishedOrder ?? null),
    },
    candidates: action.candidates ?? [],
    label: {
      ...action.label,
      candidateIndex: labelIndex >= 0 ? labelIndex + 1 : null,
    },
    meta: {
      handProfile: action.handProfile,
      gameStatus: replay.status,
      finishedPlayers: replay.finishedPlayers,
    },
  };
}

export function replayToRows(replay) {
  return replay.actions.map((action) => actionToTrainingRow(action, replay));
}

export function gamesToRows(games) {
  const replays = games.map(buildCanonicalReplay);
  const rows = replays.flatMap(replayToRows);
  return { replays, rows };
}

export function summarizeRows(rows) {
  const byTier = { gold: 0, silver: 0, bronze: 0 };
  const bySeat = Object.fromEntries([...Array(PLAYER_COUNT)].map((_, i) => [i, 0]));
  let withCandidates = 0;
  let outsideTop3 = 0;

  for (const row of rows) {
    byTier[row.tier] = (byTier[row.tier] ?? 0) + 1;
    bySeat[row.seat] = (bySeat[row.seat] ?? 0) + 1;
    if ((row.candidates ?? []).length > 0) withCandidates += 1;
    if (row.label?.match === "outside-top-3") outsideTop3 += 1;
  }

  return {
    totalRows: rows.length,
    byTier,
    bySeat,
    withCandidates,
    outsideTop3,
  };
}
