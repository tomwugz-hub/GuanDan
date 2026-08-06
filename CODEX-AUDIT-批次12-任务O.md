# Codex 任务 O · 批次12 只读审计：《掼蛋实战100例》例 63～67

- **项目：** 掼蛋教练 Pro
- **模式：** 只读复验（**不改** `strategy/`、训练 JSON）
- **基线：** `origin/main`（**rev40**，Cursor 批次12 落地后）；`git pull origin main` 后应含 `1b871cb`
- **目标：** 新增 `CODEX-AUDIT-批次12.md`

## 命令

```bash
cd D:\掼蛋教练Pro
git pull origin main

node tests/hand-labeler-excerpt.mjs
node tools/audit-case-json.mjs case-063 case-064 case-065 case-066 case-067
node tests/case-scenario-top1-63-67.mjs
node tests/case-scenario-top1-58-62.mjs
node tests/smoke.mjs
```

## 期望 Top1

| 例 | PDF页 | 级牌 | 场景 | 期望 |
|---:|---:|---|---|---|
| 63 | 123 | 2 | structure | StraightFlush/5 > Straight/5（A2红配345方片SF多元化） |
| 64 | 124 | 6 | follow A2345 SF | StraightFlush/7（910JQK管压，非炸弹快路径） |
| 65 | 126 | 9 | open | Single/3（88822结构，无王无主先单3试探） |
| 66 | 128 | 6 | structure | Triple/2 > Straight/7（抗贡先三个2再三A回手） |
| 67 | 129 | A | structure | Straight/5 > Bomb/8（拆8炸组A234红配5减单） |

## 书摘边界（重点）

| 例 | 止于 / 不得混入 |
|---:|---|
| 63 | 「牌型多元化」；不含「3. FARE」（守门神讲义） |
| 64 | 「组10JQKA( 红配 ) 黑桃」；不含「还有一种牌也是要炸的」（残局炸讲义） |
| 65 | 「春天到来。」；不含「于白炸」（换牌讲义） |
| 66 | 「后有三带对」；不含「5. 留牌」（留牌讲义） |
| 67 | 「5678( 红配 )9梅花同花顺。」；不含「比如, 末家两手牌」（抢牌讲义） |

## 约束

- 只读；失败分类：场景/golden 错 · 策略差异 · 书摘越界 · 页码/手牌 JSON 错
- PDF 页码以 `training-samples/case-page-map.json` 为唯一权威
- 例63/66/67 为 **structure** golden：用 `scoreCandidate` 偏序（prefer 分低于 over），非 `getTurnAdvice` 无上一手场景
- 例64 须在 **P7 炸弹快路径之前** 走 C100 SF 管牌逻辑（`pickC100MustBeatStraightFlushBeater`）
- 报告须核对源码 `COACH_STRATEGY_REVISION = 40`；standalone 若仍为 rev39 记 P2（dev-server 动态注入 rev40）
