/** Shared eval trace target replay (main thread or worker). */
import { playMatch, playDeal, makeAgent, loadDecide, dealSeedOf, nextPre, ctxFor } from '../../../selfplay/lib.mjs';
import { captureLiveCtx, envAndModules } from './live-ctx-capture.mjs';
import { fingerprintTrace } from './decide-trace-emit.mjs';
import { recordDecision } from './match-action-record.mjs';

function parseVer(spec) {
  return spec.includes('@') ? spec.split('@')[1] : 'current';
}

export async function runTraceTarget({
  prefixJobs = [],
  target,
  instrumentedVer,
  warm = 'arena',
}) {
  const { matchSeed, cfg, dealIdx, step, seat, specs } = target;
  delete globalThis.__GD_HANDPLAN_BUDGET__;
  const allSpecs = [...new Set([...specs, ...prefixJobs.flatMap((j) => j.specs), `decide@${instrumentedVer}`])];
  for (const s of allSpecs) await loadDecide(parseVer(s));

  const tributeRows = [];
  let pre;

  if (warm === 'arena' && prefixJobs.length) {
    for (const job of prefixJobs) {
      const agents = await Promise.all(job.specs.map((s, i) => makeAgent(s, job.seed * 4 + i)));
      const nDeals = job.matchOnlyDeals != null ? job.matchOnlyDeals : job.match;
      const rows = playMatch(job.seed, agents, { deals: nDeals });
      if (job.seed === matchSeed && job.cfg === cfg) {
        tributeRows.push(...rows.map((r) => ({
          dealIdx: r.i, dealSeed: r.seed, points: r.points, order: r.order, tribute: r.tribute,
          levelRank: r.g?.match?.levelRank, teamLevel: r.g?.std?.teamLevel?.slice(),
        })));
        if (rows.length) pre = nextPre(rows[rows.length - 1].g);
      }
    }
  } else {
    const agents = await Promise.all(specs.map((s, i) => makeAgent(s, matchSeed * 4 + i)));
    if (dealIdx > 0) {
      const rows = playMatch(matchSeed, agents, { deals: dealIdx });
      tributeRows.push(...rows.map((r) => ({
        dealIdx: r.i, dealSeed: r.seed, points: r.points, order: r.order, tribute: r.tribute,
        levelRank: r.g?.match?.levelRank, teamLevel: r.g?.std?.teamLevel?.slice(),
      })));
      pre = nextPre(rows[dealIdx - 1].g);
    }
  }

  const agents = await Promise.all(specs.map((s, i) => makeAgent(s, matchSeed * 4 + i)));
  const ds = dealSeedOf(matchSeed, dealIdx);
  const subsetActions = [];
  const halted = playDeal(ds, agents, {
    pre,
    stopAt: step,
    onDecision: (d) => subsetActions.push(recordDecision(cfg, { ...d, dealSeed: ds, dealIdx })),
  });
  const liveCtx = captureLiveCtx(halted.g, seat);
  process.env.GD_EVAL_DECIDE_TRACE = '1';
  process.env.GD_EVAL_TRACE_META = `${matchSeed}:${dealIdx}:${step}:${seat}`;
  const decideTraces = [];
  globalThis.__GD_EVAL_DECIDE_TRACE__ = (p) => { if (p.ctx?.seat === seat || p.seat === seat) decideTraces.push(p); };
  globalThis.__GD_EVAL_DECIDE_TRACE_ACTIVE__ = true;
  const decideFn = await loadDecide(instrumentedVer);
  const rec = decideFn(ctxFor(halted.g, seat));
  globalThis.__GD_EVAL_DECIDE_TRACE_ACTIVE__ = false;
  delete globalThis.__GD_EVAL_DECIDE_TRACE__;
  const fin = decideTraces.filter((t) => t.phase === 'final').pop();
  const init = decideTraces.filter((t) => t.phase === 'afterInitialRank').pop();
  const bombs = (ranked) => ranked?.filter((r) => r.key.startsWith('bomb:')).slice(0, 12);

  return {
    target: { matchSeed, cfg, dealIdx, dealSeed: ds, step, seat, specs, instrumentedVer },
    warm,
    prefixJobCount: prefixJobs.length,
    tributeChain: tributeRows,
    liveCtx,
    recordedSubsetAtStep: subsetActions.find((a) => a.step === step && a.seat === seat) || null,
    env: envAndModules([...specs, `decide@${instrumentedVer}`]),
    budgetCaps: globalThis.__GD_HANDPLAN_BUDGET__ || null,
    beamProbe: globalThis.__GD_BEAM_PROBE__ || null,
    decide: {
      moveKey: fin?.best?.key ?? null,
      tags: rec?.tags,
      ms: rec?.ms,
      fp: fin ? fingerprintTrace({ ranked: fin.ranked, best: fin.best, phases: decideTraces.map((t) => t.phase) }) : null,
    },
    trace: {
      afterInitialRank: init ? { best: init.best, beam: { w: init.beamW, len: init.beamLen }, bombs: bombs(init.ranked) } : null,
      final: fin ? { best: fin.best, handplanProbe: fin.handplanProbe, bombs: bombs(fin.ranked), rankedTop8: fin.ranked?.slice(0, 8) } : null,
    },
  };
}
