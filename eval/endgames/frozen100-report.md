# frozen100: TEST-ONLY result (2026-10-17)
101 pairs / 202 cases, built from 24 themes in `scripts/gen-frozen100-pairs.py`. Golds were written before any run. Legality was checked with the engine only (`scripts/check-gold-legal.mjs`): 0 problems. Policy, engine, runner and set md5s are recorded in `backups/policy-v5-frozen.md5` and were verified after the runs. Nothing was tuned on this set.

| system | cases | pairs |
|---|---|---|
| decide (deterministic) | 202/202 | 101/101 |
| Jev run1 | 200/202 | 99/101 |
| Jev run2 | 201/202 | 100/101 |

## By theme (pairs)
| theme | pairs | decide | Jev r1 | Jev r2 |
|---|---|---|---|---|
| T1-partner-vs-enemy-follow | 5 | 5/5 | 5/5 | 5/5 |
| T2-bomb-vs-enemy-count | 5 | 5/5 | 5/5 | 5/5 |
| T3-bomb-sizing | 4 | 4/4 | 4/4 | 4/4 |
| T4-ordinary-suffices | 5 | 5/5 | 5/5 | 5/5 |
| T5-who-is-short-lead | 5 | 5/5 | 5/5 | 5/5 |
| T6-fullhouse-vs-feed | 4 | 4/4 | 4/4 | 4/4 |
| T7-straight-lead | 4 | 4/4 | 4/4 | 4/4 |
| T8-tube-lead | 4 | 4/4 | 4/4 | 4/4 |
| T9-plate-follow | 4 | 4/4 | 4/4 | 4/4 |
| T10-protect-next-enemy-short | 5 | 5/5 | 5/5 | 5/5 |
| T11-protect-shape-unanswerable | 4 | 4/4 | 4/4 | 4/4 |
| T12-partner-1-no-overtake | 4 | 4/4 | 4/4 | 4/4 |
| T13-finish-in-2-overtake | 4 | 4/4 | 4/4 | 4/4 |
| T14-two-singles-level | 5 | 5/5 | 5/5 | 5/5 |
| T15-wild-go-out | 4 | 4/4 | 4/4 | 4/4 |
| T16-wild-bomb | 4 | 4/4 | 4/4 | 4/4 |
| T17-late-control-big-pair | 5 | 5/5 | 5/5 | 5/5 |
| T18-singles-only-lead | 4 | 4/4 | 4/4 | 4/4 |
| T19-wild-follow-enemy-count | 4 | 4/4 | 4/4 | 4/4 |
| T20-enemy2-vs-partner2 | 4 | 4/4 | 4/4 | 4/4 |
| T22-lead-vs-follow | 4 | 4/4 | 2/4 | 3/4 |
| T23-bomb-vs-straightflush | 3 | 3/3 | 3/3 | 3/3 |
| T24-fullhouse-follow | 4 | 4/4 | 4/4 | 4/4 |
| T25-rocket-preserve | 3 | 3/3 | 3/3 | 3/3 |

## Misses
- Jev, T22 lead-vs-follow (follow side): it does not follow with the smallest sufficient card when enemies are long.
  - f089b: K instead of 10 (run1).
  - f091b: 9 instead of 7 (both runs).

## Caveat
This set is generated from templates of themes that the policy was recently fixed on, with clean single-principle hands (few distractors, enemies either ≤2 or ≥4 cards). The perfect decide score therefore mainly confirms coverage and consistency of those principles. It is not evidence of generalisation; holdout3/holdout4 (hand-written, messier) remain the harder signal. A future frozen set should use messier hands (mixed shapes, 3-card enemies, more distractors).

## Uncertain golds
0 cases are flagged `gold_unsure` in the file. Softer golds, where they rely on the adopted policy convention or a judgement call (29 pairs):
- T4 f015–f019 (side a): ordinary pair instead of bomb against a 1-card enemy. Adopted rule; some players bomb for safety.
- T10 f041–f045 (side a): overtake the partner when the next enemy has 2 cards. Adopted convention.
- T13 f054–f057 (side a): overtake the partner to finish in 2 plays.
- T17 f071–f075 (side b): break the small pair to feed a 1-card partner.
- T18 f076–f079 (side a): with only singles against a 1-card enemy, lead the biggest first.
- T20 f084–f087 (side a): against a 2-card enemy, any orphan single is accepted (lenient gold).
- T22 f088–f091 (side b): smallest sufficient beater when enemies are long.
