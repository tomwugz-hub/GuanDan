import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dedupeKey } from "./lib/dedupe-key.mjs";
import { loadMessagesFromFile, messageTimestamp } from "./lib/parse-ws-log.mjs";

export { dedupeKey } from "./lib/dedupe-key.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultOut = join(root, "training-samples", "imported", "merged-opengdan.jsonl");

function parseArgs(argv) {
  const options = { inputs: [], out: defaultOut };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out" || arg === "-o") {
      options.out = resolve(argv[i + 1]);
      i += 1;
    } else if (!arg.startsWith("-")) {
      options.inputs.push(resolve(arg));
    }
  }
  return options;
}

export function mergeMessageStreams(files) {
  const entries = [];
  const seen = new Set();

  for (const [fileIndex, filePath] of files.entries()) {
    const lines = loadMessagesFromFile(filePath);
    for (const { msg, lineIndex } of lines) {
      const key = dedupeKey(msg);
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({
        msg: { ...msg, _sourceFile: filePath, _sourceLine: lineIndex },
        ts: messageTimestamp(msg, fileIndex * 100000 + lineIndex),
        fileIndex,
        lineIndex,
      });
    }
  }

  entries.sort((a, b) => a.ts - b.ts || a.fileIndex - b.fileIndex || a.lineIndex - b.lineIndex);
  return entries.map((item) => item.msg);
}

function validateMerged(messages) {
  const beginnings = new Set();
  const legacyDeals = new Set();
  for (const msg of messages) {
    if (msg.type === "notify" && msg.stage === "beginning" && msg.myPos != null) {
      beginnings.add(msg.myPos);
    }
    if (msg.id === 22 && msg.data?.cards) {
      const loc = msg.data?.user_info?.location ?? msg.data?.location;
      if (loc != null) legacyDeals.add(Number(loc) - 1);
    }
  }
  return {
    openGuanDanSeats: [...beginnings].sort(),
    legacySeats: [...legacyDeals].sort(),
    hasFourSeats: beginnings.size === 4 || legacyDeals.size === 4,
  };
}

function main() {
  const { inputs, out } = parseArgs(process.argv);
  if (inputs.length < 2) {
    console.error("用法: node tools/merge-opengdan-logs.mjs <seat0.jsonl> <seat1.jsonl> ... [--out merged.jsonl]");
    console.error("建议：四个 AI 客户端各录一路 WebSocket 消息，再合并。");
    process.exit(1);
  }

  const messages = mergeMessageStreams(inputs);
  const validation = validateMerged(messages);

  mkdirSync(dirname(out), { recursive: true });
  const payload = `${messages.map((m) => JSON.stringify(m)).join("\n")}\n`;
  writeFileSync(out, payload, "utf8");

  console.log(JSON.stringify({
    ok: true,
    inputFiles: inputs.length,
    messageCount: messages.length,
    validation,
    output: out,
    next: validation.hasFourSeats
      ? `node tools/import-external-replay.mjs "${out}"`
      : "警告：未凑齐四座位发牌，导入可能失败；请检查是否合并了四路 beginning",
  }, null, 2));

  if (!validation.hasFourSeats) process.exit(2);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) main();
