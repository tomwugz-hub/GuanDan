# Hard Invariants Unification Design

## Scope

Unify three non-negotiable robot-play rules across the normal doctrine path and every early-return path:

- `beat-partner`: do not overtake a partner when the existing partner-yield policy says to yield.
- `twp-level-kicker`: do not use a pair of level-rank cards as the kicker of a triple-with-pair.
- `split-bomb`: do not break an existing bomb unless the play empties the hand.

The four enforcement sites are robot quick recommendations, deadline recommendations, coach robot fallback, and doctrine enforcement.

## Design

Add `strategy/hard-invariants.mjs` as the single source of truth. It exports a candidate-level detector and:

```js
filterHardInvariants(candidates, hand, levelRank, ctx)
```

The filter keeps Pass, evaluates active plays with the same context used by recommendation scoring, and removes candidates that carry any hard-invariant code. Whole-hand finishes are exempt from `split-bomb`; partner overtaking is blocked only when the established robot partner-yield predicate applies, preserving legitimate defensive intervention.

Every early-return selector filters its candidate pool before choosing Top1. Doctrine enforcement invokes the same filter/detector so the full scoring path cannot drift from quick or fallback behavior. Timeline auditing reuses the detector and reconstructs partner ownership from `tableBefore.lastActivePlayerIndex`.

## Verification

Add golden coverage for each invariant and exercise normal, robot quick, deadline, and coach fallback paths. Run targeted goldens first, then `node tests/smoke.mjs`, `npm.cmd run discover:robot`, and the 100-game strategy audit. The audit report must show zero `split-bomb` and `beat-partner` violations.

## Data audit caveat

`training-samples/coach-questions-latest.json` is currently malformed and the discovery tool silently treats parse failure as an empty timeline. Report this as an audit limitation; do not edit training data as part of this task.
