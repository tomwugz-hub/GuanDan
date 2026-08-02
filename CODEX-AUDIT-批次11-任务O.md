# Codex 任务 O · 批次11 只读审计：《掼蛋实战100例》例 58～62

- **项目：** 掼蛋教练 Pro
- **模式：** 只读复验（**不改** `strategy/`、训练 JSON）
- **基线：** Cursor 批次11 落地后（**rev39**）；`git pull` 后应含批次11 策略/测试/书摘提交，或直接在含 rev39 的工作区运行
- **目标：** 新增 `CODEX-AUDIT-批次11.md`

## 命令

```bash
cd D:\掼蛋教练Pro
git pull origin main

node tests/hand-labeler-excerpt.mjs
node tools/audit-case-json.mjs case-058 case-059 case-060 case-061 case-062
node tests/case-scenario-top1-58-62.mjs
node tests/case-scenario-top1-53-57.mjs
node tests/smoke.mjs
```

## 期望 Top1

| 例 | PDF页 | 级牌 | 场景 | 期望 |
|---:|---:|---|---|---|
| 58 | 113 | 9 | follow 三个K | Triple/A（三个A管三个K，拆四A炸立牌） |
| 59 | 114 | 2 | structure | Straight/8 > Bomb/9（45678杂花顺发挥红配） |
| 60 | 116 | Q | follow 23456 | Straight/10（678910，非开8炸） |
| 61 | 120 | 4 | open | Pair/2（弱牌双红配试探，C100-O1） |
| 62 | 121 | 6 | structure | Bomb/8 > Bomb/9（炸弹归位四8/四9） |

## 书摘边界（重点）

| 例 | 止于 / 不得混入 |
|---:|---|
| 58 | 「处理了一个单张5。」；不含「乱你反正抢不了头游」 |
| 59 | 「牌型多元化。」；不含「( 牌都输了 , 手里还有炸弹」 |
| 60 | 「三个 K 带对8。」；不含「关于"一种牌型打到底"」 |
| 61 | 「7方片同花顺。」；不含「10以上的对子」 |
| 62 | 含正文「炸弹越多越好」原则句；止于「抢头游的机会。」；不含「2. 封牌」 |

## 约束

- 只读；失败分类：场景/golden 错 · 策略差异 · 书摘越界 · 页码/手牌 JSON 错
- PDF 页码以 `training-samples/case-page-map.json` 为唯一权威
- 例62 书摘**允许**出现「炸弹越多越好」（战例正文），勿误判为例28讲义 bleed
- 例59/62 为 **structure** golden：用 `scoreCandidate` 偏序（prefer 分低于 over），非 `getTurnAdvice` 无上一手场景
- 报告须核对 standalone / 源码 `COACH_STRATEGY_REVISION = 39`
