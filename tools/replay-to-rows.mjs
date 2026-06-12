import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractAllGames,
  gamesToRows,
  loadTrainingInput,
  summarizeRows,
} from "./lib/canonical-replay.mjs";

const workspaceDir = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultOutDir = join(workspaceDir, "datasets", "v1");

function parseArgs(argv) {
  const options = {
    inputs: [],
    out: join(defaultOutDir, "rows.jsonl"),
    replaysOut: join(defaultOutDir, "canonical-replays.jsonl"),
    limit: 0,
    append: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out") {
      options.out = resolve(argv[i + 1]);
      i += 1;
    } else if (arg === "--replays-out") {
      options.replaysOut = resolve(argv[i + 1]);
      i += 1;
    } else if (arg === "--limit") {
      options.limit = Number(argv[i + 1]) || 0;
      i += 1;
    } else if (arg === "--append") {
      options.append = true;
    } else if (!arg.startsWith("-")) {
      options.inputs.push(resolve(arg));
    }
  }

  if (options.inputs.length === 0) {
    options.inputs.push(
      join(workspaceDir, "training-samples", "batch-auto-latest.json"),
      join(workspaceDir, "training-samples", "batch-auto-games.jsonl"),
      join(workspaceDir, "training-samples", "coach-training-latest.json"),
      join(workspaceDir, "training-samples", "coach-training-feedback.jsonl"),
    );
  }

  return options;
}

function writeJsonl(path, lines, append) {
  mkdirSync(dirname(path), { recursive: true });
  const payload = `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`;
  if (append) appendFileSync(path, payload, "utf8");
  else writeFileSync(path, payload, "utf8");
}

function main() {
  const options = parseArgs(process.argv);
  const loadedGames = [];

  for (const inputPath of options.inputs) {
    try {
      const input = loadTrainingInput(inputPath);
      loadedGames.push(...extractAllGames(input));
    } catch (error) {
      if (error.code === "ENOENT" || String(error.message || "").includes("文件不存在")) continue;
      throw error;
    }
  }

  const games = options.limit > 0 ? loadedGames.slice(-options.limit) : loadedGames;
  if (games.length === 0) {
    console.log(JSON.stringify({
      ok: false,
      message: "未找到可解析的牌局。请先「保存训练样本」或运行 node tools/batch-auto-games.mjs",
      tried: options.inputs,
    }, null, 2));
    process.exit(1);
  }

  const { replays, rows } = gamesToRows(games);
  writeJsonl(options.replaysOut, replays, options.append);
  writeJsonl(options.out, rows, options.append);

  const summary = summarizeRows(rows);
  console.log(JSON.stringify({
    ok: true,
    games: games.length,
    replays: replays.length,
    ...summary,
    outputs: {
      rows: options.out,
      replays: options.replaysOut,
    },
  }, null, 2));
}

main();
