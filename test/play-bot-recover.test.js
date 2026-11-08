/**
 * Bot recovery must always advance or the UI stalls on “思考中”.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, botStepDecide, recoverBotPlay, isOver, play, coachMove } from '../play/core.js';
import {
  repairBotBusy,
  shouldRescheduleBotsAfterFailure,
  inferTributeUiMode,
  isBotCallbackCurrent,
} from '../play/bot-busy.js';

test('recoverBotPlay succeeds after sabotaged decide move', () => {
  const g = newGame({ seed: 3001 });
  let seat = g.round.currentSeat;
  while (seat !== 0 && !isOver(g)) {
    assert.ok(botStepDecide(g).ok);
    seat = g.round.currentSeat;
  }
  const before = g.log.length;
  const bad = play(g, seat, g.round.hands[seat].slice(0, 2), { by: 'decide' });
  assert.equal(bad.ok, false);
  const r = recoverBotPlay(g, { coach: coachMove(g, seat), detail: 'test sabotage' });
  assert.ok(r.ok, r.reason);
  assert.ok(g.log.length > before);
});

test('repairBotBusy clears on tributePending even when seat is not human', () => {
  const busy = repairBotBusy({
    isOver: false,
    tribMode: false,
    tributePending: true,
    currentSeat: 2,
    humanSeat: 0,
    botBusy: true,
  });
  assert.equal(busy, false);
});

test('shouldRescheduleBotsAfterFailure when bot seat stuck', () => {
  assert.equal(
    shouldRescheduleBotsAfterFailure({
      isOver: false,
      tribMode: false,
      tributePending: false,
      currentSeat: 2,
      humanSeat: 0,
    }),
    true,
  );
  assert.equal(
    shouldRescheduleBotsAfterFailure({
      isOver: false,
      tribMode: null,
      tributePending: false,
      currentSeat: 0,
      humanSeat: 0,
    }),
    false,
  );
});

test('inferTributeUiMode maps engine phase to UI', () => {
  assert.equal(
    inferTributeUiMode({
      tributePending: true,
      tributeState: { phase: 'give', plan: { kind: 'single', resisted: false }, pending: [] },
    }),
    'give',
  );
  assert.equal(
    inferTributeUiMode({
      tributePending: true,
      tributeState: {
        phase: 'return',
        plan: { kind: 'single', resisted: false },
        pending: [{ seat: 0, to: 3, received: { id: 1 } }],
      },
      humanSeat: 0,
    }),
    'return',
  );
  assert.equal(
    inferTributeUiMode({
      tributePending: true,
      tributeState: { phase: 'done', plan: { kind: 'single', resisted: true }, pending: [] },
    }),
    'resist',
  );
});

test('isBotCallbackCurrent rejects stale generation or token', () => {
  assert.equal(
    isBotCallbackCurrent({ scheduleGen: 3, capturedGen: 3, token: 1, capturedToken: 1 }),
    true,
  );
  assert.equal(
    isBotCallbackCurrent({ scheduleGen: 4, capturedGen: 3, token: 1, capturedToken: 1 }),
    false,
  );
  assert.equal(
    isBotCallbackCurrent({ scheduleGen: 3, capturedGen: 3, token: 2, capturedToken: 1 }),
    false,
  );
});
