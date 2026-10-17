#!/usr/bin/env node
/**
 * 百例场景 JSON 结构校验 + 对应 case-NNN.json 存在性（发布门禁轻量版）。
 * 用法：node tools/validate-case-scenarios.mjs training-samples/cases/case-scenarios-1-50.json
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scenarioPath = process.argv[2];
if (!scenarioPath) {
  console.error("用法: node tools/validate-case-scenarios.mjs <case-scenarios.json>");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scenarios = JSON.parse(readFileSync(scenarioPath, "utf8"));
if (!Array.isArray(scenarios)) {
  console.error("FAIL: 场景文件应为数组");
  process.exit(1);
}

let issues = 0;
for (const item of scenarios) {
  const n = item?.caseNumber;
  if (!Number.isFinite(n)) {
    issues += 1;
    console.error("FAIL: 缺少 caseNumber", item);
    continue;
  }
  if (!item.levelRank || !item.prefer?.type) {
    issues += 1;
    console.error(`FAIL: 例${n} 缺少 levelRank 或 prefer.type`);
  }
  const caseFile = join(root, "training-samples/cases", `case-${String(n).padStart(3, "0")}.json`);
  if (!existsSync(caseFile)) {
    issues += 1;
    console.error(`FAIL: 例${n} 缺少 ${caseFile}`);
  }
}

if (issues > 0) {
  console.error(`FAIL: ${issues} 处场景元数据问题`);
  process.exit(1);
}

console.log(`PASS validate-case-scenarios: ${scenarios.length} 条（${scenarioPath}）`);
