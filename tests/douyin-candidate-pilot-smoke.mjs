import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const accountId = "74480108075";
const videoId = "7660454136994975018";
const url = `https://www.douyin.com/video/${videoId}`;
const accountDir = join(repo, "training-samples", "sources", "douyin", accountId);
const transcript = JSON.parse(readFileSync(join(accountDir, "transcripts", `${videoId}.json`), "utf8"));
const review = JSON.parse(readFileSync(join(accountDir, "reviews", `${videoId}.corrections.json`), "utf8"));
const artifact = JSON.parse(readFileSync(join(accountDir, "strategy-candidates", `${videoId}.json`), "utf8"));
const markdown = readFileSync(join(accountDir, "strategy-candidates", `${videoId}.md`), "utf8");

assert.equal(review.corrections.length, 5);
assert.equal(artifact.candidates.length, 5);
assert.equal(new Set(artifact.candidates.map((candidate) => candidate.id)).size, 5);
assert.deepEqual(
  artifact.candidates.map((candidate) => candidate.evidence.start),
  [...artifact.candidates].map((candidate) => candidate.evidence.start).sort((a, b) => a - b),
);

for (let index = 0; index < review.corrections.length; index += 1) {
  const correction = review.corrections[index];
  const candidate = artifact.candidates[index];
  const rawText = transcript.segments
    .filter((segment) => segment.start >= correction.start && segment.end <= correction.end)
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .map((segment) => segment.text)
    .join("");
  assert.equal(correction.rawText, rawText);
  assert.equal(candidate.evidence.rawText, correction.rawText);
  assert.equal(candidate.correction.correctedText, correction.correctedText);
  assert.equal(candidate.status, "needs-validation");
  assert.equal(candidate.confidence.sourceCount, 1);
  assert.match(candidate.confidence.level, /^(?:low|medium-low)$/u);
  assert.equal(candidate.evidence.url, url);
  assert.match(candidate.inference, /可能|大概率|弱信号|待验证|倾向/u);
  assert.match(markdown, new RegExp(candidate.id, "u"));
}

assert.equal(artifact.source.url, url);
assert.match(artifact.candidates[3].trigger, /三个连续对子/u);
assert.doesNotMatch(artifact.candidates[3].trigger, /三张头/u);
assert.equal(markdown.endsWith("\n"), true);
assert.equal(markdown.endsWith("\n\n"), false);

console.log("Douyin real candidate pilot smoke test passed");
