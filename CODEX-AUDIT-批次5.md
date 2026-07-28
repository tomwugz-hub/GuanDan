# CODEX-AUDIT-批次5（任务 J）

审计日期：2026-07-28  
审计方式：只读复验；未修改 `strategy/`、`coach/`、训练 JSON 或场景数据。  
当前基线：`d306fc6`（任务包所述 `d26d1f4` 的后一提交，包含例 28 修复与批次 5 golden 骨架）。  
关门结论：**OPEN**。例 28 通过；例 29、32 为可复现策略差异；例 30、31 的现有场景期望与书中原文不符，须先修正场景/golden 后再评策略。

## 1. 摘要

| 项目 | 结论 |
|---|---|
| 例 28～32 手牌 | 5/5 均为 27 张，`needsUserVerify=false` |
| 级牌 | 5/5 与书摘“打 X”一致 |
| PDF/页图 | JSON 与 `case-page-map.json` 一致，5/5 页图存在 |
| 书摘动态截取 | `extractCaseExcerpt()` 可正确截出五例正文 |
| 定稿 JSON 书摘 | 5/5 的 `narrative.summary`、`authorPlan.summary` 未与动态截取对齐，均混入页眉或后续通用讲义 |
| Top1 | 例 28 通过；例 29、32 失败；例 30 自动测试虽通过但 golden 错；例 31 自动测试失败且 golden 错 |
| 前批回归 | 例 23～27 通过（例 26 按测试设计仅做 structure 跳过） |
| smoke | 完整通过 |

## 2. 数据、页码与书摘

`case-page-map.json` 是 PDF 页码权威来源。任务包表格中的例 30～32 页码 `59/60/61` 不正确；正确值为 `60/62/63`，现有 JSON 和 PNG 文件已经使用正确页码，不应按任务包回改。

| 例号 | PDF 页（权威） | JSON/PNG | 手牌 | needsUserVerify | 级牌 | 定稿 JSON 书摘 |
|---:|---:|---|---:|---|---|---|
| 28 | 57 | `case-028-page57.png` 存在 | 27 | false | 2 | FAIL：混入“2. 炸弹越多越好”等后续讲义 |
| 29 | 58 | `case-029-page58.png` 存在 | 27 | false | J | FAIL：混入第 59 页及后续通用讲义 |
| 30 | 60 | `case-030-page60.png` 存在 | 27 | false | 6 | FAIL：混入第 61 页及后续通用讲义 |
| 31 | 62 | `case-031-page62.png` 存在 | 27 | false | Q | FAIL：混入第 63 页及“三不带”讲义 |
| 32 | 63 | `case-032-page63.png` 存在 | 27 | false | 6 | FAIL：混入第 64 页及“二家不强拆”讲义 |

补充说明：

- `node tests/hand-labeler-excerpt.mjs` 返回 PASS，但脚本当前只循环例 1～27，也只校验到 `case-027.json`，**没有覆盖例 28～32**。
- 对例 28～32 直接调用 `extractCaseExcerpt()`，可得到边界正确的正文；但五个 JSON 的 `narrative.summary` 与 `authorPlan.summary` 均不等于该结果。
- 建议 Cursor 只修书摘字段与自动测试覆盖范围，不改手牌、级牌、PDF 页码或页图路径。

## 3. Top1 复验表

| 例号 | 场景 | 任务包期望 | 书中实际要求 | quick 实际 | full 实际 | 审计结论 |
|---:|---|---|---|---|---|---|
| 28 | 对手对3 | Pair/5 | 对5 | Pair/5（14ms） | Pair/5（156～173ms） | PASS；Cursor 例28修复复验通过 |
| 29 | 对手 555666 | Plane/10 | 999101010 飞机 | Pass（148～152ms） | Pass（237ms） | FAIL；场景与书摘一致，属于策略选择差异 |
| 30 | 对手 A2345 | StraightFlush/8 | **78910J 杂花顺，即 Straight/J** | StraightFlush/8（5ms） | StraightFlush/8（4ms） | 自动 golden PASS，但教纲审计 FAIL；先修场景/golden |
| 31 | 对手 A2345 | StraightFlush/10 | **45678 杂花顺，即 Straight/8** | StraightFlush/K（5ms） | StraightFlush/A（4ms） | FAIL；当前 golden 错，实际推荐也不符合书摘；先修场景/golden |
| 32 | 主动首发、助攻 | Single/3 | 单3 | Pair/3（13ms） | Single/5（650ms） | FAIL；场景与书摘一致，属于策略选择差异 |

注：正式 `case-scenario-top1-28-32.mjs` 在例 29 quick 首个失败处退出。为取得后续证据，本审计使用同一源码的内存诊断版本继续执行，未写入文件、未修改断言脚本。

## 4. 根因分类与交接建议

| 例号 | 分类 | 建议 |
|---:|---|---|
| 28 | 已修策略，复验通过 | 保留现有 golden |
| 29 | 教练策略差异 | 可按 Plane/10 补策略修复并保留 golden |
| 30 | 场景/golden 错误，同时当前 Top1 不合书摘 | 先把期望改为 Straight/J，再复验；不要按 StraightFlush/8 固化策略 |
| 31 | 场景/golden 错误，同时当前 Top1 不合书摘 | 先把期望改为 Straight/8，再复验；不要按 StraightFlush/10 改策略 |
| 32 | 教练策略差异 | 可按 Single/3 补策略修复并保留 golden |

批次公共数据待办：

1. 将例 28～32 的 `narrative.summary`、`authorPlan.summary` 对齐 `extractCaseExcerpt()`。
2. 将 `hand-labeler-excerpt.mjs` 的覆盖范围扩到至少例 32，并增加五个 JSON 对齐断言。
3. 更正任务包中的例 30～32 PDF 页码展示，但不要修改当前 JSON/PNG。

## 5. rev / standalone stamp

- 工作区策略源码：`COACH_STRATEGY_REVISION = 31`。
- 当前 `guandan-coach-standalone.html` 内嵌同一 `COACH_STRATEGY_REVISION = 31`，与源码一致。
- standalone 含构建戳 `1785197764770`；`tools/build-standalone.mjs` 通过 `Date.now()` 注入 `globalThis.__GUANDAN_BUILD__`，UI 页脚组合显示 build 与 rev。
- 本次未启动浏览器做肉眼页脚检查；源码与已生成 standalone 的 rev/stamp 链路静态一致。

## 6. 测试结论

| 命令 | 结果 | 备注 |
|---|---|---|
| `node tools/audit-case-json.mjs case-028 ... case-032` | PASS | 输出确认例 1～50 均属“完整定稿”；该工具没有给出本批逐字段详情，另做了只读定向核对 |
| `node tests/hand-labeler-excerpt.mjs` | PASS（覆盖不足） | 仅覆盖例 1～27，不能作为例 28～32 书摘通过证据 |
| `node tests/case-scenario-top1-28-32.mjs` | FAIL | 例 28 quick/full PASS；例 29 quick 期望 Plane/10，实际 Pass，脚本随即退出 |
| 同源内存诊断（例 28～32） | 完成 | 采集到例 29～32 quick/full 实际值，未落盘 |
| `node tests/case-scenario-top1-23-27.mjs` | PASS | 例 23/24/25/27 quick/full 通过；例 26 structure 跳过 |
| `node tests/smoke.mjs` | PASS | 完整运行约 191 秒；输出“掼蛋教练 Pro：全部冒烟测试通过” |

## 7. 文件变更与远端

- Codex 修改文件：仅新增本报告 `CODEX-AUDIT-批次5.md`。
- 未修改代码、策略、训练数据、场景或 golden；未 stage、commit、push。
- 当前本地 `main` 位于 `d306fc6`，`origin/main` 位于 `ab81ffd`，本地已有 3 个未推送提交。批次 5 只读审计本身不要求 push；建议 Cursor 完成上述数据/场景及策略修复、复验通过后再统一 push。
