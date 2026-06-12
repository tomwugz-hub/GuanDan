import { PLAY_TYPES } from "../engine/play-types.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

/** 与「推荐出炸弹」矛盾的惩罚/保留类理由 */
const ANTI_BOMB_REASONS = [
  /^炸弹是牌权资源，非必要不消耗$/,
  /^已有普通牌能压住，不必动用炸弹$/,
  /^同花顺留给关键控权/,
  /^局面尚早，同花顺不压/,
  /^对手连对不值得消耗同花顺/,
  /^同花顺战略保留/,
  /^非紧急局面慎用同花顺拦炸/,
  /^勿用高炸拦低炸/,
  /^队友本墩已出过牌，不必强行亮同花顺$/,
];

function isAntiBombReason(reason) {
  const raw = String(reason ?? "").trim();
  return ANTI_BOMB_REASONS.some((pattern) => pattern.test(raw));
}

/** 与最终推荐方向矛盾的拆结构惩罚文案（已入选时不应展示） */
const ANTI_STRUCTURE_PENALTY_REASONS = [
  /^拆三张.+组其他牌型代价偏高$/,
  /^拆三张.+出对子代价较高$/,
  /^拆钢板.+组其他牌型代价过高$/,
  /^拆钢板.+出对子代价过高$/,
];

function isAntiStructurePenaltyReason(reason) {
  const raw = String(reason ?? "").trim();
  return ANTI_STRUCTURE_PENALTY_REASONS.some((pattern) => pattern.test(raw));
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

/** 相同文案只保留一条（principles 与 opponent-pressure 可能重复贡献 P7 等理由） */
export function dedupeReasonStrings(reasons) {
  const seen = new Set();
  const out = [];
  for (const reason of reasons ?? []) {
    const key = String(reason ?? "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** 教纲执法内部标记，不向用户展示 */
export function isEnforcementReason(reason) {
  return /^【执法】/.test(String(reason ?? "").trim());
}

/** 从理由文案提取原则码（如 P7） */
export function extractPrincipleCode(reason) {
  const match = String(reason ?? "").trim().match(/【(P\d+)】/);
  return match?.[1] ?? null;
}

/** 同一原则码的多条近义理由归并为一条最简用户向文案 */
function canonicalPrincipleReason(code, reason) {
  const text = String(reason ?? "").trim();
  if (code === "P7") {
    if (/满张炸弹控牌权|四炸易被反压/.test(text)) {
      return "【P7】满张炸弹控牌权，四炸易被反压";
    }
    if (/拆炸|超过四张|满张出炸控/.test(text)) {
      return "【P7】拆炸出四炸牌力弱，应满张出炸控权";
    }
    if (/四炸够压顺子|不必六炸/.test(text)) {
      return "【P7】四炸够压顺子，打完剩对子仍可减手";
    }
    if (/压顺子需炸弹|最小够压炸/.test(text)) {
      return "【P7】压顺子需炸弹抢牌权，优先最小够压炸";
    }
    if (/压王用小炸|不宜动用更大炸/.test(text)) {
      return "【P7】压王用小炸够用，不宜动用更大炸";
    }
    if (/纯炸弹够压|逢人配凑更大炸/.test(text)) {
      return "【P7】有纯炸弹够压，不宜逢人配凑更大炸";
    }
    if (/能用小炸就不用大炸|优先最小够压炸弹/.test(text)) {
      return "【P7】能用小炸就不用大炸，优先最小够压炸弹";
    }
  }
  return text;
}

export function mergeReasonsByPrincipleCode(reasons) {
  const seenCodes = new Set();
  const out = [];
  for (const reason of reasons ?? []) {
    const text = String(reason ?? "").trim();
    if (!text) continue;
    const code = extractPrincipleCode(text);
    if (!code) {
      out.push(text);
      continue;
    }
    if (seenCodes.has(code)) continue;
    seenCodes.add(code);
    out.push(canonicalPrincipleReason(code, text));
  }
  return out;
}

/**
 * 只保留与最终推荐出牌方向一致的理由。
 * 推荐炸弹时剔除「不必动用炸弹」等惩罚项文案。
 */
export function alignReasonsForPlay(reasons, play, { previousPlay = null } = {}) {
  const list = dedupeReasonStrings((reasons ?? []).filter(Boolean));
  if (!play || play.type === PLAY_TYPES.pass) return list;

  if (!BOMB_TYPES.has(play.type)) {
    return list.filter((reason) => !isAntiStructurePenaltyReason(reason));
  }

  const aligned = list.filter((reason) => !isAntiBombReason(reason));
  if (aligned.length > 0) return dedupeReasonStrings(aligned);
  return [bombFallbackReason(play, previousPlay)];
}

export { BOMB_TYPES, isAntiBombReason };
