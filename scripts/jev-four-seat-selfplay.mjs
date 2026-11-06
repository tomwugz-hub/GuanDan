#!/usr/bin/env node
/**
 * 四座掼蛋自对弈 + TypeSafe Jev 每回合择着法。
 * 用法: node scripts/jev-four-seat-selfplay.mjs [--max-plays=40]
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createMatch, createRound, applyPlay } from '../engine/state.js';
import { TYPES } from '../engine/combos.js';
import { RULESETS } from '../engine/rulesets.js';
import { formatCard } from '../engine/cards.js';
import { decide, labelCombo } from '../policy/index.js';
import { pickWithJev } from '../policy/jevScore.js';
import { buildJevState } from '../policy/jevState.js';

const SEAT_NAMES = ['东', '南', '西', '北'];
const PERSONAS = [
  { name: '东', style: 'aggressive', brief: '偏炸、抢控' },
  { name: '南', style: 'conservative', brief: '保结构、少早炸' },
  { name: '西', style: 'partner-first', brief: '护搭档、少砸队友' },
  { name: '北', style: 'balanced', brief: '中庸' },
];

const HARD_GUARD = 250;
const DEFAULT_MAX = 80;

function parseArgs(argv) {
  let maxPlays = DEFAULT_MAX;
  for (const a of argv.slice(2)) {
    const m = a.match(/^--max-plays=(\d+)$/);
    if (m) maxPlays = Math.max(1, Number(m[1]));
  }
  return { maxPlays: Math.min(maxPlays, HARD_GUARD) };
}

/** 读 API Key：优先 NEW，再旧 key；env 优先于 box-secrets（不打印 key）。 */
function loadApiKey() {
  const candidates = [];
  const push = (key, source) => {
    if (key && !candidates.some((c) => c.key === key)) candidates.push({ key, source });
  };
  // Prefer NEW — older TYPESAFE_API_KEY may be revoked (401).
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

function keyDiag(key) {
  if (!key) return 'missing';
  const sha12 = createHash('sha256').update(key).digest('hex').slice(0, 12);
  return `len=${key.length} sha12=${sha12}`;
}

function lastOf(round, seat) {
  for (let i = round.tricks.length - 1; i >= 0; i--) {
    if (round.tricks[i].seat === seat) return round.tricks[i].combo;
  }
  return null;
}

function cardsSummary(cards) {
  if (!cards?.length) return '过';
  return cards.map(formatCard).join(' ');
}

function comboSummary(combo, cards) {
  if (!combo || combo.type === TYPES.PASS) return '过牌';
  return `${labelCombo(combo)} [${cardsSummary(cards)}]`;
}

function moveKey(m) {
  const ids = (m.cards || []).map((c) => c.id).sort((a, b) => a - b).join(',');
  return `${m.combo?.type || 'pass'}:${ids}`;
}

function isPassMove(m) {
  return !m?.cards?.length || m.combo?.type === TYPES.PASS;
}

/** 取 top-K 唯一候选；跟牌时若合法则含过牌。 */
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
    const pass = { cards: [], combo: { type: TYPES.PASS, rank: null, size: 0 } };
    push(pass);
  }
  const top = pool.slice(0, Math.min(K, pool.length));
  return top.map((move, i) => ({
    key: `m${i}`,
    label: comboSummary(move.combo, move.cards),
    move,
  }));
}

function recentTricks(round, n = 3) {
  const tricks = round.tricks.slice(-n);
  return tricks.map((t) => ({
    seat: t.seat,
    seatName: SEAT_NAMES[t.seat],
    combo: comboSummary(t.combo, t.cards),
  }));
}

function logLine({ seat, persona, move, jevChoice, confidence, fallback, playNo }) {
  const cards = isPassMove(move) ? '过' : cardsSummary(move.cards);
  const combo = labelCombo(move.combo);
  const conf =
    confidence == null ? '-' : typeof confidence === 'number' ? confidence.toFixed(2) : String(confidence);
  const fb = fallback ? ' fallback=yes' : '';
  console.log(
    `#${playNo} 座${seat}${persona.name}(${persona.brief}) ${combo} ${cards} jev=${jevChoice ?? '-'} conf=${conf}${fb}`,
  );
}

async function main() {
  const { maxPlays } = parseArgs(process.argv);
  let { key: apiKey, source, alternates = [] } = loadApiKey();
  console.log(`Jev self-play | ruleset=suqian level=2 maxPlays=${maxPlays} key=${keyDiag(apiKey)} via=${source}`);
  if (!apiKey) {
    console.warn('警告: 无 TYPESAFE_API_KEY，将全程 fallback 到 decide.move');
  }

  const match = createMatch({ levelRank: '2', ruleset: RULESETS.SUQIAN });
  const round = createRound(match, { dealerSeat: 0 });

  let plays = 0;
  let jevCalls = 0;
  let fallbacks = 0;
  let authError = null;
  let authWarned = false;

  while (round.finished.length < 3 && plays < maxPlays) {
    const seat = round.currentSeat;
    const persona = PERSONAS[seat];
    const leading = !round.lastCombo || round.lastCombo.type === TYPES.PASS;
    const partnerSeat = (seat + 2) % 4;

    const ctx = {
      hand: round.hands[seat],
      previous: leading ? null : round.lastCombo,
      levelRank: match.levelRank,
      leading,
      firstLeadOfDeal: leading && round.tricks.length === 0,
      seat,
      remainingSeatCounts: round.hands.map((h) => h.length),
      partnerCombo: round.lastCombo && round.lastCombo.type !== 'pass' && round.lastPlayer === partnerSeat ? round.lastCombo : null,
      playedCards: round.tricks.flatMap((t) => t.cards),
    };

    const rec = decide(ctx);
    const candidates = buildCandidates(rec, { leading, K: 5 });

    let picked = candidates[0].move;
    let jevChoice = null;
    let confidence = null;
    let fallback = false;

    if (candidates.length === 1 || !apiKey) {
      fallback = candidates.length > 1 && !apiKey;
      if (fallback) fallbacks += 1;
      jevChoice = candidates[0].key;
    } else {
      const state = buildJevState({
        round,
        seat,
        hand: round.hands[seat],
        levelRank: match.levelRank,
        leading,
        previous: leading ? null : round.lastCombo,
        persona,
        candidates,
      });

      jevCalls += 1;
      const result = await pickWithJev({
        candidates,
        state,
        persona,
        apiKey,
      });
      jevChoice = result.choice;
      confidence = result.confidence;

      if ((result.error === 'http_401' || result.error === 'http_403') && alternates.length) {
        const next = alternates.shift();
        console.warn(`Jev ${result.error} on ${source}; rotating to ${next.source} (${keyDiag(next.key)})`);
        apiKey = next.key;
        source = next.source;
        // retry once with rotated key
        jevCalls += 1;
        const retry = await pickWithJev({ candidates, state, persona, apiKey });
        Object.assign(result, retry);
        jevChoice = result.choice;
        confidence = result.confidence;
      }
      if (result.error || result.index < 0) {
        fallback = true;
        fallbacks += 1;
        picked = candidates[0].move;
        if (result.error === 'http_401' || result.error === 'http_403') {
          authError = result.error;
          if (!authWarned) {
            authWarned = true;
            console.warn(`Jev auth error ${result.error} (${keyDiag(apiKey)}); 本局剩余回合将 fallback`);
            apiKey = ''; // stop hammering a dead key
          }
        } else if (result.error && plays < 5) {
          console.warn(`Jev fail: ${result.error}`);
        }
      } else {
        picked = candidates[result.index].move;
        jevChoice = result.choice || candidates[result.index].key;
      }
    }

    plays += 1;
    logLine({
      seat,
      persona,
      move: picked,
      jevChoice,
      confidence,
      fallback,
      playNo: plays,
    });

    const r = applyPlay(round, seat, picked.cards || []);
    if (!r.ok) {
      console.error(`非法着法 座${seat}: ${r.reason}; 改用 decide.move`);
      fallbacks += 1;
      const r2 = applyPlay(round, seat, rec.move.cards || []);
      if (!r2.ok) {
        console.error(`decide.move 也非法: ${r2.reason}; 停止`);
        break;
      }
    }
  }

  const finishedEarly = round.finished.length < 3;
  console.log('---');
  console.log(
    `finishOrder: [${round.finished.join(', ')}] ${round.finished.map((s) => SEAT_NAMES[s]).join('→') || '(未完)'}`,
  );
  console.log(
    `summary: plays=${plays} jevCalls=${jevCalls} fallbacks=${fallbacks} finished=${round.finished.length}${finishedEarly ? ' (hit max-plays/guard)' : ''}`,
  );
  if (authError) console.log(`note: auth_error=${authError} keyDiag=${keyDiag(apiKey)}`);
  console.log(
    `remaining: ${round.hands.map((h, i) => `${SEAT_NAMES[i]}=${h.length}`).join(' ')}`,
  );
}

main().catch((e) => {
  console.error('fatal:', e?.message || e);
  process.exit(1);
});
