#!/usr/bin/env node
/**
 * 32-deal parity report from existing arena raw dumps (no redundant re-run).
 *   node tiny-paired-control.mjs --reuse-only [--outdir=...] [--seed0=26991000]
 * Optional: omit --reuse-only to spawn missing runs only.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprintDeals } from '../../../selfplay/arena.mjs';
import { STRICT_EVAL_FULL, strictEnvelopeRecord, applyStrictEvalEnvelope } from './eval-strict-envelope.mjs';
import { flattenRawDecisions } from './beam-work-record.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((s) => !s.includes('=') && s.startsWith('--')));
const args = Object.fromEntries(argv.filter((s) => s.includes('=')).map((s) => {
  const m = s.replace(/^--/, '').match(/^([^=]+)=(.*)$/s);
  return m ? [m[1], m[2]] : [s.replace(/^--/, ''), '1'];
}));

const REUSE_ONLY = flags.has('reuse-only');
const SEED0 = Number(args.seed0 ?? 26991000);
const DEALS = Number(args.deals ?? 32);
const MATCH_LEN = 8;
const OUTDIR = args.outdir || path.join(ROOT, 'selfplay/logs/r169-tiny-strict-envelope');
mkdirSync(OUTDIR, { recursive: true });

const configs = [
  { tag: 'old-old', a: 'r169-cap2-base', b: 'r169-cap2-base' },
  { tag: 'cur-flag0', a: 'r169-cap2-current', b: 'r169-cap2-base' },
];

function rawPath(cfg, tag) {
  return path.join(OUTDIR, `arena-${cfg.tag}-${tag}-s${SEED0}-d${DEALS}.json`);
}

function envClean() {
  const base = { ...process.env, ...STRICT_EVAL_FULL, GD_EVAL_BEAM_WORK_TRACE: '1', GD_EVAL_BEAM_WORK_COLLECT: '1' };
  return {
    HOME: base.HOME, PATH: base.PATH, LANG: base.LANG || 'C.UTF-8', TZ: base.TZ || '', USER: base.USER || '',
    ...Object.fromEntries(Object.entries(base).filter(([k]) => k.startsWith('GD_'))),
  };
}

function runArena(tag, cfg) {
  const raw = rawPath(cfg, tag);
  const r = spawnSync(process.execPath, [
    path.join(ROOT, 'selfplay/arena.mjs'),
    `--a=${cfg.a}`, `--b=${cfg.b}`, `--deals=${DEALS}`, `--seed0=${SEED0}`,
    '--tribute', `--matchLen=${MATCH_LEN}`, '--threads=1', '--collect=1', `--dump-raw=${raw}`,
  ], { env: envClean(), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`arena ${cfg.tag} ${tag}: ${r.stderr || r.stdout}`);
  return JSON.parse(readFileSync(raw, 'utf8'));
}

function loadRaw(tag, cfg) {
  const p = rawPath(cfg, tag);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

function actionFingerprintLine(d) {
  return JSON.stringify({
    id: d.id, move: d.moveStr, tags: d.tags, hand: d.hand, prev: d.prevStr2, nCands: d.nCands,
  });
}

function globalActionFp(payload) {
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

function beamTelemetrySummary(payload) {
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

function ensureRaw(tag, cfg) {
  let payload = loadRaw(tag, cfg);
  if (payload) return payload;
  if (REUSE_ONLY) throw new Error(`--reuse-only: missing ${rawPath(cfg, tag)}`);
  return runArena(tag, cfg);
}

async function main() {
  applyStrictEvalEnvelope();
  process.env.GD_EVAL_BEAM_WORK_COLLECT = '1';
  const report = {
    seed0: SEED0,
    deals: DEALS,
    reuseOnly: REUSE_ONLY,
    envelope: strictEnvelopeRecord(process.env),
    pairs: [],
  };
  for (const cfg of configs) {
    const r1 = ensureRaw('run1', cfg);
    const r2 = ensureRaw('run2', cfg);
    const fp1 = fingerprintDeals(r1.deals);
    const fp2 = fingerprintDeals(r2.deals);
    const afp1 = globalActionFp(r1);
    const afp2 = globalActionFp(r2);
    if (afp1.error || afp2.error) throw new Error(`action fingerprint refused: ${afp1.error || afp2.error}`);
    const metaOk = r1.meta?.env && JSON.stringify(r1.meta.env) === JSON.stringify(r2.meta.env);
    report.pairs.push({
      config: cfg.tag,
      a: cfg.a,
      b: cfg.b,
      dealFp: { run1: fp1, run2: fp2, same: fp1 === fp2 },
      actionFp: { run1: afp1.sha256, run2: afp2.sha256, same: afp1.sha256 === afp2.sha256, decisionN: afp1.n },
      metaEnvSame: metaOk,
      sharedSearch: r1.meta?.sharedSearch,
      wallMs: { run1: r1.meta?.wallMs, run2: r2.meta?.wallMs },
      beam: { run1: beamTelemetrySummary(r1), run2: beamTelemetrySummary(r2) },
    });
  }
  const out = path.join(OUTDIR, `tiny-paired-${SEED0}-d${DEALS}.json`);
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  const allSame = report.pairs.every((p) => p.dealFp.same && p.actionFp.same);
  const telemOk = report.pairs.every((p) => !p.beam.run1.legacyDumpMissingSearchBeamWork && p.beam.run1.strictEnvelopeNoWallCutoff);
  process.exit(allSame && telemOk ? 0 : telemOk ? 3 : 2);
}

main().catch((e) => { console.error(e); process.exit(1); });
