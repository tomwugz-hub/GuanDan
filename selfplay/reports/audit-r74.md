# 自对局体检报告

生成：2026/10/28 10:41:35（Asia/Shanghai）　policy：current　用时 177s

对局：【进贡比赛模式，每场 8 副】自对局 200 副（四家 decide），混合对手 Random、Greedy、Old:pre-activity、Old:pre-round6 各 40×2 副（换座位）；逐手记录 45576 条；surprise 局面 40 个。

局面 id 可复现：`node selfplay/audit.mjs --replay='<id>'`（cfg|seed|step）。

## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）

无红旗。


## 全部检测器

| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |
|---|---|---|---|---|---|
| 早中盘领出小单（≤10）后两个敌家都不跟 | 1.9% | 464 | ≤25% | 6.6% | OK |
| 早中盘领出小对（≤10）后两个敌家都不跟 | 0.9% | 212 | ≤35% | 11.9% | OK |
| 跟敌人牌过牌率（early，有牌可出时） | 43.7% | 3505 | ≥30 且 ≤62% | 52.0% | OK |
| 跟敌人牌过牌率（mid，有牌可出时） | 42.8% | 3703 | ≥30 且 ≤65% | 56.5% | OK |
| 跟敌人牌过牌率（late，有牌可出时） | 30.3% | 1609 | ≥20 且 ≤75% | 38.1% | OK |
| 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率 | 7.7% | 1690 | ≤35% | 20.5% | OK |
| 压对家的牌（early，有牌可压时） | 0.0% | 984 | ≤15% | 0.0% | OK |
| 压对家的牌（mid，有牌可压时） | 0.2% | 1062 | ≤15% | 0.2% | OK |
| 压对家的牌（late，有牌可压时） | 15.5% | 489 | ≤30% | 12.1% | OK |
| 炸对家（未因此走完） | 0.0% | 2244 | ≤2% | 0.0% | OK |
| 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌 | 33.3% | 9 | ≤60% | 62.1% | 样本少 |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 1.4% | 713 | ≤15% | 15.7% | OK |
| 敌家都 ≥10 张时领出炸弹（非走完） | 1.2% | 1124 | ≤10% | 6.9% | OK |
| 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌 | 5.6% | 107 | ≤45% | 3.2% | OK |
| 输家结束时手里还留着炸弹（每个输家座位） | 6.3% | 400 | ≤20% | 6.8% | OK |
| 输家结束时还握着 ≥2 张王/级牌 | 3.0% | 400 | ≤25% | 7.3% | OK |
| 末游卡手（结束时 ≥8 张且至少还要 5 手） | 0.0% | 200 | ≤25% | 0.0% | OK |
| 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10） | 2.1% | 1055 | ≤8% | 1.5% | OK |
| 早盘领出 A/级牌/王的单对 | 0.0% | 219 | ≤12% | 0.5% | OK |
| 拆炸弹领出 | 0.2% | 2558 | ≤2% | 0.3% | OK |
| 早盘拆对领单（手里有顺子/连对/钢板可出） | 0.0% | 89 | ≤15% | 0.7% | OK |
| 早盘领出对子占比 | 17.5% | 658 | ≥5% | 12.1% | OK |
| 早盘领出单张占比 | 15.8% | 658 | ≥15 且 ≤55% | 18.7% | OK |
| 一手能出完却没出完 | 0.0% | 508 | ≤1% | 0.0% | OK |
| decide 用时 >300ms 的比例 | 0.0% | 30755 | ≤0.5% | 0.0% | OK |
| 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测） | 0.000 | 520 | ≤0 | 0.000 | OK |
| 对 Random 每副净升级 | 2.987 | 80 | ≥1.5 | 2.908 | OK |
| 对 Greedy 每副净升级 | 2.612 | 80 | ≥0.5 | 2.422 | OK |
| 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸） | 36.2% | 177 | ≤50% | 35.5% | OK |
| Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5 | 2.5% | 40 | ≤5% | 8.8% | OK |

## 队伍结果

- 自对局 200 副：南北队每副净升级 -0.105 [-0.421, 0.211]（应≈0），双下率 44.0%，平均每副 88 手
- 各座位平均名次（南/东/北/西）：2.55 / 2.36 / 2.56 / 2.52
- decide vs Random：80 副，胜 80/80 (100%)，每副净升级 2.987 [2.963, 3.012]
- decide vs Greedy：80 副，胜 77/80 (96%)，每副净升级 2.612 [2.429, 2.796]
- decide vs Old:pre-activity：80 副，胜 74/80 (93%)，每副净升级 2.175 [1.972, 2.378]
- decide vs Old:pre-round6：80 副，胜 75/80 (94%)，每副净升级 2.175 [2.070, 2.280]

## 进贡

- 进贡比赛 65 场共 520 副；需进贡的副 389：单贡 149（抗贡 8/149 (5%)，理论≈6%），双下双贡 240（抗贡 75/240 (31%)，理论≈25%；贡牌同点 13）
- 贡牌分布：RJ 32%，BJ 25%，A 11%，5 5%，8 5%，K 5%，J 4%，9 3%，Q 3%，6 2%，3 2%，7 2%，10 1%，4 0%
- 自对局还贡点数分布（decide）：2 19%，4 17%，3 15%，7 10%，10 9%，9 9%，5 7%，6 7%，8 7%
- 自对局进贡副（未抗贡）进贡方每副净升级 -0.277 [-0.664, 0.109]（n=137；负 = 输家进贡后仍吃亏）
- 自对局抗贡副 抗贡方每副净升级 -0.682 [-1.560, 0.196]（n=22）
- 进贡不变量（贡牌=最大非逢人配、双下大贡归头游/同点头游下家、抗贡判定、还贡≤10、先出者、交换后各 27 张、牌守恒）：全部通过（检查 520 副）

## 详情与示例局面

### 早中盘领出小单（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：9/9 (100%)

- `self|151|84` 座1 7张 敌最少7 对家9 级8 上手=single:3 → **pass** []<br>手牌: 8H 6S 6H 3S 3H 3C 3D
- `self|151|88` 座1 7张 敌最少7 对家9 级8 上手=single:5 → **pass** []<br>手牌: 8H 6S 6H 3S 3H 3C 3D
- `self|151|92` 座1 7张 敌最少7 对家9 级8 上手=single:6 → **pass** []<br>手牌: 8H 6S 6H 3S 3H 3C 3D
- `self|151|96` 座1 7张 敌最少7 对家9 级8 上手=single:9 → **pass** [noSFon8]<br>手牌: 8H 6S 6H 3S 3H 3C 3D
- `self|151|100` 座1 7张 敌最少7 对家9 级8 上手=single:10 → **pass** []<br>手牌: 8H 6S 6H 3S 3H 3C 3D

### 早中盘领出小对（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：1/2 (50%)

- `self|68|54` 座3 15张 敌最少11 对家10 级10 上手=pair:5 → **pass** []<br>手牌: 10H QC JC 9C 5C 4S 4H 4C 4D 2S 2S 2H 2H 2C 2C
- `self|370|67` 座2 7张 敌最少8 对家14 级A 上手=pair:9 → **pass** []<br>手牌: AD 8S 8C 8D 8D 6D 6D

### 跟敌人牌过牌率（early，有牌可出时）

- `self|16|9` 座1 26张 敌最少20 对家26 级3 上手=fullhouse:6 → **pass** []<br>手牌: AH KD QS QH QC QD QD JS JS JH JC 9H 9C 8S 8C 7S 7D 6S 6H 6C 6D 5S 5S 5H 5D 5D
- `self|67|25` 座1 23张 敌最少19 对家17 级7 上手=pair:K → **pass** []<br>手牌: 7H 7S AS AS AC AD AD KC KD KD QH QC QD 10H 10D 9S 9C 9D 8D 8D 6S 2H 2C
- `self|149|4` 座2 22张 敌最少22 对家27 级2 上手=straight:K → **pass** []<br>手牌: 2H 2H AH AC AC KS KD JH 10H 7H 7H 6S 6C 5S 5S 5D 5D 4H 4D 3H 3C 3D
- `self|245|25` 座1 26张 敌最少18 对家17 级8 上手=single:A → **pass** []<br>手牌: 8H 8S 8S 8C 8D KH KC KC QH QD 10C 10D 9S 9C 9D 6S 6D 5H 5C 5D 4D 3S 3S 3H 2H 2C
- `self|324|15` 座0 23张 敌最少22 对家22 级A 上手=triple:Q → **pass** []<br>手牌: RJ AH AS AC AC AD QD JS 8H 7C 7D 6S 6H 6C 5C 4S 4C 3H 3H 2S 2S 2H 2D

### 跟敌人牌过牌率（mid，有牌可出时）

- `self|16|39` 座3 16张 敌最少12 对家25 级3 上手=single:Q → **pass** [r14NoPass]<br>手牌: 3H 3H AS AH AC AD 9S 4S 4S 4H 4C 4C 2S 2S 2C 2D
- `self|100|44` 座0 19张 敌最少14 对家19 级A 上手=fullhouse:3 → **pass** []<br>手牌: AH KH KC KC KD 8S 8S 8H 8C 6S 6C 6D 6D 5H 5C 3S 3H 3C 3D
- `self|195|19` 座3 15张 敌最少20 对家26 级3 上手=fullhouse:8 → **pass** []<br>手牌: AS AH AC AC KD QS QH QH QC QC QD JC 9C 9D 5H
- `self|261|57` 座3 14张 敌最少5 对家7 级J 上手=pair:K → **pass** []<br>手牌: JH JC JD QS QS QC QD 7S 7H 7C 7D 5S 5H 5D
- `self|327|60` 座1 10张 敌最少14 对家11 级5 上手=pair:Q → **pass** []<br>手牌: BJ 5S 5S 5C 5D 5D 2S 2H 2C 2D

### 跟敌人牌过牌率（late，有牌可出时）

- `self|18|44` 座0 7张 敌最少9 对家19 级9 上手=pair:5 → **pass** []<br>手牌: 8S 8C 8C 5S 5S 5C 5D
- `self|116|65` 座3 9张 敌最少9 对家12 级5 上手=single:Q → **pass** []<br>手牌: 5H 5D 7H 7H 7C 7C 3S 3H 3D
- `self|151|96` 座1 7张 敌最少7 对家9 级8 上手=single:9 → **pass** [noSFon8]<br>手牌: 8H 6S 6H 3S 3H 3C 3D
- `self|215|79` 座3 9张 敌最少8 对家5 级3 上手=triple:7 → **pass** []<br>手牌: 3S 3C 3D 3D 10S 10H 10H 10D 10D
- `self|320|80` 座1 7张 敌最少9 对家11 级9 上手=single:4 → **pass** []<br>手牌: AH AH AC AD JC JD JD

### 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率

按座位 南/东/北/西：30/420 (7%) / 32/430 (7%) / 27/396 (7%) / 41/444 (9%)

- `self|19|48` 座0 22张 敌最少11 对家11 级Q 上手=single:10 → **pass** []<br>手牌: QH QS QD KH KH KC JS JH JD 9H 9C 6S 6H 6D 5S 5C 5D 4S 4H 4C 4D 2H
- `self|68|52` 座1 10张 敌最少11 对家15 级10 上手=single:K → **pass** []<br>手牌: AS AS AH AC AD QS JH JH JC JD
- `self|130|68` 座0 13张 敌最少10 对家12 级A 上手=single:7 → **pass** []<br>手牌: 9S 9H 9C 9C 9D 9D 8H 8C 8D 7S 7C 7C 7D
- `self|215|22` 座2 23张 敌最少14 对家23 级3 上手=pair:8 → **pass** []<br>手牌: RJ RJ BJ AH AH KH KC QS QH JC 10C 9S 7S 7S 7C 6S 6H 4S 4H 4C 4D 2S 2C
- `self|306|28` 座2 23张 敌最少13 对家7 级10 上手=single:K → **pass** []<br>手牌: 10H 10H 10D QS JS 9H 8S 7S 7C 6C 5C 5D 4S 4H 4C 4D 4D 2S 2S 2H 2H 2C 2D

### 压对家的牌（mid，有牌可压时）

- `self|99|74` 座3 10张 敌最少8 对家1 级A 上手=fullhouse:3 → **fullhouse:6{6C 6H 6D 2C 2S}** []<br>手牌: 8S 8D 8D 6H 6C 6D 5S 5C 2S 2C
- `self|391|88` 座0 10张 敌最少1 对家0 级7 上手=single:Q → **single:BJ{BJ}** [followUp,blockSure]<br>手牌: BJ AD KS KD 10S 10D 9H 5S 5S 5D

### 压对家的牌（late，有牌可压时）

- `self|18|68` 座0 3张 敌最少1 对家10 级9 上手=pair:2 → **pair:8{8C 8C}** []<br>手牌: 8S 8C 8C
- `self|70|81` 座0 1张 敌最少6 对家5 级K 上手=single:A → **single:RJ{RJ}** [goOut]<br>手牌: RJ
- `self|179|86` 座1 5张 敌最少1 对家0 级5 上手=triple:6 → **triple:7{7D 7H 7D}** [forceFinish:sure,blockSure]<br>手牌: 7H 7D 7D 4S 4S
- `self|295|90` 座3 2张 敌最少2 对家6 级4 上手=single:5 → **single:4{4H}** [followUp,strongBeforeLast,forceFinish:sure]<br>手牌: 4H AS
- `self|384|69` 座3 9张 敌最少11 对家6 级K 上手=fullhouse:4 → **fullhouse:5{5S 5H 5S 7D 7D}** [forceFinish:bombBack]<br>手牌: QS QH QC QD 7D 7D 5S 5S 5H

### 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌

旧口径（含拆炸/只有炸弹可压）：3/9 (33%)；其中不拆三张也能压：3/9 (33%)；只能拆三张才能压：0/0 (0%)

- `self|179|69` 座2 8张 敌最少3 对家6 级5 上手=single:6 → **pass** [可压:single:K{KC}]<br>手牌: 5S 5S 5C 5D KC 4C 4C 4D
- `self|279|78` 座2 7张 敌最少1 对家6 级A 上手=pair:5 → **pass** [可压:pair:K{KC KH}]<br>手牌: KH KC 9D 8C 3S 3H 3D
- `self|386|61` 座2 9张 敌最少3 对家16 级2 上手=single:8 → **pass** [noSFon8,可压:single:J{JH} / single:A{AH} / single:10{10H}]<br>手牌: AH AC KD JS JH JC 10H 5C 5D

### 敌家都 ≥15 张时炸普通牌（占跟牌炸弹）

每副炸弹数（自对局，四人合计）：早 0.82 / 中 2.71 / 晚 2.08

- `self|32|74` 座2 8张 敌最少18 对家9 级4 上手=fullhouse:7 → **bomb:8{8H 8D 8S 8C}** [noWasteJ,mustBomb,forceFinish:bombBack]<br>手牌: JS JS JC JD 8S 8H 8C 8D
- `self|84|78` 座0 8张 敌最少15 对家0 级A 上手=pair:A → **bomb:6{6H 6D 6S 6C}** [mustBomb,forceFinish:likely]<br>手牌: KH KC 10H 10D 6S 6H 6C 6D
- `self|146|61` 座3 12张 敌最少16 对家1 级K 上手=single:RJ → **bomb:8{8H 8D 8S 8C}** [mustBomb,controlFeed:single]<br>手牌: RJ 9S 9C 8S 8H 8C 8D 7C 5D 4H 3C 3D
- `self|262|59` 座1 12张 敌最少18 对家11 级A 上手=fullhouse:4 → **bomb:2{2C 2D 2H 2S}** [noWasteJ,mustBomb]<br>手牌: KH KH KD KD 3S 3H 3H 3C 2S 2H 2C 2D
- `self|274|66` 座1 7张 敌最少19 对家5 级10 上手=single:Q → **bomb:K{KS KH KH 10H}** [mustBomb]<br>手牌: 10H KS KH KH JS JH 8D

### 敌家都 ≥10 张时领出炸弹（非走完）

炸压炸占跟牌炸弹：299/1012 (30%)

- `self|16|69` 座1 9张 敌最少10 对家11 级3 上手=pass → **bomb:J{JC JS JH JS}** [bombClear,control]<br>手牌: QS QH QC QD QD JS JS JH JC
- `self|54|50` 座0 11张 敌最少10 对家21 级8 上手=pass → **bomb:4{4D 4H 4S 4C}** [bombClear,control]<br>手牌: 8H 8S AS AH AH AC AD 4S 4H 4C 4D
- `self|117|57` 座0 10张 敌最少13 对家11 级3 上手=pass → **bomb:7{7C 7D 7S 7H}** [bombClear,control]<br>手牌: 3S 3D 10S 10H 10C 10D 7S 7H 7C 7D
- `self|160|50` 座1 14张 敌最少10 对家13 级Q 上手=pass → **bomb:7{7D 7H 7S 7H}** [bombClear,control]<br>手牌: QH QD KS KS KH KC KD 7S 7H 7H 7D 6S 6D 6D
- `self|166|60` 座0 10张 敌最少11 对家19 级2 上手=pass → **bomb:4{4H 4S 4D 4C}** [bombClear,control]<br>手牌: 2H 2S QS QH QC QD 4S 4H 4C 4D

### 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌

- `self|19|54` 座2 11张 敌最少3 对家22 级Q 上手=pair:9 → **pass** []<br>手牌: 7S 7H 7H 7C 7D 6H 5D 2S 2H 2C 2D
- `self|20|62` 座2 12张 敌最少2 对家2 级A 上手=fullhouse:8 → **pass** []<br>手牌: AS AD KC 10D 8S 8S 8H 8C 6H 6H 6C 5D
- `self|37|52` 座1 10张 敌最少2 对家3 级A 上手=pair:BJ → **pass** [r23KeepExitBomb]<br>手牌: AH QS QS JH 9S 9H 9C 9C 9D 2D
- `self|84|71` 座0 12张 敌最少2 对家0 级A 上手=fullhouse:8 → **pass** []<br>手牌: AS AC KH KC 10H 10D 8H 8C 6S 6H 6C 6D
- `self|182|66` 座1 21张 敌最少3 对家3 级9 上手=single:J → **pass** []<br>手牌: JS JH JH JC JC JD 8S 8H 8C 8C 8D 7H 7H 7C 7D 6S 6C 5D 5D 2S 2H

### 输家结束时手里还留着炸弹（每个输家座位）

- `self|16` 座0 结束时手里：BJ 10D 10H 5C QH RJ 10H 10S 10D 5C
- `self|16` 座2 结束时手里：8C 8S 8H 9D 9H 9D 3C 9C KS 3S
- `self|20` 座2 结束时手里：8S 8H 8C 8S
- `self|22` 座1 结束时手里：7D 7H 10D 7S 7H
- `self|39` 座2 结束时手里：KH KH KD KS

### 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10）

- `self|22|16` 座2 21张 敌最少23 对家27 级4 上手=pair:10 → **pair:4{4S 4D}** [followSize,keepControlPair,r28MidFollow]<br>手牌: 4H 4S 4D 4D AC KD QC JS JS JH JH JC 10H 8H 8C 8D 8D 3D 2C 2D 2D
- `self|52|7` 座3 25张 敌最少23 对家25 级10 上手=pair:K → **pair:BJ{BJ BJ}** [followSize,keepControlPair,r50NextFollow]<br>手牌: RJ BJ BJ 10H 10S KD QH JH JD 9S 9D 8S 8H 8C 8D 6H 6D 6D 5S 4H 3S 3C 2S 2C 2D
- `self|81|26` 座2 22张 敌最少16 对家18 级10 上手=single:10 → **single:BJ{BJ}** [followUp,followSize,keepControl,r28MidFollow]<br>手牌: BJ 10C AS AH AC AC AD QH JS JH JH 9S 9C 7S 6H 6C 6C 6D 5D 3C 2C 2D
- `self|160|42` 座1 21张 敌最少10 对家13 级Q 上手=single:9 → **single:Q{QC}** [noSFon8,followUp,breakNoOrphan,followSize,keepControl,r28MidFollow]<br>手牌: QH QC QD KS KS KH KC KD 7S 7H 7H 7D 6S 6D 6D 3S 3H 3D 2S 2H 2D
- `self|278|64` 座1 23张 敌最少2 对家4 级Q 上手=pair:2 → **pair:Q{QS QC}** [stopShort,followSize]<br>手牌: QH QS QC AD KH 10S 10H 10C 10D 9S 9C 9D 7S 7H 7H 7D 6S 6S 6C 5H 5D 3S 3H

### 拆炸弹领出

- `self|66|14` 座2 21张 敌最少21 对家25 级J 上手=pass → **straight:A{10S JD QS KD AC}** [bombBreakNoGain,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: JH JH JD AC KD QS 10S 10S 10H 10C 8H 5S 5H 5H 5D 4H 4C 4C 4D 2H 2D
- `self|80|13` 座1 19张 敌最少19 对家19 级7 上手=pass → **straight:6{2C 3H 4H 5S 6D}** [bombBreakNoGain,holdBombLead,control,planUnitFirst]<br>手牌: 7S 7D KC KC KD JC JD 10H 10C 10D 10D 6D 5S 4H 4H 4C 4D 3H 2C
- `self|194|38` 座2 15张 敌最少7 对家13 级5 上手=pass → **straight:A{10H JC QS KD AC}** [leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: 5H AC KD QS JC 10S 10H 10C 10D 7H 7D 6H 6D 4C 4D
- `self|209|17` 座0 17张 敌最少9 对家15 级3 上手=pass → **straight:9{5H 6C 7D 8S 9C}** [bombBreakNoGain,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: 3S AS AS KC KD QC JD 9C 8S 7D 6C 5S 5H 5C 5D 4S 4C
- `self|227|64` 座3 9张 敌最少10 对家12 级6 上手=pass → **fullhouse:10{10H 10D 10C JD JH}** [control,offPlan,forceFinish:bombBack]<br>手牌: 6H 6H JS JH JD JD 10H 10C 10D

### 早盘领出单张占比

早盘领出牌型分布：straight 20%，pairSeq 17%，pair 17%，single 16%，fullhouse 16%，tripleSeq 11%，triple 3%；熵 2.68 bit


### decide 用时 >300ms 的比例

p50 1.6ms，p90 18.4ms，p99 58.4ms，max 497.3ms

- `self|208|42` 座3 15张 敌最少1 对家8 级2 上手=fullhouse:4 → **bomb:8{8C 8H 8D 8D}** [noWasteJ,mustBomb]<br>手牌: 2H 2H 2S 2C JS 8H 8C 8D 8D 7S 7C 5S 5H 4H 4C

### 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）

全部通过


### 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸）

不分有无孤张：还的点数手里原有 ≥2 张 74/187 (40%)（有的是顺子里多出的一张，拆牌计划认为更便宜）；还 >10 的牌（手里没有 ≤10，兜底）：0/187 (0%)


### Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5

分类：enemy/mid/otherPlay 1

- `self|80|45` enemy 11张 张数14/11/9/15 级7 上手=single:J<br>decide: **single:7{7S}** (1.11) [followUp,followSize,keepControlSoft,r28MidFollow] vs **single:K{KC}** (+0.75, t=2.7, n=36)<br>手牌: 10D 10C 4D KC 7S KD 4H KC 4C 10H 10D
