// Round-6 rules (Oct 17, 2026). Positions come from the TUNING set dev-r6 and regression sets only, never frozen sets.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { runCase } from '../scripts/run-endgame-eval.mjs';

const load = (set, id) => fs.readFileSync(`eval/endgames/${set}.jsonl`, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((c) => c.id === id);
const ok = async (set, id) => { const r = await runCase(load(set, id), { useJev: false }); assert.ok(r.decide_ok, `${set}/${id}: decide=${r.decide}`); };
const dump = (set, id) => execFileSync('node', ['scripts/jev-dump.mjs', `eval/endgames/${set}.jsonl`, id], { encoding: 'utf8' });

describe('round 6: decide', () => {
  it('enemies on 3-5, no orphan beater: do not break a pair/triple to follow (R147); r28 bit4 relabel: mid-game follow enemy (R111, R140, R150)', async () => {
    for (const id of ['R111', 'R140', 'R147', 'R150']) await ok('dev-r6', id);
  });
  it('next enemy count = partner pair size: may break structure to 顶 (R013)', () => ok('dev-r6', 'R013'));
  it('holdout3 next-enemy-on-2 rule still holds (m01a, m02b, m04a, m05a, m53b, m59a)', async () => {
    for (const id of ['m01a', 'm02b', 'm04a', 'm05a', 'm53b', 'm59a']) await ok('holdout3-pairs', id);
  });
  it('leading: do not break a bomb to feed partner a pair (R058)', () => ok('dev-r6', 'R058'));
  it('last two units, enemies long: weak pair first, keep the strong single (R061)', () => ok('dev-r6', 'R061'));
  it('two singles keep the big-first convention (k03a, q26a)', async () => { await ok('holdout2-pairs', 'k03a'); await ok('holdout4-pairs', 'q26a'); });
  it('enemies on 4+: do not lead a bomb (R051) and do not counter-bomb (R122)', async () => { await ok('dev-r6', 'R051'); await ok('dev-r6', 'R122'); });
});

describe('round 6: Jev candidates', () => {
  it('bomb that leaves one play is tagged and only plausible moves are offered (R110)', () => {
    const out = dump('dev-r6', 'R110');
    assert.match(out, /炸后剩一手：直接走完/);
    assert.doesNotMatch(out, /对子 9/);
    assert.doesNotMatch(out, /无必要不炸中单/);
  });
  it('hand plan order follows the plan-first candidate (eg026)', () => {
    assert.match(dump('cases', 'eg026'), /plan: 99955 → 3 → 4/);
  });
  it("plan singles are tagged from decide's plan; the old orphan-single tag is gone (eg015, r9)", () => {
    assert.match(dump('cases', 'eg015'), /单张 9 \[9D\] \[领出\] \[按计划\]/);
  });
});
