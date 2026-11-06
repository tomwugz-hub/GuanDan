/**
 * 策略硬过滤：挡住 7 类失误。不改规则，只否决着法。
 */
import { TYPES, isBombLike } from '../../../engine/combos.js';
import { RANKS, isJokerRank } from '../../../engine/ranks.js';
import { countByRank } from '../../../engine/cards.js';
import { minPlays } from './shape.js';
import { moveFinish, winProb } from './lookahead.js';
import { isWildCard } from '../../../engine/ranks.js';

/**
 * @param {{ combo?: { type: string } }|null|undefined} move
 * @returns {boolean}
 */
export function isPass(move) {
  return !move || !move.combo || move.combo.type === TYPES.PASS;
}

/**
 * @param {{ cards?: object[] }} move
 * @param {object[]|undefined} hand
 * @returns {boolean}
 */
export function emptiesHand(move, hand) {
  return move.cards && hand && move.cards.length === hand.length && move.cards.length > 0;
}

/**
 * 手牌里是否存在连对/钢板结构。
 * @param {object[]} hand
 * @param {string} [_levelRank]
 * @returns {{ pairRanks: string[], tripRanks: string[], hasAirplane: boolean, hasPairSeq: boolean }}
 */
/** r21 开关（GD_R21 位掩码）。 */
export function r21Mode() { const v = typeof process !== 'undefined' ? process.env?.GD_R21 : undefined; return v == null ? 1 : Number(v) || 0; }

/** r23 开关（GD_R23 位掩码）。默认 7 = bit1|bit2|bit4：
 *  bit1=领出两连天然三张优先钢板（game7 n20）；
 *  bit2=三张点数不进连对结构，中盘可跟小对（game7 n32）；
 *  bit4=中盘不急炸敌人中高对、留近退出的逢人配炸（game7 n36，弱证据）。
 *  浏览器无 env → 默认即发布值。GD_R23=0 关。 */
export function r23Mode() { const v = typeof process !== 'undefined' ? process.env?.GD_R23 : undefined; return v == null ? 7 : Number(v) || 0; }

export function detectStructures(hand, _levelRank) {
  const cnt = countByRank(hand);
  const pairRanks = [];
  const tripRanks = [];
  for (const [r, n] of cnt) {
    if (n >= 2) pairRanks.push(r);
    if (n >= 3) tripRanks.push(r);
  }
  // 连续段：A 可作 1（A23…）；只把真正连续的对子（≥3 连）/三张（≥2 连）记为结构
  const runRanks = (ranks, need) => {
    const order = ['A', ...RANKS];
    const on = order.map((r) => ranks.includes(r) && !isJokerRank(r));
    const out = new Set();
    let i = 0;
    while (i < order.length) {
      if (!on[i]) { i++; continue; }
      let j = i;
      while (j + 1 < order.length && on[j + 1]) j++;
      if (j - i + 1 >= need) for (let k = i; k <= j; k++) out.add(order[k]);
      i = j + 1;
    }
    return [...out];
  };
  // r21 bit1（GD_R21）：天然炸弹（≥4 张）的点数不算连对/钢板结构的一部分（game5 n1：4444 炸把 33/55 连成“连对”，禁止领 55）
  const noBomb = r21Mode() & 1 ? (r) => (cnt.get(r) || 0) < 4 : () => true;
  // r23 bit2：三张（≥3）点数也不进连对结构——999 不应把 88/1010 锁成“连对”而禁跟小对（game7 n32）
  const pairStructOk = (r) => noBomb(r) && (!(r23Mode() & 2) || (cnt.get(r) || 0) < 3);
  const seqPairs = runRanks(pairRanks.filter(pairStructOk), 3);
  // 钢板：仅长手（≥15 张）时剔除炸弹点数；短手保持原结构（dev-real d048 退步）
  const seqTrips = runRanks(hand.length >= 15 ? tripRanks.filter(noBomb) : tripRanks, 2);
  return {
    pairRanks,
    tripRanks,
    hasAirplane: tripRanks.length >= 2,
    hasPairSeq: pairRanks.length >= 3,
    // 跟牌时用的“真实”结构：连续 ≥3 对 / ≥2 连三张
    seq: { pairRanks: seqPairs, tripRanks: seqTrips, hasAirplane: seqTrips.length >= 2, hasPairSeq: seqPairs.length >= 3 },
  };
}

/**
 * @param {{ combo?: { type: string }, cards?: object[] }} move
 * @param {{ hasAirplane: boolean, hasPairSeq: boolean, tripRanks: string[], pairRanks: string[] }} struct
 * @returns {boolean}
 */
export function moveBreaksStructure(move, struct0, follow = false) {
  if (isPass(move) || isBombLike(move.combo)) return false;
  const struct = follow && struct0.seq ? struct0.seq : struct0;
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
/** r14（GD_R14 开关，默认 3 = 过牌扣分+放宽炸弹；GD_R14=0 关 = r10 行为）：“敌在快走”——跟敌（非压搭档）时某个还在打的敌家 ≤5 张（且我 ≥13 张），或 6–11 张且最近两手共出 ≥6 张（ctx.recentShed），或 6–13 张且比我和对家都少 ≥4 张（领跑）；
 *  对家 1–5 张（快走完）不触发；我 <8 张不触发。返回 0=关 / 1=过牌扣分 / 2=放宽炸弹 / 3=两者。 */
export function r14Mode() { const v = typeof process !== 'undefined' ? process.env?.GD_R14 : undefined; return v == null ? 3 : Number(v) || 0; }
export function r14Hot(ctx) {
  if (!r14Mode() || ctx.leading || !ctx.previous) return false;
  const seat = ctx.seat ?? 0; const cts = ctx.remainingSeatCounts || [];
  if (ctx.lastPlaySeat != null && ctx.lastPlaySeat === (seat + 2) % 4) return false;
  if (ctx.partnerCombo) return false;
  const pc = cts[(seat + 2) % 4] ?? 27; if (pc >= 1 && pc <= 5) return false;
  if ((ctx.hand || []).length < 8) return false;
  const shed = ctx.recentShed || [];
  const my = (ctx.hand || []).length; const mine = Math.min(my, pc || 27);
  return [(seat + 1) % 4, (seat + 3) % 4].some((e) => { const n = cts[e] ?? 27;
    return n >= 2 && ((n <= 5 && my >= 13) || (n >= 6 && n <= 11 && (shed[e] || 0) >= 6) || (n >= 6 && n <= 13 && n <= mine - 4)); });
}

/** r20（GD_R20 位开关，默认 15，r20 A/B 12000 副 +0.038 [0.008,0.068]；16=阻断下家 已拒绝）：1=敌炸后回炸夺权（对家 ≤6 张）；2=短手王压敌大王；4=短手领出不拆逢人配炸弹三张；8=对家 ≤2 张时不压对家（除非确定走完） */
export function r20Mode() { const v = typeof process !== 'undefined' ? process.env?.GD_R20 : undefined; return v == null ? 15 : Number(v) || 0; }
export function r20Counter(move, ctx) {
  if (!(r20Mode() & 1) || ctx.leading || !ctx.previous || !isBombLike(ctx.previous) || !isBombLike(move.combo)) return false;
  if (resolvePartnerCombo(ctx)) return false;
  const seat = ctx.seat ?? 0; const cts = ctx.remainingSeatCounts || [];
  const pc = cts[(seat + 2) % 4] ?? 27;
  if ((move.cards || []).some((c) => isWildCard(c, ctx.levelRank || '2'))) return false; // 只用天然炸弹回炸
  return pc >= 1 && pc <= 6;
}
export function enemyShortCount(ctx) {
  const counts = ctx.remainingSeatCounts || ctx.opponentCounts || [27, 27, 27, 27];
  const seat = ctx.seat ?? 0;
  const enemies = [(seat + 1) % 4, (seat + 3) % 4];
  // 注：已出完的敌家（0 张）也算最短 —— r8 试过只看还在打的敌家，A/B −0.151（敌家头游后靠这里触发的拦截在防被双上），故保留
  return Math.min(...enemies.map((s) => counts[s] ?? 27));
}

/**
 * @param {{ hand?: object[], winningNow?: boolean }} ctx
 * @param {{ cards?: object[] }} move
 * @returns {boolean}
 */
export function winningNow(ctx, move) {
  if (emptiesHand(move, ctx.hand)) return true;
  if (ctx.winningNow) return true;
  return false;
}

/** 普通牌型（可被炸/同花顺压，且砸搭档时需避开）。 */
export const ORDINARY = new Set([
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
export function resolvePartnerCombo(ctx) {
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
export function isSmallOrdinary(prev, levelRank) {
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
/** 调试：最近一次禁止所命中的规则（行号标签）。 */
export const FORBID_TRACE = { rule: null };
export function isForbidden(move, ctx, allMoves) {
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
  if (ctx.firstLeadOfDeal && bomb && !onlyWay && !last && !win) return (FORBID_TRACE.rule = 'L191', true);

  // 2 四张同点炸压三带二
  if (
    combo.type === TYPES.BOMB &&
    (combo.bombSize || combo.size) === 4 &&
    prev &&
    prev.type === TYPES.FULLHOUSE &&
    combo.rank === prev.rank
  ) {
    if (!onlyWay && !last && !win) return (FORBID_TRACE.rule = 'L201', true);
  }

  // 敌家报单（≤1 张）时允许炸断，不受“勿炸小牌”约束
  const enemyLast = enemyShortCount(ctx) <= 1;
  // 3 炸/同花顺压小普通牌（含对 7 / 对 5 / 对 8、2–K 单张等）
  if (!(r14Mode() & 2 && r14Hot(ctx)) && bomb && prev && isSmallOrdinary(prev, ctx.levelRank) && !last && !win && !enemyLast && !(!partner && bombFinishOk(move, ctx, others, moveFinish(move, ctx)))) {
    if (canPass || sameTypeFollow || !onlyWay) return (FORBID_TRACE.rule = 'L208', true);
  }

  // 3 兼容：同花顺压 8/9 单张（即使未被判小牌）
  if (
    combo.type === TYPES.STRAIGHT_FLUSH &&
    prev &&
    prev.type === TYPES.SINGLE &&
    (prev.rank === '8' || prev.rank === '9') &&
    !enemyLast
  ) {
    if (!last && !win && (canPass || !onlyWay)) return (FORBID_TRACE.rule = 'L219', true);
  }

  // 4 永不砸搭档普通牌
  if (
    bomb &&
    partner &&
    (ORDINARY.has(partner.type) || isBombLike(partner)) &&
    !win &&
    !last
  ) {
    if (canPass || sameTypeFollow || !onlyWay) return (FORBID_TRACE.rule = 'L230', true);
  }

  // 4d 跟敌人的牌：有不拆炸的普通牌能压住时不用炸弹（含敌报单）
  if (bomb && prev && !ctx.leading && !partner && !last && !win && !((f0) => f0 === 'sure' || (f0 && enemyShortCount(ctx) <= 1 &&
      !others.some((m) => !isBombLike(m.combo) && moveFinish(m, ctx))) ||
      bombFinishOk(move, ctx, others, f0))(moveFinish(move, ctx))) {
    const cnt = countByRank(ctx.hand || []);
    const lv0 = ctx.levelRank || '2';
    // 只把“天然炸弹”（不含逢人配）的牌算作炸弹牌：单张逢人配配对不算拆炸
    const bombIds = new Set((allMoves || []).filter((m) => m.combo && isBombLike(m.combo) && (enemyShortCount(ctx) <= 1 || !(m.cards || []).some((c) => isWildCard(c, lv0)))).flatMap((m) => (m.cards || []).map((c) => c.id)));
    const touches = (m) => (m.cards || []).some((c) => (cnt.get(c.rank) || 0) >= 4 || bombIds.has(c.id));
    if (others.some((m) => !isBombLike(m.combo) && !touches(m))) return (FORBID_TRACE.rule = 'L242', true);
    // 出牌的敌人牌多（≥6）：不炸，除非走完线（上面已排除）或喂报单/报双搭档
    const seat0 = ctx.seat ?? 0;
    const cts = ctx.remainingSeatCounts || [];
    const lastN = ctx.lastPlaySeat != null ? cts[ctx.lastPlaySeat] : null;
    const pc0 = cts[(seat0 + 2) % 4];
    if (!(r14Mode() & 2 && r14Hot(ctx)) && !r20Counter(move, ctx) && lastN != null && lastN >= 6 && !(pc0 === 1 || pc0 === 2) && enemyShortCount(ctx) >= 2) return (FORBID_TRACE.rule = 'L248', true);
  }

  // 4c 敌家很短（≤2 张）领出且有炸：不拆炸弹出牌型（留炸控场）
  // 领出也不为送搭档拆炸弹（有不拆炸的牌可出时）
  if (ctx.leading && !bomb && !last && !win && (enemyShortCount(ctx) <= 3 || [1, 2].includes(ctx.remainingSeatCounts?.[((ctx.seat ?? 0) + 2) % 4]))) {
    const cnt = countByRank(ctx.hand || []);
    const touches = (m) => (m.cards || []).some((c) => (cnt.get(c.rank) || 0) >= 4);
    if (touches(move) && others.some((m) => isBombLike(m.combo) || !touches(m))) return (FORBID_TRACE.rule = 'L256', true);
  }

  // 4b 护搭档（主流默认）：不用普通牌压搭档的普通牌，除非
  //   (a) 走完 / 压后一手即可走完；(b) 下家敌人 ≤2 张且张数够接搭档这手、搭档不是报单、人设非护搭档、不拆炸弹
  if (!bomb && partner && ORDINARY.has(partner.type) && !ctx.leading && prev && !last && !win) {
    if (!partnerOverrideOk(move, ctx, prev)) return (FORBID_TRACE.rule = 'L262', true);
  }

  // 4 对方短牌时：跟牌勿拆三条；领出可用三条控场（残局长手仍禁拆）
  if (
    combo.type === TYPES.TRIPLE &&
    !(prev && prev.type === TYPES.TRIPLE && !ctx.leading) && // 跟三张只能用三张：不算“拆三条”
    enemyShortCount(ctx) <= 2 &&
    (ctx.hand?.length || 0) > 3 &&
    !onlyWay &&
    !last &&
    !winningNow(ctx, move)
  ) {
    // 领出：天然三张（非拆炸）且没有含它的三带二/钢板时可出（对方短牌接不住）；否则长手仍禁拆
    const natTriple = ctx.leading && (countByRank(ctx.hand || []).get(combo.rank) || 0) === 3 &&
      !(allMoves || []).some((m) => (m.combo?.type === TYPES.FULLHOUSE || m.combo?.type === TYPES.TRIPLE_SEQ) && m.combo.rank === combo.rank);
    if (!ctx.leading || ((ctx.hand?.length || 0) > 6 && !natTriple)) return (FORBID_TRACE.rule = 'L278', true);
  }

  // 5b 跟牌勿拆炸弹出单/对：敌家牌多（≥3）时留炸；敌报单（≤1）时应整炸打断
  if (
    !ctx.leading &&
    prev &&
    (combo.type === TYPES.SINGLE || combo.type === TYPES.PAIR) &&
    (enemyShortCount(ctx) >= 3 || (enemyShortCount(ctx) <= 1 && !partner)) &&
    !last &&
    !win
  ) {
    // 只数天然牌（逢人配不算炸弹张数）
    const lvB = ctx.levelRank || '2';
    const n = (ctx.hand || []).filter((c) => c.rank === combo.rank && !isWildCard(c, lvB)).length;
    if ((n || 0) >= 4) return (FORBID_TRACE.rule = 'L293', true);
  }

  // 5c 跟敌人牌：三张/三带二/其它牌型不拆天然炸弹（敌家 ≥3 张时留炸）
  if (!ctx.leading && prev && !bomb && !partner && !last && !win && (move.cards?.length || 0) >= 3 && enemyShortCount(ctx) >= 3) {
    const cnt = countByRank(ctx.hand || []);
    const lv1 = ctx.levelRank || '2';
    if ((move.cards || []).some((c) => !isWildCard(c, lv1) && (cnt.get(c.rank) || 0) >= 4)) return (FORBID_TRACE.rule = 'L300', true);
  }

  // 6 无必要不拆钢板 / 连对（对家报单领出送牌时例外）
  const partnerLast =
    ctx.leading &&
    ((ctx.remainingSeatCounts?.[((ctx.seat ?? 0) + 2) % 4] ?? 27) === 1 ||
      // 对家剩 2 张：允许拆三张/对子结构送对
      ((ctx.remainingSeatCounts?.[((ctx.seat ?? 0) + 2) % 4] ?? 27) === 2 && move.combo?.type === TYPES.PAIR) ||
      // 敌报双且手中无孤单：允许拆对出单
      (enemyShortCount(ctx) === 2 && [...countByRank(ctx.hand || []).values()].every((n) => n >= 2)));
  const struct = ctx._struct || detectStructures(ctx.hand || [], ctx.levelRank);
  if (
    moveBreaksStructure(move, struct, true) &&
    !partnerLast &&
    // 跟牌拦截报双/报单敌家时允许拆结构
    !(!ctx.leading && prev && enemyShortCount(ctx) <= 2 && !partner) &&
    // 压搭档拦截：下家敌人张数恰等于这手（压上即走完），允许拆结构顶住
    !(!ctx.leading && prev && partner && !bomb && nextEnemyIs(ctx, (Array.isArray(prev?.cards) && prev.cards.length) || prev?.size || 1) && partnerOverrideOk(move, ctx, prev)) &&
    !onlyWay &&
    !last &&
    !winningNow(ctx, move)
  ) {
    return (FORBID_TRACE.rule = 'L323', true);
  }

  return false;
}

/**
 * 炸后一两手就走完（sure / bombBack / likely）且敌家已不长（≤3），并且没有普通牌也能走完：允许用炸弹抢走完。
 */
function nextEnemyIs(ctx, n) {
  const cts = ctx.remainingSeatCounts || [];
  return (cts[((ctx.seat ?? 0) + 1) % 4] ?? 27) === n;
}

export function bombFinishOk(move, ctx, others, f0) {
  if (!f0 || enemyShortCount(ctx) > 3) return false;
  const ids = new Set((move.cards || []).map((x) => x.id));
  const rest = (ctx.hand || []).filter((c) => !ids.has(c.id));
  if (minPlays(rest, ctx.levelRank || '2') > 2) return false;
  return !(others || []).some((m) => !isBombLike(m.combo) && moveFinish(m, ctx));
}

/**
 * 压搭档普通牌是否有正当理由（见 isForbidden 4b）。
 */
export function partnerOverrideOk(move, ctx, prev) {
  const hand = ctx.hand || [];
  const lv = ctx.levelRank || '2';
  const ids = new Set((move.cards || []).map((c) => c.id));
  const rest = hand.filter((c) => !ids.has(c.id));
  if (!rest.length) return true;
  // r8 c1：压后一手走完，但这手拆天然炸弹（同点 ≥4 张、非逢人配）→ 不算正当理由（MC：过牌明显更好，例 self|766|79、694|57）
  const natCnt = (r) => hand.filter((c) => c.rank === r && (isJokerRank(c.rank) || !isWildCard(c, lv))).length;
  const breaksNatBomb = !isBombLike(move.combo) && (move.cards || []).some((c) => !isJokerRank(c.rank) && !isWildCard(c, lv) && natCnt(c.rank) >= 4 &&
    natCnt(c.rank) - (move.cards || []).filter((x) => x.rank === c.rank && !isWildCard(x, lv)).length < 4);
  // r20 bit8：对家只剩 ≤2 张，压对家只在确定走完时
  if (r20Mode() & 8) { const pc8 = (ctx.remainingSeatCounts || [])[((ctx.seat ?? 0) + 2) % 4] ?? 27; if (pc8 >= 1 && pc8 <= 2 && prev?.type !== TYPES.SINGLE && enemyShortCount(ctx) >= 3) return moveFinish(move, ctx) === 'sure'; }
  if (minPlays(rest, lv) <= 1 && !breaksNatBomb) return true; // 压后领出一手走完
  { const f = moveFinish(move, ctx); if (f === 'sure') return true; } // 只有确定走完才压搭档（follow 轮收紧）
  const seat = ctx.seat ?? 0;
  const counts = ctx.remainingSeatCounts || [];
  const partnerCount = counts[(seat + 2) % 4] ?? 27;
  const nextEnemy = counts[(seat + 1) % 4] ?? 27;
  const partnerFirst = /partner/i.test(ctx.persona?.style || '') || /护搭档|partner/i.test(ctx.persona?.brief || '');
  if (partnerFirst) return false;
  const size = (Array.isArray(prev?.cards) && prev.cards.length) || prev?.size || (prev?.type === 'pair' ? 2 : 1);
  const cnt = countByRank(hand);
  const breaksBomb = (move.cards || []).some((c) => (cnt.get(c.rank) || 0) >= 4);
  // 拦截：下家敌人张数恰好等于这一手（可同型压上直接走完），且搭档这手不大
  const partnerWeak = prev?.rank && !['A', 'BJ', 'RJ', lv].includes(prev.rank) && rankIdx(prev.rank) < rankIdx('J');
  if (partnerCount === 1) return nextEnemy === size && partnerWeak && !breaksBomb;
  return nextEnemy <= 2 && nextEnemy >= size && !breaksBomb; // 下家报双/报单且能接这手：顶（holdout 规则）
}
