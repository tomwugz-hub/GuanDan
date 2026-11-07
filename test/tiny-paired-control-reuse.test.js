import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXIT,
  validateReuseOnlyPaths,
  computeVerdict,
  buildPairReport,
} from '../scripts/experiments/r169/tiny-paired-control-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'scripts/experiments/r169/tiny-paired-control.mjs');

test('validateReuseOnlyPaths lists all missing before any load', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'tiny-miss-'));
  const v = validateReuseOnlyPaths(dir, 26991000, 32);
  assert.equal(v.ok, false);
  assert.equal(v.missing.length, 4);
  assert.equal(v.required.length, 4);
});

test('computeVerdict: parity ok + legacy telemetry → exit 20 not 2', () => {
  const pairs = [{
    dealFp: { same: true },
    actionFp: { same: true },
    actionFpErrors: { run1: null, run2: null },
    beam: {
      run1: { legacyDumpMissingSearchBeamWork: true, wallCutoffN: 0 },
      run2: { legacyDumpMissingSearchBeamWork: true, wallCutoffN: 0 },
    },
  }];
  const v = computeVerdict(pairs);
  assert.equal(v.exitCode, EXIT.TELEMETRY_LEGACY);
  assert.equal(v.parityOk, true);
  assert.equal(v.telemetryOk, false);
});

test('argv --reuse-only flag normalizes without equals sign', () => {
  const argv = ['--reuse-only', '--outdir=/tmp/x'];
  const flags = new Set(argv.filter((s) => !s.includes('=') && s.startsWith('--')).map((s) => s.replace(/^--/, '')));
  assert.equal(flags.has('reuse-only'), true);
});

test('--reuse-only missing files: exit 11, no arena raw created, stderr missing_files', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'tiny-cli-'));
  const before = readdirSync(dir);
  const r = spawnSync(process.execPath, [CLI, '--reuse-only', `--outdir=${dir}`, '--seed0=26991000', '--deals=32'], {
    encoding: 'utf8',
  });
  const after = readdirSync(dir);
  assert.equal(r.status, EXIT.MISSING_FILES);
  assert.deepEqual(before, after);
  assert.ok(!after.some((f) => f.startsWith('arena-') && f.endsWith('.json')));
  const err = JSON.parse(r.stderr.trim().split('\n').pop());
  assert.equal(err.error, 'missing_files');
  assert.equal(err.exitCode, EXIT.MISSING_FILES);
});

test('--reuse-only with minimal pair: parity pass + legacy beam → exit 20', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'tiny-legacy-'));
  const minimal = {
    meta: { env: { GD_R169: '0' }, fingerprint: 'x', wallMs: 1 },
    deals: [{ cfg: 'arenaA0', seed: 1, matchSeed: 26991000, dealIdx: 0, points: [1, -1], order: [0, 1, 2, 3] }],
    rawWorkers: [{ decisions: [{ id: 'arenaA0|26991000|0', moveStr: 'pass', tags: null, hand: '', prevStr2: 'pass', nCands: 1 }] }],
  };
  for (const name of [
    'arena-old-old-run1-s26991000-d32.json',
    'arena-old-old-run2-s26991000-d32.json',
    'arena-cur-flag0-run1-s26991000-d32.json',
    'arena-cur-flag0-run2-s26991000-d32.json',
  ]) {
    writeFileSync(path.join(dir, name), JSON.stringify(minimal));
  }
  const r = spawnSync(process.execPath, [CLI, '--reuse-only', `--outdir=${dir}`, '--seed0=26991000', '--deals=32'], {
    encoding: 'utf8',
  });
  assert.equal(r.status, EXIT.TELEMETRY_LEGACY);
  const report = JSON.parse(r.stdout.trim());
  assert.equal(report.verdict.reason, 'parity_ok_telemetry_legacy_missing');
  assert.equal(report.verdict.parityOk, true);
});

test('buildPairReport refuses empty via actionFpErrors', () => {
  const empty = { deals: [], rawWorkers: [{ decisions: [] }], meta: {} };
  const p = buildPairReport({ tag: 'old-old', a: 'x', b: 'y' }, empty, empty);
  assert.equal(p.actionFpErrors.run1, 'empty_decisions');
  const v = computeVerdict([p]);
  assert.equal(v.exitCode, EXIT.EMPTY_DECISIONS);
});
