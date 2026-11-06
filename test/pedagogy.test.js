import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cards } from '../engine/cards.js';
import { classify, TYPES } from '../engine/combos.js';
import {
  SKILL_DIMS,
  RANK_TITLES,
  ERROR_TYPES,
  weightedScore,
  rankFromScore,
  classifyUserError,
  agreement,
  summarizeDeal,
  exportReplay,
  importReplay,
  weeklyPlan,
  DRILLS,
  drillByDim,
  applyDealToDims,
  strengthsWeaknesses,
  coachComment,
} from '../pedagogy/index.js';
import { defaultProfile, loadProfile, saveProfile, resetProfile, pushDeal, pushError, recordWin, updateDims } from '../user-model/index.js';

describe('pedagogy dims', () => {
  it('六维', () => assert.equal(SKILL_DIMS.length, 6));
  it('权重和为 1', () => {
    const s = SKILL_DIMS.reduce((a, d) => a + d.weight, 0);
    assert.ok(Math.abs(s - 1) < 1e-9);
  });
  const expectW = { pattern: 0.2, coop: 0.2, bomb: 0.15, clutch: 0.15, tribute: 0.15, returnTribute: 0.15 };
  for (const d of [
    { id: 'pattern', name: '牌型识别' },
    { id: 'coop', name: '合作意识' },
    { id: 'bomb', name: '炸弹使用' },
    { id: 'clutch', name: '关键时刻' },
    { id: 'tribute', name: '进贡选择' },
    { id: 'returnTribute', name: '还贡策略' },
  ]) {
    it(`维 ${d.name}`, () => {
      const x = SKILL_DIMS.find((z) => z.id === d.id);
      assert.equal(x.name, d.name);
      assert.equal(x.weight, expectW[d.id]);
    });
  }
});

describe('pedagogy ranks', () => {
  const titles = ['初学者', '入门', '熟练', '高手', '高段', '大师'];
  it('六段', () => assert.deepEqual(RANK_TITLES, titles));
  const samples = [0, 10, 19, 20, 39, 40, 57, 58, 73, 74, 87, 88, 100];
  for (const s of samples) {
    it(`分数 ${s} 有段位`, () => assert.ok(titles.includes(rankFromScore(s))));
  }
  it('加权分', () => {
    const dims = { pattern: 100, coop: 100, bomb: 100, clutch: 100, tribute: 100, returnTribute: 100 };
    assert.equal(weightedScore(dims), 100);
  });
});

describe('pedagogy errors', () => {
  it('八类', () => assert.equal(ERROR_TYPES.length, 8));
  const names = ['炸弹浪费', '破结构', '合作失误', '关键失误', '进贡选择', '还贡策略', '信息失误', '其他'];
  const sev = { 炸弹浪费: '严重', 破结构: '严重', 合作失误: '中', 关键失误: '中', 进贡选择: '中', 还贡策略: '轻', 信息失误: '轻', 其他: '轻' };
  for (const n of names) {
    it(`错误 ${n}`, () => {
      const e = ERROR_TYPES.find((x) => x.name === n);
      assert.ok(e);
      assert.equal(e.severity, sev[n]);
    });
  }
  it('首轮炸判浪费', () => {
    const u = { combo: classify(cards('5S 5H 5D 5C'), '2'), cards: cards('5S 5H 5D 5C') };
    assert.equal(classifyUserError(u, u, { firstLeadOfDeal: true }).id, 'bombWaste');
  });
  it('四 J 压三带二浪费', () => {
    const prev = classify(cards('JS JH JD 3S 3H'), '2');
    const u = { combo: classify(cards('JC JS JH JD'), '2'), cards: cards('JC JS JH JD') };
    assert.equal(classifyUserError(u, u, { previous: prev }).id, 'bombWaste');
  });
  it('砸搭档合作失误', () => {
    const u = { combo: classify(cards('5S 5H 5D 5C'), '2'), cards: cards('5S 5H 5D 5C') };
    const partnerCombo = classify(cards('3S 4H 5D 6C 7S'), '2');
    assert.equal(classifyUserError(u, u, { partnerCombo }).id, 'coopFail');
  });
  it('对方 2 张出三张是关键失误', () => {
    const u = { combo: classify(cards('3S 3H 3D'), '2'), cards: cards('3S 3H 3D') };
    assert.equal(classifyUserError(u, u, { enemyShort: 2, hand: cards('3S 3H 3D 9S 8H') }).id, 'clutchFail');
  });
  it('拆结构', () => {
    const u = { combo: { type: TYPES.SINGLE, rank: '3', size: 1 }, cards: cards('3S') };
    assert.equal(classifyUserError(u, u, { wouldSplit: true }).id, 'breakStruct');
  });
});

describe('pedagogy deal replay path', () => {
  it('agreement 同牌', () => {
    const m = { cards: cards('AS'), combo: classify(cards('AS'), '2') };
    assert.equal(agreement(m, m), true);
  });
  it('agreement 不同', () => {
    assert.equal(agreement({ cards: cards('AS') }, { cards: cards('KH') }), false);
  });
  it('summarize 一致率', () => {
    const s = summarizeDeal([{ agree: true }, { agree: false }, { agree: true }]);
    assert.equal(s.agree, 2);
    assert.ok(Math.abs(s.rate - 2 / 3) < 1e-9);
  });
  it('导出含掼蛋', () => {
    const t = exportReplay([{ id: 1 }]);
    assert.ok(t.includes('掼蛋'));
    const data = importReplay(t);
    assert.equal(data.deals.length, 1);
  });
  it('导入坏数据抛错', () => {
    assert.throws(() => importReplay('{}'));
  });
  it('周计划 7 天', () => {
    const plan = weeklyPlan({ pattern: 10, coop: 20, bomb: 30, clutch: 40, tribute: 50, returnTribute: 60 });
    assert.equal(plan.length, 7);
    assert.ok(plan[0].focus);
  });
  const drillIds = ['press-same-suit-straight', 'bomb-timing', 'tribute', 'return-tribute', 'cooperation'];
  it('五训练', () => assert.equal(DRILLS.length, 5));
  for (const id of drillIds) {
    it(`训练 ${id}`, () => assert.ok(DRILLS.some((d) => d.id === id)));
  }
  it('drillByDim', () => assert.equal(drillByDim('bomb'), 'bomb-timing'));
  it('applyDeal 炸弹浪费降炸弹维', () => {
    const d0 = { pattern: 50, coop: 50, bomb: 50, clutch: 50, tribute: 50, returnTribute: 50 };
    const n = applyDealToDims(d0, { rate: 0.2 }, [{ id: 'bombWaste' }]);
    assert.ok(n.bomb < 50);
  });
  it('强弱项建议中文', () => {
    const sw = strengthsWeaknesses({ pattern: 90, coop: 10, bomb: 50, clutch: 50, tribute: 50, returnTribute: 50 });
    assert.equal(sw.weaknesses[0].id, 'coop');
    assert.match(sw.suggestions[0], /[\u4e00-\u9fff]/);
  });
  it('coachComment 不改真实策略标记', () => {
    const c = coachComment({ hand: cards('AS KH'), leading: true, levelRank: '2' });
    assert.equal(c.teachingOnly, true);
    assert.ok(c.recommend.move);
  });
});

describe('user-model store', () => {
  it('reset 默认', () => {
    const p = resetProfile();
    assert.equal(p.dims.pattern, 40);
  });
  it('pushDeal', () => {
    resetProfile();
    pushDeal({ n: 1 });
    assert.equal(loadProfile().deals.length, 1);
  });
  it('pushError', () => {
    resetProfile();
    pushError({ id: 'other' });
    assert.equal(loadProfile().errors.length, 1);
  });
  it('recordWin', () => {
    resetProfile();
    recordWin(true);
    recordWin(false);
    const p = loadProfile();
    assert.equal(p.wins, 1);
    assert.equal(p.losses, 1);
  });
  it('updateDims clamp', () => {
    resetProfile();
    updateDims({ pattern: 200 });
    assert.equal(loadProfile().dims.pattern, 100);
  });
  it('save load', () => {
    const p = defaultProfile();
    p.wins = 3;
    saveProfile(p);
    assert.equal(loadProfile().wins, 3);
  });
});

describe('pedagogy extra coverage', () => {
  const dims = { pattern: 15, coop: 35, bomb: 45, clutch: 60, tribute: 80, returnTribute: 95 };
  for (let i = 0; i < 20; i++) {
    it(`周计划条目 ${i} 有效`, () => {
      const plan = weeklyPlan(dims);
      assert.ok(plan[i % 7].minutes >= 20);
      assert.ok(drillByDim(SKILL_DIMS[i % 6].id));
    });
  }
  for (const e of ERROR_TYPES) {
    it(`错误类型完整 ${e.id}`, () => {
      assert.ok(e.name && e.severity);
    });
  }
  for (const d of SKILL_DIMS) {
    it(`维名中文 ${d.id}`, () => assert.match(d.name, /[\u4e00-\u9fff]/));
  }
});
