#!/usr/bin/env node
/** Report both fixtures: wall-sensitive vs fixed-search stability. */
import { writeFileSync } from 'node:fs';
import { arenaSpec } from './arena-jobs.mjs';
import { sharedSearchManifest } from './search-beam-manifest.mjs';
import { buildFrozenBeamFixture, decideOnFrozenFixture } from './beam-fixture.mjs';

const a = 'r169-cap2-current';
const b = 'r169-cap2-base';
const specs = [arenaSpec(b), arenaSpec(a), arenaSpec(b), arenaSpec(a)];

async function main() {
  const base = { GD_R95: '5', GD_ENDGAME_NO_WALLCLOCK: '1', GD_HANDPLAN_NO_WALLCLOCK: '1', GD_R169: '0', GD_R170: '0', GD_EVAL_BEAM_WORK_TRACE: '1' };
  const bombTarget = { matchSeed: 26991027, cfg: 'arenaA1', dealIdx: 6, step: 16, seat: 0, specs };
  const fhTarget = { matchSeed: 26991017, cfg: 'arenaA1', dealIdx: 5, step: 29, seat: 1, specs };
  const bombFx = await buildFrozenBeamFixture({ target: bombTarget, warm: 'match', instrumentedVer: 'r169-cap2-base-instrumented', cardIdStart: 1 });
  const fhFx = await buildFrozenBeamFixture({ target: fhTarget, warm: 'match', instrumentedVer: 'r169-cap2-current-instrumented', cardIdStart: 1 });
  const pack = (row) => ({ best: row.trace?.final?.best, searchBeamWork: row.searchBeamWork, parity: row.parity, bestKey: row.bestKey });
  const out = {
    sharedSearch: sharedSearchManifest(),
    fixtures: { bomb: bombFx.fixture, fh: fhFx.fixture },
    bomb26991027: {
      wall1ms: pack(await decideOnFrozenFixture(bombFx, 'r169-cap2-base-instrumented', { envPatch: { ...base, GD_EVAL_BEAM_TIMEMS: '1' } })),
      fixed10_load: pack(await decideOnFrozenFixture(bombFx, 'r169-cap2-base-instrumented', {
        envPatch: { ...base, GD_EVAL_BEAM_TIMEMS: '1', GD_SEARCH_NO_WALLCLOCK: '1', GD_SEARCH_BEAM_FIXED_NODES: '10' },
      }, { cpuSpinMs: 50 })),
    },
    lead26991017: {
      wall1ms: pack(await decideOnFrozenFixture(fhFx, 'r169-cap2-current-instrumented', { envPatch: { ...base, GD_EVAL_BEAM_TIMEMS: '1' } })),
      fixed34: pack(await decideOnFrozenFixture(fhFx, 'r169-cap2-current-instrumented', {
        envPatch: { ...base, GD_EVAL_BEAM_TIMEMS: '1', GD_SEARCH_NO_WALLCLOCK: '1', GD_SEARCH_BEAM_FIXED_NODES: '34' },
      }, { cpuSpinMs: 50 })),
    },
    methodDeficiency: ['historic beam cutoff not logged in strict raw', 'handplan budget often null under NW=1'],
  };
  const p = '/opt/cursor/artifacts/r169-beam-fixed-regression.json';
  writeFileSync(p, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ path: p, bomb: out.bomb26991027, lead: out.lead26991017 }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
