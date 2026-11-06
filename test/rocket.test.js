import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cards } from '../engine/cards.js';
import { classify } from '../engine/combos.js';
import { beats } from '../engine/compare.js';

const c = (s, lv = '2') => classify(cards(s), lv);
const rocket = () => c('BJ BJ RJ RJ');

test('四王炸 is classified as bomb', () => {
  assert.equal(rocket().type, 'bomb');
});
test('四王炸 beats 4/5/6/8-card bombs', () => {
  for (const b of ['AS AH AD AC', 'KS KH KD KC KS', 'QS QH QD QC QS QH', '9S 9H 9D 9C 9S 9H 9D 9C']) {
    assert.ok(beats(rocket(), c(b), '2'), b);
    assert.ok(!beats(c(b), rocket(), '2'), b);
  }
});
test('四王炸 beats straight flush', () => {
  const sf = c('10H JH QH KH AH');
  assert.equal(sf.type, 'straightFlush');
  assert.ok(beats(rocket(), sf, '2'));
  assert.ok(!beats(sf, rocket(), '2'));
});
test('ordinary bomb ordering unchanged', () => {
  assert.ok(beats(c('3S 3H 3D 3C 3S'), c('AS AH AD AC'), '2'));
  assert.ok(beats(c('5H 6H 7H 8H 9H'), c('AS AH AD AC AS'), '2'));
  assert.ok(beats(c('3S 3H 3D 3C 3S 3H'), c('5H 6H 7H 8H 9H'), '2'));
});

test('legalMoves generates 四王炸 vs straight flush and when leading', async () => {
  const { legalMoves } = await import('../engine/legal.js');
  const hand = cards('BJ BJ RJ RJ 5C');
  const sf = c('5D 6D 7D 8D 9D');
  assert.ok(legalMoves(hand, sf, '2', false).some((m) => m.cards.length === 4 && m.combo.type === 'bomb'));
  assert.ok(legalMoves(hand, null, '2', true).some((m) => m.cards.length === 4 && m.combo.type === 'bomb'));
});
