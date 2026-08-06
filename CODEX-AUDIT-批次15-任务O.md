# Codex 任务 O · 批次15 只读审计：《掼蛋实战100例》例 78～82

- **项目：** 掼蛋教练 Pro
- **模式：** 只读复验（**不改** `strategy/`、训练 JSON）
- **基线：** `origin/main`（**rev43**）；`git pull` 后应含 `72e2993`
- **目标：** 新增 `CODEX-AUDIT-批次15.md`

## 命令

```bash
cd D:\掼蛋教练Pro
git pull origin main

node tests/hand-labeler-excerpt.mjs
node tools/audit-case-json.mjs case-078 case-079 case-080 case-081 case-082
node tests/case-scenario-top1-78-82.mjs
node tests/case-scenario-top1-73-77.mjs
node tests/smoke.mjs
```

## 期望 Top1

| 例 | PDF页 | 级牌 | 场景 | 期望 |
|---:|---:|---|---|---|
| 78 | 149 | 4 | open | Straight/7（34567减手首发，四2/四7） |
| 79 | 151 | 2 | follow 222 | Bomb/3（四3炸管三个222，红配补炸） |
| 80 | 153 | 5 | open | Straight/5（A2345有打有收，五J结构） |
| 81 | 154 | A | open | Single/3（强牌小单探路，四3/四8/四10） |
| 82 | 156 | A | follow 23456 | Straight/9（56789管牌，四9+红配代8） |

## 书摘边界（重点）

| 例 | 止于 / 不得混入 |
|---:|---|
| 78 | 「静等三带对的到来。」；不含第十讲残局泛论 |
| 79 | 「不可出333444)。」；不含第152页报牌讲义 |
| 80 | 理想止于「两个空弹沉底。」；**已知 P2**：行内可能含「作为对手方对着干」报牌段 |
| 81 | 「再等过单张 9.Q.Z,」 |
| 82 | 「红配组成四个4。」；不含「把他放在N张牌」报牌讲义 |

## 约束

- 只读；失败分类：场景/golden 错 · 策略差异 · 书摘越界 · 页码/手牌 JSON 错
- PDF 页码以 `training-samples/case-page-map.json` 为唯一权威
- **Oracle** 为 `case-scenarios-51-100.json`；书摘叙事与 golden 场景不一致时以场景为准
- 例79 仅三物理3 + 红配2 → 炸弹须 `pickC100MustBeatBombBeater` 直建，候选池可能为空
- 例82 无物理8 → 56789 须逢人配代8，勿因无物理8误判不可组顺
- 报告须核对源码 / standalone `COACH_STRATEGY_REVISION = 43`
