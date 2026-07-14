#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { refineCandidateStrategies } from "../lib/douyin-candidate-strategy.mjs";
import { publishAfterInputVerification } from "../lib/douyin-candidate-publish.mjs";

const ALLOWED_FLAGS = new Set(["--account", "--video", "--root", "--generated-at"]);

function parseArgs(args) {
  const options = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!ALLOWED_FLAGS.has(flag)) throw new Error(`unknown option: ${flag ?? ""}`);
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    if (options.has(flag)) throw new Error(`${flag} may only be provided once`);
    options.set(flag, value);
  }
  return options;
}

function isWithin(parent, child) {
  const path = relative(parent, child);
  return path === "" || (
    path !== ".." &&
    !path.startsWith(`..\\`) &&
    !path.startsWith("../") &&
    !isAbsolute(path)
  );
}

function requireInside(parent, child, label) {
  if (!isWithin(parent, child)) throw new Error(`${label} must remain inside the account root`);
}

function checkedRealPath(path, accountReal, label) {
  if (!existsSync(path)) throw new Error(`${label} does not exist: ${path}`);
  const actual = realpathSync(path);
  requireInside(accountReal, actual, label);
  return actual;
}

function readJson(path, accountReal, label) {
  return JSON.parse(readFileSync(checkedRealPath(path, accountReal, label), "utf8"));
}

function readJsonl(path, accountReal, label) {
  return readFileSync(checkedRealPath(path, accountReal, label), "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function hashFile(path, accountReal, label) {
  return createHash("sha256")
    .update(readFileSync(checkedRealPath(path, accountReal, label)))
    .digest("hex");
}

function snapshotInputs(paths, accountReal) {
  return Object.fromEntries(Object.entries(paths).map(([label, path]) => [
    label,
    hashFile(path, accountReal, label),
  ]));
}

function escapeMarkdown(value) {
  return String(value).replace(/\|/gu, "\\|").replace(/\r?\n/gu, "<br>");
}

function renderMarkdown(result) {
  const lines = [
    `# Strategy candidates for ${result.videoId}`,
    "",
    `Status: needs-validation`,
    "",
  ];
  for (const candidate of result.candidates) {
    const fields = [
      ["Candidate ID", candidate.id],
      ["Status", candidate.status],
      ["Trigger", candidate.trigger],
      ["Inference", candidate.inference],
      ["Action", candidate.action],
      ["Confidence", `${candidate.confidence.level} (sourceCount ${candidate.confidence.sourceCount})`],
      ["Evidence time", `${candidate.evidence.start}-${candidate.evidence.end}s`],
      ["Exceptions", candidate.exceptions.join("<br>")],
      ["Risks", candidate.risks.join("<br>")],
      ["Given", candidate.testScenario.given],
      ["When", candidate.testScenario.when],
      ["Then", candidate.testScenario.then],
    ];
    lines.push("| Field | Value |", "| --- | --- |");
    for (const [field, value] of fields) lines.push(`| ${field} | ${escapeMarkdown(value)} |`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function prepareOutputDirectory(accountDir, accountReal) {
  const outputDir = join(accountDir, "strategy-candidates");
  if (existsSync(outputDir) && lstatSync(outputDir).isSymbolicLink()) {
    throw new Error("strategy-candidates output directory must not be a symlink");
  }
  mkdirSync(outputDir, { recursive: true });
  const outputReal = realpathSync(outputDir);
  requireInside(accountReal, outputReal, "strategy-candidates output directory");
  return outputDir;
}

function atomicWrite(path, content) {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
    throw new Error(`output must not be a symlink: ${path}`);
  }
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(temporary, content, "utf8");
    renameSync(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

const options = parseArgs(process.argv.slice(2));
const accountId = options.get("--account");
const videoId = options.get("--video");
if (!accountId || !videoId) {
  throw new Error("usage: --account <digits> --video <digits> [--root <project-root>] [--generated-at <ISO>]");
}
if (!/^\d+$/u.test(accountId)) throw new Error("account must contain digits only");
if (!/^\d+$/u.test(videoId)) throw new Error("video must contain digits only");

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const projectRoot = resolve(options.get("--root") ?? defaultRoot);
if (!existsSync(projectRoot)) throw new Error(`project root does not exist: ${projectRoot}`);
const projectReal = realpathSync(projectRoot);
const accountDir = join(projectRoot, "training-samples", "sources", "douyin", accountId);
if (!existsSync(accountDir)) throw new Error(`account directory does not exist: ${accountDir}`);
const accountReal = realpathSync(accountDir);
requireInside(projectReal, accountReal, "account directory");

const generatedAt = options.get("--generated-at") ?? new Date().toISOString();
const generatedDate = new Date(generatedAt);
if (!Number.isFinite(generatedDate.getTime()) || generatedDate.toISOString() !== generatedAt) {
  throw new Error("--generated-at must be a canonical ISO timestamp");
}

const paths = {
  manifest: join(accountDir, "manifest.json"),
  transcript: join(accountDir, "transcripts", `${videoId}.json`),
  knowledge: join(accountDir, "knowledge.jsonl"),
  doctrineCandidates: join(accountDir, "doctrine-candidates.jsonl"),
};
const before = snapshotInputs(paths, accountReal);
const manifest = readJson(paths.manifest, accountReal, "manifest");
if (String(manifest?.source?.accountId ?? "") !== accountId) {
  throw new Error("manifest account identity mismatch");
}
if (!Array.isArray(manifest.videos)) throw new Error("manifest videos must be an array");
const matches = manifest.videos.filter((row) => String(row?.videoId ?? "") === videoId);
if (matches.length !== 1) throw new Error("manifest must contain exactly one matching video row");
const video = matches[0];
const canonicalUrl = `https://www.douyin.com/video/${videoId}`;
if (video.accountId != null && String(video.accountId) !== accountId) {
  throw new Error("manifest video account identity mismatch");
}
if (video.url !== canonicalUrl) throw new Error("manifest video URL must be canonical");
if (video.transcriptPath !== `transcripts/${videoId}.json`) {
  throw new Error("manifest transcriptPath must use the canonical per-video path");
}

const transcript = readJson(paths.transcript, accountReal, "transcript");
const knowledge = readJsonl(paths.knowledge, accountReal, "knowledge");
const reviewPath = join(accountDir, "reviews", `${videoId}.corrections.json`);
const correctionReview = readJson(reviewPath, accountReal, "correction review");
const result = refineCandidateStrategies({
  video: { ...video, accountId, videoId },
  transcript,
  knowledge,
  correctionReview,
  generatedAt,
});

const after = snapshotInputs(paths, accountReal);
const { outputJson, outputMarkdown } = publishAfterInputVerification({
  before,
  after,
  publish() {
    const outputDir = prepareOutputDirectory(accountDir, accountReal);
    const jsonPath = join(outputDir, `${videoId}.json`);
    const markdownPath = join(outputDir, `${videoId}.md`);
    atomicWrite(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
    atomicWrite(markdownPath, renderMarkdown(result));
    return { outputJson: jsonPath, outputMarkdown: markdownPath };
  },
});

console.log(JSON.stringify({
  accountId,
  videoId,
  candidateCount: result.candidates.length,
  outputJson,
  outputMarkdown,
}));
