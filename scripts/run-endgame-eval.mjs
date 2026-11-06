#!/usr/bin/env node
/**
 * 残局评估：decide vs Jev vs human gold。
 * 用法:
 *   node scripts/run-endgame-eval.mjs [--limit=N] [--jev=0|1] [--out=eval/endgames/last-report.md]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { cards, formatCard } from '../engine/cards.js';
import { classify, TYPES } from '../engine/combos.js';
import { decide, labelCombo } from '../policy/index.js';
import { pickWithJev } from '../policy/jevScore.js';
import { buildJevState } from '../policy/jevState.js';
import { buildJevCandidates } from '../policy/jevCandidates.js';
import { pickWithStartLux } from '../policy/startluxScore.js';
import { pickWithBamboo, ensureBambooKey } from '../policy/bambooScore.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CASES = resolve(ROOT, 'eval/endgames/cases.jsonl');
const DEFAULT_OUT = resolve(ROOT, 'eval/endgames/last-report.md');
const DEFAULT_SUMMARY = resolve(ROOT, 'eval/endgames/last-summary.json');

function parseArgs(argv) {
  let limit = Infinity;
  let jev = 0;
  let out = DEFAULT_OUT;
  let casesPath = DEFAULT_CASES;
  for (const a of argv.slice(2)) {
    let m;
    if ((m = a.match(/^--limit=(\d+)$/))) limit = Number(m[1]);
    else if ((m = a.match(/^--jev=([01])$/))) jev = Number(m[1]);
    else if ((m = a.match(/^--out=(.+)$/))) out = resolve(ROOT, m[1]);
    else if ((m = a.match(/^--cases=(.+)$/))) casesPath = resolve(ROOT, m[1]);
  }
  return { limit, jev, out, casesPath };
}

export function loadApiKey() {
  const candidates = [];
  const push = (key, source) => {
    if (key && !candidates.some((c) => c.key === key)) candidates.push({ key, source });
  };
  push(process.env.TYPESAFE_API_KEY_NEW, 'env.NEW');
  push(process.env.TYPESAFE_API_KEY, 'env');
  push(process.env.TYPESAFE_API_KEY_STRIPPED, 'env.STRIPPED');
  const path = '/home/box/agent-data/box-secrets.json';
  if (existsSync(path)) {
    try {
      const data = JSON.parse(readFileSync(path, 'utf8'));
      const card = data.card || {};
      push(card.TYPESAFE_API_KEY_NEW, 'secrets.NEW');
      push(card.TYPESAFE_API_KEY, 'secrets');
    } catch {
      /* ignore */
    }
  }
  if (!candidates.length) return { key: '', source: 'missing', alternates: [] };
  return { key: candidates[0].key, source: candidates[0].source, alternates: candidates.slice(1) };
}

export function keyDiag(key) {
  if (!key) return 'missing';
  const sha12 = createHash('sha256').update(key).digest('hex').slice(0, 12);
  return `len=${key.length} sha12=${sha12}`;
}

function loadCases(path, limit) {
  const text = readFileSync(path, 'utf8');
  const rows = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  return rows.slice(0, limit);
}

function parseHands(hobj) {
  return [0, 1, 2, 3].map((i) => cards(hobj[String(i)] || hobj[i] || []));
}

function moveKey(m) {
  const ids = (m.cards || [])
    .map((c) => c.id)
    .sort((a, b) => a - b)
    .join(',');
  return `${m.combo?.type || 'pass'}:${ids}`;
}

function isPassMove(m) {
  return !m?.cards?.length || m.combo?.type === TYPES.PASS;
}

function comboSummary(combo, cardList) {
  if (!combo || combo.type === TYPES.PASS) return '过牌';
  const cs = (cardList || []).map(formatCard).join(' ');
  return cs ? `${labelCombo(combo)} [${cs}]` : labelCombo(combo);
}

/** 与自对弈相同的 top-K 候选构造。 */
function buildCandidates(rec, { leading, K = 5 }) {
  const pool = [];
  const seen = new Set();
  const push = (m) => {
    if (!m) return;
    const k = moveKey(m);
    if (seen.has(k)) return;
    seen.add(k);
    pool.push(m);
  };
  push(rec.move);
  for (const a of rec.alternatives || []) push(a);
  if (!leading) {
    push({ cards: [], combo: { type: TYPES.PASS, rank: null, size: 0 } });
  }
  return pool.slice(0, Math.min(K, pool.length)).map((move, i) => {
    const isPass = !move?.cards?.length || move.combo?.type === TYPES.PASS;
    const isBomb =
      move.combo?.type === 'bomb' || move.combo?.type === 'straightFlush';
    let tag = '';
    if (isPass) tag = ' [过牌]';
    else if (isBomb) tag = ' [炸弹]';
    else if (!leading) tag = ' [普通跟]';
    else tag = ' [领出]';
    const n = move?.cards?.length || 0;
    // hand length unknown here; go-out tagged in runCase when annotating
    return {
      key: `m${i}`,
      label: comboSummary(move.combo, move.cards) + tag,
      move,
    };
  });
}

/**
 * 容忍匹配：action + comboType；ranks 命中主 rank 或任一张牌 rank。
 */
export function matchGold(move, gold) {
  const isPass = isPassMove(move);
  if (!gold) return { ok: false, detail: 'no_gold' };
  // frozen-real 格式：gold.alts = [{comboType, ranks}]，任一命中即可；按主 rank 严格匹配
  if (Array.isArray(gold.alts)) {
    for (const a of gold.alts) {
      if (a.comboType === 'pass') { if (isPass) return { ok: true, detail: 'pass' }; continue; }
      if (isPass || move.combo?.type !== a.comboType) continue;
      if (a.size && (move.cards?.length || 0) !== a.size) continue;
      if (!a.ranks?.length || a.ranks.includes(move.combo.rank)) return { ok: true, detail: `alt_${a.comboType}_${move.combo.rank}` };
    }
    return { ok: false, detail: isPass ? 'got_pass' : `got_${move?.combo?.type}_${move?.combo?.rank}` };
  }
  if (gold.action === 'pass' || gold.comboType === 'pass') {
    return { ok: isPass, detail: isPass ? 'pass' : `got_${move?.combo?.type}` };
  }
  if (isPass) return { ok: false, detail: 'got_pass' };
  if (move.combo?.type !== gold.comboType) {
    return { ok: false, detail: `type_${move.combo?.type}_vs_${gold.comboType}` };
  }
  if (!gold.ranks?.length) return { ok: true, detail: 'type_only' };
  const r = move.combo.rank;
  const hit =
    gold.ranks.includes(r) || (move.cards || []).some((c) => gold.ranks.includes(c.rank));
  return { ok: hit, detail: hit ? `rank_${r}` : `rank_${r}_not_in_${gold.ranks.join('/')}` };
}

function describeMove(move) {
  if (isPassMove(move)) return 'pass';
  const ranks = (move.cards || []).map((c) => c.rank).join('');
  return `${move.combo?.type}:${move.combo?.rank || ''}${ranks ? `{${ranks}}` : ''}`;
}

function describeGold(gold) {
  if (!gold) return '-';
  if (gold.action === 'pass' || gold.comboType === 'pass') return 'pass';
  return `${gold.comboType}:${(gold.ranks || []).join('/')}`;
}

export async function runCase(c, { useJev, apiKey, useStartLux = false, startluxUrl } = {}) {
  const hands = parseHands(c.hands);
  const seat = c.seat;
  const levelRank = c.levelRank || '2';
  const leading = !!c.leading;
  let previous = null;
  if (!leading && c.previous?.cards?.length) {
    previous = classify(cards(c.previous.cards), levelRank);
  } else if (!leading && c.previous?.type && c.previous.type !== 'pass') {
    previous = { type: c.previous.type, rank: c.previous.rank ?? null, size: 1, length: 1 };
  }

  const partnerSeat = (seat + 2) % 4;
  let partnerCombo = null;
  if (c.trickMeta?.partnerLastPlay) {
    partnerCombo = {
      type: c.trickMeta.partnerLastPlay.type,
      rank: c.trickMeta.partnerLastPlay.rank ?? null,
    };
  } else if (c.trickMeta?.lastPlayer === partnerSeat && previous) {
    partnerCombo = previous;
  }

  const ctx = {
    hand: hands[seat],
    previous: leading ? null : previous,
    levelRank,
    leading,
    firstLeadOfDeal: !!c.firstLeadOfDeal,
    seat,
    remainingSeatCounts: hands.map((h) => h.length),
    partnerCombo,
    playedCards: [],
    persona: c.persona || null,
    lastPlaySeat: c.trickMeta?.lastPlayer ?? null,
  };

  const rec = decide(ctx);
  const decideDesc = describeMove(rec.move);
  const decideMatch = matchGold(rec.move, c.gold);

  let jevDesc = '-';
  let jevMatch = { ok: null, detail: 'skipped' };
  let jevError = null;
  let jevChoice = null;
  let jevConfidence = null;

  let slDesc = '-';
  let slMatch = { ok: null, detail: 'skipped' };
  let slError = null;
  if (useJev || useStartLux) {
    const lastPlayer = c.trickMeta?.lastPlayer ?? c.trickMeta?.controlSeat ?? null;
    const partnerSeat = (seat + 2) % 4;
    const partnerFirst =
      /partner/i.test(c.persona?.style || '') || /护搭档|partner/i.test(c.persona?.brief || '');
    const toBeatIsPartner = !leading && lastPlayer === partnerSeat;
    const preferPassForPartner = partnerFirst && toBeatIsPartner;
    const candidates = buildJevCandidates(rec, {
      hand: hands[seat],
      previous: leading ? null : previous,
      levelRank,
      leading,
      seatCounts: hands.map((h) => h.length),
      seat,
      K: 8,
      preferPassForPartner,
      lastPlaySeat: lastPlayer,
      persona: c.persona || null,
      labelFn: (combo, cardList) => comboSummary(combo, cardList),
    });
    // annotate go-out on labels
    const handLen = hands[seat].length;
    for (const cand of candidates) {
      if (cand.move?.cards?.length === handLen) {
        if (!cand.label.includes('[走完]')) cand.label += ' [走完]';
      }
    }
    const state = buildJevState({
      seat,
      hand: hands[seat],
      levelRank,
      leading,
      previous: leading ? null : previous,
      persona: c.persona,
      seatCounts: hands.map((h) => h.length),
      candidates,
      controlSeat: c.trickMeta?.controlSeat ?? c.trickMeta?.lastPlayer ?? null,
      partnerLastPlay: c.trickMeta?.partnerLastPlay || null,
      lastPlayer,
      toBeatIsPartner,
      preferPassForPartner,
    });
    if (process.env.JEV_DUMP) {
      console.log(`----- ${c.id} hints:`, JSON.stringify(state.policyHints), 'plan:', state.handPlan || '-');
      for (const cand of candidates) console.log('   ', cand.key, cand.label);
    }

    if (useStartLux) {
      if (candidates.length === 1) {
        slDesc = describeMove(candidates[0].move);
        slMatch = matchGold(candidates[0].move, c.gold);
      } else {
        const raw = { hand: hands[seat], seatCounts: hands.map((h) => h.length), seat, levelRank, leading, previous: leading ? null : previous, lastPlayer };
        const backend = (process.env.STARTLUX_BACKEND || '').toLowerCase() === 'local'
          ? 'local'
          : (ensureBambooKey() ? 'bamboo' : 'local');
        const r = backend === 'bamboo'
          ? await pickWithBamboo({ candidates, raw, apiKey: process.env.BAMBOO_API_KEY })
          : await pickWithStartLux({ candidates, persona: c.persona, url: startluxUrl, raw });
        if (r.error || r.index < 0) {
          slError = r.error || 'invalid_choice';
          slDesc = 'error';
          slMatch = { ok: false, detail: slError };
        } else {
          slDesc = describeMove(candidates[r.index].move);
          slMatch = matchGold(candidates[r.index].move, c.gold);
        }
      }
    }
    if (!useJev) {
      /* jev skipped */
    } else if (candidates.length === 1) {
      jevDesc = describeMove(candidates[0].move);
      jevMatch = matchGold(candidates[0].move, c.gold);
      jevChoice = candidates[0].key;
    } else if (!apiKey) {
      jevError = 'missing_api_key';
      jevDesc = 'fallback:' + decideDesc;
      jevMatch = decideMatch;
    } else {
      const result = await pickWithJev({
        candidates,
        state,
        persona: c.persona,
        apiKey,
      });
      jevChoice = result.choice;
      jevConfidence = result.confidence;
      if (result.error || result.index < 0) {
        jevError = result.error || 'invalid_choice';
        jevDesc = 'fallback:' + decideDesc;
        jevMatch = decideMatch;
      } else {
        const picked = candidates[result.index].move;
        jevDesc = describeMove(picked);
        jevMatch = matchGold(picked, c.gold);
      }
    }
  }

  return {
    id: c.id,
    gold: describeGold(c.gold),
    decide: decideDesc,
    jev: jevDesc,
    decide_ok: decideMatch.ok,
    jev_ok: jevMatch.ok,
    notes: c.notes || c.gold?.rationale || '',
    expectJevMayDiffer: !!c.expectJevMayDiffer,
    decide_detail: decideMatch.detail,
    jev_detail: jevMatch.detail,
    jev_error: jevError,
    jev_choice: jevChoice,
    jev_confidence: jevConfidence,
    tags: c.tags || [],
    startlux: slDesc,
    startlux_ok: slMatch.ok,
    startlux_error: slError,
  };
}

function mdEscape(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function writeReport(rows, meta, outPath, summaryPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  const decideN = rows.filter((r) => r.decide_ok).length;
  const jevRows = rows.filter((r) => r.jev_ok !== null && r.jev !== '-');
  const jevN = jevRows.filter((r) => r.jev_ok).length;
  const agree = rows.filter((r) => r.jev !== '-' && r.jev.replace(/^fallback:/, '') === r.decide).length;

  const lines = [];
  lines.push('# Endgame eval report');
  lines.push('');
  lines.push(`- generated: ${meta.generated}`);
  lines.push(`- cases: ${rows.length}`);
  lines.push(`- jev: ${meta.jevEnabled ? 'on' : 'off'} (key ${meta.keyDiag} via ${meta.keySource})`);
  lines.push(
    `- decide vs gold: **${decideN}/${rows.length}** (${rows.length ? ((100 * decideN) / rows.length).toFixed(1) : 0}%)`,
  );
  if (meta.jevEnabled) {
    lines.push(
      `- jev vs gold: **${jevN}/${jevRows.length}** (${jevRows.length ? ((100 * jevN) / jevRows.length).toFixed(1) : 0}%)`,
    );
    lines.push(`- decide/jev same move (incl. fallback label strip): ${agree}/${rows.length}`);
  }
  lines.push('');
  lines.push('| id | gold | decide | jev | decide_ok | jev_ok | notes |');
  lines.push('|----|------|--------|-----|-----------|--------|-------|');
  for (const r of rows) {
    lines.push(
      `| ${r.id} | ${mdEscape(r.gold)} | ${mdEscape(r.decide)} | ${mdEscape(r.jev)} | ${r.decide_ok} | ${r.jev_ok === null ? '-' : r.jev_ok} | ${mdEscape(r.notes).slice(0, 60)} |`,
    );
  }
  lines.push('');
  writeFileSync(outPath, lines.join('\n'), 'utf8');

  const summary = {
    generated: meta.generated,
    caseCount: rows.length,
    jevEnabled: meta.jevEnabled,
    keyDiag: meta.keyDiag,
    keySource: meta.keySource,
    decideOk: decideN,
    decideRate: rows.length ? decideN / rows.length : 0,
    jevOk: meta.jevEnabled ? jevN : null,
    jevRate: meta.jevEnabled && jevRows.length ? jevN / jevRows.length : null,
    jevErrors: rows.filter((r) => r.jev_error).map((r) => ({ id: r.id, error: r.jev_error })),
    intentionalDiffIds: rows.filter((r) => r.expectJevMayDiffer && !r.decide_ok).map((r) => r.id),
    rows: rows.map((r) => ({
      id: r.id,
      gold: r.gold,
      decide: r.decide,
      jev: r.jev,
      decide_ok: r.decide_ok,
      jev_ok: r.jev_ok,
    })),
  };
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  return summary;
}

async function main() {
  const { limit, jev, out, casesPath } = parseArgs(process.argv);
  const cases = loadCases(casesPath, limit);
  let { key: apiKey, source, alternates = [] } = loadApiKey();
  const useJev = jev === 1;
  if (useJev && !apiKey) {
    console.warn('警告: --jev=1 但无 API Key，Jev 列将 fallback 到 decide');
  }
  console.log(
    `endgame-eval cases=${cases.length} jev=${useJev ? 1 : 0} key=${keyDiag(apiKey)} via=${source}`,
  );

  const rows = [];
  for (const c of cases) {
    let row = await runCase(c, { useJev, apiKey });
    if (
      useJev &&
      apiKey &&
      (row.jev_error === 'http_401' || row.jev_error === 'http_403') &&
      alternates.length
    ) {
      const next = alternates.shift();
      console.warn(`Jev ${row.jev_error} on ${source}; rotate ${next.source} (${keyDiag(next.key)})`);
      apiKey = next.key;
      source = next.source;
      row = await runCase(c, { useJev, apiKey });
    }
    if (useJev && (row.jev_error === 'http_401' || row.jev_error === 'http_403')) {
      console.warn(`Jev auth ${row.jev_error}; 停止后续 Jev 调用`);
      apiKey = '';
    }
    rows.push(row);
    const flag = row.decide_ok ? '✓' : row.expectJevMayDiffer ? '~' : '✗';
    console.log(
      `${flag} ${row.id} gold=${row.gold} decide=${row.decide}` +
        (useJev ? ` jev=${row.jev}${row.jev_error ? ` err=${row.jev_error}` : ''}` : ''),
    );
  }

  const summaryPath = resolve(dirname(out), 'last-summary.json');
  const summary = writeReport(
    rows,
    {
      generated: new Date().toISOString(),
      jevEnabled: useJev,
      keyDiag: keyDiag(apiKey || loadApiKey().key),
      keySource: source,
    },
    out,
    summaryPath,
  );
  console.log('---');
  console.log(`report: ${out}`);
  console.log(`summary: ${summaryPath}`);
  console.log(
    `decide ${summary.decideOk}/${summary.caseCount}` +
      (useJev ? ` jev ${summary.jevOk}/${summary.caseCount}` : ''),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error('fatal:', e?.message || e);
    process.exit(1);
  });
}
