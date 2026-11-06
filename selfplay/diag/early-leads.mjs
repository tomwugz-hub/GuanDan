// 早盘领出诊断：为何领单？node selfplay/diag/early-leads.mjs [deals]
import * as L from '../lib.mjs';
const N = Number(process.argv[2] || 60);
const agents = await Promise.all([0,1,2,3].map(() => L.makeAgent('decide')));
const tally = { total: 0, single: 0 }, tagC = {}, altC = {}, gapByAlt = {}, firstLead = { n: 0, single: 0 }, ex = [];
const enemyShortC = {};
for (let s = 1; s <= N; s++) {
  L.playDeal(100000 + s, agents, { onDecision: ({ ctx, rec, move, leading, before, step }) => {
    if (!leading || before.length < 20 || move.cards.length === before.length) return;
    tally.total++;
    const t = move.combo.type;
    if (step === 0 || ctx.firstLeadOfDeal) { firstLead.n++; if (t === 'single') firstLead.single++; }
    (tally.types ||= {})[t] = ((tally.types[t]) || 0) + 1;
    if (t !== 'single') return;
    tally.single++;
    const top = rec.scored[0];
    for (const tg of new Set(top.tags)) tagC[tg] = (tagC[tg] || 0) + 1;
    // best non-single alternative
    const alt = rec.scored.find((r) => r.move.combo.type !== 'single' && !L.isBombLike(r.move.combo));
    const at = alt ? alt.move.combo.type : 'none';
    altC[at] = (altC[at] || 0) + 1;
    if (alt) (gapByAlt[at] ||= []).push(top.score - alt.score);
    if (ex.length < 12 && alt) ex.push(`${before.length}张 hand=${L.sortHand(before, ctx.levelRank).map((c) => c.rank).join('')} lv=${ctx.levelRank} | ${top.move.cards.map(c=>c.rank).join('')} ${top.score.toFixed(0)} [${top.tags.join(',')}] vs ${alt.move.combo.type} ${alt.move.cards.map(c=>c.rank).join('')} ${alt.score.toFixed(0)} [${alt.tags.join(',')}]`);
  } });
}
const med = (a) => { a = a.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
console.log('early leads', tally, 'single share', (tally.single / tally.total).toFixed(3), 'first leads', firstLead);
console.log('tags on chosen single', Object.entries(tagC).sort((a,b)=>b[1]-a[1]).slice(0,15));
console.log('best non-single alt type', altC);
console.log('median gap', Object.fromEntries(Object.entries(gapByAlt).map(([k, v]) => [k, med(v).toFixed(0)])));
console.log(ex.join('\n'));
