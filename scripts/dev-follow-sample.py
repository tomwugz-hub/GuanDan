# dev-follow (TUNING) sampler: 100 follow positions (enemy- and partner-played) + 50 wild-held positions, pool seed 67
import json, random
from collections import Counter
random.seed(20261067)
rows=[json.loads(l) for l in open('eval/endgames/selfplay-pool-follow.jsonl')]
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
    pb='out' if pc==0 else '1' if pc==1 else '2' if pc==2 else '3+'
    return dict(lead=r['leading'],eb=eb,pb=pb,bomb=bomb,wild=wild,prevby=prevby,n=len(h),nl=r.get('nLegal',2))
def k0(r): return json.dumps([r['seat'],sorted(r['hands'][str(r['seat'])]),r['previous']],sort_keys=True)
seen=set()
for fn in ['frozen-real','dev-real','frozen-real2','dev-lead','frozen-real3']:
    for l in open(f'eval/endgames/{fn}.jsonl'):
        x=json.loads(l); seen.add(json.dumps([x['seat'],sorted(x['hands'][str(x['seat'])]),x['previous']],sort_keys=True))
# realistic, non-trivial: >=2 legal non-pass options for follows (or a bomb option), hand 2..12
cand=[r for r in rows if 2<=len(r['hands'][str(r['seat'])])<=12 and k0(r) not in seen and r.get('nLegal',2)>=2]
random.shuffle(cand)
def pick_set(pool, N, keyf, keys, maxg=3, pg=None):
    pick=[]; pg=pg if pg is not None else Counter(); cov=Counter()
    for pas in range(8):
        for r in pool:
            if len(pick)>=N: break
            kk=k0(r)
            if kk in keys or pg[r['game']]>=maxg: continue
            f=feat(r); k=keyf(f)
            if cov[k]>pas: continue
            if f['pb']=='out' and random.random()<0.7: continue
            pick.append(r); keys.add(kk); pg[r['game']]+=1; cov[k]+=1
    return pick
keys=set(); pg=Counter()
fol=pick_set([r for r in cand if not r['leading']],100,lambda f:(f['prevby'],f['eb'],f['pb'],f['bomb']),keys,pg=pg)
wild=pick_set([r for r in cand if feat(r)['wild']],50,lambda f:(f['lead'],f['eb'],f['prevby'],f['bomb']),keys,pg=pg)
pick=fol+wild
for i,r in enumerate(pick): r['rid']=f"F{i+1:03d}"
fs=[feat(r) for r in pick]
print(len(fol),len(wild))
for name in ['lead','eb','pb','bomb','wild','prevby']: print(name,Counter(f[name] for f in fs))
json.dump(pick,open('eval/endgames/dev-follow-picked.json','w'))
