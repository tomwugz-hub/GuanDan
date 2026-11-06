#!/usr/bin/env bash
# r7 c2 候选 A/B：current（env 变体） vs post-selfplay-r7a
cd "$(dirname "$0")/../.."
SEED=${SEED:-1300000}; DEALS=${DEALS:-1000}; B=${B:-post-selfplay-r7a}
for v in "$@"; do
  echo "== variant: $v vs $B seed $SEED  $(TZ=America/Toronto date '+%H:%M')"
  env $v node selfplay/arena.mjs --a=current --b=$B --deals=$DEALS --seed0=$SEED
done
