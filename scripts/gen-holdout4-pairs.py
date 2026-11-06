#!/usr/bin/env python3
"""Fourth blind holdout -> eval/endgames/holdout4-pairs.jsonl (written before running any system)."""
import json, os
src = open(os.path.join(os.path.dirname(__file__), 'gen-pairs.py')).read().split('# 1-4,20,28,58,59')[0]
ns = {}; exec(src, ns)
case, P, G, PF = ns['case'], ns['P'], ns['G'], ns['PF']
pairs = []
def pair(pid, detail, tags, a, ga, b, gb, unsure=None): pairs.append((pid, detail, tags, a, ga, b, gb, unsure))
S = lambda r, c: P('single', r, [c])

# —— short partner vs short enemy (lead) ——
pair('q01', 'seat1 lead: partner(3)=1 vs enemy(2)=1; 77 Q 3 8', ['who-is-short','lead'],
     case(1, ['7C','7D','QS','3H','8S'], [6,5,6,1], leading=True), G('single',['3'], '搭档报单：喂最小孤单3'),
     case(1, ['7C','7D','QS','3H','8S'], [6,5,1,6], leading=True), G('pair',['7'], '敌报单：出对7'))
pair('q02', 'seat2 lead: enemy(3)=1 vs partner(0)=1; KK 5 10', ['who-is-short','lead'],
     case(2, ['KS','KD','5C','10H'], [6,6,4,1], leading=True), G('pair',['K'], '敌报单：出对K'),
     case(2, ['KS','KD','5C','10H'], [1,6,4,6], leading=True), G('single',['5'], '搭档报单：喂5'))
pair('q03', 'seat3 lead: enemy(0)=2 vs partner(1)=1; 666 99 4', ['who-is-short','lead','fullhouse'],
     case(3, ['6S','6H','6D','9C','9D','4S'], [2,6,6,6], leading=True), G('fullhouse',['6'], '敌报双：三带二'),
     case(3, ['6S','6H','6D','9C','9D','4S'], [6,1,6,6], leading=True), G('single',['4'], '搭档报单：喂4'))
pair('q04', 'seat1 lead w/ bomb: enemy(2)=1 vs partner(3)=1; JJJJ 88 3', ['who-is-short','bomb-preserve','lead'],
     case(1, ['JS','JH','JD','JC','8S','8D','3C'], [6,7,1,6], leading=True), G('pair',['8'], '敌报单：出对8留炸'),
     case(1, ['JS','JH','JD','JC','8S','8D','3C'], [6,7,6,1], leading=True), G('single',['3'], '搭档报单：喂3'))
pair('q27', 'seat2 lead: partner(0)=2 vs =1; 44 J Q K', ['who-is-short','partner-2','lead'],
     case(2, ['4S','4D','JS','QH','KC'], [2,6,5,6], leading=True), G('pair',['4'], '搭档剩2：喂对4'),
     case(2, ['4S','4D','JS','QH','KC'], [1,6,5,6], leading=True), G('single',['4'], '搭档报单：喂最小单4'), unsure='B: single J (orphan) is a weaker feed; 4 judged better')
pair('q29', 'seat1 lead singles: enemy(0)=1 vs partner(3)=1; 5 9 K', ['who-is-short','lead'],
     case(1, ['5S','9D','KH'], [1,3,6,6], leading=True), G('single',['K'], '敌报单只能出单：从大出'),
     case(1, ['5S','9D','KH'], [6,3,6,1], leading=True), G('single',['5'], '搭档报单：喂5'))

# —— bomb preservation ——
pair('q05', 'enemy(1)=1 played single K vs pair 5; 6666 99', ['bomb-preserve','enemy-1'],
     case(0, ['6S','6H','6D','6C','9S','9D'], [6,1,6,6], prev=S('K','KC'), last=1), G('bomb',['6'], '敌报单出K：只能炸'),
     case(0, ['6S','6H','6D','6C','9S','9D'], [6,1,6,6], prev=P('pair','5',['5S','5D']), last=1), G('pair',['9'], '对9足以拿牌权，留炸'))
pair('q06', 'lead w/ bomb: enemy(3)=2 vs partner(2)=1; 5555 101010 Q', ['bomb-preserve','lead','who-is-short'],
     case(0, ['5S','5H','5D','5C','10S','10D','10C','QS'], [8,6,6,2], leading=True), G('triple',['10'], '敌报双：出三张留炸'),
     case(0, ['5S','5H','5D','5C','10S','10D','10C','QS'], [8,6,1,6], leading=True), G('single',['Q'], '搭档报单：出孤单'), unsure='A: single Q also defensible? 2-card enemy could hold a pair, single Q risks a pair-out only if they lead; triple judged safer')
pair('q31', 'lead w/ bomb: enemy(1)=2 vs partner(2)=2; KKK66 + 9999', ['bomb-preserve','lead','fullhouse','partner-2'],
     case(0, ['KS','KH','KD','6S','6D','9S','9H','9D','9C'], [9,2,6,6], leading=True), G('fullhouse',['K'], '敌报双：三带二，留炸'),
     case(0, ['KS','KH','KD','6S','6D','9S','9H','9D','9C'], [9,6,2,6], leading=True), G('pair',['6'], '搭档剩2：喂对6'))
pair('q32', 'enemy(1)=1 straight 3-7 vs 8-Q; 6-10 + JJJJ', ['bomb-preserve','straight','enemy-1'],
     case(0, ['6S','7D','8C','9H','10S','JS','JH','JD','JC'], [9,1,6,6], prev=P('straight','7',['3S','4H','5D','6C','7S']), last=1), G('straight',['6','10'], '顺子压住，留炸'),
     case(0, ['6S','7D','8C','9H','10S','JS','JH','JD','JC'], [9,1,6,6], prev=P('straight','Q',['8S','9H','10D','JC','QS']), last=1), G('bomb',['J'], '顺子压不住：炸'))
pair('q24', 'enemy(1)=1 4x10 bomb vs SF 8-Q; rocket + SF 3-7H', ['bomb-preserve','rocket','straight-flush'],
     case(0, ['BJ','BJ','RJ','RJ','3H','4H','5H','6H','7H'], [9,1,6,6], prev=P('bomb','10',['10S','10H','10D','10C']), last=1), G('straightFlush', why='同花顺压4炸，留天王炸'),
     case(0, ['BJ','BJ','RJ','RJ','3H','4H','5H','6H','7H'], [9,1,6,6], prev=P('straightFlush','Q',['8S','9S','10S','JS','QS']), last=1), G('bomb',['RJ'], '只有天王炸'))
pair('q23', 'seat1: single A by partner(3) vs enemy(2)=1; 5555 9', ['partner-protect','bomb'],
     case(1, ['5S','5H','5D','5C','9D'], [6,5,1,6], prev=S('A','AC'), last=3), G('pass', why='不炸搭档'),
     case(1, ['5S','5H','5D','5C','9D'], [6,5,1,6], prev=S('A','AC'), last=2), G('bomb',['5'], '敌报单：炸'))

# —— partner protection ——
pair('q07', 'seat1: partner(3) pair 10; next enemy(2)=2 vs prev enemy(0)=2', ['partner-protect','next-enemy-short'],
     case(1, ['QS','QH','5C','7D','9S'], [6,5,2,6], prev=P('pair','10',['10S','10D']), last=3), G('pair',['Q'], '下家报双：顶对Q'),
     case(1, ['QS','QH','5C','7D','9S'], [2,5,6,6], prev=P('pair','10',['10S','10D']), last=3), G('pass', why='报双敌已过，护搭档'))
pair('q08', 'seat2: partner(0)=1 single 8, next enemy(3)=2; A46 vs A', ['partner-protect','partner-1','go-out'],
     case(2, ['AS','4C','6D'], [1,6,3,2], prev=S('8','8C'), last=0), G('pass', why='不压报单搭档'),
     case(2, ['AS'], [1,6,1,2], prev=S('8','8C'), last=0), G('single',['A'], '能走则走'))
pair('q09', 'seat3: partner(1) straight 3-7; 5-9 + KK vs 5-9 + K4', ['partner-protect','finish-2','straight'],
     case(3, ['5S','6H','7D','8C','9S','KS','KD'], [6,4,6,7], prev=P('straight','7',['3S','4H','5D','6C','7S']), last=1), G('straight',['5','9'], '压后对K走完'),
     case(3, ['5S','6H','7D','8C','9S','KS','4D'], [6,4,6,7], prev=P('straight','7',['3S','4H','5D','6C','7S']), last=1), G('pass', why='护搭档'))
pair('q10', 'partner(2) pair 6, next enemy(1)=2; QQQQ 3 8 9 vs QQQQ 3 88', ['partner-protect','next-enemy-short','bomb-preserve'],
     case(0, ['QS','QH','QD','QC','3S','8D','9H'], [7,2,5,6], prev=P('pair','6',['6S','6D']), last=2), G('pass', why='只能拆炸压搭档：过'),
     case(0, ['QS','QH','QD','QC','3S','8D','8H'], [7,2,5,6], prev=P('pair','6',['6S','6D']), last=2), G('pair',['8'], '下家报双：对8顶'))
pair('q12', 'plate 333444 by enemy(1)=1 vs partner(2); 777888 J 4', ['partner-protect','plate'],
     case(0, ['7S','7H','7D','8S','8H','8D','JC','4C'], [8,1,6,8], prev=P('tripleSeq','4',['3S','3H','3D','4S','4H','4D']), last=1), G('tripleSeq',['7','8'], '敌报单：钢板压'),
     case(0, ['7S','7H','7D','8S','8H','8D','JC','4C'], [8,8,6,8], prev=P('tripleSeq','4',['3S','3H','3D','4S','4H','4D']), last=2), G('pass', why='护搭档'))
pair('q22', 'seat2: partner(0) straight 3-7 vs single 9; next enemy(3)=2', ['partner-protect','next-enemy-short','straight'],
     case(2, ['KS','4C','5D','6H','7S','8C','10D'], [5,6,7,2], prev=P('straight','7',['3S','4H','5D','6C','7S']), last=0), G('pass', why='下家2张接不了顺子，护搭档'),
     case(2, ['KS','4C','5D','6H','7S','8C','10D'], [5,6,7,2], prev=S('9','9C'), last=0), G('single',['K'], '下家报双可接单：顶K'))
pair('q16', 'level Q pair vs pair A by enemy(1)=1 vs partner(2)', ['partner-protect','level','pair'],
     case(0, ['QS','QD','4C','6S','8D'], [5,1,7,7], prev=P('pair','A',['AS','AH']), last=1, level='Q'), G('pair',['Q'], '敌报单：级牌对压'),
     case(0, ['QS','QD','4C','6S','8D'], [5,7,7,7], prev=P('pair','A',['AS','AH']), last=2, level='Q'), G('pass', why='护搭档'))

# —— straights/tubes control, level wild, late control ——
pair('q11', 'lead 3-7 + 99 + A: enemies long vs partner(2)=1', ['straight','lead','who-is-short'],
     case(0, ['3S','4H','5D','6C','7S','9D','9C','AS'], [8,6,6,6], leading=True), G('straight',['3','7'], '整出顺子'),
     case(0, ['3S','4H','5D','6C','7S','9D','9C','AS'], [8,6,1,6], leading=True), G('single',['3'], '搭档报单：喂最小单'), unsure='B: breaks straight to feed; A-orphan is not a feed')
pair('q13', 'seat1 lead tube 99-1010-JJ + 4: enemy(0)=2 vs partner(3)=1', ['pairSeq','lead','who-is-short'],
     case(1, ['9S','9H','10D','10C','JS','JH','4C'], [2,7,6,6], leading=True), G('pairSeq',['9','10','J'], '敌报双：连对'),
     case(1, ['9S','9H','10D','10C','JS','JH','4C'], [6,7,6,1], leading=True), G('single',['4'], '搭档报单：喂4'))
pair('q14', 'level 5 (5H wild): enemy(1)=1 vs 6 played single A; 888+5H 3 K', ['wild','bomb','enemy-count'],
     case(0, ['8S','8H','8D','5H','3C','KD'], [6,1,6,6], prev=S('A','AC'), last=1, level='5'), G('bomb',['8'], '逢人配补炸拦'),
     case(0, ['8S','8H','8D','5H','3C','KD'], [6,6,6,6], prev=S('A','AC'), last=1, level='5'), G('pass', why='敌多不炸'))
pair('q15', 'seat2 lead: 9H wild (level 9) vs 9C natural; 3 4 5 7 + 9', ['wild','straight','go-out'],
     case(2, ['3S','4D','5C','9H','7S'], [6,6,5,6], leading=True, level='9'), G('straight', why='逢人配补6成顺走完'),
     case(2, ['3S','4D','5C','9C','7S'], [6,6,5,6], leading=True, level='9'), G('single',['3'], '敌多：最小孤单'))
pair('q30', 'level 8 (8H wild) vs level 2; 8H+Q over enemy pair J', ['wild','go-out','pair'],
     case(0, ['8H','QS'], [2,6,6,6], prev=P('pair','J',['JS','JD']), last=1, level='8'), G('pair',['Q'], '逢人配成对Q走完'),
     case(0, ['8H','QS'], [2,6,6,6], prev=P('pair','J',['JS','JD']), last=1, level='2'), G('pass', why='凑不成对'))
pair('q17', 'lead AA 33: enemy(1)=1 vs partner(2)=1', ['late-control','who-is-short'],
     case(0, ['AS','AD','3C','3H'], [4,1,6,6], leading=True), G('pair',['A'], '敌报单：先对A控场'),
     case(0, ['AS','AD','3C','3H'], [4,6,1,6], leading=True), G('single',['3'], '搭档报单：拆对喂3'))
pair('q18', 'seat3 lead RJ 99: enemy(0)=1 vs partner(1)=1', ['late-control','who-is-short','joker'],
     case(3, ['RJ','9C','9D'], [1,6,6,3], leading=True), G('pair',['9'], '敌报单：先出对9，留大王'),
     case(3, ['RJ','9C','9D'], [6,1,6,3], leading=True), G('single',['9'], '搭档报单：喂9'), unsure='A: RJ-first also plausible')
pair('q26', 'seat3 two singles 6C + AS: level 6 vs level 2', ['two-singles','level'],
     case(3, ['6C','AS'], [5,6,5,2], leading=True, level='6'), G('single',['6'], '级牌6大于A，先出'),
     case(3, ['6C','AS'], [5,6,5,2], leading=True, level='2'), G('single',['A'], '先出A'))
pair('q34', 'level 10: enemy(1)=5 vs 1 played single A', ['level','enemy-count'],
     case(0, ['10S','3C','4D','6H','8S','9C','JD'], [7,5,6,6], prev=S('A','AC'), last=1, level='10'), G('pass', why='敌5张，留级牌'),
     case(0, ['10S','3C','4D','6H','8S','9C','JD'], [7,1,6,6], prev=S('A','AC'), last=1, level='10'), G('single',['10'], '敌报单：级牌压A'))

rows, unsure = [], {}
for pid, detail, tags, a, ga, b, gb, u in pairs:
    if u: unsure[pid] = u
    for suf, c, g in (('a', a, ga), ('b', b, gb)):
        rows.append({"id": f"{pid}{suf}", "pair_id": pid, "pivot": detail, "tags": ["pair", "holdout4"] + tags, **c, "gold": g, **({"gold_unsure": u} if u else {})})
out = os.path.join(os.path.dirname(__file__), '..', 'eval', 'endgames', 'holdout4-pairs.jsonl')
with open(out, 'w') as f:
    for r in rows: f.write(json.dumps(r, ensure_ascii=False) + '\n')
print(len(pairs), 'pairs', len(rows), 'cases; unsure:', list(unsure))
