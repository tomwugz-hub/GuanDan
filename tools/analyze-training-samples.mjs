import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractAllGames,
  extractGamesFromSample,
  gamesToRows,
  loadTrainingInput,
  summarizeRows,
} from "./lib/canonical-replay.mjs";

const workspaceDir = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const trainingDir = join(workspaceDir, "training-samples");
const datasetsDir = join(workspaceDir, "datasets", "v1");

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJsonl(path) {
  const text = await readFile(path, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function collectSamples(limit) {
  const paths = [
    join(trainingDir, "coach-questions.jsonl"),
    join(trainingDir, "coach-training-feedback.jsonl"),
    join(trainingDir, "batch-auto-games.jsonl"),
    join(trainingDir, "coach-training-latest.json"),
    join(trainingDir, "batch-auto-latest.json"),
  ];

  const samples = [];
  for (const path of paths) {
    if (!(await fileExists(path))) continue;
    if (path.endsWith(".jsonl")) {
      const lines = await readJsonl(path);
      samples.push(...(limit > 0 ? lines.slice(-limit) : lines));
    } else {
      const input = loadTrainingInput(path);
      samples.push(...input.samples);
    }
  }
  return samples;
}

async function main() {
  const limit = Number(process.argv[2]) || 0;
  const samples = await collectSamples(limit);

  if (samples.length === 0) {
    console.log(JSON.stringify({
      ok: true,
      message: "尚无训练样本。可运行：node tools/batch-auto-games.mjs 200",
      paths: {
        trainingDir,
        datasetsDir,
      },
    }, null, 2));
    return;
  }

  const games = samples.flatMap(extractGamesFromSample);
  const { rows, replays } = gamesToRows(games);
  const rowSummary = summarizeRows(rows);

  const outsideExamples = rows
    .filter((row) => row.label?.match === "outside-top-3" && row.tier === "gold")
    .slice(-5)
    .map((row) => ({
      rowId: row.rowId,
      seat: row.seat,
      label: row.label?.play?.label,
      top: row.candidates?.[0]?.play?.label,
    }));

  console.log(JSON.stringify({
    ok: true,
    sampleBundles: samples.length,
    games: games.length,
    replays: replays.length,
    rows: rowSummary,
    goldOutsideTop3Examples: outsideExamples,
    paths: {
      trainingDir,
      rowsJsonl: join(datasetsDir, "rows.jsonl"),
    },
    next: [
      "node tools/batch-auto-games.mjs 500",
      "node tools/replay-to-rows.mjs",
    ],
  }, null, 2));
}

main();
