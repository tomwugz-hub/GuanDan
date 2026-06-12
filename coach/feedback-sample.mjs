/**
 * 从「问教练」采集可入库的反馈样本（供训练管道分析）。
 */
export function buildCoachFeedbackPayload({
  question,
  context,
  record = null,
  currentPosition = null,
  matchLevels = null,
  matchGameNumber = null,
}) {
  const advice = context?.currentAdvice ?? null;
  const top = advice?.recommendation ?? advice?.choices?.[0] ?? null;
  const altList = advice?.alternatives ?? advice?.choices ?? [];
  const userTag = inferFeedbackTag(question, advice);

  return {
    version: 1,
    kind: "coach-question",
    feedbackId: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    purpose: "coach-iteration-feedback",
    tag: userTag,
    question: String(question ?? "").trim(),
    answer: record?.answer ?? null,
    answerSource: record?.answerSource ?? null,
    answerError: record?.error ?? null,
    model: record?.model ?? null,
    levelRank: context?.levelRank ?? currentPosition?.levelRank ?? null,
    turnNumber: context?.turnNumber ?? currentPosition?.turnNumber ?? null,
    matchLevels,
    matchGameNumber,
    coachTopRecommendation: top ? {
      type: top.candidate?.type ?? top.play?.type,
      mainRank: top.candidate?.mainRank ?? top.play?.mainRank,
      label: top.candidate?.label ?? top.play?.label,
      score: top.score,
      reasons: (top.reasons ?? []).slice(0, 6),
      mlScore: top.mlScore ?? null,
    } : null,
    coachAlternatives: altList.slice(0, 5).map((item) => ({
      type: item.candidate?.type ?? item.play?.type,
      mainRank: item.candidate?.mainRank ?? item.play?.mainRank,
      label: item.candidate?.label ?? item.play?.label,
      score: item.score,
      mlScore: item.mlScore ?? null,
    })),
    engineFacts: context?.engineFacts ?? null,
    humanHand: context?.humanHand ?? null,
    table: context?.table ?? null,
    recentPlayHistory: context?.recentPlayHistory ?? [],
    recentCoachAdvice: context?.recentCoachAdvice ?? [],
    recentAiConversation: context?.recentAiConversation ?? [],
    coachContext: context ?? null,
    currentPosition,
  };
}

function inferFeedbackTag(question, advice) {
  const q = String(question ?? "");
  if (/炸|炸弹|boom/i.test(q)) return "bomb-timing";
  if (/过牌|不要|pass/i.test(q)) return "pass-decision";
  if (/接风|牌权/i.test(q)) return "catch-wind";
  if (/ML|倾向|模型/i.test(q)) return "ml-fusion";
  if (/拆|理牌|结构/i.test(q)) return "structure-break";
  const match = advice?.recommendation?.actualChoiceMatch
    ?? advice?.actualChoiceMatch;
  if (match === "outside-top-3") return "disagree-top1";
  return "general";
}
