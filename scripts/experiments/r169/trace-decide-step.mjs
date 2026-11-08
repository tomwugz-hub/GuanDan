#!/usr/bin/env node
/**
 * Deep trace one decide() at matchSeed / dealIdx / step / seat (cap2 snapshot, eval-only).
 *
 *   GD_R95=5 GD_ENDGAME_NO_WALLCLOCK=1 GD_HANDPLAN_NO_WALLCLOCK=1 GD_R169=0 GD_R170=0 \
 *   node scripts/experiments/r169/trace-decide-step.mjs \
 *     --matchSeed=26991017 --dealIdx=5 --step=29 --seat=1 --cfg=arenaA1 \
 *     --inject=normal,normal   # or normal,stall for controlled clock pairs
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { playMatch, playDeal, makeAgent, loadDecide, dealSeedOf, nextPre, ctxFor } from '../../../selfplay/lib.mjs';
import { installDecideTraceSink, diffRanked, fingerprintTrace } from './decide-trace-emit.mjs';

const SCRIPT = fileURLToPath(import.meta.url);
const args = Object.fromEntries(process.argv.slice(2).map((s) => {
  const m = s.replace(/^--/, '').match(/^([^=]+)=(.*)$/s);
  return m ? [m[1], m[2]] : [s.replace(/^--/, ''), '1'];
}));

const matchSeed = Number(args.matchSeed || 26991017);
const dealIdx = Number(args.dealIdx ?? 5);
const step = Number(args.step ?? 29);
const seat = Number(args.seat ?? 1);
const cfg = args.cfg || 'arenaA1';
const backup = args.backup || 'r169-cap2-current-instrumented';
const spec0 = args.spec0 || 'decide@r169-cap2-base';
const spec1 = args.spec1 || `decide@${backup}`;
const injects = (args.inject || 'normal,normal').split(',');
const emitJson = args.emitJson === '1';
const out = args.out || `/opt/cursor/artifacts/cap2-${matchSeed}-deal${dealIdx}-step${step}-deep-trace.json`;

const specs = cfg === 'arenaA0'
  ? [spec0, spec1, spec0, spec1]
  : [spec1, spec0, spec1, spec0];

function stallClock() {
  const base = 1_700_000_000_000;
  let t = base;
  const oD = Date.now;
  const oP = typeof performance !== 'undefined' ? performance.now.bind(performance) : null;
  let p0 = oP?.() ?? 0;
  Date.now = () => { t += 40; return t; };
  if (oP) performance.now = () => p0 + (t - base);
  return () => { Date.now = oD; if (oP) performance.now = oP; };
}

async function runOnce(inject) {
  if (inject === 'stall') stallClock();
  process.env.GD_EVAL_DECIDE_TRACE = '1';
  process.env.GD_EVAL_TRACE_META = `${matchSeed}:${dealIdx}:${step}:${seat}`;
  delete globalThis.__GD_HANDPLAN_BUDGET__;
  const traces = [];
  const ver = spec1.split('@')[1];
  await loadDecide(ver);
  await loadDecide(spec0.split('@')[1]);
  const agents = await Promise.all(specs.map((s, i) => makeAgent(s, matchSeed * 4 + i)));
  const warm = dealIdx > 0 ? playMatch(matchSeed, agents, { deals: dealIdx }) : [];
  const pre = dealIdx > 0 ? nextPre(warm[dealIdx - 1].g) : undefined;
  const ds = dealSeedOf(matchSeed, dealIdx);
  const halted = playDeal(ds, agents, { pre, stopAt: step });
  const un = installDecideTraceSink({
    matchSeed, dealIdx, step, seat,
    onTrace: (p) => { if (p.ctx?.seat === seat) traces.push(p); },
  });
  if (!halted.stopped) traces.push({ phase: 'error', message: `stopAt ${step} not reached (steps ${halted.steps})` });
  else {
    globalThis.__GD_EVAL_DECIDE_TRACE_ACTIVE__ = true;
    const decideFn = await loadDecide(ver);
    const ctx = ctxFor(halted.g, seat);
    const rec = decideFn(ctx);
    globalThis.__GD_EVAL_DECIDE_TRACE_ACTIVE__ = false;
    traces.push({ phase: 'actMs', ms: rec?.ms, move: rec?.move?.combo?.type, rank: rec?.move?.combo?.rank, tags: rec?.tags });
  }
  un();
  delete globalThis.__GD_EVAL_DECIDE_TRACE_ACTIVE__;
  const fin = traces.filter((t) => t.phase === 'final').pop();
  const init = traces.filter((t) => t.phase === 'afterInitialRank').pop();
  return { inject, traces, final: fin, afterInitialRank: init, fp: fin ? fingerprintTrace({ ranked: fin.ranked, best: fin.best, phases: traces.map((t) => t.phase) }) : null };
}

function runChild(inject) {
  const r = spawnSync(process.execPath, [
    SCRIPT, `--matchSeed=${matchSeed}`, `--dealIdx=${dealIdx}`, `--step=${step}`, `--seat=${seat}`,
    `--cfg=${cfg}`, `--backup=${backup}`, `--inject=${inject}`, '--emitJson=1',
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GD_R95: process.env.GD_R95 || '5',
      GD_ENDGAME_NO_WALLCLOCK: process.env.GD_ENDGAME_NO_WALLCLOCK || '1',
      GD_HANDPLAN_NO_WALLCLOCK: process.env.GD_HANDPLAN_NO_WALLCLOCK || '1',
      GD_R169: process.env.GD_R169 || '0',
      GD_R170: process.env.GD_R170 || '0',
      GD_EVAL_DECIDE_TRACE: '1',
    },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return JSON.parse((r.stdout || '').trim().split('\n').pop());
}

async function main() {
  if (emitJson) {
    const o = await runOnce(injects[0] || 'normal');
    process.stdout.write(`${JSON.stringify(o)}\n`);
    return;
  }
  const runs = [];
  for (const inj of injects) {
    runs.push(process.env.GD_EVAL_ISOLATE === '0' ? await runOnce(inj) : runChild(inj));
  }
  const rankedA = runs[0]?.final?.ranked;
  const rankedB = runs[1]?.final?.ranked;
  const initDiff = diffRanked(runs[0]?.afterInitialRank?.ranked, runs[1]?.afterInitialRank?.ranked);
  const finalDiff = diffRanked(rankedA, rankedB);
  const findKeys = (ranked, substr) => ranked?.filter((r) => r.key.includes(substr) || JSON.stringify(r).includes(substr))?.slice(0, 5);
  const report = {
    target: { matchSeed, cfg, dealIdx, dealSeed: matchSeed * 16 + dealIdx, step, seat, specs, backup },
    excluded: ['ckpt', 'explicit dealSeed deck', 'loader hash normalization', 'R169/R170 off in cap2-current snapshot'],
    cap2RawObserve: {
      run1Move: 'fullhouse:8 (tags leadSmallSame, control)',
      run2Move: 'single:J (tag control)',
      priorDealsIdentical: true,
      step29RecordedCtxMatch: true,
    },
    callchain: {
      scoreMove_leadSmallSame: 'index.js ~243-251: penalize larger same-type non-single leads when enemyShort>=4',
      scoreMove_control: 'index.js ~691: tag control on any non-pass lead',
      scoreMove_holdBombLead: 'index.js ~262-265: +60 orphan non-control singles when hasBomb && !shapeFirst',
      planLeadScore: 'index.js ~924-1005: handplan decompose/decomposeCounts → offPlan/planWeakFirst/...',
      beamSearch: 'search/index.js beamSearch timeMs:20 + decide beamW (r44) adds value*beamW',
      postOverrides: 'index.js r21/r25/.../r169(endgame only if m169)/r170 blocks after initial ranked.sort',
    },
    runs: runs.map((r) => ({
      inject: r.inject,
      fp: r.fp,
      best: r.final?.best,
      handplanProbe: r.final?.handplanProbe,
      handplanBudget: r.final?.handplanProbe?.handplanBudget || r.traces?.find((t) => t.handplanProbe)?.handplanProbe,
      beam: { w: r.final?.beamW, len: r.final?.beamLen },
    })),
    earliestInternalDiff: {
      afterInitialRank: initDiff,
      final: finalDiff,
    },
    fhRank: runs.map((r) => findKeys(r.final?.ranked, 'fullhouse:8')),
    jsRank: runs.map((r) => findKeys(r.final?.ranked, 'single:J')),
    unobserved: [
      'Full scored[] tie order before sort',
      'Exact beamSearch early-exit iteration count',
      'Which r* override block moved best (not logged unless DECIDE_DEBUG)',
      'Module cache state across arena worker vs single-process replay',
    ],
  };
  if (runs[0]?.final?.handplanBudget) report.runs[0].handplanBudgetHit = globalThis.__GD_HANDPLAN_BUDGET__;
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.error(`[trace-decide-step] wrote ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
