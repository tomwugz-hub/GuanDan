# 自对局体检报告

生成：2026/10/19 12:49:38（Asia/Shanghai）　policy：post-selfplay-r8　用时 519s

对局：自对局 1000 副（四家 decide），混合对手 Random、Greedy、Old:pre-activity、Old:pre-round6 各 200×2 副（换座位）；逐手记录 246393 条；surprise 局面 178 个。

局面 id 可复现：`node selfplay/audit.mjs --replay='<id>'`（cfg|seed|step）。

## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）

- **Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5**：6.2%（n=178，合理区间 ≤5%，严重度 1.6）
- **对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌**：70.0%（n=30，合理区间 ≤60%，严重度 0.5）

## 全部检测器

| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |
|---|---|---|---|---|---|
| 早中盘领出小单（≤10）后两个敌家都不跟 | 6.8% | 2767 | ≤25% | 6.8% | OK |
| 早中盘领出小对（≤10）后两个敌家都不跟 | 12.8% | 1047 | ≤35% | 12.8% | OK |
| 跟敌人牌过牌率（early，有牌可出时） | 50.8% | 18993 | ≥30 且 ≤62% | 50.8% | OK |
| 跟敌人牌过牌率（mid，有牌可出时） | 57.5% | 20785 | ≥30 且 ≤65% | 57.5% | OK |
| 跟敌人牌过牌率（late，有牌可出时） | 41.6% | 6658 | ≥20 且 ≤75% | 41.3% | OK |
| 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率 | 21.7% | 10584 | ≤35% | 21.7% | OK |
| 压对家的牌（early，有牌可压时） | 0.1% | 5871 | ≤15% | 0.1% | OK |
| 压对家的牌（mid，有牌可压时） | 0.1% | 7477 | ≤15% | 0.2% | OK |
| 压对家的牌（late，有牌可压时） | 12.5% | 2569 | ≤30% | 12.6% | OK |
| 炸对家（未因此走完） | 0.0% | 14796 | ≤2% | 0.0% | OK |
| 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌 | 70.0% | 30 | ≤60% | 73.5% | 🚩 |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 11.8% | 2146 | ≤15% | 11.8% | OK |
| 敌家都 ≥10 张时领出炸弹（非走完） | 4.3% | 4924 | ≤10% | 4.3% | OK |
| 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌 | 5.4% | 781 | ≤45% | 5.4% | OK |
| 输家结束时手里还留着炸弹（每个输家座位） | 6.6% | 2000 | ≤20% | 6.4% | OK |
| 输家结束时还握着 ≥2 张王/级牌 | 7.3% | 2000 | ≤25% | 7.2% | OK |
| 末游卡手（结束时 ≥8 张且至少还要 5 手） | 0.0% | 1000 | ≤25% | 0.0% | OK |
| 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10） | 0.6% | 5918 | ≤8% | 0.6% | OK |
| 早盘领出 A/级牌/王的单对 | 0.4% | 1217 | ≤12% | 0.4% | OK |
| 拆炸弹领出 | 0.7% | 15873 | ≤2% | 0.7% | OK |
| 早盘拆对领单（手里有顺子/连对/钢板可出） | 0.3% | 598 | ≤15% | 0.3% | OK |
| 早盘领出对子占比 | 12.3% | 3837 | ≥5% | 12.3% | OK |
| 早盘领出单张占比 | 19.4% | 3837 | ≥15 且 ≤55% | 19.4% | OK |
| 一手能出完却没出完 | 0.0% | 2681 | ≤1% | 0.0% | OK |
| decide 用时 >300ms 的比例 | 0.0% | 166201 | ≤0.5% | 0.0% | OK |
| 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测） | 0.000 | 2600 | ≤0 | 0.000 | OK |
| 对 Random 每副净升级 | 2.950 | 400 | ≥1.5 | 2.955 | OK |
| 对 Greedy 每副净升级 | 2.255 | 400 | ≥0.5 | 2.255 | OK |
| Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5 | 6.2% | 178 | ≤5% | 6.5% | 🚩 |

## 队伍结果

- 自对局 1000 副：南北队每副净升级 0.119 [-0.011, 0.249]（应≈0），双下率 30.5%，平均每副 93 手
- 各座位平均名次（南/东/北/西）：2.39 / 2.52 / 2.54 / 2.56
- decide vs Random：400 副，胜 397/400 (99%)，每副净升级 2.950 [2.913, 2.987]
- decide vs Greedy：400 副，胜 359/400 (90%)，每副净升级 2.255 [2.114, 2.396]
- decide vs Old:pre-activity：400 副，胜 313/400 (78%)，每副净升级 1.238 [1.066, 1.409]
- decide vs Old:pre-round6：400 副，胜 313/400 (78%)，每副净升级 1.340 [1.164, 1.516]

## 详情与示例局面

### 🚩 Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5

分类：lead/late/otherPlay 2，partner/early/shouldPass 2，enemy/late/passed 1，partner/late/shouldPass 1，enemy/early/passed 1，lead/mid/otherPlay 1，enemy/mid/otherPlay 1，enemy/late/shouldPass 1，partner/mid/shouldPass 1

- `self|531|84` lead 4张 张数5/3/23/4 级K 上手=pass<br>decide: **pair:RJ{RJ RJ}** (-1.67) [leadSmallSame,control,planKeepControl,planStrongFirst,forceFinish:likely] vs **pair:7{7C 7C}** (+3.17, t=12.5, n=36)<br>手牌: RJ 7C RJ 7C
- `self|959|41` enemy 9张 张数11/8/9/21 级Q 上手=single:6<br>decide: **pass** (-0.50) [] vs **single:A{AC}** (+2.03, t=5.3, n=36)<br>手牌: KH BJ BJ 4D RJ 4D KD AC AD
- `self|943|72` partner 20张 张数2/4/16/20 级9 上手=single:A<br>decide: **single:9{9H}** (-0.33) [followUp] vs **pass** (+1.86, t=5.0, n=36)<br>手牌: 5C 2S KC 3H 5D 2H 9H 5S 8S KD KS 9H 5S 7D AD AC KH 8D AH 5D
- `self|128|92` partner 7张 张数7/2/0/2 级K 上手=single:A<br>decide: **single:K{KD}** (1.31) [followUp] vs **pass** (+1.69, t=21.8, n=36)<br>手牌: 8D KD QS JH QC JD 10D
- `self|107|6` enemy 22张 张数22/22/22/22 级5 上手=straight:K<br>decide: **pass** (-0.64) [] vs **straight:A{10D QS KC AS 5H}** (+1.17, t=2.6, n=36)<br>手牌: 7H 8C KC AS 7H 7D 4D QS 3S 3D 7S 6D 2S 6S 3H QD 5H 10D 10C RJ 8H AD
- `self|763|67` partner 22张 张数12/22/1/5 级J 上手=single:10<br>decide: **single:RJ{RJ}** (0.00) [followUp,blockLikely] vs **pass** (+1.11, t=3.2, n=36)<br>手牌: QS 5H QS QC 8S JH RJ 8C 6S 8D 6D 6C JD 6D 5S 4H 9S AD 9D QH AC 8C
- `self|168|50` lead 14张 张数14/14/15/10 级A 上手=pass<br>decide: **single:Q{QH}** (1.31) [holdBombLead,control,planWeakFirst] vs **single:A{AC}** (+1.03, t=3.4, n=36)<br>手牌: 4D 4H 2C JD 2C 2H 4S QH JS JC JH 4H AC 2S
- `self|340|66` enemy 18张 张数0/0/7/18 级4 上手=fullhouse:7<br>decide: **bomb:7{7S 7H 7S 7C 4H}** (1.00) [noWasteJ,mustBomb] vs **bomb:9{9C 9C 9H 4H}** (+1.00, t=99.0, n=36)<br>手牌: 10H 4S 3S KD 8H 10D 8D KH 9C 4H 7S 3H 7H 3C 9C 7S 9H 7C

### 🚩 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌

旧口径（含拆炸/只有炸弹可压）：25/34 (74%)；其中不拆三张也能压：20/29 (69%)；只能拆三张才能压：1/1 (100%)

- `self|6|59` 座1 25张 敌最少1 对家5 级8 上手=pair:Q → **pass** [mustBomb,可压:pair:8{8C 8H} / pair:K{KS 8H} / pair:A{AS 8H}]<br>手牌: 8H 8C AS KS QS QC QD JS JH JC JD 10S 10D 7S 7C 7C 7D 5S 3S 3H 3C 3D 2S 2H 2D
- `self|64|49` 座0 15张 敌最少1 对家8 级A 上手=pair:3 → **pass** [mustBomb,可压:pair:K{KC KH} / pair:7{7S 7D} / pair:7{7S 7S}]<br>手牌: RJ KH KC 10S 10H 10C 10C 7S 7S 7D 6H 6C 6C 6D 3H
- `self|102|68` 座0 17张 敌最少3 对家6 级K 上手=pair:8 → **pass** [mustBomb,可压:pair:RJ{RJ RJ} / pair:A{AC AS} / pair:9{9H 9D}]<br>手牌: RJ RJ KS AS AC 10D 10D 9S 9H 9D 8S 8D 7S 7C 7D 7D 3H
- `self|545|69` 座2 13张 敌最少2 对家18 级A 上手=single:2 → **pass** [可压:single:BJ{BJ}]<br>手牌: BJ KS KH KC KD QH QH QC QD 3S 3C 3C 3D
- `self|640|76` 座2 12张 敌最少3 对家7 级5 上手=pair:6 → **pass** [可压:pair:Q{QD QH} / pair:Q{QD QH} / pair:Q{QH QH}]<br>手牌: BJ QH QH QD 6D 4S 4C 2S 2S 2H 2D 2D

### 早中盘领出小单（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：186/189 (98%)

- `self|10|72` 座1 11张 敌最少10 对家0 级Q 上手=single:6 → **pass** []<br>手牌: QS QC JS JS JH JC JC 4S 4S 4C 4D
- `self|254|48` 座0 17张 敌最少9 对家11 级9 上手=single:10 → **pass** []<br>手牌: BJ 9C KS KS KC KD 7S 7H 7C 7C 7D 7D 6S 6C 3S 3C 3C
- `self|504|50` 座3 15张 敌最少10 对家16 级Q 上手=single:9 → **pass** [noSFon8]<br>手牌: BJ JS JH 10H 10C 10D 9S 9D 5H 5H 5C 5C 3S 3S 3D
- `self|658|50` 座2 23张 敌最少9 对家8 级10 上手=single:6 → **pass** []<br>手牌: BJ 10S AS AH KS KH KC KD QD QD 6H 6H 5H 5D 4S 4H 4D 3S 3C 2H 2H 2C 2D
- `self|818|66` 座3 9张 敌最少8 对家7 级A 上手=single:7 → **pass** []<br>手牌: RJ AH AS AC AC AD 9S 9C 5S

### 早中盘领出小对（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：132/134 (99%)

- `self|21|61` 座3 20张 敌最少9 对家0 级10 上手=pair:K → **pass** []<br>手牌: BJ 10S 10C 10D 10D JS JH 9H 9H 9C 9D 8D 7H 7C 7D 6S 6S 6C 6C 6D
- `self|204|35` 座3 17张 敌最少11 对家14 级J 上手=pair:7 → **pass** []<br>手牌: RJ BJ AH AH AC AD AD KS KD QC QD 7H 7C 7D 4S 4D 3C
- `self|439|91` 座1 8张 敌最少12 对家0 级Q 上手=pair:9 → **pass** []<br>手牌: KS KS KH KD JS JH JC JD
- `self|652|50` 座0 8张 敌最少13 对家0 级4 上手=pair:2 → **pass** []<br>手牌: BJ BJ 4D KH 9H 9C 9D 8H
- `self|844|82` 座2 6张 敌最少9 对家0 级A 上手=pair:5 → **pass** []<br>手牌: AC 7S 7S 7H 7D 7D

### 跟敌人牌过牌率（early，有牌可出时）

- `self|1|15` 座3 26张 敌最少20 对家20 级3 上手=single:A → **pass** []<br>手牌: 3H 3H 3S AS AH AD KH QH QC QC QD JD 10S 10C 8S 8C 7H 7C 7C 5S 5H 5C 4D 2S 2H 2H
- `self|205|24` 座1 20张 敌最少14 对家20 级Q 上手=single:A → **pass** []<br>手牌: BJ QS AS 10S 10H 10C 10D 9H 9C 9C 8S 8H 8H 8C 7S 7D 5S 5H 4D 2H
- `self|402|13` 座3 21张 敌最少20 对家26 级A 上手=single:K → **pass** []<br>手牌: BJ AH AD KS KH JS JH JD 10C 9H 9C 9C 8H 8D 6C 3H 2H 2H 2C 2D 2D
- `self|598|22` 座2 22张 敌最少18 对家21 级2 上手=fullhouse:K → **pass** []<br>手牌: RJ 2H 2S 2S KH KD QS QC 10D 10D 9S 9H 9C 9C 8C 8D 7S 7D 5S 5D 4S 4C
- `self|801|25` 座3 23张 敌最少17 对家13 级10 上手=fullhouse:J → **pass** []<br>手牌: BJ 10H 10D AS AC AC KD QH 8H 7S 7S 7H 7D 7D 5S 5S 5C 5D 5D 3S 3S 3D 2D

### 跟敌人牌过牌率（mid，有牌可出时）

- `self|1|29` 座1 17张 敌最少16 对家25 级3 上手=pair:J → **pass** []<br>手牌: AS AC KH KD QS QH QD 9S 9H 9H 9D 9D 8C 7S 7H 7D 7D
- `self|224|32` 座3 17张 敌最少11 对家18 级5 上手=single:K → **pass** []<br>手牌: RJ 5H 5H 5D AS AC AD AD KC JS JH JC 9C 6S 6C 4S 4H
- `self|430|56` 座0 12张 敌最少7 对家8 级3 上手=triple:7 → **pass** []<br>手牌: 3H 3C KH JS JH 10S 10S 10H 10C 10C 6H 6H
- `self|617|46` 座2 12张 敌最少9 对家18 级8 上手=single:7 → **pass** []<br>手牌: RJ 8H 8C KS KH KC KD 5D 4S 4C 4D 4D
- `self|816|32` 座2 10张 敌最少15 对家22 级Q 上手=pair:J → **pass** []<br>手牌: RJ QH QC QC AC 8S 8C 7S 5S 5C

### 跟敌人牌过牌率（late，有牌可出时）

- `self|3|36` 座2 6张 敌最少17 对家18 级5 上手=single:A → **pass** []<br>手牌: BJ BJ AS AC AD AD
- `self|199|53` 座3 8张 敌最少11 对家22 级6 上手=triple:J → **pass** []<br>手牌: QH QH QC QD 7S 7S 7H 7C
- `self|421|59` 座0 8张 敌最少7 对家13 级7 上手=single:4 → **pass** []<br>手牌: AS AH KS KH KC KD QH QC
- `self|606|72` 座0 6张 敌最少12 对家5 级10 上手=single:8 → **pass** [noSFon8]<br>手牌: 10C 10D QS QH QD QD
- `self|787|21` 座2 9张 敌最少15 对家20 级9 上手=single:A → **pass** []<br>手牌: RJ 9H AS AH KC KD QC JS 7S

### 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率

按座位 南/东/北/西：609/2628 (23%) / 549/2675 (21%) / 567/2650 (21%) / 574/2631 (22%)

- `self|1|32` 座0 16张 敌最少17 对家21 级3 上手=pair:8 → **pass** []<br>手牌: RJ BJ JS JH 10H 10H 10C 9S 9C 8S 8H 8H 8D 6H 6C 6D
- `self|230|54` 座0 16张 敌最少9 对家13 级J 上手=single:10 → **pass** []<br>手牌: RJ JH AS AH AC 10H 10C 4S 4S 4H 4C 4C 2S 2H 2C 2D
- `self|447|60` 座3 11张 敌最少8 对家14 级7 上手=single:6 → **pass** []<br>手牌: RJ 5S 5S 5C 5D 5D 2S 2S 2C 2D 2D
- `self|632|57` 座0 11张 敌最少8 对家3 级10 上手=single:7 → **pass** []<br>手牌: BJ BJ 10H 5S 5C 4H 4C 4D 4D 3H 3D
- `self|820|43` 座0 18张 敌最少13 对家8 级3 上手=single:8 → **pass** [noSFon8]<br>手牌: 3S 3D QH QH QD JC JC 10H 10H 9S 9C 9D 8H 8C 4S 4S 4C 4D

### 压对家的牌（early，有牌可压时）

- `self|763|67` 座1 22张 敌最少1 对家5 级J 上手=single:10 → **single:RJ{RJ}** [followUp,blockLikely]<br>手牌: RJ JH JD AC AD QS QS QH QC 9S 9D 8S 8C 8C 8D 6S 6C 6D 6D 5S 5H 4H
- `self|905|65` 座1 22张 敌最少2 对家9 级10 上手=single:J → **single:Q{QS}** [followUp]<br>手牌: 10S 10S 10C 10C QS JC 9S 9H 8H 8H 8C 8D 7S 7D 5H 5C 5C 5D 4D 3S 3H 2S
- `self|943|72` 座3 20张 敌最少2 对家4 级9 上手=single:A → **single:9{9H}** [followUp]<br>手牌: 9H 9H AH AC AD KS KH KC KD 8S 8D 7D 5S 5S 5C 5D 5D 3H 2S 2H

### 压对家的牌（mid，有牌可压时）

- `self|41|59` 座0 10张 敌最少17 对家14 级4 上手=straight:6 → **straight:7{3S 4D 5H 6C 7S}** []<br>手牌: 4H 4D JC JD 7S 6C 5H 3S 3S 3C
- `self|149|77` 座3 11张 敌最少1 对家0 级8 上手=single:BJ → **single:RJ{RJ}** [followUp,blockLikely]<br>手牌: RJ QH QC QC JH JC JD 10D 7S 7S 7C
- `self|550|83` 座3 11张 敌最少9 对家11 级6 上手=fullhouse:5 → **fullhouse:10{10H 10S KS KH 6H}** [keepWild,forceFinish:bombBack]<br>手牌: 6H KS KH 10S 10H 8S 8H 8H 8C 8D 8D
- `self|895|84` 座0 12张 敌最少2 对家2 级K 上手=single:Q → **single:K{KS}** [followUp]<br>手牌: KS AS AD JS JD 9S 9D 8C 8D 5S 5H 5C
- `self|916|51` 座1 10张 敌最少20 对家6 级8 上手=fullhouse:J → **fullhouse:K{KH KD KC 9S 9C}** [forceFinish:bombBack]<br>手牌: 8H AS AH AC AC KH KC KD 9S 9C

### 压对家的牌（late，有牌可压时）

- `self|3|64` 座2 2张 敌最少3 对家4 级5 上手=pair:A → **pair:BJ{BJ BJ}**<br>手牌: BJ BJ
- `self|183|69` 座1 5张 敌最少17 对家4 级3 上手=fullhouse:J → **fullhouse:Q{QD QH JH JC 3H}**<br>手牌: 3H QH QD JH JC
- `self|399|88` 座0 1张 敌最少1 对家0 级J 上手=single:J → **single:BJ{BJ}**<br>手牌: BJ
- `self|612|66` 座2 7张 敌最少19 对家5 级3 上手=fullhouse:5 → **fullhouse:9{9H 9S 9S 7H 7H}** []<br>手牌: 10S 10C 9S 9S 9H 7H 7H
- `self|791|94` 座0 3张 敌最少5 对家0 级K 上手=single:7 → **single:RJ{RJ}** [followUp,strongBeforeLast,forceFinish:likely]<br>手牌: RJ 8C 8C

### 敌家都 ≥15 张时炸普通牌（占跟牌炸弹）

每副炸弹数（自对局，四人合计）：早 0.31 / 中 1.87 / 晚 2.74

- `self|2|63` 座3 14张 敌最少18 对家0 级4 上手=pair:A → **bomb:K{KD KS KH KC KD}** [mustBomb]<br>手牌: RJ 4S KS KH KC KD KD 7S 7C 3C 2S 2S 2H 2D
- `self|176|21` 座3 27张 敌最少21 对家22 级9 上手=tripleSeq:9 → **bomb:4{4S 4D 4S 4H}** [mustBomb]<br>手牌: RJ 9C AH KS KS KD JD 10S 10H 10D 8H 8D 7S 7H 7D 6S 6C 5H 5C 5C 5D 4S 4S 4H 4D 2S 2D
- `self|370|72` 座0 11张 敌最少17 对家8 级8 上手=triple:2 → **bomb:3{3S 3C 3H 3D 3C}** [mustBomb]<br>手牌: 8C QH 5S 5S 5H 5H 3S 3H 3C 3C 3D
- `self|570|42` 座1 17张 敌最少18 对家8 级K 上手=tripleSeq:7 → **straightFlush:9{5S 6S 7S 8S 9S}** [mustBomb]<br>手牌: AD QH QH QC QD 10H 10C 9S 8S 8D 7S 7C 6S 5S 5C 5D 2H
- `self|785|43` 座1 22张 敌最少22 对家8 级7 上手=fullhouse:A → **bomb:K{KC KD KS KC}** [noWasteJ,mustBomb]<br>手牌: AC KS KC KC KD QC JH JC JD 10H 8S 8C 5S 5C 5C 4H 4C 3S 3H 3C 2H 2D

### 敌家都 ≥10 张时领出炸弹（非走完）

炸压炸占跟牌炸弹：1505/3651 (41%)

- `self|9|52` 座2 8张 敌最少19 对家21 级J 上手=pass → **bomb:6{6D 6C 6S 6D}** [holdBombLead,control,leadBombLate]<br>手牌: QS QS QD QD 6S 6C 6D 6D
- `self|264|96` 座3 7张 敌最少19 对家3 级6 上手=pass → **bomb:7{7C 7D 7S 7H}** [control,forceFinish:likely]<br>手牌: 8S 8S 8D 7S 7H 7C 7D
- `self|427|52` 座0 8张 敌最少13 对家21 级K 上手=pass → **bomb:2{2S 2D 2C 2S}** [holdBombLead,control,leadBombLate]<br>手牌: 7S 7C 7C 7D 2S 2S 2C 2D
- `self|608|74` 座1 12张 敌最少13 对家15 级Q 上手=pass → **bomb:10{10C 10H 10H 10S QH}** [control]<br>手牌: QH QS AS AC KS KH KC KD 10S 10H 10H 10C
- `self|759|60` 座2 8张 敌最少10 对家16 级7 上手=pass → **bomb:9{9C 9S 9S 9H}** [holdBombLead,control,leadBombLate]<br>手牌: KH KC KC KD 9S 9S 9H 9C

### 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌

- `self|8|32` 座0 10张 敌最少3 对家26 级10 上手=fullhouse:6 → **pass** []<br>手牌: 10H QS JH 7H 6D 5S 5H 5C 5C 4S
- `self|197|72` 座2 11张 敌最少2 对家2 级4 上手=fullhouse:J → **pass** []<br>手牌: BJ BJ 8S 7S 7C 7D 7D 6S 6H 6H 6C
- `self|339|70` 座1 7张 敌最少2 对家0 级3 上手=fullhouse:3 → **pass** []<br>手牌: 3H 3C 3C 3D KS KD 7S
- `self|560|71` 座1 12张 敌最少2 对家7 级3 上手=fullhouse:J → **pass** []<br>手牌: RJ RJ BJ AC 8S 8H 8C 8D 8D 7D 2C 2C
- `self|730|43` 座1 15张 敌最少2 对家19 级4 上手=single:J → **pass** []<br>手牌: 10S 10C 9S 9D 8S 8H 7S 7H 7H 7C 6H 6C 6D 6D 2C

### 输家结束时手里还留着炸弹（每个输家座位）

- `self|6` 座1 结束时手里：JC JD JH JS 2H
- `self|15` 座1 结束时手里：4S 6H RJ 6C 6H 6D AH 9D
- `self|20` 座0 结束时手里：AH AC AS AD
- `self|20` 座2 结束时手里：9S 8S 7D 8H BJ 8C 7S 8S 7H
- `self|25` 座3 结束时手里：QH AS 9D QH 4C QD 5H 5H 9D 8C QS 4D 8S 10D QS

### 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10）

- `self|8|34` 座2 26张 敌最少1 对家10 级10 上手=pair:A → **pair:10{10C 10H}** [stopShort,followSize,blockLikely]<br>手牌: RJ BJ 10H 10C AH AH QC QD JS 9C 8S 8C 7H 7D 6S 6S 6H 6D 4S 4C 4D 3H 3C 3C 2D 2D
- `self|85|73` 座2 22张 敌最少7 对家3 级9 上手=single:10 → **single:RJ{RJ}** [stopShort,followUp,followSize]<br>手牌: RJ 9C 9D AH AC AD QH QC QC JS JS JC JD 7S 7H 7H 7C 6D 2S 2H 2C 2D
- `self|268|52` 座2 23张 敌最少8 对家15 级10 上手=single:10 → **single:BJ{BJ}** [followUp,followSize,keepControl,spareControl]<br>手牌: RJ BJ 10H 10H 10S KS KS KH KC QH 6S 6H 6C 6C 4S 4H 4C 4D 3H 3C 3C 3D 3D
- `self|408|67` 座0 20张 敌最少2 对家0 级7 上手=pair:10 → **pair:K{KC 7H}** [stopShort,followSize]<br>手牌: BJ 7H KC QS 9C 8C 6C 6C 5H 5C 5C 4S 4H 4D 3S 3H 3C 2H 2H 2C
- `self|727|51` 座2 24张 敌最少2 对家7 级A 上手=single:8 → **single:A{AH}** [noSFon8,stopShort,followUp,followSize]<br>手牌: RJ AH KD JS JH JH JD JD 8S 8H 7S 7H 7H 7C 5S 5H 5H 5D 4S 4S 3S 3C 3D 2S

### 早盘领出 A/级牌/王的单对

- `self|108|74` 座3 20张 敌最少3 对家2 级6 上手=pass → **pair:6{6D 6C}** [control]<br>手牌: 6C 6D AH 10S 9S 9S 9H 9C 9D 9D 7C 5D 4C 4C 4D 4D 2S 2C 2D 2D
- `self|258|37` 座1 20张 敌最少15 对家11 级K 上手=pass → **single:A{AS}** [control]<br>手牌: RJ KC KD AS JC JD 9S 9C 7S 7H 7C 7D 6C 6D 5S 5H 2S 2H 2C 2C
- `self|315|12` 座3 25张 敌最少25 对家25 级5 上手=pass → **pair:5{5S 5C}** [control,planKeepControl]<br>手牌: 5S 5C AS AD QH QD JS JH JC JD 10H 10C 9H 9D 8S 8S 8C 8C 8D 7S 7C 3S 3D 2H 2C
- `self|615|17` 座3 24张 敌最少18 对家26 级6 上手=pass → **single:A{AS}** [control]<br>手牌: 6H 6S 6S 6C AS QC QD JC JD 8S 8H 8H 8C 8D 4C 4D 3C 3D 2S 2S 2H 2C 2C 2D
- `self|822|36` 座3 20张 敌最少14 对家10 级5 上手=pass → **single:RJ{RJ}** [control,planKeepControl]<br>手牌: RJ JS JC JC JD 10S 10D 9H 9C 8S 8H 8H 8C 8D 7H 7C 2S 2H 2C 2C

### 拆炸弹领出

- `self|9|44` 座2 12张 敌最少19 对家21 级J 上手=pass → **triple:J{JS JD JS}** [bombBreakNoGain,leadSmallSame,control,offPlan]<br>手牌: JS JS JC JD QS QS QD QD 6S 6C 6D 6D
- `self|173|6` 座1 22张 敌最少22 对家22 级6 上手=pass → **straight:10{6S 7D 8D 9C 10D}** [bombBreakNoGain,holdBombLead,control,planUnitFirst]<br>手牌: BJ BJ 6S AS AS AH AD QC JH JC 10D 9C 8S 8S 8C 8D 7D 4H 4D 3S 3C 3D
- `self|456|59` 座1 12张 敌最少8 对家24 级3 上手=pass → **single:10{10H}** [control,offPlan]<br>手牌: 3C 3D 10S 10H 10H 10C 5H 5C 5C 5D 4S 4C
- `self|613|52` 座3 8张 敌最少14 对家10 级4 上手=pass → **pairSeq:J{9H 9D 10S 10H JS JH}** [holdBombLead,control,offPlan]<br>手牌: JS JH 10S 10H 9H 9C 9C 9D
- `self|801|48` 座2 8张 敌最少13 对家23 级10 上手=pass → **triple:10{10C 10D 10C}** [bombBreakNoGain,leadSmallSame,control,offPlan]<br>手牌: 10S 10C 10C 10D 8S 8S 8C 8C

### 早盘拆对领单（手里有顺子/连对/钢板可出）

- `self|500|90` 座3 24张 敌最少2 对家0 级8 上手=pass → **single:Q{QD}** [vsTwoSingle,control,offPlan]<br>手牌: 8S 8C AS AD KS KS KC KD QH QD JS JC JC JD 10S 10H 7S 7H 7C 7C 4S 4S 4H 4D
- `self|903|0` 座0 27张 敌最少27 对家27 级8 上手=pass → **single:10{10D}** [noFirstBomb,control]<br>手牌: 8H 8C 8D AS AH AD KS KH KD QS QC JH 10H 10D 9H 7C 7D 6H 6H 6C 6D 5D 4D 3D 3D 2S 2D

### 早盘领出单张占比

早盘领出牌型分布：straight 21%，single 19%，pairSeq 17%，fullhouse 16%，pair 12%，tripleSeq 10%，triple 4%；熵 2.68 bit


### decide 用时 >300ms 的比例

p50 1.7ms，p90 18.2ms，p99 51.7ms，max 1422ms

- `vsOld:pre-activity0|200123|97` 座0 13张 敌最少2 对家0 级3 上手=fullhouse:7 → **bomb:J{JS JH JC JD JS 3H}** [noWasteJ,forceFinish:likely]<br>手牌: RJ 3H 3H KS KS KC KC KD JS JS JH JC JD
- `self|921|101` 座1 16张 敌最少6 对家0 级K 上手=fullhouse:2 → **bomb:9{9D 9C 9H 9D}** [noWasteJ,mustBomb]<br>手牌: RJ RJ KH KH 9H 9C 9D 9D 7H 7D 6H 6C 5H 5C 5D 5D
- `vsOld:pre-round60|200131|0` 座2 27张 敌最少27 对家27 级J 上手=pass → **straight:7{3D 4H 5H 6D 7D}** [noFirstBomb,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: RJ JH JS JC JD KS KH KD QS QC 10C 9H 8S 8H 8C 7S 7D 6H 6D 5H 4H 3S 3C 3D 2H 2C 2C
- `self|517|12` 座3 16张 敌最少17 对家22 级Q 上手=fullhouse:2 → **fullhouse:6{6D 6S 6H 8C 8D}** [fhAttach]<br>手牌: RJ BJ QH QH AC AD KD 9S 9H 9D 8C 8D 6S 6H 6D 5C
- `self|43|44` 座2 14张 敌最少2 对家18 级6 上手=fullhouse:7 → **fullhouse:8{8D 8C 8H 9C 9S}** [fhAttach,stopShort]<br>手牌: RJ 6H 6H QS QS QH QC QD 9S 9C 8H 8C 8D 7D

### 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）

全部通过

