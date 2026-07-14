import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { publishAfterInputVerification } from "../tools/lib/douyin-candidate-publish.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const cli = join(repo, "tools/douyin/refine-candidate.mjs");
const accountId = "74480108075";
const videoId = "7660857581832785190";
const url = `https://www.douyin.com/video/${videoId}`;
const generatedAt = "2026-07-14T00:00:00.000Z";
const temp = mkdtempSync(join(tmpdir(), "douyin-candidate-cli-"));
const accountDir = join(temp, "training-samples", "sources", "douyin", accountId);
const manifestPath = join(accountDir, "manifest.json");
const transcriptPath = join(accountDir, "transcripts", `${videoId}.json`);
const knowledgePath = join(accountDir, "knowledge.jsonl");
const doctrinePath = join(accountDir, "doctrine-candidates.jsonl");
const reviewPath = join(accountDir, "reviews", `${videoId}.corrections.json`);
const outputDir = join(accountDir, "strategy-candidates");
const outputJson = join(outputDir, `${videoId}.json`);
const outputMarkdown = join(outputDir, `${videoId}.md`);

const manifest = {
  source: { accountId },
  videos: [{
    accountId,
    videoId,
    url,
    title: "single video fixture",
    status: "extracted",
    transcriptPath: `transcripts/${videoId}.json`,
  }],
};
const transcript = {
  schemaVersion: 1,
  source: { accountId, videoId, url },
  segments: [
    { start: 0, end: 2, text: "RAW-A " },
    { start: 2, end: 4, text: "RAW-B" },
  ],
};
const knowledge = [{
  id: "knowledge-overlap",
  reviewStatus: "pending",
  evidence: { videoId, url, start: 1, end: 3, text: "raw pending claim" },
}];
const review = {
  status: "confirmed",
  accountId,
  videoId,
  url,
  start: 0,
  end: 4,
  correctedText: "CORRECTED",
  interpretation: {
    key: "partner-feed-window",
    trigger: "partner can take the lead",
    inference: "可能 the partner retains a finishing route",
    action: "feed the smallest safe card",
    applicability: "partner cooperation",
    exceptions: ["an opponent is already on one card"],
    risks: ["the feed may transfer control"],
    confidence: "medium-low",
    testScenario: {
      given: "a partner can beat a low card",
      when: "the player leads",
      then: "the smallest safe feed is preferred",
    },
  },
};

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function run(extra = []) {
  return spawnSync(process.execPath, [
    cli,
    "--account", accountId,
    "--video", videoId,
    "--root", temp,
    "--generated-at", generatedAt,
    ...extra,
  ], { encoding: "utf8" });
}

function hash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function hashInputs() {
  return Object.fromEntries([
    manifestPath,
    transcriptPath,
    knowledgePath,
    doctrinePath,
  ].map((path) => [path, hash(path)]));
}

let publishCalls = 0;
assert.throws(
  () => publishAfterInputVerification({
    before: { manifest: "before" },
    after: { manifest: "changed" },
    publish() {
      publishCalls += 1;
    },
  }),
  /immutable|changed/i,
);
assert.equal(publishCalls, 0, "changed immutable inputs must prevent every artifact write");

try {
  mkdirSync(join(accountDir, "transcripts"), { recursive: true });
  mkdirSync(join(accountDir, "reviews"), { recursive: true });
  writeJson(manifestPath, manifest);
  writeJson(transcriptPath, transcript);
  writeFileSync(knowledgePath, `${knowledge.map(JSON.stringify).join("\n")}\n`, "utf8");
  writeFileSync(doctrinePath, `${knowledge.map(JSON.stringify).join("\n")}\n`, "utf8");
  writeJson(reviewPath, review);

  const hashesBefore = hashInputs();
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  const summary = JSON.parse(first.stdout);
  assert.deepEqual(summary, {
    accountId,
    videoId,
    candidateCount: 1,
    outputJson,
    outputMarkdown,
  });
  const firstJsonBytes = readFileSync(outputJson);
  const firstMarkdownBytes = readFileSync(outputMarkdown);
  const parsed = JSON.parse(firstJsonBytes);
  assert.equal(parsed.candidates[0].status, "needs-validation");
  assert.equal(parsed.candidates[0].confidence.sourceCount, 1);
  assert.match(parsed.candidates[0].confidence.level, /^(?:low|medium-low)$/u);
  const markdown = firstMarkdownBytes.toString("utf8");
  assert.match(markdown, /needs-validation/u);
  assert.equal(markdown.endsWith("\n"), true, "Markdown must end with a newline");
  assert.equal(markdown.endsWith("\n\n"), false, "Markdown must end with exactly one newline");
  for (const label of ["Candidate ID", "Trigger", "Inference", "Action", "Confidence", "Evidence time", "Exceptions", "Risks", "Given", "When", "Then"]) {
    assert.match(markdown, new RegExp(label, "u"));
  }

  const second = run();
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(readFileSync(outputJson), firstJsonBytes, "fixed-time JSON must be byte-idempotent");
  assert.deepEqual(readFileSync(outputMarkdown), firstMarkdownBytes, "fixed-time Markdown must be byte-idempotent");
  assert.deepEqual(hashInputs(), hashesBefore, "refinement must not rewrite source evidence");
  assert.equal(existsSync(join(temp, "strategy")), false);
  assert.equal(existsSync(join(accountDir, "strategy")), false);

  const invalidAccount = spawnSync(process.execPath, [cli, "--account", "..", "--video", videoId, "--root", temp], { encoding: "utf8" });
  assert.notEqual(invalidAccount.status, 0);
  assert.match(invalidAccount.stderr, /account.*digits/i);
  const invalidVideo = spawnSync(process.execPath, [cli, "--account", accountId, "--video", "../x", "--root", temp], { encoding: "utf8" });
  assert.notEqual(invalidVideo.status, 0);
  assert.match(invalidVideo.stderr, /video.*digits/i);
  const nonCanonicalGeneratedAt = spawnSync(process.execPath, [
    cli,
    "--account", accountId,
    "--video", videoId,
    "--root", temp,
    "--generated-at", "1",
  ], { encoding: "utf8" });
  assert.notEqual(nonCanonicalGeneratedAt.status, 0);
  assert.match(nonCanonicalGeneratedAt.stderr, /generated-at.*canonical|ISO/i);

  const mismatched = structuredClone(manifest);
  mismatched.source.accountId = "999";
  writeJson(manifestPath, mismatched);
  const identityFailure = run();
  assert.notEqual(identityFailure.status, 0);
  assert.match(identityFailure.stderr, /manifest.*account|identity/i);
  writeJson(manifestPath, manifest);

  unlinkSync(reviewPath);
  const missingReview = run();
  assert.notEqual(missingReview.status, 0);
  assert.match(missingReview.stderr, /review|correction|does not exist/i);
  writeJson(reviewPath, review);

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir);
  mkdirSync(outputJson);
  const atomicRenameFailure = run();
  assert.notEqual(atomicRenameFailure.status, 0);
  assert.equal(
    readdirSync(outputDir).some((name) => name.startsWith(`${videoId}.json.tmp-`)),
    false,
    "failed atomic JSON rename must clean its sibling temporary file",
  );
  rmSync(outputJson, { recursive: true, force: true });

  rmSync(outputDir, { recursive: true, force: true });
  const outside = join(temp, "outside-output");
  mkdirSync(outside);
  let symlinkSupported = true;
  try {
    symlinkSync(outside, outputDir, "junction");
  } catch (error) {
    symlinkSupported = false;
    assert.match(String(error?.code ?? error), /EPERM|EACCES|ENOTSUP|UNKNOWN/i);
  }
  if (symlinkSupported) {
    const escapedOutput = run();
    assert.notEqual(escapedOutput.status, 0);
    assert.match(escapedOutput.stderr, /output|strategy-candidates|outside|escape|symlink/i);
    assert.equal(existsSync(join(outside, `${videoId}.json`)), false);
  }

  console.log("Douyin candidate refinement CLI smoke test passed");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
