import { readFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function resolveArg(arg, fallback) {
  const value = arg ?? fallback;
  return isAbsolute(value) ? value : join(root, value);
}

const modelDir = resolveArg(process.argv[3], "models/policy-v001");
const modelPath = join(modelDir, "model.json");
const metricsPath = join(modelDir, "metrics.json");
const rowsPath = resolveArg(process.argv[2], "datasets/v1/rows.jsonl");
const minTop1 = Number(process.argv[4] ?? process.env.GUANDAN_ML_MIN_TOP1 ?? "0.55");

if (!existsSync(modelPath)) {
  console.error(JSON.stringify({ ok: false, error: "model.json 不存在", modelPath }));
  process.exit(1);
}

const baseline = existsSync(metricsPath)
  ? JSON.parse(readFileSync(metricsPath, "utf8"))
  : null;
const threshold = Math.max(minTop1, baseline?.rowTop1?.top1 ? baseline.rowTop1.top1 * 0.92 : minTop1);

const evalOut = execSync(
  `node tools/eval-policy.mjs "${rowsPath}" "${modelPath}"`,
  { cwd: root, encoding: "utf8" },
);
const evalResult = JSON.parse(evalOut.trim());
const top1 = evalResult.top1Accuracy ?? 0;
const passed = top1 >= threshold;

const report = {
  ok: passed,
  passed,
  top1Accuracy: top1,
  threshold,
  baselineTop1: baseline?.rowTop1?.top1 ?? null,
  evaluatedRows: evalResult.evaluatedRows,
  model: modelPath,
  rows: rowsPath,
};

console.log(JSON.stringify(report, null, 2));
process.exit(passed ? 0 : 1);
