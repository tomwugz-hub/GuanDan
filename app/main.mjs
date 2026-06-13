import {
  PLAY_TYPES,
  cardId,
  cardLabel,
  cardsLabel,
  playSignature,
  classifyPlay,
  createCompetitiveMatch,
  createInitialGameState,
  finishCompetitiveGame,
  buildStrategicGroups,
  evaluateHandProfile,
  groupPlayHistoryByRound,
  getTurnAdvice,
  buildEngineFacts,
  buildGameReviewPayload,
  summarizeGameDivergences,
  isHumanReplayRecord,
  DIVERGENCE_VERDICTS,
  normalizeUserDispute,
  buildDisputeAckMessage,
  isJoker,
  isWildCard,
  isGameOver,
  detectTurnStuck,
  repairTurnStuck,
  playCards,
  playRecommendedTurn,
  rankPower,
  runAutoGame,
  sortCardsForDisplay,
  startNextCompetitiveGame,
  fixResistTributeStarter,
  tryLocalCoachAnswer,
  appendRuleEngineAnswerFooter,
  analyzeInPlayInsight,
  formatInPlayInsightReply,
  normalizeGameInsight,
  INSIGHT_VERDICTS,
  INSIGHT_STATUS_LABELS,
  createCard,
  filterReasonsForUser,
  firstReasonForUser,
} from "../src/index.mjs";
import { canBeat } from "../engine/compare-play.mjs";
import { dedupeKey } from "../tools/lib/dedupe-key.mjs";
import { messageTimestamp } from "../tools/lib/message-timestamp.mjs";
import { detectOpenGuanDanLog, opengdanMessagesToGame } from "../tools/adapters/opengdan-log.mjs";
import { detectLegacyGdWs, legacyGdMessagesToGame } from "../tools/adapters/legacy-gd-ws.mjs";
import { safeGetItem, safeRemoveItem, safeSetItem } from "./storage-safe.mjs";
import {
  buildFeedbackFromSession,
  flushFeedbackQueue,
  submitCoachFeedback,
  submitUserDispute,
} from "./feedback-client.mjs";
import {
  clearSafeBootMode,
  compactSessionForPersist,
  slimCoachAdviceRecord,
  detectInvalidRestoredSession,
  isSafeBootFromUrl,
  isSafeBootMode,
  isSessionPersistable,
  markSafeBootMode,
  scanAndRepairGuandanStorage,
  slimAiChatRecord,
  withTimeout,
  RESTORE_TIMEOUT_MS,
} from "./boot-guard.mjs";
import {
  buildPersistedSession,
  clearPersistedSessionDual,
  clearPersistedSessionRemote,
  loadPersistedSession,
  loadPersistedSessionDualWithTimeout,
  savePersistedSession,
  savePersistedSessionDual,
  savePersistedSessionRemote,
} from "./session-persist.mjs";
import {
  formatAlignRate,
  loadProgressStats,
  recordDrillSessionFromReview,
  renderRecentTrendBars,
  updateProgressFromReview,
} from "./progress-stats.mjs";
import { findReviewHistoryGame, loadReviewHistory, saveReviewHistoryEntry } from "./review-history.mjs";
import {
  analyzeWeaknesses,
  buildDrillAdviceTip,
  buildDrillPracticeGameMeta,
  buildSingleGameMatchSummary,
  countDrillFocusHits,
  createDrillRiggedState,
  getDrillBannerHint,
  getDrillScenarioSummary,
  renderDrillPracticeListHtml,
  shouldShowNextMatchGame,
} from "./drill-practice.mjs";
import {
  findNonOverlappingStraightFlushes,
  sortStraightFlushCards,
} from "../strategy/straight-flush-arrange.mjs";
import { detectKeyMoment } from "./key-moment-pause.mjs";

const HUMAN_INDEX = 0;
const PLAYER_NAMES = ["你", "勇哥", "老史", "毛蛋"];
const PLAYER_AVATARS = ["我", "勇", "史", "毛"];
const SUIT_LABELS = {
  S: "黑桃",
  H: "红桃",
  C: "梅花",
  D: "方片",
};

const SUIT_SYMBOLS = {
  S: "♠",
  H: "♥",
  C: "♣",
  D: "♦",
};

const PLAY_TYPE_LABELS = {
  [PLAY_TYPES.pass]: "不出",
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
  [PLAY_TYPES.invalid]: "无效牌型",
};
const LEVEL_MAIN_PLAY_TYPES = new Set([
  PLAY_TYPES.single,
  PLAY_TYPES.pair,
  PLAY_TYPES.triple,
  PLAY_TYPES.tripleWithPair,
  PLAY_TYPES.bomb,
]);
const ARRANGEMENT_RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2", "SJ", "BJ"];
const COLUMN_SEQUENCE_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

let state = null;
let selectedIds = new Set();
let message = "点击“新开一局”发牌。";
let currentAdvice = null;
let tablePlays = new Map();
let tableTrickLeaderIndex = null;
let archivedGames = [];
let currentGameMeta = null;
let draggedCardId = null;
let draggedColumnIds = null;
let suppressCardClick = false;
let freeWildCardIds = new Set();
let handColumnIds = null;
let pendingCardClickTimer = null;
let pendingCardClickAction = null;
let matchState = null;
let matchSettledTurnNumber = null;
let aiChatTimeline = [];

const ML_TOGGLE_STORAGE = "guandan-coach-use-ml";
const KEY_PAUSE_STORAGE = "guandan-coach-pro-key-pause";
const ONBOARDING_STORAGE = "guandan-coach-onboarding-v2";
/** 单项功能首次说明（onboarding 完成后展示，不重复三步引导） */
const FIRST_TIPS_STORAGE = "guandan-coach-pro-first-tips-v1";
/** 浮动问教练每局次数上限；0 表示不限 */
const FAB_QA_LIMIT_PER_GAME = 0;
/** 窄屏布局断点，与 index.html @media (max-width: 740px) 一致 */
const MOBILE_LAYOUT_MQ = typeof window !== "undefined"
  ? window.matchMedia("(max-width: 740px)")
  : null;
let coachFabOpen = false;
let rulesDrawerOpen = false;
/** 历史复盘列表当前展开的对局 */
let expandedReviewGameId = null;
let coachToastTimer = null;
let selectedDivergenceTurn = null;
let mlPolicyModel = null;
let useMlPolicy = safeGetItem(ML_TOGGLE_STORAGE, "1") !== "0";
let keyPauseEnabled = safeGetItem(KEY_PAUSE_STORAGE, "1") !== "0";
/** 当前展示的关键时刻暂停 overlay；null 表示未展示 */
let keyPauseOverlay = null;
let autoGameRunning = false;
let pendingAfterSubmitAction = null;
let feedbackSubmitCount = 0;
let persistSessionTimer = null;
let hintShown = false;
/** 用户点了「提示」但 advice 仍在异步计算中 */
let hintAwaiting = false;
let hintAdvice = null;
let hintCardIds = new Set();
let reportReminderText = null;
let onboardingStep = 0;
/** 复盘差异列表当前筛选分类（默认「教练更对」） */
let divergenceVerdictFilter = DIVERGENCE_VERDICTS.COACH_BETTER;
let renderFrameId = null;
let rendering = false;
let renderQueued = false;
let renderQueuedLite = false;
let bootComplete = false;
let robotQueueGeneration = 0;
let robotQueueTimer = null;
let robotQueueWatchdog = null;
/** 机器人队列步间间隔（ms）；0 = 尽快推进，由 batch 控制主线程喘息 */
const ROBOT_QUEUE_DELAY_MS = 0;
const ROBOT_QUEUE_TIMEOUT_MS = 8000;
/** 单步机器人计算超过此阈值（ms）时打警告 */
const ROBOT_STEP_SLOW_MS = 500;
/** 单帧内最多连推几手机器人，减少反复「思考中」渲染 */
const ROBOT_BATCH_MAX_STEPS = 10;
const ROBOT_BATCH_YIELD_MS = 120;
let robotQueueActive = false;
let progressPanelDirty = true;

/*
    if (state) message = "已恢复到上次保存的牌局。";
*/
const SUIT_COLUMN_ORDER = new Map([
  ["S", 0],
  ["H", 1],
  ["C", 2],
  ["D", 3],
  ["JOKER", 4],
]);

const elements = {
  levelRank: document.querySelector("#levelRank"),
  newGame: document.querySelector("#newGame"),
  newMatch: document.querySelector("#newMatch"),
  nextMatchGame: document.querySelector("#nextMatchGame"),
  matchStrip: document.querySelector("#matchStrip"),
  matchStatus: document.querySelector("#matchStatus"),
  matchSummary: document.querySelector("#matchSummary"),
  tributePanel: document.querySelector("#tributePanel"),
  tributeTitle: document.querySelector("#tributeTitle"),
  tributeSummary: document.querySelector("#tributeSummary"),
  autoGame: document.querySelector("#autoGame"),
  ourLevel: document.querySelector("#ourLevel"),
  theirLevel: document.querySelector("#theirLevel"),
  players: document.querySelector("#players"),
  seatPlays: document.querySelector("#seatPlays"),
  turnTitle: document.querySelector("#turnTitle"),
  turnHint: document.querySelector("#turnHint"),
  scoreboard: document.querySelector("#scoreboard"),
  turnCount: document.querySelector("#turnCount"),
  lastPlayTitle: document.querySelector("#lastPlayTitle"),
  lastCards: document.querySelector("#lastCards"),
  playSelected: document.querySelector("#playSelected"),
  playRecommended: document.querySelector("#playRecommended"),
  adoptHint: document.querySelector("#adoptHint"),
  hintBanner: document.querySelector("#hintBanner"),
  keyPauseBanner: document.querySelector("#keyPauseBanner"),
  reportReminderBanner: document.querySelector("#reportReminderBanner"),
  passTurn: document.querySelector("#passTurn"),
  sortHand: document.querySelector("#sortHand"),
  exportLog: document.querySelector("#exportLog"),
  saveTrainingSample: document.querySelector("#saveTrainingSample"),
  importReplayFiles: document.querySelector("#importReplayFiles"),
  importReplayBtn: document.querySelector("#importReplayBtn"),
  useMlPolicy: document.querySelector("#useMlPolicy"),
  useKeyPause: document.querySelector("#useKeyPause"),
  exportPanel: document.querySelector("#exportPanel"),
  exportOutput: document.querySelector("#exportOutput"),
  copyLog: document.querySelector("#copyLog"),
  hand: document.querySelector("#hand"),
  advice: document.querySelector("#advice"),
  historyPanel: document.querySelector("#historyPanel"),
  history: document.querySelector("#history"),
  historyCount: document.querySelector("#historyCount"),
  selfTrain: document.querySelector("#selfTrain"),
  trainingResult: document.querySelector("#trainingResult"),
  aiQuestion: document.querySelector("#aiQuestion"),
  askAiCoach: document.querySelector("#askAiCoach"),
  submitGameReview: document.querySelector("#submitGameReview"),
  gameReviewSummary: document.querySelector("#gameReviewSummary"),
  improveCards: document.querySelector("#improveCards"),
  clearAiChat: document.querySelector("#clearAiChat"),
  aiStatus: document.querySelector("#aiStatus"),
  aiChatLog: document.querySelector("#aiChatLog"),
  aiPanel: document.querySelector("#aiPanel"),
  message: document.querySelector("#message"),
  submitReminderDialog: document.querySelector("#submitReminderDialog"),
  submitReminderText: document.querySelector("#submitReminderText"),
  submitAndNext: document.querySelector("#submitAndNext"),
  skipSubmitNext: document.querySelector("#skipSubmitNext"),
  cancelSubmitNext: document.querySelector("#cancelSubmitNext"),
  onboardingOverlay: document.querySelector("#onboardingOverlay"),
  onboardingRing: document.querySelector("#onboardingRing"),
  onboardingText: document.querySelector("#onboardingText"),
  onboardingSkip: document.querySelector("#onboardingSkip"),
  advancedMenu: document.querySelector("#advancedMenu"),
  coachFab: document.querySelector("#coachFab"),
  coachFabDrawer: document.querySelector("#coachFabDrawer"),
  coachFabBackdrop: document.querySelector("#coachFabBackdrop"),
  coachFabClose: document.querySelector("#coachFabClose"),
  coachFabQuestion: document.querySelector("#coachFabQuestion"),
  coachFabSend: document.querySelector("#coachFabSend"),
  coachFabObjection: document.querySelector("#coachFabObjection"),
  coachFabLog: document.querySelector("#coachFabLog"),
  coachFabLimit: document.querySelector("#coachFabLimit"),
  coachToast: document.querySelector("#coachToast"),
  divergenceDetail: document.querySelector("#divergenceDetail"),
  progressPanel: document.querySelector("#progressPanel"),
  progressStats: document.querySelector("#progressStats"),
  reviewHistoryList: document.querySelector("#reviewHistoryList"),
  reviewHistoryDetail: document.querySelector("#reviewHistoryDetail"),
  savedDivergenceDetail: document.querySelector("#savedDivergenceDetail"),
  drillPanel: document.querySelector("#drillPanel"),
  drillPracticeList: document.querySelector("#drillPracticeList"),
  drillFocusBanner: document.querySelector("#drillFocusBanner"),
  openDrillPanel: document.querySelector("#openDrillPanel"),
  rulesBtn: document.querySelector("#rulesBtn"),
  rulesDrawer: document.querySelector("#rulesDrawer"),
  rulesBackdrop: document.querySelector("#rulesBackdrop"),
  rulesClose: document.querySelector("#rulesClose"),
  firstTipBar: document.querySelector("#firstTipBar"),
  firstTipText: document.querySelector("#firstTipText"),
  firstTipDismiss: document.querySelector("#firstTipDismiss"),
  firstTipSkipAll: document.querySelector("#firstTipSkipAll"),
};

if (elements.useMlPolicy) elements.useMlPolicy.checked = useMlPolicy;
if (elements.useKeyPause) elements.useKeyPause.checked = keyPauseEnabled;

async function loadMlPolicyModel() {
  if (globalThis.__GUANDAN_ML_MODEL__) {
    mlPolicyModel = globalThis.__GUANDAN_ML_MODEL__;
    return;
  }
  try {
    const response = await fetch("../models/policy-v001/model.json");
    if (response.ok) {
      mlPolicyModel = await response.json();
      if (useMlPolicy && elements.message) {
        elements.message.textContent = "ML 策略模型已加载（policy-v001）。";
      }
    }
  } catch {
    mlPolicyModel = null;
  }
}

function seededRandom(seed) {
  let value = seed % 2147483647;
  return () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };
}

function playTypeLabel(type) {
  return PLAY_TYPE_LABELS[type] || type;
}

function playLabel(play, levelRank = state?.levelRank) {
  const label = playTypeLabel(play.type);
  if (!levelRank || !LEVEL_MAIN_PLAY_TYPES.has(play.type)) return label;
  return play.mainRank === levelRank ? `级牌${label}` : label;
}

function unfinishedPlayers(gameState) {
  if (!gameState || !isGameOver(gameState)) return null;
  return gameState.players
    .filter((player) => player.hand.length > 0)
    .map((player) => ({
      index: player.seatIndex,
      name: PLAYER_NAMES[player.seatIndex],
      order: player.finishedOrder,
      cards: sortCardsForDisplay(player.hand),
    }));
}

function completedTeam(gameState) {
  if (!gameState || !isGameOver(gameState) || gameState.finishedPlayers.length === 0) return null;
  const teams = [
    { label: "己方", players: [0, 2] },
    { label: "对方", players: [1, 3] },
  ];
  const firstTeam = teams.find((team) => team.players.includes(gameState.finishedPlayers[0]));
  if (!firstTeam) return null;
  const secondSameTeam = firstTeam.players.includes(gameState.finishedPlayers[1]);
  return {
    ...firstTeam,
    result: secondSameTeam ? "双上" : "头游",
  };
}

function playerRelationLabel(index) {
  if (index === HUMAN_INDEX) return "你";
  if (index === (HUMAN_INDEX + 2) % PLAYER_NAMES.length) return "队友/对家";
  return "对手";
}

function playerSeatLabel(index) {
  if (index === HUMAN_INDEX) return "你";
  if (index === (HUMAN_INDEX + 1) % PLAYER_NAMES.length) return "上家/对手";
  if (index === (HUMAN_INDEX + 2) % PLAYER_NAMES.length) return "对家/队友";
  if (index === (HUMAN_INDEX + 3) % PLAYER_NAMES.length) return "下家/对手";
  return "未知";
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
    label: play.type === PLAY_TYPES.pass ? "过牌" : `${playLabel(play)} ${cardsLabel(play.cards)}`,
    cards: play.cards.map(serializeCard),
  };
}

function serializeChoice(choice, index) {
  return {
    index: index + 1,
    score: Math.round(choice.score),
    play: serializePlay(choice.candidate),
    reasons: choice.reasons,
  };
}

function serializeCoachAdvice(advice, actualPlay, source = "unknown") {
  if (source === "robot-auto") {
    const rec = advice.recommendation;
    return {
      turnNumber: state.turnNumber,
      playerIndex: advice.playerIndex,
      playerName: PLAYER_NAMES[advice.playerIndex],
      source,
      levelRank: advice.levelRank,
      handCount: state.players[advice.playerIndex].hand.length,
      mustBeat: advice.mustBeat,
      choices: rec ? [{
        index: 1,
        score: Math.round(rec.score ?? 0),
        play: serializePlay(rec.candidate),
        reasons: (rec.reasons ?? []).slice(0, 3),
      }] : [],
      actualPlay: serializePlay(actualPlay),
      actualChoiceIndex: 1,
      actualChoiceMatch: "suggestion-1",
    };
  }

  const choices = adviceChoices(advice).map(serializeChoice);
  const actualSignature = playSignature(actualPlay);
  const matchedChoice = choices.find((choice) => playSignature(choice.play) === actualSignature);
  return {
    turnNumber: state.turnNumber,
    playerIndex: advice.playerIndex,
    playerName: PLAYER_NAMES[advice.playerIndex],
    source,
    levelRank: advice.levelRank,
    handCount: state.players[advice.playerIndex].hand.length,
    playersBefore: state.players.map((player, index) => ({
      playerIndex: index,
      playerName: PLAYER_NAMES[index],
      handCount: player.hand.length,
      finishedOrder: player.finishedOrder,
    })),
    tableBefore: currentTableSnapshot(),
    handBefore: sortCardsForDisplay(state.players[advice.playerIndex].hand).map(serializeCard),
    mustBeat: advice.mustBeat,
    handProfile: advice.handProfile,
    choices,
    actualPlay: serializePlay(actualPlay),
    actualChoiceIndex: matchedChoice?.index ?? null,
    actualChoiceMatch: matchedChoice ? `suggestion-${matchedChoice.index}` : "outside-top-3",
  };
}

function recordCoachAdvice(advice, actualPlay, source = "unknown") {
  if (!currentGameMeta) return null;
  const record = serializeCoachAdvice(advice, actualPlay, source);
  appendCoachAdviceRecord(record);
  return record;
}

function appendCoachAdviceRecord(record) {
  if (!currentGameMeta || !record) return null;
  if (!currentGameMeta.coachAdviceTimeline) currentGameMeta.coachAdviceTimeline = [];
  currentGameMeta.coachAdviceTimeline.push(record);
  // 机器人出牌不改变人类分歧统计，跳过全表重算（显著减轻队列卡顿）
  if (record.playerIndex === HUMAN_INDEX) {
    currentGameMeta.divergenceSummaryCache = summarizeGameDivergences(
      currentGameMeta.coachAdviceTimeline,
      HUMAN_INDEX,
    );
  }
  return record;
}

/** 复盘提交用轻量快照，避免 playHistory/明牌等大字段卡死主线程 */
function slimGameSnapshotForReview(snapshot) {
  if (!snapshot) return null;
  const timeline = (snapshot.coachAdviceTimeline ?? []).map(slimCoachAdviceRecord);
  return {
    gameId: snapshot.gameId,
    seed: snapshot.seed,
    exportedAt: snapshot.exportedAt,
    status: snapshot.status,
    levelRank: snapshot.levelRank,
    turnNumber: snapshot.turnNumber,
    finishedPlayers: snapshot.finishedPlayers,
    completedTeam: snapshot.completedTeam,
    drillFocus: snapshot.drillFocus ?? null,
    coachAdviceTimeline: timeline,
  };
}

function yieldToMainThread() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function currentHandLayoutSnapshot() {
  if (!state) return null;
  const cardById = new Map(state.players[HUMAN_INDEX].hand.map((card) => [cardId(card), card]));
  const columns = ensureHandColumns();
  return columns.map((column, columnIndex) => ({
    columnIndex: columnIndex + 1,
    labels: column.map((id) => cardById.get(id)).filter(Boolean).map(cardLabel),
    cards: column.map((id) => cardById.get(id)).filter(Boolean).map(serializeCard),
  }));
}

function currentAdviceSnapshot() {
  if (!state || isGameOver(state) || !currentAdvice) return null;
  const advice = currentAdvice;
  return {
    mustBeat: advice.mustBeat,
    handProfile: advice.handProfile,
    choices: adviceChoices(advice).map(serializeChoice),
  };
}

function currentTableSnapshot() {
  if (!state) return null;
  return {
    currentPlayerIndex: state.currentPlayerIndex,
    currentPlayerName: PLAYER_NAMES[state.currentPlayerIndex],
    lastActivePlayerIndex: state.lastActivePlayerIndex,
    lastActivePlayerName: state.lastActivePlayerIndex === null ? null : PLAYER_NAMES[state.lastActivePlayerIndex],
    lastActivePlay: state.lastActivePlay ? serializePlay(state.lastActivePlay) : null,
    seatPlays: PLAYER_NAMES.map((playerName, playerIndex) => {
      const play = tablePlays.get(playerIndex);
      return {
        playerIndex,
        playerName,
        relationToHuman: playerRelationLabel(playerIndex),
        seatRelationToHuman: playerSeatLabel(playerIndex),
        play: play ? serializePlay(play) : null,
      };
    }),
  };
}

function reviewInitialHands() {
  return currentGameMeta?.initialHands?.map((player) => player.cards) ?? null;
}

function reviewRoundsForState() {
  return groupPlayHistoryByRound(state?.playHistory ?? [], { initialHands: reviewInitialHands() });
}

function serializeReviewRound(round) {
  return {
    roundNumber: round.roundNumber,
    winnerIndex: round.winnerIndex,
    winnerName: round.winnerIndex === null ? null : PLAYER_NAMES[round.winnerIndex],
    actions: round.actions.map((item) => ({
      turnNumber: item.turnNumber,
      playerIndex: item.playerIndex,
      playerName: PLAYER_NAMES[item.playerIndex],
      play: serializePlay(item.play),
    })),
  };
}

function humanIsFirstPlace(gameState = state) {
  return gameState?.finishedPlayers?.[0] === HUMAN_INDEX;
}

function shouldShowTrainingReview(gameState = state) {
  return !!gameState && (humanIsFirstPlace(gameState) || isGameOver(gameState));
}

/** 机器人/自动打完在后台推进时，避免每手全量重绘复盘 DOM */
function isBackgroundAutoPlay(gameState = state) {
  return autoGameRunning
    || Boolean(gameState && !isGameOver(gameState) && gameState.currentPlayerIndex !== HUMAN_INDEX);
}

function captureHeadTourReviewIfNeeded() {
  if (!state || !currentGameMeta || currentGameMeta.headTourReview || !humanIsFirstPlace(state)) return;
  currentGameMeta.headTourReview = {
    capturedAt: new Date().toISOString(),
    capturedAtTurnNumber: state.turnNumber,
    playHistoryLength: state.playHistory.length,
    finishedPlayers: state.finishedPlayers.map((playerIndex, order) => ({
      order: order + 1,
      playerIndex,
      playerName: PLAYER_NAMES[playerIndex],
    })),
    hands: state.players.map((player, index) => ({
      playerIndex: index,
      playerName: PLAYER_NAMES[index],
      finishedOrder: player.finishedOrder,
      cards: sortCardsForDisplay(player.hand).map(serializeCard),
    })),
  };
}

function currentHandPlayGroups() {
  if (!state) return [];
  const cardById = new Map(state.players[HUMAN_INDEX].hand.map((card) => [cardId(card), card]));
  return ensureHandColumns()
    .map((column) => column.map((id) => cardById.get(id)).filter(Boolean))
    .filter((cards) => cards.length > 1)
    .map((cards) => {
      const play = classifyPlay(cards, state.levelRank);
      return { cards, play };
    })
    .filter(({ play }) => play.type !== PLAY_TYPES.invalid && play.type !== PLAY_TYPES.pass)
    .map(({ cards, play }) => ({
      cards,
      label: `${playLabel(play)} ${cardsLabel(cards)}`,
    }));
}

function mlFusionModeForUi() {
  return useMlPolicy ? "smart" : "off";
}

/** 人类教练候选池上限（须与 tests/smoke.mjs 性能预算一致） */
const HUMAN_ADVICE_MAX_CANDIDATES_OPEN = 16;
const HUMAN_ADVICE_MAX_CANDIDATES_PRESS = 40;
const HUMAN_ADVICE_ALTERNATIVES_QUICK = 2;
const HUMAN_ADVICE_ALTERNATIVES_FULL = 6;
const HUMAN_ADVICE_MAX_RETRIES = 2;

/** 本手是否已发起过建议计算（防止 render 循环反复触发） */
let adviceScheduledTableKey = null;

function buildHumanAdviceContext() {
  const hand = state.players[HUMAN_INDEX].hand;
  const pressing = Boolean(state.lastActivePlay && state.lastActivePlay.type !== PLAY_TYPES.pass);
  const columnGroups = pressing ? currentHandPlayGroups() : [];
  const preferredGroups = columnGroups.length > 0
    ? columnGroups
    : buildStrategicGroups(hand, state.levelRank);
  return {
    pressing,
    preferredGroups,
    handProfile: evaluateHandProfile(hand, state.levelRank, { preferredGroups }),
  };
}

function humanAdviceOptionsQuick() {
  const pressing = Boolean(state.lastActivePlay && state.lastActivePlay.type !== PLAY_TYPES.pass);
  const hand = state.players[HUMAN_INDEX].hand;
  const preferredGroups = pressing ? [] : buildStrategicGroups(hand, state.levelRank);
  return {
    alternatives: HUMAN_ADVICE_ALTERNATIVES_QUICK,
    maxCandidates: pressing ? 24 : HUMAN_ADVICE_MAX_CANDIDATES_OPEN,
    preferredGroups,
    handProfile: pressing
      ? null
      : evaluateHandProfile(hand, state.levelRank, { preferredGroups }),
    mlModel: null,
    mlFusionMode: "off",
    lite: true,
  };
}

function humanAdviceOptionsFull(ctx) {
  const opening = !ctx.pressing;
  const useMl = useMlPolicy && mlPolicyModel && ctx.pressing;
  return {
    preferredGroups: ctx.preferredGroups,
    handProfile: ctx.handProfile,
    maxCandidates: opening ? 28 : HUMAN_ADVICE_MAX_CANDIDATES_PRESS,
    alternatives: HUMAN_ADVICE_ALTERNATIVES_FULL,
    mlModel: useMl ? mlPolicyModel : null,
    mlFusionMode: useMl ? mlFusionModeForUi() : "off",
    lite: false,
  };
}

function robotAdviceOptions() {
  return {
    alternatives: 6,
    mlModel: useMlPolicy && mlPolicyModel ? mlPolicyModel : null,
    mlFusionMode: mlFusionModeForUi(),
  };
}

function robotMlModel() {
  return useMlPolicy && mlPolicyModel ? mlPolicyModel : null;
}

/** 建议与桌面状态绑定签名：须压牌型、手牌、回合号任一变化即视为过期 */
function buildAdviceTableKey(gameState = state) {
  if (!gameState) return "";
  const hand = gameState.players[HUMAN_INDEX]?.hand ?? [];
  const handSig = hand.map((card) => cardId(card)).sort().join("|");
  const mustBeatSig = gameState.lastActivePlay ? playSignature(gameState.lastActivePlay) : "";
  return `${gameState.turnNumber}|${mustBeatSig}|${handSig}`;
}

function isAdviceStale(advice) {
  if (!advice?.tableKey || !state) return true;
  if (state.currentPlayerIndex !== HUMAN_INDEX) return true;
  return advice.tableKey !== buildAdviceTableKey();
}

function invalidateStaleAdvice() {
  if (currentAdvice && isAdviceStale(currentAdvice)) currentAdvice = null;
}

function getHumanAdviceQuick() {
  const advice = getTurnAdvice(state, HUMAN_INDEX, humanAdviceOptionsQuick());
  advice.tableKey = buildAdviceTableKey();
  advice._phase = "quick";
  return advice;
}

function getHumanAdviceFromContext(ctx, phase = "full") {
  const advice = getTurnAdvice(state, HUMAN_INDEX, humanAdviceOptionsFull(ctx));
  advice.tableKey = buildAdviceTableKey();
  advice._phase = phase;
  return advice;
}

function applyHumanAdviceIfCurrent(advice, generation) {
  if (generation !== adviceComputeGeneration.value) return false;
  if (advice.tableKey !== buildAdviceTableKey()) return false;
  currentAdvice = advice;
  adviceScheduledTableKey = advice.tableKey;
  adviceComputeState.retryCount = 0;
  return true;
}

function cancelIdleTask(idRef) {
  if (idRef.value === null) return;
  if (typeof cancelIdleCallback === "function") {
    cancelIdleCallback(idRef.value);
  } else {
    clearTimeout(idRef.value);
  }
  idRef.value = null;
}

const adviceRefreshIdleRef = { value: null };
const deferredPanelsIdleRef = { value: null };
const ADVICE_SLOW_NOTICE_MS = 900;
const adviceComputeGeneration = { value: 0 };
const adviceComputeState = {
  inFlight: false,
  slowNotice: false,
  slowTimer: null,
  pendingRefresh: false,
  watchdogTimer: null,
  retryCount: 0,
};
const ADVICE_COMPUTE_TIMEOUT_MS = 8_000;

function clearAdviceSlowTimer() {
  if (adviceComputeState.slowTimer !== null) {
    clearTimeout(adviceComputeState.slowTimer);
    adviceComputeState.slowTimer = null;
  }
}

function clearAdviceComputeWatchdog() {
  if (adviceComputeState.watchdogTimer !== null) {
    clearTimeout(adviceComputeState.watchdogTimer);
    adviceComputeState.watchdogTimer = null;
  }
}

function finishAdviceCompute({ generation, refreshUi = true } = {}) {
  clearAdviceSlowTimer();
  clearAdviceComputeWatchdog();
  adviceComputeState.inFlight = false;
  adviceComputeState.slowNotice = false;
  const generationCurrent = generation == null || generation === adviceComputeGeneration.value;
  if (!generationCurrent) {
    if (adviceComputeState.pendingRefresh) scheduleHumanAdviceRefresh();
    return;
  }
  if (!state || isGameOver(state) || state.currentPlayerIndex !== HUMAN_INDEX) return;
  if (hintAwaiting && currentAdvice) applyHintFromAdvice(currentAdvice);
  if (refreshUi) {
    renderAdvice({ computeAdvice: false });
    renderControls();
  }
  if (
    !currentAdvice
    && adviceComputeState.pendingRefresh
    && adviceComputeState.retryCount < HUMAN_ADVICE_MAX_RETRIES
  ) {
    adviceComputeState.pendingRefresh = false;
    adviceComputeState.retryCount += 1;
    scheduleHumanAdviceRefresh({ force: true });
  } else {
    adviceComputeState.pendingRefresh = false;
  }
}

/** 取消进行中的 advice 计算（新局/恢复/出牌后避免并行或过期结果写回） */
function cancelAdviceCompute() {
  cancelIdleTask(adviceRefreshIdleRef);
  clearAdviceSlowTimer();
  clearAdviceComputeWatchdog();
  adviceComputeGeneration.value += 1;
  adviceComputeState.inFlight = false;
  adviceComputeState.slowNotice = false;
  adviceComputeState.pendingRefresh = false;
  adviceComputeState.retryCount = 0;
  adviceScheduledTableKey = null;
}

function advicePendingMessage() {
  return adviceComputeState.slowNotice
    ? "可先出牌，推荐稍后更新。"
    : "正在计算推荐，请稍候… 也可先手动选牌出牌。";
}

/** 让出主线程后再算全量建议，避免长时间阻塞 UI */
function runHumanAdviceCompute({ refreshUi = true } = {}) {
  if (robotQueueActive) {
    adviceComputeState.pendingRefresh = true;
    return;
  }
  if (adviceComputeState.inFlight) {
    adviceComputeState.pendingRefresh = true;
    return;
  }
  const generation = adviceComputeGeneration.value;
  adviceComputeState.inFlight = true;
  adviceComputeState.slowNotice = false;
  clearAdviceSlowTimer();
  clearAdviceComputeWatchdog();
  adviceComputeState.slowTimer = setTimeout(() => {
    if (generation !== adviceComputeGeneration.value || currentAdvice) return;
    adviceComputeState.slowNotice = true;
    if (refreshUi && state?.currentPlayerIndex === HUMAN_INDEX) {
      renderAdvice({ computeAdvice: false });
    }
  }, ADVICE_SLOW_NOTICE_MS);
  adviceComputeState.watchdogTimer = setTimeout(() => {
    if (!adviceComputeState.inFlight || generation !== adviceComputeGeneration.value) return;
    console.warn("教练建议计算超时，中止本轮");
    adviceComputeState.inFlight = false;
    adviceComputeState.slowNotice = true;
    adviceScheduledTableKey = buildAdviceTableKey();
    if (refreshUi && state?.currentPlayerIndex === HUMAN_INDEX) {
      renderAdvice({ computeAdvice: false });
    }
  }, ADVICE_COMPUTE_TIMEOUT_MS);

  window.setTimeout(() => {
    try {
      if (generation !== adviceComputeGeneration.value) return;
      if (!state || isGameOver(state)) return;
      const forHuman = state.currentPlayerIndex === HUMAN_INDEX;
      if (refreshUi && !forHuman) return;
      if (!refreshUi && forHuman) return;

      const quickAdvice = getHumanAdviceQuick();
      applyHumanAdviceIfCurrent(quickAdvice, generation);

      if (hintAwaiting && useMlPolicy && mlPolicyModel && generation === adviceComputeGeneration.value) {
        const ctx = buildHumanAdviceContext();
        if (ctx.pressing) {
          window.setTimeout(() => {
            try {
              if (generation !== adviceComputeGeneration.value) return;
              const fullAdvice = getHumanAdviceFromContext(ctx, "full");
              if (applyHumanAdviceIfCurrent(fullAdvice, generation) && refreshUi) {
                renderAdvice({ computeAdvice: false });
                renderControls();
              }
            } catch (error) {
              console.error("教练建议 ML 精算失败", error);
            }
          }, 0);
        }
      }
    } catch (error) {
      console.error("教练建议计算失败", error);
    } finally {
      finishAdviceCompute({ generation, refreshUi });
    }
  }, 0);
}

/** 机器人回合期间在空闲时预计算下一手人类建议，不挡出牌队列 */
function scheduleIdleHumanAdviceRefresh() {
  if (robotQueueActive) return;
  cancelIdleTask(adviceRefreshIdleRef);
  const generation = adviceComputeGeneration.value;
  const run = () => {
    adviceRefreshIdleRef.value = null;
    if (generation !== adviceComputeGeneration.value) return;
    if (robotQueueActive) return;
    if (!state || isGameOver(state) || state.currentPlayerIndex === HUMAN_INDEX) return;
    if (currentAdvice || adviceComputeState.inFlight) return;
    runHumanAdviceCompute({ refreshUi: false });
  };
  if (typeof requestIdleCallback === "function") {
    adviceRefreshIdleRef.value = requestIdleCallback(run, { timeout: 800 });
  } else {
    adviceRefreshIdleRef.value = window.setTimeout(run, 0);
  }
}

/** 人类回合延后全量建议，避免 newGame / lite 渲染路径同步 getHumanAdvice 卡死主线程 */
function scheduleHumanAdviceRefresh({ force = false } = {}) {
  cancelIdleTask(adviceRefreshIdleRef);
  invalidateStaleAdvice();
  const tableKey = buildAdviceTableKey();
  if (currentAdvice && !isAdviceStale(currentAdvice)) {
    renderAdvice({ computeAdvice: false });
    if (hintAwaiting) applyHintFromAdvice(currentAdvice);
    return;
  }
  if (!force && adviceScheduledTableKey === tableKey) {
    return;
  }
  if (adviceComputeState.inFlight) {
    adviceComputeState.pendingRefresh = true;
    return;
  }
  adviceScheduledTableKey = tableKey;
  const generation = adviceComputeGeneration.value;
  const run = () => {
    adviceRefreshIdleRef.value = null;
    if (generation !== adviceComputeGeneration.value) return;
    if (!state || isGameOver(state) || state.currentPlayerIndex !== HUMAN_INDEX) return;
    runHumanAdviceCompute({ refreshUi: true });
  };
  adviceRefreshIdleRef.value = window.setTimeout(run, 0);
}

/** 轻量渲染后延后刷新历史/复盘等重组件 */
function scheduleDeferredPanelsRender() {
  if (robotQueueActive) return;
  cancelIdleTask(deferredPanelsIdleRef);
  const run = () => {
    deferredPanelsIdleRef.value = null;
    if (robotQueueActive) return;
    if (!state) return;
    renderHistory();
    renderGameReviewPanel();
    renderProgressPanel();
    renderAiChatLog();
    renderFabChatLog();
    renderFabQaLimitHint();
    renderOnboarding();
    updateFirstTips();
    if (bootComplete) schedulePersistSession();
  };
  if (typeof requestIdleCallback === "function") {
    deferredPanelsIdleRef.value = requestIdleCallback(run, { timeout: 600 });
  } else {
    deferredPanelsIdleRef.value = window.setTimeout(run, 0);
  }
}

function currentGameSnapshot(status = "in-progress") {
  if (!state || !currentGameMeta) return null;
  const coachAdviceTimeline = currentGameMeta.coachAdviceTimeline ?? [];
  const coachAdviceByTurn = new Map(coachAdviceTimeline.map((item) => [item.turnNumber, item]));
  return {
    ...currentGameMeta,
    exportedAt: new Date().toISOString(),
    status: isGameOver(state) ? "complete" : status,
    levelRank: state.levelRank,
    turnNumber: state.turnNumber,
    finishedPlayers: state.finishedPlayers.map((playerIndex, order) => ({
      order: order + 1,
      playerIndex,
      playerName: PLAYER_NAMES[playerIndex],
    })),
    completedTeam: completedTeam(state),
    initialHands: currentGameMeta.initialHands,
    currentTable: currentTableSnapshot(),
    humanHandLayout: currentHandLayoutSnapshot(),
    currentAdvice: currentAdviceSnapshot(),
    coachAdviceTimeline,
    aiChatTimeline: aiChatTimeline.map((item) => ({ ...item })),
    headTourReview: currentGameMeta.headTourReview ?? null,
    remainingHands: state.players.map((player, index) => ({
      playerIndex: index,
      playerName: PLAYER_NAMES[index],
      cards: player.hand.map(serializeCard),
    })),
    reviewRounds: reviewRoundsForState().map(serializeReviewRound),
    playHistory: state.playHistory.map((item) => ({
      turnNumber: item.turnNumber,
      playerIndex: item.playerIndex,
      playerName: PLAYER_NAMES[item.playerIndex],
      play: serializePlay(item.play),
      coachAdvice: coachAdviceByTurn.get(item.turnNumber) ?? null,
    })),
  };
}

function buildAiCoachContext(question = "") {
  if (!state) {
    return {
      status: "no-game",
      question,
      note: "当前还没有开始牌局。",
    };
  }

  const visibleContext = {
    status: isGameOver(state) ? "game-over" : "in-progress",
    question,
    levelRank: state.levelRank,
    turnNumber: state.turnNumber,
    currentPlayerIndex: state.currentPlayerIndex,
    currentPlayerName: PLAYER_NAMES[state.currentPlayerIndex],
    humanPlayerIndex: HUMAN_INDEX,
    partnerIndex: (HUMAN_INDEX + 2) % PLAYER_NAMES.length,
    teamMap: {
      ourTeam: [HUMAN_INDEX, (HUMAN_INDEX + 2) % PLAYER_NAMES.length].map((playerIndex) => ({
        playerIndex,
        playerName: PLAYER_NAMES[playerIndex],
        relation: playerRelationLabel(playerIndex),
      })),
      opponentTeam: PLAYER_NAMES.map((playerName, playerIndex) => ({ playerIndex, playerName }))
        .filter((player) => ![HUMAN_INDEX, (HUMAN_INDEX + 2) % PLAYER_NAMES.length].includes(player.playerIndex))
        .map((player) => ({
          ...player,
          relation: playerRelationLabel(player.playerIndex),
        })),
      rule: "掼蛋固定 0 和 2 为一队，1 和 3 为一队；不要把对手称为队友或搭档。",
    },
    players: state.players.map((player, index) => ({
      playerIndex: index,
      playerName: PLAYER_NAMES[index],
      relationToHuman: playerRelationLabel(index),
      seatRelationToHuman: playerSeatLabel(index),
      handCount: player.hand.length,
      finishedOrder: player.finishedOrder,
    })),
    table: currentTableSnapshot(),
    humanHand: sortCardsForDisplay(state.players[HUMAN_INDEX].hand).map(serializeCard),
    humanHandLayout: currentHandLayoutSnapshot(),
    physicalRankCounts: (() => {
      const counts = new Map();
      for (const card of state.players[HUMAN_INDEX].hand) {
        if (card.rank === "SJ" || card.rank === "BJ") continue;
        counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
      }
      return [...counts.entries()]
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([rank, count]) => ({ rank, count }));
    })(),
    currentAdvice: currentAdviceSnapshot(),
    recentPlayHistory: state.playHistory.slice(-24).map((item) => ({
      turnNumber: item.turnNumber,
      playerIndex: item.playerIndex,
      playerName: PLAYER_NAMES[item.playerIndex],
      play: serializePlay(item.play),
    })),
    recentCoachAdvice: (currentGameMeta?.coachAdviceTimeline ?? []).slice(-12),
    engineFacts: buildEngineFacts({
      humanHand: sortCardsForDisplay(state.players[HUMAN_INDEX].hand).map(serializeCard),
      currentAdvice: currentAdviceSnapshot(),
    }),
    recentAiConversation: aiChatTimeline.slice(-6).map((item) => ({
      createdAt: item.createdAt,
      question: item.question,
      answer: item.answer,
      error: item.error,
    })),
  };

  if (shouldShowTrainingReview(state)) {
    visibleContext.openHandsReview = {
      reason: humanIsFirstPlace(state) ? "你已经头游，进入复盘视角。" : "本局已结束，进入复盘视角。",
      remainingHands: state.players.map((player, index) => ({
        playerIndex: index,
        playerName: PLAYER_NAMES[index],
        finishedOrder: player.finishedOrder,
        cards: sortCardsForDisplay(player.hand).map(serializeCard),
      })),
      reviewRounds: reviewRoundsForState().map(serializeReviewRound),
    };
  }

  return visibleContext;
}

function appendAiChatRecord(record) {
  const slim = slimAiChatRecord(record);
  aiChatTimeline.push(slim);
  if (currentGameMeta) {
    currentGameMeta.aiChatTimeline = aiChatTimeline.map(slimAiChatRecord);
  }
  renderAiChatLog();
  renderFabChatLog();
  return slim;
}

function renderAiChatLog() {
  if (!elements.aiChatLog) return;
  elements.aiChatLog.hidden = aiChatTimeline.length === 0;
  elements.aiChatLog.replaceChildren();
  for (const item of aiChatTimeline.slice(-10)) {
    const question = document.createElement("div");
    question.className = "ai-message user";
    question.innerHTML = `<strong>你问</strong>${escapeHtml(item.question)}`;
    elements.aiChatLog.append(question);

    const answer = document.createElement("div");
    answer.className = "ai-message";
    answer.innerHTML = `<strong>教练</strong>${escapeHtml(item.answer || item.error || "等待处理")}`;
    elements.aiChatLog.append(answer);
  }
  elements.aiChatLog.scrollTop = elements.aiChatLog.scrollHeight;
}

function clearAiChat() {
  aiChatTimeline = [];
  if (currentGameMeta) currentGameMeta.aiChatTimeline = aiChatTimeline;
  if (elements.aiQuestion) elements.aiQuestion.value = "";
  if (elements.aiStatus) elements.aiStatus.textContent = "对话已清空，可以重新开始提问。";
  renderAiChatLog();
  renderFabChatLog();
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function playFromSerialized(serialized) {
  if (!serialized) return null;
  const cards = (serialized.cards ?? []).map((card) => createCard(
    card.rank,
    card.suit,
    card.deckIndex ?? 0,
  ));
  return {
    type: serialized.type,
    mainRank: serialized.mainRank,
    length: serialized.length,
    cards,
    label: serialized.label,
  };
}

function choiceFromTimelineItem(item) {
  return {
    score: item.score ?? 0,
    candidate: playFromSerialized(item.play),
    reasons: item.reasons ?? [],
  };
}

function humanCoachRecord(turnNumber) {
  return (currentGameMeta?.coachAdviceTimeline ?? []).find(
    (record) => record.turnNumber === turnNumber && record.playerIndex === HUMAN_INDEX,
  ) ?? null;
}

function isTop1MatchRecord(record) {
  if (!isHumanReplayRecord(record, HUMAN_INDEX)) return false;
  return record.actualChoiceMatch === "suggestion-1";
}

function showCoachToast(text) {
  if (!elements.coachToast || !text) return;
  elements.coachToast.hidden = false;
  elements.coachToast.textContent = text;
  elements.coachToast.classList.add("show");
  clearTimeout(coachToastTimer);
  coachToastTimer = window.setTimeout(() => {
    elements.coachToast?.classList.remove("show");
    if (elements.coachToast) elements.coachToast.hidden = true;
  }, 1800);
}

async function saveFabFeedback(record) {
  const result = await pushCoachFeedbackForQuestion(record.question, record);
  showCoachToast(result.online
    ? "反馈已保存，会用于改进教练"
    : "已暂存本机，下次启动后会自动同步");
}

function renderFabChatLog() {
  if (!elements.coachFabLog) return;
  const fabItems = aiChatTimeline.filter((item) => item.source === "fab-coach");
  elements.coachFabLog.replaceChildren();

  if (fabItems.length === 0) {
    const hint = document.createElement("p");
    hint.className = "coach-fab-hint";
    const buildTag = globalThis.__GUANDAN_BUILD__ ? ` · 构建 ${globalThis.__GUANDAN_BUILD__}` : "";
    hint.textContent = `本机规则引擎 v2 直接作答，与左侧推荐一致${buildTag}。`;
    elements.coachFabLog.append(hint);
    return;
  }

  for (const item of fabItems.slice(-6)) {
    const entry = document.createElement("div");
    entry.className = "coach-fab-entry";

    const question = document.createElement("div");
    question.className = "coach-fab-entry-q";
    question.innerHTML = `<strong>你问</strong> ${escapeHtml(item.question)}`;

    const answer = document.createElement("div");
    answer.className = "coach-fab-entry-a";
    answer.innerHTML = `<strong>教练</strong> ${escapeHtml(item.answer || item.error || "—")}`;

    const actions = document.createElement("div");
    actions.className = "coach-fab-entry-actions";

    const saveBtn = document.createElement("button");
    saveBtn.className = "btn";
    saveBtn.type = "button";
    saveBtn.textContent = "保存这条反馈";
    saveBtn.addEventListener("click", () => saveFabFeedback(item));

    actions.append(saveBtn);
    entry.append(question, answer, actions);
    elements.coachFabLog.append(entry);
  }
  elements.coachFabLog.scrollTop = elements.coachFabLog.scrollHeight;
}

function renderFabQaLimitHint() {
  if (!elements.coachFabLimit) return;
  if (FAB_QA_LIMIT_PER_GAME <= 0) {
    elements.coachFabLimit.textContent = "本机规则引擎作答，与左侧推荐一致。";
    return;
  }
  const used = currentGameMeta?.fabQaCount ?? 0;
  const left = Math.max(0, FAB_QA_LIMIT_PER_GAME - used);
  elements.coachFabLimit.textContent = `本局还可问 ${left} / ${FAB_QA_LIMIT_PER_GAME} 次。`;
}

function syncCoachFabMobileChrome(open) {
  const mobile = MOBILE_LAYOUT_MQ?.matches ?? false;
  if (elements.coachFabBackdrop) {
    elements.coachFabBackdrop.hidden = !(open && mobile);
  }
  document.body.classList.toggle("coach-fab-open", open && mobile);
  if (open && mobile && elements.coachFabQuestion) {
    requestAnimationFrame(() => {
      elements.coachFabQuestion?.focus({ preventScroll: true });
    });
  }
}

function setCoachFabOpen(open) {
  coachFabOpen = open;
  if (elements.coachFabDrawer) elements.coachFabDrawer.hidden = !open;
  syncCoachFabMobileChrome(open);
  renderFabQaLimitHint();
}

function toggleCoachFab() {
  setCoachFabOpen(!coachFabOpen);
}

function submitInPlayInsight(question) {
  const text = String(question ?? "").trim();
  if (!text) {
    showCoachToast("先写一句意见，再提交");
    return;
  }
  if (!state || !currentGameMeta || isGameOver(state)) {
    showCoachToast("请先开局并在轮到你时反馈");
    return;
  }
  if (state.currentPlayerIndex !== HUMAN_INDEX) {
    showCoachToast("轮到你出牌时再提意见");
    return;
  }

  const context = buildAiCoachContext(text);
  const { analysis, verdict } = analyzeInPlayInsight(text, context);
  const top1 = currentAdvice ? adviceChoices(currentAdvice)[0] : null;
  const insight = normalizeGameInsight({
    turnNumber: state.turnNumber,
    question: text,
    analysis,
    verdict,
    top1Label: top1?.candidate?.label ?? null,
    userNote: text,
  });
  if (!insight) return;

  if (!currentGameMeta.gameInsights) currentGameMeta.gameInsights = [];
  currentGameMeta.gameInsights.push(insight);

  const reply = formatInPlayInsightReply(analysis, verdict);
  showCoachToast(reply);

  const record = {
    id: `insight-${Date.now()}`,
    createdAt: insight.createdAt,
    source: "in-play-insight",
    model: "rule-engine",
    question: text,
    context,
    answer: reply,
    answerSource: "in-play-insight",
    insightVerdict: verdict,
    error: null,
  };
  appendAiChatRecord(record);
  renderFabChatLog();
  renderAdvice();
  renderGameReviewPanel();
  schedulePersistSession();
}

function askFabCoachObjection() {
  const question = elements.coachFabQuestion?.value.trim() ?? "";
  if (!question) {
    if (elements.coachFabQuestion) {
      elements.coachFabQuestion.placeholder = "例如：不应拆对组同花顺";
      elements.coachFabQuestion.focus();
    }
    showCoachToast("写一句意见，再点「这手不合理」");
    return;
  }
  submitInPlayInsight(question);
  if (elements.coachFabQuestion) elements.coachFabQuestion.value = "";
}

function askFabCoach() {
  const question = elements.coachFabQuestion?.value.trim() ?? "";
  if (!question) {
    showCoachToast("先写一句问题，再点发送");
    return;
  }
  if (!state || !currentGameMeta) {
    showCoachToast("请先开局再提问");
    return;
  }
  if (FAB_QA_LIMIT_PER_GAME > 0) {
    const used = currentGameMeta.fabQaCount ?? 0;
    if (used >= FAB_QA_LIMIT_PER_GAME) {
      showCoachToast(`本局已问满 ${FAB_QA_LIMIT_PER_GAME} 次，请下一局再问`);
      return;
    }
    currentGameMeta.fabQaCount = used + 1;
    renderFabQaLimitHint();
  }

  const context = buildAiCoachContext(question);
  const answer = tryLocalCoachAnswer(question, context);
  const answerText = appendRuleEngineAnswerFooter(
    answer?.text ?? "暂无规则答复，可换种问法。",
  );
  const record = {
    id: `fab-${Date.now()}`,
    createdAt: new Date().toISOString(),
    source: "fab-coach",
    model: "rule-engine",
    question,
    context,
    answer: answerText,
    answerSource: answer?.mode ?? answer?.source ?? "rule-engine",
    error: null,
  };
  appendAiChatRecord(record);
  renderFabChatLog();
  if (elements.coachFabQuestion) elements.coachFabQuestion.value = "";
}

function hideDivergenceDetail() {
  selectedDivergenceTurn = null;
  if (elements.divergenceDetail) {
    elements.divergenceDetail.hidden = true;
    elements.divergenceDetail.replaceChildren();
  }
}

function hideSavedDivergenceDetail() {
  if (elements.savedDivergenceDetail) {
    elements.savedDivergenceDetail.hidden = true;
    elements.savedDivergenceDetail.replaceChildren();
  }
}

function divergenceItemForTurn(turnNumber) {
  const summary = currentDivergenceSummary();
  return summary.divergences.find((item) => item.turnNumber === turnNumber) ?? null;
}

function findUserDispute(turnNumber) {
  return (currentGameMeta?.userDisputes ?? []).find((item) => item.turnNumber === turnNumber) ?? null;
}

/** 仅「教练更对」可提交异议 */
function canDisputeVerdict(verdict) {
  return verdict === DIVERGENCE_VERDICTS.COACH_BETTER;
}

/** 将推荐对比面板渲染到指定容器（本局或历史复盘共用） */
function renderDivergenceDetailInto(container, record, turnNumber, onClose, { divergenceItem = null } = {}) {
  if (!record || !container) return;
  container.hidden = false;
  container.replaceChildren();

  const head = document.createElement("div");
  head.className = "divergence-detail-head";
  const title = document.createElement("h3");
  title.textContent = `第 ${turnNumber} 手：推荐 vs 实际`;
  const closeBtn = document.createElement("button");
  closeBtn.className = "divergence-detail-close";
  closeBtn.type = "button";
  closeBtn.textContent = "收起";
  closeBtn.addEventListener("click", onClose);
  head.append(title, closeBtn);
  container.append(head);

  const choicesWrap = document.createElement("div");
  choicesWrap.className = "divergence-detail-choices";
  const choices = (record.choices ?? []).slice(0, 3);
  if (choices.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "该手暂无推荐1～3记录。";
    choicesWrap.append(empty);
  } else {
    for (const [index, item] of choices.entries()) {
      choicesWrap.append(renderChoiceCard(choiceFromTimelineItem(item), index));
    }
  }
  container.append(choicesWrap);

  const actual = document.createElement("div");
  actual.className = "divergence-detail-actual";
  const actualLabel = record.actualPlay?.label ?? "—";
  actual.innerHTML = `你实际出：<strong>${escapeHtml(actualLabel)}</strong>`;
  if (record.actualChoiceMatch) {
    const matchNote = record.actualChoiceMatch === "suggestion-1"
      ? "与推荐1一致"
      : record.actualChoiceMatch === "outside-top-3"
        ? "不在推荐1～3"
        : `对应推荐${record.actualChoiceMatch.replace("suggestion-", "")}`;
    actual.innerHTML += `<br><span class="muted">${escapeHtml(matchNote)}</span>`;
  }
  container.append(actual);

  const divItem = divergenceItem ?? divergenceItemForTurn(turnNumber);
  if (divItem && canDisputeVerdict(divItem.verdict)) {
    const disputeWrap = document.createElement("div");
    disputeWrap.className = "divergence-dispute";
    const existing = findUserDispute(turnNumber);
    if (existing) {
      disputeWrap.innerHTML = `
        <p class="dispute-title"><strong>你的意见</strong> <span class="dispute-recorded">已记录</span></p>
        <p class="dispute-rationale">${escapeHtml(existing.userRationale)}</p>
      `;
    } else {
      const label = document.createElement("label");
      label.className = "dispute-title";
      label.htmlFor = `dispute-rationale-${turnNumber}`;
      label.innerHTML = "<strong>我有异议</strong>";
      const textarea = document.createElement("textarea");
      textarea.id = `dispute-rationale-${turnNumber}`;
      textarea.className = "dispute-rationale-input";
      textarea.rows = 2;
      textarea.placeholder = "例如：这手应该先保顺子…";
      const actions = document.createElement("div");
      actions.className = "dispute-actions";
      const submitBtn = document.createElement("button");
      submitBtn.type = "button";
      submitBtn.className = "dispute-submit-btn";
      submitBtn.dataset.disputeTurn = String(turnNumber);
      submitBtn.textContent = "提交";
      const ack = document.createElement("p");
      ack.className = "muted dispute-ack";
      ack.hidden = true;
      actions.append(submitBtn);
      disputeWrap.append(label, textarea, actions, ack);
    }
    container.append(disputeWrap);
  }
}

function showDivergenceDetail(turnNumber) {
  const record = humanCoachRecord(turnNumber);
  if (!record || !elements.divergenceDetail) return;
  selectedDivergenceTurn = turnNumber;
  hideSavedDivergenceDetail();
  scrollToHistoryHand(turnNumber);
  renderDivergenceDetailInto(
    elements.divergenceDetail,
    record,
    turnNumber,
    hideDivergenceDetail,
    { divergenceItem: divergenceItemForTurn(turnNumber) },
  );
  elements.divergenceDetail.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function showSavedDivergenceDetail(gameId, turnNumber) {
  const game = findReviewHistoryGame(gameId);
  if (!game || !elements.savedDivergenceDetail) return;
  const record = (game.coachAdviceTimeline ?? []).find(
    (item) => item.turnNumber === turnNumber && item.playerIndex === HUMAN_INDEX,
  );
  if (!record) return;
  hideDivergenceDetail();
  renderDivergenceDetailInto(
    elements.savedDivergenceDetail,
    record,
    turnNumber,
    hideSavedDivergenceDetail,
  );
  elements.savedDivergenceDetail.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setRulesDrawerOpen(open) {
  rulesDrawerOpen = open;
  if (elements.rulesDrawer) elements.rulesDrawer.hidden = !open;
  if (elements.rulesBackdrop) elements.rulesBackdrop.hidden = !open;
  document.body.style.overflow = open ? "hidden" : "";
}

function toggleRulesDrawer() {
  setRulesDrawerOpen(!rulesDrawerOpen);
}

function toggleReviewHistoryGame(gameId) {
  expandedReviewGameId = expandedReviewGameId === gameId ? null : gameId;
  hideSavedDivergenceDetail();
  renderReviewHistoryList();
}

function renderExpandedReviewGameDetail() {
  if (!elements.reviewHistoryDetail) return;
  if (!expandedReviewGameId) {
    elements.reviewHistoryDetail.hidden = true;
    elements.reviewHistoryDetail.replaceChildren();
    hideSavedDivergenceDetail();
    return;
  }
  const game = findReviewHistoryGame(expandedReviewGameId);
  if (!game) {
    expandedReviewGameId = null;
    elements.reviewHistoryDetail.hidden = true;
    elements.reviewHistoryDetail.replaceChildren();
    return;
  }

  const top3 = (game.divergences ?? [])
    .filter((item) => item.verdict === DIVERGENCE_VERDICTS.COACH_BETTER)
    .slice(0, 3);
  const savedDate = new Date(game.savedAt).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let html = `<h5>${escapeHtml(savedDate)} · 打 ${escapeHtml(String(game.levelRank ?? "—"))}</h5>`;
  html += `<p>共 <strong>${game.divergenceCount}</strong> 处与推荐不同（${game.totalHands} 手）。</p>`;

  if (top3.length > 0) {
    html += "<div class=\"review-history-top3\"><p class=\"muted\">最该改的三处（教练更对）：</p>";
    for (const item of top3) {
      const reason = item.verdictNote || "详见差异说明";
      html += `<article class="improve-card saved-improve-card" data-game-id="${escapeHtml(game.gameId)}" data-hand-index="${item.turnNumber}" role="button" tabindex="0" title="点击查看推荐对比">
        <span class="improve-card-turn">第 ${item.turnNumber} 手</span>
        <p>你出了 <strong>${escapeHtml(item.actual)}</strong>，推荐 <strong>${escapeHtml(item.recommended)}</strong></p>
        <p class="improve-card-reason">原因：${escapeHtml(reason)}</p>
      </article>`;
    }
    html += "</div>";
  } else if (game.divergenceCount === 0) {
    html += "<p class=\"muted\">该局与推荐1完全一致。</p>";
  } else {
    html += "<p class=\"muted\">暂无「教练更对」类差异摘要。</p>";
  }

  elements.reviewHistoryDetail.hidden = false;
  elements.reviewHistoryDetail.innerHTML = html;
}

function renderReviewHistoryList() {
  if (!elements.reviewHistoryList) return;
  const games = [...loadReviewHistory().games].reverse();

  if (games.length === 0) {
    elements.reviewHistoryList.innerHTML = "<p class=\"muted\">保存复盘后，最近 30 局会出现在这里。</p>";
    if (elements.reviewHistoryDetail) {
      elements.reviewHistoryDetail.hidden = true;
      elements.reviewHistoryDetail.replaceChildren();
    }
    hideSavedDivergenceDetail();
    return;
  }

  let html = "<ul class=\"review-history-list\">";
  for (const game of games) {
    const dateStr = new Date(game.savedAt).toLocaleDateString("zh-CN", {
      month: "numeric",
      day: "numeric",
    });
    const level = game.levelRank ?? "—";
    const active = expandedReviewGameId === game.gameId ? " review-history-item--active" : "";
    const alignPct = game.totalHands > 0
      ? Math.round((game.top1AlignRate ?? 0) * 100)
      : 0;
    html += `<li class="review-history-item${active}" data-game-id="${escapeHtml(game.gameId)}" role="button" tabindex="0" title="点击查看该局摘要">
      <div><strong>打 ${escapeHtml(String(level))}</strong> · ${game.divergenceCount} 处差异 · ${game.totalHands} 手</div>
      <div class="review-history-item-meta"><span>${escapeHtml(dateStr)}</span><span>推荐1一致 ${alignPct}%</span></div>
    </li>`;
  }
  html += "</ul>";
  elements.reviewHistoryList.innerHTML = html;
  renderExpandedReviewGameDetail();
}

function renderProgressPanel() {
  if (!elements.progressStats) return;
  if (!progressPanelDirty) return;
  progressPanelDirty = false;
  const stats = loadProgressStats();
  const alignRate = formatAlignRate(stats);
  const lastSaved = loadReviewHistory().games.at(-1);
  const recentSavedLine = lastSaved
    ? `<p class="muted">最近保存：打 ${escapeHtml(String(lastSaved.levelRank ?? "—"))}，${lastSaved.divergenceCount} 处差异（${new Date(lastSaved.savedAt).toLocaleDateString("zh-CN")}）</p>`
    : "<p class=\"muted\">保存复盘后，这里会显示最近一次记录。</p>";
  elements.progressStats.innerHTML = `
    <div class="progress-stats-grid">
      <div class="progress-stat-card"><strong>${stats.totalGames}</strong><span>累计局数</span></div>
      <div class="progress-stat-card"><strong>${alignRate}</strong><span>推荐1一致率</span></div>
      <div class="progress-stat-card"><strong>${stats.totalHands}</strong><span>累计决策手</span></div>
    </div>
    ${recentSavedLine}
    <p class="muted">近 7 局推荐1对齐趋势（保存复盘后更新）</p>
    ${renderRecentTrendBars(stats.recentGames)}
  `;
  renderReviewHistoryList();
  renderDrillPracticePanel();
}

function renderDrillPracticePanel() {
  if (!elements.drillPracticeList) return;
  const weaknesses = analyzeWeaknesses({
    currentTimeline: currentGameMeta?.coachAdviceTimeline ?? null,
    limit: 5,
  });
  elements.drillPracticeList.innerHTML = renderDrillPracticeListHtml(weaknesses);
}

function openDrillPracticePanel() {
  if (elements.drillPanel) {
    elements.drillPanel.open = true;
    progressPanelDirty = true;
    renderProgressPanel();
    elements.drillPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function startDrillPractice(tag) {
  if (!tag) return;

  const exitingMatch = Boolean(matchState);
  const matchGameNumber = matchState?.gameNumber;

  newGame({ drillFocus: tag });

  if (exitingMatch) {
    const prefix = matchGameNumber
      ? `已退出竞技赛第 ${matchGameNumber} 局。`
      : "已退出竞技赛。";
    message = `${prefix}${message}`;
  }

  if (elements.drillPanel) elements.drillPanel.open = false;
  elements.hand?.scrollIntoView({ behavior: "smooth", block: "center" });

  showCoachToast("已开启专项练习，请出牌");
}

async function askAiCoach() {
  const question = elements.aiQuestion?.value.trim() ?? "";
  if (!question) {
    if (elements.aiStatus) elements.aiStatus.textContent = "写一句哪里不对，再点反馈。";
    return;
  }
  if (!state || !currentGameMeta) {
    if (elements.aiStatus) elements.aiStatus.textContent = "请先开局再反馈。";
    return;
  }

  const context = buildAiCoachContext(question);
  const record = {
    id: `ai-${Date.now()}`,
    createdAt: new Date().toISOString(),
    source: "panel-feedback",
    model: "auto-fix-queue",
    question,
    context,
    answer: "已记录你的反馈，会用于改进推荐。",
    answerSource: "queued",
    error: null,
  };
  appendAiChatRecord(record);

  const result = await pushCoachFeedbackForQuestion(question, record);
  if (elements.aiStatus) {
    elements.aiStatus.textContent = result.online
      ? "已记录你的反馈，感谢补充。"
      : "已暂存到本机，下次启动后会自动同步。";
  }

  if (elements.aiQuestion) elements.aiQuestion.value = "";
  renderAiChatLog();
}

function archiveCurrentGame(status = "interrupted") {
  const snapshot = currentGameSnapshot(status);
  if (snapshot) archivedGames.push(snapshot);
}

function resetTableState() {
  selectedIds = new Set();
  tablePlays = new Map();
  tableTrickLeaderIndex = null;
  freeWildCardIds = new Set();
  handColumnIds = null;
  clearHint();
}

function clearHint() {
  hintShown = false;
  hintAwaiting = false;
  hintAdvice = null;
  hintCardIds = new Set();
}

/** 将已算好的 advice 应用到提示高亮与顶栏文案 */
function applyHintFromAdvice(advice) {
  if (!advice || !state || state.currentPlayerIndex !== HUMAN_INDEX || isGameOver(state)) return;
  hintAdvice = advice;
  currentAdvice = currentAdvice ?? advice;
  hintShown = true;
  hintAwaiting = false;
  const rec = advice.recommendation;
  hintCardIds = new Set((rec.candidate.cards ?? []).map((card) => cardId(card)));
  const reason = firstReasonForUser(rec.reasons);
  const label = rec.candidate.label || (rec.candidate.type === PLAY_TYPES.pass ? "过牌" : "推荐牌");
  message = `推荐：${label} — ${reason}`;
  advanceOnboarding(2);
  render();
}

function showHint() {
  if (!state || state.currentPlayerIndex !== HUMAN_INDEX || isGameOver(state)) return;
  const ready = currentAdvice ?? hintAdvice;
  if (ready) {
    applyHintFromAdvice(ready);
    return;
  }
  hintAwaiting = true;
  message = "推荐计算中，请稍候…";
  render();
  scheduleHumanAdviceRefresh();
}

function keyPauseFiredSet(meta) {
  return new Set(meta?.keyPauseFired ?? []);
}

function markKeyPauseFired(meta, type) {
  if (!meta) return;
  const fired = meta.keyPauseFired ?? [];
  if (!fired.includes(type)) meta.keyPauseFired = [...fired, type];
}

/** 人类回合开始时检测并展示关键时刻暂停 banner */
function maybeTriggerKeyPause() {
  if (!keyPauseEnabled || !state || !currentGameMeta) return;
  if (state.currentPlayerIndex !== HUMAN_INDEX || isGameOver(state)) {
    keyPauseOverlay = null;
    return;
  }
  const fired = keyPauseFiredSet(currentGameMeta);
  const moment = detectKeyMoment(state, {
    humanIndex: HUMAN_INDEX,
    gameMeta: currentGameMeta,
    keyPauseFired: fired,
  });
  if (!moment) return;
  if (keyPauseOverlay?.type === moment.type) return;
  markKeyPauseFired(currentGameMeta, moment.type);
  keyPauseOverlay = moment;
}

function dismissKeyPause() {
  keyPauseOverlay = null;
  renderKeyPauseBanner();
}

function keyPauseShowHint() {
  dismissKeyPause();
  showHint();
}

/** 人类出牌后检查是否应提醒报牌（教学提示，不阻断出牌） */
function maybeRemindReportCards(handCount) {
  if (!currentGameMeta || handCount <= 0) return;

  if (handCount === 1 && !currentGameMeta.reportOneReminded) {
    currentGameMeta.reportOneReminded = true;
    reportReminderText = "按规则应主动报牌：剩 1 张（一牌必报）";
    return;
  }

  if (handCount <= 10 && !currentGameMeta.reportTenReminded) {
    currentGameMeta.reportTenReminded = true;
    reportReminderText = `按规则应主动报牌：剩 ${handCount} 张`;
  }
}

function adoptHint() {
  if (!state || !hintAdvice) return;
  const advice = hintAdvice;
  clearHint();
  tryPlay(advice.recommendation.candidate.cards, `你采纳推荐：${advice.recommendation.candidate.label || "过牌"}`, {
    advice,
    source: "human-accepted-top",
  });
}

function serializeTablePlays() {
  return [...tablePlays.entries()].map(([playerIndex, play]) => [playerIndex, play]);
}

function buildSessionSnapshot() {
  if (!state) return null;
  const matchSnapshot = matchState
    ? { ...matchState, currentGame: state }
    : null;
  return buildPersistedSession({
    state,
    matchState: matchSnapshot,
    currentGameMeta,
    matchSettledTurnNumber,
    message,
    selectedIds: [...selectedIds],
    tablePlays: serializeTablePlays(),
    tableTrickLeaderIndex,
    freeWildCardIds: [...freeWildCardIds],
    handColumnIds,
    aiChatTimeline,
    levelRankSelect: elements.levelRank?.value ?? state.levelRank,
  });
}

function schedulePersistSession() {
  if (!bootComplete) return;
  clearTimeout(persistSessionTimer);
  persistSessionTimer = setTimeout(() => {
    persistSessionNow();
  }, 500);
}

/** 立即写入存档，避免 debounce 竞态把旧局覆盖新专项局 */
function persistSessionNow() {
  if (!bootComplete) return;
  clearTimeout(persistSessionTimer);
  persistSessionTimer = null;
  const snapshot = buildSessionSnapshot();
  if (snapshot && isSessionPersistable(snapshot)) {
    void savePersistedSessionDual(compactSessionForPersist(snapshot));
  } else if (!snapshot) {
    void clearPersistedSessionDual();
  }
}

function restoreTablePlays(entries = []) {
  tablePlays = new Map();
  for (const [playerIndex, play] of entries) {
    tablePlays.set(Number(playerIndex), play);
  }
}

function legacyCardId(card) {
  if (isJoker(card)) return `${card.rank}#${card.deckIndex}`;
  return `${card.suit}${card.rank}#${card.deckIndex}`;
}

function resolveStoredCardId(hand, storedId) {
  if (!storedId) return null;
  const direct = hand.find((card) => cardId(card) === storedId);
  if (direct) return storedId;

  const legacyMatches = hand.filter((card) => legacyCardId(card) === storedId);
  if (legacyMatches.length === 1) return cardId(legacyMatches[0]);
  return null;
}

function migrateStoredCardIds(hand, ids = []) {
  const next = [];
  const seen = new Set();
  for (const storedId of ids) {
    const resolved = resolveStoredCardId(hand, storedId);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    next.push(resolved);
  }
  return next;
}

function applyRestoredSession(data) {
  cancelAdviceCompute();
  resetActivePlayQueues();
  currentAdvice = null;
  hintAdvice = null;
  hintShown = false;
  hintAwaiting = false;
  state = data.state;
  matchState = data.matchState ?? null;
  if (matchState) {
    state = fixResistTributeStarter(state, matchState);
    matchState.currentGame = state;
  }
  currentGameMeta = data.currentGameMeta ?? null;
  if (currentGameMeta) {
    currentGameMeta.userDisputes = currentGameMeta.userDisputes ?? [];
    currentGameMeta.gameInsights = currentGameMeta.gameInsights ?? [];
    currentGameMeta.reportTenReminded = currentGameMeta.reportTenReminded ?? false;
    currentGameMeta.reportOneReminded = currentGameMeta.reportOneReminded ?? false;
    currentGameMeta.keyPauseFired = currentGameMeta.keyPauseFired ?? [];
    currentGameMeta.divergenceSummaryCache = summarizeGameDivergences(
      currentGameMeta.coachAdviceTimeline ?? [],
      HUMAN_INDEX,
    );
  }
  syncReportReminderFromMeta();
  matchSettledTurnNumber = data.matchSettledTurnNumber ?? null;
  message = data.message ?? "已恢复上次对局，可继续。";
  aiChatTimeline = data.aiChatTimeline ?? currentGameMeta?.aiChatTimeline ?? [];
  if (currentGameMeta) currentGameMeta.aiChatTimeline = aiChatTimeline;
  restoreTablePlays(data.tablePlays ?? []);
  tableTrickLeaderIndex = data.tableTrickLeaderIndex ?? null;

  const humanHand = state.players[HUMAN_INDEX]?.hand ?? [];
  const migratedColumns = (data.handColumnIds ?? []).map((column) => migrateStoredCardIds(humanHand, column));
  const columnCardCount = migratedColumns.flat().length;
  const hasAmbiguousLegacyIds = (data.handColumnIds ?? []).flat().some((storedId) => (
    !storedId.startsWith("JK:")
    && resolveStoredCardId(humanHand, storedId) === null
  ));

  if (hasAmbiguousLegacyIds || columnCardCount !== humanHand.length) {
    handColumnIds = null;
    selectedIds = new Set();
    freeWildCardIds = new Set();
    const arrangedHand = sortHumanCardsForArrangement(humanHand);
    updateHumanHand(arrangedHand);
    resetHandColumns(arrangedHand);
    message = "已恢复对局，并修正了王与 J 的选牌编号冲突，请重新选牌。";
  } else {
    handColumnIds = migratedColumns.filter((column) => column.length > 0);
    selectedIds = new Set(migrateStoredCardIds(humanHand, data.selectedIds ?? []));
    freeWildCardIds = new Set(migrateStoredCardIds(humanHand, data.freeWildCardIds ?? []));
    const cardById = new Map(humanHand.map((card) => [cardId(card), card]));
    const arranged = handColumnIds.flat().map((id) => cardById.get(id)).filter(Boolean);
    updateHumanHand(arranged.length ? arranged : sortHumanCardsForArrangement(humanHand));
  }

  if (elements.levelRank) {
    elements.levelRank.value = data.levelRankSelect ?? state.levelRank;
  }
  return true;
}

const INVALID_SESSION_MESSAGE = "上局存档异常，已为你准备新练习。点「新开一局」开始。";

function resetToCleanWaitingState() {
  resetActivePlayQueues();
  state = null;
  matchState = null;
  currentGameMeta = null;
  matchSettledTurnNumber = null;
  aiChatTimeline = [];
  selectedDivergenceTurn = null;
  keyPauseOverlay = null;
  reportReminderText = null;
  resetTableState();
  message = INVALID_SESSION_MESSAGE;
}

async function tryRestoreSession({ localOnly = false } = {}) {
  const { session: data, source } = localOnly
    ? { session: loadPersistedSession(), source: "local" }
    : await loadPersistedSessionDualWithTimeout(RESTORE_TIMEOUT_MS);
  if (!data) return false;

  const invalid = detectInvalidRestoredSession(data.state, data.currentGameMeta);
  if (invalid.invalid) {
    console.warn("跳过无效存档：", invalid.reason);
    await clearPersistedSessionDual();
    resetToCleanWaitingState();
    return false;
  }

  try {
    applyRestoredSession(compactSessionForPersist(data));
    const via = source === "remote" ? "本机存档" : "浏览器缓存";
    if (matchState) {
      message = matchState.complete
        ? `已从${via}恢复竞技赛（已结束）。可新开竞技或单局练习。`
        : isGameOver(state)
          ? `已从${via}恢复竞技赛第 ${matchState.gameNumber} 局（本局已结束，可点「下一局」）。`
          : `已从${via}恢复竞技赛第 ${matchState.gameNumber} 局，当前打 ${matchState.currentLevelRank}。`;
    } else {
      message = isGameOver(state)
        ? `已从${via}恢复上局（已结束），可新开一局。`
        : `已从${via}恢复上局进度，可继续出牌。`;
    }
    return true;
  } catch (error) {
    console.error("恢复牌局失败", error);
    await clearPersistedSessionDual();
    resetToCleanWaitingState();
    return false;
  }
}

function prepareGame(game, seed, extraMeta = {}) {
  hideDivergenceDetail();
  divergenceVerdictFilter = DIVERGENCE_VERDICTS.COACH_BETTER;
  state = matchState ? fixResistTributeStarter(game, matchState) : game;
  aiChatTimeline = [];
  const arrangedHand = sortHumanCardsForArrangement(state.players[HUMAN_INDEX].hand);
  updateHumanHand(arrangedHand);
  resetHandColumns(arrangedHand);
  currentGameMeta = {
    gameId: extraMeta.gameId ?? `game-${archivedGames.length + 1}`,
    seed,
    startedAt: new Date().toISOString(),
    playerNames: PLAYER_NAMES,
    humanPlayerIndex: HUMAN_INDEX,
    partnerIndex: (HUMAN_INDEX + 2) % PLAYER_NAMES.length,
    ...extraMeta,
    coachAdviceTimeline: [],
    userDisputes: [],
    gameInsights: [],
    fabQaCount: 0,
    gameReviewSubmitted: false,
    reportTenReminded: false,
    reportOneReminded: false,
    keyPauseFired: [],
    aiChatTimeline,
    initialHands: state.players.map((player, index) => ({
      playerIndex: index,
      playerName: PLAYER_NAMES[index],
      cards: player.hand.map(serializeCard),
    })),
  };
  reportReminderText = null;
  keyPauseOverlay = null;
  resetTableState();
}

function syncReportReminderFromMeta() {
  if (!currentGameMeta || !state) {
    reportReminderText = null;
    return;
  }
  const handCount = state.players[HUMAN_INDEX]?.hand?.length ?? 0;
  if (handCount === 1 && currentGameMeta.reportOneReminded) {
    reportReminderText = "按规则应主动报牌：剩 1 张（一牌必报）";
  } else if (handCount <= 10 && handCount > 0 && currentGameMeta.reportTenReminded) {
    reportReminderText = `按规则应主动报牌：剩 ${handCount} 张`;
  } else {
    reportReminderText = null;
  }
}

function teamLabel(teamIndex) {
  return teamIndex === 0 ? "己方" : "对方";
}

function tributeEventLabel(event) {
  if (event.type === "resist-tribute") {
    return `双大王抗贡：${event.players.map((index) => PLAYER_NAMES[index]).join("、")}`;
  }
  return `${PLAYER_NAMES[event.from]}进贡${cardLabel(event.tributeCard)}给${PLAYER_NAMES[event.to]}${event.returnCard ? `，还${cardLabel(event.returnCard)}` : ""}`;
}

function expectedTributeLabel(finishedPlayers) {
  if (!finishedPlayers || finishedPlayers.length < 4) return "";
  const [first, second, third, fourth] = finishedPlayers;
  const firstTeam = first % 2;
  if (second % 2 === firstTeam) {
    return `预计双贡：${PLAYER_NAMES[fourth]}向${PLAYER_NAMES[first]}进贡，${PLAYER_NAMES[third]}向${PLAYER_NAMES[second]}进贡；下一局发牌后再判断是否双大王抗贡。`;
  }
  return `预计单贡：${PLAYER_NAMES[fourth]}向${PLAYER_NAMES[first]}进贡；下一局发牌后再判断是否双大王抗贡。`;
}

function settleCompetitiveGameIfNeeded() {
  if (!matchState || !state || !isGameOver(state) || matchSettledTurnNumber === state.turnNumber) return;
  matchState = finishCompetitiveGame(matchState, state);
  matchSettledTurnNumber = state.turnNumber;
  const latest = matchState.history.at(-1);
  if (matchState.complete) {
    message = `竞技赛结束：${teamLabel(matchState.winnerTeam)}打 A 双上过关。`;
  } else if (latest) {
    message = `${teamLabel(latest.settlement.winningTeam)}本局${latest.settlement.sameTeamSecond ? "双上" : "头游"}，升 ${latest.settlement.upgradeSteps} 级；下一局打 ${matchState.currentLevelRank}。`;
  }
}

function resetActivePlayQueues() {
  autoGameRunning = false;
  robotQueueGeneration += 1;
  cancelRobotQueueTimers();
  robotQueueActive = false;
}

function newGame(extraMeta = {}) {
  clearTimeout(persistSessionTimer);
  persistSessionTimer = null;
  resetActivePlayQueues();
  cancelAdviceCompute();
  currentAdvice = null;
  selectedDivergenceTurn = null;
  keyPauseOverlay = null;

  try {
    hideDivergenceDetail();
    divergenceVerdictFilter = DIVERGENCE_VERDICTS.COACH_BETTER;
    archiveCurrentGame(state && isGameOver(state) ? "complete" : "interrupted");
    aiChatTimeline = [];
    matchState = null;
    matchSettledTurnNumber = null;
    elements.newGame.disabled = true;
    elements.newGame.textContent = "发牌中";
    const drillFocus = extraMeta.drillFocus ?? null;
    const startedAt = new Date().toISOString();
    let seed = Date.now() % 2147483647;
    let drillScenario = null;

    if (drillFocus) {
      const rigged = createDrillRiggedState(drillFocus);
      state = rigged.state;
      seed = rigged.seed;
      drillScenario = rigged.scenario;
      elements.levelRank.value = rigged.levelRank;
    } else {
      state = createInitialGameState({
        levelRank: elements.levelRank.value,
        random: seededRandom(seed),
      });
    }

    freeWildCardIds = new Set();
    const arrangedHand = sortHumanCardsForArrangement(state.players[HUMAN_INDEX].hand);
    updateHumanHand(arrangedHand);
    resetHandColumns(arrangedHand);
    const baseMeta = {
      gameId: `game-${archivedGames.length + 1}`,
      seed,
      startedAt,
      playerNames: PLAYER_NAMES,
      humanPlayerIndex: HUMAN_INDEX,
      partnerIndex: (HUMAN_INDEX + 2) % PLAYER_NAMES.length,
      aiChatTimeline,
      initialHands: state.players.map((player, index) => ({
        playerIndex: index,
        playerName: PLAYER_NAMES[index],
        cards: player.hand.map(serializeCard),
      })),
    };
    currentGameMeta = drillFocus
      ? buildDrillPracticeGameMeta(baseMeta, drillFocus, drillScenario)
      : {
        ...baseMeta,
        drillFocus: null,
        drillFocusStartedAt: null,
        drillScenarioId: null,
        drillScenarioTitle: null,
        coachAdviceTimeline: [],
        reportTenReminded: false,
        reportOneReminded: false,
        keyPauseFired: [],
        gameReviewSubmitted: false,
      };
    reportReminderText = null;
    resetTableState();
    const scenarioLine = drillFocus ? getDrillScenarioSummary(drillFocus) : null;
    message = drillFocus
      ? (scenarioLine
        ? `专项练习（预设局面）：${scenarioLine} 轮到你时点「提示」。`
        : `专项练习：本局重点练「${drillFocus}」。轮到你时点「提示」看推荐。`)
      : "新局已发牌。轮到你时点「提示」看推荐，再点「采纳」或再点「提示」出牌。";
    advanceOnboarding(1);
  } catch (error) {
    console.error(error);
    message = `发牌失败：${error.message}`;
  } finally {
    elements.newGame.textContent = "新开一局";
    elements.newGame.disabled = false;
    clearSafeBootMode();
    render({ immediate: true, lite: true });
    scheduleDeferredPanelsRender();
    if (state && !isGameOver(state)) {
      if (state.currentPlayerIndex === HUMAN_INDEX) {
        scheduleHumanAdviceRefresh();
      } else {
        queueRobotTurns();
      }
    }
    persistSessionNow();
  }
}

function newCompetitiveMatch() {
  archiveCurrentGame(state && isGameOver(state) ? "complete" : "interrupted");
  const seed = Date.now() % 2147483647;
  matchState = createCompetitiveMatch({
    random: seededRandom(seed),
    startingRank: "2",
  });
  matchSettledTurnNumber = null;
  elements.levelRank.value = matchState.currentLevelRank;
  prepareGame(matchState.currentGame, seed, {
    gameId: `match-${matchState.gameNumber}`,
    matchGameNumber: matchState.gameNumber,
    matchLevels: matchState.levels,
  });
  message = "竞技赛已开始：从 2 打起。本局结束后会结算升级，再进入进贡还贡。";
  render();
}

function needsSubmitReminder() {
  return Boolean(
    state
    && isGameOver(state)
    && currentGameMeta
    && !currentGameMeta.gameReviewSubmitted
    && (currentGameMeta.coachAdviceTimeline ?? []).some(
      (record) => isHumanReplayRecord(record, HUMAN_INDEX),
    ),
  );
}

/** 局末自动保存复盘并写入 COACH-FIX-REQUEST，无需用户点按钮或聊天确认 */
let autoGameReviewTimer = null;

function scheduleAutoGameReview() {
  if (!needsSubmitReminder()) return;
  if (autoGameReviewTimer !== null) return;
  autoGameReviewTimer = window.setTimeout(() => {
    autoGameReviewTimer = null;
    void submitGameReview();
  }, 600);
}

function onGameOverDetected() {
  scheduleAutoGameReview();
}

function verdictBadgeHtml(verdict, label) {
  const cls = verdict === "user-better"
    ? "verdict-user"
    : verdict === "coach-better"
      ? "verdict-coach"
      : "verdict-style";
  return `<span class="verdict-badge ${cls}">${escapeHtml(label)}</span>`;
}

function formatVerdictStats(summary, { interactive = false, activeFilter = null } = {}) {
  if (!summary.divergenceCount) return "";
  const tabs = [
    { verdict: DIVERGENCE_VERDICTS.USER_BETTER, label: "你更对", count: summary.userBetterCount ?? 0 },
    { verdict: DIVERGENCE_VERDICTS.COACH_BETTER, label: "教练更对", count: summary.coachBetterCount ?? 0 },
    { verdict: DIVERGENCE_VERDICTS.COACH_QUESTIONABLE, label: "教练不合理", count: summary.coachQuestionableCount ?? 0 },
    { verdict: DIVERGENCE_VERDICTS.STYLE, label: "风格差异", count: summary.styleCount ?? 0 },
  ];
  const items = tabs.map(({ verdict, label, count }) => {
    const active = interactive && activeFilter === verdict ? " verdict-stat--active" : "";
    if (!interactive) {
      return `<span class="verdict-stat">${label} ${count}</span>`;
    }
    return `<button type="button" class="verdict-stat${active}" data-verdict="${verdict}" aria-pressed="${activeFilter === verdict}">${label} ${count}</button>`;
  }).join("");
  return `<div class="verdict-stats" role="${interactive ? "tablist" : "group"}">${items}</div>`;
}

function divergencesByVerdict(summary, verdict = divergenceVerdictFilter) {
  return summary.divergences.filter((item) => item.verdict === verdict);
}

function renderDivergenceListHtml(items) {
  if (items.length === 0) {
    return "<p class=\"muted\">该分类暂无与推荐不同的出牌。</p>";
  }
  let html = "<ul class=\"divergence-list\">";
  for (const item of items) {
    const disputed = findUserDispute(item.turnNumber);
    const disputeBtn = canDisputeVerdict(item.verdict)
      ? (disputed
        ? "<span class=\"dispute-recorded\">已记录</span>"
        : `<button type="button" class="dispute-btn" data-dispute-turn="${item.turnNumber}">我有异议</button>`)
      : "";
    html += `<li class="divergence-item" data-hand-index="${item.turnNumber}" role="button" tabindex="0" title="点击查看推荐对比">`
      + `${verdictBadgeHtml(item.verdict, item.verdictLabel)}第${item.turnNumber}手：`
      + `${escapeHtml(item.recommended)} → ${escapeHtml(item.actual)}`
      + `${item.verdictNote ? `<br><span class="muted">${escapeHtml(item.verdictNote)}</span>` : ""}`
      + `${disputeBtn ? `<span class="divergence-dispute-inline">${disputeBtn}</span>` : ""}</li>`;
  }
  html += "</ul>";
  return html;
}

async function submitUserDisputeFromUI(turnNumber) {
  if (!currentGameMeta || !state) return;
  const textarea = document.querySelector(`#dispute-rationale-${turnNumber}`);
  const rationale = textarea?.value?.trim() ?? "";
  if (!rationale) {
    message = "请先写一句说明。";
    render({ immediate: true });
    return;
  }
  if (findUserDispute(turnNumber)) {
    message = "这手已经记录过意见了。";
    render({ immediate: true });
    return;
  }
  const divItem = divergenceItemForTurn(turnNumber);
  const dispute = normalizeUserDispute({
    turnNumber,
    originalAdjudication: divItem?.verdictLabel ?? divItem?.adjudication ?? "unknown",
    verdict: divItem?.verdict ?? null,
    verdictLabel: divItem?.verdictLabel ?? null,
    userRationale: rationale,
    gameId: currentGameMeta.gameId,
  });
  if (!dispute) return;

  if (!currentGameMeta.userDisputes) currentGameMeta.userDisputes = [];
  currentGameMeta.userDisputes.push(dispute);

  const submitBtn = document.querySelector(`.dispute-submit-btn[data-dispute-turn="${turnNumber}"]`);
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "提交中…";
  }

  try {
    const result = await submitUserDispute({
      ...dispute,
      gameId: currentGameMeta.gameId,
      feedbackId: currentGameMeta.gameId,
      gameReviewFeedbackId: currentGameMeta.gameReviewFeedbackId ?? null,
      levelRank: state.levelRank,
    });
    const ackText = result.ackMessage ?? buildDisputeAckMessage(dispute);
    showCoachToast(ackText);
    const ackEl = document.querySelector(`#dispute-rationale-${turnNumber}`)
      ?.closest(".divergence-dispute")
      ?.querySelector(".dispute-ack");
    if (ackEl) {
      ackEl.textContent = ackText;
      ackEl.hidden = false;
    }
  } catch (error) {
    console.warn("异议暂存本机", error);
    const ackText = buildDisputeAckMessage(dispute);
    showCoachToast(ackText);
  }

  renderGameReviewPanel();
  showDivergenceDetail(turnNumber);
}

function openSubmitReminderDialog(nextAction) {
  const summary = currentDivergenceSummary();
  pendingAfterSubmitAction = nextAction;
  if (elements.submitReminderText) {
    elements.submitReminderText.textContent = summary.divergenceCount > 0
      ? `本局共 ${summary.totalHands} 手，有 ${summary.divergenceCount} 处与推荐不同。记录这局复盘？这样下次可以对比进步。`
      : "记录这局复盘？这样下次可以对比进步。";
  }
  elements.submitReminderDialog?.showModal();
}

function closeSubmitReminderDialog() {
  elements.submitReminderDialog?.close();
  pendingAfterSubmitAction = null;
}

function proceedNextCompetitiveGame() {
  if (!matchState || matchState.complete || !state || !isGameOver(state)) return;
  settleCompetitiveGameIfNeeded();
  const seed = Date.now() % 2147483647;
  matchState = startNextCompetitiveGame(matchState, { random: seededRandom(seed) });
  matchSettledTurnNumber = null;
  elements.levelRank.value = matchState.currentLevelRank;
  prepareGame(matchState.currentGame, seed, {
    gameId: `match-${matchState.gameNumber}`,
    matchGameNumber: matchState.gameNumber,
    matchLevels: matchState.levels,
    tributeEvents: matchState.pendingTributeEvents,
  });
  const tributeText = matchState.pendingTributeEvents.length > 0
    ? matchState.pendingTributeEvents.map(tributeEventLabel).join("；")
    : "本局无进贡。";
  message = `第 ${matchState.gameNumber} 局开始，当前打 ${matchState.currentLevelRank}。${tributeText}`;
  render();
  queueRobotTurns();
}

async function nextCompetitiveGame() {
  if (!matchState || matchState.complete || !state || !isGameOver(state)) return;
  if (needsSubmitReminder()) {
    await submitGameReview();
  }
  proceedNextCompetitiveGame();
}

async function submitAndContinueNext() {
  const action = pendingAfterSubmitAction;
  closeSubmitReminderDialog();
  await submitGameReview();
  if (action === "next" && currentGameMeta?.gameReviewSubmitted) {
    proceedNextCompetitiveGame();
  }
}

function skipSubmitAndContinueNext() {
  const action = pendingAfterSubmitAction;
  closeSubmitReminderDialog();
  message = "已跳过保存复盘，本局差异未记录。";
  if (action === "next") proceedNextCompetitiveGame();
  else render();
}

function exportLog() {
  const games = [...archivedGames];
  const currentSnapshot = currentGameSnapshot();
  if (currentSnapshot) games.push(currentSnapshot);
  if (games.length === 0) {
    message = "还没有可导出的对局。先新开一局并打一会儿，再点导出记录。";
    settleCompetitiveGameIfNeeded();
    render();
    return;
  }
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    note: "请把这个文件发给我，我会按高手真实出牌节奏分析并调整策略。",
    currentPosition: currentSnapshot,
    games,
  };
  const text = JSON.stringify(payload, null, 2);
  elements.exportOutput.value = text;
  elements.exportPanel.hidden = false;

  try {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `guandan-expert-games-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    message = `已生成 ${games.length} 局记录；如果没有自动下载，可以复制右侧记录文本发给我。`;
  } catch {
    message = `已生成 ${games.length} 局记录；请复制右侧记录文本发给我。`;
  }
  render();
}

async function copyExportLog() {
  const text = elements.exportOutput.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    message = "记录文本已复制。";
  } catch {
    elements.exportOutput.select();
    message = "已选中记录文本，可以手动复制。";
  }
  render();
}

function trainingSamplePayload(note = "") {
  const games = [...archivedGames];
  const currentSnapshot = currentGameSnapshot("training-sample");
  if (currentSnapshot) games.push(currentSnapshot);
  return {
    version: 3,
    sampleId: `training-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    exportedAt: new Date().toISOString(),
    purpose: "coach-training-feedback",
    note: note || "真实打牌训练样本：包含教练推荐、实际出牌、理牌列、问教练记录和复盘视角。",
    matchLevels: matchState?.levels ?? null,
    matchGameNumber: matchState?.gameNumber ?? null,
    currentPosition: currentSnapshot,
    games,
  };
}

let aiBridgeOnline = null;

async function pushCoachFeedbackForQuestion(question, record = null) {
  if (!state || !currentGameMeta) {
    return { ok: false, reason: "no-active-game" };
  }
  const context = buildAiCoachContext(question);
  const payload = buildFeedbackFromSession({
    question,
    context,
    record,
    currentPosition: currentGameSnapshot("coach-feedback"),
    matchLevels: matchState?.levels ?? null,
    matchGameNumber: matchState?.gameNumber ?? null,
  });
  const result = await submitCoachFeedback(payload);
  if (result.online) feedbackSubmitCount += 1;
  return result;
}


async function probeAiBridgeStatus() {
  if (!elements.aiStatus) return;
  try {
    const response = await fetch("http://127.0.0.1:8787/training-sample", { method: "OPTIONS" });
    aiBridgeOnline = response.ok || response.status === 204;
    if (aiBridgeOnline) {
      const flush = await flushFeedbackQueue();
      if (flush.flushed > 0) {
        feedbackSubmitCount += flush.flushed;
        message = `已同步 ${flush.flushed} 条反馈。`;
        render();
      }
    }
    if (aiBridgeOnline) {
      elements.aiStatus.textContent = "专注打牌即可，局末会自动记录复盘。";
    }
  } catch {
    aiBridgeOnline = false;
    elements.aiStatus.textContent = "请用「点我启动掼蛋教练Pro.cmd」启动游戏；刷新后会自动恢复对局进度。";
  }
}

async function importExternalReplayFiles(fileList) {
  const files = [...fileList];
  if (files.length === 0) {
    message = "请先选择 OpenGuanDan / 旧平台 WebSocket 日志（可多选四路）。";
    render();
    return;
  }

  const streams = await Promise.all(files.map((file) => file.text().then((text) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length > 1 && file.name.endsWith(".jsonl")) {
      return lines.map((line) => JSON.parse(line));
    }
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : data.messages ?? [data];
  })));

  const entries = [];
  const seenKeys = new Set();
  for (const [fileIndex, list] of streams.entries()) {
    list.forEach((msg, lineIndex) => {
      const key = dedupeKey(msg);
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      entries.push({
        msg,
        ts: messageTimestamp(msg, fileIndex * 100000 + lineIndex),
        fileIndex,
        lineIndex,
      });
    });
  }
  entries.sort((a, b) => a.ts - b.ts || a.fileIndex - b.fileIndex || a.lineIndex - b.lineIndex);
  const messages = entries.map((entry) => entry.msg);

  const format = detectOpenGuanDanLog(messages) ? "opengdan" : detectLegacyGdWs(messages) ? "legacy-gd-ws" : null;
  if (!format) {
    message = "无法识别日志格式。";
    render();
    return;
  }

  const game = format === "opengdan"
    ? opengdanMessagesToGame(messages, { gameId: `browser-import-${Date.now()}` })
    : legacyGdMessagesToGame(messages, { gameId: `browser-import-${Date.now()}` });

  if (game?.error) {
    message = `导入失败：${game.error}`;
    render();
    return;
  }

  const bundle = {
    version: 3,
    sampleId: `import-${Date.now()}`,
    exportedAt: new Date().toISOString(),
    purpose: "external-replay-import",
    note: `浏览器导入 ${files.length} 个日志文件`,
    sourceFormat: format,
    games: [game],
    currentPosition: game,
  };

  const text = JSON.stringify(bundle, null, 2);
  if (elements.exportOutput) elements.exportOutput.value = text;
  if (elements.exportPanel) elements.exportPanel.hidden = false;
  message = `已导入 ${format} 牌局（${game.importStats?.timelineRecords ?? 0} 手）。JSON 已写入导出区，可另存后运行 node tools/replay-to-rows.mjs`;
  render();
}

async function saveTrainingSample() {
  const payload = trainingSamplePayload();
  if (!payload.currentPosition && payload.games.length === 0) {
    message = "还没有可保存的训练样本。先打一局或打到有争议的地方再保存。";
    render();
    return;
  }

  const text = JSON.stringify(payload, null, 2);
  try {
    const response = await fetch("http://127.0.0.1:8787/training-sample", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: text,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `save failed: ${response.status}`);
    message = "样本已保存。";
    aiBridgeOnline = true;
  } catch (error) {
    elements.exportOutput.value = text;
    elements.exportPanel.hidden = false;
    message = "请先运行「点我启动掼蛋教练Pro.cmd」再保存样本；已把内容放到导出区。";
  }
  render();
}

function cardClass(card) {
  const classes = ["card"];
  if (card.suit === "H" || card.suit === "D") classes.push("red");
  if (card.suit === "JOKER") classes.push("joker");
  return classes.join(" ");
}

function renderCard(card, {
  selectable = false,
  reorderable = false,
  columnIndex = null,
  cardIndex = null,
} = {}) {
  const node = document.createElement(selectable ? "button" : "div");
  node.className = cardClass(card);
  node.type = selectable ? "button" : undefined;
  node.dataset.cardId = cardId(card);
  node.dataset.cardId = cardId(card);
  if (selectedIds.has(cardId(card))) node.classList.add("selected");
  if (hintCardIds.has(cardId(card))) node.classList.add("hint-recommended");
  const label = cardLabel(card);
  const isJoker = card.rank === "SJ" || card.rank === "BJ";
  const suitLabel = isJoker ? label : SUIT_LABELS[card.suit] ?? card.suit;
  const suitSymbol = isJoker ? (card.rank === "SJ" ? "小" : "大") : SUIT_SYMBOLS[card.suit] ?? "";
  const rankLabel = isJoker ? "王" : card.rank;
  const rankClass = rankLabel.length > 1 ? "rank wide" : "rank";
  const isLevelCard = state && card.rank === state.levelRank;
  node.innerHTML = `
    <span class="corner top"><span class="${rankClass}">${rankLabel}</span></span>
    <span class="suit-mark">${suitSymbol}</span>
    <span class="suit">${suitSymbol}</span>
    <span class="card-name">${suitLabel}</span>
    ${isLevelCard ? `<span class="level-badge">级</span>` : ""}
  `;
  if (reorderable) {
    node.title = cardLabel(card);
    node.draggable = true;
    node.addEventListener("dragstart", (event) => {
      draggedCardId = cardId(card);
      const column = columnIndex === null ? [] : ensureHandColumns()[columnIndex] ?? [];
      draggedColumnIds = column.length > 1 && column.every((id) => selectedIds.has(id)) ? [...column] : null;
      suppressCardClick = false;
      node.classList.add("dragging");
      if (draggedColumnIds) node.closest(".hand-column")?.classList.add("dragging-column");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedCardId);
      if (draggedColumnIds) event.dataTransfer.setData("application/x-guandan-column", JSON.stringify(draggedColumnIds));
    });
    node.addEventListener("dragend", () => {
      draggedCardId = null;
      draggedColumnIds = null;
      node.classList.remove("dragging");
      node.closest(".hand-column")?.classList.remove("dragging-column");
      window.setTimeout(() => {
        suppressCardClick = false;
      }, 0);
    });
    node.addEventListener("dragover", (event) => {
      if (!draggedCardId || draggedCardId === cardId(card)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    node.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const sourceId = event.dataTransfer.getData("text/plain") || draggedCardId;
      if (sourceId === cardId(card)) return;
      moveDragPayloadToColumn(event, sourceId, columnIndex);
    });
  }
  if (selectable) {
    node.title = cardLabel(card);
    node.addEventListener("click", (event) => {
      if (suppressCardClick) return;
      const id = cardId(card);
      const canSelectColumn = reorderable
        && columnIndex !== null
        && !event.ctrlKey
        && !event.metaKey
        && !event.shiftKey
        && !event.altKey;
      if (pendingCardClickTimer) {
        window.clearTimeout(pendingCardClickTimer);
        pendingCardClickTimer = null;
        pendingCardClickAction = null;
      }
      if (canSelectColumn && event.detail >= 2) {
        toggleHandColumnSelection(columnIndex);
        removeAccidentalJokerFromStraightFlush();
        render();
        return;
      }
      pendingCardClickAction = () => {
        if (selectedIds.has(id)) selectedIds.delete(id);
        else selectedIds.add(id);
        removeAccidentalJokerFromStraightFlush();
      };
      pendingCardClickTimer = window.setTimeout(() => {
        pendingCardClickTimer = null;
        pendingCardClickAction?.();
        pendingCardClickAction = null;
        render();
      }, canSelectColumn ? 320 : 0);
    });
  }
  return node;
}

function updateHumanHand(nextHand) {
  state = {
    ...state,
    players: state.players.map((player, index) => (
      index === HUMAN_INDEX ? { ...player, hand: nextHand } : player
    )),
  };
}

function compareCardsInColumn(leftCard, rightCard) {
  const leftSuitIndex = SUIT_COLUMN_ORDER.get(leftCard.suit) ?? 99;
  const rightSuitIndex = SUIT_COLUMN_ORDER.get(rightCard.suit) ?? 99;
  if (leftSuitIndex !== rightSuitIndex) return leftSuitIndex - rightSuitIndex;
  const leftRankIndex = ARRANGEMENT_RANKS.indexOf(leftCard.rank);
  const rightRankIndex = ARRANGEMENT_RANKS.indexOf(rightCard.rank);
  if (leftRankIndex !== rightRankIndex) return leftRankIndex - rightRankIndex;
  return leftCard.deckIndex - rightCard.deckIndex;
}

function sequenceWindowForColumn(cards) {
  const ranks = [...new Set(cards.map((card) => card.rank))];
  if (ranks.length < 2 || ranks.some((rank) => rank === "SJ" || rank === "BJ")) return null;
  const rankKey = (items) => [...items].sort().join("|");
  const targetKey = rankKey(ranks);
  for (let start = 0; start + ranks.length <= COLUMN_SEQUENCE_RANKS.length; start += 1) {
    const window = COLUMN_SEQUENCE_RANKS.slice(start, start + ranks.length);
    if (rankKey(window) === targetKey) return window;
  }
  return null;
}

function compareCardsInSequenceColumn(leftCard, rightCard, sequence) {
  const leftRankIndex = sequence.indexOf(leftCard.rank);
  const rightRankIndex = sequence.indexOf(rightCard.rank);
  if (leftRankIndex !== rightRankIndex) return leftRankIndex - rightRankIndex;
  const leftSuitIndex = SUIT_COLUMN_ORDER.get(leftCard.suit) ?? 99;
  const rightSuitIndex = SUIT_COLUMN_ORDER.get(rightCard.suit) ?? 99;
  if (leftSuitIndex !== rightSuitIndex) return leftSuitIndex - rightSuitIndex;
  return leftCard.deckIndex - rightCard.deckIndex;
}

function toggleHandColumnSelection(columnIndex) {
  const column = ensureHandColumns()[columnIndex] ?? [];
  if (column.length === 0) return;
  const allSelected = column.every((id) => selectedIds.has(id));
  if (allSelected) {
    for (const id of column) selectedIds.delete(id);
    return;
  }
  for (const id of column) selectedIds.add(id);
}

function sortColumnIds(column, cardById) {
  const cards = column.map((id) => cardById.get(id)).filter(Boolean);
  const sequence = sequenceWindowForColumn(cards);
  return [...column].sort((leftId, rightId) => {
    const leftCard = cardById.get(leftId);
    const rightCard = cardById.get(rightId);
    if (!leftCard || !rightCard) return 0;
    if (sequence) return compareCardsInSequenceColumn(leftCard, rightCard, sequence);
    return compareCardsInColumn(leftCard, rightCard);
  });
}

function splitMixedJokerColumn(column, cardById) {
  const normalIds = [];
  const jokerIds = [];
  for (const id of column) {
    const card = cardById.get(id);
    if (card && isJoker(card)) jokerIds.push(id);
    else normalIds.push(id);
  }
  if (normalIds.length === 0 || jokerIds.length === 0) return [column];
  return [normalIds, ...jokerIds.map((id) => [id])];
}

function normalizeHandColumns(columns, cardById) {
  return cleanupColumns(columns)
    .flatMap((column) => splitMixedJokerColumn(column, cardById))
    .map((column) => sortColumnIds(column, cardById));
}

function columnsFromCards(cards) {
  const strategicColumns = strategicHandColumns(cards);
  if (strategicColumns.length > 0) return strategicColumns;

  const columns = [];
  const cardById = new Map(cards.map((card) => [cardId(card), card]));
  for (const column of groupedHandColumns(cards)) {
    let currentColumn = [];
    let currentRank = null;
    for (const card of column.cards) {
      const rank = card.rank;
      const isJokerRank = rank === "SJ" || rank === "BJ";
      const currentIsJokerRank = currentRank === "SJ" || currentRank === "BJ";
      if ((isJokerRank || currentIsJokerRank) && currentRank !== rank) {
        if (currentColumn.length > 0) columns.push(currentColumn);
        currentColumn = [cardId(card)];
        currentRank = rank;
        continue;
      }
      if (currentRank !== null && currentRank !== rank) {
        columns.push(currentColumn);
        currentColumn = [cardId(card)];
        currentRank = rank;
        continue;
      }
      currentColumn.push(cardId(card));
      currentRank = rank;
    }
    if (currentColumn.length > 0) columns.push(currentColumn);
  }
  return arrangeLooseSinglesRight(normalizeHandColumns(columns, cardById).reverse(), cardById);
}

function groupCardsByRank(cards) {
  const groups = new Map();
  for (const card of cards) {
    if (!groups.has(card.rank)) groups.set(card.rank, []);
    groups.get(card.rank).push(card);
  }
  return groups;
}

function groupCardsBySuit(cards) {
  const groups = new Map();
  for (const card of cards) {
    if (card.suit === "JOKER") continue;
    if (!groups.has(card.suit)) groups.set(card.suit, []);
    groups.get(card.suit).push(card);
  }
  return groups;
}

function cardIdList(cards) {
  return cards.map(cardId);
}

function removeUsedCards(pool, usedIds) {
  return pool.filter((card) => !usedIds.has(cardId(card)));
}

function rankIndex(rank) {
  return ARRANGEMENT_RANKS.indexOf(rank);
}

function compareCardsByRankThenSuit(left, right) {
  const rankDiff = rankIndex(left.rank) - rankIndex(right.rank);
  if (rankDiff !== 0) return rankDiff;
  return compareCardsInColumn(left, right);
}

function compareLooseSingleCards(left, right) {
  const levelRank = state?.levelRank ?? elements.levelRank.value;
  const rankDiff = rankPower(left.rank, levelRank) - rankPower(right.rank, levelRank);
  if (rankDiff !== 0) return rankDiff;
  return compareCardsInColumn(left, right);
}

function arrangeLooseSinglesRight(columns, cardById) {
  const groupedColumns = [];
  const singleColumns = [];
  const jokerColumns = [];
  for (const column of columns) {
    const card = column.length === 1 ? cardById.get(column[0]) : null;
    if (!card) {
      groupedColumns.push(column);
    } else if (isJoker(card)) {
      jokerColumns.push(column);
    } else {
      singleColumns.push(column);
    }
  }
  singleColumns.sort((left, right) => compareLooseSingleCards(cardById.get(left[0]), cardById.get(right[0])));
  jokerColumns.sort((left, right) => compareLooseSingleCards(cardById.get(left[0]), cardById.get(right[0])));
  return [...groupedColumns, ...singleColumns, ...jokerColumns];
}

function pushWildBombColumns(columns, cards, usedIds) {
  if (!state) return;
  const levelRank = state.levelRank;
  const wildCards = cards.filter((card) => isWildCard(card, levelRank) && !usedIds.has(cardId(card)));
  if (wildCards.length === 0) return;

  const naturalsByRank = groupCardsByRank(
    cards.filter((card) => !isJoker(card) && !isWildCard(card, levelRank)),
  );
  const ranks = [...naturalsByRank.keys()]
    .filter((rank) => rank !== "SJ" && rank !== "BJ")
    .sort((left, right) => rankIndex(left) - rankIndex(right));

  for (const rank of ranks) {
    const naturals = (naturalsByRank.get(rank) ?? []).filter((card) => !usedIds.has(cardId(card)));
    if (naturals.length !== 3) continue;
    for (const wild of wildCards) {
      if (usedIds.has(cardId(wild))) continue;
      const play = classifyPlay([...naturals, wild], levelRank);
      if (play.type !== PLAY_TYPES.bomb) continue;
      for (const card of [...naturals, wild]) usedIds.add(cardId(card));
      columns.push(cardIdList([...naturals, wild]));
      return;
    }
  }
}

function pushRankColumns(columns, ranks, groups, usedIds, takeCount = null) {
  for (const rank of ranks) {
    const available = (groups.get(rank) ?? []).filter((card) => !usedIds.has(cardId(card)));
    if (available.length === 0) continue;
    const picked = takeCount === null ? available : available.slice(0, takeCount);
    for (const card of picked) usedIds.add(cardId(card));
    columns.push(cardIdList(picked));
  }
}

function strategicHandColumns(cards) {
  if (!state || cards.length === 0) return [];
  const cardById = new Map(cards.map((card) => [cardId(card), card]));
  const columns = [];
  const usedIds = new Set();

  for (const straightFlush of findNonOverlappingStraightFlushes(cards, state.levelRank)) {
    const sortedStraightFlush = sortStraightFlushCards(straightFlush);
    for (const card of sortedStraightFlush) usedIds.add(cardId(card));
    columns.push(cardIdList(sortedStraightFlush));
  }

  let remaining = removeUsedCards(cards, usedIds);
  let groups = groupCardsByRank(remaining);
  const bombRanks = [...groups.entries()]
    .filter(([, group]) => group.length >= 4)
    .sort((left, right) => rankIndex(left[0]) - rankIndex(right[0]))
    .map(([rank]) => rank);
  pushRankColumns(columns, bombRanks, groups, usedIds);

  remaining = removeUsedCards(cards, usedIds);
  const tempoColumnTypes = [PLAY_TYPES.plane, PLAY_TYPES.consecutivePairs, PLAY_TYPES.straight];
  for (const tempoType of tempoColumnTypes) {
    for (const group of buildStrategicGroups(remaining, state.levelRank, { skipStraightFlush: true })) {
      if (group.play.type !== tempoType) continue;
      const ids = group.cards.map((card) => cardId(card));
      if (ids.some((id) => usedIds.has(id))) continue;
      for (const id of ids) usedIds.add(id);
      columns.push(ids);
    }
    remaining = removeUsedCards(cards, usedIds);
  }

  remaining = removeUsedCards(cards, usedIds);
  pushWildBombColumns(columns, cards, usedIds);

  groups = groupCardsByRank(removeUsedCards(cards, usedIds));
  const tripleRanks = [...groups.entries()]
    .filter(([, group]) => group.length === 3)
    .map(([rank]) => rank)
    .sort((left, right) => rankIndex(left) - rankIndex(right));
  const pairRanks = [...groups.entries()]
    .filter(([, group]) => group.length === 2)
    .map(([rank]) => rank)
    .sort((left, right) => rankIndex(left) - rankIndex(right));

  const remainingPairRanks = [...pairRanks];
  for (const tripleRank of tripleRanks) {
    pushRankColumns(columns, [tripleRank], groups, usedIds);
    const pairRank = remainingPairRanks.shift();
    if (pairRank) pushRankColumns(columns, [pairRank], groups, usedIds);
  }
  pushRankColumns(columns, remainingPairRanks, groups, usedIds);

  remaining = removeUsedCards(cards, usedIds);
  const singles = remaining
    .filter((card) => card.rank !== "SJ" && card.rank !== "BJ")
    .sort(compareCardsByRankThenSuit);
  for (const card of singles) {
    usedIds.add(cardId(card));
    columns.push([cardId(card)]);
  }

  const jokers = removeUsedCards(cards, usedIds)
    .sort((left, right) => rankIndex(left.rank) - rankIndex(right.rank) || left.deckIndex - right.deckIndex);
  for (const card of jokers) columns.push([cardId(card)]);

  return arrangeLooseSinglesRight(normalizeHandColumns(columns, cardById), cardById);
}

function resetHandColumns(hand = state?.players[HUMAN_INDEX].hand ?? []) {
  handColumnIds = columnsFromCards(hand);
}

function cleanupColumns(columns) {
  return columns.filter((column) => column.length > 0);
}

function findColumnPosition(columns, id) {
  for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
    const cardIndex = columns[columnIndex].indexOf(id);
    if (cardIndex !== -1) return { columnIndex, cardIndex };
  }
  return null;
}

function ensureHandColumns() {
  if (!state) return [];
  const hand = state.players[HUMAN_INDEX].hand;
  const cardById = new Map(hand.map((card) => [cardId(card), card]));
  const handIds = new Set(hand.map(cardId));
  const seenIds = new Set();

  if (!handColumnIds) handColumnIds = columnsFromCards(hand);

  const normalizedColumns = [];
  for (const column of handColumnIds) {
    const normalizedColumn = [];
    for (const id of column) {
      if (!handIds.has(id) || seenIds.has(id)) continue;
      normalizedColumn.push(id);
      seenIds.add(id);
    }
    if (normalizedColumn.length > 0) normalizedColumns.push(normalizedColumn);
  }

  const missingCards = hand.filter((card) => !seenIds.has(cardId(card)));
  for (const column of columnsFromCards(missingCards)) {
    normalizedColumns.push(column);
  }

  handColumnIds = normalizeHandColumns(normalizedColumns, cardById);
  return handColumnIds;
}

function applyHandColumns(columns, movedId = null) {
  if (!state) return;
  const cardById = new Map(state.players[HUMAN_INDEX].hand.map((card) => [cardId(card), card]));
  handColumnIds = normalizeHandColumns(columns, cardById);
  const nextHand = handColumnIds.flat().map((id) => cardById.get(id)).filter(Boolean);
  if (movedId) {
    const movedCard = cardById.get(movedId);
    if (movedCard && isWildCard(movedCard, state.levelRank)) freeWildCardIds.add(movedId);
  }
  updateHumanHand(nextHand);
  suppressCardClick = true;
  const movedCard = movedId ? cardById.get(movedId) : null;
  message = movedCard && isWildCard(movedCard, state.levelRank)
    ? "红桃级牌已按你的手动位置摆放，不会自动吸回组合。"
    : "已手动理牌。拖到列中会竖着叠，拖到列边会新建竖列。";
  render();
}

function moveCardInsideColumn(sourceId, targetId, placeAfter = false) {
  if (!state || sourceId === targetId) return;
  const columns = ensureHandColumns().map((column) => [...column]);
  const source = findColumnPosition(columns, sourceId);
  if (!source) return;

  columns[source.columnIndex].splice(source.cardIndex, 1);
  const cleanedColumns = cleanupColumns(columns);
  const target = findColumnPosition(cleanedColumns, targetId);
  if (!target) return;
  cleanedColumns[target.columnIndex].splice(target.cardIndex + (placeAfter ? 1 : 0), 0, sourceId);
  applyHandColumns(cleanedColumns, sourceId);
}

function moveCardToNewColumnNear(sourceId, targetId, side) {
  if (!state || sourceId === targetId) return;
  const columns = ensureHandColumns().map((column) => [...column]);
  const source = findColumnPosition(columns, sourceId);
  if (!source) return;

  columns[source.columnIndex].splice(source.cardIndex, 1);
  const cleanedColumns = cleanupColumns(columns);
  const target = findColumnPosition(cleanedColumns, targetId);
  if (!target) return;
  cleanedColumns.splice(target.columnIndex + (side === "after" ? 1 : 0), 0, [sourceId]);
  applyHandColumns(cleanedColumns, sourceId);
}

function moveCardToColumnEnd(sourceId, targetColumnIndex) {
  if (!state) return;
  const columns = ensureHandColumns().map((column) => [...column]);
  const source = findColumnPosition(columns, sourceId);
  if (!source) return;

  columns[source.columnIndex].splice(source.cardIndex, 1);
  const cleanedColumns = cleanupColumns(columns);
  if (cleanedColumns.length === 0) {
    applyHandColumns([[sourceId]], sourceId);
    return;
  }
  let targetIndex = targetColumnIndex;
  if (columns[source.columnIndex].length === 0 && source.columnIndex < targetIndex) targetIndex -= 1;
  targetIndex = Math.max(0, Math.min(targetIndex, cleanedColumns.length - 1));
  cleanedColumns[targetIndex].push(sourceId);
  applyHandColumns(cleanedColumns, sourceId);
}

function moveCardToNewColumnAt(sourceId, rawColumnIndex) {
  if (!state) return;
  const columns = ensureHandColumns().map((column) => [...column]);
  const source = findColumnPosition(columns, sourceId);
  if (!source) return;

  columns[source.columnIndex].splice(source.cardIndex, 1);
  const cleanedColumns = cleanupColumns(columns);
  let columnIndex = rawColumnIndex;
  if (columns[source.columnIndex].length === 0 && source.columnIndex < columnIndex) columnIndex -= 1;
  columnIndex = Math.max(0, Math.min(columnIndex, cleanedColumns.length));
  cleanedColumns.splice(columnIndex, 0, [sourceId]);
  applyHandColumns(cleanedColumns, sourceId);
}

function columnIdsFromDrag(event) {
  const raw = event.dataTransfer.getData("application/x-guandan-column");
  if (raw) {
    try {
      const ids = JSON.parse(raw);
      if (Array.isArray(ids) && ids.every((id) => typeof id === "string")) return ids;
    } catch {
      return null;
    }
  }
  return draggedColumnIds;
}

function moveColumnToIndex(sourceColumnIds, rawColumnIndex) {
  if (!state || !sourceColumnIds || sourceColumnIds.length === 0) return;
  const sourceIdSet = new Set(sourceColumnIds);
  const columns = ensureHandColumns().map((column) => [...column]);
  const sourceColumnIndex = columns.findIndex((column) => column.some((id) => sourceIdSet.has(id)));
  if (sourceColumnIndex === -1) return;

  const sourceColumn = columns[sourceColumnIndex].filter((id) => sourceIdSet.has(id));
  if (sourceColumn.length === 0) return;
  columns.splice(sourceColumnIndex, 1);
  let columnIndex = rawColumnIndex;
  if (sourceColumnIndex < columnIndex) columnIndex -= 1;
  columnIndex = Math.max(0, Math.min(columnIndex, columns.length));
  columns.splice(columnIndex, 0, sourceColumn);
  applyHandColumns(columns, sourceColumn[0]);
}

function moveDragPayloadToColumn(event, fallbackSourceId, targetColumnIndex) {
  const columnIds = columnIdsFromDrag(event);
  if (columnIds && columnIds.length > 1) {
    moveColumnToIndex(columnIds, targetColumnIndex);
    return;
  }
  moveCardToColumnEnd(fallbackSourceId, targetColumnIndex);
}

function moveDragPayloadToNewColumn(event, fallbackSourceId, targetColumnIndex) {
  const columnIds = columnIdsFromDrag(event);
  if (columnIds && columnIds.length > 1) {
    moveColumnToIndex(columnIds, targetColumnIndex);
    return;
  }
  moveCardToNewColumnAt(fallbackSourceId, targetColumnIndex);
}

function handDropColumnIndex(clientX) {
  const columns = [...elements.hand.querySelectorAll(".hand-column")];
  const index = columns.findIndex((column) => {
    const rect = column.getBoundingClientRect();
    return clientX < rect.left + rect.width / 2;
  });
  return index === -1 ? columns.length : index;
}

function handleHandDrop(event) {
  if (!draggedCardId) return;
  if (event.target.closest(".card") || event.target.closest(".hand-column")) return;
  event.preventDefault();
  moveDragPayloadToNewColumn(event, event.dataTransfer.getData("text/plain") || draggedCardId, handDropColumnIndex(event.clientX));
}

function handleColumnDrop(event, columnIndex) {
  if (!draggedCardId || event.target.closest(".card")) return;
  event.preventDefault();
  event.stopPropagation();
  moveDragPayloadToColumn(event, event.dataTransfer.getData("text/plain") || draggedCardId, columnIndex);
}

function handleColumnDragOver(event) {
  if (!draggedCardId) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function handleHandDragOver(event) {
  if (!draggedCardId) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function sortHumanHand() {
  if (!state) return;
  freeWildCardIds = new Set();
  const arrangedHand = sortHumanCardsForArrangement(state.players[HUMAN_INDEX].hand);
  updateHumanHand(arrangedHand);
  resetHandColumns(arrangedHand);
  message = "手牌已竖列整理。拖到牌面=加入该竖列；拖到空白=新建竖列。单击选一张，双击选整列。";
  render();
}

function visualGroupRank(card, assignments) {
  return assignments.get(cardId(card)) ?? card.rank;
}

function wildcardAssignments(hand) {
  const groups = new Map();
  const wildCards = [];
  for (const card of hand) {
    if (isWildCard(card, state.levelRank)) {
      if (!freeWildCardIds.has(cardId(card))) wildCards.push(card);
      continue;
    }
    if (!groups.has(card.rank)) groups.set(card.rank, []);
    groups.get(card.rank).push(card);
  }

  const targets = [...groups.entries()]
    .filter(([, cards]) => cards.length >= 2)
    .sort((left, right) => {
      const countDiff = right[1].length - left[1].length;
      if (countDiff !== 0) return countDiff;
      return ARRANGEMENT_RANKS.indexOf(right[0]) - ARRANGEMENT_RANKS.indexOf(left[0]);
    });

  const assignments = new Map();
  if (targets.length === 0) return assignments;
  for (const wildCard of wildCards) {
    assignments.set(cardId(wildCard), targets[0][0]);
  }
  return assignments;
}

function sortHumanCardsForArrangement(hand) {
  const sorted = sortCardsForDisplay(hand);
  const assignments = wildcardAssignments(sorted);
  if (assignments.size === 0) return sorted;

  const result = [];
  const usedWildIds = new Set();
  for (const card of sorted) {
    if (assignments.has(cardId(card))) continue;
    result.push(card);
    const assignedWildCards = sorted.filter((candidate) => (
      assignments.get(cardId(candidate)) === card.rank && !usedWildIds.has(cardId(candidate))
    ));
    const isLastNaturalInGroup = !sorted.some((candidate) => (
      !assignments.has(cardId(candidate))
      && candidate.rank === card.rank
      && sorted.indexOf(candidate) > sorted.indexOf(card)
    ));
    if (isLastNaturalInGroup) {
      for (const wildCard of assignedWildCards) {
        result.push(wildCard);
        usedWildIds.add(cardId(wildCard));
      }
    }
  }
  for (const card of sorted) {
    if (assignments.has(cardId(card)) && !usedWildIds.has(cardId(card))) result.push(card);
  }
  return result;
}

function groupedHandColumns(hand) {
  const assignments = wildcardAssignments(hand);
  const columns = [];
  let currentColumn = null;
  for (const card of hand) {
    const groupRank = visualGroupRank(card, assignments);
    if (!currentColumn || currentColumn.rank !== groupRank) {
      currentColumn = {
        rank: groupRank,
        cards: [],
      };
      columns.push(currentColumn);
    }
    currentColumn.cards.push(card);
  }
  return columns;
}

function flushPendingCardSelection() {
  if (!pendingCardClickTimer) return;
  window.clearTimeout(pendingCardClickTimer);
  pendingCardClickTimer = null;
  pendingCardClickAction?.();
  pendingCardClickAction = null;
}

function selectedCards() {
  flushPendingCardSelection();
  if (!state) return [];
  const selected = [];
  for (const card of state.players[HUMAN_INDEX].hand) {
    if (selectedIds.has(cardId(card))) selected.push(card);
  }
  return selected;
}

function removeAccidentalJokerFromStraightFlush() {
  if (!state) return false;
  const chosen = selectedCards();
  if (chosen.length !== 6) return false;
  const jokers = chosen.filter((card) => card.suit === "JOKER");
  if (jokers.length === 0) return false;

  for (const joker of jokers) {
    const subset = chosen.filter((card) => cardId(card) !== cardId(joker));
    const play = classifyPlay(subset, state.levelRank);
    if (play.type === PLAY_TYPES.straightFlush) {
      selectedIds.delete(cardId(joker));
      message = `已忽略误选的${cardLabel(joker)}，当前可出同花顺。`;
      return true;
    }
  }
  return false;
}

function tryPlay(cards, successMessage, { advice = null, source = "human-manual" } = {}) {
  if (!state) return;
  try {
    clearHint();
    if (state.currentPlayerIndex === HUMAN_INDEX) dismissKeyPause();
    const actorIndex = state.currentPlayerIndex;
    const play = classifyPlay(cards, state.levelRank);
    const adviceBeforePlay = advice ?? (actorIndex === HUMAN_INDEX
      ? (currentAdvice ?? hintAdvice ?? buildMinimalHumanAdviceForPlay(play))
      : getTurnAdvice(state, actorIndex, robotAdviceOptions()));
    const adviceRecord = serializeCoachAdvice(adviceBeforePlay, play, source);
    if (play.type !== PLAY_TYPES.pass && !state.lastActivePlay) {
      tablePlays = new Map();
      tableTrickLeaderIndex = null;
    }
    state = playCards(state, cards);
    const stuckRepair = repairTurnStuck(state);
    if (stuckRepair.repaired) {
      state = stuckRepair.state;
      syncTableAfterTrickRepair(state);
    }
    appendCoachAdviceRecord(adviceRecord);
    if (actorIndex === HUMAN_INDEX && isTop1MatchRecord(adviceRecord)) {
      showCoachToast("打得好 ✓");
    }
    captureHeadTourReviewIfNeeded();
    tablePlays.set(actorIndex, play);
    if (play.type !== PLAY_TYPES.pass) tableTrickLeaderIndex = actorIndex;
    selectedIds = new Set();
    message = successMessage;
    settleCompetitiveGameIfNeeded();
    if (isGameOver(state)) onGameOverDetected();
    const humanJustPlayed = actorIndex === HUMAN_INDEX;
    if (humanJustPlayed && play.type !== PLAY_TYPES.pass) {
      maybeRemindReportCards(state.players[HUMAN_INDEX].hand.length);
    }
    if (humanJustPlayed) {
      cancelAdviceCompute();
      currentAdvice = null;
      robotQueueActive = true;
      render({ immediate: true, lite: true });
      scheduleIdleHumanAdviceRefresh();
      scheduleDeferredPanelsRender();
      queueRobotTurns();
    } else {
      render();
      queueRobotTurns();
    }
  } catch (error) {
    message = toFriendlyError(error.message);
    render();
  }
}

function toFriendlyError(errorMessage) {
  if (errorMessage.startsWith("Invalid play")) return "这组牌型暂时不合法，请重新选牌。";
  if (errorMessage.includes("cannot beat")) return "这手牌压不过桌面上的牌，请换一手或过牌。";
  if (errorMessage.includes("Cannot pass")) return "你当前有牌权，不能直接过牌。";
  if (errorMessage.includes("not all present")) return "选牌状态已变化，请重新选择。";
  return errorMessage;
}

function playSelected() {
  if (!state) return;
  const cards = selectedCards();
  if (cards.length === 0) {
    message = "请先点选你想出的牌（选中后会向上浮起），再点「出牌」。";
    render();
    return;
  }

  const play = classifyPlay(cards, state.levelRank);
  if (play.type === PLAY_TYPES.invalid) {
    message = cards.length > 1
      ? `已选 ${cards.length} 张（${cardsLabel(cards)}），不能作为一手牌打出，请只选一手合法牌型。`
      : play.reason
        ? `这组牌不合法：${play.reason}`
        : "这组牌型不合法，请重新选牌。";
    render();
    return;
  }
  tryPlay(cards, `你出了：${playLabel(play)} ${cardsLabel(cards)}`);
}

function playRecommended() {
  if (!state) return;
  if (hintShown) {
    adoptHint();
    return;
  }
  showHint();
}

function playAdviceChoice(index) {
  if (!state) return;
  const advice = currentAdvice ?? hintAdvice;
  if (!advice) {
    message = advicePendingMessage();
    scheduleHumanAdviceRefresh();
    render();
    return;
  }
  const choices = adviceChoices(advice);
  const choice = choices[index];
  if (!choice) return;
  tryPlay(choice.candidate.cards, `你选择推荐${index + 1}：${choice.candidate.label || "过牌"}`, {
    advice,
    source: `human-accepted-suggestion-${index + 1}`,
  });
}

/** 手动出牌时尚未算出 advice 时的占位记录，避免 tryPlay 同步全量评分 */
function buildMinimalHumanAdviceForPlay(play) {
  return {
    playerIndex: HUMAN_INDEX,
    levelRank: state.levelRank,
    mustBeat: state.lastActivePlay ? serializePlay(state.lastActivePlay) : null,
    handProfile: null,
    recommendation: {
      candidate: play,
      score: 0,
      reasons: ["手动出牌"],
    },
    alternatives: [],
  };
}

/** 人类过牌轻量建议，避免 pass 路径同步全量 recommend 阻塞主线程 */
function buildHumanPassAdvice() {
  const passCandidate = classifyPlay([], state.levelRank);
  return {
    playerIndex: HUMAN_INDEX,
    levelRank: state.levelRank,
    mustBeat: state.lastActivePlay ? serializePlay(state.lastActivePlay) : null,
    handProfile: null,
    recommendation: {
      candidate: passCandidate,
      score: 0,
      reasons: ["过牌"],
    },
    alternatives: [],
  };
}

function passTurn() {
  flushPendingCardSelection();
  tryPlay([], "你选择过牌。", {
    source: "human-pass",
    advice: currentAdvice ?? buildHumanPassAdvice(),
  });
}

function cancelRobotQueueWatchdog(generation) {
  if (generation !== robotQueueGeneration || robotQueueWatchdog === null) return;
  clearTimeout(robotQueueWatchdog);
  robotQueueWatchdog = null;
}

function cancelRobotQueueTimers() {
  if (robotQueueTimer !== null) {
    clearTimeout(robotQueueTimer);
    robotQueueTimer = null;
  }
  if (robotQueueWatchdog !== null) {
    clearTimeout(robotQueueWatchdog);
    robotQueueWatchdog = null;
  }
}

function syncTableAfterTrickRepair(repairedState) {
  if (repairedState.lastActivePlay) return;
  tablePlays = new Map();
  tableTrickLeaderIndex = null;
}

/** 修复 currentPlayer 与历史矛盾，必要时强制机器人过牌兜底 */
function kickStuckSession({ timeout = false, silent = false } = {}) {
  if (!state || isGameOver(state)) return false;

  const { state: repaired, repaired: fixed } = repairTurnStuck(state);
  if (fixed) {
    state = repaired;
    syncTableAfterTrickRepair(state);
    if (!silent) message = "检测到牌局进度异常，已自动修复。";
    return true;
  }

  if (!timeout || state.currentPlayerIndex === HUMAN_INDEX || !state.lastActivePlay) {
    return false;
  }

  const actorIndex = state.currentPlayerIndex;
  try {
    const play = classifyPlay([], state.levelRank);
    state = playCards(state, []);
    tablePlays.set(actorIndex, play);
    if (!silent) {
      message = `${PLAYER_NAMES[actorIndex]}：过牌（自动兜底）`;
    }
    return true;
  } catch (error) {
    console.warn("机器人兜底过牌失败", error);
    return false;
  }
}

/** 机器人出牌记录：复用 recommendPlay 结果，不再同步二次 getTurnAdvice */
function buildRobotTurnAdvice(actorIndex, recommendation) {
  return {
    playerIndex: actorIndex,
    levelRank: state.levelRank,
    mustBeat: state.lastActivePlay ? serializePlay(state.lastActivePlay) : null,
    handProfile: null,
    recommendation,
    alternatives: [],
  };
}

function applyRobotTurnResult(actorIndex, result, adviceRecord) {
  const startsNewTrick = !state.lastActivePlay;
  if (result.recommendation.candidate.type !== PLAY_TYPES.pass && startsNewTrick) {
    tablePlays = new Map();
    tableTrickLeaderIndex = null;
  }
  state = result.state;
  appendCoachAdviceRecord(adviceRecord);
  captureHeadTourReviewIfNeeded();
  tablePlays.set(actorIndex, result.recommendation.candidate);
  if (result.recommendation.candidate.type !== PLAY_TYPES.pass) {
    tableTrickLeaderIndex = actorIndex;
  }
  const playerName = PLAYER_NAMES[actorIndex];
  message = `${playerName}：${result.recommendation.candidate.type === PLAY_TYPES.pass ? "过牌" : cardsLabel(result.recommendation.candidate.cards)}`;
}

function finishRobotQueueToHuman(generation) {
  robotQueueActive = false;
  cancelRobotQueueWatchdog(generation);
  invalidateStaleAdvice();
  currentAdvice = null;
  if (currentGameMeta?.coachAdviceTimeline?.length) {
    currentGameMeta.divergenceSummaryCache = summarizeGameDivergences(
      currentGameMeta.coachAdviceTimeline,
      HUMAN_INDEX,
    );
  }
  render({ immediate: true, lite: true });
  scheduleDeferredPanelsRender();
  adviceComputeState.pendingRefresh = true;
  scheduleHumanAdviceRefresh();
}

function finishRobotQueueGameOver(generation) {
  robotQueueActive = false;
  cancelRobotQueueWatchdog(generation);
  onGameOverDetected();
  render({ immediate: true, lite: true });
  scheduleDeferredPanelsRender();
}

/** 单帧可连推多手机器人，仅结束时渲染一次，避免勇哥/老史/毛蛋各卡一轮 UI */
function runRobotQueueStep(generation) {
  if (generation !== robotQueueGeneration || !state || isGameOver(state)) {
    robotQueueActive = false;
    cancelRobotQueueWatchdog(generation);
    if (state && isGameOver(state)) onGameOverDetected();
    return;
  }
  if (state.currentPlayerIndex === HUMAN_INDEX) {
    finishRobotQueueToHuman(generation);
    return;
  }

  kickStuckSession({ silent: true });
  if (state.currentPlayerIndex === HUMAN_INDEX) {
    finishRobotQueueToHuman(generation);
    return;
  }

  const batchStarted = performance.now();
  let stepsDone = 0;
  let stepOk = true;

  while (
    generation === robotQueueGeneration
    && state
    && !isGameOver(state)
    && state.currentPlayerIndex !== HUMAN_INDEX
    && stepsDone < ROBOT_BATCH_MAX_STEPS
    && (performance.now() - batchStarted) < ROBOT_BATCH_YIELD_MS
  ) {
    if (detectTurnStuck(state)) {
      kickStuckSession({ silent: true });
      if (state.currentPlayerIndex === HUMAN_INDEX) break;
    }

    const actorIndex = state.currentPlayerIndex;
    const playerName = PLAYER_NAMES[actorIndex];
    const stepStarted = performance.now();

    try {
      const result = playRecommendedTurn(state, {
        mlModel: null,
        mlFusionMode: "off",
        lite: true,
      });
      const adviceBeforePlay = buildRobotTurnAdvice(actorIndex, result.recommendation);
      const adviceRecord = serializeCoachAdvice(
        adviceBeforePlay,
        result.recommendation.candidate,
        "robot-auto",
      );
      applyRobotTurnResult(actorIndex, result, adviceRecord);
    } catch (error) {
      console.error(`${playerName} 自动出牌失败`, error);
      if (!kickStuckSession({ timeout: true, silent: true })) {
        stepOk = false;
        break;
      }
    }

    const stepElapsed = performance.now() - stepStarted;
    if (stepElapsed > ROBOT_STEP_SLOW_MS) {
      console.warn(`机器人单步耗时 ${Math.round(stepElapsed)}ms（${playerName}）`);
    }
    stepsDone += 1;
    settleCompetitiveGameIfNeeded();
    if (state?.currentPlayerIndex === HUMAN_INDEX || isGameOver(state)) break;
  }

  cancelRobotQueueWatchdog(generation);

  if (state && isGameOver(state)) {
    finishRobotQueueGameOver(generation);
    return;
  }
  if (state?.currentPlayerIndex === HUMAN_INDEX) {
    finishRobotQueueToHuman(generation);
    return;
  }
  if (detectTurnStuck(state)) {
    robotQueueActive = false;
    if (kickStuckSession({ silent: true })) {
      render({ immediate: true, lite: true });
      if (state?.currentPlayerIndex === HUMAN_INDEX) scheduleHumanAdviceRefresh();
      else scheduleRobotStep(generation);
    }
    return;
  }
  if (!stepOk || generation !== robotQueueGeneration) {
    robotQueueActive = false;
    render({ immediate: true, lite: true });
    return;
  }

  render({ immediate: true, lite: true });
  scheduleRobotStep(generation);
}

/** 每步 setTimeout 调度 1 手，步骤间主线程可喘息且 watchdog 能触发 */
function scheduleRobotStep(generation) {
  if (robotQueueTimer !== null) {
    clearTimeout(robotQueueTimer);
    robotQueueTimer = null;
  }
  if (robotQueueWatchdog !== null) {
    clearTimeout(robotQueueWatchdog);
    robotQueueWatchdog = null;
  }

  robotQueueWatchdog = window.setTimeout(() => {
    if (generation !== robotQueueGeneration) return;
    if (!state || isGameOver(state) || state.currentPlayerIndex === HUMAN_INDEX) {
      robotQueueActive = false;
      return;
    }
    console.warn("机器人出牌超时，尝试修复并继续。");
    robotQueueActive = false;
    if (kickStuckSession({ timeout: true })) {
      render({ immediate: true, lite: true });
      queueRobotTurns();
    }
  }, ROBOT_QUEUE_TIMEOUT_MS);

  robotQueueActive = true;
  robotQueueTimer = window.setTimeout(() => {
    robotQueueTimer = null;
    runRobotQueueStep(generation);
  }, ROBOT_QUEUE_DELAY_MS);
}

function queueRobotTurns() {
  robotQueueGeneration += 1;
  cancelRobotQueueTimers();
  scheduleRobotStep(robotQueueGeneration);
}

function autoGame() {
  if (autoGameRunning) return;
  if (!state) newGame();
  autoGameRunning = true;
  if (elements.autoGame) {
    elements.autoGame.disabled = true;
    elements.autoGame.textContent = "自动中…";
  }
  const transcript = [];

  const finishAutoGame = (isComplete) => {
    autoGameRunning = false;
    selectedIds = new Set();
    tablePlays = new Map();
    tableTrickLeaderIndex = null;
    message = isComplete
      ? `自动对局完成，共 ${transcript.length} 手。`
      : "自动对局已暂停，达到回合上限。";
    settleCompetitiveGameIfNeeded();
    if (elements.autoGame) elements.autoGame.textContent = "自动打完";
    render();
  };

  const step = () => {
    let batch = 0;
    while (state && !isGameOver(state) && transcript.length < 600 && batch < 6) {
      const actorIndex = state.currentPlayerIndex;
      const startsNewTrick = !state.lastActivePlay;
      const adviceBeforePlay = getTurnAdvice(state, actorIndex, robotAdviceOptions());
      const adviceRecord = serializeCoachAdvice(
        adviceBeforePlay,
        adviceBeforePlay.recommendation.candidate,
        "auto-game",
      );
      const result = playRecommendedTurn(state, {
        mlModel: robotMlModel(),
        mlFusionMode: mlFusionModeForUi(),
      });
      // 自动打完代打不计入人类复盘
      if (actorIndex !== HUMAN_INDEX) {
        appendCoachAdviceRecord(adviceRecord);
      }
      transcript.push({
        turnNumber: adviceRecord.turnNumber,
        playerIndex: actorIndex,
        play: result.recommendation.candidate,
        score: result.recommendation.score,
        reasons: result.recommendation.reasons,
      });
      state = result.state;
      captureHeadTourReviewIfNeeded();
      if (result.recommendation.candidate.type !== PLAY_TYPES.pass && startsNewTrick) {
        tablePlays = new Map();
        tableTrickLeaderIndex = null;
      }
      tablePlays.set(actorIndex, result.recommendation.candidate);
      if (result.recommendation.candidate.type !== PLAY_TYPES.pass) {
        tableTrickLeaderIndex = actorIndex;
      }
      batch += 1;
    }

    message = `自动对局中… 已打 ${transcript.length} 手`;
    render();

    if (state && !isGameOver(state) && transcript.length < 600) {
      window.setTimeout(step, 48);
      return;
    }
    finishAutoGame(Boolean(state && isGameOver(state)));
  };

  window.setTimeout(step, 0);
}

async function runSelfTraining() {
  const rounds = 8;
  let completed = 0;
  let totalTurns = 0;
  let turnLimitHits = 0;
  elements.selfTrain.disabled = true;
  elements.trainingResult.textContent = "自测运行中：0 / 8";

  for (let index = 0; index < rounds; index += 1) {
    const result = runAutoGame(createInitialGameState({
      levelRank: elements.levelRank.value,
      random: seededRandom(1000 + index * 97),
    }), { maxTurns: 600 });

    if (result.isComplete) completed += 1;
    if (result.hitTurnLimit) turnLimitHits += 1;
    totalTurns += result.transcript.length;
    elements.trainingResult.textContent = `自测运行中：${index + 1} / ${rounds}`;
    await new Promise((resolve) => window.setTimeout(resolve, 20));
  }

  const averageTurns = Math.round(totalTurns / rounds);
  elements.trainingResult.textContent = `自测 ${rounds} 局：完成 ${completed} 局，平均 ${averageTurns} 手，撞上限 ${turnLimitHits} 局。`;
  elements.selfTrain.disabled = false;
}

function renderPlayers() {
  elements.players.replaceChildren();
  if (!state) return;

  for (const player of state.players) {
    const node = document.createElement("div");
    const isActive = player.seatIndex === state.currentPlayerIndex;
    const isThinking = isActive
      && state.currentPlayerIndex !== HUMAN_INDEX
      && robotQueueActive
      && !isGameOver(state);
    node.className = [
      "player",
      isActive ? "active" : "",
      isThinking ? "thinking" : "",
    ].filter(Boolean).join(" ");
    node.dataset.seat = String(player.seatIndex);
    node.dataset.avatar = PLAYER_AVATARS[player.seatIndex];
    const finishedMeta = player.finishedOrder ? `<div class="player-meta">第 ${player.finishedOrder} 名出完</div>` : "";
    node.innerHTML = `
      <div class="player-title">
        <span>${PLAYER_NAMES[player.seatIndex]}</span>
        <span>${player.hand.length} 张</span>
      </div>
      ${finishedMeta}
    `;
    elements.players.append(node);
  }
}

function renderSeatPlays() {
  elements.seatPlays.replaceChildren();
  if (!state) return;
  for (let seatIndex = 0; seatIndex < PLAYER_NAMES.length; seatIndex += 1) {
    const play = tablePlays.get(seatIndex);
    const node = document.createElement("div");
    const hasAction = tablePlays.has(seatIndex);
    const isActivePlay = tableTrickLeaderIndex === seatIndex && play && play.type !== PLAY_TYPES.pass;
    const isBeatenPlay = play && play.type !== PLAY_TYPES.pass && tableTrickLeaderIndex !== null && !isActivePlay;
    node.className = [
      "seat-play",
      hasAction ? "" : "pending",
      play && play.type === PLAY_TYPES.pass ? "pass" : "",
      isActivePlay ? "active-play" : "",
      isBeatenPlay ? "beaten-play" : "",
    ].filter(Boolean).join(" ");
    node.dataset.seat = String(seatIndex);
    const label = !hasAction
      ? "等待"
      : play && play.type !== PLAY_TYPES.pass
      ? `${playLabel(play)}${isBeatenPlay ? "（已被压过）" : ""}`
      : "不要";
    const cards = document.createElement("div");
    cards.className = "seat-cards";
    if (play && play.type !== PLAY_TYPES.pass) {
      for (const card of play.cards) {
        cards.append(renderCard(card));
      }
    }
    node.innerHTML = `<strong>${PLAYER_NAMES[seatIndex]}：${label}</strong>`;
    node.append(cards);
    elements.seatPlays.append(node);
  }
}

function renderTable() {
  const noGame = !state;
  const gameOver = state ? isGameOver(state) : false;
  const level = state?.levelRank ?? elements.levelRank.value;
  elements.ourLevel.textContent = matchState ? matchState.levels[0] : level;
  elements.theirLevel.textContent = matchState ? matchState.levels[1] : level;
  elements.turnTitle.textContent = noGame ? "等待开始" : gameOver ? "本局结束" : `当前：${PLAYER_NAMES[state.currentPlayerIndex]}`;
  elements.turnHint.textContent = noGame
    ? "点击“新开一局”发牌"
    : gameOver
      ? "点击“新开一局”继续练牌"
    : state.currentPlayerIndex === HUMAN_INDEX
      ? "轮到你出牌"
      : robotQueueActive
        ? `等待 ${PLAYER_NAMES[state.currentPlayerIndex]} 出牌…`
        : `轮到 ${PLAYER_NAMES[state.currentPlayerIndex]}`;
  elements.turnCount.textContent = noGame ? "0 手" : `${state.turnNumber} 手`;

  if (noGame || state.finishedPlayers.length === 0) {
    elements.scoreboard.textContent = noGame ? "本局尚未开始" : "本局尚未结束";
  } else if (gameOver) {
    // 局末排名在复盘区展示，状态条不重复四方玩家名
    elements.scoreboard.textContent = "";
  } else {
    elements.scoreboard.textContent = state.finishedPlayers.map((index, order) => `${order + 1}. ${PLAYER_NAMES[index]}`).join("  ");
  }

  elements.lastCards.replaceChildren();
  if (!state || !state.lastActivePlay) {
    elements.lastPlayTitle.textContent = "桌面暂无出牌";
  } else {
    elements.lastPlayTitle.textContent = `本轮需要压过：${PLAYER_NAMES[state.lastActivePlayerIndex]} 的 ${playLabel(state.lastActivePlay)}`;
    for (const card of state.lastActivePlay.cards) {
      elements.lastCards.append(renderCard(card));
    }
  }
}

function renderMatch() {
  if (!elements.matchStatus || !elements.matchSummary) return;
  elements.matchStrip?.classList.toggle("match-active", Boolean(matchState));
  if (!matchState) {
    elements.matchStatus.textContent = "单局练习";
    elements.matchSummary.textContent = buildSingleGameMatchSummary(currentGameMeta?.drillFocus);
    if (elements.tributePanel) elements.tributePanel.classList.remove("visible");
    if (elements.nextMatchGame) {
      elements.nextMatchGame.hidden = !shouldShowNextMatchGame(matchState);
      elements.nextMatchGame.disabled = true;
    }
    return;
  }

  const latest = matchState.history.at(-1);
  elements.matchStatus.textContent = matchState.complete
    ? `竞技赛结束：${teamLabel(matchState.winnerTeam)}胜`
    : `竞技赛第 ${matchState.gameNumber} 局`;
  const base = `己方 ${matchState.levels[0]}，对方 ${matchState.levels[1]}，当前打 ${matchState.currentLevelRank}`;
  const tribute = matchState.pendingTributeEvents.length > 0
    ? `；${matchState.pendingTributeEvents.map(tributeEventLabel).join("；")}`
    : "";
  const settlement = latest && isGameOver(state)
    ? `；上局${teamLabel(latest.settlement.winningTeam)}升 ${latest.settlement.upgradeSteps} 级`
    : "";
  elements.matchSummary.textContent = `${base}${settlement}${tribute}`;
  if (elements.tributePanel) elements.tributePanel.classList.remove("visible");
  if (false && elements.tributePanel && elements.tributeTitle && elements.tributeSummary) {
    let title = "";
    let summary = "";
    if (matchState.pendingTributeEvents.length > 0) {
      title = "本局已执行";
      summary = matchState.pendingTributeEvents.map(tributeEventLabel).join("；");
    } else if (state && isGameOver(state) && !matchState.complete) {
      title = "下一局进贡预告";
      summary = expectedTributeLabel(state.finishedPlayers);
    }

    if (summary) {
      elements.tributeTitle.textContent = title;
      elements.tributeSummary.textContent = summary;
      elements.tributePanel.classList.add("visible");
    } else {
      elements.tributePanel.classList.remove("visible");
    }
  }
  if (elements.nextMatchGame) {
    elements.nextMatchGame.hidden = !shouldShowNextMatchGame(matchState);
    elements.nextMatchGame.disabled = matchState.complete || !state || !isGameOver(state);
  }
}

function renderHand() {
  elements.hand.replaceChildren();
  if (!state) return;
  if (isGameOver(state)) return;
  elements.hand.ondragover = handleHandDragOver;
  elements.hand.ondrop = handleHandDrop;
  const cardById = new Map(state.players[HUMAN_INDEX].hand.map((card) => [cardId(card), card]));
  const columns = ensureHandColumns();
  for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
    const column = columns[columnIndex];
    const columnNode = document.createElement("div");
    columnNode.className = "hand-column";
    columnNode.dataset.columnIndex = String(columnIndex);
    columnNode.addEventListener("dragover", handleColumnDragOver);
    columnNode.addEventListener("drop", (event) => handleColumnDrop(event, columnIndex));
    const cards = column.map((id) => cardById.get(id)).filter(Boolean);
    for (let cardIndex = 0; cardIndex < cards.length; cardIndex += 1) {
      const card = cards[cardIndex];
      columnNode.append(renderCard(card, {
        selectable: state.currentPlayerIndex === HUMAN_INDEX,
        reorderable: true,
        columnIndex,
        cardIndex,
      }));
    }
    elements.hand.append(columnNode);
  }
}

function openHandsReviewSource() {
  const snapshot = currentGameMeta?.headTourReview;
  if (snapshot) {
    return {
      title: "头游复盘：四家明牌",
      note: `这是你头游后的手牌快照，记录在第 ${snapshot.capturedAtTurnNumber} 手；后续自动出牌不会覆盖这份复盘。`,
      hands: snapshot.hands,
    };
  }

  return {
    title: isGameOver(state) ? "本局结束：四家手牌" : "四家当前手牌",
    note: isGameOver(state) ? "本局已经排完名次，保留最后剩余牌便于复盘。" : "头游后会自动展示四家剩余手牌。",
    hands: state.players.map((player, index) => ({
      playerIndex: index,
      playerName: PLAYER_NAMES[index],
      finishedOrder: player.finishedOrder,
      cards: sortCardsForDisplay(player.hand).map(serializeCard),
    })),
  };
}

function renderOpenHandsReview() {
  const source = openHandsReviewSource();
  const box = document.createElement("div");
  box.className = "advice-box review-hands-box";
  box.innerHTML = `<h3>${source.title}</h3><p>${source.note}</p>`;

  const list = document.createElement("div");
  list.className = "review-hands";
  for (const hand of source.hands) {
    const player = document.createElement("div");
    player.className = "review-player-hand";
    const orderText = hand.finishedOrder ? `第 ${hand.finishedOrder} 名` : "未出完";
    player.innerHTML = `
      <div class="review-player-title">
        <strong>${hand.playerName}</strong>
        <span>${orderText} · ${hand.cards.length} 张</span>
      </div>
    `;

    const cards = document.createElement("div");
    cards.className = "review-hand-cards";
    if (hand.cards.length === 0) {
      const empty = document.createElement("span");
      empty.className = "review-empty";
      empty.textContent = "已出完";
      cards.append(empty);
    } else {
      for (const card of sortCardsForDisplay(hand.cards)) {
        cards.append(renderCard(card));
      }
    }
    player.append(cards);
    list.append(player);
  }

  box.append(list);
  return box;
}

function currentDivergenceSummary() {
  if (currentGameMeta?.divergenceSummaryCache) {
    return currentGameMeta.divergenceSummaryCache;
  }
  return summarizeGameDivergences(currentGameMeta?.coachAdviceTimeline ?? [], HUMAN_INDEX);
}

function renderKeyPauseBanner() {
  if (!elements.keyPauseBanner) return;
  if (!keyPauseOverlay) {
    elements.keyPauseBanner.hidden = true;
    elements.keyPauseBanner.replaceChildren();
    return;
  }
  elements.keyPauseBanner.hidden = false;
  elements.keyPauseBanner.innerHTML = `
    <strong>先想再出</strong>
    <span class="key-pause-msg">${escapeHtml(keyPauseOverlay.message)}</span>
    <div class="key-pause-actions">
      <button class="btn" type="button" data-key-pause-action="think">我先想</button>
      <button class="btn primary" type="button" data-key-pause-action="hint">看推荐</button>
    </div>
  `;
}

function renderHintBanner() {
  if (!elements.hintBanner) return;
  if (!hintShown || !hintAdvice) {
    elements.hintBanner.hidden = true;
    elements.hintBanner.replaceChildren();
    return;
  }
  const rec = hintAdvice.recommendation;
  const reason = firstReasonForUser(rec.reasons);
  const label = rec.candidate.label || (rec.candidate.type === PLAY_TYPES.pass ? "过牌" : "推荐牌");
  const drillTip = buildDrillAdviceTip(
    { reasons: rec.reasons, candidate: rec.candidate },
    currentGameMeta?.drillFocus,
  );
  elements.hintBanner.hidden = false;
  elements.hintBanner.innerHTML = `
    <strong>推荐：${escapeHtml(label)}</strong>
    <span>${escapeHtml(reason)}</span>
    ${drillTip ? `<span class="hint-drill-tip">${escapeHtml(drillTip)}</span>` : ""}
  `;
}

function renderDrillFocusBanner() {
  // 专项信息已并入 matchSummary（buildSingleGameMatchSummary），不再占用 table-wrap 网格行
  if (elements.drillFocusBanner) {
    elements.drillFocusBanner.hidden = true;
    elements.drillFocusBanner.replaceChildren();
  }
}

function renderReportReminderBanner() {
  if (!elements.reportReminderBanner) return;
  const gameOver = state && isGameOver(state);
  if (!reportReminderText || gameOver) {
    elements.reportReminderBanner.hidden = true;
    elements.reportReminderBanner.replaceChildren();
    return;
  }
  elements.reportReminderBanner.hidden = false;
  elements.reportReminderBanner.innerHTML = `
    <strong>报牌提醒</strong>
    <span>${escapeHtml(reportReminderText)}（只报张数，不报牌型）</span>
  `;
}

/** 从复盘推荐对比跳转到左侧出牌记录对应手数 */
function scrollToHistoryHand(handIndex) {
  if (!Number.isFinite(handIndex)) return;
  if (elements.historyPanel && !elements.historyPanel.open) {
    elements.historyPanel.open = true;
  }
  const target = elements.history?.querySelector(`[data-hand-index="${handIndex}"]`);
  if (!target) {
    message = `出牌记录中未找到第 ${handIndex} 手。`;
    renderControls();
    return;
  }
  elements.history.querySelectorAll("[data-hand-index].history-action-highlight").forEach((node) => {
    node.classList.remove("history-action-highlight");
  });
  target.classList.add("history-action-highlight");
  target.scrollIntoView({ behavior: "smooth", block: "nearest" });
  window.setTimeout(() => target.classList.remove("history-action-highlight"), 2200);
}

function renderImproveCards(summary) {
  if (!elements.improveCards) return;
  const gameOver = state && isGameOver(state);
  const top3 = divergencesByVerdict(summary, DIVERGENCE_VERDICTS.COACH_BETTER).slice(0, 3);

  if (!gameOver || top3.length === 0) {
    elements.improveCards.hidden = true;
    elements.improveCards.classList.remove("improve-cards--highlight");
    elements.improveCards.replaceChildren();
    return;
  }

  elements.improveCards.hidden = false;
  elements.improveCards.classList.add("improve-cards--highlight");
  let html = "<h3>本局最该改的三处</h3><div class=\"improve-cards-list\">";
  for (const item of top3) {
    const reason = item.verdictNote || firstReasonForUser(item.recommendedReasons, "详见下方差异列表");
    html += `<article class="improve-card" data-hand-index="${item.turnNumber}" role="button" tabindex="0" title="点击查看推荐对比并定位出牌记录">
      <span class="improve-card-turn">第 ${item.turnNumber} 手</span>
      <p>你出了 <strong>${escapeHtml(item.actual)}</strong>，推荐 <strong>${escapeHtml(item.recommended)}</strong></p>
      <p class="improve-card-reason">原因：${escapeHtml(reason)}</p>
    </article>`;
  }
  html += "</div>";
  elements.improveCards.innerHTML = html;
}

const ONBOARDING_STEPS = [
  { step: 1, target: () => elements.newGame, text: "第一步：点「新开一局」发牌开始练习。" },
  { step: 2, target: () => elements.playRecommended, text: "第二步：轮到你时点「提示」，先看推荐牌和理由。" },
  { step: 3, target: () => elements.improveCards?.hidden ? elements.submitGameReview : elements.improveCards, text: "第三步：打完一局后，右侧会自动记录复盘，教练会持续优化推荐。" },
];

function onboardingDone() {
  return safeGetItem(ONBOARDING_STORAGE, "") === "1";
}

function finishOnboarding() {
  safeSetItem(ONBOARDING_STORAGE, "1");
  onboardingStep = 0;
  if (elements.onboardingOverlay) elements.onboardingOverlay.hidden = true;
  if (elements.onboardingRing) elements.onboardingRing.hidden = true;
  updateFirstTips();
}

function skipOnboarding() {
  const saved = readFirstTipsState();
  saved._onboardingSkipped = true;
  writeFirstTipsState(saved);
  finishOnboarding();
}

function advanceOnboarding(completedStep) {
  if (onboardingDone()) return;
  if (completedStep === 1 && onboardingStep === 1) onboardingStep = 2;
  else if (completedStep === 2 && onboardingStep === 2) onboardingStep = 3;
  else if (completedStep === 3 && onboardingStep === 3) {
    finishOnboarding();
    return;
  }
  renderOnboarding();
}

function isValidOnboardingContext() {
  if (onboardingDone()) return false;
  if (!state) return true;
  if (isGameOver(state)) return true;
  return false;
}

function renderOnboarding() {
  if (onboardingDone() || onboardingStep <= 0) {
    if (elements.onboardingOverlay) elements.onboardingOverlay.hidden = true;
    if (elements.onboardingRing) elements.onboardingRing.hidden = true;
    return;
  }

  if (onboardingStep === 1 && state) {
    if (elements.onboardingOverlay) elements.onboardingOverlay.hidden = true;
    if (elements.onboardingRing) elements.onboardingRing.hidden = true;
    return;
  }

  if (!isValidOnboardingContext() && onboardingStep < 3) {
    if (elements.onboardingOverlay) elements.onboardingOverlay.hidden = true;
    if (elements.onboardingRing) elements.onboardingRing.hidden = true;
    return;
  }

  const config = ONBOARDING_STEPS.find((item) => item.step === onboardingStep);
  if (!config) {
    finishOnboarding();
    return;
  }

  const target = config.target();
  if (!target || (target === elements.improveCards && elements.improveCards?.hidden)) {
    if (onboardingStep === 3 && state && isGameOver(state)) {
      // 无 coach-better 差异时仍引导保存复盘
      if (elements.onboardingText) elements.onboardingText.textContent = config.text;
      if (elements.onboardingOverlay) elements.onboardingOverlay.hidden = false;
      positionOnboardingRing(elements.submitGameReview);
      return;
    }
    if (elements.onboardingOverlay) elements.onboardingOverlay.hidden = true;
    if (elements.onboardingRing) elements.onboardingRing.hidden = true;
    return;
  }

  if (elements.onboardingText) elements.onboardingText.textContent = config.text;
  if (elements.onboardingOverlay) elements.onboardingOverlay.hidden = false;
  positionOnboardingRing(target);
}

function positionOnboardingRing(target) {
  if (!elements.onboardingRing || !target) {
    if (elements.onboardingRing) elements.onboardingRing.hidden = true;
    return;
  }
  const rect = target.getBoundingClientRect();
  const pad = 6;
  elements.onboardingRing.hidden = false;
  elements.onboardingRing.style.top = `${Math.max(8, rect.top - pad)}px`;
  elements.onboardingRing.style.left = `${Math.max(8, rect.left - pad)}px`;
  elements.onboardingRing.style.width = `${rect.width + pad * 2}px`;
  elements.onboardingRing.style.height = `${rect.height + pad * 2}px`;
}

function initOnboarding() {
  if (onboardingDone()) return;
  if (state && !isGameOver(state)) {
    onboardingStep = 0;
    if (elements.onboardingOverlay) elements.onboardingOverlay.hidden = true;
    if (elements.onboardingRing) elements.onboardingRing.hidden = true;
    return;
  }
  onboardingStep = 1;
  renderOnboarding();
}

/** onboarding 已覆盖的 tip，完成后不再重复 */
const ONBOARDING_TIP_IDS = new Set(["newGame", "hint", "saveReview"]);

const FIRST_TIP_ITEMS = [
  { id: "newGame", text: "点「新开一局」发牌，开始单局练习。" },
  { id: "hint", text: "轮到你时点「提示」，查看推荐出牌和理由。" },
  { id: "adopt", text: "看中推荐后点「采纳」，可一键选中对应手牌。" },
  { id: "coachFab", text: "点「问教练」可向本机规则引擎提问，与左侧推荐一致。" },
  { id: "rules", text: "「规则」可随时查看牌型、贡牌等速查说明。" },
  { id: "drill", text: "「专项练习」针对弱项开一局，教练会标【专项】提示。" },
  { id: "saveReview", text: "打完一局后，复盘会自动保存，教练会持续优化推荐。" },
];

function readFirstTipsState() {
  try {
    const raw = safeGetItem(FIRST_TIPS_STORAGE, "{}");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeFirstTipsState(next) {
  safeSetItem(FIRST_TIPS_STORAGE, JSON.stringify(next));
}

function firstTipsDisabled() {
  const saved = readFirstTipsState();
  return saved._allDone === true;
}

function markFirstTipSeen(id) {
  const saved = readFirstTipsState();
  saved[id] = true;
  writeFirstTipsState(saved);
}

function skipAllFirstTips() {
  writeFirstTipsState({ _allDone: true });
  hideFirstTipBar();
}

function hideFirstTipBar() {
  if (elements.firstTipBar) elements.firstTipBar.hidden = true;
}

function firstTipWhen(item) {
  switch (item.id) {
    case "newGame":
      return !state;
    case "hint":
      return Boolean(state && !isGameOver(state) && state.currentPlayerIndex === HUMAN_INDEX);
    case "adopt":
      return Boolean(state && !elements.adoptHint?.hidden);
    case "coachFab":
      return Boolean(state && !isGameOver(state));
    case "rules":
      return true;
    case "drill":
      return Boolean(elements.drillPanel);
    case "saveReview":
      return Boolean(state && isGameOver(state) && !currentGameMeta?.gameReviewSubmitted);
    default:
      return false;
  }
}

function nextPendingFirstTip() {
  if (!onboardingDone() || firstTipsDisabled()) return null;
  const saved = readFirstTipsState();
  for (const item of FIRST_TIP_ITEMS) {
    if (saved[item.id]) continue;
    if (ONBOARDING_TIP_IDS.has(item.id) && onboardingDone() && !saved._onboardingSkipped) continue;
    if (!firstTipWhen(item)) continue;
    return item;
  }
  return null;
}

function showFirstTip(item) {
  if (!elements.firstTipBar || !elements.firstTipText || !item) {
    hideFirstTipBar();
    return;
  }
  if (!onboardingDone() || elements.onboardingOverlay?.hidden === false) {
    hideFirstTipBar();
    return;
  }
  elements.firstTipText.textContent = item.text;
  elements.firstTipBar.hidden = false;
}

function updateFirstTips() {
  if (!onboardingDone() || firstTipsDisabled()) {
    hideFirstTipBar();
    return;
  }
  if (elements.onboardingOverlay && !elements.onboardingOverlay.hidden) {
    hideFirstTipBar();
    return;
  }
  showFirstTip(nextPendingFirstTip());
}

function dismissCurrentFirstTip() {
  const item = nextPendingFirstTip();
  if (!item) {
    hideFirstTipBar();
    return;
  }
  markFirstTipSeen(item.id);
  updateFirstTips();
}

function renderAdvice({ computeAdvice = true } = {}) {
  elements.advice.replaceChildren();
  if (!state) {
    currentAdvice = null;
    elements.advice.innerHTML = `<div class="advice-box"><p>开局后自动记录你与推荐的差异。</p></div>`;
    return;
  }

  const divSummary = currentDivergenceSummary();
  const autoBox = document.createElement("div");
  autoBox.className = "advice-box advice-auto";
  autoBox.innerHTML = `
    <h3>差异统计</h3>
    <p>已记 <strong>${divSummary.totalHands}</strong> 手，<strong>${divSummary.divergenceCount}</strong> 处与你出牌和推荐1不同。</p>
    ${formatVerdictStats(divSummary)}
    <p class="muted">专注打牌即可，局末会自动记录复盘。</p>
  `;
  elements.advice.append(autoBox);

  if (currentGameMeta?.drillFocus && !isGameOver(state)) {
    const drillBox = document.createElement("div");
    drillBox.className = "advice-box advice-drill";
    drillBox.innerHTML = `
      <h3>专项练习</h3>
      <p>本局重点：<strong>${escapeHtml(currentGameMeta.drillFocus)}</strong></p>
      <p class="muted">${escapeHtml(getDrillBannerHint(currentGameMeta.drillFocus))}</p>
    `;
    elements.advice.append(drillBox);
  }

  if (isGameOver(state)) {
    const winner = completedTeam(state);
    const done = document.createElement("div");
    done.className = "advice-box";
    done.innerHTML = `
      <h3>本局结束${winner ? `：${winner.label}${winner.result}` : ""}</h3>
      <p>${state.finishedPlayers.map((index, order) => `第 ${order + 1} 名：${PLAYER_NAMES[index]}`).join("；")}</p>
    `;
    elements.advice.append(done);
    elements.advice.append(renderOpenHandsReview());
    return;
  }

  if (humanIsFirstPlace(state)) {
    const review = document.createElement("div");
    review.className = "advice-box";
    review.innerHTML = `
      <h3>你已头游</h3>
      <p>系统会继续自动打完其余名次。现在进入复盘视角：四家手牌明牌，出牌记录按轮次展开。</p>
    `;
    elements.advice.append(review);
    if (!isBackgroundAutoPlay()) {
      elements.advice.append(renderOpenHandsReview());
    } else {
      const pending = document.createElement("p");
      pending.className = "muted";
      pending.textContent = "自动打完中，局末会展开四家明牌与完整出牌记录。";
      elements.advice.append(pending);
    }
    return;
  }

  const humanTurn = state.currentPlayerIndex === HUMAN_INDEX;

  if (!humanTurn) {
    const wait = document.createElement("div");
    wait.className = "advice-box";
    const actorName = PLAYER_NAMES[state.currentPlayerIndex];
    wait.innerHTML = robotQueueActive
      ? `<h3>对手出牌中</h3><p>${actorName} 等机器人在走牌（已批量加速，通常几秒内回到你）。</p>`
      : `<h3>等待出牌</h3><p>轮到你时，这里会显示推荐1～3与理由。</p>`;
    elements.advice.append(wait);
    return;
  }

  if (!currentAdvice) {
    if (computeAdvice) {
      scheduleHumanAdviceRefresh();
    }
    const pending = document.createElement("div");
    pending.className = "advice-box";
    pending.innerHTML = `<h3>教练建议</h3><p>${advicePendingMessage()}</p>`;
    elements.advice.append(pending);
    return;
  }

  const advice = currentAdvice;
  const liveMustBeat = state.lastActivePlay
    ? `需要压过：${PLAYER_NAMES[state.lastActivePlayerIndex]} 的 ${playLabel(state.lastActivePlay)}`
    : null;

  const recommendation = document.createElement("div");
  recommendation.className = "advice-box";
  const choices = adviceChoices(advice);
  recommendation.innerHTML = `
    <h3>教练建议</h3>
    <p>${liveMustBeat ?? "你拥有本轮牌权，可以主动出牌。"}</p>
  `;
  if (advice.handProfile) {
    const profile = document.createElement("p");
    profile.textContent = `牌力：${advice.handProfile.label} ${advice.handProfile.score} 分，${advice.handProfile.intent}`;
    recommendation.append(profile);
  }
  const choiceList = document.createElement("div");
  choiceList.className = "choice-list";
  for (let index = 0; index < choices.length; index += 1) {
    choiceList.append(renderChoiceCard(choices[index], index));
  }
  recommendation.append(choiceList);

  const insightWrap = document.createElement("div");
  insightWrap.className = "in-play-insight";
  const insightBtn = document.createElement("button");
  insightBtn.type = "button";
  insightBtn.className = "btn insight-objection-btn";
  insightBtn.id = "insightObjectionBtn";
  insightBtn.textContent = "这手不合理";
  insightBtn.title = "对当前推荐提一句意见，教练会即时回复";
  insightBtn.addEventListener("click", () => {
    const existing = insightWrap.querySelector(".insight-objection-form");
    if (existing) {
      existing.hidden = !existing.hidden;
      if (!existing.hidden) existing.querySelector("textarea")?.focus();
      return;
    }
    const form = document.createElement("div");
    form.className = "insight-objection-form";
    const label = document.createElement("label");
    label.htmlFor = "insightObjectionInput";
    label.textContent = "你觉得哪里不合理？";
    const textarea = document.createElement("textarea");
    textarea.id = "insightObjectionInput";
    textarea.rows = 2;
    textarea.placeholder = "例如：不应拆对组同花顺";
    const actions = document.createElement("div");
    actions.className = "insight-objection-actions";
    const sendBtn = document.createElement("button");
    sendBtn.type = "button";
    sendBtn.className = "btn primary";
    sendBtn.textContent = "发送";
    sendBtn.addEventListener("click", () => {
      submitInPlayInsight(textarea.value);
      textarea.value = "";
      form.hidden = true;
    });
    actions.append(sendBtn);
    form.append(label, textarea, actions);
    insightWrap.append(form);
    textarea.focus();
  });
  insightWrap.append(insightBtn);

  const turnInsights = (currentGameMeta?.gameInsights ?? []).filter(
    (item) => item.turnNumber === state.turnNumber,
  );
  if (turnInsights.length > 0) {
    const latest = turnInsights[turnInsights.length - 1];
    const note = document.createElement("p");
    note.className = "insight-latest-reply muted";
    note.textContent = formatInPlayInsightReply(latest.analysis, latest.verdict);
    insightWrap.append(note);
  }

  recommendation.append(insightWrap);
  elements.advice.append(recommendation);
}

function renderGameReviewPanel() {
  if (!elements.gameReviewSummary) return;
  const gameOver = state && isGameOver(state);
  const submitted = !!currentGameMeta?.gameReviewSubmitted;
  const summary = currentDivergenceSummary();

  renderImproveCards(summary);

  if (!state) {
    elements.gameReviewSummary.innerHTML = "<p>开局后自动对比你的出牌与推荐，局末自动记录。</p>";
    if (elements.submitGameReview) elements.submitGameReview.disabled = true;
    return;
  }

  let html = `<p>本局 <strong>${summary.divergenceCount}</strong> 处与推荐不同（共 ${summary.totalHands} 手）。</p>`;
  html += formatVerdictStats(summary, { interactive: true, activeFilter: divergenceVerdictFilter });
  if (summary.divergenceCount > 0) {
    html += renderDivergenceListHtml(divergencesByVerdict(summary, divergenceVerdictFilter));
    const disputeCount = (currentGameMeta?.userDisputes ?? []).length;
    if (disputeCount > 0) {
      html += `<p class="muted">已记录 <strong>${disputeCount}</strong> 条你的意见。</p>`;
    }
  } else if (summary.totalHands > 0) {
    html += "<p class=\"muted\">你与推荐1完全一致，继续保持。</p>";
  }

  const insights = currentGameMeta?.gameInsights ?? [];
  const adoptedInsights = insights.filter((i) => i.verdict === INSIGHT_VERDICTS.ADOPTED);
  const recordedInsights = insights.filter((i) => i.verdict === INSIGHT_VERDICTS.RECORDED);
  const reviewInsights = insights.filter(
    (i) => i.verdict === INSIGHT_VERDICTS.ADOPTED || i.verdict === INSIGHT_VERDICTS.RECORDED,
  );
  if (reviewInsights.length > 0) {
    html += "<div class=\"game-insights-block\">";
    html += "<h4>本局你的意见</h4>";
    html += `<p>已采纳优化 <strong>${adoptedInsights.length}</strong> 条 / 已记录待观察 <strong>${recordedInsights.length}</strong> 条</p>`;
    html += "<ul class=\"game-insights-list\">";
    for (const item of reviewInsights) {
      const status = INSIGHT_STATUS_LABELS[item.verdict] ?? item.verdict;
      const summaryText = item.analysis?.length > 48
        ? `${item.analysis.slice(0, 48)}…`
        : (item.analysis || "—");
      html += `<li class="game-insight-item insight-${item.verdict}">`
        + `<span class="insight-turn">第${item.turnNumber}手</span> `
        + `<span class="insight-user">${escapeHtml(item.question)}</span> `
        + `<span class="insight-reply muted">${escapeHtml(summaryText)}</span> `
        + `<span class="insight-status">${escapeHtml(status)}</span>`
        + "</li>";
    }
    html += "</ul></div>";
  }

  if (submitted) {
    html += "<p><strong>本局已记录</strong>，教练会根据你的打法持续优化。</p>";
  } else if (gameOver) {
    html += "<p class=\"muted\">正在保存本局记录…</p>";
  } else {
    html += "<p class=\"muted\">打完本局后会自动记录复盘。</p>";
  }

  elements.gameReviewSummary.innerHTML = html;
  elements.aiPanel?.classList.toggle("submit-pending", Boolean(gameOver && !submitted));
  elements.aiPanel?.classList.toggle("game-over-review", Boolean(gameOver));
  if (gameOver && elements.progressPanel?.open) {
    elements.progressPanel.open = false;
  }
  if (elements.submitGameReview) {
    elements.submitGameReview.disabled = !gameOver || submitted;
    elements.submitGameReview.textContent = submitted ? "复盘已保存" : "保存复盘";
  }
  if (gameOver && onboardingStep === 3 && !onboardingDone()) {
    renderOnboarding();
  }
}

async function submitGameReview() {
  if (!state || !isGameOver(state) || !currentGameMeta) {
    if (elements.aiStatus) elements.aiStatus.textContent = "本局结束后将自动保存复盘。";
    return;
  }
  if (currentGameMeta.gameReviewSubmitted) {
    if (elements.aiStatus) elements.aiStatus.textContent = "本局复盘已保存过。";
    return;
  }
  if (currentGameMeta.gameReviewSaving) return;

  currentGameMeta.gameReviewSaving = true;
  const submitBtn = elements.submitGameReview;
  const submitBtnLabel = submitBtn?.textContent ?? "保存复盘";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "保存中…";
  }
  if (elements.aiStatus) elements.aiStatus.textContent = "正在保存复盘，请稍候…";

  try {
    await yieldToMainThread();

    const userNote = elements.aiQuestion?.value.trim() ?? "";
    const slimTimeline = (currentGameMeta.coachAdviceTimeline ?? []).map(slimCoachAdviceRecord);
    const payload = buildGameReviewPayload({
      gameSnapshot: slimGameSnapshotForReview(currentGameSnapshot("complete")),
      coachAdviceTimeline: slimTimeline,
      humanPlayerIndex: HUMAN_INDEX,
      matchLevels: matchState?.levels ?? null,
      matchGameNumber: matchState?.gameNumber ?? null,
      userNote,
      userDisputes: currentGameMeta.userDisputes ?? [],
      gameInsights: currentGameMeta.gameInsights ?? [],
    });

    await yieldToMainThread();
    const result = await submitCoachFeedback(payload);
    currentGameMeta.gameReviewSubmitted = true;
    currentGameMeta.gameReviewFeedbackId = result.feedbackId ?? payload.feedbackId ?? null;
    feedbackSubmitCount += result.online ? 1 : 0;

    await yieldToMainThread();
    saveReviewHistoryEntry({
      gameId: currentGameMeta.gameId,
      levelRank: state.levelRank,
      totalHands: payload.divergenceSummary.totalHands,
      divergenceCount: payload.divergenceSummary.divergenceCount,
      divergences: payload.divergenceSummary.divergences,
      coachAdviceTimeline: slimTimeline,
    });
    updateProgressFromReview(payload.divergenceSummary, currentGameMeta.gameId);
    const focusHits = countDrillFocusHits(
      slimTimeline,
      currentGameMeta.drillFocus,
      HUMAN_INDEX,
    );
    if (currentGameMeta.drillFocus) {
      currentGameMeta.drillFocusCompleted = true;
      currentGameMeta.drillFocusHits = focusHits;
      recordDrillSessionFromReview(currentGameMeta, payload.divergenceSummary, { focusHits });
    }
    progressPanelDirty = true;

    if (elements.aiStatus) {
      elements.aiStatus.textContent = result.online
        ? "本局已记录，教练会根据你的打法持续优化。"
        : "本局已暂存到本机，下次启动后会自动同步。";
    }
    if (elements.aiQuestion) elements.aiQuestion.value = "";
    advanceOnboarding(3);
    render();
  } catch (error) {
    console.error("保存复盘失败", error);
    if (elements.aiStatus) {
      elements.aiStatus.textContent = `保存复盘失败：${error.message || error}`;
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtnLabel;
    }
  } finally {
    currentGameMeta.gameReviewSaving = false;
  }
}

function adviceChoices(advice) {
  const seen = new Set();
  const previousPlay = (state?.currentPlayerIndex === HUMAN_INDEX && state.lastActivePlay)
    ? state.lastActivePlay
    : (advice.mustBeat
      ? classifyPlay(advice.mustBeat.cards ?? [], advice.levelRank)
      : null);
  const mustBeat = previousPlay && previousPlay.type !== PLAY_TYPES.pass;
  const isLegalChoice = (choice) => {
    if (!choice?.candidate) return false;
    if (choice.candidate.type === PLAY_TYPES.pass) return true;
    if (!mustBeat) return true;
    const candidate = classifyPlay(choice.candidate.cards ?? [], advice.levelRank);
    return canBeat(candidate, previousPlay);
  };

  const allChoices = [advice.recommendation, ...advice.alternatives].filter((item) => {
    const key = choiceKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).filter(isLegalChoice);
  if (allChoices.length === 0 && mustBeat) {
    const passCandidate = classifyPlay([], advice.levelRank);
    return [{
      candidate: passCandidate,
      score: 0,
      reasons: ["没有能压过的合法出牌，建议过牌"],
    }];
  }
  const selected = [];
  const add = (choice) => {
    if (!choice) return false;
    const key = choiceKey(choice);
    if (selected.some((item) => choiceKey(item) === key)) return false;
    selected.push(choice);
    return true;
  };

  add(allChoices[0]);
  const opening = !mustBeat;
  const firstType = selected[0]?.candidate.type;

  if (selected.length < 3 && firstType === PLAY_TYPES.bomb && mustBeat) {
    const topBombSize = selected[0]?.candidate?.bombSize
      ?? selected[0]?.candidate?.cards?.length
      ?? 4;
    add(allChoices.find((choice) => (
      choice.candidate.type === PLAY_TYPES.bomb
      && choice.candidate.mainRank === selected[0].candidate.mainRank
      && (choice.candidate.bombSize ?? choice.candidate.cards?.length ?? 4) > topBombSize
    )));
  }

  if (opening && firstType === PLAY_TYPES.single) {
    add(readablePairChoice(allChoices, advice.levelRank));
    add(readablePairChoice(allChoices, advice.levelRank, selectedExclusionKeys(selected)));
  }

  if (selected.length < 3) {
    add(allChoices.find((choice) => (
      [PLAY_TYPES.consecutivePairs, PLAY_TYPES.tripleWithPair, PLAY_TYPES.plane, PLAY_TYPES.straight].includes(choice.candidate.type)
      && !choiceUsesWildCard(choice)
    )));
  }

  for (const choice of allChoices) {
    if (selected.length >= 3) break;
    add(choice);
  }

  return selected.slice(0, 3);
}

function choiceKey(choice) {
  const cards = (choice?.candidate?.cards ?? [])
    .map((card) => `${card.rank}-${card.suit}-${card.deckIndex}`)
    .sort()
    .join("|");
  return `${choice?.candidate?.type}:${choice?.candidate?.mainRank}:${cards}`;
}

function choiceRankKey(choice) {
  return `${choice?.candidate?.type}:${choice?.candidate?.mainRank}`;
}

function selectedExclusionKeys(choices) {
  return new Set(choices.flatMap((choice) => [choiceKey(choice), choiceRankKey(choice)]));
}

function choiceUsesWildCard(choice) {
  return (choice?.candidate?.wildcardAssignments ?? []).length > 0;
}

function readablePairChoice(choices, levelRank, excluded = new Set()) {
  const pairChoices = choices
    .filter((choice) => (
      choice.candidate.type === PLAY_TYPES.pair
      && !choiceUsesWildCard(choice)
      && !excluded.has(choiceKey(choice))
      && !excluded.has(choiceRankKey(choice))
    ))
    .sort((left, right) => {
      const leftReadable = readablePairRankScore(left.candidate.mainRank, levelRank);
      const rightReadable = readablePairRankScore(right.candidate.mainRank, levelRank);
      if (leftReadable !== rightReadable) return leftReadable - rightReadable;
      if (left.score !== right.score) return left.score - right.score;
      return rankPower(left.candidate.mainRank, levelRank) - rankPower(right.candidate.mainRank, levelRank);
    });
  return pairChoices[0] ?? null;
}

function readablePairRankScore(rank, levelRank) {
  if (rank === levelRank || rank === "SJ" || rank === "BJ") return 1000;
  const power = rankPower(rank, levelRank);
  const eightPower = rankPower("8", levelRank);
  const jackPower = rankPower("J", levelRank);
  if (power >= eightPower && power <= jackPower) return power - eightPower;
  return 100 + power;
}

function renderChoiceCard(choice, index) {
  const priorityLabels = ["最优", "备选", "谨慎"];
  const reasons = filterReasonsForUser(choice.reasons, "这是当前评分较好的合法选择", {
    play: choice.candidate,
    previousPlay: currentAdvice?.mustBeat ?? null,
    levelRank: state?.levelRank ?? currentAdvice?.levelRank ?? "2",
    choiceIndex: index,
  });
  const button = document.createElement("button");
  button.className = "choice-card";
  button.type = "button";
  button.dataset.adviceIndex = String(index);
  button.setAttribute("aria-label", `推荐${index + 1}：${choice.candidate.label || "过牌"}`);

  const title = document.createElement("span");
  title.className = "choice-title";
  title.innerHTML = `
    <strong>推荐${index + 1}</strong>
    <span class="choice-badge">${priorityLabels[index] ?? "可选"}</span>
  `;
  button.append(title);

  const cards = document.createElement("div");
  cards.className = "choice-cards";
  if (choice.candidate.type === PLAY_TYPES.pass || choice.candidate.cards.length === 0) {
    const pass = document.createElement("span");
    pass.className = "choice-pass";
    pass.textContent = "过牌";
    cards.append(pass);
  } else {
    for (const card of choice.candidate.cards) {
      cards.append(renderCard(card));
    }
  }
  button.append(cards);

  const type = document.createElement("p");
  type.className = "choice-play-type";
  type.textContent = playLabel(choice.candidate);
  button.append(type);

  for (const reason of reasons) {
    const factor = document.createElement("div");
    factor.className = "factor";
    factor.textContent = reason;
    button.append(factor);
  }

  const drillTip = buildDrillAdviceTip(choice, currentGameMeta?.drillFocus);
  if (drillTip) {
    const drillFactor = document.createElement("div");
    drillFactor.className = "factor drill-factor";
    drillFactor.textContent = drillTip;
    button.append(drillFactor);
  }

  return button;
}

function renderHistoryLight(historyItems, coachByTurn) {
  if (elements.historyCount) {
    elements.historyCount.textContent = `${historyItems.length} 手（自动推进中）`;
  }
  if (historyItems.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "开局后这里会记录四家的出牌。";
    elements.history.append(empty);
    return;
  }
  for (const item of [...historyItems].slice(-16).reverse()) {
    const row = document.createElement("div");
    row.className = "history-row";
    row.dataset.handIndex = String(item.turnNumber);
    row.id = `history-hand-${item.turnNumber}`;
    const top1Badge = item.playerIndex === HUMAN_INDEX && isTop1MatchRecord(coachByTurn.get(item.turnNumber))
      ? "<span class=\"history-top1-badge\" title=\"与推荐1一致\">✓</span>"
      : "";
    row.innerHTML = `
      <span><span class="history-hand-index">第 ${item.turnNumber} 手</span> ${PLAYER_NAMES[item.playerIndex]}${top1Badge}</span>
      <span>${item.play.type === PLAY_TYPES.pass ? "不要" : `${playLabel(item.play)} ${cardsLabel(item.play.cards)}`}</span>
    `;
    elements.history.append(row);
  }
}

function renderHistory() {
  elements.history.replaceChildren();
  const historyItems = state ? state.playHistory : [];
  const coachByTurn = new Map(
    (currentGameMeta?.coachAdviceTimeline ?? []).map((record) => [record.turnNumber, record]),
  );
  const trainingReview = shouldShowTrainingReview(state);
  if (trainingReview && isBackgroundAutoPlay()) {
    renderHistoryLight(historyItems, coachByTurn);
    return;
  }
  const reviewRounds = trainingReview ? reviewRoundsForState() : [];
  if (elements.historyPanel && trainingReview) {
    elements.historyPanel.open = true;
  }
  if (elements.historyCount) {
    elements.historyCount.textContent = trainingReview
      ? `${reviewRounds.length} 轮 / ${historyItems.length} 手`
      : `${historyItems.length} 手`;
  }
  if (historyItems.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "开局后这里会记录四家的出牌。";
    elements.history.append(empty);
    return;
  }

  if (trainingReview) {
    for (const round of reviewRounds) {
      const roundNode = document.createElement("section");
      roundNode.className = "history-round";
      const winnerText = round.winnerIndex === null ? "进行中" : `${PLAYER_NAMES[round.winnerIndex]}收回牌权`;
      roundNode.innerHTML = `
        <div class="history-round-title">
          <strong>第 ${round.roundNumber} 轮</strong>
          <span>${winnerText}</span>
        </div>
      `;
      const actions = document.createElement("div");
      actions.className = "history-round-actions";
      for (const item of round.actions) {
        const action = document.createElement("div");
        action.className = `history-action${item.play.type === PLAY_TYPES.pass ? " pass" : ""}`;
        action.dataset.handIndex = String(item.turnNumber);
        action.id = `history-hand-${item.turnNumber}`;
        const label = item.play.type === PLAY_TYPES.pass ? "不要" : playLabel(item.play);
        const top1Badge = item.playerIndex === HUMAN_INDEX && isTop1MatchRecord(coachByTurn.get(item.turnNumber))
          ? "<span class=\"history-top1-badge\" title=\"与推荐1一致\">✓ 打得好</span>"
          : "";
        action.innerHTML = `
          <div class="history-action-meta">
            <span class="history-hand-index">第 ${item.turnNumber} 手</span>
            <strong>${PLAYER_NAMES[item.playerIndex]}</strong>
            <span>${label}</span>${top1Badge}
          </div>
        `;
        const cards = document.createElement("div");
        cards.className = "history-action-cards";
        if (item.play.type === PLAY_TYPES.pass) {
          const pass = document.createElement("span");
          pass.className = "history-pass-badge";
          pass.textContent = "不要";
          cards.append(pass);
        } else {
          for (const card of item.play.cards) {
            cards.append(renderCard(card));
          }
        }
        action.append(cards);
        actions.append(action);
      }
      roundNode.append(actions);
      elements.history.append(roundNode);
    }
    return;
  }

  for (const item of [...historyItems].slice(-24).reverse()) {
    const row = document.createElement("div");
    row.className = "history-row";
    row.dataset.handIndex = String(item.turnNumber);
    row.id = `history-hand-${item.turnNumber}`;
    const top1Badge = item.playerIndex === HUMAN_INDEX && isTop1MatchRecord(coachByTurn.get(item.turnNumber))
      ? "<span class=\"history-top1-badge\" title=\"与推荐1一致\">✓</span>"
      : "";
    row.innerHTML = `
      <span><span class="history-hand-index">第 ${item.turnNumber} 手</span> ${PLAYER_NAMES[item.playerIndex]}${top1Badge}</span>
      <span>${item.play.type === PLAY_TYPES.pass ? "不要" : `${playLabel(item.play)} ${cardsLabel(item.play.cards)}`}</span>
    `;
    elements.history.append(row);
  }
}

function renderControls() {
  const humanTurn = state && state.currentPlayerIndex === HUMAN_INDEX && !isGameOver(state);
  const gameOver = state ? isGameOver(state) : false;
  elements.playSelected.disabled = !humanTurn;
  elements.playRecommended.disabled = !humanTurn || hintAwaiting;
  if (elements.adoptHint) {
    elements.adoptHint.hidden = !humanTurn || !hintShown;
    elements.adoptHint.disabled = !humanTurn || !hintShown;
  }
  elements.passTurn.disabled = !humanTurn || !state?.lastActivePlay;
  elements.sortHand.disabled = !state || gameOver;
  elements.autoGame.disabled = autoGameRunning || !state || gameOver;
  if (elements.autoGame && !autoGameRunning) elements.autoGame.textContent = "自动打完";
  elements.exportLog.disabled = false;
  elements.message.textContent = gameOver
    ? `本局结束。${message}`
    : message;
}

function renderNow({ lite = false } = {}) {
  if (rendering) {
    renderQueued = true;
    renderQueuedLite = renderQueuedLite || lite;
    return;
  }
  rendering = true;
  try {
    const humanTurn = state && state.currentPlayerIndex === HUMAN_INDEX && !isGameOver(state);
    if (!humanTurn && hintShown) clearHint();
    if (!humanTurn) keyPauseOverlay = null;
    else maybeTriggerKeyPause();
    renderMatch();
    renderPlayers();
    renderSeatPlays();
    renderTable();
    renderHand();
    renderKeyPauseBanner();
    renderDrillFocusBanner();
    renderHintBanner();
    renderReportReminderBanner();
    renderAdvice({ computeAdvice: !lite });
    if (lite) {
      // 机器人连推期间跳过复盘面板 DOM 重绘，回到人类回合再刷新
      if (!robotQueueActive) {
        renderGameReviewPanel();
      }
      renderControls();
      if (bootComplete && !robotQueueActive) schedulePersistSession();
      return;
    }
    renderGameReviewPanel();
    renderHistory();
    renderAiChatLog();
    renderFabChatLog();
    renderProgressPanel();
    renderFabQaLimitHint();
    if (selectedDivergenceTurn !== null && !humanCoachRecord(selectedDivergenceTurn)) {
      hideDivergenceDetail();
    }
    renderControls();
    renderOnboarding();
    updateFirstTips();
    if (bootComplete) schedulePersistSession();
  } finally {
    rendering = false;
    if (renderQueued) {
      const queuedLite = renderQueuedLite;
      renderQueued = false;
      renderQueuedLite = false;
      render({ immediate: true, lite: queuedLite });
    }
  }
}

function render({ immediate = false, lite = false } = {}) {
  if (immediate) {
    if (renderFrameId !== null) {
      cancelAnimationFrame(renderFrameId);
      renderFrameId = null;
    }
    renderNow({ lite });
    return;
  }
  if (renderFrameId !== null) return;
  renderFrameId = requestAnimationFrame(() => {
    renderFrameId = null;
    renderNow({ lite });
  });
}

document.addEventListener("click", (event) => {
  const verdictTab = event.target.closest(".verdict-stat[data-verdict]");
  if (verdictTab) {
    event.preventDefault();
    const nextFilter = verdictTab.dataset.verdict;
    if (nextFilter && nextFilter !== divergenceVerdictFilter) {
      divergenceVerdictFilter = nextFilter;
      renderGameReviewPanel();
    }
    return;
  }

  const drillPracticeBtn = event.target.closest(".drill-practice-btn[data-drill-tag]");
  if (drillPracticeBtn) {
    event.preventDefault();
    startDrillPractice(drillPracticeBtn.dataset.drillTag);
    return;
  }

  const reviewHistoryItem = event.target.closest(".review-history-item[data-game-id]");
  if (reviewHistoryItem) {
    event.preventDefault();
    toggleReviewHistoryGame(reviewHistoryItem.dataset.gameId);
    return;
  }

  const savedImproveCard = event.target.closest(".saved-improve-card[data-game-id][data-hand-index]");
  if (savedImproveCard) {
    event.preventDefault();
    showSavedDivergenceDetail(savedImproveCard.dataset.gameId, Number(savedImproveCard.dataset.handIndex));
    return;
  }

  const improveCard = event.target.closest(".improve-card[data-hand-index]:not(.saved-improve-card)");
  if (improveCard) {
    event.preventDefault();
    showDivergenceDetail(Number(improveCard.dataset.handIndex));
    return;
  }

  const disputeSubmitBtn = event.target.closest(".dispute-submit-btn[data-dispute-turn]");
  if (disputeSubmitBtn) {
    event.preventDefault();
    event.stopPropagation();
    submitUserDisputeFromUI(Number(disputeSubmitBtn.dataset.disputeTurn));
    return;
  }

  const disputeBtn = event.target.closest(".dispute-btn[data-dispute-turn]");
  if (disputeBtn) {
    event.preventDefault();
    event.stopPropagation();
    showDivergenceDetail(Number(disputeBtn.dataset.disputeTurn));
    const textarea = document.querySelector(`#dispute-rationale-${disputeBtn.dataset.disputeTurn}`);
    textarea?.focus();
    return;
  }

  const divergenceItem = event.target.closest(".divergence-item[data-hand-index]");
  if (divergenceItem && !event.target.closest(".dispute-btn, .dispute-submit-btn")) {
    event.preventDefault();
    showDivergenceDetail(Number(divergenceItem.dataset.handIndex));
    return;
  }

  const target = event.target.closest("button");
  if (!target || target.disabled) return;
  if (target.dataset.bound === "1") return;
  if (target.dataset.adviceIndex !== undefined && !target.closest(".divergence-detail")) {
    playAdviceChoice(Number(target.dataset.adviceIndex));
  }
});

document.addEventListener("keydown", (event) => {
  if (!(event.target instanceof Element)) return;
  const reviewHistoryItem = event.target.closest(".review-history-item[data-game-id]");
  if (reviewHistoryItem && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    toggleReviewHistoryGame(reviewHistoryItem.dataset.gameId);
    return;
  }

  const savedImproveCard = event.target.closest(".saved-improve-card[data-game-id][data-hand-index]");
  if (savedImproveCard && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    showSavedDivergenceDetail(savedImproveCard.dataset.gameId, Number(savedImproveCard.dataset.handIndex));
    return;
  }

  const improveCard = event.target.closest(".improve-card[data-hand-index]:not(.saved-improve-card)");
  if (improveCard && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    showDivergenceDetail(Number(improveCard.dataset.handIndex));
    return;
  }
  const divergenceItem = event.target.closest(".divergence-item[data-hand-index]");
  if (!divergenceItem || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  showDivergenceDetail(Number(divergenceItem.dataset.handIndex));
});

elements.aiQuestion?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    askAiCoach();
  }
});

elements.coachFabQuestion?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    askFabCoach();
  }
});

elements.coachFabBackdrop?.addEventListener("click", () => setCoachFabOpen(false));

MOBILE_LAYOUT_MQ?.addEventListener("change", () => {
  if (coachFabOpen) syncCoachFabMobileChrome(true);
});

elements.importReplayFiles?.addEventListener("change", async (event) => {
  const files = event.target.files;
  if (!files?.length) return;
  await importExternalReplayFiles(files);
  event.target.value = "";
});

function onKeyPauseToggle() {
  keyPauseEnabled = !!elements.useKeyPause?.checked;
  safeSetItem(KEY_PAUSE_STORAGE, keyPauseEnabled ? "1" : "0");
  if (!keyPauseEnabled) dismissKeyPause();
  message = keyPauseEnabled ? "已开启关键时刻暂停：高价值决策点会先让你想一想。" : "已关闭关键时刻暂停。";
  render();
}

function onMlPolicyToggle() {
  useMlPolicy = !!elements.useMlPolicy?.checked;
  safeSetItem(ML_TOGGLE_STORAGE, useMlPolicy ? "1" : "0");
  message = useMlPolicy
    ? (mlPolicyModel
      ? "已开启 ML 智能融合：压牌加权、接风/开局不推连炸。"
      : "已开启 ML，但模型文件未加载。")
    : "已切换为纯规则推荐。";
  render();
}

function bindPrimaryActions() {
  const actions = [
    ["newGame", newGame],
    ["newMatch", newCompetitiveMatch],
    ["nextMatchGame", nextCompetitiveGame],
    ["autoGame", autoGame],
    ["playSelected", playSelected],
    ["playRecommended", playRecommended],
    ["adoptHint", adoptHint],
    ["passTurn", passTurn],
    ["sortHand", sortHumanHand],
    ["exportLog", exportLog],
    ["saveTrainingSample", saveTrainingSample],
    ["selfTrain", runSelfTraining],
    ["copyLog", copyExportLog],
    ["askAiCoach", askAiCoach],
    ["submitGameReview", submitGameReview],
    ["clearAiChat", clearAiChat],
    ["coachFab", toggleCoachFab],
    ["coachFabClose", () => setCoachFabOpen(false)],
    ["coachFabSend", askFabCoach],
    ["coachFabObjection", askFabCoachObjection],
    ["rulesBtn", toggleRulesDrawer],
    ["rulesClose", () => setRulesDrawerOpen(false)],
    ["openDrillPanel", openDrillPracticePanel],
  ];
  for (const [id, handler] of actions) {
    const node = elements[id];
    if (!node || node.dataset.bound === "1") continue;
    node.dataset.bound = "1";
    node.addEventListener("click", (event) => {
      event.preventDefault();
      if (node.disabled) return;
      handler();
    });
  }
  if (elements.importReplayBtn && elements.importReplayBtn.dataset.bound !== "1") {
    elements.importReplayBtn.dataset.bound = "1";
    elements.importReplayBtn.addEventListener("click", (event) => {
      event.preventDefault();
      elements.importReplayFiles?.click();
    });
  }
  if (elements.useMlPolicy && elements.useMlPolicy.dataset.bound !== "1") {
    elements.useMlPolicy.dataset.bound = "1";
    elements.useMlPolicy.addEventListener("change", onMlPolicyToggle);
  }
  if (elements.useKeyPause && elements.useKeyPause.dataset.bound !== "1") {
    elements.useKeyPause.dataset.bound = "1";
    elements.useKeyPause.addEventListener("change", onKeyPauseToggle);
  }
  if (elements.keyPauseBanner && elements.keyPauseBanner.dataset.bound !== "1") {
    elements.keyPauseBanner.dataset.bound = "1";
    elements.keyPauseBanner.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-key-pause-action]");
      if (!btn || elements.keyPauseBanner.hidden) return;
      event.preventDefault();
      if (btn.dataset.keyPauseAction === "think") dismissKeyPause();
      else if (btn.dataset.keyPauseAction === "hint") keyPauseShowHint();
    });
  }
  if (elements.rulesBackdrop && elements.rulesBackdrop.dataset.bound !== "1") {
    elements.rulesBackdrop.dataset.bound = "1";
    elements.rulesBackdrop.addEventListener("click", () => setRulesDrawerOpen(false));
  }
  const dialogActions = [
    [elements.submitAndNext, submitAndContinueNext],
    [elements.skipSubmitNext, skipSubmitAndContinueNext],
    [elements.cancelSubmitNext, closeSubmitReminderDialog],
    [elements.onboardingSkip, skipOnboarding],
    [elements.firstTipDismiss, dismissCurrentFirstTip],
    [elements.firstTipSkipAll, skipAllFirstTips],
  ];
  for (const [node, handler] of dialogActions) {
    if (!node || node.dataset.bound === "1") continue;
    node.dataset.bound = "1";
    node.addEventListener("click", (event) => {
      event.preventDefault();
      handler();
    });
  }
  if (elements.submitReminderDialog && elements.submitReminderDialog.dataset.bound !== "1") {
    elements.submitReminderDialog.dataset.bound = "1";
    elements.submitReminderDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeSubmitReminderDialog();
    });
  }
  if (!window.__guandanCoachResizeBound) {
    window.__guandanCoachResizeBound = true;
    window.addEventListener("resize", () => {
      if (!onboardingDone() && onboardingStep > 0) renderOnboarding();
    });
  }
}

function reportBootError(error) {
  console.error(error);
  const text = error?.message ? String(error.message) : String(error);
  if (elements.message) {
    elements.message.textContent = `页面脚本异常：${text}（可尝试 Ctrl+F5 强刷，或换 Chrome 打开）`;
  }
}

window.addEventListener("error", (event) => reportBootError(event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => reportBootError(event.reason));

bindPrimaryActions();

function formatBootMessage(baseMessage = "") {
  const mlNote = useMlPolicy
    ? (mlPolicyModel ? " ML 模型已加载。" : " ML 已开但模型未加载，请用 cmd 启动。")
    : " 当前为纯规则推荐。";
  return `${baseMessage || "就绪。"}${mlNote}`;
}

async function bootApp() {
  const repaired = scanAndRepairGuandanStorage();
  if (repaired.length > 0) {
    console.warn("已清除损坏的 localStorage 项：", repaired);
  }

  try {
    await withTimeout(loadMlPolicyModel(), 8000, "加载 ML 模型");
  } catch (error) {
    console.warn("ML 模型加载跳过", error);
    mlPolicyModel = null;
  }

  let restored = false;
  if (isSafeBootFromUrl()) {
    await clearPersistedSessionDual();
    message = "安全模式：已跳过恢复存档。点「新开一局」即可继续；正常恢复请去掉 URL 的 ?safe=1。";
  } else if (isSafeBootMode()) {
    // localStorage 安全标记：仅跳过 8787 远程，仍尝试本地合法存档
    try {
      restored = await tryRestoreSession({ localOnly: true });
      if (!restored) {
        await clearPersistedSessionRemote();
        if (message !== INVALID_SESSION_MESSAGE) {
          resetToCleanWaitingState();
          message = INVALID_SESSION_MESSAGE;
        }
        markSafeBootMode();
      }
    } catch (error) {
      console.error("本地恢复失败", error);
      await clearPersistedSessionRemote();
      resetToCleanWaitingState();
      markSafeBootMode();
      message = `恢复存档失败（${error.message || "超时"}），已跳过。可加 ?safe=1 强制安全启动，或点「新开一局」。`;
    }
  } else {
    try {
      restored = await tryRestoreSession();
      if (!restored && message === INVALID_SESSION_MESSAGE) {
        markSafeBootMode();
      }
    } catch (error) {
      console.error("启动恢复失败", error);
      await clearPersistedSessionDual();
      resetToCleanWaitingState();
      markSafeBootMode();
      message = `恢复存档失败（${error.message || "超时"}），已跳过。可加 ?safe=1 强制安全启动，或点「新开一局」。`;
    }
  }

  initOnboarding();
  const activeRestored = restored && state && !isGameOver(state);
  render({ immediate: true, lite: activeRestored });
  if (elements.message) elements.message.textContent = formatBootMessage(message);
  bootComplete = true;
  if (globalThis.__GUANDAN_BUILD__ && elements.message) {
    const buildNote = `构建 ${globalThis.__GUANDAN_BUILD__}`;
    if (!elements.message.textContent.includes(buildNote)) {
      elements.message.textContent = `${elements.message.textContent} · ${buildNote}`;
    }
  }
  // 损坏档跳过恢复后保留 safe-boot 标记，避免刷新再次从 8787 拉回坏档
  if (restored || isSafeBootFromUrl()) {
    clearSafeBootMode();
  }

  probeAiBridgeStatus();
  updateFirstTips();
  if (activeRestored) {
    scheduleDeferredPanelsRender();
    if (kickStuckSession()) {
      render({ immediate: true, lite: true });
      if (elements.message) elements.message.textContent = formatBootMessage(message);
    }
    if (state.currentPlayerIndex === HUMAN_INDEX) {
      scheduleHumanAdviceRefresh();
    } else {
      queueRobotTurns();
    }
  } else if (restored) {
    scheduleDeferredPanelsRender();
  }
}

bootApp().catch((error) => reportBootError(error));

function persistSessionOnPageExit() {
  const snapshot = buildSessionSnapshot();
  if (!snapshot || !isSessionPersistable(snapshot)) return;
  const compact = compactSessionForPersist(snapshot);
  savePersistedSession(compact);
  void savePersistedSessionRemote(compact);
}

window.addEventListener("beforeunload", persistSessionOnPageExit);
window.addEventListener("pagehide", persistSessionOnPageExit);
