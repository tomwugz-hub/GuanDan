/** r12：decide 自对局（进贡 matchLen=8）快照：我方跟敌（上家出牌者=敌）、有可压的炸弹、某敌剩 3–5 张。
 *  每场比赛一个文件 cache/r12-snap/r12_<dealSeed>.bin（按副存），可续跑。 node selfplay/diag/r12-snap.mjs --m0=9000000 --matches=40 --part=0 --parts=6 */
import fs from 'node:fs'; import path from 'node:path'; import v8 from 'node:v8';
import * as L from '../lib.mjs';
import { bombWeight } from '../../engine/compare.js';
const args = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, v] = s.replace(/^--/, '').split('='); return [k, v ?? '1']; }));
const M0 = Number(args.m0 || 9000000), NM = Number(args.matches || 40), PART = Number(args.part || 0), PARTS = Number(args.parts || 1);
const OUT = path.join(L.ROOT, 'selfplay', 'cache', 'r12-snap'); fs.mkdirSync(OUT, { recursive: true });
const decide = await L.loadDecide('current');
const key = (m) => (m.cards.length ? m.cards.map((c) => c.id).sort().join(',') + m.combo.type : 'pass');
const ids = (m) => (m?.cards?.length ? m.cards.map((c) => c.id) : []);
let tot = 0;
for (let mi = PART; mi < NM; mi += PARTS) {
  const ms = M0 + mi; const done = path.join(OUT, `m${ms}.done`);
  if (fs.existsSync(done)) continue;
  let step = 0, di = 0; let snaps = [];
  const agent = (s) => ({ act: (g, seat) => {
    const r = g.round; const rec = decide(L.ctxFor(g, seat));
    const lv = g.match.levelRank;
    if (!L.isLeading(g) && r.lastPlayer != null && (r.lastPlayer - seat + 4) % 4 % 2 === 1) {
      const cnt = r.hands.map((h) => h.length);
      const en = [(seat + 1) % 4, (seat + 3) % 4];
      if (en.some((e) => cnt[e] >= 3 && cnt[e] <= 5)) {
        const legal = L.legalMoves(r.hands[seat], r.lastCombo, lv, false).filter((m) => m.cards.length);
        const bombs = legal.filter((m) => L.isBombLike(m.combo));
        if (bombs.length) {
          const sc = rec.scored || [];
          const sBomb = sc.find((x) => x.move.cards.length && L.isBombLike(x.move.combo));
          const cheap = bombs.slice().sort((a, b) => bombWeight(a.combo) - bombWeight(b.combo) || L.singleStrength(a.combo.rank, lv) - L.singleStrength(b.combo.rank, lv))[0];
          const bomb = sBomb?.move || cheap;
          const normals = legal.filter((m) => !L.isBombLike(m.combo));
          const sNorm = sc.find((x) => x.move.cards.length && !L.isBombLike(x.move.combo));
          const normal = sNorm?.move || normals[0] || null;
          const dm = rec.move;
          const dKind = !dm.cards.length ? 'pass' : L.isBombLike(dm.combo) ? 'bomb' : 'normal';
          const { rng, ...rest } = g;
          snaps.push({ id: `r12|${L.dealSeedOf(ms, di)}|${step}`, seat, ok: true, g: structuredClone(rest),
            dIds: ids(dm), dCombo: dm.combo, dKind, bIds: ids(bomb), bCombo: bomb.combo, nIds: ids(normal), nCombo: normal?.combo,
            meta: { cnt, lastPlayer: r.lastPlayer, nextIsLast: (seat + 3) % 4 === r.lastPlayer, lastType: r.lastCombo.type, lastRank: r.lastCombo.rank, lv,
              nBombs: bombs.length, bombType: bomb.combo.type, bombSize: bomb.cards.length, bombW: bombWeight(bomb.combo), cheapSame: key(cheap) === key(bomb),
              hasNormal: normals.length > 0, plays: L.minPlays ? L.minPlays(r.hands[seat], lv) : null, tags: rec.tags, dScore: sc[0]?.score, bScore: sc.find((x) => key(x.move) === key(bomb))?.score ?? null } });
        }
      }
    }
    step++; return rec;
  }, returnCard: undefined });
  const base = await L.makeAgent('decide', ms * 4);
  const agents = [0, 1, 2, 3].map((s) => ({ ...agent(s), returnCard: base.returnCard }));
  L.playMatch(ms, agents, { deals: 8, onDeal: (d) => {
    if (snaps.length) { fs.writeFileSync(path.join(OUT, `r12_${d.seed}.bin`), v8.serialize(snaps)); tot += snaps.length; }
    snaps = []; step = 0; di++;
  } });
  fs.writeFileSync(done, '');
  console.error(`[r12snap p${PART}] match ${ms} tot=${tot}`);
}
console.error(`[r12snap p${PART}] done tot=${tot}`);
