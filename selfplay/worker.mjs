/** worker_threads 入口：跑对局（采集逐手记录）或 surprise rollout。 */
import { parentPort, workerData } from 'node:worker_threads';
import * as L from './lib.mjs';
import { shouldCollectBeamWork, normalizeBeamWorkForRecord } from '../scripts/experiments/r169/beam-work-record.mjs';
import { sharedSearchManifest } from '../scripts/experiments/r169/search-beam-manifest.mjs';

const { task } = workerData;

function cardStr(cs) {
  return (cs || []).map(L.formatCard).join(' ');
}
function comboStr(c) {
  return !c || c.type === 'pass' ? 'pass' : `${c.type}:${c.rank ?? ''}`;
}

async function runDeals() {
  const out = { decisions: [], deals: [], violations: [] };
  const searchSha = shouldCollectBeamWork() ? sharedSearchManifest().sha256 : null;
  for (const job of task.jobs) {
    const agents = [];
    for (let s = 0; s < 4; s++) agents.push(await L.makeAgent(job.specs[s], job.seed * 4 + s));
    const recs = task.collect ? [] : null;
    const bombsPlayed = [0, 0, 0, 0];
    const onDecision = (d) => {
        const lv = d.g.match.levelRank;
        const mv = d.move;
        const pass = L.isPassMove(mv);
        if (!pass && L.isBombLike(mv.combo)) bombsPlayed[d.seat] += 1;
        if (!recs) return;
        const hand = d.before;
        const n = hand.length;
        const seat = d.seat;
        const nat = L.naturalCounts(hand, lv);
        const rel = d.leading ? 'lead' : d.prevSeat === (seat + 2) % 4 ? 'partner' : 'enemy';
        const ec = [d.countsBefore[(seat + 1) % 4], d.countsBefore[(seat + 3) % 4]];
        const live = ec.filter((x) => x > 0);
        const r = {
          id: `${job.cfg}|${d.dealSeed ?? job.seed}|${d.step}`,
          cfg: job.cfg, spec: d.spec, seat, step: d.step, n, phase: L.phaseOf(n), rel, lv,
          enemyMin: live.length ? Math.min(...live) : 0,
          enemyMax: live.length ? Math.max(...live) : 0,
          partnerN: d.countsBefore[(seat + 2) % 4],
          prevSeatN: d.prevSeat == null ? null : d.countsBefore[d.prevSeat],
          nextEnemyN: d.countsBefore[(seat + 1) % 4],
          prevType: d.prevCombo?.type ?? null, prevRank: d.prevCombo?.rank ?? null,
          prevStr: d.prevCombo?.rank != null ? L.singleStrength(d.prevCombo.rank, lv) : null,
          prevBomb: d.prevCombo ? L.isBombLike(d.prevCombo) : false,
          pass,
          type: pass ? 'pass' : mv.combo.type, rank: pass ? null : mv.combo.rank ?? null, size: pass ? 0 : mv.cards.length,
          str: !pass && mv.combo.rank != null ? L.singleStrength(mv.combo.rank, lv) : null,
          bomb: !pass && L.isBombLike(mv.combo),
          ctrlUsed: pass ? 0 : mv.cards.filter((c) => L.isControlCard(c, lv)).length,
          wildUsed: pass ? 0 : mv.cards.filter((c) => !L.isJokerRank(c.rank) && L.isWildCard(c, lv)).length,
          breaksBomb: !pass && !L.isBombLike(mv.combo) && mv.cards.some((c) => !L.isJokerRank(c.rank) && !L.isWildCard(c, lv) && (nat.get(c.rank) || 0) >= 4 &&
            (nat.get(c.rank) || 0) - mv.cards.filter((x) => x.rank === c.rank && !L.isWildCard(x, lv)).length < 4),
          breaksPair: !pass && mv.combo.type === 'single' && (nat.get(mv.cards[0].rank) || 0) >= 2,
          ctrlHeld: hand.filter((c) => L.isControlCard(c, lv)).length,
          ms: Math.round(d.ms * 10) / 10,
          hand: cardStr(L.sortHand(hand, lv)),
          moveStr: pass ? 'pass' : `${comboStr(mv.combo)}{${cardStr(mv.cards)}}`,
          prevStr2: comboStr(d.prevCombo),
          tags: d.rec?.tags ? d.rec.tags.slice(0, 8) : null,
          nCands: d.rec?.scored ? d.rec.scored.length : null,
        };
        if (d.rec?.jev || d.rec?.startlux) {
          // Jev / StartLux 代理：是否调用、选了第几个候选、decide 原本选什么
          const j = d.rec.jev || d.rec.startlux, dm = d.rec.decideMove;
          const pack = { used: !!j.used, skip: j.skip || null, error: j.error || null, cached: !!j.cached, nCands: j.nCands, idx: j.idx ?? null, decideIdx: j.decideIdx ?? null, ms: j.ms ?? null, choice: j.choice || null, cands: j.used && j.idx !== j.decideIdx ? j.cands : undefined };
          if (d.rec.jev) r.jev = pack;
          if (d.rec.startlux) r.startlux = pack;
          r.decideMoveStr = !dm || L.isPassMove(dm) ? 'pass' : `${comboStr(dm.combo)}{${cardStr(dm.cards)}}`;
          const disagree = !!j.used && j.idx !== j.decideIdx;
          if (d.rec.jev) r.jevDisagree = disagree;
          if (d.rec.startlux) r.startluxDisagree = disagree;
        }
        // 合法着法相关（只在需要时算）
        const legal = L.legalMoves(hand, d.leading ? null : d.prevCombo, lv, d.leading);
        r.canGoOut = legal.some((m) => m.cards.length === n);
        r.legalNonPass = legal.filter((m) => m.cards.length).length;
        r.bombAvail = !d.leading && legal.some((m) => m.cards.length && L.isBombLike(m.combo));
        r.nonBombAvail = !d.leading && legal.some((m) => m.cards.length && !L.isBombLike(m.combo));
        if (rel === 'partner') {
          // 压对家用的非炸弹着法：是否拆天然炸弹（同点 ≥4 张）/ 拆三张（同点正好 3 张、只用其中一部分）
          const usedOf = (m, rk) => m.cards.filter((x) => x.rank === rk && !L.isWildCard(x, lv)).length;
          const breaksN = (m, pred) => m.cards.some((c) => !L.isJokerRank(c.rank) && !L.isWildCard(c, lv) && pred(nat.get(c.rank) || 0, usedOf(m, c.rank)));
          const nb = legal.filter((m) => m.cards.length && !L.isBombLike(m.combo));
          const clean = nb.filter((m) => !breaksN(m, (k, u) => k >= 4 && k - u < 4));
          const cleanNoTriple = clean.filter((m) => !breaksN(m, (k, u) => k === 3 && u < 3));
          r.nonBombCleanAvail = clean.length > 0;
          r.nonBombNoStructAvail = cleanNoTriple.length > 0;
          const ms = (m) => `${comboStr(m.combo)}{${cardStr(m.cards)}}`;
          r.cleanEx = clean.slice(0, 3).map(ms).join(' / ');
          r.playBreaksBomb = r.breaksBomb;
        }
        if (d.leading) r.structAvail = legal.some((m) => ['straight', 'pairSeq', 'tripleSeq'].includes(m.combo.type));
        if (d.dealIdx != null) { r.dealIdx = d.dealIdx; r.tribDeal = !!d.g.tributeState?.plan?.gives?.length; }
        if (shouldCollectBeamWork()) r.searchBeamWork = normalizeBeamWorkForRecord(globalThis.__GD_SEARCH_BEAM_WORK__, searchSha);
        recs.push(r);
    };
    // job.match = K：进贡比赛（K 副连续，名次/级数带到下一副）；否则独立单副
    const results = job.match
      ? L.playMatch(job.seed, agents, { deals: job.match, onDecision })
      : [{ ...L.playDeal(job.seed, agents, { onDecision }), seed: job.seed }];
    for (const res of results) {
      const g = res.g;
      const lv = g.match.levelRank;
      const endHands = g.round.hands.map((h) => ({
        n: h.length,
        bomb: h.length >= 4 ? L.handHasBomb(h, lv) : false,
        ctrl: h.filter((c) => L.isControlCard(c, lv)).length,
        minPlays: h.length ? L.minPlays(h, lv) : 0,
        hand: cardStr(h),
      }));
      out.deals.push({ cfg: job.cfg, seed: res.seed, matchSeed: job.match ? job.seed : null, dealIdx: res.i ?? null, pre: res.pre || null, tribute: res.tribute || null,
        specs: job.specs, order: res.order, points: res.points, steps: res.steps, lv, endHands, bombsPlayed: res.i == null || res.i === results.length - 1 ? bombsPlayed : null });
      out.violations.push(...res.violations.map((v) => ({ ...v, cfg: job.cfg })));
    }
    if (recs) out.decisions.push(...recs);
  }
  const specsUsed = task.jobs.flatMap((j) => j.specs.map((x) => x.split('#')[0]));
  if (specsUsed.includes('jev')) {
    const { jevStats } = await import('./jevAgent.mjs');
    out.jev = jevStats();
  }
  if (specsUsed.includes('startlux')) {
    const { startluxStats } = await import('./startluxAgent.mjs');
    out.startlux = startluxStats();
  }
  return out;
}

/** Jev 与 decide 分歧局面：复现（Jev 走缓存，JEV_NO_API=1 时不发请求）→ 两个着法各做确定化 rollout（后续全用 decide）。 */
async function runJevMC() {
  const decide = await L.loadDecide('current');
  const results = [];
  for (const pos of task.positions) {
    const agents = [];
    for (let s = 0; s < 4; s++) agents.push(await L.makeAgent(pos.specs[s], pos.seed * 4 + s));
    const st = L.playDeal(pos.seed, agents, { stopAt: pos.step, pre: pos.pre || null });
    if (!st.stopped) { results.push({ id: pos.id, skip: 'notStopped' }); continue; }
    const g = st.g;
    const seat = g.round.currentSeat;
    const hand = cardStr(L.sortHand(g.round.hands[seat], g.match.levelRank));
    if (seat !== pos.seat || hand !== pos.hand) { results.push({ id: pos.id, skip: 'diverged' }); continue; }
    const rec = agents[seat].act(g, seat);
    const jm = rec.move, dm = rec.decideMove;
    const key = (m) => (m.cards?.length ? m.cards.map((c) => c.id).sort().join(',') + m.combo.type : 'pass');
    if (!rec.jev?.used || key(jm) === key(dm)) { results.push({ id: pos.id, skip: 'noDisagree' }); continue; }
    const cands = [dm, jm];
    const vals = [[], []];
    const places = [[], []];
    for (let k = 0; k < task.k; k++) {
      let a = (pos.seed * 1000003 + pos.step * 7919 + k * 104729) >>> 0;
      for (const i of [0, 1]) {
        let b = a;
        const rng = () => { b = (b + 0x6d2b79f5) >>> 0; let t = b; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        const gc = L.determinize(g, seat, rng);
        const r = L.rollout(gc, seat, cands[i], decide);
        vals[i][k] = r ? r.pts : null;
        places[i][k] = r ? r.place : null;
      }
    }
    const d = [];
    for (let k = 0; k < task.k; k++) if (vals[0][k] != null && vals[1][k] != null) d.push(vals[1][k] - vals[0][k]);
    const m = d.reduce((x, y) => x + y, 0) / (d.length || 1);
    const sd = Math.sqrt(d.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, d.length - 1));
    const mean = (v) => { const u = v.filter((x) => x != null); return u.reduce((x, y) => x + y, 0) / (u.length || 1); };
    const mstr = (mv) => (mv.cards?.length ? `${comboStr(mv.combo)}{${cardStr(mv.cards)}}` : 'pass');
    const sc = (mv) => (rec.scored || []).find((s) => key(s.move) === key(mv))?.score ?? null;
    results.push({
      id: pos.id, seat, n: g.round.hands[seat].length, leading: L.isLeading(g), rel: pos.rel, prev: pos.prev, counts: g.round.hands.map((h) => h.length), lv: g.match.levelRank, hand,
      decideMove: mstr(dm), jevMove: mstr(jm), jevLabel: rec.jev.choice, decideLabel: rec.jev.cands?.[rec.jev.decideIdx] ?? null, cands: rec.jev.cands,
      decideScore: sc(dm), jevScore: sc(jm), decideTags: (rec.scored || []).find((s) => key(s.move) === key(dm))?.tags || rec.tags || [], jevTags: (rec.scored || []).find((s) => key(s.move) === key(jm))?.tags || [],
      diff: m, t: sd > 0 ? m / (sd / Math.sqrt(d.length)) : m > 0 ? 99 : m < 0 ? -99 : 0, nSamp: d.length,
      decideMean: mean(vals[0]), jevMean: mean(vals[1]), decidePlace: mean(places[0]), jevPlace: mean(places[1]),
    });
  }
  return { jevmc: results };
}

/** r9：快照局面（selfplay/cache/r9-snap）上对给定着法做确定化 rollout（同 jevmc 的种子），task.version 指定后续 decide。 */
async function runSnapMC() {
  const { loadSnap } = await import('./diag/r9-pos.mjs');
  if (task.env) for (const [k, v] of Object.entries(task.env)) { if (v == null) delete process.env[k]; else process.env[k] = String(v); } // r15+：续打开关（固定计划续打）
  const decide = await L.loadDecide(task.version || 'current');
  const out = [];
  for (const pos of task.positions) {
    const s = loadSnap(pos.id, task.snapDir || 'r9-snap');
    const g = s.g, seat = s.seat;
    const hand = g.round.hands[seat];
    const moves = pos.moves.map((m) => (m.ids.length ? { cards: m.ids.map((id) => hand.find((c) => c.id === id)), combo: m.combo } : { cards: [], combo: { type: 'pass' } }));
    const seed = Number(pos.id.split('|')[1]), step = Number(pos.id.split('|')[2]);
    const vals = moves.map(() => []);
    for (let k = 0; k < task.k; k++) {
      const a = (seed * 1000003 + step * 7919 + k * 104729) >>> 0;
      for (let i = 0; i < moves.length; i++) {
        let b = a;
        const rng = () => { b = (b + 0x6d2b79f5) >>> 0; let t = b; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        const gc = L.determinize(g, seat, rng);
        const r = L.rollout(gc, seat, moves[i], decide);
        vals[i][k] = r ? r.pts : null;
      }
    }
    out.push({ id: pos.id, keys: pos.moves.map((m) => m.key), vals });
  }
  return { snapmc: out };
}

async function runSurprise() {
  const decide = await L.loadDecide(task.version || 'current');
  const agentsFor = async (specs, seed) => {
    const a = [];
    for (let s = 0; s < 4; s++) a.push(await L.makeAgent(specs[s], seed * 4 + s));
    return a;
  };
  const results = [];
  for (const pos of task.positions) {
    const agents = await agentsFor(pos.specs, pos.seed);
    const st = L.playDeal(pos.seed, agents, { stopAt: pos.step, pre: pos.pre || null });
    if (!st.stopped) continue;
    const g = st.g;
    const seat = g.round.currentSeat;
    const ctx = L.ctxFor(g, seat);
    const rec = decide(ctx);
    const key = (m) => (m.cards.length ? m.cards.map((c) => c.id).sort().join(',') + m.combo.type : 'pass');
    const cands = [rec.move];
    for (const s of rec.scored || []) {
      if (cands.length >= task.maxCands) break;
      if (!cands.some((c) => key(c) === key(s.move))) cands.push(s.move);
    }
    if (!L.isLeading(g) && !cands.some((c) => !c.cards.length)) cands.push({ cards: [], combo: { type: 'pass' } });
    if (task.extraLegal) {
      // 诊断用：补上被硬过滤掉的合法非炸弹着法（每个点数/牌型取一个）
      const seen = new Set(cands.map((c) => (c.cards.length ? `${c.combo.type}:${c.combo.rank}` : 'pass')));
      for (const m of L.legalMoves(ctx.hand, ctx.leading ? null : ctx.previous, g.match.levelRank, ctx.leading)) {
        if (cands.length >= task.maxCands + task.extraLegal) break;
        if (!m.cards.length || L.isBombLike(m.combo)) continue;
        const k = `${m.combo.type}:${m.combo.rank}`;
        if (seen.has(k)) continue;
        seen.add(k);
        cands.push(m);
      }
    }
    const rng0 = (k) => {
      let a = (pos.seed * 1000003 + pos.step * 7919 + k * 104729) >>> 0;
      return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };
    const vals = cands.map(() => []);
    const sample = (from, to, idxs) => {
      for (let k = from; k < to; k++) {
        for (const i of idxs) {
          const gc = L.determinize(g, seat, rng0(k));
          const r = L.rollout(gc, seat, cands[i], decide);
          vals[i][k] = r ? r.pts : null;
        }
      }
    };
    sample(0, task.k1, cands.map((_, i) => i));
    const stats = (i, j) => {
      const d = [];
      for (let k = 0; k < vals[i].length; k++) if (vals[i][k] != null && vals[j][k] != null) d.push(vals[i][k] - vals[j][k]);
      const m = d.reduce((a, b) => a + b, 0) / (d.length || 1);
      const sd = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, d.length - 1));
      return { diff: m, t: sd > 0 ? m / (sd / Math.sqrt(d.length)) : m > 0 ? 99 : 0, n: d.length };
    };
    let best = null;
    for (let i = 1; i < cands.length; i++) {
      let s = stats(i, 0);
      if (s.diff >= task.stage2Diff) {
        sample(task.k1, task.k1 + task.k2, [0, i]);
        s = stats(i, 0);
      }
      if (!best || s.diff > best.diff) best = { i, ...s };
    }
    const mean = (i) => {
      const v = vals[i].filter((x) => x != null);
      return v.reduce((a, b) => a + b, 0) / (v.length || 1);
    };
    const mstr = (m) => (m.cards.length ? `${comboStr(m.combo)}{${cardStr(m.cards)}}` : 'pass');
    results.push({
      id: `${pos.cfg}|${pos.seed}|${pos.step}`,
      seat, n: ctx.hand.length, leading: ctx.leading, prev: comboStr(ctx.previous),
      rel: ctx.leading ? 'lead' : g.round.lastPlayer === (seat + 2) % 4 ? 'partner' : 'enemy',
      counts: g.round.hands.map((h) => h.length), lv: g.match.levelRank,
      hand: cardStr(ctx.hand),
      chosen: mstr(cands[0]), chosenMean: mean(0), chosenTags: rec.tags,
      alts: cands.slice(1).map((m, j) => ({ move: mstr(m), mean: mean(j + 1), tags: (rec.scored || []).find((s) => key(s.move) === key(m))?.tags || [] })),
      best: best ? { move: mstr(cands[best.i]), diff: best.diff, t: best.t, n: best.n } : null,
    });
  }
  return { surprises: results };
}

/** Eval-only: prefix jobs + stopAt target decide trace (worker_threads path). */
async function runTraceTarget() {
  const { runTraceTarget: run } = await import('../scripts/experiments/r169/trace-target-core.mjs');
  return run(task);
}

const fn = task.kind === 'traceTarget' ? runTraceTarget
  : task.kind === 'surprise' ? runSurprise : task.kind === 'jevmc' ? runJevMC : task.kind === 'snapmc' ? runSnapMC : runDeals;
fn().then((r) => parentPort.postMessage(r)).catch((e) => parentPort.postMessage({ error: String(e && e.stack || e) }));
