import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTributeArenaJobs, slicePrefixJobs } from '../scripts/experiments/r169/arena-jobs.mjs';

test('slicePrefixJobs stops at target cfg with partial deals', () => {
  const jobs = buildTributeArenaJobs({ seed0: 100, deals: 32, matchLen: 8, a: 'r169-cap2-current', b: 'r169-cap2-base' });
  const pref = slicePrefixJobs(jobs, { matchSeed: 101, cfg: 'arenaA1', warmDealsBefore: 5 });
  const last = pref[pref.length - 1];
  assert.equal(last.seed, 101);
  assert.equal(last.cfg, 'arenaA1');
  assert.equal(last.matchOnlyDeals, 5);
  assert.ok(pref.every((j) => j.seed < 101 || (j.seed === 101 && (j.cfg === 'arenaA0' || j === last))));
});
