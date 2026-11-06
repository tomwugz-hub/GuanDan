#!/usr/bin/env python3
"""Generate eval/endgames/pairs.jsonl: DecisionPivot-style contrast pairs (one decisive detail per pair)."""
import json, copy, os
FILL = ['3D','4C','5C','6D','7H','8C','9C','10H','JD','QC','KD','2C','3C','4D','6H']
PF = {"name": "东", "style": "partner-first", "brief": "护搭档"}
def filler(n): return FILL[:n]
def case(seat, hand, counts, leading=False, prev=None, last=None, level='2', persona=None):
    hands = {}
    for s in range(4):
        hands[str(s)] = hand if s == seat else filler(counts[s])
    c = {"levelRank": level, "seat": seat, "leading": leading, "hands": hands,
         "previous": None if leading else prev, "firstLeadOfDeal": False}
    if not leading:
        c["trickMeta"] = {"lastPlayer": last, "controlSeat": last}
    if persona: c["persona"] = persona
    return c
def P(t, r, cs): return {"type": t, "rank": r, "cards": cs}
def G(t, ranks=(), why=''):
    if t == 'pass': return {"action": "pass", "comboType": "pass", "ranks": [], "rationale": why}
    return {"action": "play", "comboType": t, "ranks": list(ranks), "rationale": why}
pairs = []
def pair(pid, detail, tags, a, ga, b, gb):
    pairs.append((pid, detail, tags, a, ga, b, gb))

# 1-4,20,28,58,59: toBeat partner vs enemy
pair('p01', 'lastPlayer partner(2) vs enemy(1)', ['partner-vs-enemy','single'],
     case(0, ['KS','3S','4H','5D','7C'], [5,5,4,5], prev=P('single','10',['10C']), last=2, persona=PF), G('pass', why='搭档单10控牌，护搭档过'),
     case(0, ['KS','3S','4H','5D','7C'], [5,5,4,5], prev=P('single','10',['10C']), last=1, persona=PF), G('single',['K'], '敌家单10，用K压'))
pair('p02', 'lastPlayer partner(2) vs enemy(1)', ['partner-vs-enemy','pair'],
     case(0, ['QS','QH','4S','6D','8C'], [5,5,4,5], prev=P('pair','7',['7C','7D']), last=2, persona=PF), G('pass', why='搭档对7，过'),
     case(0, ['QS','QH','4S','6D','8C'], [5,5,4,5], prev=P('pair','7',['7C','7D']), last=1, persona=PF), G('pair',['Q'], '敌家对7，对Q压'))
pair('p03', 'lastPlayer partner(2) vs enemy(1); enemy1 has 1 card', ['partner-vs-enemy','bomb-or-pass','enemy-last-card'],
     case(0, ['8S','8H','8D','8C','3S','3H'], [6,1,4,5], prev=P('single','A',['AC']), last=2), G('pass', why='搭档单A，绝不炸搭档'),
     case(0, ['8S','8H','8D','8C','3S','3H'], [6,1,4,5], prev=P('single','A',['AC']), last=1), G('bomb',['8'], '敌家报单出A，必须炸断'))
pair('p20', 'previous bomb by partner(2) vs enemy(1); enemy1 has 1 card', ['partner-vs-enemy','bomb-over-bomb'],
     case(0, ['10S','10H','10D','10C','3S','3H'], [6,1,4,5], prev=P('bomb','6',['6S','6H','6D','6C']), last=2), G('pass', why='搭档炸弹已控牌，过'),
     case(0, ['10S','10H','10D','10C','3S','3H'], [6,1,4,5], prev=P('bomb','6',['6S','6H','6D','6C']), last=1), G('bomb',['10'], '敌家报单炸6，用炸10反压'))
pair('p28', 'lastPlayer partner(2) vs enemy(1); enemy1 has 2 cards', ['partner-vs-enemy','joker'],
     case(0, ['RJ','3S','5H','8D'], [4,2,5,5], prev=P('single','A',['AC']), last=2, persona=PF), G('pass', why='搭档A，过'),
     case(0, ['RJ','3S','5H','8D'], [4,2,5,5], prev=P('single','A',['AC']), last=1, persona=PF), G('single',['RJ'], '敌家报双出A，大王压'))
pair('p58', 'lastPlayer partner(2) vs enemy(1)', ['partner-vs-enemy','fullhouse'],
     case(0, ['JS','JH','JD','4S','4H','3C'], [6,6,5,6], prev=P('fullhouse','9',['9S','9H','9D','5S','5H']), last=2, persona=PF), G('pass', why='搭档三带二，过'),
     case(0, ['JS','JH','JD','4S','4H','3C'], [6,6,5,6], prev=P('fullhouse','9',['9S','9H','9D','5S','5H']), last=1, persona=PF), G('fullhouse',['J'], '敌家三带二9，JJJ44压'))
pair('p59', 'lastPlayer partner(2) vs enemy(1)', ['partner-vs-enemy','straight'],
     case(0, ['6S','7H','8D','9C','10S','3H'], [6,6,5,6], prev=P('straight','8',['4S','5H','6D','7C','8S']), last=2, persona=PF), G('pass', why='搭档顺子，过'),
     case(0, ['6S','7H','8D','9C','10S','3H'], [6,6,5,6], prev=P('straight','8',['4S','5H','6D','7C','8S']), last=1, persona=PF), G('straight',['6','10'], '敌家顺子，6-10压'))
# enemy 1 vs many
pair('p04', 'enemy(1) count 1 vs 5', ['enemy-count','bomb-or-pass','small-single'],
     case(0, ['9S','9H','9D','9C','3S','3H'], [6,1,2,5], prev=P('single','6',['6C']), last=1), G('bomb',['9'], '敌报单，小单也要炸断，再出对3'),
     case(0, ['9S','9H','9D','9C','3S','3H'], [6,5,2,5], prev=P('single','6',['6C']), last=1), G('pass', why='敌牌多，勿为单6炸'))
pair('p05', 'enemy(1) count 1 vs 6', ['enemy-count','bomb-or-pass','pair'],
     case(0, ['7S','7H','7D','7C','4S','4H'], [6,1,5,5], prev=P('pair','K',['KS','KH']), last=1), G('bomb',['7'], '敌报单出对K，炸断'),
     case(0, ['7S','7H','7D','7C','4S','4H'], [6,6,5,5], prev=P('pair','K',['KS','KH']), last=1), G('pass', why='敌牌多，留炸'))
pair('p11', 'enemy(1) count 1 vs 6', ['enemy-count','bomb-or-pass','fullhouse'],
     case(0, ['7S','7H','7D','7C','3S','4H'], [6,1,5,5], prev=P('fullhouse','Q',['QS','QH','QD','5S','5C']), last=1), G('bomb',['7'], '敌报单，炸三带二'),
     case(0, ['7S','7H','7D','7C','3S','4H'], [6,6,5,5], prev=P('fullhouse','Q',['QS','QH','QD','5S','5C']), last=1), G('pass', why='敌牌多，勿炸三带二'))
pair('p46', 'enemy(2) count 1 vs 6 (seat 3 deciding)', ['enemy-count','bomb-or-pass','small-single'],
     case(3, ['KS','KH','KD','KC','3S','4H'], [5,4,1,6], prev=P('single','Q',['QC']), last=2), G('bomb',['K'], '敌报单出Q，炸断'),
     case(3, ['KS','KH','KD','KC','3S','4H'], [5,4,6,6], prev=P('single','Q',['QC']), last=2), G('pass', why='敌牌多，勿拆炸也勿炸'))
pair('p57', 'enemy(1) count 1 vs 6', ['enemy-count','bomb-or-pass','straight'],
     case(0, ['8S','8H','8D','8C','4S','4H'], [6,1,5,5], prev=P('straight','7',['3S','4D','5H','6C','7S']), last=1), G('bomb',['8'], '敌报单出顺子，炸断'),
     case(0, ['8S','8H','8D','8C','4S','4H'], [6,6,5,5], prev=P('straight','7',['3S','4D','5H','6C','7S']), last=1), G('pass', why='敌牌多，留炸'))
pair('p26', 'enemy(1) count 2 vs 8', ['enemy-count','follow-size','pair'],
     case(0, ['10S','10H','AS','AH','3C'], [5,2,6,6], prev=P('pair','8',['8S','8H']), last=1), G('pair',['A'], '敌报双，用最大对A顶'),
     case(0, ['10S','10H','AS','AH','3C'], [5,8,6,6], prev=P('pair','8',['8S','8H']), last=1), G('pair',['10'], '敌牌多，对10够用，留对A'))
pair('p27', 'enemy(1) count 1 vs 7', ['enemy-count','follow-size','single'],
     case(0, ['10S','AS','4H','5D','6C'], [5,1,6,6], prev=P('single','8',['8C']), last=1), G('single',['A'], '敌报单，单A顶'),
     case(0, ['10S','AS','4H','5D','6C'], [5,7,6,6], prev=P('single','8',['8C']), last=1), G('single',['10'], '敌牌多，10够用'))
pair('p61', 'enemy(3) count 1 vs 6', ['enemy-count','follow-size','single'],
     case(0, ['6S','AS','9D','9H'], [4,6,6,1], prev=P('single','5',['5C']), last=3), G('single',['A'], '敌报单，单A顶'),
     case(0, ['6S','AS','9D','9H'], [4,6,6,6], prev=P('single','5',['5C']), last=3), G('single',['6'], '敌牌多，6即可'))
pair('p60', 'enemy(1) count 1 vs 6', ['enemy-count','follow-size','single'],
     case(0, ['8S','KS','KH','KD'], [4,1,6,6], prev=P('single','7',['7C']), last=1), G('single',['K'], '敌报单，宁拆K顶'),
     case(0, ['8S','KS','KH','KD'], [4,6,6,6], prev=P('single','7',['7C']), last=1), G('single',['8'], '敌牌多，8即可，保三K'))
pair('p38', 'enemy(1) count 1 vs 6 (level 7 single)', ['enemy-count','level','single'],
     case(0, ['7S','3H','4D','5C','9C'], [5,1,6,6], prev=P('single','K',['KC']), last=1, level='7'), G('single',['7'], '敌报单，级牌7压K'),
     case(0, ['7S','3H','4D','5C','9C'], [5,6,6,6], prev=P('single','K',['KC']), last=1, level='7'), G('pass', why='敌牌多，留级牌'))
pair('p06', 'hold bomb (6666) vs triple+5', ['bomb-vs-not','enemy-last-card'],
     case(0, ['6S','6H','6D','6C','3S','3H'], [6,1,5,5], prev=P('single','Q',['QC']), last=1), G('bomb',['6'], '敌报单，有炸必炸'),
     case(0, ['6S','6H','6D','5C','3S','3H'], [6,1,5,5], prev=P('single','Q',['QC']), last=1), G('pass', why='无炸无大牌，只能过'))
# level card
pair('p15', 'levelRank 7 vs 2', ['level','single'],
     case(0, ['7S','3H','4D','9C','10C'], [5,2,6,6], prev=P('single','A',['AC']), last=1, level='7'), G('single',['7'], '级牌7大于A，敌报双须压'),
     case(0, ['7S','3H','4D','9C','10C'], [5,2,6,6], prev=P('single','A',['AC']), last=1, level='2'), G('pass', why='无牌大过A'))
pair('p16', 'levelRank 8 vs 2', ['level','pair'],
     case(0, ['8S','8D','3H','4D','5C'], [5,2,6,6], prev=P('pair','A',['AS','AC']), last=1, level='8'), G('pair',['8'], '对级牌8大于对A'),
     case(0, ['8S','8D','3H','4D','5C'], [5,2,6,6], prev=P('pair','A',['AS','AC']), last=1, level='2'), G('pass', why='对8小于对A'))
pair('p52', 'levelRank 2 vs 5', ['level','enemy-last-card','single'],
     case(0, ['AS','5S','3H'], [3,1,6,6], prev=P('single','K',['KC']), last=1, level='2'), G('single',['A'], 'A最大，敌报单用A'),
     case(0, ['AS','5S','3H'], [3,1,6,6], prev=P('single','K',['KC']), last=1, level='5'), G('single',['5'], '级牌5大过A，用最大张顶'))
# lead vs follow
pair('p07', 'leading vs following enemy single 8', ['lead-vs-follow'],
     case(0, ['3S','4H','KD','QS','QH'], [5,5,5,5], leading=True), G('single',['3','4'], '领出先走小单'),
     case(0, ['3S','4H','KD','QS','QH'], [5,5,5,5], prev=P('single','8',['8C']), last=1), G('single',['K'], '跟单8用K，保对Q'))
pair('p17', 'previous fullhouse 8 vs Q', ['go-out','fullhouse'],
     case(0, ['10S','10H','10D','4S','4H'], [5,6,6,6], prev=P('fullhouse','8',['8S','8H','8D','3S','3H']), last=1), G('fullhouse',['10'], '三带二压上直接走完'),
     case(0, ['10S','10H','10D','4S','4H'], [5,6,6,6], prev=P('fullhouse','Q',['QS','QH','QD','3S','3H']), last=1), G('pass', why='压不过'))
pair('p18', 'previous straight 3-7 vs 6-10', ['straight'],
     case(0, ['5S','6H','7D','8C','9S','KD'], [6,5,6,6], prev=P('straight','7',['3S','4D','5H','6C','7S']), last=1), G('straight',['5','9'], '5-9压3-7'),
     case(0, ['5S','6H','7D','8C','9S','KD'], [6,5,6,6], prev=P('straight','10',['6S','7D','8H','9C','10S']), last=1), G('pass', why='压不过6-10'))
# who is short / partner close to out
pair('p08', 'partner(2) count 1 vs 8', ['partner-short','lead'],
     case(0, ['4S','4H','5S','5H','6S','6H','JD'], [7,6,1,6], leading=True), G('single',['4'], '对家报单，出最小单送对家走'),
     case(0, ['4S','4H','5S','5H','6S','6H','JD'], [7,6,8,6], leading=True), G('pairSeq',['4','5','6'], '正常领连对'))
pair('p22', 'short seat is enemy(1) vs partner(2)', ['partner-short','enemy-count','lead'],
     case(0, ['3S','8S','8H','9D','9C'], [5,1,5,5], leading=True), G('pair',['8','9'], '敌报单，出对不出单'),
     case(0, ['3S','8S','8H','9D','9C'], [5,5,1,5], leading=True), G('single',['3'], '对家报单，出小单送'))
pair('p47', 'enemy(1) count 1 vs 6', ['enemy-count','lead'],
     case(0, ['3S','7S','7H','9D'], [4,1,6,6], leading=True), G('pair',['7'], '敌报单，出对'),
     case(0, ['3S','7S','7H','9D'], [4,6,6,6], leading=True), G('single',['3'], '先走小单'))
pair('p23', 'enemy(1) count 1 vs 6 (all singles)', ['enemy-count','lead'],
     case(0, ['3S','5H','9D','KC','AS'], [5,1,6,6], leading=True), G('single',['A'], '敌报单只能出单时从大出'),
     case(0, ['3S','5H','9D','KC','AS'], [5,6,6,6], leading=True), G('single',['3'], '先走小单'))
pair('p24', 'enemy(1) count 2 vs 6 (all pairs)', ['enemy-count','lead'],
     case(0, ['4S','4H','7D','7C','9S','9H'], [6,2,6,6], leading=True), G('single', why='敌报双，拆单不出对'),
     case(0, ['4S','4H','7D','7C','9S','9H'], [6,6,6,6], leading=True), G('pair',['4'], '先走小对'))
pair('p10', 'enemy(1) count 1 vs 6', ['enemy-count','lead','triple'],
     case(0, ['AS','AH','AD','3S','4H'], [5,1,4,6], leading=True), G('triple',['A'], '敌报单，三A控场'),
     case(0, ['AS','AH','AD','3S','4H'], [5,6,4,6], leading=True), G('single',['3','4'], '敌牌多，先走小单'))

rows = []
for pid, detail, tags, a, ga, b, gb in pairs:
    for suffix, c, g in (('a', a, ga), ('b', b, gb)):
        r = {"id": f"{pid}{suffix}", "pair_id": pid, "pivot": detail, "tags": ["pair"] + tags, **c, "gold": g}
        rows.append(r)
out = os.path.join(os.path.dirname(__file__), '..', 'eval', 'endgames', 'pairs.jsonl')
with open(out, 'w') as f:
    for r in rows: f.write(json.dumps(r, ensure_ascii=False) + '\n')
print(len(pairs), 'pairs', len(rows), 'cases ->', os.path.normpath(out))
