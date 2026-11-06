/** r12 翻转检查：env 开关下 decide 在 r12-snap 局面的新着法，按 MC 值估 Δ(新−旧)。 R12_SB=1 node selfplay/diag/r12-flip.mjs [--ckpt] */
import fs from 'node:fs'; import * as L from '../lib.mjs'; import { loadSnap } from './r9-pos.mjs';
const R = new URL('../logs/', import.meta.url);
let rows = [];
if (!process.argv.includes('--ckpt') && fs.existsSync(new URL('r12-mc.jsonl', R))) rows = fs.readFileSync(new URL('r12-mc.jsonl', R), 'utf8').trim().split('\n').map(JSON.parse);
else for (const l of fs.readFileSync(new URL('r12-mc-ckpt.jsonl', R), 'utf8').trim().split('\n')) { try { rows.push(...JSON.parse(l).r.snapmc); } catch {} }
const d = await L.loadDecide('current'); const by = {}; const diffs = [];
const key = (ids) => ids.slice().sort().join(',');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
for (const r of rows) {
  const s = loadSnap(r.id, 'r12-snap'); const out = d(L.ctxFor(s.g, s.seat)); const k = key(out.move.cards.map((c) => c.id));
  const ids = { decide: s.dIds, bomb: s.bIds, pass: [], normal: s.nIds };
  const alias = r.alias || (() => { const ms = []; const add = (nm, ii) => { const kk = key(ii); const e = ms.find((m) => m.k === kk); if (e) e.a.push(nm); else ms.push({ k: kk, a: [nm] }); }; add('decide', s.dIds); add('bomb', s.bIds); add('pass', []); if (s.nIds.length) add('normal', s.nIds); return ms.map((m) => m.a); })(); const idx = (nm) => alias.findIndex((a) => a.includes(nm));
  const hit = Object.keys(ids).find((nm) => (nm !== 'normal' || s.nIds.length) && key(ids[nm]) === k);
  const st = k === key(s.dIds) ? 'same' : hit ? 'to:' + hit : 'other';
  let df = 0;
  if (st !== 'same' && hit) { const a = r.vals[idx(hit)], b = r.vals[idx('decide')]; const dd = []; for (let i = 0; i < a.length; i++) if (a[i] != null && b[i] != null) dd.push(a[i] - b[i]); df = mean(dd); }
  if (st !== 'same') diffs.push(df);
  (by[s.dKind + ' ' + st] ??= []).push(df);
}
for (const [k, a] of Object.entries(by).sort()) console.log(k.padEnd(22), a.length, 'meanΔ', mean(a).toFixed(3), 'sumΔ', a.reduce((x, y) => x + y, 0).toFixed(2));
const m = diffs.length ? mean(diffs) : 0, se = diffs.length ? Math.sqrt(mean(diffs.map((x) => (x - m) ** 2)) / diffs.length) : 0;
console.log('flips', diffs.length, '/', rows.length, 'meanΔ', m.toFixed(3), '[', (m - 1.96 * se).toFixed(3), ',', (m + 1.96 * se).toFixed(3), '] per-total', (diffs.reduce((x, y) => x + y, 0) / rows.length).toFixed(4));
