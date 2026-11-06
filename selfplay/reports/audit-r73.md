# 自对局体检报告

生成：2026/10/28 09:44:10（Asia/Shanghai）　policy：current　用时 234s

对局：【进贡比赛模式，每场 8 副】自对局 200 副（四家 decide），混合对手 Random、Greedy、Old:pre-activity、Old:pre-round6 各 40×2 副（换座位）；逐手记录 44952 条；surprise 局面 80 个。

局面 id 可复现：`node selfplay/audit.mjs --replay='<id>'`（cfg|seed|step）。

## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）

- **早盘领出单张占比**：14.9%（n=629，合理区间 ≥15 且 ≤55%，严重度 0.0）

## 全部检测器

| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |
|---|---|---|---|---|---|
| 早中盘领出小单（≤10）后两个敌家都不跟 | 1.8% | 503 | ≤25% | 6.6% | OK |
| 早中盘领出小对（≤10）后两个敌家都不跟 | 3.6% | 223 | ≤35% | 11.9% | OK |
| 跟敌人牌过牌率（early，有牌可出时） | 43.7% | 3575 | ≥30 且 ≤62% | 52.0% | OK |
| 跟敌人牌过牌率（mid，有牌可出时） | 41.4% | 3685 | ≥30 且 ≤65% | 56.5% | OK |
| 跟敌人牌过牌率（late，有牌可出时） | 29.3% | 1579 | ≥20 且 ≤75% | 38.1% | OK |
| 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率 | 8.7% | 1738 | ≤35% | 20.5% | OK |
| 压对家的牌（early，有牌可压时） | 0.1% | 1024 | ≤15% | 0.0% | OK |
| 压对家的牌（mid，有牌可压时） | 0.2% | 1032 | ≤15% | 0.2% | OK |
| 压对家的牌（late，有牌可压时） | 20.3% | 478 | ≤30% | 12.1% | OK |
| 炸对家（未因此走完） | 0.0% | 2291 | ≤2% | 0.0% | OK |
| 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌 | 12.5% | 8 | ≤60% | 62.1% | 样本少 |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 1.6% | 747 | ≤15% | 15.7% | OK |
| 敌家都 ≥10 张时领出炸弹（非走完） | 1.7% | 1179 | ≤10% | 6.9% | OK |
| 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌 | 4.6% | 109 | ≤45% | 3.2% | OK |
| 输家结束时手里还留着炸弹（每个输家座位） | 6.0% | 400 | ≤20% | 6.8% | OK |
| 输家结束时还握着 ≥2 张王/级牌 | 3.3% | 400 | ≤25% | 7.3% | OK |
| 末游卡手（结束时 ≥8 张且至少还要 5 手） | 0.0% | 200 | ≤25% | 0.0% | OK |
| 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10） | 2.1% | 1069 | ≤8% | 1.5% | OK |
| 早盘领出 A/级牌/王的单对 | 0.0% | 203 | ≤12% | 0.5% | OK |
| 拆炸弹领出 | 0.1% | 2509 | ≤2% | 0.3% | OK |
| 早盘拆对领单（手里有顺子/连对/钢板可出） | 0.0% | 82 | ≤15% | 0.7% | OK |
| 早盘领出对子占比 | 17.3% | 629 | ≥5% | 12.1% | OK |
| 早盘领出单张占比 | 14.9% | 629 | ≥15 且 ≤55% | 18.7% | 🚩 |
| 一手能出完却没出完 | 0.0% | 504 | ≤1% | 0.0% | OK |
| decide 用时 >300ms 的比例 | 0.0% | 30334 | ≤0.5% | 0.0% | OK |
| 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测） | 0.000 | 520 | ≤0 | 0.000 | OK |
| 对 Random 每副净升级 | 2.938 | 80 | ≥1.5 | 2.908 | OK |
| 对 Greedy 每副净升级 | 2.612 | 80 | ≥0.5 | 2.422 | OK |
| 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸） | 32.6% | 190 | ≤50% | 35.5% | OK |
| Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5 | 5.0% | 80 | ≤5% | 8.8% | OK |

## 队伍结果

- 自对局 200 副：南北队每副净升级 -0.125 [-0.444, 0.194]（应≈0），双下率 46.0%，平均每副 88 手
- 各座位平均名次（南/东/北/西）：2.43 / 2.44 / 2.63 / 2.50
- decide vs Random：80 副，胜 80/80 (100%)，每副净升级 2.938 [2.860, 3.015]
- decide vs Greedy：80 副，胜 78/80 (98%)，每副净升级 2.612 [2.541, 2.684]
- decide vs Old:pre-activity：80 副，胜 77/80 (96%)，每副净升级 2.150 [1.836, 2.464]
- decide vs Old:pre-round6：80 副，胜 76/80 (95%)，每副净升级 2.100 [1.844, 2.356]

## 进贡

- 进贡比赛 65 场共 520 副；需进贡的副 403：单贡 175（抗贡 11/175 (6%)，理论≈6%），双下双贡 228（抗贡 72/228 (32%)，理论≈25%；贡牌同点 19）
- 贡牌分布：BJ 32%，RJ 29%，A 10%，8 6%，J 5%，5 4%，K 4%，Q 3%，9 2%，10 2%，7 1%，6 1%，3 1%
- 自对局还贡点数分布（decide）：3 18%，4 16%，5 15%，2 14%，6 10%，10 9%，7 8%，8 8%，9 5%
- 自对局进贡副（未抗贡）进贡方每副净升级 -0.075 [-0.449, 0.299]（n=146；负 = 输家进贡后仍吃亏）
- 自对局抗贡副 抗贡方每副净升级 0.294 [-0.779, 1.367]（n=17）
- 进贡不变量（贡牌=最大非逢人配、双下大贡归头游/同点头游下家、抗贡判定、还贡≤10、先出者、交换后各 27 张、牌守恒）：全部通过（检查 520 副）

## 详情与示例局面

### 🚩 早盘领出单张占比

早盘领出牌型分布：straight 23%，pair 17%，pairSeq 17%，single 15%，fullhouse 14%，tripleSeq 9%，triple 4%；熵 2.67 bit


### 早中盘领出小单（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：9/9 (100%)

- `self|2768023|70` 座0 12张 敌最少9 对家9 级7 上手=single:9 → **pass** [noSFon8]<br>手牌: 7H 7H 9H 9C 9C 9D 4H 4H 4D 2C 2D 2D
- `self|2768099|55` 座2 9张 敌最少10 对家12 级5 上手=single:10 → **pass** []<br>手牌: 5H 9H 9C 9C 9D 8H 7D 4S 4H
- `self|2768165|77` 座2 7张 敌最少9 对家17 级Q 上手=single:8 → **pass** [noSFon8]<br>手牌: QH 6S 6C 5S 5H 5C 5D
- `self|2768192|88` 座2 10张 敌最少9 对家8 级10 上手=single:A → **pass** []<br>手牌: 10H QS QH QC QD 3S 3H 3H 3C 3D
- `self|2768199|65` 座0 8张 敌最少7 对家14 级7 上手=single:8 → **pass** [noSFon8]<br>手牌: AH AH AC AD 5H 5C 5D 5D

### 早中盘领出小对（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：7/8 (88%)

- `self|2768018|38` 座0 10张 敌最少13 对家13 级A 上手=pair:2 → **pass** []<br>手牌: BJ KS JD 10D 6C 5S 4S 4S 4D 4D
- `self|2768020|67` 座0 13张 敌最少15 对家13 级2 上手=pair:9 → **pass** []<br>手牌: 10S 10H 10C 10D 10D 7S 7C 7C 7D 3S 3H 3C 3D
- `self|2768134|61` 座0 13张 敌最少10 对家16 级Q 上手=pair:5 → **pass** []<br>手牌: QH 8S 8H 8C 8C 4S 4S 4H 4C 3S 3C 3D 2S
- `self|2768150|69` 座3 8张 敌最少12 对家0 级10 上手=pair:5 → **pass** []<br>手牌: 9S 7D 6S 5S 5D 3S 3H 3C
- `self|2768192|84` 座2 10张 敌最少10 对家8 级10 上手=pair:3 → **pass** []<br>手牌: 10H QS QH QC QD 3S 3H 3H 3C 3D

### 跟敌人牌过牌率（early，有牌可出时）

- `self|2768001|37` 座1 21张 敌最少12 对家10 级Q 上手=single:A → **pass** []<br>手牌: QH AH AD KH JS JH JC JD 10H 10C 10D 9S 8C 7D 6S 6C 3D 3D 2H 2C 2D
- `self|2768082|12` 座3 25张 敌最少22 对家20 级4 上手=triple:A → **pass** []<br>手牌: 4H 4C 4D AC KS QS QH JD 10S 10D 9S 9C 9C 8S 8H 8D 5S 5S 5C 5D 3S 3D 2H 2C 2C
- `self|2768160|35` 座1 23张 敌最少16 对家9 级8 上手=pair:8 → **pass** []<br>手牌: BJ BJ 8C 8D AS AH KS KD JS JS 6S 6H 6C 5S 5H 5C 5D 4H 4C 3H 3D 2C 2D
- `self|2768230|46` 座2 23张 敌最少9 对家10 级7 上手=single:A → **pass** []<br>手牌: RJ RJ 7H KS KC KD JS JS JC 10S 10H 10C 10D 8S 8C 8C 5S 5H 5C 4S 4H 4C 2D
- `self|2768322|33` 座2 23张 敌最少15 对家15 级7 上手=single:7 → **pass** []<br>手牌: BJ 7C AS AH AC AD KH KC KD KD QS QC JH 8S 8C 6S 6H 6D 5S 5H 4C 2S 2C

### 跟敌人牌过牌率（mid，有牌可出时）

- `self|2768000|59` 座2 11张 敌最少3 对家8 级J 上手=fullhouse:5 → **pass** []<br>手牌: 10S 10S 10H 10C 9S 6C 5S 4S 4H 4C 3H
- `self|2768082|27` 座2 17张 敌最少15 对家17 级4 上手=triple:J → **pass** []<br>手牌: 4H 4S 4C 4D 8H 8C 7S 7H 7C 6D 5H 5H 5D 3C 3C 2S 2H
- `self|2768160|17` 座3 12张 敌最少22 对家26 级8 上手=single:K → **pass** []<br>手牌: 8H KH KH KD QS 10S 6S 6H 6D 5H 5D 4H
- `self|2768215|15` 座1 19张 敌最少14 对家25 级J 上手=fullhouse:3 → **pass** []<br>手牌: RJ RJ JC AC KC QH QH QC QD 10S 10S 10H 10D 9S 7S 4S 4C 4C 4D
- `self|2768310|54` 座2 17张 敌最少4 对家5 级A 上手=single:Q → **pass** []<br>手牌: AH QS QD 10C 9S 9C 9D 8H 8C 7H 7H 7D 5S 5D 3S 3H 3D

### 跟敌人牌过牌率（late，有牌可出时）

- `self|2768000|48` 座3 7张 敌最少8 对家10 级J 上手=single:9 → **pass** [noSFon8]<br>手牌: JH JH KS QH 10H 9C 9D
- `self|2768065|69` 座3 9张 敌最少8 对家10 级5 上手=single:A → **pass** []<br>手牌: 5H AS AD 7H 7C 3S 3H 3C 3C
- `self|2768145|74` 座3 6张 敌最少4 对家4 级8 上手=pair:5 → **pass** []<br>手牌: 6S 6S 6C 6D 6D 4C
- `self|2768211|79` 座3 8张 敌最少8 对家12 级2 上手=single:9 → **pass** [noSFon8]<br>手牌: QS QH 9S 9H 9C 5S 5S 5D
- `self|2768274|80` 座0 3张 敌最少5 对家2 级8 上手=single:K → **pass** []<br>手牌: 8H 7S 7C

### 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率

按座位 南/东/北/西：46/437 (11%) / 35/403 (9%) / 46/457 (10%) / 24/441 (5%)

- `self|2768004|29` 座0 24张 敌最少13 对家13 级A 上手=pair:9 → **pass** []<br>手牌: AH AC AD KS KH KC KD QS QC QC QD QD JH 9H 9C 7S 6S 6H 6D 5H 4D 2S 2H 2C
- `self|2768080|9` 座2 22张 敌最少15 对家27 级3 上手=pair:2 → **pass** []<br>手牌: RJ BJ 3H AC KS JS 10D 8D 6C 5S 5H 5H 5C 5D 4S 4H 4C 4D 2S 2S 2C 2D
- `self|2768150|47` 座3 19张 敌最少6 对家9 级10 上手=single:Q → **pass** []<br>手牌: AS AH AC AD JD 9S 9S 9H 8S 8H 7H 7C 7D 6S 5S 5D 3S 3H 3C
- `self|2768194|44` 座3 11张 敌最少11 对家18 级J 上手=pair:8 → **pass** []<br>手牌: JH KS KH KC KD 7D 6D 5H 5C 5C 5D
- `self|2768291|84` 座1 17张 敌最少12 对家15 级7 上手=single:5 → **pass** []<br>手牌: KS KH KC KD 9S 9H 9C 9D 6S 6H 6C 6D 3H 3C 3C 3D 3D

### 压对家的牌（early，有牌可压时）

- `self|2768080|101` 座3 20张 敌最少2 对家1 级3 上手=pair:8 → **pair:10{10C 10H}** []<br>手牌: AS AC AD KS KH KD JH JC JC JD 10H 10C 7C 7C 7D 7D 6S 6S 4C 4D

### 压对家的牌（mid，有牌可压时）

- `self|2768325|28` 座0 10张 敌最少12 对家15 级K 上手=fullhouse:6 → **fullhouse:J{JC JH JC QS QC}** [fhAttach]<br>手牌: KH AS AS AH QS QC JH JC JC 10C
- `self|2768375|67` 座0 10张 敌最少2 对家5 级9 上手=single:Q → **single:9{9D}** [followUp]<br>手牌: 9D AH JS JH 10D 4H 4D 2S 2S 2D

### 压对家的牌（late，有牌可压时）

- `self|2768000|78` 座1 3张 敌最少6 对家1 级J 上手=single:Q → **single:K{KC}** [followUp,strongBeforeLast,forceFinish:likely]<br>手牌: KC 8S 8H
- `self|2768053|80` 座0 2张 敌最少7 对家0 级8 上手=single:A → **single:8{8H}** [followUp,strongBeforeLast,forceFinish:likely]<br>手牌: 8H QH
- `self|2768117|92` 座3 5张 敌最少2 对家2 级K 上手=triple:4 → **triple:9{9D 9H 9S}** [forceFinish:sure]<br>手牌: 9S 9H 9D 7H 7C
- `self|2768224|95` 座2 6张 敌最少3 对家3 级Q 上手=single:4 → **single:A{AS}** [followUp,strongBeforeLast]<br>手牌: AS KH KH 4S 4H 4D
- `self|2768304|60` 座0 4张 敌最少9 对家14 级4 上手=pairSeq:4 → **bomb:10{10H 10C 10S 10H}** [goOut]<br>手牌: 10S 10H 10H 10C

### 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌

旧口径（含拆炸/只有炸弹可压）：1/8 (13%)；其中不拆三张也能压：1/8 (13%)；只能拆三张才能压：0/0 (0%)

- `self|2768274|69` 座1 8张 敌最少3 对家7 级8 上手=single:4 → **pass** [可压:single:9{9D} / single:6{6S} / single:K{KC}]<br>手牌: KC 9D 7D 6S 6D 4H 4C 3D

### 敌家都 ≥15 张时炸普通牌（占跟牌炸弹）

每副炸弹数（自对局，四人合计）：早 0.95 / 中 2.79 / 晚 2.15

- `self|2768032|71` 座1 9张 敌最少16 对家5 级K 上手=single:10 → **bomb:8{8D 8S 8D 8H}** [mustBomb,forceFinish:likely]<br>手牌: RJ KH 10S 8S 8H 8D 8D 3H 3D
- `self|2768067|55` 座2 10张 敌最少18 对家23 级8 上手=pair:2 → **bomb:7{7C 7H 7D 7S}** [mustBomb,forceFinish:likely]<br>手牌: 8H 8H 8S 7S 7H 7C 7D 6C 3D 3D
- `self|2768176|69` 座3 10张 敌最少17 对家11 级9 上手=tripleSeq:3 → **bomb:6{6H 6H 6C 9H}** [mustBomb]<br>手牌: 9H 9S QC 8C 7S 7C 6H 6H 6C 5D
- `self|2768276|62` 座1 6张 敌最少16 对家6 级6 上手=single:6 → **bomb:Q{QS QC QD QD}** [mustBomb]<br>手牌: QS QC QD QD 9H 7C
- `self|2768321|78` 座3 5张 敌最少15 对家5 级8 上手=single:Q → **bomb:9{9D 9H 9C 9D}** [mustBomb,forceFinish:likely]<br>手牌: JH 9H 9C 9D 9D

### 敌家都 ≥10 张时领出炸弹（非走完）

炸压炸占跟牌炸弹：313/1060 (30%)

- `self|2768004|51` 座2 9张 敌最少10 对家23 级A 上手=pass → **bomb:5{5D 5H 5D 5S}** [bombClear,control]<br>手牌: RJ 7H 7C 7D 7D 5S 5H 5D 5D
- `self|2768071|45` 座2 10张 敌最少12 对家23 级9 上手=pass → **bomb:6{6D 6C 6H 6S}** [bombClear,control]<br>手牌: RJ 10S 10S 10H 10H 10D 6S 6H 6C 6D
- `self|2768181|53` 座1 11张 敌最少10 对家7 级K 上手=pass → **bomb:7{7S 7S 7H 7D}** [bombClear,control]<br>手牌: BJ BJ KH 9S 9H 9C 9D 7S 7S 7H 7D
- `self|2768291|109` 座2 7张 敌最少17 对家0 级7 上手=pass → **bomb:7{7D 7S 7S 7D}** [bombClear,control]<br>手牌: 7S 7S 7D 7D 6H 6C 6D
- `self|2768339|61` 座3 10张 敌最少12 对家17 级9 上手=pass → **bomb:2{2S 2C 2D 2H}** [bombClear,control]<br>手牌: 9C AS AH AH AC AD 2S 2H 2C 2D

### 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌

- `self|2768145|77` 座2 12张 敌最少2 对家4 级8 上手=pair:Q → **pass** []<br>手牌: 8D JS JH JD JD 7S 7H 7H 7C 7D 5D 4H
- `self|2768163|67` 座3 11张 敌最少1 对家0 级A 上手=pair:RJ → **pass** [mustBomb,r23KeepExitBomb]<br>手牌: AH AC KS KH KC KC QC 10H 9C 7S 5C
- `self|2768257|69` 座3 12张 敌最少3 对家2 级2 上手=fullhouse:7 → **pass** []<br>手牌: KH KH QH 8S 8C 7S 7H 7H 6S 6H 6C 6D
- `self|2768288|61` 座2 8张 敌最少3 对家14 级3 上手=fullhouse:10 → **pass** []<br>手牌: 3H 8S 8S 8H 6S 6S 5S 5D
- `self|2768338|56` 座0 10张 敌最少1 对家3 级J 上手=pair:RJ → **pass** [mustBomb,r23KeepExitBomb]<br>手牌: JH 9S 9S 9H 9H 9C 9D 8D 5H 3C

### 输家结束时手里还留着炸弹（每个输家座位）

- `self|2768007` 座1 结束时手里：QH 7D 10H 7S QD QS QC 7D 10S AD 9S
- `self|2768007` 座3 结束时手里：6D JS 7H JD 6S 8S JH 7S JC AS 8S
- `self|2768019` 座1 结束时手里：QH QS 6H 6C QH QS
- `self|2768022` 座2 结束时手里：7C 3S 4H 7H 4S 7D 3D 7D 4C 4S 3H 3C
- `self|2768052` 座0 结束时手里：KH KH KS KD

### 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10）

- `self|2768023|38` 座0 21张 敌最少13 对家11 级7 上手=pair:8 → **pair:7{7S 7C}** [followSize,keepControlPair,r28MidFollow]<br>手牌: 7H 7H 7S 7C AC AC KC KD QC QC 9H 9C 9C 9D 4H 4H 4D 3C 2C 2D 2D
- `self|2768133|27` 座0 22张 敌最少16 对家16 级10 上手=pair:J → **pair:10{10D 10S}** [followSize,keepControlPair,r28MidFollow]<br>手牌: RJ BJ 10H 10S 10C 10D KD QH QH QC QD QD 9H 7S 7C 7D 6D 5C 3H 2S 2H 2H
- `self|2768181|4` 座0 25张 敌最少25 对家27 级K 上手=pair:10 → **pair:K{KD KS}** [followSize,keepControlPair,r50NextFollow]<br>手牌: KH KS KD AD QS QH QH QC JS JS JH JC 10C 10C 9S 8C 6S 6C 4H 4C 3S 3S 3C 3D 3D
- `self|2768241|17` 座3 23张 敌最少21 对家21 级A 上手=pair:10 → **pair:A{AC AD}** [followSize,keepControlPair,r50NextFollow]<br>手牌: RJ BJ BJ AC AD KS KH KD QS QC QC JD 10D 10D 9H 9C 7S 7C 7D 6H 4S 3C 2D
- `self|2768354|26` 座3 21张 敌最少11 对家10 级10 上手=single:Q → **single:BJ{BJ}** [followUp,followSize,keepControl,r28MidFollow]<br>手牌: BJ 10S 10D KS KS KC KD QH JC JD 7S 7H 7D 6H 6C 6C 6D 4D 3H 3H 3C

### 拆炸弹领出

- `self|2768034|6` 座2 25张 敌最少25 对家25 级A 上手=pass → **straight:7{3D 4S 5S 6C 7D}** [bombBreakAlt,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: AH AS AC AD AD QD JH 10S 10D 9H 9D 8S 8C 7C 7D 6C 6D 5S 4S 3S 3H 3H 3D 2S 2C
- `self|2768039|26` 座1 18张 敌最少12 对家17 级3 上手=pass → **straight:10{6S 7D 8D 9D 10S}** [bombBreakNoGain,holdBombLead,control,planUnitFirst]<br>手牌: BJ AS AH AD AD KD 10S 9D 8D 7S 7H 7C 7D 6S 4H 4D 2H 2D

### decide 用时 >300ms 的比例

p50 1.6ms，p90 18.7ms，p99 58.8ms，max 999.5ms

- `self|2768016|52` 座0 13张 敌最少2 对家7 级Q 上手=fullhouse:6 → **bomb:9{9D 9S 9S 9D}** [noWasteJ,forceFinish:likely]<br>手牌: QH QH AS AH AH AC 9S 9S 9D 9D 8H 8C 8D
- `vsOld:pre-round61|5968032|74` 座3 14张 敌最少1 对家0 级8 上手=fullhouse:7 → **fullhouse:9{9D 9H 9H 2S 2S}** [stopShort,blockLikely]<br>手牌: RJ 8H 8H 8S QD 9S 9H 9H 9D 9D 2S 2S 2C 2D

### 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）

全部通过


### 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸）

不分有无孤张：还的点数手里原有 ≥2 张 72/200 (36%)（有的是顺子里多出的一张，拆牌计划认为更便宜）；还 >10 的牌（手里没有 ≤10，兜底）：0/200 (0%)


### Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5

分类：partner/mid/passed 3，lead/mid/otherPlay 1

- `self|2768211|61` partner 12张 张数8/12/19/15 级2 上手=pair:10<br>decide: **pass** (1.06) [] vs **pair:A{AH AH}** (+1.25, t=3.4, n=36)<br>手牌: 8S 2D AH AH 8H 2S 2H JD AC QD KH 10C
- `self|2768135|48` partner 12张 张数23/12/8/11 级A 上手=single:A<br>decide: **pass** (0.67) [] vs **bomb:K{KH KS KS AH}** (+1.22, t=3.7, n=36)<br>手牌: AS KH 7S KS 7H 6C AH 7D 6D KS AH 7D
- `self|2768198|12` partner 18张 张数19/27/18/24 级5 上手=fullhouse:2<br>decide: **pass** (-2.11) [] vs **fullhouse:6{6S 6C 6S JH JD}** (+1.14, t=2.9, n=36)<br>手牌: 6S 7C JH 9C 6C 3C 10H 4H JD 3D 9S 3S 6S BJ 3D 10C 3H 9H
- `self|2768225|43` lead 18张 张数16/8/18/24 级K 上手=pass<br>decide: **pairSeq:6{4S 4H 5D 5S 6S 6S}** (0.53) [leadSmallSame,holdBombLead,control,planUnitFirst] vs **fullhouse:8{8S 8D 8H 6S 6S}** (+0.89, t=2.8, n=36)<br>手牌: QS QH JC 6S 4S 8S QD 7S QH 3H 3S JD 6S 8D 8H 5D 5S 4H
