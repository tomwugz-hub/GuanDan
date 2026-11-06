/**
 * r9：把 jev-audit（200 副擂台）里 Jev 调用过的局面存成快照（v8 序列化的 g，去掉 rng），供新提示词离线重放。
 * 用当前（未改）代码 + Jev 缓存复现（JEV_NO_API=1）。可续跑：每副一个文件 selfplay/cache/r9-snap/<cfg>_<seed>.bin。
 *   node selfplay/diag/r9-snap.mjs --part=0 --parts=7
 */
import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import * as L from '../lib.mjs';
process.env.JEV_NO_API = '1';
const args = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, v] = s.replace(/^--/, '').split('='); return [k, v ?? '1']; }));
const PART = Number(args.part || 0), PARTS = Number(args.parts || 1);
const OUT = path.join(L.ROOT, 'selfplay', 'cache', 'r9-snap');
const lines = fs.readFileSync(path.join(L.ROOT, 'selfplay', 'logs', 'jev-arena200-ckpt.jsonl'), 'utf8').split('\n').filter(Boolean);
const deals = [], want = new Map();
for (const x of lines) {
  const o = JSON.parse(x);
  deals.push(...o.r.deals);
  for (const d of o.r.decisions) if (d.jev?.used) {
    const k = d.id.split('|').slice(0, 2).join('|');
    if (!want.has(k)) want.set(k, new Map());
    want.get(k).set(d.step, { id: d.id, seat: d.seat, hand: d.hand, dis: !!d.jevDisagree, rel: d.rel, phase: d.phase, idx: d.jev.idx, decideIdx: d.jev.decideIdx, cands: d.jev.cands || null, choice: d.jev.choice, moveStr: d.moveStr, decideMoveStr: d.decideMoveStr });
  }
}
deals.sort((a, b) => (a.cfg + a.seed < b.cfg + b.seed ? -1 : 1));
let done = 0, bad = 0;
for (let i = PART; i < deals.length; i += PARTS) {
  const dl = deals[i];
  const key = `${dl.cfg}|${dl.seed}`;
  const file = path.join(OUT, `${dl.cfg}_${dl.seed}.bin`);
  if (fs.existsSync(file) || !want.has(key)) continue;
  const W = want.get(key);
  const agents = [];
  for (let s = 0; s < 4; s++) agents.push(await L.makeAgent(dl.specs[s], dl.seed * 4 + s));
  let step = 0;
  const snaps = [];
  const wrapped = agents.map((a) => ({ ...a, act: (g, seat) => {
    const w = W.get(step);
    if (w) {
      const hand = g.round.hands[seat].map(L.formatCard);
      const hs = L.sortHand(g.round.hands[seat], g.match.levelRank).map(L.formatCard).join(' ');
      const { rng, ...rest } = g;
      snaps.push({ ...w, ok: hs === w.hand && seat === w.seat, g: structuredClone(rest) });
      void hand;
    }
    const r = a.act(g, seat);
    if (w) { const last = snaps[snaps.length - 1]; last.replayIdx = r.jev?.idx ?? null; last.replayUsed = !!r.jev?.used; }
    step++;
    return r;
  } }));
  L.playDeal(dl.seed, wrapped, { pre: dl.pre });
  bad += snaps.filter((s) => !s.ok || s.replayIdx !== s.idx).length;
  fs.writeFileSync(file + '.tmp', v8.serialize(snaps));
  fs.renameSync(file + '.tmp', file);
  done++;
  console.error(`[snap p${PART}] ${key} snaps=${snaps.length} bad=${snaps.filter((s) => !s.ok || s.replayIdx !== s.idx).length}`);
}
console.error(`[snap p${PART}] done ${done} bad ${bad}`);
