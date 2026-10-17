# 测试夹具

## `active-session-yongge-single-j.json`（可选）

`tests/doctrine-regression.mjs` 中「须压单J-同花顺组内逢人配…」场景若存在此文件则运行，否则 **跳过**（不影响 `npm test`）。

从实机导出：保存含该局面的存档后，将 `state` 字段写入 JSON：

```json
{ "state": { "...": "与 session-persist 相同结构" } }
```

不要提交用户真实存档到公开仓库；CI 不依赖此文件。

## `ml-rows-sample.jsonl`

`tests/ml-integration-smoke.mjs` 在缺少 gitignore 的 `datasets/v1/rows.jsonl` 时使用本夹具（≥100 行训练样本）。
