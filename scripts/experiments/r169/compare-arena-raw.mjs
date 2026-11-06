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
  const out = {
    fpA: A.meta?.fingerprint,
    fpB: B.meta?.fingerprint,
    sameFingerprint: A.meta?.fingerprint === B.meta?.fingerprint,
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
      out.firstDiffs.push({ key: k, pointsA: da.points, pointsB: db.points, orderA: da.order, orderB: db.order });
      if (++n >= limit) break;
    }
  }
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.sameFingerprint && out.firstDiffs.length === 0 ? 0 : 2);
}

main();
