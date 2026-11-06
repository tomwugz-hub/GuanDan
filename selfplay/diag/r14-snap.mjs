/** r14：decide(r10 行为，GD_R14 关) 自对局（进贡 matchLen=8）快照：跟牌局面上 GD_R14=1/2/3 任一改变 decide 选择时保存。
 *  cache/r14-snap/r14_<dealSeed>.bin，可续跑。node selfplay/diag/r14-snap.mjs --m0=9500000 --matches=60 --part=0 --parts=7 */
import fs from 'node:fs'; import path from 'node:path'; import v8 from 'node:v8';
import * as L from '../lib.mjs';
const args = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, v] = s.replace(/^--/, '').split('='); return [k, v ?? '1']; }));
const M0 = Number(args.m0 || 9500000), NM = Number(args.matches || 60), PART = Number(args.part || 0), PARTS = Number(args.parts || 1);
const OUT = path.join(L.ROOT, 'selfplay', 'cache', 'r14-snap'); fs.mkdirSync(OUT, { recursive: true });
delete process.env.GD_R14;
const decide = await L.loadDecide('current');
const key = (m) => (m.cards.length ? m.cards.map((c) => c.id).sort().join(',') + m.combo.type : 'pass');
const ids = (m) => (m?.cards?.length ? m.cards.map((c) => c.id) : []);
let tot = 0;
for (let mi = PART; mi < NM; mi += PARTS) {
  const ms = M0 + mi; const done = path.join(OUT, `m${ms}.done`);
  if (fs.existsSync(done)) continue;
  let step = 0, di = 0; let snaps = [];
  const agent = () => ({ act: (g, seat) => {
    const r = g.round; const rec = decide(L.ctxFor(g, seat));
    if (!L.isLeading(g)) {
      const alt = {};
      for (const k of ['1', '2', '3']) { process.env.GD_R14 = k; alt[k] = decide(L.ctxFor(g, seat)).move; }
      delete process.env.GD_R14;
      if (Object.values(alt).some((m) => key(m) !== key(rec.move))) {
        const { rng, ...rest } = g; const ctx = L.ctxFor(g, seat);
        const kind = (m) => (!m.cards.length ? 'pass' : L.isBombLike(m.combo) ? 'bomb' : 'normal');
        snaps.push({ id: `r14|${L.dealSeedOf(ms, di)}|${step}`, seat, ok: true, g: structuredClone(rest),
          moves: { 0: { ids: ids(rec.move), combo: rec.move.combo, kind: kind(rec.move) }, ...Object.fromEntries(Object.entries(alt).map(([k, m]) => [k, { ids: ids(m), combo: m.combo, kind: kind(m) }])) },
          meta: { cnt: ctx.remainingSeatCounts, shed: ctx.recentShed, lastPlayer: r.lastPlayer, lastType: r.lastCombo.type, lastRank: r.lastCombo.rank, my: ctx.hand.length } });
      }
    }
    step++; return rec;
  } });
  const base = await L.makeAgent('decide', ms * 4);
  const agents = [0, 1, 2, 3].map(() => ({ ...agent(), returnCard: base.returnCard }));
  L.playMatch(ms, agents, { deals: 8, onDeal: (d) => {
    if (snaps.length) { fs.writeFileSync(path.join(OUT, `r14_${d.seed}.bin`), v8.serialize(snaps)); tot += snaps.length; }
    snaps = []; step = 0; di++;
  } });
  fs.writeFileSync(done, '');
  console.error(`[r14snap p${PART}] match ${ms} tot=${tot}`);
}
console.error(`[r14snap p${PART}] done tot=${tot}`);
