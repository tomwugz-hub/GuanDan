#!/usr/bin/env node
/**
 * Compare two arena --dump-raw JSON files (same layout as selfplay/arena.mjs writes).
 * Reports first N per-deal divergences on points and finish order.
 *
 * Usage:
 *   node scripts/experiments/r169/compare-arena-raw.mjs a.json b.json [--limit=20]
 */
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map((s) => {
  const m = s.replace(/^--/, '').match(/^([^=]+)=(.*)$/s);
  return m ? [m[1], m[2]] : [s.replace(/^--/, ''), '1'];
}));

const limit = Number(args.limit || 20);

function dealKey(d) {
  const ms = d.matchSeed ?? d.seed;
  const di = d.dealIdx != null ? d.dealIdx : 0;
  const cfg = d.cfg || '';
  return `${ms}|${cfg}|${di}`;
}

function load(p) {
  const o = JSON.parse(fs.readFileSync(p, 'utf8'));
  const deals = (o.deals || []).reduce((m, d) => { m.set(dealKey(d), d); return m; }, new Map());
  return { path: p, meta: o.meta, deals };
}

function main() {
  const [pa, pb] = process.argv.slice(2).filter((x) => !x.startsWith('--'));
  if (!pa || !pb) {
    console.error('usage: compare-arena-raw.mjs <a.json> <b.json> [--limit=N]');
    process.exit(1);
  }
  const A = load(pa);
  const B = load(pb);
  const envDiff = (() => {
    const ea = A.meta?.env || {};
    const eb = B.meta?.env || {};
    const keys = [...new Set([...Object.keys(ea), ...Object.keys(eb)])].sort();
    const diff = {};
    for (const k of keys) {
      if (ea[k] !== eb[k]) diff[k] = { a: ea[k] ?? null, b: eb[k] ?? null };
    }
    return Object.keys(diff).length ? diff : null;
  })();
  const same = (x, y) => x === y;
  const configParityOk = same(A.meta?.a, B.meta?.a)
    && same(A.meta?.b, B.meta?.b)
    && same(A.meta?.seed0, B.meta?.seed0)
    && same(A.meta?.deals, B.meta?.deals)
    && same(A.meta?.policySource?.a?.sha256, B.meta?.policySource?.a?.sha256)
    && same(A.meta?.policySource?.b?.sha256, B.meta?.policySource?.b?.sha256)
    && same(A.meta?.node, B.meta?.node)
    && envDiff == null;
  const metaParity = {
    configParityOk,
    aSpec: { runA: A.meta?.a, runB: B.meta?.a },
    bSpec: { runA: A.meta?.b, runB: B.meta?.b },
    seed0: { runA: A.meta?.seed0, runB: B.meta?.seed0 },
    policyShaA: { runA: A.meta?.policySource?.a?.sha256, runB: B.meta?.policySource?.a?.sha256 },
    policyShaB: { runA: A.meta?.policySource?.b?.sha256, runB: B.meta?.policySource?.b?.sha256 },
    envDiff,
    node: { runA: A.meta?.node, runB: B.meta?.node },
    informational: {
      wallMs: { runA: A.meta?.wallMs, runB: B.meta?.wallMs },
      pid: { runA: A.meta?.pid, runB: B.meta?.pid },
    },
  };
  const out = {
    fpA: A.meta?.fingerprint,
    fpB: B.meta?.fingerprint,
    sameFingerprint: A.meta?.fingerprint === B.meta?.fingerprint,
    metaParity,
    firstDiffs: [],
  };
  const keys = [...new Set([...A.deals.keys(), ...B.deals.keys()])].sort();
  let n = 0;
  for (const k of keys) {
    const da = A.deals.get(k);
    const db = B.deals.get(k);
    if (!da || !db) {
      out.firstDiffs.push({ key: k, reason: 'missing', a: !!da, b: !!db });
      if (++n >= limit) break;
      continue;
    }
    const pa = (da.points || []).join(',');
    const pb = (db.points || []).join(',');
    const oa = (da.order || []).join(',');
    const ob = (db.order || []).join(',');
    if (pa !== pb || oa !== ob) {
      out.firstDiffs.push({
        key: k,
        pointsA: da.points,
        pointsB: db.points,
        orderA: da.order,
        orderB: db.order,
        stepsA: da.steps ?? null,
        stepsB: db.steps ?? null,
      });
      if (++n >= limit) break;
    }
  }
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.sameFingerprint && out.firstDiffs.length === 0 ? 0 : 2);
}

main();
