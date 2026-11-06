/**
 * 掼蛋牌型识别。引擎只判定“这手牌是什么”，不做策略。
 *
 * 类型：single / pair / triple / fullhouse / straight / pairSeq / tripleSeq /
 *       bomb / straightFlush / pass
 *
 * 逢人配：仅红桃当前级牌可替任何点数（两副最多两张）。其余花色级牌不能替点。王牌不能当逢人配。
 * 炸弹：同点 ≥4（可用逢人配补张）；四王视为点数最高的 4 炸。
 * 同花顺：恰好 5 张同花色连张（可用逢人配补点数，花色跟非配牌）。
 */
import { isJokerRank, isWildCard, SEQ_RANKS, seqWindows, JOKER_RED } from './ranks.js';

export const TYPES = {
  PASS: 'pass',
  SINGLE: 'single',
  PAIR: 'pair',
  TRIPLE: 'triple',
  FULLHOUSE: 'fullhouse',
  STRAIGHT: 'straight',
  PAIR_SEQ: 'pairSeq',
  TRIPLE_SEQ: 'tripleSeq',
  BOMB: 'bomb',
  STRAIGHT_FLUSH: 'straightFlush',
};

/**
 * 过牌。
 * @returns {{ type: string, rank: null, length: number, size: number }}
 */
export function passCombo() {
  return { type: TYPES.PASS, rank: null, length: 0, size: 0 };
}

function split(cards, levelRank) {
  const wilds = [];
  const jokers = [];
  const naturals = [];
  for (const c of cards) {
    if (isJokerRank(c.rank)) jokers.push(c);
    else if (isWildCard(c, levelRank) && wilds.length < 2) wilds.push(c);
    else naturals.push(c);
  }
  return { wilds, jokers, naturals, wildCount: wilds.length };
}

function groupNaturals(naturals) {
  const m = new Map();
  for (const c of naturals) {
    if (!m.has(c.rank)) m.set(c.rank, []);
    m.get(c.rank).push(c);
  }
  return m;
}

function combo(type, rank, extras = {}) {
  return { type, rank, ...extras };
}

/* ---- 基本型 ---- */

/**
 * @param {object[]} cards
 * @param {string} [_levelRank]
 * @returns {object|null}
 */
export function asSingle(cards, levelRank) {
  if (cards.length !== 1) return null;
  return combo(TYPES.SINGLE, cards[0].rank, { length: 1, size: 1 });
}

/**
 * @param {object[]} cards
 * @param {string} levelRank
 * @returns {object|null}
 */
export function asPair(cards, levelRank) {
  if (cards.length !== 2) return null;
  const { wilds, jokers, naturals } = split(cards, levelRank);
  if (jokers.length === 2 && wilds.length === 0 && naturals.length === 0) {
    if (jokers[0].rank === jokers[1].rank) {
      return combo(TYPES.PAIR, jokers[0].rank, { length: 2, size: 2 });
    }
    return null;
  }
  if (jokers.length) return null;
  if (naturals.length === 2 && naturals[0].rank === naturals[1].rank) {
    return combo(TYPES.PAIR, naturals[0].rank, { length: 2, size: 2 });
  }
  if (naturals.length === 1 && wilds.length === 1) {
    return combo(TYPES.PAIR, naturals[0].rank, { length: 2, size: 2, wilds: 1 });
  }
  if (naturals.length === 0 && wilds.length === 2) {
    return combo(TYPES.PAIR, levelRank, { length: 2, size: 2, wilds: 2 });
  }
  return null;
}

/**
 * @param {object[]} cards
 * @param {string} levelRank
 * @returns {object|null}
 */
export function asTriple(cards, levelRank) {
  if (cards.length !== 3) return null;
  const { wilds, jokers, naturals } = split(cards, levelRank);
  if (jokers.length) return null;
  const g = groupNaturals(naturals);
  if (g.size > 1) return null;
  if (g.size === 1) {
    const rank = [...g.keys()][0];
    if (g.get(rank).length + wilds.length === 3) {
      return combo(TYPES.TRIPLE, rank, { length: 3, size: 3, wilds: wilds.length });
    }
    return null;
  }
  return null;
}

/**
 * 同点 ≥4（可用逢人配补张）；四王视为最高 4 炸。
 * @param {object[]} cards
 * @param {string} levelRank
 * @returns {object|null}
 */
export function asBomb(cards, levelRank) {
  const n = cards.length;
  if (n < 4) return null;
  const { wilds, jokers, naturals } = split(cards, levelRank);
  if (jokers.length === 4 && n === 4 && wilds.length === 0 && naturals.length === 0) {
    return combo(TYPES.BOMB, JOKER_RED, { length: 4, size: 4, bombSize: 4, rocket: true });
  }
  if (jokers.length) return null;
  const g = groupNaturals(naturals);
  if (g.size > 1) return null;
  if (g.size === 1) {
    const rank = [...g.keys()][0];
    const cnt = g.get(rank).length + wilds.length;
    if (cnt === n && n >= 4) {
      return combo(TYPES.BOMB, rank, { length: n, size: n, bombSize: n, wilds: wilds.length });
    }
    return null;
  }
  return null;
}

/**
 * 三带二，恰好 5 张。
 * @param {object[]} cards
 * @param {string} levelRank
 * @returns {object|null}
 */
export function asFullHouse(cards, levelRank) {
  if (cards.length !== 5) return null;
  const { wilds, jokers, naturals } = split(cards, levelRank);
  if (jokers.length) return null;
  const g = groupNaturals(naturals);
  const ranks = [...g.keys()];
  if (ranks.length > 2) return null;

  const tryAssign = (tripleRank, pairRank) => {
    if (tripleRank === pairRank) return null;
    const haveT = g.get(tripleRank)?.length || 0;
    const haveP = g.get(pairRank)?.length || 0;
    let w = wilds.length;
    const needT = Math.max(0, 3 - haveT);
    const needP = Math.max(0, 2 - haveP);
    if (needT + needP === w && haveT <= 3 && haveP <= 2) {
      return combo(TYPES.FULLHOUSE, tripleRank, { length: 5, size: 5, pairRank, wilds: w });
    }
    return null;
  };

  if (ranks.length === 2) {
    const [a, b] = ranks;
    return tryAssign(a, b) || tryAssign(b, a);
  }
  if (ranks.length === 1) {
    const r = ranks[0];
    const have = g.get(r).length;
    // 3+2：自然张作三条，配牌作对；或自然 2 + 配 3 但会对子点数=级牌
    if (have === 3 && wilds.length === 2) {
      return combo(TYPES.FULLHOUSE, r, { length: 5, size: 5, pairRank: levelRank, wilds: 2 });
    }
    if (have === 4 && wilds.length === 1) {
      // 四张同点+配：更应是炸弹；不认三带二
      return null;
    }
    return null;
  }
  return null;
}

/* ---- 顺子 / 连对 / 钢板 / 同花顺（桌规：顺 5、连对 6、钢板 6） ---- */

function sequenceWindows(len) {
  return seqWindows(len);
}

/**
 * 恰好 5 张顺子。
 * @param {object[]} cards
 * @param {string} levelRank
 * @returns {object|null}
 */
export function asStraight(cards, levelRank) {
  const n = cards.length;
  if (n !== 5) return null;
  const { wilds, jokers, naturals } = split(cards, levelRank);
  if (jokers.length) return null;
  if (naturals.length === 0) return null; // 纯级牌按炸弹/三条处理，不当顺子
  if (naturals.some((c, i, a) => a.findIndex((x) => x.rank === c.rank) !== i)) return null; // 重复点数
  const used = new Set(naturals.map((c) => c.rank));
  if (used.size + wilds.length !== n) return null;

  for (const win of sequenceWindows(n)) {
    const missing = win.filter((r) => !used.has(r));
    const extra = [...used].filter((r) => !win.includes(r));
    if (extra.length) continue;
    if (missing.length === wilds.length) {
      return combo(TYPES.STRAIGHT, win[n - 1], { length: n, size: n, low: win[0], wilds: wilds.length });
    }
  }
  return null;
}

/**
 * 恰好 5 张同花顺。
 * @param {object[]} cards
 * @param {string} levelRank
 * @returns {object|null}
 */
export function asStraightFlush(cards, levelRank) {
  if (cards.length !== 5) return null;
  const { wilds, jokers, naturals } = split(cards, levelRank);
  if (jokers.length) return null;
  const suits = new Set(naturals.map((c) => c.suit));
  if (suits.size > 1) return null;
  const suit = naturals[0]?.suit || wilds[0]?.suit;
  if (naturals.some((c, i, a) => a.findIndex((x) => x.rank === c.rank) !== i)) return null;
  const st = asStraight(cards, levelRank);
  if (!st) return null;
  return combo(TYPES.STRAIGHT_FLUSH, st.rank, {
    length: 5,
    size: 5,
    low: st.low,
    suit,
    wilds: wilds.length,
  });
}

/**
 * 连对：恰好 6 张（三连对）。更长不算。
 * @param {object[]} cards
 * @param {string} levelRank
 * @returns {object|null}
 */
export function asPairSeq(cards, levelRank) {
  const n = cards.length;
  // 桌规：连对最多 6 张（三连对），不能四连对及以上
  if (n !== 6) return null;
  const pairs = 3;
  const { wilds, jokers, naturals } = split(cards, levelRank);
  if (jokers.length) return null;
  const g = groupNaturals(naturals);
  for (const [, arr] of g) if (arr.length > 2) return null;

  for (const win of sequenceWindows(pairs)) {
    let need = 0;
    let ok = true;
    for (const r of win) {
      const have = g.get(r)?.length || 0;
      if (have > 2) {
        ok = false;
        break;
      }
      need += 2 - have;
    }
    for (const r of g.keys()) {
      if (!win.includes(r)) {
        ok = false;
        break;
      }
    }
    if (ok && need === wilds.length) {
      return combo(TYPES.PAIR_SEQ, win[pairs - 1], {
        length: pairs,
        size: n,
        low: win[0],
        wilds: wilds.length,
      });
    }
  }
  return null;
}

/**
 * 钢板：恰好 6 张（两组三张）。更长不算。
 * @param {object[]} cards
 * @param {string} levelRank
 * @returns {object|null}
 */
export function asTripleSeq(cards, levelRank) {
  const n = cards.length;
  // 桌规：钢板最多 6 张（两组三张），不能三连飞机
  if (n !== 6) return null;
  const trips = 2;
  const { wilds, jokers, naturals } = split(cards, levelRank);
  if (jokers.length) return null;
  const g = groupNaturals(naturals);
  for (const [, arr] of g) if (arr.length > 3) return null;

  for (const win of sequenceWindows(trips)) {
    let need = 0;
    let ok = true;
    for (const r of win) {
      const have = g.get(r)?.length || 0;
      if (have > 3) {
        ok = false;
        break;
      }
      need += 3 - have;
    }
    for (const r of g.keys()) {
      if (!win.includes(r)) {
        ok = false;
        break;
      }
    }
    if (ok && need === wilds.length) {
      return combo(TYPES.TRIPLE_SEQ, win[trips - 1], {
        length: trips,
        size: n,
        low: win[0],
        wilds: wilds.length,
      });
    }
  }
  return null;
}

const TRY_ORDER = [
  asStraightFlush,
  asBomb,
  asTripleSeq,
  asPairSeq,
  asStraight,
  asFullHouse,
  asTriple,
  asPair,
  asSingle,
];

/**
 * 识别一手牌。若可能多解，优先：同花顺 > 炸弹 > 钢板 > 连对 > 顺子 > 三带二 > …
 * 跟牌时请用 interpretAs 指定类型。空数组为过牌。
 * @param {object[]|null|undefined} cards
 * @param {string} levelRank
 * @returns {object|null}
 */
export function classify(cards, levelRank) {
  if (!cards || cards.length === 0) return passCombo();
  for (const fn of TRY_ORDER) {
    const c = fn(cards, levelRank);
    if (c) return c;
  }
  return null;
}

/**
 * 按指定类型识别（跟牌用）。
 * @param {object[]} cards
 * @param {string} type
 * @param {string} levelRank
 * @returns {object|null}
 */
export function interpretAs(cards, type, levelRank) {
  if (type === TYPES.PASS) return cards.length === 0 ? passCombo() : null;
  const map = {
    [TYPES.SINGLE]: asSingle,
    [TYPES.PAIR]: asPair,
    [TYPES.TRIPLE]: asTriple,
    [TYPES.FULLHOUSE]: asFullHouse,
    [TYPES.STRAIGHT]: asStraight,
    [TYPES.PAIR_SEQ]: asPairSeq,
    [TYPES.TRIPLE_SEQ]: asTripleSeq,
    [TYPES.BOMB]: asBomb,
    [TYPES.STRAIGHT_FLUSH]: asStraightFlush,
  };
  const fn = map[type];
  if (!fn) return null;
  return fn(cards, levelRank);
}

/**
 * 炸弹或同花顺。
 * @param {{ type: string }|null|undefined} combo
 * @returns {boolean}
 */
export function isBombLike(combo) {
  return combo && (combo.type === TYPES.BOMB || combo.type === TYPES.STRAIGHT_FLUSH);
}
