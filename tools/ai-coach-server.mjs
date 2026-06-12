import http from "node:http";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeCoachFixRequestFiles } from "./lib/write-coach-fix-request.mjs";
import { loadDotEnv } from "./lib/notify-coach-automation.mjs";
import { deleteSessionFile, readSessionFile, writeSessionFile } from "./lib/session-file.mjs";

const port = Number(process.env.GUANDAN_AI_PORT || 8787);
const workspaceDir = dirname(dirname(fileURLToPath(import.meta.url)));
await loadDotEnv(workspaceDir);
const trainingDir = join(workspaceDir, "training-samples");
const trainingJsonlPath = join(trainingDir, "coach-training-feedback.jsonl");
const trainingLatestPath = join(trainingDir, "coach-training-latest.json");
const coachQuestionsJsonlPath = join(trainingDir, "coach-questions.jsonl");
const coachQuestionsLatestPath = join(trainingDir, "coach-questions-latest.json");

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 60_000_000) {
        reject(new Error("请求内容太大"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function saveTrainingSample(sample) {
  await mkdir(trainingDir, { recursive: true });
  const enriched = {
    savedAt: new Date().toISOString(),
    source: "guandan-coach-browser",
    ...sample,
  };
  await appendFile(trainingJsonlPath, `${JSON.stringify(enriched)}\n`, "utf8");
  await writeFile(trainingLatestPath, JSON.stringify(enriched, null, 2), "utf8");
  return {
    sampleId: enriched.sampleId,
    jsonlPath: trainingJsonlPath,
    latestPath: trainingLatestPath,
  };
}

async function saveCoachFeedback(feedback) {
  await mkdir(trainingDir, { recursive: true });
  const enriched = {
    savedAt: new Date().toISOString(),
    source: "guandan-coach-ask-panel",
    ...feedback,
  };
  await appendFile(coachQuestionsJsonlPath, `${JSON.stringify(enriched)}\n`, "utf8");
  await writeFile(coachQuestionsLatestPath, JSON.stringify(enriched, null, 2), "utf8");

  const bundle = {
    version: 3,
    sampleId: enriched.feedbackId,
    exportedAt: enriched.savedAt,
    purpose: "coach-question-bundle",
    note: enriched.question,
    tag: enriched.tag,
    currentPosition: enriched.currentPosition ?? null,
    games: enriched.currentPosition ? [enriched.currentPosition] : [],
    coachFeedback: enriched,
  };
  await appendFile(trainingJsonlPath, `${JSON.stringify({
    savedAt: enriched.savedAt,
    source: "coach-question",
    ...bundle,
  })}\n`, "utf8");

  const fixBody = enriched.kind === "game-review"
    ? enriched
    : {
      question: enriched.question,
      context: enriched.coachContext ?? {
        levelRank: enriched.levelRank,
        turnNumber: enriched.turnNumber,
        humanHand: enriched.humanHand,
        table: enriched.table,
        engineFacts: enriched.engineFacts,
        currentAdvice: enriched.coachTopRecommendation
          ? {
            choices: [{
              play: { label: enriched.coachTopRecommendation.label, type: enriched.coachTopRecommendation.type },
              score: enriched.coachTopRecommendation.score,
              reasons: enriched.coachTopRecommendation.reasons,
            }],
          }
          : null,
      },
      feedbackId: enriched.feedbackId,
    };

  const fixFiles = await writeCoachFixRequestFiles(trainingDir, fixBody);

  return {
    feedbackId: enriched.feedbackId,
    jsonlPath: coachQuestionsJsonlPath,
    latestPath: coachQuestionsLatestPath,
    tag: enriched.tag,
    fixRequestPath: fixFiles.mdPath,
  };
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === "POST" && request.url === "/training-sample") {
    try {
      const payload = JSON.parse(await readBody(request));
      const result = await saveTrainingSample(payload);
      sendJson(response, 200, {
        ok: true,
        ...result,
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message || String(error) });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/coach-feedback") {
    try {
      const payload = JSON.parse(await readBody(request));
      const result = await saveCoachFeedback(payload);
      sendJson(response, 200, { ok: true, ...result });
    } catch (error) {
      sendJson(response, 500, { error: error.message || String(error) });
    }
    return;
  }

  if (request.method === "GET" && request.url === "/game-session") {
    try {
      const session = await readSessionFile(trainingDir);
      sendJson(response, 200, { ok: true, session });
    } catch (error) {
      sendJson(response, 500, { error: error.message || String(error) });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/game-session") {
    try {
      const payload = JSON.parse(await readBody(request));
      if (!payload?.state) {
        await deleteSessionFile(trainingDir);
        sendJson(response, 200, { ok: true, cleared: true });
        return;
      }
      const path = await writeSessionFile(trainingDir, payload);
      sendJson(response, 200, { ok: true, path });
    } catch (error) {
      sendJson(response, 500, { error: error.message || String(error) });
    }
    return;
  }

  if (request.method === "DELETE" && request.url === "/game-session") {
    try {
      await deleteSessionFile(trainingDir);
      sendJson(response, 200, { ok: true, cleared: true });
    } catch (error) {
      sendJson(response, 500, { error: error.message || String(error) });
    }
    return;
  }

  if (request.method === "GET" && request.url === "/coach-feedback/stats") {
    try {
      const { readFile } = await import("node:fs/promises");
      let count = 0;
      try {
        const text = await readFile(coachQuestionsJsonlPath, "utf8");
        count = text.split(/\r?\n/).filter((line) => line.trim()).length;
      } catch {
        count = 0;
      }
      sendJson(response, 200, { ok: true, count, path: coachQuestionsJsonlPath });
    } catch (error) {
      sendJson(response, 500, { error: error.message || String(error) });
    }
    return;
  }

  sendJson(response, 404, { error: "not-found" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`掼蛋训练采集服务：http://127.0.0.1:${port}`);
  console.log("  POST /coach-feedback   反馈样本 + 待改任务 COACH-FIX-REQUEST.md");
  if (process.env.CURSOR_AUTOMATION_WEBHOOK_URL) {
    console.log("  → pending 时将 POST Cursor Automation Webhook");
  } else {
    console.log("  → 未配置 CURSOR_AUTOMATION_WEBHOOK_URL（见 .env.example）");
  }
  console.log("  POST /training-sample  完整训练导出");
  console.log("  GET/POST /game-session  牌局存档（内置浏览器友好）");
  console.log("  GET  /coach-feedback/stats");
});
