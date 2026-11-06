import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, applyGameResult } from '../engine/state.js';
import { RULESETS, rulesetConfig } from '../engine/rulesets.js';

describe('三处规则差', () => {
  it('过 A：宿迁必须双下', () => {
    const m = createMatch({ ruleset: RULESETS.SUQIAN, levelRank: 'A', defenderTeam: 0 });
    const r = applyGameResult(m, [0, 1, 3, 2]);
    assert.equal(r.passA, false);
    assert.equal(r.resetTo2, true);
  });
  it('过 A：官方不必双下', () => {
    const m = createMatch({ ruleset: RULESETS.OFFICIAL_2022, levelRank: 'A', defenderTeam: 0 });
    const r = applyGameResult(m, [0, 1, 3, 2]);
    assert.equal(r.passA, true);
    assert.equal(m.matchOver, true);
    assert.equal(r.resetTo2, false);
  });
  it('过 A 失败：宿迁回 2', () => {
    const m = createMatch({ ruleset: RULESETS.SUQIAN, levelRank: 'A', defenderTeam: 0 });
    applyGameResult(m, [1, 0, 3, 2]);
    assert.equal(m.levelRank, '2');
    assert.equal(rulesetConfig(RULESETS.SUQIAN).failPassAResetTo2, true);
  });
  it('过 A 失败：官方不回 2', () => {
    assert.equal(rulesetConfig(RULESETS.OFFICIAL_2022).failPassAResetTo2, false);
    const m = createMatch({ ruleset: RULESETS.OFFICIAL_2022, levelRank: 'A', defenderTeam: 0 });
    applyGameResult(m, [1, 0, 3, 2]);
    assert.equal(m.levelRank, 'A');
    assert.equal(m.matchOver, true);
  });
  it('过 A 之后：官方结束整局', () => {
    assert.equal(rulesetConfig(RULESETS.OFFICIAL_2022).afterPassA, 'endMatch');
  });
  it('过 A 之后：宿迁未双下则重打 2', () => {
    assert.equal(rulesetConfig(RULESETS.SUQIAN).afterPassA, 'resetIfNotDoubleDown');
  });
  it('进贡：宿迁双下不进贡，官方双下双贡', () => {
    const sq = applyGameResult(createMatch({ ruleset: RULESETS.SUQIAN, levelRank: '5' }), [0, 2, 1, 3]);
    assert.equal(sq.tribute.count, 0);
    const of = applyGameResult(createMatch({ ruleset: RULESETS.OFFICIAL_2022, levelRank: '5' }), [0, 2, 1, 3]);
    assert.equal(of.tribute.count, 2);
    assert.equal(of.tribute.officialDoubleTribute, true);
  });
});
