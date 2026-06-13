import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { buildGameReviewFixMarkdown, buildGameReviewPayload } from "../coach/game-review.mjs";
import {
  buildDisputeAckMessage,
  isDisputeUpgradeCandidate,
  isTempoRecoveryDisputeRationale,
  mergeDisputeIntoCoachFixMarkdown,
  normalizeUserDispute,
  parseUserDisputesFromMarkdown,
  reAdjudicateDispute,
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

const baseMd = buildGameReviewFixMarkdown({
  ...payload,
  userDisputes: [],
});
const lateDispute = normalizeUserDispute({
  turnNumber: 24,
  originalAdjudication: "教练更对",
  verdict: DIVERGENCE_VERDICTS.COACH_BETTER,
  verdictLabel: "教练更对",
  userRationale: "这手应保顺子结构，拆牌代价更大",
});
const merged = mergeDisputeIntoCoachFixMarkdown(baseMd, lateDispute);
if (!merged.merged) throw new Error("保存后申诉应能并入 COACH-FIX-REQUEST");
if (!merged.markdown.includes("## 用户申诉")) throw new Error("并入后缺少用户申诉节");

await writeCoachFixRequestFiles(trainingDir, payload);
const mdPath = join(trainingDir, "COACH-FIX-REQUEST.md");
const saved = await readFile(mdPath, "utf8");
if (!saved.includes("## 用户申诉")) throw new Error("COACH-FIX-REQUEST 缺少用户申诉");

await rm(trainingDir, { recursive: true, force: true });

// game-2 turn20：回牌/牌力申诉应触发重审
const turn20Dispute = normalizeUserDispute({
  turnNumber: 20,
  originalAdjudication: "教练更对",
  verdict: DIVERGENCE_VERDICTS.COACH_BETTER,
  verdictLabel: "教练更对",
  userRationale: "如果出对9，无法回牌，牌力太小",
});
if (!isDisputeUpgradeCandidate(turn20Dispute)) {
  throw new Error("回牌/牌力申诉应标记为重审候选");
}
if (!isTempoRecoveryDisputeRationale(turn20Dispute.userRationale)) {
  throw new Error("应识别为回牌/牌力理由");
}
const turn20Readj = reAdjudicateDispute(turn20Dispute, {
  recommended: "对子 梅花9 方片9（出对9保留J带对6，抬高下家出牌门槛）",
  actual: "三带二 黑桃J 梅花J 方片J 黑桃6 梅花6",
  levelRank: "2",
});
if (!turn20Readj?.upgrade) throw new Error("turn20 申诉应升级重审");
if (turn20Readj.verdict !== DIVERGENCE_VERDICTS.COACH_QUESTIONABLE
  && turn20Readj.verdict !== DIVERGENCE_VERDICTS.USER_BETTER) {
  throw new Error(`turn20 重审应判用户更对或教练不合理，实际 ${turn20Readj.verdict}`);
}
const turn20Ack = buildDisputeAckMessage(turn20Dispute);
if (!turn20Ack.includes("回牌") || !turn20Ack.includes("牌力")) {
  throw new Error(`turn20 确认文案应提及回牌/牌力，实际 ${turn20Ack}`);
}

console.log("user-dispute 冒烟通过");
