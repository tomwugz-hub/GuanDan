import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  featureNames,
  iterTrainingExamples,
  loadRows,
  playSignature,
  encodeRowCandidate,
  vectorize,
} from "../ml/feature-encoder.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function sigmoid(z) {
  if (z > 20) return 1;
  if (z < -20) return 0;
  return 1 / (1 + Math.exp(-z));
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i] * b[i];
  return s;
}

function trainLogistic(examples, names, { epochs = 30, lr = 0.08 } = {}) {
  const dim = names.length;
  const weights = new Array(dim).fill(0);
  let bias = 0;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (const ex of examples) {
      const z = dot(weights, ex.vector) + bias;
      const pred = sigmoid(z);
      const err = (pred - ex.label) * ex.weight;
      for (let i = 0; i < dim; i += 1) {
        weights[i] -= lr * err * ex.vector[i];
      }
      bias -= lr * err;
    }
  }

  return { weights, bias };
}

function predictProba(weights, bias, vector) {
  return sigmoid(dot(weights, vector) + bias);
}

function rowTop1Accuracy(rows, names, weights, bias) {
  let hits = 0;
  let total = 0;
  for (const row of rows) {
    const candidates = row.candidates ?? [];
    if (candidates.length < 2) continue;
    const labelSig = playSignature(row.label?.play);
    if (!labelSig) continue;
    let best = null;
    let bestScore = -Infinity;
    for (const cand of candidates) {
      const vec = vectorize(encodeRowCandidate(row, cand), names);
      const score = predictProba(weights, bias, vec);
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    if (playSignature(best?.play) === labelSig) hits += 1;
    total += 1;
  }
  return { top1: total ? hits / total : 0, rows: total };
}

function main() {
  const rowsPath = join(root, process.argv[2] ?? "datasets/v1/rows.jsonl");
  const outDir = join(root, process.argv[3] ?? "models/policy-v001");
  mkdirSync(outDir, { recursive: true });

  const rows = loadRows(rowsPath, { readFileSync });
  if (rows.length < 50) {
    console.error(`样本过少: ${rows.length} 行。请先 node tools/batch-auto-games.mjs 500`);
    process.exit(1);
  }

  const names = featureNames();
  const examples = [...iterTrainingExamples(rows)];
  if (examples.length < 100) {
    console.error(`候选展开过少: ${examples.length}`);
    process.exit(1);
  }

  const { weights, bias } = trainLogistic(examples, names);
  const rowMetrics = rowTop1Accuracy(rows, names, weights, bias);

  const exportModel = {
    version: 1,
    modelType: "logistic_regression_sgd",
    featureNames: names,
    weights,
    bias,
  };

  const metrics = {
    trainedAt: new Date().toISOString(),
    runtime: "node",
    rowsFile: rowsPath,
    rowCount: rows.length,
    exampleCount: examples.length,
    rowTop1: rowMetrics,
  };

  writeFileSync(join(outDir, "model.json"), JSON.stringify(exportModel, null, 2));
  writeFileSync(join(outDir, "metrics.json"), JSON.stringify(metrics, null, 2));
  writeFileSync(
    join(outDir, "feature_spec.json"),
    JSON.stringify({ version: 1, featureNames: names }, null, 2),
  );

  console.log(JSON.stringify({ ok: true, out: outDir, metrics }, null, 2));
}

main();
