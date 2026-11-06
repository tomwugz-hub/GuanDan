import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cards } from "../engine/cards.js";
import { createMatch, createRound, applyPlay, applyGameResult } from "../engine/state.js";
import { RULESETS } from "../engine/rulesets.js";

describe("round play", () => {
  it("rejects play out of turn", () => {
    const match = createMatch({ levelRank: "2" });
    const hand0 = cards("AS KH");
    const hand1 = cards("3S 4H");
    const hand2 = cards("5S 6H");
    const hand3 = cards("7S 8H");
    const round = createRound(match, { dealerSeat: 0, hands: [hand0, hand1, hand2, hand3] });
    const r = applyPlay(round, 1, [hand1[0]]);
    assert.equal(r.ok, false);
  });
  it("lead then follow pass", () => {
    const match = createMatch({ levelRank: "2" });
    const a = cards("AS");
    const b = cards("3S");
    const c = cards("4S");
    const d = cards("5S");
    const round = createRound(match, { dealerSeat: 0, hands: [a, b, c, d] });
    assert.equal(applyPlay(round, 0, a).ok, true);
    assert.equal(round.finished.includes(0), true);
    assert.equal(applyPlay(round, 1, []).ok, true);
    assert.equal(applyPlay(round, 2, []).ok, true);
    // two passes: remaining players all passed, new lead (seat 0 is out)
    assert.equal(round.lastCombo, null);
    assert.equal(round.currentSeat, 1);
  });
});

describe("suqian pass-A", () => {
  it("double down at A wins match", () => {
    const match = createMatch({ levelRank: "A", defenderTeam: 0 });
    const r = applyGameResult(match, [0, 2, 1, 3]);
    assert.equal(r.passA, true);
    assert.equal(match.matchOver, true);
    assert.equal(match.winnerTeam, 0);
  });
  it("win A without double-down resets to 2 and head eats tribute", () => {
    const match = createMatch({ levelRank: "A", defenderTeam: 0 });
    const r = applyGameResult(match, [0, 1, 3, 2]);
    assert.equal(r.passA, false);
    assert.equal(r.resetTo2, true);
    assert.equal(r.headEatsTribute, true);
    assert.equal(match.levelRank, "2");
    assert.equal(r.tribute.count, 0);
  });
  it("lose at A: table goes to 2", () => {
    const match = createMatch({ levelRank: "A", defenderTeam: 0 });
    const r = applyGameResult(match, [1, 0, 3, 2]);
    assert.equal(r.resetTo2, true);
    assert.equal(match.levelRank, "2");
    assert.equal(match.defenderTeam, 1);
  });
  it("below A, win upgrades one, double-down two", () => {
    const m1 = createMatch({ levelRank: "2", defenderTeam: 0 });
    applyGameResult(m1, [0, 1, 3, 2]);
    assert.equal(m1.levelRank, "3");
    const m2 = createMatch({ levelRank: "2", defenderTeam: 0 });
    applyGameResult(m2, [0, 2, 1, 3]);
    assert.equal(m2.levelRank, "4");
  });
});

describe("official stub", () => {
  it("official2022 does not force double-down pass-A", () => {
    const match = createMatch({ ruleset: RULESETS.OFFICIAL_2022, levelRank: "A", defenderTeam: 0 });
    const r = applyGameResult(match, [0, 1, 3, 2]);
    assert.equal(match.config.passARequiresDoubleDown, false);
    assert.equal(r.resetTo2, false);
  });
});
