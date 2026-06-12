import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCoachFeedbackPayload } from "../coach/feedback-sample.mjs";
import { writeCoachFixRequestFiles } from "../tools/lib/write-coach-fix-request.mjs";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const trainingDir = join(root, "training-samples");
const mdPath = join(trainingDir, "COACH-FIX-REQUEST.md");

const payload = buildCoachFeedbackPayload({
  question: "应打三带二不要拆炸",
  context: {
    levelRank: "2",
    turnNumber: 1,
    currentAdvice: {
      choices: [{ play: { label: "三带二 test" }, score: 1, reasons: [] }],
    },
    engineFacts: { hardRules: [] },
    humanHand: [],
    table: {},
    recentPlayHistory: [],
    recentCoachAdvice: [],
    recentAiConversation: [],
  },
});

await writeCoachFixRequestFiles(trainingDir, {
  question: payload.question,
  context: payload.coachContext,
  feedbackId: payload.feedbackId,
});

const md = await readFile(mdPath, "utf8");
if (!md.includes("status: pending")) throw new Error("missing pending status");
if (!md.includes("应打三带二")) throw new Error("missing question");
console.log("coach-fix-request 冒烟通过");
