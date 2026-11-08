#!/usr/bin/env node
/** Exit 0 iff b3 and b9 induce different enemy caps (seat-count distinguishers). */
import { r169Gate } from '../../../policy/endgame.js';

const ctx = { seat: 0, remainingSeatCounts: [4, 6, 4, 4], hand: [{ rank: '2', suit: 'S', id: 1 }, { rank: '2', suit: 'H', id: 2 }] };
const g3 = r169Gate(ctx, 3);
const g9 = r169Gate(ctx, 9);
if (g3.ok) {
  console.error('verify-bits: expected GD_R169=3 to reject enemy 6');
  process.exit(1);
}
if (!g9.ok || g9.maxEach !== 6) {
  console.error('verify-bits: expected GD_R169=9 to accept enemy 6 with maxEach 6', g9);
  process.exit(1);
}
console.log('r169 verify-bits: b3 rejects / b9 accepts enemy@6 (distinct gates)');
