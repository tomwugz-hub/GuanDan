# P1-第二步：ML 策略接入推荐引擎

在 P1-第一步训练的 `models/policy-v001/model.json` 接入实时出牌推荐，与启发式评分融合，并在产品内提供开关。

## 架构

```
rows.jsonl 训练 → model.json
                      ↓
              strategy/ml-policy.mjs
                      ↓
         recommend.mjs（启发式 + ML 加权）
                      ↓
    getTurnAdvice / playRecommendedTurn / 页面「ML推荐」
```

## 融合公式

对每个候选：

1. 启发式 `scoreCandidate` 得到 `engine_score`（越小越优）
2. ML 输出 `mlScore ∈ (0,1)`（越大越像训练标签）
3. 融合分：`final = engine_score - mlScore × blend`（**blend 按局面自适应**，非固定 8500）

| 局面 | blend（智能模式） |
|------|-------------------|
| 接风 / 开局 | 炸弹 **0**；三带二/顺子等最多约 **2400** |
| 对手占牌、需压牌 | 约 **8500**（可用 `GUANDAN_ML_BLEND` 调整） |
| 有普通压牌却出炸 | 炸弹 blend 压低 |

页头 **ML智能** = 智能融合；取消勾选 = 纯规则。

默认全量 `blend = 8500` 仅 **强制模式**；可通过环境变量调整：

```powershell
$env:GUANDAN_ML_BLEND = "9000"
```

## 启用方式

| 场景 | 行为 |
|------|------|
| 浏览器 | 勾选页头 **ML推荐**；standalone 构建时内嵌 `__GUANDAN_ML_MODEL__` |
| Node 工具 | 存在 `models/policy-v001/model.json` 时默认启用；`GUANDAN_DISABLE_ML=1` 关闭 |
| 显式传参 | `recommendPlay(..., { mlModel })` / `playRecommendedTurn(state, { mlModel })` |
| 传 `mlModel: null` | 强制仅用启发式（与关开关一致） |

## 命令

```powershell
cd D:\掼蛋教练Pro

# 评估 Top1（与训练指标一致）
npm run data:eval

# 门禁：新模型不得低于阈值（默认 55%，或训练指标的 92%）
node tools/gate-policy.mjs

# ML 接入冒烟（推理路径 + recommendPlay）
node tests/ml-integration-smoke.mjs
```

或：`npm run data:gate`

## 产品表现

- 出牌建议与机器人出牌在开启 ML 后走同一套 `recommend.mjs`
- 每条建议理由会附带 `ML 倾向分 xx%`；首选含 `已融合 ML 策略模型（policy-v001）`
- 关闭 **ML推荐** 后仅启发式，便于对比

## 指标与门禁

- `data:eval` 的 `top1Accuracy` 应与 `metrics.json` 的 `rowTop1.top1` 接近
- `gate-policy.mjs` 未达标时 exit 1，避免用差模型替换线上权重
- 金标样本少时，模型仍以 bronze 自博弈为主，Top1 高只代表「像当前机器人」

## 相关文件

| 文件 | 作用 |
|------|------|
| `strategy/ml-policy.mjs` | 加载模型、打分、融合排序 |
| `strategy/recommend.mjs` | 推荐主入口 |
| `coach/turn-advice.mjs` | 教练建议（传 `mlModel`） |
| `coach/robot-player.mjs` | 机器人出牌（传 `mlModel`） |
| `app/main.mjs` | 开关、fetch/内嵌模型 |
| `tools/gate-policy.mjs` | 训练后门禁 |

## 上一步 / 下一步

- 上一步：[ML-P1-step1.md](./ML-P1-step1.md)（训练 policy-v001）
- 下一步（规划）：更强模型、金标加权训练、导入牌谱后自动 `train + gate + 替换`
