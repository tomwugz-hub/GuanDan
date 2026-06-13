/**
 * 打牌中意见（gameInsights）三层反馈冒烟
 */
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  SUITS,
  PLAY_TYPES,
  createCard,
  createGameStateFromHands,
  recommendPlay,
  buildStrategicGroups,
  tryLocalCoachAnswer,
} from "../src/index.mjs";
import {
  analyzeInPlayInsight,
  buildGameInsightsMarkdownSection,
  formatInPlayInsightReply,
  INSIGHT_VERDICTS,
  normalizeGameInsight,
  parseGameInsightsFromMarkdown,
} from "../coach/in-play-insight.mjs";
import { buildGameReviewFixMarkdown, buildGameReviewPayload } from "../coach/game-review.mjs";
import { writeCoachFixRequestFiles } from "../tools/lib/write-coach-fix-request.mjs";
import { detectDoctrineViolations } from "../strategy/doctrine-enforce.mjs";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function cards(entries) {
  return entries.map(([rank, suit, deckIndex = 0]) => createCard(rank, suit, deckIndex));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// —— 开局同花顺当顺子、拆对组顺：用户「不应拆对组顺子」 ——
const sfStraightHand = cards([
  ["5", SUITS.spades], ["5", SUITS.hearts],
  ["6", SUITS.spades], ["7", SUITS.spades], ["8", SUITS.spades], ["9", SUITS.spades], ["10", SUITS.spades],
  ["3", SUITS.clubs], ["4", SUITS.diamonds],
  ["J", SUITS.clubs], ["Q", SUITS.diamonds],
  ["K", SUITS.hearts], ["A", SUITS.diamonds],
  ["2", SUITS.diamonds],
  ["BJ", SUITS.joker],
]);

const sfState = createGameStateFromHands({
  levelRank: "2",
  hands: [sfStraightHand, cards([["3"]]), cards([["4"]]), cards([["6"]])],
  currentPlayerIndex: 0,
});

const preferredGroups = buildStrategicGroups(sfStraightHand, "2");
const rec = recommendPlay(sfStraightHand, "2", null, {
  state: sfState,
  playerIndex: 0,
  preferredGroups,
  mlFusionMode: "off",
  mlModel: false,
});

const straightCandidates = rec.alternatives?.length
  ? [rec, ...rec.alternatives]
  : [rec];
const breakPairStraight = straightCandidates.find(
  (c) => c.candidate?.type === PLAY_TYPES.straight
    && /顺子/.test(c.candidate?.label ?? "")
    && !/同花顺/.test(c.candidate?.label ?? ""),
) ?? rec;

const insightContext = {
  status: "in-progress",
  levelRank: "2",
  turnNumber: 0,
  humanHand: sfStraightHand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
  table: {},
  state: sfState,
  playerIndex: 0,
  currentAdvice: {
    choices: [{
      play: breakPairStraight.candidate,
      reasons: breakPairStraight.reasons ?? [],
    }],
  },
};

const violations = detectDoctrineViolations(
  breakPairStraight.candidate,
  sfStraightHand,
  "2",
  { isOpening: true, leadMode: "fresh-open" },
);

const qa = tryLocalCoachAnswer("不应拆对组顺子", insightContext);
assert(qa?.text, "规则引擎应对拆对组顺有答复");

const analyzed = analyzeInPlayInsight("不应拆对组顺子", insightContext);
assert(
  analyzed.verdict === INSIGHT_VERDICTS.ADOPTED || analyzed.verdict === INSIGHT_VERDICTS.RECORDED,
  `拆对组顺应采纳或记录，实际 ${analyzed.verdict}；violations=${violations.length}`,
);
assert(analyzed.analysis.length > 4, "应有 1～3 句分析摘要");

const adoptedReply = formatInPlayInsightReply(analyzed.analysis, INSIGHT_VERDICTS.ADOPTED);
assert(adoptedReply.includes("教练说："), "应有教练说前缀");
assert(adoptedReply.includes("已记入本局优化"), "采纳应有优化文案");

const recordedReply = formatInPlayInsightReply(analyzed.analysis, INSIGHT_VERDICTS.RECORDED);
assert(recordedReply.includes("局末一并汇总"), "记录应有局末汇总文案");

const insight = normalizeGameInsight({
  turnNumber: 0,
  question: "不应拆对组顺子",
  analysis: analyzed.analysis,
  verdict: analyzed.verdict,
  top1Label: breakPairStraight.candidate?.label ?? null,
});
assert(insight?.turnNumber === 0, "normalizeGameInsight 失败");

const payload = buildGameReviewPayload({
  gameSnapshot: { gameId: "game-insight-test", levelRank: "2" },
  coachAdviceTimeline: [],
  gameInsights: [insight],
});
assert(payload.gameInsights?.length === 1, "payload 应含 gameInsights");

payload.divergenceSummary = {
  totalHands: 3,
  divergenceCount: 1,
  userBetterCount: 0,
  coachBetterCount: 1,
  coachQuestionableCount: 0,
  styleCount: 0,
  divergences: [],
};

const md = buildGameReviewFixMarkdown(payload);
assert(md.includes("## 本局你的意见"), "markdown 应有本局你的意见节");
assert(md.includes("不应拆对组顺子"), "markdown 应有用户原话");
assert(md.includes("采纳结果"), "markdown 应有采纳结果");

const parsed = parseGameInsightsFromMarkdown(md);
assert(parsed.length === 1, `应解析 1 条意见，实际 ${parsed.length}`);
assert(parsed[0].question.includes("不应拆对组顺子"), "解析应保留用户话");

const section = buildGameInsightsMarkdownSection([insight]);
assert(section.some((line) => line.includes("本局你的意见")), "section 应有标题");

const trainingDir = await mkdtemp(join(tmpdir(), "guandan-insight-smoke-"));
try {
  const { mdPath } = await writeCoachFixRequestFiles(trainingDir, payload);
  const written = await import("node:fs/promises").then((fs) => fs.readFile(mdPath, "utf8"));
  assert(written.includes("## 本局你的意见"), "写入 COACH-FIX-REQUEST 应含意见节");
} finally {
  await rm(trainingDir, { recursive: true, force: true });
}

console.log("game-insight-smoke：打牌中意见三层反馈通过");
