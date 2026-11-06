/**
 * handplan `decompose` uses Date.now() wall-clock (25ms cap in the moves loop). Under load, early exit changes plan → arena drift.
 * `GD_HANDPLAN_NO_WALLCLOCK=1` disables only those time checks (node budget 20000 unchanged).
 */
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { makeDeck, shuffle } from "../engine/cards.js";
import { makeRng } from "../play/core.js";
import { decompose } from "../policy/handplan.js";

describe("handplan wall-clock gate", () => {
  it("GD_HANDPLAN_NO_WALLCLOCK=1 ignores Date.now cap (deterministic under stalled fast-forward time)", () => {
    const rng = makeRng(26991018);
    const hand = shuffle(makeDeck(), rng).slice(0, 14);
    const lv = "2";
    const cache = new Map();

    Reflect.deleteProperty(process.env, "GD_HANDPLAN_NO_WALLCLOCK");
    let t = 0;
    mock.method(Date, "now", () => { t += 100; return t; }); // first call sets t0; second already >25
    const planWall = decompose(hand, lv, cache);
    mock.restoreAll();

    process.env.GD_HANDPLAN_NO_WALLCLOCK = "1";
    const cache2 = new Map();
    t = 0;
    mock.method(Date, "now", () => { t += 100; return t; });
    const planNoWall = decompose(hand, lv, cache2);
    mock.restoreAll();
    Reflect.deleteProperty(process.env, "GD_HANDPLAN_NO_WALLCLOCK");

    assert.notDeepEqual(
      planWall.comps.map((c) => c.key),
      planNoWall.comps.map((c) => c.key),
    );
  });
});
