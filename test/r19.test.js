import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDeck, formatCard } from '../engine/cards.js';
import { TYPES } from '../engine/combos.js';
import { decide, _reasonFor } from '../policy/index.js';
import { withBuildAttr, gameLogRows, newGame } from '../play/core.js';

// game3 deal1 move 86：南 [RJ,KC]，东 2D 10H，北 JH JD，西 3S 3D，南领出，级牌 2
function pos86() {
  const deck = makeDeck();
  const take = (labs) => labs.map((l) => { const i = deck.findIndex((c) => formatCard(c) === l); return deck.splice(i, 1)[0]; });
  const hands = [take(['RJ', 'KC']), take(['2D', '10H']), take(['JH', 'JD']), take(['3S', '3D'])];
  return { hand: hands[0], previous: null, levelRank: '2', leading: true, seat: 0, remainingSeatCounts: [2, 2, 2, 2], playedCards: deck, lastPlaySeat: null, finishedOrder: [] };
}

test('r19 reason: no straight-flush text without a straight flush; pass with only a bomb says so', () => {
  const deck = makeDeck();
  const take = (labs) => labs.map((l) => { const i = deck.findIndex((c) => formatCard(c) === l); return deck.splice(i, 1)[0]; });
  const hand = take(['10C', 'QD', '5S', '8S', '8H', '8C', '8D']);
  const ctx = { hand, previous: { type: TYPES.SINGLE, rank: '9', size: 1 }, levelRank: '2', leading: false };
  const single = { cards: [hand[0]], combo: { type: TYPES.SINGLE, rank: '10', size: 1 } };
  assert.doesNotMatch(_reasonFor(single, ctx, ['noSFon8']), /同花顺/);
  const pass = { cards: [], combo: { type: TYPES.PASS, rank: null, size: 0 } };
  const ctxA = { ...ctx, hand: hand.slice(0, 3), previous: { type: TYPES.SINGLE, rank: 'RJ', size: 1 } };
  assert.match(_reasonFor(pass, ctxA, []), /没有合适同型/);
  const ctxB = { ...ctx, hand: take(['3S', '3H', '3C', '3D', '4S']), previous: { type: TYPES.PAIR, rank: 'A', size: 2 } };
  assert.match(_reasonFor(pass, ctxB, []), /炸弹/);
  assert.doesNotMatch(_reasonFor(pass, ctxB, []), /没有合适同型/);
  const sfHand = take(['5H', '6H', '7H', '8H', '9H']);
  assert.match(_reasonFor(single, { ...ctx, hand: sfHand }, ['noSFon8']), /同花顺/);
});

test('r19 export: build id is injected into html and recorded in game header', () => {
  const html = withBuildAttr('<!doctype html>\n<html lang="zh-CN">\n<head>', 'guandan-play-abc');
  assert.match(html, /<html lang="zh-CN" data-build="guandan-play-abc">/);
  assert.equal(withBuildAttr(html, 'guandan-play-def').match(/data-build/g).length, 1);
  const rows = gameLogRows(newGame({ seed: 1 }), { app: { build: 'guandan-play-abc' } });
  assert.equal(rows[0].build, 'guandan-play-abc');
});

test('r19f endgame: move 86 [RJ,KC] all on 2 cards leads K, keeps RJ (接风)', () => {
  const d = decide(pos86());
  const m = d.move ?? d;
  assert.deepEqual(m.cards.map(formatCard), ['KC']);
});
