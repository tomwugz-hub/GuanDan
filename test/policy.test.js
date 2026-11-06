import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cards } from '../engine/cards.js';
import { classify, TYPES } from '../engine/combos.js';
import { decide, isForbidden, detectStructures } from '../policy/index.js';

const L = '2';

function ctx(hand, extra = {}) {
  return {
    hand,
    previous: extra.previous ?? null,
    levelRank: extra.levelRank ?? L,
    leading: extra.leading ?? !extra.previous,
    firstLeadOfDeal: extra.firstLeadOfDeal ?? false,
    seat: 0,
    remainingSeatCounts: extra.remainingSeatCounts ?? [hand.length, 27, 27, 27],
    partnerCombo: extra.partnerCombo ?? null,
    winningNow: extra.winningNow ?? false,
    playedCards: extra.playedCards ?? [],
    ...extra,
  };
}

describe('policy 1 首轮不炸', () => {
  const bombHand = () => cards('JS JH JD JC 3S 4H 5D 6C 7S 8H 9D');
  for (let n = 0; n < 12; n++) {
    it(`首轮领出不炸 #${n + 1}`, () => {
      const hand = bombHand();
      const r = decide(ctx(hand, { leading: true, firstLeadOfDeal: true }));
      assert.notEqual(r.move.combo.type, TYPES.BOMB);
      assert.notEqual(r.move.combo.type, TYPES.STRAIGHT_FLUSH);
      assert.ok(r.reason.includes('炸') || r.reason.length > 4);
    });
  }
  it('只剩炸弹可以首轮炸', () => {
    const hand = cards('JS JH JD JC');
    const r = decide(ctx(hand, { leading: true, firstLeadOfDeal: true }));
    assert.equal(r.move.combo.type, TYPES.BOMB);
  });
  it('isForbidden 标记首轮炸弹', () => {
    const hand = bombHand();
    const bomb = { cards: hand.slice(0, 4), combo: classify(hand.slice(0, 4), L) };
    const single = { cards: [hand[4]], combo: classify([hand[4]], L) };
    assert.equal(isForbidden(bomb, { firstLeadOfDeal: true, hand }, [bomb, single]), true);
  });
});

describe('policy 2 四 J 不压三带二', () => {
  const prev = classify(cards('JS JH JD 5S 5H'), L);
  assert.equal(prev.type, TYPES.FULLHOUSE);
  for (let n = 0; n < 12; n++) {
    it(`四 J 不炸三带二 #${n + 1}`, () => {
      const hand = cards('JC JS JH JD 3S 4H 6C 7D 8S 9H');
      // 手牌再给一对可跟的三带二或过牌
      const r = decide(
        ctx(hand, {
          previous: prev,
          leading: false,
          firstLeadOfDeal: false,
        }),
      );
      const waste =
        r.move.combo.type === TYPES.BOMB && r.move.combo.rank === 'J' && (r.move.combo.bombSize || r.move.combo.size) === 4;
      assert.equal(waste, false);
    });
  }
});

describe('policy 3 同花顺不压 8/9 单张', () => {
  const sf = cards('3S 4S 5S 6S 7S 9H 10C JS QH KH AH');
  for (const rank of ['8', '9']) {
    for (let n = 0; n < 6; n++) {
      it(`同花顺不压 ${rank} #${n + 1}`, () => {
        const prev = classify(cards(`${rank}H`), L);
        const r = decide(ctx(sf, { previous: prev, leading: false }));
        assert.notEqual(r.move.combo.type, TYPES.STRAIGHT_FLUSH);
      });
    }
  }
});

describe('policy 4 对方 2 张不拆三张', () => {
  for (let n = 0; n < 10; n++) {
    it(`对方余 2 不乱出三张 #${n + 1}`, () => {
      const hand = cards('3S 3H 3D AS KH QD JC 9S 8H');
      const r = decide(
        ctx(hand, {
          leading: true,
          remainingSeatCounts: [hand.length, 2, 20, 2],
          firstLeadOfDeal: false,
        }),
      );
      // 2026-10-17 (lookahead round): leading the natural triple vs 2-card enemies is now allowed (they cannot follow);
      // the invariant kept is "do not break the triple into single/pair 3".
      const bad = (r.move.combo.type === TYPES.SINGLE || r.move.combo.type === TYPES.PAIR) && r.move.combo.rank === '3';
      assert.equal(bad, false);
    });
  }
});

describe('policy 5 不砸搭档顺子', () => {
  const partner = classify(cards('3S 4H 5D 6C 7S'), L);
  for (let n = 0; n < 12; n++) {
    it(`不砸搭档顺 #${n + 1}`, () => {
      const hand = cards('8S 8H 8D 8C 9S 9H 5C 6D');
      const r = decide(
        ctx(hand, {
          previous: partner,
          leading: false,
          partnerCombo: partner,
          winningNow: false,
        }),
      );
      assert.equal(isBombLikeSafe(r.move.combo), false);
    });
  }
});

function isBombLikeSafe(c) {
  return c && (c.type === TYPES.BOMB || c.type === TYPES.STRAIGHT_FLUSH);
}

describe('policy 6 不无故拆飞机', () => {
  for (let n = 0; n < 12; n++) {
    it(`不拆钢板 #${n + 1}`, () => {
      const hand = cards('3S 3H 3D 4S 4H 4D AS KH');
      const st = detectStructures(hand, L);
      assert.equal(st.hasAirplane, true);
      const r = decide(ctx(hand, { leading: true, firstLeadOfDeal: false }));
      const broke = r.move.combo.type === TYPES.SINGLE && ['3', '4'].includes(r.move.combo.rank);
      assert.equal(broke, false);
    });
  }
});

describe('policy 7 残牌能走则走', () => {
  for (let n = 0; n < 10; n++) {
    it(`两张能走则走 #${n + 1}`, () => {
      const hand = cards('AS AH');
      const r = decide(ctx(hand, { leading: true }));
      assert.equal(r.move.cards.length, 2);
    });
  }
  it('一张领出单张', () => {
    const hand = cards('KS');
    const r = decide(ctx(hand, { leading: true }));
    assert.equal(r.move.combo.type, TYPES.SINGLE);
  });
});

describe('policy 返回结构与耗时', () => {
  it('返回 move 与中文 reason', () => {
    const r = decide(ctx(cards('AS KH 3S'), { leading: true }));
    assert.ok(r.move);
    assert.ok(typeof r.reason === 'string' && r.reason.length > 2);
    assert.match(r.reason, /[\u4e00-\u9fff]/);
  });
  it('典型手牌 decide < 120ms（Windows 冷启动）', () => {
    const hand = cards('3S 3H 4D 5C 6S 7H 8D 9C 10S JS QH KD AC 2S 2H AS AH BJ RJ 5S 5H 6D 7C 8S 9H 10D JC');
    const t0 = performance.now();
    decide(ctx(hand, { leading: true, firstLeadOfDeal: true }));
    const dt = performance.now() - t0;
    assert.ok(dt < 120, `took ${dt}ms`);
  });
});

describe('policy leftover non-clone', () => {
  it('对方 2 张：不拆三张出单/对（另一手牌；整出三张允许）', () => {
    const hand = cards('5S 5H 5D 7C 8S 9H KD');
    const r = decide(ctx(hand, { leading: true, remainingSeatCounts: [7, 2, 18, 20], firstLeadOfDeal: false }));
    const broke = (r.move.combo.type === TYPES.SINGLE || r.move.combo.type === TYPES.PAIR) && r.move.combo.rank === '5';
    assert.equal(broke, false);
  });
  it('isForbidden 对方余 2 禁三条', () => {
    const hand = cards('5S 5H 5D AS KH');
    const trip = { cards: hand.slice(0, 3), combo: classify(hand.slice(0, 3), L) };
    const single = { cards: [hand[3]], combo: classify([hand[3]], L) };
    assert.equal(isForbidden(trip, { hand, remainingSeatCounts: [5, 2, 20, 20], levelRank: L }, [trip, single]), true);
  });
  it('不拆另一组钢板 7-8', () => {
    const hand = cards('7S 7H 7D 8S 8H 8D JS QH');
    const r = decide(ctx(hand, { leading: true, firstLeadOfDeal: false }));
    const broke = (r.move.combo.type === TYPES.SINGLE || r.move.combo.type === TYPES.PAIR) && ['7', '8'].includes(r.move.combo.rank);
    assert.equal(broke, false);
  });
});


describe('policy 不砸搭档对7 / 小对', () => {
  const pair7 = classify(cards('7S 7H'), L);
  it('搭档对7，手有同花顺+散牌：过牌或对子，不同花顺/炸', () => {
    const hand = cards('3S 4S 5S 6S 7C 9H 10D JC QH KH');
    const r = decide(
      ctx(hand, {
        previous: pair7,
        leading: false,
        partnerCombo: pair7,
        seat: 2,
        lastPlaySeat: 0,
      }),
    );
    assert.notEqual(r.move.combo.type, TYPES.STRAIGHT_FLUSH);
    assert.notEqual(r.move.combo.type, TYPES.BOMB);
    assert.ok(r.move.combo.type === TYPES.PASS || r.move.combo.type === TYPES.PAIR);
  });
  it('下家过牌后仍是对7，lastPlaySeat=0 seat=2：不同花顺', () => {
    const hand = cards('3S 4S 5S 6S 7C 9H 10D JC QH KH AS');
    const r = decide(
      ctx(hand, {
        previous: pair7,
        leading: false,
        seat: 2,
        lastPlaySeat: 0,
        partnerCombo: null,
      }),
    );
    assert.notEqual(r.move.combo.type, TYPES.STRAIGHT_FLUSH);
    assert.notEqual(r.move.combo.type, TYPES.BOMB);
  });
  it('同花顺不压对5', () => {
    const prev = classify(cards('5S 5H'), L);
    const hand = cards('3S 4S 5S 6S 7S 9H 10C JS QH KH');
    const r = decide(ctx(hand, { previous: prev, leading: false }));
    assert.notEqual(r.move.combo.type, TYPES.STRAIGHT_FLUSH);
    assert.notEqual(r.move.combo.type, TYPES.BOMB);
  });
  it('同花顺不压对8', () => {
    const prev = classify(cards('8S 8H'), L);
    const hand = cards('3S 4S 5S 6S 7S 9H 10C JS QH KH');
    const r = decide(ctx(hand, { previous: prev, leading: false }));
    assert.notEqual(r.move.combo.type, TYPES.STRAIGHT_FLUSH);
    assert.notEqual(r.move.combo.type, TYPES.BOMB);
  });
});
