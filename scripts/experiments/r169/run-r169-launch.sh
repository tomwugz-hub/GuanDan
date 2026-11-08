#!/usr/bin/env bash
# Coordinator flow: (1) serial smoke b0 (2) bit-distinction gate (3) detach four ckpt arenas (4) watcher → ALL_DONE marker.
# Usage: BASELINE_SNAPSHOT=backups/... bash scripts/experiments/r169/run-r169-launch.sh
# Optional: ARENA_THREADS=1 (serial arenas), SKIP_LAUNCH=1 (only smoke+gate), STRICT_TRIG=1 (require ≥1 R169TRIG in smoke-trig sample).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
export GD_R95="${GD_R95:-5}"
unset GD_R169
LOGDIR="${LOGDIR:-selfplay/logs/r169-chain}"
CKDIR="$LOGDIR/ckpt"
mkdir -p "$LOGDIR" "$CKDIR"
BASELINE="${BASELINE_SNAPSHOT:-current}"
SEED0="${SEED0:-26900000}"
# smoke + trig sample seed (default 26990000); main arenas use SEED0=26900000
SMOKE_SEED="${SMOKE_SEED:-26990000}"
export SMOKE_SEED
DEALS="${DEALS:-4000}"
THR="${ARENA_THREADS:-$(command -v nproc >/dev/null && nproc || echo 4)}"

echo "=== [1/4] serial smoke (b0 sanity) ==="
bash scripts/experiments/r169/smoke-r169.sh

echo "=== [2/4] b3 vs b9 gate (verify-bits.mjs) ==="
node scripts/experiments/r169/verify-bits.mjs

echo "=== [2b/4] nonzero R169TRIG sample (stderr) before launch ==="
TRIG_TMP="$LOGDIR/r169-prelaunch-trig.stderr"
TRIG_DEALS="${TRIG_DEALS:-96}"
: >"$TRIG_TMP"
( export GD_R169=9 GD_R169_LOG=1
  node selfplay/arena.mjs --a=current --b="$BASELINE" --deals="$TRIG_DEALS" --seed0="$SMOKE_SEED" --tribute --matchLen=8 --threads=1
) 2>>"$TRIG_TMP" >/dev/null
if ! grep -q R169TRIG "$TRIG_TMP" 2>/dev/null; then
  echo "prelaunch: no R169TRIG in ${TRIG_DEALS}-deal sample; raise TRIG_DEALS or check policy. See $TRIG_TMP" >&2
  exit 1
fi

if [[ "${SKIP_LAUNCH:-}" == "1" ]]; then
  echo "SKIP_LAUNCH=1 — stopping after smoke + gate"
  exit 0
fi

echo "=== [3/4] detach four arenas (checkpoint resume) ==="
comp="$LOGDIR/r169-completion.log"
: >"$comp"
for bits in 1 3 5 9; do
  tag="b$bits"
  ck="$CKDIR/ab-r169-${tag}-seed${SEED0}.jsonl"
  out="$LOGDIR/ab-r169-${tag}-seed${SEED0}.log"
  (
    export GD_R169="$bits"
    nohup node "$ROOT/selfplay/arena.mjs" --a=current --b="$BASELINE" --deals="$DEALS" --seed0="$SEED0" --tribute --matchLen=8 --ckpt="$ck" --threads="$THR" >>"$out" 2>&1
    echo "DONE $(date -uIs) bits=$bits log=$out" >>"$comp"
  ) &
  echo "started GD_R169=$bits parent_pid=$! log=$out ckpt=$ck" | tee -a "$comp"
done

if [[ "${NO_WATCH:-}" == "1" ]]; then
  echo "NO_WATCH=1 — arenas detached; run: bash scripts/experiments/r169/watch-r169-completion.sh"
  exit 0
fi
echo "=== [4/4] watcher (foreground; Ctrl+C leaves arenas running) ==="
bash scripts/experiments/r169/watch-r169-completion.sh
