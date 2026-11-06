# 自对局体检报告

生成：2026/10/27 01:24:43（Asia/Shanghai）　policy：current　用时 1469s

对局：【进贡比赛模式，每场 8 副】自对局 600 副（四家 decide），混合对手 Random、Greedy、Old:pre-activity、Old:pre-round6 各 0×2 副（换座位）；逐手记录 51786 条；surprise 局面 400 个。

局面 id 可复现：`node selfplay/audit.mjs --replay='<id>'`（cfg|seed|step）。

## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）

- **早盘领出单张占比**：15.0%（n=1986，合理区间 ≥15 且 ≤55%，严重度 0.0）

## 全部检测器

| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |
|---|---|---|---|---|---|
| 早中盘领出小单（≤10）后两个敌家都不跟 | 1.5% | 1416 | ≤25% | 6.6% | OK |
| 早中盘领出小对（≤10）后两个敌家都不跟 | 4.3% | 632 | ≤35% | 11.9% | OK |
| 跟敌人牌过牌率（early，有牌可出时） | 44.8% | 10412 | ≥30 且 ≤62% | 52.0% | OK |
| 跟敌人牌过牌率（mid，有牌可出时） | 40.6% | 10539 | ≥30 且 ≤65% | 56.5% | OK |
| 跟敌人牌过牌率（late，有牌可出时） | 32.3% | 4881 | ≥20 且 ≤75% | 38.1% | OK |
| 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率 | 8.2% | 5050 | ≤35% | 20.5% | OK |
| 压对家的牌（early，有牌可压时） | 0.0% | 2922 | ≤15% | 0.0% | OK |
| 压对家的牌（mid，有牌可压时） | 0.2% | 2896 | ≤15% | 0.2% | OK |
| 压对家的牌（late，有牌可压时） | 16.0% | 1522 | ≤30% | 12.1% | OK |
| 炸对家（未因此走完） | 0.0% | 6539 | ≤2% | 0.0% | OK |
| 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌 | 53.3% | 15 | ≤60% | 62.1% | 样本少 |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 4.1% | 2146 | ≤15% | 15.7% | OK |
| 敌家都 ≥10 张时领出炸弹（非走完） | 1.4% | 3455 | ≤10% | 6.9% | OK |
| 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌 | 3.9% | 308 | ≤45% | 3.2% | OK |
| 输家结束时手里还留着炸弹（每个输家座位） | 4.0% | 1200 | ≤20% | 6.8% | OK |
| 输家结束时还握着 ≥2 张王/级牌 | 5.0% | 1200 | ≤25% | 7.3% | OK |
| 末游卡手（结束时 ≥8 张且至少还要 5 手） | 0.0% | 600 | ≤25% | 0.0% | OK |
| 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10） | 1.5% | 3170 | ≤8% | 1.5% | OK |
| 早盘领出 A/级牌/王的单对 | 0.0% | 598 | ≤12% | 0.5% | OK |
| 拆炸弹领出 | 0.1% | 7715 | ≤2% | 0.3% | OK |
| 早盘拆对领单（手里有顺子/连对/钢板可出） | 0.8% | 253 | ≤15% | 0.7% | OK |
| 早盘领出对子占比 | 15.2% | 1986 | ≥5% | 12.1% | OK |
| 早盘领出单张占比 | 15.0% | 1986 | ≥15 且 ≤55% | 18.7% | 🚩 |
| 一手能出完却没出完 | 0.0% | 1528 | ≤1% | 0.0% | OK |
| decide 用时 >300ms 的比例 | 0.0% | 51786 | ≤0.5% | 0.0% | OK |
| 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测） | 0.000 | 600 | ≤0 | 0.000 | OK |
| 对 Random 每副净升级 | 0.000 | 0 | ≥1.5 | 2.908 | OK |
| 对 Greedy 每副净升级 | 0.000 | 0 | ≥0.5 | 2.422 | OK |
| 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸） | 33.3% | 523 | ≤50% | 35.5% | OK |
| Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5 | 4.5% | 400 | ≤5% | 8.8% | OK |

## 队伍结果

- 自对局 600 副：南北队每副净升级 0.020 [-0.160, 0.200]（应≈0），双下率 42.3%，平均每副 86 手
- 各座位平均名次（南/东/北/西）：2.54 / 2.50 / 2.45 / 2.51
- decide vs Random：0 副，胜 0/0 (0%)，每副净升级 0.000 [0.000, 0.000]
- decide vs Greedy：0 副，胜 0/0 (0%)，每副净升级 0.000 [0.000, 0.000]
- decide vs Old:pre-activity：0 副，胜 0/0 (0%)，每副净升级 0.000 [0.000, 0.000]
- decide vs Old:pre-round6：0 副，胜 0/0 (0%)，每副净升级 0.000 [0.000, 0.000]

## 进贡

- 进贡比赛 75 场共 600 副；需进贡的副 485：单贡 292（抗贡 27/292 (9%)，理论≈6%），双下双贡 193（抗贡 51/193 (26%)，理论≈25%；贡牌同点 17）
- 贡牌分布：RJ 35%，BJ 28%，A 11%，8 4%，Q 3%，5 3%，J 3%，7 3%，6 2%，9 2%，K 2%，3 1%，4 1%，10 1%
- 自对局还贡点数分布（decide）：2 24%，4 15%，3 14%，5 12%，6 8%，7 8%，10 7%，8 6%，9 6%
- 自对局进贡副（未抗贡）进贡方每副净升级 -0.233 [-0.450, -0.017]（n=407；负 = 输家进贡后仍吃亏）
- 自对局抗贡副 抗贡方每副净升级 -0.154 [-0.666, 0.358]（n=78）
- 进贡不变量（贡牌=最大非逢人配、双下大贡归头游/同点头游下家、抗贡判定、还贡≤10、先出者、交换后各 27 张、牌守恒）：全部通过（检查 600 副）

## 详情与示例局面

### 🚩 早盘领出单张占比

早盘领出牌型分布：straight 21%，pairSeq 20%，fullhouse 16%，pair 15%，single 15%，tripleSeq 11%，triple 2%；熵 2.65 bit


### 早中盘领出小单（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：20/21 (95%)

- `self|57649|42` 座2 25张 敌最少13 对家8 级7 上手=single:6 → **pass** []<br>手牌: 7H 7D QS QS QH QH QC JS JH 10S 10H 9S 9H 6H 6C 5C 5D 4H 4C 4C 3H 2H 2H 2C 2D
- `self|57766|76` 座1 9张 敌最少10 对家10 级2 上手=single:10 → **pass** []<br>手牌: 2H JS JC JD JD 10S 10H 10C 10D
- `self|58032|68` 座0 10张 敌最少10 对家9 级2 上手=single:8 → **pass** [noSFon8]<br>手牌: 6S 6C 6C 4H 4C 4D 3S 3S 3H 3C
- `self|58279|50` 座3 12张 敌最少13 对家12 级7 上手=single:5 → **pass** []<br>手牌: 7H KS KH KC KC QH QC QD JC JC JD 3S
- `self|58438|68` 座0 13张 敌最少9 对家9 级5 上手=single:6 → **pass** []<br>手牌: AH AH AC AD AD 8S 8H 8H 8C 3S 3S 3C 3D

### 早中盘领出小对（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：26/27 (96%)

- `self|57667|33` 座1 24张 敌最少13 对家13 级7 上手=pair:4 → **pass** []<br>手牌: BJ BJ 7H AS QH QH QC QD 10H 10H 9S 9C 8S 8H 6C 4H 4D 4D 3C 3D 2S 2H 2C 2D
- `self|57858|17` 座0 23张 敌最少16 对家18 级5 上手=pair:6 → **pass** []<br>手牌: RJ 5C AD KS QC JS JS JH JC 10C 9H 8H 8C 7D 7D 6S 6H 4C 3S 3C 2S 2C 2C
- `self|57926|50` 座3 24张 敌最少12 对家9 级6 上手=pair:10 → **pass** []<br>手牌: 6C 6D AD KD QS QH QH QC QD JS 9C 9C 9D 9D 7H 7D 4S 4H 3D 3D 2S 2H 2C 2C
- `self|58146|43` 座2 11张 敌最少16 对家24 级Q 上手=pair:9 → **pass** []<br>手牌: RJ QH QS 10S 9C 6H 5S 5H 5H 5C 5D
- `self|58279|38` 座3 12张 敌最少14 对家13 级7 上手=pair:3 → **pass** []<br>手牌: 7H KS KH KC KC QH QC QD JC JC JD 3S

### 跟敌人牌过牌率（early，有牌可出时）

- `self|57600|5` 座0 26张 敌最少25 对家26 级A 上手=single:K → **pass** []<br>手牌: RJ AS AS KH KH JS JH 9H 9H 9C 9C 7C 7D 6D 5C 5D 4S 4H 4C 4D 4D 3S 3C 3C 2S 2D
- `self|57840|19` 座1 27张 敌最少15 对家10 级3 上手=fullhouse:2 → **pass** []<br>手牌: 3C 3D AH AC QH QC JS JC JC JD JD 10H 10D 9S 9H 9C 9D 7S 7H 7C 7D 6H 5S 5D 4S 2H 2C
- `self|58068|63` 座2 21张 敌最少3 对家2 级7 上手=fullhouse:Q → **pass** []<br>手牌: BJ BJ 7H 7H 7S KS QS QC QD 10C 8H 5S 5S 5H 5C 5D 4S 4D 4D 2S 2H
- `self|58321|25` 座1 25张 敌最少24 对家12 级9 上手=single:BJ → **pass** []<br>手牌: RJ RJ 9H AS AS KD KD QH QC JC JD JD 7D 6S 6C 4S 4H 4C 3H 3H 3C 2S 2H 2H 2C
- `self|58551|22` 座3 25张 敌最少22 对家16 级2 上手=single:Q → **pass** []<br>手牌: 2C 2C 2D AH AH AC AD KS KS KH KC KD QH 9S 8D 7C 7C 6H 5S 5D 5D 4S 4D 3H 3D

### 跟敌人牌过牌率（mid，有牌可出时）

- `self|57602|42` 座3 10张 敌最少3 对家20 级A 上手=fullhouse:6 → **pass** []<br>手牌: AH AC QC JH 7C 7D 3S 3C 2S 2D
- `self|57843|38` 座2 16张 敌最少13 对家8 级6 上手=pair:4 → **pass** []<br>手牌: 6H 6C 6D AS 5S 5C 5D 4S 4H 4H 4C 4D 3S 3D 2S 2C
- `self|58083|51` 座0 10张 敌最少4 对家11 级Q 上手=fullhouse:2 → **pass** []<br>手牌: RJ QC QD AS AH AC AD JS JS 5C
- `self|58290|45` 座0 10张 敌最少3 对家10 级6 上手=single:K → **pass** []<br>手牌: AS AH KH KC QC QD JC 9H 9C 9D
- `self|58561|54` 座2 18张 敌最少9 对家10 级J 上手=single:A → **pass** []<br>手牌: JH QD 10C 9D 8S 8H 8H 8C 6S 5S 5H 5H 5C 4H 3S 3H 3C 3C

### 跟敌人牌过牌率（late，有牌可出时）

- `self|57603|49` 座2 9张 敌最少8 对家12 级A 上手=single:J → **pass** []<br>手牌: AS AC 10S 10H 10D 9S 9S 9C 9D
- `self|57810|41` 座2 7张 敌最少9 对家25 级2 上手=single:A → **pass** []<br>手牌: 2H 2S AS AC 4S 4H 4C
- `self|58064|70` 座0 5张 敌最少5 对家5 级4 上手=single:Q → **pass** []<br>手牌: KS KC KC QS QD
- `self|58311|72` 座1 6张 敌最少4 对家8 级5 上手=triple:7 → **pass** []<br>手牌: 5H AS QS QS QH JD
- `self|58576|53` 座0 9张 敌最少4 对家16 级10 上手=single:K → **pass** []<br>手牌: 10H 10H 8S 8H 8C 8D 7S 5S 3D

### 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率

按座位 南/东/北/西：100/1269 (8%) / 99/1261 (8%) / 113/1267 (9%) / 102/1253 (8%)

- `self|57602|3` 座0 27张 敌最少25 对家25 级A 上手=pair:4 → **pass** []<br>手牌: RJ AS AS KH KC QC QD JS JS 10H 8S 8H 8H 8C 8D 7D 6C 5C 4S 4C 3C 3D 3D 2S 2H 2C 2D
- `self|57829|36` 座2 12张 敌最少13 对家23 级9 上手=single:10 → **pass** []<br>手牌: 9H 10S 10S 10H 10D 8D 6S 6H 6C 6D 5S 5C
- `self|58049|12` 座2 16张 敌最少20 对家26 级6 上手=single:8 → **pass** [noSFon8]<br>手牌: AH AD KS KC KC KD 9S 9C 9C 9D 7S 7S 3H 3H 2S 2D
- `self|58279|52` 座1 12张 敌最少13 对家12 级7 上手=single:5 → **pass** []<br>手牌: 7H AS AH AC AD 2S 2S 2H 2H 2C 2C 2D
- `self|58598|22` 座0 23张 敌最少15 对家19 级3 上手=pair:8 → **pass** []<br>手牌: RJ BJ 3S 3C 3D AD QH JS JD 10H 10H 9S 9H 8H 7H 6H 6C 6C 6D 5S 5H 5C 5D

### 压对家的牌（mid，有牌可压时）

- `self|57622|65` 座2 16张 敌最少1 对家0 级A 上手=single:A → **single:RJ{RJ}** [followUp,blockSure]<br>手牌: RJ AH JH 9S 8C 8D 8D 7D 6H 4S 4C 3S 3H 3C 2S 2C
- `self|58037|72` 座1 11张 敌最少1 对家0 级7 上手=single:A → **single:7{7S}** [followUp,blockSure]<br>手牌: 7S AH QS 8H 6S 4S 4C 4D 2H 2C 2D
- `self|58099|28` 座3 10张 敌最少17 对家22 级Q 上手=fullhouse:8 → **fullhouse:9{9S 9H 9C QD QH}** [keepWild,forceFinish:bombBack]<br>手牌: QH QD JS JH JC JC JD 9S 9H 9C
- `self|58225|71` 座3 10张 敌最少1 对家0 级2 上手=single:Q → **single:2{2S}** [followUp,blockSure]<br>手牌: 2S KS KD 10S 10C 10D 8H 8D 8D 7S
- `self|58256|72` 座0 10张 敌最少2 对家5 级3 上手=single:6 → **single:A{AH}** [followUp,forceFinish:sure]<br>手牌: 3H 3C 3C AH 5C 5D 4S 4C 2S 2D

### 压对家的牌（late，有牌可压时）

- `self|57600|79` 座2 4张 敌最少3 对家11 级A 上手=bomb:4 → **bomb:5{5S 5H 5C 5S}** [goOut]<br>手牌: 5S 5S 5H 5C
- `self|57825|72` 座0 7张 敌最少18 对家4 级4 上手=pair:6 → **pair:K{KD 4H}** [forceFinish:bombBack]<br>手牌: 4H KD 3S 3H 3C 3D 3D
- `self|58048|82` 座3 4张 敌最少1 对家1 级3 上手=single:7 → **single:A{AS}** [followUp,blockSure]<br>手牌: AS QH 7D 4S
- `self|58261|79` 座0 6张 敌最少9 对家6 级J 上手=single:7 → **single:K{KS}** [followUp,strongBeforeLast]<br>手牌: KS QC QD 7S 7H 7C
- `self|58528|74` 座3 6张 敌最少1 对家4 级7 上手=single:A → **single:7{7D}** [followUp,blockLikely]<br>手牌: 7D QH 10C 10D 9H 9D

### 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌

旧口径（含拆炸/只有炸弹可压）：8/15 (53%)；其中不拆三张也能压：8/15 (53%)；只能拆三张才能压：0/0 (0%)

- `self|57697|41` 座0 9张 敌最少3 对家24 级8 上手=single:8 → **pass** [noSFon8,可压:single:BJ{BJ} / single:RJ{RJ} / single:BJ{BJ}]<br>手牌: RJ BJ BJ AS KC 7H 7D 5S 5C
- `self|57860|51` 座3 6张 敌最少3 对家9 级8 上手=single:8 → **pass** [noSFon8,可压:single:RJ{RJ} / single:RJ{RJ}]<br>手牌: RJ RJ 8H 10S 3S 3D
- `self|57872|51` 座0 18张 敌最少3 对家6 级5 上手=single:7 → **pass** [可压:single:A{AH} / single:10{10H} / single:8{8S}]<br>手牌: 5S AH AC AC KS KD JS JH 10H 10D 9H 9C 8S 8C 7D 4S 4D 2D
- `self|57927|53` 座0 6张 敌最少1 对家8 级9 上手=pair:3 → **pass** [可压:pair:7{7C 7S} / pair:J{JC JH} / pair:7{7C 7D}]<br>手牌: RJ JH JC 7S 7C 7D
- `self|58179|67` 座2 6张 敌最少1 对家4 级5 上手=pair:3 → **pass** [可压:pair:5{5S 5S} / pair:5{5S 5H} / pair:K{KD 5H}]<br>手牌: RJ 5H 5S 5S KD 10H

### 敌家都 ≥15 张时炸普通牌（占跟牌炸弹）

每副炸弹数（自对局，四人合计）：早 0.95 / 中 2.73 / 晚 2.08

- `self|57601|65` 座0 15张 敌最少16 对家7 级A 上手=single:BJ → **bomb:2{2S 2D 2C 2C}** [mustBomb]<br>手牌: 8H 7S 7S 7C 6S 6C 6C 6D 5S 5C 5D 2S 2C 2C 2D
- `self|57825|68` 座2 10张 敌最少18 对家7 级4 上手=single:4 → **bomb:10{10H 10C 10H 4H}** [mustBomb]<br>手牌: 4H QH QD 10H 10H 10C 9S 9H 6C 6D
- `self|57975|38` 座2 11张 敌最少23 对家24 级7 上手=fullhouse:6 → **bomb:J{JH JD JD 7H}** [noWasteJ,mustBomb]<br>手牌: RJ 7H AH QH JH JD JD 10D 8S 5D 2D
- `self|58209|75` 座2 10张 敌最少19 对家5 级A 上手=single:10 → **bomb:3{3D 3S 3C 3H AH}** [mustBomb,forceFinish:likely]<br>手牌: AH QS QD 4S 4S 4D 3S 3H 3C 3D
- `self|58519|64` 座2 14张 敌最少16 对家4 级8 上手=single:RJ → **bomb:3{3S 3H 3D 3C}** [mustBomb]<br>手牌: 10C 6S 6H 6D 5H 4D 3S 3H 3C 3D 3D 2H 2C 2D

### 敌家都 ≥10 张时领出炸弹（非走完）

炸压炸占跟牌炸弹：924/3070 (30%)

- `self|57620|60` 座2 8张 敌最少11 对家20 级5 上手=pass → **bomb:2{2H 2C 2C 2D}** [bombClear,control]<br>手牌: 3S 3H 3C 3C 2H 2C 2C 2D
- `self|57845|29` 座3 12张 敌最少15 对家25 级10 上手=pass → **bomb:2{2S 2H 2C 2H}** [bombClear,control]<br>手牌: KH KH KC KC 7S 7H 7H 7C 2S 2H 2H 2C
- `self|58052|46` 座1 7张 敌最少22 对家15 级Q 上手=pass → **bomb:2{2H 2D 2S 2S}** [bombClear,control]<br>手牌: JS JD JD 2S 2S 2H 2D
- `self|58230|54` 座0 10张 敌最少13 对家12 级9 上手=pass → **bomb:3{3C 3S 3H 3D}** [bombClear,control]<br>手牌: BJ BJ JS JS JH JH 3S 3H 3C 3D
- `self|58503|57` 座3 12张 敌最少11 对家13 级A 上手=pass → **bomb:6{6C 6H 6S 6H}** [bombClear,control]<br>手牌: QS QC QD QD 7S 7S 7H 7D 6S 6H 6H 6C

### 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌

- `self|57810|77` 座0 7张 敌最少2 对家0 级2 上手=single:K → **pass** []<br>手牌: KS 10H 9H 9C 9D 9D 8D
- `self|57847|41` 座3 8张 敌最少2 对家21 级K 上手=triple:8 → **pass** []<br>手牌: BJ KH QH JD 4S 4H 4C 4D
- `self|57922|38` 座1 12张 敌最少3 对家12 级A 上手=pair:K → **pass** []<br>手牌: QH QH QC QC QD JC 9C 6H 6D 2H 2C 2D
- `self|58272|71` 座0 9张 敌最少3 对家3 级4 上手=fullhouse:9 → **pass** []<br>手牌: 4H JC 7S 7H 7H 7C 6S 5S 5D
- `self|58515|89` 座1 14张 敌最少2 对家2 级J 上手=pair:K → **pass** []<br>手牌: 9H 9H 9C 9D 8S 8H 8D 6S 6S 6H 6C 5C 4H 2D

### 输家结束时手里还留着炸弹（每个输家座位）

- `self|57616` 座1 结束时手里：7D 6H 7C 7C 10C 5S KD 10S 2D 6H 5S 7D AS
- `self|57617` 座1 结束时手里：9H 3C 4H 9H KC 9D KS 3S 10S 3S KD 10H KH 7H 4S 9C
- `self|57617` 座3 结束时手里：8D 6D 10D 6S 8H 8S 6H 10D 10S 10C
- `self|57664` 座2 结束时手里：4H KC 8H 4S 4C 5H KS 8H
- `self|57750` 座0 结束时手里：7C 3C 7S 7D 7H

### 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10）

- `self|57621|18` 座2 22张 敌最少12 对家15 级Q 上手=pair:10 → **pair:Q{QC QD}** [followSize,keepControlPair,r28MidFollow]<br>手牌: BJ QH QC QD 10S 10H 10C 9S 9H 9C 9D 8S 8H 8C 8D 6D 5S 5H 5D 4D 3S 2C
- `self|57845|22` 座0 24张 敌最少13 对家15 级10 上手=single:10 → **single:BJ{BJ}** [followUp,followSize,keepControl,spareControl]<br>手牌: BJ 10H 10S 10S 10C AS AD JS JS JC 9D 8H 8C 8D 8D 6S 6S 6H 6C 6C 5S 5H 5C 4D
- `self|57975|43` 座0 24张 敌最少22 对家6 级7 上手=single:6 → **single:7{7S}** [stopShort,followUp,followSize]<br>手牌: 7H 7S AS KH KD QC QD 10S 10D 9C 9C 9D 9D 8D 5S 5H 5H 5D 4S 4S 2S 2H 2C 2D
- `self|58245|44` 座1 21张 敌最少14 对家11 级10 上手=single:A → **single:10{10D}** [followUp,breakNoOrphan,followSize,keepControl,r28MidFollow]<br>手牌: 10H 10D AS AH AC AD JH JD 8C 7C 7D 6S 6S 6H 6D 4H 4D 3H 3H 3C 3C
- `self|58512|30` 座2 20张 敌最少8 对家9 级6 上手=single:7 → **single:RJ{RJ}** [followUp,followSize,keepControl,r28MidFollow]<br>手牌: RJ 6H AS AH AC JS JS JC JC JD 5C 5D 4D 3S 3H 3C 3D 2S 2C 2D

### 拆炸弹领出

- `self|57783|19` 座3 19张 敌最少21 对家20 级8 上手=pass → **straight:K{9C 10D JC QS KD}** [bombBreakNoGain,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: RJ RJ 8C 8D AS AS AH AH AD KD QS JH JH JC JD 10D 9C 7D 2D
- `self|57941|12` 座3 17张 敌最少25 对家25 级5 上手=pass → **straight:A{10H JC QD KC AC}** [bombBreakNoGain,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: BJ 5H 5S 5S 5D AC KC QD JS JS JC JD 10H 6H 6D 3S 3H
- `self|58032|0` 座0 27张 敌最少27 对家27 级2 上手=pass → **straight:K{9S 10C JD QD KH}** [noFirstBomb,bombBreakNoGain,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: RJ 2C 2D AS AS AC KS KS KH KD QD JD 10C 9S 7S 7D 6S 6C 6C 5D 4H 4C 4D 3S 3S 3H 3C
- `self|58659|59` 座3 16张 敌最少5 对家7 级5 上手=pass → **tripleSeq:10{9D 9C 9H 10C 10S 10S}** [holdBombLead,control,planUnitFirst]<br>手牌: AD KC QC JH 10S 10S 10H 10C 9H 9C 9D 3H 3D 2S 2H 2D

### 早盘拆对领单（手里有顺子/连对/钢板可出）

- `self|58596|5` 座0 21张 敌最少21 对家27 级2 上手=pass → **single:5{5C}** [control]<br>手牌: RJ RJ 2H 2C KS 10C 9S 9H 9D 8D 7S 7H 7C 7D 6H 6C 6D 5C 5C 4C 3C
- `self|58689|63` 座2 20张 敌最少13 对家0 级7 上手=pass → **single:6{6H}** [control]<br>手牌: BJ BJ 7H 7H 7S 7C 7D 9S 9C 9D 8H 8D 8D 6S 6H 5S 4H 2C 2C 2D

### decide 用时 >300ms 的比例

p50 1.4ms，p90 17ms，p99 57.2ms，max 622.6ms

- `self|57681|56` 座3 13张 敌最少2 对家5 级9 上手=fullhouse:6 → **bomb:K{KS KH KH KC}** [noWasteJ,forceFinish:likely]<br>手牌: 9H 9H 9S KS KH KH KC 10S 10C 10D 8C 8C 8D

### 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）

全部通过


### 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸）

不分有无孤张：还的点数手里原有 ≥2 张 200/549 (36%)（有的是顺子里多出的一张，拆牌计划认为更便宜）；还 >10 的牌（手里没有 ≤10，兜底）：0/549 (0%)


### Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5

分类：lead/late/otherPlay 5，lead/mid/otherPlay 3，partner/late/passed 3，lead/early/otherPlay 2，partner/early/passed 2，partner/mid/passed 1，enemy/early/otherPlay 1，enemy/mid/shouldPass 1

- `self|58679|38` lead 6张 张数6/16/21/10 级A 上手=pass<br>decide: **single:8{8S}** (0.58) [smallFirst,control,planWeakFirst] vs **triple:9{9H 9C 9S}** (+1.64, t=3.8, n=36)<br>手牌: JC 8S 9H JH 9C 9S
- `self|58096|46` partner 13张 张数10/24/13/7 级6 上手=bomb:3<br>decide: **pass** (0.44) [] vs **bomb:5{5D 5C 5H 5D}** (+1.58, t=5.0, n=36)<br>手牌: QD QH 8S 5D 4C 8H 4S 4C 4S 5C QD 5H 5D
- `self|57872|16` lead 17张 张数22/17/11/22 级5 上手=pass<br>decide: **pair:4{4H 4C}** (0.78) [control,planWeakFirst] vs **fullhouse:Q{QH QH QS 4H 4C}** (+1.33, t=3.4, n=36)<br>手牌: QH JC 8H QH 8D 8S 10C 10S 5C 9D 4H JD 4C 9H 8H 10H QS
- `self|58790|29` lead 24张 张数20/24/23/16 级7 上手=pass<br>decide: **pairSeq:9{7S 7S 8C 8D 9S 9D}** (-1.14) [keepShape,control] vs **pairSeq:10{8C 8D 9S 9D 10H 10S}** (+1.31, t=3.5, n=36)<br>手牌: 8C QH RJ RJ 8D 2H KD 9S AD 10H 5C JH 5S 10S QD JC 2S 5S 9D AD 3D KC 7S 7S
- `self|58145|20` lead 19张 张数19/25/20/13 级J 上手=pass<br>decide: **tripleSeq:8{7C 7H 7D 8D 8H 8C}** (0.00) [leadSmallSame,r23FreePlate,control,planUnitFirst] vs **pair:3{3S 3D}** (+1.28, t=3.3, n=36)<br>手牌: 7C 6C 3S 5S 5C 8D 6H 10H 9S 5D 8H 7H AC 6D 7D 6S 8C 3D 5H
- `self|58581|10` enemy 22张 张数22/22/16/21 级Q 上手=single:6<br>decide: **single:7{7C}** (0.14) [followUp,followSize,activeFollow:0] vs **single:K{KS}** (+1.19, t=2.6, n=36)<br>手牌: 10C QD QH 3D 5D AC 9C 5H AS 7C KS KH 3C QS 9H BJ AD 10D 10H 6C RJ BJ
- `self|57601|49` partner 22张 张数20/22/12/9 级A 上手=single:RJ<br>decide: **pass** (-0.06) [] vs **bomb:Q{QC QS QH QS}** (+1.11, t=2.8, n=36)<br>手牌: QC BJ QS 3D 2H 8D 8S QH 5C 2H 5D QS 9C 3C AC 9D AD 9S 2S QD AS 5H
- `self|57956|53` lead 8张 张数11/17/8/9 级A 上手=pass<br>decide: **single:RJ{RJ}** (0.47) [control,planKeepControl,forceFinish:likely] vs **pair:2{2D 2H}** (+1.11, t=2.5, n=36)<br>手牌: JH 2D RJ AH JC AC 2H AD
