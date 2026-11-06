/**
 * r19 修正 F：残局穷举（GD_R19F）。
 * 所有在打座位都 ≤3 张时：未知牌 = 两副牌 − 已出 − 我手，恰好就是其他三家手牌之和。
 * 枚举（或抽样）这些牌在其他座位上的分配，每个世界做完全信息极小极大（我方最大化、敌方最小化），
 * 终局分 = 本方升级分（双上 3 / 一三 2 / 一四 1，对方同理取负），含出完顺序与接风规则（与 play/core.js 一致）。
 */
import { makeDeck } from '../engine/cards.js';
import { legalMoves } from '../engine/legal.js';
import { TYPES } from '../engine/combos.js';

const keyRS = (c) => c.rank + c.suit;
function teamPts(order, team) {
  const t = order[0] % 2;
  const p = order[1] % 2 === t ? 3 : order[2] % 2 === t ? 2 : 1;
  return t === team ? p : -p;
}
function rngOf(a) { let b = a >>> 0; return () => { b = (b + 0x6d2b79f5) >>> 0; let t = b; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const nextActive = (fin, s) => { for (let i = 1; i <= 4; i++) if (!fin.includes((s + i) % 4)) return (s + i) % 4; return s; };

/** 是否适用：GD_R19F 开、≥1 家未知、所有在打座位 ≤maxEach 张。 */
export function endgameApplies(ctx, maxEach = 3) {
  const cnt = ctx.remainingSeatCounts;
  if (!cnt || cnt.length !== 4) return false;
  const me = ctx.seat ?? 0;
  if ((ctx.hand || []).length < 2) return false;
  if (cnt.some((c) => c > maxEach)) return false;
  const fin = [0, 1, 2, 3].filter((s) => cnt[s] === 0);
  if (fin.length >= 2 && !ctx.finishedOrder) return false;
  if (fin.includes(me)) return false;
  return true;
}

/**
 * @returns {null | { values: Map<string, number>, best: object, worlds: number }}
 *   values：根着法 key → 平均本方升级分
 */
export function solveEndgame(ctx, moves, { maxWorlds = 120, nodeBudget = 40000, timeMs = 60, minWorlds = 6 } = {}) {
  const me = ctx.seat ?? 0;
  const lv = ctx.levelRank || '2';
  const cnt = ctx.remainingSeatCounts.slice();
  const finished = ctx.finishedOrder ? ctx.finishedOrder.slice() : [0, 1, 2, 3].filter((s) => cnt[s] === 0);
  // 未知牌池
  const pool = new Map();
  for (const c of makeDeck()) pool.set(keyRS(c), (pool.get(keyRS(c)) || 0) + 1);
  for (const c of [...(ctx.playedCards || []), ...(ctx.hand || [])]) {
    const k = keyRS(c); const v = pool.get(k) || 0;
    if (v <= 0) return null; pool.set(k, v - 1);
  }
  const unknown = [];
  let uid = 900000;
  for (const [k, v] of pool) for (let i = 0; i < v; i++) { const rank = k.startsWith('RJ') ? 'RJ' : k.startsWith('BJ') ? 'BJ' : k.slice(0, -1); unknown.push({ rank, suit: k.slice(rank.length), id: uid++ }); }
  const others = [0, 1, 2, 3].filter((s) => s !== me && cnt[s] > 0);
  if (unknown.length !== others.reduce((a, s) => a + cnt[s], 0)) return null;
  // 世界：分配 unknown 到 others
  const worlds = [];
  const seen = new Set();
  const enumAll = (idx, rest, acc) => {
    if (worlds.length > 2000) return;
    if (idx === others.length) { worlds.push(acc.map((a) => a.slice())); return; }
    const need = cnt[others[idx]];
    const choose = (start, pick) => {
      if (pick.length === need) {
        const used = new Set(pick);
        const hand = pick.map((i) => rest[i]);
        const hk = hand.map(keyRS).sort().join(',') + '|' + idx;
        enumAll(idx + 1, rest.filter((_, i) => !used.has(i)), [...acc, hand]);
        return hk;
      }
      for (let i = start; i < rest.length; i++) choose(i + 1, [...pick, i]);
    };
    choose(0, []);
  };
  enumAll(0, unknown, []);
  let list = [];
  for (const w of worlds) {
    const k = w.map((h) => h.map(keyRS).sort().join(',')).join('|');
    if (seen.has(k)) continue; seen.add(k); list.push(w);
  }
  if (list.length > maxWorlds) {
    const rng = rngOf((ctx.hand || []).reduce((a, c) => a * 31 + c.rank.charCodeAt(0) + c.suit.charCodeAt(0), 7));
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    list = list.slice(0, maxWorlds);
  }
  const team = me % 2;
  const lastPlayer = ctx.leading ? null : ctx.lastPlaySeat;
  // 我之前已过牌的在打座位数
  let passCount = 0;
  if (!ctx.leading && lastPlayer != null) for (let s = (lastPlayer + 1) % 4; s !== me; s = (s + 1) % 4) if (!finished.includes(s)) passCount++;
  let nodes = 0;
  const handKey = (h) => h.map(keyRS).sort().join('');
  const sum = new Map();
  const t0 = Date.now();
  let done = 0;
  for (const w of list) {
    if (done >= minWorlds && Date.now() - t0 > timeMs) break;
    nodes = 0;
    const hands = [[], [], [], []];
    hands[me] = ctx.hand.slice();
    others.forEach((s, i) => { hands[s] = w[i]; });
    const memo = new Map();
    const search = (st) => {
      if (++nodes > nodeBudget || ((nodes & 255) === 0 && Date.now() - t0 > timeMs * 2)) throw new Error('budget');
      const key = st.hands.map(handKey).join('|') + st.cur + '|' + (st.last ? st.last.type + st.last.rank + ':' + st.last.size + ':' + (st.last.length ?? '') : '-') + '|' + st.lp + '|' + st.pc + '|' + st.fin.join('');
      const hit = memo.get(key); if (hit !== undefined) return hit;
      const mvs = legalMoves(st.hands[st.cur], st.last, lv, !st.last);
      const maxi = st.cur % 2 === team;
      let best = maxi ? -1e9 : 1e9;
      for (const m of dedupe(mvs)) {
        const v = step(st, m);
        if (maxi ? v > best : v < best) best = v;
        if (maxi && best >= 3) break;
        if (!maxi && best <= -3) break;
      }
      memo.set(key, best);
      return best;
    };
    const step = (st, m) => {
      const seat = st.cur;
      if (!m.cards.length) {
        const pc = st.pc + 1;
        const active = 4 - st.fin.length;
        const need = st.fin.includes(st.lp) ? active : active - 1;
        if (pc >= need) {
          let leader = st.lp;
          if (st.fin.includes(leader)) { const p = (leader + 2) % 4; leader = st.fin.includes(p) ? nextActive(st.fin, leader) : p; }
          return search({ hands: st.hands, cur: leader, last: null, lp: leader, pc: 0, fin: st.fin });
        }
        return search({ ...st, cur: nextActive(st.fin, seat), pc });
      }
      const ids = new Set(m.cards.map((c) => c.id));
      const hands = st.hands.slice();
      hands[seat] = hands[seat].filter((c) => !ids.has(c.id));
      let fin = st.fin;
      if (!hands[seat].length) fin = [...fin, seat];
      const t0 = fin.includes(0) && fin.includes(2), t1 = fin.includes(1) && fin.includes(3);
      if (fin.length >= 3 || t0 || t1) {
        const rest = [0, 1, 2, 3].filter((s) => !fin.includes(s)).sort((a, b) => hands[a].length - hands[b].length);
        return teamPts([...fin, ...rest], team);
      }
      return search({ hands, cur: nextActive(fin, seat), last: m.combo, lp: seat, pc: 0, fin });
    };
    const part = new Map();
    const root = { hands, cur: me, last: ctx.leading ? null : ctx.previous, lp: lastPlayer, pc: passCount, fin: finished };
    try {
      for (const m of moves) {
        const real = { cards: m.cards.map((c) => hands[me].find((h) => h.id === c.id)).filter(Boolean), combo: m.combo };
        if (real.cards.length !== m.cards.length) return null;
        const v = step(root, real);
        part.set(mkey(m), v);
        sum.set(mkey(m), (sum.get(mkey(m)) || 0) + v);
      }
    } catch (e) { for (const m of moves) { const k = mkey(m); if (part.has(k)) sum.set(k, sum.get(k) - part.get(k)); } if (done >= 3) break; return null; }
    done++;
  }
  if (!done) return null;
  const values = new Map([...sum].map(([k, v]) => [k, v / done]));
  let best = null, bv = -1e9;
  for (const m of moves) { const v = values.get(mkey(m)); if (v > bv + 1e-9) { bv = v; best = m; } }
  return { values, best, bestValue: bv, worlds: done, nodes };
}
export const mkey = (m) => (m.cards || []).map((c) => c.id).sort().join(',') + ':' + (m.combo?.type || TYPES.PASS) + (m.combo?.rank ?? '');
function dedupe(ms) {
  const seen = new Set();
  return ms.filter((m) => { const k = m.cards.map(keyRS).sort().join(',') + m.combo.type + m.combo.rank; if (seen.has(k)) return false; seen.add(k); return true; });
}
