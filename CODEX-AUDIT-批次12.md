# CODEX-AUDIT-批次12

审计日期：2026-08-03  
项目：掼蛋教练 Pro；模式：只读复验  
范围：例 63～67  
基线：`git pull origin main` 后 `HEAD = origin/main = 1b871cb`，策略 rev40。

本次仅新增本报告与任务包；未修改 `strategy/`、`coach/`、训练 JSON、场景或测试，未 commit/push。

## 1. 摘要

| 项目 | 结果 |
|---|---|
| 手牌、级牌、权威 PDF 页码、页图 | 5/5 PASS |
| `extractCaseExcerpt()` 与 `narrative.summary` | 5/5 PASS；hand-labeler 已覆盖例1～67 |
| 功能 Top1 | 5/5 PASS；例63/66/67 structure 偏序均通过 |
| 58～62 回归 | PASS |
| smoke | PASS |
| rev 静态核对 | 源码 rev40；standalone 仍为 rev39（P2） |
| 结论 | **远端 rev40 审计 PASS · CLOSED** |

## 2. JSON、页码与页图

PDF 页码唯一以 `training-samples/case-page-map.json` 为准；页图按 `source.assets.pagePng` 相对项目根目录解析。

| 例号 | PDF页 | 级牌 | 场景 | 期望 | 手牌 | `needsUserVerify` | 页图 | 结论 |
|---:|---:|---|---|---|---:|---|---|---|
| 63 | 123 | 2 | structure | `StraightFlush/5 > Straight/5` | 27 | false | `assets/guandan-100cases/case-063-page123.png` 存在 | PASS |
| 64 | 124 | 6 | follow A2345 SF | `StraightFlush/7` | 27 | false | `assets/guandan-100cases/case-064-page124.png` 存在 | PASS |
| 65 | 126 | 9 | open | `Single/3` | 27 | false | `assets/guandan-100cases/case-065-page126.png` 存在 | PASS |
| 66 | 128 | 6 | structure | `Triple/2 > Straight/7` | 27 | false | `assets/guandan-100cases/case-066-page128.png` 存在 | PASS |
| 67 | 129 | A | structure | `Straight/5 > Bomb/8` | 27 | false | `assets/guandan-100cases/case-067-page129.png` 存在 | PASS |

`node tools/audit-case-json.mjs case-063 case-064 case-065 case-066 case-067` 退出码 0；5 例均为 27 张、无需用户复核、级牌与场景级牌一致。

## 3. 书摘边界与 JSON 对齐

`extractCaseExcerpt(cleanedText, n) === case-NNN.json.narrative.summary`：5/5 PASS。`node tests/hand-labeler-excerpt.mjs` 退出码 0，输出例1～67 书摘边界全部通过。

| 例号 | 摘要长度 | 应止于 | 越界核对 | JSON 对齐 |
|---:|---:|---|---|---|
| 63 | 80字 | 「牌型多元化」 | 不含「3. FARE」 | PASS |
| 64 | 132字 | 「组10JQKA( 红配 ) 黑桃」 | 不含「还有一种牌也是要炸的」 | PASS |
| 65 | 119字 | 「春天到来。」 | 不含「于白炸」 | PASS |
| 66 | 81字 | 「后有三带对」 | 不含「5. 留牌」 | PASS |
| 67 | 133字 | 「5678( 红配 )9梅花同花顺。」 | 不含「比如, 末家两手牌」 | PASS |

## 4. Top1 三方对照

| 例号 | 书中要求/原则 | 场景期望 | 实测 quick / full | 结论 | 根因分类 |
|---:|---|---|---|---|---|
| 63 | 方片A下放，A2红配345方片SF优于杂顺，牌型多元化 | structure：`StraightFlush/5 > Straight/5` | structure golden：`StraightFlush/5` 优于 `Straight/5` | PASS | 无 |
| 64 | 下家A2345 SF，末家须910JQK管压 | `StraightFlush/7` | `StraightFlush/7` 10ms / 10ms | PASS | 无 |
| 65 | 无王无主、单牌弱项，88822结构宜首发单3 | `Single/3` | `Single/3` 1ms / 3ms | PASS | 无 |
| 66 | 抗贡首发，先三个2再三A回手，后出34567杂顺 | structure：`Triple/2 > Straight/7` | structure golden：`Triple/2` 优于 `Straight/7` | PASS | 无 |
| 67 | 四炸但三小单，拆8炸组A234红配5减单 | structure：`Straight/5 > Bomb/8` | structure golden：`Straight/5` 优于 `Bomb/8` | PASS | 无 |

例63/66/67 为 structure 场景，没有上一手牌；正式测试以 `scoreCandidate` 的 prefer/over 偏序为 Oracle，不把无上一手时的 `getTurnAdvice` 单一领出值作为 gate。

## 5. 既有回归与 smoke

| 命令 | 结果 |
|---|---|
| `node tests/case-scenario-top1-63-67.mjs` | PASS；5/5，所有 quick/full <5s |
| `node tests/case-scenario-top1-58-62.mjs` | PASS；58～62 全部通过 |
| `node tests/smoke.mjs` | PASS；退出码0，「全部冒烟测试通过」 |

smoke 仍输出若干「机器人单步超时、保留已算推荐」告警，最大约 5151ms；未导致 smoke 失败，也未影响例63～67 Top1，列为既有 P2 观察项。

## 6. rev 静态核对

- `strategy/sf-runway-guard.mjs:20`：`COACH_STRATEGY_REVISION = 40`。
- `guandan-coach-standalone.html` 内嵌源码仍为 **rev39**（批次12 发布后未重建 standalone）。
- dev-server 路径（`dev-server.mjs`）动态注入 `__GUANDAN_STRATEGY_REV__=40`，启动脚本游戏页应显示 rev40。
- 当前 `HEAD = origin/main = 1b871cb`。

## 7. 失败分类与 Cursor 待办

- 场景/golden 错：无。
- 策略差异：无；63～67 期望均已复现。
- 书摘越界：无。
- 页码/手牌 JSON 错：无；5/5 页码、页图、27张手牌和级牌一致。
- P0/P1：无。
- P2：standalone 需 `node tools/build-standalone.mjs` 同步 rev40；smoke 中既有单步超时告警，不阻塞本批次。

## 8. 结论

在远端 `origin/main` rev40 基线上，例63～67 的 JSON、书摘、Top1、58～62 回归和 smoke 全部通过；例64 SF 管牌快路径、例65 单3首发、例66/67 structure 偏序均按规格处理。批次12 **审计 PASS · CLOSED**。
