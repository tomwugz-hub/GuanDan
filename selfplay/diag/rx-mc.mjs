/** r15–r17 通用 MC：<tag>-snap 局面，着法 = 基线(m0) 与候选(m<val>)，CRN 固定种子，L.determinize 信念采样。
 *  --cont=base|cand：续打用基线 decide（开关关）或候选 decide（开关开 = 固定计划续打，避免续打偏差）。
 *  node selfplay/diag/rx-mc.mjs --tag=r15 --env=GD_R15 --val=1 --k=60 --cont=base → logs/<tag>-mc-<cont>.jsonl */
import fs from 'node:fs'; import path from 'node:path'; import v8 from 'node:v8';
import * as L from '../lib.mjs'; import { runTasks } from '../pool.mjs';
const args = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, v] = s.replace(/^--/, '').split('='); return [k, v ?? '1']; }));
const TAG = args.tag, ENV = args.env, VAL = String(args.val || '1'), CONT = args.cont || 'base';
const DIR = path.join(L.ROOT, 'selfplay', 'cache', `${TAG}-snap`);
let pos = [];
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.bin')).sort())
  for (const s of v8.deserialize(fs.readFileSync(path.join(DIR, f)))) {
    const a = s.moves[0], b = s.moves[VAL]; if (!b || a.ids.slice().sort().join() === b.ids.slice().sort().join()) continue;
    pos.push({ id: s.id, moves: [{ key: 'm0', ids: a.ids, combo: a.combo }, { key: 'm' + VAL, ids: b.ids, combo: b.combo }], meta: { ...s.meta, m0: a.combo?.type || 'pass', m1: b.combo?.type || 'pass' } });
  }
if (args.max) pos = pos.slice(0, Number(args.max));
console.error('positions', pos.length);
const env = { [ENV]: CONT === 'cand' ? VAL : null };
const tasks = [];
for (let i = 0; i < pos.length; i += 4) tasks.push({ kind: 'snapmc', snapDir: `${TAG}-snap`, env, k: Number(args.k || 60), version: 'current', positions: pos.slice(i, i + 4).map(({ id, moves }) => ({ id, moves })) });
const ck = path.join(L.ROOT, 'selfplay', 'logs', `${TAG}-mc-${CONT}-ckpt.jsonl`);
let n = 0;
const res = await runTasks(tasks, Number(args.workers || 6), () => { if (++n % 20 === 0) console.error(new Date().toLocaleTimeString(), n, '/', tasks.length); }, { ckpt: ck });
const pm = new Map(pos.map((p) => [p.id, p]));
const out = res.flatMap((r) => r.snapmc || []).map((x) => ({ ...x, meta: pm.get(x.id).meta }));
fs.writeFileSync(path.join(L.ROOT, 'selfplay', 'logs', `${TAG}-mc-${CONT}.jsonl`), out.map((x) => JSON.stringify(x)).join('\n') + '\n');
// 汇总：Δ = 候选 − 基线（局面间 95% CI）
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const ci = (a) => { if (a.length < 2) return `n=${a.length}`; const m = mean(a); const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); return `${m >= 0 ? '+' : ''}${m.toFixed(3)} [${(m - 1.96 * sd / Math.sqrt(a.length)).toFixed(3)}, ${(m + 1.96 * sd / Math.sqrt(a.length)).toFixed(3)}] n=${a.length}`; };
const d = out.map((x) => ({ d: mean(x.vals[1].filter((v) => v != null)) - mean(x.vals[0].filter((v) => v != null)), m: x.meta }));
console.log(`${TAG} cont=${CONT} all`, ci(d.map((x) => x.d)));
const grp = (f) => { const g = new Map(); for (const x of d) { const k = f(x.m); if (!g.has(k)) g.set(k, []); g.get(k).push(x.d); } for (const [k, v] of [...g].sort()) console.log('  ', k, ci(v)); };
grp((m) => `${m.m0}->${m.m1}`); grp((m) => `my${m.my <= 9 ? '≤9' : m.my <= 12 ? '10-12' : m.my <= 15 ? '13-15' : '>15'}`);
grp((m) => 't:' + m.lastType); grp((m) => 'my' + m.my);
if (args.groupE) grp((m) => { const s = m.cnt; const e = Math.min(...[1, 3].map((o) => s[((m.seat ?? 0) + o) % 4]).filter((x) => x > 0)); return 'e' + e; });
