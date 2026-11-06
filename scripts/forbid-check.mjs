// usage: node scripts/forbid-check.mjs set.jsonl id — lists candidate moves and whether isForbidden
import fs from 'node:fs';
import { cards } from '../engine/cards.js';
import { classify } from '../engine/combos.js';
import { generateCandidates } from '../search/index.js';
import { isForbidden } from '../policy/index.js';
const [f, id] = process.argv.slice(2);
const c = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse).find((x) => x.id === id);
const hand = cards(c.hands[String(c.seat)].join(' '));
const prev = c.leading ? null : classify(cards(c.previous.cards.join(' ')), c.levelRank);
const ctx = { hand, levelRank: c.levelRank, seat: c.seat, leading: !!c.leading, previous: prev, lastPlaySeat: c.trickMeta?.lastPlayer ?? null, remainingSeatCounts: [0, 1, 2, 3].map((i) => c.hands[String(i)].length) };
const ms = generateCandidates({ hand, previous: prev, levelRank: c.levelRank, leading: !!c.leading });
for (const m of ms) console.log(m.combo?.type, (m.cards || []).map((x) => x.rank + (x.suit || '')).join(' '), isForbidden(m, ctx, ms));
