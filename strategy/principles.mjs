/**
 * 掼蛋教练推理原则层（Doctrine 单一真相源）— 举一反三，非逐局 if 补丁。
 * recommend / generate-candidates / robot-player / local-qa 统一引用本模块。
 *
 * North Star 延伸「节奏与对局质量」：P5/P6 接风配合、P10 队友让牌、P12 机器人节制；
 * 对手施压/控场见 P4/P7 与 opponent-pressure；接风节奏见 tempo-lead.mjs。
 */
import { cardId, isJoker, isWildCard } from "../engine/card.mjs";
import { robotMustFollowAdjustment, scoreRobotDoctrine } from "./robot-doctrine.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { canBeat } from "../engine/compare-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { compareRanks, isControlRank, rankPower } from "../engine/rank-order.mjs";
import { analyzeRankAvailability, breaksStrategicStraightFlush, structureAwareBombs } from "./scorers/structure.mjs";
import {
  buildStrategicGroups,
  handHasOverlappingLowStraightChoice,
  isHighLowStraightLabel,
  isWrapStraightLabel,
  STRAIGHT_HIGH_OVER_WRAP_REASON,
} from "./strategic-groups.mjs";
import {
  isTeammate,
  minOpponentHandCount,
  partnerHandCount,
  shouldYieldPassToPartner,
} from "./table-context.mjs";
const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

function cardKeyForPremium(card) {
  return `${card.rank}:${card.suit}:${card.deckIndex}`;
}

/** 出牌是否部分占用同花顺/王炸战略组（未整组打出） */
export function breaksPremiumStraightOrJokerGroup(candidate, preferredGroups, levelRank) {
  if (!candidate || candidate.type === PLAY_TYPES.pass) return false;
  const keys = new Set((candidate.cards ?? []).map(cardKeyForPremium));
  for (const group of preferredGroups ?? []) {
    const cards = group.cards ?? group;
    const play = group.play ?? classifyPlay(cards, levelRank);
    if (![PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb].includes(play.type)) continue;
    const groupKeys = cards.map(cardKeyForPremium);
    const used = groupKeys.filter((key) => keys.has(key)).length;
    if (used > 0 && used < groupKeys.length) return true;
    if (used === groupKeys.length && candidate.cards.length !== groupKeys.length) return true;
  }
  return false;
}
/** 纯炸保留：须压单/对/三带二（不含仅炸可压的顺子等） */
const PURE_BOMB_PASS_ROUTINE_TYPES = new Set([
  PLAY_TYPES.single,
  PLAY_TYPES.pair,
  PLAY_TYPES.triple,
  PLAY_TYPES.tripleWithPair,
]);
/** 对手占牌时的普通牌型（非炸弹），手牌仍多时不宜用炸抢权 */
const ROUTINE_PRESS_TYPES = new Set([
  PLAY_TYPES.pair,
  PLAY_TYPES.triple,
  PLAY_TYPES.tripleWithPair,
  PLAY_TYPES.straight,
  PLAY_TYPES.consecutivePairs,
  PLAY_TYPES.plane,
]);
const TEMPO_LEAD_TYPES = new Set([
  PLAY_TYPES.tripleWithPair,
  PLAY_TYPES.triple,
  PLAY_TYPES.straight,
  PLAY_TYPES.consecutivePairs,
  PLAY_TYPES.plane,
]);

/** 原则定义（代码即规范） */
export const PRINCIPLE_DEFS = {
  P1: {
    code: "P1",
    title: "散单优先",
    summary: "压牌时现成散单够压 → 用最小散单，不拆任何结构",
  },
  P2: {
    code: "P2",
    title: "对子拆单",
    summary: "无散单 → 从对子拆最小够压单",
  },
  P3: {
    code: "P3",
    title: "结构兜底",
    summary: "仍无 → 才考虑动三同张/钢板/炸弹",
  },
  P4: {
    code: "P4",
    title: "小牌不拆结构",
    summary: "小牌面/普通牌型不拆钢板/炸弹压，手牌仍多过牌等循环；须压对时若该对是三带二唯一可配对子则保留；同套可组23456+留A时优于绕级顺A2345",
  },
  P5: {
    code: "P5",
    title: "成组减手",
    summary: "领出/接风有成组减手（钢板、顺子）优先于三带二",
  },
  P6: {
    code: "P6",
    title: "王回收试探",
    summary: "有王可回收 → 小单试探优于无回收的三带二",
  },
  // P7 修订 rationale：夺权/控场优先于单纯最小够压；超过四张需夺权时满张出炸，稳固牌权与后续出牌空间。
  P7: {
    code: "P7",
    title: "最小够压炸",
    summary: "仅四张炸弹时取最小够压；超过四张且需夺权时满张出炸控牌权；纯四炸优先于逢人配凑炸",
  },
  P8: {
    code: "P8",
    title: "逢人配高用途",
    summary: "逢人配优先同花顺/炸弹/杂顺，不宜配三带二、对子、三张",
  },
  P9: {
    code: "P9",
    title: "整炸不拆三带二",
    summary: "有四炸及以上时，应打三带二/普通牌型抢权，不拆整炸凑三带二",
  },
  // P10：队友节奏 — 已控/已压时不抢牌权（North Star「节奏与对局质量」）
  P10: {
    code: "P10",
    title: "队友让牌",
    summary: "队友占牌/本墩已出小牌 → 过牌让权，不压队友、不叠炸；剩1张能走完时例外",
  },
  P11: {
    code: "P11",
    title: "报单封门",
    summary: "对手报单时用级牌/大牌压单，避免最小 beat 被队友送牌放行",
  },
  // P12：机器人节奏 — 避免三家连环炸，维持对局质量可预期
  P12: {
    code: "P12",
    title: "机器人节制炸",
    summary: "机器人：小单不过炸、三带二不五炸、手牌仍多可过牌等循环",
  },
};

/** 教纲全文（用户可读摘要） */
export const DOCTRINE_SUMMARY = Object.values(PRINCIPLE_DEFS).map(
  (def) => `${def.code} ${def.title}：${def.summary}`,
);

function levelRankFrom(tableContext) {
  return tableContext.state?.levelRank ?? tableContext.levelRank ?? "2";
}

function resolveHand(tableContext) {
  if (tableContext.hand?.length) return tableContext.hand;
  const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex;
  return tableContext.state?.players?.[playerIndex]?.hand ?? [];
}

function physicalRankCount(hand, rank) {
  return hand.filter((card) => card.rank === rank && !isJoker(card)).length;
}

function structureRankCounts(hand, levelRank) {
  const counts = new Map();
  for (const card of hand) {
    if (card.rank === "SJ" || card.rank === "BJ") continue;
    if (card.rank === levelRank && card.suit === "H") continue;
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }
  return counts;
}

function rankLabel(rank) {
  return rank === "SJ" ? "小王" : rank === "BJ" ? "大王" : rank;
}

/** 小牌面：≤7（按级牌序） */
export function isSmallFaceRank(rank, levelRank) {
  return compareRanks(rank, "7", levelRank) <= 0;
}

/** 对手普通非炸弹牌型占牌（三带二、对子、顺子等） */
export function isPressingRoutineNonBomb(previousPlay, tableContext) {
  if (!tableContext.opponentActive || !previousPlay) return false;
  if (BOMB_TYPES.has(previousPlay.type)) return false;
  return ROUTINE_PRESS_TYPES.has(previousPlay.type);
}

/** 只有炸弹能压住桌面（无普通牌可跟） */
export function isBombOnlyBeatContext(tableContext) {
  if (!tableContext.opponentActive) return false;
  return tableContext.hasActionableRegularWinner === false;
}

/** 须压王/小王且只有炸弹能跟 */
export function isPressingJokerBombOnly(previousPlay, tableContext) {
  if (!isBombOnlyBeatContext(tableContext) || !previousPlay) return false;
  return previousPlay.type === PLAY_TYPES.single
    && (previousPlay.mainRank === "BJ" || previousPlay.mainRank === "SJ");
}

/**
 * 须压且仅炸弹可跟时，过牌是否应被教纲否决（纯炸保留、队友冲刺等例外见各原则函数）。
 */
/**
 * 须压且仍有普通牌可跟时，过牌不得占 Top1（队友让牌、三带二保留等对子例外见各原则）。
 */
export function shouldVetoPassWithRegularBeater(tableContext, hand, previousPlay, levelRank = null) {
  if (tableContext.isOpening || tableContext.partnerOwnsTrick) return false;
  if (!previousPlay || previousPlay.type === PLAY_TYPES.pass) return false;
  if (!tableContext.hasActionableRegularWinner) return false;
  if (shouldYieldPassToPartner(tableContext) && (tableContext.danger ?? 0) < 2) return false;
  const resolvedLevel = levelRank ?? tableContext.levelRank ?? tableContext.state?.levelRank ?? "2";
  const resolvedHand = hand?.length ? hand : resolveHand(tableContext);
  if (analyzeReservePairForPendingTriple(resolvedHand, resolvedLevel, previousPlay, tableContext).length > 0) {
    return false;
  }
  if (
    shouldReserveStraightFlushForSmallCards(tableContext, hand, previousPlay)
    || shouldReserveStraightFlushForConsecutivePairs(tableContext, hand, previousPlay)
  ) {
    return false;
  }
  return true;
}

/** 仅炸弹可跟、手牌仍多且对手为普通牌型：允许过牌保留炸弹（顺子满张控权等除外） */
function shouldAllowHeavyHandPassDespiteBombOnly(tableContext, hand, previousPlay) {
  if (!isPressingRoutineNonBomb(previousPlay, tableContext)) return false;
  if (!shouldReserveBombForHeavyHand(tableContext, hand.length)) return false;
  if (
    previousPlay.type === PLAY_TYPES.single
    && (previousPlay.mainRank === "BJ" || previousPlay.mainRank === "SJ")
  ) {
    return false;
  }
  if (previousPlay.type === PLAY_TYPES.straight) {
    const ranks = new Set(hand.filter((card) => !isJoker(card)).map((card) => card.rank));
    for (const rank of ranks) {
      if (prefersFullBombForControl(hand, rank, previousPlay, tableContext)) return false;
    }
  }
  // 无更大连对/普通牌可压、仅炸弹能跟时不得因手牌多而过牌
  if (
    isBombOnlyBeatContext(tableContext)
    && !tableContext.hasActionableRegularWinner
    && previousPlay.type === PLAY_TYPES.consecutivePairs
  ) {
    return false;
  }
  return true;
}

export function shouldVetoBombOnlyPass(tableContext, hand, previousPlay) {
  if (tableContext.isOpening || tableContext.partnerOwnsTrick) return false;
  if (!isBombOnlyBeatContext(tableContext) || !tableContext.hasAnyWinner) return false;
  const resolvedHand = hand?.length ? hand : resolveHand(tableContext);
  if (shouldReservePureBombEarly(tableContext, resolvedHand, previousPlay)) return false;
  if (shouldAllowHeavyHandPassDespiteBombOnly(tableContext, resolvedHand, previousPlay)) return false;
  if (shouldBombForPartnerFinish(tableContext, resolvedHand, previousPlay)) return false;
  if (shouldReserveStraightFlushForConsecutivePairs(tableContext, resolvedHand, previousPlay)) return false;
  if (shouldReserveStraightFlushForSmallCards(tableContext, resolvedHand, previousPlay)) return false;
  if (shouldYieldPassAfterPartnerLeadOnOpponentBomb(tableContext, resolvedHand, previousPlay)) return false;
  const candidates = tableContext._candidates ?? [];
  const hasBombBeater = candidates.some(
    (item) => BOMB_TYPES.has(item.type) && canBeat(item, previousPlay),
  );
  if (!hasBombBeater) return false;
  return true;
}

/** 超过四张同点炸弹且需炸弹夺权时，应满张出炸（五炸/六炸等），不宜拆成四炸 */
export function prefersFullBombForControl(hand, rank, previousPlay, tableContext) {
  if (!isBombOnlyBeatContext(tableContext) || !previousPlay) return false;
  if (previousPlay.type === PLAY_TYPES.single
    && (previousPlay.mainRank === "BJ" || previousPlay.mainRank === "SJ")) {
    return false;
  }
  if (BOMB_TYPES.has(previousPlay.type)) return false;
  const held = physicalRankCount(hand, rank);
  return held > 4;
}

/** 手牌仍多且威胁不高时，炸弹战略保留 */
export function shouldReserveBombForHeavyHand(tableContext, handCount) {
  if (tableContext.isFinishingPlay) return false;
  if ((tableContext.danger ?? 0) >= 2) return false;
  return handCount >= 15;
}

/** 对手连对占牌、仅炸弹可压：同花顺战略保留，允许过牌 */
export function shouldReserveStraightFlushForConsecutivePairs(tableContext, hand, previousPlay) {
  if (tableContext.isOpening || tableContext.partnerOwnsTrick) return false;
  if (!isBombOnlyBeatContext(tableContext) || !previousPlay) return false;
  if (previousPlay.type !== PLAY_TYPES.consecutivePairs) return false;
  if ((tableContext.danger ?? 0) >= 3) return false;
  const resolvedHand = hand?.length ? hand : resolveHand(tableContext);
  if (resolvedHand.length <= 8) return false;
  const plainBombBeaters = (tableContext._candidates ?? []).filter(
    (item) => item.type === PLAY_TYPES.bomb && canBeat(item, previousPlay),
  );
  if (plainBombBeaters.length > 0) return false;
  return true;
}

/** 仅同花顺能压对手小单/对子且局面尚早：保留同花顺，允许过牌 */
export function shouldReserveStraightFlushForSmallCards(tableContext, hand, previousPlay) {
  if (tableContext.isOpening || tableContext.partnerOwnsTrick) return false;
  if (!isBombOnlyBeatContext(tableContext) || !previousPlay) return false;
  if (![PLAY_TYPES.single, PLAY_TYPES.pair].includes(previousPlay.type)) return false;
  if ((tableContext.danger ?? 0) >= 3) return false;
  const resolvedHand = hand?.length ? hand : resolveHand(tableContext);
  if (resolvedHand.length <= 8) return false;
  // 中后局手牌不多：须用同花顺抢权，不宜过牌空让
  if (resolvedHand.length <= 14) return false;
  if (maxOpponentHandCount(tableContext) <= 10) return false;

  const candidates = tableContext._candidates ?? [];
  const plainBombs = candidates.filter(
    (item) => item.type === PLAY_TYPES.bomb && canBeat(item, previousPlay),
  );
  if (plainBombs.length > 0) return false;

  return candidates.some(
    (item) => item.type === PLAY_TYPES.straightFlush && canBeat(item, previousPlay),
  );
}

/** P10：队友本墩已出小牌、对手小炸占牌 → 不宜叠更大炸，允许过牌 */
export function shouldYieldPassAfterPartnerLeadOnOpponentBomb(tableContext, hand, previousPlay) {
  if (!tableContext.partnerAttemptedCurrentRound) return false;
  if ((tableContext.danger ?? 0) >= 2) return false;
  if (!previousPlay || !BOMB_TYPES.has(previousPlay.type)) return false;
  if (previousPlay.type === PLAY_TYPES.jokerBomb) return false;
  const levelRank = tableContext.state?.levelRank ?? tableContext.levelRank ?? "2";
  const beaters = (tableContext._candidates ?? []).filter(
    (item) => BOMB_TYPES.has(item.type) && canBeat(item, previousPlay),
  );
  if (beaters.length === 0) return false;
  const oppPower = rankPower(previousPlay.mainRank, levelRank);
  const minBeatPower = Math.min(...beaters.map((item) => rankPower(item.mainRank, levelRank)));
  return minBeatPower - oppPower >= 2;
}

/** 手牌仅为满张同点炸弹（如五炸10），无其他牌型 */
export function isPureFullBombHand(hand, levelRank) {
  if (!hand?.length || hand.length < 4) return false;
  const counts = new Map();
  for (const card of hand) {
    if (card.rank === "SJ" || card.rank === "BJ") return false;
    if (isWildCard(card, levelRank)) return false;
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }
  if (counts.size !== 1) return false;
  const count = [...counts.values()][0];
  return count >= 4 && count === hand.length;
}

/** 尚未出完的对手中最大余牌数 */
export function maxOpponentHandCount(tableContext) {
  const state = tableContext.state;
  if (!state) return 0;
  const selfIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex ?? 0;
  let max = 0;
  for (const player of state.players) {
    if (player.finishedOrder || player.seatIndex === selfIndex) continue;
    if (isTeammate(selfIndex, player.seatIndex)) continue;
    max = Math.max(max, player.hand.length);
  }
  return max;
}

/** 须压单/对/三带二/对手四炸等：纯炸手牌可过牌等关键控权（不含顺子等须满张控权局面） */
export function isPressingPureBombPassRoutine(previousPlay, tableContext) {
  if (!tableContext.opponentActive || !previousPlay) return false;
  if (previousPlay.type === PLAY_TYPES.bomb) {
    const oppSize = previousPlay.bombSize ?? previousPlay.cards?.length ?? 4;
    return oppSize <= 5;
  }
  if (BOMB_TYPES.has(previousPlay.type)) return false;
  return PURE_BOMB_PASS_ROUTINE_TYPES.has(previousPlay.type);
}

/**
 * 队友冲刺：队友余牌≤2、须压对手且只有炸弹能跟时，应炸夺权给队友接风。
 */
export function shouldBombForPartnerFinish(tableContext, hand, previousPlay) {
  if (!tableContext.opponentActive || !previousPlay) return false;
  if (tableContext.partnerOwnsTrick) return false;
  if (partnerHandCount(tableContext) > 2) return false;
  if (!isBombOnlyBeatContext(tableContext)) return false;
  const levelRank = levelRankFrom(tableContext);
  const resolvedHand = hand?.length ? hand : resolveHand(tableContext);
  const beaters = (tableContext._candidates ?? []).filter(
    (item) => BOMB_TYPES.has(item.type) && canBeat(item, previousPlay),
  );
  if (beaters.length === 0) return false;
  return isPureFullBombHand(resolvedHand, levelRank) || partnerHandCount(tableContext) <= 1;
}

/** 对手冲刺占牌：对手余牌≤6且成组牌占权，有炸应夺权防其快速走完 */
export function shouldBombForOpponentSprint(tableContext, previousPlay) {
  if (!tableContext.opponentActive || !previousPlay) return false;
  if (tableContext.partnerOwnsTrick) return false;
  if (minOpponentHandCount(tableContext) > 6) return false;
  return [
    PLAY_TYPES.tripleWithPair,
    PLAY_TYPES.consecutivePairs,
    PLAY_TYPES.plane,
    PLAY_TYPES.straight,
    PLAY_TYPES.triple,
  ].includes(previousPlay.type);
}

/**
 * 纯炸保留：仅剩满张炸弹、对手/队友余牌尚多、非冲刺时不宜过早亮炸。
 * 与 isFinishingPlay「能走完先走完」、shouldBombForPartnerFinish 互斥。
 */
export function shouldReservePureBombEarly(tableContext, hand, previousPlay) {
  const levelRank = levelRankFrom(tableContext);
  const resolvedHand = hand?.length ? hand : resolveHand(tableContext);
  if (!isPureFullBombHand(resolvedHand, levelRank)) return false;
  // 仅对手报单/双张冲刺时不保留；有一方余牌≤6 尚早
  if ((tableContext.danger ?? 0) >= 3) return false;
  if (minOpponentHandCount(tableContext) <= 2) return false;
  if (shouldBombForPartnerFinish(tableContext, resolvedHand, previousPlay)) return false;
  if (tableContext.partnerOwnsTrick) return false;
  if (maxOpponentHandCount(tableContext) <= 6) return false;
  return isPressingPureBombPassRoutine(previousPlay, tableContext);
}

/** 跟牌压小单（≤6） */
export function isPressingSmallSingle(previousPlay, levelRank, tableContext) {
  if (!tableContext.opponentActive || !tableContext.hasRegularWinner) return false;
  if (previousPlay?.type !== PLAY_TYPES.single) return false;
  return isSmallFaceRank(previousPlay.mainRank, levelRank)
    && compareRanks(previousPlay.mainRank, "6", levelRank) <= 0;
}

/** 跟牌压对手单张（P1/P2/P3 适用，不限于 ≤6） */
export function isFollowingOpponentSingle(previousPlay, levelRank, tableContext) {
  if (!tableContext.opponentActive || !tableContext.hasRegularWinner) return false;
  return previousPlay?.type === PLAY_TYPES.single;
}

/** 跟牌压对手对子/连对（P2 延伸：整对优先于拆三同张组对） */
export function isFollowingOpponentPair(previousPlay, levelRank, tableContext) {
  if (!tableContext.opponentActive || !tableContext.hasRegularWinner) return false;
  return previousPlay?.type === PLAY_TYPES.pair
    || previousPlay?.type === PLAY_TYPES.consecutivePairs;
}

/** 压对子/连对类局面（QA 与原则作答共用） */
export function isBeatPairLikeMustBeat(mustBeat) {
  return mustBeat?.type === PLAY_TYPES.pair
    || mustBeat?.type === PLAY_TYPES.consecutivePairs;
}

/** 推荐对子是否会拆掉理牌后的三同张/钢板（buildStrategicGroups） */
export function resolveTripleBreakForPair(rank, hand, levelRank) {
  if (!rank || !hand?.length) {
    return { splitsTriple: false, tripleLabel: null, plateLabel: null };
  }
  const held = physicalRankCount(hand, rank);
  if (held < 3) {
    return { splitsTriple: false, tripleLabel: null, plateLabel: null };
  }
  const groups = buildStrategicGroups(hand, levelRank);
  const tripleGroup = groups.find(
    (group) => (group.play?.type === PLAY_TYPES.triple || group.label?.startsWith("三张"))
      && group.play?.mainRank === rank,
  );
  const plateGroup = groups.find(
    (group) => (group.play?.type === PLAY_TYPES.plane || group.label?.startsWith("钢板"))
      && (group.cards ?? []).some((card) => card.rank === rank),
  );
  return {
    splitsTriple: true,
    tripleLabel: tripleGroup?.label ?? `三张${rankLabel(rank)}`,
    plateLabel: plateGroup?.label ?? null,
  };
}

function isWrapStraightPlay(candidate) {
  if (candidate?.type !== PLAY_TYPES.straight) return false;
  if (isWrapStraightLabel(candidate.label)) return true;
  const ranks = new Set((candidate.cards ?? []).map((card) => card.rank));
  return ranks.has("A") && ranks.has("2") && ranks.has("5") && !ranks.has("6");
}

function isHighLowStraightPlay(candidate) {
  if (candidate?.type !== PLAY_TYPES.straight) return false;
  if (isHighLowStraightLabel(candidate.label)) return true;
  const ranks = new Set((candidate.cards ?? []).map((card) => card.rank));
  return ranks.has("6") && ranks.has("2") && ranks.has("5") && !ranks.has("A");
}

/** 领出/接风：同套可组23456+留A时不宜走绕级顺A2345 */
export function diagnoseInferiorWrapStraightViolation(candidate, hand, levelRank, tableContext) {
  const isLeadTurn = tableContext.isOpening
    && tableContext.leadMode !== "must-beat"
    && !tableContext.opponentActive;
  if (!isLeadTurn || !candidate || candidate.type !== PLAY_TYPES.straight) return null;
  if (!handHasOverlappingLowStraightChoice(hand, levelRank) || !isWrapStraightPlay(candidate)) {
    return null;
  }

  const candidates = tableContext._candidates ?? [];
  const highLowAlt = candidates.find(
    (item) => item.type === PLAY_TYPES.straight && isHighLowStraightPlay(item),
  );

  return {
    violated: "P4",
    summary: `同套可组23456+留A，不宜走绕级顺A2345（${STRAIGHT_HIGH_OVER_WRAP_REASON}）`,
    gentlerLabel: highLowAlt?.label ?? "顺子 2-3-4-5-6",
    blockTop3: true,
  };
}

/** 连对/钢板是否会拆三同张（三张8拆成对8+单8） */
export function resolveTripleBreakForConsecutivePairs(candidate, hand, levelRank) {
  if (candidate?.type !== PLAY_TYPES.consecutivePairs || !hand?.length) {
    return { splitsTriple: false, tripleRank: null, tripleLabel: null, usedCount: 0 };
  }
  const usedCounts = new Map();
  for (const card of candidate.cards ?? []) {
    if (card.rank === "SJ" || card.rank === "BJ") continue;
    usedCounts.set(card.rank, (usedCounts.get(card.rank) ?? 0) + 1);
  }
  const groups = buildStrategicGroups(hand, levelRank);
  for (const [rank, usedCount] of usedCounts.entries()) {
    if (physicalRankCount(hand, rank) < 3 || usedCount !== 2) continue;
    const bombInfo = analyzeRankAvailability(hand, rank, levelRank);
    if (bombInfo.effectiveBombCount >= 4) continue;
    const tripleGroup = groups.find(
      (group) => (group.play?.type === PLAY_TYPES.triple || group.label?.startsWith("三张"))
        && (group.cards ?? []).some((card) => card.rank === rank),
    );
    if (!tripleGroup && physicalRankCount(hand, rank) < 3) continue;
    return {
      splitsTriple: true,
      tripleRank: rank,
      tripleLabel: tripleGroup?.label ?? `三张${rankLabel(rank)}`,
      usedCount,
    };
  }
  return { splitsTriple: false, tripleRank: null, tripleLabel: null, usedCount: 0 };
}

/** 领出/接风：三同张可组三带二时，不宜拆三张凑连对/钢板 */
export function analyzeReserveTripleForTripleWithPair(hand, levelRank, tableContext) {
  const isLeadTurn = tableContext.isOpening
    && tableContext.leadMode !== "must-beat"
    && !tableContext.opponentActive;
  if (!isLeadTurn || !hand?.length) return [];

  const candidates = tableContext._candidates ?? [];
  const reserves = [];
  const groups = buildStrategicGroups(hand, levelRank);
  const tripleRanks = groups
    .filter((group) => group.play?.type === PLAY_TYPES.triple)
    .map((group) => group.play.mainRank)
    .filter((rank) => physicalRankCount(hand, rank) >= 3);

  for (const tripleRank of tripleRanks) {
    const bombInfo = analyzeRankAvailability(hand, tripleRank, levelRank);
    const physicalHeld = physicalRankCount(hand, tripleRank);
    if (bombInfo.effectiveBombCount >= 4 || physicalHeld >= 4) continue;
    const hasTripleWithPair = candidates.some(
      (item) => item.type === PLAY_TYPES.tripleWithPair
        && item.mainRank === tripleRank
        && (item.cards ?? []).filter((card) => card.rank === tripleRank).length >= 3,
    );
    if (!hasTripleWithPair) continue;
    reserves.push({
      tripleRank,
      reason: `三个${rankLabel(tripleRank)}可组三带二减手，不宜拆成对凑连对`,
    });
  }
  return reserves;
}

/** 领出/接风：连对拆三同张且有三带二/其它连对替代 */
export function diagnoseLeadConsecutivePairsTripleViolation(candidate, hand, levelRank, tableContext) {
  const isLeadTurn = tableContext.isOpening
    && tableContext.leadMode !== "must-beat"
    && !tableContext.opponentActive;
  if (!isLeadTurn || !candidate || candidate.type !== PLAY_TYPES.consecutivePairs) return null;

  const tripleBreak = resolveTripleBreakForConsecutivePairs(candidate, hand, levelRank);
  if (!tripleBreak.splitsTriple) return null;

  const candidates = tableContext._candidates ?? [];
  const reserves = analyzeReserveTripleForTripleWithPair(hand, levelRank, tableContext);
  const reserve = reserves.find((entry) => entry.tripleRank === tripleBreak.tripleRank);

  const altConsecutivePairs = candidates.some(
    (item) => item.type === PLAY_TYPES.consecutivePairs
      && item.length >= 6
      && !resolveTripleBreakForConsecutivePairs(item, hand, levelRank).splitsTriple,
  );
  const altTripleWithPair = candidates.some(
    (item) => item.type === PLAY_TYPES.tripleWithPair
      && item.mainRank === tripleBreak.tripleRank
      && (item.cards ?? []).filter((card) => card.rank === tripleBreak.tripleRank).length >= 3,
  );
  const allCpBreakTriple = candidates
    .filter((item) => item.type === PLAY_TYPES.consecutivePairs && item.length >= 6)
    .every((item) => resolveTripleBreakForConsecutivePairs(item, hand, levelRank).splitsTriple);

  // 无其它连对且手牌不多：拆三同张可能是组成连对的唯一手段（如 7778899 小牌局）
  if (!altConsecutivePairs && hand.length < 15) return null;
  // 所有连对都要拆三同张，且三同张可三带二：优先三带二
  if (!altConsecutivePairs && allCpBreakTriple && !altTripleWithPair && !reserve) return null;
  if (!altConsecutivePairs && !reserve && !altTripleWithPair) return null;

  const tripleLabel = tripleBreak.tripleLabel ?? `三张${rankLabel(tripleBreak.tripleRank)}`;
  return {
    violated: "P5",
    summary: reserve?.reason ?? `接风/领出不宜拆${tripleLabel}凑连对，应留三带二或其它连对`,
    gentlerLabel: altTripleWithPair
      ? `三带二 ${tripleLabel}`
      : altConsecutivePairs
        ? "其它连对"
        : null,
    blockTop1: true,
    blockTop3: true,
  };
}

/** 顺子出牌是否会动用三同张（接风选顺时对照 23456 vs A2345） */
export function resolveTripleBreakForStraight(candidate, hand, levelRank) {
  if (candidate?.type !== PLAY_TYPES.straight || !hand?.length) {
    return { splitsTriple: false, tripleRank: null, tripleLabel: null, usedCount: 0 };
  }
  const usedCounts = new Map();
  for (const card of candidate.cards ?? []) {
    if (card.rank === "SJ" || card.rank === "BJ") continue;
    usedCounts.set(card.rank, (usedCounts.get(card.rank) ?? 0) + 1);
  }
  const groups = buildStrategicGroups(hand, levelRank);
  for (const [rank, usedCount] of usedCounts.entries()) {
    if (physicalRankCount(hand, rank) < 3 || usedCount <= 0) continue;
    const tripleGroup = groups.find(
      (group) => (group.play?.type === PLAY_TYPES.triple || group.label?.startsWith("三张"))
        && (group.cards ?? []).some((card) => card.rank === rank),
    );
    if (!tripleGroup) continue;
    return {
      splitsTriple: true,
      tripleRank: rank,
      tripleLabel: tripleGroup.label ?? `三张${rankLabel(rank)}`,
      usedCount,
    };
  }
  return { splitsTriple: false, tripleRank: null, tripleLabel: null, usedCount: 0 };
}

/** 领出/接风：三带二拆已成顺子 */
export function diagnoseLeadTripleBreaksStraightViolation(candidate, hand, levelRank, tableContext) {
  const isLeadTurn = tableContext.isOpening
    && tableContext.leadMode !== "must-beat"
    && !tableContext.opponentActive;
  if (!isLeadTurn || !candidate) return null;
  const breaksStraightTypes = new Set([PLAY_TYPES.tripleWithPair, PLAY_TYPES.triple]);
  if (!breaksStraightTypes.has(candidate.type)) return null;

  const groups = buildStrategicGroups(hand, levelRank);
  const straightGroup = groups.find((group) => group.play?.type === PLAY_TYPES.straight);
  if (!straightGroup) return null;

  const straightBreak = resolveStraightBreakForTripleWithPair(candidate, hand, levelRank);
  if (!straightBreak.breaksStraight) return null;

  const candidates = tableContext._candidates ?? [];
  const gentlerStraights = candidates.filter((item) => {
    if (item.type !== PLAY_TYPES.straight) return false;
    return !resolveTripleBreakForStraight(item, hand, levelRank).splitsTriple;
  });

  return {
    violated: straightBreak.breaksStraight ? "P4" : "P5",
    summary: tableContext.leadMode === "catch-wind"
      ? "接风有顺子，不宜三带二拆顺子"
      : "领出/接风有顺子，不宜三带二拆顺子",
    gentlerLabel: gentlerStraights[0]?.label ?? straightGroup.label ?? null,
    straightLabel: straightBreak.straightLabel ?? straightGroup.label ?? null,
    blockTop3: true,
  };
}

/** 接风顺子：有不动三同张的顺子路线时，不宜拆三张组顺或三带二 */
export function diagnoseCatchWindStraightTripleViolation(candidate, hand, levelRank, tableContext) {
  const leadStraightBreak = diagnoseLeadTripleBreaksStraightViolation(candidate, hand, levelRank, tableContext);
  if (leadStraightBreak) return leadStraightBreak;

  const isCatchWind = tableContext.leadMode === "catch-wind" && !tableContext.opponentActive;
  if (!isCatchWind || !candidate || candidate.type === PLAY_TYPES.pass) return null;

  const candidates = tableContext._candidates ?? [];
  const gentlerStraights = candidates.filter((item) => {
    if (item.type !== PLAY_TYPES.straight) return false;
    return !resolveTripleBreakForStraight(item, hand, levelRank).splitsTriple;
  });
  if (gentlerStraights.length === 0) return null;

  if (candidate.type === PLAY_TYPES.tripleWithPair) {
    const rank = candidate.mainRank;
    if (physicalRankCount(hand, rank) >= 3) {
      const solePair = solePairForTripleRank(hand, levelRank, rank);
      const pairUsed = (candidate.cards ?? []).find((card) => card.rank !== rank)?.rank ?? null;
      if (solePair && pairUsed === solePair) {
        return null;
      }
      return {
        violated: "P5",
        summary: "接风有不拆三同张的顺子，不宜三带二拆三张",
        gentlerLabel: gentlerStraights[0]?.label ?? null,
      };
    }
  }

  if (candidate.type === PLAY_TYPES.straight) {
    const overlapChoice = handHasOverlappingLowStraightChoice(hand, levelRank);
    if (overlapChoice && isWrapStraightPlay(candidate)) {
      const highLowAlt = gentlerStraights.find((item) => isHighLowStraightPlay(item))
        ?? candidates.find((item) => item.type === PLAY_TYPES.straight && isHighLowStraightPlay(item));
      if (highLowAlt) {
        return {
          violated: "P4",
          summary: `同套可组23456+留A，不宜走绕级顺A2345（${STRAIGHT_HIGH_OVER_WRAP_REASON}）`,
          gentlerLabel: highLowAlt.label ?? null,
          blockTop3: true,
        };
      }
    }

    const tripleBreak = resolveTripleBreakForStraight(candidate, hand, levelRank);
    if (tripleBreak.splitsTriple && !(overlapChoice && isHighLowStraightPlay(candidate))) {
      return {
        violated: "P5",
        summary: "接风有不拆三同张的顺子路线，不宜拆三张组顺",
        gentlerLabel: gentlerStraights[0]?.label ?? null,
        tripleLabel: tripleBreak.tripleLabel,
      };
    }
  }

  return null;
}

/** 三带二/三张是否会拆掉理牌后的顺子（如 666+33 拆 23456；222 拆 23456） */
export function resolveStraightBreakForTripleWithPair(candidate, hand, levelRank) {
  if (!hand?.length) {
    return { breaksStraight: false, straightLabel: null };
  }
  const breaksStraightTypes = new Set([PLAY_TYPES.tripleWithPair, PLAY_TYPES.triple]);
  if (!breaksStraightTypes.has(candidate?.type)) {
    return { breaksStraight: false, straightLabel: null };
  }
  const groups = buildStrategicGroups(hand, levelRank);
  const straightGroup = groups.find((group) => group.play?.type === PLAY_TYPES.straight);
  if (!straightGroup) {
    return { breaksStraight: false, straightLabel: null };
  }
  const tripleRank = candidate.mainRank;
  const inStraight = (straightGroup.cards ?? []).some((card) => card.rank === tripleRank);
  if (!inStraight || physicalRankCount(hand, tripleRank) < 3) {
    return { breaksStraight: false, straightLabel: null };
  }
  const straights = groups.filter((group) => group.play?.type === PLAY_TYPES.straight);
  const protectedStraights = straights.filter(
    (group) => (group.cards ?? []).some((card) => card.rank === tripleRank),
  );
  const hasDisjointAltStraight = straights.some(
    (group) => !protectedStraights.includes(group)
      && !(group.cards ?? []).some((card) => card.rank === tripleRank),
  );
  const protectedIsWrapStraight = protectedStraights.some(
    (group) => isWrapStraightLabel(group.label ?? "")
      || isWrapStraightPlay(group.play ?? { type: PLAY_TYPES.straight, cards: group.cards ?? [] }),
  );
  if (hasDisjointAltStraight && protectedIsWrapStraight) {
    return { breaksStraight: false, straightLabel: null };
  }
  return { breaksStraight: true, straightLabel: straightGroup.label ?? null };
}

/** 推荐单张是否会拆掉理牌后的顺子（buildStrategicGroups） */
export function resolveStraightBreakForSingle(rank, hand, levelRank) {
  if (!rank || !hand?.length) {
    return { breaksStraight: false, straightLabel: null };
  }
  const groups = buildStrategicGroups(hand, levelRank);
  const straightGroup = groups.find(
    (group) => (group.play?.type === PLAY_TYPES.straight
        || group.play?.type === PLAY_TYPES.straightFlush)
      && (group.cards ?? []).some((card) => card.rank === rank),
  );
  return {
    breaksStraight: Boolean(straightGroup),
    straightLabel: straightGroup?.label ?? null,
  };
}

/**
 * 残局：手牌仅王(小/大) + 同花顺（或另含整炸），无其他成组结构。
 * @returns {null | { sfGroup, sfCardIds, jokers, preferredJoker, bombGroup }}
 */
export function analyzeJokerStraightFlushFinishHand(hand, levelRank) {
  if (!hand?.length || hand.length > 12) return null;
  const jokers = hand.filter((card) => isJoker(card));
  if (jokers.length === 0) return null;

  const groups = buildStrategicGroups(hand, levelRank);
  const sfGroups = groups.filter((group) => group.play?.type === PLAY_TYPES.straightFlush);
  if (sfGroups.length !== 1) return null;

  const accounted = new Set();
  for (const card of sfGroups[0].cards ?? []) accounted.add(cardId(card));
  for (const card of jokers) accounted.add(cardId(card));

  let bombGroup = null;
  for (const group of groups) {
    if (group.play?.type !== PLAY_TYPES.bomb) continue;
    if (bombGroup) return null;
    bombGroup = group;
    for (const card of group.cards ?? []) accounted.add(cardId(card));
  }

  if (!hand.every((card) => accounted.has(cardId(card)))) return null;

  const preferredJoker = jokers.find((card) => card.rank === "SJ") ?? jokers[0];
  return {
    sfGroup: sfGroups[0],
    sfCardIds: new Set((sfGroups[0].cards ?? []).map(cardId)),
    jokers,
    preferredJoker,
    bombGroup,
  };
}

/** P7 延伸：须压时先王夺权留同花顺一手走完；接风后同花顺出完 */
export function scorePreferJokerBeforeStraightFlushFinish(
  candidate,
  hand,
  levelRank,
  tableContext,
  pattern,
  previousPlay,
) {
  if (!pattern || !candidate) return null;

  const reasons = [];
  const principles = [];
  let score = 0;
  let hasStrongConflict = false;
  const jokerReason = reasonFromPrinciple("P7", { jokerBeforeStraightFlushFinish: true });
  const { sfCardIds, preferredJoker } = pattern;
  const jokerRank = preferredJoker.rank;
  const catchWind = tableContext.isOpening && tableContext.leadMode === "catch-wind";
  const mustBeat = !tableContext.isOpening && tableContext.opponentActive && previousPlay;

  if (catchWind) {
    if (candidate.type === PLAY_TYPES.straightFlush && candidate.cards?.length === hand.length) {
      score -= 6800;
      reasons.push("接风占权后同花顺一手走完");
      principles.push("P7");
    } else if (
      candidate.type === PLAY_TYPES.single
      && (candidate.mainRank === "SJ" || candidate.mainRank === "BJ")
    ) {
      score += 9800;
      reasons.push(jokerReason);
      principles.push("P7");
      hasStrongConflict = true;
    }
    return { score, reasons, principles, hasStrongConflict, handledP1Single: false };
  }

  if (!mustBeat) return null;

  if (candidate.type === PLAY_TYPES.single && candidate.mainRank === jokerRank) {
    score -= 14_800;
    reasons.push(jokerReason);
    principles.push("P7");
    return { score, reasons, principles, hasStrongConflict, handledP1Single: true };
  }

  if (candidate.type === PLAY_TYPES.straightFlush) {
    score += 18_800;
    reasons.push(jokerReason);
    principles.push("P7");
    hasStrongConflict = true;
    return { score, reasons, principles, hasStrongConflict, handledP1Single: false };
  }

  if (
    candidate.type === PLAY_TYPES.single
    && candidate.cards?.some((card) => sfCardIds.has(cardId(card)))
  ) {
    score += 16_800;
    reasons.push(jokerReason);
    principles.push("P7");
    hasStrongConflict = true;
    return { score, reasons, principles, hasStrongConflict, handledP1Single: true };
  }

  if (candidate.type === PLAY_TYPES.pass) {
    score += 14_800;
    reasons.push(jokerReason);
    principles.push("P7");
    hasStrongConflict = true;
  }

  return { score, reasons, principles, hasStrongConflict, handledP1Single: false };
}

/** 某 rank 在压牌结构层级：散单 < 对子 < 三张 < 钢板 < 炸弹 */
export function getRankStructureTier(hand, rank, levelRank) {
  const held = physicalRankCount(hand, rank);
  if (held <= 0) return "none";
  if (held === 1) return "loose";
  const bombInfo = analyzeRankAvailability(hand, rank, levelRank);
  const lockedInPlate = (bombInfo.lockedEntries ?? []).some((entry) => entry.structure === "钢板");
  if (lockedInPlate) return "plate";
  if (bombInfo.effectiveBombCount >= 4) return "bomb";
  if (held === 2) return "pair";
  if (held >= 3) return "triple";
  return "loose";
}

/** 压单张局面：可压候选的结构分析 */
export function analyzeMustBeatSingleContext(hand, levelRank, previousPlay, tableContext) {
  const candidates = tableContext._candidates ?? [];
  const beaters = candidates.filter(
    (item) => item.type === PLAY_TYPES.single && canBeat(item, previousPlay),
  );
  const sfFinish = analyzeJokerStraightFlushFinishHand(hand, levelRank);
  let looseBeaters = beaters.filter(
    (item) => item.mainRank !== "SJ"
      && item.mainRank !== "BJ"
      && physicalRankCount(hand, item.mainRank) === 1,
  );
  const preferredGroups = tableContext.preferredGroups ?? [];
  const playableLooseBeaters = looseBeaters.filter(
    (item) => !breaksPremiumStraightOrJokerGroup(item, preferredGroups, levelRank),
  );
  if (sfFinish) {
    looseBeaters = looseBeaters.filter((item) => {
      const card = hand.find((c) => c.rank === item.mainRank);
      return !card || !sfFinish.sfCardIds.has(cardId(card));
    });
  }
  const playableAfterSf = playableLooseBeaters.filter((item) => {
    if (!sfFinish) return true;
    const card = hand.find((c) => c.rank === item.mainRank);
    return !card || !sfFinish.sfCardIds.has(cardId(card));
  });
  const pairBeaters = beaters.filter(
    (item) => physicalRankCount(hand, item.mainRank) === 2,
  );
  const naturalLooseBeaters = looseBeaters.filter(
    (item) => !(item.cards ?? []).some((card) => isWildCard(card, levelRank)),
  );
  const hasLooseBeater = looseBeaters.length > 0;
  const hasNaturalLooseBeater = naturalLooseBeaters.length > 0;
  const minLoosePower = hasLooseBeater
    ? Math.min(...looseBeaters.map((item) => item.power))
    : null;
  const minLooseRank = hasLooseBeater
    ? looseBeaters.find((item) => item.power === minLoosePower)?.mainRank ?? null
    : null;
  const minPairPower = pairBeaters.length > 0
    ? Math.min(...pairBeaters.map((item) => item.power))
    : null;
  const minPairRank = pairBeaters.length > 0
    ? pairBeaters.find((item) => item.power === minPairPower)?.mainRank ?? null
    : null;
  const safeLooseBeaters = looseBeaters.filter(
    (item) => !resolveStraightBreakForSingle(item.mainRank, hand, levelRank).breaksStraight,
  );
  const hasSafeLooseBeater = safeLooseBeaters.length > 0;
  const minSafeLoosePower = hasSafeLooseBeater
    ? Math.min(...safeLooseBeaters.map((item) => item.power))
    : null;
  const minSafeLooseRank = hasSafeLooseBeater
    ? safeLooseBeaters.find((item) => item.power === minSafeLoosePower)?.mainRank ?? null
    : null;

  /** 须压单张时：唯一散单在同花顺组内，允许拆组用最小散单抢权 */
  const mustBeatPremiumLooseSingle = (candidate) => {
    if (!previousPlay || previousPlay.type !== PLAY_TYPES.single) return false;
    if (pairBeaters.length > 0 || hasNaturalLooseBeater || playableAfterSf.length > 0) return false;
    if (candidate?.type !== PLAY_TYPES.single || !canBeat(candidate, previousPlay)) return false;
    if (!looseBeaters.some((item) => item.mainRank === candidate.mainRank)) return false;
    if (playableAfterSf.some((item) => item.mainRank === candidate.mainRank)) return false;
    if (!breaksPremiumStraightOrJokerGroup(candidate, preferredGroups, levelRank)) return false;
    return candidate.mainRank === minLooseRank;
  };

  return {
    beaters,
    looseBeaters,
    playableLooseBeaters: playableAfterSf,
    mustBeatPremiumLooseSingle,
    safeLooseBeaters,
    pairBeaters,
    hasLooseBeater,
    hasNaturalLooseBeater,
    hasPlayableLooseBeater: playableAfterSf.length > 0,
    hasSafeLooseBeater,
    minLooseRank,
    minLoosePower,
    minSafeLooseRank,
    minSafeLoosePower,
    minPairPower,
    minPairRank,
    beatLabel: previousPlay?.label ?? `单${rankLabel(previousPlay?.mainRank)}`,
  };
}

/** 从手牌枚举可压对子的整对（候选表被 lite/trim 裁掉时 P4 仍可用） */
function pairBeatersFromHand(hand, levelRank, previousPlay) {
  if (!hand?.length || !previousPlay) return [];
  const results = [];
  const seen = new Set();
  for (const card of hand) {
    if (isJoker(card) || seen.has(card.rank)) continue;
    if (physicalRankCount(hand, card.rank) < 2) continue;
    seen.add(card.rank);
    const cards = hand.filter((c) => c.rank === card.rank).slice(0, 2);
    const play = classifyPlay(cards, levelRank);
    if (play.type === PLAY_TYPES.pair && canBeat(play, previousPlay)) {
      results.push(play);
    }
  }
  return results;
}

/** 压对子局面：整对 vs 拆三同张组对 */
export function analyzeMustBeatPairContext(hand, levelRank, previousPlay, tableContext) {
  const candidates = tableContext._candidates ?? [];
  let beaters = candidates.filter(
    (item) => item.type === PLAY_TYPES.pair && canBeat(item, previousPlay),
  );
  if (previousPlay && hand?.length) {
    const fromHand = pairBeatersFromHand(hand, levelRank, previousPlay);
    const knownRanks = new Set(beaters.map((item) => item.mainRank));
    for (const play of fromHand) {
      if (!knownRanks.has(play.mainRank)) beaters.push(play);
    }
  }
  const wholePairBeaters = beaters.filter(
    (item) => physicalRankCount(hand, item.mainRank) === 2,
  );
  const tripleSplitBeaters = beaters.filter(
    (item) => physicalRankCount(hand, item.mainRank) >= 3,
  );
  const hasWholePairBeater = wholePairBeaters.length > 0;
  const minWholePairPower = hasWholePairBeater
    ? Math.min(...wholePairBeaters.map((item) => item.power))
    : null;
  const minWholePairRank = hasWholePairBeater
    ? wholePairBeaters.find((item) => item.power === minWholePairPower)?.mainRank ?? null
    : null;

  return {
    beaters,
    wholePairBeaters,
    tripleSplitBeaters,
    hasWholePairBeater,
    minWholePairRank,
    minWholePairPower,
    beatLabel: previousPlay?.label ?? `对${rankLabel(previousPlay?.mainRank)}`,
  };
}

/**
 * 某对子是否为「待组三带二」的保留对：存在三同张 T 且 T+该对可组三带二，
 * 且该对是当前最小整对够压（用掉即断三带二路线）。
 */
export function analyzeReservePairForPendingTriple(hand, levelRank, previousPlay, tableContext) {
  if (!isFollowingOpponentPair(previousPlay, levelRank, tableContext)) return [];
  const ctx = analyzeMustBeatPairContext(hand, levelRank, previousPlay, tableContext);
  if (!ctx.hasWholePairBeater || ctx.minWholePairRank == null) return [];

  const reserves = [];
  const groups = buildStrategicGroups(hand, levelRank);
  const tripleRanks = groups
    .filter((group) => group.play?.type === PLAY_TYPES.triple)
    .map((group) => group.play.mainRank)
    .filter((rank) => physicalRankCount(hand, rank) >= 3)
    .sort((left, right) => {
      if (left === levelRank) return -1;
      if (right === levelRank) return 1;
      return rankPower(left, levelRank) - rankPower(right, levelRank);
    });

  for (const tripleRank of tripleRanks) {
    if (tripleRank === ctx.minWholePairRank) continue;
    if (tripleRank !== levelRank) continue;
    const canFormTwp = physicalRankCount(hand, tripleRank) >= 3
      && physicalRankCount(hand, ctx.minWholePairRank) >= 2;
    if (!canFormTwp) continue;
    reserves.push({
      tripleRank,
      pairRank: ctx.minWholePairRank,
      reason: `三个${rankLabel(tripleRank)}待组三带二，须保留对${rankLabel(ctx.minWholePairRank)}`,
    });
  }
  return reserves;
}

/** 接风：三同张有唯一对子可配时，三带二优于裸三张 */
export function solePairForTripleRank(hand, levelRank, tripleRank) {
  const groups = buildStrategicGroups(hand, levelRank);
  const pairGroups = groups.filter((group) => group.play?.type === PLAY_TYPES.pair);
  const viable = pairGroups.filter((group) => group.play.mainRank !== tripleRank);
  if (viable.length !== 1) return null;
  return viable[0].play.mainRank;
}

/** 手中三同张各自的最小可配对对子（留给三带二） */
export function findTripleCompanionPairReserves(hand, levelRank) {
  const rankCounts = new Map();
  for (const card of hand) {
    if (isJoker(card)) continue;
    rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
  }
  const pairRanks = [...rankCounts.entries()]
    .filter(([, count]) => count === 2)
    .map(([rank]) => rank)
    .sort((left, right) => rankPower(left, levelRank) - rankPower(right, levelRank));
  const reserves = [];
  for (const [tripleRank, count] of rankCounts) {
    if (count < 3) continue;
    const bombInfo = analyzeRankAvailability(hand, tripleRank, levelRank);
    if (bombInfo.effectiveBombCount >= 4 || count >= 4) continue;
    const companions = pairRanks.filter((rank) => rank !== tripleRank);
    if (companions.length > 0) {
      reserves.push({ tripleRank, companionPairRank: companions[0] });
    }
  }
  return reserves;
}

function shouldPreferJokerOverReservedPairBreak(ctx, tripleReserves) {
  if (!ctx?.pairBeaters?.length || tripleReserves.length === 0) return null;
  return tripleReserves.find((reserve) =>
    ctx.pairBeaters.some(
      (item) => item.mainRank === reserve.companionPairRank && item.power === ctx.minPairPower,
    ),
  ) ?? null;
}

function hasBigJokerRecovery(hand) {
  return hand.some((card) => card.rank === "BJ");
}

function hasSteelPlate(hand, levelRank) {
  return buildStrategicGroups(hand, levelRank).some(
    (group) => group.play?.type === PLAY_TYPES.plane || group.label?.startsWith("钢板"),
  );
}

function isProbeSingleRank(rank, levelRank) {
  if (rank === levelRank || isControlRank(rank, levelRank)) return false;
  return compareRanks(rank, "9", levelRank) <= 0;
}

/** 真开局可领出的散单点数（不含级牌与王） */
function looseLeadSingleRanks(hand, levelRank) {
  const rankCounts = new Map();
  for (const card of hand) {
    if (isJoker(card)) continue;
    rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
  }
  return [...rankCounts.entries()]
    .filter(([rank, count]) => count === 1
      && rank !== levelRank
      && !isControlRank(rank, levelRank))
    .map(([rank]) => rank)
    .sort((left, right) => rankPower(left, levelRank) - rankPower(right, levelRank));
}

/** 从原则生成教练理由文案 */
export function reasonFromPrinciple(code, details = {}) {
  const def = PRINCIPLE_DEFS[code];
  if (!def) return "";

  switch (code) {
    case "P1": {
      if (details.violation === "pair") {
        const loose = (details.looseRanks ?? []).map(rankLabel).join("、");
        return loose
          ? `【${def.code}】有散牌单张（${loose}）够压，不宜拆对子`
          : `【${def.code}】有散牌单张够压，优先出散单`;
      }
      if (details.violation === "structure") {
        return `【${def.code}】有散牌单张够压，不宜拆结构`;
      }
      return `【${def.code}】有散牌单张够压，优先出散单`;
    }
    case "P2":
      return `【${def.code}】无散单，从对子拆最小够压单张`;
    case "P3":
      if (details.tier === "triple") {
        return `【${def.code}】跟牌压小单不宜拆三张，优先从对子或散牌出最小够压单张`;
      }
      return `【${def.code}】无散单/对子可压时才动三同张或更大结构`;
    case "P4":
      if (details.pureBombEarly) {
        return "纯炸保留，对手余牌尚多，等关键控权/队友接风";
      }
      if (details.routineNonBomb) {
        return `【${def.code}】对手普通牌型，手牌仍多不必动炸，过牌等循环`;
      }
      return `【${def.code}】跟牌压小单不宜拆钢板，优先从对子或散牌出最小够压单张`;
    case "P5": {
      if (details.partnerSprint) {
        return `【${def.code}】队友剩牌极少，应炸夺权给其接风`;
      }
      const shape = details.shape ?? "成组牌";
      return details.heavyHand
        ? `【${def.code}】手牌仍多，接风${shape}一次减六张`
        : `【${def.code}】接风${shape}一次减六张，优于小三带二`;
    }
    case "P6":
      return `【${def.code}】有大王可回收牌权，先小单试探`;
    case "P7":
      return details.fullBombControl
        ? `【${def.code}】满张炸弹控牌权，四炸易被反压`
        : details.splitBombControl
          ? `【${def.code}】拆炸出四炸牌力弱，应满张出炸控权`
          : details.pressingStraight
            ? `【${def.code}】四炸够压顺子，打完剩对子仍可减手`
            : details.jokerBeforeStraightFlushFinish
              ? `【${def.code}】先王夺权，同花顺留下一手走完；先出同花顺怕被大炸反压`
              : details.pressingJoker
                ? `【${def.code}】压王用小炸够用，不宜动用更大炸`
                : details.pureBomb
                  ? `【${def.code}】有纯炸弹够压，不宜逢人配凑更大炸`
                  : `【${def.code}】能用小炸就不用大炸，优先最小够压炸弹`;
    case "P8":
      return `【${def.code}】逢人配优先同花顺/炸弹/杂顺，不宜配三带二或对子`;
    case "P9":
      return `【${def.code}】有整炸时应打三带二或普通牌型，不拆炸弹凑三带二`;
    case "P10":
      return details.stackBomb
        ? `【${def.code}】队友本墩已出过牌，不必叠更大炸`
        : `【${def.code}】队友占牌，正常让牌不压队友`;
    case "P11":
      return `【${def.code}】对手报单，用级牌/大牌封门更保险`;
    case "P12":
      return details.fiveBomb
        ? `【${def.code}】手牌仍多，三带二局面不宜五炸，可过牌等循环`
        : details.smallSingle
          ? `【${def.code}】对手小单试探，机器人不宜动炸`
          : `【${def.code}】${def.summary}`;
    default:
      return `【${def.code}】${def.summary}`;
  }
}

/** QA 用：原则白话解释 */
export function explainPrincipleForQa(code, context = {}) {
  const def = PRINCIPLE_DEFS[code];
  if (!def) return "";
  const beatLabel = context.beatLabel ?? "场上单张";
  const looseRank = context.looseRank ? rankLabel(context.looseRank) : null;
  const plateLabel = context.plateLabel ?? "钢板";

  switch (code) {
    case "P1":
      return looseRank
        ? `原则${def.code}（${def.title}）：跟牌压${beatLabel}，手里有散牌${looseRank}够压，应直接出单${looseRank}，不必拆对子或${plateLabel}。`
        : `原则${def.code}（${def.title}）：有现成散单够压时，用最小散单，不拆任何结构。`;
    case "P2":
      return `原则${def.code}（${def.title}）：没有散单可压时，才从对子拆最小够压单张。`;
    case "P3":
      return `原则${def.code}（${def.title}）：散单、对子都不够压时，才考虑动三同张或更大结构。`;
    case "P4":
      return `原则${def.code}（${def.title}）：压${beatLabel}这类小牌，不宜拆${plateLabel}或炸弹，代价过高。`;
    case "P5":
      return `原则${def.code}（${def.title}）：接风/领出优先钢板、顺子等成组减手，优于拆结构组三带二。`;
    case "P6":
      return `原则${def.code}（${def.title}）：手上有王可回收时，先小单试探比无回收的三带二更灵活。`;
    case "P7":
      if (context.levelRank && context.levelRank !== "2" && context.proposedRank === "2") {
        return `原则${def.code}（${def.title}）：本局级牌是${rankLabel(context.levelRank)}，2是最小炸并非大牌；能用${rankLabel(context.contrastRank ?? "9")}炸就不用2炸。`;
      }
      return `原则${def.code}（${def.title}）：仅四张炸弹时取最小够压；超过四张且需夺权时满张出炸控牌权；有纯四炸时不用逢人配凑炸。`;
    case "P8":
      return `原则${def.code}（${def.title}）：逢人配应优先凑同花顺、补炸弹或组杂顺，不宜开局配三带二/对子破坏连对。`;
    case "P9":
      return `原则${def.code}（${def.title}）：手里有四炸及以上时，优先三带二或普通牌型抢权，拆三张整炸作废。`;
    case "P10":
      return `原则${def.code}（${def.title}）：队友已控权或本墩已出小牌，应过牌让队友，不叠炸拦队友；若你只剩1张且能合法走完，应直接出完拿头游，不必让牌。`;
    case "P11":
      return `原则${def.code}（${def.title}）：对手只剩一张时，用级牌${context.levelRank ? rankLabel(context.levelRank) : "级牌"}压单封门，最小 beat 易被队友送牌。`;
    case "P12":
      return `原则${def.code}（${def.title}）：机器人对手小单不过炸；对手三带二手牌仍多不过五炸，可过牌等循环。`;
    default:
      return `原则${def.code}：${def.summary}`;
  }
}

/** 问句 → 原则编号映射（举一反三，减少 case 路由） */
const QUESTION_PRINCIPLE_PATTERNS = [
  { codes: ["P1", "P4"], test: (q) => /有\s*单[3-9JQKA2]|单[3-9JQKA2].*(为什么|为何|为啥).*(拆|出)/i.test(q) },
  { codes: ["P1", "P4"], test: (q) => /有\s*单[3-9JQKA2].*不打|有散[3-9JQKA2]|散[3-9JQKA2].*(为什么|为何|为啥).*(出|打)/i.test(q) },
  { codes: ["P1", "P4"], test: (q) => /为什么.*拆对|拆对.*(为什么|为何|为啥)/i.test(q) },
  { codes: ["P1", "P4"], test: (q) => /为什么.*拆.*(钢板|对[3-9JQKA2]|对子)/i.test(q) },
  { codes: ["P1", "P4"], test: (q) => /拆.*顺子|顺子.*拆|打[3-9JQKA2].*拆.*顺|怎么打[3-9JQKA2]/i.test(q) },
  { codes: ["P2"], test: (q) => /为什么不用对[3-9JQKA2]|为何不用对[3-9JQKA2]|拆.*(三个?|3个?)[3-9JQKA2].*组对/i.test(q) },
  { codes: ["P5"], test: (q) => /(?:怎么|为什么|为何|为啥).*(?:又|还).*(?:推荐|拆).*钢板/i.test(q) },
  { codes: ["P4"], test: (q) => /拆钢板|为什么.*拆钢板|打Q不是更好/i.test(q) },
  { codes: ["P4"], test: (q) => /只剩.*(五炸|炸弹)|五炸.*该不该|纯炸.*该不该|该不该先走.*炸/i.test(q) },
  { codes: ["P5", "P6"], test: (q) => /为什么不打.*(钢板|连对|顺子)|为何不打.*钢板/i.test(q) },
  { codes: ["P5", "P6"], test: (q) => /接风/i.test(q) && !/不用急|不用着急|五炸|大炸|老史|队友.*出|勇哥.*压/i.test(q) },
  { codes: ["P7"], test: (q) => /为什么用.*不用|不用.*(?:四个?|四张?).*压|why-not-bomb/i.test(q) },
  { codes: ["P8"], test: (q) => /逢人配/i.test(q) },
  { codes: ["P9"], test: (q) => /应打三带二|不要拆炸|拆炸打三带二/i.test(q) },
  { codes: ["P10"], test: (q) => /队友.*(炸|占牌)|叠炸/i.test(q) },
  { codes: ["P10"], test: (q) => /剩.*一张.*过牌|该不该过牌让队友|最后一张.*让/i.test(q) },
  { codes: ["P11"], test: (q) => /报单|只剩一张|末张/i.test(q) },
  { codes: ["P12"], test: (q) => /对方为什么不压|老史.*不压|机器人/i.test(q) },
  { codes: ["P1", "P2", "P12"], test: (q) => /对手|对方|勇哥|毛蛋/.test(q) && /拆.*单|都是单|总.*单|净出单|怎么都.*单/i.test(q) },
];

/**
 * 问教练：从问句推断适用原则并生成开篇解释。
 * @returns {{ codes: string[], lines: string[] } | null}
 */
export function explainPrincipleForQuestion(question, context = {}) {
  const q = String(question ?? "").trim();
  if (!q) return null;

  const matched = new Set();
  for (const entry of QUESTION_PRINCIPLE_PATTERNS) {
    if (entry.test(q)) {
      for (const code of entry.codes) matched.add(code);
    }
  }
  if (matched.size === 0) return null;

  const levelRank = context.levelRank ?? "2";
  const qaContext = {
    levelRank,
    beatLabel: context.table?.lastActivePlay?.label,
    plateLabel: "钢板",
    contrastRank: null,
    proposedRank: null,
  };

  const useVsNot = q.match(/为什么用\s*([3-9]|10|J|Q|K|A|2)\s*不用\s*([3-9]|10|J|Q|K|A|2)/i);
  if (useVsNot) {
    qaContext.contrastRank = useVsNot[1].toUpperCase().replace(/^10$/i, "10");
    qaContext.proposedRank = useVsNot[2].toUpperCase().replace(/^10$/i, "10");
  }

  const codes = [...matched];
  const lines = codes.map((code) => explainPrincipleForQa(code, qaContext));
  return { codes, lines };
}

/** 诊断某压单候选违反了哪条原则 */
export function diagnoseBeatSingleViolation(candidate, hand, levelRank, tableContext) {
  const previousPlay = tableContext.previousPlay ?? null;
  if (!isFollowingOpponentSingle(previousPlay, levelRank, tableContext)) return null;
  if (candidate?.type !== PLAY_TYPES.single || !candidate.mainRank) return null;

  const ctx = analyzeMustBeatSingleContext(hand, levelRank, previousPlay, tableContext);
  const rank = candidate.mainRank;
  const tier = getRankStructureTier(hand, rank, levelRank);
  const sfFinish = analyzeJokerStraightFlushFinishHand(hand, levelRank);

  if (sfFinish) {
    if (rank === sfFinish.preferredJoker.rank) {
      return null;
    }
    if (candidate.cards?.some((card) => sfFinish.sfCardIds.has(cardId(card)))) {
      return {
        violated: "P7",
        preferred: "P7",
        looseRank: sfFinish.preferredJoker.rank,
        beatLabel: ctx.beatLabel,
        tier: "straightFlush",
      };
    }
  }

  if (ctx.hasLooseBeater && tier === "loose") {
    const straightBreak = resolveStraightBreakForSingle(rank, hand, levelRank);
    if (straightBreak.breaksStraight && ctx.hasSafeLooseBeater) {
      return {
        violated: "P1",
        preferred: "P1",
        looseRank: ctx.minSafeLooseRank,
        beatLabel: ctx.beatLabel,
        tier: "straight",
      };
    }
  }
  if ((ctx.hasPlayableLooseBeater || ctx.hasNaturalLooseBeater) && tier !== "loose") {
    const code = tier === "plate" ? "P4" : tier === "bomb" ? "P4" : tier === "triple" ? "P3" : "P1";
    return {
      violated: code,
      preferred: "P1",
      looseRank: ctx.minLooseRank,
      beatLabel: ctx.beatLabel,
      tier,
    };
  }
  if ((!ctx.hasPlayableLooseBeater && !ctx.hasNaturalLooseBeater) && tier === "pair") {
    return { violated: null, preferred: "P2", looseRank: null, beatLabel: ctx.beatLabel, tier };
  }
  if (!ctx.hasLooseBeater && tier === "pair") {
    return { violated: null, preferred: "P2", looseRank: null, beatLabel: ctx.beatLabel, tier };
  }
  if (tier === "loose" && ctx.hasLooseBeater) {
    return { violated: null, preferred: "P1", looseRank: rank, beatLabel: ctx.beatLabel, tier };
  }
  return { violated: null, preferred: null, looseRank: ctx.minLooseRank, beatLabel: ctx.beatLabel, tier };
}

/** 诊断跟牌压对子时拆三同张组对、却有整对够压的违规 */
export function diagnoseBeatPairViolation(candidate, hand, levelRank, tableContext) {
  const previousPlay = tableContext.previousPlay ?? null;
  if (!isFollowingOpponentPair(previousPlay, levelRank, tableContext)) return null;
  if (candidate?.type !== PLAY_TYPES.pair || !candidate.mainRank) return null;

  const ctx = analyzeMustBeatPairContext(hand, levelRank, previousPlay, tableContext);
  const rank = candidate.mainRank;
  const held = physicalRankCount(hand, rank);
  const tripleBreak = resolveTripleBreakForPair(rank, hand, levelRank);

  if (ctx.hasWholePairBeater && held >= 3 && tripleBreak.splitsTriple) {
    return {
      violated: "P2",
      preferred: "P2",
      wholePairRank: ctx.minWholePairRank,
      beatLabel: ctx.beatLabel,
      tier: tripleBreak.plateLabel ? "plate" : "triple",
    };
  }

  const reserves = analyzeReservePairForPendingTriple(hand, levelRank, previousPlay, tableContext);
  const reserve = reserves.find((entry) => entry.pairRank === rank);
  if (reserve && held === 2 && candidate.power === ctx.minWholePairPower) {
    return {
      violated: "P4",
      preferred: "P4",
      wholePairRank: ctx.minWholePairRank,
      beatLabel: ctx.beatLabel,
      summary: reserve.reason,
      tier: "reservePairForPendingTriple",
    };
  }
  return null;
}

/**
 * 统一原则加减分。
 * @returns {{ score: number, reasons: string[], principles: string[], hasStrongConflict: boolean }}
 */
export function scoreCandidateByPrinciples(candidate, hand, levelRank, tableContext) {
  const reasons = [];
  const principles = [];
  let score = 0;
  let hasStrongConflict = false;

  const previousPlay = tableContext.previousPlay ?? null;
  const resolvedHand = hand?.length ? hand : resolveHand(tableContext);

  const sfFinishPattern = analyzeJokerStraightFlushFinishHand(resolvedHand, levelRank);
  const sfFinishScoring = scorePreferJokerBeforeStraightFlushFinish(
    candidate,
    resolvedHand,
    levelRank,
    tableContext,
    sfFinishPattern,
    previousPlay,
  );
  let skipP1SingleBeat = false;
  if (sfFinishScoring) {
    score += sfFinishScoring.score;
    reasons.push(...sfFinishScoring.reasons);
    principles.push(...sfFinishScoring.principles);
    if (sfFinishScoring.hasStrongConflict) hasStrongConflict = true;
    skipP1SingleBeat = sfFinishScoring.handledP1Single;
  }

  // —— P1–P3：跟牌压单张（散单优先 / 对子拆单 / 结构兜底） ——
  if (
    isFollowingOpponentSingle(previousPlay, levelRank, tableContext)
    && candidate.type === PLAY_TYPES.single
    && resolvedHand.length > 0
    && !skipP1SingleBeat
  ) {
    const ctx = analyzeMustBeatSingleContext(resolvedHand, levelRank, previousPlay, tableContext);
    const rank = candidate.mainRank;
    const tier = getRankStructureTier(resolvedHand, rank, levelRank);
    const bombInfo = analyzeRankAvailability(resolvedHand, rank, levelRank);
    const lockedInPlate = (bombInfo.lockedEntries ?? []).some((entry) => entry.structure === "钢板");

    const preferPairOverWild = ctx.pairBeaters.length > 0
      && !ctx.hasPlayableLooseBeater
      && !ctx.hasNaturalLooseBeater;
    const usesWildSingle = (candidate.cards ?? []).some((card) => isWildCard(card, levelRank));
    const tripleReserves = findTripleCompanionPairReserves(resolvedHand, levelRank);
    const reservedTriple = tripleReserves.find((item) => item.companionPairRank === rank);
    const jokerReserveTarget = shouldPreferJokerOverReservedPairBreak(ctx, tripleReserves);

    if (ctx.hasPlayableLooseBeater || ctx.hasNaturalLooseBeater) {
      if (tier === "loose") {
        const straightBreak = resolveStraightBreakForSingle(rank, resolvedHand, levelRank);
        if (straightBreak.breaksStraight && ctx.hasSafeLooseBeater) {
          score += 4200;
          reasons.push(reasonFromPrinciple("P1", { violation: "structure" }));
          principles.push("P1");
          hasStrongConflict = true;
        } else if (ctx.hasSafeLooseBeater && candidate.power === ctx.minSafeLoosePower) {
          score -= 2800;
          reasons.push(reasonFromPrinciple("P1", { rank }));
          principles.push("P1");
        } else if (!ctx.hasSafeLooseBeater && candidate.power === ctx.minLoosePower) {
          score -= 2800;
          reasons.push(reasonFromPrinciple("P1", { rank }));
          principles.push("P1");
        } else if (!straightBreak.breaksStraight || !ctx.hasSafeLooseBeater) {
          score -= 1200;
          reasons.push(reasonFromPrinciple("P1"));
          principles.push("P1");
        }
      } else if (rank === "SJ" || rank === "BJ") {
        if (jokerReserveTarget) {
          score -= 4200;
          reasons.push(
            `【P1】对${jokerReserveTarget.companionPairRank}留给${jokerReserveTarget.tripleRank}三带二，宜用${rank === "BJ" ? "大王" : "小王"}压单`,
          );
          principles.push("P1");
        } else {
          score += 3800;
          reasons.push(reasonFromPrinciple("P1", { violation: "structure" }));
          principles.push("P1");
          hasStrongConflict = true;
        }
      } else if (tier === "pair") {
        if (reservedTriple) {
          score += 6400;
          reasons.push(`【P4】对${rank}留给${reservedTriple.tripleRank}三带二，不宜拆对压单`);
          principles.push("P4");
          hasStrongConflict = true;
        } else {
          score += 4600;
          reasons.push(reasonFromPrinciple("P1", {
            violation: "pair",
            looseRanks: ctx.looseBeaters.map((item) => item.mainRank),
          }));
          principles.push("P1");
          hasStrongConflict = true;
        }
      } else if (lockedInPlate || tier === "plate") {
        score += 14_000;
        reasons.push(reasonFromPrinciple("P4"));
        principles.push("P4");
        hasStrongConflict = true;
      } else if (tier === "bomb" || bombInfo.effectiveBombCount >= 4) {
        const bombPenalty = bombInfo.effectiveBombCount >= 5 ? 16_000 : 12_000;
        score += bombPenalty;
        reasons.push(reasonFromPrinciple("P4"));
        principles.push("P4");
        hasStrongConflict = true;
      } else if (tier === "triple") {
        score += 8000;
        reasons.push(reasonFromPrinciple("P3", { tier: "triple" }));
        principles.push("P3");
        hasStrongConflict = true;
      }
    } else if (preferPairOverWild) {
      if (usesWildSingle || rank === "SJ" || rank === "BJ") {
        if ((rank === "SJ" || rank === "BJ") && jokerReserveTarget) {
          score -= 5200;
          reasons.push(
            `【P1】对${jokerReserveTarget.companionPairRank}留给${jokerReserveTarget.tripleRank}三带二，宜用${rank === "BJ" ? "大王" : "小王"}压单`,
          );
          principles.push("P1");
        } else {
          score += rank === "SJ" || rank === "BJ" ? 14_000 : 9800;
          reasons.push(
            usesWildSingle
              ? reasonFromPrinciple("P8")
              : reasonFromPrinciple("P1", { violation: "structure" }),
          );
          principles.push(usesWildSingle ? "P8" : "P1");
          hasStrongConflict = true;
        }
      } else if (tier === "pair" && candidate.power === ctx.minPairPower) {
        if (reservedTriple) {
          score += 6400;
          reasons.push(`【P4】对${rank}留给${reservedTriple.tripleRank}三带二，不宜拆对压单`);
          principles.push("P4");
          hasStrongConflict = true;
        } else {
          score -= 2800;
          reasons.push(reasonFromPrinciple("P2"));
          principles.push("P2");
        }
      } else if (tier === "pair") {
        score += 1800;
        reasons.push(reasonFromPrinciple("P2"));
        principles.push("P2");
      }
    } else if (tier === "pair") {
      score -= 1400;
      reasons.push(reasonFromPrinciple("P2"));
      principles.push("P2");
    }
  }

  // —— P2 延伸：跟牌压对子，有整对够压不宜拆三同张/钢板组对 ——
  if (
    isFollowingOpponentPair(previousPlay, levelRank, tableContext)
    && candidate.type === PLAY_TYPES.pair
    && resolvedHand.length > 0
  ) {
    const ctx = analyzeMustBeatPairContext(resolvedHand, levelRank, previousPlay, tableContext);
    const rank = candidate.mainRank;
    const held = physicalRankCount(resolvedHand, rank);
    const tripleBreak = resolveTripleBreakForPair(rank, resolvedHand, levelRank);

    if (ctx.hasWholePairBeater) {
      if (held === 2 && candidate.power === ctx.minWholePairPower) {
        score -= 2600;
        reasons.push(`【P2】有整对${rankLabel(ctx.minWholePairRank)}够压，优先出对${rankLabel(ctx.minWholePairRank)}`);
        principles.push("P2");
      } else if (held >= 3 && tripleBreak.splitsTriple) {
        score += 5200;
        const structureLabel = tripleBreak.plateLabel ?? tripleBreak.tripleLabel ?? `三张${rankLabel(rank)}`;
        reasons.push(`【P2】有整对${rankLabel(ctx.minWholePairRank)}够压，不宜拆${structureLabel}组对${rankLabel(rank)}`);
        principles.push("P2");
        hasStrongConflict = true;
      }
    }

    const reserves = analyzeReservePairForPendingTriple(
      resolvedHand,
      levelRank,
      previousPlay,
      tableContext,
    );
    const reserve = reserves.find((entry) => entry.pairRank === rank);
    if (reserve && held === 2 && candidate.power === ctx.minWholePairPower) {
      score += 11_200;
      reasons.push(`【P4】${reserve.reason}，不宜拆对${rankLabel(rank)}压牌`);
      principles.push("P4");
      hasStrongConflict = true;
    }
  }

  if (
    candidate.type === PLAY_TYPES.pass
    && isFollowingOpponentPair(previousPlay, levelRank, tableContext)
    && resolvedHand.length > 0
  ) {
    const reserves = analyzeReservePairForPendingTriple(
      resolvedHand,
      levelRank,
      previousPlay,
      tableContext,
    );
    if (reserves.length > 0) {
      score -= 10_400;
      reasons.push(`【P4】${reserves[0].reason}，可过牌保留结构`);
      principles.push("P4");
    }
  }

  // —— P5–P6：接风 / 领出 ——
  const { leadMode, isOpening } = tableContext;
  const isLeadTurn = isOpening && leadMode !== "must-beat";
  if (isLeadTurn && !BOMB_TYPES.has(candidate.type)) {
    const steelPlate = hasSteelPlate(resolvedHand, levelRank);
    const recovery = hasBigJokerRecovery(resolvedHand);

    // 真开局：有散单或成组结构时，不宜拆对/拆三出单张
    if (
      leadMode === "fresh-open"
      && candidate.type === PLAY_TYPES.single
      && candidate.mainRank
    ) {
      const rank = candidate.mainRank;
      const tier = getRankStructureTier(resolvedHand, rank, levelRank);
      const looseRanks = looseLeadSingleRanks(resolvedHand, levelRank);
      if (tier === "triple") {
        score += 7500;
        reasons.push("【P1】开局拆三同张出单，宜出对子或成组结构");
        principles.push("P1");
        hasStrongConflict = true;
      } else if (tier === "pair" && looseRanks.length > 0) {
        score += 7000;
        reasons.push(`【P1】开局有散单，不宜拆对${rankLabel(rank)}出单张`);
        principles.push("P1");
        hasStrongConflict = true;
      }
    }

    if (candidate.type === PLAY_TYPES.plane && candidate.length >= 6) {
      const heavyHand = resolvedHand.length >= 15;
      score -= heavyHand ? 5600 : 4200;
      reasons.push(reasonFromPrinciple("P5", { shape: "钢板", heavyHand }));
      principles.push("P5");
      if (recovery && resolvedHand.length >= 10) {
        score += steelPlate ? 9200 : 3200;
        reasons.push(reasonFromPrinciple("P6"));
        principles.push("P6");
        hasStrongConflict = true;
      }
    } else if (
      candidate.type === PLAY_TYPES.consecutivePairs
      && candidate.length >= 6
      && !steelPlate
    ) {
      const tripleBreak = resolveTripleBreakForConsecutivePairs(candidate, resolvedHand, levelRank);
      if (tripleBreak.splitsTriple) {
        const reserves = analyzeReserveTripleForTripleWithPair(
          resolvedHand,
          levelRank,
          { ...tableContext, hand: resolvedHand },
        );
        const reserve = reserves.find((entry) => entry.tripleRank === tripleBreak.tripleRank);
        const altCp = (tableContext._candidates ?? []).some(
          (item) => item.type === PLAY_TYPES.consecutivePairs
            && item.length >= 6
            && !resolveTripleBreakForConsecutivePairs(item, resolvedHand, levelRank).splitsTriple,
        );
        const shouldPenalizeTripleBreak = altCp || (resolvedHand.length >= 15 && reserve);
        if (shouldPenalizeTripleBreak) {
          score += resolvedHand.length >= 15 ? 12_000 : 10_000;
          reasons.push(reserve?.reason ?? `【P5】不宜拆${tripleBreak.tripleLabel ?? `三张${rankLabel(tripleBreak.tripleRank)}`}凑连对`);
          if (altCp) reasons.push("有更不拆三同张的连对路线");
          principles.push("P5");
          hasStrongConflict = true;
        } else {
          const heavyHand = resolvedHand.length >= 15;
          score -= heavyHand ? 5600 : 4200;
          reasons.push(reasonFromPrinciple("P5", { shape: "连对", heavyHand }));
          principles.push("P5");
        }
      } else {
        const heavyHand = resolvedHand.length >= 15;
        score -= heavyHand ? 5600 : 4200;
        reasons.push(reasonFromPrinciple("P5", { shape: "连对", heavyHand }));
        principles.push("P5");
      }
    } else if (
      candidate.type === PLAY_TYPES.consecutivePairs
      && candidate.length >= 6
      && steelPlate
    ) {
      score += resolvedHand.length >= 15 ? 10_000 : 8500;
      reasons.push("领出/接风有完整钢板，不宜拆点凑连对");
      principles.push("P5");
      hasStrongConflict = true;
    } else if (candidate.type === PLAY_TYPES.tripleWithPair && steelPlate && recovery) {
      const tripleHeld = physicalRankCount(resolvedHand, candidate.mainRank);
      if (tripleHeld === 3) {
        score += 4200;
        reasons.push("三带二无送单回收路径，被压后只能靠炸");
        principles.push("P6");
      }
    } else if (
      candidate.type === PLAY_TYPES.single
      && recovery
      && steelPlate
      && resolvedHand.length >= 10
      && physicalRankCount(resolvedHand, candidate.mainRank) === 1
      && isProbeSingleRank(candidate.mainRank, levelRank)
    ) {
      score -= 6000;
      reasons.push(reasonFromPrinciple("P6"));
      principles.push("P6");
    } else if (
      candidate.type === PLAY_TYPES.tripleWithPair
      && steelPlate
      && recovery
      && resolvedHand.length >= 10
    ) {
      score += 2400;
      reasons.push(reasonFromPrinciple("P6"));
      principles.push("P6");
    }

    // 真开局：大王可回收时散单试探优于三带二减手（P6 延伸）
    if (leadMode === "fresh-open" && recovery && resolvedHand.length >= 15) {
      const looseRanks = looseLeadSingleRanks(resolvedHand, levelRank);
      if (
        candidate.type === PLAY_TYPES.single
        && candidate.mainRank
        && looseRanks.includes(candidate.mainRank)
      ) {
        score -= 6800;
        reasons.push(reasonFromPrinciple("P6"));
        principles.push("P6");
      } else if (candidate.type === PLAY_TYPES.tripleWithPair) {
        score += 6400;
        reasons.push(reasonFromPrinciple("P6"));
        principles.push("P6");
        hasStrongConflict = true;
      }
    }

    // 领出/接风拆钢板组三带二（P5 反面）
    if (
      steelPlate
      && candidate.type === PLAY_TYPES.tripleWithPair
      && resolvedHand.length >= 10
    ) {
      const tripleAnalysis = analyzeRankAvailability(resolvedHand, candidate.mainRank, levelRank);
      const lockedInPlate = (tripleAnalysis.lockedEntries ?? []).some((e) => e.structure === "钢板");
      if (lockedInPlate) {
        score += resolvedHand.length >= 15 ? 12_000 : 9000;
        reasons.push("接风有完整钢板，应直接走钢板一次减六张");
        principles.push("P5");
        hasStrongConflict = true;
      }
    }

    // 接风/领出：三同张整组三带二，优于拆三张凑连对（仅手牌多或有其它连对替代时）
    if (candidate.type === PLAY_TYPES.tripleWithPair) {
      const tripleRank = candidate.mainRank;
      const tripleUsed = (candidate.cards ?? []).filter((card) => card.rank === tripleRank).length;
      const bombInfo = analyzeRankAvailability(resolvedHand, tripleRank, levelRank);
      if (tripleUsed >= 3 && physicalRankCount(resolvedHand, tripleRank) >= 3
        && bombInfo.effectiveBombCount < 4 && physicalRankCount(resolvedHand, tripleRank) < 4) {
        const reserves = analyzeReserveTripleForTripleWithPair(
          resolvedHand,
          levelRank,
          { ...tableContext, hand: resolvedHand },
        );
        const reserve = reserves.find((entry) => entry.tripleRank === tripleRank);
        const altCp = (tableContext._candidates ?? []).some(
          (item) => item.type === PLAY_TYPES.consecutivePairs
            && item.length >= 6
            && !resolveTripleBreakForConsecutivePairs(item, resolvedHand, levelRank).splitsTriple,
        );
        if (reserve && (altCp || resolvedHand.length >= 15) && !(leadMode === "fresh-open" && recovery)) {
          score -= resolvedHand.length >= 15 ? 4800 : 4200;
          reasons.push(`【P5】${rankLabel(tripleRank)}三带二一次减五张，优于拆三张凑连对`);
          principles.push("P5");
        }
      }
    }

    // 接风：有对可配时三带二优于裸三张
    if (leadMode === "catch-wind" && candidate.type === PLAY_TYPES.tripleWithPair) {
      const tripleRank = candidate.mainRank;
      const solePair = solePairForTripleRank(resolvedHand, levelRank, tripleRank);
      const pairUsed = (candidate.cards ?? []).find((card) => card.rank !== tripleRank)?.rank ?? null;
      if (solePair && pairUsed === solePair) {
        score -= resolvedHand.length >= 15 ? 5200 : 4600;
        reasons.push(`【P5】接风${rankLabel(tripleRank)}带对${rankLabel(solePair)}一次减五张，优于裸三张`);
        principles.push("P5");
      }
    } else if (leadMode === "catch-wind" && candidate.type === PLAY_TYPES.triple) {
      const solePair = solePairForTripleRank(resolvedHand, levelRank, candidate.mainRank);
      if (solePair) {
        score += resolvedHand.length >= 15 ? 6800 : 5400;
        reasons.push(`【P5】手上有对${rankLabel(solePair)}可配，不宜裸三张${rankLabel(candidate.mainRank)}`);
        principles.push("P5");
        hasStrongConflict = true;
      }
    } else if (leadMode === "catch-wind" && candidate.type === PLAY_TYPES.pair) {
      const tripleRank = candidate.mainRank;
      if (physicalRankCount(resolvedHand, tripleRank) >= 3) {
        const solePair = solePairForTripleRank(resolvedHand, levelRank, tripleRank);
        if (solePair) {
          score += resolvedHand.length >= 15 ? 8000 : 6400;
          reasons.push(
            `【P5】接风三个${rankLabel(tripleRank)}带对${rankLabel(solePair)}一次减五张，不宜拆三出对${rankLabel(tripleRank)}`,
          );
          principles.push("P5");
          hasStrongConflict = true;
        }
      }
    }

    // 领出/接风：三带二/三张拆已成顺子（P4/P5）
    if (candidate.type === PLAY_TYPES.tripleWithPair || candidate.type === PLAY_TYPES.triple) {
      const straightBreak = resolveStraightBreakForTripleWithPair(candidate, resolvedHand, levelRank);
      if (straightBreak.breaksStraight) {
        score += resolvedHand.length >= 15 ? 16_000 : 14_000;
        reasons.push(`领出/接风不宜${candidate.type === PLAY_TYPES.triple ? "三张" : "三带二"}拆${straightBreak.straightLabel ?? "顺子"}`);
        principles.push("P4");
        hasStrongConflict = true;
      }
    } else if (candidate.type === PLAY_TYPES.straight && candidate.length >= 5) {
      const overlapChoice = handHasOverlappingLowStraightChoice(resolvedHand, levelRank);
      if (overlapChoice && isWrapStraightPlay(candidate)) {
        score += resolvedHand.length >= 15 ? 9500 : 7800;
        reasons.push(`同套可组23456+留A，不宜走绕级顺A2345（${STRAIGHT_HIGH_OVER_WRAP_REASON}）`);
        principles.push("P4");
        hasStrongConflict = true;
      } else {
        const tripleBreak = resolveTripleBreakForStraight(candidate, resolvedHand, levelRank);
        if (tripleBreak.splitsTriple && !(overlapChoice && isHighLowStraightPlay(candidate))) {
          score += resolvedHand.length >= 15 ? 9000 : 7200;
          reasons.push("领出/接风不宜拆三同张组顺");
          principles.push("P5");
          hasStrongConflict = true;
        }
      }
    }
  }

  // —— P7：最小够压炸弹（牌力 + 张数 + 逢人配） ——
  if (candidate.type === PLAY_TYPES.bomb && !tableContext.hasActionableRegularWinner) {
    const bombBeaters = (tableContext._candidates ?? []).filter(
      (item) => item.type === PLAY_TYPES.bomb && canBeat(item, previousPlay),
    );
    if (bombBeaters.length > 0 && previousPlay) {
      const sfBreakLabel = breaksStrategicStraightFlush(candidate, resolvedHand, levelRank);
      const structureWholeBombs = structureAwareBombs(resolvedHand, levelRank);
      if (sfBreakLabel && structureWholeBombs.length > 0) {
        score += 22_000;
        reasons.push(`不宜拆${sfBreakLabel}凑${candidate.mainRank}炸，整炸更优`);
        principles.push("P4");
        hasStrongConflict = true;
      }

      const structureAwareBeaters = bombBeaters.filter(
        (item) => !breaksStrategicStraightFlush(item, resolvedHand, levelRank),
      );
      const minPowerPool = structureAwareBeaters.length > 0 ? structureAwareBeaters : bombBeaters;
      const minPower = Math.min(...minPowerPool.map((item) => rankPower(item.mainRank, levelRank)));
      const gap = rankPower(candidate.mainRank, levelRank) - minPower;
      const pressingJoker = previousPlay.type === PLAY_TYPES.single
        && (previousPlay.mainRank === "BJ" || previousPlay.mainRank === "SJ");
      if (gap >= 1) {
        const overspendRate = pressingJoker ? 720 : 480;
        if (!BOMB_TYPES.has(previousPlay.type) || gap >= 2) {
          score += gap * overspendRate;
          reasons.push(reasonFromPrinciple("P7", { pressingJoker }));
          principles.push("P7");
        }
      }

      const bombSizeOf = (item) => item.bombSize ?? item.cards?.length ?? 4;
      const minBombSize = Math.min(...bombBeaters.map(bombSizeOf));
      const candidateBombSize = bombSizeOf(candidate);
      const sizeGap = candidateBombSize - minBombSize;
      const physicalHeld = physicalRankCount(resolvedHand, candidate.mainRank);
      const wantFullBomb = prefersFullBombForControl(
        resolvedHand,
        candidate.mainRank,
        previousPlay,
        tableContext,
      );

      if (wantFullBomb) {
        if (candidateBombSize === physicalHeld) {
          score -= 4800;
          reasons.push(reasonFromPrinciple("P7", { fullBombControl: true }));
          principles.push("P7");
        } else if (candidateBombSize < physicalHeld) {
          const splitGap = physicalHeld - candidateBombSize;
          score += 5200 + splitGap * 3200;
          reasons.push(reasonFromPrinciple("P7", { splitBombControl: true }));
          principles.push("P7");
          hasStrongConflict = true;
        }
      } else if (sizeGap >= 1) {
        const sizeOverspendRate = pressingJoker ? 2800 : 2000;
        score += sizeGap * sizeOverspendRate;
        reasons.push(reasonFromPrinciple("P7", { pressingJoker }));
        principles.push("P7");
      } else if (
        previousPlay.type === PLAY_TYPES.straight
        && candidateBombSize === minBombSize
        && physicalHeld === 4
      ) {
        reasons.push(reasonFromPrinciple("P7", { pressingStraight: true }));
        principles.push("P7");
      }

      const candidateUsesWild = candidate.cards?.some((card) => isWildCard(card, levelRank)) ?? false;
      if (candidateUsesWild) {
        const pureBeaters = bombBeaters.filter(
          (item) => !(item.cards?.some((card) => isWildCard(card, levelRank)) ?? false),
        );
        if (pureBeaters.length > 0) {
          score += pressingJoker ? 18_000 : 14_000;
          reasons.push("有纯炸弹够压，不宜逢人配凑更大炸");
          principles.push("P7");
          hasStrongConflict = true;
        }
      }
    }
  }

  // —— 跟牌压单：三带二拆钢板禁止（P4 延伸） ——
  if (
    isFollowingOpponentSingle(previousPlay, levelRank, tableContext)
    && candidate.type === PLAY_TYPES.tripleWithPair
    && resolvedHand.length > 0
  ) {
    const tripleAnalysis = analyzeRankAvailability(resolvedHand, candidate.mainRank, levelRank);
    const lockedInPlate = (tripleAnalysis.lockedEntries ?? []).some((entry) => entry.structure === "钢板");
    if (lockedInPlate) {
      score += 15_000;
      reasons.push(reasonFromPrinciple("P4"));
      principles.push("P4");
      hasStrongConflict = true;
    }
  }

  // —— 压小单不宜动炸（P4 延伸） ——
  if (
    isPressingSmallSingle(previousPlay, levelRank, tableContext)
    && BOMB_TYPES.has(candidate.type)
    && !tableContext.isFinishingPlay
    && tableContext.danger < 2
  ) {
    const gap = rankPower(candidate.mainRank, levelRank)
      - rankPower(previousPlay.mainRank, levelRank);
    score += 10_000 + Math.max(0, gap) * 380;
    reasons.push(reasonFromPrinciple("P4"));
    principles.push("P4");
    hasStrongConflict = true;
  }

  // —— 队友冲刺：炸夺权给队友接风 ——
  if (shouldBombForPartnerFinish(tableContext, resolvedHand, previousPlay)) {
    if (candidate.type === PLAY_TYPES.pass) {
      score += 11_200;
      reasons.push(reasonFromPrinciple("P5", { partnerSprint: true }));
      principles.push("P5");
      hasStrongConflict = true;
    } else if (BOMB_TYPES.has(candidate.type)) {
      const bombSize = candidate.bombSize ?? candidate.cards?.length ?? 4;
      const held = physicalRankCount(resolvedHand, candidate.mainRank);
      if (bombSize === held) {
        score -= 7200;
        reasons.push("队友冲刺，满张炸夺权给队友接风");
        principles.push("P5");
      } else if (held > 4) {
        score += 9000;
        reasons.push(reasonFromPrinciple("P7", { splitBombControl: true }));
        principles.push("P7");
        hasStrongConflict = true;
      }
    }
  }

  // —— 纯炸保留：仅剩满张炸弹，对手余牌尚多不宜过早亮炸 ——
  if (shouldReservePureBombEarly(tableContext, resolvedHand, previousPlay)) {
    if (BOMB_TYPES.has(candidate.type)) {
      const bombSize = candidate.bombSize ?? candidate.cards?.length ?? 4;
      score += bombSize >= 5 ? 12_000 : 10_000;
      reasons.push(reasonFromPrinciple("P4", { pureBombEarly: true }));
      principles.push("P4");
      hasStrongConflict = true;
    }
  }

  // —— 压普通非炸弹牌型：手牌仍多不宜动炸（P4/P7 延伸；须压顺子满张控权除外） ——
  const straightBombDuty = previousPlay?.type === PLAY_TYPES.straight
    && (
      isBombOnlyBeatContext(tableContext)
      || prefersFullBombForControl(resolvedHand, candidate.mainRank, previousPlay, tableContext)
    );
  if (
    isPressingRoutineNonBomb(previousPlay, tableContext)
    && BOMB_TYPES.has(candidate.type)
    && shouldReserveBombForHeavyHand(tableContext, resolvedHand.length)
    && !straightBombDuty
  ) {
    const bombSize = candidate.bombSize ?? candidate.cards?.length ?? 4;
    const heavyBomb = bombSize >= 5;
    const minBombPower = (tableContext._candidates ?? [])
      .filter((item) => item.type === PLAY_TYPES.bomb && canBeat(item, previousPlay))
      .reduce((min, item) => Math.min(min, rankPower(item.mainRank, levelRank)), Infinity);
    const gap = rankPower(candidate.mainRank, levelRank)
      - (Number.isFinite(minBombPower) ? minBombPower : rankPower(candidate.mainRank, levelRank));
    const basePenalty = heavyBomb ? 14_000 : 11_000;
    score += basePenalty + Math.max(0, gap) * (heavyBomb ? 480 : 360);
    reasons.push(reasonFromPrinciple("P4", { routineNonBomb: true }));
    principles.push("P4");
    if (gap >= 1) {
      reasons.push(reasonFromPrinciple("P7", { pressingJoker: false }));
      principles.push("P7");
    }
    hasStrongConflict = true;
  }

  // —— P8：逢人配不宜低价值配牌 ——
  if (usesWildInCandidate(candidate, levelRank) && !tableContext.isFinishingPlay) {
    const lowValueWild = [
      PLAY_TYPES.tripleWithPair,
      PLAY_TYPES.pair,
      PLAY_TYPES.triple,
    ].includes(candidate.type);
    const wildOkShape = candidate.type === PLAY_TYPES.straight || BOMB_TYPES.has(candidate.type);
    const wildFillCount = (candidate.wildcardAssignments ?? []).length
      || (candidate.cards ?? []).filter((card) => isWildCard(card, levelRank) && card.rank !== candidate.mainRank).length;
    if (lowValueWild) {
      const openingLike = isOpening || leadMode === "fresh-open";
      score += openingLike ? 7600 : 4200;
      reasons.push(reasonFromPrinciple("P8"));
      principles.push("P8");
      hasStrongConflict = true;
    } else if (
      candidate.type === PLAY_TYPES.straightFlush
      && leadMode === "fresh-open"
      && wildFillCount >= 2
      && candidate.cards?.length < resolvedHand.length
    ) {
      score += 16_000;
      reasons.push("【P8】开局不宜双逢人配空炸同花顺");
      principles.push("P8");
      hasStrongConflict = true;
    } else if (
      leadMode === "fresh-open"
      && wildFillCount > 0
      && candidate.cards?.length < resolvedHand.length
      && candidate.type !== PLAY_TYPES.pass
    ) {
      score += wildFillCount >= 2 ? 14_000 : 10_000;
      reasons.push("【P8】开局有天然路线时不宜逢人配");
      principles.push("P8");
      hasStrongConflict = true;
    } else if (candidate.type === PLAY_TYPES.bomb && previousPlay) {
      const bombBeaters = (tableContext._candidates ?? []).filter(
        (item) => item.type === PLAY_TYPES.bomb && canBeat(item, previousPlay),
      );
      const pureBeaters = bombBeaters.filter((item) => !usesWildInCandidate(item, levelRank));
      if (pureBeaters.length > 0) {
        const bombSizeOf = (item) => item.bombSize ?? item.cards?.length ?? 4;
        const minPureSize = Math.min(...pureBeaters.map(bombSizeOf));
        const candidateSize = bombSizeOf(candidate);
        score += 12_000 + Math.max(0, candidateSize - minPureSize) * 2800;
        reasons.push(reasonFromPrinciple("P7", { pureBomb: true }));
        principles.push("P7");
        hasStrongConflict = true;
      }
    } else if (!wildOkShape) {
      score += isOpening ? 420 : 280;
      reasons.push("逢人配谨慎使用");
      principles.push("P8");
    }
  }

  // —— P10：队友让牌（剩 1 张能走完时让位于走完） ——
  const canFinishThisTurn = resolvedHand.length === 1 && tableContext.hasAnyWinner;
  if (
    shouldYieldPassAfterPartnerLeadOnOpponentBomb(tableContext, resolvedHand, previousPlay)
    && candidate.type === PLAY_TYPES.pass
  ) {
    score -= 8200;
    reasons.push(reasonFromPrinciple("P10", { stackBomb: true }));
    principles.push("P10");
  }
  if (tableContext.partnerOwnsTrick && !tableContext.isFinishingPlay && !canFinishThisTurn) {
    if (candidate.type === PLAY_TYPES.pass) {
      score -= 7200;
      reasons.push(reasonFromPrinciple("P10"));
      principles.push("P10");
    } else {
      score += 6200;
      reasons.push(reasonFromPrinciple("P10"));
      principles.push("P10");
      if (BOMB_TYPES.has(candidate.type)) {
        score += 4800;
        reasons.push(reasonFromPrinciple("P10", { stackBomb: true }));
        principles.push("P10");
      }
      hasStrongConflict = true;
    }
  }

  // —— P12 + 机器人跟牌：robot-doctrine.mjs ——
  const robotDoctrine = scoreRobotDoctrine(candidate, resolvedHand, levelRank, tableContext);
  score += robotDoctrine.score;
  reasons.push(...robotDoctrine.reasons);
  principles.push(...robotDoctrine.principles);

  const robotFollow = robotMustFollowAdjustment(candidate, previousPlay, tableContext);
  score += robotFollow.score;
  reasons.push(...robotFollow.reasons);

  return { score, reasons, principles, hasStrongConflict };
}

function usesWildInCandidate(candidate, levelRank) {
  return candidate.cards?.some((card) => isWildCard(card, levelRank)) ?? false;
}

/** 原则与 ML 强烈冲突时硬否决（权重→0，不再软降权） */
export function principleMlVetoFactor(principleResult, tableContext = null, candidate = null) {
  if (principleResult?.hasStrongConflict || principleResult?.doctrineEnforced) return 0;
  if (
    candidate?.type === PLAY_TYPES.pass
    && tableContext
    && shouldVetoBombOnlyPass(
      tableContext,
      tableContext.hand,
      tableContext.previousPlay ?? tableContext.state?.lastActivePlay,
    )
  ) {
    return 0;
  }
  const hand = tableContext?.hand
    ?? tableContext?.state?.players?.[
      tableContext?.playerIndex ?? tableContext?.state?.currentPlayerIndex
    ]?.hand
    ?? [];
  if (
    candidate?.type === PLAY_TYPES.pass
    && hand.length === 1
    && tableContext?.hasAnyWinner
  ) {
    return 0;
  }
  if (
    candidate?.type !== PLAY_TYPES.pass
    && hand.length === 1
    && candidate?.cards?.length === hand.length
  ) {
    return 0;
  }
  return 1;
}

function findLooseBeaterRank(hand, counts, mustBeatRank, levelRank, preferredRank = null) {
  if (preferredRank) {
    const held = counts.get(preferredRank) ?? 0;
    if (held === 1 && compareRanks(preferredRank, mustBeatRank, levelRank) > 0) {
      return preferredRank;
    }
  }
  const beaters = [];
  for (const [rank, count] of counts.entries()) {
    if (rank === "SJ" || rank === "BJ") continue;
    if (count === 1 && compareRanks(rank, mustBeatRank, levelRank) > 0) {
      beaters.push(rank);
    }
  }
  const safeBeaters = beaters.filter(
    (rank) => !resolveStraightBreakForSingle(rank, hand, levelRank).breaksStraight,
  );
  const pool = safeBeaters.length > 0 ? safeBeaters : beaters;
  let looseRank = null;
  for (const rank of pool) {
    if (!looseRank || compareRanks(rank, looseRank, levelRank) < 0) {
      looseRank = rank;
    }
  }
  return looseRank;
}

function findSingleChoiceIndex(choices, rank) {
  for (let i = 0; i < choices.length; i++) {
    const play = choices[i].play ?? choices[i].candidate;
    if (play?.type === PLAY_TYPES.single && play.mainRank === rank) {
      return i;
    }
  }
  return -1;
}

function describeLooseCard(hand, looseRank) {
  const card = hand.find((item) => item.rank === looseRank);
  const label = card?.label ?? "";
  const suitMatch = label.match(/^(梅花|方片|红桃|黑桃)/);
  if (suitMatch) {
    return `散单${rankLabel(looseRank)}（${label}）`;
  }
  return `散单${rankLabel(looseRank)}`;
}

/** QA：跟牌压单张、有散单却拆结构类追问的统一作答（3–5 行） */
export function buildBeatSinglePrincipleAnswer(context, counts, options = {}) {
  const table = context.table ?? {};
  const mustBeat = table.lastActivePlay ?? null;
  if (mustBeat?.type !== PLAY_TYPES.single) return null;

  const levelRank = context.levelRank ?? "2";
  const hand = context.humanHand ?? [];
  const top = context.currentAdvice?.choices?.[0];
  const topPlay = top?.play ?? top?.candidate;
  const choices = context.currentAdvice?.choices ?? [];
  const looseRank = findLooseBeaterRank(
    hand,
    counts,
    mustBeat.mainRank,
    levelRank,
    options.preferredLooseRank ?? null,
  );
  if (!looseRank) return null;

  const beatLabel = mustBeat.label ?? `单${rankLabel(mustBeat.mainRank)}`;
  const looseDesc = describeLooseCard(hand, looseRank);
  const topRank = topPlay?.mainRank ?? null;
  const topTier = topRank ? getRankStructureTier(hand, topRank, levelRank) : null;
  const topBreaksPair = topTier === "pair";
  const topBreaksPlate = topTier === "plate";
  const topShort = topPlay?.label ?? (topRank ? `单${rankLabel(topRank)}` : "—");
  const plates = buildStrategicGroups(hand, levelRank).filter(
    (group) => group.label?.startsWith("钢板") || group.play?.type === PLAY_TYPES.plane,
  );
  const plateLabel = plates[0]?.label ?? "钢板";
  const contentLines = [];

  if (topBreaksPair && topRank) {
    contentLines.push(
      `原则P1（散单优先）：推荐1${topShort}会拆对${rankLabel(topRank)}；跟牌压${beatLabel}，你手里有${looseDesc}，应出单${rankLabel(looseRank)}。`,
    );
  } else if (topBreaksPlate && topRank) {
    contentLines.push(
      `原则P1（散单优先）：推荐1${topShort}会拆${plateLabel}；跟牌压${beatLabel}，你手里有${looseDesc}，应出单${rankLabel(looseRank)}。`,
    );
  } else if (topRank && topRank !== looseRank) {
    contentLines.push(
      `原则P1（散单优先）：跟牌压${beatLabel}，你手里有${looseDesc}，应出单${rankLabel(looseRank)}，不必出${topShort}。`,
    );
  } else {
    contentLines.push(
      `原则P1（散单优先）：跟牌压${beatLabel}，你手里有${looseDesc}，应出单${rankLabel(looseRank)}。`,
    );
  }

  if (topRank !== looseRank || topBreaksPair || topBreaksPlate) {
    contentLines.push("这手左侧推荐偏了：有散单够压时不该拆结构。");
  }

  const looseIdx = findSingleChoiceIndex(choices, looseRank);
  if (looseIdx === 0) {
    contentLines.push(`单${rankLabel(looseRank)}就是推荐1，请直接出。`);
  } else if (looseIdx > 0) {
    contentLines.push(
      `单${rankLabel(looseRank)}在候选第${looseIdx + 1}位；请出单${rankLabel(looseRank)}，不必照抄当前推荐1。`,
    );
  } else {
    contentLines.push(
      `单${rankLabel(looseRank)}未进候选，是候选生成遗漏；仍应出单${rankLabel(looseRank)}。`,
    );
  }

  return ["【规则引擎作答】", ...contentLines.slice(0, 4)];
}

function findWholePairBeaterRank(hand, counts, mustBeat, levelRank, preferredRank = null) {
  if (preferredRank) {
    const held = counts.get(preferredRank) ?? 0;
    if (held === 2 && compareRanks(preferredRank, mustBeat.mainRank, levelRank) > 0) {
      return preferredRank;
    }
  }
  let best = null;
  for (const [rank, count] of counts.entries()) {
    if (count !== 2 || compareRanks(rank, mustBeat.mainRank, levelRank) <= 0) continue;
    if (!best || compareRanks(rank, best, levelRank) < 0) best = rank;
  }
  return best;
}

function findPairChoiceIndex(choices, rank) {
  for (let i = 0; i < choices.length; i++) {
    const play = choices[i].play ?? choices[i].candidate;
    if (play?.type === PLAY_TYPES.pair && play.mainRank === rank) {
      return i;
    }
  }
  return -1;
}

/** QA：跟牌压对子、有整对却拆三同张组对类追问的统一作答（3–5 行） */
export function buildBeatPairPrincipleAnswer(context, counts, options = {}) {
  const table = context.table ?? {};
  const mustBeat = table.lastActivePlay ?? null;
  if (!isBeatPairLikeMustBeat(mustBeat)) return null;

  const levelRank = context.levelRank ?? "2";
  const hand = context.humanHand ?? [];
  const top = context.currentAdvice?.choices?.[0];
  const topPlay = top?.play ?? top?.candidate;
  const choices = context.currentAdvice?.choices ?? [];
  const wholeRank = findWholePairBeaterRank(
    hand,
    counts,
    mustBeat,
    levelRank,
    options.preferredPairRank ?? null,
  );
  if (!wholeRank) return null;

  const beatLabel = mustBeat.label ?? `对${rankLabel(mustBeat.mainRank)}`;
  const topRank = topPlay?.mainRank ?? null;
  const topHeld = topRank ? (counts.get(topRank) ?? 0) : 0;
  const tripleBreak = topRank ? resolveTripleBreakForPair(topRank, hand, levelRank) : null;
  const contentLines = [];

  if (topRank && topHeld >= 3 && tripleBreak?.splitsTriple) {
    const structureLabel = tripleBreak.plateLabel ?? tripleBreak.tripleLabel ?? `三张${rankLabel(topRank)}`;
    contentLines.push(
      `推荐1出对${rankLabel(topRank)}会拆${structureLabel}组对子。`,
    );
    contentLines.push(
      `原则P2（整对优先）：跟牌压${beatLabel}，你手里有整对${rankLabel(wholeRank)}够压，应出对${rankLabel(wholeRank)}，不必拆三同张。`,
    );
  } else if (topRank && topRank !== wholeRank) {
    contentLines.push(
      `原则P2（整对优先）：跟牌压${beatLabel}，有整对${rankLabel(wholeRank)}够压，应出对${rankLabel(wholeRank)}。`,
    );
  } else {
    contentLines.push(
      `原则P2（整对优先）：推荐1就是对${rankLabel(wholeRank)}，可以直接出。`,
    );
  }

  if (topRank !== wholeRank) {
    const wholeIdx = findPairChoiceIndex(choices, wholeRank);
    if (wholeIdx > 0) {
      contentLines.push(`对${rankLabel(wholeRank)}在候选第${wholeIdx + 1}位，请出对${rankLabel(wholeRank)}。`);
    } else if (wholeIdx < 0) {
      contentLines.push(`推荐1偏了，请出对${rankLabel(wholeRank)}。`);
    }
  }

  return ["【规则引擎作答】", ...contentLines.slice(0, 4)];
}
