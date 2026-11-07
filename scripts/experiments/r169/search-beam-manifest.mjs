/** Eval: hash live search/index.js (transitive dep for all decide@backup). */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SEARCH = path.join(ROOT, 'search', 'index.js');

export function sharedSearchManifest() {
  const buf = fs.readFileSync(SEARCH);
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  return {
    path: 'search/index.js',
    sha256,
    evalGates: ['GD_SEARCH_NO_WALLCLOCK', 'GD_SEARCH_BEAM_FIXED_NODES', 'GD_EVAL_BEAM_TIMEMS', 'GD_EVAL_BEAM_WORK_TRACE'],
  };
}
