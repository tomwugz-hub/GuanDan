#!/usr/bin/env python3
"""Breakdown for *-real sets. usage: real-breakdown.py set.jsonl run1.json [run2.json] [--misses]"""
import json, sys
args = [a for a in sys.argv[1:] if not a.startswith('--')]
cases = {json.loads(l)['id']: json.loads(l) for l in open(args[0])}
R = [{x['id']: x for x in json.load(open(p))['rows']} for p in args[1:]]
jev = any(r.get('jev_ok') is not None for r in R[0].values())
def acc(ids):
    n = len(ids)
    if not n: return ''
    cols = [sum(bool(R[0][i]['decide_ok']) for i in ids)] + ([sum(bool(r[i]['jev_ok']) for i in ids) for r in R] if jev else [])
    return f"| {n} | " + ' | '.join(f"{c}/{n} ({100*c/n:.0f}%)" for c in cols) + ' |'
ids = list(cases)
print('| slice | n | decide |' + (''.join(f' Jev r{k+1} |' for k in range(len(R))) if jev else ''))
print('|---|---|---|' + ('---|' * len(R) if jev else ''))
print('| ALL ' + acc(ids))
for cf in ['high', 'medium', 'low']: print(f'| conf={cf} ' + acc([i for i in ids if cases[i]['confidence'] == cf]))
for k in ['mode', 'prevBy', 'enemyMin', 'partner', 'bombHeld', 'wildHeld', 'myCount']:
    for v in sorted(set(str(cases[i]['situation'][k]) for i in ids)):
        print(f'| {k}={v} ' + acc([i for i in ids if str(cases[i]['situation'][k]) == v]))
if '--misses' in sys.argv:
    print()
    for i in ids:
        bad = not R[0][i]['decide_ok'] or (jev and any(not r[i]['jev_ok'] for r in R))
        if bad:
            c = cases[i]
            print(i, c['confidence'], c['situation']['mode'], 'gold=' + '/'.join(a['comboType'] + ':' + ','.join(a.get('ranks', [])) for a in c['gold']['alts']), '| decide', R[0][i]['decide'], '' if R[0][i]['decide_ok'] else 'X', ('| jev ' + ' '.join(r[i]['jev'] + ('' if r[i]['jev_ok'] else 'X') for r in R)) if jev else '', '|', c['gold']['rationale'])
