/**
 * 正式对局三家对手人格权重 — lite 候选池 + scoringAudience robot，保留 P12 节制。
 */

import { ROBOT_LITE_MAX_CANDIDATES, ROBOT_WALL_BUDGET_MS } from "../coach/robot-player.mjs";

const PERSONAS = Object.freeze({
  1: { id: "yong", name: "勇哥", tempoWeight: 1.05, structureWeight: 0.95, bombWeight: 1.08 },
  2: { id: "lao", name: "老史", tempoWeight: 1.0, structureWeight: 1.0, bombWeight: 1.0 },
  3: { id: "mao", name: "毛蛋", tempoWeight: 0.92, structureWeight: 1.05, bombWeight: 0.95 },
});

/** 按座位取对手人格（1=勇哥 2=老史 3=毛蛋） */
export function opponentPersonaForSeat(seatIndex) {
  return PERSONAS[seatIndex] ?? PERSONAS[1];
}

/**
 * 正式对局机器人出牌选项：lite 候选池（≤6）+ robot 评分 + ML 关闭，避免主线程阻塞。
 * 人类教练仍走 humanAdviceOptionsQuick → humanAdviceOptionsFull（human-lite 更大候选池、可选 ML）。
 */
export function buildFormalRobotPlayOptions(_state, seatIndex, overrides = {}) {
  return {
    mlModel: null,
    mlFusionMode: "off",
    maxCandidates: ROBOT_LITE_MAX_CANDIDATES,
    lite: true,
    opponentPersona: opponentPersonaForSeat(seatIndex),
    deadline: performance.now() + ROBOT_WALL_BUDGET_MS,
    ...overrides,
  };
}
