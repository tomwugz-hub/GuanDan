# Blind holdout pair eval

- Set: `holdout-pairs.jsonl` — 31 contrast pairs / 62 cases (generator `scripts/gen-holdout-pairs.py`), written before any system was run. New hands/ranks/seats (seats 0–3 all decide), new pivots: partner with 2 cards, plates, tubes, straight flush vs bomb size, joker bomb / red-joker pair, heart-level wild (pair, bomb, FH, straight), FH leads, enemy 4–5 cards, 2-card endgame control.
- Gold legality: 62/62 legal per rules engine (`generateCandidates` + `isLegalPlay`).
- `policy/*.js` unchanged during this task (md5 verified before/after).
- Gold revision: **h21a** original gold (single 7) was wrong — 7H is the wild level card, so Q+7H = pair Q goes out. Fixed after the runs (decide, Jev and StartLux all found it). Numbers below use the corrected gold.

## Results

| system | case acc | pair acc |
|---|---|---|
| decide | 51/62 (82.3%) | 21/31 (67.7%) |
| Jev run 1 / 2 / 3 / 4 | 53, 52, 52, 53 /62 (~84.7%) | 23, 22, 21, 23 /31 (~71%) |
| StartLux v1.1-2B-Instant Q4_K_M (CPU) | 36/62 (58.1%) | 8/31 (25.8%) |

For comparison, on the tuned `pairs.jsonl`: decide 30/30, Jev 26–29/30 — the holdout shows that score was partly overfit.

## Misses by weakness

**1. Partner short (2 cards) — not handled at all** (rules only know partner=1)
- h01a (partner 2 → lead small pair 5): decide/Jev single 8.
- h87a (partner 2 → pair 4): Jev single 4 in some runs; decide ✓.

**2. "Lead big first" endgame control with 2 cards** (h20a [A,3] → A; h21b [Q,7] → Q; h70b [K,5] → K)
- decide leads the small card in all three; Jev misses h20a always, h21b in 2/4 runs.

**3. Opponent with 2 cards: don't give pairs / lead a shape they can't follow**
- h01b (enemy 2 → single): decide pair 5.
- h56a (enemy 2 → fullhouse 9): decide single K, Jev single 5.

**4. Breaking a finishing shape to follow** (keep FH/tube to go out on next lead)
- h11b (77710-10 vs single 9 → pass): decide and Jev break the pair, play 10.
- h73a (enemy 2, QQKKAA vs pair J → pair A): decide and Jev pass (protect tube over stopping a 2-card enemy).

**5. Wild (heart level card) economy**
- h09b (enemy 8 cards, pair Q → pass): decide/Jev spend the wild for pair K. *(gold unsure)*
- h10a (5H wild completes 8-bomb vs enemy last card): Jev single 5 in all runs — doesn't see the wild bomb; decide ✓.

**6. Feed partner with lowest single**
- h85a: decide (and Jev once) feed with 6 by breaking pair 6 instead of orphan 9. *(arguably fine — see below)*

**7. Leading small single with many enemies, holding a pair**
- h87b (4 4 10 K, enemies 6 → single 10): decide/Jev pair 4. *(gold unsure)*

**StartLux 2B:** 26 misses spread across everything — overtakes partner (h04a, h08a, h16a, h30a), misses bombs/SF vs last card (h31a, h44a, h75a), wrong follow size (h57b, h58a, h86a), and inverts the partner/enemy-short leads (h05, h15b, h85a). Not usable for this as a 2B Q4 model.

## Gold answers I'm unsure about
- **h09b** pass vs spending wild for pair K (enemy 8 cards) — conservative textbook line; playing it is defensible.
- **h32b** single 6 vs pair 8 when leading JJ88 6 — either is reasonable.
- **h52b** pass vs overtaking pair 9 with pair Q from a 10-J-Q tube.
- **h73b** pass vs overtaking with a pair from QQKKAA (enemy 6).
- **h87a/b** pair 4 vs single 10 depending on partner count — both halves are judgement calls.
- **h85a** I scored orphan 9 as the feed; breaking pair 6 for a lower single is also playable. Accepting 6 would give decide +1 case (pair h85 ✓ → 22/31).
- **h20a / h21b / h70b** "lead big first with 2 singles" is standard, but not forced.
- Engine note: the 4-joker bomb is treated as a top **4-card** bomb (loses to 5+ bombs); in standard guandan it's the highest bomb. h06 uses a 4-card Q bomb so this doesn't matter here.

## Runs
- Per-case tables: `holdout-report-raw.md/.json` (run 4, decide+Jev+StartLux, with original h21a gold).
- llama-server was restarted for StartLux and stopped afterwards.
