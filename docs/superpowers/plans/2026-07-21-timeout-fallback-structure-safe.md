# Timeout Fallback Structure Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent expired-deadline robot fallback from breaking strategic groups by leading the lowest single while preserving constant-time behavior and all existing hard invariants.

**Architecture:** Keep the small single/same-rank fallback candidate builder. Add a lead-only selection stage in `coach/robot-player.mjs` that derives lightweight strategic groups, filters structure-breaking singles, then prefers a safe single or whole non-bomb group; must-beat behavior is unchanged.

**Tech Stack:** Node.js ESM, standalone `.mjs` goldens, existing strategic-group and robot audit helpers.

## Global Constraints

- Do not modify Automations.
- Do not broaden the fix to general `pass-with-regular-beat`.
- Do not call the full recommendation path from the timeout fallback.
- Preserve zero `split-bomb`, `beat-partner`, and `twp-level-kicker` counts.

---

### Task 1: Deterministic timeout-fallback goldens

**Files:**
- Create: `tests/timeout-fallback-structure-safe-lead.mjs`
- Modify: `tests/smoke.mjs`

**Interfaces:**
- Consumes: `playRecommendedTurn(state, { deadline })` and `auditRobotStructurePlay(...)`.
- Produces: deterministic assertions that expired-deadline lead/catch-wind Top1 does not produce `split-structure-single`.

- [ ] **Step 1:** Reproduce seed 42000 through turn 34 using the same PRNG and past-deadline options as lite audit; assert the audited play has no `split-structure-single`.
- [ ] **Step 2:** Add a compact constructed lead hand whose lowest single belongs to a protected group and whose alternative is a loose single or whole same-rank group.
- [ ] **Step 3:** Run `node tests/timeout-fallback-structure-safe-lead.mjs`; expect FAIL showing `split-structure-single` before production changes.

### Task 2: Fallback-specific safe lead selection

**Files:**
- Modify: `coach/robot-player.mjs`

**Interfaces:**
- Consumes: constant-time candidates, `buildStrategicGroups`, and `breaksPreferredStrategicGroup`.
- Produces: a legal hard-invariant-safe candidate selected without full candidate enumeration.

- [ ] **Step 1:** For lead/catch-wind only, derive strategic groups with `{ skipStraightFlush: true }`.
- [ ] **Step 2:** Partition hard-safe candidates into structure-safe singles, whole non-bomb groups, and last-resort candidates.
- [ ] **Step 3:** Return the lowest structure-safe single when available, otherwise the shortest whole non-bomb group, otherwise the existing legal fallback.
- [ ] **Step 4:** Run the new golden and existing hard-invariant tests; expect PASS.

### Task 3: Regression and 20-game comparison

**Files:**
- Runtime output: `training-samples/audit-strategy-lite-latest.json`

**Interfaces:**
- Consumes: fixed timeout fallback.
- Produces: before/after `violationsByCode` evidence.

- [ ] **Step 1:** Run `node tests/timeout-fallback-structure-safe-lead.mjs`, `node tests/hard-invariants-golden.mjs`, and `npm.cmd run discover:robot`.
- [ ] **Step 2:** Run `node tests/smoke.mjs`.
- [ ] **Step 3:** Run `node tools/audit-strategy.mjs 20 42000 2 600 --lite` and compare against baseline `split-structure-single: 59`, with all three hard-invariant codes remaining zero.
