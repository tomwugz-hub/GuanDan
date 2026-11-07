#!/usr/bin/env bash
# Reproducible A/B chain for coordinator box: 4000 deals, tribute matchLen=8, seed0=26900000.
# Bits 1 / 3 / 5 / 9 vs baseline snapshot WITHOUT GD_R169 (unset). Run with: nohup bash ... &
# Usage: BASELINE_SNAPSHOT=backups/your-r169-base bash scripts/experiments/r169/run-r169-chain.sh
# Checkpoint: CKPT_DIR/selfplay default -> resume same command after interrupt.
set -euo pipefail
cd "$(dirname "$0")/../../.."
export GD_R95="${GD_R95:-5}"
SEED0="${SEED0:-26900000}"
DEALS="${DEALS:-4000}"
BASELINE="${BASELINE_SNAPSHOT:-current}"
LOGDIR="${LOGDIR:-selfplay/logs/r169-chain}"
CKPT_DIR="${CKPT_DIR:-$LOGDIR/ckpt}"
ARENA_THREADS="${ARENA_THREADS:-$(command -v nproc >/dev/null && nproc || echo 4)}"
mkdir -p "$LOGDIR" "$CKPT_DIR"

run_one() {
  local bits="$1" tag="$2"
  local out="$LOGDIR/ab-r169-${tag}-seed${SEED0}.log"
  local ck="$CKPT_DIR/ab-r169-${tag}-seed${SEED0}.jsonl"
  echo "=== GD_R169=$bits vs $BASELINE (see $out, ckpt $ck) ==="
  (
    export GD_R169="$bits"
    node selfplay/arena.mjs --a=current --b="$BASELINE" --deals="$DEALS" --seed0="$SEED0" --tribute --matchLen=8 --ckpt="$ck" --threads="$ARENA_THREADS"
  ) >"$out" 2>&1
  tail -3 "$out"
}

run_one 1 b1
run_one 3 b3
run_one 5 b5
run_one 9 b9
echo "All configs finished. Logs under $LOGDIR"
