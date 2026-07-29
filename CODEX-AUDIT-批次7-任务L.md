# Codex 任务 L · 批次7 只读审计：《掼蛋实战100例》例 38～42

- **项目：** 掼蛋教练 Pro
- **模式：** 只读复验（**不改** `strategy/`、训练 JSON）
- **基线：** `origin/main`（rev34，Cursor 批次7 落地后）
- **目标：** 新增 `CODEX-AUDIT-批次7.md`

## 命令

```bash
cd D:\掼蛋教练Pro
git pull origin main

node tools/audit-case-json.mjs case-038 case-039 case-040 case-041 case-042
node tests/hand-labeler-excerpt.mjs
node tests/case-scenario-top1-38-42.mjs
node tests/case-scenario-top1-33-37.mjs
node tests/case-scenario-top1-28-32.mjs
node tests/smoke.mjs
```

## 期望 Top1

| 例 | PDF页 | 级牌 | 场景 | 期望 |
|---:|---:|---|---|---|
| 38 | 74 | 2 | follow 45678 | Straight/K |
| 39 | 76 | 4 | follow 单2 | Single/3 |
| 40 | 77 | 10 | structure | Straight/K > SF/A |
| 41 | 79 | A | follow 单8 | Single/10 |
| 42 | 81 | 3 | structure | SF/8 > Bomb/4 |

## 约束

- 只读；页码以 `case-page-map.json` 为准
- 失败须分类：场景/golden 错 vs 策略差异 vs 书摘越界
