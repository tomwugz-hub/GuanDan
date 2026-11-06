# frozen-real2 (TEST-ONLY) sampler: same method as dev-real-sample.py, pool seed 59, excludes frozen-real + dev-real overlaps
import json, random
from collections import Counter, defaultdict
random.seed(20261059)
rows=[json.loads(l) for l in open('eval/endgames/selfplay-pool-fr2.jsonl')]
def feat(r):
    s=r['seat']; h=r['hands'][str(s)]; c=[len(r['hands'][str(i)]) for i in range(4)]
    em=min(c[(s+1)%4],c[(s+3)%4]); pc=c[(s+2)%4]
    ranks=Counter(x[:-1] if x not in('BJ','RJ') else x for x in h)
    bomb=any(v>=4 for k,v in ranks.items() if k not in('BJ','RJ')) or (ranks['BJ']+ranks['RJ'])==4
    wild=(r['levelRank']+'H') in h
    eb='1' if em==1 else '2' if em==2 else '3' if em==3 else '4-5' if em<=5 else '6+'
    prevby=None
    if not r['leading']:
        lp=r['trickMeta']['lastPlayer']; prevby='partner' if lp==(s+2)%4 else 'enemy'
    return dict(lead=r['leading'],eb=eb,pshort=(0<pc<=2),pout=(pc==0),bomb=bomb,wild=wild,prevby=prevby,n=len(h))
import json as _j
fz=set()
for fn in ['eval/endgames/frozen-real.jsonl','eval/endgames/dev-real.jsonl']:
  for l in open(fn):
    x=_j.loads(l); fz.add(_j.dumps([x['seat'],sorted(x['hands'][str(x['seat'])]),x['previous']],sort_keys=True))
cand=[r for r in rows if len(r['hands'][str(r['seat'])])<=12 and _j.dumps([r['seat'],sorted(r['hands'][str(r['seat'])]),r['previous']],sort_keys=True) not in fz]
random.shuffle(cand)
pick=[];pergame=Counter();cov=Counter()
def key(f): return (f['lead'],f['eb'],f['pshort'],f['bomb'],f['wild'],f['prevby'])
# greedy: prefer under-covered strata
for pas in range(6):
    for r in cand:
        if len(pick)>=120: break
        if r in pick or pergame[r['game']]>=3: continue
        f=feat(r); k=key(f)
        if cov[k]>pas: continue
        if f['pout'] and random.random()<0.7: continue
        pick.append(r); pergame[r['game']]+=1; cov[k]+=1
fs=[feat(r) for r in pick]
print(len(pick))
for name in ['lead','eb','pshort','pout','bomb','wild','prevby']:
    print(name, Counter(f[name] for f in fs))
for i,r in enumerate(pick): r['rid']=f"s{i+1:03d}"
json.dump(pick,open('eval/endgames/frozen-real2-picked.json','w'))
