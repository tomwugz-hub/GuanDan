#!/usr/bin/env node
/**
 * 32-deal serial arena ×2 under unified strict eval envelope (old-old + cur@flag0).
 *   node scripts/experiments/r169/tiny-paired-control.mjs [--seed0=26991000]
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprintDeals } from '../../../selfplay/arena.mjs';
import { STRICT_EVAL_FULL, strictEnvelopeRecord, applyStrictEvalEnvelope } from './eval-strict-envelope.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = Object.fromEntries(process.argv.slice(2).map((s) => {
  const m = s.replace(/^--/, '').match(/^([^=]+)=(.*)$/s);
  return m ? [m[1], m[2]] : [s.replace(/^--/, ''), '1'];
}));

const SEED0 = Number(args.seed0 ?? 26991000);
const DEALS = 32;
const MATCH_LEN = 8;
const OUTDIR = args.outdir || path.join(ROOT, 'selfplay/logs/r169-tiny-strict-envelope');
mkdirSync(OUTDIR, { recursive: true });

const configs = [
  { tag: 'old-old', a: 'r169-cap2-base', b: 'r169-cap2-base' },
  { tag: 'cur-flag0', a: 'r169-cap2-current', b: 'r169-cap2-base' },
];

function envClean() {
  const base = { ...process.env, ...STRICT_EVAL_FULL, GD_EVAL_BEAM_WORK_TRACE: '1' };
  const clean = {
    HOME: base.HOME, PATH: base.PATH, LANG: base.LANG || 'C.UTF-8', TZ: base.TZ || '', USER: base.USER || '',
    ...Object.fromEntries(Object.entries(base).filter(([k]) => k.startsWith('GD_'))),
  };
  return clean;
}

function runArena(tag, cfg, run) {
  const raw = path.join(OUTDIR, `arena-${cfg.tag}-${tag}-s${SEED0}-d${DEALS}.json`);
  const r = spawnSync(process.execPath, [
    path.join(ROOT, 'selfplay/arena.mjs'),
    `--a=${cfg.a}`, `--b=${cfg.b}`, `--deals=${DEALS}`, `--seed0=${SEED0}`,
    '--tribute', `--matchLen=${MATCH_LEN}`, '--threads=1', '--collect=1', `--dump-raw=${raw}`,
  ], { env: envClean(), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`arena ${cfg.tag} ${tag}: ${r.stderr || r.stdout}`);
  return JSON.parse(readFileSync(raw, 'utf8'));
}

function actionFingerprintLine(d) {
  return JSON.stringify({
    id: d.id, move: d.moveStr, tags: d.tags, hand: d.hand, prev: d.prevStr2, nCands: d.nCands,
  });
}

function globalActionFp(payload) {
  const lines = payload.rawWorkers.flatMap((w) => w.decisions || []).map(actionFingerprintLine).sort();
  return createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex');
}

async function main() {
  applyStrictEvalEnvelope();
  const report = { seed0: SEED0, deals: DEALS, envelope: strictEnvelopeRecord(process.env), pairs: [] };
  for (const cfg of configs) {
    const r1 = runArena('run1', cfg, 1);
    const r2 = runArena('run2', cfg, 2);
    const fp1 = fingerprintDeals(r1.deals);
    const fp2 = fingerprintDeals(r2.deals);
    const afp1 = await globalActionFp(r1);
    const afp2 = await globalActionFp(r2);
    const metaOk = r1.meta?.env && JSON.stringify(r1.meta.env) === JSON.stringify(r2.meta.env);
    report.pairs.push({
      config: cfg.tag,
      a: cfg.a,
      b: cfg.b,
      dealFp: { run1: fp1, run2: fp2, same: fp1 === fp2 },
      actionFp: { run1: afp1, run2: afp2, same: afp1 === afp2 },
      metaEnvSame: metaOk,
      sharedSearch: r1.meta?.sharedSearch,
      wallMs: { run1: r1.meta?.wallMs, run2: r2.meta?.wallMs },
    });
  }
  const out = path.join(OUTDIR, `tiny-paired-${SEED0}-d${DEALS}.json`);
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  const allSame = report.pairs.every((p) => p.dealFp.same && p.actionFp.same);
  process.exit(allSame ? 0 : 2);
}

main().catch((e) => { console.error(e); process.exit(1); });
