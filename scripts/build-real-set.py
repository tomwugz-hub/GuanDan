#!/usr/bin/env python3
"""Build a *-real.jsonl from picked positions + hand labels. usage: build-real-set.py picked.json labels.py out.jsonl tag"""
import json, runpy, sys
from collections import Counter
picked, labels, out, tag = sys.argv[1:5]
_ns = runpy.run_path(labels); L = _ns['L']; GOLD_OLD = _ns.get('GOLD_OLD', {})
rows = []
for r in json.load(open(picked)):
    alts, conf, note = L[r['rid']]
    A = [{"comboType": "pass"} if a[0] == 'pass' else dict({"comboType": a[0], "ranks": a[1]}, **({"size": a[2]} if len(a) > 2 else {})) for a in alts]
    s = r['seat']; h = r['hands'][str(s)]; c = [len(r['hands'][str(i)]) for i in range(4)]
    em = min(c[(s+1)%4], c[(s+3)%4]); pc = c[(s+2)%4]
    rk = Counter(x if x in ('BJ','RJ') else x[:-1] for x in h)
    bomb = any(v >= 4 for k, v in rk.items() if k not in ('BJ','RJ')) or rk['BJ'] + rk['RJ'] == 4
    lp = None if r['leading'] else r['trickMeta']['lastPlayer']
    sit = {"mode": "lead" if r['leading'] else "follow", "enemyMin": "1" if em == 1 else "2" if em == 2 else "3" if em == 3 else "4-5" if em <= 5 else "6+",
           "partner": "out" if pc == 0 else "1" if pc == 1 else "2" if pc == 2 else "3+", "bombHeld": bomb, "wildHeld": (r['levelRank'] + 'H') in h,
           "prevBy": None if lp is None else ("partner" if lp == (s+2)%4 else "enemy"), "myCount": "1-3" if len(h) <= 3 else "4-6" if len(h) <= 6 else "7-12"}
    g0 = A[0]
    row = {"id": r['rid'], "tags": [tag], "source": {"game": r['game'], "seed": r['seed'], "play": r['play']}, "levelRank": r['levelRank'], "seat": s,
           "leading": r['leading'], "hands": r['hands'], "previous": r['previous'], "firstLeadOfDeal": False, "confidence": conf, "situation": sit,
           "gold": {"action": "pass" if g0["comboType"] == "pass" else "play", "comboType": g0["comboType"], "ranks": g0.get("ranks", []), "alts": A, "rationale": note}}
    if r['rid'] in GOLD_OLD:
        oa, oc, on = GOLD_OLD[r['rid']]
        row["gold_old"] = {"alts": [{"comboType": "pass"} if a[0] == 'pass' else {"comboType": a[0], "ranks": a[1]} for a in oa], "confidence": oc, "rationale": on}
    if not r['leading']: row["trickMeta"] = r['trickMeta']
    rows.append(row)
open(out, 'w').write(''.join(json.dumps(x, ensure_ascii=False) + '\n' for x in rows))
print(len(rows), Counter(x['confidence'] for x in rows))
