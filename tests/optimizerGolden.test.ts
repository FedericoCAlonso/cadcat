import { describe, it, expect } from 'vitest';
import { ConstructorGuillotine } from '../src/optimizer/constructorGuillotine';
import { preprocess } from '../src/optimizer/preprocessor';
import { validateLayout } from '../src/optimizer/validator';
import { computeLayoutCost } from '../src/optimizer/cost';
import type { OptimizerInput, Layout, SheetLayout, PlacedPartInstance } from '../src/optimizer/types';
import { DEFAULT_OPTIMIZER_SETTINGS } from '../src/optimizer/types';

describe('Golden Tests (Section 8.3)', () => {
  it('Golden 1: 4 parts that tile one sheet exactly with kerf=0, trim=0', () => {
    const input: OptimizerInput = {
      parts: [
        { id: 'tile', lengthMm: 1000, widthMm: 500, quantity: 4, materialKey: 'mat-1', grain: 'FREE' },
      ],
      sheets: [
        { materialKey: 'mat-1', lengthMm: 2000, widthMm: 1000, grain: 'NONE', pricePerSheet: 100, available: 5 },
      ],
      settings: {
        ...DEFAULT_OPTIMIZER_SETTINGS,
        kerfMm: 0,
        trimMm: { top: 0, bottom: 0, left: 0, right: 0 },
        dimensionsAreFinished: false,
      },
    };

    const prep = preprocess(input);
    expect(prep.errors).toHaveLength(0);

    const constructor = new ConstructorGuillotine(input.settings);
    const group = prep.groups[0]!;
    const usedCounts = new Map<number, number>();
    const res = constructor.build(group.normalInstances, group.sheets, usedCounts);

    expect(res.unplacedParts).toHaveLength(0);
    expect(res.sheets).toHaveLength(1);

    const sheet0 = res.sheets[0]!;
    expect(sheet0.placements).toHaveLength(4);
    expect(sheet0.usedAreaMm2).toBe(2000 * 1000);
    expect(sheet0.passes).toBe(3);

    const layout: Layout = {
      sheets: res.sheets,
      metrics: {
        sheetsUsed: 1,
        passes: sheet0.passes ?? 3,
        cutLengthM: sheet0.cutLengthM ?? 0,
        utilization: 1.0,
        utilizationExLast: 0,
        offcuts: sheet0.offcuts ?? [],
        lowerBoundSheets: 1,
        gapToBound: 0,
        cost: computeLayoutCost({
          sheets: [{ sheetType: input.sheets[0]!, passes: sheet0.passes, cutLengthM: sheet0.cutLengthM }],
          totalPasses: sheet0.passes ?? 3,
          totalCutLengthM: sheet0.cutLengthM ?? 0,
          offcuts: sheet0.offcuts ?? [],
          settings: input.settings,
        }),
        unplacedFillers: [],
      },
    };

    const valRes = validateLayout(input, layout);
    expect(valRes.valid).toBe(true);
    expect(valRes.errors).toHaveLength(0);
  });

  it('Golden 2: the same 4 parts with kerf=3 cannot fit on 1 sheet without overlap', () => {
    const input: OptimizerInput = {
      parts: [
        { id: 'tile', lengthMm: 1000, widthMm: 500, quantity: 4, materialKey: 'mat-1', grain: 'FREE' },
      ],
      sheets: [
        { materialKey: 'mat-1', lengthMm: 2000, widthMm: 1000, grain: 'NONE', pricePerSheet: 100, available: 5 },
      ],
      settings: {
        ...DEFAULT_OPTIMIZER_SETTINGS,
        kerfMm: 3,
        trimMm: { top: 0, bottom: 0, left: 0, right: 0 },
        dimensionsAreFinished: false,
      },
    };

    const prep = preprocess(input);
    const constructor = new ConstructorGuillotine(input.settings);
    const group = prep.groups[0]!;
    const usedCounts = new Map<number, number>();
    const res = constructor.build(group.normalInstances, group.sheets, usedCounts);

    // Because 2 * 1000 + 3 = 2003 > 2000 and 2 * 500 + 3 = 1003 > 1000, all 4 cannot fit on 1 sheet.
    // They must use 2 sheets, and validateLayout must pass with NO overlap.
    expect(res.sheets.length).toBeGreaterThanOrEqual(2);

    const layout: Layout = {
      sheets: res.sheets,
      metrics: {
        sheetsUsed: res.sheets.length,
        passes: res.sheets.reduce((sum, s) => sum + (s.passes ?? 0), 0),
        cutLengthM: res.sheets.reduce((sum, s) => sum + (s.cutLengthM ?? 0), 0),
        utilization: (4 * 1000 * 500) / (res.sheets.length * 2000 * 1000),
        utilizationExLast: 0,
        offcuts: [],
        lowerBoundSheets: 1,
        gapToBound: res.sheets.length - 1,
        cost: { sheets: 200, cuts: 0, credit: 0, total: 200 },
        unplacedFillers: [],
      },
    };

    const valRes = validateLayout(input, layout);
    expect(valRes.valid).toBe(true);
    expect(valRes.errors).toHaveLength(0);
  });

  it('Golden 3: identical strips from one sheet', () => {
    // Sheet 2000 x 1000, kerf = 0, trim = 0.
    // Strips 2000 x 100. Exactly 10 strips fit.
    const input: OptimizerInput = {
      parts: [
        { id: 'strip', lengthMm: 2000, widthMm: 100, quantity: 10, materialKey: 'mat-1', grain: 'FREE' },
      ],
      sheets: [
        { materialKey: 'mat-1', lengthMm: 2000, widthMm: 1000, grain: 'NONE', pricePerSheet: 100, available: 1 },
      ],
      settings: {
        ...DEFAULT_OPTIMIZER_SETTINGS,
        kerfMm: 0,
        trimMm: { top: 0, bottom: 0, left: 0, right: 0 },
        dimensionsAreFinished: false,
      },
    };

    const prep = preprocess(input);
    const constructor = new ConstructorGuillotine(input.settings);
    const group = prep.groups[0]!;
    const usedCounts = new Map<number, number>();
    const res = constructor.build(group.normalInstances, group.sheets, usedCounts);

    expect(res.unplacedParts).toHaveLength(0);
    expect(res.sheets).toHaveLength(1);
    expect(res.sheets[0]!.placements).toHaveLength(10);

    const layout: Layout = {
      sheets: res.sheets,
      metrics: {
        sheetsUsed: 1,
        passes: res.sheets[0]!.passes ?? 9,
        cutLengthM: res.sheets[0]!.cutLengthM ?? 0,
        utilization: 1.0,
        utilizationExLast: 0,
        offcuts: [],
        lowerBoundSheets: 1,
        gapToBound: 0,
        cost: { sheets: 100, cuts: 0, credit: 0, total: 100 },
        unplacedFillers: [],
      },
    };

    const valRes = validateLayout(input, layout);
    expect(valRes.valid).toBe(true);
  });

  it('Golden 5: textured sheet: FIXED requires more sheets than AUTO with visible=false', () => {
    // Sheet is 2000 x 1000, grain ALONG_LENGTH.
    // Parts: 2 parts of 1200 x 600.
    // Part 1: unrotated 1200 x 600 fits. Remaining height is 400.
    // Part 2: unrotated 1200 x 600 cannot fit in remaining height (400 < 600), remaining width is 800.
    // If rotation is forbidden (FIXED): part 2 cannot rotate (600x1200), so needs sheet 2!
    // If rotation is allowed (AUTO, visible=false): part 2 can rotate to 600x1200... wait, 1200 > 1000!
    // Let's pick dimensions:
    // Sheet: 2000 x 1000.
    // Part A: 1200 x 500 (fits unrotated at bottom-left [0..1200] x [0..500]).
    // Leftover space:
    // Top: [0..2000] x [500..1000] -> width 2000, height 500.
    // Right: [1200..2000] x [0..500] -> width 800, height 500.
    // Part B: 800 x 600.
    // Unrotated: length 800, width 600.
    // In Top (height 500): 600 > 500 (DOES NOT FIT unrotated).
    // In Right (height 500): 600 > 500 (DOES NOT FIT unrotated).
    // So with grain FIXED, Part B CANNOT fit on sheet 1! Needs 2 sheets.
    // But if Part B is rotated: width becomes 600, height becomes 800!
    // In Top (2000 x 500): width 600 <= 2000, height 800 > 500 (does not fit in Top).
    // But wait! What if split is vertical first?
    // Part A [0..1200] x [0..500].
    // Vertical split: Right is [1200..2000] x [0..1000] (width 800, height 1000).
    // Now Part B (800 x 600):
    // If unrotated: length 800, width 600. Fits in Right [1200..2000] x [0..600]!
    // Let's pick dimensions where Part B ONLY fits if rotated:
    // Sheet: 2000 x 1000.
    // Part 1: 1500 x 450.
    // Leftover:
    // Top: 2000 x 550.
    // Part 2: 900 x 520.
    // If unrotated: length 900 <= 2000, width 520 <= 550. Fits.
    // What if Part 2 has length 600, width 1200?
    // Unrotated: length 600, width 1200. Sheet width is 1000. 1200 > 1000!
    // Unrotated it CANNOT FIT ON ANY SHEET!
    // Rotated: length 1200, width 600. Fits on sheet (1200 <= 2000, 600 <= 1000)!
    // If grain is FIXED: infeasible (PART_TOO_LARGE_GRAIN_LOCKED) or requires sheet with no grain.
    // If grain is AUTO with visible=false: rotation allowed -> fits!

    const inputFixed: OptimizerInput = {
      parts: [
        { id: 'p', lengthMm: 600, widthMm: 1200, quantity: 1, materialKey: 'mat-1', grain: 'FIXED' },
      ],
      sheets: [
        { materialKey: 'mat-1', lengthMm: 2000, widthMm: 1000, grain: 'ALONG_LENGTH', pricePerSheet: 50, available: 5 },
      ],
      settings: {
        ...DEFAULT_OPTIMIZER_SETTINGS,
        trimMm: { top: 0, bottom: 0, left: 0, right: 0 },
        dimensionsAreFinished: false,
      },
    };

    const prepFixed = preprocess(inputFixed);
    expect(prepFixed.errors.some((e) => e.code === 'PART_TOO_LARGE_GRAIN_LOCKED')).toBe(true);

    const inputAutoHidden: OptimizerInput = {
      ...inputFixed,
      parts: [
        { id: 'p', lengthMm: 600, widthMm: 1200, quantity: 1, materialKey: 'mat-1', grain: 'AUTO', visible: false },
      ],
    };

    const prepAuto = preprocess(inputAutoHidden);
    expect(prepAuto.errors).toHaveLength(0);
    const constructor = new ConstructorGuillotine(inputAutoHidden.settings);
    const usedCounts = new Map<number, number>();
    const res = constructor.build(prepAuto.groups[0]!.normalInstances, prepAuto.groups[0]!.sheets, usedCounts);
    expect(res.sheets).toHaveLength(1);
    expect(res.sheets[0]!.placements[0]!.rotated).toBe(true);
    expect(res.sheets[0]!.placements[0]!.grainRelaxed).toBe(true);
  });

  it('Golden 7: two materials in one input are never mixed on one sheet', () => {
    const input: OptimizerInput = {
      parts: [
        { id: 'mA-1', lengthMm: 800, widthMm: 400, quantity: 1, materialKey: 'mat-A', grain: 'FREE' },
        { id: 'mB-1', lengthMm: 800, widthMm: 400, quantity: 1, materialKey: 'mat-B', grain: 'FREE' },
      ],
      sheets: [
        { materialKey: 'mat-A', lengthMm: 2000, widthMm: 1000, grain: 'NONE', pricePerSheet: 50, available: 5 },
        { materialKey: 'mat-B', lengthMm: 2000, widthMm: 1000, grain: 'NONE', pricePerSheet: 50, available: 5 },
      ],
      settings: {
        ...DEFAULT_OPTIMIZER_SETTINGS,
        trimMm: { top: 0, bottom: 0, left: 0, right: 0 },
        dimensionsAreFinished: false,
      },
    };

    const prep = preprocess(input);
    expect(prep.groups).toHaveLength(2);

    const allSheets: SheetLayout[] = [];
    const constructor = new ConstructorGuillotine(input.settings);
    const usedCounts = new Map<number, number>();

    for (const group of prep.groups) {
      const res = constructor.build(group.normalInstances, group.sheets, usedCounts);
      allSheets.push(...res.sheets);
    }

    expect(allSheets).toHaveLength(2);
    // Sheet 0 has sheetTypeIndex 0 (mat-A) with part mA-1
    expect(allSheets[0]!.sheetTypeIndex).toBe(0);
    expect(allSheets[0]!.placements.every((p: PlacedPartInstance) => p.partId.startsWith('mA'))).toBe(true);

    // Sheet 1 has sheetTypeIndex 1 (mat-B) with part mB-1
    expect(allSheets[1]!.sheetTypeIndex).toBe(1);
    expect(allSheets[1]!.placements.every((p: PlacedPartInstance) => p.partId.startsWith('mB'))).toBe(true);
  });
});
