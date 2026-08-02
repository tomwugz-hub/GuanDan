# CODEX-AUDIT-批次11

审计日期：2026-08-02  
项目：掼蛋教练 Pro；模式：只读复验  
范围：例 58～62  
基线：直接使用当前工作区（未执行 pull，以保留未 push 的批次11）；工作区 `HEAD = 7104f09`，`origin/main = eec81bd`，策略源码 rev39。

本次仅新增本报告；未修改 `strategy/`、`coach/`、训练 JSON、场景或测试，未 commit/push。

## 1. 摘要

| 项目 | 结果 |
|---|---|
| 手牌、级牌、权威 PDF 页码、页图 | 5/5 PASS |
| `extractCaseExcerpt()` 与 `narrative.summary` | 5/5 PASS；hand-labeler 已覆盖例1～62 |
| 功能 Top1 | 5/5 PASS；例59、62 structure 偏序均通过 |
| 53～57 回归 | PASS |
| smoke | PASS |
| rev 静态核对 | 源码与 standalone 均 rev39 |
| 结论 | **本地 rev39 审计 PASS；待 Cursor commit/push 后再做远端基线复验** |

## 2. JSON、页码与页图

PDF 页码唯一以 `training-samples/case-page-map.json` 为准；页图按 `source.assets.pagePng` 相对项目根目录解析。

| 例号 | PDF页 | 级牌 | 场景 | 期望 | 手牌 | `needsUserVerify` | 页图 | 结论 |
|---:|---:|---|---|---|---:|---|---|---|
| 58 | 113 | 9 | follow 三个K | `Triple/A` | 27 | false | `assets/guandan-100cases/case-058-page113.png` 存在 | PASS |
| 59 | 114 | 2 | structure | `Straight/8 > Bomb/9` | 27 | false | `assets/guandan-100cases/case-059-page114.png` 存在 | PASS |
| 60 | 116 | Q | follow 23456 | `Straight/10` | 27 | false | `assets/guandan-100cases/case-060-page116.png` 存在 | PASS |
| 61 | 120 | 4 | open | `Pair/2` | 27 | false | `assets/guandan-100cases/case-061-page120.png` 存在 | PASS |
| 62 | 121 | 6 | structure | `Bomb/8 > Bomb/9` | 27 | false | `assets/guandan-100cases/case-062-page121.png` 存在 | PASS |

`node tools/audit-case-json.mjs case-058 case-059 case-060 case-061 case-062` 退出码 0；5 例均为 27 张、无需用户复核、级牌与场景级牌一致。

## 3. 书摘边界与 JSON 对齐

`extractCaseExcerpt(cleanedText, n) === case-NNN.json.narrative.summary`：5/5 PASS。`node tests/hand-labeler-excerpt.mjs` 退出码 0，输出例1～62 书摘边界全部通过。

| 例号 | 摘要长度 | 应止于 | 越界核对 | JSON 对齐 |
|---:|---:|---|---|---|
| 58 | 106字 | “处理了一个单张5。” | 不含“乱你反正抢不了头游” | PASS |
| 59 | 123字 | “牌型多元化。” | 不含“牌都输了，手里还有炸弹”讲义 | PASS |
| 60 | 79字 | “三个 K 带对8。” | 不含“关于一种牌型打到底” | PASS |
| 61 | 118字 | “7方片同花顺。” | 不含“10以上的对子” | PASS |
| 62 | 179字 | “抢头游的机会。” | 含正文“炸弹越多越好”原则句；不含“2. 封牌” | PASS |

例62 的“炸弹越多越好”出现在本例战法正文，按任务约束属于允许内容，不是例28讲义 bleed。

## 4. Top1 三方对照

| 例号 | 书中要求/原则 | 场景期望 | 实测 quick / full | 结论 | 根因分类 |
|---:|---|---|---|---|---|
| 58 | 三个 K 管三个7后上三个 A，拆四 A 炸立牌 | `Triple/A` | `Triple/A` 18ms / 33ms | PASS | 无 |
| 59 | 释放单牌、发挥红配，`45678` 杂花顺优于保留大炸弹 | structure：`Straight/8 > Bomb/9` | structure golden：`Straight/8` 优于 `Bomb/9` | PASS | 无 |
| 60 | 跟 `23456` 上 `678910`，非开8炸 | `Straight/10` | `Straight/10` 1842ms / 1945ms | PASS | 无 |
| 61 | 弱牌双红配先探，先出对2 | `Pair/2` | `Pair/2` 0ms / 347ms | PASS | 无 |
| 62 | 炸弹归位四8/四9，保留“炸弹越多越好”原则 | structure：`Bomb/8 > Bomb/9` | structure golden：`Bomb/8` 优于 `Bomb/9` | PASS | 无 |

例59、62 为 structure 场景，没有上一手牌；正式测试以 `scoreCandidate` 的 prefer/over 偏序为 Oracle，不把无上一手时的 `getTurnAdvice` 单一领出值作为 gate。

## 5. 既有回归与 smoke

| 命令 | 结果 |
|---|---|
| `node tests/case-scenario-top1-58-62.mjs` | PASS；5/5，所有 quick/full <5s |
| `node tests/case-scenario-top1-53-57.mjs` | PASS；53～57 全部通过 |
| `node tests/smoke.mjs` | PASS；退出码0，机器人三家连推 439ms |

smoke 仍输出若干“机器人单步超时、保留已算推荐”告警，最大约 3922ms；未导致 smoke 失败，也未影响例58～62 Top1，列为既有 P2 观察项。

## 6. rev 静态核对

- `strategy/sf-runway-guard.mjs:20`：`COACH_STRATEGY_REVISION = 39`。
- `guandan-coach-standalone.html` 内嵌源码包含 rev39，未发现 rev38 残留。
- standalone 含 `globalThis.__GUANDAN_BUILD__` 构建标记。
- 当前工作区 `HEAD = 7104f09`；`origin/main = eec81bd`，说明批次11尚未 push。

## 7. 失败分类与 Cursor 待办

- 场景/golden 错：无。
- 策略差异：无；58～62 期望均已复现。
- 书摘越界：无；例62允许的“炸弹越多越好”未误判。
- 页码/手牌 JSON 错：无；5/5 页码、页图、27张手牌和级牌一致。
- P0/P1：无。
- P2：smoke 中既有单步超时告警，不阻塞本批次。
- 发布待办：Cursor 将当前 rev39 工作区 commit/push 后，再以远端 HEAD 复验一次即可。

## 8. 结论

在当前未 push 的 rev39 工作区，例58～62 的 JSON、书摘、Top1、53～57 回归和 smoke 全部通过；例59/62 structure 偏序、例62正文“炸弹越多越好”均按规格处理。批次11 **本地审计 PASS**，等待 Cursor 发布 rev39 后关闭远端基线审计。
