/**
 * 推荐动作 vs 理由文案一致性：检测、过滤与回退句。
 * recommend / guards / local-qa / 测试共用。
 */
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { canBeat } from "../engine/compare-play.mjs";

export const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

/** 声称已压住/跟住须压牌型的理由（须压时压不过则与动作矛盾） */
const BEAT_CLAIM_REASON_PATTERNS = [
  /跟住对手单张/,
  /压住对手单张/,
  /用最小对子压住/,
  /用最小连对压住/,
  /有单可管不宜过牌/,
  /单张可管宜顺过/,
  /对手占牌，优先用普通牌型抢回牌权/,
];

export function isBeatClaimReason(reason) {
  const raw = String(reason ?? "").trim();
  if (!raw) return false;
  return matchesAny(raw, BEAT_CLAIM_REASON_PATTERNS);
}

/** 推荐过牌时不得单独作为支持理由的「应压/不宜过」类文案 */
const ANTI_PASS_REASON_PATTERNS = [
  /不宜过牌/,
  /不应.*过牌/,
  /不能轻易放行/,
  /须压.*不宜过/,
  /只有炸弹能压，不宜/,
  /只有炸弹能跟，不宜过牌/,
  /对手.*占牌.*有更大炸应抢牌权/,
  /用最小对子压住/,
  /用最小连对压住/,
  /跟住对手单张/,
  /对手占牌且你有普通压牌/,
  /对手出单张且有牌可压/,
  /^只有炸弹能压，应抢牌权$/,
  /^有普通牌可压，不宜过牌$/,
];

/** 推荐出牌（非过牌、非炸弹）时与动作矛盾的「建议过牌/不必强打」类 */
const ANTI_REGULAR_PLAY_REASON_PATTERNS = [
  /^建议过牌$/,
  /^可过牌$/,
  /不必强打/,
  /不宜动炸/,
  /不必动用炸弹/,
];

/** 推荐炸弹时与动作矛盾的保留/惩罚类（与 reason-align 同源） */
const ANTI_BOMB_REASON_PATTERNS = [
  /^炸弹是牌权资源，非必要不消耗$/,
  /^已有普通牌能压住，不必动用炸弹$/,
  /^有普通炸弹可压，不宜亮同花顺$/,
  /同花顺留给关键控权/,
  /^局面尚早，同花顺不压/,
  /对手连对不值得消耗同花顺/,
  /同花顺战略保留/,
  /^非紧急局面慎用同花顺拦炸$/,
  /^勿用高炸拦低炸/,
  /^队友本墩已出过牌，不必强行亮同花顺$/,
  /^队友本墩已出过牌，不必叠炸拦对手$/,
  /^【P10】队友本墩已出过牌，不必叠更大炸$/,
  /^【P10】队友占牌，正常让牌不压队友$/,
  /对手普通牌型，手牌仍多不必动炸/,
];

/** 推荐出牌时已入选时不应展示的拆结构惩罚 */
const ANTI_STRUCTURE_PENALTY_PATTERNS = [
  /^拆三张.+组其他牌型代价偏高$/,
  /^拆三张.+出对子代价较高$/,
  /^拆钢板.+组其他牌型代价过高$/,
  /^拆钢板.+出对子代价过高$/,
];

/** 推荐单张时已入选则不得展示的「不宜出单」类罚分/结构句（tempo-lead / P1 等） */
const ANTI_SINGLE_PLAY_REASON_PATTERNS = [
  /不宜先打单张/,
  /不宜裸单/,
  /有成组牌可减手.*不宜/,
  /不宜拆对.+出单张/,
  /不宜拆.+出单张/,
  /接风优先对子减手，比散单更高效/,
  /残局接风有成组牌可减手/,
  /^【P1】.*不宜拆.+出单张$/,
];

/** 推荐炸弹时支持动作的职责类理由（与 ANTI_BOMB 并存时不算矛盾） */
const BOMB_DUTY_REASON_PATTERNS = [
  /满张炸弹控牌权/,
  /压顺子需炸弹/,
  /只有炸弹能压，应抢牌权/,
  /应满张出炸控权/,
  /无更大.*可压，需用炸弹抢牌权/,
  /无可用更大普通牌可压/,
  /对手同花顺，用更大同花顺抢回牌权/,
  /队友冲刺，满张炸夺权/,
];

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

export function isAntiPassReason(reason) {
  const raw = String(reason ?? "").trim();
  if (!raw) return false;
  return matchesAny(raw, ANTI_PASS_REASON_PATTERNS);
}

export function isAntiRegularPlayReason(reason) {
  const raw = String(reason ?? "").trim();
  if (!raw) return false;
  return matchesAny(raw, ANTI_REGULAR_PLAY_REASON_PATTERNS);
}

export function isAntiBombReason(reason) {
  const raw = String(reason ?? "").trim();
  if (!raw) return false;
  return matchesAny(raw, ANTI_BOMB_REASON_PATTERNS);
}

export function isAntiStructurePenaltyReason(reason) {
  const raw = String(reason ?? "").trim();
  if (!raw) return false;
  return matchesAny(raw, ANTI_STRUCTURE_PENALTY_PATTERNS);
}

export function isAntiSingleReason(reason) {
  const raw = String(reason ?? "").trim();
  if (!raw) return false;
  return matchesAny(raw, ANTI_SINGLE_PLAY_REASON_PATTERNS);
}

export function isBombDutyReason(reason) {
  const raw = String(reason ?? "").trim();
  if (!raw) return false;
  return matchesAny(raw, BOMB_DUTY_REASON_PATTERNS);
}

/** 单条理由是否与给定出牌方向矛盾 */
export function reasonContradictsPlay(reason, play, { previousPlay = null } = {}) {
  if (!play || !reason) return false;
  const raw = String(reason).trim();
  if (!raw) return false;

  if (
    previousPlay
    && previousPlay.type !== PLAY_TYPES.pass
    && play.type !== PLAY_TYPES.pass
    && !canBeat(play, previousPlay)
    && isBeatClaimReason(raw)
  ) {
    return true;
  }

  if (play.type === PLAY_TYPES.pass) {
    return isAntiPassReason(raw);
  }
  if (BOMB_TYPES.has(play.type)) {
    if (isBombDutyReason(raw)) return false;
    return isAntiBombReason(raw);
  }
  if (isAntiStructurePenaltyReason(raw)) return true;
  if (play.type === PLAY_TYPES.single && isAntiSingleReason(raw)) return true;
  return isAntiRegularPlayReason(raw);
}

/** 候选 Top 推荐是否与理由列表矛盾（供 guards / 测试） */
export function playContradictsReasons(play, reasons, { previousPlay = null } = {}) {
  const list = reasons ?? [];
  if (!play) return true;
  if (
    previousPlay
    && previousPlay.type !== PLAY_TYPES.pass
    && play.type !== PLAY_TYPES.pass
    && !canBeat(play, previousPlay)
    && list.some((r) => isBeatClaimReason(r))
  ) {
    return true;
  }
  if (play.type === PLAY_TYPES.pass) {
    return list.some((r) => isAntiPassReason(r));
  }
  if (BOMB_TYPES.has(play.type)) {
    if (list.some((r) => isBombDutyReason(r))) return false;
    return list.some((r) => isAntiBombReason(r));
  }
  if (play.type === PLAY_TYPES.single) {
    return list.some((r) => isAntiSingleReason(r) || isAntiRegularPlayReason(r) || isAntiStructurePenaltyReason(r));
  }
  return list.some((r) => isAntiRegularPlayReason(r) || isAntiStructurePenaltyReason(r));
}

function passFallbackReason(previousPlay) {
  if (previousPlay?.type === PLAY_TYPES.pair) {
    return "只有炸弹能压，手牌仍多保留炸弹，过牌等循环";
  }
  if (previousPlay?.type === PLAY_TYPES.consecutivePairs) {
    return "无更大连对可压，手牌仍多保留炸弹，过牌等循环";
  }
  if (previousPlay?.type === PLAY_TYPES.single) {
    return "无更大单张可压，只能过牌";
  }
  if (previousPlay?.type === PLAY_TYPES.straight) {
    return "须压顺子且只有炸弹能压，手牌仍多保留炸弹，过牌等循环";
  }
  if (previousPlay && BOMB_TYPES.has(previousPlay.type)) {
    return "对手已亮炸，无更大炸可跟，正常过牌";
  }
  return "这手过牌保留牌力，等更好时机";
}

function bombFallbackReason(play, previousPlay) {
  if (previousPlay?.type === PLAY_TYPES.consecutivePairs) {
    return "无更大连对可压，需用炸弹抢牌权";
  }
  if (previousPlay?.type === PLAY_TYPES.single) {
    return "无更大单张可压，需用炸弹抢牌权";
  }
  if (previousPlay?.type === PLAY_TYPES.pair) {
    return "无更大对子可压，需用炸弹抢牌权";
  }
  return "无可用更大普通牌可压，需用炸弹抢牌权";
}

function singleFallbackReason(play, previousPlay) {
  if (!previousPlay || previousPlay.type === PLAY_TYPES.pass) {
    return "接风可打小单试探减手";
  }
  if (previousPlay.type === PLAY_TYPES.single) {
    if (!canBeat(play, previousPlay)) {
      return "这手压不过上家，保留牌力";
    }
    return "跟住对手单张，避免其连续占牌";
  }
  if (!canBeat(play, previousPlay)) {
    return "这手压不过上家，保留牌力";
  }
  return "跟牌抢回牌权";
}

function regularFallbackReason(play, previousPlay) {
  if (play.type === PLAY_TYPES.single) {
    return singleFallbackReason(play, previousPlay);
  }
  if (
    previousPlay
    && previousPlay.type !== PLAY_TYPES.pass
    && !canBeat(play, previousPlay)
  ) {
    return "这手压不过上家，保留牌力";
  }
  if (previousPlay?.type === PLAY_TYPES.pair && play.type === PLAY_TYPES.pair) {
    return "用最小对子压住对手对子，打断接风";
  }
  if (previousPlay?.type === PLAY_TYPES.single && play.type === PLAY_TYPES.single) {
    return singleFallbackReason(play, previousPlay);
  }
  if (previousPlay?.type === PLAY_TYPES.consecutivePairs && play.type === PLAY_TYPES.consecutivePairs) {
    return "用最小连对压住对手连对，打断接风";
  }
  return "跟牌抢回牌权";
}

/** 理由是否全是「不宜出单」类罚分（无成组路线时不算） */
export function hasOnlyAntiSinglePenaltyReasons(reasons) {
  const list = (reasons ?? []).map((reason) => String(reason ?? "").trim()).filter(Boolean);
  if (list.length === 0) return false;
  return list.every((reason) => isAntiSingleReason(reason) || /^【P\d+】/.test(reason));
}

/**
 * 按最终推荐动作过滤矛盾理由；空列表时补一条与动作一致的用户向回退句。
 */
export function filterReasonsForPlay(reasons, play, { previousPlay = null } = {}) {
  const list = (reasons ?? []).filter(Boolean).map((r) => String(r).trim()).filter(Boolean);
  if (!play) return list;

  let filtered;
  if (play.type === PLAY_TYPES.pass) {
    filtered = list.filter((r) => !isAntiPassReason(r));
    if (filtered.length === 0) filtered = [passFallbackReason(previousPlay)];
  } else if (BOMB_TYPES.has(play.type)) {
    filtered = list.filter((r) => !isAntiBombReason(r));
    if (filtered.length === 0) filtered = [bombFallbackReason(play, previousPlay)];
  } else if (play.type === PLAY_TYPES.single) {
    filtered = list.filter((r) => !isAntiSingleReason(r) && !isAntiRegularPlayReason(r) && !isAntiStructurePenaltyReason(r));
    if (filtered.length === 0) filtered = [singleFallbackReason(play, previousPlay)];
  } else {
    filtered = list.filter((r) => !isAntiRegularPlayReason(r) && !isAntiStructurePenaltyReason(r));
    if (filtered.length === 0) filtered = [regularFallbackReason(play, previousPlay)];
  }

  return filtered;
}

/** 测试断言：推荐与理由不得矛盾 */
export function assertReasonConsistency(play, reasons, label = "推荐", { previousPlay = null } = {}) {
  if (playContradictsReasons(play, reasons, { previousPlay })) {
    throw new Error(
      `${label}与理由矛盾：${play?.label ?? play?.type} ← ${(reasons ?? []).join("；")}`,
    );
  }
}
