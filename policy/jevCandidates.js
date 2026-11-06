/**
 * Jev 候选池：decide ⊕ generateCandidates，保证标金着法进 choice 空间。
 */
import { TYPES } from '../engine/combos.js';
import { compareCombos } from '../engine/compare.js';
import { generateCandidates } from '../search/index.js';
import { isForbidden } from './filters.js';
import { usesWild, minPlays, restAfter, wildFillers } from './shape.js';
import { moveFinish, feedAfter, finishLine } from './lookahead.js';
import { comboKey } from './handplan.js';
import { planForHand } from './jevState.js';
import { bombCost } from './index.js';

const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/** r9：领出时只看还在打的敌家（出完的敌家 0 张不算短，与 decide r9 c2 一致）；都出完 → 99 */
function liveEnemyMin(seat, seatCounts) {
  const v = [(seat + 1) % 4, (seat + 3) % 4].map((e) => (Number.isFinite(seatCounts[e]) ? seatCounts[e] : 99)).filter((x) => x > 0);
  return v.length ? Math.min(...v) : 99;
}

/** r9：计划组件比较用（牌型 + 点数多重集；三带二区分带的对子） */
function planKey(m) {
  return `${m.combo?.type}:${(m.cards || []).map((c) => c.rank).sort().join('')}`;
}

function moveKey(m) {
  if (!m) return 'null';
  if (!m.cards?.length || m.combo?.type === TYPES.PASS) return 'pass';
  const ids = m.cards.map((c) => c.id).sort((a, b) => a - b).join(',');
  return `${m.combo?.type || '?'}:${ids}`;
}

function isPass(m) {
  return !m?.cards?.length || m.combo?.type === TYPES.PASS;
}

function isBomb(m) {
  return m?.combo?.type === 'bomb' || m?.combo?.type === 'straightFlush';
}

function countByRank(hand) {
  const m = new Map();
  for (const c of hand || []) m.set(c.rank, (m.get(c.rank) || 0) + 1);
  return m;
}

function isControlRank(rank, levelRank) {
  return rank === levelRank || rank === 'BJ' || rank === 'RJ' || rank === 'A';
}

/**
 * @param {object} rec decide() 返回值
 * @param {object} opts
 */
export function buildJevCandidates(rec, opts = {}) {
  const {
    hand = [],
    previous = null,
    levelRank = '2',
    leading = false,
    seatCounts = [],
    seat = 0,
    K = 8,
    labelFn = (combo) => combo?.type || '?',
    preferPassForPartner = false,
    lastPlaySeat = null,
    persona = null,
  } = opts;

  const pool = [];
  const seen = new Set();
  const push = (m) => {
    if (!m) return;
    const k = moveKey(m);
    if (seen.has(k)) return;
    seen.add(k);
    pool.push(m);
  };

  push(rec?.move);
  for (const a of rec?.alternatives || []) push(a);
  let gen = [];
  try {
    gen = generateCandidates({ hand, previous, levelRank, leading }) || [];
  } catch {
    gen = [];
  }
  for (const m of gen) push(m);
  if (!leading) push({ cards: [], combo: { type: TYPES.PASS, rank: null, size: 0 } });

  // 与 decide 同一套硬过滤：剔除被否决的着法（decide 首选与过牌始终保留）
  {
    const fctx = { hand, previous, levelRank, leading, seat, remainingSeatCounts: seatCounts, lastPlaySeat, persona };
    const kept = pool.filter((m) => isPass(m) || m === rec?.move || !isForbidden(m, fctx, pool));
    if (kept.length) pool.splice(0, pool.length, ...kept);
  }
  // 敌报单跟牌且有炸：剔除拆炸弹（含逢人配补成的炸）的普通着法
  {
    const enemyMin0 = Math.min(...[(seat + 1) % 4, (seat + 3) % 4].map((e) => (Number.isFinite(seatCounts[e]) ? seatCounts[e] : 99)));
    const bombs = pool.filter((m) => isBomb(m));
    if (!leading && enemyMin0 <= 1 && bombs.length) {
      // 只算天然炸弹（逢人配补成的炸不算）；decide 首选始终保留
      const inBomb = new Set(bombs.filter((b) => !wildFillers(b, levelRank)).flatMap((b) => b.cards.filter((c) => !(c.rank === levelRank && c.suit === 'H')).map((c) => c.id)));
      const keep = pool.filter((m) => isPass(m) || isBomb(m) || m === rec?.move || !m.cards.some((c) => inBomb.has(c.id)) || m.cards.length === hand.length);
      pool.splice(0, pool.length, ...keep);
    }
  }
  // 敌很短领出：有对方接不住的普通牌型时不先出炸弹
  {
    const em = liveEnemyMin(seat, seatCounts);
    if (leading && em <= 2 && pool.some((m) => !isPass(m) && !isBomb(m) && m.cards.length > em)) {
      const keep = pool.filter((m) => !isBomb(m) || m.cards.length === hand.length);
      if (keep.length) pool.splice(0, pool.length, ...keep);
    }
  }
  // 领出时谁短决定出单还是出对：敌报单（搭档不报单）剔除单张；搭档报单（敌不短）只出单张
  {
    const em = Math.min(...[(seat + 1) % 4, (seat + 3) % 4].map((e) => (Number.isFinite(seatCounts[e]) ? seatCounts[e] : 99)));
    const pc = Number.isFinite(seatCounts[(seat + 2) % 4]) ? seatCounts[(seat + 2) % 4] : 99;
    const goOut = (m) => m.cards?.length === hand.length;
    const emL = liveEnemyMin(seat, seatCounts);
    if (leading && emL <= 1 && pc > 1 && pool.some((m) => !isPass(m) && !isBomb(m) && m.combo?.type !== 'single')) {
      const keep = pool.filter((m) => m.combo?.type !== 'single' || goOut(m));
      if (keep.length) pool.splice(0, pool.length, ...keep);
    } else if (leading && pc === 1 && emL >= 2 && pool.some((m) => m.combo?.type === 'single')) {
      const cnt0 = countByRank(hand);
      const small = ['2', '3', '4', '5', '6', '7', '8', '9', '10'];
      const orphan = (m) => m.combo?.type === 'single' && (cnt0.get(m.combo.rank) || 0) === 1 && small.includes(m.combo.rank) && m.combo.rank !== levelRank;
      const bombIds0 = new Set(pool.filter((m) => isBomb(m)).flatMap((m) => m.cards.map((c) => c.id)));
      const nonBombSingles = pool.filter((m) => m.combo?.type === 'single' && !m.cards.some((c) => bombIds0.has(c.id) || (cnt0.get(c.rank) || 0) >= 4));
      const singles = nonBombSingles.length ? nonBombSingles : pool.filter((m) => m.combo?.type === 'single');
      const str = (m) => (m.combo.rank === 'RJ' ? 100 : m.combo.rank === 'BJ' ? 99 : m.combo.rank === levelRank ? 80 : RANK_ORDER.indexOf(m.combo.rank));
      const lowest = singles.reduce((a, b) => (str(b) < str(a) ? b : a));
      const hasOrphan = pool.some(orphan);
      // 喂搭档：有10以下孤单只出孤单；否则出最小的单张
      const keep = pool.filter((m) => (hasOrphan ? orphan(m) : m === lowest) || goOut(m));
      if (keep.length) pool.splice(0, pool.length, ...keep);
    }
    // 敌家牌多（≥4）跟牌：剔除用逢人配的普通跟；只能用级牌/王单张跟时过牌
    if (!leading && em >= 4) {
      const ctrl = (r) => r === levelRank || r === 'BJ' || r === 'RJ';
      let keep = pool.filter((m) => isPass(m) || isBomb(m) || goOut(m) || !usesWild(m, levelRank));
      const ord = keep.filter((m) => !isPass(m) && !isBomb(m) && !goOut(m));
      if (previous?.type === 'single' && ord.length && ord.every((m) => m.combo?.type === 'single' && ctrl(m.combo.rank))) {
        keep = keep.filter((m) => !ord.includes(m));
      }
      if (keep.length) pool.splice(0, pool.length, ...keep);
    }
  }
  // 敌短（≤2）领出且有对方接不住的普通牌型（不拆炸）：只留这些牌型（与 decide shapeFirst 一致）
  {
    const em = liveEnemyMin(seat, seatCounts);
    const pc = Number.isFinite(seatCounts[(seat + 2) % 4]) ? seatCounts[(seat + 2) % 4] : 99;
    if (leading && em <= 2 && pc >= 3) {
      const cnt1 = countByRank(hand);
      const unf = (m) => !isPass(m) && !isBomb(m) && !m.cards.some((c) => (cnt1.get(c.rank) || 0) >= 4) && m.cards.length > em;
      if (pool.some(unf)) {
        const keep = pool.filter((m) => unf(m) || m.cards.length === hand.length);
        pool.splice(0, pool.length, ...keep);
      }
    }
  }
  // 多个炸弹可压时只留代价最小的（r9：按 decide bombCost —— 少用逢人配 > 张数少 > 点数小；原先按炸弹大小取最小，会留下逢人配补成的小炸、去掉天然大炸）；
  // decide 首选是炸弹时也保留（标注代价）
  {
    const bombs = pool.filter((m) => isBomb(m) && m.cards.length < hand.length);
    if (bombs.length > 1) {
      const cheapest = bombs.reduce((a, b) => (bombCost(b, levelRank) < bombCost(a, levelRank) || (bombCost(b, levelRank) === bombCost(a, levelRank) && compareCombos(b.combo, a.combo, levelRank) < 0) ? b : a));
      const keep = pool.filter((m) => !isBomb(m) || m === cheapest || m === rec?.move || m.cards.length === hand.length);
      pool.splice(0, pool.length, ...keep);
    }
  }
  // 敌家牌多领出：不拆顺子/连对/钢板出单张
  {
    const em = liveEnemyMin(seat, seatCounts);
    const pc = Number.isFinite(seatCounts[(seat + 2) % 4]) ? seatCounts[(seat + 2) % 4] : 99;
    if (leading && em >= 4 && pc > 1) {
      const shapeIds = new Set(pool.filter((m) => ['straight', 'pairSeq', 'tripleSeq'].includes(m.combo?.type)).flatMap((m) => m.cards.map((c) => c.id)));
      if (shapeIds.size) {
        const keep = pool.filter((m) => m.combo?.type !== 'single' || !m.cards.some((c) => shapeIds.has(c.id)));
        if (keep.length) pool.splice(0, pool.length, ...keep);
      }
    }
  }
  // 能走则走：有一手出完的着法时只保留它们
  {
    const outs = pool.filter((m) => m.cards?.length === hand.length && hand.length > 0);
    if (outs.length) pool.splice(0, pool.length, ...outs);
  }
  {
    const enemyMin1 = Math.min(...[(seat + 1) % 4, (seat + 3) % 4].map((e) => (Number.isFinite(seatCounts[e]) ? seatCounts[e] : 99)));
    // 一手可走完且敌家不短：剔除拆散它的普通跟牌
    if (!leading && enemyMin1 >= 3 && minPlays(hand, levelRank) === 1) {
      const keep = pool.filter((m) => isPass(m) || isBomb(m) || m.cards.length === hand.length);
      if (keep.length) pool.splice(0, pool.length, ...keep);
    }
    // 敌家牌多跟单：有非王单张可压时剔除王
    if (!leading && previous?.type === 'single' && enemyMin1 >= 3) {
      const isJ = (m) => m?.combo?.type === 'single' && (m.combo.rank === 'BJ' || m.combo.rank === 'RJ');
      if (pool.some((m) => m?.combo?.type === 'single' && !isJ(m))) {
        const keep = pool.filter((m) => !isJ(m));
        pool.splice(0, pool.length, ...keep);
      }
    }
  }
  // 敌报单跟单：非炸单张只保留最大者（小单被支配）
  {
    const enemyMin = Math.min(...[(seat + 1) % 4, (seat + 3) % 4].map((e) => (Number.isFinite(seatCounts[e]) ? seatCounts[e] : 99)));
    if (!leading && previous?.type === 'single' && enemyMin <= 1) {
      const singles = pool.filter((m) => m?.combo?.type === 'single');
      if (singles.length > 1) {
        const str = (m) => (m.combo.rank === 'RJ' ? 100 : m.combo.rank === 'BJ' ? 99 : m.combo.rank === levelRank ? 80 : RANK_ORDER.indexOf(m.combo.rank));
        const top = singles.reduce((a, b) => (str(b) > str(a) ? b : a));
        const keep = pool.filter((m) => m?.combo?.type !== 'single' || m === top);
        pool.splice(0, pool.length, ...keep);
      }
    }
  }
  // decide 规则镜像（lookahead 轮，dev-real 调参）
  {
    const em = leading ? liveEnemyMin(seat, seatCounts) : Math.min(...[(seat + 1) % 4, (seat + 3) % 4].map((e) => (Number.isFinite(seatCounts[e]) ? seatCounts[e] : 99)));
    const pc = Number.isFinite(seatCounts[(seat + 2) % 4]) ? seatCounts[(seat + 2) % 4] : 99;
    const cnt2 = countByRank(hand);
    const goOut = (m) => m.cards?.length === hand.length;
    const isRec = (m) => rec?.move && moveKey(m) === moveKey(rec.move);
    const ctrlR = (r) => r === levelRank || r === 'BJ' || r === 'RJ';
    const apply = (keep) => { if (keep.length && keep.length < pool.length) pool.splice(0, pool.length, ...keep); };
    if (!leading && previous) {
      // 敌家牌多：只能用级牌对/王对跟对 → 剔除（decide keepControlPair）
      if (em >= 4 && previous.type === 'pair') {
        apply(pool.filter((m) => isRec(m) || goOut(m) || !(m.combo?.type === 'pair' && ctrlR(m.combo.rank))));
      }
      // 敌家 ≥3：剔除用逢人配凑的三张以上普通跟牌（decide keepWild）
      if (em >= 3) apply(pool.filter((m) => isRec(m) || goOut(m) || isPass(m) || isBomb(m) || m.cards.length < 3 || !usesWild(m, levelRank)));
      // 跟单：有孤单可跟时剔除拆对/三张的单张（敌报单除外）
      if (em >= 2 && previous.type === 'single') {
        const orphanF = (m) => m.combo?.type === 'single' && (cnt2.get(m.combo.rank) || 0) === 1;
        if (pool.some(orphanF)) apply(pool.filter((m) => isRec(m) || goOut(m) || m.combo?.type !== 'single' || orphanF(m)));
      }
    } else if (leading) {
      // 敌报双、decide 拆对出单（全是对子）：Jev 候选去掉对子（与 decide vsTwoSingle 一致）
      if (em === 2 && pc > 2 && rec?.move?.combo?.type === 'single' && (rec?.tags || []).includes('vsTwoSingle')) {
        apply(pool.filter((m) => isRec(m) || goOut(m) || m.combo?.type !== 'pair'));
      }
      // 敌家不短领出：不拆天然对子出单张
      if (em >= 3 && pc > 2) apply(pool.filter((m) => isRec(m) || goOut(m) || m.combo?.type !== 'single' || (cnt2.get(m.combo.rank) || 0) !== 2));
      // 搭档剩 2 张且无对可送：只出最小单张
      if (pc === 2 && em >= 3 && !pool.some((m) => m.combo?.type === 'pair' && !usesWild(m, levelRank))) {
        const singles = pool.filter((m) => m.combo?.type === 'single');
        if (singles.length > 1) {
          const str = (m) => (m.combo.rank === 'RJ' ? 100 : m.combo.rank === 'BJ' ? 99 : m.combo.rank === levelRank ? 80 : RANK_ORDER.indexOf(m.combo.rank));
          const lo = singles.reduce((a, b) => (str(b) < str(a) ? b : a));
          apply(pool.filter((m) => m === lo || isRec(m) || goOut(m) || m.combo?.type !== 'single'));
        }
      }
    }
  }
  // lookahead 镜像：decide 找到强制走完线 / 夺权喂短搭档 / 送牌时，Jev 候选与之对齐
  {
    const tg = rec?.tags || [];
    const recM = rec?.move;
    if (recM && !isPass(recM) && tg.some((t) => /^(forceFinish|winThen|controlFeed|feedPartner)/.test(t))) {
      if (!pool.some((m) => moveKey(m) === moveKey(recM))) pool.unshift(recM);
      let keep = pool.filter((m) => !isPass(m));
      const laCtx0 = { hand, levelRank, leading, previous, seat, remainingSeatCounts: seatCounts, lastPlaySeat };
      if (tg.some((t) => /^forceFinish:(sure|bombBack)/.test(t))) {
        const c0 = new Map();
        keep = keep.filter((m) => moveKey(m) === moveKey(recM) || m.cards.length === hand.length || (() => { try { return ['sure', 'bombBack'].includes(moveFinish(m, laCtx0, c0)); } catch { return false; } })());
      } else if (!leading && isBomb(recM) && tg.some((t) => /^forceFinish:likely/.test(t)) &&
        Math.min(...[(seat + 1) % 4, (seat + 3) % 4].map((e) => seatCounts[e] ?? 99)) <= 1) {
        // 敌报单：decide 选择“炸后走完”，去掉会被报单敌人压上走掉的普通牌
        keep = keep.filter((m) => isBomb(m) || m.cards.length === hand.length);
      } else if (tg.some((t) => /^feedPartner/.test(t))) {
        keep = keep.filter((m) => moveKey(m) === moveKey(recM) || m.cards.length === hand.length);
      }
      if (keep.length) pool.splice(0, pool.length, ...keep);
    }
  }
  // 逢人配镜像：decide 判为浪费逢人配 / 关键拦截应用天然牌 / 领出炸弹过早 的候选（非推荐）剔除
  const recTagsByKey = new Map((rec?.scored || []).map((r) => [moveKey(r.move), r.tags || []]));
  const recScoreByKey = new Map((rec?.scored || []).map((r) => [moveKey(r.move), r.score]));
  const recIsPass = !!rec?.move && isPass(rec.move);
  const passScore = (rec?.scored || []).find((r) => isPass(r.move))?.score ?? null;
  {
    const WASTE = /^(wildWaste|blockNatural|leadBombLate|keepWild|leadNoWild)$/;
    const bad = (m) => !isPass(m) && !(rec?.move && moveKey(m) === moveKey(rec.move)) && m.cards?.length !== hand.length &&
      (recTagsByKey.get(moveKey(m)) || []).some((t) => WASTE.test(t)) && usesWild(m, levelRank);
    const keep = pool.filter((m) => !bad(m));
    if (keep.length && keep.length < pool.length) pool.splice(0, pool.length, ...keep);
  }
  // 只给 Jev decide 认为可行的着法：分数不低于推荐着法 GAP 分以内（推荐、走完着法始终保留，至少留 2 个）
  {
    const GAP = Number((typeof process !== 'undefined' && process.env && process.env.JEV_TOPK_GAP) || 60);
    const rs = rec?.move ? recScoreByKey.get(moveKey(rec.move)) : null;
    if (Number.isFinite(GAP) && GAP > 0 && rs != null && recScoreByKey.size >= 2) {
      const ok = (m) => (rec?.move && moveKey(m) === moveKey(rec.move)) || m.cards?.length === hand.length ||
        (recScoreByKey.has(moveKey(m)) && recScoreByKey.get(moveKey(m)) >= rs - GAP);
      let keep = pool.filter(ok);
      if (keep.length < 2) {
        const recFin = (recTagsByKey.get(moveKey(rec.move)) || []).some((t) => /^forceFinish/.test(t));
        // r9：补足 2 个时也只补 decide 分差 ≤2×GAP 的（明显很差的着法不给 Jev；decide 有走完线时不拿非走完着法凑数；只剩 1 个就不调用 Jev）
        const extra = pool.filter((m) => !keep.includes(m) && recScoreByKey.has(moveKey(m)) && recScoreByKey.get(moveKey(m)) >= rs - 2 * GAP && !(recFin && !(recTagsByKey.get(moveKey(m)) || []).some((t) => /^forceFinish/.test(t))))
          .sort((a, b) => recScoreByKey.get(moveKey(b)) - recScoreByKey.get(moveKey(a)));
        keep = keep.concat(extra.slice(0, 2 - keep.length));
      }
      if (rec?.move && !keep.some((m) => moveKey(m) === moveKey(rec.move))) keep.unshift(rec.move);
      if (keep.length) pool.splice(0, pool.length, ...keep);
    }
  }
  // 手牌计划镜像：decide 按计划领出（先出最弱/长组件、两手先出稳的）时，确保推荐在池中
  const PLAN_TAGS = /^(planWeakFirst|planUnitFirst|planStrongFirst|planWeakFirstTwo|planUnfollowable|vsTwoBigSingle)$/;
  if (leading && rec?.move && !isPass(rec.move) && (rec?.tags || []).some((t) => PLAN_TAGS.test(t))) {
    if (!pool.some((m) => moveKey(m) === moveKey(rec.move))) pool.unshift(rec.move);
  }
  const plan = leading ? planForHand(hand, levelRank) : null;
  const recPlanKey = leading && rec?.move && (rec?.tags || []).some((t) => PLAN_TAGS.test(t)) ? comboKey(rec.move) : null;
  const byRank = countByRank(hand);
  const handHasBomb = [...byRank.values()].some((n) => n >= 4);
  const handLen = hand.length;
  const previousIsFullhouse = !!(previous && (previous.type === 'fullhouse' || previous.type === 'tripleSeq'));
  const poolHasFullhouseFollow = pool.some((m) => m?.combo?.type === 'fullhouse');
  const enemySeats = [(seat + 1) % 4, (seat + 3) % 4];
  const minEnemy = Math.min(
    ...enemySeats.map((e) => (Number.isFinite(seatCounts[e]) ? seatCounts[e] : 99)),
  );

  // 强制保留：炸弹、过牌（r9：不再强制保留/前置孤单——r7 前的“领出先甩孤儿小单”）
  const must = [];
  for (const m of pool) {
    if (isPass(m) || isBomb(m)) must.push(m);
  }

  const score = (m) => {
    if (!m) return -1e9;
if (isPass(m)) {
      if (preferPassForPartner) return 200;
      if (leading) return -100;
      if (minEnemy <= 1) return -50; // 敌将走完：过牌分低
      return 30;
    }
    const n = m.cards?.length || 0;
    let s = 0;
    if (n === handLen) s += 120;
    if (preferPassForPartner && !isPass(m)) s -= 80;
    if (leading && handHasBomb && isBomb(m) && minEnemy > 2) s -= 60;
    if (!leading && isBomb(m) && minEnemy <= 1) s += 150; // 敌末张必须炸
    if (!leading && m.combo?.type === 'fullhouse' && !preferPassForPartner) s += 40; // 同型三带二可跟
    if (!leading && isPass(m) && poolHasFullhouseFollow) s -= 40;
    if (!leading && isBomb(m) && minEnemy > 1 && previousIsFullhouse) s -= 70; // 勿浪费炸三带二
    if (leading && minEnemy <= 2 && m.combo?.type === 'triple' && handLen <= 5) s += 40;
    if (leading && minEnemy <= 2 && m.combo?.type === 'triple' && handLen > 5) s -= 30; // 残局长手勿拆三
    if (leading && isControlRank(m.combo?.rank, levelRank) && m.combo?.type === 'single') s -= 25;
    if (!leading && !isBomb(m) && !preferPassForPartner) s += 10;
    if (!leading && m.combo?.type === 'single') {
      const r = m.combo.rank;
      if (r === 'RJ' || r === 'BJ') s += 40; // followHighSingle
      else if (r === 'A' || r === 'K') s += 25;
      else if (r === 'Q' || r === 'J') s += 10;
    }
    return s;
  };

  // r9：取前 K 个按启发式（炸弹/过牌必留），展示顺序 = decide 评分从高到低（没评分的排后）
  const rest = pool.filter((m) => !must.includes(m));
  must.sort((a, b) => score(b) - score(a));
  rest.sort((a, b) => (recScoreByKey.get(moveKey(b)) ?? -1e9) - (recScoreByKey.get(moveKey(a)) ?? -1e9) || score(b) - score(a));
  const picked = [...must.slice(0, K), ...rest].slice(0, K);
  const ordered = picked.sort((a, b) => (recScoreByKey.get(moveKey(b)) ?? -1e9) - (recScoreByKey.get(moveKey(a)) ?? -1e9) || score(b) - score(a));
  // de-dupe keep order
  const final = [];
  const seen2 = new Set();
  for (const m of ordered) {
    const k = moveKey(m);
    if (seen2.has(k)) continue;
    seen2.add(k);
    final.push(m);
  }
  const top = final.slice(0, Math.min(K, final.length));
  const laCtx = { hand, levelRank, leading, previous, seat, remainingSeatCounts: seatCounts, lastPlaySeat };
  const laCache = new Map();
  // r9：decide 找到了强制走完线（任一候选）→ 不再标“按计划先出”（走完线优先）
  let lastTwo = false;
  try { lastTwo = leading && minPlays(hand, levelRank) === 2; } catch { lastTwo = false; }
  // r9：[按计划先出] 只给一手：计划内、带 decide 计划标签、decide 分最高的那个
  const planFirstKey = (() => {
    if (!plan) return null;
    const c = top.filter((m) => !isPass(m) && !isBomb(m) && plan.comps.some((x) => planKey(x.move) === planKey(m)) && ((recTagsByKey.get(moveKey(m)) || []).some((t) => PLAN_TAGS.test(t)) || (recPlanKey && comboKey(m) === recPlanKey)));
    c.sort((a, b) => (recScoreByKey.get(moveKey(b)) ?? -1e9) - (recScoreByKey.get(moveKey(a)) ?? -1e9));
    const r = rec?.move && !isPass(rec.move) && !isBomb(rec.move) && top.find((m) => moveKey(m) === moveKey(rec.move) && plan.comps.some((x) => planKey(x.move) === planKey(m))); // r9d：decide 首选在计划里就标它
    return r ? moveKey(r) : c.length ? moveKey(c[0]) : null;
  })();
  const anyFinish = top.some((m) => (recTagsByKey.get(moveKey(m)) || []).some((t) => /^forceFinish:/.test(t)));
  const partnerPrev = !leading && lastPlaySeat != null && lastPlaySeat === (seat + 2) % 4;

  return top.map((move, i) => {
    const pass = isPass(move);
    const bomb = isBomb(move);
    let tag = '';
    if (pass) tag = ' [过牌]';
    else if (bomb) tag = ' [炸弹]';
    else if (!leading) tag = ' [普通跟]';
    else tag = ' [领出]';
    if (move.cards?.length === handLen) tag += ' [走完]';
    if (!pass && leading) {
      const pc = seatCounts[(seat + 2) % 4];
      if (pc === 1 && move.combo?.type === 'single') tag += ' [喂搭档：搭档剩1张]';
      if (pc === 2 && move.combo?.type === 'pair') tag += ' [喂搭档：搭档剩2张]';
      const emL = liveEnemyMin(seat, seatCounts);
      if (emL <= 1 && move.combo?.type === 'single' && pc !== 1) tag += ' [危险：敌人剩1张可接单]';
      if (emL <= 1 && move.combo?.type !== 'single' && !bomb) tag += ' [顶敌人：敌人剩1张接不住]';
      // r9：早中盘领出 A/级牌/王 的单对：控制牌宜留后
      if (!bomb && handLen >= 10 && emL >= 4 && pc !== 1 && pc !== 2 && (move.combo?.type === 'single' || move.combo?.type === 'pair') && isControlRank(move.combo.rank, levelRank) && move.cards.length < handLen) tag += ' [早出控制牌：A/级牌/王宜留后]';
    }
    if (!pass && move.combo?.rank === levelRank && levelRank !== 'A') tag += ` [级牌${levelRank}，大于A]`;
    if (!pass && usesWild(move, levelRank)) {
      const nf = wildFillers(move, levelRank);
      const wr = move.cards.filter((c) => c.rank === levelRank && c.suit === 'H').length;
      if (bomb) tag += nf ? ` [逢人配补成炸弹：用掉${nf}张红桃${levelRank}]` : ' [级牌炸弹（含红桃级牌本身）]';
      else if (!nf && pool.some((b) => isBomb(b) && wildFillers(b, levelRank) > 0 && b.cards.some((c) => move.cards.some((x) => x.id === c.id && c.rank === levelRank && c.suit === 'H')))) tag += ` [打出红桃${levelRank}会拆掉逢人配补成的炸弹]`;
      else if (!nf) tag += ` [红桃${levelRank}按本点（级牌）使用，不当替身]`;
      else tag += ` [用逢人配当替身：用掉${nf}张红桃${levelRank}${nf >= 2 ? '，代价很大' : ''}]`;
      void wr;
    }
    {
      const mt = recTagsByKey.get(moveKey(move)) || [];
      if (mt.includes('wildWaste')) tag += ' [浪费逢人配：有不用逢人配的同型牌]';
      if (mt.includes('blockNatural')) tag += ' [有天然牌能拦，不必用逢人配炸]';
      if (mt.some((t) => t === 'blockSure' || t === 'blockLikely')) tag += ' [能稳拿这一墩，拦住要走的敌人]';
      // r9：炸弹代价（decide bombCost）：有更省的炸弹时标出
      if (bomb && leading && mt.some((t) => t === 'leadBombLate' || t === 'holdBombLead' || t === 'keepBombForControl') && move.cards.length < handLen) tag += ' [领出炸弹过早：敌家不短，炸弹宜留后]';
      if (bomb && mt.includes('bombWildPad')) tag += ' [用逢人配：有更省的炸弹，代价大]';
      else if (bomb && mt.includes('bombOversize')) tag += ' [炸弹过大：有更小的炸弹够用]';
      // r9：出牌的敌人 ≤3 张且只有炸弹能压
      if (bomb && !leading && !partnerPrev && lastPlaySeat != null) {
        const pn = seatCounts[lastPlaySeat];
        if (pn > 0 && pn <= 3 && !top.some((m) => !isPass(m) && !isBomb(m))) tag += ` [只有炸弹能拦：出牌的敌人剩${pn}张]`;
      }
    }
    {
      const mt = recTagsByKey.get(moveKey(move)) || [];
      if (bomb && !leading && mt.includes('mustBomb') && rec?.move && moveKey(rec.move) === moveKey(move)) tag += ' [敌将走完、普通牌拦不稳：该炸断]';
      else if (bomb && !leading && rec?.move && moveKey(rec.move) === moveKey(move) && mt.some((t) => /^forceFinish:/.test(t))) {
        let rp = 9;
        try { rp = minPlays(restAfter(hand, move), levelRank); } catch { rp = 9; }
        if (rp <= 1) tag += ' [炸后剩一手：直接走完]';
      }
      if (!pass && mt.includes('breakNoOrphan')) tag += ' [拆对子/三张出单]';
    }
    // 最后两手的顺序：先出能稳拿牌权的一手
    if (leading && !pass && !bomb && rec?.move && !isPass(rec.move) && handLen > move.cards.length) {
      let mp = 9;
      try { mp = minPlays(hand, levelRank); } catch { mp = 9; }
      const rs = recScoreByKey.get(moveKey(rec.move));
      const ms = recScoreByKey.get(moveKey(move));
      if (mp === 2 && rs != null && ms != null) {
        if (moveKey(move) === moveKey(rec.move) && (rec.scored || []).some((r) => !isPass(r.move) && moveKey(r.move) !== moveKey(move) && r.score < rs - 20 && r.move.cards.length + move.cards.length === handLen)) tag += ' [最后两手：先出这手拿牌权，再出最后一手]';
        else if (moveKey(move) !== moveKey(rec.move) && ms < rs - 20 && rec.move.cards.length + move.cards.length === handLen) tag += ' [最后两手：这手应后出，先出会被压]';
      }
    }
    // decide 认为过牌更好（敌家都不短）：镜像为“保留牌型”
    if (!leading && recIsPass && minEnemy >= 3 && !partnerPrev && passScore != null) {
      if (pass) tag += ' [保留牌型：此时跟牌得不偿失]';
      else if (!bomb && recScoreByKey.has(moveKey(move)) && recScoreByKey.get(moveKey(move)) < passScore - 10) tag += ' [跟牌会拆牌/浪费大牌]';
    }
    // 跟单：decide 选了够用的较小单张时，更大的单张标“不是最小够用”（敌家都不短）
    if (!leading && !pass && !bomb && !partnerPrev && minEnemy >= 3 && rec?.move && !isPass(rec.move) && rec.move.combo?.type === 'single' &&
        move.combo?.type === 'single' && moveKey(move) !== moveKey(rec.move)) {
      const rs = recScoreByKey.get(moveKey(rec.move));
      const ms = recScoreByKey.get(moveKey(move));
      const ord = (r) => (r === levelRank ? 13.5 : ['2','3','4','5','6','7','8','9','10','J','Q','K','A','BJ','RJ'].indexOf(r));
      if (rs != null && ms != null && ms < rs - 3 && ord(move.combo.rank) > ord(rec.move.combo.rank)) tag += ' [不是够用的最小牌：浪费大牌]';
    }
    if (!pass && !bomb && !leading && move.cards.length < handLen) {
      const before = minPlays(hand, levelRank);
      if (before <= 2 && minPlays(restAfter(hand, move), levelRank) >= before && !(recTagsByKey.get(moveKey(move)) || []).some((t) => /^block/.test(t))) tag += ' [拆散可走完的牌]';
    }
    // 手牌计划镜像（r9：用 decide 的计划与标签：>14 张 decomposeCounts；planWeakFirst 等 → 按计划先出，offPlan → 拆计划）
    if (plan && leading && !pass && !bomb && move.cards.length < handLen) {
      const k = comboKey(move);
      const mt = recTagsByKey.get(moveKey(move)) || [];
      const pcN = seatCounts[(seat + 2) % 4];
      const emL = liveEnemyMin(seat, seatCounts);
      const inPlan = plan.comps.some((c) => planKey(c.move) === planKey(move));
      if (emL >= 3 && handLen > 2 && !anyFinish && !lastTwo && moveKey(move) === planFirstKey) tag += ' [按计划先出：拆牌计划里应先出这手]';
      else if (mt.includes('offPlan')) tag += ' [拆计划：会多出手数]';
      else if (inPlan) tag += ' [按计划]';
      else if (emL >= 3 && pcN !== 1 && pcN !== 2) {
        const rp = planForHand(hand.filter((c) => !move.cards.some((x) => x.id === c.id)), levelRank);
        if (rp && rp.cost + 1 - plan.cost > 0.3) tag += ' [拆计划：会多出手数]';
      }
    }
    // lookahead 镜像：强制走完线 / 夺权后喂短搭档
    if (!pass && move.cards.length < handLen) {
      let fin = null;
      // r9：优先用 decide 的前瞻结果（decide 的 ctx 含已出牌，算得更准）
      // （decide 打过分的着法只信 decide 的标签：decide 对“敌家都长时领炸”等情形故意不算走完线）
      const ffTag = (recTagsByKey.get(moveKey(move)) || []).find((t) => /^forceFinish:/.test(t));
      if (ffTag) fin = ffTag.split(':')[1];
      else if (!recTagsByKey.has(moveKey(move))) { try { fin = moveFinish(move, laCtx, laCache); } catch { fin = null; } }
      if (fin === 'likely' && leading && seatCounts[(seat + 2) % 4] === 1) fin = null;
      if (partnerPrev && fin !== 'sure') fin = null; // 压搭档的牌：只有确定走完才提示
      if (bomb && fin === 'likely' && minEnemy >= 4) fin = null; // 敌家牌多：炸弹“大概率走完”不提示（与 decide saveBomb 一致）
      if (fin === 'sure') tag += ' [可走完：此手后能强制走完]';
      else if (fin === 'bombBack') tag += ' [可走完：被压就炸回走完，炸弹留后手]';
      else if (fin === 'likely') tag += ' [大概率可走完：只怕炸弹]';
      else if (!leading && !bomb && !partnerPrev) {
        const r0 = restAfter(hand, move);
        let fl = null;
        if (minPlays(hand, levelRank) > 1 && r0.length <= 12) { try { fl = finishLine(r0, laCtx, r0.length <= 8 ? 2 : 1, laCache); } catch { fl = null; } }
        const fd = feedAfter(move, laCtx);
        if (fl && !/拆散可走完的牌/.test(tag)) tag += ' [拿到牌权即可走完]';
        else if (fd) tag += fd === 'pair' ? ' [夺权后可送对给搭档]' : ' [夺权后可送单给搭档]';
      }
    }
    return {
      key: `m${i}`,
      label: `${labelFn(move.combo, move.cards)}${tag}`,
      move,
    };
  });
}

export { moveKey, isPass as isPassMove, isBomb as isBombMove };
