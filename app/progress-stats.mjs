import { safeGetItem, safeSetItem } from "./storage-safe.mjs";

export const PROGRESS_STATS_KEY = "guandan-coach-progress-v1";

const EMPTY_STATS = Object.freeze({
  version: 1,
  totalGames: 0,
  totalHands: 0,
  top1Matches: 0,
  learningPoints: 0,
  recentGames: [],
  drillSessions: [],
});

/** 从 localStorage 读取进度统计 */
export function loadProgressStats() {
  try {
    const raw = safeGetItem(PROGRESS_STATS_KEY, "");
    if (!raw) return { ...EMPTY_STATS, recentGames: [] };
    const data = JSON.parse(raw);
    if (data?.version !== 1) return { ...EMPTY_STATS, recentGames: [] };
    return {
      version: 1,
      totalGames: Number(data.totalGames) || 0,
      totalHands: Number(data.totalHands) || 0,
      top1Matches: Number(data.top1Matches) || 0,
      learningPoints: Number(data.learningPoints) || 0,
      recentGames: Array.isArray(data.recentGames) ? data.recentGames.slice(-7) : [],
      drillSessions: Array.isArray(data.drillSessions) ? data.drillSessions.slice(-20) : [],
    };
  } catch {
    return { ...EMPTY_STATS, recentGames: [] };
  }
}

function saveProgressStats(stats) {
  safeSetItem(PROGRESS_STATS_KEY, JSON.stringify(stats));
}

function learningPointsFromSummary(summary) {
  return (summary?.coachBetterCount ?? 0) + (summary?.coachQuestionableCount ?? 0);
}

/** 局末保存复盘时累加统计 */
export function updateProgressFromReview(summary, gameId = "") {
  const stats = loadProgressStats();
  const totalHands = summary?.totalHands ?? 0;
  const divergenceCount = summary?.divergenceCount ?? 0;
  const top1Matches = summary?.top1MatchCount ?? Math.max(0, totalHands - divergenceCount);
  const top1AlignRate = totalHands > 0 ? top1Matches / totalHands : 0;
  const learningPoints = learningPointsFromSummary(summary);

  stats.totalGames += 1;
  stats.totalHands += totalHands;
  stats.top1Matches += top1Matches;
  stats.learningPoints += learningPoints;
  stats.recentGames.push({
    gameId: gameId || `game-${stats.totalGames}`,
    savedAt: new Date().toISOString(),
    totalHands,
    divergenceCount,
    learningPoints,
    top1AlignRate,
  });
  if (stats.recentGames.length > 7) {
    stats.recentGames = stats.recentGames.slice(-7);
  }
  saveProgressStats(stats);
  return stats;
}

/** 局末复盘时记录专项练习局完成情况 */
export function recordDrillSessionFromReview(gameMeta, divergenceSummary, { focusHits = 0 } = {}) {
  if (!gameMeta?.drillFocus) return loadProgressStats();

  const stats = loadProgressStats();
  const totalHands = divergenceSummary?.totalHands ?? 0;
  const divergenceCount = divergenceSummary?.divergenceCount ?? 0;

  stats.drillSessions.push({
    tag: gameMeta.drillFocus,
    gameId: gameMeta.gameId ?? "",
    savedAt: new Date().toISOString(),
    completed: true,
    totalHands,
    divergenceCount,
    focusHits,
  });
  if (stats.drillSessions.length > 20) {
    stats.drillSessions = stats.drillSessions.slice(-20);
  }
  saveProgressStats(stats);
  return stats;
}

/** 累计推荐1一致率（百分比整数，次要指标） */
export function formatAlignRate(stats) {
  if (!stats?.totalHands) return "—";
  return `${Math.round((stats.top1Matches / stats.totalHands) * 100)}%`;
}

/** 累计建议学习点（教练更对 + 教练存疑） */
export function formatLearningPoints(stats) {
  if (!stats?.totalGames) return "—";
  return `${stats.learningPoints ?? 0} 处`;
}

/** 近 7 局建议学习点趋势 HTML */
export function renderRecentTrendBars(recentGames = []) {
  if (!recentGames.length) {
    return "<p class=\"muted\">保存复盘后会显示近 7 局学习点趋势。</p>";
  }
  const maxPoints = Math.max(...recentGames.map((g) => g.learningPoints ?? 0), 1);
  let html = "<div class=\"progress-trend\">";
  for (const game of recentGames) {
    const points = game.learningPoints ?? 0;
    const pct = Math.round((points / maxPoints) * 100);
    const label = game.gameId ? String(game.gameId).replace(/^game-/, "") : "局";
    html += `<div class="progress-trend-row" title="${points} 处建议学习">
      <span class="progress-trend-label">${label}</span>
      <span class="progress-trend-bar"><span style="width:${pct}%"></span></span>
      <span class="progress-trend-pct">${points}</span>
    </div>`;
  }
  html += "</div>";
  return html;
}
