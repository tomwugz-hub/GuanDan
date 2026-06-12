/** 启动阶段防护：安全模式、损坏 localStorage 修复、会话体积校验与压缩 */

import { isGameOver } from "../engine/game-state.mjs";
import { safeGetItem, safeRemoveItem } from "./storage-safe.mjs";

export const SESSION_STORAGE_KEY = "guandan-coach-pro-session-v1";
export const RESTORE_TIMEOUT_MS = 4000;
export const SESSION_MAX_BYTES = 1_500_000;
export const SAFE_BOOT_FLAG = "guandan-coach-safe-boot-v1";

/** 可扫描修复的 localStorage 前缀（不含 training-samples 磁盘数据） */
const SCANNABLE_PREFIX = "guandan-coach-";

/** 永不自动删除的 key（训练队列等用户数据） */
const PROTECTED_STORAGE_KEYS = new Set([
  SESSION_STORAGE_KEY,
  "guandan-coach-feedback-queue",
  "guandan-coach-progress-v1",
  "guandan-coach-review-history-v1",
  "guandan-coach-use-ml",
  "guandan-coach-onboarding-v2",
  "guandan-coach-pro-first-tips-v1",
]);

/** URL 是否带 ?safe=1（一次性，不写 localStorage） */
export function isSafeBootFromUrl() {
  try {
    const params = new URLSearchParams(globalThis.location?.search ?? "");
    return params.get("safe") === "1" || params.get("safe") === "true";
  } catch {
    return false;
  }
}

/** URL ?safe=1 或 localStorage 标记：跳过恢复存档 */
export function isSafeBootMode() {
  if (isSafeBootFromUrl()) return true;
  return safeGetItem(SAFE_BOOT_FLAG, "") === "1";
}

export function markSafeBootMode() {
  try {
    localStorage.setItem(SAFE_BOOT_FLAG, "1");
  } catch {
    // ignore
  }
}

export function clearSafeBootMode() {
  safeRemoveItem(SAFE_BOOT_FLAG);
}

/** 带超时的 fetch，避免 8787 无响应时启动挂死 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function withTimeout(promise, timeoutMs, label = "操作") {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}超时（${timeoutMs}ms）`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** 解析 JSON；超长或畸形返回 null */
export function parseSessionJsonSafe(raw, maxBytes = SESSION_MAX_BYTES) {
  if (!raw || typeof raw !== "string") return null;
  if (raw.length > maxBytes * 2) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return data;
  } catch {
    return null;
  }
}

/** 压缩 AI 对话记录，去掉巨型 context 快照 */
export function slimAiChatRecord(item) {
  if (!item || typeof item !== "object") return item;
  return {
    id: item.id,
    createdAt: item.createdAt,
    source: item.source,
    model: item.model,
    question: item.question,
    answer: item.answer,
    answerSource: item.answerSource,
    error: item.error ?? null,
  };
}

/** 压缩教练建议时间线，保留复盘所需字段 */
export function slimCoachAdviceRecord(record) {
  if (!record || typeof record !== "object") return record;
  return {
    turnNumber: record.turnNumber,
    playerIndex: record.playerIndex,
    playerName: record.playerName,
    source: record.source,
    levelRank: record.levelRank,
    handCount: record.handCount,
    playersBefore: record.playersBefore,
    mustBeat: record.mustBeat,
    handProfile: record.handProfile,
    choices: record.choices,
    actualPlay: record.actualPlay,
    actualChoiceIndex: record.actualChoiceIndex,
    actualChoiceMatch: record.actualChoiceMatch,
  };
}

/** 写入存档前压缩，防止 localStorage / active-session 膨胀 */
export function compactSessionForPersist(session) {
  if (!session?.state) return session;
  const compact = { ...session };
  if (Array.isArray(compact.aiChatTimeline)) {
    compact.aiChatTimeline = compact.aiChatTimeline
      .slice(-24)
      .map(slimAiChatRecord);
  }
  if (compact.currentGameMeta && typeof compact.currentGameMeta === "object") {
    const meta = { ...compact.currentGameMeta };
    if (Array.isArray(meta.coachAdviceTimeline)) {
      meta.coachAdviceTimeline = meta.coachAdviceTimeline
        .slice(-160)
        .map(slimCoachAdviceRecord);
    }
    if (Array.isArray(meta.aiChatTimeline)) {
      meta.aiChatTimeline = meta.aiChatTimeline.slice(-24).map(slimAiChatRecord);
    }
    compact.currentGameMeta = meta;
  }
  return compact;
}

/** 恢复前校验结构；失败则视为损坏 */
export function validateSessionPayload(data) {
  if (!data?.state?.players?.length) return false;
  if (!Array.isArray(data.state.players)) return false;
  const serialized = JSON.stringify(data);
  if (serialized.length > SESSION_MAX_BYTES) return false;
  return true;
}

const DEAL_HAND_SIZE = 27;

function totalHandCount(state) {
  return state.players.reduce((sum, player) => sum + (player.hand?.length ?? 0), 0);
}

/**
 * 检测恢复后的牌局是否自相矛盾（手牌空但有出牌记录、finished 与 hand 冲突等）。
 * @returns {{ invalid: boolean, reason: string | null }}
 */
export function detectInvalidRestoredSession(state, meta = null) {
  if (!state?.players?.length || !Array.isArray(state.players)) {
    return { invalid: true, reason: "missing-players" };
  }

  const gameOver = isGameOver(state);
  const totalHands = totalHandCount(state);
  const playHistoryLen = state.playHistory?.length ?? 0;
  const coachTimelineLen = meta?.coachAdviceTimeline?.length ?? 0;
  const turnNumber = state.turnNumber ?? 0;
  const hasActivity = playHistoryLen > 0 || coachTimelineLen > 0 || turnNumber > 0;

  if (!gameOver && totalHands === 0) {
    return { invalid: true, reason: hasActivity ? "history-without-hands" : "empty-hands-mid-game" };
  }

  for (const player of state.players) {
    if (player.finishedOrder && (player.hand?.length ?? 0) > 0) {
      return { invalid: true, reason: "finished-player-has-cards" };
    }
  }

  for (const playerIndex of state.finishedPlayers ?? []) {
    const player = state.players[playerIndex];
    if (!player) {
      return { invalid: true, reason: "finished-list-mismatch" };
    }
    if (!player.finishedOrder) {
      return { invalid: true, reason: "finished-list-mismatch" };
    }
    if ((player.hand?.length ?? 0) > 0) {
      return { invalid: true, reason: "finished-player-has-cards" };
    }
  }

  if (!gameOver) {
    const current = state.players[state.currentPlayerIndex];
    if (current?.finishedOrder) {
      return { invalid: true, reason: "turn-on-finished-player" };
    }
  }

  if (!gameOver && turnNumber === 0 && playHistoryLen === 0 && totalHands === 0) {
    return { invalid: true, reason: "no-deal" };
  }

  // 专项练习预设局面允许非 27 张发牌；正常对局仅在「未出牌」时校验满发
  const isDrillSession = Boolean(meta?.drillFocus || meta?.drillScenarioId);
  if (!gameOver && !isDrillSession && turnNumber === 0 && playHistoryLen === 0 && totalHands > 0) {
    const handCounts = state.players.map((player) => player.hand?.length ?? 0);
    const allFullDeal = handCounts.every((count) => count === DEAL_HAND_SIZE);
    const anyCards = handCounts.some((count) => count > 0);
    if (anyCards && !allFullDeal) {
      return { invalid: true, reason: "partial-deal" };
    }
  }

  return { invalid: false, reason: null };
}

/** 是否允许写入 localStorage / 8787 存档（beforeunload 与定时持久化共用） */
export function isSessionPersistable(session) {
  if (!session?.state) return false;
  return !detectInvalidRestoredSession(session.state, session.currentGameMeta ?? null).invalid;
}

/** 启动时修复 guandan-coach-* 损坏项（仅删解析失败的 key，不碰 training-samples） */
export function scanAndRepairGuandanStorage() {
  const removed = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(SCANNABLE_PREFIX)) continue;
      if (PROTECTED_STORAGE_KEYS.has(key)) continue;
      const raw = safeGetItem(key, null);
      if (raw === null) continue;
      try {
        JSON.parse(raw);
      } catch {
        safeRemoveItem(key);
        removed.push(key);
      }
    }
  } catch {
    // ignore
  }

  const sessionRaw = safeGetItem(SESSION_STORAGE_KEY, "");
  if (sessionRaw) {
    if (sessionRaw.length > SESSION_MAX_BYTES * 2) {
      safeRemoveItem(SESSION_STORAGE_KEY);
      removed.push(SESSION_STORAGE_KEY);
    } else {
      const parsed = parseSessionJsonSafe(sessionRaw);
      const compact = parsed ? compactSessionForPersist(parsed) : null;
      const invalidSession = compact
        && validateSessionPayload(compact)
        && detectInvalidRestoredSession(compact.state, compact.currentGameMeta).invalid;
      if (!compact || !validateSessionPayload(compact) || invalidSession) {
        safeRemoveItem(SESSION_STORAGE_KEY);
        removed.push(SESSION_STORAGE_KEY);
      }
    }
  }
  return removed;
}

/** 估算序列化体积 */
export function sessionSerializedSize(session) {
  try {
    return JSON.stringify(session).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
