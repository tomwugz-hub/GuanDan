# 自对局体检报告

生成：2026/10/28 14:07:05（Asia/Shanghai）　policy：current　用时 606s

对局：【进贡比赛模式，每场 8 副】自对局 400 副（四家 decide），混合对手 Random、Greedy、Old:pre-activity、Old:pre-round6 各 20×2 副（换座位）；逐手记录 52012 条；surprise 局面 120 个。

局面 id 可复现：`node selfplay/audit.mjs --replay='<id>'`（cfg|seed|step）。

## 红旗（按 严重度 = 影响 × 超出程度 × log(样本) 排序）

- **Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5**：5.8%（n=120，合理区间 ≤5%，严重度 1.1）

## 全部检测器

| 检测器 | 值 | n | 合理区间 | 上次 | 状态 |
|---|---|---|---|---|---|
| 早中盘领出小单（≤10）后两个敌家都不跟 | 1.5% | 969 | ≤25% | 1.0% | OK |
| 早中盘领出小对（≤10）后两个敌家都不跟 | 4.4% | 434 | ≤35% | 2.8% | OK |
| 跟敌人牌过牌率（early，有牌可出时） | 44.0% | 7069 | ≥30 且 ≤62% | 44.3% | OK |
| 跟敌人牌过牌率（mid，有牌可出时） | 41.5% | 7367 | ≥30 且 ≤65% | 41.0% | OK |
| 跟敌人牌过牌率（late，有牌可出时） | 29.6% | 3230 | ≥20 且 ≤75% | 28.4% | OK |
| 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率 | 8.0% | 3467 | ≤35% | 7.7% | OK |
| 压对家的牌（early，有牌可压时） | 0.0% | 1916 | ≤15% | 0.0% | OK |
| 压对家的牌（mid，有牌可压时） | 0.2% | 2164 | ≤15% | 0.1% | OK |
| 压对家的牌（late，有牌可压时） | 17.7% | 913 | ≤30% | 18.8% | OK |
| 炸对家（未因此走完） | 0.0% | 4479 | ≤2% | 0.0% | OK |
| 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌 | 23.1% | 13 | ≤60% | 33.3% | 样本少 |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 1.4% | 1473 | ≤15% | 2.1% | OK |
| 敌家都 ≥10 张时领出炸弹（非走完） | 1.4% | 2268 | ≤10% | 1.4% | OK |
| 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌 | 2.0% | 196 | ≤45% | 5.5% | OK |
| 输家结束时手里还留着炸弹（每个输家座位） | 4.6% | 800 | ≤20% | 2.9% | OK |
| 输家结束时还握着 ≥2 张王/级牌 | 1.9% | 800 | ≤25% | 2.3% | OK |
| 末游卡手（结束时 ≥8 张且至少还要 5 手） | 0.0% | 400 | ≤25% | 0.0% | OK |
| 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10） | 2.0% | 2156 | ≤8% | 2.6% | OK |
| 早盘领出 A/级牌/王的单对 | 0.0% | 430 | ≤12% | 0.0% | OK |
| 拆炸弹领出 | 0.1% | 5137 | ≤2% | 0.1% | OK |
| 早盘拆对领单（手里有顺子/连对/钢板可出） | 0.5% | 184 | ≤15% | 1.0% | OK |
| 早盘领出对子占比 | 16.0% | 1347 | ≥5% | 15.0% | OK |
| 早盘领出单张占比 | 15.9% | 1347 | ≥15 且 ≤55% | 16.1% | OK |
| 一手能出完却没出完 | 0.0% | 1009 | ≤1% | 0.0% | OK |
| decide 用时 >300ms 的比例 | 0.1% | 43173 | ≤0.5% | 0.0% | OK |
| 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测） | 0.000 | 592 | ≤0 | 0.000 | OK |
| 对 Random 每副净升级 | 3.000 | 48 | ≥1.5 | 2.979 | OK |
| 对 Greedy 每副净升级 | 2.750 | 48 | ≥0.5 | 2.479 | OK |
| 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸） | 38.2% | 359 | ≤50% | 35.9% | OK |
| Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5 | 5.8% | 120 | ≤5% | 0.0% | 🚩 |

## 队伍结果

- 自对局 400 副：南北队每副净升级 -0.098 [-0.322, 0.127]（应≈0），双下率 45.8%，平均每副 88 手
- 各座位平均名次（南/东/北/西）：2.54 / 2.44 / 2.52 / 2.50
- decide vs Random：48 副，胜 48/48 (100%)，每副净升级 3.000 [3.000, 3.000]
- decide vs Greedy：48 副，胜 46/48 (96%)，每副净升级 2.750 [2.609, 2.891]
- decide vs Old:pre-activity：48 副，胜 44/48 (92%)，每副净升级 2.083 [1.474, 2.693]
- decide vs Old:pre-round6：48 副，胜 38/48 (79%)，每副净升级 1.542 [1.207, 1.876]

## 进贡

- 进贡比赛 74 场共 592 副；需进贡的副 468：单贡 228（抗贡 8/228 (4%)，理论≈6%），双下双贡 240（抗贡 62/240 (26%)，理论≈25%；贡牌同点 13）
- 贡牌分布：RJ 35%，BJ 28%，A 11%，5 4%，7 3%，8 3%，K 3%，J 3%，10 2%，Q 2%，6 2%，9 2%，4 2%，3 1%
- 自对局还贡点数分布（decide）：2 21%，3 17%，5 13%，4 11%，7 10%，6 10%，8 7%，10 6%，9 5%
- 自对局进贡副（未抗贡）进贡方每副净升级 -0.307 [-0.584, -0.029]（n=274；负 = 输家进贡后仍吃亏）
- 自对局抗贡副 抗贡方每副净升级 0.457 [-0.164, 1.077]（n=46）
- 进贡不变量（贡牌=最大非逢人配、双下大贡归头游/同点头游下家、抗贡判定、还贡≤10、先出者、交换后各 27 张、牌守恒）：全部通过（检查 592 副）

## 详情与示例局面

### 🚩 Monte Carlo 意外：另一着平均多 ≥0.6 级/副且 t≥2.5

分类：enemy/early/otherPlay 2，partner/mid/passed 1，lead/early/otherPlay 1，enemy/mid/passed 1，enemy/late/passed 1，enemy/mid/otherPlay 1

- `self|283200145|34` partner 14张 张数15/14/21/12 级5 上手=fullhouse:7<br>decide: **pass** (-0.11) [] vs **fullhouse:5{5C 5D 5S KC KS}** (+1.42, t=3.4, n=36)<br>手牌: 5C KC 9S RJ 8C 9C 5D 9S 8C KS 5S 4C 5H RJ
- `self|283200272|62` lead 20张 张数20/16/0/2 级Q 上手=pass<br>decide: **pairSeq:9{7H 7S 8S 9H 9S QH}** (1.08) [shortEnemyShape,unfollowableVsTwo,control,offPlan] vs **fullhouse:9{9H 9S 9C 3D 3D}** (+1.36, t=9.4, n=36)<br>手牌: 4D 10S 9H 7H 8S KS 7S 10H 3D 9S 3D 6C 10C KH 10H QH KC 7C 4H 9C
- `self|283200198|32` enemy 14张 张数14/14/13/4 级K 上手=pair:A<br>decide: **pass** (-0.47) [r23KeepExitBomb] vs **bomb:3{3C 3D 3D KH}** (+1.28, t=3.6, n=36)<br>手牌: 5H KH 7S JC 5H 2H 3C 3D 3D 9D 5C 2S 9D 5S
- `self|283200055|23` enemy 26张 张数26/23/16/24 级8 上手=single:BJ<br>decide: **single:RJ{RJ}** (0.03) [followUp,breakNoOrphan,followSize,keepControl,r50NextFollow] vs **bomb:3{3C 3D 3C 8H}** (+1.17, t=3.2, n=36)<br>手牌: 8H 8D 8C 3C AS 7H 4C JH JS 3D 4S AD 3C 7S 10C 10C 6C AC 2C BJ AD 2S 6S RJ 7S RJ
- `self|283200307|6` enemy 26张 张数26/26/26/26 级5 上手=single:A<br>decide: **single:5{5C}** (-0.28) [followUp,followSize,keepControl,spareControl] vs **single:BJ{BJ}** (+1.00, t=2.9, n=36)<br>手牌: 2S 5C 3C 9C JD 8S 6H 4H 2C 2D AS 9S 2H 8D BJ 10S 2D AS JH 3D 3D JD JS 7H 10H BJ
- `self|283200064|63` enemy 9张 张数20/9/8/10 级Q 上手=single:J<br>decide: **pass** (0.56) [] vs **bomb:Q{QD QD QS QH}** (+0.97, t=3.2, n=36)<br>手牌: QD QD KD 10H KS QH KC 10S QS
- `self|283200355|21` enemy 16张 张数16/11/21/19 级K 上手=pair:7<br>decide: **pair:Q{QH QD}** (1.06) [followSize,activeFollow:0] vs **pair:A{AH AC}** (+0.89, t=2.9, n=36)<br>手牌: AH AC 2H AS 4D 2S 2H 5D QH KD RJ 5C KS QD 4H KS

### 早中盘领出小单（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：15/15 (100%)

- `self|283200069|26` 座1 25张 敌最少13 对家7 级8 上手=single:10 → **pass** []<br>手牌: RJ BJ 8H 8C 8D KS KH KC QS QH JH JC 10H 10D 7S 7S 5H 5H 5C 5C 5D 4S 4C 4D 3C
- `self|283200195|66` 座2 16张 敌最少10 对家11 级K 上手=single:10 → **pass** []<br>手牌: 9S 9H 9H 9C 9D 8H 8D 7S 7H 6H 6C 6D 5S 5S 5H 3S
- `self|283200229|69` 座1 13张 敌最少12 对家12 级A 上手=single:10 → **pass** []<br>手牌: AH 9H 9C 9C 9D 5S 5H 5C 5D 3S 3S 3H 3D
- `self|283200326|62` 座2 9张 敌最少10 对家13 级9 上手=single:6 → **pass** []<br>手牌: 10S 10S 10H 10C 5S 5S 5H 4S 4H
- `self|283200531|56` 座0 10张 敌最少10 对家16 级6 上手=single:7 → **pass** []<br>手牌: 6H 6H KS KH KC KC 7S 2H 2C 2D

### 早中盘领出小对（≤10）后两个敌家都不跟

其中至少一个敌家有非炸弹可跟：17/19 (89%)

- `self|283200005|64` 座2 8张 敌最少10 对家11 级A 上手=pair:3 → **pass** []<br>手牌: 6S 6C 6C 6D 5H 5C 5D 5D
- `self|283200209|78` 座1 8张 敌最少6 对家8 级9 上手=pair:3 → **pass** []<br>手牌: 9H JS JH JH 4S 4H 4C 4D
- `self|283200262|57` 座0 10张 敌最少9 对家11 级8 上手=pair:10 → **pass** []<br>手牌: 8H QS QS QH QD 10C 4S 4H 4C 4C
- `self|283200357|68` 座2 12张 敌最少7 对家9 级9 上手=pair:10 → **pass** []<br>手牌: 9H 6D 5S 5S 5C 5D 4S 4H 4D 2C 2C 2D
- `self|283200480|99` 座0 10张 敌最少12 对家12 级Q 上手=pair:3 → **pass** []<br>手牌: 10S 10S 10H 10C 9S 2S 2S 2H 2C 2D

### 跟敌人牌过牌率（early，有牌可出时）

- `self|283200000|7` 座2 27张 敌最少16 对家27 级8 上手=straight:Q → **pass** []<br>手牌: 8H 8D AC KH KC QS QH QC JH JD 10S 10H 10C 10D 9S 9C 7H 7D 6S 6D 6D 5S 5D 4S 4S 4H 3S
- `self|283200147|9` 座3 23张 敌最少21 对家27 级5 上手=pair:A → **pass** []<br>手牌: 5S 5S 5C AS AH KH KC QH QH 8C 8D 6C 6D 6D 4H 4C 4C 4D 3S 3H 3H 2S 2H
- `self|283200311|2` 座3 27张 敌最少22 对家22 级A 上手=straight:10 → **pass** []<br>手牌: RJ RJ BJ BJ AH AS AC AD KH KD QC 10H 10C 9H 9D 8S 8S 6H 6C 6D 6D 5H 5H 4H 4H 3H 3C
- `self|283200471|27` 座2 24张 敌最少18 对家16 级8 上手=pair:A → **pass** []<br>手牌: BJ BJ 8H AH KS KS KH KC QH QC JS 10S 10C 9S 9D 6S 6S 6D 5H 5H 5D 4D 3C 2C
- `self|283200629|7` 座3 27张 敌最少16 对家21 级A 上手=straight:8 → **pass** []<br>手牌: RJ BJ BJ AH AH AD KC KD QH QD JS JH JC JD 10D 9C 8S 8S 7H 7C 7D 7D 5S 5C 4D 2S 2C

### 跟敌人牌过牌率（mid，有牌可出时）

- `self|283200000|50` 座1 10张 敌最少4 对家5 级8 上手=fullhouse:4 → **pass** []<br>手牌: RJ 8C 8D QH JS JH JC JD 10H 9S
- `self|283200160|38` 座1 13张 敌最少7 对家21 级5 上手=fullhouse:4 → **pass** [r14NoPass]<br>手牌: 5H 5D AH JS JH JC JD JD 10S 10H 9S 9C 7D
- `self|283200289|92` 座2 11张 敌最少5 对家0 级A 上手=single:9 → **pass** [noSFon8]<br>手牌: JS JH JH JC JC 10S 10H 10C 5C 5D 4H
- `self|283200449|24` 座0 13张 敌最少13 对家24 级K 上手=single:A → **pass** []<br>手牌: KH AS AH 8S 7H 7D 6H 6C 6D 3S 3H 3H 3C
- `self|283200610|32` 座0 17张 敌最少10 对家24 级9 上手=pair:Q → **pass** []<br>手牌: 9H 9H 9S QH QC QD QD JS JH JC JC 10S 10H 10C 5S 5H 4H

### 跟敌人牌过牌率（late，有牌可出时）

- `self|283200000|67` 座2 2张 敌最少3 对家14 级8 上手=single:Q → **pass** []<br>手牌: 8H 6D
- `self|283200132|79` 座3 7张 敌最少7 对家5 级J 上手=triple:Q → **pass** []<br>手牌: AS AS AC AD AD 5S 5C
- `self|283200292|45` 座1 9张 敌最少5 对家16 级2 上手=pair:6 → **pass** []<br>手牌: 2H 2H KS KH KD KD QS JH 8D
- `self|283200417|67` 座1 9张 敌最少5 对家21 级9 上手=single:A → **pass** []<br>手牌: 9H 9H QH QC 8S 8D 5S 5S 5C
- `self|283200592|80` 座1 8张 敌最少8 对家14 级6 上手=single:5 → **pass** []<br>手牌: 9S 9H 9C 9C 4S 4S 4H 4C

### 早中盘跟敌人小单/小对（≤10，有非炸弹可跟）过牌率

按座位 南/东/北/西：84/856 (10%) / 68/853 (8%) / 65/895 (7%) / 59/863 (7%)

- `self|283200003|21` 座2 27张 敌最少15 对家14 级J 上手=pair:10 → **pass** []<br>手牌: RJ BJ JS JD KS KH KD KD QS 10H 10D 8S 8H 8H 8D 7H 7C 6H 6C 6D 5H 5D 4S 4H 4C 3S 3C
- `self|283200163|16` 座1 23张 敌最少19 对家25 级J 上手=pair:5 → **pass** []<br>手牌: JH JD KH KH KC KD QS 10S 10H 10C 10D 8H 7S 7H 7C 7D 6D 5D 4C 4D 3S 3H 3D
- `self|283200289|69` 座0 10张 敌最少11 对家12 级A 上手=single:10 → **pass** []<br>手牌: AH 10D 3S 3S 3C 3D 2H 2C 2C 2D
- `self|283200480|87` 座0 10张 敌最少12 对家15 级Q 上手=single:9 → **pass** [noSFon8]<br>手牌: 10S 10S 10H 10C 9S 2S 2S 2H 2C 2D
- `self|283200599|21` 座2 26张 敌最少16 对家10 级10 上手=single:A → **pass** []<br>手牌: RJ 10C KS KH KD QS QH QC 8H 8D 7H 7C 6S 6S 6H 6H 5C 5D 4H 4C 4D 3S 3S 3C 2S 2D

### 压对家的牌（mid，有牌可压时）

- `self|283200036|73` 座1 11张 敌最少2 对家3 级A 上手=single:K → **single:A{AS}** [followUp]<br>手牌: AS AC KH KC QH 10C 8H 6H 6H 6C 5S
- `self|283200067|77` 座0 10张 敌最少1 对家1 级4 上手=triple:Q → **triple:4{4S 4D 4H}** [forceFinish:sure,blockSure]<br>手牌: 4H 4S 4D KD KD 8S 5S 5H 5C 5D
- `self|283200497|55` 座3 10张 敌最少15 对家12 级A 上手=fullhouse:2 → **fullhouse:3{3S 3C 3C 6D 6C}** []<br>手牌: QH QC 6C 6D 3S 3C 3C 2H 2H 2C
- `self|283200498|56` 座0 12张 敌最少2 对家6 级A 上手=pair:Q → **pair:A{AS AH}** [blockLikely]<br>手牌: BJ AH AH AS 10S 10D 8D 6H 6C 6D 5S 5S
- `self|283200563|67` 座2 10张 敌最少2 对家9 级K 上手=single:J → **single:Q{QS}** [followUp]<br>手牌: QS 3S 3S 3H 3H 3C 3C 2H 2C 2C

### 压对家的牌（late，有牌可压时）

- `self|283200002|59` 座0 4张 敌最少6 对家6 级Q 上手=fullhouse:10 → **bomb:3{3C 3H 3S QH}** [goOut]<br>手牌: QH 3S 3H 3C
- `self|283200177|68` 座2 3张 敌最少1 对家2 级9 上手=pair:5 → **pair:K{KD KS}** []<br>手牌: AS KS KD
- `self|283200338|100` 座0 4张 敌最少8 对家8 级5 上手=single:10 → **bomb:3{3H 3H 3C 3S}** [goOut]<br>手牌: 3S 3H 3H 3C
- `self|283200483|75` 座3 5张 敌最少1 对家0 级5 上手=single:J → **single:A{AH}** [followUp,forceFinish:sure,blockSure]<br>手牌: AH AD KH KC QD
- `self|283200640|68` 座3 4张 敌最少9 对家2 级9 上手=bomb:7 → **bomb:10{10H 10D 10H 10S}** [goOut]<br>手牌: 10S 10H 10H 10D

### 对家出小单/对（≤8）、下家敌人 ≤3 张、对家还有 ≥4 张、有不拆炸的非炸弹可压时仍过牌

旧口径（含拆炸/只有炸弹可压）：3/13 (23%)；其中不拆三张也能压：3/13 (23%)；只能拆三张才能压：0/0 (0%)

- `self|283200244|73` 座0 6张 敌最少3 对家17 级2 上手=pair:3 → **pass** [可压:pair:K{KD 2H} / pair:4{4C 2H}]<br>手牌: 2H KD 4C 3S 3H 3C
- `self|283200327|64` 座1 7张 敌最少3 对家4 级8 上手=single:10 → **pass** [可压:single:Q{QS} / single:J{JS} / single:K{KS}]<br>手牌: RJ KS QS QH JS 5S 5D
- `self|283200417|83` 座1 9张 敌最少3 对家12 级9 上手=single:5 → **pass** [可压:single:Q{QC} / single:8{8D} / single:9{9H}]<br>手牌: 9H 9H QH QC 8S 8D 5S 5S 5C

### 敌家都 ≥15 张时炸普通牌（占跟牌炸弹）

每副炸弹数（自对局，四人合计）：早 0.90 / 中 2.69 / 晚 2.08

- `self|283200099|81` 座2 6张 敌最少15 对家6 级3 上手=triple:J → **bomb:7{7S 7C 7S 3H}** [mustBomb]<br>手牌: 3H 3S AS 7S 7S 7C
- `self|283200341|78` 座0 8张 敌最少18 对家0 级6 上手=fullhouse:7 → **bomb:5{5H 5S 5D 5S}** [noWasteJ,mustBomb,forceFinish:likely]<br>手牌: 6H AC 5S 5S 5H 5D 4H 4H
- `self|283200496|77` 座0 14张 敌最少19 对家7 级K 上手=straight:10 → **bomb:4{4D 4C 4H 4H}** [mustBomb]<br>手牌: KS KS KC KD 10S 10C 5C 5D 4S 4H 4H 4C 4D 3S
- `self|283200597|59` 座2 11张 敌最少15 对家7 级K 上手=straight:7 → **bomb:7{7D 7S 7H KH}** [mustBomb]<br>手牌: BJ KH KC AD 7S 7H 7D 3S 3H 2S 2C
- `self|283200768|53` 座2 18张 敌最少17 对家4 级4 上手=fullhouse:K → **bomb:7{7D 7C 7H 7C}** [noWasteJ,mustBomb]<br>手牌: BJ 4D AS AH QH QC QD QD 8S 8H 7H 7C 7C 7D 6C 6D 3S 3D

### 敌家都 ≥10 张时领出炸弹（非走完）

炸压炸占跟牌炸弹：569/2042 (28%)

- `self|283200055|57` 座2 12张 敌最少11 对家14 级8 上手=pass → **bomb:6{6C 6H 6S 6H}** [bombClear,control]<br>手牌: 10S 10S 10H 10D 9S 9S 9H 9C 6S 6H 6H 6C
- `self|283200163|79` 座0 10张 敌最少10 对家8 级J 上手=pass → **bomb:6{6H 6S 6C 6S}** [bombClear,control]<br>手牌: 9S 9H 9H 9C 9D 9D 6S 6S 6H 6C
- `self|283200229|76` 座0 9张 敌最少12 对家12 级A 上手=pass → **bomb:8{8S 8C 8D 8H}** [bombClear,control]<br>手牌: AH QS QS QD QD 8S 8H 8C 8D
- `self|283200338|85` 座3 9张 敌最少10 对家8 级5 上手=pass → **bomb:6{6C 6D 6H 6S}** [bombClear,control]<br>手牌: 9S 9H 9C 9D 9D 6S 6H 6C 6D
- `self|283200421|60` 座3 9张 敌最少15 对家16 级2 上手=pass → **bomb:10{10D 10H 10S 10C}** [bombClear,control]<br>手牌: 10S 10H 10C 10D 3S 3H 3C 3D 3D

### 敌人出牌后只剩 ≤3 张、我只能用炸弹压却过牌

- `self|283200080|50` 座0 10张 敌最少2 对家11 级K 上手=fullhouse:7 → **pass** []<br>手牌: RJ BJ KH QC 7D 6S 6S 6C 6D 5D
- `self|283200274|78` 座3 10张 敌最少3 对家2 级A 上手=fullhouse:J → **pass** []<br>手牌: AH QD JS JH JC 8D 4S 4D 3S 3C
- `self|283200320|73` 座1 20张 敌最少2 对家1 级2 上手=pair:Q → **pass** []<br>手牌: 2C AC KS 9C 9C 9D 7S 7H 7C 6H 6C 6C 6D 6D 5S 5H 5D 4D 3C 3D
- `self|283200790|48` 座0 14张 敌最少3 对家3 级A 上手=fullhouse:7 → **pass** []<br>手牌: AH JH 7S 6S 6D 5H 5C 5D 3S 3C 3C 3D 2S 2H

### 输家结束时手里还留着炸弹（每个输家座位）

- `self|283200002` 座3 结束时手里：QH KS KC 2H 2C JC 2H
- `self|283200003` 座1 结束时手里：9S 9C 9D 9H
- `self|283200003` 座3 结束时手里：AD JH JS QC 8C QC 7D QH 5S 9C
- `self|283200016` 座1 结束时手里：JD JC JC 8S 8H 8D JH 8C
- `self|283200016` 座3 结束时手里：7D 7S 7S 7C

### 早盘（≥20 张）用王/级牌/逢人配出小单对（领出或压 ≤10）

- `self|283200019|15` 座3 22张 敌最少22 对家24 级K 上手=single:9 → **single:K{KD}** [noSFon8,followUp,breakNoOrphan,followSize,keepControl,r28MidFollow]<br>手牌: RJ RJ KH KD KD JS JH JC JC 8C 6S 6C 6D 5S 5H 4C 4C 4D 2S 2H 2C 2D
- `self|283200196|6` 座0 25张 敌最少25 对家25 级10 上手=pair:K → **pair:10{10D 10C}** [followSize,keepControlPair,r50NextFollow]<br>手牌: 10H 10C 10D AH KS KH KD QH QC 9H 9C 8C 8D 5S 5S 5H 5C 5D 5D 4H 4C 3S 3H 2S 2C
- `self|283200354|13` 座3 21张 敌最少23 对家27 级10 上手=pair:A → **pair:RJ{RJ RJ}** [followSize,keepControlPair,r28MidFollow]<br>手牌: RJ RJ 10H AS AC AD KS KC KD JC 7S 7H 7D 5H 5D 5D 4S 4H 4C 4D 3H
- `self|283200501|33` 座1 21张 敌最少10 对家11 级A 上手=single:7 → **single:BJ{BJ}** [followUp,followSize,keepControl,r28MidFollow]<br>手牌: BJ AC AD KH KC QS QC JC JD 10S 10S 10H 10H 10C 10D 6H 6C 4S 4H 4D 3C
- `self|283200656|35` 座0 22张 敌最少13 对家14 级10 上手=single:K → **single:RJ{RJ}** [followUp,breakNoOrphan,followSize,keepControl,r50NextFollow]<br>手牌: RJ RJ 10H AS AH AH AC QH QC QC QD JH 9D 8H 8D 4S 4H 4C 3S 3C 3C 3D

### 拆炸弹领出

- `self|283200144|10` 座2 22张 敌最少22 对家22 级4 上手=pass → **straight:K{9S 10D JH QH KC}** [bombBreakNoGain,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: 4D KC QH JH 10D 9S 9S 9C 9D 8S 8D 7C 7C 6H 5S 5S 5H 5D 3S 3S 2C 2D
- `self|283200181|61` 座3 15张 敌最少5 对家8 级K 上手=pass → **straight:Q{8C 9S 10H JH QH}** [bombBreakNoGain,holdBombLead,control,planUnitFirst]<br>手牌: KS KD AS AC QS QS QH QH JH 10H 9S 8C 6H 6D 4S
- `self|283200464|11` 座2 15张 敌最少21 对家27 级J 上手=pass → **tripleSeq:5{4C 4S 4H 5S 5D 5S}** [bombBreakNoGain,holdBombLead,control,planUnitFirst]<br>手牌: RJ BJ AS QS 9C 8D 7H 6H 5S 5S 5H 5D 4S 4H 4C
- `self|283200707|16` 座1 20张 敌最少20 对家18 级A 上手=pass → **straight:10{6S 7H 8S 9S 10C}** [bombBreakNoGain,leadSmallSame,holdBombLead,control,planUnitFirst]<br>手牌: BJ AS AD JS JD 10C 9S 9H 9D 9D 8S 7H 6S 5S 5S 4C 4C 4D 4D 3C

### 早盘拆对领单（手里有顺子/连对/钢板可出）

- `self|283200705|27` 座3 25张 敌最少19 对家18 级A 上手=pass → **single:8{8H}** [control]<br>手牌: RJ BJ AH AS QH JS JH JD 10S 10H 10C 10D 9H 9C 8S 8H 7D 6S 6C 5H 5C 4H 4C 3C 2C

### 早盘领出单张占比

早盘领出牌型分布：straight 22%，pairSeq 20%，pair 16%，single 16%，fullhouse 13%，tripleSeq 10%，triple 3%；熵 2.66 bit


### decide 用时 >300ms 的比例

p50 3ms，p90 32.2ms，p99 110.9ms，max 738ms

- `self|283200545|8` 座2 16张 敌最少22 对家27 级4 上手=straight:7 → **straight:K{9H 10S JC QD KC}** []<br>手牌: 4H 4H AS AC KC QC QD JS JC 10S 9H 9H 9C 5H 3C 3C
- `self|283200768|0` 座1 27张 敌最少27 对家27 级4 上手=pass → **single:3{3H}** [noFirstBomb,control,planWeakFirst]<br>手牌: 4H 4S 4S 4D AC KH KC KC 10D 10D 9S 9H 9D 8C 8C 8D 8D 7S 7H 6H 6C 5S 3H 2S 2S 2C 2C
- `self|283200096|0` 座1 27张 敌最少27 对家27 级A 上手=pass → **single:3{3S}** [noFirstBomb,control,planWeakFirst]<br>手牌: BJ AH AH AC AD KS KC KC QS QC JS 10S 10H 9H 9C 9D 8S 8C 7S 7S 7C 6S 5S 5C 4S 4H 3S
- `self|283200114|21` 座2 16张 敌最少16 对家11 级3 上手=fullhouse:4 → **fullhouse:7{7S 7D 7C 4S 4D}** []<br>手牌: BJ 3H 3H 3D 10S 8S 8S 8H 7S 7C 7D 6H 5S 5H 4S 4D
- `self|283200338|56` 座2 16张 敌最少13 对家12 级5 上手=fullhouse:9 → **pass** []<br>手牌: 5H 5H AS AH AC AD AD QH QD QD JS JS JH JD 10C 8D

### 对局不变量违例（张数守恒/出牌顺序/接风/合法/领出不过/能结束/对家检测）

全部通过


### 自对局还贡：手里有 ≤10 的孤张却还了有同点的牌（拆对/三张/炸）

不分有无孤张：还的点数手里原有 ≥2 张 150/372 (40%)（有的是顺子里多出的一张，拆牌计划认为更便宜）；还 >10 的牌（手里没有 ≤10，兜底）：0/372 (0%)

