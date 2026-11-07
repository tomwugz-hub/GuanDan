#!/usr/bin/env bash
# Short serial smoke: baseline snapshot vs current with GD_R169=0 must match (Δ 0); b3 vs b9 gate; optional trigger logging.
# BASELINE_SNAPSHOT=backups/<name> (loadDecide) or "current". Default "current" if unset — set explicitly for A/B fidelity.
# Usage (from repo root): BASELINE_SNAPSHOT=current bash scripts/experiments/r169/smoke-r169.sh
set -euo pipefail
cd "$(dirname "$0")/../../.."
export GD_R95="${GD_R95:-5}"
BASELINE="${BASELINE_SNAPSHOT:-current}"
LOGDIR="${LOGDIR:-selfplay/logs}"
mkdir -p "$LOGDIR"
SMOKE_DEALS="${SMOKE_DEALS:-48}"
SEED0="${SEED0:-26990000}"

echo "=== smoke A: baseline $BASELINE vs itself (no GD_R169) ===" | tee "$LOGDIR/r169-smoke-base.log"
( unset GD_R169; node selfplay/arena.mjs --a="$BASELINE" --b="$BASELINE" --deals="$SMOKE_DEALS" --seed0="$SEED0" --tribute --matchLen=8 --threads=1 ) | tee -a "$LOGDIR/r169-smoke-base.log"

echo "=== smoke B: baseline $BASELINE vs current, GD_R169=0 ===" | tee "$LOGDIR/r169-smoke-b0.log"
( export GD_R169=0; node selfplay/arena.mjs --a=current --b="$BASELINE" --deals="$SMOKE_DEALS" --seed0="$SEED0" --tribute --matchLen=8 --threads=1 ) | tee -a "$LOGDIR/r169-smoke-b0.log"

echo "=== gate: b3 vs b9 distinct (verify-bits.mjs) ===" | tee -a "$LOGDIR/r169-smoke-b0.log"
node scripts/experiments/r169/verify-bits.mjs | tee -a "$LOGDIR/r169-smoke-b0.log"

if [[ "${GD_R169_LOG:-}" == "1" ]]; then
  echo "=== trigger sample: GD_R169=9 GD_R169_LOG=1 (stderr only) ===" | tee "$LOGDIR/r169-smoke-trig.log"
  ( export GD_R169=9 GD_R169_LOG=1; node selfplay/arena.mjs --a=current --b=current --deals=64 --seed0="$SEED0" --tribute --matchLen=8 --threads=1 ) 2>>"$LOGDIR/r169-smoke-trig.stderr" | tee -a "$LOGDIR/r169-smoke-trig.log"
  echo "(see $LOGDIR/r169-smoke-trig.stderr for R169TRIG lines)"
fi
