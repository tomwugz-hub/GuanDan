import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cards } from '../engine/cards.js';
import { classify, TYPES } from '../engine/combos.js';
import { beats } from '../engine/compare.js';
import { isLegalPlay, legalMoves } from '../engine/legal.js';
import { newGame, interpretPlay, play } from '../play/core.js';

describe('level rank beats ordinary singles (打 2)', () => {
  const prev10 = () => classify(cards('10C'), '2');
  const single2 = (t = '2S') => classify(cards(t), '2');

  it('级牌单张压过单张 10（级牌为字符串）', () => {
    assert.ok(beats(single2(), prev10(), '2'));
    assert.ok(isLegalPlay(cards('2S'), prev10(), '2'));
  });

  it('级牌单张压过单张 10（级牌为数字 2，与牌面 rank 同为 2 时的严格相等陷阱）', () => {
    assert.ok(beats(single2(), prev10(), 2));
    assert.ok(isLegalPlay(cards('2S'), prev10(), 2));
    const ms = legalMoves(cards('2S 3D'), prev10(), 2, false);
    assert.ok(ms.some((m) => m.combo.type === TYPES.SINGLE && m.combo.rank === '2'));
  });

  it('play interpretPlay：东出 10、南跟单张 2 合法', () => {
    const g = newGame({ seed: 1, progression: false });
    g.match.levelRank = 2;
    g.round.hands[0] = cards('2S 3D');
    g.round.lastCombo = prev10();
    g.round.lastPlayer = 1;
    g.round.currentSeat = 0;
    const it = interpretPlay(g, 0, [g.round.hands[0][0]]);
    assert.equal(it.ok, true, it.reason);
    assert.equal(it.combo.type, TYPES.SINGLE);
    assert.equal(it.combo.rank, '2');
    const res = play(g, 0, [g.round.hands[0][0]], { by: 'human' });
    assert.equal(res.ok, true, res.reason);
  });
});
