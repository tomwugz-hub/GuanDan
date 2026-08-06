# CODEX-AUDIT-批次15

审计日期：2026-08-05  
项目：掼蛋教练 Pro；模式：只读复验  
范围：例 78～82  
基线：`git pull origin main` 后 `HEAD = origin/main = 72e2993`，策略 rev43。

本次仅新增本报告与任务包；未修改 `strategy/`、`coach/`、训练 JSON、场景或测试，未 commit/push。

## 1. 摘要

| 项目 | 结果 |
|---|---|
| 手牌、级牌、权威 PDF 页码、页图 | 5/5 PASS |
| `extractCaseExcerpt()` 与 `narrative.summary` | 5/5 PASS；hand-labeler 已覆盖例1～82 |
| 功能 Top1 | 5/5 PASS |
| 73～77 回归 | PASS |
| smoke | PASS |
| rev 静态核对 | 源码与 standalone 均 rev43 |
| 结论 | **远端 rev43 审计 PASS · CLOSED** |

## 2. JSON、页码与页图

PDF 页码唯一以 `training-samples/case-page-map.json` 为准；页图按 `source.assets.pagePng` 相对项目根目录解析。

| 例号 | PDF页 | 级牌 | 场景 | 期望 | 手牌 | `needsUserVerify` | 页图 | 结论 |
|---:|---:|---|---|---|---:|---|---|---|
| 78 | 149 | 4 | open | `Straight/7` | 27 | false | `assets/guandan-100cases/case-078-page149.png` 存在 | PASS |
| 79 | 151 | 2 | follow 222 | `Bomb/3` | 27 | false | `assets/guandan-100cases/case-079-page151.png` 存在 | PASS |
| 80 | 153 | 5 | open | `Straight/5` | 27 | false | `assets/guandan-100cases/case-080-page153.png` 存在 | PASS |
| 81 | 154 | A | open | `Single/3` | 27 | false | `assets/guandan-100cases/case-081-page154.png` 存在 | PASS |
| 82 | 156 | A | follow 23456 | `Straight/9` | 27 | false | `assets/guandan-100cases/case-082-page156.png` 存在 | PASS |

`node tools/audit-case-json.mjs case-078 case-079 case-080 case-081 case-082` 退出码 0；5 例均为 27 张、无需用户复核、级牌与场景级牌一致。

## 3. 书摘边界与 JSON 对齐

`extractCaseExcerpt(cleanedText, n) === case-NNN.json.narrative.summary`：5/5 PASS。`node tests/hand-labeler-excerpt.mjs` 退出码 0，输出例1～82 书摘边界全部通过。

| 例号 | 摘要长度 | 应止于 / 重点 | 越界核对 | JSON 对齐 |
|---:|---:|---|---|---|
| 78 | 100字 | 「静等三带对的到来。」 | 不含第十讲残局讲义 | PASS |
| 79 | 144字 | 「不可出333444)。」 | 不含「## 第152页」报牌讲义 | PASS |
| 80 | 223字 | 战术段止于「两个空弹沉底。」为宜 | **行内含「作为对手方对着干」报牌讲义滑入**（见 P2） | PASS（对齐一致） |
| 81 | 106字 | 「再等过单张 9.Q.Z,」 | 不含后续抗贡泛论 | PASS |
| 82 | 78字 | 「红配组成四个4。」 | 不含「把他放在N张牌」（已截断） | PASS |

例78～82 进入第十讲「如何打好残局牌 / 报牌制」过渡区；例82 已用 bleed 规则截断报牌讲义尾句。

## 4. Top1 三方对照

权威 Oracle：`training-samples/cases/case-scenarios-51-100.json`（书摘叙事与 golden 场景多处不一致，以场景为准）。

| 例号 | 书中叙事要点 | 场景期望 | 实测 quick / full | 结论 | 根因分类 |
|---:|---|---|---|---|---|
| 78 | 拆四2组23456/222 | `Straight/7`（34567减手） | `Straight/7` 6ms / 29ms | PASS | 场景 Oracle |
| 79 | 上家首发单3探路（书摘为 open 叙事） | `Bomb/3`（四3炸管222） | `Bomb/3` 5ms / 18ms | PASS | 场景 Oracle；红配补炸直建 |
| 80 | 先出22244再杂花顺 | `Straight/5`（A2345有打有收） | `Straight/5` 1ms / 5ms | PASS | 场景 Oracle |
| 81 | 先出45678杂花顺 | `Single/3`（强牌小单探路） | `Single/3` 0ms / 4ms | PASS | 场景 Oracle |
| 82 | 末家556677管223344（书摘为连对叙事） | `Straight/9`（56789管23456） | `Straight/9` 60ms / 85ms | PASS | 场景 Oracle；四9+红配代8 |

## 5. 既有回归与 smoke

| 命令 | 结果 |
|---|---|
| `node tests/case-scenario-top1-78-82.mjs` | PASS；5/5，所有 quick/full <5s |
| `node tests/case-scenario-top1-73-77.mjs` | PASS；73～77 全部通过 |
| `node tests/smoke.mjs` | PASS；退出码0，「全部冒烟测试通过」 |

smoke 仍输出若干「机器人单步超时、保留已算推荐」告警；未导致 smoke 失败，也未影响例78～82 Top1，列为既有 P2 观察项。

## 6. rev 静态核对

- `strategy/sf-runway-guard.mjs:20`：`COACH_STRATEGY_REVISION = 43`。
- `guandan-coach-standalone.html` 内嵌源码包含 rev43。
- standalone 含 `globalThis.__GUANDAN_BUILD__` 构建标记。
- 当前 `HEAD = origin/main = 72e2993`。

## 7. 失败分类与 Cursor 待办

- 场景/golden 错：无。
- 策略差异：无；78～82 期望均已复现。
- 书摘越界：例80 行内 bleed 未截断（P2，不阻塞 Top1）。
- 页码/手牌 JSON 错：无；5/5 页码、页图、27张手牌和级牌一致。
- P0/P1：无。
- P2：
  - 例80 书摘含「作为 opponent 对着干」报牌讲义段（223字）；`/^作为对手方对着干/` 仅匹配行首，hand-labeler 未告警；后续批次可改 `INLINE_TEACHING_BLEED` 行内截断。
  - smoke 中既有单步超时告警，不阻塞本批次。

## 8. 结论

在远端 `origin/main` rev43 基线上，例78～82 的 JSON、书摘对齐、Top1、73～77 回归和 smoke 全部通过；例79 四3炸（红配补炸）直建、例82 56789（红配代8）顺管均按规格处理。批次15 **审计 PASS · CLOSED**。
