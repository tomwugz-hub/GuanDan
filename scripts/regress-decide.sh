#!/bin/bash
# decide-only regression over all non-test sets (+ dev-real). usage: scripts/regress-decide.sh tag
tag=${1:-tmp}; mkdir -p /tmp/rg
for s in cases pairs holdout-pairs holdout2-pairs holdout3-pairs holdout4-pairs dev-real; do
  node scripts/run-pair-eval.mjs --cases=eval/endgames/$s.jsonl --out=/tmp/rg/$tag-$s.md >/dev/null 2>&1
  python3 -c "
import json;d=json.load(open('/tmp/rg/$tag-$s.json'));x=d['decide']
print('%-16s'%'$s', 'cases',x['caseOk'],'/',d['cases'], 'pairs',x['pairOk'],'/',d['pairs'], 'miss', ','.join(r['id'] for r in d['rows'] if not r.get('decide_ok'))[:300])"
done
