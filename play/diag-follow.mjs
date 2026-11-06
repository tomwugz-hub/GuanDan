#!/usr/bin/env node
/** 诊断：早中盘跟敌人小单/小对时过牌的原因（禁止规则 / 打分标签）。 */
import { newGame, botStepDecide, isOver, isLeading, ctxFor, play, coachMove } from './core.js';
import { decide } from '../policy/index.js';
import { isForbidden, FORBID_TRACE, detectStructures, resolvePartnerCombo } from '../policy/filters.js';
import { generateCandidates } from '../search/index.js';
import { formatCard } from '../engine/cards.js';
import { singleStrength, isWildCard } from '../engine/ranks.js';
const N = Number(process.argv[2] || 30);
const VERBOSE = Number(process.argv[3] || 0);
const ruleHist = {}, tagHist = {}; let n = 0, passN = 0, allForbidden = 0, scoredLower = 0; const samples = [];
const small = (c, lv) => (c.type === 'single' || c.type === 'pair') && c.rank !== lv && singleStrength(c.rank, lv) <= singleStrength('10', lv) && !['BJ', 'RJ'].includes(c.rank);
for (let gi = 0; gi < N; gi++) {
  const g = newGame({ seed: 7000 + gi });
  while (!isOver(g)) {
    const seat = g.round.currentSeat; const r = g.round;
    if (!isLeading(g) && r.lastPlayer !== (seat + 2) % 4 && r.hands[seat].length >= 10 && small(r.lastCombo, g.match.levelRank)) {
      const ctx = ctxFor(g, seat); n++;
      const rec = decide(ctx);
      if (!rec.move.cards.length) {
        passN++;
        const full = { ...ctx }; full.partnerCombo = resolvePartnerCombo(full); full._struct = detectStructures(full.hand, full.levelRank);
        const pool = generateCandidates(full);
        const nonPass = pool.filter((m) => m.cards.length && m.combo.type !== 'bomb' && m.combo.type !== 'straightFlush');
        const allowed = [];
        for (const m of nonPass) { FORBID_TRACE.rule = null; if (isForbidden(m, full, pool)) ruleHist[FORBID_TRACE.rule] = (ruleHist[FORBID_TRACE.rule] || 0) + 1; else allowed.push(m); }
        if (!allowed.length) allForbidden++; else {
          scoredLower++;
          const best = rec.scored.find((x) => x.move.cards.length && x.move.combo.type !== 'bomb');
          if (best) for (const t of best.tags) tagHist[t.replace(/:.*/, '')] = (tagHist[t.replace(/:.*/, '')] || 0) + 1;
          if (samples.length < 15) samples.push(`seat${seat} n=${ctx.hand.length} counts=${ctx.remainingSeatCounts} lv=${ctx.levelRank} prev=${r.lastCombo.type}:${r.lastCombo.rank} best=${best ? best.move.cards.map(formatCard).join('') + ' ' + best.score.toFixed(1) + ' [' + best.tags.join(',') + ']' : '-'} hand=${ctx.hand.map(formatCard).join(' ')}`);
        }
      }
    }
    botStepDecide(g);
  }
}
console.log({ n, passN, passRate: (passN / n).toFixed(2), allForbidden, scoredLower });
console.log('forbid rules (per non-bomb candidate):', Object.entries(ruleHist).sort((a, b) => b[1] - a[1]));
console.log('best follow tags:', Object.entries(tagHist).sort((a, b) => b[1] - a[1]));
if (VERBOSE) console.log(samples.join('\n'));
