import test from 'node:test';
import assert from 'node:assert/strict';
import { actionFingerprint, compareActionTraces } from '../scripts/experiments/r169/match-action-record.mjs';

test('compareActionTraces ignores ms; detects move change', () => {
  const base = {
    dealSeed: 1,
    step: 0,
    spec: 'decide@x',
    seat: 1,
    rel: 'lead',
    hand: 'A',
    prevStr2: 'pass',
    moveStr: 'single:A{A}',
    tags: ['t'],
    nCands: 3,
    enemyMin: 1,
    partnerN: 2,
  };
  const a = [{ ...base }, { ...base, step: 1, moveStr: 'pass', tags: [] }];
  const b = [{ ...base }, { ...base, step: 1, moveStr: 'single:K{K}', tags: ['x'] }];
  const c = compareActionTraces(a, b, { dealSeed: 1 });
  assert.equal(c.prefixIdentical, 1);
  assert.equal(c.firstDiff?.step, 1);
});

test('actionFingerprint stable', () => {
  const r = { spec: 's', seat: 0, step: 0, rel: 'lead', hand: 'h', prevStr2: 'p', moveStr: 'm', tags: [], nCands: 1, enemyMin: 0, partnerN: 0 };
  assert.equal(actionFingerprint(r), actionFingerprint({ ...r }));
});
