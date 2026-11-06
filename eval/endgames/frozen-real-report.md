# frozen-real: TEST-ONLY result (2026-10-17)

## How the set was built
- **Positions:** 120 late-game positions (some seat ≤10 cards or an enemy ≤5).
- **Source:** 80 self-play games from `scripts/selfplay-extract.mjs --games=80 --seed=7`, with random level ranks and a per-game, per-seat policy mix of decide / random-legal / greedy-small. That run produced 2,056 candidate positions in `eval/endgames/selfplay-pool.jsonl`.
- **Sampling:** stratified by lead/follow, enemy-count bucket, partner-short, bomb held, wild held and who played last. At most 3 positions per game.
- **Labelling:** golds were labelled by hand from the position plus the engine's legal-option list only (`scripts/frozen-real-labels.py`). decide/Jev outputs were never consulted. Acceptable alternatives are listed in `gold.alts`, matched strictly on main rank and optional size.
- **Legality:** every gold and every alt passed `scripts/check-gold-legal.mjs`.
- **Freeze:** md5s were recorded in `backups/frozen-real.md5` before the runs and verified after.

## Label confidence
| confidence | cases |
|---|---|
| high | 68 |
| medium | 46 |
| low | 6 |

Positions with multiple acceptable golds: see `gold.alts`.

## Results
| slice | n | decide | Jev r1 | Jev r2 |
|---|---|---|---|---|
| ALL | 120 | 96/120 (80%) | 97/120 (81%) | 99/120 (82%) |
| conf=high | 68 | 59/68 (87%) | 57/68 (84%) | 59/68 (87%) |
| conf=medium | 46 | 32/46 (70%) | 35/46 (76%) | 35/46 (76%) |
| conf=low | 6 | 5/6 (83%) | 5/6 (83%) | 5/6 (83%) |
| conf=high+medium | 114 | 91/114 (80%) | 92/114 (81%) | 94/114 (82%) |
| mode=follow | 87 | 73/87 (84%) | 75/87 (86%) | 76/87 (87%) |
| mode=lead | 33 | 23/33 (70%) | 22/33 (67%) | 23/33 (70%) |
| prevBy=None | 33 | 23/33 (70%) | 22/33 (67%) | 23/33 (70%) |
| prevBy=enemy | 49 | 38/49 (78%) | 40/49 (82%) | 41/49 (84%) |
| prevBy=partner | 38 | 35/38 (92%) | 35/38 (92%) | 35/38 (92%) |
| enemyMin=1 | 21 | 16/21 (76%) | 15/21 (71%) | 15/21 (71%) |
| enemyMin=2 | 22 | 19/22 (86%) | 19/22 (86%) | 19/22 (86%) |
| enemyMin=3 | 25 | 18/25 (72%) | 20/25 (80%) | 20/25 (80%) |
| enemyMin=4-5 | 27 | 23/27 (85%) | 23/27 (85%) | 25/27 (93%) |
| enemyMin=6+ | 25 | 20/25 (80%) | 20/25 (80%) | 20/25 (80%) |
| partner=1 | 21 | 17/21 (81%) | 17/21 (81%) | 18/21 (86%) |
| partner=2 | 20 | 16/20 (80%) | 15/20 (75%) | 15/20 (75%) |
| partner=3+ | 76 | 60/76 (79%) | 62/76 (82%) | 63/76 (83%) |
| partner=out | 3 | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) |
| bombHeld=False | 76 | 61/76 (80%) | 62/76 (82%) | 64/76 (84%) |
| bombHeld=True | 44 | 35/44 (80%) | 35/44 (80%) | 35/44 (80%) |
| wildHeld=False | 98 | 78/98 (80%) | 78/98 (80%) | 80/98 (82%) |
| wildHeld=True | 22 | 18/22 (82%) | 19/22 (86%) | 19/22 (86%) |
| myCount=1-3 | 18 | 15/18 (83%) | 16/18 (89%) | 16/18 (89%) |
| myCount=4-6 | 28 | 25/28 (89%) | 24/28 (86%) | 25/28 (89%) |
| myCount=7-12 | 74 | 56/74 (76%) | 57/74 (77%) | 58/74 (78%) |

r003 medium follow by=enemy em=3 p=3+ gold= single:4 | decide single:BJ{BJ} X | jev single:4{4} ok single:4{4} ok | enemy 3: smallest sufficient (level 4) keeps BJ

## Top weaknesses (both systems unless noted; ids are examples)
1. **Misses winning or finishing lines when following.**
   - r004: holds 8(level)+RJ against an enemy's 7. Both pass; RJ then 8 goes out.
   - r071: 5+RJ over the partner's 5. Both pass; RJ then 5 goes out.
   - r025: next enemy has 1 card. Plays single A; bomb 7777 then AA finishes.
   - r019: pass instead of RJ to take control for a 2-card partner.
2. **Leading into a short enemy with singles instead of an unfollowable shape.**
   - r076, r113: enemy on 2 cards. Both lead a single instead of a natural triple; the long-hand triple-lead filter still blocks it (same tension as q06a).
   - r097: enemy on 1 card. decide and Jev lead single J instead of a small pair.
   - r047 (Jev): enemy on 1 card, singles only. Jev leads 2 instead of the biggest card.
3. **Leading a full house when enemies are long or mid, sometimes by spending a wild or breaking a bomb.**
   - r064: FH 777QQ / 77755 breaks the 7777 bomb against a 3-card enemy. Rule 4c only covers enemies on ≤2 cards.
   - r038: wild-built FH.
   - r118: FH 33377 using the level triple instead of a small pair.
4. **Unnecessary bombs (decide):**
   - r014: bombs a 15-card enemy's A.
   - r119: wild bomb against a pairSeq from a 7-card enemy.
   - r065: wild bomb 222+8H instead of the level pair 88 against a 1-card enemy. Because 8H can complete a bomb, the level pair counts as "touching the bomb", so rule 4d allows the bomb.
5. **Short-partner support.**
   - r054, r060: both pass instead of taking control to feed a 1-2 card partner.
   - r090: lead a straight or FH instead of feeding a pair to a 2-card partner.
   - r062 (Jev): feeds a single to a 2-card partner.
   - r045 (Jev): passes when a bomb would take control for a 1-card partner.
6. **Smallest-sufficient / ordering slips (decide):**
   - r084: RJ where BJ suffices (also Jev).
   - r003: BJ where level 4 suffices.
   - r091: J then K, where K first is better.
   - r053: Q instead of the smallest feed 4.

## Suspect golds (found after the run; NOT changed, to keep the set frozen)
- **r095 (medium):** my option listing came from `legalMoves`, which does not enumerate pairSeq, so pairSeq 223344 was missing from my alts. By my own stated principle against a 1-card enemy ("no singles") it should have been acceptable. Probably a label omission. decide and both Jev runs played it.
- **r115 (high):** gold is pass over the partner's J. BJ then 33333 goes out (finish in 2), which the adopted partner-protection exception explicitly allows. The gold is probably wrong.
- r026 and r062 also had shapes missing from the listing (pairSeq / tripleSeq), but their golds are unaffected.

If r095 and r115 were counted correct: decide 98/120, Jev 99/120 and 101/120.

## Caveats
- Self-play hands come partly from random and greedy play, so some positions are odd (e.g. 23-card seats late).
- Low-confidence golds are few (6). Medium-confidence golds (46) carry most of the disagreement.
