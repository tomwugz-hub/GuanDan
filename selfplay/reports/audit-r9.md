# 自对局体检报告

生成：2026/10/19 20:46:02（Asia/Shanghai）　policy：current　用时 593s

对局：【进贡比赛模式，每场 8 副】自对局 1000 副（四家 decide），混合对手 Random、Greedy、Old:pre-activity、Old:pre-round6 各 200×2 副（换座位）；逐手记录 243091 条；surprise 局面 195 个。

局面 id 可复现：`node selfplay/audit.mjs --replay='<id>'`（cfg|seed|step）。

## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）

- **对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌**：65.7%（n=35，合理区间 ≤60%，严重度 0.3）

## 全部检测器

| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |
|---|---|---|---|---|---|
| 早中盘领出小单（≤10）后两个敌家都不跟 | 7.9% | 2760 | ≤25% | 7.4% | OK |
| 早中盘领出小对（≤10）后两个敌家都不跟 | 12.5% | 1028 | ≤35% | 12.6% | OK |
| 跟敌人牌过牌率（early，有牌可出时） | 52.2% | 19229 | ≥30 且 ≤62% | 51.8% | OK |
| 跟敌人牌过牌率（mid，有牌可出时） | 57.2% | 20661 | ≥30 且 ≤65% | 58.6% | OK |
| 跟敌人牌过牌率（late，有牌可出时） | 40.2% | 6366 | ≥20 且 ≤75% | 40.5% | OK |
| 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率 | 20.8% | 9929 | ≤35% | 21.3% | OK |
| 压对家的牌（early，有牌可压时） | 0.0% | 6069 | ≤15% | 0.0% | OK |
| 压对家的牌（mid，有牌可压时） | 0.3% | 7737 | ≤15% | 0.2% | OK |
| 压对家的牌（late，有牌可压时） | 12.6% | 2394 | ≤30% | 12.5% | OK |
| 炸对家（未因此走完） | 0.0% | 15080 | ≤2% | 0.0% | OK |
| 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌 | 65.7% | 35 | ≤60% | 65.6% | 🚩 |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 14.2% | 2003 | ≤15% | 12.6% | OK |
| 敌家都 ≥10 张时领出炸弹（非走完） | 4.5% | 5308 | ≤10% | 4.3% | OK |
| 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌 | 2.8% | 600 | ≤45% | 4.2% | OK |
| 输家结束时手里还留着炸弹（每个输家座位） | 7.3% | 2000 | ≤20% | 6.8% | OK |
| 输家结束时还握着 ≥2 张王/级牌 | 8.1% | 2000 | ≤25% | 6.9% | OK |
| 末游卡手（结束时 ≥8 张且至少还要 5 手） | 0.0% | 1000 | ≤25% | 0.0% | OK |
| 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10） | 1.6% | 5565 | ≤8% | 1.2% | OK |
| 早盘领出 A/级牌/王的单对 | 1.0% | 1180 | ≤12% | 1.0% | OK |
| 拆炸弹领出 | 0.6% | 15508 | ≤2% | 0.7% | OK |
| 早盘拆对领单（手里有顺子/连对/钢板可出） | 0.3% | 601 | ≤15% | 0.2% | OK |
| 早盘领出对子占比 | 11.9% | 3856 | ≥5% | 12.3% | OK |
| 早盘领出单张占比 | 18.8% | 3856 | ≥15 且 ≤55% | 18.0% | OK |
| 一手能出完却没出完 | 0.0% | 2720 | ≤1% | 0.0% | OK |
| decide 用时 >300ms 的比例 | 0.0% | 163260 | ≤0.5% | 0.0% | OK |
| 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测） | 0.000 | 2600 | ≤0 | 0.000 | OK |
| 对 Random 每副净升级 | 2.940 | 400 | ≥1.5 | 2.945 | OK |
| 对 Greedy 每副净升级 | 2.408 | 400 | ≥0.5 | 2.480 | OK |
| 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸） | 34.3% | 849 | ≤50% | 34.5% | OK |
| Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5 | 3.6% | 195 | ≤5% | 9.0% | OK |

## 队伍结果

- 自对局 1000 副：南北队每副净升级 -0.025 [-0.152, 0.102]（应≈0），双下率 26.6%，平均每副 91 手
- 各座位平均名次（南/东/北/西）：2.48 / 2.52 / 2.52 / 2.48
- decide vs Random：400 副，胜 397/400 (99%)，每副净升级 2.940 [2.898, 2.982]
- decide vs Greedy：400 副，胜 371/400 (93%)，每副净升级 2.408 [2.253, 2.562]
- decide vs Old:pre-activity：400 副，胜 309/400 (77%)，每副净升级 1.315 [1.126, 1.504]
- decide vs Old:pre-round6：400 副，胜 297/400 (74%)，每副净升级 1.347 [1.149, 1.546]

## 进贡

- 进贡比赛 325 场共 2600 副；需进贡的副 2030：单贡 1112（抗贡 74/1112 (7%)，理论≈6%），双下双贡 918（抗贡 243/918 (26%)，理论≈25%；贡牌同点 60）
- 贡牌分布：RJ 36%，BJ 28%，A 11%，K 4%，5 4%，8 3%，J 3%，Q 2%，9 2%，6 2%，10 2%，7 2%，3 1%，4 1%
- 自对局还贡点数分布（decide）：2 23%，3 16%，4 13%，5 12%，6 11%，7 8%，10 7%，9 6%，8 5%
- 自对局进贡副（未抗贡）进贡方每副净升级 0.025 [-0.126, 0.176]（n=729；负 = 输家进贡后仍吃亏）
- 自对局抗贡副 抗贡方每副净升级 -0.105 [-0.534, 0.324]（n=86）
- 进贡不变量（贡牌=最大非逢人配、双下大贡归头游/同点头游下家、抗贡判定、还贡≤10、先出者、交换后各 27 张、牌守恒）：全部通过（检查 2600 副）

## 详情与示例局面

### 🚩 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌

旧口径（含拆炸/只有炸弹可压）：26/38 (68%)；其中不拆三张也能压：20/32 (63%)；只能拆三张才能压：3/3 (100%)

- `self|36|50` 座3 16张 敌最少3 对家16 级8 上手=single:A → **pass** [可压:single:8{8D} / single:RJ{RJ} / single:8{8H}]<br>手牌: RJ 8H 8D KC JS JH JC JD 9S 9H 9C 9D 7S 7H 7H 7D
- `self|257|59` 座3 13张 敌最少3 对家14 级8 上手=single:8 → **pass** [noSFon8,可压:single:RJ{RJ} / single:RJ{RJ}]<br>手牌: RJ RJ 8H JS JH 9C 9D 7S 6S 6H 6H 6C 6D
- `self|885|58` 座2 19张 敌最少1 对家11 级A 上手=pair:7 → **pass** [mustBomb,可压:pair:10{10H 10C} / pair:10{10H AH} / pair:8{8D 8S}]<br>手牌: RJ AH 10H 10C 10D 8S 8H 8D 7H 7C 7D 5S 5H 5C 5D 4C 3D 2H 2C
- `self|1136|51` 座3 16张 敌最少3 对家9 级8 上手=pair:8 → **pass** [可压:pair:RJ{RJ RJ}]<br>手牌: RJ RJ 8H AH AH QS QH 6C 4S 4C 3C 3C 2S 2H 2C 2D
- `self|1590|65` 座2 10张 敌最少3 对家6 级A 上手=single:8 → **pass** [noSFon8,可压:single:9{9H} / single:J{JH} / single:RJ{RJ}]<br>手牌: RJ AH AH JH JH 9H 9D 8H 8D 6D

### 早中盘领出小单（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：214/217 (99%)

- `self|22|37` 座2 18张 敌最少13 对家11 级A 上手=single:3 → **pass** []<br>手牌: BJ AC JS JS JH JH 8H 8C 8D 8D 4S 4H 4D 4D 3D 2C 2D 2D
- `self|513|88` 座2 6张 敌最少10 对家0 级9 上手=single:6 → **pass** []<br>手牌: 7C 7D 6S 6H 6H 6C
- `self|961|66` 座1 14张 敌最少12 对家0 级K 上手=single:8 → **pass** [noSFon8]<br>手牌: QS QC QD QD 10D 10D 9H 9C 9D 8H 8D 7S 7S 7D
- `self|1332|76` 座2 8张 敌最少5 对家0 级K 上手=single:5 → **pass** []<br>手牌: KS KC KD JH JC 10C 10D 10D
- `self|1655|87` 座3 10张 敌最少5 对家0 级K 上手=single:7 → **pass** []<br>手牌: KS KC KD KD 8H 8C 4H 4H 4C 4D

### 早中盘领出小对（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：123/129 (95%)

- `self|20|74` 座0 8张 敌最少2 对家0 级9 上手=pair:10 → **pass** []<br>手牌: RJ AD 6S 5C 5C 3S 3C 3D
- `self|419|62` 座1 13张 敌最少10 对家14 级4 上手=pair:7 → **pass** []<br>手牌: 4S 4D JS JS JH JH JC 10S 10C 10C 10D 8H 6D
- `self|583|58` 座2 22张 敌最少8 对家10 级A 上手=pair:8 → **pass** []<br>手牌: AD KS KS QS QS QC QD QD JH JD 6S 6C 5S 5C 5D 4H 2S 2S 2H 2H 2C 2C
- `self|960|51` 座1 11张 敌最少7 对家10 级10 上手=pair:5 → **pass** []<br>手牌: 10D QD 9S 9S 9H 9H 9D 9D 6D 5C 3D
- `self|1495|72` 座2 8张 敌最少13 对家0 级2 上手=pair:4 → **pass** []<br>手牌: QS QH QC QD 7S 7C 7D 7D

### 跟敌人牌过牌率（early，有牌可出时）

- `self|16|9` 座1 26张 敌最少20 对家26 级3 上手=fullhouse:6 → **pass** []<br>手牌: AH KD QS QH QC QD QD JS JS JH JC 9H 9C 8S 8C 7S 7D 6S 6H 6C 6D 5S 5S 5H 5D 5D
- `self|407|33` 座1 20张 敌最少11 对家15 级3 上手=pair:K → **pass** []<br>手牌: BJ BJ 3S 3S AC QS QD JH JC 9S 9C 6D 5S 5C 5D 5D 4S 2S 2H 2D
- `self|821|19` 座1 22张 敌最少12 对家12 级6 上手=fullhouse:8 → **pass** []<br>手牌: RJ RJ BJ 6H 6C 6D AS AH KD QS JS JH JH JD JD 10C 10D 9C 8C 7S 3D 2D
- `self|1201|12` 座1 22张 敌最少12 对家22 级A 上手=fullhouse:K → **pass** []<br>手牌: BJ AH AS AD KS KH KH KD QC QC JH JH JC 10H 10D 9H 9D 8H 8D 8D 5D 2C
- `self|1616|47` 座2 20张 敌最少7 对家7 级Q 上手=single:6 → **pass** []<br>手牌: RJ QH QS AC AC KS KH KH KC KD JS JS 9S 9D 9D 8C 8D 7C 7D 2D

### 跟敌人牌过牌率（mid，有牌可出时）

- `self|16|27` 座3 19张 敌最少14 对家26 级3 上手=pair:K → **pass** []<br>手牌: 3H 3H 3C 3D AS AH AC AD 9S 7H 4S 4S 4H 4C 4C 2S 2S 2C 2D
- `self|406|45` 座0 18张 敌最少11 对家12 级9 上手=single:BJ → **pass** []<br>手牌: RJ BJ JS JH JC 10S 10S 10H 10D 6H 6D 5S 5S 5H 5C 3S 3H 3D
- `self|757|17` 座2 11张 敌最少17 对家23 级6 上手=pair:A → **pass** []<br>手牌: BJ BJ 6C AS KH QS QS QH QC 5C 3D
- `self|1200|36` 座0 13张 敌最少13 对家18 级Q 上手=fullhouse:7 → **pass** []<br>手牌: QC 10C 9S 9H 9H 9C 9D 8S 8H 8D 8D 4S 3D
- `self|1606|36` 座0 10张 敌最少14 对家15 级4 上手=single:A → **pass** []<br>手牌: 4H 4S KD JS JH JC JC JD 7H 7C

### 跟敌人牌过牌率（late，有牌可出时）

- `self|16|71` 座0 8张 敌最少14 对家0 级3 上手=single:9 → **pass** [noSFon8]<br>手牌: RJ 10S 10H 10H 10D 7S 7H 7C
- `self|358|57` 座1 8张 敌最少13 对家14 级3 上手=single:A → **pass** []<br>手牌: 3C 3D 7S 2S 2C 2C 2D 2D
- `self|775|59` 座3 6张 敌最少9 对家9 级5 上手=pair:8 → **pass** []<br>手牌: 5H 5C QC 7S 7C 7D
- `self|1222|46` 座1 8张 敌最少17 对家14 级9 上手=single:8 → **pass** [noSFon8]<br>手牌: 9S 9C 9C 9D 10S 10S 10C 10D
- `self|1604|35` 座1 9张 敌最少8 对家26 级A 上手=single:10 → **pass** []<br>手牌: AD KS KH 10S 10H 9S 5S 2S 2D

### 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率

按座位 南/东/北/西：564/2493 (23%) / 451/2442 (18%) / 558/2534 (22%) / 492/2460 (20%)

- `self|17|31` 座3 18张 敌最少11 对家18 级4 上手=single:8 → **pass** [noSFon8]<br>手牌: BJ JS JH JC JC 10S 10D 9H 9D 8H 7S 7S 7H 7C 6H 6H 5D 5D
- `self|416|80` 座3 14张 敌最少9 对家12 级2 上手=single:9 → **pass** [noSFon8]<br>手牌: BJ 2C QS QS QH QC 6S 6H 6H 6C 5H 5H 5C 5D
- `self|752|21` 座0 26张 敌最少20 对家10 级10 上手=single:K → **pass** []<br>手牌: RJ BJ 10H 10S 10C AH AD KS KS KH KH QH QD 7S 7D 6S 6C 6D 5D 4S 4S 4H 4D 3S 3C 2S
- `self|1156|20` 座0 24张 敌最少17 对家24 级A 上手=pair:10 → **pass** []<br>手牌: AS AS AC KS KH KC QS QH QH QC QD 10D 10D 9S 9H 9C 7C 6S 6C 5D 4C 4D 3S 3C
- `self|1602|23` 座0 16张 敌最少9 对家17 级A 上手=single:9 → **pass** [noSFon8]<br>手牌: BJ BJ AS AS KH KC KC KD 8S 8H 8C 8C 6H 6C 5D 4D

### 压对家的牌（early，有牌可压时）

- `self|103|86` 座0 21张 敌最少2 对家2 级5 上手=single:9 → **single:RJ{RJ}** [noSFon8,followUp]<br>手牌: RJ 5C AS AS AH AC AD 9S 9C 8S 8S 8H 8D 8D 6H 6H 3D 3D 2S 2C 2D
- `self|787|65` 座3 23张 敌最少2 对家2 级3 上手=single:A → **single:3{3D}** [followUp]<br>手牌: 3S 3D AS AH AC AD KS KS KC KD QD QD 10H 10D 8H 7D 7D 6S 6D 4S 4H 2S 2D
- `self|994|82` 座3 20张 敌最少2 对家0 级A 上手=pair:8 → **pair:10{10S 10C}** [blockSure]<br>手牌: AD QH QD QD JS JS JC JD 10S 10C 9D 6C 3H 3H 3C 3D 2S 2S 2C 2D

### 压对家的牌（mid，有牌可压时）

- `self|69|86` 座2 11张 敌最少1 对家0 级10 上手=single:J → **single:Q{QC}** [followUp,blockSure]<br>手牌: QC JC 9S 9H 9C 6S 6C 3S 3S 3C 3D
- `self|179|84` 座3 10张 敌最少3 对家8 级A 上手=fullhouse:Q → **fullhouse:A{AC AC AS 6D 6H}** [forceFinish:sure]<br>手牌: AS AC AC 8H 8H 6H 6D 2S 2H 2C
- `self|756|78` 座3 14张 敌最少2 对家2 级4 上手=single:A → **single:BJ{BJ}** [followUp]<br>手牌: BJ 4D 8H 8C 7S 7H 7D 6H 6D 5H 5C 5C 5D 2D
- `self|1271|61` 座0 11张 敌最少10 对家5 级J 上手=fullhouse:4 → **fullhouse:8{8S 8D 8H JD JC}** [forceFinish:bombBack]<br>手牌: JH JH JC JD 8S 8H 8D 6S 6S 6H 6C
- `self|1395|31` 座3 10张 敌最少10 对家21 级2 上手=fullhouse:6 → **fullhouse:A{AH AC AC JH JC}** [fhAttach]<br>手牌: 2H AH AC AC JH JC 10D 5S 5H 5D

### 压对家的牌（late，有牌可压时）

- `self|22|82` 座1 5张 敌最少17 对家12 级A 上手=single:RJ → **bomb:7{7D 7H 7S 7H AH}**<br>手牌: AH 7S 7H 7H 7D
- `self|372|81` 座1 4张 敌最少8 对家7 级A 上手=single:6 → **bomb:3{3H 3D 3H 3S}**<br>手牌: 3S 3H 3H 3D
- `self|787|67` 座1 2张 敌最少2 对家22 级3 上手=single:3 → **single:RJ{RJ}** [followUp,strongBeforeLast,forceFinish:likely]<br>手牌: RJ KH
- `self|1233|86` 座2 3张 敌最少4 对家4 级A 上手=single:5 → **single:A{AS}** [followUp,strongBeforeLast]<br>手牌: AS 9H 9D
- `self|1619|75` 座1 4张 敌最少4 对家9 级4 上手=bomb:3 → **bomb:J{JH JD JS JC}**<br>手牌: JS JH JC JD

### 敌家都 ≥15 张时炸普通牌（占跟牌炸弹）

每副炸弹数（自对局，四人合计）：早 0.37 / 中 2.10 / 晚 2.84

- `self|17|60` 座1 13张 敌最少23 对家13 级4 上手=single:K → **bomb:J{JD JS JD JH}** [mustBomb]<br>手牌: AS AS AC AD KD KD JS JH JD JD 10C 2S 2D
- `self|433|68` 座0 5张 敌最少18 对家6 级6 上手=single:BJ → **bomb:5{5D 5H 5C 5H}** [mustBomb,forceFinish:likely]<br>手牌: QD 5H 5H 5C 5D
- `self|869|71` 座0 5张 敌最少20 对家17 级7 上手=single:Q → **bomb:Q{QH QC QH QD}** [mustBomb,forceFinish:likely]<br>手牌: QH QH QC QD 10D
- `self|1168|70` 座2 12张 敌最少16 对家6 级10 上手=pair:A → **bomb:8{8S 8D 8D 8C}** [mustBomb]<br>手牌: KS KH KC KC QH QD JD JD 8S 8C 8D 8D
- `self|1588|71` 座1 18张 敌最少16 对家0 级A 上手=single:RJ → **bomb:6{6S 6H 6C 6C}** [mustBomb]<br>手牌: RJ KS KH KC KD KD QC QD JH JD 9H 9C 7S 7D 6S 6H 6C 6C

### 敌家都 ≥10 张时领出炸弹（非走完）

炸压炸占跟牌炸弹：1816/3819 (48%)

- `self|49|64` 座2 8张 敌最少12 对家13 级8 上手=pass → **bomb:4{4C 4S 4S 4H}** [holdBombLead,control,leadBombLate]<br>手牌: JH JC JC JD 4S 4S 4H 4C
- `self|467|80` 座0 9张 敌最少17 对家8 级J 上手=pass → **bomb:2{2H 2H 2S 2C}** [holdBombLead,control]<br>手牌: 8S 8H 8H 8C 8D 2S 2H 2H 2C
- `self|823|83` 座2 8张 敌最少10 对家6 级9 上手=pass → **bomb:7{7H 7C 7S 7D}** [holdBombLead,control]<br>手牌: 8H 8C 8C 8D 7S 7H 7C 7D
- `self|1175|82` 座0 9张 敌最少15 对家10 级7 上手=pass → **bomb:10{10S 10C 10H 10D}** [holdBombLead,control]<br>手牌: QS QS QH QC QC 10S 10H 10C 10D
- `self|1619|67` 座1 8张 敌最少13 对家13 级4 上手=pass → **bomb:6{6H 6C 6D 6C}** [holdBombLead,control,leadBombLate]<br>手牌: JS JH JC JD 6H 6C 6C 6D

### 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌

- `self|17|71` 座0 22张 敌最少2 对家0 级4 上手=pair:K → **pass** []<br>手牌: 4C QS QS QH QC QD 10S 10H 10D 9S 9H 8H 8D 8D 6S 6C 6C 6D 5H 5C 3C 3D
- `self|304|50` 座0 8张 敌最少3 对家19 级8 上手=pair:J → **pass** []<br>手牌: 8C 7H 7D 5S 5H 5C 5D 3C
- `self|663|73` 座0 19张 敌最少3 对家0 级10 上手=triple:7 → **pass** []<br>手牌: RJ RJ AC AD QS QH JH JD 5S 5H 5C 5C 5D 3H 3C 2S 2S 2H 2D
- `self|1008|72` 座1 15张 敌最少3 对家0 级K 上手=pair:10 → **pass** []<br>手牌: KC 9S 9H 9H 9C 8S 8H 7S 7S 7H 7D 5S 5H 3H 3D
- `self|1286|63` 座1 12张 敌最少3 对家16 级2 上手=pair:6 → **pass** []<br>手牌: RJ 2S KC 4S 4H 4C 4D 3S 3H 3H 3C 3D

### 输家结束时手里还留着炸弹（每个输家座位）

- `self|33` 座2 结束时手里：7C 6S 2C 9C 4S 5H 4D 4C 2C 7D 2H 5C 9D 2S
- `self|49` 座3 结束时手里：2C 4D 2C 2D 2H 4D
- `self|54` 座1 结束时手里：2C 2D RJ QH 4H 2S QD QD QC RJ 2H JD
- `self|84` 座2 结束时手里：5C RJ RJ 3D 5S JD 3H 5H 5C
- `self|97` 座1 结束时手里：AD AH QD AC KH KC AS RJ RJ QS

### 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10）

- `self|32|79` 座2 20张 敌最少12 对家0 级4 上手=single:8 → **single:4{4S}** [noSFon8,stopShort,followUp,followSize]<br>手牌: 4S JS JS JC JD 9D 9D 8S 8H 8C 8D 6S 6H 6C 6D 5S 3S 3H 3H 3C
- `self|481|48` 座0 20张 敌最少14 对家12 级7 上手=single:10 → **single:RJ{RJ}** [stopShort,followUp,followSize]<br>手牌: RJ 7H 7H 7S 7C AH AD 6C 6C 5H 5C 5D 5D 4S 4H 4H 4D 3H 3C 2S
- `self|980|50` 座0 20张 敌最少13 对家13 级A 上手=single:9 → **single:BJ{BJ}** [noSFon8,stopShort,followUp,followSize]<br>手牌: BJ AH AS KS KH QH QH JS JC 8S 8H 8C 8C 8D 6H 5H 3S 3C 3D 2H
- `self|1328|42` 座3 22张 敌最少23 对家5 级7 上手=pair:9 → **pair:7{7C 7D}** [stopShort,followSize]<br>手牌: 7H 7C 7D AS AC AC AD KH KC 10H 10D 9C 8S 8H 8D 6S 6S 6H 6C 5S 5H 5C
- `self|1683|51` 座1 20张 敌最少23 对家12 级4 上手=single:8 → **single:RJ{RJ}** [noSFon8,stopShort,followUp,followSize]<br>手牌: RJ 4H 4C 4D AS AC AD KC QH QD JS JC JD 10S 9C 9D 6S 6C 3C 3D

### 早盘领出 A/级牌/王的单对

- `self|49|9` 座3 25张 敌最少25 对家26 级8 上手=pass → **single:A{AD}** [control]<br>手牌: BJ BJ 8H 8C 8D 8D AD KS KH QS QC 10H 10H 10D 5S 5H 5D 4D 4D 3S 3C 2H 2C 2C 2D
- `self|979|43` 座1 21张 敌最少10 对家22 级K 上手=pass → **single:BJ{BJ}** [control,planKeepControl]<br>手牌: RJ BJ QS QS QH QC 9S 9D 8H 8H 8C 8D 7S 7H 6S 6H 2S 2S 2H 2C 2D
- `self|1174|25` 座1 26张 敌最少16 对家6 级6 上手=pass → **single:A{AH}** [control]<br>手牌: RJ RJ 6H 6H 6C AH KS KC QS QC JS JS 10S 10H 8H 8H 7C 7D 7D 5H 4S 4H 4H 4C 3S 2H
- `self|1221|35` 座0 23张 敌最少9 对家20 级7 上手=pass → **single:RJ{RJ}** [control,planKeepControl]<br>手牌: RJ 7H 7C AS AC AD AD JS JC 10S 10H 10C 10D 9S 9D 5S 5S 5H 5D 3C 3C 2S 2C
- `self|1287|7` 座0 21张 敌最少21 对家21 级4 上手=pass → **pair:A{AC AD}** [control]<br>手牌: RJ RJ 4C AC AD KD QH 10S 10H 10C 9S 9C 8H 8C 8D 7S 7H 6H 6H 6C 6D

### 拆炸弹领出

- `self|35|51` 座1 17张 敌最少11 对家20 级7 上手=pass → **fullhouse:6{6H 6C 6C 3D 3D}** [bombBreakNoGain,leadSmallSame,control,offPlan]<br>手牌: 7S 7C 8C 8D 6S 6H 6C 6C 6D 5S 5H 4S 4H 4C 4D 3D 3D
- `self|400|44` 座3 9张 敌最少18 对家15 级A 上手=pass → **triple:A{AC AS AD}** [bombBreakNoGain,leadSmallSame,control,offPlan,forceFinish:likely]<br>手牌: AH AS AS AC AD 2H 2H 2C 2D
- `self|694|49` 座2 10张 敌最少13 对家12 级9 上手=pass → **pairSeq:Q{10H 10C JS JC QS QD}** [holdBombLead,control,offPlan]<br>手牌: KC KC QS QH QH QD JS JC 10H 10C
- `self|1041|58` 座2 14张 敌最少13 对家8 级4 上手=pass → **fullhouse:6{6S 6H 6C 7S 7D}** [control,offPlan]<br>手牌: 9S 9S 9H 9D 7S 7H 7C 7D 7D 6S 6S 6H 6C 6D
- `self|1510|55` 座2 8张 敌最少14 对家23 级Q 上手=pass → **triple:Q{QS QC QD}** [bombBreakNoGain,leadSmallSame,control,offPlan]<br>手牌: QS QS QC QD 2S 2H 2C 2D

### 早盘拆对领单（手里有顺子/连对/钢板可出）

- `self|498|53` 座3 22张 敌最少19 对家12 级10 上手=pass → **single:7{7S}** [control]<br>手牌: RJ AS AH AC AD KS KH QH QC JH 9S 9S 9H 9C 9C 9D 8D 7S 7D 6H 5C 2D
- `self|897|5` 座3 26张 敌最少26 对家27 级8 上手=pass → **single:J{JC}** [control]<br>手牌: BJ 8S KS KH KC KC QC JC JC 10H 10C 10D 9C 7S 7H 6S 6H 5H 5D 4H 4D 3H 3D 2S 2H 2D

### 早盘领出单张占比

早盘领出牌型分布：straight 20%，fullhouse 19%，single 19%，pairSeq 16%，pair 12%，tripleSeq 10%，triple 4%；熵 2.69 bit


### decide 用时 >300ms 的比例

p50 2.3ms，p90 22.6ms，p99 63.7ms，max 527.9ms

- `self|544|76` 座2 13张 敌最少1 对家0 级10 上手=fullhouse:4 → **bomb:6{6C 6D 6C 6H}** [noWasteJ,mustBomb,forceFinish:likely]<br>手牌: 10H 10C 10C 10D KS KH KC KD JD 6H 6C 6C 6D
- `self|790|72` 座1 15张 敌最少1 对家8 级5 上手=fullhouse:6 → **bomb:A{AH AD AH AS}** [noWasteJ,mustBomb,forceFinish:likely]<br>手牌: 5H 5H 5D AS AH AH AD 4H 4C 4D 3S 3H 3C 3D 2D
- `self|307|40` 座0 16张 敌最少16 对家7 级K 上手=fullhouse:9 → **pass** []<br>手牌: KH KH KS QS QH QC QD QD JC JC 10S 10S 10H 10C 10D 9S
- `self|486|71` 座2 13张 敌最少2 对家0 级K 上手=pair:8 → **bomb:A{AS AS AC AD}** [forceFinish:likely]<br>手牌: KH KS KS KC AS AS AC AD JS JD 3S 3C 3D
- `self|259|68` 座2 13张 敌最少2 对家12 级8 上手=fullhouse:7 → **bomb:9{9D 9H 9C 9D}** [noWasteJ,forceFinish:likely]<br>手牌: AS AH AH KS KS KC KD 9H 9H 9C 9C 9D 9D

### 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）

全部通过


### 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸）

不分有无孤张：还的点数手里原有 ≥2 张 329/887 (37%)（有的是顺子里多出的一张，拆牌计划认为更便宜）；还 >10 的牌（手里没有 ≤10，兜底）：0/887 (0%)


### Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5

分类：lead/mid/otherPlay 3，lead/early/otherPlay 1，enemy/late/shouldPass 1，partner/mid/passed 1，partner/early/otherPlay 1

- `self|2003|7` lead 22张 张数22/22/22/22 级J 上手=pass<br>decide: **fullhouse:3{3H 3C 3C 6H 6D}** (-0.28) [fhAttach,control,planWeakFirst] vs **fullhouse:3{3H 3C 3C 9C 9H}** (+1.22, t=3.1, n=36)<br>手牌: 6H 8H 9C 6D 8C 5D 9H 5C KC AD 8S 3H 10D 3C AS 7H KH 8H 10D AS 3C RJ
- `self|835|17` lead 15张 张数15/26/26/21 级4 上手=pass<br>decide: **fullhouse:10{10D 10C 10S KD KD}** (-0.14) [fhAttach,leadSmallSame,control,planWeakFirst] vs **fullhouse:10{10D 10C 10S 9S 9S}** (+1.22, t=3.1, n=36)<br>手牌: 6D 9S KD 10D 9S 9H KD 10C 9C 9D 6C 6D 10S 6H 9H
- `self|257|95` enemy 9张 张数1/0/8/9 级8 上手=bomb:3<br>decide: **bomb:6{6C 6S 6D 6H}** (1.69) [mustBomb] vs **pass** (+1.19, t=17.9, n=36)<br>手牌: 6C 9C 9D 6S 6D 6H 6H RJ JS
- `self|81|43` lead 11张 张数24/11/18/17 级9 上手=pass<br>decide: **pair:RJ{RJ RJ}** (0.69) [leadSmallSame,control] vs **bomb:10{10S 10D 10H 10C 10H}** (+1.00, t=3.1, n=36)<br>手牌: RJ 10S QS QS 10D 10H RJ QD QC 10C 10H
- `self|1687|65` lead 13张 张数18/13/18/12 级A 上手=pass<br>decide: **pair:8{8C 8S}** (0.81) [control,planWeakFirst] vs **pair:A{AS AC}** (+0.94, t=2.9, n=36)<br>手牌: 9C AS 9H 10D 8C 10S 9H 10D 8S RJ AC 10S RJ
- `self|341|54` partner 10张 张数9/10/21/6 级A 上手=fullhouse:7<br>decide: **pass** (-0.83) [] vs **fullhouse:10{10S 10D 10D AD AC}** (+0.89, t=2.6, n=36)<br>手牌: AD 10S 10D 6S 10D 6H AH AC 6D 7S
- `self|103|86` partner 21张 张数21/2/2/0 级5 上手=single:9<br>decide: **single:RJ{RJ}** (-1.89) [noSFon8,followUp] vs **single:5{5C}** (+0.81, t=12.0, n=36)<br>手牌: 8H AC 8D 2S AS 9S 6H 2D 8S 3D AS AD AH 2C 8D 5C 6H 3D 8S 9C RJ
