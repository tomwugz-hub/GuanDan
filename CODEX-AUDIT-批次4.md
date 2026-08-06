# CODEX AUDIT 批次4：《掼蛋实战100例》例 23～27

- 项目：掼蛋教练 Pro
- 审计日期：2026-07-16
- 审计范围：例 23～27 的页码/页图文件、书摘边界、手牌 JSON、级牌、场景候选与教练 Top1
- 策略版本：rev 15（`COACH_STRATEGY_REVISION=15`、`REQUIRED_STRATEGY_REVISION=15`）
- 协作约束：Codex 只读复验；Cursor 已落盘修复

## 1. 摘要

| 审计项 | 通过 | 待修 | 结论 |
|---|---:|---:|---|
| PDF 页码与页图文件 | 5/5 | 0 | PDF 48/50/52/54/56 与 `case-page-map.json` 一致，PNG 存在 |
| 手牌、确认状态与级牌 | 5/5 | 0 | 均为 27 张、`v1-final`，JSON/场景级牌一致 |
| 书摘边界与 JSON 摘要 | 5/5 | 0 | 例 23～27 无越界；例 26 跨页续写已处理；`narrative.summary` 对齐 |
| 场景候选 | 5/5 | 0 | 每例 `prefer`/`over` 候选存在；例 26 为 structure 不测 Top1 |
| 教练 Top1 | 4/4 | 0 | 例 23/24/25/27 quick+full 命中；例 26 跳过 |

**Cursor 自测结论：批次 4 数据、书摘、场景与 rev 15 Top1 全部通过，待用户页脚 rev 15 目视确认后正式关门。**

## 2. 页码与 JSON 清单

| 例号 | PDF 页 | 级牌 | 场景类型 | 期望 Top1 | 教纲 |
|---:|---:|---|---|---|---|
| 23 | 48 | A | open | 445566（CP/4） | C100-O1 |
| 24 | 50 | 9 | open | 445566（CP/6） | C100-G1 |
| 25 | 52 | 8 | follow | 556677（CP/7） | C100-M1 |
| 26 | 54 | 2 | structure | — | C72 |
| 27 | 56 | 3 | follow | KKK22（TWP/K） | C100-M1 |

## 3. 书摘边界（rev 15 修复）

| 例号 | 截断点 | 备注 |
|---:|---|---|
| 23 | 「对付三不带」前 | 去除三不带配合泛论 |
| 24 | 「牌型多元化了。」 | 去除小三连对讲义 |
| 25 | 「打好信息战」前 | 去除第二讲结语 |
| 26 | 「单牌 JJ、2。」 | 跨 `## 第55页` 续写；过滤页脚 OCR |
| 27 | 「牌力骏」前 | 去除弱牌保留炸弹泛论 |

## 4. 策略修复（rev 15）

- `pickC100OpeningLead`：例 23 弱牌首出 CP/4；例 24 进贡后首出 CP/6
- `pickC100MustBeatTripleWithPairBeater`：例 27 末家 KKK22 管 77722
- `cases100Adjustment`：例 23 弱牌连对评分；例 27 末家三带二评分
- lite 三带二预计算路径优先 C100 快路径（避免 Q 三带二误推）

## 5. 测试

```text
node tests/hand-labeler-excerpt.mjs          # 例 1～27 PASS
node tests/case-scenario-top1-23-27.mjs      # 例 23/24/25/27 quick+full PASS
node tests/case-scenario-top1-18-22.mjs      # 批次 3 回归 PASS
node tests/smoke.mjs                         # PASS
node tools/build-standalone.mjs              # PASS
```

## 6. 页脚确认

请 **Ctrl+F5** 刷新游戏页，确认页脚显示 **策略 build … · rev 15**。
