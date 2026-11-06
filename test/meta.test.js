import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PHASES, phaseOf, styleLabel } from '../meta/index.js';

describe('meta phaseOf', () => {
  it('20 张及以上是 early', () => {
    assert.equal(phaseOf(27), 'early');
    assert.equal(phaseOf(20), 'early');
  });
  it('10 到 19 是 mid', () => {
    assert.equal(phaseOf(19), 'mid');
    assert.equal(phaseOf(10), 'mid');
  });
  it('3 到 9 是 late', () => {
    assert.equal(phaseOf(9), 'late');
    assert.equal(phaseOf(3), 'late');
  });
  it('不足 3 张是 lastCards', () => {
    assert.equal(phaseOf(2), 'lastCards');
    assert.equal(phaseOf(1), 'lastCards');
    assert.equal(phaseOf(0), 'lastCards');
  });
});

describe('meta styleLabel', () => {
  it('映射中文短标签', () => {
    assert.equal(styleLabel('tight'), '紧');
    assert.equal(styleLabel('normal'), '中');
    assert.equal(styleLabel('loose'), '松');
    assert.equal(styleLabel('aggressive'), '凶');
    assert.equal(styleLabel('conservative'), '稳');
  });
  it('未知风格回落到中', () => {
    assert.equal(styleLabel('unknown'), '中');
    assert.equal(styleLabel(''), '中');
  });
  it('PHASES 含五个阶段名', () => {
    assert.deepEqual([...PHASES], ['tribute', 'early', 'mid', 'late', 'lastCards']);
  });
});
