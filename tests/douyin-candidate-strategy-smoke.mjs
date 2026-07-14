import assert from "node:assert/strict";

import {
  refineCandidateStrategies,
  validateCorrectionReview,
} from "../tools/lib/douyin-candidate-strategy.mjs";

const accountId = "74480108075";
const videoId = "7660857581832785190";
const url = `https://www.douyin.com/video/${videoId}`;

function fixture() {
  const video = {
    accountId,
    videoId,
    url,
    title: "canonical single-video fixture",
  };
  const transcript = {
    source: { accountId, videoId, url },
    segments: [
      { start: 0, end: 2, text: "RAW-A " },
      { start: 2, end: 4, text: "RAW-B" },
      { start: 4, end: 6, text: " OUTSIDE" },
    ],
  };
  const knowledge = [
    {
      id: "knowledge-overlap-a",
      reviewStatus: "pending",
      evidence: { videoId, url, start: 1, end: 3, text: "raw pending claim A" },
    },
    {
      id: "knowledge-overlap-b",
      reviewStatus: "pending",
      evidence: { videoId, url, start: 3.5, end: 5, text: "raw pending claim B" },
    },
    {
      id: "knowledge-outside",
      reviewStatus: "pending",
      evidence: { videoId, url, start: 10, end: 12, text: "outside" },
    },
  ];
  const correctionReview = {
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
      inference: "鍙兘 the partner retains a finishing route",
      action: "feed the smallest safe card",
      applicability: "partner cooperation",
      exceptions: ["an opponent is already on one card"],
      risks: ["the feed may transfer control to an opponent"],
      confidence: "medium-low",
      testScenario: {
        given: "a partner can beat a low card",
        when: "the player leads",
        then: "the smallest safe feed is preferred",
      },
    },
  };
  return { video, transcript, knowledge, correctionReview };
}

const generatedAt = "2026-07-14T00:00:00.000Z";
const input = fixture();
const output = refineCandidateStrategies({ ...input, generatedAt });

assert.equal(output.schemaVersion, "1.0.0");
assert.equal(output.generatedAt, generatedAt);
assert.equal(output.accountId, accountId);
assert.equal(output.videoId, videoId);
assert.deepEqual(output.source, { accountId, videoId, url });
assert.equal(output.candidates.length, 1);

const [candidate] = output.candidates;
assert.match(candidate.id, /^[a-f0-9]{16}$/u);
assert.equal(candidate.status, "needs-validation");
assert.equal(candidate.trigger, input.correctionReview.interpretation.trigger);
assert.equal(candidate.inference, input.correctionReview.interpretation.inference);
assert.equal(candidate.action, input.correctionReview.interpretation.action);
assert.equal(candidate.applicability, input.correctionReview.interpretation.applicability);
assert.deepEqual(candidate.exceptions, input.correctionReview.interpretation.exceptions);
assert.deepEqual(candidate.risks, input.correctionReview.interpretation.risks);
assert.equal(candidate.confidence.level, "medium-low");
assert.equal(candidate.confidence.sourceCount, 1);
assert.equal(candidate.evidence.rawText, "RAW-A RAW-B");
assert.deepEqual(candidate.evidence.knowledgeIds, ["knowledge-overlap-a", "knowledge-overlap-b"]);
assert.equal(candidate.correction.correctedText, "CORRECTED");
assert.equal(candidate.correction.status, "confirmed");
assert.deepEqual(candidate.testScenario, input.correctionReview.interpretation.testScenario);
assert.ok(candidate.exceptions.every(Boolean));
assert.ok(candidate.risks.every(Boolean));
assert.ok(Object.values(candidate.testScenario).every((value) => typeof value === "string" && value.trim()));

const later = refineCandidateStrategies({ ...fixture(), generatedAt: "2030-01-01T00:00:00.000Z" });
assert.equal(later.candidates[0].id, candidate.id, "generatedAt must not affect stable IDs");

input.correctionReview.interpretation.exceptions[0] = "mutated after refinement";
input.transcript.segments[0].text = "mutated raw transcript";
assert.equal(candidate.exceptions[0], "an opponent is already on one card", "output must be deep-cloned");
assert.equal(candidate.evidence.rawText, "RAW-A RAW-B", "evidence must retain the original raw transcript");

assert.doesNotThrow(() => validateCorrectionReview(fixture().correctionReview, { accountId, videoId }));

function rejects(label, mutate, pattern) {
  const value = fixture();
  mutate(value);
  assert.throws(
    () => refineCandidateStrategies({ ...value, generatedAt }),
    pattern,
    label,
  );
}

rejects("high confidence", (value) => {
  value.correctionReview.interpretation.confidence = "high";
}, /confidence/i);
rejects("missing exceptions", (value) => {
  value.correctionReview.interpretation.exceptions = [];
}, /exceptions/i);
rejects("missing test scenario", (value) => {
  value.correctionReview.interpretation.testScenario.then = "";
}, /testScenario|then/i);
rejects("certainty-only inference", (value) => {
  value.correctionReview.interpretation.inference = "the partner definitely retains a finishing route";
}, /uncertain|inference/i);
rejects("invalid times", (value) => {
  value.correctionReview.end = value.correctionReview.start;
}, /time|range|start|end/i);
rejects("unconfirmed correction", (value) => {
  value.correctionReview.status = "pending";
}, /confirmed|status/i);
rejects("canonical URL mismatch", (value) => {
  value.correctionReview.url = `${url}?share=1`;
}, /canonical|url/i);
rejects("identity mismatch", (value) => {
  value.correctionReview.accountId = "different-account";
}, /accountId|identity/i);
rejects("missing overlapping pending knowledge", (value) => {
  value.knowledge = value.knowledge.map((row) => ({ ...row, reviewStatus: "reviewed" }));
}, /overlap|pending|knowledge/i);

console.log("鎶栭煶鍊欓€夌瓥鐣ユ彁鐐兼祴璇曢€氳繃");
