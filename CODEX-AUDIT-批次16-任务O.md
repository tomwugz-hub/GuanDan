# Codex 任务 O · 批次16 只读审计：《掼蛋实战100例》例 83～87

- **项目：** 掼蛋教练 Pro
- **模式：** 只读复验（**不改** `strategy/`、训练 JSON）
- **基线：** `origin/main`（**rev44**）；`git pull` 后应含 `b2f6098`
- **目标：** 新增 `CODEX-AUDIT-批次16.md`

## 命令

```bash
cd D:\掼蛋教练Pro
git pull origin main

node tests/hand-labeler-excerpt.mjs
node tools/audit-case-json.mjs case-083 case-084 case-086 case-087
node tests/case-scenario-top1-83-87.mjs
node tests/case-scenario-top1-78-82.mjs
node tests/smoke.mjs
```

## 期望 Top1

| 例 | PDF页 | 级牌 | 场景 | 期望 |
|---:|---:|---|---|---|
| 83 | 157 | Q | structure | StraightFlush/Q > Bomb/2（同花顺优于小炸） |
| 84 | 159 | 9 | follow 778899 | Bomb/5（末家拆弹管连对） |
| 85 | — | — | — | **跳过（书中无例85）** |
| 86 | 162 | 2 | follow 666+对 | TripleWithPair/K（KKK带对管666带对） |
| 87 | 164 | 3 | open | Straight/6（23456减手，四3/四K） |

## 书摘边界（重点）

| 例 | 止于 / 不得混入 |
|---:|---|
| 83 | 「抢得头游。」；不含「报8张牌」 |
| 84 | 「单牌等待时机。」；不含「报9张牌」 |
| 86 | 战术段；不含长段对手方心理泛论 |
| 87 | 「给搭档明确信息要对子。」 |

## 约束

- 只读；失败分类：场景/golden 错 · 策略差异 · 书摘越界 · 页码/手牌 JSON 错
- PDF 页码以 `training-samples/case-page-map.json` 为唯一权威
- **Oracle** 为 `case-scenarios-51-100.json`；书摘与 golden 不一致时以场景为准
- 例83 为 **structure** golden：`scoreCandidate` 偏序（prefer 分低于 over）
- 例85 不存在于书中与 repo，勿误报缺失
- 报告须核对源码 / standalone `COACH_STRATEGY_REVISION = 44`
