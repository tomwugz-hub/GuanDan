# Douyin Candidate Strategy Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the corrected evidence for Douyin video `7660454136994975018` into deterministic, reviewable candidate-strategy artifacts without modifying production strategy or source evidence.

**Architecture:** A pure library validates a structured human-confirmed correction review and converts its evidence-bound interpretations into stable candidate rules. A narrow CLI loads one account/video, verifies immutable inputs, writes atomic JSON/Markdown artifacts, and never edits transcript, knowledge, doctrine, manifest, or `strategy/`.

**Tech Stack:** Node.js ESM, built-in `node:crypto` and `node:fs`, JSON/Markdown durable artifacts, existing `npm.cmd` test workflow.

## Global Constraints

- Preserve raw transcript and evidence text; corrections live in a separate review file.
- Every output candidate uses `status: "needs-validation"` and `sourceCount: 1`.
- A single corrected video cannot exceed `medium-low` confidence in this pilot.
- Inferences must retain uncertainty language and include exceptions, risks, and a test scenario.
- Do not edit `strategy/`, formal doctrine, transcript, knowledge, doctrine candidates, or manifest state.
- Repeated runs with identical semantic input produce identical candidate IDs and content; only audit timestamps may vary.
- Reject non-numeric account/video IDs, non-canonical source URLs, invalid evidence times, and path traversal.
- Preserve unrelated dirty-worktree changes and stage only task-owned paths.

---

### Task 1: Evidence-Bound Candidate Strategy Library

**Files:**
- Create: `tools/lib/douyin-candidate-strategy.mjs`
- Create: `tests/douyin-candidate-strategy-smoke.mjs`

**Interfaces:**
- Consumes: `refineCandidateStrategies({ video, transcript, knowledge, correctionReview, generatedAt })` input object.
- Produces: `{ schemaVersion, generatedAt, accountId, videoId, source, candidates }` where every candidate has stable ID, trigger, inference, action, applicability, exceptions, risks, confidence, evidence, correction, and testScenario.

- [ ] **Step 1: Write the failing pure-library test**

Create a fixture inline with one valid canonical video, two raw transcript fragments, one overlapping pending knowledge row, one confirmed correction, and one structured interpretation. Assert:

```js
const artifact = refineCandidateStrategies({
  video,
  transcript,
  knowledge,
  correctionReview,
  generatedAt: "2026-07-14T10:00:00.000Z",
});
assert.equal(artifact.candidates[0].status, "needs-validation");
assert.equal(artifact.candidates[0].confidence.level, "medium-low");
assert.equal(artifact.candidates[0].confidence.sourceCount, 1);
assert.equal(artifact.candidates[0].evidence.rawText, "下甲起手出三个9代对杀");
assert.equal(artifact.candidates[0].correction.correctedText, "下家起手出三个9带对3");
assert.match(artifact.candidates[0].inference, /可能|大概率|弱信号/u);
assert.ok(artifact.candidates[0].exceptions.length > 0);
assert.ok(artifact.candidates[0].risks.length > 0);
assert.deepEqual(
  refineCandidateStrategies({ video, transcript, knowledge, correctionReview, generatedAt: "later" })
    .candidates.map(({ id }) => id),
  artifact.candidates.map(({ id }) => id),
);
```

Also assert rejection for `confidence.level: "high"`, missing exceptions, missing test scenario, certainty-only inference, invalid evidence time, unconfirmed correction, canonical URL mismatch, and account/video mismatch.

- [ ] **Step 2: Run the test to verify RED**

Run: `node tests/douyin-candidate-strategy-smoke.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `tools/lib/douyin-candidate-strategy.mjs`.

- [ ] **Step 3: Implement validation and deterministic refinement**

Implement the exact exports `validateCorrectionReview(review, { accountId, videoId })` and `refineCandidateStrategies({ video, transcript, knowledge, correctionReview, generatedAt = new Date().toISOString() })`. The validator returns a normalized deep clone or throws before producing output. The refiner returns the artifact shape defined in **Interfaces**.

Use `sha256(videoId + "\0" + interpretation.key + "\0" + trigger + "\0" + inference)` truncated to 16 lowercase hex characters for stable IDs. Reconstruct each correction's `rawText` by concatenating transcript segments fully contained in its `[start, end]` range, require at least one overlapping pending knowledge row, clone all output data, and cap confidence to the exact enum `low | medium-low`. Validate uncertainty with `/可能|大概率|弱信号|待验证|倾向/u` and reject any interpretation lacking non-empty `exceptions`, `risks`, or `{ given, when, then }` strings.

- [ ] **Step 4: Run the test to verify GREEN**

Run: `node tests/douyin-candidate-strategy-smoke.mjs`

Expected: `抖音候选策略提炼测试通过` and exit 0.

- [ ] **Step 5: Commit Task 1**

```powershell
git add -- tools/lib/douyin-candidate-strategy.mjs tests/douyin-candidate-strategy-smoke.mjs
git diff --cached --check
git commit -m "feat(data): refine evidence-bound Douyin strategies"
```

---

### Task 2: Safe Single-Video Refinement CLI

**Files:**
- Create: `tools/douyin/refine-candidate.mjs`
- Create: `tests/douyin-candidate-cli-smoke.mjs`
- Modify: `package.json` only for `data:douyin:refine` and the two new focused tests in `test:douyin`

**Interfaces:**
- Consumes: `--account <digits> --video <digits> [--root <project-root>] [--generated-at <ISO>]` and the source-root review/transcript/knowledge/manifest files.
- Produces: atomic `strategy-candidates/<videoId>.json` and `.md`; stdout summary `{ accountId, videoId, candidateCount, outputJson, outputMarkdown }`.

- [ ] **Step 1: Write the failing CLI integration test**

Build a temporary account tree containing a minimal manifest, transcript, pending knowledge JSONL, and confirmed review. Hash every immutable input before execution. Run the CLI twice with fixed `--generated-at`, then assert:

```js
assert.equal(first.status, 0, first.stderr);
assert.deepEqual(readJson(outputJson), readJson(outputJsonAfterSecondRun));
assert.match(readFileSync(outputMarkdown, "utf8"), /needs-validation/u);
assert.deepEqual(hashInputs(), hashesBefore, "refinement must not rewrite source evidence");
assert.equal(existsSync(join(temp, "strategy")), false);
```

Add failing invocations for `--account ..`, `--video ../x`, mismatched manifest identity, missing correction file, and an output symlink/path that resolves outside the account directory where supported.

- [ ] **Step 2: Run the CLI test to verify RED**

Run: `node tests/douyin-candidate-cli-smoke.mjs`

Expected: FAIL because `tools/douyin/refine-candidate.mjs` does not exist.

- [ ] **Step 3: Implement the CLI and atomic outputs**

Parse only the documented flags; require numeric account/video IDs before constructing paths. Read:

```text
manifest.json
transcripts/<videoId>.json
knowledge.jsonl
reviews/<videoId>.corrections.json
```

Select exactly one canonical manifest row, call `refineCandidateStrategies`, and write JSON plus a Markdown table containing candidate ID, trigger, inference, action, confidence, evidence time, exceptions, risks, and test scenario. Use a sibling temporary file followed by `renameSync`; clean the temporary file on error. Snapshot the SHA-256 of manifest/transcript/knowledge/doctrine candidates before refinement and verify the hashes are unchanged before returning success.

- [ ] **Step 4: Add package scripts without staging unrelated package changes**

Add:

```json
"data:douyin:refine": "node tools/douyin/refine-candidate.mjs"
```

Append `node tests/douyin-candidate-strategy-smoke.mjs && node tests/douyin-candidate-cli-smoke.mjs` to `test:douyin`. Because `package.json` already contains unrelated user changes, create and stage an index-only patch containing only these script edits.

- [ ] **Step 5: Run focused and aggregate tests**

Run:

```powershell
node tests/douyin-candidate-strategy-smoke.mjs
node tests/douyin-candidate-cli-smoke.mjs
$env:GUANDAN_DOUYIN_PYTHON=(Resolve-Path '.\.venv-douyin\Scripts\python.exe').Path
npm.cmd run test:douyin
```

Expected: both focused messages and all Douyin suites pass with exit 0.

- [ ] **Step 6: Commit Task 2**

Stage the two new files and the exact package-script patch only, run `git diff --cached --check`, then commit:

```powershell
git commit -m "feat(data): run safe Douyin strategy refinement"
```

---

### Task 3: Confirmed Pilot Review, Real Run, and Audit

**Files:**
- Create: `training-samples/sources/douyin/74480108075/reviews/7660454136994975018.corrections.json`
- Generate: `training-samples/sources/douyin/74480108075/strategy-candidates/7660454136994975018.json`
- Generate: `training-samples/sources/douyin/74480108075/strategy-candidates/7660454136994975018.md`
- Modify: `docs/DOUYIN-KNOWLEDGE-RUNBOOK.md`

**Interfaces:**
- Consumes: the five user-confirmed corrections and five evidence-bound interpretations in the approved design.
- Produces: one durable review and five `needs-validation` candidate strategies, or fewer only when a documented validation rule rejects one.

- [ ] **Step 1: Create the confirmed correction review**

Write schema version 1, the exact account/video identity, `confirmedBy: "user"`, ISO `confirmedAt`, and five correction entries with evidence ranges `4.16-12.12`, `12.12-17.80`, `18.44-28.12`, `28.12-32.92`, and `32.92-37.12`. Add five interpretations using the approved wording. Every inference must remain probabilistic; every entry must include at least two exceptions/risks and a concrete `{ given, when, then }` scenario.

- [ ] **Step 2: Run the real pilot**

Run:

```powershell
npm.cmd run data:douyin:refine -- --account 74480108075 --video 7660454136994975018
```

Expected stdout: account/video identity and `candidateCount: 5`. Inspect both generated artifacts as UTF-8.

- [ ] **Step 3: Audit the real artifacts**

Assert with a read-only PowerShell check:

```powershell
$a=Get-Content 'training-samples\sources\douyin\74480108075\strategy-candidates\7660454136994975018.json' -Raw -Encoding UTF8 | ConvertFrom-Json
if ($a.candidates.Count -ne 5) { throw 'expected five pilot candidates' }
if (@($a.candidates | Where-Object { $_.status -ne 'needs-validation' -or $_.confidence.sourceCount -ne 1 }).Count) { throw 'unsafe promotion state' }
```

Verify `git status --short -- strategy` is empty and compare committed/source hashes to prove transcript, knowledge, doctrine candidates, and manifest were not rewritten.

- [ ] **Step 4: Document the repeatable workflow**

Add the refine command, correction-review requirement, output paths, confidence ceiling, human correction procedure, and the explicit “no production strategy modification” boundary to `docs/DOUYIN-KNOWLEDGE-RUNBOOK.md`.

- [ ] **Step 5: Run final verification**

Run focused tests, `npm.cmd run test:douyin`, artifact audit, and `git diff --check`. Request an independent code/data review and fix every Critical or Important finding. Full `test:gate` is not required because this pilot does not modify executable strategy; run it only if review finds cross-layer impact.

- [ ] **Step 6: Commit Task 3**

```powershell
git add -- training-samples/sources/douyin/74480108075/reviews/7660454136994975018.corrections.json training-samples/sources/douyin/74480108075/strategy-candidates/7660454136994975018.json training-samples/sources/douyin/74480108075/strategy-candidates/7660454136994975018.md docs/DOUYIN-KNOWLEDGE-RUNBOOK.md
git diff --cached --check
git commit -m "data: refine first Douyin strategy candidates"
```
