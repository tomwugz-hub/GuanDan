/**
 * 级牌4：应急领出三带二应带最小非级牌对（QQQ+66），不宜 QQQ+44
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { pickStructureSafeEmergencyCandidate } from "../strategy/principles.mjs";
import {
  inferTripleWithPairKickerRank,
  minTripleWithPairKickerRank,
  pickBestTripleWithPairLead,
} from "../strategy/scorers/structure.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);

// 无同花顺跑道：QQQ 不带黑桃，避免 isLeadTurnSfRunwayBreak 滤光三带二
const hand = [
  c("Q", SUITS.hearts, 0), c("Q", SUITS.diamonds, 0), c("Q", SUITS.clubs, 0),
  c("4", SUITS.spades, 0), c("4", SUITS.clubs, 0),
  c("6", SUITS.spades, 0), c("6", SUITS.clubs, 0),
  c("8", SUITS.hearts, 0), c("8", SUITS.diamonds, 0),
  c("9", SUITS.hearts, 0), c("9", SUITS.diamonds, 0),
  c("J", SUITS.hearts, 0), c("J", SUITS.diamonds, 0),
  c("A", SUITS.clubs, 0), c("A", SUITS.diamonds, 0),
  c("K", SUITS.hearts, 0),
  c("SJ", SUITS.joker, 0), c("BJ", SUITS.joker, 0),
];

const levelRank = "4";
const all = generateBasicCandidates(hand, levelRank, null, { lite: true, emergency: true });
const twpPool = all.filter(
  (item) => item.type === PLAY_TYPES.tripleWithPair && item.mainRank === "Q",
);

if (minTripleWithPairKickerRank(hand, levelRank, "Q") !== "6") {
  console.error("FAIL: 最小附件应为对6，实际", minTripleWithPairKickerRank(hand, levelRank, "Q"));
  process.exit(1);
}

const best = pickBestTripleWithPairLead(twpPool, hand, levelRank);
if (!best || inferTripleWithPairKickerRank(best) !== "6") {
  console.error("FAIL: pickBestTripleWithPairLead 应选 QQQ+66，实际", inferTripleWithPairKickerRank(best));
  process.exit(1);
}

const emergency = pickStructureSafeEmergencyCandidate(hand, levelRank, all, [], { isOpening: true });
if (
  emergency?.type !== PLAY_TYPES.tripleWithPair
  || emergency.mainRank !== "Q"
  || inferTripleWithPairKickerRank(emergency) !== "6"
) {
  console.error(
    "FAIL: 应急领出应 QQQ+66，实际",
    emergency?.type,
    emergency?.mainRank,
    inferTripleWithPairKickerRank(emergency),
  );
  process.exit(1);
}

console.log("PASS: twp-min-kicker-level4-emergency");
