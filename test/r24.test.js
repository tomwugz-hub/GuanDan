import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decide } from '../policy/index.js';
import { formatCard } from '../engine/cards.js';
import { newGame, play, ctxFor } from '../play/core.js';

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

test('r24 bit1 (opt-in GD_R24=1): game6 n25 keeps 9-K via spare endpoint K', () => {
  process.env.GD_R24 = '1';
  try {
    const r = coachAt(25);
    assert.equal(r.move.cards.length, 1);
    assert.ok(!['10S', 'JC', 'QC', '9C'].includes(formatCard(r.move.cards[0])), formatCard(r.move.cards[0]));
    assert.equal(r.move.combo.rank, 'K');
    assert.ok(r.tags.includes('r24SpareKeepStraight'), r.tags.join(','));
  } finally { delete process.env.GD_R24; }
});

test('r24 default off: n25 still 10S (r23); n53 still r22 weak-first 66', () => {
  delete process.env.GD_R24;
  assert.equal(formatCard(coachAt(25).move.cards[0]), '10S');
  const r53 = coachAt(53);
  assert.equal(r53.move.combo.type, 'pair');
  assert.equal(r53.move.combo.rank, '6');
});
