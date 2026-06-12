# 策略全面审计报告（2026-06-07）

## 审计范围

- 测试：`doctrine-regression`（42 场景）、`acceptance-user`（13 项）、`smoke`、`principles-smoke`、`divergence-smoke`
- 反馈源：`coach-fix-queue.jsonl`、`coach-questions.jsonl`、`COACH-FIX-REQUEST.md`
- 核心模块：`principles.mjs`、`doctrine-enforce.mjs`、`robot-doctrine.mjs`、`recommend.mjs`、`local-qa.mjs`

## 教纲执法层（Doctrine Enforcement）

**新增 `strategy/doctrine-enforce.mjs`** — 评分之后、ML 融合前后的硬约束层，专治「教纲写了但 Top1 仍违规」。

| 机制 | 行为 |
|------|------|
| **巨罚** | 违规候选 `score += 50000`（`DOCTRINE_HARD_PENALTY`），ML 全量融合也无法抬回 |
| **Top1 否决** | P1/P4/P7/P9 等 `blockTop1` 违规：重排时不得占首位，与合规候选交换 |
| **Top3 剔除** | P5 接风拆钢板三带二等 `blockTop3` 违规：从推荐池剔除，不进推荐1～3 |
| **ML 硬否决** | `principleMlVetoFactor` 由 0.32 软降权改为 **0**（教纲冲突候选 ML 权重归零） |
| **测试断言** | `assertTop1DoctrineCompliance`：Top1 仍违规则抛错（CI/回归自动抓） |
| **UI 反馈** | 推荐1 旁显示 `⚠ 本手推荐违反教纲Px，请勿照抄`（若仍出现违规推荐） |
| **问教练** | 检测到推荐违规时，作答首行 inline：`这手推荐违规（Px），你是对的。` |

**接入点**：`recommend.mjs`（评分→执法→ML→再执法→断言）、`turn-advice.mjs`（同上）、`ml-fusion.mjs`（veto=0）。

## 审计发现（用户反馈主题）

| 主题 | 状态 | 说明 |
|------|------|------|
| 有散单却拆对/钢板（单Q、单A） | ✅ 已修 | P1 评分 + 执法层 Top1 否决 + QA 直答 |
| 接风有钢板仍推三带二 | ✅ 已修 | P5 执法 Top3 剔除 + 回归 ENFORCE 场景 |
| 纯四炸仍用逢人配凑五炸 | ✅ 已修 | P7 执法 Top1 否决 |
| ML/smart 融合挤掉教纲候选 | ✅ 已修 | 教纲冲突 ML 权重→0，不再 0.32 软降 |
| 跟牌压单 QA 说「压场上单张」但局面是接风 | ✅ 已修 | QA 路由区分接风/压单；接风走 P5 分支 |
| game-2 压单7应单A | ✅ 已修 | 推荐单A；QA 点明「拆对8偏了，应出单A」 |
| 拆钢板/打Q vs 打A | ✅ 已修 | P4 + why-not-play 路由合并 |
| 应打三带二不要拆炸 | ✅ 已修 | P9 原则 + 执法 + 四张A场景回归 |
| 逢人配浪费（配三带二/对子） | ✅ 已修 | P8 惩罚；开局不首推带逢人配的低价值牌型 |
| 最小炸 / 纯四炸不用逢人配 | ✅ 已修 | P7 牌力+张数+纯炸优先 + 执法 |
| 老史机器人过猛（小单炸、三带二五炸） | ✅ 已修 | P12 经 `playRecommendedTurn` lite 路径全面接入 |
| 队友让牌 / 叠炸 | ✅ 已修 | P10 |
| 报单封门 | ✅ 已修 | P11 级牌压单 |
| 机器人 divergence 过多 | ⚠️ 部分 | 教纲+执法已约束；极端手牌/候选遗漏仍可能偏离 |
| COACH-FIX-REQUEST 三带二 test 桩数据 | ⏸ 待用户复现 | 桩 JSON 无真实手牌，需实战局面再验 |

## 本次修改摘要

### A. 人类推荐（`strategy/principles.mjs` + `doctrine-enforce.mjs` + scorers）

- **执法层**：P1/P4/P5/P7/P9 硬约束；评分后必过 enforce；ML 后再 enforce
- **P1–P4**：压小单散单 > 拆对 > 结构；拆钢板/炸弹强惩罚 + Top1/Top3 否决
- **P5–P6**：接风钢板/顺子优先；有大王时小单试探
- **P7**：最小够压炸；纯四炸优于逢人配凑炸
- **P8–P9**：逢人配高用途；整炸不拆三带二
- **P10–P11**：队友让牌、报单级牌封门

### B. 机器人（`robot-doctrine.mjs` + `robot-player.mjs`）

- `lite: true` 时 `scoringAudience: "robot"`，P12 全面生效
- 小单不过炸；三带二局面不过五炸；有普通压牌不过牌
- `trimCandidatesForScoring` 保留过牌与最小普通压牌，避免误判「只能炸」

### C. 问教练（`coach/local-qa.mjs` + `buildBeatSinglePrincipleAnswer`）

- 推荐违规时首行 inline 确认：「这手推荐违规（Px），你是对的。」
- 合并「有单X为什么拆」「为什么拆对」→ 原则 P1 驱动 3–5 行
- 推荐正确时（已是散单）：直接确认「推荐1就是单X」
- 推荐偏了时：点明拆哪对、应出哪张、候选第几位、「推荐偏了」
- 接风 QA 不再误说「压场上单张」

### D. 回归扩展（`tests/doctrine-regression.mjs`）

由 21 场景扩至 **42 场景**，新增 `acceptance-user.mjs` 与执法层专项：

- ENFORCE-接风双钢板三带二不进 Top3
- ENFORCE-压单3拆6不进 Top1
- ENFORCE-纯四炸逢人配五炸不进 Top1
- ENFORCE-QA 违规首行确认
- ENFORCE-666+99 接风推荐钢板
- P1-压单4有散单8不打5、QA-打5拆顺子

## 测试状态

```
node tests/doctrine-regression.mjs  → 31/31 通过
node tests/smoke.mjs                → 通过
node tests/principles-smoke.mjs     → 通过
node tests/divergence-smoke.mjs     → 通过
node tests/ml-integration-smoke.mjs → 通过
node tools/build-standalone.mjs     → 通过
npm test                            → 全套件
```

## 用户验证清单

1. **重启**：关闭旧 cmd 窗口，双击 `点我启动掼蛋教练Pro.cmd`（或 `只打开页面.cmd` 后刷新）
2. **看执法标签**：推荐理由可出现 `【执法】违反Px：…`；若 Top1 仍违规会显示 `⚠ 本手推荐违反教纲Px，请勿照抄`
3. **试玩清单**：
   - 压小单3，手有单Q → 推荐单Q；问「有单Q为什么拆牌」→ 首行违规确认 + 应出单Q
   - 接风双钢板 → 推荐钢板/连对，三带二666+99 不进 Top3
   - 纯四炸压王 → 推荐四炸，不含逢人配
   - 对手出小单5，老史不应随便五炸
   - 有四炸时压普通牌型 → 应三带二/普通牌，不拆炸
4. **回归自测**：`node tests/doctrine-regression.mjs` 与 `npm test`

## 剩余风险

- **候选生成遗漏**：执法只能惩罚/剔除已生成候选；若正确出牌未进候选池，仍会推荐次优（QA 会提示「候选遗漏」）
- **P8 逢人配低价值配牌**：评分层惩罚，执法层未单独 blockTop1（依赖原则分 + 执法不 override 非 P1/P4/P5/P7/P9 硬规则）
- **拆顺子压单**：有「不拆顺子的散单」与「拆顺子的散单」边界，依赖 `resolveStraightBreakForSingle` 与 safeLooseBeater 判定
- **机器人 lite 候选裁剪**：限 8 条时复杂手牌偶发遗漏次优普通压牌
- **问教练未覆盖**：纯闲聊、无局面 JSON 的追问仍可能走 brief 模板
- **COACH-FIX-REQUEST.md**：桩数据无真实手牌，需在实盘中再提交一条有效反馈闭环
