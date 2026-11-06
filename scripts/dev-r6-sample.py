# dev-r6 (TUNING) sampler, pool seed 101 (selfplay-pool-r6.jsonl). Targets round-6 weaknesses:
# A 35 partner-played follows with next enemy on <=3 cards; B 40 leads; C 35 wild-held with a wild-completable bomb;
# D 40 enemy-played follows with enemies on 3-5 cards.
import json, random
from collections import Counter
random.seed(20261101)
rows=[json.loads(l) for l in open('eval/endgames/selfplay-pool-r6.jsonl')]
RK=lambda x: x if x in('BJ','RJ') else x[:-1]
def feat(r):
    s=r['seat']; h=r['hands'][str(s)]; c=[len(r['hands'][str(i)]) for i in range(4)]
    em=min(c[(s+1)%4],c[(s+3)%4]); pc=c[(s+2)%4]; ne=c[(s+1)%4]
    lv=r['levelRank']; w=h.count(lv+'H')
    ranks=Counter(RK(x) for x in h if x!=lv+'H')
    nb=any(v>=4 for k,v in ranks.items() if k not in('BJ','RJ'))
    wb=w>0 and any(2<=v<4 and v+w>=4 for k,v in ranks.items() if k not in('BJ','RJ'))
    prevby=None
    if not r['leading']:
        lp=r['trickMeta']['lastPlayer']; prevby='partner' if lp==(s+2)%4 else 'enemy'
    return dict(lead=r['leading'],em=em,ne=ne,pc=pc,nb=nb,wb=wb,w=w,prevby=prevby,n=len(h))
def k0(r): return json.dumps([r['seat'],sorted(r['hands'][str(r['seat'])]),r['previous']],sort_keys=True)
seen=set()
for fn in ['frozen-real','dev-real','frozen-real2','dev-lead','frozen-real3','dev-follow']:
    for l in open(f'eval/endgames/{fn}.jsonl'):
        x=json.loads(l); seen.add(json.dumps([x['seat'],sorted(x['hands'][str(x['seat'])]),x['previous']],sort_keys=True))
cand=[r for r in rows if 2<=len(r['hands'][str(r['seat'])])<=12 and k0(r) not in seen and r.get('nLegal',2)>=2]
random.shuffle(cand)
keys=set(); pg=Counter()
def take(filt,N,keyf):
    pick=[]; cov=Counter()
    for pas in range(10):
        for r in cand:
            if len(pick)>=N: break
            kk=k0(r)
            if kk in keys or pg[r['game']]>=3: continue
            f=feat(r)
            if not filt(f): continue
            k=keyf(f)
            if cov[k]>pas: continue
            pick.append(r); keys.add(kk); pg[r['game']]+=1; cov[k]+=1
    return pick
A=take(lambda f: f['prevby']=='partner' and 1<=f['ne']<=3, 35, lambda f:(f['ne'],f['pc']>2,f['nb']))
B=take(lambda f: f['lead'], 40, lambda f:(min(f['em'],6),f['pc']>2,f['nb'] or f['wb']))
C=take(lambda f: f['wb'], 35, lambda f:(f['lead'],min(f['em'],6),f['prevby']))
D=take(lambda f: f['prevby']=='enemy' and 3<=f['em']<=5, 40, lambda f:(f['em'],f['pc']>2,f['nb'] or f['wb']))
pick=A+B+C+D
for i,r in enumerate(pick): r['rid']=f"R{i+1:03d}"
print(len(A),len(B),len(C),len(D))
json.dump(pick,open('eval/endgames/dev-r6-picked.json','w'))
