import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cards } from '../engine/cards.js';
import {
  tributeCard, isReturnEligible, isLegalReturn, returnOptions, planTribute, resolveTribute, applyGives,
  newStdMatch, applyStdResult, stepsFor, minReturn,
} from '../engine/tributeStd.js';
import { chooseReturn } from '../policy/tribute.js';
import { newGame, startDeal, autoTribute, tributePending, tributeGive, tributeReturn, returnChoices, play, isOver, botStepDecide } from '../play/core.js';
import { checkTribute, playMatch, makeAgent } from '../selfplay/lib.mjs';

const rk = (c) => c && c.rank + c.suit;
// 4 家手牌（只放测试需要的牌）
const H = (a, b, c, d) => [cards(a), cards(b), cards(c), cards(d)];

describe('标准进贡：贡牌', () => {
  it('最大的一张，含王', () => {
    assert.equal(tributeCard(cards('RJ AH KH 3S'), '2').rank, 'RJ');
    assert.equal(tributeCard(cards('BJ AH'), '2').rank, 'BJ');
  });
  it('级牌大于 A', () => {
    assert.equal(rk(tributeCard(cards('AH 6S 3D'), '6')), '6S');
  });
  it('逢人配（红桃级牌）除外', () => {
    assert.equal(rk(tributeCard(cards('6H AS 3D'), '6')), 'AS');
    assert.equal(rk(tributeCard(cards('6H 6C AS'), '6')), '6C');
  });
});

describe('标准进贡：单贡', () => {
  it('末游→头游，末游先出', () => {
    const p = planTribute([0, 1, 2, 3], H('3S', '4S', '5S', 'AS KD'), '2');
    assert.equal(p.kind, 'single');
    assert.equal(p.resisted, false);
    assert.deepEqual(p.gives.map((g) => [g.from, g.to, rk(g.card)]), [[3, 0, 'AS']]);
    assert.equal(p.leader, 3);
  });
  it('头游+末游同队也由末游进贡头游', () => {
    const p = planTribute([0, 1, 3, 2], H('3S', '4S', 'KS', 'QS'), '2');
    assert.equal(p.kind, 'single');
    assert.deepEqual(p.gives.map((g) => [g.from, g.to]), [[2, 0]]);
    assert.equal(p.leader, 2);
  });
  it('抗贡：末游两张大王 → 不进贡，头游先出', () => {
    const p = planTribute([1, 0, 2, 3], H('3S', '4S', '5S', 'RJ RJ AS'), '2');
    assert.equal(p.resisted, true);
    assert.equal(p.gives.length, 0);
    assert.equal(p.leader, 1);
  });
  it('末游只有一张大王 → 贡大王', () => {
    const p = planTribute([1, 0, 2, 3], H('RJ', '4S', '5S', 'RJ BJ AS'), '2');
    assert.equal(p.resisted, false);
    assert.equal(p.gives[0].card.rank, 'RJ');
  });
  it('收贡方有两张大王不算抗贡', () => {
    const p = planTribute([0, 1, 2, 3], H('RJ RJ', '4S', '5S', 'AS'), '2');
    assert.equal(p.resisted, false);
  });
});

describe('标准进贡：双下', () => {
  it('大贡归头游、小贡归二游，进贡大牌者先出', () => {
    // 0、2 双上；三游 1、末游 3
    const p = planTribute([0, 2, 1, 3], H('3S', 'KS 4D', '5S', 'AS 4C'), '2');
    assert.equal(p.kind, 'double');
    assert.deepEqual(p.gives.map((g) => [g.from, g.to, g.card.rank]), [[3, 0, 'A'], [1, 2, 'K']]);
    assert.equal(p.leader, 3);
  });
  it('三游的贡牌更大时三游给头游', () => {
    const p = planTribute([2, 0, 3, 1], H('3S', 'QS', '5S', 'BJ'), '2');
    assert.deepEqual(p.gives.map((g) => [g.from, g.to, g.card.rank]), [[3, 2, 'BJ'], [1, 0, 'Q']]);
    assert.equal(p.leader, 3);
  });
  it('贡牌一样大：头游的下家给头游并先出', () => {
    // 头游 0，下家 1；1 是末游、3 是三游
    const p = planTribute([0, 2, 3, 1], H('3S', 'AS', '5S', 'AD'), '2');
    assert.equal(p.tie, true);
    assert.deepEqual(p.gives.map((g) => [g.from, g.to]), [[1, 0], [3, 2]]);
    assert.equal(p.leader, 1);
    // 头游 3，下家 0
    const q = planTribute([3, 1, 2, 0], H('KS', '3S', 'KD', '5S'), '2');
    assert.deepEqual(q.gives.map((g) => [g.from, g.to]), [[0, 3], [2, 1]]);
    assert.equal(q.leader, 0);
  });
  it('抗贡：两人各一张大王', () => {
    const p = planTribute([0, 2, 1, 3], H('3S', 'RJ 4D', '5S', 'RJ AS'), '2');
    assert.equal(p.resisted, true);
    assert.equal(p.leader, 0);
    assert.equal(p.gives.length, 0);
  });
  it('抗贡：一人两张大王', () => {
    const p = planTribute([0, 2, 1, 3], H('3S', 'RJ RJ', '5S', 'AS'), '2');
    assert.equal(p.resisted, true);
  });
  it('双下方只有一张大王 → 照常双贡', () => {
    const p = planTribute([0, 2, 1, 3], H('RJ', 'BJ 4D', '5S', 'RJ AS'), '2');
    assert.equal(p.resisted, false);
    assert.deepEqual(p.gives.map((g) => [g.from, g.to, g.card.rank]), [[3, 0, 'RJ'], [1, 2, 'BJ']]);
  });
  it('首副不进贡', () => {
    assert.equal(planTribute(null, H('3S', '4S', '5S', '6S'), '2').kind, 'none');
  });
});

describe('还贡', () => {
  it('≤10 才能还（含 10）；J、王、级牌（任何花色）不可', () => {
    assert.equal(isReturnEligible(cards('10S')[0], '2'), true);
    assert.equal(isReturnEligible(cards('JS')[0], '2'), false);
    assert.equal(isReturnEligible(cards('BJ')[0], '2'), false);
    assert.equal(isReturnEligible(cards('5H')[0], '5'), false);
    assert.equal(isReturnEligible(cards('5S')[0], '5'), false);
  });
  it('没有 ≤10 时还最小的牌（不还逢人配）', () => {
    const o = returnOptions(cards('JS QS KH AS 5H RJ'), '5');
    assert.equal(o.fallback, true);
    assert.deepEqual(o.cards.map(rk), ['JS']);
  });
  it('resolveTribute：非法选择回退最小可还牌；双贡两还', () => {
    const hands = H('3S 9H JS', '4S', '6C', 'AS 7D');
    const r = resolveTribute([0, 1, 2, 3], hands, '2', () => cards('JS')[0]);
    assert.equal(r.returns.length, 1);
    assert.equal(r.returns[0].card.rank, '3');
    assert.deepEqual([r.returns[0].from, r.returns[0].to], [0, 3]);
    const d = resolveTribute([0, 2, 1, 3], H('3S 4S', 'KS 8D', '5S 6S', 'AS 9C'), '2', (seat, hand) => hand.find((c) => c.rank === (seat === 0 ? '4' : '6')));
    assert.deepEqual(d.returns.map((x) => [x.from, x.to, x.card.rank]), [[0, 3, '4'], [2, 1, '6']]);
  });
  it('policy plan：不拆对子/顺子，还孤单小牌', () => {
    const h = cards('3S 3D 4C 5C 6C 7C 8C 9S 9D QS KS AS AH');
    assert.equal(chooseReturn(h, { lv: '2' }, 'min').rank, '3');
    assert.equal(chooseReturn(h, { lv: '2' }, 'plan').rank, '3'); // 3 4 5 6 7 8 顺子，多出一张 3（或 8）
    const h2 = cards('2S 2D 4C 4D 6S 9H 9C JS QS KS AS AH');
    assert.equal(chooseReturn(h2, { lv: '5' }, 'min').rank, '2');
    assert.equal(chooseReturn(h2, { lv: '5' }, 'plan').rank, '6'); // 22/44/99 成对，6 是孤单
  });
  it('policy plan：不还级牌（除非只剩级牌可还）', () => {
    const h = cards('5S 2S 2D 3C 3D 7S 7H 9C 9D JS JD QS QD KS AS AH RJ');
    assert.notEqual(chooseReturn(h, { lv: '5' }, 'plan').rank, '5');
    assert.equal(chooseReturn(cards('5S JS QS'), { lv: '5' }, 'plan').rank, 'J'); // 级牌比 A 大，兜底还 J
  });
});

describe('标准升级', () => {
  it('+3/+2/+1', () => {
    assert.equal(stepsFor([0, 2, 1, 3]), 3);
    assert.equal(stepsFor([0, 1, 2, 3]), 2);
    assert.equal(stepsFor([0, 1, 3, 2]), 1);
    const m = newStdMatch('2');
    applyStdResult(m, [1, 3, 0, 2]);
    assert.deepEqual(m.teamLevel, ['2', '5']);
    assert.equal(m.level, '5');
    applyStdResult(m, [0, 1, 2, 3]);
    assert.deepEqual(m.teamLevel, ['4', '5']);
    assert.equal(m.level, '4');
  });
  it('打 A：头游且对家非末游过 A；对家末游不过', () => {
    const m = newStdMatch('2');
    Object.assign(m, { teamLevel: ['A', 'K'], level: 'A', levelTeam: 0 });
    const r1 = applyStdResult(m, [0, 1, 3, 2]);
    assert.equal(r1.passA, false);
    assert.equal(m.matchOver, false);
    const r2 = applyStdResult(m, [2, 1, 0, 3]);
    assert.equal(r2.passA, true);
    assert.equal(m.winnerTeam, 0);
  });
});

describe('网页/自对局流程（play/core）', () => {
  it('第二副进贡后每家 27 张、先出者正确、未完成进贡不能出牌', () => {
    const g = newGame({ seed: 11 });
    while (!isOver(g)) botStepDecide(g);
    const order = g.lastResult.order;
    startDeal(g);
    const ts = g.tributeState;
    if (!ts.plan.resisted) {
      assert.equal(tributePending(g), true);
      assert.equal(play(g, g.round.currentSeat, []).ok, false);
      tributeGive(g);
      for (const p of ts.pending.slice()) {
        const bad = g.round.hands[p.seat].find((c) => !returnChoices(g, p.seat).some((x) => x.id === c.id));
        if (bad) assert.equal(tributeReturn(g, p.seat, bad).ok, false);
      }
      autoTribute(g);
    }
    assert.equal(tributePending(g), false);
    assert.deepEqual(g.round.hands.map((h) => h.length), [27, 27, 27, 27]);
    assert.deepEqual(checkTribute(g, order), []);
  });
  it('不变量能抓到错误（篡改先出者）', () => {
    const g = newGame({ seed: 12 });
    while (!isOver(g)) botStepDecide(g);
    const order = g.lastResult.order;
    startDeal(g);
    autoTribute(g);
    g.round.currentSeat = (g.round.currentSeat + 1) % 4;
    assert.ok(checkTribute(g, order).some((s) => s.startsWith('leader')));
  });
  it('自对局进贡比赛 3 副无违例', async () => {
    const ag = [];
    for (let s = 0; s < 4; s++) ag.push(await makeAgent(s % 2 ? 'greedy' : 'random', s));
    const ds = playMatch(5, ag, { deals: 3 });
    assert.ok(ds.length >= 2);
    for (const d of ds) assert.deepEqual(d.violations, []);
    assert.ok(ds.slice(1).every((d) => d.tribute && d.tribute.kind !== 'none'));
  });
});

describe('还贡：级牌不可还（bug 修复：打 4 时 4♦ 曾可还）', () => {
  const ids = (o) => o.cards.map(rk).sort();
  it('打 4：4♦/4♠/4♣/4♥ 都不可还，其余 ≤10 可', () => {
    for (const c of cards('4D 4S 4C 4H')) assert.equal(isReturnEligible(c, '4'), false);
    for (const c of cards('2S 3D 5C 10H')) assert.equal(isReturnEligible(c, '4'), true);
    const h = cards('4D 4H 4S 3C 9S JS RJ');
    assert.deepEqual(ids(returnOptions(h, '4')), ['3C', '9S']);
    assert.ok(!isLegalReturn(cards('4D')[0], h, '4'));
    for (const v of ['min', 'plan']) assert.notEqual(chooseReturn(h, { lv: '4' }, v).rank, '4');
  });
  it('打 10：10 是级牌不可还，9 可', () => {
    assert.equal(isReturnEligible(cards('10S')[0], '10'), false);
    assert.equal(isReturnEligible(cards('9S')[0], '10'), true);
    assert.deepEqual(ids(returnOptions(cards('10S 10D 9C KS'), '10')), ['9C']);
  });
  it('打 2：2 是级牌不可还，3 可', () => {
    assert.equal(isReturnEligible(cards('2S')[0], '2'), false);
    assert.equal(isReturnEligible(cards('3S')[0], '2'), true);
    assert.deepEqual(ids(returnOptions(cards('2S 2D 3C AS'), '2')), ['3C']);
  });
  it('兜底：只有级牌是 ≤10 → 还最小的非级牌（J…A），再级牌，再王；逢人配最后', () => {
    let o = returnOptions(cards('4D 4S QS AS RJ'), '4');
    assert.equal(o.fallback, true); assert.deepEqual(ids(o), ['QS']);
    o = returnOptions(cards('4D 4H BJ RJ'), '4');
    assert.deepEqual(ids(o), ['4D']);
    o = returnOptions(cards('4H BJ'), '4');
    assert.deepEqual(ids(o), ['BJJ']);
    o = returnOptions(cards('4H'), '4');
    assert.deepEqual(ids(o), ['4H']);
  });
  it('resolveTribute 打 4：机器人选级牌被拒并回退', () => {
    const r = resolveTribute([0, 1, 2, 3], H('4D 7S JS', '5S', '6C', 'AS 8D'), '4', () => cards('4D')[0]);
    assert.equal(r.returns[0].card.rank, '7');
  });
});
