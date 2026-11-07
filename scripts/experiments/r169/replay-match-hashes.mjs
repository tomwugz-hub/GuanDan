#!/usr/bin/env node
/**
 * Eval-only: replay tribute match(es) with real policy (`decide` path), hash the per-deal team points vector.
 * Does NOT use arena.mjs / workers — isolates engine+policy stream from pool scheduling / ckpt.
 *
 * Usage (repo root):
 *   GD_R95=5 GD_ENDGAME_NO_WALLCLOCK=1 node scripts/experiments/r169/replay-match-hashes.mjs \
 *     --spec=decide --matchSeed=26991000 --deals=512 --runs=2
 *
 * Compare two policies (same env; set GD_R169 etc. before invoking):
 *   node scripts/experiments/r169/replay-match-hashes.mjs --specA=decide --specB=decide@r169-baseline-c77-nw ...
 *
 * **Process isolation:** repeated `--runs>1` for the *same* spec uses a **fresh Node child per run**
 * (`--isolateRuns=1`, default). Two `playMatch` calls in one process can share mutable module caches
 * in `selfplay/lib.mjs` (`versionCache` / dynamic imports) and look falsely nondeterministic.
 * Use `--isolateRuns=0` only for debugging.
 */
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { playMatch, makeAgent } from '../../../selfplay/lib.mjs';

const SCRIPT = fileURLToPath(import.meta.url);

const args = Object.fromEntries(process.argv.slice(2).map((s) => {
  const m = s.replace(/^--/, '').match(/^([^=]+)=(.*)$/s);
  return m ? [m[1], m[2]] : [s.replace(/^--/, ''), '1'];
}));

// Use decide for current policy (same as arena 'current' → decide); backups: decide@<backupName>
const specA = (args.specA || args.spec || 'decide').replace(/^current$/, 'decide');
const specB = (args.specB || args.spec || 'decide').replace(/^current$/, 'decide');
const matchSeed = Number(args.matchSeed || 26991000);
const deals = Number(args.deals || 8);
const runs = Number(args.runs || 2);
const emitJson = args.emitJson === '1' || args.emitJson === 'true';
const isolateRuns = args.isolateRuns !== '0' && args.isolateRuns !== 'false';

function pointsFingerprint(pts) {
  const pipe = pts.map((p) => `${p[0]},${p[1]}`).join('|');
  return { pipe, sha256: crypto.createHash('sha256').update(pipe, 'utf8').digest('hex') };
}

async function runOnce(label, spec) {
  const specs = [spec, spec, spec, spec];
  const agents = await Promise.all(specs.map((s, i) => makeAgent(s, matchSeed * 97 + i)));
  const rows = playMatch(matchSeed, agents, { deals });
  const pts = rows.map((r) => r.points);
  const fp = pointsFingerprint(pts);
  return { label, pts, ...fp, rows: rows.length };
}

function runChild(spec) {
  const r = spawnSync(
    process.execPath,
    [SCRIPT, `--spec=${spec}`, `--matchSeed=${matchSeed}`, `--deals=${deals}`, '--runs=1', '--emitJson=1', '--isolateRuns=0'],
    { encoding: 'utf8', env: process.env, maxBuffer: 64 * 1024 * 1024 },
  );
  if (r.status !== 0) {
    throw new Error(`child replay failed: status=${r.status}\n${r.stderr || ''}${r.stdout || ''}`);
  }
  const line = (r.stdout || '').trim().split('\n').filter(Boolean).pop();
  const o = JSON.parse(line);
  return { pts: o.pts, sha256: o.sha256, rows: o.rows };
}

async function main() {
  if (emitJson) {
    const spec = specA;
    const o = await runOnce('emit', spec);
    process.stdout.write(`${JSON.stringify({ sha256: o.sha256, rows: o.rows, pts: o.pts })}\n`);
    return;
  }
  if (specA !== specB) {
    const a = isolateRuns
      ? (() => { const x = runChild(specA); const fp = pointsFingerprint(x.pts); return { spec: specA, pts: x.pts, sha256: x.sha256, pipe: fp.pipe, rows: x.rows }; })()
      : await runOnce('A', specA);
    const b = isolateRuns
      ? (() => { const x = runChild(specB); const fp = pointsFingerprint(x.pts); return { spec: specB, pts: x.pts, sha256: x.sha256, pipe: fp.pipe, rows: x.rows }; })()
      : await runOnce('B', specB);
    console.log(JSON.stringify({
      matchSeed,
      deals,
      isolateRuns,
      A: { spec: specA, sha256: a.sha256, pipe_len: a.pipe.length },
      B: { spec: specB, sha256: b.sha256, pipe_len: b.pipe.length },
      same: a.sha256 === b.sha256,
    }, null, 2));
    if (a.pipe !== b.pipe) {
      for (let i = 0; i < Math.max(a.pts.length, b.pts.length); i++) {
        const pa = a.pts[i], pb = b.pts[i];
        if (!pa || !pb || pa[0] !== pb[0] || pa[1] !== pb[1]) {
          console.log(`first_pts_diff_deal_idx=${i}`, pa, pb);
          break;
        }
      }
    }
    return;
  }
  const runsOut = [];
  const useIsolate = isolateRuns && runs > 1;
  for (let r = 1; r <= runs; r++) {
    let o;
    if (useIsolate) {
      const x = runChild(specA);
      const fp = pointsFingerprint(x.pts);
      o = { label: `run${r}`, pts: x.pts, sha256: x.sha256, pipe: fp.pipe, rows: x.rows };
    } else {
      o = await runOnce(`run${r}`, specA);
    }
    runsOut.push(o);
    console.log(`run${r} deals=${o.rows} sha256=${o.sha256}`);
  }
  const hashes = runsOut.map((o) => o.sha256);
  const allSame = hashes.every((h) => h === hashes[0]);
  console.log(JSON.stringify({ matchSeed, deals, spec: specA, runs, isolateRuns, replay_identical: allSame, sha256_runs: hashes }, null, 2));
  if (!allSame && runsOut.length >= 2) {
    const o1 = runsOut[0];
    const o2 = runsOut[1];
    for (let i = 0; i < Math.min(o1.pts.length, o2.pts.length); i++) {
      if (o1.pts[i][0] !== o2.pts[i][0] || o1.pts[i][1] !== o2.pts[i][1]) {
        console.log(`first_repeat_diff_deal_idx=${i}`, o1.pts[i], o2.pts[i]);
        break;
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
