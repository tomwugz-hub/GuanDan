import {
  PLAY_TYPES,
  cardId,
  cardLabel,
  cardsLabel,
  resolvePlayCardsFromHand,
  playUsesOnlyHandCards,
  playSignature,
  classifyPlay,
  createCompetitiveMatch,
  createInitialGameState,
  finishCompetitiveGame,
  buildStrategicGroups,
  mergePremiumStrategicGroups,
  evaluateHandProfile,
  groupPlayHistoryByRound,
  getTurnAdvice,
  buildEngineFacts,
  buildGameReviewPayload,
  summarizeGameDivergences,
  isHumanReplayRecord,
  DIVERGENCE_VERDICTS,
  verdictUiLabel,
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
import { opponentsPendingAfterPlayer, effectivePreviousPlay, isCatchWindPending, resolveTrickLeaderIndex } from "../engine/game-state.mjs";
import { isTeammate } from "../strategy/seat-utils.mjs";
import { partnerLeadNeedsGuard } from "../strategy/table-context.mjs";
import { dedupeKey } from "../tools/lib/dedupe-key.mjs";
import { messageTimestamp } from "../tools/lib/message-timestamp.mjs";
import { TRIAL_PLAY_VERSION, TRIAL_FEEDBACK } from "./trial-config.mjs";
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
  formatLearningPoints,
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
  DRILL_TAGS,
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
import { fastRobotFallback, humanAdviceFallback, ROBOT_LITE_MAX_CANDIDATES, ROBOT_STEP_DEADLINE_MS } from "../coach/robot-player.mjs";
import { COACH_STRATEGY_REVISION } from "../strategy/sf-runway-guard.mjs";
import { buildFormalRobotPlayOptions } from "../simulation/opponent-persona.mjs";

const REQUIRED_STRATEGY_REVISION = 6;

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
/** 手机横屏 touch 理牌拖拽态 */
let mobileHandDrag = null;
let mobileHandDragTimer = null;
let suppressCardClick = false;
let freeWildCardIds = new Set();
let handColumnIds = null;
let pendingCardClickTimer = null;
let pendingCardClickAction = null;
/** 列顶向下滑选手势：最小垂直位移（px） */
const COLUMN_SWIPE_MIN_DOWN = 40;
/** 列顶向下滑选手势：允许的最大水平偏移（px） */
const COLUMN_SWIPE_MAX_HORIZONTAL = 32;
/** 手机横屏手工理牌：长按触发拖拽（ms） */
const ML_DRAG_LONG_PRESS_MS = 400;
/** 手机横屏手工理牌：短触/横滑与拖拽区分阈值（px） */
const ML_DRAG_MOVE_THRESHOLD = 12;
const ML_REORDER_TIP_STORAGE = "guandan-coach-pro-mobile-reorder-tip-v1";
let matchState = null;
let matchSettledTurnNumber = null;
let aiChatTimeline = [];

const ML_TOGGLE_STORAGE = "guandan-coach-use-ml";
const KEY_PAUSE_STORAGE = "guandan-coach-pro-key-pause";
const ONBOARDING_STORAGE = "guandan-coach-onboarding-v2";
/** 单项功能首次说明（onboarding 完成后展示，不重复三步引导） */
const FIRST_TIPS_STORAGE = "guandan-coach-pro-first-tips-v1";
/** 新手引导总开关；默认关，可在菜单勾选「新手引导」开启 */
const GUIDE_ENABLED_STORAGE = "guandan-coach-pro-guide-enabled-v1";
/** 浮动问教练每局次数上限；0 表示不限 */
const FAB_QA_LIMIT_PER_GAME = 0;
/** 窄屏布局断点，与 mobile-ui.css @media (max-width: 932px) 一致（含 iPhone 横屏 932px） */
const MOBILE_LAYOUT_MQ = typeof window !== "undefined"
  ? window.matchMedia("(max-width: 932px)")
  : null;
const MOBILE_PORTRAIT_MQ = typeof window !== "undefined"
  ? window.matchMedia("(max-width: 932px) and (orientation: portrait)")
  : null;
const MOBILE_LANDSCAPE_MQ = typeof window !== "undefined"
  ? window.matchMedia("(max-width: 932px) and (orientation: landscape)")
  : null;
const MOBILE_ORIENTATION_PORTRAIT_MQ = typeof window !== "undefined"
  ? window.matchMedia("(orientation: portrait)")
  : null;
const MOBILE_PORTRAIT_DISMISS_STORAGE = "guandan-coach-pro-portrait-dismiss-v1";
const MOBILE_A2HS_DISMISS_STORAGE = "guandan-coach-pro-a2hs-dismiss-v1";
/** 手机竖屏：显示旋转提示；用户可点「仍要竖屏玩」跳过 */
let coachFabOpen = false;
let mobileMenuOpen = false;
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
let feedbackSubmitCount = 0;
let persistSessionTimer = null;
let hintShown = false;
/** 用户点了「提示」但 advice 仍在异步计算中 */
let hintAwaiting = false;
let hintAdvice = null;
let hintCardIds = new Set();
/** 局末复盘 overlay 是否已被用户关闭（新开一局时重置） */
let gameReviewOverlayDismissed = false;
let onboardingStep = 0;
/** 复盘差异列表当前筛选分类（默认「建议学习点」） */
let divergenceVerdictFilter = DIVERGENCE_VERDICTS.COACH_BETTER;
let renderFrameId = null;
let rendering = false;
let renderQueued = false;
let renderQueuedLite = false;
let bootComplete = false;
let robotQueueGeneration = 0;
let robotQueueTimer = null;
let robotQueueWatchdog = null;
/** 机器人队列步间间隔（ms）；0 = 尽快推进，每手 setTimeout(0) 让出主线程 */
const ROBOT_QUEUE_DELAY_MS = 0;
/** 队列 watchdog：单步未在时限内完成则兜底过牌（须小于浏览器无响应阈值） */
const ROBOT_QUEUE_TIMEOUT_MS = 2800;
/** 单步机器人计算超过此阈值（ms）时打警告 */
const ROBOT_STEP_SLOW_MS = 500;
/** 严格每手一步；批内不连推，主线程必须喘息 */
const ROBOT_BATCH_MAX_STEPS = 1;
let robotQueueActive = false;
/** 队列超时兜底触发后，侧栏展示走牌超时提示 */
let robotQueueTimedOut = false;
/** 当前机器人队列开始时刻（performance.now），用于停滞检测 */
let robotQueueStartedAt = 0;
/** 侧栏停滞超过此秒数则强制兜底（不展示累加秒数，避免「已延迟30秒」） */
const ROBOT_STALL_RECOVER_SEC = 2;
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
  mobileTable: document.querySelector("#mobileTable"),
  centerActions: document.querySelector("#centerActions"),
  centerTurnHint: document.querySelector("#centerTurnHint"),
  handFan: document.querySelector("#handFan"),
  portraitBlocker: document.querySelector("#portraitBlocker"),
  portraitBlockerDismiss: document.querySelector("#portraitBlockerDismiss"),
  portraitBlockerReview: document.querySelector("#portraitBlockerReview"),
  mobileA2hsHint: document.querySelector("#mobileA2hsHint"),
  mobileA2hsText: document.querySelector("#mobileA2hsText"),
  mobileA2hsClose: document.querySelector("#mobileA2hsClose"),
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
  mobileAdviceStrip: document.querySelector("#mobileAdviceStrip"),
  keyPauseBanner: document.querySelector("#keyPauseBanner"),
  passTurn: document.querySelector("#passTurn"),
  playDockActions: document.querySelector(".table-action-dock .actions"),
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
  mobileDrillPracticeList: document.querySelector("#mobileDrillPracticeList"),
  mobileDrillPanel: document.querySelector("#mobileDrillPanel"),
  mobileOpenDrill: document.querySelector("#mobileOpenDrill"),
  drillFocusBanner: document.querySelector("#drillFocusBanner"),
  openDrillPanel: document.querySelector("#openDrillPanel"),
  startMustBeatSfDrill: document.querySelector("#startMustBeatSfDrill"),
  mobileStartMustBeatSfDrill: document.querySelector("#mobileStartMustBeatSfDrill"),
  rulesBtn: document.querySelector("#rulesBtn"),
  rulesDrawer: document.querySelector("#rulesDrawer"),
  rulesBackdrop: document.querySelector("#rulesBackdrop"),
  rulesClose: document.querySelector("#rulesClose"),
  firstTipBar: document.querySelector("#firstTipBar"),
  firstTipText: document.querySelector("#firstTipText"),
  firstTipDismiss: document.querySelector("#firstTipDismiss"),
  firstTipSkipAll: document.querySelector("#firstTipSkipAll"),
  landscapeRoot: document.querySelector("#landscapeRoot"),
  mlSeats: document.querySelector("#mlSeats"),
  mlSeatPlays: document.querySelector("#mlSeatPlays"),
  mlHand: document.querySelector("#mlHand"),
  mlTurnCaption: document.querySelector("#mlTurnCaption"),
  mlCenter: document.querySelector("#mlCenter"),
  mlNewGame: document.querySelector("#mlNewGame"),
  mlPassTurn: document.querySelector("#mlPassTurn"),
  mlPlayRecommended: document.querySelector("#mlPlayRecommended"),
  mlPlaySelected: document.querySelector("#mlPlaySelected"),
  mlSortHand: document.querySelector("#mlSortHand"),
  mlCoachFab: document.querySelector("#mlCoachFab"),
  mlHudTeammate: document.querySelector("#mlHudTeammate"),
  mlHudAdvice: document.querySelector("#mlHudAdvice"),
  mlKeyPauseBanner: document.querySelector("#mlKeyPauseBanner"),
  mlHintBanner: document.querySelector("#mlHintBanner"),
  dismissGameReview: document.querySelector("#dismissGameReview"),
  reviewRotateHint: document.querySelector("#reviewRotateHint"),
  mlBanners: document.querySelector("#mlBanners"),
  mobileRulesHud: document.querySelector("#mobileRulesHud"),
  mobileTopBar: document.querySelector("#mobileTopBar"),
  mobileLevelRank: document.querySelector("#mobileLevelRank"),
  mobileOurLevel: document.querySelector("#mobileOurLevel"),
  mobileTheirLevel: document.querySelector("#mobileTheirLevel"),
  mobileTurnChip: document.querySelector("#mobileTurnChip"),
  mobileTrialVersion: document.querySelector("#mobileTrialVersion"),
  mobileMenuBtn: document.querySelector("#mobileMenuBtn"),
  mobileMenuBackdrop: document.querySelector("#mobileMenuBackdrop"),
  mobileMenuDrawer: document.querySelector("#mobileMenuDrawer"),
  mobileMenuClose: document.querySelector("#mobileMenuClose"),
  mobileMenuStatus: document.querySelector("#mobileMenuStatus"),
  mobileLevelSelect: document.querySelector("#mobileLevelSelect"),
  mobileNewGame: document.querySelector("#mobileNewGame"),
  mobileNewMatch: document.querySelector("#mobileNewMatch"),
  mobileNextMatch: document.querySelector("#mobileNextMatch"),
  mobileViewReview: document.querySelector("#mobileViewReview"),
  mobileRules: document.querySelector("#mobileRules"),
  mobileImport: document.querySelector("#mobileImport"),
  mobileExport: document.querySelector("#mobileExport"),
  mobileTrialFeedback: document.querySelector("#mobileTrialFeedback"),
  mobileKeyPause: document.querySelector("#mobileKeyPause"),
  mobileMlPolicy: document.querySelector("#mobileMlPolicy"),
  mobileGuideTips: document.querySelector("#mobileGuideTips"),
  coachSheetAdvice: document.querySelector("#coachSheetAdvice"),
};

if (elements.useMlPolicy) elements.useMlPolicy.checked = useMlPolicy;
if (elements.useKeyPause) elements.useKeyPause.checked = keyPauseEnabled;
if (elements.mobileMlPolicy) elements.mobileMlPolicy.checked = useMlPolicy;
if (elements.mobileKeyPause) elements.mobileKeyPause.checked = keyPauseEnabled;
if (elements.mobileGuideTips) elements.mobileGuideTips.checked = guidesEnabled();

function isTouchMobileDevice() {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(pointer: coarse)").matches) return true;
    if (window.matchMedia("(hover: none)").matches) return true;
  } catch {
    /* 部分 WebView 不支持 pointer/hover 查询 */
  }
  return (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
}

/** 明显桌面 UA（Windows/macOS/Linux 且无 Mobile 标记），用于过滤触控大屏 PC 窄窗误触 */
function isObviousDesktopUa() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Windows NT|Macintosh|CrOS|Linux x86_64|Linux i686/.test(ua)
    && !/Mobile|Android|iPhone|iPad|iPod|Tablet/i.test(ua);
}

/** 手机/平板 UA（隧道外网试玩优先识别） */
function isMobileUa() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini|MicroMessenger/i.test(ua);
}

/** 细指针（鼠标/trackpad）桌面：永不走手机横屏 DOM */
function isFinePointerDesktop() {
  if (typeof window === "undefined") return true;
  try {
    return window.matchMedia("(pointer: fine)").matches;
  } catch {
    return true;
  }
}

/** 窄屏视口：≤932px 或横屏手机典型矮视口（高度 ≤520px） */
function isNarrowMobileViewport() {
  if (typeof window === "undefined") return false;
  if (MOBILE_LAYOUT_MQ?.matches ?? false) return true;
  try {
    if (window.matchMedia("(orientation: landscape) and (max-height: 520px)").matches) return true;
    if (isMobileUa() && window.matchMedia("(orientation: landscape) and (max-width: 960px)").matches) {
      return true;
    }
  } catch {
    /* 部分 WebView 不支持 orientation 查询 */
  }
  return false;
}

/**
 * 手机横屏布局：窄屏（≤932px）+ 手机 UA / 触控 / 粗指针 任一。
 * 隧道手机 UA 优先；细指针 PC 窄窗仍走 desktop-shell。
 */
function isMobileLayout() {
  if (typeof window === "undefined") return false;
  const narrow = isNarrowMobileViewport();
  if (!narrow) return false;
  if (isMobileUa()) return true;
  try {
    if (window.matchMedia("(max-width: 932px) and (any-pointer: coarse)").matches) return true;
    if (window.matchMedia("(max-width: 932px) and (pointer: coarse)").matches) return true;
  } catch {
    /* ignore */
  }
  if ((typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0) > 0 && !isObviousDesktopUa()) {
    return true;
  }
  if (isTouchMobileDevice()) {
    if (isObviousDesktopUa()) return false;
    return true;
  }
  if (isFinePointerDesktop()) return false;
  return false;
}

/** 手机竖屏（含触控大屏竖屏） */
function isMobilePortraitMode() {
  if (!isMobileLayout()) return false;
  if (MOBILE_ORIENTATION_PORTRAIT_MQ?.matches ?? false) return true;
  return MOBILE_PORTRAIT_MQ?.matches ?? false;
}

/** 手机横屏 DOM 已由 bootMobileLayout 点亮（与 isMobileLayout 判定兜底对齐） */
function isMobileLandscapeDomActive() {
  if (typeof document === "undefined") return false;
  return document.body.classList.contains("mobile-layout")
    && document.body.classList.contains("mobile-landscape")
    && elements.landscapeRoot
    && !elements.landscapeRoot.hidden;
}

/** 手机横屏牌桌模式（竞品式布局） */
function isMobileLandscape() {
  if (isMobileLandscapeDomActive()) return true;
  return isMobileLayout() && !isMobilePortraitMode();
}

function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return Boolean(window.navigator.standalone);
}

/** Android 等 env(safe-area-inset-*) 为 0 时，用 visualViewport 间隙估算手势条高度 */
function syncMobileSafeInsets() {
  if (!isMobileLayout() || typeof document === "undefined") return;
  const root = document.documentElement;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isAndroid = /Android/i.test(ua);
  let gestureMin = isAndroid ? 20 : 0;
  const vv = window.visualViewport;
  if (vv) {
    const vvGap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    gestureMin = Math.max(gestureMin, vvGap);
  }
  root.style.setProperty("--safe-gesture-min", `${Math.round(gestureMin)}px`);
}

/** 同步 visualViewport 高度，消化移动端地址栏伸缩 */
function syncMobileViewportHeight() {
  if (!isMobileLayout() || typeof document === "undefined") return;
  syncMobileSafeInsets();
  const vv = window.visualViewport;
  const height = vv?.height ?? window.innerHeight;
  if (height > 0) {
    const px = `${Math.round(height)}px`;
    document.documentElement.style.setProperty("--app-vh", px);
    if (elements.landscapeRoot) {
      elements.landscapeRoot.style.height = px;
      elements.landscapeRoot.style.maxHeight = px;
      elements.landscapeRoot.style.minHeight = px;
    }
  }
}

let mobileFullscreenTried = false;

/** 首次用户手势尝试全屏（需浏览器允许；失败则静默） */
function tryMobileFullscreen() {
  if (mobileFullscreenTried || !isMobileLayout() || isStandaloneDisplayMode()) return;
  mobileFullscreenTried = true;
  const root = document.documentElement;
  const req = root.requestFullscreen?.()
    ?? root.webkitRequestFullscreen?.()
    ?? root.webkitEnterFullscreen?.();
  if (req && typeof req.catch === "function") req.catch(() => {});
}

function syncMobileThemeColor() {
  if (typeof document === "undefined") return;
  const meta = document.querySelector('meta[name="theme-color"][data-mobile-felt]')
    ?? document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  meta.setAttribute("content", isMobileLayout() ? "#124830" : "#e8efe6");
}

function renderMobileA2hsHint() {
  const hint = elements.mobileA2hsHint;
  if (!hint) return;
  const mobile = isMobileLayout();
  const dismissed = safeGetItem(MOBILE_A2HS_DISMISS_STORAGE, "") === "1";
  const portraitDismissed = safeGetItem(MOBILE_PORTRAIT_DISMISS_STORAGE, "") === "1";
  const showPortraitBlocker = mobile
    && isMobilePortraitMode()
    && !portraitDismissed;
  const show = mobile
    && !dismissed
    && !isStandaloneDisplayMode()
    && isMobileLandscape()
    && !showPortraitBlocker;
  hint.hidden = !show;
  if (!show || !elements.mobileA2hsText) return;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  elements.mobileA2hsText.textContent = isIOS
    ? "Safari：分享 →「添加到主屏幕」可隐藏地址栏全屏玩"
    : "Chrome：菜单 →「添加到主屏幕」或「安装应用」可全屏玩";
}

function activePlayersEl() {
  return isMobileLandscape() ? elements.mlSeats : elements.players;
}

function activeSeatPlaysEl() {
  return isMobileLandscape() ? elements.mlSeatPlays : elements.seatPlays;
}

function activeHandEl() {
  return isMobileLandscape() ? elements.mlHand : elements.hand;
}

/** 细指针桌面：清空手机横屏骨架，避免叠在牌桌上 */
function purgeMobileLandscapeDom() {
  if (elements.landscapeRoot) elements.landscapeRoot.hidden = true;
  if (elements.mlHand) elements.mlHand.replaceChildren();
  if (elements.mlSeats) elements.mlSeats.replaceChildren();
  if (elements.mlSeatPlays) elements.mlSeatPlays.replaceChildren();
}

/** 手机模式：禁止 desktop #hand 残留竖列牌 */
function purgeDesktopHandOnMobile() {
  if (!isMobileLayout() || !elements.hand) return;
  elements.hand.replaceChildren();
  elements.hand.classList.remove("hand-fan");
  elements.hand.ondragover = null;
  elements.hand.ondrop = null;
}

function mirrorMobileBanner(desktopEl, mobileEl) {
  if (!mobileEl) return;
  if (!isMobileLandscape() || !desktopEl || desktopEl.hidden) {
    mobileEl.hidden = true;
    mobileEl.replaceChildren();
    return;
  }
  mobileEl.hidden = false;
  mobileEl.innerHTML = desktopEl.innerHTML;
}

function isGameReviewOverlayOpen() {
  return Boolean(
    state
    && isGameOver(state)
    && !gameReviewOverlayDismissed,
  );
}

function syncMobileLayoutClass() {
  const mobile = isMobileLayout();
  const portrait = mobile && isMobilePortraitMode();
  const landscape = mobile && !portrait;
  const portraitDismissed = safeGetItem(MOBILE_PORTRAIT_DISMISS_STORAGE, "") === "1";
  const mobileReview = mobile && isGameReviewOverlayOpen();
  document.documentElement.classList.toggle("mobile-layout", mobile);
  document.body.classList.toggle("mobile-layout", mobile);
  document.body.classList.toggle("mobile-landscape", landscape);
  document.body.classList.toggle("mobile-portrait", portrait && !portraitDismissed && !mobileReview);
  document.body.classList.toggle("mobile-portrait-review", mobileReview);
  syncMobileThemeColor();
  if (elements.portraitBlocker) {
    elements.portraitBlocker.hidden = !portrait || portraitDismissed || mobileReview;
  }
  if (elements.reviewRotateHint) {
    elements.reviewRotateHint.hidden = !(landscape && mobileReview);
  }
  if (!mobile) {
    purgeMobileLandscapeDom();
    setMobileMenuOpen(false);
    setCoachFabOpen(false);
    document.body.classList.remove("mobile-menu-open", "coach-fab-open");
    document.documentElement.classList.remove("mobile-boot", "mobile-landscape-boot");
    document.documentElement.style.removeProperty("--app-vh");
    if (elements.landscapeRoot) {
      elements.landscapeRoot.style.removeProperty("height");
      elements.landscapeRoot.style.removeProperty("max-height");
      elements.landscapeRoot.style.removeProperty("min-height");
    }
    if (elements.mobileA2hsHint) elements.mobileA2hsHint.hidden = true;
    return;
  }
  document.documentElement.classList.toggle("mobile-boot", true);
  document.documentElement.classList.toggle("mobile-landscape-boot", landscape);
  purgeDesktopHandOnMobile();
  if (elements.landscapeRoot) elements.landscapeRoot.hidden = !landscape;
  syncMobileViewportHeight();
  syncMobileHandMetrics();
  syncMobileSeatPlayMetrics();
  syncMobileActionBandMetrics();
  renderMobileA2hsHint();
  if (portrait && !portraitDismissed) {
    setMobileMenuOpen(false);
    setCoachFabOpen(false);
  }
}

let lastMobileLandscapeActive = false;

/** 同步手机横屏布局（启动时与 resize/orientation 变更时调用） */
function syncMobileLayout() {
  const wasLandscape = lastMobileLandscapeActive;
  syncMobileLayoutClass();
  const nowLandscape = isMobileLandscape();
  lastMobileLandscapeActive = nowLandscape;
  if (bootComplete && wasLandscape !== nowLandscape) {
    render({ immediate: true });
  }
}

function setMobileMenuOpen(open) {
  mobileMenuOpen = open;
  if (elements.mobileMenuBackdrop) elements.mobileMenuBackdrop.hidden = !open;
  if (elements.mobileMenuDrawer) elements.mobileMenuDrawer.hidden = !open;
  document.body.classList.toggle("mobile-menu-open", open && isMobileLandscape());
}

function toggleMobileMenu() {
  const next = !mobileMenuOpen;
  setMobileMenuOpen(next);
  if (next) renderDrillPracticePanel();
}

function initMobileLevelSelect() {
  if (!elements.mobileLevelSelect || !elements.levelRank) return;
  if (elements.mobileLevelSelect.options.length > 0) return;
  for (const option of elements.levelRank.options) {
    const clone = document.createElement("option");
    clone.value = option.value;
    clone.textContent = option.textContent;
    if (option.selected) clone.selected = true;
    elements.mobileLevelSelect.append(clone);
  }
}

function syncMobileLevelSelect() {
  if (!elements.mobileLevelSelect || !elements.levelRank) return;
  elements.mobileLevelSelect.value = elements.levelRank.value;
}

function renderTrialVersionBadge() {
  if (!elements.mobileTrialVersion) return;
  const label = `试玩 v${TRIAL_PLAY_VERSION}`;
  elements.mobileTrialVersion.textContent = label;
  elements.mobileTrialVersion.title = `掼蛋教练 Pro 试玩版 ${TRIAL_PLAY_VERSION}`;
}

async function openTrialFeedback() {
  setMobileMenuOpen(false);
  const { formUrl, wechatId, email, note } = TRIAL_FEEDBACK;
  const versionLine = `试玩 ${TRIAL_PLAY_VERSION}`;

  if (formUrl) {
    try {
      window.open(formUrl, "_blank", "noopener,noreferrer");
      showCoachToast("已打开反馈表单");
    } catch {
      showCoachToast("无法打开表单，请检查链接配置");
    }
    return;
  }

  if (wechatId) {
    try {
      await navigator.clipboard.writeText(wechatId);
      showCoachToast(`微信号已复制：${wechatId}`);
    } catch {
      showCoachToast(`微信号：${wechatId}（请手动复制）`);
    }
    return;
  }

  if (email) {
    const subject = encodeURIComponent(`掼蛋教练试玩反馈 (${TRIAL_PLAY_VERSION})`);
    const body = encodeURIComponent(`${note}\n\n版本：${versionLine}\n`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    return;
  }

  showCoachToast("反馈渠道待配置，见 docs/TRIAL-PLAY-GUIDE.md");
}

function renderMobileChrome() {
  syncMobileLayout();
  if (!isMobileLandscape()) return;

  renderTrialVersionBadge();

  const levelRank = elements.levelRank?.value ?? "6";
  if (elements.mobileLevelRank) elements.mobileLevelRank.textContent = levelRank;
  if (elements.mobileOurLevel) elements.mobileOurLevel.textContent = elements.ourLevel?.textContent ?? "6";
  if (elements.mobileTheirLevel) elements.mobileTheirLevel.textContent = elements.theirLevel?.textContent ?? "6";
  syncMobileLevelSelect();

  const noGame = !state;
  const gameOver = state && isGameOver(state);
  const humanTurn = state && state.currentPlayerIndex === HUMAN_INDEX && !gameOver;
  let turnText = "点菜单开新局";
  if (noGame) {
    turnText = "点新开一局开始";
  } else if (gameOver) {
    turnText = gameReviewOverlayDismissed ? "本局结束 · 看复盘" : "本局结束";
  } else if (humanTurn) {
    turnText = `轮到你 · ${state.turnNumber} 手`;
  } else if (state) {
    turnText = `${PLAYER_NAMES[state.currentPlayerIndex]} · ${state.turnNumber} 手`;
  }
  if (elements.mobileTurnChip) {
    elements.mobileTurnChip.textContent = turnText;
    elements.mobileTurnChip.classList.toggle("waiting", noGame || !humanTurn);
    elements.mobileTurnChip.classList.toggle("active-turn", !!humanTurn);
  }
  syncGameReviewReopenUi();

  syncMobileCenterActions();
  syncMlHandToolsChrome();

  if (elements.mobileMenuStatus) {
    const statusTitle = elements.matchStatus?.textContent ?? "单局练习";
    const statusBody = elements.matchSummary?.textContent ?? "竞技赛未开始；可先用单局继续练习。";
    elements.mobileMenuStatus.innerHTML = `<strong>${escapeHtml(statusTitle)}</strong><span>${escapeHtml(statusBody)}</span>`;
  }
  if (elements.mobileNextMatch) {
    elements.mobileNextMatch.hidden = elements.nextMatchGame?.hidden ?? true;
    elements.mobileNextMatch.disabled = elements.nextMatchGame?.disabled ?? true;
  }
  if (elements.mobileKeyPause) elements.mobileKeyPause.checked = keyPauseEnabled;
  if (elements.mobileMlPolicy) elements.mobileMlPolicy.checked = useMlPolicy;
  if (elements.mobileGuideTips) elements.mobileGuideTips.checked = guidesEnabled();

  if (elements.mlHudTeammate && state) {
    const teammate = state.players[2];
    const active = teammate.seatIndex === state.currentPlayerIndex;
    elements.mlHudTeammate.innerHTML =
      `<span class="ml-teammate-chip${active ? " active" : ""}" data-avatar="${PLAYER_AVATARS[2]}"><span>${PLAYER_NAMES[2]} · ${teammate.hand.length}</span></span>`;
  } else if (elements.mlHudTeammate) {
    elements.mlHudTeammate.replaceChildren();
  }
}

function renderCenterTurnHint() {
  const mobile = isMobileLandscape();
  const noGame = !state;
  const show = mobile && state && !isGameOver(state);
  const humanTurn = show && state.currentPlayerIndex === HUMAN_INDEX;
  const hint = !show
    ? (noGame && mobile ? "点「新开一局」开始" : "")
    : humanTurn
      ? `轮到你 · 第 ${state.turnNumber} 手`
      : `${PLAYER_NAMES[state.currentPlayerIndex]} 出牌中 · 第 ${state.turnNumber} 手`;

  if (elements.centerTurnHint) {
    elements.centerTurnHint.hidden = !show;
    elements.centerTurnHint.textContent = hint;
  }
  if (elements.mlTurnCaption) {
    const matchLine = elements.matchSummary?.textContent?.trim();
    const arenaCaption = matchLine && !/^竞技赛未开始/.test(matchLine)
      ? matchLine
      : (state ? `单局练习 · 级牌 ${state.levelRank ?? elements.levelRank?.value ?? "6"}` : "");
    if (mobile && show) {
      elements.mlTurnCaption.textContent = "";
    } else {
      elements.mlTurnCaption.textContent = hint || arenaCaption;
    }
  }
}

function renderCoachSheetAdvice() {
  if (!elements.coachSheetAdvice) return;
  const mobile = isMobileLandscape();
  const humanTurn = state && state.currentPlayerIndex === HUMAN_INDEX && !isGameOver(state);
  if (!mobile || !coachFabOpen || !humanTurn || !currentAdvice) {
    elements.coachSheetAdvice.hidden = true;
    elements.coachSheetAdvice.replaceChildren();
    return;
  }
  const rec = currentAdvice.recommendation;
  const reason = firstReasonForUser(rec.reasons);
  const label = rec.candidate.label || (rec.candidate.type === PLAY_TYPES.pass ? "过牌" : "推荐牌");
  elements.coachSheetAdvice.hidden = false;
  elements.coachSheetAdvice.innerHTML = `
    <strong>推荐1</strong>
    <span class="coach-sheet-play">${escapeHtml(label)}</span>
    <span class="coach-sheet-reason">${escapeHtml(reason)}</span>
  `;
}

function flashHandColumn(columnIndex) {
  const columnNode = activeHandEl()?.querySelector(`.hand-column[data-column-index="${columnIndex}"]`);
  if (!columnNode) return;
  columnNode.classList.add("column-swipe-flash");
  window.setTimeout(() => columnNode.classList.remove("column-swipe-flash"), 420);
}

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

function isHighControlOpponentPlay(play) {
  if (!play || play.type === PLAY_TYPES.pass) return false;
  if ([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb].includes(play.type)) return true;
  return play.type === PLAY_TYPES.pair && (play.mainRank === "BJ" || play.mainRank === "SJ");
}

function trickPromptLabel(gameState = state) {
  if (isCatchWindPending(gameState)) {
    return "轮到你领出（接风），优先成组减手";
  }
  if (!gameState?.lastActivePlay) {
    return "你拥有本轮牌权，可以主动出牌";
  }
  const leaderIndex = resolveTrickLeaderIndex(gameState, HUMAN_INDEX) ?? gameState.lastActivePlayerIndex;
  const leaderName = PLAYER_NAMES[leaderIndex];
  const playText = playLabel(gameState.lastActivePlay);
  if (isTeammate(HUMAN_INDEX, leaderIndex)) {
    const pending = opponentsPendingAfterPlayer(gameState, HUMAN_INDEX);
    if (pending.length > 0) {
      const oppNames = pending.map((idx) => PLAYER_NAMES[idx]).join("、");
      const guardCtx = {
        state: gameState,
        playerIndex: HUMAN_INDEX,
        previousPlay: gameState.lastActivePlay,
        lastActivePlayerIndex: leaderIndex,
      };
      if (partnerLeadNeedsGuard(guardCtx)) {
        return `队友 ${leaderName} 出 ${playText} 占牌；${oppNames} 尚未表态，宜最小散单防抢权（也可过牌）`;
      }
      return `队友 ${leaderName} 出 ${playText} 占牌；${oppNames} 尚未表态，宜过牌让队友（勿用炸弹/同花顺压队友）`;
    }
    return `队友 ${leaderName} 占牌 ${playText}，可过牌让队友接风`;
  }
  if (isHighControlOpponentPlay(gameState.lastActivePlay)) {
    return `${leaderName} 出 ${playText} 占牌，难压时可过牌`;
  }
  return `本轮需要压过：${leaderName} 的 ${playText}`;
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

function slimPlayHistoryItem(item) {
  if (!item) return null;
  const play = item.play;
  let label = play?.label;
  if (!label && play) {
    label = play.type === PLAY_TYPES.pass
      ? "过牌"
      : `${playLabel(play)} ${cardsLabel(play.cards ?? [])}`;
  }
  return {
    turnNumber: item.turnNumber,
    playerIndex: item.playerIndex,
    playerName: item.playerName ?? PLAYER_NAMES[item.playerIndex] ?? "—",
    play: {
      type: play?.type,
      label: label ?? "",
    },
  };
}

function slimEndRemainingHands(snapshot) {
  const finished = snapshot?.finishedPlayers ?? [];
  const remainingByIndex = new Map(
    (snapshot?.remainingHands ?? []).map((hand) => [hand.playerIndex, hand.cards]),
  );
  return finished.slice(1, 4).map((entry, index) => ({
    order: index + 2,
    playerIndex: entry.playerIndex,
    playerName: entry.playerName,
    cards: (remainingByIndex.get(entry.playerIndex) ?? []).map((card) => ({
      rank: card.rank,
      suit: card.suit,
      label: card.label ?? cardLabel(card),
    })),
  }));
}

/** 复盘归档/提交：完整出牌记录（轻量字段） */
function allReviewPlaysFromSnapshot(snapshot) {
  const history = snapshot?.playHistory ?? [];
  return history.map((item) => slimPlayHistoryItem({
    ...item,
    playerName: item.playerName ?? PLAYER_NAMES[item.playerIndex],
  }));
}

function allReviewPlaysFromState() {
  const history = state?.playHistory ?? [];
  return history.map((item) => slimPlayHistoryItem({
    ...item,
    playerName: PLAYER_NAMES[item.playerIndex],
  }));
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
    recentPlays: allReviewPlaysFromSnapshot(snapshot),
    endRemainingHands: slimEndRemainingHands(snapshot),
    playHistoryTotal: snapshot.playHistory?.length ?? 0,
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
let cachedHumanAdviceContext = { key: "", value: null };

function isAdvicePhaseComplete(advice = currentAdvice) {
  return Boolean(advice && !isAdviceStale(advice) && (advice._phase ?? "full") === "full");
}

function isHumanPressing(gameState = state) {
  return Boolean(
    gameState?.lastActivePlay
    && gameState.lastActivePlay.type !== PLAY_TYPES.pass
    && !isCatchWindPending(gameState),
  );
}

function buildHumanAdviceContext({ lightweight = false } = {}) {
  const key = buildAdviceTableKey();
  if (cachedHumanAdviceContext.key === key && cachedHumanAdviceContext.value) {
    return cachedHumanAdviceContext.value;
  }
  const hand = state.players[HUMAN_INDEX].hand;
  const pressing = isHumanPressing(state);
  if (lightweight) {
    const columnGroups = pressing ? currentHandPlayGroups() : [];
    const preferredGroups = pressing && columnGroups.length > 0
      ? mergePremiumStrategicGroups(
        columnGroups,
        hand,
        state.levelRank,
        buildStrategicGroups(hand, state.levelRank),
      )
      : columnGroups;
    const ctx = {
      pressing,
      preferredGroups,
      handProfile: null,
    };
    cachedHumanAdviceContext = { key, value: ctx };
    return ctx;
  }
  const columnGroups = pressing ? currentHandPlayGroups() : [];
  const strategicGroups = buildStrategicGroups(hand, state.levelRank, { skipStraightFlush: pressing });
  const strategicGroupsForMerge = pressing
    ? buildStrategicGroups(hand, state.levelRank)
    : strategicGroups;
  const preferredGroups = pressing
    ? mergePremiumStrategicGroups(
      columnGroups.length > 0 ? columnGroups : strategicGroups,
      hand,
      state.levelRank,
      strategicGroupsForMerge,
    )
    : strategicGroups;
  const ctx = {
    pressing,
    preferredGroups,
    handProfile: evaluateHandProfile(hand, state.levelRank, { preferredGroups }),
  };
  cachedHumanAdviceContext = { key, value: ctx };
  return ctx;
}

function humanAdviceOptionsQuick(abortCheck = null) {
  const ctx = buildHumanAdviceContext();
  return {
    alternatives: HUMAN_ADVICE_ALTERNATIVES_QUICK,
    maxCandidates: ctx.pressing ? 12 : HUMAN_ADVICE_MAX_CANDIDATES_OPEN,
    preferredGroups: ctx.preferredGroups,
    handProfile: ctx.handProfile,
    mlModel: null,
    mlFusionMode: "off",
    lite: true,
    scoringAudience: "human-lite",
    deadline: performance.now() + 2500,
    abortCheck,
  };
}

function humanAdviceOptionsFull(ctx, abortCheck = null) {
  const opening = !ctx.pressing;
  const useMl = useMlPolicy && mlPolicyModel && ctx.pressing;
  return {
    preferredGroups: ctx.preferredGroups,
    handProfile: ctx.handProfile,
    maxCandidates: opening ? 20 : HUMAN_ADVICE_MAX_CANDIDATES_PRESS,
    alternatives: HUMAN_ADVICE_ALTERNATIVES_FULL,
    mlModel: useMl ? mlPolicyModel : null,
    mlFusionMode: useMl ? mlFusionModeForUi() : "off",
    lite: true,
    scoringAudience: "human-lite",
    deadline: performance.now() + 6000,
    abortCheck,
  };
}

function robotAdviceOptions(actorIndex = state?.currentPlayerIndex ?? 1) {
  if (state) {
    return {
      alternatives: 0,
      handProfile: null,
      scoringAudience: "robot",
      ...buildFormalRobotPlayOptions(state, actorIndex),
    };
  }
  return {
    alternatives: 0,
    handProfile: null,
    lite: true,
    scoringAudience: "robot",
    maxCandidates: ROBOT_LITE_MAX_CANDIDATES,
    mlModel: null,
    mlFusionMode: "off",
    deadline: performance.now() + ROBOT_STEP_DEADLINE_MS,
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
  const mustBeatSig = effectivePreviousPlay(gameState)
    ? playSignature(effectivePreviousPlay(gameState))
    : "";
  const leaderIdx = resolveTrickLeaderIndex(gameState, HUMAN_INDEX);
  return `${gameState.turnNumber}|${mustBeatSig}|${leaderIdx ?? ""}|${handSig}`;
}

function isAdviceStale(advice) {
  if (!advice?.tableKey || !state) return true;
  if (state.currentPlayerIndex !== HUMAN_INDEX) return true;
  return advice.tableKey !== buildAdviceTableKey();
}

function invalidateStaleAdvice() {
  if (currentAdvice && isAdviceStale(currentAdvice)) currentAdvice = null;
  cachedHumanAdviceContext = { key: "", value: null };
}

function getHumanAdviceQuick(abortCheck = null) {
  const advice = getTurnAdvice(state, HUMAN_INDEX, humanAdviceOptionsQuick(abortCheck));
  advice.tableKey = buildAdviceTableKey();
  advice._phase = "quick";
  return advice;
}

function getHumanAdviceFromContext(ctx, phase = "full", abortCheck = null) {
  const advice = getTurnAdvice(state, HUMAN_INDEX, humanAdviceOptionsFull(ctx, abortCheck));
  advice.tableKey = buildAdviceTableKey();
  advice._phase = phase;
  return advice;
}

const ADVICE_PHASE_RANK = { emergency: 0, quick: 1, full: 2 };

function applyHumanAdviceIfCurrent(advice, generation) {
  if (generation !== adviceComputeGeneration.value) return false;
  if (advice.tableKey !== buildAdviceTableKey()) return false;
  const incomingPhase = advice._phase ?? "full";
  const currentPhase = currentAdvice?._phase;
  if (currentPhase
    && (ADVICE_PHASE_RANK[incomingPhase] ?? 0) < (ADVICE_PHASE_RANK[currentPhase] ?? 0)) {
    return false;
  }
  currentAdvice = advice;
  adviceScheduledTableKey = advice.tableKey;
  adviceComputeState.retryCount = 0;
  return true;
}

/** 人类回合立即写入毫秒级兜底，避免侧栏长时间停在「正在计算」 */
function ensureHumanAdvicePlaceholder() {
  if (!state || isGameOver(state) || state.currentPlayerIndex !== HUMAN_INDEX) return false;
  const key = buildAdviceTableKey();
  if (currentAdvice?.tableKey === key && !isAdviceStale(currentAdvice)) return true;
  try {
    const emergency = buildEmergencyHumanAdvice();
    if (emergency.tableKey !== key) return false;
    currentAdvice = emergency;
    adviceScheduledTableKey = key;
    return true;
  } catch (error) {
    console.error("教练建议兜底失败", error);
    return false;
  }
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
const ADVICE_COMPUTE_TIMEOUT_MS = 4_500;

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
  if (!state || isGameOver(state) || state.currentPlayerIndex !== HUMAN_INDEX) {
    return;
  }
  if (hintAwaiting && currentAdvice) applyHintFromAdvice(currentAdvice);
  if (refreshUi) {
    renderAdvice({ computeAdvice: false });
    renderControls();
    if (!robotQueueActive) renderGameReviewPanel();
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
    if (!currentAdvice) adviceScheduledTableKey = null;
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

function shouldAbortAdviceCompute(generation) {
  if (generation !== adviceComputeGeneration.value) return true;
  if (robotQueueActive && state?.currentPlayerIndex !== HUMAN_INDEX) return true;
  if (!state || isGameOver(state)) return true;
  return false;
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
    if (generation !== adviceComputeGeneration.value) return;
    if (currentAdvice?._phase === "full") return;
    adviceComputeState.slowNotice = true;
    if (refreshUi && state?.currentPlayerIndex === HUMAN_INDEX) {
      renderAdvice({ computeAdvice: false });
    }
  }, ADVICE_SLOW_NOTICE_MS);
  adviceComputeState.watchdogTimer = setTimeout(() => {
    if (!adviceComputeState.inFlight || generation !== adviceComputeGeneration.value) return;
    console.warn("教练建议计算超时，中止本轮");
    adviceComputeGeneration.value += 1;
    adviceComputeState.slowNotice = true;
    ensureHumanAdvicePlaceholder();
    finishAdviceCompute({ generation, refreshUi });
  }, ADVICE_COMPUTE_TIMEOUT_MS);

  window.setTimeout(() => {
    try {
      if (shouldAbortAdviceCompute(generation)) {
        finishAdviceCompute({ generation, refreshUi });
        return;
      }
      const forHuman = state.currentPlayerIndex === HUMAN_INDEX;
      if (refreshUi && !forHuman) {
        finishAdviceCompute({ generation, refreshUi });
        return;
      }
      if (!refreshUi && forHuman) {
        finishAdviceCompute({ generation, refreshUi });
        return;
      }

      applyHumanAdviceIfCurrent(buildEmergencyHumanAdvice(), generation)
        || ensureHumanAdvicePlaceholder();
      if (refreshUi) {
        renderAdvice({ computeAdvice: false });
        renderControls();
      }

      window.setTimeout(() => {
        try {
          if (shouldAbortAdviceCompute(generation)) {
            finishAdviceCompute({ generation, refreshUi });
            return;
          }
          if (state.currentPlayerIndex !== HUMAN_INDEX) {
            finishAdviceCompute({ generation, refreshUi });
            return;
          }

          const abortCheck = () => shouldAbortAdviceCompute(generation);
          const quickAdvice = getHumanAdviceQuick(abortCheck);
          if (shouldAbortAdviceCompute(generation)) {
            finishAdviceCompute({ generation, refreshUi });
            return;
          }
          applyHumanAdviceIfCurrent(quickAdvice, generation);
          if (refreshUi) {
            renderAdvice({ computeAdvice: false });
            renderControls();
          }

          window.setTimeout(() => {
            try {
              if (shouldAbortAdviceCompute(generation)) return;
              if (state.currentPlayerIndex !== HUMAN_INDEX) return;

              const abortCheck = () => shouldAbortAdviceCompute(generation);
              const ctx = buildHumanAdviceContext();
              const fullAdvice = getHumanAdviceFromContext(ctx, "full", abortCheck);
              if (shouldAbortAdviceCompute(generation)) return;
              adviceComputeState.slowNotice = false;
              if (applyHumanAdviceIfCurrent(fullAdvice, generation) && refreshUi) {
                renderAdvice({ computeAdvice: false });
                renderControls();
              }
            } catch (error) {
              console.error("教练建议精算失败", error);
              ensureHumanAdvicePlaceholder();
            } finally {
              finishAdviceCompute({ generation, refreshUi });
            }
          }, 0);
        } catch (error) {
          console.error("教练建议计算失败", error);
          if (!shouldAbortAdviceCompute(generation) && !currentAdvice) {
            ensureHumanAdvicePlaceholder();
          }
          finishAdviceCompute({ generation, refreshUi });
        }
      }, 0);
    } catch (error) {
      console.error("教练建议初始化失败", error);
      if (!shouldAbortAdviceCompute(generation) && !currentAdvice) {
        ensureHumanAdvicePlaceholder();
      }
      finishAdviceCompute({ generation, refreshUi });
    }
  }, 0);
}

/** 机器人回合期间在空闲时预计算下一手人类建议，不挡出牌队列 */
function scheduleIdleHumanAdviceRefresh() {
  if (robotQueueActive) return;
  cancelIdleTask(adviceRefreshIdleRef);
  if (!state || isGameOver(state)) return;
  // 非人类回合：优先恢复机器人队列，勿抢主线程预算人类 advice（否则勇哥等会卡死）
  if (state.currentPlayerIndex !== HUMAN_INDEX) {
    queueRobotTurns();
    return;
  }
  const generation = adviceComputeGeneration.value;
  const run = () => {
    adviceRefreshIdleRef.value = null;
    if (generation !== adviceComputeGeneration.value) return;
    if (robotQueueActive) return;
    if (!state || isGameOver(state) || state.currentPlayerIndex !== HUMAN_INDEX) {
      if (state && !isGameOver(state) && state.currentPlayerIndex !== HUMAN_INDEX) {
        queueRobotTurns();
      }
      return;
    }
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
  if (state?.currentPlayerIndex === HUMAN_INDEX && robotQueueActive) {
    robotQueueActive = false;
    robotQueueStartedAt = 0;
    cancelRobotQueueTimers();
  }
  cancelIdleTask(adviceRefreshIdleRef);
  invalidateStaleAdvice();
  const tableKey = buildAdviceTableKey();
  if (isAdvicePhaseComplete()) {
    renderAdvice({ computeAdvice: false });
    if (hintAwaiting) applyHintFromAdvice(currentAdvice);
    return;
  }
  if (
    !force
    && adviceScheduledTableKey === tableKey
    && (adviceComputeState.inFlight || isAdvicePhaseComplete())
  ) {
    return;
  }
  if (adviceComputeState.inFlight) {
    adviceComputeState.pendingRefresh = true;
    if (!currentAdvice?.tableKey || currentAdvice.tableKey !== tableKey) {
      ensureHumanAdvicePlaceholder();
    }
    return;
  }
  adviceScheduledTableKey = tableKey;
  if (!currentAdvice?.tableKey || currentAdvice.tableKey !== tableKey) {
    ensureHumanAdvicePlaceholder();
  }
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

/** 手机版底栏按钮被禁用时给出可见反馈（footer 已隐藏） */
function showPlayDockDisabledHint(buttonId) {
  if (!isMobileLandscape()) return;
  const humanTurn = state && state.currentPlayerIndex === HUMAN_INDEX && !isGameOver(state);
  if (buttonId === "passTurn") {
    showCoachToast(humanTurn ? "你拥有牌权，不能直接过牌" : "尚未轮到你出牌");
    return;
  }
  if (buttonId === "playRecommended" && hintAwaiting) {
    showCoachToast("推荐计算中，请稍候…");
    return;
  }
  showCoachToast("尚未轮到你出牌");
}

/** 手机版操作反馈：message 写入 footer，同时 toast 提示 */
function notifyActionMessage(text) {
  message = text;
  if (isMobileLandscape() && text) showCoachToast(text);
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
  const scrollEl = elements.coachFabLog.closest(".coach-fab-body") ?? elements.coachFabLog;
  scrollEl.scrollTop = scrollEl.scrollHeight;
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
  const mobile = isMobileLandscape();
  if (elements.coachFabBackdrop) {
    elements.coachFabBackdrop.hidden = !(open && mobile);
  }
  document.body.classList.toggle("coach-fab-open", open && mobile);
  if (open && mobile) {
    renderCoachSheetAdvice();
    if (elements.coachFabQuestion) {
      requestAnimationFrame(() => {
        elements.coachFabQuestion?.focus({ preventScroll: true });
      });
    }
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
    html += "<div class=\"review-history-top3\"><p class=\"muted\">建议重点学习的三处：</p>";
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
    html += "<p class=\"muted\">暂无「建议学习点」类差异摘要。</p>";
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
    const learningPts = (game.coachBetterCount ?? 0) + (game.coachQuestionableCount ?? 0);
    html += `<li class="review-history-item${active}" data-game-id="${escapeHtml(game.gameId)}" role="button" tabindex="0" title="点击查看该局摘要">
      <div><strong>打 ${escapeHtml(String(level))}</strong> · ${game.divergenceCount} 处差异 · ${game.totalHands} 手</div>
      <div class="review-history-item-meta"><span>${escapeHtml(dateStr)}</span><span>学习点 ${learningPts || game.divergenceCount}</span></div>
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
  const learningPts = formatLearningPoints(stats);
  const alignRate = formatAlignRate(stats);
  const lastSaved = loadReviewHistory().games.at(-1);
  const recentSavedLine = lastSaved
    ? `<p class="muted">最近保存：打 ${escapeHtml(String(lastSaved.levelRank ?? "—"))}，${lastSaved.divergenceCount} 处差异（${new Date(lastSaved.savedAt).toLocaleDateString("zh-CN")}）</p>`
    : "<p class=\"muted\">保存复盘后，这里会显示最近一次记录。</p>";
  elements.progressStats.innerHTML = `
    <div class="progress-stats-grid">
      <div class="progress-stat-card"><strong>${stats.totalGames}</strong><span>累计局数</span></div>
      <div class="progress-stat-card"><strong>${learningPts}</strong><span>累计学习点</span></div>
      <div class="progress-stat-card"><strong>${stats.drillSessions?.length ?? 0}</strong><span>专项练习</span></div>
    </div>
    ${recentSavedLine}
    <p class="muted">近 7 局建议学习点（次要：推荐1一致 ${alignRate}）</p>
    ${renderRecentTrendBars(stats.recentGames)}
  `;
  renderReviewHistoryList();
  renderDrillPracticePanel();
}

function wireDrillPracticeButtons(root) {
  if (!root) return;
  for (const btn of root.querySelectorAll(".drill-practice-btn[data-drill-tag]")) {
    if (btn.dataset.drillBound === "1") continue;
    btn.dataset.drillBound = "1";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void startDrillPractice(btn.dataset.drillTag);
    });
  }
}

function renderDrillPracticePanel() {
  const weaknesses = analyzeWeaknesses({
    currentTimeline: currentGameMeta?.coachAdviceTimeline ?? null,
    limit: 5,
  });
  const html = renderDrillPracticeListHtml(weaknesses);
  if (elements.drillPracticeList) {
    elements.drillPracticeList.innerHTML = html;
    wireDrillPracticeButtons(elements.drillPracticeList);
  }
  if (elements.mobileDrillPracticeList) {
    elements.mobileDrillPracticeList.innerHTML = html;
    wireDrillPracticeButtons(elements.mobileDrillPracticeList);
  }
}

function openDrillPracticePanel() {
  renderDrillPracticePanel();
  if (isMobileLandscape()) {
    setMobileMenuOpen(true);
    if (elements.mobileDrillPanel) elements.mobileDrillPanel.open = true;
    showCoachToast("点「练这个」进入预设局面");
    return;
  }
  if (elements.drillPanel) {
    elements.drillPanel.open = true;
    progressPanelDirty = true;
    renderProgressPanel();
    elements.drillPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  elements.aiPanel?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  showCoachToast("右侧已展开专项列表，点「练这个」开局");
}

/** 顶栏「专项练习」：直接进入置顶教学局面 */
async function startFeaturedDrillPractice() {
  const trigger = elements.openDrillPanel ?? elements.mobileOpenDrill;
  if (trigger?.disabled) return;
  if (trigger) trigger.disabled = true;
  showCoachToast("正在载入须压保同花顺…");
  try {
    await startDrillPractice(DRILL_TAGS.MUST_BEAT_KEEP_SF);
  } finally {
    if (trigger) trigger.disabled = false;
  }
}

async function startDrillPractice(tag) {
  if (!tag) {
    showCoachToast("未选择专项标签");
    return;
  }

  const exitingMatch = Boolean(matchState);
  const matchGameNumber = matchState?.gameNumber;

  try {
    await newGame({ drillFocus: tag });
  } catch (error) {
    console.error("专项练习开局失败", error);
    showCoachToast(`专项开局失败：${error?.message ?? "未知错误"}`);
    return;
  }

  if (exitingMatch) {
    const prefix = matchGameNumber
      ? `已退出竞技赛第 ${matchGameNumber} 局。`
      : "已退出竞技赛。";
    message = `${prefix}${message}`;
    if (elements.message) elements.message.textContent = formatBootMessage(message);
  }

  if (elements.drillPanel) elements.drillPanel.open = false;
  if (elements.mobileDrillPanel) elements.mobileDrillPanel.open = false;
  setMobileMenuOpen(false);

  showCoachToast("已开启专项练习，请出牌");
  render({ immediate: true, lite: true });
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
  // 推荐高亮与选中一致：绿框牌同步上浮，点「出牌」无需再点一遍
  selectedIds = new Set(hintCardIds);
  const reason = firstReasonForUser(rec.reasons);
  const label = rec.candidate.label || (rec.candidate.type === PLAY_TYPES.pass ? "过牌" : "推荐牌");
  message = `推荐：${label} — ${reason}`;
  advanceOnboarding(2);
  // 手机横屏：展开推荐后关闭关键时刻卡片，避免与底栏三钮叠层
  if (keyPauseOverlay) dismissKeyPause();
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

/** 手机横屏：「提示」首次说明未看过前，不弹关键时刻暂停（引导串行） */
function mobileHintFirstTipPending() {
  if (!isMobileLandscape() || !onboardingDone() || firstTipsDisabled()) return false;
  return !readFirstTipsState().hint;
}

/** 人类回合开始时检测并展示关键时刻暂停 banner */
function maybeTriggerKeyPause() {
  if (!keyPauseEnabled || !state || !currentGameMeta) return;
  if (state.currentPlayerIndex !== HUMAN_INDEX || isGameOver(state)) {
    keyPauseOverlay = null;
    return;
  }
  if (mobileHintFirstTipPending()) return;
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
  if (isMobileLandscape()) updateFirstTips();
}

function keyPauseShowHint() {
  dismissKeyPause();
  showHint();
}

function cancelHint() {
  if (!hintShown) return;
  clearHint();
  selectedIds = new Set();
  message = "已取消推荐，可自行选牌出牌。";
  render();
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
    currentGameMeta.keyPauseFired = currentGameMeta.keyPauseFired ?? [];
    currentGameMeta.divergenceSummaryCache = summarizeGameDivergences(
      currentGameMeta.coachAdviceTimeline ?? [],
      HUMAN_INDEX,
    );
  }
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
  gameReviewOverlayDismissed = false;
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
    keyPauseFired: [],
    aiChatTimeline,
    initialHands: state.players.map((player, index) => ({
      playerIndex: index,
      playerName: PLAYER_NAMES[index],
      cards: player.hand.map(serializeCard),
    })),
  };
  gameReviewOverlayDismissed = false;
  keyPauseOverlay = null;
  resetTableState();
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
  robotQueueTimedOut = false;
}

async function triggerNewGame() {
  reconcileTablePlaysWithState();
  purgeSeatPlayContainers();
  if (elements.newGame?.disabled) {
    if (isMobileLandscape() && elements.mobileTurnChip) {
      elements.mobileTurnChip.textContent = "正在发牌…";
      elements.mobileTurnChip.classList.add("waiting");
    } else {
      showCoachToast("正在发牌，请稍候…");
    }
    return;
  }
  if (isMobileLandscape() && elements.mobileTurnChip) {
    elements.mobileTurnChip.textContent = "正在发牌…";
    elements.mobileTurnChip.classList.add("waiting");
    hideFirstTipBar();
  }
  syncMobileCenterActions();
  try {
    await newGame();
  } catch (error) {
    console.error(error);
    showCoachToast("发牌失败，请重试");
  }
}

async function newGame(extraMeta = {}) {
  clearTimeout(persistSessionTimer);
  persistSessionTimer = null;
  resetActivePlayQueues();
  cancelAdviceCompute();
  currentAdvice = null;
  selectedDivergenceTurn = null;
  keyPauseOverlay = null;

  if (!extraMeta.drillFocus) {
    await ensureGameReviewSaved();
  }

  try {
    hideDivergenceDetail();
    divergenceVerdictFilter = DIVERGENCE_VERDICTS.COACH_BETTER;
    archiveCurrentGame(state && isGameOver(state) ? "complete" : "interrupted");
    aiChatTimeline = [];
    matchState = null;
    matchSettledTurnNumber = null;
    if (elements.newGame) {
      elements.newGame.disabled = true;
      elements.newGame.textContent = "发牌中";
    }
    if (elements.mlNewGame) {
      elements.mlNewGame.disabled = true;
      elements.mlNewGame.textContent = "发牌中";
    }
    syncMobileCenterActions();
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
        keyPauseFired: [],
        gameReviewSubmitted: false,
      };
    gameReviewOverlayDismissed = false;
    resetTableState();
    const scenarioLine = drillFocus ? getDrillScenarioSummary(drillFocus) : null;
    message = drillFocus
      ? (scenarioLine
        ? `专项练习（预设局面）：${scenarioLine} 轮到你时点「提示」。`
        : `专项练习：本局重点练「${drillFocus}」。轮到你时点「提示」看推荐。`)
      : "新局已发牌。轮到你时点「提示」看推荐；跟推荐点「采纳」或「出牌」，不想跟再点「取消推荐」。";
    advanceOnboarding(1);
  } catch (error) {
    console.error(error);
    message = `发牌失败：${error.message}`;
  } finally {
    if (elements.newGame) {
      elements.newGame.textContent = "新开一局";
      elements.newGame.disabled = false;
    }
    if (elements.mlNewGame) {
      elements.mlNewGame.textContent = "新开一局";
      elements.mlNewGame.disabled = false;
    }
    clearSafeBootMode();
    syncMobileLayout();
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

async function newCompetitiveMatch() {
  await ensureGameReviewSaved();
  archiveCurrentGame(state && isGameOver(state) ? "complete" : "interrupted");
  resetActivePlayQueues();
  cancelAdviceCompute();
  currentAdvice = null;
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
  render({ immediate: true, lite: true });
  if (state && !isGameOver(state) && state.currentPlayerIndex !== HUMAN_INDEX) {
    queueRobotTurns();
  }
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

/** 新开一局/竞技赛前确保局末复盘已静默保存，无需确认弹窗 */
async function ensureGameReviewSaved() {
  if (!needsSubmitReminder()) return;
  if (autoGameReviewTimer !== null) {
    window.clearTimeout(autoGameReviewTimer);
    autoGameReviewTimer = null;
  }
  await submitGameReview();
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
    { verdict: DIVERGENCE_VERDICTS.USER_BETTER, label: verdictUiLabel(DIVERGENCE_VERDICTS.USER_BETTER), count: summary.userBetterCount ?? 0 },
    { verdict: DIVERGENCE_VERDICTS.COACH_BETTER, label: verdictUiLabel(DIVERGENCE_VERDICTS.COACH_BETTER), count: summary.coachBetterCount ?? 0 },
    { verdict: DIVERGENCE_VERDICTS.COACH_QUESTIONABLE, label: verdictUiLabel(DIVERGENCE_VERDICTS.COACH_QUESTIONABLE), count: summary.coachQuestionableCount ?? 0 },
    { verdict: DIVERGENCE_VERDICTS.STYLE, label: verdictUiLabel(DIVERGENCE_VERDICTS.STYLE), count: summary.styleCount ?? 0 },
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
      + `<div class="divergence-item-head">`
      + `<span class="divergence-item-turn">第 ${item.turnNumber} 手</span>`
      + `${verdictBadgeHtml(item.verdict, verdictUiLabel(item.verdict))}`
      + `</div>`
      + `<div class="divergence-item-plays">`
      + `<div class="divergence-play divergence-play-you"><span class="divergence-play-label">你出：</span><span class="divergence-play-text">${escapeHtml(item.actual)}</span></div>`
      + `<div class="divergence-play divergence-play-rec"><span class="divergence-play-label">推荐：</span><span class="divergence-play-text">${escapeHtml(item.recommended)}</span></div>`
      + `</div>`
      + `${item.verdictNote ? `<p class="divergence-item-note">${escapeHtml(item.verdictNote)}</p>` : ""}`
      + `${disputeBtn ? `<div class="divergence-dispute-inline">${disputeBtn}</div>` : ""}</li>`;
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

function proceedNextCompetitiveGame() {
  if (!matchState || matchState.complete || !state || !isGameOver(state)) return;
  settleCompetitiveGameIfNeeded();
  resetActivePlayQueues();
  cancelAdviceCompute();
  currentAdvice = null;
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
  render({ immediate: true, lite: true });
  queueRobotTurns();
}

async function nextCompetitiveGame() {
  if (!matchState || matchState.complete || !state || !isGameOver(state)) return;
  await ensureGameReviewSaved();
  proceedNextCompetitiveGame();
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
    note: note || "打牌记录：含教练推荐、实际出牌、理牌列、问教练记录和复盘视角。",
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
    message = "还没有可保存的打牌记录。先打一局或打到有争议的地方再保存。";
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
    message = "记录已保存。";
    aiBridgeOnline = true;
  } catch (error) {
    elements.exportOutput.value = text;
    elements.exportPanel.hidden = false;
    message = "请先运行「点我启动掼蛋教练Pro.cmd」再保存记录；已把内容放到导出区。";
  }
  render();
}

function cardClass(card) {
  const classes = ["card"];
  if (card.suit === "H" || card.suit === "D") classes.push("red");
  if (card.suit === "JOKER") classes.push("joker");
  return classes.join(" ");
}

function cancelPendingCardClick() {
  if (!pendingCardClickTimer) return;
  window.clearTimeout(pendingCardClickTimer);
  pendingCardClickTimer = null;
  pendingCardClickAction = null;
}

/** 列顶牌向下滑动选中整列（移动端替代双击） */
function attachColumnSwipeSelect(node, columnIndex) {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchMoved = false;

  node.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchMoved = false;
  }, { passive: true });

  node.addEventListener("touchmove", (event) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      touchMoved = true;
      cancelPendingCardClick();
    }
  }, { passive: true });

  node.addEventListener("touchend", (event) => {
    if (!touchMoved) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const isSwipeDown = dy >= COLUMN_SWIPE_MIN_DOWN
      && Math.abs(dx) <= COLUMN_SWIPE_MAX_HORIZONTAL
      && Math.abs(dx) < dy;
    if (!isSwipeDown) {
      suppressCardClick = true;
      window.setTimeout(() => {
        suppressCardClick = false;
      }, 320);
      return;
    }
    cancelPendingCardClick();
    suppressCardClick = true;
    toggleHandColumnSelection(columnIndex);
    flashHandColumn(columnIndex);
    removeAccidentalJokerFromStraightFlush();
    render();
    window.setTimeout(() => {
      suppressCardClick = false;
    }, 400);
  }, { passive: true });
}

/** 手机横屏叠牌列：DOM 末张为视觉顶牌（最高 z-index / peek 顶条） */
function mlHandTopCardInColumn(columnNode) {
  if (!columnNode) return null;
  const cards = columnNode.querySelectorAll(".card[data-card-id]");
  return cards.length ? cards[cards.length - 1] : null;
}

function mlHandCardCountInColumn(columnNode) {
  return columnNode?.querySelectorAll(".card[data-card-id]").length ?? 0;
}

function mlHandPeekHeightPx() {
  const root = elements.landscapeRoot;
  if (!root) return 38;
  const raw = getComputedStyle(root).getPropertyValue("--ml-hand-peek-h");
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 38;
}

/** 叠牌列：按可见顶条 / 顶牌区域命中单张（自顶向下） */
function mlHandHitCardInColumn(columnNode, clientX, clientY) {
  const cards = [...columnNode.querySelectorAll(".card[data-card-id]")];
  if (!cards.length) return null;
  const colRect = columnNode.getBoundingClientRect();
  if (clientX < colRect.left || clientX > colRect.right
    || clientY < colRect.top || clientY > colRect.bottom) {
    return null;
  }
  const peekH = mlHandPeekHeightPx();
  for (let index = cards.length - 1; index >= 0; index -= 1) {
    const cardNode = cards[index];
    const rect = cardNode.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right) continue;
    const visibleBottom = index === cards.length - 1 ? rect.bottom : rect.top + peekH;
    if (clientY >= rect.top && clientY <= visibleBottom) return cardNode;
  }
  return null;
}

let pendingMlSingleTapTimer = null;

function cancelPendingMlSingleTap() {
  if (pendingMlSingleTapTimer !== null) {
    window.clearTimeout(pendingMlSingleTapTimer);
    pendingMlSingleTapTimer = null;
  }
}

function scheduleMlSingleTap(cardNode, delayMs = 450) {
  cancelPendingMlSingleTap();
  pendingMlSingleTapTimer = window.setTimeout(() => {
    pendingMlSingleTapTimer = null;
    pickMlHandSingleCard(cardNode);
  }, delayMs);
}

function pointInNode(node, clientX, clientY) {
  if (!node) return false;
  const rect = node.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right
    && clientY >= rect.top && clientY <= rect.bottom;
}

/** 手机横屏：单牌列单击 toggle */
function pickMlHandSingleCard(cardNode, { toggle = true } = {}) {
  const id = cardNode?.dataset?.cardId;
  if (!id || !state || state.currentPlayerIndex !== HUMAN_INDEX || isGameOver(state)) return;
  if (toggle && selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  removeAccidentalJokerFromStraightFlush();
  render();
}

/** 手机横屏：叠牌列双击 toggle 整列 */
function pickMlHandColumn(columnNode) {
  const columnIndex = Number(columnNode?.dataset?.columnIndex);
  if (!Number.isFinite(columnIndex)) return;
  if (!state || state.currentPlayerIndex !== HUMAN_INDEX || isGameOver(state)) return;
  toggleHandColumnSelection(columnIndex);
  removeAccidentalJokerFromStraightFlush();
  render();
}

function canMobileHandReorder() {
  return isMobileLandscape() && state && state.currentPlayerIndex === HUMAN_INDEX && !isGameOver(state);
}

function cancelMobileHandDragTimer() {
  if (mobileHandDragTimer !== null) {
    window.clearTimeout(mobileHandDragTimer);
    mobileHandDragTimer = null;
  }
}

function maybeShowMobileReorderTip() {
  if (safeGetItem(ML_REORDER_TIP_STORAGE, "") === "1") return;
  safeSetItem(ML_REORDER_TIP_STORAGE, "1");
  showCoachToast("拖到牌上=合并列，拖到空白=新列");
}

function columnIdsForMobileDrag(columnNode) {
  const columnIndex = Number(columnNode?.dataset?.columnIndex);
  if (!Number.isFinite(columnIndex)) return null;
  const column = ensureHandColumns()[columnIndex] ?? [];
  if (column.length <= 1) return null;
  const allSelected = column.every((id) => selectedIds.has(id));
  const columnSelected = columnNode.classList.contains("column-selected");
  if (allSelected || columnSelected) return [...column];
  return null;
}

function elementAtPointExcludingGhost(clientX, clientY, ghost) {
  if (ghost) ghost.style.visibility = "hidden";
  const el = document.elementFromPoint(clientX, clientY);
  if (ghost) ghost.style.visibility = "";
  return el;
}

function positionMobileHandDragGhost(ghost, clientX, clientY) {
  if (!ghost) return;
  const w = ghost.offsetWidth;
  const h = ghost.offsetHeight;
  ghost.style.transform = `translate(${clientX - w / 2}px, ${clientY - h / 2}px)`;
}

function clearMobileHandDragOverHighlight(hand) {
  hand?.querySelectorAll(".ml-drag-over").forEach((node) => node.classList.remove("ml-drag-over"));
}

function updateMobileHandDragOverHighlight(hand, clientX, clientY, ghost) {
  clearMobileHandDragOverHighlight(hand);
  const el = elementAtPointExcludingGhost(clientX, clientY, ghost);
  const cardEl = el?.closest?.(".card[data-card-id]");
  if (cardEl && hand.contains(cardEl)) {
    cardEl.classList.add("ml-drag-over");
    return;
  }
  const columnEl = el?.closest?.(".hand-column");
  if (columnEl && hand.contains(columnEl)) columnEl.classList.add("ml-drag-over");
}

function resolveMlHandDropTarget(clientX, clientY, hand, ghost) {
  const el = elementAtPointExcludingGhost(clientX, clientY, ghost);
  if (!el) return null;
  const cardEl = el.closest?.(".card[data-card-id]");
  if (cardEl && hand.contains(cardEl)) {
    const columnNode = cardEl.closest(".hand-column");
    const columnIndex = Number(columnNode?.dataset?.columnIndex);
    const targetId = cardEl.dataset.cardId;
    if (Number.isFinite(columnIndex) && targetId && targetId !== draggedCardId) {
      return { type: "column", columnIndex };
    }
  }
  const columnEl = el.closest?.(".hand-column");
  if (columnEl && hand.contains(columnEl)) {
    const columnIndex = Number(columnEl.dataset.columnIndex);
    if (Number.isFinite(columnIndex)) return { type: "column", columnIndex };
  }
  const scrollEl = hand.closest(".ml-hand-scroll") ?? hand;
  const scrollRect = scrollEl.getBoundingClientRect();
  if (clientX >= scrollRect.left && clientX <= scrollRect.right
    && clientY >= scrollRect.top && clientY <= scrollRect.bottom) {
    return { type: "new", columnIndex: handDropColumnIndex(clientX, hand) };
  }
  return null;
}

function createMobileHandDragGhost(cardNode, touch) {
  const ghost = cardNode.cloneNode(true);
  ghost.classList.add("ml-hand-drag-ghost");
  ghost.removeAttribute("data-card-id");
  ghost.style.position = "fixed";
  ghost.style.left = "0";
  ghost.style.top = "0";
  ghost.style.margin = "0";
  ghost.style.pointerEvents = "none";
  ghost.style.zIndex = "9999";
  document.body.append(ghost);
  positionMobileHandDragGhost(ghost, touch.clientX, touch.clientY);
  return ghost;
}

function startMobileHandDrag(hand, cardNode, columnNode, touch) {
  if (!canMobileHandReorder() || !cardNode || !columnNode) return;
  const sourceId = cardNode.dataset.cardId;
  if (!sourceId) return;
  cancelPendingMlSingleTap();
  draggedCardId = sourceId;
  draggedColumnIds = columnIdsForMobileDrag(columnNode);
  suppressCardClick = true;
  cardNode.classList.add("dragging");
  if (draggedColumnIds) columnNode.classList.add("dragging-column");
  const ghost = createMobileHandDragGhost(cardNode, touch);
  hand.classList.add("ml-hand-drag-active");
  mobileHandDrag = {
    ghost,
    sourceCardNode: cardNode,
    sourceColumnNode: columnNode,
    lastX: touch.clientX,
    lastY: touch.clientY,
  };
}

function scheduleMobileHandDragStart(hand, cardNode, columnNode, touch) {
  cancelMobileHandDragTimer();
  if (!cardNode || !columnNode) return;
  mobileHandDragTimer = window.setTimeout(() => {
    mobileHandDragTimer = null;
    startMobileHandDrag(hand, cardNode, columnNode, touch);
  }, ML_DRAG_LONG_PRESS_MS);
}

function finishMobileHandDrag(hand, touch, { cancelled = false } = {}) {
  cancelMobileHandDragTimer();
  if (!mobileHandDrag) return false;
  const clientX = touch?.clientX ?? mobileHandDrag.lastX ?? 0;
  const clientY = touch?.clientY ?? mobileHandDrag.lastY ?? 0;
  const { ghost, sourceCardNode, sourceColumnNode } = mobileHandDrag;
  let dropped = false;
  if (!cancelled && draggedCardId) {
    const target = resolveMlHandDropTarget(clientX, clientY, hand, ghost);
    const fakeEvent = { dataTransfer: { getData: () => "" } };
    if (target?.type === "column") {
      moveDragPayloadToColumn(fakeEvent, draggedCardId, target.columnIndex);
      dropped = true;
    } else if (target?.type === "new") {
      moveDragPayloadToNewColumn(fakeEvent, draggedCardId, target.columnIndex);
      dropped = true;
    }
  }
  clearMobileHandDragOverHighlight(hand);
  sourceCardNode?.classList.remove("dragging");
  sourceColumnNode?.classList.remove("dragging-column");
  ghost?.remove();
  draggedCardId = null;
  draggedColumnIds = null;
  mobileHandDrag = null;
  hand.classList.remove("ml-hand-drag-active");
  window.setTimeout(() => {
    suppressCardClick = false;
  }, 0);
  if (dropped) maybeShowMobileReorderTip();
  return dropped;
}

/** 手机横屏：单牌单击 / 叠牌顶牌双击整列 / 长按拖拽理牌（委托 #mlHand） */
function bindMobileHandEvents() {
  const hand = elements.mlHand;
  if (!hand || hand.dataset.handBound === "1") return;
  hand.dataset.handBound = "1";
  const DBL_TAP_MS = 450;
  let touchState = null;
  let lastTap = { time: 0, columnNode: null };

  hand.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) {
      touchState = null;
      cancelMobileHandDragTimer();
      return;
    }
    const touch = event.touches[0];
    const columnNode = event.target.closest(".hand-column");
    const resolvedColumn = columnNode && hand.contains(columnNode) ? columnNode : null;
    let cardNode = event.target.closest(".card[data-card-id]");
    if (resolvedColumn) {
      const hitCard = mlHandHitCardInColumn(resolvedColumn, touch.clientX, touch.clientY);
      if (hitCard) cardNode = hitCard;
    }
    const resolvedCard = cardNode && hand.contains(cardNode) ? cardNode : null;
    touchState = {
      x: touch.clientX,
      y: touch.clientY,
      columnNode: resolvedColumn,
      cardNode: resolvedCard,
    };
    if (resolvedCard && resolvedColumn && canMobileHandReorder()) {
      scheduleMobileHandDragStart(hand, resolvedCard, resolvedColumn, touch);
    }
  }, { passive: true });

  hand.addEventListener("touchmove", (event) => {
    if (mobileHandDrag) {
      event.preventDefault();
      const touch = event.touches[0];
      if (!touch) return;
      mobileHandDrag.lastX = touch.clientX;
      mobileHandDrag.lastY = touch.clientY;
      positionMobileHandDragGhost(mobileHandDrag.ghost, touch.clientX, touch.clientY);
      updateMobileHandDragOverHighlight(hand, touch.clientX, touch.clientY, mobileHandDrag.ghost);
      return;
    }
    if (!touchState || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = Math.abs(touch.clientX - touchState.x);
    const dy = Math.abs(touch.clientY - touchState.y);
    if (dx > ML_DRAG_MOVE_THRESHOLD || dy > ML_DRAG_MOVE_THRESHOLD) {
      cancelMobileHandDragTimer();
    }
  }, { passive: false });

  hand.addEventListener("touchend", (event) => {
    if (mobileHandDrag) {
      event.preventDefault();
      finishMobileHandDrag(hand, event.changedTouches[0]);
      touchState = null;
      lastTap = { time: 0, columnNode: null };
      return;
    }
    cancelMobileHandDragTimer();
    if (!isMobileLandscape() || suppressCardClick || !touchState) return;
    const touch = event.changedTouches[0];
    if (!touch) {
      touchState = null;
      return;
    }
    const dx = Math.abs(touch.clientX - touchState.x);
    const dy = Math.abs(touch.clientY - touchState.y);
    const columnNode = touchState.columnNode;
    touchState = null;
    if (dx > 18 || dy > 18 || !columnNode || !hand.contains(columnNode)) return;

    const count = mlHandCardCountInColumn(columnNode);
    if (count <= 1) {
      cancelPendingMlSingleTap();
      const cardNode = event.target.closest(".card[data-card-id]");
      if (!cardNode || !hand.contains(cardNode)) return;
      event.preventDefault();
      pickMlHandSingleCard(cardNode);
      lastTap = { time: 0, columnNode: null };
      return;
    }

    const hitCard = mlHandHitCardInColumn(columnNode, touch.clientX, touch.clientY);
    if (!hitCard) return;

    const now = Date.now();
    const isDouble = lastTap.columnNode === columnNode && (now - lastTap.time) <= DBL_TAP_MS;
    event.preventDefault();
    if (isDouble) {
      cancelPendingMlSingleTap();
      pickMlHandColumn(columnNode);
      lastTap = { time: 0, columnNode: null };
    } else {
      scheduleMlSingleTap(hitCard, DBL_TAP_MS);
      lastTap = { time: now, columnNode };
    }
  }, { passive: false });

  hand.addEventListener("touchcancel", () => {
    if (mobileHandDrag) finishMobileHandDrag(hand, null, { cancelled: true });
    cancelMobileHandDragTimer();
    touchState = null;
  }, { passive: true });

  hand.addEventListener("dblclick", (event) => {
    if (!isMobileLandscape() || suppressCardClick) return;
    const columnNode = event.target.closest(".hand-column");
    if (!columnNode || !hand.contains(columnNode)) return;
    if (mlHandCardCountInColumn(columnNode) <= 1) return;
    const hitCard = mlHandHitCardInColumn(columnNode, event.clientX, event.clientY);
    if (!hitCard) return;
    event.preventDefault();
    cancelPendingMlSingleTap();
    pickMlHandColumn(columnNode);
    lastTap = { time: 0, columnNode: null };
  });

  hand.addEventListener("click", (event) => {
    if (!isMobileLandscape() || suppressCardClick || event.pointerType === "touch") return;
    const columnNode = event.target.closest(".hand-column");
    if (!columnNode || !hand.contains(columnNode)) return;
    if (mlHandCardCountInColumn(columnNode) !== 1) return;
    const cardNode = event.target.closest(".card[data-card-id]");
    if (!cardNode || !hand.contains(cardNode)) return;
    event.preventDefault();
    pickMlHandSingleCard(cardNode);
  });
}

function renderCard(card, {
  selectable = false,
  reorderable = false,
  columnIndex = null,
  cardIndex = null,
  mobileColumn = false,
  tablePlay = false,
} = {}) {
  const node = document.createElement(selectable && !mobileColumn ? "button" : "div");
  node.className = [cardClass(card), tablePlay ? "table-play-card" : ""].filter(Boolean).join(" ");
  node.type = selectable ? "button" : undefined;
  node.dataset.cardId = cardId(card);
  node.dataset.cardId = cardId(card);
  if (selectedIds.has(cardId(card))) node.classList.add("selected");
  if (hintCardIds.has(cardId(card))) node.classList.add("hint-recommended");
  if (mobileColumn && columnIndex !== null) {
    node.style.setProperty("--ml-card-stack", String(cardIndex + 1));
    node.style.zIndex = String(cardIndex + 1);
  }
  const label = cardLabel(card);
  const isJoker = card.rank === "SJ" || card.rank === "BJ";
  const suitLabel = isJoker ? label : SUIT_LABELS[card.suit] ?? card.suit;
  const suitSymbol = isJoker ? (card.rank === "SJ" ? "小" : "大") : SUIT_SYMBOLS[card.suit] ?? "";
  const rankLabel = isJoker ? "王" : card.rank;
  const rankClass = rankLabel.length > 1 ? "rank wide" : "rank";
  const isLevelCard = state && card.rank === state.levelRank;
  const cornerInner = (tablePlay || mobileColumn)
    ? `<span class="${rankClass}">${rankLabel}</span><span class="suit-mark">${suitSymbol}</span>`
    : `<span class="${rankClass}">${rankLabel}</span>`;
  node.innerHTML = `
    <span class="corner top">${cornerInner}</span>
    ${tablePlay || mobileColumn ? "" : `<span class="suit-mark">${suitSymbol}</span>`}
    <span class="suit${tablePlay ? " suit-br" : ""}">${suitSymbol}</span>
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
  if (selectable && !mobileColumn) {
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
    if (reorderable && columnIndex !== null && cardIndex === 0) {
      attachColumnSwipeSelect(node, columnIndex);
    }
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

function handDropColumnIndex(clientX, handEl = null) {
  const el = handEl ?? (isMobileLandscape() ? elements.mlHand : elements.hand);
  if (!el) return 0;
  const columns = [...el.querySelectorAll(".hand-column")];
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
  selectedIds = new Set();
  message = isMobileLandscape()
    ? "手牌已重新整理。"
    : "手牌已竖列整理。拖到牌面=加入该竖列；拖到空白=新建竖列。单击选一张，双击/列顶下滑选整列。";
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
      : buildMinimalHumanAdviceForPlay(play));
    const adviceRecord = serializeCoachAdvice(adviceBeforePlay, play, source);
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
    syncTablePlaysForCurrentTrick(actorIndex, play);
    selectedIds = new Set();
    message = successMessage;
    settleCompetitiveGameIfNeeded();
    if (isGameOver(state)) onGameOverDetected();
    const humanJustPlayed = actorIndex === HUMAN_INDEX;
    if (humanJustPlayed) {
      cancelAdviceCompute();
      currentAdvice = null;
      render({ immediate: true, lite: true });
      scheduleDeferredPanelsRender();
      queueRobotTurns();
    } else {
      render();
      queueRobotTurns();
    }
  } catch (error) {
    message = toFriendlyError(error.message);
    robotQueueActive = false;
    robotQueueStartedAt = 0;
    if (state && !isGameOver(state) && state.currentPlayerIndex !== HUMAN_INDEX) {
      queueRobotTurns();
    }
    render({ immediate: true, lite: true });
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
  let cards = selectedCards();
  // 防御：高亮推荐但未同步 selected 时，仍按 Top1 出牌（用户未手动改选牌）
  if (cards.length === 0 && hintShown && hintCardIds.size > 0) {
    adoptHint();
    return;
  }
  if (cards.length === 0) {
    notifyActionMessage("请先点选你想出的牌（选中后会向上浮起），再点「出牌」。");
    render();
    return;
  }

  const play = classifyPlay(cards, state.levelRank);
  if (play.type === PLAY_TYPES.invalid) {
    notifyActionMessage(cards.length > 1
      ? `已选 ${cards.length} 张（${cardsLabel(cards)}），不能作为一手牌打出，请只选一手合法牌型。`
      : play.reason
        ? `这组牌不合法：${play.reason}`
        : "这组牌型不合法，请重新选牌。");
    render();
    return;
  }
  tryPlay(cards, `你出了：${playLabel(play)} ${cardsLabel(cards)}`);
}

function playRecommended() {
  if (!state) return;
  if (hintShown) {
    cancelHint();
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

/** 计算超时/异常时的轻量建议，避免侧栏一直停在「正在计算」 */
function buildEmergencyHumanAdvice() {
  const hand = state.players[HUMAN_INDEX].hand;
  const pressing = isHumanPressing(state);
  const columnGroups = pressing ? currentHandPlayGroups() : [];
  const preferredGroups = pressing && columnGroups.length > 0
    ? mergePremiumStrategicGroups(
      columnGroups,
      hand,
      state.levelRank,
      buildStrategicGroups(hand, state.levelRank),
    )
    : columnGroups;
  const previousPlay = effectivePreviousPlay(state);
  const rec = humanAdviceFallback(hand, state.levelRank, previousPlay, preferredGroups, {
    state,
    playerIndex: HUMAN_INDEX,
    lastActivePlayerIndex: state.lastActivePlayerIndex,
  });
  return {
    playerIndex: HUMAN_INDEX,
    levelRank: state.levelRank,
    mustBeat: previousPlay ? serializePlay(previousPlay) : null,
    handProfile: null,
    recommendation: rec,
    alternatives: [],
    canPlay: rec.candidate.type !== PLAY_TYPES.pass,
    tableKey: buildAdviceTableKey(),
    _phase: "emergency",
  };
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

function robotWaitSeconds() {
  if (!robotQueueStartedAt || !robotQueueActive) return 0;
  return Math.max(0, Math.floor((performance.now() - robotQueueStartedAt) / 1000));
}

function clearRobotQueueActiveIfCurrent(generation) {
  if (generation === robotQueueGeneration) {
    robotQueueActive = false;
    robotQueueStartedAt = 0;
  }
}

/** 主线程长时间阻塞时 setTimeout watchdog 也会滞后，用渲染帧检测并强制兜底 */
function maybeRecoverStalledRobotQueue() {
  if (!state || isGameOver(state) || state.currentPlayerIndex === HUMAN_INDEX || autoGameRunning) return;

  if (!robotQueueActive) {
    queueRobotTurns();
    return;
  }

  // 假活跃：标志为 true 但从未真正调度（异常路径遗留）
  if (robotQueueActive && !robotQueueStartedAt) {
    console.warn("机器人队列假活跃，重启推进");
    robotQueueActive = false;
    queueRobotTurns();
    return;
  }

  if (robotWaitSeconds() < ROBOT_STALL_RECOVER_SEC) return;
  console.warn(`机器人队列停滞 ${robotWaitSeconds()}s，强制兜底恢复`);
  robotQueueTimedOut = true;
  robotQueueActive = false;
  robotQueueStartedAt = 0;
  cancelRobotQueueTimers();
  message = `${PLAYER_NAMES[state.currentPlayerIndex]} 走牌较慢，已自动兜底继续。`;
  if (kickStuckSession({ timeout: true })) {
    render({ immediate: true, lite: true });
    queueRobotTurns();
  } else {
    render({ immediate: true, lite: true });
    queueRobotTurns();
  }
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

/** 一圈结束（lastActivePlay 清空）时清桌心出牌；本 trick 内则追加该 seat 出牌 */
function syncTablePlaysForCurrentTrick(actorIndex, play) {
  if (!state?.lastActivePlay) {
    tablePlays = new Map();
    tableTrickLeaderIndex = null;
    if (play.type !== PLAY_TYPES.pass) {
      tablePlays.set(actorIndex, play);
      tableTrickLeaderIndex = actorIndex;
    }
    return;
  }
  tablePlays.set(actorIndex, play);
  if (play.type !== PLAY_TYPES.pass) {
    tableTrickLeaderIndex = actorIndex;
  }
}

/** 局末/未开局：桌心不应残留上一圈出牌 */
function shouldClearTablePlays() {
  return !state || isGameOver(state);
}

/** 渲染前对齐：state 已清台但 tablePlays 仍留上一圈时强制清空（含存档恢复） */
function reconcileTablePlaysWithState() {
  if (shouldClearTablePlays()) {
    if (tablePlays.size > 0 || tableTrickLeaderIndex !== null) {
      tablePlays = new Map();
      tableTrickLeaderIndex = null;
    }
    return;
  }
  if (!state.lastActivePlay) {
    if (tablePlays.size > 0 || tableTrickLeaderIndex !== null) {
      tablePlays = new Map();
      tableTrickLeaderIndex = null;
    }
    return;
  }
  if (
    tableTrickLeaderIndex !== state.lastActivePlayerIndex
    && state.lastActivePlayerIndex !== null
    && state.lastActivePlayerIndex !== undefined
  ) {
    tableTrickLeaderIndex = state.lastActivePlayerIndex;
  }
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

  if (!timeout || state.currentPlayerIndex === HUMAN_INDEX) {
    return false;
  }

  const actorIndex = state.currentPlayerIndex;
  try {
    let play;
    const previousPlay = effectivePreviousPlay(state);
    if (previousPlay) {
      play = classifyPlay([], state.levelRank);
      state = playCards(state, []);
    } else {
      const player = state.players[actorIndex];
      const tableCtx = {
        state,
        playerIndex: actorIndex,
        lastActivePlayerIndex: state.lastActivePlayerIndex,
        previousPlay: null,
      };
      const fallback = fastRobotFallback(player.hand, state.levelRank, null, tableCtx);
      play = fallback.candidate;
      state = playCards(state, play.cards);
    }
    syncTablePlaysForCurrentTrick(actorIndex, play);
    if (!silent) {
      message = play.type === PLAY_TYPES.pass
        ? `${PLAYER_NAMES[actorIndex]}：过牌（自动兜底）`
        : `${PLAYER_NAMES[actorIndex]}：${cardsLabel(play.cards)}（自动兜底）`;
    }
    return true;
  } catch (error) {
    console.warn("机器人兜底出牌失败", error);
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
  state = result.state;
  appendCoachAdviceRecord(adviceRecord);
  captureHeadTourReviewIfNeeded();
  syncTablePlaysForCurrentTrick(actorIndex, result.recommendation.candidate);
  const playerName = PLAYER_NAMES[actorIndex];
  message = `${playerName}：${result.recommendation.candidate.type === PLAY_TYPES.pass ? "过牌" : cardsLabel(result.recommendation.candidate.cards)}`;
}

function finishRobotQueueToHuman(generation) {
  robotQueueActive = false;
  robotQueueTimedOut = false;
  robotQueueStartedAt = 0;
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
  robotQueueTimedOut = false;
  robotQueueStartedAt = 0;
  cancelRobotQueueWatchdog(generation);
  onGameOverDetected();
  render({ immediate: true, lite: true });
  scheduleDeferredPanelsRender();
}

/** 正式对局机器人单步：推荐失败或超时时走 fastRobotFallback，避免队列卡死 */
function executeFormalRobotTurn(gameState, actorIndex) {
  const { state: normalized, repaired } = repairTurnStuck(gameState);
  const workingState = repaired ? normalized : gameState;
  if (repaired && workingState !== gameState) {
    state = workingState;
    syncTableAfterTrickRepair(workingState);
  }
  const player = workingState.players[actorIndex];
  const previousPlay = effectivePreviousPlay(workingState);
  const tableCtx = {
    state: workingState,
    playerIndex: actorIndex,
    lastActivePlayerIndex: workingState.lastActivePlayerIndex,
    previousPlay,
  };
  const opts = buildFormalRobotPlayOptions(workingState, actorIndex);
  try {
    return playRecommendedTurn(workingState, opts);
  } catch (error) {
    console.warn(`${PLAYER_NAMES[actorIndex]} 推荐异常，走兜底`, error);
    const fallback = fastRobotFallback(
      player.hand,
      workingState.levelRank,
      previousPlay,
      tableCtx,
    );
    return {
      state: playCards(workingState, fallback.candidate.cards),
      recommendation: fallback,
    };
  }
}

/** 单帧仅推一手机器人，步末 setTimeout(0) 让出主线程且 watchdog 能触发 */
function runRobotQueueStep(generation) {
  if (generation !== robotQueueGeneration || !state || isGameOver(state)) {
    clearRobotQueueActiveIfCurrent(generation);
    cancelRobotQueueWatchdog(generation);
    if (state && isGameOver(state)) onGameOverDetected();
    return;
  }
  if (state.currentPlayerIndex === HUMAN_INDEX) {
    finishRobotQueueToHuman(generation);
    return;
  }

  if (adviceComputeState.inFlight) {
    cancelAdviceCompute();
  }
  cancelIdleTask(adviceRefreshIdleRef);

  kickStuckSession({ silent: true });
  if (state.currentPlayerIndex === HUMAN_INDEX) {
    finishRobotQueueToHuman(generation);
    return;
  }

  if (detectTurnStuck(state)) {
    kickStuckSession({ silent: true });
    render({ immediate: true, lite: true });
    if (state.currentPlayerIndex === HUMAN_INDEX) {
      finishRobotQueueToHuman(generation);
      return;
    }
  }

  let stepOk = true;

  const actorIndex = state.currentPlayerIndex;
  const playerName = PLAYER_NAMES[actorIndex];
  const stepStarted = performance.now();

  try {
    const result = executeFormalRobotTurn(state, actorIndex);
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
    }
  }

  const stepElapsed = performance.now() - stepStarted;
  if (stepElapsed > ROBOT_STEP_SLOW_MS) {
    console.warn(`机器人单步耗时 ${Math.round(stepElapsed)}ms（${playerName}）`);
  }

  cancelRobotQueueWatchdog(generation);
  settleCompetitiveGameIfNeeded();

  if (state && isGameOver(state)) {
    finishRobotQueueGameOver(generation);
    return;
  }
  if (state?.currentPlayerIndex === HUMAN_INDEX) {
    finishRobotQueueToHuman(generation);
    return;
  }
  if (detectTurnStuck(state)) {
    clearRobotQueueActiveIfCurrent(generation);
    let recovered = kickStuckSession({ silent: true });
    if (!recovered) recovered = kickStuckSession({ timeout: true, silent: true });
    render({ immediate: true, lite: true });
    if (state?.currentPlayerIndex === HUMAN_INDEX) {
      scheduleHumanAdviceRefresh();
    } else if (recovered) {
      scheduleRobotStep(generation);
    } else {
      queueRobotTurns();
    }
    return;
  }
  if (!stepOk || generation !== robotQueueGeneration) {
    clearRobotQueueActiveIfCurrent(generation);
    render({ immediate: true, lite: true });
    if (!stepOk && generation === robotQueueGeneration && state && !isGameOver(state) && state.currentPlayerIndex !== HUMAN_INDEX) {
      queueRobotTurns();
    }
    return;
  }

  render({ immediate: true, lite: true });
  scheduleRobotStep(generation);
}

/** 每手 setTimeout(0) 调度下一步，让出主线程且 watchdog 能触发；无人为思考 delay */
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
      if (state?.currentPlayerIndex === HUMAN_INDEX && !isGameOver(state)) {
        scheduleHumanAdviceRefresh();
      }
      clearRobotQueueActiveIfCurrent(generation);
      robotQueueTimedOut = false;
      return;
    }
    console.warn("机器人出牌超时，尝试修复并继续。");
    robotQueueTimedOut = true;
    clearRobotQueueActiveIfCurrent(generation);
    message = `${PLAYER_NAMES[state.currentPlayerIndex]} 走牌超时，已自动兜底过牌并继续。`;
    if (kickStuckSession({ timeout: true })) {
      render({ immediate: true, lite: true });
      queueRobotTurns();
    } else {
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
  cancelIdleTask(adviceRefreshIdleRef);
  if (adviceComputeState.inFlight) {
    cancelAdviceCompute();
  }
  robotQueueGeneration += 1;
  robotQueueTimedOut = false;
  robotQueueStartedAt = performance.now();
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
      const robotOpts = buildFormalRobotPlayOptions(state, actorIndex);
      const adviceBeforePlay = getTurnAdvice(state, actorIndex, {
        ...robotOpts,
        alternatives: 3,
        handProfile: null,
      });
      const adviceRecord = serializeCoachAdvice(
        adviceBeforePlay,
        adviceBeforePlay.recommendation.candidate,
        "auto-game",
      );
      const result = playRecommendedTurn(state, robotOpts);
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
      syncTablePlaysForCurrentTrick(actorIndex, result.recommendation.candidate);
      batch += 1;
    }

    message = `自动对局中… 已打 ${transcript.length} 手`;
    render();

    if (state && !isGameOver(state) && transcript.length < 600) {
      window.setTimeout(step, 0);
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
  const container = activePlayersEl();
  if (!container) return;
  container.replaceChildren();
  if (!state) return;

  for (const player of state.players) {
    const node = document.createElement("div");
    const isActive = player.seatIndex === state.currentPlayerIndex;
    const isRobotWalking = isActive
      && state.currentPlayerIndex !== HUMAN_INDEX
      && robotQueueActive
      && !isGameOver(state);
    node.className = [
      "player",
      isActive ? "active" : "",
      isRobotWalking ? "robot-walking" : "",
    ].filter(Boolean).join(" ");
    node.dataset.seat = String(player.seatIndex);
    node.dataset.avatar = PLAYER_AVATARS[player.seatIndex];
    const finishedMeta = player.finishedOrder ? `<div class="player-meta">第 ${player.finishedOrder} 名出完</div>` : "";
    node.innerHTML = `
      <div class="player-title">
        <span>${PLAYER_NAMES[player.seatIndex]}</span>
        <span>${player.hand.length}</span>
      </div>
      ${finishedMeta}
    `;
    container.append(node);
  }
}

function purgeSeatPlayContainers() {
  if (elements.seatPlays) elements.seatPlays.replaceChildren();
  if (elements.mlSeatPlays) elements.mlSeatPlays.replaceChildren();
}

/** 人类轮次且桌心三钮可见（须跟牌或领出空白 trick） */
function isMobileHumanActionsVisible() {
  if (!isMobileLandscape() || !state || isGameOver(state)) return false;
  const dealing = Boolean(elements.newGame?.disabled);
  if (dealing || state.currentPlayerIndex !== HUMAN_INDEX) return false;
  const trickReadyForHumanActions = !state.lastActivePlay ? tablePlays.size === 0 : true;
  return trickReadyForHumanActions;
}

/** 手机横屏：本 trick 内各家出牌显示在对应座位前；须压牌高亮但不挪到桌心 */
function renderMobileSeatPlays(container) {
  const hideOwnPlay = isMobileHumanActionsVisible();
  for (let seatIndex = 0; seatIndex < PLAYER_NAMES.length; seatIndex += 1) {
    if (hideOwnPlay && seatIndex === HUMAN_INDEX) continue;
    if (!tablePlays.has(seatIndex)) continue;
    const play = tablePlays.get(seatIndex);
    const isActivePlay = tableTrickLeaderIndex === seatIndex && play && play.type !== PLAY_TYPES.pass;
    const node = document.createElement("div");
    node.className = [
      "seat-play",
      play && play.type === PLAY_TYPES.pass ? "pass" : "",
      isActivePlay ? "active-play" : "",
    ].filter(Boolean).join(" ");
    node.dataset.seat = String(seatIndex);
    const cards = document.createElement("div");
    cards.className = "seat-cards ml-seat-play-cards";
    if (play && play.type !== PLAY_TYPES.pass) {
      for (const card of play.cards) {
        cards.append(renderCard(card, { tablePlay: true }));
      }
    }
    node.append(cards);
    container.append(node);
  }
}

function renderSeatPlays() {
  purgeSeatPlayContainers();
  const container = activeSeatPlaysEl();
  if (!container || shouldClearTablePlays()) return;
  const mobile = isMobileLandscape();
  if (mobile) {
    renderMobileSeatPlays(container);
    return;
  }
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
    container.append(node);
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
      ? (gameReviewOverlayDismissed && !isMobileLayout()
        ? "点击此处看复盘"
        : "点击“新开一局”继续练牌")
    : state.currentPlayerIndex === HUMAN_INDEX
      ? "轮到你出牌"
      : robotQueueActive
        ? `${PLAYER_NAMES[state.currentPlayerIndex]} 正在走牌…`
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
    elements.lastPlayTitle.textContent = trickPromptLabel(state);
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
    if (state && !isGameOver(state)) {
      const drillLine = buildSingleGameMatchSummary(currentGameMeta?.drillFocus);
      elements.matchSummary.textContent = currentGameMeta?.drillFocus
        ? drillLine
        : `本局进行中 · 第 ${state.turnNumber} 手；可先理牌再出牌。`;
    } else if (state && isGameOver(state)) {
      elements.matchSummary.textContent = "本局已结束；可新开一局继续练习。";
    } else {
      elements.matchSummary.textContent = buildSingleGameMatchSummary(currentGameMeta?.drillFocus);
    }
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

/** 人类手牌；ensureHandColumns 空时 fallback 每张一列 */
function resolveHandColumnIds(hand) {
  let columns = ensureHandColumns();
  if (columns.length === 0 && hand.length > 0) {
    columns = hand.map((card) => [cardId(card)]);
  }
  return columns;
}

/** 桌面/手机共用：向指定容器写入 hand-column + card */
function renderHandColumnsTo(handEl, { reorderable = false, mobileColumn = false } = {}) {
  if (!handEl) return;
  handEl.replaceChildren();
  if (!state || isGameOver(state)) return;
  handEl.classList.remove("hand-fan");
  if (reorderable) {
    handEl.ondragover = handleHandDragOver;
    handEl.ondrop = handleHandDrop;
  } else {
    handEl.ondragover = null;
    handEl.ondrop = null;
  }
  const hand = state.players[HUMAN_INDEX].hand;
  const cardById = new Map(hand.map((card) => [cardId(card), card]));
  const columns = resolveHandColumnIds(hand);
  const selectable = state.currentPlayerIndex === HUMAN_INDEX;
  for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
    const column = columns[columnIndex];
    const columnNode = document.createElement("div");
    columnNode.className = "hand-column";
    columnNode.dataset.columnIndex = String(columnIndex);
    if (reorderable) {
      columnNode.addEventListener("dragover", handleColumnDragOver);
      columnNode.addEventListener("drop", (event) => handleColumnDrop(event, columnIndex));
    }
    const cards = column.map((id) => cardById.get(id)).filter(Boolean);
    const allSelected = cards.length > 0 && column.every((id) => selectedIds.has(id));
    if (allSelected) columnNode.classList.add("column-selected");
    for (let cardIndex = 0; cardIndex < cards.length; cardIndex += 1) {
      const card = cards[cardIndex];
      columnNode.append(renderCard(card, {
        selectable,
        reorderable,
        mobileColumn,
        columnIndex,
        cardIndex,
      }));
    }
    handEl.append(columnNode);
  }
}

/** 按毡区宽度同步各家出牌单牌尺寸（最多横排 8 张） */
function syncMobileSeatPlayMetrics() {
  const root = elements.landscapeRoot;
  if (!isMobileLandscape() || !root) {
    root?.style.removeProperty("--ml-seat-play-zone-w");
    root?.style.removeProperty("--ml-seat-side-zone-w");
    root?.style.removeProperty("--ml-seat-card-w");
    root?.style.removeProperty("--ml-seat-card-h");
    root?.style.removeProperty("--ml-seat-side-card-w");
    root?.style.removeProperty("--ml-seat-side-card-h");
    return;
  }
  const vw = window.visualViewport?.width ?? window.innerWidth ?? 800;
  const gap = 3;
  const slots = 8;
  const zoneW = Math.min(vw - 120, vw * 0.85);
  const sideZoneW = Math.min(Math.round(vw * 0.36), zoneW);
  const cardW = Math.min(56, Math.max(30, Math.floor((zoneW - (slots - 1) * gap) / slots)));
  const sideCardW = Math.min(56, Math.max(28, Math.floor((sideZoneW - (slots - 1) * gap) / slots)));
  const cardH = Math.round(cardW * 1.5);
  const sideCardH = Math.round(sideCardW * 1.5);
  root.style.setProperty("--ml-seat-play-zone-w", `${Math.round(zoneW)}px`);
  root.style.setProperty("--ml-seat-side-zone-w", `${sideZoneW}px`);
  root.style.setProperty("--ml-seat-card-w", `${cardW}px`);
  root.style.setProperty("--ml-seat-card-h", `${cardH}px`);
  root.style.setProperty("--ml-seat-side-card-w", `${sideCardW}px`);
  root.style.setProperty("--ml-seat-side-card-h", `${sideCardH}px`);
}

/** 桌面桌心三钮：仅人类回合显示 */
function syncDesktopCenterActions() {
  if (isMobileLandscape()) return;
  const center = elements.centerActions;
  if (!center) return;
  const gameOver = state && isGameOver(state);
  const dealing = Boolean(elements.newGame?.disabled);
  const humanTurn = Boolean(
    state && !gameOver && !dealing && state.currentPlayerIndex === HUMAN_INDEX,
  );
  center.hidden = !humanTurn;
  center.classList.toggle("center-actions-hidden", !humanTurn);
}

/** 手机横屏桌心三钮显隐：仅人类可行动时显示，其余不占位隐藏 */
function syncMobileCenterActions() {
  if (!isMobileLandscape()) return;
  const center = elements.mlCenter;
  if (!center) return;

  const noGame = !state;
  const gameOver = state && isGameOver(state);
  const dealing = Boolean(elements.newGame?.disabled);
  const showMlNewGame = noGame || gameOver;
  const humanTurn = Boolean(
    state && !gameOver && !dealing && state.currentPlayerIndex === HUMAN_INDEX,
  );
  const showActions = humanTurn && !showMlNewGame && isMobileHumanActionsVisible();

  if (elements.mlNewGame) elements.mlNewGame.hidden = !showMlNewGame;
  for (const id of ["mlPassTurn", "mlPlayRecommended", "mlPlaySelected"]) {
    const btn = elements[id];
    if (btn) btn.hidden = !showActions;
  }

  const showCenter = showMlNewGame || showActions;
  center.hidden = !showCenter;
  center.classList.toggle("ml-center-hidden", !showCenter);
}

/** 量测桌心三钮带高度，供 seat-0 上浮定位（避免 bbox 与 #mlCenter 交叉） */
function syncMobileActionBandMetrics() {
  const root = elements.landscapeRoot;
  if (!isMobileLandscape() || !root || !elements.mlCenter) {
    root?.style.removeProperty("--ml-action-band-h");
    return;
  }
  const center = elements.mlCenter;
  const hidden = center.hidden
    || center.classList.contains("ml-center-hidden")
    || center.offsetParent === null;
  if (hidden) {
    root.style.setProperty("--ml-action-band-h", "0px");
    return;
  }
  const bandH = Math.ceil(center.getBoundingClientRect().height);
  root.style.setProperty("--ml-action-band-h", `${Math.max(40, bandH)}px`);
}

/** 手机横屏手牌工具列内容高度（双钮 + 间距；safe-area 由 CSS padding 承担，避免量测偏小裁切教练） */
function mlHandToolsMinHeight() {
  const tools = document.querySelector("#landscapeRoot .ml-hand-tools");
  const theoretical = 32 + 8 + 32 + 4;
  if (!tools) return theoretical;
  const measured = Math.ceil(tools.scrollHeight || tools.offsetHeight);
  return Math.max(theoretical, measured);
}

/** 手机横屏：理牌/教练 FAB 始终可见（与理牌并列） */
function syncMlHandToolsChrome() {
  if (!isMobileLandscape()) return;
  for (const btn of [elements.mlSortHand, elements.mlCoachFab]) {
    if (!btn) continue;
    btn.hidden = false;
    btn.style.removeProperty("display");
    btn.style.removeProperty("visibility");
    btn.style.removeProperty("opacity");
  }
}

/** 手机横屏手牌：牌高比（仅底栏叠列，非出牌区 3:2） */
const ML_HAND_CARD_ASPECT = 1.28;
/** 叠牌列可见顶条：占牌高比例（与 mobile-ui.css --ml-hand-peek-h 同步） */
const ML_HAND_PEEK_RATIO = 0.44;
const ML_HAND_PEEK_MIN = 32;
const ML_HAND_PEEK_MAX = 42;
const ML_HAND_PEEK_FLOOR = 26;
/** 按列深算 stack/bar；bar 必 ≥ stack + safe-bottom，超预算时缩 peek / cardW 而非裁底牌 */
function syncMobileHandMetrics() {
  const root = elements.landscapeRoot;
  if (!isMobileLandscape() || !root || !state || isGameOver(state)) {
    root?.style.removeProperty("--ml-hand-stack-h");
    root?.style.removeProperty("--ml-hand-bar-h");
    root?.style.removeProperty("--ml-hand-peek-h");
    root?.style.removeProperty("--ml-hand-col-overlap");
    root?.style.removeProperty("--ml-card-w");
    root?.style.removeProperty("--ml-card-h");
    root?.style.removeProperty("--ml-card-aspect");
    return;
  }
  const columns = resolveHandColumnIds(state.players[HUMAN_INDEX].hand);
  const maxDepth = Math.max(1, ...columns.map((col) => col.length));
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const rootStyle = getComputedStyle(root);
  const hudH = parseFloat(rootStyle.getPropertyValue("--ml-hud-h")) || 40;
  const safeBottom = parseFloat(rootStyle.getPropertyValue("--safe-bottom")) || 0;
  const barPadBottom = 4 + safeBottom;
  const barPadExtra = 4;
  const toolsColH = mlHandToolsMinHeight();
  const stageH = Math.max(120, vh - hudH);
  const handBarBudget = Math.min(vh * 0.44, stageH * 0.5, 252);

  const sampleCard = elements.mlHand?.querySelector(".hand-column .card");
  const vw = window.visualViewport?.width ?? window.innerWidth ?? 800;
  const defaultCardW = Math.min(58, Math.max(42, vw * 0.1));
  let cardW = sampleCard
    ? parseFloat(getComputedStyle(sampleCard).width) || defaultCardW
    : parseFloat(rootStyle.getPropertyValue("--ml-card-w")) || defaultCardW;
  const minCardW = 38;

  function metricsFor(cardWidth, peekH) {
    const cH = Math.ceil(cardWidth * ML_HAND_CARD_ASPECT);
    const stack = Math.ceil(cH + (maxDepth - 1) * peekH + barPadExtra);
    const bar = Math.ceil(Math.max(stack + barPadBottom, toolsColH + barPadBottom) + barPadExtra);
    return { cardH: cH, stackH: stack, barH: bar, peekH: peekH };
  }

  function targetPeekFor(cardWidth) {
    return Math.round(Math.min(
      ML_HAND_PEEK_MAX,
      Math.max(ML_HAND_PEEK_MIN, cardWidth * ML_HAND_CARD_ASPECT * ML_HAND_PEEK_RATIO),
    ));
  }

  let peekHeight = targetPeekFor(cardW);
  let m = metricsFor(cardW, peekHeight);

  while (m.barH > handBarBudget && peekHeight > ML_HAND_PEEK_FLOOR) {
    peekHeight -= 1;
    m = metricsFor(cardW, peekHeight);
  }
  while (m.barH > handBarBudget && cardW > minCardW) {
    cardW -= 1;
    peekHeight = targetPeekFor(cardW);
    while (m.barH > handBarBudget && peekHeight > ML_HAND_PEEK_FLOOR) {
      peekHeight -= 1;
      m = metricsFor(cardW, peekHeight);
    }
    m = metricsFor(cardW, peekHeight);
  }

  root.style.setProperty("--ml-hand-peek-h", `${peekHeight}px`);
  root.style.setProperty("--ml-hand-col-overlap", `calc((${m.cardH}px - ${peekHeight}px) * -1)`);
  root.style.setProperty("--ml-hand-stack-h", `${m.stackH}px`);
  root.style.setProperty("--ml-hand-bar-h", `${m.barH}px`);
  root.style.setProperty("--ml-card-w", `${cardW}px`);
  root.style.setProperty("--ml-card-h", `${m.cardH}px`);
  root.style.setProperty("--ml-card-aspect", String(ML_HAND_CARD_ASPECT));
}

function renderMobileHandColumns() {
  renderHandColumnsTo(elements.mlHand, { reorderable: false, mobileColumn: true });
  syncMobileHandMetrics();
  syncMlHandToolsChrome();
}

function renderDesktopHand() {
  renderHandColumnsTo(elements.hand, { reorderable: true, mobileColumn: false });
}

function renderHand() {
  if (isMobileLandscape()) {
    purgeDesktopHandOnMobile();
    renderMobileHandColumns();
    return;
  }
  if (isMobileLayout()) {
    purgeDesktopHandOnMobile();
    if (elements.mlHand) elements.mlHand.replaceChildren();
    return;
  }
  renderDesktopHand();
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

function keyPauseRecommendLine() {
  const advice = currentAdvice;
  if (advice?.recommendation) {
    const rec = advice.recommendation;
    const label = rec.candidate.label || (rec.candidate.type === PLAY_TYPES.pass ? "过牌" : "推荐牌");
    const reason = firstReasonForUser(rec.reasons);
    return reason ? `${label}（${reason}）` : label;
  }
  const context = keyPauseOverlay?.message?.replace(/^关键时刻：/, "") ?? "";
  return context || "正在计算推荐…";
}

function handleKeyPauseAction(action) {
  if (action === "think") dismissKeyPause();
  else if (action === "hint") keyPauseShowHint();
  else if (action === "disable") {
    if (elements.useKeyPause) elements.useKeyPause.checked = false;
    if (elements.mobileKeyPause) elements.mobileKeyPause.checked = false;
    onKeyPauseToggle();
  }
}

function renderKeyPauseBanner() {
  if (!elements.keyPauseBanner) return;
  const mobileLandscape = isMobileLandscape();
  if (!keyPauseOverlay || (mobileLandscape && hintShown)) {
    elements.keyPauseBanner.hidden = true;
    elements.keyPauseBanner.replaceChildren();
    mirrorMobileBanner(elements.keyPauseBanner, elements.mlKeyPauseBanner);
    return;
  }
  // 横屏：推荐走顶栏 #mlHudAdvice，桌心 ml-banners 不渲染（避免绝对定位+父高塌陷裁切白条）
  if (mobileLandscape) {
    elements.keyPauseBanner.hidden = true;
    elements.keyPauseBanner.replaceChildren();
    mirrorMobileBanner(elements.keyPauseBanner, elements.mlKeyPauseBanner);
    return;
  }
  elements.keyPauseBanner.hidden = false;
  elements.keyPauseBanner.innerHTML = `
    <div class="key-pause-head">
      <strong>推荐</strong>
      <button class="key-pause-never" type="button" data-key-pause-action="disable" title="关闭关键时刻推荐">不再提示</button>
    </div>
    <p class="key-pause-msg">这手建议：${escapeHtml(keyPauseRecommendLine())}</p>
    <div class="key-pause-actions">
      <button class="btn" type="button" data-key-pause-action="think" title="关闭弹窗，自己选牌出牌">取消</button>
      <button class="btn primary" type="button" data-key-pause-action="hint" title="展开教练推荐并高亮牌">看推荐</button>
    </div>
  `;
  mirrorMobileBanner(elements.keyPauseBanner, elements.mlKeyPauseBanner);
}

function syncMobileCoachHudLine() {
  if (!elements.mlHudAdvice) return;
  const mobile = isMobileLandscape();
  const humanTurn = state && state.currentPlayerIndex === HUMAN_INDEX && !isGameOver(state);
  if (mobile && !guidesEnabled() && !hintShown && !keyPauseOverlay && (!state || isGameOver(state))) {
    elements.mlHudAdvice.hidden = false;
    elements.mlHudAdvice.innerHTML =
      `<strong>试玩</strong><span>点「新开一局」开始 · 底栏「教练」可看推荐与提问</span>`;
    return;
  }
  if (mobile && humanTurn && keyPauseOverlay && !hintShown) {
    elements.mlHudAdvice.hidden = false;
    elements.mlHudAdvice.innerHTML = `
      <strong>推荐</strong>
      <span>这手建议：${escapeHtml(keyPauseRecommendLine())}</span>
      <button class="ml-hud-link" type="button" data-key-pause-action="think">知道了</button>
      <button class="ml-hud-link" type="button" data-key-pause-action="disable">不再提示</button>
    `;
    return;
  }
  if (!mobile || !humanTurn || !hintShown || !hintAdvice) {
    elements.mlHudAdvice.hidden = true;
    elements.mlHudAdvice.replaceChildren();
    return;
  }
  const rec = hintAdvice.recommendation;
  const reason = firstReasonForUser(rec.reasons);
  const label = rec.candidate.label || (rec.candidate.type === PLAY_TYPES.pass ? "过牌" : "推荐牌");
  const drillTip = buildDrillAdviceTip(
    { reasons: rec.reasons, candidate: rec.candidate },
    currentGameMeta?.drillFocus,
  );
  elements.mlHudAdvice.hidden = false;
  elements.mlHudAdvice.innerHTML = `
    <strong>推荐</strong>
    <span>${escapeHtml(label)} · ${escapeHtml(reason)}${drillTip ? ` · ${escapeHtml(drillTip)}` : ""}</span>
  `;
}

function renderHintBanner() {
  syncMobileCoachHudLine();
  if (isMobileLandscape()) {
    if (elements.hintBanner) {
      elements.hintBanner.hidden = true;
      elements.hintBanner.replaceChildren();
    }
    if (elements.mlHintBanner) {
      elements.mlHintBanner.hidden = true;
      elements.mlHintBanner.replaceChildren();
    }
    return;
  }
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

function canReopenGameReview() {
  return Boolean(state && isGameOver(state));
}

function openGameReviewOverlay() {
  if (!canReopenGameReview()) return;
  gameReviewOverlayDismissed = false;
  setMobileMenuOpen(false);
  syncMobileLayoutClass();
  renderGameReviewPanel();
  renderControls();
}

function dismissGameReviewOverlay() {
  if (!isGameReviewOverlayOpen()) return;
  gameReviewOverlayDismissed = true;
  syncMobileLayoutClass();
  renderGameReviewPanel();
  renderControls();
}

/** 局末关闭复盘后，同步菜单/竖屏遮罩/顶栏 chip / 桌面状态条的「再看复盘」入口 */
function syncGameReviewReopenUi() {
  const reviewReopen = canReopenGameReview() && gameReviewOverlayDismissed;
  if (elements.mobileViewReview) {
    elements.mobileViewReview.hidden = !reviewReopen;
  }
  if (elements.portraitBlockerReview) {
    elements.portraitBlockerReview.hidden = !reviewReopen;
  }
  if (elements.mobileTurnChip && isMobileLandscape() && canReopenGameReview()) {
    elements.mobileTurnChip.textContent = reviewReopen ? "本局结束 · 看复盘" : "本局结束";
    elements.mobileTurnChip.classList.toggle("review-reopen", reviewReopen);
    if (reviewReopen) {
      elements.mobileTurnChip.setAttribute("role", "button");
      elements.mobileTurnChip.tabIndex = 0;
      elements.mobileTurnChip.title = "点此再看本局复盘";
      elements.mobileTurnChip.setAttribute("aria-label", "点此再看本局复盘");
    } else {
      elements.mobileTurnChip.removeAttribute("role");
      elements.mobileTurnChip.removeAttribute("tabindex");
      elements.mobileTurnChip.removeAttribute("title");
      elements.mobileTurnChip.removeAttribute("aria-label");
    }
  }
  const turnStatusEntry = elements.turnTitle?.closest(".status");
  if (turnStatusEntry && !isMobileLayout()) {
    turnStatusEntry.classList.toggle("review-reopen-entry", reviewReopen);
    if (reviewReopen) {
      turnStatusEntry.setAttribute("role", "button");
      turnStatusEntry.tabIndex = 0;
      turnStatusEntry.setAttribute("aria-label", "打开本局复盘");
      turnStatusEntry.title = "点击看本局复盘";
    } else {
      turnStatusEntry.removeAttribute("role");
      turnStatusEntry.removeAttribute("tabindex");
      turnStatusEntry.removeAttribute("aria-label");
      turnStatusEntry.removeAttribute("title");
    }
  }
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

/** 局末「本可更好」优先教练更对 / 存疑，最多 5 条 */
function pickImproveItems(summary, limit = 5) {
  const priority = [
    DIVERGENCE_VERDICTS.COACH_BETTER,
    DIVERGENCE_VERDICTS.COACH_QUESTIONABLE,
    DIVERGENCE_VERDICTS.STYLE,
  ];
  const items = [];
  for (const verdict of priority) {
    for (const item of divergencesByVerdict(summary, verdict)) {
      items.push(item);
      if (items.length >= limit) return items;
    }
  }
  return items;
}

function renderGameResultLine() {
  if (!state || !isGameOver(state)) return "";
  const winner = completedTeam(state);
  const rankLine = state.finishedPlayers
    .map((index, order) => `第${order + 1} ${PLAYER_NAMES[index]}`)
    .join(" · ");
  if (winner) {
    return `<p class="game-result-line"><strong>${escapeHtml(winner.label)}${escapeHtml(winner.result)}</strong> · ${escapeHtml(rankLine)}</p>`;
  }
  return `<p class="game-result-line">${escapeHtml(rankLine)}</p>`;
}

function formatReviewPlayText(item) {
  if (item.play.type === PLAY_TYPES.pass) return "过牌";
  return `${playLabel(item.play)} ${cardsLabel(item.play.cards)}`;
}

function reviewPlayItemsFromArchive(archive) {
  const stored = archive?.playHistory ?? archive?.recentPlays ?? [];
  return Array.isArray(stored) ? stored : [];
}

function renderReviewCardChipsHtml(cards) {
  if (!cards?.length) return "<span class=\"review-empty\">已出完</span>";
  return sortCardsForDisplay(cards)
    .map((card) => `<span class="review-card-chip">${escapeHtml(card.label ?? cardLabel(card))}</span>`)
    .join("");
}

function renderReviewRemainingHandsHtml(archive = null) {
  let rows = [];
  if (state && isGameOver(state) && state.finishedPlayers.length >= 2) {
    rows = state.finishedPlayers.slice(1, 4).map((playerIndex, index) => ({
      orderLabel: ["二游", "三游", "四游"][index] ?? `第${index + 2}名`,
      playerName: PLAYER_NAMES[playerIndex],
      cards: sortCardsForDisplay(state.players[playerIndex].hand),
    }));
  } else if (archive?.endRemainingHands?.length) {
    rows = archive.endRemainingHands.map((entry) => ({
      orderLabel: ["二游", "三游", "四游"][entry.order - 2] ?? `第${entry.order}名`,
      playerName: entry.playerName,
      cards: entry.cards ?? [],
    }));
  }
  if (rows.length === 0) return "";

  let html = "<details class=\"review-block review-remaining-hands\" open><summary>局末剩牌</summary><div class=\"review-remaining-list\">";
  for (const row of rows) {
    html += `<div class="review-remaining-row">`
      + `<div class="review-remaining-title"><strong>${escapeHtml(row.orderLabel)} · ${escapeHtml(row.playerName)}</strong>`
      + `<span>${row.cards.length} 张</span></div>`
      + `<div class="review-remaining-cards">${renderReviewCardChipsHtml(row.cards)}</div>`
      + "</div>";
  }
  html += "</div></details>";
  return html;
}

function renderReviewPlayHistoryHtml(summary, archive = null) {
  const items = archive ? reviewPlayItemsFromArchive(archive) : allReviewPlaysFromState();
  if (items.length === 0) return "";
  const total = archive?.playHistoryTotal ?? state?.playHistory?.length ?? items.length;
  const note = `（共 ${total} 手）`;

  let html = `<details class="review-block review-play-history" open><summary>本局出牌 ${note}</summary><ol class="review-play-list">`;
  for (const item of items) {
    const diverged = (summary?.divergences ?? []).some((d) => d.turnNumber === item.turnNumber);
    const playerName = item.playerName ?? PLAYER_NAMES[item.playerIndex] ?? "—";
    const playText = item.play?.label
      ?? (item.play?.type === PLAY_TYPES.pass ? "过牌" : formatReviewPlayText(item));
    html += `<li class="review-play-row${diverged ? " review-play-row--diverged" : ""}" data-hand-index="${item.turnNumber}">`
      + `<span class="review-play-turn">第 ${item.turnNumber} 手</span> `
      + `<strong>${escapeHtml(playerName)}</strong> `
      + `<span>${escapeHtml(playText)}</span></li>`;
  }
  html += "</ol></details>";
  return html;
}

function buildReviewArchiveExtras() {
  const snapshot = currentGameSnapshot("complete");
  const plays = allReviewPlaysFromState();
  return {
    playHistory: plays,
    recentPlays: plays,
    endRemainingHands: slimEndRemainingHands(snapshot),
    playHistoryTotal: state?.playHistory?.length ?? plays.length,
  };
}

function renderImproveCards(summary) {
  if (!elements.improveCards) return;
  const gameOver = state && isGameOver(state);
  const improveItems = pickImproveItems(summary, 5);

  if (!gameOver || improveItems.length === 0) {
    elements.improveCards.hidden = true;
    elements.improveCards.classList.remove("improve-cards--highlight");
    elements.improveCards.replaceChildren();
    return;
  }

  elements.improveCards.hidden = false;
  elements.improveCards.classList.add("improve-cards--highlight");
  let html = `<h3>本可更好</h3><p class="muted improve-cards-sub">共 ${improveItems.length} 处，点手数可看对比</p><div class="improve-cards-list">`;
  for (const item of improveItems) {
    const reason = item.verdictNote || firstReasonForUser(item.recommendedReasons, "详见差异说明");
    html += `<article class="improve-card" data-hand-index="${item.turnNumber}" role="button" tabindex="0" title="点击查看推荐对比并定位出牌记录">
      <span class="improve-card-turn">第 ${item.turnNumber} 手</span>
      <p>你出 <strong>${escapeHtml(item.actual)}</strong>，可试 <strong>${escapeHtml(item.recommended)}</strong></p>
      <p class="improve-card-reason">${escapeHtml(reason)}</p>
    </article>`;
  }
  html += "</div>";
  elements.improveCards.innerHTML = html;
}

function renderMobileAdviceStrip() {
  renderCoachSheetAdvice();
  if (!elements.mobileAdviceStrip || isMobileLayout()) return;
  const humanTurn = state && state.currentPlayerIndex === HUMAN_INDEX && !isGameOver(state);
  if (!humanTurn || !currentAdvice) {
    elements.mobileAdviceStrip.hidden = true;
    elements.mobileAdviceStrip.replaceChildren();
    return;
  }
  const rec = currentAdvice.recommendation;
  const reason = firstReasonForUser(rec.reasons);
  const label = rec.candidate.label || (rec.candidate.type === PLAY_TYPES.pass ? "过牌" : "推荐牌");
  elements.mobileAdviceStrip.hidden = false;
  elements.mobileAdviceStrip.innerHTML = `
    <strong>推荐</strong>
    <span class="mobile-advice-play">${escapeHtml(label)}</span>
    <span class="mobile-advice-reason">${escapeHtml(reason)}</span>
  `;
}

const ONBOARDING_STEPS = [
  { step: 1, target: () => (isMobileLandscape() ? elements.mlNewGame : elements.newGame), text: "第一步：点「新开一局」发牌开始练习。" },
  { step: 2, target: () => elements.playRecommended, text: "第二步：轮到你时点「提示」，先看推荐牌和理由。" },
  { step: 3, target: () => elements.improveCards?.hidden ? elements.submitGameReview : elements.improveCards, text: "第三步：打完一局后，右侧会自动给出「本可更好」简要复盘。" },
];

function guidesEnabled() {
  return safeGetItem(GUIDE_ENABLED_STORAGE, "0") === "1";
}

function onboardingDone() {
  if (!guidesEnabled()) return true;
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
  if (!guidesEnabled() || onboardingDone() || onboardingStep <= 0) {
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
  if (!guidesEnabled() || onboardingDone()) {
    if (elements.onboardingOverlay) elements.onboardingOverlay.hidden = true;
    if (elements.onboardingRing) elements.onboardingRing.hidden = true;
    return;
  }
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
  { id: "coachFab", text: "点「教练」可看推荐1与理由，并向本机规则引擎提问。" },
  { id: "rules", text: "「规则」可随时查看牌型、贡牌等速查说明。" },
  { id: "drill", text: "菜单（⋯）→「专项练习」可按弱项开预设局，教练会标【专项】。" },
  { id: "saveReview", text: "打完一局后，会自动给出「本可更好」简要复盘。" },
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
  if (!guidesEnabled()) return true;
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
      return isMobileLandscape() || Boolean(elements.drillPanel);
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
  if (isMobileLandscape() && keyPauseOverlay) {
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
  if (isMobileLandscape() && keyPauseOverlay) {
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
  if (isMobileLandscape() && state?.currentPlayerIndex === HUMAN_INDEX && !isGameOver(state)) {
    maybeTriggerKeyPause();
    renderKeyPauseBanner();
  }
}

function renderAdvice({ computeAdvice = true } = {}) {
  elements.advice.replaceChildren();
  invalidateStaleAdvice();
  if (!state) {
    currentAdvice = null;
    elements.advice.innerHTML = `<div class="advice-box"><p>开局后自动记录你与推荐的差异。</p></div>`;
    return;
  }

  const autoBox = document.createElement("div");
  autoBox.className = "advice-box advice-auto";
  autoBox.innerHTML = `
    <p class="muted">专注打牌即可，局末会自动给你简要复盘。</p>
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
    wait.innerHTML = robotQueueTimedOut
      ? `<h3>对手走牌中</h3><p>${actorName} 走牌超时，已自动兜底；若仍卡住请刷新页面。</p>`
      : robotQueueActive
        ? `<h3>对手走牌中</h3><p>${actorName} 正在走牌，很快轮到你。</p>`
        : `<h3>等待出牌</h3><p>轮到你时，这里会显示推荐与理由。</p>`;
    elements.advice.append(wait);
    return;
  }

  if (computeAdvice) {
    if (!isAdvicePhaseComplete() && !adviceComputeState.inFlight) {
      scheduleHumanAdviceRefresh();
    }
  }
  if (!currentAdvice) {
    ensureHumanAdvicePlaceholder();
  }
  if (!currentAdvice) {
    const pending = document.createElement("div");
    pending.className = "advice-box";
    pending.innerHTML = `<h3>教练建议</h3><p>${advicePendingMessage()}</p>`;
    elements.advice.append(pending);
    return;
  }

  const advice = currentAdvice;
  const liveMustBeat = trickPromptLabel(state);

  const recommendation = document.createElement("div");
  recommendation.className = "advice-box";
  const choices = adviceChoices(advice);
  recommendation.innerHTML = `
    <h3>教练建议</h3>
    <p>${liveMustBeat}</p>
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

  const buildTag = document.createElement("p");
  buildTag.className = "advice-build-tag";
  buildTag.style.cssText = "font-size:11px;opacity:0.55;margin-top:8px;";
  const build = globalThis.__GUANDAN_BUILD__ ?? "未知";
  buildTag.textContent = `策略 build ${build} · rev ${COACH_STRATEGY_REVISION}`;
  recommendation.append(buildTag);

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
  if (keyPauseOverlay) renderKeyPauseBanner();
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

  let html = "";
  if (gameOver) {
    html += renderGameResultLine();
    html += renderReviewRemainingHandsHtml();
    const reviewArchive = submitted ? findReviewHistoryGame(currentGameMeta?.gameId) : null;
    html += renderReviewPlayHistoryHtml(summary, reviewArchive);
    const improveItems = pickImproveItems(summary);
    if (improveItems.length === 0 && summary.divergenceCount === 0 && summary.totalHands > 0) {
      html += "<p class=\"muted\">本局与教练推荐一致，打得不错。</p>";
    }
    if (summary.divergenceCount > 0) {
      html += `<details class="review-advanced-details"><summary>查看全部差异（${summary.divergenceCount} 处）</summary>`;
      html += formatVerdictStats(summary, { interactive: true, activeFilter: divergenceVerdictFilter });
      html += renderDivergenceListHtml(divergencesByVerdict(summary, divergenceVerdictFilter));
      const disputeCount = (currentGameMeta?.userDisputes ?? []).length;
      if (disputeCount > 0) {
        html += `<p class="muted">已记录 <strong>${disputeCount}</strong> 条你的意见。</p>`;
      }
      html += "</details>";
    }
  } else {
    html += `<p class="muted">本局进行中，打完会自动记录复盘。</p>`;
    if (summary.divergenceCount > 0) {
      html += `<details class="review-advanced-details"><summary>进行中差异（${summary.divergenceCount} 处）</summary>`;
      html += formatVerdictStats(summary, { interactive: true, activeFilter: divergenceVerdictFilter });
      html += renderDivergenceListHtml(divergencesByVerdict(summary, divergenceVerdictFilter));
      html += "</details>";
    }
  }

  const insights = currentGameMeta?.gameInsights ?? [];
  const reviewInsights = insights.filter(
    (i) => i.verdict === INSIGHT_VERDICTS.ADOPTED || i.verdict === INSIGHT_VERDICTS.RECORDED,
  );
  if (reviewInsights.length > 0 && !gameOver) {
    html += "<div class=\"game-insights-block\">";
    html += "<h4>本局你的意见</h4>";
    html += "<ul class=\"game-insights-list\">";
    for (const item of reviewInsights) {
      const summaryText = item.analysis?.length > 48
        ? `${item.analysis.slice(0, 48)}…`
        : (item.analysis || "—");
      html += `<li class="game-insight-item insight-${item.verdict}">`
        + `<span class="insight-turn">第${item.turnNumber}手</span> `
        + `<span class="insight-user">${escapeHtml(item.question)}</span> `
        + `<span class="insight-reply muted">${escapeHtml(summaryText)}</span>`
        + "</li>";
    }
    html += "</ul></div>";
  }

  if (submitted) {
    html += "<p class=\"muted\">本局复盘已保存。</p>";
  } else if (gameOver) {
    html += "<p class=\"muted\">正在保存本局复盘…</p>";
  }

  elements.gameReviewSummary.innerHTML = html;
  const showReviewOverlay = gameOver && !gameReviewOverlayDismissed;
  elements.aiPanel?.classList.toggle("submit-pending", Boolean(gameOver && !submitted));
  elements.aiPanel?.classList.toggle("game-over-review", showReviewOverlay);
  if (elements.dismissGameReview) {
    elements.dismissGameReview.hidden = !showReviewOverlay || !isMobileLayout();
  }
  syncMobileLayoutClass();
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
  syncGameReviewReopenUi();
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
    const reviewArchiveExtras = buildReviewArchiveExtras();
    saveReviewHistoryEntry({
      gameId: currentGameMeta.gameId,
      levelRank: state.levelRank,
      totalHands: payload.divergenceSummary.totalHands,
      divergenceCount: payload.divergenceSummary.divergenceCount,
      coachBetterCount: payload.divergenceSummary.coachBetterCount ?? 0,
      coachQuestionableCount: payload.divergenceSummary.coachQuestionableCount ?? 0,
      divergences: payload.divergenceSummary.divergences,
      coachAdviceTimeline: slimTimeline,
      playHistory: reviewArchiveExtras.playHistory,
      recentPlays: reviewArchiveExtras.recentPlays,
      endRemainingHands: reviewArchiveExtras.endRemainingHands,
      playHistoryTotal: reviewArchiveExtras.playHistoryTotal,
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
        ? "本局复盘已保存。"
        : "本局复盘已暂存到本机，下次启动后会自动同步。";
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
  const previousPlay = (state?.currentPlayerIndex === HUMAN_INDEX)
    ? effectivePreviousPlay(state)
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

function adviceChoiceBadgeLabel(index) {
  const priorityLabels = ["最优", "备选", "谨慎"];
  if (index !== 0) return priorityLabels[index] ?? "可选";
  const phase = currentAdvice?._phase;
  if (phase === "emergency") return "临时";
  if (phase === "quick" || adviceComputeState.inFlight || adviceComputeState.slowNotice) return "精算中";
  return priorityLabels[0];
}

function renderChoiceCard(choice, index) {
  const badgeLabel = adviceChoiceBadgeLabel(index);
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
    <span class="choice-badge">${badgeLabel}</span>
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
    const displayCards = resolvePlayCardsFromHand(state.players[HUMAN_INDEX].hand, choice.candidate);
    const cardsToShow = displayCards.length > 0 ? displayCards : choice.candidate.cards;
    for (const card of cardsToShow) {
      cards.append(renderCard(card));
    }
    const wildAssignments = choice.candidate.wildcardAssignments ?? [];
    if (wildAssignments.length > 0) {
      const wildNote = document.createElement("span");
      wildNote.className = "choice-wild-note muted";
      wildNote.textContent = wildAssignments
        .map((assignment) => `${cardLabel(assignment.from)}当${cardLabel(assignment.as)}`)
        .join("，");
      cards.append(wildNote);
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

function syncMobileActionButtons() {
  if (!isMobileLandscape()) return;
  const pairs = [
    [elements.mlPassTurn, elements.passTurn],
    [elements.mlPlayRecommended, elements.playRecommended],
    [elements.mlPlaySelected, elements.playSelected],
    [elements.mlSortHand, elements.sortHand],
  ];
  for (const [mlBtn, deskBtn] of pairs) {
    if (mlBtn && deskBtn) mlBtn.disabled = deskBtn.disabled;
  }
}

function renderControls() {
  const noGame = !state;
  const humanTurn = state && state.currentPlayerIndex === HUMAN_INDEX && !isGameOver(state);
  const gameOver = state ? isGameOver(state) : false;
  elements.playSelected.disabled = !humanTurn;
  elements.playRecommended.disabled = !humanTurn || hintAwaiting;
  const hintBtnLabel = hintShown ? "取消推荐" : "提示";
  elements.playRecommended.textContent = hintBtnLabel;
  if (elements.mlPlayRecommended) elements.mlPlayRecommended.textContent = hintBtnLabel;
  if (elements.adoptHint) {
    elements.adoptHint.hidden = !humanTurn || !hintShown;
    elements.adoptHint.disabled = !humanTurn || !hintShown;
  }
  elements.passTurn.disabled = !humanTurn || !state?.lastActivePlay;
  elements.sortHand.disabled = !state || gameOver;
  elements.autoGame.disabled = autoGameRunning || !state || gameOver;
  if (elements.autoGame && !autoGameRunning) elements.autoGame.textContent = "自动打完";
  elements.exportLog.disabled = false;
  if (noGame && /新局已发牌|轮到你/.test(message)) {
    message = "点击「新开一局」发牌开始练习。";
  }
  elements.message.textContent = gameOver
    ? `本局结束。${message}`
    : message;
  syncDesktopCenterActions();
  syncMobileActionButtons();
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
    maybeRecoverStalledRobotQueue();
    reconcileTablePlaysWithState();
    if (isMobileLandscape()) {
      syncMobileCenterActions();
      syncMobileActionBandMetrics();
    } else {
      syncDesktopCenterActions();
    }
    renderMatch();
    renderPlayers();
    renderSeatPlays();
    renderTable();
    renderHand();
    renderKeyPauseBanner();
    renderDrillFocusBanner();
    renderHintBanner();
    renderMobileAdviceStrip();
    renderCenterTurnHint();
    renderMobileChrome();
    if (isMobileLandscape()) {
      requestAnimationFrame(() => {
        syncMobileActionBandMetrics();
        syncMobileHandMetrics();
        syncMlHandToolsChrome();
      });
    }
    renderAdvice({ computeAdvice: !lite });
    if (lite) {
      // 机器人连推 / 教练精算 / 尚无建议时跳过复盘面板，避免与建议计算抢主线程
      const deferReviewPanel = state.currentPlayerIndex === HUMAN_INDEX && !currentAdvice;
      if (!robotQueueActive && !adviceComputeState.inFlight && !deferReviewPanel) {
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
  if (drillPracticeBtn && drillPracticeBtn.dataset.drillBound !== "1") {
    event.preventDefault();
    void startDrillPractice(drillPracticeBtn.dataset.drillTag);
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
  syncMobileLayout();
  renderMobileChrome();
  renderCenterTurnHint();
  if (coachFabOpen) syncCoachFabMobileChrome(true);
  renderPlayers();
  renderSeatPlays();
  renderHand();
});
MOBILE_PORTRAIT_MQ?.addEventListener("change", () => {
  syncMobileLayout();
  renderMobileChrome();
  renderCenterTurnHint();
  renderMobileA2hsHint();
  if (coachFabOpen) setCoachFabOpen(false);
  renderHand();
});

MOBILE_ORIENTATION_PORTRAIT_MQ?.addEventListener("change", () => {
  syncMobileLayout();
  renderMobileChrome();
  renderCenterTurnHint();
  renderMobileA2hsHint();
  if (coachFabOpen) setCoachFabOpen(false);
  renderPlayers();
  renderSeatPlays();
  renderHand();
});

MOBILE_LANDSCAPE_MQ?.addEventListener("change", () => {
  syncMobileLayout();
  renderMobileA2hsHint();
  renderPlayers();
  renderSeatPlays();
  renderHand();
});

window.visualViewport?.addEventListener("resize", () => {
  syncMobileViewportHeight();
  syncMobileSeatPlayMetrics();
  syncMobileActionBandMetrics();
});
window.visualViewport?.addEventListener("scroll", syncMobileViewportHeight);
window.addEventListener("resize", () => {
  syncMobileLayout();
  syncMobileViewportHeight();
});

elements.portraitBlockerDismiss?.addEventListener("click", () => {
  safeSetItem(MOBILE_PORTRAIT_DISMISS_STORAGE, "1");
  syncMobileLayout();
  renderMobileA2hsHint();
});

elements.mobileA2hsClose?.addEventListener("click", () => {
  safeSetItem(MOBILE_A2HS_DISMISS_STORAGE, "1");
  if (elements.mobileA2hsHint) elements.mobileA2hsHint.hidden = true;
});

elements.mobileMenuBtn?.addEventListener("click", toggleMobileMenu);
elements.mobileMenuClose?.addEventListener("click", () => setMobileMenuOpen(false));
elements.mobileMenuBackdrop?.addEventListener("click", () => setMobileMenuOpen(false));
elements.mobileDrillPanel?.addEventListener("toggle", () => {
  if (elements.mobileDrillPanel?.open) renderDrillPracticePanel();
});

elements.mobileLevelSelect?.addEventListener("change", () => {
  if (!elements.levelRank || !elements.mobileLevelSelect) return;
  elements.levelRank.value = elements.mobileLevelSelect.value;
  renderMobileChrome();
});

elements.mobileNewGame?.addEventListener("click", () => {
  setMobileMenuOpen(false);
  void triggerNewGame();
});
elements.mobileNewMatch?.addEventListener("click", () => {
  setMobileMenuOpen(false);
  elements.newMatch?.click();
});
elements.mobileNextMatch?.addEventListener("click", () => {
  setMobileMenuOpen(false);
  elements.nextMatchGame?.click();
});
function handleReviewReopenActivate(event) {
  if (!canReopenGameReview() || !gameReviewOverlayDismissed) return;
  event.preventDefault();
  event.stopPropagation();
  openGameReviewOverlay();
}

function bindReviewReopenEntry(node) {
  if (!node || node.dataset.reviewReopenBound === "1") return;
  node.dataset.reviewReopenBound = "1";
  node.addEventListener("click", handleReviewReopenActivate);
  node.addEventListener("touchend", (event) => {
    if (!canReopenGameReview() || !gameReviewOverlayDismissed) return;
    event.preventDefault();
    handleReviewReopenActivate(event);
  }, { passive: false });
  node.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    handleReviewReopenActivate(event);
  });
}

elements.mobileViewReview?.addEventListener("click", handleReviewReopenActivate);
elements.portraitBlockerReview?.addEventListener("click", handleReviewReopenActivate);
bindReviewReopenEntry(elements.mobileTurnChip);
bindReviewReopenEntry(elements.turnTitle?.closest(".status"));
elements.mobileRules?.addEventListener("click", () => {
  setMobileMenuOpen(false);
  elements.rulesBtn?.click();
});
elements.mobileImport?.addEventListener("click", () => {
  setMobileMenuOpen(false);
  elements.importReplayBtn?.click();
});
elements.mobileExport?.addEventListener("click", () => {
  setMobileMenuOpen(false);
  elements.exportLog?.click();
});
elements.mobileTrialFeedback?.addEventListener("click", () => {
  void openTrialFeedback();
});

elements.mobileKeyPause?.addEventListener("change", () => {
  if (elements.useKeyPause) elements.useKeyPause.checked = !!elements.mobileKeyPause.checked;
  onKeyPauseToggle();
});
elements.mobileGuideTips?.addEventListener("change", () => {
  const on = !!elements.mobileGuideTips.checked;
  safeSetItem(GUIDE_ENABLED_STORAGE, on ? "1" : "0");
  if (!on) {
    hideFirstTipBar();
    onboardingStep = 0;
    if (elements.onboardingOverlay) elements.onboardingOverlay.hidden = true;
    if (elements.onboardingRing) elements.onboardingRing.hidden = true;
  } else if (!onboardingDone()) {
    initOnboarding();
  }
  updateFirstTips();
  renderOnboarding();
});

elements.mobileMlPolicy?.addEventListener("change", () => {
  if (elements.useMlPolicy) elements.useMlPolicy.checked = !!elements.mobileMlPolicy.checked;
  onMlPolicyToggle();
});

initMobileLevelSelect();
syncMobileLayout();

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
  message = keyPauseEnabled ? "已开启关键时刻推荐：高价值决策点会弹出教练建议。" : "已关闭关键时刻推荐。";
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

function bindMobileLandscapeDocumentTap() {
  if (window.__guandanMlDocTapBound) return;
  window.__guandanMlDocTapBound = true;

  const invokeMlPlayDock = (btnId) => {
    const handlers = {
      mlPassTurn: passTurn,
      mlPlayRecommended: playRecommended,
      mlPlaySelected: playSelected,
    };
    const handler = handlers[btnId];
    if (!handler) return;
    const deskId = btnId.replace(/^mlPassTurn$/, "passTurn")
      .replace(/^mlPlayRecommended$/, "playRecommended")
      .replace(/^mlPlaySelected$/, "playSelected");
    const btn = elements[btnId];
    if (btn?.disabled) {
      showPlayDockDisabledHint(deskId);
      return;
    }
    void Promise.resolve(handler()).catch((error) => console.error(error));
  };

  const handleMobileLandscapeTap = (event) => {
    if (!isMobileLandscapeDomActive()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".coach-fab-drawer, .mobile-menu-drawer, .rules-drawer, .first-tip-bar, #aiPanel.game-over-review")) {
      return;
    }

    const mlAction = target.closest("[data-ml-action]");
    if (mlAction && elements.landscapeRoot?.contains(mlAction)) {
      event.preventDefault();
      if (mlAction.dataset.mlAction === "newGame") void triggerNewGame();
      return;
    }

    const toolBtn = target.closest("#mlSortHand, #mlCoachFab");
    if (toolBtn && elements.landscapeRoot?.contains(toolBtn)) {
      event.preventDefault();
      if (toolBtn.id === "mlSortHand") void sortHumanHand();
      else if (toolBtn.id === "mlCoachFab") toggleCoachFab();
      return;
    }

    const dockBtn = target.closest("#mlPassTurn, #mlPlayRecommended, #mlPlaySelected");
    if (dockBtn && elements.landscapeRoot?.contains(dockBtn)) {
      event.preventDefault();
      invokeMlPlayDock(dockBtn.id);
    }
  };

  document.addEventListener("click", handleMobileLandscapeTap, true);
  document.addEventListener("touchend", handleMobileLandscapeTap, { capture: true, passive: false });
}

function bindMobileLandscapeActions() {
  bindMobileHandEvents();
  if (elements.landscapeRoot && elements.landscapeRoot.dataset.bound !== "1") {
    elements.landscapeRoot.dataset.bound = "1";
    elements.landscapeRoot.addEventListener("click", (event) => {
      tryMobileFullscreen();
      const actionBtn = event.target.closest("[data-ml-action]");
      if (!actionBtn || !elements.landscapeRoot.contains(actionBtn)) return;
      event.preventDefault();
      if (actionBtn.dataset.mlAction === "newGame") {
        void triggerNewGame();
      }
    });
  }
  const mlDock = document.querySelector("#landscapeRoot .ml-actions");
  if (mlDock && mlDock.dataset.bound !== "1") {
    mlDock.dataset.bound = "1";
    const handlers = {
      mlPassTurn: passTurn,
      mlPlayRecommended: playRecommended,
      mlPlaySelected: playSelected,
    };
    mlDock.addEventListener("click", (event) => {
      const btn = event.target.closest("button[id]");
      if (!btn || !mlDock.contains(btn)) return;
      const handler = handlers[btn.id];
      if (!handler) return;
      event.preventDefault();
      if (btn.disabled) {
        const deskId = btn.id.replace(/^mlPassTurn$/, "passTurn")
          .replace(/^mlPlayRecommended$/, "playRecommended")
          .replace(/^mlPlaySelected$/, "playSelected");
        showPlayDockDisabledHint(deskId);
        return;
      }
      void Promise.resolve(handler()).catch((error) => console.error(error));
    });
  }
  const mlToolHandlers = {
    mlSortHand: sortHumanHand,
    mlCoachFab: toggleCoachFab,
  };
  const mlHandTools = document.querySelector("#landscapeRoot .ml-hand-tools");
  if (mlHandTools && mlHandTools.dataset.bound !== "1") {
    mlHandTools.dataset.bound = "1";
    mlHandTools.style.pointerEvents = "auto";
    const invokeMlTool = (btn) => {
      if (!btn?.id || !mlHandTools.contains(btn)) return;
      const handler = mlToolHandlers[btn.id];
      if (!handler) return;
      if (btn.disabled) return;
      void Promise.resolve(handler()).catch((error) => console.error(error));
    };
    mlHandTools.addEventListener("click", (event) => {
      const btn = event.target.closest("button[id]");
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      invokeMlTool(btn);
    });
  }
  if (elements.mobileRulesHud && elements.mobileRulesHud.dataset.bound !== "1") {
    elements.mobileRulesHud.dataset.bound = "1";
    elements.mobileRulesHud.addEventListener("click", (event) => {
      event.preventDefault();
      toggleRulesDrawer();
    });
  }
  if (elements.mlNewGame && elements.mlNewGame.dataset.bound !== "1") {
    elements.mlNewGame.dataset.bound = "1";
    elements.mlNewGame.addEventListener("click", (event) => {
      event.preventDefault();
      void triggerNewGame();
    });
  }
  if (elements.mlBanners && elements.mlBanners.dataset.bound !== "1") {
    elements.mlBanners.dataset.bound = "1";
    elements.mlBanners.addEventListener("click", (event) => {
      const actionBtn = event.target.closest("[data-key-pause-action]");
      if (!actionBtn) return;
      elements.keyPauseBanner?.querySelector(`[data-key-pause-action="${actionBtn.dataset.keyPauseAction}"]`)?.click();
    });
  }
}

function bindPlayDockActions() {
  const dock = elements.playDockActions;
  if (!dock || dock.dataset.bound === "1") return;
  dock.dataset.bound = "1";
  const handlers = {
    playSelected,
    playRecommended,
    passTurn,
    adoptHint,
  };
  dock.addEventListener("click", (event) => {
    const btn = event.target.closest("button[id]");
    if (!btn || !dock.contains(btn)) return;
    const handler = handlers[btn.id];
    if (!handler) return;
    event.preventDefault();
    if (btn.disabled) {
      showPlayDockDisabledHint(btn.id);
      return;
    }
    void Promise.resolve(handler()).catch((error) => console.error(error));
  });
}

function bindPrimaryActions() {
  bindMobileLandscapeDocumentTap();
  bindPlayDockActions();
  bindMobileLandscapeActions();
  const actions = [
    ["newGame", triggerNewGame],
    ["newMatch", newCompetitiveMatch],
    ["nextMatchGame", nextCompetitiveGame],
    ["autoGame", autoGame],
    ["sortHand", sortHumanHand],
    ["exportLog", exportLog],
    ["saveTrainingSample", saveTrainingSample],
    ["selfTrain", runSelfTraining],
    ["copyLog", copyExportLog],
    ["askAiCoach", askAiCoach],
    ["submitGameReview", submitGameReview],
    ["dismissGameReview", dismissGameReviewOverlay],
    ["clearAiChat", clearAiChat],
    ["coachFab", toggleCoachFab],
    ["coachFabClose", () => setCoachFabOpen(false)],
    ["coachFabSend", askFabCoach],
    ["coachFabObjection", askFabCoachObjection],
    ["rulesBtn", toggleRulesDrawer],
    ["rulesClose", () => setRulesDrawerOpen(false)],
    ["openDrillPanel", startFeaturedDrillPractice],
    ["mobileOpenDrill", startFeaturedDrillPractice],
    ["startMustBeatSfDrill", startFeaturedDrillPractice],
    ["mobileStartMustBeatSfDrill", startFeaturedDrillPractice],
  ];
  for (const [id, handler] of actions) {
    const node = elements[id];
    if (!node || node.dataset.bound === "1") continue;
    node.dataset.bound = "1";
    node.addEventListener("click", (event) => {
      event.preventDefault();
      if (node.disabled) return;
      void Promise.resolve(handler()).catch((error) => console.error(error));
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
      handleKeyPauseAction(btn.dataset.keyPauseAction);
    });
  }
  if (elements.mlHudAdvice && elements.mlHudAdvice.dataset.bound !== "1") {
    elements.mlHudAdvice.dataset.bound = "1";
    elements.mlHudAdvice.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-key-pause-action]");
      if (!btn || elements.mlHudAdvice.hidden) return;
      event.preventDefault();
      handleKeyPauseAction(btn.dataset.keyPauseAction);
    });
  }
  if (elements.rulesBackdrop && elements.rulesBackdrop.dataset.bound !== "1") {
    elements.rulesBackdrop.dataset.bound = "1";
    elements.rulesBackdrop.addEventListener("click", () => setRulesDrawerOpen(false));
  }
  const dialogActions = [
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
  renderDrillPracticePanel();
  const activeRestored = restored && state && !isGameOver(state);
  render({ immediate: true, lite: activeRestored });
  if (COACH_STRATEGY_REVISION !== REQUIRED_STRATEGY_REVISION) {
    message = `策略模块可能未更新（rev ${COACH_STRATEGY_REVISION ?? "?"}），请关掉标签重跑启动脚本。${message}`;
  }
  if (elements.message) elements.message.textContent = formatBootMessage(message);
  bootComplete = true;
  const urlDrillTag = (() => {
    try {
      const raw = new URLSearchParams(globalThis.location?.search ?? "").get("drill");
      if (!raw) return null;
      if (raw === "must-beat-sf" || raw === "must-beat-twp-sf") return "须压保同花顺";
      return raw;
    } catch {
      return null;
    }
  })();
  if (urlDrillTag && !activeRestored) {
    startDrillPractice(urlDrillTag);
    return;
  }
  window.setInterval(() => {
    if (!bootComplete || !state || isGameOver(state)) return;
    maybeRecoverStalledRobotQueue();
  }, 1000);
  if (!activeRestored && !state && isMobileLandscape()) {
    void triggerNewGame();
    return;
  }
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
