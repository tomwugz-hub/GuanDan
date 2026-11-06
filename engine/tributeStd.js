/**
 * 主流（竞赛/通行）进贡、还贡、抗贡 + 标准升级。规则说明见 TRIBUTE.md。
 * （engine/tribute.js + engine/state.js 是教练 app 的“宿迁”变体，保留不动。）
 *
 * 座位 0/2 一家、1/3 一家；出牌顺序 seat+1（“下家”= (s+1)%4）。
 * prevOrder：上一副 头游→末游 的座位号。
 *
 * - 单贡（非双下）：末游把最大的一张牌（含王；红桃级牌=逢人配除外）进贡给头游；头游还一张 ≤10 的牌；末游先出。
 *   头游与末游同队（1、4 名）时同样由末游进贡头游（主流规则如此）。
 * - 双下（头游+二游同队）：三游、末游各进贡最大一张；大的给头游、小的给二游；
 *   一样大时由头游的下家（(head+1)%4）进贡给头游（并收头游的还贡），另一位给二游；
 *   头游、二游各还一张 ≤10 给向自己进贡的人；进贡给头游者先出。
 * - 抗贡：单贡时末游手里有两张大王；双下时三游+末游合起来有两张大王 → 不进贡、不还贡，头游先出。
 * - 还贡牌：自然点 2–10（含 10）且不是级牌（任何花色的级牌都比 A 大，含逢人配）；王不可。
 *   手里没有这样的牌时（兜底）：还按本副大小最小的一张非逢人配——即先 J/Q/K/A，再非红桃级牌，再王；
 *   只剩逢人配时才还逢人配。
 * - 升级：头游方 双上 +3、头游+三游 +2、头游+末游 +1；下一副打头游方的级。
 *   打 A：头游方正在打 A（本副级牌 = A 且是自己的级）并且对家不是末游 → 过 A，整场结束。
 *   （“打 A 三次不过回 2”等地方规则未实现。）
 */
import { JOKER_RED, RANKS, isJokerRank, isWildCard, singleStrength } from './ranks.js';

export const teamOf = (s) => s % 2;
export const NAT_LE10 = ['2', '3', '4', '5', '6', '7', '8', '9', '10'];
const SUIT_ORD = { S: 0, H: 1, C: 2, D: 3, J: 4 };

/** 进贡牌：最大的一张（含王），红桃级牌除外；同点取花色序第一张（结果确定）。全是逢人配时返回 null。 */
export function tributeCard(hand, lv) {
  let best = null;
  for (const c of hand || []) {
    if (isWildCard(c, lv)) continue;
    if (!best) { best = c; continue; }
    const d = singleStrength(c.rank, lv) - singleStrength(best.rank, lv);
    if (d > 0 || (d === 0 && ((SUIT_ORD[c.suit] ?? 9) < (SUIT_ORD[best.suit] ?? 9) || (c.suit === best.suit && c.id < best.id)))) best = c;
  }
  return best;
}

/** 牌是否可作还贡（自然点 ≤10，非王，非级牌——任何花色的级牌都不行）。 */
export function isReturnEligible(c, lv) {
  return !!c && !isJokerRank(c.rank) && !isWildCard(c, lv) && c.rank !== lv && NAT_LE10.includes(c.rank);
}

/** 还贡可选牌。手里没有 ≤10 的非级牌时，允许还最小的牌（按本副大小，级牌比 A 大；尽量不还逢人配）。 */
export function returnOptions(hand, lv) {
  const el = (hand || []).filter((c) => isReturnEligible(c, lv));
  if (el.length) return { cards: el, fallback: false };
  const pool = (hand || []).filter((c) => !isWildCard(c, lv));
  const src = pool.length ? pool : (hand || []);
  if (!src.length) return { cards: [], fallback: true };
  const min = Math.min(...src.map((c) => singleStrength(c.rank, lv)));
  return { cards: src.filter((c) => singleStrength(c.rank, lv) === min), fallback: true };
}

export function isLegalReturn(c, hand, lv) {
  return returnOptions(hand, lv).cards.some((x) => x.id === c?.id);
}

export function countRJ(hand) {
  return (hand || []).filter((c) => c.rank === JOKER_RED).length;
}

/**
 * 进贡计划（只看发好的牌，不改手牌）。
 * @returns {{ kind: 'none'|'single'|'double', resisted: boolean, gives: {from,to,card}[], leader: number|null, head: number|null, reason: string }}
 */
export function planTribute(prevOrder, hands, lv) {
  if (!prevOrder || prevOrder.length !== 4) return { kind: 'none', resisted: false, gives: [], leader: null, head: null, reason: '首副不进贡' };
  const [head, second, third, tail] = prevOrder;
  const dd = teamOf(head) === teamOf(second);
  if (!dd) {
    if (countRJ(hands[tail]) >= 2) return { kind: 'single', resisted: true, gives: [], leader: head, head, resistBy: [tail], reason: '末游有两张大王，抗贡；头游先出' };
    const card = tributeCard(hands[tail], lv);
    return { kind: 'single', resisted: false, gives: [{ from: tail, to: head, card }], leader: tail, head, reason: '末游向头游进贡，末游先出' };
  }
  const rj3 = countRJ(hands[third]), rj4 = countRJ(hands[tail]);
  if (rj3 + rj4 >= 2) return { kind: 'double', resisted: true, gives: [], leader: head, head, resistBy: [third, tail].filter((s) => countRJ(hands[s]) > 0), reason: '双下方合计两张大王，抗贡；头游先出' };
  const a = { from: third, card: tributeCard(hands[third], lv) };
  const b = { from: tail, card: tributeCard(hands[tail], lv) };
  const sa = singleStrength(a.card.rank, lv), sb = singleStrength(b.card.rank, lv);
  let big, small, tie = false;
  if (sa !== sb) [big, small] = sa > sb ? [a, b] : [b, a];
  else {
    tie = true;
    const hn = (head + 1) % 4; // 头游的下家
    [big, small] = a.from === hn ? [a, b] : [b, a];
  }
  return {
    kind: 'double', resisted: false, tie,
    gives: [{ from: big.from, to: head, card: big.card }, { from: small.from, to: second, card: small.card }],
    leader: big.from, head,
    reason: tie ? '双下双贡：贡牌一样大，头游下家进贡头游并先出' : '双下双贡：大贡归头游、小贡归二游，进贡大牌者先出',
  };
}

/** 进贡（移牌）。返回新 hands（不改原数组）。 */
export function applyGives(hands, plan) {
  const next = hands.map((h) => h.slice());
  for (const g of plan.gives) {
    next[g.from] = next[g.from].filter((c) => c.id !== g.card.id);
    next[g.to] = next[g.to].concat(g.card);
  }
  return next;
}

/** 还贡（移牌），card 必须合法。 */
export function applyReturn(hands, from, to, card, lv) {
  if (!isLegalReturn(card, hands[from], lv)) throw new Error(`非法还贡 ${card?.rank}${card?.suit}`);
  const next = hands.map((h) => h.slice());
  next[from] = next[from].filter((c) => c.id !== card.id);
  next[to] = next[to].concat(card);
  return next;
}

/**
 * 一次性完成进贡+还贡。chooseReturn(seat, hand, info) → 还贡牌；info = { to, received, lv, kind }。
 * 返回 { hands, plan, returns: [{from,to,card}] }。
 */
export function resolveTribute(prevOrder, hands, lv, chooseReturn) {
  const plan = planTribute(prevOrder, hands, lv);
  if (plan.kind === 'none' || plan.resisted) return { hands: hands.map((h) => h.slice()), plan, returns: [] };
  let h = applyGives(hands, plan);
  const returns = [];
  for (const g of plan.gives) {
    const opts = returnOptions(h[g.to], lv).cards;
    let c = chooseReturn ? chooseReturn(g.to, h[g.to], { to: g.from, received: g.card, lv, kind: plan.kind, options: opts }) : null;
    if (!c || !opts.some((x) => x.id === c.id)) c = minReturn(h[g.to], lv);
    h = applyReturn(h, g.to, g.from, c, lv);
    returns.push({ from: g.to, to: g.from, card: c });
  }
  return { hands: h, plan, returns };
}

/** 最小的可还牌（基线）。 */
export function minReturn(hand, lv) {
  const o = returnOptions(hand, lv).cards;
  return o.reduce((b, c) => (!b || singleStrength(c.rank, lv) < singleStrength(b.rank, lv) ? c : b), null);
}

// ---------------- 标准升级 ----------------
/** 新比赛状态。 */
export function newStdMatch(startLevel = '2') {
  return { teamLevel: [startLevel, startLevel], level: startLevel, levelTeam: null, matchOver: false, winnerTeam: null, prevOrder: null };
}

function bump(lv, n) {
  return RANKS[Math.min(RANKS.length - 1, RANKS.indexOf(lv) + n)];
}

/** 头游方升级数：双上 3、头+三 2、头+末 1。 */
export function stepsFor(order) {
  const t = teamOf(order[0]);
  return teamOf(order[1]) === t ? 3 : teamOf(order[2]) === t ? 2 : 1;
}

/**
 * 一副结束（改 m）。返回 { winTeam, steps, passA, before:[..], after:[..], level, message }。
 * levelTeam：本副打的是哪队的级（首副 null = 双方都是 startLevel）。
 */
export function applyStdResult(m, order) {
  const winTeam = teamOf(order[0]);
  const steps = stepsFor(order);
  const before = m.teamLevel.slice();
  const playingOwnA = m.level === 'A' && m.teamLevel[winTeam] === 'A' && (m.levelTeam === winTeam || m.levelTeam == null);
  let passA = false;
  let message;
  if (playingOwnA && steps >= 2) {
    passA = true;
    m.matchOver = true;
    m.winnerTeam = winTeam;
    message = `${steps === 3 ? '双上' : '头游+三游'}，过 A，整场胜利`;
  } else if (playingOwnA) {
    message = '打 A 头游但对家末游，未过 A，继续打 A';
  } else {
    m.teamLevel[winTeam] = bump(m.teamLevel[winTeam], steps);
    message = `${steps === 3 ? '双上' : steps === 2 ? '头游+三游' : '头游+末游'}，升 ${steps} 级`;
  }
  m.level = m.teamLevel[winTeam];
  m.levelTeam = winTeam;
  m.prevOrder = order.slice();
  return { winTeam, steps, passA, before, after: m.teamLevel.slice(), level: m.level, message };
}
