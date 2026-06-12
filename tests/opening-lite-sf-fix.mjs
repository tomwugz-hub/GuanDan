/**
 * 开局 lite 快速建议：不宜首推双逢人配同花顺炸（实局 active-session 手牌）
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { computeRecommendations } from "../strategy/recommend.mjs";
import { buildStrategicGroups } from "../strategy/strategic-groups.mjs";
import { evaluateHandProfile } from "../strategy/hand-profile.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

const cards = (specs) => specs.map(([rank, suit = SUITS.spades, deckIndex = 0]) => createCard(rank, suit, deckIndex));

const hand = cards([
  ["2", SUITS.spades, 1], ["3", SUITS.hearts, 1],
  ["4", SUITS.clubs], ["4", SUITS.hearts, 1],
  ["5", SUITS.hearts], ["5", SUITS.spades, 1],
  ["6", SUITS.clubs], ["6", SUITS.spades, 1],
  ["7", SUITS.clubs, 1], ["8", SUITS.diamonds],
  ["9", SUITS.clubs], ["9", SUITS.hearts], ["9", SUITS.spades, 1],
  ["10", SUITS.clubs], ["10", SUITS.clubs, 1],
  ["J", SUITS.diamonds], ["J", SUITS.diamonds, 1], ["J", SUITS.spades], ["J", SUITS.spades, 1],
  ["Q", SUITS.clubs], ["Q", SUITS.clubs, 1], ["Q", SUITS.hearts], ["Q", SUITS.spades, 1],
  ["2", SUITS.hearts], ["2", SUITS.hearts, 1],
  ["K", SUITS.diamonds], ["A", SUITS.diamonds, 1],
]);

const state = createGameStateFromHands({
  levelRank: "2",
  hands: [hand, cards([["6"]]), cards([["8"]]), cards([["9"]])],
  currentPlayerIndex: 0,
});

const preferredGroups = buildStrategicGroups(hand, "2");
const ctx = {
  state,
  playerIndex: 0,
  mlFusionMode: "off",
  maxCandidates: 16,
  preferredGroups,
  handProfile: evaluateHandProfile(hand, "2", { preferredGroups }),
  lite: true,
};

const { top } = computeRecommendations(hand, "2", null, ctx);

if (BOMB_TYPES.has(top.candidate.type)) {
  console.error("FAIL: 开局 lite 不宜首推炸弹", top.candidate.type, top.candidate.label ?? "");
  process.exit(1);
}

console.log("PASS: 开局 lite Top1 =", top.candidate.type, top.candidate.label ?? "");
