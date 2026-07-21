import { readFileSync } from "node:fs";
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import {
  detectHardInvariantCodes,
  filterHardInvariants,
} from "../strategy/hard-invariants.mjs";
import { enforceDoctrineOnCandidates } from "../strategy/doctrine-enforce.mjs";
import { auditRobotStructurePlay } from "../coach/robot-structure-violations.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const fourKHand = [
  c("K", SUITS.spades), c("K", SUITS.hearts), c("K", SUITS.clubs), c("K", SUITS.diamonds),
  c("7", SUITS.spades), c("9", SUITS.hearts),
];
const pairK = classifyPlay(fourKHand.slice(0, 2), "3");
const single7 = classifyPlay([fourKHand[4]], "3");
const pass = classifyPlay([], "3");

// golden: split-bomb
assert(
  detectHardInvariantCodes(pairK, fourKHand, "3", {}).includes("split-bomb"),
  "拆四 K 出对 K 必须命中 split-bomb",
);
assert(
  filterHardInvariants([pairK, single7], fourKHand, "3", {})[0] === single7,
  "split-bomb 候选必须在 Top1 前被剔除",
);

// golden: twp-level-kicker
const twpHand = [
  c("7", SUITS.spades), c("7", SUITS.hearts), c("7", SUITS.clubs),
  c("2", SUITS.spades), c("2", SUITS.clubs),
  c("Q", SUITS.hearts), c("Q", SUITS.diamonds),
];
const twpLevel = classifyPlay(twpHand.slice(0, 5), "2");
const twpQ = classifyPlay([...twpHand.slice(0, 3), ...twpHand.slice(5, 7)], "2");
assert(twpLevel.type === PLAY_TYPES.tripleWithPair, "测试牌必须识别为三带二");
assert(
  detectHardInvariantCodes(twpLevel, twpHand, "2", {}).includes("twp-level-kicker"),
  "三带二使用级牌对作带牌必须命中 twp-level-kicker",
);
assert(
  filterHardInvariants([twpLevel, twpQ], twpHand, "2", {})[0] === twpQ,
  "三带二级牌对带牌必须在 Top1 前被剔除",
);

// golden: beat-partner; Pass remains available.
const partnerPairJ = classifyPlay([c("J", SUITS.diamonds), c("J", SUITS.hearts)], "3");
const partnerCtx = {
  partnerOwnsTrick: true,
  partnerYieldRequired: true,
  previousPlay: partnerPairJ,
  playerIndex: 2,
  lastActivePlayerIndex: 0,
};
assert(
  detectHardInvariantCodes(pairK, fourKHand, "3", partnerCtx).includes("beat-partner"),
  "压队友必须命中 beat-partner",
);
assert(
  filterHardInvariants([pairK, pass], fourKHand, "3", partnerCtx)[0]?.type === PLAY_TYPES.pass,
  "队友占牌时 Top1 必须保留 Pass",
);

// Doctrine and timeline audit must expose the same stable codes.
const enforced = enforceDoctrineOnCandidates([
  { candidate: twpLevel, score: 0, reasons: [] },
  { candidate: twpQ, score: 1, reasons: [] },
], { hand: twpHand, levelRank: "2", previousPlay: null });
assert(enforced.candidates[0]?.candidate === twpQ, "doctrine 路径不得让级牌带对占 Top1");
assert(
  enforced.doctrineViolations.some((item) => item.code === "twp-level-kicker"),
  "doctrine 必须暴露 twp-level-kicker 审计码",
);

const auditCodes = auditRobotStructurePlay({
  play: pairK,
  hand: fourKHand,
  levelRank: "3",
  playerIndex: 2,
  mustBeat: partnerPairJ,
  tableBefore: { lastActivePlayerIndex: 0 },
}).map((item) => item.code);
assert(auditCodes.includes("split-bomb"), "timeline 审计必须暴露 split-bomb");
assert(auditCodes.includes("beat-partner"), "timeline 审计必须暴露 beat-partner");

// Structural guard: all four Top1-producing paths must invoke the shared filter.
const recommendSource = readFileSync(new URL("../strategy/recommend.mjs", import.meta.url), "utf8");
const robotSource = readFileSync(new URL("../coach/robot-player.mjs", import.meta.url), "utf8");
const doctrineSource = readFileSync(new URL("../strategy/doctrine-enforce.mjs", import.meta.url), "utf8");
for (const name of ["tryRobotQuickRecommendations", "deadlineFallbackRecommendations"]) {
  const start = recommendSource.indexOf(`function ${name}`);
  const next = recommendSource.indexOf("\nfunction ", start + 10);
  const body = recommendSource.slice(start, next < 0 ? undefined : next);
  assert(body.includes("filterHardInvariants("), `${name} 必须调用 filterHardInvariants`);
}
assert(robotSource.includes("filterHardInvariants("), "coach fallback 必须调用 filterHardInvariants");
assert(doctrineSource.includes("filterHardInvariants("), "doctrine 必须调用 filterHardInvariants");

console.log("PASS: hard invariants golden (beat-partner / twp-level-kicker / split-bomb)");
