# Codex 任务 M · 批次6～8 关门只读审计：《掼蛋实战100例》例 33～47

- **项目：** 掼蛋教练 Pro
- **模式：** 只读复验（**不改** `strategy/`、训练 JSON）
- **基线：** `origin/main`（rev35，Cursor 批次8 落地后）
- **目标：** 新增 `CODEX-AUDIT-批次6-8-关门.md`（覆盖批次6/7/8 全量复验）

## 命令

```bash
cd D:\掼蛋教练Pro
git pull origin main

# 书摘 + JSON 对齐
node tests/hand-labeler-excerpt.mjs
node tools/audit-case-json.mjs case-033 case-034 case-035 case-036 case-037 case-038 case-039 case-040 case-041 case-042 case-043 case-044 case-045 case-046 case-047

# Top1 golden（分三批）
node tests/case-scenario-top1-33-37.mjs
node tests/case-scenario-top1-38-42.mjs
node tests/case-scenario-top1-43-47.mjs

# 回归 + 门禁
node tests/case-scenario-top1-28-32.mjs
node tests/smoke.mjs
```

## 期望 Top1（批次6～8 新增/加固）

| 例 | PDF页 | 级牌 | 场景 | 期望 |
|---:|---:|---|---|---|
| 33 | 65 | A | structure | SF/J > TWP/8 |
| 34 | 66 | 5 | follow 单 | Single/J |
| 35 | 68 | 2 | follow TWP | TWP/5 |
| 36 | 70 | 7 | follow 杂色A2345 | Straight/10 |
| 37 | 71 | 6 | open | CP/6 |
| 38 | 74 | 2 | follow 45678 | Straight/K |
| 39 | 76 | 4 | follow 单2 | Single/3 |
| 40 | 77 | 10 | structure | Straight/K > SF/A |
| 41 | 79 | A | follow 单8 | Single/10 |
| 42 | 81 | 3 | structure | SF/8 > Bomb/4 |
| 43 | 82 | 2 | structure | Straight/7 > Bomb/6 |
| 44 | 87 | 6 | follow 单7 | Single/J |
| 45 | 89 | 3 | follow 45678 | Straight/Q |
| 46 | 90 | 2 | follow 445566 | CP/A |
| 47 | 94 | 4 | structure | Straight/9 > Bomb/7 |

## 书摘边界（重点抽查）

| 例 | 止于（不得混入） |
|---:|---|
| 43 | 「鸳鸭王。」→ 不得含「蛋的初期」 |
| 44 | 「轻松拿头游。」→ 不得含「想想,出牌的目的是…」 |
| 45 | 「动炸弹或置之不理。」→ 不得含「3.牌弱首友…」 |
| 46 | 「应对变化性。」→ 不得含「甚至炸弹立牌后再出对子」 |
| 47 | 「可减少单牌张数。」（跨页95）→ 不得含「比如,上家出个小单牌」 |

页码以 `training-samples/cases/case-page-map.json` 为准。

## 版本核对

- `strategy/sf-runway-guard.mjs`：`COACH_STRATEGY_REVISION = 35`
- 游戏页脚 rev 与 standalone build 一致

## 约束

- 只读；失败须分类：**场景/golden 错** vs **策略差异** vs **书摘越界** vs **页码/手牌 JSON 错**
- 与批次5 关门格式一致，输出 PASS/FAIL 表格 + 需 Cursor 跟进的 pending 清单（如有）
