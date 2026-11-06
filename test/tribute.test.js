import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cards } from "../engine/cards.js";
import {
  isDoubleDown, tributePlan, pickTributeCard, canResistTribute,
  isLegalReturnCard, applyTributes, teamOf, pickReturnCard,
  legalReturnCards, previewTributes, resolveTributePairs,
} from "../engine/tribute.js";

describe("tribute / double-down (下游进贡上游)", () => {
  it("teams 0+2 vs 1+3", () => {
    assert.equal(teamOf(0), teamOf(2));
    assert.equal(teamOf(1), teamOf(3));
  });
  it("双下不进贡", () => {
    assert.equal(isDoubleDown([0, 2, 1, 3]), true);
    assert.equal(tributePlan([0, 2, 1, 3]).count, 0);
  });
  it("头+末同队：末游进贡头游", () => {
    const p = tributePlan([0, 1, 3, 2]);
    assert.equal(p.count, 1);
    assert.deepEqual(p.pairs, [{ from: 2, to: 0 }]);
  });
  it("头+三同队：末游→头游、三游→二游", () => {
    const p = tributePlan([0, 1, 2, 3]);
    assert.equal(p.count, 2);
    assert.deepEqual(p.pairs, [
      { from: 3, to: 0 },
      { from: 2, to: 1 },
    ]);
  });
  it("tribute is highest non-joker", () => {
    const hand = cards("RJ AH KH 3S");
    const c = pickTributeCard(hand, "2");
    assert.equal(c.rank, "A");
  });
  it("level card is higher tribute than A", () => {
    const hand = cards("AH 6S 3D");
    const c = pickTributeCard(hand, "6");
    assert.equal(c.rank, "6");
  });
  it("抗贡：进贡方双大王则该对不进贡", () => {
    const plan = tributePlan([0, 1, 2, 3]);
    const hands = [
      cards("AH 3C"),
      cards("KH 4C"),
      cards("3S 5C"),
      cards("RJ RJ 4S AS"),
    ];
    assert.equal(canResistTribute(hands, plan), true);
    const r = applyTributes(hands, plan, { levelRank: "2" });
    // 末游 3 抗贡；三游 2 仍要进贡给二游 1
    assert.equal(r.moved.length, 1);
    assert.equal(r.moved[0].from, 2);
    assert.equal(r.moved[0].to, 1);
    assert.equal(r.resistedPairs.length, 1);
    assert.equal(r.resistedPairs[0].from, 3);
  });
  it("收贡方双大王不抗贡", () => {
    const plan = tributePlan([0, 1, 3, 2]);
    const hands = [
      cards("RJ RJ 3S"),
      cards("2S 4C"),
      cards("AS KH"),
      cards("5D 6C"),
    ];
    assert.equal(canResistTribute(hands, plan), false);
    const r = applyTributes(hands, plan, { levelRank: "2" });
    assert.equal(r.moved.length, 1);
    assert.equal(r.moved[0].from, 2);
    assert.equal(r.moved[0].to, 0);
    assert.equal(r.moved[0].card.rank, "A");
  });
  it("return card <=10, not 级牌, not joker", () => {
    assert.equal(isLegalReturnCard(cards("9S")[0], "5"), true);
    assert.equal(isLegalReturnCard(cards("JS")[0], "5"), false);
    assert.equal(isLegalReturnCard(cards("5S")[0], "5"), false);
    assert.equal(isLegalReturnCard(cards("RJ")[0], "5"), false);
  });
  it("apply tribute 末→头 并自动还贡最小合法", () => {
    const plan = tributePlan([0, 1, 3, 2]);
    const hands = [cards("3S 4H"), cards("2S 6C"), cards("AH 9S"), cards("5D 7C")];
    const r = applyTributes(hands, plan, { levelRank: "2" });
    assert.equal(r.moved.length, 1);
    assert.equal(r.moved[0].from, 2);
    assert.equal(r.moved[0].to, 0);
    assert.equal(r.moved[0].card.rank, "A");
    assert.equal(r.returned.length, 1);
    assert.equal(r.returned[0].from, 0);
    assert.equal(r.returned[0].to, 2);
    assert.ok(["3", "4"].includes(r.returned[0].card.rank));
    assert.equal(r.hands[0].some((c) => c.rank === "A"), true);
    assert.equal(r.hands[2].some((c) => c.rank === "A"), false);
  });
  it("两贡则两还；可指定还贡牌", () => {
    const plan = tributePlan([0, 1, 2, 3]);
    const hands = [
      cards("3S 4H"),
      cards("5C 6D"),
      cards("AS 8S"),
      cards("KH 9D"),
    ];
    const ret0 = hands[0].find((c) => c.rank === "3");
    const ret1 = hands[1].find((c) => c.rank === "5");
    const r = applyTributes(hands, plan, { levelRank: "2", returns: [ret0, ret1] });
    assert.equal(r.moved.length, 2);
    assert.equal(r.returned.length, 2);
    assert.equal(r.returned[0].card.rank, "3");
    assert.equal(r.returned[1].card.rank, "5");
  });
  it("pickReturnCard 选最小合法", () => {
    const c = pickReturnCard(cards("JS 9S 4H AH"), "2");
    assert.equal(c.rank, "4");
  });

  it("指定还贡牌（非最小）必须用那张", () => {
    const plan = tributePlan([0, 1, 3, 2]);
    const hands = [cards("3S 9H"), cards("2S 6C"), cards("AH 8S"), cards("5D 7C")];
    const nine = hands[0].find((c) => c.rank === "9");
    const r = applyTributes(hands, plan, { levelRank: "2", returns: [nine] });
    assert.equal(r.returned.length, 1);
    assert.equal(r.returned[0].card.rank, "9");
    assert.equal(r.returned[0].card.id, nine.id);
    assert.equal(r.hands[2].some((c) => c.id === nine.id), true);
    assert.equal(r.hands[0].some((c) => c.id === nine.id), false);
  });
  it("非法指定还贡回退自动最小", () => {
    const plan = tributePlan([0, 1, 3, 2]);
    const hands = [cards("3S 9H"), cards("2S 6C"), cards("AH 8S"), cards("5D 7C")];
    // J 非法还贡，回退自动最小 3
    const r = applyTributes(hands, plan, { levelRank: "2", returns: [{ rank: "J", suit: "S" }] });
    assert.equal(r.returned.length, 1);
    assert.equal(r.returned[0].card.rank, "3");
  });
  it("legalReturnCards 排除级牌与王", () => {
    const hand = cards("3S 9H JS 5S RJ");
    const legal = legalReturnCards(hand, "5");
    assert.deepEqual(legal.map((c) => c.rank).sort(), ["3", "9"]);
  });
  it("previewTributes 列出还贡座位与合法牌，不改手牌", () => {
    const plan = tributePlan([0, 1, 3, 2]);
    const hands = [cards("3S 9H"), cards("2S 6C"), cards("AH 8S"), cards("5D 7C")];
    const snap = hands.map((h) => h.map((c) => c.id).join(","));
    const prev = previewTributes(hands, plan, { levelRank: "2" });
    assert.equal(prev.needReturn, true);
    assert.equal(prev.pairs.length, 1);
    assert.equal(prev.pairs[0].returnFrom, 0);
    assert.equal(prev.pairs[0].returnTo, 2);
    assert.ok(prev.pairs[0].legal.some((c) => c.rank === "3"));
    assert.ok(prev.pairs[0].legal.some((c) => c.rank === "9"));
    assert.equal(prev.pairs[0].auto.rank, "3");
    assert.deepEqual(hands.map((h) => h.map((c) => c.id).join(",")), snap);
  });
  it("宿迁双下仍不进贡；官方双下双贡", () => {
    assert.equal(tributePlan([0, 2, 1, 3]).count, 0);
    const p = tributePlan([0, 2, 1, 3], { officialDoubleTribute: true });
    assert.equal(p.count, 2);
    assert.equal(p.officialDoubleTribute, true);
    assert.deepEqual(p.pairs, [
      { from: 1, to: 0 },
      { from: 3, to: 2 },
    ]);
  });
  it("官方双贡大贡归头游", () => {
    const plan = tributePlan([0, 2, 1, 3], { officialDoubleTribute: true });
    const hands = [
      cards("3S 4H"),
      cards("KS 5C"),
      cards("6D 7C"),
      cards("AH 8S"),
    ];
    const resolved = resolveTributePairs(hands, plan, "2");
    assert.equal(resolved[0].from, 3);
    assert.equal(resolved[0].to, 0);
    assert.equal(resolved[1].from, 1);
    assert.equal(resolved[1].to, 2);
    const nine = hands[0].find((c) => c.rank === "4");
    const six = hands[2].find((c) => c.rank === "6");
    const r = applyTributes(hands, plan, { levelRank: "2", returns: [nine, six] });
    assert.equal(r.moved.length, 2);
    const toHead = r.moved.find((m) => m.to === 0);
    assert.equal(toHead.from, 3);
    assert.equal(toHead.card.rank, "A");
    const toSecond = r.moved.find((m) => m.to === 2);
    assert.equal(toSecond.from, 1);
    assert.equal(toSecond.card.rank, "K");
    assert.equal(r.returned[0].card.rank, "4");
    assert.equal(r.returned[1].card.rank, "6");
  });
});
