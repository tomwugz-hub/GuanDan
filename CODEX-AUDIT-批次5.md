# CODEX-AUDIT-批次5（任务 J）· 关门复验

审计日期：2026-07-28  
审计方式：只读复验；未修改 `strategy/`、`coach/`、训练 JSON、场景数据或 golden。  
复验基线：`origin/main@49cae78`，策略 `rev32`。  
关门结论：**CLOSED**。

## 1. 摘要

| 项目 | 结论 |
|---|---|
| Git 基线 | 本地 `main` 与 `origin/main` 均为 `49cae78` |
| 例 28～32 数据定稿 | PASS |
| 例 28～32 书摘 | PASS；测试范围已扩至例 32，五个 JSON 均与 cleaned 文本对齐 |
| 例 28～32 Top1 | PASS；quick/full 全部符合修正后的书中原则 |
| 例 23～27 回归 | PASS；例 26 按测试设计为 structure 跳过 |
| smoke | PASS；完整输出“掼蛋教练 Pro：全部冒烟测试通过” |
| 最终状态 | 批次 5 可以关门 |

## 2. 数据、页码与书摘

PDF 页码继续以 `case-page-map.json` 为准。例 28～32 的 JSON、页图路径、手牌、级牌均维持前次审计确认的正确状态。

| 例号 | PDF 页 | 页图 | 手牌 | needsUserVerify | 级牌 | 书摘 |
|---:|---:|---|---:|---|---|---|
| 28 | 57 | `case-028-page57.png` | 27 | false | 2 | PASS |
| 29 | 58 | `case-029-page58.png` | 27 | false | J | PASS |
| 30 | 60 | `case-030-page60.png` | 27 | false | 6 | PASS |
| 31 | 62 | `case-031-page62.png` | 27 | false | Q | PASS |
| 32 | 63 | `case-032-page63.png` | 27 | false | 6 | PASS |

`node tests/hand-labeler-excerpt.mjs` 本次明确输出：

- `hand-labeler-excerpt: 例1～32 书摘边界全部通过`
- `case-028.json`～`case-032.json` 的 `narrative.summary` 均已对齐 cleaned 文本

前次发现的例 28～32 书摘越界和测试覆盖不足均已关闭。

## 3. Top1 关门复验

| 例号 | 期望 Top1 | 审计结论 |
|---:|---|---|
| 28 | Pair/5 | PASS |
| 29 | Plane/10 | PASS |
| 30 | Straight/J | PASS |
| 31 | Straight/8 | PASS |
| 32 | Single/3 | PASS |

### quick/full 实测明细

| 例号 | 场景 | 修正后期望 | quick 实际 | full 实际 | 结论 |
|---:|---|---|---|---|---|
| 28 | 跟对3 | Pair/5 | Pair/5（12ms） | Pair/5（24ms） | PASS |
| 29 | 跟 555666 | Plane/10 | Plane/10（3ms） | Plane/10（4ms） | PASS |
| 30 | 跟杂色 A2345 | Straight/J | Straight/J（6ms） | Straight/J（6ms） | PASS |
| 31 | 跟杂色 A2345 | Straight/8 | Straight/8（6ms） | Straight/8（502ms） | PASS |
| 32 | 主动首发、助攻 | Single/3 | Single/3（10ms） | Single/3（9ms） | PASS |

确认：

- 例 29 的 C100 快路径已不再 Pass。
- 例 30 已按书中 `78910J 杂花顺` 对齐为 `Straight/J`。
- 例 31 已按书中 `45678 杂花顺` 对齐为 `Straight/8`。
- 例 32 quick/full 均首发单3，不再出现对3或单5漂移。
- 五例 quick/full 均低于 5 秒。

## 4. rev 与基线

- `git fetch origin`、`git checkout main`、`git pull origin main` 执行成功。
- 本地 `HEAD`：`49cae78`。
- `origin/main`：`49cae78`。
- 提交说明：`fix(100cases): 批次5 例28-32 书摘/场景/策略对齐 rev32`。
- `strategy/sf-runway-guard.mjs`：`COACH_STRATEGY_REVISION = 32`。

## 5. 测试结论

| 命令 | 退出码 | 结论 |
|---|---:|---|
| `node tools/audit-case-json.mjs case-028 case-029 case-030 case-031 case-032` | 0 | PASS；例 28～32 均位于完整定稿集合 |
| `node tests/hand-labeler-excerpt.mjs` | 0 | PASS；例 1～32 边界通过，例 28～32 JSON 对齐 |
| `node tests/case-scenario-top1-28-32.mjs` | 0 | PASS；五例 quick/full 全通过 |
| `node tests/case-scenario-top1-23-27.mjs` | 0 | PASS；前批回归通过 |
| `node tests/smoke.mjs` | 0 | PASS；完整 smoke 约 177 秒 |

`smoke` 中“机器人三家连推计算耗时”为 2609ms，仍低于本批场景要求的 5 秒；测试整体退出码为 0。

## 6. 文件变更与关门

- Codex 本次仅更新 `CODEX-AUDIT-批次5.md`。
- 未修改代码、策略、教练模块、训练 JSON、场景数据或测试。
- 未 stage、commit 或 push。
- 批次 5 的数据、书摘、Top1、前批回归和 smoke 均通过，结论正式由 **OPEN → CLOSED**。
