#!/usr/bin/env python3
"""Blind holdout contrast pairs -> eval/endgames/holdout-pairs.jsonl (written before looking at any system output)."""
import json, os, importlib.util
spec = importlib.util.spec_from_file_location('gp', os.path.join(os.path.dirname(__file__), 'gen-pairs.py'))
src = open(spec.origin).read().split('# 1-4,20,28,58,59')[0]   # reuse helpers only
ns = {}; exec(src, ns)
case, P, G, PF = ns['case'], ns['P'], ns['G'], ns['PF']
pairs = []
def pair(pid, detail, tags, a, ga, b, gb, unsure=None):
    pairs.append((pid, detail, tags, a, ga, b, gb, unsure))

pair('h01', 'short seat (2 cards) is partner(3) vs enemy(0); seat1 leads', ['partner-2','lead','new-pivot'],
     case(1, ['5S','5H','8D','JC','QS','QH'], [6,6,7,2], leading=True), G('pair',['5'], '对家报双：出小对送'),
     case(1, ['5S','5H','8D','JC','QS','QH'], [2,6,7,6], leading=True), G('single', why='敌报双：出单不出对'))
pair('h03', 'enemy(3) count 1 vs 5; high straight; seat2', ['straight','bomb-or-pass','enemy-count'],
     case(2, ['JS','JH','JD','JC','4S','4D'], [6,6,6,1], prev=P('straight','K',['9S','10H','JD','QC','KS']), last=3), G('bomb',['J'], '敌报单，炸顺子'),
     case(2, ['JS','JH','JD','JC','4S','4D'], [6,6,6,5], prev=P('straight','K',['9S','10H','JD','QC','KS']), last=3), G('pass', why='敌牌多，留炸'))
pair('h04', 'plate by partner(2) vs enemy(1)', ['plate','partner-vs-enemy','new-pivot'],
     case(0, ['6S','6H','6D','7S','7H','7D','9C','KD'], [8,4,5,6], prev=P('tripleSeq','4',['3S','3H','3D','4S','4H','4D']), last=2, persona=PF), G('pass', why='搭档钢板，过'),
     case(0, ['6S','6H','6D','7S','7H','7D','9C','KD'], [8,4,5,6], prev=P('tripleSeq','4',['3S','3H','3D','4S','4H','4D']), last=1, persona=PF), G('tripleSeq',['6','7'], '敌家钢板，666777压'))
pair('h05', 'one-card seat is partner(1) vs enemy(0); seat3 leads with tube', ['tube','partner-short','lead'],
     case(3, ['8S','8H','9S','9H','10S','10H','3C'], [6,1,6,7], leading=True), G('single',['3'], '对家报单：出最小单送'),
     case(3, ['8S','8H','9S','9H','10S','10H','3C'], [1,6,6,7], leading=True), G('pairSeq',['8','9','10'], '敌报单：出连对不出单'))
pair('h06', 'Q-bomb by partner(2) vs enemy(1, 1 card); joker bomb', ['joker-bomb','partner-vs-enemy','new-pivot'],
     case(0, ['BJ','BJ','RJ','RJ','4S','6D'], [6,1,5,6], prev=P('bomb','Q',['QS','QH','QD','QC']), last=2), G('pass', why='搭档炸弹控牌，过'),
     case(0, ['BJ','BJ','RJ','RJ','4S','6D'], [6,1,5,6], prev=P('bomb','Q',['QS','QH','QD','QC']), last=1), G('bomb',['RJ'], '敌报单炸Q，天王炸反压'))
pair('h08', 'pair A by partner(2) vs enemy(3, 2 cards); red-joker pair', ['joker','partner-vs-enemy','pair'],
     case(0, ['RJ','RJ','4C','7D','9S'], [5,6,4,2], prev=P('pair','A',['AS','AC']), last=2, persona=PF), G('pass', why='搭档对A，过'),
     case(0, ['RJ','RJ','4C','7D','9S'], [5,6,4,2], prev=P('pair','A',['AS','AC']), last=3, persona=PF), G('pair',['RJ'], '敌报双出对A，对大王压'))
pair('h09', 'enemy(1) count 2 vs 8; wild level heart makes pair K', ['wild','enemy-count','new-pivot'],
     case(0, ['9H','6S','6D','KC','3S'], [5,2,6,6], prev=P('pair','Q',['QS','QD']), last=1, level='9'), G('pair',['K'], '敌报双：红桃9配K成对K压'),
     case(0, ['9H','6S','6D','KC','3S'], [5,8,6,6], prev=P('pair','Q',['QS','QD']), last=1, level='9'), G('pass', why='敌牌多，不为对Q浪费逢人配'), unsure='B: some players would still play K+wild; pass is the conservative textbook line')
pair('h10', 'levelRank 5 (5H wild) vs 2; enemy 1 card', ['wild','level','bomb'],
     case(0, ['5H','8S','8H','8D','3C','4C'], [6,1,6,6], prev=P('single','A',['AC']), last=1, level='5'), G('bomb',['8'], '逢人配补成8炸，打断报单'),
     case(0, ['5H','8S','8H','8D','3C','4C'], [6,1,6,6], prev=P('single','A',['AC']), last=1, level='2'), G('pass', why='无炸无大牌'))
pair('h11', 'leading vs following enemy single 9 (FH hand)', ['fullhouse','lead-vs-follow','go-out'],
     case(2, ['7S','7H','7D','10S','10H'], [6,6,5,6], leading=True), G('fullhouse',['7'], '三带二一手走完'),
     case(2, ['7S','7H','7D','10S','10H'], [6,6,5,6], prev=P('single','9',['9C']), last=1), G('pass', why='勿拆三带二，等领出一手走'))
pair('h15', 'one-card seat is enemy(1) vs partner(2); straight hand', ['straight','partner-short','lead'],
     case(0, ['9S','10H','JD','QC','KS','3D'], [6,1,6,6], leading=True), G('straight',['9','K'], '敌报单：出顺子'),
     case(0, ['9S','10H','JD','QC','KS','3D'], [6,6,1,6], leading=True), G('single',['3'], '对家报单：出3送'))
pair('h16', 'straight by partner(2) vs enemy(3), enemy 5 cards', ['straight','partner-vs-enemy'],
     case(0, ['4S','5H','6D','7C','8S','AS','AH'], [7,5,6,5], prev=P('straight','7',['3S','4D','5C','6H','7S']), last=2, persona=PF), G('pass', why='搭档顺子，过'),
     case(0, ['4S','5H','6D','7C','8S','AS','AH'], [7,5,6,5], prev=P('straight','7',['3S','4D','5C','6H','7S']), last=3, persona=PF), G('straight',['4','8'], '敌家顺子，4-8压'))
pair('h20', 'two singles vs a pair (2-card endgame control)', ['control','lead','go-out'],
     case(1, ['AS','3D'], [3,2,3,3], leading=True), G('single',['A'], '先出A拿回牌权再走3'),
     case(1, ['AS','AH'], [3,2,3,3], leading=True), G('pair',['A'], '对A一手走完'))
pair('h21', 'levelRank 7 (7H wild) vs 2', ['level','control','lead'],
     case(3, ['QS','7H'], [3,3,4,2], leading=True, level='7'), G('pair',['Q'], '7H为逢人配，配Q成对一手走完'),
     case(3, ['QS','7H'], [3,3,4,2], leading=True, level='2'), G('single',['Q'], 'Q较大，先出Q'))
pair('h30', 'single level-9 by partner(2) vs enemy(1, 2 cards)', ['joker','partner-vs-enemy','level'],
     case(0, ['BJ','4S','5D','8C'], [4,2,5,5], prev=P('single','9',['9S']), last=2, level='9', persona=PF), G('pass', why='搭档出级牌，过'),
     case(0, ['BJ','4S','5D','8C'], [4,2,5,5], prev=P('single','9',['9S']), last=1, level='9', persona=PF), G('single',['BJ'], '敌报双出级牌，小王压'))
pair('h31', 'previous bomb size 4 vs 6 (straight flush)', ['straight-flush','bomb-size','new-pivot'],
     case(0, ['5H','6H','7H','8H','9H','KC'], [6,1,6,6], prev=P('bomb','K',['KS','KH','KD','KC']), last=1), G('straightFlush',['9','5'], '同花顺大于4炸，压报单敌'),
     case(0, ['5H','6H','7H','8H','9H','KC'], [6,1,6,6], prev=P('bomb','K',['KS','KH','KD','KC','KS','KH']), last=1), G('pass', why='同花顺小于6炸'))
pair('h32', 'levelRank 6 (6H wild) vs 2; FH lead', ['wild','fullhouse','lead','go-out'],
     case(0, ['6H','JS','JH','8S','8D'], [5,6,5,6], leading=True, level='6'), G('fullhouse',['J'], '逢人配成JJJ88一手走'),
     case(0, ['6H','JS','JH','8S','8D'], [5,6,5,6], leading=True, level='2'), G('single',['6'], '先走孤单6'), unsure='B: leading pair 8 is also defensible')
pair('h33', 'tube by partner(2) vs enemy(1)', ['tube','partner-vs-enemy'],
     case(0, ['7S','7H','8S','8H','9S','9H','2C'], [7,3,4,6], prev=P('pairSeq','6',['4S','4H','5S','5H','6S','6H']), last=2, persona=PF), G('pass', why='搭档连对，过'),
     case(0, ['7S','7H','8S','8H','9S','9H','2C'], [7,3,4,6], prev=P('pairSeq','6',['4S','4H','5S','5H','6S','6H']), last=1, persona=PF), G('pairSeq',['7','8','9'], '敌家连对，778899压'))
pair('h44', 'enemy(3) count 1 vs 7; wild completes Q bomb vs FH', ['wild','bomb-or-pass','fullhouse'],
     case(0, ['4H','QS','QD','QC','7S','8D'], [6,6,5,1], prev=P('fullhouse','K',['KS','KH','KD','3S','3H']), last=3, level='4'), G('bomb',['Q'], '敌报单：逢人配补Q炸'),
     case(0, ['4H','QS','QD','QC','7S','8D'], [6,6,5,7], prev=P('fullhouse','K',['KS','KH','KD','3S','3H']), last=3, level='4'), G('pass', why='敌牌多，留炸'))
pair('h52', 'leading vs following enemy pair 9 (tube hand)', ['tube','lead-vs-follow','go-out'],
     case(0, ['10S','10H','JS','JH','QS','QH'], [6,5,6,6], leading=True), G('pairSeq',['10','J','Q'], '连对一手走完'),
     case(0, ['10S','10H','JS','JH','QS','QH'], [6,5,6,6], prev=P('pair','9',['9S','9D']), last=1), G('pass', why='勿拆连对，等领出走完'), unsure='B: overtaking with pair Q leaves 10-10-J-J (not a tube); pass judged better but not forced')
pair('h56', 'two-card seat is enemy(1) vs one-card partner(2); FH available', ['fullhouse','lead','partner-short'],
     case(0, ['9S','9H','9D','5C','5D','KS','2D'], [7,2,6,6], leading=True), G('fullhouse',['9'], '敌报双：出三带二'),
     case(0, ['9S','9H','9D','5C','5D','KS','2D'], [7,6,1,6], leading=True), G('single', why='对家报单：出单送'))
pair('h57', 'enemy(0) count 5 vs 2; seat3 follows single 9', ['follow-size','enemy-count'],
     case(3, ['10D','AH','6S','6C'], [5,6,6,4], prev=P('single','9',['9C']), last=0), G('single',['10'], '敌牌多，10够用'),
     case(3, ['10D','AH','6S','6C'], [2,6,6,4], prev=P('single','9',['9C']), last=0), G('single',['A'], '敌报双，A顶'))
pair('h58', 'enemy(1) count 4 vs 1; seat2 follows pair 6', ['follow-size','enemy-count','pair'],
     case(2, ['8S','8D','KS','KH','4C'], [5,4,5,6], prev=P('pair','6',['6S','6D']), last=1), G('pair',['8'], '敌4张，对8够'),
     case(2, ['8S','8D','KS','KH','4C'], [5,1,5,6], prev=P('pair','6',['6S','6D']), last=1), G('pair',['K'], '敌报单，对K顶'))
pair('h69', 'levelRank 7 (7H wild) vs 2; straight go-out', ['wild','straight','go-out'],
     case(0, ['7H','9S','10D','JC','QS'], [5,6,6,6], leading=True, level='7'), G('straight', why='逢人配成顺子一手走'),
     case(0, ['7H','9S','10D','JC','QS'], [5,6,6,6], leading=True, level='2'), G('single',['7'], '先走小单7'))
pair('h70', 'levelRank K (KH wild) vs 2; 2-card hand', ['wild','go-out','lead'],
     case(2, ['KH','5S'], [4,3,2,3], leading=True, level='K'), G('pair',['5'], '红桃K配5成对一手走'),
     case(2, ['KH','5S'], [4,3,2,3], leading=True, level='2'), G('single',['K'], '先出K拿牌权'))
pair('h73', 'enemy(1) count 2 vs 6; tube hand vs pair J', ['tube','enemy-count','pair'],
     case(0, ['QS','QH','KS','KH','AS','AH','3C'], [7,2,6,6], prev=P('pair','J',['JS','JD']), last=1), G('pair',['A'], '敌报双，对A顶'),
     case(0, ['QS','QH','KS','KH','AS','AH','3C'], [7,6,6,6], prev=P('pair','J',['JS','JD']), last=1), G('pass', why='敌牌多，不拆连对'), unsure='B: pair Q/K overtakes are playable; pass preferred to keep QQKKAA')
pair('h75', 'enemy(1) count 1 vs 6; straight flush vs single A', ['straight-flush','enemy-count'],
     case(0, ['3S','4S','5S','6S','7S','KD'], [6,1,6,6], prev=P('single','A',['AC']), last=1), G('straightFlush', why='敌报单，同花顺打断'),
     case(0, ['3S','4S','5S','6S','7S','KD'], [6,6,6,6], prev=P('single','A',['AC']), last=1), G('pass', why='敌牌多，勿用同花顺压单A'))
pair('h83', 'single 9 by partner(1) vs enemy(2); seat3', ['partner-vs-enemy','single'],
     case(3, ['QD','4S','7C','7H'], [5,5,5,4], prev=P('single','9',['9D']), last=1, persona=PF), G('pass', why='搭档单9，过'),
     case(3, ['QD','4S','7C','7H'], [5,5,5,4], prev=P('single','9',['9D']), last=2, persona=PF), G('single',['Q'], '敌家单9，Q压'))
pair('h84', 'enemy(2) count 1 vs 6; seat1 vs pair 10', ['bomb-or-pass','enemy-count','pair'],
     case(1, ['3S','3H','3D','3C','8S','8D'], [6,6,1,6], prev=P('pair','10',['10S','10D']), last=2), G('bomb',['3'], '敌报单，3炸打断'),
     case(1, ['3S','3H','3D','3C','8S','8D'], [6,6,6,6], prev=P('pair','10',['10S','10D']), last=2), G('pass', why='敌牌多，留炸'))
pair('h85', 'one-card seat is partner(0) vs enemy(1); seat2 leads', ['partner-short','lead'],
     case(2, ['6S','6H','9C','QD'], [1,5,4,5], leading=True), G('single',['9'], '对家报单：出最小单'),
     case(2, ['6S','6H','9C','QD'], [5,1,4,5], leading=True), G('pair',['6'], '敌报单：出对'))
pair('h86', 'enemy(0) count 2 vs 6; seat1 follows single 7', ['follow-size','enemy-count'],
     case(1, ['8C','AS','5D','5H'], [2,4,5,5], prev=P('single','7',['7C']), last=0), G('single',['A'], '敌报双，A顶'),
     case(1, ['8C','AS','5D','5H'], [6,4,5,5], prev=P('single','7',['7C']), last=0), G('single',['8'], '敌牌多，8够'))
pair('h87', 'partner(2) count 2 vs 7, my lead with pair+singles', ['partner-2','lead','new-pivot'],
     case(0, ['4D','4C','10S','KH'], [4,6,2,6], leading=True), G('pair',['4'], '对家报双：出小对'),
     case(0, ['4D','4C','10S','KH'], [4,6,7,6], leading=True), G('single',['10'], '先走孤单10'), unsure='both halves judgement calls; B could also be pair 4')

rows = []
unsure = {}
for pid, detail, tags, a, ga, b, gb, u in pairs:
    if u: unsure[pid] = u
    for suf, c, g in (('a', a, ga), ('b', b, gb)):
        extra = {"gold_revised": "post-run fix: original gold single 7 ignored that 7H is wild (Q+7H = pair Q goes out)"} if f"{pid}{suf}" == 'h21a' else {}
        rows.append({**extra, "id": f"{pid}{suf}", "pair_id": pid, "pivot": detail, "tags": ["pair", "holdout"] + tags, **c, "gold": g, **({"gold_unsure": u} if u else {})})
out = os.path.join(os.path.dirname(__file__), '..', 'eval', 'endgames', 'holdout-pairs.jsonl')
with open(out, 'w') as f:
    for r in rows: f.write(json.dumps(r, ensure_ascii=False) + '\n')
print(len(pairs), 'pairs', len(rows), 'cases; unsure:', list(unsure))
