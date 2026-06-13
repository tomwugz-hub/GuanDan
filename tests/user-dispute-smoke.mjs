import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { buildGameReviewFixMarkdown, buildGameReviewPayload } from "../coach/game-review.mjs";
import {
  isDisputeUpgradeCandidate,
  normalizeUserDispute,
  parseUserDisputesFromMarkdown,
} from "../coach/user-dispute.mjs";
import { DIVERGENCE_VERDICTS } from "../coach/divergence-summary.mjs";
import { writeCoachFixRequestFiles } from "../tools/lib/write-coach-fix-request.mjs";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const trainingDir = await mkdtemp(join(tmpdir(), "guandan-dispute-smoke-"));

const dispute = normalizeUserDispute({
  turnNumber: 24,
  originalAdjudication: "教练更对",
  verdict: DIVERGENCE_VERDICTS.COACH_BETTER,
  verdictLabel: "教练更对",
  userRationale: "这手应保顺子结构，拆牌代价更大",
});

if (!dispute) throw new Error("normalizeUserDispute failed");
if (!isDisputeUpgradeCandidate(dispute)) {
  throw new Error("结构相关申诉应标记为重审候选");
}

const payload = buildGameReviewPayload({
  gameSnapshot: { gameId: "game-test", levelRank: "2" },
  coachAdviceTimeline: [],
  userDisputes: [dispute],
});

payload.divergenceSummary = {
  totalHands: 5,
  divergenceCount: 1,
  userBetterCount: 0,
  coachBetterCount: 1,
  coachQuestionableCount: 0,
  styleCount: 0,
  divergences: [{
    turnNumber: 24,
    verdict: DIVERGENCE_VERDICTS.COACH_BETTER,
    verdictLabel: "教练更对",
    verdictNote: "推荐1更稳",
    adjudication: "coach",
    recommended: "对子 大王 大王",
    actual: "级牌对子 梅花2 黑桃2",
    match: "suggestion-2",
  }],
};

const md = buildGameReviewFixMarkdown(payload);
if (!md.includes("## 用户申诉")) throw new Error("markdown 缺少用户申诉节");
if (!md.includes("保顺子结构")) throw new Error("markdown 缺少用户理由");
if (!md.includes("是（结构/教纲相关）")) throw new Error("markdown 缺少重审候选标记");

const parsed = parseUserDisputesFromMarkdown(md);
if (parsed.length !== 1) throw new Error(`应解析 1 条申诉，实际 ${parsed.length}`);
if (!parsed[0].upgradeCandidate) throw new Error("解析后应保留重审候选");

await writeCoachFixRequestFiles(trainingDir, payload);
const mdPath = join(trainingDir, "COACH-FIX-REQUEST.md");
const saved = await readFile(mdPath, "utf8");
if (!saved.includes("## 用户申诉")) throw new Error("COACH-FIX-REQUEST 缺少用户申诉");

await rm(trainingDir, { recursive: true, force: true });

console.log("user-dispute 冒烟通过");
