/** r11：pass->beat / pass->bomb 局面里 decide 的打分（过 vs SL 着法）。 */
import fs from 'node:fs'; import * as L from '../lib.mjs'; import { loadSnap } from './r9-pos.mjs';
const recs = JSON.parse(fs.readFileSync(new URL('../logs/r11-cluster-recs.json', import.meta.url)));
const d = await L.loadDecide('current'); const want = process.argv[2] || 'pass->beat';
for (const r of recs.filter((r) => r.act === want)) {
  const s = loadSnap(r.id, 'r11-snap'); const ctx = L.ctxFor(s.g, s.seat); const out = d(ctx);
  const key = (m) => m.cards.map((c) => c.id).sort().join(',');
  const slk = [...s.slIds].sort().join(',');
  const sc = out.scored || []; const p = sc.find((x) => !x.move.cards.length); const sl = sc.find((x) => key(x.move) === slk);
  console.log(r.diff.toFixed(2), r.id, 'prev', ctx.previous?.type, ctx.previous?.rank, 'cnt', s.g.round.hands.map((h) => h.length).join('/'), 'lv', s.g.match.levelRank, '| lastSeat', ctx.lastPlaySeat, 'me', s.seat);
  console.log('   PASS', p?.score?.toFixed?.(1), p?.tags?.join(','));
  const nb = sc.find((x) => x.move.cards.length); console.log('   BEST', nb?.score.toFixed(1), nb?.move.cards.map(L.formatCard).join(' '), nb?.tags?.join(','));
  console.log('   SL  ', sl ? sl.score.toFixed(1) : 'n/a', sl?.move.cards.map(L.formatCard).join(' '), sl?.tags?.join(','));
}
