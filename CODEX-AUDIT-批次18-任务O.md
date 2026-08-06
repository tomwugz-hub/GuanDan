# Codex 任务 O · 批次18 只读审计：《掼蛋实战100例》例 93～97

- **项目：** 掼蛋教练 Pro
- **模式：** 只读复验（**不改** `strategy/`、训练 JSON）
- **基线：** `origin/main`（**rev46**）；`git pull` 后应含 `e7c8cde`
- **目标：** 新增 `CODEX-AUDIT-批次18.md`

## 命令

```bash
cd D:\掼蛋教练Pro
git pull origin main

node tests/hand-labeler-excerpt.mjs
node tools/audit-case-json.mjs case-093 case-094 case-095 case-096 case-097
node tests/case-scenario-top1-93-97.mjs
node tests/case-scenario-top1-88-92.mjs
node tests/smoke.mjs
```

## 期望 Top1

| 例 | PDF页 | 级牌 | 场景 | 期望 |
|---:|---:|---|---|---|
| 93 | 176 | 9 | structure | StraightFlush/9 > Bomb/8（红配56789同花顺优于保8炸） |
| 94 | 177 | 2 | structure | Straight/7 > Bomb/7（34567杂花顺优于裸保四7炸） |
| 95 | 179 | 8 | follow 34567 | Straight/K（9TJQK顺过34567，优于 Pass） |
| 96 | 192 | 2 | structure | Bomb/8 > Bomb/2（多炸路线，四8优于四2） |
| 97 | 200 | 2 | follow 445566（passTail=2） | ConsecutivePairs/A（QQKKAA管牌，优于 Pass） |

## 书摘边界（重点）

| 例 | 止于 / 不得混入 |
|---:|---|
| 93 | 「实现了牌型多元化。」；不含「5. 五头炸弹用四张」讲义 |
| 94 | 「往往会收到意想不到的效果。」；不含「6. 牌型拆单拆到底」讲义 |
| 95 | 「引下了对手方的炸弹」段末；不含「第十二讲」页眉 |
| 96 | 「910JQK(红配)黑桃同花顺立牌抢头游。」；不含「7. 顺子打到头」顺口溜讲义 |
| 97 | 「梅花同花顺。」；不含「放长线钓大鱼」牌品泛论 |

## 策略改动摘要（供对照，勿改码）

| 例 | 教纲 | 实现要点 |
|---:|---|---|
| 93 | C100-G1 | 既有结构偏序 PASS（56789 SF vs 8炸） |
| 94 | C100-G1 | `cases100Adjustment` 指纹（四7/五K/BJ → 34567优于7炸） |
| 95 | C100-G1 | `pickC100MustBeatStraightBeater` 打8 顺K管34567 |
| 96 | C100-B1 | `cases100Adjustment` 指纹（四2+三8+三J → 8炸优于2炸） |
| 97 | C100-M1 | `recommend.mjs` full 连对早退 + 例46 `pickC100MustBeatConsecutivePairsBeater` |

## 约束

- 只读；失败分类：场景/golden 错 · 策略差异 · 书摘越界 · 页码/手牌 JSON 错
- PDF 页码以 `training-samples/case-page-map.json` 为唯一权威
- **Oracle** 为 `case-scenarios-51-100.json`；书摘叙事与 golden 不一致时以场景为准（例97 场景为 QQKKAA 管 445566，与书摘战术句可不同）
- 例93/94/96 为 **structure** golden：`scoreCandidate` 偏序（prefer 分低于 over）
- follow/open：quick + full 均须 PASS，单例 <5s
- 报告须核对源码 / standalone `COACH_STRATEGY_REVISION = 46`
- 88～92 回归须 PASS（批次17 不回归）

## 期望输出

- `CODEX-AUDIT-批次18.md`：摘要表、JSON/页图、书摘、Top1 三方对照、88～92 回归、smoke、rev 核对、结论 PASS/CLOSED 或待办
