import type {
  Rect,
  PlacedPartInstance,
  SheetLayout,
  CutOp,
  Settings,
  SheetType,
} from './types';
import type { PreprocessedPartInstance, MaterialSheetInfo } from './preprocessor';
import { resolveGrain } from './grain';

export type PlacementScoreRule = 'BSSF' | 'BLSF' | 'BAF';
export type SplitRule = 'SHORTER_LEFTOVER_AXIS' | 'LONGER_LEFTOVER_AXIS' | 'SHORTER_AXIS' | 'LONGER_AXIS' | 'MAX_AREA';

export interface FreeRect extends Rect {
  stage: number;
  lastCutDir: 'H' | 'V' | null;
}

export interface SheetState {
  sheetIndex: number;
  sheetTypeIndex: number;
  sheetType: SheetType;
  sheetLengthMm: number;
  sheetWidthMm: number;
  usableLengthMm: number;
  usableWidthMm: number;
  freeRects: FreeRect[];
  placements: PlacedPartInstance[];
  cuts: CutOp[];
}

export interface ConstructorGuillotineOptions {
  scoreRule?: PlacementScoreRule;
  splitRule?: SplitRule;
  firstCutDir?: 'H' | 'V';
  allowRotationFlips?: boolean;
}

interface BestFitCandidate {
  sheetStateIndex: number;
  freeRectIndex: number;
  rotated: boolean;
  pw: number;
  ph: number;
  score1: number;
  score2: number;
}

const EPSILON = 1e-4;

/**
 * Constructor A: Free Guillotine Rectangles (Panel Saw).
 * Implements Section 6.2 with replaceable scoring, replaceable split rules,
 * kerf subtraction, free rectangle merging, and staged cuts.
 */
export class ConstructorGuillotine {
  private settings: Settings;
  private scoreRule: PlacementScoreRule;
  private splitRule: SplitRule;
  private firstCutDir: 'H' | 'V';

  constructor(settings: Settings, options?: ConstructorGuillotineOptions) {
    this.settings = settings;
    this.scoreRule = options?.scoreRule ?? 'BSSF';
    this.splitRule = options?.splitRule ?? 'SHORTER_LEFTOVER_AXIS';
    this.firstCutDir = options?.firstCutDir ?? 'V';
  }

  /**
   * Builds sheet layouts for a list of part instances on available sheets of a single material.
   */
  build(
    parts: readonly PreprocessedPartInstance[],
    availableSheets: readonly MaterialSheetInfo[],
    usedSheetCounts: Map<number, number>,
  ): {
    sheets: SheetLayout[];
    unplacedParts: PreprocessedPartInstance[];
  } {
    const sheets: SheetState[] = [];
    const unplacedParts: PreprocessedPartInstance[] = [];
    const kerf = this.settings.kerfMm;

    // Helper to open a new sheet
    const openSheet = (minRequiredW = 0, minRequiredH = 0): SheetState | null => {
      // Find eligible sheet type with lowest price
      let bestSheetInfo: MaterialSheetInfo | null = null;
      let minPrice = Infinity;

      for (const info of availableSheets) {
        const currentlyUsed = usedSheetCounts.get(info.sheetIndex) ?? 0;
        if (currentlyUsed >= info.sheetType.available) {
          continue;
        }

        // Check if required piece can fit in this sheet type
        const fitsNormal = minRequiredW <= info.usableLengthMm + EPSILON && minRequiredH <= info.usableWidthMm + EPSILON;
        const fitsRotated = minRequiredH <= info.usableLengthMm + EPSILON && minRequiredW <= info.usableWidthMm + EPSILON;
        if (!fitsNormal && !fitsRotated) {
          continue;
        }

        const price = info.sheetType.pricePerSheet ?? 0;
        if (price < minPrice) {
          minPrice = price;
          bestSheetInfo = info;
        }
      }

      if (!bestSheetInfo) {
        return null; // No available sheet can fit or stock exhausted
      }

      // Record sheet usage
      const count = usedSheetCounts.get(bestSheetInfo.sheetIndex) ?? 0;
      usedSheetCounts.set(bestSheetInfo.sheetIndex, count + 1);

      const trim = this.settings.trimMm;
      const initialFreeRect: FreeRect = {
        x: trim.left,
        y: trim.bottom,
        w: bestSheetInfo.usableLengthMm,
        h: bestSheetInfo.usableWidthMm,
        stage: 1,
        lastCutDir: null,
      };

      const trimCuts: CutOp[] = [];
      let cutOrder = 1;

      // Add trim cuts if trim > 0
      if (trim.bottom > 0) {
        trimCuts.push({
          order: cutOrder++,
          stage: 0,
          dir: 'H',
          pos: trim.bottom,
          from: 0,
          to: bestSheetInfo.sheetType.lengthMm,
          isTrim: true,
        });
      }
      if (trim.top > 0) {
        trimCuts.push({
          order: cutOrder++,
          stage: 0,
          dir: 'H',
          pos: bestSheetInfo.sheetType.widthMm - trim.top,
          from: 0,
          to: bestSheetInfo.sheetType.lengthMm,
          isTrim: true,
        });
      }
      if (trim.left > 0) {
        trimCuts.push({
          order: cutOrder++,
          stage: 0,
          dir: 'V',
          pos: trim.left,
          from: 0,
          to: bestSheetInfo.sheetType.widthMm,
          isTrim: true,
        });
      }
      if (trim.right > 0) {
        trimCuts.push({
          order: cutOrder++,
          stage: 0,
          dir: 'V',
          pos: bestSheetInfo.sheetType.lengthMm - trim.right,
          from: 0,
          to: bestSheetInfo.sheetType.widthMm,
          isTrim: true,
        });
      }

      const newState: SheetState = {
        sheetIndex: sheets.length,
        sheetTypeIndex: bestSheetInfo.sheetIndex,
        sheetType: bestSheetInfo.sheetType,
        sheetLengthMm: bestSheetInfo.sheetType.lengthMm,
        sheetWidthMm: bestSheetInfo.sheetType.widthMm,
        usableLengthMm: bestSheetInfo.usableLengthMm,
        usableWidthMm: bestSheetInfo.usableWidthMm,
        freeRects: [initialFreeRect],
        placements: [],
        cuts: trimCuts,
      };

      sheets.push(newState);
      return newState;
    };

    // Pack each part
    for (const part of parts) {
      let candidate = this.findBestCandidate(part, sheets);

      if (!candidate) {
        // Try opening a new sheet
        const newSheet = openSheet(part.cutLengthMm, part.cutWidthMm);
        if (newSheet) {
          candidate = this.findBestCandidate(part, [newSheet]);
          if (candidate) {
            candidate.sheetStateIndex = sheets.length - 1;
          }
        }
      }

      if (!candidate) {
        unplacedParts.push(part);
        continue;
      }

      const sheet = sheets[candidate.sheetStateIndex]!;
      const freeRect = sheet.freeRects[candidate.freeRectIndex]!;
      sheet.freeRects.splice(candidate.freeRectIndex, 1);

      // Place part in bottom-left corner of freeRect
      const px = freeRect.x;
      const py = freeRect.y;
      const pw = candidate.pw;
      const ph = candidate.ph;

      const placement: PlacedPartInstance = {
        partId: part.partId,
        instance: part.instance,
        x: px,
        y: py,
        w: pw,
        h: ph,
        rotated: candidate.rotated,
        cutLengthMm: part.cutLengthMm,
        cutWidthMm: part.cutWidthMm,
        finishedLengthMm: part.finishedLengthMm,
        finishedWidthMm: part.finishedWidthMm,
        isFiller: part.isFiller,
        grainRelaxed: !candidate.rotated ? false : resolveGrain(part, sheet.sheetType).grainRelaxed,
      };

      sheet.placements.push(placement);

      // Split the free rectangle
      this.splitFreeRect(sheet, freeRect, pw, ph, kerf);

      // Merge touching free rectangles
      this.mergeFreeRects(sheet.freeRects, kerf);
    }

    // Build SheetLayout results
    const resultSheets: SheetLayout[] = [];
    const minOffcutMm = this.settings.cost?.minOffcutMm ?? 300;

    for (const sheet of sheets) {
      const offcuts: Rect[] = [];
      let wasteAreaMm2 = 0;

      for (const fr of sheet.freeRects) {
        if (fr.w >= minOffcutMm && fr.h >= minOffcutMm) {
          offcuts.push({ x: fr.x, y: fr.y, w: fr.w, h: fr.h });
        } else {
          wasteAreaMm2 += fr.w * fr.h;
        }
      }

      const placedArea = sheet.placements.reduce((sum, p) => sum + p.w * p.h, 0);
      const usableArea = sheet.usableLengthMm * sheet.usableWidthMm;
      const totalKerfAndOffcut = usableArea - placedArea;
      wasteAreaMm2 = Math.max(0, totalKerfAndOffcut - offcuts.reduce((s, o) => s + o.w * o.h, 0));

      // Order cut sequence
      const orderedCuts = this.orderCutSequence(sheet.cuts);
      const chargedPasses = orderedCuts.filter(
        (c) => !c.isTrim || this.settings.trimCutsAreCharged,
      ).length;
      const cutLengthM = orderedCuts.reduce((sum, c) => sum + Math.abs(c.to - c.from), 0) / 1000;

      resultSheets.push({
        sheetTypeIndex: sheet.sheetTypeIndex,
        sheetLengthMm: sheet.sheetLengthMm,
        sheetWidthMm: sheet.sheetWidthMm,
        isOffcut: sheet.sheetType.isOffcut,
        placements: sheet.placements,
        cutSequence: orderedCuts,
        offcuts,
        wasteAreaMm2: Math.round(wasteAreaMm2),
        usedAreaMm2: placedArea,
        passes: chargedPasses,
        cutLengthM: Math.round(cutLengthM * 100) / 100,
      });
    }

    return {
      sheets: resultSheets,
      unplacedParts,
    };
  }

  private findBestCandidate(
    part: PreprocessedPartInstance,
    sheets: SheetState[],
  ): BestFitCandidate | null {
    let bestCandidate: BestFitCandidate | null = null;

    for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
      const sheet = sheets[sIdx]!;
      const grainRes = resolveGrain(part, sheet.sheetType);

      for (let rIdx = 0; rIdx < sheet.freeRects.length; rIdx++) {
        const fr = sheet.freeRects[rIdx]!;

        // 1. Try unrotated
        if (part.cutLengthMm <= fr.w + EPSILON && part.cutWidthMm <= fr.h + EPSILON) {
          const score = this.calculateFitScore(fr.w, fr.h, part.cutLengthMm, part.cutWidthMm);
          if (this.isScoreBetter(score, bestCandidate)) {
            bestCandidate = {
              sheetStateIndex: sIdx,
              freeRectIndex: rIdx,
              rotated: false,
              pw: part.cutLengthMm,
              ph: part.cutWidthMm,
              score1: score.score1,
              score2: score.score2,
            };
          }
        }

        // 2. Try rotated (if allowed)
        if (grainRes.canRotate) {
          if (part.cutWidthMm <= fr.w + EPSILON && part.cutLengthMm <= fr.h + EPSILON) {
            const score = this.calculateFitScore(fr.w, fr.h, part.cutWidthMm, part.cutLengthMm);
            if (this.isScoreBetter(score, bestCandidate)) {
              bestCandidate = {
                sheetStateIndex: sIdx,
                freeRectIndex: rIdx,
                rotated: true,
                pw: part.cutWidthMm,
                ph: part.cutLengthMm,
                score1: score.score1,
                score2: score.score2,
              };
            }
          }
        }
      }
    }

    return bestCandidate;
  }

  private calculateFitScore(
    rw: number,
    rh: number,
    pw: number,
    ph: number,
  ): { score1: number; score2: number } {
    const remX = rw - pw;
    const remY = rh - ph;

    switch (this.scoreRule) {
      case 'BLSF': {
        const s1 = Math.max(remX, remY);
        const s2 = Math.min(remX, remY);
        return { score1: s1, score2: s2 };
      }
      case 'BAF': {
        const s1 = rw * rh - pw * ph;
        const s2 = Math.min(remX, remY);
        return { score1: s1, score2: s2 };
      }
      case 'BSSF':
      default: {
        const s1 = Math.min(remX, remY);
        const s2 = Math.max(remX, remY);
        return { score1: s1, score2: s2 };
      }
    }
  }

  private isScoreBetter(
    newScore: { score1: number; score2: number },
    currentBest: BestFitCandidate | null,
  ): boolean {
    if (!currentBest) return true;
    if (newScore.score1 < currentBest.score1 - EPSILON) return true;
    if (newScore.score1 > currentBest.score1 + EPSILON) return false;
    return newScore.score2 < currentBest.score2 - EPSILON;
  }

  private splitFreeRect(
    sheet: SheetState,
    fr: FreeRect,
    pw: number,
    ph: number,
    kerf: number,
  ): void {
    const rw = fr.w;
    const rh = fr.h;
    const rx = fr.x;
    const ry = fr.y;

    // Remaining dimensions after placement
    const remW = rw - pw;
    const remH = rh - ph;

    // Check if cuts are needed
    const needsVerticalCut = remW > EPSILON;
    const needsHorizontalCut = remH > EPSILON;

    if (!needsVerticalCut && !needsHorizontalCut) {
      return; // Exact fit, no new rectangles
    }

    // Determine split direction: 'H' (horizontal cut across width) or 'V' (vertical cut across height)
    let splitDirection: 'H' | 'V' = 'H';

    // Staged cut filter
    const maxStages = this.settings.maxStages;
    if (maxStages > 0 && fr.stage === 1 && fr.lastCutDir === null) {
      splitDirection = this.firstCutDir;
    } else if (maxStages > 0 && fr.stage >= maxStages && fr.lastCutDir !== null) {
      // Must stay in same direction if at stage limit
      splitDirection = fr.lastCutDir;
    } else {
      switch (this.splitRule) {
        case 'LONGER_LEFTOVER_AXIS':
          splitDirection = remW > remH ? 'H' : 'V';
          break;
        case 'SHORTER_AXIS':
          splitDirection = rw <= rh ? 'H' : 'V';
          break;
        case 'LONGER_AXIS':
          splitDirection = rw > rh ? 'H' : 'V';
          break;
        case 'MAX_AREA': {
          const areaH = Math.max(rw * Math.max(0, remH - kerf), Math.max(0, remW - kerf) * ph);
          const areaV = Math.max(Math.max(0, remW - kerf) * rh, pw * Math.max(0, remH - kerf));
          splitDirection = areaH >= areaV ? 'H' : 'V';
          break;
        }
        case 'SHORTER_LEFTOVER_AXIS':
        default:
          splitDirection = remW <= remH ? 'H' : 'V';
          break;
      }
    }

    // Perform split
    let nextStage = fr.stage;
    if (fr.lastCutDir !== null && fr.lastCutDir !== splitDirection) {
      nextStage = fr.stage + 1;
    }

    if (splitDirection === 'H') {
      // Horizontal cut across fr.w at y = ry + ph
      if (needsHorizontalCut) {
        const cutY = ry + ph;
        sheet.cuts.push({
          order: sheet.cuts.length + 1,
          stage: fr.stage,
          dir: 'H',
          pos: cutY,
          from: rx,
          to: rx + rw,
          isTrim: false,
        });

        // Top rectangle
        const topH = remH - kerf;
        if (topH > EPSILON) {
          sheet.freeRects.push({
            x: rx,
            y: cutY + kerf,
            w: rw,
            h: topH,
            stage: nextStage,
            lastCutDir: 'H',
          });
        }
      }

      // Vertical cut for right rectangle (if needed)
      if (needsVerticalCut) {
        const cutX = rx + pw;
        sheet.cuts.push({
          order: sheet.cuts.length + 1,
          stage: nextStage + 1,
          dir: 'V',
          pos: cutX,
          from: ry,
          to: ry + ph,
          isTrim: false,
        });

        const rightW = remW - kerf;
        if (rightW > EPSILON) {
          sheet.freeRects.push({
            x: cutX + kerf,
            y: ry,
            w: rightW,
            h: ph,
            stage: nextStage + 1,
            lastCutDir: 'V',
          });
        }
      }
    } else {
      // Vertical cut across fr.h at x = rx + pw
      if (needsVerticalCut) {
        const cutX = rx + pw;
        sheet.cuts.push({
          order: sheet.cuts.length + 1,
          stage: fr.stage,
          dir: 'V',
          pos: cutX,
          from: ry,
          to: ry + rh,
          isTrim: false,
        });

        // Right rectangle
        const rightW = remW - kerf;
        if (rightW > EPSILON) {
          sheet.freeRects.push({
            x: cutX + kerf,
            y: ry,
            w: rightW,
            h: rh,
            stage: nextStage,
            lastCutDir: 'V',
          });
        }
      }

      // Horizontal cut for top rectangle (if needed)
      if (needsHorizontalCut) {
        const cutY = ry + ph;
        sheet.cuts.push({
          order: sheet.cuts.length + 1,
          stage: nextStage + 1,
          dir: 'H',
          pos: cutY,
          from: rx,
          to: rx + pw,
          isTrim: false,
        });

        const topH = remH - kerf;
        if (topH > EPSILON) {
          sheet.freeRects.push({
            x: rx,
            y: cutY + kerf,
            w: pw,
            h: topH,
            stage: nextStage + 1,
            lastCutDir: 'H',
          });
        }
      }
    }
  }

  private mergeFreeRects(rects: FreeRect[], kerf: number): void {
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < rects.length; i++) {
        const a = rects[i]!;
        for (let j = i + 1; j < rects.length; j++) {
          const b = rects[j]!;

          // Horizontal merge: same y, same h, adjacent in x
          if (Math.abs(a.y - b.y) < EPSILON && Math.abs(a.h - b.h) < EPSILON) {
            if (Math.abs(a.x + a.w - b.x) < EPSILON || Math.abs(a.x + a.w + kerf - b.x) < EPSILON) {
              a.w = b.x + b.w - a.x;
              rects.splice(j, 1);
              merged = true;
              break;
            } else if (Math.abs(b.x + b.w - a.x) < EPSILON || Math.abs(b.x + b.w + kerf - a.x) < EPSILON) {
              b.w = a.x + a.w - b.x;
              rects.splice(i, 1);
              merged = true;
              break;
            }
          }

          // Vertical merge: same x, same w, adjacent in y
          if (Math.abs(a.x - b.x) < EPSILON && Math.abs(a.w - b.w) < EPSILON) {
            if (Math.abs(a.y + a.h - b.y) < EPSILON || Math.abs(a.y + a.h + kerf - b.y) < EPSILON) {
              a.h = b.y + b.h - a.y;
              rects.splice(j, 1);
              merged = true;
              break;
            } else if (Math.abs(b.y + b.h - a.y) < EPSILON || Math.abs(b.y + b.h + kerf - a.y) < EPSILON) {
              b.h = a.y + a.h - b.y;
              rects.splice(i, 1);
              merged = true;
              break;
            }
          }
        }
        if (merged) break;
      }
    }
  }

  private orderCutSequence(cuts: CutOp[]): CutOp[] {
    const ordered = [...cuts].sort((a, b) => {
      // 1. Trim cuts first (stage 0)
      if (a.isTrim !== b.isTrim) {
        return a.isTrim ? -1 : 1;
      }
      // 2. Stage ascending
      if (a.stage !== b.stage) {
        return a.stage - b.stage;
      }
      // 3. Direction
      if (a.dir !== b.dir) {
        return a.dir.localeCompare(b.dir);
      }
      // 4. Position ascending
      if (Math.abs(a.pos - b.pos) > EPSILON) {
        return a.pos - b.pos;
      }
      // 5. From coordinate ascending
      return a.from - b.from;
    });

    return ordered.map((c, idx) => ({
      ...c,
      order: idx + 1,
    }));
  }
}
