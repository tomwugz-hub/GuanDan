#!/usr/bin/env bash
# r8 候选 A/B：current（显式开关变体） vs pre-selfplay-r8
cd "$(dirname "$0")/../.."
SEED=${SEED:-2000000}; DEALS=${DEALS:-2000}; BASE=${BASE:-pre-selfplay-r8}
for v in "$@"; do
  echo "== variant: $v  seed0=$SEED deals=$DEALS  $(date '+%H:%M')"
  env $v node selfplay/arena.mjs --a=current --b=$BASE --deals=$DEALS --seed0=$SEED
done
echo "== done $(date '+%H:%M')"
