/** 调试：从 r9 快照取局面跑 decide（DECIDE_DEBUG=8 打印打分）。 node selfplay/diag/r9-pos.mjs <id> [version] */
import fs from 'node:fs'; import v8 from 'node:v8'; import path from 'node:path';
import * as L from '../lib.mjs';
import { makeRng } from '../../play/core.js';
export function loadSnap(id, dir = 'r9-snap') {
  const [cfg, seed] = id.split('|');
  const f = path.join(L.ROOT, 'selfplay', 'cache', dir, `${cfg}_${seed}.bin`);
  const s = v8.deserialize(fs.readFileSync(f)).find((x) => x.id === id);
  if (!s) return null;
  s.g.rng = makeRng(1);
  return s;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const s = loadSnap(process.argv[2]);
  const d = await L.loadDecide(process.argv[3] || 'current');
  const ctx = L.ctxFor(s.g, s.seat);
  console.log(s.id, 'ok', s.ok, 'hand', s.hand, 'counts', s.g.round.hands.map((h) => h.length).join('/'), 'lv', s.g.match.levelRank, 'prev', ctx.previous?.type, ctx.previous?.rank);
  const r = d(ctx);
  console.log('decide ->', r.move.combo.type, r.move.cards.map(L.formatCard).join(' '), r.tags?.join(','));
}
