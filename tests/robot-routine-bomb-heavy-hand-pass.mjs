/**
 * perf 审计 seed 42000 第14手：须压对K、仅炸弹够压、手牌仍多 → 机器人宜过牌（P12）
 */
import { createInitialGameState, isGameOver } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { playRecommendedTurn } from "../coach/robot-player.mjs";

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 42000;
const TARGET_TURN = 14;

let state = createInitialGameState({ levelRank: "2", random: mulberry32(SEED) });
let recommendation = null;

while (!isGameOver(state) && state.turnNumber < TARGET_TURN) {
  ({ state, recommendation } = playRecommendedTurn(state, { mlFusionMode: "off", mlModel: false }));
}

({ recommendation } = playRecommendedTurn(state, { mlFusionMode: "off", mlModel: false }));

if (recommendation.candidate.type !== PLAY_TYPES.pass) {
  console.error(
    "FAIL: 须压对K仅炸弹够压、23张宜过牌，实际",
    recommendation.candidate.label ?? recommendation.candidate.type,
    recommendation.reasons?.[0],
  );
  process.exit(1);
}

console.log(`PASS: seed ${SEED} 第 ${TARGET_TURN} 手机器人 P12 过牌保留炸弹`);
