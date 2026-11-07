/** Eval-only: full live game/ctx fingerprint at stopAt (not arena raw collect subset). */
import { formatCard, sortHand, ctxFor, isLeading } from '../../../selfplay/lib.mjs';
import { isPassMove } from '../../../play/core.js';
import { policySourceManifest, collectGdEnv } from './eval-meta.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function cardIds(hand, lv) {
  return sortHand(hand || [], lv).map((c) => c.id).sort((a, b) => a - b);
}

export function versionsStamp(names) {
  const out = {};
  for (const name of names) {
    if (name === 'current') continue;
    const p = path.join(ROOT, 'selfplay', '.versions', name, '.stamp');
    try { out[name] = fs.readFileSync(p, 'utf8'); } catch { out[name] = null; }
  }
  return out;
}

export function moduleManifestForSpecs(specs) {
  const names = new Set();
  for (const s of specs) {
    const ver = s.includes('@') ? s.split('@')[1] : 'current';
    names.add(ver);
  }
  const manifest = {};
  for (const n of names) manifest[n] = policySourceManifest(n);
  return { names: [...names], manifest };
}

export function captureLiveCtx(g, seat) {
  const ctx = ctxFor(g, seat);
  const r = g.round;
  const lv = g.match.levelRank;
  g.matchSeed = g.matchSeed ?? null;
  const hand = r.hands[seat];
  const prev = ctx.previous;
  return {
    dealSeed: g.seed,
    matchSeed: g.matchSeed ?? null,
    dealIdx: g.dealIdx ?? null,
    stepAtStop: r.history?.length ?? null,
    std: {
      teamLevel: g.std?.teamLevel?.slice(),
      level: g.std?.level,
      levelTeam: g.std?.levelTeam,
      prevOrder: g.std?.prevOrder?.slice(),
      matchOver: !!g.std?.matchOver,
    },
    match: { levelRank: g.match.levelRank, teamLevel: g.match.teamLevel?.slice?.() },
    tributeState: g.tributeState ? {
      phase: g.tributeState.phase,
      gives: g.tributeState.plan?.gives?.map((x) => ({ from: x.from, to: x.to, card: formatCard(x.card) })),
      returns: g.tributeState.returns?.map((x) => ({ from: x.from, to: x.to, card: formatCard(x.card) })),
    } : null,
    round: {
      currentSeat: r.currentSeat,
      lastPlayer: r.lastPlayer,
      finished: r.finished?.slice(),
      counts: r.hands.map((h) => h.length),
      lastCombo: r.lastCombo ? { type: r.lastCombo.type, rank: r.lastCombo.rank } : null,
      leading: isLeading(g),
    },
    gameSeed: g.seed,
    dealNo: g.dealNo,
    ctx: {
      seat: ctx.seat,
      leading: ctx.leading,
      levelRank: ctx.levelRank,
      firstLeadOfDeal: !!ctx.firstLeadOfDeal,
      partnerCombo: !!ctx.partnerCombo,
      remainingSeatCounts: ctx.remainingSeatCounts?.slice(),
      handN: hand.length,
      handIds: cardIds(hand, lv),
      handStr: hand.map((c) => formatCard(c)).sort().join(' '),
      previous: prev ? { type: prev.type, rank: prev.rank, cardIds: prev.cards?.map((c) => c.id).sort((a, b) => a - b) } : null,
    },
    trickTail: (g.trickPlays || []).slice(-6).map((t) => ({
      seat: t.seat,
      pass: isPassMove(t),
      type: t.combo?.type,
      rank: t.combo?.rank,
    })),
  };
}

export function envAndModules(specs) {
  return {
    gdEnv: collectGdEnv(),
    ...moduleManifestForSpecs(specs),
    versionsStamp: versionsStamp(specs.map((s) => (s.includes('@') ? s.split('@')[1] : 'current'))),
  };
}
