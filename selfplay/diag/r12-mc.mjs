/** r12：r12-snap 局面上 MC（decide 续打，固定种子，同 r9 snapmc）：着法 = decide / bomb / pass / normal（去重，keys 记录所有别名）。
 *  ckpt logs/r12-mc-ckpt.jsonl → logs/r12-mc.jsonl。 node selfplay/diag/r12-mc.mjs --k=100 [--max=N] */
import fs from 'node:fs'; import path from 'node:path'; import v8 from 'node:v8';
import * as L from '../lib.mjs'; import { runTasks } from '../pool.mjs';
const args = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, v] = s.replace(/^--/, '').split('='); return [k, v ?? '1']; }));
const DIR = path.join(L.ROOT, 'selfplay', 'cache', 'r12-snap');
let pos = [];
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.bin')).sort())
  for (const s of v8.deserialize(fs.readFileSync(path.join(DIR, f)))) {
    const ms = [];
    const add = (key, ids, combo) => { const k = ids.slice().sort().join(','); const e = ms.find((m) => m.k === k); if (e) e.alias.push(key); else ms.push({ key, k, alias: [key], ids, combo }); };
    add('decide', s.dIds, s.dCombo); add('bomb', s.bIds, s.bCombo); add('pass', [], { type: 'pass' });
    if (s.nIds.length) add('normal', s.nIds, s.nCombo);
    pos.push({ id: s.id, moves: ms.map(({ key, ids, combo }) => ({ key, ids, combo })), alias: ms.map((m) => m.alias) });
  }
if (args.max) pos = pos.slice(0, Number(args.max));
console.error('positions', pos.length, 'moves', pos.reduce((a, p) => a + p.moves.length, 0));
const tasks = [];
for (let i = 0; i < pos.length; i += 4) tasks.push({ kind: 'snapmc', snapDir: 'r12-snap', k: Number(args.k || 100), version: 'current', positions: pos.slice(i, i + 4).map(({ id, moves }) => ({ id, moves })) });
const ck = path.join(L.ROOT, 'selfplay', 'logs', args.ckpt || 'r12-mc-ckpt.jsonl');
let n = 0;
const res = await runTasks(tasks, Number(args.workers || 7), () => { if (++n % 20 === 0) console.error(new Date().toLocaleTimeString(), n, '/', tasks.length); }, { ckpt: ck });
const am = new Map(pos.map((p) => [p.id, p.alias]));
const out = res.flatMap((r) => r.snapmc || []).map((x) => ({ ...x, alias: am.get(x.id) }));
fs.writeFileSync(path.join(L.ROOT, 'selfplay', 'logs', args.out || 'r12-mc.jsonl'), out.map((x) => JSON.stringify(x)).join('\n') + '\n');
console.error('done', out.length);
