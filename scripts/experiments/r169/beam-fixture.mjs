/** Frozen halted position: one warm, many decide() variants on identical live ctx. */
import { resetCardIdCounter } from '../../../engine/cards.js';
import { generateCandidates } from '../../../search/index.js';
import { ctxFor, loadDecide } from '../../../selfplay/lib.mjs';
import { cardKey } from './decide-trace-emit.mjs';
import { captureLiveCtx } from './live-ctx-capture.mjs';
import { buildHaltedState } from './trace-target-core.mjs';

export function candidateOrderSig(ctx) {
  return generateCandidates(ctx).map((m) => cardKey({ cards: m.cards, combo: m.combo, move: m })).join('\n');
}

function parseVer(spec) {
  return spec.includes('@') ? spec.split('@')[1] : 'current';
}

/** One tribute warm + stopAt; card ids stable via resetCardIdCounter before play. */
export async function buildFrozenBeamFixture(opts) {
  const { target, prefixJobs = [], warm = 'match', cardIdStart = 1 } = opts;
  resetCardIdCounter(cardIdStart);
  for (const s of new Set([
    ...target.specs,
    ...prefixJobs.flatMap((j) => j.specs),
    `decide@${opts.instrumentedVer}`,
  ])) await loadDecide(parseVer(s));
  const { halted: haltPack, dealSeed } = await buildHaltedState({ prefixJobs, target, warm });
  const g0 = haltPack.g;
  const { matchSeed, dealIdx, step, seat } = target;
  const ctx = ctxFor(g0, seat);
  const liveCtx = captureLiveCtx(g0, seat);
  const fixture = {
    target: { ...target, dealSeed },
    warm,
    prefixJobCount: prefixJobs.length,
    liveCtx,
    fixture: {
      handIds: liveCtx.ctx.handIds,
      handIdSig: liveCtx.ctx.handIds.join(','),
      gameSeed: g0.seed,
      dealSeed,
      candidateOrderSig: candidateOrderSig(ctx),
      candidateN: generateCandidates(ctx).length,
      levelRank: ctx.levelRank,
    },
    haltedG: g0,
  };
  return fixture;
}

export async function decideOnFrozenFixture(frozen, instrumentedVer, { envPatch = {}, cpuSpinMs = 0 } = {}) {
  const { target, haltedG, fixture } = frozen;
  const seat = target.seat;
  const saved = {};
  for (const k of [
    'GD_SEARCH_NO_WALLCLOCK', 'GD_SEARCH_BEAM_FIXED_NODES', 'GD_EVAL_BEAM_TIMEMS',
    'GD_EVAL_BEAM_WORK_TRACE', 'GD_EVAL_DECIDE_TRACE',
  ]) saved[k] = process.env[k];
  Object.assign(process.env, envPatch);
  process.env.GD_EVAL_DECIDE_TRACE = '1';
  process.env.GD_EVAL_TRACE_META = `${target.matchSeed}:${target.dealIdx}:${target.step}:${seat}`;
  if (!process.env.GD_EVAL_BEAM_WORK_TRACE) process.env.GD_EVAL_BEAM_WORK_TRACE = '1';

  delete globalThis.__GD_HANDPLAN_BUDGET__;
  delete globalThis.__GD_BEAM_PROBE__;
  delete globalThis.__GD_SEARCH_BEAM_WORK__;
  if (cpuSpinMs > 0) {
    const end = Date.now() + cpuSpinMs;
    while (Date.now() < end) { /* eval load */ }
  }
  const ctx = ctxFor(haltedG, seat);
  const handIds = [...ctx.hand].map((c) => c.id).sort((a, b) => a - b);
  const candSig = candidateOrderSig(ctx);
  const parity = {
    handIdsMatch: handIds.join(',') === fixture.handIdSig,
    candidateOrderMatch: candSig === fixture.candidateOrderSig,
    handIds,
    candidateN: generateCandidates(ctx).length,
  };
  if (!parity.handIdsMatch || !parity.candidateOrderMatch) {
    throw new Error(`fixture parity failed: hand=${parity.handIdsMatch} cand=${parity.candidateOrderMatch}`);
  }
  const decideTraces = [];
  globalThis.__GD_EVAL_DECIDE_TRACE__ = (p) => {
    if (p.ctx?.seat === seat || p.seat === seat) decideTraces.push(p);
  };
  globalThis.__GD_EVAL_DECIDE_TRACE_ACTIVE__ = true;
  const decideFn = await loadDecide(instrumentedVer);
  const rec = decideFn(ctx);
  globalThis.__GD_EVAL_DECIDE_TRACE_ACTIVE__ = false;
  delete globalThis.__GD_EVAL_DECIDE_TRACE__;
  const fin = decideTraces.filter((t) => t.phase === 'final').pop();
  for (const k of Object.keys(saved)) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  const bombs = (ranked) => ranked?.filter((r) => r.key.startsWith('bomb:')).slice(0, 12);
  return {
    parity,
    budgetCaps: globalThis.__GD_HANDPLAN_BUDGET__ || null,
    beamProbe: globalThis.__GD_BEAM_PROBE__ || null,
    searchBeamWork: globalThis.__GD_SEARCH_BEAM_WORK__ || null,
    trace: {
      final: fin ? { best: fin.best, bombs: bombs(fin.ranked), rankedTop8: fin.ranked?.slice(0, 8) } : null,
    },
    decide: { ms: rec?.ms, tags: rec?.tags, moveKey: fin?.best?.key ?? null },
    bestKey: fin?.best?.key ?? null,
    bestScore: fin?.best?.score ?? null,
  };
}
