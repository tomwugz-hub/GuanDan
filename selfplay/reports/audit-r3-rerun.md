# 自对局体检报告

生成：2026/10/18 23:58:06（America/Toronto）　policy：post-selfplay-r3　用时 1072s

对局：自对局 1000 副（四家 decide），混合对手 Random、Greedy、Old:pre-activity、Old:pre-round6 各 200×2 副（换座位）；逐手记录 264997 条；surprise 局面 192 个。

局面 id 可复现：`node selfplay/audit.mjs --replay='<id>'`（cfg|seed|step）。

## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）

- **Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5**：10.4%（n=192，合理区间 ≤5%，严重度 7.5）
- **早盘领出对子占比**：1.6%（n=5555，合理区间 ≥5%，严重度 2.6）
- **早盘领出单张占比**：70.0%（n=5555，合理区间 ≥15 且 ≤55%，严重度 1.0）

## 全部检测器

| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |
|---|---|---|---|---|---|
| 早中盘领出小单（≤10）后两个敌家都不跟 | 8.4% | 4919 | ≤25% | 8.4% | OK |
| 早中盘领出小对（≤10）后两个敌家都不跟 | 27.3% | 645 | ≤35% | 27.1% | OK |
| 跟敌人牌过牌率（early，有牌可出时） | 49.7% | 28934 | ≥30 且 ≤62% | 49.8% | OK |
| 跟敌人牌过牌率（mid，有牌可出时） | 61.5% | 18418 | ≥30 且 ≤65% | 61.4% | OK |
| 跟敌人牌过牌率（late，有牌可出时） | 38.4% | 5041 | ≥20 且 ≤75% | 38.4% | OK |
| 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率 | 25.6% | 14616 | ≤35% | 25.6% | OK |
| 压对家的牌（early，有牌可压时） | 0.0% | 8806 | ≤15% | 0.0% | OK |
| 压对家的牌（mid，有牌可压时） | 0.4% | 6741 | ≤15% | 0.3% | OK |
| 压对家的牌（late，有牌可压时） | 15.1% | 2019 | ≤30% | 14.9% | OK |
| 炸对家（未因此走完） | 0.0% | 16318 | ≤2% | 0.0% | OK |
| 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张时仍过牌 | 44.0% | 25 | ≤60% | 44.0% | 样本少 |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 14.6% | 2057 | ≤15% | 14.3% | OK |
| 敌家都 ≥10 张时领出炸弹（非走完） | 5.5% | 4905 | ≤10% | 5.6% | OK |
| 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌 | 3.9% | 740 | ≤45% | 3.4% | OK |
| 输家结束时手里还留着炸弹（每个输家座位） | 5.1% | 2000 | ≤20% | 5.2% | OK |
| 输家结束时还握着 ≥2 张王/级牌 | 8.3% | 2000 | ≤25% | 8.1% | OK |
| 末游卡手（结束时 ≥8 张且至少还要 5 手） | 0.0% | 1000 | ≤25% | 0.0% | OK |
| 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10） | 0.7% | 12328 | ≤8% | 0.8% | OK |
| 早盘领出 A/级牌/王的单对 | 0.7% | 3978 | ≤12% | 0.7% | OK |
| 拆炸弹领出 | 0.7% | 17364 | ≤2% | 0.7% | OK |
| 早盘拆对领单（手里有顺子/连对/钢板可出） | 0.0% | 3241 | ≤15% | 0.0% | OK |
| 早盘领出对子占比 | 1.6% | 5555 | ≥5% | 1.6% | 🚩 |
| 早盘领出单张占比 | 70.0% | 5555 | ≥15 且 ≤55% | 69.9% | 🚩 |
| 一手能出完却没出完 | 0.0% | 2665 | ≤1% | 0.0% | OK |
| decide 用时 >300ms 的比例 | 0.0% | 180506 | ≤0.5% | 0.0% | OK |
| 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测） | 0.000 | 2600 | ≤0 | 0.000 | OK |
| 对 Random 每副净升级 | 2.928 | 400 | ≥1.5 | 2.925 | OK |
| 对 Greedy 每副净升级 | 2.280 | 400 | ≥0.5 | 2.277 | OK |
| Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5 | 10.4% | 192 | ≤5% | 8.7% | 🚩 |

## 队伍结果

- 自对局 1000 副：南北队每副净升级 0.054 [-0.076, 0.184]（应≈0），双下率 31.2%，平均每副 102 手
- 各座位平均名次（南/东/北/西）：2.43 / 2.50 / 2.53 / 2.54
- decide vs Random：400 副，胜 396/400 (99%)，每副净升级 2.928 [2.884, 2.971]
- decide vs Greedy：400 副，胜 362/400 (91%)，每副净升级 2.280 [2.146, 2.414]
- decide vs Old:pre-activity：400 副，胜 282/400 (71%)，每副净升级 1.015 [0.842, 1.188]
- decide vs Old:pre-round6：400 副，胜 276/400 (69%)，每副净升级 0.975 [0.784, 1.166]

## 详情与示例局面

### 🚩 Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5

分类：lead/late/otherPlay 5，lead/early/otherPlay 4，partner/mid/shouldPass 3，lead/mid/otherPlay 2，enemy/mid/otherPlay 2，partner/early/otherPlay 1，enemy/mid/passed 1，partner/late/shouldPass 1，enemy/late/shouldPass 1

- `self|223|81` partner 24张 张数4/22/24/1 级4 上手=single:8<br>decide: **single:RJ{RJ}** (-2.17) [noSFon8,followUp,blockLikely] vs **single:4{4H}** (+3.50, t=19.9, n=36)<br>手牌: JD 4H 8D 9C 9S 4S 2H RJ 7H AH JS AD QD 7S 8D QS 9C JH 4H 7D 7C QH 8C QD
- `self|544|93` partner 13张 张数2/10/12/13 级K 上手=pair:J<br>decide: **pair:K{KS KD}** (0.42) [blockProb] vs **pass** (+1.89, t=5.7, n=36)<br>手牌: KS KD 4C KH 8C 8S 4S 4H 2C 2H 2S 8D 2C
- `self|329|66` lead 10张 张数14/24/14/10 级6 上手=pass<br>decide: **single:6{6S}** (1.25) [control] vs **bomb:Q{QS QH QD QH QC}** (+1.64, t=4.7, n=36)<br>手牌: QS QH QD 2S QH 2H 2S QC 6S 2C
- `self|926|81` lead 10张 张数13/10/17/18 级5 上手=pass<br>decide: **single:RJ{RJ}** (0.97) [control] vs **bomb:10{10S 10C 10S 10D}** (+1.58, t=4.9, n=36)<br>手牌: 3H 3D 10S 3D 3S 10C 3C 10S RJ 10D
- `self|397|41` lead 21张 张数7/19/21/19 级9 上手=pass<br>decide: **single:2{2S}** (0.36) [holdBombLead,smallFirst,control] vs **fullhouse:K{KC KH KH 8C 8D}** (+1.50, t=4.0, n=36)<br>手牌: 6S 6C KC QH QH 7H 10D 6H 6C 6S 8C 2S AH 8D 10H KH JC 7D AS JH KH
- `self|338|67` lead 8张 张数10/8/25/23 级2 上手=pass<br>decide: **fullhouse:3{3H 3S 3D 2C 2D}** (0.31) [fhAttach,control,planWeakFirst,planStrongFirst] vs **fullhouse:3{3H 3S 3D 6D 6S}** (+1.50, t=3.5, n=36)<br>手牌: 3H 2C 2D 6D 3S 3D 6S 6H
- `self|708|69` enemy 15张 张数15/15/7/14 级8 上手=single:10<br>decide: **pass** (1.11) [] vs **single:BJ{BJ}** (+1.47, t=4.3, n=36)<br>手牌: 8C 7S 7C BJ 7S 7H 8H 6S JD 10S 9H 9S 10H JH 6D
- `self|129|82` partner 14张 张数1/8/17/14 级A 上手=single:A<br>decide: **single:RJ{RJ}** (-2.03) [followUp,blockLikely] vs **pass** (+1.47, t=3.2, n=36)<br>手牌: 6C 8C 6S 8S 8S 6S BJ 4H RJ 6D 4S RJ 4D 8H

### 🚩 早盘领出单张占比

早盘领出牌型分布：single 70%，fullhouse 16%，tripleSeq 5%，pairSeq 5%，triple 3%，pair 2%，straight 0%，bomb 0%；熵 1.46 bit


### 早中盘领出小单（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：413/413 (100%)

- `self|6|26` 座0 24张 敌最少22 对家17 级8 上手=single:10 → **pass** []<br>手牌: 8H 8S 8D AH AC AC AD KS KH QS QC JS JC JD 10S 10C 9C 9D 7S 7D 6D 4H 4D 3H
- `self|189|68` 座2 15张 敌最少12 对家23 级9 上手=single:10 → **pass** []<br>手牌: 9C JS JH JC JD 10S 10C 10C 7S 7D 6S 6H 6C 6D 4S
- `self|420|80` 座0 15张 敌最少12 对家9 级6 上手=single:9 → **pass** [noSFon8]<br>手牌: RJ RJ 8S 8C 8D 7S 7D 7D 4S 4C 4D 4D 3S 3H 3C
- `self|644|76` 座1 7张 敌最少10 对家18 级9 上手=single:8 → **pass** [noSFon8]<br>手牌: 9H 9S 9S 9C 9D AS AH
- `self|814|51` 座0 16张 敌最少15 对家23 级10 上手=single:Q → **pass** []<br>手牌: 10H 10C 10D 7S 7H 7C 7D 6S 6C 6C 6D 3S 3S 3H 3D 2C

### 早中盘领出小对（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：174/176 (99%)

- `self|16|70` 座2 19张 敌最少17 对家14 级5 上手=pair:8 → **pass** []<br>手牌: RJ BJ 5H AS AC AD 9H 9C 9D 9D 8S 8H 8C 3S 3S 3C 2H 2H 2C
- `self|235|77` 座3 16张 敌最少8 对家0 级3 上手=pair:8 → **pass** []<br>手牌: RJ 3H 3S JC 9S 9H 9C 9D 5S 5H 5H 5C 2S 2S 2C 2D
- `self|493|79` 座0 15张 敌最少11 对家15 级A 上手=pair:7 → **pass** []<br>手牌: AH AS 10C 10D 9C 9D 8S 8D 7S 7H 7D 7D 4S 4D 4D
- `self|670|48` 座0 20张 敌最少5 对家0 级9 上手=pair:10 → **pass** []<br>手牌: BJ BJ 9S 9S 9C 9D AH AC AC AD AD KC 10H 8C 7H 6H 6C 6D 4S 3C
- `self|805|76` 座3 25张 敌最少12 对家0 级A 上手=pair:3 → **pass** []<br>手牌: RJ AH AC KH KC QC QC QD JH JH 10H 10D 9D 6S 6C 5S 5H 5C 5D 5D 4S 4H 2S 2H 2D

### 跟敌人牌过牌率（early，有牌可出时）

- `self|1|5` 座1 26张 敌最少25 对家26 级3 上手=single:A → **pass** []<br>手牌: 3S 3C 3D AS AC KH KD QS QH QD JS JC JD 9S 9H 9H 9D 9D 8C 7S 7H 7D 7D 6S 6S 4C
- `self|207|20` 座1 25张 敌最少23 对家24 级A 上手=single:K → **pass** []<br>手牌: RJ AH AD KH KC QH JS JD JD 8S 8H 8C 8D 7S 7H 7D 6H 6C 5H 5D 4H 4D 2S 2H 2H
- `self|399|57` 座1 24张 敌最少5 对家9 级J 上手=single:A → **pass** []<br>手牌: RJ JH JD AS AC KS KC QS QH 10H 10H 9S 9H 9C 9C 8S 8D 4H 4D 3H 3C 2S 2S 2C
- `self|596|21` 座0 25张 敌最少19 对家22 级K 上手=single:Q → **pass** []<br>手牌: KH KS KD AS AC QC QD JS JH JD JD 10C 9S 9H 9D 9D 8H 7S 7D 4S 4C 4D 3S 3C 2C
- `self|801|18` 座0 24张 敌最少24 对家23 级10 上手=single:K → **pass** []<br>手牌: RJ KS KS KH KD JH 9S 9S 9C 8D 6S 6C 6C 5H 4S 4S 4H 4H 4D 4D 3C 2S 2C 2C

### 跟敌人牌过牌率（mid，有牌可出时）

- `self|1|28` 座0 14张 敌最少14 对家24 级3 上手=single:K → **pass** []<br>手牌: RJ BJ JS JH 10H 10H 10C 8S 8H 8H 8D 2C 2C 2D
- `self|197|88` 座2 13张 敌最少8 对家7 级4 上手=single:J → **pass** []<br>手牌: BJ BJ 4S 4C 4D 7S 7C 7D 7D 6S 6H 6H 6C
- `self|416|72` 座3 15张 敌最少4 对家15 级2 上手=single:2 → **pass** []<br>手牌: BJ 2C QS QS QH QC 6S 6H 6H 6C 5H 5H 5C 5D 4D
- `self|622|77` 座1 14张 敌最少11 对家10 级K 上手=pair:7 → **pass** []<br>手牌: KS KC KC KD 7H 7D 5S 5C 5D 5D 4S 4S 4C 4D
- `self|814|55` 座0 16张 敌最少12 对家23 级10 上手=triple:9 → **pass** []<br>手牌: 10H 10C 10D 7S 7H 7C 7D 6S 6C 6C 6D 3S 3S 3H 3D 2C

### 跟敌人牌过牌率（late，有牌可出时）

- `self|1|69` 座1 8张 敌最少7 对家13 级3 上手=single:2 → **pass** []<br>手牌: 9S 9H 9H 9D 7S 7H 7D 7D
- `self|203|70` 座1 9张 敌最少8 对家15 级10 上手=single:5 → **pass** []<br>手牌: 10C 10D 9C 9D 9D 5S 5H 4S 4D
- `self|413|56` 座3 7张 敌最少8 对家23 级Q 上手=pair:6 → **pass** []<br>手牌: QH QC AS 7S 7S 7C 7D
- `self|630|55` 座0 7张 敌最少10 对家9 级8 上手=single:K → **pass** []<br>手牌: RJ 8H AS AD 6H 4S 4H
- `self|807|101` 座1 9张 敌最少10 对家18 级3 上手=pair:8 → **pass** []<br>手牌: RJ BJ 9S 9H 9C 9D 6S 6H 6D

### 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率

按座位 南/东/北/西：970/3686 (26%) / 871/3597 (24%) / 989/3701 (27%) / 918/3632 (25%)

- `self|2|4` 座0 26张 敌最少26 对家26 级4 上手=single:10 → **pass** []<br>手牌: BJ 4S 4C 4D AH AD AD KH KC QS QH JS JD 10S 10S 10C 10C 9H 9C 8S 7C 7D 7D 6C 6D 5D
- `self|198|34` 座3 24张 敌最少21 对家23 级5 上手=single:10 → **pass** []<br>手牌: 5H 5S 5D QS QH QD JS JC JC 10S 10S 9H 9D 9D 8S 8S 8H 8C 7S 7S 7D 6C 4C 4D
- `self|401|48` 座2 20张 敌最少21 对家27 级K 上手=single:8 → **pass** [noSFon8]<br>手牌: BJ KH 10S 10H 10C 10D 10D 9S 9H 9C 8S 8H 7H 6H 6C 5C 5D 3S 3H 3C
- `self|609|40` 座3 16张 敌最少18 对家22 级K 上手=single:7 → **pass** []<br>手牌: RJ RJ 8S 8C 8D 8D 7H 7H 7C 7C 6S 6H 6C 6D 4C 4D
- `self|801|27` 座1 23张 敌最少21 对家23 级10 上手=single:K → **pass** []<br>手牌: BJ 10H 10S AS AH AH AD QH QC QD JS JD 9H 9C 8H 7C 6H 6H 3H 3C 2S 2H 2D

### 压对家的牌（early，有牌可压时）

- `self|223|81` 座2 24张 敌最少1 对家4 级4 上手=single:8 → **single:RJ{RJ}** [noSFon8,followUp,blockLikely]<br>手牌: RJ 4H 4H 4S AH AD QS QH QD QD JS JH JD 9S 9C 9C 8C 8D 8D 7S 7H 7C 7D 2H
- `self|232|59` 座3 20张 敌最少2 对家4 级K 上手=single:8 → **single:K{KC}** [noSFon8,followUp]<br>手牌: RJ KS KC AS AH AC 10H 10D 9S 9D 8S 8C 8C 8D 6H 6H 2S 2H 2D 2D

### 压对家的牌（mid，有牌可压时）

- `self|3|87` 座1 12张 敌最少1 对家0 级5 上手=single:A → **single:RJ{RJ}** [followUp,blockSure]<br>手牌: RJ 7S 7C 7D 6H 6C 6D 4S 4C 4C 3S 2H
- `self|307|100` 座1 10张 敌最少8 对家12 级10 上手=fullhouse:2 → **fullhouse:4{4C 4D 4C 7S 7C}** []<br>手牌: 7S 7H 7C 7D 6H 6C 6D 4C 4C 4D
- `self|421|82` 座3 13张 敌最少1 对家0 级7 上手=single:7 → **single:RJ{RJ}** [followUp,blockLikely]<br>手牌: RJ 7D 10S 10C 10D 9S 9H 9C 8S 8H 8D 2C 2D
- `self|507|75` 座1 10张 敌最少6 对家17 级2 上手=fullhouse:10 → **fullhouse:2{2D 2D 2C 9H 9C}** [fhAttach,forceFinish:bombBack]<br>手牌: 2H 2C 2D 2D 9H 9C 7H 7C 7D 7D
- `self|663|98` 座0 12张 敌最少1 对家0 级2 上手=single:Q → **single:2{2D}** [keepStruct,followUp,blockSure]<br>手牌: 2H 2D AC AD QH JH JD 10S 6C 6C 3H 3C

### 压对家的牌（late，有牌可压时）

- `self|5|75` 座0 4张 敌最少18 对家13 级7 上手=single:RJ → **bomb:7{7C 7D 7D 7S}**<br>手牌: 7S 7C 7D 7D
- `self|224|61` 座0 7张 敌最少17 对家19 级5 上手=single:2 → **single:3{3S}** [followUp,strongBeforeLast]<br>手牌: JS JC 10H 10C 9S 9C 3S
- `self|415|73` 座1 6张 敌最少16 对家6 级A 上手=single:K → **single:RJ{RJ}** [followUp,keepControlSoft,strongBeforeLast,forceFinish:likely]<br>手牌: RJ AC AD 9H 9C 9C
- `self|594|83` 座0 5张 敌最少9 对家2 级J 上手=single:BJ → **single:RJ{RJ}** [followUp,strongBeforeLast,forceFinish:bombBack]<br>手牌: RJ 9S 9S 9H 9H
- `self|752|89` 座0 3张 敌最少2 对家5 级K 上手=pair:9 → **pair:A{AD AH}** []<br>手牌: RJ AH AD

### 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张时仍过牌

- `self|8|68` 座0 10张 敌最少1 对家8 级10 上手=pair:2 → **pass** [mustBomb]<br>手牌: AC QS QH JH JD 7H 5S 5H 5C 5C
- `self|194|83` 座0 4张 敌最少1 对家8 级A 上手=pair:6 → **pass** []<br>手牌: BJ AH AD AD
- `self|454|81` 座2 20张 敌最少3 对家5 级A 上手=pair:3 → **pass** []<br>手牌: AS AD QH QD 9D 8H 8H 8C 7H 7C 7C 7D 4S 4H 4C 3D 2S 2H 2H 2D
- `self|503|68` 座0 13张 敌最少1 对家10 级J 上手=pair:5 → **pass** [mustBomb]<br>手牌: RJ JS JC KC KD KD 5S 5S 5C 5C 5D 3H 3H
- `self|503|80` 座0 13张 敌最少1 对家4 级J 上手=pair:7 → **pass** [mustBomb]<br>手牌: RJ JS JC KC KD KD 5S 5S 5C 5C 5D 3H 3H

### 敌家都 ≥15 张时炸普通牌（占跟牌炸弹）

每副炸弹数（自对局，四人合计）：早 0.40 / 中 1.89 / 晚 2.61

- `self|2|63` 座3 14张 敌最少18 对家0 级4 上手=pair:A → **bomb:K{KD KS KH KC KD}** [mustBomb]<br>手牌: RJ 4S KS KH KC KD KD 7S 7C 3C 2S 2S 2H 2D
- `self|202|69` 座1 17张 敌最少16 对家15 级9 上手=fullhouse:9 → **bomb:6{6H 6H 6D 6C}** [noWasteJ,mustBomb]<br>手牌: BJ 9S QD 8H 8C 8C 8D 6H 6H 6C 6D 5S 5D 5D 3S 3H 3C
- `self|361|70` 座2 20张 敌最少19 对家13 级Q 上手=pairSeq:K → **bomb:8{8H 8D 8S 8C QH}** [mustBomb]<br>手牌: QH QS QS AS AH AC AD JS JC JD 8S 8H 8C 8D 6S 6S 6H 6C 5C 5D
- `self|562|73` 座0 10张 敌最少20 对家14 级5 上手=pair:8 → **bomb:4{4H 4C 4D 4D}** [mustBomb]<br>手牌: QD 6S 6H 6C 6C 4H 4C 4D 4D 3C
- `self|805|89` 座0 13张 敌最少23 对家2 级A 上手=pair:A → **bomb:3{3H 3D 3C 3C}** [mustBomb,controlFeed:pair]<br>手牌: RJ AD 9S 9C 9D 8S 8S 8H 8D 3H 3C 3C 3D

### 敌家都 ≥10 张时领出炸弹（非走完）

炸压炸占跟牌炸弹：1461/3518 (42%)

- `self|5|58` 座3 8张 敌最少14 对家19 级7 上手=pass → **bomb:3{3H 3C 3D 3S}** [holdBombLead,control,leadBombLate]<br>手牌: QS QS QH QD 3S 3H 3C 3D
- `self|234|100` 座1 7张 敌最少12 对家9 级2 上手=pass → **bomb:K{KD KC KH KD}** [keepBombForControl,control,forceFinish:likely]<br>手牌: KH KC KD KD 6C 6D 6D
- `self|476|56` 座2 8张 敌最少16 对家26 级10 上手=pass → **bomb:8{8S 8H 8S 8C}** [holdBombLead,control,leadBombLate]<br>手牌: KS KS KH KC 8S 8S 8H 8C
- `self|671|63` 座0 8张 敌最少17 对家16 级10 上手=pass → **bomb:4{4C 4D 4S 4H}** [holdBombLead,control,leadBombLate]<br>手牌: AH AH AD AD 4S 4H 4C 4D
- `self|830|50` 座3 8张 敌最少14 对家24 级K 上手=pass → **bomb:2{2H 2D 2D 2H}** [holdBombLead,control,leadBombLate]<br>手牌: 5S 5H 5C 5D 2H 2H 2D 2D

### 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌

- `self|16|117` 座3 7张 敌最少3 对家0 级5 上手=fullhouse:3 → **pass** []<br>手牌: AH 3H 3H 3C 3D 2S 2D
- `self|170|121` 座3 12张 敌最少2 对家0 级3 上手=fullhouse:9 → **pass** []<br>手牌: BJ 3H 9D 6S 6H 6C 6C 5S 5S 5H 5C 5C
- `self|354|75` 座0 6张 敌最少2 对家2 级5 上手=triple:10 → **pass** []<br>手牌: BJ 5D 3S 3S 3H 3D
- `self|641|71` 座1 16张 敌最少3 对家10 级6 上手=fullhouse:7 → **pass** []<br>手牌: RJ 6S 10H 10C 7C 7D 5H 5C 5D 4S 4H 3S 3S 3H 3D 3D
- `self|714|83` 座3 6张 敌最少3 对家2 级A 上手=single:6 → **pass** []<br>手牌: 6H 5H 3S 3S 3H 3D

### 输家结束时手里还留着炸弹（每个输家座位）

- `self|8` 座0 结束时手里：5H 7H JD JH QH 5C QS 5C 5S
- `self|32` 座3 结束时手里：7H 7C 8D 7S QH QC QS 7D 2S 6S QD 2D 6D
- `self|43` 座2 结束时手里：6D 5H 5S 5H 6H
- `self|62` 座2 结束时手里：5H 5S 5S QD 7H QS RJ 5D 7C KH 7S
- `self|63` 座0 结束时手里：4D 4H 4D 8S 4H 6D

### 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10）

- `self|8|38` 座2 22张 敌最少2 对家18 级10 上手=pair:K → **pair:10{10C 10H}** [stopShort,followSize]<br>手牌: RJ BJ 10H 10C AH AH JS 9C 8S 8C 6S 6S 6H 6D 4S 4C 4D 3H 3C 3C 2D 2D
- `self|215|87` 座1 21张 敌最少2 对家0 级9 上手=pair:8 → **pair:9{9C 9D}** [stopShort,followSize]<br>手牌: 9H 9H 9C 9D KH KC KD KD 7H 7H 7D 6H 6C 6D 4H 4C 4D 3H 3C 2S 2H
- `self|424|54` 座1 20张 敌最少8 对家10 级10 上手=single:10 → **single:BJ{BJ}** [followUp,followSize,keepControl,spareControl]<br>手牌: RJ BJ 10H 10C 10C KS KS KH KH QS QH JH JD 9D 8C 8D 7S 7H 5H 5C
- `self|722|77` 座0 20张 敌最少1 对家0 级9 上手=single:5 → **single:RJ{RJ}** [stopShort,followUp,followSize,blockLikely]<br>手牌: RJ 9C 9D KS QS QS QH QD JS JH 10H 10C 7H 5S 3C 3C 3D 2C 2C 2D
- `self|873|5` 座2 26张 敌最少26 对家27 级4 上手=pass → **single:BJ{BJ}** [control]<br>手牌: RJ BJ 4H 4D KS KC JC JD 10C 10D 9S 9C 8H 8D 7S 7H 6S 6C 5S 5S 5H 5D 3H 3D 2C 2D

### 早盘领出 A/级牌/王的单对

- `self|28|17` 座1 21张 敌最少25 对家27 级4 上手=pass → **single:RJ{RJ}** [control]<br>手牌: RJ AS AC 10C 10D 9S 9D 8H 8D 7H 7H 6H 6H 5S 5D 3C 3D 2S 2H 2H 2C
- `self|301|39` 座2 20张 敌最少16 对家22 级4 上手=pass → **pair:A{AH AH}** [control]<br>手牌: BJ BJ AH AH QC QD 10S 10H 10D 10D 8S 8D 7H 7C 7D 7D 5C 5D 3C 3C
- `self|439|26` 座3 25张 敌最少25 对家22 级Q 上手=pass → **pair:RJ{RJ RJ}** [control]<br>手牌: RJ RJ QH QD QD AH AC 10S 10H 9S 9H 6S 6S 6H 6D 5H 5C 4D 4D 3C 3D 2S 2H 2C 2D
- `self|705|31` 座1 20张 敌最少20 对家22 级5 上手=pass → **pair:BJ{BJ BJ}** [control]<br>手牌: BJ BJ 5S 5D QH QC JS JD 8S 8H 8H 8C 7S 7H 6C 6C 3S 3H 3H 3D
- `self|809|65` 座1 21张 敌最少8 对家10 级5 上手=pass → **single:RJ{RJ}** [control]<br>手牌: RJ 5S 5C AS AD KS KD JS JH 10H 10C 7H 7C 7D 7D 6H 6D 4S 4D 2H 2C

### 拆炸弹领出

- `self|9|56` 座2 12张 敌最少14 对家21 级J 上手=pass → **triple:J{JS JD JS}** [bombBreakNoGain,control,offPlan]<br>手牌: JS JS JC JD QS QS QD QD 6S 6C 6D 6D
- `self|224|53` 座0 12张 敌最少17 对家25 级5 上手=pass → **fullhouse:3{3H 3S 3D 10S 10H}** [fhAttach,control,offPlan]<br>手牌: JS JC 10S 10H 10H 10C 9S 9C 3S 3S 3H 3D
- `self|379|73` 座1 10张 敌最少19 对家17 级4 上手=pass → **fullhouse:6{6H 6S 6C 9D 9S}** [control,offPlan]<br>手牌: 4H 4H 9S 9H 9H 9D 6S 6H 6H 6C
- `self|615|75` 座1 10张 敌最少16 对家16 级6 上手=pass → **fullhouse:J{JD JS JS 10C 10S}** [control,offPlan]<br>手牌: JS JS JH JH JC JD 10S 10H 10C 10D
- `self|781|68` 座0 15张 敌最少14 对家8 级3 上手=pass → **pairSeq:9{7S 7S 8C 8D 9S 9C}** [holdBombLead,control]<br>手牌: 3H 3S 3C 3C 3D 10S 10H 9S 9C 8S 8S 8C 8D 7S 7S

### decide 用时 >300ms 的比例

p50 2ms，p90 19.7ms，p99 34.3ms，max 1379.2ms

- `vsGreedy0|200082|100` 座2 13张 敌最少2 对家0 级A 上手=single:7 → **bomb:J{JD JH JS JC AH AH}** [forceFinish:likely]<br>手牌: AH AH AS AC AD JS JH JC JD 4S 4C 4C 4D
- `self|940|86` 座3 14张 敌最少2 对家0 级6 上手=fullhouse:7 → **bomb:2{2S 2H 2D 2D 6H}** [noWasteJ,forceFinish:likely]<br>手牌: 6H 6H 6S AH AH AC AD 8S 8H 8H 2S 2H 2D 2D
- `self|497|83` 座3 10张 敌最少2 对家0 级5 上手=fullhouse:3 → **bomb:8{8D 8H 8S 8H 5H}** [noWasteJ,forceFinish:bombBack]<br>手牌: 5H 5H 10S 10S 10H 10D 8S 8H 8H 8D
- `vsGreedy0|200025|19` 座0 16张 敌最少16 对家21 级9 上手=fullhouse:4 → **pass** []<br>手牌: 9H 9H 9C 9D KC JD 10S 10S 10D 8H 8H 8D 7D 5S 5C 5D
- `self|721|94` 座0 16张 敌最少7 对家0 级8 上手=fullhouse:2 → **bomb:4{4S 4D 4S 4H}** [noWasteJ,mustBomb]<br>手牌: BJ 8H 8H 10S 10C 10D 7D 5S 5H 5C 4S 4S 4H 4D 2H 2C

### 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）

全部通过

