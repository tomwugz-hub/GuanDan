#!/usr/bin/env node
/**
 * Frozen-fixture beam time sweep: identical handIds + candidate order per row.
 */
import { writeFileSync } from 'node:fs';
import { buildTributeArenaJobs, slicePrefixJobs, arenaSpec } from './arena-jobs.mjs';
import { buildFrozenBeamFixture, decideOnFrozenFixture } from './beam-fixture.mjs';
import { sharedSearchManifest } from './search-beam-manifest.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((s) => {
  const m = s.replace(/^--/, '').match(/^([^=]+)=(.*)$/s);
  return m ? [m[1], m[2]] : [s.replace(/^--/, ''), '1'];
}));

const matchSeed = Number(args.matchSeed ?? 26991027);
const cfg = args.cfg || 'arenaA1';
const dealIdx = Number(args.dealIdx ?? 6);
const step = Number(args.step ?? 16);
const seat = Number(args.seat ?? 0);
const warm = args.warm === 'arena' ? 'arena' : 'match';
const a = args.a || 'r169-cap2-current';
const b = args.b || 'r169-cap2-base';
const instrumented = args.instrumented || 'r169-cap2-base-instrumented';
const out = args.out || '/opt/cursor/artifacts/r169-beam-differential-26991027.json';

const specB = arenaSpec(b);
const specA = arenaSpec(a);
const specs = cfg === 'arenaA0' ? [specA, specB, specA, specB] : [specB, specA, specB, specA];
const target = { matchSeed, cfg, dealIdx, step, seat, specs };
const prefixJobs = warm === 'arena'
  ? slicePrefixJobs(buildTributeArenaJobs({ seed0: 26991000, deals: 512, matchLen: 8, a, b }), { matchSeed, cfg, warmDealsBefore: dealIdx })
  : [];

const beamTimes = (args.beamTimes || '1,3,5,10,15,20,40,80,200').split(',').map(Number);
const baseEnv = {
  GD_R95: '5',
  GD_ENDGAME_NO_WALLCLOCK: '1',
  GD_HANDPLAN_NO_WALLCLOCK: '1',
  GD_R169: '0',
  GD_R170: '0',
  GD_EVAL_BEAM_WORK_TRACE: '1',
};

function bombRank(key) {
  const m = key?.match(/^bomb:([^:{]+)/);
  return m?.[1] ?? null;
}

function bombScores(trace) {
  const bs = trace?.final?.bombs || [];
  const j = bs.find((x) => x.key.startsWith('bomb:J:'));
  const k = bs.find((x) => /^bomb:K:\{[^,]+,[^,]+,[^,]+,[^}]+\}$/.test(x.key));
  return { J: j?.score ?? null, K: k?.score ?? null, top: trace?.final?.best };
}

async function main() {
  const frozen = await buildFrozenBeamFixture({
    target, prefixJobs, warm, instrumentedVer: instrumented, cardIdStart: 1,
  });
  const sweep = [];
  for (const timeMs of beamTimes) {
    const row = await decideOnFrozenFixture(frozen, instrumented, {
      envPatch: { ...baseEnv, GD_EVAL_BEAM_TIMEMS: String(timeMs) },
    });
    sweep.push({
      timeMs,
      bombRank: bombRank(row.bestKey),
      bestKey: row.bestKey,
      bestScore: row.bestScore,
      scores: bombScores(row.trace),
      beamProbe: row.beamProbe,
      searchBeamWork: row.searchBeamWork,
      budgetCaps: row.budgetCaps,
      parity: row.parity,
      decideMs: row.decide?.ms,
    });
  }
  const flip = sweep.filter((s) => s.bombRank === 'K');
  const allParity = sweep.every((s) => s.parity.handIdsMatch && s.parity.candidateOrderMatch);
  const budgetObserved = sweep.some((s) => s.budgetCaps != null);
  const deficiencies = [];
  if (!allParity) deficiencies.push('handIds or candidate order diverged across sweep rows');
  if (!budgetObserved) deficiencies.push('handplan budget/clock-entry not observed (may be inactive under NW=1)');
  deficiencies.push('historic strict run1 beam truncation at step not directly logged; flip correlation is not wall-clock proof');
  const report = {
    hypothesis: 'beamSearch wallMs truncates shortRollout scoring order → K/J invert at low effective timeMs',
    fixture: frozen.fixture,
    sharedSearch: sharedSearchManifest(),
    strictParityObserved: { run1_c6e0: { move: 'bomb:K', ms: 29.5 }, run2_5d36: { move: 'bomb:J', ms: 10.3 } },
    sweep,
    flipToK: flip,
    fixtureParityOk: allParity,
    result: flip.length ? `K when timeMs in [${flip.map((f) => f.timeMs).join(',')}] on frozen ctx` : 'no K in sweep',
    methodDeficiency: deficiencies,
  };
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ out, fixtureParityOk: allParity, flip: flip.map((f) => f.timeMs), handIds: frozen.fixture.handIds }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
