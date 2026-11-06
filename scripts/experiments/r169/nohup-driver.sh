#!/usr/bin/env bash
# Durable driver: smoke + gate + trig sample + detach four ckpt arenas (see run-r169-launch.sh).
# Usage:
#   BASELINE_SNAPSHOT=backups/r169-base NO_WATCH=1 nohup bash scripts/experiments/r169/nohup-driver.sh &
# Then: bash scripts/experiments/r169/watch-r169-completion.sh
# Env: LOG (default selfplay/logs/r169-driver.log).
set -euo pipefail
cd "$(dirname "$0")/../../.."
LOG="${LOG:-selfplay/logs/r169-driver.log}"
mkdir -p "$(dirname "$LOG")"
exec >>"$LOG" 2>&1
echo "=== r169 nohup driver $(date -uIs) pid=$$ ==="
export NO_WATCH="${NO_WATCH:-1}"
bash scripts/experiments/r169/run-r169-launch.sh
echo "=== launch script exit $(date -uIs) ==="
