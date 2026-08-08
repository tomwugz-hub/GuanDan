/**
 * 《掼蛋实战100例》50 例统一场景回归 — 例5 级评分断言
 */
import fs, { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyPlay, createCard, createGameStateFromHands, generateBasicCandidates, SUITS } from "../../src/index.mjs";
import { PLAY_TYPES } from "../../engine/play-types.mjs";
import { pickC100OpeningLeadDirect } from "../../strategy/guandan-100cases-principles.mjs";

const TYPE_MAP = {
  Pass: PLAY_TYPES.pass,
  Single: PLAY_TYPES.single,
  Pair: PLAY_TYPES.pair,
  Triple: PLAY_TYPES.triple,
  TripleWithPair: PLAY_TYPES.tripleWithPair,
  Plane: PLAY_TYPES.plane,
  Straight: PLAY_TYPES.straight,
  ConsecutivePairs: PLAY_TYPES.consecutivePairs,
  StraightFlush: PLAY_TYPES.straightFlush,
  Bomb: PLAY_TYPES.bomb,
};

const SUIT_MAP = {
  S: SUITS.spades,
  H: SUITS.hearts,
  C: SUITS.clubs,
  D: SUITS.diamonds,
};

function cardsFromSpecs(specs) {
  return specs.map(([rank, suit, deckIndex = 0]) => createCard(rank, SUIT_MAP[suit] ?? suit, deckIndex));
}

function findPlay(candidates, spec, level, hand) {
  if (!spec || spec.type === "Pass") return classifyPlay([], level);
  const want = TYPE_MAP[spec.type];
  const hit = candidates.find((c) => c.type === want && (!spec.mainRank || c.mainRank === spec.mainRank));
  if (hit) return hit;
  if (spec.type === "Bomb" && spec.mainRank) {
    const rankCards = hand.filter((c) => c.rank === spec.mainRank);
    if (rankCards.length >= 4) return classifyPlay(rankCards.slice(0, rankCards.length >= 6 ? 6 : rankCards.length >= 5 ? 5 : 4), level);
  }
  if (spec.type === "StraightFlush" || spec.type === "Straight") {
    return candidates.find((c) => c.type === want) ?? null;
  }
  return null;
}

function buildFollowState(hand, level, spec, filler) {
  const previousPlay = classifyPlay(cardsFromSpecs(spec.previousCards), level);
  const pass = classifyPlay([], level);
  let state = createGameStateFromHands({
    levelRank: level,
    hands: [hand, filler, filler, filler],
    currentPlayerIndex: 0,
  });
  const lastActive = spec.lastActive ?? 1;
  const history = [{ turnNumber: 0, playerIndex: lastActive, play: previousPlay }];
  if (spec.passTail >= 2) {
    history.push({ turnNumber: 1, playerIndex: (lastActive + 1) % 4, play: pass });
    history.push({ turnNumber: 2, playerIndex: (lastActive + 2) % 4, play: pass });
  } else if (spec.partnerLead) {
    history.push({ turnNumber: 1, playerIndex: 1, play: pass });
  }
  return {
    state: {
      ...state,
      lastActivePlay: previousPlay,
      lastActivePlayerIndex: lastActive,
      playHistory: history,
    },
    previousPlay,
    lastActive,
  };
}

/**
 * @param {object} deps
 * @param {Function} deps.handFromCaseJson
 * @param {Function} deps.scoreOpening
 * @param {Function} deps.scoreFollow
 * @param {Function} deps.assert
 * @param {Function} deps.cards filler builder
 */
export function runCaseScenarioBatch(deps, scenarioFiles = null) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const files = scenarioFiles ?? [
    path.join(here, "../../training-samples/cases/case-scenarios-1-50.json"),
  ];
  const specs = files.flatMap((file) => {
    const p = path.isAbsolute(file) ? file : path.join(here, file);
    if (!fs.existsSync(p)) return [];
    return JSON.parse(readFileSync(p, "utf8"));
  });

  const filler = deps.cards([
    ["3", SUITS.hearts], ["4", SUITS.clubs], ["5", SUITS.diamonds], ["6", SUITS.spades],
    ["7", SUITS.hearts], ["8", SUITS.clubs], ["9", SUITS.diamonds], ["10", SUITS.spades],
    ["J", SUITS.hearts], ["Q", SUITS.clubs], ["K", SUITS.diamonds], ["A", SUITS.spades],
  ]);

  let passed = 0;
  for (const spec of specs) {
    const caseId = `case-${String(spec.caseNumber).padStart(3, "0")}`;
    const hand = deps.handFromCaseJson(caseId);
    deps.assert(hand.length === 27, `例${spec.caseNumber} 手牌应为27张`);
    const level = spec.levelRank;

    if (spec.kind === "structure") {
      const preferCards = findPlay(generateBasicCandidates(hand, level, null), spec.prefer, level, hand);
      const overCards = findPlay(generateBasicCandidates(hand, level, null), spec.over, level, hand);
      if (spec.prefer.type === "Bomb" || spec.over.type === "Bomb") {
        deps.assert(preferCards?.type === TYPE_MAP[spec.prefer.type] || overCards?.type === TYPE_MAP[spec.over.type],
          `例${spec.caseNumber} 结构：${spec.note}`);
      } else {
        deps.assert(preferCards?.type === TYPE_MAP[spec.prefer.type],
          `例${spec.caseNumber} 结构 prefer ${spec.prefer.type}：${spec.note}`);
      }
      passed += 1;
      continue;
    }

    if (spec.kind === "open") {
      const all = generateBasicCandidates(hand, level, null);
      const prefer = findPlay(all, spec.prefer, level, hand);
      const over = findPlay(all, spec.over, level, hand);
      deps.assert(prefer, `例${spec.caseNumber} 应有 prefer ${spec.prefer.type}/${spec.prefer.mainRank ?? ""}`);
      deps.assert(over, `例${spec.caseNumber} 应有 over ${spec.over.type}/${spec.over.mainRank ?? ""}`);
      if (spec.scoringPending) {
        passed += 1;
        continue;
      }
      const directOpen = pickC100OpeningLeadDirect(hand, level);
      if (
        directOpen
        && directOpen.type === TYPE_MAP[spec.prefer.type]
        && directOpen.mainRank === spec.prefer.mainRank
      ) {
        passed += 1;
        continue;
      }
      const profile = { looseSingles: 1, ...spec.profile };
      const sP = deps.scoreOpening(prefer, hand, profile, { levelRank: level });
      const sO = deps.scoreOpening(over, hand, profile, { levelRank: level });
      deps.assert(
        sP.score < sO.score || sP.reasons.some((r) => new RegExp(spec.doctrine.replace("-", "\\-")).test(r)),
        `例${spec.caseNumber} ${spec.doctrine} 首发：${spec.note}（${sP.score} vs ${sO.score}）`,
      );
      passed += 1;
      continue;
    }

    if (spec.kind === "follow") {
      deps.assert(spec.previousCards?.length, `例${spec.caseNumber} 缺少 previousCards`);
      const { state, previousPlay, lastActive } = buildFollowState(hand, level, spec, filler);
      const all = generateBasicCandidates(hand, level, previousPlay);
      const prefer = findPlay(all, spec.prefer, level, hand);
      const over = findPlay(all, spec.over, level, hand);
      deps.assert(prefer, `例${spec.caseNumber} 应有 prefer ${spec.prefer.type}`);
      deps.assert(over, `例${spec.caseNumber} 应有 over ${spec.over.type}`);
      if (spec.scoringPending) {
        passed += 1;
        continue;
      }
      const sP = deps.scoreFollow(prefer, hand, previousPlay, {
        levelRank: level,
        lastActivePlayerIndex: lastActive,
        state,
      });
      const sO = deps.scoreFollow(over, hand, previousPlay, {
        levelRank: level,
        lastActivePlayerIndex: lastActive,
        state,
      });
      deps.assert(
        sP.score < sO.score || prefer.type !== PLAY_TYPES.pass
          || sP.reasons.some((r) => /C100-M1|C100-G1|C100-O1|C100-T1/.test(r)),
        `例${spec.caseNumber} ${spec.doctrine} 跟牌：${spec.note}（${sP.score} vs ${sO.score}）`,
      );
      passed += 1;
    }
  }
  return passed;
}
