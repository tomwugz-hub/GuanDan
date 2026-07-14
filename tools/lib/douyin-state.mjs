import { rmSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const NEXT = {
  discovered: new Set(["downloaded", "blocked", "failed"]),
  downloaded: new Set(["transcribed", "blocked", "failed"]),
  transcribed: new Set(["extracted", "failed"]),
  extracted: new Set(["reviewed", "failed"]),
  failed: new Set(["downloaded", "transcribed", "extracted", "blocked"]),
  reviewed: new Set(),
  blocked: new Set(),
};

const SUCCESSFUL_STAGES = new Set([
  "downloaded",
  "transcribed",
  "extracted",
  "reviewed",
]);
const STAGE_RANK = {
  discovered: 0,
  downloaded: 1,
  transcribed: 2,
  extracted: 3,
  reviewed: 4,
};

function isInside(parent, candidate) {
  const nested = relative(parent, candidate);
  return nested !== "" && !isAbsolute(nested) && nested !== ".." && !nested.startsWith(`..${sep}`);
}

export function transitionVideo(row, next, patch = {}, now = new Date().toISOString()) {
  if (!NEXT[row?.status]?.has(next)) {
    throw new Error(`Illegal video state transition: ${row?.status} -> ${next}`);
  }

  const previousStage = row.lastSuccessfulStage;
  const nextSuccessfulStage =
    SUCCESSFUL_STAGES.has(next) &&
    (STAGE_RANK[previousStage] === undefined || STAGE_RANK[next] > STAGE_RANK[previousStage])
      ? next
      : previousStage;

  return {
    ...row,
    ...(patch ?? {}),
    status: next,
    updatedAt: now,
    lastSuccessfulStage: nextSuccessfulStage,
    retries: next === "failed" ? (row.retries ?? 0) + 1 : (row.retries ?? 0),
  };
}

export function cachePaths(root, accountId, videoId) {
  const cacheRoot = resolve(root);
  const accountDir = resolve(cacheRoot, String(accountId));
  const dir = resolve(accountDir, String(videoId));

  if (!isInside(cacheRoot, accountDir) || !isInside(accountDir, dir)) {
    throw new Error("Douyin cache path must stay within its account and cache root");
  }

  return {
    dir,
    video: join(dir, "source.mp4"),
    audio: join(dir, "audio.wav"),
  };
}

export function cleanupSuccessfulMedia(paths) {
  const dir = resolve(paths.dir);
  const video = resolve(paths.video);
  const audio = resolve(paths.audio);

  if (
    dirname(dir) === dir ||
    video !== join(dir, "source.mp4") ||
    audio !== join(dir, "audio.wav")
  ) {
    throw new Error("Refusing to clean media outside the computed per-video directory");
  }

  rmSync(video, { force: true });
  rmSync(audio, { force: true });
  rmSync(dir, { recursive: true, force: true });
}
