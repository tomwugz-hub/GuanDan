import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cards } from "../engine/cards.js";
import { classify, TYPES, asFullHouse, asPairSeq, asStraightFlush } from "../engine/combos.js";
import { beats } from "../engine/compare.js";

describe("more combos", () => {
  it("fullhouse with one wild on pair", () => {
    const c = asFullHouse(cards("9S 9H 9D 3S 8H"), "8");
    assert.equal(c.type, TYPES.FULLHOUSE);
    assert.equal(c.rank, "9");
    assert.equal(c.pairRank, "3");
  });
  it("pairSeq with wild", () => {
    const c = asPairSeq(cards("3S 3H 4D 4C 5S 8H"), "8");
    assert.equal(c.type, TYPES.PAIR_SEQ);
    assert.equal(c.rank, "5");
  });
  it("sf with wild same suit fill", () => {
    const c = asStraightFlush(cards("3H 4H 8H 6H 7H"), "8");
    assert.ok(c);
    assert.equal(c.type, TYPES.STRAIGHT_FLUSH);
  });
  it("pass combo from empty classify", () => {
    assert.equal(classify([], "2").type, TYPES.PASS);
  });
  it("7 bomb beats 6 bomb", () => {
    const a = classify(cards("2S 2H 2D 2C 2S 2H 2D"), "5");
    const b = classify(cards("3S 3H 3D 3C 3S 3H"), "5");
    assert.equal(a.bombSize, 7);
    assert.ok(beats(a, b, "5"));
  });
});
