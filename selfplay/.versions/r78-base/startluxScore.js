/**
 * StartLux-Decision adapter: pick one of the same candidates Jev sees, using a local
 * StartLux-Decision GGUF served by stock llama-server (CPU OK). Re-implements the
 * package's prompt (startlux_decision/jevfmt.py, jev_render_v3) and option-letter
 * read-out in Node so no torch/transformers is needed.
 *
 *   llama-server -m StartLux-Decision-v1.1-2B-Instant-Q4_K_M.gguf -c 4096 --parallel 1 \
 *     --ctx-checkpoints 0 -b 4096 -ub 4096 --port 8081
 *   STARTLUX_URL=http://127.0.0.1:8081 (default)
 *
 * Weights: CC BY-NC 4.0 (non-commercial only). Engine code: Apache-2.0.
 */
const SYSTEM = 'Apply the criterion to the evidence. Choose exactly one listed option. Answer with its letter only.';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LETTER_IDS = Array.from({ length: 26 }, (_, i) => 32 + i); // decision_config.json letter_token_ids
const TEMP_CHOICE = Number(process.env.STARTLUX_TEMP_CHOICE || 1.2937); // v1.1-2B-Instant decision_config

const TYPE_EN = {
  single: 'single',
  pair: 'pair',
  triple: 'triple',
  fullhouse: 'full house (triple + pair)',
  straight: 'straight (5 in a row)',
  pairSeq: 'pair sequence (3 consecutive pairs)',
  tripleSeq: 'triple sequence (2 consecutive triples)',
  bomb: 'bomb',
  straightFlush: 'straight flush',
};

function isPass(m) {
  return !m?.cards?.length || m?.combo?.type === 'pass';
}

export function moveEn(move, handLen) {
  if (isPass(move)) return 'pass (play nothing this trick)';
  const c = move.combo;
  const ranks = move.cards.map((x) => x.rank).join(' ');
  let s = `play ${TYPE_EN[c.type] || c.type} of rank ${c.rank} [${ranks}]`;
  if (c.type === 'bomb') s = `play bomb of ${move.cards.length} ${c.rank}s [${ranks}]`;
  if (move.cards.length === handLen) s += ', empties my hand (I go out)';
  return s;
}

function comboEn(p) {
  if (!p) return null;
  return `${TYPE_EN[p.type] || p.type} of rank ${p.rank}`;
}

export function buildStateEn(raw) {
  const { hand = [], seatCounts = [], seat = 0, levelRank = '2', leading, previous, lastPlayer } = raw;
  const role = (s) => (s === seat ? 'me' : s === (seat + 2) % 4 ? 'partner' : 'opponent');
  const seats = [1, 2, 3].map((d) => (seat + d) % 4).map((s) => `${role(s)} (seat ${s}) holds ${seatCounts[s]} cards`);
  return {
    game: 'Guandan (two decks, 2v2: me and my partner vs two opponents). First team to empty hands wins. Bombs (4+ same rank) beat any non-bomb; bigger bombs beat smaller. Rank order: 2<3<...<K<A<level rank<black joker<red joker.',
    level_rank: levelRank,
    my_hand: hand.map((c) => c.rank).join(' '),
    my_card_count: hand.length,
    seats,
    situation: leading
      ? 'I am leading a new trick (I may play any combination).'
      : `I must beat ${comboEn(previous)} played by my ${role(lastPlayer)} (seat ${lastPlayer}), or pass.`,
    principles: [
      'Never bomb or overtake a trick my partner is winning unless it wins the game.',
      'If an opponent is about to go out (1-2 cards), stop them, using a bomb if needed.',
      'Do not waste bombs or top cards on small cards when opponents still hold many cards.',
      'When leading, prefer combinations an opponent with very few cards cannot follow; help a partner who is about to go out.',
    ],
  };
}

function renderPrompt(stateObj, instructions, options) {
  const lines = options.map((o, k) => `${LETTERS[k]}) ${o.id}: ${o.criterion}`);
  const content =
    'Evidence:\n' + JSON.stringify(stateObj) + '\n\nQuestion: ' + instructions.trim() + '\nOptions:\n' + lines.join('\n');
  return (
    `<|im_start|>system\n${SYSTEM}<|im_end|>\n<|im_start|>user\n${content}<|im_end|>\n` +
    '<|im_start|>assistant\n<think>\n\n</think>\n\n'
  );
}

async function letterLogprobs(url, prompt, count, timeoutMs) {
  for (const n of [256, 200000]) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url.replace(/\/$/, '') + '/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, n_predict: 1, temperature: -1, n_probs: n, cache_prompt: false }),
        signal: ctl.signal,
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
      const out = await res.json();
      const rows = out.completion_probabilities || out.probs;
      const got = new Map((rows?.[0]?.top_logprobs || []).map((x) => [x.id, x.logprob]));
      const ids = LETTER_IDS.slice(0, count);
      if (ids.every((id) => got.has(id))) return ids.map((id) => got.get(id));
    } finally {
      clearTimeout(t);
    }
  }
  throw new Error('letters_missing');
}

/**
 * @returns {Promise<{ index: number, choice: string|null, confidence: number|null, probabilities?: number[], error?: string }>}
 */
export async function pickWithStartLux({ candidates, raw, url, timeoutMs = 600000 } = {}) {
  if (!candidates?.length) return { index: -1, choice: null, confidence: null, error: 'empty_candidates' };
  if (candidates.length === 1) return { index: 0, choice: candidates[0].key, confidence: 1 };
  const base = url || process.env.STARTLUX_URL || 'http://127.0.0.1:8081';
  const handLen = raw?.hand?.length || 0;
  const options = candidates.slice(0, 26).map((c, i) => ({ id: `move_${i + 1}`, criterion: moveEn(c.move, handLen) }));
  const prompt = renderPrompt(buildStateEn(raw || {}), 'Which move is best for my team right now?', options);
  try {
    const lp = await letterLogprobs(base, prompt, options.length, timeoutMs);
    const z = lp.map((v) => v / TEMP_CHOICE);
    const m = Math.max(...z);
    const e = z.map((v) => Math.exp(v - m));
    const s = e.reduce((a, b) => a + b, 0);
    const p = e.map((v) => v / s);
    let best = 0;
    for (let i = 1; i < p.length; i++) if (p[i] > p[best]) best = i;
    return { index: best, choice: candidates[best].key, confidence: p[best], probabilities: p };
  } catch (err) {
    return { index: -1, choice: null, confidence: null, error: String(err?.message || err) };
  }
}
