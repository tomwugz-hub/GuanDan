# 自对局体检报告

生成：2026/10/18 11:25:54（America/Toronto）　policy：current　用时 909s

对局：自对局 1000 副（四家 decide），混合对手 Random、Greedy、Old:pre-activity、Old:pre-round6 各 200×2 副（换座位）；逐手记录 267849 条；surprise 局面 194 个。

局面 id 可复现：`node selfplay/audit.mjs --replay='<id>'`（cfg|seed|step）。

## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）

- **Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5**：13.9%（n=194，合理区间 ≤5%，严重度 12.4）
- **早盘领出单张占比**：72.6%（n=5629，合理区间 ≥15 且 ≤55%，严重度 1.2）
- **早盘领出对子占比**：4.6%（n=5629，合理区间 ≥5%，严重度 0.3）

## 全部检测器

| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |
|---|---|---|---|---|---|
| 早中盘领出小单（≤10）后两个敌家都不跟 | 10.1% | 5194 | ≤25% | 8.4% | OK |
| 早中盘领出小对（≤10）后两个敌家都不跟 | 20.6% | 814 | ≤35% | 27.1% | OK |
| 跟敌人牌过牌率（early，有牌可出时） | 49.8% | 29996 | ≥30 且 ≤62% | 49.8% | OK |
| 跟敌人牌过牌率（mid，有牌可出时） | 60.8% | 18824 | ≥30 且 ≤65% | 61.4% | OK |
| 跟敌人牌过牌率（late，有牌可出时） | 36.5% | 4919 | ≥20 且 ≤75% | 38.4% | OK |
| 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率 | 27.7% | 16063 | ≤35% | 25.6% | OK |
| 压对家的牌（early，有牌可压时） | 0.0% | 9115 | ≤15% | 0.0% | OK |
| 压对家的牌（mid，有牌可压时） | 0.3% | 6891 | ≤15% | 0.3% | OK |
| 压对家的牌（late，有牌可压时） | 13.6% | 1887 | ≤30% | 14.9% | OK |
| 炸对家（未因此走完） | 0.0% | 16659 | ≤2% | 0.0% | OK |
| 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张时仍过牌 | 47.8% | 23 | ≤60% | 44.0% | 样本少 |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 14.1% | 2104 | ≤15% | 14.3% | OK |
| 敌家都 ≥10 张时领出炸弹（非走完） | 5.8% | 4992 | ≤10% | 5.6% | OK |
| 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌 | 2.3% | 728 | ≤45% | 3.4% | OK |
| 输家结束时手里还留着炸弹（每个输家座位） | 4.5% | 2000 | ≤20% | 5.2% | OK |
| 输家结束时还握着 ≥2 张王/级牌 | 8.6% | 2000 | ≤25% | 8.1% | OK |
| 末游卡手（结束时 ≥8 张且至少还要 5 手） | 0.0% | 1000 | ≤25% | 0.0% | OK |
| 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10） | 1.2% | 13288 | ≤8% | 0.8% | OK |
| 早盘领出 A/级牌/王的单对 | 2.8% | 4345 | ≤12% | 0.7% | OK |
| 拆炸弹领出 | 0.7% | 17509 | ≤2% | 0.7% | OK |
| 早盘拆对领单（手里有顺子/连对/钢板可出） | 1.5% | 3324 | ≤15% | 0.0% | OK |
| 早盘领出对子占比 | 4.6% | 5629 | ≥5% | 1.6% | 🚩 |
| 早盘领出单张占比 | 72.6% | 5629 | ≥15 且 ≤55% | 69.9% | 🚩 |
| 一手能出完却没出完 | 0.0% | 2658 | ≤1% | 0.0% | OK |
| decide 用时 >300ms 的比例 | 0.0% | 182422 | ≤0.5% | 0.0% | OK |
| 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测） | 0.000 | 2600 | ≤0 | 0.000 | OK |
| 对 Random 每副净升级 | 2.920 | 400 | ≥1.5 | 2.925 | OK |
| 对 Greedy 每副净升级 | 2.288 | 400 | ≥0.5 | 2.277 | OK |
| Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5 | 13.9% | 194 | ≤5% | 8.7% | 🚩 |

## 队伍结果

- 自对局 1000 副：南北队每副净升级 -0.026 [-0.157, 0.105]（应≈0），双下率 30.7%，平均每副 104 手
- 各座位平均名次（南/东/北/西）：2.47 / 2.48 / 2.51 / 2.54
- decide vs Random：400 副，胜 395/400 (99%)，每副净升级 2.920 [2.873, 2.967]
- decide vs Greedy：400 副，胜 361/400 (90%)，每副净升级 2.288 [2.150, 2.425]
- decide vs Old:pre-activity：400 副，胜 308/400 (77%)，每副净升级 1.265 [1.102, 1.428]
- decide vs Old:pre-round6：400 副，胜 287/400 (72%)，每副净升级 1.103 [0.915, 1.290]

## 详情与示例局面

### 🚩 Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5

分类：enemy/late/passed 5，enemy/early/passed 3，partner/late/passed 3，partner/mid/shouldPass 2，enemy/mid/otherPlay 2，partner/late/shouldPass 2，lead/mid/otherPlay 2，lead/late/otherPlay 2，enemy/mid/passed 2，partner/early/otherPlay 1，partner/early/shouldPass 1，enemy/mid/shouldPass 1，enemy/late/otherPlay 1

- `self|223|85` partner 24张 张数7/22/24/1 级4 上手=single:6<br>decide: **single:RJ{RJ}** (-2.14) [followUp,blockLikely] vs **single:4{4H}** (+3.56, t=24.3, n=36)<br>手牌: JD 4H 8D 9C 9S 4S 2H RJ 7H AH JS AD QD 7S 8D QS 9C JH 4H 7D 7C QH 8C QD
- `self|810|53` enemy 7张 张数19/20/7/15 级6 上手=single:J<br>decide: **pass** (0.06) [] vs **single:BJ{BJ}** (+2.22, t=6.7, n=36)<br>手牌: 3H BJ BJ 4D 4D 3D 4C
- `self|544|65` partner 11张 张数1/8/19/11 级K 上手=single:K<br>decide: **single:BJ{BJ}** (-1.33) [followUp] vs **pass** (+2.08, t=5.2, n=36)<br>手牌: KS KD 4C KH 4S 4H 2C 2H 2S BJ 2C
- `self|302|46` enemy 20张 张数23/22/20/22 级5 上手=single:K<br>decide: **pass** (-0.25) [] vs **single:RJ{RJ}** (+1.69, t=4.4, n=36)<br>手牌: 6C 5H 3H 4S 3C JD 4H JC 2S 6D 3S 9C 6C RJ 2C 4C 9C 3D 3H 9H
- `self|560|66` partner 3张 张数3/19/20/15 级3 上手=single:K<br>decide: **pass** (0.33) [] vs **single:A{AD}** (+1.64, t=3.9, n=36)<br>手牌: AD AD AS
- `self|285|41` enemy 12张 张数13/21/18/12 级A 上手=single:5<br>decide: **single:7{7H}** (0.75) [followUp,breakNoOrphan,followSize,activeFollow:1] vs **single:A{AC}** (+1.56, t=4.5, n=36)<br>手牌: AC 6H 6C AH RJ 6C 4H 6H 7H 7S 4D 4C
- `self|797|52` enemy 7张 张数9/17/15/7 级6 上手=single:A<br>decide: **pass** (1.17) [] vs **single:BJ{BJ}** (+1.53, t=4.6, n=36)<br>手牌: BJ QD 4D BJ 4S 4H QC
- `self|631|14` enemy 26张 张数24/25/26/24 级9 上手=single:A<br>decide: **pass** (0.03) [] vs **single:9{9S}** (+1.44, t=4.0, n=36)<br>手牌: 3H 6H 7S 7C AS 7H AC 5S 3S AD BJ 4D 10S 6C 3S KD 10D 6D 9S 5H 5C 10H 5D 3H 2S 2C

### 🚩 早盘领出单张占比

早盘领出牌型分布：single 73%，fullhouse 11%，pairSeq 5%，pair 5%，tripleSeq 4%，triple 2%，straight 0%，bomb 0%；熵 1.44 bit


### 早中盘领出小单（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：526/526 (100%)

- `self|6|26` 座0 24张 敌最少22 对家17 级8 上手=single:10 → **pass** []<br>手牌: 8H 8S 8D AH AC AC AD KS KH QS QC JS JC JD 10S 10C 9C 9D 7S 7D 6D 4H 4D 3H
- `self|203|74` 座1 9张 敌最少8 对家16 级10 上手=single:5 → **pass** []<br>手牌: 10C 10D 9C 9D 9D 5S 5H 4S 4D
- `self|419|63` 座0 17张 敌最少15 对家21 级5 上手=single:8 → **pass** [noSFon8]<br>手牌: RJ RJ 5C 5C KS KH KH QS QC QC QD 7D 4H 4H 4D 2S 2D
- `self|608|22` 座3 25张 敌最少23 对家25 级Q 上手=single:8 → **pass** [noSFon8]<br>手牌: QS QD KS KC JS JH JC JC 10D 10D 9S 9D 8S 8H 8C 8D 7S 7S 6S 6S 6C 5D 4C 2S 2D
- `self|814|43` 座0 21张 敌最少20 对家24 级10 上手=single:K → **pass** []<br>手牌: 10H 10C 10D JS JH JH 7S 7H 7C 7D 6S 6C 6C 6D 3S 3S 3H 3D 2H 2C 2C

### 早中盘领出小对（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：164/168 (98%)

- `self|16|70` 座2 19张 敌最少17 对家14 级5 上手=pair:9 → **pass** []<br>手牌: RJ BJ 5H AS AC AD 9H 9C 9D 9D 8S 8H 8C 3S 3S 3C 2H 2H 2C
- `self|209|42` 座2 18张 敌最少13 对家16 级3 上手=pair:8 → **pass** []<br>手牌: 3D 3D AH KH 9S 9C 9D 9D 8C 8C 7S 7S 5H 5D 4C 4D 2S 2H
- `self|467|69` 座0 10张 敌最少12 对家25 级A 上手=pair:7 → **pass** []<br>手牌: AH 8S 8H 8H 8C 8D 2S 2H 2H 2C
- `self|690|63` 座2 23张 敌最少13 对家14 级3 上手=pair:5 → **pass** []<br>手牌: QS QH QC QD JH JH JD 10S 10H 10D 9S 9H 9C 8S 8C 8D 7S 7C 7D 5H 5D 4S 4S
- `self|835|73` 座1 18张 敌最少8 对家15 级5 上手=pair:9 → **pass** []<br>手牌: 5H 5S QH QD JS JH JH JD 10H 10D 7S 7H 7C 7C 7D 6S 6S 3C

### 跟敌人牌过牌率（early，有牌可出时）

- `self|1|5` 座1 26张 敌最少25 对家26 级3 上手=single:A → **pass** []<br>手牌: 3S 3C 3D AS AC KH KD QS QH QD JS JC JD 9S 9H 9H 9D 9D 8C 7S 7H 7D 7D 6S 6S 4C
- `self|207|33` 座2 21张 敌最少20 对家20 级A 上手=single:Q → **pass** []<br>手牌: AS AC KS KS KD QS QH QC QD 10H 10C 10D 6S 6S 6D 4S 4H 3S 3D 2C 2D
- `self|399|21` 座1 24张 敌最少20 对家22 级J 上手=single:5 → **pass** []<br>手牌: RJ JH JD AS AC KS KC QS QH 10H 10H 9S 9H 9C 9C 8S 8D 4H 4D 3H 3C 2S 2S 2C
- `self|593|27` 座3 25张 敌最少19 对家20 级10 上手=single:9 → **pass** [noSFon8]<br>手牌: RJ BJ 10S 10C AH AC AC AD QH QH JS JC 9S 9H 9H 9D 8H 8D 5S 5C 5C 3D 3D 2C 2D
- `self|803|18` 座0 26张 敌最少23 对家24 级Q 上手=single:K → **pass** []<br>手牌: QH QC QC QD KS KH KH KC KD JS JC 10H 10H 10D 10D 9S 9H 8C 7S 5H 4S 4D 3S 3C 2C 2D

### 跟敌人牌过牌率（mid，有牌可出时）

- `self|2|33` 座1 19张 敌最少20 对家21 级4 上手=triple:A → **pass** []<br>手牌: 4H 4C 4D QC QD JS JH JC JD 8H 8C 8D 8D 6S 6H 6H 5H 5C 5C
- `self|209|42` 座2 18张 敌最少13 对家16 级3 上手=pair:8 → **pass** []<br>手牌: 3D 3D AH KH 9S 9C 9D 9D 8C 8C 7S 7S 5H 5D 4C 4D 2S 2H
- `self|428|59` 座2 18张 敌最少15 对家23 级A 上手=fullhouse:2 → **pass** []<br>手牌: AH AH AS AD QS QS QH 10H 7S 7H 7C 7C 6S 6C 6D 3S 3C 3D
- `self|627|74` 座3 18张 敌最少11 对家0 级5 上手=single:2 → **pass** []<br>手牌: 5D JH JH JC JC 10C 10C 9S 9S 9H 9D 8S 8H 7S 7S 4H 4C 4D
- `self|815|89` 座1 14张 敌最少4 对家0 级J 上手=single:4 → **pass** []<br>手牌: JH JH JS JD QS QS QH 8H 8H 8D 8D 4H 4C 4C

### 跟敌人牌过牌率（late，有牌可出时）

- `self|4|65` 座3 9张 敌最少7 对家0 级6 上手=single:6 → **pass** []<br>手牌: RJ BJ BJ AS AD 8C 8D 7C 7C
- `self|207|57` 座2 9张 敌最少11 对家14 级A 上手=pair:J → **pass** []<br>手牌: AS AC QS QH QC QD 10H 10C 10D
- `self|427|88` 座0 8张 敌最少8 对家14 级K 上手=pair:5 → **pass** []<br>手牌: 7S 7C 7C 7D 2S 2S 2C 2D
- `self|641|64` 座2 9张 敌最少10 对家8 级6 上手=single:J → **pass** []<br>手牌: QH QC QC QD JS JH JC JD JD
- `self|807|101` 座1 9张 敌最少7 对家15 级3 上手=single:6 → **pass** []<br>手牌: RJ BJ 9S 9H 9C 9D 6S 6H 6D

### 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率

按座位 南/东/北/西：1128/4017 (28%) / 1108/3975 (28%) / 1114/4034 (28%) / 1106/4037 (27%)

- `self|2|4` 座0 26张 敌最少26 对家26 级4 上手=single:10 → **pass** []<br>手牌: BJ 4S 4C 4D AH AD AD KH KC QS QH JS JD 10S 10S 10C 10C 9H 9C 8S 7C 7D 7D 6C 6D 5D
- `self|214|67` 座1 12张 敌最少12 对家17 级8 上手=single:5 → **pass** []<br>手牌: 8C 8D 9C 9D 7H 7C 7C 7D 2S 2S 2H 2H
- `self|419|91` 座0 13张 敌最少11 对家13 级5 上手=pair:7 → **pass** []<br>手牌: RJ RJ 5C 5C QS QC QC QD 4H 4H 4D 2S 2D
- `self|613|57` 座0 14张 敌最少8 对家17 级4 上手=single:9 → **pass** [noSFon8]<br>手牌: RJ 4H 4S 4S 10C 10D 9S 9S 8H 8C 8D 8D 7H 7D
- `self|809|9` 座1 26张 敌最少25 对家25 级5 上手=single:10 → **pass** []<br>手牌: RJ 5S 5C AS AD KS KD QS QC QD JS JH 10H 10C 8D 7H 7C 7D 7D 6H 6D 4S 4D 3H 2H 2C

### 压对家的牌（early，有牌可压时）

- `self|223|85` 座2 24张 敌最少1 对家7 级4 上手=single:6 → **single:RJ{RJ}** [followUp,blockLikely]<br>手牌: RJ 4H 4H 4S AH AD QS QH QD QD JS JH JD 9S 9C 9C 8C 8D 8D 7S 7H 7C 7D 2H
- `self|232|59` 座3 22张 敌最少1 对家4 级K 上手=single:BJ → **single:RJ{RJ}** [followUp,blockLikely]<br>手牌: RJ KS KC AS AH AC 10H 10D 9S 9D 8S 8C 8C 8D 6H 6H 5H 5D 2S 2H 2D 2D
- `self|802|73` 座2 26张 敌最少1 对家6 级J 上手=single:K → **single:A{AD}** [keepStruct,followUp]<br>手牌: JH JC JC JD AS AD KH KD QS QD 10H 10D 8C 8D 7H 7C 6S 6H 6H 6C 5H 4S 3D 3D 2S 2S

### 压对家的牌（mid，有牌可压时）

- `self|3|54` 座0 10张 敌最少16 对家16 级5 上手=fullhouse:K → **fullhouse:5{5S 5D 5C 7D 7H}** []<br>手牌: 5H 5S 5S 5C 5D 8S 8S 8C 7H 7D
- `self|298|43` 座1 10张 敌最少12 对家14 级A 上手=fullhouse:3 → **fullhouse:8{8H 8D 8H AC AS}** [fhAttach,forceFinish:bombBack]<br>手牌: AS AC JS JS JH JH JD 8H 8H 8D
- `self|429|112` 座3 18张 敌最少2 对家0 级2 上手=single:7 → **single:2{2D}** [followUp]<br>手牌: 2D KS KH KC KC QH QD JS JD 8S 7C 6S 6C 6C 5D 4H 4D 4D
- `self|544|65` 座3 11张 敌最少1 对家8 级K 上手=single:K → **single:BJ{BJ}** [followUp]<br>手牌: BJ KH KS KD 4S 4H 4C 2S 2H 2C 2C
- `self|725|92` 座3 11张 敌最少8 对家5 级Q 上手=fullhouse:2 → **fullhouse:5{5H 5C 5D QC QD}** [forceFinish:bombBack]<br>手牌: QH QC QD 6S 6H 6H 6D 6D 5H 5C 5D

### 压对家的牌（late，有牌可压时）

- `self|4|70` 座2 7张 敌最少9 对家7 级6 上手=fullhouse:A → **fullhouse:6{6C 6S 6S KH KS}** []<br>手牌: 6S 6S 6C KS KH KD KD
- `self|237|86` 座0 7张 敌最少10 对家10 级5 上手=pair:3 → **pair:Q{QC QH}** []<br>手牌: 5C 5D 5D QH QC QC QD
- `self|423|89` 座1 2张 敌最少12 对家10 级9 上手=single:6 → **single:A{AD}** [followUp,strongBeforeLast]<br>手牌: AH AD
- `self|614|108` 座1 6张 敌最少16 对家5 级5 上手=pair:10 → **pair:A{AD 5H}** [forceFinish:bombBack]<br>手牌: 5H AD JS JH JH JD
- `self|764|65` 座3 2张 敌最少3 对家13 级Q 上手=pair:2 → **pair:J{JH JS}**<br>手牌: JS JH

### 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张时仍过牌

- `self|8|68` 座0 10张 敌最少1 对家8 级10 上手=pair:2 → **pass** [mustBomb]<br>手牌: AC QS QH JH JD 7H 5S 5H 5C 5C
- `self|223|77` 座2 24张 敌最少3 对家12 级4 上手=pair:6 → **pass** []<br>手牌: RJ 4H 4H 4S AH AD QS QH QD QD JS JH JD 9S 9C 9C 8C 8D 8D 7S 7H 7C 7D 2H
- `self|503|64` 座0 13张 敌最少1 对家12 级J 上手=pair:8 → **pass** [mustBomb]<br>手牌: RJ JS JC KC KD KD 5S 5S 5C 5C 5D 3H 3H
- `self|503|76` 座0 13张 敌最少1 对家6 级J 上手=pair:4 → **pass** [mustBomb]<br>手牌: RJ JS JC KC KD KD 5S 5S 5C 5C 5D 3H 3H
- `self|802|69` 座2 26张 敌最少1 对家7 级J 上手=pair:7 → **pass** [mustBomb]<br>手牌: JH JC JC JD AS AD KH KD QS QD 10H 10D 8C 8D 7H 7C 6S 6H 6H 6C 5H 4S 3D 3D 2S 2S

### 敌家都 ≥15 张时炸普通牌（占跟牌炸弹）

每副炸弹数（自对局，四人合计）：早 0.41 / 中 1.97 / 晚 2.62

- `self|2|63` 座3 14张 敌最少18 对家0 级4 上手=pair:A → **bomb:K{KD KS KH KC KD}** [mustBomb]<br>手牌: RJ 4S KS KH KC KD KD 7S 7C 3C 2S 2S 2H 2D
- `self|202|69` 座1 17张 敌最少16 对家15 级9 上手=fullhouse:9 → **bomb:6{6H 6H 6D 6C}** [noWasteJ,mustBomb]<br>手牌: BJ 9S QD 8H 8C 8C 8D 6H 6H 6C 6D 5S 5D 5D 3S 3H 3C
- `self|377|62` 座0 19张 敌最少16 对家10 级2 上手=fullhouse:10 → **bomb:J{JD JS JC JH JS}** [noWasteJ,mustBomb]<br>手牌: RJ BJ JS JS JH JC JD 10S 10D 7S 5S 5C 4H 4D 4D 3H 3H 3C 3D
- `self|539|86` 座2 12张 敌最少15 对家2 级8 上手=pair:8 → **bomb:Q{QD QD QS QH}** [mustBomb,controlFeed:pair]<br>手牌: 8D AS AH AC AD QS QH QD QD 9C 9C 5D
- `self|799|88` 座2 6张 敌最少16 对家0 级8 上手=fullhouse:J → **bomb:6{6C 6D 6S 6H 8H}** [noWasteJ,mustBomb,forceFinish:likely]<br>手牌: 8H 8S 6S 6H 6C 6D

### 敌家都 ≥10 张时领出炸弹（非走完）

炸压炸占跟牌炸弹：1509/3613 (42%)

- `self|15|45` 座3 8张 敌最少19 对家24 级4 上手=pass → **bomb:9{9S 9D 9C 9C}** [holdBombLead,control,leadBombLate]<br>手牌: JS JH JC JD 9S 9C 9C 9D
- `self|275|80` 座2 8张 敌最少18 对家10 级4 上手=pass → **bomb:7{7C 7S 7S 7D}** [control]<br>手牌: 7S 7S 7C 7D 6S 6H 5C 5D
- `self|456|85` 座3 8张 敌最少10 对家8 级3 上手=pass → **bomb:8{8S 8D 8D 8C}** [holdBombLead,control,leadBombLate]<br>手牌: QH QH QC QD 8S 8C 8D 8D
- `self|679|117` 座3 8张 敌最少23 对家11 级5 上手=pass → **bomb:7{7C 7C 7S 7H}** [control,forceFinish:bombBack]<br>手牌: JS JC JD JD 7S 7H 7C 7C
- `self|846|82` 座0 7张 敌最少17 对家13 级3 上手=pass → **bomb:8{8C 8D 8D 8H}** [keepBombForControl,control,forceFinish:likely]<br>手牌: 3S 3C 3D 8H 8C 8D 8D

### 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌

- `self|34|72` 座1 8张 敌最少3 对家0 级10 上手=triple:J → **pass** []<br>手牌: 10S QH JS 9H 8S 8H 8D 8D
- `self|480|62` 座2 17张 敌最少2 对家0 级A 上手=fullhouse:K → **pass** []<br>手牌: KS KS KC KC JS JD 9C 9D 7S 7H 7C 6H 6C 6C 3S 3H 3D
- `self|662|92` 座2 16张 敌最少2 对家2 级A 上手=triple:9 → **pass** []<br>手牌: RJ AC AD 6S 6S 6H 6C 3S 3C 3C 3D 2S 2H 2C 2C 2D
- `self|702|65` 座0 12张 敌最少3 对家0 级2 上手=fullhouse:9 → **pass** []<br>手牌: RJ JS JD 9S 9D 8S 8C 8C 8D 5H 5H 5D
- `self|787|68` 座1 8张 敌最少3 对家19 级9 上手=pair:K → **pass** []<br>手牌: RJ 9H QS QH QC JH 2S 2H

### 输家结束时手里还留着炸弹（每个输家座位）

- `self|8` 座0 结束时手里：5H 7H JD JH QH 5C QS 5C 5S
- `self|32` 座3 结束时手里：7H 7C 8D 7S QH QC QS 7D 2S 6S QD 2D 6D
- `self|54` 座1 结束时手里：5H QH 5C QD 5S QD QC JD
- `self|62` 座1 结束时手里：QS QD 6C QC 6C QC
- `self|63` 座0 结束时手里：4D 4H 4D 8S 4H 6D

### 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10）

- `self|5|38` 座3 21张 敌最少20 对家21 级7 上手=pass → **single:7{7C}** [control]<br>手牌: BJ 7C QS QS QH QD JS JH JH 9H 9C 9D 8S 8H 6H 6H 6C 3S 3H 3C 3D
- `self|192|45` 座0 23张 敌最少18 对家20 级Q 上手=pass → **single:Q{QS}** [control]<br>手牌: RJ QS KH KH KD 8H 8H 8C 7S 7C 6S 6H 6H 6D 4S 4D 3H 3C 2S 2S 2H 2H 2D
- `self|372|24` 座1 22张 敌最少24 对家25 级10 上手=pass → **single:10{10C}** [control]<br>手牌: 10C 10C KH KC KD 7H 7C 7D 6H 6H 6C 4S 4H 4D 3S 3H 3H 3D 2S 2S 2H 2D
- `self|567|108` 座1 22张 敌最少12 对家2 级10 上手=single:3 → **single:BJ{BJ}** [stopShort,followUp,winThen:pair,followSize,controlFeed:pair]<br>手牌: BJ BJ 10S KH KC KC KD QH QC QC QD 9H 9C 7S 7C 7D 7D 5S 5D 4C 3C 3D
- `self|795|42` 座2 20张 敌最少22 对家23 级4 上手=pass → **single:4{4D}** [control]<br>手牌: 4H 4D QH QH QC QD 9H 9D 8S 8D 7C 7D 7D 5H 5H 5D 2C 2C 2D 2D

### 早盘领出 A/级牌/王的单对

- `self|5|38` 座3 21张 敌最少20 对家21 级7 上手=pass → **single:7{7C}** [control]<br>手牌: BJ 7C QS QS QH QD JS JH JH 9H 9C 9D 8S 8H 6H 6H 6C 3S 3H 3C 3D
- `self|224|24` 座3 22张 敌最少25 对家24 级5 上手=pass → **single:RJ{RJ}** [control]<br>手牌: RJ 5H 5H 5D AS AC AD AD JS JH JC 9H 9C 9D 8H 8D 7C 7C 6S 6C 4S 4H
- `self|398|70` 座1 20张 敌最少15 对家15 级10 上手=pass → **single:RJ{RJ}** [control]<br>手牌: RJ 10H 10D 10D AS AC AD 9H 9D 8S 8D 7H 7C 7D 6C 6D 3S 3S 3H 3D
- `self|582|44` 座2 20张 敌最少21 对家20 级Q 上手=pass → **single:Q{QC}** [control]<br>手牌: QC 10S 10H 10C 10D 8C 8C 7S 7S 7H 7C 6H 6H 6D 5C 5D 3H 3H 3D 3D
- `self|795|42` 座2 20张 敌最少22 对家23 级4 上手=pass → **single:4{4D}** [control]<br>手牌: 4H 4D QH QH QC QD 9H 9D 8S 8D 7C 7D 7D 5H 5H 5D 2C 2C 2D 2D

### 拆炸弹领出

- `self|5|79` 座0 8张 敌最少11 对家10 级7 上手=pass → **triple:7{7C 7D 7D}** [bombBreakNoGain,leadSmallSame,control,offPlan]<br>手牌: 7S 7C 7D 7D KS KH KC KD
- `self|242|106` 座0 10张 敌最少8 对家12 级10 上手=pass → **pair:A{AH AS}** [bombBreakAlt,leadSmallSame,control,offPlan,forceFinish:likely]<br>手牌: 10H 10H AS AH AH AD 7S 7S 7H 7C
- `self|445|49` 座1 15张 敌最少21 对家20 级5 上手=pass → **fullhouse:4{4C 4S 4D 7H 7S}** [fhAttach,control]<br>手牌: 5S 5S 8H 8H 8C 8D 7S 7H 6C 6D 4S 4S 4H 4C 4D
- `self|628|75` 座3 10张 敌最少15 对家22 级6 上手=pass → **fullhouse:4{4C 4S 4D 5C 5H}** [control,offPlan]<br>手牌: 6H 5H 5C 5C 5D 4S 4H 4C 4C 4D
- `self|780|37` 座2 17张 敌最少21 对家23 级2 上手=pass → **fullhouse:5{5H 5D 5S 7D 7H}** [bombBreakNoGain,control]<br>手牌: 2S 2C 2C 2D 10D 10D 9H 9C 8C 8D 7H 7D 5S 5H 5H 5D 5D

### 早盘拆对领单（手里有顺子/连对/钢板可出）

- `self|62|28` 座3 22张 敌最少24 对家23 级Q 上手=pass → **single:J{JC}** [control]<br>手牌: QH JC JD 10S 10S 10H 10H 10C 8S 8C 7H 7C 6S 6H 6D 4S 4D 4D 2H 2C 2D 2D
- `self|241|40` 座3 21张 敌最少21 对家22 级9 上手=pass → **single:4{4D}** [control]<br>手牌: 9H 9D 10S 10H 10D 8C 8D 8D 6S 6C 6D 5S 5S 5H 5D 4D 4D 2S 2H 2H 2D
- `self|447|78` 座1 20张 敌最少12 对家18 级7 上手=pass → **single:BJ{BJ}** [control]<br>手牌: BJ BJ 7C 7D KS KC QD QD JC JD 10H 10D 10D 9H 9C 4H 4H 4C 4C 4D
- `self|615|17` 座3 23张 敌最少24 对家26 级6 上手=pass → **single:J{JD}** [control]<br>手牌: 6H 6S 6S 6C QC QD JC JD 8S 8H 8H 8C 8D 4C 4D 3C 3D 2S 2S 2H 2C 2C 2D
- `self|912|39` 座3 20张 敌最少21 对家24 级4 上手=pass → **single:BJ{BJ}** [control]<br>手牌: BJ BJ 4H 4H AD QH QC QD JS JH JD 10S 10D 10D 9S 9H 6S 6H 6D 6D

### decide 用时 >300ms 的比例

p50 2.1ms，p90 20.5ms，p99 35.4ms，max 1423ms

- `vsGreedy0|200082|100` 座2 13张 敌最少2 对家0 级A 上手=single:7 → **bomb:J{JD JH JS JC AH AH}** [forceFinish:likely]<br>手牌: AH AH AS AC AD JS JH JC JD 4S 4C 4C 4D
- `self|129|92` 座1 16张 敌最少1 对家10 级A 上手=fullhouse:10 → **bomb:9{9S 9C 9H 9D 9H 9C 9S}** [noWasteJ,mustBomb,forceFinish:likely]<br>手牌: AH QS QH QH QC JS JH JD JD 9S 9S 9H 9H 9C 9C 9D
- `self|309|68` 座1 16张 敌最少1 对家15 级Q 上手=fullhouse:10 → **bomb:A{AD AD AS AH AS}** [noWasteJ,mustBomb,forceFinish:likely]<br>手牌: QH QH QS AS AS AH AD AD 6H 6C 6D 5S 5S 5H 2C 2D
- `self|68|47` 座1 15张 敌最少20 对家6 级5 上手=fullhouse:8 → **bomb:A{AS AD AS AH AC}** [noWasteJ,mustBomb]<br>手牌: 5H 5H 5S 5D AS AS AH AC AD QS JH JH JC JD 6H
- `self|121|54` 座3 16张 敌最少12 对家18 级6 上手=fullhouse:2 → **pass** []<br>手牌: 6H 6H 6S 6S 6C 10D 9S 9S 9H 8C 4C 4D 4D 3S 3H 3C

### 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）

全部通过

