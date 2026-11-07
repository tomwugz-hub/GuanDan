#!/usr/bin/env node
/**
 * Single-variable differential: live search/index.js beamSearch timeMs (Date.now, not NW-gated).
 *
 *   node scripts/experiments/r169/trace-beam-differential.mjs [--warm=match|arena]
 */
import { writeFileSync } from 'node:fs';
import { runTraceTarget } from './trace-target-core.mjs';
import { buildTributeArenaJobs, slicePrefixJobs, arenaSpec } from './arena-jobs.mjs';

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

function bombRankFromReport(r) {
  const k = r?.decide?.moveKey || r?.trace?.final?.best?.key;
  const m = k?.match(/^bomb:([^:{]+)/);
  return m ? m[1] : null;
}

function bombScores(r) {
  const bs = r?.trace?.final?.bombs || [];
  const j = bs.find((x) => x.key.startsWith('bomb:J:'));
  const kk = bs.find((x) => /^bomb:K:\{[^,]+,[^,]+,[^,]+,[^}]+\}$/.test(x.key));
  return { J: j?.score ?? null, K: kk?.score ?? null, top: r?.trace?.final?.best };
}

async function runOne(timeMs, cpuSpinMs = 0) {
  delete globalThis.__GD_BEAM_PROBE__;
  delete globalThis.__GD_HANDPLAN_BUDGET__;
  process.env.GD_EVAL_BEAM_TIMEMS = String(timeMs);
  if (cpuSpinMs > 0) {
    const end = Date.now() + cpuSpinMs;
    while (Date.now() < end) { /* eval load */ }
  }
  const r = await runTraceTarget({ prefixJobs, target, instrumentedVer: instrumented, warm });
  return {
    timeMs,
    cpuSpinMs,
    bombRank: bombRankFromReport(r),
    scores: bombScores(r),
    beamProbe: globalThis.__GD_BEAM_PROBE__ || null,
    budget: globalThis.__GD_HANDPLAN_BUDGET__ || null,
    decideMs: r.decide?.ms,
  };
}

async function main() {
  const sweep = [];
  for (const t of beamTimes) sweep.push(await runOne(t));
  const strictObs = { run1_c6e0: { move: 'bomb:K', ms: 29.5, wallMs: 2390728 }, run2_5d36: { move: 'bomb:J', ms: 10.3, wallMs: 455990 } };
  const flip = sweep.filter((s) => s.bombRank === 'K');
  const report = {
    hypothesis: 'live search/index.js beamSearch(Date.now, timeMs:20) partial scoring under CPU delay inverts bomb ranks; handplan/endgame NW-gated',
    target: { matchSeed, cfg, dealIdx, step, seat, dealSeed: matchSeed * 16 + dealIdx },
    ungatedDeps: [{ module: 'search/index.js', fn: 'beamSearch', gate: 'none (not GD_*_NO_WALLCLOCK)' }],
    strictParityObserved: strictObs,
    sweep,
    flipToK: flip,
    result: flip.length
      ? `K chosen when beamTimeMs in [${flip.map((f) => f.timeMs).join(',')}]`
      : 'No K in sweep; beam time alone did not flip (blocker or needs concurrent load)',
    methodDeficiency: flip.length ? null : 'Sweep uses isolated process; may need in-decide contention not just pre-spin',
  };
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ out, flip: flip.map((f) => ({ t: f.timeMs, rank: f.bombRank, probe: f.beamProbe })) }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
