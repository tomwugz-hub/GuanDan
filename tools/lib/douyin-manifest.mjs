import {
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

const TARGET_ACCOUNT_ID = "74480108075";

function videoIdFromUrl(url) {
  const match = String(url ?? "").match(/\/video\/(\d+)(?:[/?#]|$)/u);
  if (!match) throw new Error(`无法识别抖音视频 URL: ${url}`);
  return match[1];
}

function titleFromRaw(raw) {
  return String(raw ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) => !/^(?:置顶(?:作品)?|\d+(?:\.\d+)?\s*(?:万|[wW])?)$/u.test(line),
    )
    .join(" ");
}

export function normalizeObservedManifest(input, now = new Date().toISOString()) {
  if (String(input?.source?.accountId ?? "") !== TARGET_ACCOUNT_ID) {
    throw new Error(`输入账号必须是目标账号 ${TARGET_ACCOUNT_ID}`);
  }

  const byId = new Map();
  for (const row of input.videos ?? []) {
    const videoId = videoIdFromUrl(row?.href);
    const title = titleFromRaw(row?.raw);
    const previous = byId.get(videoId);
    byId.set(videoId, {
      videoId,
      url: `https://www.douyin.com/video/${videoId}`,
      title: title || previous?.title || "",
      status: "discovered",
      lastSuccessfulStage: "discovered",
      discoveredAt: now,
      updatedAt: now,
      retries: 0,
      error: null,
      transcriptPath: null,
      knowledgeIds: [],
      contentHash: null,
    });
  }

  return {
    schemaVersion: 1,
    source: {
      ...input.source,
      observedVideoCount: byId.size,
      capturedAt: now,
    },
    videos: [...byId.values()],
  };
}

export function mergeManifest(existing, observed, now = new Date().toISOString()) {
  const existingById = new Map(
    (existing?.videos ?? []).map((row) => [String(row.videoId), row]),
  );
  const seen = new Set();
  const videos = [];

  for (const incoming of observed?.videos ?? []) {
    const videoId = String(incoming.videoId);
    const old = existingById.get(videoId);
    seen.add(videoId);
    videos.push(
      old
        ? {
            ...incoming,
            ...old,
            title: incoming.title || old.title,
            url: incoming.url,
            updatedAt: now,
          }
        : incoming,
    );
  }

  for (const old of existing?.videos ?? []) {
    if (!seen.has(String(old.videoId))) videos.push(old);
  }

  return {
    ...existing,
    ...observed,
    source: { ...existing?.source, ...observed?.source },
    videos,
  };
}

export function atomicWriteJson(filePath, value) {
  const parent = dirname(filePath);
  mkdirSync(parent, { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;

  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, filePath);
  } catch (error) {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    throw error;
  }
}
