import test from 'node:test';
import assert from 'node:assert/strict';
import { collectGdEnv, buildArenaDumpMeta } from '../selfplay/arena.mjs';

test('collectGdEnv captures sorted GD_* only', () => {
  const env = { GD_R95: '5', GD_HANDPLAN_NO_WALLCLOCK: '1', HOME: '/x', OTHER: 'y' };
  assert.deepEqual(collectGdEnv(env), {
    GD_HANDPLAN_NO_WALLCLOCK: '1',
    GD_R95: '5',
  });
});

test('buildArenaDumpMeta includes node and full gd env', () => {
  const meta = buildArenaDumpMeta({
    a: 'r169-cap2-current',
    b: 'r169-cap2-base',
    deals: 8,
    seed0: 1,
    tribute: true,
    matchLen: 8,
    threads: 1,
    ckpt: null,
    fingerprint: 'ab',
    wallMs: 1000,
    env: { GD_R169: '0', GD_ENDGAME_NO_WALLCLOCK: '1', PATH: '/bin' },
  });
  assert.equal(meta.threads, 1);
  assert.equal(meta.wallMs, 1000);
  assert.ok(meta.node?.startsWith('v'));
  assert.equal(meta.env.GD_R169, '0');
  assert.equal(meta.env.GD_ENDGAME_NO_WALLCLOCK, '1');
  assert.equal(meta.env.PATH, undefined);
  assert.ok(meta.policySource?.a?.sha256 || meta.policySource?.a?.dir === null);
});
