import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, botStepDecide, isOver, coachMove, play, moveGap, COACH_GAP_MIN } from '../play/core.js';

test('r18 moveGap: best − move score; unknown move → null', () => {
  const mk = (r) => ({ cards: [{ id: r, rank: r, suit: 'S' }], combo: { type: 'single', rank: r } });
  const coach = { lv: '2', scored: [{ move: mk('3'), score: 50 }, { move: mk('5'), score: 45 }, { move: mk('9'), score: 10 }] };
  assert.equal(moveGap(coach, mk('3')), 0);
  assert.equal(moveGap(coach, mk('5')), 5);
  assert.equal(moveGap(coach, mk('9')), 40);
  assert.equal(moveGap(coach, mk('K')), null);
});

test('r18 play(): differing move with small decide gap is minor (no disagreement prompt), large gap is not', () => {
  let small = null, big = null;
  for (let seed = 1; seed < 40 && !(small && big); seed++) {
    const g = newGame({ seed, progression: false });
    let guard = 0;
    while (!isOver(g) && guard++ < 300 && !(small && big)) {
      const seat = g.round.currentSeat;
      const c = coachMove(g, seat);
      const alt = c.scored.slice(1).find((x) => x.move.cards.length && c.move.cards.length && !small && c.scored[0].score - x.score < COACH_GAP_MIN && c.scored[0].score - x.score > 0)
        || c.scored.slice(1).find((x) => x.move.cards.length && !big && c.scored[0].score - x.score >= COACH_GAP_MIN + 20);
      if (alt) {
        const g2 = structuredClone({ ...g, rng: undefined }); g2.rng = g.rng;
        const res = play(g2, seat, alt.move.cards, { by: 'human', coach: c, preferCombo: alt.move.combo });
        if (res.ok && !res.entry.coach.same) {
          if (res.entry.coach.minor) small = res.entry.coach; else big = res.entry.coach;
        }
      }
      botStepDecide(g);
    }
  }
  assert.ok(small, 'found a small-gap differing move');
  assert.equal(small.minor, true);
  assert.ok(small.gap < COACH_GAP_MIN);
  assert.ok(big, 'found a large-gap differing move');
  assert.equal(big.minor, false);
  assert.ok(big.gap >= COACH_GAP_MIN);
});

test('r20 coach gap: threshold 6; pass vs play is never minor even with small gap', async () => {
  const core = await import('../play/core.js');
  assert.equal(core.COACH_GAP_MIN, 6);
  const mk = (r) => ({ cards: [{ id: r, rank: r, suit: 'S' }], combo: { type: 'single', rank: r } });
  const pass = { cards: [], combo: { type: 'pass' } };
  const coach = { lv: '2', move: pass, scored: [{ move: pass, score: 0.3 }, { move: mk('RJ'), score: -8.8 }, { move: mk('8'), score: -2 }] };
  assert.equal(core.coachDiffInfo(coach, mk('RJ')).minor, false);
  const coach2 = { lv: '2', move: mk('8'), scored: [{ move: mk('8'), score: 10 }, { move: mk('K'), score: 0.2 }, { move: mk('9'), score: 7 }] };
  assert.equal(core.coachDiffInfo(coach2, mk('K')).minor, false); // gap 9.8 (game4 move 6)
  assert.equal(core.coachDiffInfo(coach2, mk('9')).minor, true);
});
