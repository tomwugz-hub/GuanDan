/** Shared logic for tiny-paired-control (testable; no arena spawn in reuse-only). */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fingerprintDeals } from '../../../selfplay/arena.mjs';
import { flattenRawDecisions } from './beam-work-record.mjs';

export const EXIT = {
  OK: 0,
  MISSING_FILES: 11,
  PARITY_MISMATCH: 10,
  TELEMETRY_LEGACY: 20,
  WALL_CUTOFF: 21,
  EMPTY_DECISIONS: 12,
  RUNTIME_ERROR: 1,
};

export const DEFAULT_CONFIGS = [
  { tag: 'old-old', a: 'r169-cap2-base', b: 'r169-cap2-base' },
  { tag: 'cur-flag0', a: 'r169-cap2-current', b: 'r169-cap2-base' },
];

export function rawPath(outdir, cfg, tag, seed0, deals) {
  return path.join(outdir, `arena-${cfg.tag}-${tag}-s${seed0}-d${deals}.json`);
}

export function listRequiredRawPaths(outdir, seed0, deals, configs = DEFAULT_CONFIGS) {
  return configs.flatMap((cfg) => ['run1', 'run2'].map((tag) => ({
    config: cfg.tag,
    run: tag,
    path: rawPath(outdir, cfg, tag, seed0, deals),
  })));
}

/** @returns {{ ok: true } | { ok: false, missing: string[], required: string[] }} */
export function validateReuseOnlyPaths(outdir, seed0, deals, configs = DEFAULT_CONFIGS) {
  const required = listRequiredRawPaths(outdir, seed0, deals, configs);
  const missing = required.filter((r) => !existsSync(r.path)).map((r) => r.path);
  if (missing.length) {
    return { ok: false, missing, required: required.map((r) => r.path) };
  }
  return { ok: true };
}

function actionFingerprintLine(d) {
  return JSON.stringify({
    id: d.id, move: d.moveStr, tags: d.tags, hand: d.hand, prev: d.prevStr2, nCands: d.nCands,
  });
}

export function globalActionFp(payload) {
  const decisions = flattenRawDecisions(payload);
  if (!decisions.length) {
    return { error: 'empty_decisions', sha256: null, n: 0 };
  }
  const lines = decisions.map(actionFingerprintLine).sort();
  return {
    error: null,
    n: decisions.length,
    sha256: createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex'),
  };
}

export function beamTelemetrySummary(payload) {
  const decisions = flattenRawDecisions(payload);
  const withField = decisions.filter((d) => d.searchBeamWork != null);
  const collected = decisions.filter((d) => d.searchBeamWork?.collected === true);
  const wallCut = collected.filter((d) => d.searchBeamWork.wallCutoff);
  const legacy = decisions.length > 0 && withField.length === 0;
  const fixed = collected.filter((d) => d.searchBeamWork.budgetMode === 'fixedNodes');
  const fullRoot = fixed.filter((d) => {
    const w = d.searchBeamWork;
    return w.scoredN != null && w.rootLegalN != null && w.scoredN >= w.rootLegalN;
  });
  return {
    legacyDumpMissingSearchBeamWork: legacy,
    decisionN: decisions.length,
    beamCollectedN: collected.length,
    wallCutoffN: wallCut.length,
    fixedNodesFullRootScoringN: fullRoot.length,
    strictEnvelopeNoWallCutoff: legacy ? null : wallCut.length === 0,
  };
}

export function buildPairReport(cfg, r1, r2) {
  const fp1 = fingerprintDeals(r1.deals);
  const fp2 = fingerprintDeals(r2.deals);
  const afp1 = globalActionFp(r1);
  const afp2 = globalActionFp(r2);
  return {
    config: cfg.tag,
    a: cfg.a,
    b: cfg.b,
    dealFp: { run1: fp1, run2: fp2, same: fp1 === fp2 },
    actionFp: { run1: afp1.sha256, run2: afp2.sha256, same: afp1.sha256 === afp2.sha256, decisionN: afp1.n },
    actionFpErrors: { run1: afp1.error, run2: afp2.error },
    metaEnvSame: !!(r1.meta?.env && JSON.stringify(r1.meta.env) === JSON.stringify(r2.meta.env)),
    sharedSearch: r1.meta?.sharedSearch,
    wallMs: { run1: r1.meta?.wallMs, run2: r2.meta?.wallMs },
    beam: { run1: beamTelemetrySummary(r1), run2: beamTelemetrySummary(r2) },
  };
}

/** Distinct machine verdict: parity vs telemetry (not a single ambiguous code 2). */
export function computeVerdict(pairs) {
  const parityOk = pairs.every((p) => p.dealFp.same && p.actionFp.same);
  const emptyDec = pairs.some((p) => p.actionFpErrors.run1 || p.actionFpErrors.run2);
  if (emptyDec) return { exitCode: EXIT.EMPTY_DECISIONS, reason: 'empty_decisions', parityOk: false, telemetryOk: null };
  if (!parityOk) return { exitCode: EXIT.PARITY_MISMATCH, reason: 'parity_mismatch', parityOk: false, telemetryOk: null };
  const anyLegacy = pairs.some((p) =>
    p.beam.run1.legacyDumpMissingSearchBeamWork || p.beam.run2.legacyDumpMissingSearchBeamWork);
  const anyWall = pairs.some((p) => p.beam.run1.wallCutoffN > 0 || p.beam.run2.wallCutoffN > 0);
  if (anyLegacy) {
    return { exitCode: EXIT.TELEMETRY_LEGACY, reason: 'parity_ok_telemetry_legacy_missing', parityOk: true, telemetryOk: false };
  }
  if (anyWall) {
    return { exitCode: EXIT.WALL_CUTOFF, reason: 'parity_ok_wall_cutoff_observed', parityOk: true, telemetryOk: false };
  }
  return { exitCode: EXIT.OK, reason: 'parity_ok_telemetry_ok', parityOk: true, telemetryOk: true };
}
