#!/usr/bin/env node
/**
 * From arena --dump-raw JSON (collect=1): first differing ACTION on one deal, with ctx proof.
 *
 *   node scripts/experiments/r169/extract-raw-action-diff.mjs runA.json runB.json \
 *     --matchSeed=26991017 --cfg=arenaA1 --dealIdx=5
 */
import fs from 'node:fs';
import { compareActionTraces } from './match-action-record.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((s) => {
  const m = s.replace(/^--/, '').match(/^([^=]+)=(.*)$/s);
  return m ? [m[1], m[2]] : [s.replace(/^--/, ''), '1'];
}));

const paths = process.argv.slice(2).filter((x) => !x.startsWith('--') && x.endsWith('.json'));
const matchSeed = Number(args.matchSeed || 26991017);
const cfg = args.cfg || 'arenaA1';
const dealIdx = Number(args.dealIdx ?? 5);
const dealSeed = matchSeed * 16 + dealIdx;

function loadDecisions(p) {
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  return j.rawWorkers.flatMap((w) => w.decisions || []);
}

function rawToRecord(d, ds) {
  return {
    dealSeed: ds,
    step: d.step,
    spec: d.spec,
    seat: d.seat,
    rel: d.rel,
    hand: d.hand,
    prevStr2: d.prevStr2,
    moveStr: d.moveStr,
    tags: d.tags || [],
    nCands: d.nCands,
    enemyMin: d.enemyMin,
    partnerN: d.partnerN,
  };
}

function filterDeal(decisions, ds = dealSeed) {
  const pref = `${cfg}|${ds}|`;
  return decisions.filter((d) => d.id?.startsWith(pref)).map((d) => rawToRecord(d, ds));
}

const [pa, pb] = paths;
if (!pa || !pb) {
  console.error('usage: extract-raw-action-diff.mjs a.json b.json --matchSeed= --cfg= --dealIdx=');
  process.exit(1);
}

const a = filterDeal(loadDecisions(pa));
const b = filterDeal(loadDecisions(pb));
const cmp = compareActionTraces(a, b, { dealSeed });

const prior = [];
for (let di = 0; di < dealIdx; di++) {
  const ds = matchSeed * 16 + di;
  const pref = `${cfg}|${ds}|`;
  const da = filterDeal(loadDecisions(pa), ds);
  const db = filterDeal(loadDecisions(pb), ds);
  prior.push({ dealIdx: di, ...compareActionTraces(da, db, { dealSeed: ds }) });
}

const dealA = JSON.parse(fs.readFileSync(pa)).deals.find((d) => d.matchSeed === matchSeed && d.cfg === cfg && d.dealIdx === dealIdx);
const dealB = JSON.parse(fs.readFileSync(pb)).deals.find((d) => d.matchSeed === matchSeed && d.cfg === cfg && d.dealIdx === dealIdx);

const out = {
  source: { a: pa, b: pb },
  matchSeed,
  cfg,
  dealIdx,
  dealSeed,
  dealOutcome: {
    a: { points: dealA?.points, steps: dealA?.steps, order: dealA?.order },
    b: { points: dealB?.points, steps: dealB?.steps, order: dealB?.order },
  },
  priorDealsActionParity: prior.map((p) => ({
    dealIdx: p.dealIdx,
    prefixIdentical: p.prefixIdentical,
    firstDiff: p.firstDiff?.kind ?? null,
  })),
  deal5: cmp,
  note: 'Recorded ctx at firstDiff is from raw collect; ms omitted from fingerprint. Identical nCands does not prove identical candidate ordering.',
};

console.log(JSON.stringify(out, null, 2));
process.exit(cmp.firstDiff ? 2 : 0);
