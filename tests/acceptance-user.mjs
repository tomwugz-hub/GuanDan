/**
 * 用户验收套件：3 条必过验收 + 历史 TOP10 反复问题
 * 运行：node tests/acceptance-user.mjs
 */
import { isWildCard } from "../engine/card.mjs";
import {
  SUITS,
  PLAY_TYPES,
  classifyPlay,
  createCard,
  createGameStateFromHands,
  passTurn,
  generateBasicCandidates,
  recommendPlay,
  buildStrategicGroups,
  tryLocalCoachAnswer,
  getTurnAdvice,
} from "../src/index.mjs";
import { playRecommendedTurn } from "../coach/robot-player.mjs";
import { buildCoachFeedbackClipboardText, isLegacyBriefAnswer } from "../coach/feedback-clipboard.mjs";
import { buildEngineFacts, filterReasonsForUser } from "../coach/local-qa.mjs";
import { detectAdviceTop1Violations } from "../strategy/doctrine-enforce.mjs";
import { scoreCandidate } from "../strategy/recommend.mjs";
import { enrichScoringContext } from "../strategy/table-context.mjs";

function cards(specs) {
  return specs.map(([rank, suit = SUITS.spades, deckIndex = 0]) => createCard(rank, suit, deckIndex));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const filler = cards([
  ["2", SUITS.clubs], ["2", SUITS.diamonds], ["9", SUITS.clubs], ["9", SUITS.diamonds],
  ["K", SUITS.clubs], ["K", SUITS.diamonds], ["J", SUITS.clubs], ["J", SUITS.diamonds],
]);

let passed = 0;
function case_(id, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${id}`);
}

console.log("acceptance-user: 用户 3 条验收 + 历史 TOP10\n");

// —— 验收 1：接风双钢板 → Top1 钢板 ——
case_("验收1-接风双钢板Top1钢板", () => {
  const hand = cards([
    ["6", SUITS.spades, 0], ["6", SUITS.hearts, 0], ["6", SUITS.clubs, 0],
    ["7", SUITS.spades, 0], ["7", SUITS.hearts, 0], ["7", SUITS.clubs, 0],
    ["9", SUITS.spades, 0], ["9", SUITS.hearts, 0], ["9", SUITS.clubs, 0],
    ["10", SUITS.spades, 0], ["10", SUITS.hearts, 0], ["10", SUITS.clubs, 0],
    ["3", SUITS.diamonds, 0], ["4", SUITS.diamonds, 0], ["5", SUITS.diamonds, 0],
    ["8", SUITS.diamonds, 0], ["J", SUITS.diamonds, 0], ["Q", SUITS.diamonds, 0],
    ["K", SUITS.diamonds, 0], ["A", SUITS.diamonds, 0], ["2", SUITS.diamonds, 0],
  ]);
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: null,
    playHistory: [
      { turnNumber: 1, playerIndex: 0, play: classifyPlay(cards([["A", SUITS.hearts]]), "3") },
      { turnNumber: 2, playerIndex: 1, play: classifyPlay([], "3") },
      { turnNumber: 3, playerIndex: 2, play: classifyPlay([], "3") },
      { turnNumber: 4, playerIndex: 3, play: classifyPlay([], "3") },
    ],
  };
  const rec = recommendPlay(hand, "3", null, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.plane,
    `接风双钢板应首推钢板，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
  const triple6 = generateBasicCandidates(hand, "3", null)
    .find((c) => c.type === PLAY_TYPES.tripleWithPair && c.mainRank === "6");
  if (triple6) {
    const scored = recommendPlay(hand, "3", null, { state, playerIndex: 0, mlFusionMode: "off" });
    assert(
      !(scored.candidate.type === PLAY_TYPES.tripleWithPair && scored.candidate.mainRank === "6"),
      "接风不得首推三带二拆钢板",
    );
  }
});

// —— 验收 2：压单4有单8 → Top1 单8 ——
case_("验收2-压单4Top1单8", () => {
  const hand = cards([
    ["7", SUITS.spades, 1], ["7", SUITS.hearts, 0], ["7", SUITS.hearts, 1],
    ["7", SUITS.clubs, 0], ["7", SUITS.clubs, 1], ["7", SUITS.diamonds, 1],
    ["A", SUITS.hearts, 1], ["2", SUITS.diamonds, 1],
    ["3", SUITS.clubs, 0], ["3", SUITS.diamonds, 0],
    ["4", SUITS.spades, 0], ["5", SUITS.spades, 0],
    ["6", SUITS.spades, 0], ["6", SUITS.spades, 1], ["6", SUITS.clubs, 1],
    ["K", SUITS.diamonds, 0], ["K", SUITS.diamonds, 1],
    ["8", SUITS.diamonds, 1], ["Q", SUITS.hearts, 1],
    ["SJ", SUITS.joker, 0],
  ]);
  const prev = classifyPlay(cards([["4", SUITS.diamonds, 0]]), "3");
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const rec = recommendPlay(hand, "3", prev, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.single && rec.candidate.mainRank === "8",
    `压单4有散单8应出单8，实际 ${rec.candidate.label ?? rec.candidate.mainRank}`,
  );
  assert(
    !(rec.candidate.type === PLAY_TYPES.single && rec.candidate.mainRank === "5"),
    "不得首推单5拆顺子",
  );
});

// —— 验收 3：6张7压顺子45678 → Top1 六炸7 + QA 满张控权 ——
case_("验收3-6张7压顺子六炸7", () => {
  const hand = cards([
    ["7", SUITS.spades, 1], ["7", SUITS.hearts, 0], ["7", SUITS.hearts, 1],
    ["7", SUITS.clubs, 0], ["7", SUITS.clubs, 1], ["7", SUITS.diamonds, 1],
    ["A", SUITS.hearts, 1], ["2", SUITS.diamonds, 1],
    ["3", SUITS.clubs, 0], ["3", SUITS.diamonds, 0],
    ["4", SUITS.spades, 0], ["5", SUITS.spades, 0],
    ["6", SUITS.spades, 0], ["6", SUITS.spades, 1], ["6", SUITS.clubs, 1],
    ["K", SUITS.diamonds, 0], ["K", SUITS.diamonds, 1],
    ["8", SUITS.diamonds, 1], ["Q", SUITS.hearts, 1],
    ["SJ", SUITS.joker, 0],
  ]);
  const prev = classifyPlay(
    cards([["4", SUITS.diamonds, 0], ["5", SUITS.spades, 0], ["6", SUITS.spades, 0], ["7", SUITS.hearts, 0], ["8", SUITS.clubs, 0]]),
    "3",
  );
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const rec = recommendPlay(hand, "3", prev, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.bomb && rec.candidate.mainRank === "7" && (rec.candidate.bombSize ?? 4) === 6,
    `6张7压顺子应首推六炸7，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
  const bomb6 = generateBasicCandidates(hand, "3", prev)
    .find((c) => c.type === PLAY_TYPES.bomb && c.mainRank === "7" && (c.bombSize ?? 4) === 6);
  const qa = tryLocalCoachAnswer("为什么拆顺子？打了四个7剩下的两个7怎么办？", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 40,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: prev },
    currentAdvice: { choices: [{ play: bomb6, reasons: rec.reasons }] },
  });
  assert(/物理手牌.*6|6\s*张7/.test(qa.text), "问教练应写物理6张7");
  assert(/满张|六炸|控牌权|控权/.test(qa.text), "问教练应说明满张六炸控权");
  assert(!/不应.*拆.*顺子.*应出单8/.test(qa.text), "压顺子场景不应误答单8");
  assert(/四炸.*弱|易被反压/.test(qa.text), "问教练应说明四炸易被反压");
});

// —— 验收 3b：用户实机 10 张手牌（6张7+三6+单3）压顺子 ——
case_("验收3b-实机10张6张7压顺子六炸", () => {
  const hand = cards([
    ["7", SUITS.spades, 0], ["7", SUITS.hearts, 0], ["7", SUITS.hearts, 1],
    ["7", SUITS.clubs, 0], ["7", SUITS.clubs, 1], ["7", SUITS.diamonds, 0],
    ["6", SUITS.spades, 0], ["6", SUITS.hearts, 0], ["6", SUITS.clubs, 0],
    ["3", SUITS.diamonds, 0],
  ]);
  const prev = classifyPlay(
    cards([["4", SUITS.diamonds], ["5", SUITS.spades], ["6", SUITS.clubs], ["7", SUITS.hearts], ["8", SUITS.clubs]]),
    "3",
  );
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const rec = recommendPlay(hand, "3", prev, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    mlModel: false,
  });
  assert(
    rec.candidate.type === PLAY_TYPES.bomb && rec.candidate.mainRank === "7" && (rec.candidate.bombSize ?? 4) === 6,
    `实机10张手牌应首推六炸7，实际 ${rec.candidate.label ?? rec.candidate.type}`,
  );
  assert(
    rec.reasons.some((r) => /【P7】|满张|控牌权|四炸易被反压/.test(r)),
    "推荐理由应含 P7 满张炸弹控牌权说明",
  );
  assert(
    rec.reasons.filter((r) => /满张炸弹控牌权，四炸易被反压/.test(r)).length <= 1,
    "P7 满张控权理由不应重复",
  );
  assert(!(rec.doctrineViolations ?? []).length, "满张六炸 Top1 不应带 violation");
  const qa = tryLocalCoachAnswer("为什么拆顺子？打了四个7剩下的两个7怎么办？", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 12,
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: prev },
    currentAdvice: { choices: [{ play: rec.candidate, reasons: rec.reasons }] },
  });
  assert(qa?.mode === "why-break-bomb-structure", "实机场景 QA 应走 why-break-bomb-structure");
  assert(/没有顺子可拆|并非拆顺子|不是为了拆.*顺子/.test(qa.text), "应说明手里无顺子、不是拆顺子");
  assert(/满张|六炸|控牌权|控权/.test(qa.text), "应说明满张六炸控权");
  assert(/物理.*6.*7|6\s*张7/.test(qa.text), "应写物理6张7");
  assert(/四炸.*弱|易被反压/.test(qa.text), "应说明四炸易被反压");
});

// —— 验收 3c：推荐3 四炸理由不重复、无【执法】 ——
case_("验收3c-推荐3四炸理由精简", () => {
  const hand = cards([
    ["7", SUITS.spades, 0], ["7", SUITS.hearts, 0], ["7", SUITS.hearts, 1],
    ["7", SUITS.clubs, 0], ["7", SUITS.clubs, 1], ["7", SUITS.diamonds, 0],
    ["6", SUITS.spades, 0], ["6", SUITS.hearts, 0], ["6", SUITS.clubs, 0],
    ["3", SUITS.diamonds, 0],
  ]);
  const prev = classifyPlay(
    cards([["4", SUITS.diamonds], ["5", SUITS.spades], ["6", SUITS.clubs], ["7", SUITS.hearts], ["8", SUITS.clubs]]),
    "3",
  );
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const advice = getTurnAdvice(state, 0, { mlFusionMode: "off", mlModel: null, alternatives: 8 });
  const top1 = advice.recommendation;
  assert(
    top1.candidate.cards?.length === 6 && top1.candidate.mainRank === "7",
    `Top1 应六炸7，实际 ${top1.candidate.label ?? top1.candidate.type}`,
  );
  const top1Reasons = filterReasonsForUser(top1.reasons, "", {
    play: top1.candidate,
    previousPlay: prev,
    levelRank: "3",
    choiceIndex: 0,
  });
  assert(
    top1Reasons.filter((r) => /【P7】/.test(r)).length <= 1,
    `Top1 P7 理由应 ≤1 条，实际 ${top1Reasons.join("；")}`,
  );
  assert(!top1Reasons.some((r) => /【执法】/.test(r)), "Top1 不应展示【执法】");
  const bomb4Cand = generateBasicCandidates(hand, "3", prev).find(
    (c) => c.type === PLAY_TYPES.bomb && c.mainRank === "7" && c.cards?.length === 4,
  );
  assert(bomb4Cand, "应能生成四炸7候选");
  const allCands = generateBasicCandidates(hand, "3", prev);
  const bomb4 = scoreCandidate(bomb4Cand, hand, "3", prev, {
    ...enrichScoringContext(
      { state, playerIndex: 0, previousPlay: prev, lastActivePlayerIndex: 1 },
      allCands,
      hand,
      "3",
    ),
    _candidates: allCands,
    hasActionableRegularWinner: false,
    hasAnyWinner: true,
  });
  const altReasons = filterReasonsForUser(bomb4.reasons, "", {
    play: bomb4.candidate,
    previousPlay: prev,
    levelRank: "3",
    choiceIndex: 2,
  });
  assert(altReasons.length <= 2, `备选理由应 ≤2 条，实际 ${altReasons.length}：${altReasons.join("；")}`);
  assert(
    altReasons.filter((r) => /【P7】/.test(r)).length <= 1,
    `备选 P7 理由应 ≤1 条，实际 ${altReasons.join("；")}`,
  );
  assert(!altReasons.some((r) => /【执法】/.test(r)), `备选不应展示【执法】，实际 ${altReasons.join("；")}`);
  assert(
    altReasons.some((r) => /拆炸|满张|四炸/.test(r)),
    `备选应说明四炸次优，实际 ${altReasons.join("；")}`,
  );
});

console.log("\nacceptance-user: 历史 TOP10 反复问题\n");

// H1 接风/压牌/拆结构混用
case_("H1-压单散单优先不拆对", () => {
  const hand = cards([
    ["4", SUITS.spades], ["4", SUITS.hearts], ["4", SUITS.hearts, 1], ["4", SUITS.clubs],
    ["5", SUITS.spades], ["5", SUITS.clubs, 1],
    ["Q", SUITS.spades], ["Q", SUITS.diamonds, 1],
    ["8", SUITS.spades, 1], ["8", SUITS.hearts, 1],
    ["10", SUITS.spades, 1], ["10", SUITS.clubs],
    ["J", SUITS.spades], ["J", SUITS.clubs, 1],
    ["K", SUITS.clubs, 1], ["K", SUITS.diamonds],
    ["A", SUITS.diamonds, 1],
    ["3", SUITS.diamonds, 1],
    ["SJ", SUITS.joker],
  ]);
  const prev = classifyPlay(cards([["7", SUITS.diamonds, 1]]), "3");
  let state = createGameStateFromHands({ levelRank: "3", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const rec = recommendPlay(hand, "3", prev, { state, playerIndex: 0, mlFusionMode: "off", mlModel: false });
  assert(rec.candidate.type === PLAY_TYPES.single && rec.candidate.mainRank === "A", "压单7应单A不拆对");
});

// H2 机器人滥炸小单（与 doctrine P12-机器人小单5 同构）
case_("H2-机器人小单不过炸", () => {
  const lead = classifyPlay(cards([["5", SUITS.diamonds]]), "3");
  const oppHand = cards([
    ["6", SUITS.clubs],
    ["7", SUITS.hearts],
    ["5", SUITS.spades], ["5", SUITS.hearts], ["5", SUITS.clubs], ["3", SUITS.hearts],
    ["9", SUITS.spades], ["9", SUITS.hearts], ["9", SUITS.clubs], ["9", SUITS.diamonds], ["9", SUITS.diamonds, 1],
    ["K", SUITS.spades], ["Q", SUITS.spades], ["J", SUITS.spades], ["10", SUITS.spades],
    ["8", SUITS.spades], ["8", SUITS.clubs], ["4", SUITS.spades], ["4", SUITS.clubs],
    ["A", SUITS.spades], ["A", SUITS.clubs], ["2", SUITS.spades], ["2", SUITS.clubs],
    ["6", SUITS.diamonds], ["7", SUITS.diamonds], ["3", SUITS.clubs],
  ]);
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [filler, oppHand, filler, filler],
    currentPlayerIndex: 1,
  });
  state = { ...state, lastActivePlay: lead, lastActivePlayerIndex: 0 };
  const turn = playRecommendedTurn(state, { lite: true, mlFusionMode: "off", mlModel: false });
  assert(turn.recommendation.candidate.type !== PLAY_TYPES.bomb, "机器人小单5不应滥炸");
});

// H3 问教练非 brief
case_("H3-专问不走brief炸弹备忘", () => {
  const ans = tryLocalCoachAnswer("这局整体怎么打比较好？", {
    status: "in-progress",
    levelRank: "3",
    turnNumber: 1,
    humanHand: [],
    table: {},
    currentAdvice: { choices: [] },
  });
  assert(ans?.mode === "fallback", "泛问应走 fallback 短答");
  assert(!ans.text.includes("规则备忘"), "兜底禁止炸弹备忘");
  assert(ans.text.includes("请具体问") || ans.text.includes("暂未识别"), "应提示具体问法");
});

// H4 advice 与 enforce 一致
case_("H4-advice执法违规可检测", () => {
  const hand = cards([
    ["6", SUITS.spades, 0], ["6", SUITS.hearts, 0], ["6", SUITS.clubs, 0],
    ["7", SUITS.spades, 0], ["7", SUITS.hearts, 0], ["7", SUITS.clubs, 0],
    ["9", SUITS.spades, 0], ["9", SUITS.hearts, 0], ["9", SUITS.clubs, 0],
    ["10", SUITS.spades, 0], ["10", SUITS.hearts, 0], ["10", SUITS.clubs, 0],
    ["3", SUITS.diamonds, 0], ["4", SUITS.diamonds, 0], ["5", SUITS.diamonds, 0],
    ["8", SUITS.diamonds, 0], ["J", SUITS.diamonds, 0], ["Q", SUITS.diamonds, 0],
    ["K", SUITS.diamonds, 0], ["A", SUITS.diamonds, 0], ["2", SUITS.diamonds, 0],
  ]);
  let state = createGameStateFromHands({ levelRank: "3", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  const wrongTriple = generateBasicCandidates(hand, "3", null)
    .find((c) => c.type === PLAY_TYPES.tripleWithPair && c.mainRank === "6");
  const ctx = {
    status: "in-progress",
    levelRank: "3",
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    table: { lastActivePlay: null },
    currentAdvice: { choices: [{ play: wrongTriple, reasons: ["减手"] }] },
  };
  const violations = detectAdviceTop1Violations(ctx);
  assert(violations.length > 0, "接风拆钢板三带二应检出违规");
});

// H5 QA 物理手牌 count
case_("H5-QA物理手牌6张7非理牌4张", () => {
  const hand = cards([
    ["7", SUITS.spades, 1], ["7", SUITS.hearts, 0], ["7", SUITS.hearts, 1],
    ["7", SUITS.clubs, 0], ["7", SUITS.clubs, 1], ["7", SUITS.diamonds, 1],
    ["A", SUITS.hearts, 1], ["2", SUITS.diamonds, 1],
    ["3", SUITS.clubs, 0], ["3", SUITS.diamonds, 0],
    ["4", SUITS.spades, 0], ["5", SUITS.spades, 0],
    ["6", SUITS.spades, 0], ["6", SUITS.spades, 1], ["6", SUITS.clubs, 1],
    ["K", SUITS.diamonds, 0], ["K", SUITS.diamonds, 1],
    ["8", SUITS.diamonds, 1], ["Q", SUITS.hearts, 1],
    ["SJ", SUITS.joker, 0],
  ]);
  const facts = buildEngineFacts({
    humanHand: hand.map((c) => ({ rank: c.rank, suit: c.suit, deckIndex: c.deckIndex })),
    levelRank: "3",
    currentAdvice: { choices: [] },
  });
  const seven = facts.physicalRankCounts.find((item) => item.rank === "7");
  assert(seven?.count === 6, `物理手牌应计6张7，实际 ${seven?.count}`);
});

// H6 复制反馈 v2 only
case_("H6-复制反馈仅v2带时间", () => {
  const clip = buildCoachFeedbackClipboardText(
    { question: "q", context: { levelRank: "3" } },
    [
      { source: "fab-coach", createdAt: "2026-06-07T10:00:00.000Z", question: "旧", answer: "【规则教练 · 本机答复】", answerSource: "brief" },
      { source: "fab-coach", createdAt: "2026-06-07T11:00:00.000Z", question: "新", answer: "【规则引擎作答】\n应出单8", answerSource: "why-not-play" },
    ],
    { gameId: "g1" },
  );
  assert(clip.includes("省略 1 条旧版 brief"), "应省略旧 brief");
  assert(clip.includes("[why-not-play]"), "应标注 mode");
  assert(!clip.includes("【规则教练 · 本机答复】"), "不应复制旧 brief 问答正文");
  assert(clip.includes("应出单8"), "应保留 v2 专答");
});

// H7 整对K vs 拆三同张6
case_("H7-压对5整对K不拆三张6", () => {
  const hand = cards([
    ["6", SUITS.spades, 0], ["6", SUITS.spades, 1], ["6", SUITS.clubs, 1],
    ["K", SUITS.diamonds, 0], ["K", SUITS.diamonds, 1],
    ["7", SUITS.spades, 1], ["7", SUITS.hearts, 0], ["7", SUITS.hearts, 1],
    ["7", SUITS.clubs, 0], ["7", SUITS.clubs, 1], ["7", SUITS.diamonds, 1],
    ["8", SUITS.diamonds, 1], ["Q", SUITS.hearts, 1], ["A", SUITS.hearts, 1],
    ["2", SUITS.diamonds, 1], ["SJ", SUITS.joker, 0],
  ]);
  const prev = classifyPlay(cards([["5", SUITS.diamonds, 0], ["5", SUITS.hearts, 0]]), "3");
  let state = createGameStateFromHands({ levelRank: "3", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const rec = recommendPlay(hand, "3", prev, { state, playerIndex: 0, mlFusionMode: "off", mlModel: false });
  assert(rec.candidate.type === PLAY_TYPES.pair && rec.candidate.mainRank === "K", "应出对K不拆三张6");
});

// H8 ML 不覆盖教纲（off 模式 Top1 合规，与 P1-压单3有单Q 同构）
case_("H8-ML-off教纲Top1", () => {
  const hand = cards([
    ["6", SUITS.spades], ["6", SUITS.hearts], ["6", SUITS.diamonds],
    ["7", SUITS.spades], ["7", SUITS.hearts], ["7", SUITS.diamonds],
    ["4", SUITS.spades], ["4", SUITS.hearts], ["4", SUITS.clubs], ["4", SUITS.diamonds],
    ["3", SUITS.spades], ["3", SUITS.hearts],
    ["5", SUITS.spades], ["5", SUITS.hearts],
    ["8", SUITS.spades], ["8", SUITS.hearts],
    ["10", SUITS.spades], ["10", SUITS.hearts],
    ["A", SUITS.spades], ["A", SUITS.hearts],
    ["Q", SUITS.clubs],
    ["BJ", SUITS.joker],
  ]);
  const prev = classifyPlay(cards([["3", SUITS.hearts]]), "5");
  let state = createGameStateFromHands({ levelRank: "5", hands: [hand, filler, filler, filler], currentPlayerIndex: 0 });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 1 };
  const advice = getTurnAdvice(state, 0, { mlFusionMode: "off", mlModel: false });
  assert(
    advice.recommendation.candidate.type === PLAY_TYPES.single && advice.recommendation.candidate.mainRank === "Q",
    `ML off 时教纲 Top1 应为散单Q，实际 ${advice.recommendation.candidate.mainRank}`,
  );
});

// H9 逢人配五炸不进 Top1（与 doctrine P7-4444+逢人配压王 同构）
case_("H9-纯四炸优先于逢人配五炸", () => {
  const hand = cards([
    ["4", SUITS.spades], ["4", SUITS.hearts], ["4", SUITS.clubs], ["4", SUITS.diamonds],
    ["3", SUITS.hearts],
    ["6", SUITS.clubs], ["7", SUITS.hearts], ["8", SUITS.spades],
    ["9", SUITS.clubs], ["10", SUITS.diamonds],
    ["J", SUITS.spades], ["Q", SUITS.clubs], ["K", SUITS.hearts],
    ["A", SUITS.diamonds], ["2", SUITS.clubs], ["5", SUITS.spades],
    ["6", SUITS.diamonds], ["7", SUITS.clubs],
  ]);
  const prev = classifyPlay(cards([["SJ", SUITS.joker]]), "3");
  const wildFiller = cards([
    ["8", SUITS.clubs], ["9", SUITS.hearts], ["10", SUITS.spades],
    ["J", SUITS.diamonds], ["Q", SUITS.hearts], ["K", SUITS.diamonds],
    ["A", SUITS.spades], ["2", SUITS.hearts], ["5", SUITS.clubs],
  ]);
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [wildFiller, wildFiller, hand, wildFiller],
    currentPlayerIndex: 2,
  });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: 3 };
  const rec = recommendPlay(hand, "3", prev, { state, playerIndex: 2, mlFusionMode: "off", mlModel: false });
  assert(rec.candidate.mainRank === "4" && (rec.candidate.bombSize ?? 0) === 4, "压王应纯四炸4");
  assert(!rec.candidate.cards.some((c) => c.rank === "3" && c.suit === SUITS.hearts), "不应含逢人配五炸");
});

// 用户反馈第90手：老史接风对手报单应出10非2
case_("U90-老史接风报单出10", () => {
  const laoshiHand = cards([
    ["2", SUITS.spades],
    ["10", SUITS.spades, 1],
    ["BJ", SUITS.joker, 1],
  ]);
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [
      cards([["3", SUITS.diamonds]]),
      cards([["4", SUITS.hearts]]),
      laoshiHand,
      filler,
    ],
    currentPlayerIndex: 2,
  });
  state = { ...state, lastActivePlay: null, lastActivePlayerIndex: null, passCount: 0, playHistory: [] };
  const turn = playRecommendedTurn(state, { lite: true, mlFusionMode: "off", mlModel: false });
  assert(
    turn.recommendation.candidate.mainRank === "10",
    `第90手类局面应出黑桃10，实际 ${turn.recommendation.candidate.label ?? turn.recommendation.candidate.mainRank}`,
  );
});

// 用户反馈第92手：用户出完级牌3后队友老史接风
case_("U92-出完级牌队友接风", () => {
  const level3 = classifyPlay([createCard("3", SUITS.diamonds)], "3");
  const passPlay = classifyPlay([], "3");
  let state = createGameStateFromHands({
    levelRank: "3",
    hands: [
      [],
      [],
      cards([["10", SUITS.spades, 1], ["BJ", SUITS.joker, 1]]),
      filler,
    ],
    currentPlayerIndex: 2,
  });
  state = {
    ...state,
    players: state.players.map((player, index) => {
      if (index === 0) return { ...player, hand: [], finishedOrder: 2 };
      if (index === 1) return { ...player, hand: [], finishedOrder: 1 };
      return player;
    }),
    finishedPlayers: [1, 0],
    lastActivePlay: level3,
    lastActivePlayerIndex: 1,
    passCount: 0,
    playHistory: [
      { turnNumber: 88, playerIndex: 1, play: classifyPlay([createCard("4", SUITS.hearts)], "3") },
      { turnNumber: 89, playerIndex: 2, play: classifyPlay([createCard("2", SUITS.spades)], "3") },
      { turnNumber: 92, playerIndex: 0, play: level3 },
      { turnNumber: 93, playerIndex: 3, play: passPlay },
    ],
  };
  state = passTurn(state);
  assert(state.currentPlayerIndex === 2, `接风应到老史(2)，实际 ${state.currentPlayerIndex}`);
  assert(state.lastActivePlay === null, "接风后应清台");
});

// H10 旧 brief 识别
case_("H10-旧brief识别", () => {
  assert(isLegacyBriefAnswer({ answerSource: "brief", answer: "x" }), "brief 源应判旧");
  assert(!isLegacyBriefAnswer({ answerSource: "why-not-play", answer: "【规则引擎作答】\n— 规则引擎 v2" }), "v2 专答非旧");
});

console.log(`\nacceptance-user: 全部 ${passed} 项通过`);
