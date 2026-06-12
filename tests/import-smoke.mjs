import { readFileSync, writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createInitialGameState } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { runAutoGame } from "../coach/auto-game.mjs";
import { opengdanMessagesToGame } from "../tools/adapters/opengdan-log.mjs";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function fixOgCode(card) {
  const suitLetter = { S: "S", H: "H", C: "C", D: "D", spades: "S", hearts: "H", clubs: "C", diamonds: "D" }[card.suit] ?? "S";
  const rank = card.rank === "10" ? "T" : card.rank;
  if (card.rank === "SJ") return "SB";
  if (card.rank === "BJ") return "HR";
  return `${suitLetter}${rank}`;
}

function tupleFromPlay(play) {
  if (play.type === PLAY_TYPES.pass) return ["PASS", "PASS", "PASS"];
  const pattern = {
    [PLAY_TYPES.single]: "Single",
    [PLAY_TYPES.pair]: "Pair",
    [PLAY_TYPES.triple]: "Trips",
    [PLAY_TYPES.bomb]: "Bomb",
  }[play.type] ?? "Single";
  return [pattern, play.mainRank === "10" ? "T" : play.mainRank, play.cards.map(fixOgCode)];
}

function buildSyntheticOpenGuanDanLog() {
  const initial = createInitialGameState({ random: () => 0.33 });
  const messages = [];
  for (let seat = 0; seat < 4; seat += 1) {
    messages.push({
      type: "notify",
      stage: "beginning",
      myPos: seat,
      handCards: initial.players[seat].hand.map(fixOgCode),
      curRank: initial.levelRank,
    });
  }

  const { transcript } = runAutoGame(initial, { maxTurns: 36 });
  for (const step of transcript) {
    const play = step.play;
    messages.push({
      type: "notify",
      stage: "play",
      curPos: step.playerIndex,
      curAction: tupleFromPlay(play),
      greaterPos: step.playerIndex,
      greaterAction: tupleFromPlay(play),
    });
  }

  return messages;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const messages = buildSyntheticOpenGuanDanLog();
const game = opengdanMessagesToGame(messages, { gameId: "synthetic-og" });
assert(!game.error, game.error ?? "import");
assert(game.coachAdviceTimeline.length >= 10, "导入后应有出牌时间线");
assert(game.initialHands.length === 4, "四座位发牌");

const tmp = mkdtempSync(join(tmpdir(), "gd-import-"));
const logPath = join(tmp, "synthetic.jsonl");
writeFileSync(logPath, `${messages.map((m) => JSON.stringify(m)).join("\n")}\n`);

const outPath = join(tmp, "bundle.json");
execSync(`node tools/import-external-replay.mjs "${logPath}" synthetic-test`, { cwd: root, stdio: "pipe" });
execSync(`node tools/replay-to-rows.mjs "${join(root, "training-samples/imported/synthetic-test.json")}" --out "${join(tmp, "rows.jsonl")}"`, {
  cwd: root,
  stdio: "pipe",
});

const rowText = readFileSync(join(tmp, "rows.jsonl"), "utf8").trim().split("\n");
assert(rowText.length >= 20, `导入行数应>=20，实际 ${rowText.length}`);

try { unlinkSync(logPath); } catch { /* ignore */ }

console.log("外部牌谱导入（OpenGuanDan）冒烟测试通过");
