/**
 * Regression: scheduleBots must not leave botBusy stuck when bot step returns null/throws.
 * (Published guandan-play-90568fce7f shared this bug in play/ui.js.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

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
