import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { cachePaths } from "../tools/lib/douyin-state.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const processor = join(repo, "tools/douyin/process-account.mjs");
const reporter = join(repo, "tools/douyin/report.mjs");
const importer = join(repo, "tools/douyin/import-manifest.mjs");
const transcriber = join(repo, "tests/fixtures/douyin-mock-transcriber.mjs");
const fixture = join(repo, "tests/fixtures/douyin-observed-manifest.json");
const accountId = "74480108075";
const firstId = "7660454136994975018";
const secondId = "7660857581832785190";
const temp = mkdtempSync(join(tmpdir(), "douyin-pipeline-"));
const mediaDir = join(temp, "media");
const accountDir = join(temp, "training-samples/sources/douyin", accountId);
const manifestPath = join(accountDir, "manifest.json");

function runProcessor(extra = [], env = process.env) {
  return spawnSync(
    process.execPath,
    [
      processor,
      "--account",
      accountId,
      "--root",
      temp,
      "--media-dir",
      mediaDir,
      "--limit",
      "1",
      "--transcriber",
      transcriber,
      ...extra,
    ],
    { encoding: "utf8", env },
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

try {
  mkdirSync(mediaDir, { recursive: true });
  const observedPath = join(temp, "observed.json");
  writeFileSync(observedPath, readFileSync(fixture));
  execFileSync(
    process.execPath,
    [importer, "--account", accountId, "--input", observedPath, "--root", temp],
    { encoding: "utf8" },
  );

  const invalidAccount = spawnSync(
    process.execPath,
    [processor, "--account", "..", "--root", temp, "--media-dir", mediaDir, "--transcriber", transcriber],
    { encoding: "utf8" },
  );
  assert.notEqual(invalidAccount.status, 0);
  assert.match(invalidAccount.stderr, /account.*digits/i);

  const cleanManifest = readJson(manifestPath);
  const unsafeTranscriptManifest = structuredClone(cleanManifest);
  unsafeTranscriptManifest.videos[0].transcriptPath = "../../outside.json";
  writeFileSync(manifestPath, `${JSON.stringify(unsafeTranscriptManifest, null, 2)}\n`, "utf8");
  const unsafeTranscript = runProcessor();
  assert.notEqual(unsafeTranscript.status, 0);
  assert.match(unsafeTranscript.stderr, /transcriptPath.*canonical/i);

  const unsafeUrlManifest = structuredClone(cleanManifest);
  unsafeUrlManifest.videos[0].url = `https://www.douyin.com/video/${firstId}?signature=secret`;
  writeFileSync(manifestPath, `${JSON.stringify(unsafeUrlManifest, null, 2)}\n`, "utf8");
  const unsafeUrl = runProcessor();
  assert.notEqual(unsafeUrl.status, 0);
  assert.match(unsafeUrl.stderr, /canonical.*URL/i);
  writeFileSync(manifestPath, `${JSON.stringify(cleanManifest, null, 2)}\n`, "utf8");

  const invalidLimit = spawnSync(
    process.execPath,
    [
      processor,
      "--account",
      accountId,
      "--root",
      temp,
      "--media-dir",
      mediaDir,
      "--limit",
      "0",
      "--transcriber",
      transcriber,
    ],
    { encoding: "utf8" },
  );
  assert.notEqual(invalidLimit.status, 0);
  assert.match(invalidLimit.stderr, /--limit must be a positive integer/);

  const mismatch = spawnSync(
    process.execPath,
    [processor, "--account", "other-account", "--root", temp, "--media-dir", mediaDir],
    { encoding: "utf8" },
  );
  assert.notEqual(mismatch.status, 0);
  assert.match(mismatch.stderr, /manifest|account/i);

  writeFileSync(join(mediaDir, `${firstId}.mp4`), "first fake public video", "utf8");
  const success = runProcessor();
  assert.equal(success.status, 0, success.stderr);

  const successfulManifest = readJson(manifestPath);
  const successfulRow = successfulManifest.videos.find((row) => row.videoId === firstId);
  assert.equal(successfulRow.status, "extracted");
  assert.equal(successfulRow.lastSuccessfulStage, "extracted");
  assert.match(successfulRow.contentHash, /^[a-f0-9]{64}$/u);
  assert.ok(successfulRow.knowledgeIds.length > 0);

  const transcript = readJson(join(accountDir, successfulRow.transcriptPath));
  assert.equal(transcript.source.accountId, accountId);
  assert.equal(transcript.source.videoId, firstId);
  assert.equal(transcript.source.url, successfulRow.url);
  assert.equal(transcript.source.title, successfulRow.title);
  assert.match(transcript.generatedAt, /^\d{4}-\d{2}-\d{2}T/u);
  assert.deepEqual(transcript.model, { name: "mock", device: "cpu", computeType: "int8" });

  const knowledgePath = join(accountDir, "knowledge.jsonl");
  const doctrinePath = join(accountDir, "doctrine-candidates.jsonl");
  const knowledge = readJsonl(knowledgePath);
  assert.ok(knowledge.length > 0);
  assert.ok(knowledge.every((row) => row.reviewStatus === "pending"));
  assert.deepEqual(readJsonl(doctrinePath), knowledge);
  assert.equal(existsSync(join(mediaDir, `${firstId}.mp4`)), false);
  const firstCache = cachePaths(join(temp, ".cache/douyin"), accountId, firstId);
  assert.equal(existsSync(firstCache.dir), false);

  writeFileSync(join(mediaDir, `${secondId}.mp4`), "second fake public video", "utf8");
  const failed = runProcessor([], { ...process.env, DOUYIN_MOCK_FAIL: "1" });
  assert.equal(failed.status, 0, failed.stderr);
  const failedManifest = readJson(manifestPath);
  const failedRow = failedManifest.videos.find((row) => row.videoId === secondId);
  assert.equal(failedRow.status, "failed");
  assert.equal(failedRow.lastSuccessfulStage, "downloaded");
  assert.equal(failedRow.retries, 1);
  assert.doesNotMatch(JSON.stringify(failedRow.error), /https?:\/\//iu);
  assert.ok(JSON.stringify(failedRow.error).length <= 600);
  assert.equal(existsSync(join(mediaDir, `${secondId}.mp4`)), true);
  const secondCache = cachePaths(join(temp, ".cache/douyin"), accountId, secondId);
  assert.equal(existsSync(secondCache.video), true);
  const failuresPath = join(accountDir, "failures.jsonl");
  assert.equal(readJsonl(failuresPath).length, 1);
  assert.doesNotMatch(readFileSync(failuresPath, "utf8"), /https?:\/\//iu);

  const identical = runProcessor([], { ...process.env, DOUYIN_MOCK_FAIL: "1" });
  assert.equal(identical.status, 0, identical.stderr);
  assert.equal(readJson(manifestPath).videos.find((row) => row.videoId === secondId).retries, 1);
  assert.equal(readJsonl(failuresPath).length, 1);
  assert.equal(readJsonl(knowledgePath).length, knowledge.length);

  const resumed = runProcessor(["--resume"]);
  assert.equal(resumed.status, 0, resumed.stderr);
  const resumedRow = readJson(manifestPath).videos.find((row) => row.videoId === secondId);
  assert.equal(resumedRow.status, "extracted");
  assert.equal(resumedRow.lastSuccessfulStage, "extracted");
  assert.equal(resumedRow.retries, 1);
  assert.equal(existsSync(join(mediaDir, `${secondId}.mp4`)), false);
  assert.equal(existsSync(secondCache.dir), false);

  const afterResumeKnowledge = readJsonl(knowledgePath);
  const noWork = runProcessor(["--resume"]);
  assert.equal(noWork.status, 0, noWork.stderr);
  assert.equal(readJsonl(knowledgePath).length, afterResumeKnowledge.length);
  assert.equal(new Set(readJsonl(knowledgePath).map((row) => row.id)).size, afterResumeKnowledge.length);
  assert.equal(new Set(readJsonl(doctrinePath).map((row) => row.id)).size, readJsonl(doctrinePath).length);

  mkdirSync(firstCache.dir, { recursive: true });
  writeFileSync(firstCache.video, "orphaned cached media", "utf8");
  writeFileSync(firstCache.audio, "orphaned cached audio", "utf8");
  writeFileSync(join(mediaDir, `${firstId}.mp4`), "orphaned incoming media", "utf8");
  const cleanupRecovery = runProcessor(["--resume"]);
  assert.equal(cleanupRecovery.status, 0, cleanupRecovery.stderr);
  assert.equal(existsSync(firstCache.dir), false, "terminal rows must clean crash-window cache remnants");
  assert.equal(existsSync(join(mediaDir, `${firstId}.mp4`)), false);

  const thirdId = "7660999999999999999";
  const crashManifest = readJson(manifestPath);
  crashManifest.videos.push({
    videoId: thirdId,
    url: `https://www.douyin.com/video/${thirdId}`,
    title: "持久转写恢复测试",
    status: "discovered",
    lastSuccessfulStage: "discovered",
    discoveredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    retries: 0,
    error: null,
    transcriptPath: null,
    knowledgeIds: [],
    contentHash: null,
  });
  writeFileSync(manifestPath, `${JSON.stringify(crashManifest, null, 2)}\n`, "utf8");
  const durableTranscript = structuredClone(transcript);
  durableTranscript.source = {
    accountId,
    videoId: thirdId,
    url: `https://www.douyin.com/video/${thirdId}`,
    title: "持久转写恢复测试",
  };
  writeFileSync(join(accountDir, `transcripts/${thirdId}.json`), `${JSON.stringify(durableTranscript, null, 2)}\n`, "utf8");
  const durableRecovery = runProcessor(["--resume"]);
  assert.equal(durableRecovery.status, 0, durableRecovery.stderr);
  const recoveredRow = readJson(manifestPath).videos.find((row) => row.videoId === thirdId);
  assert.equal(recoveredRow.status, "extracted", "durable transcript must resume without media or retranscription");
  assert.equal(recoveredRow.transcriptPath, `transcripts/${thirdId}.json`);

  execFileSync(process.execPath, [reporter, "--account", accountId, "--root", temp], {
    encoding: "utf8",
  });
  const report = readJson(join(accountDir, "reports/latest.json"));
  assert.equal(report.accountId, accountId);
  assert.equal(report.declared, 325);
  assert.equal(report.observed, 3);
  assert.equal(report.missingFromDeclared, 322);
  assert.equal(report.extracted, 3);
  assert.equal(report.totalStates, report.observed);
  assert.equal(
    ["discovered", "downloaded", "transcribed", "extracted", "reviewed", "blocked", "failed"]
      .reduce((sum, state) => sum + report[state], 0),
    report.observed,
  );
  assert.match(readFileSync(join(accountDir, "reports/latest.md"), "utf8"), /抖音知识采集报告/u);

  console.log("抖音本地流水线测试通过");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
