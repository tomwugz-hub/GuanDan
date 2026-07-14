import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const python = process.env.GUANDAN_DOUYIN_PYTHON;
if (!python) {
  console.log("跳过：未设置 GUANDAN_DOUYIN_PYTHON");
  process.exit(0);
}

const script = fileURLToPath(new URL("../tools/douyin/transcribe.py", import.meta.url));
const requirements = fileURLToPath(new URL("../tools/douyin/requirements.txt", import.meta.url));

const probe = JSON.parse(execFileSync(python, [script, "--probe"], { encoding: "utf8" }));
assert.equal(probe.schemaVersion, 1);
assert.match(probe.python, /^\d+\.\d+\.\d+/);

const help = execFileSync(python, [script, "--help"], { encoding: "utf8" });
for (const option of ["--probe", "--input", "--output", "--model", "--device", "--compute-type"]) {
  assert(help.includes(option), `help must document ${option}`);
}
for (const defaultValue of ["small", "cpu", "int8"]) {
  assert(help.includes(defaultValue), `help must show default ${defaultValue}`);
}

const missingArguments = spawnSync(python, [script], { encoding: "utf8" });
assert.notEqual(missingArguments.status, 0, "normal mode must reject missing input/output");
assert.match(missingArguments.stderr, /--input and --output are required/);

const missingInput = spawnSync(
  python,
  [script, "--input", "definitely-missing.mp4", "--output", "unused.json"],
  { encoding: "utf8" },
);
assert.notEqual(missingInput.status, 0, "normal mode must reject a missing input file");
assert.match(missingInput.stderr, /input video does not exist/i);
assert.doesNotMatch(missingInput.stderr, /ModuleNotFoundError|ImportError/);

execFileSync(
  python,
  ["-c", "import ast, pathlib, sys; ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))", script],
  { encoding: "utf8" },
);

assert.equal(
  readFileSync(requirements, "utf8"),
  "faster-whisper==1.2.1\nimageio-ffmpeg==0.6.0\n",
);

const source = readFileSync(script, "utf8");
assert.match(source, /audio\s*=\s*source\.parent\s*\/\s*["']audio\.wav["']/);
assert.doesNotMatch(source, /source\.wav/);
assert.match(source, /WhisperModel\(a\.model,\s*device=a\.device,\s*compute_type=a\.compute_type\)/);
assert.match(source, /language=["']zh["']/);
assert.match(source, /vad_filter=True/);
assert.match(source, /["']-ac["']\s*,\s*["']1["']/);
assert.match(source, /["']-ar["']\s*,\s*["']16000["']/);

console.log("本地转写器契约测试通过");
