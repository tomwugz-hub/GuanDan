import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cards } from "../engine/cards.js";
import { classify, TYPES, asStraight, asStraightFlush, asPairSeq, asTripleSeq } from "../engine/combos.js";
import { beats, compareCombos } from "../engine/compare.js";
import { legalMoves } from "../engine/legal.js";
import { generateCandidates } from "../search/index.js";

const L = "7";
describe("r21 A as 1 in sequences", () => {
  it("A2345 straight is 5-high", () => {
    const s = asStraight(cards("AS 2D 3C 4H 5S"), L);
    assert.equal(s.type, TYPES.STRAIGHT); assert.equal(s.rank, "5"); assert.equal(s.low, "A");
  });
  it("A2345 straight flush, with wild filling a gap", () => {
    assert.equal(asStraightFlush(cards("AS 2S 3S 4S 5S"), L).rank, "5");
    const w = classify(cards("AS 2S 7H 4S 5S"), L); // 7H = 红心级牌
    assert.equal(w.type, TYPES.STRAIGHT_FLUSH); assert.equal(w.rank, "5");
  });
  it("no wraparound, no jokers", () => {
    assert.equal(asStraight(cards("QS KD AC 2H 3S"), L), null);
    assert.equal(asStraight(cards("JS QD KC AH 2S"), L), null);
    assert.equal(asStraight(cards("BJ 2D 3C 4H 5S"), L), null);
  });
  it("AA2233 / QQKKAA pair seq, AAA222 plate", () => {
    assert.equal(asPairSeq(cards("AS AD 2S 2D 3C 3H"), L).rank, "3");
    assert.equal(asPairSeq(cards("QS QD KS KD AC AH"), L).rank, "A");
    assert.equal(asTripleSeq(cards("AS AD AC 2S 2D 2C"), L).rank, "2");
    assert.equal(asPairSeq(cards("KS KD AS AD 2C 2H"), L), null);
  });
  it("compare order A2345 < 23456 < ... < 10JQKA (level card not boosted in straights)", () => {
    const seqs = ["AS 2D 3C 4H 5S", "2S 3D 4C 5H 6S", "6S 7D 8C 9H 10S", "9S 10D JC QH KS", "10S JD QC KH AS"];
    const cs = seqs.map((t) => classify(cards(t), "5"));
    for (let i = 1; i < cs.length; i++) {
      assert.ok(compareCombos(cs[i], cs[i - 1], "5") > 0, seqs[i]);
      assert.ok(beats(cs[i], cs[i - 1], "5"));
      assert.ok(!beats(cs[i - 1], cs[i], "5"));
    }
    const sf1 = classify(cards("AS 2S 3S 4S 5S"), L), sf2 = classify(cards("2D 3D 4D 5D 6D"), L);
    assert.ok(beats(sf2, sf1, L) && !beats(sf1, sf2, L));
    assert.ok(beats(classify(cards("2S 2D 3S 3D 4C 4H"), L), classify(cards("AS AD 2C 2H 3C 3H"), L), L));
  });
  it("move generation includes A-low structures", () => {
    const hand = cards("AS AD 2S 2D 3C 3H 4C 5D");
    const lead = generateCandidates({ hand, levelRank: L, leading: true });
    assert.ok(lead.some((m) => m.combo.type === TYPES.STRAIGHT && m.combo.rank === "5"));
    assert.ok(lead.some((m) => m.combo.type === TYPES.PAIR_SEQ && m.combo.rank === "3"));
    assert.ok(legalMoves(cards("AS 2S 3S 4S 5S 9D"), null, L, true).some((m) => m.combo.type === TYPES.STRAIGHT_FLUSH));
  });
});
