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
git apply /path/to/scripts/experiments/r169/patches/gd-handplan-no-wallclock-baseline-c77f3f7.patch
mkdir -p backups/r169-baseline-c77-nw
cp -a policy/. backups/r169-baseline-c77-nw/
```

Point **candidate** checkout at the same path (or symlink `backups/r169-baseline-c77-nw` into the candidate repo). Verify: `test -f backups/r169-baseline-c77-nw/index.js`.

## Serial validation command

From **candidate** tree (r169 branch, uncommitted ok):

```bash
export GD_R95=5 GD_ENDGAME_NO_WALLCLOCK=1 GD_HANDPLAN_NO_WALLCLOCK=1
export OLD_BASELINE_NAME=r169-baseline-c77-nw
export BASELINE_SNAPSHOT=r169-baseline-c77-nw   # for smoke-r169.sh parity
bash scripts/experiments/r169/validate-no-wallclock.sh
```

Optional **flag bits** battery (candidate only; old side ignores): `RUN_BITS=1 bash scripts/experiments/r169/validate-no-wallclock.sh`.

## Reading arena lines (pairedStats): mean vs CI bootstrap

- **Sample mean** (“A 每副净升级” / net level-up per deal) is a **deterministic function** of the finite set of per-deal outcomes for that run — **bootstrap resampling only moves the bracketed CI**, not the point estimate. If RUN1 and RUN2 report **different** means for the **same** command, that is **not** “CI randomness”; it is either **different inputs** (e.g. different code / env / incomplete log) or **true repeatability failure** in the code path that produces those outcomes.
- **Same-policy self** (A and B name the same `decide@backup`) is **not** a Δ=0 gate: seating / tribute pairing makes **finite-deal** mean team points **not guaranteed** to be exactly 0 even when policies are identical — distinguish **population / design asymmetry** from **engine replay drift**.
- **`pool.mjs` checkpoint key truncation** only matters when **`--ckpt`** is used. A **`--threads=1` run without `--ckpt`** does not exercise that path; do not attribute RUN1 vs RUN2 mean drift to ckpt collisions without a ckpt-enabled repro.
- **Eval-only replay (real `decide`, not greedy)** — each `--runs` repeat is a **fresh Node child process** (`isolateRuns`, default on) so `selfplay/lib.mjs` module caches cannot alias two runs; SHA256 over `|[team0,team1]|` per deal:  
  `GD_R95=5 GD_ENDGAME_NO_WALLCLOCK=1 node scripts/experiments/r169/replay-match-hashes.mjs --spec=decide --matchSeed=26991000 --deals=512 --runs=2`  
  Same-process A/B compare: `--isolateRuns=0` (debug only).
- **Arena `pairedStats` vs single `playMatch`**: 进贡模式下 arena 按 **matchLen** 连成多场再 **换座位配对** 汇总；**一行摘要哈希 ≠ 单条 playMatch 哈希**。要验 **同一命令** 重复是否逐副一致，用下面 **raw dump**。
- **Arena raw trace (actual evaluation path)** — `selfplay/arena.mjs` now supports `--collect=1 --dump-raw=<file.json>` (forces `collect` + `--threads` passed through to `runTasks`). Two identical commands should yield the same **`meta.fingerprint`** over sorted `(matchSeed|cfg|dealIdx|points|order)`. Wrapper:  
  `bash scripts/experiments/r169/arena-repeat-dump.sh` (env `A_SPEC`/`B_SPEC`/`PRE` for candidate `GD_R169=0`).  
  Compare: `node scripts/experiments/r169/compare-arena-raw.mjs run1.json run2.json`.
- **`versionCache` (loadDecide)**: hypothesis for **parent process** prefetch before workers — still **prove with arena trace**, not only `playMatch`.
- **Hand-plan wall-clocks (demonstrated)**: `policy/handplan.js` uses **`Date.now()`** in **`decompose`** (25ms move-loop cap) and **`decomposeCounts`** (30ms soft cap alongside node cap). Under CPU load, time checks can fire **before** the search finishes examining moves → **different decomposition / lead scoring** → different play trajectories. Local raw evidence: first differing deal key **`26991018|arenaA0|0`** (`compare-26991000-d512.json` in attachment). **Eval:** `GD_HANDPLAN_NO_WALLCLOCK=1` disables **only** those `Date.now` guards; default unset preserves production heuristics.
- **Calling `dealFourHands()` with no deck** is not shown on the arena path used here: `play/core.js` passes `dealFourHands(shuffle(makeDeck(), g.rng))`. Treat “remove default shuffle” as **guard-only** unless a trace shows the no-arg call on that path.

## Known nondeterminism blockers (if delta ≠ 0)

1. **Arena worker scheduling**: mitigated with **`--threads=1`** (script sets this).
2. **World subsampling when worlds > maxWorlds**: PRNG from hand is deterministic per position but **subset still stochastic** if policy differs before subsample (b0 should not).
3. **Node budget throw**: heavy positions return `null` from `solveEndgame`; if timing changed which worlds complete before throw, results differ — **`GD_ENDGAME_NO_WALLCLOCK` removes wall-clock leg only**.

Do **not** toggle extra flags on one side without the other; document pairs in logs.

## Artifacts (this repo / CI)

- Baseline-only patch: **`scripts/experiments/r169/patches/gd-endgame-no-wallclock-baseline-c77f3f7.patch`** (copy also at **`/opt/cursor/artifacts/gd-endgame-no-wallclock-baseline-c77f3f7.patch`**)
- Baseline-only handplan eval gate: **`scripts/experiments/r169/patches/gd-handplan-no-wallclock-baseline-c77f3f7.patch`**
- Full candidate vs `guandan-coach`: **`/opt/cursor/artifacts/gd-r169-full.patch`** (regenerate: `git format-patch $(git merge-base origin/guandan-coach HEAD)..HEAD --stdout`)
- **Net validitypack → eval HEAD** (see PR / agent notes): **`/opt/cursor/artifacts/gd-r169-net-60137f1-to-8943eef.patch`** — use `git diff 60137f1..HEAD` style, not full `merge-base..HEAD` series, when parent already has r169 trunk.
