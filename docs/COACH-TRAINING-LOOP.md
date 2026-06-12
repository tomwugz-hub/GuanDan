# 复盘 → 策略升级闭环

## 自动（只管打牌）

1. 每手自动对比「推荐 Top1」与你的实际出牌
2. 局末自动保存复盘 → `training-samples/coach-questions-latest.json`
3. 写入待改任务 → `training-samples/COACH-FIX-REQUEST.md`（`status: pending`）

需用「点我启动掼蛋教练Pro.cmd」（会拉起 8787 采集服务）。

## 零操作升级（Cursor Automation，推荐）

Cursor **Automations** 无法监听本机文件变化，因此采用 **Webhook 即时触发 + 每 5 分钟定时兜底**：

| 环节 | 说明 |
|------|------|
| 局末 | 应用写入 `COACH-FIX-REQUEST.md`（pending） |
| 即时 | 8787 采集服务 POST 到 Automation Webhook（载荷含完整 markdown） |
| 兜底 | 每 5 分钟 cron 检查仓库内 pending（需可选 git push，见下） |
| 云端 | Agent 读 pending → 仅「你更对」时改 `strategy/` → smoke + build → 标 done → push |
| 本地 | `git pull` 后游戏页 **Ctrl+F5** 刷新 |

### 一次性配置（约 5 分钟）

1. **打开 Automations 编辑器**  
   Cursor → **Automations** → 新建。可用仓库内预填草稿：`.cursor/automations/coach-fix-loop.prefill.json`（或让 Agent 用 `open_automation` 打开）。

2. **绑定 Git 仓库**  
   在编辑器里选择本项目的 **GitHub/GitLab 仓库** 与默认分支（Cloud Agent 在此 checkout 改代码）。

3. **确认触发器**（预填已含）  
   - **Webhook**：保存后复制 Webhook URL  
   - **Schedule**：`*/5 * * * *`（每 5 分钟）

4. **配置本机 `.env`**（复制 `.env.example`）  
   ```env
   CURSOR_AUTOMATION_WEBHOOK_URL=<步骤 3 的 Webhook URL>
   # 可选：让 cron 也能看到 pending（云端需能 pull 到最新文件）
   GUANDAN_AUTO_GIT_PUSH=1
   ```
   重启「点我启动掼蛋教练Pro.cmd」使 8787 服务加载 `.env`。

5. **启用 Cloud Agent**  
   [cursor.com/dashboard → Cloud Agents](https://cursor.com/dashboard?tab=cloud-agents) 确保有余额/权限。

6. **验证**  
   打完一局 → Automations → **Runs** 应出现新运行；完成后本地 `git pull` + Ctrl+F5。

### 启用后你需要做什么

**理想状态：只管打牌。** 局末自动 webhook；策略改完云端 push 后，本地偶尔 `git pull` + 刷新即可（若开了 `GUANDAN_AUTO_GIT_PUSH=1`，pull 频率可更低）。

## 半自动（无 Automation 时）

4. **下次在 Cursor 随便发一句话** → Agent 规则（`.cursor/rules/guandan-coach-auto.mdc`）自动读 pending、改 `strategy/`、跑测试、标 `done`
5. 游戏页 **Ctrl+F5** 刷新 → 新推荐生效

**不配置 Automation 且不打开 Cursor 对话，策略代码不会变。** 复盘数据会归档，但左侧推荐不会升级。

## 你只需做什么

| 目标 | 操作 |
|------|------|
| 零操作（推荐） | 一次性配好 Automation + `.env` → 只管打牌 → 偶尔 `git pull` + Ctrl+F5 |
| 最低限度 | 只管打牌 + 偶尔开 Cursor 发任意消息 |
| 无 Git 远程 | 只能用「半自动」Chat 规则；Automation 需远程仓库 |

## 相关文件

- `training-samples/COACH-FIX-REQUEST.md` — 当前待改任务
- `.cursor/rules/guandan-coach-auto.mdc` — Agent 自动处理规则
- `.cursor/automations/coach-fix-loop.prefill.json` — Automation 预填草稿
- `tools/lib/notify-coach-automation.mjs` — 局末 webhook / 可选 git push
- `.env.example` — Webhook URL 等环境变量模板
- `tools/ingest-game-review.mjs` — 复盘入库为黄金场景教训（手动/CI，不改策略代码）
