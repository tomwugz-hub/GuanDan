/**
 * 四人掼蛋对局控制（浏览器与 Node 共用）。
 * 座位：0 南（玩家）→ 1 东（下家）→ 2 北（对家）→ 3 西（上家），按 seat+1 顺序出牌。
 */
import { formatCard, makeDeck, shuffle, dealFourHands } from '../engine/cards.js';
import { classify, interpretAs, TYPES, isBombLike } from '../engine/combos.js';
import { beats } from '../engine/compare.js';
import { createMatch, createRound } from '../engine/state.js';
import { singleStrength, isWildCard } from '../engine/ranks.js';
import { decide, labelCombo } from '../policy/index.js';
import { newStdMatch, applyStdResult, planTribute, applyGives, returnOptions, isLegalReturn, minReturn } from '../engine/tributeStd.js';
import { chooseReturn as policyReturn } from '../policy/tribute.js';

export const SEAT_NAMES = ['南（你）', '东（下家）', '北（对家）', '西（上家）'];
export const SEAT_SHORT = ['南', '东', '北', '西'];
export const PLACE_NAMES = ['头游', '二游', '三游', '末游'];
const TYPE_LIST = [TYPES.BOMB, TYPES.STRAIGHT_FLUSH, TYPES.SINGLE, TYPES.PAIR, TYPES.TRIPLE, TYPES.FULLHOUSE,
  TYPES.STRAIGHT, TYPES.PAIR_SEQ, TYPES.TRIPLE_SEQ];

/** 可复现随机数（mulberry32）。 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isPassMove(m) {
  return !m || !m.cards || m.cards.length === 0 || m.combo?.type === TYPES.PASS;
}

export function moveText(m) {
  if (isPassMove(m)) return '过牌';
  return `${labelCombo(m.combo)}（${m.cards.map(formatCard).join(' ')}）`;
}

/** 着法比较键：牌型 + 主点 + 牌面多重集（忽略具体哪一张同面牌）。 */
export function moveKey(m) {
  if (isPassMove(m)) return 'pass';
  return `${m.combo.type}:${m.combo.rank}:${m.cards.map(formatCard).sort().join(',')}`;
}

/** 手牌排序（按级牌强弱，同点按花色）。 */
export function sortHand(hand, lv) {
  const suitOrd = { S: 0, H: 1, C: 2, D: 3, J: 4 };
  return hand.slice().sort((a, b) => {
    const wa = isWildCard(a, lv) ? 1 : 0;
    const wb = isWildCard(b, lv) ? 1 : 0;
    const sa = singleStrength(a.rank, lv) + wa * 0.5;
    const sb = singleStrength(b.rank, lv) + wb * 0.5;
    if (sa !== sb) return sb - sa;
    return (suitOrd[a.suit] ?? 9) - (suitOrd[b.suit] ?? 9);
  });
}

/**
 * 新比赛。progression=true：标准升级（engine/tributeStd：+3/+2/+1，打 A 头游且对家非末游过 A），g.match.levelRank/teamLevel 与之同步；
 * tribute（默认 = progression）：第二副起进贡/还贡/抗贡。
 * pre（自对局复现比赛中的某一副）：{ teamLevel, level, levelTeam, prevOrder }。
 */
export function newGame({ seed = Date.now() % 1e9, levelRank = '2', progression = true, botEngine = 'decide', tribute = null, pre = null } = {}) {
  const std = newStdMatch(levelRank);
  if (pre) Object.assign(std, structuredClone(pre), { matchOver: false, winnerTeam: null });
  const g = {
    seed,
    rng: makeRng(seed),
    match: createMatch({ levelRank }),
    std,
    progression,
    tribute: tribute == null ? progression : tribute,
    botEngine,
    dealNo: 0,
    round: null,
    log: [],
    played: [],
    trickPlays: [],
    lastResult: null,
    flags: [],
    history: [],
    startedAt: new Date().toISOString(),
    nextLeader: Math.floor(makeRng(seed + 7)() * 4),
    tributeState: null,
  };
  startDeal(g);
  return g;
}

/** 把当前这一副（出牌记录 + 进贡 + 结果）存进 g.history（发下一副前调用；同一副只存一次）。 */
export function archiveDeal(g) {
  if (!g.round || !g.dealNo) return;
  g.history = g.history || [];
  if (g.history.some((d) => d.deal === g.dealNo)) return;
  g.history.push(dealRecord(g));
}

function dealRecord(g) {
  const ts = g.tributeState || {};
  const lv = g.match.levelRank;
  return {
    deal: g.dealNo,
    levelRank: lv,
    teamLevel: g.match.teamLevel ? g.match.teamLevel.slice() : null,
    dealt: (ts.dealt || []).map((h) => sortHand(h, lv).map(formatCard)),
    tribute: ts.plan ? {
      kind: ts.plan.kind, resisted: !!ts.plan.resisted, resistBy: ts.plan.resistBy || null, leader: ts.plan.leader ?? null,
      gives: (ts.plan.gives || []).map((x) => ({ from: x.from, to: x.to, card: formatCard(x.card) })),
      returns: (ts.returns || []).map((x) => ({ from: x.from, to: x.to, card: formatCard(x.card) })),
    } : null,
    log: g.log.slice(),
    result: g.lastResult ? structuredClone(g.lastResult) : null,
    finished: g.round.finished.length >= 4,
  };
}

/**
 * 整场比赛（已结束的各副 + 当前这一副）的完整记录，导出为 JSONL 行对象数组：
 *  {type:'game'} 一行；每副 {type:'deal'}；每一手 {type:'move'}（出牌前手牌、桌面、教练建议、实际出牌、是否标记）；
 *  再加 {type:'flag'}（用户标记的用例格式）。
 */
export function gameLogRows(g, { flags = [], app = {} } = {}) {
  const deals = [...(g.history || [])];
  if (g.round && g.dealNo && !deals.some((d) => d.deal === g.dealNo)) deals.push(dealRecord(g));
  const rows = [];
  const moves = deals.reduce((n, d) => n + d.log.length, 0);
  rows.push({ type: 'game', app: 'guandan-play', ...app, seed: g.seed, startedAt: g.startedAt || null, exportedAt: new Date().toISOString(),
    progression: !!g.progression, tribute: !!g.tribute, seats: SEAT_NAMES, humanSeat: 0, deals: deals.length, moves, flags: flags.length });
  for (const d of deals) {
    const { log, ...rest } = d;
    rows.push({ type: 'deal', ...rest, moves: log.length });
    for (const e of log) {
      const s = e.snapshot || {};
      const counts = s.hands ? [0, 1, 2, 3].map((k) => (s.hands[String(k)] || []).length) : null;
      rows.push({
        type: 'move', deal: e.deal, n: e.n, seat: e.seat, seatName: SEAT_NAMES[e.seat], by: e.by,
        handBefore: s.hands ? s.hands[String(e.seat)] : null,
        table: { levelRank: s.levelRank, leading: s.leading, previous: s.previous, trickMeta: s.trickMeta, firstLeadOfDeal: s.firstLeadOfDeal, counts, playedCards: s.playedCards },
        handsAll: s.hands || null,
        coach: e.coach, move: e.move, same: e.coach ? !!e.coach.same : null, reason: e.reason || '',
        trickEnd: !!e.trickEnd, wentOut: e.wentOut || null, flagged: !!e.flagged,
      });
    }
  }
  for (const f of flags) rows.push({ type: 'flag', ...f });
  return rows;
}

export function gameLogJsonl(g, opts) {
  return gameLogRows(g, opts).map((r) => JSON.stringify(r)).join('\n') + '\n';
}

/** 发新一副（第二副起若开了进贡：先进入进贡阶段，tributePending(g) 为真，出牌前须 tributeGive + tributeReturn / autoTribute）。 */
export function startDeal(g) {
  archiveDeal(g);
  g.dealNo += 1;
  if (g.progression) {
    if (g.std.matchOver) g.std = newStdMatch('2');
    g.match.levelRank = g.std.level;
    g.match.teamLevel = g.std.teamLevel.slice();
    g.match.matchOver = false;
    g.match.winnerTeam = null;
  }
  const hands = dealFourHands(shuffle(makeDeck(), g.rng));
  const lv = g.match.levelRank;
  const plan = g.tribute && g.progression ? planTribute(g.std.prevOrder, hands, lv) : { kind: 'none', gives: [], resisted: false, leader: null };
  const leader = plan.leader ?? g.nextLeader;
  g.round = createRound(g.match, { dealerSeat: leader, hands });
  g.tributeState = {
    plan,
    phase: plan.kind === 'none' || plan.resisted ? 'done' : 'give',
    returns: [],
    pending: [],
    dealt: hands.map((h) => h.slice()),
  };
  g.log = [];
  g.played = [];
  g.trickPlays = [];
  g.lastResult = null;
  g.leadsSoFar = 0;
  g.lastTablePlay = [null, null, null, null];
  return g;
}

/** 本副还在进贡/还贡阶段。 */
export function tributePending(g) {
  return !!g.tributeState && g.tributeState.phase !== 'done';
}

/** 进贡（强制牌，同时进行）。之后 phase = 'return'，pending 为待还贡的 { seat, to, received }。 */
export function tributeGive(g) {
  const ts = g.tributeState;
  if (!ts || ts.phase !== 'give') return { ok: false, reason: '不在进贡阶段' };
  g.round.hands = applyGives(g.round.hands, ts.plan);
  ts.pending = ts.plan.gives.map((x) => ({ seat: x.to, to: x.from, received: x.card }));
  ts.phase = ts.pending.length ? 'return' : 'done';
  return { ok: true, gives: ts.plan.gives };
}

/** 某座位可还的牌。 */
export function returnChoices(g, seat) {
  return returnOptions(g.round.hands[seat], g.match.levelRank).cards;
}

/** 还贡：seat 把 card 还给向自己进贡的人。 */
export function tributeReturn(g, seat, card) {
  const ts = g.tributeState;
  if (!ts || ts.phase !== 'return') return { ok: false, reason: '不在还贡阶段' };
  const i = ts.pending.findIndex((p) => p.seat === seat);
  if (i < 0) return { ok: false, reason: '该座位不需要还贡' };
  const lv = g.match.levelRank;
  const c = card && g.round.hands[seat].find((x) => x.id === card.id);
  if (!c || !isLegalReturn(c, g.round.hands[seat], lv)) return { ok: false, reason: '还贡须是 10 或以下的牌（王、级牌不可）' };
  const p = ts.pending[i];
  g.round.hands[seat] = g.round.hands[seat].filter((x) => x.id !== c.id);
  g.round.hands[p.to] = g.round.hands[p.to].concat(c);
  ts.returns.push({ from: seat, to: p.to, card: c });
  ts.pending.splice(i, 1);
  if (!ts.pending.length) ts.phase = 'done';
  return { ok: true, card: c, to: p.to };
}

/** 机器人默认还贡（policy/tribute.chooseReturn）。 */
export function botReturnCard(g, seat, variant) {
  const ts = g.tributeState;
  const p = ts?.pending.find((x) => x.seat === seat);
  return policyReturn(g.round.hands[seat], { lv: g.match.levelRank, seat, to: p?.to, received: p?.received }, variant);
}

/** 一次做完进贡+还贡。chooser(seat, g) → 牌（null/非法 → 最小可还牌）；skipSeats 中的座位留给人来还。 */
export function autoTribute(g, chooser = null, skipSeats = []) {
  const ts = g.tributeState;
  if (!ts) return g;
  if (ts.phase === 'give') tributeGive(g);
  for (const p of ts.pending.slice()) {
    if (skipSeats.includes(p.seat)) continue;
    let c = chooser ? chooser(p.seat, g) : botReturnCard(g, p.seat);
    if (!c || !isLegalReturn(c, g.round.hands[p.seat], g.match.levelRank)) c = minReturn(g.round.hands[p.seat], g.match.levelRank);
    tributeReturn(g, p.seat, c);
  }
  return g;
}

export function isLeading(g) {
  const r = g.round;
  return !r.lastCombo || r.lastCombo.type === TYPES.PASS;
}

export function isOver(g) {
  return g.round.finished.length >= 4;
}

/** 每家本副最近两手（不含过牌）共出几张（r14 “敌在快走”判断用）。 */
function recentShedOf(r) {
  const out = [0, 0, 0, 0], seen = [0, 0, 0, 0];
  const t = r.tricks || [];
  for (let i = t.length - 1; i >= 0; i--) { const s = t[i].seat; if (seen[s] < 2) { seen[s]++; out[s] += t[i].cards.length; } }
  return out;
}

/** 当前局面给 decide 的 ctx。 */
export function ctxFor(g, seat) {
  const r = g.round;
  const leading = isLeading(g);
  const partner = (seat + 2) % 4;
  // 只有“要压的这一手”是搭档出的，才算压搭档（与评测用例 trickMeta.partnerLastPlay 约定一致）。
  // 旧实现取本轮搭档出过的任意一手：搭档领出后敌人压上，再轮到自己时也被当成“压搭档”而一直过牌。
  const partnerCombo = !leading && r.lastPlayer === partner ? r.lastCombo : null;
  return {
    hand: r.hands[seat],
    previous: leading ? null : r.lastCombo,
    levelRank: g.match.levelRank,
    leading,
    firstLeadOfDeal: leading && g.leadsSoFar === 0,
    seat,
    remainingSeatCounts: r.hands.map((h) => h.length),
    partnerCombo: leading ? null : partnerCombo,
    playedCards: g.played.slice(),
    persona: null,
    lastPlaySeat: leading ? null : r.lastPlayer,
    recentShed: recentShedOf(r),
    passLog: r.passLog || [],
    leadLog: r.leadLog || [],
    finishedOrder: r.finished.slice(),
  };
}

/** r19：把构建/缓存版本写进 index.html 的 <html data-build>，导出记录的头部就能带上 build。 */
export function withBuildAttr(html, build) {
  return html.replace(/<html([^>]*?)(\s+data-build="[^"]*")?>/, (m, a) => `<html${a} data-build="${build}">`);
}

/** decide 的建议。 */
export function coachMove(g, seat) {
  const rec = decide(ctxFor(g, seat));
  return { move: rec.move, reason: rec.reason || '', text: moveText(rec.move), scored: rec.scored || [], lv: g.match.levelRank };
}

/** r18：分歧提示阈值（decide 分差，最佳 − 你的着法）。小于此值视为“差不多”，不提示“与教练不同”。 */
export const COACH_GAP_MIN = 6; // r20：12→6（game4 第 6、54 手分差 9.8/9.1 却是真差距）
const eqKey = (m, lv) => (isPassMove(m) ? 'pass' : `${m.combo.type}:${m.combo.rank}:${m.cards.map((c) => (isWildCard(c, lv) ? '*' : c.rank)).sort().join(',')}`);
/** decide 分差：教练最佳分 − 你的着法分；你的着法不在候选里（被过滤/禁止）→ null（视为差距大）。 */
export function moveGap(coach, move) {
  const sc = coach?.scored || [];
  if (!sc.length) return null;
  const lv = coach.lv || '2';
  const best = sc[0].score;
  const k = moveKey(move), ek = eqKey(move, lv);
  const hit = sc.find((x) => moveKey(x.move) === k) || sc.find((x) => eqKey(x.move, lv) === ek);
  return hit ? Math.max(0, best - hit.score) : null;
}
/** play() 记录用：same=false 时给出分差 gap 与 minor（分差 < 阈值 → 不当作分歧提示）。 */
export function coachDiffInfo(coach, move) {
  if (moveKey(coach.move) === moveKey(move)) return {};
  const gap = moveGap(coach, move);
  // r20 第二信号：过牌 vs 出牌、炸弹 vs 非炸弹 —— 性质不同，从不算“差不多”
  const kind = (m) => (isPassMove(m) ? 'pass' : isBombLike(m.combo) ? 'bomb' : 'play');
  const sameKind = kind(coach.move) === kind(move);
  return { gap: gap == null ? null : Math.round(gap * 10) / 10, minor: sameKind && gap != null && gap < COACH_GAP_MIN };
}
/** 诊断：局面 g 上 seat 打出 cards 时与教练的分差。 */
export function coachGap(g, seat, cards, preferCombo = null) {
  const c = coachMove(g, seat);
  const it = interpretPlay(g, seat, cards, preferCombo);
  if (!it.ok) return { gap: null, how: 'illegal' };
  const gap = moveGap(c, { cards, combo: it.combo });
  return { gap, how: gap == null ? 'notScored' : 'scored', coach: c.text };
}

/** 局面快照：与 eval/endgames/*.jsonl 用例相同格式（不含 gold）。 */
export function snapshot(g, seat) {
  const r = g.round;
  const leading = isLeading(g);
  const hands = {};
  for (let s = 0; s < 4; s++) hands[String(s)] = sortHand(r.hands[s], g.match.levelRank).map(formatCard);
  const ctx = ctxFor(g, seat);
  let previous = null;
  if (!leading) {
    const lastT = [...g.trickPlays].reverse().find((t) => !isPassMove(t));
    previous = { type: r.lastCombo.type, rank: r.lastCombo.rank ?? null, cards: lastT ? lastT.cards.map(formatCard) : [] };
  }
  return {
    levelRank: g.match.levelRank,
    seat,
    leading,
    hands,
    previous,
    firstLeadOfDeal: ctx.firstLeadOfDeal,
    playedCards: g.played.map(formatCard),
    trickMeta: {
      lastPlayer: leading ? null : r.lastPlayer,
      controlSeat: leading ? seat : r.lastPlayer,
      partnerLastPlay: ctx.partnerCombo ? { type: ctx.partnerCombo.type, rank: ctx.partnerCombo.rank ?? null } : null,
    },
  };
}

/**
 * 解释一组牌为能出的牌型（优先 classify，其次按其它牌型解释）。
 * @returns {{ ok: boolean, combo?: object, reason?: string }}
 */
export function interpretPlay(g, seat, cards, preferCombo = null) {
  const r = g.round;
  const lv = g.match.levelRank;
  const leading = isLeading(g);
  if (!cards.length) return leading ? { ok: false, reason: '领出不能过牌' } : { ok: true, combo: { type: TYPES.PASS, rank: null, size: 0 } };
  if (!cards.every((c) => r.hands[seat].some((h) => h.id === c.id))) return { ok: false, reason: '手牌中没有这些牌' };
  const tries = [];
  if (preferCombo && preferCombo.type) {
    const c = interpretAs(cards, preferCombo.type, lv);
    if (c) tries.push(c);
  }
  const c0 = classify(cards, lv);
  if (c0) tries.push(c0);
  for (const t of TYPE_LIST) {
    const c = interpretAs(cards, t, lv);
    if (c) tries.push(c);
  }
  if (!tries.length) return { ok: false, reason: '不能组成合法牌型' };
  if (leading) return { ok: true, combo: tries[0] };
  const ok = tries.find((c) => beats(c, r.lastCombo, lv));
  if (!ok) return { ok: false, reason: `压不过上一手（${labelCombo(r.lastCombo)}）` };
  return { ok: true, combo: ok };
}

/**
 * 出牌（与 engine/state.applyPlay 规则一致，但允许指定牌型解释，如百搭凑成的牌）。
 * @returns {{ ok: boolean, reason?: string, finished?: boolean }}
 */
export function play(g, seat, cards, { by = 'human', coach = null, reason = '', preferCombo = null } = {}) {
  const r = g.round;
  if (isOver(g)) return { ok: false, reason: '本副已结束' };
  if (tributePending(g)) return { ok: false, reason: '进贡/还贡还没完成' };
  if (seat !== r.currentSeat) return { ok: false, reason: '还没轮到该座位' };
  const it = interpretPlay(g, seat, cards, preferCombo);
  if (!it.ok) return it;
  const snap = snapshot(g, seat);
  const leading = isLeading(g);
  const move = { cards: cards.slice(), combo: it.combo };
  const entry = {
    n: g.log.length + 1,
    deal: g.dealNo,
    seat,
    by,
    move: { text: moveText(move), cards: cards.map(formatCard), type: it.combo.type, rank: it.combo.rank ?? null, size: cards.length },
    coach: coach ? { text: moveText(coach.move), cards: (coach.move.cards || []).map(formatCard), type: coach.move.combo?.type || 'pass', rank: coach.move.combo?.rank ?? null, size: (coach.move.cards || []).length, reason: coach.reason, same: moveKey(coach.move) === moveKey(move), ...coachDiffInfo(coach, move) } : null,
    reason,
    snapshot: snap,
  };
  g.log.push(entry);

  if (isPassMove(move)) {
    (r.passLog ||= []).push({ seat, combo: r.lastCombo, by: r.lastPlayer });
    r.passCount += 1;
    g.trickPlays.push({ seat, cards: [], combo: move.combo });
    g.lastTablePlay[seat] = { pass: true };
    const active = 4 - r.finished.length;
    const need = r.finished.includes(r.lastPlayer) ? active : active - 1;
    if (r.passCount >= need) {
      r.lastCombo = null;
      r.passCount = 0;
      // 接风：出牌者已出完则由其对家领出
      let leader = r.lastPlayer;
      if (r.finished.includes(leader)) {
        const p = (leader + 2) % 4;
        leader = r.finished.includes(p) ? nextActive(r, leader) : p;
      }
      r.currentSeat = leader;
      r.leadSeat = leader;
      g.trickPlays = [];
      entry.trickEnd = true;
    } else {
      r.currentSeat = nextActive(r, seat);
    }
    return { ok: true, entry };
  }

  if (leading) {
    g.leadsSoFar += 1;
    g.lastTablePlay = [null, null, null, null];
    (r.leadLog ||= []).push({ seat, combo: it.combo }); // r149：本副领出记录（GD_R149 用）
  }
  r.hands[seat] = r.hands[seat].filter((h) => !cards.some((c) => c.id === h.id));
  r.lastCombo = it.combo;
  r.lastPlayer = seat;
  r.passCount = 0;
  r.tricks.push({ seat, cards, combo: it.combo });
  g.trickPlays.push({ seat, cards: cards.slice(), combo: it.combo });
  g.played.push(...cards);
  g.lastTablePlay[seat] = { cards: cards.slice(), combo: it.combo };
  if (r.hands[seat].length === 0) {
    r.finished.push(seat);
    entry.wentOut = r.finished.length;
  }
  // 一方两家都走完则本副结束
  const t0 = r.finished.includes(0) && r.finished.includes(2);
  const t1 = r.finished.includes(1) && r.finished.includes(3);
  if (r.finished.length >= 3 || t0 || t1) {
    const rest = [0, 1, 2, 3].filter((s) => !r.finished.includes(s));
    rest.sort((a, b) => r.hands[a].length - r.hands[b].length);
    r.finished.push(...rest);
    finishDeal(g);
    return { ok: true, entry, finished: true };
  }
  // 若下一位都已出完时由 nextActive 跳过；出完者的轮次由“接风”在过牌结算处理
  r.currentSeat = nextActive(r, seat);
  return { ok: true, entry };
}

function nextActive(r, seat) {
  for (let i = 1; i <= 4; i++) {
    const s = (seat + i) % 4;
    if (!r.finished.includes(s)) return s;
  }
  return seat;
}

function finishDeal(g) {
  const order = g.round.finished.slice();
  const before = g.match.levelRank;
  const teamLevelBefore = g.match.teamLevel.slice();
  let res = { message: '' };
  if (g.progression) {
    res = applyStdResult(g.std, order);
    g.match.teamLevel = g.std.teamLevel.slice();
    g.match.matchOver = g.std.matchOver;
    g.match.winnerTeam = g.std.winnerTeam;
  }
  g.lastResult = {
    order,
    places: order.map((s, i) => `${PLACE_NAMES[i]}：${SEAT_NAMES[s]}`),
    winTeam: order[0] % 2,
    steps: res.steps ?? null,
    levelBefore: before,
    levelAfter: g.progression ? g.std.level : before,
    teamLevelBefore,
    teamLevel: g.match.teamLevel.slice(),
    message: res.message,
    matchOver: !!g.match.matchOver,
    winnerTeam: g.match.winnerTeam ?? null,
  };
  g.nextLeader = order[0];
}

/** 机器人（decide）出一手。 */
export function botStepDecide(g) {
  const seat = g.round.currentSeat;
  const c = coachMove(g, seat);
  const res = play(g, seat, c.move.cards || [], { by: 'decide', coach: c, reason: c.reason, preferCombo: c.move.combo });
  if (!res.ok) {
    // 兜底：理论上不会发生；改为过牌或出最小单张
    const fb = isLeading(g) ? [sortHand(g.round.hands[seat], g.match.levelRank).slice(-1)[0]] : [];
    return play(g, seat, fb, { by: 'decide', coach: c, reason: `兜底（${res.reason}）` });
  }
  return res;
}

/** 由牌面字符串在手牌中找到对应的牌对象。 */
export function cardsFromStrings(hand, strs) {
  const pool = hand.slice();
  const out = [];
  for (const s of strs || []) {
    const i = pool.findIndex((c) => formatCard(c) === s);
    if (i < 0) return null;
    out.push(pool[i]);
    pool.splice(i, 1);
  }
  return out;
}

/** 标记 → eval 用例格式（JSONL 一行）。gold 取用户选择。 */
export function flagToCase(entry, { note = '', goldFrom = 'unsure', idx = 1 } = {}) {
  const pick = goldFrom === 'played' ? entry.move : goldFrom === 'coach' ? entry.coach : null;
  const goldAlt = (m) => (m.type === 'pass' || !m.cards.length ? { comboType: 'pass' } : { comboType: m.type, ranks: m.rank != null ? [m.rank] : [], size: m.size });
  const ts = new Date();
  const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}-${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}${String(ts.getSeconds()).padStart(2, '0')}`;
  const s = entry.snapshot;
  const out = {
    id: `flag-${stamp}-${idx}`,
    tags: ['user-flag', entry.by === 'human' ? 'human-move' : `bot-${entry.by}`],
    source: { app: 'guandan-play', deal: entry.deal, play: entry.n, by: entry.by, flaggedAt: ts.toISOString() },
    levelRank: s.levelRank,
    seat: s.seat,
    leading: s.leading,
    hands: s.hands,
    previous: s.previous,
    firstLeadOfDeal: s.firstLeadOfDeal,
    playedCards: s.playedCards,
    confidence: pick ? 'user' : 'unlabelled',
    chosen: entry.move,
    coach: entry.coach,
    note,
    trickMeta: s.trickMeta,
  };
  if (pick) {
    const a = goldAlt(pick);
    out.gold = { action: a.comboType === 'pass' ? 'pass' : 'play', comboType: a.comboType, ranks: a.ranks || [], alts: [a], rationale: note || (goldFrom === 'played' ? '用户认为实际出牌正确' : '用户认为教练建议正确') };
  } else {
    out.gold = null;
  }
  return out;
}

export { formatCard, labelCombo, isBombLike };
