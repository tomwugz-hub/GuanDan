/* 掼蛋教练浏览器打包（无外部 CDN） */
(function (global) {
const weights = {
  "bias": 0.1,
  "w": {
    "size": 0.35,
    "isBomb": -1.8,
    "isSF": -2.2,
    "isPass": -0.2,
    "isPairSeq": 0.9,
    "isTripleSeq": 1.0,
    "isStraight": 0.55,
    "goOut": 4.5,
    "smallLead": 0.2,
    "control": 0.4,
    "wasteBomb": -8.0,
    "crushPartner": -6.0,
    "firstLeadBomb": -7.0,
    "exposeVsTwo": -3.5,
    "splitStruct": -2.8,
    "keepTrash": -2.0
  }
}
;

/* ---- engine/ranks.js ---- */
/**
 * 掼蛋点数与级牌顺序。
 * 单张大小：红Joker > 黑Joker > 级牌 > A > K > … > 3 > 2（2 为级牌时除外）。
 * 逢人配：仅红桃级牌（suit === 'H'）可替其他点数；两副牌最多两张。其余花色级牌只是普通级牌。王牌不是逢人配。
 */

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const JOKER_BLACK = 'BJ';
const JOKER_RED = 'RJ';
const SUITS = ['S', 'H', 'D', 'C'];

/** 顺子/连对/钢板用的自然点数链（不含王牌；2 只作链底，不与 A 相连）。 */
const SEQ_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/**
 * 是否王牌点数。
 * @param {string} rank
 * @returns {boolean}
 */
function isJokerRank(rank) {
  return rank === JOKER_BLACK || rank === JOKER_RED;
}

/**
 * 是否逢人配：仅红桃当前级牌。王牌不是逢人配。
 * @param {{ rank: string, suit: string }} card
 * @param {string} levelRank
 * @returns {boolean}
 */
function isWildCard(card, levelRank) {
  return !isJokerRank(card.rank) && card.rank === levelRank && card.suit === 'H';
}

/**
 * 单张比较用的数值，越大越大。级牌高于 A、低于王牌。
 * @param {string} rank
 * @param {string} levelRank
 * @returns {number}
 * @throws {Error} 未知点数
 */
function singleStrength(rank, levelRank) {
  if (rank === JOKER_RED) return 100;
  if (rank === JOKER_BLACK) return 99;
  if (rank === levelRank) return 80;
  const i = RANKS.indexOf(rank);
  if (i < 0) throw new Error(`未知点数: ${rank}`);
  return i; // 2=0 … A=12
}

/**
 * 顺子链下标（2=0 … A=12）。
 * @param {string} rank
 * @returns {number}
 * @throws {Error} 王牌或不在链上
 */
function seqIndex(rank) {
  const i = SEQ_RANKS.indexOf(rank);
  if (i < 0) throw new Error(`不能进入顺子链: ${rank}`);
  return i;
}

/**
 * 下一级牌；已是 A 则仍为 A。
 * @param {string} levelRank
 * @returns {string}
 */
function nextLevelRank(levelRank) {
  if (levelRank === 'A') return 'A';
  const i = RANKS.indexOf(levelRank);
  return RANKS[i + 1];
}

/**
 * 校验并返回级牌。
 * @param {string} levelRank
 * @returns {string}
 * @throws {Error} 非法级牌
 */
function parseLevel(levelRank) {
  if (!RANKS.includes(levelRank)) throw new Error(`非法级牌: ${levelRank}`);
  return levelRank;
}


/* ---- engine/cards.js ---- */
/**
 * 掼蛋牌面：两副 108 张。
 */

let _id = 1;

/**
 * 构造一张牌。
 * @param {string} rank
 * @param {string} suit
 * @param {number} [id]
 * @returns {{ rank: string, suit: string, id: number }}
 */
function card(rank, suit, id) {
  return { rank, suit, id: id ?? _id++ };
}

/**
 * 牌的稳定键（点数+花色+id）。
 * @param {{ rank: string, suit: string, id: number }} c
 * @returns {string}
 */
function cardKey(c) {
  return `${c.rank}${c.suit}#${c.id}`;
}

/**
 * 牌面短字（如 AH / RJ）。
 * @param {{ rank: string, suit: string }} c
 * @returns {string}
 */
function formatCard(c) {
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
function parseCard(token) {
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
function cards(...tokens) {
  const parts = tokens.flatMap((x) =>
    Array.isArray(x) ? x : String(x).split(/[\s,]+/).filter(Boolean),
  );
  return parts.map((p) => (typeof p === 'object' ? p : parseCard(p)));
}

/**
 * 两副 108 张。
 * @returns {object[]}
 */
function makeDeck() {
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
function shuffle(arr, rng = Math.random) {
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
function dealFourHands(deck = shuffle(makeDeck())) {
  if (deck.length !== 108) throw new Error('掼蛋必须 108 张');
  return [0, 1, 2, 3].map((i) => deck.slice(i * 27, i * 27 + 27));
}

/**
 * 按点数计数。
 * @param {object[]} list
 * @returns {Map<string, number>}
 */
function countByRank(list) {
  const m = new Map();
  for (const c of list) m.set(c.rank, (m.get(c.rank) || 0) + 1);
  return m;
}

/**
 * 是否王牌。
 * @param {{ rank: string }} c
 * @returns {boolean}
 */
function isJoker(c) {
  return isJokerRank(c.rank);
}


/* ---- engine/combos.js ---- */
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

const TYPES = {
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
function passCombo() {
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
function asSingle(cards, levelRank) {
  if (cards.length !== 1) return null;
  return combo(TYPES.SINGLE, cards[0].rank, { length: 1, size: 1 });
}

/**
 * @param {object[]} cards
 * @param {string} levelRank
 * @returns {object|null}
 */
function asPair(cards, levelRank) {
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
function asTriple(cards, levelRank) {
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
function asBomb(cards, levelRank) {
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
function asFullHouse(cards, levelRank) {
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
  const out = [];
  for (let start = 0; start + len <= SEQ_RANKS.length; start++) {
    out.push(SEQ_RANKS.slice(start, start + len));
  }
  return out;
}

/**
 * 恰好 5 张顺子。
 * @param {object[]} cards
 * @param {string} levelRank
 * @returns {object|null}
 */
function asStraight(cards, levelRank) {
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
function asStraightFlush(cards, levelRank) {
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
function asPairSeq(cards, levelRank) {
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
function asTripleSeq(cards, levelRank) {
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
function classify(cards, levelRank) {
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
function interpretAs(cards, type, levelRank) {
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
function isBombLike(combo) {
  return combo && (combo.type === TYPES.BOMB || combo.type === TYPES.STRAIGHT_FLUSH);
}


/* ---- engine/compare.js ---- */
/**
 * 掼蛋牌型比较。
 * 普通牌型只能压同型同长度。
 * 炸弹/同花顺可压普通牌。
 * 炸弹层级：5 炸 < 同花顺 < 6 炸；同长度炸弹比点数；同花顺比最大点。
 */


/**
 * 炸弹“重量”：同花顺记 5.5；5 炸 < 同花顺 < 6 炸。
 * @param {{ type: string, bombSize?: number, size?: number }|null|undefined} combo
 * @returns {number}
 */
function bombWeight(combo) {
  if (!combo) return 0;
  if (combo.type === TYPES.STRAIGHT_FLUSH) return 5.5;
  if (combo.type === TYPES.BOMB) return combo.bombSize ?? combo.size;
  return 0;
}

/**
 * 比较两个点数（含级牌/王牌）。
 * @param {string} aRank
 * @param {string} bRank
 * @param {string} levelRank
 * @returns {number}
 * @throws {Error} 未知点数
 */
function compareRank(aRank, bRank, levelRank) {
  return singleStrength(aRank, levelRank) - singleStrength(bRank, levelRank);
}

/**
 * 比较两手牌型。不同类型且皆非炸则 NaN。
 * @param {object|null|undefined} a
 * @param {object|null|undefined} b
 * @param {string} levelRank
 * @returns {number} 正数 a 大于 b，负数 a 小于 b，0 相等；不可比则为 NaN
 */
function compareCombos(a, b, levelRank) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  if (a.type === TYPES.PASS && b.type === TYPES.PASS) return 0;
  if (a.type === TYPES.PASS) return -1;
  if (b.type === TYPES.PASS) return 1;

  const aB = isBombLike(a);
  const bB = isBombLike(b);

  if (aB && bB) {
    const dw = bombWeight(a) - bombWeight(b);
    if (dw !== 0) return dw;
    return compareRank(a.rank, b.rank, levelRank);
  }
  if (aB && !bB) return 1;
  if (!aB && bB) return -1;

  if (a.type !== b.type) return NaN;
  if ((a.length ?? a.size) !== (b.length ?? b.size)) return NaN;
  if (a.size !== b.size && a.type !== TYPES.BOMB) return NaN;
  return compareRank(a.rank, b.rank, levelRank);
}

/**
 * a 能否压过 b（b 为桌上牌；领出时 b 为 null）。
 * @param {object|null|undefined} a
 * @param {object|null|undefined} b
 * @param {string} levelRank
 * @returns {boolean}
 */
function beats(a, b, levelRank) {
  if (!a || a.type === TYPES.PASS) return false;
  if (!b || b.type === TYPES.PASS) return true;
  const c = compareCombos(a, b, levelRank);
  if (Number.isNaN(c)) return false;
  return c > 0;
}


/* ---- engine/legal.js ---- */
/**
 * 掼蛋合法出牌：领出任意合法牌型；跟牌须同型更大，或炸弹/同花顺可压，或 PASS。
 */



/**
 * 是否合法出牌（领出任意合法型；跟牌须同型更大或炸/同花顺或过）。
 * @param {object[]} cards
 * @param {object|null|undefined} previous
 * @param {string} levelRank
 * @param {{ leading?: boolean }} [opts]
 * @returns {boolean}
 */
function isLegalPlay(cards, previous, levelRank, { leading = false } = {}) {
  if (!cards || cards.length === 0) {
    return !leading;
  }
  const combo = classify(cards, levelRank);
  if (!combo || combo.type === TYPES.PASS) return false;
  if (leading || !previous || previous.type === TYPES.PASS) return true;
  return beats(combo, previous, levelRank);
}

/**
 * 校验一次出牌并返回牌型。
 * @param {object[]} cards
 * @param {object|null|undefined} previous
 * @param {string} levelRank
 * @param {boolean} [leading]
 * @returns {{ ok: boolean, reason?: string, combo?: object }}
 */
function playAction(cards, previous, levelRank, leading = false) {
  if (!cards || cards.length === 0) {
    if (leading) return { ok: false, reason: '领出不能过牌' };
    return { ok: true, combo: passCombo() };
  }
  const combo = classify(cards, levelRank);
  if (!combo) return { ok: false, reason: '不能组成合法牌型' };
  if (!leading && previous && previous.type !== TYPES.PASS && !beats(combo, previous, levelRank)) {
    return { ok: false, reason: '压不过桌上的牌', combo };
  }
  return { ok: true, combo };
}

/**
 * 生成若干合法出法（按点数分组，非全子集爆炸搜索）。
 * 覆盖：过牌、单/对/三/炸、三带二、5 张顺/同花顺，以及跟牌时同长度子集。
 * @param {object[]} hand
 * @param {object|null|undefined} previous
 * @param {string} levelRank
 * @param {boolean} [leading]
 * @returns {{ cards: object[], combo: object }[]}
 */
function legalMoves(hand, previous, levelRank, leading = false) {
  const moves = [];
  if (!leading && previous) moves.push({ cards: [], combo: passCombo() });

  const groups = new Map();
  const wilds = [];
  for (const c of hand) {
    if (!isJokerRank(c.rank) && isWildCard(c, levelRank)) wilds.push(c);
    else {
      if (!groups.has(c.rank)) groups.set(c.rank, []);
      groups.get(c.rank).push(c);
    }
  }

  const emit = (cards) => {
    const combo = classify(cards, levelRank);
    if (!combo) return;
    if (leading || !previous || previous.type === TYPES.PASS || beats(combo, previous, levelRank)) {
      moves.push({ cards, combo });
    }
  };

  for (const [, arr] of groups) {
    for (let k = 1; k <= arr.length; k++) emit(arr.slice(0, k));
    for (let w = 1; w <= Math.min(2, wilds.length); w++) {
      for (let k = 1; k <= arr.length; k++) {
        if (k + w >= 2) emit(arr.slice(0, k).concat(wilds.slice(0, w)));
      }
    }
  }
  if (wilds.length) {
    for (let w = 1; w <= Math.min(2, wilds.length); w++) emit(wilds.slice(0, w));
  }

  // 领出：三带二（一组三条 + 一组对子，配牌最多 2）
  const ranks = [...groups.keys()];
  for (let i = 0; i < ranks.length; i++) {
    for (let j = 0; j < ranks.length; j++) {
      if (i === j) continue;
      const tRank = ranks[i];
      const pRank = ranks[j];
      const tArr = groups.get(tRank);
      const pArr = groups.get(pRank);
      for (let tw = 0; tw <= Math.min(2, wilds.length); tw++) {
        const tNeed = 3 - tw;
        if (tNeed < 1 || tArr.length < tNeed) continue;
        const leftW = wilds.length - tw;
        for (let pw = 0; pw <= leftW; pw++) {
          if (tw + pw > 2) continue;
          const pNeed = 2 - pw;
          if (pNeed < 1 || pArr.length < pNeed) continue;
          const pile = tArr.slice(0, tNeed).concat(pArr.slice(0, pNeed)).concat(wilds.slice(0, tw + pw));
          if (pile.length === 5) emit(pile);
        }
      }
    }
  }

  // 恰好 5 张顺子 / 同花顺
  const byRank = groups;
  for (let i = 0; i + 5 <= SEQ_RANKS.length; i++) {
    const win = SEQ_RANKS.slice(i, i + 5);
    const cards = [];
    let need = 0;
    let ok = true;
    for (const r of win) {
      const arr = byRank.get(r) || [];
      if (arr.length) cards.push(arr[0]);
      else need += 1;
    }
    if (need <= wilds.length && cards.length + need === 5) {
      emit(cards.concat(wilds.slice(0, need)));
    }
    for (const suit of ["S", "H", "D", "C"]) {
      const pile = [];
      let wneed = 0;
      for (const r of win) {
        const arr = (byRank.get(r) || []).filter((c) => c.suit === suit);
        if (arr.length) pile.push(arr[0]);
        else wneed += 1;
      }
      if (wneed <= wilds.length && pile.length + wneed === 5) {
        emit(pile.concat(wilds.slice(0, wneed)));
      }
    }
  }

  // 跟牌子集：恰好 previous.size 张（≤8）。size===6 跳过——连对/钢板由 extraStructureMoves 生成，6 炸已由同点循环生成；generateCandidates 的 uniqueMoves 也会去重重叠。
  if (!leading && previous && previous.size > 0 && previous.size <= 8 && previous.size !== 6 && hand.length <= 16) {
    const n = hand.length;
    const target = previous.size;
    const rec = (i, chosen) => {
      if (chosen.length === target) {
        emit(chosen.slice());
        return;
      }
      if (i >= n || chosen.length + (n - i) < target) return;
      chosen.push(hand[i]);
      rec(i + 1, chosen);
      chosen.pop();
      rec(i + 1, chosen);
    };
    rec(0, []);
  }

  const seen = new Set();
  return moves.filter((m) => {
    const key = m.cards.map((c) => c.id).sort().join(',') + ':' + m.combo.type;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}



/* ---- engine/tribute.js ---- */
/**
 * 掼蛋进贡 / 还贡 / 抗贡 / 双下。
 *
 * 座位 0 与 2 一家，1 与 3 一家。
 * finishOrder: 头游→末游 的座位号。
 *
 * 标准桌规（宿迁）：下游进贡给上游（输家给赢家）。
 * - 双下（头游+二游同队）：0
 * - 头游+末游同队（1、4 名）：1（末游 → 头游）
 * - 头游+三游同队（1、3 名）：2（末游 → 头游，三游 → 二游）
 * 官方 2022 仅多一处已编码差：双下为双贡（两名下游分别向上游方进贡，大贡归头游）。
 * 抗贡集体、红心级牌除外、无≤10则还最小、同点顺时针等官方桌仪不声称。
 *
 * 进贡牌：进贡方最大非王。
 * 抗贡：该对进贡方（付款人）持有两张大王则该对不进贡。
 * 还贡：收贡方还一张自然点 ≤10 的牌（不能是王、不能是级牌）。两贡则两还。
 * applyTributes 可传入 returns 指定还贡牌；非法或缺省则自动还最小合法牌。
 */

/**
 * 座位所属队：0/2 一家，1/3 一家。
 * @param {number} seat
 * @returns {number}
 */
function teamOf(seat) {
  return seat % 2;
}

/**
 * 拆头/二/三/末游。
 * @param {number[]} finishOrder
 * @returns {{ head: number, second: number, third: number, tail: number }}
 * @throws {Error} 不是 4 个座位
 */
function finishRoles(finishOrder) {
  if (!finishOrder || finishOrder.length !== 4) throw new Error('finishOrder 必须 4 个座位');
  const [head, second, third, tail] = finishOrder;
  return { head, second, third, tail };
}

/**
 * 头游与二游同队即为双下。
 * @param {number[]} finishOrder
 * @returns {boolean}
 * @throws {Error} finishOrder 非法
 */
function isDoubleDown(finishOrder) {
  const { head, second } = finishRoles(finishOrder);
  return teamOf(head) === teamOf(second);
}

/**
 * 进贡计划：下游给上游。
 * 宿迁：双下 0；头+末同队 1；头+三同队 2。
 * 官方 2022：双下为双贡（两名下游分别向上游方进贡；大贡归头游在 apply/preview 里按牌点配对）。
 * @param {number[]} finishOrder
 * @param {{ officialDoubleTribute?: boolean }} [opts]
 * @returns {{ count: number, pairs: { from: number, to: number }[], doubleDown: boolean, officialDoubleTribute?: boolean, reason: string }}
 * @throws {Error} finishOrder 非法
 */
function tributePlan(finishOrder, { officialDoubleTribute = false } = {}) {
  const { head, second, third, tail } = finishRoles(finishOrder);
  if (isDoubleDown(finishOrder)) {
    if (officialDoubleTribute) {
      return {
        count: 2,
        pairs: [
          { from: third, to: head },
          { from: tail, to: second },
        ],
        doubleDown: true,
        officialDoubleTribute: true,
        reason: '官方双下双贡：两名下游分别向上游方进贡（大贡归头游）',
      };
    }
    return { count: 0, pairs: [], doubleDown: true, reason: '双下不进贡' };
  }
  if (teamOf(head) === teamOf(tail)) {
    return {
      count: 1,
      pairs: [{ from: tail, to: head }],
      doubleDown: false,
      reason: '头游+末游同队，末游进贡头游',
    };
  }
  return {
    count: 2,
    pairs: [
      { from: tail, to: head },
      { from: third, to: second },
    ],
    doubleDown: false,
    reason: '头游+三游同队，末游进贡头游、三游进贡二游',
  };
}

/**
 * 最大非王（按自然点，级牌当 3 比较——仅内部兜底）。
 * @param {object[]} hand
 * @returns {object|null}
 */
function highestNonJoker(hand) {
  const pool = hand.filter((c) => !isJokerRank(c.rank));
  if (!pool.length) return null;
  return pool.reduce((best, c) =>
    singleStrength(c.rank, '3') > singleStrength(best.rank, '3') ? c : best,
  );
}

/**
 * 进贡选牌：最大非王（级牌按当前级比较）。
 * @param {object[]} hand
 * @param {string} [levelRank]
 * @returns {object|null}
 */
function pickTributeCard(hand, levelRank = '2') {
  const pool = hand.filter((c) => !isJokerRank(c.rank));
  if (!pool.length) return null;
  return pool.reduce((best, c) =>
    singleStrength(c.rank, levelRank) > singleStrength(best.rank, levelRank) ? c : best,
  );
}

/**
 * 手中大王张数。
 * @param {object[]} hand
 * @returns {number}
 */
function countRedJokers(hand) {
  return hand.filter((c) => c.rank === JOKER_RED).length;
}

/**
 * 进贡方持双大王则该对抗贡。
 * @param {object[]|null|undefined} hand
 * @returns {boolean}
 */
function pairResists(hand) {
  return countRedJokers(hand || []) >= 2;
}

/**
 * 是否存在至少一对进贡方可抗贡。
 * @param {object[][]} hands
 * @param {{ count: number, pairs: { from: number }[] }} plan
 * @returns {boolean}
 */
function canResistTribute(hands, plan) {
  if (!plan.count) return false;
  return plan.pairs.some((p) => pairResists(hands[p.from] || []));
}

/**
 * 还贡合法：自然点 ≤10，非王、非级牌。
 * @param {{ rank: string }|null|undefined} card
 * @param {string} levelRank
 * @returns {boolean}
 */
function isLegalReturnCard(card, levelRank) {
  if (!card) return false;
  if (isJokerRank(card.rank)) return false;
  if (card.rank === levelRank) return false;
  const order = ['2', '3', '4', '5', '6', '7', '8', '9', '10'];
  return order.includes(card.rank);
}

/**
 * 自动还贡：最小合法还贡牌。
 * @param {object[]} hand
 * @param {string} levelRank
 * @param {Set<number>} [exceptIds]
 * @returns {object|null}
 */
function pickReturnCard(hand, levelRank, exceptIds = new Set()) {
  const legal = legalReturnCards(hand, levelRank, exceptIds);
  if (!legal.length) return null;
  return legal.reduce((best, c) =>
    singleStrength(c.rank, levelRank) < singleStrength(best.rank, levelRank) ? c : best,
  );
}

/**
 * 还贡合法牌列表（自然点 ≤10，非王非级牌）。
 * @param {object[]} hand
 * @param {string} levelRank
 * @param {Set<number>} [exceptIds]
 * @returns {object[]}
 */
function legalReturnCards(hand, levelRank, exceptIds = new Set()) {
  return (hand || []).filter((c) => isLegalReturnCard(c, levelRank) && !exceptIds.has(c.id));
}

/**
 * 官方双贡：大贡归头游、小贡归二游。同点保持计划顺序（顺时针桌仪不声称）。
 * @param {object[][]} hands
 * @param {{ pairs?: { from: number, to: number }[], officialDoubleTribute?: boolean }} plan
 * @param {string} levelRank
 * @returns {{ from: number, to: number }[]}
 */
function resolveTributePairs(hands, plan, levelRank) {
  const pairs = (plan.pairs || []).slice();
  if (!plan.officialDoubleTribute || pairs.length !== 2) return pairs;
  const head = pairs[0].to;
  const second = pairs[1].to;
  const ranked = pairs.map((p) => ({
    from: p.from,
    card: pickTributeCard(hands[p.from] || [], levelRank),
  }));
  ranked.sort((a, b) => {
    const sa = a.card ? singleStrength(a.card.rank, levelRank) : -1;
    const sb = b.card ? singleStrength(b.card.rank, levelRank) : -1;
    return sb - sa;
  });
  return [
    { from: ranked[0].from, to: head },
    { from: ranked[1].from, to: second },
  ];
}

/**
 * 预览进贡/还贡（不改手牌）：谁进贡、谁抗贡、谁还贡及合法还贡牌。
 * @param {object[][]} hands
 * @param {{ count: number, pairs: { from: number, to: number }[], officialDoubleTribute?: boolean }} plan
 * @param {{ levelRank?: string, resist?: boolean }} [opts]
 * @returns {{ pairs: object[], resistedPairs: object[], needReturn: boolean }}
 */
function previewTributes(hands, plan, { levelRank = '2', resist = undefined } = {}) {
  if (!plan || !plan.count) {
    return { pairs: [], resistedPairs: [], needReturn: false };
  }
  const pairs = resolveTributePairs(hands, plan, levelRank);
  const forceAll = resist === true;
  const items = [];
  const resistedPairs = [];
  pairs.forEach((pair, i) => {
    const { from, to } = pair;
    const thisResist = forceAll || pairResists(hands[from] || []);
    if (thisResist) {
      resistedPairs.push({ from, to, index: i });
      return;
    }
    const tribute = pickTributeCard(hands[from] || [], levelRank);
    if (!tribute) return;
    const except = new Set([tribute.id]);
    const legal = legalReturnCards(hands[to] || [], levelRank, except);
    const auto = pickReturnCard(hands[to] || [], levelRank, except);
    items.push({
      index: i,
      from,
      to,
      tribute,
      returnFrom: to,
      returnTo: from,
      legal,
      auto,
    });
  });
  return { pairs: items, resistedPairs, needReturn: items.some((x) => x.legal.length > 0) };
}

/**
 * 移动进贡牌并还贡。
 * @param {object[][]} hands
 * @param {{ count: number, pairs: { from: number, to: number }[] }} plan
 * @param {{ levelRank?: string, resist?: boolean, returns?: object[] }} [opts] returns 按 resolve 后的 pair 下标；非法/缺省回退自动最小牌
 * @returns {{ hands: object[][], moved: object[], returned: object[], resisted: boolean, resistedPairs: object[] }}
 */
function applyTributes(hands, plan, { levelRank = '2', resist = undefined, returns = [] } = {}) {
  const next = hands.map((h) => h.slice());
  if (!plan.count) {
    return { hands: next, moved: [], returned: [], resisted: true, resistedPairs: [] };
  }
  const forceAll = resist === true;
  const moved = [];
  const returned = [];
  const resistedPairs = [];
  const pairs = resolveTributePairs(next, plan, levelRank);

  pairs.forEach((pair, i) => {
    const { from, to } = pair;
    const thisResist = forceAll || pairResists(next[from]);
    if (thisResist) {
      resistedPairs.push({ from, to });
      return;
    }
    const c = pickTributeCard(next[from], levelRank);
    if (!c) return;
    next[from] = next[from].filter((x) => x.id !== c.id);
    next[to] = next[to].concat(c);
    moved.push({ from, to, card: c });

    let ret = null;
    const chosen = returns[i];
    if (chosen && chosen.id != null) {
      const found = next[to].find((x) => x.id === chosen.id);
      if (found && isLegalReturnCard(found, levelRank)) ret = found;
    } else if (chosen && chosen.rank) {
      const found = next[to].find((x) => x.rank === chosen.rank && x.suit === chosen.suit && isLegalReturnCard(x, levelRank));
      if (found) ret = found;
    }
    if (!ret) {
      ret = pickReturnCard(next[to], levelRank, new Set([c.id]));
    }
    if (ret) {
      next[to] = next[to].filter((x) => x.id !== ret.id);
      next[from] = next[from].concat(ret);
      returned.push({ from: to, to: from, card: ret });
    }
  });

  const resisted = moved.length === 0 && resistedPairs.length > 0;
  return { hands: next, moved, returned, resisted, resistedPairs };
}


/* ---- engine/rulesets.js ---- */
/**
 * 规则集开关。默认宿迁地方规则。
 * 与官方 2022 至少三处不同：过 A、过 A 之后、过 A 失败。
 */
const RULESETS = {
  SUQIAN: 'suqian',
  OFFICIAL_2022: 'official2022',
};

/**
 * 默认规则集 id（宿迁）。
 * @returns {string}
 */
function defaultRuleset() {
  return RULESETS.SUQIAN;
}

/**
 * 规则集配置。
 * @param {string} [id]
 * @returns {{ id: string, name: string, passARequiresDoubleDown: boolean, failPassAResetTo2: boolean, afterPassA: string, endMatchOnAnyWinAtA: boolean, bombsBeatStraightFlushFrom: number }}
 */
function rulesetConfig(id = RULESETS.SUQIAN) {
  if (id === RULESETS.OFFICIAL_2022) {
    return {
      id,
      name: '官方竞技 2022',
      passARequiresDoubleDown: false,
      failPassAResetTo2: false,
      afterPassA: 'endMatch',
      endMatchOnAnyWinAtA: true,
      bombsBeatStraightFlushFrom: 6,
    };
  }
  return {
    id: RULESETS.SUQIAN,
    name: '宿迁地方规则',
    passARequiresDoubleDown: true,
    failPassAResetTo2: true,
    afterPassA: 'resetIfNotDoubleDown',
    endMatchOnAnyWinAtA: false,
    bombsBeatStraightFlushFrom: 6,
  };
}


/* ---- engine/state.js ---- */
/**
 * 掼蛋一桌对局状态：级牌、过牌、出牌校验、升级与过 A（宿迁）。
 *
 * 过 A（宿迁）：
 * - 打 A 时必须双下才算过 A 胜利（整局结束）。
 * - 打 A 赢了但非双下：不算过 A，本桌打回 2，头游吃贡（不进贡给末游）。
 * - 打 A 输了：失败方回 2，台上对方打 2。
 */






const SEATS = 4;

/**
 * 创建一桌比赛状态。
 * @param {{ ruleset?: string, levelRank?: string, defenderTeam?: number }} [opts]
 * @returns {object}
 * @throws {Error} 非法级牌
 */
function createMatch({
  ruleset = RULESETS.SUQIAN,
  levelRank = '2',
  defenderTeam = 0,
} = {}) {
  parseLevel(levelRank);
  return {
    ruleset,
    config: rulesetConfig(ruleset),
    levelRank,
    defenderTeam,
    teamLevel: [levelRank, levelRank],
    matchOver: false,
    winnerTeam: null,
    history: [],
  };
}

/**
 * 发一副并创建 round。
 * @param {object} match
 * @param {{ dealerSeat?: number, hands?: object[][]|null, rng?: () => number }} [opts]
 * @returns {object}
 */
function createRound(match, { dealerSeat = 0, hands = null, rng } = {}) {
  const dealt = hands || dealFourHands(shuffle(makeDeck(), rng));
  return {
    match,
    hands: dealt,
    currentSeat: dealerSeat,
    leadSeat: dealerSeat,
    lastCombo: null,
    lastPlayer: null,
    passCount: 0,
    finished: [],
    tricks: [],
    tributeEatenByHead: false,
  };
}

/**
 * 校验并应用一次出牌（会改 round）。
 * @param {object} round
 * @param {number} seat
 * @param {object[]} cards
 * @returns {{ ok: boolean, reason?: string, combo?: object, pass?: boolean, finished?: boolean, finishOrder?: number[] }}
 */
function applyPlay(round, seat, cards) {
  if (seat !== round.currentSeat) return { ok: false, reason: '不是该座位出牌' };
  if (round.finished.includes(seat)) return { ok: false, reason: '已出完' };
  const leading = !round.lastCombo || round.lastCombo.type === TYPES.PASS;
  if (!cards || cards.length === 0) {
    if (leading) return { ok: false, reason: '领出不能过牌' };
    round.passCount += 1;
    const next = nextActive(round, seat);
    if (round.passCount >= activeCount(round) - 1) {
      // 其他人全过，lastPlayer 再领
      round.lastCombo = null;
      round.passCount = 0;
      round.currentSeat = nextActive(round, round.lastPlayer);
      round.leadSeat = round.currentSeat;
    } else {
      round.currentSeat = next;
    }
    return { ok: true, combo: { type: TYPES.PASS }, pass: true };
  }

  if (!cards.every((c) => round.hands[seat].some((h) => h.id === c.id))) {
    return { ok: false, reason: '手牌中没有这些牌' };
  }
  const combo = classify(cards, round.match.levelRank);
  if (!combo) return { ok: false, reason: '不能组成合法牌型' };
  if (!leading && !beats(combo, round.lastCombo, round.match.levelRank)) {
    return { ok: false, reason: '压不过' };
  }

  round.hands[seat] = round.hands[seat].filter((h) => !cards.some((c) => c.id === h.id));
  round.lastCombo = combo;
  round.lastPlayer = seat;
  round.passCount = 0;
  round.tricks.push({ seat, cards, combo });

  if (round.hands[seat].length === 0) {
    round.finished.push(seat);
  }
  if (round.finished.length >= 3) {
    const left = [0, 1, 2, 3].find((s) => !round.finished.includes(s));
    round.finished.push(left);
    return { ok: true, combo, finished: true, finishOrder: round.finished.slice() };
  }
  round.currentSeat = nextActive(round, seat);
  return { ok: true, combo };
}

function activeCount(round) {
  return 4 - round.finished.length;
}

function nextActive(round, seat) {
  for (let i = 1; i <= 4; i++) {
    const s = (seat + i) % 4;
    if (!round.finished.includes(s)) return s;
  }
  return seat;
}

/**
 * 一局结束：升级 + 过 A。
 * @param {object} match
 * @param {number[]} finishOrder
 * @returns {{ match: object, tribute: object, passA: boolean, resetTo2: boolean, headEatsTribute: boolean, message: string }}
 */
function applyGameResult(match, finishOrder) {
  const cfg = match.config;
  const head = finishOrder[0];
  const winTeam = teamOf(head);
  const loseTeam = 1 - winTeam;
  const dd = isDoubleDown(finishOrder);
  const atA = match.teamLevel[winTeam] === 'A' || match.levelRank === 'A';

  const tribute = tributePlan(finishOrder, {
    officialDoubleTribute: cfg.id === RULESETS.OFFICIAL_2022,
  });
  let message = '';
  let passA = false;
  let resetTo2 = false;
  let headEatsTribute = false;

  if (cfg.passARequiresDoubleDown && match.levelRank === 'A') {
    if (dd && winTeam === match.defenderTeam) {
      passA = true;
      match.matchOver = true;
      match.winnerTeam = winTeam;
      message = '双下过 A，本局胜利';
    } else if (dd && winTeam !== match.defenderTeam) {
      // 对方在自己打 A 时双下：对方过 A
      passA = true;
      match.matchOver = true;
      match.winnerTeam = winTeam;
      message = '对方双下过 A';
    } else if (winTeam === match.defenderTeam && !dd) {
      // 打 A 赢但未双下：不算过 A，回 2，头游吃贡
      resetTo2 = true;
      headEatsTribute = true;
      match.teamLevel = ['2', '2'];
      match.levelRank = '2';
      match.defenderTeam = winTeam;
      tribute.count = 0;
      tribute.pairs = [];
      tribute.eatenByHead = true;
      message = '过 A 未双下，回打 2，头游吃贡';
    } else {
      // 打 A 的一方输了
      resetTo2 = true;
      match.teamLevel = ['2', '2'];
      match.levelRank = '2';
      match.defenderTeam = winTeam;
      message = '过 A 失败，台上对方打 2';
    }
  } else {
    const steps = dd ? 2 : 1;
    match.teamLevel[winTeam] = bumpLevel(match.teamLevel[winTeam], steps);
    match.levelRank = match.teamLevel[winTeam];
    match.defenderTeam = winTeam;
    if (cfg.endMatchOnAnyWinAtA && (match.levelRank === 'A' || atA)) {
      // 官方：打 A 任意获胜即可过 A，不必双下；失败也不回 2
      passA = true;
      match.matchOver = true;
      match.winnerTeam = winTeam;
      message = '官方规则：打 A 获胜即过 A（不必双下）';
    } else {
      message = dd ? `双下，升 ${steps} 级` : `升 ${steps} 级`;
    }
  }

  match.history.push({ finishOrder, tribute, passA, resetTo2, message });
  return { match, tribute, passA, resetTo2, headEatsTribute, message };
}

function bumpLevel(cur, steps) {
  let i = RANKS.indexOf(cur);
  i = Math.min(RANKS.length - 1, i + steps);
  return RANKS[i];
}



/* ---- belief/index.js ---- */
/**
 * 信念层：只做推断（余牌、关键牌、对手模型），不做决策。
 */



const STYLES = ['tight', 'normal', 'loose', 'aggressive', 'conservative'];

const STYLE_PRIORS = {
  tight: { pass: 0.55, follow: 0.35, bomb: 0.1 },
  normal: { pass: 0.4, follow: 0.45, bomb: 0.15 },
  loose: { pass: 0.25, follow: 0.5, bomb: 0.25 },
  aggressive: { pass: 0.2, follow: 0.45, bomb: 0.35 },
  conservative: { pass: 0.6, follow: 0.32, bomb: 0.08 },
};

/**
 * 从已出牌统计全桌剩余张数（两副 108，按 rank:suit）。
 * @param {object[]} [playedCards]
 * @returns {Map<string, number>}
 */
function remainingCardCounts(playedCards = []) {
  const total = new Map();
  for (const c of makeDeck()) {
    const k = `${c.rank}:${c.suit}`;
    total.set(k, (total.get(k) || 0) + 1);
  }
  for (const c of playedCards) {
    const k = `${c.rank}:${c.suit}`;
    if (total.has(k)) total.set(k, Math.max(0, total.get(k) - 1));
  }
  return total;
}

/**
 * 按点数统计余牌（每点起手 8，王各 2）。
 * @param {object[]} [playedCards]
 * @returns {Map<string, number>}
 */
function remainingByRank(playedCards = []) {
  const m = new Map(RANKS.map((r) => [r, 8]));
  m.set(JOKER_BLACK, 2);
  m.set(JOKER_RED, 2);
  for (const c of playedCards) {
    m.set(c.rank, Math.max(0, (m.get(c.rank) || 0) - 1));
  }
  return m;
}

/**
 * 关键牌：2、级牌、大小王、已走炸弹。
 * @param {object[]} [playedCards]
 * @param {string} [levelRank]
 * @returns {{ twosLeft: number, levelLeft: number, wildsLeft: number, blackJokerLeft: number, redJokerLeft: number, bombsGone: number, levelRank: string }}
 */
function trackKeyCards(playedCards = [], levelRank = '2') {
  let twos = 0;
  let levels = 0;
  let wilds = 0;
  let black = 0;
  let red = 0;
  let bombsGone = 0;
  for (const c of playedCards) {
    if (c.rank === '2') twos += 1;
    if (c.rank === levelRank && !isJokerRank(c.rank)) levels += 1;
    if (isWildCard(c, levelRank)) wilds += 1;
    if (c.rank === JOKER_BLACK) black += 1;
    if (c.rank === JOKER_RED) red += 1;
  }
  return {
    twosLeft: Math.max(0, 8 - twos),
    levelLeft: Math.max(0, 8 - levels),
    wildsLeft: Math.max(0, 2 - wilds),
    blackJokerLeft: Math.max(0, 2 - black),
    redJokerLeft: Math.max(0, 2 - red),
    bombsGone,
    levelRank,
  };
}

/**
 * 若 combo 为炸/同花顺则 bombsGone +1。
 * @param {object} keyState
 * @param {{ type: string }|null|undefined} combo
 * @returns {object}
 */
function recordBombPlayed(keyState, combo) {
  const next = { ...keyState };
  if (combo && (combo.type === TYPES.BOMB || combo.type === TYPES.STRAIGHT_FLUSH)) {
    next.bombsGone = (next.bombsGone || 0) + 1;
  }
  return next;
}

/**
 * 各座位剩余张数。
 * @param {number[]} [startCounts]
 * @param {object[][]} [playedBySeat]
 * @returns {number[]}
 */
function opponentRemainingCounts(startCounts = [27, 27, 27, 27], playedBySeat = [[], [], [], []]) {
  return startCounts.map((n, i) => Math.max(0, n - (playedBySeat[i]?.length || 0)));
}

/**
 * 简单启发式：根据最近动作更新过牌/跟牌/炸弹权重。
 * @param {{ pass: number, follow: number, bomb: number }} prior
 * @param {'pass'|'follow'|'bomb'} action
 * @returns {{ pass: number, follow: number, bomb: number }}
 */
function updateActionWeights(prior, action) {
  const w = { ...prior };
  const lr = 0.12;
  if (action === 'pass') w.pass = Math.min(0.9, w.pass + lr);
  if (action === 'follow') w.follow = Math.min(0.9, w.follow + lr);
  if (action === 'bomb') w.bomb = Math.min(0.85, w.bomb + lr);
  const s = w.pass + w.follow + w.bomb;
  w.pass /= s;
  w.follow /= s;
  w.bomb /= s;
  return w;
}

/**
 * 风格先验。
 * @param {string} [style]
 * @returns {{ style: string, pass: number, follow: number, bomb: number }}
 */
function stylePrior(style = 'normal') {
  const s = STYLES.includes(style) ? style : 'normal';
  return { style: s, ...STYLE_PRIORS[s] };
}

/**
 * 用历史动作更新对手模型。
 * @param {{ action?: string }[]} [history]
 * @param {string} [style]
 * @returns {{ style: string, pass: number, follow: number, bomb: number }}
 */
function inferOpponentModel(history = [], style = 'normal') {
  let w = stylePrior(style);
  for (const ev of history) {
    if (ev?.action) w = { style: w.style, ...updateActionWeights(w, ev.action) };
  }
  return w;
}

/**
 * 组装信念：余牌、关键牌、对手模型。
 * @param {object} [ctx]
 * @returns {{ remainingByRank: object, remainingCounts: Map<string, number>, keyCards: object, opponentCounts: number[], models: object[] }}
 */
function buildBelief(ctx = {}) {
  const played = ctx.playedCards || [];
  const bySeat = ctx.playedBySeat || [[], [], [], []];
  const start = ctx.startCounts || [27, 27, 27, 27];
  const keys = trackKeyCards(played, ctx.levelRank || '2');
  let bombs = keys;
  for (const t of ctx.tricks || []) bombs = recordBombPlayed(bombs, t.combo);
  return {
    remainingByRank: Object.fromEntries(remainingByRank(played)),
    remainingCounts: remainingCardCounts(played),
    keyCards: bombs,
    opponentCounts: opponentRemainingCounts(start, bySeat),
    models: [0, 1, 2, 3].map((seat) =>
      inferOpponentModel(ctx.histories?.[seat] || [], ctx.styles?.[seat] || 'normal'),
    ),
  };
}



/* ---- search/index.js ---- */
/**
 * 搜索层：只枚举/搜索合法着法，不做最终排序决策。
 */




function uniqueMoves(moves) {
  const seen = new Set();
  return moves.filter((m) => {
    const key = m.cards.map((c) => c.id).sort().join(',') + ':' + (m.combo?.type || '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function emitIf(hand, cards, previous, levelRank, leading, out) {
  const combo = classify(cards, levelRank);
  if (!combo || combo.type === TYPES.PASS) return;
  if (leading || !previous || previous.type === TYPES.PASS || beats(combo, previous, levelRank)) {
    out.push({ cards, combo });
  }
}

/**
 * 补全连对（恰好 3 对）与钢板（恰好 2 组三条）。
 * 5 张顺/同花顺与三带二由 legalMoves 生成，此处不再重复。
 * @param {object[]} hand
 * @param {object|null} previous
 * @param {string} levelRank
 * @param {boolean} leading
 * @returns {{ cards: object[], combo: object }[]}
 */
function extraStructureMoves(hand, previous, levelRank, leading) {
  const out = [];
  const wilds = hand.filter((c) => !isJokerRank(c.rank) && isWildCard(c, levelRank));
  const byRank = new Map();
  for (const c of hand) {
    if (isJokerRank(c.rank)) continue;
    if (isWildCard(c, levelRank)) continue;
    if (!byRank.has(c.rank)) byRank.set(c.rank, []);
    byRank.get(c.rank).push(c);
  }
  const pick = (rank, n, used) => {
    const arr = (byRank.get(rank) || []).filter((c) => !used.has(c.id));
    return arr.slice(0, n);
  };

  const tryWindow = (win, copies) => {
    const used = new Set();
    const cards = [];
    let need = 0;
    for (const r of win) {
      const got = pick(r, copies, used);
      got.forEach((c) => used.add(c.id));
      cards.push(...got);
      need += copies - got.length;
    }
    if (need > wilds.length) return;
    cards.push(...wilds.slice(0, need));
    emitIf(hand, cards, previous, levelRank, leading, out);
  };

  // 连对：恰好 3 对（6 张）
  for (let i = 0; i + 3 <= SEQ_RANKS.length; i++) {
    tryWindow(SEQ_RANKS.slice(i, i + 3), 2);
  }
  // 钢板：恰好 2 组三条（6 张）
  for (let i = 0; i + 2 <= SEQ_RANKS.length; i++) {
    tryWindow(SEQ_RANKS.slice(i, i + 2), 3);
  }
  return uniqueMoves(out);
}

/**
 * 合法着法 + 结构补全。
 * @param {{ hand?: object[], previous?: object|null, levelRank?: string, leading?: boolean }} ctx
 * @returns {{ cards: object[], combo: object }[]}
 */
function generateCandidates(ctx) {
  const hand = ctx.hand || [];
  const previous = ctx.previous || null;
  const levelRank = ctx.levelRank || '2';
  const leading = Boolean(ctx.leading);
  const base = legalMoves(hand, previous, levelRank, leading);
  const extra = extraStructureMoves(hand, previous, levelRank, leading);
  return uniqueMoves(base.concat(extra));
}

/**
 * 浅启发式分（搜索用，不做最终决策）。
 * @param {{ combo?: object, cards?: object[] }|null} move
 * @param {{ hand?: object[] }} [ctx]
 * @returns {number}
 */
function heuristicEval(move, ctx = {}) {
  if (!move || !move.combo) return -1e9;
  const c = move.combo;
  if (c.type === TYPES.PASS) return 0;
  let v = (c.size || 0) * 2;
  if (isBombLike(c)) v += 8 + (c.bombSize || 5);
  if (c.type === TYPES.PAIR_SEQ || c.type === TYPES.TRIPLE_SEQ) v += 12;
  if (c.type === TYPES.STRAIGHT) v += 6;
  if ((ctx.hand?.length || 0) === c.size) v += 80;
  return v;
}

function cloneCtx(ctx, move) {
  const hand = (ctx.hand || []).filter((c) => !move.cards.some((x) => x.id === c.id));
  return { ...ctx, hand, leading: false, previous: move.combo };
}

/**
 * 短 rollout：只前进几步启发式，不改变策略层结论权重。
 * @param {object} ctx
 * @param {{ cards: object[], combo: object }} move
 * @param {number} [depth]
 * @returns {number}
 */
function shortRollout(ctx, move, depth = 2) {
  let score = heuristicEval(move, ctx);
  let cur = cloneCtx(ctx, move);
  for (let d = 0; d < depth; d++) {
    const cands = generateCandidates(cur);
    if (!cands.length) break;
    let best = cands[0];
    let bestV = heuristicEval(best, cur);
    for (const m of cands) {
      const v = heuristicEval(m, cur);
      if (v > bestV) {
        bestV = v;
        best = m;
      }
    }
    score += bestV * 0.3;
    if (best.combo?.type === TYPES.PASS) break;
    cur = cloneCtx(cur, best);
  }
  return score;
}

/**
 * 窄束搜索，返回按启发式排序的前 beam 着。
 * @param {object} ctx
 * @param {{ beam?: number, timeMs?: number }} [opts]
 * @returns {{ move: object, value: number }[]}
 */
function beamSearch(ctx, { beam = 8, timeMs = 35 } = {}) {
  const t0 = Date.now();
  const cands = generateCandidates(ctx);
  const scored = [];
  for (const m of cands) {
    if (Date.now() - t0 > timeMs) break;
    scored.push({ move: m, value: shortRollout(ctx, m, 1) });
  }
  scored.sort((a, b) => b.value - a.value);
  return scored.slice(0, beam);
}

/**
 * generateCandidates 别名。
 * @param {object} ctx
 * @returns {{ cards: object[], combo: object }[]}
 */
function allLegal(ctx) {
  return generateCandidates(ctx);
}


/* ---- ml/features.js ---- */
/**
 * 轻量特征提取（无 tensorflow）。专家约束另见 score.js。
 */

const FEATURE_NAMES = [
  'size',
  'isBomb',
  'isSF',
  'isPass',
  'isPairSeq',
  'isTripleSeq',
  'isStraight',
  'goOut',
  'smallLead',
  'control',
  'wasteBomb',
  'crushPartner',
  'firstLeadBomb',
  'exposeVsTwo',
  'splitStruct',
  'keepTrash',
];

/**
 * 从上下文与着法抽线性特征。
 * @param {object} ctx
 * @param {{ combo?: object, cards?: object[] }|null} move
 * @returns {Record<string, number>}
 */
function extractFeatures(ctx, move) {
  const combo = move?.combo || { type: TYPES.PASS, size: 0 };
  const handLen = ctx.hand?.length || 0;
  const size = combo.size || 0;
  const bomb = isBombLike(combo);
  const isBomb = combo.type === TYPES.BOMB ? 1 : 0;
  const isSF = combo.type === TYPES.STRAIGHT_FLUSH ? 1 : 0;
  const prev = ctx.previous;
  const wasteBomb =
    isBomb &&
    prev &&
    prev.type === TYPES.FULLHOUSE &&
    combo.rank === prev.rank &&
    (combo.bombSize || size) === 4
      ? 1
      : 0;
  const crushPartner =
    bomb &&
    ctx.partnerCombo &&
    ctx.partnerCombo.type === TYPES.STRAIGHT &&
    !ctx.winningNow
      ? 1
      : 0;
  const firstLeadBomb = ctx.firstLeadOfDeal && bomb && handLen > size ? 1 : 0;
  const exposeVsTwo =
    (ctx.enemyShort || 99) <= 2 && size === 3 && combo.type === TYPES.TRIPLE && handLen > 3 ? 1 : 0;
  const splitStruct = ctx.wouldSplitStructure ? 1 : 0;
  const keepTrash = handLen <= 2 && combo.type === TYPES.PASS ? 1 : 0;
  return {
    size,
    isBomb,
    isSF,
    isPass: combo.type === TYPES.PASS ? 1 : 0,
    isPairSeq: combo.type === TYPES.PAIR_SEQ ? 1 : 0,
    isTripleSeq: combo.type === TYPES.TRIPLE_SEQ ? 1 : 0,
    isStraight: combo.type === TYPES.STRAIGHT ? 1 : 0,
    goOut: handLen === size && size > 0 ? 1 : 0,
    smallLead: ctx.leading && !bomb ? 1 : 0,
    control: ctx.leading ? 0.5 : 0,
    wasteBomb,
    crushPartner,
    firstLeadBomb,
    exposeVsTwo,
    splitStruct,
    keepTrash,
  };
}

/**
 * 按 FEATURE_NAMES 顺序成向量。
 * @param {Record<string, number>} feat
 * @returns {number[]}
 */
function featureVector(feat) {
  return FEATURE_NAMES.map((n) => feat[n] ?? 0);
}


/* ---- meta/index.js ---- */
/**
 * 元层：对局阶段与风格标签。
 *
 * policy.reasonFor 与牌桌 dealInfo 使用 phaseOf；pack 导出 phaseOf / styleLabel / PHASES。
 * 不要在此写规则或硬过滤。
 */

/** @type {readonly string[]} */
const PHASES = ['tribute', 'early', 'mid', 'late', 'lastCards'];

/**
 * 按手牌张数估阶段。
 * @param {number} remainingInHand
 * @returns {'early'|'mid'|'late'|'lastCards'}
 */
function phaseOf(remainingInHand) {
  if (remainingInHand >= 20) return 'early';
  if (remainingInHand >= 10) return 'mid';
  if (remainingInHand >= 3) return 'late';
  return 'lastCards';
}

/**
 * 风格短标签（中文）。
 * @param {string} style
 * @returns {string}
 */
function styleLabel(style) {
  const map = {
    tight: '紧',
    normal: '中',
    loose: '松',
    aggressive: '凶',
    conservative: '稳',
  };
  return map[style] || '中';
}


/* ---- policy/filters.js ---- */
/**
 * 策略硬过滤：挡住 7 类失误。不改规则，只否决着法。
 */



/**
 * @param {{ combo?: { type: string } }|null|undefined} move
 * @returns {boolean}
 */
function isPass(move) {
  return !move || !move.combo || move.combo.type === TYPES.PASS;
}

/**
 * @param {{ cards?: object[] }} move
 * @param {object[]|undefined} hand
 * @returns {boolean}
 */
function emptiesHand(move, hand) {
  return move.cards && hand && move.cards.length === hand.length && move.cards.length > 0;
}

/**
 * 手牌里是否存在连对/钢板结构。
 * @param {object[]} hand
 * @param {string} [_levelRank]
 * @returns {{ pairRanks: string[], tripRanks: string[], hasAirplane: boolean, hasPairSeq: boolean }}
 */
function detectStructures(hand, _levelRank) {
  const cnt = countByRank(hand);
  const pairRanks = [];
  const tripRanks = [];
  for (const [r, n] of cnt) {
    if (n >= 2) pairRanks.push(r);
    if (n >= 3) tripRanks.push(r);
  }
  return { pairRanks, tripRanks, hasAirplane: tripRanks.length >= 2, hasPairSeq: pairRanks.length >= 3 };
}

/**
 * @param {{ combo?: { type: string }, cards?: object[] }} move
 * @param {{ hasAirplane: boolean, hasPairSeq: boolean, tripRanks: string[], pairRanks: string[] }} struct
 * @returns {boolean}
 */
function moveBreaksStructure(move, struct) {
  if (isPass(move) || isBombLike(move.combo)) return false;
  const t = move.combo.type;
  if (t === TYPES.PAIR_SEQ || t === TYPES.TRIPLE_SEQ || t === TYPES.STRAIGHT || t === TYPES.STRAIGHT_FLUSH) {
    return false;
  }
  if ((t === TYPES.SINGLE || t === TYPES.PAIR) && struct.hasAirplane) {
    return move.cards.some((c) => struct.tripRanks.includes(c.rank));
  }
  if ((t === TYPES.SINGLE || t === TYPES.PAIR) && struct.hasPairSeq) {
    return move.cards.some((c) => struct.pairRanks.includes(c.rank));
  }
  return false;
}

/**
 * @param {{ remainingSeatCounts?: number[], opponentCounts?: number[], seat?: number }} ctx
 * @returns {number}
 */
function enemyShortCount(ctx) {
  const counts = ctx.remainingSeatCounts || ctx.opponentCounts || [27, 27, 27, 27];
  const seat = ctx.seat ?? 0;
  const enemies = [(seat + 1) % 4, (seat + 3) % 4];
  return Math.min(...enemies.map((s) => counts[s] ?? 27));
}

/**
 * @param {{ hand?: object[], winningNow?: boolean }} ctx
 * @param {{ cards?: object[] }} move
 * @returns {boolean}
 */
function winningNow(ctx, move) {
  if (emptiesHand(move, ctx.hand)) return true;
  if (ctx.winningNow) return true;
  return false;
}

/** 普通牌型（可被炸/同花顺压，且砸搭档时需避开）。 */
const ORDINARY = new Set([
  TYPES.SINGLE,
  TYPES.PAIR,
  TYPES.TRIPLE,
  TYPES.FULLHOUSE,
  TYPES.STRAIGHT,
  TYPES.PAIR_SEQ,
  TYPES.TRIPLE_SEQ,
]);

/**
 * 解析搭档刚出的牌（显式 partnerCombo 或 lastPlaySeat 为对家）。
 * @param {{ partnerCombo?: object, seat?: number, lastPlaySeat?: number, previous?: object }} ctx
 * @returns {object|null}
 */
function resolvePartnerCombo(ctx) {
  if (ctx.partnerCombo) return ctx.partnerCombo;
  const seat = ctx.seat ?? 0;
  if (ctx.lastPlaySeat != null && ctx.previous && ctx.lastPlaySeat === (seat + 2) % 4) {
    return ctx.previous;
  }
  return null;
}

/**
 * @param {string} rank
 * @returns {number}
 */
function rankIdx(rank) {
  return RANKS.indexOf(rank);
}

/**
 * 小普通牌：2–K 单张（非 A/级牌/王）、A 以下对子、中低三条/三带二。
 * @param {{ type: string, rank?: string }|null|undefined} prev
 * @param {string} levelRank
 * @returns {boolean}
 */
function isSmallOrdinary(prev, levelRank) {
  if (!prev || !ORDINARY.has(prev.type)) return false;
  const r = prev.rank;
  if (!r || isJokerRank(r) || r === levelRank) return false;
  const i = rankIdx(r);
  if (prev.type === TYPES.SINGLE) {
    return i >= 0 && r !== 'A';
  }
  if (prev.type === TYPES.PAIR) {
    return i >= 0 && r !== 'A';
  }
  if (prev.type === TYPES.TRIPLE || prev.type === TYPES.FULLHOUSE) {
    return i >= 0 && i <= rankIdx('J');
  }
  return false;
}

/**
 * 硬过滤 7 类失误。只在“别无选择 / 能走完”时放行。
 * @param {{ combo?: object, cards?: object[] }} move
 * @param {object} ctx
 * @param {object[]} [allMoves]
 * @returns {boolean}
 */
function isForbidden(move, ctx, allMoves) {
  if (isPass(move)) return false;
  const combo = move.combo;
  const bomb = isBombLike(combo);
  const others = (allMoves || []).filter((m) => m !== move && !isPass(m));
  const onlyWay = others.length === 0;
  const last = emptiesHand(move, ctx.hand);
  const win = winningNow(ctx, move);
  const prev = ctx.previous;
  const partner = resolvePartnerCombo(ctx);
  const canPass = (allMoves || []).some(isPass) || (Boolean(prev) && prev.type !== TYPES.PASS && !ctx.leading);
  const sameTypeFollow = Boolean(
    prev && (allMoves || []).some((m) => m !== move && !isPass(m) && m.combo && m.combo.type === prev.type),
  );

  // 1 首轮领出不炸 / 不同花顺
  if (ctx.firstLeadOfDeal && bomb && !onlyWay && !last && !win) return true;

  // 2 四张同点炸压三带二
  if (
    combo.type === TYPES.BOMB &&
    (combo.bombSize || combo.size) === 4 &&
    prev &&
    prev.type === TYPES.FULLHOUSE &&
    combo.rank === prev.rank
  ) {
    if (!onlyWay && !last && !win) return true;
  }

  // 3 炸/同花顺压小普通牌（含对 7 / 对 5 / 对 8、2–K 单张等）
  if (bomb && prev && isSmallOrdinary(prev, ctx.levelRank) && !last && !win) {
    if (canPass || sameTypeFollow || !onlyWay) return true;
  }

  // 3 兼容：同花顺压 8/9 单张（即使未被判小牌）
  if (
    combo.type === TYPES.STRAIGHT_FLUSH &&
    prev &&
    prev.type === TYPES.SINGLE &&
    (prev.rank === '8' || prev.rank === '9')
  ) {
    if (!last && !win && (canPass || !onlyWay)) return true;
  }

  // 4 永不砸搭档普通牌
  if (
    bomb &&
    partner &&
    ORDINARY.has(partner.type) &&
    !win &&
    !last
  ) {
    if (canPass || sameTypeFollow || !onlyWay) return true;
  }

  // 4 对方只剩 2 张时不拆出三张散牌
  if (
    combo.type === TYPES.TRIPLE &&
    enemyShortCount(ctx) <= 2 &&
    (ctx.hand?.length || 0) > 3 &&
    !onlyWay &&
    !last &&
    !winningNow(ctx, move)
  ) {
    return true;
  }

  // 6 无必要不拆钢板 / 连对
  const struct = ctx._struct || detectStructures(ctx.hand || [], ctx.levelRank);
  if (
    moveBreaksStructure(move, struct) &&
    !onlyWay &&
    !last &&
    !winningNow(ctx, move)
  ) {
    return true;
  }

  return false;
}


/* ---- policy/index.js ---- */
/**
 * 策略层：选择出牌。可调用 belief / search / ml。必须挡住 7 类失误。
 */









function reasonFor(move, ctx, tags) {
  const c = move.combo;
  const parts = [];
  if (isPass(move)) parts.push('当前跟牌没有合适同型，选择过牌保留结构。');
  else {
    parts.push(`建议出 ${labelCombo(c)}。`);
  }
  if (tags.includes('goOut')) parts.push('手中仅剩 1–2 张，能走则走，避免留垃圾牌。');
  if (tags.includes('noFirstBomb')) parts.push('新开局首轮领出不应亮炸弹，留给关键时刻。');
  if (tags.includes('noWasteJ')) parts.push('四张 J 去压三带二是典型炸弹浪费。');
  if (tags.includes('noSFon8')) parts.push('同花顺去压 8/9 单张收益极差。');
  if (tags.includes('vsTwo')) parts.push('对方只剩 2 张，避免拆三张散牌把自己暴露。');
  if (tags.includes('partner')) parts.push('搭档刚出普通牌，不要用炸弹/同花顺砸队友。');
  if (tags.includes('keepStruct')) parts.push('保留连对/钢板（飞机）完整性，无必要不拆。');
  if (tags.includes('control')) parts.push('结合余牌与级牌，优先控场或安全过渡。');
  if (ctx.levelRank) parts.push(`当前级牌为 ${ctx.levelRank}（仅红桃级牌为逢人配）。`);
  if (ctx.belief?.keyCards) {
    const k = ctx.belief.keyCards;
    parts.push(`关键牌估计：2 余 ${k.twosLeft}，级牌余 ${k.levelLeft}，大王余 ${k.redJokerLeft}。`);
  }
  const remain = Array.isArray(ctx.hand) ? ctx.hand.length : 0;
  const phaseCn = { early: '开局', mid: '中盘', late: '残局', lastCards: '收尾' };
  const phase = phaseCn[phaseOf(remain)];
  if (phase) parts.push(`当前阶段：${phase}。`);
  return parts.join('');
}

/**
 * 牌型短中文标签。
 * @param {{ type: string, rank?: string, bombSize?: number, size?: number }|null|undefined} c
 * @returns {string}
 */
function labelCombo(c) {
  if (!c || c.type === TYPES.PASS) return '过牌';
  const map = {
    single: '单张',
    pair: '对子',
    triple: '三张',
    fullhouse: '三带二',
    straight: '顺子',
    pairSeq: '连对',
    tripleSeq: '钢板',
    bomb: `${c.bombSize || c.size} 炸`,
    straightFlush: '同花顺',
  };
  return `${map[c.type] || c.type}${c.rank ? ' ' + c.rank : ''}`;
}

/**
 * 给一手合法着法打分（含硬过滤大负）。
 * @param {{ combo?: object, cards?: object[] }} move
 * @param {object} ctx
 * @param {object[]} [allMoves]
 * @returns {{ score: number, tags: string[] }}
 */
function scoreMove(move, ctx, allMoves) {
  const tags = [];
  if (isForbidden(move, ctx, allMoves)) return { score: -1e6, tags: ['forbidden'] };
  const struct = ctx._struct || detectStructures(ctx.hand || [], ctx.levelRank);
  const featCtx = {
    ...ctx,
    wouldSplitStructure: moveBreaksStructure(move, struct),
    enemyShort: enemyShortCount(ctx),
  };
  let { score } = policyScore(featCtx, move);
  score += heuristicEval(move, ctx) * 0.15;

  if (emptiesHand(move, ctx.hand)) {
    score += 200;
    tags.push('goOut');
  }
  if (ctx.firstLeadOfDeal && !isBombLike(move.combo) && !isPass(move)) {
    score += 8;
    tags.push('noFirstBomb');
  }
  if (move.combo?.type === TYPES.BOMB && ctx.previous?.type === TYPES.FULLHOUSE) {
    tags.push('noWasteJ');
  }
  if (ctx.previous?.type === TYPES.SINGLE && (ctx.previous.rank === '8' || ctx.previous.rank === '9')) {
    tags.push('noSFon8');
  }
  const enemyShort = enemyShortCount(ctx);
  if (enemyShort <= 2) {
    if (move.combo?.type === TYPES.TRIPLE && (ctx.hand?.length || 0) > 3) {
      score -= 40;
      tags.push('vsTwo');
    }
    if (isBombLike(move.combo) || move.combo?.type === TYPES.SINGLE && singleStrength(move.combo.rank, ctx.levelRank) >= 12) {
      score += 15;
      tags.push('vsTwo');
    }
  }
  const partner = resolvePartnerCombo(ctx);
  if (partner && ORDINARY.has(partner.type) && !isBombLike(move.combo)) {
    score += 6;
    tags.push('partner');
  }
  if (moveBreaksStructure(move, struct) && !emptiesHand(move, ctx.hand)) {
    score -= 35;
    tags.push('keepStruct');
  }
  if (ctx.leading && !isPass(move)) tags.push('control');
  return { score, tags };
}

/**
 * 选出建议着法。硬过滤优先于搜索/线性分。
 * @param {object} [ctx]
 * @returns {{ move: object, reason: string, alternatives: object[], ms: number }}
 */
function decide(ctx = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const belief = ctx.belief || buildBelief(ctx);
  const full = { ...ctx, belief };
  full.partnerCombo = resolvePartnerCombo(full);
  full._struct = detectStructures(full.hand || [], full.levelRank || '2');
  let cands = generateCandidates(full);
  if (!cands.length) {
    const move = { cards: [], combo: { type: TYPES.PASS, rank: null, size: 0 } };
    return { move, reason: '无合法着法，过牌。', alternatives: [], ms: 0 };
  }
  // 7：剩 1–2 张能走则走
  const outs = cands.filter((m) => emptiesHand(m, full.hand));
  if (outs.length && full.hand.length <= 2) {
    const move = outs[0];
    return {
      move,
      reason: reasonFor(move, full, ['goOut']),
      alternatives: cands.filter((m) => m !== move).slice(0, 3),
      ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0,
    };
  }

  const beam = beamSearch(full, { beam: 10, timeMs: 20 });
  let pool = uniqueByCards(cands);
  const allowed = pool.filter((m) => !isForbidden(m, full, pool));
  if (allowed.length) pool = allowed;
  let best = pool[0];
  let bestS = -1e15;
  let bestTags = [];
  const ranked = [];
  for (const m of pool) {
    const { score, tags } = scoreMove(m, full, pool);
    const extra = beam.find((b) => sameMove(b.move, m));
    const s = score + (extra ? extra.value * 0.05 : 0);
    ranked.push({ move: m, score: s, tags });
    if (s > bestS) {
      bestS = s;
      best = m;
      bestTags = tags;
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return {
    move: best,
    reason: reasonFor(best, full, bestTags),
    alternatives: ranked.slice(1, 4).map((r) => r.move),
    ms,
  };
}

function sameMove(a, b) {
  if (!a || !b) return false;
  const ka = a.cards.map((c) => c.id).sort().join(',');
  const kb = b.cards.map((c) => c.id).sort().join(',');
  return ka === kb && a.combo?.type === b.combo?.type;
}

function uniqueByCards(moves) {
  const seen = new Set();
  return moves.filter((m) => {
    const k = m.cards.map((c) => c.id).sort().join(',') + m.combo.type;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * decide 的别名（UI / 打包对外名）。
 * @param {object} ctx
 * @returns {{ move: object, reason: string, alternatives: object[], ms: number }}
 */
function recommend(ctx) {
  return decide(ctx);
}


/* ---- pedagogy/index.js ---- */
/**
 * 教学层：只点评、规划、训练，不改变真实出牌。
 */


const SKILL_DIMS = [
  { id: 'pattern', name: '牌型识别', weight: 0.2 },
  { id: 'coop', name: '合作意识', weight: 0.2 },
  { id: 'bomb', name: '炸弹使用', weight: 0.15 },
  { id: 'clutch', name: '关键时刻', weight: 0.15 },
  { id: 'tribute', name: '进贡选择', weight: 0.15 },
  { id: 'returnTribute', name: '还贡策略', weight: 0.15 },
];

const RANK_TITLES = ['初学者', '入门', '熟练', '高手', '高段', '大师'];

const ERROR_TYPES = [
  { id: 'bombWaste', name: '炸弹浪费', severity: '严重' },
  { id: 'breakStruct', name: '破结构', severity: '严重' },
  { id: 'coopFail', name: '合作失误', severity: '中' },
  { id: 'clutchFail', name: '关键失误', severity: '中' },
  { id: 'tributePick', name: '进贡选择', severity: '中' },
  { id: 'returnTribute', name: '还贡策略', severity: '轻' },
  { id: 'infoMiss', name: '信息失误', severity: '轻' },
  { id: 'other', name: '其他', severity: '轻' },
];

/**
 * 六维加权总分。
 * @param {Record<string, number>} dims
 * @returns {number}
 */
function weightedScore(dims) {
  let s = 0;
  for (const d of SKILL_DIMS) s += (dims[d.id] ?? 0) * d.weight;
  return s;
}

/**
 * 分数对应称号。
 * @param {number} score
 * @returns {string}
 */
function rankFromScore(score) {
  if (score < 20) return RANK_TITLES[0];
  if (score < 40) return RANK_TITLES[1];
  if (score < 58) return RANK_TITLES[2];
  if (score < 74) return RANK_TITLES[3];
  if (score < 88) return RANK_TITLES[4];
  return RANK_TITLES[5];
}

/**
 * 对照建议给用户着法贴错误类型。
 * @param {{ combo?: object, cards?: object[] }|null} userMove
 * @param {{ combo?: object, cards?: object[] }|null} recMove
 * @param {object} [ctx]
 * @returns {{ id: string, name: string, severity: string }}
 */
function classifyUserError(userMove, recMove, ctx = {}) {
  const u = userMove?.combo;
  const r = recMove?.combo;
  if (!u) return { id: 'other', name: '其他', severity: '轻' };
  if (isBombLike(u) && ctx.firstLeadOfDeal) {
    return ERROR_TYPES.find((e) => e.id === 'bombWaste');
  }
  if (u.type === TYPES.BOMB && ctx.previous?.type === TYPES.FULLHOUSE && u.rank === ctx.previous.rank) {
    return ERROR_TYPES.find((e) => e.id === 'bombWaste');
  }
  if (u.type === TYPES.STRAIGHT_FLUSH && ctx.previous?.type === TYPES.SINGLE) {
    return ERROR_TYPES.find((e) => e.id === 'bombWaste');
  }
  if (ctx.partnerCombo?.type === TYPES.STRAIGHT && isBombLike(u)) {
    return ERROR_TYPES.find((e) => e.id === 'coopFail');
  }
  if ((ctx.enemyShort || 99) <= 2 && u.type === TYPES.TRIPLE && (ctx.hand?.length || 0) > 3) {
    return ERROR_TYPES.find((e) => e.id === 'clutchFail');
  }
  if (ctx.wouldSplit) return ERROR_TYPES.find((e) => e.id === 'breakStruct');
  if (ctx.phase === 'tribute') return ERROR_TYPES.find((e) => e.id === 'tributePick');
  if (ctx.phase === 'return') return ERROR_TYPES.find((e) => e.id === 'returnTribute');
  if (u.type !== r?.type && u.type !== TYPES.PASS) return ERROR_TYPES.find((e) => e.id === 'infoMiss');
  return ERROR_TYPES.find((e) => e.id === 'other');
}

/**
 * 用户着法与建议是否同牌。
 * @param {{ cards?: object[] }|null} userMove
 * @param {{ cards?: object[] }|null} recMove
 * @returns {boolean}
 */
function agreement(userMove, recMove) {
  if (!userMove || !recMove) return false;
  const a = (userMove.cards || []).map((c) => c.id).sort().join(',');
  const b = (recMove.cards || []).map((c) => c.id).sort().join(',');
  return a === b;
}

/**
 * 一局同意率。
 * @param {{ agree?: boolean }[]} records
 * @returns {{ plays: number, agree: number, rate: number }}
 */
function summarizeDeal(records) {
  const n = records.length || 1;
  const ok = records.filter((r) => r.agree).length;
  return { plays: records.length, agree: ok, rate: ok / n };
}

/**
 * 导出回放 JSON 文本。
 * @param {object[]} deals
 * @returns {string}
 */
function exportReplay(deals) {
  return JSON.stringify({ v: 1, kind: '掼蛋回放', deals }, null, 2);
}

/**
 * 导入回放。
 * @param {string|object} text
 * @returns {{ deals: object[] }}
 * @throws {Error} 回放格式无效
 */
function importReplay(text) {
  const data = typeof text === 'string' ? JSON.parse(text) : text;
  if (!data || !Array.isArray(data.deals)) throw new Error('回放格式无效');
  return data;
}

/**
 * 按短板生成一周训练计划。
 * @param {Record<string, number>} dims
 * @returns {{ day: string, focus: string, drill: string, minutes: number }[]}
 */
function weeklyPlan(dims) {
  const weak = SKILL_DIMS.slice()
    .sort((a, b) => (dims[a.id] ?? 0) - (dims[b.id] ?? 0))
    .slice(0, 3);
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return days.map((day, i) => ({
    day,
    focus: weak[i % weak.length].name,
    drill: drillByDim(weak[i % weak.length].id),
    minutes: 20 + (i % 3) * 5,
  }));
}

/**
 * 维度对应训练 id。
 * @param {string} id
 * @returns {string}
 */
function drillByDim(id) {
  const map = {
    pattern: 'press-same-suit-straight',
    coop: 'cooperation',
    bomb: 'bomb-timing',
    clutch: 'bomb-timing',
    tribute: 'tribute',
    returnTribute: 'return-tribute',
  };
  return map[id] || 'cooperation';
}

const DRILLS = [
  { id: 'press-same-suit-straight', name: '压同花顺', dim: 'pattern', brief: '练习识别并压过同花顺。' },
  { id: 'bomb-timing', name: '炸弹时机', dim: 'bomb', brief: '首轮不炸、不浪费炸。' },
  { id: 'tribute', name: '进贡', dim: 'tribute', brief: '选择最大非王进贡。' },
  { id: 'return-tribute', name: '还贡', dim: 'returnTribute', brief: '还自然点 ≤10 的牌。' },
  { id: 'cooperation', name: '合作', dim: 'coop', brief: '不砸搭档顺子。' },
];

/**
 * 一局后微调六维（夹在 0–100）。
 * @param {Record<string, number>} dims
 * @param {{ rate?: number }} dealSummary
 * @param {{ id: string }[]} errors
 * @returns {Record<string, number>}
 */
function applyDealToDims(dims, dealSummary, errors) {
  const next = { ...dims };
  const rate = dealSummary.rate ?? 0;
  next.pattern += (rate - 0.5) * 4;
  if (errors.some((e) => e.id === 'coopFail')) next.coop -= 3;
  else next.coop += 0.5;
  if (errors.some((e) => e.id === 'bombWaste')) next.bomb -= 4;
  else next.bomb += 0.4;
  if (errors.some((e) => e.id === 'clutchFail')) next.clutch -= 3;
  else next.clutch += 0.3;
  if (errors.some((e) => e.id === 'tributePick')) next.tribute -= 2;
  else next.tribute += 0.2;
  if (errors.some((e) => e.id === 'returnTribute')) next.returnTribute -= 1;
  else next.returnTribute += 0.2;
  for (const k of Object.keys(next)) next[k] = Math.max(0, Math.min(100, next[k]));
  return next;
}

/**
 * 优势 / 短板与建议。
 * @param {Record<string, number>} dims
 * @returns {{ strengths: object[], weaknesses: object[], suggestions: string[] }}
 */
function strengthsWeaknesses(dims) {
  const items = SKILL_DIMS.map((d) => ({ ...d, score: dims[d.id] ?? 0 }));
  items.sort((a, b) => b.score - a.score);
  return {
    strengths: items.slice(0, 2),
    weaknesses: items.slice(-2).reverse(),
    suggestions: items.slice(-2).map((d) => `加强「${d.name}」：完成训练「${DRILLS.find((x) => x.dim === d.id)?.name || '综合'}」。`),
  };
}

/**
 * 仅教学点评，不改真实出牌。
 * @param {object} ctx
 * @returns {{ recommend: object, teachingOnly: true }}
 */
function coachComment(ctx) {
  const rec = decide(ctx);
  return { recommend: rec, teachingOnly: true };
}



/* ---- user-model/index.js ---- */
/**
 * 用户模型：本机 localStorage（Node 测试用内存存储）。
 */
const mem = new Map();

function store() {
  if (typeof localStorage !== 'undefined') {
    return {
      get(k) {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : null;
      },
      set(k, v) {
        localStorage.setItem(k, JSON.stringify(v));
      },
    };
  }
  return {
    get(k) {
      return mem.has(k) ? mem.get(k) : null;
    },
    set(k, v) {
      mem.set(k, v);
    },
  };
}

const KEY = 'guandan-coach-user';

/**
 * 空用户档案。
 * @returns {{ dims: Record<string, number>, deals: object[], errors: object[], wins: number, losses: number, created: number }}
 */
function defaultProfile() {
  return {
    dims: {
      pattern: 40,
      coop: 40,
      bomb: 40,
      clutch: 40,
      tribute: 40,
      returnTribute: 40,
    },
    deals: [],
    errors: [],
    wins: 0,
    losses: 0,
    created: Date.now(),
  };
}

/**
 * 读取档案（无则默认）。
 * @returns {object}
 */
function loadProfile() {
  return store().get(KEY) || defaultProfile();
}

/**
 * 写入档案。
 * @param {object} p
 * @returns {object}
 */
function saveProfile(p) {
  store().set(KEY, p);
  return p;
}

/**
 * 重置为本机默认档案。
 * @returns {object}
 */
function resetProfile() {
  const p = defaultProfile();
  saveProfile(p);
  return p;
}

/**
 * 追加一局记录。
 * @param {object} deal
 * @returns {object}
 */
function pushDeal(deal) {
  const p = loadProfile();
  p.deals.push(deal);
  saveProfile(p);
  return p;
}

/**
 * 追加一条错误记录。
 * @param {object} err
 * @returns {object}
 */
function pushError(err) {
  const p = loadProfile();
  p.errors.push(err);
  saveProfile(p);
  return p;
}

/**
 * 记胜负。
 * @param {boolean} win
 * @returns {object}
 */
function recordWin(win) {
  const p = loadProfile();
  if (win) p.wins += 1;
  else p.losses += 1;
  saveProfile(p);
  return p;
}

/**
 * 合并并夹紧六维。
 * @param {Record<string, number>} partial
 * @returns {object}
 */
function updateDims(partial) {
  const p = loadProfile();
  p.dims = { ...p.dims, ...partial };
  for (const k of Object.keys(p.dims)) {
    p.dims[k] = Math.max(0, Math.min(100, p.dims[k]));
  }
  saveProfile(p);
  return p;
}




/* ---- ml/score.js ---- */
/**
 * 线性价值/策略分。专家知识硬编码：绝不“学会”浪费炸弹。
 */



/**
 * 线性价值。
 * @param {Record<string, number>} feat
 * @param {{ bias?: number, w?: Record<string, number> }} [w]
 * @returns {number}
 */
function linearValue(feat, w = weights) {
  let s = w.bias || 0;
  for (const name of FEATURE_NAMES) {
    s += (feat[name] || 0) * (w.w[name] || 0);
  }
  return s;
}

/**
 * 策略分（含浪费炸弹硬扣）。
 * @param {object} ctx
 * @param {{ combo?: object }} move
 * @param {object} [w]
 * @returns {{ score: number, features: object }}
 */
function policyScore(ctx, move, w = weights) {
  const feat = extractFeatures(ctx, move);
  let s = linearValue(feat, w);
  // 硬约束：浪费炸弹永远大负，不会被自对弈改掉
  if (feat.wasteBomb || feat.firstLeadBomb || feat.crushPartner) {
    s -= 50;
  }
  if (isBombLike(move.combo) && ctx.forbidBomb) s -= 50;
  return { score: s, features: feat };
}

/**
 * policyScore 的纯分数。
 * @param {object} ctx
 * @param {{ combo?: object }} move
 * @returns {number}
 */
function valueScore(ctx, move) {
  return policyScore(ctx, move).score;
}

/**
 * 极小自对弈微调：只动非专家项，且幅度极小。
 * @param {{ bias: number, w: Record<string, number> }} w
 * @param {Record<string, number>} [grad]
 * @returns {{ bias: number, w: Record<string, number> }}
 */
function tweakWeights(w, grad = {}) {
  const next = { bias: w.bias, w: { ...w.w } };
  const locked = new Set(['wasteBomb', 'crushPartner', 'firstLeadBomb']);
  for (const [k, g] of Object.entries(grad)) {
    if (locked.has(k)) continue;
    if (next.w[k] === undefined) continue;
    next.w[k] = next.w[k] + 0.001 * g;
  }
  return next;
}




  global.Guandan = {
    RANKS, SUITS, RULESETS, TYPES, cards, classify, legalMoves, decide, recommend: decide,
    createMatch, createRound, applyPlay, applyGameResult, rulesetConfig,
    buildBelief, generateCandidates, SKILL_DIMS, RANK_TITLES, ERROR_TYPES,
    weeklyPlan, DRILLS, strengthsWeaknesses, exportReplay, importReplay,
    loadProfile, saveProfile, resetProfile, pushDeal, recordWin, updateDims,
    applyDealToDims, summarizeDeal, agreement, classifyUserError, weightedScore, rankFromScore,
    pickTributeCard, pickReturnCard, isLegalReturnCard, legalReturnCards, tributePlan, applyTributes, previewTributes, resolveTributePairs, canResistTribute, makeDeck, shuffle, dealFourHands,
    formatCard, parseCard, isWildCard, isBombLike, teamOf, defaultProfile,
    phaseOf, styleLabel, PHASES,
  };
})(typeof window !== 'undefined' ? window : globalThis);
