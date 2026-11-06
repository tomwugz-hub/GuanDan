/** r14：r14-snap 局面 MC（decide=r10 行为续打，GD_R14 关，固定种子/CRN，同 r12-mc）：着法 = GD_R14=0/1/2/3 的选择（去重，alias 记录）。
 *  node selfplay/diag/r14-mc.mjs --k=60 → logs/r14-mc.jsonl（ckpt logs/r14-mc-ckpt.jsonl） */
import fs from 'node:fs'; import path from 'node:path'; import v8 from 'node:v8';
import * as L from '../lib.mjs'; import { runTasks } from '../pool.mjs';
delete process.env.GD_R14;
const args = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, v] = s.replace(/^--/, '').split('='); return [k, v ?? '1']; }));
const DIR = path.join(L.ROOT, 'selfplay', 'cache', 'r14-snap');
let pos = [];
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.bin')).sort())
  for (const s of v8.deserialize(fs.readFileSync(path.join(DIR, f)))) {
    const ms = [];
    for (const k of ['0', '1', '2', '3']) { const m = s.moves[k]; const kk = m.ids.slice().sort().join(','); const e = ms.find((x) => x.k === kk); if (e) e.alias.push('m' + k); else ms.push({ key: 'm' + k, k: kk, alias: ['m' + k], ids: m.ids, combo: m.combo }); }
    pos.push({ id: s.id, moves: ms.map(({ key, ids, combo }) => ({ key, ids, combo })), alias: ms.map((m) => m.alias), meta: s.meta, kinds: Object.fromEntries(Object.entries(s.moves).map(([k, m]) => [k, m.kind])) });
  }
if (args.max) pos = pos.slice(0, Number(args.max));
console.error('positions', pos.length, 'moves', pos.reduce((a, p) => a + p.moves.length, 0));
const tasks = [];
for (let i = 0; i < pos.length; i += 4) tasks.push({ kind: 'snapmc', snapDir: 'r14-snap', k: Number(args.k || 60), version: 'current', positions: pos.slice(i, i + 4).map(({ id, moves }) => ({ id, moves })) });
const ck = path.join(L.ROOT, 'selfplay', 'logs', args.ckpt || 'r14-mc-ckpt.jsonl');
let n = 0;
const res = await runTasks(tasks, Number(args.workers || 4), () => { if (++n % 20 === 0) console.error(new Date().toLocaleTimeString(), n, '/', tasks.length); }, { ckpt: ck });
const pm = new Map(pos.map((p) => [p.id, p]));
const out = res.flatMap((r) => r.snapmc || []).map((x) => ({ ...x, alias: pm.get(x.id).alias, meta: pm.get(x.id).meta, kinds: pm.get(x.id).kinds }));
fs.writeFileSync(path.join(L.ROOT, 'selfplay', 'logs', args.out || 'r14-mc.jsonl'), out.map((x) => JSON.stringify(x)).join('\n') + '\n');
console.error('done', out.length);
