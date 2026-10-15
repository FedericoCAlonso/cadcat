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
  isAuxiliary?: boolean;
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
  isAuxiliary?: boolean;
  fitsInOffcut?: boolean;
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

export interface MultiMaterialNestingInput {
  items: NestingItem[];
  defaultSheet?: SheetDefinition;
  sheetLookup?: (materialId: string) => SheetDefinition | undefined;
  optimizationGoal?: 'min-waste' | 'min-passes';
}

export interface MultiMaterialNestingResult extends NestingResult {
  resultsByMaterial: Record<string, NestingResult>;
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

interface PackingStrategyConfig {
  name: string;
  sortOrder: 'height-desc' | 'width-desc' | 'area-desc' | 'max-dim-desc' | 'strip-grouped';
  splitMode: 'horizontal' | 'vertical' | 'adaptive';
  preferExactFit: boolean;
}

function sortNestingItemsWithStrategy(
  items: NestingItem[],
  strategy: PackingStrategyConfig,
): NestingItem[] {
  if (strategy.sortOrder === 'strip-grouped') {
    return [...items].sort((a, b) => {
      const hd = b.cutHeightMm - a.cutHeightMm;
      if (Math.abs(hd) > 0.001) return hd;
      return b.cutWidthMm - a.cutWidthMm;
    });
  }
  if (strategy.sortOrder === 'height-desc') {
    return [...items].sort((a, b) => {
      const hd = b.cutHeightMm - a.cutHeightMm;
      if (Math.abs(hd) > 0.001) return hd;
      return b.cutWidthMm - a.cutWidthMm;
    });
  }
  if (strategy.sortOrder === 'width-desc') {
    return [...items].sort((a, b) => {
      const wd = b.cutWidthMm - a.cutWidthMm;
      if (Math.abs(wd) > 0.001) return wd;
      return b.cutHeightMm - a.cutHeightMm;
    });
  }
  if (strategy.sortOrder === 'max-dim-desc') {
    return [...items].sort((a, b) => {
      const maxA = Math.max(a.cutWidthMm, a.cutHeightMm);
      const maxB = Math.max(b.cutWidthMm, b.cutHeightMm);
      if (maxB !== maxA) return maxB - maxA;
      return b.cutWidthMm * b.cutHeightMm - a.cutWidthMm * a.cutHeightMm;
    });
  }
  // area-desc (default)
  return [...items].sort((a, b) => {
    const areaA = a.cutWidthMm * a.cutHeightMm;
    const areaB = b.cutWidthMm * b.cutHeightMm;
    if (areaB !== areaA) return areaB - areaA;
    return Math.max(b.cutWidthMm, b.cutHeightMm) - Math.max(a.cutWidthMm, a.cutHeightMm);
  });
}

function scorePlacement(
  pieceW: number,
  pieceH: number,
  freeRect: FreeRectangle,
  preferExactFit: boolean,
): number {
  if (pieceW > freeRect.width || pieceH > freeRect.height) {
    return Number.POSITIVE_INFINITY;
  }
  const remW = freeRect.width - pieceW;
  const remH = freeRect.height - pieceH;

  if (preferExactFit) {
    // Perfect match in both dimensions: 0 cuts, 0 kerf consumed
    if (remW === 0 && remH === 0) return 0;
    // Exact strip height match: 1 cut across strip, no leftover strip height
    if (remH === 0) return 1 + remW / 10000;
    // Exact column width match: 1 cut across column, no leftover column width
    if (remW === 0) return 1 + remH / 10000;
  }

  // Best Short Side Fit (BSSF)
  return 100 + Math.min(remW, remH);
}

function tryPlaceItemWithStrategy(
  item: NestingItem,
  freeRectangles: FreeRectangle[],
  sawKerf: number,
  strategy: PackingStrategyConfig,
  rawCutSegments: CutSegment[],
  isOffcut: boolean,
): PlacedPiece | null {
  let bestRectIndex = -1;
  let bestRotated = false;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let r = 0; r < freeRectangles.length; r++) {
    const freeRect = freeRectangles[r]!;

    // Non-rotated orientation
    const normalScore = scorePlacement(
      item.cutWidthMm,
      item.cutHeightMm,
      freeRect,
      strategy.preferExactFit,
    );
    if (normalScore < bestScore) {
      bestScore = normalScore;
      bestRectIndex = r;
      bestRotated = false;
    }

    // Rotated orientation (if allowed by grain / material)
    if (item.canRotate) {
      const rotScore = scorePlacement(
        item.cutHeightMm,
        item.cutWidthMm,
        freeRect,
        strategy.preferExactFit,
      );
      if (rotScore < bestScore) {
        bestScore = rotScore;
        bestRectIndex = r;
        bestRotated = true;
      }
    }
  }

  if (bestRectIndex === -1 || !Number.isFinite(bestScore)) return null;

  const freeRect = freeRectangles[bestRectIndex]!;
  const pieceW = bestRotated ? item.cutHeightMm : item.cutWidthMm;
  const pieceH = bestRotated ? item.cutWidthMm : item.cutHeightMm;

  freeRectangles.splice(bestRectIndex, 1);

  const remainW = freeRect.width - pieceW - sawKerf;
  const remainH = freeRect.height - pieceH - sawKerf;

  let splitHorizontally: boolean;
  if (strategy.splitMode === 'horizontal') {
    splitHorizontally = true;
  } else if (strategy.splitMode === 'vertical') {
    splitHorizontally = false;
  } else {
    // adaptive
    splitHorizontally = remainW >= remainH;
  }

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
        start: freeRect.y,
        end: freeRect.x + pieceW,
      });
    }
  }

  return {
    pieceId: item.pieceId,
    x: freeRect.x,
    y: freeRect.y,
    width: pieceW,
    height: pieceH,
    rotated: bestRotated,
    isAuxiliary: item.isAuxiliary,
    fitsInOffcut: isOffcut,
  };
}

function executeSingleStrategy(
  input: NestingInput,
  strategy: PackingStrategyConfig,
): NestingResult {
  const { sheet } = input;
  const sawKerf = sheet.sawKerfMm ?? DEFAULT_SAW_KERF_MM;
  const trimMargin = sheet.trimMarginMm ?? DEFAULT_TRIM_MARGIN_MM;

  const usableLength = sheet.lengthMm - 2 * trimMargin;
  const usableWidth = sheet.widthMm - 2 * trimMargin;

  if (usableLength <= 0 || usableWidth <= 0) {
    throw new Error('Sheet trim margin exceeds sheet dimensions');
  }

  const primaryItems = sortNestingItemsWithStrategy(
    input.items.filter((it) => !it.isAuxiliary),
    strategy,
  );
  const auxiliaryItems = sortNestingItemsWithStrategy(
    input.items.filter((it) => it.isAuxiliary),
    strategy,
  );

  interface SheetState {
    sheetIndex: number;
    placedPieces: PlacedPiece[];
    rawCutSegments: CutSegment[];
    freeRectangles: FreeRectangle[];
  }

  const sheetStates: SheetState[] = [];
  let sheetIndex = 0;

  // Step 1: Pack primary items
  while (primaryItems.length > 0) {
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

    for (let i = 0; i < primaryItems.length; ) {
      const item = primaryItems[i]!;
      const placed = tryPlaceItemWithStrategy(
        item,
        freeRectangles,
        sawKerf,
        strategy,
        rawCutSegments,
        false,
      );

      if (placed) {
        placedOnCurrentSheet.push(placed);
        primaryItems.splice(i, 1);
        itemsPlacedThisSheet++;
      } else {
        i++;
      }
    }

    if (itemsPlacedThisSheet === 0) {
      break;
    }

    sheetStates.push({
      sheetIndex,
      placedPieces: placedOnCurrentSheet,
      rawCutSegments,
      freeRectangles,
    });
    sheetIndex++;
  }

  // Step 2: Pack auxiliary pieces into unused offcuts
  for (const sheetState of sheetStates) {
    for (let i = 0; i < auxiliaryItems.length; ) {
      const auxItem = auxiliaryItems[i]!;
      const placed = tryPlaceItemWithStrategy(
        auxItem,
        sheetState.freeRectangles,
        sawKerf,
        strategy,
        sheetState.rawCutSegments,
        true,
      );

      if (placed) {
        sheetState.placedPieces.push(placed);
        auxiliaryItems.splice(i, 1);
      } else {
        i++;
      }
    }
  }

  // Step 3: Remaining auxiliary pieces into new sheets if needed
  const unplacedPrimary = [...primaryItems];
  while (auxiliaryItems.length > 0) {
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

    for (let i = 0; i < auxiliaryItems.length; ) {
      const auxItem = auxiliaryItems[i]!;
      const placed = tryPlaceItemWithStrategy(
        auxItem,
        freeRectangles,
        sawKerf,
        strategy,
        rawCutSegments,
        false,
      );

      if (placed) {
        placedOnCurrentSheet.push(placed);
        auxiliaryItems.splice(i, 1);
        itemsPlacedThisSheet++;
      } else {
        i++;
      }
    }

    if (itemsPlacedThisSheet === 0) {
      break;
    }

    sheetStates.push({
      sheetIndex,
      placedPieces: placedOnCurrentSheet,
      rawCutSegments,
      freeRectangles,
    });
    sheetIndex++;
  }

  const sheetTotalAreaM2 = (sheet.lengthMm * sheet.widthMm) / 1_000_000;
  const sheetsResult: NestingSheetResult[] = sheetStates.map((s) => {
    const usedAreaM2 = s.placedPieces.reduce(
      (sum, p) => sum + (p.width * p.height) / 1_000_000,
      0,
    );
    const wasteAreaM2 = Math.max(0, sheetTotalAreaM2 - usedAreaM2);
    const utilizationPercentage = Number(
      ((usedAreaM2 / sheetTotalAreaM2) * 100).toFixed(2),
    );
    const cutPasses = countSheetCutPasses(s.rawCutSegments, trimMargin, sawKerf);

    return {
      sheetIndex: s.sheetIndex,
      materialId: sheet.materialId,
      sheetLengthMm: sheet.lengthMm,
      sheetWidthMm: sheet.widthMm,
      placedPieces: s.placedPieces,
      utilizationPercentage,
      usedAreaM2: Number(usedAreaM2.toFixed(4)),
      wasteAreaM2: Number(wasteAreaM2.toFixed(4)),
      cutPasses,
    };
  });

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
  const unplacedPieces = [...unplacedPrimary, ...auxiliaryItems];

  return {
    sheets: sheetsResult,
    unplacedPieces,
    totalSheets,
    overallUtilizationPercentage,
    totalCutPasses,
  };
}

function isCandidateBetter(
  candidate: NestingResult,
  current: NestingResult,
  goal: 'min-waste' | 'min-passes',
): boolean {
  // 1. Fewer unplaced pieces
  if (candidate.unplacedPieces.length !== current.unplacedPieces.length) {
    return candidate.unplacedPieces.length < current.unplacedPieces.length;
  }
  // 2. Fewer total sheets
  if (candidate.totalSheets !== current.totalSheets) {
    return candidate.totalSheets < current.totalSheets;
  }
  // 3. Goal specific:
  if (goal === 'min-passes') {
    if (candidate.totalCutPasses !== current.totalCutPasses) {
      return candidate.totalCutPasses < current.totalCutPasses;
    }
    return candidate.overallUtilizationPercentage > current.overallUtilizationPercentage;
  } else {
    // min-waste
    if (Math.abs(candidate.overallUtilizationPercentage - current.overallUtilizationPercentage) > 0.05) {
      return candidate.overallUtilizationPercentage > current.overallUtilizationPercentage;
    }
    return candidate.totalCutPasses < current.totalCutPasses;
  }
}

/**
 * Run guillotine 2D bin packing algorithm using multi-heuristic ensemble optimization.
 * Evaluates strip grouping, rip/cross splitting, exact-match priorities, and area packing,
 * selecting the optimal layout that minimizes sheets, waste, and saw cut passes.
 * Implements two-step nesting: primary pieces first, then auxiliary gauge pieces into unused offcuts.
 */
export function runGuillotineNesting(input: NestingInput): NestingResult {
  const optimizationGoal = input.optimizationGoal ?? 'min-waste';

  const candidateStrategies: PackingStrategyConfig[] = [
    {
      name: 'strip-grouped-h',
      sortOrder: 'strip-grouped',
      splitMode: 'horizontal',
      preferExactFit: true,
    },
    {
      name: 'height-desc-h',
      sortOrder: 'height-desc',
      splitMode: 'horizontal',
      preferExactFit: true,
    },
    {
      name: 'width-desc-v',
      sortOrder: 'width-desc',
      splitMode: 'vertical',
      preferExactFit: true,
    },
    {
      name: 'area-desc-adaptive',
      sortOrder: 'area-desc',
      splitMode: 'adaptive',
      preferExactFit: true,
    },
    {
      name: 'max-dim-desc-adaptive',
      sortOrder: 'max-dim-desc',
      splitMode: 'adaptive',
      preferExactFit: true,
    },
  ];

  let bestResult: NestingResult | null = null;

  for (const strategy of candidateStrategies) {
    const result = executeSingleStrategy(input, strategy);

    if (!bestResult) {
      bestResult = result;
      continue;
    }

    if (isCandidateBetter(result, bestResult, optimizationGoal)) {
      bestResult = result;
    }
  }

  return bestResult!;
}

/**
 * Executes independent guillotine nesting runs for each unique material present in items.
 */
export function runMultiMaterialGuillotineNesting(
  input: MultiMaterialNestingInput,
): MultiMaterialNestingResult {
  const { items, defaultSheet, sheetLookup, optimizationGoal } = input;

  // Group items by materialId
  const itemsByMaterial = new Map<string, NestingItem[]>();
  for (const item of items) {
    const list = itemsByMaterial.get(item.materialId);
    if (list) {
      list.push(item);
    } else {
      itemsByMaterial.set(item.materialId, [item]);
    }
  }

  const resultsByMaterial: Record<string, NestingResult> = {};
  const allSheets: NestingSheetResult[] = [];
  const allUnplaced: NestingItem[] = [];
  let sheetIndexOffset = 1;

  for (const [materialId, matItems] of itemsByMaterial.entries()) {
    const sheetDef =
      sheetLookup?.(materialId) ??
      (defaultSheet
        ? { ...defaultSheet, materialId }
        : {
            materialId,
            lengthMm: 2800,
            widthMm: 2070,
            trimMarginMm: DEFAULT_TRIM_MARGIN_MM,
            sawKerfMm: DEFAULT_SAW_KERF_MM,
          });

    const singleResult = runGuillotineNesting({
      items: matItems,
      sheet: sheetDef,
      optimizationGoal,
    });

    resultsByMaterial[materialId] = singleResult;

    for (const sheet of singleResult.sheets) {
      allSheets.push({
        ...sheet,
        sheetIndex: sheetIndexOffset++,
      });
    }

    allUnplaced.push(...singleResult.unplacedPieces);
  }

  const totalSheets = allSheets.length;
  const overallUtilizationPercentage =
    totalSheets > 0
      ? Number(
          (
            allSheets.reduce((sum, s) => sum + s.utilizationPercentage, 0) /
            totalSheets
          ).toFixed(2),
        )
      : 0;

  const totalCutPasses = allSheets.reduce((sum, s) => sum + s.cutPasses, 0);

  return {
    sheets: allSheets,
    unplacedPieces: allUnplaced,
    totalSheets,
    overallUtilizationPercentage,
    totalCutPasses,
    resultsByMaterial,
  };
}

