# Codex 任务 O · 全书只读审计：《掼蛋实战100例》例 1～100 关门

- **项目：** 掼蛋教练 Pro
- **模式：** 只读复验（**不改** `strategy/`、训练 JSON）
- **基线：** `origin/main`（**rev50**）；`git pull` 后应含 `fb36de8` 或更新
- **目标：** 新增 `CODEX-AUDIT-百例全书关门.md`

## 命令

```bash
cd D:\掼蛋教练Pro
git pull origin main

node tests/hand-labeler-excerpt.mjs
node tools/validate-100cases-scenarios.mjs
npm run test:100cases:1-100
node tests/smoke.mjs
node tools/build-standalone.mjs
```

## 覆盖范围

| 区间 | 场景数 | golden 门禁 | 备注 |
|------|--------|-------------|------|
| 1～50 | 50 | `npm run test:100cases:1-50` | 批次 A1～A6 + rev48～50 |
| 51～100 | 49 | `npm run test:100cases:51-100` | 批次6～19 + rev47；**跳过 85/88** |
| 全书 | 99 | `npm run test:100cases:1-100` | 上述合并 |

## 约束

- 只读；失败分类：场景/golden 错 · 策略差异 · 书摘越界 · 页码/手牌 JSON 错
- PDF 页码以 `training-samples/case-page-map.json` 为唯一权威
- **Oracle** 为 `case-scenarios-1-50.json` + `case-scenarios-51-100.json`
- 报告须核对源码 / standalone **`COACH_STRATEGY_REVISION = 50`**
- **永久跳过：** 例85、例88（书中无独立战例）
- 浏览器复验：游戏页页脚 rev50 + 随机抽 3 例（1～50 抽 1、51～100 抽 2）目视 Top1

## 期望输出

- `CODEX-AUDIT-百例全书关门.md`：摘要表（1～50 / 51～100 / 全书）、validate + 1-100 回归、smoke、rev50、浏览器抽验、结论 **PASS/CLOSED** 或待办
