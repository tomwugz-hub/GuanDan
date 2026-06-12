# 数据流水线 P0

目标：不依赖单一真人攒局，把**导出 / 自博弈 / 未来外部牌谱**统一成可训练格式，并拆成**四座位**训练行。

## 目录

```
掼蛋教练Pro/
  training-samples/          # 原始样本（jsonl / latest.json）
  datasets/v1/
    rows.jsonl               # 训练行（每手每座位一行）
    canonical-replays.jsonl  # 标准化牌谱
  tools/
    batch-auto-games.mjs     # 批量自博弈产样本
    replay-to-rows.mjs       # 样本 → 训练行
    analyze-training-samples.mjs
    lib/canonical-replay.mjs
```

## 一键命令

```powershell
cd D:\掼蛋教练Pro

# 1) 批量自博弈（默认 200 局，四座位均记录）
node tools/batch-auto-games.mjs 500

# 2) 抽取训练行（会读 training-samples 下所有样本 + 你导出的 json）
node tools/replay-to-rows.mjs

# 指定导出文件
node tools/replay-to-rows.mjs "D:\Download\guandan-expert-games.json"

# 3) 看统计
node tools/analyze-training-samples.mjs
```

npm 脚本：

```powershell
npm run data:batch
npm run data:rows
npm run data:stats
```

## Canonical Replay（标准牌谱）

每局一条 JSON（`canonical-replays.jsonl`）：

| 字段 | 说明 |
|------|------|
| `gameId` / `seed` | 局标识 |
| `levelRank` | 级牌 |
| `initialHands[4]` | 发牌后四座位手牌 |
| `actions[]` | 按出牌顺序，含每手完整上下文 |

每个 `action` 来自 `coachAdviceTimeline`（优先）或 `playHistory`（兜底）。

## Training Row（训练行）

每手每座位一行（`rows.jsonl`）：

| 字段 | 说明 |
|------|------|
| `seat` | 0～3，四座位均拆行 |
| `state` | 该座位手牌、四家剩牌数、牌权、需压牌型 |
| `candidates` | 当时教练 Top 列表（有则带） |
| `label.play` | 实际出牌 |
| `tier` / `weight` | 金/银/铜标签 |

### 标签分级（P0）

| tier | 条件 | weight |
|------|------|--------|
| gold | 真人且 `outside-top-3` | 1.0 |
| silver | 真人其它 / 未知来源 | 0.3～0.4 |
| bronze | `batch-auto` / `robot-auto` / `auto-game` | 0.15 |

## 数据来源（由少到多）

1. **你打牌 + 保存训练样本** — 金标调味  
2. **`batch-auto-games.mjs`** — 规模主力（四座位）  
3. **页面「导出记录」JSON** — `replay-to-rows` 直接吃  
4. **未来：外部适配器** — 见下节  

## 外部牌谱（进行中）

| 适配器 | 状态 | 说明 |
|--------|------|------|
| 本软件导出 | ✅ `replay-to-rows` | v2/v3 导出 JSON |
| **OpenGuanDan 日志** | ✅ 第一步 | `tools/import-external-replay.mjs`，见 [IMPORT-step1](./IMPORT-step1-external-replay.md) |
| **legacy 23456 日志** | ✅ 第一步 | 同上，识别 `id:22/34` |
| 四路日志合并 | ✅ 第二步 | `merge-opengdan-logs.mjs`，见 [IMPORT-step2](./IMPORT-step2-merge.md) |
| 产品内「导入牌谱」 | ✅ | 页头按钮，浏览器合并导入 |
| ML 接入推荐 | ✅ | `strategy/ml-policy.mjs` + `recommend.mjs`，勾选「ML推荐」 |
| ML 训练门禁 | ✅ | `tools/gate-policy.mjs`，`npm run data:gate` |

## 与 ML 的衔接

- **P1-第一步**：`node tools/train-policy.mjs` → `models/policy-v001/`  
  详见 [ML-P1-step1.md](./ML-P1-step1.md)  
- **P1-第二步**：`model.json` 接入 `recommend.mjs` 与机器人出牌，见 [ML-P1-step2.md](./ML-P1-step2.md)  
- 四座位共用一个 Policy；特征见 `ml/feature-encoder.mjs`  

## 版本

- `schemaVersion: 1` — P0 首版，字段变更时递增并写迁移脚本。
