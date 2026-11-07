/** Eval-only: normalize search/index.js beam budget into arena raw decision rows. */
export function shouldCollectBeamWork(env = process.env) {
  return env.GD_EVAL_BEAM_WORK_COLLECT === '1' || env.GD_EVAL_BEAM_WORK_TRACE === '1';
}

export function clearBeamWorkSlot() {
  if (!shouldCollectBeamWork()) return;
  try { delete globalThis.__GD_SEARCH_BEAM_WORK__; } catch { /* eval */ }
}

/** @param {object|null|undefined} raw last __GD_SEARCH_BEAM_WORK__ from beamSearch */
export function normalizeBeamWorkForRecord(raw, searchModuleSha256 = null) {
  if (!raw) {
    return { collected: false, reason: 'noBeamSearchThisDecide' };
  }
  return {
    collected: true,
    budgetMode: raw.mode,
    budgetUnit: raw.budgetUnit ?? 'rootCandidatesScored',
    rootLegalN: raw.candidateN ?? null,
    scoredN: raw.scoredN ?? null,
    cap: raw.maxNodes ?? null,
    shortRolloutDepth: raw.shortRolloutDepth ?? 1,
    wallCutoff: !!raw.wallCutoff,
    nodeCutoff: !!raw.nodeCutoff,
    searchModuleSha256: searchModuleSha256 ?? null,
  };
}

export function flattenRawDecisions(payload) {
  if (!payload?.rawWorkers?.length) return [];
  return payload.rawWorkers.flatMap((w) => w.decisions || []);
}
