import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { collectGdEnv, buildArenaDumpMeta, policySourceManifest } from '../scripts/experiments/r169/eval-meta.mjs';

test('collectGdEnv captures sorted GD_* only', () => {
  const env = { GD_R95: '5', GD_HANDPLAN_NO_WALLCLOCK: '1', HOME: '/x', OTHER: 'y' };
  assert.deepEqual(collectGdEnv(env), {
    GD_HANDPLAN_NO_WALLCLOCK: '1',
    GD_R95: '5',
  });
});

test('policySourceManifest includes repo import closure (not snapshot index only)', () => {
  const m = policySourceManifest('current');
  assert.ok(m.sha256);
  assert.ok(Object.keys(m.snapshot).some((k) => k.endsWith('policy/index.js')));
  assert.ok(Object.keys(m.repoDeps).some((k) => k.startsWith('engine/')));
  assert.ok(m.limitations?.length);
});

test('buildArenaDumpMeta records full gd env', () => {
  const meta = buildArenaDumpMeta({
    a: 'current',
    b: 'pre-selfplay-audit',
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
  assert.equal(meta.env.GD_R169, '0');
  assert.ok(meta.policySource?.a?.repoDeps);
});

test('ARENA_ENV_STRICT forwards all GD_* after PRE', () => {
  const sh = `
set -euo pipefail
export GD_R95=5
export GD_ENDGAME_NO_WALLCLOCK=1
PRE='export GD_R169=42; export GD_CUSTOM_PROBE=1'
run_node() {
  local -a clean=( HOME="$HOME" PATH="$PATH" LANG="\${LANG:-C.UTF-8}" )
  while IFS= read -r line; do [[ -n "$line" ]] && clean+=("$line"); done < <(env | LC_ALL=C sort | grep '^GD_' || true)
  env -i "\${clean[@]}" env
}
( eval "$PRE"; run_node )
`;
  const out = execSync('bash -s', { input: sh, encoding: 'utf8' });
  assert.match(out, /GD_R169=42/);
  assert.match(out, /GD_CUSTOM_PROBE=1/);
  assert.match(out, /GD_R95=5/);
});
