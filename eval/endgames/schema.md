# Endgame eval case schema

每行一个 JSON 对象（JSONL）。牌字面量与 `engine/cards.js` / `test/human-fixtures.test.js` 一致：`AS`、`KH`、`10D`、`RJ`、`BJ`；花色 `S|H|D|C`。

## 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 如 `eg001` |
| `tags` | string[] | 如 `endgame`, `bomb-or-pass`, `partner-protect` |
| `levelRank` | string | 级牌，默认 `"2"` |
| `seat` | 0..3 | 决策座位 |
| `leading` | boolean | 是否领出 |
| `hands` | `{ "0": string[], ... }` | 四座手牌（可短，残局不必凑满 27） |
| `previous` | null \| object | 跟牌目标：`{ type, rank?, cards: string[] }`；领出为 `null` |
| `gold` | object | 人工标金：见下 |

## `gold`

```json
{
  "action": "play" | "pass",
  "comboType": "single" | "pair" | "triple" | "fullhouse" | "straight" | "pairSeq" | "tripleSeq" | "bomb" | "straightFlush" | "pass",
  "ranks": ["5"],
  "rationale": "中文一句"
}
```

- `pass` 时 `comboType` 应为 `"pass"`，`ranks` 可空数组。
- `ranks`：期望牌型主点数（炸弹/同花顺写主 rank；顺子可写起点或全部）。
- 匹配容忍：`action` + `comboType`；若提供 `ranks` 则主 rank 命中即可（炸弹比 size 可选）。

## 可选字段

| 字段 | 说明 |
|------|------|
| `persona` | `{ name, style, brief }` 传给 Jev |
| `trickMeta` | `{ lastPlayer, controlSeat, partnerLastPlay? }` |
| `candidatesHint` | 提示性候选（不强制） |
| `candidates` | 预计算候选 `[{ key, label, cards, combo }]`；有 `hands` 时 runner 仍优先用 `decide` 生成 |
| `expectJevMayDiffer` | `true` 时表示故意让 decide 可能与 gold 分歧 |
| `notes` | 自由备注 |
| `firstLeadOfDeal` | 默认 `false`（残局） |

## 设计意图

强调**灵活判断**：护搭档、忌早炸、追 vs 留、残局出走、中单是否炸、过牌给搭档等。至少约 20 例可直接跑 `decide`（完整 `hands` + 合法 `previous`）。
