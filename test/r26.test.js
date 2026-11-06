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
function gameAt(n) {
  const g = newGame({ seed: lines[0].seed, levelRank: LV, progression: false }); const pool = g.round.hands.flat();
  g.round.hands = [0, 1, 2, 3].map((s) => moves[0].handsAll[s].map((lab) => pool.splice(pool.findIndex((c) => formatCard(c) === lab), 1)[0]));
  g.round.currentSeat = moves[0].seat; g.round.tribute = null;
  for (const m of moves) { if (m.n >= n) break; play(g, m.seat, pick(g.round.hands[m.seat], m.move.cards), { by: 'replay', preferCombo: { type: m.move.type, rank: m.move.rank } }); }
  return g;
}
const coachAt = (n) => decide(ctxFor(gameAt(n), 0));
const withEnv = (v, f) => { const o = process.env.GD_R26; process.env.GD_R26 = v; try { return f(); } finally { if (o == null) delete process.env.GD_R26; else process.env.GD_R26 = o; } };
test('r26 default (5): game4 d2 n6 follows W single 4 with K to block next seat', () => {
  delete process.env.GD_R26;
  const r = coachAt(6);
  assert.equal(r.move.combo.rank, 'K');
  assert.ok(r.tags.includes('r26BlockNext'));
});
test('r26 GD_R26=0 restores 8', () => { withEnv('0', () => assert.equal(coachAt(6).move.combo.rank, '8')); });
