/**
 * 对手人格只用于展示/模拟标签，不得改变同一状态的 Top1。
 */

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
 * 正式对局元数据。统一决策内核会忽略身份和旧预算参数。
 */
export function buildFormalRobotPlayOptions(_state, seatIndex, overrides = {}) {
  return {
    consumer: "robot",
    opponentPersona: opponentPersonaForSeat(seatIndex),
    ...overrides,
  };
}
