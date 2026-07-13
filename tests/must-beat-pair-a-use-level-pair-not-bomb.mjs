import { createCard } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";

const parse = (value) => {
  const [rank, suit, deckIndex] = value.split(":");
  return createCard(rank, suit, Number(deckIndex));
};

const hand = [
  "2:H:0", "2:S:1", "3:S:0", "3:S:1", "4:S:1", "5:C:1", "6:C:1", "6:S:0",
  "7:D:0", "8:D:0", "9:D:0", "10:C:1", "10:D:1", "10:H:1", "Q:C:0", "Q:C:1",
  "Q:H:0", "Q:S:0", "K:D:1", "K:S:1", "A:C:0", "A:D:0", "A:S:1",
].map(parse);

const previous = classifyPlay([
  createCard("A", "H", 100),
  createCard("A", "S", 101),
], "2");
const filler = Array.from({ length: 18 }, (_, index) => createCard("5", "C", 200 + index));
const state = createGameStateFromHands({
  levelRank: "2",
  hands: [filler, hand, filler, filler],
  currentPlayerIndex: 1,
  lastActivePlay: previous,
  lastActivePlayerIndex: 0,
});

const recommendation = recommendPlay(hand, "2", previous, {
  state,
  playerIndex: 1,
  lastActivePlayerIndex: 0,
  lite: true,
  scoringAudience: "robot",
  opponentActive: true,
  partnerOwnsTrick: false,
  preferredGroups: [],
  maxCandidates: 6,
  mlFusionMode: "off",
  deadline: performance.now() + 5000,
});

if (recommendation.candidate?.type !== PLAY_TYPES.pair || recommendation.candidate?.mainRank !== "2") {
  throw new Error(
    `须压对A应使用级牌对2，不应动炸；实际 ${recommendation.candidate?.type}:${recommendation.candidate?.mainRank}，理由 ${recommendation.reasons?.join("；")}`,
  );
}

console.log("PASS: 须压对A使用级牌对2，不动四Q炸弹");
