# 抖音掼蛋知识采集运行手册

## 范围与访问边界

本流程只处理当前登录用户能够正常浏览、正常播放的公开抖音视频。浏览器辅助步骤仅用于读取公开主页作品链接和取得当前可播放的公开媒体，不得导出或持久化 Cookie、登录令牌、浏览器配置、验证码/CAPTCHA 数据、个人资料目录或短期签名媒体 URL。

遇到登录限制、地域限制、作品下架、风控或其他访问限制时，将作品标记为 `blocked`，记录不含敏感 URL 的分类错误；不得绕过访问控制、验证码或平台限制。一个创作者的内容只作为待核查证据，不作为已经成立的策略真理。

## 首次安装

在仓库根目录使用固定 Python 环境和锁定版本依赖：

```powershell
& 'C:\Users\PC\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m venv .venv-douyin
& '.\.venv-douyin\Scripts\python.exe' -m pip install -r tools\douyin\requirements.txt
$env:GUANDAN_DOUYIN_PYTHON=(Resolve-Path '.\.venv-douyin\Scripts\python.exe').Path
npm.cmd run test:douyin
```

依赖版本以 `tools\douyin\requirements.txt` 为准。不要使用未固定版本替换。每个新 PowerShell 会话都需要重新设置 `GUANDAN_DOUYIN_PYTHON`。

## 更新并验证清单

从已登录 Chrome 的目标公开主页读取可见作品并导出临时 UTF-8 JSON；不得在导出中包含 Cookie、token、请求头、浏览器配置或签名媒体 URL。使用 Node importer 读取文件，避免 Windows PowerShell 默认文本解码破坏中文：

```powershell
npm.cmd run data:douyin:manifest -- --account 74480108075 --input "<observed-manifest.json>"
npm.cmd run data:douyin:report -- --account 74480108075
```

本账号当前基线为：声明作品数 325，观察到的唯一公开视频链接 306，`missingFromDeclared` 为 19。差额只在报告中记录，不得伪造 19 条视频记录。清单必须满足：

- 恰好 306 个唯一纯数字 `videoId`；
- 每条 URL 严格为 `https://www.douyin.com/video/<videoId>`，无查询串、片段、签名参数；
- 包含试点视频 `7660454136994975018`；
- 不含 Cookie、token、授权头、验证码数据或临时签名 URL；
- 状态合计等于实际清单总数。

## 小批量处理媒体

只把当前公开且可播放的视频保存到以下临时位置：

```text
.cache\douyin\incoming\<videoId>.mp4
```

不要保存取得媒体时使用的短期签名 URL。默认转写配置为 Whisper `small`、语言 `zh`、设备 `cpu`、计算类型 `int8`。首次试点和后续扩展都采用串行小批量，先以 `--limit 1` 验证，再逐步增加：

```powershell
npm.cmd run data:douyin:run -- --account 74480108075 --media-dir .cache\douyin\incoming --limit 1 --resume --python .\.venv-douyin\Scripts\python.exe
npm.cmd run data:douyin:report -- --account 74480108075
```

成功达到 `extracted` 后删除该视频的临时 MP4、WAV 和已无用途的逐视频缓存目录。失败条目保留恢复所需媒体并记录到 `failures.jsonl`；使用 `--resume` 只继续未完成或可恢复条目，不重复已完成工作。`blocked` 与 `reviewed` 是终态，不自动重试。

如果知识提取规则升级，但已有 transcript 无需重新转写，可对仍处于 `extracted`（尚未人工确认）的条目重新提取：

```powershell
npm.cmd run data:douyin:run -- --account 74480108075 --media-dir .cache\douyin\incoming --limit 1 --resume --reextract --python .\.venv-douyin\Scripts\python.exe
```

`--reextract` 不需要原始媒体，也不会重新调用 Whisper；它会按视频替换旧的 pending 候选，避免重复累计。`reviewed` 条目不会被自动改写。重新提取后必须重新核对证据时间段和候选内容。

## 候选审核、驳回与教义晋升

`knowledge.jsonl` 和 `doctrine-candidates.jsonl` 中的新候选必须保持 `reviewStatus: "pending"`，并核对原视频、规范 URL、时间段、逐字证据、模型和语言元数据。以下候选应驳回：纯营销、关注/点赞引导、空泛口号、重复内容、证据不足、时间范围无效或无法形成可核查主张的内容。

### 人工纠错与候选策略提炼

人工逐段核对原视频和规范 transcript 后，在 `reviews\<videoId>.corrections.json` 写入一个确认 envelope；不得改写 transcript、`knowledge.jsonl` 或 `doctrine-candidates.jsonl`。envelope 结构如下，子纠错从 envelope 继承账号、视频、规范 URL 和确认状态，子项不得覆盖这些身份字段：

```json
{
  "schemaVersion": 1,
  "accountId": "74480108075",
  "videoId": "<videoId>",
  "url": "https://www.douyin.com/video/<videoId>",
  "status": "confirmed",
  "confirmedBy": "user",
  "confirmedAt": "<canonical ISO timestamp>",
  "corrections": [
    {
      "start": 4.16,
      "end": 12.12,
      "correctedText": "<人工核对文本>",
      "interpretation": {
        "key": "<stable-rule-key>",
        "trigger": "<触发条件>",
        "inference": "<保留可能、大概率、弱信号或待验证等不确定措辞>",
        "action": "<可复核行动>",
        "applicability": "<适用局面>",
        "exceptions": ["<例外一>", "<例外二>"],
        "risks": ["<风险一>", "<风险二>"],
        "confidence": "low",
        "testScenario": { "given": "<前提>", "when": "<动作>", "then": "<预期>" }
      }
    }
  ]
}
```

`corrections` 不得为空，同一 envelope 的 `interpretation.key` 必须唯一，`confirmedAt` 必须是规范 ISO 时间。每条解释至少保留具体例外、风险和 given/when/then 场景；现阶段置信度上限为 `medium-low`，`sourceCount` 固定为 1。确认后运行：

```powershell
npm.cmd run data:douyin:refine -- --account 74480108075 --video <videoId>
```

首次运行不传 `--generated-at` 时，工具会把当前时间写入产物的审计时间 `generatedAt`。需要精确回放已有产物时，先读取该 JSON 中现有的 `generatedAt`，再显式传入同一规范 ISO 时间：

```powershell
npm.cmd run data:douyin:refine -- --account 74480108075 --video <videoId> --generated-at <existing-generatedAt>
```

只改变 `generatedAt` 会改变审计时间和产物字节，但不会改变稳定候选 ID；固定相同输入和 `--generated-at` 时，JSON 与 Markdown 必须可字节级重现。

工具按证据起始时间输出稳定的一条纠错对应一条候选：

```text
training-samples\sources\douyin\74480108075\strategy-candidates\<videoId>.json
training-samples\sources\douyin\74480108075\strategy-candidates\<videoId>.md
```

提炼结果必须保持 `status: "needs-validation"`。它只是一座从人工纠错到实验候选的隔离桥，不得自动写入 `strategy/`、正式教义、原 transcript、`knowledge.jsonl`、`doctrine-candidates.jsonl` 或 manifest；进入生产策略仍须遵循下方的独立来源核验、doctrine ticket 和回归门禁。

不得自动编辑 `strategy/`。任何候选晋升为教义前必须完成：

1. 与其他独立来源、现有书籍教义和实战案例交叉核验；
2. 创建 doctrine ticket，说明证据、适用条件、例外与冲突；
3. 添加针对性回归测试和 golden 场景回归；
4. 运行并通过完整门禁：

```powershell
npm.cmd run test:gate
```

## 故障恢复

- `failed`：修复本地依赖、模型或媒体问题后使用 `--resume`；每次进入失败状态会累计重试次数。
- `blocked`：表示访问受限或作品不可访问；不自动重试、不绕过限制。
- Python 缺失：重新执行“首次安装”，设置 `GUANDAN_DOUYIN_PYTHON`，再运行 `npm.cmd run test:douyin`。
- 模型缺失或不可用：检查固定依赖与本地模型缓存；恢复后先跑转写器契约测试，再小批量继续。
- 转写中断：若规范 transcript 已耐久写入，`--resume` 会从 transcript 继续提取；否则保留 MP4/缓存并重新转写。
- 缓存残留：只清理由 `extracted` 或 `reviewed` 成功条目遗留的逐视频缓存；失败条目的媒体必须保留以便恢复。
- 报告或状态异常：先停止处理，验证 manifest 状态合计、唯一 ID 和规范 URL，修复数据后再恢复。

## 审计清单

- [ ] 仅处理公开、正常可访问内容，无访问控制绕过。
- [ ] 临时导出和耐久文件均无 Cookie、token、浏览器资料、CAPTCHA 数据或签名 URL。
- [ ] source/manifest 账号为 `74480108075`，来源日期与采集方式明确。
- [ ] declared 325、observed 306、missing 19，未伪造缺失视频。
- [ ] 306 个 ID 唯一且均为数字，所有视频 URL 规范且无查询串。
- [ ] 试点 `7660454136994975018` 存在。
- [ ] 状态合计与 manifest 视频数一致。
- [ ] 所有候选保持 pending，`sourceCount` 不虚增。
- [ ] 成功媒体已清理，失败媒体按恢复要求保留。
- [ ] 晋升前已完成交叉核验、doctrine ticket、focused/golden 回归和完整 gate。

## 耐久路径

```text
training-samples\sources\douyin\74480108075\source.json
training-samples\sources\douyin\74480108075\manifest.json
training-samples\sources\douyin\74480108075\transcripts\<videoId>.json
training-samples\sources\douyin\74480108075\knowledge.jsonl
training-samples\sources\douyin\74480108075\doctrine-candidates.jsonl
training-samples\sources\douyin\74480108075\reviews\<videoId>.corrections.json
training-samples\sources\douyin\74480108075\strategy-candidates\<videoId>.json
training-samples\sources\douyin\74480108075\strategy-candidates\<videoId>.md
training-samples\sources\douyin\74480108075\failures.jsonl
training-samples\sources\douyin\74480108075\reports\latest.json
training-samples\sources\douyin\74480108075\reports\latest.md
```

原始 MP4、WAV、`.venv-douyin` 与模型缓存均是本地临时资产，不得提交到版本库。
