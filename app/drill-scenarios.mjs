/** 专项练习 v2：按弱项标签加载 rigged（预设）教学局面 */

import { createCard, cardId, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createDoubleDeck, shuffle } from "../engine/deck.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
/** 与 drill-practice.mjs 中 DRILL_TAGS 保持一致，避免循环依赖 */
const SCENARIO_TAGS = Object.freeze({
  BOMB_SPLIT_TRIPLE: "拆炸/三带二",
  ONE_CARD_PRESS: "报单压牌",
  WILD_USAGE: "逢人配用法",
  BOMB_TIMING: "炸弹时机",
  PASS_RELEASE: "过牌放行",
  TRIPLE_PAIR_LEAD: "三带二减手",
});

function normalizeScenarioTag(tag) {
  if (tag === SCENARIO_TAGS.TRIPLE_PAIR_LEAD) return SCENARIO_TAGS.BOMB_SPLIT_TRIPLE;
  return tag;
}

function c(rank, suit = SUITS.spades, deckIndex = 0) {
  return createCard(rank, suit, deckIndex);
}

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function specsToCards(specs = []) {
  return specs.map(([rank, suit = SUITS.spades, deckIndex = 0]) => c(rank, suit, deckIndex));
}

function removeCardsFromHand(hand, cardsToRemove) {
  const need = new Map();
  for (const card of cardsToRemove) {
    const id = cardId(card);
    need.set(id, (need.get(id) ?? 0) + 1);
  }
  const next = [];
  for (const card of hand) {
    const id = cardId(card);
    const count = need.get(id) ?? 0;
    if (count > 0) {
      need.set(id, count - 1);
    } else {
      next.push(card);
    }
  }
  return next;
}

/** 将关键牌补满至 27 张，其余座位均分剩余牌；exclude 用于桌面已出的牌 */
function buildHandsFromAssignments(assignments, fillerSeed = 42, exclude = []) {
  const deck = createDoubleDeck();
  const usedIds = new Set();
  const hands = [0, 1, 2, 3].map((seat) => [...(assignments[seat] ?? [])]);

  for (const card of exclude) {
    usedIds.add(cardId(card));
  }

  for (const hand of hands) {
    for (const card of hand) {
      const id = cardId(card);
      if (usedIds.has(id)) {
        throw new Error(`预设局面牌重复：${id}`);
      }
      usedIds.add(id);
    }
  }

  const remaining = shuffle(
    deck.filter((card) => !usedIds.has(cardId(card))),
    seededRandom(fillerSeed),
  );
  let cursor = 0;
  for (let seat = 0; seat < 4; seat += 1) {
    while (hands[seat].length < 27) {
      if (cursor >= remaining.length) {
        throw new Error("预设局面补牌不足");
      }
      hands[seat].push(remaining[cursor]);
      cursor += 1;
    }
  }
  if (cursor !== remaining.length) {
    throw new Error("预设局面补牌后仍有剩余");
  }
  return hands;
}

/**
 * @typedef {object} DrillScenario
 * @property {string} id
 * @property {string} tag
 * @property {string} title
 * @property {string} summary
 * @property {string} levelRank
 * @property {number} seed
 * @property {Record<number, import("../engine/card.mjs").Card[]>} assignments
 * @property {object} [table]
 * @property {number} [table.currentPlayerIndex]
 * @property {number} [table.lastActivePlayerIndex]
 * @property {Array<[string, string?, number?]>} [table.lastActivePlayCards]
 * @property {Record<number, import("../engine/card.mjs").Card[]>} [table.playerHands]
 */

/** 各弱项至少一个可复现的预设局面 */
export const DRILL_SCENARIOS = Object.freeze([
  {
    id: "pass-release-pair-5",
    tag: SCENARIO_TAGS.PASS_RELEASE,
    title: "对手占牌别放行",
    summary: "勇哥出了对 5，你有对 6、对 7 能压，别轻易过牌。",
    levelRank: "5",
    seed: 51001,
    assignments: {
      0: [
        c("6", SUITS.diamonds), c("6", SUITS.clubs),
        c("7", SUITS.diamonds), c("7", SUITS.clubs),
        c("4", SUITS.spades), c("4", SUITS.hearts), c("4", SUITS.clubs), c("4", SUITS.diamonds),
      ],
      1: [
        c("5", SUITS.diamonds), c("5", SUITS.spades),
        c("9", SUITS.spades), c("10", SUITS.spades), c("J", SUITS.spades),
        c("Q", SUITS.spades), c("K", SUITS.spades),
      ],
    },
    table: {
      currentPlayerIndex: 0,
      lastActivePlayerIndex: 1,
      lastActivePlayCards: [["5", SUITS.diamonds], ["5", SUITS.spades]],
    },
  },
  {
    id: "one-card-press-level",
    tag: SCENARIO_TAGS.ONE_CARD_PRESS,
    title: "报单必压",
    summary: "勇哥只剩一张牌并出了单 6，用级牌或大牌压住，别放行。",
    levelRank: "3",
    seed: 31002,
    assignments: {
      0: [
        c("3", SUITS.hearts), c("9", SUITS.hearts, 1),
        c("K", SUITS.spades), c("A", SUITS.clubs),
      ],
      1: [c("6", SUITS.diamonds), c("Q", SUITS.diamonds)],
      2: [c("8", SUITS.clubs), c("8", SUITS.diamonds)],
      3: [c("7", SUITS.hearts), c("7", SUITS.diamonds)],
    },
    table: {
      currentPlayerIndex: 0,
      lastActivePlayerIndex: 1,
      lastActivePlayCards: [["6", SUITS.diamonds]],
      playerHands: {
        1: [c("Q", SUITS.diamonds)],
      },
    },
  },
  {
    id: "bomb-timing-vs-single",
    tag: SCENARIO_TAGS.BOMB_TIMING,
    title: "有普通过牌别急着炸",
    summary: "勇哥出单 9，你有单 10 能跟，不必立刻动用炸弹。",
    levelRank: "4",
    seed: 41003,
    assignments: {
      0: [
        c("10", SUITS.spades), c("J", SUITS.clubs),
        c("8", SUITS.spades), c("8", SUITS.hearts), c("8", SUITS.clubs), c("8", SUITS.diamonds),
      ],
      1: [
        c("9", SUITS.diamonds),
        c("Q", SUITS.spades), c("K", SUITS.clubs), c("A", SUITS.diamonds),
      ],
    },
    table: {
      currentPlayerIndex: 0,
      lastActivePlayerIndex: 1,
      lastActivePlayCards: [["9", SUITS.diamonds]],
    },
  },
  {
    id: "bomb-split-triple-lead",
    tag: SCENARIO_TAGS.BOMB_SPLIT_TRIPLE,
    title: "接风三带二减手",
    summary: "你接风先出，手上有完整三带二，优先减手别拆炸弹。",
    levelRank: "6",
    seed: 61004,
    assignments: {
      0: [
        c("3", SUITS.spades), c("3", SUITS.hearts), c("3", SUITS.clubs),
        c("2", SUITS.spades), c("2", SUITS.diamonds),
        c("6", SUITS.spades), c("6", SUITS.hearts), c("6", SUITS.clubs), c("6", SUITS.diamonds),
      ],
    },
    table: {
      currentPlayerIndex: 0,
      lastActivePlayerIndex: null,
      lastActivePlayCards: null,
    },
  },
  {
    id: "wild-straight-flush",
    tag: SCENARIO_TAGS.WILD_USAGE,
    title: "逢人配留给同花顺",
    summary: "红心级牌是逢人配，优先凑同花顺，别配进小三带。",
    levelRank: "7",
    seed: 71005,
    assignments: {
      0: [
        c("7", SUITS.hearts),
        c("8", SUITS.spades), c("9", SUITS.spades), c("10", SUITS.spades),
        c("J", SUITS.spades), c("Q", SUITS.spades),
        c("3", SUITS.diamonds), c("3", SUITS.clubs), c("4", SUITS.diamonds),
      ],
    },
    table: {
      currentPlayerIndex: 0,
      lastActivePlayerIndex: null,
      lastActivePlayCards: null,
    },
  },
  {
    id: "triple-pair-lead",
    tag: SCENARIO_TAGS.TRIPLE_PAIR_LEAD,
    title: "接风先出三带二",
    summary: "轮到你先出，优先三带二一次减五张，保留炸弹结构。",
    levelRank: "5",
    seed: 51006,
    assignments: {
      0: [
        c("J", SUITS.spades), c("J", SUITS.hearts), c("J", SUITS.clubs),
        c("9", SUITS.diamonds), c("9", SUITS.clubs),
        c("K", SUITS.spades), c("K", SUITS.hearts), c("K", SUITS.clubs), c("K", SUITS.diamonds),
      ],
    },
    table: {
      currentPlayerIndex: 0,
      lastActivePlayerIndex: null,
      lastActivePlayCards: null,
    },
  },
]);

/** 按标签取第一个匹配的预设局面 */
export function getDrillScenarioForTag(tag) {
  if (!tag) return null;
  const normalized = normalizeScenarioTag(tag);
  return DRILL_SCENARIOS.find((item) => item.tag === tag)
    ?? DRILL_SCENARIOS.find((item) => item.tag === normalized)
    ?? null;
}

export function getDrillScenarioSummary(tag) {
  const scenario = getDrillScenarioForTag(tag);
  if (!scenario) return null;
  return `${scenario.title}：${scenario.summary}`;
}

function applyScenarioTable(state, scenario) {
  const table = scenario.table ?? {};
  let next = { ...state };

  const levelRank = scenario.levelRank;
  const playCards = specsToCards(table.lastActivePlayCards ?? []);

  if (playCards.length && table.lastActivePlayerIndex !== null && table.lastActivePlayerIndex !== undefined) {
    next = {
      ...next,
      players: next.players.map((player, index) => {
        if (index !== table.lastActivePlayerIndex) return player;
        return { ...player, hand: removeCardsFromHand(player.hand, playCards) };
      }),
    };
  }

  if (table.playerHands) {
    next = {
      ...next,
      players: next.players.map((player, index) => {
        const override = table.playerHands[index];
        if (!override) return player;
        return { ...player, hand: [...override] };
      }),
    };
  }

  if (playCards.length) {
    const play = classifyPlay(playCards, levelRank);
    const actor = table.lastActivePlayerIndex ?? 0;
    next = {
      ...next,
      currentPlayerIndex: table.currentPlayerIndex ?? 0,
      lastActivePlay: play,
      lastActivePlayerIndex: actor,
      passCount: 0,
      turnNumber: 1,
      playHistory: [{
        turnNumber: 0,
        playerIndex: actor,
        play,
      }],
    };
  } else {
    next = {
      ...next,
      currentPlayerIndex: table.currentPlayerIndex ?? 0,
      lastActivePlay: null,
      lastActivePlayerIndex: null,
      passCount: 0,
      turnNumber: 0,
      playHistory: [],
    };
  }

  return next;
}

/**
 * 为专项练习生成 rigged 局面。
 * @returns {{ state: object, scenario: DrillScenario, levelRank: string, seed: number }}
 */
export function createDrillRiggedState(tag) {
  const scenario = getDrillScenarioForTag(tag);
  if (!scenario) {
    throw new Error(`未找到专项「${tag}」的预设局面`);
  }

  const hands = buildHandsFromAssignments(scenario.assignments, scenario.seed);
  let state = createGameStateFromHands({
    levelRank: scenario.levelRank,
    hands,
    currentPlayerIndex: scenario.table?.currentPlayerIndex ?? 0,
  });
  state = applyScenarioTable(state, scenario);

  const humanCount = state.players[0]?.hand?.length ?? 0;
  if (humanCount < 1) {
    throw new Error(`预设局面 ${scenario.id} 你的手牌为空`);
  }

  return {
    state,
    scenario,
    levelRank: scenario.levelRank,
    seed: scenario.seed,
  };
}
