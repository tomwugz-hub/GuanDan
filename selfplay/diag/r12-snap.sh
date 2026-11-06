#!/bin/bash
cd /workspace/guandan-coach
for p in 0 1 2 3 4 5 6; do node selfplay/diag/r12-snap.mjs --m0=9000000 --matches=70 --part=$p --parts=7 > selfplay/logs/r12-snap-$p.log 2>&1 & done; wait
