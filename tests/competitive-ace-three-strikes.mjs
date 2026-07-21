/**
 * 竞技赛：打 A 三把未双上退回 2；A 双上则整局结束。
 */
import { createInitialGameState } from "../engine/game-state.mjs";
import {
  ACE_ATTEMPT_LIMIT,
  createCompetitiveMatch,
  finishCompetitiveGame,
  settleGame,
} from "../coach/competitive-match.mjs";

function finishedAtA(finishedPlayers) {
  const base = createInitialGameState({ levelRank: "A" });
  return {
    ...base,
    levelRank: "A",
    finishedPlayers,
    players: base.players.map((player, index) => ({
      ...player,
      hand: index === finishedPlayers[0] ? [] : player.hand,
      finishedOrder: finishedPlayers.indexOf(index) + 1 || null,
    })),
  };
}

// 头游非双上：1、3 同队，2 为对家
const headOnlyWin = finishedAtA([0, 1, 2, 3]);
const doubleWin = finishedAtA([0, 2, 1, 3]);

let match = createCompetitiveMatch();
match.levels = ["A", "5"];

for (let i = 0; i < ACE_ATTEMPT_LIMIT - 1; i += 1) {
  match = finishCompetitiveGame(match, headOnlyWin);
  if (match.levels[0] !== "A") {
    throw new Error(`第 ${i + 1} 把后己方仍应打 A，实际 ${match.levels[0]}`);
  }
  if ((match.aceAttempts?.[0] ?? 0) !== i + 1) {
    throw new Error(`第 ${i + 1} 把后计次应为 ${i + 1}，实际 ${match.aceAttempts?.[0]}`);
  }
}

match = finishCompetitiveGame(match, headOnlyWin);
if (match.levels[0] !== "2") {
  throw new Error(`三把未双上后应退回 2，实际 ${match.levels[0]}`);
}
if ((match.aceAttempts?.[0] ?? 0) !== 0) {
  throw new Error("退回 2 后 A 计次应清零");
}

const fresh = createCompetitiveMatch();
fresh.levels = ["A", "K"];
const done = finishCompetitiveGame(fresh, doubleWin);
if (!done.complete || done.winnerTeam !== 0) {
  throw new Error("打 A 双上应直接结束竞技赛");
}

const upgraded = settleGame(headOnlyWin, ["K", "5"], [0, 0]);
if (upgraded.nextLevels[0] !== "A" || (upgraded.aceAttempts?.[0] ?? -1) !== 0) {
  throw new Error("K 头游升到 A 时应重置 A 计次");
}

console.log(`PASS: 打 A ${ACE_ATTEMPT_LIMIT} 把未双上退回 2，双上过关`);
