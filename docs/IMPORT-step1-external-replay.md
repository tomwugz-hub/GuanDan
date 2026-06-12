# 外部牌谱线 · 第一步：日志导入（四座位）

把 **OpenGuanDan** 或 **旧版 23456 WebSocket** 录制的 JSON/JSONL 日志，转成与「保存训练样本」相同的结构，并可用 `replay-to-rows` 抽四座位训练行。

## 支持格式

| 格式 | 识别特征 | 文档 |
|------|----------|------|
| **OpenGuanDan** | `type: notify/act/PLAY`，`stage: beginning/play` | [OpenGuanDan README](https://github.com/GameAI-NJUPT/OpenGuanDan) |
| **legacy-gd-ws** | 消息带数字 `id`（如 22 发牌、34 出牌） | [ai-guandan](https://github.com/shuilongzhu/ai-guandan) |

## 命令

```powershell
cd D:\掼蛋教练Pro

# 导入（参数：日志文件路径 [可选 gameId]）
node tools/import-external-replay.mjs D:\logs\room1.jsonl

# 抽训练行
node tools/replay-to-rows.mjs training-samples/imported/room1.json

# 统计
node tools/analyze-training-samples.mjs
```

或：`npm run data:import -- D:\logs\room1.jsonl`

## 输出

- `training-samples/imported/<gameId>.json` — 可给教练/训练管线读
- `training-samples/imported/imported-games.jsonl` — 累积库
- 导入时用引擎 **回放** 每一手，并生成 `coachAdviceTimeline`（含候选 Top 列表）

## 标签

外部对局默认 **silver**（`opengdan-import` / `legacy-gd-import`），权重约 0.4～0.45；比 bronze 自博弈更接近「实战节奏」，但仍需你后续用金标局纠偏。

## 重要限制（必读）

1. **四座位发牌**：日志里必须有 **4 条** `notify beginning`（四个 `myPos` 各一份），或旧协议 **4 条 id:22**。  
   只有一路客户端录屏 → 只能导入该座位视角，**不能**凑齐四座位 ML。
2. **推荐录法**：OpenGuanDan 开房后，四个 AI 客户端各连 `ws://127.0.0.1:8181`，把四路 WebSocket 消息合并进一个 `jsonl`（按时间排序）。
3. **不做爬虫**：商业 App 牌谱请用「导出文件」再 `import-external-replay`，不要未授权抓包。

## 下一步（第二步，未做）

- `tools/merge-opengdan-logs.mjs`：合并四客户端 jsonl  
- 或 **实时录制桥接**：连 OpenGuanDan 时自动写入 `training-samples/imported/`
