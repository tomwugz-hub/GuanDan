# Controlled validity (GD_ENDGAME_NO_WALLCLOCK)

## Why two patches

- **Baseline-only** (`scripts/experiments/r169/patches/gd-endgame-no-wallclock-baseline-c77f3f7.patch`): applies **only** to `policy/endgame.js` at **`guandan-coach` commit `c77f3f7`**. Old snapshot **does not** interpret `GD_ENDGAME_NO_WALLCLOCK` without this edit.
- **Candidate** already includes the same mechanism in current `policy/endgame.js` (plus r169 experiment if you use the full branch).

## Prepare isolated old baseline snapshot

`loadDecide(name)` reads **`backups/<name>/*.js`** (flat copy of `policy/`).  

```bash
git worktree add ../guandan-baseline-c77 c77f3f725204027964760a8097c77eaa90f31792
cd ../guandan-baseline-c77
git apply /path/to/scripts/experiments/r169/patches/gd-endgame-no-wallclock-baseline-c77f3f7.patch
mkdir -p backups/r169-baseline-c77-nw
cp -a policy/. backups/r169-baseline-c77-nw/
```

Point **candidate** checkout at the same path (or symlink `backups/r169-baseline-c77-nw` into the candidate repo). Verify: `test -f backups/r169-baseline-c77-nw/index.js`.

## Serial validation command

From **candidate** tree (r169 branch, uncommitted ok):

```bash
export GD_R95=5 GD_ENDGAME_NO_WALLCLOCK=1
export OLD_BASELINE_NAME=r169-baseline-c77-nw
export BASELINE_SNAPSHOT=r169-baseline-c77-nw   # for smoke-r169.sh parity
bash scripts/experiments/r169/validate-no-wallclock.sh
```

Optional **flag bits** battery (candidate only; old side ignores): `RUN_BITS=1 bash scripts/experiments/r169/validate-no-wallclock.sh`.

## What “Δ=0” means

- **Self pair** `oldbaseline vs oldbaseline`: must print **A 每副净升级 0.000** (identical policy).
- **GD_R169=0** candidate vs patched old baseline: **should** match if `endgame` + legacy gate path match; any non-zero delta indicates **remaining nondeterminism or code path drift** (not solved by one decide test).

## Known nondeterminism blockers (if delta ≠ 0)

1. **Arena worker scheduling**: mitigated with **`--threads=1`** (script sets this).
2. **World subsampling when worlds > maxWorlds**: PRNG from hand is deterministic per position but **subset still stochastic** if policy differs before subsample (b0 should not).
3. **Node budget throw**: heavy positions return `null` from `solveEndgame`; if timing changed which worlds complete before throw, results differ — **`GD_ENDGAME_NO_WALLCLOCK` removes wall-clock leg only**.

Do **not** toggle extra flags on one side without the other; document pairs in logs.

## Artifacts (this repo / CI)

- Baseline-only patch: **`scripts/experiments/r169/patches/gd-endgame-no-wallclock-baseline-c77f3f7.patch`** (copy also at **`/opt/cursor/artifacts/gd-endgame-no-wallclock-baseline-c77f3f7.patch`**)
- Full candidate vs `guandan-coach`: **`/opt/cursor/artifacts/gd-r169-full.patch`** (regenerate: `git format-patch $(git merge-base origin/guandan-coach HEAD)..HEAD --stdout`)
