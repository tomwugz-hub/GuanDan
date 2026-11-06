/**
 * 掼蛋合法出牌：领出任意合法牌型；跟牌须同型更大，或炸弹/同花顺可压，或 PASS。
 */
import { classify, TYPES, passCombo } from './combos.js';
import { beats } from './compare.js';
import { isWildCard, isJokerRank, SEQ_RANKS, seqWindows } from './ranks.js';

/**
 * 是否合法出牌（领出任意合法型；跟牌须同型更大或炸/同花顺或过）。
 * @param {object[]} cards
 * @param {object|null|undefined} previous
 * @param {string} levelRank
 * @param {{ leading?: boolean }} [opts]
 * @returns {boolean}
 */
export function isLegalPlay(cards, previous, levelRank, { leading = false } = {}) {
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
export function playAction(cards, previous, levelRank, leading = false) {
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
export function legalMoves(hand, previous, levelRank, leading = false) {
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
  for (const win of seqWindows(5)) {
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

  // 天王炸（四王）：任何时候都生成
  {
    const jk = hand.filter((c) => isJokerRank(c.rank));
    if (jk.length === 4) emit(jk.slice());
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

