#!/usr/bin/env bash
# r7 候选 A/B：current（带 env 变体） vs pre-selfplay-r7
cd "$(dirname "$0")/../.."
SEED=${SEED:-1100000}; DEALS=${DEALS:-1000}
for v in "$@"; do
  echo "== variant: $v  $(TZ=America/Toronto date '+%H:%M')"
  env $v node selfplay/arena.mjs --a=current --b=pre-selfplay-r7 --deals=$DEALS --seed0=$SEED
done
