# 自对局体检报告

生成：2026/10/18 20:50:28（America/Toronto）　policy：post-selfplay-r7a　用时 641s

对局：自对局 1000 副（四家 decide），混合对手 Random、Greedy、Old:pre-activity、Old:pre-round6 各 200×2 副（换座位）；逐手记录 246905 条；surprise 局面 185 个。

局面 id 可复现：`node selfplay/audit.mjs --replay='<id>'`（cfg|seed|step）。

## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）

- **Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5**：11.9%（n=185，合理区间 ≤5%，严重度 9.5）
- **对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张时仍过牌**：74.2%（n=31，合理区间 ≤60%，严重度 0.8）

## 全部检测器

| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |
|---|---|---|---|---|---|
| 早中盘领出小单（≤10）后两个敌家都不跟 | 6.8% | 2796 | ≤25% | 10.2% | OK |
| 早中盘领出小对（≤10）后两个敌家都不跟 | 12.4% | 1046 | ≤35% | 21.0% | OK |
| 跟敌人牌过牌率（early，有牌可出时） | 50.8% | 18914 | ≥30 且 ≤62% | 49.8% | OK |
| 跟敌人牌过牌率（mid，有牌可出时） | 58.1% | 20871 | ≥30 且 ≤65% | 60.8% | OK |
| 跟敌人牌过牌率（late，有牌可出时） | 42.3% | 6720 | ≥20 且 ≤75% | 36.8% | OK |
| 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率 | 21.7% | 10613 | ≤35% | 27.8% | OK |
| 压对家的牌（early，有牌可压时） | 0.1% | 5863 | ≤15% | 0.0% | OK |
| 压对家的牌（mid，有牌可压时） | 0.2% | 7514 | ≤15% | 0.3% | OK |
| 压对家的牌（late，有牌可压时） | 11.5% | 2601 | ≤30% | 13.7% | OK |
| 炸对家（未因此走完） | 0.0% | 14818 | ≤2% | 0.0% | OK |
| 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张时仍过牌 | 74.2% | 31 | ≤60% | 45.5% | 🚩 |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 11.7% | 2145 | ≤15% | 14.3% | OK |
| 敌家都 ≥10 张时领出炸弹（非走完） | 4.4% | 4962 | ≤10% | 5.7% | OK |
| 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌 | 4.7% | 782 | ≤45% | 2.3% | OK |
| 输家结束时手里还留着炸弹（每个输家座位） | 5.6% | 2000 | ≤20% | 4.8% | OK |
| 输家结束时还握着 ≥2 张王/级牌 | 7.7% | 2000 | ≤25% | 8.5% | OK |
| 末游卡手（结束时 ≥8 张且至少还要 5 手） | 0.0% | 1000 | ≤25% | 0.0% | OK |
| 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10） | 0.6% | 5914 | ≤8% | 1.2% | OK |
| 早盘领出 A/级牌/王的单对 | 0.3% | 1234 | ≤12% | 2.8% | OK |
| 拆炸弹领出 | 0.6% | 15978 | ≤2% | 0.7% | OK |
| 早盘拆对领单（手里有顺子/连对/钢板可出） | 0.3% | 600 | ≤15% | 1.6% | OK |
| 早盘领出对子占比 | 12.4% | 3866 | ≥5% | 4.6% | OK |
| 早盘领出单张占比 | 19.5% | 3866 | ≥15 且 ≤55% | 72.6% | OK |
| 一手能出完却没出完 | 0.0% | 2685 | ≤1% | 0.0% | OK |
| decide 用时 >300ms 的比例 | 0.0% | 166533 | ≤0.5% | 0.0% | OK |
| 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测） | 0.000 | 2600 | ≤0 | 0.000 | OK |
| 对 Random 每副净升级 | 2.947 | 400 | ≥1.5 | 2.920 | OK |
| 对 Greedy 每副净升级 | 2.240 | 400 | ≥0.5 | 2.288 | OK |
| Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5 | 11.9% | 185 | ≤5% | 10.8% | 🚩 |

## 队伍结果

- 自对局 1000 副：南北队每副净升级 0.063 [-0.066, 0.192]（应≈0），双下率 29.9%，平均每副 93 手
- 各座位平均名次（南/东/北/西）：2.41 / 2.50 / 2.56 / 2.53
- decide vs Random：400 副，胜 397/400 (99%)，每副净升级 2.947 [2.910, 2.985]
- decide vs Greedy：400 副，胜 358/400 (90%)，每副净升级 2.240 [2.097, 2.383]
- decide vs Old:pre-activity：400 副，胜 311/400 (78%)，每副净升级 1.208 [1.033, 1.382]
- decide vs Old:pre-round6：400 副，胜 308/400 (77%)，每副净升级 1.282 [1.105, 1.460]

## 详情与示例局面

### 🚩 Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5

分类：enemy/late/passed 6，enemy/mid/passed 2，lead/early/otherPlay 2，enemy/early/otherPlay 2，lead/late/otherPlay 2，partner/mid/shouldPass 2，partner/mid/otherPlay 1，enemy/late/otherPlay 1，lead/mid/otherPlay 1，partner/early/shouldPass 1，partner/late/passed 1，partner/mid/passed 1

- `self|179|47` partner 19张 张数24/19/2/5 级Q 上手=pair:A<br>decide: **pair:Q{QS QD}** (-1.89) [keepStruct,blockLikely] vs **pair:Q{QS QH}** (+2.36, t=5.6, n=36)<br>手牌: JC QS QD JD QH RJ JS 10H 4S 10H 7D 10S 6S 7H JC 7D 6C 4S 10D
- `self|834|8` enemy 17张 张数27/27/17/22 级4 上手=fullhouse:A<br>decide: **pass** (0.03) [] vs **fullhouse:4{4D 9H 9S 4H 4H}** (+2.17, t=4.8, n=36)<br>手牌: 3H 3S 3C 6H 6D 4H 4H 6D 9H 3S QS 9S 4D 7H QC BJ 3C
- `self|590|0` lead 27张 张数27/27/27/27 级7 上手=pass<br>decide: **straight:9{5C 6H 7C 8H 9S}** (-0.69) [noFirstBomb,leadSmallSame,holdBombLead,control,planUnitFirst] vs **fullhouse:K{KC KC KH 3D 3D}** (+1.92, t=4.3, n=36)<br>手牌: 3D JS KC 5C 9S 8H 4C AD 7C 2H 4C 7S 6H 2S JD 9C 10D 3D 2C RJ KC 8D 8H 6S BJ KH 2D
- `self|480|39` enemy 20张 张数20/21/13/19 级A 上手=pair:3<br>decide: **pair:6{6H 6S}** (-0.14) [followSize,activeFollow:0] vs **pair:A{AH AH}** (+1.92, t=5.3, n=36)<br>手牌: 9H 10H 9S AH BJ 2H 3D 8H 6H 10H 2D 9C AH 6S 3C 10S 8H 3C 2S 8S
- `self|47|36` enemy 8张 张数20/8/25/12 级10 上手=single:3<br>decide: **single:9{9C}** (-0.92) [followUp,followSize] vs **single:7{7C}** (+1.78, t=4.7, n=36)<br>手牌: 2H 2S 7C 2C 10C 7D 9C 10H
- `self|256|70` lead 10张 张数0/1/10/3 级J 上手=pass<br>decide: **pair:K{KS KH}** (1.00) [shortEnemyShape,control] vs **single:3{3H}** (+1.72, t=22.7, n=36)<br>手牌: 3H JC KS KH 5H QD AD BJ BJ QC
- `self|560|50` enemy 7张 张数7/12/18/10 级3 上手=pair:K<br>decide: **pass** (1.22) [] vs **pair:3{3S 3D}** (+1.50, t=4.4, n=36)<br>手牌: JD JD 9C 9D 3S 3D JS
- `self|78|32` enemy 9张 张数12/9/20/20 级2 上手=single:A<br>decide: **pass** (1.03) [] vs **single:2{2H}** (+1.44, t=3.9, n=36)<br>手牌: 7D 2H BJ 7D 7H BJ 7H 9D 9S

### 🚩 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张时仍过牌

- `self|6|59` 座1 25张 敌最少1 对家5 级8 上手=pair:Q → **pass** [mustBomb]<br>手牌: 8H 8C AS KS QS QC QD JS JH JC JD 10S 10D 7S 7C 7C 7D 5S 3S 3H 3C 3D 2S 2H 2D
- `self|64|49` 座0 15张 敌最少1 对家8 级A 上手=pair:3 → **pass** [mustBomb]<br>手牌: RJ KH KC 10S 10H 10C 10C 7S 7S 7D 6H 6C 6C 6D 3H
- `self|98|39` 座3 15张 敌最少3 对家10 级9 上手=single:6 → **pass** []<br>手牌: RJ 9H 9H KH KC KD JH JD 10S 10D 5H 4S 4H 4C 3S
- `self|232|59` 座3 14张 敌最少3 对家9 级K 上手=single:8 → **pass** [noSFon8]<br>手牌: RJ KS KC AS AH AC 8S 8C 8C 8D 2S 2H 2D 2D
- `self|640|80` 座2 12张 敌最少3 对家6 级5 上手=single:8 → **pass** [noSFon8]<br>手牌: BJ QH QH QD 6D 4S 4C 2S 2S 2H 2D 2D

### 早中盘领出小单（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：186/189 (98%)

- `self|10|72` 座1 11张 敌最少10 对家0 级Q 上手=single:6 → **pass** []<br>手牌: QS QC JS JS JH JC JC 4S 4S 4C 4D
- `self|202|72` 座0 7张 敌最少9 对家15 级9 上手=single:10 → **pass** []<br>手牌: RJ BJ KS KD 5S 5C 5C
- `self|456|56` 座2 8张 敌最少12 对家16 级3 上手=single:7 → **pass** []<br>手牌: RJ 3S AS AH AC AD 6C 6D
- `self|632|53` 座0 11张 敌最少10 对家9 级10 上手=single:5 → **pass** []<br>手牌: BJ BJ 10H 5S 5C 4H 4C 4D 4D 3H 3D
- `self|814|42` 座3 13张 敌最少13 对家12 级10 上手=single:K → **pass** []<br>手牌: 10H 10D 7S 4S 4S 4H 4C 3C 3C 2S 2H 2D 2D

### 早中盘领出小对（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：128/130 (98%)

- `self|21|61` 座3 20张 敌最少9 对家0 级10 上手=pair:K → **pass** []<br>手牌: BJ 10S 10C 10D 10D JS JH 9H 9H 9C 9D 8D 7H 7C 7D 6S 6S 6C 6C 6D
- `self|234|36` 座0 12张 敌最少13 对家24 级2 上手=pair:3 → **pass** []<br>手牌: AH QH JS 10S 10H 10C 10D 7C 3S 3H 3C 3D
- `self|456|52` 座2 8张 敌最少13 对家16 级3 上手=pair:9 → **pass** []<br>手牌: RJ 3S AS AH AC AD 6C 6D
- `self|684|34` 座0 15张 敌最少14 对家17 级10 上手=pair:4 → **pass** []<br>手牌: 10H 10H 10C KD QH QC QC QD QD 9C 4C 3H 3H 3D 2C
- `self|854|69` 座3 13张 敌最少9 对家0 级J 上手=pair:7 → **pass** []<br>手牌: BJ 8H 8D 8D 7S 7S 7H 6S 6C 5D 5D 3D 3D

### 跟敌人牌过牌率（early，有牌可出时）

- `self|1|15` 座3 26张 敌最少20 对家20 级3 上手=single:A → **pass** []<br>手牌: 3H 3H 3S AS AH AD KH QH QC QC QD JD 10S 10C 8S 8C 7H 7C 7C 5S 5H 5C 4D 2S 2H 2H
- `self|205|24` 座1 20张 敌最少14 对家20 级Q 上手=single:A → **pass** []<br>手牌: BJ QS AS 10S 10H 10C 10D 9H 9C 9C 8S 8H 8H 8C 7S 7D 5S 5H 4D 2H
- `self|402|13` 座3 21张 敌最少20 对家26 级A 上手=single:K → **pass** []<br>手牌: BJ AH AD KS KH JS JH JD 10C 9H 9C 9C 8H 8D 6C 3H 2H 2H 2C 2D 2D
- `self|600|12` 座3 26张 敌最少22 对家24 级4 上手=pair:J → **pass** []<br>手牌: RJ RJ 4S 4C AH KS KC KD KD QC QD JC JC 10S 10H 10H 10D 9C 9D 7S 7H 6C 6D 5H 5C 5C
- `self|803|22` 座0 26张 敌最少10 对家22 级Q 上手=fullhouse:2 → **pass** []<br>手牌: QH QC QC QD KS KH KH KC KD JS JC 10H 10H 10D 10D 9S 9H 8C 7S 5H 4S 4D 3S 3C 2C 2D

### 跟敌人牌过牌率（mid，有牌可出时）

- `self|1|29` 座1 17张 敌最少16 对家25 级3 上手=pair:J → **pass** []<br>手牌: AS AC KH KD QS QH QD 9S 9H 9H 9D 9D 8C 7S 7H 7D 7D
- `self|217|58` 座3 11张 敌最少12 对家0 级J 上手=fullhouse:6 → **pass** []<br>手牌: RJ BJ BJ JH JH AC QH 7H 7C 7C 6H
- `self|427|32` 座0 19张 敌最少13 对家21 级K 上手=single:A → **pass** []<br>手牌: RJ RJ QH QC 10S 7S 7C 7C 7D 6S 6H 6C 5H 5C 5D 2S 2S 2C 2D
- `self|614|37` 座0 17张 敌最少13 对家26 级5 上手=pair:6 → **pass** []<br>手牌: RJ 5H 5S 5C KC QC JD 9S 8C 7H 7H 7C 7C 7D 7D 4C 3C
- `self|811|25` 座2 15张 敌最少9 对家26 级7 上手=single:BJ → **pass** []<br>手牌: RJ 7S QS QH 8S 8S 8H 8H 8C 8D 6H 5S 5C 4S 4C

### 跟敌人牌过牌率（late，有牌可出时）

- `self|3|36` 座2 6张 敌最少17 对家18 级5 上手=single:A → **pass** []<br>手牌: BJ BJ AS AC AD AD
- `self|191|59` 座2 9张 敌最少9 对家26 级J 上手=single:K → **pass** []<br>手牌: RJ BJ 9S 9H 9C 8S 8H 8C 8D
- `self|417|34` 座3 8张 敌最少9 对家20 级3 上手=single:A → **pass** []<br>手牌: RJ 3C 3C 10H 10H 10C 9S 8H
- `self|606|56` 座0 6张 敌最少13 对家13 级10 上手=single:5 → **pass** []<br>手牌: 10C 10D QS QH QD QD
- `self|800|62` 座2 9张 敌最少11 对家12 级9 上手=single:A → **pass** []<br>手牌: RJ 9H JS JH JH JD 6H 6C 5C

### 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率

按座位 南/东/北/西：606/2645 (23%) / 549/2675 (21%) / 575/2653 (22%) / 570/2640 (22%)

- `self|1|32` 座0 16张 敌最少17 对家21 级3 上手=pair:8 → **pass** []<br>手牌: RJ BJ JS JH 10H 10H 10C 9S 9C 8S 8H 8H 8D 6H 6C 6D
- `self|219|48` 座2 18张 敌最少7 对家19 级K 上手=pair:8 → **pass** []<br>手牌: RJ KH 9S 9H 9C 9D 8S 8C 8D 8D 7H 7D 7D 6H 3H 3C 2H 2D
- `self|447|60` 座3 11张 敌最少8 对家14 级7 上手=single:6 → **pass** []<br>手牌: RJ 5S 5S 5C 5D 5D 2S 2S 2C 2D 2D
- `self|632|49` 座0 11张 敌最少11 对家9 级10 上手=single:4 → **pass** []<br>手牌: BJ BJ 10H 5S 5C 4H 4C 4D 4D 3H 3D
- `self|818|38` 座3 11张 敌最少12 对家14 级A 上手=single:10 → **pass** []<br>手牌: RJ AH AS AC AC AD 9S 9C 8S 8D 5S

### 压对家的牌（early，有牌可压时）

- `self|763|67` 座1 22张 敌最少1 对家5 级J 上手=single:10 → **single:RJ{RJ}** [followUp,blockLikely]<br>手牌: RJ JH JD AC AD QS QS QH QC 9S 9D 8S 8C 8C 8D 6S 6C 6D 6D 5S 5H 4H
- `self|905|65` 座1 22张 敌最少2 对家9 级10 上手=single:J → **single:Q{QS}** [followUp]<br>手牌: 10S 10S 10C 10C QS JC 9S 9H 8H 8H 8C 8D 7S 7D 5H 5C 5C 5D 4D 3S 3H 2S
- `self|943|68` 座3 20张 敌最少2 对家8 级9 上手=single:A → **single:9{9H}** [followUp]<br>手牌: 9H 9H AH AC AD KS KH KC KD 8S 8D 7D 5S 5S 5C 5D 5D 3H 2S 2H

### 压对家的牌（mid，有牌可压时）

- `self|22|62` 座2 10张 敌最少5 对家11 级J 上手=fullhouse:3 → **fullhouse:4{4H 4S 4D 8D 8C}** []<br>手牌: JH JH 8H 8C 8D 8D 4S 4H 4D 4D
- `self|179|47` 座1 19张 敌最少2 对家5 级Q 上手=pair:A → **pair:Q{QS QD}** [keepStruct,blockLikely]<br>手牌: RJ QH QS QD JS JC JC JD 10S 10H 10H 10D 7H 7D 7D 6S 6C 4S 4S
- `self|407|44` 座3 11张 敌最少11 对家13 级6 上手=fullhouse:2 → **fullhouse:A{AC AS AD 6C 6D}** []<br>手牌: 6H 6C 6D AS AH AC AD KS KC QC QD
- `self|485|61` 座2 10张 敌最少9 对家19 级6 上手=fullhouse:2 → **fullhouse:8{8S 8S 8D KC KS}** []<br>手牌: 6H 6H KS KH KH KC 8S 8S 8D 8D
- `self|664|91` 座3 10张 敌最少8 对家5 级3 上手=fullhouse:9 → **fullhouse:J{JD JH JD 7D 7S}** []<br>手牌: 3H JS JH JD JD 7S 7H 7C 7C 7D

### 压对家的牌（late，有牌可压时）

- `self|7|85` 座2 2张 敌最少2 对家8 级9 上手=single:5 → **single:RJ{RJ}** [followUp,strongBeforeLast,forceFinish:sure]<br>手牌: RJ 7S
- `self|197|92` 座2 4张 敌最少1 对家1 级4 上手=single:4 → **bomb:7{7C 7D 7S 7D}**<br>手牌: 7S 7C 7D 7D
- `self|408|64` 座3 1张 敌最少14 对家18 级7 上手=single:2 → **single:K{KH}**<br>手牌: KH
- `self|587|101` 座1 3张 敌最少2 对家1 级4 上手=single:10 → **single:Q{QH}** [followUp,strongBeforeLast]<br>手牌: QH 8D 8D
- `self|779|56` 座0 7张 敌最少16 对家25 级A 上手=single:9 → **single:RJ{RJ}** [noSFon8,followUp,keepControlSoft,strongBeforeLast,forceFinish:bombBack]<br>手牌: RJ 10S 10S 10H 10H 10C 10D

### 敌家都 ≥15 张时炸普通牌（占跟牌炸弹）

每副炸弹数（自对局，四人合计）：早 0.30 / 中 1.88 / 晚 2.78

- `self|2|63` 座3 14张 敌最少18 对家0 级4 上手=pair:A → **bomb:K{KD KS KH KC KD}** [mustBomb]<br>手牌: RJ 4S KS KH KC KD KD 7S 7C 3C 2S 2S 2H 2D
- `self|174|73` 座0 10张 敌最少19 对家15 级7 上手=single:Q → **bomb:6{6S 6D 6C 6C 6S}** [mustBomb]<br>手牌: 9S 9H 9C 9D 6S 6S 6C 6C 6D 3C
- `self|370|72` 座0 12张 敌最少17 对家8 级8 上手=triple:2 → **bomb:3{3S 3C 3H 3D 3C}** [mustBomb]<br>手牌: RJ 8C QH 5S 5S 5H 5H 3S 3H 3C 3C 3D
- `self|570|42` 座1 17张 敌最少18 对家8 级K 上手=tripleSeq:7 → **straightFlush:9{5S 6S 7S 8S 9S}** [mustBomb]<br>手牌: AD QH QH QC QD 10H 10C 9S 8S 8D 7S 7C 6S 5S 5C 5D 2H
- `self|803|59` 座2 10张 敌最少15 对家11 级Q 上手=single:J → **bomb:J{JH JD JD JC}** [mustBomb]<br>手牌: AS AH AC AD JH JC JD JD 4S 3S

### 敌家都 ≥10 张时领出炸弹（非走完）

炸压炸占跟牌炸弹：1509/3654 (41%)

- `self|9|52` 座2 8张 敌最少19 对家21 级J 上手=pass → **bomb:6{6D 6C 6S 6D}** [holdBombLead,control,leadBombLate]<br>手牌: QS QS QD QD 6S 6C 6D 6D
- `self|282|84` 座2 8张 敌最少10 对家9 级J 上手=pass → **bomb:9{9C 9S 9H 9D}** [control,forceFinish:bombBack]<br>手牌: 10S 10C 10D 10D 9S 9H 9C 9D
- `self|459|75` 座1 12张 敌最少13 对家4 级6 上手=pass → **bomb:5{5S 5H 5S 5H}** [holdBombLead,control,leadBombLate]<br>手牌: QH QH QD QD 5S 5S 5H 5H 2S 2H 2C 2D
- `self|617|64` 座0 12张 敌最少14 对家12 级8 上手=pass → **bomb:6{6D 6C 6S 6S}** [control]<br>手牌: 8S 8C 10S 10H 10D 10D 9S 9D 6S 6S 6C 6D
- `self|799|72` 座0 12张 敌最少10 对家12 级8 上手=pass → **bomb:5{5C 5H 5H 5S}** [control]<br>手牌: KS KH KC KD 9H 9C 9D 9D 5S 5H 5H 5C

### 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌

- `self|14|63` 座3 14张 敌最少2 对家0 级3 上手=fullhouse:10 → **pass** []<br>手牌: 3H 3S 8S 8C 8D 7H 7D 6C 6D 2S 2H 2C 2C 2D
- `self|220|32` 座2 14张 敌最少2 对家18 级A 上手=fullhouse:7 → **pass** []<br>手牌: BJ AD QS QS JD 8S 5S 5S 5C 5D 4S 4H 4D 3S
- `self|444|85` 座3 6张 敌最少2 对家0 级4 上手=triple:6 → **pass** []<br>手牌: 10S 7H 5S 5S 5H 5C
- `self|579|62` 座2 8张 敌最少2 对家0 级9 上手=pair:10 → **pass** []<br>手牌: RJ BJ AC QD 5S 5S 5H 5D
- `self|775|42` 座2 11张 敌最少3 对家5 级10 上手=fullhouse:9 → **pass** []<br>手牌: BJ 10H 10C QH 9H 8D 7H 7H 7C 7D 5H

### 输家结束时手里还留着炸弹（每个输家座位）

- `self|3` 座3 结束时手里：9D 9C 5D 9H QC 9S 6S QH
- `self|6` 座1 结束时手里：JC JD JH JS 2H
- `self|15` 座1 结束时手里：4S 6H RJ 6C 6H 6D AH 9D
- `self|25` 座3 结束时手里：QH AS 9D QH 4C QD 5H 5H 9D 8C QS 4D 8S 10D QS
- `self|31` 座1 结束时手里：10C 8H AC 4D 8S KC 8D 5S 5D KH 3S 5C 7C 4H 9H 8C 8C 8H 8D AC 9C KD 9H 10S

### 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10）

- `self|24|75` 座2 20张 敌最少2 对家0 级K 上手=pair:7 → **pair:K{KC KD}** [stopShort,followSize]<br>手牌: BJ KH KC KD 10H 10H 10D 10D 9S 9H 9H 6S 6S 6C 6D 5H 5C 5C 5D 4C
- `self|241|70` 座3 22张 敌最少21 对家9 级9 上手=single:8 → **single:9{9D}** [noSFon8,stopShort,followUp,followSize]<br>手牌: 9H 9D AD 10S 10H 10D 8C 8D 8D 6S 6C 6D 5S 5S 5H 5D 4D 4D 2S 2H 2H 2D
- `self|355|31` 座2 26张 敌最少2 对家17 级6 上手=pair:5 → **pair:6{6S 6H}** [stopShort,followSize]<br>手牌: RJ BJ 6H 6S AD KS KH KH JH JC JC JD 10S 10D 10D 9S 9H 7S 7S 7D 5S 5C 4H 4D 4D 2D
- `self|619|61` 座2 24张 敌最少10 对家8 级10 上手=single:9 → **single:BJ{BJ}** [noSFon8,stopShort,followUp,followSize]<br>手牌: BJ BJ 10H 10C AS AH AH AC QH JS JH JD 8S 8H 8D 6S 6H 6D 3S 3S 3C 2S 2H 2H
- `self|763|67` 座1 22张 敌最少1 对家5 级J 上手=single:10 → **single:RJ{RJ}** [followUp,blockLikely]<br>手牌: RJ JH JD AC AD QS QS QH QC 9S 9D 8S 8C 8C 8D 6S 6C 6D 6D 5S 5H 4H

### 早盘领出 A/级牌/王的单对

- `self|258|37` 座1 20张 敌最少15 对家11 级K 上手=pass → **single:A{AS}** [control]<br>手牌: RJ KC KD AS JC JD 9S 9C 7S 7H 7C 7D 6C 6D 5S 5H 2S 2H 2C 2C
- `self|315|12` 座3 25张 敌最少25 对家25 级5 上手=pass → **pair:5{5S 5C}** [control,planKeepControl]<br>手牌: 5S 5C AS AD QH QD JS JH JC JD 10H 10C 9H 9D 8S 8S 8C 8C 8D 7S 7C 3S 3D 2H 2C
- `self|615|17` 座3 24张 敌最少18 对家26 级6 上手=pass → **single:A{AS}** [control]<br>手牌: 6H 6S 6S 6C AS QC QD JC JD 8S 8H 8H 8C 8D 4C 4D 3C 3D 2S 2S 2H 2C 2C 2D
- `self|822|36` 座3 20张 敌最少14 对家10 级5 上手=pass → **single:RJ{RJ}** [control,planKeepControl]<br>手牌: RJ JS JC JC JD 10S 10D 9H 9C 8S 8H 8H 8C 8D 7H 7C 2S 2H 2C 2C

### 拆炸弹领出

- `self|9|44` 座2 12张 敌最少19 对家21 级J 上手=pass → **triple:J{JS JD JS}** [bombBreakNoGain,leadSmallSame,control,offPlan]<br>手牌: JS JS JC JD QS QS QD QD 6S 6C 6D 6D
- `self|173|6` 座1 22张 敌最少22 对家22 级6 上手=pass → **straight:10{6S 7D 8D 9C 10D}** [bombBreakNoGain,holdBombLead,control,planUnitFirst]<br>手牌: BJ BJ 6S AS AS AH AD QC JH JC 10D 9C 8S 8S 8C 8D 7D 4H 4D 3S 3C 3D
- `self|491|44` 座2 8张 敌最少15 对家25 级Q 上手=pass → **pairSeq:8{6H 6S 7S 7C 8S 8C}** [holdBombLead,control,offPlan]<br>手牌: 8S 8H 8C 8D 7S 7C 6S 6H
- `self|637|53` 座0 11张 敌最少11 对家18 级2 上手=pass → **pair:4{4S 4D}** [control,offPlan]<br>手牌: 2H 2H 2C AS AC AC AD 4S 4H 4H 4D
- `self|807|65` 座1 8张 敌最少10 对家14 级3 上手=pass → **pairSeq:J{9C 9D 10S 10C JS JC}** [holdBombLead,control,offPlan]<br>手牌: JS JC 10S 10C 9S 9H 9C 9D

### 早盘拆对领单（手里有顺子/连对/钢板可出）

- `self|500|90` 座3 24张 敌最少2 对家0 级8 上手=pass → **single:Q{QD}** [vsTwoSingle,control,offPlan]<br>手牌: 8S 8C AS AD KS KS KC KD QH QD JS JC JC JD 10S 10H 7S 7H 7C 7C 4S 4S 4H 4D
- `self|903|0` 座0 27张 敌最少27 对家27 级8 上手=pass → **single:10{10D}** [noFirstBomb,control]<br>手牌: 8H 8C 8D AS AH AD KS KH KD QS QC JH 10H 10D 9H 7C 7D 6H 6H 6C 6D 5D 4D 3D 3D 2S 2D

### 早盘领出单张占比

早盘领出牌型分布：straight 21%，single 20%，pairSeq 17%，fullhouse 16%，pair 12%，tripleSeq 10%，triple 4%；熵 2.68 bit


### decide 用时 >300ms 的比例

p50 1.8ms，p90 19.4ms，p99 53.5ms，max 1294.1ms

- `vsOld:pre-activity0|200123|97` 座0 13张 敌最少2 对家0 级3 上手=fullhouse:7 → **bomb:J{JS JH JC JD JS 3H}** [noWasteJ,forceFinish:likely]<br>手牌: RJ 3H 3H KS KS KC KC KD JS JS JH JC JD
- `self|921|101` 座1 16张 敌最少6 对家0 级K 上手=fullhouse:2 → **bomb:9{9D 9C 9H 9D}** [noWasteJ,mustBomb]<br>手牌: RJ RJ KH KH 9H 9C 9D 9D 7H 7D 6H 6C 5H 5C 5D 5D
- `self|541|0` 座1 27张 敌最少27 对家27 级10 上手=pass → **pairSeq:5{3H 3S 4H 4C 5D 5C}** [noFirstBomb,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: 10H 10C 10C 10D KD QH JS JH JC 9H 9D 8S 7S 7C 6H 6D 6D 5C 5D 4H 4C 3S 3H 2H 2H 2C 2D
- `vsOld:pre-round60|200071|0` 座2 27张 敌最少27 对家27 级3 上手=pass → **pairSeq:A{QH QD KS KC AD AC}** [noFirstBomb,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: BJ 3H AC AD KS KC QH QD JS JH 10S 10H 9S 9H 9D 8S 8C 8C 8D 7H 7C 7D 6C 6D 5C 5C 5D
- `vsOld:pre-activity0|200131|0` 座2 27张 敌最少27 对家27 级J 上手=pass → **straight:7{3D 4H 5H 6D 7D}** [noFirstBomb,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: RJ JH JS JC JD KS KH KD QS QC 10C 9H 8S 8H 8C 7S 7D 6H 6D 5H 4H 3S 3C 3D 2H 2C 2C

### 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）

全部通过

