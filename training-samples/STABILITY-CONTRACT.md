# 掼蛋教练 Pro 稳定性契约（2026-06-07）

## 核心目标（North Star）

**第一优先级**：帮助玩家做出**更可能赢牌**的决策——不是为「教纲字面正确」或「理论最小代价」而牺牲牌权/胜率。

| 约束 | 执行标准 |
|------|----------|
| 赢牌导向 | 牌权、控场、后续出牌空间 > 单纯「最小够压」；二者冲突时以夺权为准（已体现在 P7 六炸修订） |
| 同源一致 | 引擎 Top1、左侧推荐理由、问教练答复必须同源（`principles.mjs` → `doctrine-enforce`）；禁止主观臆测手牌/局面 |
| 改策略闭环 | 每次修订须举一反三 + 补 `doctrine-regression` 回归场景 + 用户三步实机验收 |

### 节奏与对局质量（与赢牌导向并列）

兼顾**队友**与**对手**的打法节奏，协同维持整体水准，让每一局呈现高质量对局——不单追个人一手最优。

| 维度 | 执行标准 | 代码落点 |
|------|----------|----------|
| 队友节奏 | 队友已控/已压时不抢牌权；接风时优先减手、延续配合（钢板/顺子优于拆结构三带二） | P10 队友让牌；P5 接风成组减手；`tempo-lead.mjs` 接风抑制连炸 |
| 对手节奏 | 识别施压/控场/收尾：有普通压牌则跟、不必盲炸；仅炸弹可压或夺权时才动炸；小单试探可过牌等循环 | P4/P7 最小够压与炸弹保留；`opponent-pressure.mjs` 跟牌/过牌/抢权 |
| 机器人节制 | P12：小单不过炸、三带二不五炸、手牌仍多可过牌；避免三家连环炸破坏节奏 | `robot-doctrine.mjs` + `principles.mjs` P12 |
| 高质量对局 | **推荐稳定** + **节奏合理** + **人机行为可预期**；与「赢下对局」并列，不牺牲牌权但也不为理论最小代价乱炸/抢权 | 回归 P10/P12 + `doctrine-checklist` 节奏核对项 |

下文「修复完成」门槛服务于上述目标：自动化全绿 ≠ 交付完成，须实机 3 步验收确认。

### 复盘驱动修复闭环

与 **North Star**、**改策略闭环** 并列执行：

| 步骤 | 动作 |
|------|------|
| 1 | 保存复盘 → `npm run ingest-review`（写入 `training-lessons.jsonl` + `five-game-batch.json`） |
| 2 | **教练更对**的分歧手 → 补 `tests/golden-game<seed>.mjs` 或 `golden-scenarios.mjs` |
| 3 | **发现即修**：不堆积 pending；能修则当场修引擎或更新过时断言 |
| 4 | 必做：`node tests/golden-*.mjs` + `doctrine-regression` 全绿 + `npm run build` |
| 5 | `COACH-FIX-REQUEST`：修完标 `done` 并注明场景 ID（如 `G-game2-seed902251982-turn60`） |

#### 五局训练批次（用户实机）

1. 每局结束在界面点**保存复盘**
2. 终端执行：`npm run ingest-review`
3. 助手根据 `training-lessons.jsonl` 最新一条写黄金场景 + 教训摘要
4. 五局满（`five-game-batch.json` → `games.length === 5`）后统一 `npm run build` 过门禁

**数据源优先级**：复盘分析读 `coach-questions-latest.json`，**不要**用 `active-session.json`（可能是局中快照）。

## 什么算「修复完成」

满足以下**全部**条件，才视为本轮回修验收通过：

| 门槛 | 命令 / 证据 |
|------|-------------|
| 教纲回归 ≥72 场景全绿 | `node tests/doctrine-regression.mjs` |
| 用户 3 条验收 + TOP10 全绿 | `node tests/acceptance-user.mjs` |
| 冒烟 + 原则 + boot 全绿 | `npm test` |
| standalone 可构建 | `npm run build` |

**架构约束（单一真相）**：

- 推荐、机器人、问教练共用：`physical hand` → `principles.mjs` → `doctrine-enforce.mjs`
- 问教练数牌用 `rankCountsFromHand` / `physicalRankCounts`，不以理牌分组代替物理张数
- ML `smart` 模式下教纲冲突候选 ML 权重归零，不得抬回 Top1
- 专问路由失败 → `fallback` 短答（禁止「规则备忘」炸弹 brief 作主路径）

## 用户 3 步实机验收法

### 准备

1. `npm run build` 后 **Ctrl+F5** 强刷页面（或重新打开 `点我启动掼蛋教练Pro.cmd`）
2. 页脚/问教练答复应含 `规则引擎 v2 · 构建 <数字>`

### 验收 1：接风双钢板

- 摆牌：手牌含 **666777** 与 **999101010** 两组钢板，接风（上家两家过）
- **左侧推荐1** 必须是 **钢板**（6 张连对），不得首推「三带二拆钢板」
- 问教练：「怎么又推荐拆钢板了？」→ 应答 P5/接风，点明钢板优先

### 验收 2：压单4有单8

- 摆牌：含顺子 A-2-3-4-5、散单 **8**，桌面需压 **单4**
- **左侧推荐1** 必须是 **单8**，不得首推 **单5**（拆顺子）
- 问教练：「怎么打5？打5不是拆顺子吗？」→ 应答「是，应出单8」，≤5 行，无「规则备忘」

### 验收 3：6张7压顺子45678

- 摆牌：物理手牌 **6 张 7**（7♠7♥7♥7♣7♣7♦）+ 其他牌（如实机 **三6+单3** 共 10 张亦可），桌面对手出顺子 **45678**
- **左侧推荐1** 必须是 **六炸7**（777777），非过牌、非四炸
- 掼蛋规则：顺子只有炸弹能压；手上有 **超过四张** 同点炸弹时，原则 P7 要求 **满张出炸控牌权**，四炸牌力弱易被反压
- 六炸即使对手同花顺也难轻易反压，能稳固牌权，后续才好出牌
- 推荐理由应含 **【P7】满张炸弹控牌权，四炸易被反压**
- 问教练：「为什么拆顺子？打了四个7剩下的两个7怎么办？」
  - 应写 **物理手牌 6 张7**
  - 应说明 **手里无顺子可拆**，是压对手顺子而非拆自己顺子
  - 应说明 **应满张六炸控权、四炸易被反压**
  - 压顺子场景**不应**误答「应出单8」或仅堆砌 P1/P4「不应拆顺子」

任一条不符 → 点「复制发给 Cursor」，附 **推荐1 截图 + build 号 + 本文件链接**。

## 自动化测试摘要（72+ 场景）

`doctrine-regression.mjs` 覆盖：

- **P1–P4**：散单优先、拆对/拆钢板/拆顺子禁止
- **P5–P6**：接风钢板/顺子、王回收试探；**P5-game2-turn56** 接风全散单理由不误写「有成组牌」
- **P7–P9**：满张炸弹控权、逢人配、整炸不拆三带二
- **P10–P12**：队友让牌、报单封门、机器人节制
- **ENFORCE-***：执法 Top1/Top3 否决、ML 无法抬回
- **ACCEPT-***：用户 3 条验收 + fallback 短答
- **QA-***：问教练专问路由（why-not-play / why-break-bomb-structure）

`acceptance-user.mjs`：3 条验收 + 历史 TOP10（滥炸、brief、复制 v2、物理手牌、整对K…）

## 什么不会再发生（本契约保障）

| 反复问题 | 保障机制 |
|----------|----------|
| 接风三带二拆钢板 | P5 执法 Top3 剔除 + 回归 ENFORCE |
| 压单拆顺子/拆对 | P1 执法 Top1 否决 + why-not-play |
| 6张7 QA 说 4 张 | `physicalRankCounts` + QA 写「物理手牌 N 张」 |
| ML 挤掉教纲 | `principleMlVetoFactor=0` + 执法巨罚 50000 |
| 问教练 brief 炸弹备忘 | 专问失败 → `fallback` 短答，无规则备忘 |
| 复制混旧 brief | `feedback-clipboard` 默认只复制 v2，标注时间+mode |
| 左侧推荐与执法不一致 | `enforceDoctrineOnCandidates` 后 `currentAdvice` 刷新；违规显示 ⚠ |
| newGame 卡死 | `scheduleHumanAdviceRefresh` 延后计算；boot-guard 冒烟 |
| 顺子仅炸弹可压却过牌 | `isBombOnlyBeatContext` + 压顺子满张炸弹控权 |

## 仍已知限制（诚实）

- **ML smart 开启**时，极端手牌/候选池截断仍可能偏离；教纲冲突已硬否决，但非冲突边界未 100% 覆盖
- **机器人**在 `lite` 路径已接 P12，复杂残局仍可能与人类思路不同（divergence 统计允许存在）
- **问教练**问句变体无穷，未命中专问路由时只能 `fallback` 提示改写，不能猜答
- **理牌竖列**与物理手牌分组可能不同；数牌以 `humanHand` 物理张数为准，结构解释可参考理牌
- **竞技赛制/贡牌**等特殊规则未纳入本教纲回归
- 父对话里 AI **看图数牌**仍可能出错；以客户端 `physicalRankCounts` 与左侧推荐为准

## 维护者命令

```powershell
Set-Location "D:\掼蛋教练Pro"
node tests/doctrine-regression.mjs
node tests/acceptance-user.mjs
npm test
npm run build
```

全绿后再请用户实机验 3 步。
