# 自对局体检报告

生成：2026/10/19 15:52:44（Asia/Shanghai）　policy：current　用时 538s

对局：【进贡比赛模式，每场 8 副】自对局 1000 副（四家 decide），混合对手 Random、Greedy、Old:pre-activity、Old:pre-round6 各 200×2 副（换座位）；逐手记录 242627 条；surprise 局面 189 个。

局面 id 可复现：`node selfplay/audit.mjs --replay='<id>'`（cfg|seed|step）。

## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）

- **Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5**：9.0%（n=189，合理区间 ≤5%，严重度 5.5）
- **对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌**：65.6%（n=32，合理区间 ≤60%，严重度 0.3）

## 全部检测器

| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |
|---|---|---|---|---|---|
| 早中盘领出小单（≤10）后两个敌家都不跟 | 7.4% | 2568 | ≤25% | 6.8% | OK |
| 早中盘领出小对（≤10）后两个敌家都不跟 | 12.6% | 1016 | ≤35% | 12.8% | OK |
| 跟敌人牌过牌率（early，有牌可出时） | 51.8% | 18803 | ≥30 且 ≤62% | 50.8% | OK |
| 跟敌人牌过牌率（mid，有牌可出时） | 58.6% | 19980 | ≥30 且 ≤65% | 57.5% | OK |
| 跟敌人牌过牌率（late，有牌可出时） | 40.5% | 6258 | ≥20 且 ≤75% | 41.6% | OK |
| 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率 | 21.3% | 9375 | ≤35% | 21.7% | OK |
| 压对家的牌（early，有牌可压时） | 0.0% | 5961 | ≤15% | 0.1% | OK |
| 压对家的牌（mid，有牌可压时） | 0.2% | 7170 | ≤15% | 0.1% | OK |
| 压对家的牌（late，有牌可压时） | 12.5% | 2468 | ≤30% | 12.5% | OK |
| 炸对家（未因此走完） | 0.0% | 14595 | ≤2% | 0.0% | OK |
| 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌 | 65.6% | 32 | ≤60% | 70.0% | 🚩 |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 12.6% | 2160 | ≤15% | 11.8% | OK |
| 敌家都 ≥10 张时领出炸弹（非走完） | 4.3% | 5098 | ≤10% | 4.3% | OK |
| 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌 | 4.2% | 795 | ≤45% | 5.4% | OK |
| 输家结束时手里还留着炸弹（每个输家座位） | 6.8% | 2000 | ≤20% | 6.6% | OK |
| 输家结束时还握着 ≥2 张王/级牌 | 6.9% | 2000 | ≤25% | 7.3% | OK |
| 末游卡手（结束时 ≥8 张且至少还要 5 手） | 0.0% | 1000 | ≤25% | 0.0% | OK |
| 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10） | 1.2% | 5397 | ≤8% | 0.6% | OK |
| 早盘领出 A/级牌/王的单对 | 1.0% | 1154 | ≤12% | 0.4% | OK |
| 拆炸弹领出 | 0.7% | 15779 | ≤2% | 0.7% | OK |
| 早盘拆对领单（手里有顺子/连对/钢板可出） | 0.2% | 566 | ≤15% | 0.3% | OK |
| 早盘领出对子占比 | 12.3% | 3811 | ≥5% | 12.3% | OK |
| 早盘领出单张占比 | 18.0% | 3811 | ≥15 且 ≤55% | 19.4% | OK |
| 一手能出完却没出完 | 0.0% | 2654 | ≤1% | 0.0% | OK |
| decide 用时 >300ms 的比例 | 0.0% | 163089 | ≤0.5% | 0.0% | OK |
| 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测） | 0.000 | 2600 | ≤0 | 0.000 | OK |
| 对 Random 每副净升级 | 2.945 | 400 | ≥1.5 | 2.950 | OK |
| 对 Greedy 每副净升级 | 2.480 | 400 | ≥0.5 | 2.255 | OK |
| 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸） | 34.5% | 862 | ≤50% | - | OK |
| Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5 | 9.0% | 189 | ≤5% | 6.2% | 🚩 |

## 队伍结果

- 自对局 1000 副：南北队每副净升级 -0.063 [-0.196, 0.070]（应≈0），双下率 33.6%，平均每副 91 手
- 各座位平均名次（南/东/北/西）：2.53 / 2.50 / 2.52 / 2.45
- decide vs Random：400 副，胜 397/400 (99%)，每副净升级 2.945 [2.910, 2.980]
- decide vs Greedy：400 副，胜 375/400 (94%)，每副净升级 2.480 [2.346, 2.614]
- decide vs Old:pre-activity：400 副，胜 310/400 (78%)，每副净升级 1.310 [1.147, 1.473]
- decide vs Old:pre-round6：400 副，胜 309/400 (77%)，每副净升级 1.425 [1.235, 1.615]

## 进贡

- 进贡比赛 325 场共 2600 副；需进贡的副 2026：单贡 1034（抗贡 64/1034 (6%)，理论≈6%），双下双贡 992（抗贡 266/992 (27%)，理论≈25%；贡牌同点 64）
- 贡牌分布：RJ 36%，BJ 29%，A 10%，K 4%，5 4%，8 3%，J 3%，9 2%，Q 2%，6 2%，4 1%，10 1%，7 1%，3 1%
- 自对局还贡点数分布（decide）：2 21%，3 18%，4 14%，5 11%，6 10%，7 8%，10 7%，9 6%，8 6%
- 自对局进贡副（未抗贡）进贡方每副净升级 -0.079 [-0.237, 0.080]（n=713；负 = 输家进贡后仍吃亏）
- 自对局抗贡副 抗贡方每副净升级 -0.284 [-0.705, 0.136]（n=102）
- 进贡不变量（贡牌=最大非逢人配、双下大贡归头游/同点头游下家、抗贡判定、还贡≤10、先出者、交换后各 27 张、牌守恒）：全部通过（检查 2600 副）

## 详情与示例局面

### 🚩 Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5

分类：lead/early/otherPlay 4，lead/mid/otherPlay 2，enemy/mid/passed 2，lead/late/otherPlay 2，enemy/early/shouldPass 1，enemy/late/passed 1，enemy/late/shouldPass 1，enemy/early/passed 1，partner/late/shouldPass 1，enemy/mid/otherPlay 1，enemy/late/otherPlay 1

- `self|1026|7` enemy 27张 张数22/17/27/22 级5 上手=straight:6<br>decide: **straight:Q{8D 9D 10D JH QS}** (0.08) [] vs **pass** (+1.64, t=3.9, n=36)<br>手牌: 9D 2C 6H 8D 9C QS 5C KD BJ 9H 6C 4D 10D AC 8D RJ 6C JH 5S 3H AC 6S 3S QS JD 2D 8C
- `self|87|4` lead 22张 张数27/22/27/27 级K 上手=pass<br>decide: **tripleSeq:4{3H 3C 3C 4S 4H 4D}** (-0.50) [leadSmallSame,keepShape,control,offPlan] vs **fullhouse:3{3H 3C 3C 6D 6H}** (+1.44, t=3.3, n=36)<br>手牌: 4S 4H 6D 7H KS KC AS 3H KH 3C 2H QC 6H 3C 7C 10C AC 2D 7C 4D AS QS
- `self|113|33` lead 13张 张数25/21/13/24 级10 上手=pass<br>decide: **fullhouse:A{AD AC AS 3S 3C}** (-0.86) [leadSmallSame,control] vs **fullhouse:A{AD AC AS 5H 5C}** (+1.44, t=3.3, n=36)<br>手牌: 5H 5C 4H 4S 4S 3S AD 6S AC AS 4C 6C 3C
- `self|1062|13` lead 21张 张数23/25/23/21 级6 上手=pass<br>decide: **tripleSeq:K{QH QH QC KS KD KC}** (-0.06) [keepShape,control,offPlan] vs **fullhouse:4{4S 4H 4H 3H 3S}** (+1.33, t=2.7, n=36)<br>手牌: 3H 6C 3S JC KS KD 9H KC 4S 8C QH QH 4H 6S RJ 4H QC 8C 2H BJ 9D
- `self|1537|6` lead 21张 张数27/21/21/21 级8 上手=pass<br>decide: **pairSeq:9{7H 7C 8S 8D 9D 9C}** (0.08) [leadSmallSame,holdBombLead,control,planUnitFirst] vs **triple:3{3H 3H 3D}** (+1.28, t=3.1, n=36)<br>手牌: 9D 5H 7H 9C BJ 8S 3H 6S 10D JD 3H 6C 6D 8D 7C AC 6C 5S 5D 3D RJ
- `self|225|63` enemy 15张 张数10/11/15/10 级5 上手=single:9<br>decide: **pass** (0.50) [noSFon8] vs **single:BJ{BJ}** (+1.22, t=4.0, n=36)<br>手牌: RJ QS BJ QC 5H RJ JD 8S JS JS QC 9S QS BJ 8H
- `self|672|84` enemy 9张 张数5/16/8/9 级5 上手=single:A<br>decide: **pass** (0.78) [] vs **bomb:4{4H 4S 4D 4C 4H}** (+1.11, t=2.7, n=36)<br>手牌: 4H 4S QS 2S 2D QC 4D 4C 4H
- `self|1735|59` lead 13张 张数13/10/10/11 级A 上手=pass<br>decide: **single:J{JC}** (1.19) [control,offPlan] vs **bomb:J{JC JH JS JH JS}** (+1.08, t=3.5, n=36)<br>手牌: JC JH JS 4D 4C 4D JH 2D 2D 2C 4H JS 2H

### 🚩 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌

旧口径（含拆炸/只有炸弹可压）：24/35 (69%)；其中不拆三张也能压：16/27 (59%)；只能拆三张才能压：5/5 (100%)

- `self|85|72` 座2 15张 敌最少3 对家8 级Q 上手=pair:3 → **pass** [可压:pair:Q{QC QC} / pair:Q{QC QH} / pair:Q{QH QC}]<br>手牌: QH QC QC JS JS JC JD 7S 7H 7H 7C 2S 2H 2C 2D
- `self|257|79` 座3 11张 敌最少2 对家6 级8 上手=single:Q → **pass** [可压:single:RJ{RJ} / single:RJ{RJ}]<br>手牌: RJ RJ JS JH 9C 9D 6S 6H 6H 6C 6D
- `self|610|50` 座2 11张 敌最少3 对家7 级3 上手=pair:6 → **pass** [mustBomb,可压:pair:A{AS AH}]<br>手牌: AS AH KD 10H 10C 10C 10D 8C 7S 6H 5S
- `self|662|94` 座3 6张 敌最少1 对家4 级8 上手=pair:6 → **pass** [可压:pair:8{8D 8S} / pair:8{8D 8C} / pair:8{8S 8C}]<br>手牌: 8S 8C 8D 5H 5D 4D
- `self|1300|80` 座0 5张 敌最少3 对家4 级6 上手=single:4 → **pass** [可压:single:6{6D} / single:10{10H} / single:8{8S}]<br>手牌: 6H 6S 6D 10H 8S

### 早中盘领出小单（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：187/189 (99%)

- `self|16|62` 座0 11张 敌最少9 对家0 级3 上手=single:9 → **pass** [noSFon8]<br>手牌: RJ BJ 10S 10H 10H 10D 8H 8D 7S 7H 7C
- `self|515|59` 座0 22张 敌最少14 对家8 级10 上手=single:K → **pass** []<br>手牌: RJ BJ 10S 10D AS AS KS KH KH KC QS QD JS JH JC JD 6S 6H 5S 4C 4D 2D
- `self|835|75` 座3 15张 敌最少12 对家16 级3 上手=single:10 → **pass** []<br>手牌: 3H 3H 3S QS QH QC QD 8H 8C 8D 8D 5H 5C 5D 5D
- `self|1335|75` 座3 9张 敌最少10 对家0 级A 上手=single:6 → **pass** []<br>手牌: AD JS JH JH JD 10S 10H 10C 10D
- `self|1696|60` 座1 20张 敌最少8 对家10 级4 上手=single:5 → **pass** []<br>手牌: RJ 4H 4D 8S 8H 8H 8D 7H 7C 6C 6D 5S 5C 5C 5D 2S 2H 2C 2D 2D

### 早中盘领出小对（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：123/128 (96%)

- `self|23|38` 座3 19张 敌最少13 对家20 级7 上手=pair:8 → **pass** []<br>手牌: BJ 7H 7H 7S AS KH 9S 9H 9D 8H 8D 8D 6S 6C 4H 4D 2S 2H 2C
- `self|439|59` 座1 10张 敌最少14 对家0 级6 上手=pair:9 → **pass** []<br>手牌: AS KS KS KH KD JS JH JC JD 9C
- `self|673|53` 座3 14张 敌最少11 对家10 级6 上手=pair:10 → **pass** []<br>手牌: QH QH QC QD JC JD 10S 10C 10D 9D 8S 8H 7H 7D
- `self|1060|60` 座1 11张 敌最少10 对家13 级Q 上手=pair:9 → **pass** [passiveEarly]<br>手牌: QH QH AC AD 8S 8H 8C 8D 2S 2C 2D
- `self|1540|64` 座0 11张 敌最少10 对家17 级8 上手=pair:10 → **pass** []<br>手牌: 8H 8S 6S 6C 6D 2S 2S 2C 2C 2D 2D

### 跟敌人牌过牌率（early，有牌可出时）

- `self|16|9` 座1 26张 敌最少20 对家26 级3 上手=fullhouse:6 → **pass** []<br>手牌: AH KD QS QH QC QD QD JS JS JH JC 9H 9C 8S 8C 7S 7D 6S 6H 6C 6D 5S 5S 5H 5D 5D
- `self|389|13` 座2 27张 敌最少17 对家22 级4 上手=straight:7 → **pass** []<br>手牌: RJ RJ BJ 4H 4S AH KS KS QS QD 10S 10H 10C 9S 9H 9D 8H 8C 8D 7S 7H 7C 7D 5S 5C 2H 2C
- `self|786|26` 座3 20张 敌最少9 对家15 级2 上手=single:BJ → **pass** []<br>手牌: RJ 2S AS AS KH JS JH JD 10H 10C 9S 9S 9H 9D 9D 8H 7S 7H 7C 7D
- `self|1201|79` 座3 20张 敌最少6 对家0 级A 上手=single:10 → **pass** []<br>手牌: AH AS AC QS QH QH QD JS JS JD JD 9S 9S 8S 7C 5C 3S 3H 3H 3C
- `self|1591|72` 座3 23张 敌最少6 对家0 级K 上手=pair:8 → **pass** []<br>手牌: BJ KD KD JC JC JD 10S 10S 10C 9S 9H 9H 9D 8S 7S 7H 7C 7D 5S 5C 5D 4D 4D

### 跟敌人牌过牌率（mid，有牌可出时）

- `self|16|27` 座3 19张 敌最少14 对家26 级3 上手=pair:K → **pass** []<br>手牌: 3H 3H 3C 3D AS AH AC AD 9S 7H 4S 4S 4H 4C 4C 2S 2S 2C 2D
- `self|432|35` 座1 13张 敌最少14 对家19 级3 上手=fullhouse:Q → **pass** []<br>手牌: BJ BJ 3H 3C 3D AC KS KC KC KD KD 8H 8C
- `self|835|33` 座1 16张 敌最少14 对家25 级3 上手=single:K → **pass** []<br>手牌: 3C 3C 3D 3D QH QD JS JH JH JD 10H 10D 7S 7C 7C 7D
- `self|1219|30` 座0 15张 敌最少18 对家23 级3 上手=fullhouse:2 → **pass** []<br>手牌: RJ BJ 10C 8S 8S 7H 7H 7C 7D 7D 6S 6H 6H 6C 6D
- `self|1607|41` 座0 10张 敌最少9 对家14 级5 上手=single:10 → **pass** []<br>手牌: RJ 5D 10D 7S 7H 7D 3S 3H 3H 3C

### 跟敌人牌过牌率（late，有牌可出时）

- `self|16|74` 座0 9张 敌最少8 对家0 级3 上手=pair:9 → **pass** []<br>手牌: RJ 10S 10H 10H 10D 8D 7S 7H 7C
- `self|448|93` 座3 9张 敌最少7 对家10 级4 上手=single:A → **pass** []<br>手牌: 4H 10S 10H 10C 10D 9H 9C 9C 9D
- `self|818|62` 座3 9张 敌最少9 对家13 级3 上手=single:10 → **pass** []<br>手牌: RJ RJ 3H AS AH AC AC AD 8S
- `self|1239|36` 座2 6张 敌最少18 对家12 级7 上手=single:Q → **pass** []<br>手牌: 7H 10S 10H 10C 10D 9S
- `self|1651|54` 座3 8张 敌最少14 对家10 级4 上手=single:A → **pass** []<br>手牌: RJ 4D AS AH AC AD 7D 7D

### 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率

按座位 南/东/北/西：496/2301 (22%) / 497/2355 (21%) / 532/2368 (22%) / 474/2351 (20%)

- `self|16|62` 座0 11张 敌最少9 对家0 级3 上手=single:9 → **pass** [noSFon8]<br>手牌: RJ BJ 10S 10H 10H 10D 8H 8D 7S 7H 7C
- `self|369|77` 座2 14张 敌最少10 对家10 级A 上手=pair:4 → **pass** []<br>手牌: BJ AC QH QC QC QD JH JH JC JD 9S 9C 9D 9D
- `self|802|34` 座3 11张 敌最少16 对家19 级2 上手=single:10 → **pass** []<br>手牌: BJ 2D QC QC QD 10S 10S 5H 5C 3H 3C
- `self|1200|39` 座3 18张 敌最少13 对家11 级Q 上手=pair:9 → **pass** []<br>手牌: RJ QH QH QC AC KH JS 10C 7C 6H 6C 6D 3S 3S 3H 3H 2C 2D
- `self|1587|39` 座0 17张 敌最少17 对家12 级J 上手=single:10 → **pass** []<br>手牌: BJ AS AC AC AD KS KH KH 10H 5S 5H 5C 5D 2S 2H 2D 2D

### 压对家的牌（early，有牌可压时）

- `self|787|65` 座3 23张 敌最少2 对家2 级3 上手=single:A → **single:3{3D}** [followUp]<br>手牌: 3S 3D AS AH AC AD KS KS KC KD QD QD 10H 10D 8H 7D 7D 6S 6D 4S 4H 2S 2D

### 压对家的牌（mid，有牌可压时）

- `self|102|72` 座0 15张 敌最少2 对家18 级4 上手=pair:A → **pair:RJ{RJ RJ}** [blockSure]<br>手牌: RJ RJ 4S 4D AS AC 10D 10D 7S 7C 7D 7D 6H 6C 6D
- `self|243|33` 座1 10张 敌最少5 对家10 级J 上手=fullhouse:6 → **fullhouse:8{8D 8H 8S 9S 9C}** []<br>手牌: 9S 9C 8S 8H 8D 7S 7H 7H 7C 7D
- `self|483|63` 座1 10张 敌最少17 对家9 级10 上手=fullhouse:2 → **fullhouse:4{4C 4H 4D 3H 3S}** []<br>手牌: 10H AS AC AD JS 4H 4C 4D 3S 3H
- `self|725|74` 座3 10张 敌最少2 对家7 级4 上手=fullhouse:9 → **fullhouse:Q{QC QH QD 3D 3C}** [forceFinish:sure]<br>手牌: 4C 4D QH QC QD 7S 7H 7C 3C 3D
- `self|1271|69` 座1 19张 敌最少1 对家5 级K 上手=single:7 → **single:RJ{RJ}** [followUp,blockLikely]<br>手牌: RJ KH KD AS AH AC AC 10S 8S 8C 7H 7C 7C 7D 5C 5C 4S 4H 4D

### 压对家的牌（late，有牌可压时）

- `self|20|59` 座2 5张 敌最少10 对家18 级K 上手=single:J → **single:Q{QS}** [followUp,strongBeforeLast,forceFinish:bombBack]<br>手牌: QS 8S 8S 8H 8C
- `self|357|64` 座3 5张 敌最少15 对家9 级A 上手=single:7 → **single:9{9D}** [followUp,strongBeforeLast,forceFinish:bombBack]<br>手牌: 9D 3S 3H 3H 3C
- `self|834|69` 座3 1张 敌最少3 对家0 级5 上手=single:4 → **single:K{KC}**<br>手牌: KC
- `self|1218|91` 座1 2张 敌最少13 对家7 级2 上手=pair:10 → **pair:A{AD AC}**<br>手牌: AC AD
- `self|1557|96` 座2 2张 敌最少1 对家4 级A 上手=pair:8 → **pair:9{9H 9C}**<br>手牌: 9H 9C

### 敌家都 ≥15 张时炸普通牌（占跟牌炸弹）

每副炸弹数（自对局，四人合计）：早 0.36 / 中 1.91 / 晚 2.83

- `self|17|60` 座1 13张 敌最少22 对家12 级4 上手=pair:K → **bomb:J{JD JS JD JH}** [mustBomb]<br>手牌: AS AS AC AD KD KD JS JH JD JD 10C 2S 2D
- `self|433|65` 座0 5张 敌最少19 对家7 级6 上手=single:A → **bomb:5{5D 5H 5C 5H}** [mustBomb,forceFinish:likely]<br>手牌: 10S 5H 5H 5C 5D
- `self|816|67` 座0 13张 敌最少16 对家5 级A 上手=single:Q → **bomb:6{6C 6D 6S 6H}** [mustBomb]<br>手牌: AH AH AS AD KS KC QD 7H 6S 6H 6C 6D 5D
- `self|1206|60` 座2 16张 敌最少16 对家0 级4 上手=fullhouse:4 → **bomb:7{7H 7C 7D 7D 7C 7S 4H}** [noWasteJ,mustBomb]<br>手牌: 4H 4C AH QC QD JS JC 7S 7H 7C 7C 7D 7D 6S 6D 5C
- `self|1618|41` 座3 16张 敌最少17 对家17 级A 上手=triple:J → **bomb:6{6D 6S 6C 6C}** [mustBomb]<br>手牌: RJ AS AD QD 7S 7D 7D 6S 6C 6C 6D 5S 5H 4H 4D 4D

### 敌家都 ≥10 张时领出炸弹（非走完）

炸压炸占跟牌炸弹：1593/3753 (42%)

- `self|23|57` 座2 9张 敌最少18 对家22 级7 上手=pass → **bomb:10{10H 10C 10H 10D}** [holdBombLead,control,leadBombLate]<br>手牌: JS JS JC JD JD 10H 10H 10C 10D
- `self|582|71` 座2 8张 敌最少15 对家7 级5 上手=pass → **bomb:10{10S 10D 10C 10H}** [control]<br>手牌: JH JC 10S 10H 10C 10D 9S 9C
- `self|946|50` 座2 12张 敌最少16 对家10 级K 上手=pass → **bomb:5{5S 5H 5H 5S}** [holdBombLead,control,leadBombLate]<br>手牌: 10S 10C 10C 10D 7C 7C 7D 7D 5S 5S 5H 5H
- `self|1266|65` 座1 7张 敌最少19 对家12 级8 上手=pass → **bomb:2{2C 2S 2C 2H}** [control,forceFinish:likely]<br>手牌: AH AC AD 2S 2H 2C 2C
- `self|1714|29` 座1 8张 敌最少15 对家26 级6 上手=pass → **bomb:4{4S 4H 4D 4D}** [holdBombLead,control,leadBombLate]<br>手牌: QS QS QH QC 4S 4H 4D 4D

### 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌

- `self|227|93` 座0 6张 敌最少3 对家0 级8 上手=triple:5 → **pass** []<br>手牌: 8S JC 3S 3H 3C 3D
- `self|304|75` 座1 7张 敌最少2 对家1 级8 上手=pair:10 → **pass** []<br>手牌: RJ BJ 6S 6S 6H 6C 3H
- `self|659|44` 座2 6张 敌最少3 对家3 级6 上手=fullhouse:5 → **pass** []<br>手牌: KC 9D 8S 8S 8C 8D
- `self|1286|58` 座1 16张 敌最少2 对家12 级A 上手=pair:10 → **pass** []<br>手牌: RJ AH 9H 9D 8S 8H 8D 4S 4H 4C 4D 3S 3H 3H 3C 3D
- `self|1536|82` 座1 11张 敌最少2 对家0 级7 上手=fullhouse:9 → **pass** []<br>手牌: 7C 10H 9S 3S 3S 3H 3C 3D 2S 2H 2D

### 输家结束时手里还留着炸弹（每个输家座位）

- `self|33` 座0 结束时手里：6H 6C 5D 6H 6C
- `self|84` 座2 结束时手里：5C 8S BJ 5S 5H 8S 5C
- `self|97` 座1 结束时手里：AD AH QD AC KH KC AS RJ RJ QS
- `self|97` 座3 结束时手里：QH 3D QS 8C 3H 8H 3S QC QC 9D QH 9S
- `self|102` 座0 结束时手里：7D 7C 7S 7D

### 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10）

- `self|64|35` 座2 21张 敌最少3 对家17 级6 上手=single:4 → **single:6{6S}** [followUp,followSize]<br>手牌: 6S AS AH AH AC QH QC JS JS JH 10S 10H 9S 9H 8H 8H 8D 5S 5H 3C 3D
- `self|535|61` 座3 20张 敌最少20 对家4 级A 上手=single:9 → **single:BJ{BJ}** [noSFon8,stopShort,followUp,followSize]<br>手牌: BJ AH AS QC JH JH JC JC 10C 10C 9C 9C 9D 9D 8H 8C 7H 7D 5S 5C
- `self|979|43` 座1 21张 敌最少10 对家22 级K 上手=pass → **single:BJ{BJ}** [control,planKeepControl]<br>手牌: RJ BJ QS QS QH QC 9S 9D 8H 8H 8C 8D 7S 7H 6S 6H 2S 2S 2H 2C 2D
- `self|1328|30` 座3 27张 敌最少25 对家4 级7 上手=pair:10 → **pair:7{7C 7D}** [stopShort,followSize]<br>手牌: RJ BJ 7H 7C 7D AS AC AC AD KH KC 10H 10D 9C 8S 8H 8D 6S 6S 6H 6C 5S 5H 5C 3S 3S 2S
- `self|1570|68` 座1 21张 敌最少17 对家3 级K 上手=single:2 → **single:RJ{RJ}** [stopShort,followUp,followSize]<br>手牌: RJ KH KC 10C 10D 9S 9D 8C 7C 6S 6H 6C 6D 5S 5H 3S 3S 3D 2H 2C 2D

### 早盘领出 A/级牌/王的单对

- `self|49|9` 座3 25张 敌最少25 对家26 级8 上手=pass → **single:A{AD}** [control]<br>手牌: BJ BJ 8H 8C 8D 8D AD KS KH QS QC 10H 10H 10D 5S 5H 5D 4D 4D 3S 3C 2H 2C 2C 2D
- `self|979|47` 座1 20张 敌最少10 对家22 级K 上手=pass → **single:RJ{RJ}** [control,planKeepControl]<br>手牌: RJ QS QS QH QC 9S 9D 8H 8H 8C 8D 7S 7H 6S 6H 2S 2S 2H 2C 2D
- `self|1204|47` 座0 21张 敌最少8 对家19 级2 上手=pass → **single:A{AS}** [control]<br>手牌: RJ 2S AS QD 10S 10S 10C 10C 8S 8D 7C 7C 6C 6D 6D 5S 5C 3S 3H 3C 3D
- `self|1317|11` 座2 22张 敌最少22 对家17 级9 上手=pass → **single:A{AD}** [control]<br>手牌: BJ AD KS JC 10H 8S 8H 7S 7H 7H 7D 7D 6S 5S 4H 4C 4D 4D 3D 3D 2S 2D
- `self|1794|58` 座3 20张 敌最少21 对家16 级J 上手=pass → **pair:J{JD JC}** [shortEnemyShape,control]<br>手牌: JC JD AS AH AD AD QD 8H 8D 7S 7D 5S 5C 4S 4H 3H 3H 3C 3D 2D

### 拆炸弹领出

- `self|67|41` 座2 10张 敌最少15 对家21 级10 上手=pass → **fullhouse:4{4D 4S 4S 5C 5D}** [control,offPlan]<br>手牌: 10H 5S 5S 5H 5C 5D 4S 4S 4C 4D
- `self|390|56` 座2 8张 敌最少20 对家14 级6 上手=pass → **triple:6{6C 6D 6C}** [bombBreakNoGain,leadSmallSame,control,offPlan]<br>手牌: 6S 6C 6C 6D 5S 5H 5D 5D
- `self|739|47` 座1 14张 敌最少7 对家16 级K 上手=pass → **single:8{8C}** [bombBreakNoGain,control,offPlan]<br>手牌: KH KS KS KC KD AS AH AC AD AD 8S 8H 8C 8D
- `self|1222|51` 座0 12张 敌最少13 对家16 级7 上手=pass → **fullhouse:3{3S 3H 3S 6D 6C}** [fhAttach,control,offPlan]<br>手牌: 6S 6H 6C 6D 5C 5D 4S 4D 3S 3S 3H 3H
- `self|1601|36` 座3 12张 敌最少20 对家14 级A 上手=pass → **triple:A{AD AD AC}** [bombBreakNoGain,leadSmallSame,control,offPlan]<br>手牌: AC AC AD AD 8S 8S 8H 8C 2S 2H 2D 2D

### 早盘拆对领单（手里有顺子/连对/钢板可出）

- `self|1109|7` 座3 21张 敌最少21 对家27 级2 上手=pass → **single:5{5C}** [control]<br>手牌: 2H 2S 2S 2C AS AD KH KD QS QS QD JS JS 9D 7C 6C 5S 5C 4C 4D 3C

### 早盘领出单张占比

早盘领出牌型分布：straight 21%，fullhouse 19%，single 18%，pairSeq 16%，pair 12%，tripleSeq 10%，triple 5%，bomb 0%；熵 2.70 bit


### decide 用时 >300ms 的比例

p50 1.9ms，p90 20.5ms，p99 54.9ms，max 424.8ms

- `self|485|89` 座0 14张 敌最少1 对家12 级A 上手=fullhouse:3 → **bomb:J{JC JS JH JD AH AH}** [noWasteJ,mustBomb,forceFinish:likely,blockNatBomb]<br>手牌: RJ RJ AH AH JS JH JC JD 10S 10H 9S 9S 9C 9C
- `self|790|72` 座1 15张 敌最少1 对家8 级5 上手=fullhouse:6 → **bomb:A{AH AD AH AS}** [noWasteJ,mustBomb,forceFinish:likely]<br>手牌: 5H 5H 5D AS AH AH AD 4H 4C 4D 3S 3H 3C 3D 2D
- `self|1991|67` 座2 16张 敌最少2 对家0 级A 上手=fullhouse:3 → **fullhouse:Q{QS QH QD 6S 6D}** [stopShort]<br>手牌: AH AC AD KH KC QS QH QH QC QD QD JS JC 10C 6S 6D
- `self|544|76` 座2 13张 敌最少1 对家0 级10 上手=fullhouse:4 → **bomb:K{KH KS KD KC}** [noWasteJ,mustBomb,forceFinish:likely]<br>手牌: 10H 10C 10C 10D KS KH KC KD JD 6H 6C 6C 6D
- `self|727|76` 座2 14张 敌最少2 对家0 级7 上手=fullhouse:9 → **fullhouse:J{JH JS JD 5S 5H}** [stopShort]<br>手牌: RJ 7H 7H 7S 7C JS JH JH JD JD 5S 5H 5H 5D

### 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）

全部通过


### 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸）

不分有无孤张：还的点数手里原有 ≥2 张 336/901 (37%)（有的是顺子里多出的一张，拆牌计划认为更便宜）；还 >10 的牌（手里没有 ≤10，兜底）：0/901 (0%)

