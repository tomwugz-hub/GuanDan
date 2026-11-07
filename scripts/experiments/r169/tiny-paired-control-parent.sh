#!/usr/bin/env bash
# Parent: 32-deal serial arena ×2 under one strict eval envelope (old-old + cur@flag0).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

export GD_R95=5 GD_ENDGAME_NO_WALLCLOCK=1 GD_HANDPLAN_NO_WALLCLOCK=1 GD_R169=0 GD_R170=0
export GD_SEARCH_NO_WALLCLOCK=1 GD_SEARCH_BEAM_FIXED_NODES=128
export GD_EVAL_BEAM_WORK_TRACE=1
export GD_EVAL_BEAM_WORK_COLLECT=1
export SEED0="${SEED0:-26991000}"
export DEALS=32
export ARENA_ENV_STRICT=1
export OUTDIR="${OUTDIR:-$ROOT/selfplay/logs/r169-tiny-strict-envelope}"

echo '=== config old-old (cap2-base vs cap2-base) ==='
A_SPEC=r169-cap2-base B_SPEC=r169-cap2-base RUNS=2 \
  OUTDIR="$OUTDIR/old-old" bash scripts/experiments/r169/arena-repeat-dump.sh

echo '=== config cur-flag0 (cap2-current vs cap2-base, GD_R169=0) ==='
A_SPEC=r169-cap2-current B_SPEC=r169-cap2-base RUNS=2 \
  OUTDIR="$OUTDIR/cur-flag0" bash scripts/experiments/r169/arena-repeat-dump.sh

echo '=== extract parity + beam telemetry from existing raw (no extra arenas) ==='
node scripts/experiments/r169/tiny-paired-control.mjs --reuse-only --seed0="$SEED0" --outdir="$OUTDIR"
