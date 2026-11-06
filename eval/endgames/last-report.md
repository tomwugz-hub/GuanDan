# Endgame eval report

- generated: 2026-10-17T05:10:12.298Z
- cases: 50
- jev: off (key len=107 sha12=5416e5353e65 via env.NEW)
- decide vs gold: **50/50** (100.0%)

| id | gold | decide | jev | decide_ok | jev_ok | notes |
|----|------|--------|-----|-----------|--------|-------|
| eg001 | single:8 | single:8{8} | - | true | - | 四炸可压但不该砸搭档；lastPlayer=敌家（非搭档），测勿炸中单 |
| eg002 | pass | pass | - | true | - | 主流护搭档：搭档对6控牌，下家敌短但拆四炸压搭档不值得，过牌 |
| eg003 | single:A/K/Q | single:A{A} | - | true | - | decide 可能硬过滤同花顺压8；炸弹也可能被禁 |
| eg004 | single:J/8/6/5 | single:J{J} | - | true | - | 可用散牌/拆出跟，勿四炸压中单 |
| eg005 | single:A | single:A{A} | - | true | - | 剩一张直接走 |
| eg006 | pair:5 | pair:5{55} | - | true | - | 剩一对走出 |
| eg007 | pair:K | pair:K{KK} | - | true | - | 能压则走完 |
| eg008 | single:A | single:A{A} | - | true | - | 可跟A；若只想测过牌见 eg009 |
| eg009 | pass | pass | - | true | - | 压不过，过牌让搭档A接 |
| eg010 | triple:A | triple:A{AAA} | - | true | - | decide 对短敌可能避免拆三；故意可分歧 |
| eg011 | single:BJ/RJ | single:RJ{RJ} | - | true | - | 敌短牌，用王盖死（大王/小王皆可） |
| eg012 | single:3 | single:3{3} | - | true | - | 领出先甩小单，留四炸 |
| eg013 | fullhouse:J | fullhouse:J{JJJ55} | - | true | - | 硬过滤禁四J炸三带二；合法跟三带二OK |
| eg014 | single:9/10/J/Q/K/A | single:Q{Q} | - | true | - | 用散牌跟8，忌同花顺 |
| eg015 | single:9 | single:9{9} | - | true | - | 敌家报双出单不出对：先出最小孤单9 |
| eg016 | bomb:5 | bomb:5{5555} | - | true | - | 敌出最后一张A，必须炸打断走完 |
| eg017 | pair:K | pair:K{KK} | - | true | - | 对K压对8夺控 |
| eg018 | tripleSeq:7/8 | tripleSeq:8{777888} | - | true | - | 钢板7-8完整打出 |
| eg019 | pass | pass | - | true | - | 大王无法再压，过牌 |
| eg020 | bomb:9 | bomb:9{9999} | - | true | - | 只剩炸弹，领出炸走 |
| eg021 | pairSeq:5/6/7 | pairSeq:7{556677} | - | true | - | 连对完整打出不拆 |
| eg022 | single:A | single:A{A} | - | true | - | 用A跟K，无需炸 |
| eg023 | single:A/K/Q | single:A{A} | - | true | - | 用大单跟J，留四炸；偏炸人设也不必炸中单 |
| eg024 | pass | pass | - | true | - | decide 可能用对8砸搭档；partner-first 应过牌 |
| eg025 | single:2 | single:2{2} | - | true | - | 级牌2压A夺控 |
| eg026 | fullhouse:9 | fullhouse:9{99955} | - | true | - | 三带二整组打出 |
| eg027 | single:8 | single:8{8} | - | true | - | 敌剩2张，勿拆三条乱出，先甩小单 |
| eg028 | bomb:A | bomb:A{AAAA} | - | true | - | 用四A反炸 |
| eg029 | pass | pass | - | true | - | 让搭档四A反炸，己方五炸留着 |
| eg030 | single:Q | single:Q{Q} | - | true | - | Q压8并出走 |
| eg031 | straight:3/7 | straight:7{34567} | - | true | - | 敌剩2张（AA）：顺子3-7对方接不住，再出级牌对2走完 |
| eg032 | straight:3 | straight:7{34567} | - | true | - | 顺子3-7整出 |
| eg033 | pass | pass | - | true | - | 无更大炸，过牌 |
| eg034 | pair:A | pair:A{AA} | - | true | - | 对A压对K |
| eg035 | single:BJ/RJ | single:RJ{RJ} | - | true | - | 用王压A（大/小王皆可） |
| eg036 | pass | pass | - | true | - | 三条9不值得四炸 |
| eg037 | pair:K | pair:K{KK} | - | true | - | 北座剩对K走出 |
| eg038 | pass | pass | - | true | - | 四3不炸三带二 |
| eg039 | pass | pass | - | true | - | 搭档控场，过牌护搭档 |
| eg040 | bomb:7 | bomb:7{7777} | - | true | - | 末张A打断（对齐 eg016 可炸模式） |
| eg041 | single:Q/K/A | single:A{A} | - | true | - | 中单不值得四炸 |
| eg042 | single:4/5/6 | single:4{4} | - | true | - | 领出忌先亮炸 |
| eg043 | single:BJ/RJ | single:RJ{RJ} | - | true | - | 大王/小王皆可 |
| eg044 | fullhouse:K | fullhouse:K{KKK55} | - | true | - | 一手走完 |
| eg045 | pairSeq:4/5/6 | pairSeq:6{445566} | - | true | - | 保结构 |
| eg046 | single:A/K | single:A{A} | - | true | - | 同花顺压8极亏 |
| eg047 | single:2 | single:2{2} | - | true | - | 级牌当大单 |
| eg048 | pair:Q | pair:Q{QQ} | - | true | - | 末对出走 |
| eg049 | bomb:4 | bomb:4{4444} | - | true | - | aggressive 可炸大对 |
| eg050 | pass | pass | - | true | - | 忌炸搭档三带二 |
