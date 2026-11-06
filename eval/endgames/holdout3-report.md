# Holdout3: blind result (2026-10-16)
28 pairs (56 cases), written in scripts/gen-holdout3-pairs.py before any run; every gold move passed the engine legality check. Policy files were frozen and checked by md5 during the runs.

| system | cases | pairs |
|---|---|---|
| decide | 53/56 | 25/28 |
| Jev run1/2/3 | 50/56 each | 23/28 each (the same misses every run) |

## Misses by weakness
- **Gold conflicts with the new "finish in 2" exception, m02a (both systems):** the partner plays a full house of 7s. The hand is JJJ44+Q, so the full house of Js followed by Q goes out in 2 plays. The adopted rule allows that, so my gold "pass" is probably the wrong label.
- **Breaks a bomb to lead into a 1-card enemy, m29a.** decide leads three 9s out of 9999 and Jev leads single 6. The gold is pair 6, which keeps the bomb.
- **Mixes up which seat is short (partner or enemy) when leading, m13a/b (Jev only).** Jev swaps the plays: it leads a single into a 1-card enemy and a pair into a 1-card partner.
- **Uses a level pair for control when enemies hold many cards, m45b (both).** They play the level pair J over a pair of As while the enemy holds 6 cards. The gold is uncertain.
- **Plays a small pair instead of the orphan single when enemies are long, m58b (Jev).** The gold is uncertain.

## Unsure golds
- m05b: driven by the partner-first persona.
- m11b: three Ks over three 5s is also playable.
- m58b
- m45b
- m02a: probably wrong, as explained above.
