import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cards } from '../engine/cards.js';
import { TYPES } from '../engine/combos.js';
import { decompose, planString, comboKey } from '../policy/handplan.js';
import { decide } from '../policy/index.js';

const ctx = (hand, extra = {}) => ({ hand, levelRank: '2', seat: 0, leading: true, previous: null, remainingSeatCounts: [hand.length, 12, 12, 12], ...extra });

describe('handplan: decompose', () => {
  it('straight + pairs, prefers keeping the higher orphan single', () => {
    const p = decompose(cards('5C 9D 4C 9C 8S 3C 7S 4S 3S 6C'), 'A', new Map());
    assert.equal(p.plays, 4);
    assert.equal(planString(p), '33 → 44 → 56789 → 9');
  });
  it('bomb kept whole and ordered last', () => {
    const p = decompose(cards('5S 5D 6C 6H JC JD JS JH AS'), '2', new Map());
    assert.equal(p.comps[p.comps.length - 1].role, 'bomb');
    assert.ok(p.comps.some((c) => c.move.combo.type === TYPES.PAIR && c.move.combo.rank === '5'));
  });
  it('wild is only used to complete bombs, otherwise kept as control', () => {
    const p = decompose(cards('4S 4D 7C 7D BJ 2H'), '2', new Map());
    assert.ok(!p.comps.some((c) => c.move.combo.type === TYPES.FULLHOUSE));
    assert.ok(p.comps.some((c) => c.role === 'control' && c.move.cards.some((x) => x.rank === '2')));
  });
  it('returns null for hands over 14 cards', () => {
    assert.equal(decompose(cards('3C 3D 4C 4D 5C 5D 6C 6D 7C 7D 8C 8D 9C 9D 10C'), '2', new Map()), null);
  });
  it('comboKey is stable', () => {
    const p = decompose(cards('3C 3D'), '2', new Map());
    assert.equal(comboKey(p.comps[0].move), 'pair:3:2');
  });
});

describe('handplan: decide lead scoring', () => {
  it('enemies long: lead the long unit (straight) first', () => {
    const r = decide(ctx(cards('10C 3D 5D 5S 7D 8H 9H AS JS'), { levelRank: '6', remainingSeatCounts: [9, 12, 11, 13] }));
    assert.equal(r.move.combo.type, TYPES.STRAIGHT);
  });
  it('enemy on 2 with a pair to protect: smallest orphan single', () => {
    const r = decide(ctx(cards('4S 4H 9D JC KH'), { remainingSeatCounts: [5, 5, 5, 2] }));
    assert.equal(r.move.combo.type, TYPES.SINGLE);
    assert.equal(r.move.combo.rank, '9');
  });
  it('enemy on 2, only singles: biggest non-control single', () => {
    const r = decide(ctx(cards('6H 4S 5C'), { levelRank: '9', seat: 3, remainingSeatCounts: [2, 3, 3, 3] }));
    assert.equal(r.move.combo.rank, '6');
  });
  it('enemies on 3: lead the full house they cannot follow', () => {
    const r = decide(ctx(cards('9S 9H 9D 5S 5H 3C 4D'), { remainingSeatCounts: [7, 3, 3, 3] }));
    assert.equal(r.move.combo.type, TYPES.FULLHOUSE);
  });
});
