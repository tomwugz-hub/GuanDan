#!/usr/bin/env node
/** 统计各座位过牌率：领出 / 跟搭档 / 跟对手；南家可用 decide 提示或随机合法。 */
const CORE = process.env.CORE || './core.js';
const { newGame, play, botStepDecide, coachMove, isOver, isLeading, makeRng } = await import(CORE);
import { legalMoves } from '../engine/legal.js';
import { singleStrength } from '../engine/ranks.js';
const N = Number(process.argv[2] || 20);
const southMode = process.argv[3] || 'hint';
const st = {}; const bump = (seat, k, pass) => { const s = (st[seat] ??= {}); const o = (s[k] ??= { n: 0, pass: 0 }); o.n++; if (pass) o.pass++; };
const early = {};
const southLead = { n: 0, none: 0 };
function smallSP(c, lv) { return c && (c.type === 'single' || c.type === 'pair') && c.rank !== lv && !['BJ', 'RJ'].includes(c.rank) && singleStrength(c.rank, lv) <= singleStrength('10', lv); }
const rng = makeRng(7);
let deals = 0;
for (let gi = 0; gi < N; gi++) {
  const g = newGame({ seed: 5000 + gi });
  while (!isOver(g)) {
    const seat = g.round.currentSeat;
    const leading = isLeading(g);
    const last = g.round.lastPlayer;
    const kind = leading ? 'lead' : last === (seat + 2) % 4 ? 'partner' : 'enemy';
    const handN = g.round.hands[seat].length;
    const partnerInTrick = kind === 'enemy' && g.trickPlays.some((t) => t.seat === (seat + 2) % 4 && t.cards.length);
    let r;
    if (seat === 0 && southMode !== 'bot') {
      let m;
      if (southMode === 'random') {
        const lm = legalMoves(g.round.hands[0], leading ? null : g.round.lastCombo, g.match.levelRank, leading);
        const nonPass = lm.filter((x) => x.cards.length);
        m = nonPass.length && rng() < 0.7 ? nonPass[Math.floor(rng() * nonPass.length)] : lm[Math.floor(rng() * lm.length)];
      } else m = coachMove(g, 0).move;
      r = play(g, 0, m.cards || [], { by: 'human', preferCombo: m.combo });
    } else r = botStepDecide(g);
    if (!r.ok) throw new Error(r.reason);
    const pass = r.entry.move.cards.length === 0;
    bump(seat, kind, pass);
    if (partnerInTrick) bump(seat, 'enemyAfterPartner', pass);
    const lc = g.round.lastCombo;
    if (kind === 'enemy' && handN >= 10 && smallSP(lc, g.match.levelRank)) bump(seat, 'smallEnemy', pass);
    if (handN >= 15) { const e = (early[seat] ??= {}); const o = (e[kind] ??= { n: 0, pass: 0 }); o.n++; if (pass) o.pass++; }
  }
  deals++;
  // 南家领出小单（≤10）：东/西两家是否都没跟
  const L = g.log;
  for (let i = 0; i < L.length; i++) {
    const e = L[i];
    if (e.seat !== 0 || !e.snapshot.leading || e.move.type !== 'single' || !smallSP({ type: 'single', rank: e.move.rank }, e.snapshot.levelRank)) continue;
    let followed = false;
    for (let j = i + 1; j < L.length; j++) {
      const f = L[j];
      if (f.snapshot.leading || f.seat === 0) break;
      if ((f.seat === 1 || f.seat === 3) && f.move.cards.length) { followed = true; break; }
    }
    southLead.n++; if (!followed) southLead.none++;
  }
}
const fmt = (o) => (o ? `${o.pass}/${o.n} (${Math.round((100 * o.pass) / o.n)}%)` : '-');
console.log(`south=${southMode} deals=${deals}`);
console.log('| seat | lead pass | follow-partner pass | follow-enemy pass | enemy small single/pair ≤10 (hand≥10) pass | early(≥15) enemy |');
console.log('|---|---|---|---|---|---|');
for (const s of [0, 1, 2, 3]) console.log(`| ${['S', 'E', 'N', 'W'][s]} | ${fmt(st[s]?.lead)} | ${fmt(st[s]?.partner)} | ${fmt(st[s]?.enemy)} | ${fmt(st[s]?.smallEnemy)} | ${fmt(early[s]?.enemy)} |`);
console.log(`南家领出小单（≤10）后东西两家都不跟：${southLead.none}/${southLead.n} (${Math.round(100 * southLead.none / Math.max(1, southLead.n))}%)`);
const all = [1, 2, 3].reduce((a, s) => ({ n: a.n + (st[s]?.enemy?.n || 0), pass: a.pass + (st[s]?.enemy?.pass || 0) }), { n: 0, pass: 0 });
console.log(`机器人（东北西）跟敌人牌总过牌率：${fmt(all)}`);
