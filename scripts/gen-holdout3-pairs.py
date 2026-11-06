#!/usr/bin/env python3
"""Third blind holdout -> eval/endgames/holdout3-pairs.jsonl (written before running any system)."""
import json, os
src = open(os.path.join(os.path.dirname(__file__), 'gen-pairs.py')).read().split('# 1-4,20,28,58,59')[0]
ns = {}; exec(src, ns)
case, P, G, PF = ns['case'], ns['P'], ns['G'], ns['PF']
pairs = []
def pair(pid, detail, tags, a, ga, b, gb, unsure=None): pairs.append((pid, detail, tags, a, ga, b, gb, unsure))
S = lambda r, c: P('single', r, [c])

pair('m01', 'next enemy(2) count 2 vs 7 after partner(3) single 9; seat1', ['partner-protect','next-enemy-short'],
     case(1, ['KS','5D','6C','8H'], [7,4,2,5], prev=S('9','9C'), last=3), G('single',['K'], '下家报双：顶K'),
     case(1, ['KS','5D','6C','8H'], [7,4,7,5], prev=S('9','9C'), last=3), G('pass', why='护搭档'))
pair('m02', 'partner(2) played FH 7 vs single 7; next enemy(1) has 2', ['partner-protect','next-enemy-short'],
     case(0, ['JS','JH','JD','4C','4D','QS'], [6,2,5,6], prev=P('fullhouse','7',['7S','7H','7D','3S','3H']), last=2), G('pass', why='下家2张接不了三带二，护搭档'),
     case(0, ['JS','JH','JD','4C','4D','QS'], [6,2,5,6], prev=S('7','7C'), last=2), G('single',['Q'], '下家报双可接单：顶Q'))
pair('m03', 'overtake partner pair 6 to go out: hand 99 vs 99+4+7', ['partner-protect','go-out'],
     case(0, ['9S','9H'], [2,6,5,6], prev=P('pair','6',['6S','6D']), last=2), G('pair',['9'], '对9压上走完'),
     case(0, ['9S','9H','4C','7D'], [4,6,5,6], prev=P('pair','6',['6S','6D']), last=2), G('pass', why='护搭档'))
pair('m04', 'partner(2) count 1 vs 6 after partner single 10; next enemy(1) has 2', ['partner-protect','partner-short'],
     case(0, ['AS','3C','6D'], [3,2,1,6], prev=S('10','10C'), last=2), G('pass', why='搭档报单不压'),
     case(0, ['AS','3C','6D'], [3,2,6,6], prev=S('10','10C'), last=2), G('single',['A'], '下家报双：顶A'))
pair('m05', 'persona partner-first vs none; next enemy(1) has 2; partner single J', ['partner-protect','persona'],
     case(0, ['AS','4C','7D','8S'], [4,2,5,6], prev=S('J','JC'), last=2), G('single',['A'], '下家报双：顶A'),
     case(0, ['AS','4C','7D','8S'], [4,2,5,6], prev=S('J','JC'), last=2, persona=PF), G('pass', why='护搭档人设：不压'), unsure='B is persona-driven; mainstream would still overtake')
pair('m07', 'overtake partner single 5 when finishing in 2 (Q+88) vs not (Q+8+9)', ['partner-protect','finish-2'],
     case(0, ['QS','8C','8D'], [3,6,5,6], prev=S('5','5C'), last=2), G('single',['Q'], 'Q后对8走完'),
     case(0, ['QS','8C','9D'], [3,6,5,6], prev=S('5','5C'), last=2), G('pass', why='护搭档'))
pair('m09', 'enemy(1, 1 card) single A vs 4x9 bomb; bombs 5555 & QQQQ', ['bomb-choice'],
     case(0, ['5S','5H','5D','5C','QS','QH','QD','QC','3D'], [9,1,6,6], prev=S('A','AC'), last=1), G('bomb',['5'], '用小炸'),
     case(0, ['5S','5H','5D','5C','QS','QH','QD','QC','3D'], [9,1,6,6], prev=P('bomb','9',['9S','9H','9D','9C']), last=1), G('bomb',['Q'], '只有Q炸压得过'))
pair('m10', 'enemy(1, 1 card) single A vs 5x7 bomb; 6666 + straight flush', ['bomb-choice','straight-flush'],
     case(0, ['6S','6H','6D','6C','8H','9H','10H','JH','QH'], [9,1,6,6], prev=S('A','AC'), last=1), G('bomb',['6'], '用4炸留同花顺'),
     case(0, ['6S','6H','6D','6C','8H','9H','10H','JH','QH'], [9,1,6,6], prev=P('bomb','7',['7S','7H','7D','7C','7S']), last=1), G('straightFlush', why='只有同花顺压5炸'))
pair('m11', 'enemy(1) count 2 vs 6; triple 5 vs KKK88+3', ['enemy-2','triple'],
     case(0, ['KS','KH','KD','8C','8D','3S'], [6,2,6,6], prev=P('triple','5',['5S','5H','5D']), last=1), G('triple',['K'], '敌报双：三K拦'),
     case(0, ['KS','KH','KD','8C','8D','3S'], [6,6,6,6], prev=P('triple','5',['5S','5H','5D']), last=1), G('pass', why='保三带二'), unsure='B: triple K for triple 5 also playable')
pair('m13', 'one-card seat is enemy(1) vs partner(2); BJBJ 44 9', ['lead','partner-short'],
     case(0, ['BJ','BJ','4C','4D','9S'], [5,1,6,6], leading=True), G('pair',['4'], '敌报单：出小对'),
     case(0, ['BJ','BJ','4C','4D','9S'], [5,6,1,6], leading=True), G('single',['9'], '对家报单：出孤单9'))
pair('m15', 'levelRank 7 (7H wild) vs 2; follow straight 4-8 by enemy', ['wild','straight','go-out'],
     case(0, ['9S','10D','JC','QH','7H'], [5,6,6,6], prev=P('straight','8',['4S','5D','6C','7S','8H']), last=1, level='7'), G('straight', why='逢人配成顺子压上走完'),
     case(0, ['9S','10D','JC','QH','7H'], [5,6,6,6], prev=P('straight','8',['4S','5D','6C','7S','8H']), last=1, level='2'), G('pass', why='无顺子'))
pair('m17', 'partner(2) count 1 vs 5 with [BJ,6]', ['two-singles','partner-short','joker'],
     case(0, ['BJ','6C'], [2,5,5,5], leading=True), G('single',['BJ'], '先出小王'),
     case(0, ['BJ','6C'], [2,5,1,5], leading=True), G('single',['6'], '对家报单：出6'))
pair('m19', 'enemy(1) count 2 vs partner(2) count 2; straight + QQ', ['enemy-2','partner-2','straight'],
     case(0, ['3C','4D','5S','6H','7C','QS','QH'], [7,2,6,6], leading=True), G('straight',['3','7'], '敌报双：出顺子'),
     case(0, ['3C','4D','5S','6H','7C','QS','QH'], [7,6,2,6], leading=True), G('pair',['Q'], '对家剩2：出对'))
pair('m21', 'partner(2) played pair 9 vs single 9; next enemy(1) has 1', ['partner-protect','next-enemy-short'],
     case(0, ['KS','KH','QD','5C'], [4,1,5,6], prev=P('pair','9',['9S','9D']), last=2), G('pass', why='下家1张接不了对，护搭档'),
     case(0, ['KS','KH','QD','5C'], [4,1,5,6], prev=S('9','9C'), last=2), G('single',['Q','K'], '下家报单：顶'))
pair('m22', 'bomb goes out over partner: 7777 vs 7777+3', ['partner-protect','go-out','bomb'],
     case(0, ['7S','7H','7D','7C'], [4,5,5,6], prev=S('10','10C'), last=2), G('bomb',['7'], '炸弹走完'),
     case(0, ['7S','7H','7D','7C','3D'], [5,5,5,6], prev=S('10','10C'), last=2), G('pass', why='不炸搭档'))
pair('m27', 'one-card seat is partner(2) vs enemy(1); 33 J 8', ['partner-short','lead'],
     case(0, ['3C','3D','JS','8H'], [4,6,1,6], leading=True), G('single',['8'], '对家报单：出孤单8'),
     case(0, ['3C','3D','JS','8H'], [4,1,6,6], leading=True), G('pair',['3'], '敌报单：出对3'))
pair('m29', 'one-card seat is enemy(3) vs partner(2); 9999 66', ['partner-short','lead','bomb'],
     case(0, ['9S','9H','9D','9C','6S','6H'], [6,6,6,1], leading=True), G('pair',['6'], '敌报单：出对6留炸'),
     case(0, ['9S','9H','9D','9C','6S','6H'], [6,6,1,6], leading=True), G('single',['6'], '对家报单：拆对出6'))
pair('m32', 'enemy(1) count 1 vs 6 vs pair K; 4444 + 10101010', ['bomb-choice','enemy-count'],
     case(0, ['4S','4H','4D','4C','10S','10H','10D','10C','6C'], [9,1,6,6], prev=P('pair','K',['KS','KH']), last=1), G('bomb',['4'], '用小炸'),
     case(0, ['4S','4H','4D','4C','10S','10H','10D','10C','6C'], [9,6,6,6], prev=P('pair','K',['KS','KH']), last=1), G('pass', why='敌多不炸'))
pair('m33', 'enemy(1, 1 card) single A vs 6x8 bomb; rocket + 5555', ['rocket','bomb-choice'],
     case(0, ['BJ','BJ','RJ','RJ','5S','5H','5D','5C','3C'], [9,1,6,6], prev=S('A','AC'), last=1), G('bomb',['5'], '用5炸留天王炸'),
     case(0, ['BJ','BJ','RJ','RJ','5S','5H','5D','5C','3C'], [9,1,6,6], prev=P('bomb','8',['8S','8H','8D','8C','8S','8H']), last=1), G('bomb',['RJ'], '只有天王炸压6炸'))
pair('m45', 'enemy(1) count 2 vs 6; level pair J vs pair A', ['level','enemy-2','pair'],
     case(0, ['JS','JD','5C','7S'], [4,2,6,6], prev=P('pair','A',['AS','AH']), last=1, level='J'), G('pair',['J'], '级牌对压对A'),
     case(0, ['JS','JD','5C','7S'], [4,6,6,6], prev=P('pair','A',['AS','AH']), last=1, level='J'), G('pass', why='敌多留级牌对'))
pair('m48', 'one-card seat is enemy(1) vs partner(2); AA 5', ['partner-short','lead','control'],
     case(0, ['AS','AH','5D'], [3,1,6,6], leading=True), G('pair',['A'], '敌报单：先出对A'),
     case(0, ['AS','AH','5D'], [3,6,1,6], leading=True), G('single',['5'], '对家报单：出5'))
pair('m49', 'two-card seat is enemy(1) vs partner(2); 66 JJ 3', ['enemy-2','partner-2','lead'],
     case(0, ['6C','6D','JS','JH','3S'], [5,2,6,6], leading=True), G('single',['3'], '敌报双：出孤单3'),
     case(0, ['6C','6D','JS','JH','3S'], [5,6,2,6], leading=True), G('pair',['6'], '对家剩2：出对6'))
pair('m50', '4x9 bomb by partner(2) vs enemy(1); enemy(1) has 1; straight flush', ['partner-vs-enemy','straight-flush'],
     case(0, ['3D','4D','5D','6D','7D','KC'], [6,1,5,6], prev=P('bomb','9',['9S','9H','9D','9C']), last=2), G('pass', why='不炸搭档'),
     case(0, ['3D','4D','5D','6D','7D','KC'], [6,1,5,6], prev=P('bomb','9',['9S','9H','9D','9C']), last=1), G('straightFlush', why='敌报单：同花顺压'))
pair('m51', 'next enemy(1) count 2 vs 5 after partner pair 8', ['partner-protect','next-enemy-short','pair'],
     case(0, ['JS','JH','4C','6D'], [4,2,5,6], prev=P('pair','8',['8S','8D']), last=2), G('pair',['J'], '下家报双：对J顶'),
     case(0, ['JS','JH','4C','6D'], [4,5,5,6], prev=P('pair','8',['8S','8D']), last=2), G('pass', why='护搭档'))
pair('m53', 'next enemy(1) has 2 after partner single 6: 8888+3 vs 8888+3+9', ['partner-protect','next-enemy-short','bomb'],
     case(0, ['8S','8H','8D','8C','3C'], [5,2,5,6], prev=S('6','6C'), last=2), G('pass', why='只能拆炸/炸搭档，过'),
     case(0, ['8S','8H','8D','8C','3C','9D'], [6,2,5,6], prev=S('6','6C'), last=2), G('single',['9'], '下家报双：9顶'))
pair('m54', 'partner played FH 5 vs triple 5; TTT77 hand', ['partner-protect','go-out','fullhouse'],
     case(0, ['10S','10H','10D','7C','7D'], [5,6,5,6], prev=P('fullhouse','5',['5S','5H','5D','3S','3H']), last=2), G('fullhouse',['10'], '压上走完'),
     case(0, ['10S','10H','10D','7C','7D'], [5,6,5,6], prev=P('triple','5',['5S','5H','5D']), last=2), G('pass', why='护搭档，不拆三带二'))
pair('m58', 'partner(2) count 2 vs 7; 33 10 QQ', ['partner-2','lead'],
     case(0, ['3C','3D','10S','QH','QD'], [5,6,2,6], leading=True), G('pair',['3'], '对家剩2：出对3'),
     case(0, ['3C','3D','10S','QH','QD'], [5,6,7,6], leading=True), G('single',['10'], '敌多：先出孤单10'), unsure='B: pair 3 first also mainstream-acceptable')
pair('m59', 'next enemy(1) count 2 vs 6 after partner single 3', ['partner-protect','next-enemy-short'],
     case(0, ['5C','9D','KS'], [3,2,5,6], prev=S('3','3C'), last=2), G('single',['K'], '下家报双：顶大K'),
     case(0, ['5C','9D','KS'], [3,6,5,6], prev=S('3','3C'), last=2), G('pass', why='护搭档'))

rows, unsure = [], {}
for pid, detail, tags, a, ga, b, gb, u in pairs:
    if u: unsure[pid] = u
    for suf, c, g in (('a', a, ga), ('b', b, gb)):
        rows.append({"id": f"{pid}{suf}", "pair_id": pid, "pivot": detail, "tags": ["pair", "holdout3"] + tags, **c, "gold": g, **({"gold_unsure": u} if u else {})})
out = os.path.join(os.path.dirname(__file__), '..', 'eval', 'endgames', 'holdout3-pairs.jsonl')
with open(out, 'w') as f:
    for r in rows: f.write(json.dumps(r, ensure_ascii=False) + '\n')
print(len(pairs), 'pairs', len(rows), 'cases; unsure:', list(unsure))
