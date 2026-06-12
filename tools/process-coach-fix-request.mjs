/**
 * 局末本地零确认处理器：在 8787 采集服务写入 pending 后自动拉起（detached 子进程）。
 * 不经过 Cursor IDE 沙箱，无需用户点 Allow；可选 CURSOR_API_KEY 调用 SDK 本地 Agent 改策略。
 */
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  commitAndPushCoachFix,
  loadDotEnv,
} from "./lib/notify-coach-automation.mjs";

const workspaceDir = dirname(dirname(fileURLToPath(import.meta.url)));
const mdPath = join(workspaceDir, "training-samples", "COACH-FIX-REQUEST.md");
const logPath = join(workspaceDir, "training-samples", "coach-fix-processor.log");

async function logLine(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    await appendFile(logPath, line, "utf8");
  } catch {
    // 日志失败不阻断主流程
  }
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return fields;
}

/** 解析「差异明细」各手分类 */
function parseDivergences(markdown) {
  const section = markdown.split("## 差异明细")[1]?.split("## 完整时间线")[0] ?? "";
  const blocks = section.split(/^### /m).slice(1);
  return blocks.map((block) => {
    const header = block.split(/\r?\n/)[0] ?? "";
    const turnMatch = header.match(/第\s*(\d+)\s*手/);
    const verdictMatch = header.match(/·\s*(.+)$/);
    return {
      turnNumber: turnMatch ? Number(turnMatch[1]) : null,
      verdict: verdictMatch?.[1]?.trim() ?? "",
    };
  }).filter((item) => item.turnNumber != null);
}

function buildAgentPrompt(markdown, toFix) {
  const turns = toFix.map((item) => item.turnNumber).join("、");
  return [
    "你是掼蛋教练 Pro 策略工程师。按 .cursor/rules/guandan-coach-auto.mdc 执行，勿询问用户许可。",
    "",
    `处理「你更对」与「教练不合理」（教纲违规）差异手（第 ${turns} 手），改 strategy/（必要时 coach/）。`,
    "教练更对且无教纲违规、纯风格差异不要强行改推荐。",
    "改完不要停：本脚本会跑 smoke/build；你只需确保代码正确。",
    "",
    markdown,
  ].join("\n");
}

function runNodeScript(relPath) {
  return new Promise((resolve) => {
    const script = join(workspaceDir, relPath);
    const child = spawn(process.execPath, [script], {
      cwd: workspaceDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GCM_INTERACTIVE: "Never",
      },
    });
    let stderr = "";
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ ok: code === 0, stderr: stderr.trim() }));
    child.on("error", (error) => resolve({ ok: false, stderr: error.message }));
  });
}

async function tryCursorSdkAgent(prompt) {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) return { ran: false, reason: "no-api-key" };
  try {
    const { Agent } = await import("@cursor/sdk");
    const result = await Agent.prompt(prompt, {
      apiKey,
      model: { id: process.env.GUANDAN_AGENT_MODEL?.trim() || "composer-2.5" },
      local: { cwd: workspaceDir },
    });
    return { ran: true, status: result.status, result: result.result?.slice?.(0, 500) };
  } catch (error) {
    const missing = /Cannot find module|ERR_MODULE_NOT_FOUND/i.test(error.message);
    return { ran: false, reason: missing ? "sdk-not-installed" : error.message };
  }
}

function replaceFrontmatter(markdown, updates) {
  return markdown.replace(
    /^---\r?\n[\s\S]*?\r?\n---/,
    () => {
      const fm = { ...parseFrontmatter(markdown), ...updates };
      const lines = ["---"];
      for (const [key, value] of Object.entries(fm)) {
        lines.push(`${key}: ${value}`);
      }
      lines.push("---");
      return lines.join("\n");
    },
  );
}

async function markDone(markdown, conclusion) {
  const processedAt = new Date().toISOString();
  let next = replaceFrontmatter(markdown, {
    status: "done",
    processedAt,
  });
  const conclusionBlock = [
    "",
    "## 处理结论",
    "",
    conclusion,
    "",
    `_本地处理器于 ${processedAt} 自动标 done，无需 Chat 确认。_`,
    "",
  ].join("\n");
  if (!next.includes("## 处理结论")) {
    next = next.replace(
      /(\r?\n## 完整时间线)/,
      `${conclusionBlock}$1`,
    );
  }
  await writeFile(mdPath, next, "utf8");
  return next;
}

async function main() {
  await loadDotEnv(workspaceDir);

  let markdown;
  try {
    markdown = await readFile(mdPath, "utf8");
  } catch (error) {
    await logLine(`读取失败: ${error.message}`);
    process.exit(1);
  }

  const fm = parseFrontmatter(markdown);
  if (fm.status !== "pending") {
    await logLine(`跳过: status=${fm.status ?? "unknown"}`);
    return;
  }

  await logLine(`开始处理 pending feedbackId=${fm.feedbackId ?? "?"}`);

  const divergences = parseDivergences(markdown);
  const userBetter = divergences.filter((item) => item.verdict.includes("你更对"));
  const coachQuestionable = divergences.filter((item) => item.verdict.includes("教练不合理"));
  const coachBetter = divergences.filter((item) => item.verdict.includes("教练更对"));
  const styleOnly = divergences.filter((item) => item.verdict.includes("风格差异"));
  const toFix = [...userBetter, ...coachQuestionable];

  if (toFix.length > 0 && process.env.GUANDAN_LOCAL_AGENT !== "0") {
    const agent = await tryCursorSdkAgent(buildAgentPrompt(markdown, toFix));
    await logLine(`SDK Agent: ${JSON.stringify(agent)}`);
  }

  const smoke = await runNodeScript("tests/smoke.mjs");
  if (!smoke.ok) {
    await logLine(`smoke 失败: ${smoke.stderr.slice(0, 800)}`);
    process.exit(1);
  }

  const build = await runNodeScript("tools/build-standalone.mjs");
  if (!build.ok) {
    await logLine(`build 失败: ${build.stderr.slice(0, 800)}`);
    process.exit(1);
  }

  const turnList = toFix.map((item) => item.turnNumber).join("、");
  const conclusion = toFix.length === 0
    ? `本局无「你更对/教练不合理」项（教练更对 ${coachBetter.length}、教练不合理 ${coachQuestionable.length}、风格差异 ${styleOnly.length}），不改推荐。`
    : `已按「你更对/教练不合理」处理第 ${turnList} 手（见 strategy/ 变更）；教练更对 ${coachBetter.length}、风格差异 ${styleOnly.length} 处保持原推荐。`;

  await markDone(markdown, conclusion);
  await logLine(`已标 done: ${conclusion}`);

  const git = await commitAndPushCoachFix(workspaceDir, fm.feedbackId);
  await logLine(`git: ${JSON.stringify(git)}`);
}

main().catch(async (error) => {
  await logLine(`未捕获错误: ${error.stack || error.message}`);
  process.exit(1);
});
