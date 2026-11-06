/** r14：读 logs/r14-mc-ckpt.jsonl（或 --out=r14-mc.jsonl），按变体统计 Δ = 变体着法 − r10 着法（CRN 配对，局面间 95%CI）。 */
import fs from 'node:fs'; import path from 'node:path'; import v8 from 'node:v8';
import * as L from '../lib.mjs';
const args = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, v] = s.replace(/^--/, '').split('='); return [k, v ?? '1']; }));
const LOG = path.join(L.ROOT, 'selfplay', 'logs');
let rows = [];
if (args.out) rows = fs.readFileSync(path.join(LOG, args.out), 'utf8').trim().split('\n').map(JSON.parse);
else for (const l of fs.readFileSync(path.join(LOG, 'r14-mc-ckpt.jsonl'), 'utf8').trim().split('\n')) { try { rows.push(...(JSON.parse(l).r.snapmc || [])); } catch {} }
const DIR = path.join(L.ROOT, 'selfplay', 'cache', 'r14-snap'); const snaps = new Map();
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.bin'))) for (const s of v8.deserialize(fs.readFileSync(path.join(DIR, f)))) snaps.set(s.id, s);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const ci = (a) => { const m = mean(a); const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); return `${m >= 0 ? '+' : ''}${m.toFixed(3)} [${(m - 1.96 * sd / Math.sqrt(a.length)).toFixed(3)}, ${(m + 1.96 * sd / Math.sqrt(a.length)).toFixed(3)}] n=${a.length}`; };
const groups = {};
const add = (g, d) => (groups[g] ||= []).push(d);
for (const r of rows) {
  const s = snaps.get(r.id); if (!s) continue;
  const val = (k) => { const i = r.keys.indexOf(k); return i >= 0 ? mean(r.vals[i]) : null; };
  const v0 = val('m0');
  const seat = s.seat, cnt = s.meta.cnt, shed = s.meta.shed || [];
  const en = [(seat + 1) % 4, (seat + 3) % 4].filter((e) => cnt[e] >= 2);
  const short = en.some((e) => cnt[e] <= 5);
  const trig = short ? 'eLE5' : en.some((e) => cnt[e] <= 11 && (shed[e] || 0) >= 6) ? 'shed' : 'race';
  for (const k of ['1', '2', '3']) {
    // 变体着法的值：所在 alias 组
    const key = r.keys.find((kk, i) => (r.alias || [[kk]])[i]?.includes('m' + k)) ?? r.keys[(r.keys.length === 1 ? 0 : -1)];
    const grp = (rows.alias) ? null : null;
    let vk = null; for (let i = 0; i < r.keys.length; i++) { const al = r.alias?.[i] || (s.moves ? Object.keys(s.moves).filter((q) => s.moves[q].ids.slice().sort().join() === s.moves[r.keys[i].slice(1)].ids.slice().sort().join()).map((q) => 'm' + q) : [r.keys[i]]); if (al.includes('m' + k)) vk = mean(r.vals[i]); }
    if (vk == null) continue;
    const d = vk - v0;
    add(`v${k} all(per-pos incl 0)`, d);
    if (Math.abs(d) > 0 || s.moves[k].ids.slice().sort().join() !== s.moves[0].ids.slice().sort().join()) {
      if (s.moves[k].ids.slice().sort().join() === s.moves[0].ids.slice().sort().join()) continue;
      add(`v${k} changed`, d); add(`v${k} changed ${s.moves[0].kind}->${s.moves[k].kind}`, d); add(`v${k} changed trig=${trig}`, d);
      add(`v${k} changed ${s.moves[k].kind} trig=${trig} my${s.meta.my >= 13 ? '>=13' : s.meta.my >= 8 ? '8-12' : '<8'}`, d);
    }
  }
}
for (const g of Object.keys(groups).sort()) console.log(g.padEnd(40), ci(groups[g]));
