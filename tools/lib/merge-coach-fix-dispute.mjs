import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  coachFixMatchesDispute,
  mergeDisputeIntoCoachFixMarkdown,
  parseCoachFixFrontmatter,
} from "../../coach/user-dispute.mjs";
import { afterCoachFixRequestPending } from "./notify-coach-automation.mjs";

/**
 * 复盘保存后提交的异议：并入 pending 的 COACH-FIX-REQUEST 并重新拉起处理器。
 */
export async function appendDisputeToPendingFixRequest(trainingDir, dispute, feedbackId = null) {
  const mdPath = join(trainingDir, "COACH-FIX-REQUEST.md");
  let markdown;
  try {
    markdown = await readFile(mdPath, "utf8");
  } catch {
    return { merged: false, reason: "no-fix-request" };
  }

  if (!coachFixMatchesDispute(markdown, dispute, feedbackId)) {
    return { merged: false, reason: "no-matching-pending" };
  }

  const { markdown: next, merged, reason, disputeCount } = mergeDisputeIntoCoachFixMarkdown(markdown, dispute);
  if (!merged) {
    return { merged: false, reason: reason ?? "not-merged", disputeCount };
  }

  await writeFile(mdPath, next, "utf8");
  const fm = parseCoachFixFrontmatter(next);
  void afterCoachFixRequestPending({
    trainingDir,
    mdPath,
    feedbackId: fm.feedbackId ?? null,
    kind: fm.kind ?? null,
  }).catch(() => {});

  return {
    merged: true,
    fixRequestPath: mdPath,
    feedbackId: fm.feedbackId ?? null,
    disputeCount,
  };
}
