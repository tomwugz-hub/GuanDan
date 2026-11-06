import fs from 'node:fs'; import * as L from '../lib.mjs'; import { loadSnap } from './r9-pos.mjs';
const recs = JSON.parse(fs.readFileSync(new URL('../logs/r11-cluster-recs.json', import.meta.url)));
const d = await L.loadDecide('current'); const by = {};
for (const r of recs) { const s = loadSnap(r.id, 'r11-snap'); const out = d(L.ctxFor(s.g, s.seat));
  const k = out.move.cards.map((c) => c.id).sort().join(','); const st = k === [...s.slIds].sort().join(',') ? 'toSL' : k === [...s.dIds].sort().join(',') ? 'same' : 'other';
  const g = (by[r.act + ' ' + st] ??= []); g.push(r.diff); }
for (const [k, a] of Object.entries(by).sort()) console.log(k.padEnd(22), a.length, (a.reduce((x, y) => x + y, 0) / a.length).toFixed(3), 'sumΔ', a.reduce((x, y) => x + y, 0).toFixed(2));
