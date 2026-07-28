# CODEX-AUDIT-批次6（任务 K）· 例33～37只读审计

审计日期：2026-07-28  
审计基线：`HEAD = origin/main = 49cae78`，策略 `rev32`。  
审计方式：只读；未修改 `strategy/`、`coach/`、训练 JSON、场景数据或测试。  
批次结论：**OPEN**。

## 1. 摘要

| 项目 | 结论 |
|---|---|
| 手牌、级牌、PDF页、页图 | 例33～37均通过 |
| 定稿书摘 | 0/5 与 `extractCaseExcerpt()` 对齐 |
| 书摘自动门禁 | 只覆盖至例32，未覆盖本批 |
| 场景候选可生成 | 5/5 的现有 `prefer`、`over` 候选均存在 |
| Top1 | 例34 full不一致；例35 quick/full不一致；例36、37应先修场景定义 |
| 既有批次回归 | 例23～27、例28～32均通过 |
| smoke | PASS |
| 关门状态 | 数据/书摘/场景/Top1尚有待办，保持OPEN |

## 2. JSON、页码与页图

### 书中原文、场景与教纲权威对照

| 例号 | PDF页（`case-page-map.json`） | 级牌 | 场景 | 场景期望 Top1 | 教纲 | 书中要点（页图交叉验证） |
|---:|---:|---|---|---|---|---|
| 33 | 65 | A | structure组牌 | SF/J > TWP/8 | C100-G1 | 暗藏黑桃、梅花78910J等多套同花顺；组牌既横看炸弹也顺看同花顺 |
| 34 | 66 | 5 | follow单8 | Single/J | C100-O1 | 对子较多，单牌来袭应拆对J上一张，既扫牌也过牌 |
| 35 | 68 | 2 | follow 33344 | TWP/5 | C100-G1 | 55577管33344，并重组同花顺/杂花顺，让红配保持机动 |
| 36 | 70 | 7 | follow A2345 | **待核；JSON现为SF/9** | C100-M1 | 原文明确上678910杂花顺（Straight/10），不是78910J红配；上一手A2345应建模为杂色顺子 |
| 37 | 71 | 6 | open | CP/6 | C100-G1 | 原文要求组A2345梅花同花顺并“调出445566三连对”；**页图没有“首发”二字**，open→CP/6是场景推断而非原文明确Top1 |

### JSON基础数据

PDF页码以 `training-samples/case-page-map.json` 为准。

| 例号 | PDF页 | 页图存在 | 手牌 | needsUserVerify | 级牌 | JSON基础数据 |
|---:|---:|---|---:|---|---|---|
| 33 | 65 | 是，`case-033-page65.png` | 27 | false | A | PASS |
| 34 | 66 | 是，`case-034-page66.png` | 27 | false | 5 | PASS |
| 35 | 68 | 是，`case-035-page68.png` | 27 | false | 2 | PASS |
| 36 | 70 | 是，`case-036-page70.png` | 27 | false | 7 | PASS |
| 37 | 71 | 是，`case-037-page71.png` | 27 | false | 6 | PASS |

`node tools/audit-case-json.mjs case-033 ... case-037` 退出码为0，五例均位于“完整定稿”集合。该工具没有输出本批逐字段差异，以上字段另作只读定向核对。

## 3. 书摘审计

| 例号 | 动态截取 | narrative/authorPlan对齐 | 问题 |
|---:|---|---|---|
| 33 | FAIL（297字） | FAIL | 正文结束后混入“末家负责制/观察炸弹”等通用讲义 |
| 34 | FAIL（8字） | FAIL | 战例跨页；当前截取在第67页页眉处提前停止，仅剩“此牌打5。手里对”；JSON又越界混入后续讲义 |
| 35 | 正文边界正确（110字） | FAIL | 动态截取止于“让红配活起来”，但JSON继续混入“打好残局牌”等讲义 |
| 36 | FAIL（278字） | FAIL | 正文结束后混入“没有炸弹了、5张牌进入残局”等讲义 |
| 37 | FAIL（269字） | FAIL | 正文结束后混入“一对加单张、二打一残局”等通用讲义 |

自动门禁 `node tests/hand-labeler-excerpt.mjs` 虽退出码为0，但明确只输出：

- `hand-labeler-excerpt: 例1～32 书摘边界全部通过`
- JSON对齐断言也只到 `case-032.json`

因此该PASS不能作为例33～37书摘通过证据。建议后续仅修改书摘边界、五例书摘字段及测试覆盖；本次未改数据。

用户指定的书摘内联探测命令退出码为0，实测五例 `JSON对齐` 均为FAIL（0/5）。

## 4. 场景、书中要求与Top1三方对照

当前没有例33～37的正式 Top1 golden。以下实际值由与现有批次 golden 相同的 `getTurnAdvice` quick/full 路径只读探测得到。

| 例号 | 书中要求 | 场景期望 | quick实际 | full实际 | 三方结论 | 根因分类 |
|---:|---|---|---|---|---|---|
| 33 | 组牌顺看同花顺，多套SF优于固守88844 | structure：SF/J > TWP/8 | Pair/4（72ms） | Pair/4（1042ms） | 指定探测把structure当open回合，Top1不可与结构目标直接比较；SF/J和TWP/8候选均存在 | 书摘/JSON错；结构golden缺失 |
| 34 | 跟单8应拆对J | Single/J | Single/J（15ms） | Single/9（1270ms） | quick符合，full不符合书中要求和场景 | **策略差异**；另有书摘/JSON错 |
| 35 | 55577管33344 | TWP/5 | TWP/A（379ms） | TWP/A（470ms） | quick/full均不符合书中要求和场景 | **策略差异**；另有书摘/JSON错 |
| 36 | 跟杂色A2345应出678910杂花顺，即Straight/10 | JSON错误设为SF/9 | SF/9（3ms） | SF/9（3ms） | 教练只是在匹配错误场景；不能据此判定策略符合书本 | **场景/golden错** + 书摘/JSON错 |
| 37 | 组A2345同花顺并调出445566三连对；原文未明确首发 | open：CP/6 | Pair/2（7ms） | TWP/8（1212ms） | 若产品明确把CP/6作为教纲推断，则两路均为策略差异；严格按原文则open Top1仍待核 | **场景/golden待核** + 书摘/JSON错 |

现有场景候选生成检查：

- 例33～37的 `prefer` 和 `over` 候选均可由手牌生成。
- “候选存在”只证明场景可构造，不代表场景符合书摘，也不代表Top1一致。
- 用户指定的内联探测命令退出码为0。该命令只在存在上一手时打印例号，所以输出首组 `Pair/4` 对应例33，末组 `Pair/2`、`TripleWithPair/8` 对应例37。
- 例36的 `previousCards` 为A♠2♠3♠4♠5♠，五张全黑桃；引擎实测分类为 `StraightFlush/5`。这正是当前场景把普通A2345误建模成同花顺的直接根因。

## 5. 既有回归与smoke

| 命令 | 退出码 | 结论 |
|---|---:|---|
| `node tests/hand-labeler-excerpt.mjs` | 0 | PASS，但只覆盖例1～32 |
| `node tests/case-scenario-top1-28-32.mjs` | 0 | PASS |
| `node tests/case-scenario-top1-23-27.mjs` | 0 | PASS |
| `node tests/smoke.mjs` | 0 | PASS，约165秒 |

smoke输出“掼蛋教练 Pro：全部冒烟测试通过”；“机器人三家连推计算耗时”为2257ms。

## 6. rev静态核对

- 本地 `HEAD`：`49cae78`
- `origin/main`：`49cae78`
- `strategy/sf-runway-guard.mjs`：`COACH_STRATEGY_REVISION = 32`
- `guandan-coach-standalone.html` 内嵌：`COACH_STRATEGY_REVISION = 32`
- standalone构建戳：`globalThis.__GUANDAN_BUILD__="1785216824844"`
- `tools/build-standalone.mjs` 使用 `Date.now()` 写入 `globalThis.__GUANDAN_BUILD__`；`app/main.mjs`读取该值并与策略rev共同展示。源码rev与standalone内嵌rev静态一致。

## 7. 待办与关门条件

1. **P0 场景/golden：** 例36将上一手改成杂色A2345，期望改为 `Straight/10`；补断言防止再次把普通顺子建成同花顺。
2. **P0 书摘/JSON：** 修复例33、34、36、37截取边界，将例33～37的 `narrative.summary`、`authorPlan.summary` 与正确正文对齐，并把 `hand-labeler-excerpt` 覆盖扩至例37。
3. **P1 场景定义：** 例37明确产品选择。若坚持open→CP/6，应标明这是从“调出445566”推导的策略教纲，不要写成书中明示“首发”；否则改为structure断言。
4. **P1 策略：** 例34 full应稳定选择Single/J；例35 quick/full应选择TWP/5。
5. **P1 golden：** 场景修正后新增例33～37正式结构/Top1 golden，复验quick/full均低于5秒。
6. 书摘、场景、正式golden、例23～32回归及smoke全部PASS后，批次6方可由OPEN转CLOSED。

## 8. 文件变更

- Codex仅新增 `CODEX-AUDIT-批次6.md`。
- 未修改代码、训练数据、场景或测试。
- 未stage、commit或push。
