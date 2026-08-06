/**
 * 例1～50 场景 Top1 golden 总门禁（百例前半关门）
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const batches = [
  "1-5", "6-10", "8-12", "11-15", "14-16-17", "18-22", "23-27",
  "28-32", "33-37", "38-42", "43-47", "48-52",
];

for (const batch of batches) {
  const script = path.join(root, "tests", `case-scenario-top1-${batch}.mjs`);
  const result = spawnSync(process.execPath, [script], { stdio: "inherit", cwd: root });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("PASS 例1～50 全批次场景 Top1 golden 关门");
