#!/usr/bin/env bash
# Controlled validity: serial arena, threads=1, GD_ENDGAME_NO_WALLCLOCK=1, sticky GD_R95=5.
# OLD baseline snapshot must include the baseline-only patch on policy/endgame.js (c77f3f7 + no-wallclock).
# Candidate side: current tree; set GD_R169 only for candidate (unset on oldbaseline — no-op there).
#
# Usage (repo root):
#   OLD_BASELINE_NAME=r169-baseline-c77-nw \
#   BASELINE_SNAPSHOT=r169-baseline-c77-nw \  # same name for smoke parity
#   bash scripts/experiments/r169/validate-no-wallclock.sh
#
# Env: SEED0 (default 26990000), DEALS (96), RUNS (2), RUN_BITS (0|1  → extra GD_R169 1/3/5/9 vs old).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
export GD_R95="${GD_R95:-5}"
export GD_ENDGAME_NO_WALLCLOCK="${GD_ENDGAME_NO_WALLCLOCK:-1}"
export GD_HANDPLAN_NO_WALLCLOCK="${GD_HANDPLAN_NO_WALLCLOCK:-1}"

OLD="${OLD_BASELINE_NAME:-r169-baseline-c77-nw}"
SEED0="${SEED0:-26990000}"
DEALS="${DEALS:-96}"
RUNS="${RUNS:-2}"
RUN_BITS="${RUN_BITS:-0}"
BASELINE_SMOKE="${BASELINE_SNAPSHOT:-$OLD}"

run_pair() {
  local name="$1" a="$2" b="$3" extra="$4"
  echo "=== $name: A=$a B=$b ${extra:+(env $extra)} ==="
  # shellcheck disable=SC2086
  ( eval "$extra" node selfplay/arena.mjs --a="$a" --b="$b" --deals="$DEALS" --seed0="$SEED0" --tribute --matchLen=8 --threads=1 )
}

for ((r = 1; r <= RUNS; r++)); do
  echo ""
  echo "######## RUN $r / $RUNS ########"
  run_pair "oldbaseline self" "$OLD" "$OLD" ""
  run_pair "candidate vs old baseline GD_R169=0" "current" "$OLD" "export GD_R169=0;"
  if [[ "$RUN_BITS" == "1" ]]; then
    for bits in 1 3 5 9; do
      run_pair "candidate GD_R169=$bits vs old baseline" "current" "$OLD" "export GD_R169=$bits;"
    done
  fi
done

echo ""
echo "Done. See RUNBOOK_VALIDATION.md: self-paired arena summaries are not identical-run fingerprints;"
echo "use scripts/experiments/r169/arena-repeat-dump.sh for raw per-deal reproducibility checks."
