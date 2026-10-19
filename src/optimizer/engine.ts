import type {
  OptimizerInput,
  Result,
  Layout,
  SheetLayout,
  Rect,
  Warning,
  ErrorItem,
} from './types';
import { validateInput } from './inputValidation';
import { preprocess } from './preprocessor';
import { SearchEngine, type CancelChecker, type ProgressCallback } from './search';
import { validateLayout } from './validator';

/**
 * Main optimizer entry point (pure library function).
 * No DOM, no IndexedDB, no global state.
 */
export function optimize(
  input: OptimizerInput,
  checkCancel?: CancelChecker,
  onProgress?: ProgressCallback,
): Result {
  const startTime = performance.now();
  const seed = input.settings.search.seed ?? 123456789;

  // 1. Input validation
  const inputVal = validateInput(input);
  if (!inputVal.valid) {
    return {
      alternatives: [],
      selectedIndex: 0,
      warnings: inputVal.warnings,
      errors: inputVal.errors,
      stats: {
        elapsedMs: Math.round(performance.now() - startTime),
        iterations: 0,
        seed,
      },
    };
  }

  // 2. Pre-processing & feasibility checks
  const prep = preprocess(input);
  const warnings: Warning[] = [...inputVal.warnings, ...prep.warnings];
  const errors: ErrorItem[] = [...inputVal.errors, ...prep.errors];

  if (prep.groups.length === 0) {
    return {
      alternatives: [],
      selectedIndex: 0,
      warnings,
      errors,
      stats: {
        elapsedMs: Math.round(performance.now() - startTime),
        iterations: 0,
        seed,
      },
    };
  }

  // 3. Optimize each material group
  const searchEngine = new SearchEngine(input.settings);
  let totalIterations = 0;

  const groupResults = prep.groups.map((group) => {
    const res = searchEngine.optimizeGroup(group, checkCancel, onProgress);
    totalIterations += res.iterations;
    return res;
  });

  // 4. Merge results across material groups
  const mergeLayouts = (extract: (r: (typeof groupResults)[0]) => Layout): Layout => {
    const combinedSheets: SheetLayout[] = [];
    const combinedOffcuts: Rect[] = [];
    const unplacedFillers: string[] = [];

    let totalPasses = 0;
    let totalCutLengthM = 0;
    let totalPlacedArea = 0;
    let totalSheetArea = 0;
    let lowerBoundSheets = 0;
    let sheetCost = 0;
    let cutCost = 0;
    let credit = 0;

    for (const gr of groupResults) {
      const lay = extract(gr);
      combinedSheets.push(...lay.sheets);
      combinedOffcuts.push(...lay.metrics.offcuts);
      unplacedFillers.push(...lay.metrics.unplacedFillers);

      totalPasses += lay.metrics.passes;
      totalCutLengthM += lay.metrics.cutLengthM;
      lowerBoundSheets += lay.metrics.lowerBoundSheets;

      sheetCost += lay.metrics.cost.sheets;
      cutCost += lay.metrics.cost.cuts;
      credit += lay.metrics.cost.credit;

      for (const s of lay.sheets) {
        totalPlacedArea += s.placements.reduce((sum, p) => sum + p.w * p.h, 0);
        totalSheetArea += s.sheetLengthMm * s.sheetWidthMm;
      }
    }

    const utilization = totalSheetArea > 0 ? totalPlacedArea / totalSheetArea : 0;
    const totalCost = Math.max(0, sheetCost + cutCost - credit);

    // Reference flag if PANEL_SAW (Section 7.5)
    const isReference = input.settings.machine === 'PANEL_SAW';

    return {
      isReference,
      sheets: combinedSheets,
      metrics: {
        sheetsUsed: combinedSheets.length,
        passes: totalPasses,
        cutLengthM: Math.round(totalCutLengthM * 100) / 100,
        utilization: Math.round(utilization * 1000) / 1000,
        utilizationExLast: Math.round(utilization * 1000) / 1000,
        offcuts: combinedOffcuts,
        lowerBoundSheets,
        gapToBound: Math.max(0, combinedSheets.length - lowerBoundSheets),
        cost: {
          sheets: Math.round(sheetCost * 100) / 100,
          cuts: Math.round(cutCost * 100) / 100,
          credit: Math.round(credit * 100) / 100,
          total: Math.round(totalCost * 100) / 100,
        },
        unplacedFillers,
      },
    };
  };

  const layoutMaterial = mergeLayouts((r) => r.bestByMaterial);
  const layoutCuts = mergeLayouts((r) => r.bestByCuts);
  const layoutCost = mergeLayouts((r) => r.bestByCost);

  // Alternatives: up to 3 (best material, best cuts, best cost)
  const alternatives: Layout[] = [layoutMaterial, layoutCuts, layoutCost];

  let selectedIndex = 0;
  if (input.settings.objective === 'MIN_CUTS') {
    selectedIndex = 1;
  } else if (input.settings.objective === 'MIN_COST') {
    selectedIndex = 2;
  } else {
    selectedIndex = 0; // MIN_MATERIAL or BALANCED default
  }

  // Add warnings for unplaced fillers
  const selectedLayout = alternatives[selectedIndex]!;
  for (const uf of selectedLayout.metrics.unplacedFillers) {
    warnings.push({
      code: 'UNPLACED_FILLER',
      messageKey: 'optimizer.warning.unplacedFiller',
      partId: uf,
      details: { partId: uf },
    });
  }

  // Validate selected layout
  const val = validateLayout(input, selectedLayout);
  if (!val.valid) {
    for (const vErr of val.errors) {
      warnings.push({
        code: `VALIDATION_${vErr.code}`,
        messageKey: 'optimizer.warning.validation',
        details: { message: vErr.message, checkIndex: vErr.checkIndex },
      });
    }
  }

  return {
    alternatives,
    selectedIndex,
    warnings,
    errors,
    stats: {
      elapsedMs: Math.round(performance.now() - startTime),
      iterations: totalIterations,
      seed,
    },
  };
}
