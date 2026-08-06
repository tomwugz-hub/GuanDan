# CODEX AUDIT 批次2：《掼蛋实战100例》例 13～17

- 项目：掼蛋教练 Pro
- 审计日期：2026-07-16
- 审计范围：例 13～17 的 PDF 页码、页图、书摘边界、手牌 JSON、级牌、场景候选与教练 Top1
- 策略版本：rev 13（源码与专项门禁已确认；本轮页脚目视因 Codex 闪退后浏览器控制不可用而待确认）
- 协作约束：本次只读审计；Codex 未修改业务代码、训练 JSON 或 `strategy/` 目录
- 关门复验：2026-07-16 本机只读复验通过；数据/书摘/场景项关闭，策略项单列待迭代

## 1. 摘要

| 审计项 | 通过 | 待修/待确认 | 结论 |
|---|---:|---:|---|
| PDF 页码与页图 | 5/5 | 0 | PDF 32/34/35/38/39 分别为例 13/14/15/16/17，页图存在且内容正确 |
| 手牌数量与确认状态 | 5/5 | 0 | 均为 27 张，`needsUserVerify=false`、`userVerified=true`、`verify.revision=v1-final` |
| 级牌 | 5/5 | 0 | 例 14 已修为 J，JSON 与场景同步；其余 4 例保持一致 |
| 书摘边界 | 5/5 | 0 | 例 13～17 提取书摘无越界，且 `narrative.summary` 全部与提取结果一致 |
| 场景候选存在性 | 5/5 | 0 | 每例的 `prefer` 与 `over` 候选均可生成 |
| 策略专项 | 3/3 | 0 | 例 14、16、17 Top1 专项全部通过；例 17 评分门禁通过 |
| rev 13 页脚目视 | 0/1 | 1 | 源码已是 rev 13；浏览器在读取页脚前随 Codex 闪退，待用户或后续浏览器复验确认 |

**汇总：**数据/书摘/场景保持关门；rev 13 专项中例 14 Top1 222、例 16 quick/full 23456、例 17 emergency/quick/full 667788 及例 17 评分门禁全部通过。仅 rev 13 页脚实际目视因 Codex 闪退后浏览器控制不可用而待确认。

## 2. 页码问题清单

**PDF 页码问题：无。**PDF 页码以 `training-samples/case-page-map.json` 为准。

| 例号 | PDF 页 | 页图文件 | 书眉 | 页图是否正确 | 备注 |
|---:|---:|---|---:|---|---|
| 13 | 32 | `case-013-page32.png` | 021 | 是 | 页图标题为“实战第 13 例技巧分析” |
| 14 | 34 | `case-014-page34.png` | 023 | 是 | 页图标题为“实战第 14 例技巧分析” |
| 15 | 35 | `case-015-page35.png` | 024 | 是 | 页图标题为“实战第 15 例技巧分析” |
| 16 | 38 | `case-016-page38.png` | 027 | 是 | 页图标题为“实战第 16 例技巧分析” |
| 17 | 39 | `case-017-page39.png` | 028 | 是 | 页图标题为“实战第 17 例技巧分析” |

### 书摘边界复验

| 例号 | 本例有效内容终点 | 越界检查 | 结论 |
|---:|---|---|---|
| 13 | 拆六个 4，组成 A2345 与 34567 同花顺 | 无报牌制/比赛规则混入 | PASS |
| 14 | 先出 222，避免先出 34567 | 无记分及比赛规则混入 | PASS |
| 15 | 组成 34567、45678 两套顺子及后续组牌 | 无比赛争议或“第二讲”混入 | PASS |
| 16 | 先出 23456，后续过 78910J、对 8、对 A | 无通用搭档讲义混入 | PASS |
| 17 | 出 667788，立牌后给搭档送 33322 | 无第 40 页或后续讲义混入 | PASS |

`node tests/hand-labeler-excerpt.mjs` 已扩展覆盖例 1～17并通过；另以 `extractCaseExcerpt` 直接核对例 13～17，结果为 0/5 越界、5/5 与 `narrative.summary` 完全一致。

## 3. 手牌待确认清单

**需要用户在 hand-labeler 补满 27 张的例：无。**

| 例号 | 手牌张数 | `needsUserVerify` | `userVerified` | JSON 级牌 | 书中级牌 | 页图存在 | 待办 |
|---:|---:|---|---|---|---|---|---|
| 13 | 27 | false | true | 9 | 9 | 是 | 无 |
| 14 | 27 | false | true | J | J | 是 | 已同步场景 `levelRank=J` |
| 15 | 27 | false | true | A | A | 是 | 无 |
| 16 | 27 | false | true | 4 | 4 | 是 | 无 |
| 17 | 27 | false | true | 5 | 5 | 是 | 无 |

例 14 的页图文字清楚显示“此牌打 J”；当前 `game.levelRank` 与场景 `levelRank` 均已修为 J。OCR 书摘中的“此牌打了”仍是原文识别字形问题，不影响结构化级牌字段。

## 4. 策略专项复验

| 例号 | 路径 | 实测 Top1 | 耗时 | 期望 | 结论 |
|---:|---|---|---:|---|---|
| 14 | quick | `Triple/2`（222） | 54 ms | 222 | PASS |
| 14 | full | `Triple/2`（222） | 93 ms | 222 | PASS |
| 16 | quick | `Straight/6`（23456） | 20 ms | 23456，且小于 50 ms | PASS |
| 16 | full | `Straight/6`（23456） | 29 ms | 23456，且小于 50 ms | PASS |
| 17 | emergency | `ConsecutivePairs/8`（667788） | 13 ms | 667788 | PASS |
| 17 | quick | `ConsecutivePairs/8`（667788） | 28 ms | 667788 | PASS |
| 17 | full | `ConsecutivePairs/8`（667788） | 17 ms | 667788 | PASS |

### 例 17 评分单列

`validate-scenario-scores` 对例 17 的本轮只读复验结果为：

```text
全部评分通过
```

例 17 评分项已从原单列失败关闭为 PASS。

## 5. 已修改文件列表

**业务文件：无。**Codex 未修改策略、教练、应用、测试、训练 JSON 或其他业务代码。

本文件 `CODEX-AUDIT-批次2.md` 是本次唯一审计产物。评分复验使用的临时场景子集已删除，不留工作区文件。

## 6. 测试结论

| 命令/检查 | 结果 | 证据摘要 |
|---|---|---|
| 页图逐张目视 | PASS | PDF 32/34/35/38/39 分别显示例 13/14/15/16/17，书眉 021/023/024/027/028 |
| `node tools/audit-case-json.mjs 13 14 15 16 17` | PASS（结构门禁） | 例 13～17 均列入 A 完整定稿；该工具未发现例 14 书图级牌冲突及书摘越界 |
| `node tools/inspect-case-plays.mjs 13 14 15 16 17` | PASS | 5 例的 `prefer`/`over` 候选全部存在 |
| `node tools/validate-case-scenarios.mjs training-samples/cases/case-scenarios-1-50.json` | PASS | 50/50 候选齐全，0 待修 |
| `node tests/hand-labeler-excerpt.mjs` | PASS | 例 1～17 书摘边界全部通过；例 13～17 `narrative.summary` 全部对齐 cleaned |
| `extractCaseExcerpt` 例 13～17 直接复核 | PASS 5/5 | 0 例越界；5 例均与 `narrative.summary` 完全一致 |
| rev 13 源码版本核对 | PASS | `COACH_STRATEGY_REVISION = 13`，`REQUIRED_STRATEGY_REVISION = 13` |
| 例 14 级牌与场景 | PASS | `game.levelRank=J`，场景 `levelRank=J`，`Triple/2` 候选存在 |
| 例 17 席位与场景 | PASS | `lastActive=1`、`passTail=2`，`ConsecutivePairs/8` 候选存在 |
| `node tests/case-scenario-top1-14-16-17.mjs` | PASS | 例 14 quick/full 为 222（54/93 ms）；例 16 为 23456（20/29 ms）；例 17 emergency/quick/full 为 667788（13/28/17 ms） |
| `node tools/validate-scenario-scores.mjs`（例 17 子集） | PASS | 输出“全部评分通过” |
| 游戏页页脚 rev 13 目视 | BLOCKED | 页面已打开，但在读取页脚前 Codex 闪退；恢复后浏览器控制组件缺失，未用替代方式冒充目视结论 |

### 批次结论

1. 例 13～17 的 PDF 页码、页图文件、手牌张数和用户确认状态可关闭。
2. 例 13～17 书摘边界、JSON 摘要、例 14 级牌 J 与场景同步、例 17 `lastActive=1` 均通过。
3. 例 14、16、17 策略专项与例 17 评分门禁已通过，可关闭策略 OPEN 项。
4. rev 13 源码版本已确认；页脚实际目视仍待确认，因此批次 2 完整 UI 关门暂差此一项。
5. 本次保持只读，不修改代码或训练数据。
