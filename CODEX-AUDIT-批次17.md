# CODEX-AUDIT-批次17

审计日期：2026-08-05  
项目：掼蛋教练 Pro；模式：只读复验  
范围：例 88～92（例88按任务规则跳过）  
基线：`HEAD = origin/main = 44f9e46`，策略 rev45。

说明：`git pull origin main` 因共享工作区存在大量未提交/未跟踪改动被安全检查拒绝；但执行前已核实 `HEAD` 与 `origin/main` 均为 `44f9e46`，无需拉取即可在同一远端基线完成审计。

本次仅新增本报告；未修改 `strategy/`、`coach/`、训练 JSON、场景或测试，未 commit/push。

## 1. 摘要

| 项目 | 结果 |
|---|---|
| 例88 | 按规则跳过；书中无例88，repo 无例88场景 JSON |
| JSON、级牌、权威页码、页图（89～92） | 4/4 PASS |
| `extractCaseExcerpt()` 与 `narrative.summary` | 4/4 PASS；hand-labeler 已覆盖例1～92 |
| 功能 Top1 | 4/4 PASS；例89 Pair/3、90 Bomb/8、91 Triple/2、92 Single/6 |
| 83～87 回归 | PASS |
| smoke | PASS |
| rev 静态核对 | 源码与 standalone 均 rev45 |
| 结论 | **PASS / CLOSED** |

## 2. JSON、页码与页图

PDF 页码唯一以 `training-samples/case-page-map.json` 为准；页图按 `source.assets.pagePng` 相对项目根目录解析。

| 例号 | PDF页 | 级牌 | 场景 | 期望 | 手牌 | `needsUserVerify` | 页图 | 结论 |
|---:|---:|---|---|---|---:|---|---|---|
| 88 | — | — | — | 跳过 | — | — | — | SKIP（书中无例88） |
| 89 | 169 | 6 | open/support/4 | `Pair/3 > Single/3` | 27 | false | `assets/guandan-100cases/case-089-page169.png` 存在 | PASS |
| 90 | 171 | 7 | follow 对7 | `Bomb/8` | 27 | false | `assets/guandan-100cases/case-090-page171.png` 存在 | PASS |
| 91 | 172 | 2 | open/main-attack/14 | `Triple/2 > Straight/7` | 27 | false | `assets/guandan-100cases/case-091-page172.png` 存在 | PASS |
| 92 | 175 | J | follow 单5 | `Single/6` | 27 | false | `assets/guandan-100cases/case-092-page175.png` 存在 | PASS |

`node tools/audit-case-json.mjs case-089 case-090 case-091 case-092` 退出码 0；4 例均为 27 张、无需用户复核、级牌与场景级牌一致。例88未被误报为数据缺失。

## 3. 书摘边界与 JSON 对齐

`extractCaseExcerpt(cleanedText, n) === case-NNN.json.narrative.summary`：例89～92 为 4/4 PASS。`node tests/hand-labeler-excerpt.mjs` 退出码 0，输出例1～92书摘边界全部通过。

| 例号 | 摘要长度 | 应止于 | 越界核对 | JSON 对齐 |
|---:|---:|---|---|---|
| 89 | 100字 | “先出三不带，后有三带对” | 不含“第十一讲/如何应变打好牌”泛论 | PASS |
| 90 | 259字 | 战术段“变化、应对！” | 不含“2. 红配可以随时调”讲义 | PASS |
| 91 | 86字 | 以“两个红”跨页截断 | 不含“3. 末家负责制”讲义 | PASS |
| 92 | 281字 | “这是很划算的事” | 不含“第十一讲”后续泛论 | PASS |

## 4. Top1 三方对照

| 例号 | 书中要求/原则 | 场景期望 | 实测 quick / full | 结论 | 根因分类 |
|---:|---|---|---|---|---|
| 89 | 弱牌先出对3示弱，后续对 A、三个2等 | `Pair/3`，优于 `Single/3` | `Pair/3` 7ms / 7ms | PASS | 无 |
| 90 | 四个8炸弹管对7 | `Bomb/8` | `Bomb/8` 1ms / 1ms | PASS | 无 |
| 91 | 弱牌用三个2逼封首发，优于 `23456` | `Triple/2`，优于 `Straight/7` | `Triple/2` 0ms / 0ms | PASS | 无 |
| 92 | 顺6管单5 | `Single/6` | `Single/6` 2ms / 2ms | PASS | 无 |

所有 follow/open quick + full 均小于 5 秒；例89的 support/4 与例91的 main-attack/14 指纹场景均命中预期。

## 5. 83～87 回归与 smoke

| 命令 | 结果 |
|---|---|
| `node tests/case-scenario-top1-88-92.mjs` | PASS；89～92 全部通过，例88跳过 |
| `node tests/case-scenario-top1-83-87.mjs` | PASS；83～87 回归全部通过 |
| `node tests/smoke.mjs` | PASS；退出码0，机器人三家连推 439ms |

smoke 仍输出若干“机器人单步超时、保留已算推荐”告警，最大约 3922ms；未导致 smoke 失败，也未影响本批次 Top1，列为既有 P2 观察项。

## 6. rev 静态核对

- `strategy/sf-runway-guard.mjs:20`：`COACH_STRATEGY_REVISION = 45`。
- `guandan-coach-standalone.html` 内嵌源码包含 rev45，未发现 rev44 残留。
- standalone 含 `globalThis.__GUANDAN_BUILD__` 构建标记。
- `HEAD = origin/main = 44f9e46`。

## 7. 失败分类与待办

- 场景/golden 错：无。
- 策略差异：无；89～92期望均已复现。
- 书摘越界：无。
- 页码/手牌 JSON 错：无；4/4页码、页图、27张手牌和级牌一致。
- P0/P1：无。
- P2：smoke 中既有单步超时告警，不阻塞本批次。

## 8. 结论

例88按规则跳过；例89～92的 JSON、书摘、Top1、83～87回归和 smoke 全部通过，源码/standalone rev45一致。批次17 **PASS / CLOSED**。
