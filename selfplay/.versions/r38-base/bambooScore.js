/**
 * StartLux-Decision 27B AutoThink via Bamboo Relay.
 * POST https://api.bamboonode.dev/v1/decisions (alias /v1/systemone)
 * model=startlux-decision-27b-autothink, think_mode=auto, allow_none=false.
 * Reuses startluxScore state/move English rendering so candidates match Jev/local Instant.
 * Key: BAMBOO_API_KEY only (never logged). Free during Bamboo testing rollout.
 */
import fs from 'node:fs';
import { buildStateEn, moveEn } from './startluxScore.js';

export const BAMBOO_MODEL = process.env.STARTLUX_BAMBOO_MODEL || 'startlux-decision-27b-autothink';
export const BAMBOO_URL = process.env.STARTLUX_BAMBOO_URL || 'https://api.bamboonode.dev/v1/decisions';

/** Load BAMBOO_API_KEY from env, else secrets file. Never logs the key. */
export function ensureBambooKey() {
  if (process.env.BAMBOO_API_KEY) return process.env.BAMBOO_API_KEY;
  const p = process.env.BAMBOO_API_KEY_FILE || '/home/box/.secrets/BAMBOO_API_KEY';
  try {
    if (fs.existsSync(p)) {
      const k = fs.readFileSync(p, 'utf8').trim();
      if (k) {
        process.env.BAMBOO_API_KEY = k;
        return k;
      }
    }
  } catch { /* ignore */ }
  return '';
}

/**
 * @returns {Promise<{ index: number, choice: string|null, confidence: number|null, probabilities?: object, usage?: object, error?: string, errBody?: string, status?: number }>}
 */
export async function pickWithBamboo({ candidates, raw, apiKey, timeoutMs = 120000, url } = {}) {
  if (!candidates?.length) return { index: -1, choice: null, confidence: null, error: 'empty_candidates' };
  if (candidates.length === 1) return { index: 0, choice: candidates[0].key, confidence: 1 };
  const key = apiKey || ensureBambooKey();
  if (!key) return { index: -1, choice: null, confidence: null, error: 'noKey' };

  const handLen = raw?.hand?.length || 0;
  const criteria = {};
  for (const c of candidates) criteria[c.key] = moveEn(c.move, handLen);

  const body = {
    model: BAMBOO_MODEL,
    state: buildStateEn(raw || {}),
    questions: {
      move: {
        type: 'choice',
        instructions: 'Which move is best for my team right now?',
        criteria,
      },
    },
    think_mode: process.env.STARTLUX_THINK_MODE || 'auto',
    allow_none: false,
  };
  if (process.env.STARTLUX_THINK_BUDGET) body.think_budget = Number(process.env.STARTLUX_THINK_BUDGET);

  const endpoint = (url || BAMBOO_URL).replace(/\/$/, '');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-json */ }
    if (!res.ok) {
      return {
        index: -1, choice: null, confidence: null,
        error: `http_${res.status}`, status: res.status,
        errBody: text.slice(0, 200), usage: json?.usage ?? null,
      };
    }
    const ans = json?.answers?.move;
    if (!ans || ans.type !== 'choice') {
      return { index: -1, choice: null, confidence: null, error: 'bad_answer', errBody: text.slice(0, 200), usage: json?.usage ?? null };
    }
    let choice = ans.choice;
    if (choice == null) {
      return { index: -1, choice: null, confidence: null, error: 'none_choice', usage: json?.usage ?? null };
    }
    let idx = candidates.findIndex((c) => c.key === choice);
    if (idx < 0 && typeof choice === 'string' && /^[A-Z]$/i.test(choice)) {
      idx = choice.toUpperCase().charCodeAt(0) - 65;
    }
    if (idx < 0 && /^\d+$/.test(String(choice))) idx = Number(choice);
    if (idx < 0 || idx >= candidates.length) {
      return { index: -1, choice: null, confidence: null, error: 'invalid_choice', usage: json?.usage ?? null };
    }
    return {
      index: idx,
      choice: candidates[idx].key,
      confidence: ans.confidence ?? null,
      probabilities: ans.probabilities ?? null,
      none_probability: ans.none_probability ?? null,
      usage: json?.usage ?? null,
    };
  } catch (err) {
    const msg = String(err?.name === 'AbortError' ? 'timeout' : err?.message || err);
    return { index: -1, choice: null, confidence: null, error: msg };
  } finally {
    clearTimeout(t);
  }
}

export { buildStateEn, moveEn };
