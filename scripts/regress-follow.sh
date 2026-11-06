#!/bin/bash
# decide + Jev regression over all tuning/regression sets (follow round). usage: scripts/regress-follow.sh tag
tag=${1:-tmp}; out=eval/endgames/follow-round
for s in dev-follow dev-lead dev-real cases pairs holdout-pairs holdout2-pairs holdout3-pairs holdout4-pairs; do
  node scripts/run-pair-eval.mjs --cases=eval/endgames/$s.jsonl --jev=1 --out=$out/$tag-$s.md > $out/$tag-$s.log 2>&1 &
done
wait; echo done
