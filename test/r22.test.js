import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decide } from '../policy/index.js';
import { formatCard } from '../engine/cards.js';
import { newGame, play, ctxFor, coachGap } from '../play/core.js';

const LOG = new URL('../userlogs/2026-10-25-game6.jsonl', import.meta.url);
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
test('r22 bit1 game6 move 53: RJRJ+66 lead -> pair 66 first, keep RJRJ', () => {
  const g = gameAt(53); assert.deepEqual(g.round.hands[0].map(formatCard).sort(), ['6D', '6D', 'RJ', 'RJ']);
  const r = coachAt(53);
  assert.equal(r.move.combo.type, 'pair'); assert.equal(r.move.combo.rank, '6');
});
test('r22 bit2 (rejected, opt-in GD_R22=3) game6 move 25: follow single without breaking 9-K straight', () => {
  process.env.GD_R22 = '3'; let r; try { r = coachAt(25); } finally { delete process.env.GD_R22; }
  assert.equal(r.move.cards.length, 1);
  assert.ok(!['10S', 'JC', 'QC', '9C'].includes(formatCard(r.move.cards[0])), formatCard(r.move.cards[0]));
});
test('r22 off (GD_R22=0) restores r21 choices', () => {
  process.env.GD_R22 = '0';
  process.env.GD_R24 = '0'; // r24 also changes n25; isolate r22-off
  try { assert.equal(coachAt(53).move.combo.rank, 'RJ'); assert.equal(formatCard(coachAt(25).move.cards[0]), '10S'); } finally { delete process.env.GD_R22; delete process.env.GD_R24; }
});
