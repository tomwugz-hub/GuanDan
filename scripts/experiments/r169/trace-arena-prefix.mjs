#!/usr/bin/env node
/**
 * Same-process arena prefix replay, then trace one match/deal/step (eval-only).
 *
 *   node scripts/experiments/r169/trace-arena-prefix.mjs \
 *     --seed0=26991000 --deals=512 --matchLen=8 \
 *     --a=r169-cap2-current --b=r169-cap2-base \
 *     --matchSeed=26991017 --cfg=arenaA1 --dealIdx=5 \
 *     --mode=prefix|isolated --trace=decideStep --step=29 --seat=1
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { playMatch, makeAgent, loadDecide } from '../../../selfplay/lib.mjs';
import { buildTributeArenaJobs, slicePrefixJobs } from './arena-jobs.mjs';
import { recordDecision, compareActionTraces } from './match-action-record.mjs';

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const args = Object.fromEntries(process.argv.slice(2).map((s) => {
  const m = s.replace(/^--/, '').match(/^([^=]+)=(.*)$/s);
  return m ? [m[1], m[2]] : [s.replace(/^--/, ''), '1'];
}));

const seed0 = Number(args.seed0 ?? 26991000);
const deals = Number(args.deals ?? 512);
const matchLen = Number(args.matchLen ?? 8);
const a = args.a || 'r169-cap2-current';
const b = args.b || 'r169-cap2-base';
const matchSeed = Number(args.matchSeed ?? 26991017);
const cfg = args.cfg || 'arenaA1';
const dealIdx = Number(args.dealIdx ?? 5);
const mode = args.mode || 'prefix';
const trace = args.trace || 'oneMatch';
const step = Number(args.step ?? 29);
const seat = Number(args.seat ?? 1);
const warmDeals = args.warmDeals != null ? Number(args.warmDeals) : dealIdx;
const emitJson = args.emitJson === '1';
const out = args.out || `/opt/cursor/artifacts/r169-arena-prefix-${matchSeed}-${cfg}-d${dealIdx}.json`;

const spec0 = args.spec0 || `decide@${a}`;
const spec1 = args.spec1 || `decide@${b}`;
const specs = cfg === 'arenaA0' ? [spec0, spec1, spec0, spec1] : [spec1, spec0, spec1, spec0];

async function warmPrefixJobs(jobs) {
  let nJobs = 0;
  let nDecides = 0;
  for (const job of jobs) {
    const agents = await Promise.all(job.specs.map((s, i) => makeAgent(s, job.seed * 4 + i)));
    const dealsN = job.matchOnlyDeals != null ? job.matchOnlyDeals : job.match;
    const rows = playMatch(job.seed, agents, { deals: dealsN });
    nJobs++;
    nDecides += rows.reduce((s, r) => s + (r.steps || 0), 0);
  }
  return { nJobs, nDecides };
}

async function traceOneMatchTwice({ afterPrefix }) {
  const dealSeed = matchSeed * 16 + dealIdx;
  async function runOnce() {
    const agents = await Promise.all(specs.map((s, i) => makeAgent(s, matchSeed * 4 + i)));
    const actions = [];
    playMatch(matchSeed, agents, {
      deals: 8,
      onDecision: (d) => actions.push(recordDecision(cfg, d)),
    });
    return actions;
  }
  const a1 = await runOnce();
  const a2 = await runOnce();
  const cmp = compareActionTraces(
    a1.filter((x) => x.dealSeed === dealSeed),
    a2.filter((x) => x.dealSeed === dealSeed),
    { dealSeed },
  );
  const at29 = a1.find((x) => x.dealSeed === dealSeed && x.step === step && x.seat === seat);
  return {
    afterPrefix,
    isolateNote: 'two sequential playMatch in same process after prefix',
    compareSameProcess: cmp,
    stepRecord: at29,
  };
}

function spawnDecideStep(afterPrefix) {
  const r = spawnSync(process.execPath, [
    `${ROOT}/scripts/experiments/r169/trace-decide-step.mjs`,
    `--matchSeed=${matchSeed}`, `--dealIdx=${dealIdx}`, `--step=${step}`, `--seat=${seat}`,
    `--cfg=${cfg}`, '--inject=normal', '--emitJson=1',
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GD_R95: process.env.GD_R95 || '5',
      GD_ENDGAME_NO_WALLCLOCK: process.env.GD_ENDGAME_NO_WALLCLOCK || '1',
      GD_HANDPLAN_NO_WALLCLOCK: process.env.GD_HANDPLAN_NO_WALLCLOCK || '1',
      GD_R169: process.env.GD_R169 || '0',
      GD_R170: process.env.GD_R170 || '0',
      GD_EVAL_ISOLATE: '0',
    },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  const body = JSON.parse((r.stdout || '').trim().split('\n').filter(Boolean).pop());
  return { afterPrefix, decideStep: { best: body.final?.best, fp: body.fp, act: body.traces?.find((t) => t.phase === 'actMs') } };
}

async function main() {
  for (const name of new Set([a, b])) await loadDecide(name);
  const allJobs = buildTributeArenaJobs({ seed0, deals, matchLen, a, b });
  const prefixJobs = mode === 'isolated' ? [] : slicePrefixJobs(allJobs, {
    matchSeed,
    cfg,
    warmDealsBefore: warmDeals > 0 ? warmDeals : null,
  });
  const prefixStats = prefixJobs.length ? await warmPrefixJobs(prefixJobs) : { nJobs: 0, nDecides: 0 };
  const result = {
    mode,
    seed0,
    deals,
    matchLen,
    target: { matchSeed, cfg, dealIdx, dealSeed: matchSeed * 16 + dealIdx, step, seat, specs },
    prefix: { jobCount: prefixJobs.length, jobs: prefixJobs.map((j) => ({ cfg: j.cfg, seed: j.seed, match: j.match, matchOnlyDeals: j.matchOnlyDeals ?? null })), ...prefixStats },
    traceKind: trace,
  };
  if (trace === 'decideStep') Object.assign(result, spawnDecideStep(true));
  else Object.assign(result, await traceOneMatchTwice(true));

  if (emitJson) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  console.error(`[trace-arena-prefix] wrote ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
