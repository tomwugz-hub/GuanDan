# CODEX AUDIT 批次1：《掼蛋实战100例》例 1～12

- 项目：掼蛋教练 Pro
- 审计日期：2026-07-16
- 审计范围：例 1～12 的 PDF 页码、书摘边界、手牌/JSON、教练 Top1
- 策略版本：rev 12（`COACH_STRATEGY_REVISION = 12`）
- 协作约束：Codex 未修改 `strategy/` 目录。

## 1. 摘要

| 审计项 | 通过 | 待修/待确认 | 结论 |
|---|---:|---:|---|
| PDF 页码与页图 | 12/12 | 0 | 例 1～12 全部与 `case-page-map.json` 一致，页图文件均存在 |
| 手牌与级牌 | 12/12 | 0 | 均为 27 张，`needsUserVerify=false`、`userVerified=true`，级牌与场景一致 |
| 书摘边界 | 12/12 | 0 | 例 1～12 全部通过边界测试，`narrative.summary` 均已对齐 cleaned |
| JSON 定稿元数据 | 12/12 | 0 | 例 1～12 均为 `v1-final`（例 1 于 2026-07-16 补齐） |
| 教练 Top1（例 8～12） | 5/5 | 0 | 例 8、9、10、11、12 均与书摘一致，例 10/11 均小于 5 s |
| match-3 须压对 A 残局 | 1/1 | 0 | Top1 为同花顺一手走完，非对 6、非过牌 |
| 游戏页 rev 12 目视 | 1/1 | 0 | 用户截图确认侧栏底部 `策略 build … · rev 12`（2026-07-16） |

**汇总：**页码、书摘、手牌、JSON 定稿元数据、页脚 rev 12 目视、例 8～12 教练 Top1 和 match-3 须压对 A 回归均已关闭；教练出牌不一致 0 个，教练 P1 性能问题 0 个。例 17 评分失败单列、不阻塞批次 1。例 1～7 本批没有 Top1 专项实测，不计入教练一致/不一致数量。**批次 1 正式关门。**

## 2. 页码问题清单

**当前问题：无。** PDF 页码均以 `training-samples/case-page-map.json` 为准，不使用索引文件中的“约第 N 页”。

| 例号 | PDF 页 | 书眉页 | JSON 页码一致 | 页图存在 | 备注 |
|---:|---:|---:|---|---|---|
| 1 | 13 | — | 是 | 是 | 通过 |
| 2 | 15 | 004 | 是 | 是 | 通过 |
| 3 | 16 | — | 是 | 是 | 通过 |
| 4 | 18 | — | 是 | 是 | 通过 |
| 5 | 20 | — | 是 | 是 | 通过 |
| 6 | 21 | — | 是 | 是 | 通过 |
| 7 | 23 | 012 | 是 | 是 | 通过 |
| 8 | 25 | 014 | 是 | 是 | 注意：书眉 014 不是 PDF 第 14 页 |
| 9 | 26 | — | 是 | 是 | 通过 |
| 10 | 27 | 016 | 是 | 是 | 通过 |
| 11 | 29 | — | 是 | 是 | 通过 |
| 12 | 30 | — | 是 | 是 | 通过 |

### 书摘边界复验

| 例号 | 状态 | 问题 |
|---:|---|---|
| 7 | 已修复/复验通过 | Cursor 已修复越界讲义，本次 `hand-labeler-excerpt` 通过 |
| 9 | 已修复/复验通过 | Cursor 已修复越界讲义，本次 `hand-labeler-excerpt` 通过 |
| 10 | 已修复/复验通过 | Cursor 已修复越界讲义，本次 `hand-labeler-excerpt` 通过 |
| 11 | 已修复/复验通过 | `narrative.summary` 已移除“三连对”和下一页讲义，本次 `hand-labeler-excerpt` 通过 |
| 12 | 已修复/复验通过 | `narrative.summary` 已移除“三连三/钢板”等讲义，本次 `hand-labeler-excerpt` 通过 |

## 3. 手牌待确认清单

**无。** 例 1～12 全部满足：

- `hand.cards.length = 27`
- `hand.expectedCount = 27`
- `needsUserVerify = false`
- `userVerified = true`
- `game.levelRank` 与 `case-scenarios-1-50.json` 一致
- `source.assets.pagePng` 指向的 PNG 文件存在

例 1 已于 2026-07-16 将 `verify.revision` 补齐为 `v1-final`，`narrative.summary` 对齐 cleaned。

## 4. 教练不一致清单

| 例号 | 实测 Top1/表现 | 书摘期望 | 状态 | 严重度 | 结论 |
|---:|---|---|---|---|---|
| 8 | `88822` | `88822` 管 `55533`，不拆四 A | 一致 | — | rev 12 本复验通过 |
| 9 | `333` | `333` 管 `222` | 一致 | — | rev 12 UI quick 路径 0.987 s，无超时兜底 |
| 10 | 单 `10` | 单 `10` | 一致 | — | rev 12 Top1 golden 10 ms，UI emergency/quick/full 为 51/31/18 ms |
| 11 | 单 `9` | 单 `9` 管单 `4` | 一致 | — | rev 12 Top1 golden 7 ms，UI emergency/quick/full 为 5/25/22 ms，P1 性能项保持关闭 |
| 12 | `Pass` | 搭档单 4 占权后过牌保留结构 | 一致 | — | rev 12 本复验通过 |

说明：`tests/case-scenario-top1-8-12.mjs` 在 rev 12 硬断言例 8、10、11、12；例 9 由 rev 12 UI quick 路径单例复验。例 1～7 本批没有 Top1 专项实测，不计入教练一致/不一致数量。

### match-3 须压对 A 专项

| 路径 | Top1 | 禁止项 | 结论 |
|---|---|---|---|
| `humanAdviceFallback` | 同花顺一手走完 | 非对 6、非过牌 | PASS |
| `getTurnAdvice` | 同花顺一手走完 | 非对 6、非过牌 | PASS |

## 5. 已修改文件列表

**无。** Codex 在本批中只读审计，未修改策略、训练数据、JSON 或应用代码。

本文件 `CODEX-AUDIT-批次1.md` 仅为审计产物，不计入业务修改。

## 6. 测试结论

| 命令/检查 | 结果 | 证据摘要 |
|---|---|---|
| `node tests/dev-server-security.mjs` | PASS | 退出码 0，“dev-server-security: 全部通过” |
| `node tools/validate-case-scenarios.mjs training-samples/cases/case-scenarios-1-50.json` | PASS | 退出码 0，50/50 候选齐全，0 待修 |
| `node tools/audit-case-json.mjs 1 2 3 4 5 6 7 8 9 10 11 12` | PASS | 退出码 0；例 1～12 均列入【A 完整定稿】，【B 部分定稿】为空 |
| `node tests/hand-labeler-excerpt.mjs` | PASS（覆盖例 1～12） | 退出码 0；例 1～12 书摘边界全部通过，例 1/7/9/10/11/12 `narrative.summary` 对齐 cleaned |
| `node tests/case-scenario-top1-8-12.mjs` | PASS（覆盖例 8、10、11、12） | 退出码 0；例 8 `88822`、例 10 单 `10` (10 ms)、例 11 单 `9` (7 ms)、例 12 `Pass` |
| `node tests/case-scenario-ui-path-10-11.mjs` | PASS | 例 10 emergency/quick/full 均为单 `10` (51/31/18 ms)；例 11 均为单 `9` (5/25/22 ms) |
| `node tests/must-beat-pair-a-finish-sf-match3.mjs` | PASS | `humanAdviceFallback` 和 `getTurnAdvice` 均为同花顺一手走完，禁对 6/过牌 |
| `node tests/smoke.mjs` | PASS | 退出码 0，218.1 s，“掼蛋教练 Pro：全部冒烟测试通过”；期间有机器人单步超时改用毫秒兜底警告，未导致失败 |
| 例 9 rev 12 UI quick 单例 | PASS | Top1 `333`，0.987 s，无超时兜底 |
| `node tools/validate-scenario-scores.mjs training-samples/cases/case-scenarios-1-50.json` | 单列/不阻塞 | 历史复验例 17 输出 `FAIL follow 667788助攻管牌 (8675 vs -9600)`；按本次用户指示不作为批次 1 关门条件 |
| 游戏页页脚 rev 12 目视 | PASS | 用户截图确认 `策略 build 1784196121793 · rev 12`（2026-07-16） |

### 批次结论

1. 页码、页图、手牌数量、用户确认状态、级牌、书摘边界和 JSON 定稿元数据可关闭。
2. 教练 rev 12 的例 8～12 Top1 可关闭；例 10/11 各路径性能达标，match-3 须压对 A 为同花顺一手走完。
3. 例 17 评分失败按用户指示单列、不阻塞批次 1；本次不修改策略或代码。
4. **批次 1 已正式关门**（rev 12 命令行 + 用户页脚目视）；例 13～17 只读审计可启动。
