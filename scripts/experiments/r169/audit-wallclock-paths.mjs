#!/usr/bin/env node
/** Static audit: Date.now / performance.now on decision/branches paths (eval diagnosis). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dirs = ['policy', 'search', 'play', 'engine'];
const re = /Date\.now|performance\.now/g;

const hits = [];
for (const d of dirs) {
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    const p = path.join(dir, f);
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (re.test(line)) {
        re.lastIndex = 0;
        hits.push({ file: path.relative(ROOT, p), line: i + 1, text: line.trim().slice(0, 120) });
      }
    });
  }
}

const out = `/opt/cursor/artifacts/r169-wallclock-audit-${new Date().toISOString().slice(0, 10)}.json`;
fs.writeFileSync(out, JSON.stringify({
  root: ROOT,
  tributeLive: 'policy/tribute.js (returnCard; not in backup snapshot hash)',
  hits,
  budgetBranches: hits.filter((h) => /timeMs|nodeBudget|break|wallclock|softClock|HANDPLAN|ENDGAME/i.test(h.text)),
}, null, 2));
console.error(`wrote ${out} (${hits.length} lines)`);
console.log(JSON.stringify({ count: hits.length, out }, null, 2));
