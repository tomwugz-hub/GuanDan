#!/usr/bin/env node
// Legality-only gold check (does NOT run decide/Jev). Usage: node scripts/check-gold-legal.mjs <file.jsonl>
import { readFileSync } from 'node:fs';
import { cards } from '../engine/cards.js';
import { classify } from '../engine/combos.js';
import { isLegalPlay } from '../engine/legal.js';
import { generateCandidates } from '../search/index.js';
import { matchGold } from './run-endgame-eval.mjs';
const rows = readFileSync(process.argv[2], 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
let bad = 0;
for (const c of rows) {
  const lv = c.levelRank || '2';
  const ids = c.hands[String(c.seat)];
  const cc = {}; for (const x of ids) cc[x] = (cc[x] || 0) + 1; if (Object.values(cc).some((v) => v > 2)) { console.log('DUP', c.id, ids.join(' ')); bad++; }
  const hand = cards(ids);
  const prev = c.leading ? null : classify(cards(c.previous.cards), lv);
  if (!c.leading && (!prev || prev.type !== c.previous.type)) { console.log('PREV', c.id, c.previous.type, '->', prev?.type); bad++; continue; }
  const moves = generateCandidates({ hand, previous: prev, levelRank: lv, leading: !!c.leading }).filter((m) => isLegalPlay(m.cards, prev, lv, { leading: !!c.leading }));
  if (!c.leading) moves.push({ cards: [], combo: { type: 'pass' } });
  if (!moves.some((m) => matchGold(m, c.gold).ok)) { console.log('ILLEGAL', c.id, JSON.stringify(c.gold)); bad++; }
  for (const a of c.gold.alts || []) if (!moves.some((m) => matchGold(m, { alts: [a] }).ok)) { console.log('ILLEGAL_ALT', c.id, JSON.stringify(a)); bad++; }
}
console.log(`${rows.length} cases, ${bad} problems`);
