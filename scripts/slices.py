#!/usr/bin/env python3
"""Slice accuracy: slices.py set.jsonl result1.json [result2.json ...]"""
import json,sys
from collections import defaultdict
cases={}
for l in open(sys.argv[1]):
    l=l.strip()
    if l: d=json.loads(l); cases[d['id']]=d
res=[json.load(open(f)) for f in sys.argv[2:]]
def keys(d):
    s=d.get('situation',{}) or {}
    ks=['all','mode='+str(s.get('mode')),'prevBy='+str(s.get('prevBy')),'wildHeld='+str(s.get('wildHeld')),'enemyMin='+str(s.get('enemyMin')),'conf='+str(d.get('confidence'))]
    return ks
tab=defaultdict(lambda:[0,0]+[0]*len(res))
for i,r in enumerate(res):
    for row in r['rows']:
        d=cases.get(row['id'])
        if not d: continue
        for k in keys(d):
            t=tab[k]
            if i==0:
                t[0]+=1; t[1]+=row['decide_ok']
            t[2+i]+=row['jev_ok'] if row.get('jev_ok') is not None else 0
print('| slice | n | decide | '+' | '.join(f'Jev{i+1}' for i in range(len(res)))+' |')
print('|---|---|---|'+'---|'*len(res))
for k in sorted(tab):
    t=tab[k]; n=t[0]
    print(f'| {k} | {n} | {t[1]} ({100*t[1]//max(n,1)}%) | '+' | '.join(f'{x} ({100*x//max(n,1)}%)' for x in t[2:])+' |')
