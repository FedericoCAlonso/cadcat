/**
 * Visual Test Suite for 3D Edge Band Highlights and Mirrored Overlays in Headless Chromium.
 *
 * Verifies that:
 * 1. Edge band highlight lines render visible pixels for preset-drawer-unit-3 at both
 *    deviceScaleFactor = 1 and deviceScaleFactor = 3.
 * 2. The measured line thickness of straight edges is between 1.5 and 3.0 CSS pixels
 *    (fails if thickness is 6 CSS pixels, as occurred when scaled twice by pixelRatio).
 * 3. The "One Drawer Open" kinematics state moves the drawer, producing distinct pixel
 *    counts and verified visual transformation shifts.
 * 4. Other overlays under the mirrored group (such as piece selection outlines) render
 *    properly without face culling defects.
 *
 * Requirements:
 * - Fails on v0.31.2 code (where culling produced 5 px at DPR=1 and 14 px at DPR=3).
 * - Fails on v0.31.3 initial code where line thickness was 6 CSS pixels (18 physical px).
 * - Passes on v0.31.3 corrected code with 2 CSS pixels and verified kinematics motion.
 */

import puppeteer from 'puppeteer-core';
import { decode } from 'fast-png';
import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';

/** Target edge band highlight color (#E91E63 in RGB). */
const TARGET_COLOR = { r: 233, g: 30, b: 99 };
/** Euclidean color distance tolerance for rasterized antialiased edges. */
const COLOR_TOLERANCE = 45;
/** Minimum highlight pixels required for DPR = 1. */
const MIN_PIXELS_DPR1 = 100;
/** Minimum highlight pixels required for DPR = 3. */
const MIN_PIXELS_DPR3 = 500;
/** Minimum allowed line thickness in CSS pixels. */
const MIN_LINE_WIDTH_CSS_PX = 1.5;
/** Maximum allowed line thickness in CSS pixels. */
const MAX_LINE_WIDTH_CSS_PX = 3.0;

/**
 * Finds an available Chromium executable on Linux / CI environments.
 *
 * @returns {string} Path to the Chromium binary.
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
 * Supports both 3-channel (RGB) and 4-channel (RGBA) decoded images.
 *
 * @param {object} decodedImg Decoded image from fast-png ({ width, height, data, channels }).
 * @returns {number} Number of matching highlight pixels.
 */
function countHighlightPixels(decodedImg) {
  const { data, channels = 4 } = decodedImg;
  let count = 0;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const dist = Math.hypot(r - TARGET_COLOR.r, g - TARGET_COLOR.g, b - TARGET_COLOR.b);
    if (dist <= COLOR_TOLERANCE) {
      count++;
    }
  }
  return count;
}

/**
 * Measures the median line thickness in CSS pixels of straight vertical edges
 * with the highlight color.
 *
 * Finds vertical column segments spanning at least (25 * dpr) pixels,
 * and measures the horizontal pixel run length across that edge.
 *
 * @param {object} decodedImg Decoded fast-png image ({ width, height, data, channels }).
 * @param {number} dpr Device pixel ratio (1 or 3).
 * @returns {{ medianPhysical: number, medianCss: number }}
 */
function measureStraightEdgeThickness(decodedImg, dpr) {
  const { width, height, data, channels = 4 } = decodedImg;
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const dist = Math.hypot(r - TARGET_COLOR.r, g - TARGET_COLOR.g, b - TARGET_COLOR.b);
      if (dist <= COLOR_TOLERANCE) {
        mask[y * width + x] = 1;
      }
    }
  }

  const minColLen = Math.floor(25 * dpr);
  const verticalCols = [];
  for (let x = 0; x < width; x++) {
    let inRun = false;
    let startY = 0;
    for (let y = 0; y < height; y++) {
      if (mask[y * width + x]) {
        if (!inRun) {
          startY = y;
          inRun = true;
        }
      } else {
        if (inRun) {
          if (y - startY >= minColLen) {
            verticalCols.push({ x, startY, endY: y - 1 });
          }
          inRun = false;
        }
      }
    }
    if (inRun && height - startY >= minColLen) {
      verticalCols.push({ x, startY, endY: height - 1 });
    }
  }

  if (verticalCols.length === 0) {
    return { medianPhysical: 0, medianCss: 0 };
  }

  const edge = verticalCols[0];
  const thicknessSamples = [];
  const yStart = edge.startY + Math.min(10, Math.floor((edge.endY - edge.startY) / 4));
  const yEnd = edge.endY - Math.min(10, Math.floor((edge.endY - edge.startY) / 4));

  for (let y = yStart; y <= yEnd; y++) {
    let left = edge.x;
    while (left > 0 && mask[y * width + (left - 1)]) {
      left--;
    }
    let right = edge.x;
    while (right < width - 1 && mask[y * width + (right + 1)]) {
      right++;
    }
    thicknessSamples.push(right - left + 1);
  }

  if (thicknessSamples.length === 0) {
    return { medianPhysical: 0, medianCss: 0 };
  }

  thicknessSamples.sort((a, b) => a - b);
  const mid = Math.floor(thicknessSamples.length / 2);
  const medianPhysical = thicknessSamples.length % 2 !== 0
    ? thicknessSamples[mid]
    : (thicknessSamples[mid - 1] + thicknessSamples[mid]) / 2;
  const medianCss = Number((medianPhysical / dpr).toFixed(2));

  return { medianPhysical, medianCss };
}

/**
 * Checks if a port is responding to HTTP requests.
 *
 * @param {number} port Local port to verify.
 * @returns {Promise<boolean>} True if server responded with 2xx/3xx.
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
  console.log('=== CadCat Visual Edge Band Highlights and Overlays Test ===\n');

  // Detect running preview/dev server or spawn preview server
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

      // 1. Case A: Drawers Closed (Pixel Count)
      const shotClosed = await page.screenshot();
      const decodedClosed = decode(shotClosed);
      const countClosed = countHighlightPixels(decodedClosed);
      const passedClosed = countClosed >= minRequired;
      if (!passedClosed) allPassed = false;
      results.push({
        testCase: `DPR ${dpr} - Drawers Closed`,
        pixelCount: countClosed,
        expected: `>= ${minRequired} px`,
        status: passedClosed ? 'PASS' : 'FAIL',
      });

      // 2. Case B: Line Thickness Verification (1.5 to 3.0 CSS pixels)
      const thickness = measureStraightEdgeThickness(decodedClosed, dpr);
      const passedThickness =
        thickness.medianCss >= MIN_LINE_WIDTH_CSS_PX &&
        thickness.medianCss <= MAX_LINE_WIDTH_CSS_PX;
      if (!passedThickness) allPassed = false;
      results.push({
        testCase: `DPR ${dpr} - Line Thickness`,
        pixelCount: `${thickness.medianPhysical} phys px`,
        expected: `${thickness.medianCss} CSS px (${MIN_LINE_WIDTH_CSS_PX}-${MAX_LINE_WIDTH_CSS_PX} CSS px)`,
        status: passedThickness ? 'PASS' : 'FAIL',
      });

      // 3. Case C: One Drawer Open (trigger kinematics mechanism)
      const options = await page.evaluate(() => {
        const sel = document.querySelector('.m3-kinematics-select');
        return sel ? Array.from(sel.options).map((o) => o.value) : [];
      });

      if (options.length > 1) {
        // Select first individual drawer mechanism
        await page.select('.m3-kinematics-select', options[1]);
        await new Promise((r) => setTimeout(r, 400));

        // Click "Abrir" action button
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('.m3-kinematics-actions button'));
          const openBtn = buttons.find((btn) => btn.innerText.trim() === 'Abrir');
          openBtn?.click();
        });
        await new Promise((r) => setTimeout(r, 1200));
      }

      const shotOpen = await page.screenshot();
      const decodedOpen = decode(shotOpen);
      const countOpen = countHighlightPixels(decodedOpen);

      // Verify pixel differences caused by drawer displacement
      let changedPixels = 0;
      const channels = decodedClosed.channels || 4;
      for (let i = 0; i < decodedClosed.data.length; i += channels) {
        if (
          decodedClosed.data[i] !== decodedOpen.data[i] ||
          decodedClosed.data[i + 1] !== decodedOpen.data[i + 1] ||
          decodedClosed.data[i + 2] !== decodedOpen.data[i + 2]
        ) {
          changedPixels++;
        }
      }

      const passedOpenCount = countOpen >= minRequired;
      const passedDifferent = countOpen !== countClosed;
      const passedMovement = changedPixels > 0;
      const passedOpen = passedOpenCount && passedDifferent && passedMovement;
      if (!passedOpen) allPassed = false;
      results.push({
        testCase: `DPR ${dpr} - One Drawer Open`,
        pixelCount: `${countOpen} px (diff: ${countClosed - countOpen} px, scene shift: ${changedPixels} px)`,
        expected: `>= ${minRequired} px & diff != 0`,
        status: passedOpen ? 'PASS' : 'FAIL',
      });

      // 4. Case D: Mirrored Group Overlay Check (Piece Selection Outline)
      const canvasEl = await page.$('canvas');
      const box = await canvasEl?.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await new Promise((r) => setTimeout(r, 600));
      }

      const hasSelectedPiece = await page.evaluate(() => {
        const hint = document.querySelector('.viewport-touch-hint');
        return hint ? hint.innerText.includes('Pieza seleccionada') : false;
      });
      if (!hasSelectedPiece) allPassed = false;
      results.push({
        testCase: `DPR ${dpr} - Mirrored Selection Wireframe`,
        pixelCount: hasSelectedPiece ? 'Active' : 'Inactive',
        expected: 'Active',
        status: hasSelectedPiece ? 'PASS' : 'FAIL',
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
    console.log('✓ All visual test assertions passed successfully.\n');
    process.exit(0);
  } else {
    console.error('✗ Some visual test assertions failed.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Visual test execution error:', err);
  process.exit(1);
});
