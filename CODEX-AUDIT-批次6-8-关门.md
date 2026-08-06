# CODEX-AUDIT-批次6～8 关门审计

审计日期：2026-08-01  
项目：掼蛋教练 Pro  ；模式：只读  
范围：例 33～47（批次 6/7/8）  
基线：`git pull origin main` 后 `HEAD = origin/main = 00d3d24`，策略 rev35（Cursor 批次 8）。

本次只新增本报告；未修改 `strategy/`、`coach/`、训练 JSON、场景或测试，未 commit/push。

## 1. 摘要

| 批次 | 例号 | 手牌/页码/书摘 | Top1 / golden | 回归与 smoke | 结论 |
|---|---|---|---|---|---|
| 批次 6 | 33～37 | 5/5 PASS | 5/5 PASS；例 36 已为杂色 `Straight/5 → Straight/10` | 28～32 回归 PASS；smoke PASS | **CLOSED** |
| 批次 7 | 38～42 | 5/5 PASS | 5/5 PASS | 同上 | **CLOSED** |
| 批次 8 | 43～47 | 5/5 PASS | 5/5 PASS | 同上 | **CLOSED** |
| 合计 | 33～47 | 15/15 PASS | 15/15 PASS | 全部指定命令退出码 0 | **CLOSED** |

说明：`structure` 场景的正式 golden 是 `scoreCandidate` 的偏序（`prefer < over`），不是无上一手牌时 `getTurnAdvice` 的单一领出 Top1；报告在第 4 节同时列出该诊断值，但不把它误判为策略失败。

## 2. JSON、页码与页图逐例核对

PDF 页码唯一以 `training-samples/case-page-map.json` 为准；`source.assets.pagePng` 已按项目根目录解析并确认存在。

| 例号 | PDF 页 | 页图文件 | 手牌张数 | `needsUserVerify` | JSON 级牌/场景级牌 | 结论 |
|---:|---:|---|---:|---|---|---|
| 33 | 65 | `case-033-page65.png` | 27 | false | A / A | PASS |
| 34 | 66 | `case-034-page66.png` | 27 | false | 5 / 5 | PASS |
| 35 | 68 | `case-035-page68.png` | 27 | false | 2 / 2 | PASS |
| 36 | 70 | `case-036-page70.png` | 27 | false | 7 / 7 | PASS |
| 37 | 71 | `case-037-page71.png` | 27 | false | 6 / 6 | PASS |
| 38 | 74 | `case-038-page74.png` | 27 | false | 2 / 2 | PASS |
| 39 | 76 | `case-039-page76.png` | 27 | false | 4 / 4 | PASS |
| 40 | 77 | `case-040-page77.png` | 27 | false | 10 / 10 | PASS |
| 41 | 79 | `case-041-page79.png` | 27 | false | A / A | PASS |
| 42 | 81 | `case-042-page81.png` | 27 | false | 3 / 3 | PASS |
| 43 | 82 | `case-043-page82.png` | 27 | false | 2 / 2 | PASS |
| 44 | 87 | `case-044-page87.png` | 27 | false | 6 / 6 | PASS |
| 45 | 89 | `case-045-page89.png` | 27 | false | 3 / 3 | PASS |
| 46 | 90 | `case-046-page90.png` | 27 | false | 2 / 2 | PASS |
| 47 | 94 | `case-047-page94.png` | 27 | false | 4 / 4 | PASS |

`node tools/audit-case-json.mjs case-033 ... case-047` 退出码 0；指定 15 例均为 27 张、无需用户复核、级牌与场景一致、页图存在。

## 3. 书摘边界与 JSON 对齐

`extractCaseExcerpt(cleanedText, n) === case-NNN.json.narrative.summary`：15/15 PASS。`node tests/hand-labeler-excerpt.mjs` 退出码 0，并报告例 1～47 书摘边界全部通过。

| 例号 | 摘要长度（字） | `extractCaseExcerpt` 与 JSON | 重点边界 |
|---:|---:|---|---|
| 33 | 127 | PASS | 无通用讲义越界 |
| 34 | 116 | PASS | 无通用讲义越界 |
| 35 | 110 | PASS | 无通用讲义越界 |
| 36 | 137 | PASS | 无通用讲义越界 |
| 37 | 82 | PASS | 结束于“三连对”说明；无“首发”字样外推 |
| 38 | 71 | PASS | 无通用讲义越界 |
| 39 | 140 | PASS | 无通用讲义越界 |
| 40 | 133 | PASS | 无通用讲义越界 |
| 41 | 141 | PASS | 无通用讲义越界 |
| 42 | 115 | PASS | 无通用讲义越界 |
| 43 | 145 | PASS | 末尾“鸳鸭王。”；不含“蛋的初期” |
| 44 | 135 | PASS | 末尾“轻松拿头游。”；不含“想想,出牌的目的是…” |
| 45 | 109 | PASS | 末尾“动炸弹或置之不理。”；不含“3.牌弱首友…” |
| 46 | 186 | PASS | 末尾“应对变化性。”；不含“甚至炸弹立牌后再出对子” |
| 47 | 115 | PASS | 末尾“可减少单牌张数。”（跨 PDF 页 95）；不含“比如,上家出个小单牌” |

## 4. 书中要求、场景期望与 Top1 对照

quick/full 由与场景测试相同的 state 构造复测；时间均小于 5 秒。结构例的 `getTurnAdvice` 值仅作诊断，正式一致性以对应 `case-scenario-top1-*.mjs` 的候选偏序 golden 为准。

| 例号 | 书中要求/原则 | 场景期望（教纲） | quick / full 实际 | 正式 golden | 根因分类/结论 |
|---:|---|---|---|---|---|
| 33 | 暗藏多套同花顺，组牌顺看同花顺 | `SF/J > TWP/8`（C100-G1） | 诊断 `Pair/4` 55ms / `Pair/4` 1093ms；结构口径不作 Top1 gate | `SF/J` 分数优于 `TWP/8`，PASS | 测试口径差异；无策略 FAIL |
| 34 | 拆对 J 上一张扫单 8 | `Single/J`（C100-O1） | `Single/J` 5ms / 4ms | PASS | rev35 后策略一致 |
| 35 | `55577` 管 `33344`，让红配保持机动 | `TWP/5`（C100-G1） | `TWP/5` 4ms / 5ms | PASS | rev35 后策略一致 |
| 36 | 杂色 `A2345` 应上 `678910`，即 `Straight/10` | `Straight/10`（C100-M1） | `Straight/10` 3ms / 3ms | PASS | 场景/golden 已修；前手分类为 `Straight/5`，非 SF/5 |
| 37 | 组梅花 `A2345`，调出 `445566` 三连对 | `CP/6`（C100-G1，open 推断） | `CP/6` 7ms / 8ms | PASS | 教纲推断已固化；书文没有“首发”字样，已保留注释 |
| 38 | 跟 `45678`，出 `910JQK` 杂花顺 | `Straight/K` | `Straight/K` 230ms / 226ms | PASS | 策略一致 |
| 39 | 跟单 2，出最小可用单 3 | `Single/3` | `Single/3` 2ms / 3ms | PASS | 策略一致 |
| 40 | 组牌比较：`Straight/K > SF/A` | `Straight/K > SF/A` | 诊断 `Pair/2` 13ms / `CP/4` 1077ms；结构口径不作 Top1 gate | `Straight/K` 分数优于 `SF/A`，PASS | 测试口径差异；无策略 FAIL |
| 41 | 跟单 8，出 `Single/10` | `Single/10` | `Single/10` 7ms / 6ms | PASS | 策略一致 |
| 42 | 组牌比较：`SF/8 > Bomb/4` | `SF/8 > Bomb/4` | 诊断 `Pair/6` 14ms / `Single/6` 1620ms；结构口径不作 Top1 gate | `SF/8` 分数优于 `Bomb/4`，PASS | 测试口径差异；无策略 FAIL |
| 43 | 组牌比较：`Straight/7 > Bomb/6` | `Straight/7 > Bomb/6` | 诊断 `Pair/7` 6ms / `Straight/7` 1550ms；结构口径不作 Top1 gate | `Straight/7` 分数优于 `Bomb/6`，PASS | 测试口径差异；无策略 FAIL |
| 44 | 跟单 7，拆 J 上一张 | `Single/J` | `Single/J` 1ms / 2ms | PASS | 策略一致 |
| 45 | 跟 `45678`，出 `Straight/Q` | `Straight/Q` | `Straight/Q` 3ms / 4ms | PASS | 策略一致 |
| 46 | 跟 `445566`，出最小可用连对 A | `CP/A` | `CP/A` 2ms / 1ms | PASS | 策略一致 |
| 47 | 组牌比较：`Straight/9 > Bomb/7` | `Straight/9 > Bomb/7` | 诊断 `Pair/6` 10ms / `Straight/Q` 1147ms；结构口径不作 Top1 gate | `Straight/9` 分数优于 `Bomb/7`，PASS | 测试口径差异；无策略 FAIL |

### 例 36 分类专项

只读探测结果：`previousCards = A♠, 2♥, 3♦, 4♣, 5♠`，`classifyPlay` 为 `Straight/5`；不是 `StraightFlush/5`。因此 `Straight/10` 的 quick/full 结论有效，rev32 的建模问题已关闭。

## 5. 测试结论

| 命令 | 结果 |
|---|---|
| `node tests/hand-labeler-excerpt.mjs` | PASS（退出码 0；覆盖例 1～47） |
| `node tools/audit-case-json.mjs case-033 ... case-047` | PASS（退出码 0） |
| `node tests/case-scenario-top1-33-37.mjs` | PASS（5/5） |
| `node tests/case-scenario-top1-38-42.mjs` | PASS（5/5） |
| `node tests/case-scenario-top1-43-47.mjs` | PASS（5/5） |
| `node tests/case-scenario-top1-28-32.mjs` | PASS（5/5，既有批次回归） |
| `node tests/smoke.mjs` | PASS（退出码 0；约 193.6s） |

smoke 期间有一条“机器人单步超 7219ms，保留已算推荐”的运行时警告；未出现在 33～47 的 quick/full 复测中，也未造成测试失败，列为 P2 性能观察，不阻塞本批次关门。

## 6. rev 与 standalone 静态核对

- `strategy/sf-runway-guard.mjs:20`：`COACH_STRATEGY_REVISION = 35`。
- `guandan-coach-standalone.html` 内嵌源码同样为 `COACH_STRATEGY_REVISION = 35`（嵌入源位置约第 6568 行）。
- standalone 有 `globalThis.__GUANDAN_BUILD__` 构建标记；源码构建脚本由 `tools/build-standalone.mjs` 注入，和策略 rev 显示分开。
- `HEAD`、`origin/main` 均为 `00d3d24`；未发现 rev32 残留。

## 7. 批次 6 OPEN 项跟进（rev32 → rev35）

| rev32 待办 | rev35 证据 | 状态 |
|---|---|---|
| 例 36 把普通 `A2345` 建模成同花顺 | 场景改为混色前手，分类 `Straight/5`；golden 期望 `Straight/10` 通过 | 已关闭 |
| 例 37 将“调出 445566 三连对”误写成书中明示“首发” | 书摘已止于原文；`open → CP/6` 明确标为教纲推断 | 已关闭（保留语义注释） |
| 例 33～37 书摘越界/JSON 不对齐 | 15/15 `extractCaseExcerpt === narrative.summary`；hand-labeler 覆盖至例 47 | 已关闭 |
| 例 34 full 未稳定出 J | quick/full 均 `Single/J` | 已关闭 |
| 例 35 quick/full 未出 `TWP/5` | quick/full 均 `TWP/5` | 已关闭 |
| 缺少批次 6～8 正式 Top1 门禁 | 33～47 三组 golden 全部 PASS | 已关闭 |

## 8. Cursor pending 清单

- **P0：无。** 没有手牌、页码、页图、书摘越界或正式 golden 失败。
- **P1：无。** 33～47 的有效 quick/full 均小于 5 秒；例 36 分类专项通过。
- **P2（不阻塞）：** smoke 的单条 7219ms 机器人步耗时告警；另可在未来为 `structure` 场景补 UI-path exact Top1 测试，但当前正式验收口径已明确为候选偏序 golden。

## 9. 关门结论

批次 6：**CLOSED**（由 rev32 的 OPEN 转为 CLOSED）。  
批次 7：**CLOSED**。  
批次 8：**CLOSED**。  

批次 6～8 合并审计：**CLOSED**。本次 Codex 没有修改项目代码或训练数据；仅新增本报告。
