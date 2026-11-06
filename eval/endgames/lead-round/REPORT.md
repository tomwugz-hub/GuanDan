# Lead round report (Sat Oct 17, 2026)

Policy is frozen in backups/policy-lead-frozen.md5, with a copy in backups/post-lead/. The pre-change backup is backups/pre-lead/.
frozen-real and frozen-real2 were each run ONCE after the freeze (decide + 2 Jev runs). No tuning was done afterwards.

## dev-lead (TUNING, 150 = 120 leads + 30 enemy-on-1 follows)
| | decide | Jev |
|---|---|---|
| before | 129/150 (86%); lead 101/120; follow 28/30 | 127/150 (1 run) |
| after | 146/150 (97%); lead 116/120; follow 30/30 | 140/150, 140/150 |

## Regression (decide / Jev run1 / Jev run2; previous round's Jev in brackets)
| set | decide | Jev |
|---|---|---|
| cases | 50/50 | 49, 50 (50, 50) |
| pairs | 60/60 | 60, 60 (60, 60) |
| holdout | 62/62 | 62, 62 (62, 62) |
| holdout2 | 58/58 | 58, 58 (58, 57) |
| holdout3 | 56/56 | 55, 56 (55, 55) |
| holdout4 | 55/56 | 54, 54 (54, 55) |
| dev-real | 119/120 (previously 117) | 119, 119 |
| frozen100 (check only) | 202/202 | 197, 197 (200, 200) |

Unit tests: 390/390 (9 are new, in test/handplan.test.js).
Timing: mean 1.8 ms per decision; slowest 25 ms, including a 27-card hand.

## Final measurements (once each)
| set | decide | Jev1 | Jev2 |
|---|---|---|---|
| frozen-real (previous: 87 / 85 / 87%) | 110/120 (92%) | 109 (91%) | 110 (92%) |
| frozen-real lead slice (previous: 76%) | 31/33 (94%) | 31/33 | 31/33 |
| frozen-real follow slice | 79/87 (91%) | 78/87 | 79/87 |
| frozen-real enemyMin=1 (previous: 81%) | 19/21 (90%) | 19/21 | 19/21 |
| frozen-real high confidence | 66/68 | 65/68 | 66/68 |
| frozen-real2 (fresh) | 109/120 (91%) | 106 (88%) | 106 (88%) |
| frozen-real2 lead slice | 32/35 (91%) | 32/35 | 32/35 |
| frozen-real2 follow slice | 77/85 (91%) | 74/85 | 74/85 |
| frozen-real2 enemyMin=1 | 17/18 | 17/18 | 17/18 |
| frozen-real2 high confidence | 68/70 | 67/70 | 67/70 |

Caveat: frozen-real had already been viewed after one tuning round. frozen-real2 is the honest number.

## Remaining weaknesses (read from misses after the final runs; NOT tuned on)
- Follows that call for a bomb to finish, or a control card to block (frozen-real2: s062, s066, s111, s008, s061). decide either passes or plays the plain card.
- Protecting the partner: beating a partner's lead when it should pass (s078, s085; frozen-real: r115).
- Enemy on 2: leading an unfollowable triple (s053; frozen-real: r113).
- Ordering with two cards or two plays left (s092, s100; frozen-real: r091).
- Jev is weaker than decide when holding a wild (frozen-real2: 23/30 vs 27/30), and frozen100 Jev dropped 200 → 197.
- dev-lead: L091 (two pairs vs enemy on 2: the strong-pair-first gold conflicts with the vsTwoSingle rule), L101 (a straight that needs the wild), L089/L103 (low-confidence labels).
