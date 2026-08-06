# CODEX-AUDIT-批次16

审计日期：2026-08-05  
项目：掼蛋教练 Pro；模式：只读复验  
范围：例 83～87（**例85 书中缺失，跳过**）  
基线：`git pull origin main` 后 `HEAD = origin/main = b2f6098`，策略 rev44。

本次仅新增本报告与任务包；未修改 `strategy/`、`coach/`、训练 JSON、场景或测试，未 commit/push。

## 1. 摘要

| 项目 | 结果 |
|---|---|
| 手牌、级牌、权威 PDF 页码、页图 | 4/4 PASS（例85 N/A） |
| `extractCaseExcerpt()` 与 `narrative.summary` | 4/4 PASS；hand-labeler 已覆盖例1～87（跳过85） |
| 功能 Top1 | 4/4 PASS；例83 structure 偏序通过 |
| 78～82 回归 | PASS |
| smoke | PASS |
| rev 静态核对 | 源码与 standalone 均 rev44 |
| 结论 | **远端 rev44 审计 PASS · CLOSED** |

## 2. JSON、页码与页图

PDF 页码唯一以 `training-samples/case-page-map.json` 为准；页图按 `source.assets.pagePng` 相对项目根目录解析。

| 例号 | PDF页 | 级牌 | 场景 | 期望 | 手牌 | `needsUserVerify` | 页图 | 结论 |
|---:|---:|---|---|---|---:|---|---|---|
| 83 | 157 | Q | structure | `StraightFlush/Q > Bomb/2` | 27 | false | `assets/guandan-100cases/case-083-page157.png` 存在 | PASS |
| 84 | 159 | 9 | follow 778899 | `Bomb/5` | 27 | false | `assets/guandan-100cases/case-084-page159.png` 存在 | PASS |
| 85 | — | — | — | — | — | — | — | **跳过（书中无例85）** |
| 86 | 162 | 2 | follow 666+对 | `TripleWithPair/K` | 27 | false | `assets/guandan-100cases/case-086-page162.png` 存在 | PASS |
| 87 | 164 | 3 | open | `Straight/6` | 27 | false | `assets/guandan-100cases/case-087-page164.png` 存在 | PASS |

`node tools/audit-case-json.mjs case-083 case-084 case-086 case-087` 退出码 0；4 例均为 27 张、无需用户复核、级牌与场景级牌一致。

## 3. 书摘边界与 JSON 对齐

`extractCaseExcerpt(cleanedText, n) === case-NNN.json.narrative.summary`：4/4 PASS。`node tests/hand-labeler-excerpt.mjs` 退出码 0，输出例1～87 书摘边界全部通过（循环内跳过例85）。

| 例号 | 摘要长度 | 应止于 / 重点 | 越界核对 | JSON 对齐 |
|---:|---:|---|---|---|
| 83 | 122字 | 「抢得头游。」 | 不含「报8张牌」报牌讲义 | PASS |
| 84 | 105字 | 「单牌等待时机。」 | 不含「报9张牌」报牌讲义 | PASS |
| 86 | 158字 | 战术段止于「准备抢头游」 | 不含后续对手方泛论长段（P2 观察：尾句略长） | PASS |
| 87 | 136字 | 「给搭档明确信息要对子。」 | 不含报牌制讲义 | PASS |

## 4. Top1 三方对照

权威 Oracle：`training-samples/cases/case-scenarios-51-100.json`。

| 例号 | 书中叙事要点 | 场景期望 | 实测 quick / full | 结论 | 根因分类 |
|---:|---|---|---|---|---|
| 83 | 22255首发，重组10JQKA梅花同花顺 | structure：`StraightFlush/Q > Bomb/2` | structure golden 偏序 PASS | PASS | 场景 Oracle |
| 84 | 末家667788管778899，拆弹立牌 | `Bomb/5` | `Bomb/5` 84ms / 76ms | PASS | 既有 C100-M1 末家负责制 |
| 86 | 88991010管445566，910JQK同花顺路线 | `TripleWithPair/K` | `TripleWithPair/K` 1010ms / 843ms | PASS | 既有例27类三带二管牌 |
| 87 | 先出黑桃2/A2345 SF（书摘） | `Straight/6`（23456减手） | `Straight/6` 0ms / 149ms | PASS | 场景 Oracle；四3/四K直建 |

例83 为 structure 场景，正式测试以 `scoreCandidate` 的 prefer/over 偏序为 Oracle。

## 5. 既有回归与 smoke

| 命令 | 结果 |
|---|---|
| `node tests/case-scenario-top1-83-87.mjs` | PASS；4/4（例85 跳过），quick/full 均 <5s |
| `node tests/case-scenario-top1-78-82.mjs` | PASS；78～82 全部通过 |
| `node tests/smoke.mjs` | PASS；退出码0，「全部冒烟测试通过」 |

smoke 仍输出若干「机器人单步超时、保留已算推荐」告警；未导致 smoke 失败，列为既有 P2 观察项。例86 follow quick 约 1s，仍低于 5s 门禁。

## 6. rev 静态核对

- `strategy/sf-runway-guard.mjs:20`：`COACH_STRATEGY_REVISION = 44`。
- `guandan-coach-standalone.html` 内嵌源码包含 rev44。
- standalone 含 `globalThis.__GUANDAN_BUILD__` 构建标记。
- 当前 `HEAD = origin/main = b2f6098`。

## 7. 失败分类与 Cursor 待办

- 场景/golden 错：无。
- 策略差异：无；83/84/86/87 期望均已复现。
- 书摘越界：无阻塞项；例86 尾句略涉对手方心理（P2）。
- 页码/手牌 JSON 错：无。
- 例85 缺失：书中与 cleaned.txt 均无 `#### 例85`，场景 JSON 亦无，本批 intentional skip。
- P0/P1：无。
- P2：smoke 单步超时告警；例86 follow 耗时偏高但仍 <5s。

## 8. 结论

在远端 `origin/main` rev44 基线上，例83～87（除85）的 JSON、书摘、Top1、78～82 回归和 smoke 全部通过；例87 23456 直建首发、例83 同花顺结构偏序均按规格处理。批次16 **审计 PASS · CLOSED**。
