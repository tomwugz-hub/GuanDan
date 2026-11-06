/**
 * Regression: playMatch(play/core seed stream) must replay bit-identically for same inputs.
 * (Arena "self vs self" nonzero Δ is a separate statistical issue — see scripts/experiments/r169/determinism-note.md)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { playMatch, makeAgent } from '../selfplay/lib.mjs';

test('playMatch twice: same seed + greedy agents → identical per-deal points', async () => {
  const specs = ['greedy', 'greedy', 'greedy', 'greedy'];
  const agentsA = await Promise.all(specs.map((s, i) => makeAgent(s, 100 + i)));
  const agentsB = await Promise.all(specs.map((s, i) => makeAgent(s, 100 + i)));
  const matchSeed = 9_001_002;
  const run = (agents) => playMatch(matchSeed, agents, { deals: 3, onDecision: null });
  const a = run(agentsA);
  const b = run(agentsB);
  assert.deepEqual(
    a.map((x) => x.points),
    b.map((x) => x.points),
  );
});
