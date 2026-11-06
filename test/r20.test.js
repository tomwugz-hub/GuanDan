import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decide } from '../policy/index.js';
import { formatCard } from '../engine/cards.js';
import { newGame, play, ctxFor } from '../play/core.js';

const LOG = new URL('../userlogs/2026-10-24-game4.jsonl', import.meta.url);
const lines = fs.readFileSync(LOG, 'utf8').trim().split('\n').map(JSON.parse);
const moves = lines.filter((l) => l.type === 'move' && l.deal === 2);
const LV = lines.find((l) => l.type === 'deal' && l.deal === 2).levelRank;
const pick = (h, labs) => { const u = new Set(); return labs.map((lab) => { const c = h.find((x) => formatCard(x) === lab && !u.has(x.id)); u.add(c.id); return c; }); };
function ctxAt(n) {
  const g = newGame({ seed: lines[0].seed, levelRank: LV, progression: false }); const pool = g.round.hands.flat();
  g.round.hands = [0, 1, 2, 3].map((s) => moves[0].handsAll[s].map((lab) => pool.splice(pool.findIndex((c) => formatCard(c) === lab), 1)[0]));
  g.round.currentSeat = moves[0].seat; g.round.tribute = null;
  for (const m of moves) { if (m.n >= n) break; play(g, m.seat, pick(g.round.hands[m.seat], m.move.cards), { by: 'replay', preferCombo: { type: m.move.type, rank: m.move.rank } }); }
  return ctxFor(g, 0);
}
const rec = (n) => decide(ctxAt(n)).move.cards.map(formatCard).sort().join(',');
test('r20 game4 deal2 move 38: counter enemy 10-bomb with JJJJ', () => assert.equal(rec(38), ['JC', 'JD', 'JS', 'JS'].sort().join(',')));
test('r20 game4 deal2 move 54: RJ over enemy BJ', () => assert.equal(rec(54), 'RJ'));
test('r20 game4 deal2 move 66: lead 88, keep QQQ+wild bomb', () => assert.equal(rec(66), ['8D', '8H'].sort().join(',')));
test('r20 game4 deal2 move 70: pass on partner KK (partner 2 cards)', () => assert.equal(rec(70), ''));
