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
MATCH_LEN="${MATCH_LEN:-8}"
# Eval defaults: applied only when the variable is unset (${name:-default}), never override exports.
export GD_R95="${GD_R95:-5}"
export GD_ENDGAME_NO_WALLCLOCK="${GD_ENDGAME_NO_WALLCLOCK:-1}"
export GD_HANDPLAN_NO_WALLCLOCK="${GD_HANDPLAN_NO_WALLCLOCK:-1}"
export GD_R169="${GD_R169:-0}"
export GD_R170="${GD_R170:-0}"
ARENA_ENV_STRICT="${ARENA_ENV_STRICT:-0}"
mkdir -p "$OUTDIR"

run_node() {
  if [[ "$ARENA_ENV_STRICT" == "1" ]]; then
    local -a clean=( HOME="$HOME" PATH="$PATH" USER="${USER:-}" LANG="${LANG:-C.UTF-8}" TZ="${TZ:-}" )
    while IFS= read -r line; do
      [[ -n "$line" ]] && clean+=("$line")
    done < <(env | LC_ALL=C sort | grep '^GD_' || true)
    env -i "${clean[@]}" "$@"
  else
    "$@"
  fi
}

run_arena() {
  local tag="$1"
  local raw="$OUTDIR/arena-${tag}-${SEED0}-d${DEALS}.json"
  echo "=== $tag A=$A_SPEC B=$B_SPEC SEED0=$SEED0 DEALS=$DEALS raw -> $raw ==="
  # shellcheck disable=SC2086
  ( eval "$PRE"
    run_node node selfplay/arena.mjs --a="$A_SPEC" --b="$B_SPEC" --deals="$DEALS" --seed0="$SEED0" \
      --tribute --matchLen="$MATCH_LEN" --threads=1 --collect=1 --dump-raw="$raw" )
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
