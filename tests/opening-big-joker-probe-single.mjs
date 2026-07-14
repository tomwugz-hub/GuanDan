import {
  PLAY_TYPES,
  SUITS,
  buildStrategicGroups,
  createCard,
  createGameStateFromHands,
  recommendPlay,
} from "../src/index.mjs";
import { breaksPreferredStrategicGroup } from "../strategy/principles.mjs";

function cards(specs) {
  return specs.map(([rank, suit = SUITS.spades, deckIndex = 0]) => createCard(rank, suit, deckIndex));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const hand = cards([
  ["2", SUITS.diamonds, 0], ["2", SUITS.diamonds, 1],
  ["4", SUITS.clubs, 0], ["4", SUITS.clubs, 1], ["4", SUITS.diamonds, 0],
  ["6", SUITS.spades, 0],
  ["7", SUITS.diamonds, 1], ["7", SUITS.spades, 1],
  ["8", SUITS.diamonds, 0], ["8", SUITS.diamonds, 1], ["8", SUITS.hearts, 1], ["8", SUITS.spades, 0],
  ["9", SUITS.clubs, 1], ["9", SUITS.spades, 1],
  ["10", SUITS.hearts, 0],
  ["Q", SUITS.clubs, 0], ["Q", SUITS.diamonds, 1],
  ["K", SUITS.diamonds, 0], ["K", SUITS.diamonds, 1],
  ["A", SUITS.clubs, 0], ["A", SUITS.clubs, 1], ["A", SUITS.diamonds, 1],
  ["A", SUITS.hearts, 0], ["A", SUITS.spades, 0], ["A", SUITS.spades, 1],
  ["2", SUITS.hearts, 0],
  ["BJ", SUITS.joker, 0],
]);
const filler = cards([
  ["3", SUITS.clubs], ["3", SUITS.diamonds], ["5", SUITS.clubs], ["5", SUITS.diamonds],
]);
const state = createGameStateFromHands({
  levelRank: "2",
  hands: [hand, filler, filler, filler],
  currentPlayerIndex: 0,
});
const preferredGroups = buildStrategicGroups(hand, "2");
const rec = recommendPlay(hand, "2", null, {
  state,
  playerIndex: 0,
  preferredGroups,
  mlFusionMode: "off",
  mlModel: false,
});

assert(
  rec.candidate.type === PLAY_TYPES.single,
  `opening with a big joker should lead a probe single, got type=${rec.candidate.type} rank=${rec.candidate.mainRank ?? ""}; reasons=${rec.reasons.join(" | ")}`,
);
assert(
  rec.candidate.mainRank === "10",
  `opening probe should use the loose 10 instead of breaking the protected straight flush, got ${rec.candidate.mainRank ?? ""}`,
);
assert(
  !breaksPreferredStrategicGroup(rec.candidate, preferredGroups, "2", hand),
  "opening P6 probe single must not break a critical preferred group",
);
assert(
  rec.reasons.some((reason) => /P6|大王可回收|小单试探/.test(reason)),
  `opening probe single should cite P6, got ${rec.reasons.join("；")}`,
);

console.log("opening-big-joker-probe-single: passed");
