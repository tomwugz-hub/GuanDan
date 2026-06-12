import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getMlBlendWeight } from "./ml-policy.mjs";
import { isBombOnlyBeatContext, principleMlVetoFactor, shouldVetoBombOnlyPass } from "./principles.mjs";
import { shouldYieldPassToPartner } from "./table-context.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);
const TEMPO_LEAD_TYPES = new Set([
  PLAY_TYPES.tripleWithPair,
  PLAY_TYPES.triple,
  PLAY_TYPES.straight,
  PLAY_TYPES.consecutivePairs,
  PLAY_TYPES.plane,
]);

/**
 * 智能融合：仅在「需压牌 / 高危险」等局面放大 ML，接风与开局限制空炸。
 */
export function resolveMlFusionMode(explicitMode) {
  if (explicitMode === "off" || explicitMode === false) return "off";
  if (explicitMode === "force" || explicitMode === "on") return "force";
  return "smart";
}

export function candidateMlBlendWeight(candidate, tableContext, fusionMode = "smart", scoredItem = null) {
  const base = getMlBlendWeight();
  if (fusionMode === "off") return 0;
  if (fusionMode === "force") return base;

  const veto = principleMlVetoFactor(
    scoredItem?.doctrineEnforced || scoredItem?.principleConflict
      ? {
        hasStrongConflict: !!scoredItem.principleConflict,
        doctrineEnforced: !!scoredItem.doctrineEnforced,
      }
      : null,
    tableContext,
    candidate,
  );
  if (veto === 0) return 0;
  const scaledBase = Math.floor(base * veto);

  const { leadMode, opponentActive, hasRegularWinner, danger = 0 } = tableContext;

  if (BOMB_TYPES.has(candidate.type)) {
    if (leadMode === "catch-wind" || leadMode === "fresh-open") return 0;
    if (opponentActive && hasRegularWinner) return Math.min(scaledBase, 900);
    const prev = tableContext.previousPlay;
    if (opponentActive && !hasRegularWinner && prev && BOMB_TYPES.has(prev.type)) {
      return Math.min(scaledBase, 350);
    }
    return Math.min(scaledBase, 2200);
  }

  if (leadMode === "catch-wind") {
    if (TEMPO_LEAD_TYPES.has(candidate.type)) return Math.min(scaledBase, 2400);
    return Math.min(scaledBase, 600);
  }

  if (leadMode === "fresh-open") {
    if (TEMPO_LEAD_TYPES.has(candidate.type)) return Math.min(scaledBase, 1200);
    return Math.min(scaledBase, 400);
  }

  if (opponentActive) {
    const scale = danger >= 2 ? 1 : danger >= 1 ? 0.85 : 0.72;
    const prev = tableContext.previousPlay ?? tableContext.state?.lastActivePlay;
    if (candidate.type === PLAY_TYPES.pass && !hasRegularWinner) {
      if (prev && BOMB_TYPES.has(prev.type)) return 0;
      if (
        isBombOnlyBeatContext(tableContext)
        && !shouldYieldPassToPartner(tableContext)
        && shouldVetoBombOnlyPass(
          tableContext,
          tableContext.hand,
          prev ?? tableContext.previousPlay,
        )
      ) {
        return 0;
      }
      return Math.min(scaledBase, 500);
    }
    if (candidate.type === PLAY_TYPES.pass && prev?.type === PLAY_TYPES.straightFlush) {
      return 0;
    }
    if (hasRegularWinner && TEMPO_LEAD_TYPES.has(candidate.type)) return scaledBase * scale;
    return scaledBase * scale;
  }

  return Math.min(scaledBase, 1500);
}

export function fusionReasonSuffix(tableContext, fusionMode) {
  if (fusionMode === "off") return null;
  if (fusionMode === "force") return "ML 全量融合";
  if (tableContext.leadMode === "catch-wind") return "智能融合：接风减手优先，炸弹不参与 ML 加权";
  if (tableContext.leadMode === "fresh-open") return "智能融合：开局限制 ML 推炸";
  if (tableContext.opponentActive) return "智能融合：压牌局面启用 ML";
  return "智能融合：本局面弱化 ML";
}
