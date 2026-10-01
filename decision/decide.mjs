import { sourceDecisionCandidates } from "./candidates.mjs";
import { renderDecisionExplanation } from "./explain.mjs";
import { buildHandFacts } from "./facts.mjs";
import { filterHardInvariants } from "./invariants.mjs";
import { rankDecisionCandidates } from "./rank.mjs";
import { createDecisionResult } from "./result.mjs";
import { decisionPlaySignature, decisionStateSignature } from "./signature.mjs";
import { skillTagsForEvidence } from "./skills.mjs";
import { buildDecisionState } from "./state.mjs";

export const DECISION_CORE_REVISION = 6;

export function decide({ state: gameState, playerIndex = gameState?.currentPlayerIndex } = {}) {
  try {
    const state = buildDecisionState(gameState, playerIndex);
    const candidates = sourceDecisionCandidates(state);
    const handFacts = buildHandFacts(state, { candidates });
    const filtered = filterHardInvariants(candidates, state, handFacts);
    if (filtered.error) {
      return createDecisionResult({
        status: "error",
        rejectedByInvariant: filtered.rejected,
        diagnostics: {
          stateSignature: decisionStateSignature(state),
          candidateCount: candidates.length,
          acceptedCount: 0,
          decisionRevision: DECISION_CORE_REVISION,
          rankingMode: "lexicographic-v3",
        },
        error: filtered.error,
      });
    }

    const ranked = rankDecisionCandidates(state, filtered.accepted, handFacts);
    const winner = ranked[0];
    return createDecisionResult({
      status: "ok",
      top1: winner.candidate,
      alternatives: ranked.slice(1, 4).map((item) => ({
        candidate: item.candidate,
        evidence: item.evidence,
        rankTuple: item.rankTuple,
      })),
      signature: decisionPlaySignature(winner.candidate),
      evidence: winner.evidence,
      explanation: renderDecisionExplanation(winner.evidence),
      rejectedByInvariant: filtered.rejected,
      skillTags: skillTagsForEvidence(winner.evidence),
      diagnostics: {
        stateSignature: decisionStateSignature(state),
        candidateCount: candidates.length,
        acceptedCount: filtered.accepted.length,
        decisionRevision: DECISION_CORE_REVISION,
        rankingMode: "lexicographic-v3",
      },
    });
  } catch (error) {
    return createDecisionResult({
      status: "error",
      diagnostics: {
        decisionRevision: DECISION_CORE_REVISION,
        rankingMode: "lexicographic-v3",
      },
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
