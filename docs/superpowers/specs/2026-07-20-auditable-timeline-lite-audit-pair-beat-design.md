# Auditable Timeline, Lite Audit, and Pair-Beat Boundary

## Scope and order

Implement B′, then C′, then D. Preserve the existing hard-invariant module and do not broaden D into other `pass-with-regular-beat` cases.

## B′ — auditable robot timeline

Create a pure serializer helper that does not import or start `app/main.mjs`. The `robot-auto` record must retain only the audit snapshot needed here: `handBefore`, `mustBeat`, `tableBefore.lastActivePlayerIndex`, and the existing player/choice/play metadata. It must not retain full normal advice or the full candidate pool.

`app/main.mjs` delegates its `robot-auto` branch to the helper. A unit test constructs two robot timeline records and proves `scanTimelineRobotStructureViolations` detects `split-bomb` and `beat-partner`. The test joins smoke or the discovery-related suite.

## C′ — closable lite audit

Add an explicit lite audit mode. Its report must identify `mode: "lite"`, include the count of turns that exceeded the audit budget, and include top reproduction samples grouped by violation code. When the per-turn budget is exhausted, play advances through the existing hard-invariant-protected fallback; the audit must never bypass or disable hard invariants.

Lite reports are diagnostic reports and must not satisfy the pre-release full 100-game performance gate. The target command must complete 20 games and write a complete JSON report with `violationsByCode`. `pass-with-regular-beat` is report-only in this phase.

## D — pair K must be beaten by spare pair A

The only strategy change is the must-beat-pair boundary where an opponent plays pair K and the hand contains a spare physical pair A, but Top1 incorrectly becomes Pass. Capture `pairCtx` evidence before changing production code, retain the failing golden, and make the smallest selection-logic correction. Do not edit `strategy/hard-invariants.mjs` and do not fix other `pass-with-regular-beat` scenarios.

## Verification

Follow red-green TDD independently for B′, C′, and D. Run the targeted tests, discovery, smoke, and the 20-game lite audit. Report the exact commands, report path, mode, completed games, timeout/fallback count, `violationsByCode`, top reproductions, and the three hard-invariant counts.
