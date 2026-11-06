// Follow-round rules (Oct 17, 2026). Positions come from TUNING/regression sets only (dev-follow, holdout*), never frozen sets.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { cards } from '../engine/cards.js';
import { wildFillers } from '../policy/shape.js';
import { runCase } from '../scripts/run-endgame-eval.mjs';

const load = (set, id) => fs.readFileSync(`eval/endgames/${set}.jsonl`, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((c) => c.id === id);
const mv = (cs) => ({ cards: cards(cs) });
const ok = async (set, id) => { const r = await runCase(load(set, id), { useJev: false }); assert.ok(r.decide_ok, `${set}/${id}: decide=${r.decide}`); };

describe('wildFillers', () => {
  it('counts heart-level cards standing in for other ranks', () => {
    assert.equal(wildFillers(mv('8S 8H 8D 5H'), '5'), 1);
    assert.equal(wildFillers(mv('8S 8H 5H 5H'), '5'), 2);
  });
  it('is 0 when the heart level card is used as itself', () => {
    assert.equal(wildFillers(mv('5H'), '5'), 0);
    assert.equal(wildFillers(mv('5C 5H'), '5'), 0);
    assert.equal(wildFillers(mv('8S 8D'), '5'), 0);
  });
});

describe('follow decisions (decide)', () => {
  it('enemy on 1, only beater is the wild single: complete the wild bomb instead (h10a)', () => ok('holdout-pairs', 'h10a'));
  it('bomb that secures the finish is allowed even on a small ordinary (F059)', () => ok('dev-follow', 'F059'));
  it('natural single blocks enemy on 1: no wild-completed bomb (F117)', () => ok('dev-follow', 'F117'));
  it('no bomb when a non-bomb also finishes (q05b, q32a)', async () => { await ok('holdout4-pairs', 'q05b'); await ok('holdout4-pairs', 'q32a'); });
  it('partner owns the trick and enemies are long: pass (F006, F009, F010, F013)', async () => {
    for (const id of ['F006', 'F009', 'F010', 'F013']) await ok('dev-follow', id);
  });
  it('partner out: let 接风 come (F015)', () => ok('dev-follow', 'F015'));
  it('next enemy on 2 after partner: holdout rule still overtakes (F037)', () => ok('dev-follow', 'F037'));
});

describe('Jev candidates mirror decide on wild usage', () => {
  const dump = (set, id) => execFileSync('node', ['scripts/jev-dump.mjs', `eval/endgames/${set}.jsonl`, id], { encoding: 'utf8' });
  it('keeps the recommended natural single when wild bombs are available (F117)', () => {
    assert.match(dump('dev-follow', 'F117'), /单张 Q/);
  });
  it('tags the wild single as breaking the wild bomb, and the bomb as required (h10a)', () => {
    const out = dump('holdout-pairs', 'h10a');
    assert.match(out, /打出红桃5会拆掉逢人配补成的炸弹/);
    assert.match(out, /该炸断/);
    assert.doesNotMatch(out, /有普通牌能压住就用普通牌压/);
  });
  it('last two plays: tags which to lead first (q17a)', () => {
    const out = dump('holdout4-pairs', 'q17a');
    assert.match(out, /对子 A[^\n]*先出这手拿牌权/);
    assert.match(out, /对子 3[^\n]*这手应后出/);
  });
  it('r28 bit4: mid-game vs enemy, decide follows with a same-type non-bomb instead of passing (F128, relabeled pass→K; r30 GD_R30=1 → RJ)', async () => {
    await ok('dev-follow', 'F128');
    const out = dump('dev-follow', 'F128');
    assert.match(out, /m0 单张 (K|RJ)/);
  });
});
