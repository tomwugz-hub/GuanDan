#!/usr/bin/env node
/** 百例全书场景候选校验（1～50 + 51～100，例85/88 无场景） */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const node = process.execPath;
const validator = join(root, "tools/validate-case-scenarios.mjs");

for (const file of [
  "training-samples/cases/case-scenarios-1-50.json",
  "training-samples/cases/case-scenarios-51-100.json",
]) {
  execFileSync(node, [validator, join(root, file)], { cwd: root, stdio: "inherit" });
}

console.log("PASS 百例场景候选校验（50 + 49）");
