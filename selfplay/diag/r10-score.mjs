/** Score crafted r10 example positions (no deal replay). */
import { decide } from '../../policy/index.js';
import { TYPES } from '../../engine/combos.js';

function C(rank, suit, id) { return { id: id || (rank + (suit || '') + Math.random().toString(36).slice(2, 6)), rank, suit: suit || null }; }
function hand(str) {
  return str.trim().split(/\s+/).map((s, i) => {
    if (s === 'BJ' || s === 'RJ') return C(s, null, s + i);
    const m = s.match(/^(10|[2-9AJQK])([SHCD])$/);
    if (!m) throw new Error(s);
    return C(m[1], m[2], s + i);
  });
}
function fmt(mv) { return (!mv?.cards?.length ? 'pass' : `${mv.combo.type}:${mv.combo.rank}`); }
function score(label, env, ctx0) {
  for (const k of ['R10_BOMBCLR', 'R10_FEED', 'R10_PRESS']) {
    if (k in env) process.env[k] = String(env[k]);
    else delete process.env[k];
  }
  const r = decide(ctx0);
  const keep = (r.tags || []).filter((t) => /bombClear|feedPartner|pressMidShort|holdBombLead|leadBombLate/.test(t));
  console.log(label.padEnd(28), fmt(r.move).padEnd(16), keep.join(',') || (r.tags || []).slice(0, 3).join(','));
}

const bombHand = hand('5S 5H 5C 5C 5D 2S 2H 2H 2C');
const ctxB = { hand: bombHand, levelRank: 'Q', seat: 1, remainingSeatCounts: [22, 9, 16, 15], previous: null, leading: true };
score('c1 off 531', {}, ctxB);
score('c1 on  531', { R10_BOMBCLR: 1 }, { ...ctxB, hand: hand('5S 5H 5C 5C 5D 2S 2H 2H 2C') });

const ctxB2 = { hand: hand('QS QS QC QC QD 5S 5H 5H 5C'), levelRank: '2', seat: 1, remainingSeatCounts: [18, 9, 24, 25], previous: null, leading: true };
score('c1 off 595', {}, ctxB2);
score('c1 on  595', { R10_BOMBCLR: 1 }, { ...ctxB2, hand: hand('QS QS QC QC QD 5S 5H 5H 5C') });

const ctxF = { hand: hand('RJ RJ JS 10C 6H'), levelRank: '4', seat: 3, remainingSeatCounts: [0, 1, 1, 5], previous: null, leading: true };
score('c2 off 164', {}, ctxF);
score('c2 on  164', { R10_FEED: 1 }, { ...ctxF, hand: hand('RJ RJ JS 10C 6H') });

const prev = { type: TYPES.SINGLE, rank: 'J', cards: [C('J', 'D')] };
const ctxP = { hand: hand('RJ AS AC 9H 9C 7H 7D 5S 5S 5C 3S 3S 3H 3C'), levelRank: 'Q', seat: 3, remainingSeatCounts: [23, 16, 5, 14], previous: prev, leading: false, lastPlaySeat: 2 };
score('c3 off 022', {}, ctxP);
score('c3 on  022', { R10_PRESS: 1 }, { ...ctxP, hand: hand('RJ AS AC 9H 9C 7H 7D 5S 5S 5C 3S 3S 3H 3C'), previous: prev });
