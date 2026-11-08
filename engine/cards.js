/**
 * 掼蛋牌面：两副 108 张。
 */
import { RANKS, SUITS, JOKER_BLACK, JOKER_RED, isJokerRank } from './ranks.js';

let _id = 1;

/** Eval/replay: reset monotonic card id allocator (selfplay deck builds are reproducible). */
export function resetCardIdCounter(start = 1) {
  _id = start;
}

/**
 * 构造一张牌。
 * @param {string} rank
 * @param {string} suit
 * @param {number} [id]
 * @returns {{ rank: string, suit: string, id: number }}
 */
export function card(rank, suit, id) {
  return { rank, suit, id: id ?? _id++ };
}

/**
 * 牌的稳定键（点数+花色+id）。
 * @param {{ rank: string, suit: string, id: number }} c
 * @returns {string}
 */
export function cardKey(c) {
  return `${c.rank}${c.suit}#${c.id}`;
}

/**
 * 牌面短字（如 AH / RJ）。
 * @param {{ rank: string, suit: string }} c
 * @returns {string}
 */
export function formatCard(c) {
  if (c.rank === JOKER_RED) return 'RJ';
  if (c.rank === JOKER_BLACK) return 'BJ';
  return `${c.rank}${c.suit}`;
}

/**
 * 解析一张牌字面量。
 * @param {string} token
 * @returns {{ rank: string, suit: string, id: number }}
 * @throws {Error} 无法解析
 */
export function parseCard(token) {
  const t = String(token).trim().toUpperCase();
  if (t === 'RJ' || t === 'RED' || t === '大王') return card(JOKER_RED, 'J');
  if (t === 'BJ' || t === 'BLACK' || t === '小王') return card(JOKER_BLACK, 'J');
  const m = t.match(/^(10|[2-9JQKA])([SHDC])$/);
  if (!m) throw new Error(`无法解析牌: ${token}`);
  return card(m[1] === '10' ? '10' : m[1], m[2]);
}

/**
 * 便捷：'AH AH' 或数组。同一字面量会生成不同 id。
 * @param {...(string|object|Array)} tokens
 * @returns {object[]}
 * @throws {Error} 无法解析其中一张
 */
export function cards(...tokens) {
  const parts = tokens.flatMap((x) =>
    Array.isArray(x) ? x : String(x).split(/[\s,]+/).filter(Boolean),
  );
  return parts.map((p) => (typeof p === 'object' ? p : parseCard(p)));
}

/**
 * 两副 108 张。
 * @returns {object[]}
 */
export function makeDeck() {
  const deck = [];
  for (let copy = 0; copy < 2; copy++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) deck.push(card(rank, suit));
    }
    deck.push(card(JOKER_BLACK, 'J'));
    deck.push(card(JOKER_RED, 'J'));
  }
  return deck;
}

/**
 * Fisher–Yates 洗牌（不改原数组）。
 * @param {object[]} arr
 * @param {() => number} [rng]
 * @returns {object[]}
 */
export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 发成 4 手各 27 张。
 * @param {object[]} [deck]
 * @returns {object[][]}
 * @throws {Error} 不是 108 张
 */
export function dealFourHands(deck = shuffle(makeDeck())) {
  if (deck.length !== 108) throw new Error('掼蛋必须 108 张');
  return [0, 1, 2, 3].map((i) => deck.slice(i * 27, i * 27 + 27));
}

/**
 * 按点数计数。
 * @param {object[]} list
 * @returns {Map<string, number>}
 */
export function countByRank(list) {
  const m = new Map();
  for (const c of list) m.set(c.rank, (m.get(c.rank) || 0) + 1);
  return m;
}

/**
 * 是否王牌。
 * @param {{ rank: string }} c
 * @returns {boolean}
 */
export function isJoker(c) {
  return isJokerRank(c.rank);
}
