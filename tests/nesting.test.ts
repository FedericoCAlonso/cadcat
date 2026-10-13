import { describe, it, expect } from 'vitest';
import {
  runGuillotineNesting,
  runMultiMaterialGuillotineNesting,
  executeNesting,
  type NestingItem,
  type SheetDefinition,
  type PlacedPiece,
} from '../src/workers';

function checkNoOverlapAndInsideSheet(
  pieces: PlacedPiece[],
  sheetLength: number,
  sheetWidth: number,
  trimMargin: number,
  sawKerf: number,
): void {
  for (let i = 0; i < pieces.length; i++) {
    const a = pieces[i]!;

    // Piece must be completely inside the sheet (respecting trim margin)
    expect(a.x).toBeGreaterThanOrEqual(trimMargin);
    expect(a.y).toBeGreaterThanOrEqual(trimMargin);
    expect(a.x + a.width).toBeLessThanOrEqual(sheetLength - trimMargin);
    expect(a.y + a.height).toBeLessThanOrEqual(sheetWidth - trimMargin);

    for (let j = i + 1; j < pieces.length; j++) {
      const b = pieces[j]!;

      // Pieces must not overlap (they must be separated by at least sawKerf if touching)
      const noHorizontalOverlap = a.x + a.width <= b.x || b.x + b.width <= a.x;
      const noVerticalOverlap = a.y + a.height <= b.y || b.y + b.height <= a.y;

      const separates = noHorizontalOverlap || noVerticalOverlap;
      expect(separates).toBe(true);

      // If adjacent along horizontal, gap must be at least sawKerf
      if (!noVerticalOverlap && a.x < b.x) {
        expect(b.x - (a.x + a.width)).toBeGreaterThanOrEqual(sawKerf - 0.001);
      }
      // If adjacent along vertical, gap must be at least sawKerf
      if (!noHorizontalOverlap && a.y < b.y) {
        expect(b.y - (a.y + a.height)).toBeGreaterThanOrEqual(sawKerf - 0.001);
      }
    }
  }
}

describe('Guillotine Nesting', () => {
  const standardSheet: SheetDefinition = {
    materialId: 'mat-egger-white-18',
    lengthMm: 2800,
    widthMm: 2070,
    trimMarginMm: 10,
    sawKerfMm: 3.2,
  };

  it('places pieces on a sheet without overlap and inside bounds (Acceptance Criteria)', () => {
    const items: NestingItem[] = [
      { id: '1', pieceId: 'side-left', materialId: 'mat-1', cutWidthMm: 558, cutHeightMm: 800, canRotate: false },
      { id: '2', pieceId: 'side-right', materialId: 'mat-1', cutWidthMm: 558, cutHeightMm: 800, canRotate: false },
      { id: '3', pieceId: 'bottom', materialId: 'mat-1', cutWidthMm: 562, cutHeightMm: 560, canRotate: false },
      { id: '4', pieceId: 'shelf-1', materialId: 'mat-1', cutWidthMm: 562, cutHeightMm: 500, canRotate: false },
      { id: '5', pieceId: 'shelf-2', materialId: 'mat-1', cutWidthMm: 562, cutHeightMm: 500, canRotate: false },
      { id: '6', pieceId: 'rail-front', materialId: 'mat-1', cutWidthMm: 562, cutHeightMm: 100, canRotate: false },
      { id: '7', pieceId: 'rail-back', materialId: 'mat-1', cutWidthMm: 562, cutHeightMm: 100, canRotate: false },
    ];

    const result = runGuillotineNesting({ items, sheet: standardSheet });

    expect(result.unplacedPieces).toHaveLength(0);
    expect(result.sheets.length).toBeGreaterThan(0);

    for (const sheetResult of result.sheets) {
      checkNoOverlapAndInsideSheet(
        sheetResult.placedPieces,
        standardSheet.lengthMm,
        standardSheet.widthMm,
        standardSheet.trimMarginMm!,
        standardSheet.sawKerfMm!,
      );
    }
  });

  it('strictly respects grain direction when canRotate is false', () => {
    const items: NestingItem[] = [
      { id: 'p1', pieceId: 'grained-panel', materialId: 'mat-oak', cutWidthMm: 1200, cutHeightMm: 600, canRotate: false },
      { id: 'p2', pieceId: 'grained-door', materialId: 'mat-oak', cutWidthMm: 1400, cutHeightMm: 700, canRotate: false },
    ];

    const result = runGuillotineNesting({ items, sheet: standardSheet });

    expect(result.unplacedPieces).toHaveLength(0);
    const placed = result.sheets[0]?.placedPieces ?? [];

    for (const p of placed) {
      expect(p.rotated).toBe(false);
      const original = items.find((it) => it.pieceId === p.pieceId);
      expect(p.width).toBe(original?.cutWidthMm);
      expect(p.height).toBe(original?.cutHeightMm);
    }
  });

  it('rotates pieces when canRotate is true to fit into free rectangles', () => {
    // Sheet narrower than piece height, but piece width fits in sheet width
    const smallSheet: SheetDefinition = {
      materialId: 'mat-test',
      lengthMm: 1000,
      widthMm: 400,
      trimMarginMm: 0,
      sawKerfMm: 2,
    };

    // Item: width 350, height 800.
    // If not rotated, height 800 > sheet width 400 (fails along Y).
    // If rotated, width 800 <= 1000 and height 350 <= 400 (fits!).
    const items: NestingItem[] = [
      { id: 'p-rot', pieceId: 'rot-item', materialId: 'mat-test', cutWidthMm: 350, cutHeightMm: 800, canRotate: true },
    ];

    const result = runGuillotineNesting({ items, sheet: smallSheet });

    expect(result.unplacedPieces).toHaveLength(0);
    const placed = result.sheets[0]?.placedPieces[0];
    expect(placed?.rotated).toBe(true);
    expect(placed?.width).toBe(800);
    expect(placed?.height).toBe(350);
  });

  it('spills over into multiple sheets when items exceed one sheet capacity', () => {
    const smallSheet: SheetDefinition = {
      materialId: 'mat-1',
      lengthMm: 1000,
      widthMm: 1000,
      trimMarginMm: 0,
      sawKerfMm: 3,
    };

    // 4 pieces of 600x600 cannot all fit on one 1000x1000 sheet
    const items: NestingItem[] = [
      { id: '1', pieceId: 'p-1', materialId: 'mat-1', cutWidthMm: 600, cutHeightMm: 600, canRotate: false },
      { id: '2', pieceId: 'p-2', materialId: 'mat-1', cutWidthMm: 600, cutHeightMm: 600, canRotate: false },
      { id: '3', pieceId: 'p-3', materialId: 'mat-1', cutWidthMm: 600, cutHeightMm: 600, canRotate: false },
      { id: '4', pieceId: 'p-4', materialId: 'mat-1', cutWidthMm: 600, cutHeightMm: 600, canRotate: false },
    ];

    const result = runGuillotineNesting({ items, sheet: smallSheet });

    expect(result.unplacedPieces).toHaveLength(0);
    expect(result.totalSheets).toBeGreaterThanOrEqual(2);

    for (const sheetResult of result.sheets) {
      checkNoOverlapAndInsideSheet(
        sheetResult.placedPieces,
        smallSheet.lengthMm,
        smallSheet.widthMm,
        0,
        3,
      );
    }
  });

  it('runs nesting calculation via executeNesting client wrapper', async () => {
    const items: NestingItem[] = [
      { id: '1', pieceId: 'panel-1', materialId: 'mat-1', cutWidthMm: 600, cutHeightMm: 400, canRotate: false },
    ];

    const result = await executeNesting({ items, sheet: standardSheet });
    expect(result.unplacedPieces).toHaveLength(0);
    expect(result.sheets[0]?.placedPieces).toHaveLength(1);
  });

  it('counts cut passes including perimeter trim cuts', () => {
    const items: NestingItem[] = [
      { id: '1', pieceId: 'p-1', materialId: 'mat-1', cutWidthMm: 500, cutHeightMm: 400, canRotate: false },
      { id: '2', pieceId: 'p-2', materialId: 'mat-1', cutWidthMm: 500, cutHeightMm: 400, canRotate: false },
    ];

    const result = runGuillotineNesting({ items, sheet: standardSheet });
    expect(result.totalCutPasses).toBeGreaterThanOrEqual(4); // At least 4 perimeter trim cuts
    expect(result.sheets[0]?.cutPasses).toBe(result.totalCutPasses);
  });

  it('produces fewer or equal cut passes when optimizationGoal is min-passes compared to min-waste', () => {
    const items: NestingItem[] = [
      { id: '1', pieceId: 'p-1', materialId: 'mat-1', cutWidthMm: 600, cutHeightMm: 400, canRotate: false },
      { id: '2', pieceId: 'p-2', materialId: 'mat-1', cutWidthMm: 500, cutHeightMm: 400, canRotate: false },
      { id: '3', pieceId: 'p-3', materialId: 'mat-1', cutWidthMm: 400, cutHeightMm: 400, canRotate: false },
      { id: '4', pieceId: 'p-4', materialId: 'mat-1', cutWidthMm: 300, cutHeightMm: 200, canRotate: false },
    ];

    const minPassesResult = runGuillotineNesting({
      items,
      sheet: standardSheet,
      optimizationGoal: 'min-passes',
    });

    const minWasteResult = runGuillotineNesting({
      items,
      sheet: standardSheet,
      optimizationGoal: 'min-waste',
    });

    expect(minPassesResult.unplacedPieces).toHaveLength(0);
    expect(minWasteResult.unplacedPieces).toHaveLength(0);
    expect(minPassesResult.totalCutPasses).toBeLessThanOrEqual(minWasteResult.totalCutPasses);
  });

  it('runs multi-material nesting with independent runs per material', () => {
    const multiItems: NestingItem[] = [
      { id: '1', pieceId: 'side-l', materialId: 'mat-egger-white-18', cutWidthMm: 560, cutHeightMm: 720, canRotate: false },
      { id: '2', pieceId: 'side-r', materialId: 'mat-egger-white-18', cutWidthMm: 560, cutHeightMm: 720, canRotate: false },
      { id: '3', pieceId: 'front-1', materialId: 'mat-egger-oak-18', cutWidthMm: 496, cutHeightMm: 220, canRotate: false },
      { id: '4', pieceId: 'front-2', materialId: 'mat-egger-oak-18', cutWidthMm: 496, cutHeightMm: 220, canRotate: false },
      { id: '5', pieceId: 'box-side-1', materialId: 'mat-mdf-white-15', cutWidthMm: 500, cutHeightMm: 140, canRotate: false },
      { id: '6', pieceId: 'box-side-2', materialId: 'mat-mdf-white-15', cutWidthMm: 500, cutHeightMm: 140, canRotate: false },
    ];

    const result = runMultiMaterialGuillotineNesting({
      items: multiItems,
    });

    expect(result.unplacedPieces).toHaveLength(0);
    expect(Object.keys(result.resultsByMaterial)).toHaveLength(3);
    expect(result.resultsByMaterial['mat-egger-white-18']).toBeDefined();
    expect(result.resultsByMaterial['mat-egger-oak-18']).toBeDefined();
    expect(result.resultsByMaterial['mat-mdf-white-15']).toBeDefined();

    // Check sheets have the correct materials
    const materialsFound = result.sheets.map((s) => s.materialId);
    expect(materialsFound).toContain('mat-egger-white-18');
    expect(materialsFound).toContain('mat-egger-oak-18');
    expect(materialsFound).toContain('mat-mdf-white-15');
  });
});
