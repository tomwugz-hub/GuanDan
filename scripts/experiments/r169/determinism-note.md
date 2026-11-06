# Arena “self vs self” is not a Δ=0 control by design

`arena.mjs` pairs **two seatings** (A0 / A1) per seed and averages the per-seating team score. Even when **A and B name the same policy**:

- **Seat assignment is asymmetric** in a fixed pair (e.g. A-team sits [0,2] in one job and [1,3] in the mirror); with a **non-symmetrical game** (partnership / tribute / play order), the **expected** mean team points need not be **exactly 0** for finite `deals`.
- Summaries use **pairedStats**: mean ± CI over **seed-level paired values** — repeated runs can shift the **point estimate** slightly (sampling variance), not necessarily “repeat failure”.

Treat **identical deterministic replay** as the **module-level** check (same `playMatch` seed stream); treat arena self-pair as a **weak** sanity (symmetric ensemble), not a hard zero gate.

## Hidden Math.random in `dealFourHands()` (fixed on candidate)

Previously `dealFourHands()` defaulted to `shuffle(makeDeck())` → **`Math.random`**. Any code path calling `dealFourHands()` **without** a deck could leak OS RNG into “seeded” sims. `play/core.js` already passes `shuffle(makeDeck(), g.rng)`; **`createRound` without hands** now uses `rng ?? Math.random` explicitly (UI / scripts).

Candidate fix: require an explicit deck; see `engine/cards.js`.
