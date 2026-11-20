/**
 * 还贡选牌（decide 风格启发式）。进贡牌是强制的（engine/tributeStd.tributeCard）。
 * chooseReturn(hand, { lv, to, seat, received }, variant)
 *  - 'min'：最小的可还牌（基线）
 *  - 'plan'（默认）：还掉后 handplan.decomposeCounts 代价最小的牌（不拆对/顺/炸、优先孤单小牌），平局还小的；
 *    级牌（任何花色）规则上不可还（engine/tributeStd.isReturnEligible，2026-10-21 修）；下面的 nonLevel 过滤只在兜底（无 ≤10 非级牌）时起作用
 * 进贡还贡 A/B（selfplay/PROGRESS.md）：plan vs min +0.106 [0.050, 0.163]；已删除的 planfeed（plan + 按点数的“喂牌”修正，
 * 还给对家时反向）vs plan −0.009 [−0.060, 0.041]、vs min +0.114 → 无额外收益，删除。
 * 级牌排除（修 bug）vs 不排除 −0.001 [−0.022, 0.020]（中性，已删旧行为）；修后 plan vs min 新种子 +0.097 [0.037, 0.156]。
 */
import { decomposeCounts } from './handplan.js';
import { returnOptions } from '../engine/tributeStd.js';
import { singleStrength } from '../engine/ranks.js';
import { ruleTrig } from './nodeCompat.js';

const r33Mode = () => { const v = typeof process !== 'undefined' ? process.env?.GD_R33 : undefined; return v == null ? 0 : Number(v) || 0; };
const r81Mode = () => { const v = typeof process !== 'undefined' ? process.env?.GD_R81 : undefined; return v == null ? 0 : Number(v) || 0; };
const r136Mode = () => { const v = typeof process !== 'undefined' ? process.env?.GD_R136 : undefined; return v == null ? 0 : Number(v) || 0; };
const r61Mode = () => { const v = typeof process !== 'undefined' ? process.env?.GD_R61 : undefined; return v == null ? 0 : Number(v) || 0; };
export const RETURN_VARIANTS = ['min', 'plan', 'r33_1', 'r33_2', 'r33_3', 'r61_1', 'r81_1', 'r81_2', 'r81_4', 'r81_5', 'r136_1', 'r136_3', 'r136_9', 'r136_11', 'r142_1', 'r142_3', 'r142_5', 'r142_7', 'r142_9', 'r142_11', 'r142_13'];
export const DEFAULT_RETURN = 'plan';

export function chooseReturn(hand, info = {}, variant = DEFAULT_RETURN) {
  const lv = info.lv || '2';
  const { cards } = returnOptions(hand, lv);
  if (!cards.length) return null;
  const minOf = (arr) => arr.reduce((b, c) => (!b || singleStrength(c.rank, lv) < singleStrength(b.rank, lv) ? c : b), null);
  if (variant === 'min' || cards.length === 1) return minOf(cards);
  // 每个点数取一张代表（decomposeCounts 不看花色）
  const byRank = new Map();
  const nonLevel = cards.filter((c) => c.rank !== lv);
  const pool = nonLevel.length ? nonLevel : cards;
  for (const c of pool) if (!byRank.has(c.rank)) byRank.set(c.rank, c);
  const cache = new Map();
  // r61 bit1 / #ret=r61_1：手里有可还的真孤张（该点仅 1 张）时，强制只在孤张里按 plan 代价选（audit 还贡拆对 ~38%）
  if ((r61Mode() & 1) || variant === 'r61_1') {
    const cnt = new Map();
    for (const c of hand) cnt.set(c.rank, (cnt.get(c.rank) || 0) + 1);
    const orphans = [...byRank.values()].filter((c) => (cnt.get(c.rank) || 0) === 1);
    if (orphans.length) {
      let best = null;
      for (const c of orphans) {
        const rest = hand.filter((x) => x.id !== c.id);
        const s = decomposeCounts(rest, lv, cache).cost;
        const str = singleStrength(c.rank, lv);
        if (!best || s < best.s - 1e-9 || (Math.abs(s - best.s) <= 1e-9 && str < best.str)) best = { c, s, str };
      }
      return best.c;
    }
  }
  const r33 = String(variant).startsWith('r33_') ? Number(String(variant).slice(4)) || 0 : r33Mode();
  if (r33) {
    // r33 GD_R33：bit1=代价在最优+T 内还最小点；bit2=同上但避免还 10/9（顺子顶端，敌方易用）→ 优先 ≤8
    const T = Number((typeof process !== 'undefined' && process.env?.GD_R33X_T) ?? 0.5);
    const sc = [...byRank.values()].map((c) => ({ c, s: decomposeCounts(hand.filter((x) => x.id !== c.id), lv, cache).cost, str: singleStrength(c.rank, lv), nat: '23456789TJQKA'.indexOf(c.rank === '10' ? 'T' : c.rank) + 2 }));
    const m = Math.min(...sc.map((x) => x.s));
    let ok = sc.filter((x) => x.s <= m + T + 1e-9);
    if (r33 & 2) { const lo = ok.filter((x) => x.nat <= 8); if (lo.length) ok = lo; }
    ok.sort((a, b) => a.str - b.str);
    return ok[0].c;
  }
  // r81（GD_R81，默认 0）：还贡花色/同花顺潜力轴（异于 r33 点数 / r61 孤张 / r42/r63 进贡花色）。
  // bit1 同点多张时还同花顺潜力最小的花色；bit2 同点还该花色余张最少的；bit4 plan 代价平手时按同花顺潜力（低者先还）再按点数。
  const m81 = String(variant).startsWith('r81_') ? Number(String(variant).slice(4)) || 0 : r81Mode();
  const pickSuit = (c) => {
    if (!(m81 & 3)) return c;
    const alts = pool.filter((x) => x.rank === c.rank);
    const f = (m81 & 1) ? (x) => r42SfPotential(hand, x) : (x) => r63SuitDensity(hand, x);
    let b = c, bv = f(c); for (const x of alts) { const v = f(x); if (v < bv) { b = x; bv = v; } }
    return b;
  };
  let best = null;
  for (const c0 of byRank.values()) {
    const c = pickSuit(c0);
    const rest = hand.filter((x) => x.id !== c.id);
    const s = decomposeCounts(rest, lv, cache).cost;
    const str = singleStrength(c.rank, lv);
    const sf = (m81 & 4) ? r42SfPotential(hand, c) : 0;
    if (!best || s < best.s - 1e-9 || (Math.abs(s - best.s) <= 1e-9 && (sf < best.sf || (sf === best.sf && str < best.str)))) best = { c, s, str, sf };
  }
  // r136（GD_R136，默认 0）：还贡少拆结构——plan 首选拆对/三（该点 2–3 张）时，若有可还天然孤张（该点仅 1 张、非级牌）且代价≤首选+T → 改还该孤张（代价低者先、再点小）。异于 r61（r61 无条件强制孤张）。bit1 T=0.5；bit2 T=1.5；bit4 仅还给敌方以外也生效（默认全部）；bit8 仅首选拆对（不含三）。A 有炸领出保结构 smoke 惨负、D 跟敌留炸 trig≈0 弃。
  { const m136 = String(variant).startsWith('r136_') ? Number(String(variant).slice(5)) || 0 : r136Mode();
    if (m136 & 1) { const cnt = new Map(); for (const c of hand) cnt.set(c.rank, (cnt.get(c.rank) || 0) + 1);
      const n0 = cnt.get(best.c.rank) || 0;
      if (n0 === 2 || (n0 === 3 && !(m136 & 8))) { const T = (m136 & 2) ? 1.5 : 0.5; let alt = null;
        for (const c of byRank.values()) { if ((cnt.get(c.rank) || 0) !== 1 || c.rank === lv) continue;
          const s = decomposeCounts(hand.filter((x) => x.id !== c.id), lv, cache).cost; const str = singleStrength(c.rank, lv);
          if (s <= best.s + T + 1e-9 && (!alt || s < alt.s - 1e-9 || (Math.abs(s - alt.s) <= 1e-9 && str < alt.str))) alt = { c, s, str }; }
        if (alt) { ruleTrig('GD_R136_LOG', 'R136TRIG\n'); return alt.c; } } } }
  // r142（#ret=r142_N，默认 0）：还贡最小点优先孤张（宽于 r136）——有可还天然孤张（该点 1 张、非级牌）且代价≤plan 最优+T → 还最小点孤张。bit1 主开关 T=1；bit2 T=3；bit4 plan 首选已是孤张时也改最小点孤张；bit8 仅还给敌方。
  { const m142 = String(variant).startsWith('r142_') ? Number(String(variant).slice(5)) || 0 : 0;
    const toEnemy = info.to == null || info.seat == null || (info.to % 2) !== (info.seat % 2);
    if ((m142 & 1) && (!(m142 & 8) || toEnemy)) { const cnt = new Map(); for (const c of hand) cnt.set(c.rank, (cnt.get(c.rank) || 0) + 1);
      const bestOrphan = (cnt.get(best.c.rank) || 0) === 1;
      if (!bestOrphan || (m142 & 4)) { const T = (m142 & 2) ? 3 : 1; let alt = null;
        for (const c of byRank.values()) { if ((cnt.get(c.rank) || 0) !== 1 || c.rank === lv) continue;
          const s = decomposeCounts(hand.filter((x) => x.id !== c.id), lv, cache).cost; const str = singleStrength(c.rank, lv);
          if (s <= best.s + T + 1e-9 && (!alt || str < alt.str)) alt = { c, s, str }; }
        if (alt && alt.c.rank !== best.c.rank) { ruleTrig('GD_R142_LOG', 'R142TRIG\n'); return alt.c; } } } }
  return best.c;
}

// r42（GD_R42 / arena '#trib=1'，默认 0）：进贡同点多张时，选同花顺潜力最小的花色（窗口 5 内同花色张数最少），平手保持引擎默认。
const R42_NAT = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export function r42SfPotential(hand, card) {
  const pos = []; R42_NAT.forEach((r, i) => { if (r === card.rank) pos.push(i); });
  if (!pos.length) return 0;
  const have = new Set(hand.filter((c) => c.suit === card.suit && c.id !== card.id).map((c) => c.rank));
  let best = 0;
  for (const p of pos) for (let s = Math.max(0, p - 4); s <= Math.min(9, p); s++) {
    let n = 0; for (let k = s; k < s + 5; k++) if (k !== p && have.has(R42_NAT[k])) n++;
    best = Math.max(best, n);
  }
  return best;
}
const r63Mode = () => { const v = typeof process !== 'undefined' ? process.env?.GD_R63 : undefined; return v == null ? 0 : Number(v) || 0; };
/** 进贡同点花色：该花色手中其余张数（越少越优先捐，保留密花色同花顺潜力）。 */
export function r63SuitDensity(hand, card) {
  return hand.filter((c) => c.suit === card.suit && c.id !== card.id).length;
}
export function r42TributeCard(hand, card, lv, mode = 0) {
  if (!card) return card;
  const m63 = r63Mode();
  const useSparse = mode === 2 || mode === 63 || (m63 & 16);
  const useR42 = mode === 1 || (!useSparse && mode);
  if (!useSparse && !useR42) return card;
  const alts = hand.filter((c) => c.rank === card.rank && !(c.rank === lv && c.suit === 'H'));
  if (useSparse) {
    let best = card, bd = r63SuitDensity(hand, card);
    for (const c of alts) { const d = r63SuitDensity(hand, c); if (d < bd) { best = c; bd = d; } }
    return best; // tag conceptually r63SparseSuit
  }
  let best = card, bp = r42SfPotential(hand, card);
  for (const c of alts) { const p = r42SfPotential(hand, c); if (p < bp) { best = c; bp = p; } }
  return best;
}
