# CODEX-AUDIT-批次9

审计日期：2026-08-02  
项目：掼蛋教练 Pro ；模式：只读复验  
范围：例 48～52（例 51 含 structure + follow 两个场景）  
基线：`git pull origin main` 后 `HEAD = origin/main = e286fea`，`origin/main = e286fea`，策略 rev36。

本次仅新增本报告；未修改 `strategy/`、`coach/`、训练 JSON、场景或测试，未 commit/push。

## 1. 摘要

| 项目 | 结果 |
|---|---|
| 手牌、级牌、PDF 页码、页图 | 5/5 PASS |
| 书摘边界与 `narrative.summary` 对齐 | 5/5 PASS；`hand-labeler-excerpt` 已覆盖例1～52 |
| 功能 Top1 | 10/10 PASS（例51 的 structure + follow 均 PASS） |
| Top1 性能 | 例49 quick 首次 5085ms；复跑 4940ms、2401ms，均恢复到 5s 内 |
| 43～47 回归 | PASS |
| smoke | PASS |
| rev 静态核对 | 源码与 standalone 均 rev36 |
| 审计状态 | **功能数据 CLOSED；P1 性能波动 OPEN** |

严格按测试门槛，第一次 Top1 命令因例49 quick 超过 5 秒退出失败；随后两次完整复跑均通过。因此没有功能策略不一致，但性能门禁尚不能称为稳定绿灯。

## 2. JSON、页码与页图

PDF 页码唯一以 `training-samples/case-page-map.json` 为准；页图按 `source.assets.pagePng` 相对项目根目录解析。

| 例号 | PDF页 | 级牌 | 场景 | 期望 | 手牌 | `needsUserVerify` | 页图 | JSON结论 |
|---:|---:|---|---|---|---:|---|---|---|
| 48 | 96 | 4 | structure | `SF/9 > Bomb/6` | 27 | false | `assets/guandan-100cases/case-048-page96.png` 存在 | PASS |
| 49 | 97 | 8 | follow TWP | `TWP/A` | 27 | false | `assets/guandan-100cases/case-049-page97.png` 存在 | PASS |
| 50 | 99 | 3 | follow 杂花顺 | `Straight/A` | 27 | false | `assets/guandan-100cases/case-050-page99.png` 存在 | PASS |
| 51 | 101 | 4 | structure | `SF/9 > Bomb/8` | 27 | false | `assets/guandan-100cases/case-051-page101.png` 存在 | PASS |
| 51 | 101 | 4 | follow 34567 | `Straight/8` | 27 | false | 同上 | PASS |
| 52 | 102 | Q | follow 23456 | `Straight/10` | 27 | false | `assets/guandan-100cases/case-052-page102.png` 存在 | PASS |

`node tools/audit-case-json.mjs case-048 case-049 case-050 case-051 case-052` 退出码 0；工具报告 A 完整定稿集无 B/C/D 缺项。

## 3. 书摘边界

`extractCaseExcerpt(cleanedText, n) === case-NNN.json.narrative.summary`：例48～52 全部 PASS。以下边界按去除 OCR 空格后的语义核对，未发现通用讲义混入：

| 例号 | 应止于 | 越界核对 | 结论 |
|---:|---|---|---|
| 48 | “单牌越少越好” | 不含“比如,上家出了个杂花顺” | PASS |
| 49 | “继续出三带对” | 不含第二家讲义 | PASS |
| 50 | “组炸弹四个6、四个7” | 摘要在该战术句结束 | PASS |
| 51 | “梅花同花顺”战术句 | 不含“二家和第三家没表态” | PASS |
| 52 | “QQQ88回手” | 不含“牌弱打上家”讲义 | PASS |

`node tests/hand-labeler-excerpt.mjs` 退出码 0，输出“例1～52 书摘边界全部通过”，并逐例报告 48～52 的 JSON 摘要已对齐。

## 4. Top1 三方对照

| 例号 | 书中要点 | 场景/golden 期望 | quick / full 实际 | 功能结论 | 根因分类 |
|---:|---|---|---|---|---|
| 48 | 拆六头大炸弹，组 `56789` 梅花同花顺与 `78910J` 杂花顺，减少单牌 | structure：`SF/9 > Bomb/6` | structure 偏序 golden：`SF/9` 优于 `Bomb/6` | PASS | 无 |
| 49 | `AAA66` 管 `66633`，继续保留三带对回手 | follow：`TWP/A` | quick/full 均 `TWP/A`；复跑约 2401/2325ms | PASS（性能见第6节） | 无功能差异 |
| 50 | 杂花顺管控，立牌后出单5，组炸弹四个6/7 | follow：`Straight/A` | quick/full 均 `Straight/A`；约 1417/1504ms | PASS | 无 |
| 51 | 组 `56789` 红配梅花同花顺；跟 `34567` 出 `45678` 杂花顺 | structure：`SF/9 > Bomb/8`；follow：`Straight/8` | structure 偏序 PASS；follow quick/full 均 `Straight/8`，约 1286/2994ms | PASS | 无 |
| 52 | 跟 `23456` 拆四个8上 `678910`，再以 `QQQ88` 回手 | follow：`Straight/10` | quick/full 均 `Straight/10`；约 25/25ms | PASS | 无 |

注：structure 场景没有上一手牌，正式测试以 `scoreCandidate` 的 prefer/over 偏序为 Oracle；不把无上一手时的任意领出建议误判为 Top1 失败。

## 5. 失败分类

- 场景/golden 错：无。例51 的双场景均已覆盖且通过。
- 策略差异：无。例49/50/51/52 的修复后 Top1 与期望一致。
- 书摘越界：无。5/5 对齐，边界禁词均未出现。
- 页码/手牌 JSON 错：无。5/5 为 27 张，页码、级牌、页图均一致。
- 性能波动：例49 quick 有一次 5085ms 越过测试的 5000ms 断言，随后两次通过；归类为 P1 性能稳定性，不是功能策略差异。

## 6. 测试结论

| 命令 | 结果 |
|---|---|
| `git pull origin main` | PASS；Already up to date，基线 `e286fea` |
| `node tests/hand-labeler-excerpt.mjs` | PASS |
| `node tools/audit-case-json.mjs case-048 ... case-052` | PASS |
| `node tests/case-scenario-top1-48-52.mjs` 第一次 | **FAIL**：例49 follow quick 5085ms 超过5s；例48已先 PASS |
| 同命令完整复跑第2次 | PASS，10/10；例49 quick/full 4940/2471ms |
| 同命令完整复跑第3次 | PASS，10/10；例49 quick/full 2401/2325ms |
| `node tests/case-scenario-top1-43-47.mjs` | PASS |
| `node tests/smoke.mjs` | PASS；退出码0，机器人三家连推 351ms |

smoke 中仍有若干“机器人单步超时、保留已算推荐”警告，最大约 6569ms；未造成 smoke 失败，也未改变例48～52 的功能结论，作为既有 P2 观察项记录。

## 7. rev 静态核对

- `strategy/sf-runway-guard.mjs:20`：`COACH_STRATEGY_REVISION = 36`。
- `guandan-coach-standalone.html` 内嵌源码包含 `COACH_STRATEGY_REVISION = 36`，未发现 rev35 残留。
- standalone 构建标记存在：`globalThis.__GUANDAN_BUILD__`。
- `HEAD = origin/main = e286fea`。

## 8. Cursor pending 清单

- **P0：无。**
- **P1：例49 quick 性能稳定性。** 建议 Cursor 在不改行为的前提下做冷启动/重复运行基准；关门条件是连续多次低于 5 秒，或明确把 JIT/机器抖动从硬断言中分离。Codex 本次不改码。
- **P2：** smoke 中既有的单步超时告警；不阻塞批次9功能结论。

## 9. 结论

批次9 的数据、页码、书摘、rev36 和功能 Top1 已通过；例51 的 structure + follow 双场景均通过，例48～52 功能 golden 为 10/10。

由于例49 quick 存在一次 5085ms 的严格性能断言失败，最终状态为：**功能 CLOSED，性能 P1 OPEN，待 Cursor 做性能稳定性确认后再完全关门**。

---

## 10. Cursor 跟进（rev37）· 性能 P1 关闭

审计日后 Cursor 落地：`pickC100MustBeatTripleWithPairBeater` 支持无候选池直建 `AAA66`；`tryHumanLiteMustBeatQuick` / full 早退均先于 `generateBasicCandidates`。

冷启复验（6 次独立进程 `node tests/case-scenario-top1-48-52.mjs`）：例49 quick **5～6ms**、full **91～134ms**，全部 exit 0。

**批次9 最终状态：CLOSED**（功能 + 性能）。策略 rev37。
