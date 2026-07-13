/**
 * 队友推断（架构 v3）— T5/T7 扩展
 * 读 route-memory + 队友出牌历史，推断强路、送听/送桥候选。
 */
import { PLAY_TYPES } from "../engine/play-types.mjs";
import {
  partnerHandCount,
  partnerOpeningRoute,
} from "./context-helpers.mjs";
import { teammateIndex } from "./seat-utils.mjs";
import { getRouteContext, dominantRoute } from "./route-memory.mjs";

const BRIDGE_TYPES = new Set([
  PLAY_TYPES.pair,
  PLAY_TYPES.tripleWithPair,
  PLAY_TYPES.consecutivePairs,
]);

/**
 * 推断队友当前强路与听牌倾向。
 */
export function inferPartnerStrength(state, playerIndex = 0) {
  const routeCtx = getRouteContext(state, playerIndex);
  const opening = partnerOpeningRoute({ state, playerIndex });
  const partnerMem = routeCtx.partner;
  const dominant = routeCtx.partnerDominant;
  const handCount = partnerHandCount({ state, playerIndex });

  const strongRoutes = (partnerMem?.openings ?? [])
    .filter((o) => BRIDGE_TYPES.has(o.type))
    .map((o) => o.type);

  const listening = handCount > 0 && handCount <= 8 && dominant
    && BRIDGE_TYPES.has(dominant.type);

  return {
    opening,
    dominant,
    strongRoutes,
    handCount,
    listening,
    ownership: routeCtx.partnerOwnership,
    strongRoute: routeCtx.partnerStrongRoute,
    /** 队友是否在走单张弱路 */
    weakSingleRoute: dominant?.type === PLAY_TYPES.single && (dominant.count ?? 0) >= 2,
  };
}

/**
 * 助攻角色：是否应送桥（出与队友强路同型牌）。
 */
export function shouldSendBridge(tableContext) {
  const state = tableContext.state;
  const playerIndex = tableContext.playerIndex ?? state?.currentPlayerIndex ?? 0;
  const profile = tableContext.handProfile;
  if (profile?.role !== "support") return false;
  if (!tableContext.isOpening) return false;

  const partner = inferPartnerStrength(state, playerIndex);
  return partner.listening || partner.strongRoute;
}

/**
 * 送听/送桥候选加分用的牌路类型列表。
 */
export function bridgeTargetTypes(state, playerIndex = 0) {
  const partner = inferPartnerStrength(state, playerIndex);
  const types = new Set();
  if (partner.opening?.type) types.add(partner.opening.type);
  if (partner.dominant?.type) types.add(partner.dominant.type);
  for (const t of partner.strongRoutes) types.add(t);
  return [...types];
}

/**
 * 导出完整队友推断上下文。
 */
export function getPartnerInference(state, playerIndex = 0) {
  const partnerIndex = teammateIndex(playerIndex);
  const strength = inferPartnerStrength(state, playerIndex);
  const routeCtx = getRouteContext(state, playerIndex);

  return {
    partnerIndex,
    strength,
    routeContext: routeCtx,
    sendBridge: strength.listening || strength.strongRoute,
    bridgeTypes: bridgeTargetTypes(state, playerIndex),
    /** T5 送对家精准：队友首发牌路 */
    openingRoute: strength.opening,
    /** 队友是否像主攻（强路 + 少张） */
    partnerLikelyMainAttack: strength.strongRoute && strength.handCount <= 10,
  };
}

/**
 * 评估候选是否匹配送桥目标。
 */
export function matchesBridgeTarget(candidate, bridgeTypes) {
  if (!candidate || candidate.type === PLAY_TYPES.pass) return false;
  return bridgeTypes.includes(candidate.type);
}
