#!/usr/bin/env bash
# Poll four arena logs until each ends with arena summary line; write ALL_DONE marker.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
LOGDIR="${LOGDIR:-$ROOT/selfplay/logs/r169-chain}"
SEED0="${SEED0:-26900000}"
MARK="${MARK:-$LOGDIR/r169-ALL_DONE}"
poll="${POLL_SEC:-5}"

logs=()
for bits in 1 3 5 9; do
  logs+=("$LOGDIR/ab-r169-b${bits}-seed${SEED0}.log")
done

echo "Watching logs: ${logs[*]} (poll ${poll}s)"
while true; do
  ok=0
  for f in "${logs[@]}"; do
    if [[ -f "$f" ]] && grep -qE 'vs.*净升级|当前 vs' "$f" 2>/dev/null; then ((ok++)) || true; fi
  done
  if [[ "$ok" -eq 4 ]]; then
    echo "ALL_DONE $(date -uIs) seed0=$SEED0" | tee "$MARK"
    exit 0
  fi
  sleep "$poll"
done
