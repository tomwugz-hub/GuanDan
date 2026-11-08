#!/usr/bin/env node
/**
 * Arena-faithful worker_threads trace vs main thread at one ACTION (eval-only).
 *
 *   GD_R95=5 GD_ENDGAME_NO_WALLCLOCK=1 GD_HANDPLAN_NO_WALLCLOCK=1 GD_R169=0 GD_R170=0 \
 *   node scripts/experiments/r169/trace-worker-action.mjs \
 *     --matchSeed=26991027 --cfg=arenaA1 --dealIdx=6 --step=16 --seat=0 \
 *     --warm=short|arena --workerMode=single|perJob
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadDecide } from '../../../selfplay/lib.mjs';
import { runTasks, dealTasks } from '../../../selfplay/pool.mjs';
import { buildTributeArenaJobs, slicePrefixJobs, arenaSpec } from './arena-jobs.mjs';
import { runTraceTarget } from './trace-target-core.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((s) => {
  const m = s.replace(/^--/, '').match(/^([^=]+)=(.*)$/s);
  return m ? [m[1], m[2]] : [s.replace(/^--/, ''), '1'];
}));

const seed0 = Number(args.seed0 ?? 26991000);
const deals = Number(args.deals ?? 512);
const matchLen = Number(args.matchLen ?? 8);
const a = args.a || 'r169-cap2-current';
const b = args.b || 'r169-cap2-base';
const matchSeed = Number(args.matchSeed ?? 26991027);
const cfg = args.cfg || 'arenaA1';
const dealIdx = Number(args.dealIdx ?? 6);
const step = Number(args.step ?? 16);
const seat = Number(args.seat ?? 0);
const warm = args.warm === 'arena' ? 'arena' : 'match';
const workerMode = args.workerMode || 'single';
const instrumentedBase = args.instrumentedBase || 'r169-cap2-base-instrumented';
const out = args.out || `/opt/cursor/artifacts/r169-worker-trace-${matchSeed}-d${dealIdx}-s${step}.json`;

const specB = arenaSpec(b);
const specA = arenaSpec(a);
const specs = cfg === 'arenaA0' ? [specA, specB, specA, specB] : [specB, specA, specB, specA];

const target = { matchSeed, cfg, dealIdx, step, seat, specs };
const allJobs = buildTributeArenaJobs({ seed0, deals, matchLen, a, b });
const prefixJobs = warm === 'arena' ? slicePrefixJobs(allJobs, { matchSeed, cfg, warmDealsBefore: dealIdx }) : [];

const traceTask = {
  kind: 'traceTarget',
  prefixJobs,
  target,
  instrumentedVer: instrumentedBase,
  warm,
};

const rawObserved = {
  new512: 'bomb:K{KH KD KD KS} tags bombOversize',
  cap2run1_5d36: 'bomb:J{JC JC JH JD} tags []',
  spec: 'decide@r169-cap2-base seat 0 — not R169 candidate',
};

async function workerTrace() {
  if (workerMode === 'perJob' && warm === 'arena') {
    for (const name of new Set([a, b, instrumentedBase])) await loadDecide(name);
    const results = [];
    let chain = [];
    for (let i = 0; i < prefixJobs.length; i++) {
      const job = prefixJobs[i];
      const t = { kind: 'deals', collect: false, jobs: [job] };
      const [r] = await runTasks([t], 1);
      results.push({ i, job: { cfg: job.cfg, seed: job.seed, matchOnly: job.matchOnlyDeals ?? null } });
      chain.push(r);
    }
    const [fin] = await runTasks([traceTask], 1);
    return { workerMode, perJobWarm: results.length, worker: fin };
  }
  for (const name of new Set([a, b, instrumentedBase])) await loadDecide(name);
  const [w] = await runTasks([traceTask], 1);
  return { workerMode: 'single', worker: w };
}

async function main() {
  for (const name of new Set([a, b, instrumentedBase])) await loadDecide(name);
  const mainThread = await runTraceTarget({ prefixJobs, target, instrumentedVer: instrumentedBase, warm });
  const worker = await workerTrace();
  const w = worker.worker;
  const report = {
    focus: rawObserved,
    target,
    warm,
    prefixJobs: prefixJobs.length,
    compare: {
      mainVsWorker: {
        sameDecideKey: bombRank(mainThread.decide?.moveKey) === bombRank(w?.decide?.moveKey),
        mainKey: mainThread.decide?.moveKey,
        workerKey: w?.decide?.moveKey,
        mainBombRank: bombRank(mainThread.decide?.moveKey),
        workerBombRank: bombRank(w?.decide?.moveKey),
        sameFp: mainThread.decide?.fp === w?.decide?.fp,
        budgetMain: mainThread.budgetCaps,
        budgetWorker: w?.budgetCaps,
      },
      liveVsRecordedSubset: {
        mainLiveHandIds: mainThread.liveCtx?.ctx?.handIds,
        subsetHand: mainThread.recordedSubsetAtStep?.hand,
        subsetMove: mainThread.recordedSubsetAtStep?.moveStr,
      },
      bombsFinal: { main: mainThread.trace?.final?.bombs, worker: w?.trace?.final?.bombs },
      earliestBombRankDiff: bombDiff(mainThread.trace, w?.trace),
    },
    mainThread,
    workerRun: worker,
    negativeEvidence: null,
  };
  if (mainThread.decide?.moveKey === w?.decide?.moveKey) {
    report.negativeEvidence = 'Worker and main agree; neither reproduces opposite raw dump move without env/time divergence.';
  }
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    out,
    mainKey: mainThread.decide?.moveKey,
    workerKey: w?.decide?.moveKey,
    bombs: report.compare.bombsFinal,
    budget: report.compare.mainVsWorker,
  }, null, 2));
}

function bombRank(key) {
  if (!key) return null;
  const m = key.match(/^bomb:([^:]+)/);
  return m ? m[1] : key;
}

function bombDiff(mt, w) {
  const a = mt?.final?.bombs || [];
  const b = w?.final?.bombs || [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (!a[i] || !b[i] || a[i].key !== b[i].key || a[i].score !== b[i].score) return { index: i, main: a[i], worker: b[i] };
  }
  return null;
}

main().catch((e) => { console.error(e); process.exit(1); });
