import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildCoachFixRequestMarkdown } from "../../coach/fix-request.mjs";
import { buildGameReviewFixMarkdown } from "../../coach/game-review.mjs";
import { afterCoachFixRequestPending } from "./notify-coach-automation.mjs";

export async function writeCoachFixRequestFiles(trainingDir, body) {
  await mkdir(trainingDir, { recursive: true });
  const markdown = body.kind === "game-review" || body.divergenceSummary
    ? buildGameReviewFixMarkdown(body)
    : buildCoachFixRequestMarkdown(body);
  const mdPath = join(trainingDir, "COACH-FIX-REQUEST.md");
  const queuePath = join(trainingDir, "coach-fix-queue.jsonl");
  const line = JSON.stringify({
    queuedAt: new Date().toISOString(),
    feedbackId: body.feedbackId ?? null,
    question: body.question ?? "",
  });

  await writeFile(mdPath, markdown, "utf8");
  await appendFile(queuePath, `${line}\n`, "utf8");

  // 非阻塞：通知 Cursor Automation（webhook）+ 可选 git push
  void afterCoachFixRequestPending({
    trainingDir,
    mdPath,
    feedbackId: body.feedbackId ?? null,
    kind: body.kind ?? null,
  }).catch(() => {});

  return { mdPath, queuePath };
}
