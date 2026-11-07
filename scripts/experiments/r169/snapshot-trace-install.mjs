#!/usr/bin/env node
/**
 * Copy cap2 snapshot and apply eval trace hooks (isolated backup only; not policy/).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = Object.fromEntries(process.argv.slice(2).map((s) => {
  const m = s.replace(/^--/, '').match(/^([^=]+)=(.*)$/s);
  return m ? [m[1], m[2]] : [s.replace(/^--/, ''), '1'];
}));
const src = args.src || 'r169-cap2-current';
const dst = args.dst || 'r169-cap2-current-instrumented';
const srcDir = path.join(ROOT, 'backups', src);
const dstDir = path.join(ROOT, 'backups', dst);

const INDEX_HELPERS = `
// --- eval-only decide trace (GD_EVAL_DECIDE_TRACE=1; snapshot backups/*-instrumented only) ---
function __evalMoveKey(m) {
  if (!m?.cards?.length) return 'pass';
  const ids = m.cards.map((c) => c.id).sort((a, b) => a - b);
  return \`\${m.combo?.type}:\${m.combo?.rank}:{\${ids.join(',')}}\`;
}
function __evalRankedSlice(ranked, n = 48) {
  return ranked.slice(0, n).map((r, i) => ({
    i, key: __evalMoveKey(r.move), score: Math.round(r.score * 1000) / 1000, tags: (r.tags || []).slice(0, 20),
  }));
}
function __evalCtxSummary(ctx) {
  const rc = (ctx.remainingSeatCounts || []).join(',');
  const ranks = new Map();
  for (const c of ctx.hand || []) ranks.set(c.rank, (ranks.get(c.rank) || 0) + 1);
  const handSig = [...ranks.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([r, n]) => \`\${r}x\${n}\`).join(' ');
  return {
    seat: ctx.seat, leading: !!ctx.leading, levelRank: ctx.levelRank, handN: (ctx.hand || []).length, handSig,
    enemyCounts: rc, firstLeadOfDeal: !!ctx.firstLeadOfDeal, previous: ctx.previous?.type ?? null,
  };
}
function __evalEmitDecideTrace(phase, full, extra) {
  if (typeof process === 'undefined' || process.env.GD_EVAL_DECIDE_TRACE !== '1') return;
  if (!globalThis.__GD_EVAL_DECIDE_TRACE_ACTIVE__) return;
  const fn = globalThis.__GD_EVAL_DECIDE_TRACE__;
  if (typeof fn !== 'function') return;
  const meta = (process.env.GD_EVAL_TRACE_META || '').split(':');
  const payload = {
    phase,
    matchSeed: meta[0] ? Number(meta[0]) : null,
    dealIdx: meta[1] ? Number(meta[1]) : null,
    step: meta[2] ? Number(meta[2]) : null,
    seat: meta[3] ? Number(meta[3]) : null,
    ctx: __evalCtxSummary(full),
    ...extra,
  };
  try { fn(payload); } catch { /* eval */ }
}
`;

if (!fs.existsSync(path.join(srcDir, 'index.js'))) {
  console.error(`missing ${srcDir}`);
  process.exit(1);
}
fs.rmSync(dstDir, { recursive: true, force: true });
fs.cpSync(srcDir, dstDir, { recursive: true });

let idx = fs.readFileSync(path.join(dstDir, 'index.js'), 'utf8');
if (!idx.includes('__evalEmitDecideTrace')) {
  idx = idx.replace(
    '/**\n * 选出建议着法。硬过滤优先于搜索/线性分。',
    `${INDEX_HELPERS}\n/**\n * 选出建议着法。硬过滤优先于搜索/线性分。`,
  );
  idx = idx.replace(
    '  ranked.sort((a, b) => b.score - a.score);\n  // r21 bit2（GD_R21）：',
    `  ranked.sort((a, b) => b.score - a.score);\n  __evalEmitDecideTrace('afterInitialRank', full, {
    beamW, beamLen: beam.length,
    beamTop: beam.slice(0, 6).map((b) => ({ key: __evalMoveKey(b.move), value: Math.round(b.value * 1000) / 1000 })),
    poolN: pool.length, ranked: __evalRankedSlice(ranked),
  });\n  // r21 bit2（GD_R21）：`,
  );
  idx = idx.replace(
    "  if (typeof process !== 'undefined' && process.env?.DECIDE_DEBUG)",
    `  let handplanProbe = null;
  if (full.leading && (full.hand?.length || 0) <= 20) {
    try {
      const cache = planCache(full);
      const hp0 = Date.now();
      const plan = decompose(full.hand, full.levelRank, cache);
      handplanProbe = { ms: Date.now() - hp0, plays: plan?.plays, cost: plan?.cost, handplanBudget: globalThis.__GD_HANDPLAN_BUDGET__ || null };
    } catch (e) { handplanProbe = { error: String(e?.message || e) }; }
  }
  __evalEmitDecideTrace('final', full, {
    beamW, beamLen: beam.length, ranked: __evalRankedSlice(ranked),
    best: { key: __evalMoveKey(best), tags: bestTags, score: Math.round(bestS * 1000) / 1000 },
    handplanProbe, decideMs: Math.round(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0) * 10) / 10,
  });
  if (typeof process !== 'undefined' && process.env?.DECIDE_DEBUG)`,
  );
  fs.writeFileSync(path.join(dstDir, 'index.js'), idx);
}

let hp = fs.readFileSync(path.join(dstDir, 'handplan.js'), 'utf8');
if (!hp.includes('__GD_HANDPLAN_BUDGET__')) {
  hp = hp.replace(
    '      if (softClock && Date.now() - t0 > 25) break; // hard time cap',
    `      if (softClock && Date.now() - t0 > 25) {
        if (typeof process !== 'undefined' && process.env.GD_EVAL_DECIDE_TRACE === '1' && globalThis.__GD_EVAL_DECIDE_TRACE_ACTIVE__) {
          globalThis.__GD_HANDPLAN_BUDGET__ = { fn: 'decompose', hit25ms: true, softClock, elapsed: Date.now() - t0 };
        }
        break; // hard time cap
      }`,
  );
  fs.writeFileSync(path.join(dstDir, 'handplan.js'), hp);
}

fs.writeFileSync(path.join(dstDir, '.eval-trace-stamp'), `src=${src}\ninstrumented=decide-trace\n`);
console.log(`instrumented snapshot: backups/${dst}`);
