import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { buildRobotAutoTimelineRecord } from "../app/robot-auto-timeline-record.mjs";
import { scanTimelineRobotStructureViolations } from "../coach/robot-structure-violations.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const levelRank = "9";
const fourKHand = [
  c("K", SUITS.spades), c("K", SUITS.hearts), c("K", SUITS.clubs), c("K", SUITS.diamonds),
  c("7", SUITS.spades),
];
const splitPairK = classifyPlay(fourKHand.slice(0, 2), levelRank);
const splitRecord = buildRobotAutoTimelineRecord({
  turnNumber: 10,
  playerIndex: 1,
  playerName: "勇哥",
  levelRank,
  handBefore: fourKHand,
  lastActivePlayerIndex: null,
  mustBeat: null,
  recommendation: { score: 0, play: splitPairK, reasons: ["test"] },
  actualPlay: splitPairK,
});

const partnerPairK = classifyPlay([c("K", SUITS.spades, 1), c("K", SUITS.hearts, 1)], levelRank);
const pairAHand = [c("A", SUITS.spades), c("A", SUITS.hearts), c("4", SUITS.clubs)];
const pairA = classifyPlay(pairAHand.slice(0, 2), levelRank);
const beatPartnerRecord = buildRobotAutoTimelineRecord({
  turnNumber: 11,
  playerIndex: 0,
  playerName: "你",
  levelRank,
  handBefore: pairAHand,
  lastActivePlayerIndex: 2,
  mustBeat: partnerPairK,
  recommendation: { score: 0, play: pairA, reasons: ["test"] },
  actualPlay: pairA,
});

for (const record of [splitRecord, beatPartnerRecord]) {
  assert(record.source === "robot-auto", "纯函数必须生成 robot-auto 记录");
  assert(record.handBefore?.length > 0, "robot-auto 必须保留 handBefore");
  assert(Object.hasOwn(record, "mustBeat"), "robot-auto 必须保留 mustBeat");
  assert(
    Object.hasOwn(record.tableBefore ?? {}, "lastActivePlayerIndex"),
    "robot-auto 必须保留 tableBefore.lastActivePlayerIndex",
  );
  assert(!Object.hasOwn(record, "allCandidates"), "不得保存全量候选");
}

const violations = scanTimelineRobotStructureViolations(
  [splitRecord, beatPartnerRecord],
  levelRank,
);
const codes = violations.map((item) => item.code);
assert(codes.includes("split-bomb"), "构造 timeline 必须扫出 split-bomb");
assert(codes.includes("beat-partner"), "构造 timeline 必须扫出 beat-partner");

console.log("PASS: robot-auto timeline 可审计 split-bomb / beat-partner");
