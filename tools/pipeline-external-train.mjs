#!/usr/bin/env node
/** 一键：合并(可选) → 导入 → 抽行 → 训练 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const mergedOut = outIdx >= 0 ? args[outIdx + 1] : join(root, "training-samples/imported/merged-opengdan.jsonl");
  const inputs = args.filter((a, i) => a !== "--out" && (outIdx < 0 || i !== outIdx + 1));

  if (inputs.length === 0) {
    console.error("用法: node tools/pipeline-external-train.mjs <log1.jsonl> [log2 ...] [--out merged.jsonl]");
    process.exit(1);
  }

  let logPath = inputs[0];
  if (inputs.length >= 2) {
    run(`node tools/merge-opengdan-logs.mjs ${inputs.map((p) => `"${p}"`).join(" ")} --out "${mergedOut}"`);
    logPath = mergedOut;
  }

  const gameId = `pipeline-${Date.now()}`;
  run(`node tools/import-external-replay.mjs "${logPath}" ${gameId}`);
  const bundle = join(root, "training-samples/imported", `${gameId}.json`);
  run(`node tools/replay-to-rows.mjs "${bundle}"`);
  run("node tools/train-policy.mjs");
  run("node tools/eval-policy.mjs");
}

main();
