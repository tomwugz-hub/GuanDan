#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { atomicWriteJson } from "../lib/douyin-manifest.mjs";
import { extractCandidates } from "../lib/douyin-knowledge.mjs";
import {
  cachePaths,
  cleanupSuccessfulMedia,
  transitionVideo,
} from "../lib/douyin-state.mjs";

const TERMINAL = new Set(["extracted", "reviewed", "blocked"]);

function optionValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

function atomicWriteJsonl(path, rows) {
  mkdirSync(dirname(path), { recursive: true });
  const unique = [...new Map(rows.map((row) => [row.id, row])).values()];
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(temporary, unique.length ? `${unique.map(JSON.stringify).join("\n")}\n` : "", "utf8");
    renameSync(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function sanitize(error) {
  return String(error?.stderr || error?.message || error)
    .replace(/https?:\/\/[^\s"'<>]+/giu, "[url-redacted]")
    .slice(0, 500);
}

function validateTranscript(value) {
  if (
    value?.schemaVersion !== 1 ||
    typeof value?.model !== "object" ||
    value.model === null ||
    typeof value.model.name !== "string" ||
    typeof value.language !== "string" ||
    !Number.isFinite(value.durationSeconds) ||
    value.durationSeconds < 0 ||
    !Array.isArray(value.segments)
  ) {
    throw new Error("generated transcript has an invalid schema");
  }

  let previousStart = -1;
  for (const segment of value.segments) {
    if (
      !Number.isFinite(segment?.start) ||
      !Number.isFinite(segment?.end) ||
      segment.start < 0 ||
      segment.end < segment.start ||
      segment.start < previousStart ||
      typeof segment.text !== "string" ||
      !segment.text.trim() ||
      (segment.avgLogProb != null && !Number.isFinite(segment.avgLogProb))
    ) {
      throw new Error("generated transcript contains invalid segments");
    }
    previousStart = segment.start;
  }
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function failureId(videoId, category, message) {
  return createHash("sha256")
    .update(`${videoId}\0${category}\0${message}`)
    .digest("hex")
    .slice(0, 20);
}

const args = process.argv.slice(2);
const accountId = optionValue(args, "--account");
const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const projectRoot = resolve(optionValue(args, "--root", defaultRoot) ?? "");
const mediaDirValue = optionValue(args, "--media-dir");
const limitValue = optionValue(args, "--limit", "1");
const limit = Number(limitValue);
const resume = args.includes("--resume");
const python = optionValue(args, "--python", process.env.GUANDAN_DOUYIN_PYTHON);
const transcriber = resolve(
  optionValue(args, "--transcriber", join(dirname(fileURLToPath(import.meta.url)), "transcribe.py")) ?? "",
);
const model = optionValue(args, "--model", "small");
const device = optionValue(args, "--device", "cpu");
const computeType = optionValue(args, "--compute-type", "int8");

if (!accountId || !mediaDirValue) {
  throw new Error("usage: --account <id> --media-dir <dir> [--limit N] [--resume]");
}
if (!/^\d+$/u.test(accountId)) throw new Error("account must contain digits only");
if (!Number.isInteger(limit) || limit <= 0) {
  throw new Error("--limit must be a positive integer");
}
if (!model || !device || !computeType) {
  throw new Error("--model, --device, and --compute-type require values");
}

const mediaDir = resolve(mediaDirValue);
if (!existsSync(mediaDir) || !statSync(mediaDir).isDirectory()) {
  throw new Error(`media directory does not exist: ${mediaDir}`);
}
if (!existsSync(transcriber) || !statSync(transcriber).isFile()) {
  throw new Error(`transcriber does not exist: ${transcriber}`);
}
const realTranscriber = extname(transcriber).toLowerCase() === ".py";
if (realTranscriber && !python) {
  throw new Error("Python is required: use --python or GUANDAN_DOUYIN_PYTHON");
}
if (realTranscriber && isAbsolute(python) && !existsSync(python)) {
  throw new Error(`Python executable does not exist: ${python}`);
}

const accountDir = join(projectRoot, "training-samples", "sources", "douyin", accountId);
const manifestPath = join(accountDir, "manifest.json");
if (!existsSync(manifestPath)) throw new Error(`manifest does not exist: ${manifestPath}`);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (String(manifest?.source?.accountId ?? "") !== accountId) {
  throw new Error("manifest account does not match --account");
}
if (!Array.isArray(manifest.videos)) throw new Error("manifest videos must be an array");
for (const row of manifest.videos) {
  const videoId = String(row?.videoId ?? "");
  if (!/^\d+$/u.test(videoId)) throw new Error("manifest videoId must contain digits only");
  const canonicalUrl = `https://www.douyin.com/video/${videoId}`;
  if (row.url !== canonicalUrl) throw new Error("manifest video URL must be canonical");
  const canonicalTranscriptPath = `transcripts/${videoId}.json`;
  if (row.transcriptPath != null && row.transcriptPath !== canonicalTranscriptPath) {
    throw new Error("manifest transcriptPath must use the canonical per-video path");
  }
}

const cacheRoot = join(projectRoot, ".cache", "douyin");
const transcriptDir = join(accountDir, "transcripts");
const knowledgePath = join(accountDir, "knowledge.jsonl");
const doctrinePath = join(accountDir, "doctrine-candidates.jsonl");
const failuresPath = join(accountDir, "failures.jsonl");
mkdirSync(transcriptDir, { recursive: true });

for (const row of manifest.videos) {
  if (row.status !== "extracted" && row.status !== "reviewed") continue;
  const paths = cachePaths(cacheRoot, accountId, row.videoId);
  cleanupSuccessfulMedia(paths);
  rmSync(join(mediaDir, `${row.videoId}.mp4`), { force: true });
}

const selected = manifest.videos
  .map((row, index) => ({ row, index }))
  .filter(({ row }) => {
    if (TERMINAL.has(row.status) || (row.status === "failed" && !resume)) return false;
    const paths = cachePaths(cacheRoot, accountId, row.videoId);
    const incoming = join(mediaDir, `${row.videoId}.mp4`);
    const durableTranscript = join(transcriptDir, `${row.videoId}.json`);
    return existsSync(incoming) || existsSync(paths.video) || existsSync(durableTranscript);
  })
  .slice(0, limit);

for (const { index } of selected) {
  let row = manifest.videos[index];
  const paths = cachePaths(cacheRoot, accountId, row.videoId);
  const incomingPath = join(mediaDir, `${row.videoId}.mp4`);
  const transcriptPath = join(transcriptDir, `${row.videoId}.json`);
  const generatedPath = join(paths.dir, "transcript.generated.json");
  let category = "processing";
  const persist = () => {
    manifest.videos[index] = row;
    atomicWriteJson(manifestPath, manifest);
  };

  try {
    if (
      row.status !== "transcribed" &&
      row.status !== "extracted" &&
      existsSync(transcriptPath)
    ) {
      category = "transcript-recovery";
      const durableTranscript = JSON.parse(readFileSync(transcriptPath, "utf8"));
      validateTranscript(durableTranscript);
      durableTranscript.generatedAt ||= new Date().toISOString();
      durableTranscript.source = {
        accountId,
        videoId: row.videoId,
        url: `https://www.douyin.com/video/${row.videoId}`,
        title: row.title,
      };
      atomicWriteJson(transcriptPath, durableTranscript);
      if (row.status === "discovered") {
        row = transitionVideo(row, "downloaded", { error: null });
        persist();
      }
      row = transitionVideo(row, "transcribed", {
        transcriptPath: `transcripts/${row.videoId}.json`,
        error: null,
      });
      persist();
    }

    if (row.status === "failed") {
      const durableTranscript = row.transcriptPath && existsSync(join(accountDir, row.transcriptPath));
      if (row.lastSuccessfulStage === "transcribed" && durableTranscript) {
        row = transitionVideo(row, "transcribed", { error: null });
        persist();
      } else if (row.lastSuccessfulStage === "extracted") {
        row = transitionVideo(row, "extracted", { error: null });
        persist();
      } else {
        if (!existsSync(paths.video) && !existsSync(incomingPath)) {
          throw new Error("no retained media is available for retry");
        }
        mkdirSync(paths.dir, { recursive: true });
        if (existsSync(incomingPath)) copyFileSync(incomingPath, paths.video);
        row = transitionVideo(row, "downloaded", {
          contentHash: hashFile(paths.video),
          error: null,
        });
        persist();
      }
    } else if (row.status === "discovered") {
      category = "media";
      if (!existsSync(incomingPath)) throw new Error("incoming MP4 does not exist");
      mkdirSync(paths.dir, { recursive: true });
      copyFileSync(incomingPath, paths.video);
      row = transitionVideo(row, "downloaded", { contentHash: hashFile(paths.video) });
      persist();
    }

    if (row.status === "downloaded") {
      category = "transcription";
      if (!existsSync(paths.video)) throw new Error("cached source.mp4 does not exist");
      mkdirSync(paths.dir, { recursive: true });
      const command = realTranscriber ? python : process.execPath;
      const commandArgs = [transcriber, "--input", paths.video, "--output", generatedPath];
      if (realTranscriber) {
        commandArgs.push(
          "--model", model,
          "--device", device,
          "--compute-type", computeType,
        );
      }
      execFileSync(command, commandArgs, {
        encoding: "utf8",
        env: { ...process.env, HF_HOME: join(projectRoot, ".cache", "huggingface") },
        stdio: "pipe",
      });
      const generated = JSON.parse(readFileSync(generatedPath, "utf8"));
      validateTranscript(generated);
      generated.generatedAt = new Date().toISOString();
      generated.source = {
        accountId,
        videoId: row.videoId,
        url: `https://www.douyin.com/video/${row.videoId}`,
        title: row.title,
      };
      atomicWriteJson(transcriptPath, generated);
      rmSync(generatedPath, { force: true });
      row = transitionVideo(row, "transcribed", {
        transcriptPath: `transcripts/${row.videoId}.json`,
        error: null,
      });
      persist();
    }

    if (row.status === "transcribed") {
      category = "extraction";
      const transcript = JSON.parse(readFileSync(join(accountDir, row.transcriptPath), "utf8"));
      validateTranscript(transcript);
      const candidates = extractCandidates(row, transcript);
      atomicWriteJsonl(knowledgePath, [...readJsonl(knowledgePath), ...candidates]);
      atomicWriteJsonl(doctrinePath, [...readJsonl(doctrinePath), ...candidates]);
      row = transitionVideo(row, "extracted", {
        knowledgeIds: candidates.map((candidate) => candidate.id),
        error: null,
      });
      persist();
    }

    if (row.status === "extracted") {
      cleanupSuccessfulMedia(paths);
      rmSync(incomingPath, { force: true });
    }
  } catch (error) {
    const message = sanitize(error);
    if (row.status !== "failed") {
      row = transitionVideo(row, "failed", { error: { category, message } });
    } else {
      row = {
        ...row,
        retries: (row.retries ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        error: { category, message },
      };
    }
    persist();
    const failure = {
      id: failureId(row.videoId, category, message),
      videoId: row.videoId,
      category,
      at: new Date().toISOString(),
      message,
    };
    atomicWriteJsonl(failuresPath, [...readJsonl(failuresPath), failure]);
  }
}

console.log(JSON.stringify({ accountId, selected: selected.length }));
