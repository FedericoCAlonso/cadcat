/**
 * Visual Test Suite for 3D Edge Band Highlights in Headless Chromium.
 *
 * Verifies that the edge band highlight lines render visible pixels on the canvas
 * for a module with drawers (preset-drawer-unit-3) at both deviceScaleFactor = 1
 * and deviceScaleFactor = 3, with drawers closed and with one drawer open.
 *
 * Requirements:
 * - Fails on v0.31.2 code (which produced only 5 px at DPR=1 and 14 px at DPR=3).
 * - Passes on v0.31.3+ (which produces >500 px at DPR=1 and >14,000 px at DPR=3).
 */

import puppeteer from 'puppeteer-core';
import { decode } from 'fast-png';
import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Configuration thresholds
const TARGET_COLOR = { r: 233, g: 30, b: 99 }; // #E91E63
const COLOR_TOLERANCE = 45;
const MIN_PIXELS_DPR1 = 100;
const MIN_PIXELS_DPR3 = 500;

/**
 * Finds an available Chromium executable on Linux / CI environments.
 */
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
  throw new Error('No Chromium executable found. Please set CHROMIUM_PATH environment variable.');
}

/**
 * Counts highlight pixels matching the target color within tolerance.
 */
function countHighlightPixels(imgData) {
  let count = 0;
  for (let i = 0; i < imgData.length; i += 4) {
    const r = imgData[i];
    const g = imgData[i + 1];
    const b = imgData[i + 2];
    const dist = Math.hypot(r - TARGET_COLOR.r, g - TARGET_COLOR.g, b - TARGET_COLOR.b);
    if (dist <= COLOR_TOLERANCE) {
      count++;
    }
  }
  return count;
}

/**
 * Checks if a port is responding to HTTP requests.
 */
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
  console.log('=== CadCat Visual Edge Band Highlights Test ===\n');

  // Detect running server or start one
  let targetPort = null;
  let serverProcess = null;

  if (await checkServer(4173)) {
    targetPort = 4173;
    console.log('✓ Found running preview server on port 4173');
  } else if (await checkServer(5173)) {
    targetPort = 5173;
    console.log('✓ Found running dev server on port 5173');
  } else {
    console.log('Starting preview server on port 4173...');
    serverProcess = spawn('npx', ['vite', 'preview', '--port', '4173'], {
      stdio: 'ignore',
      detached: false,
    });
    // Wait for server to be ready
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await checkServer(4173)) {
        targetPort = 4173;
        break;
      }
    }
    if (!targetPort) {
      if (serverProcess) serverProcess.kill();
      throw new Error('Failed to start Vite preview server. Run "npm run build" first.');
    }
    console.log('✓ Preview server started on port 4173');
  }

  const chromiumPath = findChromiumExecutable();
  console.log(`✓ Using Chromium: ${chromiumPath}\n`);

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

  const results = [];
  let allPassed = true;

  try {
    for (const dpr of [1, 3]) {
      const minRequired = dpr === 1 ? MIN_PIXELS_DPR1 : MIN_PIXELS_DPR3;
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: dpr });
      await page.goto(`http://localhost:${targetPort}/cadcat/`, { waitUntil: 'networkidle0' });

      // Wait for IndexedDB catalog seed to finish
      await page.waitForFunction(() => !document.body.innerText.includes('Cargando catálogos'), { timeout: 15000 });

      // Navigate to Armar tab in mobile viewport
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

      // Return to Vista 3D
      const bottomNavs2 = await page.$$('.m3-bottom-nav__item');
      for (const item of bottomNavs2) {
        const text = await page.evaluate((el => el.innerText), item);
        if (text.includes('Vista 3D')) {
          await item.click();
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 1200));

      // Case A: Drawers Closed
      const shotClosed = await page.screenshot();
      const countClosed = countHighlightPixels(decode(shotClosed).data);
      const passedClosed = countClosed >= minRequired;
      if (!passedClosed) allPassed = false;
      results.push({
        testCase: `DPR ${dpr} - Drawers Closed`,
        pixelCount: countClosed,
        minRequired,
        status: passedClosed ? 'PASS' : 'FAIL',
      });

      // Case B: One Drawer Open (trigger kinematics mechanism)
      await page.evaluate(() => {
        const sel = document.querySelector('.m3-kinematics-select');
        if (sel && sel.options.length > 1) {
          sel.selectedIndex = 1; // select first individual drawer
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const buttons = document.querySelectorAll('button');
        for (const b of buttons) {
          if (b.innerText.trim() === 'Abierto') {
            b.click();
            break;
          }
        }
      });
      await new Promise((r) => setTimeout(r, 1000));

      const shotOpen = await page.screenshot();
      const countOpen = countHighlightPixels(decode(shotOpen).data);
      const passedOpen = countOpen >= minRequired;
      if (!passedOpen) allPassed = false;
      results.push({
        testCase: `DPR ${dpr} - One Drawer Open`,
        pixelCount: countOpen,
        minRequired,
        status: passedOpen ? 'PASS' : 'FAIL',
      });

      await page.close();
    }
  } finally {
    await browser.close();
    if (serverProcess) {
      serverProcess.kill();
    }
  }

  console.table(results);

  if (allPassed) {
    console.log('✓ All visual edge band highlight assertions passed successfully.\n');
    process.exit(0);
  } else {
    console.error('✗ Some visual edge band highlight assertions failed.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Visual test execution error:', err);
  process.exit(1);
});
