/**
 * r11：从 StartLux27 200 副擂台（logs/sl27-arena200-ckpt.jsonl）复现（缓存，STARTLUX_NO_API=1），
 * 存 StartLux 跟敌（rel=enemy）分歧局面快照 → selfplay/cache/r11-snap/<cfg>_<seed>.bin（每副一个，可续跑）。
 * 每个快照含 decide 着法与 StartLux 着法（card ids）。 node selfplay/diag/r11-snap.mjs --part=0 --parts=6
 */
import fs from 'node:fs'; import path from 'node:path'; import v8 from 'node:v8';
process.env.STARTLUX_NO_API = '1'; process.env.STARTLUX_BACKEND = 'bamboo';
const L = await import('../lib.mjs');
const args = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, v] = s.replace(/^--/, '').split('='); return [k, v ?? '1']; }));
const PART = Number(args.part || 0), PARTS = Number(args.parts || 1);
const OUT = path.join(L.ROOT, 'selfplay', 'cache', 'r11-snap'); fs.mkdirSync(OUT, { recursive: true });
const lines = fs.readFileSync(path.join(L.ROOT, 'selfplay', 'logs', 'sl27-arena200-ckpt.jsonl'), 'utf8').split('\n').filter(Boolean);
const deals = [], want = new Map();
for (const x of lines) {
  const o = JSON.parse(x); deals.push(...o.r.deals);
  for (const d of o.r.decisions) if (d.startlux?.used && d.startluxDisagree && d.rel === 'enemy') {
    const k = d.id.split('|').slice(0, 2).join('|');
    if (!want.has(k)) want.set(k, new Map());
    want.get(k).set(d.step, { id: d.id, seat: d.seat, hand: d.hand, meta: Object.fromEntries(Object.entries(d).filter(([kk]) => kk !== 'hand')) });
  }
}
deals.sort((a, b) => (a.cfg + a.seed < b.cfg + b.seed ? -1 : 1));
const ids = (m) => (m?.cards?.length ? m.cards.map((c) => c.id) : []);
let bad = 0;
for (let i = PART; i < deals.length; i += PARTS) {
  const dl = deals[i]; const key = `${dl.cfg}|${dl.seed}`;
  const file = path.join(OUT, `${dl.cfg}_${dl.seed}.bin`);
  if (fs.existsSync(file) || !want.has(key)) continue;
  const W = want.get(key); const agents = [];
  for (let s = 0; s < 4; s++) agents.push(await L.makeAgent(dl.specs[s], dl.seed * 4 + s));
  let step = 0; const snaps = [];
  const wrapped = agents.map((a) => ({ ...a, act: (g, seat) => {
    const w = W.get(step); let snap = null;
    if (w) {
      const hs = L.sortHand(g.round.hands[seat], g.match.levelRank).map(L.formatCard).join(' ');
      const { rng, ...rest } = g;
      snap = { ...w, ok: hs === w.hand && seat === w.seat, g: structuredClone(rest) };
      snaps.push(snap);
    }
    const r = a.act(g, seat);
    if (snap) { snap.slIds = ids(r.move); snap.slCombo = r.move.combo; snap.dIds = ids(r.decideMove); snap.dCombo = r.decideMove?.combo; snap.replayDis = ids(r.move).join() !== ids(r.decideMove).join(); if (!snap.replayDis || !r.startlux?.used) snap.ok = false; }
    step++; return r;
  } }));
  L.playDeal(dl.seed, wrapped, { pre: dl.pre });
  const b = snaps.filter((s) => !s.ok).length; bad += b;
  fs.writeFileSync(file + '.tmp', v8.serialize(snaps)); fs.renameSync(file + '.tmp', file);
  console.error(`[snap p${PART}] ${key} snaps=${snaps.length} bad=${b}`);
}
console.error(`[snap p${PART}] done bad ${bad}`);
