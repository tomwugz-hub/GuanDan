import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  atomicWriteJson,
  mergeManifest,
  normalizeObservedManifest,
} from "../tools/lib/douyin-manifest.mjs";
import {
  cachePaths,
  cleanupSuccessfulMedia,
  transitionVideo,
} from "../tools/lib/douyin-state.mjs";

function assert(value, message) {
  if (!value) throw new Error(message);
}

const fixturePath = fileURLToPath(
  new URL("fixtures/douyin-observed-manifest.json", import.meta.url),
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const firstSeenAt = "2026-07-14T00:00:00.000Z";
const observed = normalizeObservedManifest(fixture, firstSeenAt);

assert(observed.videos.length === 2, "应按 videoId 去重");
assert(
  observed.videos[0].videoId === "7660454136994975018",
  "应从 URL 提取数字 videoId",
);
assert(
  observed.videos[0].url ===
    "https://www.douyin.com/video/7660454136994975018",
  "应保存规范化抖音视频 URL",
);
assert(!observed.videos[0].title.includes("置顶"), "标题应移除置顶标记");
assert(!observed.videos[0].title.includes("526"), "标题应移除互动数");
assert(!observed.videos[1].title.includes("1.2 万"), "标题应移除带单位互动数");
assert(observed.videos[0].status === "discovered", "新条目状态应为 discovered");
assert(
  observed.videos[0].lastSuccessfulStage === "discovered",
  "新条目最后成功阶段应为 discovered",
);
assert(observed.videos[0].retries === 0, "新条目应初始化重试次数");
assert(observed.videos[0].error === null, "新条目应初始化错误元数据");
assert(observed.videos[0].transcriptPath === null, "新条目应初始化输出路径");
assert(Array.isArray(observed.videos[0].knowledgeIds), "新条目应初始化知识输出");
assert(observed.source.declaredWorkCount === 325, "应保留声明作品数");
assert(observed.source.observedVideoCount === 2, "观察数应来自唯一视频链接");

let rejectedWrongAccount = false;
try {
  normalizeObservedManifest({ ...fixture, source: { ...fixture.source, accountId: "1" } });
} catch (error) {
  rejectedWrongAccount = /74480108075|目标账号/.test(error.message);
}
assert(rejectedWrongAccount, "应拒绝非目标账号");

const existing = structuredClone(observed);
Object.assign(existing.videos[0], {
  title: "旧标题",
  status: "transcribed",
  lastSuccessfulStage: "transcribed",
  discoveredAt: "2026-07-13T00:00:00.000Z",
  retries: 3,
  error: { stage: "knowledge", message: "待重试" },
  transcriptPath: "transcripts/7660454136994975018.json",
  knowledgeIds: ["knowledge-1"],
  contentHash: "sha256:durable",
});
const refreshed = structuredClone(observed);
refreshed.videos[0].title = "刷新后的标题";
const mergedAt = "2026-07-15T00:00:00.000Z";
const merged = mergeManifest(existing, refreshed, mergedAt);
const preserved = merged.videos.find(
  ({ videoId }) => videoId === "7660454136994975018",
);
assert(preserved.status === "transcribed", "重新发现不得回退处理状态");
assert(preserved.lastSuccessfulStage === "transcribed", "不得回退最后成功阶段");
assert(preserved.discoveredAt === "2026-07-13T00:00:00.000Z", "应保留首次发现时间");
assert(preserved.retries === 3, "应保留重试元数据");
assert(preserved.error.message === "待重试", "应保留错误元数据");
assert(preserved.transcriptPath.endsWith(".json"), "应保留输出路径");
assert(preserved.knowledgeIds[0] === "knowledge-1", "应保留知识输出");
assert(preserved.contentHash === "sha256:durable", "应保留内容哈希");
assert(preserved.title === "刷新后的标题", "允许刷新标题");
assert(preserved.updatedAt === mergedAt, "重新发现应刷新更新时间");
assert(merged.source.declaredWorkCount === 325, "合并后应保留声明作品数");

const discovered = observed.videos[0];
const downloaded = transitionVideo(
  discovered,
  "downloaded",
  { downloadPath: "temporary/source.mp4" },
  "2026-07-14T01:00:00.000Z",
);
assert(downloaded.status === "downloaded", "discovered should advance to downloaded");
assert(downloaded.lastSuccessfulStage === "downloaded", "success should advance the last successful stage");
assert(downloaded.retries === 0, "success should preserve retry count");
assert(downloaded.updatedAt === "2026-07-14T01:00:00.000Z", "transition should use the supplied timestamp");
assert(downloaded.downloadPath === "temporary/source.mp4", "transition should retain patch metadata");

const transcribed = transitionVideo(downloaded, "transcribed", {}, "2026-07-14T02:00:00.000Z");
const extracted = transitionVideo(transcribed, "extracted", {}, "2026-07-14T03:00:00.000Z");
const reviewed = transitionVideo(extracted, "reviewed", {}, "2026-07-14T04:00:00.000Z");
assert(reviewed.lastSuccessfulStage === "reviewed", "the full successful progression should be legal");

const failed = transitionVideo(
  downloaded,
  "failed",
  { error: { category: "transcription", message: "temporary failure" } },
  "2026-07-14T05:00:00.000Z",
);
assert(failed.retries === 1, "entering failed should increment retries");
assert(failed.lastSuccessfulStage === "downloaded", "failed should not advance the last successful stage");
assert(failed.error.category === "transcription", "failed should retain categorized errors");
const resumed = transitionVideo(failed, "transcribed", {}, "2026-07-14T06:00:00.000Z");
assert(resumed.retries === 1, "recovery should preserve retries");
assert(resumed.lastSuccessfulStage === "transcribed", "failed should resume at a legal successful stage");

const blocked = transitionVideo(
  discovered,
  "blocked",
  { error: { category: "access", message: "video unavailable" } },
  "2026-07-14T07:00:00.000Z",
);
assert(blocked.status === "blocked", "access errors should enter blocked");
assert(blocked.lastSuccessfulStage === "discovered", "blocked should not advance the last successful stage");
assert(blocked.retries === 0, "blocked should not increment retries");
assert(blocked.error.category === "access", "blocked should retain categorized errors");

for (const terminal of [reviewed, blocked]) {
  let rejectedTerminal = false;
  try {
    transitionVideo(terminal, "failed");
  } catch {
    rejectedTerminal = true;
  }
  assert(rejectedTerminal, `${terminal.status} should be terminal`);
}

let rejectedSkip = false;
try {
  transitionVideo(downloaded, "reviewed");
} catch {
  rejectedSkip = true;
}
assert(rejectedSkip, "downloaded should not skip directly to reviewed");

for (const next of ["downloaded", "transcribed", "extracted", "blocked"]) {
  const fromFailed = transitionVideo(failed, next);
  assert(fromFailed.status === next, `failed should allow transition to ${next}`);
}

const failedAfterExtraction = transitionVideo(extracted, "failed");
const retriedDownload = transitionVideo(failedAfterExtraction, "downloaded");
assert(
  retriedDownload.lastSuccessfulStage === "extracted",
  "retrying an earlier stage must not regress the last successful stage",
);
const failedAgain = transitionVideo(retriedDownload, "failed");
assert(failedAgain.retries === 2, "each entry into failed should increment retries");

const cacheRoot = await mkdtemp(join(tmpdir(), "douyin-state-"));
try {
  const cache = cachePaths(cacheRoot, "74480108075", discovered.videoId);
  const relativeDir = relative(resolve(cacheRoot), cache.dir);
  assert(relativeDir && !relativeDir.startsWith(`..${sep}`), "cache directory should stay inside its root");
  assert(cache.video === join(cache.dir, "source.mp4"), "cache should include the raw video path");
  assert(cache.audio === join(cache.dir, "audio.wav"), "cache should include the audio path");

  let rejectedTraversal = false;
  try {
    cachePaths(cacheRoot, "..", "escape");
  } catch {
    rejectedTraversal = true;
  }
  assert(rejectedTraversal, "account and video IDs must not escape the cache root");

  mkdirSync(cache.dir, { recursive: true });
  writeFileSync(cache.video, "video");
  writeFileSync(cache.audio, "audio");
  cleanupSuccessfulMedia(cache);
  assert(!existsSync(cache.video) && !existsSync(cache.audio), "cleanup should remove successful media");
  assert(!existsSync(cache.dir), "cleanup should remove the unused video directory");
  cleanupSuccessfulMedia(cache);

  const sentinel = join(cacheRoot, "keep.txt");
  writeFileSync(sentinel, "keep");
  let rejectedOutsideCleanup = false;
  try {
    cleanupSuccessfulMedia({ ...cache, video: sentinel });
  } catch {
    rejectedOutsideCleanup = true;
  }
  assert(rejectedOutsideCleanup, "cleanup should reject paths outside the video directory");
  assert(existsSync(sentinel), "cleanup must not remove files outside the video directory");
} finally {
  await rm(cacheRoot, { recursive: true, force: true });
}

const tempRoot = await mkdtemp(join(tmpdir(), "douyin-manifest-"));
try {
  const outputPath = join(tempRoot, "nested", "manifest.json");
  atomicWriteJson(outputPath, { ok: true });
  assert(existsSync(outputPath), "原子写入应创建父目录和目标文件");
  assert(JSON.parse(await readFile(outputPath, "utf8")).ok, "原子写入内容应有效");
  assert(
    readdirSync(dirname(outputPath)).every((name) => !name.startsWith("manifest.json.tmp-")),
    "原子写入后不得残留临时文件",
  );

  const cliPath = fileURLToPath(
    new URL("../tools/douyin/import-manifest.mjs", import.meta.url),
  );
  const imported = spawnSync(
    process.execPath,
    [cliPath, "--account", "74480108075", "--input", fixturePath, "--root", tempRoot],
    { encoding: "utf8" },
  );
  assert(imported.status === 0, `CLI 导入应成功: ${imported.stderr}`);
  const cliResult = JSON.parse(imported.stdout);
  assert(cliResult.observed === 2 && cliResult.total === 2, "CLI 应输出紧凑导入结果");
  assert(existsSync(cliResult.output), "CLI 应写入账号清单");

  const mismatched = spawnSync(
    process.execPath,
    [cliPath, "--account", "999", "--input", fixturePath, "--root", tempRoot],
    { encoding: "utf8" },
  );
  assert(mismatched.status !== 0, "CLI 应拒绝参数账号与输入账号不匹配");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

console.log("抖音清单规范化测试通过");
