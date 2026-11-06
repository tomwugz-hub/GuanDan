# Round 6 report

## Phase 1 fixes (tuned only on dev-r6 and earlier dev sets)
- Backups of the pre-change files are in backups/pre-round6/. The frozen post-change copies are in backups/post-round6/, and their md5s are in backups/policy-r6-frozen.md5. All files still matched those md5s after the final runs.
- Changes:
  - filters.js: partner overtake may break structure when the next enemy holds exactly the trick size (`nextEnemyIs`). Rule 4c (don't break a bomb when leading) now also applies when the partner has 1 or 2 cards.
  - index.js:
    - `breakNoOrphan` costs −30 when following a single by breaking a pair or triple while enemies have 3 or more cards.
    - `noCounterBomb` costs −60.
    - `leadBombLate` now starts at 4 enemy cards (was 5).
    - New `planWeakFirstTwo` rule for the last two plan units.
  - jevCandidates.js / jevState.js:
    - Jev candidates are now limited to moves within 60 points of decide's best move (`JEV_TOPK_GAP`). Hand-emptying moves are always kept.
    - New tags: bomb then finish, breaks a pair, wastes a big card, smallest orphan single.
    - When a candidate bomb leaves only one play, the anti-bomb hints are dropped.
    - The hand plan is reordered to match the candidate tags.
- Unit tests: 415 pass, including test/round6.test.js and test/play.test.js.

## Dev and regression results (b5 run, Jev runs 1 and 2)
| set | decide | Jev1 | Jev2 |
|---|---|---|---|
| dev-r6 (150) | 143 | 136 | 137 |
| dev-follow | 142 | 141 | 140 |
| dev-lead | 146 | 143 | 144 |
| dev-real | 119 | 119 | 119 |
| cases | 50 | 49 | 49 |
| pairs | 60 | 60 | 60 |
| holdout | 62 | 62 | 62 |
| holdout2 | 58 | 58 | 58 |
| holdout3 | 56 | 56 | 56 |
| holdout4 | 55 | 55 | 54 |
| frozen100 (check) | 202 | 202 | 202 |

dev-r6 before the fixes: decide 122, Jev 121 / 122.

## Final test-only runs (each run once, no tuning afterwards)
| set | decide | Jev run1 | Jev run2 | previous |
|---|---|---|---|---|
| frozen-real4 (120, new) | 108 (90%) | 109 (90.8%) | 109 | — |
| frozen-real3 (120) | 106 (88.3%) | 104 (86.7%) | 104 | decide 108 / Jev 100 |

- frozen-real3, decide lost 2: t067 now passes where a 5-bomb was expected, and t100 leads a pair of 10 where BJ was expected.
- frozen-real3, Jev gained 4: t029, t081, t085, t094.
- frozen-real4, weakest slice: enemyMin=3, 18/23 for every system. Most misses there are bomb or overtake decisions on the partner's play: u050, u077, u082, u117.
- Debatable frozen-real4 golds (reported only, not changed):
  - u082: a 5-card bomb (wild J) empties the hand, but the gold says protect partner and pass.
  - u006: pair RJ over partner, then a QQQQ bomb finishes the hand.
