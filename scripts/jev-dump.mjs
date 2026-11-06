// 打印某些用例给 Jev 的候选与提示（不调用 API）。usage: node scripts/jev-dump.mjs set.jsonl id...
import fs from 'node:fs';
import { runCase } from './run-endgame-eval.mjs';
process.env.JEV_DUMP = '1';
const [f, ...ids] = process.argv.slice(2);
for (const l of fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)) {
  const c = JSON.parse(l);
  if (ids.includes(c.id)) await runCase(c, { useJev: true, apiKey: null });
}
