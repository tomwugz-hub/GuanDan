import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decide } from '../policy/index.js';
import { formatCard } from '../engine/cards.js';
import { newGame, play, ctxFor } from '../play/core.js';

const LOG = new URL('../userlogs/2026-10-25-game5.jsonl', import.meta.url);
const lines = fs.readFileSync(LOG, 'utf8').trim().split('\n').map(JSON.parse);
const moves = lines.filter((l) => l.type === 'move' && l.deal === 1);
const LV = lines.find((l) => l.type === 'deal' && l.deal === 1).levelRank;
const pick = (h, labs) => { const u = new Set(); return labs.map((lab) => { const c = h.find((x) => formatCard(x) === lab && !u.has(x.id)); u.add(c.id); return c; }); };
function gameAt(n) {
  const g = newGame({ seed: lines[0].seed, levelRank: LV, progression: false }); const pool = g.round.hands.flat();
  g.round.hands = [0, 1, 2, 3].map((s) => moves[0].handsAll[s].map((lab) => pool.splice(pool.findIndex((c) => formatCard(c) === lab), 1)[0]));
  g.round.currentSeat = moves[0].seat; g.round.tribute = null;
  for (const m of moves) { if (m.n >= n) break; play(g, m.seat, pick(g.round.hands[m.seat], m.move.cards), { by: 'replay', preferCombo: { type: m.move.type, rank: m.move.rank } }); }
  return g;
}
const coachAt = (n) => decide(ctxFor(gameAt(n), 0));
const withEnv = (v, f) => { const o = process.env.GD_R25; process.env.GD_R25 = v; try { return f(); } finally { if (o == null) delete process.env.GD_R25; else process.env.GD_R25 = o; } };

test('r25 bit1 (default): game5 n1 true opening leads isolated low pair, not straight 7-J', () => {
  delete process.env.GD_R25;
  const r = coachAt(1);
  assert.equal(r.move.combo.type, 'pair');
  assert.ok(['3', '5'].includes(r.move.combo.rank), r.move.combo.rank);
  assert.ok(r.tags.includes('r25OpenLonePair'));
});
test('r25 GD_R25=0 restores straight at n1', () => {
  withEnv('0', () => assert.equal(coachAt(1).move.combo.type, 'straight'));
});
test('r25 default: n49/n53 still go out (bit2/bit4 rejected, opt-in only)', () => {
  delete process.env.GD_R25;
  assert.equal(coachAt(49).move.cards.length, 5);
  assert.equal(coachAt(53).move.cards.length, 5);
  withEnv('2', () => assert.equal(coachAt(49).move.cards.length, 0));
  withEnv('4', () => assert.equal(coachAt(53).move.cards.length, 0));
});
