#!/usr/bin/env node
/**
 * Summarize per-decision searchBeamWork from arena --dump-raw (no re-run).
 *   node arena-raw-beam-stats.mjs path1.json [path2.json ...]
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  flattenRawDecisions,
} from './beam-work-record.mjs';

function actionFingerprint(decisions) {
  if (!decisions.length) {
    return { error: 'empty_decisions', sha256: null };
  }
  const lines = decisions.map((d) => JSON.stringify({
    id: d.id, move: d.moveStr, tags: d.tags, hand: d.hand, prev: d.prevStr2, nCands: d.nCands,
  })).sort();
  return { error: null, sha256: createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex'), n: decisions.length };
}

function summarizeFile(path) {
  const payload = JSON.parse(readFileSync(path, 'utf8'));
  const decisions = flattenRawDecisions(payload);
  const afp = actionFingerprint(decisions);
  const withField = decisions.filter((d) => d.searchBeamWork != null);
  const collected = decisions.filter((d) => d.searchBeamWork?.collected === true);
  const wallCut = collected.filter((d) => d.searchBeamWork.wallCutoff);
  const nodeCut = collected.filter((d) => d.searchBeamWork.nodeCutoff);
  const fixed = collected.filter((d) => d.searchBeamWork.budgetMode === 'fixedNodes');
  const incompleteCap = fixed.filter((d) => {
    const w = d.searchBeamWork;
    return w.scoredN != null && w.rootLegalN != null && w.scoredN < w.rootLegalN;
  });
  const legacy = decisions.length > 0 && withField.length === 0;
  const shaSet = new Set(collected.map((d) => d.searchBeamWork.searchModuleSha256).filter(Boolean));
  return {
    path,
    metaFingerprint: payload.meta?.fingerprint ?? null,
    decisionN: decisions.length,
    actionFingerprint: afp,
    telemetry: {
      legacyDumpMissingSearchBeamWork: legacy,
      rowsWithSearchBeamWork: withField.length,
      beamCollectedN: collected.length,
      wallCutoffN: wallCut.length,
      nodeCutoffN: nodeCut.length,
      incompleteRootScoringN: incompleteCap.length,
      searchModuleSha256: [...shaSet],
    },
    strictEnvelopeNoWallCutoff: legacy ? null : wallCut.length === 0,
  };
}

const paths = process.argv.slice(2).filter((p) => !p.startsWith('--'));
if (!paths.length) {
  console.error('usage: node arena-raw-beam-stats.mjs <arena-raw.json> [...]');
  process.exit(1);
}
const report = { files: paths.map(summarizeFile) };
console.log(JSON.stringify(report, null, 2));
const bad = report.files.some((f) => f.actionFingerprint.error || f.telemetry.legacyDumpMissingSearchBeamWork);
process.exit(bad ? 2 : 0);
