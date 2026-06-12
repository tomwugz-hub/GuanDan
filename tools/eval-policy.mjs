import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRows, playSignature } from "../ml/feature-encoder.mjs";
import { pickTopCandidatePureMl } from "../strategy/ml-policy.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function resolveArg(arg, fallback) {
  const value = arg ?? fallback;
  return isAbsolute(value) ? value : join(root, value);
}

function main() {
  const rowsPath = resolveArg(process.argv[2], "datasets/v1/rows.jsonl");
  const modelPath = resolveArg(process.argv[3], "models/policy-v001/model.json");
  const model = JSON.parse(readFileSync(modelPath, "utf8"));
  const rows = loadRows(rowsPath, { readFileSync });

  let hits = 0;
  let total = 0;
  const byTier = {};

  for (const row of rows) {
    const candidates = row.candidates ?? [];
    if (candidates.length < 2) continue;
    const labelSig = playSignature(row.label?.play);
    if (!labelSig) continue;

    const best = pickTopCandidatePureMl(model, row);
    const ok = playSignature(best?.play) === labelSig;
    const tier = row.tier ?? "unknown";
    if (!byTier[tier]) byTier[tier] = { hits: 0, total: 0 };
    byTier[tier].total += 1;
    if (ok) byTier[tier].hits += 1;
    if (ok) hits += 1;
    total += 1;
  }

  console.log(JSON.stringify({
    ok: true,
    model: modelPath,
    top1Accuracy: total ? hits / total : 0,
    evaluatedRows: total,
    byTier: Object.fromEntries(
      Object.entries(byTier).map(([tier, val]) => [tier, {
        top1: val.total ? val.hits / val.total : 0,
        rows: val.total,
      }]),
    ),
  }, null, 2));
}

main();
