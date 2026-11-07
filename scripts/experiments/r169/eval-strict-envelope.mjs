/**
 * Single conservative deterministic eval envelope (baseline + candidate @ flag0).
 * Online/production: unset → search/index.js keeps Date.now beam (unchanged).
 *
 * Budget semantics (search/index.js beamSearch):
 * - GD_SEARCH_BEAM_FIXED_NODES / default cap 128 limits **how many legal root candidates** get one shortRollout each.
 * - Inner rollout work per candidate is fixed at depth=1 with full heuristic scan of legal replies (no wall clock).
 * - Fixture demos 10/34 are wall-sensitivity only — do not infer 512-deal validity from frozen rows alone.
 */
import { collectGdEnv } from './eval-meta.mjs';
import { sharedSearchManifest } from './search-beam-manifest.mjs';

/** Max beam shortRollout candidates scored per decide when GD_SEARCH_NO_WALLCLOCK=1 (no per-fixture tune). */
export const SEARCH_BEAM_NODE_CAP = 128;

export const STRICT_EVAL_WALLCLOCK = {
  GD_R95: '5',
  GD_ENDGAME_NO_WALLCLOCK: '1',
  GD_HANDPLAN_NO_WALLCLOCK: '1',
  GD_R169: '0',
  GD_R170: '0',
};

export const STRICT_EVAL_SEARCH = {
  GD_SEARCH_NO_WALLCLOCK: '1',
  /** Optional override; default cap in search/index.js is SEARCH_BEAM_NODE_CAP when unset. */
  GD_SEARCH_BEAM_FIXED_NODES: String(SEARCH_BEAM_NODE_CAP),
};

export const STRICT_EVAL_FULL = { ...STRICT_EVAL_WALLCLOCK, ...STRICT_EVAL_SEARCH };

/** Apply to process.env (does not clear unrelated vars). */
export function applyStrictEvalEnvelope(env = process.env) {
  Object.assign(env, STRICT_EVAL_FULL);
  return env;
}

export function strictEnvelopeRecord(env = process.env) {
  const gd = collectGdEnv(env);
  const keys = [...Object.keys(STRICT_EVAL_FULL)].sort();
  const parity = keys.every((k) => gd[k] === STRICT_EVAL_FULL[k]);
  return {
    expected: STRICT_EVAL_FULL,
    actual: Object.fromEntries(keys.map((k) => [k, gd[k] ?? null])),
    parityOk: parity,
    sharedSearch: sharedSearchManifest(),
    passthrough: {
      GD_SEARCH_NO_WALLCLOCK: 'unset → production wallMs beam; 1 → fixed root-candidate cap (no Date.now in beam loop)',
      GD_SEARCH_BEAM_FIXED_NODES: `optional root-candidate cap; default ${SEARCH_BEAM_NODE_CAP} when NO_WALLCLOCK=1`,
      GD_EVAL_BEAM_TIMEMS: 'eval/instrumented only; forces wall path for sensitivity tests',
    },
    budgetSemantics: {
      beamBudgetUnit: 'rootCandidatesScored',
      shortRolloutDepth: 1,
      shortRolloutWallClock: false,
      commonEvalCap: SEARCH_BEAM_NODE_CAP,
    },
  };
}
