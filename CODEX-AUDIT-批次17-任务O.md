# Codex 任务 O · 批次17 只读审计：《掼蛋实战100例》例 88～92

- **项目：** 掼蛋教练 Pro
- **模式：** 只读复验（**不改** `strategy/`、训练 JSON）
- **基线：** `origin/main`（**rev45**）；`git pull` 后应含 `44f9e46`
- **目标：** 新增 `CODEX-AUDIT-批次17.md`

## 命令

```bash
cd D:\掼蛋教练Pro
git pull origin main

node tests/hand-labeler-excerpt.mjs
node tools/audit-case-json.mjs case-089 case-090 case-091 case-092
node tests/case-scenario-top1-88-92.mjs
node tests/case-scenario-top1-83-87.mjs
node tests/smoke.mjs
```

## 期望 Top1

| 例 | PDF页 | 级牌 | 场景 | 期望 |
|---:|---:|---|---|---|
| 88 | — | — | — | **跳过（书中无例88，第88页为第五讲讲义）** |
| 89 | 169 | 6 | open（support/4） | Pair/3（弱牌宜对3示弱，优于 Single/3） |
| 90 | 171 | 7 | follow 对7 | Bomb/8（四8炸管对7） |
| 91 | 172 | 2 | open（main-attack/14） | Triple/2（222逼封首发，优于 Straight/7） |
| 92 | 175 | J | follow 单5 | Single/6（顺6管单5） |

## 书摘边界（重点）

| 例 | 止于 / 不得混入 |
|---:|---|
| 89 | 「先出三不带 , 后有三带对 "。」；不含「第十一讲 / 如何应变打好牌」泛论 |
| 90 | 战术段止于「不知道变化、 应对 !」；不含「2. 红配可以随时调」讲义 |
| 91 | 止于「两个红」跨页截断或「耐心等待顺过 J、K、 小王和三带的机会。」；不含「3. 末家负责制」讲义 |
| 92 | 止于「这是很划算的事」；不含「第十一讲」后续泛论 |

## 策略改动摘要（供对照，勿改码）

| 例 | 教纲 | 实现要点 |
|---:|---|---|
| 89 | C100-O1 | `pickC100OpeningLead`/`Direct` + `cases100Adjustment` 指纹（四6/四Q/弱牌 support） |
| 90 | C100-M1 | 既有规则 PASS（四8炸管对7） |
| 91 | C100-G1 | 三2逼封快路径 + 评分偏序（优于 23456/散对）；指纹 `levelRank===2 && physical 2===3 && SJ && physical 7>=3` |
| 92 | C100-G1 | `pickC100MustBeatSingleBeater` 打J 管单5→单6 |

## 约束

- 只读；失败分类：场景/golden 错 · 策略差异 · 书摘越界 · 页码/手牌 JSON 错
- PDF 页码以 `training-samples/case-page-map.json` 为唯一权威
- **Oracle** 为 `case-scenarios-51-100.json`；书摘与 golden 不一致时以场景为准
- follow/open：quick + full 均须 PASS，单例 <5s
- 例88/85 不存在于书中与 repo 场景 JSON，勿误报缺失
- 报告须核对源码 / standalone `COACH_STRATEGY_REVISION = 45`
- 83～87 回归须 PASS（批次16 不回归）

## 期望输出

- `CODEX-AUDIT-批次17.md`：摘要表、JSON/页图、书摘、Top1 三方对照、83～87 回归、smoke、rev 核对、结论 PASS/CLOSED 或待办
