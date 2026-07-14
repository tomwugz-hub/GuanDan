#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  atomicWriteJson,
  mergeManifest,
  normalizeObservedManifest,
} from "../lib/douyin-manifest.mjs";

function optionValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const result = args[index + 1];
  return result && !result.startsWith("--") ? result : null;
}

const args = process.argv.slice(2);
const accountId = optionValue(args, "--account");
const inputPath = optionValue(args, "--input");
const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const projectRoot = optionValue(args, "--root", defaultRoot);

if (!accountId || !inputPath || !projectRoot) {
  throw new Error("用法: --account <id> --input <observed.json> [--root <project-root>]");
}

const input = JSON.parse(readFileSync(inputPath, "utf8"));
if (String(input?.source?.accountId ?? "") !== accountId) {
  throw new Error("输入清单账号与 --account 不匹配");
}

const output = join(
  projectRoot,
  "training-samples",
  "sources",
  "douyin",
  accountId,
  "manifest.json",
);
const observed = normalizeObservedManifest(input);
const merged = existsSync(output)
  ? mergeManifest(JSON.parse(readFileSync(output, "utf8")), observed)
  : observed;

atomicWriteJson(output, merged);
console.log(
  JSON.stringify({
    accountId,
    observed: observed.videos.length,
    total: merged.videos.length,
    output,
  }),
);
