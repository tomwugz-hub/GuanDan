import { PLAY_TYPES } from "../engine/play-types.mjs";
import { inferTripleWithPairKickerRank, breaksBombIntegrity } from "./scorers/structure.mjs";
import { resolveLastActivePlayerIndex, shouldRobotYieldPassToPartner } from "./table-context.mjs";

function resolvedCandidate(item) {
  return item?.candidate ?? item;
}

function isPartnerSeat(playerIndex, lastActivePlayerIndex) {
  if (!Number.isInteger(playerIndex) || !Number.isInteger(lastActivePlayerIndex)) return false;
  return (playerIndex + 2) % 4 === lastActivePlayerIndex;
}

function partnerOwnsTrick(ctx = {}) {
  if (
    Object.prototype.hasOwnProperty.call(ctx, "previousPlay")
    && (!ctx.previousPlay || ctx.previousPlay.type === PLAY_TYPES.pass)
  ) {
    return false;
  }
  const playerIndex = ctx.playerIndex ?? ctx.state?.currentPlayerIndex;
  const lastActivePlayerIndex = ctx.state
    ? resolveLastActivePlayerIndex(ctx)
    : ctx.lastActivePlayerIndex
    ?? ctx.tableBefore?.lastActivePlayerIndex;
  if (Number.isInteger(playerIndex) && Number.isInteger(lastActivePlayerIndex)) {
    return isPartnerSeat(playerIndex, lastActivePlayerIndex);
  }
  return ctx.partnerOwnsTrick === true;
}

function mustYieldToPartner(ctx, hand) {
  if (!partnerOwnsTrick(ctx)) return false;
  if (ctx.allowBeatPartner === true) return false;
  if (typeof ctx.partnerYieldRequired === "boolean") return ctx.partnerYieldRequired;
  if (ctx.state) {
    return shouldRobotYieldPassToPartner({ ...ctx, hand, partnerOwnsTrick: true });
  }
  // Timeline/audit records do not contain a complete engine state. In that
  // conservative context, overtaking the opposite-seat partner is auditable.
  return true;
}

/** Return stable audit codes for non-negotiable Top1 rules. */
export function detectHardInvariantCodes(candidateInput, hand = [], levelRank = "2", ctx = {}) {
  const candidate = resolvedCandidate(candidateInput);
  if (!candidate || candidate.type === PLAY_TYPES.pass) return [];

  const codes = [];
  if (mustYieldToPartner(ctx, hand)) {
    codes.push("beat-partner");
  }
  if (
    candidate.type === PLAY_TYPES.tripleWithPair
    && inferTripleWithPairKickerRank(candidate) === levelRank
  ) {
    codes.push("twp-level-kicker");
  }
  if (
    (candidate.cards?.length ?? 0) !== hand.length
    && breaksBombIntegrity(candidate, hand, levelRank, ctx)
  ) {
    codes.push("split-bomb");
  }
  return codes;
}

/**
 * Remove candidates that can never occupy Top1. The original item shape and
 * ordering are preserved, so this also accepts scored `{ candidate, ... }` rows.
 */
export function filterHardInvariants(candidates, hand = [], levelRank = "2", ctx = {}) {
  return (candidates ?? []).filter(
    (item) => detectHardInvariantCodes(item, hand, levelRank, ctx).length === 0,
  );
}
