import { writeFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { mergeMessageStreams, dedupeKey } from "../tools/merge-opengdan-logs.mjs";
import { createInitialGameState } from "../engine/game-state.mjs";
import { runAutoGame } from "../coach/auto-game.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function fixOgCode(card) {
  const suitLetter = { S: "S", H: "H", C: "C", D: "D" }[card.suit] ?? "S";
  const rank = card.rank === "10" ? "T" : card.rank;
  if (card.rank === "SJ") return "SB";
  if (card.rank === "BJ") return "HR";
  return `${suitLetter}${rank}`;
}

function tupleFromPlay(play) {
  if (play.type === PLAY_TYPES.pass) return ["PASS", "PASS", "PASS"];
  const pattern = { [PLAY_TYPES.single]: "Single", [PLAY_TYPES.pair]: "Pair" }[play.type] ?? "Single";
  return [pattern, play.mainRank === "10" ? "T" : play.mainRank, play.cards.map(fixOgCode)];
}

/** 模拟四路客户端各自收到相同广播 notify play，仅 beginning 不同 */
function buildClientLog(seat, initial, transcript) {
  const messages = [{
    type: "notify",
    stage: "beginning",
    myPos: seat,
    handCards: initial.players[seat].hand.map(fixOgCode),
    curRank: initial.levelRank,
  }];
  for (const step of transcript) {
    messages.push({
      type: "notify",
      stage: "play",
      curPos: step.playerIndex,
      curAction: tupleFromPlay(step.play),
      greaterPos: step.playerIndex,
      greaterAction: tupleFromPlay(step.play),
    });
  }
  return messages;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const initial = createInitialGameState({ random: () => 0.21 });
const { transcript } = runAutoGame(initial, { maxTurns: 20 });
const tmp = mkdtempSync(join(tmpdir(), "gd-merge-"));
const paths = [];
for (let seat = 0; seat < 4; seat += 1) {
  const p = join(tmp, `seat${seat}.jsonl`);
  const lines = buildClientLog(seat, initial, transcript);
  writeFileSync(p, `${lines.map((m) => JSON.stringify(m)).join("\n")}\n`);
  paths.push(p);
}

const merged = mergeMessageStreams(paths);
const beginnings = merged.filter((m) => m.type === "notify" && m.stage === "beginning");
assert(beginnings.length === 4, `应保留 4 条 beginning，实际 ${beginnings.length}`);

const playNotifies = merged.filter((m) => m.type === "notify" && m.stage === "play");
assert(
  playNotifies.length > 0 && playNotifies.length <= transcript.length,
  `广播去重后 play 数异常：${playNotifies.length}，transcript=${transcript.length}`,
);

const out = join(tmp, "merged.jsonl");
execSync(`node tools/merge-opengdan-logs.mjs ${paths.map((p) => `"${p}"`).join(" ")} --out "${out}"`, {
  cwd: root,
  stdio: "pipe",
});

assert(dedupeKey({ type: "notify", stage: "beginning", myPos: 0 }) !== dedupeKey({ type: "notify", stage: "beginning", myPos: 1 }), "beginning 按座位去重键");

console.log("四路日志合并冒烟测试通过");
