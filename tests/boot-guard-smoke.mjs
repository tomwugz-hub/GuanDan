import {
  compactSessionForPersist,
  detectInvalidRestoredSession,
  isSafeBootFromUrl,
  isSafeBootMode,
  isSessionPersistable,
  parseSessionJsonSafe,
  slimAiChatRecord,
  validateSessionPayload,
  SESSION_MAX_BYTES,
} from "../app/boot-guard.mjs";
import {
  buildPersistedSession,
  loadPersistedSession,
  savePersistedSession,
  SESSION_STORAGE_KEY,
} from "../app/session-persist.mjs";
import { createInitialGameState, playCards } from "../src/index.mjs";
import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const bloated = {
  version: 1,
  state: {
    levelRank: "2",
    players: [{ hand: [{ rank: "A", suit: "S", deckIndex: 0 }], seatIndex: 0 }],
    playHistory: [],
    finishedPlayers: [],
    turnNumber: 0,
    currentPlayerIndex: 0,
  },
  aiChatTimeline: [{
    id: "x",
    question: "test",
    answer: "ok",
    context: { note: "x".repeat(SESSION_MAX_BYTES) },
  }],
};

const compact = compactSessionForPersist(bloated);
assert(!compact.aiChatTimeline[0].context, "压缩后不应保留 context");
assert(validateSessionPayload(compact), "压缩后应通过校验");

const slim = slimAiChatRecord({ question: "q", answer: "a", context: { huge: true } });
assert(!slim.context, "slim 应去掉 context");

assert(parseSessionJsonSafe("{bad") === null, "畸形 JSON 应返回 null");

function makePlayer(handLen, finishedOrder = null) {
  return {
    hand: Array.from({ length: handLen }, (_, index) => ({
      rank: "3",
      suit: "S",
      deckIndex: index,
    })),
    finishedOrder,
  };
}

function makeState({
  handLens = [0, 0, 0, 0],
  playHistoryLen = 0,
  turnNumber = 0,
  finishedPlayers = [],
  finishedOrders = [null, null, null, null],
} = {}) {
  return {
    levelRank: "2",
    players: handLens.map((len, index) => makePlayer(len, finishedOrders[index])),
    playHistory: Array.from({ length: playHistoryLen }, (_, index) => ({
      turnNumber: index + 1,
      playerIndex: index % 4,
      play: { type: "pass", cards: [] },
    })),
    finishedPlayers,
    turnNumber,
    currentPlayerIndex: 0,
  };
}

const corruptedMidGame = makeState({ handLens: [0, 0, 0, 0], playHistoryLen: 82, turnNumber: 82 });
const corruptedCheck = detectInvalidRestoredSession(corruptedMidGame, {
  coachAdviceTimeline: [{ turnNumber: 1 }],
});
assert(corruptedCheck.invalid, "有出牌记录但手牌全空应判无效");
assert(corruptedCheck.reason === "history-without-hands", "应标记 history-without-hands");

const freshDeal = makeState({ handLens: [27, 27, 27, 27] });
assert(!detectInvalidRestoredSession(freshDeal).invalid, "正常发牌局应有效");

const gameOverEmpty = makeState({
  handLens: [0, 0, 0, 0],
  finishedOrders: [1, 2, 3, 4],
  finishedPlayers: [0, 1, 2, 3],
  playHistoryLen: 80,
  turnNumber: 80,
});
assert(!detectInvalidRestoredSession(gameOverEmpty).invalid, "局末手牌全空应有效");

const finishedWithCards = makeState({
  handLens: [2, 10, 10, 10],
  finishedOrders: [1, null, null, null],
  finishedPlayers: [0],
});
assert(
  detectInvalidRestoredSession(finishedWithCards).reason === "finished-player-has-cards",
  "已出完玩家仍留手牌应无效",
);

const sessionPath = new URL("../training-samples/active-session.json", import.meta.url);
try {
  const raw = await readFile(sessionPath, "utf8");
  const parsed = parseSessionJsonSafe(raw);
  if (parsed) {
    const shrunk = compactSessionForPersist(parsed);
    assert(
      JSON.stringify(shrunk).length < raw.length,
      "active-session 压缩后应变小",
    );
    assert(
      !isSessionPersistable(shrunk),
      "active-session 样例含 finished+留牌矛盾，不应允许恢复/持久化",
    );
  }
} catch {
  // 无存档文件时跳过
}

assert(typeof loadPersistedSession === "function", "loadPersistedSession 应可导入");
assert(SESSION_STORAGE_KEY === "guandan-coach-pro-session-v1", "SESSION key 一致");
assert(typeof isSafeBootMode === "function", "isSafeBootMode 应可导入");
assert(typeof isSafeBootFromUrl === "function", "isSafeBootFromUrl 应可导入");
assert(typeof isSessionPersistable === "function", "isSessionPersistable 应可导入");

assert(
  !isSessionPersistable({
    state: corruptedMidGame,
    currentGameMeta: { coachAdviceTimeline: [{ turnNumber: 1 }] },
  }),
  "自相矛盾 mid-game 不应允许持久化",
);
assert(isSessionPersistable({ state: freshDeal }), "正常发牌局应允许持久化");
assert(!isSessionPersistable({ state: null }), "无 state 不可持久化");

const partialDealDrill = makeState({ handLens: [12, 8, 10, 6] });
assert(
  !detectInvalidRestoredSession(partialDealDrill, { drillFocus: "炸弹时机" }).invalid,
  "专项练习预设非满发应有效",
);

let midGame = createInitialGameState({ levelRank: "2", random: () => 0.5 });
const firstPlayer = midGame.players[midGame.currentPlayerIndex];
midGame = playCards(midGame, [firstPlayer.hand[0]]);
assert(
  isSessionPersistable({ state: midGame, currentGameMeta: { coachAdviceTimeline: [{ turnNumber: 1 }] } }),
  "进行中正常局应允许持久化",
);

const persistStore = new Map();
const priorStorage = globalThis.localStorage;
globalThis.localStorage = {
  getItem: (key) => persistStore.get(key) ?? null,
  setItem: (key, value) => { persistStore.set(key, value); },
  removeItem: (key) => { persistStore.delete(key); },
  key: () => null,
  length: 0,
};
try {
  persistStore.set(
    SESSION_STORAGE_KEY,
    JSON.stringify(buildPersistedSession({ state: midGame, currentGameMeta: { coachAdviceTimeline: [] } })),
  );
  assert(
    savePersistedSession({
      state: corruptedMidGame,
      currentGameMeta: { coachAdviceTimeline: [{ turnNumber: 1 }] },
    }) === false,
    "无效写入应返回 false",
  );
  const stillGood = loadPersistedSession();
  assert(stillGood?.state?.turnNumber === midGame.turnNumber, "无效写入不应清掉上一份合法存档");
} finally {
  globalThis.localStorage = priorStorage;
}

console.log("boot-guard-smoke: ok");
