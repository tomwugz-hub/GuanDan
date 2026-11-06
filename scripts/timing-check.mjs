// 计时：对若干评测集逐个 decide，报告最慢/平均耗时（ms）
import fs from 'node:fs';
import { decide } from '../policy/index.js';
import { cards } from '../engine/cards.js';
import { classify } from '../engine/combos.js';
let all = [];
for (const f of process.argv.slice(2)) {
  for (const l of fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)) {
    const d = JSON.parse(l);
    const hand = cards(d.hands[String(d.seat)].join(' '));
    const counts = [0, 1, 2, 3].map((i) => (d.hands[String(i)] || []).length);
    const prev = d.previous ? classify(cards(d.previous.cards.join(' ')), d.levelRank) : null;
    const ctx = { hand, levelRank: d.levelRank, seat: d.seat, leading: !!d.leading, previous: prev, lastPlaySeat: d.previous?.seat ?? null, remainingSeatCounts: d.remainingSeatCounts || counts };
    const t = performance.now();
    try { decide(ctx); } catch (e) { continue; }
    all.push([performance.now() - t, d.id, hand.length]);
  }
}
const big = cards('3C 3D 4C 4D 5C 5D 6C 6D 7C 7D 8C 8D 9C 9D 10C 10D JC JD QC QD KC KD AC AD 2H BJ RJ');
const t0 = performance.now(); decide({ hand: big, levelRank: '2', seat: 0, leading: true, previous: null, remainingSeatCounts: [27, 27, 27, 27] }); all.push([performance.now() - t0, 'full27', 27]);
all.sort((a, b) => b[0] - a[0]);
console.log('n', all.length, 'mean', (all.reduce((s, x) => s + x[0], 0) / all.length).toFixed(1), 'ms; slowest', all.slice(0, 5).map((x) => `${x[1]}(${x[2]}c) ${x[0].toFixed(1)}`).join(', '));
