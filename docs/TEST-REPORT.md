# 测试报告

在仓库根目录执行 node --test（package.json 的 test 脚本同此）。无第三方测试框架。当前 node --test 为 359 通过。覆盖如下（test 目录下各 .test.js）。

## 引擎

- test/cards.test.js：牌面构造、两副 108、解析/格式化。
- test/compare.test.js：牌型识别；5 炸 < 同花顺 < 6 炸；同型比大小。
- test/more-combos.test.js：更多牌型边角（连对/钢板/四王等）。
- test/wild.test.js：逢人配仅红桃级牌；其余花色级牌/王不是配；配上限 2。
- test/legal.test.js：领出不能过、跟牌可过、须压过、炸可压、legalMoves 含三带二与恰好 5 张顺/同花顺。
- test/tribute.test.js：进贡方向、双下 0 贡、官方双下双贡、抗贡、还贡合法牌、applyTributes 指定/非法回退、previewTributes。
- test/state.test.js：轮次出牌、宿迁过 A（双下胜 / 未双下回 2 头游吃贡 / 失败回 2）、官方过 A 不必双下。
- test/ruleset-diff.test.js：宿迁 vs 官方：过 A、过 A 失败、过 A 之后三处差；双下不进贡 vs 双贡。

## 策略与外围

- test/policy.test.js：硬过滤 1–7：首轮不炸、四 J 不压三带二、同花顺不压 8/9、对方 2 张不拆三、不砸搭档顺/对 7、不无故拆钢板、残牌能走则走；返回中文理由。
- test/search.test.js：候选领出无过、跟牌可过、束搜索只含合法、启发式/rollout 有限。
- test/belief.test.js：余牌按点/花色、关键牌、对手余张、风格先验与更新。
- test/ml.test.js：线性特征、浪费炸弹特征、打分与微调（非神经网络）。
- test/pedagogy.test.js：六维加权、称号、错误分类、回放、用户档案存储。
- test/meta.test.js：phaseOf（开局/中盘/残局/收尾阈值）、styleLabel。
- test/human-fixtures.test.js：人手风格整局夹具（自对弈走完、不乱炸）。
- test/perf.test.js：典型手牌 decide 平均耗时上限（冒烟，非性能承诺）。

改规则或硬过滤后必须全绿。浏览器 UI 无自动化，需按 CHANGELOG 建议回归：拖列、点选出牌、进贡弹层（还贡点选）、提示。
