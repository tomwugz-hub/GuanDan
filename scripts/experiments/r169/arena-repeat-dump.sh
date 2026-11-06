#!/usr/bin/env bash
# Run arena twice with identical CLI + env, write raw per-deal JSON dumps, compare fingerprints.
#
# Requires: backups/<OLD_BASELINE_NAME>/ with patched baseline policy (see RUNBOOK_VALIDATION.md).
# Example (512 tribute matches, seed26991000, serial workers) — old patched vs itself:
#   export GD_R95=5 GD_ENDGAME_NO_WALLCLOCK=1
#   export OLD_BASELINE_NAME=r169-baseline-c77-nw
#   A_SPEC=r169-baseline-c77-nw B_SPEC=r169-baseline-c77-nw \
#   OUTDIR=selfplay/logs/r169-arena-trace \
#   SEED0=26991000 DEALS=512 bash scripts/experiments/r169/arena-repeat-dump.sh
#
# Candidate flag0 vs same old baseline (not a self-pair; still use for A/B repeat dumps):
#   A_SPEC=current B_SPEC=r169-baseline-c77-nw PRE='export GD_R169=0;' ...
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
OLD="${OLD_BASELINE_NAME:-r169-baseline-c77-nw}"
A_SPEC="${A_SPEC:-$OLD}"
B_SPEC="${B_SPEC:-$OLD}"
PRE="${PRE:-}"
SEED0="${SEED0:-26991000}"
DEALS="${DEALS:-512}"
RUNS="${RUNS:-2}"
OUTDIR="${OUTDIR:-$ROOT/selfplay/logs/r169-arena-trace}"
mkdir -p "$OUTDIR"

run_arena() {
  local tag="$1"
  local raw="$OUTDIR/arena-${tag}-${SEED0}-d${DEALS}.json"
  echo "=== $tag A=$A_SPEC B=$B_SPEC raw -> $raw ==="
  # shellcheck disable=SC2086
  ( eval "$PRE" node selfplay/arena.mjs --a="$A_SPEC" --b="$B_SPEC" --deals="$DEALS" --seed0="$SEED0" \
      --tribute --matchLen=8 --threads=1 --collect=1 --dump-raw="$raw" )
}

for ((r = 1; r <= RUNS; r++)); do
  run_arena "run${r}"
done

if [[ "$RUNS" -ge 2 ]]; then
  node scripts/experiments/r169/compare-arena-raw.mjs \
    "$OUTDIR/arena-run1-${SEED0}-d${DEALS}.json" \
    "$OUTDIR/arena-run2-${SEED0}-d${DEALS}.json" \
    | tee "$OUTDIR/compare-${SEED0}-d${DEALS}.json"
fi
echo "Done. Inspect $OUTDIR"
