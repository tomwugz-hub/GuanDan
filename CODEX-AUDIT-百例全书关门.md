# 百例全书关门 · 本地自动化审计（rev56）

- **基线：** `origin/main` @ rev56
- **日期：** 2026-08-08
- **模式：** 自动化回归（无浏览器抽验）

## 摘要

| 区间 | 场景数 | 门禁 | 结果 |
|------|--------|------|------|
| 1～50 | 50 | `npm run test:100cases:1-50` | PASS |
| 51～100 | 49 | `npm run test:100cases:51-100` | PASS（85/88 跳过） |
| 全书 | 99 | `npm run test:100cases:1-100` | PASS |
| 候选校验 | 99 | `npm run test:100cases:validate` | PASS |
| 教纲冒烟 | 203 | `npm run test:100cases:smoke` | PASS |
| 主冒烟 | — | `node tests/smoke.mjs` | PASS |
| 策略修订 | — | `COACH_STRATEGY_REVISION = 56` | — |

## 本轮策略修复（rev53→56）

1. **P10 防抢权**：队友占圈 + 下家未表态 → 首推最小散单（修复 `hasOnlyAntiSinglePenaltyReasons` 误判 pro-single 理由）
2. **C100-G1**：搭档占圈宜过在 `opponentsPendingAfterPlayer>0` 时不适用
3. **hard-invariants**：人类路径 `mustYieldToPartner` 改用 `shouldYieldPassToPartner`（非 robot 版）
4. **human-lite**：须压三张结构安全过滤；三带二 UI 列跑道 + 逢人配拆跑道门禁
5. **wild-doctrine**：有结构安全三带二够压时不盲过

## 待办

- [ ] 浏览器抽验：游戏页页脚 rev56 + 随机 3 例目视 Top1
- [ ] `must-beat-twp-no-break-sf-game-path.mjs`（游戏 UI 无列组时 AAA 路径，仍 Pass）

## 结论

**百例 1～100 自动化回归：CLOSED / PASS**
