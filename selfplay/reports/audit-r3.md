# 自对局体检报告

生成：2026/10/18 00:23:57（America/Toronto）　policy：current　用时 720s

对局：自对局 1000 副（四家 decide），混合对手 Random、Greedy、Old:pre-activity、Old:pre-round6 各 200×2 副（换座位）；逐手记录 264878 条；surprise 局面 195 个。

局面 id 可复现：`node selfplay/audit.mjs --replay='<id>'`（cfg|seed|step）。

## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）

- **Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5**：8.7%（n=195，合理区间 ≤5%，严重度 5.2）
- **早盘领出对子占比**：1.6%（n=5551，合理区间 ≥5%，严重度 2.6）
- **早盘领出单张占比**：69.9%（n=5551，合理区间 ≥15 且 ≤55%，严重度 1.0）

## 全部检测器

| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |
|---|---|---|---|---|---|
| 早中盘领出小单（≤10）后两个敌家都不跟 | 8.4% | 4926 | ≤25% | 8.7% | OK |
| 早中盘领出小对（≤10）后两个敌家都不跟 | 27.1% | 645 | ≤35% | 17.6% | OK |
| 跟敌人牌过牌率（early，有牌可出时） | 49.8% | 28934 | ≥30 且 ≤62% | 48.3% | OK |
| 跟敌人牌过牌率（mid，有牌可出时） | 61.4% | 18434 | ≥30 且 ≤65% | 59.1% | OK |
| 跟敌人牌过牌率（late，有牌可出时） | 38.4% | 5039 | ≥20 且 ≤75% | 41.3% | OK |
| 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率 | 25.6% | 14617 | ≤35% | 26.0% | OK |
| 压对家的牌（early，有牌可压时） | 0.0% | 8810 | ≤15% | 0.0% | OK |
| 压对家的牌（mid，有牌可压时） | 0.3% | 6713 | ≤15% | 0.4% | OK |
| 压对家的牌（late，有牌可压时） | 14.9% | 2033 | ≤30% | 13.5% | OK |
| 炸对家（未因此走完） | 0.0% | 16310 | ≤2% | 0.0% | OK |
| 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张时仍过牌 | 44.0% | 25 | ≤60% | 64.2% | 样本少 |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 14.3% | 2051 | ≤15% | 10.3% | OK |
| 敌家都 ≥10 张时领出炸弹（非走完） | 5.6% | 4909 | ≤10% | 1.7% | OK |
| 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌 | 3.4% | 734 | ≤45% | 6.0% | OK |
| 输家结束时手里还留着炸弹（每个输家座位） | 5.2% | 2000 | ≤20% | 3.5% | OK |
| 输家结束时还握着 ≥2 张王/级牌 | 8.1% | 2000 | ≤25% | 7.2% | OK |
| 末游卡手（结束时 ≥8 张且至少还要 5 手） | 0.0% | 1000 | ≤25% | 0.0% | OK |
| 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10） | 0.8% | 12312 | ≤8% | 0.4% | OK |
| 早盘领出 A/级牌/王的单对 | 0.7% | 3968 | ≤12% | 0.1% | OK |
| 拆炸弹领出 | 0.7% | 17346 | ≤2% | 6.1% | OK |
| 早盘拆对领单（手里有顺子/连对/钢板可出） | 0.0% | 3235 | ≤15% | 0.0% | OK |
| 早盘领出对子占比 | 1.6% | 5551 | ≥5% | 0.2% | 🚩 |
| 早盘领出单张占比 | 69.9% | 5551 | ≥15 且 ≤55% | 70.3% | 🚩 |
| 一手能出完却没出完 | 0.0% | 2663 | ≤1% | 1.2% | OK |
| decide 用时 >300ms 的比例 | 0.0% | 180389 | ≤0.5% | 0.0% | OK |
| 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测） | 0.000 | 2600 | ≤0 | 0.000 | OK |
| 对 Random 每副净升级 | 2.925 | 400 | ≥1.5 | 2.905 | OK |
| 对 Greedy 每副净升级 | 2.277 | 400 | ≥0.5 | 2.112 | OK |
| Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5 | 8.7% | 195 | ≤5% | 8.2% | 🚩 |

## 队伍结果

- 自对局 1000 副：南北队每副净升级 0.062 [-0.068, 0.192]（应≈0），双下率 31.4%，平均每副 102 手
- 各座位平均名次（南/东/北/西）：2.44 / 2.51 / 2.52 / 2.53
- decide vs Random：400 副，胜 396/400 (99%)，每副净升级 2.925 [2.882, 2.968]
- decide vs Greedy：400 副，胜 362/400 (91%)，每副净升级 2.277 [2.143, 2.412]
- decide vs Old:pre-activity：400 副，胜 282/400 (71%)，每副净升级 1.008 [0.837, 1.178]
- decide vs Old:pre-round6：400 副，胜 273/400 (68%)，每副净升级 0.948 [0.757, 1.138]

## 详情与示例局面

### 🚩 Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5

分类：lead/early/otherPlay 4，lead/mid/otherPlay 4，partner/mid/shouldPass 3，lead/late/otherPlay 2，partner/early/otherPlay 1，partner/late/passed 1，enemy/early/passed 1，enemy/late/passed 1

- `self|223|81` partner 24张 张数4/22/24/1 级4 上手=single:8<br>decide: **single:RJ{RJ}** (-2.17) [noSFon8,followUp,blockLikely] vs **single:4{4H}** (+3.50, t=19.9, n=36)<br>手牌: JD 4H 8D 9C 9S 4S 2H RJ 7H AH JS AD QD 7S 8D QS 9C JH 4H 7D 7C QH 8C QD
- `self|544|93` partner 13张 张数2/10/12/13 级K 上手=pair:J<br>decide: **pair:K{KS KD}** (0.42) [blockProb] vs **pass** (+1.89, t=5.7, n=36)<br>手牌: KS KD 4C KH 8C 8S 4S 4H 2C 2H 2S 8D 2C
- `self|560|74` partner 3张 张数3/19/18/15 级3 上手=single:K<br>decide: **pass** (0.53) [] vs **single:A{AD}** (+1.72, t=4.0, n=36)<br>手牌: AD AD AS
- `self|338|67` lead 8张 张数10/8/25/23 级2 上手=pass<br>decide: **fullhouse:3{3H 3S 3D 2C 2D}** (0.31) [fhAttach,control,planWeakFirst,planStrongFirst] vs **fullhouse:3{3H 3S 3D 6D 6S}** (+1.50, t=3.5, n=36)<br>手牌: 3H 2C 2D 6D 3S 3D 6S 6H
- `self|129|82` partner 14张 张数1/8/17/14 级A 上手=single:A<br>decide: **single:RJ{RJ}** (-2.03) [followUp,blockLikely] vs **pass** (+1.47, t=3.2, n=36)<br>手牌: 6C 8C 6S 8S 8S 6S BJ 4H RJ 6D 4S RJ 4D 8H
- `self|940|31` lead 21张 张数25/25/21/22 级6 上手=pass<br>decide: **single:Q{QD}** (-0.06) [holdBombLead,control] vs **fullhouse:7{7C 7H 7S 3D 3D}** (+1.39, t=2.9, n=36)<br>手牌: 10H 5D 3D 7C 7H 10H 8S 5D 4C 4S QD 7S 4C 4D 10C BJ RJ 8C 3D 4H 5H
- `self|506|25` enemy 24张 张数25/25/24/21 级A 上手=single:K<br>decide: **pass** (0.78) [] vs **single:BJ{BJ}** (+1.31, t=3.5, n=36)<br>手牌: KH QC KS JH BJ QC BJ 8S 7H JS 10D AH 5C 10C JS 4C 5C 4H QS 5D 9D 7H 7D 10S
- `self|850|33` lead 18张 张数18/23/23/19 级7 上手=pass<br>decide: **single:10{10S}** (0.17) [holdBombLead,smallFirst,control] vs **pair:5{5H 5C}** (+1.31, t=3.2, n=36)<br>手牌: RJ 4D 10S 2S 2H 2C 5H 4S 7D 4C 7H 5C 8D JD JC AC 4H 8S

### 🚩 早盘领出单张占比

早盘领出牌型分布：single 70%，fullhouse 16%，tripleSeq 5%，pairSeq 5%，triple 3%，pair 2%，straight 0%，bomb 0%；熵 1.47 bit


### 早中盘领出小单（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：415/415 (100%)

- `self|6|26` 座0 24张 敌最少22 对家17 级8 上手=single:10 → **pass** []<br>手牌: 8H 8S 8D AH AC AC AD KS KH QS QC JS JC JD 10S 10C 9C 9D 7S 7D 6D 4H 4D 3H
- `self|190|80` 座0 13张 敌最少8 对家8 级10 上手=single:8 → **pass** [noSFon8]<br>手牌: BJ 10C QS QH QD JS JS JH JC JC 4S 4S 4H
- `self|424|29` 座0 20张 敌最少17 对家20 级10 上手=single:8 → **pass** [noSFon8]<br>手牌: 10H 10S 10D 9H 9C 9D 8S 8H 8C 8D 7H 7C 7D 5S 5C 5D 5D 2S 2C 2D
- `self|655|56` 座0 11张 敌最少18 对家21 级7 上手=single:10 → **pass** []<br>手牌: AS AH AC AC QS QH QC JS JC JD JD
- `self|822|28` 座3 20张 敌最少19 对家19 级5 上手=single:9 → **pass** [noSFon8]<br>手牌: RJ JS JC JC JD 10S 10D 9H 9C 8S 8H 8H 8C 8D 7H 7C 2S 2H 2C 2C

### 早中盘领出小对（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：173/175 (99%)

- `self|16|70` 座2 19张 敌最少17 对家14 级5 上手=pair:8 → **pass** []<br>手牌: RJ BJ 5H AS AC AD 9H 9C 9D 9D 8S 8H 8C 3S 3S 3C 2H 2H 2C
- `self|250|54` 座2 20张 敌最少9 对家19 级5 上手=pair:7 → **pass** []<br>手牌: 5H 5H 5S 5C AS AD KH KC QS QD 9S 9H 9C 9C 9D 9D 7S 7C 2S 2C
- `self|511|55` 座0 18张 敌最少13 对家0 级6 上手=pair:7 → **pass** []<br>手牌: BJ 6H 6S AS AH AC AD 10C 10C 9H 9C 9D 8H 8C 7S 7H 3H 3D
- `self|671|56` 座1 17张 敌最少13 对家18 级10 上手=pair:8 → **pass** []<br>手牌: BJ 10H 10S 10C KS KS KH KH 9D 6H 6H 6D 6D 5H 5H 5C 5D
- `self|807|99` 座3 18张 敌最少10 对家9 级3 上手=pair:8 → **pass** []<br>手牌: 3H JH JH JC 10S 10H 10H 10D 8H 8H 8D 8D 7C 7D 7D 5S 5S 5H

### 跟敌人牌过牌率（early，有牌可出时）

- `self|1|5` 座1 26张 敌最少25 对家26 级3 上手=single:A → **pass** []<br>手牌: 3S 3C 3D AS AC KH KD QS QH QD JS JC JD 9S 9H 9H 9D 9D 8C 7S 7H 7D 7D 6S 6S 4C
- `self|205|44` 座1 21张 敌最少20 对家22 级Q 上手=single:J → **pass** []<br>手牌: BJ QS 10S 10H 10C 10D 9H 9C 9C 8S 8H 8H 8C 7S 7D 6H 6H 6D 5S 3C 3D
- `self|398|26` 座1 25张 敌最少24 对家22 级10 上手=single:9 → **pass** [noSFon8]<br>手牌: RJ BJ 10H 10D 10D AS AC AD QC QD QD 9H 9D 8S 8D 7H 7C 7D 6C 6D 5D 3S 3S 3H 3D
- `self|595|5` 座1 26张 敌最少25 对家26 级Q 上手=single:A → **pass** []<br>手牌: BJ QH QH QC AS KH KC JS JC 10S 10S 9D 8C 6S 6H 6H 6D 5H 5C 4S 4H 4D 3S 3D 3D 2S
- `self|800|44` 座0 22张 敌最少21 对家20 级9 上手=single:K → **pass** []<br>手牌: 9H 9D 9D JS JD 10C 10D 10D 8S 8C 8D 7S 7C 4H 4D 3S 3S 3C 2S 2S 2H 2C

### 跟敌人牌过牌率（mid，有牌可出时）

- `self|1|28` 座0 14张 敌最少14 对家24 级3 上手=single:K → **pass** []<br>手牌: RJ BJ JS JH 10H 10H 10C 8S 8H 8H 8D 2C 2C 2D
- `self|197|75` 座1 13张 敌最少13 对家13 级4 上手=single:Q → **pass** []<br>手牌: 4H 4H 4S AH AC JC JD 3S 3H 2S 2H 2D 2D
- `self|416|60` 座3 15张 敌最少9 对家15 级2 上手=triple:7 → **pass** []<br>手牌: BJ 2C QS QS QH QC 6S 6H 6H 6C 5H 5H 5C 5D 4D
- `self|622|69` 座1 14张 敌最少17 对家10 级K 上手=fullhouse:5 → **pass** []<br>手牌: KS KC KC KD 7H 7D 5S 5C 5D 5D 4S 4S 4C 4D
- `self|814|73` 座2 18张 敌最少9 对家16 级10 上手=single:10 → **pass** []<br>手牌: RJ 10S AH AD KC KD KD QC QD 9H 8C 5S 5S 5H 5H 5D 4C 4D

### 跟敌人牌过牌率（late，有牌可出时）

- `self|1|69` 座1 8张 敌最少7 对家13 级3 上手=single:2 → **pass** []<br>手牌: 9S 9H 9H 9D 7S 7H 7D 7D
- `self|206|67` 座0 8张 敌最少15 对家15 级K 上手=single:10 → **pass** []<br>手牌: RJ JS JS JC 9S 9S 9H 9C
- `self|413|65` 座0 8张 敌最少7 对家13 级Q 上手=pair:10 → **pass** []<br>手牌: RJ RJ BJ 4H 4C 4D 2S 2C
- `self|630|59` 座0 7张 敌最少7 对家9 级8 上手=triple:9 → **pass** []<br>手牌: RJ 8H AS AD 6H 4S 4H
- `self|808|65` 座1 9张 敌最少14 对家9 级4 上手=single:K → **pass** []<br>手牌: RJ JS JC 8H 8D 5H 5D 3S 3H

### 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率

按座位 南/东/北/西：976/3687 (26%) / 869/3595 (24%) / 984/3704 (27%) / 914/3631 (25%)

- `self|2|4` 座0 26张 敌最少26 对家26 级4 上手=single:10 → **pass** []<br>手牌: BJ 4S 4C 4D AH AD AD KH KC QS QH JS JD 10S 10S 10C 10C 9H 9C 8S 7C 7D 7D 6C 6D 5D
- `self|195|71` 座3 14张 敌最少11 对家21 级2 上手=single:7 → **pass** []<br>手牌: RJ 2H 2D 2D AS AH AC AC QS QH QH QC QC QD
- `self|398|44` 座3 21张 敌最少20 对家24 级10 上手=single:Q → **pass** []<br>手牌: RJ BJ 10C JC JD JD 9S 9C 9C 6S 6S 6H 4S 4H 4H 4C 2S 2H 2C 2C 2D
- `self|608|86` 座0 10张 敌最少6 对家0 级Q 上手=pair:10 → **pass** []<br>手牌: BJ BJ QH QC QD 9S 9C 9C 9D 4D
- `self|801|43` 座1 16张 敌最少16 对家23 级10 上手=single:J → **pass** []<br>手牌: BJ 10H 10S AS AH AH AD JS JD 9H 8H 6H 6H 2S 2H 2D

### 压对家的牌（early，有牌可压时）

- `self|223|81` 座2 24张 敌最少1 对家4 级4 上手=single:8 → **single:RJ{RJ}** [noSFon8,followUp,blockLikely]<br>手牌: RJ 4H 4H 4S AH AD QS QH QD QD JS JH JD 9S 9C 9C 8C 8D 8D 7S 7H 7C 7D 2H
- `self|232|59` 座3 20张 敌最少2 对家4 级K 上手=single:8 → **single:K{KC}** [noSFon8,followUp]<br>手牌: RJ KS KC AS AH AC 10H 10D 9S 9D 8S 8C 8C 8D 6H 6H 2S 2H 2D 2D

### 压对家的牌（mid，有牌可压时）

- `self|3|87` 座1 12张 敌最少1 对家0 级5 上手=single:A → **single:RJ{RJ}** [followUp,blockSure]<br>手牌: RJ 7S 7C 7D 6H 6C 6D 4S 4C 4C 3S 2H
- `self|307|100` 座1 10张 敌最少8 对家12 级10 上手=fullhouse:2 → **fullhouse:4{4C 4D 4C 7S 7C}** []<br>手牌: 7S 7H 7C 7D 6H 6C 6D 4C 4C 4D
- `self|421|82` 座3 13张 敌最少1 对家0 级7 上手=single:7 → **single:RJ{RJ}** [followUp,blockLikely]<br>手牌: RJ 7D 10S 10C 10D 9S 9H 9C 8S 8H 8D 2C 2D
- `self|507|59` 座1 10张 敌最少6 对家21 级2 上手=fullhouse:Q → **fullhouse:2{2D 2D 2C 9H 9C}** [fhAttach,forceFinish:bombBack]<br>手牌: 2H 2C 2D 2D 9H 9C 7H 7C 7D 7D
- `self|663|98` 座0 12张 敌最少1 对家0 级2 上手=single:Q → **single:2{2D}** [keepStruct,followUp,blockSure]<br>手牌: 2H 2D AC AD QH JH JD 10S 6C 6C 3H 3C

### 压对家的牌（late，有牌可压时）

- `self|5|75` 座0 4张 敌最少18 对家13 级7 上手=single:RJ → **bomb:7{7C 7D 7D 7S}**<br>手牌: 7S 7C 7D 7D
- `self|223|83` 座0 4张 敌最少1 对家23 级4 上手=single:RJ → **bomb:K{KH KS KC KH}**<br>手牌: KS KH KH KC
- `self|415|73` 座1 6张 敌最少16 对家6 级A 上手=single:K → **single:RJ{RJ}** [followUp,keepControlSoft,strongBeforeLast,forceFinish:likely]<br>手牌: RJ AC AD 9H 9C 9C
- `self|594|83` 座0 5张 敌最少9 对家2 级J 上手=single:BJ → **single:RJ{RJ}** [followUp,strongBeforeLast,forceFinish:bombBack]<br>手牌: RJ 9S 9S 9H 9H
- `self|762|86` 座3 3张 敌最少13 对家4 级10 上手=pair:6 → **pair:10{10C 10S}** []<br>手牌: 10S 10C JD

### 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张时仍过牌

- `self|8|68` 座0 10张 敌最少1 对家8 级10 上手=pair:2 → **pass** [mustBomb]<br>手牌: AC QS QH JH JD 7H 5S 5H 5C 5C
- `self|194|83` 座0 4张 敌最少1 对家8 级A 上手=pair:6 → **pass** []<br>手牌: BJ AH AD AD
- `self|503|64` 座0 13张 敌最少1 对家12 级J 上手=pair:8 → **pass** [mustBomb]<br>手牌: RJ JS JC KC KD KD 5S 5S 5C 5C 5D 3H 3H
- `self|503|76` 座0 13张 敌最少1 对家6 级J 上手=pair:4 → **pass** [mustBomb]<br>手牌: RJ JS JC KC KD KD 5S 5S 5C 5C 5D 3H 3H
- `self|784|88` 座1 3张 敌最少3 对家10 级6 上手=single:5 → **pass** []<br>手牌: 6C 5C 2S

### 敌家都 ≥15 张时炸普通牌（占跟牌炸弹）

每副炸弹数（自对局，四人合计）：早 0.40 / 中 1.89 / 晚 2.62

- `self|2|63` 座3 14张 敌最少18 对家0 级4 上手=pair:A → **bomb:K{KD KS KH KC KD}** [mustBomb]<br>手牌: RJ 4S KS KH KC KD KD 7S 7C 3C 2S 2S 2H 2D
- `self|202|69` 座1 17张 敌最少16 对家15 级9 上手=fullhouse:9 → **bomb:6{6H 6H 6D 6C}** [noWasteJ,mustBomb]<br>手牌: BJ 9S QD 8H 8C 8C 8D 6H 6H 6C 6D 5S 5D 5D 3S 3H 3C
- `self|357|95` 座1 8张 敌最少18 对家8 级8 上手=pair:Q → **bomb:2{2C 2H 2D 2D}** [mustBomb,forceFinish:bombBack]<br>手牌: 8S 8C 8D 8D 2H 2C 2D 2D
- `self|543|82` 座2 14张 敌最少18 对家3 级Q 上手=single:BJ → **bomb:9{9D 9C 9S 9S QH QH}** [mustBomb,forceFinish:likely]<br>手牌: QH QH QS QC QC QD JS JH 10S 10D 9S 9S 9C 9D
- `self|803|63` 座2 20张 敌最少23 对家6 级Q 上手=single:A → **bomb:J{JH JD JD JC}** [mustBomb]<br>手牌: AS AH AC AD JH JC JD JD 10C 9S 9C 7C 7C 5S 5C 5D 4S 4D 3S 3H

### 敌家都 ≥10 张时领出炸弹（非走完）

炸压炸占跟牌炸弹：1464/3515 (42%)

- `self|5|58` 座3 8张 敌最少14 对家19 级7 上手=pass → **bomb:3{3H 3C 3D 3S}** [holdBombLead,control,leadBombLate]<br>手牌: QS QS QH QD 3S 3H 3C 3D
- `self|235|72` 座3 12张 敌最少17 对家11 级3 上手=pass → **bomb:5{5C 5H 5H 5S}** [holdBombLead,control,leadBombLate]<br>手牌: 9S 9H 9C 9D 5S 5H 5H 5C 2S 2S 2C 2D
- `self|475|93` 座1 8张 敌最少17 对家2 级9 上手=pass → **bomb:8{8D 8S 8H 8C}** [control,forceFinish:bombBack]<br>手牌: JS JH JH JD 8S 8H 8C 8D
- `self|671|59` 座0 13张 敌最少17 对家16 级10 上手=pass → **bomb:2{2H 2C 2S 2H 2C}** [holdBombLead,control,leadBombLate]<br>手牌: AH AH AD AD 4S 4H 4C 4D 2S 2H 2H 2C 2C
- `self|830|50` 座3 8张 敌最少14 对家24 级K 上手=pass → **bomb:2{2H 2D 2D 2H}** [holdBombLead,control,leadBombLate]<br>手牌: 5S 5H 5C 5D 2H 2H 2D 2D

### 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌

- `self|16|117` 座3 7张 敌最少3 对家0 级5 上手=fullhouse:3 → **pass** []<br>手牌: AH 3H 3H 3C 3D 2S 2D
- `self|321|83` 座2 7张 敌最少2 对家1 级J 上手=fullhouse:2 → **pass** []<br>手牌: KH 10H 9H 9H 9C 9C 5H
- `self|524|97` 座0 9张 敌最少2 对家0 级6 上手=pair:10 → **pass** []<br>手牌: RJ BJ 10S 10S 10C 10D 9S 9H 9D
- `self|693|71` 座3 14张 敌最少2 对家14 级6 上手=fullhouse:10 → **pass** []<br>手牌: RJ RJ 6S 6C QS QC 8D 8D 5C 5D 4S 4S 4H 4D
- `self|912|79` 座1 14张 敌最少2 对家0 级4 上手=pair:Q → **pass** []<br>手牌: 4S 7S 7H 7C 7D 3S 3H 3H 3D 2S 2S 2H 2C 2D

### 输家结束时手里还留着炸弹（每个输家座位）

- `self|8` 座0 结束时手里：5H 7H JD JH QH 5C QS 5C 5S
- `self|32` 座3 结束时手里：7H 7C 8D 7S QH QC QS 7D 2S 6S QD 2D 6D
- `self|43` 座2 结束时手里：6D 5H 5S 5H 6H
- `self|62` 座2 结束时手里：5H 5S 5S QD 7H QS RJ 5D 7C KH 7S
- `self|63` 座0 结束时手里：4D 4H 4D 8S 4H 6D

### 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10）

- `self|8|38` 座2 22张 敌最少2 对家18 级10 上手=pair:K → **pair:10{10C 10H}** [stopShort,followSize]<br>手牌: RJ BJ 10H 10C AH AH JS 9C 8S 8C 6S 6S 6H 6D 4S 4C 4D 3H 3C 3C 2D 2D
- `self|171|25` 座0 20张 敌最少25 对家13 级4 上手=pass → **single:BJ{BJ}** [control]<br>手牌: RJ BJ QS QC 10S 10D 9S 9D 8S 8C 7C 7D 6H 6D 5S 5H 5C 5D 3S 3C
- `self|393|67` 座1 21张 敌最少1 对家10 级5 上手=pair:8 → **pair:5{5S 5D}** [stopShort,followSize]<br>手牌: 5S 5C 5D AC AC AD KS KD KD JS JS JH JH JD 7H 3S 3H 3D 2S 2H 2D
- `self|642|26` 座1 22张 敌最少23 对家24 级7 上手=pass → **pair:RJ{RJ RJ}** [control]<br>手牌: RJ RJ 7H 7C AS AC QH QH 8H 8H 6S 6H 6H 6C 5S 5H 5D 5D 4H 4D 2H 2H
- `self|838|55` 座1 23张 敌最少13 对家8 级8 上手=pair:10 → **pair:8{8C 8S}** [stopShort,followSize]<br>手牌: RJ BJ 8H 8S 8C AC AD KH KD 9C 9C 6S 6S 6H 6C 5S 5D 4H 4C 4D 3H 3C 3C

### 早盘领出 A/级牌/王的单对

- `self|28|17` 座1 21张 敌最少25 对家27 级4 上手=pass → **single:RJ{RJ}** [control]<br>手牌: RJ AS AC 10C 10D 9S 9D 8H 8D 7H 7H 6H 6H 5S 5D 3C 3D 2S 2H 2H 2C
- `self|301|39` 座2 20张 敌最少16 对家22 级4 上手=pass → **pair:A{AH AH}** [control]<br>手牌: BJ BJ AH AH QC QD 10S 10H 10D 10D 8S 8D 7H 7C 7D 7D 5C 5D 3C 3C
- `self|439|26` 座3 25张 敌最少25 对家22 级Q 上手=pass → **pair:RJ{RJ RJ}** [control]<br>手牌: RJ RJ QH QD QD AH AC 10S 10H 9S 9H 6S 6S 6H 6D 5H 5C 4D 4D 3C 3D 2S 2H 2C 2D
- `self|705|31` 座1 20张 敌最少20 对家22 级5 上手=pass → **pair:BJ{BJ BJ}** [control]<br>手牌: BJ BJ 5S 5D QH QC JS JD 8S 8H 8H 8C 7S 7H 6C 6C 3S 3H 3H 3D
- `self|809|65` 座1 21张 敌最少8 对家10 级5 上手=pass → **single:RJ{RJ}** [control]<br>手牌: RJ 5S 5C AS AD KS KD JS JH 10H 10C 7H 7C 7D 7D 6H 6D 4S 4D 2H 2C

### 拆炸弹领出

- `self|9|56` 座2 12张 敌最少14 对家21 级J 上手=pass → **triple:J{JS JD JS}** [bombBreakNoGain,control,offPlan]<br>手牌: JS JS JC JD QS QS QD QD 6S 6C 6D 6D
- `self|234|74` 座2 15张 敌最少9 对家13 级2 上手=pass → **pairSeq:8{6H 6S 7H 7C 8C 8D}** [holdBombLead,control]<br>手牌: 2H 2H QS QH QC QD 8C 8D 7H 7H 7C 7D 7D 6S 6H
- `self|382|62` 座3 12张 敌最少9 对家16 级7 上手=pass → **fullhouse:K{KD KH KS AD AD}** [fhAttach,control]<br>手牌: RJ AD AD KS KH KC KC KD QS QC JS JS
- `self|628|48` 座0 13张 敌最少18 对家24 级6 上手=pass → **pair:J{JC JD}** [control,offPlan]<br>手牌: 6H 6S JS JH JC JC JD 7S 7S 7H 7D 5S 5D
- `self|795|60` 座0 12张 敌最少20 对家19 级4 上手=pass → **fullhouse:J{JC JD JD 8H 8C}** [control,offPlan]<br>手牌: JH JC JD JD 10S 10D 9C 9D 8H 8H 8C 8C

### decide 用时 >300ms 的比例

p50 1.8ms，p90 17.1ms，p99 31.6ms，max 1390.7ms

- `vsGreedy0|200082|100` 座2 13张 敌最少2 对家0 级A 上手=single:7 → **bomb:J{JD JH JS JC AH AH}** [forceFinish:likely]<br>手牌: AH AH AS AC AD JS JH JC JD 4S 4C 4C 4D
- `self|309|68` 座1 16张 敌最少1 对家15 级Q 上手=fullhouse:10 → **bomb:A{AD AD AS AH AS}** [noWasteJ,mustBomb,forceFinish:likely]<br>手牌: QH QH QS AS AS AH AD AD 6H 6C 6D 5S 5S 5H 2C 2D
- `self|497|83` 座3 10张 敌最少2 对家0 级5 上手=fullhouse:3 → **bomb:8{8D 8H 8S 8H 5H}** [noWasteJ,forceFinish:bombBack]<br>手牌: 5H 5H 10S 10S 10H 10D 8S 8H 8H 8D
- `self|940|86` 座3 14张 敌最少2 对家0 级6 上手=fullhouse:7 → **bomb:2{2S 2H 2D 2D 6H}** [noWasteJ,forceFinish:likely]<br>手牌: 6H 6H 6S AH AH AC AD 8S 8H 8H 2S 2H 2D 2D
- `self|121|54` 座3 16张 敌最少12 对家18 级6 上手=fullhouse:2 → **pass** []<br>手牌: 6H 6H 6S 6S 6C 10D 9S 9S 9H 8C 4C 4D 4D 3S 3H 3C

### 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）

全部通过

