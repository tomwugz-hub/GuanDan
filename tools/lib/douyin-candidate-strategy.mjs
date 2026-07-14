import { createHash } from "node:crypto";

const UNCERTAINTY = /可能|大概率|弱信号|待验证|倾向/u;
const CONFIDENCE_LEVELS = new Set(["low", "medium-low"]);

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function requireIdentity(actual, expected, name) {
  if (actual !== expected) throw new Error(`${name} identity mismatch`);
}

function canonicalUrl(videoId) {
  return `https://www.douyin.com/video/${encodeURIComponent(videoId)}`;
}

function validateRange(start, end, name) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    throw new Error(`${name} must have a valid start/end time range`);
  }
}

function validateStringArray(value, name) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${name} must contain non-empty strings`);
  }
}

function validateTestScenario(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("testScenario must be an object");
  }
  for (const field of ["given", "when", "then"]) requiredString(value[field], `testScenario.${field}`);
}

export function validateCorrectionReview(review, { accountId, videoId }) {
  if (review === null || typeof review !== "object" || Array.isArray(review)) {
    throw new Error("correction review must be an object");
  }
  requiredString(accountId, "accountId");
  requiredString(videoId, "videoId");
  requireIdentity(review.accountId, accountId, "accountId");
  requireIdentity(review.videoId, videoId, "videoId");
  if (review.url !== canonicalUrl(videoId)) throw new Error("correction review URL must be canonical");
  if (review.status !== "confirmed") throw new Error("correction review status must be confirmed");
  validateRange(review.start, review.end, "correction review");
  requiredString(review.correctedText, "correctedText");

  const interpretation = review.interpretation;
  if (interpretation === null || typeof interpretation !== "object" || Array.isArray(interpretation)) {
    throw new Error("interpretation must be structured");
  }
  for (const field of ["key", "trigger", "inference", "action", "applicability"]) {
    requiredString(interpretation[field], `interpretation.${field}`);
  }
  if (!UNCERTAINTY.test(interpretation.inference)) {
    throw new Error("interpretation.inference must retain uncertain language");
  }
  validateStringArray(interpretation.exceptions, "interpretation.exceptions");
  validateStringArray(interpretation.risks, "interpretation.risks");
  if (!CONFIDENCE_LEVELS.has(interpretation.confidence)) {
    throw new Error("interpretation.confidence must be low or medium-low");
  }
  validateTestScenario(interpretation.testScenario);
  return true;
}

function stableId(videoId, interpretation) {
  return createHash("sha256")
    .update(`${videoId}\0${interpretation.key}\0${interpretation.trigger}\0${interpretation.inference}`)
    .digest("hex")
    .slice(0, 16);
}

function assertSourceIdentity(source, { accountId, videoId, url }, name) {
  if (source === null || typeof source !== "object") throw new Error(`${name} source is required`);
  requireIdentity(source.accountId, accountId, `${name} accountId`);
  requireIdentity(source.videoId, videoId, `${name} videoId`);
  if (source.url !== url) throw new Error(`${name} URL must match the canonical URL`);
}

export function refineCandidateStrategies({
  video,
  transcript,
  knowledge,
  correctionReview,
  generatedAt = new Date().toISOString(),
}) {
  const accountId = requiredString(video?.accountId, "video.accountId");
  const videoId = requiredString(video?.videoId, "video.videoId");
  const url = canonicalUrl(videoId);
  if (video.url !== url) throw new Error("video URL must be canonical");
  assertSourceIdentity(transcript?.source, { accountId, videoId, url }, "transcript");
  validateCorrectionReview(correctionReview, { accountId, videoId });

  const segments = transcript?.segments;
  if (!Array.isArray(segments)) throw new Error("transcript.segments must be an array");
  const contained = segments.filter((segment) => {
    validateRange(segment?.start, segment?.end, "transcript segment");
    requiredString(segment?.text, "transcript segment text");
    return segment.start >= correctionReview.start && segment.end <= correctionReview.end;
  });
  if (contained.length === 0) throw new Error("correction range must contain raw transcript segments");
  contained.sort((left, right) => left.start - right.start || left.end - right.end);
  const rawText = contained.map((segment) => segment.text).join("");

  if (!Array.isArray(knowledge)) throw new Error("knowledge must be an array");
  const overlapping = knowledge.filter((row) => {
    if (row?.reviewStatus !== "pending") return false;
    const evidence = row?.evidence;
    if (evidence?.videoId !== videoId || evidence?.url !== url) return false;
    if (!Number.isFinite(evidence.start) || !Number.isFinite(evidence.end) || evidence.end <= evidence.start) return false;
    return evidence.start < correctionReview.end && evidence.end > correctionReview.start;
  });
  if (overlapping.length === 0) throw new Error("at least one overlapping pending knowledge row is required");

  const interpretation = correctionReview.interpretation;
  const result = {
    schemaVersion: "1.0.0",
    generatedAt,
    accountId,
    videoId,
    source: { accountId, videoId, url },
    candidates: [
      {
        id: stableId(videoId, interpretation),
        status: "needs-validation",
        trigger: interpretation.trigger,
        inference: interpretation.inference,
        action: interpretation.action,
        applicability: interpretation.applicability,
        exceptions: interpretation.exceptions,
        risks: interpretation.risks,
        confidence: { level: interpretation.confidence, sourceCount: 1 },
        evidence: {
          videoId,
          url,
          start: correctionReview.start,
          end: correctionReview.end,
          rawText,
          transcriptSegments: contained,
          knowledgeIds: overlapping.map((row) => row.id),
          knowledge: overlapping.map((row) => row.evidence),
        },
        correction: {
          status: correctionReview.status,
          correctedText: correctionReview.correctedText,
        },
        testScenario: interpretation.testScenario,
      },
    ],
  };

  return structuredClone(result);
}
