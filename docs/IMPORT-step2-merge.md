# 外部牌谱线 · 第二步：四路日志合并

## 命令

```powershell
node tools/merge-opengdan-logs.mjs seat0.jsonl seat1.jsonl seat2.jsonl seat3.jsonl --out training-samples/imported/merged.jsonl
node tools/import-external-replay.mjs training-samples/imported/merged.jsonl
```

或多文件一步导入：

```powershell
node tools/import-external-replay.mjs s0.jsonl s1.jsonl s2.jsonl s3.jsonl my-game-1
```

## 一键流水线

```powershell
node tools/pipeline-external-train.mjs s0.jsonl s1.jsonl s2.jsonl s3.jsonl
```

合并 → 导入 → `rows.jsonl` → 训练 `policy-v001`。

## 去重规则

| 消息 | 处理 |
|------|------|
| `notify beginning` | 按 `myPos` 保留 4 条 |
| `notify play` 等广播 | 四路重复只留 1 条 |
| `act` | 各客户端私有，全部保留 |
| `PLAY` | 按玩家+出牌去重 |

## 页面

- **导入牌谱**：选 1～4 个 json/jsonl，浏览器内合并并生成训练 JSON（写入导出区）
- **ML推荐**：勾选后用 `models/policy-v001/model.json` 参与出牌评分
