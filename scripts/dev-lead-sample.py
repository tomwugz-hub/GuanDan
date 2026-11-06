# dev-lead (TUNING) sampler: 120 lead + 30 enemy-on-1 follow positions from selfplay-pool-lead.jsonl (seed 41)
import json, random
from collections import Counter
random.seed(20261041)
rows=[json.loads(l) for l in open('eval/endgames/selfplay-pool-lead.jsonl')]
def cnts(r): return [len(r['hands'][str(i)]) for i in range(4)]
def feat(r):
    s=r['seat']; h=r['hands'][str(s)]; c=cnts(r)
    em=min(c[(s+1)%4],c[(s+3)%4]); pc=c[(s+2)%4]
    ranks=Counter(x[:-1] if x not in('BJ','RJ') else x for x in h)
    bomb=any(v>=4 for k,v in ranks.items() if k not in('BJ','RJ')) or (ranks['BJ']+ranks['RJ'])==4
    wild=(r['levelRank']+'H') in h
    eb='1' if em==1 else '2' if em==2 else '3' if em==3 else '4-5' if em<=5 else '6+'
    pb='out' if pc==0 else '1' if pc==1 else '2' if pc==2 else '3+'
    n=len(h); nb='1-3' if n<=3 else '4-6' if n<=6 else '7-12'
    return dict(lead=r['leading'],eb=eb,pb=pb,bomb=bomb,wild=wild,nb=nb,em=em)
seen=set()
for fn in ['frozen-real','dev-real','frozen-real2']:
    for l in open(f'eval/endgames/{fn}.jsonl'):
        x=json.loads(l); seen.add(json.dumps([x['seat'],sorted(x['hands'][str(x['seat'])]),x['previous']],sort_keys=True))
def k0(r): return json.dumps([r['seat'],sorted(r['hands'][str(r['seat'])]),r['previous']],sort_keys=True)
cand=[r for r in rows if len(r['hands'][str(r['seat'])])<=12 and k0(r) not in seen and len(r['hands'][str(r['seat'])])>=2]
random.shuffle(cand)
def pick_set(pool, N, keyf, maxg=3):
    pick=[]; pg=Counter(); cov=Counter(); keys=set()
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
leads=pick_set([r for r in cand if r['leading']],120,lambda f:(f['eb'],f['pb'],f['bomb'],f['wild'],f['nb']))
fol=pick_set([r for r in cand if not r['leading'] and feat(r)['em']==1],30,lambda f:(f['pb'],f['bomb'],f['wild'],f['nb']),maxg=1)
pick=leads+fol
for i,r in enumerate(pick): r['rid']=f"L{i+1:03d}"
fs=[feat(r) for r in pick]
print(len(leads),len(fol))
for name in ['eb','pb','bomb','wild','nb']: print(name,Counter(f[name] for f in fs[:120]))
json.dump(pick,open('eval/endgames/dev-lead-picked.json','w'))
