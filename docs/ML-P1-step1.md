# P1-第一步：模仿学习基线（Policy v001）

在 P0 的 `rows.jsonl` 上训练**候选排序模型**：每条样本 = 一手牌 + 多个合法候选，标签 = 实际出的那一手。

## 环境

**默认（推荐）**：只需 Node.js，无需 Python。

可选：已安装 Python 时可用 `python ml/train_policy.py`（scikit-learn 版，见 `ml/requirements.txt`）。

## 命令（按顺序）

```powershell
cd D:\掼蛋教练Pro

# 若还没有训练行
node tools/batch-auto-games.mjs 500
node tools/replay-to-rows.mjs

# 训练 → models/policy-v001/
node tools/train-policy.mjs

# 评估 Top1 命中率
node tools/eval-policy.mjs
```

或：`npm run data:train` / `npm run data:eval`

## 产出

| 文件 | 说明 |
|------|------|
| `models/policy-v001/model.json` | 线性权重，供后续 Node 推理 |
| `models/policy-v001/metrics.json` | 训练指标 |
| `models/policy-v001/feature_spec.json` | 特征名列表 |

## 模型说明

- 类型：LogisticRegression（候选级二分类：是否为标签出牌）
- 推理：对同一手牌的每个候选算分，取最高分
- 特征：座位、剩牌、牌权、需压牌型、候选牌型、启发式 `engine_score`、是否拆炸等

## 指标怎么看

- `rowTop1Train.top1`：整行 Top1 与标签一致的比例（越高越好）
- `candidateAuc`：候选级区分度（参考用）
- 金样本少时，以 **bronze 自博弈** 为主，模型会先「像当前机器人」

## 下一步（P1-第二步，已完成）

见 [ML-P1-step2.md](./ML-P1-step2.md)：Node/浏览器加载 `model.json`，与启发式加权融合，页头 **ML推荐** 开关。
