/**
 * Regression: scheduleBots must not leave botBusy stuck when bot step returns null/throws,
 * or when currentSeat is human (south) after a bot turn / stale async callback.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HUMAN_SEAT,
  shouldYieldPlayToHuman,
  humanPlayPhase,
  botBusyAfterStaleCallback,
  repairBotBusyForHuman,
} from '../play/bot-busy.js';

/** Minimal model of pre-fix scheduleBots callback (guandan-play-90568fce7f). */
function legacyBotCallback(step) {
  let botBusy = true;
  const res = step();
  if (!res) return { botBusy, advanced: false };
  botBusy = false;
  return { botBusy, advanced: true };
}

/** Post-fix: finally clears busy; recovery when step returns null. */
function fixedBotCallback(step) {
  let botBusy = true;
  let advanced = false;
  try {
    let res;
    try {
      res = step();
    } catch {
      res = { ok: true, recovery: true };
    }
    if (!res) res = { ok: true, recovery: true };
    if (res?.ok) advanced = true;
  } finally {
    botBusy = false;
  }
  return { botBusy, advanced };
}

/** scheduleBots entry: yield to human clears botBusy. */
function scheduleBotsEntry(state) {
  if (shouldYieldPlayToHuman(state)) {
    return { botBusy: false, yield_: true };
  }
  return { botBusy: true, yield_: false };
}

/** After bot play, seat passes to human — scheduler must not leave bots busy. */
function afterBotToHuman(state) {
  const next = { ...state, currentSeat: HUMAN_SEAT };
  return scheduleBotsEntry(next);
}

test('legacy bot callback leaves botBusy true when step returns null', () => {
  const r = legacyBotCallback(() => null);
  assert.equal(r.botBusy, true);
  assert.equal(r.advanced, false);
});

test('fixed bot callback clears botBusy even when step returns null', () => {
  const r = fixedBotCallback(() => null);
  assert.equal(r.botBusy, false);
  assert.equal(r.advanced, true);
});

test('fixed bot callback clears botBusy when step throws', () => {
  const r = fixedBotCallback(() => { throw new Error('decide failed'); });
  assert.equal(r.botBusy, false);
  assert.equal(r.advanced, true);
});

test('scheduleBots yields and clears botBusy when currentSeat is human', () => {
  const r = scheduleBotsEntry({
    isOver: false,
    tribMode: false,
    tributePending: false,
    currentSeat: HUMAN_SEAT,
  });
  assert.equal(r.yield_, true);
  assert.equal(r.botBusy, false);
});

test('after bot turn, human seat must not keep botBusy', () => {
  const r = afterBotToHuman({
    isOver: false,
    tribMode: false,
    tributePending: false,
    currentSeat: 3,
  });
  assert.equal(r.botBusy, false);
  assert.equal(r.yield_, true);
});

test('stale bot callback clears botBusy when token changed and south to act', () => {
  const busy = botBusyAfterStaleCallback({
    botBusy: true,
    my: 1,
    token: 2,
    currentSeat: HUMAN_SEAT,
  });
  assert.equal(busy, false);
});

test('stale bot callback keeps botBusy when another bot seat is active', () => {
  const busy = botBusyAfterStaleCallback({
    botBusy: true,
    my: 1,
    token: 2,
    currentSeat: 2,
  });
  assert.equal(busy, true);
});

test('render repair clears botBusy on human play phase', () => {
  const busy = repairBotBusyForHuman({
    isOver: false,
    tribMode: false,
    tributePending: false,
    currentSeat: HUMAN_SEAT,
    botBusy: true,
  });
  assert.equal(busy, false);
  assert.equal(
    humanPlayPhase({
      isOver: false,
      tribMode: false,
      tributePending: false,
      currentSeat: HUMAN_SEAT,
    }),
    true,
  );
});
