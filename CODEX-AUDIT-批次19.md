# CODEX-AUDIT-批次19

审计日期：2026-08-06  
项目：掼蛋教练 Pro；模式：只读复验  
范围：例 98～100（百例 51～100 收官）  
基线：`HEAD = origin/main = b01d53c`，策略 rev47。

本次仅新增本报告；未修改 `strategy/`、`coach/`、训练 JSON、场景或测试，未 commit/push。

## 1. 摘要

| 项目 | 结果 |
|---|---|
| JSON、级牌、权威页码、页图 | 3/3 PASS |
| 书摘 1～100 | PASS；hand-labeler 输出例1～100边界全部通过 |
| 功能 Top1 | 3/3 PASS；例98 structure 偏序通过 |
| 93～97 回归 | PASS |
| smoke | PASS |
| standalone 构建 | PASS；生成 rev47 standalone |
| rev 静态核对 | 源码与 standalone 均 rev47 |
| 结论 | **PASS / CLOSED；百例51～100收官完成** |

永久跳过例85、例88（书中无独立战例），不计入缺失或失败。

## 2. JSON、页码与页图

PDF 页码唯一以 `training-samples/case-page-map.json` 为准；页图按 `source.assets.pagePng` 相对项目根目录解析。

| 例号 | PDF页 | 级牌 | 场景 | 期望 | 手牌 | `needsUserVerify` | 页图 | 结论 |
|---:|---:|---|---|---|---:|---|---|---|
| 98 | 215 | A | structure | `StraightFlush/J > Bomb/K` | 27 | false | `assets/guandan-100cases/case-098-page215.png` 存在 | PASS |
| 99 | 220 | A | follow 45678，`passTail=2` | `Straight/Q` | 27 | false | `assets/guandan-100cases/case-099-page220.png` 存在 | PASS |
| 100 | 226 | 9 | follow 678910，`passTail=2` | `Straight/A` | 27 | false | `assets/guandan-100cases/case-100-page226.png` 存在 | PASS |

`node tools/audit-case-json.mjs case-098 case-099 case-100` 退出码 0；3 例均为 27 张、无需用户复核、级牌与场景级牌一致。

## 3. 书摘边界与 JSON 对齐

`extractCaseExcerpt(cleanedText, n) === case-NNN.json.narrative.summary`：98～100 为 3/3 PASS。`node tests/hand-labeler-excerpt.mjs` 退出码 0，输出例1～100书摘边界全部通过。

| 例号 | 摘要长度 | 应止于 | 越界核对 | JSON 对齐 |
|---:|---:|---|---|---|
| 98 | 69字 | “牌型多元”段末（规划三连对、杂花顺、三K带对、六10炸） | 不含“第十七讲/三个基本功”讲义 | PASS |
| 99 | 109字 | “组789（红配）10J黑桃同花顺。” | 不含下一页“910JQK，末家都有可能管牌”跨页 bleed | PASS |
| 100 | 151字 | “对多转三带，红配说了算。” | 不含“种没有底线/再说线上掼蛋”牌品泛论 | PASS |

## 4. Top1 三方对照

| 例号 | 书中要求/原则 | 场景期望 | 实测 quick / full | 结论 | 根因分类 |
|---:|---|---|---|---|---|
| 98 | `8910JQ` 黑桃同花顺减单，优于保留 K 炸 | structure：`StraightFlush/J > Bomb/K` | structure golden：`StraightFlush/J` 优于 `Bomb/K` | PASS | 无 |
| 99 | `8910JQ` 管 `45678`，宜杂花顺而非同花顺 | `Straight/Q` | `Straight/Q` 46ms / 43ms | PASS | 无 |
| 100 | `10JQKA` 管 `678910`，末家负责制 | `Straight/A` | `Straight/A` 42ms / 45ms | PASS | 无 |

例98为 structure 场景，正式测试以 `scoreCandidate` 的 prefer/over 偏序为 Oracle；例99、100 follow quick + full 均小于5秒，场景 JSON 为最终 Oracle。

## 5. 93～97 回归与 smoke

| 命令 | 结果 |
|---|---|
| `node tests/case-scenario-top1-98-100.mjs` | PASS；98～100全部通过，标记百例收官 |
| `node tests/case-scenario-top1-93-97.mjs` | PASS；93～97全部通过 |
| `node tests/smoke.mjs` | PASS；退出码0，机器人三家连推 3610ms |
| `node tools/build-standalone.mjs` | PASS；输出 `guandan-coach-standalone.html` |

smoke 仍输出若干“机器人单步超时、保留已算推荐”告警，最大约 3609ms；未导致 smoke 失败，也未影响例98～100 Top1，列为既有 P2 观察项。standalone 构建命令更新了生成构建标记，但未修改策略或训练数据。

## 6. rev 静态核对

- `strategy/sf-runway-guard.mjs:20`：`COACH_STRATEGY_REVISION = 47`。
- `guandan-coach-standalone.html` 内嵌源码包含 rev47，未发现 rev46 残留。
- standalone 含 `globalThis.__GUANDAN_BUILD__` 构建标记。
- `HEAD = origin/main = b01d53c`。

## 7. 失败分类与待办

- 场景/golden 错：无。
- 策略差异：无；98～100期望均已复现。
- 书摘越界：无；书摘1～100门禁通过。
- 页码/手牌 JSON 错：无；3/3页码、页图、27张手牌和级牌一致。
- P0/P1：无。
- P2：smoke 中既有单步超时告警，不阻塞收官。

## 8. 百例收官结论

例98～100 的 JSON、书摘、Top1、93～97 回归、smoke 与 standalone 构建全部通过；永久跳过例85、例88已按规则处理。批次19 **PASS / CLOSED**，百例 51～100 收官完成。
