#!/usr/bin/env python3
"""FROZEN100 TEST-ONLY set -> eval/endgames/frozen100-pairs.jsonl. Never used for tuning.
Golds come from mainstream principles (written before any run)."""
import json, os
src = open(os.path.join(os.path.dirname(__file__), 'gen-pairs.py')).read().split('# 1-4,20,28,58,59')[0]
ns = {}; exec(src, ns)
case, P, G = ns['case'], ns['P'], ns['G']
SU = ['S', 'H', 'D', 'C']
def c(r, i=0): return f"{r}{SU[i % 4]}"
def singles(rs, off=0): return [c(r, off + i) for i, r in enumerate(rs)]
def two(r): return [c(r, 0), c(r, 2)]
def three(r): return [c(r, 0), c(r, 2), c(r, 3)]
def four(r): return [c(r, i) for i in range(4)]
S = lambda r: P('single', r, [c(r, 3)])
def cnt(seat, me, partner, nxt, prv):
    a = [0] * 4; a[seat] = me; a[(seat + 2) % 4] = partner; a[(seat + 1) % 4] = nxt; a[(seat + 3) % 4] = prv; return a
NXT = lambda s: (s + 1) % 4; PRV = lambda s: (s + 3) % 4; PAR = lambda s: (s + 2) % 4
pairs = []
def pair(theme, detail, a, ga, b, gb, unsure=None): pairs.append((theme, detail, a, ga, b, gb, unsure))
LONG = [5, 6, 7, 8, 4]

# T1 follow single: enemy vs partner played it (enemies long)
for k, (s, X, Y, sm) in enumerate([(0,'9','J',['3','5','6']), (1,'8','Q',['3','4','6']), (2,'10','K',['5','7','9']), (3,'6','9',['3','4','5']), (0,'J','K',['4','7','9'])]):
    h = [c(Y, 1)] + singles(sm, 2); L = LONG[k]
    pair('T1-partner-vs-enemy-follow', f'single {X} by enemy vs partner; beater {Y}',
         case(s, h, cnt(s, len(h), 6, L, 8 - k % 3), prev=S(X), last=PRV(s)), G('single', [Y], '敌出单：最小够大的孤单压'),
         case(s, h, cnt(s, len(h), 6, L, 8 - k % 3), prev=S(X), last=PAR(s)), G('pass', why='护搭档'))
# T2 bomb-or-pass by enemy count (no ordinary beater)
for k, (s, X, B, sm) in enumerate([(0,'7','K',['3','5']), (1,'9','6',['4','8']), (2,'Q','5',['3','10']), (3,'A','J',['4','9']), (0,'10','8',['3','6'])]):
    h = four(B) + singles(sm, 1)
    pair('T2-bomb-vs-enemy-count', f'single {X}; enemy 1 vs {LONG[k]+1}; bomb {B}',
         case(s, h, cnt(s, len(h), 6, 7, 1), prev=S(X), last=PRV(s)), G('bomb', [B], '敌报单：炸'),
         case(s, h, cnt(s, len(h), 6, 7, LONG[k] + 1), prev=S(X), last=PRV(s)), G('pass', why='敌多：不炸'))
# T3 bomb sizing: two bombs
for k, (s, r1, r2, x, mid) in enumerate([(0,'5','Q','3','9'), (1,'4','10','7','8'), (2,'6','K','3','J'), (3,'3','9','K','7')]):
    h = four(r1) + four(r2) + [c(x, 1)]
    pair('T3-bomb-sizing', f'enemy 1: single A vs bomb {mid}; bombs {r1},{r2}',
         case(s, h, cnt(s, 9, 6, 1, 6), prev=S('A'), last=NXT(s)), G('bomb', [r1], '用小炸'),
         case(s, h, cnt(s, 9, 6, 1, 6), prev=P('bomb', mid, four(mid)), last=NXT(s)), G('bomb', [r2], '只有大炸压得过'))
# T4 ordinary suffices vs bomb (enemy 1 played pair)
for k, (s, X, B, Y, Yb, sm) in enumerate([(0,'8','5','J','6','3'), (1,'9','7','Q','4','3'), (2,'6','K','10','3','5'), (3,'10','4','A','8','6'), (0,'7','Q','9','5','3')]):
    ha = four(B) + two(Y) + [c(sm, 1)]; hb = four(B) + two(Yb) + [c(sm, 1)]
    pair('T4-ordinary-suffices', f'enemy 1 played pair {X}: pair {Y} vs pair {Yb}; bomb {B}',
         case(s, ha, cnt(s, 7, 6, 6, 1), prev=P('pair', X, two(X)), last=PRV(s)), G('pair', [Y], '对子够大：不炸'),
         case(s, hb, cnt(s, 7, 6, 6, 1), prev=P('pair', X, two(X)), last=PRV(s)), G('bomb', [B], '对子压不住：炸'))
# T5 who-is-short lead: pair + orphans
for k, (s, Pr, orph) in enumerate([(0,'7',['3','J','K']), (1,'9',['4','8','Q']), (2,'5',['6','10','A']), (3,'Q',['3','7','9']), (0,'4',['5','8','K'])]):
    h = two(Pr) + singles(orph, 1); E1 = (lambda s: cnt(s, 5, 6, 1, LONG[k])) if k % 2 == 0 else (lambda s: cnt(s, 5, 6, LONG[k], 1))
    small = min(orph, key=lambda r: ['3','4','5','6','7','8','9','10','J','Q','K','A'].index(r))
    pair('T5-who-is-short-lead', f'pair {Pr}+orphans: enemy=1 vs partner=1',
         case(s, h, E1(s), leading=True), G('pair', [Pr], '敌报单：出对'),
         case(s, h, cnt(s, 5, 1, LONG[k], 6), leading=True), G('single', [small], '搭档报单：喂最小孤单'))
# T6 enemy 2: fullhouse vs partner 1 feed
for k, (s, T, Pp, o) in enumerate([(0,'8','4','3'), (1,'J','6','5'), (2,'5','9','7'), (3,'Q','3','8')]):
    h = three(T) + two(Pp) + [c(o, 1)]
    pair('T6-fullhouse-vs-feed', f'FH {T}{Pp}+{o}: enemy=2 vs partner=1',
         case(s, h, cnt(s, 6, 6, 2, 7), leading=True), G('fullhouse', [T], '敌报双：三带二'),
         case(s, h, cnt(s, 6, 1, 7, 6), leading=True), G('single', [o], '搭档报单：喂孤单'))
# T7 straight lead vs feed
for k, (s, lo, o) in enumerate([(0,5,'3'), (1,6,'4'), (2,7,'3'), (3,9,'5')]):
    R = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
    st = [c(R[lo - 2 + i], i) for i in range(5)]; h = st + [c(o, 1)]
    pair('T7-straight-lead', f'straight from {R[lo-2]}+{o}: enemy=1 vs partner=1',
         case(s, h, cnt(s, 6, 6, 1, 6), leading=True), G('straight', [R[lo-2]], '敌报单：顺子'),
         case(s, h, cnt(s, 6, 1, 6, 6), leading=True), G('single', [o], '搭档报单：喂孤单'))
# T8 tube (pairSeq) lead vs feed
for k, (s, a, b, cc, o) in enumerate([(0,'3','4','5','9'), (1,'6','7','8','4'), (2,'9','10','J','3'), (3,'4','5','6','8')]):
    h = two(a) + two(b) + two(cc) + [c(o, 1)]
    pair('T8-tube-lead', f'tube {a}{b}{cc}+{o}: enemy=2 vs partner=1',
         case(s, h, cnt(s, 7, 6, 7, 2), leading=True), G('pairSeq', [a, b, cc], '敌报双：连对'),
         case(s, h, cnt(s, 7, 1, 7, 6), leading=True), G('single', [o], '搭档报单：喂孤单'))
# T9 plate follow: enemy 1 vs partner played it
for k, (s, p1, p2, m1, m2, o) in enumerate([(0,'3','4','7','8',['5','J']), (1,'5','6','9','10',['3','K']), (2,'4','5','Q','K',['3','7']), (3,'6','7','10','J',['4','9'])]):
    h = three(m1) + three(m2) + singles(o, 1); prev = P('tripleSeq', p2, three(p1) + three(p2))
    pair('T9-plate-follow', f'plate {p1}{p2}: enemy=1 vs partner; mine {m1}{m2}',
         case(s, h, cnt(s, 8, 7, 7, 1), prev=prev, last=PRV(s)), G('tripleSeq', [m1, m2], '敌报单：钢板压'),
         case(s, h, cnt(s, 8, 7, 7, 6), prev=prev, last=PAR(s)), G('pass', why='护搭档'))
# T10 partner protection: next enemy 2 vs long
for k, (s, X, Y, sm) in enumerate([(0,'8','K',['3','5']), (1,'6','J',['4','5']), (2,'9','A',['3','7']), (3,'5','Q',['3','4']), (0,'10','K',['4','6','7'])]):
    h = [c(Y, 1)] + singles(sm, 2)
    pair('T10-protect-next-enemy-short', f'partner single {X}; next enemy 2 vs {LONG[k]+1}',
         case(s, h, cnt(s, len(h), 5, 2, 6), prev=S(X), last=PAR(s)), G('single', [Y], '下家报双：顶'),
         case(s, h, cnt(s, len(h), 5, LONG[k] + 1, 6), prev=S(X), last=PAR(s)), G('pass', why='护搭档'))
# T11 partner pair vs single; next enemy 1
for k, (s, X, Y, Z, sm) in enumerate([(0,'7','J','Q','3'), (1,'9','K','A','4'), (2,'5','10','J','3'), (3,'8','Q','K','4')]):
    h = two(Y) + [c(Z, 1), c(sm, 3)]
    pair('T11-protect-shape-unanswerable', f'partner pair {X} vs single {X}; next enemy 1',
         case(s, h, cnt(s, 4, 5, 1, 6), prev=P('pair', X, two(X)), last=PAR(s)), G('pass', why='下家1张接不了对'),
         case(s, h, cnt(s, 4, 5, 1, 6), prev=S(X), last=PAR(s)), G('single', [Z, Y], '下家报单：顶'))
# T12 partner on 1 card: don't overtake
for k, (s, X, Y, sm) in enumerate([(0,'9','K',['3','6']), (1,'7','Q',['4','5']), (2,'10','A',['3','8']), (3,'6','J',['4','5'])]):
    h = [c(Y, 1)] + singles(sm, 2)
    pair('T12-partner-1-no-overtake', f'partner single {X}: partner 1 vs 6; next enemy 2',
         case(s, h, cnt(s, 3, 1, 2, 6), prev=S(X), last=PAR(s)), G('pass', why='搭档报单不压'),
         case(s, h, cnt(s, 3, 6, 2, 6), prev=S(X), last=PAR(s)), G('single', [Y], '下家报双：顶'))
# T13 overtake partner to finish in 2
for k, (s, X, Y, Pp, a, b) in enumerate([(0,'6','J','8','3','4'), (1,'9','Q','4','5','7'), (2,'5','10','3','4','3'), (3,'8','K','7','4','6')]):
    if a == b: b = '2' if False else '4' if a != '4' else '3'
    ha = [c(Y, 1)] + two(Pp); hb = [c(Y, 1), c(a, 0), c(b, 2)]
    pair('T13-finish-in-2-overtake', f'partner single {X}: {Y}+pair{Pp} vs {Y}+{a}+{b}',
         case(s, ha, cnt(s, 3, 6, 6, 6), prev=S(X), last=PAR(s)), G('single', [Y], '压后对子走完'),
         case(s, hb, cnt(s, 3, 6, 6, 6), prev=S(X), last=PAR(s)), G('pass', why='护搭档'))
# T14 two singles level ordering
for k, (s, Lr, N) in enumerate([(0,'5','A'), (1,'9','K'), (2,'J','A'), (3,'7','Q'), (0,'3','A')]):
    h = [c(Lr, 3), c(N, 0)]
    pair('T14-two-singles-level', f'[{Lr},{N}] level {Lr} vs 2',
         case(s, h, cnt(s, 2, 5, 6, 6), leading=True, level=Lr), G('single', [Lr], '级牌大，先出'),
         case(s, h, cnt(s, 2, 5, 6, 6), leading=True, level='2'), G('single', [N], '先出大的'))
# T15 wild completes pair to go out
for k, (s, Lr, Y, X) in enumerate([(0,'9','K','10'), (1,'6','Q','8'), (2,'4','A','J'), (3,'7','J','9')]):
    h = [Lr + 'H', c(Y, 0)]
    pair('T15-wild-go-out', f'{Lr}H+{Y} vs pair {X}: level {Lr} vs 2',
         case(s, h, cnt(s, 2, 6, 6, 6), prev=P('pair', X, two(X)), last=PRV(s), level=Lr), G('pair', [Y], '逢人配成对走完'),
         case(s, h, cnt(s, 2, 6, 6, 6), prev=P('pair', X, two(X)), last=PRV(s), level='2'), G('pass', why='凑不成对'))
# T16 wild completes bomb: enemy 1 vs long vs pair A
for k, (s, R, Lr, s1, s2) in enumerate([(0,'8','5','3','K'), (1,'J','9','4','6'), (2,'6','10','3','7'), (3,'Q','4','5','8')]):
    h = three(R) + [Lr + 'H', c(s1, 1), c(s2, 1)]
    pair('T16-wild-bomb', f'{R}{R}{R}+{Lr}H vs pair A: enemy 1 vs 6',
         case(s, h, cnt(s, 6, 6, 6, 1), prev=P('pair', 'A', two('A')), last=PRV(s), level=Lr), G('bomb', [R], '逢人配补炸拦'),
         case(s, h, cnt(s, 6, 6, 6, 6), prev=P('pair', 'A', two('A')), last=PRV(s), level=Lr), G('pass', why='敌多不炸'))
# T17 late control: big pair first
for k, (s, Bg, Sm) in enumerate([(0,'K','4'), (1,'A','6'), (2,'Q','3'), (3,'A','5'), (1,'K','7')]):
    h = two(Bg) + [c(Sm, 1), c(Sm, 3)]
    pair('T17-late-control-big-pair', f'{Bg}{Bg}{Sm}{Sm}: enemy 1 vs partner 1',
         case(s, h, cnt(s, 4, 6, 1, 6), leading=True), G('pair', [Bg], '敌报单：先出大对'),
         case(s, h, cnt(s, 4, 1, 6, 6), leading=True), G('single', [Sm], '搭档报单：拆小对喂'))
# T18 singles-only lead
for k, (s, rs) in enumerate([(0,['4','8','Q']), (1,['3','9','A']), (2,['5','7','K']), (3,['6','10','J'])]):
    h = singles(rs)
    pair('T18-singles-only-lead', f'{rs}: enemy 1 vs partner 1',
         case(s, h, cnt(s, 3, 6, 6, 1), leading=True), G('single', [rs[-1]], '敌报单：从大出'),
         case(s, h, cnt(s, 3, 1, 6, 6), leading=True), G('single', [rs[0]], '搭档报单：喂最小'))
# T19 wild pair follow by enemy count
for k, (s, Lr, X, Y, s1, s2) in enumerate([(0,'10','8','J','4','6'), (1,'5','9','Q','3','7'), (2,'7','10','K','4','6'), (3,'J','6','9','3','4')]):
    h = [Lr + 'H', c(Y, 0), c(s1, 1), c(s2, 2)]
    pair('T19-wild-follow-enemy-count', f'wild {Lr}H+{Y} vs pair {X}: enemy 1 vs 6',
         case(s, h, cnt(s, 4, 6, 6, 1), prev=P('pair', X, two(X)), last=PRV(s), level=Lr), G('pair', [Y], '敌报单：逢人配成对拦'),
         case(s, h, cnt(s, 4, 6, 6, 6), prev=P('pair', X, two(X)), last=PRV(s), level=Lr), G('pass', why='敌多：留逢人配'))
# T20 enemy 2 vs partner 2 lead: pair + orphans
for k, (s, Pp, orph) in enumerate([(0,'6',['4','9','K']), (1,'8',['3','10','Q']), (2,'5',['7','9','J']), (3,'J',['4','6','8'])]):
    h = two(Pp) + singles(orph, 1)
    pair('T20-enemy2-vs-partner2', f'pair {Pp}+{orph}: enemy 2 vs partner 2',
         case(s, h, cnt(s, 5, 6, 2, 7), leading=True), G('single', orph, '敌报双：出单不出对'),
         case(s, h, cnt(s, 5, 2, 7, 6), leading=True), G('pair', [Pp], '搭档剩2：喂对'))
# T22 lead vs follow
for k, (s, rs, X, Y) in enumerate([(0,['3','6','9','Q'],'7','9'), (1,['4','8','10','K'],'9','10'), (2,['3','5','J','A'],'8','J'), (3,['5','7','9','Q'],'6','7')]):
    h = singles(rs)
    pair('T22-lead-vs-follow', f'{rs}: lead vs follow single {X}',
         case(s, h, cnt(s, 4, 6, 6, 7), leading=True), G('single', [rs[0]], '领出：最小孤单'),
         case(s, h, cnt(s, 4, 6, 6, 7), prev=S(X), last=PRV(s)), G('single', [Y], '跟：最小够大'))
# T23 4-bomb vs straight flush sizing
for k, (s, X, Y, sf) in enumerate([(0,'9','Q',['3H','4H','5H','6H','7H']), (1,'6','K',['8S','9S','10S','JS','QS']), (2,'J','A',['4D','5D','6D','7D','8D'])]):
    h = four(Y) + sf
    pair('T23-bomb-vs-straightflush', f'enemy 1: bomb {X}x4 vs x5; have {Y}x4 + SF',
         case(s, h, cnt(s, 9, 6, 1, 6), prev=P('bomb', X, four(X)), last=NXT(s)), G('bomb', [Y], '4炸够大，留同花顺'),
         case(s, h, cnt(s, 9, 6, 1, 6), prev=P('bomb', X, four(X) + [c(X, 0)]), last=NXT(s)), G('straightFlush', why='只有同花顺压5炸'))
# T24 fullhouse follow: enemy 1 vs partner
for k, (s, X, Y, Pp, o) in enumerate([(0,'6','10','3',['5','8']), (1,'8','Q','4',['6','9']), (2,'5','J','7',['3','9']), (3,'9','K','5',['4','6'])]):
    h = three(Y) + two(Pp) + singles(o, 1); prev = P('fullhouse', X, three(X) + two('2' if X != '2' else '3'))
    prev = P('fullhouse', X, three(X) + [c('3', 1), c('3', 2)] if Pp != '3' else three(X) + [c('4', 1), c('4', 2)])
    pair('T24-fullhouse-follow', f'FH {X} by enemy(1 card) vs partner; mine FH {Y}',
         case(s, h, cnt(s, 7, 6, 6, 1), prev=prev, last=PRV(s)), G('fullhouse', [Y], '敌报单：三带二压'),
         case(s, h, cnt(s, 7, 6, 6, 6), prev=prev, last=PAR(s)), G('pass', why='护搭档'))
# T25 rocket preservation
for k, (s, B) in enumerate([(0,'5'), (2,'9'), (3,'J')]):
    h = ['BJ', 'BJ', 'RJ', 'RJ'] + four(B) + [c('3', 1)]
    pair('T25-rocket-preserve', f'enemy 1: single A vs 6x8 bomb; rocket + {B}x4',
         case(s, h, cnt(s, 9, 6, 1, 6), prev=S('A'), last=NXT(s)), G('bomb', [B], '用小炸留天王炸'),
         case(s, h, cnt(s, 9, 6, 1, 6), prev=P('bomb', '8', four('8') + [c('8', 0), c('8', 1)]), last=NXT(s)), G('bomb', ['RJ'], '只有天王炸'))

rows, unsure = [], {}
for i, (theme, detail, a, ga, b, gb, u) in enumerate(pairs):
    pid = f'f{i+1:03d}'
    if u: unsure[pid] = u
    for suf, cc, g in (('a', a, ga), ('b', b, gb)):
        rows.append({"id": f"{pid}{suf}", "pair_id": pid, "theme": theme, "pivot": detail, "tags": ["pair", "frozen100", "TEST-ONLY", theme], **cc, "gold": g, **({"gold_unsure": u} if u else {})})
out = os.path.join(os.path.dirname(__file__), '..', 'eval', 'endgames', 'frozen100-pairs.jsonl')
with open(out, 'w') as f:
    for r in rows: f.write(json.dumps(r, ensure_ascii=False) + '\n')
print(len(pairs), 'pairs', len(rows), 'cases; unsure:', list(unsure))
