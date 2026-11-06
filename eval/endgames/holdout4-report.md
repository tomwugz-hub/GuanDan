# Holdout4: blind result (2026-10-17)
28 pairs (56 cases), written in scripts/gen-holdout4-pairs.py before any run. Every gold move passed the engine legality check. Policy files were frozen and checked by md5 (backups/policy-v4-frozen.md5) before and after the runs.

| system | cases | pairs |
|---|---|---|
| decide | 48/56 | 20/28 |
| Jev run1 | 47/56 | 20/28 |
| Jev run2 | 48/56 | 21/28 |
| Jev run3 | 48/56 | 21/28 |

## Misses by weakness
1. **Bombs when an ordinary card already wins against a 1-card enemy.** q05b (pair 9 beats the pair 5) and q32a (straight 6-10 beats the straight 3-7). Both systems miss. The "enemy on 1 card → bomb" priority ignores ordinary beaters that don't touch the bomb.
2. **Enemy on 1-2 cards, holding a bomb: plays singles instead of an unfollowable shape.**
   - q04a: decide leads single 3 into a 1-card enemy; the gold is pair 8.
   - q31a: both lead single 6 (breaking the 66) instead of the full house KKK66.
   - q03a: decide leads triple 6 instead of the full house; the full house leaves one card, the triple leaves two plays.
   - q06a (gold unsure): triple 10 vs single Q.

   The decide rule "holding a bomb → push the orphan single" still beats the "unfollowable shape" bonus when the enemy is short.
3. **Overtakes the partner's straight when the next enemy has 2 cards, q22a (both).** partnerOverrideOk compares against min(size, 2), so it treats a 2-card enemy as able to follow a 5-card straight. It should require the enemy to hold at least as many cards as the partner's play.
4. **Late control: AA 33 against a 1-card enemy, q17a.** decide leads pair 3 first. Jev is split: pair 3 in run1, pair A in runs 2-3.
5. **Jev only:**
   - q06b: the feed-the-partner pruning picks the lowest single, which is a 5 taken from the 5555 bomb. It should exclude bomb cards.
   - q24a: uses the four-joker bomb when a straight flush beats the 4-card bomb.
   - q11a: leads single 3, breaking the straight, when enemies are long.

## Uncertain golds
- q06a: triple 10 against a 2-card enemy. A single Q is defensible.
- q11b: breaking the straight to feed a 1-card partner.
- q18a: pair 9 first vs RJ first.
- q27b: single 4 (breaking the 44) vs the orphan J as a feed.
