/**
 * 勇哥（上家/对手）用对5 压过队友老史对4 后须跟牌：
 * - history/index 不同步时不得 P10 过牌
 * - 应急兜底与全量推荐均须 Top1 为对子
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands, resolveTrickLeaderIndex, partnerLeadWasSuperseded } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { humanAdviceFallback } from "../coach/robot-player.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";
import { enrichScoringContext } from "../strategy/table-context.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);
const levelRank = "2";
const YONG_INDEX = 1;
const PARTNER_INDEX = 2;
const pair4 = classifyPlay([c("4", SUITS.clubs), c("4", SUITS.spades)], levelRank);
const pair5 = classifyPlay([c("5", SUITS.clubs), c("5", SUITS.diamonds)], levelRank);
const hand = [
  c("2", SUITS.clubs),
  c("8", SUITS.clubs), c("8", SUITS.diamonds), c("8", SUITS.spades),
  c("9", SUITS.diamonds),
  c("10", SUITS.hearts),
  c("J", SUITS.diamonds), c("J", SUITS.hearts),
  c("Q", SUITS.clubs), c("Q", SUITS.diamonds),
  c("7", SUITS.diamonds), c("7", SUITS.spades),
  ...Array.from({ length: 15 }, (_, i) => c("3", SUITS.clubs, i)),
].slice(0, 27);
const filler = Array.from({ length: 27 }, (_, i) => c("6", SUITS.hearts, i));

function assertMustBeatPair5(state, label, { expectSuperseded = false } = {}) {
  if (expectSuperseded && !partnerLeadWasSuperseded(state, 0, pair5)) {
    console.error(`FAIL [${label}]: 应识别为勇哥对5压过队友对4`);
    process.exit(1);
  }
  const leader = resolveTrickLeaderIndex(state, 0);
  if (leader === PARTNER_INDEX) {
    console.error(`FAIL [${label}]: 占牌者不应仍为队友`, leader);
    process.exit(1);
  }
  const ctx = enrichScoringContext({ state, playerIndex: 0, previousPlay: pair5 }, [], hand, levelRank);
  if (ctx.partnerOwnsTrick || !ctx.opponentActive) {
    console.error(`FAIL [${label}]: ctx`, ctx.partnerOwnsTrick, ctx.opponentActive);
    process.exit(1);
  }
  const fb = humanAdviceFallback(hand, levelRank, pair5, [], { state, playerIndex: 0 });
  if (fb.candidate.type === PLAY_TYPES.pass) {
    console.error(`FAIL [${label}]: 应急兜底过牌`, fb.reasons);
    process.exit(1);
  }
  const advice = getTurnAdvice(state, 0, {
    lite: true,
    scoringAudience: "human-lite",
    maxCandidates: 12,
    preferredGroups: [],
    handProfile: null,
  });
  if (advice.recommendation.candidate.type === PLAY_TYPES.pass) {
    console.error(`FAIL [${label}]: 教练 Top1 过牌`, advice.recommendation.reasons?.slice(0, 4));
    process.exit(1);
  }
}

// 1) history 已有勇哥对5，index 仍误指队友
assertMustBeatPair5(createGameStateFromHands({
  levelRank,
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: pair5,
  lastActivePlayerIndex: PARTNER_INDEX,
  playHistory: [
    { turnNumber: 10, playerIndex: PARTNER_INDEX, play: pair4 },
    { turnNumber: 11, playerIndex: YONG_INDEX, play: pair5 },
  ],
}), "history 完整 index 滞后");

// 2) history 仍停在老史对4，桌面已是勇哥对5（刷新后常见）
assertMustBeatPair5(createGameStateFromHands({
  levelRank,
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: pair5,
  lastActivePlayerIndex: YONG_INDEX,
  playHistory: [{ turnNumber: 10, playerIndex: PARTNER_INDEX, play: pair4 }],
}), "history 落后 勇哥对5", { expectSuperseded: true });

// 3) 最糟：index 与 history 都仍指向队友
assertMustBeatPair5(createGameStateFromHands({
  levelRank,
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: pair5,
  lastActivePlayerIndex: PARTNER_INDEX,
  playHistory: [{ turnNumber: 10, playerIndex: PARTNER_INDEX, play: pair4 }],
}), "index+history 均滞后", { expectSuperseded: true });

console.log("PASS: 勇哥对5压队友对4 → 须压，应急/全量均不过牌");
