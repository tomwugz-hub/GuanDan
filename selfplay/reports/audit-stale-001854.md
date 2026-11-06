# 自对局体检报告

生成：2026/10/18 00:54:03（America/Toronto）　policy：current　用时 965s

对局：自对局 1000 副（四家 decide），混合对手 Random、Greedy、Old:pre-activity、Old:pre-round6 各 200×2 副（换座位）；逐手记录 267893 条；surprise 局面 195 个。

局面 id 可复现：`node selfplay/audit.mjs --replay='<id>'`（cfg|seed|step）。

## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）

- **Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5**：11.8%（n=195，合理区间 ≤5%，严重度 9.4）
- **早盘领出单张占比**：72.6%（n=5637，合理区间 ≥15 且 ≤55%，严重度 1.2）
- **早盘领出对子占比**：4.6%（n=5637，合理区间 ≥5%，严重度 0.3）

## 全部检测器

| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |
|---|---|---|---|---|---|
| 早中盘领出小单（≤10）后两个敌家都不跟 | 10.1% | 5201 | ≤25% | 8.7% | OK |
| 早中盘领出小对（≤10）后两个敌家都不跟 | 21.1% | 817 | ≤35% | 17.6% | OK |
| 跟敌人牌过牌率（early，有牌可出时） | 49.8% | 29986 | ≥30 且 ≤62% | 48.3% | OK |
| 跟敌人牌过牌率（mid，有牌可出时） | 60.7% | 18865 | ≥30 且 ≤65% | 59.1% | OK |
| 跟敌人牌过牌率（late，有牌可出时） | 36.9% | 4938 | ≥20 且 ≤75% | 41.3% | OK |
| 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率 | 27.8% | 16088 | ≤35% | 26.0% | OK |
| 压对家的牌（early，有牌可压时） | 0.0% | 9104 | ≤15% | 0.0% | OK |
| 压对家的牌（mid，有牌可压时） | 0.3% | 6921 | ≤15% | 0.4% | OK |
| 压对家的牌（late，有牌可压时） | 13.3% | 1909 | ≤30% | 13.5% | OK |
| 炸对家（未因此走完） | 0.0% | 16680 | ≤2% | 0.0% | OK |
| 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张时仍过牌 | 45.5% | 22 | ≤60% | 64.2% | 样本少 |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 14.2% | 2106 | ≤15% | 10.3% | OK |
| 敌家都 ≥10 张时领出炸弹（非走完） | 5.7% | 4983 | ≤10% | 1.7% | OK |
| 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌 | 2.5% | 729 | ≤45% | 6.0% | OK |
| 输家结束时手里还留着炸弹（每个输家座位） | 4.7% | 2000 | ≤20% | 3.5% | OK |
| 输家结束时还握着 ≥2 张王/级牌 | 8.6% | 2000 | ≤25% | 7.2% | OK |
| 末游卡手（结束时 ≥8 张且至少还要 5 手） | 0.0% | 1000 | ≤25% | 0.0% | OK |
| 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10） | 1.2% | 13289 | ≤8% | 0.4% | OK |
| 早盘领出 A/级牌/王的单对 | 2.7% | 4354 | ≤12% | 0.1% | OK |
| 拆炸弹领出 | 0.7% | 17525 | ≤2% | 6.1% | OK |
| 早盘拆对领单（手里有顺子/连对/钢板可出） | 1.6% | 3327 | ≤15% | 0.0% | OK |
| 早盘领出对子占比 | 4.6% | 5637 | ≥5% | 0.2% | 🚩 |
| 早盘领出单张占比 | 72.6% | 5637 | ≥15 且 ≤55% | 70.3% | 🚩 |
| 一手能出完却没出完 | 0.0% | 2658 | ≤1% | 1.2% | OK |
| decide 用时 >300ms 的比例 | 0.0% | 182518 | ≤0.5% | 0.0% | OK |
| 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测） | 0.000 | 2600 | ≤0 | 0.000 | OK |
| 对 Random 每副净升级 | 2.920 | 400 | ≥1.5 | 2.905 | OK |
| 对 Greedy 每副净升级 | 2.288 | 400 | ≥0.5 | 2.112 | OK |
| Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5 | 11.8% | 195 | ≤5% | 8.2% | 🚩 |

## 队伍结果

- 自对局 1000 副：南北队每副净升级 -0.018 [-0.149, 0.113]（应≈0），双下率 30.6%，平均每副 104 手
- 各座位平均名次（南/东/北/西）：2.47 / 2.47 / 2.51 / 2.55
- decide vs Random：400 副，胜 395/400 (99%)，每副净升级 2.920 [2.873, 2.967]
- decide vs Greedy：400 副，胜 361/400 (90%)，每副净升级 2.288 [2.150, 2.425]
- decide vs Old:pre-activity：400 副，胜 304/400 (76%)，每副净升级 1.215 [1.050, 1.380]
- decide vs Old:pre-round6：400 副，胜 283/400 (71%)，每副净升级 1.067 [0.879, 1.256]

## 详情与示例局面

### 🚩 Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5

分类：lead/mid/otherPlay 4，enemy/late/passed 3，lead/late/otherPlay 3，partner/mid/shouldPass 2，enemy/late/otherPlay 2，partner/late/passed 2，lead/early/otherPlay 2，partner/early/otherPlay 1，enemy/mid/passed 1，enemy/early/otherPlay 1，partner/early/shouldPass 1，partner/late/shouldPass 1

- `self|223|85` partner 24张 张数7/22/24/1 级4 上手=single:6<br>decide: **single:RJ{RJ}** (-2.14) [followUp,blockLikely] vs **single:4{4H}** (+3.56, t=24.3, n=36)<br>手牌: JD 4H 8D 9C 9S 4S 2H RJ 7H AH JS AD QD 7S 8D QS 9C JH 4H 7D 7C QH 8C QD
- `self|798|42` enemy 6张 张数24/6/20/21 级7 上手=single:A<br>decide: **pass** (-0.03) [] vs **single:BJ{BJ}** (+2.19, t=4.9, n=36)<br>手牌: KH BJ BJ KC KC AD
- `self|544|65` partner 11张 张数1/8/19/11 级K 上手=single:K<br>decide: **single:BJ{BJ}** (-1.33) [followUp] vs **pass** (+2.08, t=5.2, n=36)<br>手牌: KS KD 4C KH 4S 4H 2C 2H 2S BJ 2C
- `self|798|54` enemy 6张 张数22/6/15/15 级7 上手=single:2<br>decide: **single:A{AD}** (0.17) [followUp,followSize] vs **single:K{KH}** (+1.78, t=5.3, n=36)<br>手牌: KH BJ BJ KC KC AD
- `self|554|58` enemy 9张 张数9/15/23/14 级10 上手=single:Q<br>decide: **pass** (0.72) [] vs **single:A{AS}** (+1.61, t=4.0, n=36)<br>手牌: AS JH JS 3C 3H AD AC 3D 10D
- `self|886|70` enemy 11张 张数11/15/15/14 级4 上手=single:Q<br>decide: **pass** (0.64) [] vs **single:RJ{RJ}** (+1.58, t=5.2, n=36)<br>手牌: RJ 10H JC JH JD 10S JD 10H 4S 4C 10D
- `self|147|71` lead 7张 张数3/7/23/2 级6 上手=pass<br>decide: **pair:5{5S 5H}** (-1.64) [keepStruct,feedPartnerPair,control] vs **triple:5{5S 5H 5H}** (+1.50, t=3.9, n=36)<br>手牌: KD 5S KD KC JS 5H 5H
- `self|446|86` lead 9张 张数8/0/1/9 级6 上手=pass<br>decide: **fullhouse:8{8H 8C 8C KC KC}** (1.00) [shortEnemyShape,control,offPlan] vs **single:7{7S}** (+1.39, t=8.9, n=36)<br>手牌: KC 8H 8C KC KD RJ 7S 8C AD

### 🚩 早盘领出单张占比

早盘领出牌型分布：single 73%，fullhouse 11%，pairSeq 5%，pair 5%，tripleSeq 4%，triple 2%，straight 0%，bomb 0%；熵 1.43 bit


### 早中盘领出小单（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：527/527 (100%)

- `self|6|26` 座0 24张 敌最少22 对家17 级8 上手=single:10 → **pass** []<br>手牌: 8H 8S 8D AH AC AC AD KS KH QS QC JS JC JD 10S 10C 9C 9D 7S 7D 6D 4H 4D 3H
- `self|205|82` 座3 20张 敌最少9 对家13 级Q 上手=single:5 → **pass** []<br>手牌: RJ QH QC AS AH AC AD KS KC KD 6C 6C 6D 4S 4H 4C 4D 3S 3H 3D
- `self|419|63` 座0 17张 敌最少15 对家21 级5 上手=single:8 → **pass** [noSFon8]<br>手牌: RJ RJ 5C 5C KS KH KH QS QC QC QD 7D 4H 4H 4D 2S 2D
- `self|609|29` 座0 24张 敌最少21 对家24 级K 上手=single:10 → **pass** []<br>手牌: KS KS KC QS QS QC QC 10H 10D 9H 9H 9D 8H 7D 4S 4H 4H 3H 3H 3C 3D 2S 2D 2D
- `self|814|51` 座0 21张 敌最少18 对家24 级10 上手=single:Q → **pass** []<br>手牌: 10H 10C 10D JS JH JH 7S 7H 7C 7D 6S 6C 6C 6D 3S 3S 3H 3D 2H 2C 2C

### 早中盘领出小对（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：168/172 (98%)

- `self|16|70` 座2 19张 敌最少17 对家14 级5 上手=pair:9 → **pass** []<br>手牌: RJ BJ 5H AS AC AD 9H 9C 9D 9D 8S 8H 8C 3S 3S 3C 2H 2H 2C
- `self|212|57` 座2 22张 敌最少16 对家17 级6 上手=pair:5 → **pass** []<br>手牌: RJ BJ BJ KH KC KD QS QH QD JS JH JC JD 10H 5C 5D 4D 3H 3D 2H 2C 2D
- `self|464|72` 座3 8张 敌最少12 对家20 级J 上手=pair:8 → **pass** []<br>手牌: QS QH QC QC 2S 2H 2C 2D
- `self|683|24` 座3 24张 敌最少21 对家26 级9 上手=pair:10 → **pass** []<br>手牌: BJ 9S KS KH KD QS QC QD 10H 10H 8S 8H 8C 7C 6S 6C 4C 4C 4D 4D 3D 3D 2C 2D
- `self|824|127` 座3 9张 敌最少8 对家15 级7 上手=pair:9 → **pass** []<br>手牌: 7H AS AC AD AD 8S 8H 8C 8D

### 跟敌人牌过牌率（early，有牌可出时）

- `self|1|5` 座1 26张 敌最少25 对家26 级3 上手=single:A → **pass** []<br>手牌: 3S 3C 3D AS AC KH KD QS QH QD JS JC JD 9S 9H 9H 9D 9D 8C 7S 7H 7D 7D 6S 6S 4C
- `self|208|23` 座0 26张 敌最少18 对家24 级2 上手=single:K → **pass** []<br>手牌: 2D 2D KS KH KD QS QH JH JC 10S 10C 10D 9H 9C 9D 8H 8C 7H 6H 6C 5S 5H 5D 4S 4S 4D
- `self|400|3` 座2 27张 敌最少26 对家26 级Q 上手=single:A → **pass** []<br>手牌: QH QS AC KS KD JS JS 10S 10H 10D 9H 9H 9C 9D 8S 8S 8D 7H 7C 6S 6D 5H 5H 3H 2S 2C 2D
- `self|594|46` 座1 20张 敌最少14 对家9 级J 上手=fullhouse:K → **pass** []<br>手牌: JH JH JS AD AD QS QH QC 10C 9C 9C 8H 8C 8C 8D 5H 5C 5D 5D 2D
- `self|805|10` 座0 26张 敌最少25 对家25 级A 上手=single:BJ → **pass** []<br>手牌: RJ AD KS KC KD QS QH 9S 9C 9D 8S 8S 8H 8D 7S 7D 6H 4H 4C 4D 3H 3C 3C 3D 2C 2C

### 跟敌人牌过牌率（mid，有牌可出时）

- `self|2|33` 座1 19张 敌最少20 对家21 级4 上手=triple:A → **pass** []<br>手牌: 4H 4C 4D QC QD JS JH JC JD 8H 8C 8D 8D 6S 6H 6H 5H 5C 5C
- `self|207|50` 座3 15张 敌最少9 对家15 级A 上手=pair:Q → **pass** []<br>手牌: RJ AS AD 10D 9C 7S 6C 4S 4C 4D 3H 3H 3C 3D 2S
- `self|425|82` 座1 16张 敌最少6 对家25 级J 上手=single:J → **pass** []<br>手牌: BJ QS QH QC 9H 9H 9C 7C 7C 7D 6S 6H 6C 6C 6D 4S
- `self|624|30` 座3 17张 敌最少18 对家16 级2 上手=fullhouse:10 → **pass** []<br>手牌: RJ RJ 2H KS KH KH KC KD KD JS JH 10C 10D 9H 9C 6S 6C
- `self|814|58` 座3 17张 敌最少21 对家22 级10 上手=single:7 → **pass** []<br>手牌: 10H 10D 9H 9C 9D 8S 8H 8H 4S 4S 4H 4C 3C 2S 2H 2D 2D

### 跟敌人牌过牌率（late，有牌可出时）

- `self|4|65` 座3 9张 敌最少7 对家0 级6 上手=single:6 → **pass** []<br>手牌: RJ BJ BJ AS AD 8C 8D 7C 7C
- `self|209|119` 座3 2张 敌最少7 对家10 级3 上手=single:J → **pass** []<br>手牌: 3H 3C
- `self|431|58` 座2 9张 敌最少15 对家21 级4 上手=pair:A → **pass** []<br>手牌: 4H 4C 10C 9C 3S 3H 2H 2C 2C
- `self|641|64` 座2 9张 敌最少10 对家8 级6 上手=single:J → **pass** []<br>手牌: QH QC QC QD JS JH JC JD JD
- `self|808|41` 座1 9张 敌最少20 对家21 级4 上手=single:3 → **pass** []<br>手牌: RJ JS JC 8H 8D 5H 5D 3S 3H

### 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率

按座位 南/东/北/西：1131/4030 (28%) / 1106/3976 (28%) / 1120/4033 (28%) / 1114/4049 (28%)

- `self|2|4` 座0 26张 敌最少26 对家26 级4 上手=single:10 → **pass** []<br>手牌: BJ 4S 4C 4D AH AD AD KH KC QS QH JS JD 10S 10S 10C 10C 9H 9C 8S 7C 7D 7D 6C 6D 5D
- `self|213|76` 座0 14张 敌最少15 对家12 级7 上手=pair:10 → **pass** []<br>手牌: RJ 7S 7C KS KS KC KD 9H 9C 9D 8H 8C 8D 6D
- `self|419|63` 座0 17张 敌最少15 对家21 级5 上手=single:8 → **pass** [noSFon8]<br>手牌: RJ RJ 5C 5C KS KH KH QS QC QC QD 7D 4H 4H 4D 2S 2D
- `self|613|21` 座0 19张 敌最少20 对家25 级4 上手=single:7 → **pass** []<br>手牌: RJ 4H 4S 4S QS QC QD 10C 10D 9S 9S 8H 8C 8D 8D 7H 7D 6H 6C
- `self|809|9` 座1 26张 敌最少25 对家25 级5 上手=single:10 → **pass** []<br>手牌: RJ 5S 5C AS AD KS KD QS QC QD JS JH 10H 10C 8D 7H 7C 7D 7D 6H 6D 4S 4D 3H 2H 2C

### 压对家的牌（early，有牌可压时）

- `self|223|85` 座2 24张 敌最少1 对家7 级4 上手=single:6 → **single:RJ{RJ}** [followUp,blockLikely]<br>手牌: RJ 4H 4H 4S AH AD QS QH QD QD JS JH JD 9S 9C 9C 8C 8D 8D 7S 7H 7C 7D 2H
- `self|232|59` 座3 22张 敌最少1 对家4 级K 上手=single:BJ → **single:RJ{RJ}** [followUp,blockLikely]<br>手牌: RJ KS KC AS AH AC 10H 10D 9S 9D 8S 8C 8C 8D 6H 6H 5H 5D 2S 2H 2D 2D
- `self|802|73` 座2 26张 敌最少1 对家6 级J 上手=single:K → **single:A{AD}** [keepStruct,followUp]<br>手牌: JH JC JC JD AS AD KH KD QS QD 10H 10D 8C 8D 7H 7C 6S 6H 6H 6C 5H 4S 3D 3D 2S 2S

### 压对家的牌（mid，有牌可压时）

- `self|3|54` 座0 10张 敌最少16 对家16 级5 上手=fullhouse:K → **fullhouse:5{5S 5D 5C 7D 7H}** []<br>手牌: 5H 5S 5S 5C 5D 8S 8S 8C 7H 7D
- `self|212|64` 座1 11张 敌最少17 对家16 级6 上手=fullhouse:K → **fullhouse:6{6C 6D 6C 10C 10D}** []<br>手牌: 6H 6C 6C 6D JH JC JD 10H 10C 10D 10D
- `self|428|70` 座1 10张 敌最少13 对家10 级A 上手=fullhouse:K → **fullhouse:A{AD AC AC JH JC}** []<br>手牌: AC AC AD JH JH JC JC 7H 7D 7D
- `self|507|75` 座1 10张 敌最少6 对家17 级2 上手=fullhouse:10 → **fullhouse:2{2D 2D 2C 9H 9C}** [fhAttach,forceFinish:bombBack]<br>手牌: 2H 2C 2D 2D 9H 9C 7H 7C 7D 7D
- `self|688|91` 座3 15张 敌最少2 对家3 级A 上手=single:7 → **single:RJ{RJ}** [followUp]<br>手牌: RJ BJ KS KH KH 9H 9C 4S 4H 4H 4D 3H 3H 3C 2H

### 压对家的牌（late，有牌可压时）

- `self|4|70` 座2 7张 敌最少9 对家7 级6 上手=fullhouse:A → **fullhouse:6{6C 6S 6S KH KS}** []<br>手牌: 6S 6S 6C KS KH KD KD
- `self|237|86` 座0 7张 敌最少10 对家10 级5 上手=pair:3 → **pair:Q{QC QH}** []<br>手牌: 5C 5D 5D QH QC QC QD
- `self|423|89` 座1 2张 敌最少12 对家10 级9 上手=single:6 → **single:A{AD}** [followUp,strongBeforeLast]<br>手牌: AH AD
- `self|618|65` 座1 1张 敌最少6 对家11 级9 上手=single:2 → **single:9{9C}**<br>手牌: 9C
- `self|762|86` 座3 3张 敌最少13 对家4 级10 上手=pair:6 → **pair:10{10C 10S}** []<br>手牌: 10S 10C JD

### 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张时仍过牌

- `self|8|68` 座0 10张 敌最少1 对家8 级10 上手=pair:2 → **pass** [mustBomb]<br>手牌: AC QS QH JH JD 7H 5S 5H 5C 5C
- `self|223|77` 座2 24张 敌最少3 对家12 级4 上手=pair:6 → **pass** []<br>手牌: RJ 4H 4H 4S AH AD QS QH QD QD JS JH JD 9S 9C 9C 8C 8D 8D 7S 7H 7C 7D 2H
- `self|503|64` 座0 13张 敌最少1 对家12 级J 上手=pair:8 → **pass** [mustBomb]<br>手牌: RJ JS JC KC KD KD 5S 5S 5C 5C 5D 3H 3H
- `self|503|76` 座0 13张 敌最少1 对家6 级J 上手=pair:4 → **pass** [mustBomb]<br>手牌: RJ JS JC KC KD KD 5S 5S 5C 5C 5D 3H 3H
- `self|802|69` 座2 26张 敌最少1 对家7 级J 上手=pair:7 → **pass** [mustBomb]<br>手牌: JH JC JC JD AS AD KH KD QS QD 10H 10D 8C 8D 7H 7C 6S 6H 6H 6C 5H 4S 3D 3D 2S 2S

### 敌家都 ≥15 张时炸普通牌（占跟牌炸弹）

每副炸弹数（自对局，四人合计）：早 0.41 / 中 1.96 / 晚 2.62

- `self|2|63` 座3 14张 敌最少18 对家0 级4 上手=pair:A → **bomb:K{KD KS KH KC KD}** [mustBomb]<br>手牌: RJ 4S KS KH KC KD KD 7S 7C 3C 2S 2S 2H 2D
- `self|199|94` 座3 8张 敌最少17 对家18 级6 上手=triple:K → **bomb:7{7S 7S 7H 7C}** [mustBomb]<br>手牌: QC 8S 8C 8D 7S 7S 7H 7C
- `self|361|74` 座2 20张 敌最少19 对家13 级Q 上手=pairSeq:K → **bomb:8{8H 8D 8S 8C QH}** [mustBomb]<br>手牌: QH QS QS AS AH AC AD JS JC JD 8S 8H 8C 8D 6S 6S 6H 6C 5C 5D
- `self|539|74` 座2 24张 敌最少19 对家2 级8 上手=single:RJ → **bomb:7{7C 7S 7H 7D}** [mustBomb,controlFeed:pair]<br>手牌: 8D AS AH AC AD QS QH QD QD 9C 9C 7S 7H 7C 7D 5D 4S 4H 4H 4D 3D 3D 2C 2D
- `self|802|75` 座0 6张 敌最少18 对家25 级J 上手=single:BJ → **bomb:4{4C 4H 4D 4S}** [mustBomb,forceFinish:likely]<br>手牌: RJ JS 4S 4H 4C 4D

### 敌家都 ≥10 张时领出炸弹（非走完）

炸压炸占跟牌炸弹：1495/3601 (42%)

- `self|15|45` 座3 8张 敌最少19 对家24 级4 上手=pass → **bomb:9{9S 9D 9C 9C}** [holdBombLead,control,leadBombLate]<br>手牌: JS JH JC JD 9S 9C 9C 9D
- `self|277|62` 座3 12张 敌最少11 对家12 级6 上手=pass → **bomb:3{3H 3D 3S 3H}** [control]<br>手牌: 7S 7C 7D 7D 5H 5C 4H 4C 3S 3H 3H 3D
- `self|461|45` 座1 14张 敌最少16 对家23 级8 上手=pass → **bomb:7{7S 7D 7H 7H}** [holdBombLead,control,leadBombLate]<br>手牌: 8S 8D 10S 10H 10C 10D 9H 9C 7S 7H 7H 7D 6S 6H
- `self|686|100` 座0 8张 敌最少12 对家18 级Q 上手=pass → **bomb:9{9C 9S 9H 9D}** [control,forceFinish:bombBack]<br>手牌: AS AH AH AC 9S 9H 9C 9D
- `self|851|73` 座3 8张 敌最少12 对家20 级8 上手=pass → **bomb:6{6D 6S 6H 6D}** [control,forceFinish:bombBack]<br>手牌: 8S 8C 8C 8D 6S 6H 6D 6D

### 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌

- `self|34|72` 座1 8张 敌最少3 对家0 级10 上手=triple:J → **pass** []<br>手牌: 10S QH JS 9H 8S 8H 8D 8D
- `self|480|62` 座2 17张 敌最少2 对家0 级A 上手=fullhouse:K → **pass** []<br>手牌: KS KS KC KC JS JD 9C 9D 7S 7H 7C 6H 6C 6C 3S 3H 3D
- `self|621|82` 座0 10张 敌最少3 对家0 级Q 上手=pair:K → **pass** []<br>手牌: RJ QC JS JS JH JD 2S 2S 2D 2D
- `self|699|80` 座1 8张 敌最少2 对家0 级Q 上手=pair:9 → **pass** []<br>手牌: 8S 8H 8D 8D 5S 5H 4S 4S
- `self|779|99` 座3 17张 敌最少2 对家0 级A 上手=pair:K → **pass** []<br>手牌: RJ BJ 9H 9C 9D 8H 8H 8C 8D 7H 7D 7D 6D 2S 2S 2H 2D

### 输家结束时手里还留着炸弹（每个输家座位）

- `self|8` 座0 结束时手里：5H 7H JD JH QH 5C QS 5C 5S
- `self|23` 座2 结束时手里：7C JS JC RJ JS 8S JD 10H 7S 10C 10H 10D 8H JD 5D 5S
- `self|32` 座3 结束时手里：7H 7C 8D 7S QH QC QS 7D 2S 6S QD 2D 6D
- `self|54` 座1 结束时手里：5H QH 5C QD 5S QD QC JD
- `self|62` 座1 结束时手里：QS QD 6C QC 6C QC

### 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10）

- `self|5|38` 座3 21张 敌最少20 对家21 级7 上手=pass → **single:7{7C}** [control]<br>手牌: BJ 7C QS QS QH QD JS JH JH 9H 9C 9D 8S 8H 6H 6H 6C 3S 3H 3C 3D
- `self|192|45` 座0 23张 敌最少18 对家20 级Q 上手=pass → **single:Q{QS}** [control]<br>手牌: RJ QS KH KH KD 8H 8H 8C 7S 7C 6S 6H 6H 6D 4S 4D 3H 3C 2S 2S 2H 2H 2D
- `self|372|77` 座0 23张 敌最少11 对家9 级10 上手=pair:9 → **pair:10{10S 10D}** [stopShort,followSize]<br>手牌: RJ 10H 10S 10D AS AH AC AD QS QD 9S 9H 7S 6S 6D 6D 5S 5H 5D 3C 3C 3D 2C
- `self|579|12` 座0 24张 敌最少26 对家26 级9 上手=pass → **single:BJ{BJ}** [control]<br>手牌: RJ BJ 9H 9S 9S 9C AS QS QH JS JS 10S 10D 8S 8H 8H 5H 5D 4H 4C 3S 3H 3C 3C
- `self|798|73` 座0 20张 敌最少3 对家8 级7 上手=single:8 → **single:7{7D}** [noSFon8,followUp,followSize]<br>手牌: RJ 7D QH QH QC 9S 9H 9H 8S 8S 8C 8C 8D 8D 6H 6H 6D 5S 5D 4D

### 早盘领出 A/级牌/王的单对

- `self|5|38` 座3 21张 敌最少20 对家21 级7 上手=pass → **single:7{7C}** [control]<br>手牌: BJ 7C QS QS QH QD JS JH JH 9H 9C 9D 8S 8H 6H 6H 6C 3S 3H 3C 3D
- `self|198|35` 座0 21张 敌最少23 对家26 级5 上手=pass → **single:RJ{RJ}** [control]<br>手牌: RJ 5H 5S KS KS KC JH JD 8D 8D 7H 7H 7C 7C 7D 6H 6D 3S 3S 3H 3C
- `self|372|24` 座1 22张 敌最少24 对家25 级10 上手=pass → **single:10{10C}** [control]<br>手牌: 10C 10C KH KC KD 7H 7C 7D 6H 6H 6C 4S 4H 4D 3S 3H 3H 3D 2S 2S 2H 2D
- `self|562|43` 座1 20张 敌最少21 对家23 级5 上手=pass → **pair:A{AC AC}** [control]<br>手牌: 5H 5H 5S 5S AC AC 9S 9S 9H 9C 9D 8S 8H 7S 7S 7D 6H 6D 4S 4C
- `self|781|16` 座0 23张 敌最少26 对家26 级3 上手=pass → **single:A{AH}** [control]<br>手牌: BJ 3H 3S 3C 3C 3D 3D AH JH JD JD 10S 10H 9S 9C 8S 8S 8C 8D 7S 7S 6H 6D

### 拆炸弹领出

- `self|5|79` 座0 8张 敌最少11 对家10 级7 上手=pass → **triple:7{7C 7D 7D}** [bombBreakNoGain,leadSmallSame,control,offPlan]<br>手牌: 7S 7C 7D 7D KS KH KC KD
- `self|234|78` 座2 9张 敌最少9 对家17 级2 上手=pass → **fullhouse:7{7H 7D 7D QH QS}** [control,offPlan,forceFinish:bombBack]<br>手牌: 2H 2H QS QH QC QD 7H 7D 7D
- `self|429|28` 座0 18张 敌最少19 对家26 级2 上手=pass → **fullhouse:7{7D 7H 7S 6D 6H}** [bombBreakNoGain,control]<br>手牌: BJ BJ 2S 2S QC QD JC JD 9H 9H 8H 8C 7S 7H 7D 7D 6H 6D
- `self|583|97` 座2 16张 敌最少11 对家11 级K 上手=pass → **fullhouse:2{2S 2C 2C JD JH}** [control]<br>手牌: KS KS AS AD QS QS QC QD QD JH JD 2S 2S 2H 2C 2C
- `self|779|77` 座1 12张 敌最少17 对家17 级A 上手=pass → **pair:3{3H 3D}** [control,offPlan]<br>手牌: AH AS AS KS KH KC KD 3S 3H 3C 3D 3D

### 早盘拆对领单（手里有顺子/连对/钢板可出）

- `self|62|28` 座3 22张 敌最少24 对家23 级Q 上手=pass → **single:J{JC}** [control]<br>手牌: QH JC JD 10S 10S 10H 10H 10C 8S 8C 7H 7C 6S 6H 6D 4S 4D 4D 2H 2C 2D 2D
- `self|198|39` 座0 20张 敌最少23 对家26 级5 上手=pass → **single:J{JD}** [control]<br>手牌: 5H 5S KS KS KC JH JD 8D 8D 7H 7H 7C 7C 7D 6H 6D 3S 3S 3H 3C
- `self|425|35` 座2 21张 敌最少24 对家24 级J 上手=pass → **single:3{3S}** [control]<br>手牌: JH JH JC JD QC QD QD 10C 10C 9S 9D 7H 7D 4H 4C 3S 3C 2S 2S 2H 2C
- `self|579|16` 座0 23张 敌最少26 对家26 级9 上手=pass → **single:J{JS}** [control]<br>手牌: RJ 9H 9S 9S 9C AS QS QH JS JS 10S 10D 8S 8H 8H 5H 5D 4H 4C 3S 3H 3C 3C
- `self|884|25` 座0 22张 敌最少24 对家24 级2 上手=pass → **single:8{8H}** [control]<br>手牌: 2H 2D QS QD QD JS JH JC 10H 10D 8S 8H 7S 7C 6S 6D 5H 5H 4S 4H 4H 4C

### decide 用时 >300ms 的比例

p50 1.9ms，p90 18.5ms，p99 33ms，max 1372.9ms

- `vsGreedy0|200082|100` 座2 13张 敌最少2 对家0 级A 上手=single:7 → **bomb:J{JD JH JS JC AH AH}** [forceFinish:likely]<br>手牌: AH AH AS AC AD JS JH JC JD 4S 4C 4C 4D
- `self|129|92` 座1 16张 敌最少1 对家10 级A 上手=fullhouse:10 → **bomb:9{9S 9C 9H 9D 9H 9C 9S}** [noWasteJ,mustBomb,forceFinish:likely]<br>手牌: AH QS QH QH QC JS JH JD JD 9S 9S 9H 9H 9C 9C 9D
- `self|121|54` 座3 16张 敌最少12 对家18 级6 上手=fullhouse:2 → **pass** []<br>手牌: 6H 6H 6S 6S 6C 10D 9S 9S 9H 8C 4C 4D 4D 3S 3H 3C
- `self|68|47` 座1 15张 敌最少20 对家6 级5 上手=fullhouse:8 → **bomb:A{AS AD AS AH AC}** [noWasteJ,mustBomb]<br>手牌: 5H 5H 5S 5D AS AS AH AC AD QS JH JH JC JD 6H
- `vsGreedy0|200025|19` 座0 16张 敌最少16 对家21 级9 上手=fullhouse:4 → **pass** []<br>手牌: 9H 9H 9C 9D KC JD 10S 10S 10D 8H 8H 8D 7D 5S 5C 5D

### 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）

全部通过

