import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cards } from '../engine/cards.js';
import { createMatch, createRound, applyPlay, applyGameResult } from '../engine/state.js';
import { TYPES } from '../engine/combos.js';
import { decide } from '../policy/index.js';
import { RULESETS } from '../engine/rulesets.js';

function playOut(hands, { levelRank = '2', ruleset = RULESETS.SUQIAN } = {}) {
  const match = createMatch({ levelRank, ruleset });
  const round = createRound(match, { dealerSeat: 0, hands: hands.map((h) => h.slice()) });
  let guard = 0;
  let bombWaste = 0;
  let bombs = 0;
  let plays = 0;
  const winners = [];
  while (round.finished.length < 3 && guard++ < 400) {
    const seat = round.currentSeat;
    const leading = !round.lastCombo || round.lastCombo.type === TYPES.PASS;
    const rec = decide({
      hand: round.hands[seat],
      previous: leading ? null : round.lastCombo,
      levelRank: match.levelRank,
      leading,
      firstLeadOfDeal: leading && round.tricks.length === 0,
      seat,
      remainingSeatCounts: round.hands.map((h) => h.length),
      partnerCombo: lastOf(round, (seat + 2) % 4),
      playedCards: round.tricks.flatMap((t) => t.cards),
    });
    const mv = rec.move;
    plays += 1;
    if (mv.combo?.type === TYPES.BOMB) {
      bombs += 1;
      if (round.lastCombo?.type === TYPES.FULLHOUSE && mv.combo.rank === round.lastCombo.rank && (mv.combo.bombSize || mv.combo.size) === 4) {
        bombWaste += 1;
      }
      if (round.tricks.length === 0 && leading && (round.hands[seat].length > (mv.combo.bombSize||mv.combo.size))) bombWaste += 1;
    }
    const r = applyPlay(round, seat, mv.cards || []);
    if (!r.ok) {
      throw new Error(`非法: 座位${seat} ${r.reason}`);
    }
  }
  if (round.finished.length < 3) throw new Error('未打完');
  const result = applyGameResult(match, round.finished);
  return { match, round, result, bombWaste, bombs, plays, finish: round.finished.slice() };
}

function lastOf(round, seat) {
  for (let i = round.tricks.length - 1; i >= 0; i--) {
    if (round.tricks[i].seat === seat) return round.tricks[i].combo;
  }
  return null;
}

const FIX = [
  ['AS', 'KS', 'QS', 'JS'],
  ['AH KH', 'QH JH', '10H 9H', '8H 7H'],
  ['3S 3H', '4S 4H', '5S 5H', '6S 6H'],
  ['AS AH AD', 'KS KH', 'QS QH', 'JS JH JD'],
  ['2S 3H 4D', '5C 6S 7H', '8D 9C 10S', 'JD QC KH'],
  ['AS KS QS JS 10S', '9H 8H 7H', '6D 5D', '4C 3C 3S'],
  ['7S 7H 7D 7C 3S', 'AS KH QD', 'JC 10S 9H', '8D 6C 5S'],
  ['3S 4H 5D 6C 7S', '8H 9D 10C JS QH', 'KD AC 2S', 'AH KH QH'],
  ['BJ RJ AS', 'AH AD AC', 'KS KH', '3S 4H 5D'],
  ['9S 9H 9D 3S 3H', '8S 8H', '7S 7H 7D', 'AS 4C'],
  ['2S 2H 2D 3C', '4S 5H 6D 7C', '8S 9H 10D JC', 'QS KH AD'],
  ['AS 3S 5S 7S 9S', 'KH QD JC 10H', '8D 6C 4H', '2S 2H AH'],
  ['KS KH KD KC 2D', 'AS AH', 'QS QH QD', 'JS 3C'],
  ['10S 10H 9S 9H 8S 8H', '7D 6C 5S', 'AS KH', '4H 3D 3C'],
  ['5S 5H 5D 5C AS', '4S 4H 4D', '3S 3H', 'KS QH'],
  ['AC KC QC JC 10C 9C', '8S 7H 6D', '5C 4S 3H', '2D AH KD'],
  ['RJ BJ 2S 2H', 'AS AH AD', 'KS QS JS', '3S 4H 5D 6C'],
  ['6S 6H 6D 7S 7H 7D', 'AS 8C', 'KH QD', 'JC 10S 9H 8D'],
  ['3S 3H 4S 4H 5S 5H', 'AS AH', 'KS KH KD', '2C 2D 2H 9S'],
  ['QH QD QC QS 3D', 'AH KH', 'JH JD JS', '10S 9H 8C 7D'],
];

describe('human-style fixtures', () => {
  const sides = [];
  let waste = 0;
  let playsBomb = 0;
  for (let i = 0; i < FIX.length; i++) {
    it(`剧本 ${i + 1} 合法打完`, () => {
      const hands = FIX[i].map((s) => cards(s));
      const out = playOut(hands);
      assert.equal(out.round.finished.length, 4);
      waste += out.bombWaste;
      playsBomb += Math.max(1, out.bombs);
      sides.push(out.finish[0] % 2);
    });
  }
  it('炸弹浪费率 < 1%', () => {
    // 汇总在上一组 it 之后：再跑一遍短统计
    let w = 0;
    let plays = 0;
    for (const f of FIX) {
      const out = playOut(f.map((s) => cards(s)));
      w += out.bombWaste;
      plays += out.plays;
    }
    const rate = w / Math.max(1, plays);
    assert.ok(rate < 0.01, `waste rate ${rate}`);
  });
  it('头游不全是同一队', () => {
    const heads = FIX.map((f) => playOut(f.map((s) => cards(s))).finish[0] % 2);
    assert.ok(new Set(heads).size >= 2, `sides ${heads}`);
  });
});
