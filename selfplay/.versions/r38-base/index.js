/**
 * 策略层：选择出牌。可调用 belief / search / ml。必须挡住 7 类失误。
 */
import { TYPES, isBombLike } from '../../../engine/combos.js';
import { legalMoves as _legalMoves } from '../../../engine/legal.js';
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
  r14Mode,
  r14Hot,
  r20Mode,
  r20Counter,
  r21Mode,
  r23Mode,
} from './filters.js';
import { minPlays, restAfter, usesWild, wildFillers } from './shape.js';
import { moveFinish, feedAfter, winProb, finishLine, safety } from './lookahead.js';
import { decompose, decomposeCounts, comboKey } from './handplan.js';
import { endgameApplies, solveEndgame, mkey as egKey } from './endgame.js';
const LA_CACHE = new WeakMap();
function laCache(ctx) { let c = LA_CACHE.get(ctx); if (!c) { c = new Map(); LA_CACHE.set(ctx, c); } return c; }

export { detectStructures, resolvePartnerCombo, isSmallOrdinary, isForbidden, r23Mode };

function reasonFor(move, ctx, tags) {
  const c = move.combo;
  const parts = [];
  // r19：理由文案只说真实情况（有炸弹/有能压的牌时不说“没有合适同型”）
  let legalNow = null;
  const lm = () => legalNow || (legalNow = ctx.hand && ctx.previous && !ctx.leading ? _legalMoves(ctx.hand, ctx.previous, ctx.levelRank || '2', false).filter((m) => m.cards.length) : []);
  if (isPass(move)) {
    if (lm().some((m) => isBombLike(m.combo)) && !lm().some((m) => !isBombLike(m.combo))) parts.push('手里有炸弹能压，但现在动炸不划算，选择过牌保留炸弹。');
    else if (lm().length) parts.push('手里有能压的牌，但现在压不划算，选择过牌保留结构。');
    else parts.push('当前跟牌没有合适同型，选择过牌保留结构。');
  }
  else {
    parts.push(`建议出 ${labelCombo(c)}。`);
  }
  if (tags.includes('goOut')) parts.push((move.cards?.length || 0) > 2 ? '整手可一次走完，直接出完。' : '手中仅剩 1–2 张，能走则走，避免留垃圾牌。');
  if (tags.includes('r21LonePair')) parts.push('开局先走孤立小对，不拆对子去凑中段顺子。');
  if (tags.includes('noFirstBomb')) parts.push('新开局首轮领出不应亮炸弹，留给关键时刻。');
  if (tags.includes('noWasteJ')) parts.push('四张 J 去压三带二是典型炸弹浪费。');
  if (tags.includes('noSFon8') && ctx.hand && _legalMoves(ctx.hand, null, ctx.levelRank || '2', true).some((m) => m.combo?.type === TYPES.STRAIGHT_FLUSH)) parts.push('同花顺去压 8/9 单张收益极差。');
  if (tags.includes('endgame')) parts.push(`残局穷举${ctx._endgame ? `（${ctx._endgame.worlds} 种剩余牌分布）` : ''}：这样走期望最好${ctx._endgame ? `（本方期望 ${ctx._endgame.value.toFixed(2)} 级，原选 ${Number(ctx._endgame.before ?? 0).toFixed(2)}）` : ''}，含出完顺序、双上和接风。`);
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
  // 自对局体检 r9 c2：领出时只看还在打的敌家（已出完的 0 张敌家不算“报单”）；跟牌仍用 enemyShortCount（见 filters 注释，r8 c3）
  const enemyShort = ctx.leading ? liveEnemyMin(ctx) : enemyShortCount(ctx);
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
      // r10 c1：炸后仍有炸（或只剩一手）且敌不短 → 领小炸清路，不扣“留炸”
      // 收窄：避免 R058（炸后剩级牌单+王，应先出单控场）误触
      if (enemyShort >= 4 && !emptiesHand(move, ctx.hand) && bombClearOk(hand, move, levelRank)) {
        tags.push('bombClear');
      } else {
        score -= 80;
        tags.push('holdBombLead');
      }
    }
    if (
      move.combo?.type === TYPES.STRAIGHT ||
      move.combo?.type === TYPES.PAIR_SEQ ||
      move.combo?.type === TYPES.TRIPLE_SEQ
    ) {
      // r23 bit1：两组天然各恰好 3 张的钢板不按“留炸压结构”扣分（否则裸三张总压过钢板）
      let freePlate = false;
      if ((r23Mode() & 1) && move.combo?.type === TYPES.TRIPLE_SEQ && !(move.cards || []).some((c) => isWildCard(c, levelRank))) {
        const rc = new Map();
        for (const c of move.cards || []) rc.set(c.rank, (rc.get(c.rank) || 0) + 1);
        const ranks = [...rc.keys()];
        freePlate = ranks.length === 2 && ranks.every((r) => rc.get(r) === 3 && (byRank.get(r) || 0) === 3);
      }
      if (!freePlate) {
        score -= 55;
        tags.push('holdBombLead');
      } else tags.push('r23FreePlate');
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
    if (r20Counter(move, ctx)) { score += R7('GD_R20_CB', 40); tags.push('r20Counter'); }
    else { score -= 60; tags.push('noCounterBomb'); }
  } else if (r20Counter(move, ctx)) { score += R7('GD_R20_CB', 40); tags.push('r20Counter'); }
  // r20 bit2：短手（≤15）敌人出大王，用红王压（必拿）且余牌 ≤4 手
  if ((r20Mode() & 2) && !ctx.leading && ctx.previous?.type === TYPES.SINGLE && ctx.previous.rank === 'BJ' && !partner && move.combo?.type === TYPES.SINGLE &&
      move.combo.rank === 'RJ' && hand.length <= 15 && !emptiesHand(move, hand) && minPlays(restAfter(hand, move), levelRank) <= R7('GD_R20_RP', 4)) {
    score += R7('GD_R20_RJ', 30); tags.push('r20Seize');
  }
  // r20 bit4：短手（≤10）领出，不拆“天然三张+逢人配”可成的炸弹（有不碰它的领出时）
  if ((r20Mode() & 4) && ctx.leading && !isPass(move) && !isBombLike(move.combo) && hand.length <= 10 && !emptiesHand(move, hand)) {
    const wilds = hand.filter((c) => isWildCard(c, levelRank)).length;
    const bombR = new Set([...byRank.entries()].filter(([r, n]) => !isJokerRank(r) && r !== levelRank && n === 3 && wilds >= 1 && singleStrength(r, levelRank) >= singleStrength('Q', levelRank)).map(([r]) => r));
    const tch = (m) => (m.cards || []).some((c) => bombR.has(c.rank));
    if (bombR.size && tch(move) && (allMoves || []).some((m) => !isPass(m) && !isBombLike(m.combo) && !tch(m) && !usesWild(m, levelRank))) {
      score -= R7('GD_R20_KB', 70); tags.push('r20KeepBomb');
    }
  }
  // 敌家牌多：勿炸普通牌
  // r14（GD_R14，默认关）：敌在快走（≤5 张，或 ≤11 张且最近两手出 ≥6 张）→ bit2 不扣 saveBomb；bit1 有可出的普通压牌时过牌 −35
  const r14h = r14Hot(ctx);
  if (r14h && (r14Mode() & 1) && isPass(move) && (allMoves || []).some((m) => !isPass(m) && !isBombLike(m.combo))) {
    score -= 35;
    tags.push('r14NoPass');
  }
  if (!(r14h && (r14Mode() & 2)) && !ctx.leading && isBombLike(move.combo) && ctx.previous && ORDINARY.has(ctx.previous.type) && enemyShort >= 4 && !emptiesHand(move, ctx.hand)) {
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
  // 自对局体检 r7 c3：手短（≤12）跟敌人单/对，用“计划里本来就单独成一手”的控制牌（王/级牌，非逢人配）且大概率拿下 → 抢牌权（MC：此类过牌常吃亏）
  if (R7('R7_CT', 1) && !ctx.leading && ctx.previous && !partner && !toBeatPartner && !isPass(move) && !emptiesHand(move, ctx.hand) && hand.length <= 12 && enemyShort >= 3 &&
      (move.combo?.type === TYPES.SINGLE || move.combo?.type === TYPES.PAIR) && ctx.previous.type === move.combo.type &&
      (move.combo.rank === levelRank || isJokerRank(move.combo.rank)) && !usesWild(move, levelRank) &&
      enemyShort <= R7('R7_CTE', 13) &&
      // 只奖励“最便宜够用”的控制牌：有更小的级牌/王同型能压就不加（例 dev-r6 R146、dev-real d001）
      !(R7('R7_CTC', 1) && (allMoves || []).some((m) => !isPass(m) && m.combo?.type === move.combo.type && !isBombLike(m.combo) &&
        (m.combo.rank === levelRank || isJokerRank(m.combo.rank)) && !usesWild(m, levelRank) &&
        singleStrength(m.combo.rank, levelRank) < singleStrength(move.combo.rank, levelRank)))) {
    const plan = handPlanFor(ctx);
    const comp = plan && plan.comps.find((c) => c.key === comboKey(move));
    if (comp && comp.role === 'control') {
      const p = winProb(move, ctx);
      if (p >= R7('R7_CTP', 0.85)) {
        score += R7('R7_CTB', 40);
        tags.push('controlTempo');
      }
    }
  }
  // 敌家牌多：跟对勿用级牌对/王对（拿到牌权也走不完时）
  if (
    !ctx.leading && enemyShort >= 4 && move.combo?.type === TYPES.PAIR &&
    (move.combo.rank === levelRank || isJokerRank(move.combo.rank)) && !emptiesHand(move, ctx.hand) && !winThenGood
  ) {
    score -= 80;
    tags.push('keepControlPair');
  }
  // r20 bit16：阻断下家进小牌 —— 早中盘跟敌人小单张、下家是敌：用 K/A（非级牌/王，最多拆对，不拆三张/炸）顶，不用中小单让下家便宜进牌
  if ((r20Mode() & 16) && earlyMidFollow && !isPass(move) && move.combo?.type === TYPES.SINGLE && ctx.previous.type === TYPES.SINGLE &&
      ['K', 'A'].includes(move.combo.rank) && move.combo.rank !== levelRank && (byRank.get(move.combo.rank) || 0) <= 2 && !usesWild(move, levelRank) &&
      singleStrength(ctx.previous.rank, levelRank) <= singleStrength('9', levelRank)) {
    score += R7('GD_R20_BLK', 12); tags.push('r20BlockNext');
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
    // 下家（紧接我出牌的敌人）张数（旧口径 nextEnemyN 仅参考）
    const nextEnemyN = seatCounts[((ctx.seat ?? 0) + 1) % 4] ?? 27;
    // r10 c2：喂报单 = 对家 1 张且我→对家之间无 ≤1 张在打敌人（对家先于报单敌出牌时应喂；例 67200164）
    void nextEnemyN;
    const feedOk1 = partnerCount === 1 && !enemyCutsBeforePartner(ctx, 1);
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
  // r10 c1：炸后仍有炸（或只剩一手）时允许领炸清路
  if (ctx.leading && isBombLike(move.combo) && enemyShort >= 4 && !emptiesHand(move, ctx.hand) &&
      (allMoves || []).some((m) => !isPass(m) && !isBombLike(m.combo))) {
    if (bombClearOk(hand, move, levelRank)) {
      if (!tags.includes('bombClear')) tags.push('bombClear');
    } else {
      score -= 40 + 20 * wildFillers(move, levelRank);
      tags.push('leadBombLate');
    }
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
      // r35 bit2（GD_R35，默认 0）：炸弹喂牌时下家敌人 ≤GD_R35X_N 张（先于搭档接） → 不给喂牌加分
      const m35v = typeof process !== 'undefined' ? process.env?.GD_R35 : undefined; const m35f = m35v == null ? 0 : Number(m35v) || 0;
      const nx35 = (ctx.remainingSeatCounts || [])[((ctx.seat ?? 0) + 1) % 4] ?? 27;
      const r35Skip = !!(m35f & 2) && isBombLike(move.combo) && nx35 <= Number(process.env?.GD_R35X_N ?? 2);
      if (feed && bombOk && !r35Skip) {
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
  // 自对局体检 r9 c1：最小够用炸弹 —— 几个炸弹都能用时，优先少用逢人配、张数少、点数小的（原先启发式按张数给大炸弹加分，常把逢人配补进炸弹）；
  // 大的那个能多给强制走完线（lookahead）时不扣
  if (isBombLike(move.combo) && !emptiesHand(move, hand)) {
    const alts = (allMoves || []).filter((m) => m !== move && isBombLike(m.combo) && !emptiesHand(m, hand));
    if (alts.length) {
      let best = null, bc = Infinity;
      for (const m of alts) { const c = bombCost(m, levelRank); if (c < bc) { bc = c; best = m; } }
      const d = bombCost(move, levelRank) - bc;
      if (d > 0) {
        const FIN = { sure: 3, bombBack: 2, likely: 1 };
        const fm = FIN[moveFinish(move, ctx, laCache(ctx))] || 0;
        const fb = FIN[moveFinish(best, ctx, laCache(ctx))] || 0;
        if (fm <= fb) {
          score -= Math.min(60, d);
          tags.push(wildFillers(move, levelRank) > wildFillers(best, levelRank) ? 'bombWildPad' : 'bombOversize');
        }
      }
    }
  }
  return { score, tags };
}

/** r9：炸弹的“代价”：逢人配补位最贵，其次炸弹级别（张数/同花顺/天王炸），再次点数。 */
export function bombCost(m, levelRank) {
  const c = m.combo;
  const tier = c.type === TYPES.BOMB && (c.rocket || c.rank === 'RJ') ? 12 : c.type === TYPES.STRAIGHT_FLUSH ? 1.5 : (c.bombSize || c.size || m.cards.length) - 4;
  return 20 * wildFillers(m, levelRank) + 6 * tier + 0.5 * Math.min(singleStrength(c.rank, levelRank) || 0, 16);
}

/** r9：还在打的敌家里最少的张数（都出完 → 27）。 */
/** r10 c1：领炸清路 — 炸后仍有天然炸，或炸后 ≤1 手。 */
function bombClearOk(hand, move, levelRank) {
  const rest = restAfter(hand, move);
  const mp = minPlays(rest, levelRank);
  if (mp <= 1) return true;
  if (mp > 2) return false;
  const nat = new Map();
  for (const c of rest) {
    if (isJokerRank(c.rank) || isWildCard(c, levelRank)) continue;
    nat.set(c.rank, (nat.get(c.rank) || 0) + 1);
  }
  return [...nat.values()].some((n) => n >= 4);
}

/** 我与对家之间（按出牌顺序）是否有张数 ≤ size 的在打敌人（会截胡喂牌）。 */
function enemyCutsBeforePartner(ctx, size = 1) {
  const seat = ctx.seat ?? 0;
  const partner = (seat + 2) % 4;
  const c = ctx.remainingSeatCounts || [];
  for (let i = 1; i < 4; i++) {
    const s = (seat + i) % 4;
    if (s === partner) break;
    const n = c[s] ?? 27;
    if (n > 0 && n <= size) return true;
  }
  return false;
}

function liveEnemyMin(ctx) {
  const counts = ctx.remainingSeatCounts || ctx.opponentCounts || [27, 27, 27, 27];
  const seat = ctx.seat ?? 0;
  const live = [(seat + 1) % 4, (seat + 3) % 4].map((s) => counts[s] ?? 27).filter((x) => x > 0);
  return live.length ? Math.min(...live) : 27;
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
  // r27：跟单张时，完整天然 5 顺里的唯一张不是“孤单”（拆顺代价），不比拆多余对子便宜（game6 n25：10S vs KC）
  const r27 = r27Mode();
  if (r27 & 3 && n === 1 && need === 1 && inNaturalStraight(r, hand, levelRank, !!(r27 & 4))) return r27 & 2 ? 2 : 1;
  return n - need;
}
function inNaturalStraight(r, hand, levelRank, interiorOnly) {
  const ORD = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const has = new Set((hand || []).filter((c) => !isWildCard(c, levelRank) && !isJokerRank(c.rank)).map((c) => c.rank));
  for (let i = 0; i + 5 <= ORD.length; i++) {
    const w = ORD.slice(i, i + 5);
    if (!w.every((x) => has.has(x))) continue;
    if ((interiorOnly ? w.slice(1, 4) : w).includes(r)) return true;
  }
  return false;
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
const r22Mode = () => { const v = typeof process !== 'undefined' ? process.env?.GD_R22 : undefined; return v == null ? 1 : Number(v) || 0; }; // r22 GD_R22：bit1=两手残局先出弱牌（已发布，默认 1）；bit2=跟单张不拆顺（A/B −0.035，拒绝）；bit4=bit2 收窄为顺内多余张（−0.030，拒绝）
const r25Mode = () => { const v = typeof process !== 'undefined' ? process.env?.GD_R25 : undefined; return v == null ? 1 : Number(v) || 0; }; // r25 GD_R25：bit1=真开局(27张)顶分顺子→领最小孤立小对；bit2=搭档刚出牌且多牌时，整手炸/同花顺可走也先过；bit4=bit2 放宽到敌出非炸
const r26Mode = () => { const v = typeof process !== 'undefined' ? process.env?.GD_R26 : undefined; return v == null ? 5 : Number(v) || 0; }; // r26 GD_R26：阻断下家进小牌（换牌式，非 r20 加分式）bit1=窄 bit2=宽
const r27Mode = () => { const v = typeof process !== 'undefined' ? process.env?.GD_R27 : undefined; return v == null ? 0 : Number(v) || 0; }; // r27 GD_R27：earlyFollowCost 不把完整5顺里的唯一张当“孤单”（bit1 代价1，bit2 代价2；bit4 仅内点）
const r24Mode = () => { const v = typeof process !== 'undefined' ? process.env?.GD_R24 : undefined; return v == null ? 0 : Number(v) || 0; }; // r24 GD_R24：默认 0；bit1=超窄（手≥22+敌单≤9+唯一内点+端点多余+activeFollow:0）；v1/v2 已拒绝
const r28Mode = () => { const v = typeof process !== 'undefined' ? process.env?.GD_R28 : undefined; return v == null ? 4 : Number(v) || 0; }; // r28 GD_R28（默认 4=bit4 已发）：bit1=两手残局强单近乎必胜则先出强单；bit2=对家出小牌、下家敌≤3 张时顶住
const r30Mode = () => { const v = typeof process !== 'undefined' ? process.env?.GD_R30 : undefined; return v == null ? 1 : Number(v) || 0; }; // r30 GD_R30：放宽 r28 bit4 跟牌候选 bit1=允许王 bit8=王仅作无其他可跟时的后备 bit2=允许拆≥4张同点 bit4=允许逢人配
const r31Mode = () => { const v = typeof process !== 'undefined' ? process.env?.GD_R31 : undefined; return v == null ? 0 : Number(v) || 0; }; // r31 GD_R31：bit1=跟敌牌首选过、出牌敌人剩≤BK 张 → 用最佳炸弹拦；bit2=领出首选炸弹且敌人都多牌 → 改最佳非炸
const r32Mode = () => { const v = typeof process !== 'undefined' ? process.env?.GD_R32 : undefined; return v == null ? 0 : Number(v) || 0; }; // r32 GD_R32：bit1=跟敌首选用逢人配(非炸)→同分差内不用逢人配的跟法；bit2=领出首选用逢人配(非炸、非走完)→不用逢人配；bit4=跟敌单张首选拆对子→不拆对子的单张
const r34Mode = () => { const v = typeof process !== 'undefined' ? process.env?.GD_R34 : undefined; return v == null ? 0 : Number(v) || 0; }; // r34 GD_R34：bit1=残局穷举搜索门槛 每座≤3 → ≤GD_R34X_E（默认 4）
const R34 = (k, d) => { const v = typeof process !== 'undefined' ? process.env?.['GD_R34X_' + k] : undefined; return v == null ? d : Number(v); };
const R32 = (k, d) => { const v = typeof process !== 'undefined' ? process.env?.['GD_R32X_' + k] : undefined; return v == null ? d : Number(v); };
const R31 = (k, d) => { const v = typeof process !== 'undefined' ? process.env?.['GD_R31X_' + k] : undefined; return v == null ? d : Number(v); };
const R29 = (k, d) => { const v = typeof process !== 'undefined' ? process.env?.['GD_R29X_' + k] : undefined; return v == null ? d : Number(v); }; // r29 实验参数
const R7 = (k, d) => { const v = typeof process !== 'undefined' ? (process.env?.['GD_R29_' + k] ?? process.env?.['R28_' + k] ?? process.env?.[k]) : undefined; return v == null ? d : Number(v); };
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
    if (enemyShort >= 3 && strong.combo?.type === TYPES.SINGLE && (weakU.cards?.length || 0) >= 2 && !(r28Mode() & 1 && Math.max(pa, pb) >= R7('GD_R28_P', 0.8))) {
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
  // r25 bit2/bit4（GD_R25）：整手是炸弹/同花顺可一次走完，但搭档还多牌、敌人都不近走 → 先过（game5 n49/n53）
  const r25 = r25Mode();
  if (outs.length && r25 & 6 && !full.leading && full.previous && full.previous.type !== TYPES.PASS && isBombLike(outs[0].combo) && (full.hand?.length || 0) >= 5) {
    const cnts = full.remainingSeatCounts || []; const me = full.seat ?? 0; const pt = (me + 2) % 4;
    const enemies = [(me + 1) % 4, (me + 3) % 4].map((s) => cnts[s] ?? 27);
    const passMove = cands.find((m) => isPass(m)) || { cards: [], combo: { type: TYPES.PASS, rank: null, size: 0 } };
    const partnerJust = full.lastPlaySeat === pt;
    const okCtx = (cnts[pt] ?? 0) >= 12 && Math.min(...enemies) >= 8 && !(full.finishedOrder || []).length;
    if (okCtx && ((r25 & 2 && partnerJust) || (r25 & 4 && !partnerJust && !isBombLike(full.previous)))) {
      const scoredOut = scoreAllForGap(outs[0], uniqueByCards(withPass(cands, full)), full);
      const pi = scoredOut.findIndex((r) => isPass(r.move));
      if (pi >= 0) { const [pr] = scoredOut.splice(pi, 1); pr.score = scoredOut[0].score + 1; pr.tags = ['r25HoldExit']; scoredOut.unshift(pr); }
      return {
        move: passMove,
        reason: '整手牌（炸弹/同花顺）随时能走完，但搭档还多牌、敌人都不急，先过牌保留这手，让搭档继续出。',
        alternatives: [outs[0]], tags: ['r25HoldExit'], scored: scoredOut,
        ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0,
      };
    }
  }
  if (outs.length) {
    const move = outs[0];
    // r21：出完时也给出评分表，使用户的过牌/其他着法可算分差（game5 n49/53/57 gap=null）
    const scoredOut = scoreAllForGap(move, uniqueByCards(withPass(cands, full)), full);
    return {
      move,
      reason: reasonFor(move, full, ['goOut']),
      alternatives: cands.filter((m) => m !== move).slice(0, 3),
      tags: ['goOut'],
      scored: scoredOut,
      ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0,
    };
  }

  const beam = beamSearch(full, { beam: 10, timeMs: 20 });
  let pool = uniqueByCards(cands);
  const allowed = pool.filter((m) => !isForbidden(m, full, pool));
  const filteredOut = allowed.length ? pool.filter((m) => !allowed.includes(m)) : [];
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
  // r21 bit2（GD_R21）：开局领出——顶分是中段顺子且拆掉 ≥2 个对子时，改领孤立小对（game5 n1 对 5 优于顺 7–J +0.61）
  if (r21Mode() & 2 && full.leading && (full.hand?.length || 0) >= 20 && ranked[0]?.move.combo?.type === TYPES.STRAIGHT) {
    const lvR = full.levelRank || '2';
    const cntR = new Map();
    for (const c of full.hand) if (!isWildCard(c, lvR)) cntR.set(c.rank, (cntR.get(c.rank) || 0) + 1);
    const st = ranked[0].move;
    const broken = st.cards.filter((c) => !isWildCard(c, lvR) && (cntR.get(c.rank) || 0) >= 2 && (cntR.get(c.rank) || 0) < 4).length;
    if (broken >= 2 && ['10', 'J', 'Q'].includes(st.combo.rank)) {
      const LOWP = ['3', '4', '5', '6', '7'];
      const lone = ranked.filter((r) => r.move.combo?.type === TYPES.PAIR && LOWP.includes(r.move.combo.rank) && r.move.combo.rank !== lvR &&
        cntR.get(r.move.combo.rank) === 2 && !r.move.cards.some((c) => isWildCard(c, lvR)) && !st.cards.some((c) => c.rank === r.move.combo.rank) && r.score > -1e5);
      if (lone.length) {
        lone.sort((a, b) => LOWP.indexOf(a.move.combo.rank) - LOWP.indexOf(b.move.combo.rank));
        const pick = lone[0];
        pick.score = ranked[0].score + 1; pick.tags = pick.tags.concat('r21LonePair');
        ranked.sort((a, b) => b.score - a.score);
        best = pick.move; bestTags = pick.tags; bestS = pick.score;
      }
    }
  }
  // r25 bit1（GD_R25）：本副第一手领出（27 张未动）、顶分是顺子 → 改领最小孤立小对（3–8，正好 2 张天然、非级牌、不与相邻对/三张成连对钢板、不在顺子里）。
  // 与 r21 bit2 不同：不要求拆对/10–Q 顺，只限真开局；game5 n1 对 5 优于顺 7–J（+0.608）。
  if (r25 & 1 && full.leading && full.firstLeadOfDeal && (full.hand?.length || 0) === 27 && ranked[0]?.move.combo?.type === TYPES.STRAIGHT) {
    const lvR = full.levelRank || '2';
    const cntR = new Map();
    for (const c of full.hand) if (!isWildCard(c, lvR) && !isJokerRank(c.rank)) cntR.set(c.rank, (cntR.get(c.rank) || 0) + 1);
    const ORDP = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const LOWP = ['3', '4', '5', '6', '7', '8'];
    const st = ranked[0].move;
    const isolated = (rk) => { const i = ORDP.indexOf(rk); return [ORDP[i - 1], ORDP[i + 1]].every((nb) => nb === lvR || ![2, 3].includes(cntR.get(nb) || 0)); };
    const lone = ranked.filter((r) => r.move.combo?.type === TYPES.PAIR && LOWP.includes(r.move.combo.rank) && r.move.combo.rank !== lvR && r.score > -1e5 &&
      cntR.get(r.move.combo.rank) === 2 && !r.move.cards.some((c) => isWildCard(c, lvR)) && !st.cards.some((c) => c.rank === r.move.combo.rank) && isolated(r.move.combo.rank));
    if (lone.length) {
      lone.sort((a, b) => LOWP.indexOf(a.move.combo.rank) - LOWP.indexOf(b.move.combo.rank));
      const pick = lone[0];
      pick.score = ranked[0].score + 1; pick.tags = pick.tags.concat('r25OpenLonePair');
      ranked.sort((a, b) => b.score - a.score);
      best = pick.move; bestTags = pick.tags; bestS = pick.score;
    }
  }
  // r26（GD_R26）：game4 d2 n6——上家敌人出小单、下家也是敌：首选是拆对的小单（≤9）时，改用同样拆对代价的 K/A 顶住，不让下家便宜进小牌。
  // 与 r20 bit16（全局 +12 加分）不同：只在首选与替代同为 activeFollow:1 且分差小时换。
  const r26 = r26Mode();
  if (r26 & 3 && !full.leading && full.previous?.type === TYPES.SINGLE && ranked[0]?.move.combo?.type === TYPES.SINGLE &&
      full.lastPlaySeat === ((full.seat ?? 0) + 3) % 4) {
    const lvR = full.levelRank || '2'; const nH = full.hand?.length || 0;
    const wide = !!(r26 & 2);
    const prevOk = singleStrength(full.previous.rank, lvR) <= singleStrength(wide ? '8' : '6', lvR) && full.previous.rank !== lvR;
    const top = ranked[0]; const tr = top.move.combo.rank;
    const topOk = (top.tags || []).includes('activeFollow:1') && singleStrength(tr, lvR) <= singleStrength('9', lvR);
    const upCnt = (full.remainingSeatCounts || [])[full.lastPlaySeat] ?? 27;
    if (nH >= (wide ? 20 : 24) && prevOk && topOk && (!(r26 & 4) || upCnt <= 22)) {
      const HI = wide ? ['Q', 'K', 'A'] : ['K', 'A'];
      const alts = ranked.filter((r) => r.move.combo?.type === TYPES.SINGLE && HI.includes(r.move.combo.rank) && r.move.combo.rank !== lvR &&
        (r.tags || []).includes('activeFollow:1') && !isWildCard(r.move.cards[0], lvR) && r.score >= top.score - (wide ? 25 : 15));
      if (alts.length) {
        alts.sort((a, b) => singleStrength(a.move.combo.rank, lvR) - singleStrength(b.move.combo.rank, lvR));
        const pick = alts[0];
        pick.score = top.score + 1; pick.tags = pick.tags.concat('r26BlockNext');
        ranked.sort((a, b) => b.score - a.score);
        best = pick.move; bestTags = pick.tags; bestS = pick.score;
      }
    }
  }
  // r22（GD_R22 位掩码，默认 1；bit2/bit4 已拒绝，仅供实验）
  const r22 = r22Mode();
  // bit1：领出且手里只剩两手（Y + X），X 是能管住 Y 被压后的牌（炸弹，或同型 RJ 单/对）→ 先出 Y（game6 n53：RJRJ+66 应先出 66）
  if (r22 & 1 && full.leading && (full.hand?.length || 0) <= 12) {
    const hand = full.hand; const lvR = full.levelRank || '2';
    const ids = (cs) => cs.map((c) => c.id).sort().join(',');
    for (const r of ranked.slice()) {
      const y = r.move;
      if (!y.cards.length || isBombLike(y.combo) || r.score < -1e5) continue;
      const rest = restAfter(hand, y);
      if (!rest.length) continue;
      const restId = ids(rest);
      const xs = _legalMoves(rest, null, lvR, true).filter((x) => ids(x.cards) === restId);
      const ok = xs.some((x) => isBombLike(x.combo) || (x.combo.type === y.combo.type && x.combo.rank === 'RJ' && (y.combo.type === TYPES.SINGLE || y.combo.type === TYPES.PAIR)));
      if (!ok) continue;
      const top = ranked[0];
      if (top.move === y) break;
      // 仅当当前首选正是那张 X（先出强牌后留弱牌）时改
      if (ids(top.move.cards) !== restId) break;
      r.score = top.score + 1; r.tags = r.tags.concat('r22WeakFirst');
      ranked.sort((a, b) => b.score - a.score);
      best = r.move; bestTags = r.tags; bestS = r.score;
      break;
    }
  }
  // bit2：跟单张时，首选拆掉手里 5 连顺子而有不拆顺子的单张可跟 → 改跟不拆的（game6 n25：跟 KC 留 9–K，不拆 10）
  if (r22 & 2 && !full.leading && full.previous?.type === TYPES.SINGLE && ranked[0]?.move.combo?.type === TYPES.SINGLE) {
    const hand = full.hand; const lvR = full.levelRank || '2';
    const ORD = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const wins = (h) => { const has = new Set(h.filter((c) => !isWildCard(c, lvR) && !isJokerRank(c.rank)).map((c) => c.rank)); const out = []; for (let i = 0; i + 5 <= ORD.length; i++) if (ORD.slice(i, i + 5).every((x) => has.has(x))) out.push(i); return out; };
    const cnt = new Map(); for (const c of hand) cnt.set(c.rank, (cnt.get(c.rank) || 0) + 1);
    const w0 = wins(hand);
    const breaks = (m) => { const w1 = new Set(wins(restAfter(hand, m))); return w0.some((i) => !w1.has(i)); };
    if (w0.length && breaks(ranked[0].move)) {
      const top = ranked[0];
      const alt = ranked.filter((r) => r.move.combo?.type === TYPES.SINGLE && r.score > -1e5 && r.score >= top.score - R7('GD_R22_M', 90) &&
        !isWildCard(r.move.cards[0], lvR) && !isJokerRank(r.move.cards[0].rank) && r.move.cards[0].rank !== lvR && (cnt.get(r.move.cards[0].rank) || 0) < 4 && !breaks(r.move) &&
        (!(r22 & 4) || ((cnt.get(r.move.cards[0].rank) || 0) >= 2 && w0.some((i) => ORD.slice(i, i + 5).includes(r.move.cards[0].rank)))));
      if (alt.length) {
        alt.sort((a, b) => singleStrength(a.move.cards[0].rank, lvR) - singleStrength(b.move.cards[0].rank, lvR));
        const pick = alt[0];
        pick.score = top.score + 1; pick.tags = pick.tags.concat('r22KeepStraight');
        ranked.sort((a, b) => b.score - a.score);
        best = pick.move; bestTags = pick.tags; bestS = pick.score;
      }
    }
  }
  // r23（GD_R23 位掩码，默认 7；bit4 弱证据，A/B 差则关）
  const r23 = r23Mode();
  // bit1：领出首选裸三张，且有相邻另一组天然三张可组钢板 → 改出钢板（game7 n20：555+666）
  if (r23 & 1 && full.leading && ranked[0]?.move.combo?.type === TYPES.TRIPLE) {
    const hand = full.hand; const lvR = full.levelRank || '2';
    const cntN = new Map();
    for (const c of hand) if (!isWildCard(c, lvR) && !isJokerRank(c.rank)) cntN.set(c.rank, (cntN.get(c.rank) || 0) + 1);
    const r0 = ranked[0].move.combo.rank;
    if ((cntN.get(r0) || 0) === 3) {
      const ORD = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
      const i0 = ORD.indexOf(r0);
      const neigh = [];
      if (i0 > 0) neigh.push(ORD[i0 - 1]);
      if (i0 >= 0 && i0 + 1 < ORD.length) neigh.push(ORD[i0 + 1]);
      if (r0 === 'A') neigh.push('2');
      if (r0 === '2') neigh.push('A');
      const free = [...new Set(neigh.filter((r) => (cntN.get(r) || 0) === 3))];
      if (free.length) {
        const plate = ranked.filter((r) => r.move.combo?.type === TYPES.TRIPLE_SEQ && r.score > -1e5 &&
          (r.move.cards || []).length === 6 && !(r.move.cards || []).some((c) => isWildCard(c, lvR)) &&
          ((r.move.combo.low === r0 && free.includes(r.move.combo.rank)) || (r.move.combo.rank === r0 && free.includes(r.move.combo.low))));
        if (plate.length) {
          const top = ranked[0];
          const pick = plate.sort((a, b) => (a.move.combo.rank === r0 ? 0 : 1) - (b.move.combo.rank === r0 ? 0 : 1))[0];
          pick.score = top.score + 1; pick.tags = pick.tags.concat('r23PlateFirst');
          ranked.sort((a, b) => b.score - a.score);
          best = pick.move; bestTags = pick.tags; bestS = pick.score;
        }
      }
    }
  }
  // bit2 已在 filters.detectStructures：三张不进连对结构。此处兜底——若仍首选过牌且有天然对可跟小敌对，改跟最小够用对（game7 n32）
  if (r23 & 2 && !full.leading && full.previous?.type === TYPES.PAIR && isPass(ranked[0]?.move)) {
    const hand = full.hand; const lvR = full.levelRank || '2'; const prev = full.previous;
    if ((hand?.length || 0) >= 10 && (hand?.length || 0) <= 16) {
      const cntN = new Map();
      for (const c of hand) if (!isWildCard(c, lvR) && !isJokerRank(c.rank)) cntN.set(c.rank, (cntN.get(c.rank) || 0) + 1);
      const alts = ranked.filter((r) => r.move.combo?.type === TYPES.PAIR && r.score > -1e5 &&
        (r.move.cards || []).length === 2 && !(r.move.cards || []).some((c) => isWildCard(c, lvR)) &&
        (cntN.get(r.move.combo.rank) || 0) === 2 && singleStrength(r.move.combo.rank, lvR) > singleStrength(prev.rank, lvR));
      if (alts.length) {
        alts.sort((a, b) => singleStrength(a.move.combo.rank, lvR) - singleStrength(b.move.combo.rank, lvR));
        const pick = alts[0]; const top = ranked[0];
        pick.score = top.score + 1; pick.tags = pick.tags.concat('r23CheapPairFollow');
        ranked.sort((a, b) => b.score - a.score);
        best = pick.move; bestTags = pick.tags; bestS = pick.score;
      }
    }
  }
  // bit4：中盘跟敌人中高对（≥J）时，首选是炸且手里有逢人配可扩的近退出炸、手数少 → 改过牌留炸（game7 n36）
  if (r23 & 4 && !full.leading && full.previous?.type === TYPES.PAIR && isBombLike(ranked[0]?.move.combo) && !emptiesHand(ranked[0].move, full.hand)) {
    const hand = full.hand; const lvR = full.levelRank || '2'; const prev = full.previous;
    const nH = hand?.length || 0;
    if (nH >= 10 && nH <= 14 && singleStrength(prev.rank, lvR) >= singleStrength('J', lvR) && prev.rank !== lvR) {
      const wilds = hand.filter((c) => isWildCard(c, lvR)).length;
      const cntN = new Map();
      for (const c of hand) if (!isWildCard(c, lvR) && !isJokerRank(c.rank)) cntN.set(c.rank, (cntN.get(c.rank) || 0) + 1);
      const nearExit = wilds >= 1 && [...cntN.values()].some((n) => n >= 4) && minPlays(hand, lvR) <= 3;
      const pass = ranked.find((r) => isPass(r.move));
      if (nearExit && pass) {
        const top = ranked[0];
        pass.score = top.score + 1; pass.tags = (pass.tags || []).concat('r23KeepExitBomb');
        ranked.sort((a, b) => b.score - a.score);
        best = pass.move; bestTags = pass.tags; bestS = pass.score;
      }
    }
  }
  // r24（GD_R24，默认 0）：超窄——手牌≥22、跟敌单且 prev≤9、首选=完整5顺唯一内点且 activeFollow:0、
  // 同窗端点有多余张 → 改跟最小端点多余张（tag r24SpareKeepStraight）。v1/v2 更宽版 A/B 伤分已拒绝。
  const r24 = r24Mode();
  if (r24 & 1 && !full.leading && full.previous?.type === TYPES.SINGLE && ranked[0]?.move.combo?.type === TYPES.SINGLE &&
      (full.hand?.length || 0) >= 22 && singleStrength(full.previous.rank, full.levelRank || '2') <= singleStrength('9', full.levelRank || '2') &&
      full.previous.rank !== (full.levelRank || '2')) {
    const hand = full.hand; const lvR = full.levelRank || '2';
    const ORD = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const cnt = new Map();
    for (const c of hand) if (!isWildCard(c, lvR) && !isJokerRank(c.rank)) cnt.set(c.rank, (cnt.get(c.rank) || 0) + 1);
    const wins = [];
    for (let i = 0; i + 5 <= ORD.length; i++) {
      const w = ORD.slice(i, i + 5);
      if (w.every((r) => (cnt.get(r) || 0) >= 1)) wins.push(w);
    }
    const top = ranked[0];
    const topR = top.move.cards[0]?.rank;
    const topOrphan = (top.tags || []).some((tg) => tg === 'activeFollow:0');
    const isUniqueInterior = topR && (cnt.get(topR) || 0) === 1 && wins.some((w) => w.slice(1, 4).includes(topR));
    if (isUniqueInterior && topOrphan) {
      const ends = new Set();
      for (const w of wins) if (w.slice(1, 4).includes(topR)) { ends.add(w[0]); ends.add(w[4]); }
      const alts = ranked.filter((r) => r.move.combo?.type === TYPES.SINGLE && r.score > -1e5 &&
        !isWildCard(r.move.cards[0], lvR) && !isJokerRank(r.move.cards[0].rank) && r.move.cards[0].rank !== lvR &&
        ends.has(r.move.cards[0].rank) && (cnt.get(r.move.cards[0].rank) || 0) >= 2 && (cnt.get(r.move.cards[0].rank) || 0) < 4);
      if (alts.length) {
        alts.sort((a, b) => singleStrength(a.move.cards[0].rank, lvR) - singleStrength(b.move.cards[0].rank, lvR));
        const pick = alts[0];
        pick.score = top.score + 1; pick.tags = pick.tags.concat('r24SpareKeepStraight');
        ranked.sort((a, b) => b.score - a.score);
        best = pick.move; bestTags = pick.tags; bestS = pick.score;
      }
    }
  }
  // r28 bit2（GD_R28）：对家出小单/对（≤8）、下家敌人 ≤3 张、对家 ≥4 张，首选过牌 → 用不拆炸的非炸弹顶住
  if (r28Mode() & 2 && !full.leading && (full.previous?.type === TYPES.SINGLE || full.previous?.type === TYPES.PAIR) && isPass(ranked[0]?.move)) {
    const me = full.seat ?? 0; const cnts = full.remainingSeatCounts || []; const lvR = full.levelRank || '2';
    if (full.lastPlaySeat === (me + 2) % 4 && (cnts[(me + 1) % 4] ?? 27) <= 3 && (cnts[(me + 1) % 4] ?? 27) >= (full.previous.type === TYPES.PAIR ? 2 : 1) && (cnts[(me + 2) % 4] ?? 0) >= 4 &&
        singleStrength(full.previous.rank, lvR) <= singleStrength('8', lvR) && full.previous.rank !== lvR) {
      const cntN = new Map();
      for (const c of full.hand || []) if (!isWildCard(c, lvR) && !isJokerRank(c.rank)) cntN.set(c.rank, (cntN.get(c.rank) || 0) + 1);
      const ok = (m) => !isPass(m) && !isBombLike(m.combo) && m.combo?.type === full.previous.type &&
        !(m.cards || []).some((c) => isWildCard(c, lvR) || (cntN.get(c.rank) || 0) >= 4);
      const alts = ranked.filter((r) => r.score > -1e5 && ok(r.move));
      alts.sort((a, b) => b.score - a.score);
      if (alts.length) {
        const top = ranked[0]; const pick = alts[0];
        pick.score = top.score + 1; pick.tags = pick.tags.concat('r28BlockForPartner');
        ranked.sort((a, b) => b.score - a.score);
        best = pick.move; bestTags = pick.tags; bestS = pick.score;
      }
    }
  }
  // r28 bit4（GD_R28）：中盘跟敌人牌首选过牌，但有不拆炸/不用逢人配、分差≤GD_R29_M4 的同型非炸弹 → 跟
  if (r28Mode() & 4 && !full.leading && full.previous && isPass(ranked[0]?.move)) {
    const me = full.seat ?? 0; const lvR = full.levelRank || '2';
    const v37 = typeof process !== 'undefined' ? process.env?.GD_R37 : undefined; const m37 = v37 == null ? 0 : Number(v37) || 0; // r37（默认 0）：bit1=非单跟敌放宽分差 M4N bit2=出牌敌人≤EL 张时不限窗口、分差 ML bit4=手>HI 时仍跟非单
    const X37 = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R37X_' + k] : undefined; return e == null ? d : Number(e); };
    const hl = (full.hand || []).length; const encLeft = full.lastPlaySeat != null ? ((full.remainingSeatCounts || [])[full.lastPlaySeat] ?? 27) : 27;
    const late37 = (m37 & 2) && encLeft > 0 && encLeft <= X37('EL', 6);
    const big37 = (m37 & 4) && hl > R29('HI', 22);
    if (full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 && ((hl >= R29('LO', 1) && hl <= R29('HI', 22)) || late37 || big37)) {
      const cntN = new Map();
      for (const c of full.hand || []) if (!isWildCard(c, lvR) && !isJokerRank(c.rank)) cntN.set(c.rank, (cntN.get(c.rank) || 0) + 1);
      const top = ranked[0];
      const ok = (r) => !isPass(r.move) && !(R7('NS', 0) && r.move.combo?.type === TYPES.SINGLE) && !isBombLike(r.move.combo) && r.score > -1e5 && r.score >= top.score - (late37 ? X37('ML', 250) : (r.move.combo?.type !== TYPES.SINGLE && (m37 & 1)) ? X37('M4N', 200) : R29('M4', R7('M4', 100))) && !(big37 && !late37 && hl > R29('HI', 22) && r.move.combo?.type === TYPES.SINGLE) &&
        !(r.move.cards || []).some((c) => (isWildCard(c, lvR) && !(r30Mode() & 4)) || (isJokerRank(c.rank) && !(r30Mode() & 9)) || ((cntN.get(c.rank) || 0) >= 4 && !(r30Mode() & 2)));
      let alts = ranked.filter(ok);
      if (r30Mode() & 8) { const nj = alts.filter((r) => !(r.move.cards || []).some((c) => isJokerRank(c.rank))); if (nj.length) alts = nj; }
      { const v36 = typeof process !== 'undefined' ? process.env?.GD_R36 : undefined; const m36 = v36 == null ? 0 : Number(v36) || 0; // r36（默认 0）：bit1=中盘跟敌在候选中选最小点 bit2=优先不用控制牌（A/级牌/王）
        if (alts.length > 1 && (m36 & 2)) { const nc = alts.filter((r) => !(r.move.cards || []).some((c) => isControlRank(c.rank, lvR))); if (nc.length) alts = nc; }
        if (alts.length > 1 && (m36 & 1)) { const st = (r) => (r.move.combo?.rank != null ? singleStrength(r.move.combo.rank, lvR) : 99); const mn = Math.min(...alts.map(st)); alts = alts.filter((r) => st(r) === mn); } }
      if (alts.length) {
        const pick = alts[0]; pick.score = top.score + 1; pick.tags = pick.tags.concat('r28MidFollow');
        ranked.sort((a, b) => b.score - a.score);
        best = pick.move; bestTags = pick.tags; bestS = pick.score;
      }
    }
  }
  // r31 bit1（GD_R31）：跟敌人牌首选过，出牌的敌人剩牌 ≤BK → 用评分最高的炸弹拦截
  if (r31Mode() & 1 && !full.leading && full.previous && isPass(ranked[0]?.move) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== (full.seat ?? 0) % 2) {
    const left = (full.remainingSeatCounts || [])[full.lastPlaySeat] ?? 27;
    if (left > 0 && left <= R31('BK', 6)) {
      const top = ranked[0]; const alt = ranked.find((r) => !isPass(r.move) && isBombLike(r.move.combo) && r.score > -1e5);
      if (alt) { alt.score = top.score + 1; alt.tags = alt.tags.concat('r31BombStop'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    }
  }
  // r31 bit2（GD_R31）：领出首选炸弹（非一次走完），敌人都 ≥EM 张 → 改最佳非炸弹
  if (r31Mode() & 2 && full.leading && ranked[0] && isBombLike(ranked[0].move.combo) && (ranked[0].move.cards || []).length < (full.hand || []).length && liveEnemyMin(full) >= R31('EM', 10)) {
    const top = ranked[0]; const alt = ranked.find((r) => !isPass(r.move) && !isBombLike(r.move.combo) && r.score > -1e5);
    if (alt) { alt.score = top.score + 1; alt.tags = alt.tags.concat('r31NoLeadBomb'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
  }
  // r31 bit4（GD_R31）：对家出牌、我首选压对家（非炸），对家剩 ≤PK 张且下家敌人 >3 张 → 改过牌，不抢对家牌权
  if (r31Mode() & 4 && !full.leading && full.previous && ranked[0] && !isPass(ranked[0].move) && !isBombLike(ranked[0].move.combo) && full.lastPlaySeat === ((full.seat ?? 0) + 2) % 4) {
    const me = full.seat ?? 0; const cnts = full.remainingSeatCounts || [];
    const pl = cnts[(me + 2) % 4] ?? 27; const nx = cnts[(me + 1) % 4] ?? 27;
    if (pl > 0 && pl <= R31('PK', 5) && (nx > 3 || nx === 0) && (ranked[0].move.cards || []).length < (full.hand || []).length) {
      const top = ranked[0]; const alt = ranked.find((r) => isPass(r.move));
      if (alt) { alt.score = top.score + 1; alt.tags = alt.tags.concat('r31YieldPartner'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    }
  }
  // r31 bit8（GD_R31）：领出首选单张（非一次走完），下家敌人剩 1..NE 张 → 改评分最高的非单张非炸弹
  if (r31Mode() & 8 && full.leading && ranked[0] && ranked[0].move.combo?.type === TYPES.SINGLE && (ranked[0].move.cards || []).length < (full.hand || []).length) {
    const nx = (full.remainingSeatCounts || [])[((full.seat ?? 0) + 1) % 4] ?? 27;
    if (nx > 0 && nx <= R31('NE', 1)) {
      const top = ranked[0]; const alt = ranked.find((r) => !isPass(r.move) && r.move.combo?.type !== TYPES.SINGLE && !isBombLike(r.move.combo) && r.score > -1e5);
      if (alt) { alt.score = top.score + 1; alt.tags = alt.tags.concat('r31NoSingleVsAlert'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    }
  }
  // r32（GD_R32）：省逢人配 / 跟单不拆对
  if (r32Mode() && ranked[0] && !isPass(ranked[0].move) && !isBombLike(ranked[0].move.combo) && (ranked[0].move.cards || []).length < (full.hand || []).length) {
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const top = ranked[0];
    const vsEnemy = !full.leading && full.previous && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2;
    const usesW = (r) => (r.move.cards || []).some((c) => isWildCard(c, lvR));
    const M = R32('M', 60);
    let alt = null, tag = '';
    if (usesW(top) && ((r32Mode() & 1 && vsEnemy) || (r32Mode() & 2 && full.leading))) {
      alt = ranked.find((r) => r !== top && !isPass(r.move) && !isBombLike(r.move.combo) && r.score > -1e5 && r.score >= top.score - M && !usesW(r)); tag = 'r32SaveWild';
    }
    if (!alt && r32Mode() & 4 && vsEnemy && full.previous?.type === TYPES.SINGLE && top.move.combo?.type === TYPES.SINGLE) {
      const cnt = new Map(); for (const c of full.hand || []) if (!isWildCard(c, lvR)) cnt.set(c.rank, (cnt.get(c.rank) || 0) + 1);
      const r0 = top.move.cards?.[0]?.rank;
      if ((cnt.get(r0) || 0) === 2 || (cnt.get(r0) || 0) === 3) {
        alt = ranked.find((r) => r !== top && r.score > -1e5 && r.score >= top.score - M && r.move.combo?.type === TYPES.SINGLE && !usesW(r) && (cnt.get(r.move.cards?.[0]?.rank) || 0) === 1); tag = 'r32NoSplit';
      }
    }
    if (alt) { alt.score = top.score + 1; alt.tags = alt.tags.concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
  }
  // r33L（GD_R33L，默认 0）：开局领出（手牌≥OH）首选单张/对子 → 分差≤M 内改钢板/连对（bit1）或顺子（bit2），不用逢人配、不拆炸
  { const v = typeof process !== 'undefined' ? process.env?.GD_R33L : undefined; const m33 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R33LX_' + k] : undefined; return e == null ? d : Number(e); };
    if (m33 && full.leading && ranked[0] && (full.hand || []).length >= X('OH', 20) && [TYPES.SINGLE, TYPES.PAIR].includes(ranked[0].move.combo?.type)) {
      const lvR = full.levelRank || '2'; const top = ranked[0]; const M = X('M', 60);
      const want = new Set([...(m33 & 1 ? [TYPES.PAIR_SEQ, TYPES.TRIPLE_SEQ] : []), ...(m33 & 2 ? [TYPES.STRAIGHT] : [])]);
      const alt = ranked.find((r) => r.score > -1e5 && r.score >= top.score - M && want.has(r.move.combo?.type) && !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
      if (alt) { alt.score = top.score + 1; alt.tags = alt.tags.concat('r33OpenLead'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    } }
  // r34 bit2（GD_R34）：首选（非炸、非走完）拆掉手里的同花顺 → 分差≤M 内改不拆同花顺的着法（含过牌仅当跟牌）
  // r34 bit4（GD_R34）：领出、手≤12、首选是控制牌（炸/王单对）且非走完，有分差≤M 的非控制着法使余牌≤2 手且留控制 → 先出非控制
  if (r34Mode() & 6 && ranked[0] && ranked[0].score > -1e5 && (ranked[0].move.cards || []).length < (full.hand || []).length) {
    const lvR = full.levelRank || '2'; const hand = full.hand || []; const top = ranked[0]; const M = R34('M', 60);
    const ids = (cs) => cs.map((c) => c.id);
    const sfIds = (h) => { const set = new Set(); for (const m of _legalMoves(h, null, lvR, true)) if (m.combo?.type === TYPES.STRAIGHT_FLUSH && !m.cards.some((c) => isWildCard(c, lvR))) for (const i of ids(m.cards)) set.add(i); return set; };
    let alt = null, tag = '';
    if (r34Mode() & 2 && !isPass(top.move) && !isBombLike(top.move.combo)) {
      const sf = sfIds(hand);
      const breaks = (m) => (m.cards || []).some((c) => sf.has(c.id)) && sfIds(restAfter(hand, m)).size < sf.size;
      if (sf.size && breaks(top.move)) {
        alt = ranked.find((r) => r !== top && r.score > -1e5 && r.score >= top.score - M && !isBombLike(r.move.combo) && (!isPass(r.move) || !full.leading) && (isPass(r.move) || !breaks(r.move))); tag = 'r34KeepSF';
      }
    }
    const ctrl = (m) => isBombLike(m.combo) || ((m.combo?.type === TYPES.SINGLE || m.combo?.type === TYPES.PAIR) && m.combo.rank === 'RJ');
    if (!alt && r34Mode() & 4 && full.leading && hand.length <= 12 && ctrl(top.move)) {
      alt = ranked.find((r) => r !== top && r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !ctrl(r.move) && minPlays(restAfter(hand, r.move), lvR) <= 2 &&
        _legalMoves(restAfter(hand, r.move), null, lvR, true).some(ctrl)); tag = 'r34CtrlLast';
    }
    if (alt) { alt.score = top.score + 1; alt.tags = alt.tags.concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
  }
  // r35 bit1（GD_R35，默认 0）：首选同点炸弹（非走完、非王炸）用后该点只剩 1 张自然牌 → 改用多一张的同点炸弹（不多用逢人配），免留孤张
  { const v = typeof process !== 'undefined' ? process.env?.GD_R35 : undefined; const m35 = v == null ? 0 : Number(v) || 0;
    const top = ranked[0];
    if (m35 & 1 && top && top.score > -1e5 && top.move.combo?.type === TYPES.BOMB && !top.move.combo.rocket && (top.move.cards || []).length < (full.hand || []).length) {
      const lvR = full.levelRank || '2'; const hand = full.hand || []; const r = top.move.combo.rank; const n = top.move.cards.length;
      const w = (m) => m.cards.filter((c) => isWildCard(c, lvR)).length;
      const left = restAfter(hand, top.move).filter((c) => c.rank === r && !isWildCard(c, lvR)).length;
      if (left === 1) {
        const alt = ranked.find((x) => x.score > -1e5 && x.move.combo?.type === TYPES.BOMB && x.move.combo.rank === r && x.move.cards.length === n + 1 && w(x.move) <= w(top.move));
        if (alt) { alt.score = top.score + 1; alt.tags = alt.tags.concat('r35NoOrphan'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
      }
    } }
  // r36 bit4（GD_R36，默认 0）：早盘领出（手≥OH）首选非单张、非走完 → 分差≤M 内改领最小孤张（自然牌、点≤8、该点仅 1 张、非控制）
  { const v = typeof process !== 'undefined' ? process.env?.GD_R36 : undefined; const m36 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R36X_' + k] : undefined; return e == null ? d : Number(e); };
    const top = ranked[0]; const hand = full.hand || [];
    if (m36 & 4 && full.leading && top && top.score > -1e5 && hand.length >= X('OH', 20) && top.move.combo?.type !== TYPES.SINGLE && !isBombLike(top.move.combo) && (top.move.cards || []).length < hand.length) {
      const lvR = full.levelRank || '2'; const cnt = new Map(); for (const c of hand) if (!isWildCard(c, lvR)) cnt.set(c.rank, (cnt.get(c.rank) || 0) + 1);
      const ok = (r) => r.score > -1e5 && r.score >= top.score - X('M', 60) && r.move.combo?.type === TYPES.SINGLE && !isWildCard(r.move.cards[0], lvR) && !isControlRank(r.move.cards[0].rank, lvR) && (cnt.get(r.move.cards[0].rank) || 0) === 1 && singleStrength(r.move.cards[0].rank, lvR) <= singleStrength('8', lvR);
      const c = ranked.filter(ok).sort((a, b) => singleStrength(a.move.cards[0].rank, lvR) - singleStrength(b.move.cards[0].rank, lvR));
      if (c.length) { const alt = c[0]; alt.score = top.score + 1; alt.tags = alt.tags.concat('r36LoneLead'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    } }
  // r28 bit8（GD_R28）：跟敌人单张选了王，而有级牌单张（非逢人配）也能压 → 改出级牌
  if (r28Mode() & 8 && !full.leading && full.previous?.type === TYPES.SINGLE && ranked[0]?.move?.combo?.type === TYPES.SINGLE && isJokerRank(ranked[0].move.cards?.[0]?.rank)) {
    const me = full.seat ?? 0; const lvR = full.levelRank || '2';
    if (full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2) {
      const lvCnt = (full.hand || []).filter((c) => c.rank === lvR && !isWildCard(c, lvR)).length;
      const alt = ranked.find((r) => r.score > -1e5 && r.move.combo?.type === TYPES.SINGLE && r.move.cards?.[0]?.rank === lvR && !isWildCard(r.move.cards[0], lvR));
      if (alt && lvCnt <= 3) {
        const top = ranked[0]; alt.score = top.score + 1; alt.tags = alt.tags.concat('r28LevelNotJoker');
        ranked.sort((a, b) => b.score - a.score);
        best = alt.move; bestTags = alt.tags; bestS = alt.score;
      }
    }
  }
  // r19 修正 F：残局（在打座位都 ≤3 张）用穷举/完全信息搜索覆盖启发式，只在严格更好时改
  if (R7('GD_R19F', 1) && endgameApplies(full, r34Mode() & 1 ? R34('E', 4) : 3)) {
    const all = uniqueByCards(cands);
    const eg = solveEndgame(full, all);
    if (eg && eg.best && eg.bestValue > (eg.values.get(egKey(best)) ?? -1e9) + 0.01) {
      const before = eg.values.get(egKey(best));
      best = eg.best;
      bestTags = ['endgame'];
      full._endgame = { value: eg.bestValue, before, worlds: eg.worlds };
      const i = ranked.findIndex((r) => sameMove(r.move, best));
      const top = ranked[0]?.score ?? 0;
      if (i >= 0) { const [r] = ranked.splice(i, 1); r.score = top + 1; r.tags = ['endgame']; ranked.unshift(r); }
      else ranked.unshift({ move: best, score: top + 1, tags: ['endgame'] });
    }
  }
  if (typeof process !== 'undefined' && process.env?.DECIDE_DEBUG) for (const r of ranked.slice(0, Number(process.env.DECIDE_DEBUG) > 1 ? Number(process.env.DECIDE_DEBUG) : 6)) console.error('[decide]', r.move.combo?.type, r.move.cards.map((c) => c.rank).join(''), r.score.toFixed(1), r.tags.join(','));
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return {
    move: best,
    reason: reasonFor(best, full, bestTags),
    alternatives: ranked.slice(1, 4).map((r) => r.move),
    tags: bestTags,
    scored: gapScored(ranked, filteredOut, full, pool),
    ms,
  };
}

/** r21：领出/跟牌时补上过牌（跟牌可过）与被过滤的着法，保证用户任何合法着法都能算分差。 */
function withPass(cands, ctx) {
  if (ctx.leading || !ctx.previous || ctx.previous.type === TYPES.PASS) return cands;
  if (cands.some((m) => isPass(m))) return cands;
  return cands.concat([{ cards: [], combo: { type: TYPES.PASS, rank: null, size: 0 } }]);
}
function gapScored(ranked, filteredOut, ctx, pool) {
  const out = ranked.map((r) => ({ move: r.move, tags: r.tags, score: r.score }));
  const low = out.length ? out[out.length - 1].score : 0; // 过滤着法分 ≤ 最佳 − 6（COACH_GAP_MIN），不会被当作“差不多”
  const extra = filteredOut.slice();
  if (!ctx.leading && ctx.previous && ctx.previous.type !== TYPES.PASS && !pool.concat(extra).some((m) => isPass(m))) extra.push({ cards: [], combo: { type: TYPES.PASS, rank: null, size: 0 } });
  for (const m of extra) {
    let sc;
    try { sc = scoreMove(m, ctx, pool).score; } catch { sc = low; }
    // 被策略过滤的着法：分数不高于可选着法最低分（仍给出数值，UI 可显示差距）
    out.push({ move: m, tags: ['filtered'], score: Math.min(sc, (out[0]?.score ?? sc) - 6) });
  }
  return out;
}
function scoreAllForGap(exit, cands, ctx) {
  const out = [];
  for (const m of cands) {
    let sc;
    try { sc = scoreMove(m, ctx, cands).score; } catch { sc = -1e6; }
    out.push({ move: m, tags: m === exit ? ['goOut'] : [], score: sc });
  }
  const top = Math.max(...out.map((r) => r.score));
  const e = out.find((r) => r.move === exit);
  if (e) e.score = top + 1;
  else out.push({ move: exit, tags: ['goOut'], score: top + 1 });
  out.sort((a, b) => b.score - a.score);
  return out;
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
export { reasonFor as _reasonFor };
