#!/usr/bin/env bash
# Tail the latest r169 chain log (or pass files as args).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
if [[ $# -gt 0 ]]; then
  exec tail -f "$@"
fi
LATEST=$(ls -t "$ROOT"/selfplay/logs/r169-chain/ab-r169-*.log 2>/dev/null | head -1)
if [[ -z "$LATEST" ]]; then
  echo "No logs in selfplay/logs/r169-chain/; pass file paths as arguments." >&2
  exit 1
fi
echo "Following: $LATEST" >&2
exec tail -f "$LATEST"
