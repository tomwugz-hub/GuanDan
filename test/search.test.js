import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cards } from '../engine/cards.js';
import { classify, TYPES } from '../engine/combos.js';
import { beats } from '../engine/compare.js';
import { generateCandidates, beamSearch, heuristicEval, shortRollout } from '../search/index.js';

const L = '2';

describe('search legal-only', () => {
  it('领出不含过牌', () => {
    const ms = generateCandidates({ hand: cards('AS KH 3S'), leading: true, levelRank: L });
    assert.ok(ms.every((m) => m.combo.type !== TYPES.PASS));
  });
  it('跟牌可过', () => {
    const prev = classify(cards('KS'), L);
    const ms = generateCandidates({ hand: cards('3S'), previous: prev, leading: false, levelRank: L });
    assert.ok(ms.some((m) => m.combo.type === TYPES.PASS));
  });
  it('所有非过牌都能压过或领出', () => {
    const prev = classify(cards('5S 5H'), L);
    const hand = cards('9S 9H 3C 4D AS KH');
    const ms = generateCandidates({ hand, previous: prev, leading: false, levelRank: L });
    for (const m of ms) {
      if (m.combo.type === TYPES.PASS) continue;
      assert.equal(beats(m.combo, prev, L), true);
    }
  });
  it('beam 只含合法', () => {
    const hand = cards('3S 4H 5D 6C 7S 8H 9D');
    const beam = beamSearch({ hand, leading: true, levelRank: L }, { beam: 5, timeMs: 30 });
    assert.ok(beam.length >= 1);
    for (const b of beam) assert.ok(b.move.combo);
  });
  it('heuristic 走完更高', () => {
    const hand = cards('AS');
    const m = { cards: hand, combo: classify(hand, L) };
    assert.ok(heuristicEval(m, { hand }) > 10);
  });
  it('rollout 有限步', () => {
    const hand = cards('3S 4H 5D');
    const m = { cards: [hand[0]], combo: classify([hand[0]], L) };
    const v = shortRollout({ hand, leading: true, levelRank: L }, m, 1);
    assert.ok(Number.isFinite(v));
  });
});
