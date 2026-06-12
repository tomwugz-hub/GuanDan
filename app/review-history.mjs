import { safeGetItem, safeSetItem } from "./storage-safe.mjs";

export const REVIEW_HISTORY_KEY = "guandan-coach-review-history-v1";
const MAX_STORED_GAMES = 30;

/** 轻量复盘归档 schema，供跨刷新查看 */
export function loadReviewHistory() {
  try {
    const raw = safeGetItem(REVIEW_HISTORY_KEY, "");
    if (!raw) return { version: 1, games: [] };
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !Array.isArray(data.games)) {
      return { version: 1, games: [] };
    }
    return data;
  } catch {
    return { version: 1, games: [] };
  }
}

/** 保存一局复盘摘要（含 coachAdviceTimeline 供差异点击回看） */
export function saveReviewHistoryEntry(entry) {
  const data = loadReviewHistory();
  const record = {
    savedAt: new Date().toISOString(),
    gameId: entry.gameId ?? `game-${data.games.length + 1}`,
    levelRank: entry.levelRank ?? null,
    totalHands: entry.totalHands ?? 0,
    divergenceCount: entry.divergenceCount ?? 0,
    top1AlignRate: entry.totalHands > 0
      ? (entry.totalHands - (entry.divergenceCount ?? 0)) / entry.totalHands
      : 0,
    divergences: (entry.divergences ?? []).slice(0, 24),
    coachAdviceTimeline: entry.coachAdviceTimeline ?? [],
  };
  data.games.push(record);
  if (data.games.length > MAX_STORED_GAMES) {
    data.games = data.games.slice(-MAX_STORED_GAMES);
  }
  safeSetItem(REVIEW_HISTORY_KEY, JSON.stringify(data));
  return record;
}

/** 按 gameId 查找已归档复盘 */
export function findReviewHistoryGame(gameId) {
  if (!gameId) return null;
  const data = loadReviewHistory();
  return data.games.find((item) => item.gameId === gameId) ?? null;
}
