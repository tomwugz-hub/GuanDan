#!/usr/bin/env node
/**
 * A/B 擂台：同一副牌两种 policy 换座位各打一次。
 *   node selfplay/arena.mjs --a=current --b=pre-selfplay-audit --deals=400 [--seed0=500000]
 *   进贡比赛：--tribute --matchLen=8（每个种子打一场 matchLen 副的比赛，名次/级数/进贡带到下一副；两种朝向按比赛配对）
 *   还贡变体：a/b 后加 #ret=min|plan（如 --a='current#ret=plan' --b='current#ret=min'）
 *   --ckpt=<file.jsonl>：检查点，中断后同一命令续跑。
 * a/b：current、backups/ 下的目录名、random、greedy、jev、startlux（并发 JEV_CONCURRENCY / STARTLUX_CONCURRENCY；bamboo 默认 3）。
 */
import crypto from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { runTasks, dealTasks, pairedStats } from './pool.mjs';
import { loadDecide } from './lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, v] = s.replace(/^--/, '').split(/=(.*)/s); return [k, v ?? '1']; }));
const spec = (x0) => {
  const [x, ...o] = x0.split('#');
  const base = x === 'random' || x === 'greedy' || x === 'jev' || x === 'startlux' ? x : x === 'current' ? 'decide' : `decide@${x}`;
  return [base, ...o].join('#');
};

export async function arena(a, b, deals = 400, seed0 = 500000, { tribute = false, matchLen = 8, ckpt = null, collect = false, threads = undefined, onDone = null } = {}) {
  const A = spec(a), B = spec(b);
  for (const x0 of [a, b]) { const x = x0.split('#')[0]; if (!['random', 'greedy', 'current', 'jev', 'startlux'].includes(x)) await loadDecide(x); } // 先在主线程生成旧版副本，避免 worker 并发写
  const jobs = [];
  const nSeeds = tribute ? Math.ceil(deals / 2 / matchLen) : deals / 2;
  for (let i = 0; i < nSeeds; i++) {
    const seed = seed0 + i;
    jobs.push({ cfg: 'arenaA0', seed, specs: [A, B, A, B], ...(tribute ? { match: matchLen } : {}) });
    jobs.push({ cfg: 'arenaA1', seed, specs: [B, A, B, A], ...(tribute ? { match: matchLen } : {}) });
  }
  const res = await runTasks(dealTasks(jobs, { collect, chunk: tribute ? (collect ? 1 : 2) : 20 }), threads, onDone, { ckpt });
  const deals0 = res.flatMap((r) => r.deals);
  const bySeed = new Map();
  let wins = 0, dd = 0, ddAgainst = 0, viol = res.reduce((s, r) => s + r.violations.length, 0);
  const trib = { deals: 0, resisted: 0, double: 0, aRecv: { n: 0, p: 0 }, bRecv: { n: 0, p: 0 } };
  for (const d of deals0) {
    const aTeam = d.cfg === 'arenaA0' ? 0 : 1;
    const p = d.points[aTeam];
    if (p > 0) wins++;
    if (p === 3) dd++;
    if (p === -3) ddAgainst++;
    const k = d.matchSeed ?? d.seed;
    if (!bySeed.has(k)) bySeed.set(k, [[], []]);
    bySeed.get(k)[aTeam].push({ p, w: p > 0 ? 1 : 0 });
    if (d.tribute && d.tribute.kind !== 'none') {
      trib.deals++;
      if (d.tribute.resisted) trib.resisted++;
      if (d.tribute.kind === 'double') trib.double++;
      if (d.tribute.returns.length) {
        const recvTeam = d.tribute.returns[0].from % 2;
        const o = recvTeam === aTeam ? trib.aRecv : trib.bRecv;
        o.n++; o.p += p;
      }
    }
  }
  // 按种子（单副模式 = 同一副牌；进贡模式 = 同一场比赛）配对：两种朝向各自的每副均值再平均
  const mean = (v, f) => (v.length ? v.reduce((s, x) => s + f(x), 0) / v.length : 0);
  const both = [...bySeed.values()].filter((v) => v[0].length && v[1].length);
  const pts = pairedStats(both.map((v) => (mean(v[0], (x) => x.p) + mean(v[1], (x) => x.p)) / 2));
  const wr = pairedStats(both.map((v) => (mean(v[0], (x) => x.w) + mean(v[1], (x) => x.w)) / 2));
  // Jev / StartLux 代理统计（各 worker 累加）
  let jev = null, startlux = null;
  const blank = () => ({ decisions: 0, skipSingle: 0, skipGoOut: 0, skipNoKey: 0, skipNoServer: 0, eligible: 0, cacheHits: 0, apiCalls: 0, attempts: 0, ok: 0, fallback: {}, ms: [], usage: [], agree: 0, disagree: 0, backend: null, model: null });
  const fold = (into, src) => {
    if (!src) return into;
    into ??= blank();
    for (const k of Object.keys(into)) {
      if (Array.isArray(into[k])) into[k].push(...(src[k] || []));
      else if (k === 'fallback') for (const [f, c] of Object.entries(src.fallback || {})) into.fallback[f] = (into.fallback[f] || 0) + c;
      else if (k === 'backend' || k === 'model') { if (!into[k] && src[k]) into[k] = src[k]; }
      else into[k] += src[k] || 0;
    }
    return into;
  };
  for (const r of res) { jev = fold(jev, r.jev); startlux = fold(startlux, r.startlux); }
  const out = { a, b, deals: deals0.length, seeds: both.length, wins, winRate: wr, levels: pts, doubleWin: dd, doubleLoss: ddAgainst, violations: viol, tribute: tribute ? trib : null, jev, startlux };
  if (collect) Object.defineProperty(out, 'raw', { value: res, enumerable: false });
  return out;
}

/** Stable key for one finished deal row (tribute: matchSeed + dealIdx; else seed). */
export function dealSortKey(d) {
  const ms = d.matchSeed ?? d.seed;
  const di = d.dealIdx != null ? d.dealIdx : 0;
  const cfg = d.cfg || '';
  return `${ms}\t${cfg}\t${di}`;
}

/** Fingerprint over sorted deal outcomes (points + finish order). */
export function fingerprintDeals(dealRows) {
  const sorted = dealRows.slice().sort((a, b) => dealSortKey(a).localeCompare(dealSortKey(b)));
  const lines = sorted.map((d) => `${dealSortKey(d)}|${(d.points || []).join(',')}|${(d.order || []).join(',')}`);
  return crypto.createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex');
}

export function fmtArena(r) {
  const pct = (x) => (100 * x).toFixed(1);
  return `${r.a} vs ${r.b}: ${r.deals} 副（换座位配对），A 胜 ${r.wins}/${r.deals} = ${pct(r.winRate.mean)}% [95% CI ${pct(r.winRate.lo)}–${pct(r.winRate.hi)}]，` +
    `A 每副净升级 ${r.levels.mean.toFixed(3)} [${r.levels.lo.toFixed(3)}, ${r.levels.hi.toFixed(3)}]，A 双上 ${r.doubleWin} / 被双上 ${r.doubleLoss}，不变量违例 ${r.violations}` +
    (r.tribute ? `；进贡比赛 ${r.seeds} 场配对，进贡副 ${r.tribute.deals}（抗贡 ${r.tribute.resisted}，双下双贡 ${r.tribute.double}），A 方还贡的副 A 均分 ${(r.tribute.aRecv.p / (r.tribute.aRecv.n || 1)).toFixed(3)}（n=${r.tribute.aRecv.n}），B 方还贡的副 A 均分 ${(r.tribute.bRecv.p / (r.tribute.bRecv.n || 1)).toFixed(3)}（n=${r.tribute.bRecv.n}）` : '');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const tribute = args.tribute != null && args.tribute !== '0';
  const matchLen = Number(args.matchLen || 8);
  const ckpt = args.ckpt || null;
  const collect = args.collect != null && args.collect !== '0';
  const threads = args.threads != null && args.threads !== '' ? Number(args.threads) : undefined;
  const rawOut = args.rawOut || args['dump-raw'] || null;
  const r = await arena(args.a || 'current', args.b || 'pre-selfplay-audit', Number(args.deals || 400), Number(args.seed0 || 500000),
    { tribute, matchLen, ckpt, collect: collect || !!rawOut, threads });
  console.log(fmtArena(r));
  console.log(`用时 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  if (rawOut) {
    const allDeals = (r.raw || []).flatMap((w) => w.deals || []);
    const fp = fingerprintDeals(allDeals);
    const payload = {
      meta: {
        a: args.a || 'current',
        b: args.b || 'pre-selfplay-audit',
        deals: Number(args.deals || 400),
        seed0: Number(args.seed0 || 500000),
        tribute,
        matchLen,
        threads: threads ?? null,
        ckpt: ckpt || null,
        fingerprint: fp,
        env: {
          GD_R95: process.env.GD_R95 ?? null,
          GD_R169: process.env.GD_R169 ?? null,
          GD_ENDGAME_NO_WALLCLOCK: process.env.GD_ENDGAME_NO_WALLCLOCK ?? null,
        },
      },
      summary: fmtArena(r),
      deals: allDeals.slice().sort((x, y) => dealSortKey(x).localeCompare(dealSortKey(y))),
      rawWorkers: r.raw,
    };
    writeFileSync(rawOut, JSON.stringify(payload));
    console.error(`[arena] wrote raw dump: ${rawOut} (deals=${allDeals.length} fingerprint=${fp})`);
  }
}
