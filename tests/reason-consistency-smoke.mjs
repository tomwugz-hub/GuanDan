/**
 * 推荐动作 vs 理由文案一致性冒烟测试
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { computeRecommendations, recommendPlay } from "../strategy/recommend.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import {
  alignReasonsForPlay,
  dedupeOverlappingReasonStrings,
  dedupeReasonStrings,
  playContradictsReasons,
} from "../strategy/reason-align.mjs";
import { filterReasonsForUser } from "../coach/local-qa.mjs";
import {
  assertReasonConsistency,
  filterReasonsForPlay,
  isAntiPassReason,
  isAntiSingleReason,
  reasonContradictsPlay,
} from "../strategy/reason-consistency.mjs";

function cards(specs) {
  return specs.map(([rank, suit = SUITS.spades, deckIndex = 0]) => createCard(rank, suit, deckIndex));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// —— 静态模式 ——
assert(isAntiPassReason("须压对子且只有炸弹能跟，不宜过牌"), "应识别不宜过牌");
assert(!isAntiPassReason("对手普通牌型，手牌仍多不必动炸，过牌等循环"), "保留炸弹过牌不算矛盾");
assert(
  reasonContradictsPlay("已有普通牌能压住，不必动用炸弹", { type: PLAY_TYPES.straightFlush }),
  "同花顺推荐不应保留不必动炸",
);
assert(
  !reasonContradictsPlay("只有炸弹能压，应抢牌权", { type: PLAY_TYPES.straightFlush }),
  "抢权理由与同花顺一致",
);

const alignedPass = filterReasonsForPlay(
  ["须压对子且只有炸弹能跟，不宜过牌", "【P4】对手普通牌型，手牌仍多不必动炸，过牌等循环"],
  { type: PLAY_TYPES.pass },
  { previousPlay: { type: PLAY_TYPES.pair } },
);
assert(!alignedPass.some((r) => /不宜过牌/.test(r)), "过牌应剔除不宜过牌");
assert(alignedPass.length > 0, "过牌过滤后应保留 pro-pass 理由");

// —— 重叠去重：队友占牌让牌（截图反馈） ——
const partnerPassDupes = dedupeReasonStrings([
  "队友占牌，正常让牌",
  "【P10】队友占牌，正常让牌不压队友",
]);
assert(partnerPassDupes.length === 1, `重叠去重应只留一句，实际 ${partnerPassDupes.join("；")}`);
assert(
  partnerPassDupes[0].includes("不压队友"),
  `应保留更完整句，实际 ${partnerPassDupes[0]}`,
);

const partnerPassTranslated = filterReasonsForUser(
  ["队友占牌，正常让牌", "【P10】队友占牌，正常让牌不压队友"],
  "",
  { play: { type: PLAY_TYPES.pass } },
);
assert(
  partnerPassTranslated.length === 1
  && partnerPassTranslated[0] === "队友占牌，正常让牌不压队友",
  `用户向理由应去重，实际 ${partnerPassTranslated.join("；")}`,
);

// —— 截图反馈：压对子 Top1 只留一句策略向理由，隐藏教纲 P2 与泛化句 ——
const screenshotPairReasons = filterReasonsForUser(
  [
    "用最小对子压住对手对子，打断接风",
    "【P2】有整对K够压，不宜拆三张J组对J",
    "用对子跟牌或抢权",
  ],
  "",
  {
    play: { type: PLAY_TYPES.pair, mainRank: "4" },
    previousPlay: { type: PLAY_TYPES.pair, mainRank: "3" },
  },
);
assert(
  screenshotPairReasons.length === 1,
  `截图场景用户向理由应只有 1 句，实际 ${screenshotPairReasons.length}：${screenshotPairReasons.join("；")}`,
);
assert(
  screenshotPairReasons[0] === "用最小对子压住对手对子，打断接风",
  `应保留跟牌策略句，实际 ${screenshotPairReasons[0]}`,
);
assert(
  !screenshotPairReasons.some((r) => /【P\d+】/.test(r)),
  `用户向理由不得含教纲码，实际 ${screenshotPairReasons.join("；")}`,
);

assert(
  dedupeOverlappingReasonStrings(["须压对子", "对手占牌且你有普通压牌"]).length === 2,
  "无重叠的两句应都保留",
);

const alignedBomb = alignReasonsForPlay(
  ["只有炸弹能压，应抢牌权", "同花顺留给关键控权，不压小单/对子"],
  { type: PLAY_TYPES.straightFlush },
  { previousPlay: { type: PLAY_TYPES.pair } },
);
assert(!playContradictsReasons({ type: PLAY_TYPES.straightFlush }, alignedBomb), "炸弹对齐后无矛盾");

// —— 接风单张：不得展示「不宜先打单张」类罚分句 ——
assert(isAntiSingleReason("残局接风有成组牌可减手，不宜先打单张"), "应识别不宜先打单张");
assert(
  reasonContradictsPlay("残局接风有成组牌可减手，不宜先打单张", { type: PLAY_TYPES.single }),
  "单张推荐不应含不宜先打单张",
);
const catchWindHand = cards([
  ["10", SUITS.hearts], ["Q", SUITS.hearts], ["K", SUITS.hearts],
  ["A", SUITS.hearts], ["2", SUITS.hearts],
  ["10", SUITS.spades],
  ["BJ", SUITS.joker, 0], ["BJ", SUITS.joker, 1],
]);
const catchWindBomb = classifyPlay(cards([
  ["5", SUITS.clubs], ["5", SUITS.diamonds], ["5", SUITS.hearts], ["5", SUITS.spades],
]), "2");
const catchWindState = {
  levelRank: "2",
  currentPlayerIndex: 0,
  lastActivePlay: null,
  players: [
    { hand: catchWindHand },
    { hand: [] },
    { hand: [] },
    { hand: [] },
  ],
  playHistory: [
    { playerIndex: 0, play: catchWindBomb },
    { playerIndex: 1, play: classifyPlay([], "2") },
    { playerIndex: 2, play: classifyPlay([], "2") },
    { playerIndex: 3, play: classifyPlay([], "2") },
  ],
};
const catchWindAdvice = getTurnAdvice(catchWindState, 0, { alternatives: 6, mlFusionMode: "off", mlModel: false });
const catchWindAlt2 = catchWindAdvice.alternatives[1];
if (catchWindAlt2?.candidate?.type === PLAY_TYPES.single) {
  const alt2User = filterReasonsForUser(catchWindAlt2.reasons, "", {
    play: catchWindAlt2.candidate,
    levelRank: "2",
    choiceIndex: 1,
  });
  assert(
    !alt2User.some((r) => /不宜先打单张|有成组牌可减手/.test(r)),
    `接风备选单张用户向理由不得矛盾，实际 ${alt2User.join("；")}`,
  );
}
for (const item of [catchWindAdvice.recommendation, ...catchWindAdvice.alternatives.slice(0, 3)]) {
  if (!item?.candidate) continue;
  assertReasonConsistency(item.candidate, item.reasons, item.candidate.label ?? item.candidate.type);
}

// —— 同花顺逢人配：展示牌须为手牌子集 ——
const sfPlay = classifyPlay(cards([
  ["10", SUITS.hearts], ["Q", SUITS.hearts], ["K", SUITS.hearts], ["A", SUITS.hearts], ["2", SUITS.hearts],
]), "2");
assert(sfPlay.type === PLAY_TYPES.straightFlush, "应识别同花顺");
assert(
  (sfPlay.wildcardAssignments ?? []).length > 0,
  "逢人配同花顺应有 wildcardAssignments",
);
assert(
  sfPlay.cards.every((card) => catchWindHand.some((h) => h.rank === card.rank && h.suit === card.suit)),
  "同花顺 play.cards 须为手牌子集",
);

// —— 截图类场景：对手对K，仅同花顺可压，手牌 17 张 → 过牌 Top1 且理由一致 ——
const oppPairK = classifyPlay(cards([
  ["K", SUITS.clubs, 0], ["K", SUITS.diamonds, 0],
]), "7");
const screenshotHand = cards([
  ["7", SUITS.spades], ["8", SUITS.spades], ["9", SUITS.spades], ["10", SUITS.spades], ["J", SUITS.spades],
  ["3", SUITS.clubs], ["4", SUITS.diamonds], ["5", SUITS.hearts], ["6", SUITS.clubs],
  ["3", SUITS.diamonds], ["4", SUITS.hearts], ["5", SUITS.clubs], ["6", SUITS.diamonds],
  ["3", SUITS.hearts], ["4", SUITS.spades], ["5", SUITS.diamonds], ["6", SUITS.hearts],
]);
const screenshotRec = recommendPlay(screenshotHand, "7", oppPairK, {
  mlFusionMode: "off",
  mlModel: false,
});
assert(
  screenshotRec.candidate.type === PLAY_TYPES.pass,
  `手牌多仅炸可压对K应过牌，实际 ${screenshotRec.candidate.label ?? screenshotRec.candidate.type}`,
);
assertReasonConsistency(screenshotRec.candidate, screenshotRec.reasons, "截图场景 Top1");
assert(
  !screenshotRec.reasons.some((r) => /不宜过牌/.test(r)),
  `过牌 Top1 不得含不宜过牌，实际 ${screenshotRec.reasons.join("；")}`,
);

const { top, pool } = computeRecommendations(screenshotHand, "7", oppPairK, {
  mlFusionMode: "off",
  mlModel: false,
});
for (const item of [top, ...pool.slice(0, 5)]) {
  if (!item?.candidate) continue;
  assertReasonConsistency(item.candidate, item.reasons, item.candidate.label ?? item.candidate.type);
}

console.log("reason-consistency-smoke: 全部通过");
