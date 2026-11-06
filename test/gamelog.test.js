import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, botStepDecide, isOver, startDeal, autoTribute, tributePending, gameLogRows, gameLogJsonl, archiveDeal } from '../play/core.js';

test('gameLog: full JSONL of all deals with per-move hand/table/coach/move', () => {
  const g = newGame({ seed: 4242, progression: true });
  let guard = 0;
  while (!isOver(g) && guard++ < 400) botStepDecide(g);
  archiveDeal(g);
  startDeal(g);
  if (tributePending(g)) autoTribute(g);
  for (let i = 0; i < 5 && !isOver(g); i++) botStepDecide(g);
  const rows = gameLogRows(g, { flags: [{ id: 'flag-x', note: 'n' }] });
  assert.equal(rows[0].type, 'game');
  assert.equal(rows[0].deals, 2);
  const deals = rows.filter((r) => r.type === 'deal');
  assert.deepEqual(deals.map((d) => d.deal), [1, 2]);
  assert.ok(deals[0].finished && deals[0].result);
  const moves = rows.filter((r) => r.type === 'move');
  assert.equal(rows[0].moves, moves.length);
  assert.ok(moves.length > 20);
  for (const m of moves) {
    assert.ok(Array.isArray(m.handBefore) && m.handBefore.length > 0);
    assert.ok(m.table && Array.isArray(m.table.counts));
    assert.ok(m.coach && m.move && typeof m.move.text === 'string');
  }
  assert.equal(rows.at(-1).type, 'flag');
  const txt = gameLogJsonl(g, {});
  assert.ok(txt.length > 10000);
  for (const l of txt.trim().split('\n')) JSON.parse(l);
});
