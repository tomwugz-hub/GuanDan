# Codex 任务 N · 批次9 只读审计：《掼蛋实战100例》例 48～52

- **项目：** 掼蛋教练 Pro
- **模式：** 只读复验（**不改** `strategy/`、训练 JSON）
- **基线：** `origin/main`（rev36，Cursor 批次9 落地后）
- **目标：** 新增 `CODEX-AUDIT-批次9.md`

## 命令

```bash
cd D:\掼蛋教练Pro
git pull origin main

node tests/hand-labeler-excerpt.mjs
node tools/audit-case-json.mjs case-048 case-049 case-050 case-051 case-052
node tests/case-scenario-top1-48-52.mjs
node tests/case-scenario-top1-43-47.mjs
node tests/smoke.mjs
```

## 期望 Top1

| 例 | PDF页 | 级牌 | 场景 | 期望 |
|---:|---:|---|---|---|
| 48 | 96 | 4 | structure | SF/9 > Bomb/6 |
| 49 | 97 | 8 | follow TWP | TWP/A |
| 50 | 99 | 3 | follow 杂花顺 | Straight/A |
| 51 | 101 | 4 | structure | SF/9 > Bomb/8 |
| 51 | 101 | 4 | follow 34567 | Straight/8 |
| 52 | 102 | Q | follow 23456 | Straight/10 |

## 书摘边界（重点）

| 例 | 止于 |
|---:|---|
| 48 | 「单牌越少越好」；不含「比如,上家出了个杂花顺」 |
| 49 | 「继续出三带对」；不含第二家讲义 |
| 50 | 「组炸弹四个6、四个7」 |
| 51 | 「梅花同花顺」战术句；不含「二家和第三家没表态」 |
| 52 | 「QQQ88回手」；不含「牌弱打上家」讲义 |

## 约束

- 只读；失败分类：场景/golden 错 · 策略差异 · 书摘越界 · 页码/手牌 JSON 错
- 例51 有两场景（structure + follow），均须 PASS
