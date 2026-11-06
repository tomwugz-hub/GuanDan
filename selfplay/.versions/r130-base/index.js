/**
 * 策略层：选择出牌。可调用 belief / search / ml。必须挡住 7 类失误。
 */
import { TYPES, isBombLike, classify } from '../../../engine/combos.js';
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
import { r42SfPotential } from './tribute.js';
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
  // r53（GD_R53，默认 0）：搭档已出完时 mustBomb 处理。bit1=整段跳过；bit2=仅去掉过牌罚分
  const r53m = (() => { const v = typeof process !== 'undefined' ? process.env?.GD_R53 : undefined; return v == null ? 0 : Number(v) || 0; })();
  const r53PartnerOut = r53m && ctx.seat != null && (ctx.remainingSeatCounts || [])[(ctx.seat + 2) % 4] === 0;
  if (!ctx.leading && enemyShort <= 1 && !(r53PartnerOut && (r53m & 1))) {
    if (isBombLike(move.combo)) {
      // 有能大概率拦住的普通牌时，炸弹（尤其用逢人配的）加分打折
      const bestNB = Math.max(0, ...(allMoves || []).filter((m) => !isPass(m) && !isBombLike(m.combo) && !usesWild(m, levelRank)).map((m) => winProb(m, ctx)));
      const wildBomb = usesWild(move, levelRank);
      score += Math.round(130 * (1 - (wildBomb ? 0.9 : 0.6) * bestNB));
      tags.push('mustBomb');
    } else if (isPass(move) && (hasBomb || poolHasBomb) && !(r53PartnerOut && (r53m & 2))) {
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
const r43Mode = () => { const v = typeof process !== 'undefined' ? process.env?.GD_R43 : undefined; return v == null ? 0 : Number(v) || 0; }; // r43 GD_R43：bit1=offPlan 罚分加重 bit2=planWeakFirst 加分 W
const r44Mode = () => { const v = typeof process !== 'undefined' ? process.env?.GD_R44 : undefined; return v == null ? 0 : Number(v) || 0; }; // r44 GD_R44：bit1=去掉束搜索加分（权重 0） bit2=束搜索加分权重 W（GD_R44X_W，默认 0.15）
const R44 = (k, d) => { const v = typeof process !== 'undefined' ? process.env?.['GD_R44X_' + k] : undefined; return v == null ? d : Number(v); };
const R43 = (k, d) => { const v = typeof process !== 'undefined' ? process.env?.['GD_R43X_' + k] : undefined; return v == null ? d : Number(v); };
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
      const m43 = r43Mode(); // r43 bit1（GD_R43，默认 0）：offPlan 罚分加重 K/CAP
      score -= (m43 & 1) ? Math.min(R43('CAP', 140), R43('K', 70) * delta) : Math.min(90, 45 * delta);
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
      score += longU.length ? (big ? R7('R7_UNIT', 100) : 100) : ((r43Mode() & 2) ? R43('W', 80) : (big ? R7('R7_WEAK', 45) : 45));
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

  const m44 = r44Mode();
  const beamW = m44 & 1 ? 0 : m44 & 2 ? R44('W', 0.15) : 0.05;
  const beam = beamW ? beamSearch(full, { beam: 10, timeMs: 20 }) : [];
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
    const s = score + (extra ? extra.value * beamW : 0);
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
  // r49（GD_R49，默认 0）：r26 邻域。bit1：上家敌出小对（≤8）、首选小对跟（≤9，activeFollow≤1）、手≥20 → 换 K/A 对顶住；bit2：r26 单张版放宽到手≥14、敌单≤10
  { const v = typeof process !== 'undefined' ? process.env?.GD_R49 : undefined; const m49 = v == null ? 0 : Number(v) || 0;
    const lvR = full.levelRank || '2'; const nH = full.hand?.length || 0; const top = ranked[0];
    const up = !full.leading && full.previous && full.lastPlaySeat === ((full.seat ?? 0) + 3) % 4 && top && !isPass(top.move);
    const af = (r) => (r.tags || []).some((t) => t === 'activeFollow:0' || t === 'activeFollow:1');
    const T = full.previous?.type;
    const wP = !!(m49 & 4); if (up && (((m49 & 5) && T === TYPES.PAIR && nH >= (wP ? 16 : 20)) || ((m49 & 2) && T === TYPES.SINGLE && nH >= 14)) && top.move.combo?.type === T &&
        full.previous.rank !== lvR && singleStrength(full.previous.rank, lvR) <= singleStrength(T === TYPES.PAIR ? (wP ? '10' : '8') : '10', lvR) &&
        af(top) && singleStrength(top.move.combo.rank, lvR) <= singleStrength('9', lvR)) {
      const alts = ranked.filter((r) => r.score > -1e5 && r.move.combo?.type === T && (wP && T === TYPES.PAIR ? ['Q', 'K', 'A'] : ['K', 'A']).includes(r.move.combo.rank) && r.move.combo.rank !== lvR &&
        af(r) && !(r.move.cards || []).some((c) => isWildCard(c, lvR)) && r.score >= top.score - 25);
      if (alts.length) { alts.sort((a, b) => singleStrength(a.move.combo.rank, lvR) - singleStrength(b.move.combo.rank, lvR)); const pick = alts[0];
        pick.score = top.score + 1; pick.tags = pick.tags.concat('r49Block'); ranked.sort((a, b) => b.score - a.score); best = pick.move; bestTags = pick.tags; bestS = pick.score; }
    } }
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
    const v38 = typeof process !== 'undefined' ? process.env?.GD_R38 : undefined; const m38 = v38 == null ? 0 : Number(v38) || 0; // r38（默认 0）：收窄 r37 bit4。bit1=仅对子/三张 bit2=hl≥HB(24) bit4=分差≤M(60)
    const X38 = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R38X_' + k] : undefined; return e == null ? d : Number(e); };
    const big38 = m38 !== 0 && !big37 && hl > R29('HI', 22) && (!(m38 & 2) || hl >= X38('HB', 24));
    const ok38 = (r) => !big38 || late37 || (hl >= R29('LO', 1) && hl <= R29('HI', 22)) || (r.move.combo?.type !== TYPES.SINGLE && (!(m38 & 1) || r.move.combo?.type === TYPES.PAIR || r.move.combo?.type === TYPES.TRIPLE) && (!(m38 & 4) || r.score >= ranked[0].score - X38('M', 60)));
    if (full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 && ((hl >= R29('LO', 1) && hl <= R29('HI', 22)) || late37 || big37 || big38)) {
      const cntN = new Map();
      for (const c of full.hand || []) if (!isWildCard(c, lvR) && !isJokerRank(c.rank)) cntN.set(c.rank, (cntN.get(c.rank) || 0) + 1);
      const top = ranked[0];
      const ok = (r) => !isPass(r.move) && !(R7('NS', 0) && r.move.combo?.type === TYPES.SINGLE) && !isBombLike(r.move.combo) && r.score > -1e5 && r.score >= top.score - (late37 ? X37('ML', 250) : (r.move.combo?.type !== TYPES.SINGLE && (m37 & 1)) ? X37('M4N', 200) : R29('M4', R7('M4', 100))) && !(big37 && !late37 && hl > R29('HI', 22) && r.move.combo?.type === TYPES.SINGLE) &&
        !(r.move.cards || []).some((c) => (isWildCard(c, lvR) && !(r30Mode() & 4)) || (isJokerRank(c.rank) && !(r30Mode() & 9)) || ((cntN.get(c.rank) || 0) >= 4 && !(r30Mode() & 2)));
      let alts = ranked.filter((r) => ok(r) && ok38(r));
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
  // r50（GD_R50，默认 3，M=300）：下家敌出牌、对家和上家都已过（我过=下家再领）、首选仍过 → 分差≤M 内最佳非炸同型压住。bit1=不限手数窗口 bit2=仅 hl≤HI(22) 窗口 bit4=仅当下家≤EN 张以外也要求非控制牌
  { const v = typeof process !== 'undefined' ? process.env?.GD_R50 : undefined; const m50 = v == null ? 3 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R50X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hl = (full.hand || []).length;
    if ((m50 & 3) && !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat === (me + 1) % 4 && isPass(ranked[0]?.move) &&
        ((m50 & 1) || hl <= X('HI', 22))) {
      const top = ranked[0];
      const alt = ranked.find((r) => !isPass(r.move) && !isBombLike(r.move.combo) && r.score > -1e5 && r.score >= top.score - X('M', 300) &&
        !(r.move.cards || []).some((c) => isWildCard(c, lvR) || ((m50 & 4) && isControlRank(c.rank, lvR))));
      if (alt) { alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r50NextFollow'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    } }
  // r52（GD_R52，默认 0）：bit1=r50 窗口允许级牌配（hl≤WH）；bit2=对家领/出、首选压对家（非炸）且对家≤PN 张 → 分差≤M 内改过
  { const v = typeof process !== 'undefined' ? process.env?.GD_R52 : undefined; const m52 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R52X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const hl = (full.hand || []).length; const rc = full.remainingSeatCounts || [];
    if ((m52 & 1) && !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat === (me + 1) % 4 && isPass(ranked[0]?.move) && hl <= X('WH', 22)) {
      const top = ranked[0];
      const alt = ranked.find((r) => !isPass(r.move) && !isBombLike(r.move.combo) && r.score > -1e5 && r.score >= top.score - X('M', 300));
      if (alt) { alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r52WildFollow'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    }
    if ((m52 & 2) && !full.leading && full.previous && full.lastPlaySeat === (me + 2) % 4 && ranked[0] && !isPass(ranked[0].move) && !isBombLike(ranked[0].move.combo) &&
        (ranked[0].move.cards || []).length < hl && (rc[(me + 2) % 4] ?? 27) <= X('PN', 6)) {
      const top = ranked[0]; const ps = ranked.find((r) => isPass(r.move));
      if (ps && ps.score >= top.score - X('PM', 300)) { ps.score = top.score + 1; ps.tags = (ps.tags || []).concat('r52LetPartner'); ranked.sort((a, b) => b.score - a.score); best = ps.move; bestTags = ps.tags; bestS = ps.score; }
    } }
  // r51（GD_R51，默认 0）：r50 镜像——上家敌刚出非炸、首选过 → 分差≤M 内最佳非炸同型压住（不用级牌配）。bit1=hl≤HI；bit2=另要求对家 ≥PN 张
  { const v = typeof process !== 'undefined' ? process.env?.GD_R51 : undefined; const m51 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R51X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hl = (full.hand || []).length; const rc = full.remainingSeatCounts || [];
    if ((m51 & 3) && !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat === (me + 3) % 4 && isPass(ranked[0]?.move) &&
        hl <= X('HI', 22) && (!(m51 & 2) || (rc[(me + 2) % 4] ?? 27) >= X('PN', 10))) {
      const top = ranked[0];
      const alt = ranked.find((r) => !isPass(r.move) && !isBombLike(r.move.combo) && r.score > -1e5 && r.score >= top.score - X('M', 300) &&
        !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
      if (alt) { alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r51PrevFollow'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    } }
  // r54（GD_R54，默认 0）：对家出单/对（非小，点≥PR）、首选过、我手 ≤HI 张 → 分差≤M 内最佳非炸非配同型压对家接手。bit1=基本；bit2=另要求对家 ≥PN 张
  { const v = typeof process !== 'undefined' ? process.env?.GD_R54 : undefined; const m54 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R54X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hl = (full.hand || []).length; const rc = full.remainingSeatCounts || [];
    const pv = full.previous;
    if ((m54 & 3) && !full.leading && pv && !isBombLike(pv) && full.lastPlaySeat === (me + 2) % 4 && isPass(ranked[0]?.move) &&
        (pv.type === TYPES.SINGLE || pv.type === TYPES.PAIR) && pv.rank != null && singleStrength(pv.rank, lvR) >= singleStrength(String(X('PR', 8)), lvR) &&
        hl <= X('HI', 12) && (!(m54 & 2) || (rc[(me + 2) % 4] ?? 27) >= X('PN', 6))) {
      const top = ranked[0];
      const alt = ranked.find((r) => !isPass(r.move) && !isBombLike(r.move.combo) && r.score > -1e5 && r.score >= top.score - X('M', 300) &&
        !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
      if (alt) { alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r54TakePartner'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    } }
  // r51 bit4/8（GD_R51，默认 0）：领出时下家敌剩 1 张（bit8 另含 2 张避对）、首选为单（对）且非走完 → 分差≤M 内换别型非炸领
  { const v = typeof process !== 'undefined' ? process.env?.GD_R51 : undefined; const m51 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R51X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const rc = full.remainingSeatCounts || []; const nx = rc[(me + 1) % 4] ?? 27;
    const bad = (t) => (nx === 1 && t === TYPES.SINGLE) || ((m51 & 8) && nx === 2 && t === TYPES.PAIR);
    if ((m51 & 12) && full.leading && ranked[0] && !isPass(ranked[0].move) && bad(ranked[0].move.combo?.type) && (ranked[0].move.cards || []).length < (full.hand || []).length) {
      const top = ranked[0];
      const alt = ranked.find((r) => !isPass(r.move) && !isBombLike(r.move.combo) && !bad(r.move.combo?.type) && r.score > -1e5 && r.score >= top.score - X('LM', 300));
      if (alt) { alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r51AvoidNext'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    } }
  // r39 bit1（GD_R39，默认 0）：对家出小牌（非炸、点≤QR）且我首选过，下家敌人剩 ≤EN 张、对家 >PN 张 → 分差≤M 内用最佳非炸同型顶住，防下家顺走
  { const v = typeof process !== 'undefined' ? process.env?.GD_R39 : undefined; const m39 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R39X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const rc = full.remainingSeatCounts || []; const lvR = full.levelRank || '2';
    if ((m39 & 1) && !full.leading && full.previous && isPass(ranked[0]?.move) && full.lastPlaySeat === (me + 2) % 4 && !isBombLike(full.previous) &&
        (rc[(me + 1) % 4] ?? 27) <= X('EN', 4) && (rc[(me + 1) % 4] ?? 27) > 0 && (rc[(me + 2) % 4] ?? 0) > X('PN', 4) &&
        (full.previous.rank == null || singleStrength(full.previous.rank, lvR) <= singleStrength(X('QR', 10) >= 12 ? 'Q' : '10', lvR))) {
      const top = ranked[0];
      const alt = ranked.find((r) => !isPass(r.move) && !isBombLike(r.move.combo) && r.score > -1e5 && r.score >= top.score - X('M', 100));
      if (alt) { alt.score = top.score + 1; alt.tags = alt.tags.concat('r39TopPartner'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    } }
  // r40（GD_R40，默认 0）：bit1=敌人出炸弹、我首选炸回（非走完），两敌都 ≥EN 张且出炸者 ≥EN → 过牌省炸；bit2=同上但仅当对家 ≥PN 张（对家不急）
  { const v = typeof process !== 'undefined' ? process.env?.GD_R40 : undefined; const m40 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R40X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const rc = full.remainingSeatCounts || [];
    if ((m40 & 3) && !full.leading && full.previous && isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 &&
        ranked[0] && !isPass(ranked[0].move) && isBombLike(ranked[0].move.combo) && (ranked[0].move.cards || []).length < (full.hand || []).length &&
        Math.min(rc[(me + 1) % 4] ?? 27, rc[(me + 3) % 4] ?? 27) >= X('EN', 10) && (!(m40 & 2) || (rc[(me + 2) % 4] ?? 27) >= X('PN', 8))) {
      const top = ranked[0]; const alt = ranked.find((r) => isPass(r.move));
      if (alt) { alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r40SaveBomb'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    } }
  // r40 bit4（GD_R40，默认 0）：领出、对家剩 PF(3) 张、两敌都 ≥EN4(6) 张、首选非走完非单 → 分差≤M4 内领最小非控制单张喂对家
  { const v = typeof process !== 'undefined' ? process.env?.GD_R40 : undefined; const m40 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R40X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const rc = full.remainingSeatCounts || [];
    if ((m40 & 4) && full.leading && ranked[0] && !isPass(ranked[0].move) && ranked[0].move.combo?.type !== TYPES.SINGLE && (ranked[0].move.cards || []).length < (full.hand || []).length &&
        (rc[(me + 2) % 4] ?? 27) === X('PF', 3) && Math.min(rc[(me + 1) % 4] ?? 27, rc[(me + 3) % 4] ?? 27) >= X('EN4', 6)) {
      const top = ranked[0]; const lv = full.levelRank || '2';
      const cands = ranked.filter((r) => r.move.combo?.type === TYPES.SINGLE && r.score > -1e5 && r.score >= top.score - X('M4', 120) && singleStrength(r.move.combo.rank, lv) <= singleStrength('10', lv));
      cands.sort((a, b) => singleStrength(a.move.combo.rank, lv) - singleStrength(b.move.combo.rank, lv));
      const alt = cands[0];
      if (alt) { alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r40FeedP3'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    } }
  // r41（GD_R41，默认 0）：晚盘跟敌窗口——跟敌人非炸牌、首选过，出牌敌人剩 ≤EN 张（>0）且我 ≥MN 张 → 分差≤M 内最佳非炸压牌；bit2 另要求对家未出完且 ≥2 张
  { const v = typeof process !== 'undefined' ? process.env?.GD_R41 : undefined; const m41 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R41X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const rc = full.remainingSeatCounts || [];
    const ls = full.lastPlaySeat; const left = ls != null ? (rc[ls] ?? 27) : 27;
    if ((m41 & 3) && !full.leading && full.previous && !isBombLike(full.previous) && ls != null && ls % 2 !== me % 2 && isPass(ranked[0]?.move) &&
        left > 0 && left <= X('EN', 5) && (full.hand || []).length >= X('MN', 4) && (!(m41 & 2) || (rc[(me + 2) % 4] ?? 0) >= 2)) {
      const top = ranked[0];
      const alt = ranked.find((r) => !isPass(r.move) && !isBombLike(r.move.combo) && r.score > -1e5 && r.score >= top.score - X('M', 80));
      if (alt) { alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r41LateFollow'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    } }
  // r45（GD_R45，默认 2，r45 已发 bit2）：跟敌人非炸牌首选过，手里 = 一个能压的炸弹 + 余牌（余牌 ≤K 手：bit1 K=1，bit2 K=2）→ 炸回夺权再走
  { const v = typeof process !== 'undefined' ? process.env?.GD_R45 : undefined; const m45 = v == null ? 2 : Number(v) || 0;
    const me = full.seat ?? 0; const lvR = full.levelRank || '2';
    if ((m45 & 3) && !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 && isPass(ranked[0]?.move)) {
      const K = m45 & 2 ? 2 : 1; const top = ranked[0];
      const bs = ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && isBombLike(r.move.combo) && (r.move.cards || []).length < (full.hand || []).length && minPlays(restAfter(full.hand, r.move), lvR) <= K);
      bs.sort((a, b) => b.score - a.score);
      if (bs.length) { const alt = bs[0]; alt.score = top.score + 1; alt.tags = alt.tags.concat('r45BombToExit'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    } }
  // r55（GD_R55，默认 0）：跟敌人时首选为炸弹（非走完），而有非炸弹也能压、且余牌手数不多于炸后 → 改出非炸（保炸）。bit1=分差≤M；bit2=不限分差
  { const v = typeof process !== 'undefined' ? process.env?.GD_R55 : undefined; const m55 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R55X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2';
    const top = ranked[0];
    if ((m55 & 3) && !full.leading && full.previous && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 && top && !isPass(top.move) && isBombLike(top.move.combo) && (top.move.cards || []).length < (full.hand || []).length) {
      const kb = minPlays(restAfter(full.hand, top.move), lvR);
      const alt = ranked.find((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo) && ((m55 & 2) || r.score >= top.score - X('M', 300)) &&
        ((r.move.cards || []).length === (full.hand || []).length || minPlays(restAfter(full.hand, r.move), lvR) <= kb));
      if (alt) { alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r55SaveBomb'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    } }
  // r56（GD_R56，默认 0）：领出、对家剩 2 张（bit1）/1–2 张（bit2）、两敌都 >PE 张、首选非走完 → 分差≤M 内领最小非配对子喂对家（bit2：对家1张时领最小单）
  { const v = typeof process !== 'undefined' ? process.env?.GD_R56 : undefined; const m56 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R56X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const rc = full.remainingSeatCounts || []; const hand = full.hand || []; const pc = rc[(me + 2) % 4] ?? 27;
    const top = ranked[0];
    if ((m56 & 3) && full.leading && top && (top.move.cards || []).length < hand.length && (pc === 2 || ((m56 & 2) && pc === 1)) &&
        Math.min(rc[(me + 1) % 4] || 27, rc[(me + 3) % 4] || 27) > X('PE', 3)) {
      const T = pc === 2 ? TYPES.PAIR : TYPES.SINGLE;
      if (top.move.combo?.type !== T) {
        const cs = ranked.filter((r) => r.score > -1e5 && r.move.combo?.type === T && r.score >= top.score - X('M', 10000) && !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
        cs.sort((a, b) => singleStrength(a.move.combo.rank, lvR) - singleStrength(b.move.combo.rank, lvR));
        if (cs[0]) { const alt = cs[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r56FeedP'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
      }
    } }
  // r57（GD_R57，默认 0）：领出、任一敌剩 1–2 张、首选为该敌能接的单（敌1张）/对（敌2张）且非走完 → 分差≤M 内换别型非炸领。bit1=任一敌（含上家）；bit2=敌≤3张时首选单/对都换成≥3张牌型
  { const v = typeof process !== 'undefined' ? process.env?.GD_R57 : undefined; const m57 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R57X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const rc = full.remainingSeatCounts || []; const hand = full.hand || [];
    const ens = [rc[(me + 1) % 4] ?? 27, rc[(me + 3) % 4] ?? 27].filter((n) => n > 0);
    const bad = (t) => (m57 & 1) ? ens.some((n) => (n === 1 && t === TYPES.SINGLE) || (n === 2 && t === TYPES.PAIR)) : ((m57 & 2) && ens.some((n) => n <= 3) && (t === TYPES.SINGLE || t === TYPES.PAIR));
    const top = ranked[0];
    if ((m57 & 3) && full.leading && top && !isPass(top.move) && (top.move.cards || []).length < hand.length && bad(top.move.combo?.type)) {
      const alt = ranked.find((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo) && !bad(r.move.combo?.type) && r.score >= top.score - X('M', 300));
      if (alt) { alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r57AvoidEnemy'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    } }
  // r58（GD_R58，默认 0）：audit-r54 高频弱点。
  // bit1：对家出弱单/对（≤WR）、下家敌≥EN、首选过 → 同型最小非炸非配压接（与 r54/r39 正交）。
  // bit2：领出敌最短≤2、首选≥3 张非炸非走完、手≥HN、对家在 → 改领最佳单/对。
  // bit4：同 bit1，但接手牌不得为控制牌（A/级/王），避免大牌抢对家。
  // bit8：同 bit2，但仅敌最短恰好=2（敌=1 时复杂牌更合理），HN 默认 10。
  // bit16：中盘领出首选单→分差内改最小非配对。
  // bit32：同 bit2，但仅当首选为三张/三带二/钢板（fullhouse 过火为主）。
  // bit64：同 bit2，但只改领单张（不改对）。
  // bit128：中盘跟敌单首选拆对→改不拆对孤张（收窄 r32）。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R58 : undefined; const m58 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R58X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const rc = full.remainingSeatCounts || []; const hand = full.hand || [];
    const pv = full.previous; const top = ranked[0];
    const takeP = (m58 & 1) || (m58 & 4);
    if (takeP && !full.leading && pv && !isBombLike(pv) && full.lastPlaySeat === (me + 2) % 4 && isPass(top?.move) &&
        (pv.type === TYPES.SINGLE || pv.type === TYPES.PAIR) && pv.rank != null &&
        singleStrength(pv.rank, lvR) <= singleStrength(String(X('WR', 10)), lvR) &&
        (rc[(me + 1) % 4] ?? 27) >= X('EN', 10) && hand.length <= X('HI', 22) && hand.length >= X('LO', 4)) {
      const noCtrl = !!(m58 & 4);
      const cands = ranked.filter((r) => !isPass(r.move) && !isBombLike(r.move.combo) && r.move.combo?.type === pv.type &&
        r.score > -1e5 && r.score >= top.score - X('M', 300) && !(r.move.cards || []).some((c) => isWildCard(c, lvR)) &&
        (!noCtrl || !isControlRank(r.move.combo.rank, lvR)));
      cands.sort((a, b) => singleStrength(a.move.combo.rank, lvR) - singleStrength(b.move.combo.rank, lvR));
      if (cands[0]) { const alt = cands[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(noCtrl ? 'r58TakeWeakPSafe' : 'r58TakeWeakP'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    }
    const softLead = (m58 & 2) || (m58 & 8) || (m58 & 32) || (m58 & 64);
    if (softLead && full.leading && top && !isPass(top.move) && !isBombLike(top.move.combo) && (top.move.cards || []).length >= 3 &&
        (top.move.cards || []).length < hand.length && hand.length >= X('HN', (m58 & 8) ? 10 : 8) &&
        (rc[(me + 2) % 4] ?? 0) > 0) {
      const emin = Math.min(rc[(me + 1) % 4] ?? 27, rc[(me + 3) % 4] ?? 27);
      const okE = (m58 & 8) ? (emin === 2) : (emin > 0 && emin <= 2);
      const tt = top.move.combo?.type;
      const okT = !(m58 & 32) || tt === TYPES.FULLHOUSE || tt === TYPES.TRIPLE || tt === TYPES.TRIPLE_SEQ;
      if (okE && okT) {
        const wantPair = !(m58 & 64);
        const cands = ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo) &&
          (r.move.combo?.type === TYPES.SINGLE || (wantPair && r.move.combo?.type === TYPES.PAIR)) &&
          r.score >= top.score - X('M2', 300) && !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
        cands.sort((a, b) => b.score - a.score);
        if (cands[0]) { const alt = cands[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r58SoftShortLead'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
      }
    }
    // bit16：中盘领出首选孤张/单、有非炸非配对子分差≤M3 → 改领最小对（dump midLone≈473；MC lead single→pair）
    if ((m58 & 16) && full.leading && top && top.move.combo?.type === TYPES.SINGLE && (top.move.cards || []).length < hand.length &&
        hand.length >= X('H3', 10) && hand.length <= X('H3H', 20)) {
      const cands = ranked.filter((r) => r.score > -1e5 && r.move.combo?.type === TYPES.PAIR && r.score >= top.score - X('M3', 200) &&
        !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
      cands.sort((a, b) => singleStrength(a.move.combo.rank, lvR) - singleStrength(b.move.combo.rank, lvR));
      if (cands[0]) { const alt = cands[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r58MidPairLead'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    }
    // bit128：中盘跟敌单、首选拆对、有不拆对的非控制单张分差≤M4 → 改不拆对（收窄 r32 bit4）
    if ((m58 & 128) && !full.leading && pv && pv.type === TYPES.SINGLE && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 &&
        top && !isPass(top.move) && top.move.combo?.type === TYPES.SINGLE && hand.length >= X('H4', 12) && hand.length <= X('H4H', 22)) {
      const cnt = new Map(); for (const c of hand) if (!isWildCard(c, lvR)) cnt.set(c.rank, (cnt.get(c.rank) || 0) + 1);
      const topBreaks = (cnt.get(top.move.combo.rank) || 0) >= 2;
      if (topBreaks) {
        const cands = ranked.filter((r) => r.score > -1e5 && r.move.combo?.type === TYPES.SINGLE && r.score >= top.score - X('M4', 80) &&
          (cnt.get(r.move.combo.rank) || 0) === 1 && !isControlRank(r.move.combo.rank, lvR) && !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
        cands.sort((a, b) => singleStrength(a.move.combo.rank, lvR) - singleStrength(b.move.combo.rank, lvR));
        if (cands[0]) { const alt = cands[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r58NoBreakPair'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
      }
    }
  }
  // r59（GD_R59，默认 0）：领出、手里有炸（或炸力）、首选孤儿小单 ≤Rmax(默认 J)、存在完整非炸结构 → 改出该结构（优先吃≥1 孤儿、不拆天然炸）。
  // bit1：仅三带二（fullhouse）；bit2：再含顺/连对/钢板。GD_R59X_M 分差（默认 200）、GD_R59X_Rmax、GD_R59X_MinOrph（默认 1）。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R59 : undefined; const m59 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R59X_' + k] : undefined; return e == null ? d : Number(e); };
    const lvR = full.levelRank || '2'; const hand = full.hand || [];
    const top = ranked[0];
    if ((m59 & 3) && full.leading && top && !isPass(top.move) && (top.move.cards || []).length < hand.length) {
      const byR = new Map(); for (const c of hand) byR.set(c.rank, (byR.get(c.rank) || 0) + 1);
      const hasBombForce = handHasBomb(byR) || ranked.some((r) => r.score > -1e5 && isBombLike(r.move.combo));
      const rmax = String(X('Rmax', 'J'));
      const orphanTop = isOrphanSingleMove(top.move, byR) && !isControlRank(top.move.combo.rank, lvR) &&
        singleStrength(top.move.combo.rank, lvR) <= singleStrength(rmax, lvR);
      const nSmallOrph = [...byR.entries()].filter(([r, n]) => n === 1 && !isControlRank(r, lvR) && singleStrength(r, lvR) <= singleStrength(rmax, lvR)).length;
      if (hasBombForce && orphanTop && nSmallOrph >= X('MinOrph', 1)) {
        const okType = (tt) => tt === TYPES.FULLHOUSE || ((m59 & 2) && (tt === TYPES.STRAIGHT || tt === TYPES.PAIR_SEQ || tt === TYPES.TRIPLE_SEQ));
        const orphans = new Set([...byR.entries()].filter(([, n]) => n === 1).map(([r]) => r));
        const eats = (m) => (m.cards || []).reduce((n, c) => n + (orphans.has(c.rank) ? 1 : 0), 0);
        const cands = ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo) && okType(r.move.combo?.type) &&
          r.score >= top.score - X('M', 200) && !breaksNaturalBomb(r.move, hand, lvR) &&
          !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
        cands.sort((a, b) => (eats(b.move) - eats(a.move)) || (b.score - a.score));
        if (cands[0]) { const alt = cands[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r59StructLead'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
      }
    } }
  // r60（GD_R60，默认 0）：audit-r54 noBombEnemyOut——跟敌、出牌敌剩 ≤EN 张、首选过、有炸且无非炸可压 → 炸拦（比 r31 窄：仅“只能炸”）。
  // bit1：EN=2；bit2：EN=3；bit4：EN=2 且炸后余牌 ≤K 手（默认 2）；bit8：EN=3 且炸后 ≤K；bit16：己方≤HN 残局非炸跟敌。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R60 : undefined; const m60 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R60X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || [];
    const top = ranked[0];
    if ((m60 & 15) && !full.leading && full.previous && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 && isPass(top?.move) &&
        hand.length <= X('HL', 27) && hand.length >= X('HLO', 1)) {
      const left = (full.remainingSeatCounts || [])[full.lastPlaySeat] ?? 27;
      const en = (m60 & 2) || (m60 & 8) ? X('EN', 3) : X('EN', 2);
      const needRest = (m60 & 4) || (m60 & 8);
      if (left > 0 && left <= en) {
        const nonBomb = ranked.some((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo));
        if (!nonBomb) {
          const K = X('K', 2);
          let bs = ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && isBombLike(r.move.combo));
          if (needRest) bs = bs.filter((r) => (r.move.cards || []).length === hand.length || minPlays(restAfter(hand, r.move), lvR) <= K);
          bs.sort((a, b) => b.score - a.score);
          if (bs[0]) { const alt = bs[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r60OnlyBombStop'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
        }
      }
    }
    // bit16：残局抢收——我 ≤HN 张、跟敌非炸、首选过 → 分差≤M 内最佳非炸压（与 r41 正交：按己方手数门而非敌剩余）。
    if ((m60 & 16) && !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 && isPass(top?.move) &&
        hand.length > 0 && hand.length <= X('HN', 8)) {
      const alt = ranked.find((r) => !isPass(r.move) && !isBombLike(r.move.combo) && r.score > -1e5 && r.score >= top.score - X('M', 10000) &&
        !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
      if (alt) { alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r60RaceFollow'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    }
  }
  // r61（GD_R61，默认 0）：大触发面正交。bit1=还贡强制孤张（tribute.js / #ret=r61_1）；
  // bit2：中盘跟敌、首选过、有 activeFollow:0 同型非炸非配 → 分差≤M 内改出（孤张跟，放宽 r28）；
  // bit4：仅单张跟敌放宽分差到 M（沿 r28 单张收益面）；
  // bit8：r50 情境下同分差内改选最小点非炸（沿 r50，换选不换触发）；
  // bit16：对家已出完、跟敌非炸首选过 → 分差≤M 内最佳非炸压（抢收/接风竞速）；
  // bit32：早盘领出（hl≥OH）首选顺/连对/钢板/三带二非走完 → 分差≤M 内改最小非控单/对（MC 早盘结构过重）；
  // bit64：跟敌对、首选仍过（r28 未吃到）→ 分差≤M 内最佳非炸非配对（沿 r28/r23 对子面放宽）。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R61 : undefined; const m61 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R61X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const hl = hand.length;
    const top = ranked[0];
    const enemyPass = !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 && isPass(top?.move);
    if ((m61 & 2) && enemyPass && hl >= X('LO', 1) && hl <= X('HI', 22)) {
      const alts = ranked.filter((r) => !isPass(r.move) && !isBombLike(r.move.combo) && r.move.combo?.type === full.previous.type &&
        r.score > -1e5 && r.score >= top.score - X('M2', 250) && (r.tags || []).includes('activeFollow:0') &&
        !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
      alts.sort((a, b) => b.score - a.score);
      if (alts[0]) { const alt = alts[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r61OrphanFollow'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    }
    if ((m61 & 4) && enemyPass && full.previous.type === TYPES.SINGLE && hl >= X('LO4', 1) && hl <= X('HI4', 22)) {
      // 仅当 r28 未已改出（仍过）时放宽单张分差
      if (isPass(ranked[0]?.move)) {
        const alts = ranked.filter((r) => !isPass(r.move) && !isBombLike(r.move.combo) && r.move.combo?.type === TYPES.SINGLE &&
          r.score > -1e5 && r.score >= top.score - X('M4', 180) &&
          !(r.move.cards || []).some((c) => isWildCard(c, lvR) || isJokerRank(c.rank)));
        alts.sort((a, b) => b.score - a.score);
        if (alts[0]) { const alt = alts[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r61WideSingle'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
      }
    }
    if ((m61 & 8) && !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat === (me + 1) % 4 &&
        ranked[0] && ((ranked[0].tags || []).includes('r50NextFollow') || isPass(ranked[0].move))) {
      const ps = ranked.find((r) => isPass(r.move));
      const passS = ps ? ps.score : (ranked[0].score - 1);
      const cands = ranked.filter((r) => !isPass(r.move) && !isBombLike(r.move.combo) && r.score > -1e5 &&
        (r.score >= passS - X('M8', 300) || (r.tags || []).includes('r50NextFollow')) &&
        !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
      cands.sort((a, b) => singleStrength(a.move.combo?.rank, lvR) - singleStrength(b.move.combo?.rank, lvR));
      if (cands[0] && cands[0].move !== best) {
        const alt = cands[0]; alt.score = (ps ? ps.score : ranked[0].score) + 1; alt.tags = (alt.tags || []).concat('r61R50MinPt');
        ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score;
      }
    }
    if ((m61 & 16) && enemyPass && isPass(ranked[0]?.move)) {
      const rc = full.remainingSeatCounts || [];
      if ((rc[(me + 2) % 4] ?? 27) === 0 && hl >= X('LO16', 1) && hl <= X('HI16', 20)) {
        const alt = ranked.find((r) => !isPass(r.move) && !isBombLike(r.move.combo) && r.score > -1e5 &&
          r.score >= top.score - X('M16', 400) && !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
        if (alt) { alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r61PartnerOutFollow'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
      }
    }
    if ((m61 & 32) && full.leading && ranked[0] && !isPass(ranked[0].move) && (ranked[0].move.cards || []).length < hl &&
        hl >= X('OH', 22)) {
      const tt = ranked[0].move.combo?.type;
      const heavy = tt === TYPES.STRAIGHT || tt === TYPES.PAIR_SEQ || tt === TYPES.TRIPLE_SEQ || tt === TYPES.FULLHOUSE;
      if (heavy) {
        const cands = ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo) &&
          (r.move.combo?.type === TYPES.SINGLE || r.move.combo?.type === TYPES.PAIR) &&
          r.score >= ranked[0].score - X('M32', 120) &&
          !(r.move.cards || []).some((c) => isWildCard(c, lvR)) && !isControlRank(r.move.combo.rank, lvR));
        cands.sort((a, b) => singleStrength(a.move.combo.rank, lvR) - singleStrength(b.move.combo.rank, lvR) ||
          ((a.move.combo.type === TYPES.SINGLE ? 0 : 1) - (b.move.combo.type === TYPES.SINGLE ? 0 : 1)));
        if (cands[0]) { const alt = cands[0]; alt.score = ranked[0].score + 1; alt.tags = (alt.tags || []).concat('r61SoftEarlyLead'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
      }
    }
    if ((m61 & 64) && enemyPass && full.previous?.type === TYPES.PAIR && isPass(ranked[0]?.move) &&
        hl >= X('LO64', 1) && hl <= X('HI64', 22)) {
      const alts = ranked.filter((r) => !isPass(r.move) && !isBombLike(r.move.combo) && r.move.combo?.type === TYPES.PAIR &&
        r.score > -1e5 && r.score >= top.score - X('M64', 160) &&
        !(r.move.cards || []).some((c) => isWildCard(c, lvR) || isJokerRank(c.rank)));
      alts.sort((a, b) => b.score - a.score);
      if (alts[0]) { const alt = alts[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r61WidePair'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    }
  }
  // r62（GD_R62，默认 0）：沿 r50/r45 已发邻域的未穷尽正交。
  // bit1：r50 窗内同分差候选改选余手数最少（出口结构选，非最小点/非级牌配）。
  // bit2：r45 邻域 K=3，但仅下家敌出牌（我过=下家再领）时炸回。
  // bit4：r45 邻域 K=3，但仅上手为顺/连对/钢板/三带二时炸回（结构出口）。
  // bit8：r50 窗内下家敌剩 ≤EN 张 → 放宽 M2 且允许控牌压住（非改默认 M、非级牌配）。
  // bit16：跟敌非炸首选过、有非炸压后余手≤1 且下手敌出牌 → 压（r47∩r50 窗，比 r47 窄）。
  // bit32：r45 出口炸若有同等余手非炸可压 → 改非炸；bit64：敌炸回仅余手≤1。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R62 : undefined; const m62 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R62X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const hl = hand.length;
    const rc = full.remainingSeatCounts || [];
    const r50win = !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat === (me + 1) % 4;
    const enemyPass = !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 && isPass(ranked[0]?.move);
    // bit1：r50 触发窗内，在分差≤M 的非炸非配候选中选余手数最少者（平手保留原分高）
    if ((m62 & 1) && r50win && hl <= X('HI', 22)) {
      const ps = ranked.find((r) => isPass(r.move));
      const passS = ps ? ps.score : (ranked[0]?.score ?? 0);
      const cands = ranked.filter((r) => !isPass(r.move) && !isBombLike(r.move.combo) && r.score > -1e5 &&
        r.score >= passS - X('M', 300) && !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
      if (cands.length) {
        cands.sort((a, b) => minPlays(restAfter(hand, a.move), lvR) - minPlays(restAfter(hand, b.move), lvR) || (b.score - a.score));
        const alt = cands[0];
        if (alt && (isPass(ranked[0]?.move) || (ranked[0].tags || []).includes('r50NextFollow') || alt.move !== best)) {
          alt.score = passS + 1; alt.tags = (alt.tags || []).concat('r62R50MinRest');
          ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score;
        }
      }
    }
    // bit2：下家敌出非炸、首选过、炸弹+余牌≤3手 → 炸回（窄 K=3）
    if ((m62 & 2) && enemyPass && full.lastPlaySeat === (me + 1) % 4) {
      const top = ranked[0]; const K = X('K2', 3);
      const bs = ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && isBombLike(r.move.combo) &&
        (r.move.cards || []).length < hl && minPlays(restAfter(hand, r.move), lvR) <= K);
      bs.sort((a, b) => b.score - a.score);
      if (bs[0] && isPass(ranked[0]?.move)) {
        const alt = bs[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r62BombK3Next');
        ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score;
      }
    }
    // bit4：上手为结构牌型、首选过、炸弹+余牌≤3手 → 炸回
    if ((m62 & 4) && enemyPass) {
      const pt = full.previous?.type;
      const heavy = pt === TYPES.STRAIGHT || pt === TYPES.PAIR_SEQ || pt === TYPES.TRIPLE_SEQ || pt === TYPES.FULLHOUSE;
      if (heavy) {
        const top = ranked[0]; const K = X('K4', 3);
        const bs = ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && isBombLike(r.move.combo) &&
          (r.move.cards || []).length < hl && minPlays(restAfter(hand, r.move), lvR) <= K);
        bs.sort((a, b) => b.score - a.score);
        if (bs[0] && isPass(ranked[0]?.move)) {
          const alt = bs[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r62BombK3Struct');
          ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score;
        }
      }
    }
    // bit8：r50 窗、下家剩≤EN → 分差≤M2 内允许控牌的非炸压（停短下家）
    if ((m62 & 8) && r50win && isPass(ranked[0]?.move)) {
      const nx = rc[(me + 1) % 4] ?? 27;
      if (nx > 0 && nx <= X('EN', 8)) {
        const top = ranked[0];
        const alt = ranked.find((r) => !isPass(r.move) && !isBombLike(r.move.combo) && r.score > -1e5 &&
          r.score >= top.score - X('M2', 500) && !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
        if (alt) {
          alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r62R50StopShort');
          ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score;
        }
      }
    }
    // bit16：r50 窗、首选过、非炸压后余手≤K16 → 压（窄于 r47：仅下家再领窗）
    if ((m62 & 16) && r50win && isPass(ranked[0]?.move)) {
      const top = ranked[0]; const K = X('K16', 1);
      const bs = ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo) &&
        (r.move.cards || []).length < hl && minPlays(restAfter(hand, r.move), lvR) <= K &&
        r.score >= top.score - X('M16', 400) && !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
      bs.sort((a, b) => b.score - a.score);
      if (bs[0]) {
        const alt = bs[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r62BeatExitNext');
        ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score;
      }
    }
    // bit32：r45 误炸修正——首选带 r45BombToExit（或为炸且非走完），存在非炸也能压且余手≤炸后余手 → 改非炸（比 r55 窄：只修 r45 出口炸）
    if ((m62 & 32) && !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2) {
      const top = ranked[0];
      const r45ish = top && !isPass(top.move) && isBombLike(top.move.combo) && (top.move.cards || []).length < hl &&
        ((top.tags || []).includes('r45BombToExit') || minPlays(restAfter(hand, top.move), lvR) <= X('K32', 2));
      if (r45ish) {
        const kb = minPlays(restAfter(hand, top.move), lvR);
        const alt = ranked.find((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo) &&
          ((r.move.cards || []).length === hl || minPlays(restAfter(hand, r.move), lvR) <= kb) &&
          r.score >= top.score - X('M32', 500));
        if (alt) {
          alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r62R45NonBombExit');
          ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score;
        }
      }
    }
    // bit64：敌出炸弹、首选过、有更大炸且炸后余手≤1 → 炸回（严于 r46 bit2 的 K=2）
    if ((m62 & 64) && !full.leading && full.previous && isBombLike(full.previous) && full.lastPlaySeat != null &&
        full.lastPlaySeat % 2 !== me % 2 && isPass(ranked[0]?.move)) {
      const top = ranked[0]; const K = X('K64', 1);
      const bs = ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && isBombLike(r.move.combo) &&
        (r.move.cards || []).length < hl && minPlays(restAfter(hand, r.move), lvR) <= K);
      bs.sort((a, b) => b.score - a.score);
      if (bs[0]) {
        const alt = bs[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r62BombBackK1');
        ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score;
      }
    }
  }
  // r63（GD_R63，默认 0）：新鲜正交。避开已穷尽 r50/r45/r58–r62 邻域。
  // bit1：领出、两敌都 ≥BE 张、首选小单/对（点≤Rmax）非走完 → 分差≤M 内改结构牌（三张/三带二/顺/连对/钢板），避「两敌都能接」。
  // bit2：对家领弱单/对（点≤PR）、首选用控制牌（级/王/A）压对家 → 分差≤M 内改非控同型，否则过（配合非硬压）。
  // bit4：头游冲刺——领出、手≤HN、余手≤K、首选非走完 → 改非炸且余手严格减少的着法。
  // bit8：中盘跟敌（手 LO..HI）、首选非炸用逢人配 → 分差≤M 内改不用逢人配的同型压。
  // bit16：进贡同点多花色选「手中该花色其余张最少」的花色（避拆密花色同花顺潜力；#trib=2 / tribute.js）。
  // bit32：对家已出完、领出首选王单非走完 → 改非王非炸（竞游留控/甩小）。
  // bit64：接风留控——领出、手≥HN、首选控制单（级/王/A）→ 分差≤M 内改≤8 点孤张。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R63 : undefined; const m63 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R63X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const hl = hand.length;
    const rc = full.remainingSeatCounts || [];
    const e1 = rc[(me + 1) % 4] ?? 27, e3 = rc[(me + 3) % 4] ?? 27, p2 = rc[(me + 2) % 4] ?? 27;
    const STRUCT = new Set([TYPES.TRIPLE, TYPES.FULLHOUSE, TYPES.STRAIGHT, TYPES.PAIR_SEQ, TYPES.TRIPLE_SEQ]);
    const setAlt = (alt, tag) => { const top = ranked[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
    // bit1：两敌都厚时，避领「两敌都能接」的小单/对 → 改结构
    if ((m63 & 1) && full.leading && ranked[0] && !isPass(ranked[0].move) && (ranked[0].move.cards || []).length < hl) {
      const top = ranked[0]; const t = top.move.combo?.type;
      const BE = X('BE', 6); const Rmax = X('Rmax', 10);
      if (e1 >= BE && e3 >= BE && (t === TYPES.SINGLE || t === TYPES.PAIR) &&
          singleStrength(top.move.combo.rank, lvR) <= singleStrength(String(Rmax === 10 ? '10' : Rmax), lvR)) {
        const alts = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - X('M1', 80) && !isPass(r.move) && !isBombLike(r.move.combo) &&
          STRUCT.has(r.move.combo?.type) && !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
        alts.sort((a, b) => b.score - a.score);
        if (alts[0]) setAlt(alts[0], 'r63AvoidBothFollow');
      }
    }
    // bit2：对家弱领，不用控制牌硬压；有非控同型则用之，否则过
    if ((m63 & 2) && !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat === (me + 2) % 4 &&
        (full.previous.type === TYPES.SINGLE || full.previous.type === TYPES.PAIR) &&
        singleStrength(full.previous.rank, lvR) <= singleStrength(String(X('PR', 8)), lvR) &&
        ranked[0] && !isPass(ranked[0].move) && !isBombLike(ranked[0].move.combo) && (ranked[0].move.cards || []).length < hl) {
      const top = ranked[0];
      const usesCtrl = (r) => (r.move.cards || []).some((c) => isControlRank(c.rank, lvR) || isWildCard(c, lvR));
      if (usesCtrl(top) && top.move.combo?.type === full.previous.type) {
        const soft = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - X('M2', 100) && !isPass(r.move) && !isBombLike(r.move.combo) &&
          r.move.combo?.type === full.previous.type && !usesCtrl(r));
        soft.sort((a, b) => b.score - a.score);
        if (soft[0]) setAlt(soft[0], 'r63PartnerSoft');
        else {
          const ps = ranked.find((r) => isPass(r.move));
          if (ps) setAlt(ps, 'r63PartnerYield');
        }
      }
    }
    // bit4：头游冲刺——短手领出用非炸推进余手
    if ((m63 & 4) && full.leading && ranked[0] && !isPass(ranked[0].move) && hl <= X('HN4', 8) && (ranked[0].move.cards || []).length < hl) {
      const top = ranked[0]; const cur = minPlays(hand, lvR);
      if (cur <= X('K4', 3)) {
        const alts = ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo) &&
          (r.move.cards || []).length < hl && minPlays(restAfter(hand, r.move), lvR) < cur);
        alts.sort((a, b) => minPlays(restAfter(hand, a.move), lvR) - minPlays(restAfter(hand, b.move), lvR) || (b.score - a.score));
        if (alts[0] && (isBombLike(top.move.combo) || minPlays(restAfter(hand, top.move), lvR) >= cur || alts[0].move !== top.move))
          setAlt(alts[0], 'r63SprintNonBomb');
      }
    }
    // bit8：中盘跟敌省逢人配
    if ((m63 & 8) && !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null &&
        full.lastPlaySeat % 2 !== me % 2 && hl >= X('LO8', 10) && hl <= X('HI8', 20) &&
        ranked[0] && !isPass(ranked[0].move) && !isBombLike(ranked[0].move.combo) && usesWild(ranked[0].move, lvR) &&
        (ranked[0].move.cards || []).length < hl) {
      const top = ranked[0];
      const alt = ranked.find((r) => r.score > -1e5 && r.score >= top.score - X('M8', 60) && !isPass(r.move) && !isBombLike(r.move.combo) &&
        !usesWild(r.move, lvR) && r.move.combo?.type === top.move.combo?.type);
      if (alt) setAlt(alt, 'r63MidNoWild');
    }
    // bit32：对家出完竞游，领出勿甩王单
    if ((m63 & 32) && full.leading && p2 === 0 && ranked[0] && !isPass(ranked[0].move) &&
        ranked[0].move.combo?.type === TYPES.SINGLE && isJokerRank(ranked[0].move.cards?.[0]?.rank) &&
        (ranked[0].move.cards || []).length < hl) {
      const top = ranked[0];
      const alts = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - X('M32', 120) && !isPass(r.move) && !isBombLike(r.move.combo) &&
        !(r.move.cards || []).some((c) => isJokerRank(c.rank)));
      alts.sort((a, b) => {
        const as = a.move.combo?.type === TYPES.SINGLE ? singleStrength(a.move.combo.rank, lvR) : 99;
        const bs = b.move.combo?.type === TYPES.SINGLE ? singleStrength(b.move.combo.rank, lvR) : 99;
        return as - bs || (b.score - a.score);
      });
      if (alts[0]) setAlt(alts[0], 'r63RaceNoJoker');
    }
    // bit64：接风留控——大手领出控单改孤小
    if ((m63 & 64) && full.leading && hl >= X('HN64', 12) && ranked[0] && !isPass(ranked[0].move) &&
        ranked[0].move.combo?.type === TYPES.SINGLE && isControlRank(ranked[0].move.cards?.[0]?.rank, lvR) &&
        (ranked[0].move.cards || []).length < hl) {
      const top = ranked[0];
      const cnt = new Map(); for (const c of hand) if (!isWildCard(c, lvR)) cnt.set(c.rank, (cnt.get(c.rank) || 0) + 1);
      const alts = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - X('M64', 80) && r.move.combo?.type === TYPES.SINGLE &&
        !isControlRank(r.move.cards[0].rank, lvR) && !isWildCard(r.move.cards[0], lvR) &&
        (cnt.get(r.move.cards[0].rank) || 0) === 1 && singleStrength(r.move.cards[0].rank, lvR) <= singleStrength('8', lvR));
      alts.sort((a, b) => singleStrength(a.move.cards[0].rank, lvR) - singleStrength(b.move.cards[0].rank, lvR));
      if (alts[0]) setAlt(alts[0], 'r63KeepCtrlLead');
    }
  }
  // r64（GD_R64，默认 0）：新鲜正交。避开已穷尽 r50/r45/r58–r63。
  // bit1：开局（首轮领出）钢板/连对过猛 → 分差≤M 内改孤小单/对（≤Rmax）。
  // bit2：短敌领出首选级牌对 → 改其它非级非炸对。
  // bit4：跟敌三带二、首选炸 → 有同型非炸可压则改非炸（窄于 r55）。
  // bit8：对家中盘弱单、首选过、有非控同型 → 改非控跟（与 r63bit2 反向：过→跟）。
  // bit16：短敌领出首选长连对 → 改三带二（省张/控场）。
  // bit32：跟敌单、首选用王、有级/A 非王够压 → 改最便宜够用。
  // bit64：对家出完竞游、领出控单（级/王/A）非走完 → 改最小孤张。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R64 : undefined; const m64 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R64X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const hl = hand.length;
    const rc = full.remainingSeatCounts || [];
    const e1 = rc[(me + 1) % 4] ?? 27, e3 = rc[(me + 3) % 4] ?? 27, p2 = rc[(me + 2) % 4] ?? 27;
    const enemyShort = Math.min(e1, e3);
    const setAlt = (alt, tag) => { const top = ranked[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
    // bit1：开局结构改孤小
    if ((m64 & 1) && full.leading && full.firstLeadOfDeal && ranked[0] && !isPass(ranked[0].move) && (ranked[0].move.cards || []).length < hl) {
      const top = ranked[0]; const t = top.move.combo?.type;
      if (t === TYPES.TRIPLE_SEQ || t === TYPES.PAIR_SEQ || t === TYPES.STRAIGHT) {
        const Rmax = X('Rmax', 10);
        const alts = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - X('M1', 100) && !isPass(r.move) && !isBombLike(r.move.combo) &&
          (r.move.combo?.type === TYPES.SINGLE || r.move.combo?.type === TYPES.PAIR) &&
          singleStrength(r.move.combo.rank, lvR) <= singleStrength(String(Rmax === 10 ? '10' : Rmax), lvR) &&
          !isControlRank(r.move.combo.rank, lvR));
        alts.sort((a, b) => singleStrength(a.move.combo.rank, lvR) - singleStrength(b.move.combo.rank, lvR) || (b.score - a.score));
        if (alts[0]) setAlt(alts[0], 'r64OpenSmall');
      }
    }
    // bit2：短敌领出避级牌对
    if ((m64 & 2) && full.leading && enemyShort <= X('ES2', 2) && ranked[0] && !isPass(ranked[0].move) &&
        ranked[0].move.combo?.type === TYPES.PAIR && ranked[0].move.combo.rank === lvR && (ranked[0].move.cards || []).length < hl) {
      const top = ranked[0];
      const alts = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - X('M2', 80) && !isPass(r.move) && !isBombLike(r.move.combo) &&
        r.move.combo?.type === TYPES.PAIR && r.move.combo.rank !== lvR && !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
      alts.sort((a, b) => singleStrength(a.move.combo.rank, lvR) - singleStrength(b.move.combo.rank, lvR) || (b.score - a.score));
      if (alts[0]) setAlt(alts[0], 'r64ShortNoLevelPair');
    }
    // bit4：跟敌三带二误炸 → 同型非炸
    if ((m64 & 4) && !full.leading && full.previous && full.previous.type === TYPES.FULLHOUSE &&
        full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 &&
        ranked[0] && !isPass(ranked[0].move) && isBombLike(ranked[0].move.combo) && (ranked[0].move.cards || []).length < hl) {
      const top = ranked[0];
      const alts = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - X('M4', 150) && !isPass(r.move) && !isBombLike(r.move.combo) &&
        r.move.combo?.type === TYPES.FULLHOUSE);
      alts.sort((a, b) => b.score - a.score);
      if (alts[0]) setAlt(alts[0], 'r64FhNoBomb');
    }
    // bit8：对家弱单过 → 非控跟
    if ((m64 & 8) && !full.leading && full.previous && full.previous.type === TYPES.SINGLE &&
        full.lastPlaySeat === (me + 2) % 4 && isPass(ranked[0]?.move) && hl <= X('HN8', 16) &&
        singleStrength(full.previous.rank, lvR) <= singleStrength(String(X('PR8', 10)), lvR)) {
      const top = ranked[0];
      const alts = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - X('M8', 120) && !isPass(r.move) && !isBombLike(r.move.combo) &&
        r.move.combo?.type === TYPES.SINGLE && !isControlRank(r.move.cards[0].rank, lvR) && !isWildCard(r.move.cards[0], lvR) &&
        !isJokerRank(r.move.cards[0].rank));
      alts.sort((a, b) => singleStrength(a.move.cards[0].rank, lvR) - singleStrength(b.move.cards[0].rank, lvR) || (b.score - a.score));
      if (alts[0]) setAlt(alts[0], 'r64PartnerSoftFollow');
    }
    // bit16：短敌领长连对 → 三带二
    if ((m64 & 16) && full.leading && enemyShort <= X('ES16', 3) && ranked[0] && !isPass(ranked[0].move) &&
        ranked[0].move.combo?.type === TYPES.PAIR_SEQ && (ranked[0].move.cards || []).length >= 6 && (ranked[0].move.cards || []).length < hl) {
      const top = ranked[0];
      const alts = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - X('M16', 100) && !isPass(r.move) && !isBombLike(r.move.combo) &&
        r.move.combo?.type === TYPES.FULLHOUSE);
      alts.sort((a, b) => b.score - a.score);
      if (alts[0]) setAlt(alts[0], 'r64ShortFhOverSeq');
    }
    // bit32：跟敌单用王 → 改级/A
    if ((m64 & 32) && !full.leading && full.previous && full.previous.type === TYPES.SINGLE &&
        full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 &&
        ranked[0] && !isPass(ranked[0].move) && ranked[0].move.combo?.type === TYPES.SINGLE &&
        isJokerRank(ranked[0].move.cards?.[0]?.rank) && (ranked[0].move.cards || []).length < hl) {
      const top = ranked[0];
      const need = singleStrength(full.previous.rank, lvR);
      const alts = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - X('M32', 100) && !isPass(r.move) && !isBombLike(r.move.combo) &&
        r.move.combo?.type === TYPES.SINGLE && !isJokerRank(r.move.cards[0].rank) &&
        singleStrength(r.move.cards[0].rank, lvR) > need);
      alts.sort((a, b) => singleStrength(a.move.cards[0].rank, lvR) - singleStrength(b.move.cards[0].rank, lvR) || (b.score - a.score));
      if (alts[0]) setAlt(alts[0], 'r64CheapOverJoker');
    }
    // bit64：对家出完领控单 → 改最小孤张
    if ((m64 & 64) && full.leading && p2 === 0 && ranked[0] && !isPass(ranked[0].move) &&
        ranked[0].move.combo?.type === TYPES.SINGLE && isControlRank(ranked[0].move.cards?.[0]?.rank, lvR) &&
        (ranked[0].move.cards || []).length < hl) {
      const top = ranked[0];
      const cnt = new Map(); for (const c of hand) if (!isWildCard(c, lvR)) cnt.set(c.rank, (cnt.get(c.rank) || 0) + 1);
      const alts = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - X('M64', 120) && r.move.combo?.type === TYPES.SINGLE &&
        !isControlRank(r.move.cards[0].rank, lvR) && !isWildCard(r.move.cards[0], lvR) &&
        (cnt.get(r.move.cards[0].rank) || 0) === 1);
      alts.sort((a, b) => singleStrength(a.move.cards[0].rank, lvR) - singleStrength(b.move.cards[0].rank, lvR));
      if (alts[0]) setAlt(alts[0], 'r64RaceLeadSmall');
    }
  }
  // r65（GD_R65，默认 0）：新鲜正交。避开已穷尽 r50/r45/r58–r64。
  // bit1：对家出弱/中单（≤PR）、首选过、有控牌（级/A/王）同型 → 最便宜控牌跟（MC partner/passed；与 r58 非炸最小、r64 非控跟反向）。
  // bit2：下家敌剩 1 张、领出首选小单（≤Rmax）非走完 → 改对/三张/三带二（敌只能接单）。
  // bit4：中盘领出首选钢板、有三带二吃≥1 孤张分差≤M → 改三带二（MC lead/mid plate→FH）。
  // bit8：跟敌、上手点=R、手有同点炸、首选过、炸后余手≤K → 同点炸清（MC pass→bomb:9；异于 r60 敌短只能炸）。
  // bit16：跟敌对、首选拆三/配成对、有天然整对可压 → 改天然对。
  // bit32：手≤HN 跟敌非炸、首选过、有非炸压后 sure 走完 → 跟走完。
  // bit64：开局首轮领出首选散三张（非钢板/三带二）非走完 → 有顺/连对则改（散三过早）。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R65 : undefined; const m65 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R65X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const hl = hand.length;
    const rc = full.remainingSeatCounts || [];
    const e1 = rc[(me + 1) % 4] ?? 27, e3 = rc[(me + 3) % 4] ?? 27, p2 = rc[(me + 2) % 4] ?? 27;
    const setAlt = (alt, tag) => { const top = ranked[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
    const isCtrlCard = (c) => isControlRank(c.rank, lvR) || isJokerRank(c.rank) || isWildCard(c, lvR);
    // bit1：对家弱单过 → 控牌跟
    if ((m65 & 1) && !full.leading && full.previous && full.previous.type === TYPES.SINGLE &&
        full.lastPlaySeat === (me + 2) % 4 && isPass(ranked[0]?.move) &&
        singleStrength(full.previous.rank, lvR) <= singleStrength(String(X('PR1', 10)), lvR) &&
        hl <= X('HI1', 18) && hl >= X('LO1', 4)) {
      const top = ranked[0];
      const need = singleStrength(full.previous.rank, lvR);
      const alts = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - X('M1', 200) && !isPass(r.move) && !isBombLike(r.move.combo) &&
        r.move.combo?.type === TYPES.SINGLE && isCtrlCard(r.move.cards[0]) &&
        singleStrength(r.move.cards[0].rank, lvR) > need);
      alts.sort((a, b) => singleStrength(a.move.cards[0].rank, lvR) - singleStrength(b.move.cards[0].rank, lvR) || (b.score - a.score));
      if (alts[0]) setAlt(alts[0], 'r65PartnerCtrlFollow');
    }
    // bit2：下家敌 1 张，领小单 → 改对/三/三带二
    if ((m65 & 2) && full.leading && e1 === 1 && ranked[0] && !isPass(ranked[0].move) &&
        ranked[0].move.combo?.type === TYPES.SINGLE && (ranked[0].move.cards || []).length < hl &&
        singleStrength(ranked[0].move.combo.rank, lvR) <= singleStrength(String(X('Rmax2', 10)), lvR)) {
      const top = ranked[0];
      const alts = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - X('M2', 120) && !isPass(r.move) && !isBombLike(r.move.combo) &&
        (r.move.combo?.type === TYPES.PAIR || r.move.combo?.type === TYPES.TRIPLE || r.move.combo?.type === TYPES.FULLHOUSE) &&
        !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
      alts.sort((a, b) => b.score - a.score);
      if (alts[0]) setAlt(alts[0], 'r65Next1NoSmallSingle');
    }
    // bit4：中盘钢板 → 吃孤三带二
    if ((m65 & 4) && full.leading && ranked[0] && !isPass(ranked[0].move) &&
        ranked[0].move.combo?.type === TYPES.TRIPLE_SEQ && (ranked[0].move.cards || []).length < hl &&
        hl >= X('LO4', 8) && hl <= X('HI4', 18)) {
      const top = ranked[0];
      const cnt = new Map(); for (const c of hand) if (!isWildCard(c, lvR)) cnt.set(c.rank, (cnt.get(c.rank) || 0) + 1);
      const orphanEat = (mv) => (mv.cards || []).some((c) => !isWildCard(c, lvR) && (cnt.get(c.rank) || 0) === 1);
      const alts = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - X('M4', 100) && !isPass(r.move) && !isBombLike(r.move.combo) &&
        r.move.combo?.type === TYPES.FULLHOUSE && orphanEat(r.move));
      alts.sort((a, b) => b.score - a.score);
      if (alts[0]) setAlt(alts[0], 'r65PlateToFhOrphan');
    }
    // bit8：跟敌同点炸清（首选过、炸后余手≤K）
    if ((m65 & 8) && !full.leading && full.previous && !isBombLike(full.previous) && full.previous.rank != null &&
        full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 && isPass(ranked[0]?.move)) {
      const top = ranked[0]; const pr = full.previous.rank; const K = X('K8', 2);
      const alts = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - X('M8', 250) && !isPass(r.move) && isBombLike(r.move.combo) &&
        r.move.combo?.rank === pr && (r.move.cards || []).length < hl && minPlays(restAfter(hand, r.move), lvR) <= K);
      alts.sort((a, b) => minPlays(restAfter(hand, a.move), lvR) - minPlays(restAfter(hand, b.move), lvR) || (b.score - a.score));
      if (alts[0]) setAlt(alts[0], 'r65SameRankBomb');
    }
    // bit16：跟敌对，拆三/配对 → 天然对
    if ((m65 & 16) && !full.leading && full.previous && full.previous.type === TYPES.PAIR &&
        full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 &&
        ranked[0] && !isPass(ranked[0].move) && ranked[0].move.combo?.type === TYPES.PAIR && (ranked[0].move.cards || []).length < hl) {
      const top = ranked[0];
      const cnt = new Map(); for (const c of hand) if (!isWildCard(c, lvR)) cnt.set(c.rank, (cnt.get(c.rank) || 0) + 1);
      const topNatural = !usesWild(top.move, lvR) && (cnt.get(top.move.combo.rank) || 0) === 2;
      if (!topNatural) {
        const alts = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - X('M16', 80) && !isPass(r.move) && !isBombLike(r.move.combo) &&
          r.move.combo?.type === TYPES.PAIR && !usesWild(r.move, lvR) && (cnt.get(r.move.combo.rank) || 0) === 2);
        alts.sort((a, b) => singleStrength(a.move.combo.rank, lvR) - singleStrength(b.move.combo.rank, lvR) || (b.score - a.score));
        if (alts[0]) setAlt(alts[0], 'r65NaturalPairFollow');
      }
    }
    // bit32：短手跟敌，过 → sure 走完非炸
    if ((m65 & 32) && !full.leading && full.previous && !isBombLike(full.previous) &&
        full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 && isPass(ranked[0]?.move) &&
        hl <= X('HN32', 8)) {
      const top = ranked[0];
      const alts = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - X('M32', 200) && !isPass(r.move) && !isBombLike(r.move.combo) &&
        (r.move.cards || []).length < hl && moveFinish(r.move, full) === 'sure');
      alts.sort((a, b) => b.score - a.score);
      if (alts[0]) setAlt(alts[0], 'r65SureFinishFollow');
    }
    // bit64：开局散三张 → 顺/连对
    if ((m65 & 64) && full.leading && full.firstLeadOfDeal && ranked[0] && !isPass(ranked[0].move) &&
        ranked[0].move.combo?.type === TYPES.TRIPLE && (ranked[0].move.cards || []).length < hl) {
      const top = ranked[0];
      const alts = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - X('M64', 100) && !isPass(r.move) && !isBombLike(r.move.combo) &&
        (r.move.combo?.type === TYPES.STRAIGHT || r.move.combo?.type === TYPES.PAIR_SEQ) &&
        !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
      alts.sort((a, b) => b.score - a.score);
      if (alts[0]) setAlt(alts[0], 'r65OpenTripleToSeq');
    }
  }
  // r66（GD_R66，默认 0）：新鲜正交。避开已穷尽 r50/r45/r58–r65。
  // bit1：对家出单、首选非控单压对家、对家剩≤P1 张 → 过（r65 bit1 反向收窄：不抢对家）。
  // bit2：中盘领出首选单/对、有顺子/连对分差≤M → 领长牌（结构领长）。
  // bit4：跟敌顺子、首选过、有非炸顺子可压分差≤M → 跟。
  // bit8：跟敌、首选用百搭（非炸）、有不用百搭的同型分差≤M → 省百搭。
  // bit16：手≤HN 领出 → 分差≤M 内取余手最少者。
  // bit32：领出时两敌都≥E 张 → 分差≤M 内取余手最少者（早盘结构）。
  // bit64：对家出对、首选非控对压对家、对家≤P64 张 → 过。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R66 : undefined; const m66 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R66X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const hl = hand.length;
    const rc = full.remainingSeatCounts || [];
    const e1 = rc[(me + 1) % 4] ?? 27, e3 = rc[(me + 3) % 4] ?? 27, p2 = rc[(me + 2) % 4] ?? 27;
    const setAlt = (alt, tag) => { const top = ranked[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
    const isCtrlCard = (c) => isControlRank(c.rank, lvR) || isJokerRank(c.rank) || isWildCard(c, lvR);
    const okAlt = (r, top, M) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo);
    const partnerPrev = !full.leading && full.previous && full.lastPlaySeat === (me + 2) % 4;
    const enemyPrev = !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2;
    // bit1 / bit64：不抢对家
    for (const [bit, T, P, tag] of [[1, TYPES.SINGLE, X('P1', 6), 'r66NoOvertakeSingle'], [64, TYPES.PAIR, X('P64', 6), 'r66NoOvertakePair']]) {
      if ((m66 & bit) && partnerPrev && full.previous.type === T && p2 <= P && ranked[0] && !isPass(ranked[0].move) &&
          !isBombLike(ranked[0].move.combo) && (ranked[0].move.cards || []).length < hl && !(ranked[0].move.cards || []).some(isCtrlCard)) {
        const top = ranked[0];
        const alt = ranked.find((r) => isPass(r.move) && r.score > -1e5 && r.score >= top.score - X('M' + bit, 300));
        if (alt) setAlt(alt, tag);
      }
    }
    // bit2：中盘领长牌
    if ((m66 & 2) && full.leading && ranked[0] && !isPass(ranked[0].move) && hl >= X('LO2', 10) && hl <= X('HI2', 20) &&
        (ranked[0].move.combo?.type === TYPES.SINGLE || ranked[0].move.combo?.type === TYPES.PAIR)) {
      const top = ranked[0];
      const alts = ranked.filter((r) => okAlt(r, top, X('M2', 100)) && (r.move.combo?.type === TYPES.STRAIGHT || r.move.combo?.type === TYPES.PAIR_SEQ) &&
        !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
      alts.sort((a, b) => b.score - a.score);
      if (alts[0]) setAlt(alts[0], 'r66LeadLong');
    }
    // bit4：跟敌顺子
    if ((m66 & 4) && enemyPrev && full.previous.type === TYPES.STRAIGHT && isPass(ranked[0]?.move)) {
      const top = ranked[0];
      const alts = ranked.filter((r) => okAlt(r, top, X('M4', 200)) && r.move.combo?.type === TYPES.STRAIGHT);
      alts.sort((a, b) => b.score - a.score);
      if (alts[0]) setAlt(alts[0], 'r66FollowStraight');
    }
    // bit8：省百搭
    if ((m66 & 8) && !full.leading && ranked[0] && !isPass(ranked[0].move) && !isBombLike(ranked[0].move.combo) &&
        (ranked[0].move.cards || []).some((c) => isWildCard(c, lvR)) && (ranked[0].move.cards || []).length < hl) {
      const top = ranked[0];
      const alts = ranked.filter((r) => okAlt(r, top, X('M8', 120)) && r.move.combo?.type === top.move.combo?.type &&
        !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
      alts.sort((a, b) => b.score - a.score);
      if (alts[0]) setAlt(alts[0], 'r66SaveWild');
    }
    // bit16 / bit32：领出取余手最少
    const minRest = (bit, cond, M, tag) => {
      if (!(m66 & bit) || !full.leading || !cond || !ranked[0] || isPass(ranked[0].move) || (ranked[0].move.cards || []).length >= hl) return;
      const top = ranked[0]; const t0 = minPlays(restAfter(hand, top.move), lvR);
      const alts = ranked.filter((r) => okAlt(r, top, M) && (r.move.cards || []).length < hl && minPlays(restAfter(hand, r.move), lvR) < t0);
      alts.sort((a, b) => minPlays(restAfter(hand, a.move), lvR) - minPlays(restAfter(hand, b.move), lvR) || (b.score - a.score));
      if (alts[0]) setAlt(alts[0], tag);
    };
    minRest(16, hl <= X('HN16', 8), X('M16', 80), 'r66ShortMinRest');
    minRest(32, e1 >= X('E32', 15) && e3 >= X('E32', 15) && hl >= 15, X('M32', 60), 'r66EarlyMinRest');
  }
  // r67（GD_R67，默认 0）：新鲜正交。避开已穷尽 r50/r45/r58–r66。
  // bit1：跟敌三带二、首选过、有非炸三带二可压分差≤M → 跟。
  // bit2：跟敌连对、首选过、有非炸连对可压 → 跟。
  // bit4：领出时上家敌剩 1 张、首选单 → 改最大单（不留口给上家之后的下家无关；压住上家跟单路）。
  // bit8：领出时对家≤2 张、首选非单非对 → 改最小单。
  // bit16：跟敌单、首选控牌（A/级/王）且敌≥10 张 → 改分差≤M 内最小非控单。
  // bit32：跟敌对、首选控对且敌≥10 张 → 改最小非控对。
  // bit64：跟敌、首选非炸压牌但余手不减（minPlays 不降）、敌≥12 → 过。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R67 : undefined; const m67 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R67X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const hl = hand.length;
    const rc = full.remainingSeatCounts || [];
    const e3 = rc[(me + 3) % 4] ?? 27, p2 = rc[(me + 2) % 4] ?? 27;
    const setAlt = (alt, tag) => { const top = ranked[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
    const isCtrlCard = (c) => isControlRank(c.rank, lvR) || isJokerRank(c.rank) || isWildCard(c, lvR);
    const okAlt = (r, top, M) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo) && (r.move.cards || []).length < hl;
    const enemyPrev = !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2;
    const eCnt = enemyPrev ? (rc[full.lastPlaySeat] ?? 27) : 0;
    for (const [bit, T, tag] of [[1, TYPES.FULLHOUSE, 'r67FollowFH'], [2, TYPES.PAIR_SEQ, 'r67FollowPairSeq']]) {
      if ((m67 & bit) && enemyPrev && full.previous.type === T && isPass(ranked[0]?.move)) {
        const top = ranked[0];
        const alts = ranked.filter((r) => okAlt(r, top, X('M' + bit, 200)) && r.move.combo?.type === T);
        alts.sort((a, b) => b.score - a.score);
        if (alts[0]) { setAlt(alts[0], tag); }
      }
    }
    if ((m67 & 4) && full.leading && e3 === 1 && ranked[0]?.move.combo?.type === TYPES.SINGLE && (ranked[0].move.cards || []).length < hl) {
      const top = ranked[0];
      const alts = ranked.filter((r) => okAlt(r, top, X('M4', 200)) && r.move.combo?.type === TYPES.SINGLE);
      alts.sort((a, b) => singleStrength(b.move.combo.rank, lvR) - singleStrength(a.move.combo.rank, lvR));
      if (alts[0] && alts[0] !== top) setAlt(alts[0], 'r67Prev1BigSingle');
    }
    if ((m67 & 8) && full.leading && p2 <= 2 && ranked[0] && !isPass(ranked[0].move) && (ranked[0].move.cards || []).length < hl &&
        ranked[0].move.combo?.type !== TYPES.SINGLE && ranked[0].move.combo?.type !== TYPES.PAIR) {
      const top = ranked[0]; const T = p2 === 2 ? TYPES.PAIR : TYPES.SINGLE;
      const alts = ranked.filter((r) => okAlt(r, top, X('M8', 300)) && r.move.combo?.type === T);
      alts.sort((a, b) => singleStrength(a.move.combo.rank, lvR) - singleStrength(b.move.combo.rank, lvR));
      if (alts[0]) setAlt(alts[0], 'r67FeedPartner');
    }
    for (const [bit, T, tag] of [[16, TYPES.SINGLE, 'r67NoCtrlSingle'], [32, TYPES.PAIR, 'r67NoCtrlPair']]) {
      if ((m67 & bit) && enemyPrev && full.previous.type === T && eCnt >= X('E' + bit, 10) && ranked[0] && !isPass(ranked[0].move) &&
          ranked[0].move.combo?.type === T && (ranked[0].move.cards || []).some(isCtrlCard)) {
        const top = ranked[0];
        const alts = ranked.filter((r) => okAlt(r, top, X('M' + bit, 120)) && r.move.combo?.type === T && !(r.move.cards || []).some(isCtrlCard));
        alts.sort((a, b) => singleStrength(a.move.combo.rank, lvR) - singleStrength(b.move.combo.rank, lvR));
        if (alts[0]) setAlt(alts[0], tag);
      }
    }
    if ((m67 & 64) && enemyPrev && eCnt >= X('E64', 12) && ranked[0] && !isPass(ranked[0].move) && !isBombLike(ranked[0].move.combo) &&
        (ranked[0].move.cards || []).length < hl && minPlays(restAfter(hand, ranked[0].move), lvR) >= minPlays(hand, lvR)) {
      const top = ranked[0];
      const alt = ranked.find((r) => isPass(r.move) && r.score > -1e5 && r.score >= top.score - X('M64', 150));
      if (alt) setAlt(alt, 'r67PassNoProgress');
    }
  }
  // r68（GD_R68，默认 0）：r67 bit1/bit2 贴边的显著收窄（非原样重跑）。共同前提：跟敌三带二/连对、首选过、有非炸同型可压。
  // bit1：仅出牌敌剩 ≤E1(10) 张才跟三带二。
  // bit2：跟三带二仅当压牌不拆天然炸（所用点数在手中均 <4 张）且压后 minPlays 降。
  // bit4：仅出牌敌剩 ≤E4(10) 张才跟连对。
  // bit8：跟三带二/连对仅当压后 minPlays 比当前降 ≥1 且分差 ≤M8(80)。
  // bit16：跟三带二仅当我手 ≤H16(14) 张（hl 窗）。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R68 : undefined; const m68 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R68X_' + k] : undefined; return e == null ? d : Number(e); };
    if (m68) {
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const hl = hand.length;
    const rc = full.remainingSeatCounts || [];
    const enemyPrev = !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2;
    const eCnt = enemyPrev ? (rc[full.lastPlaySeat] ?? 27) : 27;
    const T = enemyPrev ? full.previous.type : null;
    if (enemyPrev && (T === TYPES.FULLHOUSE || T === TYPES.PAIR_SEQ) && isPass(ranked[0]?.move)) {
      const top = ranked[0]; const mp0 = minPlays(hand, lvR);
      const cnt = {}; for (const c of hand) cnt[c.rank] = (cnt[c.rank] || 0) + 1;
      const noBreak = (r) => !(r.move.cards || []).some((c) => !isJokerRank(c.rank) && cnt[c.rank] >= 4);
      let M = null, extra = () => true, tag = null;
      if (T === TYPES.FULLHOUSE) {
        if ((m68 & 1) && eCnt <= X('E1', 10)) { M = 200; tag = 'r68FHShortEnemy'; }
        else if ((m68 & 2)) { M = 200; extra = (r) => noBreak(r) && minPlays(restAfter(hand, r.move), lvR) < mp0; tag = 'r68FHNoBreak'; }
        else if ((m68 & 16) && hl <= X('H16', 14)) { M = 200; tag = 'r68FHHandWin'; }
        else if ((m68 & 8)) { M = X('M8', 80); extra = (r) => minPlays(restAfter(hand, r.move), lvR) < mp0; tag = 'r68FHProgress'; }
      } else {
        if ((m68 & 4) && eCnt <= X('E4', 10)) { M = 200; tag = 'r68PSShortEnemy'; }
        else if ((m68 & 8)) { M = X('M8', 80); extra = (r) => minPlays(restAfter(hand, r.move), lvR) < mp0; tag = 'r68PSProgress'; }
      }
      if (M != null) {
        const alts = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo) && (r.move.cards || []).length < hl && r.move.combo?.type === T && extra(r));
        alts.sort((a, b) => b.score - a.score);
        if (alts[0]) { const alt = alts[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
      }
    } } }
  // r69（GD_R69，默认 0）：换大方向（同花顺保型窄条件 / 敌报单拦截 / 头游冲刺非炸 / 对家短手不顶）。
  // bit1：首选非炸出牌会拆手中同花顺（候选里有 SF 与之共用牌）、敌均≥E1(10)张 → 改分差≤M1(100)内不拆 SF 的选择（含过）。
  // bit2：跟对家单张、下家敌剩 1 张、首选过 → 用最大非炸单压（拦报单）。
  // bit4：领出、我 hl≤6 且两敌均≥10 → 分差≤M4(80)内改出张数最多的非炸。
  // bit8：跟对家非炸、对家≤3 张、首选非炸压对家 → 过（分差≤M8(150)）。
  // bit16：跟敌单、该敌≤2 张、首选过 → 最大非炸单压。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R69 : undefined; const m69 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R69X_' + k] : undefined; return e == null ? d : Number(e); };
    if (m69 && ranked[0]) {
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const hl = hand.length;
    const rc = full.remainingSeatCounts || [];
    const e1 = rc[(me + 1) % 4] ?? 27, e3 = rc[(me + 3) % 4] ?? 27, p2 = rc[(me + 2) % 4] ?? 27;
    const setAlt = (alt, tag) => { const top = ranked[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
    const ok = (r, top, M) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo) && (r.move.cards || []).length < hl;
    const top = ranked[0];
    const partnerPrev = !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat === (me + 2) % 4;
    const enemyPrev = !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2;
    const ss = (r) => singleStrength(r.move.combo.rank, lvR);
    if ((m69 & 1) && !isPass(top.move) && !isBombLike(top.move.combo) && e1 >= X('E1', 10) && e3 >= X('E1', 10)) {
      const sfIds = new Set(); for (const r of ranked) if (r.move.combo?.type === TYPES.STRAIGHT_FLUSH) for (const c of r.move.cards || []) sfIds.add(c.id);
      const breaks = (r) => (r.move.cards || []).some((c) => sfIds.has(c.id));
      if (sfIds.size && breaks(top)) {
        const alt = ranked.find((r) => r !== top && r.score > -1e5 && r.score >= top.score - X('M1', 100) && (isPass(r.move) || (!isBombLike(r.move.combo) && !breaks(r))));
        if (alt) setAlt(alt, 'r69KeepSF');
      }
    }
    if ((m69 & 2) && partnerPrev && full.previous.type === TYPES.SINGLE && e1 === 1 && isPass(top.move)) {
      const alts = ranked.filter((r) => ok(r, top, 1e9) && r.move.combo?.type === TYPES.SINGLE); alts.sort((a, b) => ss(b) - ss(a));
      if (alts[0]) setAlt(alts[0], 'r69BlockReport');
    }
    if ((m69 & 4) && full.leading && hl <= 6 && e1 >= 10 && e3 >= 10 && !isPass(top.move) && !isBombLike(top.move.combo)) {
      const alts = ranked.filter((r) => ok(r, top, X('M4', 80))); alts.sort((a, b) => b.move.cards.length - a.move.cards.length || b.score - a.score);
      if (alts[0] && alts[0] !== top && alts[0].move.cards.length > top.move.cards.length) setAlt(alts[0], 'r69SprintBig');
    }
    if ((m69 & 8) && partnerPrev && p2 <= 3 && !isPass(top.move) && !isBombLike(top.move.combo) && (top.move.cards || []).length < hl) {
      const alt = ranked.find((r) => isPass(r.move) && r.score > -1e5 && r.score >= top.score - X('M8', 150));
      if (alt) setAlt(alt, 'r69NoTopPartner');
    }
    if ((m69 & 16) && enemyPrev && full.previous.type === TYPES.SINGLE && (rc[full.lastPlaySeat] ?? 27) <= 2 && isPass(top.move)) {
      const alts = ranked.filter((r) => ok(r, top, 1e9) && r.move.combo?.type === TYPES.SINGLE); alts.sort((a, b) => ss(b) - ss(a));
      if (alts[0]) setAlt(alts[0], 'r69BlockEnemySingle');
    }
    } }
  // r70（GD_R70，默认 0）：新簇「控制牌节约 / 早盘减手」（与 r50–r69 正交）。
  // bit1：领出、我≥E(12)张、两敌≥10，首选是控制牌(A/级/王)单或对 → 分差≤M1(100)内改非控制非炸领出。
  // bit2：跟敌非炸单/对（点<10）、该敌≥10、我≥12，首选用控制牌压 → 过（分差≤M2(150)）。
  // bit4：领出、我≥12张、两敌≥10，分差≤M4(80)内有 ≥6 张非炸（连对/钢板/顺子）→ 改出它。
  // bit8：领出、我>8 张、两敌≥8，首选是炸 → 分差≤M8(200)内改非炸。
  // bit16：跟对家非炸、对家≥10、首选用控制牌压对家 → 过（分差≤M16(200)）。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R70 : undefined; const m70 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R70X_' + k] : undefined; return e == null ? d : Number(e); };
    if (m70 && ranked[0]) {
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const hl = hand.length;
    const rc = full.remainingSeatCounts || [];
    const e1 = rc[(me + 1) % 4] ?? 27, e3 = rc[(me + 3) % 4] ?? 27, p2 = rc[(me + 2) % 4] ?? 27;
    const setAlt = (alt, tag) => { const top = ranked[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
    const ok = (r, top, M) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo) && (r.move.cards || []).length < hl;
    const top = ranked[0];
    const SP = new Set([TYPES.SINGLE, TYPES.PAIR]);
    const ctl = (r) => !isPass(r.move) && SP.has(r.move.combo?.type) && isControlRank(r.move.combo.rank, lvR);
    const lowRk = (rk) => ['2','3','4','5','6','7','8','9'].includes(rk) && rk !== lvR;
    if ((m70 & 1) && full.leading && hl >= X('E', 12) && e1 >= 10 && e3 >= 10 && ctl(top)) {
      const alt = ranked.find((r) => r !== top && ok(r, top, X('M1', 100)) && !ctl(r)); if (alt) setAlt(alt, 'r70SaveCtlLead');
    }
    if ((m70 & 2) && !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2
      && SP.has(full.previous.type) && lowRk(full.previous.rank) && (rc[full.lastPlaySeat] ?? 27) >= 10 && hl >= 12 && ctl(top)) {
      const alt = ranked.find((r) => isPass(r.move) && r.score > -1e5 && r.score >= top.score - X('M2', 150)); if (alt) setAlt(alt, 'r70SaveCtlFollow');
    }
    if ((m70 & 4) && full.leading && hl >= 12 && e1 >= 10 && e3 >= 10 && !isPass(top.move) && (top.move.cards || []).length < 6) {
      const alts = ranked.filter((r) => ok(r, top, X('M4', 80)) && r.move.cards.length >= 6); alts.sort((a, b) => b.score - a.score);
      if (alts[0]) setAlt(alts[0], 'r70BigEarly');
    }
    if ((m70 & 8) && full.leading && hl > 8 && e1 >= 8 && e3 >= 8 && !isPass(top.move) && isBombLike(top.move.combo)) {
      const alt = ranked.find((r) => r !== top && ok(r, top, X('M8', 200))); if (alt) setAlt(alt, 'r70NoBombLead');
    }
    if ((m70 & 16) && !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat === (me + 2) % 4 && p2 >= 10 && ctl(top)) {
      const alt = ranked.find((r) => isPass(r.move) && r.score > -1e5 && r.score >= top.score - X('M16', 200)); if (alt) setAlt(alt, 'r70NoCtlOverPartner');
    }
    } }
  // r71（GD_R71，默认 0）：新簇「座位/张数感知的领出与夺权」（与 r50–r70 正交）。
  // bit1：领出、对家≤5、两敌≥8，首选非小单/对 → 分差≤M1(100)内改出最小点单/对（喂对家）。
  // bit2：领出、下家敌≤5，首选是单 → 分差≤M2(120)内改非单非炸。
  // bit4：跟敌非炸、对家≤3、首选过 → 分差≤M4(150)内非炸压牌夺权。
  // bit8：领出、我≥15，首选非控单且有低点对 → 分差≤M8(80)内改对。
  // bit16：跟上家敌非炸、下家敌 3–6、首选过 → 分差≤M16(200)内非炸压。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R71 : undefined; const m71 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R71X_' + k] : undefined; return e == null ? d : Number(e); };
    if (m71 && ranked[0]) {
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const hl = hand.length;
    const rc = full.remainingSeatCounts || [];
    const e1 = rc[(me + 1) % 4] ?? 27, e3 = rc[(me + 3) % 4] ?? 27, p2 = rc[(me + 2) % 4] ?? 27;
    const setAlt = (alt, tag) => { const top = ranked[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
    const ok = (r, top, M) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo) && (r.move.cards || []).length < hl;
    const top = ranked[0];
    const SP = new Set([TYPES.SINGLE, TYPES.PAIR]);
    const lowRk = (rk) => ['2','3','4','5','6','7','8','9'].includes(rk) && rk !== lvR;
    const enemyPrev = !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2;
    if ((m71 & 1) && full.leading && p2 <= 5 && p2 > 0 && e1 >= 8 && e3 >= 8 && !(SP.has(top.move.combo?.type) && lowRk(top.move.combo.rank))) {
      const alt = ranked.find((r) => r !== top && ok(r, top, X('M1', 100)) && SP.has(r.move.combo?.type) && lowRk(r.move.combo.rank)); if (alt) setAlt(alt, 'r71FeedPartner');
    }
    if ((m71 & 2) && full.leading && e1 <= 5 && top.move.combo?.type === TYPES.SINGLE) {
      const alt = ranked.find((r) => r !== top && ok(r, top, X('M2', 120)) && r.move.combo?.type !== TYPES.SINGLE); if (alt) setAlt(alt, 'r71NoSingleVsNext');
    }
    if ((m71 & 4) && enemyPrev && p2 <= 3 && p2 > 0 && isPass(top.move)) {
      const alt = ranked.find((r) => ok(r, top, X('M4', 150))); if (alt) setAlt(alt, 'r71TakeForPartner');
    }
    if ((m71 & 8) && full.leading && hl >= 15 && top.move.combo?.type === TYPES.SINGLE && !isControlRank(top.move.combo.rank, lvR)) {
      const alt = ranked.find((r) => ok(r, top, X('M8', 80)) && r.move.combo?.type === TYPES.PAIR && lowRk(r.move.combo.rank)); if (alt) setAlt(alt, 'r71PairFirst');
    }
    if ((m71 & 16) && enemyPrev && full.lastPlaySeat === (me + 3) % 4 && e1 >= 3 && e1 <= 6 && isPass(top.move)) {
      const alt = ranked.find((r) => ok(r, top, X('M16', 200))); if (alt) setAlt(alt, 'r71BlockNext');
    }
    } }
  // r72（GD_R72，默认 0）：新簇「手型结构 / 逢人配与拆炸」（与 r50–r71 正交）。
  // bit1：非走完的非炸出牌用了逢人配 → 分差≤M1(120)内改不用配的非炸。
  // bit2：跟非炸、首选拆了≥4 张同点（炸弹点）→ 分差≤M2(150)内改不拆炸（含过）。
  // bit4：领出、首选后余手数非最小 → 分差≤M4(60)内改余手数最小的非炸。
  // bit8：我≤8 张领出 → 分差≤M8(100)内改余手数最小（相同取分高）。
  // bit16：领出、我≥15 张、首选含级牌（非配）且非炸 → 分差≤M16(80)内改不含级牌/控牌。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R72 : undefined; const m72 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R72X_' + k] : undefined; return e == null ? d : Number(e); };
    if (m72 && ranked[0] && !isPass(ranked[0].move)) {
    const lvR = full.levelRank || '2'; const hand = full.hand || []; const hl = hand.length; const top = ranked[0];
    const setAlt = (alt, tag) => { alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
    const ok = (r, M) => r !== top && r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo) && (r.move.cards || []).length < hl;
    const notFin = (top.move.cards || []).length < hl && !isBombLike(top.move.combo);
    const wild = (m) => (m.cards || []).some((c) => isWildCard(c, lvR));
    const cnt = new Map(); for (const c of hand) if (!isWildCard(c, lvR)) cnt.set(c.rank, (cnt.get(c.rank) || 0) + 1);
    const breaks = (m) => { const u = new Map(); for (const c of m.cards || []) if (!isWildCard(c, lvR)) u.set(c.rank, (u.get(c.rank) || 0) + 1); for (const [k, n] of u) if ((cnt.get(k) || 0) >= 4 && n < cnt.get(k)) return true; return false; };
    const mp = (r) => minPlays(restAfter(hand, r.move), lvR);
    let done = false;
    if (!done && (m72 & 1) && notFin && wild(top.move)) {
      const alt = ranked.find((r) => ok(r, X('M1', 120)) && !wild(r.move) && (full.leading || true)); if (alt) { setAlt(alt, 'r72SaveWild'); done = true; }
    }
    if (!done && (m72 & 2) && !full.leading && full.previous && !isBombLike(full.previous) && notFin && breaks(top.move)) {
      const alt = ranked.find((r) => r !== top && r.score > -1e5 && r.score >= top.score - X('M2', 150) && (isPass(r.move) || (!isBombLike(r.move.combo) && !breaks(r.move)))); if (alt) { setAlt(alt, 'r72NoBreakBomb'); done = true; }
    }
    if (!done && (m72 & 12) && full.leading && notFin && ((m72 & 4) || hl <= 8)) {
      const M = (m72 & 8) && hl <= 8 ? X('M8', 100) : X('M4', 60);
      const t = mp(top); const cs = ranked.filter((r) => ok(r, M)).map((r) => [r, mp(r)]).filter(([, k]) => k < t);
      cs.sort((a, b) => a[1] - b[1] || b[0].score - a[0].score); if (cs[0]) { setAlt(cs[0][0], 'r72MinHands'); done = true; }
    }
    if (!done && (m72 & 16) && full.leading && hl >= 15 && notFin && (top.move.cards || []).some((c) => c.rank === lvR && !isWildCard(c, lvR))) {
      const alt = ranked.find((r) => ok(r, X('M16', 80)) && !(r.move.cards || []).some((c) => c.rank === lvR || isControlRank(c.rank, lvR) || isJokerRank(c.rank))); if (alt) { setAlt(alt, 'r72NoLevelEarly'); done = true; }
    }
    } }
  // r73（GD_R73，默认 0）：audit-r73 短检正交（避开 r50–r72 穷尽：非三带二/连对跟、非余手/省配/座位喂拦）。
  // bit1：跟敌钢板(TRIPLE_SEQ)、首选过 → 分差≤M1(200)内非炸同型压。
  // bit2：领出、敌最短≤10、首选顺/连对 → 分差≤M2(120)内改三带二或钢板。
  // bit4：领出、敌最短≤8、首选非钢板 → 分差≤M4(150)内改钢板。
  // bit8：跟敌三张、首选过 → 分差≤M8(200)内非炸三张压。
  // bit16：跟敌对、我≥16、敌≥12、首选级牌对 → 分差≤M16(100)内改非级非控对。
  // bit5=1|4。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R73 : undefined; const m73 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R73X_' + k] : undefined; return e == null ? d : Number(e); };
    if (m73 && ranked[0]) {
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const hl = hand.length;
    const rc = full.remainingSeatCounts || [];
    const e1 = rc[(me + 1) % 4] ?? 27, e3 = rc[(me + 3) % 4] ?? 27;
    const eMin = Math.min(e1, e3);
    const setAlt = (alt, tag) => { const top = ranked[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
    const ok = (r, top, M) => r !== top && r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo) && (r.move.cards || []).length < hl;
    const enemyPrev = !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2;
    const eCnt = enemyPrev ? (rc[full.lastPlaySeat] ?? 27) : 0;
    const top = ranked[0];
    let done = false;
    if (!done && (m73 & 1) && enemyPrev && full.previous.type === TYPES.TRIPLE_SEQ && isPass(top.move)) {
      const alts = ranked.filter((r) => ok(r, top, X('M1', 200)) && r.move.combo?.type === TYPES.TRIPLE_SEQ);
      alts.sort((a, b) => b.score - a.score); if (alts[0]) { setAlt(alts[0], 'r73FollowPlate'); done = true; }
    }
    if (!done && (m73 & 2) && full.leading && eMin <= 10 && (top.move.cards || []).length < hl &&
        (top.move.combo?.type === TYPES.PAIR_SEQ || top.move.combo?.type === TYPES.STRAIGHT)) {
      const alts = ranked.filter((r) => ok(r, top, X('M2', 120)) && (r.move.combo?.type === TYPES.FULLHOUSE || r.move.combo?.type === TYPES.TRIPLE_SEQ));
      alts.sort((a, b) => b.score - a.score); if (alts[0]) { setAlt(alts[0], 'r73LeadHardShape'); done = true; }
    }
    if (!done && (m73 & 4) && full.leading && eMin <= 8 && (top.move.cards || []).length < hl && top.move.combo?.type !== TYPES.TRIPLE_SEQ) {
      const alts = ranked.filter((r) => ok(r, top, X('M4', 150)) && r.move.combo?.type === TYPES.TRIPLE_SEQ);
      alts.sort((a, b) => b.score - a.score); if (alts[0]) { setAlt(alts[0], 'r73LeadPlate'); done = true; }
    }
    if (!done && (m73 & 8) && enemyPrev && full.previous.type === TYPES.TRIPLE && isPass(top.move)) {
      const alts = ranked.filter((r) => ok(r, top, X('M8', 200)) && r.move.combo?.type === TYPES.TRIPLE);
      alts.sort((a, b) => b.score - a.score); if (alts[0]) { setAlt(alts[0], 'r73FollowTriple'); done = true; }
    }
    if (!done && (m73 & 16) && enemyPrev && full.previous.type === TYPES.PAIR && hl >= 16 && eCnt >= 12 &&
        top.move.combo?.type === TYPES.PAIR && top.move.combo.rank === lvR && (top.move.cards || []).length < hl) {
      const alts = ranked.filter((r) => ok(r, top, X('M16', 100)) && r.move.combo?.type === TYPES.PAIR &&
        r.move.combo.rank !== lvR && !isControlRank(r.move.combo.rank, lvR) && !isJokerRank(r.move.combo.rank));
      alts.sort((a, b) => singleStrength(a.move.combo.rank, lvR) - singleStrength(b.move.combo.rank, lvR));
      if (alts[0]) { setAlt(alts[0], 'r73SaveLevelPair'); done = true; }
    }
    } }
  // r74（GD_R74，默认 0）：audit-r74 无红旗；早盘领三张仅 3% + 短手出口/减手正交（避开 r50–r73：非钢板三张跟、非余手/省配/座位喂拦、非 r59 须有炸）。
  // bit1：领出、手≥H1(16)、首选单/对非走完 → 分差≤M1(150)内改天然三张（非级、不配）。
  // bit2：领出、手≥H2(16)、首选单非走完 → 分差≤M2(150)内改吃≥1孤张的三带二（不要求有炸，异于 r59）。
  // bit4：领出、手≤H4(8)、首选非炸非走完 → 改最佳炸弹。
  // bit8：跟敌、手≤H8(10)、首选过、有非炸压且压后手数 < 当前手数 → 压（减手）。
  // bit16：跟敌、手≤H16(8)、首选过、有炸且炸后余手≤K16(2) → 炸抢收。
  // bit5=1|2。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R74 : undefined; const m74 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R74X_' + k] : undefined; return e == null ? d : Number(e); };
    if (m74 && ranked[0]) {
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const hl = hand.length;
    const setAlt = (alt, tag) => { const top = ranked[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
    const ok = (r, top, M) => r !== top && r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && (r.move.cards || []).length < hl;
    const enemyPrev = !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2;
    const top = ranked[0];
    let done = false;
    if (!done && (m74 & 1) && full.leading && hl >= X('H1', 16) && !isPass(top.move) && (top.move.cards || []).length < hl &&
        (top.move.combo?.type === TYPES.SINGLE || top.move.combo?.type === TYPES.PAIR)) {
      const byR = new Map(); for (const c of hand) if (!isWildCard(c, lvR)) byR.set(c.rank, (byR.get(c.rank) || 0) + 1);
      const alts = ranked.filter((r) => ok(r, top, X('M1', 150)) && !isBombLike(r.move.combo) && r.move.combo?.type === TYPES.TRIPLE &&
        r.move.combo.rank !== lvR && (byR.get(r.move.combo.rank) || 0) >= 3 && !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
      alts.sort((a, b) => b.score - a.score); if (alts[0]) { setAlt(alts[0], 'r74LeadTriple'); done = true; }
    }
    if (!done && (m74 & 2) && full.leading && hl >= X('H2', 16) && !isPass(top.move) && (top.move.cards || []).length < hl &&
        top.move.combo?.type === TYPES.SINGLE) {
      const byR = new Map(); for (const c of hand) byR.set(c.rank, (byR.get(c.rank) || 0) + 1);
      const orphans = new Set([...byR.entries()].filter(([, n]) => n === 1).map(([r]) => r));
      const eats = (m) => (m.cards || []).reduce((n, c) => n + (orphans.has(c.rank) ? 1 : 0), 0);
      const alts = ranked.filter((r) => ok(r, top, X('M2', 150)) && !isBombLike(r.move.combo) && r.move.combo?.type === TYPES.FULLHOUSE &&
        eats(r.move) >= 1 && !(r.move.cards || []).some((c) => isWildCard(c, lvR)));
      alts.sort((a, b) => (eats(b.move) - eats(a.move)) || (b.score - a.score));
      if (alts[0]) { setAlt(alts[0], 'r74LeadFHOrphan'); done = true; }
    }
    if (!done && (m74 & 4) && full.leading && hl <= X('H4', 8) && !isPass(top.move) && !isBombLike(top.move.combo) && (top.move.cards || []).length < hl) {
      const alts = ranked.filter((r) => ok(r, top, X('M4', 300)) && isBombLike(r.move.combo));
      alts.sort((a, b) => b.score - a.score); if (alts[0]) { setAlt(alts[0], 'r74ShortLeadBomb'); done = true; }
    }
    if (!done && (m74 & 8) && enemyPrev && isPass(top.move)) {
      const cur = minPlays(hand, lvR);
      const alts = ranked.filter((r) => ok(r, top, X('M8', 200)) && !isBombLike(r.move.combo) && minPlays(restAfter(hand, r.move), lvR) < cur);
      alts.sort((a, b) => (minPlays(restAfter(hand, a.move), lvR) - minPlays(restAfter(hand, b.move), lvR)) || (b.score - a.score));
      if (alts[0]) { setAlt(alts[0], 'r74ShortReduceFollow'); done = true; }
    }
    if (!done && (m74 & 16) && enemyPrev && isPass(top.move) && hl <= X('H16', 8)) {
      const K = X('K16', 2);
      const alts = ranked.filter((r) => ok(r, top, X('M16', 300)) && isBombLike(r.move.combo) && minPlays(restAfter(hand, r.move), lvR) <= K);
      alts.sort((a, b) => b.score - a.score); if (alts[0]) { setAlt(alts[0], 'r74ShortBombRace'); done = true; }
    }
    } }
  // r75（GD_R75，默认 0）：audit-r75 MC 意外 3/7 为「敌中盘炸弹、我有更大炸弹却过」。异于 r20（对家短）/r46-47/r62（按我余手 K）/r40（省炸）：按炸弹方张数触发。
  // bit1：敌炸、我手 ≤H1(10) → 炸回（不限余手，含被 filter 禁的炸）。bit2：敌炸、炸弹方 ≤B2(10) → 炸回。bit4：我手 ≤H4(12)。bit3=1|2。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R75 : undefined; const m75 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R75X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const hand = full.hand || []; const hl = hand.length; const cnt = full.remainingSeatCounts || [];
    if (m75 && ranked[0] && isPass(ranked[0].move) && !full.leading && full.previous && isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2) {
      const bc = cnt[full.lastPlaySeat] ?? 27; const e1 = cnt[(me + 1) % 4] ?? 27; const e2 = cnt[(me + 3) % 4] ?? 27;
      const hit = ((m75 & 1) && hl <= X('H1', 10)) || ((m75 & 2) && bc <= X('B2', 10)) || ((m75 & 4) && hl <= X('H4', 12)); void e1; void e2;
      if (hit) {
        const top = ranked[0];
        const bs = ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && isBombLike(r.move.combo) && r.score >= top.score - X('M', 10000));
        bs.sort((a, b) => b.score - a.score);
        if (!bs[0] && !X('NOFILT', 0)) { const fb = filteredOut.filter((m) => !isPass(m) && isBombLike(m.combo)); fb.sort((a, b) => (a.cards || []).length - (b.cards || []).length); if (fb[0]) { const e = { move: fb[0], score: -1e4, tags: [] }; ranked.push(e); bs.push(e); } }
        if (bs[0]) { const alt = bs[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat('r75BombBackShortBomber'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
      }
    } }
  // r76（GD_R76，默认 0）：audit-r76 无红旗；自创正交轴「敌已头游后的 2v1 残局」（按 remainingSeatCounts 敌=0 触发，异于 r61 bit16 对家出完 / 按手数炸回 / 报单拦截）。
  // 敌已出完时，我方须双双先于剩余敌人才少输：跟剩余敌人（非炸）首选过 → bit1 非炸压；bit2 含炸压；bit4 仅剩余敌 ≤R4(10) 张时含炸压；bit8 跟剩余敌时不论首选，若首选是炸而有非炸可压则改非炸。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R76 : undefined; const m76 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R76X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const cnt = full.remainingSeatCounts || []; const e1 = cnt[(me + 1) % 4]; const e2 = cnt[(me + 3) % 4]; const pc = cnt[(me + 2) % 4];
    const oneEnemyOut = (e1 === 0) !== (e2 === 0) && (pc ?? 0) > 0;
    if (m76 && oneEnemyOut && ranked[0] && !full.leading && full.previous && !isPass(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2) {
      const rem = e1 === 0 ? e2 : e1; const top = ranked[0];
      const set = (alt, tag) => { alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
      const nb = ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo)).sort((a, b) => b.score - a.score);
      const ab = ranked.filter((r) => r.score > -1e5 && !isPass(r.move)).sort((a, b) => b.score - a.score);
      if (isPass(top.move)) {
        if ((m76 & 1) && !isBombLike(full.previous) && nb[0]) set(nb[0], 'r76BlockNB');
        else if (((m76 & 2) || ((m76 & 4) && rem <= X('R4', 10))) && ab[0]) set(nb[0] || ab[0], 'r76Block');
      } else if ((m76 & 8) && isBombLike(top.move.combo) && nb[0]) set(nb[0], 'r76NBFirst');
    } }
  // r77（GD_R77，默认 0）：自创正交轴「1v1 残局」——对家与一敌都已出完，只剩我与一个敌人（决定 2/3 或 3/4 名）。
  // bit1 跟敌首选过、有任何可压（含炸）→ 压（1v1 过即交出牌权）；bit2 领出时在分差≤M(80) 内选余牌最少手数的非炸；bit4 领出时敌剩 e 张，选张数>e 的非炸（敌除炸外不能跟）。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R77 : undefined; const m77 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R77X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const cnt = full.remainingSeatCounts || []; const e1 = cnt[(me + 1) % 4]; const e2 = cnt[(me + 3) % 4]; const pc = cnt[(me + 2) % 4];
    const oneV1 = m77 && pc === 0 && (e1 === 0) !== (e2 === 0); const hand = full.hand || []; const lvR = full.levelRank || '2';
    if (oneV1 && ranked[0]) {
      const rem = e1 === 0 ? e2 : e1; const top = ranked[0];
      const set = (alt, tag) => { if (alt === top) return; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
      if ((m77 & 1) && !full.leading && full.previous && !isPass(full.previous) && isPass(top.move)) {
        const ab = ranked.filter((r) => r.score > -1e5 && !isPass(r.move)).sort((a, b) => b.score - a.score);
        const nb = ab.filter((r) => !isBombLike(r.move.combo));
        if (ab[0]) set(nb[0] || ab[0], 'r77V1Beat');
      }
      if (full.leading && (top.move.cards || []).length < hand.length) {
        const pool = ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo) && (r.move.cards || []).length < hand.length);
        if (m77 & 4) { const c = pool.filter((r) => (r.move.cards || []).length > rem && r.score >= top.score - X('M4', 200)).sort((a, b) => b.score - a.score); if (c[0] && (top.move.cards || []).length <= rem) set(c[0], 'r77V1Wide'); }
        if (m77 & 2) { const c = pool.filter((r) => r.score >= top.score - X('M', 80)).map((r) => ({ r, k: minPlays(restAfter(hand, r.move), lvR) })).sort((a, b) => a.k - b.k || b.r.score - a.r.score); if (c[0] && c[0].k < minPlays(restAfter(hand, ranked[0].move), lvR)) set(c[0].r, 'r77V1MinPlays'); }
      }
    } }
  // r78（GD_R78，默认 0）：自创正交轴「1v2 残局」——对家已出完（接风后），我独对两个敌人（r76/r77 为敌先出完的 2v1/1v1）。
  // bit1 跟敌首选过、有非炸可压 → 压；bit2 领出选张数>两敌最小剩张的非炸（分差≤M4）；bit4 跟敌首选炸、两敌都>BE(8) 张、有非炸可压 → 改非炸，否则过。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R78 : undefined; const m78 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R78X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const cnt = full.remainingSeatCounts || []; const e1 = cnt[(me + 1) % 4]; const e2 = cnt[(me + 3) % 4]; const pc = cnt[(me + 2) % 4];
    const oneV2 = m78 && pc === 0 && e1 > 0 && e2 > 0; const hand = full.hand || [];
    if (oneV2 && process.env.GD_R78_LOG) process.stderr.write('SEEN '+(full.leading?'L':'F')+(isPass(ranked[0]?.move)?'p':'m')+'\n');
    if (oneV2 && ranked[0]) {
      const top = ranked[0]; const emin = Math.min(e1, e2);
      const set = (alt, tag) => { if (!alt || alt === top) return; if (process.env.GD_R78_LOG) process.stderr.write('TRIG '+tag+'\n'); alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
      const nb = ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo)).sort((a, b) => b.score - a.score);
      if (!full.leading && full.previous && !isPass(full.previous)) {
        if ((m78 & 1) && isPass(top.move) && !isBombLike(full.previous)) set(nb[0], 'r78Beat');
        else if ((m78 & 4) && !isPass(top.move) && isBombLike(top.move.combo) && (top.move.cards || []).length < hand.length && emin > X('BE', 8)) set(nb[0] || ranked.find((r) => isPass(r.move)), 'r78NoBomb');
      } else if ((m78 & 2) && full.leading && (top.move.cards || []).length < hand.length && (top.move.cards || []).length <= emin) {
        set(nb.filter((r) => (r.move.cards || []).length > emin && (r.move.cards || []).length < hand.length && r.score >= top.score - X('M4', 200))[0], 'r78Wide');
      }
    } }
  // r79（GD_R79，默认 0）：自创正交轴「长型牌（顺子/钢板/三连对）攻防」——非残局座位轴、非三带二/连对跟（r68）、非单对喂拦（r56/r57）。
  // bit1 跟敌顺子/钢板（非炸）首选过、有非炸同型可压（分差≤M）→ 压；bit2 同 bit1 但仅任一敌≤E2(12) 张；bit4 领出首选单/对、存在分差≤M4 的顺子/钢板且出后余手不增 → 出长型。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R79 : undefined; const m79 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R79X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const cnt = full.remainingSeatCounts || []; const e1 = cnt[(me + 1) % 4] ?? 27; const e2 = cnt[(me + 3) % 4] ?? 27; const hand = full.hand || []; const lvR = full.levelRank || '2';
    const LONG = new Set([TYPES.STRAIGHT, TYPES.TRIPLE_SEQ].filter(Boolean));
    if (m79 && ranked[0]) {
      const top = ranked[0];
      const set = (alt, tag) => { if (!alt || alt === top) return; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
      if (!full.leading && full.previous && LONG.has(full.previous.type) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 && isPass(top.move)) {
        const hit = (m79 & 1) || ((m79 & 2) && Math.min(e1, e2) <= X('E2', 12));
        if (hit) set(ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo) && r.score >= top.score - X('M', 300)).sort((a, b) => b.score - a.score)[0], 'r79LongBeat');
      } else if ((m79 & 4) && full.leading && !isPass(top.move) && (top.move.combo?.type === TYPES.SINGLE || top.move.combo?.type === TYPES.PAIR) && (top.move.cards || []).length < hand.length) {
        const k0 = minPlays(restAfter(hand, top.move), lvR);
        const c = ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && LONG.has(r.move.combo?.type) && r.score >= top.score - X('M4', 150)).filter((r) => minPlays(restAfter(hand, r.move), lvR) <= k0).sort((a, b) => b.score - a.score);
        set(c[0], 'r79LongLead');
      }
    } }
  // r80（GD_R80，默认 0）：自创正交轴「炸弹选型」——已决定出炸（非走完）时换哪颗炸。非是否炸/炸回/省炸（r40/r46/r75）。
  // bit1 换 bombCost 最低的炸（分差≤M 400）；bit2 同 bit1 但只换不用逢人配的炸；bit4 换出后余手最少的炸（不多于首选，平手取 bombCost 低）。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R80 : undefined; const m80 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R80X_' + k] : undefined; return e == null ? d : Number(e); };
    const hand = full.hand || []; const lvR = full.levelRank || '2'; const top = ranked[0];
    if (m80 && top && !isPass(top.move) && isBombLike(top.move.combo) && (top.move.cards || []).length < hand.length) {
      const set = (alt, tag) => { if (!alt || alt === top) return; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
      let bs = ranked.filter((r) => r !== top && r.score > -1e5 && !isPass(r.move) && isBombLike(r.move.combo) && (r.move.cards || []).length < hand.length && r.score >= top.score - X('M', 400));
      if (m80 & 2 && !(m80 & 1)) bs = bs.filter((r) => !wildFillers(r.move, lvR));
      const c0 = bombCost(top.move, lvR);
      if (m80 & 4) {
        const k0 = minPlays(restAfter(hand, top.move), lvR);
        const c = bs.map((r) => [r, minPlays(restAfter(hand, r.move), lvR), bombCost(r.move, lvR)]).filter(([, k, c]) => k < k0 || (k === k0 && c < c0)).sort((a, b) => a[1] - b[1] || a[2] - b[2]);
        if (c[0]) { set(c[0][0], 'r80BombShape'); bs = []; }
      }
      if (m80 & 3) { const c = bs.map((r) => [r, bombCost(r.move, lvR)]).filter(([, c]) => c < c0).sort((a, b) => a[1] - b[1]); if (c[0]) set(c[0][0], 'r80CheapBomb'); }
    } }
  // r82（GD_R82，默认 0）：自创正交轴「同型牌实现选择」——已选牌型/点数后换哪组具体牌（带牌、逢人配、花色），非炸弹（r80）、非是否出。
  // bit1 同型同点同长、出后余手更少（分差≤M 150）；bit2 同型同点同长、余手不增且不用逢人配（首选用了）；bit4 同型同长不同点、余手更少（分差≤M4 100）；bit3=1|2。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R82 : undefined; const m82 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R82X_' + k] : undefined; return e == null ? d : Number(e); };
    const hand = full.hand || []; const lvR = full.levelRank || '2'; const top = ranked[0];
    if (m82 && top && !isPass(top.move) && !isBombLike(top.move.combo) && (top.move.cards || []).length < hand.length) {
      const set = (alt, tag) => { if (!alt || alt === top) return; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
      const iso = (h) => { const u = new Map(); for (const c of h) if (!isWildCard(c, lvR)) u.set(c.rank, (u.get(c.rank) || 0) + 1); let n = 0; for (const x of u.values()) if (x === 1) n++; return n; }; const tc = top.move.combo; const k0 = minPlays(restAfter(hand, top.move), lvR); const i0 = iso(restAfter(hand, top.move));
      const same = ranked.filter((r) => r !== top && r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo) && r.move.combo?.type === tc.type && (r.move.cards || []).length === top.move.cards.length && r.move.combo?.length === tc.length);
      let done = false;
      if (m82 & 1) { const c = same.filter((r) => r.move.combo?.rank === tc.rank && r.score >= top.score - X('M', 150)).map((r) => { const h = restAfter(hand, r.move); return [r, minPlays(h, lvR), iso(h)]; }).filter(([, k, i]) => k < k0 || (k === k0 && i < i0)).sort((a, b) => a[1] - b[1] || a[2] - b[2] || b[0].score - a[0].score); if (c[0]) { set(c[0][0], 'r82Real'); done = true; } }
      if (!done && (m82 & 2) && wildFillers(top.move, lvR)) { const c = same.filter((r) => r.move.combo?.rank === tc.rank && !wildFillers(r.move, lvR) && r.score >= top.score - X('M', 150)).filter((r) => minPlays(restAfter(hand, r.move), lvR) <= k0).sort((a, b) => b.score - a.score); if (c[0]) { set(c[0], 'r82NoWild'); done = true; } }
      if (!done && (m82 & 4)) { const c = same.filter((r) => r.move.combo?.rank !== tc.rank && r.score >= top.score - X('M4', 100)).map((r) => { const h = restAfter(hand, r.move); return [r, minPlays(h, lvR), iso(h)]; }).filter(([, k, i]) => k < k0 || (k === k0 && i < i0)).sort((a, b) => a[1] - b[1] || a[2] - b[2] || b[0].score - a[0].score); if (c[0]) { set(c[0][0], 'r82Rank'); } }
    } }
  // r83（GD_R83，默认 0）：自创正交轴「出牌花色保同花顺潜力」——已定同点单/对（或同型同点）时换花色，保留高 SF 花色。异于 r81 还贡花色、r42/r63 进贡花色、r82 余手/孤张实现。
  // bit1 领出单/对、同点多花色 → 出 SF 潜力之和最低的实现（分差≤M 150）；bit2 跟牌单/对同上；bit4 任意非炸同型同点按 SF；bit5=1|2。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R83 : undefined; const m83 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R83X_' + k] : undefined; return e == null ? d : Number(e); };
    const hand = full.hand || []; const lvR = full.levelRank || '2'; const top = ranked[0];
    if (m83 && top && !isPass(top.move) && !isBombLike(top.move.combo) && (top.move.cards || []).length < hand.length) {
      const tc = top.move.combo;
      const isSP = tc?.type === TYPES.SINGLE || tc?.type === TYPES.PAIR;
      const allow = (m83 & 4) || ((m83 & 1) && full.leading && isSP) || ((m83 & 2) && !full.leading && isSP);
      if (allow) {
        const set = (alt, tag) => { if (!alt || alt === top) return; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
        const sfSum = (mv) => (mv.cards || []).reduce((s, c) => s + r42SfPotential(hand, c), 0);
        const s0 = sfSum(top.move);
        const alts = ranked.filter((r) => r !== top && r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo) && r.move.combo?.type === tc.type && r.move.combo?.rank === tc.rank && (r.move.cards || []).length === (top.move.cards || []).length && r.score >= top.score - X('M', 150));
        const c = alts.map((r) => [r, sfSum(r.move)]).filter(([, s]) => s < s0).sort((a, b) => a[1] - b[1] || b[0].score - a[0].score);
        if (c[0]) set(c[0][0], 'r83SfSuit');
      }
    } }
  // r84（GD_R84，默认 0）：自创正交轴「贴边分差改过」——跟敌、首选非炸非走完、过牌分差≤M 时改过。异于硬座位/张数过牌与 r82/r83 实现选型。
  // bit1 手≥H(16) 且两敌均≥E(12)；bit2 首选含逢人配或控牌（级/A/王）；bit4 首选为单/对；bit5=1|2。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R84 : undefined; const m84 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R84X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const cnt = full.remainingSeatCounts || []; const e1 = cnt[(me + 1) % 4] ?? 27; const e2 = cnt[(me + 3) % 4] ?? 27;
    const hand = full.hand || []; const lvR = full.levelRank || '2'; const top = ranked[0];
    if (m84 && top && !full.leading && full.previous && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2
        && !isPass(top.move) && !isBombLike(top.move.combo) && (top.move.cards || []).length < hand.length) {
      const pass = ranked.find((r) => isPass(r.move));
      if (pass && pass.score >= top.score - X('M', 80)) {
        const usesCtrl = (top.move.cards || []).some((c) => isWildCard(c, lvR) || isControlRank(c.rank, lvR) || isJokerRank(c.rank));
        const isSP = top.move.combo?.type === TYPES.SINGLE || top.move.combo?.type === TYPES.PAIR;
        const hit = ((m84 & 1) && hand.length >= X('H', 16) && e1 >= X('E', 12) && e2 >= X('E', 12))
          || ((m84 & 2) && usesCtrl)
          || ((m84 & 4) && isSP);
        if (hit) {
          const set = (alt, tag) => { if (!alt || alt === top) return; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
          set(pass, 'r84SoftPass');
        }
      }
    } }
  // r85（GD_R85，默认 0）：自创正交轴「明牌计数安全换手」——首选非炸非过非走完且 safety/winProb 不佳时，分差≤M 内换更安全的非过牌。异于贴边改过(r84)、同型实现(r82)、花色SF(r83)、炸弹选型(r80)。
  // bit1 领出换 safety==sure；bit2 领出换更高 winProb；bit4 跟敌换更好 safety；bit5=1|2。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R85 : undefined; const m85 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R85X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const hand = full.hand || []; const top = ranked[0];
    if (m85 && top && !isPass(top.move) && !isBombLike(top.move.combo) && (top.move.cards || []).length < hand.length) {
      const s0 = safety(top.move, full); const w0 = winProb(top.move, full);
      const ord = (s) => (s === 'sure' ? 2 : s === 'likely' ? 1 : 0);
      const enemyFollow = !full.leading && full.previous && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2;
      const wantLeadSure = full.leading && (m85 & 1) && s0 !== 'sure';
      const wantLeadWp = full.leading && (m85 & 2) && w0 < X('W', 0.7);
      const wantFol = enemyFollow && (m85 & 4) && ord(s0) < 2;
      if (wantLeadSure || wantLeadWp || wantFol) {
        const alts = ranked.filter((r) => r !== top && r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo)
          && (r.move.cards || []).length < hand.length && r.score >= top.score - X('M', 100));
        let pick = null, pk = null;
        for (const a of alts) {
          const sa = safety(a.move, full); const wa = winProb(a.move, full);
          let better = false;
          if (wantLeadSure && sa === 'sure') better = true;
          if (wantLeadWp && wa > w0 + X('DW', 0.15)) better = true;
          if (wantFol && ord(sa) > ord(s0)) better = true;
          if (!better) continue;
          const key = [ord(sa), wa, a.score];
          if (!pick || key[0] > pk[0] || (key[0] === pk[0] && (key[1] > pk[1] || (key[1] === pk[1] && key[2] > pk[2])))) {
            pick = a; pk = key;
          }
        }
        if (pick) {
          pick.score = top.score + 1;
          pick.tags = (pick.tags || []).concat('r85SafeSwap');
          ranked.sort((a, b) => b.score - a.score);
          best = pick.move; bestTags = pick.tags; bestS = pick.score;
        }
      }
    } }
  // r86（GD_R86，默认 0）：自创正交轴「对家甩牌加速配合 / 敌慢甩牌」——用 ctx.recentShed。异于 r14 敌快走、r56/r40 按张数喂、r84 改过、r85 安全换手。
  // bit1 对家 shed≥S 且张≤P、领出非走完 → 分差≤M 内最小非控单；bit2 同上最小非控对；bit4 两敌 shed≤S2 且张≥E、领出单/对 → 分差≤M 内改≥3张非炸；bit5=1|2。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R86 : undefined; const m86 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R86X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const pt = (me + 2) % 4; const e1s = (me + 1) % 4; const e2s = (me + 3) % 4;
    const cnt = full.remainingSeatCounts || []; const shed = full.recentShed || [];
    const hand = full.hand || []; const lvR = full.levelRank || '2'; const top = ranked[0];
    if (m86 && top && full.leading && !isPass(top.move) && !isBombLike(top.move.combo) && (top.move.cards || []).length < hand.length) {
      const pShed = shed[pt] ?? 0; const pN = cnt[pt] ?? 27;
      const e1n = cnt[e1s] ?? 27; const e2n = cnt[e2s] ?? 27;
      const e1sh = shed[e1s] ?? 0; const e2sh = shed[e2s] ?? 0;
      const nonCtrl = (r) => r && !isPass(r.move) && !isBombLike(r.move.combo) && !(r.move.cards || []).some((c) => isWildCard(c, lvR) || isControlRank(c.rank, lvR) || isJokerRank(c.rank));
      const set = (alt, tag) => { if (!alt || alt === top) return; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
      const partnerHot = pShed >= X('S', 6) && pN <= X('P', 10) && pN > 0;
      if (partnerHot && ((m86 & 1) || (m86 & 2))) {
        const alts = ranked.filter((r) => r !== top && r.score > -1e5 && nonCtrl(r) && (r.move.cards || []).length < hand.length && r.score >= top.score - X('M', 100));
        if (m86 & 1) {
          const singles = alts.filter((r) => r.move.combo?.type === TYPES.SINGLE)
            .sort((a, b) => singleStrength(a.move.combo.rank, lvR) - singleStrength(b.move.combo.rank, lvR) || b.score - a.score);
          if (singles[0] && (top.move.combo?.type !== TYPES.SINGLE || isControlRank(top.move.combo.rank, lvR) || isJokerRank(top.move.combo.rank) || (top.move.cards || []).some((c) => isWildCard(c, lvR))
              || singleStrength(singles[0].move.combo.rank, lvR) < singleStrength(top.move.combo.rank, lvR))) set(singles[0], 'r86FeedHotSingle');
        }
        if (m86 & 2 && pN >= 2 && !(bestTags || []).includes('r86FeedHotSingle')) {
          const pairs = alts.filter((r) => r.move.combo?.type === TYPES.PAIR)
            .sort((a, b) => singleStrength(a.move.combo.rank, lvR) - singleStrength(b.move.combo.rank, lvR) || b.score - a.score);
          if (pairs[0] && (top.move.combo?.type !== TYPES.PAIR || isControlRank(top.move.combo.rank, lvR) || isJokerRank(top.move.combo.rank) || (top.move.cards || []).some((c) => isWildCard(c, lvR))
              || singleStrength(pairs[0].move.combo.rank, lvR) < singleStrength(top.move.combo.rank, lvR))) set(pairs[0], 'r86FeedHotPair');
        }
      }
      if ((m86 & 4) && e1sh <= X('S2', 2) && e2sh <= X('S2', 2) && e1n >= X('E', 12) && e2n >= X('E', 12)
          && (top.move.combo?.type === TYPES.SINGLE || top.move.combo?.type === TYPES.PAIR)) {
        const alts = ranked.filter((r) => r !== top && r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo)
          && (r.move.cards || []).length >= 3 && (r.move.cards || []).length < hand.length && r.score >= top.score - X('M4', 120))
          .sort((a, b) => b.score - a.score);
        if (alts[0]) set(alts[0], 'r86DumpSlowEnemy');
      }
    } }
  // r87（GD_R87，默认 0）：自创正交轴「跟敌最小压省大牌」——跟敌、首选非炸非过非走完、同型存在点数更低的可压牌（分差≤M）→ 换最低点压（异于 r82 同点实现、r85 safety 换手、r84 改过、r86 甩牌节奏）。
  // bit1 单张；bit2 对子；bit4 其他型（三带二/顺/连对等）；bit8 仅当首选含控牌（级/A/王/逢人配）时；bit3=1|2。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R87 : undefined; const m87 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R87X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const hand = full.hand || []; const lvR = full.levelRank || '2'; const top = ranked[0];
    const enemyFollow = !full.leading && full.previous && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2;
    if (m87 && enemyFollow && top && !isPass(top.move) && !isBombLike(top.move.combo) && (top.move.cards || []).length < hand.length) {
      const t = top.move.combo?.type; const isS = t === TYPES.SINGLE, isP = t === TYPES.PAIR;
      const ctrl = (mv) => (mv.cards || []).some((c) => isWildCard(c, lvR) || isControlRank(c.rank, lvR) || isJokerRank(c.rank));
      const typeOk = ((m87 & 1) && isS) || ((m87 & 2) && isP) || ((m87 & 4) && !isS && !isP);
      if (typeOk && (!(m87 & 8) || ctrl(top.move))) {
        const st = (mv) => singleStrength(mv.combo.rank, lvR);
        const alts = ranked.filter((r) => r !== top && r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo) && r.move.combo?.type === t
          && (r.move.cards || []).length === (top.move.cards || []).length && (r.move.cards || []).length < hand.length
          && st(r.move) < st(top.move) && r.score >= top.score - X('M', 80))
          .sort((x, y) => st(x.move) - st(y.move) || y.score - x.score);
        const pick = alts[0];
        if (pick) { pick.score = top.score + 1; pick.tags = (pick.tags || []).concat('r87CheapBeat'); ranked.sort((x, y) => y.score - x.score); best = pick.move; bestTags = pick.tags; bestS = pick.score; }
      }
    } }
  // r88（GD_R88，默认 0）：自创正交轴「对家牌后顶防下家中短手」——跟对家、首选过、下家敌剩张在区间内、对家不报牌 → 用最小非炸非控同型压对家，把领权留在本方再走（异于 r69 拦下家报单、r87 跟敌最小压、r84 改过、r76–78 残局座位）。
  // bit1 下家 2–3 张；bit2 下家 4–6 张；bit4 仅当对家剩张 ≥P(8)；bit3=1|2。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R88 : undefined; const m88 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R88X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const hand = full.hand || []; const lvR = full.levelRank || '2'; const top = ranked[0]; const rc = full.remainingSeatCounts || [];
    const partnerFollow = !full.leading && full.previous && full.lastPlaySeat != null && full.lastPlaySeat === (me + 2) % 4 && !isBombLike(full.previous);
    const nx = rc[(me + 1) % 4] ?? 27; const pn = rc[(me + 2) % 4] ?? 27;
    const inRange = ((m88 & 1) && nx >= 2 && nx <= 3) || ((m88 & 2) && nx >= 4 && nx <= 6);
    if (m88 && partnerFollow && top && isPass(top.move) && inRange && pn > 2 && (!(m88 & 4) || pn >= X('P', 8))) {
      const ctrl = (mv) => (mv.cards || []).some((c) => isWildCard(c, lvR) || isControlRank(c.rank, lvR) || isJokerRank(c.rank));
      const st = (mv) => singleStrength(mv.combo.rank, lvR);
      const ms = _legalMoves(hand, full.previous, lvR, false).filter((m) => m.cards.length && m.cards.length < hand.length && !isBombLike(m.combo) && !ctrl(m))
        .sort((x, y) => st(x) - st(y));
      const pick = ms[0];
      if (pick) { if (process.env?.GD_R88_LOG) process.stderr.write('R88TRIG\n'); best = pick; bestTags = ['r88GuardNext']; bestS = (top.score ?? 0) + 1; ranked.unshift({ move: pick, score: bestS, tags: bestTags }); }
    } }
  // r89（GD_R89，默认 0）：自创正交轴「记牌领出控权」——领出时，在分差≤M 的非炸非走完单/对/三候选中，换成外面（未出且不在我手）可压它的同型张数最少者，以求保住领权（用 belief.remainingByRank 记牌；异于 r87 跟敌最小压、r86 甩牌节奏、r82 同型实现、r76–78 残局、r45/r50）。
  // bit1 仅首选为单/对时；bit2 首选为任何非炸型时（候选仍限单/对/三）；bit4 仅我手 ≤12 张；bit8 要求换后外面可压数=0（绝对大）。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R89 : undefined; const m89 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R89X_' + k] : undefined; return e == null ? d : Number(e); };
    const hand = full.hand || []; const lvR = full.levelRank || '2'; const top = ranked[0];
    if (m89 && full.leading && top && !isPass(top.move) && !isBombLike(top.move.combo) && (top.move.cards || []).length < hand.length
        && (!(m89 & 4) || hand.length <= X('H', 12))) {
      const T3 = [TYPES.SINGLE, TYPES.PAIR, TYPES.TRIPLE]; const tt = top.move.combo?.type;
      const okTop = ((m89 & 1) && (tt === TYPES.SINGLE || tt === TYPES.PAIR)) || ((m89 & 2));
      if (okTop) {
        const rem = full.belief?.remainingByRank || {}; const mine = {};
        for (const c of hand) mine[c.rank] = (mine[c.rank] || 0) + 1;
        const beaters = (mv) => { const n = (mv.cards || []).length; const s0 = singleStrength(mv.combo.rank, lvR); let b = 0;
          for (const [rk, cnt] of Object.entries(rem)) { let s; try { s = singleStrength(rk, lvR); } catch { continue; }
            if (s <= s0) continue; const out = Math.max(0, cnt - (mine[rk] || 0)); if (out >= n) b += 1; }
          return b; };
        const cand = ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo) && T3.includes(r.move.combo?.type)
          && (r.move.cards || []).length < hand.length && r.score >= top.score - X('M', 60));
        if (cand.length) {
          const topB = T3.includes(tt) ? beaters(top.move) : 99;
          const sc = cand.map((r) => ({ r, b: beaters(r.move) })).sort((x, y) => x.b - y.b || y.r.score - x.r.score);
          const p = sc[0];
          if (p.r !== top && p.b < topB && (!(m89 & 8) || p.b === 0)) {
            if (process.env?.GD_R89_LOG) process.stderr.write('R89TRIG\n');
            p.r.score = top.score + 1; p.r.tags = (p.r.tags || []).concat('r89CountLead'); ranked.sort((x, y) => y.score - x.score); best = p.r.move; bestTags = p.r.tags; bestS = p.r.score;
          }
        }
      }
    } }
  // r90（GD_R90，默认 0）：自创正交轴「领出顺子减手」——领出且首选非炸非顺子非走完时，若分差≤M 内有非炸顺子候选，改出顺子（一次走 5 张降手数；异于 r33L 开局连对/钢板、r73 三带二/钢板、r59 孤单、r89 记牌控权、r45/r50）。
  // bit1 启用（分差≤M=250）；bit2 分差放宽 M2=1000；bit4 仅下家敌 ≥8 张；bit8 仅顺子顶点 ≤10（低顺）。首选为任意非炸非顺子领出。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R90 : undefined; const m90 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R90X_' + k] : undefined; return e == null ? d : Number(e); };
    const hand = full.hand || []; const lvR = full.levelRank || '2'; const top = ranked[0]; const me = full.seat ?? 0;
    const nextN = (full.remainingSeatCounts || full.opponentCounts || [])[(me + 1) % 4] ?? 27;
    if ((m90 & 1) && full.leading && top && !isPass(top.move) && !isBombLike(top.move.combo) && (top.move.cards || []).length < hand.length
        && top.move.combo?.type !== TYPES.STRAIGHT && (!(m90 & 4) || nextN >= 8)) {
      const M = (m90 & 2) ? X('M2', 1000) : X('M', 250);
      const cand = ranked.filter((r) => r.score > -1e5 && r.move.combo?.type === TYPES.STRAIGHT && r.score >= top.score - M
        && (!(m90 & 8) || (() => { try { return singleStrength(r.move.combo.rank, lvR) <= singleStrength('10', lvR); } catch { return false; } })()));
      if (cand.length) { const p = cand[0];
        if (process.env?.GD_R90_LOG) process.stderr.write('R90TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r90StraightLead'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r91（GD_R91，默认 0）：自创正交轴「领出同型最小点先走」——领出且首选为非炸非走完的单/对时，若分差≤M 内有同型更小点（singleStrength 更低）的候选，改领最小点（先清小牌、留大牌控权；异于 r59 孤单、r89 记牌控权、r82 同型同点实现、r90 顺子、r87 跟敌最小压、r45/r50）。
  // bit1 启用 M=150；bit2 放宽 M2=600；bit4 仅手 ≥10 张；bit8 仅单张。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R91 : undefined; const m91 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R91X_' + k] : undefined; return e == null ? d : Number(e); };
    const hand = full.hand || []; const lvR = full.levelRank || '2'; const top = ranked[0];
    const tt = top?.move?.combo?.type; const okT = tt === TYPES.SINGLE || (!(m91 & 8) && tt === TYPES.PAIR);
    if ((m91 & 1) && full.leading && top && !isPass(top.move) && okT && (top.move.cards || []).length < hand.length && (!(m91 & 4) || hand.length >= 10)) {
      const M = (m91 & 2) ? X('M2', 600) : X('M', 150);
      const ss = (r) => { try { return singleStrength(r.move.combo.rank, lvR); } catch { return 99; } };
      const t0 = ss(top);
      const cand = ranked.filter((r) => r.score > -1e5 && r.move.combo?.type === tt && r.score >= top.score - M && ss(r) < t0);
      if (cand.length) { cand.sort((x, y) => ss(x) - ss(y) || y.score - x.score); const p = cand[0];
        if (process.env?.GD_R91_LOG) process.stderr.write('R91TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r91LowLead'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r92（GD_R92，默认 0）：自创正交轴「领出单改对」——领出且首选为非炸非走完单张时，若分差≤M 内有非炸对子候选，改领（分值最高的）对子（换牌型、一次走 2 张；异于 r91 同型最小点、r90 顺子、r59 孤单、r89 记牌控权、r82 同型实现、r45/r50）。
  // bit1 启用 M=150；bit2 放宽 M2=600；bit4 仅手 ≥10 张；bit8 仅对子点数 ≤ 原单张点数（不拆大对）。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R92 : undefined; const m92 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R92X_' + k] : undefined; return e == null ? d : Number(e); };
    const hand = full.hand || []; const lvR = full.levelRank || '2'; const top = ranked[0];
    if ((m92 & 1) && full.leading && top && !isPass(top.move) && top.move.combo?.type === TYPES.SINGLE && (top.move.cards || []).length < hand.length && (!(m92 & 4) || hand.length >= 10)) {
      const M = (m92 & 2) ? X('M2', 600) : X('M', 150);
      const ss = (r) => { try { return singleStrength(r.move.combo.rank, lvR); } catch { return 99; } };
      const t0 = ss(top);
      const cand = ranked.filter((r) => r.score > -1e5 && r.move.combo?.type === TYPES.PAIR && !isBombLike(r.move.combo) && r.score >= top.score - M && (!(m92 & 8) || ss(r) <= t0));
      if (cand.length) { const p = cand[0];
        if (process.env?.GD_R92_LOG) process.stderr.write('R92TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r92PairLead'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r93（GD_R93，默认 0）：自创正交轴「跟敌贴边改压（结构不劣）」——跟敌非炸、首选过，分差≤M 内有非炸非走完压牌且压后 minPlays 不多于压前 → 改压（r84 贴边改过的镜像；异于 r47 压后≤K 手走完、r87 最小压、r88 跟对家、r89–r92 领出）。
  // bit1 启用 M=150；bit2 放宽 M2=600；bit4 仅手 ≥10 张；bit8 压后 minPlays 须严格减少。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R93 : undefined; const m93 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R93X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const top = ranked[0];
    if ((m93 & 1) && !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 && top && isPass(top.move) && (!(m93 & 4) || hand.length >= 10)) {
      const M = (m93 & 2) ? X('M2', 600) : X('M', 150); const mp0 = minPlays(hand, lvR);
      const cand = ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo) && (r.move.cards || []).length < hand.length && r.score >= top.score - M && (() => { const k = minPlays(restAfter(hand, r.move), lvR); return (m93 & 8) ? k < mp0 : k <= mp0; })());
      if (cand.length) { const p = cand[0];
        if (process.env?.GD_R93_LOG) process.stderr.write('R93TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r93SoftBeat'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r94（GD_R94，默认 0）：自创正交轴「省炸：跟敌小牌不炸」——跟敌非炸、首选为非走完炸弹，敌出牌（单/对等）且出牌座位敌余张 ≥T、我手 ≥H，若有「过」候选分差≤M → 改过保炸（异于 r45/r50 炸回/压住、r75 中盘炸回、r80 炸选型、r84 贴边改过（非炸）、r93）。
  // bit1 启用 T=8,H=8,M=400；bit2 放宽 M2=1500；bit4 仅敌余张 ≥12；bit8 仅前手牌张数 ≤2。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R94 : undefined; const m94 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R94X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const hand = full.hand || []; const top = ranked[0]; const rc = full.remainingSeatCounts || [];
    const ls = full.lastPlaySeat; const ec = ls != null && rc[ls] != null ? rc[ls] : 0;
    if ((m94 & 1) && !full.leading && full.previous && !isBombLike(full.previous) && ls != null && ls % 2 !== me % 2 && top && !isPass(top.move) && isBombLike(top.move.combo) && (top.move.cards || []).length < hand.length
      && hand.length >= X('H', 8) && ec >= ((m94 & 4) ? 12 : X('T', 8)) && (!(m94 & 8) || (full.previous.cards || []).length <= 2)) {
      const M = (m94 & 2) ? X('M2', 1500) : X('M', 400);
      const p = ranked.find((r) => r.score > -1e5 && isPass(r.move) && r.score >= top.score - M);
      if (p) { if (process.env?.GD_R94_LOG) process.stderr.write('R94TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r94SaveBomb'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r95（GD_R95，默认 5，r95 SHIPPED）：自创正交轴「跟敌压牌按手牌规划成本选」——跟敌非炸、首选为非炸非走完压牌，分差≤M 内其他非炸压牌中，余牌 decompose 规划成本最低者若比首选低 ≥D → 改用（handplan 成本含拆炸/控制/逢人配惩罚；异于 r87 最小点、r93 minPlays 改压、r84 改过、r82 同型实现、领出 plan 权重）。
  // bit1 启用 M=150,D=0.2；bit2 放宽 M2=600；bit4 候选含「过」（余牌=原手）；bit8 仅我手 ≥10 张。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R95 : undefined; const m95 = v == null ? 5 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R95X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const top = ranked[0];
    if ((m95 & 1) && !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 && top && !isPass(top.move) && !isBombLike(top.move.combo) && (top.move.cards || []).length < hand.length && (!(m95 & 8) || hand.length >= 10)) {
      const M = (m95 & 2) ? X('M2', 600) : X('M', 150); const D = X('D', 0.2); const cache = new Map();
      const pc = (r) => { try { const d = decompose(isPass(r.move) ? hand : restAfter(hand, r.move), lvR, cache); return d ? d.cost : 99; } catch { return 99; } };
      const c0 = pc(top);
      const cand = ranked.filter((r) => r !== top && r.score > -1e5 && r.score >= top.score - M && (isPass(r.move) ? !!(m95 & 4) : (!isBombLike(r.move.combo) && (r.move.cards || []).length < hand.length)));
      let p = null, pcBest = c0 - D;
      for (const r of cand) { const c = pc(r); if (c <= pcBest - 1e-9) { pcBest = c; p = r; } }
      if (p) { if (process.env?.GD_R95_LOG) process.stderr.write('R95TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r95PlanBeat'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r96（GD_R96，默认 0）：自创正交轴「领出按手牌规划成本选」——领出且首选非炸非走完时，分差≤M 内其他非炸非走完领出候选中，余牌 handplan.decompose 成本最低者若比首选低 ≥D → 改领（决策点为领出；异于 r95 跟敌、r89 记牌控权、r90 顺子、r91 最小点、r92 单改对、r59 孤单、r45/r50）。
  // bit1 启用 M=150,D=0.2；bit2 放宽 M2=600；bit4 仅我手 ≥10 张；bit8 仅候选张数 ≥ 首选张数（不减少出牌张数）。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R96 : undefined; const m96 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R96X_' + k] : undefined; return e == null ? d : Number(e); };
    const lvR = full.levelRank || '2'; const hand = full.hand || []; const top = ranked[0];
    if ((m96 & 1) && full.leading && top && !isPass(top.move) && !isBombLike(top.move.combo) && (top.move.cards || []).length < hand.length && (!(m96 & 4) || hand.length >= 10)) {
      const M = (m96 & 2) ? X('M2', 600) : X('M', 150); const D = X('D', 0.2); const cache = new Map(); const n0 = (top.move.cards || []).length;
      const pc = (r) => { try { const d = decompose(restAfter(hand, r.move), lvR, cache); return d ? d.cost : 99; } catch { return 99; } };
      const c0 = pc(top);
      const cand = ranked.filter((r) => r !== top && r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo) && (r.move.cards || []).length < hand.length && (!(m96 & 8) || (r.move.cards || []).length >= n0));
      let p = null, pcBest = c0 - D;
      for (const r of cand) { const c = pc(r); if (c <= pcBest - 1e-9) { pcBest = c; p = r; } }
      if (p) { if (process.env?.GD_R96_LOG) process.stderr.write('R96TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r96PlanLead'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r97（GD_R97，默认 0）：自创正交轴「非炸出牌省逢人配/省级牌王」——首选为非炸非走完且用到逢人配（bit2 起亦含任意级牌/大小王）时，分差≤M 内存在不用这些牌的非炸非走完候选 → 改用分最高者（保留万能/控制牌；领/跟均可，r95PlanBeat 跳过不扰动；异于 r80 炸选型、r82 同型实现、r95/r96 规划成本、r89 记牌控权）。
  // bit1 启用 M=400（仅逢人配）；bit2 保留集扩到级牌+王；bit4 放宽 M2=1500；bit8 仅领出。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R97 : undefined; const m97 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R97X_' + k] : undefined; return e == null ? d : Number(e); };
    const lvR = full.levelRank || '2'; const hand = full.hand || []; const top = ranked[0];
    const keep = (m) => (m97 & 2) ? (m.cards || []).some((c) => c.rank === lvR || isJokerRank(c.rank)) : usesWild(m, lvR);
    if ((m97 & 1) && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat') && (top.move.cards || []).length < hand.length && keep(top.move) && (!(m97 & 8) || full.leading)) {
      const M = (m97 & 4) ? X('M2', 1500) : X('M', 400);
      const p = ranked.find((r) => r !== top && r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo) && (r.move.cards || []).length < hand.length && !keep(r.move));
      if (p) { if (process.env?.GD_R97_LOG) process.stderr.write('R97TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r97SaveWild'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r98（GD_R98，默认 0）：自创正交轴「收官出牌顺序：先出难压的」——领出且首选非炸非走完、出后余牌恰剩 1 手（bit4 起 ≤2 手）时，分差≤M 内同样余牌≤K 手的非炸领出候选中，出牌主点 singleStrength 最高者若高于首选 → 改领（先打控制再走完；异于 r89–r92/r96 领出改写的减手/点数/牌型/规划成本，决策点仅收官两手序；不动 r95）。
  // bit1 启用 M=300；bit2 放宽 M2=1200；bit4 余牌≤2 手亦适用；bit8 仅 endgame 求解器不适用时。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R98 : undefined; const m98 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R98X_' + k] : undefined; return e == null ? d : Number(e); };
    const lvR = full.levelRank || '2'; const hand = full.hand || []; const top = ranked[0]; const K = (m98 & 4) ? 2 : 1;
    const mp = (r) => { try { return minPlays(restAfter(hand, r.move), lvR); } catch { return 99; } };
    const st = (r) => (r.move.combo && r.move.combo.rank != null) ? singleStrength(r.move.combo.rank, lvR) : -1;
    let egOk = true; if (m98 & 8) { try { egOk = !endgameApplies(full); } catch { egOk = true; } }
    if ((m98 & 1) && egOk && full.leading && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat') && (top.move.cards || []).length < hand.length && mp(top) <= K) {
      const M = (m98 & 2) ? X('M2', 1200) : X('M', 300); const s0 = st(top);
      let p = null, sb = s0;
      for (const r of ranked) { if (r === top || r.score <= -1e5 || r.score < top.score - M || isPass(r.move) || isBombLike(r.move.combo) || (r.move.cards || []).length >= hand.length) continue; const s1 = st(r); if (s1 > sb && mp(r) <= K) { sb = s1; p = r; } }
      if (p) { if (process.env?.GD_R98_LOG) process.stderr.write('R98TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r98StrongFirst'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r99（GD_R99，默认 0）：自创正交轴「早盘跟敌小牌省控制牌改过」——跟敌非炸、敌出牌主点 singleStrength ≤T，首选为用到大小王或级牌（bit2 起亦含 A）的非炸压牌，我手 ≥H 张且两敌都 ≥E 张时，分差≤M 内「过」→ 改过（保控制牌到中后盘；异于 r84 贴边改过（无控制牌条件）、r97 换不用逢人配的压牌、r94 省炸、r87 最小压、r95 规划成本；不动 r95PlanBeat）。
  // bit1 启用 M=600,T=强度(10),H=12,E=10；bit2 控制集含 A；bit4 放宽 M2=2000；bit8 仅敌出单张/对子。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R99 : undefined; const m99 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R99X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const top = ranked[0]; const rc = full.remainingSeatCounts || [];
    const ctl = (m) => (m.cards || []).some((c) => c.rank === lvR || isJokerRank(c.rank) || ((m99 & 2) && c.rank === 'A'));
    const pv = full.previous; const ls = full.lastPlaySeat;
    const e1 = rc[(me + 1) % 4], e3 = rc[(me + 3) % 4]; const E = X('E', 10);
    if ((m99 & 1) && !full.leading && pv && !isBombLike(pv) && ls != null && ls % 2 !== me % 2 && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat') && ctl(top.move)
      && hand.length >= X('H', 12) && (e1 == null || e1 >= E) && (e3 == null || e3 >= E) && pv.rank != null && singleStrength(pv.rank, lvR) <= singleStrength('10', lvR)
      && (!(m99 & 8) || pv.type === TYPES.SINGLE || pv.type === TYPES.PAIR)) {
      const M = (m99 & 4) ? X('M2', 2000) : X('M', 600);
      const p = ranked.find((r) => r.score > -1e5 && isPass(r.move) && r.score >= top.score - M);
      if (p) { if (process.env?.GD_R99_LOG) process.stderr.write('R99TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r99SaveCtl'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r100（GD_R100，默认 0）：自创正交轴「敌短手顶大压」——跟敌非炸、出牌敌余牌 ≤S 张（bit4 起 ≤8），首选为非炸非走完压牌时，分差≤M 内其他非炸压牌中主点 singleStrength 最高者若高于首选 → 改用（敌将走完时用大牌封顶减少其续出；异于 r87 最小压、r95 规划成本、r60 只能炸、r76 敌已头游、r99 改过、r98 领出；不动 r95PlanBeat）。
  // bit1 启用 S=5,M=400；bit2 放宽 M2=1200；bit4 S=8；bit8 仅敌出单张/对子。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R100 : undefined; const m100 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R100X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const top = ranked[0]; const rc = full.remainingSeatCounts || [];
    const pv = full.previous; const ls = full.lastPlaySeat;
    const st = (r) => (r.move.combo && r.move.combo.rank != null) ? singleStrength(r.move.combo.rank, lvR) : -1;
    const S = (m100 & 4) ? X('S2', 8) : X('S', 5);
    if ((m100 & 1) && !full.leading && pv && !isBombLike(pv) && ls != null && ls % 2 !== me % 2 && rc[ls] != null && rc[ls] > 0 && rc[ls] <= S
      && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat') && (top.move.cards || []).length < hand.length
      && (!(m100 & 8) || pv.type === TYPES.SINGLE || pv.type === TYPES.PAIR)) {
      const M = (m100 & 2) ? X('M2', 1200) : X('M', 400); let p = null, sb = st(top);
      for (const r of ranked) { if (r === top || r.score <= -1e5 || r.score < top.score - M || isPass(r.move) || isBombLike(r.move.combo) || (r.move.cards || []).length >= hand.length) continue; const s1 = st(r); if (s1 > sb) { sb = s1; p = r; } }
      if (p) { if (process.env?.GD_R100_LOG) process.stderr.write('R100TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r100CapShort'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r101（GD_R101，默认 0）：自创正交轴「对家短手让路」——跟敌非炸、对家余牌 ≤S 张且尚在场，首选为非炸非走完压牌且主点 singleStrength ≥ A（bit4 起不限点），我余牌 > S 时，分差≤M 内若有过 → 改过（把控制牌留下、让对家接手走牌；异于 r99 早盘省控按敌余牌、r84 贴边改过、r54/r65/r66 跟对家、r69 对家短不顶领出；不动 r95PlanBeat）。
  // bit1 启用 S=6,M=500；bit2 放宽 M2=1500；bit4 不限主点；bit8 仅出牌敌为上家（下家敌与对家尚未表态）。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R101 : undefined; const m101 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R101X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const top = ranked[0]; const rc = full.remainingSeatCounts || [];
    const pv = full.previous; const ls = full.lastPlaySeat; const tm = (me + 2) % 4; const S = X('S', 6);
    const tst = (top && top.move.combo && top.move.combo.rank != null) ? singleStrength(top.move.combo.rank, lvR) : -1;
    if ((m101 & 1) && !full.leading && pv && !isBombLike(pv) && ls != null && ls % 2 !== me % 2 && rc[tm] != null && rc[tm] > 0 && rc[tm] <= S && hand.length > S
      && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat') && (top.move.cards || []).length < hand.length
      && ((m101 & 4) || tst >= singleStrength('A', lvR)) && (!(m101 & 8) || ls === (me + 3) % 4)) {
      const M = (m101 & 2) ? X('M2', 1500) : X('M', 500);
      const p = ranked.find((r) => r.score > -1e5 && isPass(r.move) && r.score >= top.score - M);
      if (p) { if (process.env?.GD_R101_LOG) process.stderr.write('R101TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r101YieldMate'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r102（GD_R102，默认 0）：自创正交轴「跟敌拆组压 → 换不拆」——跟敌非炸单张（bit4 含对子），首选为非炸非走完压牌且其主点在手中张数多于压牌张数（拆对/拆三），分差≤M 内若有主点手中张数恰等于压牌张数的非炸压牌 → 改用（保持对子/三张结构；bit8 无此类时允许改过）。异于 r87 最小压、r100 顶大、r101 让路、r59 孤儿领出、r82 同型实现；不动 r95PlanBeat。
  // bit1 启用 M=300；bit2 M2=900；bit4 含对子跟；bit8 无不拆压时改过。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R102 : undefined; const m102 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R102X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const hand = full.hand || []; const top = ranked[0]; const pv = full.previous;
    const okT = pv && (pv.type === TYPES.SINGLE || ((m102 & 4) && pv.type === TYPES.PAIR));
    if ((m102 & 1) && !full.leading && okT && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2
      && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat') && (top.move.cards || []).length < hand.length && top.move.combo?.rank != null) {
      const byR = rankCounts(hand); const n = (top.move.cards || []).length;
      if ((byR.get(top.move.combo.rank) || 0) > n && !usesWild(top.move, full.levelRank || '2')) {
        const M = (m102 & 2) ? X('M2', 900) : X('M', 300);
        let p = ranked.find((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo) && r.move.combo?.rank != null && (r.move.cards || []).length === n && (byR.get(r.move.combo.rank) || 0) === n && (r.move.cards || []).length < hand.length && r.score >= top.score - M);
        if (!p && (m102 & 8)) p = ranked.find((r) => r.score > -1e5 && isPass(r.move) && r.score >= top.score - M);
        if (p) { if (process.env?.GD_R102_LOG) process.stderr.write('R102TRIG\n');
          p.score = top.score + 1; p.tags = (p.tags || []).concat('r102KeepSet'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
      }
    } }
  // r103（GD_R103，默认 0）：自创正交轴「记牌顶张夺权：跟敌过→必回手压」——跟敌非炸单/对（bit4 含三张），首选为过且我非一手走完时，分差≤M 内若有非炸非走完同型压牌、且外面（belief.remainingByRank 未出且不在我手）已无可压它的同型（beaters=0，不计炸弹）→ 改压（夺回领权；异于 r93 结构不劣改压、r89 领出记牌、r85 safety 换手、r84/r99/r101 改过、r95 规划成本；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 含三张；bit8 仅我手 ≤12 张。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R103 : undefined; const m103 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R103X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const top = ranked[0]; const pv = full.previous;
    const okT = pv && (pv.type === TYPES.SINGLE || pv.type === TYPES.PAIR || ((m103 & 4) && pv.type === TYPES.TRIPLE));
    if ((m103 & 1) && !full.leading && okT && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 && top && isPass(top.move) && full.belief?.remainingByRank
      && (!(m103 & 8) || hand.length <= 12)) {
      const rem = full.belief.remainingByRank; const mine = {};
      for (const c of hand) mine[c.rank] = (mine[c.rank] || 0) + 1;
      const beaters = (mv) => { const n = (mv.cards || []).length; const s0 = singleStrength(mv.combo.rank, lvR); let b = 0;
        for (const [rk, cnt] of Object.entries(rem)) { let s; try { s = singleStrength(rk, lvR); } catch { continue; }
          if (s <= s0) continue; const out = Math.max(0, cnt - (mine[rk] || 0)); if (out >= n) b += 1; }
        return b; };
      const M = (m103 & 2) ? X('M2', 900) : X('M', 300);
      const p = ranked.find((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo) && r.move.combo?.type === pv.type && r.move.combo?.rank != null
        && (r.move.cards || []).length < hand.length && beaters(r.move) === 0);
      if (p) { if (process.env?.GD_R103_LOG) process.stderr.write('R103TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r103TopSeize'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r104（GD_R104，默认 0）：自创正交轴「末位拦截：我是最后可压者」——跟敌非炸、出牌敌为下家（对家与另一敌都已过，我过则下家敌直接回手领出），首选为过（非 r95PlanBeat）时，分差≤M 内若有非炸非走完压牌 → 改压分最高者（座位顺序「最后机会」条件；异于 r93 结构不劣改压、r103 记牌顶张、r47 压后≤K 手、r88 跟对家、r60 炸拦、r71 拦下家领出；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅出牌敌余牌 ≤10；bit8 仅敌出单/对。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R104 : undefined; const m104 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R104X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const hand = full.hand || []; const top = ranked[0]; const pv = full.previous; const ls = full.lastPlaySeat; const rc = full.remainingSeatCounts || [];
    if ((m104 & 1) && !full.leading && pv && !isBombLike(pv) && ls != null && ls === (me + 1) % 4 && top && isPass(top.move) && !(top.tags || []).includes('r95PlanBeat')
      && (!(m104 & 4) || (rc[ls] != null && rc[ls] <= 10)) && (!(m104 & 8) || pv.type === TYPES.SINGLE || pv.type === TYPES.PAIR)) {
      const M = (m104 & 2) ? X('M2', 900) : X('M', 300);
      const p = ranked.find((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo) && (r.move.cards || []).length < hand.length);
      if (p) { if (process.env?.GD_R104_LOG) process.stderr.write('R104TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r104LastStop'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r105（GD_R105，默认 0）：自创正交轴「大牌型跟敌接压」——跟敌非炸且敌出牌张数 ≥5（顺子/三带二/连对/钢板），首选为过（非 r95PlanBeat）时，分差≤M 内有同型非炸非走完压牌 → 改压分最高者（按牌型大小门控、无结构/座位/记牌条件；异于 r93 结构不劣改压、r103 记牌顶张单/对/三、r104 末位座位、r47 压后≤K 手、r61 对家出完；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅我手 ≥10 张；bit8 仅出牌敌余牌 ≤12。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R105 : undefined; const m105 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R105X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const hand = full.hand || []; const top = ranked[0]; const pv = full.previous; const ls = full.lastPlaySeat; const rc = full.remainingSeatCounts || [];
    const big = pv && (pv.type === TYPES.STRAIGHT || pv.type === TYPES.FULLHOUSE || pv.type === TYPES.PAIR_SEQ || pv.type === TYPES.TRIPLE_SEQ);
    if ((m105 & 1) && !full.leading && pv && !isBombLike(pv) && ls != null && ls % 2 !== me % 2 && big && top && isPass(top.move) && !(top.tags || []).includes('r95PlanBeat')
      && (!(m105 & 4) || hand.length >= 10) && (!(m105 & 8) || (rc[ls] != null && rc[ls] <= 12))) {
      const M = (m105 & 2) ? X('M2', 900) : X('M', 300);
      const p = ranked.find((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo) && r.move.combo?.type === pv.type && (r.move.cards || []).length < hand.length);
      if (p) { if (process.env?.GD_R105_LOG) process.stderr.write('R105TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r105BigFollow'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r106（GD_R106，默认 0）：自创正交轴「敌报牌领出避型」——领出且首选非炸非走完、某敌余牌 n≤N（bit1 N=1：首选单张；bit4 N=2：首选张数≤2）且首选张数 ≤ 该敌余牌时，分差≤M 内若有张数 > 该敌余牌的非炸非走完领出 → 改领分最高者（按敌余牌张数避其可接的型；异于 r89–r92/r96/r98 领出改写的记牌/顺子/最小点/单改对/规划/顺序、r100 跟敌短手顶大；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 N=2；bit8 仅短手敌为下家。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R106 : undefined; const m106 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R106X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const hand = full.hand || []; const top = ranked[0]; const rc = full.remainingSeatCounts || [];
    if ((m106 & 1) && full.leading && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat') && (top.move.cards || []).length < hand.length) {
      const N = (m106 & 4) ? 2 : 1; const n0 = (top.move.cards || []).length;
      const ens = [(me + 1) % 4, (me + 3) % 4].filter((s) => (!(m106 & 8) || s === (me + 1) % 4) && rc[s] != null && rc[s] > 0 && rc[s] <= N && n0 <= rc[s]);
      if (ens.length) { const need = Math.max(...ens.map((s) => rc[s]));
        const M = (m106 & 2) ? X('M2', 900) : X('M', 300);
        const p = ranked.find((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo) && (r.move.cards || []).length > need && (r.move.cards || []).length < hand.length);
        if (p) { if (process.env?.GD_R106_LOG) process.stderr.write('R106TRIG\n');
          p.score = top.score + 1; p.tags = (p.tags || []).concat('r106AvoidShort'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; } }
    } }
  // r107（GD_R107，默认 0）：自创正交轴「上家敌出、对家可接时让对家」——跟敌非炸且出牌者为上家敌（对家尚未表态），首选为非炸非走完压牌（非 r95PlanBeat）、对家余牌 < 我余牌时，分差≤M 内「过」→ 改过（按座位+对家张数让接手；异于 r84 贴边改过无座位条件、r99 控制牌改过、r104 末位改压、r52/r54 压对家、r88 跟对家顶）。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅对家 ≤8 张；bit8 仅敌出主点 ≤10。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R107 : undefined; const m107 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R107X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const hand = full.hand || []; const top = ranked[0]; const pv = full.previous; const ls = full.lastPlaySeat; const rc = full.remainingSeatCounts || [];
    const pc = rc[(me + 2) % 4]; const lvR = full.levelRank || '2';
    if ((m107 & 1) && !full.leading && pv && !isBombLike(pv) && ls === (me + 3) % 4 && top && !isPass(top.move) && !isBombLike(top.move.combo)
      && !(top.tags || []).includes('r95PlanBeat') && (top.move.cards || []).length < hand.length && pc != null && pc > 0 && pc < hand.length
      && (!(m107 & 4) || pc <= 8) && (!(m107 & 8) || (pv.rank != null && singleStrength(pv.rank, lvR) <= singleStrength('10', lvR)))) {
      const M = (m107 & 2) ? X('M2', 900) : X('M', 300);
      const p = ranked.find((r) => r.score > -1e5 && r.score >= top.score - M && isPass(r.move));
      if (p) { if (process.env?.GD_R107_LOG) process.stderr.write('R107TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r107LetPartner'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r108（GD_R108，默认 0）：自创正交轴「敌头游后抢二游：跟剩余敌过→炸」——已有敌方出完（finishedOrder 含敌座）、对家未出完，跟剩余敌非炸、首选为过（非 r95PlanBeat）时，分差≤M 内有非走完炸弹 → 改炸分最高者（按出完状态门控：敌头游后剩余敌二游即 +3，异于 r45/r46/r60 按手数/拦截炸回、r94 省炸、r61 对家出完、r84/r99/r107 改过、r93/r103–r105 改非炸压；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 也允许非炸非走完压牌；bit8 仅剩余敌 ≤8 张。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R108 : undefined; const m108 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R108X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const hand = full.hand || []; const top = ranked[0]; const pv = full.previous; const ls = full.lastPlaySeat; const rc = full.remainingSeatCounts || [];
    const fo = full.finishedOrder || [];
    if ((m108 & 1) && !full.leading && pv && !isBombLike(pv) && ls != null && ls % 2 !== me % 2 && top && isPass(top.move) && !(top.tags || []).includes('r95PlanBeat')
      && fo.some((s) => s % 2 !== me % 2) && !fo.includes((me + 2) % 4) && (!(m108 & 8) || (rc[ls] != null && rc[ls] <= 8))) {
      const M = (m108 & 2) ? X('M2', 900) : X('M', 300);
      const p = ranked.find((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && (isBombLike(r.move.combo) || (m108 & 4)) && (r.move.cards || []).length < hand.length);
      if (p) { if (process.env?.GD_R108_LOG) process.stderr.write('R108TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r108SecondPlace'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r109（GD_R109，默认 0）：自创正交轴「记牌跟敌换控权顶张」——跟敌非炸、首选为非炸非走完压牌（非 r95PlanBeat），分差≤M 内其他非炸非走完压牌中，外面（belief.remainingByRank 未出且不在我手）可压它的同型点数严格更少者 → 改用最少者（同少取分高；跟敌已压时换更稳控权顶；异于 r89 领出记牌、r103 过→必回手压、r95 规划成本、r87 最小点、r100 顶大、r102 不拆组、r106 领出避型；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅首选 outside beaters≥2。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R109 : undefined; const m109 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R109X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const top = ranked[0]; const pv = full.previous; const ls = full.lastPlaySeat;
    const okT = !(m109 & 4) || (pv && (pv.type === TYPES.SINGLE || pv.type === TYPES.PAIR));
    if ((m109 & 1) && !full.leading && pv && !isBombLike(pv) && ls != null && ls % 2 !== me % 2 && okT
      && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat')
      && (top.move.cards || []).length < hand.length && top.move.combo?.rank != null && full.belief?.remainingByRank) {
      const rem = full.belief.remainingByRank; const mine = {};
      for (const c of hand) mine[c.rank] = (mine[c.rank] || 0) + 1;
      const beaters = (mv) => { if (!mv?.combo?.rank) return 99; const n = (mv.cards || []).length; const s0 = singleStrength(mv.combo.rank, lvR); let b = 0;
        for (const [rk, cnt] of Object.entries(rem)) { let s; try { s = singleStrength(rk, lvR); } catch { continue; }
          if (s <= s0) continue; const out = Math.max(0, cnt - (mine[rk] || 0)); if (out >= n) b += 1; }
        return b; };
      const b0 = beaters(top.move);
      if (!(m109 & 8) || b0 >= 2) {
        const M = (m109 & 2) ? X('M2', 900) : X('M', 300);
        const cands = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
          && (r.move.cards || []).length < hand.length && r.move.combo?.rank != null && beaters(r.move) < b0);
        cands.sort((a, b) => beaters(a.move) - beaters(b.move) || b.score - a.score);
        const p = cands[0];
        if (p) { if (process.env?.GD_R109_LOG) process.stderr.write('R109TRIG\n');
          p.score = top.score + 1; p.tags = (p.tags || []).concat('r109BeliefCap'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
      }
    } }
  // r110（GD_R110，默认 0）：自创正交轴「跟敌压牌减孤张」——跟敌非炸、首选为非炸非走完压牌（非 r95PlanBeat），分差≤M 内其他非炸非走完压牌中，压后余牌天然孤张数（非逢人配、同点恰 1 张）严格更少者 → 改用最少者（同少取分高；保结构减散牌；异于 r102 不拆当前点组、r95 规划成本、r87 最小点、r100 顶大、r82 同型实现、r109 记牌控权；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅首选压后孤张 ≥2。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R110 : undefined; const m110 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R110X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const top = ranked[0]; const pv = full.previous; const ls = full.lastPlaySeat;
    const okT = !(m110 & 4) || (pv && (pv.type === TYPES.SINGLE || pv.type === TYPES.PAIR));
    const iso = (h) => { const u = new Map(); for (const c of h) { if (isWildCard(c, lvR)) continue; u.set(c.rank, (u.get(c.rank) || 0) + 1); } let n = 0; for (const x of u.values()) if (x === 1) n++; return n; };
    if ((m110 & 1) && !full.leading && pv && !isBombLike(pv) && ls != null && ls % 2 !== me % 2 && okT
      && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat')
      && (top.move.cards || []).length < hand.length) {
      const i0 = iso(restAfter(hand, top.move));
      if (!(m110 & 8) || i0 >= 2) {
        const M = (m110 & 2) ? X('M2', 900) : X('M', 300);
        const cands = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
          && (r.move.cards || []).length < hand.length && iso(restAfter(hand, r.move)) < i0);
        cands.sort((a, b) => iso(restAfter(hand, a.move)) - iso(restAfter(hand, b.move)) || b.score - a.score);
        const p = cands[0];
        if (p) { if (process.env?.GD_R110_LOG) process.stderr.write('R110TRIG\n');          p.score = top.score + 1; p.tags = (p.tags || []).concat('r110LessIso'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
      }
    } }
  // r111（GD_R111，默认 0）：自创正交轴「跟敌压牌省控制牌」——跟敌非炸、首选为非炸非走完压牌且用到控制牌（大王/小王/级牌/A）（非 r95PlanBeat），分差≤M 内有不含控制牌的非炸非走完压 → 改用分最高者（压→换压省控；异于 r99 省控改过、r97 省逢人配/级/王、r87 最小点、r110 孤张、r95 handplan、r67 单对改非控；避开 r59、r75–r110、过→改压、压→改过、领出结构、记牌换控权；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅敌出主点≤10。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R111 : undefined; const m111 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R111X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const top = ranked[0]; const pv = full.previous; const ls = full.lastPlaySeat;
    const okT = !(m111 & 4) || (pv && (pv.type === TYPES.SINGLE || pv.type === TYPES.PAIR));
    const isCtrl = (mv) => (mv.cards || []).some((c) => isJokerRank(c.rank) || c.rank === lvR || singleStrength(c.rank, lvR) >= singleStrength('A', lvR));
    const okEnemy = !(m111 & 8) || (pv && pv.rank && singleStrength(pv.rank, lvR) <= singleStrength('10', lvR) && pv.rank !== lvR);
    if ((m111 & 1) && !full.leading && pv && !isBombLike(pv) && ls != null && ls % 2 !== me % 2 && okT && okEnemy
      && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat')
      && (top.move.cards || []).length < hand.length && isCtrl(top.move)) {
      const M = (m111 & 2) ? X('M2', 900) : X('M', 300);
      const cands = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
        && (r.move.cards || []).length < hand.length && !isCtrl(r.move));
      cands.sort((a, b) => b.score - a.score);
      const p = cands[0];
      if (p) { if (process.env?.GD_R111_LOG) process.stderr.write('R111TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r111SaveCtrl'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r112（GD_R112，默认 0）：自创正交轴「跟敌压牌后留控更多」——跟敌非炸、首选为非炸非走完压牌（非 r95PlanBeat），分差≤M 内其他非炸非走完压牌中，压后余牌控制牌数（大王/小王/级牌/A）严格更多者 → 改用最多者（同多取分高；压后余控优化；异于 r111 首选含控改不含控、r110 孤张、r97 省逢人配出牌、r99 省控改过、r95 handplan；避开 r59、r75–r111、过→改压、压→改过、领出结构、记牌换控权惨败、减孤张；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅首选压后控牌≤1。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R112 : undefined; const m112 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R112X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const top = ranked[0]; const pv = full.previous; const ls = full.lastPlaySeat;
    const okT = !(m112 & 4) || (pv && (pv.type === TYPES.SINGLE || pv.type === TYPES.PAIR));
    const nCtrl = (h) => h.filter((c) => isJokerRank(c.rank) || c.rank === lvR || singleStrength(c.rank, lvR) >= singleStrength('A', lvR)).length;
    if ((m112 & 1) && !full.leading && pv && !isBombLike(pv) && ls != null && ls % 2 !== me % 2 && okT
      && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat')
      && (top.move.cards || []).length < hand.length) {
      const c0 = nCtrl(restAfter(hand, top.move));
      if (!(m112 & 8) || c0 <= 1) {
        const M = (m112 & 2) ? X('M2', 900) : X('M', 300);
        const cands = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
          && (r.move.cards || []).length < hand.length && nCtrl(restAfter(hand, r.move)) > c0);
        cands.sort((a, b) => nCtrl(restAfter(hand, b.move)) - nCtrl(restAfter(hand, a.move)) || b.score - a.score);
        const p = cands[0];
        if (p) { if (process.env?.GD_R112_LOG) process.stderr.write('R112TRIG\n');
          p.score = top.score + 1; p.tags = (p.tags || []).concat('r112RemCtrl'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
      }
    } }
  // r113（GD_R113，默认 0）：自创正交轴「跟敌压牌后留三张更多」——跟敌非炸、首选为非炸非走完压牌（非 r95PlanBeat），分差≤M 内其他非炸非走完压牌中，压后余牌天然三张组数（非逢人配/王、同点恰 3 张）严格更多者 → 改用最多者（同多取分高；压后结构留三；异于 r110 孤张、r112 留控、r111 省控、r102 拆组、r95 handplan、r87 最小点；避开 r59、r75–r112、过→改压、压→改过、领出结构、记牌换控权、减孤张、省控、留控镜像；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅首选压后三张组≤1。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R113 : undefined; const m113 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R113X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const top = ranked[0]; const pv = full.previous; const ls = full.lastPlaySeat;
    const okT = !(m113 & 4) || (pv && (pv.type === TYPES.SINGLE || pv.type === TYPES.PAIR));
    const nTri = (h) => { const u = new Map(); for (const c of h) { if (isWildCard(c, lvR) || isJokerRank(c.rank)) continue; u.set(c.rank, (u.get(c.rank) || 0) + 1); } let n = 0; for (const x of u.values()) if (x === 3) n++; return n; };
    if ((m113 & 1) && !full.leading && pv && !isBombLike(pv) && ls != null && ls % 2 !== me % 2 && okT
      && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat')
      && (top.move.cards || []).length < hand.length) {
      const t0 = nTri(restAfter(hand, top.move));
      if (!(m113 & 8) || t0 <= 1) {
        const M = (m113 & 2) ? X('M2', 900) : X('M', 300);
        const cands = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
          && (r.move.cards || []).length < hand.length && nTri(restAfter(hand, r.move)) > t0);
        cands.sort((a, b) => nTri(restAfter(hand, b.move)) - nTri(restAfter(hand, a.move)) || b.score - a.score);
        const p = cands[0];
        if (p) { if (process.env?.GD_R113_LOG) process.stderr.write('R113TRIG\n');
          p.score = top.score + 1; p.tags = (p.tags || []).concat('r113RemTri'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
      }
    } }
  // r114（GD_R114，默认 0）：自创正交轴「跟敌压牌后结构更丰富」——跟敌非炸、首选为非炸非走完压牌（非 r95PlanBeat），分差≤M 内其他非炸非走完压牌中，压后余牌结构分（天然对×1 + 三张×2 + 炸弹×3；非逢人配/王）严格更高者 → 改用最高者（同高取分高；压后结构丰度；异于 r113 仅留三、r110 减孤张、r112 留控、r102 拆组、r95 handplan、r87 最小点；避开 r59、r75–r113、过→改压、压→改过、领出结构、记牌换控权、减孤张、省控、留控、留三张；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅首选压后结构分≤2。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R114 : undefined; const m114 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R114X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const top = ranked[0]; const pv = full.previous; const ls = full.lastPlaySeat;
    const okT = !(m114 & 4) || (pv && (pv.type === TYPES.SINGLE || pv.type === TYPES.PAIR));
    const rich = (h) => { const u = new Map(); for (const c of h) { if (isWildCard(c, lvR) || isJokerRank(c.rank)) continue; u.set(c.rank, (u.get(c.rank) || 0) + 1); } let s = 0; for (const x of u.values()) { if (x === 2) s += 1; else if (x === 3) s += 2; else if (x >= 4) s += 3; } return s; };
    if ((m114 & 1) && !full.leading && pv && !isBombLike(pv) && ls != null && ls % 2 !== me % 2 && okT
      && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat')
      && (top.move.cards || []).length < hand.length) {
      const r0 = rich(restAfter(hand, top.move));
      if (!(m114 & 8) || r0 <= 2) {
        const M = (m114 & 2) ? X('M2', 900) : X('M', 300);
        const cands = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
          && (r.move.cards || []).length < hand.length && rich(restAfter(hand, r.move)) > r0);
        cands.sort((a, b) => rich(restAfter(hand, b.move)) - rich(restAfter(hand, a.move)) || b.score - a.score);
        const p = cands[0];
        if (p) { if (process.env?.GD_R114_LOG) process.stderr.write('R114TRIG\n');
          p.score = top.score + 1; p.tags = (p.tags || []).concat('r114ShapeRich'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
      }
    } }
  // r115（GD_R115，默认 0）：自创正交轴「跟敌能压不炸」——跟敌非炸、首选为非走完炸弹（非 r95PlanBeat），分差≤M 内有非炸非走完压牌 → 改用分最高者（炸弹时机：能非炸压则留炸；异于 r94 省炸（首选过时不炸）、r45/r46/r60/r108 过→炸、r80 炸选型、r10 bombClear、r97 省逢人配；避开 r59、r75–r114、跟敌改压后结构/控/孤张/三张簇、过→改压、压→改过、领出结构；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅两敌余牌都 >8。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R115 : undefined; const m115 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R115X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const top = ranked[0]; const pv = full.previous; const ls = full.lastPlaySeat;
    const rc = full.remainingSeatCounts || [];
    const okT = !(m115 & 4) || (pv && (pv.type === TYPES.SINGLE || pv.type === TYPES.PAIR));
    const eMin = Math.min(rc[(me + 1) % 4] ?? 27, rc[(me + 3) % 4] ?? 27);
    const okE = !(m115 & 8) || eMin > 8;
    if ((m115 & 1) && !full.leading && pv && !isBombLike(pv) && ls != null && ls % 2 !== me % 2 && okT && okE
      && top && !isPass(top.move) && isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat')
      && (top.move.cards || []).length < hand.length) {
      const M = (m115 & 2) ? X('M2', 900) : X('M', 300);
      const cands = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
        && (r.move.cards || []).length < hand.length);
      cands.sort((a, b) => b.score - a.score);
      const p = cands[0];
      if (p) { if (process.env?.GD_R115_LOG) process.stderr.write('R115TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r115NoBombBeat'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r116（GD_R116，默认 0）：自创正交轴「领出减手数」——领出、首选为非炸非走完（非 r95PlanBeat）时，分差≤M 内其他非炸非走完领出中，出后 minPlays 严格更少者 → 改用最少者（同少取分高；异于 r90 顺子、r92 单改对、r89 记牌、r96 handplan 成本、r98 收官难压、甩多张；避开 r59、r75–r115、跟敌改压后结构/控/孤张/三张/能压不炸簇；保留 sticky GD_R95=5；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅我手 ≥12 张；bit8 仅首选出后 minPlays ≥3。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R116 : undefined; const m116 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R116X_' + k] : undefined; return e == null ? d : Number(e); };
    const hand = full.hand || []; const top = ranked[0]; const lvR = full.levelRank || '2';
    if ((m116 & 1) && full.leading && top && !isPass(top.move) && !isBombLike(top.move.combo)
      && !(top.tags || []).includes('r95PlanBeat') && (top.move.cards || []).length < hand.length
      && (!(m116 & 4) || hand.length >= 12)) {
      const mp0 = minPlays(restAfter(hand, top.move), lvR);
      if (!(m116 & 8) || mp0 >= 3) {
        const M = (m116 & 2) ? X('M2', 900) : X('M', 300);
        const cands = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
          && (r.move.cards || []).length < hand.length && minPlays(restAfter(hand, r.move), lvR) < mp0);
        cands.sort((a, b) => minPlays(restAfter(hand, a.move), lvR) - minPlays(restAfter(hand, b.move), lvR) || b.score - a.score);
        const p = cands[0];
        if (p) { if (process.env?.GD_R116_LOG) process.stderr.write('R116TRIG\n');
          p.score = top.score + 1; p.tags = (p.tags || []).concat('r116LeadFewerPlays'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
      }
    } }
  // r117（GD_R117，默认 0）：自创正交轴「领出减孤张」——领出、首选为非炸非走完（非 r95PlanBeat）时，分差≤M 内其他非炸非走完领出中，出后余牌天然孤张数（非逢人配、同点恰 1 张）严格更少者 → 改用最少者（同少取分高；异于 r116 减手数、r110 跟敌减孤张、r89 记牌、r90/r92/r96/r98 领出改写；避开 r59、r75–r116、跟敌改压后结构/控/孤张/三张/能压不炸簇；保留 sticky GD_R95=5；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅我手 ≥12 张；bit8 仅首选出后孤张 ≥2。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R117 : undefined; const m117 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R117X_' + k] : undefined; return e == null ? d : Number(e); };
    const hand = full.hand || []; const top = ranked[0]; const lvR = full.levelRank || '2';
    const iso = (h) => { const u = new Map(); for (const c of h) { if (isWildCard(c, lvR)) continue; u.set(c.rank, (u.get(c.rank) || 0) + 1); } let n = 0; for (const x of u.values()) if (x === 1) n++; return n; };
    if ((m117 & 1) && full.leading && top && !isPass(top.move) && !isBombLike(top.move.combo)
      && !(top.tags || []).includes('r95PlanBeat') && (top.move.cards || []).length < hand.length
      && (!(m117 & 4) || hand.length >= 12)) {
      const i0 = iso(restAfter(hand, top.move));
      if (!(m117 & 8) || i0 >= 2) {
        const M = (m117 & 2) ? X('M2', 900) : X('M', 300);
        const cands = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
          && (r.move.cards || []).length < hand.length && iso(restAfter(hand, r.move)) < i0);
        cands.sort((a, b) => iso(restAfter(hand, a.move)) - iso(restAfter(hand, b.move)) || b.score - a.score);
        const p = cands[0];
        if (p) { if (process.env?.GD_R117_LOG) process.stderr.write('R117TRIG\n');
          p.score = top.score + 1; p.tags = (p.tags || []).concat('r117LeadLessIso'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
      }
    } }
  // r118（GD_R118，默认 0）：自创正交轴「对家已出完领出甩多张」——领出、对家余牌=0、至少一敌仍在、首选为非炸非走完（非 r95PlanBeat）时，分差≤M 内其他非炸非走完领出中张数严格更多者 → 改用最多者（同多取分高；接风后抢二游甩牌；异于 r78 bit2 按敌最短 emin 门槛换宽牌、r108 敌头游后炸、r56 喂对家、r86 甩慢敌、r61 bit16 跟敌压；避开 r59、r75–r117、跟敌改压结构簇、能压不炸、领出减手数/减孤张；保留 sticky GD_R95=5；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅两敌都在；bit8 仅首选张数 ≤3。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R118 : undefined; const m118 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R118X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const hand = full.hand || []; const top = ranked[0]; const rc = full.remainingSeatCounts || [];
    const pc = rc[(me + 2) % 4] ?? 27; const e1 = rc[(me + 1) % 4] ?? 27; const e2 = rc[(me + 3) % 4] ?? 27;
    const enemAlive = (e1 > 0 ? 1 : 0) + (e2 > 0 ? 1 : 0);
    const okE = !(m118 & 4) || enemAlive === 2;
    if ((m118 & 1) && full.leading && pc === 0 && enemAlive >= 1 && okE && top && !isPass(top.move) && !isBombLike(top.move.combo)
      && !(top.tags || []).includes('r95PlanBeat') && (top.move.cards || []).length < hand.length
      && (!(m118 & 8) || (top.move.cards || []).length <= 3)) {
      const n0 = (top.move.cards || []).length;
      const M = (m118 & 2) ? X('M2', 900) : X('M', 300);
      const cands = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
        && (r.move.cards || []).length < hand.length && (r.move.cards || []).length > n0);
      cands.sort((a, b) => (b.move.cards || []).length - (a.move.cards || []).length || b.score - a.score);
      const p = cands[0];
      if (p) { if (process.env?.GD_R118_LOG) process.stderr.write('R118TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r118DumpAfterPartnerOut'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r119（GD_R119，默认 0）：自创正交轴「对家已出完跟敌压牌换最小点」——对家余牌=0、跟敌非炸、首选为非炸非走完压牌（非 r95PlanBeat）时，分差≤M 内其他非炸非走完压牌中主点 singleStrength 严格更小者 → 改用最小者（同小取分高；接风残局省大牌抢二游；异于 r87 一般跟敌最小压、r118 领出甩多张、r108 炸、r61 bit16 过→压、r100 顶大、r109 记牌换顶；避开 r59、r75–r118、跟敌改压结构簇、能压不炸、领出减手数/减孤张/对家出完甩多张；保留 sticky GD_R95=5；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅首选强度 ≥10。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R119 : undefined; const m119 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R119X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const hand = full.hand || []; const lvR = full.levelRank || '2'; const top = ranked[0];
    const rc = full.remainingSeatCounts || []; const pc = rc[(me + 2) % 4] ?? 27;
    const pv = full.previous; const ls = full.lastPlaySeat;
    if ((m119 & 1) && !full.leading && pc === 0 && pv && !isBombLike(pv) && ls != null && ls % 2 !== me % 2
      && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat')
      && (top.move.cards || []).length < hand.length && top.move.combo?.rank != null
      && (!(m119 & 4) || pv.type === TYPES.SINGLE || pv.type === TYPES.PAIR)) {
      const s0 = singleStrength(top.move.combo.rank, lvR);
      if (!(m119 & 8) || s0 >= X('S', 10)) {
        const M = (m119 & 2) ? X('M2', 900) : X('M', 300);
        const cands = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
          && (r.move.cards || []).length < hand.length && r.move.combo?.rank != null
          && singleStrength(r.move.combo.rank, lvR) < s0);
        cands.sort((a, b) => singleStrength(a.move.combo.rank, lvR) - singleStrength(b.move.combo.rank, lvR) || b.score - a.score);
        const p = cands[0];
        if (p) { if (process.env?.GD_R119_LOG) process.stderr.write('R119TRIG\n');
          p.score = top.score + 1; p.tags = (p.tags || []).concat('r119ResumeMinBeat'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
      }
    } }
  // r120（GD_R120，默认 0）：自创正交轴「对家已出完领出换最小点」——领出、对家余牌=0、至少一敌仍在、首选为非炸非走完（非 r95PlanBeat）时，分差≤M 内其他非炸非走完领出中主点 singleStrength 严格更小者 → 改用最小者（同小取分高；接风后省大牌控敌抢二游；异于 r118 甩多张、r119 跟敌换最小点、r91 一般领出最小点、r116 减手数、r117 减孤张、r108 炸；避开 r59、r75–r119、跟敌改压结构簇、能压不炸、领出减手数/减孤张/对家出完甩多张/跟敌换最小点；保留 sticky GD_R95=5；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅两敌都在；bit8 仅首选强度≥10。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R120 : undefined; const m120 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R120X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const hand = full.hand || []; const lvR = full.levelRank || '2'; const top = ranked[0];
    const rc = full.remainingSeatCounts || []; const pc = rc[(me + 2) % 4] ?? 27;
    const e1 = rc[(me + 1) % 4] ?? 27; const e3 = rc[(me + 3) % 4] ?? 27;
    if ((m120 & 1) && full.leading && pc === 0 && (e1 > 0 || e3 > 0)
      && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat')
      && (top.move.cards || []).length < hand.length && top.move.combo?.rank != null
      && (!(m120 & 4) || (e1 > 0 && e3 > 0))) {
      const s0 = singleStrength(top.move.combo.rank, lvR);
      if (!(m120 & 8) || s0 >= X('S', 10)) {
        const M = (m120 & 2) ? X('M2', 900) : X('M', 300);
        const cands = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
          && (r.move.cards || []).length < hand.length && r.move.combo?.rank != null
          && singleStrength(r.move.combo.rank, lvR) < s0);
        cands.sort((a, b) => singleStrength(a.move.combo.rank, lvR) - singleStrength(b.move.combo.rank, lvR) || b.score - a.score);
        const p = cands[0];
        if (p) { if (process.env?.GD_R120_LOG) process.stderr.write('R120TRIG\n');
          p.score = top.score + 1; p.tags = (p.tags || []).concat('r120ResumeLeadMin'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
      }
    } }
  // r121（GD_R121，默认 0）：自创正交轴「对家已出完领出换最大点」——领出、对家余牌=0、至少一敌仍在、首选为非炸非走完（非 r95PlanBeat）时，分差≤M 内其他非炸非走完领出中主点 singleStrength 严格更大者 → 改用最大者（同大取分高；接风后强攻抢二游；对偶 r120 换最小点；异于 r118 甩多张、r119 跟敌换最小、r98 收官难压、r100 短敌顶大；避开 r59、r75–r120、对家出完甩多张/换最小点簇；保留 sticky GD_R95=5；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅两敌都在；bit8 仅首选强度≤10。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R121 : undefined; const m121 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R121X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const hand = full.hand || []; const lvR = full.levelRank || '2'; const top = ranked[0];
    const rc = full.remainingSeatCounts || []; const pc = rc[(me + 2) % 4] ?? 27;
    const e1 = rc[(me + 1) % 4] ?? 27; const e3 = rc[(me + 3) % 4] ?? 27;
    if ((m121 & 1) && full.leading && pc === 0 && (e1 > 0 || e3 > 0)
      && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat')
      && (top.move.cards || []).length < hand.length && top.move.combo?.rank != null
      && (!(m121 & 4) || (e1 > 0 && e3 > 0))) {
      const s0 = singleStrength(top.move.combo.rank, lvR);
      if (!(m121 & 8) || s0 <= X('S', 10)) {
        const M = (m121 & 2) ? X('M2', 900) : X('M', 300);
        const cands = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
          && (r.move.cards || []).length < hand.length && r.move.combo?.rank != null
          && singleStrength(r.move.combo.rank, lvR) > s0);
        cands.sort((a, b) => singleStrength(b.move.combo.rank, lvR) - singleStrength(a.move.combo.rank, lvR) || b.score - a.score);
        const p = cands[0];
        if (p) { if (process.env?.GD_R121_LOG) process.stderr.write('R121TRIG\n');
          p.score = top.score + 1; p.tags = (p.tags || []).concat('r121ResumeLeadMax'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
      }
    } }
  // r122（GD_R122，默认 0）：自创正交轴「记牌跟敌换松顶」——跟敌非炸、首选为非炸非走完压牌（非 r95PlanBeat），分差≤M 内其他非炸非走完压牌中，外面（belief.remainingByRank）可压同型点数严格更多者 → 改用最多者（同多取分高；用中牌压、留真顶；对偶 r109 换更少 beaters；异于 r87 最小点、r100 顶大、r95 handplan、r103 过→必回手；避开 r59、r75–r121、对家出完甩多张/换最小最大点簇；保留 sticky GD_R95=5；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅首选 outside beaters≤2。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R122 : undefined; const m122 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R122X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const hand = full.hand || []; const top = ranked[0]; const pv = full.previous; const ls = full.lastPlaySeat;
    const okT = !(m122 & 4) || (pv && (pv.type === TYPES.SINGLE || pv.type === TYPES.PAIR));
    if ((m122 & 1) && !full.leading && pv && !isBombLike(pv) && ls != null && ls % 2 !== me % 2 && okT
      && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat')
      && (top.move.cards || []).length < hand.length && top.move.combo?.rank != null && full.belief?.remainingByRank) {
      const rem = full.belief.remainingByRank; const mine = {};
      for (const c of hand) mine[c.rank] = (mine[c.rank] || 0) + 1;
      const beaters = (mv) => { if (!mv?.combo?.rank) return -1; const n = (mv.cards || []).length; const s0 = singleStrength(mv.combo.rank, lvR); let b = 0;
        for (const [rk, cnt] of Object.entries(rem)) { let s; try { s = singleStrength(rk, lvR); } catch { continue; }
          if (s <= s0) continue; const out = Math.max(0, cnt - (mine[rk] || 0)); if (out >= n) b += 1; }
        return b; };
      const b0 = beaters(top.move);
      if (!(m122 & 8) || b0 <= X('B', 2)) {
        const M = (m122 & 2) ? X('M2', 900) : X('M', 300);
        const cands = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
          && (r.move.cards || []).length < hand.length && r.move.combo?.rank != null && beaters(r.move) > b0);
        cands.sort((a, b) => beaters(b.move) - beaters(a.move) || b.score - a.score);
        const p = cands[0];
        if (p) { if (process.env?.GD_R122_LOG) process.stderr.write('R122TRIG\n');
          p.score = top.score + 1; p.tags = (p.tags || []).concat('r122BeliefLoose'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
      }
    } }
  // r123（GD_R123，默认 0）：自创正交轴「早盘领出甩多张」——领出、（本副首领或我手≥H）、首选为非炸非走完（非 r95PlanBeat）时，分差≤M 内其他非炸非走完领出中张数严格更多者 → 改用最多者（同多取分高；早盘先甩长牌；异于 r118 对家出完甩多、一般领出甩多张惨败、r25/r64 开局顺子；避开 r59、r75–r122、对家出完簇、记牌换控权/松顶惨败邻域；保留 sticky GD_R95=5；不动 r95PlanBeat）。
  // bit1 启用 M=300 H=20；bit2 M2=900；bit4 仅 firstLeadOfDeal；bit8 仅首选张数≤3。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R123 : undefined; const m123 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R123X_' + k] : undefined; return e == null ? d : Number(e); };
    const hand = full.hand || []; const top = ranked[0]; const H = X('H', 20);
    const early = full.firstLeadOfDeal || hand.length >= H;
    if ((m123 & 1) && full.leading && early && (!(m123 & 4) || full.firstLeadOfDeal)
      && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat')
      && (top.move.cards || []).length < hand.length
      && (!(m123 & 8) || (top.move.cards || []).length <= X('N', 3))) {
      const n0 = (top.move.cards || []).length;
      const M = (m123 & 2) ? X('M2', 900) : X('M', 300);
      const cands = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
        && (r.move.cards || []).length < hand.length && (r.move.cards || []).length > n0);
      cands.sort((a, b) => (b.move.cards || []).length - (a.move.cards || []).length || b.score - a.score);
      const p = cands[0];
      if (p) { if (process.env?.GD_R123_LOG) process.stderr.write('R123TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r123EarlyShed'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r124（GD_R124，默认 0）：自创正交轴「开局领出清孤张」——本副首领领出、首选为非炸非走完（非 r95PlanBeat）时，分差≤M 内其他非炸非走完领出中，出后余牌天然孤张数（非逢人配、同点恰 1 张）严格更少者 → 改用最少者（同少取分高；开局清散非省控；异于 r117 一般领出减孤张、r110 跟敌减孤张、r70/r99 省控、r123 早盘甩多；避开 r59、r75–r123、对家出完簇、记牌换控权/松顶、早盘甩多张惨败邻域；保留 sticky GD_R95=5；不动 r95PlanBeat）。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅手=27；bit8 仅首选出后孤张≥2。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R124 : undefined; const m124 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R124X_' + k] : undefined; return e == null ? d : Number(e); };
    const hand = full.hand || []; const top = ranked[0]; const lvR = full.levelRank || '2';
    const iso = (h) => { const u = new Map(); for (const c of h) { if (isWildCard(c, lvR)) continue; u.set(c.rank, (u.get(c.rank) || 0) + 1); } let n = 0; for (const x of u.values()) if (x === 1) n++; return n; };
    if ((m124 & 1) && full.leading && full.firstLeadOfDeal && (!(m124 & 4) || hand.length === 27)
      && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat')
      && (top.move.cards || []).length < hand.length) {
      const i0 = iso(restAfter(hand, top.move));
      if (!(m124 & 8) || i0 >= X('I', 2)) {
        const M = (m124 & 2) ? X('M2', 900) : X('M', 300);
        const cands = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
          && (r.move.cards || []).length < hand.length && iso(restAfter(hand, r.move)) < i0);
        cands.sort((a, b) => iso(restAfter(hand, a.move)) - iso(restAfter(hand, b.move)) || b.score - a.score);
        const p = cands[0];
        if (p) { if (process.env?.GD_R124_LOG) process.stderr.write('R124TRIG\n');
          p.score = top.score + 1; p.tags = (p.tags || []).concat('r124OpenClearIso'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
      }
    } }
  // r125（GD_R125，默认 0）：自创正交轴「中盘领出清孤张」——领出、非本副首领、我手在 [L,H]、首选为非炸非走完（非 r95PlanBeat）时，分差≤M 内其他非炸非走完领出中，出后余牌天然孤张数（非逢人配、同点恰 1 张）严格更少者 → 改用最少者（同少取分高；中盘清散；异于 r124 开局清孤张、r117 一般领出减孤张惨败、r110 跟敌减孤张、r123 早盘甩多；避开 r59、r75–r124、对家出完簇、记牌换控权/松顶、早盘甩多、开局清孤张、敌头游炸；保留 sticky GD_R95=5；不动 r95PlanBeat）。
  // bit1 启用 M=300 L=10 H=18；bit2 M2=900；bit4 仅手∈[12,16]；bit8 仅首选出后孤张≥2。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R125 : undefined; const m125 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R125X_' + k] : undefined; return e == null ? d : Number(e); };
    const hand = full.hand || []; const top = ranked[0]; const lvR = full.levelRank || '2'; const hl = hand.length;
    const iso = (h) => { const u = new Map(); for (const c of h) { if (isWildCard(c, lvR)) continue; u.set(c.rank, (u.get(c.rank) || 0) + 1); } let n = 0; for (const x of u.values()) if (x === 1) n++; return n; };
    const L = (m125 & 4) ? X('L4', 12) : X('L', 10); const H = (m125 & 4) ? X('H4', 16) : X('H', 18);
    if ((m125 & 1) && full.leading && !full.firstLeadOfDeal && hl >= L && hl <= H
      && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat')
      && (top.move.cards || []).length < hl) {
      const i0 = iso(restAfter(hand, top.move));
      if (!(m125 & 8) || i0 >= X('I', 2)) {
        const M = (m125 & 2) ? X('M2', 900) : X('M', 300);
        const cands = ranked.filter((r) => r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
          && (r.move.cards || []).length < hl && iso(restAfter(hand, r.move)) < i0);
        cands.sort((a, b) => iso(restAfter(hand, a.move)) - iso(restAfter(hand, b.move)) || b.score - a.score);
        const p = cands[0];
        if (p) { if (process.env?.GD_R125_LOG) process.stderr.write('R125TRIG\n');
          p.score = top.score + 1; p.tags = (p.tags || []).concat('r125MidClearIso'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
      }
    } }
  // r126（GD_R126，默认 0）：自创正交轴「领出保同花顺潜力」——领出、非本副首领（bit8 含首领）、首选为非炸非走完（非 r95PlanBeat）时，分差≤M 内其他非炸非走完领出中，出后余牌最大同花顺窗口（同花色 5 连窗口内张数，红桃级牌逢人配不计）严格更大者 → 改用最大者（同大取分高；留同花顺炸潜力）。异于 r83 同点换花色、r124/r125 清孤张、r116 减手数、r91 点数、r123 甩多；避开 r59、r75–r125、领出清孤张簇、早盘甩多、记牌换控权、对家出完簇；保留 sticky GD_R95=5；不动 r95PlanBeat。先试「跟敌压牌减手数」trig=0、「中盘领出同型换大点」smoke ≈−1.1~−1.6、「跟敌免费压」trig≈1、「还贡保同花顺潜力」trig≈1，改本轴。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅首选出后窗口 ≥3；bit8 含本副首领。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R126 : undefined; const m126 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R126X_' + k] : undefined; return e == null ? d : Number(e); };
    const hand = full.hand || []; const top = ranked[0]; const lvR = full.levelRank || '2'; const hl = hand.length;
    const NAT = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const sfMax = (h) => { let b = 0; const bs = new Map(); for (const c of h) { if (isWildCard(c, lvR)) continue; if (!bs.has(c.suit)) bs.set(c.suit, new Set()); bs.get(c.suit).add(c.rank); }
      for (const set of bs.values()) for (let st = 0; st <= 9; st++) { let n = 0; for (let k = st; k < st + 5; k++) if (set.has(NAT[k])) n++; if (n > b) b = n; } return b; };
    if ((m126 & 1) && full.leading && ((m126 & 8) || !full.firstLeadOfDeal)
      && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat')
      && (top.move.cards || []).length < hl) {
      const mp = new Map(); const f = (r) => { if (!mp.has(r)) mp.set(r, sfMax(restAfter(hand, r.move))); return mp.get(r); };
      const w0 = f(top);
      if (!(m126 & 4) || w0 >= X('W', 3)) {
        const M = (m126 & 2) ? X('M2', 900) : X('M', 300);
        const cands = ranked.filter((r) => r !== top && r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
          && (r.move.cards || []).length < hl && f(r) > w0);
        cands.sort((a, b) => f(b) - f(a) || b.score - a.score);
        const p = cands[0];
        if (p) { if (process.env?.GD_R126_LOG) process.stderr.write('R126TRIG\n');
          p.score = top.score + 1; p.tags = (p.tags || []).concat('r126KeepSF'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
      }
    } }
  // r127（GD_R127，默认 0）：自创正交轴「压牌省逢人配」——领出/跟敌非炸/跟对家（bit4 仅领出）、首选为非炸非走完（非 r95PlanBeat）且首选动用逢人配（红桃级牌）时，分差≤M 内其他非炸非走完出法中动用逢人配张数严格更少者 → 改用最少者（同少取分高；留百搭）。异于 r95 handplan、r87 最小点、r126 同花顺潜力、r124/r125 清孤张、r116 减手数；避开 r59、r75–r126 及领出清孤张/早盘甩多/记牌换控权/对家出完簇；保留 sticky GD_R95=5；不动 r95PlanBeat。
  // bit1 启用 M=300（领出+跟敌+跟对家）；bit2 M2=900；bit4 仅领出；bit8 首选逢人配≥1 时候选须 0 逢人配。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R127 : undefined; const m127 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R127X_' + k] : undefined; return e == null ? d : Number(e); };
    const hand = full.hand || []; const top = ranked[0]; const lvR = full.levelRank || '2'; const hl = hand.length; const me = full.seat ?? 0;
    const wn = (m) => (m.cards || []).filter((c) => isWildCard(c, lvR)).length;
    const enemyF = !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2;
    const partF = !full.leading && full.previous && full.lastPlaySeat === (me + 2) % 4;
    const ctxOk = (m127 & 4) ? full.leading : (enemyF || full.leading || partF);
    if ((m127 & 1) && ctxOk && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat')
      && (top.move.cards || []).length < hl && wn(top.move) > 0) {
      const w0 = wn(top.move); const M = (m127 & 2) ? X('M2', 900) : X('M', 300);
      const cands = ranked.filter((r) => r !== top && r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
        && (r.move.cards || []).length < hl && ((m127 & 8) ? wn(r.move) === 0 : wn(r.move) < w0));
      cands.sort((a, b) => wn(a.move) - wn(b.move) || b.score - a.score);
      const p = cands[0];
      if (p) { if (process.env?.GD_R127_LOG) process.stderr.write('R127TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r127SaveWild'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r128（GD_R128，默认 0）：自创正交轴「出牌省自然级牌」——领出/跟敌非炸/跟对家（bit4 仅跟敌）、首选为非炸非走完（非 r95PlanBeat）且首选动用自然级牌（级牌点非逢人配）时，分差≤M 内其他非炸非走完出法中动用级牌（含逢人配）张数严格更少者 → 改用最少者（同少取分高；留级牌控）。异于 r127 仅逢人配、r109/r122 记牌换顶、r87 最小点、r95 handplan；避开 r59、r75–r127 及各簇；保留 sticky GD_R95=5；不动 r95PlanBeat。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅跟敌；bit8 候选须 0 级牌。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R128 : undefined; const m128 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R128X_' + k] : undefined; return e == null ? d : Number(e); };
    const hand = full.hand || []; const top = ranked[0]; const lvR = full.levelRank || '2'; const hl = hand.length; const me = full.seat ?? 0;
    const ln = (m) => (m.cards || []).filter((c) => c.rank === lvR).length;
    const nat = (m) => (m.cards || []).filter((c) => c.rank === lvR && !isWildCard(c, lvR)).length;
    const enemyF = !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2;
    const partF = !full.leading && full.previous && full.lastPlaySeat === (me + 2) % 4;
    const ctxOk = (m128 & 4) ? enemyF : (enemyF || full.leading || partF);
    if ((m128 & 1) && ctxOk && top && !isPass(top.move) && !isBombLike(top.move.combo) && !(top.tags || []).includes('r95PlanBeat')
      && (top.move.cards || []).length < hl && nat(top.move) > 0) {
      const w0 = ln(top.move); const M = (m128 & 2) ? X('M2', 900) : X('M', 300);
      const cands = ranked.filter((r) => r !== top && r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
        && (r.move.cards || []).length < hl && ((m128 & 8) ? ln(r.move) === 0 : ln(r.move) < w0));
      cands.sort((a, b) => ln(a.move) - ln(b.move) || b.score - a.score);
      const p = cands[0];
      if (p) { if (process.env?.GD_R128_LOG) process.stderr.write('R128TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r128SaveLevel'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r129（GD_R129，默认 0）：自创正交轴「跟敌弃权改争」——跟敌非炸、首选为不出（pass）时，分差≤M 内存在非炸非走完压牌 → 改压（取分最高；bit8 取最小点）。异于「跟敌能压不炸」(炸/非炸)、r124–r128 换牌簇、省级牌/省逢人配/清孤张/甩多张/同花顺潜力簇；决策点为 pass↔压；避开 r59、r75–r128；保留 sticky GD_R95=5；不动 r95PlanBeat。
  // bit1 启用 M=300；bit2 M2=900；bit4 仅出牌敌人余牌 ≤GD_R129X_E(10)；bit8 候选取最小点。
  { const v = typeof process !== 'undefined' ? process.env?.GD_R129 : undefined; const m129 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R129X_' + k] : undefined; return e == null ? d : Number(e); };
    const hand = full.hand || []; const top = ranked[0]; const hl = hand.length; const me = full.seat ?? 0;
    const enemyF = !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2;
    const eCnt = enemyF ? ((full.remainingSeatCounts || [])[full.lastPlaySeat] ?? 27) : 27;
    if ((m129 & 1) && enemyF && top && isPass(top.move) && (!(m129 & 4) || eCnt <= X('E', 10))) {
      const M = (m129 & 2) ? X('M2', 900) : X('M', 300);
      const cands = ranked.filter((r) => r !== top && r.score > -1e5 && r.score >= top.score - M && !isPass(r.move) && !isBombLike(r.move.combo)
        && (r.move.cards || []).length < hl);
      if (m129 & 8) cands.sort((a, b) => (a.move.cards || []).reduce((s, c) => s + singleStrength(c.rank, full.levelRank || '2'), 0) - (b.move.cards || []).reduce((s, c) => s + singleStrength(c.rank, full.levelRank || '2'), 0) || b.score - a.score);
      const p = cands[0];
      if (p) { if (process.env?.GD_R129_LOG) process.stderr.write('R129TRIG\n');
        p.score = top.score + 1; p.tags = (p.tags || []).concat('r129ContestNotPass'); ranked.sort((x, y) => y.score - x.score); best = p.move; bestTags = p.tags; bestS = p.score; }
    } }
  // r46（GD_R46，默认 0）：r45 邻域。bit1：余牌 ≤3 手也炸回；bit2：敌人出的是炸弹时，有更大炸弹 + 余牌 ≤2 手 → 炸回
  { const v = typeof process !== 'undefined' ? process.env?.GD_R46 : undefined; const m46 = v == null ? 0 : Number(v) || 0;
    const me = full.seat ?? 0; const lvR = full.levelRank || '2';
    const enemy = !full.leading && full.previous && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 && isPass(ranked[0]?.move);
    const K = (m46 & 1) && !isBombLike(full.previous) ? 3 : ((m46 & 2) && enemy && isBombLike(full.previous) ? 2 : 0);
    if (m46 & 3 && enemy && K) {
      const top = ranked[0];
      const bs = ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && isBombLike(r.move.combo) && (r.move.cards || []).length < (full.hand || []).length && minPlays(restAfter(full.hand, r.move), lvR) <= K);
      bs.sort((a, b) => b.score - a.score);
      if (bs.length) { const alt = bs[0]; alt.score = top.score + 1; alt.tags = alt.tags.concat('r46BombToExit'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    } }
  // r47（GD_R47，默认 0）：跟敌人非炸牌、首选过，有非炸压牌且压后余牌 ≤K 手（bit1 K=1，bit2 K=2）→ 压牌夺权（不动炸弹）
  { const v = typeof process !== 'undefined' ? process.env?.GD_R47 : undefined; const m47 = v == null ? 0 : Number(v) || 0;
    const me = full.seat ?? 0; const lvR = full.levelRank || '2';
    if ((m47 & 3) && !full.leading && full.previous && !isBombLike(full.previous) && full.lastPlaySeat != null && full.lastPlaySeat % 2 !== me % 2 && isPass(ranked[0]?.move)) {
      const K = m47 & 2 ? 2 : 1; const top = ranked[0];
      const bs = ranked.filter((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo) && (r.move.cards || []).length < (full.hand || []).length && minPlays(restAfter(full.hand, r.move), lvR) <= K);
      bs.sort((a, b) => b.score - a.score);
      if (bs.length) { const alt = bs[0]; alt.score = top.score + 1; alt.tags = alt.tags.concat('r47BeatToExit'); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; }
    } }
  // r48（GD_R48，默认 0）：领出结构。bit1：领出、首选不是走完，存在非炸领牌使余牌恰为一个炸弹（必走）→ 领它；bit2：领出、对家剩 1 张、两敌都 >PE 张、我非 ≤2 手 → 领最小单张喂对家；bit4：领出、余牌 ≤2 手时先出评分最高的非炸（不先领炸）
  { const v = typeof process !== 'undefined' ? process.env?.GD_R48 : undefined; const m48 = v == null ? 0 : Number(v) || 0;
    const X = (k, d) => { const e = typeof process !== 'undefined' ? process.env?.['GD_R48X_' + k] : undefined; return e == null ? d : Number(e); };
    const me = full.seat ?? 0; const lvR = full.levelRank || '2'; const rc = full.remainingSeatCounts || []; const hand = full.hand || [];
    const set = (alt, tag) => { if (typeof process !== 'undefined' && process.env?.GD_R48_LOG) process.stderr.write('TRIG ' + tag + '\n'); const top = ranked[0]; alt.score = top.score + 1; alt.tags = (alt.tags || []).concat(tag); ranked.sort((a, b) => b.score - a.score); best = alt.move; bestTags = alt.tags; bestS = alt.score; };
    const notFinish = ranked[0] && (ranked[0].move.cards || []).length < hand.length;
    if ((m48 & 1) && full.leading && notFinish) {
      const alt = ranked.find((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo) && (r.move.cards || []).length < hand.length && (() => { const rest = restAfter(hand, r.move); const c = classify(rest, lvR); return c && isBombLike(c); })());
      if (alt && alt !== ranked[0]) set(alt, 'r48LeadToBomb');
    }
    if ((m48 & 2) && full.leading && notFinish && (rc[(me + 2) % 4] ?? 0) === 1 && Math.min(rc[(me + 1) % 4] || 27, rc[(me + 3) % 4] || 27) > X('PE', 2) && minPlays(hand, lvR) > 2 && ranked[0].move.combo?.type !== TYPES.SINGLE) {
      const cs = ranked.filter((r) => r.score > -1e5 && r.move.combo?.type === TYPES.SINGLE);
      cs.sort((a, b) => singleStrength(a.move.combo.rank, lvR) - singleStrength(b.move.combo.rank, lvR));
      if (cs[0]) set(cs[0], 'r48FeedP1');
    }
    if ((m48 & 8) && !full.leading && full.previous && ranked[0] && !isPass(ranked[0].move) && ranked[0].move.combo?.type === TYPES.STRAIGHT_FLUSH && notFinish) {
      const alt = ranked.find((r) => r.score > -1e5 && !isPass(r.move) && isBombLike(r.move.combo) && r.move.combo.type !== TYPES.STRAIGHT_FLUSH && (r.move.cards || []).length <= 5 && !(r.move.cards || []).some((c) => isJokerRank(c.rank)));
      if (alt) set(alt, 'r48SaveSF');
    }
    if ((m48 & 16) && full.leading && notFinish && hand.length > X('HN', 8) && (ranked[0].move.cards || []).some((c) => isControlRank(c.rank, lvR)) && !isBombLike(ranked[0].move.combo)) {
      const top = ranked[0]; const alt = ranked.find((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo) && r.score >= top.score - X('M', 60) && !(r.move.cards || []).some((c) => isControlRank(c.rank, lvR) || isWildCard(c, lvR)));
      if (alt) set(alt, 'r48NoCtrlLead');
    }
    if ((m48 & 4) && full.leading && notFinish && isBombLike(ranked[0].move.combo) && minPlays(hand, lvR) <= 2) {
      const alt = ranked.find((r) => r.score > -1e5 && !isPass(r.move) && !isBombLike(r.move.combo));
      if (alt) set(alt, 'r48BombLast');
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
