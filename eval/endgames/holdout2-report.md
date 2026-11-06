# Holdout fixes + second blind holdout (holdout2)

## Before / after (decide, Jev)

| set | decide before | decide after | Jev before (runs) | Jev after (runs) |
|---|---|---|---|---|
| cases.jsonl (50) | 50/50 | 50/50 | 48–50 | 49, 50, 50, 50 |
| pairs.jsonl pairs (30) | 30/30 | 30/30 | 26–29 | 28, 28, 28 |
| holdout-pairs pairs (31) | 21/31 (51/62 cases) | 30/31 (61/62) | 21–23 | 29, 29, 29 (60/62) |
| unit tests | 359 pass | 364 pass, 0 fail | | |

## holdout2 — blind (29 pairs / 58 cases, written before any run; no policy changes after)

| system | case acc | pair acc |
|---|---|---|
| decide | 53/58 (91.4%) | 24/29 (82.8%) |
| Jev runs 1/2/3 | 48, 49, 48 /58 | 19, 20, 19 /29 (~67%) |

Gold legality: 57/58 at blind time. **k13a** (四王炸 over a straight flush) was flagged illegal because the
move generator only produced the 4-joker bomb when following a 4-card play — an engine bug, not a gold error.
Fixed afterwards in `engine/legal.js` (+ unit test). With that fix: decide 54/58, 25/29; Jev 49/58, 20/29
(`holdout2-report-enginefix.md`).

### Misses by weakness (blind)
1. **Overtaking partner without partner-first persona** — decide + Jev, all runs: k17b (partner Q, nobody short → A),
   k54b (short enemy already passed → A), k27a (partner on **1 card** plays 10 → J). The repo's convention (eg002:
   follow partner's pair 6 with pair 9) allows overtaking; mainstream play passes, and with partner on 1 card
   (k27a) overtaking is clearly wrong. Biggest real gap.
2. **Opponent at 2, pair + orphans** — decide k02b leads pair 6 (same eg015 conflict as h01b). Jev gets it.
3. **Two singles, big first incl. level card** — Jev k03b (level 4: leads J not 4), k37b (level 9: leads 2 not A).
   Jev still misreads level rank when the level card isn't in the move's label context. decide ✓.
4. **Wild economy** — Jev k05b spends wild for pair 9 with opponents on 5. decide ✓.
5. **Keep a one-play finish** — Jev k09a breaks JJJ66 for pair 6. decide ✓.
6. **Go out over partner** — Jev k42a passes with 1 card that beats partner's 8. decide ✓.
7. **Save jokers when opponents long** — Jev k47b (run 3) BJ instead of A.
8. (k13a rocket vs straight flush — engine generator bug, now fixed.)

## What changed
- **Engine** (`engine/compare.js`): 四王炸 bomb weight 100 → beats every bomb and straight flush.
  `engine/legal.js`: always generate the 4-joker bomb. Tests: `test/rocket.test.js` (5 tests).
- **New** `policy/shape.js`: `minPlays` (1/2/≥3 plays to empty a hand), `restAfter`, `usesWild`.
- **decide** (`policy/index.js`, `policy/filters.js`) — general rules:
  - partner on 2 cards, I lead → smallest natural pair (never from a bomb);
  - two singles left (no one-play finish, partner not on 1) → lead the stronger single;
  - opponent on 2, I lead, short hand → bonus for ≥3-card shapes they can't follow (not when I can go out);
  - following with opponents ≥3 cards: penalise moves that don't reduce a ≤2-play finish (`keepFinish`);
  - following with opponents ≥4 cards: penalise moves that use the wild (`keepWild`);
  - stopping a ≤2-card opponent (not partner's trick): +40 for any non-bomb beat, and structure-break penalty/filter waived;
  - feeding a 1-card partner: prefer orphan single ≤10, break a pair only if none;
  - leading vs long opponents: small-orphan bonus extended from ≤8 to ≤10.
- **Jev**: hints for each rule (partner-2, two singles, opponent-2 shapes, keep finish — only when every follow breaks it,
  wild economy, wild bombs vs last card, feed with orphan); candidate tags `[用逢人配]`, `[逢人配补成炸弹]`,
  `[拆散可走完的牌]`; when an opponent has ≤1 card and a bomb exists, drop non-bomb moves that use bomb cards.
  "Don't bomb ordinary / don't use wild" hint narrowed to opponents ≥4 (it caused eg049 regressions at ≥3).

## Gold
- No golds changed. Disputed golds (h09b, h32b, h52b, h73b, h87a/b, h85a, h20a, h21b, h70b) kept as written —
  they match mainstream play (save the wild, lead small orphans, keep finishing shapes, feed with orphans, big single first).
- Known conflict left open: **h01b / k02b** (opponent on 2 → lead single) vs **eg015** (opponent on 2 → pair 4, justified
  by hidden partner strength). decide can't tell them apart, so it keeps eg015 and misses h01b/k02b.
- holdout2 golds I'm unsure of: k02b (above), k09b (pair J vs pair 6 to stop), k14b (feed with 5 from plate vs orphan K),
  and k17b/k54b (pass vs overtake partner — depends on the repo's partner convention).

## Files
- `eval/endgames/holdout2-pairs.jsonl`, generator `scripts/gen-holdout2-pairs.py`
- `eval/endgames/holdout2-report-run{1,2,3}.md/.json` (blind), `holdout2-report-enginefix.md/.json`
- `eval/endgames/holdout-report-after.md/.json`, `pairs-report.md`, `last-report.md`
- `policy/shape.js`, `test/rocket.test.js`
