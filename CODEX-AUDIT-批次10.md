# CODEX-AUDIT-批次10

审计日期：2026-08-02  
项目：掼蛋教练 Pro；模式：只读复验  
范围：例 53～57  
基线：`git pull origin main` 后 `HEAD = origin/main = eec81bd`，`origin/main = eec81bd`，策略 rev38。

本次仅新增本报告；未修改 `strategy/`、`coach/`、训练 JSON、场景或测试，未 commit/push。

## 1. 摘要

| 项目 | 结果 |
|---|---|
| 手牌、级牌、权威 PDF 页码、页图 | 5/5 PASS |
| `extractCaseExcerpt()` 与 `narrative.summary` | 5/5 PASS；hand-labeler 已覆盖例1～57 |
| 功能 Top1 | 5/5 PASS；例54 structure 偏序也通过 |
| 48～52 回归 | PASS |
| smoke | PASS |
| rev 静态核对 | 源码与 standalone 均 rev38 |
| 结论 | **仓库数据/策略门禁 PASS；任务包例57页码说明需更正** |

## 2. JSON、页码与页图

PDF 页码以 `training-samples/case-page-map.json` 为唯一权威；页图按 `source.assets.pagePng` 相对项目根目录解析。

| 例号 | 任务包页码 | 权威 map 页码 | 级牌 | 场景 | 手牌 | `needsUserVerify` | 页图 | 结论 |
|---:|---:|---:|---|---|---:|---|---|---|
| 53 | 103 | 103 | 8 | follow TWP/10 | 27 | false | `assets/guandan-100cases/case-053-page103.png` 存在 | PASS |
| 54 | 106 | 106 | 4 | structure | 27 | false | `assets/guandan-100cases/case-054-page106.png` 存在 | PASS |
| 55 | 108 | 108 | 2 | follow 34567 | 27 | false | `assets/guandan-100cases/case-055-page108.png` 存在 | PASS |
| 56 | 109 | 109 | 6 | follow 55522 | 27 | false | `assets/guandan-100cases/case-056-page109.png` 存在 | PASS |
| 57 | **111（任务包）** | **112（权威）** | A | open | 27 | false | `assets/guandan-100cases/case-057-page112.png` 存在；page111 图不存在 | **任务包页码冲突** |

`node tools/audit-case-json.mjs case-053 case-054 case-055 case-056 case-057` 退出码 0；5 例均为 27 张、无需用户复核、级牌与场景级牌一致。例57 的 JSON、页图和 `case-page-map.json` 三者一致，冲突仅在任务包表格的 111。

## 3. 书摘边界与 JSON 对齐

`extractCaseExcerpt(cleanedText, n) === case-NNN.json.narrative.summary`：5/5 PASS。`node tests/hand-labeler-excerpt.mjs` 退出码 0，输出例1～57 书摘边界全部通过。

| 例号 | 摘要长度 | 应止于 | 越界核对 | JSON 对齐 |
|---:|---:|---|---|---|
| 53 | 148字 | 跨页至“用两个红配组同花顺” | 不含“注意,掼蛋抢头游” | PASS |
| 54 | 98字 | “一种牌型打到底” | 不含“同样,还是要分析牌力” | PASS |
| 55 | 106字 | “10JQKA 杂花顺” | 不含“他所需要的牌型” | PASS |
| 56 | 79字 | “667788三连对” | 不含“让给对家上” | PASS |
| 57 | 161字 | “单牌太多” | 不含“怨,我没有对子呀” | PASS |

## 4. Top1 三方对照

| 例号 | 书中要求/原则 | 场景期望 | 实测 quick / full | 结论 | 根因分类 |
|---:|---|---|---|---|---|
| 53 | 上 `AAA22` 管三带对，后续对3、对8回手 | `TWP/A`（AAA22） | `TWP/A` 11ms / 433ms | PASS | 无 |
| 54 | 拆 `10JQKA`，用对 A、对 J 配合搭档持续打对子 | `Pair/A > Straight/A` | structure golden：`Pair/A` 优于 `Straight/A` | PASS | 无 |
| 55 | 跟 `34567` 上 `8910JQ`，明确为杂色顺子，非同花顺 | `Straight/Q` | `Straight/Q` 4ms / 4ms | PASS | 无 |
| 56 | 跟 `55522` 过三个 Q 带对9 | `TWP/Q` | `TWP/Q` 1ms / 339ms | PASS | 无 |
| 57 | 领出 `A2345`，回手 `678910`，不要硬留三连对 | `Straight/5` | `Straight/5` 109ms / 114ms | PASS | 无 |

例55 的前手 `34567` 为混色牌，Top1 为 `Straight/Q`，没有回退成 `StraightFlush/A`。

## 5. 既有回归与 smoke

| 命令 | 结果 |
|---|---|
| `node tests/case-scenario-top1-53-57.mjs` | PASS；5/5，所有 quick/full <5s |
| `node tests/case-scenario-top1-48-52.mjs` | PASS；48～52 全部通过 |
| `node tests/smoke.mjs` | PASS；退出码0，机器人三家连推 451ms |

smoke 仍输出若干“机器人单步超时、保留已算推荐”告警，最大约 3589ms；未导致 smoke 失败，也未影响本批次 Top1，列为既有 P2 观察项。

## 6. rev 静态核对

- `strategy/sf-runway-guard.mjs:20`：`COACH_STRATEGY_REVISION = 38`。
- `guandan-coach-standalone.html` 内嵌源码包含 rev38，未发现 rev37 残留。
- standalone 含 `globalThis.__GUANDAN_BUILD__` 构建标记。
- `HEAD = origin/main = eec81bd`。

## 7. 失败分类与 Cursor 待办

- 场景/golden 错：无。
- 策略差异：无；53～57 期望均已复现。
- 书摘越界：无。
- 页码/手牌 JSON 错：仓库数据无错；仅任务包把例57写成111，需改为权威 map 的112，并使用 `case-057-page112.png`。
- P0/P1：无。
- P2：smoke 中既有单步超时告警，不阻塞本批次。

## 8. 结论

批次10 例53～57 的 JSON、书摘、Top1、回归和 smoke 均通过；例55 非同花顺约束、例54 structure 偏序均通过。按权威 `case-page-map.json`，仓库审计 **PASS**；仅需 Cursor 将任务包例57 PDF 页码从111修正为112，避免文档口径不一致。
