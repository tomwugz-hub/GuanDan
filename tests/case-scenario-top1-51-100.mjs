/**
 * 例51～100 场景 Top1 golden 总门禁（百例后半关门；例85/88 书中无独立战例跳过）
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const batches = [
  "48-52", "53-57", "58-62", "63-67", "68-72", "73-77", "78-82",
  "83-87", "88-92", "93-97", "98-100",
];

for (const batch of batches) {
  const script = path.join(root, "tests", `case-scenario-top1-${batch}.mjs`);
  const result = spawnSync(process.execPath, [script], { stdio: "inherit", cwd: root });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("PASS 例51～100 全批次场景 Top1 golden 关门");
