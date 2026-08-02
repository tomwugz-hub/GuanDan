# Codex 任务 O · 批次10 只读审计：《掼蛋实战100例》例 53～57

- **项目：** 掼蛋教练 Pro
- **模式：** 只读复验（**不改** `strategy/`、训练 JSON）
- **基线：** `origin/main`（rev38，Cursor 批次10 落地后）
- **目标：** 新增 `CODEX-AUDIT-批次10.md`

## 命令

```bash
cd D:\掼蛋教练Pro
git pull origin main

node tests/hand-labeler-excerpt.mjs
node tools/audit-case-json.mjs case-053 case-054 case-055 case-056 case-057
node tests/case-scenario-top1-53-57.mjs
node tests/case-scenario-top1-48-52.mjs
node tests/smoke.mjs
```

## 期望 Top1

| 例 | PDF页 | 级牌 | 场景 | 期望 |
|---:|---:|---|---|---|
| 53 | 103 | 8 | follow TWP/10 | TWP/A（AAA22） |
| 54 | 106 | 4 | structure | Pair/A > Straight/A |
| 55 | 108 | 2 | follow 34567 | Straight/Q（8910JQ，非 SF） |
| 56 | 109 | 6 | follow 55522 | TWP/Q（带对9） |
| 57 | 111 | A | open | Straight/5（A2345） |

## 书摘边界（重点）

| 例 | 止于 / 不得混入 |
|---:|---|
| 53 | 跨页至「用两个红配组同花顺」；不含「注意,掼蛋抢头游」 |
| 54 | 「一种牌型打到底」；不含「同样,还是要分析牌力」 |
| 55 | 「10JQKA 杂花顺」；不含「他所需要的牌型」 |
| 56 | 「667788三连对」；不含「让给对家上」 |
| 57 | 「单牌太多」；不含「怨,我没有对子呀」 |

## 约束

- 只读；失败分类：场景/golden 错 · 策略差异 · 书摘越界 · 页码/手牌 JSON 错
- 例55 场景已按原文改为 **Straight/Q**（不得再期望 StraightFlush/A）
