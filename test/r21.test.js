import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decide } from '../policy/index.js';
import { formatCard } from '../engine/cards.js';
import { newGame, play, ctxFor, coachGap } from '../play/core.js';

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
const userMove = (n) => moves.find((m) => m.n === n);
for (const n of [1, 5, 49, 53, 57]) {
  test(`r21 game5 move ${n}: user move is scorable (gap not null)`, () => {
    const g = gameAt(n); const m = userMove(n);
    const cards = m.move.cards.length ? pick(g.round.hands[0], m.move.cards) : [];
    const r = coachGap(g, 0, cards, m.move.cards.length ? { type: m.move.type, rank: m.move.rank } : null);
    assert.equal(r.how, 'scored', JSON.stringify(r));
    assert.ok(r.gap != null);
  });
}
test('r21 game5 move 49: whole-hand exit reason says 整手可一次走完', () => {
  const rec = decide(ctxFor(gameAt(49), 0));
  assert.equal(rec.move.cards.length, 5);
  assert.match(rec.reason, /整手可一次走完/);
  assert.doesNotMatch(rec.reason, /仅剩 1–2 张/);
});
