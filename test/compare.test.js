import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cards } from "../engine/cards.js";
import { classify, TYPES } from "../engine/combos.js";
import { beats, compareCombos, bombWeight } from "../engine/compare.js";

const L = "5";

function C(...t) { return classify(cards(...t), L); }

describe("type detection", () => {
  it("single pair triple", () => {
    assert.equal(C("3S").type, TYPES.SINGLE);
    assert.equal(C("3S 3H").type, TYPES.PAIR);
    assert.equal(C("3S 3H 3D").type, TYPES.TRIPLE);
  });
  it("mixed jokers are not a pair", () => {
    assert.equal(classify(cards("RJ BJ"), L), null);
  });
  it("same jokers are a pair", () => {
    assert.equal(C("RJ RJ").type, TYPES.PAIR);
    assert.equal(C("BJ BJ").type, TYPES.PAIR);
  });
  it("fullhouse", () => {
    const x = C("9S 9H 9D 3S 3H");
    assert.equal(x.type, TYPES.FULLHOUSE);
    assert.equal(x.rank, "9");
  });
  it("straight >=5 no wrap", () => {
    assert.equal(C("3S 4H 5D 6C 7S").type, TYPES.STRAIGHT);
    // r21：官方规则 A 可作 1 —— A2345 是最小顺子；绕圈仍非法
    assert.equal(classify(cards("AS 2H 3D 4C 5S"), L).rank, "5");
    assert.equal(classify(cards("QS KH AD 2C 3S"), L), null);
  });
  it("pairSeq and tripleSeq", () => {
    assert.equal(C("6S 6H 7D 7C 8S 8H").type, TYPES.PAIR_SEQ);
    assert.equal(C("3S 3H 3D 4S 4H 4D").type, TYPES.TRIPLE_SEQ);
  });
  it("pairSeq and tripleSeq max 6 cards", () => {
    assert.equal(classify(cards("5S 5H 6S 6H 7D 7C 8S 8H"), L), null);
    assert.equal(classify(cards("3S 3H 3D 4S 4H 4D 5S 5H 5D"), L), null);
  });
  it("bomb 4+", () => {
    assert.equal(C("8S 8H 8D 8C").type, TYPES.BOMB);
    assert.equal(C("8S 8H 8D 8C 8S").bombSize, 5);
  });
  it("straight flush 5", () => {
    const x = C("3S 4S 5S 6S 7S");
    assert.equal(x.type, TYPES.STRAIGHT_FLUSH);
  });
  it("four jokers is bomb", () => {
    const x = C("RJ RJ BJ BJ");
    assert.equal(x.type, TYPES.BOMB);
    assert.equal(x.rocket, true);
  });
});

describe("5-bomb < tonghuashun < 6-bomb", () => {
  it("weights", () => {
    const b5 = C("9S 9H 9D 9C 9S");
    const sf = C("3H 4H 5H 6H 7H");
    const b6 = C("8S 8H 8D 8C 8S 8H");
    assert.equal(bombWeight(b5), 5);
    assert.equal(bombWeight(sf), 5.5);
    assert.equal(bombWeight(b6), 6);
    assert.ok(beats(sf, b5, L));
    assert.ok(beats(b6, sf, L));
    assert.ok(!beats(b5, sf, L));
    assert.ok(beats(b6, b5, L));
  });
  it("bigger bomb rank wins same size", () => {
    const a = C("KS KH KD KC");
    const b = C("3S 3H 3D 3C");
    assert.ok(beats(a, b, L));
  });
  it("sf compare by high card", () => {
    const low = C("3S 4S 5S 6S 7S");
    const high = C("9H 10H JH QH KH");
    assert.ok(beats(high, low, L));
  });
  it("bomb beats normal", () => {
    const bomb = C("4S 4H 4D 4C");
    const st = C("3S 4H 5D 6C 7S");
    assert.ok(beats(bomb, st, L));
  });
  it("sf beats normal", () => {
    const sf = C("3S 4S 5S 6S 7S");
    const pair = C("AS AH");
    assert.ok(beats(sf, pair, L));
  });
});

describe("same-type compare", () => {
  it("singles", () => {
    assert.ok(beats(C("AH"), C("KH"), L));
    assert.ok(beats(C("5S"), C("AH"), L));
  });
  it("cannot follow different normal type", () => {
    assert.equal(beats(C("AS AH"), C("3S 4H 5D 6C 7S"), L), false);
  });
  it("straight must same length", () => {
    const a = classify(cards("3S 4H 5D 6C 7S 8H"), L);
    const b = C("3S 4H 5D 6C 7S");
    assert.equal(beats(a, b, L), false);
  });
});
