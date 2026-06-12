import {
  compactSessionForPersist,
  detectInvalidRestoredSession,
  fetchWithTimeout,
  isSessionPersistable,
  parseSessionJsonSafe,
  SESSION_MAX_BYTES,
  SESSION_STORAGE_KEY,
  validateSessionPayload,
  withTimeout,
  RESTORE_TIMEOUT_MS,
} from "./boot-guard.mjs";
import { safeGetItem, safeRemoveItem, safeSetItem } from "./storage-safe.mjs";

export { SESSION_STORAGE_KEY };
const SESSION_BRIDGE_URL = "http://127.0.0.1:8787/game-session";
const REMOTE_TIMEOUT_MS = 3000;

export function buildPersistedSession(payload) {
  return compactSessionForPersist({
    version: 1,
    savedAt: new Date().toISOString(),
    ...payload,
  });
}

export function savePersistedSession(session) {
  if (!session?.state || !isSessionPersistable(session)) {
    return false;
  }
  try {
    const compact = compactSessionForPersist(session);
    safeSetItem(SESSION_STORAGE_KEY, JSON.stringify(compact));
    return true;
  } catch {
    return false;
  }
}

export function loadPersistedSession() {
  try {
    const raw = safeGetItem(SESSION_STORAGE_KEY, "");
    if (!raw) return null;
    if (raw.length > SESSION_MAX_BYTES * 2) {
      clearPersistedSession();
      return null;
    }
    const data = parseSessionJsonSafe(raw);
    if (!data) {
      clearPersistedSession();
      return null;
    }
    const compact = compactSessionForPersist(data);
    if (!validateSessionPayload(compact)) {
      clearPersistedSession();
      return null;
    }
    if (detectInvalidRestoredSession(compact.state, compact.currentGameMeta).invalid) {
      clearPersistedSession();
      return null;
    }
    if (raw.length > JSON.stringify(compact).length + 2048) {
      safeSetItem(SESSION_STORAGE_KEY, JSON.stringify(compact));
    }
    return compact;
  } catch {
    clearPersistedSession();
    return null;
  }
}

export function clearPersistedSession() {
  safeRemoveItem(SESSION_STORAGE_KEY);
}

/** 写入本机 8787 服务（Cursor 内置浏览器刷新后仍可从磁盘恢复） */
export async function savePersistedSessionRemote(session) {
  if (!session?.state || !isSessionPersistable(session)) {
    return { ok: false, online: false };
  }
  try {
    const compact = compactSessionForPersist(session);
    const response = await fetchWithTimeout(SESSION_BRIDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(compact),
    }, REMOTE_TIMEOUT_MS);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "save failed");
    return { ok: true, online: true, ...data };
  } catch {
    return { ok: false, online: false };
  }
}

export async function loadPersistedSessionRemote() {
  try {
    const response = await fetchWithTimeout(SESSION_BRIDGE_URL, { method: "GET" }, REMOTE_TIMEOUT_MS);
    const data = await response.json();
    if (!response.ok || !data.session?.state?.players?.length) return null;
    const session = compactSessionForPersist(data.session);
    if (!validateSessionPayload(session)) {
      await clearPersistedSessionRemote();
      return null;
    }
    if (detectInvalidRestoredSession(session.state, session.currentGameMeta).invalid) {
      await clearPersistedSessionRemote();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function clearPersistedSessionRemote() {
  try {
    await fetchWithTimeout(SESSION_BRIDGE_URL, { method: "DELETE" }, REMOTE_TIMEOUT_MS);
  } catch {
    // ignore
  }
}

export async function savePersistedSessionDual(session) {
  savePersistedSession(session);
  return savePersistedSessionRemote(session);
}

export async function loadPersistedSessionDual() {
  const local = loadPersistedSession();
  if (local) return { session: local, source: "local" };
  const remote = await loadPersistedSessionRemote();
  if (remote) {
    savePersistedSession(remote);
    return { session: remote, source: "remote" };
  }
  return { session: null, source: null };
}

/** 带超时的双通道恢复，防止启动挂死 */
export async function loadPersistedSessionDualWithTimeout(timeoutMs = RESTORE_TIMEOUT_MS) {
  return withTimeout(loadPersistedSessionDual(), timeoutMs, "恢复牌局");
}

export async function clearPersistedSessionDual() {
  clearPersistedSession();
  await clearPersistedSessionRemote();
}
