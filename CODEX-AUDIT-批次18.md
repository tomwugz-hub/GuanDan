# CODEX-AUDIT-批次18

审计日期：2026-08-06  
项目：掼蛋教练 Pro；模式：只读复验  
范围：例 93～97  
基线：`HEAD = origin/main = e7c8cde`，策略 rev46。

本次仅新增本报告；未修改 `strategy/`、`coach/`、训练 JSON、场景或测试，未 commit/push。

## 1. 摘要

| 项目 | 结果 |
|---|---|
| JSON、级牌、权威页码、页图 | 5/5 PASS |
| `extractCaseExcerpt()` 与 `narrative.summary` | 5/5 PASS；hand-labeler 已覆盖例1～97 |
| 功能 Top1 | 5/5 PASS；例93/94/96 structure 偏序通过，例97按场景 Oracle通过 |
| 88～92 回归 | PASS |
| smoke | PASS |
| rev 静态核对 | 源码与 standalone 均 rev46 |
| 结论 | **PASS / CLOSED** |

## 2. JSON、页码与页图

PDF 页码唯一以 `training-samples/case-page-map.json` 为准；页图按 `source.assets.pagePng` 相对项目根目录解析。

| 例号 | PDF页 | 级牌 | 场景 | 期望 | 手牌 | `needsUserVerify` | 页图 | 结论 |
|---:|---:|---|---|---|---:|---|---|---|
| 93 | 176 | 9 | structure | `StraightFlush/9 > Bomb/8` | 27 | false | `assets/guandan-100cases/case-093-page176.png` 存在 | PASS |
| 94 | 177 | 2 | structure | `Straight/7 > Bomb/7` | 27 | false | `assets/guandan-100cases/case-094-page177.png` 存在 | PASS |
| 95 | 179 | 8 | follow 34567 | `Straight/K` | 27 | false | `assets/guandan-100cases/case-095-page179.png` 存在 | PASS |
| 96 | 192 | 2 | structure | `Bomb/8 > Bomb/2` | 27 | false | `assets/guandan-100cases/case-096-page192.png` 存在 | PASS |
| 97 | 200 | 2 | follow 445566，`passTail=2` | `ConsecutivePairs/A` | 27 | false | `assets/guandan-100cases/case-097-page200.png` 存在 | PASS |

`node tools/audit-case-json.mjs case-093 case-094 case-095 case-096 case-097` 退出码 0；5 例均为 27 张、无需用户复核、级牌与场景级牌一致。

## 3. 书摘边界与 JSON 对齐

`extractCaseExcerpt(cleanedText, n) === case-NNN.json.narrative.summary`：5/5 PASS。`node tests/hand-labeler-excerpt.mjs` 退出码 0，输出例1～97书摘边界全部通过。

| 例号 | 摘要长度 | 应止于 | 越界核对 | JSON 对齐 |
|---:|---:|---|---|---|
| 93 | 80字 | “实现了牌型多元化。” | 不含“5. 五头炸弹用四张”讲义 | PASS |
| 94 | 241字 | “往往会收到意想不到的效果。” | 不含“6. 牌型拆单拆到底”讲义 | PASS |
| 95 | 333字 | “引下了对手方的炸弹”段末（跨页截断于该段） | 不含“第十二讲”页眉 | PASS |
| 96 | 171字 | “910JQK(红配)黑桃同花顺立牌抢头游。” | 不含“7. 顺子打到头”顺口溜讲义 | PASS |
| 97 | 135字 | “梅花同花顺。” | 不含“放长线钓大鱼”牌品泛论 | PASS |

## 4. Top1 三方对照

| 例号 | 书中要求/原则 | 场景期望 | 实测 quick / full | 结论 | 根因分类 |
|---:|---|---|---|---|---|
| 93 | 红配组 `56789` 同花顺，减少小单牌、实现牌型多元化 | structure：`StraightFlush/9 > Bomb/8` | structure golden：`StraightFlush/9` 优于 `Bomb/8` | PASS | 无 |
| 94 | `34567` 杂花顺发挥红配，优于裸保四7炸 | structure：`Straight/7 > Bomb/7` | structure golden：`Straight/7` 优于 `Bomb/7` | PASS | 无 |
| 95 | 跟 `34567` 顺出 `9TJQK`，引下对手炸弹 | `Straight/K`，优于 Pass | `Straight/K` 6ms / 2ms | PASS | 无 |
| 96 | 多炸路线，四8炸优于四2炸，归位后再组顺 | structure：`Bomb/8 > Bomb/2` | structure golden：`Bomb/8` 优于 `Bomb/2` | PASS | 无 |
| 97 | 以场景 Oracle 为准：`QQKKAA` 管 `445566` | `ConsecutivePairs/A`，优于 Pass | `ConsecutivePairs/A` 638ms / 1299ms | PASS | 无 |

例93、94、96 为 structure 场景，正式测试以 `scoreCandidate` 的 prefer/over 偏序为 Oracle；例97按场景 JSON 的 `QQKKAA` 管 `445566` 判定，不以书摘中不同战术句替换场景 Oracle。

## 5. 88～92 回归与 smoke

| 命令 | 结果 |
|---|---|
| `node tests/case-scenario-top1-93-97.mjs` | PASS；93～97 全部通过，follow/open 均 <5s |
| `node tests/case-scenario-top1-88-92.mjs` | PASS；88跳过，89～92全部通过 |
| `node tests/smoke.mjs` | PASS；退出码0，机器人三家连推 475ms |

smoke 仍输出若干“机器人单步超时、保留已算推荐”告警，最大约 1416ms；未导致 smoke 失败，也未影响例93～97 Top1，列为既有 P2 观察项。

## 6. rev 静态核对

- `strategy/sf-runway-guard.mjs:20`：`COACH_STRATEGY_REVISION = 46`。
- `guandan-coach-standalone.html` 内嵌源码包含 rev46，未发现 rev45 残留。
- standalone 含 `globalThis.__GUANDAN_BUILD__` 构建标记。
- `HEAD = origin/main = e7c8cde`。

## 7. 失败分类与待办

- 场景/golden 错：无。
- 策略差异：无；93～97期望均已复现。
- 书摘越界：无。
- 页码/手牌 JSON 错：无；5/5页码、页图、27张手牌和级牌一致。
- P0/P1：无。
- P2：smoke 中既有单步超时告警，不阻塞本批次。

## 8. 结论

例93～97的 JSON、书摘、Top1、88～92回归和 smoke 全部通过；例97以场景 Oracle `QQKKAA` 管 `445566` 判定，源码/standalone rev46一致。批次18 **PASS / CLOSED**。
