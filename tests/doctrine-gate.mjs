/**
 * 发布门禁教纲子集 — 与 doctrine-regression 同源（全量 93 场景）。
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const result = spawnSync(process.execPath, [join(root, "doctrine-regression.mjs")], {
  stdio: "inherit",
  cwd: join(root, ".."),
});
process.exit(result.status ?? 1);
