#!/usr/bin/env node
/**
 * DecisionPivot-style contrast-pair eval (StartLux idea): each pair shares pair_id and differs in ONE
 * answer-changing detail; a pair scores only if BOTH cases are correct.
 *   node scripts/run-pair-eval.mjs [--cases=eval/endgames/pairs.jsonl] [--jev=0|1] [--startlux=0|1]
 *        [--out=eval/endgames/pairs-report.md] [--limit=N]
 * Works on cases.jsonl too (no pair_id → per-case only).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cards } from '../engine/cards.js';
import { classify } from '../engine/combos.js';
import { isLegalPlay } from '../engine/legal.js';
import { generateCandidates } from '../search/index.js';
import { runCase, matchGold, loadApiKey, keyDiag } from './run-endgame-eval.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? '1']),
);
const casesPath = resolve(ROOT, args.cases || 'eval/endgames/pairs.jsonl');
const useJev = args.jev === '1';
const useStartLux = args.startlux === '1';
const out = resolve(ROOT, args.out || `eval/endgames/${basename(casesPath, '.jsonl')}-report.md`);
const limit = Number(args.limit || Infinity);

const rows0 = readFileSync(casesPath, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)).slice(0, limit);

/** gold must be reachable by some legal move */
function goldLegal(c) {
  const hand = cards(c.hands[String(c.seat)]);
  const prev = c.leading ? null : c.previous?.cards?.length ? classify(cards(c.previous.cards), c.levelRank || '2') : null;
  if (!c.leading && !prev) return { ok: false, why: 'previous_unclassifiable' };
  const lv = c.levelRank || '2';
  const moves = generateCandidates({ hand, previous: prev, levelRank: lv, leading: !!c.leading }).filter((m) => isLegalPlay(m.cards, prev, lv, { leading: !!c.leading }));
  if (!c.leading && !moves.some((m) => !m.cards.length)) moves.push({ cards: [], combo: { type: 'pass' } });
  return { ok: moves.some((m) => matchGold(m, c.gold).ok), why: '' };
}

let { key: apiKey, source } = loadApiKey();
console.log(`pair-eval cases=${rows0.length} jev=${+useJev} startlux=${+useStartLux} key=${useJev ? keyDiag(apiKey) : '-'}`);
const res = [];
for (const c of rows0) {
  const legal = goldLegal(c);
  if (!legal.ok) console.warn(`!! ${c.id} gold not legal ${legal.why}`);
  const r = await runCase(c, { useJev, apiKey, useStartLux });
  r.pair_id = c.pair_id || null;
  r.pivot = c.pivot || '';
  r.gold_legal = legal.ok;
  res.push(r);
  const f = (x) => (x === null ? '-' : x ? '✓' : '✗');
  console.log(
    `${r.id} gold=${r.gold} decide=${r.decide}${f(r.decide_ok)}` +
      (useJev ? ` jev=${r.jev}${f(r.jev_ok)}${r.jev_error ? ' err=' + r.jev_error : ''}` : '') +
      (useStartLux ? ` sl=${r.startlux}${f(r.startlux_ok)}${r.startlux_error ? ' err=' + r.startlux_error : ''}` : ''),
  );
}

const systems = [['decide', 'decide_ok'], ...(useJev ? [['jev', 'jev_ok']] : []), ...(useStartLux ? [['startlux', 'startlux_ok']] : [])];
const pairsMap = new Map();
for (const r of res) if (r.pair_id) (pairsMap.get(r.pair_id) || pairsMap.set(r.pair_id, []).get(r.pair_id)).push(r);
const summary = { generated: new Date().toISOString(), cases: res.length, pairs: pairsMap.size, illegalGold: res.filter((r) => !r.gold_legal).map((r) => r.id) };
const L = ['# Pair eval report', '', `- generated: ${summary.generated}`, `- file: ${basename(casesPath)}`, `- cases: ${res.length}, pairs: ${pairsMap.size}`, `- gold legality: ${res.length - summary.illegalGold.length}/${res.length} legal`, ''];
L.push('| system | case acc | pair acc |', '|---|---|---|');
for (const [name, k] of systems) {
  const ok = res.filter((r) => r[k]).length;
  const pOk = [...pairsMap.values()].filter((ps) => ps.every((r) => r[k])).length;
  summary[name] = { caseOk: ok, pairOk: pOk };
  L.push(`| ${name} | ${ok}/${res.length} (${((100 * ok) / res.length).toFixed(1)}%) | ${pairsMap.size ? `${pOk}/${pairsMap.size} (${((100 * pOk) / pairsMap.size).toFixed(1)}%)` : '-'} |`);
}
L.push('', '| id | pivot | gold | decide | ' + systems.slice(1).map((s) => s[0]).join(' | ') + (systems.length > 1 ? ' |' : '') + ' ok |', '|' + '---|'.repeat(4 + systems.length));
for (const r of res) {
  const oks = systems.map(([n, k]) => `${n[0]}:${r[k] ? '✓' : '✗'}`).join(' ');
  L.push(`| ${r.id} | ${r.pivot.replace(/\|/g, '/')} | ${r.gold} | ${r.decide} | ${systems.slice(1).map(([n]) => r[n]).join(' | ')}${systems.length > 1 ? ' |' : ''} ${oks} |`);
}
writeFileSync(out, L.join('\n') + '\n');
writeFileSync(out.replace(/\.md$/, '.json'), JSON.stringify({ ...summary, rows: res }, null, 2));
console.log('---');
for (const [name] of systems) console.log(`${name}: case ${summary[name].caseOk}/${res.length} pair ${summary[name].pairOk}/${pairsMap.size}`);
console.log(`report: ${out}`);
