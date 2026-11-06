/** r14：用 r14-mc ckpt 的 MC 值，估当前 policy（默认开关）在快照上的翻转 Δ（样本内；只计当前着法落在已评估着法里的局面）。 */
import fs from 'node:fs'; import path from 'node:path'; import v8 from 'node:v8';
import * as L from '../lib.mjs';
const LOG = path.join(L.ROOT, 'selfplay', 'logs'); const rows = new Map();
for (const l of fs.readFileSync(path.join(LOG, 'r14-mc-ckpt.jsonl'), 'utf8').trim().split('\n')) { try { for (const r of JSON.parse(l).r.snapmc || []) rows.set(r.id, r); } catch {} }
const DIR = path.join(L.ROOT, 'selfplay', 'cache', 'r14-snap'); const decide = await L.loadDecide('current');
const k = (ids) => ids.slice().sort().join(','); const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const D = [], ALL = []; let miss = 0;
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.bin'))) for (const s of v8.deserialize(fs.readFileSync(path.join(DIR, f)))) {
  const r = rows.get(s.id); if (!r) continue;
  s.g.rng = L.makeRng ? L.makeRng(1) : () => 0.5;
  const m = decide(L.ctxFor(s.g, s.seat)).move; const mk = k(m.cards.map((c) => c.id));
  const val = (key) => { for (let i = 0; i < r.keys.length; i++) { const mv = s.moves[r.keys[i].slice(1)]; if (k(mv.ids) === key) return mean(r.vals[i]); } return null; };
  const v0 = val(k(s.moves[0].ids)), v = val(mk);
  if (v == null) { miss++; continue; }
  ALL.push(v - v0); if (mk !== k(s.moves[0].ids)) D.push(v - v0);
}
const ci = (a) => { const m = mean(a); const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); return `${m.toFixed(3)} [${(m - 1.96 * sd / Math.sqrt(a.length)).toFixed(3)}, ${(m + 1.96 * sd / Math.sqrt(a.length)).toFixed(3)}] n=${a.length}`; };
console.log('flipped', ci(D), '| per-pos', ci(ALL), '| unevaluated move', miss);
