# 架构

掼蛋教练是零依赖 Node ESM + 浏览器 concat 打包。分层自上而下：app → user-model → pedagogy → meta → policy → search → belief → engine。上层可调用下层；engine 只判定规则，不做策略。

## 分层

app：app/、index.html、learn.html。牌桌与学习中心接线，不含规则/策略计算。
user-model：user-model/index.js。本机档案（浏览器 localStorage，Node 测试用内存）：六维、对局、错误、胜负。
pedagogy：pedagogy/index.js。教学点评、错误类型、周计划、训练、回放。不改变真实出牌。
meta：meta/index.js。按手牌张数估阶段（phaseOf）与风格短标签（styleLabel）。不写规则或硬过滤。
policy：policy/index.js + filters.js。decide / recommend：硬过滤 7 类失误，再打分 + 窄束搜索。
search：search/index.js。只枚举/搜索合法着：legalMoves + extraStructureMoves，beamSearch / heuristicEval。不做最终决策。
belief：belief/index.js。余牌、关键牌、对手风格先验。不做决策。
engine：engine/。牌、牌型、比较、合法着、进贡、级牌与过 A。engine/index.js 再导出。
ml：ml/。线性特征 + weights.json 打分。不是神经网络。

policy 可调用 belief / search / ml / meta。ml 被打包进 all.js，但不单独成决策层。

## 规则引擎（engine）

- ranks.js：点数、级牌、逢人配（仅红桃级牌）、顺子点数序。
- cards.js：两副 108、洗牌、发四手、formatCard / parseCard。
- combos.js：classify。型：单/对/三/三带二/顺/连对/钢板/炸/同花顺/过。顺与同花顺恰好 5 张；连对恰好 3 对（6 张）；钢板恰好 2 组三条（6 张）。配最多 2。
- compare.js：beats。5 炸 < 同花顺 < 6 炸。
- legal.js：isLegalPlay / playAction / legalMoves。
- tribute.js：进贡方向、抗贡（进贡方双大王）、还贡（自然点不超过 10、非王非级牌）。previewTributes / legalReturnCards 供手选；applyTributes 可选 returns，非法回退自动最小。官方双下双贡（resolveTributePairs 大贡归头游）。
- state.js：createMatch / createRound / applyPlay / applyGameResult。
- rulesets.js：默认宿迁；official2022 过 A 三处开关 + 双下双贡。不是完整官方进贡分叉。

## legalMoves 与 extraStructureMoves

legalMoves(hand, previous, levelRank, leading)（engine/legal.js）按点数分组生成，不是全子集爆炸搜索：

- 跟牌可过；领出不能过。
- 同点 1…n 张（单/对/三/炸）及配补（配最多 2）。
- 三带二（一组三条 + 一组对子，配最多 2）。
- 恰好 5 张顺 / 同花顺。
- 跟牌且 previous.size ≤ 8（跳过 6）、手牌 ≤16 时，再试恰好同长度子集。size 6 的连对/钢板由 extraStructureMoves 生成。

不在 legalMoves 里生成连对或钢板。

extraStructureMoves(hand, previous, levelRank, leading)（search/index.js）只补：

- 连对 pairSeq：恰好 3 对、6 张；
- 钢板 tripleSeq：恰好 2 组三条、6 张。

5 张顺 / 同花顺 / 三带二由 legalMoves 生成，此处不再重复。generateCandidates = legalMoves 合并 extraStructureMoves（按牌 id + 型去重）。

## 策略与硬过滤

policy/filters.js 的 isForbidden 挡住 7 类失误（首轮不炸、四 J 不压三带二、同花顺不压 8/9 单、对方余 2 不拆三条、不砸搭档普通牌、不无故拆连对/钢板；残牌能走则走由 decide 短路）。scoreMove 先硬过滤再线性分 + 启发式。reasonFor 拼中文理由，并按手牌张数附阶段句（开局/中盘/残局/收尾）。

## 浏览器打包与 UI 脚本

app/pack.mjs 把 engine / belief / search / ml / meta / policy / pedagogy / user-model 拼成 app/all.js，挂到浏览器全局 Guandan。无外部 CDN。

浏览器不能直接用 ESM（file://），UI 是普通 script，挂到 GuandanUI。

- app/all.js：规则 + 策略 + 档案 API
- app/hand-layout.js：列布局、统一牌面 class/HTML
- app/table-plays.js：各座位出牌槽与墩面展示
- app/ui-pointer.js：拖列 / 单击选牌 / 双击整列
- app/ui.js：牌桌接线
- app/learn.js：学习中心（仅 learn.html）

pack.mjs 不打包 UI 脚本。改完引擎或策略后重新打包。

## 如何运行

- 打开：浏览器打开 index.html 或 learn.html（file:// 即可）。
- 测试：仓库根目录执行 node --test。
- 打包：node app/pack.mjs。
- 无第三方包：不要安装依赖，无 node_modules，无构建器。
