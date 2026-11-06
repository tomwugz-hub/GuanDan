import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decide } from '../policy/index.js';
import { formatCard } from '../engine/cards.js';
import { newGame, play, ctxFor } from '../play/core.js';

const LOG = new URL('../userlogs/2026-10-25-game7.jsonl', import.meta.url);
const lines = fs.readFileSync(LOG, 'utf8').trim().split('\n').map(JSON.parse);
const moves = lines.filter((l) => l.type === 'move' && l.deal === 2);
const LV = lines.find((l) => l.type === 'deal' && l.deal === 2).levelRank;
const pick = (h, labs) => { const u = new Set(); return labs.map((lab) => { const c = h.find((x) => formatCard(x) === lab && !u.has(x.id)); u.add(c.id); return c; }); };
function gameAt(n) {
  const g = newGame({ seed: lines[0].seed, levelRank: LV, progression: false }); const pool = g.round.hands.flat();
  g.round.hands = [0, 1, 2, 3].map((s) => moves[0].handsAll[String(s)].map((lab) => pool.splice(pool.findIndex((c) => formatCard(c) === lab), 1)[0]));
  g.round.currentSeat = moves[0].seat; g.round.tribute = null;
  for (const m of moves) { if (m.n >= n) break; play(g, m.seat, pick(g.round.hands[m.seat], m.move.cards), { by: 'replay', preferCombo: { type: m.move.type, rank: m.move.rank } }); }
  return g;
}
const coachAt = (n) => decide(ctxFor(gameAt(n), 0));

test('r23 bit1 game7 deal2 n20: lead 钢板 555+666 over bare triple 5', () => {
  const g = gameAt(20);
  assert.equal(g.round.hands[0].length, 19);
  const r = coachAt(20);
  assert.equal(r.move.combo.type, 'tripleSeq');
  assert.equal(r.move.combo.rank, '6');
  assert.equal(r.move.cards.length, 6);
  const ranks = r.move.cards.map((c) => c.rank).sort().join('');
  assert.ok(ranks.includes('5') && ranks.includes('6'), ranks);
});

test('r23 bit2 game7 deal2 n32: follow pair 77 with a cheap pair (not pass)', () => {
  const g = gameAt(32);
  assert.equal(g.round.hands[0].length, 13);
  const r = coachAt(32);
  assert.equal(r.move.combo.type, 'pair');
  assert.ok(['8', '9', '10'].includes(r.move.combo.rank), r.move.combo.rank);
  assert.ok(!(r.move.cards || []).some((c) => formatCard(c) === '4H'), 'no wild');
});

test('r23 bit4 game7 deal2 n36: pass on enemy pair JJ, keep near-exit 4-bomb', () => {
  const g = gameAt(36);
  assert.equal(g.round.hands[0].length, 11);
  process.env.GD_R45 = '0'; // r45（默认 2）炸弹+余牌≤2手时炸回，自博弈双种子显著，覆盖此 r23 bit4 局面
  try {
    const r = coachAt(36);
    assert.equal(r.move.combo.type, 'pass');
    assert.equal(r.move.cards.length, 0);
  } finally { delete process.env.GD_R45; }
});

test('r45 default: game7 n36 bomb back (bomb + ≤2 plays left)', () => {
  assert.equal(coachAt(36).move.combo.type, 'bomb');
});

test('r23 off (GD_R23=0) restores r22 choices at n20/n32/n36', () => {
  process.env.GD_R23 = '0';
  try {
    assert.equal(coachAt(20).move.combo.type, 'triple');
    assert.equal(coachAt(20).move.combo.rank, '5');
    assert.equal(coachAt(32).move.combo.type, 'pass');
    assert.equal(coachAt(36).move.combo.type, 'bomb');
  } finally {
    delete process.env.GD_R23;
  }
});

test('r23 bit1-only does not change n32/n36', () => {
  process.env.GD_R23 = '1';
  try {
    assert.equal(coachAt(20).move.combo.type, 'tripleSeq');
    assert.equal(coachAt(32).move.combo.type, 'pass');
    assert.equal(coachAt(36).move.combo.type, 'bomb');
  } finally {
    delete process.env.GD_R23;
  }
});
