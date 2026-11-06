/**
 * 为 Jev Choice 构造紧凑、可序列化的局面 state。
 * 规则引擎与 decide 硬过滤不变；Jev 只在候选中择着。
 */
import { TYPES } from '../../../engine/combos.js';
import { detectStructures, resolvePartnerCombo } from './filters.js';
import { phaseOf } from '../../../meta/index.js';
import { minPlays, restAfter } from './shape.js';
import { decompose, decomposeCounts, planString, comboKey as comboKeyOf } from './handplan.js';

/** r9：与 decide 相同的拆牌计划（≤14 张 decompose，>14 张 decomposeCounts）。 */
export function planForHand(hand, lv) {
  try { return hand.length > 14 ? decomposeCounts(hand, lv, new Map()) : decompose(hand, lv, new Map()); } catch { return null; }
}

/** 本地短标签（避免依赖 policy/index，防循环引用）。 */
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

const SEAT_NAMES = ['东', '南', '西', '北'];
const ORDINARY_TYPES = new Set([
  'single',
  'pair',
  'triple',
  'fullhouse',
  'straight',
  'pairSeq',
  'tripleSeq',
]);

/**
 * 手牌紧凑摘要：按点数计数（省 token）。
 * @param {object[]|undefined} hand
 * @returns {string}
 */
export function handSummaryRanks(hand) {
  if (!hand?.length) return '';
  const cnt = new Map();
  for (const c of hand) {
    const r = c.rank;
    cnt.set(r, (cnt.get(r) || 0) + 1);
  }
  return [...cnt.entries()].map(([r, n]) => (n > 1 ? `${r}×${n}` : r)).join(' ');
}

/**
 * 出牌/combo 短摘要。
 * @param {object|null|undefined} combo
 * @param {object[]|null|undefined} cards
 * @returns {string|null}
 */
export function summarizeCombo(combo, cards) {
  if (!combo || combo.type === TYPES.PASS) return '过牌';
  const label = labelCombo(combo);
  if (cards?.length) {
    const ranks = cards.map((c) => c.rank);
    return `${label}[${ranks.join('')}]`;
  }
  return label;
}

/**
 * 阶段：early|mid|late|endgame（lastCards → endgame）。
 * @param {number} handCount
 * @returns {'early'|'mid'|'late'|'endgame'}
 */
export function phaseForJev(handCount) {
  const p = phaseOf(handCount);
  return p === 'lastCards' ? 'endgame' : p;
}

/**
 * 构造 Jev state。
 * @param {object} opts
 * @returns {object}
 */
export function buildJevState({
  round,
  seat,
  hand,
  levelRank,
  leading,
  previous,
  persona,
  belief,
  candidates,
  seatCounts,
  recentTricks: recentIn,
  partnerLastPlay: partnerLastIn,
  controlSeat: controlIn,
  lastPlayer: lastPlayerIn,
  toBeatIsPartner: toBeatIsPartnerIn,
  preferPassForPartner: preferPassIn,
} = {}) {
  const s = Number.isFinite(seat) ? Number(seat) : 0;
  const myHand = hand || round?.hands?.[s] || [];
  const handCount = myHand.length;
  const lvl = levelRank || round?.match?.levelRank || '2';
  const isLeading =
    leading != null
      ? !!leading
      : !round?.lastCombo || round.lastCombo.type === TYPES.PASS;
  const prev = previous !== undefined ? previous : isLeading ? null : round?.lastCombo || null;
  const counts =
    seatCounts ||
    (round?.hands ? round.hands.map((h) => h.length) : [handCount, 0, 0, 0]);
  const partnerSeat = (s + 2) % 4;
  const enemySeats = [(s + 1) % 4, (s + 3) % 4];

  let partnerLastPlay = partnerLastIn;
  if (partnerLastPlay === undefined && round?.tricks) {
    partnerLastPlay = null;
    for (let i = round.tricks.length - 1; i >= 0; i--) {
      if (round.tricks[i].seat === partnerSeat) {
        const t = round.tricks[i];
        partnerLastPlay = {
          type: t.combo?.type,
          rank: t.combo?.rank ?? null,
          summary: summarizeCombo(t.combo, t.cards),
        };
        break;
      }
    }
  } else if (partnerLastPlay && partnerLastPlay.type && !partnerLastPlay.summary) {
    partnerLastPlay = {
      type: partnerLastPlay.type,
      rank: partnerLastPlay.rank ?? null,
      summary: summarizeCombo(partnerLastPlay, partnerLastPlay.cards),
    };
  }

  let recentTricks = recentIn;
  if (!recentTricks && round?.tricks) {
    recentTricks = round.tricks.slice(-3).map((t) => ({
      seat: t.seat,
      seatName: SEAT_NAMES[t.seat],
      summary: summarizeCombo(t.combo, t.cards),
    }));
  }

  const controlSeat =
    controlIn !== undefined
      ? controlIn
      : round?.lastPlayer != null
        ? round.lastPlayer
        : round?.leadSeat ?? null;

  const struct = detectStructures(myHand, lvl);
  const partnerComboHint = resolvePartnerCombo({
    seat: s,
    previous: prev,
    partnerCombo: partnerLastPlay?.type
      ? { type: partnerLastPlay.type, rank: partnerLastPlay.rank }
      : null,
  });

  const state = {
    levelRank: lvl,
    seat: s,
    seatName: SEAT_NAMES[s],
    handCount,
    handSummary: handSummaryRanks(myHand),
    handStructure: {
      pairRanks: struct.pairRanks,
      tripRanks: struct.tripRanks,
      hasAirplane: struct.hasAirplane,
      hasPairSeq: struct.hasPairSeq,
    },
    leading: isLeading,
    toBeat: isLeading || !prev ? null : summarizeCombo(prev, prev?.cards),
    previous: isLeading || !prev ? null : { type: prev.type, rank: prev.rank ?? null },
    seatCounts: counts.slice(0, 4),
    partnerSeat,
    partnerName: SEAT_NAMES[partnerSeat],
    partnerCount: counts[partnerSeat] ?? 0,
    partnerLastPlay: partnerLastPlay || null,
    partnerOrdinary: !!(partnerComboHint && ORDINARY_TYPES.has(partnerComboHint.type)),
    enemyCounts: {
      [enemySeats[0]]: counts[enemySeats[0]] ?? 0,
      [enemySeats[1]]: counts[enemySeats[1]] ?? 0,
    },
    controlHint:
      controlSeat == null
        ? null
        : {
            seat: controlSeat,
            seatName: SEAT_NAMES[controlSeat],
            isMe: controlSeat === s,
            isPartner: controlSeat === partnerSeat,
          },
    phase: phaseForJev(handCount),
    recentTricks: recentTricks || [],
  };

  if (persona) {
    state.persona = {
      name: persona.name,
      style: persona.style || persona.brief,
      brief: persona.brief || persona.style,
    };
  }

  if (belief?.keyCards) {
    state.beliefKeyCards = {
      twosLeft: belief.keyCards.twosLeft,
      levelLeft: belief.keyCards.levelLeft,
      redJokerLeft: belief.keyCards.redJokerLeft,
    };
  }

  if (candidates?.length) {
    state.candidates = candidates.map((c, i) => ({
      id: c.key || `m${i}`,
      label: c.label || c.key || `m${i}`,
    }));
  }

  const lastPlayer =
    lastPlayerIn !== undefined
      ? lastPlayerIn
      : controlSeat;
  const toBeatIsPartner =
    toBeatIsPartnerIn != null
      ? !!toBeatIsPartnerIn
      : !!(lastPlayer != null && lastPlayer === partnerSeat && !isLeading);
  const enemyVals = enemySeats.map((e) => counts[e] ?? 99);
  const minEnemyCount = Math.min(...enemyVals);
  // r9：领出提示只看还在打的敌家（已出完的敌家不算“报单”，与 decide r9 c2 一致）
  const liveVals = enemyVals.filter((x) => x > 0);
  const minEnemyLead = liveVals.length ? Math.min(...liveVals) : 99;
  let hasNonBombFollow = false;
  let hasBombCand = false;
  const rankCountsEarly = new Map();
  for (const c of myHand) rankCountsEarly.set(c.rank, (rankCountsEarly.get(c.rank) || 0) + 1);
  const handHasBomb = [...rankCountsEarly.values()].some((n) => n >= 4);
  if (handHasBomb) hasBombCand = true;
  const hasJoker = myHand.some((c) => c.rank === 'BJ' || c.rank === 'RJ');

  let hasPassCand = false;
  let hasGoOutCand = false;
  let poolHasTriple = false;
  if (candidates?.length) {
    for (const c of candidates) {
      const mv = c.move;
      const t = mv?.combo?.type;
      const isPass = !mv?.cards?.length || t === TYPES.PASS || t === 'pass';
      if (isPass) hasPassCand = true;
      else if (t === 'bomb' || t === 'straightFlush') hasBombCand = true;
      else if (t === 'triple') poolHasTriple = true;
      else if (!isLeading) hasNonBombFollow = true;
      if (mv?.cards?.length && mv.cards.length === handCount) hasGoOutCand = true;
    }
  }
  // 仅当“炸搭档 vs 过牌”时偏向过牌；有普通跟则优先跟（忌炸不等于忌跟）。
  const preferPassForPartner =
    preferPassIn != null
      ? !!preferPassIn
      : !!(
          toBeatIsPartner &&
          state.partnerOrdinary &&
          hasPassCand &&
          hasBombCand &&
          !hasNonBombFollow &&
          !hasGoOutCand
        );
  const policyHints = [];
  {
    const nm = (x) => (x === 99 ? '?' : x);
    const nextE = (s + 1) % 4, prevE = (s + 3) % 4;
    state.whoIsShort = `搭档(座位${partnerSeat})剩${nm(counts[partnerSeat] ?? 99)}张；下家敌人(座位${nextE})剩${nm(counts[nextE] ?? 99)}张；上家敌人(座位${prevE})剩${nm(counts[prevE] ?? 99)}张`;
    policyHints.push(`牌数：${state.whoIsShort}`);
    state.playsToFinish = minPlays(myHand, lvl);
    policyHints.push(`我的手牌最少还需 ${state.playsToFinish >= 3 ? '3 手以上' : state.playsToFinish + ' 手'} 出完`);
    policyHints.push('候选上标 [可走完]/[大概率可走完]/[拿到牌权即可走完] 的，是前瞻算出的强制走完线，优先考虑；标 [夺权后可送单/对给搭档] 的，用够大的最小牌夺权再喂短搭档');
  }
  if (preferPassForPartner) {
    policyHints.push('护搭档：必须过牌，不要用对子压搭档');
  } else if (!isLeading && hasNonBombFollow && !candidates?.some((c) => /保留牌型/.test(c.label || c.text || ''))) {
    policyHints.push('能非炸则跟，勿无故过牌');
  }
  if (toBeatIsPartner && hasBombCand) policyHints.push('忌炸搭档');
  if (minEnemyCount <= 1 && !isLeading && candidates?.some((c) => ['bomb', 'straightFlush'].includes(c.move?.combo?.type)) && !candidates?.some((c) => c.move?.cards?.length && !['bomb', 'straightFlush'].includes(c.move?.combo?.type))) policyHints.push('敌将走完，优先炸弹打断');
  else if (!preferPassForPartner && !isLeading && minEnemyCount <= 2 && prev?.type !== 'fullhouse') policyHints.push('敌短优先压制，可用王');
  if (!preferPassForPartner && !isLeading && minEnemyCount <= 2 && hasJoker) policyHints.push('手中有王且敌短：优先用王盖，不要出 A/K 顶替');
  if (prev?.type === 'fullhouse' && minEnemyCount > 1 && !hasNonBombFollow) policyHints.push('三带二只能靠炸时：过牌，勿浪费炸弹');
  else if (prev?.type === 'fullhouse' && hasNonBombFollow && !preferPassForPartner) policyHints.push('有三带二可跟：跟牌，勿炸');
  if (hasGoOutCand) policyHints.push('能走则走');
  if (hasBombCand && minEnemyCount > 2) policyHints.push('无必要不炸中单');

  state.lastPlayer = lastPlayer ?? null;
  state.toBeatIsPartner = toBeatIsPartner;
  state.preferPassForPartner = preferPassForPartner;
  state.minEnemyCount = minEnemyCount;
  state.minEnemyLead = minEnemyLead;
  state.handHasBomb = handHasBomb;
  state.leading = isLeading;
  state.previousType = prev?.type || null;
  const level = lvl;
  state.holdLevelHint = !!(
    isLeading &&
    myHand.some((c) => c.rank === level || c.rank === 'BJ' || c.rank === 'RJ') &&
    myHand.some((c) => c.rank !== level && c.rank !== 'BJ' && c.rank !== 'RJ' && c.rank !== 'A')
  );
  if (minEnemyLead <= 1) state.holdLevelHint = false;
  const partnerCount0 = counts[partnerSeat] ?? 99;
  if (isLeading && myHand.length === 2 && myHand[0].rank !== myHand[1].rank) state.holdLevelHint = false; // 只剩两张单：先出大的
  const earlyCtrlHint = isLeading && handCount >= 10 && minEnemyLead >= 4 && !(partnerCount0 === 1 || partnerCount0 === 2);
  if (state.holdLevelHint && !earlyCtrlHint) policyHints.push('留级牌/王，先出杂点');
  if (isLeading && minEnemyLead <= 2 && poolHasTriple) policyHints.push('敌短可出三条控场');
  // —— 对比对（pairs.jsonl）补充要点 ——
  const partnerCount = counts[partnerSeat] ?? 99;
  const candMoves = (candidates || []).map((c) => c.move).filter((m) => m?.cards?.length);
  const isBombT = (t) => t === 'bomb' || t === 'straightFlush';
  const poolNonSingle = candMoves.some((m) => !isBombT(m.combo?.type) && m.combo?.type !== 'single');
  const allPairsHand = [...rankCountsEarly.values()].every((n) => n >= 2);
  const isCtrl = (r) => r === level || r === 'BJ' || r === 'RJ';
  const twoSingles = myHand.length === 2 && !candMoves.some((m) => m.cards.length === 2);
  if (isLeading) {
    if (partnerCount === 1 && minEnemyLead >= 2) policyHints.push('对家只剩1张：送牌，优先出10以下最小的孤单；没有合适孤单时才拆牌出最小单');
    else if (twoSingles) {
      const order = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
      const st = (r) => (r === 'RJ' ? 100 : r === 'BJ' ? 99 : r === lvl ? 80 : order.indexOf(r));
      const [x, y] = myHand.map((c) => c.rank);
      const big = st(x) >= st(y) ? x : y;
      policyHints.push(`只剩两张单牌：先出大的那张拿牌权，再出小的走完。本局级牌是${lvl}（级牌大于A），所以这两张中更大的是 ${big}，先出 ${big}`);
    }
    else if (partnerCount === 2 && minEnemyLead >= 3) policyHints.push('对家只剩2张：出最小的对子送对家（不要拆炸弹）');
    else if (minEnemyLead <= 1 && poolNonSingle) policyHints.push('敌家报单：出对子或组合牌，绝不出单张');
    else if (minEnemyLead <= 1) policyHints.push('敌家报单且只能出单：从最大的单张出');
    else if (minEnemyLead === 2 && allPairsHand) policyHints.push('敌家报双且手中全是对：拆对出单张，不出对子');
    else if (minEnemyLead === 2 && myHand.length <= 7) {
      const hasShape = candMoves.some((m) => !isBombT(m.combo?.type) && m.cards.length >= 3);
      const anyPair = candMoves.some((m) => !isBombT(m.combo?.type) && m.cards.length >= 2 && !m.cards.some((c) => (rankCountsEarly.get(c.rank) || 0) >= 4));
      const orderS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
      const orph = [...rankCountsEarly.entries()].filter(([r, n]) => n === 1 && !isCtrl(r)).map(([r]) => r).sort((a, b) => orderS.indexOf(b) - orderS.indexOf(a));
      if (!anyPair && orph.length && !(partnerCount === 1 || partnerCount === 2)) policyHints.push(`敌家报双且手里只剩散单：从大到小出非级牌的单张，本手先出 ${orph[0]}`);
      else policyHints.push(hasShape ? '敌家报双：出三带二/三张/顺子/连对/钢板等对方接不住的组合，不出单张和对子' : '敌家报双：出最小的孤单（不拆对），不要出对子');
    }
    else if (minEnemyLead === 3 && !(partnerCount === 1 || partnerCount === 2) && (() => {
      let p3 = null;
      try { p3 = decompose(myHand, lvl, new Map()); } catch { p3 = null; }
      const u = p3 ? p3.comps.filter((c) => c.role !== 'bomb' && c.role !== 'control' && c.move.cards.length >= 5 && ['straight', 'pairSeq', 'tripleSeq'].includes(c.move.combo?.type)) : [];
      if (u.length) policyHints.push(`敌家剩3张：先完整打出长组件 ${planString({ comps: [u[0]] })}（敌家跟不上），不要拆成单张/对子`);
      return false;
    })()) { /* hint pushed above */ }
    else if (minEnemyLead >= 4) {
      // r9：按 decide 的拆牌计划领出（r7 起 decide 不再“先出最小孤单”）：长组件（顺子/连对/钢板）先出，否则出计划里最弱的组件；控制牌/炸弹留后
      const plan0 = planForHand(myHand, lvl);
      const weak0 = plan0 ? plan0.comps.filter((c) => c.role !== 'bomb' && c.role !== 'control') : [];
      const long0 = weak0.filter((c) => ['straight', 'pairSeq', 'tripleSeq'].includes(c.move.combo?.type) && c.move.cards.length >= 5);
      // r9d：decide 首选（候选第一位）在计划里就先出它；否则长组件，再否则最弱组件
      const top0 = candMoves[0] && !isBombT(candMoves[0].combo?.type) ? weak0.find((c) => comboKeyOf(c.move) === comboKeyOf(candMoves[0])) : null;
      const first0 = top0 || long0[0] || weak0[0];
      const finishCand = candidates?.some((c) => /可走完/.test(c.label || ''));
      if (finishCand) policyHints.push('有候选标了 [可走完]/[大概率可走完]：走完线优先于拆牌计划');
      else if (plan0 && first0 && !(partnerCount === 1 || partnerCount === 2)) policyHints.push(`敌家牌多：按手牌计划（${planString(plan0)}）领出，本手先出 ${planString({ comps: [first0] })}${top0 ? '' : long0.length ? '（长组件先出）' : '（计划里最弱的一手）'}；不要拆对子/三张/顺子等组合，A/级牌/王/炸弹留后`);
      else policyHints.push('敌家牌多：按手牌计划领出，不要拆组合，不要先出控制牌');
    }
  } else if (!toBeatIsPartner) {
    {
      const bombC = candMoves.filter((m) => isBombT(m.combo?.type));
      // 普通牌里不算“只靠红桃级牌单出、会拆掉逢人配炸”的那手
      const wildBombIds = new Set(bombC.flatMap((b) => (b.cards || []).filter((c) => c.rank === lvl && c.suit === 'H').map((c) => c.id)));
      const ordC = candMoves.filter((m) => !isBombT(m.combo?.type) && !(m.cards || []).some((c) => wildBombIds.has(c.id)));
      if (minEnemyCount <= 1 && bombC.length && !ordC.length) policyHints.push('敌家报单：必须用炸弹（含逢人配补成的炸弹）打断，不要拆炸弹出单');
      else if (minEnemyCount <= 1 && ordC.length) policyHints.push('敌家报单：有普通牌能压住就用普通牌压，保留炸弹');
      if (bombC.length > 1) policyHints.push('多个炸弹可用时：用刚好够大的最小炸弹（天王炸最后用）');
    }
    if (minEnemyCount <= 2) policyHints.push('敌家短：能拦就拦，用最大的同型牌顶住（可拆连对）');
    else {
      policyHints.push('敌家牌多：用刚好够大的最小牌跟，保留大牌；有孤单时勿拆对');
      if (minEnemyCount >= 4) policyHints.push('敌家都还有很多牌：勿炸普通牌；勿用逢人配（红桃级牌）跟牌');
      const mp = minPlays(myHand, lvl);
      const follows = candMoves.filter((m) => !isBombT(m.combo?.type) && m.cards.length < myHand.length);
      if (mp <= 2 && follows.length && follows.every((m) => minPlays(restAfter(myHand, m), lvl) >= mp)) policyHints.push('我的手牌一两手就能走完：不要拆牌去跟，过牌等领出');
      const ordinaryFollows = candMoves.filter((m) => !isBombT(m.combo?.type));
      if (minEnemyCount >= 4 && ordinaryFollows.length && ordinaryFollows.every((m) => m.combo?.type === 'single' && isCtrl(m.combo.rank))) {
        policyHints.push('只能用级牌/王跟单且敌家牌多：过牌，留级牌');
        hasNonBombFollow = false;
      }
    }
  }
  if (isLeading) {
    let plan = planForHand(myHand, lvl);
    if (plan && plan.plays >= 2) {
      // 候选里标了“计划先出”的那手排到计划最前（与 decide 的出牌顺序一致）
      const firstC = candidates?.find((c) => /计划先出/.test(c.label || ''));
      if (firstC?.move) {
        const fk = comboKeyOf(firstC.move);
        const i = plan.comps.findIndex((c) => c.key === fk);
        if (i > 0) plan = { ...plan, comps: [plan.comps[i], ...plan.comps.filter((_, j) => j !== i)] };
      }
      state.handPlan = planString(plan);
      state.handPlanPlays = plan.plays;
    }
  }
  // r9：出牌的敌人 ≤3 张、候选里只有炸弹能压 → 明确提示炸
  state.bombOnlyStop = null;
  if (!isLeading && !toBeatIsPartner && lastPlayer != null && lastPlayer !== partnerSeat) {
    const pn = counts[lastPlayer] ?? 99;
    const bombs = candMoves.filter((m) => isBombT(m.combo?.type));
    const ords = candMoves.filter((m) => !isBombT(m.combo?.type));
    if (pn > 0 && pn <= 3 && bombs.length && !ords.length) {
      state.bombOnlyStop = pn;
      policyHints.push(`出牌的敌人只剩${pn}张，候选里只有炸弹能压：用最小够用的炸弹炸，过牌他很可能走完或控场`);
    }
  }
  // r9：早中盘领出少出 A/级牌/王（控制牌留后）
  if (earlyCtrlHint) {
    policyHints.push(`手牌还多、敌家不短：不要领出 A/级牌${lvl}/王 的单张或对子，它们是控制牌`);
  }
  // 逢人配（红桃级牌）说明：数量、按本点用/当替身、用与不用的拆分对比
  {
    const wilds = myHand.filter((c) => c.rank === lvl && c.suit === 'H');
    if (wilds.length) {
      let pn = null, pw = null;
      try { pn = decompose(myHand, lvl, new Map()); pw = decompose(myHand, lvl, new Map(), { freeWild: true }); } catch { pn = pw = null; }
      const natLv = myHand.filter((c) => c.rank === lvl && c.suit !== 'H').length;
      const cntN = new Map();
      for (const c of myHand) if (!(c.rank === lvl && c.suit === 'H')) cntN.set(c.rank, (cntN.get(c.rank) || 0) + 1);
      const bombTargets = [...cntN.entries()].filter(([r, n]) => n >= 3 && n + wilds.length >= 4 && r !== 'BJ' && r !== 'RJ').map(([r]) => r);
      let h = `手里有${wilds.length}张逢人配（红桃${lvl}，可当任意非王牌）`;
      if (natLv) h += `，另有${natLv}张普通${lvl}（与红桃${lvl}凑成级牌对/三张时按本点用，不算浪费）`;
      if (bombTargets.length) h += `；最好的用途：补成 ${bombTargets.join('/')} 炸弹`;
      if (pn && pw) {
        state.planNoWild = planString(pn);
        state.planWithWild = planString(pw);
        h += pw.plays < pn.plays ? `；不用逢人配需 ${pn.plays} 手（${state.planNoWild}），用逢人配凑牌型可省到 ${pw.plays} 手（${state.planWithWild}）` : `；用不用逢人配手数相同（${pn.plays} 手），逢人配留着补炸/关键拦截`;
      }
      if (minEnemyCount >= 3) h += '。普通跟牌有天然牌能压时不要用逢人配，不要用两张逢人配凑普通牌型';
      policyHints.push(h);
    }
  }
  state.partnerCount = partnerCount;
  state.hasNonBombFollow = hasNonBombFollow;
  state.hasBombCand = hasBombCand;
  state.hasPassCand = hasPassCand;
  state.hasGoOutCand = hasGoOutCand;
  // decide 推荐的炸弹是走完线：去掉与之冲突的“别炸/别拆/跟普通牌”提示
  const bombFinishRec = candidates?.some((c) => /炸后剩一手：直接走完/.test(c.label || ''));
  const finalHints = bombFinishRec
    ? policyHints.filter((h) => !/无必要不炸中单|勿炸普通牌|能非炸则跟|不要拆牌去跟/.test(h)).concat('炸弹后只剩一手：用炸弹拿牌权再走完')
    : policyHints;
  state.policyHints = finalHints;

  return state;
}

export { SEAT_NAMES };
