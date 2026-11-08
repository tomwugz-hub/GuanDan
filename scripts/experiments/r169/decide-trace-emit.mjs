/**
 * Eval-only decide trace sink (set on globalThis by trace-decide-step.mjs). Default off.
 */
import { createHash } from 'node:crypto';

export function cardKey(move) {
  if (!move?.cards?.length) return 'pass';
  const ids = move.cards.map((c) => c.id).sort((a, b) => a - b);
  return `${move.combo?.type}:${move.combo?.rank}:{${ids.join(',')}}`;
}

export function rankCounts(hand, lv) {
  const m = new Map();
  for (const c of hand || []) {
    const k = c.rank === lv ? `${c.rank}*` : c.rank;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([r, n]) => `${r}x${n}`).join(' ');
}

export function sliceRanked(ranked, limit = 40) {
  return ranked.slice(0, limit).map((r, i) => ({
    i,
    key: cardKey(r.move),
    score: Math.round(r.score * 1000) / 1000,
    tags: (r.tags || []).slice(0, 16),
  }));
}

export function installDecideTraceSink({ matchSeed, dealIdx, step, seat, onTrace }) {
  const sink = (payload) => {
    if (payload.seat != null && payload.seat !== seat && payload.ctx?.seat !== seat) return;
    onTrace(payload);
  };
  globalThis.__GD_EVAL_DECIDE_TRACE__ = sink;
  return () => {
    delete globalThis.__GD_EVAL_DECIDE_TRACE__;
  };
}

export function diffRanked(a, b) {
  const n = Math.max(a?.length || 0, b?.length || 0);
  for (let i = 0; i < n; i++) {
    const x = a?.[i];
    const y = b?.[i];
    if (!x || !y) return { index: i, reason: 'length', x, y };
    if (x.key !== y.key || x.score !== y.score || (x.tags || []).join() !== (y.tags || []).join()) {
      return { index: i, x, y };
    }
  }
  return null;
}

export function fingerprintTrace(t) {
  const s = JSON.stringify({ ranked: t.ranked, best: t.best, phases: t.phases });
  return createHash('sha256').update(s, 'utf8').digest('hex');
}
