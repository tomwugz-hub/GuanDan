# 掼蛋教练 Pro — Agent 工作说明

## 架构（改代码前先读）

| 层 | 目录 | 说明 |
|----|------|------|
| 规则 | `engine/` | 纯规则：出牌合法性、比大小；**无** UI/策略 |
| **产品决策** | `decision/` | **UI 与机器人 Top1 的唯一来源**：`decide()` → `coach/human-advice.mjs` / `coach/robot-decision.mjs` |
| 遗留评分 | `strategy/` | 教纲 enforcement、问教练 `local-qa`、应急 `humanAdviceFallback`、审计；**不要**为新产品行为只改这里 |
| 教练/UI | `coach/`、`app/` | 适配层、复盘、问教练 |
| 回归 | `tests/` | 教纲、golden、百例 |

**产品路径：** `app/main.mjs` → `getHumanTurnAdvice` → `decision/decide.mjs`（`DECISION_CORE_REVISION`）。

**遗留路径：** `getTurnAdvice` / `recommendPlay`（`strategy/recommend.mjs`）仍用于部分教纲回归与工具；与产品不一致时以 **decision** 为准，并补 `tests/recommend-alignment.mjs` 或 golden（`tests/lib/product-advice.mjs`）。

## 完成定义（Definition of Done）

1. 动到 Top1 / 教纲：`decision/doctrines/*`、`decision/candidates.mjs`、`decision/rank.mjs` 或明确标注的遗留模块。
2. `node tests/recommend-alignment.mjs`（若双轨相关）。
3. `npm test` 全绿（干净 clone，不依赖 gitignore 的 `training-samples/active-session.json`）。
4. 发布前：`npm run build`（`tools/pre-release-gate.mjs` + standalone）。
5. 用户向 golden 变更：使用 `productTop1`（统一内核），PR 中说明每条变更原因。
6. 局末自动改策略：见 `.cursor/rules/guandan-coach-auto.mdc`；优先 **decision/**，必要时 `coach/`；legacy 仅当明确仍服务产品路径。
7. 发布门禁策略审计（`tools/lib/release-gate-audit.mjs`）：6 局 seed `88015`，阻断拆炸/裸三张等；`wild-low-value` / `split-structure-single` 等为诊断项（decision-core 与 legacy 审计口径差异），暂不计入 exit code。

## 常用命令

```bash
npm test                    # 默认回归（教纲 + smoke + 流水线冒烟）
npm run test:doctrine       # 教纲全量
npm run test:100cases:smoke # 百例 smoke
npm run build               # 发布门禁 + standalone
npm run dev                 # http://127.0.0.1:8010/app/
node tests/smoke.mjs        # 大冒烟（含 day2 抽查）
```

## 勿做

- 不要为通过测试而**只**改 `strategy/recommend.mjs` 却期望游戏页 Top1 变化。
- 不要提交 `training-samples/active-session.json`（已 gitignore）；教纲可选 fixture 见 `tests/fixtures/`。
- 不要在没有回归的情况下删除 `humanAdviceFallback`（应急测试仍依赖 strategy 兜底实现）。

## 文档

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [training-samples/STABILITY-CONTRACT.md](training-samples/STABILITY-CONTRACT.md)
- [docs/COACH-TRAINING-LOOP.md](docs/COACH-TRAINING-LOOP.md)
