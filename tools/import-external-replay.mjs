import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { detectLegacyGdWs, legacyGdMessagesToGame } from "./adapters/legacy-gd-ws.mjs";
import {
  detectOpenGuanDanLog,
  opengdanMessagesToGame,
} from "./adapters/opengdan-log.mjs";
import { buildCanonicalReplay } from "./lib/canonical-replay.mjs";
import { mergeMessageStreams } from "./merge-opengdan-logs.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const importDir = join(root, "training-samples", "imported");

function loadMessages(path) {
  const text = readFileSync(path, "utf8").trim();
  if (!text) return [];
  if (path.endsWith(".jsonl")) {
    return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  }
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  if (data.messages) return data.messages;
  return [data];
}

function detectFormat(messages) {
  if (detectOpenGuanDanLog(messages)) return "opengdan";
  if (detectLegacyGdWs(messages)) return "legacy-gd-ws";
  return "unknown";
}

function importMessages(messages, { gameId, format }) {
  if (format === "opengdan") return opengdanMessagesToGame(messages, { gameId });
  if (format === "legacy-gd-ws") return legacyGdMessagesToGame(messages, { gameId });
  return { error: "无法识别日志格式，需 OpenGuanDan(notify/act) 或旧版 id 协议" };
}

function resolvePath(p) {
  if (/^[a-zA-Z]:/.test(p) || p.startsWith("/")) return p;
  return join(root, p);
}

function main() {
  const argvPaths = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const gameIdArg = argvPaths.length > 1 ? argvPaths[argvPaths.length - 1] : null;
  const fileArgs = gameIdArg && !gameIdArg.includes(".") && argvPaths.length > 1
    ? argvPaths.slice(0, -1)
    : argvPaths;

  if (fileArgs.length === 0) {
    console.error("用法: node tools/import-external-replay.mjs <日志.json|jsonl> [gameId]");
    console.error("或多文件: node tools/import-external-replay.mjs s0.jsonl s1.jsonl s2.jsonl s3.jsonl [gameId]");
    process.exit(1);
  }

  let messages;
  let absPath;
  if (fileArgs.length >= 2) {
    const inputs = fileArgs.map(resolvePath);
    messages = mergeMessageStreams(inputs);
    absPath = inputs.join("+");
  } else {
    absPath = resolvePath(fileArgs[0]);
    messages = loadMessages(absPath);
  }
  const format = detectFormat(messages);
  const baseName = basename(String(absPath).split("+")[0]).replace(/\.(jsonl|json)$/i, "");
  const gameId = (gameIdArg && !gameIdArg.includes(".")) ? gameIdArg : `${format}-${baseName}`;

  const game = importMessages(messages, { gameId, format });
  if (game?.error) {
    console.log(JSON.stringify({ ok: false, format, error: game.error, partial: game.partial }, null, 2));
    process.exit(1);
  }

  const bundle = {
    version: 3,
    sampleId: `import-${Date.now()}`,
    exportedAt: new Date().toISOString(),
    purpose: "external-replay-import",
    note: `自 ${format} 日志导入，四座位；来源: ${absPath}`,
    sourceFormat: format,
    games: [game],
    currentPosition: game,
  };

  mkdirSync(importDir, { recursive: true });
  const outJson = join(importDir, `${gameId}.json`);
  const outJsonl = join(importDir, "imported-games.jsonl");
  writeFileSync(outJson, JSON.stringify(bundle, null, 2), "utf8");
  appendFileSync(outJsonl, `${JSON.stringify(bundle)}\n`, "utf8");

  const canonical = buildCanonicalReplay(game);

  console.log(JSON.stringify({
    ok: true,
    format,
    gameId,
    status: game.status,
    importStats: game.importStats,
    canonicalStats: canonical.stats,
    outputs: {
      bundle: outJson,
      jsonl: outJsonl,
    },
    next: `node tools/replay-to-rows.mjs "${outJson}"`,
  }, null, 2));
}

main();
