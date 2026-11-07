#!/usr/bin/env node
/**
 * Eval-only: replay one tribute match (8 deals) with arena seating, record per-decide actions.
 *
 *   ARENA_ENV_STRICT via parent shell optional.
 *   node scripts/experiments/r169/trace-one-match.mjs \
 *     --matchSeed=26991017 --cfg=arenaA1 \
 *     --spec0=decide@r169-cap2-base --spec1=decide@r169-cap2-current \
 *     --spec2=decide@r169-cap2-base --spec3=decide@r169-cap2-current \
 *     --dealIdx=5 --runs=2 --emitJson=1
 *
 * Compare two runs (isolateRuns default): first differing ACTION on target deal (not whole-arena).
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
import { playMatch, makeAgent, loadDecide } from '../../../selfplay/lib.mjs';
import { recordDecision, compareActionTraces } from './match-action-record.mjs';

const SCRIPT = fileURLToPath(import.meta.url);

const args = Object.fromEntries(process.argv.slice(2).map((s) => {
  const m = s.replace(/^--/, '').match(/^([^=]+)=(.*)$/s);
  return m ? [m[1], m[2]] : [s.replace(/^--/, ''), '1'];
}));

const matchSeed = Number(args.matchSeed || 26991017);
const cfg = args.cfg || 'arenaA1';
const dealIdx = Number(args.dealIdx ?? 5);
const dealSeed = matchSeed * 16 + dealIdx;
const runs = Number(args.runs || 2);
const emitJson = args.emitJson === '1' || args.emitJson === 'true';
const isolate = args.isolateRuns !== '0' && args.isolateRuns !== 'false';
const stall = args.timeInject === 'stall';

const spec0 = args.spec0 || 'decide@r169-cap2-base';
const spec1 = args.spec1 || 'decide@r169-cap2-current';
const spec2 = args.spec2 || spec0;
const spec3 = args.spec3 || spec1;
const specs = cfg === 'arenaA0' ? [spec0, spec1, spec2, spec3] : [spec1, spec0, spec3, spec2];

if (stall && !emitJson) {
  console.error('[trace] timeInject=stall only meaningful in child emitJson run');
}

function maybeStallClock() {
  if (process.env.GD_EVAL_TIME_INJECT !== 'stall' && !stall) return;
  const base = 1_700_000_000_000;
  let t = base;
  const orig = Date.now;
  Date.now = () => { t += 33; return t; };
  if (typeof performance !== 'undefined') {
    const p0 = performance.now();
    performance.now = () => p0 + (t - base);
  }
  return { restore: () => { Date.now = orig; } };
}

async function runOnce() {
  const clock = maybeStallClock();
  for (const name of new Set(specs.map((s) => (s.includes('@') ? s.split('@')[1] : null)).filter(Boolean))) {
    await loadDecide(name);
  }
  const agents = await Promise.all(specs.map((s, i) => makeAgent(s, matchSeed * 4 + i)));
  const actions = [];
  const onDecision = (d) => actions.push(recordDecision(cfg, d));
  const rows = playMatch(matchSeed, agents, { deals: 8, onDecision });
  const dealRow = rows.find((r) => r.i === dealIdx);
  clock?.restore?.();
  return {
    matchSeed,
    cfg,
    dealIdx,
    dealSeed,
    dealPoints: dealRow?.points,
    dealSteps: dealRow?.steps,
    dealOrder: dealRow?.order,
    actions,
    env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('GD_')).sort()),
  };
}

function runChild() {
  const extra = [];
  if (stall) extra.push('--timeInject=stall');
  const r = spawnSync(process.execPath, [SCRIPT, ...extra, `--matchSeed=${matchSeed}`, `--cfg=${cfg}`,
    `--spec0=${spec0}`, `--spec1=${spec1}`, `--spec2=${spec2}`, `--spec3=${spec3}`,
    `--dealIdx=${dealIdx}`, '--runs=1', '--emitJson=1', '--isolateRuns=0'], {
    encoding: 'utf8',
    env: { ...process.env, GD_EVAL_TIME_INJECT: stall ? 'stall' : process.env.GD_EVAL_TIME_INJECT || '' },
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`child failed: ${r.stderr}\n${r.stdout}`);
  const line = (r.stdout || '').trim().split('\n').filter(Boolean).pop();
  return JSON.parse(line);
}

async function main() {
  if (emitJson) {
    const o = await runOnce();
    process.stdout.write(`${JSON.stringify(o)}\n`);
    return;
  }
  const outs = [];
  for (let i = 0; i < runs; i++) {
    outs.push(isolate ? runChild() : await runOnce());
  }
  const cmp = compareActionTraces(outs[0].actions, outs[1].actions, { dealSeed });
  const priorDeals = [];
  for (let di = 0; di < dealIdx; di++) {
    const ds = matchSeed * 16 + di;
    const c = compareActionTraces(outs[0].actions, outs[1].actions, { dealSeed: ds });
    priorDeals.push({ dealIdx: di, dealSeed: ds, prefixIdentical: c.prefixIdentical, firstDiff: c.firstDiff?.kind || null });
  }
  const report = {
    matchSeed,
    cfg,
    dealIdx,
    dealSeed,
    specs,
    excludedMechanisms: [
      'no --ckpt on cap2 trace',
      'deal seeds: dealSeedOf(matchSeed,i)=matchSeed*16+i (explicit)',
      'snapshot loader import path normalization only (.versions vs backups)',
      'raw meta pre-deal5: deals 0-4 action traces identical in cap2 run1 vs run2',
    ],
    replayCompare: cmp,
    priorDealsInReplay: priorDeals,
    dealOutcome: outs.map((o, i) => ({ run: i + 1, points: o.dealPoints, steps: o.dealSteps, order: o.dealOrder })),
    env: outs[0].env,
    remainingHypotheses: [
      'handplan/endgame/search Date.now budgets if GD_*_NO_WALLCLOCK not effective in-process',
      'hidden module-level caches (decide path) — two processes should narrow this',
      'tie-break / floating order among equal-scored candidates',
    ],
    wallclockBranches: 'see scripts/experiments/r169/audit-wallclock-paths.txt',
  };
  const outPath = args.out || `/opt/cursor/artifacts/cap2-${matchSeed}-${cfg}-deal${dealIdx}-trace.json`;
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.error(`[trace] wrote ${outPath}`);
  process.exit(cmp.firstDiff ? 2 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
