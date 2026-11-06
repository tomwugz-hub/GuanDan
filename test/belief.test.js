import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cards } from '../engine/cards.js';
import { classify } from '../engine/combos.js';
import {
  remainingByRank,
  remainingCardCounts,
  trackKeyCards,
  recordBombPlayed,
  opponentRemainingCounts,
  stylePrior,
  updateActionWeights,
  inferOpponentModel,
  buildBelief,
  STYLES,
} from '../belief/index.js';

describe('belief remaining', () => {
  it('108 起手各点 8 张', () => {
    const m = remainingByRank([]);
    assert.equal(m.get('A'), 8);
    assert.equal(m.get('RJ'), 2);
  });
  it('打出后减少', () => {
    const m = remainingByRank(cards('AS AH'));
    assert.equal(m.get('A'), 6);
  });
  it('花色计数', () => {
    const m = remainingCardCounts(cards('AS'));
    assert.equal(m.get('A:S'), 1);
  });
  for (const r of ['2', '3', 'K', 'A']) {
    it(`点数 ${r} 默认 8`, () => assert.equal(remainingByRank([]).get(r), 8));
  }
});

describe('belief key cards', () => {
  it('跟踪 2 与级牌与王', () => {
    const k = trackKeyCards(cards('2S 2H AS RJ'), 'A');
    assert.equal(k.twosLeft, 6);
    assert.equal(k.levelLeft, 7);
    assert.equal(k.redJokerLeft, 1);
  });
  it('记录已走炸弹', () => {
    const k = trackKeyCards([]);
    const n = recordBombPlayed(k, classify(cards('7S 7H 7D 7C'), '2'));
    assert.equal(n.bombsGone, 1);
  });
  it('非炸不增加', () => {
    const n = recordBombPlayed(trackKeyCards([]), classify(cards('AS'), '2'));
    assert.equal(n.bombsGone, 0);
  });
});

describe('belief opponents', () => {
  it('座位余牌', () => {
    assert.deepEqual(opponentRemainingCounts([27, 27, 27, 27], [[1], [], [2, 3], []]), [26, 27, 25, 27]);
  });
});

describe('belief styles', () => {
  for (const s of STYLES) {
    it(`风格 ${s} 先验归一`, () => {
      const p = stylePrior(s);
      const sum = p.pass + p.follow + p.bomb;
      assert.ok(Math.abs(sum - 1) < 1e-6);
    });
  }
  it('未知风格回落 normal', () => {
    assert.equal(stylePrior('???').style, 'normal');
  });
  it('更新过牌权重上升', () => {
    const a = stylePrior('normal');
    const b = updateActionWeights(a, 'pass');
    assert.ok(b.pass > a.pass);
  });
  it('更新炸弹权重上升', () => {
    const a = stylePrior('normal');
    const b = updateActionWeights(a, 'bomb');
    assert.ok(b.bomb > a.bomb);
  });
  it('历史推断', () => {
    const m = inferOpponentModel([{ action: 'pass' }, { action: 'pass' }], 'loose');
    assert.ok(m.pass > stylePrior('loose').pass);
  });
  it('buildBelief 聚合', () => {
    const b = buildBelief({
      playedCards: cards('AS RJ'),
      levelRank: '2',
      tricks: [{ combo: classify(cards('5S 5H 5D 5C'), '2') }],
    });
    assert.ok(b.keyCards.redJokerLeft === 1);
    assert.equal(b.models.length, 4);
  });
});

describe("belief extra", () => {
  it("empty history model", () => { const m = inferOpponentModel([], "tight"); assert.equal(m.style, "tight"); });
  it("follow weight up", () => { const a=stylePrior("normal"); assert.ok(updateActionWeights(a,"follow").follow>a.follow); });
  it("opponent zero floor", () => { assert.deepEqual(opponentRemainingCounts([1,0,2,3],[[9],[],[],[]]), [0,0,2,3]); });
  it("key twos gone", () => { assert.equal(trackKeyCards([{rank:"2"},{rank:"2"},{rank:"2"},{rank:"2"},{rank:"2"},{rank:"2"},{rank:"2"},{rank:"2"}]).twosLeft, 0); });
});
