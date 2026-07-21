/**
 * 级牌2 接风/领出：仅剩五炸3 应满张出炸，不宜拆单3（含计算超时兜底）
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import {
  computeRecommendations,
  recommendPlay,
} from "../strategy/recommend.mjs";
import {
  pickOpeningLeadFallback,
  pickPureFullBombFinisher,
} from "../strategy/principles.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);
const hand = [
  c("3", SUITS.spades, 0),
  c("3", SUITS.hearts, 0),
  c("3", SUITS.clubs, 0),
  c("3", SUITS.diamonds, 0),
  c("3", SUITS.diamonds, 1),
];
const filler = Array.from({ length: 27 }, () => c("6", SUITS.clubs, 0));
const state = createGameStateFromHands({
  levelRank: "2",
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: null,
  lastActivePlayerIndex: 3,
});

const all = generateBasicCandidates(hand, "2", null);
const fallback = pickOpeningLeadFallback(hand, "2", all, [], { state });
if (fallback?.type !== PLAY_TYPES.bomb || (fallback.cards?.length ?? 0) !== 5) {
  console.error("FAIL: 兜底应满张五炸3，实际", fallback?.type, fallback?.cards?.length);
  process.exit(1);
}

const finisher = pickPureFullBombFinisher(hand, "2", all);
if (!finisher || finisher.type !== PLAY_TYPES.bomb || finisher.cards.length !== 5) {
  console.error("FAIL: pickPureFullBombFinisher 应返回五炸");
  process.exit(1);
}

const rec = recommendPlay(hand, "2", null, { state, mlFusionMode: "off" });
if (rec.candidate?.type !== PLAY_TYPES.bomb || rec.candidate.cards.length !== 5) {
  console.error("FAIL: 正式推荐应五炸3，实际", rec.candidate?.type, rec.candidate?.cards?.length);
  process.exit(1);
}

const deadlineRec = computeRecommendations(hand, "2", null, { mlFusionMode: "off", deadline: 0 });
if (
  deadlineRec.top.candidate?.type !== PLAY_TYPES.bomb
  || deadlineRec.top.candidate.cards.length !== 5
) {
  console.error(
    "FAIL: 超时兜底应五炸3，实际",
    deadlineRec.top.candidate?.type,
    deadlineRec.top.candidate?.cards?.length,
    deadlineRec.top.reasons,
  );
  process.exit(1);
}

const bombPlay = classifyPlay(hand, "2");
if (bombPlay.type !== PLAY_TYPES.bomb || bombPlay.bombSize !== 5) {
  console.error("FAIL: 五张3应归类为五炸");
  process.exit(1);
}

console.log("PASS: 纯五炸3 接风/超时均满张出炸");
