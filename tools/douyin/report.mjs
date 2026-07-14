#!/usr/bin/env node
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { atomicWriteJson } from "../lib/douyin-manifest.mjs";

const STATES = [
  "discovered",
  "downloaded",
  "transcribed",
  "extracted",
  "reviewed",
  "blocked",
  "failed",
];

function optionValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

export function buildReport(manifest, generatedAt = new Date().toISOString()) {
  const declared = Number(manifest?.source?.declaredWorkCount ?? 0);
  const observed = Array.isArray(manifest?.videos) ? manifest.videos.length : 0;
  const report = {
    schemaVersion: 1,
    generatedAt,
    accountId: String(manifest?.source?.accountId ?? ""),
    source: {
      platform: manifest?.source?.platform ?? null,
      displayName: manifest?.source?.displayName ?? null,
      profileUrl: manifest?.source?.profileUrl ?? null,
      capturedAt: manifest?.source?.capturedAt ?? null,
    },
    declared: Number.isFinite(declared) ? declared : 0,
    observed,
    missingFromDeclared: Math.max(0, (Number.isFinite(declared) ? declared : 0) - observed),
  };
  for (const state of STATES) report[state] = 0;
  for (const row of manifest?.videos ?? []) {
    if (!STATES.includes(row.status)) throw new Error(`unknown manifest state: ${row.status}`);
    report[row.status] += 1;
  }
  report.totalStates = STATES.reduce((total, state) => total + report[state], 0);
  return report;
}

function atomicWriteText(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(temporary, text, "utf8");
    renameSync(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const accountId = optionValue(process.argv.slice(2), "--account");
  const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const root = resolve(optionValue(process.argv.slice(2), "--root", defaultRoot) ?? "");
  if (!accountId) throw new Error("usage: --account <id> [--root <project-root>]");
  if (!/^\d+$/u.test(accountId)) throw new Error("account must contain digits only");
  const accountDir = join(root, "training-samples", "sources", "douyin", accountId);
  const manifest = JSON.parse(readFileSync(join(accountDir, "manifest.json"), "utf8"));
  if (String(manifest?.source?.accountId ?? "") !== accountId) {
    throw new Error("manifest account does not match --account");
  }
  const report = buildReport(manifest);
  const reportDir = join(accountDir, "reports");
  atomicWriteJson(join(reportDir, "latest.json"), report);
  const markdown = [
    "# 抖音知识采集报告",
    "",
    `- 生成时间: ${report.generatedAt}`,
    `- 账号: ${report.accountId}`,
    `- 声明作品数: ${report.declared}`,
    `- 实际清单数: ${report.observed}`,
    `- 声明但未观察到: ${report.missingFromDeclared}`,
    "",
    "## 状态统计",
    "",
    ...STATES.map((state) => `- ${state}: ${report[state]}`),
    `- total: ${report.totalStates}`,
    "",
  ].join("\n");
  atomicWriteText(join(reportDir, "latest.md"), markdown);
  console.log(JSON.stringify(report));
}
