// Usage: DECIDE_DEBUG=1 node scripts/debug-case.mjs set.jsonl id [id...]
import fs from 'node:fs';
import { runCase } from './run-endgame-eval.mjs';
const [set, ...ids] = process.argv.slice(2);
const rows = fs.readFileSync(set, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
for (const id of ids) {
  const c = rows.find((r) => r.id === id);
  console.log('=====', id, JSON.stringify(c.gold.alts || c.gold), c.gold.rationale || '');
  const r = await runCase(c, { useJev: false });
  console.log('->', r.decide, r.decide_ok);
}
