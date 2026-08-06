# Codex 任务 O · 批次19 只读审计：《掼蛋实战100例》例 98～100（收官）

- **项目：** 掼蛋教练 Pro
- **模式：** 只读复验（**不改** `strategy/`、训练 JSON）
- **基线：** `origin/main`（**rev47**）；`git pull` 后应含 `b01d53c`
- **目标：** 新增 `CODEX-AUDIT-批次19.md`

## 命令

```bash
cd D:\掼蛋教练Pro
git pull origin main

node tests/hand-labeler-excerpt.mjs
node tools/audit-case-json.mjs case-098 case-099 case-100
node tests/case-scenario-top1-98-100.mjs
node tests/case-scenario-top1-93-97.mjs
node tests/smoke.mjs
node tools/build-standalone.mjs
```

## 期望 Top1

| 例 | PDF页 | 级牌 | 场景 | 期望 |
|---:|---:|---|---|---|
| 98 | 215 | A | structure | StraightFlush/J > Bomb/K（8910JQ 黑桃同花顺减单优于保 K 炸） |
| 99 | 220 | A | follow 45678（passTail=2） | Straight/Q（8910JQ 管牌，宜杂花顺不宜 SF） |
| 100 | 226 | 9 | follow 678910（passTail=2） | Straight/A（10JQKA 管牌，末家负责制） |

## 书摘边界（重点）

| 例 | 止于 / 不得混入 |
|---:|---|
| 98 | 「牌型多元」段末（规划三连对/杂花顺/三K带对/六10炸）；不含「第十七讲」/「三个基本功」讲义 |
| 99 | 「组789 ( 红配 )10J 黑桃同花顺。」；不含下一页「910JQK, 未家都有可能管牌」跨页 bleed |
| 100 | 「对多转三带 , 红配说了算 "。」；不含「种没有底线」/「再说线上掼蛋」牌品泛论 |

## 策略改动摘要（供对照，勿改码）

| 例 | 教纲 | 实现要点 |
|---:|---|---|
| 98 | C100-G1 | 既有 structure 偏序 PASS（SF/J vs K 炸），本批无新增快路径 |
| 99 | C100-M1 | `pickC100MustBeatStraightBeater` + `cases100Adjustment`（8910JQ 管 45678，宜杂花顺不宜 SF） |
| 100 | C100-M1 | `pickC100MustBeatStraightBeater` + `cases100Adjustment`（10JQKA 管 678910） |

## 约束

- 只读；失败分类：场景/golden 错 · 策略差异 · 书摘越界 · 页码/手牌 JSON 错
- PDF 页码以 `training-samples/case-page-map.json` 为唯一权威
- **Oracle** 为 `case-scenarios-51-100.json`；书摘叙事与 golden 不一致时以场景为准
- 例98 为 **structure** golden：`scoreCandidate` 偏序（prefer 分低于 over）
- follow：quick + full 均须 PASS，单例 <5s
- 报告须核对源码 / standalone `COACH_STRATEGY_REVISION = 47`
- 93～97 回归须 PASS（批次18 不回归）
- **永久跳过：** 例85、例88（书中无独立战例）；hand-labeler 已跳过
- 本批为 **百例 51～100 收官**；报告结论段须注明全系列落地完成

## 期望输出

- `CODEX-AUDIT-批次19.md`：摘要表、JSON/页图、书摘、Top1 三方对照、93～97 回归、smoke、rev47 核对、百例收官结论 PASS/CLOSED 或待办
