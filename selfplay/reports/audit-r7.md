# 自对局体检报告

生成：2026/10/18 21:46:08（America/Toronto）　policy：post-selfplay-r7　用时 541s

对局：自对局 1000 副（四家 decide），混合对手 Random、Greedy、Old:pre-activity、Old:pre-round6 各 200×2 副（换座位）；逐手记录 246284 条；surprise 局面 185 个。

局面 id 可复现：`node selfplay/audit.mjs --replay='<id>'`（cfg|seed|step）。

## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）

- **Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5**：6.5%（n=185，合理区间 ≤5%，严重度 2.0）
- **对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张时仍过牌**：73.5%（n=34，合理区间 ≤60%，严重度 0.7）

## 全部检测器

| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |
|---|---|---|---|---|---|
| 早中盘领出小单（≤10）后两个敌家都不跟 | 6.8% | 2763 | ≤25% | 10.2% | OK |
| 早中盘领出小对（≤10）后两个敌家都不跟 | 12.8% | 1043 | ≤35% | 21.0% | OK |
| 跟敌人牌过牌率（early，有牌可出时） | 50.8% | 18996 | ≥30 且 ≤62% | 49.8% | OK |
| 跟敌人牌过牌率（mid，有牌可出时） | 57.5% | 20747 | ≥30 且 ≤65% | 60.8% | OK |
| 跟敌人牌过牌率（late，有牌可出时） | 41.3% | 6656 | ≥20 且 ≤75% | 36.8% | OK |
| 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率 | 21.7% | 10573 | ≤35% | 27.8% | OK |
| 压对家的牌（early，有牌可压时） | 0.1% | 5873 | ≤15% | 0.0% | OK |
| 压对家的牌（mid，有牌可压时） | 0.2% | 7460 | ≤15% | 0.3% | OK |
| 压对家的牌（late，有牌可压时） | 12.6% | 2565 | ≤30% | 13.7% | OK |
| 炸对家（未因此走完） | 0.0% | 14764 | ≤2% | 0.0% | OK |
| 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张时仍过牌 | 73.5% | 34 | ≤60% | 45.5% | 🚩 |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 11.8% | 2148 | ≤15% | 14.3% | OK |
| 敌家都 ≥10 张时领出炸弹（非走完） | 4.3% | 4908 | ≤10% | 5.7% | OK |
| 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌 | 5.4% | 780 | ≤45% | 2.3% | OK |
| 输家结束时手里还留着炸弹（每个输家座位） | 6.4% | 2000 | ≤20% | 4.8% | OK |
| 输家结束时还握着 ≥2 张王/级牌 | 7.2% | 2000 | ≤25% | 8.5% | OK |
| 末游卡手（结束时 ≥8 张且至少还要 5 手） | 0.0% | 1000 | ≤25% | 0.0% | OK |
| 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10） | 0.6% | 5920 | ≤8% | 1.2% | OK |
| 早盘领出 A/级牌/王的单对 | 0.4% | 1218 | ≤12% | 2.8% | OK |
| 拆炸弹领出 | 0.7% | 15875 | ≤2% | 0.7% | OK |
| 早盘拆对领单（手里有顺子/连对/钢板可出） | 0.3% | 598 | ≤15% | 1.6% | OK |
| 早盘领出对子占比 | 12.3% | 3837 | ≥5% | 4.6% | OK |
| 早盘领出单张占比 | 19.4% | 3837 | ≥15 且 ≤55% | 72.6% | OK |
| 一手能出完却没出完 | 0.0% | 2681 | ≤1% | 0.0% | OK |
| decide 用时 >300ms 的比例 | 0.0% | 166160 | ≤0.5% | 0.0% | OK |
| 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测） | 0.000 | 2600 | ≤0 | 0.000 | OK |
| 对 Random 每副净升级 | 2.955 | 400 | ≥1.5 | 2.920 | OK |
| 对 Greedy 每副净升级 | 2.255 | 400 | ≥0.5 | 2.288 | OK |
| Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5 | 6.5% | 185 | ≤5% | 10.8% | 🚩 |

## 队伍结果

- 自对局 1000 副：南北队每副净升级 0.117 [-0.013, 0.247]（应≈0），双下率 30.3%，平均每副 93 手
- 各座位平均名次（南/东/北/西）：2.39 / 2.51 / 2.53 / 2.56
- decide vs Random：400 副，胜 397/400 (99%)，每副净升级 2.955 [2.919, 2.991]
- decide vs Greedy：400 副，胜 359/400 (90%)，每副净升级 2.255 [2.114, 2.396]
- decide vs Old:pre-activity：400 副，胜 312/400 (78%)，每副净升级 1.230 [1.061, 1.399]
- decide vs Old:pre-round6：400 副，胜 311/400 (78%)，每副净升级 1.325 [1.148, 1.502]

## 详情与示例局面

### 🚩 Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5

分类：enemy/late/passed 4，partner/early/shouldPass 2，enemy/mid/passed 2，partner/late/shouldPass 1，enemy/early/otherPlay 1，lead/mid/otherPlay 1，partner/mid/shouldPass 1

- `self|959|41` enemy 9张 张数11/8/9/21 级Q 上手=single:6<br>decide: **pass** (-0.50) [] vs **single:A{AC}** (+2.03, t=5.3, n=36)<br>手牌: KH BJ BJ 4D RJ 4D KD AC AD
- `self|943|72` partner 20张 张数2/4/16/20 级9 上手=single:A<br>decide: **single:9{9H}** (-0.33) [followUp] vs **pass** (+1.86, t=5.0, n=36)<br>手牌: 5C 2S KC 3H 5D 2H 9H 5S 8S KD KS 9H 5S 7D AD AC KH 8D AH 5D
- `self|128|92` partner 7张 张数7/2/0/2 级K 上手=single:A<br>decide: **single:K{KD}** (1.31) [followUp] vs **pass** (+1.69, t=21.8, n=36)<br>手牌: 8D KD QS JH QC JD 10D
- `self|885|62` enemy 7张 张数17/11/7/7 级3 上手=single:K<br>decide: **pass** (0.03) [] vs **single:3{3S}** (+1.61, t=4.7, n=36)<br>手牌: QD BJ 7S BJ JS 3S 3D
- `self|496|10` enemy 27张 张数20/23/27/27 级4 上手=single:6<br>decide: **single:A{AC}** (-0.83) [followUp,followSize,activeFollow:0] vs **single:RJ{RJ}** (+1.31, t=3.2, n=36)<br>手牌: 3S RJ 10D KD 3C 3H KD 2D AC 5H 8D 7S JS QS 9C JD 10H RJ KS QH 6S 9S 7H KC 8H 8C 5S
- `self|78|32` enemy 9张 张数12/9/20/20 级2 上手=single:A<br>decide: **pass** (1.08) [] vs **single:BJ{BJ}** (+1.25, t=3.3, n=36)<br>手牌: 7D 2H BJ 7D 7H BJ 7H 9D 9S
- `self|183|27` lead 10张 张数15/10/21/21 级3 上手=pass<br>decide: **single:10{10D}** (1.53) [smallFirst,control,planWeakFirst] vs **pairSeq:Q{10D JH JC QD QH 3H}** (+1.11, t=3.6, n=36)<br>手牌: BJ 5D QD 5H QH 5C JH 3H 10D JC
- `self|763|67` partner 22张 张数12/22/1/5 级J 上手=single:10<br>decide: **single:RJ{RJ}** (0.00) [followUp,blockLikely] vs **pass** (+1.11, t=3.2, n=36)<br>手牌: QS 5H QS QC 8S JH RJ 8C 6S 8D 6D 6C JD 6D 5S 4H 9S AD 9D QH AC 8C

### 🚩 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张时仍过牌

- `self|6|59` 座1 25张 敌最少1 对家5 级8 上手=pair:Q → **pass** [mustBomb]<br>手牌: 8H 8C AS KS QS QC QD JS JH JC JD 10S 10D 7S 7C 7C 7D 5S 3S 3H 3C 3D 2S 2H 2D
- `self|64|53` 座0 15张 敌最少1 对家6 级A 上手=pair:5 → **pass** [mustBomb]<br>手牌: RJ KH KC 10S 10H 10C 10C 7S 7S 7D 6H 6C 6C 6D 3H
- `self|210|49` 座1 17张 敌最少3 对家10 级4 上手=pair:2 → **pass** []<br>手牌: RJ 4H 4S 4C 4C AH AC 9S 9H 5H 3S 3C 3D 2S 2H 2C 2D
- `self|545|81` 座2 13张 敌最少1 对家13 级A 上手=pair:7 → **pass** [mustBomb]<br>手牌: BJ KS KH KC KD QH QH QC QD 3S 3C 3C 3D
- `self|640|76` 座2 12张 敌最少3 对家7 级5 上手=pair:6 → **pass** []<br>手牌: BJ QH QH QD 6D 4S 4C 2S 2S 2H 2D 2D

### 早中盘领出小单（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：184/187 (98%)

- `self|10|72` 座1 11张 敌最少10 对家0 级Q 上手=single:6 → **pass** []<br>手牌: QS QC JS JS JH JC JC 4S 4S 4C 4D
- `self|240|65` 座1 13张 敌最少11 对家11 级8 上手=single:9 → **pass** [noSFon8]<br>手牌: 8H 8S 9H 9H 9C 9C 9D 9D 5D 3S 3H 3H 3C
- `self|456|60` 座2 8张 敌最少11 对家16 级3 上手=single:10 → **pass** []<br>手牌: RJ 3S AS AH AC AD 6C 6D
- `self|649|57` 座1 19张 敌最少9 对家9 级A 上手=single:7 → **pass** []<br>手牌: AC AC JH JC JC 10S 10C 9S 9H 9H 9C 9D 8S 8C 5C 5D 2S 2H 2D
- `self|832|58` 座1 16张 敌最少10 对家10 级2 上手=single:10 → **pass** []<br>手牌: RJ 2H QS QS QC QC QD JH JD JD 9H 5S 5H 5C 4S 4D

### 早中盘领出小对（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：132/133 (99%)

- `self|21|61` 座3 20张 敌最少9 对家0 级10 上手=pair:K → **pass** []<br>手牌: BJ 10S 10C 10D 10D JS JH 9H 9H 9C 9D 8D 7H 7C 7D 6S 6S 6C 6C 6D
- `self|204|35` 座3 17张 敌最少11 对家14 级J 上手=pair:7 → **pass** []<br>手牌: RJ BJ AH AH AC AD AD KS KD QC QD 7H 7C 7D 4S 4D 3C
- `self|439|91` 座1 8张 敌最少12 对家0 级Q 上手=pair:9 → **pass** []<br>手牌: KS KS KH KD JS JH JC JD
- `self|652|50` 座0 8张 敌最少13 对家0 级4 上手=pair:2 → **pass** []<br>手牌: BJ BJ 4D KH 9H 9C 9D 8H
- `self|847|46` 座3 10张 敌最少9 对家11 级4 上手=pair:9 → **pass** []<br>手牌: RJ BJ BJ QS QH QH QC QC 3H 3D

### 跟敌人牌过牌率（early，有牌可出时）

- `self|1|15` 座3 26张 敌最少20 对家20 级3 上手=single:A → **pass** []<br>手牌: 3H 3H 3S AS AH AD KH QH QC QC QD JD 10S 10C 8S 8C 7H 7C 7C 5S 5H 5C 4D 2S 2H 2H
- `self|205|26` 座3 20张 敌最少13 对家20 级Q 上手=single:7 → **pass** []<br>手牌: RJ QH QC AS AH AC AD KS KC KD 6C 6C 6D 4S 4H 4C 4D 3S 3H 3D
- `self|404|5` 座0 27张 敌最少17 对家22 级3 上手=fullhouse:J → **pass** []<br>手牌: RJ 3H 3C 3D AS AS AD KS KD QD JS 10S 10H 10D 9S 9C 9C 7H 7C 7D 6S 6H 6C 5S 5H 5C 2D
- `self|599|21` 座0 22张 敌最少11 对家11 级3 上手=fullhouse:Q → **pass** []<br>手牌: RJ 3S AS KH KH KC KD QS QC QD QD JH JH JD 10S 10D 9S 9H 8H 5D 5D 4S
- `self|801|53` 座3 21张 敌最少4 对家13 级10 上手=single:10 → **pass** []<br>手牌: BJ 10H 10D AS AC AC KD 7S 7S 7H 7D 7D 5S 5S 5C 5D 5D 3S 3S 3D 2D

### 跟敌人牌过牌率（mid，有牌可出时）

- `self|1|29` 座1 17张 敌最少16 对家25 级3 上手=pair:J → **pass** []<br>手牌: AS AC KH KD QS QH QD 9S 9H 9H 9D 9D 8C 7S 7H 7D 7D
- `self|222|73` 座2 10张 敌最少5 对家0 级3 上手=single:J → **pass** []<br>手牌: 3H 3C AS AD 5S 5S 5H 5C 2S 2C
- `self|431|44` 座0 16张 敌最少11 对家23 级4 上手=single:BJ → **pass** []<br>手牌: RJ BJ JS JS JH JD 10S 10H 10D 9S 9H 3S 3H 3C 3D 3D
- `self|618|16` 座0 15张 敌最少25 对家27 级9 上手=single:Q → **pass** []<br>手牌: RJ 9H 9S AS AC AD JS 8S 8C 8C 8D 3S 3S 3H 3D
- `self|816|32` 座2 10张 敌最少15 对家22 级Q 上手=pair:J → **pass** []<br>手牌: RJ QH QC QC AC 8S 8C 7S 5S 5C

### 跟敌人牌过牌率（late，有牌可出时）

- `self|3|36` 座2 6张 敌最少17 对家18 级5 上手=single:A → **pass** []<br>手牌: BJ BJ AS AC AD AD
- `self|193|37` 座2 5张 敌最少20 对家26 级K 上手=single:Q → **pass** []<br>手牌: BJ BJ KS KD 10C
- `self|417|42` 座3 8张 敌最少9 对家18 级3 上手=pair:9 → **pass** []<br>手牌: RJ 3C 3C 10H 10H 10C 9S 8H
- `self|602|40` 座0 7张 敌最少9 对家15 级6 上手=single:A → **pass** []<br>手牌: 6H 6S 6C 6C 6D AD 10H
- `self|787|21` 座2 9张 敌最少15 对家20 级9 上手=single:A → **pass** []<br>手牌: RJ 9H AS AH KC KD QC JS 7S

### 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率

按座位 南/东/北/西：608/2630 (23%) / 550/2670 (21%) / 564/2643 (21%) / 570/2630 (22%)

- `self|1|32` 座0 16张 敌最少17 对家21 级3 上手=pair:8 → **pass** []<br>手牌: RJ BJ JS JH 10H 10H 10C 9S 9C 8S 8H 8H 8D 6H 6C 6D
- `self|230|52` 座2 13张 敌最少9 对家16 级J 上手=single:10 → **pass** []<br>手牌: RJ JD KH KC KC KD 7S 3H 3C 3D 3D 2C 2D
- `self|447|77` 座0 16张 敌最少9 对家8 级7 上手=single:10 → **pass** []<br>手牌: RJ 7H 7H AS AD AD 8H 8H 8C 8D 5H 3H 3C 3C 3D 3D
- `self|632|57` 座0 11张 敌最少8 对家3 级10 上手=single:7 → **pass** []<br>手牌: BJ BJ 10H 5S 5C 4H 4C 4D 4D 3H 3D
- `self|825|9` 座3 25张 敌最少17 对家25 级8 上手=pair:10 → **pass** []<br>手牌: BJ BJ 8H 8S KS KH KD QS QD JS JC JC 10S 9S 9H 9C 9D 7S 7H 7C 6S 5H 5C 4D 2D

### 压对家的牌（early，有牌可压时）

- `self|763|67` 座1 22张 敌最少1 对家5 级J 上手=single:10 → **single:RJ{RJ}** [followUp,blockLikely]<br>手牌: RJ JH JD AC AD QS QS QH QC 9S 9D 8S 8C 8C 8D 6S 6C 6D 6D 5S 5H 4H
- `self|905|65` 座1 22张 敌最少2 对家9 级10 上手=single:J → **single:Q{QS}** [followUp]<br>手牌: 10S 10S 10C 10C QS JC 9S 9H 8H 8H 8C 8D 7S 7D 5H 5C 5C 5D 4D 3S 3H 2S
- `self|943|72` 座3 20张 敌最少2 对家4 级9 上手=single:A → **single:9{9H}** [followUp]<br>手牌: 9H 9H AH AC AD KS KH KC KD 8S 8D 7D 5S 5S 5C 5D 5D 3H 2S 2H

### 压对家的牌（mid，有牌可压时）

- `self|22|62` 座2 10张 敌最少5 对家11 级J 上手=fullhouse:3 → **fullhouse:4{4H 4S 4D 8D 8C}** []<br>手牌: JH JH 8H 8C 8D 8D 4S 4H 4D 4D
- `self|149|77` 座3 11张 敌最少1 对家0 级8 上手=single:BJ → **single:RJ{RJ}** [followUp,blockLikely]<br>手牌: RJ QH QC QC JH JC JD 10D 7S 7S 7C
- `self|407|44` 座3 11张 敌最少11 对家13 级6 上手=fullhouse:2 → **fullhouse:A{AC AS AD 6C 6D}** []<br>手牌: 6H 6C 6D AS AH AC AD KS KC QC QD
- `self|485|61` 座2 10张 敌最少9 对家19 级6 上手=fullhouse:2 → **fullhouse:8{8S 8S 8D KC KS}** []<br>手牌: 6H 6H KS KH KH KC 8S 8S 8D 8D
- `self|669|64` 座0 10张 敌最少11 对家8 级8 上手=fullhouse:4 → **fullhouse:5{5S 5C 5S 6C 6H}** []<br>手牌: 8H 8C 6S 6H 6C 5S 5S 5H 5C 4S

### 压对家的牌（late，有牌可压时）

- `self|3|64` 座2 2张 敌最少3 对家4 级5 上手=pair:A → **pair:BJ{BJ BJ}**<br>手牌: BJ BJ
- `self|205|80` 座3 3张 敌最少6 对家11 级Q 上手=pair:5 → **pair:6{6D 6C}** []<br>手牌: 6C 6C 6D
- `self|393|88` 座3 2张 敌最少3 对家1 级5 上手=single:K → **single:RJ{RJ}** [followUp,strongBeforeLast,forceFinish:sure]<br>手牌: RJ 8D
- `self|604|69` 座1 5张 敌最少15 对家4 级8 上手=bomb:3 → **bomb:7{7H 7D 7H 7S 8H}**<br>手牌: 8H 7S 7H 7H 7D
- `self|785|85` 座1 2张 敌最少1 对家0 级7 上手=single:8 → **single:10{10H}** [noSFon8,followUp,strongBeforeLast,forceFinish:sure,blockSure]<br>手牌: 10H 3S

### 敌家都 ≥15 张时炸普通牌（占跟牌炸弹）

每副炸弹数（自对局，四人合计）：早 0.31 / 中 1.87 / 晚 2.72

- `self|2|63` 座3 14张 敌最少18 对家0 级4 上手=pair:A → **bomb:K{KD KS KH KC KD}** [mustBomb]<br>手牌: RJ 4S KS KH KC KD KD 7S 7C 3C 2S 2S 2H 2D
- `self|185|74` 座3 11张 敌最少16 对家7 级5 上手=pair:7 → **bomb:6{6H 6C 6C 6D 6H}** [mustBomb]<br>手牌: 5S KD 6H 6H 6C 6C 6D 3S 3C 3C 3D
- `self|370|78` 座0 5张 敌最少16 对家8 级8 上手=single:BJ → **bomb:5{5S 5S 5H 5H}** [mustBomb,forceFinish:likely]<br>手牌: QH 5S 5S 5H 5H
- `self|570|42` 座1 17张 敌最少18 对家8 级K 上手=tripleSeq:7 → **straightFlush:9{5S 6S 7S 8S 9S}** [mustBomb]<br>手牌: AD QH QH QC QD 10H 10C 9S 8S 8D 7S 7C 6S 5S 5C 5D 2H
- `self|785|38` 座3 17张 敌最少27 对家22 级7 上手=fullhouse:Q → **bomb:9{9D 9D 9S 9C}** [noWasteJ,mustBomb]<br>手牌: BJ 7S 7D QD 10H 10D 10D 9S 9C 9D 9D 8S 6S 6H 6H 4S 4D

### 敌家都 ≥10 张时领出炸弹（非走完）

炸压炸占跟牌炸弹：1496/3644 (41%)

- `self|9|52` 座2 8张 敌最少19 对家21 级J 上手=pass → **bomb:6{6D 6C 6S 6D}** [holdBombLead,control,leadBombLate]<br>手牌: QS QS QD QD 6S 6C 6D 6D
- `self|264|96` 座3 7张 敌最少19 对家3 级6 上手=pass → **bomb:7{7C 7D 7S 7H}** [control,forceFinish:likely]<br>手牌: 8S 8S 8D 7S 7H 7C 7D
- `self|423|75` 座2 8张 敌最少12 对家9 级9 上手=pass → **bomb:7{7C 7H 7S 7D}** [holdBombLead,control,leadBombLate]<br>手牌: 10S 10S 10H 10D 7S 7H 7C 7D
- `self|600|75` 座2 8张 敌最少10 对家12 级4 上手=pass → **bomb:8{8C 8H 8C 8D}** [holdBombLead,control,leadBombLate]<br>手牌: QS QS QH QD 8H 8C 8C 8D
- `self|749|54` 座1 8张 敌最少13 对家14 级10 上手=pass → **bomb:7{7C 7S 7H 7D}** [holdBombLead,control,leadBombLate]<br>手牌: 8S 8H 8D 8D 7S 7H 7C 7D

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
- `self|679|42` 座3 21张 敌最少25 对家19 级5 上手=single:4 → **single:BJ{BJ}** [stopShort,followUp,followSize]<br>手牌: RJ BJ KH KC JS JC JD JD 10S 10D 9C 8S 8H 8C 8D 7S 7H 7C 7C 2H 2D

### 早盘领出 A/级牌/王的单对

- `self|108|74` 座3 20张 敌最少3 对家2 级6 上手=pass → **pair:6{6D 6C}** [control]<br>手牌: 6C 6D AH 10S 9S 9S 9H 9C 9D 9D 7C 5D 4C 4C 4D 4D 2S 2C 2D 2D
- `self|258|37` 座1 20张 敌最少15 对家11 级K 上手=pass → **single:A{AS}** [control]<br>手牌: RJ KC KD AS JC JD 9S 9C 7S 7H 7C 7D 6C 6D 5S 5H 2S 2H 2C 2C
- `self|315|12` 座3 25张 敌最少25 对家25 级5 上手=pass → **pair:5{5S 5C}** [control,planKeepControl]<br>手牌: 5S 5C AS AD QH QD JS JH JC JD 10H 10C 9H 9D 8S 8S 8C 8C 8D 7S 7C 3S 3D 2H 2C
- `self|615|17` 座3 24张 敌最少18 对家26 级6 上手=pass → **single:A{AS}** [control]<br>手牌: 6H 6S 6S 6C AS QC QD JC JD 8S 8H 8H 8C 8D 4C 4D 3C 3D 2S 2S 2H 2C 2C 2D
- `self|822|36` 座3 20张 敌最少14 对家10 级5 上手=pass → **single:RJ{RJ}** [control,planKeepControl]<br>手牌: RJ JS JC JC JD 10S 10D 9H 9C 8S 8H 8H 8C 8D 7H 7C 2S 2H 2C 2C

### 拆炸弹领出

- `self|9|44` 座2 12张 敌最少19 对家21 级J 上手=pass → **triple:J{JS JD JS}** [bombBreakNoGain,leadSmallSame,control,offPlan]<br>手牌: JS JS JC JD QS QS QD QD 6S 6C 6D 6D
- `self|173|6` 座1 22张 敌最少22 对家22 级6 上手=pass → **straight:10{6S 7D 8D 9C 10D}** [bombBreakNoGain,holdBombLead,control,planUnitFirst]<br>手牌: BJ BJ 6S AS AS AH AD QC JH JC 10D 9C 8S 8S 8C 8D 7D 4H 4D 3S 3C 3D
- `self|478|39` 座0 15张 敌最少12 对家13 级Q 上手=pass → **fullhouse:5{5H 5C 5S 7C 7D}** [fhAttach,control,offPlan]<br>手牌: 9S 9H 8S 8C 7S 7H 7C 7D 6S 6C 5S 5S 5H 5C 5D
- `self|631|71` 座3 10张 敌最少9 对家16 级9 上手=pass → **fullhouse:2{2C 2H 2S 3D 3D}** [control,offPlan]<br>手牌: 4S 4H 4H 4C 3D 3D 2S 2H 2C 2D
- `self|813|74` 座0 14张 敌最少8 对家6 级9 上手=pass → **fullhouse:3{3C 3C 3H 4H 4D}** [control,offPlan]<br>手牌: 9H 5S 5H 5D 5D 4S 4H 4C 4D 4D 3S 3H 3C 3C

### 早盘拆对领单（手里有顺子/连对/钢板可出）

- `self|500|90` 座3 24张 敌最少2 对家0 级8 上手=pass → **single:Q{QD}** [vsTwoSingle,control,offPlan]<br>手牌: 8S 8C AS AD KS KS KC KD QH QD JS JC JC JD 10S 10H 7S 7H 7C 7C 4S 4S 4H 4D
- `self|903|0` 座0 27张 敌最少27 对家27 级8 上手=pass → **single:10{10D}** [noFirstBomb,control]<br>手牌: 8H 8C 8D AS AH AD KS KH KD QS QC JH 10H 10D 9H 7C 7D 6H 6H 6C 6D 5D 4D 3D 3D 2S 2D

### 早盘领出单张占比

早盘领出牌型分布：straight 21%，single 19%，pairSeq 17%，fullhouse 16%，pair 12%，tripleSeq 10%，triple 4%；熵 2.68 bit


### decide 用时 >300ms 的比例

p50 1.8ms，p90 19.1ms，p99 53.8ms，max 1399.1ms

- `vsOld:pre-activity0|200123|97` 座0 13张 敌最少2 对家0 级3 上手=fullhouse:7 → **bomb:K{KS KC KS KC KD 3H 3H}** [noWasteJ,forceFinish:likely]<br>手牌: RJ 3H 3H KS KS KC KC KD JS JS JH JC JD
- `self|921|101` 座1 16张 敌最少6 对家0 级K 上手=fullhouse:2 → **bomb:9{9D 9C 9H 9D}** [noWasteJ,mustBomb]<br>手牌: RJ RJ KH KH 9H 9C 9D 9D 7H 7D 6H 6C 5H 5C 5D 5D
- `vsOld:pre-activity1|200125|97` 座3 13张 敌最少5 对家0 级5 上手=fullhouse:2 → **bomb:K{KC KS KD KS KD}** [noWasteJ,mustBomb,forceFinish:likely]<br>手牌: RJ 5H 5S 5C KS KS KC KD KD 8S 8H 8D 8D
- `self|143|84` 座3 16张 敌最少4 对家0 级2 上手=bomb:4 → **pass** []<br>手牌: 2H 2H 2D QS QH QC QC QD QD JS JH JC JD 10D 6S 6C
- `self|61|0` 座1 27张 敌最少27 对家27 级J 上手=pass → **fullhouse:2{2S 2H 2H 7S 7H}** [noFirstBomb,control]<br>手牌: JC JD AD KH KC 10S 10S 10H 10D 9H 9C 8H 8H 8D 7S 7H 6H 5S 4C 4C 4D 3H 3D 3D 2S 2H 2H

### 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）

全部通过

