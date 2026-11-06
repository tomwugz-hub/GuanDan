# 自对局体检报告

生成：2026/10/27 08:36:32（Asia/Shanghai）　policy：current　用时 202s

对局：自对局 300 副（四家 decide），混合对手 Random、Greedy、Old:pre-activity、Old:pre-round6 各 60×2 副（换座位）；逐手记录 69426 条；surprise 局面 60 个。

局面 id 可复现：`node selfplay/audit.mjs --replay='<id>'`（cfg|seed|step）。

## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）

- **Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5**：6.7%（n=60，合理区间 ≤5%，严重度 1.8）

## 全部检测器

| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |
|---|---|---|---|---|---|
| 早中盘领出小单（≤10）后两个敌家都不跟 | 1.4% | 797 | ≤25% | 6.6% | OK |
| 早中盘领出小对（≤10）后两个敌家都不跟 | 4.0% | 272 | ≤35% | 11.9% | OK |
| 跟敌人牌过牌率（early，有牌可出时） | 42.8% | 5124 | ≥30 且 ≤62% | 52.0% | OK |
| 跟敌人牌过牌率（mid，有牌可出时） | 41.0% | 5664 | ≥30 且 ≤65% | 56.5% | OK |
| 跟敌人牌过牌率（late，有牌可出时） | 30.9% | 2443 | ≥20 且 ≤75% | 38.1% | OK |
| 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率 | 6.4% | 2633 | ≤35% | 20.5% | OK |
| 压对家的牌（early，有牌可压时） | 0.0% | 1394 | ≤15% | 0.0% | OK |
| 压对家的牌（mid，有牌可压时） | 0.2% | 1526 | ≤15% | 0.2% | OK |
| 压对家的牌（late，有牌可压时） | 16.1% | 746 | ≤30% | 12.1% | OK |
| 炸对家（未因此走完） | 0.0% | 3235 | ≤2% | 0.0% | OK |
| 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌 | 58.8% | 17 | ≤60% | 62.1% | 样本少 |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 2.2% | 1022 | ≤15% | 15.7% | OK |
| 敌家都 ≥10 张时领出炸弹（非走完） | 1.2% | 1622 | ≤10% | 6.9% | OK |
| 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌 | 6.3% | 159 | ≤45% | 3.2% | OK |
| 输家结束时手里还留着炸弹（每个输家座位） | 4.3% | 600 | ≤20% | 6.8% | OK |
| 输家结束时还握着 ≥2 张王/级牌 | 3.5% | 600 | ≤25% | 7.3% | OK |
| 末游卡手（结束时 ≥8 张且至少还要 5 手） | 0.0% | 300 | ≤25% | 0.0% | OK |
| 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10） | 1.4% | 1613 | ≤8% | 1.5% | OK |
| 早盘领出 A/级牌/王的单对 | 0.0% | 306 | ≤12% | 0.5% | OK |
| 拆炸弹领出 | 0.2% | 3897 | ≤2% | 0.3% | OK |
| 早盘拆对领单（手里有顺子/连对/钢板可出） | 0.0% | 157 | ≤15% | 0.7% | OK |
| 早盘领出对子占比 | 12.7% | 990 | ≥5% | 12.1% | OK |
| 早盘领出单张占比 | 18.2% | 990 | ≥15 且 ≤55% | 18.7% | OK |
| 一手能出完却没出完 | 0.0% | 777 | ≤1% | 0.0% | OK |
| decide 用时 >300ms 的比例 | 0.0% | 46817 | ≤0.5% | 0.0% | OK |
| 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测） | 0.000 | 780 | ≤0 | 0.000 | OK |
| 对 Random 每副净升级 | 2.967 | 120 | ≥1.5 | 2.908 | OK |
| 对 Greedy 每副净升级 | 2.483 | 120 | ≥0.5 | 2.422 | OK |
| Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5 | 6.7% | 60 | ≤5% | 8.8% | 🚩 |

## 队伍结果

- 自对局 300 副：南北队每副净升级 -0.123 [-0.369, 0.122]（应≈0），双下率 38.3%，平均每副 89 手
- 各座位平均名次（南/东/北/西）：2.48 / 2.46 / 2.59 / 2.47
- decide vs Random：120 副，胜 120/120 (100%)，每副净升级 2.967 [2.927, 3.006]
- decide vs Greedy：120 副，胜 112/120 (93%)，每副净升级 2.483 [2.260, 2.707]
- decide vs Old:pre-activity：120 副，胜 108/120 (90%)，每副净升级 1.758 [1.516, 2.001]
- decide vs Old:pre-round6：120 副，胜 107/120 (89%)，每副净升级 1.858 [1.632, 2.084]

## 详情与示例局面

### 🚩 Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5

分类：lead/early/otherPlay 1，enemy/late/passed 1，lead/mid/otherPlay 1，lead/late/otherPlay 1

- `self|177|4` lead 21张 张数21/27/27/27 级10 上手=pass<br>decide: **tripleSeq:K{QH QS QC KD KS KC}** (-1.11) [leadSmallSame,keepShape,control,offPlan] vs **fullhouse:3{3C 3S 3H 2S 2H}** (+1.50, t=3.3, n=36)<br>手牌: QH 7H 5D 2S 3C QS KD KS 2H QC 4D 5D 10H 4H RJ 3S KC BJ 3H AS 6C
- `self|79|73` enemy 8张 张数7/8/12/6 级3 上手=single:3<br>decide: **pass** (0.47) [] vs **bomb:6{6H 6S 6C 6D}** (+1.25, t=3.6, n=36)<br>手牌: 3C 3S 6H 6S 3C 6C 3D 6D
- `self|228|33` lead 14张 张数26/16/14/11 级9 上手=pass<br>decide: **single:8{8C}** (0.64) [holdBombLead,smallFirst,control] vs **pair:5{5S 5C}** (+0.97, t=2.6, n=36)<br>手牌: 5S 4D 3H 4C 3H RJ 4D KC 4H QD 8C QC 4H 5C
- `self|120|55` lead 8张 张数7/15/17/8 级5 上手=pass<br>decide: **single:6{6S}** (1.33) [holdBombLead,smallFirst,control,planWeakFirst] vs **triple:J{JH JC JC}** (+0.81, t=2.8, n=36)<br>手牌: JH 6S 7H 7C 7C 7H JC JC

### 早中盘领出小单（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：11/11 (100%)

- `self|7|75` 座0 6张 敌最少9 对家10 级9 上手=single:6 → **pass** []<br>手牌: JS JH JC JD 6H 6D
- `self|63|60` 座3 11张 敌最少11 对家12 级K 上手=single:8 → **pass** [noSFon8]<br>手牌: 7S 7D 7D 6S 6H 6C 6C 5H 5D 5D 4C
- `self|67|52` 座0 11张 敌最少11 对家9 级4 上手=single:3 → **pass** []<br>手牌: 4H 6H 6H 6C 6D 3S 3S 3C 3C 2D 2D
- `self|134|67` 座3 7张 敌最少3 对家0 级6 上手=single:3 → **pass** []<br>手牌: KC KD QC QD 3S 3H 3D
- `self|267|50` 座0 19张 敌最少9 对家11 级9 上手=single:10 → **pass** []<br>手牌: 9H 9S 9C QS QH QC JS JC JD 8S 8D 8D 7S 7C 4S 4S 2S 2H 2D

### 早中盘领出小对（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：11/11 (100%)

- `self|25|59` 座0 9张 敌最少8 对家8 级A 上手=pair:2 → **pass** []<br>手牌: 10S 10C 8S 8D 8D 3S 3H 3C 3D
- `self|39|47` 座3 11张 敌最少10 对家15 级2 上手=pair:10 → **pass** []<br>手牌: 10S 10S 10D 9C 9D 9D 8D 3S 3C 3C 3D
- `self|84|69` 座3 9张 敌最少9 对家11 级8 上手=pair:10 → **pass** []<br>手牌: 8C 9S 7S 7H 7D 7D 3S 3C 2S
- `self|170|84` 座2 9张 敌最少9 对家12 级3 上手=pair:10 → **pass** []<br>手牌: 3S 3C 3C 3D 9C 2S 2S 2H 2C
- `self|180|87` 座2 9张 敌最少8 对家9 级K 上手=pair:10 → **pass** []<br>手牌: KH 7S 7H 7D 7D 6S 5S 5S 5C

### 跟敌人牌过牌率（early，有牌可出时）

- `self|1|15` 座3 26张 敌最少20 对家20 级3 上手=single:A → **pass** []<br>手牌: 3H 3H 3S AS AH AD KH QH QC QC QD JD 10S 10C 8S 8C 7H 7C 7C 5S 5H 5C 4D 2S 2H 2H
- `self|53|37` 座2 20张 敌最少8 对家4 级3 上手=straight:7 → **pass** []<br>手牌: 3H AH AC KS KS KC KC QS 10S 7S 7S 7H 7D 6S 6H 6D 5S 5H 5C 2C
- `self|116|15` 座2 25张 敌最少19 对家20 级A 上手=fullhouse:9 → **pass** []<br>手牌: AH AH AC QS QD JC 10D 9S 9H 8S 8C 8C 8D 7S 7D 6S 6S 6C 6C 6D 4H 4D 3C 2S 2D
- `self|171|15` 座2 25张 敌最少14 对家25 级4 上手=pair:10 → **pass** []<br>手牌: RJ 4S 4C 4D KD QC QD QD JS JH JC 10C 8H 8H 8D 7H 6S 6D 5S 5H 5D 3H 2S 2H 2C
- `self|234|30` 座2 22张 敌最少15 对家12 级2 上手=triple:10 → **pass** []<br>手牌: 2H 2H 2C 2D AC QS QH QC QD JD 10S 8C 8D 7H 7H 7C 7D 7D 6S 6H 4H 3D

### 跟敌人牌过牌率（mid，有牌可出时）

- `self|2|60` 座0 10张 敌最少5 对家19 级4 上手=fullhouse:9 → **pass** []<br>手牌: AD AD 10S 10S 10C 10C 9C 7C 7D 7D
- `self|60|23` 座2 10张 敌最少7 对家22 级10 上手=fullhouse:6 → **pass** [r14NoPass]<br>手牌: 10H KH QC JD JD 8D 5H 4C 4C 4D
- `self|120|70` 座2 15张 敌最少7 对家7 级5 上手=single:K → **pass** []<br>手牌: 5S 5C QH QH QD 7S 6S 6H 6C 6C 6D 4C 4D 3S 3D
- `self|180|62` 座1 16张 敌最少9 对家8 级K 上手=triple:J → **pass** []<br>手牌: KC AH AD QS QH QC QC 10H 10C 6H 3H 3H 2H 2H 2C 2D
- `self|248|41` 座2 18张 敌最少9 对家7 级3 上手=single:K → **pass** []<br>手牌: 3S 3S 3C KS KS KH KC KD 9S 9H 8S 8H 8D 4S 4C 4D 2S 2H

### 跟敌人牌过牌率（late，有牌可出时）

- `self|7|75` 座0 6张 敌最少9 对家10 级9 上手=single:6 → **pass** []<br>手牌: JS JH JC JD 6H 6D
- `self|67|66` 座2 9张 敌最少11 对家11 级4 上手=single:K → **pass** []<br>手牌: 4S 4S 4C 4D 7H 7C 3H 3H 3D
- `self|116|45` 座0 5张 敌最少11 对家14 级A 上手=single:9 → **pass** [noSFon8]<br>手牌: 10S 10H 10H 10C 8H
- `self|172|70` 座0 5张 敌最少4 对家3 级5 上手=single:9 → **pass** [noSFon8]<br>手牌: 10S 10C 10C 10D 7D
- `self|246|58` 座3 7张 敌最少12 对家11 级A 上手=single:9 → **pass** [noSFon8]<br>手牌: JH JC JD JD 10S 10H 10C

### 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率

按座位 南/东/北/西：44/649 (7%) / 43/676 (6%) / 38/651 (6%) / 43/657 (7%)

- `self|7|53` 座2 10张 敌最少10 对家12 级9 上手=single:8 → **pass** [noSFon8]<br>手牌: 9H 7S 7S 7C 5S 5C 5D 5D 3C 3C
- `self|57|70` 座1 19张 敌最少9 对家5 级7 上手=single:6 → **pass** []<br>手牌: 7H 7H AS AC QS QS QH QC 9S 9H 9C 9C 9D 5D 4D 3D 3D 2C 2D
- `self|125|43` 座0 10张 敌最少13 对家17 级10 上手=single:A → **pass** []<br>手牌: 10S 10S 10D 10D JD 9S 9D 8S 8H 8D
- `self|177|22` 座2 23张 敌最少21 对家9 级10 上手=pair:A → **pass** []<br>手牌: RJ BJ 10S 10D AS AH AD JS JD 8C 7S 7H 7C 7D 6S 6D 4S 4C 4C 3C 2H 2C 2D
- `self|234|62` 座2 15张 敌最少7 对家10 级2 上手=pair:5 → **pass** []<br>手牌: 2H 2H AC QS QH QC QD JD 7H 7H 7C 7D 7D 4H 3D

### 压对家的牌（mid，有牌可压时）

- `self|4|62` 座3 12张 敌最少2 对家2 级6 上手=single:A → **single:RJ{RJ}** [followUp]<br>手牌: RJ BJ BJ AS AD QH QC 8C 8D 4H 4C 4D
- `self|94|52` 座0 11张 敌最少11 对家12 级5 上手=fullhouse:2 → **fullhouse:5{5D 5C 5S QC QC}** [forceFinish:bombBack]<br>手牌: 5H 5H 5S 5C 5D QC QC 3H 3C 3D 3D
- `self|296|113` 座1 12张 敌最少1 对家0 级Q 上手=single:5 → **single:6{6D}** [keepStruct,followUp]<br>手牌: 9S 9S 9H 9C 9D 6C 6D 6D 5S 5D 5D 4S

### 压对家的牌（late，有牌可压时）

- `self|3|78` 座0 1张 敌最少2 对家0 级5 上手=single:Q → **single:RJ{RJ}** [goOut]<br>手牌: RJ
- `self|61|87` 座3 4张 敌最少4 对家1 级J 上手=pair:8 → **bomb:6{6H 6C 6S 6S}** [goOut]<br>手牌: 6S 6S 6H 6C
- `self|138|95` 座2 2张 敌最少1 对家1 级10 上手=single:8 → **single:Q{QH}** [noSFon8,followUp,strongBeforeLast,forceFinish:sure,blockSure]<br>手牌: KD QH
- `self|187|79` 座1 3张 敌最少1 对家0 级7 上手=single:8 → **single:J{JC}** [noSFon8,followUp,blockSure]<br>手牌: JC 9C 8C
- `self|240|89` 座1 5张 敌最少10 对家2 级8 上手=bomb:5 → **bomb:3{3S 3H 3H 3C 8H}** [goOut]<br>手牌: 8H 3S 3H 3H 3C

### 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌

旧口径（含拆炸/只有炸弹可压）：10/17 (59%)；其中不拆三张也能压：9/16 (56%)；只能拆三张才能压：1/1 (100%)

- `self|53|54` 座3 9张 敌最少3 对家5 级3 上手=pair:5 → **pass** [可压:pair:K{KH 3H} / pair:10{10S 10C} / pair:10{10S 3H}]<br>手牌: RJ 3H KH 10S 10C 9S 9C 9C 9D
- `self|107|69` 座0 9张 敌最少3 对家6 级5 上手=single:4 → **pass** [可压:single:5{5D} / single:BJ{BJ} / single:J{JD}]<br>手牌: BJ BJ 5D 5D QH QD JD 10S 10H
- `self|107|75` 座0 9张 敌最少3 对家4 级5 上手=single:7 → **pass** [可压:single:5{5D} / single:BJ{BJ} / single:J{JD}]<br>手牌: BJ BJ 5D 5D QH QD JD 10S 10H
- `self|179|63` 座1 16张 敌最少3 对家6 级Q 上手=pair:8 → **pass** [可压:pair:Q{QS QD} / pair:Q{QS QH} / pair:Q{QD QH}]<br>手牌: QH QS QD JS JC JC JD 10S 10H 10H 10D 7H 7D 6C 4S 4S
- `self|253|59` 座2 7张 敌最少3 对家9 级8 上手=single:2 → **pass** [可压:single:A{AC} / single:6{6H} / single:5{5C}]<br>手牌: 8S AC 6H 5H 5C 5C 2D

### 敌家都 ≥15 张时炸普通牌（占跟牌炸弹）

每副炸弹数（自对局，四人合计）：早 0.89 / 中 2.56 / 晚 1.96

- `self|1|63` 座2 18张 敌最少16 对家6 级3 上手=tripleSeq:2 → **bomb:4{4S 4C 4S 4D}** [mustBomb]<br>手牌: RJ BJ 3C KC KD 10S 10D 10D 6H 6C 6D 5S 5C 4S 4S 4H 4C 4D
- `self|39|71` 座3 11张 敌最少16 对家3 级2 上手=single:RJ → **bomb:3{3C 3S 3D 3C}** [mustBomb]<br>手牌: 10S 10S 10D 9C 9D 9D 8D 3S 3C 3C 3D
- `self|52|56` 座1 13张 敌最少17 对家5 级2 上手=fullhouse:J → **bomb:K{KS KC KS KC}** [noWasteJ,mustBomb]<br>手牌: 2H AS AC AD AD KS KS KC KC 9H 9C 9C 7C
- `self|121|68` 座1 9张 敌最少15 对家3 级6 上手=pair:5 → **bomb:5{5H 5C 5S 5H}** [mustBomb,forceFinish:likely]<br>手牌: 6C 6D QH QC QD 5S 5H 5H 5C
- `self|249|54` 座1 14张 敌最少21 对家4 级4 上手=fullhouse:K → **bomb:3{3D 3H 3H 3C}** [noWasteJ,mustBomb]<br>手牌: 4H 4S 4C 10S 10H 10C 10D 6S 6D 6D 3H 3H 3C 3D

### 敌家都 ≥10 张时领出炸弹（非走完）

炸压炸占跟牌炸弹：425/1447 (29%)

- `self|1|53` 座1 9张 敌最少10 对家22 级3 上手=pass → **bomb:7{7H 7D 7D 7S}** [bombClear,control]<br>手牌: 9S 9H 9H 9D 9D 7S 7H 7D 7D
- `self|51|48` 座1 12张 敌最少15 对家17 级A 上手=pass → **bomb:3{3S 3C 3D 3H}** [bombClear,control]<br>手牌: AH AS AD 5S 5S 5H 5D 5D 3S 3H 3C 3D
- `self|109|54` 座1 10张 敌最少13 对家21 级7 上手=pass → **bomb:6{6D 6S 6D 6H}** [bombClear,control,bombOversize]<br>手牌: 7D 6S 6H 6D 6D 2S 2H 2C 2C 2D
- `self|182|63` 座0 7张 敌最少19 对家19 级2 上手=pass → **bomb:K{KS KD KD KC}** [bombClear,control]<br>手牌: KS KC KD KD 9S 9C 9D
- `self|266|65` 座3 9张 敌最少12 对家19 级8 上手=pass → **bomb:A{AH AS AH AD}** [bombClear,control]<br>手牌: AS AH AH AD 3S 3H 3C 3D 3D

### 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌

- `self|35|90` 座1 12张 敌最少2 对家0 级J 上手=pair:K → **pass** []<br>手牌: RJ 7S 7C 6S 6H 6C 6C 6D 4S 4H 4C 4D
- `self|119|75` 座1 6张 敌最少3 对家19 级4 上手=pair:Q → **pass** []<br>手牌: 9S 9H 9C 9D 5S 3H
- `self|202|45` 座1 7张 敌最少2 对家26 级9 上手=fullhouse:5 → **pass** []<br>手牌: AH 8H 8C 8C 8D 7H 5D
- `self|234|64` 座0 10张 敌最少2 对家15 级2 上手=fullhouse:J → **pass** []<br>手牌: QH JS 10S 10H 10C 10D 3S 3H 3C 3D
- `self|259|41` 座0 11张 敌最少3 对家21 级A 上手=fullhouse:10 → **pass** []<br>手牌: KH QS QD 10H 10D 7S 7D 3S 3S 3H 3D

### 输家结束时手里还留着炸弹（每个输家座位）

- `self|9` 座1 结束时手里：JH QC 6S 3C 3S 3S
- `self|9` 座3 结束时手里：9D 10C 10S 10H 8D KD 10H
- `self|27` 座2 结束时手里：4H 4C 4H 4D
- `self|77` 座0 结束时手里：10D AH AD QC QS 10S QS 7S QC 10C
- `self|79` 座0 结束时手里：8H KD KD KC KH KC 7D

### 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10）

- `self|7|21` 座2 20张 敌最少18 对家16 级9 上手=pair:7 → **pair:9{9S 9C}** [followSize,keepControlPair,r28MidFollow]<br>手牌: RJ 9H 9S 9S 9C KH QH JD 10C 7S 7S 7C 6C 5S 5C 5D 5D 3C 3C 2H
- `self|99|52` 座0 20张 敌最少5 对家4 级10 上手=single:K → **single:BJ{BJ}** [followUp,breakNoOrphan,followSize,keepControlSoft,tempoTake,r28MidFollow]<br>手牌: BJ BJ 10S 10S KS 9S 9C 9C 8S 8C 7D 6S 6S 6C 5C 5D 2S 2H 2C 2D
- `self|137|29` 座1 20张 敌最少16 对家13 级9 上手=pair:7 → **pair:9{9C 9C}** [followSize,keepControlPair,r28MidFollow]<br>手牌: RJ 9C 9C AC 10S 10C 10C 10D 8S 8S 8H 8C 8D 7C 4S 4S 4C 2S 2H 2D
- `self|191|64` 座0 24张 敌最少11 对家3 级J 上手=single:4 → **single:RJ{RJ}** [stopShort,followUp,followSize]<br>手牌: RJ JS JD AD AD KH KC QS QH 10S 10H 10D 10D 7S 7H 7D 6S 6H 5C 5C 4S 4H 2S 2C
- `self|215|17` 座1 22张 敌最少16 对家14 级9 上手=pair:10 → **pair:9{9C 9D}** [followSize,keepControlPair,r28MidFollow]<br>手牌: BJ 9H 9H 9C 9D KH KC KD KD QH JC 8S 7H 7H 6H 6C 4H 4D 3H 3C 2S 2H

### 拆炸弹领出

- `self|157|23` 座3 22张 敌最少10 对家12 级3 上手=pass → **straight:8{4S 5D 6C 7H 8S}** [bombBreakNoGain,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: BJ 3H 3H 3C AH AD KH KC 10H 10C 10D 10D 9H 8S 7H 6C 5C 5C 5D 5D 4S 2D
- `self|173|6` 座1 22张 敌最少22 对家22 级6 上手=pass → **straight:10{6S 7D 8D 9C 10D}** [bombBreakNoGain,holdBombLead,control,planUnitFirst]<br>手牌: BJ BJ 6S AS AS AH AD QC JH JC 10D 9C 8S 8S 8C 8D 7D 4H 4D 3S 3C 3D
- `self|204|15` 座3 22张 敌最少16 对家15 级J 上手=pass → **straight:9{5C 6C 7S 8C 9S}** [bombBreakNoGain,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: RJ BJ AH AH AC AD AD KS KD QC QD 9S 8C 7S 7H 7C 7D 6C 5C 4S 4D 3C
- `self|220|11` 座1 18张 敌最少24 对家24 级A 上手=pass → **straight:10{6S 7S 8D 9S 10H}** [bombBreakNoGain,holdBombLead,control,planUnitFirst]<br>手牌: RJ AS KC QC QD 10H 9S 8D 7S 7C 7D 7D 6S 3S 3C 3D 2S 2S
- `self|237|43` 座2 17张 敌最少12 对家15 级5 上手=pass → **straight:8{4C 5S 6S 7H 8H}** [bombBreakNoGain,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: 5H 5S KS KD 10S 10H 10C 10D 9S 9H 8H 7S 7H 7C 7D 6S 4C

### 早盘领出单张占比

早盘领出牌型分布：pairSeq 21%，straight 20%，single 18%，fullhouse 14%，pair 13%，tripleSeq 12%，triple 3%；熵 2.66 bit


### decide 用时 >300ms 的比例

p50 1.4ms，p90 17.7ms，p99 56.6ms，max 476.2ms

- `vsRandom1|200059|64` 座3 13张 敌最少2 对家2 级4 上手=pair:6 → **pair:4{4H 4H}** [stopShort,winThen:pair,followSize,controlFeed:pair]<br>手牌: 4H 4H KS KH KC KD JS JD JD 9S 9C 9D 2S
- `self|121|46` 座3 16张 敌最少13 对家9 级6 上手=fullhouse:8 → **fullhouse:J{JD JS JC 8D 8C}** [fhAttach,r28MidFollow]<br>手牌: 6H 6H 6S 6S JS JC JD 10C 10D 9S 9S 9H 8C 8D 5D 2S

### 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）

全部通过

