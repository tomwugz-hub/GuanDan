# 自对局体检报告

生成：2026/10/27 00:34:07（Asia/Shanghai）　policy：current　用时 195s

对局：【进贡比赛模式，每场 8 副】自对局 400 副（四家 decide），混合对手 Random、Greedy、Old:pre-activity、Old:pre-round6 各 0×2 副（换座位）；逐手记录 35096 条；surprise 局面 60 个。

局面 id 可复现：`node selfplay/audit.mjs --replay='<id>'`（cfg|seed|step）。

## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）

- **Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5**：6.7%（n=60，合理区间 ≤5%，严重度 1.8）

## 全部检测器

| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |
|---|---|---|---|---|---|
| 早中盘领出小单（≤10）后两个敌家都不跟 | 1.2% | 953 | ≤25% | 6.6% | OK |
| 早中盘领出小对（≤10）后两个敌家都不跟 | 3.6% | 445 | ≤35% | 11.9% | OK |
| 跟敌人牌过牌率（early，有牌可出时） | 43.8% | 7004 | ≥30 且 ≤62% | 52.0% | OK |
| 跟敌人牌过牌率（mid，有牌可出时） | 40.0% | 7115 | ≥30 且 ≤65% | 56.5% | OK |
| 跟敌人牌过牌率（late，有牌可出时） | 33.9% | 3347 | ≥20 且 ≤75% | 38.1% | OK |
| 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率 | 7.7% | 3523 | ≤35% | 20.5% | OK |
| 压对家的牌（early，有牌可压时） | 0.1% | 1896 | ≤15% | 0.0% | OK |
| 压对家的牌（mid，有牌可压时） | 0.2% | 1978 | ≤15% | 0.2% | OK |
| 压对家的牌（late，有牌可压时） | 13.4% | 1050 | ≤30% | 12.1% | OK |
| 炸对家（未因此走完） | 0.0% | 4376 | ≤2% | 0.0% | OK |
| 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌 | 27.3% | 11 | ≤60% | 62.1% | 样本少 |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 2.6% | 1406 | ≤15% | 15.7% | OK |
| 敌家都 ≥10 张时领出炸弹（非走完） | 1.3% | 2241 | ≤10% | 6.9% | OK |
| 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌 | 4.0% | 201 | ≤45% | 3.2% | OK |
| 输家结束时手里还留着炸弹（每个输家座位） | 4.9% | 800 | ≤20% | 6.8% | OK |
| 输家结束时还握着 ≥2 张王/级牌 | 2.8% | 800 | ≤25% | 7.3% | OK |
| 末游卡手（结束时 ≥8 张且至少还要 5 手） | 0.0% | 400 | ≤25% | 0.0% | OK |
| 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10） | 1.6% | 2264 | ≤8% | 1.5% | OK |
| 早盘领出 A/级牌/王的单对 | 0.0% | 460 | ≤12% | 0.5% | OK |
| 拆炸弹领出 | 0.2% | 5223 | ≤2% | 0.3% | OK |
| 早盘拆对领单（手里有顺子/连对/钢板可出） | 0.0% | 193 | ≤15% | 0.7% | OK |
| 早盘领出对子占比 | 16.9% | 1357 | ≥5% | 12.1% | OK |
| 早盘领出单张占比 | 17.0% | 1357 | ≥15 且 ≤55% | 18.7% | OK |
| 一手能出完却没出完 | 0.0% | 1018 | ≤1% | 0.0% | OK |
| decide 用时 >300ms 的比例 | 0.0% | 35096 | ≤0.5% | 0.0% | OK |
| 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测） | 0.000 | 400 | ≤0 | 0.000 | OK |
| 对 Random 每副净升级 | 0.000 | 0 | ≥1.5 | 2.908 | OK |
| 对 Greedy 每副净升级 | 0.000 | 0 | ≥0.5 | 2.422 | OK |
| 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸） | 36.1% | 349 | ≤50% | 35.5% | OK |
| Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5 | 6.7% | 60 | ≤5% | 8.8% | 🚩 |

## 队伍结果

- 自对局 400 副：南北队每副净升级 -0.007 [-0.231, 0.216]（应≈0），双下率 44.0%，平均每副 88 手
- 各座位平均名次（南/东/北/西）：2.52 / 2.52 / 2.49 / 2.47
- decide vs Random：0 副，胜 0/0 (0%)，每副净升级 0.000 [0.000, 0.000]
- decide vs Greedy：0 副，胜 0/0 (0%)，每副净升级 0.000 [0.000, 0.000]
- decide vs Old:pre-activity：0 副，胜 0/0 (0%)，每副净升级 0.000 [0.000, 0.000]
- decide vs Old:pre-round6：0 副，胜 0/0 (0%)，每副净升级 0.000 [0.000, 0.000]

## 进贡

- 进贡比赛 50 场共 400 副；需进贡的副 317：单贡 185（抗贡 10/185 (5%)，理论≈6%），双下双贡 132（抗贡 38/132 (29%)，理论≈25%；贡牌同点 5）
- 贡牌分布：RJ 36%，BJ 32%，A 10%，5 4%，K 3%，7 3%，8 2%，10 2%，6 2%，3 1%，J 1%，Q 1%，9 1%，4 0%
- 自对局还贡点数分布（decide）：2 19%，3 16%，4 14%，5 13%，6 10%，7 9%，10 8%，8 7%，9 5%
- 自对局进贡副（未抗贡）进贡方每副净升级 -0.223 [-0.495, 0.049]（n=269；负 = 输家进贡后仍吃亏）
- 自对局抗贡副 抗贡方每副净升级 0.500 [-0.134, 1.134]（n=48）
- 进贡不变量（贡牌=最大非逢人配、双下大贡归头游/同点头游下家、抗贡判定、还贡≤10、先出者、交换后各 27 张、牌守恒）：全部通过（检查 400 副）

## 详情与示例局面

### 🚩 Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5

分类：enemy/late/shouldPass 2，enemy/mid/otherPlay 1，lead/early/otherPlay 1

- `self|423|67` enemy 7张 张数3/7/18/11 级A 上手=single:5<br>decide: **single:A{AD}** (0.64) [followUp,winThen:likely,followSize,forceFinish:likely] vs **pass** (+1.06, t=2.6, n=36)<br>手牌: 7C AD 7S AH 7D 2S AS
- `self|101|59` enemy 10张 张数8/12/12/10 级A 上手=single:5<br>decide: **single:A{AD}** (1.56) [followUp,followSize,keepControlSoft,r28MidFollow] vs **bomb:7{7D 7S 7C 7S}** (+0.97, t=3.5, n=36)<br>手牌: 7D 6S 6H AD 7S 7C 6C 7S 6H 5S
- `self|482|16` lead 21张 张数23/25/23/21 级7 上手=pass<br>decide: **single:2{2C}** (0.22) [control,planWeakFirst] vs **single:5{5D}** (+0.86, t=3.0, n=36)<br>手牌: AD 5D 10D 9C BJ QC 2C 7C 3D 6H 10S QD QC 3H QD 3S QH 3D 3S JH 3C
- `self|208|58` enemy 9张 张数8/1/1/9 级2 上手=fullhouse:5<br>decide: **bomb:2{2C 2S 2H 2H}** (-0.28) [noWasteJ,mustBomb,controlFeed:single] vs **pass** (+0.72, t=4.4, n=36)<br>手牌: 2C JS 2S 5S 4C 4H 2H 2H 5H

### 早中盘领出小单（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：10/11 (91%)

- `self|101|75` 座3 8张 敌最少7 对家10 级A 上手=single:6 → **pass** []<br>手牌: 7S 7S 7C 7D 6S 6H 6H 6C
- `self|262|76` 座3 9张 敌最少11 对家12 级10 上手=single:4 → **pass** []<br>手牌: 7S 7D 7D 6S 6S 6H 6C 4H 4D
- `self|293|59` 座0 13张 敌最少12 对家9 级J 上手=single:3 → **pass** []<br>手牌: RJ RJ 6S 6H 6H 6D 5H 5D 5D 4S 4S 4H 4D
- `self|370|97` 座1 8张 敌最少9 对家0 级A 上手=single:9 → **pass** [noSFon8,r14NoPass]<br>手牌: 10C 10D 10D 9H 9D 6S 6H 6C
- `self|774|65` 座2 10张 敌最少7 对家12 级10 上手=single:J → **pass** [passiveEarly]<br>手牌: 10D 10D QS QD 7S 7S 7D 5S 5C 5D

### 早中盘领出小对（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：16/16 (100%)

- `self|84|51` 座3 19张 敌最少9 对家12 级J 上手=pair:10 → **pass** []<br>手牌: AS AC AD KH KD KD 7S 7H 7D 7D 6S 6H 6D 5S 5H 5D 3S 3C 2S
- `self|117|34` 座3 16张 敌最少13 对家17 级J 上手=pair:5 → **pass** []<br>手牌: JH AS AS AH AC AD KS KS KC KD QS 10C 9S 8D 5H 5C
- `self|226|30` 座1 16张 敌最少13 对家7 级7 上手=pair:8 → **pass** []<br>手牌: BJ AD KC 9S 5S 5C 5D 4S 4H 4D 3S 3C 3D 2H 2H 2C
- `self|262|23` 座2 25张 敌最少14 对家24 级10 上手=pair:A → **pass** []<br>手牌: RJ 10S 10C AS AH AH AD KC QS QS QD JH JC JD 9S 9H 9C 9D 6H 5S 5S 5H 5C 4S 2S
- `self|656|53` 座2 7张 敌最少9 对家15 级4 上手=pair:2 → **pass** []<br>手牌: RJ 4C KC QH 8C 7C 3S

### 跟敌人牌过牌率（early，有牌可出时）

- `self|16|9` 座1 26张 敌最少20 对家26 级3 上手=fullhouse:6 → **pass** []<br>手牌: AH KD QS QH QC QD QD JS JS JH JC 9H 9C 8S 8C 7S 7D 6S 6H 6C 6D 5S 5S 5H 5D 5D
- `self|166|12` 座0 21张 敌最少20 对家21 级2 上手=single:BJ → **pass** []<br>手牌: RJ RJ 2H 2S 2D AS KC QS QH QC QD JH JC 10D 8H 8C 8D 4S 4H 4C 4D
- `self|311|9` 座1 23张 敌最少23 对家25 级2 上手=pair:A → **pass** []<br>手牌: BJ BJ 2S 2C AH AD KH 10H 10C 10C 10D 9D 8C 8D 7D 6H 6D 5S 5H 5D 3S 3H 3C
- `self|470|1` 座2 27张 敌最少22 对家27 级A 上手=straight:J → **pass** []<br>手牌: RJ BJ BJ AS AC KH KD QS QC JH JC 10H 10H 10C 10D 8C 7S 7H 7D 6S 6D 5H 5H 4D 3H 3C 3D
- `self|628|11` 座2 25张 敌最少18 对家20 级7 上手=fullhouse:Q → **pass** []<br>手牌: RJ 7H 7C AH AC KC QS QH QH QD 10H 10D 10D 9C 8S 8H 8D 6D 5H 4H 4D 3D 3D 2C 2D

### 跟敌人牌过牌率（mid，有牌可出时）

- `self|16|39` 座3 16张 敌最少12 对家25 级3 上手=single:Q → **pass** [r14NoPass]<br>手牌: 3H 3H AS AH AC AD 9S 4S 4S 4H 4C 4C 2S 2S 2C 2D
- `self|181|42` 座1 15张 敌最少16 对家15 级5 上手=pair:A → **pass** []<br>手牌: BJ 5H 5S KS KH 8S 8S 8H 8D 7C 7D 6H 6D 4C 4D
- `self|341|17` 座0 16张 敌最少11 对家22 级2 上手=fullhouse:J → **pass** [r14NoPass]<br>手牌: 2H 2H KS QH QC 10H 10C 8C 7H 7H 7C 7D 6S 5S 5C 5D
- `self|512|21` 座2 17张 敌最少14 对家25 级8 上手=triple:3 → **pass** []<br>手牌: 8H 8C KS KD QS QD JS JH 9S 9C 9C 9D 7S 6C 6D 5S 4D
- `self|657|67` 座1 15张 敌最少9 对家10 级7 上手=single:Q → **pass** []<br>手牌: RJ RJ 7H JS JS JC JD JD 10S 10H 8H 8H 8C 8D 4C

### 跟敌人牌过牌率（late，有牌可出时）

- `self|18|44` 座0 7张 敌最少9 对家19 级9 上手=pair:5 → **pass** []<br>手牌: 8S 8C 8C 5S 5S 5C 5D
- `self|194|60` 座0 5张 敌最少5 对家6 级A 上手=pair:10 → **pass** []<br>手牌: JS JS JD 4S 4C
- `self|308|55` 座1 9张 敌最少10 对家23 级A 上手=pair:2 → **pass** []<br>手牌: KC JH 9S 9H 9C 9D 8S 8C 8D
- `self|468|70` 座0 5张 敌最少9 对家15 级8 上手=single:K → **pass** []<br>手牌: 8H 10S 10C 9S 9D
- `self|663|65` 座1 8张 敌最少4 对家10 级2 上手=single:A → **pass** []<br>手牌: 2C 2D KC KC KD 4S 4D 4D

### 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率

按座位 南/东/北/西：56/877 (6%) / 84/883 (10%) / 70/860 (8%) / 63/903 (7%)

- `self|19|52` 座2 21张 敌最少8 对家7 级J 上手=pair:10 → **pass** []<br>手牌: JH JD QC QD 10H 10H 8S 8H 8H 7S 7H 7H 7C 7D 6H 5D 2S 2H 2H 2C 2D
- `self|128|3` 座3 27张 敌最少25 对家25 级10 上手=pair:A → **pass** []<br>手牌: BJ 10H 10H 10C AS AC AD KS KS KC QH QD JS JS JC 9C 8H 8D 7C 6D 5H 4S 4S 3S 3H 2C 2C
- `self|262|8` 座3 26张 敌最少24 对家25 级10 上手=pair:8 → **pass** []<br>手牌: BJ 10C 10D AD KS KS KC QH QC QD JD 9S 8H 8H 7S 7D 7D 6S 6S 6H 6C 5C 4H 4D 3C 3D
- `self|407|83` 座2 11张 敌最少7 对家7 级9 上手=pair:7 → **pass** []<br>手牌: 9H 8D 7S 7H 7C 7C 7D 4S 4H 4H 4C
- `self|579|2` 座0 27张 敌最少25 对家25 级A 上手=pair:8 → **pass** []<br>手牌: RJ RJ BJ AS AC KS QS QH JS JS 10S 10D 9S 9S 9H 9C 8S 8H 8H 5H 5D 4H 4C 3S 3H 3C 3C

### 压对家的牌（early，有牌可压时）

- `self|529|66` 座0 20张 敌最少2 对家0 级Q 上手=single:A → **single:RJ{RJ}** [followUp]<br>手牌: RJ BJ QS AD JH JD JD 10S 10C 10C 9H 8S 6S 6H 6H 6C 4S 4D 3C 3C

### 压对家的牌（mid，有牌可压时）

- `self|130|49` 座1 10张 敌最少11 对家15 级A 上手=fullhouse:3 → **fullhouse:Q{QC QD QC 6C 6D}** []<br>手牌: AH QC QC QD JS JH 8S 8H 6C 6D
- `self|338|73` 座2 11张 敌最少9 对家4 级A 上手=fullhouse:6 → **fullhouse:A{AC AS AD 8C 8S}** []<br>手牌: AH AS AC AD JS JC JD 10H 10C 8S 8C
- `self|580|81` 座2 10张 敌最少6 对家5 级2 上手=fullhouse:5 → **fullhouse:2{2C 2C 5D 5S 2H}** [keepWild,forceFinish:bombBack]<br>手牌: 2H 2C 2C 6S 6H 6H 6C 6D 5S 5D
- `self|644|58` 座0 11张 敌最少5 对家15 级7 上手=fullhouse:10 → **fullhouse:K{KS KD KD 6H 6D}** []<br>手牌: KS KD KD 6H 6D 3S 3S 3H 3H 3C 3D

### 压对家的牌（late，有牌可压时）

- `self|22|75` 座0 1张 敌最少2 对家2 级A 上手=single:10 → **single:A{AS}** [goOut]<br>手牌: AS
- `self|208|73` 座2 1张 敌最少1 对家6 级2 上手=single:Q → **single:K{KS}** [goOut]<br>手牌: KS
- `self|405|63` 座1 2张 敌最少4 对家6 级5 上手=pair:7 → **pair:RJ{RJ RJ}** [goOut]<br>手牌: RJ RJ
- `self|548|86` 座1 1张 敌最少2 对家3 级5 上手=single:9 → **single:5{5D}** [goOut]<br>手牌: 5D
- `self|678|65` 座2 6张 敌最少10 对家9 级J 上手=fullhouse:10 → **fullhouse:A{AC AD AD 2S 2D}** []<br>手牌: AC AD AD 7C 2S 2D

### 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌

旧口径（含拆炸/只有炸弹可压）：3/11 (27%)；其中不拆三张也能压：3/11 (27%)；只能拆三张才能压：0/0 (0%)

- `self|307|80` 座1 5张 敌最少3 对家18 级A 上手=single:6 → **pass** [可压:single:K{KD} / single:K{KS}]<br>手牌: KS KD 4C 4C 4D
- `self|578|53` 座0 11张 敌最少3 对家10 级A 上手=pair:2 → **pass** [可压:pair:7{7C 7S} / pair:J{JC JS} / pair:7{7C 7D}]<br>手牌: RJ AC QH QH QD QD JS JC 7S 7C 7D
- `self|675|83` 座2 9张 敌最少1 对家5 级9 上手=pair:5 → **pass** [可压:pair:10{10H 10D}]<br>手牌: QC JC 10H 10D 7S 3H 3C 2S 2C

### 敌家都 ≥15 张时炸普通牌（占跟牌炸弹）

每副炸弹数（自对局，四人合计）：早 0.88 / 中 2.57 / 晚 2.15

- `self|19|69` 座3 6张 敌最少19 对家9 级J 上手=single:8 → **bomb:A{AC AC AS AH}** [noSFon8,mustBomb,forceFinish:likely]<br>手牌: AS AH AC AC 10C 10D
- `self|146|61` 座3 12张 敌最少16 对家1 级K 上手=single:RJ → **bomb:8{8H 8D 8S 8C}** [mustBomb,controlFeed:single]<br>手牌: RJ 9S 9C 8S 8H 8C 8D 7C 5D 4H 3C 3D
- `self|273|43` 座2 7张 敌最少22 对家17 级8 上手=straight:10 → **bomb:9{9D 9C 9C 8H}** [mustBomb]<br>手牌: 8H AS KC 9C 9C 9D 5H
- `self|551|78` 座0 6张 敌最少16 对家7 级8 上手=pair:J → **bomb:5{5H 5C 5D 5S}** [mustBomb]<br>手牌: 8C KH 5S 5H 5C 5D
- `self|706|28` 座0 11张 敌最少26 对家26 级J 上手=fullhouse:Q → **bomb:8{8D 8C 8D 8H}** [noWasteJ,mustBomb]<br>手牌: 9S 9S 9H 9D 8H 8C 8D 8D 7C 6H 5S

### 敌家都 ≥10 张时领出炸弹（非走完）

炸压炸占跟牌炸弹：574/1980 (29%)

- `self|16|69` 座1 9张 敌最少10 对家11 级3 上手=pass → **bomb:J{JC JS JH JS}** [bombClear,control]<br>手牌: QS QH QC QD QD JS JS JH JC
- `self|117|55` 座0 9张 敌最少14 对家12 级J 上手=pass → **bomb:7{7C 7D 7S 7H}** [bombClear,control]<br>手牌: BJ 10S 10H 10C 10D 7S 7H 7C 7D
- `self|195|36` 座0 14张 敌最少20 对家17 级2 上手=pass → **bomb:5{5S 5H 5S 5D}** [bombClear,control]<br>手牌: 2H 10S 10S 10H 10C 10D 6S 6H 6C 6D 5S 5S 5H 5D
- `self|453|44` 座2 12张 敌最少13 对家21 级A 上手=pass → **bomb:4{4D 4H 4S 4C}** [bombClear,control]<br>手牌: KS KH KH KC 9S 9H 9D 9D 4S 4H 4C 4D
- `self|627|27` 座0 12张 敌最少15 对家25 级5 上手=pass → **bomb:6{6H 6C 6S 6H}** [bombClear,control]<br>手牌: AS AH AC AD 8C 8C 8D 8D 6S 6H 6H 6C

### 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌

- `self|304|70` 座0 12张 敌最少3 对家5 级8 上手=single:J → **pass** []<br>手牌: 7H 7D 6C 6D 5S 5H 5C 5D 3C 2S 2C 2D
- `self|325|75` 座1 10张 敌最少2 对家0 级A 上手=pair:K → **pass** [r23KeepExitBomb]<br>手牌: AH KS KS KC KD 3S 3S 3H 3H 3C
- `self|470|46` 座3 13张 敌最少2 对家6 级A 上手=pair:BJ → **pass** [r23KeepExitBomb]<br>手牌: AH 9H 9C 8D 7S 7C 5C 5D 2S 2H 2C 2D 2D
- `self|514|55` 座1 11张 敌最少2 对家8 级Q 上手=single:K → **pass** []<br>手牌: KS 10S 10S 10H 8C 7S 7S 7H 7C 7D 7D
- `self|577|66` 座2 8张 敌最少2 对家12 级A 上手=single:K → **pass** []<br>手牌: QS QC QD QD JC 3H 3D 3D

### 输家结束时手里还留着炸弹（每个输家座位）

- `self|16` 座0 结束时手里：BJ 10D 10H 5C QH RJ 10H 10S 10D 5C
- `self|16` 座2 结束时手里：8C 8S 8H 9D 9H 9D 3C 9C KS 3S
- `self|80` 座3 结束时手里：3C 3C KH 3H 8S 3S KS KD KH
- `self|97` 座2 结束时手里：4H 4C AH 10H AD JS 4D
- `self|133` 座3 结束时手里：8H 3S 6C 9D 3D 6H 6S 6C 3D

### 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10）

- `self|23|30` 座3 21张 敌最少13 对家11 级A 上手=pair:7 → **pair:BJ{BJ BJ}** [followSize,keepControlPair,r28MidFollow]<br>手牌: BJ BJ AS KH JH 10S 9S 9H 9D 8H 8D 8D 7S 7H 7H 6S 6C 4H 4D 2S 2H
- `self|182|59` 座1 22张 敌最少6 对家7 级6 上手=single:8 → **single:6{6S}** [noSFon8,followUp,breakNoOrphan,followSize,keepControlSoft,r28MidFollow]<br>手牌: 6S 6C JS JH JH JC JC JD 8S 8H 8C 8C 8D 7H 7H 7C 7D 5D 5D 3S 2S 2H
- `self|323|12` 座3 21张 敌最少13 对家25 级Q 上手=pair:7 → **pair:Q{QS QC}** [followSize,keepControlPair,r28MidFollow]<br>手牌: BJ QS QC QD AH JC 10D 9S 8C 6H 6C 6C 6D 5C 5C 4S 4C 4D 3D 2S 2C
- `self|544|22` 座0 20张 敌最少15 对家15 级10 上手=single:10 → **single:BJ{BJ}** [followUp,followSize,keepControl,spareControl]<br>手牌: RJ BJ 10H 10D AH AC 8S 8H 8D 7S 7D 7D 6S 6H 6D 5H 5D 4H 4D 2D
- `self|705|50` 座3 22张 敌最少9 对家9 级8 上手=single:9 → **single:BJ{BJ}** [noSFon8,followUp,followSize,keepControl,r28MidFollow]<br>手牌: BJ 8S 8D KS KH KC KD QS QH QC QD 10H 10H 10C 10D 10D 9S 9H 9D 6H 6D 4S

### 拆炸弹领出

- `self|80|13` 座1 19张 敌最少19 对家19 级7 上手=pass → **straight:6{2C 3H 4H 5S 6D}** [bombBreakNoGain,holdBombLead,control,planUnitFirst]<br>手牌: 7S 7D KC KC KD JC JD 10H 10C 10D 10D 6D 5S 4H 4H 4C 4D 3H 2C
- `self|181|58` 座1 12张 敌最少11 对家14 级5 上手=pass → **pair:8{8H 8S}** [control]<br>手牌: 5H 5S 8S 8S 8H 8D 7C 7D 6H 6D 4C 4D
- `self|209|17` 座0 17张 敌最少9 对家15 级3 上手=pass → **straight:9{5H 6C 7D 8S 9C}** [bombBreakNoGain,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: 3S AS AS KC KD QC JD 9C 8S 7D 6C 5S 5H 5C 5D 4S 4C
- `self|257|38` 座2 18张 敌最少11 对家8 级8 上手=pass → **straight:J{7H 8C 9H 10S JD}** [bombBreakNoGain,holdBombLead,control,planUnitFirst]<br>手牌: 8C KS JH JC JD JD 10S 9H 7H 5S 4D 4D 3S 3S 3H 3C 2H 2H
- `self|466|31` 座0 21张 敌最少6 对家14 级10 上手=pass → **straight:Q{8D 9H 10D JC QC}** [bombBreakNoGain,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: RJ BJ 10D AC KS KH QH QC QD QD JC 9H 8D 7S 7H 7H 7D 4S 4H 4C 4D

### 早盘领出单张占比

早盘领出牌型分布：pairSeq 18%，straight 18%，single 17%，pair 17%，fullhouse 15%，tripleSeq 12%，triple 4%；熵 2.70 bit


### decide 用时 >300ms 的比例

p50 1.5ms，p90 18.7ms，p99 60.4ms，max 556.5ms

- `self|208|42` 座3 15张 敌最少1 对家8 级2 上手=fullhouse:4 → **bomb:8{8C 8H 8D 8D}** [noWasteJ,mustBomb]<br>手牌: 2H 2H 2S 2C JS 8H 8C 8D 8D 7S 7C 5S 5H 4H 4C
- `self|771|66` 座0 13张 敌最少1 对家0 级2 上手=fullhouse:8 → **bomb:Q{QD QS QC QD}** [noWasteJ,mustBomb,forceFinish:likely]<br>手牌: 2H AH AC AD AD KS KC KC KD QS QC QD QD

### 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）

全部通过


### 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸）

不分有无孤张：还的点数手里原有 ≥2 张 140/363 (39%)（有的是顺子里多出的一张，拆牌计划认为更便宜）；还 >10 的牌（手里没有 ≤10，兜底）：0/363 (0%)

