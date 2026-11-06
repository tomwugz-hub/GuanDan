# 自对局体检报告

生成：2026/10/18 11:30:31（America/Toronto）　policy：current　用时 572s

对局：自对局 1000 副（四家 decide），混合对手 Random、Greedy、Old:pre-activity、Old:pre-round6 各 200×2 副（换座位）；逐手记录 273782 条；surprise 局面 194 个。

局面 id 可复现：`node selfplay/audit.mjs --replay='<id>'`（cfg|seed|step）。

## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）

- **拆炸弹领出**：6.1%（n=17519，合理区间 ≤2%，严重度 10.5）
- **Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5**：8.2%（n=194，合理区间 ≤5%，严重度 4.5）
- **早盘领出对子占比**：0.2%（n=5461，合理区间 ≥5%，严重度 3.6）
- **早盘领出单张占比**：70.3%（n=5461，合理区间 ≥15 且 ≤55%，严重度 1.0）
- **一手能出完却没出完**：1.2%（n=2646，合理区间 ≤1%，严重度 0.4）
- **对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张时仍过牌**：64.2%（n=53，合理区间 ≤60%，严重度 0.2）

## 全部检测器

| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |
|---|---|---|---|---|---|
| 早中盘领出小单（≤10）后两个敌家都不跟 | 8.7% | 5548 | ≤25% | - | OK |
| 早中盘领出小对（≤10）后两个敌家都不跟 | 17.6% | 507 | ≤35% | - | OK |
| 跟敌人牌过牌率（early，有牌可出时） | 48.3% | 28123 | ≥30 且 ≤62% | - | OK |
| 跟敌人牌过牌率（mid，有牌可出时） | 59.1% | 19975 | ≥30 且 ≤65% | - | OK |
| 跟敌人牌过牌率（late，有牌可出时） | 41.3% | 6337 | ≥20 且 ≤75% | - | OK |
| 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率 | 26.0% | 16400 | ≤35% | - | OK |
| 压对家的牌（early，有牌可压时） | 0.0% | 8103 | ≤15% | - | OK |
| 压对家的牌（mid，有牌可压时） | 0.4% | 7327 | ≤15% | - | OK |
| 压对家的牌（late，有牌可压时） | 13.5% | 2617 | ≤30% | - | OK |
| 炸对家（未因此走完） | 0.0% | 16387 | ≤2% | - | OK |
| 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张时仍过牌 | 64.2% | 53 | ≤60% | - | 🚩 |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 10.3% | 2053 | ≤15% | - | OK |
| 敌家都 ≥10 张时领出炸弹（非走完） | 1.7% | 4026 | ≤10% | - | OK |
| 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌 | 6.0% | 788 | ≤45% | - | OK |
| 输家结束时手里还留着炸弹（每个输家座位） | 3.5% | 2000 | ≤20% | - | OK |
| 输家结束时还握着 ≥2 张王/级牌 | 7.2% | 2000 | ≤25% | - | OK |
| 末游卡手（结束时 ≥8 张且至少还要 5 手） | 0.0% | 1000 | ≤25% | - | OK |
| 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10） | 0.4% | 12382 | ≤8% | - | OK |
| 早盘领出 A/级牌/王的单对 | 0.1% | 3849 | ≤12% | - | OK |
| 拆炸弹领出 | 6.1% | 17519 | ≤2% | - | 🚩 |
| 早盘拆对领单（手里有顺子/连对/钢板可出） | 0.0% | 3235 | ≤15% | - | OK |
| 早盘领出对子占比 | 0.2% | 5461 | ≥5% | - | 🚩 |
| 早盘领出单张占比 | 70.3% | 5461 | ≥15 且 ≤55% | - | 🚩 |
| 一手能出完却没出完 | 1.2% | 2646 | ≤1% | - | 🚩 |
| decide 用时 >300ms 的比例 | 0.0% | 187648 | ≤0.5% | - | OK |
| 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测） | 0.000 | 2600 | ≤0 | - | OK |
| 对 Random 每副净升级 | 2.905 | 400 | ≥1.5 | - | OK |
| 对 Greedy 每副净升级 | 2.112 | 400 | ≥0.5 | - | OK |
| Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5 | 8.2% | 194 | ≤5% | - | 🚩 |

## 队伍结果

- 自对局 1000 副：南北队每副净升级 0.017 [-0.117, 0.151]（应≈0），双下率 35.5%，平均每副 106 手
- 各座位平均名次（南/东/北/西）：2.42 / 2.50 / 2.54 / 2.54
- decide vs Random：400 副，胜 397/400 (99%)，每副净升级 2.905 [2.861, 2.949]
- decide vs Greedy：400 副，胜 349/400 (87%)，每副净升级 2.112 [1.959, 2.266]
- decide vs Old:pre-activity：400 副，胜 247/400 (62%)，每副净升级 0.340 [0.156, 0.524]
- decide vs Old:pre-round6：400 副，胜 233/400 (58%)，每副净升级 0.242 [0.059, 0.426]

## 详情与示例局面

### 🚩 拆炸弹领出

- `self|1|95` 座1 8张 敌最少7 对家0 级3 上手=pass → **fullhouse:7{7H 7D 7D 9D 9H}** [control,offPlan]<br>手牌: 9S 9H 9H 9D 7S 7H 7D 7D
- `self|214|35` 座1 21张 敌最少21 对家24 级8 上手=pass → **fullhouse:4{4S 4D 4C 7H 7D}** [control]<br>手牌: 8C 8D QS QH QD 9C 9D 7H 7C 7C 7D 6S 6D 4S 4C 4D 2S 2S 2H 2H 2D
- `self|438|32` 座2 23张 敌最少22 对家23 级J 上手=pass → **fullhouse:2{2C 2S 2D 3H 3D}** [control]<br>手牌: RJ JD AH KS KS KC 10S 10H 10D 10D 9S 9H 9C 6C 6D 4D 4D 3H 3D 2S 2S 2C 2D
- `self|622|29` 座1 22张 敌最少24 对家26 级K 上手=pass → **fullhouse:4{4S 4D 4C 3D 3C}** [control]<br>手牌: KS KC KC KD 10S 10D 8S 8H 7H 7D 5S 5C 5D 5D 4S 4S 4C 4D 3C 3D 2S 2C
- `self|809|70` 座0 25张 敌最少6 对家0 级5 上手=pass → **fullhouse:J{JS JC JD QS QC}** [control]<br>手牌: RJ 5D 5D AC AC KH KD QS QC JS JC JC JD 9S 9H 9D 9D 6H 6C 6D 4S 4C 4D 3S 3S

### 🚩 Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5

分类：enemy/late/passed 3，enemy/mid/passed 3，lead/mid/otherPlay 2，lead/early/otherPlay 2，partner/late/passed 2，lead/late/otherPlay 2，enemy/late/shouldPass 1，partner/late/shouldPass 1

- `self|422|72` lead 10张 张数10/8/11/22 级8 上手=pass<br>decide: **single:8{8D}** (-1.86) [control,planKeepControl] vs **fullhouse:4{4C 4H 4H 3H 3D}** (+2.39, t=7.9, n=36)<br>手牌: 4C 3H 8D 4H 5S RJ 4H 5H 4S 3D
- `self|280|66` enemy 4张 张数4/19/13/13 级9 上手=single:K<br>decide: **pass** (-0.22) [] vs **single:BJ{BJ}** (+2.25, t=6.1, n=36)<br>手牌: BJ KD RJ KH
- `self|250|93` enemy 14张 张数24/14/8/5 级5 上手=single:5<br>decide: **pass** (-1.06) [] vs **single:BJ{BJ}** (+2.14, t=4.8, n=36)<br>手牌: BJ 3H RJ 2H JS JS 3S 3C 2D 7C 3D 7S JD 3D
- `self|909|26` lead 23张 张数22/23/23/23 级A 上手=pass<br>decide: **single:2{2D}** (-0.61) [holdBombLead,smallFirst,control] vs **fullhouse:J{JC JH JH 4S 4H}** (+1.81, t=4.2, n=36)<br>手牌: 3S 3D KD 7D JC 4S 8D RJ JH 9S JH 9D 7C 3C AC 9H 4H 4H 2D 3S 8C KD 3D
- `self|69|44` enemy 8张 张数24/8/21/24 级6 上手=single:J<br>decide: **pass** (0.58) [] vs **single:BJ{BJ}** (+1.78, t=4.8, n=36)<br>手牌: 4C 4S BJ RJ 4S 4D 6C 6S
- `self|395|19` lead 26张 张数26/23/24/27 级7 上手=pass<br>decide: **pairSeq:6{4D 4H 5S 5C 6S 6C}** (-0.75) [keepShape,control] vs **pairSeq:8{6S 6C 7D 7S 8D 8H}** (+1.56, t=3.7, n=36)<br>手牌: QD 7D 7S 4D 10H AS 9S KC JD 5S 8D KD 8H 10S 2D 6S 3H QS QS 4H JD 6C 5C 9D 5S 2C
- `self|237|71` lead 13张 张数12/12/13/9 级5 上手=pass<br>decide: **single:9{9S}** (0.44) [holdBombLead,smallFirst,control] vs **fullhouse:4{4S 4C 4C 9S 5H}** (+1.50, t=3.5, n=36)<br>手牌: RJ 10S 5H 5S 4S 10H 10D 4C 10C 9S 4C 2C 2H
- `self|853|92` partner 7张 张数7/7/10/8 级10 上手=pair:K<br>decide: **pass** (1.14) [] vs **pair:10{10C 10S}** (+1.39, t=3.8, n=36)<br>手牌: 10C 10H 2H 9D 10S 2C 9S

### 🚩 早盘领出单张占比

早盘领出牌型分布：single 70%，fullhouse 20%，tripleSeq 5%，pairSeq 5%，pair 0%，straight 0%，bomb 0%；熵 1.27 bit


### 🚩 一手能出完却没出完

- `self|40|127` 座2 5张 敌最少12 对家5 级3 上手=pass → **pair:3{3C 3D}** [shortEnemyShape,control,forceFinish:likely]<br>手牌: 3C 3D 6H 6C 6D
- `self|203|124` 座0 3张 敌最少8 对家0 级10 上手=pass → **single:10{10H}** [shortEnemyShape,control,forceFinish:likely]<br>手牌: 10H 7H 7H
- `self|299|105` 座1 5张 敌最少18 对家15 级2 上手=pass → **pair:2{2S 2D}** [shortEnemyShape,control,forceFinish:likely]<br>手牌: 2S 2D 7S 7H 7C
- `self|602|95` 座1 4张 敌最少8 对家12 级6 上手=pass → **single:6{6H}** [shortEnemyShape,control]<br>手牌: 6H 3S 3H 3D
- `self|780|77` 座3 3张 敌最少1 对家0 级2 上手=pass → **pair:2{2H 2H}** [shortEnemyShape,control]<br>手牌: 2H 2H 8C

### 🚩 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张时仍过牌

- `self|8|68` 座0 10张 敌最少1 对家8 级10 上手=pair:2 → **pass** [mustBomb]<br>手牌: AC QS QH JH JD 7H 5S 5H 5C 5C
- `self|171|84` 座3 9张 敌最少3 对家8 级4 上手=single:8 → **pass** [noSFon8]<br>手牌: BJ 4S 8S 8C 6S 6C 3S 3H 3D
- `self|307|72` 座1 15张 敌最少3 对家16 级10 上手=single:6 → **pass** []<br>手牌: BJ 7S 7H 7C 7D 6H 6C 6D 4C 4C 4D 3S 3H 2H 2C
- `self|436|83` 座3 13张 敌最少2 对家6 级9 上手=single:8 → **pass** [noSFon8]<br>手牌: RJ QS QH QH QC QD 8S 8H 8H 4H 4D 3H 3D
- `self|503|76` 座0 16张 敌最少1 对家4 级J 上手=pair:7 → **pass** [mustBomb]<br>手牌: RJ JS JC KC KD KD QS QS QH 5S 5S 5C 5C 5D 3H 3H

### 早中盘领出小单（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：482/483 (100%)

- `self|5|87` 座0 12张 敌最少9 对家14 级7 上手=single:8 → **pass** [noSFon8]<br>手牌: 7S 7C 7D 7D KS KH KC KD 8C 4S 4C 4C
- `self|237|72` 座3 9张 敌最少12 对家12 级5 上手=single:9 → **pass** [noSFon8]<br>手牌: BJ 5H 5C KH KC 8H 7S 7H 7D
- `self|424|33` 座0 20张 敌最少16 对家21 级10 上手=single:Q → **pass** []<br>手牌: 10H 10S 10D 9H 9C 9D 8S 8H 8C 8D 7D 6H 6D 5S 5C 5D 5D 2S 2C 2D
- `self|671|83` 座0 8张 敌最少10 对家10 级10 上手=single:3 → **pass** []<br>手牌: 4S 4H 4C 4D 2S 2H 2C 2C
- `self|832|59` 座2 19张 敌最少11 对家11 级2 上手=single:9 → **pass** [noSFon8]<br>手牌: RJ 2C AS AH AC AD 8S 8H 8D 7S 7S 7C 7D 6S 6D 5S 5D 4S 4C

### 早中盘领出小对（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：82/89 (92%)

- `self|19|74` 座0 14张 敌最少11 对家12 级8 上手=pair:3 → **pass** []<br>手牌: BJ QS QH QD JS JH JD 5S 5C 5D 4S 4H 4C 4D
- `self|219|84` 座2 9张 敌最少8 对家18 级K 上手=pair:6 → **pass** []<br>手牌: RJ KH KS 8S 8C 8D 8D 5H 5H
- `self|412|76` 座1 15张 敌最少8 对家11 级J 上手=pair:6 → **pass** []<br>手牌: RJ JC 10H 10D 9S 9D 8S 8C 8D 5C 4H 2S 2C 2C 2D
- `self|617|70` 座2 19张 敌最少7 对家19 级8 上手=pair:2 → **pass** []<br>手牌: RJ 8H 8C KS KH KC KD 9C 6C 5H 5C 5D 4S 4C 4D 4D 3S 3C 3C
- `self|759|78` 座0 9张 敌最少11 对家18 级7 上手=pair:8 → **pass** []<br>手牌: RJ 7D 6S 6H 6H 6C 5H 5D 5D

### 跟敌人牌过牌率（early，有牌可出时）

- `self|1|5` 座1 26张 敌最少25 对家26 级3 上手=single:A → **pass** []<br>手牌: 3S 3C 3D AS AC KH KD QS QH QD JS JC JD 9S 9H 9H 9D 9D 8C 7S 7H 7D 7D 6S 6S 4C
- `self|210|30` 座2 25张 敌最少20 对家22 级4 上手=single:A → **pass** []<br>手牌: 4D 4D AS AH KS KS KC QS QD JS JS JC 10S 10D 9S 9D 8H 6S 6C 5S 5S 5D 3H 2C 2D
- `self|397|21` 座2 26张 敌最少24 对家23 级9 上手=single:K → **pass** []<br>手牌: 9S 9C 9D AS AH KH KH KC QH QH JH JC 10H 10D 8C 8D 7H 7D 6S 6S 6H 6C 6C 4S 4C 2S
- `self|591|6` 座3 26张 敌最少26 对家26 级8 上手=single:BJ → **pass** []<br>手牌: RJ 8H 8H 8S 8D AC AD KS KH KD QS 10H 9H 9H 9D 9D 7S 5S 5S 5H 4D 3H 3C 2H 2C 2D
- `self|802|41` 座2 26张 敌最少14 对家17 级J 上手=straight:6 → **pass** []<br>手牌: JH JC JC JD AS AD KH KD QS QD 10H 10D 8C 8D 7H 7C 6S 6H 6H 6C 5H 4S 3D 3D 2S 2S

### 跟敌人牌过牌率（mid，有牌可出时）

- `self|1|28` 座0 14张 敌最少14 对家24 级3 上手=single:K → **pass** []<br>手牌: RJ BJ 10H 10H 10C 8S 8H 8H 8D 5H 5D 2C 2C 2D
- `self|197|73` 座3 13张 敌最少13 对家13 级4 上手=single:Q → **pass** []<br>手牌: RJ 4D JS JH JC JD 10H 10C 10D 6S 6D 3D 3D
- `self|412|88` 座1 15张 敌最少5 对家11 级J 上手=single:BJ → **pass** []<br>手牌: RJ JC 10H 10D 9S 9D 8S 8C 8D 5C 4H 2S 2C 2C 2D
- `self|620|77` 座2 12张 敌最少4 对家18 级J 上手=pair:J → **pass** []<br>手牌: BJ BJ 8S 7C 4S 4H 4C 4D 3S 3H 3H 3C
- `self|800|90` 座2 11张 敌最少10 对家9 级9 上手=single:7 → **pass** []<br>手牌: RJ 9H 9C 10S 10S 10H 5S 5C 2H 2C 2D

### 跟敌人牌过牌率（late，有牌可出时）

- `self|1|69` 座1 8张 敌最少7 对家13 级3 上手=single:2 → **pass** []<br>手牌: 9S 9H 9H 9D 7S 7H 7D 7D
- `self|193|45` 座2 9张 敌最少14 对家25 级K 上手=single:9 → **pass** [noSFon8]<br>手牌: BJ BJ KS KD QH QD 4D 3H 3D
- `self|389|97` 座1 7张 敌最少10 对家11 级A 上手=triple:5 → **pass** []<br>手牌: AC QS QH QC QD 4C 4D
- `self|621|79` 座3 7张 敌最少10 对家18 级Q 上手=pair:9 → **pass** []<br>手牌: BJ QH AS KH 6H 6C 6C
- `self|829|39` 座2 8张 敌最少17 对家18 级Q 上手=single:K → **pass** []<br>手牌: RJ BJ QH 10H 4H 4C 3S 3H

### 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率

按座位 南/东/北/西：1099/4127 (27%) / 1038/4093 (25%) / 1073/4073 (26%) / 1046/4107 (25%)

- `self|2|4` 座0 26张 敌最少26 对家26 级4 上手=single:10 → **pass** []<br>手牌: BJ 4S 4C 4D AH AD AD KH KC QS QH JS JD 10S 10S 10C 10C 9H 9C 8S 7C 7D 7D 6C 6D 5D
- `self|204|111` 座3 11张 敌最少6 对家2 级J 上手=single:7 → **pass** []<br>手牌: AH AH AC AD AD 7S 7H 7C 7D 4S 4D
- `self|401|90` 座0 21张 敌最少8 对家13 级K 上手=single:10 → **pass** []<br>手牌: KS KD AS AH AC AD QC QD JH JD JD 9S 9D 6C 6D 5D 4H 4H 4D 2H 2C
- `self|617|54` 座2 21张 敌最少10 对家19 级8 上手=single:9 → **pass** [noSFon8]<br>手牌: RJ 8H 8C KS KH KC KD 9C 7S 7C 6C 5H 5C 5D 4S 4C 4D 4D 3S 3C 3C
- `self|806|87` 座3 19张 敌最少9 对家9 级2 上手=single:8 → **pass** [noSFon8]<br>手牌: BJ 2C 10S 10S 10H 10D 9S 9C 9D 9D 8S 8S 8C 8C 6S 6H 6H 6C 6D

### 压对家的牌（early，有牌可压时）

- `self|232|59` 座3 20张 敌最少2 对家4 级K 上手=single:8 → **single:K{KC}** [noSFon8,followUp]<br>手牌: RJ KS KC AS AH AC 10H 10D 9S 9D 8S 8C 8C 8D 6H 6H 2S 2H 2D 2D
- `self|482|82` 座3 21张 敌最少1 对家7 级3 上手=single:3 → **single:BJ{BJ}** [followUp]<br>手牌: BJ BJ 3H 3S 3S 3D 3D QH QC QC QD QD 10S 10D 9C 8H 8C 6H 5D 4S 4H
- `self|935|76` 座3 22张 敌最少2 对家7 级A 上手=single:5 → **single:J{JD}** [followUp]<br>手牌: RJ AH AS AS KS KH KC KD KD JD 9S 9H 9H 9C 7C 7D 3S 3D 3D 2H 2C 2D

### 压对家的牌（mid，有牌可压时）

- `self|10|86` 座0 10张 敌最少1 对家0 级Q 上手=pair:4 → **pair:K{KH KC}** [forceFinish:sure,blockSure]<br>手牌: AH AD KH KC 10H 10C 3S 3H 3D 3D
- `self|183|51` 座1 11张 敌最少12 对家15 级3 上手=fullhouse:A → **fullhouse:3{3D 3D 3C 4C 4H}** []<br>手牌: 3H 3C 3D 3D QH QD JH JC JD 4H 4C
- `self|334|91` 座3 10张 敌最少12 对家10 级J 上手=fullhouse:3 → **fullhouse:4{4D 4H 4S JC JD}** []<br>手牌: JH JC JD QC 8S 8C 8D 4S 4H 4D
- `self|453|79` 座2 10张 敌最少12 对家15 级K 上手=fullhouse:5 → **fullhouse:K{KS KC 4S 4C KH}** [keepWild,forceFinish:bombBack]<br>手牌: KH KH KS KC 9S 9H 9D 9D 4S 4C
- `self|663|98` 座0 12张 敌最少1 对家0 级2 上手=single:Q → **single:2{2D}** [keepStruct,followUp,blockSure]<br>手牌: 2H 2D AC AD QH JH JD 10S 6C 6C 3H 3C

### 压对家的牌（late，有牌可压时）

- `self|7|96` 座2 8张 敌最少3 对家11 级9 上手=pair:6 → **pair:9{9S 9C}** [forceFinish:sure]<br>手牌: 9H 9S 9S 9C 7S 7S 7C 5D
- `self|222|84` 座0 2张 敌最少3 对家0 级3 上手=single:K → **single:3{3S}** [followUp,strongBeforeLast,forceFinish:sure]<br>手牌: 3S 8H
- `self|409|109` 座2 9张 敌最少3 对家0 级8 上手=single:8 → **single:BJ{BJ}** [noSFon8,followUp,forceFinish:sure]<br>手牌: BJ 9S 9H 9H 9D 6H 4C 4C 4D
- `self|596|75` 座3 9张 敌最少1 对家0 级K 上手=single:K → **single:RJ{RJ}** [followUp,blockSure]<br>手牌: RJ BJ KC QH JH 9S 9C 7H 7C
- `self|795|78` 座2 6张 敌最少9 对家8 级4 上手=single:J → **single:RJ{RJ}** [followUp,keepControl,strongBeforeLast,forceFinish:likely]<br>手牌: RJ 4H 4D 5H 5H 5D

### 敌家都 ≥15 张时炸普通牌（占跟牌炸弹）

每副炸弹数（自对局，四人合计）：早 0.25 / 中 1.66 / 晚 2.11

- `self|11|66` 座0 21张 敌最少15 对家6 级K 上手=pairSeq:J → **bomb:2{2D 2C 2D 2S 2H}** [mustBomb]<br>手牌: KS KD 9S 9C 7S 7H 7C 6S 6H 6D 5S 5C 5D 3H 3C 3D 2S 2H 2C 2D 2D
- `self|215|91` 座0 12张 敌最少15 对家2 级9 上手=pair:9 → **bomb:2{2D 2H 2C 2D}** [mustBomb,controlFeed:single]<br>手牌: 9C AH AC AC AD JD 10C 6C 2H 2C 2D 2D
- `self|377|73` 座2 12张 敌最少19 对家20 级2 上手=pairSeq:4 → **bomb:A{AH AD AC AH AS}** [mustBomb]<br>手牌: 2C AS AH AH AC AD 10H 10C 6C 3S 3S 3D
- `self|539|46` 座0 19张 敌最少21 对家18 级8 上手=pair:K → **bomb:6{6S 6S 6D 6H 6C}** [mustBomb]<br>手牌: BJ KC KD QC QC JS JH JC JD 9D 6S 6S 6H 6C 6D 5C 5C 2S 2S
- `self|763|77` 座3 10张 敌最少18 对家14 级J 上手=single:RJ → **bomb:7{7C 7S 7D 7H}** [mustBomb]<br>手牌: 9H 9C 7S 7H 7C 7D 4D 3H 3H 2D

### 敌家都 ≥10 张时领出炸弹（非走完）

炸压炸占跟牌炸弹：1043/3096 (34%)

- `self|2|95` 座1 7张 敌最少14 对家0 级4 上手=pass → **bomb:8{8D 8H 8D 8C}** [keepBombForControl,control,forceFinish:likely]<br>手牌: 8H 8C 8D 8D 3S 3H 3D
- `self|213|88` 座1 7张 敌最少13 对家5 级7 上手=pass → **bomb:J{JS JD JH JD}** [control,forceFinish:likely]<br>手牌: QS QD QD JS JH JD JD
- `self|455|83` 座2 7张 敌最少19 对家5 级2 上手=pass → **bomb:Q{QC QH QH QD}** [keepBombForControl,control,forceFinish:likely]<br>手牌: QH QH QC QD 6S 6H 6C
- `self|609|83` 座1 10张 敌最少21 对家8 级K 上手=pass → **bomb:5{5D 5H 5C 5S}** [control]<br>手牌: 7S 7D 6S 6H 5S 5H 5C 5D 4C 4D
- `self|773|99` 座3 7张 敌最少13 对家9 级8 上手=pass → **bomb:A{AH AS AC AD}** [keepBombForControl,control,forceFinish:likely]<br>手牌: AS AH AC AD 6S 6C 6D

### 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌

- `self|18|87` 座1 9张 敌最少2 对家2 级7 上手=triple:8 → **pass** []<br>手牌: 6S 6H 6H 6C 5C 4H 4C 4C 3C
- `self|142|77` 座2 12张 敌最少2 对家12 级A 上手=fullhouse:6 → **pass** []<br>手牌: JS JH 8C 8D 6C 6D 3S 3D 2S 2H 2H 2C
- `self|323|52` 座1 16张 敌最少2 对家23 级K 上手=fullhouse:10 → **pass** []<br>手牌: KS 7S 7D 6S 6S 6H 5S 5D 4S 4D 3S 3H 3C 3D 2S 2H
- `self|568|81` 座1 9张 敌最少3 对家16 级J 上手=fullhouse:7 → **pass** []<br>手牌: JH JS 6S 6H 6C 6D 6D 2H 2C
- `self|704|99` 座2 10张 敌最少3 对家6 级4 上手=fullhouse:9 → **pass** []<br>手牌: BJ 4H 4S 7S 7H 7D 7D 2S 2C 2D

### 输家结束时手里还留着炸弹（每个输家座位）

- `self|8` 座0 结束时手里：5H 7H JD JH QH 5C QS 5C 5S
- `self|15` 座0 结束时手里：5C 5S 5H 5H
- `self|32` 座3 结束时手里：7H 7C 8D 7S QH QC QS 7D 2S 6S QD 2D 6D
- `self|61` 座3 结束时手里：KD KS 6H 6C KH KD 6S 6S
- `self|114` 座2 结束时手里：4S 4D 4H 9C 4C

### 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10）

- `self|8|38` 座2 22张 敌最少2 对家18 级10 上手=pair:K → **pair:10{10C 10H}** [stopShort,followSize]<br>手牌: RJ BJ 10H 10C AH AH JS 9C 8S 8C 6S 6S 6H 6D 4S 4C 4D 3H 3C 3C 2D 2D
- `self|196|53` 座0 20张 敌最少2 对家12 级3 上手=single:2 → **single:RJ{RJ}** [stopShort,followUp,followSize]<br>手牌: RJ 3C 3C AH AC AC AD KH KC QS QD 9D 8C 7D 6H 6C 6C 5C 5D 4S
- `self|327|87` 座0 20张 敌最少8 对家3 级4 上手=pair:6 → **pair:4{4C 4D}** [stopShort,followSize]<br>手牌: RJ RJ 4C 4D AH AH AC AD JH 9H 8H 7D 6S 6C 5H 5H 3D 3D 2C 2D
- `self|500|60` 座3 24张 敌最少1 对家7 级8 上手=pair:5 → **pair:8{8C 8S}** [stopShort,followSize]<br>手牌: 8S 8C AS AD KS KS KC KD QH QD JS JC JC JD 10S 10H 7S 7H 7C 7C 4S 4S 4H 4D
- `self|629|67` 座2 23张 敌最少9 对家1 级7 上手=pair:10 → **pair:7{7D 7C}** [winThen:single,followSize,controlFeed:single]<br>手牌: RJ 7H 7C 7D QS QH QH QD JC JD 10S 10H 10H 10D 6S 6C 4S 4H 4C 4D 2S 2H 2C

### 早盘领出 A/级牌/王的单对

- `self|42|79` 座0 20张 敌最少16 对家0 级5 上手=pass → **single:5{5D}** [shortEnemyShape,noLeadControl,holdLevel,bigFirstVsLast,control]<br>手牌: 5D AH AH AC AD QD 9S 9S 9H 9H 9D 9D 7C 4C 3S 3H 3H 3C 3D 2C
- `self|312|84` 座3 20张 敌最少3 对家0 级2 上手=pass → **single:RJ{RJ}** [control]<br>手牌: RJ 2H 2D QS QH QH QC QC JH JD 10C 10D 9S 9C 8C 8D 7C 7D 4H 4C

### decide 用时 >300ms 的比例

p50 1.6ms，p90 15.5ms，p99 30.2ms，max 818.3ms

- `self|947|106` 座1 16张 敌最少7 对家1 级K 上手=fullhouse:5 → **bomb:A{AH AH AC AD AC}** [noWasteJ,mustBomb,controlFeed:single]<br>手牌: KH KH KS AH AH AC AC AD 6S 6C 6D 6D 2S 2H 2H 2D
- `self|309|68` 座1 16张 敌最少1 对家15 级Q 上手=fullhouse:10 → **bomb:A{AD AD AS AH AS}** [noWasteJ,mustBomb,forceFinish:likely]<br>手牌: QH QH QS AS AS AH AD AD 6H 6C 6D 5S 5S 5H 2C 2D
- `self|739|79` 座1 14张 敌最少3 对家0 级K 上手=pair:Q → **bomb:A{AH AC AD AS AD KH}** [forceFinish:likely]<br>手牌: KH KS KS KC KD AS AH AC AD AD 8S 8H 8C 8D

### 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）

全部通过

