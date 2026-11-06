#!/bin/bash
# decide + Jev regression over all tuning/regression sets. usage: scripts/regress-jev.sh tag
tag=${1:-tmp}; out=eval/endgames/lead-round
for s in dev-lead cases pairs holdout-pairs holdout2-pairs holdout3-pairs holdout4-pairs dev-real; do
  node scripts/run-pair-eval.mjs --cases=eval/endgames/$s.jsonl --jev=1 --out=$out/$tag-$s.md > $out/$tag-$s.log 2>&1
  echo "done $s"
done
