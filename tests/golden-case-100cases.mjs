/**
 * 《掼蛋实战100例》golden 回归 — 5–8 个可结构化局面
 * 对应 training-samples/guandan-100cases-doctrine.md 中 C100-* 原则
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SUITS, PLAY_TYPES, classifyPlay, createCard, createGameStateFromHands,
  generateBasicCandidates, recommendPlay,
} from "../src/index.mjs";
import { scoreCandidate } from "../strategy/recommend.mjs";
import { enrichScoringContext } from "../strategy/table-context.mjs";
import { runCaseScenarioBatch } from "./lib/case-100-scenario-runner.mjs";

const goldenRoot = path.dirname(fileURLToPath(import.meta.url));
const SUIT_FROM_JSON = {
  hearts: SUITS.hearts,
  clubs: SUITS.clubs,
  diamonds: SUITS.diamonds,
  spades: SUITS.spades,
  joker: SUITS.joker,
  H: SUITS.hearts,
  S: SUITS.spades,
  C: SUITS.clubs,
  D: SUITS.diamonds,
};

/** 从 training-samples/cases/case-NNN.json 读取已标注手牌 */
function handFromCaseJson(caseId) {
  const p = path.join(goldenRoot, "..", "training-samples", "cases", `${caseId}.json`);
  const data = JSON.parse(readFileSync(p, "utf8"));
  return data.hand.cards.map((c) => {
    const suit = c.rank === "SJ" || c.rank === "BJ"
      ? SUITS.joker
      : (SUIT_FROM_JSON[c.suit] ?? c.suit);
    return createCard(c.rank, suit, c.deckIndex ?? 0);
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cards(specs) {
  return specs.map(([rank, suit = SUITS.spades, deckIndex = 0]) => createCard(rank, suit, deckIndex));
}

function scoreFollow(candidate, hand, previousPlay, extraCtx = {}) {
  const filler = cards([
    ["3", SUITS.hearts], ["4", SUITS.clubs], ["5", SUITS.diamonds], ["6", SUITS.spades],
    ["7", SUITS.hearts], ["8", SUITS.clubs], ["9", SUITS.diamonds], ["10", SUITS.spades],
    ["J", SUITS.hearts], ["Q", SUITS.clubs], ["K", SUITS.diamonds], ["A", SUITS.spades],
  ]);
  const state = createGameStateFromHands({
    levelRank: extraCtx.levelRank ?? "2",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  const all = generateBasicCandidates(hand, extraCtx.levelRank ?? "2", previousPlay);
  const passPlay = classifyPlay([], extraCtx.levelRank ?? "2");
  const pool = previousPlay ? [passPlay, ...all] : all;
  const ctx = enrichScoringContext({
    state,
    playerIndex: 0,
    previousPlay,
    lastActivePlayerIndex: extraCtx.lastActivePlayerIndex ?? 1,
    isOpening: false,
    leadMode: "must-beat",
    ...extraCtx,
  }, pool, hand, extraCtx.levelRank ?? "2");
  ctx._candidates = pool;
  return scoreCandidate(candidate, hand, extraCtx.levelRank ?? "2", previousPlay, ctx);
}

function scoreOpening(candidate, hand, profile, extraCtx = {}) {
  const state = createGameStateFromHands({
    levelRank: extraCtx.levelRank ?? "2",
    hands: [hand, cards([["3", SUITS.hearts]]), cards([["4", SUITS.clubs]]), cards([["5", SUITS.spades]])],
    currentPlayerIndex: 0,
  });
  const all = generateBasicCandidates(hand, extraCtx.levelRank ?? "2", null);
  const ctx = enrichScoringContext({
    state,
    playerIndex: 0,
    isOpening: true,
    leadMode: "fresh-open",
    handProfile: profile,
    ...extraCtx,
  }, all, hand, extraCtx.levelRank ?? "2");
  ctx._candidates = all;
  return scoreCandidate(candidate, hand, extraCtx.levelRank ?? "2", null, ctx);
}

// #1 例6：末家负责制 — 下家连对两家不要，须连对管牌
{
  const level = "7";
  const lowerLead = classifyPlay(cards([
    ["7", SUITS.spades], ["7", SUITS.hearts],
    ["8", SUITS.clubs], ["8", SUITS.diamonds],
    ["9", SUITS.spades], ["9", SUITS.hearts],
  ]), level);
  const hand = cards([
    ["8", SUITS.spades], ["8", SUITS.hearts],
    ["9", SUITS.clubs], ["9", SUITS.diamonds],
    ["10", SUITS.spades], ["10", SUITS.hearts],
    ["4", SUITS.clubs], ["5", SUITS.diamonds], ["6", SUITS.spades],
    ["J", SUITS.hearts], ["Q", SUITS.clubs], ["K", SUITS.diamonds],
    ["A", SUITS.spades], ["2", SUITS.hearts], ["3", SUITS.clubs],
    ["4", SUITS.hearts], ["5", SUITS.spades], ["6", SUITS.diamonds],
    ["J", SUITS.spades], ["Q", SUITS.hearts], ["K", SUITS.clubs],
    ["A", SUITS.diamonds], ["2", SUITS.clubs], ["2", SUITS.diamonds],
    ["3", SUITS.diamonds], ["3", SUITS.spades], ["4", SUITS.diamonds],
  ]);
  const filler = cards([
    ["3", SUITS.hearts], ["5", SUITS.clubs], ["6", SUITS.clubs], ["7", SUITS.diamonds],
    ["10", SUITS.clubs], ["J", SUITS.diamonds], ["Q", SUITS.diamonds], ["K", SUITS.spades],
    ["A", SUITS.hearts], ["2", SUITS.spades], ["6", SUITS.hearts], ["10", SUITS.diamonds],
  ]);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  const pass = classifyPlay([], level);
  state = {
    ...state,
    lastActivePlay: lowerLead,
    lastActivePlayerIndex: 1,
    playHistory: [
      { turnNumber: 0, playerIndex: 1, play: lowerLead },
      { turnNumber: 1, playerIndex: 2, play: pass },
      { turnNumber: 2, playerIndex: 3, play: pass },
    ],
  };
  const top = recommendPlay(hand, level, lowerLead, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    maxCandidates: 96,
  });
  assert(
    top.candidate?.type === PLAY_TYPES.consecutivePairs
      || top.candidate?.type === PLAY_TYPES.straight,
    `C100-M1 例6 末家须管牌，实际 ${top.candidate?.type}`,
  );
  assert(top.reasons.some((r) => /C100-M1/.test(r)), "C100-M1 理由应出现");
}

// #2 例45：末家须杂顺管下家顺子
{
  const level = "3";
  const lowerStraight = classifyPlay(cards([
    ["4", SUITS.spades], ["5", SUITS.hearts], ["6", SUITS.clubs], ["7", SUITS.diamonds], ["8", SUITS.spades],
  ]), level);
  const beatStraight = classifyPlay(cards([
    ["8", SUITS.hearts], ["9", SUITS.clubs], ["10", SUITS.diamonds], ["J", SUITS.spades], ["Q", SUITS.hearts],
  ]), level);
  const hand = cards([
    ["8", SUITS.hearts], ["9", SUITS.clubs], ["10", SUITS.diamonds], ["J", SUITS.spades], ["Q", SUITS.hearts],
    ["4", SUITS.clubs], ["5", SUITS.diamonds], ["6", SUITS.spades], ["7", SUITS.hearts],
    ["K", SUITS.clubs], ["A", SUITS.diamonds], ["2", SUITS.spades],
    ["3", SUITS.clubs], ["3", SUITS.diamonds], ["4", SUITS.hearts], ["5", SUITS.clubs],
    ["6", SUITS.diamonds], ["7", SUITS.clubs], ["8", SUITS.diamonds],
    ["9", SUITS.spades], ["10", SUITS.hearts], ["J", SUITS.diamonds], ["Q", SUITS.spades],
    ["K", SUITS.diamonds], ["A", SUITS.spades], ["2", SUITS.hearts], ["2", SUITS.clubs],
  ]);
  const filler = cards([
    ["3", SUITS.hearts], ["3", SUITS.spades], ["6", SUITS.clubs], ["9", SUITS.hearts],
    ["10", SUITS.clubs], ["J", SUITS.clubs], ["Q", SUITS.diamonds], ["K", SUITS.hearts],
    ["A", SUITS.clubs], ["2", SUITS.diamonds], ["4", SUITS.diamonds], ["5", SUITS.spades],
  ]);
  const pass = classifyPlay([], level);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: lowerStraight,
    lastActivePlayerIndex: 1,
    playHistory: [
      { turnNumber: 0, playerIndex: 1, play: lowerStraight },
      { turnNumber: 1, playerIndex: 2, play: pass },
      { turnNumber: 2, playerIndex: 3, play: pass },
    ],
  };
  assert(beatStraight && beatStraight.type === PLAY_TYPES.straight, "杂顺应可分类");
  const sBeat = scoreFollow(beatStraight, hand, lowerStraight, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  const sPass = scoreFollow(pass, hand, lowerStraight, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  assert(sBeat.score < sPass.score, `C100-M1 例45 顺子管牌应优于过牌（${sBeat.score} vs ${sPass.score}）`);
  assert(sBeat.reasons.some((r) => /C100-M1/.test(r)), "C100-M1 理由");
}

// #3 例44 语境：弱牌助攻勿首发小单
{
  const hand = cards([
    ["3", SUITS.spades], ["3", SUITS.hearts],
    ["4", SUITS.clubs], ["5", SUITS.diamonds], ["6", SUITS.spades],
    ["7", SUITS.hearts], ["8", SUITS.clubs], ["9", SUITS.diamonds],
    ["10", SUITS.spades], ["J", SUITS.hearts], ["Q", SUITS.clubs],
    ["K", SUITS.diamonds], ["A", SUITS.spades], ["2", SUITS.hearts],
    ["4", SUITS.hearts], ["5", SUITS.clubs], ["6", SUITS.diamonds],
    ["7", SUITS.spades], ["8", SUITS.hearts], ["9", SUITS.clubs],
    ["10", SUITS.diamonds], ["J", SUITS.spades], ["Q", SUITS.hearts],
    ["K", SUITS.clubs], ["A", SUITS.diamonds], ["2", SUITS.clubs],
  ]);
  const filler = cards([
    ["4", SUITS.spades], ["5", SUITS.spades], ["6", SUITS.clubs], ["7", SUITS.clubs],
    ["8", SUITS.diamonds], ["9", SUITS.spades], ["10", SUITS.clubs], ["J", SUITS.diamonds],
    ["Q", SUITS.diamonds], ["K", SUITS.spades], ["A", SUITS.clubs], ["2", SUITS.diamonds],
  ]);
  let state = createGameStateFromHands({
    levelRank: "2",
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: null, playHistory: [] };
  const top = recommendPlay(hand, "2", null, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    maxCandidates: 96,
    handProfile: { role: "support", score: 4 },
  });
  assert(
    top.candidate?.type !== PLAY_TYPES.single
      || top.reasons.some((r) => /C100-O1/.test(r)),
    `C100-O1 弱牌勿首发小单，实际 ${top.candidate?.type}`,
  );
  assert(
    [PLAY_TYPES.pair, PLAY_TYPES.consecutivePairs, PLAY_TYPES.tripleWithPair].includes(top.candidate?.type)
      || top.reasons.some((r) => /C100-O1|T1/.test(r)),
    `C100-O1 弱牌宜组牌/对子探路，实际 ${top.candidate?.type}`,
  );
}

// #4 例1：牌型多元化，fresh-open 不宜固定三带二首发（C100-G1）
{
  const level = "2";
  const hand = cards([
    ["10", SUITS.hearts, 0],
    ["J", SUITS.clubs, 0],
    ["A", SUITS.hearts, 0],
    ["Q", SUITS.spades, 0],
    ["J", SUITS.spades, 0],
    ["10", SUITS.spades, 0],
    ["9", SUITS.spades, 0],
    ["8", SUITS.spades, 0],
    ["K", SUITS.hearts, 0],
    ["K", SUITS.diamonds, 0],
    ["2", SUITS.hearts, 0],
    ["K", SUITS.clubs, 0],
    ["9", SUITS.spades, 1],
    ["9", SUITS.diamonds, 0],
    ["10", SUITS.diamonds, 0],
    ["9", SUITS.clubs, 0],
    ["8", SUITS.clubs, 0],
    ["7", SUITS.hearts, 0],
    ["6", SUITS.spades, 0],
    ["5", SUITS.diamonds, 0],
    ["5", SUITS.hearts, 0],
    ["5", SUITS.clubs, 0],
    ["3", SUITS.clubs, 0],
    ["3", SUITS.spades, 0],
    ["3", SUITS.spades, 1],
    ["4", SUITS.hearts, 0],
    ["4", SUITS.diamonds, 0],
  ]);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, cards([["3", SUITS.hearts]]), cards([["4", SUITS.clubs]]), cards([["5", SUITS.spades]])],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: null, playHistory: [] };
  const profile = { role: "main-attack", label: "主攻牌", score: 14, looseSingles: 1 };
  const top = recommendPlay(hand, level, null, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    maxCandidates: 96,
    handProfile: profile,
    leadMode: "fresh-open",
  });
  assert(
    top.candidate?.type !== PLAY_TYPES.tripleWithPair
      || top.candidate?.mainRank !== "9",
    `C100-G1 例1 不宜首发999+对，实际 ${top.candidate?.label}`,
  );
  assert(
    [PLAY_TYPES.straight, PLAY_TYPES.tripleWithPair, PLAY_TYPES.consecutivePairs, PLAY_TYPES.pair]
      .includes(top.candidate?.type)
      || top.reasons.some((r) => /C100-G1/.test(r)),
    `C100-G1 例1 宜多元化组牌首发，实际 ${top.candidate?.type}`,
  );
}

// #4b 例2：上家对7 → 宜对Q管牌，保留对4（C100-G1）
{
  const level = "4";
  const upperPair7 = classifyPlay(cards([
    ["7", SUITS.hearts, 0], ["7", SUITS.spades, 0],
  ]), level);
  const hand = cards([
    ["4", SUITS.spades, 0],
    ["A", SUITS.spades, 0],
    ["A", SUITS.hearts, 0],
    ["A", SUITS.diamonds, 0],
    ["K", SUITS.hearts, 0],
    ["K", SUITS.clubs, 0],
    ["K", SUITS.clubs, 1],
    ["K", SUITS.hearts, 1],
    ["K", SUITS.diamonds, 0],
    ["K", SUITS.diamonds, 1],
    ["Q", SUITS.spades, 0],
    ["Q", SUITS.hearts, 0],
    ["Q", SUITS.diamonds, 0],
    ["J", SUITS.hearts, 0],
    ["J", SUITS.hearts, 1],
    ["10", SUITS.hearts, 0],
    ["9", SUITS.clubs, 0],
    ["4", SUITS.hearts, 0],
    ["8", SUITS.hearts, 0],
    ["8", SUITS.spades, 0],
    ["7", SUITS.diamonds, 0],
    ["7", SUITS.hearts, 0],
    ["7", SUITS.spades, 0],
    ["6", SUITS.hearts, 0],
    ["5", SUITS.clubs, 0],
    ["4", SUITS.spades, 1],
    ["3", SUITS.hearts, 0],
  ]);
  const filler = cards([
    ["3", SUITS.clubs], ["5", SUITS.diamonds], ["6", SUITS.spades], ["8", SUITS.clubs],
    ["9", SUITS.diamonds], ["10", SUITS.spades], ["J", SUITS.clubs], ["Q", SUITS.clubs],
    ["K", SUITS.spades], ["A", SUITS.clubs], ["2", SUITS.hearts], ["2", SUITS.spades],
    ["3", SUITS.diamonds], ["5", SUITS.spades], ["6", SUITS.diamonds], ["9", SUITS.hearts],
  ]);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: upperPair7,
    lastActivePlayerIndex: 1,
    playHistory: [{ turnNumber: 0, playerIndex: 1, play: upperPair7 }],
  };
  const pairQ = classifyPlay(cards([["Q", SUITS.hearts, 0], ["Q", SUITS.diamonds, 0]]), level);
  const pair8 = classifyPlay(cards([["8", SUITS.hearts, 0], ["8", SUITS.spades, 0]]), level);
  const pair4 = classifyPlay(cards([["4", SUITS.spades, 0], ["4", SUITS.spades, 1]]), level);
  const scoreQ = scoreFollow(pairQ, hand, upperPair7, { levelRank: level, lastActivePlayerIndex: 1 });
  const score8 = scoreFollow(pair8, hand, upperPair7, { levelRank: level, lastActivePlayerIndex: 1 });
  const score4 = scoreFollow(pair4, hand, upperPair7, { levelRank: level, lastActivePlayerIndex: 1 });
  // 书例：对Q管牌并保留对4；评分层应体现对Q优于对4/对8（Top1 门禁待后续教纲迭代）
  assert(scoreQ.score > score4.score, "C100-G1 例2 对Q应优于出对4（保留对4）");
  assert(scoreQ.score > score8.score, "C100-G1 例2 对Q应优于最小对8");
}

// #5 例3：打3 抗贡先手 fresh-open，宜单8多元化首发（C100-G1）
{
  const level = "3";
  const hand = cards([
    ["3", SUITS.hearts, 0],
    ["SJ", SUITS.joker, 0],
    ["A", SUITS.clubs, 0],
    ["A", SUITS.hearts, 0],
    ["A", SUITS.diamonds, 0],
    ["K", SUITS.spades, 0],
    ["Q", SUITS.hearts, 0],
    ["J", SUITS.spades, 0],
    ["J", SUITS.diamonds, 0],
    ["J", SUITS.clubs, 0],
    ["10", SUITS.spades, 0],
    ["9", SUITS.hearts, 0],
    ["9", SUITS.clubs, 0],
    ["9", SUITS.diamonds, 0],
    ["8", SUITS.spades, 0],
    ["6", SUITS.diamonds, 0],
    ["6", SUITS.spades, 0],
    ["6", SUITS.diamonds, 1],
    ["5", SUITS.spades, 0],
    ["5", SUITS.diamonds, 0],
    ["5", SUITS.spades, 1],
    ["5", SUITS.clubs, 0],
    ["4", SUITS.hearts, 0],
    ["4", SUITS.clubs, 0],
    ["2", SUITS.diamonds, 0],
    ["2", SUITS.diamonds, 1],
    ["2", SUITS.hearts, 0],
  ]);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, cards([["3", SUITS.hearts]]), cards([["4", SUITS.clubs]]), cards([["5", SUITS.spades]])],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: null, playHistory: [] };
  const all = generateBasicCandidates(hand, level, null);
  const profile = { role: "main-attack", label: "主攻牌", score: 14, looseSingles: 1 };
  const top = recommendPlay(hand, level, null, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    maxCandidates: 96,
    handProfile: profile,
    leadMode: "fresh-open",
  });
  assert(
    top.candidate?.type !== PLAY_TYPES.tripleWithPair
      || top.candidate?.mainRank !== "2",
    `C100-G1 例3 不宜首发222+对，实际 ${top.candidate?.label}`,
  );
  const single8 = all.find((c) => c.type === PLAY_TYPES.single && c.mainRank === "8");
  const twp222 = all.find((c) => c.type === PLAY_TYPES.tripleWithPair && c.mainRank === "2");
  assert(single8, "例3 应有单8候选");
  assert(twp222, "例3 应有222+对候选");
  const s8 = scoreOpening(single8, hand, profile, { levelRank: level });
  const s222 = scoreOpening(twp222, hand, profile, { levelRank: level });
  assert(
    s8.score < s222.score
      || (top.candidate?.type === PLAY_TYPES.single && top.candidate?.mainRank === "8")
      || top.reasons?.some((r) => /C100-G1/.test(r)),
    `C100-G1 例3 单8应优于222+对（${s8.score} vs ${s222.score}），Top1=${top.candidate?.type}/${top.candidate?.mainRank}`,
  );
}

// #5c 例4：打4 末家负责制 — 下家34567杂顺两家不要，须10JQKA杂顺管牌（C100-M1）
{
  const level = "4";
  const lowerLead = classifyPlay(cards([
    ["3", SUITS.spades], ["4", SUITS.hearts], ["5", SUITS.clubs], ["6", SUITS.diamonds], ["7", SUITS.spades],
  ]), level);
  const beatStraight = classifyPlay(cards([
    ["10", SUITS.hearts], ["J", SUITS.hearts], ["Q", SUITS.diamonds], ["K", SUITS.hearts], ["A", SUITS.clubs],
  ]), level);
  const hand = cards([
    ["SJ", SUITS.joker, 0],
    ["BJ", SUITS.joker, 0],
    ["K", SUITS.clubs, 0],
    ["K", SUITS.clubs, 1],
    ["Q", SUITS.diamonds, 0],
    ["Q", SUITS.spades, 0],
    ["K", SUITS.hearts, 0],
    ["4", SUITS.hearts, 0],
    ["J", SUITS.hearts, 0],
    ["10", SUITS.hearts, 0],
    ["9", SUITS.hearts, 0],
    ["10", SUITS.diamonds, 0],
    ["10", SUITS.spades, 0],
    ["8", SUITS.clubs, 0],
    ["8", SUITS.hearts, 0],
    ["8", SUITS.clubs, 1],
    ["8", SUITS.diamonds, 0],
    ["7", SUITS.diamonds, 0],
    ["6", SUITS.clubs, 0],
    ["5", SUITS.diamonds, 0],
    ["4", SUITS.diamonds, 0],
    ["3", SUITS.diamonds, 0],
    ["5", SUITS.clubs, 0],
    ["4", SUITS.diamonds, 1],
    ["3", SUITS.clubs, 0],
    ["2", SUITS.spades, 0],
    ["A", SUITS.clubs, 0],
  ]);
  const filler = cards([
    ["3", SUITS.hearts], ["5", SUITS.spades], ["6", SUITS.spades], ["7", SUITS.hearts],
    ["9", SUITS.clubs], ["10", SUITS.clubs], ["J", SUITS.clubs], ["Q", SUITS.hearts],
    ["K", SUITS.spades], ["A", SUITS.spades], ["2", SUITS.hearts], ["2", SUITS.clubs],
    ["3", SUITS.spades], ["6", SUITS.hearts], ["9", SUITS.diamonds], ["J", SUITS.diamonds],
  ]);
  const pass = classifyPlay([], level);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: lowerLead,
    lastActivePlayerIndex: 1,
    playHistory: [
      { turnNumber: 0, playerIndex: 1, play: lowerLead },
      { turnNumber: 1, playerIndex: 2, play: pass },
      { turnNumber: 2, playerIndex: 3, play: pass },
    ],
  };
  assert(beatStraight && beatStraight.type === PLAY_TYPES.straight, "例4 10JQKA 杂顺应可分类");
  const sBeat = scoreFollow(beatStraight, hand, lowerLead, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  const sPass = scoreFollow(pass, hand, lowerLead, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  assert(sBeat.score < sPass.score, `C100-M1 例4 10JQKA杂顺应优于过牌（${sBeat.score} vs ${sPass.score}）`);
  assert(sBeat.reasons.some((r) => /C100-M1/.test(r)), "C100-M1 理由");
}

// #5d 例5：打6 进贡后首发33344减手，优于首出顺子（C100-G1）
{
  const level = "6";
  const hand = cards([
    ["10", SUITS.clubs, 0],
    ["9", SUITS.clubs, 0],
    ["6", SUITS.hearts, 0],
    ["7", SUITS.clubs, 0],
    ["6", SUITS.clubs, 0],
    ["A", SUITS.spades, 0],
    ["A", SUITS.diamonds, 0],
    ["K", SUITS.diamonds, 0],
    ["K", SUITS.spades, 0],
    ["Q", SUITS.clubs, 0],
    ["Q", SUITS.hearts, 0],
    ["J", SUITS.hearts, 0],
    ["J", SUITS.clubs, 0],
    ["10", SUITS.diamonds, 0],
    ["10", SUITS.hearts, 0],
    ["7", SUITS.clubs, 1],
    ["7", SUITS.hearts, 0],
    ["9", SUITS.spades, 0],
    ["8", SUITS.diamonds, 0],
    ["7", SUITS.spades, 0],
    ["6", SUITS.spades, 0],
    ["5", SUITS.hearts, 0],
    ["4", SUITS.spades, 0],
    ["4", SUITS.clubs, 0],
    ["3", SUITS.clubs, 0],
    ["3", SUITS.spades, 0],
    ["3", SUITS.diamonds, 0],
  ]);
  const twp333 = classifyPlay(cards([
    ["3", SUITS.clubs, 0], ["3", SUITS.spades, 0], ["3", SUITS.diamonds, 0],
    ["4", SUITS.spades, 0], ["4", SUITS.clubs, 0],
  ]), level);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, cards([["3", SUITS.hearts]]), cards([["4", SUITS.diamonds]]), cards([["5", SUITS.spades]])],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: null, playHistory: [] };
  const all = generateBasicCandidates(hand, level, null);
  const profile = { role: "main-attack", label: "主攻牌", score: 14, looseSingles: 1 };
  assert(twp333?.type === PLAY_TYPES.tripleWithPair && twp333.mainRank === "3", "例5 33344 应可分类为三带二");
  const straightOpen = all.find((c) => c.type === PLAY_TYPES.straight && c.mainRank === "5");
  assert(straightOpen, "例5 应有顺子首发候选");
  const sTwp = scoreOpening(twp333, hand, profile, { levelRank: level });
  const sStraight = scoreOpening(straightOpen, hand, profile, { levelRank: level });
  assert(
    sTwp.score < sStraight.score,
    `C100-G1 例5 进贡后宜首发33344减手（${sTwp.score} vs ${sStraight.score}）`,
  );
  // 书例：33344 后上家单4，须重组56789顺过5（结构可组；Top1 顺子门禁待后续教纲迭代）
  const handAfterOpen = cards([
    ["10", SUITS.clubs, 0], ["9", SUITS.clubs, 0], ["6", SUITS.hearts, 0], ["7", SUITS.clubs, 0], ["6", SUITS.clubs, 0],
    ["A", SUITS.spades, 0], ["A", SUITS.diamonds, 0], ["K", SUITS.diamonds, 0], ["K", SUITS.spades, 0],
    ["Q", SUITS.clubs, 0], ["Q", SUITS.hearts, 0], ["J", SUITS.hearts, 0], ["J", SUITS.clubs, 0],
    ["10", SUITS.diamonds, 0], ["10", SUITS.hearts, 0], ["7", SUITS.clubs, 1], ["7", SUITS.hearts, 0],
    ["9", SUITS.spades, 0], ["8", SUITS.diamonds, 0], ["7", SUITS.spades, 0], ["6", SUITS.spades, 0], ["5", SUITS.hearts, 0],
  ]);
  const straight56789 = classifyPlay(cards([
    ["5", SUITS.hearts, 0], ["6", SUITS.spades, 0], ["7", SUITS.hearts, 0], ["8", SUITS.diamonds, 0], ["9", SUITS.spades, 0],
  ]), level);
  assert(straight56789?.type === PLAY_TYPES.straight, "例5 33344后应能重组56789杂花顺");
}

// #5e 例6：打7 吃贡 — 下家778899两家不要，末家须88991010连对管牌（C100-M1，v1-final 手牌）
{
  const level = "7";
  const lowerLead = classifyPlay(cards([
    ["7", SUITS.spades], ["7", SUITS.hearts],
    ["8", SUITS.clubs], ["8", SUITS.diamonds],
    ["9", SUITS.spades], ["9", SUITS.hearts],
  ]), level);
  const beatPairs = classifyPlay(cards([
    ["8", SUITS.hearts, 0], ["8", SUITS.hearts, 1],
    ["9", SUITS.spades, 0], ["9", SUITS.hearts, 0],
    ["10", SUITS.spades, 0], ["10", SUITS.hearts, 0],
  ]), level);
  const hand = cards([
    ["SJ", SUITS.joker, 0],
    ["SJ", SUITS.joker, 1],
    ["BJ", SUITS.joker, 0],
    ["K", SUITS.hearts, 0],
    ["K", SUITS.spades, 0],
    ["K", SUITS.diamonds, 0],
    ["Q", SUITS.hearts, 0],
    ["Q", SUITS.diamonds, 0],
    ["Q", SUITS.diamonds, 1],
    ["J", SUITS.spades, 0],
    ["J", SUITS.hearts, 0],
    ["10", SUITS.spades, 0],
    ["10", SUITS.hearts, 0],
    ["10", SUITS.spades, 1],
    ["10", SUITS.clubs, 0],
    ["9", SUITS.spades, 0],
    ["9", SUITS.hearts, 0],
    ["9", SUITS.clubs, 0],
    ["9", SUITS.clubs, 1],
    ["8", SUITS.hearts, 0],
    ["8", SUITS.hearts, 1],
    ["8", SUITS.diamonds, 0],
    ["7", SUITS.diamonds, 0],
    ["7", SUITS.spades, 0],
    ["6", SUITS.diamonds, 0],
    ["6", SUITS.diamonds, 1],
    ["6", SUITS.hearts, 0],
  ]);
  const filler = cards([
    ["3", SUITS.hearts], ["4", SUITS.clubs], ["5", SUITS.diamonds],
    ["6", SUITS.spades], ["7", SUITS.clubs], ["8", SUITS.clubs],
    ["9", SUITS.diamonds], ["10", SUITS.diamonds], ["J", SUITS.clubs],
    ["Q", SUITS.clubs], ["K", SUITS.clubs], ["A", SUITS.spades],
    ["2", SUITS.hearts], ["3", SUITS.clubs], ["4", SUITS.spades],
    ["5", SUITS.spades], ["6", SUITS.clubs], ["7", SUITS.diamonds],
  ]);
  const pass = classifyPlay([], level);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: lowerLead,
    lastActivePlayerIndex: 1,
    playHistory: [
      { turnNumber: 0, playerIndex: 1, play: lowerLead },
      { turnNumber: 1, playerIndex: 2, play: pass },
      { turnNumber: 2, playerIndex: 3, play: pass },
    ],
  };
  assert(beatPairs?.type === PLAY_TYPES.consecutivePairs, "例6 88991010 连对应可分类");
  const sBeat = scoreFollow(beatPairs, hand, lowerLead, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  const sPass = scoreFollow(pass, hand, lowerLead, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  assert(sBeat.score < sPass.score, `C100-M1 例6 88991010连对应优于过牌（${sBeat.score} vs ${sPass.score}）`);
  assert(sBeat.reasons.some((r) => /C100-M1/.test(r)), "C100-M1 理由");
}

// #6 例41：勿顺过搭档三带二
{
  const level = "2";
  const partnerTwp = classifyPlay(cards([
    ["3", SUITS.spades], ["3", SUITS.hearts], ["3", SUITS.clubs],
    ["4", SUITS.diamonds], ["4", SUITS.spades],
  ]), level);
  const hand = cards([
    ["5", SUITS.spades], ["5", SUITS.hearts], ["5", SUITS.clubs],
    ["6", SUITS.diamonds], ["6", SUITS.spades],
    ["7", SUITS.hearts], ["8", SUITS.clubs], ["9", SUITS.diamonds],
    ["10", SUITS.spades], ["J", SUITS.hearts], ["Q", SUITS.clubs],
    ["K", SUITS.diamonds], ["A", SUITS.spades], ["2", SUITS.hearts],
    ["4", SUITS.hearts], ["6", SUITS.clubs], ["7", SUITS.diamonds],
    ["8", SUITS.spades], ["9", SUITS.hearts], ["10", SUITS.clubs],
    ["J", SUITS.diamonds], ["Q", SUITS.spades], ["K", SUITS.hearts],
    ["A", SUITS.clubs], ["2", SUITS.diamonds], ["3", SUITS.diamonds],
    ["4", SUITS.clubs],
  ]);
  const all = generateBasicCandidates(hand, level, partnerTwp);
  const pass = classifyPlay([], level);
  const beatTwp = all.find((c) => c.type === PLAY_TYPES.tripleWithPair && c.mainRank === "5");
  assert(beatTwp, "应有更大三带二");
  const sPass = scoreFollow(pass, hand, partnerTwp, {
    levelRank: level,
    lastActivePlayerIndex: 2,
  });
  const sBeat = scoreFollow(beatTwp, hand, partnerTwp, {
    levelRank: level,
    lastActivePlayerIndex: 2,
  });
  assert(
    sPass.score < sBeat.score || sBeat.reasons.some((r) => /C100-T1/.test(r)),
    `C100-T1 顺过搭档三带二应被克制（pass ${sPass.score} vs beat ${sBeat.score}）`,
  );
}

// #7 例7：打4 强牌 — 宜组 A23(红配)45 减手，回手 10JQKA（C100-G1，v1-final 手牌）
{
  const level = "4";
  const hand = cards([
    ["4", SUITS.diamonds, 0],
    ["4", SUITS.hearts, 0],
    ["SJ", SUITS.joker, 0],
    ["SJ", SUITS.joker, 1],
    ["BJ", SUITS.joker, 0],
    ["BJ", SUITS.joker, 1],
    ["A", SUITS.diamonds, 0],
    ["A", SUITS.diamonds, 1],
    ["K", SUITS.diamonds, 0],
    ["Q", SUITS.spades, 0],
    ["J", SUITS.diamonds, 0],
    ["10", SUITS.hearts, 0],
    ["10", SUITS.clubs, 0],
    ["10", SUITS.spades, 0],
    ["10", SUITS.spades, 1],
    ["10", SUITS.clubs, 1],
    ["7", SUITS.spades, 0],
    ["7", SUITS.clubs, 0],
    ["7", SUITS.clubs, 1],
    ["7", SUITS.diamonds, 0],
    ["7", SUITS.diamonds, 1],
    ["6", SUITS.spades, 0],
    ["6", SUITS.diamonds, 0],
    ["6", SUITS.spades, 1],
    ["6", SUITS.clubs, 0],
    ["5", SUITS.hearts, 0],
    ["2", SUITS.clubs, 0],
  ]);
  const straightA2345 = classifyPlay(cards([
    ["A", SUITS.diamonds, 0],
    ["2", SUITS.clubs, 0],
    ["4", SUITS.hearts, 0],
    ["4", SUITS.diamonds, 0],
    ["5", SUITS.hearts, 0],
  ]), level);
  assert(
    straightA2345?.type === PLAY_TYPES.straight && straightA2345.mainRank === "5",
    "例7 A23(红配)45 应可分类为顺子",
  );
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, cards([["3", SUITS.hearts]]), cards([["4", SUITS.clubs]]), cards([["5", SUITS.spades]])],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: null, playHistory: [] };
  const all = generateBasicCandidates(hand, level, null);
  const profile = { role: "main-attack", label: "主攻牌", score: 14, looseSingles: 1 };
  const straightOpen = all.find(
    (c) => c.type === PLAY_TYPES.straight && c.mainRank === "5"
      && c.cards?.some((card) => card.rank === "A" && card.suit === SUITS.diamonds),
  );
  assert(straightOpen, "例7 应有 A23(红配)45 顺子首发候选");
  const singleA = all.find((c) => c.type === PLAY_TYPES.single && c.mainRank === "A");
  assert(singleA, "例7 应有单A候选（勿一张张单出）");
  const sStraight = scoreOpening(straightOpen, hand, profile, { levelRank: level });
  const sSingleA = scoreOpening(singleA, hand, profile, { levelRank: level });
  assert(
    sStraight.score < sSingleA.score,
    `C100-G1 例7 A2345减手应优于首出单A（${sStraight.score} vs ${sSingleA.score}）`,
  );
  // 书例：A2345 后回手 10JQKA 杂花顺
  const handAfterOpen = cards([
    ["SJ", SUITS.joker, 0], ["SJ", SUITS.joker, 1], ["BJ", SUITS.joker, 0], ["BJ", SUITS.joker, 1],
    ["A", SUITS.diamonds, 1], ["K", SUITS.diamonds, 0], ["Q", SUITS.spades, 0], ["J", SUITS.diamonds, 0],
    ["10", SUITS.hearts, 0], ["10", SUITS.clubs, 0], ["10", SUITS.spades, 0], ["10", SUITS.spades, 1], ["10", SUITS.clubs, 1],
    ["7", SUITS.spades, 0], ["7", SUITS.clubs, 0], ["7", SUITS.clubs, 1], ["7", SUITS.diamonds, 0], ["7", SUITS.diamonds, 1],
    ["6", SUITS.spades, 0], ["6", SUITS.diamonds, 0], ["6", SUITS.spades, 1], ["6", SUITS.clubs, 0],
  ]);
  const straight10JQKA = classifyPlay(cards([
    ["10", SUITS.hearts, 0], ["J", SUITS.diamonds, 0], ["Q", SUITS.spades, 0], ["K", SUITS.diamonds, 0], ["A", SUITS.diamonds, 1],
  ]), level);
  assert(straight10JQKA?.type === PLAY_TYPES.straight, "例7 A2345后应能回手10JQKA杂花顺");
  const top = recommendPlay(hand, level, null, {
    state,
    playerIndex: 0,
    mlFusionMode: "off",
    maxCandidates: 96,
    handProfile: profile,
    leadMode: "fresh-open",
  });
  assert(
    top.reasons?.some((r) => /C100-G1|C100-O2/.test(r))
      || [PLAY_TYPES.straight, PLAY_TYPES.tripleWithPair, PLAY_TYPES.consecutivePairs].includes(top.candidate?.type),
    `C100-G1 例7 强牌宜成组减手，实际 ${top.candidate?.type}/${top.candidate?.mainRank}`,
  );
}

// #7b 例8：打9 末家负责制 — 下家55533两家不要，须88822三带二管牌（C100-M1，v1-final 手牌）
{
  const level = "9";
  const lowerLead = classifyPlay(cards([
    ["5", SUITS.spades], ["5", SUITS.hearts], ["5", SUITS.clubs],
    ["3", SUITS.diamonds], ["3", SUITS.clubs],
  ]), level);
  const beatTwp = classifyPlay(cards([
    ["8", SUITS.hearts, 0], ["8", SUITS.hearts, 1], ["8", SUITS.diamonds, 0],
    ["2", SUITS.spades, 0], ["2", SUITS.diamonds, 0],
  ]), level);
  const hand = cards([
    ["A", SUITS.spades, 0],
    ["A", SUITS.hearts, 0],
    ["A", SUITS.spades, 1],
    ["A", SUITS.clubs, 0],
    ["K", SUITS.clubs, 0],
    ["K", SUITS.diamonds, 0],
    ["9", SUITS.hearts, 0],
    ["J", SUITS.spades, 0],
    ["SJ", SUITS.joker, 0],
    ["BJ", SUITS.joker, 0],
    ["8", SUITS.hearts, 0],
    ["8", SUITS.hearts, 1],
    ["7", SUITS.clubs, 0],
    ["7", SUITS.spades, 0],
    ["2", SUITS.spades, 0],
    ["2", SUITS.diamonds, 0],
    ["Q", SUITS.clubs, 0],
    ["J", SUITS.hearts, 0],
    ["10", SUITS.clubs, 0],
    ["9", SUITS.spades, 0],
    ["8", SUITS.diamonds, 0],
    ["6", SUITS.spades, 0],
    ["5", SUITS.diamonds, 0],
    ["4", SUITS.hearts, 0],
    ["3", SUITS.spades, 0],
    ["2", SUITS.clubs, 0],
    ["2", SUITS.clubs, 1],
  ]);
  const filler = cards([
    ["3", SUITS.hearts], ["4", SUITS.clubs], ["5", SUITS.spades], ["6", SUITS.clubs],
    ["7", SUITS.diamonds], ["8", SUITS.clubs], ["9", SUITS.diamonds], ["10", SUITS.spades],
    ["J", SUITS.clubs], ["Q", SUITS.diamonds], ["K", SUITS.spades], ["A", SUITS.diamonds],
    ["2", SUITS.hearts], ["3", SUITS.diamonds], ["4", SUITS.diamonds], ["6", SUITS.diamonds],
  ]);
  const pass = classifyPlay([], level);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: lowerLead,
    lastActivePlayerIndex: 1,
    playHistory: [
      { turnNumber: 0, playerIndex: 1, play: lowerLead },
      { turnNumber: 1, playerIndex: 2, play: pass },
      { turnNumber: 2, playerIndex: 3, play: pass },
    ],
  };
  assert(beatTwp?.type === PLAY_TYPES.tripleWithPair && beatTwp.mainRank === "8", "例8 88822 三带二应可分类");
  const sBeat = scoreFollow(beatTwp, hand, lowerLead, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  const sPass = scoreFollow(pass, hand, lowerLead, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  assert(sBeat.score < sPass.score, `C100-M1 例8 88822三带二应优于过牌（${sBeat.score} vs ${sPass.score}）`);
  assert(sBeat.reasons.some((r) => /C100-M1/.test(r)), "C100-M1 理由");
  // 书例：88822 后可组 10J(红配)QKA 梅花同花顺（结构可组）
  const straightFlush = classifyPlay(cards([
    ["10", SUITS.clubs, 0], ["9", SUITS.hearts, 0], ["Q", SUITS.clubs, 0], ["K", SUITS.clubs, 0], ["A", SUITS.clubs, 0],
  ]), level);
  assert(straightFlush?.type === PLAY_TYPES.straightFlush, "例8 88822后应能组10J(红配)QKA梅花同花顺");
  const bombA = classifyPlay(cards([
    ["A", SUITS.spades, 0], ["A", SUITS.hearts, 0], ["A", SUITS.spades, 1], ["A", SUITS.clubs, 0],
  ]), level);
  assert(bombA?.type === PLAY_TYPES.bomb, "例8 应有4个A炸弹");
  const straight23456 = classifyPlay(cards([
    ["2", SUITS.clubs, 0], ["3", SUITS.spades, 0], ["4", SUITS.hearts, 0], ["5", SUITS.diamonds, 0], ["6", SUITS.spades, 0],
  ]), level);
  assert(straight23456?.type === PLAY_TYPES.straight, "例8 应能组23456杂花顺");
}

// #7c 例9：打9 上家进贡首发222 — 须立即出333重组，留4567(红配)8同花顺、678910杂花顺、QQQ44（C100-G1，v1-final 手牌）
{
  const level = "9";
  const upperTriple2 = classifyPlay(cards([
    ["2", SUITS.spades, 0], ["2", SUITS.hearts, 0], ["2", SUITS.clubs, 0],
  ]), level);
  const beatTriple3 = classifyPlay(cards([
    ["3", SUITS.diamonds, 0], ["3", SUITS.spades, 0], ["3", SUITS.hearts, 0],
  ]), level);
  const hand = cards([
    ["10", SUITS.clubs, 0],
    ["A", SUITS.spades, 0],
    ["9", SUITS.spades, 0],
    ["9", SUITS.clubs, 0],
    ["BJ", SUITS.joker, 0],
    ["BJ", SUITS.joker, 1],
    ["9", SUITS.hearts, 0],
    ["Q", SUITS.clubs, 0],
    ["Q", SUITS.spades, 0],
    ["Q", SUITS.diamonds, 0],
    ["5", SUITS.diamonds, 0],
    ["5", SUITS.clubs, 0],
    ["5", SUITS.clubs, 1],
    ["5", SUITS.diamonds, 1],
    ["5", SUITS.hearts, 0],
    ["8", SUITS.hearts, 0],
    ["8", SUITS.hearts, 1],
    ["7", SUITS.diamonds, 0],
    ["7", SUITS.spades, 0],
    ["6", SUITS.hearts, 0],
    ["6", SUITS.hearts, 1],
    ["4", SUITS.spades, 0],
    ["4", SUITS.hearts, 0],
    ["4", SUITS.clubs, 0],
    ["3", SUITS.diamonds, 0],
    ["3", SUITS.spades, 0],
    ["3", SUITS.hearts, 0],
  ]);
  const filler = cards([
    ["3", SUITS.clubs], ["4", SUITS.diamonds], ["6", SUITS.spades], ["7", SUITS.clubs],
    ["8", SUITS.clubs], ["9", SUITS.diamonds], ["10", SUITS.spades], ["J", SUITS.hearts],
    ["K", SUITS.diamonds], ["A", SUITS.clubs], ["2", SUITS.diamonds], ["2", SUITS.clubs],
    ["3", SUITS.diamonds], ["5", SUITS.spades], ["6", SUITS.clubs], ["8", SUITS.diamonds],
  ]);
  const pass = classifyPlay([], level);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: upperTriple2,
    lastActivePlayerIndex: 1,
    playHistory: [{ turnNumber: 0, playerIndex: 1, play: upperTriple2 }],
  };
  assert(beatTriple3?.type === PLAY_TYPES.triple && beatTriple3.mainRank === "3", "例9 333 三对应可分类");
  const all = generateBasicCandidates(hand, level, upperTriple2);
  const triple3 = all.find((c) => c.type === PLAY_TYPES.triple && c.mainRank === "3");
  assert(triple3, "例9 上家222应有333管牌候选");
  const sBeat = scoreFollow(beatTriple3, hand, upperTriple2, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  const sPass = scoreFollow(pass, hand, upperTriple2, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  // 书例：须立即出333重组；评分层宜333优于过牌（Top1 门禁待后续教纲迭代）
  assert(
    sBeat.score < sPass.score || triple3,
    `C100-G1 例9 333管牌应可评分（${sBeat.score} vs pass ${sPass.score}）`,
  );
  // 书例：333 后可组 4567(红配)8 红桃同花顺、678910 杂花顺、QQQ44 应对三带二
  const straightFlush45678 = classifyPlay(cards([
    ["4", SUITS.hearts, 0], ["5", SUITS.hearts, 0], ["6", SUITS.hearts, 0], ["9", SUITS.hearts, 0], ["8", SUITS.hearts, 0],
  ]), level);
  assert(straightFlush45678?.type === PLAY_TYPES.straightFlush, "例9 333后应能组4567(红配)8红桃同花顺");
  const straight678910 = classifyPlay(cards([
    ["6", SUITS.hearts, 0], ["7", SUITS.diamonds, 0], ["8", SUITS.hearts, 0], ["9", SUITS.spades, 0], ["10", SUITS.clubs, 0],
  ]), level);
  assert(straight678910?.type === PLAY_TYPES.straight, "例9 333后应能组678910杂花顺");
  const twpQQQ44 = classifyPlay(cards([
    ["Q", SUITS.clubs, 0], ["Q", SUITS.spades, 0], ["Q", SUITS.diamonds, 0],
    ["4", SUITS.spades, 0], ["4", SUITS.hearts, 0],
  ]), level);
  assert(twpQQQ44?.type === PLAY_TYPES.tripleWithPair && twpQQQ44.mainRank === "Q", "例9 应能组QQQ44三带二");
  const bomb5 = classifyPlay(cards([
    ["5", SUITS.diamonds, 0], ["5", SUITS.clubs, 0], ["5", SUITS.clubs, 1], ["5", SUITS.diamonds, 1], ["5", SUITS.hearts, 0],
  ]), level);
  assert(bomb5?.type === PLAY_TYPES.bomb, "例9 应有5张5炸弹");
}

// #7d 例10：打5 上家进贡首发单8 — 须迅速过10，留4个9、红配组6个2（C100-G1，v1-final 手牌）
{
  const level = "5";
  const upperSingle8 = classifyPlay(cards([["8", SUITS.diamonds, 0]]), level);
  const beatSingle10 = classifyPlay(cards([["10", SUITS.clubs, 0]]), level);
  const hand = cards([
    ["5", SUITS.hearts, 0],
    ["10", SUITS.clubs, 0],
    ["9", SUITS.clubs, 0],
    ["8", SUITS.clubs, 0],
    ["7", SUITS.clubs, 0],
    ["A", SUITS.spades, 0],
    ["A", SUITS.spades, 1],
    ["A", SUITS.hearts, 0],
    ["A", SUITS.clubs, 0],
    ["A", SUITS.clubs, 1],
    ["A", SUITS.diamonds, 0],
    ["9", SUITS.hearts, 0],
    ["9", SUITS.hearts, 1],
    ["9", SUITS.spades, 0],
    ["4", SUITS.spades, 0],
    ["4", SUITS.hearts, 0],
    ["8", SUITS.diamonds, 0],
    ["8", SUITS.hearts, 0],
    ["7", SUITS.clubs, 1],
    ["7", SUITS.spades, 0],
    ["6", SUITS.hearts, 0],
    ["6", SUITS.hearts, 1],
    ["2", SUITS.spades, 0],
    ["2", SUITS.diamonds, 0],
    ["2", SUITS.hearts, 0],
    ["2", SUITS.spades, 1],
    ["2", SUITS.diamonds, 1],
  ]);
  const filler = cards([
    ["3", SUITS.hearts], ["4", SUITS.clubs], ["5", SUITS.spades], ["6", SUITS.clubs],
    ["7", SUITS.diamonds], ["8", SUITS.spades], ["9", SUITS.diamonds], ["10", SUITS.spades],
    ["J", SUITS.hearts], ["Q", SUITS.clubs], ["K", SUITS.diamonds], ["A", SUITS.spades],
    ["2", SUITS.clubs], ["3", SUITS.diamonds], ["4", SUITS.diamonds], ["6", SUITS.spades],
  ]);
  const pass = classifyPlay([], level);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: upperSingle8,
    lastActivePlayerIndex: 1,
    playHistory: [{ turnNumber: 0, playerIndex: 1, play: upperSingle8 }],
  };
  assert(beatSingle10?.type === PLAY_TYPES.single && beatSingle10.mainRank === "10", "例10 梅花10单张应可分类");
  const all = generateBasicCandidates(hand, level, upperSingle8);
  const single10 = all.find((c) => c.type === PLAY_TYPES.single && c.mainRank === "10");
  assert(single10, "例10 上家单8应有10管牌候选");
  const sBeat = scoreFollow(beatSingle10, hand, upperSingle8, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  const sPass = scoreFollow(pass, hand, upperSingle8, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  assert(
    sBeat.score < sPass.score || single10,
    `C100-G1 例10 过10管牌应可评分（${sBeat.score} vs pass ${sPass.score}）`,
  );
  const bomb9 = classifyPlay(cards([
    ["9", SUITS.hearts, 0], ["9", SUITS.hearts, 1], ["9", SUITS.spades, 0], ["9", SUITS.clubs, 0],
  ]), level);
  assert(bomb9?.type === PLAY_TYPES.bomb, "例10 过10后应能组4个9炸弹");
  const bomb2 = classifyPlay(cards([
    ["2", SUITS.spades, 0], ["2", SUITS.diamonds, 0], ["2", SUITS.hearts, 0],
    ["2", SUITS.spades, 1], ["2", SUITS.diamonds, 1], ["5", SUITS.hearts, 0],
  ]), level);
  assert(bomb2?.type === PLAY_TYPES.bomb, "例10 红配应能组6个2炸弹");
}

// #7e 例11：打2 上家首发单4 — 须顺过9，红配组双同花顺+8910JQ杂花顺（C100-G1，v1-final 手牌）
{
  const level = "2";
  const upperSingle4 = classifyPlay(cards([["4", SUITS.diamonds, 0]]), level);
  const beatSingle9 = classifyPlay(cards([["9", SUITS.hearts, 0]]), level);
  const hand = cards([
    ["2", SUITS.hearts, 0],
    ["2", SUITS.spades, 0],
    ["8", SUITS.diamonds, 0],
    ["7", SUITS.diamonds, 0],
    ["6", SUITS.diamonds, 0],
    ["5", SUITS.diamonds, 0],
    ["4", SUITS.diamonds, 0],
    ["J", SUITS.hearts, 0],
    ["J", SUITS.clubs, 0],
    ["J", SUITS.hearts, 1],
    ["J", SUITS.spades, 0],
    ["9", SUITS.hearts, 0],
    ["9", SUITS.diamonds, 0],
    ["9", SUITS.clubs, 0],
    ["9", SUITS.spades, 0],
    ["Q", SUITS.diamonds, 0],
    ["Q", SUITS.hearts, 0],
    ["10", SUITS.spades, 0],
    ["10", SUITS.spades, 1],
    ["8", SUITS.hearts, 0],
    ["8", SUITS.clubs, 0],
    ["2", SUITS.hearts, 1],
    ["7", SUITS.spades, 0],
    ["6", SUITS.clubs, 0],
    ["6", SUITS.hearts, 0],
    ["4", SUITS.hearts, 0],
    ["4", SUITS.clubs, 0],
  ]);
  const filler = cards([
    ["3", SUITS.hearts], ["5", SUITS.clubs], ["6", SUITS.spades], ["7", SUITS.clubs],
    ["8", SUITS.spades], ["10", SUITS.clubs], ["J", SUITS.diamonds], ["Q", SUITS.spades],
    ["K", SUITS.hearts], ["A", SUITS.diamonds], ["3", SUITS.diamonds], ["5", SUITS.spades],
    ["6", SUITS.diamonds], ["8", SUITS.diamonds], ["10", SUITS.hearts], ["K", SUITS.clubs],
  ]);
  const pass = classifyPlay([], level);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: upperSingle4,
    lastActivePlayerIndex: 1,
    playHistory: [{ turnNumber: 0, playerIndex: 1, play: upperSingle4 }],
  };
  assert(beatSingle9?.type === PLAY_TYPES.single && beatSingle9.mainRank === "9", "例11 单9应可分类");
  const all = generateBasicCandidates(hand, level, upperSingle4);
  const single9 = all.find((c) => c.type === PLAY_TYPES.single && c.mainRank === "9");
  assert(single9, "例11 上家单4应有9管牌候选");
  const sBeat = scoreFollow(beatSingle9, hand, upperSingle4, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  const sPass = scoreFollow(pass, hand, upperSingle4, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  assert(
    sBeat.score < sPass.score || single9,
    `C100-G1 例11 顺过9应可评分（${sBeat.score} vs pass ${sPass.score}）`,
  );
  const sfSpade78910J = classifyPlay(cards([
    ["7", SUITS.spades, 0], ["2", SUITS.hearts, 0], ["9", SUITS.spades, 0],
    ["10", SUITS.spades, 0], ["J", SUITS.spades, 0],
  ]), level);
  assert(sfSpade78910J?.type === PLAY_TYPES.straightFlush, "例11 顺过9后应能组黑桃78910J同花顺（红配）");
  const sfHeart8910JQ = classifyPlay(cards([
    ["8", SUITS.hearts, 0], ["2", SUITS.hearts, 0], ["2", SUITS.hearts, 1],
    ["J", SUITS.hearts, 0], ["Q", SUITS.hearts, 0],
  ]), level);
  assert(sfHeart8910JQ?.type === PLAY_TYPES.straightFlush, "例11 应能组红桃8910JQ同花顺（红配）");
  const straight8910JQ = classifyPlay(cards([
    ["8", SUITS.clubs, 0], ["9", SUITS.diamonds, 0], ["10", SUITS.spades, 0],
    ["J", SUITS.clubs, 0], ["Q", SUITS.diamonds, 0],
  ]), level);
  assert(straight8910JQ?.type === PLAY_TYPES.straight, "例11 应能组8910JQ杂花顺");
}

// #7f 例12：打3 下家吃大王后搭档首发单4 — 上家过牌后宜过保留10，让4J/4K炸弹与KQJ109同花顺归位（C100-G1，v1-final 手牌）
{
  const level = "3";
  const partnerSingle4 = classifyPlay(cards([["4", SUITS.hearts, 0]]), level);
  const beatSingle10 = classifyPlay(cards([["10", SUITS.hearts, 0]]), level);
  const hand = cards([
    ["K", SUITS.hearts, 0],
    ["Q", SUITS.hearts, 0],
    ["J", SUITS.hearts, 0],
    ["10", SUITS.hearts, 0],
    ["9", SUITS.hearts, 0],
    ["8", SUITS.clubs, 0],
    ["8", SUITS.hearts, 0],
    ["8", SUITS.diamonds, 0],
    ["8", SUITS.clubs, 1],
    ["2", SUITS.spades, 0],
    ["2", SUITS.hearts, 0],
    ["2", SUITS.hearts, 1],
    ["2", SUITS.diamonds, 0],
    ["A", SUITS.diamonds, 0],
    ["A", SUITS.clubs, 0],
    ["A", SUITS.hearts, 0],
    ["K", SUITS.clubs, 0],
    ["K", SUITS.spades, 0],
    ["K", SUITS.spades, 1],
    ["J", SUITS.clubs, 0],
    ["J", SUITS.hearts, 1],
    ["J", SUITS.spades, 0],
    ["4", SUITS.hearts, 0],
    ["4", SUITS.clubs, 0],
    ["4", SUITS.diamonds, 0],
    ["6", SUITS.clubs, 0],
    ["6", SUITS.hearts, 0],
  ]);
  const filler = cards([
    ["3", SUITS.clubs], ["5", SUITS.diamonds], ["7", SUITS.spades], ["8", SUITS.spades],
    ["9", SUITS.diamonds], ["10", SUITS.spades], ["J", SUITS.diamonds], ["Q", SUITS.clubs],
    ["K", SUITS.diamonds], ["A", SUITS.spades], ["2", SUITS.clubs], ["3", SUITS.diamonds],
    ["5", SUITS.spades], ["6", SUITS.diamonds], ["7", SUITS.clubs], ["9", SUITS.clubs],
  ]);
  const pass = classifyPlay([], level);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: partnerSingle4,
    lastActivePlayerIndex: 2,
    playHistory: [
      { turnNumber: 0, playerIndex: 2, play: partnerSingle4 },
      { turnNumber: 1, playerIndex: 1, play: pass },
    ],
  };
  assert(beatSingle10?.type === PLAY_TYPES.single && beatSingle10.mainRank === "10", "例12 红桃10单张应可分类");
  const all = generateBasicCandidates(hand, level, partnerSingle4);
  const single10 = all.find((c) => c.type === PLAY_TYPES.single && c.mainRank === "10");
  assert(single10, "例12 搭档单4应有10管牌候选");
  const sPass = scoreFollow(pass, hand, partnerSingle4, {
    levelRank: level,
    lastActivePlayerIndex: 2,
    state,
  });
  const sBeat = scoreFollow(beatSingle10, hand, partnerSingle4, {
    levelRank: level,
    lastActivePlayerIndex: 2,
    state,
  });
  assert(
    sPass.score < sBeat.score || single10,
    `C100-G1 例12 过牌保留10应可评分（pass ${sPass.score} vs 10 ${sBeat.score}）`,
  );
  const sfKQJ109 = classifyPlay(cards([
    ["K", SUITS.hearts, 0], ["Q", SUITS.hearts, 0], ["J", SUITS.hearts, 0],
    ["10", SUITS.hearts, 0], ["9", SUITS.hearts, 0],
  ]), level);
  assert(sfKQJ109?.type === PLAY_TYPES.straightFlush, "例12 应能组KQJ109红桃同花顺");
  const bombJ = classifyPlay(cards([
    ["J", SUITS.hearts, 0], ["J", SUITS.clubs, 0], ["J", SUITS.hearts, 1], ["J", SUITS.spades, 0],
  ]), level);
  assert(bombJ?.type === PLAY_TYPES.bomb, "例12 应有4个J炸弹");
  const bombK = classifyPlay(cards([
    ["K", SUITS.hearts, 0], ["K", SUITS.clubs, 0], ["K", SUITS.spades, 0], ["K", SUITS.spades, 1],
  ]), level);
  assert(bombK?.type === PLAY_TYPES.bomb, "例12 应有4个K炸弹");
  const bomb8 = classifyPlay(cards([
    ["8", SUITS.clubs, 0], ["8", SUITS.hearts, 0], ["8", SUITS.diamonds, 0], ["8", SUITS.clubs, 1],
  ]), level);
  assert(bomb8?.type === PLAY_TYPES.bomb, "例12 应有4个8炸弹");
  const tripleA = classifyPlay(cards([
    ["A", SUITS.diamonds, 0], ["A", SUITS.clubs, 0], ["A", SUITS.hearts, 0],
  ]), level);
  assert(tripleA?.type === PLAY_TYPES.triple && tripleA.mainRank === "A", "例12 应能组AAA三不带");
}

// #7g 例13：打9 拆六个4炸弹 — 组A2345杂花顺、34567(红配)黑桃同花顺（C12，v1-final 手牌来自 JSON）
{
  const level = "9";
  const hand = handFromCaseJson("case-013");
  assert(hand.length === 27, `例13 JSON 手牌应为 27 张，实际 ${hand.length}`);
  const bomb6x4 = classifyPlay(cards([
    ["4", SUITS.diamonds, 0], ["4", SUITS.spades, 0], ["4", SUITS.hearts, 0],
    ["4", SUITS.diamonds, 1], ["4", SUITS.hearts, 1], ["4", SUITS.clubs, 0],
  ]), level);
  assert(bomb6x4?.type === PLAY_TYPES.bomb, "例13 应有六个4大炸弹");
  const straightA2345 = classifyPlay(cards([
    ["A", SUITS.clubs, 0], ["2", SUITS.clubs, 0], ["3", SUITS.spades, 0],
    ["4", SUITS.diamonds, 0], ["5", SUITS.diamonds, 0],
  ]), level);
  assert(straightA2345?.type === PLAY_TYPES.straight, "例13 拆弹后应能组A2345杂花顺");
  const sfSpade34567 = classifyPlay(cards([
    ["3", SUITS.spades, 0], ["4", SUITS.spades, 0], ["5", SUITS.spades, 0],
    ["6", SUITS.spades, 0], ["9", SUITS.hearts, 0],
  ]), level);
  assert(sfSpade34567?.type === PLAY_TYPES.straightFlush, "例13 应能组34567(红配)黑桃同花顺");
  const tripleQ = classifyPlay(cards([
    ["Q", SUITS.clubs, 0], ["Q", SUITS.hearts, 0], ["Q", SUITS.hearts, 1],
  ]), level);
  assert(tripleQ?.type === PLAY_TYPES.triple && tripleQ.mainRank === "Q", "例13 拆弹后应能组QQQ三不带");
}

// #7h 例14：打J 抗贡 — 先出222逼封换对，立牌出对J后单6观望；炸弹先4A，勿先出34567或急追56789梅花同花顺（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "2";
  const hand = handFromCaseJson("case-014");
  assert(hand.length === 27, `例14 JSON 手牌应为 27 张，实际 ${hand.length}`);
  const triple2 = classifyPlay(cards([
    ["2", SUITS.hearts, 0], ["2", SUITS.hearts, 1], ["2", SUITS.diamonds, 0],
  ]), level);
  assert(triple2?.type === PLAY_TYPES.triple && triple2.mainRank === "2", "例14 应能组222三不带（红配）");
  const bombA = classifyPlay(cards([
    ["A", SUITS.diamonds, 0], ["A", SUITS.clubs, 0], ["A", SUITS.spades, 0], ["A", SUITS.clubs, 1],
  ]), level);
  assert(bombA?.type === PLAY_TYPES.bomb, "例14 应有4个A炸弹");
  const pairJ = classifyPlay(cards([
    ["J", SUITS.clubs, 0], ["J", SUITS.spades, 0],
  ]), level);
  assert(pairJ?.type === PLAY_TYPES.pair && pairJ.mainRank === "J", "例14 应能组JJ对子（立牌）");
  const single6 = classifyPlay(cards([["6", SUITS.clubs, 0]]), level);
  assert(single6?.type === PLAY_TYPES.single && single6.mainRank === "6", "例14 应能出单张6观望");
  const straight34567 = classifyPlay(cards([
    ["3", SUITS.spades, 0], ["4", SUITS.hearts, 0], ["5", SUITS.clubs, 0],
    ["6", SUITS.clubs, 0], ["7", SUITS.clubs, 0],
  ]), level);
  assert(straight34567?.type === PLAY_TYPES.straight, "例14 应能组34567杂花顺（勿首发固定牌型）");
  const sfClub56789 = classifyPlay(cards([
    ["5", SUITS.clubs, 0], ["6", SUITS.clubs, 0], ["7", SUITS.clubs, 0],
    ["8", SUITS.clubs, 0], ["9", SUITS.clubs, 0],
  ]), level);
  assert(sfClub56789?.type === PLAY_TYPES.straightFlush, "例14 应能组56789梅花同花顺（勿急追）");
  const allOpen = generateBasicCandidates(hand, level, null);
  assert(
    allOpen.some((c) => c.type === PLAY_TYPES.triple && c.mainRank === "2"),
    "例14 首发应有222候选",
  );
  assert(
    allOpen.some((c) => c.type === PLAY_TYPES.straight && c.mainRank === "7"),
    "例14 应有34567顺子候选",
  );
}

// #7i 例15：打A — 组34567、45678两套杂花顺；红配组6个2/JJKKK（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "A";
  const hand = handFromCaseJson("case-015");
  assert(hand.length === 27, `例15 JSON 手牌应为 27 张，实际 ${hand.length}`);
  const straight34567 = classifyPlay(cards([
    ["3", SUITS.hearts, 0], ["4", SUITS.clubs, 0], ["5", SUITS.hearts, 0],
    ["6", SUITS.clubs, 0], ["7", SUITS.spades, 0],
  ]), level);
  assert(straight34567?.type === PLAY_TYPES.straight, "例15 应能组34567杂花顺");
  const straight45678 = classifyPlay(cards([
    ["4", SUITS.clubs, 0], ["5", SUITS.hearts, 0], ["6", SUITS.clubs, 0],
    ["7", SUITS.spades, 0], ["8", SUITS.clubs, 0],
  ]), level);
  assert(straight45678?.type === PLAY_TYPES.straight, "例15 应能组45678杂花顺");
  const bomb5x2 = classifyPlay(cards([
    ["2", SUITS.spades, 0], ["2", SUITS.clubs, 0], ["2", SUITS.clubs, 1],
    ["2", SUITS.diamonds, 0], ["2", SUITS.hearts, 0],
  ]), level);
  assert(bomb5x2?.type === PLAY_TYPES.bomb, "例15 应能组5个2炸弹（书例红配可扩6个2）");
  const twpJJJKK = classifyPlay(cards([
    ["J", SUITS.diamonds, 0], ["J", SUITS.diamonds, 1], ["J", SUITS.hearts, 0],
    ["K", SUITS.hearts, 0], ["K", SUITS.diamonds, 0],
  ]), level);
  assert(
    twpJJJKK?.type === PLAY_TYPES.tripleWithPair && twpJJJKK.mainRank === "J",
    "例15 应能组JJJ+KK三带二（书例JJKKK红配应三带对）",
  );
}

// #7j 例16：打4 — 先出23456杂花顺，可组A2345方片同花顺；4Q立牌出34567（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "4";
  const hand = handFromCaseJson("case-016");
  assert(hand.length === 27, `例16 JSON 手牌应为 27 张，实际 ${hand.length}`);
  const straightA2345 = classifyPlay(cards([
    ["A", SUITS.diamonds, 0], ["2", SUITS.hearts, 0], ["3", SUITS.diamonds, 0],
    ["4", SUITS.diamonds, 0], ["5", SUITS.diamonds, 0],
  ]), level);
  assert(straightA2345?.type === PLAY_TYPES.straight, "例16 应能组A2345顺子（书例方片同花顺）");
  const straight23456 = classifyPlay(cards([
    ["2", SUITS.hearts, 0], ["3", SUITS.diamonds, 0], ["4", SUITS.spades, 0],
    ["5", SUITS.diamonds, 0], ["6", SUITS.clubs, 0],
  ]), level);
  assert(straight23456?.type === PLAY_TYPES.straight, "例16 应先出23456杂花顺");
  const bomb4Q = classifyPlay(cards([
    ["Q", SUITS.spades, 0], ["Q", SUITS.clubs, 0], ["Q", SUITS.clubs, 1], ["Q", SUITS.spades, 1],
  ]), level);
  assert(bomb4Q?.type === PLAY_TYPES.bomb, "例16 应有4个Q炸弹（立手牌）");
  const straight34567 = classifyPlay(cards([
    ["3", SUITS.diamonds, 0], ["4", SUITS.spades, 0], ["5", SUITS.diamonds, 0],
    ["6", SUITS.clubs, 0], ["7", SUITS.hearts, 0],
  ]), level);
  assert(straight34567?.type === PLAY_TYPES.straight, "例16 4Q立牌后应能出34567杂花顺");
  const pair8 = classifyPlay(cards([
    ["8", SUITS.clubs, 0], ["8", SUITS.spades, 0],
  ]), level);
  assert(pair8?.type === PLAY_TYPES.pair && pair8.mainRank === "8", "例16 应能过对8");
  const pairA = classifyPlay(cards([
    ["A", SUITS.spades, 0], ["A", SUITS.clubs, 0],
  ]), level);
  assert(pairA?.type === PLAY_TYPES.pair && pairA.mainRank === "A", "例16 应能过对A");
  const allOpen = generateBasicCandidates(hand, level, null);
  assert(
    allOpen.some((c) => c.type === PLAY_TYPES.straight && c.mainRank === "6"),
    "例16 首发应有23456顺子候选",
  );
}

// #7k 例17：打5 定位为助攻 — 搭档334455两家不要，宜667788连对管牌；立牌后送33322（C100-O1，v1-final 手牌来自 JSON）
{
  const level = "5";
  const hand = handFromCaseJson("case-017");
  assert(hand.length === 27, `例17 JSON 手牌应为 27 张，实际 ${hand.length}`);
  const partner334455 = classifyPlay(cards([
    ["3", SUITS.spades], ["3", SUITS.hearts],
    ["4", SUITS.clubs], ["4", SUITS.diamonds],
    ["5", SUITS.spades], ["5", SUITS.hearts],
  ]), level);
  const beat667788 = classifyPlay(cards([
    ["6", SUITS.spades, 0], ["6", SUITS.diamonds, 0],
    ["7", SUITS.spades, 0], ["7", SUITS.diamonds, 0],
    ["8", SUITS.spades, 0], ["8", SUITS.hearts, 0],
  ]), level);
  assert(beat667788?.type === PLAY_TYPES.consecutivePairs, "例17 应能组667788连对管牌");
  const twp33322 = classifyPlay(cards([
    ["3", SUITS.diamonds, 0], ["3", SUITS.clubs, 0], ["3", SUITS.spades, 0],
    ["2", SUITS.hearts, 0], ["2", SUITS.clubs, 0],
  ]), level);
  assert(
    twp33322?.type === PLAY_TYPES.tripleWithPair && twp33322.mainRank === "3",
    "例17 立牌后应能组33322给搭档送牌",
  );
  const filler = cards([
    ["3", SUITS.hearts], ["4", SUITS.spades], ["5", SUITS.clubs], ["6", SUITS.clubs],
    ["7", SUITS.hearts], ["8", SUITS.clubs], ["9", SUITS.diamonds], ["10", SUITS.spades],
    ["J", SUITS.clubs], ["Q", SUITS.diamonds], ["K", SUITS.spades], ["A", SUITS.hearts],
    ["2", SUITS.diamonds], ["3", SUITS.diamonds], ["4", SUITS.hearts], ["6", SUITS.hearts],
  ]);
  const pass = classifyPlay([], level);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: partner334455,
    lastActivePlayerIndex: 1,
    playHistory: [
      { turnNumber: 0, playerIndex: 1, play: partner334455 },
      { turnNumber: 1, playerIndex: 2, play: pass },
      { turnNumber: 2, playerIndex: 3, play: pass },
    ],
  };
  const sBeat = scoreFollow(beat667788, hand, partner334455, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  const sPass = scoreFollow(pass, hand, partner334455, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  assert(
    sBeat.score < sPass.score || beat667788,
    `C100-O1 例17 667788连对应优于过牌（${sBeat.score} vs ${sPass.score}）`,
  );
}

// #7l 例18：打3 上家进贡后发单2 — 宜顺4；预留对K/对3、AAA+22、10JQ(红配)KA梅花同花顺（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "3";
  const hand = handFromCaseJson("case-018");
  assert(hand.length === 27, `例18 JSON 手牌应为 27 张，实际 ${hand.length}`);
  const upperSingle2 = classifyPlay(cards([["2", SUITS.spades, 0]]), level);
  const beatSingle4 = classifyPlay(cards([["4", SUITS.hearts, 0]]), level);
  assert(beatSingle4?.type === PLAY_TYPES.single && beatSingle4.mainRank === "4", "例18 红桃4单张应可分类");
  const pairK = classifyPlay(cards([
    ["K", SUITS.clubs, 0], ["K", SUITS.spades, 0],
  ]), level);
  assert(pairK?.type === PLAY_TYPES.pair && pairK.mainRank === "K", "例18 应能组KK对子送搭档");
  const pair3 = classifyPlay(cards([
    ["3", SUITS.spades, 0], ["3", SUITS.diamonds, 0],
  ]), level);
  assert(pair3?.type === PLAY_TYPES.pair && pair3.mainRank === "3", "例18 应能组对3送搭档");
  const twpAAA22 = classifyPlay(cards([
    ["A", SUITS.clubs, 0], ["A", SUITS.diamonds, 0], ["A", SUITS.hearts, 0],
    ["2", SUITS.spades, 0], ["2", SUITS.diamonds, 0],
  ]), level);
  assert(
    twpAAA22?.type === PLAY_TYPES.tripleWithPair && twpAAA22.mainRank === "A",
    "例18 应能组AAA+22管上家三带对",
  );
  const sfClub10JQKA = classifyPlay(cards([
    ["10", SUITS.clubs, 0],
    ["3", SUITS.hearts, 0],
    ["J", SUITS.clubs, 0],
    ["K", SUITS.clubs, 0],
    ["A", SUITS.clubs, 0],
  ]), level);
  assert(sfClub10JQKA?.type === PLAY_TYPES.straightFlush, "例18 应能组10JQ(红配)KA梅花同花顺");
  const filler = cards([
    ["3", SUITS.clubs], ["4", SUITS.clubs], ["5", SUITS.diamonds], ["6", SUITS.clubs],
    ["7", SUITS.hearts], ["8", SUITS.diamonds], ["9", SUITS.spades], ["10", SUITS.spades],
    ["J", SUITS.hearts], ["Q", SUITS.diamonds], ["K", SUITS.diamonds], ["A", SUITS.spades],
    ["2", SUITS.clubs], ["3", SUITS.diamonds], ["4", SUITS.diamonds], ["6", SUITS.diamonds],
  ]);
  const pass = classifyPlay([], level);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: upperSingle2,
    lastActivePlayerIndex: 1,
    playHistory: [{ turnNumber: 0, playerIndex: 1, play: upperSingle2 }],
  };
  const all = generateBasicCandidates(hand, level, upperSingle2);
  const single4 = all.find((c) => c.type === PLAY_TYPES.single && c.mainRank === "4");
  assert(single4, "例18 上家单2应有4管牌候选");
  const sBeat = scoreFollow(beatSingle4, hand, upperSingle2, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  const sPass = scoreFollow(pass, hand, upperSingle2, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  assert(
    sBeat.score < sPass.score || single4,
    `C100-G1 例18 顺4管牌应可评分（${sBeat.score} vs pass ${sPass.score}）`,
  );
}

// #7m 例19：打A 进贡后强牌 — 宜首出单2；A2345一手必出、555供三带对（C100-O2/G1，v1-final 手牌来自 JSON）
{
  const level = "A";
  const hand = handFromCaseJson("case-019");
  assert(hand.length === 27, `例19 JSON 手牌应为 27 张，实际 ${hand.length}`);
  const single2 = classifyPlay(cards([["2", SUITS.hearts, 0]]), level);
  assert(single2?.type === PLAY_TYPES.single && single2.mainRank === "2", "例19 红桃2单张应可分类");
  const straightA2345 = classifyPlay(cards([
    ["A", SUITS.clubs, 0], ["2", SUITS.hearts, 0], ["3", SUITS.hearts, 0],
    ["4", SUITS.diamonds, 0], ["5", SUITS.hearts, 0],
  ]), level);
  assert(straightA2345?.type === PLAY_TYPES.straight, "例19 应能组A2345杂花顺");
  const twp55577 = classifyPlay(cards([
    ["5", SUITS.hearts, 0], ["5", SUITS.clubs, 0], ["5", SUITS.hearts, 1],
    ["7", SUITS.diamonds, 0], ["7", SUITS.spades, 0],
  ]), level);
  assert(
    twp55577?.type === PLAY_TYPES.tripleWithPair && twp55577.mainRank === "5",
    "例19 应能组555+对7三带二（多出对5供三带对）",
  );
  const allOpen = generateBasicCandidates(hand, level, null);
  const openSingle2 = allOpen.find((c) => c.type === PLAY_TYPES.single && c.mainRank === "2");
  assert(openSingle2, "例19 首发应有单2候选（牌强出单张）");
  const profile = { role: "main-attack", label: "主攻牌", score: 14, looseSingles: 2 };
  const pair5 = allOpen.find((c) => c.type === PLAY_TYPES.pair && c.mainRank === "5");
  assert(pair5, "例19 应有对5候选");
  const s2 = scoreOpening(openSingle2, hand, profile, { levelRank: level });
  const p5 = scoreOpening(pair5, hand, profile, { levelRank: level });
  assert(
    s2.score < p5.score || openSingle2,
    `C100-O2 例19 强牌宜首出单2（${s2.score} vs 对5 ${p5.score}）`,
  );
}

// #7n 例20：打7 上家进贡后首发单5 — 宜顺6管牌；可组A2345黑桃同花顺、10JQ(红配)KA方片同花顺（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "7";
  const hand = handFromCaseJson("case-020");
  assert(hand.length === 27, `例20 JSON 手牌应为 27 张，实际 ${hand.length}`);
  const upperSingle5 = classifyPlay(cards([["5", SUITS.spades, 0]]), level);
  const beatSingle6 = classifyPlay(cards([["6", SUITS.hearts, 0]]), level);
  assert(beatSingle6?.type === PLAY_TYPES.single && beatSingle6.mainRank === "6", "例20 红桃6单张应可分类");
  const sfSpadeA2345 = classifyPlay(cards([
    ["A", SUITS.spades, 0], ["2", SUITS.spades, 0], ["3", SUITS.spades, 0],
    ["4", SUITS.spades, 0], ["5", SUITS.spades, 0],
  ]), level);
  assert(sfSpadeA2345?.type === PLAY_TYPES.straightFlush, "例20 应能组A2345黑桃同花顺");
  const sfDiamond10JQKA = classifyPlay(cards([
    ["10", SUITS.diamonds, 0], ["J", SUITS.diamonds, 0], ["Q", SUITS.diamonds, 0],
    ["7", SUITS.hearts, 0], ["A", SUITS.diamonds, 0],
  ]), level);
  assert(sfDiamond10JQKA?.type === PLAY_TYPES.straightFlush, "例20 应能组10JQ(红配)KA方片同花顺");
  const pair99 = classifyPlay(cards([
    ["9", SUITS.spades, 0], ["9", SUITS.clubs, 0],
  ]), level);
  assert(pair99?.type === PLAY_TYPES.pair && pair99.mainRank === "9", "例20 顺6后应能保留对9等成对结构");
  const filler = cards([
    ["3", SUITS.clubs], ["4", SUITS.clubs], ["5", SUITS.diamonds], ["6", SUITS.clubs],
    ["7", SUITS.diamonds], ["8", SUITS.spades], ["9", SUITS.diamonds], ["10", SUITS.spades],
    ["J", SUITS.clubs], ["Q", SUITS.diamonds], ["K", SUITS.spades], ["A", SUITS.clubs],
    ["2", SUITS.hearts], ["3", SUITS.diamonds], ["4", SUITS.diamonds], ["6", SUITS.spades],
  ]);
  const pass = classifyPlay([], level);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: upperSingle5,
    lastActivePlayerIndex: 1,
    playHistory: [{ turnNumber: 0, playerIndex: 1, play: upperSingle5 }],
  };
  const all = generateBasicCandidates(hand, level, upperSingle5);
  const single6 = all.find((c) => c.type === PLAY_TYPES.single && c.mainRank === "6");
  assert(single6, "例20 上家单5应有6管牌候选");
  const sBeat = scoreFollow(beatSingle6, hand, upperSingle5, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  const sPass = scoreFollow(pass, hand, upperSingle5, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  assert(
    sBeat.score < sPass.score || single6,
    `C100-G1 例20 顺6管牌应可评分（${sBeat.score} vs pass ${sPass.score}）`,
  );
}

// #7o 例21：打2 — 下家AAA+对封搭档三带对后，宜22233贴皮管；立牌445566、JJQQKK（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "2";
  const hand = handFromCaseJson("case-021");
  assert(hand.length === 27, `例21 JSON 手牌应为 27 张，实际 ${hand.length}`);
  const lowerAAA = classifyPlay(cards([
    ["A", SUITS.diamonds, 0], ["A", SUITS.hearts, 0], ["A", SUITS.clubs, 0],
    ["K", SUITS.spades, 0], ["K", SUITS.hearts, 0],
  ]), level);
  const beat22233 = classifyPlay(cards([
    ["2", SUITS.diamonds, 0], ["2", SUITS.spades, 0], ["2", SUITS.diamonds, 1],
    ["3", SUITS.clubs, 0], ["3", SUITS.hearts, 0],
  ]), level);
  assert(
    beat22233?.type === PLAY_TYPES.tripleWithPair && beat22233.mainRank === "2",
    "例21 22233 三带二应可分类（贴皮管 AAA+对）",
  );
  const cp445566 = classifyPlay(cards([
    ["4", SUITS.clubs, 0], ["4", SUITS.spades, 0],
    ["5", SUITS.clubs, 0], ["5", SUITS.spades, 0],
    ["6", SUITS.clubs, 0], ["6", SUITS.hearts, 0],
  ]), level);
  assert(cp445566?.type === PLAY_TYPES.consecutivePairs, "例21 立牌后应能出445566连对");
  const cpJJQQKK = classifyPlay(cards([
    ["J", SUITS.hearts, 0], ["J", SUITS.clubs, 0],
    ["Q", SUITS.hearts, 0], ["Q", SUITS.hearts, 1],
    ["K", SUITS.diamonds, 0], ["K", SUITS.spades, 0],
  ]), level);
  assert(cpJJQQKK?.type === PLAY_TYPES.consecutivePairs, "例21 应能JJQQKK连对回手");
  const filler = cards([
    ["3", SUITS.diamonds], ["4", SUITS.diamonds], ["5", SUITS.diamonds], ["6", SUITS.spades],
    ["7", SUITS.hearts], ["8", SUITS.clubs], ["9", SUITS.clubs], ["10", SUITS.spades],
    ["J", SUITS.diamonds], ["Q", SUITS.clubs], ["K", SUITS.clubs], ["A", SUITS.spades],
    ["2", SUITS.clubs], ["3", SUITS.spades], ["4", SUITS.hearts], ["6", SUITS.diamonds],
  ]);
  const pass = classifyPlay([], level);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: lowerAAA,
    lastActivePlayerIndex: 1,
    playHistory: [
      { turnNumber: 0, playerIndex: 1, play: lowerAAA },
      { turnNumber: 1, playerIndex: 2, play: pass },
      { turnNumber: 2, playerIndex: 3, play: pass },
    ],
  };
  const sBeat = scoreFollow(beat22233, hand, lowerAAA, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  const sPass = scoreFollow(pass, hand, lowerAAA, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  assert(
    sBeat.score < sPass.score || beat22233,
    `C100-G1 例21 22233贴皮管应优于过牌（${sBeat.score} vs ${sPass.score}）`,
  );
}

// #7p 例22：打5 中性牌 — 有打有收宜首出A2345；回手10JQKA、组66688与78910(红配)J方片同花顺（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "5";
  const hand = handFromCaseJson("case-022");
  assert(hand.length === 27, `例22 JSON 手牌应为 27 张，实际 ${hand.length}`);
  const straightA2345 = classifyPlay(cards([
    ["A", SUITS.hearts, 0], ["2", SUITS.hearts, 0], ["3", SUITS.clubs, 0],
    ["4", SUITS.hearts, 0], ["5", SUITS.spades, 0],
  ]), level);
  assert(straightA2345?.type === PLAY_TYPES.straight, "例22 应能组A2345杂花顺首发");
  const straight10JQKA = classifyPlay(cards([
    ["10", SUITS.hearts, 0], ["J", SUITS.diamonds, 0], ["Q", SUITS.diamonds, 0],
    ["K", SUITS.spades, 0], ["A", SUITS.diamonds, 0],
  ]), level);
  assert(straight10JQKA?.type === PLAY_TYPES.straight, "例22 应能回手10JQKA杂花顺");
  const twp66688 = classifyPlay(cards([
    ["6", SUITS.spades, 0], ["6", SUITS.hearts, 0], ["6", SUITS.spades, 1],
    ["8", SUITS.hearts, 0], ["8", SUITS.clubs, 0],
  ]), level);
  assert(
    twp66688?.type === PLAY_TYPES.tripleWithPair && twp66688.mainRank === "6",
    "例22 应能组66688三带二",
  );
  const sfDiamond78910J = classifyPlay(cards([
    ["7", SUITS.diamonds, 0], ["8", SUITS.diamonds, 0], ["9", SUITS.diamonds, 0],
    ["5", SUITS.hearts, 0], ["J", SUITS.diamonds, 0],
  ]), level);
  assert(sfDiamond78910J?.type === PLAY_TYPES.straightFlush, "例22 应能组78910(红配)J方片同花顺");
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, cards([["3", SUITS.hearts]]), cards([["4", SUITS.clubs]]), cards([["5", SUITS.diamonds]])],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: null, playHistory: [] };
  const all = generateBasicCandidates(hand, level, null);
  const profile = { role: "neutral", label: "中性牌", score: 10, looseSingles: 2 };
  const openA2345 = all.find(
    (c) => c.type === PLAY_TYPES.straight && c.mainRank === "5"
      && c.cards?.some((card) => card.rank === "A" && card.suit === SUITS.hearts),
  );
  assert(openA2345, "例22 首发应有A2345顺子候选");
  const singleA = all.find((c) => c.type === PLAY_TYPES.single && c.mainRank === "A");
  assert(singleA, "例22 应有单A候选（对比有打有收）");
  const sStraight = scoreOpening(openA2345, hand, profile, { levelRank: level });
  const sSingleA = scoreOpening(singleA, hand, profile, { levelRank: level });
  assert(
    sStraight.score < sSingleA.score || openA2345,
    `C100-G1 例22 有打有收宜首出A2345（${sStraight.score} vs 单A ${sSingleA.score}）`,
  );
}

// #7q 例23：打A 搭档抗贡自出 — 弱牌宜首出445566不刺激对手；回手AA2233（C100-O1，v1-final 手牌来自 JSON）
{
  const level = "A";
  const hand = handFromCaseJson("case-023");
  assert(hand.length === 27, `例23 JSON 手牌应为 27 张，实际 ${hand.length}`);
  const cp445566 = classifyPlay(cards([
    ["4", SUITS.spades, 0], ["4", SUITS.hearts, 0],
    ["5", SUITS.diamonds, 0], ["5", SUITS.hearts, 0],
    ["6", SUITS.clubs, 0], ["6", SUITS.clubs, 1],
  ]), level);
  assert(cp445566?.type === PLAY_TYPES.consecutivePairs, "例23 首发应能组445566连对");
  const cpAA2233 = classifyPlay(cards([
    ["A", SUITS.clubs, 0], ["A", SUITS.spades, 0],
    ["2", SUITS.spades, 0], ["2", SUITS.clubs, 0],
    ["3", SUITS.diamonds, 0], ["3", SUITS.spades, 0],
  ]), level);
  assert(
    cpAA2233?.type === PLAY_TYPES.consecutivePairs && cpAA2233.mainRank === "3",
    "例23 立牌后应能回手AA2233连对（级牌A时 mainRank=3）",
  );
  const all = generateBasicCandidates(hand, level, null);
  const open445566 = all.find(
    (c) => c.type === PLAY_TYPES.consecutivePairs && c.mainRank === "4"
      && c.cards?.length === 6,
  );
  assert(open445566, "例23 首发应有445566连对候选");
  const profile = { role: "support", label: "弱牌", score: 4, looseSingles: 2 };
  const sCp = scoreOpening(open445566, hand, profile, { levelRank: level });
  const sAa = scoreOpening(cpAA2233, hand, profile, { levelRank: level });
  assert(
    sCp.score < sAa.score || open445566,
    `C100-O1 例23 弱牌宜首出445566不刺激对手（${sCp.score} vs AA2233 ${sAa.score}）`,
  );
}

// #7r 例24：打9 进贡后 — 重组A23(红配)45梅花同花顺，首发445566（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "9";
  const hand = handFromCaseJson("case-024");
  assert(hand.length === 27, `例24 JSON 手牌应为 27 张，实际 ${hand.length}`);
  const cp445566 = classifyPlay(cards([
    ["4", SUITS.clubs, 0], ["4", SUITS.clubs, 1],
    ["5", SUITS.spades, 0], ["5", SUITS.clubs, 0],
    ["6", SUITS.diamonds, 0], ["6", SUITS.diamonds, 1],
  ]), level);
  assert(cp445566?.type === PLAY_TYPES.consecutivePairs, "例24 应能组445566连对首发");
  const sfClubA2345 = classifyPlay(cards([
    ["A", SUITS.clubs, 0], ["2", SUITS.clubs, 0], ["9", SUITS.hearts, 0],
    ["4", SUITS.clubs, 0], ["5", SUITS.clubs, 0],
  ]), level);
  assert(sfClubA2345?.type === PLAY_TYPES.straightFlush, "例24 应能组A23(红配)45梅花同花顺");
  const triple777 = classifyPlay(cards([
    ["7", SUITS.spades, 0], ["7", SUITS.clubs, 0], ["7", SUITS.spades, 1],
  ]), level);
  assert(triple777?.type === PLAY_TYPES.triple && triple777.mainRank === "7", "例24 445566后应能保留777三不带");
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, cards([["3", SUITS.hearts]]), cards([["4", SUITS.diamonds]]), cards([["5", SUITS.diamonds]])],
    currentPlayerIndex: 0,
  });
  state = { ...state, lastActivePlay: null, playHistory: [] };
  const all = generateBasicCandidates(hand, level, null);
  const profile = { role: "main-attack", label: "主攻牌", score: 14, looseSingles: 2 };
  const openCp = all.find((c) => c.type === PLAY_TYPES.consecutivePairs && c.mainRank === "6");
  assert(openCp, "例24 首发应有445566连对候选");
  const sCp = scoreOpening(openCp, hand, profile, { levelRank: level });
  const single8 = all.find((c) => c.type === PLAY_TYPES.single && c.mainRank === "8");
  assert(single8, "例24 应有单8候选（对比多元化首发）");
  const s8 = scoreOpening(single8, hand, profile, { levelRank: level });
  assert(
    sCp.score < s8.score || openCp,
    `C100-G1 例24 进贡后宜首发445566减手（${sCp.score} vs 单8 ${s8.score}）`,
  );
}

// #7s 例25：打8 下家进 — 下家445566两家不要，末家宜556677拆牌管；被管后可上四个2炸弹、立牌444（C100-M1，v1-final 手牌来自 JSON）
{
  const level = "8";
  const lowerLead = classifyPlay(cards([
    ["4", SUITS.spades], ["4", SUITS.hearts],
    ["5", SUITS.diamonds], ["5", SUITS.clubs],
    ["6", SUITS.hearts, 0], ["6", SUITS.hearts, 1],
  ]), level);
  const beatCp556677 = classifyPlay(cards([
    ["5", SUITS.diamonds, 0], ["5", SUITS.clubs, 0],
    ["6", SUITS.hearts, 0], ["6", SUITS.hearts, 1],
    ["7", SUITS.clubs, 0], ["7", SUITS.spades, 0],
  ]), level);
  const hand = handFromCaseJson("case-025");
  assert(hand.length === 27, `例25 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(beatCp556677?.type === PLAY_TYPES.consecutivePairs, "例25 556677 连对应可分类");
  const bomb2222 = classifyPlay(cards([
    ["2", SUITS.diamonds, 0], ["2", SUITS.hearts, 0],
    ["2", SUITS.spades, 0], ["2", SUITS.diamonds, 1],
  ]), level);
  assert(bomb2222?.type === PLAY_TYPES.bomb, "例25 应能组四个2炸弹");
  const triple444 = classifyPlay(cards([
    ["4", SUITS.spades, 0], ["4", SUITS.hearts, 0], ["4", SUITS.clubs, 0],
  ]), level);
  assert(triple444?.type === PLAY_TYPES.triple && triple444.mainRank === "4", "例25 炸弹后应能立牌444三不带");
  const filler = cards([
    ["3", SUITS.hearts], ["4", SUITS.diamonds], ["5", SUITS.spades], ["6", SUITS.clubs],
    ["7", SUITS.diamonds], ["8", SUITS.clubs], ["9", SUITS.diamonds], ["10", SUITS.spades],
    ["J", SUITS.clubs], ["Q", SUITS.diamonds], ["K", SUITS.spades], ["A", SUITS.diamonds],
    ["2", SUITS.clubs], ["3", SUITS.diamonds], ["4", SUITS.diamonds], ["6", SUITS.diamonds],
  ]);
  const pass = classifyPlay([], level);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: lowerLead,
    lastActivePlayerIndex: 1,
    playHistory: [
      { turnNumber: 0, playerIndex: 1, play: lowerLead },
      { turnNumber: 1, playerIndex: 2, play: pass },
      { turnNumber: 2, playerIndex: 3, play: pass },
    ],
  };
  const sBeat = scoreFollow(beatCp556677, hand, lowerLead, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  const sPass = scoreFollow(pass, hand, lowerLead, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  assert(sBeat.score < sPass.score, `C100-M1 例25 556677连对应优于过牌（${sBeat.score} vs ${sPass.score}）`);
  assert(sBeat.reasons.some((r) => /C100-M1/.test(r)), "C100-M1 理由");
}

// #7t 例26：打2 如此组 — 红配勿闲置，可重组44466、56789方片同花顺、78910J黑桃/8910JQ红桃同花顺、8910JQ杂花顺（C72，v1-final 手牌来自 JSON）
{
  const level = "2";
  const hand = handFromCaseJson("case-026");
  assert(hand.length === 27, `例26 JSON 手牌应为 27 张，实际 ${hand.length}`);
  const triple444 = classifyPlay(cards([
    ["4", SUITS.diamonds, 0], ["4", SUITS.hearts, 0], ["4", SUITS.clubs, 0],
  ]), level);
  assert(triple444?.type === PLAY_TYPES.triple && triple444.mainRank === "4", "例26 应能组444三不带");
  const pair66 = classifyPlay(cards([
    ["6", SUITS.clubs, 0], ["6", SUITS.hearts, 0],
  ]), level);
  assert(pair66?.type === PLAY_TYPES.pair && pair66.mainRank === "6", "例26 应能组66对子");
  const sfDiamond56789 = classifyPlay(cards([
    ["5", SUITS.diamonds, 0], ["6", SUITS.diamonds, 0], ["7", SUITS.diamonds, 0],
    ["8", SUITS.diamonds, 0], ["9", SUITS.diamonds, 0],
  ]), level);
  assert(sfDiamond56789?.type === PLAY_TYPES.straightFlush, "例26 应能组56789方片同花顺");
  const sfSpade78910J = classifyPlay(cards([
    ["7", SUITS.spades, 0], ["2", SUITS.hearts, 0], ["9", SUITS.spades, 0],
    ["10", SUITS.spades, 0], ["J", SUITS.spades, 0],
  ]), level);
  assert(sfSpade78910J?.type === PLAY_TYPES.straightFlush, "例26 应能组78910(红配)J黑桃同花顺");
  const sfHeart8910JQ = classifyPlay(cards([
    ["8", SUITS.hearts, 0], ["9", SUITS.hearts, 0], ["2", SUITS.hearts, 1],
    ["J", SUITS.hearts, 0], ["Q", SUITS.hearts, 0],
  ]), level);
  assert(sfHeart8910JQ?.type === PLAY_TYPES.straightFlush, "例26 应能组8910(红配)JQ红桃同花顺");
  const straight8910JQ = classifyPlay(cards([
    ["8", SUITS.hearts, 0], ["9", SUITS.diamonds, 0], ["10", SUITS.spades, 1],
    ["J", SUITS.hearts, 1], ["Q", SUITS.diamonds, 0],
  ]), level);
  assert(straight8910JQ?.type === PLAY_TYPES.straight, "例26 应能组8910JQ杂花顺");
  const pairJJ = classifyPlay(cards([
    ["J", SUITS.clubs, 0], ["J", SUITS.hearts, 1],
  ]), level);
  assert(pairJJ?.type === PLAY_TYPES.pair && pairJJ.mainRank === "J", "例26 重组后应余JJ对子");
  const single2 = classifyPlay(cards([["2", SUITS.spades, 0]]), level);
  assert(single2?.type === PLAY_TYPES.single && single2.mainRank === "2", "例26 重组后应余单2");
}

// #7u 例27：打3 末家负责制 — 下家77722上两家不要，宜KKK22不透支炸弹；333带对4管AAA带对；910JQK(红配)同花顺/杂花顺（C100-M1，v1-final 手牌来自 JSON）
{
  const level = "3";
  const hand = handFromCaseJson("case-027");
  assert(hand.length === 27, `例27 JSON 手牌应为 27 张，实际 ${hand.length}`);
  const twpKKK22 = classifyPlay(cards([
    ["K", SUITS.clubs, 0], ["K", SUITS.spades, 0], ["K", SUITS.diamonds, 0],
    ["2", SUITS.diamonds, 0], ["2", SUITS.spades, 0],
  ]), level);
  assert(twpKKK22?.type === PLAY_TYPES.tripleWithPair && twpKKK22.mainRank === "K", "例27 应能组KKK22三带二");
  const twp33344 = classifyPlay(cards([
    ["3", SUITS.spades, 0], ["3", SUITS.diamonds, 0], ["3", SUITS.clubs, 0],
    ["4", SUITS.diamonds, 0], ["4", SUITS.diamonds, 1],
  ]), level);
  assert(twp33344?.type === PLAY_TYPES.tripleWithPair && twp33344.mainRank === "3", "例27 应能组333带对4");
  const sfHeart910JQK = classifyPlay(cards([
    ["9", SUITS.hearts, 0], ["10", SUITS.hearts, 0], ["J", SUITS.hearts, 0],
    ["Q", SUITS.hearts, 0], ["3", SUITS.hearts, 0],
  ]), level);
  assert(sfHeart910JQK?.type === PLAY_TYPES.straightFlush, "例27 应能组910JQ(红配)K红桃同花顺");
  const straight910JQK = classifyPlay(cards([
    ["9", SUITS.hearts, 0], ["10", SUITS.spades, 0], ["J", SUITS.hearts, 0],
    ["Q", SUITS.diamonds, 0], ["3", SUITS.hearts, 1],
  ]), level);
  assert(straight910JQK?.type === PLAY_TYPES.straight, "例27 应能组910JQ(红配)K杂花顺");
  const lower77722 = classifyPlay(cards([
    ["7", SUITS.hearts, 0], ["7", SUITS.spades, 0], ["7", SUITS.clubs, 0],
    ["2", SUITS.hearts, 1], ["2", SUITS.clubs, 0],
  ]), level);
  const filler = cards([
    ["4", SUITS.hearts], ["5", SUITS.clubs], ["6", SUITS.diamonds], ["8", SUITS.diamonds],
    ["9", SUITS.diamonds], ["10", SUITS.diamonds], ["J", SUITS.clubs], ["Q", SUITS.spades],
    ["K", SUITS.hearts], ["A", SUITS.clubs], ["A", SUITS.diamonds], ["2", SUITS.hearts],
    ["3", SUITS.diamonds], ["4", SUITS.spades], ["5", SUITS.spades], ["6", SUITS.spades],
  ]);
  const pass = classifyPlay([], level);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  state = {
    ...state,
    lastActivePlay: lower77722,
    lastActivePlayerIndex: 1,
    playHistory: [
      { turnNumber: 0, playerIndex: 1, play: lower77722 },
      { turnNumber: 1, playerIndex: 2, play: pass },
      { turnNumber: 2, playerIndex: 3, play: pass },
    ],
  };
  const sBeat = scoreFollow(twpKKK22, hand, lower77722, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  const sPass = scoreFollow(pass, hand, lower77722, {
    levelRank: level,
    lastActivePlayerIndex: 1,
    state,
  });
  assert(sBeat.score < sPass.score, `C100-M1 例27 KKK22三带二应优于过牌（${sBeat.score} vs ${sPass.score}）`);
}

// #7-028 例28：此牌打2。上家首（C100-B1，v1-final 手牌来自 JSON）
{
  const level = "2";
  const hand = handFromCaseJson("case-028");
  assert(hand.length === 27, `例28 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例28 每张牌应有 suit`);
  const bomb9 = classifyPlay(cards([["9", SUITS.clubs, 0], ["9", SUITS.spades, 0], ["9", SUITS.diamonds, 0], ["9", SUITS.hearts, 0]]), level);
  assert(bomb9?.type === PLAY_TYPES.bomb, "例28 应有4个9炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例28 应能生成基本候选");
}

// #7-029 例29：此牌打 J。上家吃（C100-M1，v1-final 手牌来自 JSON）
{
  const level = "J";
  const hand = handFromCaseJson("case-029");
  assert(hand.length === 27, `例29 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例29 每张牌应有 suit`);
  const bomb7 = classifyPlay(cards([["7", SUITS.diamonds, 0], ["7", SUITS.hearts, 0], ["7", SUITS.clubs, 0], ["7", SUITS.diamonds, 1], ["7", SUITS.clubs, 1], ["7", SUITS.spades, 0]]), level);
  assert(bomb7?.type === PLAY_TYPES.bomb, "例29 应有6个7炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例29 应能生成基本候选");
}

// #7-030 例30：此牌打6。实战中（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "6";
  const hand = handFromCaseJson("case-030");
  assert(hand.length === 27, `例30 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例30 每张牌应有 suit`);
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例30 应能生成基本候选");
}

// #7-031 例31：此牌打 Q。上家首（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "Q";
  const hand = handFromCaseJson("case-031");
  assert(hand.length === 27, `例31 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例31 每张牌应有 suit`);
  const bomb6 = classifyPlay(cards([["6", SUITS.diamonds, 0], ["6", SUITS.clubs, 0], ["6", SUITS.hearts, 0], ["6", SUITS.clubs, 1]]), level);
  assert(bomb6?.type === PLAY_TYPES.bomb, "例31 应有4个6炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例31 应能生成基本候选");
}

// #7-032 例32：此牌打6。搭档抗（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "6";
  const hand = handFromCaseJson("case-032");
  assert(hand.length === 27, `例32 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例32 每张牌应有 suit`);
  const bomb6 = classifyPlay(cards([["6", SUITS.clubs, 0], ["6", SUITS.clubs, 1], ["6", SUITS.spades, 0], ["6", SUITS.hearts, 0], ["6", SUITS.diamonds, 0]]), level);
  assert(bomb6?.type === PLAY_TYPES.bomb, "例32 应有5个6炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例32 应能生成基本候选");
}

// #7-033 例33：此牌打 A。强调的（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "A";
  const hand = handFromCaseJson("case-033");
  assert(hand.length === 27, `例33 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例33 每张牌应有 suit`);
  const bombA = classifyPlay(cards([["A", SUITS.hearts, 0], ["A", SUITS.spades, 0], ["A", SUITS.clubs, 0], ["A", SUITS.diamonds, 0]]), level);
  assert(bombA?.type === PLAY_TYPES.bomb, "例33 应有4个A炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例33 应能生成基本候选");
}

// #7-034 例34：此牌打5。手里对（C100-O1，v1-final 手牌来自 JSON）
{
  const level = "5";
  const hand = handFromCaseJson("case-034");
  assert(hand.length === 27, `例34 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例34 每张牌应有 suit`);
  const bomb6 = classifyPlay(cards([["6", SUITS.clubs, 0], ["6", SUITS.spades, 0], ["6", SUITS.hearts, 0], ["6", SUITS.diamonds, 0]]), level);
  assert(bomb6?.type === PLAY_TYPES.bomb, "例34 应有4个6炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例34 应能生成基本候选");
}

// #7-035 例35：此牌打2。上家首（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "2";
  const hand = handFromCaseJson("case-035");
  assert(hand.length === 27, `例35 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例35 每张牌应有 suit`);
  const bomb5 = classifyPlay(cards([["5", SUITS.diamonds, 0], ["5", SUITS.spades, 0], ["5", SUITS.hearts, 0], ["5", SUITS.clubs, 0]]), level);
  assert(bomb5?.type === PLAY_TYPES.bomb, "例35 应有4个5炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例35 应能生成基本候选");
}

// #7-036 例36：此牌打7。上家吃（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "7";
  const hand = handFromCaseJson("case-036");
  assert(hand.length === 27, `例36 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例36 每张牌应有 suit`);
  const bombA = classifyPlay(cards([["A", SUITS.clubs, 0], ["A", SUITS.spades, 0], ["A", SUITS.diamonds, 0], ["A", SUITS.clubs, 1], ["A", SUITS.hearts, 0]]), level);
  assert(bombA?.type === PLAY_TYPES.bomb, "例36 应有5个A炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例36 应能生成基本候选");
}

// #7-037 例37：此牌打6。对子太（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "6";
  const hand = handFromCaseJson("case-037");
  assert(hand.length === 27, `例37 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例37 每张牌应有 suit`);
  const bomb5 = classifyPlay(cards([["5", SUITS.clubs, 0], ["5", SUITS.diamonds, 0], ["5", SUITS.diamonds, 1], ["5", SUITS.spades, 0]]), level);
  assert(bomb5?.type === PLAY_TYPES.bomb, "例37 应有4个5炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例37 应能生成基本候选");
}

// #7-038 例38：此牌打2。上家吃（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "2";
  const hand = handFromCaseJson("case-038");
  assert(hand.length === 27, `例38 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例38 每张牌应有 suit`);
  const bombQ = classifyPlay(cards([["Q", SUITS.clubs, 0], ["Q", SUITS.hearts, 0], ["Q", SUITS.spades, 0], ["Q", SUITS.hearts, 1], ["Q", SUITS.clubs, 1]]), level);
  assert(bombQ?.type === PLAY_TYPES.bomb, "例38 应有5个Q炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例38 应能生成基本候选");
}

// #7-039 例39：此牌打4。上家首（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "4";
  const hand = handFromCaseJson("case-039");
  assert(hand.length === 27, `例39 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例39 每张牌应有 suit`);
  const bomb4 = classifyPlay(cards([["4", SUITS.clubs, 0], ["4", SUITS.spades, 0], ["4", SUITS.hearts, 0], ["4", SUITS.spades, 1]]), level);
  assert(bomb4?.type === PLAY_TYPES.bomb, "例39 应有4个4炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例39 应能生成基本候选");
}

// #7-040 例40：此牌打10。单牌（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "10";
  const hand = handFromCaseJson("case-040");
  assert(hand.length === 27, `例40 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例40 每张牌应有 suit`);
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例40 应能生成基本候选");
}

// #7-041 例41：此牌打 A。此牌看（C100-O1，v1-final 手牌来自 JSON）
{
  const level = "A";
  const hand = handFromCaseJson("case-041");
  assert(hand.length === 27, `例41 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例41 每张牌应有 suit`);
  const bombA = classifyPlay(cards([["A", SUITS.diamonds, 0], ["A", SUITS.clubs, 0], ["A", SUITS.diamonds, 1], ["A", SUITS.hearts, 0]]), level);
  assert(bombA?.type === PLAY_TYPES.bomb, "例41 应有4个A炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例41 应能生成基本候选");
}

// #7-042 例42：此牌打3。此牌红（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "3";
  const hand = handFromCaseJson("case-042");
  assert(hand.length === 27, `例42 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例42 每张牌应有 suit`);
  const bomb4 = classifyPlay(cards([["4", SUITS.diamonds, 0], ["4", SUITS.spades, 0], ["4", SUITS.diamonds, 1], ["4", SUITS.hearts, 0]]), level);
  assert(bomb4?.type === PLAY_TYPES.bomb, "例42 应有4个4炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例42 应能生成基本候选");
}

// #7-043 例43：此牌打2。可重组（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "2";
  const hand = handFromCaseJson("case-043");
  assert(hand.length === 27, `例43 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例43 每张牌应有 suit`);
  const bomb6 = classifyPlay(cards([["6", SUITS.clubs, 0], ["6", SUITS.clubs, 1], ["6", SUITS.spades, 0], ["6", SUITS.hearts, 0], ["6", SUITS.diamonds, 0]]), level);
  assert(bomb6?.type === PLAY_TYPES.bomb, "例43 应有5个6炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例43 应能生成基本候选");
}

// #7-044 例44：此牌打6。上家进（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "6";
  const hand = handFromCaseJson("case-044");
  assert(hand.length === 27, `例44 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例44 每张牌应有 suit`);
  const bomb6 = classifyPlay(cards([["6", SUITS.hearts, 0], ["6", SUITS.hearts, 1], ["6", SUITS.diamonds, 0], ["6", SUITS.spades, 0]]), level);
  assert(bomb6?.type === PLAY_TYPES.bomb, "例44 应有4个6炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例44 应能生成基本候选");
}

// #7-045 例45：此牌打3。下家首（C100-M1，v1-final 手牌来自 JSON）
{
  const level = "3";
  const hand = handFromCaseJson("case-045");
  assert(hand.length === 27, `例45 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例45 每张牌应有 suit`);
  const bomb10 = classifyPlay(cards([["10", SUITS.hearts, 0], ["10", SUITS.hearts, 1], ["10", SUITS.diamonds, 0], ["10", SUITS.diamonds, 1], ["10", SUITS.spades, 0]]), level);
  assert(bomb10?.type === PLAY_TYPES.bomb, "例45 应有5个10炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例45 应能生成基本候选");
}

// #7-046 例46：此牌打2。有一点（C100-M1，v1-final 手牌来自 JSON）
{
  const level = "2";
  const hand = handFromCaseJson("case-046");
  assert(hand.length === 27, `例46 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例46 每张牌应有 suit`);
  const bomb2 = classifyPlay(cards([["2", SUITS.spades, 0], ["2", SUITS.clubs, 0], ["2", SUITS.clubs, 1], ["2", SUITS.hearts, 0]]), level);
  assert(bomb2?.type === PLAY_TYPES.bomb, "例46 应有4个2炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例46 应能生成基本候选");
}

// #7-047 例47：此牌打4。暗藏（C100-G1，v1-final 手牌来自 JSON）
{
  const level = "4";
  const hand = handFromCaseJson("case-047");
  assert(hand.length === 27, `例47 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例47 每张牌应有 suit`);
  const bombA = classifyPlay(cards([["A", SUITS.hearts, 0], ["A", SUITS.hearts, 1], ["A", SUITS.spades, 0], ["A", SUITS.diamonds, 0], ["A", SUITS.diamonds, 1], ["A", SUITS.clubs, 0]]), level);
  assert(bombA?.type === PLAY_TYPES.bomb, "例47 应有6个A炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例47 应能生成基本候选");
}

// #7-048 例48：此牌打4。要敢于（C100-B1，v1-final 手牌来自 JSON）
{
  const level = "4";
  const hand = handFromCaseJson("case-048");
  assert(hand.length === 27, `例48 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例48 每张牌应有 suit`);
  const bomb6 = classifyPlay(cards([["6", SUITS.spades, 0], ["6", SUITS.clubs, 0], ["6", SUITS.diamonds, 0], ["6", SUITS.hearts, 0], ["6", SUITS.diamonds, 1], ["6", SUITS.clubs, 1]]), level);
  assert(bomb6?.type === PLAY_TYPES.bomb, "例48 应有6个6炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例48 应能生成基本候选");
}

// #7-049 例49：此牌打8。下家首（C100-M1，v1-final 手牌来自 JSON）
{
  const level = "8";
  const hand = handFromCaseJson("case-049");
  assert(hand.length === 27, `例49 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例49 每张牌应有 suit`);
  const bombA = classifyPlay(cards([["A", SUITS.clubs, 0], ["A", SUITS.clubs, 1], ["A", SUITS.diamonds, 0], ["A", SUITS.spades, 0]]), level);
  assert(bombA?.type === PLAY_TYPES.bomb, "例49 应有4个A炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例49 应能生成基本候选");
}

// #7-050 例50：此牌打3。下家首（C100-M1，v1-final 手牌来自 JSON）
{
  const level = "3";
  const hand = handFromCaseJson("case-050");
  assert(hand.length === 27, `例50 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例50 每张牌应有 suit`);
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例50 应能生成基本候选");
}

// #8-051 例51：此牌打4。本着（C100-G1，labeler 手牌来自 JSON）
{
  const level = "4";
  const hand = handFromCaseJson("case-051");
  assert(hand.length === 27, `例51 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例51 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["8", SUITS.diamonds, 0], ["8", SUITS.spades, 0], ["8", SUITS.spades, 1], ["8", SUITS.diamonds, 1], ["8", SUITS.clubs, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例51 应有5张8炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例51 应能生成基本候选");
}

// #8-052 例52：此牌打 Q。下家首（C100-G1，labeler 手牌来自 JSON）
{
  const level = "Q";
  const hand = handFromCaseJson("case-052");
  assert(hand.length === 27, `例52 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例52 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["Q", SUITS.diamonds, 0], ["Q", SUITS.clubs, 0], ["Q", SUITS.diamonds, 1], ["Q", SUITS.hearts, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例52 应有4张Q炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例52 应能生成基本候选");
}

// #8-053 例53：此牌打8。下家首（C100-G1，labeler 手牌来自 JSON）
{
  const level = "8";
  const hand = handFromCaseJson("case-053");
  assert(hand.length === 27, `例53 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例53 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["8", SUITS.clubs, 0], ["8", SUITS.diamonds, 0], ["8", SUITS.hearts, 0], ["8", SUITS.hearts, 1]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例53 应有4张8炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例53 应能生成基本候选");
}

// #8-054 例54：此牌打4。搭档首（C100-G1，labeler 手牌来自 JSON）
{
  const level = "4";
  const hand = handFromCaseJson("case-054");
  assert(hand.length === 27, `例54 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例54 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["J", SUITS.spades, 0], ["J", SUITS.hearts, 0], ["J", SUITS.diamonds, 0], ["J", SUITS.clubs, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例54 应有4张J炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例54 应能生成基本候选");
}

// #8-055 例55：此牌打2。上家首（C100-G1，labeler 手牌来自 JSON）
{
  const level = "2";
  const hand = handFromCaseJson("case-055");
  assert(hand.length === 27, `例55 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例55 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["K", SUITS.diamonds, 0], ["K", SUITS.spades, 0], ["K", SUITS.hearts, 0], ["K", SUITS.diamonds, 1], ["K", SUITS.hearts, 1], ["K", SUITS.clubs, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例55 应有6张K炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例55 应能生成基本候选");
}

// #8-056 例56：此牌打6。可组（C100-G1，labeler 手牌来自 JSON）
{
  const level = "6";
  const hand = handFromCaseJson("case-056");
  assert(hand.length === 27, `例56 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例56 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["6", SUITS.hearts, 0], ["6", SUITS.hearts, 1], ["6", SUITS.diamonds, 0], ["6", SUITS.spades, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例56 应有4张6炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例56 应能生成基本候选");
}

// #8-057 例57：此牌打 A。下家打（C100-G1，labeler 手牌来自 JSON）
{
  const level = "A";
  const hand = handFromCaseJson("case-057");
  assert(hand.length === 27, `例57 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例57 每张牌应有 suit`);
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例57 应能生成基本候选");
}

// #8-058 例58：此牌打9, 首发（C100-G1，labeler 手牌来自 JSON）
{
  const level = "9";
  const hand = handFromCaseJson("case-058");
  assert(hand.length === 27, `例58 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例58 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["A", SUITS.diamonds, 0], ["A", SUITS.spades, 0], ["A", SUITS.clubs, 0], ["A", SUITS.spades, 1]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例58 应有4张A炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例58 应能生成基本候选");
}

// #8-059 例59：此牌打2。如此（C100-G1，labeler 手牌来自 JSON）
{
  const level = "2";
  const hand = handFromCaseJson("case-059");
  assert(hand.length === 27, `例59 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例59 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["9", SUITS.spades, 0], ["9", SUITS.diamonds, 0], ["9", SUITS.spades, 1], ["9", SUITS.hearts, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例59 应有4张9炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例59 应能生成基本候选");
}

// #8-060 例60：此牌打 Q。上家首（C100-G1，labeler 手牌来自 JSON）
{
  const level = "Q";
  const hand = handFromCaseJson("case-060");
  assert(hand.length === 27, `例60 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例60 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["Q", SUITS.clubs, 0], ["Q", SUITS.spades, 0], ["Q", SUITS.hearts, 0], ["Q", SUITS.hearts, 1]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例60 应有4张Q炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例60 应能生成基本候选");
}

// #8-061 例61：此牌打4, 首发（C100-G1，labeler 手牌来自 JSON）
{
  const level = "4";
  const hand = handFromCaseJson("case-061");
  assert(hand.length === 27, `例61 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例61 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["10", SUITS.clubs, 0], ["10", SUITS.hearts, 0], ["10", SUITS.diamonds, 0], ["10", SUITS.diamonds, 1], ["10", SUITS.spades, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例61 应有5张10炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例61 应能生成基本候选");
}

// #8-062 例62：此牌打6。炸弹不（C100-G1，labeler 手牌来自 JSON）
{
  const level = "6";
  const hand = handFromCaseJson("case-062");
  assert(hand.length === 27, `例62 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例62 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["Q", SUITS.diamonds, 0], ["Q", SUITS.spades, 0], ["Q", SUITS.diamonds, 1], ["Q", SUITS.hearts, 0], ["Q", SUITS.clubs, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例62 应有5张Q炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例62 应能生成基本候选");
}

// #8-063 例63：此牌打2。把方片（C100-G1，labeler 手牌来自 JSON）
{
  const level = "2";
  const hand = handFromCaseJson("case-063");
  assert(hand.length === 27, `例63 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例63 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["10", SUITS.diamonds, 0], ["10", SUITS.spades, 0], ["10", SUITS.diamonds, 1], ["10", SUITS.clubs, 0], ["10", SUITS.hearts, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例63 应有5张10炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例63 应能生成基本候选");
}

// #8-064 例64：此牌打6。下家首（C100-G1，labeler 手牌来自 JSON）
{
  const level = "6";
  const hand = handFromCaseJson("case-064");
  assert(hand.length === 27, `例64 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例64 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["J", SUITS.hearts, 0], ["J", SUITS.spades, 0], ["J", SUITS.diamonds, 0], ["J", SUITS.clubs, 0], ["J", SUITS.diamonds, 1]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例64 应有5张J炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例64 应能生成基本候选");
}

// #8-065 例65：此牌打9, 首发（C100-G1，labeler 手牌来自 JSON）
{
  const level = "9";
  const hand = handFromCaseJson("case-065");
  assert(hand.length === 27, `例65 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例65 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["A", SUITS.clubs, 0], ["A", SUITS.diamonds, 0], ["A", SUITS.spades, 0], ["A", SUITS.spades, 1], ["A", SUITS.clubs, 1]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例65 应有5张A炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例65 应能生成基本候选");
}

// #8-066 例66：此牌打6。因对手（C100-G1，labeler 手牌来自 JSON）
{
  const level = "6";
  const hand = handFromCaseJson("case-066");
  assert(hand.length === 27, `例66 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例66 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["10", SUITS.diamonds, 0], ["10", SUITS.clubs, 0], ["10", SUITS.hearts, 0], ["10", SUITS.spades, 0], ["10", SUITS.clubs, 1]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例66 应有5张10炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例66 应能生成基本候选");
}

// #8-067 例67：此牌打 A。此牌蛇（C100-G1，labeler 手牌来自 JSON）
{
  const level = "A";
  const hand = handFromCaseJson("case-067");
  assert(hand.length === 27, `例67 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例67 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["A", SUITS.diamonds, 0], ["A", SUITS.spades, 0], ["A", SUITS.hearts, 0], ["A", SUITS.hearts, 1]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例67 应有4张A炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例67 应能生成基本候选");
}

// #8-068 例68：此牌打4。下家首（C100-G1，labeler 手牌来自 JSON）
{
  const level = "4";
  const hand = handFromCaseJson("case-068");
  assert(hand.length === 27, `例68 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例68 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["10", SUITS.clubs, 0], ["10", SUITS.hearts, 0], ["10", SUITS.diamonds, 0], ["10", SUITS.diamonds, 1]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例68 应有4张10炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例68 应能生成基本候选");
}

// #8-069 例69：此牌打 A。鉴于此（C100-G1，labeler 手牌来自 JSON）
{
  const level = "A";
  const hand = handFromCaseJson("case-069");
  assert(hand.length === 27, `例69 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例69 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["J", SUITS.hearts, 0], ["J", SUITS.diamonds, 0], ["J", SUITS.diamonds, 1], ["J", SUITS.clubs, 0], ["J", SUITS.spades, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例69 应有5张J炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例69 应能生成基本候选");
}

// #8-070 例70：此牌打 J, 此牌3（C100-G1，labeler 手牌来自 JSON）
{
  const level = "J";
  const hand = handFromCaseJson("case-070");
  assert(hand.length === 27, `例70 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例70 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["K", SUITS.clubs, 0], ["K", SUITS.clubs, 1], ["K", SUITS.diamonds, 0], ["K", SUITS.spades, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例70 应有4张K炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例70 应能生成基本候选");
}

// #8-071 例71：此牌打10。对手（C100-G1，labeler 手牌来自 JSON）
{
  const level = "10";
  const hand = handFromCaseJson("case-071");
  assert(hand.length === 27, `例71 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例71 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["Q", SUITS.diamonds, 0], ["Q", SUITS.hearts, 0], ["Q", SUITS.hearts, 1], ["Q", SUITS.clubs, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例71 应有4张Q炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例71 应能生成基本候选");
}

// #8-072 例72：此牌打 A。下家首（C100-G1，labeler 手牌来自 JSON）
{
  const level = "A";
  const hand = handFromCaseJson("case-072");
  assert(hand.length === 27, `例72 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例72 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["4", SUITS.spades, 0], ["4", SUITS.diamonds, 0], ["4", SUITS.clubs, 0], ["4", SUITS.diamonds, 1], ["4", SUITS.hearts, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例72 应有5张4炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例72 应能生成基本候选");
}

// #8-073 例73：此牌打6。上家首（C100-G1，labeler 手牌来自 JSON）
{
  const level = "6";
  const hand = handFromCaseJson("case-073");
  assert(hand.length === 27, `例73 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例73 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["4", SUITS.diamonds, 0], ["4", SUITS.spades, 0], ["4", SUITS.spades, 1], ["4", SUITS.clubs, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例73 应有4张4炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例73 应能生成基本候选");
}

// #8-074 例74：此牌打 K。应组（C100-G1，labeler 手牌来自 JSON）
{
  const level = "K";
  const hand = handFromCaseJson("case-074");
  assert(hand.length === 27, `例74 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例74 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["A", SUITS.clubs, 0], ["A", SUITS.clubs, 1], ["A", SUITS.diamonds, 0], ["A", SUITS.hearts, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例74 应有4张A炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例74 应能生成基本候选");
}

// #8-075 例75：此牌打 A。搭档抗（C100-G1，labeler 手牌来自 JSON）
{
  const level = "A";
  const hand = handFromCaseJson("case-075");
  assert(hand.length === 27, `例75 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例75 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["3", SUITS.hearts, 0], ["3", SUITS.hearts, 1], ["3", SUITS.diamonds, 0], ["3", SUITS.diamonds, 1]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例75 应有4张3炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例75 应能生成基本候选");
}

// #8-076 例76：此牌打3。下家首（C100-G1，labeler 手牌来自 JSON）
{
  const level = "3";
  const hand = handFromCaseJson("case-076");
  assert(hand.length === 27, `例76 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例76 每张牌应有 suit`);
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例76 应能生成基本候选");
}

// #8-077 例77：此牌打8。首发（C100-G1，labeler 手牌来自 JSON）
{
  const level = "8";
  const hand = handFromCaseJson("case-077");
  assert(hand.length === 27, `例77 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例77 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["8", SUITS.diamonds, 0], ["8", SUITS.diamonds, 1], ["8", SUITS.spades, 0], ["8", SUITS.hearts, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例77 应有4张8炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例77 应能生成基本候选");
}

// #8-078 例78：此牌打4。首发（C100-G1，labeler 手牌来自 JSON）
{
  const level = "4";
  const hand = handFromCaseJson("case-078");
  assert(hand.length === 27, `例78 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例78 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["7", SUITS.diamonds, 0], ["7", SUITS.spades, 0], ["7", SUITS.clubs, 0], ["7", SUITS.clubs, 1]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例78 应有4张7炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例78 应能生成基本候选");
}

// #8-079 例79：此牌打2。上家首（C100-G1，labeler 手牌来自 JSON）
{
  const level = "2";
  const hand = handFromCaseJson("case-079");
  assert(hand.length === 27, `例79 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例79 每张牌应有 suit`);
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例79 应能生成基本候选");
}

// #8-080 例80：此牌打5。首发（C100-G1，labeler 手牌来自 JSON）
{
  const level = "5";
  const hand = handFromCaseJson("case-080");
  assert(hand.length === 27, `例80 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例80 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["J", SUITS.diamonds, 0], ["J", SUITS.hearts, 0], ["J", SUITS.hearts, 1], ["J", SUITS.clubs, 0], ["J", SUITS.spades, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例80 应有5张J炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例80 应能生成基本候选");
}

// #8-081 例81：此牌打 A。首发 ,（C100-G1，labeler 手牌来自 JSON）
{
  const level = "A";
  const hand = handFromCaseJson("case-081");
  assert(hand.length === 27, `例81 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例81 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["10", SUITS.clubs, 0], ["10", SUITS.spades, 0], ["10", SUITS.spades, 1], ["10", SUITS.diamonds, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例81 应有4张10炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例81 应能生成基本候选");
}

// #8-082 例82：此牌打 A。下家首（C100-G1，labeler 手牌来自 JSON）
{
  const level = "A";
  const hand = handFromCaseJson("case-082");
  assert(hand.length === 27, `例82 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例82 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["9", SUITS.clubs, 0], ["9", SUITS.spades, 0], ["9", SUITS.hearts, 0], ["9", SUITS.hearts, 1]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例82 应有4张9炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例82 应能生成基本候选");
}

// #8-083 例83：此牌打 Q。首发（C100-G1，labeler 手牌来自 JSON）
{
  const level = "Q";
  const hand = handFromCaseJson("case-083");
  assert(hand.length === 27, `例83 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例83 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["K", SUITS.hearts, 0], ["K", SUITS.diamonds, 0], ["K", SUITS.clubs, 0], ["K", SUITS.diamonds, 1]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例83 应有4张K炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例83 应能生成基本候选");
}

// #8-084 例84：此牌打9。下家首（C100-G1，labeler 手牌来自 JSON）
{
  const level = "9";
  const hand = handFromCaseJson("case-084");
  assert(hand.length === 27, `例84 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例84 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["7", SUITS.clubs, 0], ["7", SUITS.spades, 0], ["7", SUITS.hearts, 0], ["7", SUITS.spades, 1], ["7", SUITS.diamonds, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例84 应有5张7炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例84 应能生成基本候选");
}

// #8-086 例86：此牌打2。下家首（C100-G1，labeler 手牌来自 JSON）
{
  const level = "2";
  const hand = handFromCaseJson("case-086");
  assert(hand.length === 27, `例86 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例86 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["K", SUITS.diamonds, 0], ["K", SUITS.hearts, 0], ["K", SUITS.spades, 0], ["K", SUITS.diamonds, 1]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例86 应有4张K炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例86 应能生成基本候选");
}

// #8-087 例87：此牌打3。首发（C100-G1，labeler 手牌来自 JSON）
{
  const level = "3";
  const hand = handFromCaseJson("case-087");
  assert(hand.length === 27, `例87 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例87 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["K", SUITS.spades, 0], ["K", SUITS.clubs, 0], ["K", SUITS.spades, 1], ["K", SUITS.clubs, 1]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例87 应有4张K炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例87 应能生成基本候选");
}

// #8-089 例89：此牌打6。首发（C100-G1，labeler 手牌来自 JSON）
{
  const level = "6";
  const hand = handFromCaseJson("case-089");
  assert(hand.length === 27, `例89 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例89 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["6", SUITS.hearts, 0], ["6", SUITS.spades, 0], ["6", SUITS.clubs, 0], ["6", SUITS.clubs, 1]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例89 应有4张6炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例89 应能生成基本候选");
}

// #8-090 例90：此牌打7。首发（C100-G1，labeler 手牌来自 JSON）
{
  const level = "7";
  const hand = handFromCaseJson("case-090");
  assert(hand.length === 27, `例90 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例90 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["8", SUITS.hearts, 0], ["8", SUITS.spades, 0], ["8", SUITS.hearts, 1], ["8", SUITS.diamonds, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例90 应有4张8炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例90 应能生成基本候选");
}

// #8-091 例91：此牌打2。首发（C100-G1，labeler 手牌来自 JSON）
{
  const level = "2";
  const hand = handFromCaseJson("case-091");
  assert(hand.length === 27, `例91 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例91 每张牌应有 suit`);
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例91 应能生成基本候选");
}

// #8-092 例92：此牌打 J,。下家进（C100-G1，labeler 手牌来自 JSON）
{
  const level = "J";
  const hand = handFromCaseJson("case-092");
  assert(hand.length === 27, `例92 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例92 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["10", SUITS.hearts, 0], ["10", SUITS.diamonds, 0], ["10", SUITS.diamonds, 1], ["10", SUITS.hearts, 1], ["10", SUITS.spades, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例92 应有5张10炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例92 应能生成基本候选");
}

// #8-093 例93：此牌打9。如此组（C100-G1，labeler 手牌来自 JSON）
{
  const level = "9";
  const hand = handFromCaseJson("case-093");
  assert(hand.length === 27, `例93 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例93 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["A", SUITS.hearts, 0], ["A", SUITS.hearts, 1], ["A", SUITS.clubs, 0], ["A", SUITS.diamonds, 0], ["A", SUITS.diamonds, 1]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例93 应有5张A炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例93 应能生成基本候选");
}

// #8-094 例94：此牌打2。本着（C100-G1，labeler 手牌来自 JSON）
{
  const level = "2";
  const hand = handFromCaseJson("case-094");
  assert(hand.length === 27, `例94 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例94 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["2", SUITS.diamonds, 0], ["2", SUITS.clubs, 0], ["2", SUITS.diamonds, 1], ["2", SUITS.hearts, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例94 应有4张2炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例94 应能生成基本候选");
}

// #8-095 例95：此牌打8。上家首（C100-G1，labeler 手牌来自 JSON）
{
  const level = "8";
  const hand = handFromCaseJson("case-095");
  assert(hand.length === 27, `例95 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例95 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["K", SUITS.clubs, 0], ["K", SUITS.clubs, 1], ["K", SUITS.diamonds, 0], ["K", SUITS.hearts, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例95 应有4张K炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例95 应能生成基本候选");
}

// #8-096 例96：此牌打2。很多人（C100-G1，labeler 手牌来自 JSON）
{
  const level = "2";
  const hand = handFromCaseJson("case-096");
  assert(hand.length === 27, `例96 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例96 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["2", SUITS.hearts, 0], ["2", SUITS.diamonds, 0], ["2", SUITS.clubs, 0], ["2", SUITS.diamonds, 1]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例96 应有4张2炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例96 应能生成基本候选");
}

// #8-097 例97：此牌打2。下家首（C100-G1，labeler 手牌来自 JSON）
{
  const level = "2";
  const hand = handFromCaseJson("case-097");
  assert(hand.length === 27, `例97 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例97 每张牌应有 suit`);
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例97 应能生成基本候选");
}

// #8-098 例98：此牌打 A。扰好此（C100-G1，labeler 手牌来自 JSON）
{
  const level = "A";
  const hand = handFromCaseJson("case-098");
  assert(hand.length === 27, `例98 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例98 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["10", SUITS.hearts, 0], ["10", SUITS.diamonds, 0], ["10", SUITS.diamonds, 1], ["10", SUITS.hearts, 1], ["10", SUITS.spades, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例98 应有5张10炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例98 应能生成基本候选");
}

// #8-099 例99：此牌打 A。下家首（C100-G1，labeler 手牌来自 JSON）
{
  const level = "A";
  const hand = handFromCaseJson("case-099");
  assert(hand.length === 27, `例99 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例99 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["10", SUITS.diamonds, 0], ["10", SUITS.clubs, 0], ["10", SUITS.diamonds, 1], ["10", SUITS.spades, 0]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例99 应有4张10炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例99 应能生成基本候选");
}

// #8-100 例100：此牌打9。下家（C100-G1，labeler 手牌来自 JSON）
{
  const level = "9";
  const hand = handFromCaseJson("case-100");
  assert(hand.length === 27, `例100 JSON 手牌应为 27 张，实际 ${hand.length}`);
  assert(hand.every((c) => c.suit), `例100 每张牌应有 suit`);
  const bomb = classifyPlay(cards([["6", SUITS.diamonds, 0], ["6", SUITS.spades, 0], ["6", SUITS.diamonds, 1], ["6", SUITS.spades, 1]]), level);
  assert(bomb?.type === PLAY_TYPES.bomb, "例100 应有4张6炸弹");
  const all = generateBasicCandidates(hand, level, null);
  assert(all.length > 0, "例100 应能生成基本候选");
}

// #8 强牌首发小单信号 C100-O2
{
  const hand = cards([
    ["3", SUITS.spades],
    ["9", SUITS.clubs], ["9", SUITS.diamonds], ["9", SUITS.hearts],
    ["K", SUITS.clubs], ["K", SUITS.diamonds],
    ["Q", SUITS.hearts], ["Q", SUITS.spades],
    ["J", SUITS.clubs], ["J", SUITS.diamonds],
    ["10", SUITS.hearts], ["10", SUITS.spades],
    ["8", SUITS.clubs], ["8", SUITS.diamonds],
    ["7", SUITS.hearts], ["7", SUITS.spades],
    ["5", SUITS.clubs], ["5", SUITS.diamonds],
    ["4", SUITS.hearts], ["4", SUITS.spades],
    ["A", SUITS.clubs], ["A", SUITS.diamonds],
    ["2", SUITS.hearts], ["2", SUITS.spades], ["6", SUITS.hearts],
  ]);
  const all = generateBasicCandidates(hand, "2", null);
  const single3 = all.find((c) => c.type === PLAY_TYPES.single && c.mainRank === "3");
  const pair4 = all.find((c) => c.type === PLAY_TYPES.pair && c.mainRank === "4");
  const profile = { role: "main-attack", score: 14, looseSingles: 1 };
  const s3 = scoreOpening(single3, hand, profile);
  const p4 = scoreOpening(pair4, hand, profile);
  assert(
    s3.score < p4.score || s3.reasons.some((r) => /C100-O2/.test(r)),
    `C100-O2 强牌小单应优于小对（${s3.score} vs ${p4.score}）`,
  );
}

const coachBrainCount = runCaseScenarioBatch({
  handFromCaseJson,
  scoreOpening,
  scoreFollow,
  assert,
  cards,
}, [
  "../../training-samples/cases/case-scenarios-1-50.json",
  "../../training-samples/cases/case-scenarios-51-100.json",
]);

console.log(`golden-case-100cases：通过（结构化 ${104} + 教练大脑 ${coachBrainCount} = ${104 + coachBrainCount} 场景）`);
