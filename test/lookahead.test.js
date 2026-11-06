import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cards } from '../engine/cards.js';
import { classify, TYPES } from '../engine/combos.js';
import { decide, isForbidden, detectStructures } from '../policy/index.js';
import { safety, moveFinish, feedAfter, finishLine, winProb } from '../policy/lookahead.js';
import { buildJevCandidates } from '../policy/jevCandidates.js';

// build a move from the given hand's own card objects (ids must match for restAfter)
const mv = (s, lv, hand) => {
  let c = cards(s);
  if (hand) {
    const used = new Set();
    c = c.map((x) => { const h = hand.find((y) => !used.has(y.id) && y.rank === x.rank && y.suit === x.suit); used.add(h.id); return h; });
  }
  return { cards: c, combo: classify(c, lv) };
};
function ctx(hand, extra = {}) {
  return {
    hand,
    previous: null,
    levelRank: '2',
    leading: !extra.previous,
    firstLeadOfDeal: false,
    seat: 0,
    remainingSeatCounts: [hand.length, 27, 27, 27],
    playedCards: [],
    ...extra,
  };
}

describe('lookahead: safety / winProb', () => {
  it('RJ single is only beatable by a bomb (likely); small single is not safe', () => {
    const hand = cards('8C RJ');
    const c = ctx(hand, { levelRank: '8', remainingSeatCounts: [2, 7, 7, 8] });
    assert.equal(safety(mv('RJ', '8', hand), c), 'likely');
    assert.equal(safety(mv('8C', '8', hand), c), null);
    assert.ok(winProb(mv('RJ', '8', hand), c) > winProb(mv('8C', '8', hand), c));
  });
  it('enemies with fewer cards than the play cannot follow it', () => {
    const hand = cards('3S 3H 3D 9C');
    const c = ctx(hand, { remainingSeatCounts: [4, 2, 9, 2] });
    assert.equal(safety(mv('3S 3H 3D', '2', hand), c), 'sure');
  });
});

describe('lookahead: moveFinish / finishLine', () => {
  it('bomb then AA vs enemies 1 and 3 is a sure finish', () => {
    const hand = cards('7S 7H 7D 7C AS AH');
    const c = ctx(hand, { leading: false, previous: classify(cards('KS KH'), '2'), lastPlaySeat: 3, remainingSeatCounts: [6, 1, 9, 3] });
    assert.equal(moveFinish(mv('7S 7H 7D 7C', '2', hand), c), 'sure');
  });
  it('lead FH with only a bomb left = bombBack (keep the bomb as the answer)', () => {
    const hand = cards('9S 9H 9D 4S 4H 10S 10H 10D 10C');
    const c = ctx(hand, { remainingSeatCounts: [9, 8, 9, 7] });
    assert.equal(moveFinish(mv('9S 9H 9D 4S 4H', '2', hand), c), 'bombBack');
    const r = decide(c);
    assert.equal(r.move.combo.type, TYPES.FULLHOUSE);
  });
  it('rocket first while holding a smaller bomb is not preferred over the small bomb', () => {
    const hand = cards('3H 4H 5H 6H 7H BJ BJ RJ RJ');
    const prev = classify(cards('10S 10H 10D 10C'), '2');
    const c = ctx(hand, { leading: false, previous: prev, lastPlaySeat: 1, remainingSeatCounts: [9, 1, 6, 6] });
    assert.equal(moveFinish(mv('3H 4H 5H 6H 7H', '2', hand), c), 'bombBack');
    assert.equal(decide(c).move.combo.type, TYPES.STRAIGHT_FLUSH);
  });
  it('finishLine: one-play hand is sure; no safe chain returns null', () => {
    const c = ctx([], { remainingSeatCounts: [5, 9, 9, 9] });
    assert.equal(finishLine(cards('5S 5H 5D 9S 9H'), c), 'sure');
    assert.equal(finishLine(cards('3S 5H 7D 9S JH'), { ...c, hand: cards('3S 5H 7D 9S JH') }), null);
  });
});

describe('lookahead: control and feed', () => {
  it('feedAfter: partner on 2 with a small pair left → pair; partner long → null', () => {
    const hand = cards('AS 5S 5H 9C');
    assert.equal(feedAfter(mv('AS', '2', hand), ctx(hand, { remainingSeatCounts: [4, 8, 2, 9] })), 'pair');
    assert.equal(feedAfter(mv('AS', '2', hand), ctx(hand, { remainingSeatCounts: [4, 8, 9, 9] })), null);
  });
  it('level single takes control when bomb + pair finish afterwards (enemies long)', () => {
    const hand = cards('10C 4C 4C 4D 4H 5C 5D');
    const prev = classify(cards('KC'), '10');
    const c = ctx(hand, { levelRank: '10', seat: 1, leading: false, previous: prev, lastPlaySeat: 0, remainingSeatCounts: [11, 7, 5, 11] });
    const r = decide(c);
    assert.equal(r.move.combo.type, TYPES.SINGLE);
    assert.equal(r.move.combo.rank, '10');
  });
  it('lead with partner on 2: feed the smallest natural pair', () => {
    const hand = cards('10C 5C 6H 6H 6S 9C 9D JD JS');
    const c = ctx(hand, { levelRank: 'A', seat: 3, remainingSeatCounts: [4, 2, 5, 9] });
    const r = decide(c);
    assert.equal(r.move.combo.type, TYPES.PAIR);
    assert.equal(r.move.combo.rank, '9');
  });
  it('follow with a pair when the rest is one bomb (bomb kept to answer)', () => {
    const hand = cards('6C 6D 6H 6S 9D 9S');
    const prev = classify(cards('5S 5D'), '2');
    const c = ctx(hand, { leading: false, previous: prev, lastPlaySeat: 1, remainingSeatCounts: [6, 1, 6, 6] });
    const r = decide(c);
    assert.equal(r.move.combo.type, TYPES.PAIR);
    assert.equal(r.move.combo.rank, '9');
  });
});

describe('rule fixes (lookahead round)', () => {
  it('4d: natural pair available → do not complete a wild bomb (enemies ≥2)', () => {
    const hand = cards('8D 8S 8C 2H 5S 5D 3C');
    const prev = classify(cards('4S 4D'), '2');
    const c = ctx(hand, { leading: false, previous: prev, lastPlaySeat: 1, remainingSeatCounts: [7, 6, 9, 5] });
    const bomb = mv('8D 8S 8C 2H', '2', hand);
    const pair = mv('5S 5D', '2', hand);
    assert.equal(bomb.combo.type, TYPES.BOMB);
    assert.equal(isForbidden(bomb, c, [bomb, pair]), true);
  });
  it('4d: enemy on 1 card → wild bomb may still stop it', () => {
    const hand = cards('3C 5H 8D 8H 8S KD');
    const prev = classify(cards('AC'), '5');
    const c = ctx(hand, { levelRank: '5', leading: false, previous: prev, lastPlaySeat: 1, remainingSeatCounts: [6, 1, 6, 6] });
    assert.equal(decide(c).move.combo.type, TYPES.BOMB);
  });
  it('follow: do not split a natural bomb for a fullhouse (enemy ≥3)', () => {
    const hand = cards('4D 4H 4H 4S 7C 7H 9H');
    const prev = classify(cards('2D 2H 2C JD JD'), '8');
    const c = ctx(hand, { levelRank: '8', seat: 2, leading: false, previous: prev, lastPlaySeat: 1, remainingSeatCounts: [5, 3, 7, 8] });
    const fh = mv('4D 4H 4S 7C 7H', '8', hand);
    assert.equal(isForbidden(fh, c, [fh]), true);
  });
  it('structures: three non-consecutive pairs are not a pair-sequence when following', () => {
    const st = detectStructures(cards('3S 3H 8D 8H KS KH'), '2');
    assert.equal(st.seq.hasPairSeq, false);
    assert.equal(detectStructures(cards('3S 3H 4D 4H 5S 5H'), '2').seq.hasPairSeq, true);
  });
  it('smallest sufficient joker: BJ before RJ vs enemy on 2 (not finishing)', () => {
    const hand = cards('4D 4D BJ RJ');
    const prev = classify(cards('9D'), '4');
    const c = ctx(hand, { levelRank: '4', seat: 3, leading: false, previous: prev, lastPlaySeat: 2, remainingSeatCounts: [8, 5, 2, 4] });
    assert.equal(decide(c).move.combo.rank, 'BJ');
  });
});

describe('lookahead: speed and Jev mirror', () => {
  it('decide stays under 50ms on a 12-card endgame hand', () => {
    const hand = cards('3S 3H 3D 5C 6C 7C 8C 9C JS JH QD KH');
    const prev = classify(cards('4S'), '2');
    const t0 = performance.now();
    decide(ctx(hand, { leading: false, previous: prev, lastPlaySeat: 1, remainingSeatCounts: [12, 4, 6, 5] }));
    assert.ok(performance.now() - t0 < 50);
  });
  it('Jev candidates carry a [可走完] tag for a forcing finish', () => {
    const hand = cards('7S 7H 7D 7C AS AH');
    const prev = classify(cards('KS KH'), '2');
    const cands = buildJevCandidates(null, { hand, previous: prev, levelRank: '2', leading: false, seat: 0, seatCounts: [6, 1, 9, 3], lastPlaySeat: 3, K: 8 });
    assert.ok(cands.some((c) => c.move.combo?.type === TYPES.BOMB && c.label.includes('可走完')));
  });
});
