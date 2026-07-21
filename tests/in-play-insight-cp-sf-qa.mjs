/**
 * 须压连对拆同花顺：异议/QA 应对齐 Top1 连对，勿误答「四炸A拆同花顺」。
 */
import { createCard, SUITS, playSignature } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import { tryLocalCoachAnswer } from "../coach/local-qa.mjs";
import { analyzeInPlayInsight } from "../coach/in-play-insight.mjs";
import { buildTop1MustBeatSfRunwayInsight } from "../strategy/doctrine-enforce.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);
const levelRank = "9";
const hand = [
  c("A", SUITS.spades), c("2", SUITS.spades), c("3", SUITS.spades), c("4", SUITS.spades), c("5", SUITS.spades),
  c("A", SUITS.clubs), c("A", SUITS.diamonds), c("A", SUITS.hearts),
  c("3", SUITS.diamonds), c("3", SUITS.clubs), c("6", SUITS.diamonds), c("6", SUITS.clubs),
  c("7", SUITS.diamonds), c("7", SUITS.clubs), c("2", SUITS.hearts), c("2", SUITS.diamonds),
  c("BJ"), c("SJ"),
  c("5", SUITS.clubs), c("9", SUITS.diamonds), c("10", SUITS.clubs), c("10", SUITS.diamonds),
  c("J", SUITS.hearts), c("Q", SUITS.clubs), c("K", SUITS.diamonds), c("K", SUITS.hearts),
];
const oppCp = classifyPlay([
  c("4", SUITS.diamonds), c("4", SUITS.diamonds, 1),
  c("5", SUITS.diamonds), c("5", SUITS.diamonds, 1),
  c("6", SUITS.diamonds), c("9", SUITS.hearts),
], levelRank);
const filler = Array.from({ length: 18 }, () => c("6", SUITS.clubs, 3));
const state = createGameStateFromHands({
  levelRank,
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: oppCp,
  lastActivePlayerIndex: 3,
});

const rec = recommendPlay(hand, levelRank, oppCp, {
  state,
  playerIndex: 0,
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 12,
  mlFusionMode: "off",
});

const breakingCp = classifyPlay([
  c("5", SUITS.spades), c("5", SUITS.clubs),
  c("6", SUITS.diamonds), c("6", SUITS.clubs),
  c("7", SUITS.diamonds), c("7", SUITS.clubs),
], levelRank);

const topPlay = rec.candidate?.type === PLAY_TYPES.pass
  ? breakingCp
  : rec.candidate;

const context = {
  status: "in-progress",
  levelRank,
  humanPlayerIndex: 0,
  playerIndex: 0,
  humanHand: hand,
  state,
  table: {
    lastActivePlay: oppCp,
    lastActivePlayerIndex: 3,
  },
  currentAdvice: {
    choices: [{
      play: topPlay,
      candidate: topPlay,
      reasons: rec.reasons ?? [],
    }],
  },
};

const insight = buildTop1MustBeatSfRunwayInsight(context);
if (!insight) {
  throw new Error("应检测到 Top1 须压连对拆同花顺跑道");
}
if (!/连对/.test(insight)) {
  throw new Error(`专答应提及连对，实际：${insight}`);
}

for (const question of ["不应拆同花顺", "这手不合理", "不宜拆同花顺连对压牌"]) {
  const qa = tryLocalCoachAnswer(question, context);
  if (!qa?.text) throw new Error(`QA 无答：${question}`);
  if (/四炸\s*A|出四炸A|四张A.*同花顺/i.test(qa.text)) {
    throw new Error(`「${question}」误答四炸A：${qa.text.slice(0, 120)}`);
  }
  if (!/连对|同花顺|过牌/.test(qa.text)) {
    throw new Error(`「${question}」应围绕连对/过牌/同花顺：${qa.text.slice(0, 120)}`);
  }
}

const { analysis, verdict } = analyzeInPlayInsight("不应拆同花顺", context);
if (verdict !== "adopted") {
  throw new Error(`异议应 adopted，实际 ${verdict}`);
}
if (/四炸\s*A|出四炸A/i.test(analysis)) {
  throw new Error(`即时异议误答四炸A：${analysis}`);
}
if (!/连对|同花顺|过牌/.test(analysis)) {
  throw new Error(`即时异议应围绕实际推荐：${analysis}`);
}

console.log("PASS in-play-insight-cp-sf-qa");
console.log(" ", playSignature(topPlay), "→", analysis.slice(0, 80));
