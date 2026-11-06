/**
 * Node 端：用 Jev（TypeSafe）为一个局面选着法。密钥只从环境变量读取，绝不返回给前端。
 */
import { cards as parseCards, formatCard } from '../engine/cards.js';
import { classify, interpretAs } from '../engine/combos.js';
import { decide, labelCombo } from '../policy/index.js';
import { pickWithJev } from '../policy/jevScore.js';
import { buildJevState } from '../policy/jevState.js';
import { buildJevCandidates } from '../policy/jevCandidates.js';

export function jevKey() {
  return process.env.TYPESAFE_API_KEY_NEW || process.env.TYPESAFE_API_KEY || '';
}

function comboSummary(combo, cardList) {
  if (!combo || combo.type === 'pass') return '过牌';
  const cs = (cardList || []).map(formatCard).join(' ');
  return cs ? `${labelCombo(combo)} [${cs}]` : labelCombo(combo);
}

/** @param {object} c 局面（play/core.js snapshot 格式） */
export async function jevPick(c) {
  const apiKey = jevKey();
  const seat = c.seat;
  const levelRank = c.levelRank || '2';
  const leading = !!c.leading;
  const hands = [0, 1, 2, 3].map((s) => parseCards(c.hands[String(s)] || []));
  let previous = null;
  if (!leading && c.previous?.cards?.length) {
    const pc = parseCards(c.previous.cards);
    previous = (c.previous.type && interpretAs(pc, c.previous.type, levelRank)) || classify(pc, levelRank);
  }
  const lastPlayer = c.trickMeta?.lastPlayer ?? null;
  const partnerSeat = (seat + 2) % 4;
  const partnerCombo = c.trickMeta?.partnerLastPlay || (lastPlayer === partnerSeat ? previous : null);
  const ctx = {
    hand: hands[seat], previous: leading ? null : previous, levelRank, leading,
    firstLeadOfDeal: !!c.firstLeadOfDeal, seat, remainingSeatCounts: hands.map((h) => h.length),
    partnerCombo, playedCards: parseCards(c.playedCards || []), persona: null, lastPlaySeat: lastPlayer,
  };
  const rec = decide(ctx);
  const toBeatIsPartner = !leading && lastPlayer === partnerSeat;
  const candidates = buildJevCandidates(rec, {
    hand: hands[seat], previous: leading ? null : previous, levelRank, leading,
    seatCounts: hands.map((h) => h.length), seat, K: 8, preferPassForPartner: false,
    lastPlaySeat: lastPlayer, persona: null, labelFn: (combo, cl) => comboSummary(combo, cl),
  });
  for (const cand of candidates) {
    if (cand.move?.cards?.length === hands[seat].length && !cand.label.includes('[走完]')) cand.label += ' [走完]';
  }
  const asOut = (move, extra) => ({
    cards: (move.cards || []).map(formatCard), type: move.combo?.type || 'pass', rank: move.combo?.rank ?? null, ...extra,
  });
  if (!candidates.length) return asOut(rec.move, { engine: 'decide', note: 'no_candidates' });
  if (candidates.length === 1) return asOut(candidates[0].move, { engine: 'jev', note: 'single_candidate' });
  if (!apiKey) return asOut(rec.move, { engine: 'decide', error: 'missing_api_key' });
  const state = buildJevState({
    seat, hand: hands[seat], levelRank, leading, previous: leading ? null : previous, persona: null,
    seatCounts: hands.map((h) => h.length), candidates, controlSeat: leading ? seat : (c.trickMeta?.controlSeat ?? lastPlayer),
    partnerLastPlay: c.trickMeta?.partnerLastPlay || null, lastPlayer: leading ? null : lastPlayer, toBeatIsPartner, // r9：与 selfplay/jevAgent 一致（领出时无“上家出牌者”） preferPassForPartner: false,
  });
  const r = await pickWithJev({ candidates, state, persona: null, apiKey });
  if (r.error || r.index < 0) return asOut(rec.move, { engine: 'decide', error: r.error || 'invalid_choice' });
  return asOut(candidates[r.index].move, { engine: 'jev', label: candidates[r.index].label });
}
