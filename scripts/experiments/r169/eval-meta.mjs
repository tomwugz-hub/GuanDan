/**
 * Eval-only metadata for arena raw dumps: GD_* env capture and policy load manifests.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sharedSearchManifest } from './search-beam-manifest.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const EVAL_META_ROOT = path.resolve(HERE, '../../..');

const IMPORT_RE = /from\s+['"](\.\.?\/[^'"]+)['"]/g;

/** Snapshot files use policy-style `../engine/...` paths (relative to policy/), not backups/<name>/. */
function resolveImport(snapshotFile, spec, snapshotDir, policyLayoutDir) {
  if (spec.startsWith('./')) {
    const p = path.normalize(path.join(snapshotDir, spec));
    if (!p.startsWith(snapshotDir)) return null;
    return p;
  }
  if (spec.startsWith('../')) {
    return path.normalize(path.join(policyLayoutDir, spec));
  }
  return null;
}

function readImports(file) {
  const out = [];
  const txt = fs.readFileSync(file, 'utf8');
  for (const m of txt.matchAll(IMPORT_RE)) out.push(m[1]);
  return out;
}

function jsFilesClosure(snapshotDir) {
  const policyLayoutDir = path.join(EVAL_META_ROOT, 'policy');
  const snapFiles = new Set();
  for (const f of fs.readdirSync(snapshotDir)) {
    if (f.endsWith('.js') && f !== 'search-index.js') snapFiles.add(path.join(snapshotDir, f));
  }
  const repoDeps = new Set();
  const q = [...snapFiles];
  while (q.length) {
    const file = q.pop();
    for (const spec of readImports(file)) {
      const target = resolveImport(file, spec, snapshotDir, policyLayoutDir);
      if (!target || !target.endsWith('.js')) continue;
      if (!fs.existsSync(target)) continue;
      if (target.startsWith(snapshotDir)) {
        if (!snapFiles.has(target)) {
          snapFiles.add(target);
          q.push(target);
        }
      } else if (target.startsWith(EVAL_META_ROOT)) {
        repoDeps.add(target);
      }
    }
  }
  return { snapFiles: [...snapFiles].sort(), repoDeps: [...repoDeps].sort() };
}

function hashPaths(paths, label) {
  const perFile = {};
  const roll = crypto.createHash('sha256');
  for (const p of paths) {
    const rel = path.relative(EVAL_META_ROOT, p);
    const buf = fs.readFileSync(p);
    const h = crypto.createHash('sha256').update(buf).digest('hex');
    perFile[rel] = h;
    roll.update(`${rel}\0${h}\0`);
  }
  roll.update(`\nlabel:${label}\n`);
  return { sha256: roll.digest('hex'), files: perFile };
}

/**
 * Hash flat snapshot .js plus static import closure (engine/search/belief/ml/meta/…).
 * Limitation: decide@backup still uses live `policy/tribute.js` + `play/core.js` (not hashed here).
 */
export function policySourceManifest(name = 'current') {
  const snapshotDir = name === 'current' ? path.join(EVAL_META_ROOT, 'policy') : path.join(EVAL_META_ROOT, 'backups', name);
  if (!fs.existsSync(path.join(snapshotDir, 'index.js'))) {
    return { name, dir: null, sha256: null, snapshot: {}, repoDeps: {}, limitations: ['missing index.js'] };
  }
  const { snapFiles, repoDeps } = jsFilesClosure(snapshotDir);
  const snapshot = hashPaths(snapFiles, 'snapshot');
  const deps = hashPaths(repoDeps, 'repoDeps');
  const roll = crypto.createHash('sha256');
  roll.update(snapshot.sha256);
  roll.update(deps.sha256);
  return {
    name,
    dir: path.relative(EVAL_META_ROOT, snapshotDir),
    sha256: roll.digest('hex'),
    snapshot: snapshot.files,
    repoDeps: deps.files,
    limitations: [
      'decide@backup seats: tribute/returnCard and play/core.js resolve from repo HEAD (excluded)',
      'dynamic import() and worker-only paths not scanned',
    ],
  };
}

export function collectGdEnv(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([k]) => k.startsWith('GD_')).sort(([a], [b]) => a.localeCompare(b)));
}

export function policySpecBackupName(spec0 = 'current') {
  const x = spec0.split('#')[0];
  if (x === 'current') return 'current';
  if (['random', 'greedy', 'jev', 'startlux'].includes(x)) return null;
  return x;
}

function readVersionsStamp(name) {
  if (name === 'current') return null;
  try {
    return fs.readFileSync(path.join(EVAL_META_ROOT, 'selfplay', '.versions', name, '.stamp'), 'utf8');
  } catch {
    return null;
  }
}

export function buildArenaDumpMeta({ a, b, deals, seed0, tribute, matchLen, threads, ckpt, fingerprint, wallMs, env = process.env }) {
  const gd = collectGdEnv(env);
  const aName = policySpecBackupName(a);
  const bName = policySpecBackupName(b);
  return {
    a,
    b,
    deals,
    seed0,
    tribute,
    matchLen,
    threads: threads ?? null,
    ckpt: ckpt || null,
    fingerprint,
    wallMs: wallMs ?? null,
    node: process.version,
    pid: process.pid,
    policySource: {
      ...(aName ? { a: policySourceManifest(aName) } : {}),
      ...(bName ? { b: policySourceManifest(bName) } : {}),
    },
    versionsStamp: {
      ...(aName && aName !== 'current' ? { a: readVersionsStamp(aName) } : {}),
      ...(bName && bName !== 'current' ? { b: readVersionsStamp(bName) } : {}),
    },
    env: gd,
    sharedSearch: sharedSearchManifest(),
  };
}
