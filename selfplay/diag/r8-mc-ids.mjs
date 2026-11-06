// r8：对指定局面 id 跑 Monte Carlo（同 audit surprise，rollout 数可调）
//   node selfplay/diag/r8-mc-ids.mjs --ids=file.txt --version=post-selfplay-r7 --k1=24 --k2=48 --out=x.json
import fs from 'node:fs';
import { runTasks } from '../pool.mjs';
import * as L from '../lib.mjs';
const args = Object.fromEntries(process.argv.slice(2).map((s) => s.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const VERSION = args.version || 'current';
const D = VERSION === 'current' ? 'decide' : `decide@${VERSION}`;
if (VERSION !== 'current') await L.loadDecide(VERSION);
const ids = fs.readFileSync(args.ids, 'utf8').split(/\s+/).filter(Boolean);
const positions = ids.map((id) => { const [cfg, seed, step] = id.split('|'); return { cfg, seed: Number(seed), step: Number(step), specs: [D, D, D, D] }; });
const tasks = [];
const chunk = Math.max(1, Math.ceil(positions.length / 28));
for (let i = 0; i < positions.length; i += chunk) tasks.push({ kind: 'surprise', version: VERSION, positions: positions.slice(i, i + chunk), maxCands: Number(args.maxCands || 4), k1: Number(args.k1 || 24), k2: Number(args.k2 || 48), stage2Diff: Number(args.stage2 ?? 0.2), extraLegal: Number(args.extraLegal || 0) });
const sr = await runTasks(tasks, undefined, (d, n) => console.error(`mc ${d}/${n}`));
const out = sr.flatMap((r) => r.surprises);
fs.writeFileSync(args.out, JSON.stringify(out, null, 1));
for (const s of out) console.log(s.id, s.rel, s.n, 'chosen', s.chosen, s.chosenMean.toFixed(2), '| best', s.best?.move, s.best ? `${s.best.diff.toFixed(2)} t=${s.best.t.toFixed(1)}` : '', '| alts', s.alts.map((a) => `${a.move}:${a.mean.toFixed(2)}`).join(' '));
