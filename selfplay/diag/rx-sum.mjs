// 汇总 rx-mc 输出：node selfplay/diag/rx-sum.mjs logs/<tag>-mc-<cont>.jsonl [--ckpt]
import fs from 'node:fs';
const f = process.argv[2]; let out;
if (f.endsWith('ckpt.jsonl')) out = fs.readFileSync(f, 'utf8').trim().split('\n').flatMap((l) => { try { return JSON.parse(l).r.snapmc || []; } catch { return []; } });
else out = fs.readFileSync(f, 'utf8').trim().split('\n').map(JSON.parse);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const ci = (a) => { if (a.length < 2) return `n=${a.length}`; const m = mean(a); const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); return `${m >= 0 ? '+' : ''}${m.toFixed(3)} [${(m - 1.96 * sd / Math.sqrt(a.length)).toFixed(3)}, ${(m + 1.96 * sd / Math.sqrt(a.length)).toFixed(3)}] n=${a.length}`; };
const d = out.map((x) => mean(x.vals[1].filter((v) => v != null)) - mean(x.vals[0].filter((v) => v != null)));
console.log(f, ci(d), 'pos>0:', d.filter((x) => x > 0).length, 'pos<0:', d.filter((x) => x < 0).length);
