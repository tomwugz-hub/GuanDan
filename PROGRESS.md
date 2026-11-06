
## 2026-10-26（Asia/Shanghai）进贡自博弈 A/B：人工实测修后 vs 修前
- current vs r20-base，4000 副，进贡 matchLen=8，seed0=11000000，换座位配对。
- A 胜率 53.4% [51.9–54.9]，每副净升级 +0.119 [0.051, 0.187]，双上 851/被双上 780，违例 0，用时 376s。
- 结论：修后显著优于修前（CI 下界 >0）。报告：selfplay/reports/ab-humanfix-vs-r20base.md

## 2026-10-26（Asia/Shanghai）r28 — SHIPPED bit4
- SHIPPED：GD_R28 默认 4（仅 bit4 中盘跟敌），M4=100（新种子 10740000 复测 +0.253 [0.186,0.319]，胜 55.1%）。按自博弈改 9 条金标 过→跟（dev-r6 R105/R111/R118/R140/R150，dev-follow F128/F149，frozen-real4 u013/u103）及 round6/follow/r28 测试；regress-all = 旧基线，test 486/486。线上缓存 guandan-play-730bfda60b。
- （以下为发布前记录）
- bit4 中盘跟敌：自博弈两次显著（+0.102 [0.038,0.167]；确认 +0.086 [0.027,0.145]；M4=100 +0.205），但收益全来自跟单张，和 dev-r6/dev-follow/frozen-real4 的 6 条“过牌”标签及 2 个锁定测试冲突 → regress 退步，不发。bit1/2/8 flat。GD_R28 默认 0。报告：selfplay/reports/r28.md

## 2026-10-26（Asia/Shanghai）r29 — SHIPPED bit4 LO=1
- bit4 手数窗口下界 10→1（HI=22、M4=100 不变）。LO=1 两个种子都显著：+0.103 [0.051,0.155]（11030000）、+0.068 [0.015,0.120]（11040000）。HI=27、LO=5、M4=160 flat。
- 改了 10 条过→跟金标（F106、R078、R089、R112、R147、d006、d113、p38b、m45b、q34a；备份 backups/pre-r29-labels）。regress-all 与基线一致，test 486/486。线上缓存 guandan-play-7f31bd4e14。报告 selfplay/reports/r29.md

## 2026-10-26（Asia/Shanghai）r30 — SHIPPED GD_R30=1
- 跟牌候选允许王。两个种子都显著：+0.244 [0.171,0.318]、+0.215 [0.150,0.281]（12100000）。GD_R30=5 +0.238 不优于 1；2/4 flat。
- 改了 5 条金标→单张 RJ（R089、R125、F082、F128、d084；备份 backups/pre-r30-labels），F128 测试放宽为 K|RJ。regress 与基线一致，test 486/486。线上缓存 guandan-play-f4fbd8041e。报告 selfplay/reports/r30.md

## 2026-10-26（Asia/Shanghai）r31 — REJECTED
- 炸拦 BK=10 初测 +0.102，确认 +0.060 [−0.008,0.129] 翻车；BK=6/3、少领炸（−0.095）、不抢对家权（+0.010）都拒。新试 bit8 下家报警时领出避单：NE=1 +0.013/+0.003，NE=2 −0.027/+0.028（双种子，都不显著）。不发布，GD_R31 默认 0，线上仍是 guandan-play-f4fbd8041e。报告 selfplay/reports/r31.md

## 2026-10-26（Asia/Shanghai）r32 — REJECTED
- 逢人配省用/单不拆对：bit1 +0.008、bit2 +0.019、bit4 −0.011（4000 副，CI 全跨 0）。不发布，GD_R32 默认 0，线上仍 guandan-play-f4fbd8041e。报告 selfplay/reports/r32.md

## 2026-10-26（Asia/Shanghai）r33 — REJECTED
- 还贡最小点/nat≤8：r33_1 +0.029、r33_2 +0.037、r33_3 +0.041、r33_3 T=1 −0.039；非还贡开局领连对/钢板 GD_R33L=1 −0.017、=3（加顺子）+0.005（4000 副，seed0=13300000，CI 全跨 0）。不发布，默认不变，线上仍 guandan-play-f4fbd8041e。报告 selfplay/reports/r33.md

## 2026-10-27（Asia/Shanghai）r34 — REJECTED
- 残局穷举/保同花顺/留控制：bit1 E=4 +0.013、E=5 −0.001、bit2 −0.159（显著负）、bit4 −0.002（4000 副，seed0=13400000）。不发布，GD_R34 默认 0，线上仍 guandan-play-f4fbd8041e。报告 selfplay/reports/r34.md

## 2026-10-27（Asia/Shanghai）r35 — REJECTED
- audit 挖到：炸弹留同点孤张（bit1）、下家敌人≤2张时炸后喂搭档（bit2）。bit1 +0.025 [−0.032,0.083]、bit2 +0.006 [−0.010,0.022]（4000 副，seed0=13500000）。不发布，GD_R35 默认 0，线上仍 guandan-play-f4fbd8041e。报告 selfplay/reports/r35.md

## 2026-10-27（Asia/Shanghai）r36 — REJECTED
- 跟敌最小点/不用控制牌：bit1 −0.001、bit2 −0.006、bit3 −0.006；早盘领孤小单（audit 领单占比贴边）bit4 −0.030 [−0.104,0.044]（4000 副，seed0=13600000，CI 全跨 0）。不发布，GD_R36 默认 0，线上仍 guandan-play-f4fbd8041e。报告 selfplay/reports/r36.md

## 2026-10-27（Asia/Shanghai）r39 — REJECTED
- A：GD_R38=1 8000 副双种子 −0.006 [−0.045,0.033]（13900000）/ +0.056 [0.018,0.094]（13910000），未双过。B：GD_R39 bit1 顶对家小牌防下家（下家≤4 张）4000 副 −0.005 [−0.016,0.006] / −0.002 [−0.008,0.005]。不发布，GD_R39 默认 0，线上仍 guandan-play-f4fbd8041e。报告 selfplay/reports/r39.md

## 2026-10-27（Asia/Shanghai）r40 — REJECTED
- 省炸回：bit1 +0.010 [−0.020,0.040]、bit2 +0.004 [−0.015,0.022]（seed0=14000000）；新试 bit4 对家剩 3 张时领最小单喂牌 −0.006 [−0.021,0.008]（seed0=14100000）。4000 副，CI 全跨 0。不发布，GD_R40 默认 0，线上仍 guandan-play-f4fbd8041e。报告 selfplay/reports/r40.md

## 2026-10-27（Asia/Shanghai）r43 — REJECTED
- 领出计划分权重：offPlan 加重 bit1 K=70 +0.050 [0.002,0.098]（14300000）/ −0.011 [−0.054,0.031]（14310000）；K=100 CAP=200 +0.077 [0.024,0.130] / +0.005 [−0.040,0.050]；bit2 planWeakFirst W=80 +0.037 [−0.025,0.099]。触发面 1.2% 领出。不发布，GD_R43 默认 0，线上仍 guandan-play-f4fbd8041e。报告 selfplay/reports/r43.md

## 2026-10-27（Asia/Shanghai）r44 — REJECTED
- 束搜索加分：bit1 去掉 −0.004 [−0.042,0.034]、bit2 W=0.15 −0.001 [−0.030,0.028]；bit4 走完线多看一手 +0.007 [−0.011,0.025]（4000 副，seed0=14400000，CI 全跨 0）。不发布，GD_R44 默认 0，线上仍 guandan-play-f4fbd8041e。报告 selfplay/reports/r44.md

## 2026-10-27（Asia/Shanghai）r45 — SHIPPED bit2
- SHIPPED：GD_R45 默认 2（跟敌非炸、手=能压的炸弹+余牌≤2手 → 炸回夺权）。双种子 +0.048 [0.006,0.089]（14500000）/ +0.056 [0.006,0.105]（14510000）；bit1 未过。按自博弈改 5 条金标 过→炸（F004/R119/d025/h03b/u019）；regress-all = 旧基线，test 487/487。线上缓存 guandan-play-ff87161306。报告 selfplay/reports/r45.md

## 2026-10-27（Asia/Shanghai）r49 — REJECTED
- GD_R49 bit1 +0.027 [−0.030,0.084]、bit2 +0.009 [−0.056,0.073]、bit3 −0.038 [−0.111,0.035]、bit4 −0.077 [−0.142,−0.012]（4000 副，14900000）。不发布，线上仍 guandan-play-ff87161306。报告 selfplay/reports/r49.md

## 2026-10-27（Asia/Shanghai）r48 — REJECTED
- GD_R48 bit16 −0.062 [−0.128,0.004]、bit16+M120 −0.054 [−0.125,0.016]、bit13 −0.109 [−0.157,−0.061]、补挖 bit2 +0.005 [−0.002,0.013]（4000 副）。不发布，线上仍 guandan-play-ff87161306。报告 selfplay/reports/r48.md

## 2026-10-27（Asia/Shanghai）r47 — REJECTED
- GD_R46=2 8000 副复测 +0.013 [−0.011,0.038]（14700000）未过；新试 GD_R47 跟敌非炸压牌后≤K手 bit1 −0.004、bit2 +0.020（4000 副，CI 跨 0）。不发布，线上仍 guandan-play-ff87161306。报告 selfplay/reports/r47.md

## 2026-10-27（Asia/Shanghai）r50 — SHIPPED bit3 M300
- GD_R50 默认 3、M=300（下家敌出、对家上家已过 → 分差≤300 非炸同型压住）。双种子 +0.073 [0.008,0.137]（15000000）/ +0.108 [0.049,0.168]（15010000）；bit1 M300/600/2000 均贴边 lo≈−0.002。改 8 条金标 过→压；regress-all = 旧基线。线上缓存 guandan-play-77674f9e11。报告 selfplay/reports/r50.md

## 2026-10-27（Asia/Shanghai）r51 — REJECTED
- GD_R51 bit1（r50 上家镜像）−0.008 [−0.062,0.046]、bit2 −0.017 [−0.067,0.034]、bit4（下家 1 张避单领）+0.005 [−0.014,0.025]、bit8 −0.006 [−0.034,0.022]（4000 副，15100000，CI 全跨 0）。不发布，GD_R51 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r51.md

## 2026-10-27（Asia/Shanghai）r52 — REJECTED
- GD_R52 bit1（r50 窗口允许级牌配）−0.027 [−0.090,0.036]、bit2（对家≤6 张时不压对家）+0.009 [−0.018,0.035]（4000 副，15200000，CI 跨 0）。不发布，GD_R52 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r52.md

## 2026-10-27（Asia/Shanghai）r53 — REJECTED
- audit 挖到：搭档已出完时敌报单的 mustBomb（MC 意外 2/5）。GD_R53 bit1 跳过 mustBomb −0.015 [−0.042,0.013]、bit2 仅去过牌罚分 +0.002 [−0.015,0.019]（4000 副，15300000，CI 跨 0）。不发布，GD_R53 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r53.md

## 2026-10-27（Asia/Shanghai）r54 — REJECTED
- audit：晚盘压对家单/对 16.1%。GD_R54 bit1（接手对家）15400000 +0.032 [0.010,0.054] 但 15410000 −0.013 [−0.029,0.004]；bit2（对家≥PN 张）+0.019 [−0.002,0.040]。双种子未过，不发布，GD_R54 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r54.md

## 2026-10-27（Asia/Shanghai）r55 — REJECTED
- GD_R55 能非炸压就不炸：bit1 M300 +0.029 [−0.013,0.071]、bit2 不限分差 +0.019 [−0.022,0.061]（4000 副，15500000，CI 跨 0）。不发布，GD_R55 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r55.md

## 2026-10-27（Asia/Shanghai）r56 — REJECTED
- 领出喂对家：bit1 +0.008 [−0.009,0.024]、bit2 +0.010 [−0.008,0.028]（4000 副，15600000，CI 跨 0）。不发布，GD_R56 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r56.md

## 2026-10-27（Asia/Shanghai）r57 — REJECTED
- 领出避敌可接型：bit1 −0.001 [−0.029,0.028]、bit2 +0.007 [−0.032,0.046]（4000 副，15700000，CI 跨 0）。不发布，GD_R57 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r57.md

## 2026-10-27（Asia/Shanghai）r58 — REJECTED
- audit-r54：弱压对家/短敌软领/中盘改对等。bit1 −0.013、bit2 +0.032 贴边、bit2n +0.010、bit4 −0.009、bit8 −0.002、bit16 −0.216 显著负、bit32 +0.024、bit64 中断未过（4000 副，15800000）。无变体过 keep。不发布，GD_R58 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r58.md

## 2026-10-27（Asia/Shanghai）r59 — REJECTED
- 弱点：有炸领出却连甩孤小单（n50：6→7→J，应三带二 A）。GD_R59 bit1 −0.133 [−0.205,−0.060]、bit2 −0.087 [−0.155,−0.019]；M150 / MinOrph2 / 组合均显著负（4000 副，15900000）。局面在 flag=1 下可修，自博弈不过 keep。不发布，GD_R59 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r59.md

## 2026-10-27（Asia/Shanghai）r60 — REJECTED
- 弱点：跟敌短敌只能炸却不过（noBombEnemyOut）。bit1 −0.011、bit2 +0.021 贴边、bit4 −0.009、bit8 −0.033 显著负、bit16 −0.023、bit2 HL16 −0.014、EN=1 −0.007（4000 副，16000000）。无变体过 keep。不发布，GD_R60 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r60.md

## 2026-10-27（Asia/Shanghai）r61 — REJECTED
- 大触发面正交：还贡孤张 / 放宽跟 / r50 最小点 / 对家出完抢收 / 早盘改小 / 跟对放宽。首种子 16100000、4000 副：bit1 −0.009、bit2 −0.001、bit4 +0.006、bit8 +0.003、bit16 −0.011、bit32 −0.143 显著负、bit64 −0.008；窄化 bit4 HI12/M90 −0.011 [−0.023,−0.000]。无 CI lo>0。不发布，GD_R61 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r61.md
- r68 REJECTED：跟敌三带二/连对收窄（敌≤10、不拆炸+余手降、余手降+M80、我手≤14）全 CI 跨 0；整邻域已穷尽。
- r69 REJECTED：保 SF −0.149 显著负、拦下家报单 +0.023、短手头游多张 +0.021、对家≤3 不顶 −0.007、跟敌短单压 +0.006（16900000，CI 全跨 0 或负）。GD_R69 默认 0。已穷尽：窄保 SF、拦报单、短手头游多张、对家短不顶。报告 selfplay/reports/r69.md
- r70 REJECTED：控制牌节约簇 bit1 −0.038、bit2 +0.012、bit3 −0.027、bit4 −0.034、bit8 −0.083 显著负、bit16 +0.045（17000000，无 CI lo>0）。GD_R70 默认 0。已穷尽：省控领出、跟小牌不用控、长结构领出、炸改非炸、对家控不压。报告 selfplay/reports/r70.md
- r71 REJECTED：座位/张数感知簇 bit1 +0.006、bit2 −0.018、bit4 +0.013、bit8 +0.021、bit16 +0.015、bit20 +0.008（17100000，CI 全跨 0）。GD_R71 默认 0。已穷尽：喂对家小牌、防下家出单、对家短夺权、厚手对先单、拦下家 3–6。报告 selfplay/reports/r71.md
## 2026-10-27（America/Toronto）r72 — REJECTED
- 手型/逢人配/跟牌不拆炸。bit1 +0.058 [−0.014, 0.129]、bit2 −0.045、bit4 −0.004、bit8 −0.023、bit16 −0.070、bit12 −0.001（4000 副，17200000，CI 全跨 0）。不发布，GD_R72 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r72.md
## 2026-10-27（America/Toronto）r73 — REJECTED
- audit-r73 短检正交：跟敌钢板/三张、领出改三带二或钢板、厚手跟敌避级牌对。bit1 −0.002、bit2 +0.003、bit4 −0.023、bit5 −0.040、bit8 +0.012、bit16 +0.025（4000 副，17300000，CI 全跨 0）。不发布，GD_R73 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r73.md
- 已穷尽：跟敌钢板、短敌领出改三带二/钢板、跟敌三张、厚手跟敌避级牌对（及 1|4）。
## 2026-10-27（America/Toronto）r74 — REJECTED
- 早盘领三张/短手出口减手。bit1 −0.183 显著负、bit2 −0.047、bit4 −0.301 显著负、bit5 −0.544 显著负、bit8 −0.022、bit16 +0.014（4000 副，17400000，无 CI lo>0）。不发布，GD_R74 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r74.md
- 已穷尽：领三张/吃孤三带二替单对、短手领炸、短手减手跟、短手炸抢收。
## 2026-10-27（America/Toronto）r75 — 进行中
- audit-r75（17500000，surprise 120）：MC 意外 5.8% 红旗，3/7 为「敌中盘炸弹、我≤10 张有更大炸却过」（炸被 filter 禁）。GD_R75 默认 0：bit1 我手≤10 炸回（含被禁炸）、bit2 炸弹方≤10、bit4 我手≤12、bit3=1|2。异于 r20/r40/r46/r47/r62（按余手 K/对家短）。首种子 17500000，基线 backups/r75-base，日志 selfplay/logs/ab-r75-*。

## 2026-10-28（America/Toronto）r75 — REJECTED
- 敌中盘炸后炸回放开。bit1 −0.026、bit2 +0.052、bit3 +0.044、bit4 −0.060（4000 副，17500000，CI 全跨 0）。不发布，GD_R75 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r75.md

## 2026-10-28（America/Toronto）r76 — 进行中
- audit-r76（17600000，400 副+mixed+surprise 120）无红旗（MC 意外 0%）。自创正交轴：敌已头游后 2v1 残局跟剩余敌。GD_R76 默认 0：bit1 非炸压、bit2 含炸压、bit4 剩余敌≤10 含炸压、bit8 首选炸改非炸。首种子 17600000，基线 backups/r76-base，日志 selfplay/logs/ab-r76-*。

## 2026-10-28（America/Toronto）r80 — REJECTED
- 炸弹选型。bit1 −0.050 显著负、bit2 −0.012、bit4 +0.077 [0.027,0.128]（18000000）→ 确认 18010000 +0.006 [−0.032,0.045] 跨 0；bit7 −0.009。不发布，GD_R80 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r80.md
- 已穷尽：炸弹选型（便宜炸/不用逢人配/余手最少）。

## 2026-10-28（America/Toronto）r81 — 进行中
- 自创正交轴：还贡花色/同花顺潜力（异于 r33 点数、r61 孤张、r42/r63 进贡花色）。policy/tribute.js GD_R81 默认 0（arena 用 #ret=r81_N，因旧版 decide 共用当前 tribute）：bit1 同点还同花顺潜力最小花色、bit2 同点还该花色余张最少、bit4 plan 平手按同花顺潜力、bit5=1|4。首种子 18100000，--a='current#ret=r81_N' --b=current，脚本 /tmp/run-r81-ab.sh，日志 selfplay/logs/ab-r81-*。

## 2026-10-28（America/Toronto）r81 — REJECTED
- 还贡花色/同花顺潜力。bit1 +0.034 [−0.004,0.072]、bit2 +0.005、bit4 −0.001、bit5 +0.025（4000 副，18100000，CI 全跨 0）。不发布，GD_R81 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r81.md
- 已穷尽：还贡花色（及整个进贡/还贡选牌邻域）。

## 2026-10-28（Asia/Shanghai）r82 — REJECTED
- 同型牌实现选择。bit1 −0.088 显著负、bit2 +0.008、bit4 −0.017、bit5 −0.123 显著负（4000 副，18200000，无 CI lo>0）。不发布，GD_R82 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r82.md。
- 已穷尽：同型牌实现选择（同点余手/孤张、同点去逢人配、改点余手）。
## 2026-10-28（Asia/Shanghai）r83 — REJECTED
- 出牌花色保 SF。bit1 −0.058、bit2 −0.140、bit4 −0.551、bit5 −0.565（均显著负，18300000）。不发布，GD_R83 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r83.md。已穷尽：出牌花色保同花顺潜力。

## 2026-10-28（Asia/Shanghai）r84 — REJECTED
- 贴边分差改过。bit1 −1.147、bit2 −1.511、bit4 −1.697、bit5 −1.915（均显著负，18400000）。无 CI lo>0。不发布，GD_R84 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r84.md。已穷尽：贴边分差改过；禁再试软过。

## 2026-10-28（Asia/Shanghai）r85 — REJECTED
- 明牌计数安全换手。bit1 +0.011 [−0.037,0.060]、bit2 −0.656 显著负、bit4 −0.093、bit5 −0.089（18500000，无 CI lo>0）。不发布，GD_R85 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r85.md。已穷尽：safety/winProb 贴边换手。

## 2026-10-28（Asia/Shanghai）r86 — 进行中
- 自创正交轴：对家甩牌加速配合 / 敌慢甩牌（ctx.recentShed；异于 r14 敌快走、r56/r40 按张数喂牌、r84 改过、r85 安全换手）。GD_R86 默认 0：bit1 对家快甩领最小非控单；bit2 对家快甩领最小非控对；bit4 两敌慢且厚时领出单对改≥3张非炸；bit5=1|2。首种子 18600000，基线 backups/r86-base，脚本 /tmp/run-r86-ab.sh。


## 2026-10-28（Asia/Shanghai）r86 — REJECTED
- 对家甩牌加速配合 / 敌慢甩牌。bit1 −0.047 [−0.100,0.006]、bit2 −0.035 [−0.083,0.014]、bit4 +0.035 [−0.036,0.105]、bit5 −0.021 [−0.097,0.056]（4000 副，18600000，CI 全跨 0）。不发布，GD_R86 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r86.md。已穷尽：recentShed 甩牌节奏。

## 2026-10-28（Asia/Shanghai）r87 — 进行中
- 自创正交轴：跟敌最小压省大牌（同型同张数、点数更低且分差≤M80 的可压牌替换首选；异于 r82 同点实现、r84 改过、r85 safety 换手、r86 甩牌节奏）。GD_R87 默认 0：bit1 单张、bit2 对子、bit4 其他非炸型、bit8 仅首选含控牌；跑 bit1/2/3/4。首种子 18700000，基线 backups/r87-base，脚本 /tmp/run-r87-ab.sh，日志 selfplay/logs/ab-r87-*。（另试「跨型余手最少」触发≈0.2% 近 no-op，弃。）

## 2026-10-28（Asia/Shanghai）r87 — REJECTED
- 跟敌最小压省大牌。bit1 −0.294 [−0.366,−0.222]、bit2 −0.065 [−0.125,−0.005]、bit3 −0.389 [−0.456,−0.323]（均显著负）、bit4 −0.013 [−0.080,0.054]（4000 副，18700000，无 CI lo>0）。不发布，GD_R87 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r87.md。已穷尽：跟敌最小压/省大牌邻域。

## 2026-10-28（Asia/Shanghai）r88 — 进行中
- 自创正交轴：对家牌后顶防下家中短手（跟对家非炸、首选过、下家敌剩 2–6 张、对家>2 张 → 用最小非炸非控合法压牌顶对家夺领权；异于 r69 拦下家报单、r87 跟敌最小压、r84 改过、r76–78 残局座位）。GD_R88 默认 0：bit1 下家 2–3 张、bit2 下家 4–6 张、bit4 仅对家≥8 张；跑 bit1/2/3/5。首种子 18800000，4000 副进贡 matchLen=8，基线 backups/r88-base，脚本 /tmp/run-r88-ab.sh，日志 selfplay/logs/ab-r88-*。

## 2026-10-28（Asia/Shanghai）r88 — REJECTED
- 对家牌后顶防下家中短手。bit1 +0.027 [−0.019,0.073]、bit2 −0.038 [−0.084,0.008]、bit3 −0.048 [−0.101,0.006]、bit5 −0.026 [−0.068,0.016]（4000 副，18800000，CI 全跨 0）。不发布，GD_R88 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r88.md。已穷尽：对家牌后顶牌邻域。

## 2026-10-28（Asia/Shanghai）r89 — 进行中
- 自创正交轴：记牌领出控权（领出时在分差≤M60 的非炸非走完单/对/三候选中，换成外面未出且不在我手、可压它的同型点数最少者；用 belief.remainingByRank；异于 r87 跟敌最小压、r86 甩牌节奏、r82 同型实现、r76–78 残局、r45/r50）。smoke 48 副触发 ≈285–343 次（≈12% A 方决策）。GD_R89 默认 0：bit1 首选单/对时、bit2 首选任意非炸型、bit4 仅手 ≤12 张、bit8 要求换后外面可压数=0；跑 bit1/2/5/9。首种子 18900000，4000 副进贡 matchLen=8，基线 backups/r89-base，脚本 /tmp/run-r89-ab.sh，日志 selfplay/logs/ab-r89-*。

## 2026-10-28（Asia/Shanghai）r89 — REJECTED
- 记牌领出控权。bit1 +0.017 [−0.027,0.061]、bit2 +0.011 [−0.029,0.051]、bit5 +0.030 [−0.008,0.068]、bit9 +0.007 [−0.029,0.044]（4000 副，18900000，CI 全跨 0）。不发布，GD_R89 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r89.md。已穷尽：记牌领出控权邻域。

## 2026-10-28（Asia/Shanghai）r90 — 进行中
- 自创正交轴：领出顺子减手（领出、首选非炸非顺子非走完时，若分差≤M 内有非炸顺子候选则改出顺子；异于 r33L 开局连对/钢板、r73 三带二/钢板、r59 孤单、r89 记牌控权、r45/r50）。smoke 48 副触发 54–70 次（≈2–3% A 方决策）。GD_R90 默认 0：bit1 启用 M=250、bit2 放宽 M2=1000、bit4 仅下家敌 ≥8 张、bit8 仅低顺（顶 ≤10）；跑 bit1/3/5/9。首种子 19000000，4000 副进贡 matchLen=8，基线 backups/r90-base，脚本 /tmp/run-r90-ab.sh，日志 selfplay/logs/ab-r90-*。

## 2026-10-28（Asia/Shanghai）r90 — REJECTED
- 领出顺子减手。bit1 −0.537 [−0.610,−0.464]、bit3 −0.644 [−0.721,−0.568]、bit5 −0.561 [−0.637,−0.485]、bit9 −0.379 [−0.456,−0.301]（4000 副，19000000，均显著负）。不发布，GD_R90 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r90.md。已穷尽：领出顺子减手邻域。

## 2026-10-28（Asia/Shanghai）r91 — 进行中
- 自创正交轴：领出同型最小点先走（领出且首选非炸非走完单/对时，分差≤M 内有同型更小点候选则改领最小点，先清小牌留大牌控权；异于 r59 孤单、r89 记牌控权、r90 顺子、r82 同型同点实现、r87 跟敌最小压、r45/r50）。先试「末家拦截」变体 smoke 触发仅 ≈8–10 次/48 副，弃用。smoke 48 副触发 17–25 次（≈1% A 方决策）。GD_R91 默认 0：bit1 启用 M=150、bit2 放宽 M2=600、bit4 仅手 ≥10 张、bit8 仅单张；跑 bit1/3/5/9。首种子 19100000，4000 副进贡 matchLen=8，基线 backups/r91-base，脚本 /tmp/run-r91-ab.sh，日志 selfplay/logs/ab-r91-*。

## 2026-10-28（Asia/Shanghai）r91 — REJECTED
- 领出同型最小点先走。bit1 −0.166 [−0.235,−0.097]、bit3 −0.744 [−0.815,−0.672]、bit5 −0.083 [−0.145,−0.021]、bit9 −0.113 [−0.177,−0.049]（4000 副，19100000，均显著负）。不发布，GD_R91 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r91.md。已穷尽：领出同型最小点邻域（连同 r89，领出点数选择整体穷尽）；r59、r75–r91、r45/r50 邻域均穷尽。

## 2026-10-28（Asia/Shanghai）r92 — 进行中
- 自创正交轴：领出单改对（领出且首选为非炸非走完单张时，分差≤M 内有非炸对子候选则改领对子；换牌型而非换点数，异于 r91 同型最小点、r90 顺子减手、r89 记牌控权、r59 孤单、r82 同型实现、r45/r50）。smoke 48 副（19290000）触发 bit1 62 次、bit3 87 次、bit9 8 次（bit1 ≈2–3% A 方决策）。GD_R92 默认 0：bit1 启用 M=150、bit2 放宽 M2=600、bit4 仅手 ≥10 张、bit8 仅对子点数 ≤ 原单张；跑 bit1/3/5/9。首种子 19200000，4000 副进贡 matchLen=8，基线 backups/r92-base（selfplay/.versions/r92-base），脚本 /tmp/run-r92-ab.sh，日志 selfplay/logs/ab-r92-*。

## 2026-10-29（Asia/Shanghai）r92 — REJECTED
- 领出单改对。bit1 −0.274 [−0.351,−0.196]、bit3 −1.055 [−1.127,−0.983]、bit5 −0.242 [−0.315,−0.170]、bit9 −0.094 [−0.165,−0.023]（4000 副，19200000，均显著负）。不发布，GD_R92 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r92.md。已穷尽：领出牌型改写；r89–r92 领出结构改写整体穷尽；r59、r75–r92、r45/r50 邻域均穷尽。

## 2026-10-29（Asia/Shanghai）r93 — 进行中
- 自创正交轴：跟敌贴边改压（结构不劣）——跟敌非炸、首选过，分差≤M 内有非炸非走完压牌且压后 minPlays 不多于压前 → 改压（r84 贴边改过的镜像；异于 r47 压后≤K 手走完、r87 最小压、r88 跟对家、r89–r92 领出）。GD_R93 默认 0：bit1 启用 M=150、bit2 放宽 M2=600、bit4 仅手 ≥10 张、bit8 压后 minPlays 须严格减少。smoke 48 副（19390000）触发 bit1 85 次、bit3 3 次、bit9 2 次。跑 bit1/3/5/9，首种子 19300000，4000 副进贡 matchLen=8，基线 backups/r93-base（selfplay/.versions/r93-base），脚本 /tmp/run-r93-ab.sh，日志 selfplay/logs/ab-r93-*。

## 2026-10-29（Asia/Shanghai）r93 — REJECTED
- 跟敌贴边改压（结构不劣）。bit1 +0.005 [−0.038,0.047]、bit3 −0.017 [−0.061,0.028]、bit5 −0.018 [−0.066,0.031]、bit9 −0.016 [−0.058,0.026]（4000 副，19300000，CI 全跨 0）。不发布，GD_R93 默认 0。报告 selfplay/reports/r93.md。已穷尽：r84 镜像邻域。

## 2026-10-29（Asia/Shanghai）r94 — REJECTED
- 跟敌小牌不炸省炸。bit1 −0.160 [−0.232,−0.088]、bit3 −0.181 [−0.254,−0.109]、bit9 −0.112 [−0.188,−0.036]（显著负）、bit5 −0.025 [−0.091,0.041]（4000 副，19400000，无 CI lo>0）。不发布，GD_R94 默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r94.md。已穷尽：跟敌省炸（首选炸改过）邻域。

## 2026-10-29（Asia/Shanghai）r95 — SHIPPED bit5（GD_R95=5）
- 自创正交轴：跟敌压牌按手牌规划成本选——跟敌非炸、首选为非炸非走完压牌，分差≤M 内其他非炸压牌中余牌 handplan.decompose 成本最低者若比首选低 ≥D → 改用（成本含拆炸/控制/逢人配惩罚；异于 r87 最小点、r93 minPlays 改压、r84 改过、r82 同型实现、领出 plan 权重；避开 r59、r75–r94、r45/r50）。GD_R95 默认 0：bit1 启用 M=150、D=0.2；bit2 放宽 M2=600；bit4 候选含「过」；bit8 仅我手 ≥10 张。smoke 48 副（19590000）触发 D=0.2 bit1 23 次（≈1% A 方决策；D=0.5 仅 11 次弃）、GD_R95=0 对 base Δ=0。跑 bit1/3/5/9，首种子 19500000，4000 副进贡 matchLen=8，基线 backups/r95-base，脚本 /tmp/run-r95-ab.sh，日志 selfplay/logs/ab-r95-*（启动 2026-10-29 02:09:10 CST）。
- 结果：bit1 −0.025 [−0.097,0.048]、bit3 +0.008 [−0.059,0.075]、bit9 +0.018 [−0.050,0.087]（19500000）；bit5 +0.091 [0.017,0.164]（19500000）/ +0.084 [0.016,0.151]（19510000）双种子 lo>0 → 默认 GD_R95=5。regress-all 金标较旧基线降（holdout2 58→53 等，自博弈优先，见报告）。线上缓存 guandan-play-90568fce7f。报告 selfplay/reports/r95.md

## 2026-10-29（Asia/Shanghai）r96 — 进行中
- 自创正交轴：领出按手牌规划成本选——领出且首选非炸非走完，分差≤M 内其他非炸非走完领出候选中余牌 handplan.decompose 成本最低者若比首选低 ≥D → 改领（决策点为领出；异于 r95 跟敌、r89 记牌控权、r90 顺子、r91 最小点、r92 单改对、r59、r75–r95、r45/r50）。GD_R96 默认 0：bit1 M=150、D=0.2；bit2 M2=600；bit4 仅手 ≥10；bit8 仅候选张数 ≥ 首选。smoke 48 副（19690000）bit1 触发 35 次（≈1.5% 决策，r95 为 23 次）、GD_R96=0 对 base Δ=0。基线 backups/r96-base（含 GD_R95=5），跑 bit1/3/5/9，首种子 19600000，4000 副进贡 matchLen=8，脚本 /tmp/run-r96-ab.sh，日志 selfplay/logs/ab-r96-*（启动 2026-10-29 02:56:41 CST）。

## 2026-10-29（Asia/Shanghai）r96 — REJECTED
- 领出按手牌规划成本选。bit1 +0.029 [−0.030,0.088]、bit3 +0.034 [−0.017,0.086]、bit5 −0.004 [−0.057,0.049]、bit9 +0.030 [−0.019,0.080]（4000 副，19600000，CI 全跨 0，03:27 CST 完成）。不发布，GD_R96 默认 0，线上仍 guandan-play-90568fce7f。报告 selfplay/reports/r96.md。已穷尽：领出规划成本选邻域；领出改写（r89–r92、r96）整体穷尽；r59、r75–r96、r45/r50 邻域均穷尽。

## 2026-10-28（America/Toronto）r97 — REJECTED
- 非炸出牌省逢人配/控牌。bit1 −0.004 [−0.060,0.052]、bit3 −0.005 [−0.056,0.045]、bit7 +0.035 [−0.017,0.087]、bit11 −0.061 [−0.112,−0.010]（显著负）（4000 副，19700000，无 CI lo>0，16:25 EDT 完成）。不发布，GD_R97 默认 0，线上仍 guandan-play-90568fce7f。报告 selfplay/reports/r97.md。已穷尽：省逢人配/级牌/王邻域；r59、r75–r97、r45/r50 邻域均穷尽。

## 2026-10-28（America/Toronto）r98 — 进行中
- 自创正交轴：收官出牌顺序「先出难压的」——领出且首选非炸非走完、出后余牌 ≤K 手（K=1，bit4 起 K=2）时，分差≤M 内同样余牌≤K 的非炸领出候选中主点 singleStrength 最高者若高于首选 → 改领（跳过 r95PlanBeat，不扰动 r95；异于 r89–r92/r96 领出改写、r97 省万能牌）。GD_R98 默认 0：bit1 M=300；bit2 M2=1200；bit4 K=2；bit8 仅 endgame 求解器不适用时。smoke 48 副（19890000）GD_R98=0 对 base Δ=0；bit1 触发 12 次、bit7 42 次（≈0.5%/1.8% 决策）。基线 backups/r98-base（含 GD_R95=5），跑 bit3/5/7/13，首种子 19800000，4000 副进贡 matchLen=8，脚本 /tmp/run-r98-ab.sh，日志 selfplay/logs/ab-r98-*（启动 2026-10-28 16:27:52 EDT）。

## 2026-10-28（America/Toronto）r98 — REJECTED
- 收官先出难压。bit3 −0.178 [−0.250,−0.106]、bit5 −0.430 [−0.502,−0.358]、bit7 −0.528 [−0.599,−0.458]、bit13 −0.432 [−0.503,−0.360]（4000 副，19800000，均显著负，17:01 EDT 完成）。不发布，GD_R98 默认 0，线上仍 guandan-play-90568fce7f。报告 selfplay/reports/r98.md。已穷尽：收官领出顺序邻域（领出改写方向 r89–r92/r96/r98 整体穷尽）。

## 2026-10-28（America/Toronto）r99 — 进行中
- 自创正交轴：早盘跟敌小牌省控制牌改过——跟敌非炸、敌出主点 ≤10，首选为用到大小王/级牌（bit2 起含 A）的非炸压牌，我手 ≥12 且两敌都 ≥10 张时，分差≤M 内「过」→ 改过（异于 r84 贴边改过无控制牌条件、r97 换压牌、r94 省炸、r87 最小压、r95；不动 r95PlanBeat）。GD_R99 默认 0：bit1 M=600；bit2 含 A；bit4 M2=2000；bit8 仅敌出单/对。smoke 48 副（19990000）GD_R99=0 对 base Δ=0（空载）；bit1 触发 22 次、bit7 34 次（≈1%/1.4% 决策）。基线 backups/r99-base（不含 r99 块，含 GD_R95=5），跑 bit1/3/5/9，首种子 19900000，4000 副进贡 matchLen=8，脚本 /tmp/run-r99-ab.sh，日志 selfplay/logs/ab-r99-*（启动 2026-10-28 17:02 EDT）。

## 2026-10-28（America/Toronto）r99 — REJECTED
- 早盘省控制牌改过。bit1 −0.070 [−0.135,−0.005]、bit3 −0.163 [−0.234,−0.091]、bit5 −0.075 [−0.145,−0.005]（显著负）、bit9 −0.015 [−0.078,0.048]（4000 副，19900000，无 CI lo>0，17:41 EDT 完成）。不发布，GD_R99 默认 0，线上仍 guandan-play-90568fce7f。报告 selfplay/reports/r99.md。已穷尽：早盘省控制牌改过邻域（跟敌省牌/改过方向 r84/r94/r97/r99 整体穷尽）；r59、r75–r99、r45/r50 邻域均穷尽。

## 2026-10-29（America/Toronto）r106 — REJECTED
- 敌报牌领出避型。bit1 −0.006 [−0.054,0.042]、bit3 −0.009 [−0.060,0.041]、bit5 −0.004 [−0.053,0.045]、bit7 +0.051 [−0.001,0.103]（4000 副，20600000，无 CI lo>0，23:04 EDT 完成）。不发布，GD_R106 默认 0，线上仍 guandan-play-90568fce7f。报告 selfplay/reports/r106.md。已穷尽：敌报牌领出避型邻域。

## 2026-10-29（America/Toronto）r107 — 进行中
- 自创正交轴：上家敌出、对家可接时让对家——跟敌非炸且出牌者为上家敌（对家尚未表态），首选为非炸非走完压牌（非 r95PlanBeat）、对家余牌 < 我余牌时，分差≤M 内「过」→ 改过（座位+对家张数；异于 r84 贴边改过、r99 控制牌改过、r104 末位改压、r52/r54/r88）。GD_R107 默认 0：bit1 M=300；bit2 M2=900；bit4 仅对家≤8 张；bit8 仅敌出主点≤10。backups/r107-base（无 r107 块，含 GD_R95=5）。smoke 48 副 20790000：GD_R107=0 Δ≡0；bit1 触发 176/48 副（≈3.7/副）。A/B 4000 副 --tribute --matchLen=8 seed 20700000 bits 1/3/5/9 vs r107-base，/tmp/run-r107-ab.sh，logs selfplay/logs/ab-r107-*，23:05 EDT 开跑，预计约 23:30 EDT ALL_DONE。

## 2026-10-29（America/Toronto）r107 — REJECTED
- 上家敌出让对家改过。bit1 −0.473 [−0.543,−0.404]、bit3 −0.523 [−0.590,−0.457]、bit5 −0.218 [−0.289,−0.147]、bit9 −0.189 [−0.266,−0.112]（4000 副，20700000，均显著负，23:39 EDT 完成）。不发布，GD_R107 默认 0，线上仍 guandan-play-90568fce7f。报告 selfplay/reports/r107.md。已穷尽：压→改过让对家邻域（r84/r99/r107 压→改过簇）。

## 2026-10-29（America/Toronto）r108 — 进行中
- 自创正交轴：敌头游后抢二游——已有敌方出完、对家未出完，跟剩余敌非炸、首选为过（非 r95PlanBeat）时，分差≤M 内有非走完炸弹 → 改炸（异于 r45/r46/r60、r94、r61、r84/r99/r107、r93/r103–r105）。GD_R108 默认 0：bit1 M=300；bit2 M2=900；bit4 也允许非炸压牌；bit8 仅剩余敌 ≤8 张。backups/r108-base（无 r108 块，含 GD_R95=5）。smoke 48 副 20890000（串行）：GD_R108=0 Δ≡0.000；bit1/bit5 Δ=−0.188（触发存在；arena 不转发 R108TRIG stderr，未计次）。A/B 4000 副 --tribute --matchLen=8 seed 20800000 bits 1/3/5/9 vs r108-base，/tmp/run-r108-ab.sh，logs selfplay/logs/ab-r108-*，23:57 EDT 开跑。

## 2026-10-30（America/Toronto）r108 — REJECTED
- 敌头游后抢二游（跟剩余敌过→炸）。bit1 −0.025 [−0.078, 0.027] 49.6%、bit3 +0.013 [−0.043, 0.069] 50.3%、bit5 −0.004 [−0.057, 0.049] 50.0%、bit9 −0.052 [−0.109, 0.005] 49.3%（4000 副，20800000，无 CI lo>0，00:38 EDT / 日志 12:38 CST 完成）。不发布，GD_R108 默认 0，线上仍 guandan-play-90568fce7f（GD_R95=5）。报告 selfplay/reports/r108.md。已穷尽：敌头游后炸/抢二游邻域。

## 2026-10-30（America/Toronto）r109 — 进行中
- 自创正交轴：记牌跟敌换控权顶张——跟敌非炸、首选为非炸非走完压牌（非 r95PlanBeat），分差≤M 内其他非炸非走完压牌中，外面（belief.remainingByRank）可压同型点数严格更少者 → 改用最少者（异于 r89 领出记牌、r103 过→必回手、r95 规划成本、r87/r100/r102/r106；避开 r59、r75–r108、过→改压、压→改过、领出结构、敌报牌避型、末位拦截、敌头游后炸、短手顶大、对家短手让路、拆组换不拆）。GD_R109 默认 0：bit1 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅首选 beaters≥2。backups/r109-base（无 r109 块，含 GD_R95=5）。smoke 48 副 20990000 串行：GD_R109=0 Δ≡0.000；bit1 触发 68、bit3 69、bit5 56、bit9 124（≈1.4–2.6/副）。A/B 4000 副 --tribute --matchLen=8 seed 20900000 bits 1/3/5/9 vs r109-base，/tmp/run-r109-ab.sh，logs selfplay/logs/ab-r109-*。

## 2026-10-30（America/Toronto）r109 — REJECTED
- 记牌跟敌换控权顶张。bit1 −0.964 [−1.038, −0.890]、bit3 −1.038 [−1.111, −0.966]、bit5 −0.994 [−1.066, −0.921]、bit9 −0.944 [−1.019, −0.868]（4000 副，20900000，均显著负，01:17 EDT / 日志 13:17 CST 完成）。不发布，GD_R109 默认 0，线上仍 guandan-play-90568fce7f（GD_R95=5）。报告 selfplay/reports/r109.md。已穷尽：记牌跟敌换控权顶张邻域。

## 2026-10-30（America/Toronto）r110 — 进行中
- 自创正交轴：跟敌压牌减孤张——跟敌非炸、首选为非炸非走完压牌（非 r95PlanBeat），分差≤M 内其他非炸非走完压牌中，压后余牌天然孤张数严格更少者 → 改用（异于 r102/r95/r87/r100/r82/r109；避开 r59、r75–r109、过→改压、压→改过、领出结构、敌报牌避型、末位拦截、敌头游后炸、短手顶大、对家短手让路、拆组换不拆、记牌换控权顶）。先试「跟对家大牌改过」smoke 触发仅 1/48 弃。GD_R110 默认 0：bit1 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅首选压后孤张≥2。backups/r110-base（无 r110 块，含 GD_R95=5）。smoke 48 副 21090000 串行：GD_R110=0 Δ≡0.000；bit1 触发 39 Δ=+0.604、bit3 19、bit5 35、bit9 15。A/B 4000 副 --tribute --matchLen=8 seed 21000000 bits 1/3/5/9 vs r110-base，/tmp/run-r110-ab.sh，logs selfplay/logs/ab-r110-*。

## 2026-10-30（America/Toronto）r110 — REJECTED
- 跟敌压牌减孤张：首种子 21000000 bit1 Δ −0.120 [−0.199, −0.041] 48.2%；bit3 −0.129 [−0.200, −0.058] 47.9%；bit5 −0.056 [−0.129, 0.017] 49.8%；bit9 −0.045 [−0.121, 0.030] 49.4%。无 lo>0（bit1/3 显著负）→ 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 01:52 EDT / 日志 13:52 CST）。GD_R110 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r110.md。已穷尽：跟敌压牌减孤张邻域。

## 2026-10-30（America/Toronto）r111 — 进行中
- 自创正交轴「跟敌压牌省控制牌」GD_R111（默认 0）：跟敌非炸、首选为非炸非走完压牌且用到控制牌（大王/小王/级牌/A）（非 r95PlanBeat），分差≤M 内有不含控制牌的非炸非走完压 → 改用分最高者。bit1 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅敌出主点≤10。基线 backups/r111-base（不含 r111 块，含 GD_R95=5）。
- smoke 48 副 seed 21190000（串行）：GD_R111=0 Δ≡0；触发 bit1 32 / bit3 3 / bit5 22 / bit9 12（stderr 仅相对参考）。
- 跑 bit1/3/5/9，seed 21100000，4000 副 tribute matchLen=8，脚本 /tmp/run-r111-ab.sh，日志 selfplay/logs/ab-r111-*，01:57 EDT / 13:57 CST 开跑。

## 2026-10-30（America/Toronto）r111 — REJECTED
- 跟敌压牌省控制牌：首种子 21100000 bit1 Δ −0.085 [−0.159, −0.010] 48.5%；bit3 −0.086 [−0.159, −0.014] 48.3%；bit5 −0.094 [−0.160, −0.028] 48.3%；bit9 −0.037 [−0.110, 0.036] 49.3%。无 lo>0（bit1/3/5 显著负）→ 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 02:47 EDT / 日志 14:47 CST）。GD_R111 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r111.md。已穷尽：跟敌压牌省控制牌邻域。

## 2026-10-30（America/Toronto）r112 — 进行中
- 自创正交轴「跟敌压牌后留控更多」GD_R112（默认 0）：跟敌非炸、首选为非炸非走完压牌（非 r95PlanBeat），分差≤M 内其他非炸非走完压牌中，压后余牌控制牌数（大王/小王/级牌/A）严格更多者 → 改用最多者（同多取分高）。bit1 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅首选压后控牌≤1。基线 backups/r112-base（不含 r112 块，含 GD_R95=5）。
- smoke 48 副 seed 21290000（串行）：GD_R112=0 Δ≡0；触发 bit1 14 / bit3 10 / bit5 16 / bit9 7（stderr 仅相对参考）。
- 跑 bit1/3/5/9，seed 21200000，4000 副 tribute matchLen=8，脚本 /tmp/run-r112-ab.sh，日志 selfplay/logs/ab-r112-*，2026-10-30 02:55 EDT / 14:55 CST 开跑。

## 2026-10-30（America/Toronto）r112 — REJECTED
- 跟敌压牌后留控更多：首种子 21200000 bit1 Δ −0.045 [−0.118, 0.028] 49.5%；bit3 −0.057 [−0.128, 0.013] 49.4%；bit5 −0.096 [−0.164, −0.028] 47.9%；bit9 −0.054 [−0.118, 0.010] 49.1%。无 lo>0（bit5 显著负）→ 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 03:18 EDT / 日志 15:18 CST）。GD_R112 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r112.md。已穷尽：跟敌压牌后留控更多邻域。

## 2026-10-30（America/Toronto）r113 — 进行中
- 自创正交轴「跟敌压牌后留三张更多」GD_R113（默认 0）：跟敌非炸、首选为非炸非走完压牌（非 r95PlanBeat），分差≤M 内其他非炸非走完压牌中，压后余牌天然三张组数（非逢人配/王、同点恰 3 张）严格更多者 → 改用最多者（同多取分高）。bit1 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅首选压后三张组≤1。基线 backups/r113-base（不含 r113 块，含 GD_R95=5；含 r112 默认 0）。
- smoke 48 副 seed 21390000（串行）：GD_R113=0 Δ≡0；触发 bit1 25 / bit3 37 / bit5 3 / bit9 7（stderr 仅相对参考）。
- 跑 bit1/3/5/9，seed 21300000，4000 副 tribute matchLen=8，脚本 /tmp/run-r113-ab.sh，日志 selfplay/logs/ab-r113-*，2026-10-30 03:25 EDT / 15:25 CST 开跑。


## 2026-10-30（America/Toronto）r113 — REJECTED
- 跟敌压牌后留三张更多：首种子 21300000 bit1 Δ −0.080 [−0.156, −0.004] 48.7%；bit3 −0.138 [−0.211, −0.064] 47.4%；bit5 −0.002 [−0.065, 0.060] 50.2%；bit9 −0.039 [−0.105, 0.026] 49.5%。无 lo>0（bit1/3 显著负）→ 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 03:48 EDT / 日志 15:47 CST）。GD_R113 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r113.md。已穷尽：跟敌压牌后留三张更多邻域。

## 2026-10-30（America/Toronto）r114 — 进行中
- 自创正交轴「跟敌压牌后结构更丰富」GD_R114（默认 0）：跟敌非炸、首选为非炸非走完压牌（非 r95PlanBeat），分差≤M 内其他非炸非走完压牌中，压后余牌结构分（天然对×1 + 三张×2 + 炸弹×3；非逢人配/王）严格更高者 → 改用最高者（同高取分高）。bit1 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅首选压后结构分≤2。基线 backups/r114-base（不含 r114 块，含 GD_R95=5；含 r113 默认 0）。
- smoke 48 副 seed 21490000（串行）：GD_R114=0 Δ≡0；触发 bit1 21 / bit3 23 / bit5 17 / bit9 1（stderr 仅相对参考）。
- 跑 bit1/3/5/9，seed 21400000，4000 副 tribute matchLen=8，脚本 /tmp/run-r114-ab.sh，日志 selfplay/logs/ab-r114-*，2026-10-30 03:54 EDT / 15:54 CST 开跑。

## 2026-10-30（America/Toronto）r114 — REJECTED
- 跟敌压牌后结构更丰富：首种子 21400000 bit1 Δ −0.211 [−0.287, −0.136] 46.6%；bit3 −0.189 [−0.264, −0.114] 47.0%；bit5 −0.197 [−0.273, −0.120] 46.5%；bit9 +0.003 [−0.045, 0.050] 49.9%。无 lo>0（bit1/3/5 显著负）→ 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 04:20 EDT / 日志 16:20 CST）。GD_R114 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r114.md。已穷尽：跟敌压牌后结构更丰富邻域。

## 2026-10-30（America/Toronto）r115 — 进行中
- 自创正交轴「跟敌能压不炸」GD_R115（默认 0）：跟敌非炸、首选为非走完炸弹（非 r95PlanBeat），分差≤M 内有非炸非走完压牌 → 改用分最高者（炸弹时机：能非炸压则留炸）。bit1 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅两敌余牌都 >8。基线 backups/r115-base（不含 r115 块，含 GD_R95=5；含 r114 默认 0）。
- smoke 48 副 seed 21590000（串行）：GD_R115=0 Δ≡0；触发 bit1 7 / bit3 9 / bit5 2 / bit9 4（stderr 仅相对参考）。
- 跑 bit1/3/5/9，seed 21500000，4000 副 tribute matchLen=8，脚本 /tmp/run-r115-ab.sh，日志 selfplay/logs/ab-r115-*，2026-10-30 04:28 EDT / 16:28 CST 开跑。

## 2026-10-30（America/Toronto）r115 — REJECTED
- 跟敌能压不炸：首种子 21500000 bit1 Δ −0.035 [−0.097, 0.027] 49.0%；bit3 −0.005 [−0.068, 0.059] 49.9%；bit5 −0.022 [−0.077, 0.032] 49.7%；bit9 −0.034 [−0.090, 0.022] 49.2%。无 lo>0（CI 全跨 0）→ 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 04:50 EDT / 日志 16:50 CST）。GD_R115 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r115.md。已穷尽：跟敌能压不炸邻域。

## 2026-10-30（America/Toronto）r116 — 进行中
- 自创正交轴「领出减手数」GD_R116（默认 0）：领出、首选为非炸非走完（非 r95PlanBeat）时，分差≤M 内其他非炸非走完领出中，出后 minPlays 严格更少者 → 改用最少者（同少取分高）。bit1 M=300；bit2 M2=900；bit4 仅我手≥12；bit8 仅首选出后 minPlays≥3。异于 r90/r92/r89/r96/r98；避开 r59、r75–r115、跟敌改压后结构/控/孤张/三张/能压不炸簇；保留 sticky GD_R95=5；不动 r95PlanBeat。先试「接风领出减手数」trig=0、「记牌敌顶必压」trig低、「领出甩多张」smoke 显著负，改本轴。机器重启后按简报恢复「领出减手数」并重开 AB。
- 基线 backups/r116-base（不含 r116 块，含 GD_R95=5；含 r115 默认 0）。
- smoke 48 副 seed 21690000（串行）：GD_R116=0 Δ≡0；触发 bit1 7 / bit3 3 / bit5 2 / bit9 2；bit1/3/5/9 smoke Δ≈+0.23~+0.25（n=48 噪声大，仅相对参考）。
- 跑 bit1/3/5/9，seed 21600000，4000 副 tribute matchLen=8，脚本 /tmp/run-r116-ab.sh，日志 selfplay/logs/ab-r116-*，重启后重开（17:07 CST）。

## 2026-10-30（America/Toronto）r116 — REJECTED
- 领出减手数：首种子 21600000 bit1 Δ +0.038 [−0.021, 0.098] 50.7%；bit3 −0.009 [−0.069, 0.051] 49.9%；bit5 +0.026 [−0.030, 0.083] 50.7%；bit9 +0.002 [−0.055, 0.059] 50.1%。无 lo>0（CI 全跨 0）→ 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 05:36 EDT / 日志 17:36 CST）。GD_R116 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r116.md。已穷尽：领出减手数邻域。

## 2026-10-30（America/Toronto）r117 — 进行中
- 自创正交轴「领出减孤张」GD_R117（默认 0）：领出、首选为非炸非走完（非 r95PlanBeat）时，分差≤M 内其他非炸非走完领出中，出后余牌天然孤张数（非逢人配、同点恰 1 张）严格更少者 → 改用最少者（同少取分高）。bit1 M=300；bit2 M2=900；bit4 仅我手≥12；bit8 仅首选出后孤张≥2。异于 r116 减手数、r110 跟敌减孤张、r89/r90/r92/r96/r98；避开 r59、r75–r116、跟敌改压后结构/控/孤张/三张/能压不炸簇；保留 sticky GD_R95=5；不动 r95PlanBeat。
- 基线 backups/r117-base（不含 r117 块，含 GD_R95=5；含 r116 默认 0）。
- smoke 48 副 seed 21790000（串行）：GD_R117=0 Δ≡0（复测）；触发 bit1 59 / bit3 117 / bit5 94 / bit9 65。
- 跑 bit1/3/5/9，seed 21700000，4000 副 tribute matchLen=8，脚本 /tmp/run-r117-ab.sh，日志 selfplay/logs/ab-r117-*。

## 2026-10-30（America/Toronto）r117 — REJECTED
- 领出减孤张：首种子 21700000 bit1 Δ −0.410 [−0.485, −0.335] 44.1%；bit3 −0.409 [−0.488, −0.331] 43.8%；bit5 −0.391 [−0.464, −0.319] 43.2%；bit9 −0.199 [−0.271, −0.128] 46.8%。无 lo>0（均显著负）→ 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 06:04 EDT / 日志 18:04 CST）。GD_R117 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r117.md。已穷尽：领出减孤张邻域。

## 2026-10-30（America/Toronto）r118 — 进行中
- 自创正交轴「对家已出完领出甩多张」GD_R118（默认 0）：领出、对家余牌=0、至少一敌仍在、首选为非炸非走完（非 r95PlanBeat）时，分差≤M 内其他非炸非走完领出中张数严格更多者 → 改用最多者（同多取分高）。bit1 M=300；bit2 M2=900；bit4 仅两敌都在；bit8 仅首选张数≤3。异于 r78 bit2 emin 门槛、r108 敌头游后炸、r56/r86；避开 r59、r75–r117、跟敌改压结构簇、能压不炸、领出减手数/减孤张；保留 sticky GD_R95=5；不动 r95PlanBeat。先试「领出保天然对」smoke 显著负、「跟对家省控/最小压/让路」trig=0，改本轴。
- 基线 backups/r118-base（不含 r118 块，含 GD_R95=5；含 r117 默认 0）。
- smoke 48 副 seed 21890000（串行）：GD_R118=0 Δ≡0；触发 bit1 11 / bit3 10 / bit5 10 / bit9 9；smoke Δ≈−0.02~−0.17（n=48 噪声大，仅相对参考）。
- 跑 bit1/3/5/9，seed 21800000，4000 副 tribute matchLen=8，脚本 /tmp/run-r118-ab.sh，日志 selfplay/logs/ab-r118-*。

## 2026-10-30（America/Toronto）r118 — REJECTED
- 对家已出完领出甩多张：首种子 21800000 bit1 Δ −0.049 [−0.102, 0.004] 49.8%；bit3 −0.088 [−0.142, −0.035] 49.5%；bit5 −0.044 [−0.096, 0.007] 50.2%；bit9 −0.051 [−0.107, 0.005] 49.8%。无 lo>0（bit3 显著负）→ 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 06:30 EDT / 日志 18:30 CST）。GD_R118 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r118.md。已穷尽：对家已出完领出甩多张邻域。

## 2026-10-30（America/Toronto）r119 — 进行中
- 自创正交轴「对家已出完跟敌压牌换最小点」GD_R119（默认 0）：对家余牌=0、跟敌非炸、首选为非炸非走完压牌（非 r95PlanBeat）时，分差≤M 内其他非炸非走完压牌中主点 singleStrength 严格更小者 → 改用最小者（同小取分高）。bit1 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅首选强度≥10。异于 r87 一般跟敌最小压、r118 领出甩多张、r108 炸、r61 bit16 过→压；避开 r59、r75–r118、跟敌改压结构簇、能压不炸、领出减手数/减孤张/对家出完甩多张；保留 sticky GD_R95=5；不动 r95PlanBeat。先试「记牌领出甩热/冷门点」smoke 显著负、「开局省控」trig低、「跟对家最小压」trig=0，改本接风轴。
- 基线 backups/r119-base（不含 r119 块，含 GD_R95=5；含 r118 默认 0）。
- smoke 48 副 seed 21990000（串行）：GD_R119=0 Δ≡0；触发 bit1 15 / bit3 16 / bit5 15 / bit9 6；smoke Δ≈+0.04~+0.17（n=48 噪声大，仅相对参考）。
- 跑 bit1/3/5/9，seed 21900000，4000 副 tribute matchLen=8，脚本 /tmp/run-r119-ab.sh，日志 selfplay/logs/ab-r119-*。

## 2026-10-30（America/Toronto）r119 — REJECTED
- 对家已出完跟敌压牌换最小点：首种子 21900000 bit1 Δ +0.025 [−0.025, 0.074] 50.9%；bit3 −0.035 [−0.078, 0.008] 49.7%；bit5 −0.021 [−0.071, 0.030] 50.0%；bit9 −0.020 [−0.071, 0.031] 49.6%。无 lo>0（CI 全跨 0）→ 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 06:57 EDT / 日志 18:56 CST）。GD_R119 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r119.md。已穷尽：对家已出完跟敌压牌换最小点邻域。

## 2026-10-30（America/Toronto）r120 — 进行中
- 自创正交轴「对家已出完领出换最小点」GD_R120（默认 0）：领出、对家余牌=0、至少一敌仍在、首选为非炸非走完（非 r95PlanBeat）时，分差≤M 内其他非炸非走完领出中主点 singleStrength 严格更小者 → 改用最小者（同小取分高）。bit1 M=300；bit2 M2=900；bit4 仅两敌都在；bit8 仅首选强度≥10。异于 r118 甩多张、r119 跟敌换最小点、r91 一般领出最小点、r116 减手数、r117 减孤张；避开 r59、r75–r119；保留 sticky GD_R95=5；不动 r95PlanBeat。先试「跟敌压牌减手数」trig=0，改本接风领出轴。
- 基线 backups/r120-base（不含 r120 块，含 GD_R95=5；含 r119 默认 0）。
- smoke 48 副 seed 22090000（串行）：触发 bit1 17 / bit3 27 / bit5 13 / bit9 8；smoke Δ bit1/3 ≈+0.48（n=48 噪声大，仅相对参考）。
- 跑 bit1/3/5/9，seed 22000000，4000 副 tribute matchLen=8，脚本 /tmp/run-r120-ab.sh，日志 selfplay/logs/ab-r120-*，2026-10-30 07:02 EDT / 19:02 CST 开跑。

## 2026-10-30（America/Toronto）r120 — REJECTED
- 对家已出完领出换最小点：首种子 22000000 bit1 Δ −0.066 [−0.120, −0.012] 49.8%；bit3 −0.037 [−0.095, 0.020] 50.6%；bit5 −0.046 [−0.098, 0.005] 49.6%；bit9 +0.029 [−0.024, 0.081] 51.1%。无 lo>0（bit1 显著负）→ 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 07:26 EDT / 日志 19:26 CST）。GD_R120 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r120.md。已穷尽：对家已出完领出换最小点邻域；对家出完甩多张/换最小点簇（r118–r120）整体穷尽。

## 2026-10-30（America/Toronto）r121 — 进行中
- 自创正交轴「对家已出完领出换最大点」GD_R121（默认 0）：领出、对家余牌=0、至少一敌仍在、首选为非炸非走完（非 r95PlanBeat）时，分差≤M 内其他非炸非走完领出中主点 singleStrength 严格更大者 → 改用最大者（同大取分高）。bit1 M=300；bit2 M2=900；bit4 仅两敌都在；bit8 仅首选强度≤10。对偶 r120 换最小点；异于 r118 甩多张、r119 跟敌换最小、r98 收官难压、r100 短敌顶大；避开 r59、r75–r120、对家出完甩多张/换最小点簇；保留 sticky GD_R95=5；不动 r95PlanBeat。先试「接风过→最小压」trig≈1、「对家仍在甩多张/留控/留对/记牌有顶改过」smoke 显著负，改本轴。
- 基线 backups/r121-base（不含 r121 块，含 GD_R95=5；含 r120 默认 0）。
- smoke 48 副 seed 22190000（串行）：GD_R121=0 Δ≡0；触发 bit1 14 / bit3 14 / bit5 23 / bit9 39；smoke Δ ≈−0.13~+0.25（n=48 噪声大，仅相对参考）。
- 跑 bit1/3/5/9，seed 22100000，4000 副 tribute matchLen=8，脚本 /tmp/run-r121-ab.sh，日志 selfplay/logs/ab-r121-*。

## 2026-10-30（America/Toronto）r121 — REJECTED
- 对家已出完领出换最大点：首种子 22100000 bit1 Δ −0.126 [−0.185, −0.067] 49.8%；bit3 −0.141 [−0.207, −0.076] 49.9%；bit5 −0.080 [−0.137, −0.024] 50.4%；bit9 −0.101 [−0.158, −0.043] 50.6%。无 lo>0（均显著负）→ 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 08:06 EDT / 日志 20:06 CST）。GD_R121 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r121.md。已穷尽：对家已出完领出换最大点邻域；对家出完甩多张/换最小最大点簇（r118–r121）整体穷尽。

## 2026-10-30（America/Toronto）r122 — 进行中
- 自创正交轴「记牌跟敌换松顶」GD_R122（默认 0）：跟敌非炸、首选为非炸非走完压牌（非 r95PlanBeat），分差≤M 内其他非炸非走完压牌中，外面（belief.remainingByRank）可压同型点数严格更多者 → 改用最多者（同多取分高；用中牌压、留真顶）。bit1 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅首选 outside beaters≤2。对偶 r109 换更少 beaters；异于 r87 最小点、r100 顶大、r95 handplan、r103 过→必回手；避开 r59、r75–r121、对家出完甩多张/换最小最大点簇；保留 sticky GD_R95=5；不动 r95PlanBeat。
- 基线 backups/r122-base（不含 r122 块，含 GD_R95=5；含 r121 默认 0）。
- smoke 48 副 seed 22290000（并行）：GD_R122=0 Δ≡0；触发 bit1 44 / bit3 51 / bit5 41 / bit9 18；smoke Δ ≈−0.56~+0.02（n=48 噪声大，仅相对参考）。
- 跑 bit1/3/5/9，seed 22200000，4000 副 tribute matchLen=8，脚本 /tmp/run-r122-ab.sh，日志 selfplay/logs/ab-r122-*。

## 2026-10-30（America/Toronto）r122 — REJECTED
- 记牌跟敌换松顶：首种子 22200000 bit1 Δ −0.487 [−0.558, −0.416] 41.5%；bit3 −0.516 [−0.589, −0.444] 41.0%；bit5 −0.484 [−0.557, −0.412] 41.5%；bit9 −0.137 [−0.207, −0.068] 47.0%。无 lo>0（均显著负）→ 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 08:27 EDT / 日志 20:27 CST）。GD_R122 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r122.md。已穷尽：记牌跟敌换松顶邻域；记牌跟敌换控权/松顶簇（r109/r122）整体惨败穷尽。

## 2026-10-30（America/Toronto）r123 — 进行中
- 自创正交轴「早盘领出甩多张」GD_R123（默认 0）：领出、（本副首领或我手≥H）、首选为非炸非走完（非 r95PlanBeat）时，分差≤M 内其他非炸非走完领出中张数严格更多者 → 改用最多者（同多取分高）。bit1 M=300 H=20；bit2 M2=900；bit4 仅 firstLeadOfDeal；bit8 仅首选张数≤3。异于 r118 对家出完甩多、一般领出甩多张惨败、r25/r64 开局顺子、r116 减手数；避开 r59、r75–r122、对家出完簇、记牌跟敌换控权/松顶惨败邻域（r109/r122）；保留 sticky GD_R95=5；不动 r95PlanBeat。先试「领出拆组换不拆」trig低、「跟敌换最大点/领出换更少张/接风换最大最小点」smoke 显著负、「跟对家非必要压改过」trig≈2，改本轴。
- 基线 backups/r123-base（不含 r123 块，含 GD_R95=5；含 r122 默认 0）。
- smoke 48 副 seed 22390000（并行）：GD_R123=0 Δ≡0；触发 bit1 31 / bit3 52 / bit5 7 / bit9 23；smoke Δ ≈−0.50~+0.50（n=48 噪声大，仅相对参考）。
- 跑 bit1/3/5/9，seed 22300000，4000 副 tribute matchLen=8，脚本 /tmp/run-r123-ab.sh，日志 selfplay/logs/ab-r123-*。

## 2026-10-30（America/Toronto）r123 — REJECTED
- 早盘领出甩多张：首种子 22300000 bit1 Δ −0.599 [−0.674, −0.525] 39.6%；bit3 −0.572 [−0.649, −0.495] 40.2%；bit5 −0.187 [−0.260, −0.114] 46.0%；bit9 −0.267 [−0.347, −0.186] 45.9%。无 lo>0（均显著负）→ 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 08:55 EDT / 日志 20:55 CST）。GD_R123 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r123.md。已穷尽：早盘领出甩多张邻域。

## 2026-10-30（America/Toronto）r124 — 进行中
- 自创正交轴「开局领出清孤张」GD_R124（默认 0）：本副首领领出、首选为非炸非走完（非 r95PlanBeat）时，分差≤M 内其他非炸非走完领出中，出后余牌天然孤张数（非逢人配、同点恰 1 张）严格更少者 → 改用最少者（同少取分高）。bit1 M=300；bit2 M2=900；bit4 仅手=27；bit8 仅首选出后孤张≥2。开局清散非省控；异于 r117 一般领出减孤张、r110 跟敌减孤张、r70/r99 省控、r123 早盘甩多；避开 r59、r75–r123、对家出完簇、记牌换控权/松顶、早盘甩多张惨败邻域；保留 sticky GD_R95=5；不动 r95PlanBeat。先试跟对家软让/换最小 trig低、跟敌留对/接风甩少/接风换最大 smoke 显著负，改本轴。
- 基线 backups/r124-base（不含 r124 块，含 GD_R95=5；含 r123 默认 0）。
- smoke 48 副 seed 22490000（并行）：GD_R124=0 Δ≡0；触发 bit1 14 / bit3 9 / bit5 9 / bit9 9；smoke Δ ≈+0.21~+0.25（n=48 噪声大，仅相对参考）。
- 跑 bit1/3/5/9，seed 22400000，4000 副 tribute matchLen=8，脚本 /tmp/run-r124-ab.sh，日志 selfplay/logs/ab-r124-*。

## 2026-10-30（America/Toronto）r124 — REJECTED
- 开局领出清孤张：首种子 22400000 bit1 Δ −0.013 [−0.092, 0.065] 49.8%；bit3 −0.054 [−0.133, 0.024] 48.9%；bit5 −0.010 [−0.086, 0.067] 49.8%；bit9 +0.019 [−0.060, 0.098] 50.7%。无 lo>0（CI 全跨 0）→ 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 09:23 EDT / 日志 21:23 CST）。GD_R124 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r124.md。已穷尽：开局领出清孤张邻域。

## 2026-10-30（America/Toronto）r125 — 进行中
- 自创正交轴「中盘领出清孤张」GD_R125（默认 0）：领出、非本副首领、我手在 [L,H]、首选为非炸非走完（非 r95PlanBeat）时，分差≤M 内其他非炸非走完领出中，出后余牌天然孤张数（非逢人配、同点恰 1 张）严格更少者 → 改用最少者（同少取分高）。bit1 M=300 L=10 H=18；bit2 M2=900；bit4 仅手∈[12,16]；bit8 仅首选出后孤张≥2。中盘清散；异于 r124 开局清孤张、r117 一般领出减孤张惨败、r110 跟敌减孤张、r123 早盘甩多；避开 r59、r75–r124、对家出完簇、记牌换控权/松顶、早盘甩多、开局清孤张、敌头游炸邻域；保留 sticky GD_R95=5；不动 r95PlanBeat。先试「敌头游后过→非炸压」trig≈0（且 r108 已含非炸变体邻域），改本轴。
- 基线 backups/r125-base（不含 r125 块，含 GD_R95=5；含 r124 默认 0）。
- smoke 48 副 seed 22590000（并行）：GD_R125=0 Δ≡0；触发 bit1 28 / bit3 23 / bit5 3 / bit9 3；smoke Δ ≈−0.31~+0.04（n=48 噪声大，仅相对参考）。
- 跑 bit1/3/5/9，seed 22500000，4000 副 tribute matchLen=8，脚本 /tmp/run-r125-ab.sh，日志 selfplay/logs/ab-r125-*。

## 2026-10-30（America/Toronto）r125 — REJECTED
- 中盘领出清孤张：首种子 22500000 bit1 Δ −0.095 [−0.166, −0.024] 48.5%；bit3 −0.151 [−0.225, −0.077] 47.3%；bit5 −0.054 [−0.125, 0.017] 48.9%；bit9 +0.014 [−0.060, 0.089] 50.2%。无 lo>0 → 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 09:55 EDT）。GD_R125 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r125.md。已穷尽：中盘领出清孤张邻域；领出清孤张簇（r117/r124/r125）整体穷尽。

## 2026-10-30（America/Toronto）r126 — 进行中
- 自创正交轴「领出保同花顺潜力」GD_R126（默认 0）：领出、非本副首领（bit8 含首领）、首选为非炸非走完（非 r95PlanBeat）时，分差≤M 内其他非炸非走完领出中，出后余牌最大同花顺窗口（同花色 5 连窗口内张数，逢人配不计）严格更大者 → 改用最大者（同大取分高）。bit1 M=300；bit2 M2=900；bit4 仅首选出后窗口≥3；bit8 含本副首领。异于 r83 同点换花色、r124/r125 清孤张、r116 减手数、r91 点数、r123 甩多；避开 r59、r75–r125 及各簇；保留 sticky GD_R95=5；不动 r95PlanBeat。先试「跟敌压牌减手数」trig=0、「中盘领出同型换大点」smoke ≈−1.1~−1.6、「跟敌免费压（过→不增手数压）」trig≈1、「还贡保同花顺潜力」trig≈1，改本轴。
- 基线 backups/r126-base（不含 r126 块，含 GD_R95=5；含 r125 默认 0）。
- smoke 48 副 seed 22690000（并行）：GD_R126=0 Δ≡0；触发 bit1 90 / bit3 92 / bit5 19 / bit9 3；smoke Δ bit1 −0.65、bit3 −0.98、bit5 +0.17、bit9 −0.65（n=48 噪声大）。因 bit4 唯一偏正，正式跑 bit1/5/7/13。
- 跑 bit1/5/7/13，seed 22600000，4000 副 tribute matchLen=8，脚本 /tmp/run-r126-ab.sh，日志 selfplay/logs/ab-r126-*（启动 2026-10-30 10:09 EDT）。

## 2026-10-30（America/Toronto）r126 — REJECTED
- 领出保同花顺潜力：首种子 22600000 bit1 Δ −0.907 [−0.982, −0.833] 34.8%；bit5 −0.173 [−0.247, −0.100] 47.4%；bit7 −0.177 [−0.251, −0.103] 47.3%；bit13 −0.228 [−0.299, −0.156] 46.0%。无 lo>0（均显著负）→ 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 10:38 EDT）。GD_R126 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r126.md。已穷尽：领出保同花顺潜力邻域。

## 2026-10-30（America/Toronto）r127 — 进行中
- 自创正交轴「压牌省逢人配」GD_R127（默认 0）：领出/跟敌非炸/跟对家、首选为非炸非走完（非 r95PlanBeat）且首选动用逢人配（红桃级牌）时，分差≤M 内其他非炸非走完出法中动用逢人配更少者 → 改用最少者（同少取分高；留百搭）。bit1 M=300；bit2 M2=900；bit4 仅领出；bit8 候选须 0 逢人配。异于 r95 handplan、r87 最小点、r126 同花顺潜力、清孤张/减手数；避开 r59、r75–r126 及各簇；保留 sticky GD_R95=5；不动 r95PlanBeat。先试仅跟敌版 trig≈0，扩为全决策点。
- 基线 backups/r127-base（不含 r127 块，含 GD_R95=5；含 r126 默认 0）。
- smoke 48 副 seed 22790000：GD_R127=0 Δ≡0；触发 bit1 6 / bit3 9 / bit5 3 / bit9 3（触发偏低）；smoke Δ ≈+0.13~+0.21（n=48 噪声大）。
- 跑 bit1/3/5/9，seed 22700000，4000 副 tribute matchLen=8，脚本 /tmp/run-r127-ab.sh，日志 selfplay/logs/ab-r127-*。

## 2026-10-30（America/Toronto）r127 — REJECTED
- 压牌省逢人配：首种子 22700000 bit1 Δ −0.041 [−0.093, 0.012] 49.0%；bit3 −0.039 [−0.092, 0.014] 48.8%；bit5 −0.042 [−0.098, 0.015] 49.2%；bit9 −0.013 [−0.072, 0.047] 49.2%。无 lo>0 → 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 11:09 EDT）。GD_R127 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r127.md。已穷尽：压牌省逢人配邻域。

## 2026-10-30（America/Toronto）r128 — 进行中
- 自创正交轴「出牌省自然级牌」GD_R128（默认 0）：领出/跟敌非炸/跟对家（bit4 仅跟敌）、首选为非炸非走完（非 r95PlanBeat）且首选动用自然级牌（级牌点、非逢人配）时，分差≤M 内其他非炸非走完出法中动用级牌（含逢人配）张数严格更少者 → 改用最少者（同少取分高；留级牌控）。bit1 M=300；bit2 M2=900；bit4 仅跟敌；bit8 候选须 0 级牌。异于 r127 仅逢人配、r109/r122 记牌换顶、r87 最小点、r95 handplan；避开 r59、r75–r127 及各簇；保留 sticky GD_R95=5；不动 r95PlanBeat。
- 基线 backups/r128-base（不含 r128 块，含 GD_R95=5；含 r127 默认 0）。
- smoke 48 副 seed 22890000：GD_R128 触发 bit1 43 / bit3 18 / bit5 15 / bit9 31（高于 r127）；smoke Δ bit1 +0.13、bit3 −0.02、bit5 −0.50、bit9 −0.35（n=48 噪声大）。
- 跑 bit1/3/5/9，seed 22800000，4000 副 tribute matchLen=8，脚本 /tmp/run-r128-ab.sh，日志 selfplay/logs/ab-r128-*（启动 2026-10-30 11:10 EDT）。

## 2026-10-30（America/Toronto）r128 — REJECTED
- 出牌省自然级牌：首种子 22800000 bit1 Δ −0.221 [−0.298, −0.143] 45.1%；bit3 −0.246 [−0.321, −0.171] 44.6%；bit5 −0.059 [−0.129, 0.012] 48.5%；bit9 −0.247 [−0.325, −0.169] 44.4%。无 lo>0（bit1/3/9 显著负）→ 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 11:37 EDT）。GD_R128 默认 0 保留；线上不变（GD_R95=5 sticky）。结论：省级牌/省逢人配簇穷尽（保留级牌反而有害）。

## 2026-10-30（America/Toronto）r129 — 进行中
- 自创正交轴「跟敌弃权改争」GD_R129（默认 0）：跟敌非炸、首选为不出（pass）时，分差≤M 内存在非炸非走完压牌 → 改压（取分最高；bit8 取最小点）。决策点 pass↔压，异于各换牌簇。bit1 M=300；bit2 M2=900；bit4 仅出牌敌人余牌≤10；bit8 最小点。保留 sticky GD_R95=5；不动 r95PlanBeat。
- 基线 backups/r129-base（不含 r129 块）。
- smoke 48 副 seed 22990000：GD_R129=0 Δ≡0；触发 bit1 25 / bit3 3 / bit5 10 / bit9 3 / bit13 15；smoke Δ bit1 −0.29、bit3 −0.29、bit5 +0.58、bit9 −0.31、bit13 +0.58（n=48 噪声大）。因 bit4 偏正，正式跑 bit1/5/9/13。
- 跑 bit1/5/9/13，seed 22900000，4000 副 tribute matchLen=8，脚本 /tmp/run-r129-ab.sh，日志 selfplay/logs/ab-r129-*（启动 2026-10-30 11:42 EDT，约 28 分钟）。

## 2026-10-30（America/Toronto）r129 — REJECTED
- 跟敌弃权改争：首种子 22900000 bit1 Δ +0.031 [−0.047, 0.109] 51.6%；bit5 −0.015 [−0.084, 0.054] 50.0%；bit9 +0.013 [−0.059, 0.085] 51.1%；bit13 −0.005 [−0.071, 0.060] 50.2%。无 lo>0 → 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 12:12 EDT）。GD_R129 默认 0；线上仍 guandan-play-90568fce7f（GD_R95=5 sticky）。报告 selfplay/reports/r129.md。已穷尽：跟敌 pass↔压 邻域（近零效应）。

## 2026-10-30（America/Toronto）r130 — REJECTED
- 结果（seed 23000000，ALL_DONE 12:47 EDT）：bit1 Δ −0.780 [−0.846, −0.714] 37.4%；bit5 −1.095 [−1.161, −1.030] 31.9%；bit9 −0.288 [−0.361, −0.216] 46.0%；bit13 −0.379 [−0.450, −0.308] 44.8%。全档显著负 → REJECTED，不跑第二种子、不发布；GD_R130 默认 0；线上仍 guandan-play-90568fce7f。报告 selfplay/reports/r130.md。已穷尽：领出记牌“必回手”切面（强负）。
- 先试「跟对家压改让」（跟对家首选非炸压 → 过）：smoke 48 副 trig 仅 4–5（M 放大至 6000 不变），放弃。
- 自创正交轴「记牌领出必回手」GD_R130（默认 0）：领出、首选非炸非走完（非 r95PlanBeat）且外面仍有可压同型时，分差≤M 内存在单/对（bit4 含三张）领出且记牌确认外面无可压同型（beaters=0，不计炸）→ 改用之（取分最高）。bit1 M=300；bit2 M2=900；bit4 含三张；bit8 仅我手≤12。异于 r103 跟敌记牌、r109/r122、r106、领出换牌簇；保留 sticky GD_R95=5；不动 r95PlanBeat。
- 基线 backups/r130-base（不含 r130 块）。
- smoke 48 副 seed 23090000：GD_R130=0 Δ≡0；触发 bit1 29 / bit3 29 / bit5 30 / bit9 24；smoke Δ bit1 −0.63、bit3 −0.81、bit5 −0.67、bit9 −0.15（噪声大，偏负）。
- 跑 bit1/5/9/13，seed 23000000，4000 副 tribute matchLen=8，脚本 /tmp/run-r130-ab.sh，日志 selfplay/logs/ab-r130-*（启动 2026-10-30 12:26 EDT，约 30 分钟）。

## 2026-10-30（America/Toronto）r131 — 进行中
- 自创正交轴「敌弃型领出」GD_R131（默认 0）：新增 ctx.passLog（play/core.js play() 及 engine/state.js 过牌时记 {seat, combo, by}；ctxFor 传出，不影响旧策略）。领出、首选非炸非走完（非 r95PlanBeat）时，若下家敌（bit8 含两敌）本副曾对我方出的非炸某型主动过牌，则分差≤M 内同型同张数、点数≥该点的非炸非走完领出 → 改用之（取分最高）。bit1 M=300；bit2 M2=900；bit4 任意型（否则单/对/三）；bit8 两敌。保留 sticky GD_R95=5；不动 r95PlanBeat。
- 基线 backups/r131-base（= r130-base，不含 r130/r131 块）。
- smoke 48 副 seed 23190000：trig bit1 39 / bit5 49 / bit9 77 / bit13 105；Δ bit1 −0.60、bit5 −1.06、bit9 −0.83、bit13 −1.17（偏负；注意 GD_R131=0 在负载下 Δ=+0.06，存在计时类噪声）。
- 跑 bit1/5/9/13，seed 23100000，4000 副 tribute matchLen=8，脚本 /tmp/run-r131-ab.sh，日志 selfplay/logs/ab-r131-*（启动 2026-10-30 12:48 EDT，约 21 分钟）。

## 2026-10-30（America/Toronto）r131 — REJECTED
- 敌弃型领出：首种子 23100000（ALL_DONE 13:16 EDT）bit1 Δ −0.729 [−0.795, −0.662] 37.7%；bit5 −0.812 [−0.882, −0.742] 36.3%；bit9 −0.794 [−0.866, −0.723] 37.4%；bit13 −0.981 [−1.046, −0.916] 33.7%。全档显著负 → REJECTED，不跑第二种子、不发布；GD_R131 默认 0（ctx.passLog 保留，旧策略不受影响）；线上仍 guandan-play-90568fce7f（GD_R95=5 sticky）。报告 selfplay/reports/r131.md。已穷尽：敌弃型领出（敌过牌推断领出，强负）。

## 2026-10-30（America/Toronto）r132 — 进行中
- 先试「跟对家 pass→压挡下家（下家敌余牌≤K）」smoke 48 副 trig 0–1，放弃。
- 自创正交轴「对家报牌喂型」GD_R132（默认 0）：领出、首选非炸非走完（非 r95PlanBeat）时，对家余牌 n≤K（bit4 K=4，否则 K=2），分差≤M 内存在张数=min(n,2) 的单/对非炸非走完领出 → 改用点最小者。bit1 M=300；bit2 M2=900；bit4 K=4；bit8 仅两敌余牌都 >n。异于 r48 bit2、对家出完簇、敌报牌避型；保留 sticky GD_R95=5；不动 r95PlanBeat。
- 基线 backups/r132-base（= 当前 policy，不含 r132 块）。
- smoke 48 副 seed 23290000：trig bit1 0 / bit3 1 / bit5 3 / bit7 7（触发偏低）；Δ 噪声（GD_R132=0 亦 −0.33）。
- 跑 bit1/3/5/7，seed 23200000，4000 副 tribute matchLen=8，脚本 /tmp/run-r132-ab.sh，日志 selfplay/logs/ab-r132-*（启动 2026-10-30 13:17 EDT，约 28 分钟）。

## 2026-10-30（America/Toronto）r132 — REJECTED
- 对家报牌喂型：首种子 23200000（ALL_DONE 13:45 EDT）bit1 Δ +0.011 [−0.036, 0.059] 50.4%；bit3 −0.041 [−0.085, 0.003] 49.2%；bit5 −0.046 [−0.105, 0.013] 49.0%；bit7 −0.092 [−0.150, −0.033] 48.1%。无 lo>0 → REJECTED，不跑第二种子、不发布；GD_R132 默认 0，线上仍 guandan-play-90568fce7f。
- 基线 sanity：本轮无 r130/r131 量级大负；r132-base 与当前 policy 仅差 r132 块（默认 0），r133 smoke GD_R133=0 Δ≡0.000，基线未漂。
- 已穷尽：对家报牌喂型邻域。

## 2026-10-30（America/Toronto）r133 — 进行中
- 自创正交轴「敌报牌跟敌封顶」GD_R133（默认 0）：跟敌非炸、首选非炸非走完压牌（非 r95PlanBeat）、任一敌余牌 ≤K（bit4 K=6，否则 3）时，分差≤M 内同型同张数、点更大的非炸非走完压牌 → 改用点最大者。bit1 M=300；bit2 M2=900；bit8 仅对家余牌 > 敌最小余牌。保留 sticky GD_R95=5；不动 r95PlanBeat。
- 基线 backups/r133-base（= 当前 policy 含 r132 块默认 0，不含 r133 块）。
- smoke 48 副 seed 23390000：GD_R133=0 Δ≡0；trig bit1 3 / bit3 3 / bit5 18 / bit13 9；Δ −0.13/−0.13/+0.06/+0.21（噪声）。
- 跑 bit1/5/7/13，seed 23300000，4000 副 tribute matchLen=8，脚本 /tmp/run-r133-ab.sh，日志 selfplay/logs/ab-r133-*（启动 2026-10-30 13:50 EDT，约 28 分钟）。

## 2026-10-30（America/Toronto）r133 — REJECTED
- 敌报牌跟敌封顶：首种子 23300000（ALL_DONE 14:24 EDT）bit1 Δ −0.041 [−0.093, 0.012] 49.3%；bit5 −0.126 [−0.197, −0.054] 48.2%；bit7 −0.123 [−0.188, −0.058] 48.2%；bit13 −0.100 [−0.171, −0.029] 48.2%。无 lo>0 → REJECTED，不跑第二种子、不发布；GD_R133 默认 0；线上仍 guandan-play-90568fce7f。报告 selfplay/reports/r133.md（r128/r132 报告据 logs 补写）。

## 2026-10-30（America/Toronto）r134 — 进行中
- 自创正交轴「跟牌少拆孤张」GD_R134（默认 0）：跟敌非炸（bit4 含跟对家）、首选非炸非走完压（非 r95PlanBeat）→ 分差≤M 内改出后自然孤张更少者。bit1 M=300；bit2 M2=900；bit8 仅手≥13。保留 sticky GD_R95=5；不动 r95PlanBeat。基线 backups/r134-base。
- 跑 bit1/3/9/11，seed 23400000，4000 副 tribute matchLen=8，脚本 /tmp/run-r134-ab.sh，日志 selfplay/logs/ab-r134-*（启动 2026-10-30 14:42 EDT）。

## 2026-10-30（America/Toronto）r134 — REJECTED
- 跟牌少拆孤张：首种子 23400000（ALL_DONE 15:15 EDT）bit1 Δ −0.118 [−0.192, −0.044] 48.1%；bit3 −0.139 [−0.214, −0.063] 47.9%；bit9 −0.100 [−0.176, −0.023] 48.5%；bit11 −0.111 [−0.185, −0.038] 48.5%。全档显著负 → REJECTED，不跑第二种子、不发布；GD_R134 默认 0；线上仍 guandan-play-90568fce7f。报告 selfplay/reports/r134.md。r135（seed 23500000）待设计新轴，尚未启动。

## 2026-10-30（America/Toronto）r135 — 进行中
- 自创正交轴「跟敌压牌后留对更多」GD_R135（默认 0）：跟敌非炸（bit4 含跟对家）、首选非炸非走完压（非 r95PlanBeat）→ 分差≤M 内改出后天然对子（数量恰=2 的点，非逢人配）更多者。bit1 M=300；bit2 M2=900；bit8 仅手≥13。保留 sticky GD_R95=5；不动 r95PlanBeat。基线 backups/r135-base（去掉 r135 块）。
- 先试 A「挡下家补压」与 B「早盘少炸普通牌」：48 副 smoke 触发均为 0（A 的对家出牌情形极少走到后处理；B 早盘首选炸普通牌极少），已弃。
- D smoke 48 副（seed 23490000）：b0 trig0 Δ+0.229（arena 噪声）；b1 trig41 Δ-0.333；b3 trig3 Δ-0.333；b5 trig41 Δ-0.333；b9 trig3 Δ-0.771。
- 正式跑 bit1/3/5/7，seed 23500000，4000 副 tribute matchLen=8，脚本 /tmp/run-r135-ab.sh，日志 selfplay/logs/ab-r135-*（启动 15:35 EDT）。

## 2026-10-30（America/Toronto）r135 — REJECTED
- 跟敌压后留对更多：首种子 23500000（ALL_DONE 16:19 EDT）bit1 Δ −0.786 [−0.863, −0.710] 36.6%；bit3 −0.792 [−0.868, −0.716] 36.5%；bit5 −0.773 [−0.848, −0.699] 36.8%；bit7 −0.776 [−0.852, −0.700] 36.7%。全档显著负 → REJECTED，不跑第二种子、不发布；GD_R135 默认 0。基线 sanity：串行 smoke 48 副 GD_R135=0 vs r135-base Δ≡0.000，未漂。报告 selfplay/reports/r135.md。已穷尽：跟敌改压后结构类（r110/r113/r114/r134/r135）。

## 2026-10-30（America/Toronto）r136 — 进行中
- 先试 A「有炸时领出保结构」：smoke 48 副 seed 23690000 trig 21–52，Δ −0.75~−1.00（惨负）弃；D「跟敌压后留炸弹完整」trig 1（≈0）弃。
- 采用 B「还贡少拆结构」GD_R136 / #ret=r136_N（policy/tribute.js，默认 0）：plan 首选拆对/三时，若有可还天然孤张（非级牌）且代价≤首选+T → 改还孤张。bit1 T=0.5；bit2 T=1.5；bit8 仅首选拆对。异于 r61（无条件孤张）。注意：arena 双方共用当前 tribute.js，故用 --a=current#ret=r136_N（env 方式 Δ≡0）。
- 基线 backups/r136-base（不含 r136 块）。smoke 48 副：trig 3/5/4/7（bit1/3/9/11），Δ +0.33/+0.19/+0.33/+0.19（噪声）。
- 跑 bit1/3/9/11，seed 23600000，4000 副 tribute matchLen=8，脚本 /tmp/run-r136-ab.sh，日志 selfplay/logs/ab-r136-*（启动 16:31 EDT）。

## 2026-10-30（America/Toronto）r136 — REJECTED
- 还贡少拆结构：首种子 23600000（ALL_DONE 17:05 EDT）bit1 Δ −0.028 [−0.088, 0.032] 49.1%；bit3 +0.035 [−0.028, 0.098] 51.1%；bit9 −0.017 [−0.073, 0.040] 49.4%；bit11 −0.020 [−0.078, 0.039] 49.4%。无 lo>0 → REJECTED，不跑第二种子、不发布；GD_R136 默认 0。报告 selfplay/reports/r136.md。

## 2026-10-30（America/Toronto）r137 — 进行中
- 串行 smoke（48 副 seed 23790000）：C「接风后跟敌过→最小非炸压」trig 2 弃；D「领出同型换更少 beaters（软）」trig 43–61、Δ −0.52~−0.96 惨负弃；E「晚盘跟敌能炸走完则炸」trig 0（现策略已覆盖）弃。
- 采用 B「跟敌压后不拆天然炸」GD_R137（policy/index.js，默认 0）：跟敌非炸、首选非炸非走完压（非 r95PlanBeat）若用到同点≥4 的天然炸牌（bit4 放宽：同点≥3 且出后该点余≤1）→ 分差≤M 内改不拆的非炸非走完压。bit1 M=300；bit2 M2=900；bit8 仅手≥10。smoke：bit1/3 trig 0；bit5/7/13/15 trig 11/11/12/7，Δ −0.50 [−1.66, 0.66]（噪声）。GD_R137=0 sanity Δ≡0。
- 跑 bit5/7/13/15，seed 23700000，4000 副 tribute matchLen=8，sticky GD_R95=5，基线 backups/r137-base，脚本 /tmp/run-r137-ab.sh，日志 selfplay/logs/ab-r137-*（启动 17:22 EDT）。
## 2026-10-30（America/Toronto）r137 — REJECTED
- 跟敌压后不拆天然炸：首种子 23700000（ALL_DONE 18:02 EDT）bit5 Δ −0.101 [−0.168, −0.033] 48.1%；bit7 −0.132 [−0.202, −0.062] 47.4%；bit13 −0.113 [−0.180, −0.045] 47.8%；bit15 −0.102 [−0.174, −0.030] 48.1%。全显著负 → REJECTED，不跑第二种子、不发布；GD_R137 默认 0。报告 selfplay/reports/r137.md。
## 2026-10-30（America/Toronto）r138 — 进行中
- 采用 A「挡下家补压（修门控）」GD_R138（policy/index.js，默认 0）：对家刚出单/对（bit32 任意非炸型）、下家敌余牌≤K（bit1 K=6；bit2 D 变体主点≤10 K=4；bit16 K=10）、首选过 → 改非炸非走完压（bit4 不限分差）。门控修复：此前 trig=0 因 isForbidden 已把压对家的着法从 pool 移除，ranked 只剩过；现从 filteredOut 取最小非炸非逢人配压牌。bit8 仅对家余牌>下家。smoke 48 副 seed 23890000：bit1 trig 6、bit5 2（过低）；bit17 trig 11 Δ +0.54 [0.07, 1.01]；bit21 11 +0.44；bit49 6 +0.27；bit53 12 +0.42。GD_R138=0 sanity Δ≡0。
- 跑 bit17/21/49/53，seed 23800000，4000 副 tribute matchLen=8，sticky GD_R95=5，基线 backups/r138-base，脚本 /tmp/run-r138-ab.sh，日志 selfplay/logs/ab-r138-*（启动 18:10 EDT）。
## 2026-10-30（America/Toronto）r138 — REJECTED
- 挡下家补压（修门控）：首种子 23800000（ALL_DONE 18:40 EDT）bit17 Δ −0.066 [−0.131, −0.000] 48.9%；bit21 −0.066 [−0.129, −0.003] 48.9%；bit49 −0.187 [−0.253, −0.121] 46.1%；bit53 −0.184 [−0.249, −0.119] 46.4%。全显著负 → REJECTED，不跑第二种子、不发布；GD_R138 默认 0。smoke 假阳性。报告 selfplay/reports/r138.md。已穷尽：挡下家补压（含修门控/宽 K）。
## 2026-10-30（America/Toronto）r139 — 进行中
- 串行 smoke（48 副 seed 23990000）：E「双下风险跟敌过→炸」trig 1–2 弃。
- 采用 C「我短手领出甩够张」GD_R139（policy/index.js，默认 0）：领出、我余牌 n≤K、首选非炸非走完（非 r95PlanBeat）且张数<n → 分差≤M(600) 内改张数严格更多的非炸领出（同多取分高）。bit1 K=6；bit2 K=10；bit4 不限分差；bit8 仅某敌余≤10。smoke：bit1 trig 6 Δ −0.21；bit3 44 −0.44；bit7 11 −0.33；bit13 13 −0.46（均 CI 含 0）。GD_R139=0 sanity Δ≡0。
- 跑 bit1/3/7/13，seed 23900000，4000 副 tribute matchLen=8，sticky GD_R95=5，基线 backups/r139-base，脚本 /tmp/run-r139-ab.sh，日志 selfplay/logs/ab-r139-*（启动 19:00 EDT）。
## 2026-10-30（America/Toronto）r139 — REJECTED
- 我短手领出甩够张：首种子 23900000（ALL_DONE 19:50 EDT）bit1 Δ −0.262 [−0.321, −0.203] 44.6%；bit3 −0.638 [−0.709, −0.567] 37.3%；bit7 −0.648 [−0.723, −0.574] 37.1%；bit13 −0.190 [−0.249, −0.131] 45.6%。全显著负 → REJECTED，不跑第二种子、不发布；GD_R139 默认 0。报告 selfplay/reports/r139.md。已穷尽：短手甩够张。
## 2026-10-30（America/Toronto）r140 — 进行中
- 串行 smoke（200 副 seed 24090000，无 tribute）：bit1 对家炸我过 / bit2 对家非炸我不炸 trig 0（策略本就不压对家炸）弃；bit4 跟敌首选 SF→非 SF 炸 trig 1 弃。
- 采用「跟敌炸用最小炸」GD_R140（policy/index.js，默认 0）：跟敌、首选为炸且非走完 → 分差≤M8(600) 内改张数更少的炸（SF 记 +0.5 张，即同张数优先普通炸保 SF）。bit8 主开关；bit16 不限分差；bit4 KeepSF。smoke trig 11–12/200：bit8 Δ −0.060 CI 含 0；bit12 −0.055；bit24 −0.045。GD_R140=0 默认。
- 跑 bit8/12/24/28，seed 24000000，4000 副 tribute matchLen=8，sticky GD_R95=5，基线 backups/r140-base，脚本 /tmp/run-r140-ab.sh，日志 selfplay/logs/ab-r140-*（启动 19:53 EDT）。
## 2026-10-30（America/Toronto）r140 — REJECTED
- 跟敌炸用最小炸（保 SF）：首种子 24000000（ALL_DONE 20:26 EDT）bit8 Δ −0.080 [−0.132, −0.028] 48.1%；bit12 −0.056 [−0.105, −0.006]；bit24 −0.056 [−0.116, 0.003]；bit28 −0.064 [−0.119, −0.009]。无 lo>0 → REJECTED；GD_R140 默认 0。报告 selfplay/reports/r140.md。已穷尽：跟敌炸选型（最小炸/保 SF）；对家出牌我过/顶（trig 0）。
## 2026-10-30（America/Toronto）r141 — 进行中
- 采用 B「跟敌同型同点换花色保同花顺」GD_R141（policy/index.js，默认 0）：跟敌首选单/对/三（非炸非走完、非 r95PlanBeat、无逢人配），手中同点自然牌多于所需 → 换花色组合使余牌最大同花顺窗口（5 连内自然点数）改进≥1（bit2 ≥2）。bit1 主开关；bit4 含跟对家；bit8 含领出。smoke 48 副 seed 24190000：bit1 trig 3、bit3 0、bit5 6、bit13 6，Δ 0/0/0/−0.04（噪声）。
- 跑 bit1/5/9/13，seed 24100000，4000 副 tribute matchLen=8，sticky GD_R95=5，基线 backups/r141-base，脚本 /tmp/run-r141-ab.sh，日志 selfplay/logs/ab-r141-*（启动 20:35 EDT）。
## 2026-10-30（America/Toronto）r141 — REJECTED
- 跟敌同型同点换花色保同花顺：首种子 24100000（ALL_DONE 21:18 EDT）bit1 Δ +0.005 [−0.037, 0.046] 50.4%；bit5 −0.041 [−0.081, −0.002] 49.5%；bit9 −0.008 [−0.051, 0.036] 49.6%；bit13 −0.027 [−0.068, 0.014] 49.4%。无 lo>0 → REJECTED，不跑第二种子、不发布；GD_R141 默认 0。报告 selfplay/reports/r141.md。已穷尽：跟敌/领出换花色保 SF。
## 2026-10-30（America/Toronto）r142 — 进行中
- 弃 A「进贡选点保 SF」：进贡点数强制（最大），花色选择已被 r42/r63 覆盖，无正交空间。
- 采用 E「还贡最小点优先孤张（宽于 r136）」#ret=r142_N（policy/tribute.js，默认不启用）：有可还天然孤张（非级牌）且代价≤plan 最优+T → 还最小点孤张。bit1 主开关 T=1；bit2 T=3；bit4 首选已是孤张也改最小点孤张；bit8 仅还给敌方。smoke 48 副 seed 24290000：bit1 trig 5 Δ −0.15；bit3 8 −0.02；bit5 3 −0.15；bit13 3 −0.02（噪声）。
- 跑 bit1/3/7/11，seed 24200000，4000 副 tribute matchLen=8，sticky GD_R95=5，基线 backups/r142-base，--a=current#ret=r142_N，脚本 /tmp/run-r142-ab.sh，日志 selfplay/logs/ab-r142-*（启动 21:33 EDT）。
- 结果（seed 24200000）：bit1 Δ −0.028 [−0.085, 0.030] 49.4%；bit3 +0.021 [−0.042, 0.084] 50.4%；bit7 +0.002 [−0.061, 0.065] 50.0%；bit11 −0.024 [−0.084, 0.036] 49.3%。无 lo>0 → **r142 REJECTED**，不发布。报告 selfplay/reports/r142.md。已穷尽：还贡少拆/最小孤张簇（r136/r142）。
## 2026-10-30（America/Toronto）r143 — 进行中
- 采用 G「跟敌压后留顺子潜力」GD_R143（policy/index.js，默认 0）：跟敌首选非炸非走完压牌（非 r95PlanBeat），分差≤M 内同型其他压牌中出后余牌最长自然连续点窗口更长者 → 改用。bit1 M=300；bit2 M=900；bit4 含跟对家；bit8 仅我手≥10。smoke 48 副 seed 24390000：trig b1 3、b3 61、b5 57、b13 48（Δ 均 −0.52/−0.56，6 场粒度噪声）。
- 跑 bit1/3/5/13，seed 24300000，4000 副 tribute matchLen=8，sticky GD_R95=5，基线 backups/r143-base（无 r143 代码），脚本 /tmp/run-r143-ab.sh，日志 selfplay/logs/ab-r143-*（启动 22:17 EDT）。
- r143 结果（seed 24300000，ALL_DONE 2026-10-31 07:37 EDT）：bit1 Δ −0.751 [−0.826, −0.677] 37.3%；bit3 −0.751 [−0.822, −0.681] 37.1%；bit5 −0.737 [−0.805, −0.668] 37.8%；bit13 −0.628 [−0.706, −0.550] 40.0%。全显著负 → **r143 REJECTED**，不发布。报告 selfplay/reports/r143.md。已穷尽：跟敌压后留顺潜力。
## 2026-10-31（America/Toronto）r144 — 进行中
- smoke（48 副 seed 24490000）：D「敌报牌≤2 跟敌过→非炸压」trig≈1 → 弃；H「中盘跟敌过→压当我手≤敌最短」trig 3–6、Δ −0.56~−1.02 惨负 → 弃。
- 采用 C「领出保天然连对/钢板潜力」GD_R144（policy/index.js，默认 0）：领出首选非炸非走完（非 r95PlanBeat），分差≤M 内其他领出中出后余牌连对窗口(cap3)*10+钢板窗口(cap2) 严格更高 → 改用。bit1 M=300；bit2 M=900；bit4 需新形成连对(pr≥3)；bit8 仅我手≥10。smoke trig b1 56、b3 100、b5 57、b13 52；Δ b1 −1.27、b3 −1.73、b5 −0.29、b13 +0.54 → 跑 bit5/7/13/15（均含 bit4 约束）。
- seed 24400000，4000 副 tribute matchLen=8，sticky GD_R95=5，基线 backups/r144-base（无 r144 代码），脚本 /tmp/run-r144-ab.sh，watcher /tmp/watch-r144.sh → /tmp/watch-r144.log，日志 selfplay/logs/ab-r144-*（启动 2026-10-31 20:11 EDT）。

## 2026-11-01（America/Toronto）r144 — REJECTED
- 领出保天然连对/钢板潜力 GD_R144：首种子 24400000 bits 5/7/13/15（全带 bit4），ALL_DONE 2026-11-01 00:40 EDT（箱钟 12:40 CST，~4.5h）。bit5 Δ −0.297 [−0.367, −0.228] 45.4%；bit7 −0.350 [−0.421, −0.279] 44.4%；bit13 −0.260 [−0.331, −0.188] 45.6%；bit15 −0.280 [−0.352, −0.207] 45.0%。全显著负 → REJECTED，不跑第二种子、不发布；GD_R144 默认 0；线上仍 guandan-play-90568fce7f。报告 selfplay/reports/r144.md。已穷尽：领出保连对/钢板潜力（r144；smoke 弃 D/H）。

## 2026-11-01（America/Toronto）r145 — 进行中
- smoke（48 副 seed 24590000）：A 领出不拆炸 bit4 惨负、B 跟敌换更大点负、C 跟敌留 tube 负、D 中盘不领炸 trig0 弃；F 领出不拆对惨负、G 中盘单改对贴边、H 双敌短不领单 trig 低、I 对家出完炸走完 trig0 弃。
- 采用 E「跟敌压不拆天然对」GD_R145（policy/index.js，默认 0）：跟敌首选非炸非走完压（非 r95PlanBeat）若拆天然对（同点恰 2 出部分；bit4 含同点恰 3）→ 分差≤M 内改不拆。bit1 M=300；bit2 M=900；bit4 含拆三；bit8 手≥10。smoke trig b1 10、b7 20、b13 14、b15 29；Δ b7/b13/b15 约 +0.52~+0.58（48 副噪声）。
- 跑 bit1/7/13/15，seed 24500000，4000 副 tribute matchLen=8，sticky GD_R95=5，基线 backups/r145-base（无 r145 代码），脚本 /tmp/run-r145-ab.sh，watcher /tmp/watch-r145.sh → /tmp/watch-r145.log，日志 selfplay/logs/ab-r145-*（启动 2026-11-01 09:40 EST（America/Toronto，DST 已结束）/ 箱钟 22:40 CST）。

## 2026-11-01（America/Toronto）r145 — REJECTED
- 跟敌压不拆天然对 GD_R145：首种子 24500000 bits 1/7/13/15，ALL_DONE 2026-11-02 10:59 CST（≈2026-11-01 21:59 EST，用时 ~12.3h / 44320s）。bit1 Δ −0.059 [−0.126, 0.009] 49.2%；bit7 0.000 [−0.072, 0.072] 50.0%；bit13 +0.033 [−0.044, 0.110] 50.9%；bit15 +0.019 [−0.054, 0.091] 50.7%。无 lo>0 → REJECTED，不跑第二种子、不发布；GD_R145 默认 0；线上仍 guandan-play-90568fce7f。报告 selfplay/reports/r145.md。已穷尽：跟敌压不拆天然对（r145；smoke 弃 A/B/C/D/F/G/H/I）。

## 2026-11-02（America/Toronto）r146 — 进行中
- smoke（48 副 seed 24690000）：A 跟敌压后手数更少 trig0 弃；B 领出不拆天然三偏负；C 晚盘过→压且≤1手 trig低；D 领出同余手多张惨负；E 跟敌不拆三负；F 钢板窗口 trig偏低；G 中盘领出避炸 trig低。采用 H「跟敌压后留连对潜力」GD_R146（policy/index.js，默认 0）：跟敌首选非炸非走完压（非 r95PlanBeat），分差≤M 内同型其他压中出后余牌最长连续「自然点≥2 张」窗口更长 → 改用。bit1 M=300；bit2 M=900；bit4 含跟对家；bit8 手≥10。smoke trig b1 46、b5 27、b7 46、b13 30；Δ +0.21~+0.27（48 副噪声）。GD_R146=0 sanity Δ≡0。
- 跑 bit1/5/7/13，seed 24600000，4000 副 tribute matchLen=8，sticky GD_R95=5，基线 backups/r146-base（无 r146 代码），脚本 /tmp/run-r146-ab.sh，watcher /tmp/watch-r146.sh → /tmp/watch-r146.log，日志 selfplay/logs/ab-r146-*（启动 2026-11-02 01:47 EST / 箱钟 2026-11-02 14:47 CST）。

## 2026-11-02（America/Toronto）r146 — REJECTED
- 跟敌压后留连对潜力 GD_R146：首种子 24600000 bits 1/5/7/13，ALL_DONE 2026-11-02 18:40:44 CST（≈05:40 EST，用时 ~3.9h / 13974s）。bit1 Δ −0.218 [−0.293, −0.143] 46.3%；bit5 −0.234 [−0.303, −0.165] 46.1%；bit7 −0.230 [−0.304, −0.157] 45.9%；bit13 −0.263 [−0.337, −0.189] 45.6%。全显著负 → REJECTED，不跑第二种子、不发布；GD_R146 默认 0；线上仍 guandan-play-90568fce7f。报告 selfplay/reports/r146.md。已穷尽：跟敌压后留连对潜力（r146；smoke 弃 A–G）。

## 2026-11-02（America/Toronto）r147 — 进行中
- smoke（48 副 seed 24790000）：A 领出留RJ接风 trig≈0–1 弃；B 双牌领小留大控 trig 1–10、Δ≡0 弱弃；C 争头游过→炸 trig0 弃；D 下家敌短领出避小单 trig 2–7 偏低弃；E 有炸孤小单改三带二（窄）trig0 弃；F 跟敌压留RJ trig 4–5、Δ≡0 弱弃；H 晚盘过→炸清 trig0 弃。
- 采用 G「争头游领出避孤小单」GD_R147（policy/index.js，默认 0）：领出、我手≤敌最短（bit4：≤敌最短+2）、首选孤小单非控非走完（非 r95PlanBeat）→ 分差≤M 内改张数≥2 非炸领出。bit1 M=300；bit2 M=900；bit8 仅我手≤10。smoke：b1 trig16 Δ+0.17；b3 20 +0.06；b5 16 +0.02；b9 14 −0.02（48 副噪声）。GD_R147=0 sanity Δ≡0。
- 跑 bit1/3/5/9，seed 24700000，4000 副 tribute matchLen=8，sticky GD_R95=5，基线 backups/r147-base（无 r147 代码），脚本 /tmp/run-r147-ab.sh，watcher /tmp/watch-r147.sh → /tmp/watch-r147.log，日志 selfplay/logs/ab-r147-*（启动 2026-11-02 05:54 EST / 箱钟 2026-11-02 18:54 CST）。


## 2026-11-02（America/Toronto）r147 — REJECTED
- 争头游领出避孤小单 GD_R147：seed 24700000 bits 1/3/5/9，ALL_DONE 2026-11-02 20:58:02 CST（≈07:58 EST，~2.1h）。bit1 Δ −0.171 [−0.245, −0.097] 47.1%；bit3 −0.313 [−0.395, −0.232] 44.1%；bit5 −0.215 [−0.289, −0.141] 46.2%；bit9 −0.076 [−0.144, −0.008] 48.4%。全显著负，不跑第二种子、不发布，GD_R147 默认 0。报告 selfplay/reports/r147.md。
- 穷尽：「争头游领出避孤小单」簇（含手长松弛 +2、M=300/900、仅手≤10 变体）。

## 2026-11-02（America/Toronto）r148 — 进行中
- 采用「早盘跟敌不用控张」GD_R148（policy/index.js，默认 0）：跟敌非炸单/对、敌两家手牌均≥T（bit4 T=12，否则 15）、首选压牌为控张（级牌/A/王，非 r95PlanBeat）→ 分差≤M 内改非控张非炸压，无则过（bit8 不改过）。bit1 M=300；bit2 M=900。
- smoke（48 副 seed 24890000）：sanity GD=0 Δ≡0；bit1 trig3 Δ −0.52；bit3 trig19 Δ −0.10；bit5 trig3 Δ 0；bit9 trig3 Δ −0.27 → 选 M=900 各变体。
- 跑 bit3/7/11/15，seed 24800000，4000 副 tribute matchLen=8，sticky GD_R95=5，基线 backups/r148-base（无 r148 代码），脚本 /tmp/run-r148-ab.sh，watcher /tmp/watch-r148.sh → /tmp/watch-r148.log（WATCH_R148_DONE），日志 selfplay/logs/ab-r148-*。启动 2026-11-02 08:43 EST（21:43 CST）。线上仍 guandan-play-90568fce7f。

## 2026-11-02（America/Toronto）r148 — REJECTED
- 早盘跟敌不用控张 GD_R148：seed 24800000 bits 3/7/11/15，WATCH_R148_DONE 2026-11-03 02:49 CST（≈2026-11-02 13:49 EST，~5.1h）。bit3 Δ −0.250 [−0.324, −0.176] 45.0%；bit7 −0.474 [−0.550, −0.399] 40.6%；bit11 +0.025 [−0.034, 0.084] 50.6%；bit15 −0.018 [−0.083, 0.046] 49.5%。无 lo>0 → REJECTED，不跑第二种子、不发布，GD_R148 默认 0；线上仍 guandan-play-90568fce7f。报告 selfplay/reports/r148.md。
- 穷尽：「早盘跟敌不用控张」簇（T=12/15、bit8 不改过）。

## 2026-11-02（America/Toronto）r149 — 进行中
- 自创正交轴「领出跟对家信号型」GD_R149（policy/index.js，默认 0）：新增 ctx.leadLog（play/core.js：本副每次领出 {seat, combo}，仅记录不改行为）。领出、对家未出完、首选非炸非走完（非 r95PlanBeat）且首选型 ≠ 对家本副最近一次非炸领出型 T → 分差≤M 内改型 T（同张数）的非炸非走完领出（取分最高；喂对家强型）。bit1 M=300；bit2 M=900；bit4 需候选主点 < 对家该次领出主点；bit8 仅对家余牌 ≤ 我余牌；bit16 改 B 模式「领出避下家敌信号型」（首选型 = 下家敌最近领出非炸型 → 改他型）。异于 r131 敌弃型（过牌推断）、r132 对家报牌喂型（按张数）、r106 敌报牌避型、对家出完簇。保留 sticky GD_R95=5；不动 r95PlanBeat。
- smoke（48 副 seed 24990000，单跑；并行 7 路时因时间预算搜索受负载影响 b0 曾 −0.29，单跑 GD_R149=0 sanity Δ≡0）：b1 trig59 Δ −0.02；b3 trig68 −0.54；b5 trig46 +0.06；b9 trig21 +0.02；b17 trig25 +0.15；b19 trig26 +0.08（48 副噪声）→ 弃 M=900，跑 bit1/5/9/17。
- 跑 bit1/5/9/17，seed 24900000，4000 副 tribute matchLen=8，sticky GD_R95=5，基线 backups/r149-base（无 r149 代码），脚本 /tmp/run-r149-ab.sh，watcher /tmp/watch-r149.sh → /tmp/watch-r149.log（WATCH_R149_DONE），日志 selfplay/logs/ab-r149-*。启动 2026-11-02 15:57 EST（箱钟 2026-11-03 04:57 CST）。线上仍 guandan-play-90568fce7f（r95），未动发布。

## 2026-11-02（America/Toronto）r149 — REJECTED
- 领出跟对家信号型 GD_R149：seed 24900000 bits 1/5/9/17，WATCH_R149_DONE 2026-11-03 05:27 CST（≈2026-11-02 16:27 EST；各 bit 1791–1813s，约 0.5h）。bit1 Δ −0.690 [−0.767, −0.613] 38.2%；bit5 −0.289 [−0.363, −0.215] 45.5%；bit9 −0.406 [−0.479, −0.333] 43.0%；bit17 −0.152 [−0.227, −0.078] 47.2%。全显著负 → REJECTED，不跑第二种子、不发布，GD_R149 默认 0；ctx.leadLog（core.js 仅记录、行为中性）保留；线上仍 guandan-play-90568fce7f。报告 selfplay/reports/r149.md。
- 穷尽：「领出跟对家信号型」簇（含 B 模式避下家敌信号型）。

## 2026-11-02（America/Toronto）r150 — 进行中
- 自创正交轴「有炸连领孤小单被让 → 改结构领出」GD_R150（policy/index.js，默认 0）：用 ctx.leadLog，领出、我手有天然炸（同点≥4；bit8 不要求有炸）、本副最近一次领出是我出的单张（其后无人领出＝该轮我收回），首选又是孤小单（同点恰 1、非控张、非炸非走完、非 r95PlanBeat）→ 分差≤M 内改张数≥2 的非炸非走完领出（取分最高；bit4 仅限三张/三带二/钢板）。bit1 M=300；bit2 M=900。对应用户偏好「有炸时勿连续领被让的孤小单，改 AAA+33 式结构」（第7副 n50/n54/n58）。异于 r147（按手长争头游、无连领条件）、r59/r136（有炸领出结构、无连领条件）、r149（对家信号型）。保留 sticky GD_R95=5；不动 r95PlanBeat。
- 基线 backups/r150-base（= 当前 policy 含 r149 块默认 0，不含 r150 块）。
- smoke（48 副 seed 25090000，串行，脚本 /tmp/smoke-r150.sh）：sanity GD_R150=0 Δ≡0.000；b1 trig4 Δ +0.29；b3 trig4 +0.29；b5 trig4 +0.23；b9 trig6 +0.38；b13 trig6 +0.23（触发偏低，48 副噪声）→ 跑 bit1/5/9/13。
- 跑 bit1/5/9/13，seed 25000000，4000 副 tribute matchLen=8，sticky GD_R95=5，脚本 /tmp/run-r150-ab.sh，watcher /tmp/watch-r150.sh → /tmp/watch-r150.log（WATCH_R150_DONE），日志 selfplay/logs/ab-r150-*。启动 2026-11-02 17:54 EST（箱钟 2026-11-03 06:54 CST）。线上仍 guandan-play-90568fce7f（r95），未动发布。

## 2026-11-02（America/Toronto）r150 — REJECTED
- 有炸连领孤小单→改结构领出 GD_R150：seed 25000000 bits 1/5/9/13，ALL_DONE 2026-11-02 18:50:56 EST（≈2026-11-03 07:51 CST，~3408s）。bit1 Δ −0.077 [−0.135, −0.020] 48.1%；bit5 −0.057 [−0.115, 0.002] 49.2%；bit9 −0.052 [−0.119, 0.014] 49.1%；bit13 −0.095 [−0.154, −0.036] 48.2%。无 lo>0 → REJECTED，不跑第二种子、不发布，GD_R150 默认 0；线上仍 guandan-play-90568fce7f。报告 selfplay/reports/r150.md。
- 穷尽：「有炸连领孤小单→改结构领出」簇（M=300/900、bit4 三张系、bit8 无炸）。

## 2026-11-02（America/Toronto）r151 — 进行中
- 自创正交轴「本副首领出长结构」GD_R151（policy/index.js，默认 0）：领出、本副我尚未领出（bit8：全场尚无领出）、首选非炸非走完（非 r95PlanBeat）且张数<K（K=5；bit4 K=4）→ 分差≤M 内改张数≥K 非炸非走完领出（取分最高）。bit1 M=300；bit2 M=900。保留 sticky GD_R95=5；不动 r95PlanBeat。
- 基线 backups/r151-base（当前 policy 含 r150 块默认 0，不含 r151）。
- smoke（48 副 seed 25190000，/tmp/smoke-r151.sh）：sanity b0 Δ≡0.000；b1 trig20 Δ −0.44；b3 trig20 −0.44；b5 trig28 −0.44；b9 trig11 −0.21；b13 trig11 −0.21（非惨负，触发足）→ 跑 bit1/5/9/13。
- 跑 bit1/5/9/13，seed 25100000，4000 副 tribute matchLen=8，脚本 /tmp/run-r151-ab.sh，watcher /tmp/watch-r151.sh → /tmp/watch-r151.log（WATCH_R151_DONE），日志 selfplay/logs/ab-r151-*。启动 2026-11-02 19:12 EST（2026-11-03 08:12 CST）。线上仍 guandan-play-90568fce7f，未发布。

## 2026-11-02（America/Toronto）r151 — REJECTED
- 本副首领出长结构 GD_R151：seed 25100000 bits 1/5/9/13，WATCH_R151_DONE 2026-11-02 21:42 EST（~8970s）。bit1 Δ −0.130 [−0.206, −0.053] 47.9%；bit5 −0.107 [−0.183, −0.031] 48.0%；bit9 −0.034 [−0.096, 0.029] 49.4%；bit13 +0.017 [−0.050, 0.084] 50.6%。无 lo>0 → REJECTED，报告 selfplay/reports/r151.md；线上仍 guandan-play-90568fce7f。
- 穷尽：「本副首领出长结构」簇（K=4/5、本人/全场首领）。

## 2026-11-02（America/Toronto）r152 — 进行中
- 自创正交轴「领出单张抬高挡下家」GD_R152（policy/index.js，默认 0）：领出、首选为非走完低单张（≤8；bit8 ≤10）→ 分差≤M 内改出 J–A 孤单张（非级牌非王、该点仅 1 张）。bit1 M=300；bit2 M=900；bit4 仅下家敌余牌≤10。异于 r138 挡下家补压（跟牌）、r87 最小压、开局清孤张。
- 基线 backups/r152-base（含 r151 块默认 0，不含 r152）。
- 链式脚本 /tmp/chain-r152.sh：串行 smoke（48 副 seed 25290000，bits 0/1/5/9/13，结果 /tmp/smoke-r152.log）→ sanity b0≡0 且 b1 trig≥3 则自动起 watcher /tmp/watch-r152.sh（→ /tmp/watch-r152.log，WATCH_R152_DONE）并跑 bit1/5/9/13，seed 25200000，4000 副 tribute matchLen=8，sticky GD_R95=5，脚本 /tmp/run-r152-ab.sh，日志 selfplay/logs/ab-r152-*；否则 CHAIN_ABORT。链启动 2026-11-02 21:50 EST。线上仍 guandan-play-90568fce7f，未发布。

## 2026-11-02（America/Toronto）r152 — REJECTED
- 领出单张抬高挡下家 GD_R152：seed 25200000 bits 1/5/9/13，WATCH_R152_DONE 2026-11-02 22:29 EST（~2210s）。bit1 Δ −0.172 [−0.246, −0.099] 47.5%；bit5 −0.030 [−0.091, 0.030] 49.5%；bit9 −0.206 [−0.283, −0.129] 47.0%；bit13 −0.020 [−0.080, 0.041] 49.8%。无 lo>0 → REJECTED，报告 selfplay/reports/r152.md；线上仍 guandan-play-90568fce7f。
- 穷尽：「领出单张抬高挡下家」簇。

## 2026-11-02（America/Toronto）r153 — 进行中
- 自创正交轴「跟对家按手牌规划成本选」GD_R153（policy/index.js，默认 0）：r95（跟敌 handplan 成本，唯一 SHIPPED）的对家镜像。跟对家非炸、首选为非炸非走完压牌（非 r95PlanBeat）→ 分差≤M 内其他非炸非走完压牌（bit4 含「过」，余牌=原手）中余牌 decompose 成本最低者若比首选低 ≥D(0.2) → 改用。bit1 M=150；bit2 M=600；bit8 仅我手≥10。异于 r127/r128 省级牌/逢人配（跟对家亦含）、r140 对家炸、r130 跟对家压改让（trig 低弃）。
- 基线 backups/r153-base（含 r152 块默认 0，不含 r153）。
- 链式脚本 /tmp/chain-r153.sh：串行 smoke（48 副 seed 25390000，bits 0/1/3/5/7 → /tmp/smoke-r153.log）→ sanity b0≡0 且 b1 trig≥3 则起 watcher /tmp/watch-r153.sh（→ /tmp/watch-r153.log，WATCH_R153_DONE）并跑 bit1/3/5/7，seed 25300000，4000 副 tribute matchLen=8，sticky GD_R95=5，脚本 /tmp/run-r153-ab.sh，日志 selfplay/logs/ab-r153-*；否则 CHAIN_ABORT。线上仍 guandan-play-90568fce7f，未发布。
- 链启动 2026-11-02 23:55 EST（2026-11-03 12:55 CST）。

## 2026-11-03（America/Toronto）r153 — REJECTED
- 跟对家按手牌规划成本选 GD_R153：串行 smoke 各 bit 触发 0，CHAIN_ABORT ~23:56 EST，未跑 4000 副 → REJECTED（无触发）。

## 2026-11-03（America/Toronto）r154 — 进行中
- 跟敌首选过→规划成本不升则压 GD_R154；smoke（seed 25490000）b0≡0、b1 trig9 +0.521、b3 trig9 +0.521、b5 trig2 −0.083、b9 trig10 +0.521。
- 跑 bit1/3/5/9，seed 25400000，4000 副 tribute matchLen=8，脚本 /tmp/run-r154-ab.sh，watcher /tmp/watch-r154.sh → /tmp/watch-r154.log，日志 selfplay/logs/ab-r154-*。4000 副启动 2026-11-03 14:52 CST（01:52 EST）。线上仍 guandan-play-90568fce7f。

## 2026-11-03（America/Toronto）r154 — 首种子 KEEP 候选 bit5，第二种子进行中
- 跟敌首选过→规划成本不升则压 GD_R154：首种子 25400000，ALL_DONE 2026-11-03 22:45 CST（09:45 EST，~7.9h）。bit1 Δ +0.046 [−0.025, 0.118] 51.8%；bit3 +0.051 [−0.018, 0.120] 51.8%；bit5 **+0.134 [0.075, 0.193]** 53.0%；bit9 +0.026 [−0.036, 0.089] 50.8%。bit5 lo>0 → 跑第二种子 25410000（仅 bit5，4000 副 tribute matchLen=8，sticky GD_R95=5），日志 selfplay/logs/ab-r154-b5-25410000.*，watcher /tmp/watch-r154s2.sh → /tmp/watch-r154s2.log（WATCH_R154S2_DONE）。启动 2026-11-03 22:46 CST。双种子 lo>0 才默认 GD_R154=5 并发布；线上仍 guandan-play-90568fce7f。

## 2026-11-04（Asia/Shanghai CST）r154 — REJECTED
- 第二种子 25410000 bit5：Δ +0.029 [−0.015, 0.073]，50.8%（WATCH_R154S2_DONE 23:31 CST）。首种子 bit5 +0.134 lo>0 但双种子未同时 lo>0 → REJECTED，不发布。线上仍 guandan-play-90568fce7f。

## 2026-11-04（Asia/Shanghai CST）r155 — REJECTED
- 结果：bit1 +0.018 [−0.043, 0.080]、bit5 −0.020 [−0.072, 0.031]、bit9 −0.001 [−0.065, 0.064]、bit13 +0.017 [−0.044, 0.077]，均无 lo>0；ALL_DONE 02:36 CST。报告 selfplay/reports/r155.md。
- 自创正交轴「末道防线跟敌：对家已过则少惜牌」GD_R155（policy/index.js，默认 0）：跟敌非炸、我在出牌者+3 位（对家已过）、首选为过 → 分差≤M 内非炸非走完压牌中压后 decompose 成本 ≤ 原手+D 的最低者改压。bit1 M=300,D=0.5；bit2 M=900；bit4 仅出牌敌余牌≤10；bit8 D=1.5。r154 的座位细化（r154 bit5 首种子 +0.134 但第二种子 +0.029 未过）。
- 基线 backups/r155-base。链 /tmp/chain-r155.sh：串行 smoke（48 副 seed 25590000，bits 0/1/5/9/13 → /tmp/smoke-r155.log）→ b0≡0 且 b1 trig≥3 则起 watcher /tmp/watch-r155.sh（→ /tmp/watch-r155.log，WATCH_R155_DONE）并跑 bit1/5/9/13，seed 25500000，4000 副 tribute matchLen=8，sticky GD_R95=5；否则 CHAIN_ABORT。
- 链启动 2026-11-04 00:52 CST。线上仍 guandan-play-90568fce7f。

## 2026-11-04（Asia/Shanghai CST）r156 — 进行中
- 自创正交轴「残局穷举加预算」GD_R156（policy/index.js，默认 0）：bit1 maxWorlds 300/nodeBudget 1.2e5/timeMs 160/minWorlds 12；bit2 再加倍时间与节点；bit4 门槛每座≤4；bit8 改走阈值 0.05。异于 r34（只改门槛）。
- 基线 backups/r156-base。链 /tmp/chain-r156.sh：串行 smoke（seed 25690000，bits 0/1/3/5/9）→ b0≡0 且 b1 trig≥3 则起 watcher /tmp/watch-r156.sh 并跑 bits 1/3/5/9，seed 25600000，4000 副 tribute matchLen=8，sticky GD_R95=5；否则 CHAIN_ABORT。
- 链启动 2026-11-04 02:50 CST（13:50 EST）。线上仍 guandan-play-90568fce7f。

## 2026-11-03（America/Toronto EST）r156 — REJECTED
- 残局穷举加预算 GD_R156，seed 25600000：bit1 −0.010 [−0.055, 0.034]、bit3 −0.052 [−0.099, −0.005]、bit5 +0.010 [−0.031, 0.052]、bit9 +0.026 [−0.018, 0.070]，均无 lo>0；ALL_DONE 14:50 EST。报告 selfplay/reports/r156.md。线上仍 guandan-play-90568fce7f。

## 2026-11-03（America/Toronto EST）r157 — REJECTED
- 结果 seed 25700000：bit1 −0.033 [−0.084, 0.019]、bit3 +0.010 [−0.038, 0.059]、bit5 −0.009 [−0.056, 0.037]、bit9 −0.013 [−0.060, 0.033]，均无 lo>0；ALL_DONE 16:16 EST。报告 selfplay/reports/r157.md。
- 自创正交轴「敌头游后领出控权」GD_R157（policy/index.js，默认 0）：敌方已出完、对家未出完、领出首选非炸非走完且 safety 非 sure → 分差≤M 内 winProb ≥ 首选+DW 的非炸非走完领出改用。bit1 M=300,DW=0.15；bit2 M=900；bit4 需 sure；bit8 DW=0.3。异于 r85（不分出完状态）、r108、r118–r121。
- 基线 backups/r157-base。链 /tmp/chain-r157.sh：串行 smoke（seed 25790000，bits 0/1/3/5/9）→ b0≡0 且 b1 trig≥3 则起 watcher /tmp/watch-r157.sh 并跑 bits 1/3/5/9，seed 25700000，4000 副 tribute matchLen=8，sticky GD_R95=5；否则 CHAIN_ABORT。
- 链启动 2026-11-03 15:47 EST。线上仍 guandan-play-90568fce7f。

## 2026-11-03（America/Toronto EST）r158 — REJECTED（触发过少）
- 「敌近完跟敌压牌换必胜」GD_R158（默认 0）：串行 smoke seed 25890000 各 bit trig=1、Δ 0.000，CHAIN_ABORT 17:45 EST，未跑 4000 副（非炸压牌 safety 'sure' 在敌≥4 张时几乎不可能）。

## 2026-11-03（America/Toronto EST）r159 — REJECTED
- 结果 seed 25900000：bit1 −0.018 [−0.079, 0.044]、bit3 −0.022 [−0.086, 0.041]、bit5 −0.148 [−0.213, −0.083]、bit9 −0.074 [−0.128, −0.021]，均无 lo>0；ALL_DONE 21:50 EST。报告 selfplay/reports/r159.md。
- 自创正交轴「敌近完跟敌压牌换高胜率」GD_R159（policy/index.js，默认 0）：跟敌非炸、首选非炸非走完压牌、出牌敌余牌≤K → 分差≤M 内 winProb ≥ 首选+DW 的非炸非走完压牌取 winProb 最高改用。bit1 M=300,K=6,DW=0.1；bit2 M=900；bit4 K=10；bit8 DW=0.25。
- 基线 backups/r159-base。链 /tmp/chain-r159.sh：串行 smoke（seed 25990000；b1 trig 9、b3 trig 7）→ watcher /tmp/watch-r159.sh（→ /tmp/watch-r159.log，WATCH_R159_DONE）并跑 bits 1/3/5/9，seed 25900000，4000 副 tribute matchLen=8，sticky GD_R95=5。
- 链启动 2026-11-03 17:46 EST。线上仍 guandan-play-90568fce7f。

## 2026-11-03（America/Toronto EST）r160 — REJECTED（触发过少）
- 串行 smoke seed 26090000：b0/b1/b3/b9 trig=0，仅 b5 trig=2（Δ −0.146），CHAIN_ABORT 2026-11-03 23:54 EST，未跑 4000 副（跟对家时首选几乎总已是「过」）。报告 selfplay/reports/r160.md。
- 自创正交轴「跟对家不抢：两敌都非短手时让对家牌权」GD_R160（policy/index.js，默认 0）：跟对家非炸、首选为非炸非走完压对家、两敌余牌都 >K → 「过」在分差≤M 内则改过。bit1 M=300,K=10；bit2 M=900；bit4 K=6；bit8 仅对家余牌≤我余牌。
- 基线 backups/r160-base。链 /tmp/chain-r160.sh：串行 smoke（seed 26090000，bits 0/1/3/5/9）→ b0≡0 且 b1 trig≥3 则起 watcher /tmp/watch-r160.sh（→ /tmp/watch-r160.log，WATCH_R160_DONE）并跑 bits 1/3/5/9，seed 26000000，4000 副 tribute matchLen=8，sticky GD_R95=5；否则 CHAIN_ABORT。
- 链启动 2026-11-03 23:55 EST。线上仍 guandan-play-90568fce7f。

## 2026-11-04（America/Toronto EST）r161 — REJECTED
- 结果 seed 26100000：bit1 −0.160 [−0.226, −0.094]、bit3 −0.203 [−0.271, −0.134]、bit5 −0.476 [−0.555, −0.398]、bit9 −0.131 [−0.196, −0.065]，全部显著为负；WATCH_R161_DONE 07:46 EST。报告 selfplay/reports/r161.md。
- 自创正交轴「下家敌短手领出换高胜率」GD_R161（policy/index.js，默认 0）：领出、下家（敌）余牌≤K、首选非炸非走完且 winProb<1−DW → 分差≤M 内非炸非走完领出中 winProb ≥ 首选+DW 者取 winProb 最高改用。bit1 M=300,K=6,DW=0.1；bit2 M=900；bit4 K=10；bit8 DW=0.25。
- 基线 backups/r161-base。链 /tmp/chain-r161.sh：串行 smoke（seed 26190000，bits 0/1/3/5/9）→ b0≡0 且 b1 trig≥3 则起 watcher /tmp/watch-r161.sh（→ /tmp/watch-r161.log，WATCH_R161_DONE）并跑 bits 1/3/5/9，seed 26100000，4000 副 tribute matchLen=8，sticky GD_R95=5；否则 CHAIN_ABORT。
- 链启动 2026-11-04 01:53 EST。线上仍 guandan-play-90568fce7f。

## 2026-11-04（America/Toronto EST）r162 — REJECTED（触发过少）
- smoke seed 26290000：b0 Δ0.000；b1 trig 2 Δ −0.021；b3 trig 4；b5 trig 1 Δ −0.333；b9 trig 4。b1 trig<3 → CHAIN_ABORT 09:56 EST，未跑 4000 副。报告 selfplay/reports/r162.md。
- 自创轴「跟敌首选过→压后规划成本严格下降才压」GD_R162（policy/index.js，默认 0；r154 邻域收紧去噪）：跟敌非炸、首选为过 → 分差≤M 内非炸非走完压牌中压后 decompose 成本 ≤ 原手−D 的最低者改压。bit1 M=300,D=0.5；bit2 M=900；bit4 仅出牌敌余牌≤10；bit8 D=1。
- 基线 backups/r162-base。链 /tmp/chain-r162.sh：串行 smoke（seed 26290000，bits 0/1/3/5/9）→ b0≡0 且 b1 trig≥3 则起 watcher /tmp/watch-r162.sh（→ /tmp/watch-r162.log，WATCH_R162_DONE）并跑 bits 1/3/5/9，seed 26200000，4000 副 tribute matchLen=8，sticky GD_R95=5；否则 CHAIN_ABORT。
- 链启动 2026-11-04 09:55 EST。线上仍 guandan-play-90568fce7f。

## 2026-11-04（America/Toronto EST）r163 — REJECTED（触发过少）
- smoke seed 26390000：b0/b1/b3/b5 trig 0，b9 trig 1 Δ −0.146；CHAIN_ABORT 09:58 EST，未跑 4000 副（r154 类压牌几乎都要动控制牌）。报告 selfplay/reports/r163.md。
- 自创轴「跟敌首选过→不动控制牌、成本不升则压」GD_R163（policy/index.js，默认 0；r154 邻域）：跟敌非炸、首选为过 → 分差≤M 内非炸非走完且不含 A/级牌/王的压牌中，压后 decompose 成本 ≤ 原手+D 的最低者改压。bit1 M=300,D=0；bit2 M=900；bit4 仅出牌敌余牌≤10；bit8 D=0.5。
- 基线 backups/r163-base。链 /tmp/chain-r163.sh：串行 smoke（seed 26390000）→ watcher /tmp/watch-r163.sh（→ /tmp/watch-r163.log，WATCH_R163_DONE）并跑 bits 1/3/5/9，seed 26300000，4000 副 tribute matchLen=8，sticky GD_R95=5；b1 trig<3 则 CHAIN_ABORT。
- 链启动 2026-11-04 09:58 EST。线上仍 guandan-play-90568fce7f。

## 2026-11-04（America/Toronto EST）r164 — 首种子 KEEP 候选 bit3，第二种子进行中
- 自创轴「跟敌首选过→我是敌下家时成本不升则压」GD_R164（policy/index.js，默认 0；r154 邻域按座位切分，与 r155 末道防线互补）：跟敌非炸、me==(出牌敌+1)%4、首选为过 → 分差≤M 内非炸非走完压牌中压后 decompose 成本 ≤ 原手+D 的最低者改压。bit1 M=300,D=0；bit2 M=900；bit4 仅出牌敌余牌≤10；bit8 D=0.5。
- 基线 backups/r164-base。链 /tmp/chain-r164.sh：串行 smoke（seed 26490000）→ watcher /tmp/watch-r164.sh（→ /tmp/watch-r164.log，WATCH_R164_DONE）并跑 bits 1/3/5/9，seed 26400000，4000 副 tribute matchLen=8，sticky GD_R95=5；b1 trig<3 则 CHAIN_ABORT。
- smoke seed 26490000：b0 首跑 Δ0.021（负载计时噪声，复跑 0.000），b1 trig 8 Δ +0.188、b3 trig 5、b5 trig 4 Δ −0.375、b9 trig 7；链因 b0≠0 误 ABORT，复核后手动起 watcher + 四路 4000 副（10:01 EST）。
- 链启动 2026-11-04 10:00 EST。线上仍 guandan-play-90568fce7f。
- 首种子 26400000：ALL_DONE 2026-11-05 02:52 CST（≈2026-11-04 13:52 EST，~3.9h）。bit1 Δ −0.010 [−0.077, 0.057] 50.6%；bit3 **+0.068 [0.007, 0.129]** 51.8% [50.5–53.1]；bit5 +0.043 [−0.013, 0.099] 50.9%；bit9 +0.007 [−0.061, 0.076] 50.6%。bit3 lo>0 → 跑第二种子 26410000（仅 bit3，4000 副 tribute matchLen=8，sticky GD_R95=5），日志 selfplay/logs/ab-r164-b3-26410000.*，watcher /tmp/watch-r164s2.sh → /tmp/watch-r164s2.log（WATCH_R164S2_DONE）。启动 2026-11-04 15:55 EST。双种子 lo>0 才默认 GD_R164=3 并发布；线上仍 guandan-play-90568fce7f。
- 第二种子 26410000 bit3：−0.032 [−0.092, 0.028] 49.3%（ALL_DONE ≈2026-11-04 17:17 EST）→ **r164 REJECTED**（双种子未都 lo>0），报告 selfplay/reports/r164.md；GD_R164 默认 0。


## 2026-11-05（America/Toronto EST）r166 — REJECTED（smoke CHAIN_ABORT）
- 轴「短手领出保大王接风」GD_R166：bit1 M=300,K=8；bit2 M=900；bit4 K=12；bit8 亦保 BJ。sticky GD_R95=5。基线 backups/r166-base。
- smoke seed 26690000（48 副 tribute matchLen=8）：b0 Δ 0.000；b1 trig=0；b3 trig=0；b5 trig=0；b9 trig=1。b1 trig<3 → CHAIN_ABORT，未开 4000 副。诊断：短手首选几乎不领 RJ（Fix F/控牌已覆盖）。GD_R166 默认 0。线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r166.md。

## 2026-11-04（America/Toronto EST）r165 — REJECTED
- 轴「r95 参数调优」GD_R165：bit1 D=0；bit2 D=0.5；bit4 M=300；bit8 M=75。sticky GD_R95=5。首种子 26500000，4000 副 tribute matchLen=8，对 backups/r165-base：bit1 −0.037 [−0.100, 0.027] 49.3%；bit2 +0.015 [−0.045, 0.076] 50.5%；bit4 −0.038 [−0.094, 0.018] 49.3%；bit8 +0.046 [−0.012, 0.104] 50.8%。全部跨 0，无 KEEP 候选。WATCH_R165_DONE 2026-11-04 21:45 EST。GD_R165 默认 0，不发布。线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r165.md。

## 2026-11-05（America/Toronto EST）r167 — REJECTED
- 轴「跟敌首选过→对家短手时成本不升则压」GD_R167（policy/index.js，默认 0；正交于 r154/r155/r164——门控是对家短手）：跟敌非炸、首选过、对家余牌≤K → 分差≤M 内非炸非走完压牌中压后 decompose 成本 ≤ 原手+D 的最低者改压。bit1 M=300,D=0,K=8；bit2 M=900；bit4 K=12；bit8 D=0.5。sticky GD_R95=5。
- 首种子 26700000，4000 副 tribute matchLen=8，对 backups/r167-base：bit1 +0.030 [−0.020, 0.081] 50.0%；bit3 −0.020 [−0.073, 0.032] 49.5%；bit5 +0.040 [−0.011, 0.091] 50.8%；bit9 +0.003 [−0.053, 0.059] 49.9%。全部跨 0，无 KEEP 候选。
- WATCH_R167_DONE 2026-11-05 08:47 EST。GD_R167 默认 0，不发布。线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r167.md。


## 2026-11-06（Asia/Shanghai）r168 — SMOKE 进行中（未开 4000 副）
- 轴「跟敌首选过→出牌敌短手时成本不升则压」GD_R168（policy/index.js，默认 0；r167 块原样保留）：同 r167，但门控为当前待压牌拥有者余牌 rc[full.lastPlaySeat]≤K（lastPlaySeat 为敌）。bit 同 r167。sticky GD_R95=5。基线 backups/r168-base。
- 2026-11-06 08:27:31 nohup /tmp/chain-r168.sh（PID 1203653）：串行 smoke seed 26890000 b0/1/3/5/9 → b0≠0 或 b1 trig<3 则 CHAIN_ABORT，否则启 watch-r168 + run-r168-ab（seed 26800000，4000 副 tribute matchLen=8）。结果见 /tmp/smoke-r168.log。线上仍 guandan-play-90568fce7f（r95）。
