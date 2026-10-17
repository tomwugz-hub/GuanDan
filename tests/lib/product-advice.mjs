/**
 * 发布门禁 / golden 与产品 UI 同源：统一决策内核 Top1。
 */
import { getHumanTurnAdvice } from "../../coach/human-advice.mjs";

export function productTop1(state, playerIndex = 0, options = {}) {
  const advice = getHumanTurnAdvice(state, playerIndex, options);
  if (advice.status !== "ok" || !advice.recommendation?.candidate) {
    throw new Error(advice.error?.message ?? "统一决策内核未返回 Top1");
  }
  return advice.recommendation;
}
