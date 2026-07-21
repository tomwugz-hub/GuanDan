# Audit Metrics Split and 400ms Performance Report

## Scope

Change only the audit CLI, audit metric helpers, report contracts, and tests. Do not modify `strategy/`, Automations, hard invariants, or `ROBOT_WALL_BUDGET_MS`.

## Modes

- `--lite`: deterministic structure-safety gate. Its default `turnBudgetMs` remains `0`, so every turn deliberately enters the constant-time fallback.
- `--perf`: performance diagnostic. Its default `turnBudgetMs` is `400`, matching the effective production robot wall budget. It writes `training-samples/audit-strategy-perf-latest.json`.
- Full audit remains the only `release-gate` report and continues to write/read `training-samples/audit-strategy-latest.json`.

## Metrics

- `totalTurns`: total audited plays.
- `forcedFallbackCount`: turns deliberately sent to an already-expired deadline. This is not a real timeout.
- `actualDeadlineExceededCount`: non-forced turns whose `playRecommendedTurn` call returned after the audit deadline.
- `fallbackPathCounts.constant`: deliberately expired calls and recommendations carrying the constant-time fallback reasons.
- `fallbackPathCounts.fast`: recommendations carrying robot fast-fallback reasons.
- `fallbackPathCounts.normal`: recommendations returned by the normal robot recommendation path.
- `elapsedMs`: nearest-rank `p50`, `p95`, `p99`, and `max` over `playRecommendedTurn` wall-clock durations.

Remove `timeoutFallbackCount` from lite/perf reports so deliberately forced fallbacks cannot be mislabeled as real timeouts. For 0ms lite, `forcedFallbackCount === totalTurns` and `actualDeadlineExceededCount === 0`.

## Measurement boundaries

The timer covers only `playRecommendedTurn`; audit-context construction and violation scanning are excluded. A forced 0ms turn is never counted as an actual deadline exceedance. In perf mode, completion and the three hard-invariant codes determine diagnostic `ok`; ordinary strategy findings remain report data.

## Tests

- Extend the lite contract test to assert the split fields, equality between forced fallbacks and total turns, and absence of `timeoutFallbackCount`.
- Add a perf contract test for default/explicit budget parsing, independent report path, zero forced fallbacks, path-count totals, elapsed percentiles, and release-gate path isolation.
- Run 20-game lite and 20-game perf reports. Do not recommend increasing 400ms unless perf p95 or the actual deadline-exceeded ratio is materially high.
