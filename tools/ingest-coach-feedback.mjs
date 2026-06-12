import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractGamesFromSample, gamesToRows, summarizeRows } from "./lib/canonical-replay.mjs";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const questionsPath = join(root, "training-samples", "coach-questions.jsonl");
const reportPath = join(root, "training-samples", "coach-feedback-report.json");

async function readJsonl(path) {
  const text = await readFile(path, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function main() {
  let entries = [];
  try {
    entries = await readJsonl(questionsPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(JSON.stringify({
        ok: true,
        message: "尚无问教练反馈。在页面「问教练」发送问题即可自动采集。",
        path: questionsPath,
      }, null, 2));
      return;
    }
    throw error;
  }

  const byTag = new Map();
  for (const entry of entries) {
    const tag = entry.tag ?? "general";
    if (!byTag.has(tag)) byTag.set(tag, []);
    byTag.get(tag).push(entry);
  }

  const games = entries.flatMap((entry) => extractGamesFromSample({
    currentPosition: entry.currentPosition,
    games: entry.currentPosition ? [entry.currentPosition] : [],
  }));
  const { rows } = gamesToRows(games);
  const rowSummary = summarizeRows(rows);

  const report = {
    generatedAt: new Date().toISOString(),
    questionCount: entries.length,
    tagCounts: Object.fromEntries([...byTag.entries()].map(([tag, list]) => [tag, list.length])),
    recentQuestions: entries.slice(-12).map((item) => ({
      feedbackId: item.feedbackId,
      createdAt: item.createdAt,
      tag: item.tag,
      question: item.question,
      top: item.coachTopRecommendation?.label ?? null,
      answerSource: item.answerSource,
    })),
    trainableRows: rows.length,
    rowSummary,
    paths: {
      questions: questionsPath,
      report: reportPath,
    },
    nextSteps: [
      "node tools/replay-to-rows.mjs training-samples/coach-training-feedback.jsonl",
      "node tools/train-policy.mjs",
      "node tools/gate-policy.mjs",
    ],
  };

  await mkdir(join(root, "training-samples"), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
