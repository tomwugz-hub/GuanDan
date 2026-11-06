import test from 'node:test';
import assert from 'node:assert/strict';
import { endgameApplies, r169Gate } from '../policy/endgame.js';
import { decide } from '../policy/index.js';
import { makeDeck, formatCard } from '../engine/cards.js';
import { TYPES } from '../engine/combos.js';

// Mirrors game3 deal1 move 86 in r19.test.js: 南 RJ+K vs 三家各 2 张，接风语义金标
function pos86() {
  const deck = makeDeck();
  const take = (labs) => labs.map((l) => { const i = deck.findIndex((c) => formatCard(c) === l); return deck.splice(i, 1)[0]; });
  const hands = [take(['RJ', 'KC']), take(['2D', '10H']), take(['JH', 'JD']), take(['3S', '3D'])];
  return { hand: hands[0], previous: null, levelRank: '2', leading: true, seat: 0, remainingSeatCounts: [2, 2, 2, 2], playedCards: deck, lastPlaySeat: null, finishedOrder: [] };
}

test('r169Gate: uniform K=4 rejects when any seat >4', () => {
  const ctx = { seat: 0, remainingSeatCounts: [4, 4, 4, 5], hand: [{ rank: '2', suit: 'S', id: 1 }, { rank: '2', suit: 'H', id: 2 }] };
  assert.equal(r169Gate(ctx, 0).ok, false);
});

test('r169Gate: asymmetric (bit4) allows partner long if min<=K and max<=TEAMMAX', () => {
  // Team 3+8 (side short 3), enemies both 4 — no seat holds >4 except partner at 8 (allowed by TEAMMAX).
  const ctx = { seat: 0, remainingSeatCounts: [3, 4, 8, 4], hand: [{ rank: '2', suit: 'S', id: 1 }, { rank: '2', suit: 'H', id: 2 }] };
  const g = r169Gate(ctx, 4); // K=4 E=4 side-only
  assert.equal(g.ok, true);
  assert.equal(g.maxEach, 8);
  assert.equal(endgameApplies(ctx, g.maxEach), true);
});

test('r169Gate: b3 (E=5) rejects enemy 6 while b9 (E=4+2=6) accepts — distinct gates', () => {
  const ctx = { seat: 0, remainingSeatCounts: [4, 6, 4, 4], hand: [{ rank: '2', suit: 'S', id: 1 }, { rank: '2', suit: 'H', id: 2 }] };
  assert.equal(r169Gate(ctx, 3).ok, false); // bit1+2: E=5
  assert.equal(r169Gate(ctx, 9).ok, true); // bit1+8: E=4+GD_R169X_E8 default 2 → 6
  assert.equal(r169Gate(ctx, 9).maxEach, 6);
});

test('r169 b0 exact equivalence with baseline on move 86', () => {
  const p = pos86();
  process.env.GD_R169 = '0';
  const a = decide(p).move ?? decide(p);
  process.env.GD_R169 = '3'; // bit1+bit2: K=5 E=5 uniform
  const b = decide(p).move ?? decide(p);
  assert.deepEqual(a.cards.map(formatCard), b.cards.map(formatCard));
  delete process.env.GD_R169;
});

test('r169 decide path: higher threshold so endgame does not override heuristic', () => {
  const p = pos86();
  process.env.GD_R169 = '3';
  process.env.GD_R169X_THR = '10';
  const m = decide(p).move ?? decide(p);
  assert.equal(m.combo?.type, TYPES.SINGLE);
  assert.deepEqual(m.cards.map(formatCard), ['KC']);
  delete process.env.GD_R169;
  delete process.env.GD_R169X_THR;
});
