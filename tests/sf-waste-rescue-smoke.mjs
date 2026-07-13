/**
 * sf-waste-small 修复冒烟：教纲拦截后 rescue 不得把同花顺救回 Top1
 */
import { createCard } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { SUITS } from "../engine/card.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const hand = [
  createCard("3", SUITS.spades), createCard("4", SUITS.spades), createCard("5", SUITS.spades),
  createCard("6", SUITS.spades), createCard("7", SUITS.spades),
  createCard("8", SUITS.hearts), createCard("9", SUITS.hearts), createCard("10", SUITS.hearts),
  createCard("J", SUITS.hearts), createCard("Q", SUITS.hearts),
  createCard("4", SUITS.clubs), createCard("5", SUITS.clubs), createCard("6", SUITS.clubs),
  createCard("7", SUITS.clubs),
];
const singleSJ = classifyPlay([createCard("SJ", SUITS.joker, 0)], "2");
const top = recommendPlay(hand, "2", singleSJ, {
  playerIndex: 0,
  lastActivePlayerIndex: 1,
  mlFusionMode: "off",
  mlModel: false,
  scoringAudience: "robot",
  lite: true,
});
assert(
  top.candidate?.type === PLAY_TYPES.pass,
  `仅同花顺可压小王应过牌，实际 ${top.candidate?.label ?? top.candidate?.type}`,
);

// 整手同花顺压对 K 仍应允许（hand<=8 残局阈值）
const sfHand = [
  createCard("2", SUITS.clubs), createCard("3", SUITS.clubs), createCard("4", SUITS.clubs),
  createCard("5", SUITS.clubs), createCard("6", SUITS.clubs),
];
const pairK = classifyPlay([
  createCard("K", SUITS.clubs, 0),
  createCard("K", SUITS.clubs, 1),
], "2");
const sfTop = recommendPlay(sfHand, "2", pairK, { mlFusionMode: "off" });
assert(
  sfTop.candidate?.type === PLAY_TYPES.straightFlush,
  `整手同花顺压对K应亮牌，实际 ${sfTop.candidate?.type}`,
);

console.log("sf-waste-rescue 冒烟通过");
