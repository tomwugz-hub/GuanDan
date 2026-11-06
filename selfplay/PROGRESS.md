# 自对局体检 + 修复：进度记录

（每个检查点更新；中断后从这里接着做。时间为 America/Toronto。）

## 工具
- `selfplay/lib.mjs`：与网页版同一套 `play/core.js` 对局逻辑；代理 decide / decide@<backup> / random / greedy；不变量检查；确定化 rollout。
- `selfplay/worker.mjs`、`selfplay/pool.mjs`：worker_threads 并行。
- `selfplay/audit.mjs`：体检报告（`--deals --mixed --surprise --old --out --replay`）。
- `selfplay/arena.mjs`：A/B（同牌换座位，CI）。
- `selfplay/jevaudit.mjs` + `jevAgent.mjs`/`jevcall.mjs`：Jev 代理（spec `jev`）擂台/调用统计/行为对比/分歧 MC（见“Jev 接入”）。
- `scripts/regress-all.sh`：全部残局集回归（`OUTDIR=...`）。
- 旧版 policy 自动复制到 `selfplay/.versions/<name>/`（改写相对导入）。

## 基线（r0，改动前 = backups/pre-selfplay-audit）
报告：`selfplay/reports/audit-r0.md`。红旗：拆炸弹领出 6.1%、Monte Carlo 意外 8.2%（16/194）、早盘领对子 0.2%、早盘领单 70%、一手能出完没出完 1.2%、对家小牌+下家短仍过 64%（n=53）。不变量 0 违例（2600 副）。

## 轮次
| 轮 | 改动 | A/B（新 vs 上一版） | 回归 | 结果 |
|---|---|---|---|---|
| r1 | 能一手出完就出完；非单对牌型拆天然炸弹扣分（同型有不拆的 −60，无收益 −35） | vs pre-selfplay-audit 600 副：+0.150 [0.038, 0.262]，胜 50.8%（拆炸部分单独 +0.147） | 全部不变 | 保留 → backups/post-selfplay-r1 |
| r2 | 我 ≤12 张或对家 ≤7 张：敌出 J+ 单张用王顶抢牌权（tempoTake），keepControl 软化 | vs r1 600 副（seed 700000）：+0.042 [−0.015, 0.098]（宽版 +0.147 但回归掉 5 例，已收窄） | 全部不变 | 保留 → backups/post-selfplay-r2 |
| r3a | 早盘小对子也“先走小牌” | vs r2 1200 副：+0.017 [−0.077, 0.110] | dev-lead −4、holdout −4 | 撤销 |
| r3b | 小三带二领出加分 | vs r2 600 副：−0.073 | — | 撤销 |
| r3 | 三带二带“最便宜”的对子（同三张各带法相对比较） | vs r2 1000 副×2：+0.352 [0.256, 0.448]、+0.204 [0.106, 0.302] | 全部不变（dev-real d012 偶发：beam 计时不定，单跑通过） | 保留 → backups/post-selfplay-r3 |

| r4 | 敌家牌多领出同型牌（三带二/三张/对/顺/连对/钢板）先出小点（相对扣分） | vs r3 1000 副×2：+0.064 [−0.023, 0.151]、+0.091 [0.010, 0.172] | 全部不变 | 保留 → backups/post-selfplay-r4 |

| r5 | 压对家的“拦截”加分按对家这手被压概率缩放（对家 A/大对不必用王抢） | vs r4 1000 副：+0.020 [0.001, 0.039] | 全部不变 | 保留 → backups/post-selfplay-r5 |
| r6a | 小三带二领出加分（三带二带法修好后重试） | vs r5 1000 副：−0.024 [−0.133, 0.085] | — | 撤销 |
| r6b | 压对家后一定走完则压 | vs r5 1000 副：0.000 [−0.023, 0.023] | — | 撤销（无效果） |

## r3 体检（selfplay/reports/audit-r3.md，r3 policy）
- 拆炸弹领出 6.1%→0.7%，一手能出完没出完 1.2%→0%；对旧版 pre-activity +0.34→+1.01、pre-round6 +0.24→+0.95 级/副。
- 剩余红旗：Monte Carlo 意外 8.7%（17/195）、早盘领对子 1.6%、早盘领单 69.9%。
- 意外分类：压对家“拦截”过急（blockLikely/blockProb）3 例；同型取大点 4 例（→r4）；三带二领出 vs 单张 4 例；手短可走完却不压对家 1 例。

## 当前
- npm scripts 已加：audit / audit:quick / arena / regress。
- policy = backups/post-selfplay-r5。下一步：最终体检 audit-latest，单测，构建发布。
- 10-18 18:54：核对 policy == backups/post-selfplay-r5（一致）。audit-latest.md 头部 policy=current、json 生成 11:25 但 md 在 11:56 被改（与 audit.mjs 同时），无法确认用的是 r5 → 备份为 audit-latest-1125-unverified.*，以 --version=post-selfplay-r5 重跑 → audit-r5.md（日志 selfplay/logs/audit-r5.log）。
- 10-18 19:05：audit-r5.md 完成（policy=post-selfplay-r5，同 r3 设置：1000 自对局 + 4×200×2 混合 + 194 surprise，568s）。红旗：MC 意外 10.8%（21/194）、早盘领单 72.6%、早盘领对 4.6%；拆炸 0.7%、一手出完没出完 0%。与 audit-latest-1125 数值几乎一致（意外 13.9% 为抽样噪声）。开始累计擂台 r5 vs pre-selfplay-audit 1000 副 seed0=900000（logs/arena-r5-vs-pre.log）。
- 10-18 19:10：累计擂台 r5 vs pre-selfplay-audit 1000 副（seed0=900000）：+0.529 [0.411, 0.647] 级/副，胜 58.1% [55.3–60.9]，双上 254/被双上 97，违例 0。下一步 npm test + regress-all。
- 10-18 19:10：npm test 416/416 通过。开始 regress-all（OUTDIR=selfplay-audit/r5-final，logs/regress-r5-final.log）。
- 10-18 19:14：regress-all 全部与基线持平：cases 50、pairs 60、holdout 62/58/56/55、dev-r6 143、dev-follow 142、dev-lead 146、dev-real 119；frozen-real3 107（+1）、frozen-real4 108（+1，仅参考）。→ 构建发布。
- 10-18 19:17：构建完成（esbuild /tmp/eb，SW 缓存 guandan-play-ffc31bab43，线上旧版 8d7bc34c43），bundle 含 r5 改动。play/smoke.mjs SMOKE OK（18 副 1918 手，兜底 0，最慢 75ms）。iPhone WebKit 冒烟（/tmp/pw/mobile-test.mjs，iPhone 13 竖/横）通过：布局不溢出、点选牌、标记、分享/复制兜底、SW 离线重载 27 张；仅有 /api/status 404（静态版探测 Jev，预期）。→ 发布。
- 10-18 19:18：已推送 gh-pages（tomwugz-hub/guandan-play），等待 Pages 部署。
- 10-18 19:19：线上 https://tomwugz-hub.github.io/guandan-play/ 已是 guandan-play-ffc31bab43，bundle 与本地逐字节一致；线上 iPhone WebKit（/tmp/pw/live.mjs 竖/横）：200、6 手、SW 激活、离线重载 27 张、无 HTTP 错误/控制台错误。audit-latest.* 改为 audit-r5 的副本。**本轮完成。**

## r7 轮（10-18 20:21 开始）
- 备份 policy → backups/pre-selfplay-r7（= post-selfplay-r5）。目标：早盘领单 72.6%→≤55%，早盘领对 ≥5%，MC 意外。
- 诊断（selfplay/diag/early-leads.mjs，40 副）：早盘领单 70.6%。被选中的单张几乎都带 holdBombLead（有炸就给孤单 +60，再按点数小 +≤24）和 smallFirst（敌家 ≥4 张、孤单 ≤10 时 +60~+96），两项叠加约 +170；最好的非单张备选（三带二/对/三张）中位落后 ~170 分。根因：handplan.decompose 只处理 ≤14 张，开局（>14 张）没有拆牌计划，planLeadScore 不起作用，领出只靠“孤单小牌”启发式。两副牌几乎每手都有炸 → holdBombLead 几乎总触发。
- 候选 c1（r7 计划领出）：handplan.decomposeCounts（按点数计数记忆化拆牌，同代价；27 张平均 1.5ms、最大 9ms）；>14 张领出用它做 planLeadScore（offPlan 扣分 + 先出最弱组件 +45 / 长组件 +100），且此时关闭 holdBombLead 孤单加分与 smallFirst。开关 env R7_PLAN/R7_NOSB/R7_WEAK/R7_UNIT（仅试验用）。40 副诊断：早盘领单 19.9%（三带二/顺子/连对/对 各 13–21%）。
- c1 A/B vs pre-selfplay-r7（1000 副 seed0=1100000）：默认 +0.236 [0.121, 0.351] 胜 55.9%；R7_UNIT=45（长组件不额外先出）+0.064 [−0.047, 0.175]；R7_NOSB=0（保留孤单加分）净升级 0.184 [0.082, 0.286]。
- c1 复核 seed0=1200000：默认 +0.326 [0.210, 0.442] 胜 56.2%；R7_UNIT=150 +0.318；R7_WEAK=80 +0.351（差异在噪声内 → 保持默认 45/100）。下一步 c1 的 npm test + regress。
- c1 回归：npm test 416/416；regress-all 全部持平（cases 50、pairs 60、holdout 62/58/56/55、dev-r6 143、dev-follow 142、dev-lead 146、dev-real 119；frozen-real3 107、frozen-real4 108）。**c1 保留 → backups/post-selfplay-r7a**。跑 c1 全量体检 audit-r7a（logs/audit-r7a.log）。
- 10-18 20:53：audit-r7a（c1，同 r5 设置）：早盘领单 72.6%→20%、领对 4.6%→12%（两项红旗消失；分布 顺子21/单20/连对17/三带二16/对12/钢板10/三张4%）；MC 意外 11.9%（22/185，噪声内）；新红旗 对家小牌+下家短仍过 74.2%（n=31，样本少）；对 pre-round6 +1.075→+1.282，pre-activity +1.222→+1.208；每副手数 104→93。
- 候选 c2：跟敌人牌时若拿到牌权后 finishLine 可走完/可喂短搭档（winThenGood），按 winProb 加分（sure 60p，其余 30p）；原先 winThen 只免扣分，常与过牌同分（例 self|560|50：7 张，级牌对 33 压 KK 后必走完，却过牌，MC +1.5）。A/B vs r7a。
- c2 A/B vs r7a（1000 副 seed0=1300000）：默认 +0.011 [−0.003, 0.025]；加倍（120/60）+0.015 [−0.004, 0.034]。触发少，再跑 2000 副 seed0=1400000 复核。
- 注意：c2 复核那次跑到一半我加了 c3 代码（worker 每个任务重新加载 policy）→ 作废重跑；之后所有 A/B 都显式设开关，跑的时候不改代码。c3 已写入（默认开，开关 R7_CT）。
- c2 A/B vs r7a（2000 副 seed0=1400000，R7_CT=0）：+0.005 [−0.012, 0.023] → **c2 撤销**（无效果）。
- 候选 c3：手 ≤12 跟敌人单/对，若所用控制牌（王/级牌，非逢人配）在 handplan 里本就单独成一手（role=control）且 winProb≥0.85 → +40 抢牌权（抵消 keepControlSoft/大王最小够用扣分）。例 self|848|42、self|529|52（11/9 张，RJ 压 K/BJ，MC +1.2–1.4）。A/B vs r7a（2000 副 seed0=1400000，R7_WT=0）：+0.141 [0.102, 0.180]，胜 53.5%。
- 10-18 21:10：c3 复核（新种子 seed0=1500000，1000 副，R7_WT=0 R7_CT=1，logs/ab-r7-c3b.log）：默认 +0.124 [0.065, 0.183] 胜 53.0%；R7_CTP=0.6 +0.129 [0.070, 0.188]；R7_CTB=80 +0.157 [0.092, 0.222]（与默认差在噪声内 → 保持 0.85/40）。两次独立种子都显著为正 → c3 通过 A/B。ab-r7-c2c3.log 已完成（c2 2000 副 +0.005、c3 2000 副 +0.141，已记录）。
- 10-18 21:11：删除 c2 代码（R7_WT 块；原默认开！c3 的 A/B 都是 R7_WT=0 跑的，删除后 = 所测配置）。核对：policy 与 backups/post-selfplay-r7a 只差 c3 块。开始 npm test + regress-all（OUTDIR=selfplay-audit/r7-final）。
- 10-18 21:13：npm test 416/416；regress-all（r7-final）**c3 有回归**：dev-r6 143→141（R125 RJ 压级牌单 2 应留王、R146 BJ 压 4 而级牌 Q 够用）、dev-real 119→117（d001 RJ 压 K 而级牌 6 够用、d084 敌家 14 张仍用 RJ 抢）；dev-follow 142→143（F131 +1）；holdout2 58→57（k23b 领出，单跑 R7_CT=0/1 都通过 → beam 计时偶发）。→ 收窄为 c3b：只奖励“最便宜够用”的控制牌（R7_CTC，默认开）+ 敌家最短 ≤10（R7_CTE=10）。
- 10-18 21:15：c3b 开始 npm test + regress-all（OUTDIR=selfplay-audit/r7-c3b），随后 A/B c3b vs r7a 2000 副 seed0=1600000（R7_CTE=10 与 27 两个变体，logs/ab-r7-c3n.log）。运行中不改代码。
- 10-18 21:24：c3b A/B vs r7a（2000 副 seed0=1600000，logs/ab-r7-c3n.log）：CTE=10 +0.098 [0.065, 0.130] 胜 52.4%；CTE=27（不限敌家张数）+0.135 [0.097, 0.173] 但 d084 回归。c3b regress-all：全部持平 c1 基线，dev-follow 143（+1，F131）、holdout2 58 恢复。npm test 415/416：唯一失败是计时测试 decide<120ms（122ms，跑 A/B 同时负载），A/B 结束后重跑。再试 CTE=13（d084 敌家 14 张）同种子。
- 10-18 21:28：CTE=13 同种子 +0.124 [0.089, 0.160] 胜 53.1% → 默认 R7_CTE=13（d084 敌家 14 仍排除）。代码改默认后：新种子复核 2000 副 seed0=1700000（显式 R7_CT=1 R7_CTC=1 R7_CTE=13），之后 npm test + regress-all（r7-c3c）。
- 10-18 21:32：c3c 新种子复核 vs r7a（2000 副 seed0=1700000，R7_CT=1 R7_CTC=1 R7_CTE=13）：+0.085 [0.057, 0.113] 胜 52.1%，违例 0。npm test 416/416；regress-all（r7-c3c）全部持平 c1 基线、dev-follow 143（+1）；frozen-real3 107、frozen-real4 108（仅参考）。**c3（收窄版）保留 → backups/post-selfplay-r7**（= r7a + c3c，无 c2）。开始全量体检 audit-r7（--version=post-selfplay-r7 --prev=audit-r5.json，同 r5 设置，logs/audit-r7.log）。
- 10-18 21:51：audit-r7 完成（policy=post-selfplay-r7，541s，1000 自对局 + 4×200×2 混合 + 185 surprise，违例 0）：红旗 MC 意外 6.5%（12/185，r5 10.8%、r7a 11.9%）、对家小牌+下家短仍过 73.5%（n=34，r5 45.5%）；早盘领单 19.4%、领对 12.3%（OK）。开始擂台 r7 vs pre-selfplay-audit 1000 副 seed0=1800000，随后 r7 vs post-selfplay-r5 1000 副 seed0=1900000（logs/arena-r7-vs-pre.log、arena-r7-vs-r5.log）。
- 10-18 21:54：擂台 r7 vs pre-selfplay-audit 1000 副（seed0=1800000）：+0.988 [0.872, 1.104] 级/副，胜 68.5% [65.9–71.1]，双上 315/被双上 58，违例 0（r5 时 +0.529）。r7 vs post-selfplay-r5 1000 副（seed0=1900000）：+0.269 [0.153, 0.385]，胜 56.1%，违例 0。净提升且无回归 → 构建发布。
- 10-18 21:57：构建（esbuild /tmp/eb）：SW 缓存 guandan-play-2fe16522c4（线上旧版 ffc31bab43），bundle 含 c1/c3（controlTempo、decomposeCounts），无 R7_WT。play/smoke.mjs SMOKE OK（18 副 1624 手，兜底 0，最慢 82ms）。iPhone WebKit 冒烟（竖/横）通过，输出与 r5 那次一致（仅 /api/status 404 本地无服务端，预期）。开始推送 gh-pages。
- 10-18 21:58：已推送 gh-pages（tomwugz-hub/guandan-play），等待 Pages 部署。
- 10-18 21:57：线上 https://tomwugz-hub.github.io/guandan-play/ 已是 guandan-play-2fe16522c4，bundle 与本地逐字节一致（md5 c9416e2c…）；线上 iPhone WebKit（/tmp/pw/live.mjs 竖/横）：200、6 手、SW 激活、离线重载 27 张、无 HTTP/控制台错误。audit-latest.* 改为 audit-r7 的副本。
- r7 轮汇总（补入轮次表）：| r7a（c1）| >14 张按 decomposeCounts 拆牌计划领出，关孤单加分/smallFirst | vs pre-selfplay-r7 1000×2：+0.236 [0.121, 0.351]、+0.326 [0.210, 0.442] | 全部不变 | 保留 → post-selfplay-r7a |；| r7 c2 | winThen 加分 | vs r7a 1000：+0.011；2000：+0.005 [−0.012, 0.023] | — | 撤销（代码已删）|；| r7（c3 收窄）| 手≤12 跟敌单/对，用计划中独立的控制牌（最便宜够用、敌家最短≤13、winProb≥0.85）+40 | 原版 vs r7a 2000：+0.141、1000：+0.124；收窄版 2000×2：+0.124 [0.089, 0.160]（CTE=13 同种子）、+0.085 [0.057, 0.113]（新种子）| 原版回归 −4（已修），收窄版全部不变、dev-follow +1 | 保留 → post-selfplay-r7 |。
- 新红旗备注（对家小牌+下家短仍过 73.5%，n=34）：示例多为 mustBomb（只有炸弹能压，如 self|6|59、self|64|53、self|545|81）或 noSFon8，其余示例有非炸弹可压（self|210|49 可出 99/AA 压对 2；self|640|76 要拆 QQQ 才能压对 6）；检测器未排除“只有炸弹可出”的情形，样本少，像是检测器口径问题多于策略问题。下一轮可先把检测器改成“有非炸弹可压”再看。
- **r7 轮完成。** policy = backups/post-selfplay-r7。

## r8 轮（10-19 11:45 开始；自本轮起时间为 Asia/Shanghai = 盒子时钟）
- 10-19 11:45：核对 policy == backups/post-selfplay-r7（diff 一致）→ 备份 backups/pre-selfplay-r8。任务：1) 修检测器“对家小牌+下家短仍过”（只计有不拆炸的非炸弹可压）；2) MC 意外 6.5% 分类找可修模式；3) 体检 audit-r8 + 擂台 + 回归 + 发布。
- 10-19 11:48：检测器修正（worker 记录 nonBombCleanAvail/nonBombNoStructAvail/cleanEx；audit 只计有不拆炸的非炸弹可压，详情里报旧口径与“只能拆三张”分组；报告时间改 Asia/Shanghai）。r7 同种子 1000 副自对局重测（logs/det-r7.log，reports/tmp/det-r7.md）：新口径 70.0%（21/30），旧口径 74%（25/34），不拆三张也能压 69%（20/29），只能拆三张 1/1；其中下家张数够同型跟 18/26、不够跟（对家出对、下家 1 张）3/4。仍超 60%（样本少），对 21 个过牌局面跑 MC（k1=32,k2=64，logs/r8-ps-mc.log）看是否该压。
- 10-19 11:50：第一次 MC 无效（候选只来自 decide 打分池，压对家的着法被 filters L262 硬过滤掉）→ worker surprise 加诊断选项 extraLegal（补合法非炸弹着法），重跑（logs/r8-ps-mc2.log）。另：r7 的 MC 意外里 partner/shouldPass 4 例（943|72、128|92、895|84、763|67）：对家出 A/Q/10 单张，我用级牌/逢人配/RJ 压，pass 只差 ~5 分（followUp 微加分 + beam）；filters.partnerOverrideOk 在“下家≤2 且 ≥这手张数”时放行，不看对家这手大小、对家已出完（128|92 对家 0 张接风）也放行。
- 10-19 11:56：MC（k1=32,k2=64，含被过滤的合法非炸弹着法）21 个“对家小牌+下家短仍过”局面：压牌明显更好（≥0.6 且 t≥2.5）只有 3/21（self|64|49 +0.93、64|53 +1.19 —— 两例最佳着法是拆炸弹的对子，敌最少 1 张；959|60 +1.22 用级牌 Q 压对家 4），其余 18 例最佳差值 −0.7~+0.46、多数 t<2.5；无一致模式 → 不改策略（符合主流护搭档：下家 3 张时过牌基本不亏）。检测器修正后 r7 = 70.0%（21/30），超 60% 主要是小样本+阈值口径，非策略问题。下一步：更大 MC 意外样本（audit --surprise=400 --k1=16 --k2=32 --surpSeed=777，r7，logs/r8-surp-r7.log）给意外分类。
- 10-19 12:21：大样本 MC 意外（r7，1000 自对局，surprise 332 个，k1=16/k2=32，surpSeed=777，reports/tmp/surp-r7.md）：10.2%（34/332）。分类：partner/shouldPass 9（其中 5 例是用三带二压对家三带二且拆天然炸弹：766|79、694|57、669|64、22|62、338|104，MC 过牌 +0.7~+1.2、766 t=11.8；filters.partnerOverrideOk 的“压后一手走完”分支不查拆炸；另 943|72 对家 A 单用逢人配压、763|67、895|84、435|75）；lead 12（顺子/连对 vs 单张等，散）；enemy passed 4（305 级牌压 A、312 级牌对压 JJ、236 RJ 压 Q、102 A 压 10）、enemy otherPlay 9（散）。最明确可修模式：压对家时拆炸弹 → 候选 c1。
- 10-19 12:23：MC 压对家（64 个对家出 A+/对家已出完时压牌的局面，po-mc-r7.json）：过牌更好 ≥0.5 只有 4/63，均值 ≈0；仅 943|72、128|92（理由只有“下家≤2”）明显。发现：policy/filters.enemyShortCount 把已出完的敌家（0 张）算成最短 → 敌家头游后所有 enemyShort≤1 逻辑（mustBomb/stopShort/拆炸豁免等）误触发（例 766|79 拆炸扣分被跳过）。写入三个候选（filters.js，env 开关 R8，默认开）：c1 R8_PB 压对家“压后一手走完”分支不许拆天然炸弹；c2 R8_PBIG 对家已出完或出 A/王/级牌单对时不按下家短去顶；c3 R8_ESL enemyShortCount 忽略 0 张敌家。A/B 各 2000 副 vs pre-selfplay-r8（seed0=2000000，开关全显式，logs/ab-r8-1.log；跑时不改代码）。
- 10-19 12:33：（续跑）A/B 结果：c1 R8_PB 0.000 [-0.007,0.007]（无效果）；c2 R8_PBIG -0.002 [-0.011,0.007]（无效果，A 胜 50.0%）；c3 R8_ESL 进行中（12:33 开始）。
- 10-19 12:37：c3 R8_ESL A/B（2000 副 seed0=2000000）：−0.151 [−0.180, −0.122]，A 胜 50.0%，A 双上 293 / 被双上 456 → 显著变差（敌家头游后把 0 张算最短而触发的 mustBomb/stopShort 实际在防被双上，“修”掉反而亏）→ **c3 撤销**。c2 −0.002（无效果、非 bug 修复）→ **撤销**。c1 0.000（中性，属明确 bug 修复：压对家时不拆天然炸弹）→ 拟保留：删 c2/c3 代码与 R8 开关，c1 改为常开，再新种子复核 + npm test + regress-all。
- 10-19 12:37：已删除 c2/c3 代码与 R8 env 开关（policy 与 pre-selfplay-r8 只差 c1 块，c1 常开 = 所测 R8_PB=1 配置）。c1 新种子复核：2000 副 seed0=2100000 vs pre-selfplay-r8（logs/ab-r8-c1b.log）。
- 10-19 12:40：c1 新种子复核（2000 副 seed0=2100000）：−0.003 [−0.010, 0.004]，胜 49.9%，双上 340/340，违例 0 → 中性（CI 含 0）。开始 npm test + regress-all（OUTDIR=selfplay-audit/r8-c1，logs/npm-test-r8.log、regress-r8-c1.log）。
- 10-19 12:40：c1 回归：npm test 416/416；regress-all（r8-c1）全部与 r7 基线一致（cases 50、pairs 60、holdout 62/58/56/55、dev-r6 143、dev-follow 143、dev-lead 146、dev-real 119；frozen-real3 107、frozen-real4 108 仅参考）。**c1 保留（中性的明确 bug 修复：A/B 0.000、−0.003，回归持平）→ backups/post-selfplay-r8**（= post-selfplay-r7 + c1）。开始全量体检 audit-r8（--version=post-selfplay-r8 --prev=audit-r7.json，同 r7 设置，修正后检测器，logs/audit-r8.log）。
- 10-19 12:50：audit-r8 完成（policy=post-selfplay-r8，519s，1000 自对局 + 4×200×2 混合 + 178 surprise，违例 0，reports/audit-r8.md）：红旗 MC 意外 6.2%（11/178；r7 6.5%）、对家小牌+下家短仍过 70.0%（n=30，修正口径；r7 同口径 70.0%，旧口径 r7 73.5%/r8 74%）；其余检测器与 r7 基本一致（早盘领单 19.4%、领对 12.3%、vs Random 2.950、vs Greedy 2.255、vs pre-activity 1.238、vs pre-round6 1.340）。开始擂台 r8 vs post-selfplay-r7（1000 副 seed0=2200000）与 r8 vs pre-selfplay-audit（1000 副 seed0=2300000）。
- 10-19 12:53：擂台 r8 vs post-selfplay-r7（1000 副 seed0=2200000）：−0.005 [−0.014, 0.004]，胜 49.9%，双上 178/179，违例 0（中性）；r8 vs pre-selfplay-audit（1000 副 seed0=2300000）：+0.938 [0.822, 1.054]，胜 68.5% [65.8–71.2]，双上 302/被双上 76，违例 0（r7 同类擂台 +0.988，噪声内）。bug 修复中性 + 无回归 → 构建发布。
- 10-19 12:55：构建（esbuild /tmp/eb，logs/build-r8.log）：SW 缓存 guandan-play-0fbd678212，bundle 含 c1（breaksNatBomb），无 R8_ 开关；play/smoke.mjs SMOKE OK（18 副 1624 手，兜底 0，最慢 115ms）；iPhone WebKit 冒烟（竖/横）通过，错误与 r7 一致（仅 /api/status 404 本地无服务端，预期）。开始推送 gh-pages。
- 10-19 12:55：已推送 gh-pages（tomwugz-hub/guandan-play），等待 Pages 部署。
- 10-19 12:57：线上 https://tomwugz-hub.github.io/guandan-play/ 已是 guandan-play-0fbd678212（旧 2fe16522c4），bundle 与本地逐字节一致（md5 fbac43ed…）；线上 iPhone WebKit（/tmp/pw/live.mjs 竖/横，logs/webkit-live-r8.log）：200、6 手、SW 激活、离线重载 27 张、无 HTTP/控制台错误、无 api/localhost 请求。audit-latest.* 改为 audit-r8 的副本。
- r8 轮汇总（补入轮次表）：| 检测器修正 | “对家小牌+下家短仍过”只计有不拆炸的非炸弹可压 | r7 同种子：74%(25/34)→70%(21/30)；MC 21 例只有 3 例该压 | — | 只改检测器，不改策略 |；| r8 c1 | 压对家“压后一手走完”分支不许拆天然炸弹 | vs pre-selfplay-r8 2000：0.000 [−0.007, 0.007]；新种子 2000：−0.003 [−0.010, 0.004] | 全部不变 | 保留（中性的明确 bug 修复）→ post-selfplay-r8 |；| r8 c2 | 对家已出完/出 A·王·级牌单对时不按下家短去顶 | 2000：−0.002 [−0.011, 0.007] | — | 撤销（代码已删）|；| r8 c3 | enemyShortCount 忽略 0 张敌家 | 2000：−0.151 [−0.180, −0.122]，被双上 293→456 | — | 撤销（显著变差，代码已删，加注释）|。
- **r8 轮完成。** policy = backups/post-selfplay-r8（= post-selfplay-r7 + c1）。

## 进贡还贡（10-19 15:05 开始；时间 Asia/Shanghai = 盒子时钟）
- 10-19 15:05：核对 policy == backups/post-selfplay-r8（逐文件一致）。备份 → backups/pre-tribute/{policy,engine,play,selfplay(代码+PROGRESS+diag，不含 logs/reports),test,update-gh-pages.sh}。
- 现状：engine/tribute.js + engine/state.js 是教练 app 用的“宿迁”进贡/升级（双下不进贡、贡牌不含王、升 2/1 级、过 A 要双下），play/ 网页版 progression 用它但不做进贡（ui 写着“本版本不做进贡/还贡；下一副由头游先出”），selfplay 每副独立（progression:false）。决定：不改旧模块（app/test 依赖），新增标准规则模块 engine/tributeStd.js + 标准升级（+3/+2/+1，打 A 头游且对家非末游过 A），网页版/自对局改用新模块。
- 10-19 15:10：已写 engine/tributeStd.js（planTribute/applyGives/returnOptions/resolveTribute + newStdMatch/applyStdResult 标准升级）、policy/tribute.js（还贡变体 min/plan/planfeed，开关显式：代理 spec 后缀 `#ret=<变体>`）、play/core.js（newGame tribute/pre、startDeal 进贡阶段、tributeGive/tributeReturn/autoTribute/tributePending；progression 改用标准升级）、selfplay/lib.mjs（playMatch/nextPre/checkTribute 不变量/summarizeTribute；playDeal 的 pre 选项；单副 API 不变）、worker（job.match=K）、pool（--ckpt 检查点续跑）、arena（--tribute --matchLen --ckpt，按比赛配对）。
- 10-19 15:10：还贡变体 A/B 开跑（快照目录 /tmp/gd-ab，主目录可继续改；nohup /tmp/gd-ab/run-ab.sh，日志 logs/ab-trib-1.log，检查点 /tmp/gd-ab/ck-*.jsonl，中断后重跑脚本即续跑）：plan vs min（seed0=3000000）、planfeed vs plan（3100000）、planfeed vs min（3200000），各 4000 副 = 250 场×8 副×2 朝向，比赛起始级 levelFor(seed)，两边打牌同为 current decide，只差还贡。
- 10-19 15:16：A/B plan vs min（4000 副 = 250 场×8 副×2 朝向，seed0=3000000，logs/ab-trib-1.log）：**+0.106 [0.050, 0.163]** 级/副，A 胜 52.2% [50.8–53.6]，双上 662/被双上 562，违例 0；进贡副 3252（抗贡 392、双贡 931）；A 方还贡的副 A 均分 +0.460（n=1465） vs B 方还贡的副 −0.186（n=1395）。
- 10-19 15:20：audit.mjs 加 --tribute/--matchLen/--ckpt（局面 id 的 seed = 牌种子 = 比赛种子×16+副序，surprise/replay 带 pre）与“进贡”一节（抗贡率、贡牌/还贡分布、进贡方/抗贡方得分、进贡不变量、检测器“有孤张却拆同点还贡”）；小样本试跑 48 副：进贡不变量 176 副全过。
- 10-19 15:20：单测 test/tribute-std.test.js 24 项全过（单贡/头末同队/抗贡单双/一张大王不抗/收贡方大王/双下大贡归头游/同点头游下家/逢人配排除/王进贡/还贡 ≤10、10 可、J/王/逢人配不可、非红桃级牌可、无 ≤10 还最小/非法回退/双贡两还/plan 不拆对/标准升级 +3/+2/+1/过 A/core 流程 27 张、进贡前不能出牌/不变量能抓篡改/自对局比赛无违例）。
- 10-19 15:22：网页版：结束弹窗显示名次、升级、两队级数、下一副进贡预告；下一副发牌后手牌上方“进贡面板”（滑入动画）：你进贡 → 强制牌自动选好+高亮跳动、“确认进贡”；你还贡 → 可还牌绿框、其余变暗、点非法牌提示、“建议”（policy 还贡）、“确认还贡”；机器人进贡（公开牌面）/还贡（与你有关或开明牌才显示牌面，否则“暗还”）；抗贡提示；进贡完成后“开始出牌”；菜单与面板“规则？”打开规则弹窗；URL ?seed=N 可复现。play/smoke.mjs 改为多副带进贡（含脚本人类还贡）SMOKE OK。
- 10-19 15:24：iPhone WebKit 进贡测试 /tmp/pw/tribute-test.mjs（seed 1 你还贡、5 你进贡（头游+末游同队，还给对家）、8 抗贡、9 双下同点你还贡；竖/横）：全部步骤可见、无横向溢出、非法牌点击有提示、进贡后 27 张、可继续出牌；仅 /api/status 404（本地无服务端，预期）；日志 logs/webkit-tribute.log，截图 dist/screens/tribute-*.png。修：抗贡文字折行（tribRow 改 block）、进贡时 toast 上移。
- 10-19 15:23：A/B planfeed vs plan（4000 副 seed0=3100000）：−0.009 [−0.060, 0.041]，胜 49.8%（无差别）；15:29 planfeed vs min（seed0=3200000）：+0.114 [0.062, 0.166]，胜 52.5%（与 plan vs min 相同量级）→ **planfeed 撤销（代码已删）**，保留 plan。
- 10-19 15:30：复查 plan 时发现：非红桃级牌（≤10，规则上可还）在 decomposeCounts 里单张只记 0.8，plan 会把它当“最便宜”的牌还掉（例：打 5，手里 ♠5 单张 + 一堆对子 → 还 ♠5）。修：plan 只在没有别的可还牌时才还级牌；旧行为临时保留为变体 planraw 做 A/B。停掉正在跑的旧 plan 复核（ab-trib-2，未完成、作废），快照 /tmp/gd-ab 更新为新代码，nohup run-ab3.sh（logs/ab-trib-3.log，检查点 ck3-*）：plan vs planraw（seed0=3400000）、plan vs min（seed0=3500000），各 4000 副。
- 10-19 15:42：A/B（logs/ab-trib-3.log）：plan（排除级牌）vs planraw（旧）4000 副 seed0=3400000：−0.001 [−0.022, 0.020]（中性，明确 bug 修复 → 保留）；plan vs min 新种子 4000 副 seed0=3500000：**+0.097 [0.037, 0.156]**，胜 51.6% [50.1–53.0]，违例 0。→ **默认还贡 = plan**；planraw 代码已删（RETURN_VARIANTS = min（基线/greedy 用）、plan）。单测加“不还级牌”一项（25 项）。
- 10-19 15:43：开始 npm test → regress-all（OUTDIR=selfplay-audit/tribute）→ 全量进贡体检 audit-tribute（--tribute --matchLen=8，同 r8 规模：1000 自对局 + 4×200×2 混合 + surprise 210，--prev=audit-r8.json，--ckpt）。串行 nohup：logs/tribute-final.sh → logs/npm-test-tribute.log、regress-tribute.log、audit-tribute.log。
- 10-19 15:57：tribute-final 链完成（15:52）。npm test 529/543：13 个失败是 backups/pre-tribute/test/*.test.js 被 node --test 扫到（备份已改为 test.tar.gz）+ 1 个 perf 计时（并发负载下 158ms>120ms）；regress 与 r8 差 2 题（dev-real d012 118、holdout4 q11a 54），policy 与 post-selfplay-r8 逐文件一致 → 疑为负载下计时抖动，空载复跑核实。
- 10-19 15:57：空载复跑 npm test 441/441 全过（logs/npm-test-tribute2.log）；regress-all（OUTDIR=selfplay-audit/tribute2，logs/regress-tribute2.log）与 r8 完全一致（dev-real 119、holdout4 55）→ 上次 2 题差异确认为负载计时抖动。audit-tribute.md：红旗与 r8 相同两项（MC 意外 9.0% n=189 vs r8 6.2% n=178，差异不显著；对家短仍过 65.6% n=32 vs 70.0%），无新红旗；进贡不变量 2600 副全过；抗贡 单贡 6%/双下 27%。开始擂台 current vs pre-selfplay-audit 进贡比赛 1000 副 seed0=3600000（logs/arena-tribute-vs-pre.log，ckpt logs/arena-tribute-vs-pre-ckpt.jsonl）。
- 10-19 16:01：擂台（进贡比赛，logs/arena-tribute-vs-pre.log）current vs pre-selfplay-audit 1008 副（63 场×8 副×2 朝向）seed0=3600000：A 胜 70.4% [67.3–73.6]，每副净升级 **+1.002 [0.863, 1.141]**（不进贡 r8 擂台 +0.938），双上 304/被双上 66，违例 0；进贡副 806（抗贡 103、双贡 278）。备份 → backups/post-tribute/{policy,engine,play,selfplay(代码+PROGRESS+diag),test.tar.gz,update-gh-pages.sh,TRIBUTE.md}（test 打包避免 node --test 扫到）。构建（logs/build-tribute.log）：SW 缓存 guandan-play-ce536deed0，bundle 147.2kb；play/smoke.mjs SMOKE OK（30 副 2639 手，兜底 0，最慢 227ms；进贡 单贡 21/双贡 3/抗贡 1；人类还贡 1）；iPhone WebKit mobile-test 竖/横通过（错误与 r8 一致，仅 404 /api/status）；tribute-test 通过（logs/webkit-tribute2.log）。小瑕疵：点“建议”后的 toast 会盖住面板上方（北家张数徽章/横屏“规则?”）几秒，未改。开始推送 gh-pages。
- 10-19 16:04：线上 https://tomwugz-hub.github.io/guandan-play/ 已是 guandan-play-ce536deed0（旧 0fbd678212），bundle 与本地逐字节一致（md5 268766c6…）；线上 iPhone WebKit live.mjs 竖/横（logs/webkit-live-tribute.log）：200、6 手、SW 激活、离线重载 27 张、无 HTTP/控制台错误、无 api/localhost 请求；tribute-test 对线上 URL（logs/webkit-tribute-live.log）6 个用例全过、errs 全空（本地截图另存 dist/screens/tribute-local/）。audit-latest.* 改为 audit-tribute 的副本。**进贡还贡本轮完成。**

## Jev 接入（10-19 16:05 开始；时间 Asia/Shanghai = 盒子时钟）
- 10-19 16:05：核对 policy == backups/post-tribute/policy。任务：0) 网页版“建议”toast 不盖进贡面板；1) selfplay 加 jev 代理（decide 兜底、状态哈希持久缓存 selfplay/cache/、并发限制+重试退避、只在 ≥2 个非平凡候选时调用、记录调用/延迟/用量）；2) 20 副试点（预算上限约 $2）；3) 200 副擂台 + Jev 体检（与 decide 分歧 MC 判定）；4) 不改 decide。
- 10-19 16:12：任务 0 toast：play/ui.js 加 placeToast()：进贡面板打开时 toast 放在面板上方 6px（竖屏居中、宽 max-content；横屏右对齐到 #side 出牌记录上方，不挡北家徽章），render() 后重新定位（面板因“已选”行长高会上移）；style.css 删掉固定 top:70px。/tmp/pw/tribute-test.mjs 加 toastCheck（点“建议”后量 toast/面板/北家徽章/规则? 矩形，截图 *-a-hinttoast.png）：6 例全过，overPanel/overNorthBadge/overRules 全 false（改前 overPanel=true）。smoke OK（30 副 2648 手，兜底 0）；mobile-test 竖/横通过（错误与之前相同：/api/status 404 + WebKit internal error）。备份原 tribute-test → tribute-test.mjs.bak。
- 10-19 16:12：已推送 gh-pages，SW 缓存 guandan-play-33b79a7922（旧 ce536deed0），bundle md5 f437fed9…，等 Pages 部署后跑 live.mjs。
- 10-19 16:18：任务 1 Jev 代理：新 selfplay/jevAgent.mjs（spec `jev`，lib.makeAgent 接入；候选/状态与 play/jevbridge.mjs 相同：buildJevCandidates(decide 硬过滤 + 60 分内 top-8) + buildJevState，但用真实牌对象）+ selfplay/jevcall.mjs（子进程做一次 pickWithJev，主循环 spawnSync 同步调用；密钥只从环境变量读、不输出）。规则：候选 <2 或 decide 首选一手出完 → 不调用；状态哈希 sha1(模型+state+候选) 持久缓存 selfplay/cache/jev-cache.jsonl；timeout/网络/429/5xx 重试 2 次（1s/2s 退避+抖动）；失败 → decide 兜底（按原因计数）；全局调用票据 selfplay/cache/jev-tickets + JEV_MAX_CALLS 硬上限；每次真实调用记 selfplay/logs/jev-calls.jsonl（延迟/尝试/usage）。pool：有 jev 的任务并发 ≤ JEV_CONCURRENCY（默认 4）。arena：支持 a/b=jev、collect、汇总 jev 统计。worker：逐手记录加 jev 字段（used/idx/decideIdx/decideMoveStr/jevDisagree），新任务 kind=jevmc（复现分歧局面，JEV_NO_API=1 只读缓存，两着法同一组确定化 rollout，后续全 decide）。新驱动 selfplay/jevaudit.mjs（擂台+调用统计+行为对比+分歧分类+MC 判定 → md/json）。测试开关 JEV_FAKE=1（哈希伪随机选，不发请求）：8 副全流程跑通、复现 6/6 一致、违例 0。
- 10-19 16:18：单次真实调用：API 返回 usage {input_tokens 1818, output_tokens 50}、无 cost 字段，model=jev-1.13.0（jev-latest 仍指 1.13；1.14 已于 10-14 发布）。价格（docs.typesafe.ai/models）：只按输入计费 $0.042/1M tok，输出免费 → ≈$0.000076/次。干跑（无 key）每副 Jev 队需调用 ≈16–20 次 → 预计 ≈$0.0015/副。
- 10-19 16:18：试点开跑：nohup jevaudit --deals=20 --matchLen=5（2 场×5 副×2 朝向 = 20 副，进贡开）seed0=4000000，JEV_MAX_CALLS=1500，并发 4，日志 logs/jev-pilot.log，ckpt logs/jev-pilot-ckpt.jsonl，报告 reports/jev-pilot.md。
- 10-19 16:21：试点完成（16:19，用时 45s，reports/jev-pilot.md）：20 副，Jev 座位决策 921（46/副），跳过单候选 544、decide 一手出完 19，真实调用 358（17.9/副），兜底 0、重试 0、违例 0；延迟 p50 411ms / p95 484ms / max 516ms（含 spawn 子进程；API 自身 p50 224ms）；输入 638,782 tok（1,784/次）→ **$0.0268（$0.00134/副）**，外推 200 副 ≈$0.27、1000 副 ≈$1.34。分歧率 22.9%（82/358）。擂台（样本小）Jev 队 −0.850 [−1.144, −0.556]，胜 35%。预算内 → 开始 200 副擂台 + 分歧 MC。
- 10-19 16:21：nohup jevaudit --deals=200 --matchLen=8 --seed0=4100000（13 场×8 副×2 朝向 = 208 副）--mc=200 --k=40，JEV_MAX_CALLS=6000（累计票据，最坏 ≈$0.45），日志 logs/jev-arena200.log，ckpt logs/jev-arena200-ckpt.jsonl / logs/jev-mc200-ckpt.jsonl，报告 reports/jev-audit.md。
- 10-19 16:29：200 副擂台对局部分完成（16:28，448s）：208 副，真实调用 3716（17.9/副），兜底 0、重试 0、违例 0，延迟 p50 405 / p95 487 / max 681ms，输入 6,716,383 tok → $0.2821（$0.00136/副）。分歧率 21.3%（790/3716）。分歧 MC（200 个，k=40，只读缓存）进行中。
- 10-19 16:48：200 副擂台 + MC 完成（16:44，reports/jev-audit.md/.json）。**擂台** Jev 队 vs decide 队 208 副（13 场×8 副×2 朝向，seed0=4100000）：A 每副净升级 **−0.058 [−0.345, 0.230]**，胜 48.6% [42.6–54.5]，双上 26/被双上 28，违例 0（无显著差别；按场配对只有 13 对，CI 宽）。
- 行为对比（Jev 座位 vs decide 座位）：早盘领单 41.2% vs 17.8%（领顺子 6.3% vs 19.1%、连对 10.9% vs 18.1%）；早盘领 A/级牌/王单对 6.3% vs 0%；拆炸领出 1.1% vs 0.3%；敌出后 ≤3 张、只能炸却过 14.5% (11/76) vs 2.9%；后盘跟敌过牌 34.3% vs 47.3%（Jev 后盘更积极跟）；炸弹数/逢人配补炸/炸对家/一手出完 与 decide 相同。分歧率：领出 31–48%，跟牌 8–10%，压对家几乎 0。
- 分歧 MC（抽样 200，有效 197，k=40，后续全 decide）：Jev 对 15、decide 对 18、差不多 164，平均 diff（Jev−decide）−0.039。分组：领出且 Jev 改领单张（decide 领三带二/顺子/连对/三张/对）n=54 **−0.164 ± 0.059**（系统性弱点，源于 jevState/jevScore 提示“领出留炸，先甩小单”“敌家牌多：先出最小孤单”与候选标签 [孤儿小单]——r7 前的旧启发式，r7 已改为按拆牌计划领出）；其它领出 n=99 −0.023 ± 0.044；跟敌 n=44 +0.079 ± 0.067（不显著，“decide 过→Jev 出” n=8 +0.341）。decide 可能的错（Jev 赢）：用逢人配把炸弹补大（6 张 3 炸带两张红桃 7、5 张 A 炸带 6H）压 RJ/Q 炸，4 张就够（+0.675 t=4.5、+0.55 t=6.3）；对家已走、敌 5 张时领 BJ（Jev 领 K +1.0）。Jev 的错：只能炸时选逢人配补成的小炸而保留天然大炸（−1.6）；5 张时 forceFinish 线不走（−1.0）；按“孤儿小单”拆计划领单（多例 −0.7~−0.9）。
- 10-19 16:48：**API 花费合计**：4074 次调用（试点 358 + 擂台 3716）+ 1 次探测，输入 7,357k tok → **$0.309**（预算 $2 以内）。缓存 selfplay/cache/jev-cache.jsonl 4074 条（分歧 MC 只读缓存，0 花费）。decide policy 未改（与 backups/post-tribute/policy 一致）。package.json 加 jev:pilot / jev:audit。**Jev 接入本轮完成。**
- 10-19 16:48：npm test 441 项：全量并行跑时 1–2 个计时测试（decide<120ms，152ms）偶发失败，单独跑 test/perf + policy 两次 93/93 全过 → 计时抖动（policy 未改）。日志 logs/npm-test-jev*.log。

## r9 + Jev 提示（10-19 19:52 开始；时间 Asia/Shanghai = 盒子时钟）
- 10-19 19:55：核对 policy/engine == backups/post-tribute（一致；play/ui.js、style.css 为 Jev 接入轮的 toast 修复，selfplay 多了 Jev 代理）。备份 → backups/pre-selfplay-r9/{policy,engine,play,selfplay(代码+PROGRESS+diag),scripts,test.tar.gz,update-gh-pages.sh}。任务：A) decide r9 “最小够用炸弹”（少用逢人配/不用过大炸弹，除非 lookahead 需要）；B) Jev 提示修正（删 r7 前领出旧规则、给 Jev 拆牌计划、标记逢人配/过大炸弹、只能炸时提示炸、少早领 A/级牌/王）+ 缓存分歧局面重放验证；C) 1000 副 Jev(新提示) vs decide r9；D) 若 decide 改了则构建发布。API 预算 ≤ $2.50（本轮）。
- 10-19 19:58：B 的重放准备（先于任何代码改动）：selfplay/diag/r9-snap.mjs 用当前代码 + Jev 缓存（JEV_NO_API=1）复现 jev-audit 200 副擂台（logs/jev-arena200-ckpt.jsonl），把 Jev 调用过的 3716 个局面存成快照（structuredClone 的 g，v8 序列化，selfplay/cache/r9-snap/<cfg>_<seed>.bin，每副一个文件，可续跑）。3715 个，17 个复现不一致（beam 计时不定导致分岔，剔除）。首版忘了深拷贝（存成终局）→ 已重做。调试工具 selfplay/diag/r9-pos.mjs <id> [version]（DECIDE_DEBUG 打分）。
- 10-19 19:59：A 诊断：decide 在多个炸弹之间几乎只靠 heuristicEval（张数×2+bombSize）×0.15 和 beam 微分排序 → 总是挑张数最多的炸弹（例 117|88：333377 5.6 > 3333 4.1；130|63：AAAA6 4.7 > AAAA 3.7）。对家已出完、敌 5 张领 BJ（83|84）：enemyShortCount 把出完的敌家（0 张）算最短 → bigFirstVsLast（敌报单从大出）误触发。
- 10-19 19:59：候选（policy/index.js，env 开关仅试验用）：c1 R9_BMIN 最小够用炸弹：炸弹代价 bombCost = 20×逢人配补位 + 6×级别（张数−4；同花顺 1.5；天王炸 12）+ 0.5×点数，比池中最便宜的炸弹贵多少扣多少（≤60，标 bombWildPad/bombOversize），大炸弹的 moveFinish 更好时不扣；c2 R9_LIVE 领出时 enemyShort 只看还在打的敌家（跟牌不变，r8 c3 教训）。三个例子：117|88→3333，130|63→AAAA，87|58→QQQQ（天然），83|84→领 5。
- 10-19 20:00：A/B 快照目录 /tmp/gd-ab9（主目录可改），nohup /tmp/gd-ab9/run-ab9.sh（logs/ab-r9-1.log，ckpt /tmp/gd-ab9/ck-*.jsonl，重跑即续跑）：c1（R9_BMIN=1 R9_LIVE=0）seed0=5000000、c2（R9_BMIN=0 R9_LIVE=1）seed0=5100000，各 4000 副进贡比赛 vs post-selfplay-r8（policy 与 post-tribute 逐文件一致）。
- 10-19 20:07：**c1 A/B**（R9_BMIN=1 R9_LIVE=0，4000 副 = 250 场×8×2，seed0=5000000，logs/ab-r9-1.log）：+0.026 [−0.027, 0.079]，胜 50.0%，双上 667/612，违例 0 → 中性（明确 bug 修复，待新种子复核 + 回归）。c2 A/B 进行中。
- 10-19 20:05：B 改动（主目录；A/B 在 /tmp/gd-ab9 不受影响）：jevScore（JEV_MODEL 可由 env 覆盖；PROMPT_VERSION 进缓存哈希；删“领出且有炸优先【孤儿小单】”“敌短先出孤儿小单过渡”；领出按 state.handPlan；只能炸时提示；候选按 decide 评分排序的说明）；jevState（删“领出留炸，先甩小单”、敌家牌多“先出最小孤单”→ 按 decide 计划（>14 张 decomposeCounts，planForHand）先出长组件/最弱组件；领出提示用还在打的敌家张数；bombOnlyStop 提示；早中盘不领 A/级牌/王）；jevCandidates（删 [孤儿小单] 标签与孤单前置/加分；展示顺序 = decide 评分；多炸弹只留 bombCost 最小的（原 compareCombos 最小会留下逢人配小炸）+ decide 首选；标签 [按计划先出]/[按计划]/[拆计划]（用 decide 的 plan 标签与 offPlan）、[用逢人配]/[炸弹过大]、[只有炸弹能拦]、[早出控制牌]、[领出炸弹过早]；走完线优先用 decide 的 forceFinish 标签）。jevAgent 抽出 jevChooseCached（缓存/票据/重试共用）；worker 加 snapmc（快照局面 rollout）。
- 10-19 20:10：重放验证工具 selfplay/diag/r9-jevreplay.mjs（--set=mc：jev-audit 的 197 个分歧 MC 局面；--mc 对新着法补 rollout，k=40，后续 post-selfplay-r8，与 jev-audit 同种子；值 = 新着法 − 旧 decide 着法）。r9b（191 次调用，$0.0166）：全部 197 新 Jev 均值 +0.006（旧 Jev −0.039）；单张领出类 54：−0.164 → +0.013（46 个改回 decide 的着法）；判定明确 33 个里选到 MC 更好的 16（旧 15）：Jev 对的 15 保住 7、decide 对的 18 改对 9。26 个新着法 MC 中。发现标签问题 → r9c：decide 打过分的着法只信 decide 的 forceFinish（领炸“被压就炸回”误标）、[按计划先出] 只给计划内且非最后两手、领炸过早标签。
- 10-19 20:16：**c2 A/B**（R9_BMIN=0 R9_LIVE=1，4000 副，seed0=5100000）：**+0.110 [0.062, 0.159]**，胜 50.8%，双上 673/522，违例 0 → 显著提升，保留。20:18 起 c1+c2 合并新种子复核（seed0=5200000，4000 副，/tmp/gd-ab9/run-ab9b.sh，logs/ab-r9-2.log）。
- 10-19 20:12：r9c/r9d 修标签：补足 2 个候选时只补 decide 分差 ≤2×GAP 且 decide 有走完线时不拿非走完着法凑数（R110 恢复只给炸弹）；[按计划先出] 只给 decide 分最高的那个计划内着法；“只有炸弹能压”改为“候选里只有炸弹能压”。test/round6 eg015 断言改为 [按计划]（孤儿小单标签已删）。PROMPT_VERSION r9d。
- 10-19 20:15：**r9d 重放（197 个分歧 MC 局面，k=40）**：新 Jev 均值 **+0.021**（旧 Jev −0.039，新 decide +0.008）；与旧 decide 相同 108、与旧 Jev 相同 64；单张领出 54：−0.164 → −0.008（46 个改回 decide）；MC 判定明确 33 个中选到 MC 更好着法 16（旧 Jev 15）：Jev 对的 15 保住 7（均值 0.793→0.393）、decide 对的 18 改对 9（−0.850→−0.301）；炸弹 20 个：−0.011 → +0.018（逢人配凑大炸弹的 6 个新 decide 已选最小炸弹，Jev 跟着）。新 Jev 与新 decide 仍分歧 53/197。r9b 与 r9d 接近（+0.019）。
- 10-19 20:20：agree 抽样（200 个旧 Jev = 旧 decide 的局面，r9d）：177 个仍同旧着法，新 Jev 与新 decide 分歧仅 9；值 +0.011（好 4 / 差 3）。
- 10-19 20:21：frozen-real3/4 --jev=1（仅参考，不据此调）：基线（/tmp/gd-jevbase，r9 前代码，今日重跑）decide 107/108、Jev 105/108；r9d decide 108/108、Jev 107/104。real4 的退步里 3 个是 Jev 领出对 2（u003/u093 等）：计划提示写“本手先出 22（计划里最弱的一手）”而 decide 首选单张 5，标签 [按计划先出] 也打在 22 上——提示与 decide 矛盾的 bug（同类在 dev 上同样存在，属通用修复，非针对冻结集调参，记录在案）。
- 10-19 20:23：r9e：计划提示/[按计划先出] 优先指向 decide 首选（若在计划里）；“不要拆计划出单张”改为“不要拆对子/三张/顺子等组合”（与先出单张不矛盾）。play/jevbridge.mjs：领出时 lastPlayer=null、controlSeat=自己（与 selfplay/jevAgent 一致；bridge 直接用 policy 的 buildJevCandidates/buildJevState/pickWithJev，自动用新提示）。decide 去掉 R9_BMIN/R9_LIVE 环境开关（默认 = 测试值，均开）。
- 10-19 20:26：r9e 重放 197 MC 局面：+0.016（r9d +0.021，噪声内），MC 更好着法 15/33，单张领出 +0.011，与新 decide 分歧 50。
- 10-19 20:29：**c1+c2 合并复核**（新种子 seed0=5200000，4000 副）：**+0.093 [0.035, 0.152]**，胜 50.4%，双上 637/499，违例 0 → 保留两项（r9 = c1 最小够用炸弹 + c2 领出时敌家短牌只算还在打的敌人）。agree 抽样 r9e：181/200 同旧着法，与新 decide 分歧 4，值 +0.009（好 4 / 差 2）。
- 10-19 20:36：npm test（空载）：并行全量 439/441，2 个计时测试（decide 均值 85ms>80、单手 130ms>120）失败；r9 前代码副本 /tmp/gd-jevbase 同时同法也失败（80.7ms）；直接测速 r9 与 r9 前一致（≈39–50ms/手）→ 计时抖动。串行 `node --test --test-concurrency=1` **441/441 全过**（logs/r9-npmtest-serial.log）。regress-all（OUTDIR=selfplay-audit/r9）：cases 50、pairs 60、holdout 62/58/56/55、dev-r6 143、dev-follow 143、dev-lead 146、dev-real 119 —— 全部等于基线；frozen-real3 108（原 107）/real4 108（仅参考）。备份 → backups/post-selfplay-r9（policy 平铺供 loadDecide + engine/play/scripts/selfplay/test.tar.gz/update-gh-pages.sh）。
- 10-19 20:37：开始 audit-r9（--tribute --matchLen=8 --deals=1000 --mixed=200 --surprise=210 --prev=audit-tribute.json --ckpt=logs/audit-r9-ckpt.jsonl，logs/audit-r9.log）。
- 10-19 20:42：续跑核对：audit-r9 仍在跑（pid 410897，deal 109/109 完成，surprise 1/28）；构建 20:36 晚于 policy 最终修改 20:20 → bundle 含 r9；smoke-r9 SMOKE OK（30 副 2707 手，兜底 0，最慢 157ms），webkit-r9 竖/横 + tribute-r9 通过（错误与 tribute 轮一致：/api/status 404 预期）。尚未发布。
- 10-19 20:56：audit-r9 完成（reports/audit-r9.md）。开始最终 1000 副（nohup selfplay/logs/jev-final-r9.sh → logs/jev-final-r9.log；1008 副 = 63 场×8×2，seed0=4200000，ckpt logs/jev-final-r9-ckpt.jsonl、MC ckpt logs/jev-final-r9-mc-ckpt.jsonl，--mc=200 k=40 只读缓存；JEV_TAG=r9-final1000，独立票据 cache/jev-tickets-r9final 上限 26000 次 ≈$2.20；预估 ≈$1.5）。
- 10-19 20:56：**audit-r9 vs audit-tribute**：红旗只有 1 个且与上次相同（对家小牌+下家≤3 张仍过 65.7% n=35，上次 65.6%，r8 已 MC 定性不改）；MC 意外 3.6%（上次 9.0%）；敌≥15 张炸普通牌 14.2%（12.6%，仍 ≤15%）；只能炸却过 2.8%（4.2%）；违例 0/2600，进贡不变量全过；对 Random 2.940、Greedy 2.408、pre-activity 1.315、pre-round6 1.347（均≈上次）；自对局 −0.025 [−0.152,0.102]。
- 10-19 20:58：已发布 gh-pages（logs/publish-r9.log）：SW 缓存 **guandan-play-dbfa39841a**（旧 33b79a7922），线上 bundle md5 c3af3265… 与本地一致；线上 live.mjs 竖/横（logs/webkit-live-r9.log）：200、SW、离线重载 27 张、errs 全空。
- 10-19 21:55：**最终 Jev(r9e) vs decide r9（1008 副，seed0=4200000，reports/jev-final-r9.md）**：Jev 队 +0.048 [−0.069, 0.164] 级/副，胜 50.6% [47.6–53.6]，双上 139/123，违例 0，兜底 0；真实调用 15208（15.1/副），延迟 p50 434ms / p95 523ms（max 376s 单次离群）；本次费用 $1.240（输入 29.5M tok × $0.042/M），本轮（19:52 起 jev-calls.jsonl，16259 次，31.66M 输入 tok）合计 **$1.330**（≤$2.50）；分歧率 9.9%（lead early/mid/late 8.7/14.0/22.1%，enemy 7.6/6.7/5.5%）；MC 200（有效 195）：Jev 对 24 / decide 对 21 / 差不多 150，均值 +0.008 → 与 decide 持平无显著差异。Jev 弱点：领出拆炸成三张（67200134|68、67200723|72）、带牌乱用 A/K/逢人配（67200885|16、67200738|21、67200807|63）、按计划先出三带二而非连对/小单（67200871|41、67200215|28）；强点：敌不短时晚盘领小炸清路（67200531|63、67200595|37）、decide 过时跟出（67200022|45、67200016|49）、残局喂搭档/控牌（67200164|94、67200784|73、67200770|79）。结论：Jev 不做主 bot，保留为提示/审计。

## r10 Jev→decide（10-20 05:36 开始；时间 Asia/Shanghai = 盒子时钟）
- 10-20 05:36：核对 policy == backups/post-selfplay-r9（逐文件一致）。备份 → backups/pre-selfplay-r10/{policy,engine,play,scripts,selfplay(代码+PROGRESS+diag),test.tar.gz,update-gh-pages.sh}。线上缓存仍为 guandan-play-dbfa39841a（r9）。目标：从 jev-final-r9 挖 Jev 强点写成 decide 规则候选；A/B 进贡比赛；只保留提升；Jev 不做主 bot。
- 诊断工具：selfplay/diag/r10-pos.mjs（从 jev-final-r9-ckpt 复现局面 + DECIDE_DEBUG 打分；r9-snap 是 200 副旧种子，本轮用 final-r9 复现）。
- Jev 强点诊断（复现 ok）：
  1) **晚盘领小炸清路**（类别 lead:Jev领炸 +0.47 n=9）：例 67200531|63 手=55555+2222，decide 拆出单 5（−50.7）vs 炸 2（−114.6，holdBombLead−80 + leadBombLate−40）；炸后剩一手炸 minPlays=1。同型 67200595/67200900/67200117。根因：敌不短时罚领炸过重，忽略“炸完剩 ≤2 手”。
  2) **decide 过→Jev 出**（+0.31 n=15）：例 67200022|45 敌短=5 跟 J，A −32.3 / pass 0.2（earlyMidFollow 要敌短≥6 未触发）；67200016|49 压对家 KK 出 AA 分差仅 −1（边界）。
  3) **残局喂搭档/控牌**：67200164|94 对家1 + 敌1，feedOk1 因 enemyShort=1 且 nextEnemyN=0 失败，未触发 +260 喂牌（对家在敌之前出牌，应喂）；67200784|73 级牌 J>K（级=J）decide 出 J 有 bigFirstVsLast——级牌确实更大，暂不挖；67200770|79 敌=2 时 shortEnemyLead 偏单张、Jev 甩小对——与 vsTwoNoPair 冲突，慎改。
- 可选硬化（Jev 错）：拆炸领三张 / 三带二带 A·K·王——decide 已有 bombBreak* / fhAttach，例中 decide 已选对 → 不改除非再证 bug。
- 候选（env 默认关，A/B 显式开）：
  - **c1 R10_BOMBCLR**：领出天然炸且炸后 minPlays(rest)≤2、敌短≥4 → 不扣 holdBombLead/leadBombLate（tag bombClear）。
  - **c2 R10_FEED**：喂报单改为“我与对家之间无 ≤1 张的在打敌人”才允许（tag feedPartner；修 67200164）。
  - **c3 R10_PRESS**：跟敌单/对、敌短∈[3,5]、有非王非级（earlyFollowCost≠null）可跟 → 该着 +35、若存在则过牌 −20（tag pressMidShort）。
- 10-20 05:41：候选已写入 policy/index.js（R10_* 默认 0）。例手验证：c1 531/595 → bombClear 领小炸；c2 164 → feedPartner 单 6；c3 022 → pressMidShort 出 A（r10-pos）。可选硬化跳过（fhAttach/bombBreak 已盖住 Jev 错）。A/B nohup /tmp/gd-ab10/run-ab10.sh → logs/ab-r10-1.log，ckpt /tmp/gd-ab10/ck-c{1,2,3}-*.jsonl，各 4000 副进贡 vs post-selfplay-r9（seed0=6000000/6100000/6200000），跑时不改代码。

## StartLux 对比（10-20 06:00 开始；时间 Asia/Shanghai = 盒子时钟）
- API：STARTLUX_API_KEY 仍不可用（Gmail 仅有 2026-10-16 发往 contact@startlux.com 的请求；环境未设密钥）。改用本地 **StartLux-Decision-v1.1-2B-Instant-Q4_K_M**（`/workspace/startlux/v11-2b/*.gguf`）。
- llama-server：`/workspace/llamacpp/llama-b11700/llama-server`，CPU（无 -ngl），`-c 4096 --parallel 1 --ctx-checkpoints 0 -b 4096 -ub 4096 --port 8081`；日志 `selfplay/logs/startlux-llama-server.log`。/health ok；字母 logprobs 读出约 8–9s/次。
- 自对局接入（不改 decide）：`selfplay/startluxAgent.mjs` + `startluxcall.mjs`（与 Jev 同候选 `buildJevCandidates`/`jevPrepare`，`pickWithStartLux` 字母读出；decide 兜底；缓存 `selfplay/cache/startlux-cache.jsonl`；`STARTLUX_CONCURRENCY=1`）。`arena`/`lib`/`pool`/`worker` 支持 spec `startlux`；驱动 `selfplay/startluxaudit.mjs`。
- 残局对照 / 试点：进行中（见后续条目）。**不发布**；不碰 r10 `/tmp/gd-ab10` A/B。
- 10-20 06:04：A/B vs post-selfplay-r9 各 4000 副进贡（logs/ab-r10-1.log）：
  - **c1 R10_BOMBCLR** +0.052 [0.004, 0.101] 胜 51.5%，双上 581/550 → **保留**
  - **c2 R10_FEED** +0.002 [−0.007, 0.011] 胜 50.1%，双上 521/523 → **保留**（中性的明确喂牌 bug 修复，同 r8 c1）
  - **c3 R10_PRESS** +0.017 [−0.012, 0.046] 胜 50.5% → **撤销**（CI 含 0，非明确 bug；代码已删）
- 10-20 06:04：c1+c2 常开（去掉 R10_* 开关，= 所测配置），c3 已删。合并复核 nohup seed0=6300000 4000 副（logs/ab-r10-2.log）。

- 残局对照（info only，`--jev=1 --startlux=1`，本地 Instant；不据此调 decide）：
  - frozen-real3：decide **108/120 (90.0%)**，Jev **108/120 (90.0%)**（部分 http_451 → decide 兜底），StartLux Instant-Q4 **97/120 (80.8%)**。报告 `eval/endgames/startlux-cmp/frozen-real3.md`。
  - frozen-real4：decide **108/120 (90.0%)**，Jev **108/120 (90.0%)**，StartLux **106/120 (88.3%)**。报告 `…/frozen-real4.md`。
  - 备注：本集是 case acc（pairs=0），不是 DecisionPivot 对照对；README 上 Instant-Q4_K_M DecisionPivot≈21.9（非本残局口径）。Jev 多次 `http_451` 但兜底后与 decide 同分。
- 试点：`STARTLUX_BACKEND=local` 20 副进贡换座位 vs decide（seed0=7000000，matchLen=5）→ `selfplay/reports/startlux-pilot-local2b.md`（单次调用 ≈9.5s CPU）。
- 10-20 06:29：**本地 Instant 试点完成**（20 副，matchLen=5，seed0=7000000，`STARTLUX_BACKEND=local`，报告 `selfplay/reports/startlux-pilot-local2b.md`）：
  - 擂台 StartLux 队 vs decide：每副净升级 **−1.600 [−2.188, −1.012]**，胜 25.0% [15.2–34.8]，双上 0/被双上 8，违例 0（仅 2 场配对，CI 宽但方向明确变差）。
  - 调用 290（14.5/副），兜底 0，缓存命中 0；延迟 p50 **2005ms** / p95 **9964ms** / max 10827ms；分歧率 **67.9%**（197/290）。
  - 行为：早盘领出单张 2.4% vs decide 20.4%；早盘领三带二 46.3% vs 22.2%；跟敌过牌更高（early 67.5% vs 54.8%）。
  - 墙钟 1350s（67.5s/副）→ 外推 40 副 ≈45min、**1000 副 ≈18.7h**（未再扩，信号已够）。
- 建议：本地 Instant-2B **不宜**替代/混入 decide；残局 case acc 80–88%（decide/Jev 90%）且自对局大负。继续等 27B（Bamboo 另节）；本地 2B 仅作对照工具保留。**未发布**；未改 decide；未打断 r10 `/tmp/gd-ab10*`。

## StartLux Bamboo 27B（10-20 06:05 开始；时间 Asia/Shanghai = 盒子时钟）
- Bamboo Relay 账号就绪；密钥仅从 env `BAMBOO_API_KEY`（缺省时进程启动读 `/home/box/.secrets/BAMBOO_API_KEY`），**从不写入 PROGRESS/报告/聊天**。
- 冒烟：`POST /v1/decisions` model=`startlux-decision-27b-autothink` 开店 noul≈0.987（既有）；本轮 `pickWithBamboo` 选着 ok（约 2s，usage 有 input_tokens、charge $0）。
- 实现：`policy/bambooScore.js`（Bamboo choice + allow_none=false + think_mode=auto）；`selfplay/startluxAgent.mjs` / `startluxcall.mjs` 默认 backend=bamboo（`STARTLUX_BACKEND=local` 仍走本地 Instant）；缓存 `selfplay/cache/startlux27-cache.jsonl`；票据 `STARTLUX_MAX_CALLS`；并发默认 3；429/5xx 重试。
- 钩子：arena / pool / lib / startluxaudit / run-endgame-eval 已接 `startlux` → Bamboo。不改 decide；不碰 r10 `/tmp/gd-ab10`；不杀本地 2B llama-server / frozen-real* 任务。
- 下一步：blind endgame frozen-real3/4（Bamboo，可选跳过 Jev）；试点 20–40 副再 200 副擂台。
- 10-20 06:13：合并复核中发现 R058 回归（宽版 bombClear 在炸后剩级牌单+王时误领炸）。收窄 **bombClearOk**：炸后仍有天然炸，或炸后 ≤1 手（覆盖 Jev 双炸例；排除 R058）。c2 不变。重跑合并 A/B seed0=6400000（logs/ab-r10-2.log）+ 串行 npm test。
- 10-20 06:24：合并复核（收窄 c1 + c2）vs post-selfplay-r9 4000 副 seed0=6400000：**+0.074 [0.032, 0.116]** 胜 52.0%，双上 540/505，违例 0 → 保留。下一步 npm test + regress-all + audit-r10 + 擂台。

- 10-20 06:27：r10-final-chain 曾在 npmtest 处中断（logs/r10-final-chain.log 仅 `=== npmtest 06:24 ===`；串行 npmtest 在 StartLux llama-server 高负载下计时失败 440/441，decide 128ms>120ms）。**不杀** startluxaudit / llama-server / bamboo。已重挂 `selfplay/logs/r10-final-chain.sh`（nohup）：等 1 分钟 loadavg<4 且 llama 空闲 → 串行 npm test 441 → regress-all（OUTDIR=selfplay-audit/r10，须对齐 r9 基线）→ backups/post-selfplay-r10 → audit-r10（同 audit-r9：`--tribute --matchLen=8 --deals=1000 --mixed=200 --surprise=210 --prev=audit-r9.json --ckpt`）→ 擂台 r10 vs r9（seed0=6500000）与 r10 vs pre-selfplay-audit（seed0=6600000）各 1000 副进贡 → 无回归则 build/smoke/webkit/publish。候选：**c1 bombClear（收窄）+ c2 feedPartner 保留**（合并 +0.074 [0.032,0.116]）；**c3 pressMidShort 已删**。

- 10-20 06:15/06:21：blind endgame（`run-pair-eval --startlux=1 --jev=0`，Bamboo 27B；跳过 Jev）：
  - frozen-real3：decide **106/120 (88.3%)**，StartLux 27B **98/120 (81.7%)**，startlux_error 0。报告 `eval/endgames/startlux27-cmp/frozen-real3.md`。（decide 相对 Instant 对照时的 108 略降，因中间收窄 bombClear；info only）
  - frozen-real4：decide **108/120 (90.0%)**，StartLux 27B **105/120 (87.5%)**，startlux_error 0。报告 `…/frozen-real4.md`。
- 10-20 06:29：本地 Instant-Q4 试点 20 副完成（`STARTLUX_BACKEND=local`，seed0=7000000，matchLen=5）→ `selfplay/reports/startlux-pilot-local2b.md`：胜 **25.0%** [15.2–34.8]，净升级 **−1.600** [−2.188, −1.012]，双上 0/被双上 8，兜底 0，分歧率 67.9%，p50 延迟 2.0s（CPU），墙钟 1350s。
- 10-20 06:46：Bamboo 27B 试点 20 副完成（seed0=7000000，matchLen=5，ckpt `logs/sl27-pilot-ckpt.jsonl`）→ `selfplay/reports/startlux27-pilot.md`：胜 **20.0%** [20.0–20.0]（仅 2 场配对，CI 退化），净升级 **−1.800** [−1.996, −1.604]，双上 0/被双上 10，**兜底 0**，API 316 次（15.8/副），缓存命中 11，分歧率 55.7%，延迟 p50 **7.4s** / p95 **42s** / max 53s，墙钟 1900s。API 健康 → 启动 200 副擂台。
- 10-20 06:47：200 副 Bamboo vs decide 进行中（matchLen=8，seed0=7200000，concurrency=3，ckpt `logs/sl27-arena200-ckpt.jsonl`，out `reports/startlux27-arena200.md`）。不改 decide；不发布；不碰 r10 `/tmp/gd-ab10`。

- 10-20 06:51：盲残局 Bamboo27（jev=0）：frozen-real3 decide 106/120、StartLux27 **98/120**；frozen-real4 decide 108/120、StartLux27 **105/120**。对照本地 Instant（并行任务）：real3 97、real4 106。Jev 同跑因 http_451 大量 fallback≈decide。费用 $0。
- 10-20 06:51：试点 20 副（matchLen=5 seed0=7000000，并发 2，reports/startlux27-pilot.md）：技术健康——兜底 0、违例 0、真实调用 316（15.8/副）、缓存 11；延迟 p50 7.4s / p95 42s / max 53s（AutoThink）；与 decide 分歧率 55.7%（182/327）。擂台样本极小（2 场）：A −1.80 级/副、胜 20%、被双上 10 —— **不可信**，按 Jev 先例开 200 副（seed0=7200000 matchLen=8，logs/sl27-arena200.log）。

- 10-20 06:32：串行 npm test **441/441**（负载已降；此前 StartLux 高负载下计时失败）。regress-all（OUTDIR=selfplay-audit/r10）全部对齐 r9 基线：cases 50、pairs 60、holdout 62/58/56/55、dev-r6 143、dev-follow 143、dev-lead 146、dev-real 119；frozen-real3 107 / real4 108（仅参考）。备份 → backups/post-selfplay-r10。
- 10-20 06:43：audit-r10（--tribute --matchLen=8，同 r9，629s，reports/audit-r10.md）：违例 0/2600，进贡不变量全过；红旗 MC 意外 8.8%（n=193；r9 3.6%）、敌≥15 炸普通 15.7%（r9 14.2%，贴边）、对家短仍过 62.1%（n=29；r9 65.7%）；vs Random 2.908、Greedy 2.422、pre-activity 1.380、pre-round6 1.363（均≈r9）。
- 10-20 06:47：擂台 r10 vs post-selfplay-r9 1008 副 seed0=6500000：**+0.045 [−0.047, 0.136]** 胜 51.7%，双上 144/143，违例 0（与合并 A/B +0.074 同向，CI 含 0）；r10 vs pre-selfplay-audit 1008 副 seed0=6600000：**+1.010 [0.869, 1.151]** 胜 69.2%，双上 299/被双上 62，违例 0。
- 10-20 06:51：构建（ESBUILD=/tmp/eb/...）SW 缓存 **guandan-play-e103d06c66**（旧 dbfa39841a），bundle 含 bombClear/feedPartner；smoke SMOKE OK（30 副 2685 手，兜底 0，最慢 93ms）；iPhone WebKit 竖/横 + tribute 6 例通过（错误与 r9 一致：/api/status 404 预期）。已推送 gh-pages；线上缓存已是 e103d06c66，bundle 逐字节一致（md5 174b1f14…）；线上 live 竖/横：200、SW、离线重载 27 张、errs 全空。audit-latest.* → audit-r10 副本。
- r10 轮汇总：| r10 c1（收窄 bombClear）| 领出天然炸且炸后仍有炸或 ≤1 手、敌短≥4 → 不扣 holdBombLead/leadBombLate | 单测 vs r9 4000：+0.052；合并收窄 +0.074 | 宽版 R058 回归已收窄 | 保留 |；| r10 c2 feedPartner | 喂报单改为我→对家之间无 ≤1 张在打敌人 | 单测 +0.002；合并保留 | 全部不变 | 保留（中性明确 bug 修复）|；| r10 c3 pressMidShort | 跟敌中短 +35/过 −20 | +0.017 CI 含 0 | — | **撤销（代码已删）** |。
- **r10 轮完成。** policy = backups/post-selfplay-r10。线上 guandan-play-e103d06c66。


- 10-20 11:37：**200 副擂台完成**（pid 665089，墙钟 17425s ≈4.84h；reports/startlux27-arena200.md/.json；ckpt logs/sl27-arena200-ckpt.jsonl 26/26）。设置：Bamboo `startlux-decision-27b-autothink` vs decide（current），matchLen=8，seed0=7200000，13 场×8 副×2 朝向 = **208 副**，并发 3，密钥仅 `/home/box/.secrets/BAMBOO_API_KEY`。
  - **擂台**：A（StartLux）胜 **33/208 = 15.9%** [95% CI **10.4–21.3**]；每副净升级 **−1.558 [−1.734, −1.381]**；双上 **5 / 被双上 64**；不变量违例 **0**。进贡副 160（抗贡 25，双下双贡 47）。
  - **调用**：座位决策 10178（48.9/副）；需调用 3725（**17.9/副**），缓存命中 0，真实调用 3725（尝试 3778）；**兜底 4（0.11%，全 timeout）**；与 decide 一致 1668、分歧 **2053（分歧率 55.2%）**。
  - **延迟**（含 spawn）：p50 **7535ms**，p95 **46349ms**，max 421804ms（n=3725）。费用 $0（Bamboo 测试期 free）。外推 1000 副 ≈23.3h。
  - **行为要点**：跟敌过牌明显高于 decide（early 68.3% vs 47.0%，mid 66.0% vs 56.2%）；早盘领出偏 fullhouse 37.5% vs 22.5%，领 single 仅 6.6% vs 17.2%；拆炸领出极少（0.2% vs 0.5%）；一手能出完却没出完 0。
- **回顾（同节既有）**：盲残局 Bamboo27 frozen-real3 **98/120 (81.7%)** vs decide 106/120；frozen-real4 **105/120 (87.5%)** vs decide 108/120。20 副试点（seed0=7000000 matchLen=5）：胜 20%、净升级 −1.800、双上 0/被双上 10、兜底 0、分歧 55.7%、p50 7.4s / p95 42s。
- **结论 / 建议**：200 副 CI 远低于 50% 且级差 CI 全负 → StartLux-27B **不宜作主 bot / 不宜作对局玩家**；继续以 **decide 为主 bot**。StartLux 暂无稳定对局 niche（过牌偏多、被双上严重）。**Jev 仍保留提示/审计**（不做主 bot）。未改 decide；未发布；未开第二擂台。

## r11 跟敌管/不管（10-20）
- 10-20 16:20：核对 policy == backups/post-selfplay-r10（一致）。备份 → backups/pre-selfplay-r11/{policy,engine,play,scripts,selfplay(代码+PROGRESS+diag),test.tar.gz,update-gh-pages.sh}。
- 10-20 16:22：快照：selfplay/diag/r11-snap.mjs（sl27-arena200 ckpt + startlux27 缓存复现，STARTLUX_NO_API=1，无 API 调用）→ cache/r11-snap/<cfg>_<seed>.bin；只存 rel=enemy 且 StartLux≠decide 的局面（含两边着法 ids）。nohup selfplay/diag/r11-snap.sh（6 进程，可续跑）。
- 10-20 16:31：快照完成 1476 个（ok 1453，23 个复现分岔剔除）。MC：selfplay/diag/r11-mc.mjs --k=40（worker snapmc 支持 task.snapDir；r9-pos loadSnap(id, dir)），decide(current=r10) 续打，同 r9 种子；nohup → logs/r11-mc.log，ckpt logs/r11-mc-ckpt.jsonl，结果 logs/r11-mc.jsonl。预计 ≈70min。
- 10-20 17:58：续接；MC 进行中（pid 885097，260/364 @17:53，日志实际在 selfplay/logs/）。编写聚类脚本 diag/r11-cluster.mjs（读 ckpt 或 out + 快照 meta）。
- 10-20 18:25：MC 完成 1453（logs/r11-mc.jsonl；差值 = StartLux − decide，每局面 k=40）。聚类（diag/r11-cluster.mjs → logs/r11-cluster.txt）：
  - decide 压/SL 过 n=1173：SLΔ −0.140 ±0.024（SL 显著优 34 / 劣 146）→ decide 对；三带二 n=94 −0.275、mid/late 更明显。
  - decide 压/SL 换另一手压 n=215：−0.079 ±0.051。
  - **decide 过/SL 普通牌压 n=21：+0.408 ±0.221（显著优 7 / 劣 1）**——唯一显著聚类：跟敌三带二 9 例（+0.41；decide 最好的天然三带二仅比过低 ~1 分），跟敌单 12 例（+0.41；出牌敌 3–5 张的 5 例 4 正）。
  - decide 过/SL 炸 n=33：+0.122 ±0.184（敌 3–5 张为主，不显著）；decide 炸/SL 不炸 n=10：≈0。
- 10-20 18:27：候选写入 policy/index.js（R7 开关默认 1）：c1 **fhFollow**（R11_FHF：跟敌三带二、敌≥3、天然不拆炸不带级牌/王的三带二 +8）；c2 **stopMidShort**（R11_SSH：跟敌单、出牌敌 3–5 张、有不用逢人配的普通单 → 过 −25）。快照复核（diag/r11-flip.mjs）：c1 改 14 例（pass→beat 7 例平均 +0.25，另 9 例换同型三带二），c2 改 4 例全部 → SL 着法（平均 +0.79），其它不变。
- 10-20 18:29：A/B nohup /tmp/gd-ab11/run-ab11.sh（代码快照拷贝）→ logs/ab-r11-1.log，各 4000 副进贡 vs post-selfplay-r10：c1 seed0=8000000、c2 seed0=8100000，ckpt /tmp/gd-ab11/ck-*.jsonl。
- 10-20 18:42：A/B 结果（logs/ab-r11-1.log）：c1 fhFollow **+0.017 [−0.017, 0.051]** 胜 50.4%，双上 550/548，违例 0；c2 stopMidShort **+0.015 [−0.009, 0.040]** 胜 50.0%，双上 585/551，违例 0。均 CI 含 0。加跑合并 c1+c2 4000 副 seed0=8200000（同快照目录，logs/ab-r11-2.log）。
- 10-20 18:57：合并 c1+c2 A/B（logs/ab-r11-2.log，4000 副 seed0=8200000）：**−0.001 [−0.044, 0.043]** 胜 50.0%，双上 578/571，违例 0。合并无增益（c1 +0.017、c2 +0.015 均 CI 含 0；三组合计约 +0.01，非显著）→ **r11 撤销**：policy/index.js 恢复为 backups/pre-selfplay-r11（= post-selfplay-r10，R11 开关已移除；候选代码另存 /tmp/gd-ab11/index.r11-candidate.js）。policy 未变 → 不跑回归、不发布，线上缓存 id 保持 r10。

## r12 敌剩 3–5 张该不该炸（10-20）
- 10-20 19:46：核对 policy == backups/post-selfplay-r10（一致）。备份 → backups/pre-selfplay-r12/{policy,engine,play,scripts,selfplay(代码+PROGRESS+diag),test.tar.gz}。
- 10-20 19:46：快照脚本 selfplay/diag/r12-snap.mjs（decide 自对局，进贡 matchLen=8，比赛种子 9000000+0..69；条件：跟敌（上一手=敌）、有能压的炸、某敌剩 3–5 张）→ cache/r12-snap/r12_<dealSeed>.bin（含 decide/炸(decide 打分最高炸，否则最便宜)/普通压/过 着法与特征）。nohup selfplay/diag/r12-snap.sh（7 进程，m*.done 续跑）。试跑 1 场 = 42 个局面。
- 10-20 19:49：快照完成：70 场比赛 → **2347 个局面**（decide 选 过 1452 / 炸 483 / 普通压 412）。MC：selfplay/diag/r12-mc.mjs --k=100（着法 decide/bomb/pass/normal 去重，alias 记录；decide=current=r10 续打，同 r9 种子，共同随机数）；nohup → logs/r12-mc.log，ckpt logs/r12-mc-ckpt.jsonl（重跑即续），结果 logs/r12-mc.jsonl。预计 ≈2h。
- 10-20 19:54：聚类脚本 selfplay/diag/r12-cluster.mjs（读 out 或 --ckpt；Δ=炸−过 配对，局面间 95%CI；另有 普通压−过、炸−普通压）。MC 进行中，早期 84 个：decide 过 n=57 炸−过 +0.20 [0.07,0.33]。
- 10-20 20:22：MC 进行中 86/587 批（实际 ≈2.4 批/分，预计总 ≈4h）。
- 10-20 20:37：续接；MC 仍在跑 131/587 批（ckpt），部分聚类 528 个局面：decide=过 n=321 炸−过 +0.130 [0.073,0.188]（太保守迹象），decide=炸 n=102 +0.109 [0.007,0.210]，decide=普通压 n=105 −0.112 [−0.237,0.013]。等 MC 完成。
- 10-20 21:26：续接；MC 仍在跑 340/587 批（pid 954864）。等待完成。
- 10-20 22:08：MC 进行中（≈460/587）。部分 1384 局面聚类：decide=过 n=835 炸−过 +0.164 [0.131,0.197]；其中 eL4 +0.144、eL5 +0.221 显著，eL>5 +0.043 不显著；对家 1–5 张 −0.079 不显著（不该改）。过 的局面中 bomb 被 filters 禁止 vs 被打分压下（saveBomb −150）两类都显著为正。
- 10-20 22:08：候选（默认关，env 开关）：
  - c1 R12_SB（policy/index.js saveBomb）：敌最少 ≤5 张、对家不在 1–5 张 → 不扣 saveBomb −150。
  - c2 R12_SO（policy/filters.js L208 勿炸小牌）：跟敌、敌最少 3–5 张、对家不在 1–5 张 → 不禁止。
  - 翻转脚本 selfplay/diag/r12-flip.mjs（按 MC 值估 Δ，样本内）。部分 ckpt 1856 局面：开关全关 0 翻转；c1 翻 422（过→炸 420）meanΔ +0.210 [0.169,0.252]；c2 翻 15 +0.233 [−0.03,0.50]；c1+c2 翻 541 +0.188 [0.151,0.225]，每局面 +0.055。
- 10-20 22:20：regress-all（开关全关，OUTDIR=selfplay-audit/r12-off）= r10 基线（dev-r6 143、dev-follow 143、dev-lead 146、dev-real 119、cases 50、pairs 60、holdout 62/58/56/55、real3 107、real4 108）。初版 c1 退步（R119/F004/F149/d040/h03b/u019：gold=过，均为我 ≤12 张、对家 6–12），c2 real4 −1（u113）。→ 两候选都收窄加「我 ≥13 张」（MC：过 n>12 炸−过 +0.194 最强）。收窄后 c1+c2 regress-all 全部 = 基线，0 退步。
- 10-20 22:20：收窄后翻转（ckpt 1924 局面）：c1 翻 274（过→炸 273）+0.241 [0.188,0.294]；c2 翻 11 +0.301 [0.016,0.586]；c1+c2 翻 348 +0.211 [0.164,0.258]，每局面 +0.038（样本内）。
- 10-20 22:20：A/B 代码快照 /tmp/gd-ab12（tar 复制，policy 与主库字节一致），nohup /tmp/gd-ab12/run-ab12.sh → logs/ab-r12.log：c1 seed0=8300000、c2 8400000、c12 8500000，各 4000 副 vs post-selfplay-r10，进贡 matchLen=8，ckpt /tmp/gd-ab12/ck-*.jsonl（重跑续）。初版快照的 A/B 已中止重启。
- 10-20 22:55：**MC 完成** 2347 局面（logs/r12-mc.jsonl，聚类全文 logs/r12-cluster-final.txt）。炸−过（升级分/副，95%CI）：decide=过 n=1452 **+0.160 [0.134,0.185]**；decide=炸 n=483 +0.126 [0.076,0.176]；decide=普通压 n=412 −0.006 [−0.062,0.050]。decide=过 按出牌敌张数：eL3 n=42 +0.388 [0.201,0.575]、eL4 n=494 +0.151 [0.108,0.194]、eL5 n=622 +0.203 [0.165,0.242]、eL>5 n=294 +0.051 [−0.003,0.104]。按对家张数（过）：p0 +0.031 [−0.009,0.072]、p1-5 −0.115 [−0.235,0.004]、p6-12 +0.173 [0.122,0.224]、p>12 +0.267 [0.230,0.305]。按我张数（过）：n≤6 −0.065 [−0.216,0.087]、n7-12 +0.088 [0.043,0.133]、n>12 +0.204 [0.173,0.235]。另：普通压−过 在 decide=普通压 各 eL 均显著为正；炸−普通压 在 decide=普通压 显著为负（普通压比炸好，普通压选择正确）。
- 10-20 22:48：**A/B 完成**（logs/ab-r12.log，vs post-selfplay-r10，各 4000 副进贡）：
  - c1 R12_SB（seed0=8300000）：**+0.029 [−0.016, 0.074]**，胜 51.3% [50.2–52.4]，双上 548/554，违例 0
  - c2 R12_SO（seed0=8400000）：**+0.007 [−0.006, 0.020]**，胜 50.1% [49.9–50.4]，双上 588/576，违例 0
  - c12（seed0=8500000）：**+0.014 [−0.041, 0.069]**，胜 51.3% [50.0–52.7]，双上 580/622，违例 0
  → 三者净升级 CI 下界均 <0 → **全部撤销**。policy/filters.js、policy/index.js 恢复为 backups/post-selfplay-r10（policy/*.js 逐字节一致已核对）；候选代码存 backups/r12-rejected-candidates/。未发布，线上缓存不变（仍为 r10）。
- 结论：MC（单局面、decide 续打）显示过→炸 +0.16，但整局 A/B 只有 +0.01~0.03 且不显著——单点收益被后续少一炸抵消/MC 续打偏差。剩余思路：c1 用更多副数（12000）复核（胜率 CI 已 >50%）；只开 eL3 / 出牌=下家 的更窄版本；MC 续打改为两手 lookahead 估炸弹机会成本。

## r13 c1 加长 + 窄版 c3（敌恰 3 张）+ 网页对局记录导出（10-21，Asia/Shanghai）
- 10-21 10:25：核对 policy == backups/post-selfplay-r10。备份 → backups/pre-selfplay-r13/{policy(r10),play(旧导出),engine,scripts *.sh,PROGRESS.md}。
- c1 加长（R12_SB=1，代码快照 /tmp/gd-ab12，runner /tmp/gd-ab13/run-c1x.sh，log logs/ab-r13-c1x.log）：seed0=8300000 deals=12000，复用 r12 的 250 场 ckpt（种子 8300000..8300249 同 key，续跑 500 场）→ **+0.019 [−0.007, 0.046]**，胜 51.3% [50.7–52.0]，双上 1707/1761，违例 0 → CI 下界 <0，**不保留**。
- c3 阈值（logs/r12-cluster-recs.json，decide=过）：eMin=3 n=124 +0.070 [−0.027,0.167]；eMin3 且对家>5 n=57 +0.197；**eMin3 对家>5 我≥13 n=38 +0.332 [0.110,0.554]** → 采用该阈值。实现：filters.js L208「勿炸小牌」在 R13_C3 条件下不禁止（index.js saveBomb 本就只在敌≥4 生效，故 c3 只动 L208）。其余被挡原因：L242（有不拆炸普通牌可压；MC 普通压 多数优于炸 → 不动）、L248（出牌敌≥6，Δ≈0 → 不动）。翻转（样本内 2347 局面）：9 个，meanΔ +0.336 [−0.009,0.680]，每局面 +0.0013。
- c3 回归：regress-all（R13_C3=1，OUTDIR=selfplay-audit/r13-c3）全部 = r10 基线（dev-r6 143、dev-follow 143、dev-lead 146、dev-real 119、cases 50、pairs 60、holdout 62/58/56/55、real3 107、real4 108）。npm test R13_C3=1：并行跑在 A/B 高负载下 440/442（仅 perf 计时 81.9ms>80、150ms>120）；空闲时串行 `npm test -- --test-concurrency=1` R13_C3=1 与基线均 **442/442**。
- c3 A/B（/tmp/gd-ab13/chain-c3.sh，代码快照 /tmp/gd-ab13/code，log logs/ab-r13-c3.log）：12000 副 seed0=8600000 进贡 matchLen=8 vs post-selfplay-r10 → **+0.006 [−0.003, 0.016]**，胜 50.2% [49.9–50.4]，双上 1687/1670，违例 0 → **不保留**。
- 决定：c1、c3 均不过 keep rule → policy 恢复 r10（policy/*.js 与 backups/post-selfplay-r10 逐字节一致已核对）；候选代码存 backups/r12-rejected-candidates/filters.r13-c3.js。
- Task B 网页导出修复：原 bug = iOS 上 `.jsonl` 文件 canShare 失败 → 退回 `navigator.share({title:'掼蛋标记', text})`，目标 App 只存下标题（12 字节）。改动：
  - play/core.js：`g.history` 存每副（发牌、进贡/还贡、出牌记录、结果）；新增 `archiveDeal / gameLogRows / gameLogJsonl`。JSONL：1 行 `type:game`，每副 `type:deal`，每一手 `type:move`（handBefore、table{previous,trickMeta,counts,playedCards,leading}、handsAll、coach 建议+理由、实际 move、same、flagged），末尾 `type:flag`（原标记用例格式）。
  - play/ui.js：「分享/导出对局记录」：只传文件 `navigator.share({files})`（.jsonl→不行改 .txt 扩展名，内容仍 JSONL）；不支持则直接下载 + 复制到剪贴板，再不行弹可复制文本框。「下载对局记录」同样导出整场。本副结束弹窗加「导出记录」按钮。整场记录存 localStorage `gd_lastgame`（每副结束/标记/切后台/新比赛前），新比赛还没出牌时导出上一场。
  - test/gamelog.test.js（新增）；WebKit iPhone 13 无头测试（/tmp/pw/export-test.mjs）：分享文件 keys=[files]、2 副 82 手四家全有手牌/教练/桌面、标记 1；新比赛后仍导出上一场；无 share 时下载 .jsonl；errs 空。webkit-smoke 通过（仅预期 /api/status 404）；play/smoke SMOKE OK；串行 npm test 442/442。
- 10-21 11:20：发布（scripts/update-gh-pages.sh；publish-gh-pages.sh 仅用于首次建库，仓库已存在会 exit 2）→ 线上缓存 **guandan-play-10df9ce45d**（旧 e103d06c66），已 curl 核对。policy 仍为 r10。
- 10-21 18:20：**修 bug：还贡不能还级牌**（打 4 时 ♦4 曾可还）。engine/tributeStd.isReturnEligible 排除 rank==级牌（任何花色）；兜底不变（最小非逢人配，J…A 先于级牌）。policy/*.js 代码未改（仅 tribute.js 注释）。验证：regress-all（OUTDIR=return-level-fix）= r10 基线；串行 npm test 447/447；play smoke OK；arena current vs post-selfplay-r10 1008 副 tribute matchLen=8 seed0=8900000 → −0.012 [−0.042, 0.019]，违例 0（logs/arena-return-level-fix.log）。备份 backups/pre-return-level-fix/。发布 → 缓存 guandan-play-9e23943345。

## r14 修正 A：敌在快走时更积极压/炸（10-23，Asia/Shanghai）
- 备份 backups/pre-selfplay-r14。实现 GD_R14（ctxFor.recentShed + filters.r14Hot；bit1 过牌 −35，bit2 不扣 saveBomb、放开 L208/L248）。MC（r14-snap 1645 个局面，跑完 248 个，k=60）：放宽炸弹 +0.28 [0.21,0.36]；过牌扣分 +0.25（不显著）。
- A/B（4000 副，进贡）：v1 +0.057 [0.006,0.107]；v2 +0.386 [0.321,0.450]；v3 +0.446 [0.384,0.508]，但 regress 退步 16 题 → 收窄成 v4（敌 ≤5 时需我 ≥13 张；快速出牌/领跑要求敌 ≥6 张）。v4：+0.444 [0.374,0.514]，胜 62.9%，违例 0；regress = 基线；串行 npm test 447/447。
- 保留并发布 → 缓存 guandan-play-1bd2982aea。post 备份在 backups/post-selfplay-r14。报告 reports/r14.md。

## r15–r18（10-24，America/Toronto）—— 见 reports/r15-r18.md
- r15 顺子 vs 炸（GD_R15）：MC +0.23，A/B v3 −0.022 [−0.059,0.015]、v1 +0.003 [−0.015,0.020] → 拒绝。
- r16 最小三张跟牌（GD_R16）：12000 副 +0.009 [−0.026,0.043] → 拒绝。
- r17 r14 边界子区（GD_R17）：炸弹版回归退步 5 题；只扣过牌版 12000 副 +0.004 [−0.004,0.012] → 拒绝。
- r18 UI：分歧提示加 decide 分差阈值 12（play/core.js、ui.js，test/coachgap.test.js）→ 保留。npm test 449/449，回归 = r14。policy 与 post-selfplay-r14 逐字节一致。
- 构建缓存 guandan-play-9db4f27906，**未发布**（gh token 无效）；线上仍为 1bd2982aea。

## r19 (2026-10-24)
F endgame search rejected (12000-deal A/B +0.001 [-0.012,0.013]); G bomb-to-seize rejected (A/B -0.011, d025 regress). Reason-text + export build fixes kept; live guandan-play-f603094967. See reports/r19.md.

## r20 (2026-10-25)
GD_R20=15 kept (counter-bomb after enemy bomb, RJ over BJ, keep Q+ triple+wild bomb in short hand, don't overtake partner ≤2 cards): A/B 12000 +0.038 [0.008,0.068]; regress = baseline; npm test 457/457. bit16 (block next seat, move 6) A/B −0.060 → rejected. UI gap threshold 6 + pass/bomb second signal. Live guandan-play-b296184444. See reports/r20.md.

## r21 (2026-10-25)
Rules fix: A acts as 1 (A2345 straight/SF, AA2233, AAA222), no wrap, sequences compare by natural high card (A2345 smallest). GD_R21=1 kept (bomb ranks not counted as pair-seq / long-hand plate structure): A/B 8000 +0.048 [0.003,0.093]; regress = baseline; bit2 opening lone-pair lead flat → off. goOut reason "整手可一次走完"; coach gap now scorable for pass/filtered/exit. npm test 469/469. See reports/r21.md.

## r22 (2026-10-25)
GD_R22=1 shipped (correctness, user overrule): two-play endgame lead weak combo first when the other is a bomb / same-type RJ (game6 n53 RJRJ+66 → 66). A/B 4000 −0.001 [−0.029,0.028] flat; regress = baseline; npm test 472/472. bit2 keep-straight follow (game6 n25) rejected: c2 −0.035, c3 (1+2) 8000 −0.079 [−0.125,−0.033], c6 −0.030. Live guandan-play-79862798ac. See reports/r22.md.

## r23 (2026-10-25)
GD_R23=7 shipped (game7 deal2): bit1 prefer 钢板 over bare triple when both free; bit2 triples out of pair-seq structure so mid-hand can follow small enemy pairs; bit4 pass on mid-high enemy pair to keep near-exit wild bomb. A/B c7 4000 +0.101 [0.035,0.168]; c3 (1+2) +0.064 [0.002,0.126]; bit1/bit4 alone flat. regress = r22-ship; npm test 477/477. Live guandan-play-d063049677. See reports/r23.md.

## r24 (2026-10-25) — game6 n25 keep-straight follow — REJECTED
Root cause: earlyFollowCost treats unique straight ranks as cost-0 orphans (activeFollow:0 +40); spare K is cost-1 and takes −40 orphan-exists hit → coach 10S over user KC (MC +0.480).
Tried narrower-than-r22 rules (v1 hand≥18 any-spare −0.041; v2 endpoint+hand≥20 −0.055; soft −65 −0.065 CI<0; ultra-narrow hand≥22 prev≤9 −0.083 CI<0). All hurt → **do not ship**. GD_R24 default 0 (opt-in bit1=v3). regress = r23-ship; npm test 479/479. Live cache unchanged guandan-play-d063049677. See reports/r24.md + r24-status.md. Open: game6 n25 still.

## r25 (2026-10-26)
GD_R25=1 shipped (correctness, flat): true opening (27 cards) straight top → lead isolated low pair (game5 n1 → 33). A/B 4000 +0.004 [−0.029,0.038]. bit2/bit4 hold whole-hand SF exit when partner busy (n49/n53) −0.012 / −0.009 → rejected (opt-in). regress = baseline; npm test 482/482; smoke fixed (deal cap). Live guandan-play-ab08571131. See reports/r25.md.

## r26 (2026-10-26)
GD_R26=5 shipped (correctness, flat): block-next swap small pair-break single → K/A vs upstream enemy (game4 d2 n6 → KH). A/B c5 +0.004 [−0.014,0.022]; c1 −0.010; c2 wide +0.010. regress = baseline; npm test 484/484. Live guandan-play-5ed1309363. See reports/r26.md.

## r27 (2026-10-26) — REJECTED
earlyFollowCost cost-2 for unique natural-straight members (game6 n25 → KC): A/B c2 −0.098 [−0.168,−0.029], c6 interior −0.066 [−0.128,−0.003]. GD_R27 default 0. Live unchanged guandan-play-5ed1309363. See reports/r27.md.

## 2026-10-26（Asia/Shanghai）r33 — REJECTED
- 还贡最小点/nat≤8：r33_1 +0.029、r33_2 +0.037、r33_3 +0.041、r33_3 T=1 −0.039；非还贡开局领连对/钢板 GD_R33L=1 −0.017、=3（加顺子）+0.005（4000 副，seed0=13300000，CI 全跨 0）。不发布，默认不变，线上仍 guandan-play-f4fbd8041e。报告 selfplay/reports/r33.md

## 2026-10-27（Asia/Shanghai）r34 — REJECTED
- 残局穷举/保同花顺/留控制：bit1 E=4 +0.013、E=5 −0.001、bit2 −0.159（显著负）、bit4 −0.002（4000 副，seed0=13400000）。不发布，GD_R34 默认 0，线上仍 guandan-play-f4fbd8041e。报告 selfplay/reports/r34.md

## 2026-10-27（Asia/Shanghai）r35 — REJECTED
- audit 挖到：炸弹留同点孤张（bit1）、下家敌人≤2张时炸后喂搭档（bit2）。bit1 +0.025 [−0.032,0.083]、bit2 +0.006 [−0.010,0.022]（4000 副，seed0=13500000）。不发布，GD_R35 默认 0，线上仍 guandan-play-f4fbd8041e。报告 selfplay/reports/r35.md

- r37：NOT SHIPPED。bit4 seed 13700000 +0.078 [0.023,0.133]，seed 13710000 +0.024 [−0.029,0.077] 确认失败；b6 +0.050 [−0.009,0.108]。线上仍为 f4fbd8041e。

- r38：NOT SHIPPED。bit1 初测 +0.080 [0.020,0.140]，确认 seed 13810000 +0.027 [−0.028,0.081] 失败；b5（bit1+分差≤60）两种子 +0.008/+0.001 CI 跨 0。GD_R38 默认 0，线上仍 f4fbd8041e。报告 selfplay/reports/r38.md

- r41：REJECTED。晚盘跟敌窗口 GD_R41 bit1 +0.013 [−0.007,0.034]、bit2 +0.000、EN3/M150 +0.010 [−0.005,0.025]（seed 14100000）。默认 0，线上仍 f4fbd8041e。报告 selfplay/reports/r41.md

- r42：REJECTED。进贡花色避同花顺（arena #trib=1）−0.002 [−0.015,0.011]（seed 14200000），触发 7.2% 进贡。默认不变，线上仍 f4fbd8041e。报告 selfplay/reports/r42.md

- r46：REJECTED。r45 邻域 GD_R46 bit1(K=3) +0.036 [−0.004,0.076]；bit2(炸回敌炸) +0.048 [0.015,0.081] / 确认 +0.033 [−0.004,0.070]；bit3 +0.069 [0.024,0.114] / 确认 +0.007 [−0.042,0.057]。默认 0，线上仍 ff87161306。报告 selfplay/reports/r46.md

- r47：REJECTED。A：GD_R46=2 8000 副 +0.013 [−0.011,0.038]（14700000）。B：GD_R47 非炸压牌走完 bit1 −0.004 [−0.031,0.022]、bit2 +0.020 [−0.043,0.083]（4000，14720000）。默认 0，线上仍 ff87161306。报告 selfplay/reports/r47.md
- GD_R46=2 8000 副复测 +0.013 [−0.011,0.038]（14700000）未过；新试 GD_R47 跟敌非炸压牌后≤K手 bit1 −0.004、bit2 +0.020（4000 副，CI 跨 0）。不发布，线上仍 guandan-play-ff87161306。报告 selfplay/reports/r47.md

## 2026-10-27（Asia/Shanghai）r50 — SHIPPED bit3 M300
- GD_R50 默认 3、M=300（下家敌出、对家上家已过 → 分差≤300 非炸同型压住）。双种子 +0.073 [0.008,0.137]（15000000）/ +0.108 [0.049,0.168]（15010000）；bit1 M300/600/2000 均贴边 lo≈−0.002。改 8 条金标 过→压；regress-all = 旧基线。线上缓存 guandan-play-77674f9e11。报告 selfplay/reports/r50.md

## 2026-10-27（Asia/Shanghai）r56 — REJECTED
- 对家剩 1–2 张领小对/单喂对家 GD_R56 bit1 +0.008 [−0.009,0.024]、bit2 +0.010 [−0.008,0.028]（4000 副，seed 15600000）。默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r56.md

## 2026-10-27（Asia/Shanghai）r57 — REJECTED
- 领出任一敌剩 1–2 张避其可接型 GD_R57 bit1 −0.001 [−0.029,0.028]、bit2（敌≤3 张避单对）+0.007 [−0.032,0.046]（4000 副，seed 15700000）。默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r57.md

## 2026-10-28（Asia/Shanghai）r62 — REJECTED
- r50/r45 邻域正交 GD_R62：bit1 −0.003、bit2 −0.015、bit4 −0.013、bit8 +0.002、bit16 −0.017、bit32 −0.005、bit64 +0.006（4000 副，seed 16200000，CI 全跨 0 或 lo≤0）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r62.md

## 2026-10-28（Asia/Shanghai）r63 — REJECTED
- 新鲜正交 GD_R63：bit1 −0.066、bit2 −0.005、bit4 +0.009、bit8 −0.004、bit16 −0.008、bit32 −0.005、bit64 −0.002（4000 副，seed 16300000，CI 全跨 0 或 lo≤0）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r63.md

## 2026-10-28（Asia/Shanghai）r64 — REJECTED
- 新鲜正交 GD_R64：bit1 −0.002、bit2 −0.001、bit4 −0.003、bit8 −0.010、bit16 −0.003、bit32 −0.009、bit64 +0.005（4000 副，seed 16400000，CI 全跨 0 或 lo≤0）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r64.md

## 2026-10-27（America/Toronto）r65 — REJECTED
- 新鲜正交 GD_R65：bit1 +0.008、bit2 −0.011、bit4 +0.001、bit8 +0.002、bit16 −0.004、bit32 −0.008、bit64 −0.002（4000 副，seed 16500000，CI 全跨 0 或 lo≤0）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r65.md

## 2026-10-27（America/Toronto）r66 — REJECTED
- 新鲜正交 GD_R66：bit1 −0.007、bit2 −0.016、bit4 −0.026、bit8 −0.063、bit16 +0.033、bit32 +0.015、bit64 −0.009（4000 副，seed 16600000，CI 全跨 0）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r66.md

## 2026-10-27（America/Toronto）r67 — REJECTED
- 新鲜正交 GD_R67：bit1 +0.056、bit2 +0.040、bit4 +0.029、bit8 −0.041、bit16 −0.061、bit32 −0.067、bit64 −2.062（4000 副，seed 16700000，无 CI lo>0）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r67.md。

## 2026-10-28（America/Toronto）r68–r75 — 见 selfplay/reports/r68.md…r75.md（均未发布）

## 2026-10-28（America/Toronto）r76 — REJECTED
- 敌头游后 2v1 GD_R76：bit1 +0.002、bit2 −0.017、bit4 +0.049 [−0.006,0.103]、bit8 +0.008（4000 副进贡，seed 17600000，无 CI lo>0）。不跑第二种子，不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r76.md。

## 2026-10-28（America/Toronto）r77 — REJECTED
- 1v1 残局 GD_R77：bit1 −0.014、bit2 −0.012、bit3 −0.021、bit4 −0.033（4000 副进贡，seed 17700000，无 CI lo>0）。不跑第二种子，不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r77.md。已穷尽 1v1。

## 2026-10-28（America/Toronto）r78 — REJECTED
- 1v2 残局 GD_R78：bit1 +0.039 [−0.000,0.078]、bit2 +0.009、bit4 −0.039、bit7 −0.012（4000 副进贡，seed 17800000，无 CI lo>0）。不跑第二种子，不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r78.md。残局座位轴（2v1/1v1/1v2）全穷尽。

## 2026-10-28（America/Toronto）r79 — REJECTED
- 自创正交轴「长型牌（顺子/钢板）攻防」（避开 r50–r78 穷尽簇含残局 1v2/1v1/2v1、三带二/连对跟、单对喂拦）。GD_R79 默认 0：bit1 跟敌顺子/钢板首选过→非炸压（分差≤300）、bit2 同上仅任一敌≤12 张、bit4 领出首选单/对时改出不增余手的长型（分差≤150）、bit7。首种子 17900000，基线 backups/r79-base，脚本 /tmp/run-r79-ab.sh，日志 selfplay/logs/ab-r79-*。
- 结果：bit1 +0.015 [−0.050,0.079]；bit2 +0.032 [−0.005,0.069]；bit4 −0.037 [−0.107,0.032]；bit7 −0.022 [−0.097,0.053]。无 lo>0，未跑第二种子，未发布。长型牌邻域穷尽。见 reports/r79.md。

## 2026-10-28（Asia/Shanghai）r80 — REJECTED
- 炸弹选型 GD_R80：bit1 −0.050 显著负；bit2 −0.012；bit4 首种子 +0.077 [0.027,0.128]、确认 +0.006 [−0.032,0.045] 跨0；bit7 −0.009。未双过 keep，不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r80.md。炸弹选型邻域穷尽。

## 2026-10-28（Asia/Shanghai）r81 — REJECTED
- 还贡花色/同花顺潜力 GD_R81（#ret）：bit1 +0.034 [−0.004,0.072]、bit2 +0.005、bit4 −0.001、bit5 +0.025（4000 副，seed 18100000，无 lo>0）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r81.md。还贡花色邻域穷尽。

## 2026-10-28（Asia/Shanghai）r82 — REJECTED
- 同型牌实现选择 GD_R82：bit1 −0.088 显著负、bit2 +0.008、bit4 −0.017、bit5 −0.123 显著负（4000 副，18200000，无 lo>0）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r82.md。同型实现邻域穷尽。

## 2026-10-28（Asia/Shanghai）r83 — REJECTED
- 出牌花色保 SF GD_R83：bit1 −0.058、bit2 −0.140、bit4 −0.551、bit5 −0.565（均显著负，18300000）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r83.md。出牌花色 SF 邻域穷尽。

## 2026-10-28（Asia/Shanghai）r84 — REJECTED
- 贴边分差改过 GD_R84：bit1 −1.147、bit2 −1.511、bit4 −1.697、bit5 −1.915（均惨败，18400000）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r84.md。禁再试软过/贴边改过。

## 2026-10-28（Asia/Shanghai）r85 — REJECTED
- 明牌计数安全换手 GD_R85：bit1 +0.011、bit2 −0.656、bit4 −0.093、bit5 −0.089（18500000，无 lo>0）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r85.md。禁再试 safety/winProb 贴边换手。

## 2026-10-28（Asia/Shanghai）r86 — REJECTED
- 对家甩牌加速配合/敌慢甩牌（recentShed） GD_R86：bit1 −0.047、bit2 −0.035、bit4 +0.035、bit5 −0.021（4000 副进贡，seed 18600000，无 CI lo>0）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r86.md。recentShed 邻域穷尽。

## 2026-10-28（Asia/Shanghai）r87 — REJECTED
- 跟敌最小同型压 GD_R87：bit1 −0.294、bit2 −0.065、bit3 −0.389、bit4 −0.013（4000 副进贡，seed 18700000，无 CI lo>0）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r87.md。最小压邻域穷尽。

## 2026-10-28（Asia/Shanghai）r88 — REJECTED
- 对家牌后顶防下家中短手 GD_R88：bit1 +0.027、bit2 −0.038、bit3 −0.048、bit5 −0.026（4000 副进贡，seed 18800000，无 CI lo>0）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r88.md。对家后顶穷尽。

## 2026-10-28（Asia/Shanghai）r89 — REJECTED
- 记牌领出控权 GD_R89：bit1 +0.017、bit2 +0.011、bit5 +0.030、bit9 +0.007（4000 副进贡，seed 18900000，无 CI lo>0）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r89.md。记牌控权穷尽。

## 2026-10-28（Asia/Shanghai）r90 — REJECTED
- 领出顺子减手 GD_R90：bit1 −0.537、bit3 −0.644、bit5 −0.561、bit9 −0.379（均显著负）（4000 副进贡，seed 19000000，无 CI lo>0）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r90.md。领出顺子穷尽。

## 2026-10-28（Asia/Shanghai）r91 — REJECTED
- 领出同型最小点先走 GD_R91：bit1 −0.166、bit3 −0.744、bit5 −0.083、bit9 −0.113（均显著负）（4000 副进贡，seed 19100000，无 CI lo>0）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r91.md。同型最小点穷尽。

## 2026-10-28（Asia/Shanghai）r92 — REJECTED
- 领出单改对 GD_R92：bit1 −0.274、bit3 −1.055、bit5 −0.242、bit9 −0.094（均显著负）（4000 副进贡，seed 19200000，无 CI lo>0）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r92.md。领出结构改写整体穷尽。

## 2026-10-29（Asia/Shanghai）r93 — REJECTED
- 跟敌贴边改压（结构不劣） GD_R93：bit1 +0.005、bit3 −0.017、bit5 −0.018、bit9 −0.016（4000 副进贡，seed 19300000，无 CI lo>0）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r93.md。贴边改压/r84 镜像穷尽。

## 2026-10-29（Asia/Shanghai）r94 — REJECTED
- 省炸「跟敌小牌不炸」GD_R94：bit1 −0.160 [−0.232,−0.088]、bit3 −0.181 [−0.254,−0.109]、bit5 −0.025 [−0.091,0.041]、bit9 −0.112 [−0.188,−0.036]（4000 副进贡，seed 19400000，无 lo>0）。不发布，默认 0，线上仍 guandan-play-77674f9e11。报告 selfplay/reports/r94.md。跟敌省炸邻域穷尽。

## 2026-10-29（Asia/Shanghai）r95 — SHIPPED（GD_R95=5）
- 跟敌压牌按 handplan 成本选 GD_R95：bit1 −0.025、bit3 +0.008、**bit5 +0.091 [0.017,0.164]**（seed 19500000）、bit9 +0.018；bit5 复核 seed 19510000 **+0.084 [0.016,0.151]**。默认改 GD_R95=5（M=150、D=0.2、候选含过）。线上 guandan-play-90568fce7f。报告 selfplay/reports/r95.md；基线 backups/r95-base。

## 2026-10-28（America/Toronto）r96 — REJECTED
- 领出按 handplan 成本选 GD_R96（vs r96-base，含 GD_R95=5）：bit1 +0.029 [−0.030,0.088]、bit3 +0.034 [−0.017,0.086]、bit5 −0.004 [−0.057,0.049]、bit9 +0.030 [−0.019,0.080]（4000 副进贡，seed 19600000，无 lo>0，不跑第二种子）。不发布，默认 0，线上仍 guandan-play-90568fce7f。报告 selfplay/reports/r96.md。领出 handplan 穷尽。

## 2026-10-28（America/Toronto）r97 — REJECTED
- 非炸出牌省逢人配/级牌王 GD_R97（vs r97-base）：bit1 −0.004、bit3 −0.005、bit7 +0.035、bit11 −0.061（显著负）（4000 副进贡，seed 19700000，无 lo>0）。默认 0，线上仍 guandan-play-90568fce7f。报告 selfplay/reports/r97.md。

## 2026-10-28（America/Toronto）r98 — REJECTED
- 收官先出难压的 GD_R98（vs r98-base）：bit3 −0.178、bit5 −0.430、bit7 −0.528、bit13 −0.432（均显著负）（seed 19800000，无 lo>0）。默认 0。报告 selfplay/reports/r98.md。

## 2026-10-28（America/Toronto）r99 — REJECTED
- GD_R99：bit1 −0.070、bit3 −0.163、bit5 −0.075、bit9 −0.015（seed 19900000，无 lo>0）。默认 0，线上仍 guandan-play-90568fce7f。报告 selfplay/reports/r99.md。

## 2026-10-28（America/Toronto）r100 — REJECTED
- 敌短手顶大压 GD_R100（vs r100-base）：bit1 −0.015 [−0.069,0.038]、bit3 −0.086、bit5 −0.137、bit7 −0.135（后三者显著负）（4000 副进贡，seed 20000000，无 lo>0）。默认 0，线上仍 guandan-play-90568fce7f。报告 selfplay/reports/r100.md。敌短手顶大压穷尽。

## 2026-10-28（America/Toronto）r101 — REJECTED
- 对家短手让路 GD_R101（默认 0）：跟敌非炸、对家余牌≤6 且我余牌>6，首选非炸非走完压且主点≥A 时，分差≤M 内有过 → 改过（跳过 r95PlanBeat）。bit1 S=6 M=500；bit2 M2=1500；bit4 不限主点；bit8 仅出牌敌为上家。基线 backups/r101-base（不含 r101 块，含 GD_R95=5）。smoke 48 副 seed 20190000：GD_R101=0 Δ=0；触发 bit1 12 / bit3 16 / bit5 47 / bit7 40 / bit9 5。跑 bit1/3/5/7，seed 20100000，4000 副 tribute matchLen=8，脚本 /tmp/run-r101-ab.sh，日志 selfplay/logs/ab-r101-*，18:45 开跑。
- 结果（ALL_DONE 2026-10-29 08:42 EDT）：bit1 Δ −0.189 [−0.256, −0.122] 46.2%；bit3 −0.145 [−0.217, −0.074] 47.1%；bit5 −0.286 [−0.356, −0.216] 45.0%；bit7 −0.300 [−0.370, −0.230] 44.6%。无 lo>0、四条显著负 → 不跑第二种子、不发布，REJECTED。GD_R101 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r101.md。已穷尽：对家短手让路。

## 2026-10-30（Asia/Shanghai）r102 — REJECTED
- 跟敌拆组压→换不拆 GD_R102（默认 0）：跟敌非炸单张（bit4 含对子），首选非炸非走完压牌且主点手中张数多于压牌张数（拆对/拆三、不含逢人配）时，分差≤M 内有主点张数恰等的非炸压 → 改用；bit8 无则改过（跳过 r95PlanBeat）。bit1 M=300；bit2 M2=900；bit4 含对子；bit8 改过兜底。基线 backups/r102-base（不含 r102 块，含 GD_R95=5）。
- smoke 48 副 seed 20290000（须串行跑：并行时 arena 结果受 CPU 争用影响、首次并行加载 .versions 亦有竞态）：GD_R102=0 Δ=0；触发 bit1 18 / bit3 19 / bit5 15 / bit7 23 / bit13 100 / bit15 56。
- 先试过「上家出牌、下家敌短手不放」（过→压），48 副触发仅 3（放开 S=27/M=∞ 也只 23）→ 弃用未跑 A/B。
- 跑 bit1/3/5/7，seed 20200000，4000 副 tribute matchLen=8，脚本 /tmp/run-r102-ab.sh，日志 selfplay/logs/ab-r102-*，2026-10-30 07:23（UTC+8）开跑。
- 结果（ALL_DONE 2026-10-30 08:11 UTC+8）：bit1 Δ −0.012 [−0.082, 0.057] 50.2%；bit3 −0.071 [−0.142, −0.000] 49.1%；bit5 +0.014 [−0.054, 0.082] 51.0%；bit7 −0.079 [−0.148, −0.010] 48.9%。无 lo>0 → 不跑第二种子、不发布，REJECTED。GD_R102 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r102.md。已穷尽：跟敌拆组压换不拆。

## 2026-10-30（Asia/Shanghai）r103 — REJECTED
- 记牌顶张夺权 GD_R103（默认 0）：跟敌非炸单/对（bit4 含三张），首选为过且非走完时，分差≤M 内有非炸非走完同型压牌且外面（belief.remainingByRank 未出且不在我手）已无可压它的同型（beaters=0，不计炸）→ 改压夺权（跳过 r95PlanBeat）。bit1 M=300；bit2 M2=900；bit4 含三张；bit8 仅我手≤12。基线 backups/r103-base（不含 r103 块，含 GD_R95=5）。
- smoke 48 副 seed 20390000（串行）：GD_R103=0 Δ=0；触发（stderr 计数有丢失，仅相对参考）bit1 8 / bit3 7 / bit5 3 / bit7 8 / bit9 6。
- 先弃两版（未跑 A/B）：跟敌收官 minPlays≤1 压（触发 0）；跟敌压牌换 minPlays 最少（minPlays 上限 3，触发≈0，且与 r95 重叠）。
- 跑 bit1/3/5/7，seed 20300000，4000 副 tribute matchLen=8，脚本 /tmp/run-r103-ab.sh，日志 selfplay/logs/ab-r103-*，2026-10-30 08:28（UTC+8）开跑。
- 结果（ALL_DONE 2026-10-29 21:14 EDT）：bit1 Δ +0.024 [−0.046, 0.093] 50.3%；bit3 +0.015 [−0.058, 0.087] 50.2%；bit5 +0.074 [−0.001, 0.149] 51.6%；bit7 +0.057 [−0.016, 0.130] 51.3%。无 lo>0（bit5 贴边）→ 不跑第二种子、不发布，REJECTED。GD_R103 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r103.md。

## 2026-10-29（America/Toronto）r104 — 进行中
- 末位拦截 GD_R104（默认 0）：跟敌非炸、出牌敌为下家（对家与另一敌都已过，我过则其直接回手），首选为过（非 r95PlanBeat）时，分差≤M 内有非炸非走完压牌 → 改压分最高者。bit1 M=300；bit2 M2=900；bit4 仅出牌敌余牌≤10；bit8 仅敌出单/对。基线 backups/r104-base（不含 r104 块，含 GD_R95=5）。
- smoke 48 副 seed 20490000（串行）：GD_R104=0 Δ=0；触发（stderr 计数仅相对参考）bit1 8 / bit3 11 / bit5 3 / bit9 10。
- 跑 bit1/3/5/9，seed 20400000，4000 副 tribute matchLen=8，脚本 /tmp/run-r104-ab.sh，日志 selfplay/logs/ab-r104-*，2026-10-29 21:15 EDT 开跑（约 46 分钟）。
- 首种子结果（ALL_DONE 2026-10-29 21:38 EDT）：**bit1 +0.122 [0.050, 0.194] 52.8%**；**bit3 +0.093 [0.027, 0.158] 52.3%**；bit5 +0.022 [−0.034, 0.077] 50.7%；**bit9 +0.067 [0.006, 0.127] 51.6%**。三条 lo>0 → 第二种子 20410000 复核 bit1/3/9（21:39 EDT 开跑）。
- 第二种子结果（ALL_DONE 2026-10-29 21:57 EDT）：bit1 −0.008 [−0.069, 0.053] 50.4%；bit3 −0.003 [−0.062, 0.056] 50.5%；bit9 +0.009 [−0.041, 0.060] 50.7%。

## 2026-10-29（America/Toronto）r104 — REJECTED
- 末位拦截：首种子 20400000 bit1/3/9 lo>0，第二种子 20410000 全部回落跨 0 → 无 bit 双过，不发布。GD_R104 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r104.md。已穷尽：末位拦截改压邻域。

## 2026-10-29（America/Toronto）r105 — 进行中
- 自创正交轴「大牌型跟敌接压」GD_R105（默认 0）：跟敌非炸且敌出顺子/三带二/连对/钢板，首选为过（非 r95PlanBeat）时，分差≤M 内有同型非炸非走完压牌 → 改压分最高者（按牌型门控；异于 r93 结构不劣、r103 记牌单/对/三、r104 末位座位、r47、r61；不动 r95PlanBeat）。bit1 M=300；bit2 M2=900；bit4 仅我手≥10；bit8 仅出牌敌余牌≤12。基线 backups/r105-base（不含 r105 块，含 GD_R95=5）。
- smoke 48 副 seed 20590000（串行）：GD_R105=0 Δ=0；触发 bit1 13 / bit3 9。
- 跑 bit1/3/5/9，seed 20500000，4000 副 tribute matchLen=8，脚本 /tmp/run-r105-ab.sh，日志 selfplay/logs/ab-r105-*，21:59 EDT 开跑。
- 首种子结果（ALL_DONE 2026-10-29 22:29 EDT）：bit1 +0.015 [−0.059, 0.089] 51.1%；bit3 +0.035 [−0.031, 0.102] 51.4%；bit5 +0.005 [−0.066, 0.077] 50.7%；bit9 −0.002 [−0.059, 0.054] 50.2%。

## 2026-10-29（America/Toronto）r105 — REJECTED
- 大牌型跟敌接压：首种子 20500000 四 bit CI 全跨 0 → 不发布。GD_R105 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r105.md。已穷尽：跟敌「过→改压」方向（r93/r103/r104/r105）。

## 2026-10-29（America/Toronto）r106 — 进行中
- 自创正交轴「敌报牌领出避型」GD_R106（默认 0）：领出且首选非炸非走完（非 r95PlanBeat），某敌余牌 n≤N 且首选张数≤n 时，分差≤M 内改领张数 > n 的非炸非走完最高分候选（按敌余牌张数避其可接型；异于 r89–r92/r96/r98 领出改写、r100 跟敌短手顶大）。bit1 M=300、N=1；bit2 M2=900；bit4 N=2；bit8 仅短手敌为下家。基线 backups/r106-base（不含 r106 块，含 GD_R95=5）。
- smoke 48 副 seed 20690000（串行）：GD_R106=0 Δ=0；触发 bit1 3 / bit5 3（稀疏）。
- 跑 bit1/3/5/7，seed 20600000，4000 副 tribute matchLen=8，脚本 /tmp/run-r106-ab.sh，日志 selfplay/logs/ab-r106-*，22:42 EDT 开跑（约 30 分钟）。

## 2026-10-29（America/Toronto）r106 — REJECTED
- 敌报牌领出避型：首种子 20600000 bit1 Δ −0.006 [−0.054, 0.042] 50.0%；bit3 −0.009 [−0.060, 0.041] 49.6%；bit5 −0.004 [−0.053, 0.045] 49.8%；bit7 +0.051 [−0.001, 0.103] 50.6%。无 lo>0（bit7 贴边）→ 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-29 23:04 EDT）。GD_R106 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r106.md。已穷尽：敌报牌领出避型邻域。

## 2026-10-29（America/Toronto）r107 — 进行中
- 自创正交轴「上家敌出、对家可接时让对家」GD_R107（默认 0）：跟敌非炸且出牌者为上家敌，首选为非炸非走完压牌（非 r95PlanBeat）、对家余牌 < 我余牌时，分差≤M 内「过」→ 改过。bit1 M=300；bit2 M2=900；bit4 仅对家≤8；bit8 仅敌主点≤10。基线 backups/r107-base（不含 r107 块，含 GD_R95=5）。
- smoke 48 副 seed 20790000：GD_R107=0 Δ=0；触发 bit1 176/48（密）。
- 跑 bit1/3/5/9，seed 20700000，4000 副 tribute matchLen=8，脚本 /tmp/run-r107-ab.sh，日志 selfplay/logs/ab-r107-*，23:05 EDT 开跑。

## 2026-10-29（America/Toronto）r107 — REJECTED
- 上家敌出让对家改过：首种子 20700000 bit1 Δ −0.473 [−0.543, −0.404] 39.9%；bit3 −0.523 [−0.590, −0.457] 39.1%；bit5 −0.218 [−0.289, −0.147] 45.8%；bit9 −0.189 [−0.266, −0.112] 46.3%。全部显著负 → 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-29 23:39 EDT）。GD_R107 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r107.md。已穷尽：压→改过让对家邻域；压→改过整体（r84/r99/r107）强负。

## 2026-10-29（America/Toronto）r108 — 进行中
- 自创正交轴「敌头游后抢二游：跟剩余敌过→炸」GD_R108（默认 0）：已有敌方出完、对家未出完，跟剩余敌非炸、首选为过（非 r95PlanBeat）时，分差≤M 内有非走完炸弹 → 改炸；bit4 也允许非炸压。bit1 M=300；bit2 M2=900；bit4 也允许非炸压；bit8 仅剩余敌≤8。基线 backups/r108-base（不含 r108 块，含 GD_R95=5）。
- smoke 48 副 seed 20890000（串行）：GD_R108=0 Δ≡0；触发存在。
- 跑 bit1/3/5/9，seed 20800000，4000 副 tribute matchLen=8，脚本 /tmp/run-r108-ab.sh，日志 selfplay/logs/ab-r108-*，23:57 EDT 开跑。

## 2026-10-30（America/Toronto）r108 — REJECTED
- 敌头游后抢二游炸：首种子 20800000 bit1 Δ −0.025 [−0.078, 0.027] 49.6%；bit3 +0.013 [−0.043, 0.069] 50.3%；bit5 −0.004 [−0.057, 0.049] 50.0%；bit9 −0.052 [−0.109, 0.005] 49.3%。无 lo>0 → 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 00:38 EDT / 日志 12:38 CST）。GD_R108 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r108.md。已穷尽：敌头游后炸/抢二游邻域。

## 2026-10-30（America/Toronto）r109 — 进行中
- 自创正交轴「记牌跟敌换控权顶张」GD_R109（默认 0）：跟敌非炸、首选为非炸非走完压牌（非 r95PlanBeat），分差≤M 内其他非炸非走完压牌中，外面（belief.remainingByRank）可压同型点数严格更少者 → 改用最少者。bit1 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅首选 beaters≥2。基线 backups/r109-base（不含 r109 块，含 GD_R95=5）。
- smoke 48 副 seed 20990000（串行）：GD_R109=0 Δ≡0；触发 bit1 68 / bit3 69 / bit5 56 / bit9 124。
- 跑 bit1/3/5/9，seed 20900000，4000 副 tribute matchLen=8，脚本 /tmp/run-r109-ab.sh，日志 selfplay/logs/ab-r109-*，12:49 CST / 00:49 EDT 开跑。

## 2026-10-30（America/Toronto）r109 — REJECTED
- 记牌跟敌换控权顶张：首种子 20900000 bit1 Δ −0.964 [−1.038, −0.890] 34.1%；bit3 −1.038 [−1.111, −0.966] 32.6%；bit5 −0.994 [−1.066, −0.921] 32.6%；bit9 −0.944 [−1.019, −0.868] 34.4%。全部显著负 → 不跑第二种子、不发布，REJECTED（ALL_DONE 2026-10-30 01:17 EDT / 日志 13:17 CST）。GD_R109 默认 0，线上仍 guandan-play-90568fce7f（r95）。报告 selfplay/reports/r109.md。已穷尽：记牌跟敌换控权顶张邻域。

## 2026-10-30（America/Toronto）r110 — 进行中
- 自创正交轴「跟敌压牌减孤张」GD_R110（默认 0）：跟敌非炸、首选为非炸非走完压牌（非 r95PlanBeat），分差≤M 内其他非炸非走完压牌中，压后余牌天然孤张数（非逢人配、同点恰 1 张）严格更少者 → 改用最少者（同少取分高）。bit1 M=300；bit2 M2=900；bit4 仅敌出单/对；bit8 仅首选压后孤张≥2。基线 backups/r110-base（不含 r110 块，含 GD_R95=5）。
- smoke 48 副 seed 21090000（串行）：GD_R110=0 Δ≡0；触发 bit1 39 / bit3 19 / bit5 35 / bit9 15。
- 跑 bit1/3/5/9，seed 21000000，4000 副 tribute matchLen=8，脚本 /tmp/run-r110-ab.sh，日志 selfplay/logs/ab-r110-*，约 13:23 CST / 01:23 EDT 开跑。

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
- 自创正交轴「跟敌压牌后留对更多」GD_R135（默认 0）；正式跑 bit1/3/5/7，seed 23500000，4000 副（启动 15:35 EDT）。
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


## 2026-11-03（America/Toronto）r153 — REJECTED（无触发）
- 跟对家按手牌规划成本选 GD_R153：串行 smoke 全 bit trig=0 → CHAIN_ABORT（2026-11-02 23:56 EST），未跑 4000 副。报告 selfplay/reports/r153.md。GD_R153 默认 0；线上仍 guandan-play-90568fce7f。

## 2026-11-03（America/Toronto）r154 — 进行中
- 自创轴「跟敌首选过→规划成本不升则压」GD_R154（policy/index.js，默认 0）：跟敌非炸、首选过 → 分差≤M 内非炸非走完压牌中压后余牌 decompose 成本 ≤ 原手+D 的最低者改压。bit1 M=300,D=0；bit2 M=900；bit4 仅出牌敌余牌≤10；bit8 D=0.5。
- 预检 b1（48 副 seed 25490000）trig7 Δ+0.521。链 /tmp/chain-r154.sh：串行 smoke bits 0/1/3/5/9 → 4000 副 bits 1/3/5/9，seed 25400000，tribute matchLen=8，sticky GD_R95=5，基线 backups/r154-base；watcher /tmp/watch-r154.sh → /tmp/watch-r154.log；日志 selfplay/logs/ab-r154-*（启动 2026-11-03 01:55 EST）。
