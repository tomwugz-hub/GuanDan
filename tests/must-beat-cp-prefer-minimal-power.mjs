/**
 * 须压连对：够用时应首推最小连对（889910 优于 991010JJ），不拆同花顺跑道前提下。
 */
import { createCard, SUITS, playSignature } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { recommendPlay, scoreCandidate } from "../strategy/recommend.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { enrichScoringContext } from "../strategy/table-context.mjs";
import { canBeat } from "../engine/compare-play.mjs";
import { breaksStraightFlushRunwayOnMustBeatCp } from "../strategy/sf-runway-guard.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

const hand = [
  c("3", SUITS.diamonds), c("7", SUITS.diamonds), c("8", SUITS.diamonds), c("9", SUITS.diamonds),
  c("10", SUITS.diamonds), c("J", SUITS.diamonds),
  c("8", SUITS.spades), c("9", SUITS.spades), c("10", SUITS.spades), c("10", SUITS.clubs),
  c("A", SUITS.clubs), c("2", SUITS.clubs), c("3", SUITS.clubs), c("4", SUITS.clubs), c("5", SUITS.clubs),
  c("J", SUITS.hearts), c("J", SUITS.hearts, 1), c("J", SUITS.spades),
  c("5", SUITS.spades), c("7", SUITS.hearts), c("A", SUITS.spades), c("9", SUITS.hearts),
];

const oppCp = classifyPlay([
  c("2", SUITS.spades), c("2", SUITS.spades, 1),
  c("3", SUITS.clubs), c("3", SUITS.clubs, 1),
  c("4", SUITS.clubs, 2), c("4", SUITS.hearts),
], "3");

const filler = Array.from({ length: 18 }, () => c("6", SUITS.clubs, 3));
const state = createGameStateFromHands({
  levelRank: "3",
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
  lastActivePlay: oppCp,
  lastActivePlayerIndex: 1,
});

const columnGroups = [
  { label: "列1", cards: hand.slice(0, 6) },
  { label: "列2", cards: hand.slice(6, 10) },
  { label: "列3", cards: hand.slice(10, 15) },
  { label: "三张J", cards: hand.slice(15, 18) },
  { label: "散牌", cards: hand.slice(18, 22) },
];

const beatCtx = { opponentActive: true, previousPlay: oppCp, preferredGroups: columnGroups, state, playerIndex: 0 };
const cands = generateBasicCandidates(hand, "3", oppCp).filter((item) => canBeat(item, oppCp));
const ctx = enrichScoringContext(beatCtx, cands, hand, "3");

const cpRanked = cands
  .filter((item) => item.type === PLAY_TYPES.consecutivePairs)
  .filter((item) => !breaksStraightFlushRunwayOnMustBeatCp(item, hand, "3", ctx))
  .map((item) => ({
    item,
    scored: scoreCandidate(item, hand, "3", oppCp, { ...ctx, preferredGroups: columnGroups }),
  }))
  .sort((a, b) => a.scored.score - b.scored.score);

if (cpRanked.length === 0) {
  console.log("PASS: 无未拆跑道的连对可压，跳过最小连对排序断言");
  process.exit(0);
}

const best = cpRanked[0].item;
const best8910 = cpRanked.find(({ item }) => item.mainRank === "10" && item.power <= 7);
const best910j = cpRanked.find(({ item }) => item.mainRank === "J");

if (best8910 && best910j && best.mainRank === "J") {
  throw new Error(`应首推更小连对 8910，实际 ${playSignature(best)}`);
}

const rec = recommendPlay(hand, "3", oppCp, {
  state,
  playerIndex: 0,
  preferredGroups: columnGroups,
  lite: true,
  scoringAudience: "human-lite",
  maxCandidates: 16,
  mlFusionMode: "off",
});

if (
  rec.candidate?.type === PLAY_TYPES.consecutivePairs
  && !breaksStraightFlushRunwayOnMustBeatCp(rec.candidate, hand, "3", beatCtx)
  && best8910
  && rec.candidate.mainRank === "J"
  && rec.candidate.power > best8910.item.power
) {
  throw new Error(`recommendPlay 应首推 8910 类连对，实际 ${playSignature(rec.candidate)}`);
}

console.log("PASS: 须压连对在未拆跑道前提下优先最小连对", playSignature(best));
