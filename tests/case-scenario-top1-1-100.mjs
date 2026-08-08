/**
 * 例1～100 场景 Top1 golden 总门禁（百例全书关门；例85/88 跳过）
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

for (const script of [
  "case-scenario-top1-1-50.mjs",
  "case-scenario-top1-51-100.mjs",
]) {
  const result = spawnSync(process.execPath, [path.join(root, "tests", script)], {
    stdio: "inherit",
    cwd: root,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("PASS 例1～100 全书场景 Top1 golden 关门");
