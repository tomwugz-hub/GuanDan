# 自对局体检报告

生成：2026/10/28 12:38:47（Asia/Shanghai）　policy：current　用时 741s

对局：【进贡比赛模式，每场 8 副】自对局 400 副（四家 decide），混合对手 Random、Greedy、Old:pre-activity、Old:pre-round6 各 20×2 副（换座位）；逐手记录 52574 条；surprise 局面 120 个。

局面 id 可复现：`node selfplay/audit.mjs --replay='<id>'`（cfg|seed|step）。

## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）

无红旗。


## 全部检测器

| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |
|---|---|---|---|---|---|
| 早中盘领出小单（≤10）后两个敌家都不跟 | 1.0% | 955 | ≤25% | 6.6% | OK |
| 早中盘领出小对（≤10）后两个敌家都不跟 | 2.8% | 436 | ≤35% | 11.9% | OK |
| 跟敌人牌过牌率（early，有牌可出时） | 44.3% | 6993 | ≥30 且 ≤62% | 52.0% | OK |
| 跟敌人牌过牌率（mid，有牌可出时） | 41.0% | 7236 | ≥30 且 ≤65% | 56.5% | OK |
| 跟敌人牌过牌率（late，有牌可出时） | 28.4% | 3245 | ≥20 且 ≤75% | 38.1% | OK |
| 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率 | 7.7% | 3383 | ≤35% | 20.5% | OK |
| 压对家的牌（early，有牌可压时） | 0.0% | 2004 | ≤15% | 0.0% | OK |
| 压对家的牌（mid，有牌可压时） | 0.1% | 2078 | ≤15% | 0.2% | OK |
| 压对家的牌（late，有牌可压时） | 18.8% | 946 | ≤30% | 12.1% | OK |
| 炸对家（未因此走完） | 0.0% | 4459 | ≤2% | 0.0% | OK |
| 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌 | 33.3% | 6 | ≤60% | 62.1% | 样本少 |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 2.1% | 1483 | ≤15% | 15.7% | OK |
| 敌家都 ≥10 张时领出炸弹（非走完） | 1.4% | 2314 | ≤10% | 6.9% | OK |
| 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌 | 5.5% | 237 | ≤45% | 3.2% | OK |
| 输家结束时手里还留着炸弹（每个输家座位） | 2.9% | 800 | ≤20% | 6.8% | OK |
| 输家结束时还握着 ≥2 张王/级牌 | 2.3% | 800 | ≤25% | 7.3% | OK |
| 末游卡手（结束时 ≥8 张且至少还要 5 手） | 0.0% | 400 | ≤25% | 0.0% | OK |
| 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10） | 2.6% | 2103 | ≤8% | 1.5% | OK |
| 早盘领出 A/级牌/王的单对 | 0.0% | 419 | ≤12% | 0.5% | OK |
| 拆炸弹领出 | 0.1% | 5201 | ≤2% | 0.3% | OK |
| 早盘拆对领单（手里有顺子/连对/钢板可出） | 1.0% | 193 | ≤15% | 0.7% | OK |
| 早盘领出对子占比 | 15.0% | 1345 | ≥5% | 12.1% | OK |
| 早盘领出单张占比 | 16.1% | 1345 | ≥15 且 ≤55% | 18.7% | OK |
| 一手能出完却没出完 | 0.0% | 1020 | ≤1% | 0.0% | OK |
| decide 用时 >300ms 的比例 | 0.0% | 43469 | ≤0.5% | 0.0% | OK |
| 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测） | 0.000 | 592 | ≤0 | 0.000 | OK |
| 对 Random 每副净升级 | 2.979 | 48 | ≥1.5 | 2.908 | OK |
| 对 Greedy 每副净升级 | 2.479 | 48 | ≥0.5 | 2.422 | OK |
| 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸） | 35.9% | 329 | ≤50% | 35.5% | OK |
| Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5 | 0.0% | 120 | ≤5% | 8.8% | OK |

## 队伍结果

- 自对局 400 副：南北队每副净升级 0.085 [-0.136, 0.306]（应≈0），双下率 42.5%，平均每副 88 手
- 各座位平均名次（南/东/北/西）：2.43 / 2.50 / 2.50 / 2.57
- decide vs Random：48 副，胜 48/48 (100%)，每副净升级 2.979 [2.938, 3.020]
- decide vs Greedy：48 副，胜 45/48 (94%)，每副净升级 2.479 [2.371, 2.587]
- decide vs Old:pre-activity：48 副，胜 45/48 (94%)，每副净升级 1.979 [1.731, 2.228]
- decide vs Old:pre-round6：48 副，胜 41/48 (85%)，每副净升级 1.729 [1.007, 2.452]

## 进贡

- 进贡比赛 74 场共 592 副；需进贡的副 455：单贡 232（抗贡 21/232 (9%)，理论≈6%），双下双贡 223（抗贡 73/223 (33%)，理论≈25%；贡牌同点 20）
- 贡牌分布：RJ 37%，BJ 27%，A 11%，K 4%，5 3%，8 3%，J 3%，6 2%，7 2%，9 2%，10 2%，Q 2%，3 1%，4 1%
- 自对局还贡点数分布（decide）：2 21%，3 15%，4 15%，6 11%，8 9%，5 7%，7 7%，9 7%，10 7%
- 自对局进贡副（未抗贡）进贡方每副净升级 -0.289 [-0.566, -0.012]（n=263；负 = 输家进贡后仍吃亏）
- 自对局抗贡副 抗贡方每副净升级 0.386 [-0.142, 0.914]（n=57）
- 进贡不变量（贡牌=最大非逢人配、双下大贡归头游/同点头游下家、抗贡判定、还贡≤10、先出者、交换后各 27 张、牌守恒）：全部通过（检查 592 副）

## 详情与示例局面

### 早中盘领出小单（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：10/10 (100%)

- `self|281600003|46` 座3 7张 敌最少11 对家11 级Q 上手=single:10 → **pass** []<br>手牌: 8C 7D 5D 4S 4C 4D 2H
- `self|281600322|69` 座2 13张 敌最少10 对家13 级Q 上手=single:6 → **pass** []<br>手牌: 8S 8C 8D 8D 3S 3S 3H 3C 3C 2S 2S 2C 2D
- `self|281600359|71` 座3 9张 敌最少9 对家8 级3 上手=single:5 → **pass** []<br>手牌: 3H 10H 10C 10C 10D 8S 8H 8C 8D
- `self|281600359|79` 座3 9张 敌最少9 对家8 级3 上手=single:7 → **pass** []<br>手牌: 3H 10H 10C 10C 10D 8S 8H 8C 8D
- `self|281600530|69` 座1 9张 敌最少11 对家15 级K 上手=single:9 → **pass** [noSFon8]<br>手牌: KC KC 9S 9S 9C 6H 6C 6D 6D

### 早中盘领出小对（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：12/12 (100%)

- `self|281600083|38` 座3 8张 敌最少8 对家11 级A 上手=pair:9 → **pass** []<br>手牌: QS 10C 8C 6H 5H 4C 4C 4D
- `self|281600198|59` 座1 11张 敌最少10 对家6 级4 上手=pair:5 → **pass** []<br>手牌: AS AH AC KS KS KD 10S 5S 5H 2H 2D
- `self|281600243|49` 座0 23张 敌最少8 对家11 级Q 上手=pair:10 → **pass** []<br>手牌: QD AS AH AD AD 10S 10C 10D 9S 9C 9C 9D 8H 8C 7S 7S 7H 7D 5S 5D 5D 4S 3S
- `self|281600292|41` 座2 23张 敌最少13 对家21 级2 上手=pair:8 → **pass** []<br>手牌: BJ 2H 2C AC AD KH QC JD 9H 8H 7S 7S 7H 7H 7C 7C 6D 4S 4H 4C 4D 3H 3H
- `self|281600485|30` 座3 12张 敌最少14 对家20 级A 上手=pair:3 → **pass** []<br>手牌: JS JS JH JD JD 10C 6D 4S 4H 4C 4C 3S

### 跟敌人牌过牌率（early，有牌可出时）

- `self|281600000|10` 座1 22张 敌最少16 对家21 级4 上手=fullhouse:K → **pass** []<br>手牌: RJ 4H 4S 4C AH AD KH QH QD JS JH 10S 10S 7D 5S 3S 3S 3C 3D 2S 2C 2D
- `self|281600133|11` 座0 25张 敌最少25 对家26 级6 上手=single:BJ → **pass** []<br>手牌: RJ RJ 6H AS AH AC KH KD JD 10H 10C 10C 10D 9S 9C 9D 7S 7H 7C 7C 7D 4C 3H 2C 2C
- `self|281600278|36` 座3 22张 敌最少7 对家6 级5 上手=fullhouse:K → **pass** []<br>手牌: 5S 5C AS AC AC AD KS KH QH QC QD 10S 9C 9D 9D 7H 7C 4S 4S 4H 3S 3D
- `self|281600439|21` 座0 25张 敌最少23 对家23 级10 上手=single:A → **pass** []<br>手牌: 10C 10D AS AH KC KD QS QC JH JD 9S 9H 9D 7S 7H 7H 7D 6S 6H 5S 5D 4H 2H 2D 2D
- `self|281600611|10` 座1 25张 敌最少24 对家25 级4 上手=single:4 → **pass** []<br>手牌: BJ BJ 4H 4S KS KH KC KC KD QH QC JC 10H 10C 10C 9S 9H 9C 5S 5S 5C 3C 3D 2H 2D

### 跟敌人牌过牌率（mid，有牌可出时）

- `self|281600000|26` 座1 10张 敌最少15 对家20 级4 上手=fullhouse:7 → **pass** []<br>手牌: 4H 4S 4C KH 7D 5S 3S 3S 3C 3D
- `self|281600167|40` 座3 15张 敌最少12 对家18 级6 上手=triple:J → **pass** []<br>手牌: 6S AC QS QS QH QC QD 9H 7H 7C 7D 5S 5D 4D 4D
- `self|281600322|69` 座2 13张 敌最少10 对家13 级Q 上手=single:6 → **pass** []<br>手牌: 8S 8C 8D 8D 3S 3S 3H 3C 3C 2S 2S 2C 2D
- `self|281600466|45` 座2 17张 敌最少12 对家11 级8 上手=pair:K → **pass** []<br>手牌: 8H AS AH AC AD JC 10S 6H 6C 5S 5D 4S 4H 4H 4D 3S 3D
- `self|281600626|34` 座0 13张 敌最少12 对家17 级9 上手=single:A → **pass** []<br>手牌: 9H QH JC 6H 6D 6D 5H 5C 4H 4C 4D 2D 2D

### 跟敌人牌过牌率（late，有牌可出时）

- `self|281600000|54` 座1 9张 敌最少4 对家16 级4 上手=fullhouse:6 → **pass** []<br>手牌: 4H 4S 4C KH 5S 3S 3S 3C 3D
- `self|281600229|46` 座3 7张 敌最少14 对家13 级K 上手=single:10 → **pass** []<br>手牌: KS KC JS JD 4H 4C 4D
- `self|281600357|51` 座3 7张 敌最少10 对家15 级4 上手=single:Q → **pass** []<br>手牌: 4H 4C 10H 3C 3D 2H 2C
- `self|281600496|67` 座3 7张 敌最少6 对家5 级9 上手=single:K → **pass** []<br>手牌: 9H 9H 7H 3S 3H 3C 2D
- `self|281600625|64` 座0 8张 敌最少6 对家21 级6 上手=single:A → **pass** []<br>手牌: 6H JH 10D 8H 8C 8C 8D 5D

### 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率

按座位 南/东/北/西：68/845 (8%) / 65/826 (8%) / 63/861 (7%) / 66/851 (8%)

- `self|281600003|48` 座1 11张 敌最少11 对家7 级Q 上手=single:10 → **pass** []<br>手牌: QH 8S 8S 8H 8H 8D 7S 7H 7C 6S 4H
- `self|281600147|26` 座0 26张 敌最少17 对家17 级3 上手=pair:10 → **pass** []<br>手牌: RJ 3S 3C AS KS QH JH JH JC JC JD 9S 9S 7S 7C 7D 7D 5C 5D 4S 4H 4H 4C 4C 2H 2D
- `self|281600289|19` 座1 27张 敌最少11 对家12 级10 上手=single:A → **pass** [r14NoPass]<br>手牌: 10C AS AC AC AD AD KH KD QS QH QD JH JC 9S 9H 9C 8D 7C 5C 4H 4D 3C 3D 2H 2H 2D 2D
- `self|281600422|68` 座2 17张 敌最少7 对家5 级10 上手=pair:A → **pass** []<br>手牌: 10H 10H KS KS QS QS QD JH JC 8H 8C 8C 7S 7S 7D 7D 5D
- `self|281600611|29` 座0 12张 敌最少20 对家26 级4 上手=pair:3 → **pass** []<br>手牌: RJ 4D AC 10S 10S 10H 10D 9C 3S 3H 3C 3D

### 压对家的牌（mid，有牌可压时）

- `self|281600195|77` 座2 17张 敌最少2 对家0 级8 上手=single:J → **single:8{8D}** [followUp]<br>手牌: 8D 8D QH 10H 10C 10D 9S 9S 9C 7S 7C 5S 5C 5D 4D 2H 2D
- `self|281600293|70` 座3 10张 敌最少2 对家2 级5 上手=single:K → **single:BJ{BJ}** [followUp]<br>手牌: BJ BJ AD 6H 6D 3S 3H 3D 2S 2H

### 压对家的牌（late，有牌可压时）

- `self|281600000|76` 座3 4张 敌最少2 对家4 级4 上手=bomb:3 → **bomb:7{7H 7C 7S 7C}** [goOut]<br>手牌: 7S 7H 7C 7C
- `self|281600147|108` 座1 1张 敌最少1 对家2 级3 上手=single:6 → **single:A{AC}** [goOut]<br>手牌: AC
- `self|281600324|64` 座1 4张 敌最少3 对家15 级A 上手=bomb:9 → **bomb:10{10S 10C 10C AH}** [goOut]<br>手牌: AH 10S 10C 10C
- `self|281600500|82` 座2 3张 敌最少6 对家3 级2 上手=single:J → **single:2{2H}** [followUp,strongBeforeLast,forceFinish:likely]<br>手牌: 2H 9S 9C
- `self|281600660|75` 座0 3张 敌最少4 对家3 级10 上手=pair:8 → **pair:K{KS KD}** [forceFinish:likely]<br>手牌: RJ KS KD

### 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌

旧口径（含拆炸/只有炸弹可压）：2/6 (33%)；其中不拆三张也能压：1/5 (20%)；只能拆三张才能压：1/1 (100%)

- `self|281600097|48` 座0 9张 敌最少3 对家16 级K 上手=pair:3 → **pass** [可压:pair:5{5C 5S} / pair:5{5C 5D} / pair:5{5S 5D}]<br>手牌: QS QH QC QD 10D 8S 5S 5C 5D
- `self|281600272|75` 座2 5张 敌最少3 对家13 级8 上手=single:3 → **pass** [可压:single:8{8C} / single:6{6H} / single:A{AS}]<br>手牌: 8H 8H 8C AS 6H

### 敌家都 ≥15 张时炸普通牌（占跟牌炸弹）

每副炸弹数（自对局，四人合计）：早 0.91 / 中 2.73 / 晚 2.15

- `self|281600002|63` 座2 12张 敌最少16 对家9 级9 上手=pairSeq:9 → **bomb:6{6H 6S 6C 9H}** [mustBomb]<br>手牌: 9H KS KH KD JS JD 8S 6S 6H 6C 4S 4C
- `self|281600135|39` 座1 24张 敌最少19 对家10 级7 上手=straight:8 → **bomb:5{5C 5H 5H 5S}** [mustBomb]<br>手牌: RJ RJ 7H 7C AH QS QS QC 9H 9H 9C 9D 8S 8C 8D 6H 6C 5S 5H 5H 5C 2S 2S 2C
- `self|281600341|74` 座3 10张 敌最少21 对家18 级3 上手=single:J → **bomb:J{JC JS JH JH}** [mustBomb]<br>手牌: JS JH JH JC 6C 5H 5H 5C 4S 4C
- `self|281600432|61` 座0 13张 敌最少20 对家7 级5 上手=pair:5 → **bomb:Q{QD QS QH QC}** [mustBomb]<br>手牌: RJ 5H AS AC AD AD QS QH QC QD 9S 9D 8H
- `self|281600658|81` 座2 9张 敌最少16 对家6 级8 上手=pair:7 → **bomb:5{5D 5C 5H 5H}** [mustBomb]<br>手牌: AS 9H 9H 9C 9D 5H 5H 5C 5D

### 敌家都 ≥10 张时领出炸弹（非走完）

炸压炸占跟牌炸弹：597/2080 (29%)

- `self|281600002|49` 座1 9张 敌最少12 对家22 级9 上手=pass → **bomb:3{3H 3D 3D 3C}** [bombClear,control]<br>手牌: 4S 4H 4C 4D 4D 3H 3C 3D 3D
- `self|281600118|84` 座3 9张 敌最少11 对家3 级6 上手=pass → **bomb:2{2S 2D 2H 2D}** [bombClear,control]<br>手牌: 6D 5S 5H 5C 5D 2S 2H 2D 2D
- `self|281600212|88` 座0 8张 敌最少10 对家0 级K 上手=pass → **bomb:7{7D 7H 7S KH}** [bombClear,control]<br>手牌: KH 10H 10H 10C 10D 7S 7H 7D
- `self|281600292|73` 座0 7张 敌最少13 对家14 级2 上手=pass → **bomb:9{9S 9S 9H 9D}** [bombClear,control]<br>手牌: 9S 9S 9H 9D 5H 5C 5D
- `self|281600372|64` 座0 10张 敌最少11 对家10 级4 上手=pass → **bomb:8{8H 8S 8S 8C}** [bombClear,control]<br>手牌: 4H 4H JS JH JC JC 8S 8S 8H 8C

### 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌

- `self|281600006|97` 座0 6张 敌最少2 对家0 级10 上手=single:Q → **pass** []<br>手牌: JS JH JH JC 7S 6H
- `self|281600052|65` 座1 8张 敌最少2 对家5 级K 上手=fullhouse:9 → **pass** []<br>手牌: KH KS AD 9S 7S 7S 7H 2C
- `self|281600114|62` 座2 8张 敌最少3 对家2 级A 上手=fullhouse:J → **pass** []<br>手牌: 8C 6S 5C 2S 2H 2C 2C 2D
- `self|281600291|46` 座2 18张 敌最少3 对家5 级A 上手=pair:K → **pass** []<br>手牌: AS KD JH JC 9S 9C 9D 7H 6C 5S 5H 5H 5D 4S 4C 4D 4D 3C
- `self|281600646|53` 座0 9张 敌最少2 对家9 级A 上手=pair:Q → **pass** []<br>手牌: BJ KS JH 10H 6S 6H 6C 6D 6D

### 输家结束时手里还留着炸弹（每个输家座位）

- `self|281600007` 座1 结束时手里：2D 2H 2S 2D
- `self|281600050` 座3 结束时手里：10H 10C 8S 10S 7H 7S JC JD JS JD
- `self|281600241` 座0 结束时手里：3C JH JC 7D 4C JC JD 3H 7H 4S 7H 7C
- `self|281600241` 座2 结束时手里：6S QS 8C QC QS QH 8H 6D
- `self|281600245` 座1 结束时手里：10H 4S KD KH 4C 4H KS AD 4D

### 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10）

- `self|281600019|11` 座1 26张 敌最少24 对家25 级10 上手=single:A → **single:10{10S}** [followUp,breakNoOrphan,followSize,keepControl,r50NextFollow]<br>手牌: RJ RJ 10H 10S 10D AH AC AD KC KD QH QC QD 9S 9C 9D 9D 6S 5S 5H 5D 3H 3H 2S 2S 2H
- `self|281600181|46` 座0 20张 敌最少6 对家7 级10 上手=single:A → **single:10{10D}** [followUp,breakNoOrphan,followSize,keepControlSoft,r28MidFollow]<br>手牌: 10D 10D AC AD AD KS KD QS QH QD QD JH 8S 5H 5C 5D 4C 3C 3D 2C
- `self|281600305|38` 座0 21张 敌最少15 对家19 级J 上手=pair:9 → **pair:J{JC JS}** [followSize,keepControlPair,r28MidFollow]<br>手牌: RJ JS JC AD QS QH QH QC 10C 9S 9H 9H 9D 8D 6S 6D 5H 5C 3S 3H 3D
- `self|281600497|47` 座2 21张 敌最少8 对家7 级10 上手=single:10 → **single:BJ{BJ}** [followUp,followSize,keepControlSoft,tempoTake,spareControl]<br>手牌: RJ BJ 10H 10S 10C KH QD JH JC JD 9H 6H 6C 6C 6D 5S 5D 4S 4H 4D 2H
- `self|281600629|14` 座3 25张 敌最少20 对家16 级10 上手=pair:K → **pair:10{10D 10C}** [followSize,keepControlPair,r50NextFollow]<br>手牌: 10C 10D KC KC KD 9S 9C 9C 8H 8C 8C 7C 6S 6H 6C 6D 5H 5C 5C 5D 4D 3S 3C 3C 2C

### 拆炸弹领出

- `self|281600150|12` 座1 16张 敌最少21 对家16 级7 上手=pass → **straight:A{10C JS QC KD AH}** [bombBreakNoGain,holdBombLead,control,planUnitFirst]<br>手牌: AH KD QS QS QC QD JS 10C 8S 8H 8C 8C 8D 4C 4D 3C
- `self|281600192|27` 座1 15张 敌最少13 对家13 级3 上手=pass → **straight:10{6S 7S 8H 9D 10C}** [bombBreakNoGain,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: RJ RJ BJ 3H 3H 3S 3D 10C 9D 8S 8H 8D 8D 7S 6S
- `self|281600279|12` 座3 17张 敌最少17 对家27 级6 上手=pass → **straight:10{6D 7H 8H 9C 10S}** [bombBreakNoGain,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: 6H 6D AS AH KS KH KH KD QH 10S 9C 8H 8C 8D 8D 7H 3C
- `self|281600342|72` 座3 9张 敌最少6 对家5 级5 上手=pass → **fullhouse:9{9S 9S 9H 8D 8H}** [leadSmallSame,control,offPlan,forceFinish:bombBack]<br>手牌: 5H 5H 9S 9S 9H 8H 8C 8D 8D
- `self|281600503|35` 座1 10张 敌最少13 对家23 级9 上手=pass → **fullhouse:5{5H 5D 5H 3C 3S}** [fhAttach,control,forceFinish:bombBack]<br>手牌: 9H AS 5S 5H 5H 5D 4S 3S 3C 2S

### 早盘拆对领单（手里有顺子/连对/钢板可出）

- `self|281600048|0` 座3 27张 敌最少27 对家27 级7 上手=pass → **single:2{2H}** [noFirstBomb,keepStruct,control,planWeakFirst]<br>手牌: 7H 7S 7C 7D AS AD QH QC QD JS JH 10S 10C 8H 8C 5H 5C 5C 5D 4S 4S 4C 4C 3S 2S 2H 2H
- `self|281600306|29` 座1 21张 敌最少17 对家21 级Q 上手=pass → **single:10{10D}** [control]<br>手牌: QS QC QD KC JD 10S 10D 9S 9C 9D 7D 6H 5S 4D 3S 3H 3H 3D 2H 2C 2D

### 早盘领出单张占比

早盘领出牌型分布：straight 22%，pairSeq 20%，single 16%，pair 15%，fullhouse 12%，tripleSeq 12%，triple 3%；熵 2.66 bit


### decide 用时 >300ms 的比例

p50 1.4ms，p90 16.4ms，p99 56.3ms，max 365.4ms

- `self|281600048|0` 座3 27张 敌最少27 对家27 级7 上手=pass → **single:2{2H}** [noFirstBomb,keepStruct,control,planWeakFirst]<br>手牌: 7H 7S 7C 7D AS AD QH QC QD JS JH 10S 10C 8H 8C 5H 5C 5C 5D 4S 4S 4C 4C 3S 2S 2H 2H

### 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）

全部通过


### 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸）

不分有无孤张：还的点数手里原有 ≥2 张 143/354 (40%)（有的是顺子里多出的一张，拆牌计划认为更便宜）；还 >10 的牌（手里没有 ≤10，兜底）：0/354 (0%)


### Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5

分类：无

