/** Eval-only: replicate selfplay/arena.mjs job list for in-process prefix replay. */
export function arenaSpec(x0) {
  const [x, ...o] = x0.split('#');
  const base = x === 'random' || x === 'greedy' || x === 'jev' || x === 'startlux' ? x : x === 'current' ? 'decide' : `decide@${x}`;
  return [base, ...o].join('#');
}

export function buildTributeArenaJobs({ seed0, deals, matchLen, a, b }) {
  const A = arenaSpec(a);
  const B = arenaSpec(b);
  const jobs = [];
  const nSeeds = Math.ceil(deals / 2 / matchLen);
  for (let i = 0; i < nSeeds; i++) {
    const seed = seed0 + i;
    jobs.push({ cfg: 'arenaA0', seed, specs: [A, B, A, B], match: matchLen });
    jobs.push({ cfg: 'arenaA1', seed, specs: [B, A, B, A], match: matchLen });
  }
  return jobs;
}

/** Jobs strictly before target (matchSeed,cfg) in arena task order; optional partial match warm. */
export function slicePrefixJobs(jobs, { matchSeed, cfg, warmDealsBefore = null }) {
  const out = [];
  for (const job of jobs) {
    if (job.seed < matchSeed) {
      out.push(job);
      continue;
    }
    if (job.seed > matchSeed) break;
    if (job.cfg !== cfg) {
      out.push(job);
      continue;
    }
    if (warmDealsBefore == null) break;
    out.push({ ...job, matchOnlyDeals: warmDealsBefore });
    break;
  }
  return out;
}
