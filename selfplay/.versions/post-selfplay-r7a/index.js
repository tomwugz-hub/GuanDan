/**
 * 策略层：选择出牌。可调用 belief / search / ml。必须挡住 7 类失误。
 */
import { TYPES, isBombLike } from '../../../engine/combos.js';
import { generateCandidates, beamSearch, heuristicEval } from '../../../search/index.js';
import { buildBelief } from '../../../belief/index.js';
import { policyScore } from '../../../ml/score.js';
import { phaseOf } from '../../../meta/index.js';
import { singleStrength, isJokerRank, isWildCard } from '../../../engine/ranks.js';
import {
  isPass,
  emptiesHand,
  detectStructures,
  moveBreaksStructure,
  enemyShortCount,
  ORDINARY,
  resolvePartnerCombo,
  isSmallOrdinary,
  isForbidden,
} from './filters.js';
import { minPlays, restAfter, usesWild, wildFillers } from './shape.js';
import { moveFinish, feedAfter, winProb, finishLine, safety } from './lookahead.js';
import { decompose, decomposeCounts, comboKey } from './handplan.js';
const LA_CACHE = new WeakMap();
function laCache(ctx) { let c = LA_CACHE.get(ctx); if (!c) { c = new Map(); LA_CACHE.set(ctx, c); } return c; }

export { detectStructures, resolvePartnerCombo, isSmallOrdinary, isForbidden };

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
export function labelCombo(c) {
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
function rankCounts(hand) {
  const m = new Map();
  for (const c of hand || []) m.set(c.rank, (m.get(c.rank) || 0) + 1);
  return m;
}

/** 非炸弹着法用掉天然炸弹（≥4 张同点，不含逢人配）的牌、使其不足 4 张。 */
function breaksNaturalBomb(move, hand, levelRank) {
  if (!move?.cards?.length || isBombLike(move.combo)) return false;
  const nat = new Map();
  for (const c of hand) if (isJokerRank(c.rank) || !isWildCard(c, levelRank)) nat.set(c.rank, (nat.get(c.rank) || 0) + 1);
  const used = new Map();
  for (const c of move.cards) if (isJokerRank(c.rank) || !isWildCard(c, levelRank)) used.set(c.rank, (used.get(c.rank) || 0) + 1);
  for (const [r, u] of used) {
    const n = nat.get(r) || 0;
    if (n >= 4 && n - u < 4) return true;
  }
  return false;
}

function isOrphanSingleMove(move, byRank) {
  return move?.combo?.type === TYPES.SINGLE && (byRank.get(move.combo.rank) || 0) === 1;
}

function isControlRank(rank, levelRank) {
  return rank === levelRank || rank === 'BJ' || rank === 'RJ' || rank === 'A';
}

function handHasBomb(byRank) {
  for (const n of byRank.values()) if (n >= 4) return true;
  return false;
}

function partnerOwnsPrevious(ctx, partner) {
  const prev = ctx.previous;
  if (!partner || !prev || prev.type === TYPES.PASS) return false;
  if (ctx.lastPlaySeat != null && ctx.seat != null) {
    return ctx.lastPlaySeat === (ctx.seat + 2) % 4;
  }
  // partnerCombo 与 previous 同型同点 → 正在压搭档刚出的牌
  return partner.type === prev.type && (partner.rank ?? null) === (prev.rank ?? null);
}

export function scoreMove(move, ctx, allMoves) {
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

  const hand = ctx.hand || [];
  const byRank = rankCounts(hand);
  const enemyShort = enemyShortCount(ctx);
  const hasBomb = handHasBomb(byRank);
  const levelRank = ctx.levelRank || '2';
  const partner = resolvePartnerCombo(ctx);
  const partnerFirst =
    /partner/i.test(ctx.persona?.style || '') || /护搭档|partner/i.test(ctx.persona?.brief || '');

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

  // —— 护搭档：永远勿炸搭档；仅 partner-first 人设才优先过牌不压搭档 ——
  if (!ctx.leading && partnerOwnsPrevious(ctx, partner)) {
    if (isBombLike(move.combo)) {
      score -= 120;
      tags.push('noBombPartner');
    } else if (partnerFirst) {
      if (isPass(move)) {
        score += 120;
        tags.push('letPartner');
      } else {
        score -= 90;
        tags.push('noStealPartner');
      }
    }
  }

  // —— 敌末张：必须炸打断 ——
  const poolHasBomb = (allMoves || []).some((m) => isBombLike(m.combo));
  if (!ctx.leading && enemyShort <= 1) {
    if (isBombLike(move.combo)) {
      // 有能大概率拦住的普通牌时，炸弹（尤其用逢人配的）加分打折
      const bestNB = Math.max(0, ...(allMoves || []).filter((m) => !isPass(m) && !isBombLike(m.combo) && !usesWild(m, levelRank)).map((m) => winProb(m, ctx)));
      const wildBomb = usesWild(move, levelRank);
      score += Math.round(130 * (1 - (wildBomb ? 0.9 : 0.6) * bestNB));
      tags.push('mustBomb');
    } else if (isPass(move) && (hasBomb || poolHasBomb)) {
      score -= 100;
      tags.push('mustBomb');
    }
  }

  // 拆天然炸弹出普通牌型（三带二、三张、顺子等；单/对由 filters 禁止）：同型有不拆炸的替代、或拆了也不减少手数时扣分（自对局体检 r1）
  if (!isPass(move) && !isBombLike(move.combo) && enemyShort >= 3 && breaksNaturalBomb(move, hand, levelRank)) {
    const sameAlt = (allMoves || []).some((m) => m !== move && m.combo?.type === move.combo.type && !isBombLike(m.combo) && !breaksNaturalBomb(m, hand, levelRank));
    if (sameAlt) {
      score -= 60;
      tags.push('bombBreakAlt');
    } else if (1 + minPlays(restAfter(hand, move), levelRank) > minPlays(hand, levelRank)) {
      score -= 35;
      tags.push('bombBreakNoGain');
    }
  }
  // 自对局体检 r3：三带二带的对子取“最便宜”的：天然恰好一对 > 拆三张；不带级牌/王；同等时带小的（原先各种带法同分）
  if (!isPass(move) && move.combo?.type === TYPES.FULLHOUSE && move.combo.pairRank && !emptiesHand(move, ctx.hand)) {
    const attachCost = (m) => {
      const pr = m.combo.pairRank;
      const nP = hand.filter((c) => c.rank === pr && !isWildCard(c, levelRank)).length;
      return (nP === 3 ? 12 : 0) + (pr === levelRank || isJokerRank(pr) ? 15 : 0) + 0.6 * Math.min(singleStrength(pr, levelRank), 16);
    };
    // 只在同一三张的各种带法之间比较（相对扣分），不影响三带二与其它牌型/过牌的取舍
    const same = (allMoves || []).filter((m) => m.combo?.type === TYPES.FULLHOUSE && m.combo.rank === move.combo.rank && m.combo.pairRank && !emptiesHand(m, ctx.hand));
    const minC = Math.min(attachCost(move), ...same.map(attachCost));
    const d = attachCost(move) - minC;
    if (d > 0) {
      score -= d;
      tags.push('fhAttach');
    }
  }
  // 自对局体检 r4：敌家牌多时领出同型牌（三带二/三张/对/顺/连对/钢板）先出小的（原先同型不同点常同分，随手取）
  if (ctx.leading && enemyShort >= 4 && !isPass(move) && !isBombLike(move.combo) && move.combo?.type !== TYPES.SINGLE && move.combo?.rank != null) {
    const st = (m) => Math.min(singleStrength(m.combo.rank, levelRank), 16);
    const same = (allMoves || []).filter((m) => m.combo?.type === move.combo.type && m.cards.length === move.cards.length && !isBombLike(m.combo) && m.combo.rank != null);
    const d = st(move) - Math.min(st(move), ...same.map(st));
    if (d > 0) {
      score -= Math.min(12, 0.8 * d);
      tags.push('leadSmallSame');
    }
  }
  const partnerCountS = (ctx.remainingSeatCounts || [])[((ctx.seat ?? 0) + 2) % 4] ?? 27;
  // 敌短领出：对方接不住的普通牌型（不拆炸）优先于孤单；牌型越大越好；剩余一手走完时先出大的
  const bombRanks0 = new Set([...byRank.entries()].filter(([, n]) => n >= 4).map(([r]) => r));
  const touchesBomb0 = (m) => (m.cards || []).some((c) => bombRanks0.has(c.rank));
  const unfollowable = (m) => m && !isPass(m) && !isBombLike(m.combo) && !touchesBomb0(m) && (m.cards?.length || 0) > enemyShort;
  const shapeFirst = ctx.leading && enemyShort <= 2 && (partnerCountS >= 3 || partnerCountS === 0 || (partnerCountS === 2 && enemyShort <= 1)) && (allMoves || []).some(unfollowable);
  // 自对局体检 r7：开局（>14 张）有拆牌计划时，领出按计划（planLeadScore），不再无条件给孤单小牌加分
  const bigPlanLead = ctx.leading && R7('R7_NOSB', 1) && !!bigPlanFor(ctx);
  // —— 领出留炸：有炸时优先孤儿小单，压低顺子/亮炸（敌短且有接不住的牌型时让位） ——
  if (ctx.leading && hasBomb && !shapeFirst) {
    if (!bigPlanLead && isOrphanSingleMove(move, byRank) && !isControlRank(move.combo.rank, levelRank)) {
      score += 60;
      tags.push('holdBombLead');
    }
    if (isBombLike(move.combo) && enemyShort > 1) {
      score -= 80;
      tags.push('holdBombLead');
    }
    if (
      move.combo?.type === TYPES.STRAIGHT ||
      move.combo?.type === TYPES.PAIR_SEQ ||
      move.combo?.type === TYPES.TRIPLE_SEQ
    ) {
      score -= 55;
      tags.push('holdBombLead');
    }
  }

  // 敌很短领出：有对方接不住的普通牌型时不先出炸弹（留炸控场）
  if (ctx.leading && enemyShort <= 2 && isBombLike(move.combo) && !emptiesHand(move, ctx.hand)) {
    const alt = (allMoves || []).some((m) => !isBombLike(m.combo) && (m.cards?.length || 0) > enemyShort);
    if (alt) {
      score -= 120;
      tags.push('keepBombForControl');
    }
  }

  // —— 敌短领出：手短三条控场；仅「有炸或敌=1」时才推孤儿小单 ——
  if (shapeFirst && unfollowable(move)) {
    score += 60 + 25 * Math.min(move.cards.length, 6);
    const restN = minPlays(restAfter(ctx.hand, move), levelRank);
    score -= 20 * restN;
    if (restN <= 1 && move.combo?.rank) score += 4 * singleStrength(move.combo.rank, levelRank);
    if (partnerCountS === 2 && move.combo?.type === TYPES.PAIR) score += 100 - 3 * Math.min(singleStrength(move.combo.rank, levelRank), 15); // 搭档剩 2：小对子既拦敌又送搭档
    tags.push('shortEnemyShape');
  }
  if (ctx.leading && enemyShort <= 2) {
    if (move.combo?.type === TYPES.TRIPLE && !shapeFirst) {
      if (hand.length <= 6) {
        score += enemyShort <= 1 ? 140 : 80;
        tags.push('shortEnemyTriple');
      } else {
        score -= 55;
        tags.push('noSplitTriple');
      }
    }
    if (
      (move.combo?.type === TYPES.PAIR || move.combo?.type === TYPES.SINGLE) &&
      (byRank.get(move.combo.rank) || 0) >= 3
    ) {
      score -= 80;
      tags.push('keepTripleIntact');
    }
    const pushOrphan = !shapeFirst && (hasBomb || enemyShort <= 1 || (enemyShort <= 2 && hand.length >= 7));
    if (pushOrphan && isOrphanSingleMove(move, byRank) && !isControlRank(move.combo.rank, levelRank)) {
      if (enemyShort <= 1 && hand.length <= 6 && !hasBomb) {
        score -= 15; // 敌=1 手短：让三条优先
      } else {
        const strength = singleStrength(move.combo.rank, levelRank);
        score += 50 + Math.max(0, 14 - strength) * 3;
        tags.push('shortEnemyLead');
      }
    }
    if (
      move.combo?.type === TYPES.SINGLE &&
      isControlRank(move.combo.rank, levelRank) &&
      hand.length > 4
    ) {
      score -= 55;
      tags.push('noLeadControl');
    }
  }

  // 无炸领出：保连对/顺子（分要压过孤儿启发式）；留级牌时顺子给孤儿让路
  const hasLevel = (byRank.get(levelRank) || 0) > 0;
  const hasOrphanNonLevel = [...byRank.entries()].some(
    ([r, n]) => n === 1 && r !== levelRank && !isControlRank(r, levelRank),
  );
  if (
    ctx.leading &&
    !hasBomb &&
    (move.combo?.type === TYPES.PAIR_SEQ ||
      move.combo?.type === TYPES.STRAIGHT ||
      move.combo?.type === TYPES.TRIPLE_SEQ)
  ) {
    if (hasLevel && hasOrphanNonLevel && move.combo?.type === TYPES.STRAIGHT) {
      score -= 20;
      tags.push('holdLevelOverStraight');
    } else {
      score += 95;
      tags.push('keepShape');
    }
  }

  // 领出留炸：孤儿单偏好更小点
  if (ctx.leading && !bigPlanLead && hasBomb && isOrphanSingleMove(move, byRank) && !isControlRank(move.combo.rank, levelRank)) {
    const strength = singleStrength(move.combo.rank, levelRank);
    score += Math.max(0, 12 - strength) * 2;
  }

  // —— 留级牌：有非级牌孤儿单时，勿先出级牌 ——
  if (ctx.leading && move.combo?.type === TYPES.SINGLE && move.combo.rank === levelRank) {
    const hasNonLevelOrphan = [...byRank.entries()].some(
      ([r, n]) => n === 1 && r !== levelRank && !isControlRank(r, levelRank),
    );
    // 级牌本身是控制牌；若还有更小孤儿，扣分
    const hasSmallOrphan = [...byRank.entries()].some(([r, n]) => {
      if (n !== 1 || r === levelRank) return false;
      return singleStrength(r, levelRank) < singleStrength(levelRank, levelRank);
    });
    if (hasSmallOrphan || hasNonLevelOrphan) {
      score -= 50;
      tags.push('holdLevel');
    }
  }

  const stoppingShort = !ctx.leading && !!ctx.previous && enemyShort <= 2 && !partnerOwnsPrevious(ctx, partner);
  if (stoppingShort && !isPass(move) && !isBombLike(move.combo)) {
    score += 40; // 敌报双/报单：能用普通牌拦就拦
    tags.push('stopShort');
  }
  const feedShape = ctx.leading && ((partnerCountS === 1 && move.combo?.type === TYPES.SINGLE) || (partnerCountS === 2 && move.combo?.type === TYPES.PAIR));
  if (moveBreaksStructure(move, struct, !ctx.leading || (Boolean(handPlanFor(ctx)) && !feedShape)) && !emptiesHand(move, ctx.hand) && !stoppingShort) {
    score -= 35;
    tags.push('keepStruct');
  }
  // 跟牌同型：略偏好更大点（打破 A/K 同分）
  if (!ctx.leading && !isPass(move) && move.combo?.type === TYPES.SINGLE && ctx.previous?.type === TYPES.SINGLE) {
    score += singleStrength(move.combo.rank, levelRank) * 0.05;
    tags.push('followUp');
  }

  // —— 对比对（pairs.jsonl）修正：窄规则 ——
  const seatCounts = ctx.remainingSeatCounts || [];
  const partnerCount = seatCounts[((ctx.seat ?? 0) + 2) % 4] ?? 27;
  const cappedStrength = (r) => Math.min(singleStrength(r, levelRank), 15);
  const toBeatPartner = !ctx.leading && partnerOwnsPrevious(ctx, partner);
  // 跟敌人牌、普通牌：若这手拿到牌权后可走完（finishLine）或可喂报单/报双搭档 → 不按“留控制牌”处罚
  let winThenGood = null;
  if (!ctx.leading && !isPass(move) && !isBombLike(move.combo) && ctx.previous && !partner && !emptiesHand(move, ctx.hand) && minPlays(hand, levelRank) > 1) {
    const rest0 = restAfter(hand, move);
    winThenGood = (rest0.length <= 12 ? finishLine(rest0, ctx, rest0.length <= 8 ? 2 : 1, laCache(ctx)) : null) || feedAfter(move, ctx);
    if (winThenGood) tags.push(`winThen:${winThenGood}`);
  }
  // 敌家都不短（≥4）：别人炸了不回炸（除非走完线）
  if (!ctx.leading && isBombLike(move.combo) && ctx.previous && isBombLike(ctx.previous) && !partner && enemyShort >= 4 && !emptiesHand(move, ctx.hand) &&
      !moveFinish(move, ctx, laCache(ctx))) {
    score -= 60;
    tags.push('noCounterBomb');
  }
  // 敌家牌多：勿炸普通牌
  if (!ctx.leading && isBombLike(move.combo) && ctx.previous && ORDINARY.has(ctx.previous.type) && enemyShort >= 4 && !emptiesHand(move, ctx.hand)) {
    score -= 150;
    tags.push('saveBomb');
  }
  // —— 早中盘（敌家都 ≥6 张、我 ≥10 张）跟敌人的单/对：有低代价的牌就跟，不轻易过牌 ——
  const earlyMidFollow = !ctx.leading && !!ctx.previous && !partner && !toBeatPartner && enemyShort >= 6 && hand.length >= 10 &&
    (ctx.previous.type === TYPES.SINGLE || ctx.previous.type === TYPES.PAIR);
  const followCost = (m) => earlyFollowCost(m, ctx.previous, hand, levelRank);
  // 跟单/对：敌短用大牌顶，敌多用够用的小牌
  if (
    !ctx.leading &&
    !toBeatPartner &&
    !isPass(move) &&
    (move.combo?.type === TYPES.SINGLE || move.combo?.type === TYPES.PAIR) &&
    ctx.previous?.type === move.combo.type
  ) {
    const st = cappedStrength(move.combo.rank);
    if (enemyShort <= 2) score += st * 3;
    else score += (15 - st) * 2;
    // 有孤单可跟时勿拆对/三张出单
    if (
      move.combo.type === TYPES.SINGLE &&
      (byRank.get(move.combo.rank) || 0) >= 2 &&
      // 早中盘只认“可用的孤单”（非级牌/王/逢人配）；只剩王、级牌孤单时拆对跟不算浪费
      (allMoves || []).some((m) => isOrphanSingleMove(m, byRank) && (!earlyMidFollow || followCost(m) === 0))
    ) {
      score -= enemyShort <= 1 ? 0 : 40;
    } else if (
      // 敌家都 ≥3 张、没有孤单能跟：拆对/三张出单不如过牌（拿到牌权也走不完时）
      move.combo.type === TYPES.SINGLE && enemyShort >= 3 && !winThenGood &&
      (hand.filter((c) => c.rank === move.combo.rank && !(c.rank === levelRank && c.suit === 'H')).length >= 2 || (move.combo.rank === levelRank && (byRank.get(levelRank) || 0) >= 2))
    ) {
      score -= earlyMidFollow ? 10 : 30;
      tags.push('breakNoOrphan');
    }
    // 跟单/对：有天然同型可跟时勿拆三张
    const need0 = move.combo.type === TYPES.SINGLE ? 1 : 2;
    if (enemyShort >= 3 && (byRank.get(move.combo.rank) || 0) === 3 &&
      (allMoves || []).some((m) => m.combo?.type === move.combo.type && !usesWild(m, levelRank) && (byRank.get(m.combo.rank) || 0) === need0)) {
      score -= 25;
      tags.push('keepTripleFollow');
    }
    tags.push('followSize');
  }
  // 敌家牌多：跟单勿用级牌/王
  if (
    !ctx.leading &&
    enemyShort >= 4 &&
    move.combo?.type === TYPES.SINGLE &&
    (move.combo.rank === levelRank || move.combo.rank === 'BJ' || move.combo.rank === 'RJ') &&
    !emptiesHand(move, ctx.hand) &&
    !winThenGood
  ) {
    // 自对局体检 r2：我手短（≤12）或对家短（≤7）时抢牌权更值钱，用王/级牌顶 J 以上单张只小扣分
    const tempo = hand.length <= 12 || partnerCountS <= 7;
    const bigPrev = ctx.previous?.type === TYPES.SINGLE && singleStrength(ctx.previous.rank, levelRank) >= singleStrength('J', levelRank);
    score -= tempo ? (bigPrev ? 15 : 45) : 80;
    tags.push(tempo ? 'keepControlSoft' : 'keepControl');
  }
  // 自对局体检 r2：我手短（≤12）或对家短（≤7）时，敌人出 J 以上单张，用王顶抢牌权（Monte Carlo 显示过牌明显吃亏）
  if (!ctx.leading && ctx.previous && !partner && !toBeatPartner && !isPass(move) && !isBombLike(move.combo) && !emptiesHand(move, ctx.hand) &&
      (hand.length <= 12 || partnerCountS <= 7) && enemyShort >= 3 &&
      move.combo.type === TYPES.SINGLE && ctx.previous.type === TYPES.SINGLE && isJokerRank(move.combo.rank) &&
      singleStrength(ctx.previous.rank, levelRank) >= singleStrength('J', levelRank)) {
    score += winThenGood ? 40 : 20;
    tags.push('tempoTake');
  }
  // 敌家牌多：跟对勿用级牌对/王对（拿到牌权也走不完时）
  if (
    !ctx.leading && enemyShort >= 4 && move.combo?.type === TYPES.PAIR &&
    (move.combo.rank === levelRank || isJokerRank(move.combo.rank)) && !emptiesHand(move, ctx.hand) && !winThenGood
  ) {
    score -= 80;
    tags.push('keepControlPair');
  }
  if (earlyMidFollow) {
    const smallPrev = singleStrength(ctx.previous.rank, levelRank) <= singleStrength('10', levelRank) && ctx.previous.rank !== levelRank;
    if (!isPass(move)) {
      const cost = followCost(move);
      if (cost != null) {
        score += [30, 12, -5][cost] + (smallPrev ? 10 : 0);
        tags.push(`activeFollow:${cost}`);
      }
    } else if ((allMoves || []).some((m) => !isPass(m) && (followCost(m) ?? 9) <= 1)) {
      score -= smallPrev ? 25 : 12;
      tags.push('passiveEarly');
    }
    // 控制牌富余（级牌非红桃 + 王 ≥3 张）：跟 J–A 单张可用一张不成对的级牌/小王顶，不必一直过
    const spare = (m) => !isPass(m) && m.combo?.type === TYPES.SINGLE && ctx.previous.type === TYPES.SINGLE && !smallPrev &&
      (m.combo.rank === levelRank || m.combo.rank === 'BJ' || m.combo.rank === 'RJ') && !usesWild(m, levelRank) &&
      hand.filter((c) => c.rank === m.combo.rank && !isWildCard(c, levelRank)).length === 1 &&
      hand.filter((c) => isJokerRank(c.rank) || (c.rank === levelRank && !isWildCard(c, levelRank))).length >= (m.combo.rank === 'RJ' ? 4 : 3);
    if (spare(move)) {
      score += 90;
      tags.push('spareControl');
    } else if (isPass(move) && (allMoves || []).some(spare)) {
      score -= 12;
      tags.push('passiveEarly');
    }
  }
  // 最小够用：跟单（非敌报单）王/级牌之间优先小的；剩一手可走时则取最稳的大牌
  if (!ctx.leading && !isPass(move) && move.combo?.type === TYPES.SINGLE && ctx.previous?.type === TYPES.SINGLE && !emptiesHand(move, ctx.hand)) {
    const restN = minPlays(restAfter(hand, move), levelRank);
    if (restN <= 1) {
      score += 40 * winProb(move, ctx);
      tags.push('strongBeforeLast');
    } else if (enemyShort >= 2) {
      const r = move.combo.rank;
      score -= r === 'RJ' ? 20 : r === 'BJ' ? 10 : 0;
    }
  }
  if (!ctx.leading && !isPass(move) && !emptiesHand(move, ctx.hand) && !isBombLike(move.combo)) {
    // 手牌一两手可走完：敌家不短时勿拆牌跟
    if (enemyShort >= 3 && !winThenGood) {
      const before = minPlays(hand, levelRank);
      if (before <= 2 && minPlays(restAfter(hand, move), levelRank) >= before) {
        score -= 150;
        tags.push('keepFinish');
      }
    }
    // 敌家牌多：勿用逢人配跟牌
    if ((enemyShort >= 4 || (enemyShort >= 3 && (move.cards?.length || 0) >= 3)) && usesWild(move, levelRank) && !winThenGood) {
      score -= 100;
      tags.push('keepWild');
    } else if (enemyShort >= 2 && wildFillers(move, levelRank) > 0) {
      // 有不用逢人配的同型牌能压：逢人配留着（补炸 / 关键时刻）；用两张逢人配凑普通牌更不划算
      const natAlt = (allMoves || []).some((m) => !isPass(m) && !isBombLike(m.combo) && m.combo?.type === move.combo?.type && !wildFillers(m, levelRank));
      const nf = wildFillers(move, levelRank);
      if (natAlt || nf >= 2) {
        score -= nf >= 2 ? 80 : 40;
        tags.push('wildWaste');
      }
    }
  }
  // 领出：敌家不短时勿用逢人配凑牌型（三带二等）；用级牌三张凑三带二也略扣
  if (ctx.leading && !isPass(move) && !isBombLike(move.combo) && enemyShort >= 3 && !emptiesHand(move, ctx.hand)) {
    if (usesWild(move, levelRank)) {
      score -= 60;
      tags.push('leadNoWild');
    } else if (move.combo?.type === TYPES.FULLHOUSE && move.combo.rank === levelRank) {
      score -= 30;
      tags.push('leadNoLevelTriple');
    }
  }
  if (ctx.leading && !isPass(move)) {
    const poolNonSingle = (allMoves || []).some(
      (m) => !isPass(m) && !isBombLike(m.combo) && m.combo?.type !== TYPES.SINGLE,
    );
    const hasOrphan = [...byRank.values()].some((n) => n === 1);
    // 下家（紧接我出牌的敌人）张数：报单敌人若在搭档之后出，仍可喂搭档
    const nextEnemyN = seatCounts[((ctx.seat ?? 0) + 1) % 4] ?? 27;
    const feedOk1 = partnerCount === 1 && (enemyShort >= 2 || nextEnemyN >= 2);
    // 对家剩 2 张：可用对子（天然对或拆三张，不拆炸）
    const feedPairAvail = partnerCount === 2 && enemyShort >= 3 &&
      (allMoves || []).some((m) => m.combo?.type === TYPES.PAIR && [2, 3].includes(byRank.get(m.combo.rank) || 0) && !usesWild(m, levelRank) && singleStrength(m.combo.rank, levelRank) <= 10);
    // 对家报单：出最小单送牌
    if (feedOk1 && move.combo?.type === TYPES.SINGLE) {
      // 送牌：优先 10 以下的孤单；没有合适孤单才拆牌出最小单
      const lowOrphans = [...byRank.entries()].filter(([r, n]) => n === 1 && singleStrength(r, levelRank) <= 8);
      const isOrphan = isOrphanSingleMove(move, byRank);
      score += 260 - cappedStrength(move.combo.rank) * 6;
      if (lowOrphans.length && !isOrphan) score -= 120;
      tags.push('feedPartner');
    }
    // 对家剩 2 张：出最小对子送（无对子则最小单）
    if (feedPairAvail && move.combo?.type === TYPES.PAIR && [2, 3].includes(byRank.get(move.combo.rank) || 0) && !usesWild(move, levelRank)) {
      score += 150 - cappedStrength(move.combo.rank) * 5 - ((byRank.get(move.combo.rank) || 0) === 3 ? 35 : 0) + 40;
      tags.push('feedPartnerPair');
    }
    // 只剩两张单牌（不能一手出完）：先出大的拿牌权
    if (hand.length === 2 && partnerCount !== 1 && move.combo?.type === TYPES.SINGLE && !(allMoves || []).some((m) => emptiesHand(m, ctx.hand))) {
      const other = hand.find((c) => !move.cards.some((x) => x.id === c.id));
      if (other && singleStrength(move.combo.rank, levelRank) > singleStrength(other.rank, levelRank)) {
        score += 200;
        tags.push('bigFirstTwo');
      }
    }
    // 敌报双（对家非短）：出单不出对
    if (enemyShort === 2 && partnerCount > 2 && !(allMoves || []).some((m) => emptiesHand(m, ctx.hand))) {
      if (move.combo?.type === TYPES.PAIR) score -= 70;
      if (move.combo?.type === TYPES.SINGLE && isOrphanSingleMove(move, byRank) && !(allMoves || []).some((m) => !isBombLike(m.combo) && (m.cards?.length || 0) >= 3)) score += 30;
      tags.push('vsTwoNoPair');
    }
    // 敌报双：出对方接不住的组合（三张/三带二/顺子/连对/钢板）
    if (enemyShort === 2 && partnerCount !== 1 && !isBombLike(move.combo) && (move.cards?.length || 0) >= 3 && !(allMoves || []).some((m) => emptiesHand(m, ctx.hand))) {
      score += 90;
      tags.push('unfollowableVsTwo');
    }
    // 敌家牌多：先走小孤单
    if (
      enemyShort >= 4 &&
      partnerCount !== 1 &&
      !feedPairAvail &&
      !bigPlanLead &&
      isOrphanSingleMove(move, byRank) &&
      singleStrength(move.combo.rank, levelRank) <= 8
    ) {
      score += 60 + (14 - singleStrength(move.combo.rank, levelRank)) * 3;
      tags.push('smallFirst');
    }
    // 敌报单且只能出单：从大出
    if (enemyShort <= 1 && !feedOk1 && !poolNonSingle && move.combo?.type === TYPES.SINGLE) {
      score += cappedStrength(move.combo.rank) * 12 + 55;
      if (isControlRank(move.combo.rank, levelRank)) score += 55; // 抵消 noLeadControl
      tags.push('bigFirstVsLast');
    }
    // 敌报双且手中全是对：拆单不出对
    if (enemyShort === 2 && !hasOrphan && partnerCount !== 1) {
      if (move.combo?.type === TYPES.SINGLE) score += 120;
      if (move.combo?.type === TYPES.PAIR) score -= 60;
      tags.push('vsTwoSingle');
    }
  }

  if (ctx.leading && !isPass(move)) tags.push('control');
  // 领出炸弹：敌家都不短且还有别的牌可出 → 炸弹留后（逢人配补的炸更要留）
  if (ctx.leading && isBombLike(move.combo) && enemyShort >= 4 && !emptiesHand(move, ctx.hand) &&
      (allMoves || []).some((m) => !isPass(m) && !isBombLike(m.combo))) {
    score -= 40 + 20 * wildFillers(move, levelRank);
    tags.push('leadBombLate');
  }
  // —— 手牌规划（handplan）：领出按计划出牌 ——
  if (ctx.leading && !isPass(move) && !emptiesHand(move, ctx.hand)) {
    const pr = planLeadScore(move, ctx, allMoves, { enemyShort, partnerCount, byRank, levelRank });
    score += pr.score;
    tags.push(...pr.tags);
  }
  // —— lookahead：强制走完线 / 夺权喂短搭档 ——
  if (!isPass(move) && !emptiesHand(move, ctx.hand)) {
    let fin = moveFinish(move, ctx, laCache(ctx));
    // 领出炸弹：敌家都 ≥6 张时不按“走完线”加分（炸弹留作后手）
    if (fin && ctx.leading && isBombLike(move.combo) && enemyShort >= 6) fin = null;
    // 领出且搭档报单：喂牌优先，除非确定走完
    const pc1 = (ctx.remainingSeatCounts || [])[((ctx.seat ?? 0) + 2) % 4];
    if (fin === 'likely' && ctx.leading && pc1 === 1) fin = null;
    if (fin) {
      score += fin === 'sure' ? 160 : fin === 'bombBack' ? 115 : 100;
      tags.push(`forceFinish:${fin}`);
    } else if (!ctx.leading && ctx.previous && !resolvePartnerCombo(ctx)) {
      const feed = feedAfter(move, ctx);
      const bombOk = !isBombLike(move.combo) || enemyShort <= 3;
      if (feed && bombOk) {
        const p = winProb(move, ctx);
        if (p >= 0.3) {
          score += Math.round(70 * p) - (isBombLike(move.combo) ? 20 : 0);
          tags.push(`controlFeed:${feed}`);
        }
      }
    }
  }
  if (!ctx.leading && ctx.previous && isPass(move) && partner) {
    const seatP = ctx.seat ?? 0;
    const cP = ctx.remainingSeatCounts || [];
    const sizeP = ctx.previous?.cards?.length || ctx.previous?.size || 1;
    const nextE = cP[(seatP + 1) % 4];
    const hasBlock = (allMoves || []).some((m) => !isPass(m) && !isBombLike(m.combo));
    if (nextE > 0 && nextE === sizeP && hasBlock) {
      const pw = winProb({ combo: ctx.previous, cards: new Array(sizeP).fill(null) }, ctx);
      if (pw < 0.7) { score -= Math.round(50 * (1 - pw)); tags.push('partnerExposed'); }
    }
  }
  // —— 关键拦截（follow 轮）：有敌人可能借这一墩走完时，优先能稳拿这一墩的普通牌，炸弹/逢人配留后 ——
  if (!ctx.leading && ctx.previous && !isPass(move) && !emptiesHand(move, ctx.hand)) {
    const cb = criticalBlock(ctx, partner);
    if (cb) {
      const others = (allMoves || []).filter((m) => !isPass(m) && m !== move);
      const sf = safety(move, ctx);
      if (!isBombLike(move.combo)) {
        const wildM = usesWild(move, levelRank);
        // 自对局体检 r5：压的是对家的牌时，按对家这手被敌人压过的概率缩放拦截加分（对家的 A/大对大概率自己能拿下，不必用王去抢）
        let k = 1;
        if (partner) {
          const sizeP = ctx.previous?.cards?.length || ctx.previous?.size || 1;
          const pw = winProb({ combo: ctx.previous, cards: new Array(sizeP).fill(null) }, ctx);
          k = Math.max(0, Math.min(1, (1 - pw) / 0.5));
        }
        if (sf === 'sure') { score += 60 * k; tags.push('blockSure'); } else if (sf === 'likely') { score += 48 * k; tags.push('blockLikely'); }
        else if (!wildM) { const p = winProb(move, ctx); if (p >= 0.4) { score += Math.round(45 * Math.min(p, 0.85) * k); tags.push('blockProb'); } }
      } else {
        const natSure = others.some((m) => !isBombLike(m.combo) && safety(m, ctx) === 'sure' && !usesWild(m, levelRank));
        if (natSure) { score -= 90; tags.push('blockNoBomb'); }
        else if (usesWild(move, levelRank) && others.some((m) => isBombLike(m.combo) && !usesWild(m, levelRank))) { score -= 15; tags.push('blockNatBomb'); }
        if (wildFillers(move, levelRank) > 0) {
          const nat = others.filter((m) => !isBombLike(m.combo) && !usesWild(m, levelRank));
          const bp = Math.max(0, ...nat.map((m) => winProb(m, ctx)));
          if (bp >= 0.45) { score -= Math.round(140 * bp); tags.push('blockNatural'); }
        }
      }
    }
  }
  return { score, tags };
}

/**
 * 早中盘跟敌人单/对的代价：0 = 天然孤单/天然对子，1 = 拆对出单或拆三张出对，2 = 拆三张出单；
 * null = 不合理（非同型、炸弹、用逢人配、用级牌/王、拆天然炸弹）。
 */
function earlyFollowCost(m, prev, hand, levelRank) {
  if (!m || isPass(m) || !prev || !m.combo || m.combo.type !== prev.type || isBombLike(m.combo)) return null;
  if (usesWild(m, levelRank)) return null;
  const r = m.combo.rank;
  if (r === levelRank || isJokerRank(r)) return null;
  const n = (hand || []).filter((c) => c.rank === r && !isWildCard(c, levelRank)).length;
  const need = m.combo.type === TYPES.SINGLE ? 1 : 2;
  if (n >= 4 || n < need) return null;
  return n - need;
}

/** 跟牌时这一墩是否“关键”：有敌人只剩 1 张，或下家敌人张数恰好等于这一手（可同型压上走完） */
function criticalBlock(ctx, partner) {
  const seat = ctx.seat ?? 0;
  const c = ctx.remainingSeatCounts || [];
  const e1 = c[(seat + 1) % 4], e3 = c[(seat + 3) % 4];
  const size = ctx.previous?.cards?.length || ctx.previous?.size || 1;
  if ((e1 > 0 && e1 <= 1) || (e3 > 0 && e3 <= 1)) return true;
  if (partner && e1 > 0 && e1 === size) return true;
  return false;
}

const PLAN_CACHE = new WeakMap();
function planCache(ctx) { let c = PLAN_CACHE.get(ctx); if (!c) { c = new Map(); PLAN_CACHE.set(ctx, c); } return c; }
export function handPlanFor(ctx) {
  const pc = planCache(ctx);
  if (!pc.has('__plan')) pc.set('__plan', decompose(ctx.hand || [], ctx.levelRank || '2', pc));
  return pc.get('__plan');
}
const R7 = (k, d) => { const v = typeof process !== 'undefined' ? process.env?.[k] : undefined; return v == null ? d : Number(v); };
// 自对局体检 r7：>14 张（开局）用点数计数拆牌计划，领出也按计划
const BIG_PLAN_CACHE = new WeakMap();
function bigPlanCache(ctx) { let c = BIG_PLAN_CACHE.get(ctx); if (!c) { c = new Map(); BIG_PLAN_CACHE.set(ctx, c); } return c; }
export function bigPlanFor(ctx) {
  const hand = ctx.hand || [];
  if (hand.length <= 14 || !R7('R7_PLAN', 1)) return null;
  const pc = bigPlanCache(ctx);
  if (!pc.has('__plan')) pc.set('__plan', decomposeCounts(hand, ctx.levelRank || '2', pc));
  return pc.get('__plan');
}

/**
 * 领出计划分：
 *  - 偏离最优拆牌（拆组合/拆炸/多出一手）扣分；
 *  - 敌家不短：先出计划中最弱的非控制组件（单/对/顺/连对/钢板都算组件），控制牌与炸弹放后；
 *  - 只剩两手（都非炸）：先出更稳的那手；
 *  - 敌报双且只能出单：出最大的非控制孤单。
 */
function planLeadScore(move, ctx, allMoves, { enemyShort, partnerCount, byRank, levelRank }) {
  const tags = [];
  let score = 0;
  const hand = ctx.hand || [];
  const big = bigPlanFor(ctx);
  const plan = big || handPlanFor(ctx);
  if (!plan || plan.plays < 2) return { score, tags };
  const cache = big ? bigPlanCache(ctx) : planCache(ctx);
  const rest = restAfter(hand, move);
  const rp = big ? decomposeCounts(rest, levelRank, cache, big.counts) : decompose(rest, levelRank, cache);
  if (rp) {
    const one = decompose(move.cards, levelRank, cache);
    const moveCost = isBombLike(move.combo) ? 0.3 : one && one.plays === 1 ? one.cost : 1;
    const delta = Math.max(0, rp.cost + moveCost - plan.cost);
    const feedMove = (partnerCount === 1 && move.combo?.type === TYPES.SINGLE) || (partnerCount === 2 && move.combo?.type === TYPES.PAIR);
    if (delta > 0.04 && !feedMove) {
      score -= Math.min(90, 45 * delta);
      tags.push('offPlan');
    }
  }
  const comps = plan.comps;
  const isComp = comps.some((c) => c.key === comboKey(move));
  const partnerFeeding = partnerCount === 1 || partnerCount === 2;
  const weak = comps.filter((c) => c.role !== 'bomb' && c.role !== 'control');
  // 敌家不短：先出最弱组件
  // 敌家 3–4 张：优先出敌家跟不上的大组件（张数大于敌家手牌）
  const enemyMax = Math.max(...(ctx.remainingSeatCounts || []).filter((_, i) => i % 2 !== (ctx.seat ?? 0) % 2).filter((c) => c > 0), 0);
  if (enemyShort >= 3 && enemyShort <= 4 && !partnerFeeding && isComp) {
    const big = weak.filter((c) => c.move.cards.length > enemyMax);
    if (big.length && comboKey(big.sort((x, y) => y.move.cards.length - x.move.cards.length)[0].move) === comboKey(move)) {
      score += 60;
      tags.push('planUnfollowable');
    }
  }
  if (enemyShort >= 3 && !partnerFeeding && weak.length && isComp) {
    // 长组件（顺子/连对/钢板，≥5 张）先出；否则先出最弱组件
    const LONG = new Set([TYPES.STRAIGHT, TYPES.PAIR_SEQ, TYPES.TRIPLE_SEQ]);
    const longU = weak.filter((c) => LONG.has(c.move.combo?.type) && c.move.cards.length >= 5);
    const first = longU.length ? longU[0] : weak[0];
    if (first.key === comboKey(move)) {
      score += longU.length ? (big ? R7('R7_UNIT', 100) : 100) : (big ? R7('R7_WEAK', 45) : 45);
      tags.push(longU.length ? 'planUnitFirst' : 'planWeakFirst');
    } else if (comps.find((c) => c.key === comboKey(move))?.role === 'control' && weak.length >= 1) {
      score -= 20;
      tags.push('planKeepControl');
    }
  }
  // 只剩两手（都非炸）：先出更稳的
  if (plan.plays === 2 && comps.every((c) => c.role !== 'bomb') && isComp && enemyShort >= 2 && !partnerFeeding) {
    const [a, b] = comps.map((c) => c.move);
    const pa = winProb(a, ctx), pb = winProb(b, ctx);
    const strong = pa >= pb ? a : b;
    const weakU = strong === a ? b : a;
    if (enemyShort >= 3 && strong.combo?.type === TYPES.SINGLE && (weakU.cards?.length || 0) >= 2) {
      // 敌家不短、强的是单张而弱的是多张牌型：先出弱的那手，强的留着（单张强牌最容易跟牌走完）
      if (comboKey(weakU) === comboKey(move) && Math.abs(pa - pb) > 0.02) {
        score += 70;
        tags.push('planWeakFirstTwo');
      }
    } else if (comboKey(strong) === comboKey(move) && Math.abs(pa - pb) > 0.02) {
      score += 70;
      tags.push('planStrongFirst');
    }
  }
  // 敌报双、手里只剩散单（无对子/大牌型）：从大到小出非控制孤单；有对子要保护时仍出小单（留大牌回手）
  if (enemyShort === 2 && !partnerFeeding && move.combo?.type === TYPES.SINGLE) {
    const shaped = (allMoves || []).some((m) => !isPass(m) && !isBombLike(m.combo) && (m.cards?.length || 0) >= 2 &&
      !(m.cards || []).some((c) => (byRank.get(c.rank) || 0) >= 4));
    if (!shaped) {
      const ctrl = (r) => r === levelRank || r === 'BJ' || r === 'RJ';
      const orph = (allMoves || []).filter((m) => m.combo?.type === TYPES.SINGLE && (byRank.get(m.combo.rank) || 0) === 1 && !ctrl(m.combo.rank));
      if (orph.length && (byRank.get(move.combo.rank) || 0) === 1 && !ctrl(move.combo.rank)) {
        const top = Math.max(...orph.map((m) => singleStrength(m.combo.rank, levelRank)));
        if (singleStrength(move.combo.rank, levelRank) === top) {
          score += 60;
          tags.push('vsTwoBigSingle');
        }
      }
    }
  }
  return { score, tags };
}

/**
 * 选出建议着法。硬过滤优先于搜索/线性分。
 * @param {object} [ctx]
 * @returns {{ move: object, reason: string, alternatives: object[], ms: number }}
 */
export function decide(ctx = {}) {
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
  // 能一手出完就出完（自对局体检 r1：曾因 forceFinish 加分压过 goOut，三带二/逢人配凑的三张能走却拆着出）
  if (outs.length) {
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
  if (typeof process !== 'undefined' && process.env?.DECIDE_DEBUG) for (const r of ranked.slice(0, Number(process.env.DECIDE_DEBUG) > 1 ? Number(process.env.DECIDE_DEBUG) : 6)) console.error('[decide]', r.move.combo?.type, r.move.cards.map((c) => c.rank).join(''), r.score.toFixed(1), r.tags.join(','));
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return {
    move: best,
    reason: reasonFor(best, full, bestTags),
    alternatives: ranked.slice(1, 4).map((r) => r.move),
    tags: bestTags,
    scored: ranked.slice(0, 40).map((r) => ({ move: r.move, tags: r.tags, score: r.score })),
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
export function recommend(ctx) {
  return decide(ctx);
}
