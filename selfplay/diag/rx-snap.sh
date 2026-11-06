#!/bin/bash
# 用法：bash selfplay/diag/rx-snap.sh r15 GD_R15 1 lead 9700000 42
cd /workspace/guandan-coach
for p in 0 1 2 3 4 5 6; do node selfplay/diag/rx-snap.mjs --tag=$1 --env=$2 --vals=$3 --phase=$4 --m0=$5 --matches=$6 --part=$p --parts=7 > selfplay/logs/$1-snap-$p.log 2>&1 & done; wait
