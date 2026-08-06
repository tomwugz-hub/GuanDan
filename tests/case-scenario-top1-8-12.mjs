/**
 * 例8/10/11/12 场景 Top1 golden：与百例书摘/Codex 审计一致
 */
import { readFileSync } from "node:fs";
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { getTurnAdvice } from "../coach/turn-advice.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const SUIT = { S: SUITS.spades, H: SUITS.hearts, C: SUITS.clubs, D: SUITS.diamonds, joker: SUITS.joker };

function handFromCase(n) {
  const data = JSON.parse(readFileSync(`training-samples/cases/case-${String(n).padStart(3, "0")}.json`, "utf8"));
  return data.hand.cards.map((c) => createCard(
    c.rank,
    c.rank === "SJ" || c.rank === "BJ" ? SUITS.joker : (SUIT[c.suit] ?? c.suit),
    c.deckIndex ?? 0,
  ));
}

function scenario(n) {
  const specs = JSON.parse(readFileSync("training-samples/cases/case-scenarios-1-50.json", "utf8"));
  return specs.find((s) => s.caseNumber === n);
}

function buildState(n) {
  const spec = scenario(n);
  const hand = handFromCase(n);
  const level = spec.levelRank;
  const prev = classifyPlay(
    spec.previousCards.map(([r, s, d = 0]) => createCard(r, SUIT[s] ?? s, d)),
    level,
  );
  const pass = classifyPlay([], level);
  const filler = Array.from({ length: 16 }, () => createCard("5", SUITS.clubs));
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: prev, lastActivePlayerIndex: spec.lastActive };
  if (spec.passTail >= 2) {
    state.playHistory = [
      { turnNumber: 0, playerIndex: spec.lastActive, play: prev },
      { turnNumber: 1, playerIndex: 2, play: pass },
      { turnNumber: 2, playerIndex: 3, play: pass },
    ];
  } else if (n === 12) {
    state.playHistory = [
      { turnNumber: 0, playerIndex: 2, play: prev },
      { turnNumber: 1, playerIndex: 1, play: pass },
    ];
  }
  return { state, spec, level, prev };
}

// 例8：末家 88822 管 55533，不得拆四 A
{
  const { state } = buildState(8);
  const advice = getTurnAdvice(state, 0, { lite: false, scoringAudience: "human", maxCandidates: 96 });
  const rec = advice.recommendation.candidate;
  assert(rec.type === PLAY_TYPES.tripleWithPair && rec.mainRank === "8", `例8 Top1 应为三带二8，实际 ${rec.type} ${rec.mainRank}`);
  const ranks = [...new Set((rec.cards ?? []).map((c) => c.rank))];
  assert(ranks.includes("2") && !ranks.includes("A"), `例8 应 88822 不拆四A，实际 ${ranks.join(",")}`);
  console.log("PASS: 例8 Top1 88822");
}

// 例10：过10管单8，不拆四9
{
  const { state } = buildState(10);
  const t0 = performance.now();
  const advice = getTurnAdvice(state, 0, { lite: false, scoringAudience: "human", maxCandidates: 96 });
  const ms = performance.now() - t0;
  const rec = advice.recommendation.candidate;
  assert(rec.type === PLAY_TYPES.single && rec.mainRank === "10", `例10 Top1 应为单10，实际 ${rec.type} ${rec.mainRank}`);
  assert(ms < 5000, `例10 计算 ${ms.toFixed(0)}ms 超过 5s`);
  console.log(`PASS: 例10 Top1 单10 (${ms.toFixed(0)}ms)`);
}

// 例11：顺9管单4，四张9拆一张重组同花顺
{
  const { state } = buildState(11);
  const t0 = performance.now();
  const advice = getTurnAdvice(state, 0, { lite: false, scoringAudience: "human", maxCandidates: 96 });
  const ms = performance.now() - t0;
  const rec = advice.recommendation.candidate;
  assert(rec.type === PLAY_TYPES.single && rec.mainRank === "9", `例11 Top1 应为单9，实际 ${rec.type} ${rec.mainRank}`);
  assert(ms < 5000, `例11 计算 ${ms.toFixed(0)}ms 超过 5s`);
  console.log(`PASS: 例11 Top1 单9 (${ms.toFixed(0)}ms)`);
}

// 例12：搭档单4占权宜过牌
{
  const { state } = buildState(12);
  const advice = getTurnAdvice(state, 0, { lite: false, scoringAudience: "human", maxCandidates: 96 });
  const rec = advice.recommendation.candidate;
  assert(rec.type === PLAY_TYPES.pass, `例12 Top1 应为过牌，实际 ${rec.type} ${rec.mainRank}`);
  console.log("PASS: 例12 Top1 Pass");
}
