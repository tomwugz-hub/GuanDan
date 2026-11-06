#!/usr/bin/env bash
# 全部残局回归（decide，不用 Jev）：并行跑，输出到 eval/endgames/$OUTDIR/，最后打印每套分数。
# 用法：OUTDIR=selfplay-audit/r1 bash scripts/regress-all.sh
set -u
cd "$(dirname "$0")/.."
OUTDIR=${OUTDIR:-regress-latest}
mkdir -p "eval/endgames/$OUTDIR"
SETS="dev-r6 dev-follow dev-lead dev-real cases pairs holdout-pairs holdout2-pairs holdout3-pairs holdout4-pairs frozen-real3 frozen-real4"
for s in $SETS; do
  node scripts/run-pair-eval.mjs --cases=eval/endgames/$s.jsonl --jev=0 --out=eval/endgames/$OUTDIR/$s-decide.md > "eval/endgames/$OUTDIR/$s.log" 2>&1 &
done
wait
for s in $SETS; do printf '%-16s %s\n' "$s" "$(grep -h '^decide:' eval/endgames/$OUTDIR/$s.log | tail -1)"; done
