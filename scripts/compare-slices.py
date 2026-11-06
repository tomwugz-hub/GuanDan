#!/usr/bin/env python3
"""usage: compare-slices.py set.jsonl label=run.json:sys [label=run.json:sys ...]   (sys = decide|jev)"""
import json, sys
S = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
cols = []
for a in sys.argv[2:]:
    lab, rest = a.split('=', 1)
    path, sysn = rest.rsplit(':', 1)
    d = json.load(open(path))
    ok = {r['id']: bool(r[f'{sysn}_ok']) for r in d['rows']}
    cols.append((lab, ok))
slices = [('ALL', lambda r: True)]
for k in ['high', 'medium', 'low']:
    slices.append((f'conf={k}', lambda r, k=k: r.get('confidence') == k))
keys = ['mode', 'prevBy', 'enemyMin', 'partner', 'bombHeld', 'wildHeld', 'myCount']
for k in keys:
    vals = sorted({str(r['situation'][k]) for r in S})
    for v in vals:
        slices.append((f'{k}={v}', lambda r, k=k, v=v: str(r['situation'][k]) == v))
print('| slice | n | ' + ' | '.join(c[0] for c in cols) + ' |')
print('|---|---|' + '---|' * len(cols))
for name, f in slices:
    sub = [r for r in S if f(r)]
    if not sub: continue
    cells = []
    for _, ok in cols:
        n = sum(ok.get(r['id'], False) for r in sub)
        cells.append(f'{n}/{len(sub)} ({round(100*n/len(sub))}%)')
    print(f'| {name} | {len(sub)} | ' + ' | '.join(cells) + ' |')
