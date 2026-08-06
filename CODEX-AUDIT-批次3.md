# CODEX AUDIT 批次3：《掼蛋实战100例》例 18～22

- 项目：掼蛋教练 Pro
- 审计日期：2026-07-16
- 审计范围：例 18～22 的页码/页图文件、书摘边界、手牌 JSON、级牌、场景候选与教练 Top1
- 策略版本：rev 14（`COACH_STRATEGY_REVISION=14`、`REQUIRED_STRATEGY_REVISION=14`）
- 协作约束：Codex 只读复验；未修改业务代码、训练 JSON 或 `strategy/`

## 1. 摘要

| 审计项 | 通过 | 待修 | 结论 |
|---|---:|---:|---|
| PDF 页码与页图文件 | 5/5 | 0 | PDF 41/42/44/46/47 均与 `case-page-map.json` 一致，PNG 文件存在 |
| 手牌、确认状态与级牌 | 5/5 | 0 | 均为 27 张、`needsUserVerify=false`、`userVerified=true`、`v1-final`，JSON/场景级牌一致 |
| 书摘边界与 JSON 摘要 | 5/5 | 0 | 例 18～22 均无越界，`narrative.summary` 全部对齐 cleaned |
| 场景候选 | 5/5 | 0 | 每例 `prefer` 与 `over` 候选均存在；全量 50/50 候选门禁通过 |
| 教练 Top1 | 4/5 | 1 | 例 18/19/20/22 通过；例 21 虽为 `TripleWithPair/2`，但 quick/full 分别是 22299/22266，不是 22233 |

**结论：批次 3 的数据、书摘和场景门禁通过；rev 14 Top1 仍有例 21 带牌对子不一致。批次 3 保持 OPEN。**

## 2. 页码与 JSON 清单

| 例号 | PDF 页 | 书眉 | 页码匹配 | 页图存在 | 手牌 | 级牌 JSON/场景 | 定稿状态 |
|---:|---:|---:|---|---|---:|---|---|
| 18 | 41 | 030 | 是 | 是 | 27 | 3 / 3 | `v1-final` |
| 19 | 42 | — | 是 | 是 | 27 | A / A | `v1-final` |
| 20 | 44 | — | 是 | 是 | 27 | 7 / 7 | `v1-final` |
| 21 | 46 | — | 是 | 是 | 27 | 2 / 2 | `v1-final` |
| 22 | 47 | 036 | 是 | 是 | 27 | 5 / 5 | `v1-final` |

五例均为 `needsUserVerify=false`、`userVerified=true`，无需用户在 hand-labeler 补牌。

## 3. 书摘复验

| 例号 | 书摘要点 | 边界 | JSON 摘要 |
|---:|---|---|---|
| 18 | 上家首发单2，应迅速顺4 | PASS | 与 cleaned 一致 |
| 19 | 进贡大王后首发，先出单2 | PASS | 与 cleaned 一致 |
| 20 | 上家首发单5，应迅速过6 | PASS | 与 cleaned 一致 |
| 21 | 对手 AAA 带对封住搭档，应拆出22233管封 | PASS | 与 cleaned 一致 |
| 22 | 中性牌力首发 A2345，有打有收 | PASS | 与 cleaned 一致 |

`node tests/hand-labeler-excerpt.mjs` 已覆盖例 1～22并通过；例 18～22 的 `narrative.summary` 全部通过一致性断言。

## 4. 教练 Top1 复验

| 例号 | 路径 | 实测 Top1 | 耗时 | 期望 | 结论 |
|---:|---|---|---:|---|---|
| 18 | quick | `Single/4`（单4） | 96 ms | 单4 | PASS |
| 18 | full | `Single/4`（单4） | 6 ms | 单4 | PASS |
| 19 | quick | `Single/2`（单2） | 20 ms | 单2 | PASS |
| 19 | full | `Single/2`（单2） | 16 ms | 单2 | PASS |
| 20 | quick | `Single/6`（单6） | 49 ms | 单6 | PASS |
| 20 | full | `Single/6`（单6） | 4 ms | 单6 | PASS |
| 21 | quick | `TripleWithPair/2`（22299） | 27 ms | 22233 | **FAIL** |
| 21 | full | `TripleWithPair/2`（22266） | 68 ms | 22233 | **FAIL** |
| 22 | quick | `Straight/5`（A2345） | 14 ms | A2345 | PASS |
| 22 | full | `Straight/5`（A2345） | 12 ms | A2345 | PASS |

## 5. 已修改文件列表

**业务文件：无。**Codex 未修改代码、策略、测试、场景或训练数据。

本文件 `CODEX-AUDIT-批次3.md` 是本轮唯一审计产物。

## 6. 测试结论

| 命令/检查 | 结果 | 证据摘要 |
|---|---|---|
| rev 14 源码版本核对 | PASS | `COACH_STRATEGY_REVISION=14`、`REQUIRED_STRATEGY_REVISION=14` |
| `node tests/hand-labeler-excerpt.mjs` | PASS | 例 1～22 书摘边界全部通过；例 18～22 JSON 摘要对齐 cleaned |
| `node tests/case-scenario-top1-18-22.mjs` | PASS，但存在假阳性 | 脚本只检查例 21 的类型与 `mainRank=2`，未检查 kicker；因此 22299/22266 也会通过 |
| 例 21 候选逐张只读复核 | FAIL | quick 卡牌为 `2,2,2,9,9`；full 为 `2,2,2,6,6`；期望均为 `2,2,2,3,3` |
| `node tools/audit-case-json.mjs 18 19 20 21 22` | PASS | 例 18～22 均列入 A 完整定稿，B/C/D 无目标例待修 |
| `node tools/inspect-case-plays.mjs 18 19 20 21 22` | PASS | 五例 `prefer`/`over` 候选全部存在 |
| `node tools/validate-case-scenarios.mjs training-samples/cases/case-scenarios-1-50.json` | PASS | 50/50 候选齐全，0 待修 |
| `case-page-map.json` 与页图文件核对 | PASS | 五例 JSON 页码均匹配映射，PNG 文件全部存在 |

### 批次结论

1. 例 18～22 的页码、页图文件、27 张手牌、级牌、确认状态与定稿元数据均通过。
2. 例 18～22 书摘边界和 JSON 摘要均通过。
3. 例 18 单4、例 19 单2、例 20 单6、例 22 A2345 均符合书摘；例 21 quick/full 分别为 22299/22266，未达到 22233。
4. **批次 3 保持 OPEN；待例 21 Top1 kicker 修正并补充逐张断言后再复验。**
