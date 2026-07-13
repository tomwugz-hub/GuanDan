/**
 * UI 韧性回归：教练建议 / 机器人队列 / 主线程阻塞 同类问题一次性守卫
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { createInitialGameState, isGameOver, playCards } from "../engine/game-state.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { computeRecommendations } from "../strategy/recommend.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { buildFormalRobotPlayOptions } from "../simulation/opponent-persona.mjs";
import { playRecommendedTurn, ROBOT_STEP_DEADLINE_MS } from "../coach/robot-player.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mainSource = readFileSync(join(root, "app", "main.mjs"), "utf8");
const recommendSource = readFileSync(join(root, "strategy", "recommend.mjs"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// --- 静态守卫（防回归） ---
assert(
  mainSource.includes("function clearRobotQueueActiveIfCurrent"),
  "应有 clearRobotQueueActiveIfCurrent，过期 generation 不得误清新队列",
);
assert(
  /scheduleIdleHumanAdviceRefresh[\s\S]{0,420}queueRobotTurns\(\)/.test(mainSource),
  "机器人回合 idle 路径应 queueRobotTurns 而非预计算人类 advice",
);
assert(
  !/humanJustPlayed[\s\S]{0,200}robotQueueActive\s*=\s*true/.test(mainSource),
  "人类出牌后不应在 queueRobotTurns 前单独设 robotQueueActive=true（假活跃）",
);
assert(
  /newCompetitiveMatch[\s\S]{0,500}resetActivePlayQueues/.test(mainSource),
  "新开竞技赛应 resetActivePlayQueues",
);
assert(
  /proceedNextCompetitiveGame[\s\S]{0,500}cancelAdviceCompute/.test(mainSource),
  "竞技赛下一局应 cancelAdviceCompute",
);
assert(
  mainSource.includes("function ensureHumanAdvicePlaceholder")
    && mainSource.includes("function isAdvicePhaseComplete"),
  "教练建议应有毫秒占位 + 阶段完成判定",
);
assert(
  !/deadlineFallbackRecommendations[\s\S]{0,280}buildStrategicGroups/.test(recommendSource),
  "deadline 兜底不得再调 buildStrategicGroups",
);
assert(
  /resolvePreferredGroups[\s\S]{0,320}if \(litePath\)/.test(recommendSource),
  "lite 路径 resolvePreferredGroups 应跳过 buildStrategicGroups",
);
assert(
  /function buildEmergencyHumanAdvice[\s\S]{0,280}currentHandPlayGroups\(\)/.test(mainSource),
  "应急建议须走 currentHandPlayGroups 轻量路径，不得在 render 热路径同步 buildHumanAdviceContext",
);
assert(
  /if \(computeAdvice\)[\s\S]{0,220}!adviceComputeState\.inFlight[\s\S]{0,80}scheduleHumanAdviceRefresh/.test(mainSource),
  "computeAdvice 为真且 advice 未在算时才调度，避免 render 循环卡死",
);
assert(
  /scheduleHumanAdviceRefresh[\s\S]{0,420}currentPlayerIndex === HUMAN_INDEX && robotQueueActive/.test(mainSource),
  "人类回合应清掉假活跃的 robotQueueActive，避免 advice 被永久 defer",
);
assert(
  /export function isRobotScoring[\s\S]{0,120}scoringAudience === "robot"/.test(
    readFileSync(join(root, "strategy", "robot-doctrine.mjs"), "utf8"),
  ),
  "isRobotScoring 仅 robot 路径，human-lite 不得套用 P12 机器人节制",
);

const syntaxCheck = spawnSync(process.execPath, ["--check", join(root, "app", "main.mjs")], { encoding: "utf8" });
assert(syntaxCheck.status === 0, `main.mjs 语法：${syntaxCheck.stderr?.trim() || "失败"}`);

// --- 运行时：human-lite 无 preferredGroups 不建分组 ---
{
  const st = createInitialGameState({ levelRank: "6" });
  const hand = st.players[0].hand;
  const t0 = performance.now();
  getTurnAdvice(st, 0, {
    lite: true,
    scoringAudience: "human-lite",
    maxCandidates: 12,
    alternatives: 1,
    deadline: performance.now() + 3000,
  });
  const elapsed = performance.now() - t0;
  assert(elapsed < 4000, `human-lite bare 应在 4s 内（${Math.round(elapsed)}ms）`);
}

// --- 运行时：deadline 兜底快路径 ---
{
  const st = createInitialGameState({ levelRank: "8" });
  const hand = st.players[0].hand;
  const t0 = performance.now();
  computeRecommendations(hand, "8", null, {
    lite: true,
    scoringAudience: "human-lite",
    deadline: performance.now() - 1,
  });
  const elapsed = performance.now() - t0;
  assert(elapsed < 800, `已过期 deadline 兜底应 <800ms（${Math.round(elapsed)}ms）`);
}

// --- 运行时：机器人三家连推 ---
{
  let st = createInitialGameState();
  st.currentPlayerIndex = 1;
  let total = 0;
  for (let i = 0; i < 3; i += 1) {
    if (st.currentPlayerIndex === 0) break;
    const prev = st.currentPlayerIndex;
    const t0 = performance.now();
    const turn = playRecommendedTurn(st, buildFormalRobotPlayOptions(st, prev));
    total += performance.now() - t0;
    st = turn.state;
    assert(st.currentPlayerIndex !== prev || isGameOver(st), "机器人步后 currentPlayer 应变化或局终");
  }
  assert(total < 6000, `三家连推 <6s（${Math.round(total)}ms）`);
}

// --- 运行时：人类出牌后模拟队列启动（状态机） ---
{
  let st = createInitialGameState();
  while (st.currentPlayerIndex !== 0 && st.turnNumber < 5) {
    const idx = st.currentPlayerIndex;
    const turn = playRecommendedTurn(st, buildFormalRobotPlayOptions(st, idx));
    st = turn.state;
  }
  assert(st.currentPlayerIndex === 0, "应回到人类回合");
  const play = classifyPlay([st.players[0].hand[0]], st.levelRank);
  if (play.type !== "invalid") {
    st = playCards(st, play.cards);
    assert(st.currentPlayerIndex !== 0, "人类出牌后应轮到机器人");
  }
}

console.log("ui-resilience-smoke: 全部通过");
