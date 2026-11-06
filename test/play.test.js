import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, botStepDecide, isOver, play, snapshot, flagToCase, coachMove } from '../play/core.js';

test('play/core: 机器人整副打完、名次完整、牌数守恒', () => {
  const g = newGame({ seed: 77 });
  let n = 0;
  while (!isOver(g)) { const r = botStepDecide(g); assert.ok(r.ok, r.reason); n++; assert.ok(n < 1500); }
  assert.equal(new Set(g.lastResult.order).size, 4);
  assert.equal(g.round.hands.reduce((a, h) => a + h.length, 0) + g.played.length, 108);
});

test('play/core: 非轮次/领出过牌被拒；标记为 eval 用例格式', () => {
  const g = newGame({ seed: 5 });
  const other = (g.round.currentSeat + 1) % 4;
  assert.equal(play(g, other, g.round.hands[other].slice(0, 1)).ok, false);
  assert.equal(play(g, g.round.currentSeat, []).ok, false);
  const seat = g.round.currentSeat;
  const c = coachMove(g, seat);
  const r = play(g, seat, c.move.cards, { by: 'human', coach: c, preferCombo: c.move.combo });
  assert.ok(r.ok);
  assert.ok(r.entry.coach.same);
  const f = flagToCase(r.entry, { goldFrom: 'played', note: 'x' });
  assert.equal(f.seat, seat);
  assert.equal(f.leading, true);
  assert.equal(Object.values(f.hands).reduce((a, h) => a + h.length, 0), 108);
  assert.equal(f.gold.alts[0].comboType, c.move.combo.type);
  const s = snapshot(g, g.round.currentSeat);
  assert.equal(s.leading, false);
  assert.ok(s.previous.cards.length > 0);
});

test('play/core: 搭档领出后敌人压上，轮到自己时不算“压搭档”（对家一直过牌 bug）', async () => {
  const { ctxFor } = await import('../play/core.js');
  const g = newGame({ seed: 11 });
  const c3 = { rank: '3', suit: 'S', id: 9001 };
  const c9 = { rank: '9', suit: 'S', id: 9002 };
  const s3 = { type: 'single', rank: '3', size: 1, length: 1 };
  const s9 = { type: 'single', rank: '9', size: 1, length: 1 };
  // 南(0) 领出 3，东(1) 压 9，轮到北(2)
  g.trickPlays = [{ seat: 0, cards: [c3], combo: s3 }, { seat: 1, cards: [c9], combo: s9 }];
  g.round.lastCombo = s9; g.round.lastPlayer = 1; g.round.currentSeat = 2;
  assert.equal(ctxFor(g, 2).partnerCombo, null);
  assert.equal(snapshot(g, 2).trickMeta.partnerLastPlay, null);
  // 若最后一手就是搭档的，则算压搭档
  g.trickPlays = [{ seat: 0, cards: [c3], combo: s3 }, { seat: 1, cards: [], combo: { type: 'pass' } }];
  g.round.lastCombo = s3; g.round.lastPlayer = 0;
  assert.equal(ctxFor(g, 2).partnerCombo, s3);
  assert.equal(snapshot(g, 2).trickMeta.partnerLastPlay.rank, '3');
});
