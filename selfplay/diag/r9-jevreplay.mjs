#!/usr/bin/env node
/**
 * r9：用新 Jev 提示词在 jev-audit 的快照局面上重放（selfplay/cache/r9-snap），看 Jev 是否选到 MC 更好的着法。
 *   node selfplay/diag/r9-jevreplay.mjs --set=mc|agree --tag=r9b [--n=200] [--parts=4] [--decide=current]
 *   候选/状态 = 新代码（jevPrepare）+ decide（--decide，默认 current）；Jev 走 selfplay/cache 缓存（哈希含提示词版本）。
 *   结果逐条写 selfplay/reports/tmp/jevreplay-<tag>-<set>.jsonl（可续跑）；MC（只对“新着法”既不是旧 decide 也不是旧 Jev 的局面）见 --mc。
 *   --mc：对新着法 vs 旧 decide 着法做 k=40 rollout（后续全用 post-selfplay-r8，与 jev-audit MC 同种子），写 ...-mc.jsonl，并汇总。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import * as L from '../lib.mjs';
import { loadSnap } from './r9-pos.mjs';
import { runTasks } from '../pool.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, v] = s.replace(/^--/, '').split(/=(.*)/s); return [k, v ?? '1']; }));
const SET = args.set || 'mc', TAG = args.tag || 'r9', N = Number(args.n || 200), PARTS = Number(args.parts || 4);
const TMP = path.join(L.ROOT, 'selfplay', 'reports', 'tmp');
fs.mkdirSync(TMP, { recursive: true });
const OUT = path.join(TMP, `jevreplay-${TAG}-${SET}.jsonl`);
const audit = JSON.parse(fs.readFileSync(path.join(L.ROOT, 'selfplay', 'reports', 'jev-audit.json'), 'utf8'));
const norm = (s) => { if (!s || s === 'pass') return 'pass'; const m = s.match(/^([^{]+)\{(.*)\}$/); return m ? `${m[1]}{${m[2].split(' ').sort().join(' ')}}` : s; };
const mstr = (mv) => (mv?.cards?.length ? `${mv.combo.type}:${mv.combo.rank ?? ''}{${mv.cards.map(L.formatCard).join(' ')}}` : 'pass');

// 局面列表
function positions() {
  if (SET === 'mc') return audit.mc.filter((m) => !m.skip).map((m) => m.id);
  // agree：从快照里按固定种子抽 Jev 与 decide 一致的局面
  const ids = [];
  for (const f of fs.readdirSync(path.join(L.ROOT, 'selfplay', 'cache', 'r9-snap')).sort()) {
    if (!f.endsWith('.bin')) continue;
    const [cfg, seed] = f.replace('.bin', '').split('_');
    const lines = (globalThis.__idx ||= JSON.parse(fs.readFileSync(path.join(TMP, 'snap-index.json'), 'utf8')));
    for (const x of lines[`${cfg}|${seed}`] || []) if (x.ok && !x.dis) ids.push(x.id);
  }
  let s = 777; const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
  return ids.map((id) => ({ id, k: rnd() })).sort((a, b) => a.k - b.k).slice(0, N).map((x) => x.id);
}

if (args.child) {
  // 子进程：处理一部分局面
  const { jevPrepare, jevChooseCached } = await import('../jevAgent.mjs');
  const { moveKey } = await import('../../policy/jevCandidates.js');
  const decide = await L.loadDecide(args.decide || 'current');
  const ids = JSON.parse(args.ids);
  for (const id of ids) {
    const s = loadSnap(id);
    if (!s || !s.ok) { fs.appendFileSync(OUT, JSON.stringify({ id, skip: 'badSnap' }) + '\n'); continue; }
    const g = s.g, seat = s.seat;
    const ctx = L.ctxFor(g, seat);
    const rec = decide(ctx);
    const lastPlayer = ctx.leading ? null : g.round.lastPlayer;
    const { candidates, state } = jevPrepare(ctx, rec, lastPlayer);
    const dNew = mstr(rec.move);
    const row = { id, rel: s.rel, phase: s.phase, oldDecide: s.decideMoveStr, oldJev: s.moveStr, newDecide: dNew, nCands: candidates.length, oldCands: s.cands };
    if (candidates.length < 2 || (rec.move?.cards?.length && rec.move.cards.length === ctx.hand.length)) { row.newJev = dNew; row.skip = 'single'; }
    else {
      const r = jevChooseCached(candidates, state, { n: ctx.hand.length, rel: s.rel });
      const c = candidates.find((x) => x.key === r.choice);
      row.cached = !!r.cached; row.error = r.error || (c ? null : 'invalid_choice');
      row.newJev = c ? mstr(c.move) : dNew;
      row.newJevIds = c ? c.move.cards.map((x) => x.id) : null; row.newJevCombo = c ? c.move.combo : null;
      row.newLabel = c ? c.label : null;
      row.cands = candidates.map((x) => x.label);
      row.hints = state.policyHints;
    }
    row.newDecideIds = rec.move.cards.map((x) => x.id); row.newDecideCombo = rec.move.combo;
    fs.appendFileSync(OUT, JSON.stringify(row) + '\n');
  }
  process.exit(0);
}

if (SET === 'agree' && !fs.existsSync(path.join(TMP, 'snap-index.json'))) {
  const v8 = await import('node:v8');
  const idx = {};
  for (const f of fs.readdirSync(path.join(L.ROOT, 'selfplay', 'cache', 'r9-snap'))) {
    if (!f.endsWith('.bin')) continue;
    const arr = v8.deserialize(fs.readFileSync(path.join(L.ROOT, 'selfplay', 'cache', 'r9-snap', f)));
    const [cfg, seed] = f.replace('.bin', '').split('_');
    idx[`${cfg}|${seed}`] = arr.map((x) => ({ id: x.id, ok: x.ok && x.replayIdx === x.idx, dis: x.dis }));
  }
  fs.writeFileSync(path.join(TMP, 'snap-index.json'), JSON.stringify(idx));
}
const all = positions();
const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).id) : []);
const todo = all.filter((id) => !done.has(id));
console.error(`[replay ${TAG}/${SET}] ${all.length} positions, ${todo.length} to do`);
if (todo.length) {
  const parts = Array.from({ length: PARTS }, (_, i) => todo.filter((_, j) => j % PARTS === i)).filter((p) => p.length);
  await Promise.all(parts.map((p) => new Promise((res) => {
    const c = spawn(process.execPath, [process.argv[1], `--set=${SET}`, `--tag=${TAG}`, '--child=1', `--ids=${JSON.stringify(p)}`, `--decide=${args.decide || 'current'}`], { stdio: ['ignore', 'inherit', 'inherit'], env: process.env });
    c.on('exit', res);
  })));
}
const rows = fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => all.includes(r.id));

// MC：新 Jev / 新 decide 着法若不是旧两者之一 → rollout（vs 旧 decide 着法）
const mcById = new Map(audit.mc.filter((m) => !m.skip).map((m) => [m.id, m]));
const MCF = OUT.replace('.jsonl', '-mc.jsonl');
const mcDone = new Map(fs.existsSync(MCF) ? fs.readFileSync(MCF, 'utf8').split('\n').filter(Boolean).map((l) => { const o = JSON.parse(l); return [o.id + '|' + o.key, o]; }) : []);
if (args.mc) {
  const need = [];
  for (const r of rows) {
    if (r.skip === 'badSnap') continue;
    const s = loadSnap(r.id);
    const hand = s.g.round.hands[s.seat];
    const byStr = (str) => { // 旧着法字符串 → 牌 id（同牌面任取）
      if (str === 'pass') return { ids: [], combo: { type: 'pass' } };
      const m = str.match(/^([^:]+):([^{]*)\{(.*)\}$/);
      const left = hand.slice(); const ids = [];
      for (const cs of m[3].split(' ')) { const i = left.findIndex((c) => L.formatCard(c) === cs); ids.push(left[i].id); left.splice(i, 1); }
      return { ids, combo: { type: m[1], rank: m[2] || null } };
    };
    const tests = [];
    for (const [key, str, ids, combo] of [['newJev', r.newJev, r.newJevIds, r.newJevCombo], ['newDecide', r.newDecide, r.newDecideIds, r.newDecideCombo]]) {
      if (!str || norm(str) === norm(r.oldDecide) || norm(str) === norm(r.oldJev)) continue;
      if (mcDone.has(r.id + '|' + norm(str))) continue;
      tests.push({ key: norm(str), ids: ids || byStr(str).ids, combo: combo || byStr(str).combo });
    }
    if (tests.length) need.push({ id: r.id, moves: [{ key: norm(r.oldDecide), ...byStr(r.oldDecide) }, ...tests.filter((t, i, a) => a.findIndex((u) => u.key === t.key) === i)] });
  }
  console.error(`[replay mc] ${need.length} positions need rollouts`);
  const tasks = [];
  for (let i = 0; i < need.length; i += 2) tasks.push({ kind: 'snapmc', k: Number(args.k || 40), version: 'post-selfplay-r8', positions: need.slice(i, i + 2) });
  if (tasks.length) {
    await L.loadDecide('post-selfplay-r8');
    const res = await runTasks(tasks, Number(args.threads || 7), (d, n) => { if (d % 5 === 0 || d === n) console.error(`[replay mc] ${d}/${n}`); }, { ckpt: OUT.replace('.jsonl', '-mcckpt.jsonl') });
    for (const x of res.flatMap((r) => r.snapmc)) {
      const v0 = x.vals[0];
      for (let j = 1; j < x.keys.length; j++) {
        const d = []; for (let k = 0; k < v0.length; k++) if (v0[k] != null && x.vals[j][k] != null) d.push(x.vals[j][k] - v0[k]);
        const m = d.reduce((a, b) => a + b, 0) / (d.length || 1);
        const sd = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, d.length - 1));
        const o = { id: x.id, key: x.keys[j], diff: m, t: sd > 0 ? m / (sd / Math.sqrt(d.length)) : m > 0 ? 99 : m < 0 ? -99 : 0, n: d.length };
        fs.appendFileSync(MCF, JSON.stringify(o) + '\n');
        mcDone.set(o.id + '|' + o.key, o);
      }
    }
  }
}

// 汇总：新着法相对旧 decide 着法的价值（同旧 decide → 0；同旧 Jev → 旧 MC diff；新 → 新 MC）
const valueOf = (r, str) => {
  if (norm(str) === norm(r.oldDecide)) return { v: 0, t: 0, src: 'oldDecide' };
  const m = mcById.get(r.id);
  if (m && norm(str) === norm(r.oldJev)) return { v: m.diff, t: m.t, src: 'oldJev' };
  const x = mcDone.get(r.id + '|' + norm(str));
  return x ? { v: x.diff, t: x.t, src: 'new' } : null;
};
const ok = rows.filter((r) => r.skip !== 'badSnap');
const verdict = (v) => (v.v >= 0.3 && v.t >= 2 ? 'better' : v.v <= -0.3 && v.t <= -2 ? 'worse' : 'tie');
const sum = { set: SET, tag: TAG, n: ok.length, errors: ok.filter((r) => r.error).length, cached: ok.filter((r) => r.cached).length };
if (SET === 'mc') {
  const cats = { all: ok, singleLead: ok.filter((r) => { const m = mcById.get(r.id); return m && m.rel === 'lead' && /→single$/.test(m.cat || ''); }), jevBetter: ok.filter((r) => mcById.get(r.id)?.verdict === 'Jev'), decideBetter: ok.filter((r) => mcById.get(r.id)?.verdict === 'decide'), bomb: ok.filter((r) => /bomb/.test(r.oldDecide + r.oldJev)) };
  for (const [c, arr] of Object.entries(cats)) {
    const vj = arr.map((r) => valueOf(r, r.newJev)).filter(Boolean), vd = arr.map((r) => valueOf(r, r.newDecide)).filter(Boolean);
    const vo = arr.map((r) => mcById.get(r.id)?.diff ?? 0);
    const mean = (a) => a.reduce((s, x) => s + (x.v ?? x), 0) / (a.length || 1);
    sum[c] = {
      n: arr.length,
      newJev: { valued: vj.length, mean: +mean(vj).toFixed(3), sameOldDecide: arr.filter((r) => norm(r.newJev) === norm(r.oldDecide)).length, sameOldJev: arr.filter((r) => norm(r.newJev) === norm(r.oldJev)).length, better: vj.filter((v) => verdict(v) === 'better').length, worse: vj.filter((v) => verdict(v) === 'worse').length },
      oldJev: { mean: +mean(vo).toFixed(3) },
      newDecide: { valued: vd.length, mean: +mean(vd).toFixed(3), changed: arr.filter((r) => norm(r.newDecide) !== norm(r.oldDecide)).length },
      // 判定明确的局面里，新 Jev 是否选到 MC 更好的那手
      matchBetter: c === 'jevBetter' ? arr.filter((r) => norm(r.newJev) === norm(r.oldJev)).length : c === 'decideBetter' ? arr.filter((r) => norm(r.newJev) === norm(r.oldDecide)).length : undefined,
    };
  }
} else {
  sum.agreeStill = ok.filter((r) => norm(r.newJev) === norm(r.oldJev)).length;
  sum.newDisagreeVsNewDecide = ok.filter((r) => norm(r.newJev) !== norm(r.newDecide)).length;
  const vj = ok.map((r) => valueOf(r, r.newJev)).filter(Boolean);
  sum.valued = vj.length; sum.meanVsOldDecide = +(vj.reduce((s, x) => s + x.v, 0) / (vj.length || 1)).toFixed(3);
  sum.better = vj.filter((v) => verdict(v) === 'better').length; sum.worse = vj.filter((v) => verdict(v) === 'worse').length;
}
sum.disagreeNewJevVsNewDecide = ok.filter((r) => norm(r.newJev) !== norm(r.newDecide)).length;
console.log(JSON.stringify(sum, null, 1));
fs.writeFileSync(OUT.replace('.jsonl', '-summary.json'), JSON.stringify(sum, null, 1));
