# Timeout Fallback Structure Safety

## Scope

Task E only changes the expired-deadline/constant-time robot fallback used by lite audit and robot timeout handling. It does not change Automations, general recommendation scoring, `pass-with-regular-beat`, or the existing hard-invariant definitions.

## Root cause

`playRecommendedTurn` sends an already-expired deadline directly to `constantTimeRobotFallback`. That fallback builds only single/same-rank candidates, filters the existing hard invariants, then sorts non-bombs by power. On a lead or catch-wind turn this makes the lowest single Top1 even when that card belongs to a strategic pair, triple, straight, consecutive-pair, or plane group. `auditRobotStructurePlay` consequently reports `split-structure-single`.

## Design

Keep constant-time candidate construction. For lead/catch-wind selection, build lightweight strategic groups with straight-flush search skipped, reject single candidates for which `breaksPreferredStrategicGroup(...)` is true, and prefer a structure-safe single. If there is no safe single, prefer a whole non-bomb group candidate before considering a structure-breaking single. Every candidate still passes `filterHardInvariants`; the fallback must always make a legal lead and must not call the full recommendation path.

Must-beat selection remains unchanged except for the existing hard-invariant filtering. This prevents Task E from expanding into general `pass-with-regular-beat` behavior.

## Tests and acceptance

- Add a deterministic seed-42000 replay golden proving the pre-fix turn 34 lead is `split-structure-single` and the fixed fallback avoids it.
- Add a direct catch-wind/lead golden where the lowest card is structurally protected and a loose single or whole group is available.
- Run targeted tests and smoke.
- Re-run `node tools/audit-strategy.mjs 20 42000 2 600 --lite`.
- `split-structure-single` must fall substantially from the baseline 59, targeting near zero; `split-bomb`, `beat-partner`, and `twp-level-kicker` must remain zero.

## Considered alternatives

1. Extend `hard-invariants.mjs`: rejected because strategic structure is context-sensitive and should not become a universal prohibition.
2. Reuse the full opening recommendation picker: rejected because the timeout path must remain bounded and previously suffered multi-minute synchronous candidate enumeration.
3. Fallback-specific structure filtering: selected because it directly fixes the failing path with bounded work and narrow behavioral scope.
