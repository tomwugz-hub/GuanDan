# r169 A/B measurement validity (exploratory)

Parent box results (serial 96, seed 26990000, sticky GD_R95=5) showing **b0 sign flip** and **baseline-vs-itself non-zero** point to **measurement noise and load coupling**, not necessarily policy strength — **do not treat deal count alone as sufficient** to eliminate bias.

## Evidenced mechanisms in `policy/endgame.js`

1. **Wall-clock inside `solveEndgame`** (`Date.now()`): outer loop stops worlds when `done >= minWorlds && elapsed > timeMs`; inner search throws when `(nodes & 255) === 0 && elapsed > 2*timeMs`. Under CPU contention (8 workers + parallel arenas), the **number of worlds averaged** (`done`) changes → **different `best` / `bestValue`** → different offline `decide` paths even with identical code snapshot.

2. **World subsampling**: when deduped worlds `> maxWorlds`, order is **shuffled with a deterministic PRNG from hand** but **slice is still a subset** — coupled with (1), partial evaluation varies.

3. **Paired arena order**: `arena.mjs` runs jobs; **pairing** corrects some seat bias but **does not remove** solver time-slicing variance between A and B when workers overlap.

## Remediation (evaluation / lab only; default production unchanged)

- Set **`GD_ENDGAME_NO_WALLCLOCK=1`**: disables `Date.now` early-exit branches in `solveEndgame` so stopping is driven by **`maxWorlds` + `nodeBudget` + `minWorlds`** only (still bounded). Use for **repeatable** A/B on a fixed box; omit in production unless explicitly adopted.

## Statistical gate (before any deployment claim)

- Pre-register: seeds, `BASELINE_SNAPSHOT`, thread count, env (including `GD_ENDGAME_NO_WALLCLOCK` if used).
- Report **paired CIs** as today, plus **sign stability** across **independent reruns** (same seed, process isolation) or **negative control** (baseline vs itself must hit Δ≈0 under same load profile).
- **Smoke**: `BASELINE_SNAPSHOT` must match the frozen snapshot (e.g. `c77f3f7` tree) — `smoke-r169.sh` now passes `--b=<BASELINE_SNAPSHOT>` so **smoke B** is **current vs snapshot** with `GD_R169=0`.
