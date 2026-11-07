/**
 * Frozen-fixture beam budget regression (identical handIds/candidate order per variant).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { arenaSpec } from '../scripts/experiments/r169/arena-jobs.mjs';
import { sharedSearchManifest } from '../scripts/experiments/r169/search-beam-manifest.mjs';
import { buildFrozenBeamFixture, decideOnFrozenFixture } from '../scripts/experiments/r169/beam-fixture.mjs';

const a = 'r169-cap2-current';
const b = 'r169-cap2-base';
const specs = [arenaSpec(b), arenaSpec(a), arenaSpec(b), arenaSpec(a)];
const baseEnv = {
  GD_R95: '5',
  GD_ENDGAME_NO_WALLCLOCK: '1',
  GD_HANDPLAN_NO_WALLCLOCK: '1',
  GD_R169: '0',
  GD_R170: '0',
  GD_EVAL_BEAM_WORK_TRACE: '1',
};

const bombTarget = { matchSeed: 26991027, cfg: 'arenaA1', dealIdx: 6, step: 16, seat: 0, specs };
const fhTarget = { matchSeed: 26991017, cfg: 'arenaA1', dealIdx: 5, step: 29, seat: 1, specs };

function bombRank(key) {
  return (key?.match(/^bomb:([^:{]+)/) || [])[1] ?? null;
}

function leadType(key) {
  return (key?.match(/^([^:]+)/) || [])[1];
}

test('shared search manifest includes search/index.js', () => {
  const m = sharedSearchManifest();
  assert.ok(m.sha256.length === 64);
});

test('26991027: frozen fixture stable handIds across wall vs fixed decides', async () => {
  const frozen = await buildFrozenBeamFixture({
    target: bombTarget, prefixJobs: [], warm: 'match', instrumentedVer: 'r169-cap2-base-instrumented', cardIdStart: 1,
  });
  const wall = await decideOnFrozenFixture(frozen, 'r169-cap2-base-instrumented', {
    envPatch: { ...baseEnv, GD_EVAL_BEAM_TIMEMS: '1' },
  });
  const fixed = await decideOnFrozenFixture(frozen, 'r169-cap2-base-instrumented', {
    envPatch: {
      ...baseEnv, GD_EVAL_BEAM_TIMEMS: '1', GD_SEARCH_NO_WALLCLOCK: '1', GD_SEARCH_BEAM_FIXED_NODES: '10',
    },
    cpuSpinMs: 40,
  });
  assert.equal(wall.parity.handIdsMatch, true);
  assert.equal(fixed.parity.handIdsMatch, true);
  assert.equal(wall.parity.candidateOrderMatch, true);
  assert.equal(fixed.parity.candidateOrderMatch, true);
  assert.equal(bombRank(wall.bestKey), 'K');
  assert.equal(bombRank(fixed.bestKey), 'J');
  assert.equal(wall.searchBeamWork.wallCutoff, true);
  assert.equal(fixed.searchBeamWork.mode, 'fixedNodes');
  assert.equal(fixed.searchBeamWork.scoredN, 10);
  const jWall = wall.trace?.final?.bombs?.find((x) => x.key.startsWith('bomb:J:'));
  const jFix = fixed.trace?.final?.bombs?.find((x) => x.key.startsWith('bomb:J:'));
  assert.equal(jWall?.score, 2.7);
  assert.equal(jFix?.score, 4.09);
});

test('26991027: fixed nodes重复 decide same bestKey and scores', async () => {
  const frozen = await buildFrozenBeamFixture({
    target: bombTarget, warm: 'match', instrumentedVer: 'r169-cap2-base-instrumented', cardIdStart: 1,
  });
  const env = { ...baseEnv, GD_SEARCH_NO_WALLCLOCK: '1', GD_SEARCH_BEAM_FIXED_NODES: '10' };
  const r1 = await decideOnFrozenFixture(frozen, 'r169-cap2-base-instrumented', { envPatch: env });
  const r2 = await decideOnFrozenFixture(frozen, 'r169-cap2-base-instrumented', { envPatch: env, cpuSpinMs: 30 });
  assert.equal(r1.bestKey, r2.bestKey);
  assert.equal(r1.bestScore, r2.bestScore);
  assert.equal(bombRank(r1.bestKey), 'J');
});

test('26991017 step29: frozen FH8 under fixed nodes; wall ms can diverge', async () => {
  const frozen = await buildFrozenBeamFixture({
    target: fhTarget, warm: 'match', instrumentedVer: 'r169-cap2-current-instrumented', cardIdStart: 1,
  });
  const def = await decideOnFrozenFixture(frozen, 'r169-cap2-current-instrumented', { envPatch: { ...baseEnv } });
  const wall = await decideOnFrozenFixture(frozen, 'r169-cap2-current-instrumented', {
    envPatch: { ...baseEnv, GD_EVAL_BEAM_TIMEMS: '1' },
  });
  const fixed = await decideOnFrozenFixture(frozen, 'r169-cap2-current-instrumented', {
    envPatch: {
      ...baseEnv, GD_EVAL_BEAM_TIMEMS: '1', GD_SEARCH_NO_WALLCLOCK: '1', GD_SEARCH_BEAM_FIXED_NODES: '34',
    },
  });
  assert.equal(def.parity.handIdsMatch, true);
  assert.equal(leadType(def.bestKey), 'fullhouse');
  assert.equal(leadType(fixed.bestKey), 'fullhouse');
  assert.equal(def.bestKey, fixed.bestKey);
  assert.notEqual(leadType(wall.bestKey), 'fullhouse');
});
