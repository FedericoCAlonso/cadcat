import { optimize } from './engine';
import type { OptimizerInput, Layout } from './types';
import { DEFAULT_OPTIMIZER_SETTINGS } from './types';

/**
 * Renders an ASCII map of a SheetLayout.
 */
export function renderSheetAscii(layout: Layout, sheetIndex = 0, cols = 60, rows = 20): string {
  const sheet = layout.sheets[sheetIndex];
  if (!sheet) return 'No sheet found';

  const grid: string[][] = Array.from({ length: rows }, () => Array(cols).fill('.'));

  const scaleX = cols / sheet.sheetLengthMm;
  const scaleY = rows / sheet.sheetWidthMm;

  for (const [idx, p] of sheet.placements.entries()) {
    const x0 = Math.min(cols - 1, Math.max(0, Math.floor(p.x * scaleX)));
    const y0 = Math.min(rows - 1, Math.max(0, Math.floor(p.y * scaleY)));
    const x1 = Math.min(cols - 1, Math.max(0, Math.floor((p.x + p.w) * scaleX)));
    const y1 = Math.min(rows - 1, Math.max(0, Math.floor((p.y + p.h) * scaleY)));

    const char = String.fromCharCode(65 + (idx % 26));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        // Border or fill
        if (x === x0 || x === x1 || y === y0 || y === y1) {
          grid[y]![x] = '#';
        } else if (grid[y]![x] === '.') {
          grid[y]![x] = char;
        }
      }
    }
  }

  const lines = grid.map((r) => r.join(''));
  return lines.reverse().join('\n'); // Render bottom-left at bottom
}

/**
 * Standalone demo runner.
 */
export function runDemo(customInput?: OptimizerInput): void {
  const input: OptimizerInput = customInput ?? {
    parts: [
      { id: 'Side-L', label: 'Side Left', lengthMm: 720, widthMm: 560, quantity: 2, materialKey: 'white-18', grain: 'FIXED' },
      { id: 'Side-R', label: 'Side Right', lengthMm: 720, widthMm: 560, quantity: 2, materialKey: 'white-18', grain: 'FIXED' },
      { id: 'Top', label: 'Top Panel', lengthMm: 800, widthMm: 560, quantity: 2, materialKey: 'white-18', grain: 'FREE' },
      { id: 'Bottom', label: 'Bottom Panel', lengthMm: 800, widthMm: 560, quantity: 2, materialKey: 'white-18', grain: 'FREE' },
      { id: 'Shelf', label: 'Adjustable Shelf', lengthMm: 764, widthMm: 540, quantity: 4, materialKey: 'white-18', grain: 'FREE' },
    ],
    sheets: [
      { materialKey: 'white-18', lengthMm: 2750, widthMm: 1830, grain: 'ALONG_LENGTH', pricePerSheet: 45, available: 10 },
    ],
    settings: {
      ...DEFAULT_OPTIMIZER_SETTINGS,
      search: { timeBudgetMs: 500, maxIterations: 100, seed: 42 },
    },
  };

  const res = optimize(input);
  if (res.errors.length > 0) {
    console.error('Optimization errors:', res.errors);
    return;
  }

  const layout = res.alternatives[res.selectedIndex]!;

  console.log('=== MOBILIUS CUTTING OPTIMIZER DEMO ===');
  console.log(`Sheets used: ${layout.metrics.sheetsUsed} (Lower bound: ${layout.metrics.lowerBoundSheets})`);
  console.log(`Utilization: ${(layout.metrics.utilization * 100).toFixed(1)}%`);
  console.log(`Passes: ${layout.metrics.passes}, Total cut length: ${layout.metrics.cutLengthM}m`);
  console.log(`Total cost: $${layout.metrics.cost.total}`);

  for (let s = 0; s < layout.sheets.length; s++) {
    console.log(`\n--- Sheet #${s + 1} (${layout.sheets[s]!.sheetLengthMm}x${layout.sheets[s]!.sheetWidthMm}mm) ---`);
    console.log(renderSheetAscii(layout, s));
    console.log(`\nCut sequence (${layout.sheets[s]!.cutSequence.length} operations):`);
    for (const cut of layout.sheets[s]!.cutSequence.slice(0, 10)) {
      console.log(`  Step ${cut.order}: Stage ${cut.stage} [${cut.dir}] at ${cut.pos}mm from ${cut.from}mm to ${cut.to}mm ${cut.isTrim ? '(TRIM)' : ''}`);
    }
    if (layout.sheets[s]!.cutSequence.length > 10) {
      console.log(`  ... and ${layout.sheets[s]!.cutSequence.length - 10} more cuts.`);
    }
  }
}

if (process.argv[1]?.endsWith('demo.ts') || process.argv[1]?.endsWith('demo.js')) {
  runDemo();
}
