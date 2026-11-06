# 自对局体检报告

生成：2026/10/20 06:43:57（Asia/Shanghai）　policy：current　用时 629s

对局：【进贡比赛模式，每场 8 副】自对局 1000 副（四家 decide），混合对手 Random、Greedy、Old:pre-activity、Old:pre-round6 各 200×2 副（换座位）；逐手记录 241812 条；surprise 局面 193 个。

局面 id 可复现：`node selfplay/audit.mjs --replay='<id>'`（cfg|seed|step）。

## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）

- **Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5**：8.8%（n=193，合理区间 ≤5%，严重度 5.3）
- **敌家都 ≥15 张时炸普通牌（占跟牌炸弹）**：15.7%（n=2019，合理区间 ≤15%，严重度 0.3）
- **对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌**：62.1%（n=29，合理区间 ≤60%，严重度 0.1）

## 全部检测器

| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |
|---|---|---|---|---|---|
| 早中盘领出小单（≤10）后两个敌家都不跟 | 6.6% | 2721 | ≤25% | 7.9% | OK |
| 早中盘领出小对（≤10）后两个敌家都不跟 | 11.9% | 1037 | ≤35% | 12.5% | OK |
| 跟敌人牌过牌率（early，有牌可出时） | 52.0% | 19109 | ≥30 且 ≤62% | 52.2% | OK |
| 跟敌人牌过牌率（mid，有牌可出时） | 56.5% | 20423 | ≥30 且 ≤65% | 57.2% | OK |
| 跟敌人牌过牌率（late，有牌可出时） | 38.1% | 6209 | ≥20 且 ≤75% | 40.2% | OK |
| 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率 | 20.5% | 9793 | ≤35% | 20.8% | OK |
| 压对家的牌（early，有牌可压时） | 0.0% | 6170 | ≤15% | 0.0% | OK |
| 压对家的牌（mid，有牌可压时） | 0.2% | 7605 | ≤15% | 0.3% | OK |
| 压对家的牌（late，有牌可压时） | 12.1% | 2218 | ≤30% | 12.6% | OK |
| 炸对家（未因此走完） | 0.0% | 14870 | ≤2% | 0.0% | OK |
| 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌 | 62.1% | 29 | ≤60% | 65.7% | 🚩 |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 15.7% | 2019 | ≤15% | 14.2% | 🚩 |
| 敌家都 ≥10 张时领出炸弹（非走完） | 6.9% | 5449 | ≤10% | 4.5% | OK |
| 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌 | 3.2% | 624 | ≤45% | 2.8% | OK |
| 输家结束时手里还留着炸弹（每个输家座位） | 6.8% | 2000 | ≤20% | 7.3% | OK |
| 输家结束时还握着 ≥2 张王/级牌 | 7.3% | 2000 | ≤25% | 8.1% | OK |
| 末游卡手（结束时 ≥8 张且至少还要 5 手） | 0.0% | 1000 | ≤25% | 0.0% | OK |
| 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10） | 1.5% | 5503 | ≤8% | 1.6% | OK |
| 早盘领出 A/级牌/王的单对 | 0.5% | 1187 | ≤12% | 1.0% | OK |
| 拆炸弹领出 | 0.3% | 15361 | ≤2% | 0.6% | OK |
| 早盘拆对领单（手里有顺子/连对/钢板可出） | 0.7% | 584 | ≤15% | 0.3% | OK |
| 早盘领出对子占比 | 12.1% | 3844 | ≥5% | 11.9% | OK |
| 早盘领出单张占比 | 18.7% | 3844 | ≥15 且 ≤55% | 18.8% | OK |
| 一手能出完却没出完 | 0.0% | 2711 | ≤1% | 0.0% | OK |
| decide 用时 >300ms 的比例 | 0.0% | 162246 | ≤0.5% | 0.0% | OK |
| 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测） | 0.000 | 2600 | ≤0 | 0.000 | OK |
| 对 Random 每副净升级 | 2.908 | 400 | ≥1.5 | 2.940 | OK |
| 对 Greedy 每副净升级 | 2.422 | 400 | ≥0.5 | 2.408 | OK |
| 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸） | 35.5% | 843 | ≤50% | 34.3% | OK |
| Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5 | 8.8% | 193 | ≤5% | 3.6% | 🚩 |

## 队伍结果

- 自对局 1000 副：南北队每副净升级 -0.102 [-0.229, 0.025]（应≈0），双下率 27.3%，平均每副 90 手
- 各座位平均名次（南/东/北/西）：2.53 / 2.49 / 2.53 / 2.46
- decide vs Random：400 副，胜 394/400 (99%)，每副净升级 2.908 [2.866, 2.949]
- decide vs Greedy：400 副，胜 372/400 (93%)，每副净升级 2.422 [2.270, 2.575]
- decide vs Old:pre-activity：400 副，胜 319/400 (80%)，每副净升级 1.380 [1.148, 1.612]
- decide vs Old:pre-round6：400 副，胜 304/400 (76%)，每副净升级 1.363 [1.167, 1.558]

## 进贡

- 进贡比赛 325 场共 2600 副；需进贡的副 2018：单贡 1101（抗贡 70/1101 (6%)，理论≈6%），双下双贡 917（抗贡 241/917 (26%)，理论≈25%；贡牌同点 54）
- 贡牌分布：RJ 36%，BJ 28%，A 12%，K 4%，8 3%，5 3%，J 3%，9 2%，Q 2%，6 1%，3 1%，7 1%，10 1%，4 1%
- 自对局还贡点数分布（decide）：2 21%，3 17%，4 12%，5 12%，6 11%，7 8%，9 6%，10 6%，8 5%
- 自对局进贡副（未抗贡）进贡方每副净升级 -0.014 [-0.165, 0.137]（n=725；负 = 输家进贡后仍吃亏）
- 自对局抗贡副 抗贡方每副净升级 -0.271 [-0.726, 0.184]（n=85）
- 进贡不变量（贡牌=最大非逢人配、双下大贡归头游/同点头游下家、抗贡判定、还贡≤10、先出者、交换后各 27 张、牌守恒）：全部通过（检查 2600 副）

## 详情与示例局面

### 🚩 Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5

分类：lead/mid/otherPlay 3，enemy/early/passed 3，lead/early/otherPlay 2，enemy/late/passed 2，partner/late/otherPlay 1，partner/late/shouldPass 1，enemy/mid/passed 1，partner/late/passed 1，partner/mid/shouldPass 1，partner/mid/passed 1，enemy/early/otherPlay 1

- `self|1829|77` partner 4张 张数1/4/17/2 级2 上手=pair:10<br>decide: **pair:A{AS AC}** (-0.78) [forceFinish:likely,blockLikely] vs **pair:Q{QH QC}** (+2.28, t=6.1, n=36)<br>手牌: AS QH AC QC
- `self|1189|30` lead 20张 张数21/17/18/20 级A 上手=pass<br>decide: **pairSeq:A{QS QC KH KS AD AD}** (0.06) [leadSmallSame,holdBombLead,control,planUnitFirst] vs **single:4{4C}** (+1.86, t=5.7, n=36)<br>手牌: QS 10D 10S 3D KH JS 10S KS 10H BJ 3C AD 10D 4C QC 10C JC AD 3H AS
- `self|113|42` lead 18张 张数25/21/2/18 级10 上手=pass<br>decide: **tripleSeq:A{KC KH KC AH AH AC}** (-0.08) [shortEnemyShape,vsTwoNoPair,unfollowableVsTwo,control] vs **fullhouse:A{AH AH AC 4C 4D}** (+1.53, t=4.1, n=36)<br>手牌: RJ AH 4C 4D 7H AH KC KH 2D 2H AC 8C 10H 2D KC 2H QH RJ
- `self|1456|83` partner 3张 张数6/1/3/18 级2 上手=pair:8<br>decide: **pair:2{2S 2H}** (-1.33) [] vs **pass** (+1.44, t=3.8, n=36)<br>手牌: 2H 6C 2S
- `self|2003|7` lead 22张 张数22/22/22/22 级J 上手=pass<br>decide: **fullhouse:3{3H 3C 3C 6H 6D}** (-0.31) [fhAttach,control,planWeakFirst] vs **fullhouse:3{3H 3C 3C 9C 9H}** (+1.25, t=3.2, n=36)<br>手牌: 6H 8H 9C 6D 8C 5D 9H 5C KC AD 8S 3H 10D 3C AS 7H KH 8H 10D AS 3C RJ
- `self|465|59` enemy 11张 张数6/9/14/11 级6 上手=single:A<br>decide: **pass** (-0.31) [] vs **single:6{6D}** (+1.25, t=3.2, n=36)<br>手牌: 7S 7D 10C 7H QH 10S QC QH 10C 10H 6D
- `self|1878|50` partner 7张 张数8/7/14/17 级10 上手=pair:K<br>decide: **pass** (1.33) [] vs **pair:BJ{BJ BJ}** (+1.17, t=3.1, n=36)<br>手牌: 7C AD 7D BJ 7D BJ AD
- `self|1541|22` enemy 20张 张数20/16/20/14 级8 上手=tripleSeq:3<br>decide: **pass** (0.61) [] vs **tripleSeq:5{4C 4S 5S 5D 5C 8H}** (+1.08, t=3.0, n=36)<br>手牌: 5S 5D AH KH 8H 4C QS QS AC 10C 8D JH 5C KC 2C KD KD 4S AD JD

### 🚩 敌家都 ≥15 张时炸普通牌（占跟牌炸弹）

每副炸弹数（自对局，四人合计）：早 0.36 / 中 2.35 / 晚 2.74

- `self|17|60` 座1 13张 敌最少23 对家13 级4 上手=single:K → **bomb:J{JD JS JD JH}** [mustBomb]<br>手牌: AS AS AC AD KD KD JS JH JD JD 10C 2S 2D
- `self|545|46` 座2 17张 敌最少24 对家14 级K 上手=pair:5 → **bomb:3{3S 3C 3C 3D}** [mustBomb]<br>手牌: BJ KH KS KC KD AH QH QH QC QD 7C 5H 5D 3S 3C 3C 3D
- `self|901|72` 座3 15张 敌最少16 对家0 级K 上手=fullhouse:4 → **bomb:J{JS JC JD JS}** [noWasteJ,mustBomb]<br>手牌: KH KS KD AS AH AH AC AC JS JS JC JD 9H 9C 5C
- `self|1204|67` 座1 6张 敌最少24 对家8 级7 上手=single:J → **bomb:5{5S 5H 5C 7H}** [mustBomb,forceFinish:likely]<br>手牌: BJ BJ 7H 5S 5H 5C
- `self|1589|70` 座1 10张 敌最少17 对家16 级A 上手=fullhouse:2 → **bomb:J{JD JD JS JH}** [noWasteJ,mustBomb]<br>手牌: KD JS JH JD JD 4D 2H 2C 2D 2D

### 🚩 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌

旧口径（含拆炸/只有炸弹可压）：21/32 (66%)；其中不拆三张也能压：16/27 (59%)；只能拆三张才能压：2/2 (100%)

- `self|36|50` 座3 16张 敌最少3 对家16 级8 上手=single:A → **pass** [可压:single:8{8D} / single:RJ{RJ} / single:8{8H}]<br>手牌: RJ 8H 8D KC JS JH JC JD 9S 9H 9C 9D 7S 7H 7H 7D
- `self|257|59` 座3 13张 敌最少3 对家14 级8 上手=single:8 → **pass** [noSFon8,可压:single:RJ{RJ} / single:RJ{RJ}]<br>手牌: RJ RJ 8H JS JH 9C 9D 7S 6S 6H 6H 6C 6D
- `self|566|49` 座0 18张 敌最少3 对家13 级A 上手=pair:5 → **pass** [可压:pair:7{7H 7S} / pair:7{7H AH} / pair:8{8S 8D}]<br>手牌: AH AS KD 10S 10D 9H 8S 8H 8D 7S 7S 7H 7H 7C 7D 4H 2S 2H
- `self|994|73` 座3 20张 敌最少3 对家11 级A 上手=single:7 → **pass** [mustBomb,可压:single:A{AD} / single:Q{QD} / single:9{9D}]<br>手牌: AD QH QD QD JS JS JC JD 10S 10C 9D 6C 3H 3H 3C 3D 2S 2S 2C 2D
- `self|1157|46` 座0 11张 敌最少3 对家16 级Q 上手=single:8 → **pass** [noSFon8,可压:single:Q{QC} / single:Q{QH} / single:Q{QC}]<br>手牌: QH QH QS QC QC 4S 4D 2H 2C 2D 2D

### 早中盘领出小单（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：178/179 (99%)

- `self|22|37` 座2 18张 敌最少13 对家11 级A 上手=single:3 → **pass** []<br>手牌: BJ AC JS JS JH JH 8H 8C 8D 8D 4S 4H 4D 4D 3D 2C 2D 2D
- `self|544|40` 座2 20张 敌最少13 对家7 级10 上手=single:A → **pass** []<br>手牌: 10H 10C 10C 10D AS AH AD KS KH KC KD QS QH JD 8H 6H 6C 6C 6D 4D
- `self|944|30` 座0 17张 敌最少13 对家24 级9 上手=single:10 → **pass** []<br>手牌: AS AD KS KH KC KD QS QC 5S 4H 4H 4C 4D 2S 2S 2H 2C
- `self|1332|76` 座2 8张 敌最少5 对家0 级K 上手=single:5 → **pass** []<br>手牌: KS KC KD JH JC 10C 10D 10D
- `self|1639|60` 座0 10张 敌最少14 对家0 级4 上手=single:7 → **pass** []<br>手牌: BJ AH AC AC AD 2S 2S 2H 2C 2D

### 早中盘领出小对（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：119/123 (97%)

- `self|20|74` 座0 8张 敌最少2 对家0 级9 上手=pair:10 → **pass** []<br>手牌: RJ AD 6S 5C 5C 3S 3C 3D
- `self|448|74` 座0 14张 敌最少10 对家9 级4 上手=pair:7 → **pass** []<br>手牌: RJ 4D KH KD QH QD QD JH JH 10H 3S 3H 3D 3D
- `self|641|32` 座3 10张 敌最少19 对家12 级5 上手=pair:7 → **pass** []<br>手牌: AS AH AD KC 9S 6C 2S 2H 2C 2D
- `self|948|69` 座0 14张 敌最少10 对家0 级A 上手=pair:3 → **pass** []<br>手牌: AS AD KS KH KC KD 3S 3H 3D 3D 2S 2H 2D 2D
- `self|1584|59` 座3 13张 敌最少11 对家15 级10 上手=pair:J → **pass** []<br>手牌: 10C 10D AH KS 8H 8C 8C 7S 7H 7C 7C 5C 3S

### 跟敌人牌过牌率（early，有牌可出时）

- `self|16|9` 座1 26张 敌最少20 对家26 级3 上手=fullhouse:6 → **pass** []<br>手牌: AH KD QS QH QC QD QD JS JS JH JC 9H 9C 8S 8C 7S 7D 6S 6H 6C 6D 5S 5S 5H 5D 5D
- `self|416|35` 座2 22张 敌最少14 对家19 级2 上手=single:K → **pass** []<br>手牌: BJ 2D KD JS JH JC JD 10H 9S 9H 9C 8S 8H 8C 7S 7H 7D 6S 4S 4H 4H 3S
- `self|823|5` 座3 26张 敌最少25 对家26 级9 上手=single:K → **pass** []<br>手牌: RJ BJ 9H AS AH AC KD QS JH JH JC 10S 10D 10D 8S 7H 7C 5S 5S 5H 5C 5D 5D 2S 2S 2H
- `self|1202|18` 座1 21张 敌最少21 对家11 级2 上手=single:BJ → **pass** []<br>手牌: RJ RJ AH QS QH QC QD JS JS JC JD 10C 9H 9D 7S 6D 5C 4S 3S 3H 3D
- `self|1619|22` 座0 26张 敌最少19 对家19 级4 上手=single:J → **pass** []<br>手牌: RJ BJ 4H AH AC KS KS KH JH 10S 10S 10H 10D 9C 8H 8H 6S 6H 5S 5D 5D 3H 3D 2H 2C 2C

### 跟敌人牌过牌率（mid，有牌可出时）

- `self|16|27` 座3 19张 敌最少14 对家26 级3 上手=pair:K → **pass** []<br>手牌: 3H 3H 3C 3D AS AH AC AD 9S 7H 4S 4S 4H 4C 4C 2S 2S 2C 2D
- `self|404|66` 座3 11张 敌最少3 对家5 级3 上手=pair:K → **pass** []<br>手牌: RJ AH AC AC AD KS KH 4H 4C 4C 4D
- `self|789|25` 座0 15张 敌最少19 对家22 级6 上手=pair:J → **pass** []<br>手牌: 6S 6C JS JH JC JD 10D 7H 7H 7C 5H 5C 5D 3H 3D
- `self|1204|38` 座3 14张 敌最少15 对家14 级7 上手=single:9 → **pass** [noSFon8]<br>手牌: 7H JS JH JH JC 8C 4S 4C 4D 4D 3H 3C 2S 2D
- `self|1603|30` 座3 16张 敌最少23 对家19 级Q 上手=single:A → **pass** []<br>手牌: QH AH AC AD 8S 8H 7H 7C 7C 5S 5C 5D 5D 4H 4C 4D

### 跟敌人牌过牌率（late，有牌可出时）

- `self|16|71` 座0 8张 敌最少14 对家0 级3 上手=single:9 → **pass** [noSFon8]<br>手牌: RJ 10S 10H 10H 10D 7S 7H 7C
- `self|405|30` 座0 5张 敌最少13 对家16 级6 上手=pair:A → **pass** []<br>手牌: 6H 6D AS KH QH
- `self|772|54` 座0 7张 敌最少8 对家18 级A 上手=single:8 → **pass** [noSFon8]<br>手牌: AH AD KS KC QS QH QD
- `self|1186|35` 座1 9张 敌最少20 对家13 级Q 上手=single:K → **pass** []<br>手牌: RJ BJ BJ KS KH KD 5H 2D 2D
- `self|1607|62` 座1 9张 敌最少7 对家13 级7 上手=pair:10 → **pass** []<br>手牌: AH AC AC KC KC QS QS QH QH

### 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率

按座位 南/东/北/西：547/2464 (22%) / 473/2451 (19%) / 549/2479 (22%) / 438/2399 (18%)

- `self|17|31` 座3 18张 敌最少11 对家18 级4 上手=single:8 → **pass** [noSFon8]<br>手牌: BJ JS JH JC JC 10S 10D 9H 9D 8H 7S 7S 7H 7C 6H 6H 5D 5D
- `self|416|18` 座1 21张 敌最少21 对家19 级2 上手=pair:9 → **pass** []<br>手牌: 2S 2C KC QD JS JH JC JD 10S 10H 10C 10D 9H 9C 8H 8D 7S 7C 7D 5S 4C
- `self|791|59` 座3 15张 敌最少9 对家0 级5 上手=pair:3 → **pass** []<br>手牌: BJ 5S KC 10S 10H 10C 10D 6S 6H 6H 6C 3S 3S 3H 3D
- `self|1168|4` 座2 26张 敌最少26 对家26 级10 上手=single:J → **pass** []<br>手牌: 10H KS KH KC KC QH QD JD JD 9C 8S 8C 8D 8D 7C 7D 6S 6C 6D 5S 5D 4S 2S 2H 2C 2D
- `self|1665|36` 座0 21张 敌最少14 对家11 级4 上手=single:10 → **pass** []<br>手牌: BJ BJ 4S 4C AH AD KS KH KD KD QS QH 9C 8C 6S 6H 6D 5S 3S 3H 3C

### 压对家的牌（early，有牌可压时）

- `self|994|82` 座3 20张 敌最少2 对家0 级A 上手=pair:8 → **pair:10{10S 10C}** [blockSure]<br>手牌: AD QH QD QD JS JS JC JD 10S 10C 9D 6C 3H 3H 3C 3D 2S 2S 2C 2D

### 压对家的牌（mid，有牌可压时）

- `self|87|47` 座1 10张 敌最少13 对家12 级Q 上手=fullhouse:9 → **fullhouse:A{AS AC AS 6D 6H}** []<br>手牌: QH QS QC AS AS AC 7C 7C 6H 6D
- `self|179|80` 座3 10张 敌最少3 对家8 级A 上手=fullhouse:Q → **fullhouse:A{AC AC AS 6D 6H}** [forceFinish:sure]<br>手牌: AS AC AC 8H 8H 6H 6D 2S 2H 2C
- `self|610|56` 座2 11张 敌最少2 对家7 级3 上手=single:9 → **single:A{AS}** [noSFon8,followUp]<br>手牌: AS AH KD 10H 10C 10C 10D 8C 7S 6H 5S
- `self|756|78` 座3 14张 敌最少2 对家2 级4 上手=single:A → **single:BJ{BJ}** [followUp]<br>手牌: BJ 4D 8H 8C 7S 7H 7D 6H 6D 5H 5C 5C 5D 2D
- `self|1058|81` 座0 11张 敌最少1 对家0 级8 上手=single:10 → **single:8{8D}** [followUp,blockSure]<br>手牌: 8D 6C 5S 5H 5C 4H 4C 4D 3S 3D 3D

### 压对家的牌（late，有牌可压时）

- `self|22|82` 座1 5张 敌最少17 对家12 级A 上手=single:RJ → **bomb:7{7D 7H 7S 7H AH}**<br>手牌: AH 7S 7H 7H 7D
- `self|322|71` 座0 6张 敌最少20 对家17 级K 上手=pair:5 → **pair:BJ{BJ BJ}** [forceFinish:bombBack]<br>手牌: BJ BJ KH 3S 3S 3C
- `self|705|97` 座0 1张 敌最少2 对家14 级8 上手=single:10 → **single:K{KD}**<br>手牌: KD
- `self|1109|95` 座0 4张 敌最少6 对家5 级A 上手=single:Q → **bomb:A{AC AS AC AH}**<br>手牌: AH AS AC AC
- `self|1573|78` 座1 5张 敌最少6 对家5 级2 上手=single:6 → **single:RJ{RJ}** [followUp,strongBeforeLast,forceFinish:bombBack]<br>手牌: RJ QS QH QC QD

### 敌家都 ≥10 张时领出炸弹（非走完）

炸压炸占跟牌炸弹：1755/3774 (47%)

- `self|37|67` 座1 7张 敌最少12 对家10 级9 上手=pass → **bomb:9{9S 9D 9C 9C}** [bombClear,control]<br>手牌: 9S 9C 9C 9D 3S 3C 3C
- `self|453|64` 座0 10张 敌最少13 对家22 级J 上手=pass → **bomb:5{5D 5C 5H 5S}** [bombClear,control]<br>手牌: JH JH QH QC QD QD 5S 5H 5C 5D
- `self|848|80` 座2 9张 敌最少11 对家4 级3 上手=pass → **bomb:7{7D 7H 7H 7C}** [bombClear,control]<br>手牌: JS JS JC JC JD 7H 7H 7C 7D
- `self|1220|44` 座3 9张 敌最少13 对家16 级5 上手=pass → **bomb:7{7H 7S 7H 7C}** [bombClear,control]<br>手牌: 5S KS KS KH KD 7S 7H 7H 7C
- `self|1623|53` 座3 8张 敌最少12 对家11 级Q 上手=pass → **bomb:7{7H 7D 7H 7D}** [bombClear,control]<br>手牌: AH AC AC AD 7H 7H 7D 7D

### 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌

- `self|17|71` 座0 22张 敌最少2 对家0 级4 上手=pair:K → **pass** []<br>手牌: 4C QS QS QH QC QD 10S 10H 10D 9S 9H 8H 8D 8D 6S 6C 6C 6D 5H 5C 3C 3D
- `self|263|40` 座2 15张 敌最少3 对家14 级J 上手=fullhouse:10 → **pass** []<br>手牌: JS JC AS AC 9S 9H 9C 9D 8C 3S 3C 3D 2H 2D 2D
- `self|722|81` 座1 15张 敌最少2 对家0 级Q 上手=pair:K → **pass** []<br>手牌: RJ KC KC KD 9S 9S 9H 9D 5S 5H 5C 5D 4S 4C 4D
- `self|1185|52` 座2 9张 敌最少2 对家22 级A 上手=single:Q → **pass** []<br>手牌: JS 10S 9D 4S 4H 4H 4C 4D 3D
- `self|1541|79` 座2 11张 敌最少2 对家0 级8 上手=pair:J → **pass** []<br>手牌: BJ 10S 10H 9H 7C 5H 5H 5C 5D 4D 3H

### 输家结束时手里还留着炸弹（每个输家座位）

- `self|33` 座2 结束时手里：7C 6S 2C 9C 4S 5H 4D 4C 2C 7D 2H 5C 9D 2S
- `self|49` 座3 结束时手里：2C 4D 2C 2D BJ 2H BJ 4D
- `self|71` 座1 结束时手里：10S 3D 10C 10S 6C 10D 4S 7H
- `self|84` 座2 结束时手里：5C RJ RJ 3D 5S JD 3H 5H 5C
- `self|87` 座0 结束时手里：10D QH 10H 6H 10S 6C 10C

### 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10）

- `self|32|79` 座2 20张 敌最少12 对家0 级4 上手=single:8 → **single:4{4S}** [noSFon8,stopShort,followUp,followSize]<br>手牌: 4S JS JS JC JD 9D 9D 8S 8H 8C 8D 6S 6H 6C 6D 5S 3S 3H 3H 3C
- `self|533|70` 座2 20张 敌最少11 对家9 级Q 上手=single:7 → **single:Q{QC}** [stopShort,followUp,followSize]<br>手牌: QH QC QD QD JH 9S 9S 9H 9C 9D 8S 8C 7S 7C 6C 5S 5H 5C 5C 3D
- `self|998|65` 座3 21张 敌最少7 对家0 级A 上手=single:8 → **single:A{AD}** [noSFon8,stopShort,followUp,followSize]<br>手牌: AD KH KC QC QD JC JC JD JD 10H 10H 10C 10C 9S 9S 9D 5H 5C 2S 2D 2D
- `self|1424|80` 座2 20张 敌最少6 对家0 级K 上手=pair:7 → **pair:K{KC KD}** [stopShort,followSize]<br>手牌: RJ KC KD QC JH JD 8C 8D 7S 7H 7C 7C 5S 5S 5H 5C 4C 4C 4D 4D
- `self|1746|51` 座3 22张 敌最少2 对家7 级8 上手=single:3 → **single:RJ{RJ}** [stopShort,followUp,followSize]<br>手牌: RJ BJ BJ QS QH QH QC QC JS JH JC 9S 9H 9D 7S 7C 5H 4S 4C 4D 3S 3D

### 早盘领出 A/级牌/王的单对

- `self|49|9` 座3 25张 敌最少25 对家26 级8 上手=pass → **single:A{AD}** [control]<br>手牌: BJ BJ 8H 8C 8D 8D AD KS KH QS QC 10H 10H 10D 5S 5H 5D 4D 4D 3S 3C 2H 2C 2C 2D
- `self|979|43` 座1 21张 敌最少10 对家22 级K 上手=pass → **single:BJ{BJ}** [control,planKeepControl]<br>手牌: RJ BJ QS QS QH QC 9S 9D 8H 8H 8C 8D 7S 7H 6S 6H 2S 2S 2H 2C 2D
- `self|979|47` 座1 20张 敌最少10 对家22 级K 上手=pass → **single:RJ{RJ}** [control,planKeepControl]<br>手牌: RJ QS QS QH QC 9S 9D 8H 8H 8C 8D 7S 7H 6S 6H 2S 2S 2H 2C 2D
- `self|1174|25` 座1 26张 敌最少16 对家6 级6 上手=pass → **single:A{AH}** [control]<br>手牌: RJ RJ 6H 6H 6C AH KS KC QS QC JS JS 10S 10H 8H 8H 7C 7D 7D 5H 4S 4H 4H 4C 3S 2H
- `self|1542|0` 座2 27张 敌最少27 对家27 级9 上手=pass → **single:A{AD}** [noFirstBomb,control]<br>手牌: 9C AD KH KC KD QH QH JC JD 10C 8S 8S 8H 8D 7S 7H 6C 6C 6D 4H 4C 3H 3H 2H 2H 2C 2D

### 拆炸弹领出

- `self|35|51` 座1 17张 敌最少11 对家20 级7 上手=pass → **fullhouse:6{6H 6C 6C 3D 3D}** [bombBreakNoGain,leadSmallSame,control,offPlan]<br>手牌: 7S 7C 8C 8D 6S 6H 6C 6C 6D 5S 5H 4S 4H 4C 4D 3D 3D
- `self|385|25` 座1 14张 敌最少21 对家21 级A 上手=pass → **pairSeq:4{2S 2C 3D 3H 4H 4H}** [holdBombLead,control]<br>手牌: AH 6S 6C 5C 5D 4S 4S 4H 4H 4D 3H 3D 2S 2C
- `self|544|51` 座1 8张 敌最少7 对家13 级10 上手=pass → **pairSeq:J{9D 9C 10S 10S JS JD}** [holdBombLead,control,offPlan]<br>手牌: 10S 10S JS JH JC JD 9C 9D
- `self|870|0` 座0 27张 敌最少27 对家27 级K 上手=pass → **straight:6{2H 3D 4D 5D 6C}** [noFirstBomb,bombBreakNoGain,holdBombLead,control,planUnitFirst]<br>手牌: BJ KH QC QC JH JC JD 10S 10C 10D 10D 9S 9H 8S 8C 8C 8D 7S 7D 6S 6H 6C 6C 5D 4D 3D 2H
- `self|1506|37` 座1 11张 敌最少13 对家13 级7 上手=pass → **pairSeq:9{7D 7S 8S 8H 9D 9S}** [leadSmallSame,holdBombLead,control]<br>手牌: 7H 7S 7S 7C 7D 9S 9D 8S 8H 6S 6D

### 早盘拆对领单（手里有顺子/连对/钢板可出）

- `self|359|38` 座2 20张 敌最少21 对家21 级5 上手=pass → **single:4{4C}** [control]<br>手牌: 5H 5S 5S 5C AS KC KC JH JH JC JC 9S 8H 8C 8D 6D 4C 4D 3H 2D
- `self|421|11` 座2 22张 敌最少22 对家17 级5 上手=pass → **single:K{KH}** [control]<br>手牌: BJ 5S 5C 5D 5D KH KC QS JH JC JD 10S 10H 9D 9D 8C 7S 7C 6H 6C 4C 3S
- `self|498|53` 座3 22张 敌最少19 对家12 级10 上手=pass → **single:7{7S}** [control]<br>手牌: RJ AS AH AC AD KS KH QH QC JH 9S 9S 9H 9C 9C 9D 8D 7S 7D 6H 5C 2D
- `self|897|5` 座3 26张 敌最少26 对家27 级8 上手=pass → **single:J{JC}** [control]<br>手牌: BJ 8S KS KH KC KC QC JC JC 10H 10C 10D 9C 7S 7H 6S 6H 5H 5D 4H 4D 3H 3D 2S 2H 2D

### 早盘领出单张占比

早盘领出牌型分布：straight 21%，fullhouse 19%，single 19%，pairSeq 16%，pair 12%，tripleSeq 9%，triple 4%；熵 2.68 bit


### decide 用时 >300ms 的比例

p50 2.2ms，p90 21.9ms，p99 61.1ms，max 544.1ms

- `self|129|93` 座1 15张 敌最少3 对家0 级Q 上手=bomb:5 → **bomb:9{9S 9C 9H 9D 9H}** [forceFinish:likely]<br>手牌: QH QH QS QC JS JH JD JD 9S 9S 9H 9H 9C 9C 9D
- `self|1284|64` 座0 14张 敌最少8 对家0 级7 上手=fullhouse:5 → **bomb:8{8H 8H 8S 8S}** [noWasteJ,mustBomb]<br>手牌: 7H 7H QS QD 9C 9C 9D 8S 8S 8H 8H 8C 5D 3D
- `vsGreedy0|3200164|20` 座0 16张 敌最少7 对家22 级2 上手=fullhouse:4 → **pass** []<br>手牌: 2H 2H 2S 2C KH KC QS QC JH JC JD 10S 10S 10C 5S 4C
- `self|544|0` 座2 27张 敌最少27 对家27 级10 上手=pass → **single:3{3S}** [noFirstBomb,control,planWeakFirst]<br>手牌: 10H 10C 10C 10D AS AH AD KS KH KC KD QS QH JS JD 8H 7C 7C 6H 6C 6C 6D 5S 5C 5D 4D 3S
- `vsRandom1|3200119|16` 座3 16张 敌最少18 对家17 级8 上手=fullhouse:6 → **fullhouse:Q{QS QD QH 5C 5C}** [fhAttach]<br>手牌: 8H 8H AD KS KH KH QS QH QD 10S 10D 9C 5C 5C 4S 4S

### 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）

全部通过


### 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸）

不分有无孤张：还的点数手里原有 ≥2 张 339/883 (38%)（有的是顺子里多出的一张，拆牌计划认为更便宜）；还 >10 的牌（手里没有 ≤10，兜底）：0/883 (0%)

