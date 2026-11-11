/**
 * Captures 390x844 mobile screenshots for Fix Commit B:
 * 1. Pre-machining panel selector pills (under 56px, single line, horizontal scroll)
 * 2. Pre-machining drawing (centered, dynamic viewBox, non-overlapping labels, min font size >= 11px)
 * 3. Full-screen diagram modal (fitted to screen, non-truncated title, responsive 1:1 controls)
 */

import puppeteer from 'puppeteer-core';
import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

function findChromiumExecutable() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    '/snap/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error('No Chromium executable found.');
}

function checkServer(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/cadcat/`, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log('=== Capturing Fix Commit B Mobile Screenshots (390x844) ===\n');

  let targetPort = null;
  let serverProcess = null;

  if (await checkServer(4173)) {
    targetPort = 4173;
    console.log('✓ Found preview server on port 4173');
  } else if (await checkServer(5173)) {
    targetPort = 5173;
    console.log('✓ Found dev server on port 5173');
  } else {
    console.log('Starting preview server on port 4173...');
    serverProcess = spawn('npx', ['vite', 'preview', '--port', '4173'], {
      stdio: 'ignore',
      detached: false,
    });
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await checkServer(4173)) {
        targetPort = 4173;
        break;
      }
    }
    if (!targetPort) {
      if (serverProcess) serverProcess.kill();
      throw new Error('Failed to start Vite preview server.');
    }
    console.log('✓ Preview server started on port 4173');
  }

  const outDir = path.resolve('screenshots/fix-commit-b');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const chromiumPath = findChromiumExecutable();
  const browser = await puppeteer.launch({
    executablePath: chromiumPath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });
    await page.goto(`http://localhost:${targetPort}/cadcat/`, { waitUntil: 'networkidle0' });

    // Wait for catalogs
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando catálogos'), { timeout: 15000 });

    // Navigate to Armar tab
    const bottomNavs = await page.$$('.m3-bottom-nav__item');
    for (const item of bottomNavs) {
      const text = await page.evaluate((el) => el.innerText, item);
      if (text.includes('Armar')) {
        await item.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 600));

    // Select preset-drawer-unit-3
    await page.waitForSelector('#select-template', { timeout: 10000 });
    await page.select('#select-template', 'preset-drawer-unit-3');
    await new Promise((r) => setTimeout(r, 1200));

    // Open bottom sheet "Más..." and select "Guía de Armado"
    const moreBtn = await page.$('button[aria-label*="Más herramientas"]');
    if (moreBtn) {
      await moreBtn.click();
      await new Promise((r) => setTimeout(r, 400));
      await page.waitForSelector('.m3-bottom-sheet__item', { timeout: 5000 });
      const sheetItems = await page.$$('.m3-bottom-sheet__item');
      for (const item of sheetItems) {
        const text = await page.evaluate((el) => el.innerText, item);
        if (text.includes('Guía de Armado')) {
          await item.click();
          break;
        }
      }
    }
    await new Promise((r) => setTimeout(r, 1000));

    // Scroll to pre-machining section
    await page.waitForSelector('.assembly-panels-section', { timeout: 10000 });
    await page.evaluate(() => {
      const sec = document.querySelector('.assembly-panels-section');
      if (sec) sec.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise((r) => setTimeout(r, 600));

    // Screenshot 1: Panel Selector Pills & Header
    const shot1Path = path.join(outDir, '01_panel_selector_pills_390x844.png');
    await page.screenshot({ path: shot1Path });
    console.log(`✓ Saved Screenshot 1: ${shot1Path}`);

    // Scroll pre-machining drawing into full view
    await page.evaluate(() => {
      const dw = document.querySelector('.panel-detail-svg');
      if (dw) dw.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await new Promise((r) => setTimeout(r, 600));

    // Screenshot 2: Pre-machining Drawing
    const shot2Path = path.join(outDir, '02_pre_machining_drawing_390x844.png');
    await page.screenshot({ path: shot2Path });
    console.log(`✓ Saved Screenshot 2: ${shot2Path}`);

    // Click "Ampliar" button to open Fullscreen Modal
    const zoomBtn = await page.$('.assembly-diagram-zoom-btn');
    if (zoomBtn) {
      await zoomBtn.click();
      await new Promise((r) => setTimeout(r, 800));
    }

    // Screenshot 3: Fullscreen Modal (fitted to screen, responsive title & 1:1 button)
    const shot3Path = path.join(outDir, '03_fullscreen_modal_390x844.png');
    await page.screenshot({ path: shot3Path });
    console.log(`✓ Saved Screenshot 3: ${shot3Path}`);

    console.log('\n✓ All 3 mobile verification screenshots captured successfully!');
  } finally {
    await browser.close();
    if (serverProcess) {
      serverProcess.kill();
    }
  }
}

main().catch((err) => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
