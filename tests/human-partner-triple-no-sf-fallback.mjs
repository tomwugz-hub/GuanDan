/**
 * 队友三张 A 占牌：人类应急兜底与正式建议均不得同花顺/炸弹压队友（P10）
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands, opponentsPendingAfterPlayer } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { humanAdviceFallback } from "../coach/robot-player.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { mergePremiumStrategicGroups } from "../strategy/strategic-groups.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);
const levelRank = "5";
const partnerTripleA = classifyPlay([
  c("A", SUITS.clubs),
  c("A", SUITS.hearts),
  c("A", SUITS.spades),
], levelRank);

const hand = [
  c("5", SUITS.hearts),
  c("6", SUITS.diamonds),
  c("7", SUITS.diamonds),
  c("8", SUITS.diamonds),
  c("10", SUITS.diamonds),
  c("J", SUITS.diamonds),
  c("Q", SUITS.diamonds),
  c("K", SUITS.diamonds),
  ...Array.from({ length: 19 }, (_, i) => c("3", SUITS.clubs, i)),
];
const filler = Array.from({ length: 27 }, (_, i) => c("4", SUITS.spades, i));

let state = createGameStateFromHands({
  levelRank,
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
});
state = {
  ...state,
  lastActivePlay: partnerTripleA,
  lastActivePlayerIndex: 2,
  playHistory: [
    { turnNumber: 6, playerIndex: 2, play: partnerTripleA },
    { turnNumber: 7, playerIndex: 1, play: classifyPlay([], levelRank) },
  ],
};

const pending = opponentsPendingAfterPlayer(state, 0);
if (!pending.includes(3)) {
  console.error("FAIL: 毛毛应尚未表态，pending=", pending);
  process.exit(1);
}

const tableCtx = {
  state,
  playerIndex: 0,
  lastActivePlayerIndex: 2,
};
const columnGroups = [{ cards: hand.slice(0, 8), label: "方片同花顺" }];
const preferredGroups = mergePremiumStrategicGroups(columnGroups, hand, levelRank);

const fallback = humanAdviceFallback(hand, levelRank, partnerTripleA, preferredGroups, tableCtx);
if (fallback.candidate.type !== PLAY_TYPES.pass && BOMB_TYPES.has(fallback.candidate.type)) {
  console.error(
    "FAIL: 应急兜底不宜同花顺压队友三张，实际",
    fallback.candidate.type,
    fallback.candidate.label,
  );
  process.exit(1);
}

const advice = getTurnAdvice(state, 0, {
  lite: true,
  scoringAudience: "human-lite",
  preferredGroups,
  maxCandidates: 20,
  mlFusionMode: "off",
});
const top = advice.recommendation.candidate;
if (top.type !== PLAY_TYPES.pass && BOMB_TYPES.has(top.type)) {
  console.error(
    "FAIL: 教练 Top1 不宜炸队友三张 A，实际",
    top.type,
    top.label,
    advice.recommendation.reasons?.slice(0, 4),
  );
  process.exit(1);
}

console.log("PASS: 队友三张 A 占牌 → 人类教练与应急兜底均 Pass");
