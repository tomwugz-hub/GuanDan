# Douyin Local Knowledge Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a resumable local pipeline that imports the observed “掼蛋教父” video manifest, transcribes locally supplied public videos, extracts traceable knowledge candidates, and reports progress without retaining media.

**Architecture:** Codex browser assistance remains outside the repository and exports visible manifest/media inputs without exposing browser credentials. Repository code owns deterministic manifest merging, state transitions, local `faster-whisper` transcription, candidate extraction, reporting, cleanup, and resumability. No candidate can modify `strategy/` automatically.

**Tech Stack:** Node.js ESM, Python 3.9+, `faster-whisper==1.2.1`, `imageio-ffmpeg==0.6.0`, JSON/JSONL, existing script-style smoke tests.

## Global Constraints

- Process only public videos available through the current signed-in browser session; never bypass login, CAPTCHA, anti-bot, payment, region, or DRM restrictions.
- Never store cookies, browser profiles, access tokens, or expiring signed media URLs.
- Keep temporary media under `.cache/douyin/`; delete video/audio after successful transcription and extraction.
- Persist source URL, video ID, timestamps, model metadata, confidence, and review status for every knowledge candidate.
- Start with `faster-whisper` model `small`, language `zh`, CPU `int8`; use CUDA only after runtime verification.
- Import 325 as the declared count and 306 as the observed count; do not fabricate the inaccessible 19 entries.
- Candidate doctrine never edits `strategy/` without a doctrine ticket, regression test, and the existing release gate.

---

## File Map

- Create `tools/lib/douyin-manifest.mjs`: normalize and atomically merge browser-observed manifests.
- Create `tools/lib/douyin-state.mjs`: validate state transitions and manage cache cleanup.
- Create `tools/lib/douyin-knowledge.mjs`: deterministic topic classification and evidence-backed candidate extraction.
- Create `tools/douyin/import-manifest.mjs`: CLI manifest importer.
- Create `tools/douyin/transcribe.py`: local audio extraction and faster-whisper adapter.
- Create `tools/douyin/requirements.txt`: pinned local transcription dependencies.
- Create `tools/douyin/process-account.mjs`: resumable per-video orchestrator over locally supplied media.
- Create `tools/douyin/report.mjs`: JSON and Markdown progress reports.
- Create `tests/douyin-manifest-smoke.mjs`: manifest and state-machine contract tests.
- Create `tests/douyin-knowledge-smoke.mjs`: transcript-to-candidate tests.
- Create `tests/douyin-pipeline-smoke.mjs`: mocked end-to-end resume and cleanup test.
- Create `tests/fixtures/douyin-observed-manifest.json`: compact browser-export fixture.
- Create `tests/fixtures/douyin-mock-transcriber.mjs`: deterministic test transcriber.
- Modify `.gitignore`: ignore `.cache/douyin/`, local Python environment, and model cache.
- Modify `package.json`: add Douyin data commands and targeted smoke scripts.
- Create `training-samples/sources/douyin/74480108075/source.json`: account provenance.
- Generate `training-samples/sources/douyin/74480108075/manifest.json`: real 306-link normalized manifest.
- Create `docs/DOUYIN-KNOWLEDGE-RUNBOOK.md`: setup, browser handoff, processing, review, and recovery guide.

---

### Task 1: Manifest Normalization and Import

**Files:**
- Create: `tools/lib/douyin-manifest.mjs`
- Create: `tools/douyin/import-manifest.mjs`
- Create: `tests/fixtures/douyin-observed-manifest.json`
- Create: `tests/douyin-manifest-smoke.mjs`

**Interfaces:**
- Consumes: browser-export JSON `{ source, videos: [{ href, raw }] }`.
- Produces: `normalizeObservedManifest(input, now)`, `mergeManifest(existing, observed, now)`, `atomicWriteJson(path, value)`.

- [ ] **Step 1: Write the failing manifest test and compact fixture**

```json
{
  "source": {
    "platform": "douyin",
    "accountId": "74480108075",
    "displayName": "掼蛋教父",
    "declaredWorkCount": 325,
    "observedVideoCount": 2,
    "profileUrl": "https://www.douyin.com/user/example"
  },
  "videos": [
    { "href": "https://www.douyin.com/video/7660454136994975018", "raw": "526\n\n为什么你打掼蛋老是被对手算的一清二楚？ #掼蛋 #掼蛋技巧 #掼蛋教父" },
    { "href": "https://www.douyin.com/video/7660857581832785190", "raw": "112\n\n掼蛋如何用好炸弹？记住这四点 #掼蛋 #掼蛋技巧 #掼蛋教父" }
  ]
}
```

```js
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeObservedManifest, mergeManifest } from "../tools/lib/douyin-manifest.mjs";

function assert(value, message) { if (!value) throw new Error(message); }
const fixture = JSON.parse(readFileSync(fileURLToPath(new URL("fixtures/douyin-observed-manifest.json", import.meta.url)), "utf8"));
const observed = normalizeObservedManifest(fixture, "2026-07-14T00:00:00.000Z");
assert(observed.videos.length === 2, "应规范化两条视频");
assert(observed.videos[0].videoId === "7660454136994975018", "应从 URL 提取 videoId");
assert(observed.videos[0].status === "discovered", "新条目应为 discovered");
const existing = structuredClone(observed);
existing.videos[0].status = "transcribed";
const merged = mergeManifest(existing, observed, "2026-07-15T00:00:00.000Z");
assert(merged.videos[0].status === "transcribed", "重新发现不得回退状态");
assert(merged.source.declaredWorkCount === 325, "应保留标称作品数");
console.log("抖音清单规范化测试通过");
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `node tests/douyin-manifest-smoke.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `tools/lib/douyin-manifest.mjs`.

- [ ] **Step 3: Implement normalization, merge, and atomic writes**

```js
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

function videoIdFromUrl(url) {
  const match = String(url).match(/\/video\/(\d+)/);
  if (!match) throw new Error(`无法识别抖音视频 URL: ${url}`);
  return match[1];
}

function titleFromRaw(raw) {
  return String(raw).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    .filter((line) => !/^(置顶|\d+(?:\.\d+)?万?)$/.test(line)).join(" ");
}

export function normalizeObservedManifest(input, now = new Date().toISOString()) {
  if (input?.source?.accountId !== "74480108075") throw new Error("账号与目标配置不匹配");
  const byId = new Map();
  for (const row of input.videos ?? []) {
    const videoId = videoIdFromUrl(row.href);
    byId.set(videoId, {
      videoId, url: `https://www.douyin.com/video/${videoId}`,
      title: titleFromRaw(row.raw), status: "discovered", lastSuccessfulStage: "discovered",
      discoveredAt: now, updatedAt: now, retries: 0, error: null,
      transcriptPath: null, knowledgeIds: [], contentHash: null
    });
  }
  return { schemaVersion: 1, source: { ...input.source, observedVideoCount: byId.size, capturedAt: now }, videos: [...byId.values()] };
}

export function mergeManifest(existing, observed, now = new Date().toISOString()) {
  const incoming = new Map(observed.videos.map((row) => [row.videoId, row]));
  const videos = existing.videos.map((old) => incoming.has(old.videoId)
    ? { ...incoming.get(old.videoId), ...old, title: incoming.get(old.videoId).title, url: incoming.get(old.videoId).url, updatedAt: now }
    : old);
  const known = new Set(videos.map((row) => row.videoId));
  for (const row of observed.videos) if (!known.has(row.videoId)) videos.push(row);
  return { ...observed, videos };
}

export function atomicWriteJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp-${process.pid}`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temp, path);
}
```

Create `tools/douyin/import-manifest.mjs`:

```js
#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteJson, mergeManifest, normalizeObservedManifest } from "../lib/douyin-manifest.mjs";

function value(args, name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}
const args = process.argv.slice(2);
const accountId = value(args, "--account");
const inputPath = value(args, "--input");
const projectRoot = value(args, "--root", join(dirname(fileURLToPath(import.meta.url)), "../.."));
if (!accountId || !inputPath) throw new Error("用法: --account <id> --input <observed.json> [--root <project-root>]");
const input = JSON.parse(readFileSync(inputPath, "utf8"));
if (input.source?.accountId !== accountId) throw new Error("输入清单账号不匹配");
const output = join(projectRoot, "training-samples", "sources", "douyin", accountId, "manifest.json");
const observed = normalizeObservedManifest(input);
const merged = existsSync(output)
  ? mergeManifest(JSON.parse(readFileSync(output, "utf8")), observed)
  : observed;
atomicWriteJson(output, merged);
console.log(JSON.stringify({ accountId, observed: observed.videos.length, total: merged.videos.length, output }));
```

- [ ] **Step 4: Run the targeted test**

Run: `node tests/douyin-manifest-smoke.mjs`

Expected: `抖音清单规范化测试通过`.

- [ ] **Step 5: Commit Task 1**

```powershell
git add tools/lib/douyin-manifest.mjs tools/douyin/import-manifest.mjs tests/fixtures/douyin-observed-manifest.json tests/douyin-manifest-smoke.mjs
git commit -m "feat(data): add Douyin manifest importer"
```

---

### Task 2: State Machine and Cache Safety

**Files:**
- Create: `tools/lib/douyin-state.mjs`
- Modify: `tests/douyin-manifest-smoke.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: manifest video row and cache root.
- Produces: `transitionVideo(row, next, patch, now)`, `cachePaths(root, accountId, videoId)`, `cleanupSuccessfulMedia(paths)`.

- [ ] **Step 1: Extend the failing test**

```js
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transitionVideo, cachePaths, cleanupSuccessfulMedia } from "../tools/lib/douyin-state.mjs";

const discovered = observed.videos[0];
const downloaded = transitionVideo(discovered, "downloaded", {}, "2026-07-14T01:00:00.000Z");
assert(downloaded.lastSuccessfulStage === "downloaded", "成功阶段应推进");
const blocked = transitionVideo(discovered, "blocked", { error: { category: "access", message: "作品不可访问" } });
assert(blocked.status === "blocked", "访问限制应进入 blocked 且不重试");
let illegal = false;
try { transitionVideo(downloaded, "reviewed"); } catch { illegal = true; }
assert(illegal, "不得跨越转写和提取阶段");
const cache = cachePaths(mkdtempSync(join(tmpdir(), "douyin-state-")), "74480108075", discovered.videoId);
mkdirSync(cache.dir, { recursive: true });
writeFileSync(cache.video, "video"); writeFileSync(cache.audio, "audio");
cleanupSuccessfulMedia(cache);
assert(!existsSync(cache.video) && !existsSync(cache.audio), "成功后应清理媒体");
```

- [ ] **Step 2: Verify failure**

Run: `node tests/douyin-manifest-smoke.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `douyin-state.mjs`.

- [ ] **Step 3: Implement state and cleanup functions**

```js
import { rmSync } from "node:fs";
import { join } from "node:path";

const NEXT = {
  discovered: new Set(["downloaded", "blocked", "failed"]),
  downloaded: new Set(["transcribed", "blocked", "failed"]),
  transcribed: new Set(["extracted", "failed"]),
  extracted: new Set(["reviewed", "failed"]),
  failed: new Set(["downloaded", "transcribed", "extracted", "blocked"]),
  reviewed: new Set(), blocked: new Set()
};

export function transitionVideo(row, next, patch = {}, now = new Date().toISOString()) {
  if (!NEXT[row.status]?.has(next)) throw new Error(`非法状态迁移: ${row.status} -> ${next}`);
  const success = ["downloaded", "transcribed", "extracted", "reviewed"].includes(next);
  return { ...row, ...patch, status: next, updatedAt: now,
    lastSuccessfulStage: success ? next : row.lastSuccessfulStage,
    retries: next === "failed" ? (row.retries ?? 0) + 1 : row.retries ?? 0 };
}

export function cachePaths(root, accountId, videoId) {
  const dir = join(root, accountId, videoId);
  return { dir, video: join(dir, "source.mp4"), audio: join(dir, "audio.wav") };
}

export function cleanupSuccessfulMedia(paths) {
  rmSync(paths.video, { force: true });
  rmSync(paths.audio, { force: true });
  rmSync(paths.dir, { recursive: true, force: true });
}
```

Append to `.gitignore`:

```gitignore
# Local Douyin media, Python environment, and model cache
.cache/douyin/
.venv-douyin/
.cache/huggingface/
```

- [ ] **Step 4: Run test and verify pass**

Run: `node tests/douyin-manifest-smoke.mjs`

Expected: `抖音清单规范化测试通过`.

- [ ] **Step 5: Commit Task 2**

```powershell
git add .gitignore tools/lib/douyin-state.mjs tests/douyin-manifest-smoke.mjs
git commit -m "feat(data): add resumable Douyin states"
```

---

### Task 3: Local Transcription Adapter

**Files:**
- Create: `tools/douyin/requirements.txt`
- Create: `tools/douyin/transcribe.py`
- Create: `tests/douyin-transcriber-contract.mjs`

**Interfaces:**
- Consumes: `--input <mp4> --output <json> [--model small] [--device cpu] [--compute-type int8]`.
- Produces: transcript JSON with `schemaVersion`, `model`, `language`, `durationSeconds`, and ordered `segments`.

- [ ] **Step 1: Write a contract test that does not require the model**

```js
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const python = process.env.GUANDAN_DOUYIN_PYTHON;
if (!python) { console.log("跳过：未设置 GUANDAN_DOUYIN_PYTHON"); process.exit(0); }
const script = fileURLToPath(new URL("../tools/douyin/transcribe.py", import.meta.url));
const output = JSON.parse(execFileSync(python, [script, "--probe"], { encoding: "utf8" }));
if (output.schemaVersion !== 1 || !output.python) throw new Error("probe 输出不符合契约");
console.log("本地转写器契约测试通过");
```

- [ ] **Step 2: Verify failure with the configured bundled Python**

Run:

```powershell
$env:GUANDAN_DOUYIN_PYTHON='C:\Users\PC\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
node tests/douyin-transcriber-contract.mjs
```

Expected: FAIL because `tools/douyin/transcribe.py` does not exist.

- [ ] **Step 3: Add pinned requirements and the transcriber**

```text
faster-whisper==1.2.1
imageio-ffmpeg==0.6.0
```

```python
import argparse, json, platform, subprocess
from pathlib import Path

def args():
    p = argparse.ArgumentParser()
    p.add_argument("--probe", action="store_true")
    p.add_argument("--input")
    p.add_argument("--output")
    p.add_argument("--model", default="small")
    p.add_argument("--device", default="cpu")
    p.add_argument("--compute-type", default="int8")
    return p.parse_args()

def main():
    a = args()
    if a.probe:
        print(json.dumps({"schemaVersion": 1, "python": platform.python_version()}))
        return
    if not a.input or not a.output:
        raise SystemExit("--input and --output are required")
    import imageio_ffmpeg
    from faster_whisper import WhisperModel
    source, target = Path(a.input), Path(a.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    audio = source.with_suffix(".wav")
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-i", str(source), "-ac", "1", "-ar", "16000", str(audio)], check=True)
    model = WhisperModel(a.model, device=a.device, compute_type=a.compute_type)
    stream, info = model.transcribe(str(audio), language="zh", vad_filter=True)
    segments = [{"start": round(s.start, 3), "end": round(s.end, 3), "text": s.text.strip(), "avgLogProb": s.avg_logprob} for s in stream]
    payload = {"schemaVersion": 1, "model": {"name": a.model, "device": a.device, "computeType": a.compute_type},
               "language": info.language, "durationSeconds": info.duration, "segments": segments}
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

if __name__ == "__main__": main()
```

- [ ] **Step 4: Run the contract test**

Run the command from Step 2.

Expected: `本地转写器契约测试通过`.

- [ ] **Step 5: Commit Task 3**

```powershell
git add tools/douyin/requirements.txt tools/douyin/transcribe.py tests/douyin-transcriber-contract.mjs
git commit -m "feat(data): add local Whisper transcriber"
```

---

### Task 4: Evidence-Backed Knowledge Extraction

**Files:**
- Create: `tools/lib/douyin-knowledge.mjs`
- Create: `tests/douyin-knowledge-smoke.mjs`

**Interfaces:**
- Consumes: normalized video row and transcript JSON.
- Produces: `extractCandidates(video, transcript)` returning pending candidates with stable IDs and evidence timestamps.

- [ ] **Step 1: Write the failing extraction test**

```js
import { extractCandidates } from "../tools/lib/douyin-knowledge.mjs";
function assert(value, message) { if (!value) throw new Error(message); }
const video = { videoId: "1", url: "https://www.douyin.com/video/1", title: "掼蛋如何用好炸弹？记住这四点" };
const transcript = { segments: [
  { start: 0, end: 4, text: "炸弹不要见牌就打，要先判断对手是否报牌。", avgLogProb: -0.2 },
  { start: 4, end: 8, text: "对手只剩一张时，控牌价值通常高于保炸。", avgLogProb: -0.3 }
] };
const rows = extractCandidates(video, transcript);
assert(rows.length >= 1, "应提取至少一条候选知识");
assert(rows[0].topic === "炸弹", "应识别炸弹主题");
assert(rows[0].evidence.videoId === "1" && rows[0].evidence.start === 0, "应保留来源时间");
assert(rows[0].reviewStatus === "pending", "不得自动晋升教义");
console.log("抖音知识提取测试通过");
```

- [ ] **Step 2: Verify module-not-found failure**

Run: `node tests/douyin-knowledge-smoke.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement deterministic candidates**

```js
import { createHash } from "node:crypto";
const TOPICS = [
  ["炸弹", /炸弹|开炸|保炸/], ["组牌", /组牌|顺子|连对|三带二/],
  ["记牌", /记牌|算牌|推理/], ["配合", /对家|队友|喂牌|接风|配合/],
  ["进还贡", /进贡|还贡|抗贡/], ["残局", /残局|报牌|剩一张|头游/]
];
function topicOf(text) { return TOPICS.find(([, re]) => re.test(text))?.[0] ?? "综合"; }
export function extractCandidates(video, transcript) {
  return (transcript.segments ?? []).filter((s) => s.text.length >= 8).map((s) => {
    const id = createHash("sha256").update(`${video.videoId}:${s.start}:${s.text}`).digest("hex").slice(0, 16);
    return { id, claim: s.text, topic: topicOf(`${video.title} ${s.text}`), conditions: [], action: s.text,
      exceptions: [], confidence: { transcriptAvgLogProb: s.avgLogProb ?? null, sourceCount: 1 }, reviewStatus: "pending",
      evidence: { videoId: video.videoId, url: video.url, start: s.start, end: s.end, text: s.text } };
  });
}
```

- [ ] **Step 4: Run the targeted test**

Run: `node tests/douyin-knowledge-smoke.mjs`

Expected: `抖音知识提取测试通过`.

- [ ] **Step 5: Commit Task 4**

```powershell
git add tools/lib/douyin-knowledge.mjs tests/douyin-knowledge-smoke.mjs
git commit -m "feat(data): extract traceable Douyin knowledge"
```

---

### Task 5: Resumable Processor, Reports, and Package Commands

**Files:**
- Create: `tools/douyin/process-account.mjs`
- Create: `tools/douyin/report.mjs`
- Create: `tests/fixtures/douyin-mock-transcriber.mjs`
- Create: `tests/douyin-pipeline-smoke.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: account manifest, `<media-dir>/<videoId>.mp4`, Python executable/transcriber command.
- Produces: transcripts, `knowledge.jsonl`, updated manifest, failure log, latest JSON/Markdown report.

- [ ] **Step 1: Write the mock transcriber and failing end-to-end test**

```js
#!/usr/bin/env node
import { writeFileSync } from "node:fs";
if (process.env.DOUYIN_MOCK_FAIL === "1") throw new Error("mock transcription failure");
const output = process.argv[process.argv.indexOf("--output") + 1];
writeFileSync(output, JSON.stringify({ schemaVersion: 1, model: { name: "mock" }, language: "zh", durationSeconds: 4,
  segments: [{ start: 0, end: 4, text: "炸弹不要见牌就打，要先判断对手是否报牌。", avgLogProb: -0.2 }] }, null, 2));
```

```js
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const temp = mkdtempSync(join(tmpdir(), "douyin-pipeline-"));
const accountDir = join(temp, "training-samples/sources/douyin/74480108075");
mkdirSync(accountDir, { recursive: true });
const fixture = JSON.parse(readFileSync(join(root, "tests/fixtures/douyin-observed-manifest.json"), "utf8"));
const input = join(temp, "observed.json"); writeFileSync(input, JSON.stringify(fixture));
execFileSync(process.execPath, [join(root, "tools/douyin/import-manifest.mjs"), "--account", "74480108075", "--input", input, "--root", temp]);
const media = join(temp, "media"); mkdirSync(media); writeFileSync(join(media, "7660454136994975018.mp4"), "fake");
execFileSync(process.execPath, [join(root, "tools/douyin/process-account.mjs"), "--account", "74480108075", "--root", temp,
  "--media-dir", media, "--limit", "1", "--transcriber", join(root, "tests/fixtures/douyin-mock-transcriber.mjs")]);
const manifest = JSON.parse(readFileSync(join(accountDir, "manifest.json"), "utf8"));
if (manifest.videos[0].status !== "extracted") throw new Error("应完成知识提取");
if (existsSync(join(media, "7660454136994975018.mp4"))) throw new Error("成功后应删除临时媒体");
writeFileSync(join(media, "7660857581832785190.mp4"), "fake");
execFileSync(process.execPath, [join(root, "tools/douyin/process-account.mjs"), "--account", "74480108075", "--root", temp,
  "--media-dir", media, "--limit", "1", "--transcriber", join(root, "tests/fixtures/douyin-mock-transcriber.mjs")],
  { env: { ...process.env, DOUYIN_MOCK_FAIL: "1" } });
const failedManifest = JSON.parse(readFileSync(join(accountDir, "manifest.json"), "utf8"));
if (failedManifest.videos[1].status !== "failed") throw new Error("转写失败应记录 failed");
if (!existsSync(join(media, "7660857581832785190.mp4"))) throw new Error("失败后必须保留媒体以便重试");
console.log("抖音本地流水线测试通过");
```

- [ ] **Step 2: Verify the processor is missing**

Run: `node tests/douyin-pipeline-smoke.mjs`

Expected: FAIL because `process-account.mjs` does not exist.

- [ ] **Step 3: Implement the processor and report generator**

Create `tools/douyin/process-account.mjs`:

```js
#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteJson } from "../lib/douyin-manifest.mjs";
import { extractCandidates } from "../lib/douyin-knowledge.mjs";
import { transitionVideo } from "../lib/douyin-state.mjs";

function arg(args, name, fallback = null) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; }
function readJsonl(path) { return existsSync(path) ? readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map(JSON.parse) : []; }
function writeJsonl(path, rows) {
  mkdirSync(dirname(path), { recursive: true });
  const unique = [...new Map(rows.map((row) => [row.id ?? `${row.videoId}:${row.at}`, row])).values()];
  const temp = `${path}.tmp-${process.pid}`;
  writeFileSync(temp, `${unique.map(JSON.stringify).join("\n")}\n`, "utf8"); renameSync(temp, path);
}
function sanitize(error) { return String(error?.message ?? error).replace(/https:\/\/[^\s]+/g, "[media-url-removed]").slice(0, 500); }

const args = process.argv.slice(2);
const accountId = arg(args, "--account");
const projectRoot = arg(args, "--root", join(dirname(fileURLToPath(import.meta.url)), "../.."));
const mediaDir = arg(args, "--media-dir");
const limit = Number(arg(args, "--limit", "1"));
const python = arg(args, "--python", process.env.GUANDAN_DOUYIN_PYTHON);
const transcriber = arg(args, "--transcriber", join(dirname(fileURLToPath(import.meta.url)), "transcribe.py"));
const model = arg(args, "--model", "small");
if (!accountId || !mediaDir) throw new Error("用法: --account <id> --media-dir <dir> [--limit N] [--python path]");
const accountDir = join(projectRoot, "training-samples", "sources", "douyin", accountId);
const manifestPath = join(accountDir, "manifest.json");
const transcriptDir = join(accountDir, "transcripts"); mkdirSync(transcriptDir, { recursive: true });
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const terminal = new Set(["extracted", "reviewed", "blocked"]);
const selected = manifest.videos.filter((row) => {
  if (terminal.has(row.status)) return false;
  const transcriptExists = row.transcriptPath && existsSync(join(accountDir, row.transcriptPath));
  const mediaExists = existsSync(join(mediaDir, `${row.videoId}.mp4`));
  return transcriptExists || mediaExists;
}).slice(0, limit);

for (const selectedRow of selected) {
  const index = manifest.videos.findIndex((row) => row.videoId === selectedRow.videoId);
  const videoPath = join(mediaDir, `${selectedRow.videoId}.mp4`);
  const audioPath = videoPath.replace(/\.mp4$/i, ".wav");
  const transcriptPath = join(transcriptDir, `${selectedRow.videoId}.json`);
  let row = manifest.videos[index];
  try {
    if (row.status === "discovered" || (row.status === "failed" && row.lastSuccessfulStage !== "transcribed")) {
      row = transitionVideo(row, "downloaded");
    }
    if (row.status === "downloaded") {
      const command = extname(transcriber) === ".mjs" ? process.execPath : python;
      if (!command) throw new Error("未配置本地 Python: 使用 --python 或 GUANDAN_DOUYIN_PYTHON");
      const commandArgs = extname(transcriber) === ".mjs"
        ? [transcriber, "--input", videoPath, "--output", transcriptPath]
        : [transcriber, "--input", videoPath, "--output", transcriptPath, "--model", model, "--device", "cpu", "--compute-type", "int8"];
      execFileSync(command, commandArgs, { stdio: "pipe", env: { ...process.env, HF_HOME: join(projectRoot, ".cache", "huggingface") } });
      const generated = JSON.parse(readFileSync(transcriptPath, "utf8"));
      generated.source = { accountId, videoId: row.videoId, url: row.url, title: row.title };
      atomicWriteJson(transcriptPath, generated);
      row = transitionVideo(row, "transcribed", { transcriptPath: `transcripts/${row.videoId}.json`,
        contentHash: createHash("sha256").update(readFileSync(videoPath)).digest("hex") });
    }
    const transcript = JSON.parse(readFileSync(join(accountDir, row.transcriptPath), "utf8"));
    const candidates = extractCandidates(row, transcript);
    const knowledgePath = join(accountDir, "knowledge.jsonl");
    const doctrinePath = join(accountDir, "doctrine-candidates.jsonl");
    writeJsonl(knowledgePath, [...readJsonl(knowledgePath), ...candidates]);
    writeJsonl(doctrinePath, [...readJsonl(doctrinePath), ...candidates]);
    row = transitionVideo(row, "extracted", { knowledgeIds: candidates.map((item) => item.id), error: null });
    rmSync(videoPath, { force: true }); rmSync(audioPath, { force: true });
  } catch (error) {
    if (row.status !== "failed") row = transitionVideo(row, "failed", { error: { category: "processing", message: sanitize(error) } });
    const failuresPath = join(accountDir, "failures.jsonl");
    writeJsonl(failuresPath, [...readJsonl(failuresPath), { id: `${row.videoId}:${row.retries}`, videoId: row.videoId,
      at: new Date().toISOString(), message: sanitize(error) }]);
  }
  manifest.videos[index] = row; atomicWriteJson(manifestPath, manifest);
}
console.log(JSON.stringify({ accountId, selected: selected.length }));
```

Create `tools/douyin/report.mjs`:

```js
#!/usr/bin/env node
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteJson } from "../lib/douyin-manifest.mjs";
function arg(args, name, fallback = null) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; }
export function buildReport(manifest) {
  const report = { declared: manifest.source.declaredWorkCount, observed: manifest.videos.length,
    discovered: 0, downloaded: 0, transcribed: 0, extracted: 0, reviewed: 0, blocked: 0, failed: 0 };
  for (const row of manifest.videos) if (Object.hasOwn(report, row.status)) report[row.status] += 1;
  report.missingFromDeclared = Math.max(0, report.declared - report.observed); return report;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const accountId = arg(process.argv, "--account");
  const root = arg(process.argv, "--root", join(dirname(fileURLToPath(import.meta.url)), "../.."));
  if (!accountId) throw new Error("用法: --account <id> [--root <project-root>]");
  const accountDir = join(root, "training-samples", "sources", "douyin", accountId);
  const report = buildReport(JSON.parse(readFileSync(join(accountDir, "manifest.json"), "utf8")));
  atomicWriteJson(join(accountDir, "reports", "latest.json"), report);
  const md = ["# 抖音知识采集报告", "", ...Object.entries(report).map(([key, value]) => `- ${key}: ${value}`), ""].join("\n");
  const mdPath = join(accountDir, "reports", "latest.md");
  mkdirSync(dirname(mdPath), { recursive: true });
  const mdTemp = `${mdPath}.tmp-${process.pid}`; writeFileSync(mdTemp, md, "utf8"); renameSync(mdTemp, mdPath);
  console.log(JSON.stringify(report));
}
```

Add package scripts:

```json
"data:douyin:manifest": "node tools/douyin/import-manifest.mjs",
"data:douyin:run": "node tools/douyin/process-account.mjs",
"data:douyin:report": "node tools/douyin/report.mjs",
"test:douyin": "node tests/douyin-manifest-smoke.mjs && node tests/douyin-transcriber-contract.mjs && node tests/douyin-knowledge-smoke.mjs && node tests/douyin-pipeline-smoke.mjs"
```

- [ ] **Step 4: Run all Douyin smoke tests twice**

Run: `npm.cmd run test:douyin && npm.cmd run test:douyin`

Expected: both runs pass; the second run confirms resume/deduplication behavior.

- [ ] **Step 5: Commit Task 5**

```powershell
git add package.json tools/douyin/process-account.mjs tools/douyin/report.mjs tests/fixtures/douyin-mock-transcriber.mjs tests/douyin-pipeline-smoke.mjs
git commit -m "feat(data): orchestrate resumable Douyin ingestion"
```

---

### Task 6: Real Account Data, Local Environment, and Pilot

**Files:**
- Create: `training-samples/sources/douyin/74480108075/source.json`
- Generate: `training-samples/sources/douyin/74480108075/manifest.json`
- Create: `docs/DOUYIN-KNOWLEDGE-RUNBOOK.md`

**Interfaces:**
- Consumes: browser-observed temporary manifest and one browser-assisted local MP4.
- Produces: normalized 306-entry manifest, one real transcript, knowledge candidates, and progress report.

- [ ] **Step 1: Write source provenance**

```json
{
  "schemaVersion": 1,
  "platform": "douyin",
  "accountId": "74480108075",
  "displayName": "掼蛋教父",
  "profileUrl": "https://www.douyin.com/user/MS4wLjABAAAATsLdpkhBjN2ytHaJV5pmxHiMsBU1WOfNJPI1s_MTlPOUH14zt-T2FbIwQFxWI6mi",
  "declaredWorkCount": 325,
  "observedVideoCount": 306,
  "capturedAt": "2026-07-14",
  "acquisition": "browser-assisted-public-page"
}
```

- [ ] **Step 2: Import the real observed manifest**

Run:

```powershell
npm.cmd run data:douyin:manifest -- --account 74480108075 --input "C:\Users\PC\AppData\Local\Temp\douyin-74480108075-observed-manifest.json"
npm.cmd run data:douyin:report -- --account 74480108075
```

Expected: report shows `declared: 325`, `observed: 306`, and `missingFromDeclared: 19`.

- [ ] **Step 3: Create the local Python environment and install pinned dependencies**

Run:

```powershell
& 'C:\Users\PC\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m venv .venv-douyin
& '.\.venv-douyin\Scripts\python.exe' -m pip install -r tools\douyin\requirements.txt
$env:GUANDAN_DOUYIN_PYTHON=(Resolve-Path '.\.venv-douyin\Scripts\python.exe').Path
node tests\douyin-transcriber-contract.mjs
```

Expected: dependencies install and the contract test passes. PyPI currently lists `faster-whisper 1.2.1` and `imageio-ffmpeg 0.6.0` for Python 3.9+.

- [ ] **Step 4: Acquire and process one public pilot video**

Use the signed-in Chrome page for video `7660454136994975018`, obtain only the currently playable public media, and place it at `.cache/douyin/incoming/7660454136994975018.mp4` without persisting its signed URL. Then run:

```powershell
npm.cmd run data:douyin:run -- --account 74480108075 --media-dir .cache\douyin\incoming --limit 1 --resume --python .\.venv-douyin\Scripts\python.exe
npm.cmd run data:douyin:report -- --account 74480108075
```

Expected: transcript exists, at least one pending knowledge candidate references the video and timestamp, status is `extracted`, and the input MP4/WAV no longer exists.

- [ ] **Step 5: Write the runbook**

Create `docs/DOUYIN-KNOWLEDGE-RUNBOOK.md` with this complete operating contract:

````markdown
# 抖音掼蛋知识采集运行手册

## 范围

只处理当前登录用户可正常播放的公开视频。浏览器辅助步骤不得导出 Cookie、验证码、浏览器配置或短期签名媒体 URL；遇到限制时将作品标记为 `blocked`。

## 首次安装

```powershell
& 'C:\Users\PC\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m venv .venv-douyin
& '.\.venv-douyin\Scripts\python.exe' -m pip install -r tools\douyin\requirements.txt
$env:GUANDAN_DOUYIN_PYTHON=(Resolve-Path '.\.venv-douyin\Scripts\python.exe').Path
npm.cmd run test:douyin
```

## 更新清单

Codex 从已登录 Chrome 的目标主页读取可见作品并导出临时 JSON，然后运行：

```powershell
npm.cmd run data:douyin:manifest -- --account 74480108075 --input <observed-manifest.json>
```

## 处理媒体

Codex 只把当前公开可播放的视频写到 `.cache\douyin\incoming\<videoId>.mp4`，不保存短期媒体 URL。默认模型为 `small`、中文、CPU `int8`：

```powershell
npm.cmd run data:douyin:run -- --account 74480108075 --media-dir .cache\douyin\incoming --limit 1 --resume --python .\.venv-douyin\Scripts\python.exe
npm.cmd run data:douyin:report -- --account 74480108075
```

成功条目删除 MP4/WAV；失败条目保留媒体并记录在 `failures.jsonl`。重复运行只处理未完成条目。

## 审核和晋升

`doctrine-candidates.jsonl` 中所有条目默认 `reviewStatus: pending`。审查时核对原视频时间段、现有书籍教义和实战案例；营销内容、口号、重复内容和证据不足的主张应驳回。任何候选进入 `strategy/` 前必须建立 doctrine ticket、增加回归测试并通过 `npm.cmd run test:gate`。

## 故障恢复

- `failed`：修复本地依赖或媒体后使用 `--resume` 重试。
- `blocked`：平台限制或作品不可访问，不自动重试、不规避。
- 模型或 Python 缺失：重新执行首次安装并运行转写器契约测试。
- 未清理缓存：仅删除已经处于 `extracted`/`reviewed` 的视频目录；失败条目的媒体应保留。
````

- [ ] **Step 6: Commit real manifest, pilot transcript, candidates, report, and runbook**

```powershell
git add training-samples/sources/douyin/74480108075 docs/DOUYIN-KNOWLEDGE-RUNBOOK.md
git commit -m "data: seed Douyin Guandan knowledge source"
```

---

### Task 7: Final Verification

**Files:**
- Modify only files required by failures discovered in this task.

**Interfaces:**
- Consumes: completed implementation from Tasks 1–6.
- Produces: passing targeted tests, passing release gate, and an audit summary.

- [ ] **Step 1: Run focused tests**

Run: `npm.cmd run test:douyin`

Expected: all four Douyin smoke suites pass.

- [ ] **Step 2: Verify data and cache invariants**

Run:

```powershell
npm.cmd run data:douyin:report -- --account 74480108075
Get-ChildItem -Recurse .cache\douyin -ErrorAction SilentlyContinue | Select-Object FullName,Length
```

Expected: declared/observed counts are 325/306, the pilot is extracted, 19 are reported as unavailable difference, and no successful pilot media remains.

- [ ] **Step 3: Run repository gate**

Run: `npm.cmd run test:gate`

Expected: exit code 0 and strategy audit violation count 0.

- [ ] **Step 4: Review the final diff and commit any verification-only fixes**

```powershell
git diff --check
git status --short
```

If a verification fix was required, stage only the files changed for that fix and commit with `fix(data): harden Douyin ingestion verification`. If no fix was required, do not create an empty commit.
