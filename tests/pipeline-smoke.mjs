import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import {
  buildCanonicalReplay,
  gamesToRows,
  tierFromCoachRecord,
} from "../tools/lib/canonical-replay.mjs";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  tierFromCoachRecord({ source: "human-manual", actualChoiceMatch: "outside-top-3" }).tier === "gold",
  "金标判定",
);

const fakeGame = {
  gameId: "test-1",
  seed: 42,
  levelRank: "2",
  status: "complete",
  initialHands: [
    { playerIndex: 0, cards: [{ rank: "A", suit: "S", deckIndex: 0 }] },
  ],
  coachAdviceTimeline: [
    {
      turnNumber: 0,
      playerIndex: 0,
      playerName: "你",
      source: "robot-auto",
      levelRank: "2",
      handCount: 27,
      playersBefore: [{ playerIndex: 0, handCount: 27, finishedOrder: null }],
      handBefore: [{ rank: "A", suit: "S", deckIndex: 0 }],
      choices: [{ index: 1, score: 0, play: { type: "Single", cards: [{ rank: "A", suit: "S", deckIndex: 0 }] } }],
      actualPlay: { type: "Single", cards: [{ rank: "A", suit: "S", deckIndex: 0 }] },
      actualChoiceMatch: "suggestion-1",
    },
    {
      turnNumber: 1,
      playerIndex: 1,
      source: "robot-auto",
      handCount: 26,
      playersBefore: [],
      handBefore: [],
      actualPlay: { type: "Pass", cards: [] },
      actualChoiceMatch: "suggestion-1",
    },
  ],
};

const replay = buildCanonicalReplay(fakeGame);
assert(replay.actions.length === 2, "timeline 应拆 2 手");
const { rows } = gamesToRows([fakeGame]);
assert(rows.length === 2, "四座位逻辑下 2 手 = 2 行");
assert(rows[0].seat === 0 && rows[1].seat === 1, "座位保留");

const tmp = mkdtempSync(join(tmpdir(), "gd-pipeline-"));
execSync(`node tools/batch-auto-games.mjs 3 120 9000 2`, { cwd: root, stdio: "pipe" });
const latest = JSON.parse(readFileSync(join(root, "training-samples", "batch-auto-latest.json"), "utf8"));
assert(latest.games.length === 3, "批量应生成 3 局");
assert(latest.games[0].initialHands[0].cards.length === 27, "初始手牌应为 27 张");

execSync(`node tools/replay-to-rows.mjs "${join(root, "training-samples", "batch-auto-latest.json")}" --out "${join(tmp, "rows.jsonl")}"`, {
  cwd: root,
  stdio: "pipe",
});

const rowLines = readFileSync(join(tmp, "rows.jsonl"), "utf8").trim().split("\n");
assert(rowLines.length > 20, `训练行应远大于 20，实际 ${rowLines.length}`);

execSync("node tools/train-policy.mjs", { cwd: root, stdio: "pipe" });
const metrics = JSON.parse(readFileSync(join(root, "models/policy-v001/metrics.json"), "utf8"));
assert(metrics.rowTop1.top1 > 0.5, `ML Top1 应 >50%，实际 ${metrics.rowTop1.top1}`);

console.log("P0 数据流水线 + P1-1 训练冒烟测试通过");
