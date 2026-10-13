/**
 * Default shop saw kerf in millimeters. Marked TO_CONFIRM.
 */
export const DEFAULT_SAW_KERF_MM = 3.2;

/**
 * Default sheet trim margin in millimeters. Marked TO_CONFIRM.
 */
export const DEFAULT_TRIM_MARGIN_MM = 10;

export interface NestingItem {
  id: string;
  pieceId: string;
  name?: string;
  materialId: string;
  cutWidthMm: number;
  cutHeightMm: number;
  canRotate: boolean;
}

export interface SheetDefinition {
  materialId: string;
  lengthMm: number;
  widthMm: number;
  trimMarginMm?: number;
  sawKerfMm?: number;
}

export interface PlacedPiece {
  pieceId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
}

export interface FreeRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NestingSheetResult {
  sheetIndex: number;
  materialId: string;
  sheetLengthMm: number;
  sheetWidthMm: number;
  placedPieces: PlacedPiece[];
  utilizationPercentage: number;
  usedAreaM2: number;
  wasteAreaM2: number;
  cutPasses: number;
}

export interface NestingInput {
  items: NestingItem[];
  sheet: SheetDefinition;
  optimizationGoal?: 'min-waste' | 'min-passes';
}

export interface NestingResult {
  sheets: NestingSheetResult[];
  unplacedPieces: NestingItem[];
  totalSheets: number;
  overallUtilizationPercentage: number;
  totalCutPasses: number;
}

interface CutSegment {
  orientation: 'H' | 'V';
  coord: number;
  start: number;
  end: number;
}

/**
 * Counts the number of distinct continuous saw cut passes on a sheet layout.
 * Merges collinear contiguous cuts across strips.
 */
function countSheetCutPasses(
  segments: CutSegment[],
  trimMargin: number,
  sawKerf: number,
): number {
  let passes = 0;
  if (trimMargin > 0) {
    passes += 4; // 4 perimeter trim cuts
  }

  const hCuts = segments.filter((s) => s.orientation === 'H');
  const vCuts = segments.filter((s) => s.orientation === 'V');

  function mergeCollinear(list: CutSegment[]): number {
    const grouped = new Map<number, { start: number; end: number }[]>();
    for (const s of list) {
      const key = Math.round(s.coord * 10) / 10;
      const arr = grouped.get(key) ?? [];
      arr.push({ start: Math.min(s.start, s.end), end: Math.max(s.start, s.end) });
      grouped.set(key, arr);
    }

    let distinct = 0;
    for (const arr of grouped.values()) {
      arr.sort((a, b) => a.start - b.start);
      let currentEnd = -Infinity;
      for (const seg of arr) {
        if (seg.start <= currentEnd + sawKerf + 2) {
          currentEnd = Math.max(currentEnd, seg.end);
        } else {
          distinct++;
          currentEnd = seg.end;
        }
      }
    }
    return distinct;
  }

  passes += mergeCollinear(hCuts);
  passes += mergeCollinear(vCuts);

  return passes;
}

/**
 * Run guillotine 2D bin packing algorithm.
 */
export function runGuillotineNesting(input: NestingInput): NestingResult {
  const { sheet } = input;
  const sawKerf = sheet.sawKerfMm ?? DEFAULT_SAW_KERF_MM;
  const trimMargin = sheet.trimMarginMm ?? DEFAULT_TRIM_MARGIN_MM;
  const optimizationGoal = input.optimizationGoal ?? 'min-waste';

  // Usable sheet area inside trim margin
  const usableLength = sheet.lengthMm - 2 * trimMargin;
  const usableWidth = sheet.widthMm - 2 * trimMargin;

  if (usableLength <= 0 || usableWidth <= 0) {
    throw new Error('Sheet trim margin exceeds sheet dimensions');
  }

  // Sort items according to optimizationGoal
  const remainingItems: NestingItem[] = [...input.items].sort((a, b) => {
    if (optimizationGoal === 'min-passes') {
      // Group by cut height first to create continuous straight rip lines
      const heightDiff = b.cutHeightMm - a.cutHeightMm;
      if (Math.abs(heightDiff) > 0.001) return heightDiff;
      return b.cutWidthMm - a.cutWidthMm;
    }

    // Default min-waste: First Fit Decreasing by area, then max dimension
    const areaA = a.cutWidthMm * a.cutHeightMm;
    const areaB = b.cutWidthMm * b.cutHeightMm;
    if (areaB !== areaA) return areaB - areaA;
    return Math.max(b.cutWidthMm, b.cutHeightMm) - Math.max(a.cutWidthMm, a.cutHeightMm);
  });

  const sheetsResult: NestingSheetResult[] = [];
  let sheetIndex = 0;

  while (remainingItems.length > 0) {
    const placedOnCurrentSheet: PlacedPiece[] = [];
    const rawCutSegments: CutSegment[] = [];
    const freeRectangles: FreeRectangle[] = [
      {
        x: trimMargin,
        y: trimMargin,
        width: usableLength,
        height: usableWidth,
      },
    ];

    let itemsPlacedThisSheet = 0;

    for (let i = 0; i < remainingItems.length; ) {
      const item = remainingItems[i]!;

      // Find best free rectangle that can fit the item
      let bestRectIndex = -1;
      let bestRotated = false;
      let bestShortSideFit = Number.POSITIVE_INFINITY;

      for (let r = 0; r < freeRectangles.length; r++) {
        const freeRect = freeRectangles[r]!;

        // Test normal orientation
        if (item.cutWidthMm <= freeRect.width && item.cutHeightMm <= freeRect.height) {
          const shortSideFit = Math.min(
            freeRect.width - item.cutWidthMm,
            freeRect.height - item.cutHeightMm,
          );
          if (shortSideFit < bestShortSideFit) {
            bestShortSideFit = shortSideFit;
            bestRectIndex = r;
            bestRotated = false;
          }
        }

        // Test rotated orientation if allowed by grain
        if (
          item.canRotate &&
          item.cutHeightMm <= freeRect.width &&
          item.cutWidthMm <= freeRect.height
        ) {
          const shortSideFit = Math.min(
            freeRect.width - item.cutHeightMm,
            freeRect.height - item.cutWidthMm,
          );
          if (shortSideFit < bestShortSideFit) {
            bestShortSideFit = shortSideFit;
            bestRectIndex = r;
            bestRotated = true;
          }
        }
      }

      if (bestRectIndex !== -1) {
        const freeRect = freeRectangles[bestRectIndex]!;
        const pieceW = bestRotated ? item.cutHeightMm : item.cutWidthMm;
        const pieceH = bestRotated ? item.cutWidthMm : item.cutHeightMm;

        // Place the piece
        placedOnCurrentSheet.push({
          pieceId: item.pieceId,
          x: freeRect.x,
          y: freeRect.y,
          width: pieceW,
          height: pieceH,
          rotated: bestRotated,
        });

        // Remove the used free rectangle
        freeRectangles.splice(bestRectIndex, 1);

        // Split remainder using guillotine cut
        const remainW = freeRect.width - pieceW - sawKerf;
        const remainH = freeRect.height - pieceH - sawKerf;

        // Choose guillotine split orientation based on optimization goal
        const splitHorizontally =
          optimizationGoal === 'min-passes' ? true : remainW >= remainH;

        if (splitHorizontally) {
          if (remainH > 0) {
            freeRectangles.push({
              x: freeRect.x,
              y: freeRect.y + pieceH + sawKerf,
              width: freeRect.width,
              height: remainH,
            });
            rawCutSegments.push({
              orientation: 'H',
              coord: freeRect.y + pieceH,
              start: freeRect.x,
              end: freeRect.x + freeRect.width,
            });
          }
          if (remainW > 0) {
            freeRectangles.push({
              x: freeRect.x + pieceW + sawKerf,
              y: freeRect.y,
              width: remainW,
              height: pieceH,
            });
            rawCutSegments.push({
              orientation: 'V',
              coord: freeRect.x + pieceW,
              start: freeRect.y,
              end: freeRect.y + pieceH,
            });
          }
        } else {
          if (remainW > 0) {
            freeRectangles.push({
              x: freeRect.x + pieceW + sawKerf,
              y: freeRect.y,
              width: remainW,
              height: freeRect.height,
            });
            rawCutSegments.push({
              orientation: 'V',
              coord: freeRect.x + pieceW,
              start: freeRect.y,
              end: freeRect.y + freeRect.height,
            });
          }
          if (remainH > 0) {
            freeRectangles.push({
              x: freeRect.x,
              y: freeRect.y + pieceH + sawKerf,
              width: pieceW,
              height: remainH,
            });
            rawCutSegments.push({
              orientation: 'H',
              coord: freeRect.y + pieceH,
              start: freeRect.x,
              end: freeRect.x + pieceW,
            });
          }
        }

        // Remove item from remaining list
        remainingItems.splice(i, 1);
        itemsPlacedThisSheet++;
      } else {
        // Try next item
        i++;
      }
    }

    if (itemsPlacedThisSheet === 0) {
      // Remaining items cannot fit in any sheet of this size
      break;
    }

    // Compute sheet utilization
    const sheetTotalAreaM2 = (sheet.lengthMm * sheet.widthMm) / 1_000_000;
    const usedAreaM2 = placedOnCurrentSheet.reduce(
      (sum, p) => sum + (p.width * p.height) / 1_000_000,
      0,
    );
    const wasteAreaM2 = Math.max(0, sheetTotalAreaM2 - usedAreaM2);
    const utilizationPercentage = Number(
      ((usedAreaM2 / sheetTotalAreaM2) * 100).toFixed(2),
    );

    const cutPasses = countSheetCutPasses(rawCutSegments, trimMargin, sawKerf);

    sheetsResult.push({
      sheetIndex,
      materialId: sheet.materialId,
      sheetLengthMm: sheet.lengthMm,
      sheetWidthMm: sheet.widthMm,
      placedPieces: placedOnCurrentSheet,
      utilizationPercentage,
      usedAreaM2: Number(usedAreaM2.toFixed(4)),
      wasteAreaM2: Number(wasteAreaM2.toFixed(4)),
      cutPasses,
    });

    sheetIndex++;
  }

  const totalSheets = sheetsResult.length;
  const overallUtilizationPercentage = totalSheets > 0
    ? Number(
        (
          sheetsResult.reduce((sum, s) => sum + s.utilizationPercentage, 0) /
          totalSheets
        ).toFixed(2),
      )
    : 0;

  const totalCutPasses = sheetsResult.reduce((sum, s) => sum + s.cutPasses, 0);

  return {
    sheets: sheetsResult,
    unplacedPieces: remainingItems,
    totalSheets,
    overallUtilizationPercentage,
    totalCutPasses,
  };
}
