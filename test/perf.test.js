import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cards, makeDeck, shuffle, dealFourHands } from '../engine/cards.js';
import { decide } from '../policy/index.js';

describe('perf', () => {
  it('典型手牌平均 decide < 80ms（Windows 冷启动放宽）', () => {
    const hands = [];
    let rng = 0.17;
    const rnd = () => {
      rng = (rng * 9301 + 49297) % 233280;
      return rng / 233280;
    };
    for (let i = 0; i < 12; i++) {
      const dealt = dealFourHands(shuffle(makeDeck(), rnd));
      hands.push(dealt[0]);
    }
    const extra = [
      cards('3S 4H 5D 6C 7S 8H 9D 10C JS QH KD AC 2S 2H AS AH BJ RJ 5S 5H 6D 7C 8S 9H 10D JC QS'),
      cards('7S 7H 7D 7C 3S 4H 5D 6C 8S 9H 10D JC QS KH AD 2C'),
    ];
    const t0 = performance.now();
    let n = 0;
    for (const hand of hands.concat(extra)) {
      decide({
        hand,
        previous: null,
        levelRank: '2',
        leading: true,
        firstLeadOfDeal: true,
        remainingSeatCounts: [hand.length, 27, 27, 27],
      });
      n += 1;
    }
    const avg = (performance.now() - t0) / n;
    assert.ok(avg < 80, `avg ${avg}ms`);
  });
});
