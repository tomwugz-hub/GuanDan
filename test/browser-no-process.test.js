import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Subprocess hides global `process` like the browser bundle (ReferenceError on bare `process`). */
function runWithoutProcess(snippet) {
  const code = `
    const _orig = globalThis.process;
    Object.defineProperty(globalThis, 'process', { get() { return undefined; }, configurable: true });
    try {
      ${snippet}
    } finally {
      Object.defineProperty(globalThis, 'process', { value: _orig, configurable: true });
    }
  `;
  return spawnSync('node', ['--input-type=module', '-e', code], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, GD_R95: '5' } });
}

test('decide + coachMove paths do not touch bare process (r95 default on)', () => {
  const r = runWithoutProcess(`
    const assert = (await import('node:assert/strict')).default;
    const { decide } = await import('./policy/index.js');
    const { newGame, coachMove, startDeal, snapshot, botStepDecide, isOver } = await import('./play/core.js');
    let g = newGame({ seed: 991 });
    startDeal(g);
    for (let i = 0; i < 80 && !isOver(g); i++) botStepDecide(g);
    assert.ok(!isOver(g));
  const seat = g.round.currentSeat;
  const ctx = snapshot(g, seat);
  decide(ctx);
  coachMove(g, seat);
  console.log('ok-no-process');
  `);
  assert.equal(r.status, 0, (r.stderr || '') + (r.stdout || ''));
  assert.match(r.stdout, /ok-no-process/);
});

test('Node debug ruleTrig still writes when GD_R95_LOG is set', () => {
  const r = spawnSync(
    'node',
    [
      '--input-type=module',
      '-e',
      `import { ruleTrig } from './policy/nodeCompat.js';
       ruleTrig('GD_R95_LOG', 'R95TRIG\\n');`,
    ],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, GD_R95_LOG: '1' } },
  );
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /R95TRIG/);
});