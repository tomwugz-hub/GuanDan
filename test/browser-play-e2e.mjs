#!/usr/bin/env node
/**
 * Build play bundle, serve dist/guandan-play-web, drive headless Chromium through ≥3 副（含进贡还贡）。
 * Prereq (dev/CI): npm install --no-save playwright esbuild && npx playwright install chromium
 */
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = resolve(ROOT, 'dist/guandan-play-web');

function build() {
  const esbuildLocal = resolve(ROOT, 'node_modules/.bin/esbuild');
  const env = { ...process.env };
  if (!env.ESBUILD && existsSync(esbuildLocal)) env.ESBUILD = esbuildLocal;
  const r = spawnSync('node', ['play/build.mjs'], { cwd: ROOT, stdio: 'inherit', env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    return null;
  }
}

function staticServer() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
  return createServer((req, res) => {
    const pathOnly = (req.url || '/').split('?')[0] || '/';
    const p = pathOnly === '/' ? '/index.html' : pathOnly;
    const file = resolve(WEB, '.' + p);
    let st;
    try { st = existsSync(file) ? statSync(file) : null; } catch { st = null; }
    if (!file.startsWith(WEB) || !st || st.isDirectory()) { res.writeHead(404); res.end(); return; }
    const ext = p.slice(p.lastIndexOf('.'));
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
}

async function main() {
  build();
  const pw = await loadPlaywright();
  if (!pw) {
    console.log('skip: playwright not installed (npm install --no-save playwright esbuild)');
    process.exit(0);
  }
  const server = staticServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/?seed=77`;

  const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept());

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.evaluate(() => { const s = document.getElementById('speed'); if (s) s.value = '250'; });

  const clickIf = async (sel) => {
    const el = page.locator(sel);
    if (await el.isVisible().catch(() => false) && await el.isEnabled().catch(() => false)) { await el.click(); return true; }
    return false;
  };

  let lastDeal = 1;
  const deadline = Date.now() + 240_000;
  for (let step = 0; Date.now() < deadline; step++) {
    if (errors.some((e) => /process is not defined/i.test(e))) break;

    if (await page.locator('#endModal:not(.hidden)').isVisible().catch(() => false)) {
      await clickIf('#btnNext');
      await page.waitForTimeout(200);
    }

    if (await page.locator('#tribPanel:not(.hidden)').isVisible().catch(() => false)) {
      const turnTxt = await page.locator('#turn').textContent();
      if (turnTxt?.includes('还贡')) {
        const elig = page.locator('#hand .card.elig').first();
        if (await elig.isVisible().catch(() => false)) await elig.click();
      }
      await clickIf('#tribOk');
    }

    const turn = await page.locator('#turn').textContent();
    if (turn?.includes('南')) {
      await clickIf('#btnHint');
      await page.waitForTimeout(40);
      const sel = await page.locator('#hand .card.sel').count();
      if (sel > 0) await page.locator('#btnPlay').click();
      else await page.locator('#btnPass').click();
    }

    const dealNo = Number(await page.locator('#dealNo').textContent());
    if (dealNo > lastDeal) lastDeal = dealNo;
    if (lastDeal >= 4) break;
    await page.waitForTimeout(25);
  }

  await browser.close();
  server.close();

  const procErr = errors.filter((e) => /process is not defined/i.test(e));
  if (procErr.length) {
    console.error('process ReferenceError in browser:', procErr[0]);
    process.exit(1);
  }
  if (lastDeal < 3) {
    console.error('expected ≥3 deals, got', lastDeal, 'other errors:', errors.slice(0, 2));
    process.exit(1);
  }
  console.log('browser e2e ok: deals through', lastDeal);
}

main().catch((e) => { console.error(e); process.exit(1); });