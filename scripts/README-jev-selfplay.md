# Jev 四座掼蛋自对弈演示

用本地引擎策略 `decide` 生成候选着法，再调用 TypeSafe **Jev**（`jev-latest`）在候选中择一。与微信、喜马拉雅等业务无关，仅为掼蛋教练仓库内的自对弈实验脚本。

## 如何运行

在仓库根目录：

```bash
export TYPESAFE_API_KEY='你的密钥'   # 或 TYPESAFE_API_KEY_NEW
node scripts/jev-four-seat-selfplay.mjs
# 短演示（省调用）
node scripts/jev-four-seat-selfplay.mjs --max-plays=40
```

- 默认最多 **80** 手；硬上限 250。局满（≥3 人出完）会提前结束。
- 无 API Key 时会自动 fallback 到 `decide.move`（仍可跑通引擎）。
- 脚本也会尝试从 `/home/box/agent-data/box-secrets.json` 的 `card` 字段读取密钥（**不会打印密钥**）。

## 四人设

| 座位 | 名称 | 风格 |
|------|------|------|
| 0 | 东 | aggressive：偏炸、抢控 |
| 1 | 南 | conservative：保结构、少早炸 |
| 2 | 西 | partner-first：护搭档、少砸队友 |
| 3 | 北 | balanced：中庸 |

人设写入 Jev 的 `state` / instructions，由模型在 top-K（≤5）候选中选择；本地 `decide` 本身不改分。

## 相关代码

- `policy/jevScore.js`：`pickWithJev({ candidates, state, persona, apiKey })`，UI 可复用。
- `scripts/jev-four-seat-selfplay.mjs`：本演示入口。
- 引擎：`engine/state.js`（`createMatch` / `createRound` / `applyPlay`）。
- 策略：`policy/index.js`（`decide` / `labelCombo`）。

## 残局评估

离线/小样本对照 `decide` vs Jev vs 人工标金：见 [`eval/endgames/README.md`](../eval/endgames/README.md)（`node scripts/run-endgame-eval.mjs --jev=0`）。

## API 要点

- `POST https://api.typesafe.ai/v1/systemone`
- `model: jev-latest`
- 每回合 **一次** Choice 问题（`m0`…`mK-1`），失败则回退 `decide.move`。
