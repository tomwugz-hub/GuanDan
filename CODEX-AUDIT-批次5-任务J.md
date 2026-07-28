# CODEX 任务 J · 批次5审计：《掼蛋实战100例》例 28～32

- **项目：** 掼蛋教练 Pro
- **模式：** 只读复验（**不改** `strategy/`、不改 JSON 定稿）
- **Cursor 已做：** commit `d26d1f4`（P4 三带二宜过牌 + perf 审计 + 机器人 P12）；例 28 Top1 快路径初修待 Codex 交叉验证

## 命令（按序跑）

```bash
# 1. 页码 / PNG / JSON 手牌 27 张 / v1-final
node tools/audit-case-json.mjs case-028 case-029 case-030 case-031 case-032

# 2. 书摘边界（例28 止于「炸弹越大越好」讲义前；例32 止于助攻单3，勿滑入同花顺泛论）
node tests/hand-labeler-excerpt.mjs

# 3. 场景 Top1（quick + full，各 <5s）
node tests/case-scenario-top1-28-32.mjs

# 4. 回归
node tests/case-scenario-top1-23-27.mjs
node tests/smoke.mjs
```

## 期望输出

Markdown 报告 `CODEX-AUDIT-批次5.md`，含：

| 例号 | PDF页 | 级牌 | 场景 | 期望 Top1 | 教纲 | Cursor 探测 |
|---:|---:|---|---|---|---|---|
| 28 | 57 | 2 | follow 对3 | **Pair/5** | C100-B1 | ~~Pair/4~~ → 已修待验 |
| 29 | 58 | J | follow 555666 | **Plane/10** | C100-M1 | Pass（FAIL） |
| 30 | 59 | 6 | follow A2345 | **SF/8** | C100-M1 | SF/8（PASS） |
| 31 | 60 | Q | follow A2345 | **SF/10** | C100-G1 | SF/K（FAIL） |
| 32 | 61 | 6 | open 助攻 | **Single/3** | C100-G1 | Pair/3（FAIL） |

## 约束

- 只读；差异写入报告，不改码
- 例 29/31/32 失败根因须区分：书摘/JSON/scenario 标错 vs 教练策略缺口
- 页脚 rev 与 `tools/build-standalone.mjs` stamp 一致

## 路径

- JSON：`training-samples/cases/case-028.json` … `case-032.json`
- 场景：`training-samples/cases/case-scenarios-1-50.json`
- 页图：`assets/guandan-100cases/case-0XX-*.png`
- 书摘：`training-samples/掼蛋实战100例-cleaned.txt` + `tools/lib/case-excerpt.mjs`
