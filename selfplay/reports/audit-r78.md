# 自对局体检报告

生成：2026/10/28 15:12:50（Asia/Shanghai）　policy：current　用时 744s

对局：【进贡比赛模式，每场 8 副】自对局 400 副（四家 decide），混合对手 Random、Greedy、Old:pre-activity、Old:pre-round6 各 20×2 副（换座位）；逐手记录 51175 条；surprise 局面 120 个。

局面 id 可复现：`node selfplay/audit.mjs --replay='<id>'`（cfg|seed|step）。

## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）

无红旗。


## 全部检测器

| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |
|---|---|---|---|---|---|
| 早中盘领出小单（≤10）后两个敌家都不跟 | 0.9% | 940 | ≤25% | 6.6% | OK |
| 早中盘领出小对（≤10）后两个敌家都不跟 | 2.4% | 425 | ≤35% | 11.9% | OK |
| 跟敌人牌过牌率（early，有牌可出时） | 43.8% | 6844 | ≥30 且 ≤62% | 52.0% | OK |
| 跟敌人牌过牌率（mid，有牌可出时） | 40.9% | 7323 | ≥30 且 ≤65% | 56.5% | OK |
| 跟敌人牌过牌率（late，有牌可出时） | 28.7% | 3209 | ≥20 且 ≤75% | 38.1% | OK |
| 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率 | 7.2% | 3395 | ≤35% | 20.5% | OK |
| 压对家的牌（early，有牌可压时） | 0.0% | 1889 | ≤15% | 0.0% | OK |
| 压对家的牌（mid，有牌可压时） | 0.4% | 2035 | ≤15% | 0.2% | OK |
| 压对家的牌（late，有牌可压时） | 18.0% | 1015 | ≤30% | 12.1% | OK |
| 炸对家（未因此走完） | 0.0% | 4367 | ≤2% | 0.0% | OK |
| 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌 | 23.5% | 17 | ≤60% | 62.1% | 样本少 |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 2.2% | 1454 | ≤15% | 15.7% | OK |
| 敌家都 ≥10 张时领出炸弹（非走完） | 1.6% | 2275 | ≤10% | 6.9% | OK |
| 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌 | 4.2% | 238 | ≤45% | 3.2% | OK |
| 输家结束时手里还留着炸弹（每个输家座位） | 4.4% | 800 | ≤20% | 6.8% | OK |
| 输家结束时还握着 ≥2 张王/级牌 | 3.9% | 800 | ≤25% | 7.3% | OK |
| 末游卡手（结束时 ≥8 张且至少还要 5 手） | 0.0% | 400 | ≤25% | 0.0% | OK |
| 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10） | 2.6% | 2036 | ≤8% | 1.5% | OK |
| 早盘领出 A/级牌/王的单对 | 0.0% | 410 | ≤12% | 0.5% | OK |
| 拆炸弹领出 | 0.1% | 5109 | ≤2% | 0.3% | OK |
| 早盘拆对领单（手里有顺子/连对/钢板可出） | 0.0% | 179 | ≤15% | 0.7% | OK |
| 早盘领出对子占比 | 14.8% | 1334 | ≥5% | 12.1% | OK |
| 早盘领出单张占比 | 16.0% | 1334 | ≥15 且 ≤55% | 18.7% | OK |
| 一手能出完却没出完 | 0.0% | 1004 | ≤1% | 0.0% | OK |
| decide 用时 >300ms 的比例 | 0.0% | 42546 | ≤0.5% | 0.0% | OK |
| 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测） | 0.000 | 592 | ≤0 | 0.000 | OK |
| 对 Random 每副净升级 | 3.000 | 48 | ≥1.5 | 2.908 | OK |
| 对 Greedy 每副净升级 | 2.854 | 48 | ≥0.5 | 2.422 | OK |
| 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸） | 37.5% | 363 | ≤50% | 35.5% | OK |
| Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5 | 5.0% | 120 | ≤5% | 8.8% | OK |

## 队伍结果

- 自对局 400 副：南北队每副净升级 -0.140 [-0.367, 0.087]（应≈0），双下率 46.3%，平均每副 87 手
- 各座位平均名次（南/东/北/西）：2.56 / 2.40 / 2.52 / 2.52
- decide vs Random：48 副，胜 48/48 (100%)，每副净升级 3.000 [3.000, 3.000]
- decide vs Greedy：48 副，胜 47/48 (98%)，每副净升级 2.854 [2.627, 3.082]
- decide vs Old:pre-activity：48 副，胜 47/48 (98%)，每副净升级 2.188 [1.879, 2.496]
- decide vs Old:pre-round6：48 副，胜 46/48 (96%)，每副净升级 2.229 [2.082, 2.376]

## 进贡

- 进贡比赛 74 场共 592 副；需进贡的副 464：单贡 219（抗贡 9/219 (4%)，理论≈6%），双下双贡 245（抗贡 60/245 (24%)，理论≈25%；贡牌同点 33）
- 贡牌分布：RJ 38%，BJ 29%，A 10%，8 4%，5 3%，9 3%，J 3%，Q 2%，K 2%，10 2%，6 1%，7 1%，3 1%，4 1%
- 自对局还贡点数分布（decide）：2 20%，3 16%，4 14%，5 10%，7 10%，6 10%，8 7%，10 7%，9 6%
- 自对局进贡副（未抗贡）进贡方每副净升级 -0.261 [-0.532, 0.010]（n=276；负 = 输家进贡后仍吃亏）
- 自对局抗贡副 抗贡方每副净升级 0.205 [-0.495, 0.904]（n=44）
- 进贡不变量（贡牌=最大非逢人配、双下大贡归头游/同点头游下家、抗贡判定、还贡≤10、先出者、交换后各 27 张、牌守恒）：全部通过（检查 592 副）

## 详情与示例局面

### 早中盘领出小单（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：8/8 (100%)

- `self|284800133|50` 座1 25张 敌最少10 对家9 级Q 上手=single:10 → **pass** []<br>手牌: QS QS QC QD JS JH JC JD JD 8S 8H 8C 8D 7H 7H 7C 7D 6C 5H 5D 4C 4D 3H 3C 2C
- `self|284800164|62` 座0 11张 敌最少9 对家12 级Q 上手=single:8 → **pass** [noSFon8]<br>手牌: QH AS AH AC AC 8H 8H 8D 3H 3C 2S
- `self|284800289|77` 座0 10张 敌最少11 对家10 级6 上手=single:7 → **pass** [passiveEarly]<br>手牌: 6H KS KC 10S 10H 10C 5S 5H 5C 5D
- `self|284800464|81` 座2 13张 敌最少9 对家9 级2 上手=single:6 → **pass** []<br>手牌: 10S 10S 10H 10H 5S 5S 5H 5C 5C 4S 4S 4H 4D
- `self|284800582|42` 座2 12张 敌最少11 对家17 级A 上手=single:8 → **pass** [noSFon8]<br>手牌: KS KS KD KD QS QH QH QD QD 2S 2S 2C

### 早中盘领出小对（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：10/10 (100%)

- `self|284800116|42` 座2 22张 敌最少11 对家9 级Q 上手=pair:8 → **pass** []<br>手牌: QH QD AD JC JC 10S 10H 9H 6S 6H 6C 5S 5H 5C 5C 4H 4C 3C 2H 2C 2C 2D
- `self|284800229|58` 座3 15张 敌最少6 对家8 级6 上手=pair:9 → **pass** []<br>手牌: 6H QS QH QC QD 8S 8S 7S 7S 7H 7C 7D 5C 5D 3H
- `self|284800512|36` 座0 21张 敌最少14 对家14 级5 上手=pair:3 → **pass** []<br>手牌: RJ 5C 5C 5D 5D AS AS AC AD KC QS JS JC 10H 10C 9H 9D 4C 2C 2C 2D
- `self|284800672|39` 座0 13张 敌最少12 对家12 级2 上手=pair:5 → **pass** []<br>手牌: RJ BJ 2D AS QH QC QC QD 10S 5S 5S 5H 5C
- `self|284800722|38` 座1 21张 敌最少12 对家15 级6 上手=pair:9 → **pass** []<br>手牌: 6H 6C 6D KS KH KC KD QD JS JH JC JD 8H 8H 8C 5S 5H 5C 4D 3S 2H

### 跟敌人牌过牌率（early，有牌可出时）

- `self|284800000|1` 座0 27张 敌最少22 对家27 级Q 上手=straight:8 → **pass** []<br>手牌: RJ QH QD AS AH AC KH 10C 9H 9H 8H 8C 7S 7S 7H 7C 7C 6H 6D 5D 5D 4H 4C 4D 3S 2S 2D
- `self|284800134|15` 座1 25张 敌最少17 对家24 级K 上手=single:Q → **pass** []<br>手牌: KD AS AH AC QS QC 10S 10S 10D 9S 9S 9D 8D 7H 7C 6S 6D 5S 5S 5H 5C 3C 2S 2H 2D
- `self|284800293|25` 座0 25张 敌最少18 对家17 级6 上手=pair:Q → **pass** []<br>手牌: RJ 6C 6C AH QS QC QD JH JD 10C 9H 8C 7H 7D 7D 4H 4D 3H 3C 3C 3D 2H 2C 2D 2D
- `self|284800439|19` 座1 22张 敌最少16 对家20 级5 上手=fullhouse:K → **pass** []<br>手牌: RJ 5D AS AH AC AC 9H 9C 9D 8S 8S 8H 8C 8D 8D 4S 4H 4C 4D 3S 3D 3D
- `self|284800642|5` 座1 25张 敌最少23 对家25 级2 上手=pair:J → **pass** []<br>手牌: RJ BJ 2S 2D 2D AS AC AC KS KH KD QD JD 10S 10H 10C 9S 9H 8H 7C 7D 6H 4H 3H 3C

### 跟敌人牌过牌率（mid，有牌可出时）

- `self|284800001|19` 座0 12张 敌最少18 对家25 级A 上手=fullhouse:Q → **pass** []<br>手牌: AH AC AD KC JD 8S 7C 7C 6D 4S 4H 4H
- `self|284800150|34` 座0 13张 敌最少16 对家14 级5 上手=pair:K → **pass** []<br>手牌: 5H AH AC AD KH KC JC 10C 8D 2S 2S 2C 2D
- `self|284800293|54` 座1 12张 敌最少11 对家14 级6 上手=single:K → **pass** []<br>手牌: AS AC AC AD QH QC 10S 10H 10C 10D 5H 5C
- `self|284800464|11` 座0 17张 敌最少22 对家27 级2 上手=straight:9 → **pass** []<br>手牌: 2H 2S 2S 2C 2D AH KD QH JS 9S 9H 9C 9D 7C 7D 3S 3H
- `self|284800645|51` 座1 16张 敌最少8 对家7 级8 上手=triple:5 → **pass** []<br>手牌: 8H 8H KS KC 10H 9S 6S 6H 6C 6C 4S 4C 4D 4D 3D 3D

### 跟敌人牌过牌率（late，有牌可出时）

- `self|284800001|64` 座1 9张 敌最少8 对家9 级A 上手=single:Q → **pass** []<br>手牌: AH JC JD 10C 6C 4S 4C 4C 4D
- `self|284800183|60` 座1 8张 敌最少8 对家11 级3 上手=single:A → **pass** []<br>手牌: 3H 9C 9C 8S 8C 8C 8D 8D
- `self|284800320|76` 座3 9张 敌最少6 对家10 级6 上手=single:Q → **pass** []<br>手牌: 6H QS QS QC JS JH 5H 5C 5D
- `self|284800484|71` 座3 9张 敌最少6 对家8 级8 上手=single:A → **pass** []<br>手牌: 8H KS KS KD 5H 5C 5D 4H 4C
- `self|284800615|56` 座2 3张 敌最少8 对家24 级9 上手=single:A → **pass** []<br>手牌: 9H AC QC

### 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率

按座位 南/东/北/西：65/831 (8%) / 73/834 (9%) / 62/893 (7%) / 45/837 (5%)

- `self|284800006|28` 座2 18张 敌最少13 对家17 级7 上手=pair:10 → **pass** [r14NoPass]<br>手牌: BJ 7H AS AH AH AC AC KD QS JS 10H 10C 10D 3S 3S 3D 2C 2C
- `self|284800134|45` 座3 13张 敌最少13 对家19 级K 上手=pair:10 → **pass** []<br>手牌: KH KC JC 5H 5C 5D 5D 4S 4H 4H 4D 3D 3D
- `self|284800294|30` 座1 24张 敌最少15 对家12 级10 上手=single:A → **pass** []<br>手牌: 10H 10S 10C AC KH KH KC JS JH 8C 8D 7H 7H 7D 6S 6H 6D 5H 5C 5D 3S 3H 2S 2C
- `self|284800464|81` 座2 13张 敌最少9 对家9 级2 上手=single:6 → **pass** []<br>手牌: 10S 10S 10H 10H 5S 5S 5H 5C 5C 4S 4S 4H 4D
- `self|284800677|61` 座3 14张 敌最少8 对家9 级9 上手=single:7 → **pass** []<br>手牌: 9H AH AC AD KS KH KD KD 8S 8S 8H 8C 3C 3D

### 压对家的牌（mid，有牌可压时）

- `self|284800069|62` 座0 10张 敌最少1 对家5 级4 上手=single:4 → **single:BJ{BJ}** [followUp,blockSure]<br>手牌: BJ 4C KS 9C 9C 7H 7C 7C 6C 6D
- `self|284800129|78` 座0 11张 敌最少1 对家0 级10 上手=single:A → **single:RJ{RJ}** [followUp,blockSure]<br>手牌: RJ 10H AS AC AC AD QH 6H 6C 6D 4H
- `self|284800308|52` 座2 11张 敌最少2 对家5 级8 上手=pair:5 → **pair:A{AC AS}** [keepStruct]<br>手牌: 8S AS AC AD 10H 5H 4H 4C 2S 2H 2C
- `self|284800375|62` 座0 10张 敌最少16 对家12 级10 上手=fullhouse:2 → **fullhouse:3{3H 3D 3S 2S 2C}** []<br>手牌: JH JC JD 5S 5H 3S 3H 3D 2S 2C
- `self|284800423|57` 座3 10张 敌最少10 对家14 级6 上手=fullhouse:7 → **fullhouse:9{9D 9C 9H 10H 10C}** []<br>手牌: QH QD JS JS JD 10H 10C 9H 9C 9D

### 压对家的牌（late，有牌可压时）

- `self|284800001|83` 座3 1张 敌最少6 对家2 级A 上手=single:6 → **single:Q{QH}** [goOut]<br>手牌: QH
- `self|284800130|76` 座3 2张 敌最少2 对家0 级J 上手=single:Q → **single:J{JH}** [followUp,strongBeforeLast,forceFinish:sure]<br>手牌: JH 10D
- `self|284800321|92` 座3 6张 敌最少8 对家4 级9 上手=single:7 → **single:Q{QS}** [followUp,strongBeforeLast]<br>手牌: QS 10H 10C 6S 6H 6H
- `self|284800437|61` 座1 3张 敌最少16 对家13 级10 上手=triple:8 → **triple:10{10D 10S 10H}** [goOut]<br>手牌: 10H 10S 10D
- `self|284800631|90` 座2 6张 敌最少10 对家4 级5 上手=single:J → **single:K{KC}** [followUp,strongBeforeLast]<br>手牌: KS KC KD JS JC JD

### 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌

旧口径（含拆炸/只有炸弹可压）：4/17 (24%)；其中不拆三张也能压：4/16 (25%)；只能拆三张才能压：0/1 (0%)

- `self|284800131|64` 座3 4张 敌最少3 对家8 级8 上手=single:8 → **pass** [noSFon8,可压:single:BJ{BJ}]<br>手牌: BJ 8D AC AC
- `self|284800131|67` 座3 4张 敌最少3 对家6 级8 上手=pair:7 → **pass** [可压:pair:A{AC AC}]<br>手牌: BJ 8D AC AC
- `self|284800211|81` 座3 6张 敌最少3 对家5 级A 上手=pair:7 → **pass** [可压:pair:9{9S 9D}]<br>手牌: 9S 9D 5S 5H 4S 4C
- `self|284800353|49` 座3 4张 敌最少3 对家8 级10 上手=single:4 → **pass** [可压:single:BJ{BJ} / single:7{7C} / single:Q{QH}]<br>手牌: BJ AD QH 7C

### 敌家都 ≥15 张时炸普通牌（占跟牌炸弹）

每副炸弹数（自对局，四人合计）：早 0.87 / 中 2.71 / 晚 2.11

- `self|284800021|70` 座1 11张 敌最少17 对家12 级6 上手=single:A → **bomb:2{2S 2S 2C 2D}** [mustBomb]<br>手牌: KS KC QH QC 5H 5H 5D 2S 2S 2C 2D
- `self|284800133|65` 座3 8张 敌最少18 对家25 级Q 上手=single:J → **bomb:2{2S 2S 2H 2C}** [mustBomb,forceFinish:bombBack]<br>手牌: 9S 9H 9C 9D 2S 2S 2H 2C
- `self|284800259|70` 座0 15张 敌最少15 对家11 级9 上手=fullhouse:3 → **bomb:7{7H 7C 7C 7D}** [noWasteJ,mustBomb]<br>手牌: 9S AH 8S 8H 8H 8D 7H 7C 7C 7D 6H 5D 5D 4H 4C
- `self|284800354|60` 座3 20张 敌最少16 对家3 级K 上手=pairSeq:K → **bomb:9{9D 9D 9C 9H}** [mustBomb]<br>手牌: KC KD AC QH QC JD 9H 9C 9D 9D 8C 8D 8D 7S 6S 6H 6D 5S 4H 4C
- `self|284800548|65` 座3 15张 敌最少15 对家9 级9 上手=single:BJ → **bomb:6{6C 6D 6S 6H}** [mustBomb]<br>手牌: AS AS AC KS KC KD JS 7D 7D 6S 6H 6C 6D 5S 5D

### 敌家都 ≥10 张时领出炸弹（非走完）

炸压炸占跟牌炸弹：592/2046 (29%)

- `self|284800021|58` 座2 9张 敌最少12 对家19 级6 上手=pass → **bomb:7{7D 7H 7C 7S}** [bombClear,control]<br>手牌: 6H 8S 8H 8C 8C 7S 7H 7C 7D
- `self|284800166|74` 座3 8张 敌最少10 对家10 级A 上手=pass → **bomb:10{10S 10D 10H 10C}** [bombClear,control]<br>手牌: QS QH QC QD 10S 10H 10C 10D
- `self|284800327|39` 座2 14张 敌最少20 对家17 级5 上手=pass → **bomb:10{10S 10H 10C 10D}** [bombClear,control,bombOversize]<br>手牌: 5H 5H KS QS JC 10S 10H 10C 10D 3S 3S 3H 3C 3D
- `self|284800416|78` 座0 8张 敌最少10 对家17 级Q 上手=pass → **bomb:9{9H 9C 9S 9C}** [bombClear,control]<br>手牌: JH JC JD JD 9S 9H 9C 9C
- `self|284800691|59` 座3 10张 敌最少11 对家24 级7 上手=pass → **bomb:3{3S 3H 3H 3C}** [bombClear,control]<br>手牌: 7H 7S 5S 5H 5D 5D 3S 3H 3H 3C

### 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌

- `self|284800096|74` 座2 6张 敌最少3 对家10 级5 上手=pair:K → **pass** []<br>手牌: 5H 10H 10C 10D 4C 3S
- `self|284800449|71` 座1 7张 敌最少2 对家2 级A 上手=pair:J → **pass** []<br>手牌: AH 9D 5S 5D 2S 2H 2D
- `self|284800550|61` 座1 11张 敌最少3 对家7 级A 上手=fullhouse:8 → **pass** []<br>手牌: AS KS KD 8S 8H 8C 8D 3S 3C 3C 3D
- `self|284800674|60` 座1 12张 敌最少1 对家5 级5 上手=pair:A → **pass** [mustBomb,r23KeepExitBomb]<br>手牌: 5H AD QS QS QC QD 7S 7S 4S 4H 3C 3D
- `self|284800720|60` 座3 16张 敌最少2 对家3 级5 上手=single:K → **pass** []<br>手牌: KC KD KD JS JH JC 9S 9H 9D 9D 7S 7H 7C 7D 6C 6D

### 输家结束时手里还留着炸弹（每个输家座位）

- `self|284800033` 座0 结束时手里：10S 2H QH QC 10C 10H QD 4C 6C 4S
- `self|284800037` 座3 结束时手里：2D 2S 10D 7S 2C 2D QH KH 7C 3C 3S 10H 3D 3D
- `self|284800053` 座0 结束时手里：10C 10D 10H 10S KC
- `self|284800055` 座1 结束时手里：10C 5D 8H 10D 5C 10S 10H 5H 5H 8C JD 8D
- `self|284800055` 座3 结束时手里：KH KC KD 4D 4H KS 4C 7C 3H

### 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10）

- `self|284800038|51` 座1 22张 敌最少20 对家4 级J 上手=single:5 → **single:J{JD}** [stopShort,followUp,followSize]<br>手牌: JS JC JD AS AD KS KH QS QH QC QC 9S 9H 9D 7C 7D 6S 6D 2S 2S 2H 2C
- `self|284800118|35` 座3 21张 敌最少6 对家8 级10 上手=single:A → **single:10{10S}** [followUp,breakNoOrphan,followSize,keepControl,r28MidFollow]<br>手牌: 10H 10S AH AH KS KH KC KD QC 9S 9C 7S 7C 6S 6H 6C 4S 3S 3H 3D 2C
- `self|284800225|84` 座1 20张 敌最少6 对家8 级A 上手=single:10 → **single:A{AH}** [stopShort,followUp,followSize]<br>手牌: AH KS KH KC KC QS QS QH JS JS JH 10H 10D 4S 4D 4D 2S 2H 2C 2D
- `self|284800423|51` 座1 20张 敌最少10 对家10 级6 上手=single:9 → **single:BJ{BJ}** [noSFon8,followUp,breakNoOrphan,followSize,keepControl,r28MidFollow]<br>手牌: BJ BJ 6H 6S KS KH KC KD 9S 9S 9C 7S 7H 7D 5S 5S 4H 4D 3S 3C
- `self|284800592|7` 座2 26张 敌最少25 对家26 级10 上手=single:A → **single:RJ{RJ}** [followUp,followSize,keepControl,r50NextFollow]<br>手牌: RJ 10S 10C 10D AS QS QS QC JS JS 9S 9D 8S 8C 8D 6S 6S 6C 5S 5H 5D 4H 4C 4D 2C 2C

### 拆炸弹领出

- `self|284800103|10` 座3 21张 敌最少16 对家22 级A 上手=pass → **straight:9{5D 6S 7S 8D 9D}** [bombBreakNoGain,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: AH KH KD QD 9D 8S 8C 8D 8D 7S 6S 5D 4H 4D 3S 3C 3D 3D 2S 2H 2D
- `self|284800385|0` 座3 27张 敌最少27 对家27 级J 上手=pass → **straight:8{4S 5H 6H 7H 8C}** [noFirstBomb,bombBreakNoGain,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: BJ JS JS AS AC KS KC KD 10S 10H 10C 10D 9H 9C 8C 7H 6H 5S 5S 5H 5D 4S 3H 3C 3D 2S 2H
- `self|284800551|15` 座3 22张 敌最少17 对家17 级2 上手=pass → **straight:10{6D 7H 8H 9S 10H}** [bombBreakNoGain,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: RJ 2S KH KD QS QH QH JS JH JC JD 10H 9S 8H 7S 7H 7C 7D 6D 5H 5C 4C

### 早盘领出单张占比

早盘领出牌型分布：straight 21%，pairSeq 19%，single 16%，fullhouse 16%，pair 15%，tripleSeq 11%，triple 2%；熵 2.66 bit


### decide 用时 >300ms 的比例

p50 1.4ms，p90 16.1ms，p99 53.7ms，max 274.4ms


### 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）

全部通过


### 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸）

不分有无孤张：还的点数手里原有 ≥2 张 152/379 (40%)（有的是顺子里多出的一张，拆牌计划认为更便宜）；还 >10 的牌（手里没有 ≤10，兜底）：0/379 (0%)


### Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5

分类：enemy/mid/otherPlay 2，lead/late/otherPlay 1，partner/late/passed 1，partner/early/passed 1，lead/mid/otherPlay 1

- `self|284800198|34` enemy 19张 张数15/20/9/19 级2 上手=tripleSeq:6<br>decide: **bomb:4{4H 4H 4S 4D}** (-0.22) [] vs **bomb:4{4H 4H 4S 2H}** (+1.72, t=4.9, n=36)<br>手牌: 3D AD 4H 8S AS 4H 4S AS RJ 5D 2H 2C 2S 4D 9H 10S 5S 5S 4C
- `self|284800470|90` lead 9张 张数2/5/9/15 级A 上手=pass<br>decide: **pair:Q{QS QS}** (0.64) [feedPartnerPair,control] vs **single:10{10C}** (+1.58, t=5.2, n=36)<br>手牌: KC KH QS KS QS JH 6S 10C KC
- `self|284800197|67` partner 5张 张数1/5/15/3 级A 上手=single:Q<br>decide: **pass** (0.22) [] vs **single:K{KS}** (+1.42, t=4.4, n=36)<br>手牌: QD AH 2H RJ KS
- `self|284800084|58` partner 20张 张数19/6/7/20 级K 上手=single:6<br>decide: **pass** (0.33) [] vs **bomb:10{10D 10D 10C 10S}** (+1.36, t=4.4, n=36)<br>手牌: 10D 10D KC 4H 2S KS 9H 7C KD 10C 4D 8H 10S 8D KC 9D 2C 3D 7S 3S
- `self|284800466|55` enemy 12张 张数14/12/12/8 级8 上手=single:2<br>decide: **single:K{KC}** (0.72) [followUp,followSize,activeFollow:0] vs **single:Q{QH}** (+1.00, t=3.0, n=36)<br>手牌: KC JS 2H JD QH 2H 4C JC QS 2S 4H 2D
- `self|284800067|70` lead 13张 张数1/13/2/3 级9 上手=pass<br>decide: **single:3{3S}** (1.00) [control] vs **single:A{AD}** (+0.78, t=4.7, n=36)<br>手牌: 4C JD 10D 4S 10C 4H AD RJ 3S 4H 4S 10C BJ
