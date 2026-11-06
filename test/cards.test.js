import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeDeck, dealFourHands, cards, parseCard } from "../engine/cards.js";
import { singleStrength, isWildCard } from "../engine/ranks.js";

describe("cards", () => {
  it("two decks = 108", () => {
    assert.equal(makeDeck().length, 108);
  });
  it("deal 4 x 27", () => {
    const hs = dealFourHands();
    assert.equal(hs.length, 4);
    assert.ok(hs.every((h) => h.length === 27));
  });
  it("parse and wild — only heart level is 逢人配", () => {
    const c = parseCard("AH");
    assert.equal(c.rank, "A");
    assert.equal(isWildCard(parseCard("5H"), "5"), true);
    assert.equal(isWildCard(parseCard("5S"), "5"), false);
    assert.equal(isWildCard(parseCard("5D"), "5"), false);
    assert.equal(isWildCard(parseCard("5C"), "5"), false);
    assert.equal(isWildCard(parseCard("5S"), "6"), false);
  });
  it("level beats A, jokers beat level", () => {
    assert.ok(singleStrength("5", "5") > singleStrength("A", "5"));
    assert.ok(singleStrength("RJ", "5") > singleStrength("5", "5"));
    assert.ok(singleStrength("BJ", "5") > singleStrength("5", "5"));
    assert.ok(singleStrength("RJ", "5") > singleStrength("BJ", "5"));
    assert.ok(singleStrength("3", "5") > singleStrength("2", "5"));
  });
  it("when level is 2, only heart 2 is wild; 2 still above A", () => {
    assert.equal(isWildCard(parseCard("2H"), "2"), true);
    assert.equal(isWildCard(parseCard("2S"), "2"), false);
    assert.ok(singleStrength("2", "2") > singleStrength("A", "2"));
  });
  it("jokers are never wild", () => {
    assert.equal(isWildCard(parseCard("RJ"), "2"), false);
    assert.equal(isWildCard(parseCard("BJ"), "2"), false);
  });
});
