/**
 * r10：从 jev-final-r9 擂台 ckpt 复现局面，跑 decide 打分。
 *   DECIDE_DEBUG=12 node selfplay/diag/r10-pos.mjs <id> [version]
 *   node selfplay/diag/r10-pos.mjs --list=bomb|pass|end|all
 */
import fs from 'node:fs';
import path from 'node:path';
import * as L from '../lib.mjs';

const ROOT = L.ROOT;
const IDS = {
  bomb: ['arenaA1|67200531|63', 'arenaA1|67200595|37', 'arenaA0|67200900|77', 'arenaA1|67200117|67'],
  pass: ['arenaA1|67200022|45', 'arenaA1|67200016|49', 'arenaA1|67200469|11', 'arenaA0|67200839|74', 'arenaA1|67200114|25'],
  end: ['arenaA1|67200164|94', 'arenaA0|67200784|73', 'arenaA1|67200770|79'],
};

function findDealMeta(id) {
  const [cfg, seedStr, stepStr] = id.split('|');
  const seed = Number(seedStr), step = Number(stepStr);
  const arenaPath = path.join(ROOT, 'selfplay/logs/jev-final-r9-ckpt.jsonl');
  for (const line of fs.readFileSync(arenaPath, 'utf8').split('\n').filter(Boolean)) {
    const o = JSON.parse(line);
    const deal = (o.r?.deals || []).find((d) => d.cfg === cfg && d.seed === seed);
    const dec = (o.r?.decisions || []).find((d) => d.id === id);
    if (deal && dec) return { deal, dec, seed, step, cfg };
  }
  return null;
}

export async function loadPos(id) {
  const meta = findDealMeta(id);
  if (!meta) throw new Error('no meta for ' + id);
  const { deal, seed, step } = meta;
  // Replay with decide-only agents so we don't need Jev cache; may diverge.
  // Prefer original specs with JEV_NO_API=1 (cache).
  process.env.JEV_NO_API = '1';
  const agents = [];
  for (let s = 0; s < 4; s++) agents.push(await L.makeAgent(deal.specs[s], seed * 4 + s));
  const st = L.playDeal(seed, agents, { stopAt: step, pre: deal.pre || null });
  if (!st.stopped) throw new Error('not stopped ' + id);
  const g = st.g;
  const seat = g.round.currentSeat;
  const hand = L.sortHand(g.round.hands[seat], g.match.levelRank).map(L.formatCard).join(' ');
  const ok = seat === meta.dec.seat && hand === meta.dec.hand;
  return { g, seat, meta, hand, ok };
}

if (process.argv[1]?.endsWith('r10-pos.mjs')) {
  const arg = process.argv[2] || '';
  if (arg.startsWith('--list=')) {
    const k = arg.slice(7);
    const list = k === 'all' ? [...IDS.bomb, ...IDS.pass, ...IDS.end] : IDS[k] || [];
    for (const id of list) console.log(id);
    process.exit(0);
  }
  const id = arg;
  const version = process.argv[3] || 'current';
  const dbg = process.env.DECIDE_DEBUG || '14';
  // suppress during rebuild
  delete process.env.DECIDE_DEBUG;
  const { g, seat, meta, hand, ok } = await loadPos(id);
  process.env.DECIDE_DEBUG = dbg;
  const d = await L.loadDecide(version);
  const ctx = L.ctxFor(g, seat);
  console.log(JSON.stringify({
    id, ok, seat, hand, counts: g.round.hands.map((h) => h.length),
    lv: g.match.levelRank, leading: ctx.leading,
    prev: ctx.previous ? `${ctx.previous.type}:${ctx.previous.rank}` : 'pass',
    expectDecide: meta.dec.moveStr, expectJev: meta.dec.jev?.choice || meta.dec.decideMoveStr,
    jevDisagree: meta.dec.jevDisagree,
  }));
  const r = d(ctx);
  const fmt = (mv) => (!mv?.cards?.length ? 'pass' : `${mv.combo.type}:${mv.combo.rank}{${mv.cards.map(L.formatCard).join(' ')}}`);
  console.log('decide ->', fmt(r.move), 'tags', (r.tags || []).join(','));
  const scored = r.scored || [];
  for (const s of scored.slice(0, Number(dbg))) {
    console.log(String(s.score.toFixed(1)).padStart(8), fmt(s.move), (s.tags || []).join(','));
  }
}
