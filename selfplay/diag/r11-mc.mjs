/** r11：r11-snap 快照上 decide 着法 vs StartLux 着法 MC（k 次确定化，decide 续打，同 r9 snapmc 种子）。
 *  ckpt logs/r11-mc-ckpt.jsonl（续跑）→ logs/r11-mc.jsonl 汇总。 node selfplay/diag/r11-mc.mjs --k=24 [--version=current] */
import fs from 'node:fs'; import path from 'node:path'; import v8 from 'node:v8';
import * as L from '../lib.mjs'; import { runTasks } from '../pool.mjs';
const args = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, v] = s.replace(/^--/, '').split('='); return [k, v ?? '1']; }));
const DIR = path.join(L.ROOT, 'selfplay', 'cache', args.dir || 'r11-snap');
const pos = [];
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.bin')).sort())
  for (const s of v8.deserialize(fs.readFileSync(path.join(DIR, f)))) if (s.ok)
    pos.push({ id: s.id, moves: [{ key: 'decide', ids: s.dIds, combo: s.dCombo }, { key: 'sl', ids: s.slIds, combo: s.slCombo }] });
console.error('positions', pos.length);
const tasks = [];
for (let i = 0; i < pos.length; i += 4) tasks.push({ kind: 'snapmc', snapDir: args.dir || 'r11-snap', k: Number(args.k || 24), version: args.version || 'current', positions: pos.slice(i, i + 4) });
const ck = path.join(L.ROOT, 'selfplay', 'logs', args.ckpt || 'r11-mc-ckpt.jsonl');
let n = 0;
const res = await runTasks(tasks, Number(args.workers || 7), () => { if (++n % 20 === 0) console.error(new Date().toLocaleTimeString(), n, '/', tasks.length); }, { ckpt: ck });
const out = res.flatMap((r) => r.snapmc || []);
fs.writeFileSync(path.join(L.ROOT, 'selfplay', 'logs', args.out || 'r11-mc.jsonl'), out.map((x) => JSON.stringify(x)).join('\n') + '\n');
console.error('done', out.length);
