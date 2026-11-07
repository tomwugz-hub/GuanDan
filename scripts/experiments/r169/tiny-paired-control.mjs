#!/usr/bin/env node
/**
 * 32-deal parity report from existing arena raw dumps.
 *   node tiny-paired-control.mjs --reuse-only [--outdir=...] [--seed0=26991000]
 * --reuse-only: fail-closed if any required raw missing; never spawns arena/workers.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STRICT_EVAL_FULL, strictEnvelopeRecord, applyStrictEvalEnvelope } from './eval-strict-envelope.mjs';
import {
  DEFAULT_CONFIGS,
  EXIT,
  rawPath,
  validateReuseOnlyPaths,
  buildPairReport,
  computeVerdict,
} from './tiny-paired-control-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((s) => !s.includes('=') && s.startsWith('--')).map((s) => s.replace(/^--/, '')));
const args = Object.fromEntries(argv.filter((s) => s.includes('=')).map((s) => {
  const m = s.replace(/^--/, '').match(/^([^=]+)=(.*)$/s);
  return m ? [m[1], m[2]] : [s.replace(/^--/, ''), '1'];
}));

const REUSE_ONLY = flags.has('reuse-only');
const SEED0 = Number(args.seed0 ?? 26991000);
const DEALS = Number(args.deals ?? 32);
const MATCH_LEN = 8;
const OUTDIR = args.outdir || path.join(ROOT, 'selfplay/logs/r169-tiny-strict-envelope');

function envClean() {
  const base = { ...process.env, ...STRICT_EVAL_FULL, GD_EVAL_BEAM_WORK_TRACE: '1', GD_EVAL_BEAM_WORK_COLLECT: '1' };
  return {
    HOME: base.HOME, PATH: base.PATH, LANG: base.LANG || 'C.UTF-8', TZ: base.TZ || '', USER: base.USER || '',
    ...Object.fromEntries(Object.entries(base).filter(([k]) => k.startsWith('GD_'))),
  };
}

function runArena(tag, cfg) {
  if (REUSE_ONLY) {
    throw new Error('runArena forbidden in --reuse-only mode');
  }
  const raw = rawPath(OUTDIR, cfg, tag, SEED0, DEALS);
  const r = spawnSync(process.execPath, [
    path.join(ROOT, 'selfplay/arena.mjs'),
    `--a=${cfg.a}`, `--b=${cfg.b}`, `--deals=${DEALS}`, `--seed0=${SEED0}`,
    '--tribute', `--matchLen=${MATCH_LEN}`, '--threads=1', '--collect=1', `--dump-raw=${raw}`,
  ], { env: envClean(), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`arena ${cfg.tag} ${tag}: ${r.stderr || r.stdout}`);
  return JSON.parse(readFileSync(raw, 'utf8'));
}

function loadRaw(tag, cfg) {
  const p = rawPath(OUTDIR, cfg, tag, SEED0, DEALS);
  return JSON.parse(readFileSync(p, 'utf8'));
}

function acquireRaw(tag, cfg) {
  if (REUSE_ONLY) return loadRaw(tag, cfg);
  const p = rawPath(OUTDIR, cfg, tag, SEED0, DEALS);
  if (existsSync(p)) return loadRaw(tag, cfg);
  return runArena(tag, cfg);
}

function failMissingFiles(check) {
  const payload = {
    error: 'missing_files',
    reuseOnly: true,
    missing: check.missing,
    required: check.required,
    exitCode: EXIT.MISSING_FILES,
    hint: 'arena-repeat-dump names arena-run1-*.json; this tool expects arena-<config>-run1-s<seed>-d<deals>.json',
  };
  process.stderr.write(`${JSON.stringify(payload)}\n`);
  process.exit(EXIT.MISSING_FILES);
}

function main() {
  if (REUSE_ONLY) {
    const check = validateReuseOnlyPaths(OUTDIR, SEED0, DEALS, DEFAULT_CONFIGS);
    if (!check.ok) failMissingFiles(check);
  } else {
    mkdirSync(OUTDIR, { recursive: true });
  }

  applyStrictEvalEnvelope();
  process.env.GD_EVAL_BEAM_WORK_COLLECT = '1';

  const report = {
    seed0: SEED0,
    deals: DEALS,
    reuseOnly: REUSE_ONLY,
    envelope: strictEnvelopeRecord(process.env),
    pairs: [],
    verdict: null,
  };

  for (const cfg of DEFAULT_CONFIGS) {
    report.pairs.push(buildPairReport(cfg, acquireRaw('run1', cfg), acquireRaw('run2', cfg)));
  }

  report.verdict = computeVerdict(report.pairs);
  const out = path.join(OUTDIR, `tiny-paired-${SEED0}-d${DEALS}.json`);
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.verdict.exitCode);
}

try {
  main();
} catch (e) {
  process.stderr.write(`${JSON.stringify({ error: 'runtime', message: String(e.message || e), exitCode: EXIT.RUNTIME_ERROR })}\n`);
  process.exit(EXIT.RUNTIME_ERROR);
}
