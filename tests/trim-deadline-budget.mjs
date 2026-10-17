/**
 * lite 裁池：maxCandidates 生效且须在毫秒级完成（避免主线程卡死）。
 */
import { performance } from "node:perf_hooks";
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { trimCandidatesForScoring } from "../strategy/recommend.mjs";

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);
const hand = Array.from({ length: 27 }, (_, i) => c(
  ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"][i % 13],
  [SUITS.spades, SUITS.hearts, SUITS.clubs, SUITS.diamonds][i % 4],
  i,
));
const previousPlay = classifyPlay([c("5", SUITS.diamonds, 99)], "2");
const pool = generateBasicCandidates(hand, "2", previousPlay, { lite: true });
const started = performance.now();
const trimmed = trimCandidatesForScoring(pool, 24, hand, "2", previousPlay, { playerIndex: 0 });
const elapsed = performance.now() - started;

if (trimmed.length > 24) {
  console.error("FAIL: 裁池后仍超过 maxCandidates", trimmed.length);
  process.exit(1);
}
if (elapsed > 500) {
  console.error("FAIL: 裁池耗时过长", elapsed.toFixed(0), "ms");
  process.exit(1);
}

console.log("PASS trim-deadline-budget:", trimmed.length, "candidates", elapsed.toFixed(1), "ms");
