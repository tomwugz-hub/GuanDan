#!/bin/bash
cd /workspace/guandan-coach
for p in 0 1 2 3 4 5 6; do node selfplay/diag/r14-snap.mjs --m0=9500000 --matches=40 --part=$p --parts=7 > selfplay/logs/r14-snap-$p.log 2>&1 & done; wait
