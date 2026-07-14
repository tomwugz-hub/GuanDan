#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

if (process.env.DOUYIN_MOCK_FAIL === "1") {
  throw new Error("mock transcription failure https://cdn.example/video.mp4?token=secret");
}

const output = option("--output");
if (!option("--input") || !output) throw new Error("mock requires --input and --output");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(
  output,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      model: { name: "mock", device: "cpu", computeType: "int8" },
      language: "zh",
      durationSeconds: 4,
      segments: [
        {
          start: 0,
          end: 4,
          text: "炸弹不要见牌就打，要先判断对手是否报牌。",
          avgLogProb: -0.2,
        },
      ],
    },
    null,
    2,
  )}\n`,
  "utf8",
);
