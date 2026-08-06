# Codex 任务 O · 批次13 只读审计：《掼蛋实战100例》例 68～72

- **项目：** 掼蛋教练 Pro
- **模式：** 只读复验（**不改** `strategy/`、训练 JSON）
- **基线：** `origin/main`（**rev41**）；`git pull` 后应含 `19f2196`
- **目标：** 新增 `CODEX-AUDIT-批次13.md`

## 命令

```bash
cd D:\掼蛋教练Pro
git pull origin main

node tests/hand-labeler-excerpt.mjs
node tools/audit-case-json.mjs case-068 case-069 case-070 case-071 case-072
node tests/case-scenario-top1-68-72.mjs
node tests/case-scenario-top1-63-67.mjs
node tests/smoke.mjs
```

## 期望 Top1

| 例 | PDF页 | 级牌 | 场景 | 期望 |
|---:|---:|---|---|---|
| 68 | 132 | 4 | follow 556677 | ConsecutivePairs/9（778899 末家管牌） |
| 69 | 134 | A | structure | StraightFlush/A > Bomb/10（大黑桃 SF 减单） |
| 70 | 135 | J | structure | Straight/J > Bomb/4（8910JQ 杂花顺路线） |
| 71 | 137 | 10 | follow 34567 | Straight/9（56789 管牌） |
| 72 | 138 | A | follow 23456 | Straight/9（56789 逢人配管牌） |

## 书摘边界（重点）

| 例 | 止于 / 不得混入 |
|---:|---|
| 68 | 「抢得头游。」；不含「吃贡者在组剩下的单牌」（还牌讲义） |
| 69 | 「抢头游。」；不含「2. 还指档」（还牌讲义） |
| 70 | 「减少一张单牌。」；不含「当然 , 相对的是」（还牌讲义） |
| 71 | 「出牌手数。」；不含「当然 , 在单2」（还牌讲义） |
| 72 | 「带走了一张单牌8。」；不含「这时候的原则是」（拆牌还牌讲义） |

## 约束

- 只读；失败分类：场景/golden 错 · 策略差异 · 书摘越界 · 页码/手牌 JSON 错
- PDF 页码以 `training-samples/case-page-map.json` 为唯一权威
- 例69/70 为 **structure** golden：用 `scoreCandidate` 偏序（prefer 分低于 over）
- 例68 lite 须走 C100 连对直建快路径（避免 SF 跑道误拦导致 Pass）
- 例72 顺子管牌可含逢人配代9，勿因无物理9误判
- 报告须核对源码 / standalone `COACH_STRATEGY_REVISION = 41`
