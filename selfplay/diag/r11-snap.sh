#!/bin/bash
cd /workspace/guandan-coach
for p in 0 1 2 3 4 5; do node selfplay/diag/r11-snap.mjs --part=$p --parts=6 > selfplay/logs/r11-snap-$p.log 2>&1 & done; wait; echo DONE >> selfplay/logs/r11-snap-0.log
