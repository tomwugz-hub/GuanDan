import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBeamWorkForRecord, flattenRawDecisions } from '../scripts/experiments/r169/beam-work-record.mjs';
import { createHash } from 'node:crypto';

test('normalizeBeamWorkForRecord maps candidate cap vs scoredN', () => {
  const n = normalizeBeamWorkForRecord({
    mode: 'fixedNodes',
    budgetUnit: 'rootCandidatesScored',
    candidateN: 34,
    scoredN: 34,
    maxNodes: 128,
    shortRolloutDepth: 1,
    wallCutoff: false,
    nodeCutoff: false,
  }, 'abc');
  assert.equal(n.collected, true);
  assert.equal(n.rootLegalN, 34);
  assert.equal(n.scoredN, 34);
  assert.equal(n.cap, 128);
  assert.equal(n.budgetUnit, 'rootCandidatesScored');
});

test('empty decisions must not produce action fingerprint', () => {
  const lines = flattenRawDecisions({ rawWorkers: [{ decisions: [] }] });
  assert.equal(lines.length, 0);
  const fakeFp = lines.length ? createHash('sha256').update('x').digest('hex') : null;
  assert.equal(fakeFp, null);
});

test('legacy raw without searchBeamWork detectable', () => {
  const decisions = [{ id: 'x|1|0', moveStr: 'pass' }];
  const legacy = decisions.length > 0 && !decisions.some((d) => d.searchBeamWork != null);
  assert.equal(legacy, true);
});
