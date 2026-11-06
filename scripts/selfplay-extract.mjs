#!/usr/bin/env node
// Self-play position extractor for frozen-real (records positions only, never the policy's chosen move).
// Seats use a per-game mix of policies: decide / random-legal / greedy-small.
import { writeFileSync } from 'node:fs';
import { createMatch, createRound, applyPlay } from '../engine/state.js';
import { TYPES, isBombLike } from '../engine/combos.js';
import { formatCard } from '../engine/cards.js';
import { legalMoves } from '../engine/legal.js';
import { compareRank } from '../engine/compare.js';
import { decide } from '../policy/index.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const games = Number(args.games || 60);
const seed0 = Number(args.seed || 1);
const out = args.out || '/workspace/guandan-coach/eval/endgames/selfplay-pool.jsonl';
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const LEVELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const POL = ['decide', 'random', 'greedy'];
const randomRate = Number(args.randomRate ?? 0.33);
const maxSeat = Number(args.maxSeat || 99);
const pool = [];
for (let g = 0; g < games; g++) {
  const rng = mulberry(seed0 * 1000 + g);
  const level = LEVELS[Math.floor(rng() * LEVELS.length)];
  const match = createMatch({ levelRank: level });
  const round = createRound(match, { dealerSeat: Math.floor(rng() * 4), rng });
  const pols = [0, 1, 2, 3].map(() => { const x = rng(); return x < randomRate ? 'random' : x < randomRate + (1 - randomRate) / 2 ? 'decide' : 'greedy'; });
  let plays = 0;
  while (round.finished.length < 3 && plays < 400) {
    const seat = round.currentSeat;
    const leading = !round.lastCombo || round.lastCombo.type === TYPES.PASS;
    const hand = round.hands[seat];
    const counts = round.hands.map((h) => h.length);
    const enemyMin = Math.min(counts[(seat + 1) % 4] || 99, counts[(seat + 3) % 4] || 99);
    let legal = legalMoves(hand, leading ? null : round.lastCombo, level, leading).filter((m) => m.cards?.length);
    const late = hand.length <= 10 || enemyMin <= 5;
    const active = (s) => !round.finished.includes(s);
    if (late && Math.max(...counts) <= maxSeat && legal.length >= 1 && (leading ? legal.length >= 2 : true) && active((seat + 1) % 4) && active((seat + 3) % 4)) {
      pool.push({
        game: g, seed: seed0 * 1000 + g, play: plays, levelRank: level, seat, leading,
        hands: Object.fromEntries([0, 1, 2, 3].map((s) => [String(s), round.hands[s].map(formatCard)])),
        previous: leading ? null : { type: round.lastCombo.type, rank: round.lastCombo.rank ?? null, cards: round.tricks[round.tricks.length - 1].cards.map(formatCard) },
        trickMeta: leading ? undefined : { lastPlayer: round.lastPlayer, controlSeat: round.lastPlayer },
        finished: round.finished.slice(),
        nLegal: legal.length,
      });
    }
    // choose move with this seat's policy
    let mv;
    const pol = pols[seat];
    const ctx = { hand, previous: leading ? null : round.lastCombo, levelRank: level, leading, firstLeadOfDeal: leading && round.tricks.length === 0, seat, remainingSeatCounts: counts, playedCards: [] };
    if (pol === 'decide') mv = decide(ctx).move.cards;
    else if (pol === 'random') { mv = (!leading && rng() < 0.35) || !legal.length ? [] : legal[Math.floor(rng() * legal.length)].cards; }
    else {
      const ord = legal.filter((m) => !isBombLike(m.combo)).sort((a, b) => a.cards.length - b.cards.length || compareRank(a.combo.rank, b.combo.rank, level));
      mv = ord.length ? (leading ? ord[ord.length > 2 && rng() < 0.5 ? ord.length - 1 : 0].cards : ord[0].cards) : (leading ? legal[0].cards : []);
    }
    if (leading && !mv.length) mv = legal[0].cards;
    const r = applyPlay(round, seat, mv);
    if (!r.ok) { const r2 = applyPlay(round, seat, leading ? legal[0].cards : []); if (!r2.ok) break; }
    plays++;
  }
}
writeFileSync(out, pool.map((p) => JSON.stringify(p)).join('\n') + '\n');
console.log(`games=${games} positions=${pool.length} -> ${out}`);
