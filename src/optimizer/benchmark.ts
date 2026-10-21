import { optimize } from './engine';
import type { OptimizerInput, Part, SheetType } from './types';
import { DEFAULT_OPTIMIZER_SETTINGS } from './types';

export interface BenchmarkResultItem {
  name: string;
  partsCount: number;
  sheetsUsed: number;
  lowerBound: number;
  gapToBound: number;
  utilizationPercent: number;
  utilizationExLastPercent: number;
  passes: number;
  elapsedMs: number;
}

const standardSheet: SheetType = {
  materialKey: 'mdf-18',
  lengthMm: 2750,
  widthMm: 1830,
  grain: 'ALONG_LENGTH',
  pricePerSheet: 50,
  available: 50,
};

const standardSheetNoGrain: SheetType = {
  ...standardSheet,
  grain: 'NONE',
};

export const BENCHMARK_SUITES: { name: string; parts: Part[]; sheet: SheetType }[] = [
  // 1. Kitchen base cabinet
  {
    name: '1. Kitchen Base 80cm',
    sheet: standardSheet,
    parts: [
      { id: 'side-l', lengthMm: 720, widthMm: 560, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'side-r', lengthMm: 720, widthMm: 560, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'bottom', lengthMm: 764, widthMm: 560, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'top-stretcher', lengthMm: 764, widthMm: 100, quantity: 2, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'shelf', lengthMm: 764, widthMm: 540, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'door', lengthMm: 716, widthMm: 396, quantity: 2, materialKey: 'mdf-18', grain: 'FIXED' },
    ],
  },
  // 2. Kitchen Wall Cabinet
  {
    name: '2. Kitchen Wall Cabinet 80cm',
    sheet: standardSheet,
    parts: [
      { id: 'wall-side-l', lengthMm: 720, widthMm: 320, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'wall-side-r', lengthMm: 720, widthMm: 320, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'wall-top', lengthMm: 764, widthMm: 320, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'wall-bottom', lengthMm: 764, widthMm: 320, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'wall-shelf', lengthMm: 764, widthMm: 300, quantity: 2, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'wall-door', lengthMm: 716, widthMm: 396, quantity: 2, materialKey: 'mdf-18', grain: 'FIXED' },
    ],
  },
  // 3. 2-door Wardrobe
  {
    name: '3. 2-Door Wardrobe',
    sheet: standardSheet,
    parts: [
      { id: 'w-side-l', lengthMm: 2100, widthMm: 580, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'w-side-r', lengthMm: 2100, widthMm: 580, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'w-top', lengthMm: 964, widthMm: 580, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'w-bottom', lengthMm: 964, widthMm: 580, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'w-shelf-fixed', lengthMm: 964, widthMm: 560, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'w-shelf-adj', lengthMm: 964, widthMm: 550, quantity: 3, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'w-door', lengthMm: 2000, widthMm: 496, quantity: 2, materialKey: 'mdf-18', grain: 'FIXED' },
    ],
  },
  // 4. 3-door Wardrobe with Internal Divider
  {
    name: '4. 3-Door Wardrobe with Divider',
    sheet: standardSheet,
    parts: [
      { id: 'w3-side-l', lengthMm: 2200, widthMm: 580, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'w3-side-r', lengthMm: 2200, widthMm: 580, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'w3-div', lengthMm: 2050, widthMm: 560, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'w3-top', lengthMm: 1464, widthMm: 580, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'w3-bot', lengthMm: 1464, widthMm: 580, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'w3-shelf-wide', lengthMm: 964, widthMm: 550, quantity: 2, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'w3-shelf-narr', lengthMm: 482, widthMm: 550, quantity: 4, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'w3-door', lengthMm: 2100, widthMm: 496, quantity: 3, materialKey: 'mdf-18', grain: 'FIXED' },
    ],
  },
  // 5. Office Desk
  {
    name: '5. Office Desk with Pedestal',
    sheet: standardSheet,
    parts: [
      { id: 'desk-top', lengthMm: 1500, widthMm: 750, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'desk-side-l', lengthMm: 732, widthMm: 700, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'desk-side-r', lengthMm: 732, widthMm: 700, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'desk-modesty', lengthMm: 1400, widthMm: 350, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'ped-side', lengthMm: 650, widthMm: 450, quantity: 2, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'ped-bot', lengthMm: 400, widthMm: 450, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'ped-drawer-front', lengthMm: 396, widthMm: 160, quantity: 3, materialKey: 'mdf-18', grain: 'FIXED' },
    ],
  },
  // 6. Tall Bookshelf
  {
    name: '6. Tall Bookshelf',
    sheet: standardSheet,
    parts: [
      { id: 'bk-side-l', lengthMm: 2000, widthMm: 280, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'bk-side-r', lengthMm: 2000, widthMm: 280, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'bk-top', lengthMm: 800, widthMm: 280, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'bk-bot', lengthMm: 800, widthMm: 280, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'bk-shelf-fixed', lengthMm: 764, widthMm: 280, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'bk-shelf-adj', lengthMm: 764, widthMm: 270, quantity: 4, materialKey: 'mdf-18', grain: 'FREE' },
    ],
  },
  // 7. 4-Drawer Chest
  {
    name: '7. 4-Drawer Chest',
    sheet: standardSheet,
    parts: [
      { id: 'ch-side-l', lengthMm: 950, widthMm: 480, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'ch-side-r', lengthMm: 950, widthMm: 480, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'ch-top', lengthMm: 800, widthMm: 500, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'ch-bot', lengthMm: 764, widthMm: 480, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'ch-front', lengthMm: 760, widthMm: 210, quantity: 4, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'ch-dr-side', lengthMm: 450, widthMm: 160, quantity: 8, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'ch-dr-back', lengthMm: 700, widthMm: 160, quantity: 4, materialKey: 'mdf-18', grain: 'FREE' },
    ],
  },
  // 8. Bathroom Vanity
  {
    name: '8. Bathroom Vanity 90cm',
    sheet: standardSheet,
    parts: [
      { id: 'van-side-l', lengthMm: 800, widthMm: 480, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'van-side-r', lengthMm: 800, widthMm: 480, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'van-bot', lengthMm: 864, widthMm: 480, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'van-stretcher', lengthMm: 864, widthMm: 100, quantity: 2, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'van-div', lengthMm: 700, widthMm: 460, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'van-door', lengthMm: 700, widthMm: 426, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'van-dr-front', lengthMm: 426, widthMm: 230, quantity: 3, materialKey: 'mdf-18', grain: 'FIXED' },
    ],
  },
  // 9. TV Media Console
  {
    name: '9. TV Media Console 180cm',
    sheet: standardSheet,
    parts: [
      { id: 'tv-top', lengthMm: 1800, widthMm: 420, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'tv-bot', lengthMm: 1800, widthMm: 420, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'tv-side-l', lengthMm: 450, widthMm: 420, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'tv-side-r', lengthMm: 450, widthMm: 420, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'tv-div', lengthMm: 414, widthMm: 400, quantity: 2, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'tv-door', lengthMm: 580, widthMm: 410, quantity: 2, materialKey: 'mdf-18', grain: 'FIXED' },
      { id: 'tv-shelf', lengthMm: 580, widthMm: 390, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
    ],
  },
  // 10. Shoe Rack Cabinet (grain = NONE for high utilization check)
  {
    name: '10. Shoe Cabinet (Grain NONE)',
    sheet: standardSheetNoGrain,
    parts: [
      { id: 'sh-side-l', lengthMm: 1100, widthMm: 300, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'sh-side-r', lengthMm: 1100, widthMm: 300, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'sh-top', lengthMm: 750, widthMm: 300, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'sh-bot', lengthMm: 750, widthMm: 300, quantity: 1, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'sh-flap', lengthMm: 710, widthMm: 320, quantity: 3, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'sh-divider', lengthMm: 714, widthMm: 140, quantity: 3, materialKey: 'mdf-18', grain: 'FREE' },
    ],
  },
  // 11. Synthetic Benchmark 1: Exact 100% tile
  {
    name: '11. Synthetic Exact Tile Grid',
    sheet: { materialKey: 'mdf-18', lengthMm: 2000, widthMm: 1000, grain: 'NONE', pricePerSheet: 50, available: 10 },
    parts: [
      { id: 'tile', lengthMm: 500, widthMm: 250, quantity: 16, materialKey: 'mdf-18', grain: 'FREE' },
    ],
  },
  // 12. Synthetic Benchmark 2: Non-uniform strip guillotine packing
  {
    name: '12. Synthetic Strips Set',
    sheet: standardSheetNoGrain,
    parts: [
      { id: 'strip-long', lengthMm: 1800, widthMm: 250, quantity: 4, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'strip-med', lengthMm: 900, widthMm: 250, quantity: 8, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'tile-sq', lengthMm: 450, widthMm: 450, quantity: 6, materialKey: 'mdf-18', grain: 'FREE' },
    ],
  },
  // 13. Scale Benchmark 3: 150 Parts for speed test (< 3 seconds)
  {
    name: '13. Scale Test (150 Parts)',
    sheet: standardSheet,
    parts: Array.from({ length: 30 }, (_, i) => ({
      id: `p-${i}`,
      lengthMm: 300 + (i % 5) * 100,
      widthMm: 200 + (i % 4) * 80,
      quantity: 5,
      materialKey: 'mdf-18',
      grain: (i % 3 === 0 ? 'FIXED' : 'FREE') as 'FIXED' | 'FREE',
    })),
  },
];

export function runBenchmark(): BenchmarkResultItem[] {
  const results: BenchmarkResultItem[] = [];

  for (const suite of BENCHMARK_SUITES) {
    const input: OptimizerInput = {
      parts: suite.parts,
      sheets: [suite.sheet],
      settings: {
        ...DEFAULT_OPTIMIZER_SETTINGS,
        search: { timeBudgetMs: 800, maxIterations: 150, seed: 1001 },
      },
    };

    const res = optimize(input);
    const layout = res.alternatives[res.selectedIndex]!;

    const partsCount = suite.parts.reduce((sum, p) => sum + p.quantity, 0);

    results.push({
      name: suite.name,
      partsCount,
      sheetsUsed: layout.metrics.sheetsUsed,
      lowerBound: layout.metrics.lowerBoundSheets,
      gapToBound: layout.metrics.gapToBound,
      utilizationPercent: Math.round(layout.metrics.utilization * 1000) / 10,
      utilizationExLastPercent: Math.round(layout.metrics.utilizationExLast * 1000) / 10,
      passes: layout.metrics.passes,
      elapsedMs: res.stats.elapsedMs,
    });
  }

  return results;
}

if (process.argv[1]?.endsWith('benchmark.ts') || process.argv[1]?.endsWith('benchmark.js')) {
  console.log('Running CadCat Cutting Optimizer Benchmark Suite...\n');
  const items = runBenchmark();
  console.table(items);
}
