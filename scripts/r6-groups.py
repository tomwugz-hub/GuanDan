import json,sys
G=lambda i: 'A partner-overtake' if i<=35 else 'B lead' if i<=75 else 'C wild-bomb' if i<=110 else 'D enemy3-5'
res=[json.load(open(f)) for f in sys.argv[1:]]
from collections import defaultdict
t=defaultdict(lambda:[0,0]+[0]*len(res))
for k,r in enumerate(res):
  for x in r['rows']:
    g=G(int(x['id'][1:]))
    if k==0: t[g][0]+=1; t[g][1]+=x['decide_ok']
    t[g][2+k]+=bool(x['jev_ok'])
for g in sorted(t): print(g, t[g])
for k,r in enumerate(res): print('jev miss',k,[(x['id'],x['jev']) for x in r['rows'] if not x['jev_ok']])
print('decide miss',[(x['id'],x['decide']) for x in res[0]['rows'] if not x['decide_ok']])
