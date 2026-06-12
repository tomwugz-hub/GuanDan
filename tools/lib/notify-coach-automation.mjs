import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";

/** 非交互 git：禁止终端弹窗索要凭据 */
const GIT_ENV = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GCM_INTERACTIVE: "Never",
};

/** 读取项目根目录 .env（不覆盖已有环境变量） */
export async function loadDotEnv(workspaceDir) {
  try {
    const text = await readFile(join(workspaceDir, ".env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // 无 .env 时跳过
  }
}

function runGit(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: GIT_ENV,
    });
    let stderr = "";
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ ok: code === 0, stderr: stderr.trim() }));
    child.on("error", (error) => resolve({ ok: false, stderr: error.message }));
  });
}

/**
 * 局末写入 pending 后，后台拉起本地处理器（detached，不经 IDE 沙箱，无需 Allow）。
 * 设 GUANDAN_LOCAL_PROCESSOR=0 可关闭。
 */
export function spawnLocalCoachFixProcessor(workspaceDir) {
  if (process.env.GUANDAN_LOCAL_PROCESSOR === "0") {
    return { spawned: false, reason: "local-processor-disabled" };
  }

  const script = join(workspaceDir, "tools", "process-coach-fix-request.mjs");
  const child = spawn(process.execPath, [script], {
    cwd: workspaceDir,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GCM_INTERACTIVE: "Never",
    },
  });
  child.unref();
  return { spawned: true };
}

/**
 * 可选：将 pending 的 COACH-FIX-REQUEST 提交并推送，供云端 Automation（cron / git push）读取。
 * 需设置 GUANDAN_AUTO_GIT_PUSH=1，且本机 git 已配置 remote。
 */
export async function maybePushCoachFixRequest(workspaceDir, mdPath, feedbackId) {
  if (process.env.GUANDAN_AUTO_GIT_PUSH !== "1") {
    return { pushed: false, reason: "auto-git-push-disabled" };
  }

  const relPath = mdPath.startsWith(workspaceDir)
    ? mdPath.slice(workspaceDir.length).replace(/^[/\\]/, "")
    : "training-samples/COACH-FIX-REQUEST.md";

  const add = await runGit(["add", relPath], workspaceDir);
  if (!add.ok) return { pushed: false, reason: "git-add-failed", detail: add.stderr };

  const message = `chore(coach): pending fix request ${feedbackId ?? "unknown"}`;
  const commit = await runGit(["commit", "-m", message], workspaceDir);
  if (!commit.ok && !/nothing to commit|no changes added/i.test(commit.stderr)) {
    return { pushed: false, reason: "git-commit-failed", detail: commit.stderr };
  }

  // 始终推送到 main，避免 Automation 在 cursor/* 分支上留下 pending 分叉
  const push = await runGit(["push", "origin", "HEAD:main"], workspaceDir);
  if (!push.ok) return { pushed: false, reason: "git-push-failed", detail: push.stderr };

  return { pushed: true, branch: "main" };
}

/**
 * 本地处理器标 done 后：提交策略改动 + standalone 构建 + COACH-FIX-REQUEST。
 */
export async function commitAndPushCoachFix(workspaceDir, feedbackId) {
  if (process.env.GUANDAN_AUTO_GIT_PUSH !== "1") {
    return { pushed: false, reason: "auto-git-push-disabled" };
  }

  const paths = [
    "strategy/",
    "coach/",
    "training-samples/COACH-FIX-REQUEST.md",
    "guandan-coach-standalone.html",
  ];
  const add = await runGit(["add", ...paths], workspaceDir);
  if (!add.ok) return { pushed: false, reason: "git-add-failed", detail: add.stderr };

  const message = `fix(coach): process fix request ${feedbackId ?? "unknown"}`;
  const commit = await runGit(["commit", "-m", message], workspaceDir);
  if (!commit.ok && !/nothing to commit|no changes added/i.test(commit.stderr)) {
    return { pushed: false, reason: "git-commit-failed", detail: commit.stderr };
  }

  const push = await runGit(["push", "origin", "HEAD:main"], workspaceDir);
  if (!push.ok) return { pushed: false, reason: "git-push-failed", detail: push.stderr };

  return { pushed: true, branch: "main" };
}

/**
 * 局末写入 pending 后，POST 到 Cursor Automation Webhook（即时触发云端 Agent）。
 * 需在 Automations 保存后把 Webhook URL 写入 .env 的 CURSOR_AUTOMATION_WEBHOOK_URL。
 */
export async function notifyCoachAutomationWebhook({ mdPath, feedbackId, kind }) {
  const webhookUrl = process.env.CURSOR_AUTOMATION_WEBHOOK_URL?.trim();
  if (!webhookUrl) return { notified: false, reason: "no-webhook-url" };

  const markdown = await readFile(mdPath, "utf8");
  if (!/^status:\s*pending/m.test(markdown)) {
    return { notified: false, reason: "not-pending" };
  }

  const headers = { "Content-Type": "application/json" };
  const secret = process.env.CURSOR_AUTOMATION_WEBHOOK_SECRET?.trim();
  if (secret) headers.Authorization = `Bearer ${secret}`;

  const body = JSON.stringify({
    event: "coach-fix-pending",
    feedbackId: feedbackId ?? null,
    kind: kind ?? null,
    fixRequestPath: "training-samples/COACH-FIX-REQUEST.md",
    fixRequestMarkdown: markdown,
    triggeredAt: new Date().toISOString(),
  });

  try {
    const response = await fetch(webhookUrl, { method: "POST", headers, body });
    return {
      notified: response.ok,
      status: response.status,
      reason: response.ok ? "ok" : "webhook-http-error",
    };
  } catch (error) {
    return { notified: false, reason: "webhook-fetch-failed", detail: error.message };
  }
}

/** 写入 pending 后统一通知：本地处理器 + webhook + 可选 git push */
export async function afterCoachFixRequestPending({ trainingDir, mdPath, feedbackId, kind }) {
  const workspaceDir = dirname(dirname(trainingDir));
  await loadDotEnv(workspaceDir);

  const local = spawnLocalCoachFixProcessor(workspaceDir);
  const webhook = await notifyCoachAutomationWebhook({ mdPath, feedbackId, kind });
  const git = await maybePushCoachFixRequest(workspaceDir, mdPath, feedbackId);

  return { local, webhook, git };
}
