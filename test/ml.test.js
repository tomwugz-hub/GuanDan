import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cards } from '../engine/cards.js';
import { classify, TYPES } from '../engine/combos.js';
import { extractFeatures, featureVector, FEATURE_NAMES } from '../ml/features.js';
import { linearValue, policyScore, valueScore, tweakWeights, weights } from '../ml/score.js';

const L = '2';

describe('ml features', () => {
  it('特征名数量', () => assert.ok(FEATURE_NAMES.length >= 10));
  it('向长度匹配', () => {
    const move = { cards: cards('AS'), combo: classify(cards('AS'), L) };
    const f = extractFeatures({ hand: cards('AS KH'), leading: true }, move);
    assert.equal(featureVector(f).length, FEATURE_NAMES.length);
  });
  it('走完 goOut=1', () => {
    const h = cards('AS');
    const f = extractFeatures({ hand: h }, { cards: h, combo: classify(h, L) });
    assert.equal(f.goOut, 1);
  });
  it('过牌 isPass', () => {
    const f = extractFeatures({ hand: cards('AS') }, { cards: [], combo: { type: TYPES.PASS, size: 0 } });
    assert.equal(f.isPass, 1);
  });
  it('四 J 压三带二 wasteBomb', () => {
    const prev = classify(cards('JS JH JD 3S 3H'), L);
    const bomb = { cards: cards('JC JS JH JD'), combo: classify(cards('JC JS JH JD'), L) };
    const f = extractFeatures({ previous: prev, hand: cards('JC JS JH JD 5S') }, bomb);
    assert.equal(f.wasteBomb, 1);
  });
  it('首轮炸 firstLeadBomb', () => {
    const bomb = { cards: cards('5S 5H 5D 5C'), combo: classify(cards('5S 5H 5D 5C'), L) };
    const f = extractFeatures({ firstLeadOfDeal: true, hand: cards('5S 5H 5D 5C 7S') }, bomb);
    assert.equal(f.firstLeadBomb, 1);
  });
  it('砸搭档 crushPartner', () => {
    const bomb = { cards: cards('5S 5H 5D 5C'), combo: classify(cards('5S 5H 5D 5C'), L) };
    const f = extractFeatures(
      { partnerCombo: classify(cards('3S 4H 5D 6C 7S'), L), winningNow: false },
      bomb,
    );
    assert.equal(f.crushPartner, 1);
  });
  for (const name of FEATURE_NAMES) {
    it(`含特征 ${name}`, () => assert.ok(FEATURE_NAMES.includes(name)));
  }
});

describe('ml value', () => {
  it('权重含 wasteBomb', () => assert.ok(weights.w.wasteBomb < -1));
  it('浪费炸弹分极低', () => {
    const prev = classify(cards('JS JH JD 3S 3H'), L);
    const bomb = { cards: cards('JC JS JH JD'), combo: classify(cards('JC JS JH JD'), L) };
    const s = valueScore({ previous: prev, hand: cards('JC JS JH JD 9S') }, bomb);
    const pass = valueScore({ previous: prev, hand: cards('JC JS JH JD 9S') }, { cards: [], combo: { type: TYPES.PASS, size: 0 } });
    assert.ok(s < pass);
  });
  it('linearValue 有限', () => {
    const f = extractFeatures({ hand: cards('AS') }, { cards: cards('AS'), combo: classify(cards('AS'), L) });
    assert.ok(Number.isFinite(linearValue(f)));
  });
  it('tweak 不改 wasteBomb', () => {
    const n = tweakWeights(weights, { wasteBomb: 100, size: 1 });
    assert.equal(n.w.wasteBomb, weights.w.wasteBomb);
    assert.notEqual(n.w.size, weights.w.size);
  });
  it('goOut 分高于过牌', () => {
    const h = cards('AS');
    const go = valueScore({ hand: h }, { cards: h, combo: classify(h, L) });
    const ps = valueScore({ hand: h }, { cards: [], combo: { type: TYPES.PASS, size: 0 } });
    assert.ok(go > ps);
  });
  it('policyScore 返回 features', () => {
    const h = cards('AS');
    const r = policyScore({ hand: h }, { cards: h, combo: classify(h, L) });
    assert.ok(r.features);
  });
});
