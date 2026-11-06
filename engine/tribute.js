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
import { JOKER_RED, isJokerRank, singleStrength } from './ranks.js';

/**
 * 座位所属队：0/2 一家，1/3 一家。
 * @param {number} seat
 * @returns {number}
 */
export function teamOf(seat) {
  return seat % 2;
}

/**
 * 拆头/二/三/末游。
 * @param {number[]} finishOrder
 * @returns {{ head: number, second: number, third: number, tail: number }}
 * @throws {Error} 不是 4 个座位
 */
export function finishRoles(finishOrder) {
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
export function isDoubleDown(finishOrder) {
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
export function tributePlan(finishOrder, { officialDoubleTribute = false } = {}) {
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
export function highestNonJoker(hand) {
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
export function pickTributeCard(hand, levelRank = '2') {
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
export function countRedJokers(hand) {
  return hand.filter((c) => c.rank === JOKER_RED).length;
}

/**
 * 进贡方持双大王则该对抗贡。
 * @param {object[]|null|undefined} hand
 * @returns {boolean}
 */
export function pairResists(hand) {
  return countRedJokers(hand || []) >= 2;
}

/**
 * 是否存在至少一对进贡方可抗贡。
 * @param {object[][]} hands
 * @param {{ count: number, pairs: { from: number }[] }} plan
 * @returns {boolean}
 */
export function canResistTribute(hands, plan) {
  if (!plan.count) return false;
  return plan.pairs.some((p) => pairResists(hands[p.from] || []));
}

/**
 * 还贡合法：自然点 ≤10，非王、非级牌。
 * @param {{ rank: string }|null|undefined} card
 * @param {string} levelRank
 * @returns {boolean}
 */
export function isLegalReturnCard(card, levelRank) {
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
export function pickReturnCard(hand, levelRank, exceptIds = new Set()) {
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
export function legalReturnCards(hand, levelRank, exceptIds = new Set()) {
  return (hand || []).filter((c) => isLegalReturnCard(c, levelRank) && !exceptIds.has(c.id));
}

/**
 * 官方双贡：大贡归头游、小贡归二游。同点保持计划顺序（顺时针桌仪不声称）。
 * @param {object[][]} hands
 * @param {{ pairs?: { from: number, to: number }[], officialDoubleTribute?: boolean }} plan
 * @param {string} levelRank
 * @returns {{ from: number, to: number }[]}
 */
export function resolveTributePairs(hands, plan, levelRank) {
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
export function previewTributes(hands, plan, { levelRank = '2', resist = undefined } = {}) {
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
export function applyTributes(hands, plan, { levelRank = '2', resist = undefined, returns = [] } = {}) {
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
