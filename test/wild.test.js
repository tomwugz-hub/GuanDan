import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cards } from "../engine/cards.js";
import { classify, TYPES, asStraight, asPair, asBomb } from "../engine/combos.js";
import { isWildCard } from "../engine/ranks.js";

const L = "8";

describe("wild / 逢人配 (heart level only)", () => {
  it("heart level completes a pair", () => {
    const c = classify(cards("3S 8H"), L);
    assert.equal(c.type, TYPES.PAIR);
    assert.equal(c.rank, "3");
  });
  it("heart level completes a triple", () => {
    const c = classify(cards("3S 3H 8H"), L);
    assert.equal(c.type, TYPES.TRIPLE);
    assert.equal(c.rank, "3");
  });
  it("heart level fills a straight gap", () => {
    const c = asStraight(cards("3S 4H 8H 6C 7S"), L);
    assert.ok(c);
    assert.equal(c.rank, "7");
  });
  it("heart wilds add to a bomb", () => {
    const c = asBomb(cards("9S 9H 9D 8H"), L);
    assert.equal(c.type, TYPES.BOMB);
    assert.equal(c.bombSize, 4);
    assert.equal(c.rank, "9");
  });
  it("two heart wilds pad a bomb of A", () => {
    const c = asBomb(cards("AS AH AD AC AS 8H 8H"), L);
    assert.equal(c.type, TYPES.BOMB);
    assert.equal(c.rank, "A");
    assert.equal(c.bombSize, 7);
  });
  it("four level cards are still a bomb of the level rank (only hearts are wild)", () => {
    const c = asBomb(cards("8S 8H 8D 8C"), L);
    assert.equal(c.rank, "8");
    assert.equal(c.bombSize, 4);
    assert.equal(c.wilds, 1);
  });
  it("joker is not wild", () => {
    assert.equal(asPair(cards("3S RJ"), L), null);
  });
  it("heart 2 is wild when level is 2", () => {
    const c = classify(cards("KS 2H"), "2");
    assert.equal(c.type, TYPES.PAIR);
    assert.equal(c.rank, "K");
  });
  it("spade/diamond/club level cannot act as wild", () => {
    assert.equal(isWildCard(cards("8S")[0], L), false);
    assert.equal(isWildCard(cards("8D")[0], L), false);
    assert.equal(isWildCard(cards("8C")[0], L), false);
    assert.equal(asPair(cards("3S 8S"), L), null);
    assert.equal(asPair(cards("3S 8D"), L), null);
    assert.equal(asPair(cards("3S 8C"), L), null);
    assert.equal(asStraight(cards("3S 4H 8D 6C 7S"), L), null);
    assert.equal(asBomb(cards("9S 9H 9D 8C"), L), null);
  });
  it("5 Aces + 3 non-heart 2s when level is 2 is not an 8-bomb", () => {
    const hand = cards("AS AH AD AC AS 2S 2D 2C");
    const c = classify(hand, "2");
    assert.ok(!c || c.type !== TYPES.BOMB || c.bombSize !== 8);
    assert.equal(asBomb(hand, "2"), null);
  });
  it("5 Aces + one 红桃2 pads a bomb of A", () => {
    const c = asBomb(cards("AS AH AD AC AS 2H"), "2");
    assert.equal(c.type, TYPES.BOMB);
    assert.equal(c.rank, "A");
    assert.equal(c.bombSize, 6);
  });
  it("5 Aces + two 红桃2 pad a bomb of A", () => {
    const c = asBomb(cards("AS AH AD AC AS 2H 2H"), "2");
    assert.equal(c.type, TYPES.BOMB);
    assert.equal(c.rank, "A");
    assert.equal(c.bombSize, 7);
  });
});

describe("wild clamp", () => {
  it("reject 3+ wild combos", () => {
    const L2 = "8";
    assert.equal(classify(cards("8H 8H 8H"), L2)?.type !== TYPES.TRIPLE || classify(cards("8H 8H 8H"), L2).wilds <= 2, true);
    assert.ok(!classify(cards("8H 8H 8H 8H"), L2) || classify(cards("8H 8H 8H 8H"), L2).type === TYPES.BOMB);
  });
});
