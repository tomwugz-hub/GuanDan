# Jev 接入体检（2026/10/19 21:53:31 Asia/Shanghai）

设置：Jev 队（spec jev = Jev 在 decide 候选里选，decide 兜底）vs decide 队（current），进贡比赛 matchLen=8，seed0=4200000，换座位配对。

## 擂台

jev vs current: 1008 副（换座位配对），A 胜 510/1008 = 50.6% [95% CI 47.6–53.6]，A 每副净升级 0.048 [-0.069, 0.164]，A 双上 139 / 被双上 123，不变量违例 0；进贡比赛 63 场配对，进贡副 823（抗贡 78，双下双贡 193），A 方还贡的副 A 均分 0.405（n=373），B 方还贡的副 A 均分 -0.422（n=372）

## Jev 调用

- Jev 座位决策 45874（45.5/副）：跳过 单候选 29263、decide 一手出完 1403；需要 Jev 15208（15.1/副），缓存命中 0，真实调用 15208（15.1/副，尝试 15212 次）
- 兜底 0（0.00%）：{}
- 延迟（含子进程 ~80ms）：p50 434ms，p95 523ms，max 375761ms（n=15208）
- 用量（API usage）：输入 29524177 tok（1941/次），输出 679792；费用 = 输入 × $0.042/1M = **$1.2400**（$0.00123/副；外推 200 副 $0.246，1000 副 $1.230，不含缓存命中节省）
- Jev 与 decide 一致 13702、分歧 1506（分歧率 9.9%）；不变量违例 0

## 行为对比（同一批对局，Jev 座位 vs decide 座位）

| 指标 | Jev | decide |
|---|---|---|
| 跟敌人过牌率（early，有牌可出） | 51.1% (4914/9608) | 51.5% (4943/9591) |
| 跟敌人过牌率（mid，有牌可出） | 56.1% (5915/10547) | 56.7% (6050/10673) |
| 跟敌人过牌率（late，有牌可出） | 39.9% (1290/3236) | 41.6% (1426/3426) |
| 压对家（early，有牌可压） | 0.0% (1/2979) | 0.0% (0/2957) |
| 压对家（mid，有牌可压） | 0.2% (7/4058) | 0.1% (5/3916) |
| 压对家（late，有牌可压） | 14.5% (175/1204) | 14.0% (173/1236) |
| 炸对家（未走完） | 0.0% (0/7571) | 0.0% (0/7505) |
| 敌家都 ≥15 张时炸普通牌（占跟牌炸弹） | 11.5% (115/997) | 13.6% (149/1099) |
| 敌家都 ≥10 张时领出炸弹（占炸弹） | 5.3% (138/2592) | 4.5% (120/2643) |
| 炸弹用逢人配（占炸弹） | 17.6% (455/2592) | 17.1% (451/2643) |
| 非炸弹着法用逢人配（占出牌） | 2.2% (393/17749) | 2.5% (442/17620) |
| 敌出牌后 ≤3 张、只能炸却过 | 2.7% (9/331) | 4.8% (14/291) |
| 早盘用王/级牌/逢人配出小单对 | 1.6% (46/2835) | 1.0% (28/2800) |
| 早盘领出 A/级牌/王的单对 | 1.2% (7/607) | 1.7% (10/577) |
| 拆炸弹领出 | 0.9% (68/7805) | 0.7% (54/7777) |
| 拆炸弹跟牌（非炸弹着法） | 0.6% (59/9651) | 0.6% (53/9549) |
| 一手能出完却没出完 | 0.0% (0/1388) | 0.0% (0/1340) |
| 早盘领出 single 占比 | 18.4% (354/1920) | 18.1% (346/1909) |
| 早盘领出 pair 占比 | 13.2% (253/1920) | 12.1% (231/1909) |
| 早盘领出 fullhouse 占比 | 20.2% (388/1920) | 16.7% (318/1909) |
| 早盘领出 straight 占比 | 23.0% (441/1920) | 22.3% (426/1909) |
| 早盘领出 pairSeq 占比 | 12.9% (247/1920) | 17.0% (325/1909) |
| 早盘领出 tripleSeq 占比 | 7.9% (152/1920) | 9.2% (176/1909) |
| 早盘领出 triple 占比 | 4.4% (85/1920) | 4.5% (86/1909) |
| 领出炸弹（中晚盘，非走完） | 4.0% (237/5885) | 3.9% (231/5868) |
| 每副每队炸弹数 | 1.29 | 1.31 |

## 分歧分布

- lead/early：分歧 8.7% (165/1890)
- lead/mid：分歧 14.0% (399/2845)
- lead/late：分歧 22.1% (289/1305)
- enemy/early：分歧 7.6% (351/4594)
- enemy/mid：分歧 6.7% (251/3726)
- enemy/late：分歧 5.5% (44/805)
- partner/early：分歧 0.0% (0/1)
- partner/mid：分歧 50.0% (2/4)
- partner/late：分歧 13.2% (5/38)
- Jev 选的候选序号分布：{"0":13702,"1":1050,"2":235,"3":121,"4":57,"5":21,"6":13,"7":9}

| 分歧类别 | 次数 |
|---|---|
| enemy:都出、换牌 | 427 |
| lead:同型换点 | 318 |
| enemy:decide 过→Jev 出 | 150 |
| lead:牌型 single→pair | 69 |
| lead:Jev 领炸 | 66 |
| lead:牌型 pairSeq→fullhouse | 65 |
| lead:牌型 tripleSeq→fullhouse | 57 |
| enemy:Jev 普通（decide 炸） | 49 |
| lead:牌型 pair→single | 35 |
| lead:牌型 pairSeq→pair | 32 |
| lead:牌型 pairSeq→straight | 30 |
| lead:牌型 single→fullhouse | 28 |
| lead:牌型 tripleSeq→triple | 19 |
| lead:牌型 pairSeq→single | 17 |
| enemy:decide 过→Jev 炸 | 16 |
| lead:牌型 tripleSeq→single | 13 |
| lead:牌型 pair→fullhouse | 13 |
| lead:牌型 tripleSeq→straight | 12 |
| lead:牌型 tripleSeq→pair | 11 |
| lead:牌型 single→triple | 10 |
| lead:牌型 bomb→triple | 8 |
| lead:牌型 straight→fullhouse | 6 |
| lead:牌型 single→straight | 5 |
| lead:牌型 fullhouse→triple | 5 |
| lead:牌型 triple→fullhouse | 4 |
| lead:牌型 bomb→single | 4 |
| partner:都出、换牌 | 4 |
| enemy:decide 炸→Jev 过 | 4 |
| partner:decide 过→Jev 出 | 3 |
| lead:牌型 single→pairSeq | 3 |
| lead:牌型 fullhouse→pairSeq | 3 |
| lead:牌型 fullhouse→pair | 2 |
| lead:牌型 bomb→pair | 2 |
| lead:牌型 fullhouse→single | 2 |
| lead:牌型 triple→pairSeq | 2 |
| lead:牌型 triple→single | 2 |
| lead:牌型 straight→pair | 2 |
| lead:牌型 pairSeq→triple | 1 |
| lead:牌型 bomb→fullhouse | 1 |
| lead:牌型 fullhouse→straight | 1 |
| lead:牌型 pair→straight | 1 |
| lead:牌型 bomb→pairSeq | 1 |
| lead:牌型 straight→single | 1 |
| lead:牌型 straight→triple | 1 |
| lead:牌型 tripleSeq→pairSeq | 1 |

## 分歧 MC 判定（抽样 200，有效 195，跳过 5：{"diverged":4,"noDisagree":1}；k=40，同一组确定化，后续全 decide）

- 判定（|diff|≥0.3 且 |t|≥2）：Jev 对 24、decide 对 21、差不多 150；平均 diff（Jev−decide）+0.008 级

| 类别 | n | 平均 diff | Jev 对 | decide 对 | 差不多 |
|---|---|---|---|---|---|
| enemy:都出、换牌 | 57 | -0.168 | 0 | 5 | 52 |
| lead:同型换点 | 43 | -0.018 | 4 | 5 | 34 |
| enemy:decide 过→Jev 出 | 15 | +0.305 | 4 | 0 | 11 |
| lead:牌型 pairSeq→fullhouse | 13 | +0.027 | 2 | 2 | 9 |
| lead:牌型 tripleSeq→fullhouse | 9 | +0.244 | 2 | 0 | 7 |
| lead:Jev 领炸 | 9 | +0.467 | 4 | 0 | 5 |
| lead:牌型 single→pair | 8 | +0.181 | 2 | 0 | 6 |
| lead:牌型 single→fullhouse | 5 | -0.230 | 1 | 2 | 2 |
| lead:牌型 pair→fullhouse | 4 | -0.094 | 0 | 0 | 4 |
| lead:牌型 bomb→triple | 4 | -0.756 | 0 | 3 | 1 |
| lead:牌型 pairSeq→straight | 4 | +0.194 | 1 | 1 | 2 |
| lead:牌型 pair→single | 3 | +0.250 | 1 | 0 | 2 |
| enemy:decide 过→Jev 炸 | 2 | -0.050 | 0 | 0 | 2 |
| lead:牌型 tripleSeq→triple | 2 | +0.000 | 0 | 1 | 1 |
| lead:牌型 tripleSeq→single | 2 | +0.575 | 1 | 0 | 1 |
| enemy:Jev 普通（decide 炸） | 2 | -0.825 | 0 | 2 | 0 |
| lead:牌型 straight→single | 1 | -0.325 | 0 | 0 | 1 |
| lead:牌型 fullhouse→pair | 1 | +0.175 | 0 | 0 | 1 |
| lead:牌型 straight→pair | 1 | -0.025 | 0 | 0 | 1 |
| lead:牌型 fullhouse→triple | 1 | +0.200 | 0 | 0 | 1 |
| partner:都出、换牌 | 1 | +0.050 | 0 | 0 | 1 |
| lead:牌型 single→pairSeq | 1 | +0.400 | 0 | 0 | 1 |
| lead:牌型 tripleSeq→straight | 1 | +0.250 | 0 | 0 | 1 |
| partner:decide 过→Jev 出 | 1 | +1.150 | 1 | 0 | 0 |
| lead:牌型 pairSeq→pair | 1 | +0.575 | 0 | 0 | 1 |
| enemy:decide 炸→Jev 过 | 1 | +0.000 | 0 | 0 | 1 |
| lead:牌型 bomb→single | 1 | +0.300 | 1 | 0 | 0 |
| lead:牌型 tripleSeq→pair | 1 | +0.000 | 0 | 0 | 1 |
| lead:牌型 straight→fullhouse | 1 | +0.000 | 0 | 0 | 1 |

### decide 明显更好（Jev 的错）

- `arenaA0|67200134|68` 座2 12张 lead/mid 张数6/14/12/11 级A 上手=pass diff **-1.700** (t=-5.8)<br>decide: **bomb:3{3S 3H 3C 3S}** [holdBombLead,control,leadBombLate] 分 -116；Jev: **triple:3{3S 3H 3C}** [bombBreakNoGain,control,offPlan] 分 -123<br>Jev 标签：三张 3 [3S 3H 3C] [领出] [拆计划：会多出手数]<br>手牌：QS QH QC QD 7S 7H 7H 7D 3S 3S 3H 3C
- `arenaA1|67200836|46` 座3 10张 lead/mid 张数18/11/15/10 级5 上手=pass diff **-1.325** (t=-3.4)<br>decide: **pairSeq:4{2C 2D 3C 3H 4H 4S}** [keepShape,control,offPlan] 分 97；Jev: **fullhouse:4{4H 4S 4D 2C 2D}** [leadSmallSame,control] 分 3<br>Jev 标签：三带二 4 [4H 4S 4D 2C 2D] [领出]<br>手牌：5H KC 6C 4S 4H 4D 3H 3C 2C 2D
- `arenaA0|67200885|16` 座2 7张 lead/late 张数27/22/7/27 级9 上手=pass diff **-1.300** (t=-3.6)<br>decide: **fullhouse:7{7S 7H 7C 8C 8H}** [control,planWeakFirst,planStrongFirst] 分 119；Jev: **fullhouse:7{7S 7H 7C AC AH}** [fhAttach,control,planWeakFirst,planStrongFirst] 分 116<br>Jev 标签：三带二 7 [7S 7H 7C AC AH] [领出] [按计划]<br>手牌：AH AC 8H 8C 7S 7H 7C
- `arenaA0|67200738|21` 座0 16张 enemy/mid 张数16/20/26/16 级9 上手=fullhouse:2 diff **-1.200** (t=-3.8)<br>decide: **fullhouse:A{AC AC AD 2H 2C}** [] 分 4；Jev: **fullhouse:A{AC AC AD KS KH}** [fhAttach] 分 -2<br>Jev 标签：三带二 A [AC AC AD KS KH] [普通跟]<br>手牌：BJ 9C AC AC AD KS KH QS 10H 7H 3S 3H 3C 3D 2H 2C
- `arenaA0|67200871|41` 座2 19张 lead/mid 张数23/22/19/15 级8 上手=pass diff **-1.125** (t=-3.0)<br>decide: **pairSeq:10{8S 8S 9S 9D 10H 10S}** [keepShape,control,offPlan] 分 57；Jev: **fullhouse:2{2S 2D 2C 8S 8S}** [fhAttach,control,planWeakFirst] 分 25<br>Jev 标签：三带二 2 [2S 2D 2C 8S 8S] [领出] [按计划先出：拆牌计划里应先出这手]<br>手牌：RJ 8H 8S 8S QD JH JH JD 10S 10H 9S 9D 5H 5C 5D 4H 2S 2C 2D
- `arenaA1|67200806|67` 座3 13张 enemy/mid 张数4/2/2/13 级3 上手=single:Q diff **-1.125** (t=-5.7)<br>decide: **single:3{3C}** [stopShort,followUp,winThen:single,followSize,controlFeed:single] 分 150；Jev: **single:BJ{BJ}** [stopShort,followUp,winThen:single,followSize,controlFeed:single] 分 141<br>Jev 标签：单张 BJ [BJ] [普通跟] [夺权后可送单给搭档]<br>手牌：BJ 3C KC KD KD JH 10S 10H 10C 10D 7D 6C 5C
- `arenaA0|67200807|63` 座0 8张 enemy/late 张数8/0/12/21 级6 上手=fullhouse:10 diff **-1.100** (t=-7.7)<br>decide: **bomb:5{5S 5D 5H 6H}** [noWasteJ,mustBomb] 分 99；Jev: **fullhouse:A{AS AD AD KS 6H}** [stopShort,winThen:sure] 分 44<br>Jev 标签：三带二 A [AS AD AD KS 6H] [普通跟] [用逢人配当替身：用掉1张红桃6] [拿到牌权即可走完]<br>手牌：6H AS AD AD KS 5S 5H 5D
- `arenaA0|67200215|28` 座2 12张 lead/mid 张数13/20/12/15 级7 上手=pass diff **-1.075** (t=-3.1)<br>decide: **single:6{6S}** [smallFirst,control,offPlan] 分 88；Jev: **fullhouse:3{3H 3C 3S KC KH}** [fhAttach,control,planWeakFirst] 分 44<br>Jev 标签：三带二 3 [3H 3C 3S KC KH] [领出] [按计划先出：拆牌计划里应先出这手]<br>手牌：7H KH KC 6S 5S 5C 5D 4S 4D 3S 3H 3C
- `arenaA0|67200469|57` 座2 7张 lead/late 张数12/21/7/18 级6 上手=pass diff **-1.025** (t=-3.1)<br>decide: **single:2{2S}** [smallFirst,control,offPlan] 分 13；Jev: **single:RJ{RJ}** [control,planKeepControl] 分 -18<br>Jev 标签：单张 RJ [RJ] [领出] [按计划]<br>手牌：RJ 6H 6S 5S 5H 3S 2S
- `arenaA0|67200723|72` 座0 8张 lead/late 张数8/9/20/11 级Q 上手=pass diff **-0.900** (t=-3.5)<br>decide: **bomb:2{2C 2D 2D 2H}** [holdBombLead,control,leadBombLate] 分 -115；Jev: **triple:2{2C 2D 2D}** [bombBreakNoGain,control,offPlan] 分 -122<br>Jev 标签：三张 2 [2C 2D 2D] [领出] [拆计划：会多出手数]<br>手牌：AC AC AD AD 2H 2C 2D 2D
- `arenaA1|67200480|34` 座1 17张 lead/mid 张数25/17/12/24 级5 上手=pass diff **-0.850** (t=-2.9)<br>decide: **tripleSeq:3{2C 2H 2S 3H 3H 3S}** [keepShape,control] 分 103；Jev: **triple:2{2C 2H 2S}** [control,planWeakFirst] 分 47<br>Jev 标签：三张 2 [2C 2H 2S] [领出] [按计划先出：拆牌计划里应先出这手]<br>手牌：BJ BJ AC KH KD KD QS 10H 10C 4S 4D 3S 3H 3H 2S 2H 2C
- `arenaA1|67200486|7` 座3 22张 lead/early 张数22/22/22/22 级A 上手=pass diff **-0.825** (t=-2.0)<br>decide: **pairSeq:7{5S 5C 6H 6S 7S 7H}** [keepShape,control,offPlan] 分 101；Jev: **straight:Q{8D 9H 10C JD QC}** [leadSmallSame,holdLevelOverStraight,control,planUnitFirst] 分 82<br>Jev 标签：顺子 Q [8D 9H 10C JD QC] [领出] [按计划先出：拆牌计划里应先出这手]<br>手牌：BJ AH KH QC JS JD 10C 9H 9C 8D 7S 7H 7D 6S 6H 5S 5C 3C 3D 3D 2S 2D

### Jev 明显更好（decide 可能的错）

- `arenaA1|67200240|71` 座3 11张 lead/mid 张数10/12/2/11 级3 上手=pass diff **+1.775** (t=4.5)<br>decide: **pairSeq:4{2S 2H 3C 4H 4H 3H}** [shortEnemyShape,keepShape,vsTwoNoPair,unfollowableVsTwo,control] 分 253；Jev: **fullhouse:4{4H 4H 4C 9C 9H}** [shortEnemyShape,vsTwoNoPair,unfollowableVsTwo,control] 分 240<br>Jev 标签：三带二 4 [4H 4H 4C 9C 9H] [领出] [按计划]<br>手牌：RJ 3H 3C 9H 9C 4H 4H 4C 2S 2H 2D
- `arenaA1|67200210|50` 座3 9张 lead/late 张数12/11/16/9 级A 上手=pass diff **+1.650** (t=4.8)<br>decide: **tripleSeq:A{KC KC KH AD AD AH}** [keepShape,leadNoWild,control,planUnitFirst] 分 143；Jev: **single:3{3D}** [smallFirst,control] 分 100<br>Jev 标签：单张 3 [3D] [领出] [按计划]<br>手牌：AH AD AD KH KC KC 10C 10D 3D
- `arenaA1|67200531|63` 座1 9张 lead/late 张数22/9/16/15 级Q 上手=pass diff **+1.275** (t=4.3)<br>decide: **single:5{5D}** [control,offPlan] 分 -51；Jev: **bomb:2{2H 2S 2C 2H}** [holdBombLead,control,leadBombLate] 分 -115<br>Jev 标签：4 炸 2 [2H 2S 2C 2H] [炸弹] [领出炸弹过早：敌家不短，炸弹宜留后]<br>手牌：5S 5H 5C 5C 5D 2S 2H 2H 2C
- `arenaA1|67200022|45` 座3 14张 enemy/mid 张数23/16/5/14 级Q 上手=single:J diff **+1.150** (t=3.0)<br>decide: **pass** [] 分 0；Jev: **single:A{AS}** [followUp,followSize] 分 -32<br>Jev 标签：单张 A [AS] [普通跟] [跟牌会拆牌/浪费大牌]<br>手牌：RJ AS AC 9H 9C 7H 7D 5S 5S 5C 3S 3S 3H 3C
- `arenaA1|67200016|49` 座1 7张 partner/late 张数14/7/16/6 级2 上手=pair:K diff **+1.150** (t=3.6)<br>decide: **pass** [] 分 0；Jev: **pair:A{AD AS}** [] 分 -1<br>Jev 标签：对子 A [AD AS] [普通跟]<br>手牌：AS AD KS KS KC 5S 5D
- `arenaA1|67200513|32` 座3 11张 lead/mid 张数17/15/20/11 级10 上手=pass diff **+1.100** (t=3.0)<br>decide: **single:J{JD}** [holdBombLead,control,offPlan] 分 9；Jev: **fullhouse:9{9C 9D 9C 7D 7S}** [bombBreakAlt,leadSmallSame,control] 分 -58<br>Jev 标签：三带二 9 [9C 9D 9C 7D 7S] [领出]<br>手牌：10H 10D JD 9C 9C 9D 9D 8H 8D 7S 7D
- `arenaA1|67200595|37` 座1 9张 lead/late 张数18/9/24/25 级2 上手=pass diff **+1.100** (t=3.4)<br>decide: **single:Q{QC}** [control,offPlan] 分 -48；Jev: **bomb:5{5H 5H 5S 5C}** [holdBombLead,control,leadBombLate] 分 -115<br>Jev 标签：4 炸 5 [5H 5H 5S 5C] [炸弹] [领出炸弹过早：敌家不短，炸弹宜留后]<br>手牌：QS QS QC QC QD 5S 5H 5H 5C
- `arenaA1|67200770|79` 座1 8张 lead/late 张数4/8/2/0 级A 上手=pass diff **+1.100** (t=6.9)<br>decide: **single:Q{QS}** [shortEnemyLead,control] 分 63；Jev: **pair:3{3H 3S}** [control] 分 -1<br>Jev 标签：对子 3 [3H 3S] [领出] [按计划]<br>手牌：AS KS KH QS 3S 3H 2H 2H
- `arenaA0|67200784|73` 座0 3张 lead/late 张数3/12/0/1 级J 上手=pass diff **+1.050** (t=30.1)<br>decide: **single:J{JS}** [holdLevel,bigFirstVsLast,control] 分 241；Jev: **single:K{KC}** [bigFirstVsLast,control] 分 173<br>Jev 标签：单张 K [KC] [领出] [危险：敌人剩1张可接单] [按计划]<br>手牌：JS KC 6H
- `arenaA1|67200164|94` 座3 5张 lead/late 张数0/1/1/5 级4 上手=pass diff **+1.000** (t=99.0)<br>decide: **pair:RJ{RJ RJ}** [control] 分 2；Jev: **single:6{6H}** [control] 分 -14<br>Jev 标签：单张 6 [6H] [领出] [喂搭档：搭档剩1张] [按计划]<br>手牌：RJ RJ JS 10C 6H
- `arenaA0|67200082|0` 座0 27张 lead/early 张数27/27/27/27 级9 上手=pass diff **+0.975** (t=2.4)<br>decide: **tripleSeq:10{9D 9D 9S 10C 10H 10D}** [noFirstBomb,keepShape,control,offPlan] 分 66；Jev: **fullhouse:3{3C 3C 3S 2C 2C}** [noFirstBomb,control,planWeakFirst] 分 57<br>Jev 标签：三带二 3 [3C 3C 3S 2C 2C] [领出] [按计划先出：拆牌计划里应先出这手]<br>手牌：9S 9D 9D AH QS QC QC JS JC 10H 10C 10D 8S 8S 7C 7D 6S 6C 6D 5D 4S 4S 3S 3C 3C 2C 2C
- `arenaA0|67200449|4` 座2 21张 lead/early 张数27/27/21/27 级5 上手=pass diff **+0.950** (t=2.2)<br>decide: **pairSeq:4{2C 2H 3S 3H 4H 4C}** [keepShape,control,offPlan] 分 94；Jev: **fullhouse:2{2C 2H 2C 3S 3H}** [control,planWeakFirst] 分 49<br>Jev 标签：三带二 2 [2C 2H 2C 3S 3H] [领出] [按计划先出：拆牌计划里应先出这手]<br>手牌：BJ BJ 5S JD 10S 10H 10H 8D 8D 7S 7D 7D 6H 6C 4H 4C 3S 3H 2H 2C 2C
