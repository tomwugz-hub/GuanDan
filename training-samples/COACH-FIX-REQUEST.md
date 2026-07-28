---
status: done
feedbackId: gr-1784726576032-y6wptm
kind: game-review
createdAt: 2026-07-22T13:22:56.092Z
resolvedAt: 2026-07-27T14:40:00.000Z
---

# 教练修复（已完成）

## 批次 A · match-7 中小三带二宜过牌（P4）

**问题：** 须压 666+22 / 999+44，Top1 推荐 JJJ+22 拆连对 2-3-4  
**修复：** `shouldPreferPassForHeavyHandRoutineTripleWithPair` + 快路径守卫 + 三带二最小够压过滤  
**回归：** `tests/match7-routine-twp-heavy-hand-pass.mjs`、`tests/beat-level-twp-bomb-only-pass.mjs`

## 批次 B · perf 审计 + 机器人 P12（2026-07-27）

**问题：** perf 审计 `bomb-vs-routine` 误报（lite 候选表有对子但教纲不可行动仍算可压）；机器人 seed 42000 第14手对K仅炸弹却动炸  
**修复：**
- `audit-strategy.mjs` perf 模式改用 `hasActionableRegularBeater`（教纲可行动普通压牌）
- 机器人快路径：有可行动普通压牌 → 交全量评分；手牌仍多 + 常规牌型 + 仅炸弹 → P12 过牌

**回归：** `tests/robot-routine-bomb-heavy-hand-pass.mjs`

---

请 **Ctrl+F5** 刷新游戏页。perf 全量审计可本地跑：`node tools/audit-strategy.mjs 20 42000 2 --mode=perf`
