import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cards } from "../engine/cards.js";
import { classify, TYPES } from "../engine/combos.js";
import { isLegalPlay, playAction, legalMoves } from "../engine/legal.js";

const L = "5";
const prev = (t) => classify(cards(t), L);

describe("legal plays", () => {
  it("lead cannot pass", () => {
    assert.equal(isLegalPlay([], null, L, { leading: true }), false);
    assert.equal(playAction([], null, L, true).ok, false);
  });
  it("follow may pass", () => {
    assert.equal(isLegalPlay([], prev("3S"), L, { leading: false }), true);
    assert.equal(playAction([], prev("3S"), L, false).combo.type, TYPES.PASS);
  });
  it("must beat same type", () => {
    assert.equal(isLegalPlay(cards("AS"), prev("KS"), L), true);
    assert.equal(isLegalPlay(cards("3S"), prev("KS"), L), false);
  });
  it("bomb can beat a single", () => {
    assert.equal(isLegalPlay(cards("7S 7H 7D 7C"), prev("AS"), L), true);
  });
  it("smaller pair cannot beat", () => {
    assert.equal(isLegalPlay(cards("4S 4H"), prev("9S 9H"), L), false);
  });
  it("lead any valid combo", () => {
    assert.equal(isLegalPlay(cards("3S 4H 5D 6C 7S"), null, L, { leading: true }), true);
  });
  it("invalid pile is illegal", () => {
    assert.equal(isLegalPlay(cards("3S 8H KH"), prev("AS"), L), false);
  });
  it("legalMoves includes pass when following", () => {
    const hand = cards("AS KH 7S 7H 7D 7C");
    const ms = legalMoves(hand, prev("3S"), L, false);
    assert.ok(ms.some((m) => m.combo.type === TYPES.PASS));
    assert.ok(ms.some((m) => m.combo.type === TYPES.SINGLE && m.combo.rank === "A"));
    assert.ok(ms.some((m) => m.combo.type === TYPES.BOMB));
  });
});

describe("legal generation extras", () => {
  it("lead fullhouse and sf", () => {
    const hand = cards("9S 9H 9D 3S 3H 4S 5S 6S 7S");
    const ms = legalMoves(hand, null, L, true);
    assert.ok(ms.some((m) => m.combo.type === TYPES.FULLHOUSE));
    assert.ok(ms.some((m) => m.combo.type === TYPES.STRAIGHT_FLUSH));
  });
  it("straights are exactly 5", () => {
    const hand = cards("3S 4H 5D 6C 7S 8H");
    const ms = legalMoves(hand, null, L, true);
    const sts = ms.filter((m) => m.combo.type === TYPES.STRAIGHT);
    assert.ok(sts.every((m) => m.cards.length === 5));
    assert.equal(classify(cards("3S 4H 5D 6C 7S 8H"), L), null);
  });
});
