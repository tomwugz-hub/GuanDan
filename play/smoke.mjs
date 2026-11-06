#!/usr/bin/env node
/**
 * 冒烟测试：若干场纯机器人比赛（每场多副，第二副起进贡/还贡/抗贡）+ 一场脚本化“人类”（南家随机合法着法、含非法尝试、进贡/还贡、标记导出）。
 * 用法：node src/play/smoke.mjs [games=6]
 */
import { newGame, startDeal, play, botStepDecide, coachMove, isOver, isLeading, flagToCase, interpretPlay, makeRng,
  tributePending, tributeGive, tributeReturn, autoTribute, returnChoices } from './core.js';
import { isReturnEligible } from '../engine/tributeStd.js';
import { legalMoves } from '../engine/legal.js';

const GAMES = Number(process.argv[2] || 6);
const assert = (c, m) => { if (!c) throw new Error('断言失败：' + m); };

function checkInvariants(g) {
  const total = g.round.hands.reduce((a, h) => a + h.length, 0) + g.played.length;
  assert(total === 108, `牌数守恒 ${total}`);
  const ids = new Set([...g.round.hands.flat(), ...g.played].map((c) => c.id));
  assert(ids.size === 108, '牌 id 唯一');
}

const DEALS = Number(process.argv[3] || 5);
const tstat = { single: 0, double: 0, resisted: 0, tie: 0 };
/** 进贡完成后的检查：每家 27 张、先出者 = 计划、还贡 ≤10（或兜底）、贡牌离开进贡者。 */
function checkTribute(g) {
  const ts = g.tributeState;
  assert(!tributePending(g), '进贡未完成');
  assert(g.round.hands.every((h) => h.length === 27), `进贡后张数 ${g.round.hands.map((h) => h.length)}`);
  checkInvariants(g);
  const p = ts.plan;
  if (p.kind === 'none') return;
  tstat[p.kind]++;
  if (p.resisted) { tstat.resisted++; assert(ts.returns.length === 0, '抗贡不还贡'); }
  if (p.tie) tstat.tie++;
  assert(g.round.currentSeat === p.leader, '先出者');
  for (const x of p.gives) assert(g.round.hands[x.to].some((c) => c.id === x.card.id) || ts.returns.some((r) => r.card.id === x.card.id), '贡牌到收贡者');
  for (const r of ts.returns) assert(isReturnEligible(r.card, g.match.levelRank) || !ts.dealt[r.from].some((c) => isReturnEligible(c, g.match.levelRank)), '还贡 ≤10');
}

let deals = 0, moves = 0, fallbacks = 0, maxMs = 0;
const t0 = Date.now();
for (let gi = 0; gi < GAMES; gi++) {
  const g = newGame({ seed: 9000 + gi });
  for (let d = 0; d < DEALS; d++) {
    if (d > 0) {
      startDeal(g);
      if (d > 0 && g.dealNo > 1 && g.tributeState.plan.kind !== 'none') {
        assert(g.tributeState.plan.resisted || tributePending(g), '第二副起应进贡');
        if (tributePending(g)) assert(!play(g, g.round.currentSeat, []).ok, '进贡前不能出牌');
      }
      autoTribute(g);
      checkTribute(g);
    }
    let steps = 0;
    while (!isOver(g)) {
      const t = Date.now();
      const r = botStepDecide(g);
      maxMs = Math.max(maxMs, Date.now() - t);
      assert(r.ok, r.reason);
      if (/兜底/.test(r.entry.reason)) fallbacks++;
      steps++; moves++;
      assert(steps < 1500, '步数过多（死循环？）');
      checkInvariants(g);
    }
    const o = g.lastResult.order;
    assert(new Set(o).size === 4, '名次 4 人各不相同');
    deals++;
  }
}
console.log(`机器人对局：${GAMES} 场、${deals} 副、${moves} 手，兜底 ${fallbacks} 次，单手最慢 ${maxMs}ms，用时 ${Date.now() - t0}ms；进贡：单贡 ${tstat.single}、双贡 ${tstat.double}、抗贡 ${tstat.resisted}、同点 ${tstat.tie}`);
assert(tstat.single + tstat.double > 0, '应出现进贡');
assert(fallbacks === 0, '不应出现兜底');

// 脚本化人类
const rng = makeRng(42);
let g = newGame({ seed: 4242 });
let humanMoves = 0, rejected = 0, diffs = 0, humanTrib = 0;
const flagged = [];
let hd = 0;
for (; hd < 24 && !(hd >= 3 && humanTrib > 0); hd++) {
if (hd > 0) {
  if (g.match.matchOver) g = newGame({ seed: 4242 + hd }); // r25：整场打完仍未出现人类还贡 → 换新比赛继续（结果依赖策略，不应因此失败）
  else startDeal(g);
  if (tributePending(g)) {
    tributeGive(g);
    autoTribute(g, null, [0]);
    if (g.tributeState.pending.some((x) => x.seat === 0)) {
      const bad = g.round.hands[0].find((c) => !returnChoices(g, 0).some((x) => x.id === c.id));
      if (bad) { assert(!tributeReturn(g, 0, bad).ok, '非法还贡应拒绝'); rejected++; }
      const ch = returnChoices(g, 0);
      assert(tributeReturn(g, 0, ch[Math.floor(rng() * ch.length)]).ok, '人类还贡');
      humanTrib++;
    }
  }
  checkTribute(g);
}
while (!isOver(g)) {
  const seat = g.round.currentSeat;
  if (seat !== 0) {
    // 非法：南家抢出
    const bad = play(g, 0, g.round.hands[0].slice(0, 1), { by: 'human' });
    assert(!bad.ok, '非轮次出牌应被拒绝'); rejected++;
    const r = botStepDecide(g); assert(r.ok, r.reason);
    if (g.log.length % 17 === 0) flagged.push(flagToCase(r.entry, { note: '机器人这手可疑', goldFrom: 'coach', idx: flagged.length + 1 }));
    continue;
  }
  const coach = coachMove(g, 0);
  if (isLeading(g)) {
    const p = play(g, 0, [], { by: 'human' });
    assert(!p.ok, '领出不能过'); rejected++;
  } else if (g.round.hands[0].length >= 2) {
    // 试一手明显非法的两张杂牌
    const h = g.round.hands[0];
    const two = [h[0], h.find((c) => c.rank !== h[0].rank && c.rank !== 'RJ' && c.rank !== 'BJ')].filter(Boolean);
    if (two.length === 2 && !interpretPlay(g, 0, two).ok) { assert(!play(g, 0, two, { by: 'human' }).ok, '杂牌应拒绝'); rejected++; }
  }
  const lm = legalMoves(g.round.hands[0], isLeading(g) ? null : g.round.lastCombo, g.match.levelRank, isLeading(g));
  const pickCoach = rng() < 0.6;
  const m = pickCoach ? coach.move : lm[Math.floor(rng() * lm.length)];
  const r = play(g, 0, m.cards || [], { by: 'human', coach, preferCombo: m.combo });
  assert(r.ok, '人类合法着法被拒：' + r.reason);
  humanMoves++;
  if (!r.entry.coach.same) diffs++;
  if (humanMoves % 3 === 1) flagged.push(flagToCase(r.entry, { note: '测试标记', goldFrom: humanMoves % 2 ? 'played' : 'unsure', idx: flagged.length + 1 }));
  checkInvariants(g);
}
}
for (const f of flagged) {
  assert(f.id && f.hands && f.levelRank && typeof f.leading === 'boolean' && f.trickMeta, '标记格式');
  const tot = Object.values(f.hands).reduce((a, h) => a + h.length, 0) + f.playedCards.length;
  assert(tot === 108, '标记局面牌数');
  if (f.gold) assert(Array.isArray(f.gold.alts) && f.gold.alts.length, 'gold.alts');
  JSON.parse(JSON.stringify(f));
}
assert(humanTrib > 0, '人类应至少还贡一次');
console.log(`脚本人类：${hd} 副 ${humanMoves} 手（与教练不同 ${diffs} 手），人类还贡 ${humanTrib} 次，非法尝试被拒 ${rejected} 次，标记 ${flagged.length} 条；最后一副：${g.lastResult.places.join('，')}，级数 ${g.match.teamLevel.join('/')}`);
if (process.env.SMOKE_FLAGS_OUT) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(process.env.SMOKE_FLAGS_OUT, flagged.map((f) => JSON.stringify(f)).join('\n') + '\n');
}
console.log('SMOKE OK');
