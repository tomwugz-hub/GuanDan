#!/usr/bin/env python3
"""Second blind holdout -> eval/endgames/holdout2-pairs.jsonl (written before running any system)."""
import json, os
src = open(os.path.join(os.path.dirname(__file__), 'gen-pairs.py')).read().split('# 1-4,20,28,58,59')[0]
ns = {}; exec(src, ns)
case, P, G, PF = ns['case'], ns['P'], ns['G'], ns['PF']
pairs = []
def pair(pid, detail, tags, a, ga, b, gb, unsure=None): pairs.append((pid, detail, tags, a, ga, b, gb, unsure))

pair('k01', 'partner(0) count 2 vs 9; seat2 leads', ['partner-2','lead'],
     case(2, ['3D','3C','7S','JH','QD','KC'], [2,6,6,6], leading=True), G('pair',['3'], '对家剩2：出小对送'),
     case(2, ['3D','3C','7S','JH','QD','KC'], [9,6,6,6], leading=True), G('single',['7'], '敌多：先出小孤单7'))
pair('k02', 'two-card seat is partner(1) vs enemy(0); seat3 leads', ['partner-2','enemy-2','lead'],
     case(3, ['6C','6D','9H','10S','10D','KS'], [6,2,6,6], leading=True), G('pair',['6'], '对家剩2：出小对'),
     case(3, ['6C','6D','9H','10S','10D','KS'], [2,6,6,6], leading=True), G('single', why='敌报双：出单不出对'), unsure='B conflicts in spirit with eg015 (pair lead vs 2-card enemy)')
pair('k03', 'levelRank 2 vs 4 with [J,4] two singles', ['two-singles','level'],
     case(1, ['JS','4C'], [3,2,3,3], leading=True, level='2'), G('single',['J'], '两张单先出大J'),
     case(1, ['JS','4C'], [3,2,3,3], leading=True, level='4'), G('single',['4'], '4为级牌更大，先出4'))
pair('k04', 'partner(2) count 1 vs 4 with [A,5]', ['two-singles','partner-short'],
     case(0, ['AS','5D'], [2,4,1,4], leading=True), G('single',['5'], '对家报单：出小单送'),
     case(0, ['AS','5D'], [2,4,4,4], leading=True), G('single',['A'], '先出大A拿牌权'))
pair('k05', 'enemy(1) count 1 vs 5; wild pair to stop pair 8', ['wild','enemy-count','pair'],
     case(0, ['10H','4S','4D','9C','JC'], [5,1,6,6], prev=P('pair','8',['8S','8D']), last=1, level='10'), G('pair',['J','9'], '敌报单：逢人配凑对压'),
     case(0, ['10H','4S','4D','9C','JC'], [5,5,6,6], prev=P('pair','8',['8S','8D']), last=1, level='10'), G('pass', why='敌牌多：不为对8浪费逢人配'))
pair('k06', 'level card suit H (wild) vs S (not wild); enemy last card', ['wild','bomb','new-pivot'],
     case(0, ['3H','10S','10D','10C','5S','7D'], [6,1,6,6], prev=P('fullhouse','J',['JS','JH','JD','4S','4H']), last=1, level='3'), G('bomb',['10'], '红桃3补成10炸打断'),
     case(0, ['3S','10S','10D','10C','5S','7D'], [6,1,6,6], prev=P('fullhouse','J',['JS','JH','JD','4S','4H']), last=1, level='3'), G('pass', why='黑桃3非逢人配，无炸'))
pair('k07', 'enemy(3) count 2 vs 6; 888+Q+4 lead', ['enemy-2','lead','triple'],
     case(0, ['8S','8H','8D','QC','4S'], [5,6,6,2], leading=True), G('triple',['8'], '敌报双：出三张'),
     case(0, ['8S','8H','8D','QC','4S'], [5,6,6,6], leading=True), G('single',['4'], '敌多：先出小单4'))
pair('k09', 'enemy(0) count 6 vs 2; FH hand vs pair 5 (seat3)', ['keep-finish','enemy-2'],
     case(3, ['JS','JH','JD','6C','6S'], [6,6,6,5], prev=P('pair','5',['5S','5D']), last=0), G('pass', why='三带二一手可走，勿拆'),
     case(3, ['JS','JH','JD','6C','6S'], [2,6,6,5], prev=P('pair','5',['5S','5D']), last=0), G('pair',['J'], '敌报双：对J拦'), unsure='A: pair J keeps 666? no — pass judged mainstream; B pair 6 also stops')
pair('k10', 'previous single 3 vs 5 (2-play hand QQQ77+4)', ['keep-finish','progress'],
     case(0, ['QS','QH','QD','7C','7D','4H'], [6,6,6,6], prev=P('single','3',['3C']), last=1), G('single',['4'], '出4不拆，剩三带二'),
     case(0, ['QS','QH','QD','7C','7D','4H'], [6,6,6,6], prev=P('single','5',['5C']), last=1), G('pass', why='只能拆牌跟，过'))
pair('k12', 'previous bomb 4 vs 5 sevens; enemy last card', ['bomb-size','enemy-count'],
     case(0, ['JS','JH','JD','JC','3S','3H'], [6,1,6,6], prev=P('bomb','7',['7S','7H','7D','7C']), last=1), G('bomb',['J'], 'J炸压7炸'),
     case(0, ['JS','JH','JD','JC','3S','3H'], [6,1,6,6], prev=P('bomb','7',['7S','7H','7D','7C','7S']), last=1), G('pass', why='4炸压不过5炸'))
pair('k13', 'straight flush by enemy(1, 1 card) vs partner(2); rocket', ['rocket','partner-vs-enemy'],
     case(0, ['BJ','BJ','RJ','RJ','5C'], [5,1,5,6], prev=P('straightFlush','9',['5D','6D','7D','8D','9D']), last=1), G('bomb',['RJ'], '天王炸压同花顺'),
     case(0, ['BJ','BJ','RJ','RJ','5C'], [5,1,5,6], prev=P('straightFlush','9',['5D','6D','7D','8D','9D']), last=2), G('pass', why='搭档同花顺，过'))
pair('k14', 'enemy(1) count 2 vs partner(2) count 1; plate hand', ['plate','enemy-2','partner-short'],
     case(0, ['5S','5H','5D','6S','6H','6D','KC'], [7,2,6,6], leading=True), G('tripleSeq',['5','6'], '敌报双：出钢板'),
     case(0, ['5S','5H','5D','6S','6H','6D','KC'], [7,6,1,6], leading=True), G('single',['5'], '对家报单：出最小单'), unsure='B: K (orphan) vs 5 (breaking plate); 5 judged better feed')
pair('k16', 'enemy(1) count 2 vs 5; follow pair 10', ['follow-size','enemy-2'],
     case(0, ['JS','JH','AC','AD','6S'], [5,2,6,6], prev=P('pair','10',['10S','10D']), last=1), G('pair',['A'], '敌报双：对A顶'),
     case(0, ['JS','JH','AC','AD','6S'], [5,5,6,6], prev=P('pair','10',['10S','10D']), last=1), G('pair',['J'], '敌多：对J够'))
pair('k17', 'next enemy(1) count 1 vs 6 after partner(2) single Q', ['block-after-partner','new-pivot'],
     case(0, ['AS','4D','7C'], [3,1,5,6], prev=P('single','Q',['QC']), last=2), G('single',['A'], '下家报单：顶A'),
     case(0, ['AS','4D','7C'], [3,6,5,6], prev=P('single','Q',['QC']), last=2), G('pass', why='搭档Q，过'))
pair('k21', 'one-card seat is enemy(3) vs partner(2) with [K,6]', ['two-singles','partner-short'],
     case(0, ['KS','6D'], [2,5,5,1], leading=True), G('single',['K'], '敌报单：先出大'),
     case(0, ['KS','6D'], [2,5,1,5], leading=True), G('single',['6'], '对家报单：出小送'))
pair('k22', 'enemy(1) count 1 vs 7; wild level single vs K', ['wild','enemy-count','single'],
     case(0, ['5H','3C','8D','9S'], [4,1,6,6], prev=P('single','K',['KC']), last=1, level='5'), G('single',['5'], '敌报单：级牌5压'),
     case(0, ['5H','3C','8D','9S'], [4,7,6,6], prev=P('single','K',['KC']), last=1, level='5'), G('pass', why='敌多：留逢人配'))
pair('k23', 'enemy(1) count 2 vs 6; FH lead KKK66+3+8', ['fullhouse','enemy-2','lead'],
     case(0, ['KS','KH','KD','6C','6D','3S','8H'], [7,2,6,6], leading=True), G('fullhouse',['K'], '敌报双：出三带二'),
     case(0, ['KS','KH','KD','6C','6D','3S','8H'], [7,6,6,6], leading=True), G('single',['3'], '敌多：先出小单'))
pair('k27', 'single 10 by partner(2, 1 card left) vs enemy(1)', ['partner-vs-enemy','partner-short'],
     case(0, ['JS','5C','6D'], [3,5,1,5], prev=P('single','10',['10C']), last=2), G('pass', why='搭档报单出10，过'),
     case(0, ['JS','5C','6D'], [3,5,1,5], prev=P('single','10',['10C']), last=1), G('single',['J'], '敌家10，J压'))
pair('k30', 'enemy(1) count 1 vs 6; tube by enemy, bomb in hand', ['bomb-or-pass','tube'],
     case(0, ['9S','9H','9D','9C','KC','KD'], [6,1,6,6], prev=P('pairSeq','5',['3S','3H','4S','4H','5S','5H']), last=1), G('bomb',['9'], '敌报单：炸'),
     case(0, ['9S','9H','9D','9C','KC','KD'], [6,6,6,6], prev=P('pairSeq','5',['3S','3H','4S','4H','5S','5H']), last=1), G('pass', why='敌多：留炸'))
pair('k34', 'enemy(3) count 6 vs 1; lead with 55 9 QQ K', ['lead','enemy-count'],
     case(0, ['5S','5H','9D','QC','QH','KS'], [6,6,6,6], leading=True), G('single',['9'], '敌多：先出孤单9'),
     case(0, ['5S','5H','9D','QC','QH','KS'], [6,6,6,1], leading=True), G('pair',['5','Q'], '敌报单：出对'))
pair('k37', 'levelRank 2 vs 9 with [A,2] two singles (seat3)', ['two-singles','level'],
     case(3, ['AS','2D'], [3,3,3,2], leading=True, level='2'), G('single',['2'], '2为级牌最大，先出'),
     case(3, ['AS','2D'], [3,3,3,2], leading=True, level='9'), G('single',['A'], 'A最大，先出'))
pair('k42', 'hand size 1 vs 2 when partner(2) played single 8', ['go-out','partner-vs-enemy'],
     case(0, ['QS'], [1,5,5,5], prev=P('single','8',['8C']), last=2, persona=PF), G('single',['Q'], '能走则走'),
     case(0, ['QS','4D'], [2,5,5,5], prev=P('single','8',['8C']), last=2, persona=PF), G('pass', why='搭档单8，过'))
pair('k43', 'previous FH 10 vs triple 10 (KKK99 hand)', ['keep-finish','fullhouse'],
     case(0, ['KS','KH','KD','9C','9D'], [5,6,6,6], prev=P('fullhouse','10',['10S','10H','10D','3S','3H']), last=1), G('fullhouse',['K'], '三带二压上走完'),
     case(0, ['KS','KH','KD','9C','9D'], [5,6,6,6], prev=P('triple','10',['10S','10H','10D']), last=1), G('pass', why='勿拆三带二'))
pair('k44', 'levelRank 6 (6H wild) vs 2; tube go-out', ['wild','tube','go-out'],
     case(0, ['6H','7S','7D','8S','8D','9S'], [6,6,6,6], leading=True, level='6'), G('pairSeq',['7','8','9'], '逢人配成778899走完'),
     case(0, ['6H','7S','7D','8S','8D','9S'], [6,6,6,6], leading=True, level='2'), G('single',['6'], '先出小单6'))
pair('k46', 'two-card seat is partner(2) vs enemy(1); all-pairs QQKK', ['partner-2','enemy-2'],
     case(0, ['QS','QH','KS','KH'], [4,6,2,6], leading=True), G('pair',['Q'], '对家剩2：出对Q'),
     case(0, ['QS','QH','KS','KH'], [4,2,6,6], leading=True), G('single', why='敌报双：拆对出单'))
pair('k47', 'enemy(1) count 2 vs 7; follow single K with BJ/A', ['follow-size','enemy-2','joker'],
     case(0, ['BJ','AS','5C','6D'], [4,2,6,6], prev=P('single','K',['KC']), last=1), G('single',['BJ'], '敌报双：小王顶'),
     case(0, ['BJ','AS','5C','6D'], [4,7,6,6], prev=P('single','K',['KC']), last=1), G('single',['A'], '敌多：A够，留王'))
pair('k48', 'enemy(1) count 1 vs 6; tube hand vs pair 9', ['keep-finish','enemy-count','tube'],
     case(0, ['10S','10H','JS','JH','QS','QH','4D'], [7,1,6,6], prev=P('pair','9',['9S','9D']), last=1), G('pair',['Q'], '敌报单：拆连对拦'),
     case(0, ['10S','10H','JS','JH','QS','QH','4D'], [7,6,6,6], prev=P('pair','9',['9S','9D']), last=1), G('pass', why='敌多：保连对'))
pair('k54', 'one-card enemy is next(1) vs already-passed(3), after partner Q', ['block-after-partner','new-pivot'],
     case(0, ['AS','4D','7C'], [3,1,5,6], prev=P('single','Q',['QC']), last=2), G('single',['A'], '下家报单：顶A'),
     case(0, ['AS','4D','7C'], [3,6,5,1], prev=P('single','Q',['QC']), last=2), G('pass', why='报单敌已过，让搭档Q拿'))
pair('k56', 'enemy(1) count 2 vs 6; AAA55 vs single Q', ['keep-finish','enemy-2'],
     case(0, ['AS','AH','AD','5C','5D'], [5,2,6,6], prev=P('single','Q',['QC']), last=1), G('single',['A'], '敌报双：拆A拦'),
     case(0, ['AS','AH','AD','5C','5D'], [5,6,6,6], prev=P('single','Q',['QC']), last=1), G('pass', why='勿拆三带二'))

rows, unsure = [], {}
for pid, detail, tags, a, ga, b, gb, u in pairs:
    if u: unsure[pid] = u
    for suf, c, g in (('a', a, ga), ('b', b, gb)):
        rows.append({"id": f"{pid}{suf}", "pair_id": pid, "pivot": detail, "tags": ["pair", "holdout2"] + tags, **c, "gold": g, **({"gold_unsure": u} if u else {})})
out = os.path.join(os.path.dirname(__file__), '..', 'eval', 'endgames', 'holdout2-pairs.jsonl')
with open(out, 'w') as f:
    for r in rows: f.write(json.dumps(r, ensure_ascii=False) + '\n')
print(len(pairs), 'pairs', len(rows), 'cases; unsure:', list(unsure))
