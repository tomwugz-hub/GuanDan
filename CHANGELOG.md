# 更新日志

本文件遵循 Keep a Changelog 风格。

## [Unreleased]

### 修复：还贡不能还级牌（2026-10-21）

- Bug：打 4 时南家还贡可选 ♦4（非红桃级牌按自然点 ≤10 算可还）。根因：`engine/tributeStd.isReturnEligible` 只排除王和逢人配，没排除非红桃级牌；UI 亮框、点选校验、“建议”、机器人/decide 还贡、play/core 合法性全走 `returnOptions`，所以全都放行。
- 修复：`isReturnEligible` 加 `c.rank !== lv`（任何花色级牌都不可还）。兜底（无 ≤10 非级牌）仍为“按本副大小还最小的一张非逢人配”：J…A 先于非红桃级牌、再王，只剩逢人配才还逢人配（主流规则未统一，27 张几乎不会遇到）。
- 文案：TRIBUTE.md、游戏内规则弹窗、还贡面板/提示/错误信息、play/README、policy/tribute.js 注释。policy 代码未改（plan 的 nonLevel 过滤现在只在兜底时生效）。
- 测试：test/tribute-std.test.js 新增 打 4/打 10/打 2/兜底/resolveTribute 用例；旧用例“打 5 ♠5 可还”改为不可还。串行 npm test 447/447；regress-all = r10 基线；play smoke OK；arena 1008 副 tribute vs post-selfplay-r10 −0.012 [−0.042, 0.019]，违例 0。
- 发布：线上缓存 **guandan-play-9e23943345**（旧 87dc31fbd1）。截图 /workspace/guandan-ui/return-tribute-fix.png（?seed=9 第 2 副打 4）。

### 进贡 / 还贡（网页对局 + 自对局）

- 新增 engine/tributeStd.js：主流进贡/还贡/抗贡（单贡、双下双贡大贡归头游、同点头游下家给头游、抗贡、还贡 ≤10、先出者）与标准升级（+3/+2/+1，打 A 头游且对家非末游过 A）。规则见 TRIBUTE.md。
- policy/tribute.js：机器人还贡 plan（按拆牌计划还最不伤手的牌，不还级牌），自对局 A/B 优于“还最小”。
- play/：第二副起进贡步骤（确认进贡、选牌还贡、抗贡提示、规则弹窗），?seed= 复现；网页版升级改用标准规则。
- selfplay/：进贡比赛（arena/audit --tribute --matchLen），进贡不变量，--ckpt 检查点续跑。

### 清理

- 删除未被加载的 app/app.js（bindUI 无调用方）。
- meta/index.js 收成预留桩（阶段/风格标签 + JSDoc），policy / UI / 测试仍不依赖；pack.mjs 继续打包。
- 去掉未用 import/export：combos.js 的 seqIndex/JOKER_BLACK、内部死函数 allSameJoker/canFillSequence；legal.js 对 interpretAs 的无用再导出；state.js 对 nextLevelRank 的无用再导出；belief 对 countByRank 的再导出；pedagogy 对 decide 的再导出；policy 未用的 classify；ml/features.js 未用的 oppMin。
- 未改 window.Guandan 打包导出表。

### 拆分

- app/ui.js 抽出 app/hand-layout.js（列布局、统一牌面 class/HTML）与 app/table-plays.js（桌面出牌展示），挂在 window.GuandanUI。二者为普通 script，满足 file:// 不能直接用浏览器 ESM 的约束。index.html 脚本改为 ?v=9。
- policy/isForbidden 及硬过滤辅助迁到 policy/filters.js，policy/index.js 再导出，测试 import 路径不变。
- engine/combos.js 未拆文件（顺子/连对/钢板互相依赖，拆 combo-seq.js 风险高于收益），改为分区注释 + 导出函数 JSDoc。

### 关键重构点

- 牌面 DOM 只走 GuandanUI.cardFaceClass / cardFaceHTML / makePcard，手牌列与桌面出牌共用，避免两套 HTML 字符串。
- 硬过滤与打分/决策分开文件，规则引擎文件不改判定语义。
- 各层导出函数补齐 @param / @returns / @throws（engine、policy、belief、search、pedagogy、user-model、tribute）。
- 命名保持 JS camelCase、常量 UPPER_SNAKE。

### 预期效果

- 主界面与硬过滤更容易定位、改一处牌面样式即可两边生效。
- 无声称性能数字；打包仍是无依赖 concat。可维护性提升，行为应与清理前一致。

### 建议回归测试

cd /workspace/guandan-coach && node --test，并人工核对：

- 逢人配最多 2 张；只有红桃级牌是配，其余花色级牌/王牌不是。
- 连对、钢板必须恰好 6 张；8 张连对 classify 为 null。
- 5 炸 < 同花顺 < 6 炸。
- 搭档出对 7 不得用同花顺砸（硬过滤）。
- 进贡方向：下游给上游；双下不进贡；抗贡看进贡方双大王。
- 空手领出不合法（必须出牌）。
- 打开 index.html：理牌拖列、点选出牌、进贡弹层仍工作。

### 第二轮清理（v10）

- extraStructureMoves 去掉与 legalMoves 重复的 5 张顺/同花顺/三带二循环，只生成连对（恰好 3 对）与钢板（恰好 2 组三条）；`for (let pairs = 3; pairs <= 3)` 改为直接滑 3 对窗口。
- decide()：`(full.hand.length <= 2 || true) && full.hand.length <= 2` 改为 `full.hand.length <= 2`。
- 从 app/ui.js 抽出拖列/点选到 app/ui-pointer.js（`GuandanUI.bindCardPointer`），index.html 在 ui.js 前加载；缓存 `?v=10`，标题 掼蛋教练 v10。
- pack.mjs 不打包 UI 指针脚本（浏览器 script）；未改游戏规则与硬过滤。

### 第三轮清理（v11）

- 文档按真实代码重写中文：ARCHITECTURE（分层、legalMoves vs extraStructureMoves 只补连对/钢板 6 张、浏览器 all.js + GuandanUI 脚本、file:// / 内置测试 / 无第三方包）、SUMMARY（已交付 vs 未做：无完整官方进贡分叉、无手动还贡选择器、无真实神经网络）、USER、TEST-REPORT、REQUIREMENTS-P0（历史备忘，指向 ARCHITECTURE/CHANGELOG）。
- 接通 meta：policy.reasonFor 按手牌张数附阶段句（开局/中盘/残局/收尾）；pack 导出 phaseOf / styleLabel / PHASES；牌桌 dealInfo 显示阶段。
- 新增 test/meta.test.js。index.html / learn.html 缓存戳 v=11，标题 掼蛋教练 v11。
- 未改游戏规则与硬过滤。

### 第四轮收尾（v12）

- 还贡手选：进贡模式下一局若需还贡，弹层列出每笔还贡（谁还谁）及该座位合法还贡牌。座位 0 手选；电脑自动还最小合法牌。未选或非法回退自动最小。
- 官方 vs 宿迁：过 A 三处差保持。新增一处官方进贡差：官方双下为双贡（大贡归头游）；宿迁双下不进贡。其余官方贡牌桌仪不声称。
- combos.js 未拆；legalMoves 跟牌子集跳过 6 张；未拆指针状态。
- 文档与缓存 v=12。

仍不做：真神经网络；完整官方进贡全文。

## [1.0.0] - 2026-08-24

- 初版：Node ESM 引擎 + 零依赖浏览器打包。
