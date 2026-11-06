/** r12 聚类：bomb−pass（配对，每局面 k 次均值），按 decide 选择 × 特征分组，95%CI（局面间）。 node selfplay/diag/r12-cluster.mjs > logs/r12-cluster.txt */
import fs from 'node:fs'; import v8 from 'node:v8';
const R = '/workspace/guandan-coach/selfplay', D = R + '/cache/r12-snap';
const meta = {}; for (const f of fs.readdirSync(D).filter((f) => f.endsWith('.bin'))) for (const s of v8.deserialize(fs.readFileSync(D + '/' + f))) meta[s.id] = s;
let rows = []; const out = R + '/logs/r12-mc.jsonl';
if (fs.existsSync(out) && !process.argv.includes('--ckpt')) rows = fs.readFileSync(out, 'utf8').trim().split('\n').map(JSON.parse);
else for (const l of fs.readFileSync(R + '/logs/r12-mc-ckpt.jsonl', 'utf8').trim().split('\n')) { try { rows.push(...JSON.parse(l).r.snapmc); } catch {} }
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const pair = (a, b) => { const d = []; for (let i = 0; i < a.length; i++) if (a[i] != null && b[i] != null) d.push(a[i] - b[i]); const m = mean(d); return { m, se: Math.sqrt(mean(d.map((x) => (x - m) ** 2)) / d.length) }; };
const recs = rows.map((r) => {
  const s = meta[r.id], M = s.meta, seat = s.seat; const alias = r.alias || (() => { const ms = []; const add = (key, ids) => { const k = ids.slice().sort().join(','); const e = ms.find((m) => m.k === k); if (e) e.a.push(key); else ms.push({ k, a: [key] }); }; add('decide', s.dIds); add('bomb', s.bIds); add('pass', []); if (s.nIds.length) add('normal', s.nIds); return ms.map((m) => m.a); })();
  const v = (key) => r.vals[alias.findIndex((a) => a.includes(key))];
  const bp = pair(v('bomb'), v('pass')); const np = s.nIds.length ? pair(v('normal'), v('pass')) : null;
  const bn = s.nIds.length ? pair(v('bomb'), v('normal')) : null;
  const c = M.cnt; const lp = M.lastPlayer, other = lp === (seat + 1) % 4 ? (seat + 3) % 4 : (seat + 1) % 4;
  return { id: r.id, d: s.dKind, bp, np, bn, eL: c[lp], eO: c[other], eNextIsLP: lp === (seat + 1) % 4, p: c[(seat + 2) % 4], n: c[seat], plays: M.plays, bt: M.bombType, bs: M.bombSize, nb: M.nBombs, hasN: M.hasNormal, lt: M.lastType, lv: M.lv,
    eMin: Math.min(...[lp, other].map((x) => c[x]).filter((x) => x > 0)) };
});
fs.writeFileSync(R + '/logs/r12-cluster-recs.json', JSON.stringify(recs));
const grp = (name, f, val = (r) => r.bp) => {
  const g = {}; for (const r of recs) { const k = f(r); if (k == null || !val(r)) continue; (g[k] ??= []).push(r); }
  console.log('\n##', name);
  for (const [k, a] of Object.entries(g).sort()) {
    const ds = a.map((r) => val(r).m); const m = mean(ds), se = Math.sqrt(mean(ds.map((x) => (x - m) ** 2)) / ds.length);
    const pos = a.filter((r) => val(r).m > 2 * val(r).se).length, neg = a.filter((r) => val(r).m < -2 * val(r).se).length;
    const flag = m - 1.96 * se > 0 ? ' **+' : m + 1.96 * se < 0 ? ' **−' : '';
    console.log(k.padEnd(34), 'n', String(a.length).padStart(4), 'Δ', m.toFixed(3).padStart(7), '[', (m - 1.96 * se).toFixed(3), ',', (m + 1.96 * se).toFixed(3), ']', '显著+', pos, '−', neg, flag);
  }
};
const e = (x) => (x >= 3 && x <= 5 ? String(x) : x <= 2 ? (x === 0 ? '0' : '≤2') : '>5');
console.log('total', recs.length, ' Δ = 炸 − 过（升级分/副，decide 续打）');
grp('decide 选择', (r) => r.d);
grp('decide×出牌敌张数', (r) => r.d + ' eL' + e(r.eL));
grp('decide×最少敌张数', (r) => r.d + ' eMin' + e(r.eMin));
grp('decide×出牌敌是否我下家', (r) => r.d + (r.eNextIsLP ? ' 出牌=下家' : ' 出牌=上家'));
grp('decide×出牌敌×上下家', (r) => r.d + ' eL' + e(r.eL) + (r.eNextIsLP ? ' 下家' : ' 上家'));
grp('decide×对家张数', (r) => r.d + ' p' + (r.p === 0 ? '0(已走)' : r.p <= 5 ? '1-5' : r.p <= 12 ? '6-12' : '>12'));
grp('decide×我张数', (r) => r.d + ' n' + (r.n <= 6 ? '≤6' : r.n <= 12 ? '7-12' : '>12'));
grp('decide×手数', (r) => r.d + ' plays' + (r.plays <= 2 ? '≤2' : r.plays <= 4 ? '3-4' : r.plays <= 7 ? '5-7' : '>7'));
grp('decide×炸数', (r) => r.d + ' nb' + (r.nb <= 1 ? '1' : r.nb <= 3 ? '2-3' : '>3'));
grp('decide×炸型', (r) => r.d + ' ' + r.bt + r.bs);
grp('decide×敌出牌型', (r) => r.d + ' ' + r.lt);
grp('decide×能普通压', (r) => r.d + (r.hasN ? ' 可普通压' : ' 只能炸'));
grp('decide=pass ×eL×p', (r) => (r.d === 'pass' ? 'eL' + e(r.eL) + ' p' + (r.p === 0 ? '0' : r.p <= 5 ? '1-5' : '>5') : null));
grp('decide=pass ×eL×plays', (r) => (r.d === 'pass' ? 'eL' + e(r.eL) + ' plays' + (r.plays <= 3 ? '≤3' : r.plays <= 6 ? '4-6' : '>6') : null));
grp('decide=pass ×eL×lt', (r) => (r.d === 'pass' ? 'eL' + e(r.eL) + ' ' + r.lt : null));
grp('decide=bomb ×eL×plays', (r) => (r.d === 'bomb' ? 'eL' + e(r.eL) + ' plays' + (r.plays <= 3 ? '≤3' : r.plays <= 6 ? '4-6' : '>6') : null));
grp('decide=bomb ×eL×lt', (r) => (r.d === 'bomb' ? 'eL' + e(r.eL) + ' ' + r.lt : null));
grp('普通压 − 过 (decide×eL)', (r) => r.d + ' eL' + e(r.eL), (r) => r.np);
grp('炸 − 普通压 (decide×eL)', (r) => r.d + ' eL' + e(r.eL), (r) => r.bn);
