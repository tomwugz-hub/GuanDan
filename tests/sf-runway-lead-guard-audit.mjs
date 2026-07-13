/**
 * 同花顺跑道保护审计：单一模块 sf-runway-guard 须覆盖裁池/教纲/评分/应急/游戏路径。
 * 手牌：级牌6 黑桃9-K 跑道（6♥补J），炸后接风。
 */
import { createCard, SUITS, playSignature } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { humanAdviceFallback } from "../coach/robot-player.mjs";
import { buildStrategicGroups } from "../strategy/strategic-groups.mjs";
import { evaluateHandProfile } from "../strategy/hand-profile.mjs";
import { trimCandidatesForScoring, scoreCandidate } from "../strategy/recommend.mjs";
import { enforceDoctrineOnCandidates } from "../strategy/doctrine-enforce.mjs";
import { enrichScoringContext } from "../strategy/table-context.mjs";
import {
  breaksStraightFlushRunwayOnLead,
  filterCandidatesPreservingSfRunway,
  isLeadTurnSfRunwayBreak,
  leadSfRunwayDoctrineViolation,
} from "../strategy/sf-runway-guard.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

const hand = [
  c("9", SUITS.spades), c("10", SUITS.spades), c("Q", SUITS.spades), c("K", SUITS.spades),
  c("6", SUITS.hearts), c("6", SUITS.diamonds),
  c("9", SUITS.diamonds), c("9", SUITS.hearts), c("Q", SUITS.diamonds), c("Q", SUITS.hearts),
  c("5", SUITS.diamonds), c("10", SUITS.diamonds), c("J", SUITS.clubs),
  c("BJ", SUITS.spades), c("SJ", SUITS.spades),
];

const bomb = classifyPlay([
  c("7", SUITS.hearts), c("7", SUITS.diamonds), c("7", SUITS.clubs), c("7", SUITS.spades),
], "6");

const filler = Array.from({ length: 22 }, (_, i) => c("3", SUITS.clubs, i));
const state = createGameStateFromHands({
  levelRank: "6",
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: null,
  playHistory: [
    { playerIndex: 0, play: bomb },
    { playerIndex: 1, play: classifyPlay([], "6") },
    { playerIndex: 2, play: classifyPlay([], "6") },
    { playerIndex: 3, play: classifyPlay([], "6") },
  ],
});

const preferredGroups = buildStrategicGroups(hand, "6");
const handProfile = evaluateHandProfile(hand, "6", { preferredGroups });
const tableCtx = {
  state,
  playerIndex: 0,
  lite: true,
  scoringAudience: "human-lite",
  preferredGroups,
  handProfile,
  leadMode: "catch-wind",
  isOpening: true,
  opponentActive: false,
};

const all = generateBasicCandidates(hand, "6", null, { lite: true });
const badTypes = [
  PLAY_TYPES.straight,
  PLAY_TYPES.triple,
  PLAY_TYPES.pair,
  PLAY_TYPES.consecutivePairs,
];

let detected = 0;
for (const type of badTypes) {
  const sample = all.find((item) => item.type === type && isLeadTurnSfRunwayBreak(item, hand, "6", tableCtx));
  if (!sample) throw new Error(`应能生成拆跑道的 ${type} 样本`);
  if (!breaksStraightFlushRunwayOnLead(sample, hand, "6", tableCtx)?.includes("同花顺")) {
    throw new Error(`${type} 样本应被 breaksStraightFlushRunwayOnLead 识别`);
  }
  detected += 1;
}
if (detected < 3) throw new Error("拆跑道样本不足");

// 裁池：候选数 ≤ maxCandidates 时仍须过滤
const smallPool = all.slice(0, 12);
const trimmed = trimCandidatesForScoring(smallPool, 16, hand, "6", null, tableCtx);
for (const item of trimmed) {
  if (isLeadTurnSfRunwayBreak(item, hand, "6", tableCtx)) {
    throw new Error(`trim 后仍含拆跑道候选：${playSignature(item)}`);
  }
}
const filtered = filterCandidatesPreservingSfRunway(smallPool, hand, "6", null, tableCtx);
if (filtered.some((item) => isLeadTurnSfRunwayBreak(item, hand, "6", tableCtx))) {
  throw new Error("filterCandidatesPreservingSfRunway 漏网");
}

// 教纲：拆跑道须 blockTop1
const triple9 = all.find((item) => item.type === PLAY_TYPES.triple && item.mainRank === "9");
const violation = leadSfRunwayDoctrineViolation(triple9, hand, "6", tableCtx);
if (!violation?.blockTop1) throw new Error("教纲应 blockTop1 裸三张9");

const scored = scoreCandidate(triple9, hand, "6", null, enrichScoringContext(tableCtx, [triple9], hand, "6"));
const enforced = enforceDoctrineOnCandidates([scored], { ...tableCtx, hand, levelRank: "6" });
if (!enforced.candidates[0]?.doctrineBlockedTop1) {
  throw new Error("enforceDoctrine 应标记 doctrineBlockedTop1");
}

// 游戏路径
function assertAdvice(label, advice) {
  for (const [i, rec] of [advice.recommendation, ...(advice.alternatives ?? [])].entries()) {
    const cand = rec?.candidate;
    if (cand && isLeadTurnSfRunwayBreak(cand, hand, "6", tableCtx)) {
      throw new Error(`${label} 推荐${i + 1} 拆跑道：${playSignature(cand)}`);
    }
  }
}

const emergency = humanAdviceFallback(hand, "6", null, preferredGroups, { state, playerIndex: 0 });
if (isLeadTurnSfRunwayBreak(emergency.candidate, hand, "6", tableCtx)) {
  throw new Error(`应急拆跑道：${playSignature(emergency.candidate)}`);
}

const quick = getTurnAdvice(state, 0, {
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 16,
  preferredGroups,
  handProfile,
  alternatives: 2,
  deadline: performance.now() + 2500,
});
assertAdvice("quick", quick);

const full = getTurnAdvice(state, 0, {
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 20,
  preferredGroups,
  handProfile,
  alternatives: 6,
  deadline: performance.now() + 6000,
});
assertAdvice("full", full);

console.log(
  `PASS: sf-runway-guard 审计通过，quick Top1=${playSignature(quick.recommendation.candidate)}`,
);
