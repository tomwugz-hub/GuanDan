# Jev 接入体检（2026/10/19 16:44:29 Asia/Shanghai）

设置：Jev 队（spec jev = Jev 在 decide 候选里选，decide 兜底）vs decide 队（current），进贡比赛 matchLen=8，seed0=4100000，换座位配对。

## 擂台

jev vs current: 208 副（换座位配对），A 胜 101/208 = 48.6% [95% CI 42.6–54.5]，A 每副净升级 -0.058 [-0.345, 0.230]，A 双上 26 / 被双上 28，不变量违例 0；进贡比赛 13 场配对，进贡副 168（抗贡 19，双下双贡 40），A 方还贡的副 A 均分 0.368（n=68），B 方还贡的副 A 均分 -0.198（n=81）

## Jev 调用

- Jev 座位决策 9606（46.2/副）：跳过 单候选 5607、decide 一手出完 283；需要 Jev 3716（17.9/副），缓存命中 0，真实调用 3716（17.9/副，尝试 3716 次）
- 兜底 0（0.00%）：{}
- 延迟（含子进程 ~80ms）：p50 405ms，p95 487ms，max 681ms（n=3716）
- 用量（API usage）：输入 6716383 tok（1807/次），输出 161840；费用 = 输入 × $0.042/1M = **$0.2821**（$0.00136/副；外推 200 副 $0.271，1000 副 $1.356，不含缓存命中节省）
- Jev 与 decide 一致 2926、分歧 790（分歧率 21.3%）；不变量违例 0

## 行为对比（同一批对局，Jev 座位 vs decide 座位）

| 指标 | Jev | decide |
|---|---|---|
| 跟敌人过牌率（early，有牌可出） | 52.6% (1184/2252) | 49.7% (1008/2029) |
| 跟敌人过牌率（mid，有牌可出） | 56.5% (1136/2012) | 59.7% (1259/2110) |
| 跟敌人过牌率（late，有牌可出） | 34.3% (181/527) | 47.3% (379/802) |
| 压对家（early，有牌可压） | 0.0% (0/682) | 0.0% (0/647) |
| 压对家（mid，有牌可压） | 0.0% (0/866) | 0.4% (3/673) |
| 压对家（late，有牌可压） | 12.9% (26/202) | 9.8% (25/256) |
| 炸对家（未走完） | 0.0% (0/1664) | 0.0% (0/1489) |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 12.9% (31/241) | 15.7% (37/236) |
| 敌家都 ≥10 张时领出炸弹（占炸弹） | 3.6% (20/550) | 4.7% (26/555) |
| 炸弹用逢人配（占炸弹） | 21.8% (120/550) | 22.7% (126/555) |
| 非炸弹着法用逢人配（占出牌） | 1.7% (64/3729) | 1.7% (62/3586) |
| 敌出牌后 ≤3 张、只能炸却过 | 14.5% (11/76) | 2.9% (2/70) |
| 早盘用王/级牌/逢人配出小单对 | 1.9% (15/771) | 1.1% (7/633) |
| 早盘领出 A/级牌/王的单对 | 6.3% (16/256) | 0.0% (0/116) |
| 拆炸弹领出 | 1.1% (19/1746) | 0.3% (4/1597) |
| 拆炸弹跟牌（非炸弹着法） | 0.5% (10/1915) | 0.5% (9/1924) |
| 一手能出完却没出完 | 0.0% (0/281) | 0.0% (0/286) |
| 早盘领出 single 占比 | 41.2% (182/442) | 17.8% (72/404) |
| 早盘领出 pair 占比 | 16.7% (74/442) | 10.9% (44/404) |
| 早盘领出 fullhouse 占比 | 17.2% (76/442) | 21.0% (85/404) |
| 早盘领出 straight 占比 | 6.3% (28/442) | 19.1% (77/404) |
| 早盘领出 pairSeq 占比 | 10.9% (48/442) | 18.1% (73/404) |
| 早盘领出 tripleSeq 占比 | 3.2% (14/442) | 8.7% (35/404) |
| 早盘领出 triple 占比 | 4.3% (19/442) | 4.5% (18/404) |
| 领出炸弹（中晚盘，非走完） | 3.0% (39/1304) | 3.5% (42/1193) |
| 每副每队炸弹数 | 1.32 | 1.33 |

## 分歧分布

- lead/early：分歧 47.6% (209/439)
- lead/mid：分歧 39.9% (283/709)
- lead/late：分歧 30.7% (106/345)
- enemy/early：分歧 8.1% (89/1104)
- enemy/mid：分歧 9.5% (89/940)
- enemy/late：分歧 8.0% (14/176)
- partner/late：分歧 0.0% (0/3)
- Jev 选的候选序号分布：{"0":2038,"1":1396,"2":174,"3":65,"4":24,"5":12,"6":3,"7":4}

| 分歧类别 | 次数 |
|---|---|
| lead:同型换点 | 168 |
| enemy:都出、换牌 | 128 |
| lead:牌型 fullhouse→single | 68 |
| lead:牌型 pair→single | 59 |
| lead:牌型 straight→pair | 42 |
| lead:牌型 straight→single | 40 |
| enemy:decide 过→Jev 出 | 39 |
| lead:牌型 pairSeq→single | 28 |
| lead:牌型 straight→fullhouse | 27 |
| lead:牌型 triple→single | 25 |
| lead:牌型 pair→fullhouse | 23 |
| lead:牌型 triple→fullhouse | 17 |
| lead:牌型 single→pair | 14 |
| enemy:decide 炸→Jev 过 | 13 |
| lead:牌型 pairSeq→pair | 13 |
| lead:牌型 tripleSeq→single | 11 |
| enemy:Jev 普通（decide 炸） | 10 |
| lead:牌型 tripleSeq→fullhouse | 8 |
| lead:Jev 领炸 | 7 |
| lead:牌型 fullhouse→pair | 6 |
| lead:牌型 straight→triple | 5 |
| lead:牌型 single→triple | 5 |
| lead:牌型 tripleSeq→pair | 4 |
| lead:牌型 pairSeq→fullhouse | 4 |
| lead:牌型 tripleSeq→triple | 4 |
| lead:牌型 fullhouse→triple | 3 |
| lead:牌型 single→fullhouse | 3 |
| lead:牌型 bomb→pair | 2 |
| enemy:decide 过→Jev 炸 | 2 |
| lead:牌型 tripleSeq→pairSeq | 2 |
| lead:牌型 bomb→single | 2 |
| lead:牌型 fullhouse→pairSeq | 2 |
| lead:牌型 triple→pair | 1 |
| lead:牌型 single→pairSeq | 1 |
| lead:牌型 triple→straight | 1 |
| lead:牌型 bomb→triple | 1 |
| lead:牌型 pairSeq→triple | 1 |
| lead:牌型 pairSeq→straight | 1 |

## 分歧 MC 判定（抽样 200，有效 197，跳过 3：{"notStopped":1,"noDisagree":1,"diverged":1}；k=40，同一组确定化，后续全 decide）

- 判定（|diff|≥0.3 且 |t|≥2）：Jev 对 15、decide 对 18、差不多 164；平均 diff（Jev−decide）-0.039 级

| 类别 | n | 平均 diff | Jev 对 | decide 对 | 差不多 |
|---|---|---|---|---|---|
| lead:同型换点 | 41 | -0.057 | 1 | 3 | 37 |
| enemy:都出、换牌 | 30 | +0.007 | 4 | 4 | 22 |
| lead:牌型 pair→single | 20 | -0.060 | 2 | 1 | 17 |
| lead:牌型 fullhouse→single | 15 | -0.295 | 1 | 3 | 11 |
| lead:牌型 pair→fullhouse | 9 | -0.014 | 0 | 1 | 8 |
| lead:牌型 straight→pair | 8 | -0.209 | 0 | 1 | 7 |
| lead:牌型 straight→single | 8 | -0.197 | 0 | 1 | 7 |
| lead:牌型 straight→fullhouse | 8 | -0.075 | 0 | 0 | 8 |
| enemy:decide 过→Jev 出 | 8 | +0.341 | 1 | 0 | 7 |
| lead:牌型 pairSeq→pair | 6 | +0.242 | 1 | 0 | 5 |
| lead:牌型 pairSeq→single | 5 | -0.215 | 0 | 1 | 4 |
| lead:Jev 领炸 | 4 | +0.131 | 1 | 0 | 3 |
| lead:牌型 triple→fullhouse | 3 | -0.200 | 0 | 0 | 3 |
| lead:牌型 triple→single | 3 | -0.367 | 0 | 1 | 2 |
| enemy:Jev 普通（decide 炸） | 3 | +0.075 | 0 | 0 | 3 |
| lead:牌型 tripleSeq→single | 3 | +0.167 | 0 | 0 | 3 |
| lead:牌型 single→pair | 3 | +0.175 | 1 | 0 | 2 |
| lead:牌型 tripleSeq→pair | 3 | -0.200 | 0 | 1 | 2 |
| lead:牌型 tripleSeq→fullhouse | 2 | -0.175 | 0 | 0 | 2 |
| lead:牌型 single→fullhouse | 2 | +0.712 | 2 | 0 | 0 |
| enemy:decide 炸→Jev 过 | 2 | +0.125 | 0 | 0 | 2 |
| lead:牌型 fullhouse→pair | 2 | -0.500 | 0 | 0 | 2 |
| lead:牌型 single→triple | 2 | -0.438 | 0 | 1 | 1 |
| lead:牌型 fullhouse→pairSeq | 1 | +0.075 | 0 | 0 | 1 |
| lead:牌型 pairSeq→fullhouse | 1 | +0.100 | 0 | 0 | 1 |
| lead:牌型 tripleSeq→triple | 1 | -0.250 | 0 | 0 | 1 |
| lead:牌型 triple→pair | 1 | +0.000 | 0 | 0 | 1 |
| lead:牌型 single→pairSeq | 1 | +0.000 | 0 | 0 | 1 |
| lead:牌型 triple→straight | 1 | +2.075 | 1 | 0 | 0 |
| enemy:decide 过→Jev 炸 | 1 | +0.075 | 0 | 0 | 1 |

### decide 明显更好（Jev 的错）

- `arenaA1|65600181|39` 座1 9张 lead/late 张数20/9/17/16 级J 上手=pass diff **-1.850** (t=-5.9)<br>decide: **single:J{JH}** [leadNoWild,control,offPlan] 分 -95；Jev: **single:6{6S}** [bombBreakAlt,control,offPlan] 分 -110<br>Jev 标签：单张 6 [6S] [领出] [拆计划：会多出手数]<br>手牌：JH QS QS QH QC 6S 6H 6H 6C
- `arenaA0|65600087|58` 座0 18张 enemy/mid 张数18/1/8/16 级7 上手=single:RJ diff **-1.600** (t=-5.2)<br>decide: **bomb:Q{QS QC QC QH}** [mustBomb] 分 134；Jev: **bomb:5{5S 5D 5C 7H}** [mustBomb,blockNatBomb] 分 119<br>Jev 标签：4 炸 5 [5S 5D 5C 7H] [炸弹] [逢人配补成炸弹：用掉1张红桃7]<br>手牌：7H AS KH KC QS QH QC QC 8S 8H 8C 6C 6D 6D 5S 5C 5D 2H
- `arenaA1|65600033|69` 座1 14张 lead/mid 张数18/14/9/11 级A 上手=pass diff **-1.125** (t=-2.8)<br>decide: **fullhouse:J{JS JD JH QD QS}** [fhAttach,leadSmallSame,control,offPlan] 分 -97；Jev: **single:4{4H}** [bombBreakNoGain,control,offPlan] 分 -127<br>Jev 标签：单张 4 [4H] [领出] [拆计划：会多出手数]<br>手牌：QS QH QC QC QD JS JS JH JD JD 4H 4C 4C 4D
- `arenaA0|65600038|85` 座2 5张 lead/late 张数0/0/5/9 级2 上手=pass diff **-1.000** (t=-99.0)<br>decide: **single:J{JH}** [shortEnemyShape,control,forceFinish:likely] 分 146；Jev: **triple:5{5S 5H 5D}** [shortEnemyShape,control] 分 98<br>Jev 标签：三张 5 [5S 5H 5D] [领出] [顶敌人：敌人剩1张接不住]<br>手牌：QH JH 5S 5H 5D
- `arenaA1|65600131|40` 座1 16张 lead/mid 张数17/16/9/20 级9 上手=pass diff **-0.925** (t=-2.8)<br>decide: **pair:3{3C 3D}** [control,planWeakFirst] 分 47；Jev: **fullhouse:J{JC JC JH 3C 3D}** [leadSmallSame,control] 分 -1<br>Jev 标签：三带二 J [JC JC JH 3C 3D] [领出]<br>手牌：AH AH QS QH QC JH JC JC 7S 7D 4S 4C 4D 4D 3C 3D
- `arenaA0|65600113|4` 座0 26张 lead/early 张数26/27/27/27 级5 上手=pass diff **-0.900** (t=-2.5)<br>decide: **straight:7{3C 4S 5D 6D 7S}** [leadSmallSame,holdBombLead,control,planUnitFirst] 分 51；Jev: **pair:8{8C 8D}** [leadSmallSame,control,offPlan] 分 -32<br>Jev 标签：对子 8 [8C 8D] [领出]<br>手牌：5C 5D AH AC AD KD QH QC JD 10S 10S 10D 9S 9C 8C 8D 7S 6S 6D 4S 3C 2S 2H 2C 2D 2D
- `arenaA1|65600147|30` 座3 21张 lead/early 张数18/17/18/21 级8 上手=pass diff **-0.875** (t=-2.2)<br>decide: **straight:J{7S 8D 9S 10C JH}** [holdBombLead,control,planUnitFirst] 分 50；Jev: **single:4{4H}** [control] 分 1<br>Jev 标签：单张 4 [4H] [孤儿小单：最小的孤单]<br>手牌：RJ 8D AH KS KH KC KD QS QS QH QH JH 10S 10H 10C 9S 7S 5C 4H 2S 2D
- `arenaA1|65600037|13` 座3 20张 lead/early 张数26/26/21/20 级3 上手=pass diff **-0.850** (t=-2.1)<br>decide: **fullhouse:3{3C 3D 3D 5S 5H}** [leadSmallSame,leadNoLevelTriple,control,planWeakFirst] 分 8；Jev: **single:9{9S}** [control] 分 1<br>Jev 标签：单张 9 [9S] [孤儿小单：最小的孤单]<br>手牌：RJ 3C 3D 3D AC QC QD JD 9S 7H 7D 6S 6H 6C 6D 5S 5H 4C 4D 4D
- `arenaA0|65600162|33` 座0 16张 lead/mid 张数16/16/20/12 级J 上手=pass diff **-0.825** (t=-2.7)<br>decide: **triple:2{2S 2D 2H}** [control,planWeakFirst] 分 47；Jev: **single:K{KD}** [control] 分 1<br>Jev 标签：单张 K [KD] [孤儿小单：最小的孤单]<br>手牌：RJ BJ JH KD 9S 9D 9D 3S 3H 3H 3C 3C 3D 2S 2H 2D
- `arenaA0|65600196|45` 座0 18张 lead/mid 张数18/20/8/9 级Q 上手=pass diff **-0.800** (t=-2.8)<br>decide: **pair:2{2C 2D}** [control,planWeakFirst] 分 47；Jev: **single:9{9C}** [control] 分 1<br>Jev 标签：单张 9 [9C] [孤儿小单：最小的孤单]<br>手牌：QS QD AH JH JD 9C 7H 7C 4H 4C 4D 4D 3H 3C 3C 3D 2C 2D
- `arenaA1|65600032|31` 座1 19张 lead/mid 张数13/19/24/16 级Q 上手=pass diff **-0.750** (t=-2.1)<br>decide: **pairSeq:J{9D 9S 10H 10C JC JD}** [leadSmallSame,holdBombLead,control,planUnitFirst] 分 51；Jev: **single:4{4C}** [control] 分 1<br>Jev 标签：单张 4 [4C] [孤儿小单：最小的孤单]<br>手牌：RJ QH QC AH AD KH KD JC JD 10H 10C 9S 9D 8S 8C 8C 8D 5D 4C
- `arenaA0|65600039|34` 座0 18张 lead/mid 张数18/25/9/9 级4 上手=pass diff **-0.675** (t=-2.1)<br>decide: **fullhouse:2{2H 2C 2D 5S 5D}** [fhAttach,control,planWeakFirst] 分 48；Jev: **single:J{JC}** [control] 分 1<br>Jev 标签：单张 J [JC] [孤儿小单：最小的孤单]<br>手牌：AH KS KH KH JC 8S 8D 7D 7D 5S 5D 3S 3H 3H 3D 2H 2C 2D

### Jev 明显更好（decide 可能的错）

- `arenaA0|65600132|52` 座2 15张 lead/mid 张数11/19/15/9 级A 上手=pass diff **+2.075** (t=5.6)<br>decide: **triple:2{2D 2C 2C}** [control,planWeakFirst] 分 47；Jev: **straight:6{2D 3C 4H 5D 6S}** [holdBombLead,control] 分 -49<br>Jev 标签：顺子 6 [2D 3C 4H 5D 6S] [领出]<br>手牌：AH 10S 10S 10H 10C 6S 6H 6C 6D 5D 4H 3C 2C 2C 2D
- `arenaA0|65600083|84` 座0 11张 lead/mid 张数11/5/0/0 级3 上手=pass diff **+1.000** (t=99.0)<br>decide: **single:BJ{BJ}** [shortEnemyShape,noLeadControl,bigFirstVsLast,control] 分 262；Jev: **single:K{KH}** [shortEnemyShape,bigFirstVsLast,control] 分 216<br>Jev 标签：单张 K [KH] [孤儿小单：最小的孤单] [危险：敌人剩1张可接单]<br>手牌：BJ AS KH 9D 8H 6S 5D 4S 4H 4C 4C
- `arenaA1|65600036|61` 座1 17张 lead/mid 张数7/17/8/17 级2 上手=pass diff **+0.975** (t=2.1)<br>decide: **pairSeq:4{2S 2S 3S 3S 4S 4S}** [holdBombLead,control,planUnitFirst] 分 52；Jev: **pair:6{6C 6D}** [keepStruct,control] 分 -36<br>Jev 标签：对子 6 [6C 6D] [领出]<br>手牌：2S 2S QS QH QH QD 7D 6C 6C 6D 5H 4S 4S 4C 3S 3S 3C
- `arenaA0|65600183|45` 座0 17张 lead/mid 张数17/24/14/12 级5 上手=pass diff **+0.950** (t=2.7)<br>decide: **single:RJ{RJ}** [control,planKeepControl] 分 -19；Jev: **fullhouse:3{3D 3D 3S AC AH}** [bombBreakAlt,fhAttach,leadSmallSame,control,offPlan] 分 -73<br>Jev 标签：三带二 3 [3D 3D 3S AC AH] [领出]<br>手牌：RJ 5H AH AC 6S 6S 6C 6C 4C 4D 3S 3H 3H 3D 3D 2H 2C
- `arenaA0|65600177|22` 座0 15张 enemy/mid 张数15/20/20/21 级10 上手=single:J diff **+0.825** (t=2.4)<br>decide: **pass** [] 分 0；Jev: **single:A{AC}** [followUp,breakNoOrphan,followSize,activeFollow:2] 分 -0<br>Jev 标签：单张 A [AC] [普通跟] [拆对子/三张出单]<br>手牌：RJ RJ 10S 10S 10D AH AC AD 9S 9D 5S 5S 5H 5D 3S
- `arenaA0|65600103|56` 座0 6张 enemy/late 张数6/12/11/16 级J 上手=single:6 diff **+0.800** (t=2.3)<br>decide: **single:J{JH}** [followUp,winThen:sure,followSize,strongBeforeLast] 分 5；Jev: **single:9{9C}** [followUp,winThen:sure,followSize,strongBeforeLast] 分 -22<br>Jev 标签：单张 9 [9C] [普通跟] [拿到牌权即可走完]<br>手牌：JH KS KH KC 9C 9D
- `arenaA1|65600129|0` 座1 27张 lead/early 张数27/27/27/27 级7 上手=pass diff **+0.775** (t=2.2)<br>decide: **pair:3{3S 3S}** [noFirstBomb,control,planWeakFirst] 分 55；Jev: **single:6{6D}** [noFirstBomb,control] 分 9<br>Jev 标签：单张 6 [6D] [孤儿小单：最小的孤单]<br>手牌：BJ BJ 7D AH AC AC KS KD JC 10C 10C 9S 9S 9H 9C 6D 4S 4H 4C 4D 4D 3S 3S 2S 2S 2H 2D
- `arenaA0|65600117|88` 座2 15张 enemy/mid 张数0/13/15/2 级7 上手=single:RJ diff **+0.675** (t=4.5)<br>decide: **bomb:3{3H 3H 3S 3D 7H 7H}** [] 分 6；Jev: **bomb:3{3H 3H 3S 3D}** [] 分 4<br>Jev 标签：4 炸 3 [3H 3H 3S 3D] [炸弹]<br>手牌：7H 7H AC QC 6H 5D 4S 4H 4H 4D 3S 3H 3H 3D 2H
- `arenaA0|65600085|93` 座0 9张 lead/late 张数9/0/1/7 级9 上手=pass diff **+0.650** (t=4.3)<br>decide: **pair:2{2C 2S}** [keepStruct,control] 分 -36；Jev: **single:2{2C}** [keepStruct,control] 分 -36<br>Jev 标签：单张 2 [2C] [领出] [喂搭档：搭档剩1张]<br>手牌：9S 4S 4H 4C 4D 3H 3C 2S 2C
- `arenaA0|65600032|56` 座2 23张 lead/early 张数11/12/23/17 级Q 上手=pass diff **+0.650** (t=2.7)<br>decide: **fullhouse:4{4S 4H 4C 8S 8H}** [fhAttach,leadSmallSame,control,planWeakFirst] 分 44；Jev: **single:9{9H}** [control] 分 1<br>Jev 标签：单张 9 [9H] [孤儿小单：最小的孤单]<br>手牌：RJ BJ QH QD AS AC KS KH KC KC 9H 8S 8H 5H 5C 5D 4S 4H 4C 2S 2H 2C 2D
- `arenaA1|65600066|66` 座3 18张 enemy/mid 张数19/15/5/18 级3 上手=fullhouse:5 diff **+0.575** (t=2.3)<br>decide: **fullhouse:8{8S 8H 8C 9C 9D}** [] 分 4；Jev: **fullhouse:8{8S 8H 8C 3D 3C}** [fhAttach] 分 -4<br>Jev 标签：三带二 8 [8S 8H 8C 3D 3C] [普通跟]<br>手牌：RJ 3C 3D AS AH AC AD 10S 10H 10H 10D 9C 9C 9D 8S 8H 8C 5S
- `arenaA1|65600130|63` 座3 18张 enemy/mid 张数2/0/9/18 级6 上手=bomb:Q diff **+0.550** (t=6.3)<br>decide: **bomb:A{AC AS AH AC 6H}** [] 分 5；Jev: **bomb:A{AC AS AH AC}** [] 分 4<br>Jev 标签：4 炸 A [AC AS AH AC] [炸弹]<br>手牌：BJ 6H 6S AS AH AC AC KD QS QC 9H 8H 7S 7C 7D 2H 2D 2D
