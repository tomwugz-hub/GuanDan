# CODEX-AUDIT-批次13

审计日期：2026-08-03  
项目：掼蛋教练 Pro；模式：只读复验  
范围：例 68～72  
基线：`git pull origin main` 后 `HEAD = origin/main = 19f2196`，策略 rev41。

本次仅新增本报告与任务包；未修改 `strategy/`、`coach/`、训练 JSON、场景或测试，未 commit/push。

## 1. 摘要

| 项目 | 结果 |
|---|---|
| 手牌、级牌、权威 PDF 页码、页图 | 5/5 PASS |
| `extractCaseExcerpt()` 与 `narrative.summary` | 5/5 PASS；hand-labeler 已覆盖例1～72 |
| 功能 Top1 | 5/5 PASS；例69/70 structure 偏序均通过 |
| 63～67 回归 | PASS |
| smoke | PASS |
| rev 静态核对 | 源码与 standalone 均 rev41 |
| 结论 | **远端 rev41 审计 PASS · CLOSED** |

## 2. JSON、页码与页图

PDF 页码唯一以 `training-samples/case-page-map.json` 为准；页图按 `source.assets.pagePng` 相对项目根目录解析。

| 例号 | PDF页 | 级牌 | 场景 | 期望 | 手牌 | `needsUserVerify` | 页图 | 结论 |
|---:|---:|---|---|---|---:|---|---|---|
| 68 | 132 | 4 | follow 556677 | `ConsecutivePairs/9` | 27 | false | `assets/guandan-100cases/case-068-page132.png` 存在 | PASS |
| 69 | 134 | A | structure | `StraightFlush/A > Bomb/10` | 27 | false | `assets/guandan-100cases/case-069-page134.png` 存在 | PASS |
| 70 | 135 | J | structure | `Straight/J > Bomb/4` | 27 | false | `assets/guandan-100cases/case-070-page135.png` 存在 | PASS |
| 71 | 137 | 10 | follow 34567 | `Straight/9` | 27 | false | `assets/guandan-100cases/case-071-page137.png` 存在 | PASS |
| 72 | 138 | A | follow 23456 | `Straight/9` | 27 | false | `assets/guandan-100cases/case-072-page138.png` 存在 | PASS |

`node tools/audit-case-json.mjs case-068 case-069 case-070 case-071 case-072` 退出码 0；5 例均为 27 张、无需用户复核、级牌与场景级牌一致。

## 3. 书摘边界与 JSON 对齐

`extractCaseExcerpt(cleanedText, n) === case-NNN.json.narrative.summary`：5/5 PASS。`node tests/hand-labeler-excerpt.mjs` 退出码 0，输出例1～72 书摘边界全部通过。

| 例号 | 摘要长度 | 应止于 | 越界核对 | JSON 对齐 |
|---:|---:|---|---|---|
| 68 | 103字 | 「抢得头游。」 | 不含「吃贡者在组剩下的单牌」 | PASS |
| 69 | 86字 | 「抢头游。」 | 不含「2. 还指档」 | PASS |
| 70 | 87字 | 「减少一张单牌。」 | 不含「当然 , 相对的是」 | PASS |
| 71 | 94字 | 「出牌手数。」 | 不含「当然 , 在单2」 | PASS |
| 72 | 113字 | 「带走了一张单牌8。」 | 不含「这时候的原则是」 | PASS |

例68～72 均位于第九讲「如何还好吃贡牌」还牌讲义之前/边界，书摘 bleed 守卫已按还牌/拆牌讲义关键词截断。

## 4. Top1 三方对照

| 例号 | 书中要求/原则 | 场景期望 | 实测 quick / full | 结论 | 根因分类 |
|---:|---|---|---|---|---|
| 68 | 下家556677，末家778899管牌立66622 | `ConsecutivePairs/9` | `ConsecutivePairs/9` 33ms / 50ms | PASS | 无 |
| 69 | 10JQKA大黑桃SF减单2/5，优于四10炸 | structure：`StraightFlush/A > Bomb/10` | structure golden 偏序 PASS | PASS | 无 |
| 70 | 8910JQ杂花顺减单，优于裸保4炸 | structure：`Straight/J > Bomb/4` | structure golden 偏序 PASS | PASS | 无 |
| 71 | 34567须56789管牌，预留8910JQ | `Straight/9` | `Straight/9` 3ms / 2ms | PASS | 无 |
| 72 | 23456须56789（逢人配）管牌带走单8 | `Straight/9` | `Straight/9` 33ms / 37ms | PASS | 无 |

例69/70 为 structure 场景，没有上一手牌；正式测试以 `scoreCandidate` 的 prefer/over 偏序为 Oracle。

## 5. 既有回归与 smoke

| 命令 | 结果 |
|---|---|
| `node tests/case-scenario-top1-68-72.mjs` | PASS；5/5，所有 quick/full <5s |
| `node tests/case-scenario-top1-63-67.mjs` | PASS；63～67 全部通过 |
| `node tests/smoke.mjs` | PASS；退出码0，「全部冒烟测试通过」 |

smoke 仍输出若干「机器人单步超时、保留已算推荐」告警；未导致 smoke 失败，也未影响例68～72 Top1，列为既有 P2 观察项。

## 6. rev 静态核对

- `strategy/sf-runway-guard.mjs:20`：`COACH_STRATEGY_REVISION = 41`。
- `guandan-coach-standalone.html` 内嵌源码包含 rev41。
- standalone 含 `globalThis.__GUANDAN_BUILD__` 构建标记。
- 当前 `HEAD = origin/main = 19f2196`。

## 7. 失败分类与 Cursor 待办

- 场景/golden 错：无。
- 策略差异：无；68～72 期望均已复现。
- 书摘越界：无。
- 页码/手牌 JSON 错：无；5/5 页码、页图、27张手牌和级牌一致。
- P0/P1：无。
- P2：smoke 中既有单步超时告警，不阻塞本批次。

## 8. 结论

在远端 `origin/main` rev41 基线上，例68～72 的 JSON、书摘、Top1、63～67 回归和 smoke 全部通过；例68 连对 lite 直建、例72 逢人配顺子管牌均按规格处理。批次13 **审计 PASS · CLOSED**。
