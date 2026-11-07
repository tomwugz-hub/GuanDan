# GD_R169 — asymmetric earlier endgame exact search (experiment)

Production default: `GD_R169=0` (off). Sticky baseline remains `GD_R95=5`; this experiment does **not** change pass / beat-cost (r95) thresholds.

## Bit semantics (`GD_R169` numeric mask)

| Bit | Value | Meaning |
|-----|-------|---------|
| 1 | 1 | Team shortness cap **K=5** (both seats on your team must hold ≤K when bit4 off). If unset, **K=4**. |
| 2 | 2 | Enemy cap per seat **E=5**. If unset, **E=4**. |
| 4 | 4 | **Side-only shortness (非对称)**：only require `min(me, partner) ≤ K` and `max(me, partner) ≤ GD_R169X_TEAMMAX` (default 8). Enemies still must satisfy E (or E+offset with bit8). |
| 8 | 8 | Relax enemy cap by **+GD_R169X_E8** (default **+2**), i.e. effective enemy cap `E + GD_R169X_E8`. |

**Combination examples**

- `1` — K=5, E=4, uniform team cap (both partners ≤5).
- `3` (1+2) — K=5, E=5, uniform.
- `5` (1+4) — K=5, E=4, asymmetric team (partner may hold up to `TEAMMAX`).
- `9` (1+8) — K=5, E=4 + default offset 2 → **enemies ≤6** (distinct from **b3** which caps enemies at **5**).

When `GD_R169` is on, `r169Gate` **passes**, and **maxEach is strictly greater** than the legacy cap (`baseEgMax` from r34/r156/r19 defaults), `solveEndgame` uses r169 bounded params: `GD_R169X_MAXW` (default 180), `GD_R169X_NODES` (80000), `GD_R169X_MS` (110), `GD_R169X_MINW` (4). In the **unchanged** endgame band (same `maxEach` as without r169), default solver budgets apply — no surprise extra cost on legacy territory. `GD_R169X_THR` adds to the improvement threshold only when the widened path is active (default 0).

**Logging:** set `GD_R169_LOG=1` to emit `R169TRIG` on stderr when exact-search move differs from pre-endgame best.

**Lab / eval (not default):** `GD_ENDGAME_NO_WALLCLOCK=1` turns off `Date.now`-based early exit inside `solveEndgame` (world/node caps still apply) for **deterministic-budget** replays — see `VALIDITY.md`. Production: omit unless explicitly adopted.

## Orthogonality

- **r34** (`GD_R34` bit1): only raises **uniform** per-seat cap E for the legacy `endgameApplies` path when r169 does not widen the gate.
- **r156** (`GD_R156`): extra worlds/node/time budgets; composes with the same block.

## Scripts (from repo root)

- `scripts/experiments/r169/smoke-r169.sh` — serial smoke (`SEED0` default 26990000): **A** = `BASELINE_SNAPSHOT` vs itself (no r169); **B** = `current` vs `BASELINE_SNAPSHOT` with `GD_R169=0`. Set `BASELINE_SNAPSHOT=backups/<snap>` for frozen baseline parity. Optional `GD_R169_LOG=1` trig sample.
- `scripts/experiments/r169/VALIDITY.md` — wall-clock / load bias in `solveEndgame`, `GD_ENDGAME_NO_WALLCLOCK` lab flag.
- `scripts/experiments/r169/run-r169-launch.sh` — smoke → gate → **R169TRIG** precheck (96 deals on baseline) → detach four `nohup` arenas with **`--ckpt`** → `watch-r169-completion.sh` (or `NO_WATCH=1`).
- `scripts/experiments/r169/run-r169-chain.sh` — foreground four configs with checkpoint (`CKPT_DIR`).
- `scripts/experiments/r169/verify-bits.mjs` — asserts b3 rejects / b9 accepts enemy with 6 cards.
- `scripts/experiments/r169/watch-r169-completion.sh` — writes `r169-ALL_DONE` when four logs show arena summary.
- `scripts/experiments/r169/watch-r169-logs.sh` — `tail -f` helper for log files.
- `scripts/experiments/r169/nohup-driver.sh` — wraps `run-r169-launch` (default `NO_WATCH=1` for detached arenas).
