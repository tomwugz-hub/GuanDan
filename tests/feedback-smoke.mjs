import { buildCoachFeedbackPayload } from "../coach/feedback-sample.mjs";

const payload = buildCoachFeedbackPayload({
  question: "为什么首推炸弹？",
  context: {
    levelRank: "2",
    turnNumber: 12,
    currentAdvice: {
      recommendation: { candidate: { type: "Bomb", mainRank: "7", label: "炸弹 7" }, score: -100 },
      alternatives: [{ candidate: { type: "TripleWithPair", mainRank: "8" }, score: 200, mlScore: 0.02 }],
    },
    engineFacts: { hardRules: [] },
    humanHand: [],
    table: {},
    recentPlayHistory: [],
    recentCoachAdvice: [],
    recentAiConversation: [],
  },
  currentPosition: { gameId: "g1", turnNumber: 12 },
});

if (payload.kind !== "coach-question") throw new Error("kind");
if (payload.tag !== "bomb-timing") throw new Error(`tag ${payload.tag}`);
if (!payload.coachTopRecommendation) throw new Error("missing top");

console.log("问教练反馈样本冒烟通过");
