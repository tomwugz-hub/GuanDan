import { PLAY_TYPES } from "../engine/play-types.mjs";
import {
  BOMB_TYPES,
  filterReasonsForPlay,
  isAntiBombReason,
  playContradictsReasons,
} from "./reason-consistency.mjs";

/** 去重比较用：去掉原则码前缀，便于 scorer 句与教纲句对齐 */
function stripPrinciplePrefix(text) {
  return String(text ?? "").trim().replace(/^【P\d+】/, "").trim();
}

/** 较短句是否被较长句包含或为较长句前缀（语义重复） */
function reasonOverlaps(shorter, longer) {
  const a = stripPrinciplePrefix(shorter);
  const b = stripPrinciplePrefix(longer);
  if (!a || !b || a === b || b.length <= a.length) return false;
  if (b.startsWith(a)) return true;
  // 较短句至少 6 字且为较长句子串，避免「过牌」等短词误杀
  return a.length >= 6 && b.includes(a);
}

/** 子串/同前缀重叠去重：多 scorer 叠加时只保留更完整一句 */
export function dedupeOverlappingReasonStrings(reasons) {
  const list = (reasons ?? []).map((r) => String(r ?? "").trim()).filter(Boolean);
  if (list.length <= 1) return list;
  return list.filter((current, i) => !list.some((other, j) => (
    j !== i && other.length > current.length && reasonOverlaps(current, other)
  )));
}

/** 精确去重 + 重叠去重（principles 与 scorer 可能重复贡献近义句） */
export function dedupeReasonStrings(reasons) {
  const seen = new Set();
  const out = [];
  for (const reason of reasons ?? []) {
    const key = String(reason ?? "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return dedupeOverlappingReasonStrings(out);
}

/** 教纲执法内部标记，不向用户展示 */
export function isEnforcementReason(reason) {
  return /^【执法】/.test(String(reason ?? "").trim());
}

/** 教纲原则码句（【P1】等）：参与评分/block，不向用户展示 */
export function isDoctrinePrincipleReason(reason) {
  return /^【P\d+】/.test(String(reason ?? "").trim());
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
    if (/纯四炸够压|不宜拆厚炸/.test(text)) {
      return "【P7】有纯四炸够压，不宜拆厚炸出四炸";
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
 * 推荐炸弹时剔除「不必动用炸弹」等惩罚项；推荐过牌时剔除「不宜过牌」等惩罚项。
 */
export function alignReasonsForPlay(reasons, play, { previousPlay = null } = {}) {
  const list = dedupeReasonStrings((reasons ?? []).filter(Boolean));
  return filterReasonsForPlay(list, play, { previousPlay });
}

export {
  BOMB_TYPES,
  isAntiBombReason,
  playContradictsReasons,
};
