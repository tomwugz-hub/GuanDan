#!/usr/bin/env node
/** 打包：dist/guandan-play/（静态网页 + 可选服务器）并压缩为 dist/guandan-play.zip。需要 esbuild（ESBUILD 环境变量或 npx）。 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, cpSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'dist/guandan-play');
const esb = process.env.ESBUILD || 'esbuild';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
execFileSync(esb, [resolve(ROOT, 'play/ui.js'), '--bundle', '--format=iife', '--target=es2019', '--charset=utf8', `--outfile=${resolve(OUT, 'guandan.bundle.js')}`], { stdio: 'inherit' });
cpSync(resolve(ROOT, 'play/index.html'), resolve(OUT, 'index.html'));
cpSync(resolve(ROOT, 'play/style.css'), resolve(OUT, 'style.css'));
cpSync(resolve(ROOT, 'play/manifest.json'), resolve(OUT, 'manifest.json'));
cpSync(resolve(ROOT, 'play/icons'), resolve(OUT, 'icons'), { recursive: true });
{
  const h = createHash('md5');
  for (const f of ['guandan.bundle.js', 'index.html', 'style.css', 'manifest.json']) h.update(readFileSync(resolve(OUT, f)));
  const id = h.digest('hex').slice(0, 10);
  writeFileSync(resolve(OUT, 'sw.js'), readFileSync(resolve(ROOT, 'play/sw.js'), 'utf8').replace('__BUILD__', id));
  // r19：导出记录头部带 build（缓存名）；在算完哈希后写入，缓存名不变
  const { withBuildAttr } = await import('./core.js');
  writeFileSync(resolve(OUT, 'index.html'), withBuildAttr(readFileSync(resolve(OUT, 'index.html'), 'utf8'), `guandan-play-${id}`));
}
cpSync(resolve(ROOT, 'play/README.md'), resolve(OUT, 'README.md'));
for (const d of ['engine', 'policy', 'search', 'belief', 'meta', 'ml']) cpSync(resolve(ROOT, d), resolve(OUT, 'src', d), { recursive: true });
mkdirSync(resolve(OUT, 'src/play'), { recursive: true });
for (const f of ['core.js', 'jevbridge.mjs', 'server.mjs', 'smoke.mjs']) cpSync(resolve(ROOT, 'play', f), resolve(OUT, 'src/play', f));
writeFileSync(resolve(OUT, 'server.mjs'), `// 启动：node server.mjs  → http://localhost:8787\nimport { dirname } from 'node:path';\nimport { fileURLToPath } from 'node:url';\nglobalThis.__GD_STATIC_ROOT = dirname(fileURLToPath(import.meta.url));\nawait import('./src/play/server.mjs');\n`);
writeFileSync(resolve(OUT, 'package.json'), JSON.stringify({ name: 'guandan-play', version: '1.0.0', private: true, type: 'module', description: '掼蛋教练 四人对局', scripts: { start: 'node server.mjs', smoke: 'node src/play/smoke.mjs' } }, null, 2) + '\n');
// 纯静态网页版（用于发布到 HTTPS 静态托管）：不含 server.mjs、jevbridge、src、评测数据
const WEB = resolve(ROOT, 'dist/guandan-play-web');
rmSync(WEB, { recursive: true, force: true });
mkdirSync(WEB, { recursive: true });
for (const f of ['index.html', 'style.css', 'guandan.bundle.js', 'manifest.json', 'sw.js']) cpSync(resolve(OUT, f), resolve(WEB, f));
cpSync(resolve(OUT, 'icons'), resolve(WEB, 'icons'), { recursive: true });
writeFileSync(resolve(WEB, '.nojekyll'), '');
const zip = resolve(ROOT, 'dist/guandan-play.zip');
if (existsSync(zip)) rmSync(zip);
execFileSync('python3', ['-m', 'zipfile', '-c', zip, 'guandan-play'], { cwd: resolve(ROOT, 'dist'), stdio: 'inherit' });
console.log('built', OUT, zip);
