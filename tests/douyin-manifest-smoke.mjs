import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  atomicWriteJson,
  mergeManifest,
  normalizeObservedManifest,
} from "../tools/lib/douyin-manifest.mjs";

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
